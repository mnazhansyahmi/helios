import Tag from "../components/Tag.jsx";

/** Tab 5, "About the data": what is real, what is made up, what stands in, and where it comes from. */
export default function AboutTab({ plan }) {
  const km = plan.match_distance_km;
  return (
    <div className="tab tab-page" id="panel-about" role="tabpanel" aria-labelledby="tab-about">
      <header className="page-head">
        <h1>About the data</h1>
        <p>Planning prototype for CREAM, City of Elmina. Helios plans; TNB runs the grid. Every figure on screen carries one of three tags.</p>
      </header>
      <div className="about-body">
        <section className="about-cols" aria-label="Data labels">
          <article className="about-col">
            <h2><Tag kind="REAL" /> Public measured or forecast data</h2>
            <ul>
              <li>Weather forecast: Open-Meteo, ECMWF model</li>
              <li>Sunlight that actually arrived (accuracy tests): Himawari satellite</li>
              <li>Building meter readings: Building Data Genome 2</li>
              <li>Grid emission factor: {plan.carbon_factor.kg_per_kwh.toFixed(3)} kg CO<sub>2</sub> per kWh, Energy Commission Malaysia, Peninsular 2024 (provisional)</li>
              <li>Selangor public holidays; OpenStreetMap base map</li>
            </ul>
          </article>
          <article className="about-col">
            <h2><Tag kind="EXAMPLE" /> Made up for this demo</h2>
            <ul>
              <li>Rooftop locations, sizes and directions</li>
              <li>Buyer building locations (all within {km} km)</li>
              <li>How many rooftops join: the scenario slider, not a CREAM figure</li>
              <li>The 3D township on the Overview tab: example houses and buildings, not a model of Elmina</li>
            </ul>
          </article>
          <article className="about-col">
            <h2><Tag kind="STAND-IN" /> Real data from elsewhere</h2>
            <ul>
              <li>Buyer demand: three real buildings in Orlando, Florida (hot, humid summers) standing in for Elmina buildings</li>
              <li>No public hourly data exists for Malaysian buildings, so these show usage shapes, not SDP's buildings</li>
            </ul>
          </article>
        </section>
        <section className="about-limits" aria-label="Limits and sources">
          <div>
            <h2>Honest limits</h2>
            <ul>
              <li>No public CREAM meter data: solar accuracy is checked against satellite estimates, not rooftop meters.</li>
              <li>Accuracy falls with lead time: a Monday plan made on a Friday is only slightly better than an average day.</li>
              <li>Matching is an accounting split for planning; electricity flows through TNB's grid.</li>
              <li>Open-Meteo's free tier is non-commercial; a real deployment needs a commercial weather licence.</li>
            </ul>
          </div>
          <div>
            <h2>Sources and licences</h2>
            <ul className="sources">
              {plan.sources.map((s) => <li key={s}>{s}</li>)}
              <li>Software: FastAPI, pvlib, scikit-learn, React, Recharts, Leaflet, three.js (open source)</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
