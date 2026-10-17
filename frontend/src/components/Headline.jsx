import { memo, useEffect, useRef, useState } from "react";
import { energy, mass, weekdayName } from "../format.js";

/** Animates a number towards its new value (fast start, gentle stop). Off for reduced motion. */
function useCountUp(target, durationMs = 450) {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      setShown(target);
      fromRef.current = target;
      return;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(2, -10 * t); // exponential ease-out
      const value = from + (target - from) * (t === 1 ? 1 : eased);
      setShown(value);
      fromRef.current = value;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Safety net: browsers pause animation frames when the page isn't being painted
    // (hidden tab, busy laptop). Always land on the true number anyway.
    const settle = setTimeout(() => {
      cancelAnimationFrame(frame);
      setShown(target);
      fromRef.current = target;
    }, durationMs + 50);
    return () => { cancelAnimationFrame(frame); clearTimeout(settle); };
  }, [target, durationMs]);
  return shown;
}

/**
 * The whole planned day in one sentence, above the Overview's big hour line. The solar share is
 * amber (the solar colour); the grid and CO2 figures stay white.
 */
function Headline({ plan }) {
  const { totals, scenario } = plan;
  const coverage = useCountUp(totals.coverage_pct);
  const day = weekdayName(plan.day); // e.g. "Monday": the day being planned

  if (scenario.rooftops === 0) {
    return (
      <h1 className="ov-day">
        With no rooftops, all <span className="figure">{energy(totals.demand_kwh)}</span> of {day}'s buyer demand is an expected grid purchase
      </h1>
    );
  }
  return (
    <h1 className="ov-day">
      With {scenario.rooftops.toLocaleString("en-MY")} rooftops, solar covers{" "}
      <span className="figure figure-sun">{Math.round(coverage)}%</span> of {day}'s buyer demand
      <span className="sep" aria-hidden="true"> · </span>
      <span className="figure">{energy(totals.grid_topup_kwh)}</span> expected grid purchase
      <span className="sep" aria-hidden="true"> · </span>
      about <span className="figure">{mass(totals.co2_avoided_kg)}</span> CO<sub>2</sub> avoided (estimated)
    </h1>
  );
}

export default memo(Headline); // redrawn only when the plan changes, not on every frame of Play
