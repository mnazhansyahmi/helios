"""
Weather data from Open-Meteo (https://open-meteo.com).
Free, no API key. NOTE: the free tier is for non-commercial use (fine for a hackathon;
a real SDP deployment would need Open-Meteo's paid plan or another provider).

Time convention - read this once, it matters:
    Open-Meteo labels each hourly sunlight value with the END of the hour it averages
    (13:00 means "average over 12:00-13:00"). Helios labels every hour by its START
    (12:00 means "12:00-13:00"), because that is how people read an hourly chart.
    hourly_frame() does that shift, in this one place, for live AND historical data.
"""
import datetime as dt
import json

import pandas as pd
import requests

from . import config


def fetch_open_meteo(url: str, params: dict) -> dict:
    """Call an Open-Meteo endpoint and return the JSON. Raises an error if it fails."""
    response = requests.get(url, params=params, timeout=60)
    payload = response.json()
    if response.status_code != 200 or payload.get("error"):
        raise RuntimeError(f"Open-Meteo error from {url}: {payload.get('reason', response.text[:200])}")
    return payload


def hourly_frame(payload: dict, rename: dict) -> pd.DataFrame:
    """
    Turn Open-Meteo's "hourly" block into a table indexed by local time (hour START).

    rename maps Open-Meteo variable names to our column names,
    e.g. {"shortwave_radiation": "ghi"}.
    """
    df = pd.DataFrame(payload["hourly"])
    times = pd.to_datetime(df.pop("time"))
    if times.dt.tz is None:  # we always request local time, so localise it
        times = times.dt.tz_localize(config.TIMEZONE)
    df.index = times - pd.Timedelta(hours=1)  # hour END -> hour START (see top of file)
    df.index.name = "time"
    return df.rename(columns=rename)[list(rename.values())]


# Variables we need for tomorrow's plan, and what we call them inside Helios.
FORECAST_VARIABLES = {
    "shortwave_radiation": "ghi",      # sunlight on flat ground, W/m2 (Global Horizontal Irradiance)
    "temperature_2m": "temp_air",      # air temperature, degC
    "dew_point_2m": "dew_point",       # humidity measure, degC (used by the demand model)
    "wind_speed_10m": "wind_speed",    # m/s (cools the panels)
    "cloud_cover": "cloud_cover",      # %
}


def _cache_path(day: dt.date):
    return config.CACHE_DIR / f"forecast_{day.isoformat()}.json"


def get_forecast_for_day(day: dt.date) -> tuple[pd.DataFrame, dict]:
    """
    Hourly weather forecast for one day in Elmina (24 rows, 00:00 to 23:00).

    Returns (table, info). info["source"] is "live" when freshly downloaded, or
    "cached" when the internet failed and we fell back to the newest saved forecast.
    In the cached case the day may differ from the one requested - info["day"] says
    which day the data is for, and the dashboard shows a banner.
    """
    params = {
        "latitude": config.ELMINA_LAT,
        "longitude": config.ELMINA_LON,
        "hourly": ",".join(FORECAST_VARIABLES),
        "models": config.WEATHER_MODEL,
        "timezone": config.TIMEZONE,
        "wind_speed_unit": "ms",  # Open-Meteo defaults to km/h; pvlib expects m/s
        "start_date": day.isoformat(),
        # one extra day, because the last hour of `day` is labelled 00:00 next day by Open-Meteo
        "end_date": (day + dt.timedelta(days=1)).isoformat(),
    }
    try:
        payload = fetch_open_meteo(config.OPEN_METEO_FORECAST_URL, params)
        payload["helios_fetched_at"] = dt.datetime.now().isoformat(timespec="minutes")
        payload["helios_day"] = day.isoformat()
        config.CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _cache_path(day).write_text(json.dumps(payload))
        source = "live"
    except (requests.RequestException, RuntimeError, ValueError):
        payload = _newest_saved_forecast()
        if payload is None:
            raise RuntimeError("No internet and no saved forecast. Run once while online.")
        source = "cached"

    data_day = dt.date.fromisoformat(payload["helios_day"])
    table = hourly_frame(payload, FORECAST_VARIABLES)
    table = table[table.index.date == data_day]
    info = {"source": source, "day": data_day.isoformat(), "fetched_at": payload["helios_fetched_at"],
            "weather_model": config.WEATHER_MODEL}
    return table, info


def _newest_saved_forecast() -> dict | None:
    """Newest forecast saved on this laptop, else the demo snapshot shipped in git."""
    for folder in (config.CACHE_DIR, config.DEMO_SNAPSHOT_DIR):
        files = sorted(folder.glob("forecast_*.json")) if folder.exists() else []
        if files:
            return json.loads(files[-1].read_text())
    return None
