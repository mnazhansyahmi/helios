"""
The For SDP tab's "Season" view: the EXISTING solar model (pvlib) and demand models run over twelve
months of real PAST weather, at one fixed rooftop count, summarised per month. No new models.

backend/ml/05_season.py downloads the weather and calls build_season() once; the result is saved to
data/season.json (committed, so the dashboard works offline) and served by GET /api/season.
"""
import datetime as dt
import json

import pandas as pd

from . import config, demand, matching, sites, solar

SEASON_PATH = config.DATA_DIR / "season.json"


def season_noon_match(one_roof: pd.DataFrame, need: pd.DataFrame) -> int:
    """
    The noon match for the whole period: rooftops at which AVERAGE 12:00-13:00 solar equals average
    12:00-13:00 buyer demand (same rule as the daily preset, on the period's average day).
    """
    at_noon = one_roof.index.hour == config.PRESET_HOUR
    solar_per_rooftop = float(one_roof[at_noon].sum(axis=1).mean()) / len(sites.ROOFTOPS)
    noon_demand = float(need[at_noon].sum(axis=1).mean())
    return int(min(max(round(noon_demand / solar_per_rooftop), config.FLEET_MIN), config.FLEET_MAX))


def summarise(one_roof: pd.DataFrame, need: pd.DataFrame, rooftops: int) -> list[dict]:
    """
    Per calendar month: each buyer's share of demand in the sunlit hours (the example allocation %),
    solar coverage of buyer demand, and unused solar, at `rooftops` roofs split evenly over the types.
    one_roof: kWh per hour for ONE roof of each type; need: kWh per hour per buyer (same hourly index).
    """
    supply = one_roof * (rooftops / len(sites.ROOFTOPS))
    result = matching.match(supply, need, matching.eligibility())
    sunlit = one_roof.gt(0).any(axis=1)
    months = []
    by_month = need.index.tz_localize(None).to_period("M")   # calendar months in local (Elmina) time
    for month, hours in need.groupby(by_month).groups.items():
        lit = sunlit.loc[hours]
        daytime = need.loc[hours][lit].sum()
        total_daytime = float(daytime.sum())
        demand_kwh = float(need.loc[hours].to_numpy().sum())
        used_kwh = float(result["solar_used"].loc[hours].to_numpy().sum())
        months.append({
            "month": str(month),
            "days": int(len(hours) // 24),
            "allocation_pct": {b: round(100 * float(daytime[b]) / total_daytime, 1) if total_daytime else None
                               for b in need.columns},
            "coverage_pct": round(100 * used_kwh / demand_kwh, 1) if demand_kwh else 0.0,
            "surplus_kwh": round(float(result["surplus"].loc[hours].sum())),
            "demand_kwh": round(demand_kwh),
            "solar_kwh": round(float(supply.loc[hours].to_numpy().sum())),
        })
    return months


def build_season(weather: pd.DataFrame, sources: list[str]) -> dict:
    """
    weather: hourly PAST weather in Elmina, indexed by local hour start, with columns ghi (W/m2),
    temp_air (degC), dew_point (degC) and wind_speed (m/s). Measured sunlight, so no forecast correction.
    """
    weather = weather.dropna(subset=["ghi", "temp_air", "dew_point", "wind_speed"])
    one_roof = pd.DataFrame({r["id"]: solar.rooftop_kwh(weather, r["kwp"], r["tilt"], r["azimuth"])
                             for r in sites.ROOFTOPS}).fillna(0)
    need = pd.DataFrame({b["id"]: demand.predict_kwh(b, weather) for b in sites.BUYERS})
    rooftops = season_noon_match(one_roof, need)
    return {
        "from": weather.index[0].date().isoformat(),
        "to": weather.index[-1].date().isoformat(),
        "rooftops": rooftops,
        "rooftops_rule": "noon match on the period's average day",
        "buyers": [{"id": b["id"], "name": b["name"]} for b in sites.BUYERS],
        "months": summarise(one_roof, need, rooftops),
        "sources": sources,
        "generated_at": dt.datetime.now().isoformat(timespec="minutes"),
    }


def load_season() -> dict | None:
    return json.loads(SEASON_PATH.read_text()) if SEASON_PATH.exists() else None
