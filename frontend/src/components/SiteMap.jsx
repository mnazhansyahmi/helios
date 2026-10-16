import { useEffect, useMemo } from "react";
import L from "leaflet";
import { AttributionControl, CircleMarker, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

/** Keeps every example site in view, also after the panel changes size (projector, window resize). */
function FitToSites({ bounds }) {
  const map = useMap();
  useEffect(() => {
    // No animation: an animated zoom that gets interrupted by the next resize leaves sites off-screen.
    const fit = () => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, { padding: [28, 28], animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, bounds]);
  return null;
}

/**
 * Site plan of the EXAMPLE rooftops and buyers for one hour.
 *  - rooftop circle size = solar from that rooftop group in this hour
 *  - buyer square fills amber with the share of its need covered by solar in this hour
 * Map tiles (OpenStreetMap) need internet; offline, the markers still show on a blank ground.
 */
export default function SiteMap({ plan, hour }) {
  const row = plan.hours[hour];
  const maxRoofKwh = useMemo(
    () => Math.max(1, ...plan.hours.flatMap((h) => Object.values(h.rooftops_kwh))),
    [plan.hours]
  );
  const sites = [...plan.rooftops, ...plan.buyers];
  const bounds = useMemo(
    () => L.latLngBounds(sites.map((s) => [s.lat, s.lon])),
    // the example sites never move
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  // Buyers west of the middle get their label on the left, so labels don't pile up.
  const middleLon = (bounds.getWest() + bounds.getEast()) / 2;

  return (
    <MapContainer bounds={bounds} className="site-map" zoomControl={false}
                  scrollWheelZoom={false} attributionControl={false}>
      <FitToSites bounds={bounds} />
      <AttributionControl position="bottomright" prefix={false} />
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {plan.rooftops.map((r) => {
        const kwh = row.rooftops_kwh[r.id] ?? 0;
        return (
          <CircleMarker key={r.id} center={[r.lat, r.lon]}
                        radius={kwh > 0 ? 4 + 10 * Math.sqrt(kwh / maxRoofKwh) : 4}
                        pathOptions={{ color: "#13212E", weight: 1.5, fillColor: "#F2A900", fillOpacity: kwh > 0 ? 0.95 : 0 }} />
        );
      })}
      {plan.buyers.map((b) => {
        const need = row.buyers[b.id];
        const pct = need.demand_kwh > 0 ? Math.round((100 * need.solar_used_kwh) / need.demand_kwh) : 0;
        const side = b.lon < middleLon ? "left" : "right";
        const icon = L.divIcon({
          className: `buyer-marker buyer-marker-${side}`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          html: `<span class="buyer-pin"><span class="buyer-fill" style="height:${pct}%"></span></span>`
              + `<span class="buyer-name">${b.name} <b>${pct}%</b></span>`,
        });
        return <Marker key={b.id} position={[b.lat, b.lon]} icon={icon} keyboard={false}
                       title={`${b.name}: ${pct}% solar this hour`} />;
      })}
    </MapContainer>
  );
}
