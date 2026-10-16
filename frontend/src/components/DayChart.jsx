import { useEffect, useRef, useState } from "react";
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceDot, Tooltip, XAxis, YAxis,
} from "recharts";
import { hourName, hourRange, kwh, number } from "../format.js";

// Colours (match the CSS tokens in styles.css)
const SUN = "#F2A900";
const SUN_EDGE = "#B97F00";
const SUN_PALE = "#FCE7A6";
const INK = "#13212E";
const GRID_LINE = "#E3E6E9";

/** Round an axis maximum up to a tidy number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 x a power of ten). */
function niceCeil(value) {
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * power).find((v) => v >= value);
}

// Respect the "reduce motion" setting: no chart animation for people who asked for none.
const ANIMATE = typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Text label for a ReferenceDot: several lines, placed above the dot,
 * extending left ("end") or right ("start") so neighbouring callouts never overlap.
 */
function callout(lines, anchor, { dx = 0, dy = -16 } = {}) {
  const lineHeightEm = 1.3; // em units, so spacing scales with the projector-sized font
  return function CalloutLabel({ viewBox }) {
    const x = viewBox.x + viewBox.width / 2 + dx;
    const y = viewBox.y + viewBox.height / 2 + dy;
    return (
      <text x={x} y={y} textAnchor={anchor} className="callout">
        {lines.map((line, i) => (
          <tspan key={i} x={x} className={i === 0 ? "callout-lead" : undefined}
                 dy={i === 0 ? `${-(lines.length - 1) * lineHeightEm}em` : `${lineHeightEm}em`}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };
}

/** A plain label drawn straight onto a chart region (no dot). */
function regionLabel(text, className) {
  return function RegionLabel({ viewBox }) {
    return (
      <text x={viewBox.x + viewBox.width / 2} y={viewBox.y + viewBox.height / 2}
            textAnchor="middle" dominantBaseline="middle" className={className}>
        {text}
      </text>
    );
  };
}

function HourTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tip">
      <p className="tip-hour">{hourRange(row.hour)}</p>
      <dl>
        <div><dt><i className="key key-line" />Buyer demand</dt><dd>{kwh(row.demand_kwh)}</dd></div>
        <div><dt><i className="key key-sun" />Solar used</dt><dd>{kwh(row.solar_used_kwh)}</dd></div>
        <div><dt><i className="key key-hatch" />Grid top-up</dt><dd>{kwh(row.grid_topup_kwh)}</dd></div>
        {row.surplus_kwh > 0 && (
          <div><dt><i className="key key-pale" />Unused solar</dt><dd>{kwh(row.surplus_kwh)}</dd></div>
        )}
      </dl>
    </div>
  );
}

/** Measures the chart box, so the chart is drawn at exactly its size (also after a resize). */
function useBoxSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

/**
 * Smoothly moves the chart from the old numbers to the new ones (the amber area "rises"
 * when the preset is pressed). Our own tween instead of Recharts' animation, which stalls
 * after a redraw. Like the headline count-up, it always lands on the true numbers.
 */
const TWEEN_FIELDS = ["solar_kwh", "demand_kwh", "solar_used_kwh", "grid_topup_kwh", "surplus_kwh"];

function useTweenedRows(rows, durationMs = 450) {
  const [shown, setShown] = useState(rows);
  const shownRef = useRef(rows);
  useEffect(() => {
    const from = shownRef.current;
    const unchanged = from.length === rows.length
      && from.every((r, i) => TWEEN_FIELDS.every((f) => r[f] === rows[i][f]));
    if (!ANIMATE || unchanged || from.length !== rows.length) {
      shownRef.current = rows;
      setShown(rows);
      return undefined;
    }
    const blend = (t) => rows.map((r, i) => {
      const row = { ...r };
      for (const f of TWEEN_FIELDS) row[f] = from[i][f] + (r[f] - from[i][f]) * t;
      return row;
    });
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const next = t === 1 ? rows : blend(1 - Math.pow(2, -10 * t)); // exponential ease-out
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const settle = setTimeout(() => {   // safety net if animation frames are paused
      cancelAnimationFrame(frame);
      shownRef.current = rows;
      setShown(rows);
    }, durationMs + 50);
    return () => { cancelAnimationFrame(frame); clearTimeout(settle); };
  }, [rows, durationMs]);
  return shown;
}

export default function DayChart({ plan, onHourHover }) {
  const [boxRef, { width, height }] = useBoxSize();
  const narrow = width > 0 && width < 520; // phones: fewer ticks, no region labels
  const yAxisWidth = narrow ? 48 : 64;
  const rows = plan.hours;
  const shownRows = useTweenedRows(rows); // what is drawn; annotations use the final numbers
  const { peaks } = plan;
  const maxDemand = Math.max(...rows.map((r) => r.demand_kwh));
  const maxSolar = Math.max(...rows.map((r) => r.solar_kwh));
  // Fixed headroom over demand, so the amber area visibly grows as the slider moves.
  const yMax = niceCeil(Math.max(maxDemand * 1.3, maxSolar * 1.08, 1));

  // Callout 1: the solar peak (left of the dot)
  const solarRow = peaks.solar_hour == null ? null : rows[peaks.solar_hour];
  // Callout 2: the afternoon demand peak and its grid top-up (right of the dot)
  const peakRow = rows[peaks.afternoon_demand_hour];
  const gapAtPeak = peaks.grid_topup_at_afternoon_demand_peak_kwh;
  const peakLines = gapAtPeak >= 1
    ? [`${hourName(peakRow.hour)}: demand peaks`, `${kwh(gapAtPeak)} from the grid`]
    : [`${hourName(peakRow.hour)}: demand peaks`, "fully covered by solar"];

  // Does the afternoon callout fit to the RIGHT of its dot? (late peaks on small screens don't)
  // If not, it flips to the left, and the solar callout's text is dropped so the two can't overlap.
  const calloutFontPx = Math.min(21, Math.max(14, window.innerWidth * 0.0105)); // matches .callout in CSS
  const plotLeft = 4 + yAxisWidth;
  const plotRight = width - (narrow ? 12 : 28);
  const peakX = plotLeft + (peakRow.hour / 23) * (plotRight - plotLeft);
  const calloutWidthPx = Math.max(...peakLines.map((line) => line.length)) * calloutFontPx * 0.55;
  const afternoonFitsRight = peakX + 12 + calloutWidthPx <= width;

  // Direct label inside the hatching, at the daylight-afternoon hour with the biggest gap
  const gapRow = rows.filter((r) => r.hour >= 13 && r.hour <= 18)
    .reduce((best, r) => (r.grid_topup_kwh > best.grid_topup_kwh ? r : best));
  const showGapLabel = !narrow && gapRow.grid_topup_kwh > yMax * 0.12;
  // Direct label inside the amber area at noon, when it is tall enough to hold text
  const noon = rows[12];
  const showSunLabel = !narrow && noon.solar_used_kwh > yMax * 0.14;

  return (
    <div className="chart-box" ref={boxRef}>
      <div className="chart-canvas">
      {width > 0 && height > 0 && (
        <ComposedChart
          width={width}
          height={height}
          data={shownRows}
          margin={{ top: 64, right: narrow ? 12 : 28, bottom: 4, left: 4 }}
          onMouseMove={(state) => onHourHover(state?.activeLabel == null ? null : Number(state.activeLabel))}
          onMouseLeave={() => onHourHover(null)}
        >
          <defs>
            {/* Grid top-up texture: ink hatching at 45 degrees */}
            <pattern id="gridHatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="9" height="9" fill="#FFFFFF" />
              <line x1="0" y1="0" x2="0" y2="9" stroke={INK} strokeWidth="2.6" />
            </pattern>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_LINE} />
          <XAxis dataKey="hour" ticks={narrow ? [0, 6, 12, 18] : [0, 3, 6, 9, 12, 15, 18, 21]} tickFormatter={hourName}
                 tickLine={false} axisLine={{ stroke: INK }} interval={0} />
          <YAxis domain={[0, yMax]} tickFormatter={number} tickLine={false} axisLine={false} width={yAxisWidth}
                 label={{ value: "kWh per hour", angle: 0, position: "insideTopLeft", dy: -44, dx: 8, className: "axis-title" }} />
          <Tooltip content={<HourTooltip />} cursor={{ stroke: INK, strokeWidth: 1 }} isAnimationActive={false} />

          {/* Stack: solar used + grid top-up = demand; unused solar sits on top */}
          <Area dataKey="solar_used_kwh" stackId="energy" type="monotone" fill={SUN} fillOpacity={1}
                stroke={SUN_EDGE} strokeWidth={1.5} isAnimationActive={false} />
          <Area dataKey="grid_topup_kwh" stackId="energy" type="monotone" fill="url(#gridHatch)" fillOpacity={1}
                stroke="none" isAnimationActive={false} />
          <Area dataKey="surplus_kwh" stackId="energy" type="monotone" fill={SUN_PALE} fillOpacity={1}
                stroke={SUN_EDGE} strokeWidth={1} strokeDasharray="0" isAnimationActive={false} />
          <Line dataKey="demand_kwh" type="monotone" stroke={INK} strokeWidth={3.5} dot={false}
                activeDot={{ r: 6, fill: INK, stroke: "#FFFFFF", strokeWidth: 2 }} isAnimationActive={false} />

          {showSunLabel && (
            <ReferenceDot x={12} y={noon.solar_used_kwh / 2} r={0} ifOverflow="visible"
                          label={regionLabel("Solar", "region-label region-label-sun")} />
          )}
          {showGapLabel && (
            <ReferenceDot x={gapRow.hour} y={gapRow.solar_used_kwh + gapRow.grid_topup_kwh / 2} r={0}
                          ifOverflow="visible" label={regionLabel("Grid top-up", "region-label region-label-grid")} />
          )}
          {solarRow && (
            <ReferenceDot x={solarRow.hour} y={solarRow.solar_kwh} r={7} fill={SUN} stroke={INK} strokeWidth={2}
                          ifOverflow="visible"
                          label={afternoonFitsRight
                            ? callout([`Solar peaks at ${hourName(solarRow.hour)}`, kwh(solarRow.solar_kwh)], "end", { dx: -12 })
                            : undefined} />
          )}
          <ReferenceDot x={peakRow.hour} y={peakRow.demand_kwh} r={7} fill={INK} stroke="#FFFFFF" strokeWidth={2}
                        ifOverflow="visible"
                        label={afternoonFitsRight ? callout(peakLines, "start", { dx: 12 }) : callout(peakLines, "end", { dx: -12 })} />
        </ComposedChart>
      )}
      </div>

      {/* The same numbers as a table, for screen readers */}
      <div className="sr-only">
      <table>
        <caption>Tomorrow, hour by hour (kWh)</caption>
        <thead><tr><th>Hour</th><th>Demand</th><th>Solar used</th><th>Grid top-up</th><th>Unused solar</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.hour}>
              <td>{hourRange(r.hour)}</td><td>{r.demand_kwh}</td><td>{r.solar_used_kwh}</td>
              <td>{r.grid_topup_kwh}</td><td>{r.surplus_kwh}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
