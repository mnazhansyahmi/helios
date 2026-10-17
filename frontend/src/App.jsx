import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPlan } from "./api.js";
import { fullDate, hourName, hourRange, leadText, weekdayName } from "./format.js";
import Controls from "./components/Controls.jsx";
import DayChart from "./components/DayChart.jsx";
import Headline from "./components/Headline.jsx";
import Particulars from "./components/Particulars.jsx";
import SiteMap from "./components/SiteMap.jsx";
import Tag from "./components/Tag.jsx";

export default function App() {
  const [plan, setPlan] = useState(null);
  const [rooftops, setRooftops] = useState(null); // null = use the server's default (50)
  const [error, setError] = useState(null);
  const [hoverHour, setHoverHour] = useState(null);
  const inFlight = useRef(null);

  // Fetch the plan; a newer request cancels an older one, so dragging the slider stays snappy.
  const load = useCallback((count) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    fetchPlan(count, controller.signal)
      .then((next) => { setPlan(next); setError(null); })
      .catch((e) => { if (e.name !== "AbortError") setError(e); });
  }, []);

  useEffect(() => { load(rooftops); }, [rooftops, load]);

  if (!plan) {
    return (
      <div className="app app-waiting">
        <header className="band">
          <p className="wordmark">Helios</p>
          {error ? (
            <div className="headline">
              <h1>Can't reach the Helios server.</h1>
              <p className="headline-sub">Start it with <code>python run_demo.py</code>, then try again.</p>
              <button type="button" className="preset preset-small" onClick={() => load(rooftops)}>Try again</button>
            </div>
          ) : (
            <div className="headline"><h1 className="loading">Loading the next working day's forecast…</h1></div>
          )}
        </header>
      </div>
    );
  }

  const shownRooftops = rooftops ?? plan.scenario.rooftops;
  const mapHour = hoverHour ?? plan.peaks.solar_hour ?? 12;
  const offline = plan.weather.source !== "live";

  return (
    <div className="app">
      <header className="band">
        <div className="band-meta">
          <p className="wordmark">Helios</p>
          <p className="band-context">Planning prototype for CREAM, City of Elmina. Helios plans; TNB runs the grid.</p>
          {/* The planned day, stated plainly: the default is the next working day in Selangor */}
          <p className="band-date">
            <span className="band-date-label">Plan for</span>{" "}
            <strong className="band-date-day">{fullDate(plan.day)}</strong>{" "}
            <span>
              {plan.is_next_working_day && <span className="band-date-why">next working day · </span>}
              {plan.lead_days >= 1 ? leadText(plan.lead_days) : "saved forecast"}
            </span>{" "}
            <Tag kind="REAL" />
          </p>
          {offline && (
            <p className="stamp" role="status">
              Saved forecast · {plan.weather.fetched_at.replace("T", " ")}
            </p>
          )}
        </div>
        <Headline plan={plan} />
        <Controls scenario={plan.scenario} rooftops={shownRooftops} onChange={setRooftops} />
        {error && <p className="band-error" role="alert">Lost contact with the server; showing the last plan.</p>}
      </header>

      <main className="panels">
        <section className="panel panel-chart" aria-labelledby="chart-title">
          <div className="panel-head">
            <h2 id="chart-title">{weekdayName(plan.day)}, hour by hour</h2>
            <ul className="legend" aria-label="Chart key">
              <li><i className="key key-line" />Buyer demand <Tag kind="STAND-IN" /></li>
              <li><i className="key key-sun" />Solar used</li>
              <li><i className="key key-hatch" />Grid top-up</li>
              {plan.totals.surplus_kwh > 0 && <li><i className="key key-pale" />Unused solar</li>}
            </ul>
          </div>
          <DayChart plan={plan} onHourHover={setHoverHour} />
        </section>

        <section className="panel panel-map" aria-labelledby="map-title">
          <div className="panel-head">
            <h2 id="map-title">Site plan at {hourName(mapHour)}</h2>
            <Tag kind="EXAMPLE" />
          </div>
          <SiteMap plan={plan} hour={mapHour} />
          <p className="map-key">
            <span><i className="key key-roof" />Rooftops, size = solar {hourRange(mapHour)}</span>
            <span><i className="key key-buyer" />Buyer, amber = share met by solar</span>
            <span className="map-key-range">All within 5 km</span>
          </p>
        </section>
      </main>

      <Particulars plan={plan} />
    </div>
  );
}
