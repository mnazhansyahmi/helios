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
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const plot = plotArea(size.width, size.height);
  const x = plot.left + (t / 23) * (plot.right - plot.left);
  return (
    <div className="hour-marker-layer" ref={ref} aria-hidden="true">
      {size.width > 0 && (
        // moved with a transform on its own layer: the chart underneath is never repainted during Play
        <div className="hour-marker" style={{ transform: `translateX(${x}px)`, top: plot.top - 6, height: plot.bottom - plot.top + 6 }}>
          <span>{hourName(hour)}</span>
        </div>
      )}
    </div>
  );
}

/** The scenario slider, compact: how many rooftops like the examples join (0-1000). */
function RooftopSlider({ scenario, rooftops, onChange }) {
  const { min, max, preset_noon_match: preset } = scenario;
  const fill = ((rooftops - min) / (max - min)) * 100;
  const presetPct = preset == null ? null : ((preset - min) / (max - min)) * 100;
  return (
    <div className="ov-rooftops">
      <label htmlFor="fleet" className="ov-rooftops-head">
        <span className="ov-rooftops-value">{rooftops.toLocaleString("en-MY")}</span> rooftops
        <span className="ov-rooftops-note">scenario, not a CREAM figure <Tag kind="EXAMPLE" /></span>
      </label>
      <div className="slider-wrap">
        <input id="fleet" type="range" min={min} max={max} step={1} value={rooftops}
               onChange={(e) => onChange(Number(e.target.value))} style={{ "--fill": `${fill}%` }} />
        {presetPct != null && (
          <span className="preset-tick" style={{ left: `${presetPct}%` }} aria-hidden="true">noon match</span>
        )}
      </div>
    </div>
  );
}

/**
 * Tab 1, "Overview": the whole story on one screen.
 *  - band: the day in one sentence; the chosen hour in one big line; Play the day (6am-9pm in
 *    ~10 s, 2 s hold at 3pm), the hour slider, the rooftop slider and the noon-match preset
 *  - left: the 3D example township (2D site plan without WebGL); right: the 24-hour chart with
 *    an hour marker that follows Play
 *  - bottom: the three buyer buildings over the whole day
 */
export default function OverviewTab({ plan, rooftops, onRooftops, error }) {
  const { t, playing, toggle, scrub } = usePlayDay(plan.scenario.preset_hour ?? 12);
  const [threeD, setThreeD] = useState(canUseWebGL);
  const fallBack = useCallback(() => setThreeD(false), []);
  const hour = Math.min(LAST_HOUR, Math.floor(t));          // the hourly bucket being shown
  const row = plan.hours[hour];
  const pct = row.demand_kwh > 0 ? Math.round((100 * row.solar_used_kwh) / row.demand_kwh) : 0;
  const preset = plan.scenario.preset_noon_match;
  const atPreset = preset != null && rooftops === preset;
  const fill = ((t - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * 100;

  const play = () => {
    if (!playing && t >= LAST_HOUR) scrub(FIRST_HOUR);       // replay from the start
    toggle();
  };

  return (
    <div className="tab tab-overview" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview">
      <header className="band band-overview">
        <Headline plan={plan} />
        <p className="ov-line" aria-live="polite">
          {hourName(hour)}: solar covers <span className="figure-sun">{pct}%</span>, grid supplies{" "}
          <span className="figure">{kwh(row.grid_topup_kwh)}</span>
        </p>
        <div className="ov-controls">
          <button type="button" className="play" onClick={play} aria-pressed={playing}>
            {playing ? "Pause" : "Play the day"}
          </button>
          <div className="hour-slider">
            <input type="range" min={FIRST_HOUR} max={LAST_HOUR} step="any" value={t}
                   aria-label="Hour of the day" aria-valuetext={hourName(hour)}
                   onChange={(e) => scrub(Math.round(Number(e.target.value)))}
                   style={{ "--fill": `${fill}%` }} />
            <div className="hour-ticks" aria-hidden="true">
              {[6, 9, 12, 15, 18, 21].map((h) => (
                <span key={h} style={{ left: `${((h - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * 100}%` }}>{hourName(h)}</span>
              ))}
            </div>
          </div>
          <RooftopSlider scenario={plan.scenario} rooftops={rooftops} onChange={onRooftops} />
          <button type="button" className="preset preset-compact" onClick={() => onRooftops(preset)}
                  disabled={preset == null} aria-pressed={atPreset}>
            <span className="preset-action">{atPreset ? "At the noon match" : "Jump to noon match"}</span>
            <span className="preset-detail">{preset == null ? "No noon sun forecast" : `${preset.toLocaleString("en-MY")} rooftops`}</span>
          </button>
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
