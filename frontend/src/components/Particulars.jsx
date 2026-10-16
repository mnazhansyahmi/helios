import Tag from "./Tag.jsx";
import { hourName, kwh, number } from "../format.js";

/**
 * The hoarding's "particulars" strip: per-buyer results, how accurate the forecasts
 * are, and where every number comes from.
 */
export default function Particulars({ plan }) {
  // One kWh scale for every buyer bar, so their sizes compare directly.
  const scale = Math.max(...plan.buyers.map((b) => b.demand_kwh));

  return (
    <footer className="particulars">
      <section className="buyers" aria-label="Buyer buildings">
        {plan.buyers.map((b) => (
          <article className="buyer" key={b.id}>
            <div className="buyer-head">
              <h3>
                {b.name} <Tag kind="STAND-IN" />
              </h3>
              <p className="buyer-coverage">
                <strong>{Math.round(b.coverage_pct)}%</strong> solar
              </p>
            </div>
            <div className="buyer-bar" style={{ width: `${(100 * b.demand_kwh) / scale}%` }} aria-hidden="true">
              <span className="buyer-bar-sun" style={{ transform: `scaleX(${b.coverage_pct / 100})` }} />
            </div>
            <p className="buyer-numbers">
              Needs {kwh(b.demand_kwh)} · solar {number(b.solar_used_kwh)} · grid {number(b.grid_topup_kwh)}
            </p>
            <p className="buyer-note">{b.note}; peaks at {hourName(b.peak_hour)}</p>
          </article>
        ))}
      </section>

      <section className="accuracy" aria-label="Forecast accuracy">
        {["solar", "demand"].map((key) =>
          plan.accuracy[key] ? (
            <div key={key} className="accuracy-item">
              <p className="accuracy-sentence">{plan.accuracy[key].sentence}</p>
              <p className="accuracy-detail" title={plan.accuracy[key].detail}>
                {plan.accuracy[key].small_print ?? plan.accuracy[key].detail}
              </p>
            </div>
          ) : null
        )}
      </section>

      <section className="footnote" aria-label="Data labels and sources">
        <p><b>REAL</b> public measured or forecast data · <b>EXAMPLE</b> made up for this demo ·{" "}
          <b>STAND-IN</b> real buildings in Florida standing in for Elmina buildings. {plan.rule}</p>
        <p>{plan.sources.join(" · ")}. CO<sub>2</sub> factor {plan.carbon_factor.kg_per_kwh} kg per kWh.</p>
      </section>
    </footer>
  );
}
