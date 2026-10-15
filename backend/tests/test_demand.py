"""
Sanity checks for the demand model. They use the trained models in backend/models
and made-up weather, so they run offline.

Run from the HELIOS folder:  python -m pytest backend/tests
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, demand, sites  # noqa: E402

OFFICE_A = next(b for b in sites.BUYERS if b["name"] == "Office A")


def typical_elmina_day(day: str) -> pd.DataFrame:
    """A made-up but typical Elmina day: 24 degC at night rising to 32 degC mid-afternoon, humid."""
    hours = pd.date_range(day, periods=24, freq="h", tz=config.TIMEZONE)
    temp = [24 + 8 * max(0.0, 1 - abs(h - 14) / 8) for h in hours.hour]
    return pd.DataFrame({"temp_air": temp, "dew_point": 24.0}, index=hours)


def test_malaysian_holidays_are_flagged():
    hours = pd.DatetimeIndex(["2026-08-31 12:00", "2026-09-01 12:00", "2026-12-11 12:00"], tz=config.TIMEZONE)
    calendar = demand.malaysia_holidays([2026])
    x = demand.features(hours, [30, 30, 30], [24, 24, 24], calendar)
    # National Day, an ordinary Tuesday, Sultan of Selangor's birthday (Selangor only)
    assert x["is_holiday"].tolist() == [1, 0, 1]


def test_every_buyer_gets_24_sensible_hours():
    weather = typical_elmina_day("2026-10-15")  # a Thursday, not a holiday
    for buyer in sites.BUYERS:
        kwh = demand.predict_kwh(buyer, weather)
        assert len(kwh) == 24 and kwh.notna().all() and (kwh >= 0).all()


def test_office_uses_more_at_late_morning_than_at_3am():
    kwh = demand.predict_kwh(OFFICE_A, typical_elmina_day("2026-10-15"))
    assert kwh.iloc[11] > kwh.iloc[3]


def test_office_uses_less_on_sunday_than_on_a_weekday():
    weekday = demand.predict_kwh(OFFICE_A, typical_elmina_day("2026-10-15")).iloc[9:17].sum()
    sunday = demand.predict_kwh(OFFICE_A, typical_elmina_day("2026-10-18")).iloc[9:17].sum()
    assert sunday < weekday
