import Tag from "./Tag.jsx";
import { hourName } from "../format.js";

/**
 * The presenter's two controls:
 *  - the preset button: jump to the rooftop count where noon solar = noon demand
 *  - the scenario slider: how many rooftops like the examples join (0-1000)
 */
export default function Controls({ scenario, rooftops, onChange }) {
  const { min, max, preset_noon_match: preset, preset_hour: presetHour } = scenario;
  const atPreset = preset != null && rooftops === preset;
  const fillPct = ((rooftops - min) / (max - min)) * 100;
  const presetPct = preset == null ? null : ((preset - min) / (max - min)) * 100;

  return (
    <div className="controls">
      <button
        type="button"
        className="preset"
        onClick={() => onChange(preset)}
        disabled={preset == null}
        aria-pressed={atPreset}
      >
        <span className="preset-action">{atPreset ? "At the noon match" : "Jump to noon match"}</span>
        <span className="preset-detail">
          {preset == null
            ? "No noon sun in this day's forecast"
            : `${preset.toLocaleString("en-MY")} rooftops: solar = demand at ${hourName(presetHour)}`}
        </span>
      </button>

      <div className="scenario">
        <div className="scenario-top">
          <output htmlFor="fleet" className="scenario-value">
            {rooftops.toLocaleString("en-MY")} <span>rooftops</span>
          </output>
          <div className="scenario-label">
            <label htmlFor="fleet">Scenario: how many rooftops like these join</label>
            <span className="scenario-note">Not a CREAM figure <Tag kind="EXAMPLE" /></span>
          </div>
        </div>
        <div className="slider-wrap">
          <input
            id="fleet"
            type="range"
            min={min}
            max={max}
            step={1}
            value={rooftops}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ "--fill": `${fillPct}%` }}
          />
          {presetPct != null && (
            <span className="preset-tick" style={{ left: `${presetPct}%` }} aria-hidden="true">
              noon match
            </span>
          )}
        </div>
        <div className="slider-ends" aria-hidden="true">
          <span>{min}</span>
          <span>{max.toLocaleString("en-MY")}</span>
        </div>
      </div>
    </div>
  );
}
