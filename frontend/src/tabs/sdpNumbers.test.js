// Run with: npm test   (Node's built-in test runner; no extra packages)
import assert from "node:assert/strict";
import { test } from "node:test";
import { TABS, tabForKey } from "../components/tabs.js";
import { allocationShares, growthCounts, percentages, roofKind, roofYields, storage } from "./sdpNumbers.js";

// A tiny plan: sun from 08:00 to 17:59, two roof types, two buyers.
const sunny = (kwh) => Array.from({ length: 24 }, (_, h) => (h >= 8 && h <= 17 ? kwh : 0));
const plan = ({ surplus = 0 } = {}) => ({
  rooftops: [
    { id: "R1", kwp: 5, tilt: 10, azimuth: 180, hourly_kwh_one_roof: sunny(1.8) },   // 3.6 kWh/kWp
    { id: "R2", kwp: 8, tilt: 15, azimuth: 270, hourly_kwh_one_roof: sunny(2.4) },   // 3.0 kWh/kWp
  ],
  buyers: [{ id: "A" }, { id: "B" }],
  hours: Array.from({ length: 24 }, (_, h) => ({
    demand_kwh: 30,
    buyers: { A: { demand_kwh: h < 12 ? 20 : 10 }, B: { demand_kwh: h < 12 ? 10 : 20 } },
  })),
  totals: { surplus_kwh: surplus },
});

test("For SDP is tab 2 and keys 1-5 open the tabs in order", () => {
  assert.deepEqual(TABS.map((t) => t.label), ["Overview", "For SDP", "Solar", "Demand", "About the data"]);
  assert.deepEqual(["1", "2", "3", "4", "5"].map(tabForKey), ["overview", "sdp", "solar", "demand", "about"]);
  assert.equal(tabForKey("6"), null);
  assert.equal(tabForKey("0"), null);
  assert.equal(tabForKey("a"), null);
});

test("roof yields are kWh per kWp, best and worst", () => {
  const { best, worst, gapPct } = roofYields(plan());
  assert.equal(best.id, "R1");
  assert.equal(worst.id, "R2");
  assert.ok(Math.abs(best.kwhPerKwp - 3.6) < 1e-9 && Math.abs(worst.kwhPerKwp - 3.0) < 1e-9);
  assert.ok(Math.abs(gapPct - 100 / 6) < 1e-9);
  assert.equal(roofKind(best), "south-facing, 10° tilt");
});

test("allocation % is each buyer's share of sunlit-hour demand and adds to 100", () => {
  // 08-11: A 20, B 10 (4 h); 12-17: A 10, B 20 (6 h) -> A 140, B 160
  assert.deepEqual(allocationShares(plan()), [47, 53]);
  assert.equal(percentages([1, 1, 1]).reduce((a, b) => a + b), 100);
  const dark = { ...plan(), rooftops: plan().rooftops.map((r) => ({ ...r, hourly_kwh_one_roof: Array(24).fill(0) })) };
  assert.deepEqual(allocationShares(dark), [null, null]);
});

test("storable kWh is surplus capped by demand after the last sunlit hour", () => {
  // evening = 18:00-midnight = 6 h x 30 kWh = 180
  assert.deepEqual(storage(plan({ surplus: 0 })), { storable: 0, evening: 180, fromHour: 18, aboutZero: true });
  assert.equal(storage(plan({ surplus: 1 })).aboutZero, true);    // under 1% of the evening
  assert.equal(storage(plan({ surplus: 50 })).storable, 50);
  assert.equal(storage(plan({ surplus: 500 })).storable, 180);
  assert.equal(storage(plan({ surplus: 500 })).aboutZero, false);
});

test("growth counts sit inside the slider range around the noon match", () => {
  assert.deepEqual(growthCounts({ min: 0, max: 1000, preset_noon_match: 337 }), [170, 337, 670]);
  assert.deepEqual(growthCounts({ min: 0, max: 1000, preset_noon_match: 800 }), [400, 800, 1000]);
  assert.deepEqual(growthCounts({ min: 0, max: 1000, preset_noon_match: null }), [250, 500, 1000]);
});
