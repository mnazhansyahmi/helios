"""
Sanity checks for the solar model. They use pvlib's built-in clear-sky weather,
so they run offline and give the same answer every time.

Run from the HELIOS folder:  python -m pytest backend/tests
"""
import sys
from pathlib import Path

import pandas as pd
import pvlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, solar  # noqa: E402


def clear_sky_day(day: str = "2026-03-21") -> pd.DataFrame:
    """One cloudless day in Elmina, hourly, labelled by hour start (like weather.py)."""
    hours = pd.date_range(day, periods=24, freq="h", tz=config.TIMEZONE)
    location = pvlib.location.Location(config.ELMINA_LAT, config.ELMINA_LON, tz=config.TIMEZONE)
    ghi = location.get_clearsky(hours + pd.Timedelta(minutes=30))["ghi"].values
    return pd.DataFrame({"ghi": ghi, "temp_air": 30.0, "wind_speed": 1.5}, index=hours)


def test_no_power_at_night():
    kwh = solar.rooftop_kwh(clear_sky_day(), kwp=5, tilt=10, azimuth=180)
    night = kwh[(kwh.index.hour < 6) | (kwh.index.hour >= 20)]
    assert (night == 0).all()


def test_never_more_than_panel_size():
    kwh = solar.rooftop_kwh(clear_sky_day(), kwp=5, tilt=10, azimuth=180)
    assert kwh.max() <= 5.0  # a 5 kWp system can't deliver more than 5 kWh in one hour


def test_clear_day_total_is_realistic():
    # A clear day in Malaysia gives roughly 4-6 kWh per kWp. Outside that range = a bug.
    kwh_per_kwp = solar.rooftop_kwh(clear_sky_day(), kwp=1, tilt=10, azimuth=180).sum()
    assert 4.0 < kwh_per_kwp < 6.0


def test_missing_weather_gives_missing_output_not_zero():
    weather = clear_sky_day()
    weather.loc[weather.index[12], "ghi"] = float("nan")  # satellite gap at noon
    kwh = solar.rooftop_kwh(weather, kwp=1, tilt=10, azimuth=180)
    assert pd.isna(kwh.iloc[12]) and kwh.iloc[11] > 0


def test_ai_correction_never_adds_sunlight_at_night():
    class AlwaysBright:  # a deliberately wrong "model" that predicts sun all day and night
        def predict(self, features):
            return [500.0] * len(features)

    weather = clear_sky_day().assign(cloud_cover=50.0)
    corrected = solar.corrected_ghi(weather, model=AlwaysBright())
    night = (corrected.index.hour < 6) | (corrected.index.hour >= 20)
    assert (corrected[night] == 0).all() and (corrected[~night] >= 0).all()


def test_output_scales_with_panel_size():
    weather = clear_sky_day()
    small = solar.rooftop_kwh(weather, kwp=2, tilt=10, azimuth=180).sum()
    big = solar.rooftop_kwh(weather, kwp=8, tilt=10, azimuth=180).sum()
    assert abs(big / small - 4) < 0.01
