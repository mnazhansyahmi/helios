import { memo } from "react";
import Tag from "./Tag.jsx";
import { kwh, number, weekdayName } from "../format.js";

/**
 * The Overview's bottom strip: each buyer building over the whole planned day (share from solar,
 * and needs / solar / grid in kWh), then a one-line pointer to the About tab, which explains the tags.
 */
function BuyerCards({ plan }) {
  // One kWh scale for every buyer bar, so their sizes compare directly.
  const scale = Math.max(...plan.buyers.map((b) => b.demand_kwh));
  const day = weekdayName(plan.day);

  return (
    <footer className="buyer-cards">
      <section className="buyers" aria-label={`Buyer buildings, all of ${day}`}>
        {plan.buyers.map((b) => (
          <article className="buyer" key={b.id}>
            <div className="buyer-head">
              <h3>{b.name} <Tag kind="STAND-IN" /></h3>
              <p className="buyer-coverage"><strong>{Math.round(b.coverage_pct)}%</strong> solar</p>
            </div>
            <div className="buyer-bar" style={{ width: `${(100 * b.demand_kwh) / scale}%` }} aria-hidden="true">
              <span className="buyer-bar-sun" style={{ transform: `scaleX(${b.coverage_pct / 100})` }} />
            </div>
            <p className="buyer-numbers">
              {day}: needs {kwh(b.demand_kwh)} · solar {number(b.solar_used_kwh)} · grid {number(b.grid_topup_kwh)}
            </p>
          </article>
        ))}
      </section>
      <p className="tags-note">Planning estimate · <b>REAL</b> / <b>EXAMPLE</b> / <b>STAND-IN</b> explained in About the data</p>
    </footer>
  );
}

export default memo(BuyerCards); // redrawn only when the plan changes, not on every frame of Play
