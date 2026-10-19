import { useEffect, useState } from "react";
import { fetchPlan } from "../api.js";
import Tag from "../components/Tag.jsx";
import { energy, hourName, number, weekdayName } from "../format.js";
import { allocationShares, growthBenefit, growthCounts, roofBenefit, roofKind, roofYields, storage } from "./sdpNumbers.js";

const twoDecimals = (n) => n.toFixed(2);

/** The arrow between two steps of the flow strip (drawn, not a text glyph). */
const Arrow = () => (
  <svg className="flow-arrow" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 12h16M13 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
  </svg>
);

/** One decision, top to bottom: problem, evidence, big number, what SDP decides, the benefit to SDP. */
function DecisionCard({ problem, evidence, tag, children, decides, benefit }) {
  return (
    <article className="decision">
      <h2>{problem}</h2>
      <p className="decision-evidence"><span className="evidence">{evidence}</span> <Tag kind={tag} /></p>
      <div className="decision-figure">{children}</div>
      <div className="decision-text">
        <p className="decision-line"><b>SDP decides:</b> {decides}</p>
        <p className="decision-line"><b>Benefit to SDP:</b> {benefit}</p>
      </div>
    </article>
  );
}

/**
 * Tab 2, "For SDP": how Helios helps SDP, as the CREAM LEGA, make its decisions. Every number comes from
 * the same forecast plan as the Overview (no new models, no ringgit figures); see sdpNumbers.js.
 */
export default function SdpTab({ plan }) {
  const day = weekdayName(plan.day);
  const { scenario } = plan;
  const noon = scenario.preset_noon_match;

  const roofs = roofYields(plan);
  const shares = allocationShares(plan);
  const store = storage(plan);
  const [storeValue, storeUnit] = store.aboutZero ? ["≈ 0", "kWh"] : energy(store.storable).split(" ");

  // 4. Coverage at three roof counts (plans fetched from the same server, so it also works offline)
  const counts = growthCounts(scenario);
  const [sweep, setSweep] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(counts.map((n) => fetchPlan(n, controller.signal)))
      .then((plans) => setSweep(Object.fromEntries(plans.map((p) => [p.scenario.rooftops, p.totals.coverage_pct]))))
      .catch(() => {});
    return () => controller.abort();
  }, [plan.day, counts.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tab tab-page tab-sdp" id="panel-sdp" role="tabpanel" aria-labelledby="tab-sdp">
      <header className="page-head">
        <h1>For SDP: four decisions as the CREAM LEGA</h1>
        <p>From {day}'s forecast plan. I-SOLAR suggests; SDP decides; TNB runs the grid.</p>
      </header>

      <ol className="flow" aria-label="From data to benefit">
        <li><b>Data</b><span>Weather forecast + building demand</span></li>
        <li><Arrow /><b>Forecast</b><span>{plan.lead_days === 1 ? "Tomorrow" : day}'s solar + demand</span></li>
        <li><Arrow /><b>Decision</b><span>Shares, roofs, storage, growth</span></li>
        <li><Arrow /><b>Benefit to SDP</b><span>Decide with evidence before commitments lock in</span></li>
      </ol>

      <section className="decisions" aria-label="Decisions">
        <DecisionCard
          problem="Solar output changes with weather and roof direction."
          evidence="General" tag="EXAMPLE"
          decides="which roofs to accept."
          benefit={roofBenefit(roofs.gapPct)}
        >
          <ul className="figure-rows" aria-label="kWh per kWp for one roof, best and worst example type">
            {[["Best", roofs.best], ["Worst", roofs.worst]].map(([label, r]) => (
              <li key={label}>
                <strong>{twoDecimals(r.kwhPerKwp)}</strong>
                <span><b>{label}:</b> {roofKind(r)}</span>
              </li>
            ))}
          </ul>
          <p className="decision-detail">kWh per kWp, one roof, {day}: {Math.round(roofs.gapPct)}% apart. Shading not modelled; included in standard 14% losses.</p>
        </DecisionCard>

        <DecisionCard
          problem="Shares are locked for months."
          evidence="CREAM cl. 9.10(b), 9.10(e): 120 days' notice to change" tag="STAND-IN"
          decides="each buyer's declared share."
          benefit="sets shares with evidence before they lock in."
        >
          <ul className="figure-rows" aria-label="Example allocation % per buyer">
            {plan.buyers.map((b, i) => (
              <li key={b.id}><strong>{shares[i] == null ? "–" : `${shares[i]}%`}</strong><span>{b.name}</span></li>
            ))}
          </ul>
          <p className="decision-detail">Example from one day — real shares need a full-season run.</p>
        </DecisionCard>

        <DecisionCard
          problem="Solar stops at sunset."
          evidence="TNB is the fallback supplier (cl. 6.10); community storage (cl. 9.13)" tag="STAND-IN"
          decides="how much land to set aside for community storage (cl. 9.13; TNB installs it, cl. 10.1(c))."
          benefit="knows when surplus makes storage worth discussing with TNB."
        >
          <p className="decision-big"><strong>{storeValue}</strong>{storeUnit} storable</p>
          <p className="decision-detail">
            {store.aboutZero
              ? <>No storage needed at this roof count{noon != null && <> — storage matters above <b>{number(noon)}</b> roofs</>}.</>
              : <>Midday surplus at {number(scenario.rooftops)} roofs that evening demand ({hourName(store.fromHour)}–midnight,
                {" "}{energy(store.evening)}) could use. Losses not modelled.</>}
          </p>
        </DecisionCard>

        <DecisionCard
          problem="Growing to 20 MW: which roofs next?"
          evidence="SDP–GSPARX JV target: 20 MW in 5 years (all assets, not only CREAM)" tag="EXAMPLE"
          decides="how many roofs to add before adding buyers."
          benefit={growthBenefit(counts, sweep)}
        >
          <ul className="sweep" aria-label="Share of the day's buyer demand met by solar">
            {counts.map((n) => {
              const pct = sweep[n];
              return (
                <li key={n} className={n === noon ? "is-preset" : undefined}>
                  <span className="sweep-n">{number(n)} roofs{n === noon && <small> noon match</small>}</span>
                  <span className="sweep-bar"><span style={{ width: `${pct ?? 0}%` }} /></span>
                  <span className="sweep-pct">{pct == null ? "…" : `${Math.round(pct)}%`}</span>
                </li>
              );
            })}
          </ul>
          <p className="decision-detail">Solar coverage of buyer demand on {day}.</p>
        </DecisionCard>
      </section>

      <p className="sdp-report">
        <span>At {number(scenario.rooftops)} roofs:</span>
        <span><b>{energy(plan.totals.grid_topup_kwh)}</b> expected grid purchase</span>
        <span aria-hidden="true">·</span>
        <span>about <b>{(plan.totals.co2_avoided_kg / 1000).toFixed(1)} t CO<sub>2</sub></b> avoided (estimated,
          {" "}{plan.carbon_factor.kg_per_kwh.toFixed(3)} kg/kWh, EC)</span>
        <Tag kind="EXAMPLE" />
      </p>

      <p className="sdp-foot">Based on one day's forecast; real decisions need a full-season run. Example sites and stand-in buyers — not CREAM data.</p>
    </div>
  );
}
