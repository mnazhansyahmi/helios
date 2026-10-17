"""
Step 4: How accurate is the solar forecast when it is made 1 to 5 days ahead?

Run from the HELIOS folder (after 02_eval_solar.py):
    python backend/ml/04_eval_solar_lead_time.py

Why: the dashboard plans the NEXT WORKING DAY, which is 1 day ahead on a normal
weekday but 3 days ahead on a Friday (Monday's plan), and more over a long holiday.
02_eval_solar.py scored the 1-day-ahead forecast; this scores older forecasts with
the SAME method (ECMWF forecast -> pvlib), SAME held-out months (Apr-Sep 2026),
SAME "simple guess" (average day for the month) and SAME hours. Nothing is tuned.

Output: reports/accuracy.json -> solar.by_lead_days
"""
import importlib.util
import sys
from pathlib import Path

import pandas as pd

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app import config, solar  # noqa: E402
from app.reports import load_accuracy, save_accuracy_section  # noqa: E402
from app.weather import fetch_open_meteo, hourly_frame  # noqa: E402

# Reuse the exact settings and helpers of the 1-day evaluation
_spec = importlib.util.spec_from_file_location("eval_solar", Path(__file__).with_name("02_eval_solar.py"))
ev = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ev)

LEADS = [1, 2, 3, 4, 5]


def forecasts_made_days_ahead() -> dict[int, pd.DataFrame]:
    """ECMWF forecasts for the test months as issued 1..5 days before each hour."""
    names = {}
    for n in LEADS:
        names[f"shortwave_radiation_previous_day{n}"] = f"ghi_{n}"
        names[f"temperature_2m_previous_day{n}"] = f"temp_air_{n}"
        names[f"wind_speed_10m_previous_day{n}"] = f"wind_speed_{n}"
    end = pd.Timestamp(ev.TEST_END) + pd.Timedelta(days=1)  # last hour is labelled 00:00 next day
    payload = fetch_open_meteo(config.OPEN_METEO_PREVIOUS_RUNS_URL, {
        "latitude": config.ELMINA_LAT, "longitude": config.ELMINA_LON, "timezone": config.TIMEZONE,
        "wind_speed_unit": "ms", "models": config.WEATHER_MODEL, "hourly": ",".join(names),
        "start_date": ev.TEST_START, "end_date": end.date().isoformat()})
    frame = hourly_frame(payload, names)
    return {n: pd.DataFrame({"ghi": frame[f"ghi_{n}"], "temp_air": frame[f"temp_air_{n}"],
                             "wind_speed": frame[f"wind_speed_{n}"]}) for n in LEADS}


def main() -> None:
    history = ev.load_history()
    actual = solar.rooftop_kwh(ev.actual_weather(history), **ev.REFERENCE_ROOF)
    daylight = solar.clear_sky_ghi(history.index) > 0
    local_day = history.index.tz_localize(None).normalize()
    in_train = (local_day >= ev.TRAIN_START) & (local_day <= ev.TRAIN_END)
    in_test = (local_day >= ev.TEST_START) & (local_day <= ev.TEST_END)

    # The simple guess, exactly as in 02_eval_solar.py: average day for the month (training data)
    profile = actual[in_train].groupby([actual.index.month[in_train], actual.index.hour[in_train]]).mean()
    simple = pd.Series(profile.reindex(pd.MultiIndex.from_arrays([actual.index.month, actual.index.hour])).values,
                       index=actual.index)

    predictions = {n: solar.rooftop_kwh(w, **ev.REFERENCE_ROOF).reindex(actual.index)
                   for n, w in forecasts_made_days_ahead().items()}

    # Score every lead time on the SAME hours
    test = in_test & daylight & actual.notna() & simple.notna()
    for p in predictions.values():
        test &= p.notna()
    simple_mae = float((simple[test] - actual[test]).abs().mean())

    by_lead = {}
    print(f"Held-out {ev.TEST_START} to {ev.TEST_END}, {int(test.sum())} daylight hours. "
          f"Simple guess MAE {simple_mae:.4f} kWh/kWp per hour.")
    for n, pred in predictions.items():
        mae = float((pred[test] - actual[test]).abs().mean())
        improvement = round(100 * (1 - mae / simple_mae))
        by_lead[str(n)] = {"mae_hourly_kwh_per_kwp": round(mae, 4), "improvement_pct": improvement}
        print(f"  forecast made {n} day(s) ahead: MAE {mae:.4f}  ->  {improvement:+d}% vs the simple guess")

    report = load_accuracy()["solar"]
    report["by_lead_days"] = {"leads": by_lead, "simple_guess_mae": round(simple_mae, 4),
                              "test_daylight_hours": int(test.sum())}
    save_accuracy_section("solar", report)


if __name__ == "__main__":
    main()
