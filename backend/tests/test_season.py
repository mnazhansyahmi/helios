"""
Checks for the For SDP tab's Season summary (backend/app/season.py) and GET /api/season.

Run from the HELIOS folder:  python -m pytest backend/tests
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, season, sites  # noqa: E402
from app.main import app  # noqa: E402

ROOFS = [r["id"] for r in sites.ROOFTOPS]
BUYERS = [b["id"] for b in sites.BUYERS]


def hours(start, days):
    return pd.date_range(start, periods=24 * days, freq="h", tz=config.TIMEZONE)


def test_summary_per_month_matches_hand_sums():
    index = hours("2026-01-31", 2)                        # one day in January, one in February
    sun = np.where((index.hour >= 8) & (index.hour < 18), 1.0, 0.0)
    one_roof = pd.DataFrame({r: sun for r in ROOFS}, index=index)   # 1 kWh per roof per sunlit hour
    need = pd.DataFrame({b: np.full(len(index), 10.0 * (i + 1)) for i, b in enumerate(BUYERS)}, index=index)
    months = season.summarise(one_roof, need, rooftops=len(ROOFS) * 30)   # 30 roofs per type -> 240 kWh/h

    assert [m["month"] for m in months] == ["2026-01", "2026-02"]
    jan = months[0]
    # demand 10/20/30 kWh every hour -> sunlit-hour shares 1/6, 2/6, 3/6
    assert list(jan["allocation_pct"].values()) == [16.7, 33.3, 50.0]
    # 240 kWh of solar against 60 kWh of demand in each of 10 sunlit hours: all daytime demand met
    assert jan["coverage_pct"] == pytest.approx(100 * 10 / 24, abs=0.1)
    assert jan["surplus_kwh"] == 10 * (240 - 60)
    assert jan["days"] == 1


def test_build_season_on_synthetic_weather():
    index = hours("2026-03-01", 61)
    elevation = np.clip(np.sin((index.hour - 6) / 12 * np.pi), 0, None)
    weather = pd.DataFrame({"ghi": 900 * elevation, "temp_air": 30.0, "dew_point": 24.0, "wind_speed": 2.0},
                           index=index)
    result = season.build_season(weather, sources=["test"])
    assert result["from"] == "2026-03-01" and result["to"] == "2026-04-30"
    assert config.FLEET_MIN <= result["rooftops"] <= config.FLEET_MAX
    assert [m["month"] for m in result["months"]] == ["2026-03", "2026-04"]
    for m in result["months"]:
        assert sum(m["allocation_pct"].values()) == pytest.approx(100, abs=0.2)
        assert 0 <= m["coverage_pct"] <= 100 and m["surplus_kwh"] >= 0


def test_season_endpoint(tmp_path, monkeypatch):
    monkeypatch.setattr(season, "SEASON_PATH", tmp_path / "season.json")
    client = TestClient(app)
    assert client.get("/api/season").status_code == 404
    season.SEASON_PATH.write_text(json.dumps({"months": [], "rooftops": 300}))
    assert client.get("/api/season").json()["rooftops"] == 300
