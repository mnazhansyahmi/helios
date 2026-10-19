import Settings from "./Settings.jsx";
import Tag from "./Tag.jsx";
import { fullDate, leadText, shortDate, shortDay } from "../format.js";
import { TABS } from "./tabs.js";

export { TABS };

/**
 * The shared top row on every tab: wordmark, the five tabs (keys 1-5 also switch them), the planned
 * day and the settings (rooftops, day type). Long and short date forms swap by screen width (see
 * styles.css). On a what-if day type, a banner under the row says the sunlight is a real past day's.
 */
export default function TopBar({ tab, onTab, plan, settings }) {
  const offline = plan && plan.weather.source !== "live";
  return (
    <header className="topbar">
      <p className="wordmark">I-SOLAR</p>
      <nav className="tabs" role="tablist" aria-label="I-SOLAR sections">
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
      {plan && <Settings scenario={plan.scenario} {...settings} />}
      {offline && <p className="stamp" role="status">Saved forecast · {plan.weather.fetched_at.replace("T", " ")}</p>}
      {plan?.what_if && (
        <p className="whatif-banner" role="status">
          <span><b>What-if: {plan.what_if.label.toLowerCase()} day</b> — real sunlight from {shortDay(plan.what_if.date)}, not a forecast</span>
          <Tag kind="EXAMPLE" />
        </p>
      )}
    </header>
  );
}
