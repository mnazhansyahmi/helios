"""
Step 1 of the ML pipeline: download the public data Helios learns from.

Run from the HELIOS folder:
    python backend/ml/01_get_data.py                 # everything
    python backend/ml/01_get_data.py --only demand   # building data only
    python backend/ml/01_get_data.py --only solar    # solar history only

Teammates do NOT need to run this to use the demo: its small outputs
(backend/data/processed/*.csv) are committed to git.

What it downloads
-----------------
1. DEMAND - Building Data Genome 2 (BDG2): real hourly electricity meter data from
   1,600+ non-residential buildings, 2016-2017, plus each site's weather.
   Licence: CC BY-SA. https://github.com/buds-lab/building-data-genome-project-2
   The raw meter file is ~175 MB; we keep only our stand-in buyer buildings
   (listed in app/sites.py) -> data/processed/demand_history.csv

2. SOLAR - Elmina, Jun 2024 to Sep 2026, from Open-Meteo:
   a) the weather forecast as it was issued about 24 hours ahead (ECMWF model)
   b) the sunlight that actually arrived, estimated from the Himawari satellite
   c) the actual air temperature and wind (ERA5), to estimate panel temperature
   -> data/processed/solar_history.csv
   Day-ahead forecasts are only archived from June 2024, hence the start date.
"""
import argparse
import datetime as dt
import sys
from pathlib import Path

import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # lets us import from backend/app
from app import config, sites  # noqa: E402
from app.weather import fetch_open_meteo, hourly_frame  # noqa: E402

# ---------------------------------------------------------------------------
# 1. DEMAND: Building Data Genome 2
# ---------------------------------------------------------------------------
BDG2_URL = "https://media.githubusercontent.com/media/buds-lab/building-data-genome-project-2/master/data"
BDG2_FILES = {
    "metadata.csv": f"{BDG2_URL}/metadata/metadata.csv",
    "weather.csv": f"{BDG2_URL}/weather/weather.csv",
    "electricity_cleaned.csv": f"{BDG2_URL}/meters/cleaned/electricity_cleaned.csv",
}
BDG2_DIR = config.RAW_DIR / "bdg2"


def download_file(url: str, target: Path) -> None:
    """Download a file once (skipped if it is already there)."""
    if target.exists():
        print(f"  already have {target.name}")
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part")  # so a broken download never looks finished
    print(f"  downloading {target.name} ...", flush=True)
    with requests.get(url, stream=True, timeout=120) as response:
        response.raise_for_status()
        with open(partial, "wb") as f:
            for chunk in response.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    partial.rename(target)
    print(f"  saved {target.name} ({target.stat().st_size / 1e6:.0f} MB)")


def get_demand_data() -> None:
    print("DEMAND: Building Data Genome 2")
    for name, url in BDG2_FILES.items():
        download_file(url, BDG2_DIR / name)

    buyers = getattr(sites, "BUYERS", [])
    if not buyers:
        print("  no buyers listed in app/sites.py yet - skipping extraction")
        return

    ids = [b["bdg2_id"] for b in buyers]
    site = ids[0].split("_")[0]  # BDG2 ids start with the site name, e.g. "Panther_office_Patti"

    # Meter readings (kWh per hour) for just our buildings. Timestamps are the site's local time.
    meters = pd.read_csv(BDG2_DIR / "electricity_cleaned.csv", usecols=["timestamp", *ids],
                         parse_dates=["timestamp"])
    meters = meters.melt(id_vars="timestamp", var_name="bdg2_id", value_name="kwh")

    # The site's weather station: air temperature and dew point (degC).
    weather = pd.read_csv(BDG2_DIR / "weather.csv", parse_dates=["timestamp"])
    weather = weather[weather["site_id"] == site][["timestamp", "airTemperature", "dewTemperature"]]
    weather = weather.rename(columns={"airTemperature": "temp_air", "dewTemperature": "dew_point"})

    history = meters.merge(weather, on="timestamp", how="left").sort_values(["bdg2_id", "timestamp"])
    out = config.PROCESSED_DIR / "demand_history.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    history.to_csv(out, index=False)
    print(f"  wrote {out.name}: {len(history):,} rows for {len(ids)} buildings")


# ---------------------------------------------------------------------------
# 2. SOLAR: forecast-as-issued vs what actually happened, Elmina
# ---------------------------------------------------------------------------
SOLAR_START = dt.date(2024, 6, 1)   # day-ahead archive starts here
SOLAR_END = dt.date(2026, 9, 30)    # last full month before we built this


def _fetch_in_chunks(url: str, params: dict, rename: dict) -> pd.DataFrame:
    """Open-Meteo prefers shorter date ranges, so fetch 6 months at a time."""
    parts, start = [], SOLAR_START
    while start <= SOLAR_END:
        end = min(start + dt.timedelta(days=182), SOLAR_END)
        # +1 day at the end: the last hour of a day is labelled 00:00 the next day (see weather.py)
        payload = fetch_open_meteo(url, {**params, "start_date": start.isoformat(),
                                         "end_date": (end + dt.timedelta(days=1)).isoformat()})
        frame = hourly_frame(payload, rename)
        parts.append(frame[(frame.index.date >= start) & (frame.index.date <= end)])
        start = end + dt.timedelta(days=1)
    return pd.concat(parts)


def get_solar_data() -> None:
    print("SOLAR: Open-Meteo history for Elmina")
    where = {"latitude": config.ELMINA_LAT, "longitude": config.ELMINA_LON,
             "timezone": config.TIMEZONE, "wind_speed_unit": "ms"}

    print("  a) day-ahead forecasts as issued (ECMWF)")
    forecast = _fetch_in_chunks(config.OPEN_METEO_PREVIOUS_RUNS_URL, {
        **where, "models": config.WEATHER_MODEL,
        "hourly": "shortwave_radiation_previous_day1,temperature_2m_previous_day1,"
                  "wind_speed_10m_previous_day1,cloud_cover_previous_day1"},
        {"shortwave_radiation_previous_day1": "fc_ghi", "temperature_2m_previous_day1": "fc_temp_air",
         "wind_speed_10m_previous_day1": "fc_wind_speed", "cloud_cover_previous_day1": "fc_cloud_cover"})

    print("  b) actual sunlight (Himawari satellite)")
    satellite = _fetch_in_chunks(config.OPEN_METEO_SATELLITE_URL, {
        **where, "models": config.SATELLITE_MODEL, "hourly": "shortwave_radiation"},
        {"shortwave_radiation": "actual_ghi"})

    print("  c) actual temperature and wind (ERA5)")
    era5 = _fetch_in_chunks(config.OPEN_METEO_ARCHIVE_URL, {
        **where, "models": "era5", "hourly": "temperature_2m,wind_speed_10m"},
        {"temperature_2m": "actual_temp_air", "wind_speed_10m": "actual_wind_speed"})

    history = forecast.join(satellite, how="outer").join(era5, how="outer")
    out = config.PROCESSED_DIR / "solar_history.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    history.to_csv(out)
    print(f"  wrote {out.name}: {len(history):,} hours, missing values per column:")
    print("   ", history.isna().sum().to_dict())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", choices=["demand", "solar"], help="download just one part")
    args = parser.parse_args()
    if args.only in (None, "demand"):
        get_demand_data()
    if args.only in (None, "solar"):
        get_solar_data()
