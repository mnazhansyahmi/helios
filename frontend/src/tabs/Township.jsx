import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * The Overview's 3D township: an EXAMPLE, not a model of Elmina.
 * 8 blocks of houses (one block per example rooftop type) around 3 buyer buildings.
 *  - house panels glow amber with that hour's solar (one roof of that type)
 *  - buyer buildings fill amber from the ground up by their solar share; the rest is hatched (grid)
 * Everything is generated in code (no downloaded models or textures) and drawn only when the
 * hour or the size changes, so it stays light on a normal laptop. If WebGL fails, onFail() is
 * called and the Overview shows the 2D site plan instead.
 */
const INK = 0x13212e;
const SUN = 0xf2a900;
const PANEL_OFF = new THREE.Color(0x2b3a48);
const PANEL_ON = new THREE.Color(SUN);
const HOUSES_PER_BLOCK = 8;                 // 4 across, 2 deep
const BLOCK_X = [-45, -15, 15, 45];
const BLOCK_Z = [-23, 23];                  // far row: types 1-4, near row: types 5-8
const BUYER_LAYOUT = [                      // tidy made-up layout: x position, footprint (w x d), height
  { x: -21, w: 8, d: 8, h: 14 },            // Office A
  { x: 0, w: 14, d: 9, h: 9 },              // Retail building: wide and low
  { x: 21, w: 10, d: 10, h: 18 },           // Office B
];
const VIEW_FROM = new THREE.Vector3(0.26, 0.53, 0.81).normalize(); // from the front-right, above
const LOOK_AT = new THREE.Vector3(0, 3, 0);
// Points the camera must keep in view: the corners of the housing, and room above each buyer for its label
const FRAME_POINTS = [
  ...[-57, 57].flatMap((x) => [0, 6].flatMap((y) => [-29, 29].map((z) => new THREE.Vector3(x, y, z)))),
  ...BUYER_LAYOUT.map((b) => new THREE.Vector3(b.x, b.h + 8, 0)),
];
const ROOF_PITCH = Math.atan2(2, 2.4);      // the pyramid roofs below: 2 high over a 2.4 half-width

const lerp = (a, b, f) => a + (b - a) * f;
/** Value of an hourly series at a fractional hour (e.g. 14.5 = halfway between 2pm and 3pm). */
const at = (series, t) => {
  const h0 = Math.max(0, Math.min(23, Math.floor(t)));
  const h1 = Math.min(23, h0 + 1);
  return lerp(series[h0], series[h1], t - h0);
};

/** Diagonal ink hatching on white (the 2D charts' "grid" pattern), drawn on a canvas. */
function hatchTexture(repeatX, repeatY) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = "#13212e"; g.lineWidth = 5;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function flat(w, d, color, x, z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color })); // unlit: flat plan colours
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.02, z);
  return mesh;
}

function buildScene(typeCount) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeceef0);
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));   // three.js light units: about 70% of full colour
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(sun);

  // ground, roads and the plaza the buyer buildings stand on
  for (const z of [-14, 14]) scene.add(flat(124, 4, 0xd3d8dc, 0, z));
  for (const x of [-30, 0, 30]) for (const z of [-23, 23]) scene.add(flat(3, 14, 0xd3d8dc, x, z));
  scene.add(flat(70, 20, 0xe0e3e6, 0, 0));

  // Houses: one block of 4 x 2 houses per example rooftop type (instanced = one draw call each)
  const count = typeCount * HOUSES_PER_BLOCK;
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshLambertMaterial({ color: 0xfbfaf6 }), count);
  const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(3.4, 2, 4), new THREE.MeshLambertMaterial({ color: 0x9aa2a9 }), count);
  const panel = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 0.12, 1.8), new THREE.MeshBasicMaterial({ color: 0xffffff }), count);
  const m = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const roofTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)); // square to the street
  const panelTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(ROOF_PITCH, 0, 0));  // flat on the front slope
  for (let ti = 0; ti < typeCount; ti += 1) {
    const bx = BLOCK_X[ti % 4];
    const bz = BLOCK_Z[Math.floor(ti / 4) % 2];
    for (let k = 0; k < HOUSES_PER_BLOCK; k += 1) {
      const i = ti * HOUSES_PER_BLOCK + k;
      const x = bx + ((k % 4) - 1.5) * 6;
      const z = bz + (Math.floor(k / 4) - 0.5) * 6;
      body.setMatrixAt(i, m.compose(new THREE.Vector3(x, 1.5, z), new THREE.Quaternion(), one));
      roof.setMatrixAt(i, m.compose(new THREE.Vector3(x, 4, z), roofTurn, one));
      // middle of the front slope (1.2 out, 4 up), lifted a little off the roof
      panel.setMatrixAt(i, m.compose(new THREE.Vector3(x, 4.1, z + 1.3), panelTilt, one));
      panel.setColorAt(i, PANEL_OFF);
    }
  }
  scene.add(body, roof, panel);

  // Buyer buildings: an amber (solar) part at the bottom and a hatched (grid) part above it
  const edgeMat = new THREE.LineBasicMaterial({ color: INK });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xd9dde1 });
  const buyers = BUYER_LAYOUT.map((b) => {
    const solarPart = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1, b.d),
      new THREE.MeshLambertMaterial({ color: SUN, emissive: SUN, emissiveIntensity: 0.3 }));
    const sideX = hatchTexture(b.d / 4, 1);   // walls facing +x/-x are d wide
    const sideZ = hatchTexture(b.w / 4, 1);   // walls facing +z/-z are w wide
    const wallX = new THREE.MeshLambertMaterial({ map: sideX });
    const wallZ = new THREE.MeshLambertMaterial({ map: sideZ });
    const gridPart = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1, b.d), [wallX, wallX, roofMat, roofMat, wallZ, wallZ]);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, b.h, b.d)), edgeMat);
    solarPart.position.set(b.x, 0, 0);
    gridPart.position.set(b.x, 0, 0);
    outline.position.set(b.x, b.h / 2, 0);
    scene.add(solarPart, gridPart, outline);
    return { ...b, solarPart, gridPart, textures: [sideX, sideZ] };
  });
  return { scene, sun, panel, buyers };
}

/**
 * Fit the township to the canvas, whatever its shape. The camera is orthographic (no perspective),
 * like an architect's axonometric drawing: buildings stay upright and the plan stays tidy.
 */
function frame(camera, aspect) {
  camera.position.copy(LOOK_AT).addScaledVector(VIEW_FROM, 300);
  camera.lookAt(LOOK_AT);
  camera.updateMatrixWorld();
  const box = new THREE.Box3();
  for (const p of FRAME_POINTS) box.expandByPoint(p.clone().applyMatrix4(camera.matrixWorldInverse));
  let w = (box.max.x - box.min.x) * 1.04;
  let h = (box.max.y - box.min.y) * 1.12;  // margin for the label (top left) and the key (bottom left)
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const cx = (box.max.x + box.min.x) / 2;
  const cy = (box.max.y + box.min.y) / 2 + h * 0.025; // sit a little low: the top-left label needs the room
  Object.assign(camera, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 });
  camera.updateProjectionMatrix();
}

export default function Township({ plan, t, hour, onFail }) {
  const mountRef = useRef(null);
  const world = useRef(null);
  const [labels, setLabels] = useState([]);
  const typeCount = plan.rooftops.length;

  // Create the renderer and the scene once
  useEffect(() => {
    const mount = mountRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      onFail();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    mount.prepend(renderer.domElement);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
    const built = buildScene(typeCount);
    const lost = (e) => { e.preventDefault(); onFail(); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    world.current = { renderer, camera, ...built, draw: null };

    const fit = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      frame(camera, w / h);
      world.current?.draw?.();
    };
    const observer = new ResizeObserver(fit);
    observer.observe(mount);
    fit();
    return () => {
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      built.scene.traverse((o) => {
        o.geometry?.dispose();
        [o.material].flat().forEach((mat) => { mat?.map?.dispose(); mat?.dispose(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
      world.current = null;
    };
  }, [typeCount, onFail]);

  // Update and draw for the current (fractional) hour
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const maxRoof = Math.max(...plan.rooftops.flatMap((r) => r.hourly_kwh_one_roof), 0.01);
    const series = plan.buyers.map((b) => ({
      demand: plan.hours.map((row) => row.buyers[b.id].demand_kwh),
      used: plan.hours.map((row) => row.buyers[b.id].solar_used_kwh),
    }));
    w.draw = () => {
      // panels: glow with this hour's solar for one roof of each type (dark when no rooftops join)
      w.panel.visible = plan.scenario.rooftops > 0;
      plan.rooftops.forEach((r, ti) => {
        const glow = Math.max(0, at(r.hourly_kwh_one_roof, t) / maxRoof);
        const color = PANEL_OFF.clone().lerp(PANEL_ON, Math.pow(glow, 0.8));
        for (let k = 0; k < HOUSES_PER_BLOCK; k += 1) w.panel.setColorAt(ti * HOUSES_PER_BLOCK + k, color);
      });
      w.panel.instanceColor.needsUpdate = true;

      // buyer buildings: solar share at the bottom (amber), grid on top (hatched).
      // The heights move smoothly with t; the labels show the same hour as the big line above.
      const next = plan.buyers.map((b, i) => {
        const B = w.buyers[i];
        const demand = at(series[i].demand, t);
        const share = demand > 0 ? Math.min(1, at(series[i].used, t) / demand) : 0;
        const hs = Math.max(0.001, B.h * share);
        const hg = Math.max(0.001, B.h - hs);
        B.solarPart.scale.y = hs; B.solarPart.position.y = hs / 2;
        B.gridPart.scale.y = hg; B.gridPart.position.y = hs + hg / 2;
        B.textures.forEach((tex) => { tex.repeat.y = hg / 4; });
        const row = plan.hours[hour].buyers[b.id];
        const pct = row.demand_kwh > 0 ? Math.round((100 * Math.min(row.solar_used_kwh, row.demand_kwh)) / row.demand_kwh) : 0;
        const p = new THREE.Vector3(B.x, B.h, 0).project(w.camera);
        return { id: b.id, name: b.name, pct, x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      });

      // the sun crosses from east (6am) to west (6pm); faces facing it get a little brighter
      const arc = Math.PI * Math.min(1, Math.max(0, (t - 6) / 12));
      w.sun.position.set(Math.cos(arc) * 80, 10 + Math.sin(arc) * 70, 30);
      w.sun.intensity = 0.3 + 1.2 * Math.sin(arc);

      w.renderer.render(w.scene, w.camera);
      setLabels(next);
    };
    w.draw();
  }, [plan, t, hour]);

  return (
    <div className="township" ref={mountRef}>
      {labels.map((l) => (
        <span key={l.id} className="township-label" style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%` }}>
          {l.name} <b>{l.pct}%</b>
        </span>
      ))}
      <p className="township-key">
        <span><i className="key key-sun" />Panels glow with each hour's solar</span>
        <span><i className="key key-sun" /><i className="key key-hatch" />Buyer buildings: amber = share from solar, hatched = from the grid</span>
        {/* on phones the floating labels would overlap, so the shares are listed here instead */}
        <span className="township-shares">{labels.map((l) => `${l.name} ${l.pct}%`).join(" · ")}</span>
      </p>
    </div>
  );
}
