"""
"Day type" what-ifs for the dashboard: instead of the next-day forecast, run the REAL measured sunlight
of one past day through the same pvlib solar model (buyer demand stays the normal forecast).

The three days come from data/processed/solar_history.csv (Himawari sunlight, ERA5 temperature and
wind), Oct 2025 - Sep 2026, complete days only, ranked by total daily sunlight:
  sunny = the 90th-percentile day, average = the median day, cloudy = the 10th-percentile day.
backend/ml/06_whatif_days.py picks them once into data/whatif_days.json (committed, works offline).
"""
import json

import pandas as pd

from . import config

WHATIF_PATH = config.DATA_DIR / "whatif_days.json"
PERIOD = ("2025-10-01", "2026-09-30")
PERCENTILES = {"sunny": 0.9, "average": 0.5, "cloudy": 0.1}
COLUMNS = {"actual_ghi": "ghi", "actual_temp_air": "temp_air", "actual_wind_speed": "wind_speed"}
LABELS = {"forecast": "Forecast", "sunny": "Sunny", "average": "Average", "cloudy": "Cloudy"}


def pick_days(history: pd.DataFrame) -> dict:
    """
    history: hourly table indexed by local hour start, with actual_ghi, actual_temp_air, actual_wind_speed.
    Returns {"sunny"|"average"|"cloudy": {"date", "ghi_wh_m2", "hours": {ghi, temp_air, wind_speed}}}.
    A day counts only if it has all 24 hours with no missing value. The p-th percentile day is the
    day at rank round(p * (n - 1)) when the n complete days are sorted by total sunlight (a real day,
    never an average of days).
    """
    local = history.index.tz_localize(None)
    inside = (local >= pd.Timestamp(PERIOD[0])) & (local < pd.Timestamp(PERIOD[1]) + pd.Timedelta(days=1))
    table = history.loc[inside, list(COLUMNS)]
    days = table.groupby(table.index.tz_localize(None).normalize())
    complete = [d for d, rows in days if len(rows) == 24 and not rows.isna().any().any()]
    totals = pd.Series({d: days.get_group(d)["actual_ghi"].sum() for d in complete}).sort_values(kind="stable")
    picked = {}
    for name, p in PERCENTILES.items():
        date = totals.index[round(p * (len(totals) - 1))]
        rows = days.get_group(date).rename(columns=COLUMNS)
        picked[name] = {
            "date": date.date().isoformat(),
            "ghi_wh_m2": round(float(totals[date]), 1),
            "hours": {col: [round(float(v), 2) for v in rows[col]] for col in COLUMNS.values()},
        }
    return {"period": list(PERIOD), "complete_days": len(totals), "days": picked}


def load_days() -> dict:
    return json.loads(WHATIF_PATH.read_text())


def sunlight_for(day_type: str, index: pd.DatetimeIndex) -> tuple[pd.DataFrame, dict]:
    """The picked day's 24 hours of measured weather, laid onto the planned day's hours (index)."""
    entry = load_days()["days"][day_type]
    table = pd.DataFrame(entry["hours"], index=index)
    return table, {"id": day_type, "label": LABELS[day_type], "date": entry["date"]}
