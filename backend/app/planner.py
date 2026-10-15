"""
Builds one day's plan for the dashboard: solar per rooftop, demand per buyer,
the hourly matching, CO2 avoided, the demo preset and a plain-English headline.

Speed: the slow part (weather download, pvlib, ML models) runs once per day and is
kept in memory for 30 minutes, so moving the fleet-size slider only re-runs the
fast matching step.
"""
import datetime as dt
import time

import pandas as pd

from . import config, demand, matching, reports, sites, solar, weather

_BASE_CACHE: dict = {}          # day -> (time created, base data)
BASE_CACHE_SECONDS = 30 * 60


def tomorrow() -> dt.date:
    return (pd.Timestamp.now(tz=config.TIMEZONE) + pd.Timedelta(days=1)).date()


def day_base(day: dt.date) -> dict:
    """Weather, solar for ONE roof of each example type, and buyer demand, for one day."""
    cached = _BASE_CACHE.get(day)
    if cached and time.time() - cached[0] < BASE_CACHE_SECONDS:
        return cached[1]
    forecast, info = weather.get_forecast_for_day(day)
    # corrected_ghi() is the raw forecast unless a solar correction model was saved (see 02_eval_solar.py)
    sunlight = forecast.assign(ghi=solar.corrected_ghi(forecast))
    one_roof = pd.DataFrame({r["id"]: solar.rooftop_kwh(sunlight, r["kwp"], r["tilt"], r["azimuth"])
                             for r in sites.ROOFTOPS})
    need = pd.DataFrame({b["id"]: demand.predict_kwh(b, forecast) for b in sites.BUYERS})
    base = {"info": info, "one_roof": one_roof.fillna(0), "demand": need}
    _BASE_CACHE[day] = (time.time(), base)
    return base


def noon_match_rooftops(one_roof: pd.DataFrame, need: pd.DataFrame) -> int | None:
    """
    The demo preset: how many rooftops make solar equal buyer demand in the 12:00-13:00 hour.
    None if the forecast has (almost) no noon sun.
    """
    at_noon = one_roof.index.hour == config.PRESET_HOUR
    solar_per_rooftop = float(one_roof[at_noon].sum(axis=1).iloc[0]) / len(sites.ROOFTOPS)
    noon_demand = float(need[at_noon].sum(axis=1).iloc[0])
    if solar_per_rooftop < 0.01:
        return None
    return int(min(max(round(noon_demand / solar_per_rooftop), config.FLEET_MIN), config.FLEET_MAX))


def _energy(kwh: float) -> str:
    return f"{kwh / 1000:,.1f} MWh" if kwh >= 1000 else f"{kwh:,.0f} kWh"


def _mass(kg: float) -> str:
    return f"{kg / 1000:,.1f} tonnes" if kg >= 1000 else f"{kg:,.0f} kg"


def build_plan(day: dt.date, rooftop_count: int) -> dict:
    base = day_base(day)
    info, need = base["info"], base["demand"]
    roofs_per_type = rooftop_count / len(sites.ROOFTOPS)   # each example rooftop stands for this many roofs
    supply = base["one_roof"] * roofs_per_type
    result = matching.match(supply, need, matching.eligibility())
    used, topup, surplus = result["solar_used"], result["grid_topup"], result["surplus"]

    total_demand, total_used = float(need.to_numpy().sum()), float(used.to_numpy().sum())
    total_topup, total_solar = float(topup.to_numpy().sum()), float(supply.to_numpy().sum())
    coverage = 100 * total_used / total_demand if total_demand else 0.0
    co2 = matching.co2_avoided_kg(total_used)

    # Markers for the 24h chart, so the afternoon gap stands out: solar peaks around noon,
    # but buyer demand peaks later in the afternoon (12:00-18:00 window, daylight only).
    solar_by_hour, demand_by_hour = supply.sum(axis=1), need.sum(axis=1)
    afternoon = (need.index.hour >= config.PRESET_HOUR) & (need.index.hour <= 18)
    demand_peak = demand_by_hour[afternoon].idxmax()
    solar_peak = solar_by_hour.idxmax() if total_solar > 0 else None
    peaks = {
        "solar_hour": int(solar_peak.hour) if solar_peak is not None else None,
        "solar_kwh": round(float(solar_by_hour.max()), 1),
        "afternoon_demand_hour": int(demand_peak.hour),
        "afternoon_demand_kwh": round(float(demand_by_hour[demand_peak]), 1),
        "grid_topup_at_afternoon_demand_peak_kwh": round(float(topup.loc[demand_peak].sum()), 1),
    }

    data_day = dt.date.fromisoformat(info["day"])
    day_name = f"{data_day:%a} {data_day.day} {data_day:%b}"
    if rooftop_count == 0:
        headline = f"{day_name}: with no rooftops in the scenario, all {_energy(total_demand)} comes from the grid."
    else:
        headline = (f"{day_name}: {rooftop_count:,} rooftops' solar covers {coverage:.0f}% of buyer demand. "
                    f"{_energy(total_topup)} comes from the grid. About {_mass(co2)} CO₂ avoided.")

    hours = []
    for t in need.index:
        hours.append({
            "hour": int(t.hour), "label": f"{t.hour:02d}:00",
            "solar_kwh": round(float(supply.loc[t].sum()), 1),
            "demand_kwh": round(float(need.loc[t].sum()), 1),
            "solar_used_kwh": round(float(used.loc[t].sum()), 1),
            "grid_topup_kwh": round(float(topup.loc[t].sum()), 1),
            "surplus_kwh": round(float(surplus.loc[t]), 1),
            "buyers": {b: {"demand_kwh": round(float(need.loc[t, b]), 1),
                           "solar_used_kwh": round(float(used.loc[t, b]), 1),
                           "grid_topup_kwh": round(float(topup.loc[t, b]), 1)} for b in need.columns},
            "rooftops_kwh": {r: round(float(supply.loc[t, r]), 1) for r in supply.columns},
        })

    buyers = []
    for b in sites.BUYERS:
        d, u = float(need[b["id"]].sum()), float(used[b["id"]].sum())
        buyers.append({**b, "tag": "STAND-IN",
                       "demand_kwh": round(d), "solar_used_kwh": round(u), "grid_topup_kwh": round(d - u),
                       "coverage_pct": round(100 * u / d if d else 0, 1),
                       "peak_hour": int(need[b["id"]].idxmax().hour)})

    rooftops = [{**r, "tag": "EXAMPLE", "roofs_represented": round(roofs_per_type, 2),
                 "kwh_one_roof": round(float(base["one_roof"][r["id"]].sum()), 1),
                 "kwh_all_roofs": round(float(supply[r["id"]].sum()), 1)} for r in sites.ROOFTOPS]

    accuracy = reports.load_accuracy()
    return {
        "day": info["day"],
        "headline": headline,
        "weather": {**info, "tag": "REAL",
                    "banner": None if info["source"] == "live" else
                    f"Offline: showing the forecast saved on {info['fetched_at'].replace('T', ' ')}"},
        "scenario": {"rooftops": rooftop_count, "min": config.FLEET_MIN, "max": config.FLEET_MAX,
                     "default": config.FLEET_DEFAULT, "tag": "EXAMPLE",
                     "preset_noon_match": noon_match_rooftops(base["one_roof"], need),
                     "preset_hour": config.PRESET_HOUR,
                     "label": "Scenario: how many rooftops like these join. Not a CREAM figure."},
        "totals": {"demand_kwh": round(total_demand), "solar_kwh": round(total_solar),
                   "solar_used_kwh": round(total_used), "grid_topup_kwh": round(total_topup),
                   "surplus_kwh": round(float(surplus.sum())), "coverage_pct": round(coverage, 1),
                   "co2_avoided_kg": round(co2)},
        "peaks": peaks,
        "hours": hours,
        "buyers": buyers,
        "rooftops": rooftops,
        "accuracy": {k: {"sentence": v["sentence"], "detail": v["detail"]} for k, v in accuracy.items()},
        "carbon_factor": {"kg_per_kwh": config.GRID_EMISSION_FACTOR_KG_PER_KWH,
                          "source": config.GRID_EMISSION_FACTOR_SOURCE, "tag": "REAL"},
        "rule": ("Each hour, every rooftop's solar is shared among buyers within "
                 f"{config.MAX_MATCH_DISTANCE_KM:g} km in proportion to their need. "
                 "Shortfall = grid top-up. An accounting split for planning; TNB runs the grid."),
        "footnote": ("REAL = public measured or forecast data. EXAMPLE = made up for this demo. "
                     "STAND-IN = real data from elsewhere (Florida buildings) standing in for Elmina buildings."),
        "sources": [
            f"Weather: Open-Meteo, {config.WEATHER_MODEL} model (free non-commercial tier)",
            "Building electricity use: Building Data Genome 2 (CC BY-SA), Orlando, Florida",
            f"Grid emission factor: {config.GRID_EMISSION_FACTOR_SOURCE}",
            "Solar physics: pvlib-python. Map: (c) OpenStreetMap contributors",
        ],
    }
