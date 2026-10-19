import { useEffect, useState } from "react";
import { fetchSeason } from "../api.js";
import Tag from "../components/Tag.jsx";
import { energy, number } from "../format.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" -> "Sep 2026" */
const monthName = (ym) => `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
/** Days in a "2026-09" month (28-31). */
const daysIn = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).getUTCDate();
/** "2025-10-01" -> "1 Oct 2025" */
const dayName = (iso) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/**
 * For SDP, "Season": the same solar and demand models run over twelve months of real past weather
 * (precomputed by backend/ml/05_season.py and committed, so it works offline). Per month: each
 * buyer's share of sunlit-hour demand, solar coverage and unused solar, at one fixed roof count.
 */
export default function SeasonView() {
  const [season, setSeason] = useState(undefined); // undefined = loading, null = not generated yet
  useEffect(() => { fetchSeason().then(setSeason).catch(() => setSeason(null)); }, []);

  if (season === undefined) return <p className="season-empty">Loading the season…</p>;
  if (season === null) {
    return (
      <p className="season-empty">
        The season has not been generated yet. While online, run <code>python backend/ml/05_season.py</code> and commit
        {" "}<code>backend/data/season.json</code>.
      </p>
    );
  }

  const maxSurplus = Math.max(...season.months.map((m) => m.surplus_kwh), 1);
  // "steady" is only said while every buyer's monthly share stays within 3 points over the year
  const spread = Math.max(...season.buyers.map((b) => {
    const pcts = season.months.map((m) => m.allocation_pct[b.id]).filter((v) => v != null);
    return Math.max(...pcts) - Math.min(...pcts);
  }));
  const reading = spread <= 3
    ? "shares stay steady for these stand-in buildings; solar coverage and unused solar move with the weather."
    : "shows how shares change through the year.";
  return (
    <section className="season" aria-label="Season: past weather through the models">
      <p className="season-label">
        <span><b>Based on past weather ({dayName(season.from)} – {dayName(season.to)}), not a forecast</b> — {reading} <Tag kind="REAL" /></span>
        <span className="season-at">At {number(season.rooftops)} roofs ({season.rooftops_rule}) <Tag kind="EXAMPLE" /></span>
      </p>
      <div className="season-table-wrap">
        <table className="season-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              {season.buyers.map((b) => <th scope="col" key={b.id} className="num">{b.name} <small>share</small></th>)}
              <th scope="col" className="season-cov-head">Solar coverage of buyer demand</th>
              <th scope="col" className="season-unused-head">Unused solar</th>
            </tr>
          </thead>
          <tbody>
            {season.months.map((m) => (
              <tr key={m.month}>
                <th scope="row">
                  {monthName(m.month)}
                  {m.days < daysIn(m.month) && <small className="season-days"> {m.days}/{daysIn(m.month)} days</small>}
                </th>
                {season.buyers.map((b) => (
                  <td key={b.id} className="num">{m.allocation_pct[b.id] == null ? "–" : `${Math.round(m.allocation_pct[b.id])}%`}</td>
                ))}
                <td>
                  <span className="season-cov">
                    <span className="sweep-bar"><span style={{ width: `${m.coverage_pct}%` }} /></span>
                    <b>{Math.round(m.coverage_pct)}%</b>
                  </span>
                </td>
                <td>
                  <span className="season-unused">
                    <span className="season-unused-bar"><span style={{ width: `${(100 * m.surplus_kwh) / maxSurplus}%` }} /></span>
                    <span className="num">{energy(m.surplus_kwh)}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="season-note">
        Share = each buyer's part of demand in the sunlit hours (the example allocation %). Buyers <Tag kind="STAND-IN" />.
        {season.months.some((m) => m.days < daysIn(m.month)) && " Hours with missing satellite data are left out; unused solar covers the days with data."}
        {" "}Weather: {season.sources.join("; ")}.
      </p>
    </section>
  );
}
