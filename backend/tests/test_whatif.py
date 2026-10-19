"""
Checks for the "Day type" what-ifs: picking the real past days (app/whatif.py) and /api/plan?day_type=.

Run from the HELIOS folder:  python -m pytest backend/tests
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
import requests
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, planner, weather, whatif  # noqa: E402
from app.main import app  # noqa: E402


def history(day_peaks, start="2025-10-01"):
    """One day per peak value (W/m2 at noon), each a clean 24-hour sunlight curve."""
    index = pd.date_range(start, periods=24 * len(day_peaks), freq="h", tz=config.TIMEZONE)
    shape = np.clip(np.sin((index.hour - 6) / 12 * np.pi), 0, None)
    peak = np.repeat(day_peaks, 24)
    return pd.DataFrame({"actual_ghi": shape * peak, "actual_temp_air": 28.0, "actual_wind_speed": 2.0}, index=index)


def test_days_picked_by_percentile_of_daily_sunlight():
    # 11 days with noon peaks 0, 100, ..., 1000: sorted by total, rank round(p * 10)
    picked = whatif.pick_days(history([500, 0, 1000, 300, 700, 100, 900, 200, 800, 400, 600]))["days"]
    peaks = {name: max(day["hours"]["ghi"]) for name, day in picked.items()}
    assert peaks == {"sunny": 900, "average": 500, "cloudy": 100}
    assert picked["sunny"]["date"] == "2025-10-07"           # the day whose peak was 900
    assert len(picked["cloudy"]["hours"]["ghi"]) == 24


def test_days_with_missing_hours_or_outside_the_year_are_skipped():
    h = history([1000, 500, 200, 600, 400])
    h.iloc[5, 0] = np.nan                                    # day 1 (the sunniest) has a gap
    before = history([2000], start="2025-09-30")             # outside Oct 2025 - Sep 2026
    result = whatif.pick_days(pd.concat([before, h]))
    assert result["complete_days"] == 4
    assert max(result["days"]["sunny"]["hours"]["ghi"]) == 600


def test_committed_days_are_real_ordered_and_inside_the_year():
    data = whatif.load_days()
    days = data["days"]
    assert days["sunny"]["ghi_wh_m2"] > days["average"]["ghi_wh_m2"] > days["cloudy"]["ghi_wh_m2"]
    for day in days.values():
        assert "2025-10-01" <= day["date"] <= "2026-09-30"
        assert all(len(v) == 24 for v in day["hours"].values())


@pytest.fixture
def offline_client(monkeypatch):
    def no_internet(*args, **kwargs):
        raise requests.ConnectionError("tests run offline")
    monkeypatch.setattr(weather, "fetch_open_meteo", no_internet)
    planner._BASE_CACHE.clear()
    yield TestClient(app)
    planner._BASE_CACHE.clear()


def test_day_type_changes_solar_not_demand(offline_client):
    forecast = offline_client.get("/api/plan?rooftops=300").json()
    cloudy = offline_client.get("/api/plan?rooftops=300&day_type=cloudy").json()
    sunny = offline_client.get("/api/plan?rooftops=300&day_type=sunny").json()
    assert forecast["what_if"] is None
    assert cloudy["what_if"]["label"] == "Cloudy" and cloudy["what_if"]["date"] == whatif.load_days()["days"]["cloudy"]["date"]
    assert cloudy["totals"]["demand_kwh"] == forecast["totals"]["demand_kwh"]   # demand stays the forecast
    assert sunny["totals"]["solar_kwh"] > cloudy["totals"]["solar_kwh"]
    assert offline_client.get("/api/plan?day_type=rainy").status_code == 422
