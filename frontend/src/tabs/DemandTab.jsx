import MiniCurve from "../components/MiniCurve.jsx";
import Tag from "../components/Tag.jsx";
import { hourName, kwh, number, weekdayName } from "../format.js";

/** Tab 3, "Demand": the planned day's demand for each buyer building, and how accurate the model is. */
export default function DemandTab({ plan, accuracy }) {
  const day = weekdayName(plan.day);
  const series = plan.buyers.map((b) => ({ ...b, values: plan.hours.map((h) => h.buyers[b.id].demand_kwh) }));
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const d = accuracy?.demand;
  const irma = d?.sensitivity_hurricane_irma?.irma_week_only;
  const meter = d?.methods?.model_with_meter_data;

  return (
    <div className="tab tab-page" id="panel-demand" role="tabpanel" aria-labelledby="tab-demand">
      <header className="page-head">
        <h1>{day}'s demand, three example buyer buildings <Tag kind="STAND-IN" /></h1>
        <p>
          One ML model per building (hour, weekday, Selangor holidays, temperature, humidity), trained on real
          buildings in Orlando, Florida that stand in for Elmina buildings. Same kWh scale for all three.
        </p>
      </header>
      <div className="page-body">
        <section className="card-grid card-grid-3" aria-label="Demand per buyer building">
          {series.map((s) => (
            <article className="card" key={s.id}>
              <h2>{s.name}</h2>
              <p className="card-total"><strong>{number(s.demand_kwh)}</strong> kWh for the day · peaks at {hourName(s.peak_hour)}</p>
              <p className="card-note">{s.note}</p>
              <MiniCurve values={s.values} max={max} from={0} to={23} tone="ink" ticks={[0, 6, 12, 18]}
                         label={`${s.name}: ${number(s.demand_kwh)} kWh for the day`} />
            </article>
          ))}
        </section>

        <aside className="page-side">
          <p className="side-sentence">{plan.accuracy.demand.sentence}</p>
          <p className="side-small">{plan.accuracy.demand.small_print}</p>
          {d && (
            <table className="mae-table">
              <caption>Average error per hour (kWh), held-out Jul–Dec 2017; lower is better</caption>
              <thead>
                <tr><th scope="col">Building</th><th scope="col">ML model</th><th scope="col">Same hour last week</th><th scope="col">Hour-of-week average</th></tr>
              </thead>
              <tbody>
                {Object.entries(d.per_buyer).map(([name, m]) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td className="is-model">{m.model.mae_kwh.toFixed(1)}</td>
                    <td>{m.last_week.mae_kwh.toFixed(1)}</td>
                    <td>{m.hour_of_week_average.mae_kwh.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ul className="caveats">
            <li>Stand-ins: real Florida buildings; Elmina usage habits (e.g. Hari Raya) will differ.</li>
            <li>Tested with measured temperatures; a real temperature forecast adds some error.</li>
            {irma && (
              <li>Hurricane Irma week (Sep 2017): {irma.model.mae_kwh.toFixed(0)} kWh error vs {irma.hour_of_week_average.mae_kwh.toFixed(0)} for
                the plain average. The model cannot know about closures.</li>
            )}
            {meter && (
              <li>With live meter readings the error falls to {meter.mae_kwh.toFixed(0)} kWh: this needs SDP's own meter data.</li>
            )}
          </ul>
          <p className="side-small">{day}'s buyer demand: {kwh(plan.totals.demand_kwh)} across the three buildings.</p>
        </aside>
      </div>
    </div>
  );
}
