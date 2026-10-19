import { useRef } from "react";
import Tag from "./Tag.jsx";

export const DAY_TYPES = [
  { id: "forecast", label: "Forecast" },
  { id: "sunny", label: "Sunny" },
  { id: "average", label: "Average" },
  { id: "cloudy", label: "Cloudy" },
];
const dayTypeLabel = (id) => DAY_TYPES.find((d) => d.id === id)?.label ?? "Forecast";

/** "Scenario": how many rooftops like the examples join (0-1000), and the noon-match preset. */
function ScenarioBox({ scenario, rooftops, onChange }) {
  const { min, max, preset_noon_match: preset } = scenario;
  const fill = ((rooftops - min) / (max - min)) * 100;
  const presetPct = preset == null ? null : ((preset - min) / (max - min)) * 100;
  const atPreset = preset != null && rooftops === preset;
  return (
    <fieldset className="ov-group ov-scenario-box">
      <legend>Rooftops</legend>
      <div className="ov-rooftops">
        <label htmlFor="fleet" className="ov-rooftops-head">
          <span className="ov-rooftops-value">{rooftops.toLocaleString("en-MY")}</span> rooftops
          <span className="ov-rooftops-note"><span className="ov-rooftops-sep">· </span>not a CREAM figure <Tag kind="EXAMPLE" /></span>
        </label>
        <div className="slider-wrap">
          <input id="fleet" type="range" min={min} max={max} step={1} value={rooftops}
                 onChange={(e) => onChange(Number(e.target.value))} style={{ "--fill": `${fill}%` }} />
          {presetPct != null && (
            <span className="preset-tick" style={{ left: `${presetPct}%` }} aria-hidden="true">noon match</span>
          )}
        </div>
      </div>
      <button type="button" className="preset preset-compact" onClick={() => onChange(preset)}
              disabled={preset == null} aria-pressed={atPreset}>
        <span className="preset-action">{atPreset ? "At the noon match" : "Jump to noon match"}</span>
        <span className="preset-detail">{preset == null ? "No noon sun forecast" : `${preset.toLocaleString("en-MY")} rooftops`}</span>
      </button>
    </fieldset>
  );
}

/** "Day type": the forecast, or the real measured sunlight of a sunny, average or cloudy past day. */
function DayTypePicker({ dayType, onChange }) {
  return (
    <fieldset className="ov-group day-type">
      <legend>Day type</legend>
      <div className="day-type-buttons" role="group" aria-label="Day type">
        {DAY_TYPES.map((d) => (
          <button key={d.id} type="button" aria-pressed={dayType === d.id} onClick={() => onChange(d.id)}>{d.label}</button>
        ))}
      </div>
      <p className="day-type-note">
        Forecast = the next working day's weather forecast. Sunny / Average / Cloudy = the real measured sunlight
        of one past day (90th percentile, median, 10th percentile of Oct 2025 – Sep 2026); demand stays the forecast's.
      </p>
    </fieldset>
  );
}

/** A "sliders" icon (two tracks with knobs), drawn, not a text glyph. */
const Sliders = () => (
  <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 7h18M3 17h18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
    <rect x="13" y="4.5" width="4" height="5" fill="var(--ink)" stroke="currentColor" strokeWidth="1.8" />
    <rect x="6" y="14.5" width="4" height="5" fill="var(--ink)" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

/**
 * The top bar's settings: a small live label ("337 roofs · Forecast") that drops a panel down from
 * under the top bar, at the right. Esc, a click outside or Done closes it; focus moves into it, and
 * number keys do not switch tabs while it is open (see App.jsx).
 */
export default function Settings({ scenario, rooftops, onRooftops, dayType, onDayType }) {
  const dialog = useRef(null);
  const button = useRef(null);
  const open = () => {
    const bar = button.current.closest(".topbar");
    dialog.current.style.top = `${Math.round(bar.getBoundingClientRect().bottom)}px`;
    dialog.current.showModal();
  };
  const close = () => dialog.current?.close();
  return (
    <>
      <button type="button" ref={button} className="settings-open" onClick={open} aria-haspopup="dialog">
        <Sliders /><span><strong>{rooftops.toLocaleString("en-MY")}</strong> roofs · {dayTypeLabel(dayType)}</span>
      </button>
      <dialog className="settings-panel" ref={dialog} aria-label="Settings"
              onClick={(e) => { if (e.target === dialog.current) close(); }}>
        <div className="settings-body">
          <ScenarioBox scenario={scenario} rooftops={rooftops} onChange={onRooftops} />
          <DayTypePicker dayType={dayType} onChange={onDayType} />
          <button type="button" className="scenario-done" onClick={close}>Done</button>
        </div>
      </dialog>
    </>
  );
}
