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
from functools import lru_cache

import joblib
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
    kwh = ac_watts.clip(lower=0) / 1000
    # Missing weather must give missing output, not a fake zero.
    return kwh.where(weather["ghi"].notna()).rename("kwh")


# ---------------------------------------------------------------------------
# AI correction of the sunlight forecast
#
# Weather models make repeatable mistakes (e.g. over-forecasting afternoon sun when
# tropical clouds build up). A small ML model, trained on past forecasts vs Himawari
# satellite data, learns those mistakes and corrects tomorrow's sunlight forecast.
# The physics above then turns the corrected sunlight into kWh.
# Trained and scored by backend/ml/02_eval_solar.py. If that script decided the
# correction does not help, no model file is saved and the raw forecast is used.
# ---------------------------------------------------------------------------
CORRECTION_MODEL_PATH = config.MODELS_DIR / "solar_correction.joblib"


def clear_sky_ghi(index: pd.DatetimeIndex) -> pd.Series:
    """Sunlight (W/m2) Elmina would get in each hour if there were no clouds at all."""
    clear = _LOCATION.get_clearsky(index + pd.Timedelta(minutes=30))["ghi"]
    clear.index = index
    return clear


def correction_features(weather: pd.DataFrame) -> pd.DataFrame:
    """The inputs the correction model sees. Used for BOTH training and live forecasts."""
    clear = clear_sky_ghi(weather.index)
    sun = _LOCATION.get_solarposition(weather.index + pd.Timedelta(minutes=30))
    return pd.DataFrame({
        "forecast_ghi": weather["ghi"],
        "clear_sky_ghi": clear,
        # 1.0 = forecast says cloudless; 0.3 = heavy cloud
        "forecast_clearness": (weather["ghi"] / clear).where(clear > 10, 0).clip(0, 1.5),
        "cloud_cover": weather["cloud_cover"],
        "temp_air": weather["temp_air"],
        "hour": weather.index.hour,
        "sun_elevation": sun["apparent_elevation"].values,
    }, index=weather.index)


@lru_cache(maxsize=1)
def _correction_model():
    return joblib.load(CORRECTION_MODEL_PATH) if CORRECTION_MODEL_PATH.exists() else None


def corrected_ghi(weather: pd.DataFrame, model=None) -> pd.Series:
    """
    Forecast sunlight after the AI correction (W/m2).
    Falls back to the raw forecast if there is no trained correction model.
    """
    model = model or _correction_model()
    if model is None:
        return weather["ghi"]
    features = correction_features(weather)
    predicted = pd.Series(model.predict(features), index=weather.index).clip(lower=0)
    return predicted.where(features["sun_elevation"] > 0, 0.0)  # no sun, no sunlight
