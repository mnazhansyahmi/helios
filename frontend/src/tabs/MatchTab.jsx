import { useState } from "react";
import Controls from "../components/Controls.jsx";
import DayChart from "../components/DayChart.jsx";
import Headline from "../components/Headline.jsx";
import Particulars from "../components/Particulars.jsx";
import SiteMap from "../components/SiteMap.jsx";
import Tag from "../components/Tag.jsx";
import { hourName, hourRange, weekdayName } from "../format.js";

/** Tab 4, "Match": the original one-screen dashboard (its top row now lives in the shared TopBar). */
export default function MatchTab({ plan, rooftops, onRooftops, error }) {
  const [hoverHour, setHoverHour] = useState(null);
  const mapHour = hoverHour ?? plan.peaks.solar_hour ?? 12;

  return (
    <div className="tab tab-match">
      <header className="band band-match">
        <Headline plan={plan} />
        <Controls scenario={plan.scenario} rooftops={rooftops} onChange={onRooftops} />
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
            <span className="map-key-range">
              <i className="key key-ring" />{plan.match_distance_km} km ring; every rooftop–buyer pair is within {plan.match_distance_km} km
            </span>
          </p>
        </section>
      </main>

      <Particulars plan={plan} />
    </div>
  );
}
