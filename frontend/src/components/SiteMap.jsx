import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { AttributionControl, Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

const INK = "#13212E";
const SUN = "#F2A900";
const METERS_PER_DEG_LAT = 111320;

/** Box around a point, `radiusM` metres in every direction (used to frame the ring). */
function boundsAround(lat, lon, radiusM) {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLon = radiusM / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return L.latLngBounds([lat - dLat, lon - dLon], [lat + dLat, lon + dLon]);
}

/** Rooftop circle radius in METRES (so it scales with the map): bigger = more solar this hour. */
const roofRadiusM = (kwh, maxKwh) => (kwh > 0 ? 70 + 230 * Math.sqrt(kwh / maxKwh) : 70);

/** Keeps the whole ring in view, also after the panel changes size (projector, window resize). */
function FitToRing({ bounds }) {
  const map = useMap();
  useEffect(() => {
    // No animation: an animated zoom that gets interrupted by the next resize leaves sites off-screen.
    const fit = () => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, { padding: [12, 12], animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, bounds]);
  return null;
}

// ---------------------------------------------------------------------------
// Buyer labels: each one tries right, left, above, below and takes the side that
// covers the fewest rooftop dots, buyer squares and already-placed labels.
// ---------------------------------------------------------------------------
const LABEL_GAP = 16;           // px from the buyer's centre to the near edge of a close label
const LEADER_GAPS = [48, 84];   // further-out spots, joined to the marker by a thin leader line

const labelFontPx = () => Math.min(17, Math.max(12, window.innerWidth * 0.009)); // matches .buyer-name
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
function circleHitsBox(c, box) {
  const nx = Math.max(box.x0, Math.min(c.x, box.x1));
  const ny = Math.max(box.y0, Math.min(c.y, box.y1));
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r ** 2;
}

/** Real rendered width of a label (measured with the page's own font), plus padding and border. */
let measureCtx = null;
function labelWidthPx(text, font) {
  measureCtx = measureCtx || document.createElement("canvas").getContext("2d");
  measureCtx.font = `700 ${font}px "Archivo Variable", Archivo, sans-serif`;
  return measureCtx.measureText(text).width + 14;
}

/**
 * Candidate spots, best first: close to the marker straight out to the right/left/top/bottom,
 * then nudged up/down (left/right) or sideways (top/bottom), then further out on a leader line.
 * `shift` moves the label's centre line; `gap` is the distance from the buyer's centre.
 */
const SIDES = ["right", "left", "top", "bottom"];
function candidates(w, h) {
  const out = SIDES.map((side) => ({ side, shift: 0, gap: LABEL_GAP }));
  for (const side of ["right", "left"]) for (const s of [-0.8 * h, 0.8 * h]) out.push({ side, shift: s, gap: LABEL_GAP });
  for (const side of ["top", "bottom"]) for (const s of [-w / 3, w / 3]) out.push({ side, shift: s, gap: LABEL_GAP });
  for (const gap of LEADER_GAPS) for (const side of SIDES) out.push({ side, shift: 0, gap });
  return out;
}
function labelBox({ side, shift, gap }, p, w, h) {
  if (side === "right") return { x0: p.x + gap, x1: p.x + gap + w, y0: p.y + shift - h / 2, y1: p.y + shift + h / 2 };
  if (side === "left") return { x0: p.x - gap - w, x1: p.x - gap, y0: p.y + shift - h / 2, y1: p.y + shift + h / 2 };
  if (side === "top") return { x0: p.x + shift - w / 2, x1: p.x + shift + w / 2, y0: p.y - gap - h, y1: p.y - gap };
  return { x0: p.x + shift - w / 2, x1: p.x + shift + w / 2, y0: p.y + gap, y1: p.y + gap + h };
}

/** The label (and its leader line, for far spots) positioned inside the 24x24 marker box. */
function labelHtml({ side, shift, gap }, name, pct) {
  const c = 12; // the marker's centre within its box
  const pos = {
    right: `left:${c + gap}px;top:${c + shift}px;transform:translateY(-50%)`,
    left: `right:${c + gap}px;top:${c + shift}px;transform:translateY(-50%)`,
    top: `bottom:${c + gap}px;left:${c + shift}px;transform:translateX(-50%)`,
    bottom: `top:${c + gap}px;left:${c + shift}px;transform:translateX(-50%)`,
  }[side];
  const len = gap - c; // from the marker's edge to the label
  const leader = gap > LABEL_GAP ? {
    right: `left:24px;top:${c}px;width:${len}px;height:1px`,
    left: `right:24px;top:${c}px;width:${len}px;height:1px`,
    top: `bottom:24px;left:${c}px;width:1px;height:${len}px`,
    bottom: `top:24px;left:${c}px;width:1px;height:${len}px`,
  }[side] : null;
  return (leader ? `<span class="buyer-leader" style="${leader}"></span>` : "")
    + `<span class="buyer-name" style="${pos}">${name} <b>${pct}%</b></span>`;
}

function LabelPlacer({ buyers, roofs, onPlace }) {
  const map = useMap();
  useEffect(() => {
    const place = () => {
      const size = map.getSize();
      const metersPerPixel = (40075016.686 * Math.cos((map.getCenter().lat * Math.PI) / 180))
        / (256 * 2 ** map.getZoom());
      const font = labelFontPx();
      const point = (s) => map.latLngToContainerPoint([s.lat, s.lon]);
      const dots = roofs.map((r) => ({ ...point(r), r: r.radiusM / metersPerPixel + 3 }));
      const squares = buyers.map((b) => { const p = point(b); return { x0: p.x - 14, x1: p.x + 14, y0: p.y - 14, y1: p.y + 14 }; });
      const placed = [];
      const sides = {};
      buyers.forEach((b, i) => {
        const p = point(b);
        const w = labelWidthPx(b.label, font);
        const h = font * 1.3 + 4;
        let best = null;
        for (const spot of candidates(w, h)) {
          const box = labelBox(spot, p, w, h);
          let score = dots.filter((d) => circleHitsBox(d, box)).length;
          if (spot.gap > LABEL_GAP) {
            // a leader line running through a rooftop dot reads as if the dot belonged to it
            const lead = { right: { x0: p.x + 12, x1: box.x0, y0: p.y - 1, y1: p.y + 1 },
                           left: { x0: box.x1, x1: p.x - 12, y0: p.y - 1, y1: p.y + 1 },
                           top: { x0: p.x - 1, x1: p.x + 1, y0: box.y1, y1: p.y - 12 },
                           bottom: { x0: p.x - 1, x1: p.x + 1, y0: p.y + 12, y1: box.y0 } }[spot.side];
            score += dots.filter((d) => circleHitsBox(d, lead)).length;
          }
          score += 2 * squares.filter((s, j) => j !== i && overlap(s, box)).length;
          score += 3 * placed.filter((q) => overlap(q, box)).length;
          if (box.x0 < 0 || box.y0 < 0 || box.x1 > size.x || box.y1 > size.y) score += 5;
          if (spot.shift !== 0) score += 0.1;                    // prefer straight-out labels...
          if (spot.gap > LABEL_GAP) score += 0.2 * (spot.gap / 48); // ...and close ones, when equally clear
          if (!best || score < best.score) best = { spot, score, box };
        }
        sides[b.id] = best.spot;
        placed.push(best.box);
      });
      onPlace(sides);
    };
    place();
    map.on("zoomend moveend resize", place);
    return () => map.off("zoomend moveend resize", place);
  }, [map, buyers, roofs, onPlace]);
  return null;
}

/**
 * Site plan of the EXAMPLE rooftops and buyers for one hour.
 *  - the ring: the matching distance (5 km) around the buyers' centre
 *  - rooftop circle size = solar from that rooftop group in this hour
 *  - buyer square fills amber with the share of its need covered by solar in this hour
 * Map tiles (OpenStreetMap) need internet; offline, the markers still show on a blank ground.
 */
export default function SiteMap({ plan, hour }) {
  const row = plan.hours[hour];
  const ringM = plan.match_distance_km * 1000;
  const maxRoofKwh = useMemo(
    () => Math.max(1, ...plan.hours.flatMap((h) => Object.values(h.rooftops_kwh))),
    [plan.hours]
  );

  // The ring sits on the buyers' centre; the map frames the whole ring.
  const centre = useMemo(() => ({
    lat: plan.buyers.reduce((s, b) => s + b.lat, 0) / plan.buyers.length,
    lon: plan.buyers.reduce((s, b) => s + b.lon, 0) / plan.buyers.length,
  }), [plan.buyers]);
  const ringBounds = useMemo(() => boundsAround(centre.lat, centre.lon, ringM), [centre, ringM]);

  const roofs = useMemo(() => plan.rooftops.map((r) => ({
    ...r, kwh: row.rooftops_kwh[r.id] ?? 0, radiusM: roofRadiusM(row.rooftops_kwh[r.id] ?? 0, maxRoofKwh),
  })), [plan.rooftops, row, maxRoofKwh]);

  const buyers = useMemo(() => plan.buyers.map((b) => {
    const need = row.buyers[b.id];
    const pct = need.demand_kwh > 0 ? Math.round((100 * need.solar_used_kwh) / need.demand_kwh) : 0;
    return { ...b, pct, label: `${b.name} ${pct}%` };
  }), [plan.buyers, row]);

  const [sides, setSides] = useState({});
  const onPlace = useCallback((next) => {
    const same = (a, b) => a && b && a.side === b.side && a.gap === b.gap && Math.abs(a.shift - b.shift) < 0.5;
    setSides((prev) => (Object.keys(next).every((k) => same(prev[k], next[k])) ? prev : next));
  }, []);

  const ringLabel = L.divIcon({
    className: "ring-marker", iconSize: [0, 0], iconAnchor: [0, 0],
    html: `<span class="ring-label">${plan.match_distance_km} km from the buyers' centre</span>`,
  });

  return (
    <MapContainer bounds={ringBounds} className="site-map" zoomControl={false} zoomSnap={0.25}
                  scrollWheelZoom={false} attributionControl={false}>
      <FitToRing bounds={ringBounds} />
      <LabelPlacer buyers={buyers} roofs={roofs} onPlace={onPlace} />
      <AttributionControl position="bottomright" prefix={false} />
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Circle center={[centre.lat, centre.lon]} radius={ringM} interactive={false}
              pathOptions={{ color: INK, weight: 1.5, opacity: 0.75, fill: false }} />
      <Marker position={[centre.lat + ringM / METERS_PER_DEG_LAT, centre.lon]} icon={ringLabel}
              interactive={false} keyboard={false} />
      {roofs.map((r) => (
        <Circle key={r.id} center={[r.lat, r.lon]} radius={r.radiusM} interactive={false}
                pathOptions={{ color: INK, weight: 1.5, fillColor: SUN, fillOpacity: r.kwh > 0 ? 0.95 : 0 }} />
      ))}
      {buyers.map((b) => {
        const icon = L.divIcon({
          className: "buyer-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          html: `<span class="buyer-pin"><span class="buyer-fill" style="height:${b.pct}%"></span></span>`
              + labelHtml(sides[b.id] ?? { side: "right", shift: 0, gap: LABEL_GAP }, b.name, b.pct),
        });
        return <Marker key={b.id} position={[b.lat, b.lon]} icon={icon} keyboard={false}
                       title={`${b.name}: ${b.pct}% solar this hour`} />;
      })}
    </MapContainer>
  );
}
