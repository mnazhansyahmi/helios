"""
Step 3: Train the demand models and score them on held-out months.

Run from the HELIOS folder:
    python backend/ml/03_train_demand.py

One model per buyer, each trained on a REAL Orlando building (Building Data Genome 2)
that stands in for an Elmina building. The model is scored exactly as it runs in
the demo (see app/demand.py for what it can and cannot see).

Methods, all scored on exactly the same hours:
  1. Hour-of-week average   average use for that hour of that weekday, from training data
  2. Same hour last week    use exactly 7 days earlier
  3. ML model (live)        hour, weekday, holiday, temperature, dew point
  4. ML model + meter data  the same plus yesterday's and last week's use. NOT used in
                            the demo (no meter feed); shows what live CREAM data would add.

Rules, fixed BEFORE looking at any test result:
  - Training: 21 May 2016 - 30 Jun 2017 (the site has no data before 20 May 2016)
  - Test:     1 Jul - 31 Dec 2017. Never used for training or for decisions.
  - Headline: mean absolute error (MAE) over all buyer-hours combined, in kWh.
    "Simple guess" = whichever of methods 1 and 2 scores better.
  - If the live model does not beat BOTH baselines, the script says so plainly.
    Nothing is tuned to the test months.
  - Hurricane Irma (Florida, Sept 2017) stays in the headline; 8-17 Sep 2017 is
    also reported separately as a sensitivity check.

Limitation (stated in the dashboard): the test uses MEASURED temperatures. In real
use the model gets a temperature FORECAST, which adds some error.
"""
import sys
from pathlib import Path

import holidays
import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # lets us import from backend/app
from app import config, demand, sites  # noqa: E402
from app.reports import save_accuracy_section  # noqa: E402

TRAIN_START, TRAIN_END = "2016-05-21", "2017-06-30"
TEST_START, TEST_END = "2017-07-01", "2017-12-31"
IRMA_START, IRMA_END = "2017-09-08", "2017-09-17"

METHOD_LABELS = {
    "hour_of_week_average": "Average for that hour of the week",
    "last_week": "Same hour last week",
    "model": "ML model (used in demo)",
    "model_with_meter_data": "ML model + live meter data (not in demo)",
}
BASELINES = ["hour_of_week_average", "last_week"]

# The training buildings are in Florida, so they follow the US / Florida holiday calendar.
TRAINING_HOLIDAYS = holidays.country_holidays("US", subdiv="FL", years=[2016, 2017])


def new_model() -> HistGradientBoostingRegressor:
    # loss="absolute_error" because we are scored on MAE. Sensible defaults, NOT tuned on test.
    return HistGradientBoostingRegressor(loss="absolute_error", learning_rate=0.05, max_iter=500,
                                         early_stopping=True, validation_fraction=0.15, random_state=0)


def evaluate_building(buyer: dict, history: pd.DataFrame) -> pd.DataFrame:
    """Train on the training months; return actual + every method's prediction for the test months."""
    b = history[history["bdg2_id"] == buyer["bdg2_id"]].set_index("timestamp").asfreq("h")
    kwh, day = b["kwh"], b.index.normalize()
    train = (day >= TRAIN_START) & (day <= TRAIN_END) & kwh.notna()
    test = (day >= TEST_START) & (day <= TEST_END)
    x = demand.features(b.index, b["temp_air"], b["dew_point"], TRAINING_HOLIDAYS)

    predictions = {}
    # 1. hour-of-week average (168 numbers learned from the training months)
    hour_of_week = pd.Series(b.index.dayofweek * 24 + b.index.hour, index=b.index)
    predictions["hour_of_week_average"] = hour_of_week.map(kwh[train].groupby(hour_of_week[train]).mean())
    # 2. same hour last week
    predictions["last_week"] = kwh.shift(168)
    # 3. the live model - saved for the demo
    model = new_model().fit(x[train], kwh[train])
    predictions["model"] = pd.Series(model.predict(x), index=b.index).clip(lower=0)
    config.MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, demand.model_path(buyer["bdg2_id"]))
    # 4. the same model with recent meter readings added (pitch evidence only, not saved)
    x_meter = x.assign(use_yesterday=kwh.shift(24), use_last_week=kwh.shift(168))
    model_meter = new_model().fit(x_meter[train], kwh[train])
    predictions["model_with_meter_data"] = pd.Series(model_meter.predict(x_meter), index=b.index).clip(lower=0)

    # Score every method on the same hours: test months, actual reading present, all methods present.
    out = pd.DataFrame({"actual": kwh, **predictions})[test].dropna()
    out["buyer"] = buyer["name"]
    return out


def scores(results: pd.DataFrame) -> dict:
    mean_use = results["actual"].mean()
    return {key: {"label": METHOD_LABELS[key],
                  "mae_kwh": round(float((results[key] - results["actual"]).abs().mean()), 1),
                  "mae_pct_of_mean_use": round(float(100 * (results[key] - results["actual"]).abs().mean() / mean_use), 1),
                  "bias_kwh": round(float((results[key] - results["actual"]).mean()), 1)}
            for key in METHOD_LABELS}


def main() -> None:
    history = pd.read_csv(config.PROCESSED_DIR / "demand_history.csv", parse_dates=["timestamp"])
    results = pd.concat([evaluate_building(buyer, history) for buyer in sites.BUYERS])

    overall = scores(results)
    per_buyer = {name: scores(group) for name, group in results.groupby("buyer", sort=False)}
    in_irma = (results.index >= IRMA_START) & (results.index < pd.Timestamp(IRMA_END) + pd.Timedelta(days=1))
    sensitivity = {"without_irma_week": scores(results[~in_irma]), "irma_week_only": scores(results[in_irma])}

    model_mae = overall["model"]["mae_kwh"]
    simple = min(BASELINES, key=lambda k: overall[k]["mae_kwh"])
    simple_mae = overall[simple]["mae_kwh"]
    beats_both = all(model_mae < overall[k]["mae_kwh"] for k in BASELINES)
    buyers_not_beating_both = [name for name, s in per_buyer.items()
                               if not all(s["model"]["mae_kwh"] < s[k]["mae_kwh"] for k in BASELINES)]
    improvement = round(100 * (1 - model_mae / simple_mae))

    if beats_both:
        sentence = f"Demand forecast: {improvement}% better than a simple guess."
    else:
        sentence = "Demand forecast: not yet better than both simple guesses."

    section = {
        "title": "Demand forecast, hourly, per buyer building",
        "sentence": sentence,
        "detail": (f"Average error {model_mae:.0f} kWh per building per hour "
                   f"({overall['model']['mae_pct_of_mean_use']:.0f}% of average use), vs {simple_mae:.0f} for the "
                   f"simple guess ({METHOD_LABELS[simple].lower()}). Tested on Jul-Dec 2017, months the model never "
                   f"saw, on 3 real Florida buildings used as stand-ins. Uses measured temperatures; a real "
                   f"temperature forecast would add some error."),
        "improvement_pct": improvement,
        "beats_both_baselines": beats_both,
        "buyers_not_beating_both": buyers_not_beating_both,
        "simple_guess": simple,
        "methods": overall,
        "per_buyer": per_buyer,
        "sensitivity_hurricane_irma": {"window": f"{IRMA_START} to {IRMA_END}", **sensitivity},
        "features": demand.FEATURES,
        "train_period": f"{TRAIN_START} to {TRAIN_END}",
        "test_period": f"{TEST_START} to {TEST_END}",
        "test_buyer_hours": int(len(results)),
        "truth": "Measured hourly electricity use, Building Data Genome 2 (Orlando, Florida)",
    }
    save_accuracy_section("demand", section)

    # --- Print a readable summary ----------------------------------------------------------
    print(f"TEST {TEST_START} to {TEST_END}: {len(results):,} buyer-hours")

    def table(s: dict, title: str) -> None:
        print(f"\n{title}\n  {'method':44s} {'MAE kWh':>8s} {'% of use':>9s} {'bias':>7s}")
        for key, m in s.items():
            flag = "  <- simple guess" if key == simple and title.startswith("ALL") else ""
            print(f"  {m['label']:44s} {m['mae_kwh']:8.1f} {m['mae_pct_of_mean_use']:8.1f}% {m['bias_kwh']:+7.1f}{flag}")

    table(overall, "ALL BUYERS")
    for name, s in per_buyer.items():
        table(s, name)
    table(sensitivity["without_irma_week"], f"ALL BUYERS, excluding Irma week {IRMA_START} to {IRMA_END}")
    table(sensitivity["irma_week_only"], "Irma week only")
    print(f"\n{sentence}\n{section['detail']}")
    if not beats_both:
        print("\n*** STOP: the live model does NOT beat both baselines overall. Review before going further. ***")
    if buyers_not_beating_both:
        print(f"\n*** NOTE: model does not beat both baselines for: {', '.join(buyers_not_beating_both)} ***")


if __name__ == "__main__":
    main()
