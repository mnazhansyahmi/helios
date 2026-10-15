"""
Demand model: hour, weekday, holiday and weather -> hourly electricity use (kWh)
of one buyer building.

One small ML model per buyer (gradient-boosted trees, scikit-learn), trained on a
REAL building in Orlando, Florida (Building Data Genome 2) that stands in for an
Elmina building. See app/sites.py for which building is which.

What the model sees, and what it deliberately does NOT see:
  - sees: hour of day, day of week, public holiday, air temperature, dew point
  - not:  recent meter readings (Elmina buyers have no live meter feed in this
          prototype), and not the month (in the training data, month mostly means the
          US university calendar, which means nothing in Elmina).
Training (backend/ml/03_train_demand.py) and the live forecast both use features()
below, so the model is scored exactly as it runs in the demo.
"""
from functools import lru_cache

import holidays
import joblib
import pandas as pd

from . import config

FEATURES = ["hour", "day_of_week", "is_holiday", "temp_air", "dew_point"]


def model_path(bdg2_id: str):
    return config.MODELS_DIR / f"demand_{bdg2_id}.joblib"


def features(index: pd.DatetimeIndex, temp_air, dew_point, holiday_calendar) -> pd.DataFrame:
    """
    Model inputs for each hour in `index`.
    holiday_calendar: a `holidays` calendar, e.g. Malaysia (Selangor) for live use,
    or the US (Florida) for the training buildings.
    """
    return pd.DataFrame({
        "hour": index.hour,
        "day_of_week": index.dayofweek,  # 0 = Monday ... 6 = Sunday
        "is_holiday": [int(d in holiday_calendar) for d in index.date],
        "temp_air": pd.Series(temp_air, index=index).values,
        "dew_point": pd.Series(dew_point, index=index).values,
    }, index=index)[FEATURES]


def malaysia_holidays(years) -> holidays.HolidayBase:
    """Public holidays for Selangor, where Elmina is."""
    return holidays.country_holidays("MY", subdiv="SGR", years=years)


@lru_cache(maxsize=None)
def _load(bdg2_id: str):
    return joblib.load(model_path(bdg2_id))


def predict_kwh(buyer: dict, weather: pd.DataFrame) -> pd.Series:
    """
    Expected electricity use (kWh) of one buyer for each hour in `weather`
    (needs columns temp_air and dew_point, indexed by local hour start).
    """
    calendar = malaysia_holidays(sorted(set(weather.index.year)))
    x = features(weather.index, weather["temp_air"], weather["dew_point"], calendar)
    predicted = _load(buyer["bdg2_id"]).predict(x)
    return pd.Series(predicted, index=weather.index, name="kwh").clip(lower=0)
