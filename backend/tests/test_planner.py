"""
Checks for which day the dashboard plans, and for the lead-time-aware accuracy text.

Run from the HELIOS folder:  python -m pytest backend/tests
"""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import planner  # noqa: E402

D = dt.date.fromisoformat


def test_weekday_plans_the_next_day():
    assert planner.next_working_day(D("2026-10-14")) == D("2026-10-15")   # Wed -> Thu


def test_friday_and_weekend_plan_monday():
    assert planner.next_working_day(D("2026-10-16")) == D("2026-10-19")   # Fri -> Mon
    assert planner.next_working_day(D("2026-10-17")) == D("2026-10-19")   # Sat -> Mon


def test_national_holiday_is_skipped():
    # Fri 28 Aug 2026 -> Mon 31 Aug is National Day -> Tue 1 Sep
    assert planner.next_working_day(D("2026-08-28")) == D("2026-09-01")


def test_selangor_only_holiday_is_skipped():
    # Thu 10 Dec 2026 -> Fri 11 Dec is the Sultan of Selangor's birthday -> Mon 14 Dec
    assert planner.next_working_day(D("2026-12-10")) == D("2026-12-14")


SOLAR_REPORT = {
    "sentence": "Solar forecast: 10% better than a simple guess.",
    "detail": "...", "test_period": "2026-04-01 to 2026-09-30",
    "live_method": "forecast_pvlib", "simple_guess": "monthly_average",
    "methods": {"forecast_pvlib": {"mae_hourly_kwh_per_kwp": 0.0623},
                "monthly_average": {"mae_hourly_kwh_per_kwp": 0.0696}},
    "ai_decision": {"chosen_after_test": True},
    "by_lead_days": {"simple_guess_mae": 0.0695,
                     "leads": {"1": {"mae_hourly_kwh_per_kwp": 0.0622, "improvement_pct": 10},
                               "3": {"mae_hourly_kwh_per_kwp": 0.0668, "improvement_pct": 4},
                               "5": {"mae_hourly_kwh_per_kwp": 0.0682, "improvement_pct": 2}}},
}


def test_one_day_ahead_keeps_the_tested_sentence():
    sentence, small = planner.solar_accuracy_for_lead(SOLAR_REPORT, 1)
    assert sentence == SOLAR_REPORT["sentence"] and "1 day ahead" in small


def test_longer_lead_uses_its_own_lower_score():
    sentence, small = planner.solar_accuracy_for_lead(SOLAR_REPORT, 3)
    assert "3 days ahead: 4% better" in sentence and "falls with lead time" in small


def test_beyond_tested_leads_uses_the_longest_tested_score():
    sentence, _ = planner.solar_accuracy_for_lead(SOLAR_REPORT, 7)
    assert "7 days ahead: 2% better" in sentence
