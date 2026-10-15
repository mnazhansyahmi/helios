"""
Matching: share rooftop solar between buyers, hour by hour.

The rule, in one sentence:
    Each hour, every rooftop's solar is shared among the buyers within 5 km,
    in proportion to how much each buyer needs. Whatever a buyer still needs is
    the GRID TOP-UP; solar nobody needs is UNUSED SURPLUS.

Why this rule: it is fair (when solar is short, every buyer gets the same share
of its need covered) and it fits in one sentence. Because every example site is
within 5 km of every other, this gives exactly the same totals as pooling all the
solar together.

This is an ACCOUNTING split for planning. The electricity itself flows through
TNB's grid; Helios does not control or balance the grid.
"""
import numpy as np
import pandas as pd

from . import config, sites


def eligibility() -> pd.DataFrame:
    """1 where a rooftop may supply a buyer (within the distance limit), else 0. Rows = rooftops."""
    return pd.DataFrame(
        [[int(sites.distance_km(r["lat"], r["lon"], b["lat"], b["lon"]) <= config.MAX_MATCH_DISTANCE_KM)
          for b in sites.BUYERS] for r in sites.ROOFTOPS],
        index=[r["id"] for r in sites.ROOFTOPS], columns=[b["id"] for b in sites.BUYERS])


def match(supply: pd.DataFrame, demand: pd.DataFrame, allowed: pd.DataFrame) -> dict:
    """
    supply:  kWh per hour (rows) per rooftop (columns)
    demand:  kWh per hour (rows) per buyer (columns)
    allowed: 1/0 per rooftop (rows) x buyer (columns), see eligibility()

    Returns tables (hours x buyers) of solar used and grid top-up, plus the
    unused surplus per hour.
    """
    s = supply.to_numpy(float)                       # hours x rooftops
    d = demand.to_numpy(float)                       # hours x buyers
    a = allowed.loc[supply.columns, demand.columns].to_numpy(float)  # rooftops x buyers

    # Each rooftop's share for each buyer = that buyer's need / total need of the buyers it may supply.
    need = a[None, :, :] * d[:, None, :]             # hours x rooftops x buyers
    total_need = need.sum(axis=2, keepdims=True)
    share = np.divide(need, total_need, out=np.zeros_like(need), where=total_need > 0)

    offered = np.einsum("hr,hrb->hb", s, share)       # solar sent towards each buyer
    used = np.minimum(offered, d)                    # a buyer can't use more than it needs
    as_table = lambda x: pd.DataFrame(x, index=demand.index, columns=demand.columns)  # noqa: E731
    return {
        "solar_used": as_table(used),
        "grid_topup": as_table(d - used),
        # clip: tiny negative rounding leftovers (e.g. -0.0000001) would show as "-0"
        "surplus": pd.Series(s.sum(axis=1) - used.sum(axis=1), index=demand.index).clip(lower=0),
    }


def co2_avoided_kg(solar_used_kwh: float) -> float:
    """Grid electricity NOT needed because solar covered it x the grid emission factor."""
    return solar_used_kwh * config.GRID_EMISSION_FACTOR_KG_PER_KWH
