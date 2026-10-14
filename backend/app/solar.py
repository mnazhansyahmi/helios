"""
Solar model: hourly weather -> hourly electricity from one rooftop (kWh).

Uses pvlib (https://pvlib-python.readthedocs.io), the standard open-source
library for modelling solar panels. The steps, in plain words:
  1. Where is the sun?                       (solar position)
  2. Split sunlight into direct + scattered  (Erbs model)
  3. How much lands on the tilted panel?     (plane-of-array irradiance)
  4. How hot is the panel?                   (hot panels make less power)
  5. Panel DC power                          (PVWatts model)
  6. Minus system losses and inverter        -> AC energy delivered
"""
import pandas as pd
import pvlib

from . import config

# Rooftop panels sit close to the roof, so they run hotter than panels on open racks.
_TEMP_PARAMS = pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS["sapm"]["close_mount_glass_glass"]
_LOCATION = pvlib.location.Location(config.ELMINA_LAT, config.ELMINA_LON,
                                    tz=config.TIMEZONE, altitude=config.ELEVATION_M)


def rooftop_kwh(weather: pd.DataFrame, kwp: float, tilt: float, azimuth: float) -> pd.Series:
    """
    Expected AC energy (kWh) from one rooftop for each hour in `weather`.

    weather needs columns: ghi (W/m2), temp_air (degC), wind_speed (m/s),
    indexed by hour START in local time (see weather.py).
    """
    # 1. Sun position at the MIDDLE of each hour (the sunlight value is an hourly average).
    mid_hour = weather.index + pd.Timedelta(minutes=30)
    sun = _LOCATION.get_solarposition(mid_hour)
    sun.index = weather.index

    # 2. Split total sunlight into direct beam (DNI) and scattered sky light (DHI).
    split = pvlib.irradiance.erbs(weather["ghi"], sun["zenith"], weather.index.dayofyear)

    # 3. Sunlight that lands on the tilted panel surface.
    on_panel = pvlib.irradiance.get_total_irradiance(
        surface_tilt=tilt, surface_azimuth=azimuth,
        solar_zenith=sun["apparent_zenith"], solar_azimuth=sun["azimuth"],
        dni=split["dni"], ghi=weather["ghi"], dhi=split["dhi"],
    )["poa_global"].fillna(0)

    # 4. Panel temperature from sunlight, air temperature and wind.
    temp_cell = pvlib.temperature.sapm_cell(on_panel, weather["temp_air"], weather["wind_speed"], **_TEMP_PARAMS)

    # 5. DC power from the panels (watts).
    dc_watts = pvlib.pvsystem.pvwatts_dc(on_panel, temp_cell, pdc0=kwp * 1000,
                                         gamma_pdc=config.PANEL_TEMP_COEFF_PER_C)

    # 6. System losses, then the inverter (DC -> AC). Inverter sized equal to the panels.
    dc_watts = dc_watts * (1 - config.SYSTEM_LOSSES_PCT / 100)
    ac_watts = pvlib.inverter.pvwatts(dc_watts, pdc0=kwp * 1000 / config.INVERTER_EFFICIENCY,
                                      eta_inv_nom=config.INVERTER_EFFICIENCY)

    # Average watts over one hour = watt-hours; /1000 -> kWh. Never negative (night).
    return (ac_watts.clip(lower=0) / 1000).rename("kwh")
