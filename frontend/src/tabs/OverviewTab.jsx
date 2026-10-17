import SiteMap from "../components/SiteMap.jsx";
import Tag from "../components/Tag.jsx";
import { hourName, kwh } from "../format.js";
import usePlayDay from "./usePlayDay.js";

const FIRST_HOUR = 6;
const LAST_HOUR = 21;

/**
 * Tab 1, "Overview": the day at a glance. One big line for the chosen hour, an hour slider,
 * "Play the day" (6am-9pm in ~10 s, 2 s hold at 3pm) and the noon-match preset.
 * The picture is the 2D site plan; `Scene` (the 3D township) replaces it when given.
 */
export default function OverviewTab({ plan, rooftops, onRooftops, Scene }) {
  const { t, playing, toggle, scrub } = usePlayDay(plan.scenario.preset_hour ?? 12);
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
        <p className="ov-context">Planning prototype for CREAM, City of Elmina. Helios plans; TNB runs the grid.</p>
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
          <button type="button" className="preset preset-compact" onClick={() => onRooftops(preset)}
                  disabled={preset == null} aria-pressed={atPreset}>
            <span className="preset-action">{atPreset ? "At the noon match" : "Jump to noon match"}</span>
            <span className="preset-detail">{preset == null ? "No noon sun forecast" : `${preset.toLocaleString("en-MY")} rooftops`}</span>
          </button>
          <p className="ov-scenario">
            {rooftops.toLocaleString("en-MY")} rooftops in this scenario, not a CREAM figure <Tag kind="EXAMPLE" />
          </p>
        </div>
      </header>
      <main className="ov-stage">
        {Scene ? <Scene plan={plan} t={t} hour={hour} /> : <SiteMap plan={plan} hour={hour} />}
        <p className="ov-label"><Tag kind="EXAMPLE" /> {Scene ? "Example township, not a model of Elmina" : "Example sites"} · all within {plan.match_distance_km} km</p>
      </main>
    </div>
  );
}
