"""
API checks. The internet is switched OFF in these tests on purpose: they prove the
dashboard still works from the saved forecast (the live-demo safety net).

Run from the HELIOS folder:  python -m pytest backend/tests
"""
import sys
from pathlib import Path

import pytest
import requests
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, planner, weather  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def offline_client(monkeypatch):
    def no_internet(*args, **kwargs):
        raise requests.ConnectionError("tests run offline")
    monkeypatch.setattr(weather, "fetch_open_meteo", no_internet)
    planner._BASE_CACHE.clear()
    yield TestClient(app)
    planner._BASE_CACHE.clear()


def test_offline_plan_uses_saved_forecast_and_says_so(offline_client):
    plan = offline_client.get("/api/plan").json()
    assert plan["weather"]["source"] == "cached"
    assert plan["weather"]["banner"].startswith("Offline")
    assert len(plan["hours"]) == 24


def test_plan_says_which_day_and_how_far_ahead(offline_client):
    plan = offline_client.get("/api/plan").json()
    assert isinstance(plan["lead_days"], int) and isinstance(plan["is_next_working_day"], bool)
    assert plan["accuracy"]["solar"]["small_print"]


def test_each_rooftop_has_24_hours_for_one_roof(offline_client):
    plan = offline_client.get("/api/plan?rooftops=80").json()   # 80 rooftops -> 10 roofs per type
    for r in plan["rooftops"]:
        one_roof = r["hourly_kwh_one_roof"]
        assert len(one_roof) == 24 and min(one_roof) >= 0
        assert sum(one_roof) == pytest.approx(r["kwh_one_roof"], abs=0.05)
        # the fleet total for this type at noon = one roof x roofs it stands for
        noon = plan["hours"][12]["rooftops_kwh"][r["id"]]
        assert noon == pytest.approx(one_roof[12] * r["roofs_represented"], abs=0.1)


def test_default_scenario_is_50_rooftops(offline_client):
    plan = offline_client.get("/api/plan").json()
    assert plan["scenario"]["rooftops"] == config.FLEET_DEFAULT == 50
    assert "Scenario" in plan["scenario"]["label"]


def test_zero_rooftops_means_everything_from_grid(offline_client):
    t = offline_client.get("/api/plan?rooftops=0").json()["totals"]
    assert t["solar_used_kwh"] == 0 and t["co2_avoided_kg"] == 0
    assert t["grid_topup_kwh"] == t["demand_kwh"]


def test_slider_limits_are_enforced(offline_client):
    assert offline_client.get("/api/plan?rooftops=1001").status_code == 422
    assert offline_client.get("/api/plan?rooftops=-1").status_code == 422


def test_preset_makes_noon_solar_about_equal_noon_demand(offline_client):
    preset = offline_client.get("/api/plan").json()["scenario"]["preset_noon_match"]
    noon = offline_client.get(f"/api/plan?rooftops={preset}").json()["hours"][config.PRESET_HOUR]
    assert noon["solar_kwh"] == pytest.approx(noon["demand_kwh"], rel=0.02)


def test_more_rooftops_never_means_more_grid(offline_client):
    gaps = [offline_client.get(f"/api/plan?rooftops={n}").json()["totals"]["grid_topup_kwh"] for n in (0, 50, 300, 1000)]
    assert gaps == sorted(gaps, reverse=True)


def test_every_hour_balances(offline_client):
    for h in offline_client.get("/api/plan?rooftops=600").json()["hours"]:
        assert h["solar_used_kwh"] + h["grid_topup_kwh"] == pytest.approx(h["demand_kwh"], abs=0.2)
        assert h["solar_used_kwh"] + h["surplus_kwh"] == pytest.approx(h["solar_kwh"], abs=0.2)


def test_chart_markers_show_the_afternoon_gap(offline_client):
    plan = offline_client.get(f"/api/plan?rooftops={config.FLEET_DEFAULT}").json()
    peaks = plan["peaks"]
    assert 11 <= peaks["solar_hour"] <= 13                      # solar peaks around noon
    assert peaks["afternoon_demand_hour"] >= peaks["solar_hour"]  # demand peaks at noon or later
    assert peaks["grid_topup_at_afternoon_demand_peak_kwh"] > 0
    assert offline_client.get("/api/plan?rooftops=0").json()["peaks"]["solar_hour"] is None


def test_accuracy_sentences_reach_the_dashboard(offline_client):
    accuracy = offline_client.get("/api/plan").json()["accuracy"]
    assert accuracy["solar"]["sentence"].startswith("Solar forecast")
    assert accuracy["demand"]["sentence"].startswith("Demand forecast")
