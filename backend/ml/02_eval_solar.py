"""
Step 2: How accurate is the solar forecast? Scored on held-out months.

Run from the HELIOS folder:
    python backend/ml/02_eval_solar.py

The question: on day D-1, how well can we predict each hour of day D's output
from a 1 kWp rooftop in Elmina?

"What actually happened" = Himawari satellite sunlight, turned into kWh with the
same pvlib model. There is no public CREAM meter data, so this measures the
forecast method, not real rooftop meters. The dashboard says so.

Four methods, all scored on exactly the same hours:
  1. Persistence      "tomorrow = today"                                 (simple guess)
  2. Monthly average  the average day for that month, from training data (simple guess)
  3. Forecast + pvlib ECMWF day-ahead forecast -> physics model
  4. Forecast + AI    the same, but an ML model corrects the sunlight forecast first

Rules, fixed BEFORE looking at any test result:
  - Training months:  Jun 2024 - Mar 2026
  - Test months:      Apr 2026 - Sep 2026. Never used for training or for decisions.
  - Whether the live demo uses the AI correction is decided on a validation slice
    INSIDE the training period (Jan - Mar 2026).
  - Headline score: mean absolute error (MAE) per daylight hour, kWh per kWp.
    "Simple guess" = whichever of methods 1 and 2 scores better on the test months,
    so the improvement we claim is never inflated by a weak baseline.
"""
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # lets us import from backend/app
from app import config, solar  # noqa: E402
from app.reports import save_accuracy_section  # noqa: E402

TRAIN_START, TRAIN_END = "2024-06-01", "2026-03-31"
VALID_START = "2026-01-01"   # last 3 training months: only used to decide on the AI correction
TEST_START, TEST_END = "2026-04-01", "2026-09-30"

# DECISION LOG (2026-10-14). The rule above picked the AI correction: it beat the plain
# forecast on the validation months, and in 8 of 8 held-out seasons of the training data.
# But on the test months it did WORSE. The forecast's sunlight bias shrank in 2026 (from
# roughly +40 W/m2 to +10), so a correction that learned "subtract ~40" now over-corrects.
# The team chose the plain forecast for the live demo, KNOWING this choice was made after
# seeing the test results. The dashboard says so. Set to None to go back to the rule.
LIVE_METHOD_CHOSEN_AFTER_TEST = "forecast_pvlib"

# Reference rooftop for scoring (ASSUMED, typical): 1 kWp, tilted 10 degrees, facing south.
REFERENCE_ROOF = {"kwp": 1.0, "tilt": 10, "azimuth": 180}

METHOD_LABELS = {
    "persistence": "Tomorrow = today",
    "monthly_average": "Average day for the month",
    "forecast_pvlib": "Weather forecast + pvlib",
    "forecast_ai": "Weather forecast + AI correction + pvlib",
}


def load_history() -> pd.DataFrame:
    history = pd.read_csv(config.PROCESSED_DIR / "solar_history.csv", index_col=0)
    history.index = pd.to_datetime(history.index, utc=True).tz_convert(config.TIMEZONE)
    return history


def forecast_weather(history: pd.DataFrame) -> pd.DataFrame:
    """The weather as forecast ~24 h ahead, with the column names solar.py expects."""
    return pd.DataFrame({"ghi": history["fc_ghi"], "temp_air": history["fc_temp_air"],
                         "wind_speed": history["fc_wind_speed"], "cloud_cover": history["fc_cloud_cover"]})


def actual_weather(history: pd.DataFrame) -> pd.DataFrame:
    """What really happened: satellite sunlight + ERA5 temperature and wind."""
    return pd.DataFrame({"ghi": history["actual_ghi"], "temp_air": history["actual_temp_air"],
                         "wind_speed": history["actual_wind_speed"]})


def train_correction(fc: pd.DataFrame, actual_ghi: pd.Series) -> HistGradientBoostingRegressor:
    """Learn to predict the satellite sunlight from the forecast (daylight hours only)."""
    features = solar.correction_features(fc)
    use = (features["sun_elevation"] > 0) & actual_ghi.notna()
    # loss="absolute_error" because we are scored on absolute error (MAE).
    # Settings are sensible defaults, NOT tuned on the test months.
    model = HistGradientBoostingRegressor(loss="absolute_error", learning_rate=0.05, max_iter=500,
                                          early_stopping=True, validation_fraction=0.15, random_state=0)
    return model.fit(features[use], actual_ghi[use])


def ai_kwh(model, fc: pd.DataFrame) -> pd.Series:
    corrected = fc.assign(ghi=solar.corrected_ghi(fc, model=model))
    return solar.rooftop_kwh(corrected, **REFERENCE_ROOF)


def mae(pred: pd.Series, actual: pd.Series, mask: pd.Series) -> float:
    return float((pred[mask] - actual[mask]).abs().mean())


def main() -> None:
    history = load_history()
    fc, act = forecast_weather(history), actual_weather(history)
    actual = solar.rooftop_kwh(act, **REFERENCE_ROOF)       # kWh per kWp, what really happened
    daylight = solar.clear_sky_ghi(history.index) > 0
    local_day = history.index.tz_localize(None).normalize()   # calendar day in Malaysia time
    in_train = (local_day >= TRAIN_START) & (local_day <= TRAIN_END)
    in_test = (local_day >= TEST_START) & (local_day <= TEST_END)

    # --- 1 & 2: the simple guesses ---------------------------------------------------------
    predictions = {"persistence": actual.shift(24)}          # same hour yesterday
    month_hour = [actual.index.month, actual.index.hour]
    profile = actual[in_train].groupby([actual.index.month[in_train], actual.index.hour[in_train]]).mean()
    predictions["monthly_average"] = pd.Series(profile.reindex(pd.MultiIndex.from_arrays(month_hour)).values,
                                               index=actual.index)

    # --- 3: raw weather forecast + physics --------------------------------------------------
    predictions["forecast_pvlib"] = solar.rooftop_kwh(fc, **REFERENCE_ROOF)

    # --- 4: AI correction. First DECIDE on the validation slice (inside training)... -------
    in_valid = in_train & (local_day >= VALID_START)
    early_model = train_correction(fc[in_train & ~in_valid], history["actual_ghi"][in_train & ~in_valid])
    valid_mask = in_valid & daylight & actual.notna()
    valid_raw = mae(predictions["forecast_pvlib"], actual, valid_mask)
    valid_ai = mae(ai_kwh(early_model, fc), actual, valid_mask)
    use_ai = valid_ai < valid_raw

    # ...then retrain on ALL training months and score on the test months (reported either way).
    final_model = train_correction(fc[in_train], history["actual_ghi"][in_train])
    predictions["forecast_ai"] = ai_kwh(final_model, fc)

    rule_method = "forecast_ai" if use_ai else "forecast_pvlib"
    live_method = LIVE_METHOD_CHOSEN_AFTER_TEST or rule_method
    if live_method == "forecast_ai":
        config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(final_model, solar.CORRECTION_MODEL_PATH)
    elif solar.CORRECTION_MODEL_PATH.exists():
        solar.CORRECTION_MODEL_PATH.unlink()   # no model file -> live demo uses the raw forecast

    # --- Score every method on the SAME test hours -----------------------------------------
    test = in_test & daylight & actual.notna()
    for p in predictions.values():
        test &= p.notna()
    # daily totals: only test days where every daylight hour survived the filter
    day = pd.Series(actual.index.date, index=actual.index)
    kept, expected = test.groupby(day).sum(), (in_test & daylight).groupby(day).sum()
    full_days = (kept == expected) & (expected > 0)
    test_days = test & day.map(full_days)

    def daily_mae(pred):
        return float((pred[test_days].groupby(day[test_days]).sum()
                      - actual[test_days].groupby(day[test_days]).sum()).abs().mean())

    methods = {}
    for key, pred in predictions.items():
        methods[key] = {
            "label": METHOD_LABELS[key],
            "mae_hourly_kwh_per_kwp": round(mae(pred, actual, test), 4),
            "mae_daily_kwh_per_kwp": round(daily_mae(pred), 3),
            "bias_hourly_kwh_per_kwp": round(float((pred[test] - actual[test]).mean()), 4),
        }

    simple = min(["persistence", "monthly_average"], key=lambda k: methods[k]["mae_hourly_kwh_per_kwp"])
    live_mae = methods[live_method]["mae_hourly_kwh_per_kwp"]
    simple_mae = methods[simple]["mae_hourly_kwh_per_kwp"]
    improvement = round(100 * (1 - live_mae / simple_mae))
    if improvement > 0:
        sentence = f"Solar forecast: {improvement}% better than a simple guess."
    else:
        sentence = "Solar forecast: not yet better than a simple guess."

    disclosure = ""
    if live_method != rule_method:
        disclosure = (" Method chosen after testing: an AI correction helped in 2024-25"
                      " but over-corrected in 2026.")

    # How far the raw forecast over-predicted sunlight (W/m2): shows the 2026 drift.
    sun_err = history["fc_ghi"] - history["actual_ghi"]
    has_sun = daylight & history["actual_ghi"].notna()
    drift = {"forecast_sunlight_bias_w_m2_training": round(float(sun_err[has_sun & in_train].mean()), 1),
             "forecast_sunlight_bias_w_m2_test": round(float(sun_err[has_sun & in_test].mean()), 1)}

    hours = pd.Series(actual.index.hour, index=actual.index)
    by_hour = {int(h): {k: round(mae(predictions[k], actual, test & (hours == h)), 4)
                        for k in ("forecast_pvlib", "forecast_ai")}
               for h in sorted(hours[test].unique())}

    section = {
        "title": "Solar forecast, one day ahead, per 1 kWp rooftop",
        "sentence": sentence,
        "detail": (f"Average error {live_mae:.3f} kWh per kWp per daylight hour, vs {simple_mae:.3f} for the "
                   f"simple guess ({METHOD_LABELS[simple].lower()}). Tested on Apr-Sep 2026, months the model "
                   f"never saw, against satellite sunlight estimates (no public rooftop meter data)."
                   f"{disclosure}"),
        "improvement_pct": improvement,
        "live_method": live_method,
        "simple_guess": simple,
        "methods": methods,
        "ai_decision": {"validation_period": f"{VALID_START} to {TRAIN_END}",
                        "validation_mae_raw": round(valid_raw, 4), "validation_mae_ai": round(valid_ai, 4),
                        "rule_picked": rule_method, "used_live": live_method == "forecast_ai",
                        "chosen_after_test": live_method != rule_method},
        "drift": drift,
        "train_period": f"{TRAIN_START} to {TRAIN_END}",
        "test_period": f"{TEST_START} to {TEST_END}",
        "test_daylight_hours": int(test.sum()),
        "test_full_days": int(full_days.sum()),
        "mean_actual_kwh_per_kwp_per_daylight_hour": round(float(actual[test].mean()), 4),
        "mae_by_hour": by_hour,
        "truth": "Himawari satellite sunlight (Open-Meteo) converted to kWh with the same pvlib model",
    }
    save_accuracy_section("solar", section)

    # --- Print a readable summary ----------------------------------------------------------
    print(f"Validation ({VALID_START} to {TRAIN_END}): raw {valid_raw:.4f} vs AI {valid_ai:.4f} "
          f"-> rule picks {rule_method}; live demo uses {live_method}")
    print(f"Forecast sunlight bias: training {drift['forecast_sunlight_bias_w_m2_training']:+} W/m2, "
          f"test {drift['forecast_sunlight_bias_w_m2_test']:+} W/m2")
    print(f"\nTEST {TEST_START} to {TEST_END}: {int(test.sum())} daylight hours, {int(full_days.sum())} full days; "
          f"mean actual {actual[test].mean():.3f} kWh/kWp per daylight hour")
    print(f"{'method':44s} {'MAE/hour':>9s} {'MAE/day':>8s} {'bias/hour':>10s}")
    for key, m in methods.items():
        flag = "  <- live" if key == live_method else ("  <- simple guess" if key == simple else "")
        print(f"{m['label']:44s} {m['mae_hourly_kwh_per_kwp']:9.4f} {m['mae_daily_kwh_per_kwp']:8.3f} "
              f"{m['bias_hourly_kwh_per_kwp']:+10.4f}{flag}")
    print(f"\n{sentence}\n{section['detail']}")
    print("\nMAE by hour of day (raw forecast vs AI):")
    for h, v in by_hour.items():
        print(f"  {h:02d}:00  raw {v['forecast_pvlib']:.3f}  ai {v['forecast_ai']:.3f}")


if __name__ == "__main__":
    main()
