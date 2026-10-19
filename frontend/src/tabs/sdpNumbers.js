// The numbers on the For SDP tab, as plain functions of the forecast plan (no React, so `npm test` can
// check them with Node's own test runner). No new models: everything comes from fields the plan already has.

const FACING = { 0: "north", 90: "east", 180: "south", 270: "west" };

/** "south-facing, 10° tilt" for an example rooftop (azimuth in degrees from north). */
export const roofKind = (r) => `${FACING[r.azimuth] ?? `${r.azimuth}°`}-facing, ${r.tilt}° tilt`;

/** Hours in which the forecast gives any example roof some solar (fleet size does not matter). */
export function sunlitHours(plan) {
  const sunlit = plan.hours.map((_, h) => plan.rooftops.some((r) => r.hourly_kwh_one_roof[h] > 0));
  return { sunlit, first: sunlit.indexOf(true), last: sunlit.lastIndexOf(true) };
}

/** 1. kWh per kWp for one roof of each example type, best and worst (from the unrounded hourly values). */
export function roofYields(plan) {
  const yields = plan.rooftops.map((r) => ({
    ...r, kwhPerKwp: r.hourly_kwh_one_roof.reduce((a, b) => a + b, 0) / r.kwp,
  }));
  const sorted = [...yields].sort((a, b) => b.kwhPerKwp - a.kwhPerKwp);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const gapPct = best && best.kwhPerKwp > 0 ? (100 * (best.kwhPerKwp - worst.kwhPerKwp)) / best.kwhPerKwp : 0;
  return { best, worst, gapPct };
}

/** Whole-number percentages that still add up to 100 (largest remainders get the leftover points). */
export function percentages(values) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const raw = values.map((v) => (100 * v) / total);
  const out = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < 100 - out.reduce((a, b) => a + b, 0); k += 1) out[order[k][1]] += 1;
  return out;
}

/** 2. Example allocation %: each buyer's share of forecast demand during the sunlit hours (null without sun). */
export function allocationShares(plan) {
  const { sunlit, first } = sunlitHours(plan);
  if (first < 0) return plan.buyers.map(() => null);
  const daytime = plan.buyers.map((b) =>
    plan.hours.reduce((sum, row, h) => sum + (sunlit[h] ? row.buyers[b.id].demand_kwh : 0), 0));
  return percentages(daytime);
}

/**
 * 3. Storable kWh at the plan's roof count: the day's unused solar, capped by buyer demand after the last
 * sunlit hour (storage cannot move more than the evening can use; losses not modelled). Counts as "about 0"
 * when it is under 1% of that evening demand.
 */
export function storage(plan) {
  const { first, last } = sunlitHours(plan);
  const evening = first < 0 ? 0 : plan.hours.slice(last + 1).reduce((sum, row) => sum + row.demand_kwh, 0);
  const storable = Math.min(plan.totals.surplus_kwh, evening);
  return { storable, evening, fromHour: first < 0 ? null : last + 1, aboutZero: storable < 0.01 * evening };
}

/** 1. Card 1's benefit line: when the example roofs are under 10% apart, say direction hardly matters. */
export function roofBenefit(gapPct) {
  const apart = Math.round(gapPct);
  return gapPct < 10
    ? `direction matters little here (${apart}% apart) — don't turn roofs away for facing west or north.`
    : "know which roof types give the most solar.";
}

const nearest10 = (n) => Math.round(n / 10) * 10;

/** 4. Three roof counts inside the slider range: half the noon match, the noon match, twice it (clamped). */
export function growthCounts(scenario) {
  const { min, max, preset_noon_match: noon } = scenario;
  const clamp = (n) => Math.min(Math.max(n, min), max);
  const picks = noon == null
    ? [nearest10(max / 4), nearest10(max / 2), max]
    : [clamp(nearest10(noon / 2)), noon, clamp(nearest10(noon * 2))];
  return [...new Set(picks)].sort((a, b) => a - b);
}

/**
 * 4. Card 4's benefit line, from its own middle and high counts and their coverage % (null until loaded).
 * The high count is twice the middle one (rounded to 10) unless the slider's maximum clamps it.
 */
export function growthBenefit(counts, coverage) {
  const [, mid, high] = counts;
  if (high == null || coverage[mid] == null || coverage[high] == null) return "growth planned with numbers, not guesses.";
  const points = Math.round(coverage[high]) - Math.round(coverage[mid]);
  const step = Math.abs(high - 2 * mid) <= 5 ? "doubling roofs" : "adding roofs";
  return `${step} (${mid.toLocaleString("en-MY")} → ${high.toLocaleString("en-MY")}) adds only ${points} points of coverage — `
    + "beyond the noon match, add daytime buyers or storage, not just roofs.";
}
