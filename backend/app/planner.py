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


def local_today() -> dt.date:
    return pd.Timestamp.now(tz=config.TIMEZONE).date()


def next_working_day(today: dt.date | None = None) -> dt.date:
    """
    The day the dashboard plans by default: the next day that is not a Saturday, Sunday
    or Selangor public holiday (Elmina is in Selangor). On a Friday that is Monday.
    """
    today = today or local_today()
    holidays = demand.malaysia_holidays([today.year, today.year + 1])
    day = today + dt.timedelta(days=1)
    while day.weekday() >= 5 or day in holidays:
        day += dt.timedelta(days=1)
    return day


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


def _months(period: str) -> str:
    """'2026-04-01 to 2026-09-30' -> 'Apr-Sep 2026'"""
    start, end = (dt.date.fromisoformat(p.strip()) for p in period.split(" to "))
    return f"{start:%b}–{end:%b %Y}"


def solar_accuracy_for_lead(s: dict, lead_days: int) -> tuple[str, str]:
    """
    Solar accuracy sentence + small print for a forecast made `lead_days` ahead.
    Accuracy falls with lead time (see backend/ml/04_eval_solar_lead_time.py), so a
    Monday plan made on Friday must not borrow the 1-day-ahead score.
    """
    honesty = (f" Held-out {_months(s['test_period'])} vs satellite estimates, not rooftop meters."
               + (" Method chosen after testing." if s["ai_decision"].get("chosen_after_test") else ""))
    leads = s.get("by_lead_days", {}).get("leads", {})
    if lead_days <= 1 or not leads:
        live, simple = s["methods"][s["live_method"]], s["methods"][s["simple_guess"]]
        return s["sentence"], (f"Avg error {live['mae_hourly_kwh_per_kwp']:.3f} vs "
                               f"{simple['mae_hourly_kwh_per_kwp']:.3f} kWh/kWp per daylight hour, "
                               f"1 day ahead.{honesty}")
    scored = leads[str(min(lead_days, max(int(k) for k in leads)))]  # scored up to 5 days ahead
    pct = scored["improvement_pct"]
    sentence = (f"Solar forecast, {lead_days} days ahead: {pct}% better than a simple guess."
                if pct > 0 else f"Solar forecast, {lead_days} days ahead: no better than a simple guess.")
    small = (f"Avg error {scored['mae_hourly_kwh_per_kwp']:.3f} vs {s['by_lead_days']['simple_guess_mae']:.3f} "
             f"kWh/kWp per daylight hour; accuracy falls with lead time "
             f"(1 day ahead: {leads['1']['improvement_pct']}% better).{honesty}")
    return sentence, small


def accuracy_for_dashboard(accuracy: dict, lead_days: int) -> dict:
    """The accuracy sentence and short MAE line shown for each forecast on the dashboard."""
    out = {}
    if "solar" in accuracy:
        sentence, small = solar_accuracy_for_lead(accuracy["solar"], lead_days)
        out["solar"] = {"sentence": sentence, "small_print": small, "detail": accuracy["solar"]["detail"]}
    if "demand" in accuracy:
        d = accuracy["demand"]
        model, simple = d["methods"]["model"], d["methods"][d["simple_guess"]]
        out["demand"] = {"sentence": d["sentence"], "detail": d["detail"],
                         "small_print": (f"Average error {model['mae_kwh']:.0f} vs {simple['mae_kwh']:.0f} kWh per "
                                         f"building per hour. Held-out {_months(d['test_period'])}, Florida stand-in "
                                         f"buildings, measured temperatures.")}
    return out


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
    today = local_today()
    lead_days = (data_day - today).days   # how far ahead the forecast is (<= 0 for an old saved forecast)
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
                 # 24 hourly values for ONE roof of this type (Solar tab curves, 3D township glow)
                 "hourly_kwh_one_roof": [round(float(v), 3) for v in base["one_roof"][r["id"]]],
                 "kwh_all_roofs": round(float(supply[r["id"]].sum()), 1)} for r in sites.ROOFTOPS]

    return {
        "day": info["day"],
        "lead_days": lead_days,
        "is_next_working_day": data_day == next_working_day(today),
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
        "accuracy": accuracy_for_dashboard(reports.load_accuracy(), lead_days),
        "carbon_factor": {"kg_per_kwh": config.GRID_EMISSION_FACTOR_KG_PER_KWH,
                          "source": config.GRID_EMISSION_FACTOR_SOURCE, "tag": "REAL"},
        "match_distance_km": config.MAX_MATCH_DISTANCE_KM,   # the map draws this as its ring
        "rule": (f"Each hour, rooftop solar is shared among buyers within {config.MAX_MATCH_DISTANCE_KM:g} km "
                 "in proportion to need; any shortfall is grid top-up. An accounting split for planning."),
        "footnote": ("REAL = public measured or forecast data. EXAMPLE = made up for this demo. "
                     "STAND-IN = real data from elsewhere (Florida buildings) standing in for Elmina buildings."),
        # Short forms for the dashboard footnote; full citations are in README.md and config.py.
        "sources": [
            "Weather: Open-Meteo, ECMWF model (free non-commercial tier)",
            "Buildings: Building Data Genome 2 (CC BY-SA), Orlando",
            "Grid emission factor: Energy Commission Malaysia, Peninsular 2024 (provisional)",
            "pvlib",
            "Map © OpenStreetMap contributors",
        ],
    }
