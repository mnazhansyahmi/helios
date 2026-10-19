import MiniCurve from "../components/MiniCurve.jsx";
import Tag from "../components/Tag.jsx";
import { leadText, weekdayName } from "../format.js";

const COMPASS = { 0: "north", 90: "east", 180: "south", 270: "west" };
const METHOD_ORDER = ["persistence", "monthly_average", "forecast_ai", "forecast_pvlib"];

/** Horizontal bars with a value at the tip; `current` rows are drawn in ink, the rest in grey. */
function Bars({ title, note, rows, format }) {
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <section className="bars" aria-label={title}>
      <h3>{title}</h3>
      {rows.map((r) => (
        <div key={r.key} className={`bar-row${r.current ? " is-current" : ""}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(100 * Math.max(r.value, 0)) / max}%` }} /></span>
          <span className="bar-value">{format(r.value)}</span>
        </div>
      ))}
      {note && <p className="bars-note">{note}</p>}
    </section>
  );
}

/** Tab 3, "Solar": the planned day's output for one roof of each example type, and how accurate it is. */
export default function SolarTab({ plan, accuracy }) {
  const day = weekdayName(plan.day);
  const max = Math.max(...plan.rooftops.flatMap((r) => r.hourly_kwh_one_roof), 0.01);
  const s = accuracy?.solar;
  const leads = s?.by_lead_days?.leads;
  const lead = Math.max(1, plan.lead_days);

  return (
    <div className="tab tab-page" id="panel-solar" role="tabpanel" aria-labelledby="tab-solar">
      <header className="page-head">
        <h1>{day}'s solar, one roof of each example type <Tag kind="EXAMPLE" /></h1>
        <p>
          Weather forecast (ECMWF, {plan.lead_days >= 1 ? leadText(plan.lead_days) : "saved"}) turned into kWh by pvlib.
          Roof sizes and directions are example values; all roofs share one forecast, so they differ only by size and direction.
        </p>
      </header>
      <div className="page-body">
        <section className="card-grid card-grid-4x2" aria-label="Solar per example rooftop">
          {plan.rooftops.map((r) => (
            <article className="card" key={r.id}>
              <h2>{r.id} · {r.kwp} kWp, {COMPASS[r.azimuth] ?? `${r.azimuth}°`}-facing</h2>
              <p className="card-total"><strong>{r.kwh_one_roof.toFixed(1)}</strong> kWh for the day</p>
              <MiniCurve values={r.hourly_kwh_one_roof} max={max} from={5} to={20} tone="sun"
                         label={`${r.id}: ${r.kwh_one_roof.toFixed(1)} kWh for the day`} />
            </article>
          ))}
        </section>

        <aside className="page-side">
          <p className="side-sentence">{plan.accuracy.solar.sentence}</p>
          <p className="side-small">{plan.accuracy.solar.small_print}</p>
          {leads && (
            <Bars title="Better than a simple guess, by how far ahead the forecast is made"
                  rows={Object.entries(leads).map(([n, v]) => ({
                    key: n, label: `${n} day${n === "1" ? "" : "s"} ahead`, value: v.improvement_pct,
                    current: Number(n) === Math.min(lead, Object.keys(leads).length),
                  }))}
                  format={(v) => `${v}%`}
                  note={`Dark bar = this plan (${plan.lead_days >= 1 ? leadText(plan.lead_days) : "saved forecast"}).`} />
          )}
          {s && (
            <Bars title="Average error, 1 day ahead (kWh per kWp per daylight hour; lower is better)"
                  rows={METHOD_ORDER.filter((k) => s.methods[k]).map((k) => ({
                    key: k, value: s.methods[k].mae_hourly_kwh_per_kwp, current: k === s.live_method,
                    label: s.methods[k].label + (k === s.live_method ? " (used)" : k === s.simple_guess ? " (simple guess)"
                      : k === "forecast_ai" ? " (tested, not used)" : ""),
                  }))}
                  format={(v) => v.toFixed(3)} />
          )}
        </aside>
      </div>
    </div>
  );
}
