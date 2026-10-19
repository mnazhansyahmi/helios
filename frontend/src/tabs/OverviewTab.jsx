import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import BuyerCards from "../components/BuyerCards.jsx";
import DayChart, { plotArea } from "../components/DayChart.jsx";
import Headline from "../components/Headline.jsx";
import SiteMap from "../components/SiteMap.jsx";
import Tag from "../components/Tag.jsx";
import { hourName, kwh, weekdayName } from "../format.js";
import usePlayDay from "./usePlayDay.js";

// The 3D township (and three.js) is a separate file, loaded from this server only when needed.
const Township = lazy(() => import("./Township.jsx"));

const FIRST_HOUR = 6;
const LAST_HOUR = 21;

/** True if this browser can draw WebGL (the 3D township needs it). */
function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // free the test context straight away
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** If the 3D township throws while loading or drawing, tell the Overview to show the 2D plan. */
class ThreeDGuard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * A vertical line over the 24-hour chart at the hour being shown; it follows the hour slider and
 * Play. Drawn on its own layer, so the chart itself is never redrawn while the day plays.
 */
function HourMarker({ t, hour }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [texts, setTexts] = useState([]); // boxes of the chart's own text, which the line must never cross
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Measure the chart's text (callouts, SOLAR / GRID TOP-UP, axis titles) each time the chart redraws.
  // The chart never changes during Play, so this runs only after a plan change or a resize.
  useEffect(() => {
    const layer = ref.current;
    const chart = layer.parentElement.querySelector(".chart-canvas");
    if (!chart) return undefined;
    let timer;
    const measure = () => {
      const origin = layer.getBoundingClientRect();
      setTexts([...chart.querySelectorAll("svg text")]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .map((r) => ({ l: r.left - origin.left - 6, r: r.right - origin.left + 6, t: r.top - origin.top - 3, b: r.bottom - origin.top + 3 })));
    };
    const later = () => { clearTimeout(timer); timer = setTimeout(measure, 120); };
    const observer = new MutationObserver(later);
    observer.observe(chart, { childList: true, subtree: true, attributes: true, characterData: true });
    later();
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  const plot = plotArea(size.width, size.height);
  const x = plot.left + (t / 23) * (plot.right - plot.left);
  const top = plot.top - 6;
  // the line from top to the x-axis, with a gap wherever it would cross chart text
  const gaps = texts.filter((b) => b.l <= x && b.r >= x).map((b) => [b.t, b.b]).sort((a, b) => a[0] - b[0]);
  const segments = [];
  let y = top;
  for (const [from, to] of gaps) {
    if (from > y) segments.push([y, Math.min(from, plot.bottom)]);
    y = Math.max(y, to);
  }
  if (plot.bottom > y) segments.push([y, plot.bottom]);

  return (
    <div className="hour-marker-layer" ref={ref} aria-hidden="true">
      {size.width > 0 && (
        // moved with a transform on its own layer: the chart underneath is never repainted during Play
        <div className="hour-marker" style={{ transform: `translateX(${x}px)` }}>
          {segments.map(([from, to]) => <i key={from} style={{ top: from, height: to - from }} />)}
          <span style={{ top: plot.bottom }}>{hourName(hour)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * "The day": Play, and the hour slider drawn as a timeline (a thin line, a tick every hour, a
 * white needle), so it never looks like the rooftop slider. It moves time; it is not a quantity.
 */
function DayTimeline({ t, hour, playing, onPlay, onScrub }) {
  const at = (h) => `${((h - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * 100}%`;
  return (
    <fieldset className="ov-group ov-day-group">
      <legend>The day</legend>
      <button type="button" className="play" onClick={onPlay} aria-pressed={playing}>
        {playing ? "Pause" : "Play the day"}
      </button>
      <div className="timeline">
        <div className="timeline-ticks" aria-hidden="true">
          {Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i).map((h) => (
            <span key={h} className={h % 3 === 0 ? "major" : undefined} style={{ left: at(h) }}>
              {h % 3 === 0 && <em>{hourName(h)}</em>}
            </span>
          ))}
        </div>
        <input type="range" min={FIRST_HOUR} max={LAST_HOUR} step="any" value={t}
               aria-label="Hour of the day" aria-valuetext={hourName(hour)}
               onChange={(e) => onScrub(Math.round(Number(e.target.value)))} />
      </div>
    </fieldset>
  );
}

/** "noon" -> "Noon", "3pm" stays "3pm": the hour line starts with a capital. */
const capitalised = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Tab 1, "Overview": the whole story on one screen.
 *  - band: the day in one sentence; the chosen hour in one big line; Play the day (6am-9pm in
 *    ~10 s, 2 s hold at 3pm) and the hour slider (rooftops and day type are in the top bar's settings)
 *  - left: the 3D example township (2D site plan without WebGL); right: the 24-hour chart with
 *    an hour marker that follows Play
 *  - bottom: the three buyer buildings over the whole day
 */
export default function OverviewTab({ plan, error }) {
  const { t, playing, toggle, scrub } = usePlayDay(plan.scenario.preset_hour ?? 12);
  const [threeD, setThreeD] = useState(canUseWebGL);
  const fallBack = useCallback(() => setThreeD(false), []);
  const hour = Math.min(LAST_HOUR, Math.floor(t));          // the hourly bucket being shown
  const row = plan.hours[hour];
  const pct = row.demand_kwh > 0 ? Math.round((100 * row.solar_used_kwh) / row.demand_kwh) : 0;

  const play = () => {
    if (!playing && t >= LAST_HOUR) scrub(FIRST_HOUR);       // replay from the start
    toggle();
  };

  return (
    <div className="tab tab-overview" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <header className="band band-overview">
        <Headline plan={plan} />
        <p className="ov-line" aria-live="polite">
          {capitalised(hourName(hour))}: solar covers <span className="figure-sun">{pct}%</span>, grid purchase{" "}
          <span className="figure">{kwh(row.grid_topup_kwh)}</span>
        </p>
        <div className="ov-controls">
          <DayTimeline t={t} hour={hour} playing={playing} onPlay={play} onScrub={scrub} />
        </div>
        {error && <p className="band-error" role="alert">Lost contact with the server; showing the last plan.</p>}
      </header>

      <main className="ov-main">
        <section className="ov-stage" aria-label="Example township">
          {threeD ? (
            <ThreeDGuard onFail={fallBack}>
              <Suspense fallback={null}><Township plan={plan} t={t} hour={hour} onFail={fallBack} /></Suspense>
            </ThreeDGuard>
          ) : <SiteMap plan={plan} hour={hour} />}
          <p className="ov-label"><Tag kind="EXAMPLE" /> {threeD ? "Example township, not a model of Elmina" : "Example sites"} · all within {plan.match_distance_km} km</p>
        </section>

        <section className="ov-chart" aria-labelledby="chart-title">
          <div className="panel-head">
            <h2 id="chart-title">{weekdayName(plan.day)}, hour by hour</h2>
            <ul className="legend" aria-label="Chart key">
              <li><i className="key key-line" />Buyer demand <Tag kind="STAND-IN" /></li>
              <li><i className="key key-sun" />Solar used</li>
              <li><i className="key key-hatch" />Grid top-up</li>
              {plan.totals.surplus_kwh > 0 && <li><i className="key key-pale" />Unused solar</li>}
            </ul>
          </div>
          <div className="ov-chart-area">
            <DayChart plan={plan} />
            <HourMarker t={t} hour={hour} />
          </div>
        </section>
      </main>

      <BuyerCards plan={plan} />
    </div>
  );
}
