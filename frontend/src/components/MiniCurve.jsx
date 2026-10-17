import { hourName } from "../format.js";

/**
 * A small hourly curve (used in the Solar and Demand tabs). Every curve on a tab gets the
 * same `max`, so their sizes compare directly. tone: "sun" (amber area) or "ink" (demand line).
 */
export default function MiniCurve({ values, max, from = 0, to = 23, tone = "sun", ticks = [6, 12, 18], label }) {
  const span = to - from;
  const x = (h) => ((h - from) / span) * 100;
  const y = (v) => 100 - (v / max) * 92; // 8% headroom
  const points = values.slice(from, to + 1).map((v, i) => `${x(from + i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L100,100 L0,100 Z`;
  return (
    <div className="mini">
      <svg className="mini-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label}>
        <path d={area} className={`mini-area mini-area-${tone}`} />
        <path d={line} className={`mini-line mini-line-${tone}`} vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="100" x2="100" y2="100" className="mini-base" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mini-axis" aria-hidden="true">
        {ticks.map((h) => (
          // labels at the very edge align inwards so they never spill past the card
          <span key={h} style={{ left: `${x(h)}%`, transform: x(h) <= 0 ? "none" : x(h) >= 100 ? "translateX(-100%)" : undefined }}>
            {hourName(h)}
          </span>
        ))}
      </div>
    </div>
  );
}
