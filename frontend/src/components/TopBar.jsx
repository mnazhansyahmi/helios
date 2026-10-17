import Tag from "./Tag.jsx";
import { fullDate, leadText, shortDate } from "../format.js";

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "solar", label: "Solar" },
  { id: "demand", label: "Demand" },
  { id: "match", label: "Match" },
  { id: "about", label: "About the data" },
];

/**
 * The shared top row on every tab: wordmark, the five tabs (keys 1-5 also switch them),
 * and the planned day. Long and short date forms swap by screen width (see styles.css).
 */
export default function TopBar({ tab, onTab, plan }) {
  const offline = plan && plan.weather.source !== "live";
  return (
    <header className="topbar">
      <p className="wordmark">Helios</p>
      <nav className="tabs" role="tablist" aria-label="Helios sections">
        {TABS.map((t, i) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-controls={`panel-${t.id}`}
                  aria-selected={tab === t.id} className="tab-button" onClick={() => onTab(t.id)}>
            <span className="tab-key" aria-hidden="true">{i + 1}</span>{t.label}
          </button>
        ))}
      </nav>
      {plan && (
        <p className="band-date">
          <span className="band-date-label">Plan for</span>{" "}
          <strong className="band-date-day">
            <span className="date-long">{fullDate(plan.day)}</span>
            <span className="date-short">{shortDate(plan.day)}</span>
          </strong>{" "}
          <span>
            {plan.is_next_working_day && <span className="band-date-why">next working day · </span>}
            {plan.lead_days >= 1 ? leadText(plan.lead_days) : "saved forecast"}
          </span>{" "}
          <Tag kind="REAL" />
        </p>
      )}
      {offline && <p className="stamp" role="status">Saved forecast · {plan.weather.fetched_at.replace("T", " ")}</p>}
    </header>
  );
}
