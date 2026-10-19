import { useEffect, useState } from "react";
import { fetchPlan } from "../api.js";
import Tag from "../components/Tag.jsx";
import { energy, hourName, mass, weekdayName } from "../format.js";

/** Whole-number percentages that still add up to 100 (largest remainders get the leftover points). */
function percentages(values) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const raw = values.map((v) => (100 * v) / total);
  const out = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - out[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < 100 - out.reduce((a, b) => a + b, 0); k += 1) out[order[k][1]] += 1;
  return out;
}

/** The arrow between two steps of the flow strip (drawn, not a text glyph). */
const Arrow = () => (
  <svg className="flow-arrow" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 12h16M13 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
  </svg>
);

function DecisionCard({ title, tag, big, detail, decides, why }) {
  return (
    <article className="decision">
      <h2>{title} <Tag kind={tag} /></h2>
      <div className="decision-figure">
        <div className="decision-big">{big}</div>
        {detail && <div className="decision-detail">{detail}</div>}
      </div>
      <div className="decision-text">
        <p className="decision-line"><b>SDP decides:</b> {decides}</p>
        <p className="decision-line"><b>Why it matters:</b> {why}</p>
      </div>
    </article>
  );
}

/**
 * Tab 2, "For SDP": what the plan means for SDP's own decisions. Everything is computed from the
 * same forecast plan as the Overview (no new models, no ringgit figures):
 *  1. allocation %: each buyer's share of forecast demand in the sunlit hours
 *  2. roofs to sign: the noon match, and solar coverage at 100 / noon match / 500 roofs
 *  3. storage: demand after the forecast's last sunlit hour, which rooftop solar cannot serve
 *  4. reporting: expected grid purchase and estimated CO2 avoided for the current scenario
 */
export default function SdpTab({ plan }) {
  const day = weekdayName(plan.day);
  const preset = plan.scenario.preset_noon_match;

  // Sunlit hours: hours in which the forecast gives any example roof some solar (fleet size does not matter)
  const sunlit = plan.hours.map((_, h) => plan.rooftops.some((r) => r.hourly_kwh_one_roof[h] > 0));
  const first = sunlit.indexOf(true);
  const last = sunlit.lastIndexOf(true);
  const hasSun = first >= 0;

  // 1. Allocation %: share of demand during the sunlit hours
  const daytime = plan.buyers.map((b) => plan.hours.reduce((sum, row, h) => sum + (sunlit[h] ? row.buyers[b.id].demand_kwh : 0), 0));
  const shares = hasSun ? percentages(daytime) : plan.buyers.map(() => null);

  // 2. Roofs to sign: coverage at 100 roofs, the noon match and 500 roofs (plans fetched from the server)
  const counts = [...new Set([100, preset, 500].filter((n) => n != null))].sort((a, b) => a - b);
  const [sweep, setSweep] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(counts.map((n) => fetchPlan(n, controller.signal)))
      .then((plans) => setSweep(Object.fromEntries(plans.map((p) => [p.scenario.rooftops, p.totals]))))
      .catch(() => {});
    return () => controller.abort();
  }, [plan.day, counts.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const unusedAt500 = sweep[500]?.surplus_kwh ?? 0;

  // 3. Storage: demand after the last sunlit hour, to midnight (no rooftop solar then)
  const evening = hasSun ? plan.hours.slice(last + 1).reduce((sum, row) => sum + row.demand_kwh, 0) : 0;
  const after = hasSun ? `${hourName(last + 1)}–midnight` : "the whole day";

  return (
    <div className="tab tab-page tab-sdp" id="panel-sdp" role="tabpanel" aria-labelledby="tab-sdp">
      <header className="page-head">
        <h1>For SDP: four decisions from {day}'s plan</h1>
        <p>Computed from the same forecast plan as the Overview. Helios suggests; SDP decides; TNB runs the grid.</p>
      </header>

      <ol className="flow" aria-label="From data to benefit">
        <li><b>Data</b><span>Weather forecast (ECMWF), stand-in building meters, example roofs</span></li>
        <li><Arrow /><b>Forecast</b><span>Hourly solar per roof (pvlib), hourly demand per buyer (ML model)</span></li>
        <li><Arrow /><b>Decision</b><span>Allocation %, roofs to sign, storage, reporting</span></li>
        <li><Arrow /><b>Benefit</b><span>Decisions sized to the hourly mismatch (noon surplus, evening gap), not monthly totals</span></li>
      </ol>

      <section className="decisions" aria-label="Decisions">
        <DecisionCard
          title="Allocation %" tag="STAND-IN"
          big={(
            <ul className="shares">
              {plan.buyers.map((b, i) => (
                <li key={b.id}><strong>{shares[i] == null ? "–" : `${shares[i]}%`}</strong><span>{b.name}</span></li>
              ))}
            </ul>
          )}
          detail={<p>Suggested: each buyer's share of forecast demand in the sunlit hours ({hasSun ? `${hourName(first)}–${hourName(last + 1)}` : "none forecast"}).</p>}
          decides="the allocation % each buyer declares to CREAM."
          why="CREAM bills monthly by declared % (cl. 9.10), and changes need 120 days' notice, so the % should follow when each buyer actually uses power."
        />
        <DecisionCard
          title="Roofs to sign" tag="EXAMPLE"
          big={<p><strong>{preset == null ? "–" : preset.toLocaleString("en-MY")}</strong> roofs</p>}
          detail={(
            <ul className="sweep" aria-label="Share of the day's buyer demand met by solar">
              {counts.map((n) => {
                const pct = sweep[n]?.coverage_pct;
                return (
                  <li key={n} className={n === preset ? "is-preset" : undefined}>
                    <span className="sweep-n">{n.toLocaleString("en-MY")} roofs{n === preset && <small> noon match</small>}</span>
                    <span className="sweep-bar"><span style={{ width: `${pct ?? 0}%` }} /></span>
                    <span className="sweep-pct">{pct == null ? "…" : `${Math.round(pct)}%`}</span>
                  </li>
                );
              })}
            </ul>
          )}
          decides="how many homes to sign before adding more."
          why={unusedAt500 > 0
            ? `Past the noon match, midday solar outruns demand: at 500 roofs, ${energy(unusedAt500)} of it goes unused.`
            : "The noon match is where noon solar equals noon demand; past it, extra roofs add midday solar first."}
        />
        <DecisionCard
          title="Storage" tag="STAND-IN"
          big={<p><strong>{energy(evening)}</strong></p>}
          detail={<p>Buyer demand after sunset ({after}), with no rooftop solar to serve it.</p>}
          decides="whether to plan community storage (cl. 9.13), and how big."
          why={unusedAt500 > 0
            ? `It is all expected grid purchase today. At 500 roofs, ${energy(unusedAt500)} of midday solar would go unused that storage could move into the evening (before losses).`
            : "It is all expected grid purchase today, unless midday solar is stored."}
        />
        <DecisionCard
          title="Reporting" tag="EXAMPLE"
          big={<p><strong>{energy(plan.totals.grid_topup_kwh)}</strong></p>}
          detail={(
            <p>
              Expected grid purchase with {plan.scenario.rooftops.toLocaleString("en-MY")} roofs, and about{" "}
              <b>{mass(plan.totals.co2_avoided_kg)} CO<sub>2</sub> avoided</b> (estimated, {plan.carbon_factor.kg_per_kwh.toFixed(3)} kg/kWh
              grid factor, EC 2024 provisional).
            </p>
          )}
          decides="what to budget as grid purchase, and what to report as estimated CO₂ avoided."
          why="These are planning estimates for SDP; they are not figures for any buyer's ESG claims."
        />
      </section>

      <p className="sdp-foot">Based on one day's forecast; real decisions need a full-season run.</p>
    </div>
  );
}
