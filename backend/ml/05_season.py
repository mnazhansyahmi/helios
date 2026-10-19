"""
Step 5: the For SDP tab's "Season" view. Runs the EXISTING solar model and demand models over the
last twelve full months of real PAST weather in Elmina, at the noon-match rooftop count, and saves a
per-month summary for the dashboard (no new models).

Run from the HELIOS folder, while online:
    python backend/ml/05_season.py                    # the 12 full months before this month
    python backend/ml/05_season.py --last 2026-09     # the 12 months ending Sep 2026

Weather (Open-Meteo, same location as the live forecast):
  - sunlight that actually arrived: Himawari satellite (as in 01_get_data.py)
  - air temperature, dew point and wind: ERA5 reanalysis
-> data/season.json (commit it: the dashboard reads it offline through GET /api/season)
"""
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # lets us import from backend/app
from app import config, season  # noqa: E402
from app.weather import fetch_open_meteo, hourly_frame  # noqa: E402

WHERE = {"latitude": config.ELMINA_LAT, "longitude": config.ELMINA_LON,
         "timezone": config.TIMEZONE, "wind_speed_unit": "ms"}


def fetch(url: str, params: dict, rename: dict, start: dt.date, end: dt.date) -> pd.DataFrame:
    """Hourly history from start to end (inclusive), six months per request."""
    parts, first = [], start
    while first <= end:
        last = min(first + dt.timedelta(days=182), end)
        # +1 day: the last hour of a day is labelled 00:00 the next day (see weather.py)
        payload = fetch_open_meteo(url, {**params, "start_date": first.isoformat(),
                                         "end_date": (last + dt.timedelta(days=1)).isoformat()})
        frame = hourly_frame(payload, rename)
        parts.append(frame[(frame.index.date >= first) & (frame.index.date <= last)])
        first = last + dt.timedelta(days=1)
    return pd.concat(parts)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--last", help="last month to include, YYYY-MM (default: last month)")
    args = parser.parse_args()

    today = dt.date.today()
    last_month = pd.Period(args.last, "M") if args.last else pd.Period(today, "M") - 1
    start = (last_month - 11).start_time.date()
    end = last_month.end_time.date()
    print(f"SEASON: past weather for Elmina, {start} to {end}")

    sunlight = fetch(config.OPEN_METEO_SATELLITE_URL,
                     {**WHERE, "models": config.SATELLITE_MODEL, "hourly": "shortwave_radiation"},
                     {"shortwave_radiation": "ghi"}, start, end)
    era5 = fetch(config.OPEN_METEO_ARCHIVE_URL,
                 {**WHERE, "models": "era5", "hourly": "temperature_2m,dew_point_2m,wind_speed_10m"},
                 {"temperature_2m": "temp_air", "dew_point_2m": "dew_point", "wind_speed_10m": "wind_speed"},
                 start, end)
    weather = sunlight.join(era5, how="inner")
    missing = int(weather.isna().any(axis=1).sum())
    print(f"  {len(weather):,} hours, {missing} with a missing value (left out)")

    result = season.build_season(weather, sources=[
        "Sunlight: Open-Meteo, Himawari satellite (JMA/JAXA)",
        "Temperature, dew point, wind: Open-Meteo, ERA5 reanalysis",
    ])
    season.SEASON_PATH.write_text(json.dumps(result, indent=1))
    print(f"  {result['rooftops']} rooftops ({result['rooftops_rule']}); wrote {season.SEASON_PATH}")


if __name__ == "__main__":
    main()
