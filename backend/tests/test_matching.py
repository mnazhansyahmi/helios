"""
Checks for the matching rule, on small made-up numbers you can verify by hand.

Run from the HELIOS folder:  python -m pytest backend/tests
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import config, matching  # noqa: E402

HOURS = pd.RangeIndex(3, name="hour")


def run(supply_rows, demand_rows, allowed_rows):
    supply = pd.DataFrame(supply_rows, index=HOURS, columns=["R1", "R2"])
    demand = pd.DataFrame(demand_rows, index=HOURS, columns=["B1", "B2"])
    allowed = pd.DataFrame(allowed_rows, index=["R1", "R2"], columns=["B1", "B2"])
    return supply, demand, matching.match(supply, demand, allowed)


ALL_ALLOWED = [[1, 1], [1, 1]]


def test_energy_always_adds_up():
    supply, demand, r = run([[0, 0], [30, 20], [200, 100]], [[50, 50], [60, 40], [80, 20]], ALL_ALLOWED)
    # every buyer's need = solar used + grid top-up
    assert (r["solar_used"] + r["grid_topup"] - demand).abs().max().max() < 1e-9
    # all solar = solar used + unused surplus
    assert (r["solar_used"].sum(axis=1) + r["surplus"] - supply.sum(axis=1)).abs().max() < 1e-9
    assert (r["solar_used"] >= 0).all().all() and (r["grid_topup"] >= 0).all().all() and (r["surplus"] >= 0).all()


def test_no_sun_means_all_from_grid():
    _, demand, r = run([[0, 0]] * 3, [[50, 50]] * 3, ALL_ALLOWED)
    assert (r["grid_topup"] == demand).all().all() and (r["surplus"] == 0).all()


def test_short_supply_is_shared_fairly():
    # 50 kWh of solar, buyers need 60 and 40 -> both get half their need covered
    _, _, r = run([[30, 20]] * 3, [[60, 40]] * 3, ALL_ALLOWED)
    assert r["solar_used"].iloc[0].tolist() == pytest.approx([30, 20])


def test_too_much_sun_leaves_surplus_and_no_grid():
    _, _, r = run([[200, 100]] * 3, [[80, 20]] * 3, ALL_ALLOWED)
    assert (r["grid_topup"] == 0).all().all()
    assert r["surplus"].iloc[0] == pytest.approx(200)


def test_rooftop_too_far_away_supplies_nothing():
    # R2 may only supply B2; B1 can only get solar from R1
    _, _, r = run([[0, 100]] * 3, [[50, 50]] * 3, [[1, 1], [0, 1]])
    assert r["solar_used"]["B1"].iloc[0] == 0
    assert r["solar_used"]["B2"].iloc[0] == pytest.approx(50)


def test_carbon_uses_the_energy_commission_factor():
    assert matching.co2_avoided_kg(1000) == pytest.approx(1000 * config.GRID_EMISSION_FACTOR_KG_PER_KWH)


def test_all_example_sites_are_within_5_km():
    assert matching.eligibility().to_numpy().all()
