import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { number } from "../format.js";

/**
 * The Overview's 3D township: an artist's impression, an EXAMPLE, not a model of Elmina.
 * Like the scale model in a property sales gallery: a made-up town on a base, under the sky of the hour.
 *  - 8 groups of houses (one per example rooftop type), terrace rows and landed houses; their roof
 *    panels shine amber with that hour's solar for one roof of the type
 *  - 3 buyer buildings on a central plaza, each with a bar beside it: amber from the bottom for the
 *    share met by solar, hatched above for the grid
 * Models: Kenney city kits (CC0), bundled in public/models/kenney, so it works offline. Textures are
 * recoloured copies with no warm hues, because amber means solar only. Drawn only when the hour
 * or the size changes. If WebGL or the models fail, onFail() shows the 2D site plan instead.
 */
const MODELS = `${import.meta.env.BASE_URL}models/kenney/`;
const SUN = 0xf2a900;
const INK = 0x13212e;
const PANEL_DARK = [0x1c, 0x2c, 0x48];          // a panel with no sun: dark blue cells (sRGB)
const PANEL_LIT = [0xf2, 0xa9, 0x00];           // a panel at the day's peak: pure solar amber (sRGB)

// ------------------------------------------------------------------ the made-up layout
// Kenney units: one road tile = 1, a house is about 1.3 wide. x = east, z = towards the viewer.
const GROUP_X = [-13.5, -4.5, 4.5, 13.5];                         // 4 house groups per row
const ROWS = [{ z: -4.1, facing: 1 }, { z: 4.1, facing: -1 }];   // both rows face the central plaza
const TERRACE = new Set([0, 2, 5, 7]);                            // terrace rows; the others are landed houses
const TERRACE_MODELS = ["building-type-h", "building-type-e"];    // single- and double-storey terraces, 1.3 wide
const LANDED_MODELS = ["building-type-a", "building-type-c", "building-type-g", "building-type-j", "building-type-o", "building-type-s"];
const CROSS_STREETS = [-9, 0, 9];
const BOULEVARD_Z = 2.9;                                          // roads at z = -2.9 and +2.9
const BASE = { w: 39, d: 14 };                                    // the model's base board
const BUYER_LAYOUT = [                                            // which way each label opens, so they never collide
  { model: "commercial/building-n", x: -10, scale: 1.45, side: "left" },            // Office A
  { model: "commercial/building-e", x: 0, scale: 2.3, side: "centre" },             // Retail building: low and wide
  { model: "commercial/building-skyscraper-a", x: 10, scale: 2.1, side: "right" },  // Office B
];
const CARS = ["cars/sedan", "cars/suv", "cars/hatchback-sports", "cars/van"];
const PLAZA_Z = -0.4;
const BAR = { w: 0.85, h: 3.8 };                                  // bar height = 100% of that hour's need
const VIEW_FROM = new THREE.Vector3(0.26, 0.53, 0.81).normalize();
const LOOK_AT = new THREE.Vector3(0, 0.8, 0);

// Sky through the day: cool blues only (amber means solar). [hour, colour at the top of the sky]
const SKY = [[5, "#22304a"], [6, "#7f8fae"], [7, "#aebfd8"], [9, "#c9dcee"], [12, "#cfe4f4"], [15, "#c7dcef"],
  [17, "#b0c3dc"], [18, "#8796b6"], [19, "#4c5b7c"], [20, "#2a3753"], [21, "#1d2840"]];

const lerp = (a, b, f) => a + (b - a) * f;
/** Value of an hourly series at a fractional hour (e.g. 14.5 = halfway between 2pm and 3pm). */
const at = (series, t) => {
  const h0 = Math.max(0, Math.min(23, Math.floor(t)));
  const h1 = Math.min(23, h0 + 1);
  return lerp(series[h0], series[h1], t - h0);
};
function skyAt(t) {
  const i = Math.max(0, SKY.findIndex(([h]) => h > t) - 1);
  const [h0, c0] = SKY[i];
  const [h1, c1] = SKY[Math.min(SKY.length - 1, i + 1)];
  return new THREE.Color(c0).lerp(new THREE.Color(c1), h1 > h0 ? Math.min(1, Math.max(0, (t - h0) / (h1 - h0))) : 0);
}

// ------------------------------------------------------------------ textures drawn in code
function canvasTexture(w, h, paint) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
/** Diagonal ink hatching on white: the grid, as in the 2D chart. */
const hatchTexture = () => {
  const tex = canvasTexture(64, 64, (g) => {
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "#13212e"; g.lineWidth = 6;
    for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};
/** A solar panel's cells and frame lines: cell colour on a frame colour (also used as the glow map). */
const panelTexture = (cell, frame) => canvasTexture(64, 40, (g) => {
  g.fillStyle = cell; g.fillRect(0, 0, 64, 40);
  g.strokeStyle = frame; g.lineWidth = 2;
  for (let x = 0; x <= 64; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 40); g.stroke(); }
  for (let y = 0; y <= 40; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
});
/** Paving joints for the plaza, one slab per road-tile unit. */
const pavingTexture = () => {
  const tex = canvasTexture(64, 64, (g) => {
    g.fillStyle = "#e3e6e9"; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "#cdd2d7"; g.lineWidth = 2;
    g.strokeRect(1, 1, 62, 62);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
};
/** Soft round amber light on the ground at the foot of each bar. */
const glowTexture = () => canvasTexture(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(242,169,0,0.9)"); r.addColorStop(1, "rgba(242,169,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});

// ------------------------------------------------------------------ models
/** One geometry + material per model file (all its parts merged), ready to draw many times at once. */
async function loadModels(names) {
  THREE.Cache.enabled = true; // each pack's texture is fetched once
  const loader = new GLTFLoader();
  const entries = await Promise.all(names.map(async (name) => {
    const gltf = await loader.loadAsync(`${MODELS}${name}.glb`);
    gltf.scene.updateMatrixWorld(true);
    const parts = [];
    let material = null;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
      material ??= o.material;
    });
    return [name, { geometry: parts.length === 1 ? parts[0] : mergeGeometries(parts), material }];
  }));
  return Object.fromEntries(entries);
}

/** Draw every placement of one model in a single call. place: { x, z, rot, s }. */
function instanced(model, places, scene) {
  const mesh = new THREE.InstancedMesh(model.geometry, model.material, places.length);
  const m = new THREE.Matrix4();
  places.forEach((p, i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y ?? 0, p.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rot ?? 0, 0)), new THREE.Vector3().setScalar(p.s ?? 1))));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

/**
 * Where a solar panel sits on a house model: the biggest flat roof face that looks towards the
 * viewer (facing = 1 for a house turned to +z, -1 for one turned round). Returns the panel's
 * matrix in the model's own coordinates.
 */
function roofPanel(geometry, facing) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const corner = (i) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i);
  const faces = new Map();
  for (let i = 0; i < (index ? index.count : pos.count); i += 3) {
    const [a, b, c] = [corner(i), corner(i + 1), corner(i + 2)];
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const area = n.length() / 2;
    n.normalize();
    if (area < 1e-5 || n.y < 0.45 || n.z * facing < 0.3 || Math.abs(n.x) > 0.25) continue; // not a front roof slope
    const key = `${[n.x, n.y, n.z].map((v) => Math.round(v * 20))}|${Math.round(n.dot(a) * 20)}`;
    const face = faces.get(key) ?? { n, area: 0, points: [] };
    face.area += area;
    face.points.push(a, b, c);
    faces.set(key, face);
  }
  const roof = [...faces.values()].sort((p, q) => q.area - p.area)[0];
  if (!roof) return null;
  // a flat frame on the roof: u along the ridge, v down the slope
  const n = roof.n;
  const u = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x).normalize();
  const v = new THREE.Vector3().crossVectors(u, n);
  const us = roof.points.map((p) => p.dot(u));
  const vs = roof.points.map((p) => p.dot(v));
  const [u0, u1, v0, v1] = [Math.min(...us), Math.max(...us), Math.min(...vs), Math.max(...vs)];
  const centre = new THREE.Vector3().addScaledVector(u, (u0 + u1) / 2).addScaledVector(v, (v0 + v1) / 2)
    .addScaledVector(n, n.dot(roof.points[0]) + 0.02);
  const turn = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, n, v));
  return new THREE.Matrix4().compose(centre, turn, new THREE.Vector3(Math.min(0.95, (u1 - u0) * 0.7), 1, (v1 - v0) * 0.62));
}

// ------------------------------------------------------------------ the scene
function houseGroups(typeCount) {
  return Array.from({ length: typeCount }, (_, ti) => {
    const row = ROWS[Math.floor(ti / 4) % 2];
    const terrace = TERRACE.has(ti);
    const count = terrace ? 6 : 5;
    const step = terrace ? 1.3 : 1.62; // terrace houses touch; landed houses have gardens between them
    return Array.from({ length: count }, (__, k) => ({
      model: terrace ? TERRACE_MODELS[(ti >> 1) % 2] : LANDED_MODELS[(k + ti) % LANDED_MODELS.length],
      x: GROUP_X[ti % 4] + (k - (count - 1) / 2) * step, z: row.z, facing: row.facing,
      rot: row.facing > 0 ? 0 : Math.PI,
    }));
  });
}

function buildScene(models, typeCount, rng) {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7d8a6c, 3);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 140 });
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  // the base board: lawn on top, light grey sides, a hairline ink edge like the 2D site plan
  const base = new THREE.Mesh(new THREE.BoxGeometry(BASE.w, 0.5, BASE.d), [
    ...Array(2).fill(new THREE.MeshStandardMaterial({ color: 0xc9ced3 })),
    new THREE.MeshStandardMaterial({ color: 0xaab89a }), new THREE.MeshStandardMaterial({ color: 0xc9ced3 }),
    ...Array(2).fill(new THREE.MeshStandardMaterial({ color: 0xc9ced3 })),
  ]);
  base.position.y = -0.25;
  base.receiveShadow = true;
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry), new THREE.LineBasicMaterial({ color: INK }));
  edge.position.copy(base.position);
  const paving = pavingTexture();
  paving.repeat.set((BASE.w - 3) / 1.2, (2 * BOULEVARD_Z - 1) / 1.2);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(BASE.w - 3, 2 * BOULEVARD_Z - 1), new THREE.MeshStandardMaterial({ map: paving }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.005;
  plaza.receiveShadow = true;
  scene.add(base, edge, plaza);
  const PLAZA_BEDS = [[-5, 4.2], [5, 4.2], [-15.6, 3.2], [15.6, 3.2]]; // planting beds: [x, width]
  for (const [x, width] of PLAZA_BEDS) {
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(width, 2.2), new THREE.MeshStandardMaterial({ color: 0xaab89a }));
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(x, 0.01, PLAZA_Z);
    bed.receiveShadow = true;
    scene.add(bed);
  }

  // roads with markings: two boulevards along the plaza, short streets between the house groups
  const along = [];
  for (let x = -17.5; x <= 17.5; x += 1) {
    if (!CROSS_STREETS.includes(x)) for (const z of [-BOULEVARD_Z, BOULEVARD_Z]) along.push({ x, z });
  }
  const across = [];
  const junctions = [];
  for (const x of CROSS_STREETS) {
    for (const sign of [-1, 1]) {
      junctions.push({ x, z: sign * BOULEVARD_Z, rot: sign < 0 ? Math.PI : 0 });
      for (let z = BOULEVARD_Z + 1; z <= BASE.d / 2 - 0.5; z += 1) across.push({ x, z: sign * z, rot: Math.PI / 2 });
    }
  }
  instanced(models["roads/road-straight"], along, scene);
  instanced(models["roads/road-straight"], across, scene);
  instanced(models["roads/road-intersection-line"], junctions, scene);

  // houses, drawn per model; panels per group so each group can shine with its own rooftop type
  const groups = houseGroups(typeCount);
  const byModel = {};
  groups.flat().forEach((h) => { (byModel[h.model] ??= []).push(h); });
  Object.entries(byModel).forEach(([name, places]) => instanced(models[`suburban/${name}`], places, scene));
  const panelGeometry = new THREE.BoxGeometry(1, 0.03, 1);
  const cellMap = panelTexture("#ffffff", "#7d8794"); // white cells, grey frame lines: tinted by the colour below
  const panels = groups.map((houses) => {
    // Unlit and not tone-mapped: the colour set each hour is exactly what shows, so the peak is true #f2a900
    const material = new THREE.MeshBasicMaterial({ map: cellMap, toneMapped: false });
    const mesh = new THREE.InstancedMesh(panelGeometry, material, houses.length);
    houses.forEach((h, i) => {
      const local = roofPanel(models[`suburban/${h.model}`].geometry, h.facing) ?? new THREE.Matrix4().makeScale(0, 0, 0);
      const house = new THREE.Matrix4().compose(new THREE.Vector3(h.x, 0, h.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, h.rot, 0)), new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, house.multiply(local));
    });
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });

  // trees in the back gardens and along the plaza (a fixed pseudo-random scatter, same every time)
  const trees = { "suburban/tree-large": [], "suburban/tree-small": [] };
  for (const row of ROWS) {
    for (let x = -18.6; x <= 18.6; x += 1.15) {
      if (CROSS_STREETS.some((c) => Math.abs(c - x) < 0.8)) continue;
      trees[rng() < 0.6 ? "suburban/tree-large" : "suburban/tree-small"].push({ x: x + (rng() - 0.5) * 0.4, z: row.z - row.facing * (0.95 + rng() * 0.35), s: 1.5 + rng() * 0.5, rot: rng() * 6 });
    }
  }
  for (let x = -16.5; x <= 16.5; x += 1.65) {
    if (BUYER_LAYOUT.some((b) => Math.abs(b.x - x) < 3.4)) continue;
    for (const z of [-2.0, 1.9]) trees["suburban/tree-large"].push({ x: x + (rng() - 0.5) * 0.3, z, s: 1.6 + rng() * 0.3, rot: rng() * 6 });
  }
  for (const [x, width] of PLAZA_BEDS) {
    for (let dx = -width / 2 + 0.7; dx <= width / 2 - 0.6; dx += 1.1) {
      trees[rng() < 0.5 ? "suburban/tree-large" : "suburban/tree-small"].push({ x: x + dx, z: PLAZA_Z + (rng() - 0.5) * 1.2, s: 1.4 + rng() * 0.5, rot: rng() * 6 });
    }
  }
  Object.entries(trees).forEach(([name, places]) => instanced(models[name], places, scene));

  // a few cars on the boulevards (driving on the left) and street lamps along the plaza
  const cars = Object.fromEntries(CARS.map((c) => [c, []]));
  for (let i = 0; i < 16; i += 1) {
    const side = i % 2 ? 1 : -1;
    const lane = rng() < 0.5 ? 1 : -1;
    const x = -17 + rng() * 34;
    if (CROSS_STREETS.some((c) => Math.abs(c - x) < 0.7)) continue;
    cars[CARS[i % CARS.length]].push({ x, z: side * BOULEVARD_Z + lane * 0.2, y: 0.09, s: 0.3, rot: lane > 0 ? -Math.PI / 2 : Math.PI / 2 });
  }
  Object.entries(cars).forEach(([name, places]) => places.length && instanced(models[name], places, scene));
  const lamps = [];
  for (let x = -17; x <= 17; x += 2.6) {
    if (CROSS_STREETS.some((c) => Math.abs(c - x) < 0.6)) continue;
    lamps.push({ x, z: -BOULEVARD_Z + 0.55, s: 1.5, rot: 0 }, { x, z: BOULEVARD_Z - 0.55, s: 1.5, rot: Math.PI });
  }
  instanced(models["roads/light-square"], lamps, scene);

  // buyer buildings, each with its bar: amber (solar) below, hatched (grid) above, in a thin ink frame
  const hatch = hatchTexture();
  const glow = glowTexture();
  const buyers = BUYER_LAYOUT.map((b) => {
    const model = models[b.model];
    const building = instanced(model, [{ x: b.x, z: PLAZA_Z, s: b.scale }], scene);
    model.geometry.computeBoundingBox();
    const size = model.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(b.scale);
    const bx = b.x + size.x / 2 + 0.95;
    const bz = PLAZA_Z + size.z / 2 - 0.25;
    const solar = new THREE.Mesh(new THREE.BoxGeometry(BAR.w, 1, BAR.w), new THREE.MeshBasicMaterial({ color: SUN, toneMapped: false })); // lit from within
    const gridTex = hatch.clone();
    gridTex.needsUpdate = true;
    // unlit like the solar half, so the ink-on-white hatching reads at every hour, dusk included
    const grid = new THREE.Mesh(new THREE.BoxGeometry(BAR.w, 1, BAR.w), new THREE.MeshBasicMaterial({ map: gridTex, toneMapped: false }));
    const caseBox = new THREE.BoxGeometry(BAR.w + 0.08, BAR.h, BAR.w + 0.08);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(caseBox), new THREE.LineBasicMaterial({ color: INK })); // the full height = 100% of the need
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    for (const o of [solar, grid]) { o.position.set(bx, 0, bz); o.castShadow = true; }
    outline.position.set(bx, BAR.h / 2, bz);
    pool.position.set(bx, 0.02, bz);
    scene.add(solar, grid, outline, pool);
    return { ...b, building, solar, grid, gridTex, pool, bx, bz, top: size.y };
  });
  return { scene, sun, hemi, panels, buyers };
}

/** Fit the whole base board (and room for the labels) to the canvas, whatever its shape. */
function frame(camera, aspect, buyers) {
  camera.position.copy(LOOK_AT).addScaledVector(VIEW_FROM, 300);
  camera.lookAt(LOOK_AT);
  camera.updateMatrixWorld();
  const points = [];
  for (const x of [-BASE.w / 2, BASE.w / 2]) for (const z of [-BASE.d / 2, BASE.d / 2]) points.push(new THREE.Vector3(x, -0.5, z), new THREE.Vector3(x, 0, z));
  buyers.forEach((b) => points.push(new THREE.Vector3(b.bx, BAR.h + 2.6, b.bz), new THREE.Vector3(b.x, b.top, PLAZA_Z)));
  const box = new THREE.Box3();
  points.forEach((p) => box.expandByPoint(p.applyMatrix4(camera.matrixWorldInverse)));
  let w = (box.max.x - box.min.x) * 1.03;
  let h = (box.max.y - box.min.y) * 1.08;   // margin for the label (top left) and the key (bottom left)
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const cx = (box.max.x + box.min.x) / 2;
  const cy = (box.max.y + box.min.y) / 2 + h * 0.02;
  Object.assign(camera, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 });
  camera.updateProjectionMatrix();
}

/** Small seeded random numbers, so the trees stand in the same places on every load. */
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export default function Township({ plan, t, hour, onFail }) {
  const mountRef = useRef(null);
  const world = useRef(null);
  const [labels, setLabels] = useState([]);
  const [builds, setBuilds] = useState(0); // counts finished scene builds, so the hour is drawn once models arrive
  const typeCount = plan.rooftops.length;

  // Create the renderer, load the models and build the scene once
  useEffect(() => {
    const mount = mountRef.current;
    let renderer;
    let cancelled = false;
    let observer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // transparent: the sky is the CSS background
    } catch {
      onFail();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.prepend(renderer.domElement);
    const lost = (e) => { e.preventDefault(); onFail(); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);

    const names = [...new Set([...TERRACE_MODELS, ...LANDED_MODELS, "tree-large", "tree-small"].map((n) => `suburban/${n}`)
      .concat(BUYER_LAYOUT.map((b) => b.model), CARS, ["roads/road-straight", "roads/road-intersection-line", "roads/light-square"]))];
    loadModels(names).then((models) => {
      if (cancelled) return;
      const built = buildScene(models, typeCount, seeded(7));
      world.current = { renderer, camera, ...built, draw: null };
      const fit = () => {
        const { clientWidth: w, clientHeight: h } = mount;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        frame(camera, w / h, built.buyers);
        world.current?.draw?.();
      };
      observer = new ResizeObserver(fit);
      observer.observe(mount);
      fit();
      setBuilds((n) => n + 1);
    }).catch(() => { if (!cancelled) onFail(); });

    return () => {
      cancelled = true;
      observer?.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      world.current?.scene.traverse((o) => {
        o.geometry?.dispose();
        [o.material].flat().forEach((mat) => { mat?.map?.dispose(); mat?.dispose(); });
      });
      renderer.dispose();
      renderer.domElement.remove();
      world.current = null;
    };
  }, [typeCount, onFail]);

  // Update and draw for the current (fractional) hour, and again once the models have loaded
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const maxRoof = Math.max(...plan.rooftops.flatMap((r) => r.hourly_kwh_one_roof), 0.01);
    const series = plan.buyers.map((b) => ({
      demand: plan.hours.map((row) => row.buyers[b.id].demand_kwh),
      used: plan.hours.map((row) => row.buyers[b.id].solar_used_kwh),
    }));
    w.draw = () => {
      // sky, sun and shadows for the hour: the sun rises in the east (+x) and sets in the west
      const sky = skyAt(t);
      const arc = Math.PI * Math.min(1, Math.max(0, (t - 6) / 12));
      const daylight = Math.sin(arc);
      mountRef.current.style.background = `linear-gradient(to bottom, #${sky.getHexString()}, #${sky.clone().lerp(new THREE.Color(0xffffff), 0.5 * daylight + 0.15).getHexString()})`;
      w.sun.position.set(Math.cos(arc) * 60, 8 + daylight * 60, 22);
      w.sun.intensity = 3.4 * Math.pow(daylight, 0.7);
      w.hemi.color.copy(sky).lerp(new THREE.Color(0xffffff), 0.5);
      w.hemi.intensity = 1.2 + 1.9 * daylight;

      // panels: shine with this hour's solar for one roof of each type (dark when no rooftops join)
      plan.rooftops.forEach((r, ti) => {
        const glow = Math.max(0, at(r.hourly_kwh_one_roof, t) / maxRoof);
        w.panels[ti].visible = plan.scenario.rooftops > 0;
        // dark blue -> amber at the peak, mixed in screen colours so low sun reads as dim blue, not brown
        const f = Math.pow(glow, 0.8);
        const [red, green, blue] = PANEL_DARK.map((c, k) => lerp(c, PANEL_LIT[k], f) / 255);
        w.panels[ti].material.color.setRGB(red, green, blue, THREE.SRGBColorSpace);
      });

      // bars: solar share at the bottom (amber), grid on top (hatched). Heights move smoothly
      // with t; the labels show the same hour as the big line above.
      const next = plan.buyers.map((b, i) => {
        const B = w.buyers[i];
        const demand = at(series[i].demand, t);
        const share = demand > 0 ? Math.min(1, at(series[i].used, t) / demand) : 0;
        const hs = Math.max(0.001, BAR.h * share);
        const hg = Math.max(0.001, BAR.h - hs);
        B.solar.scale.y = hs; B.solar.position.y = hs / 2;
        B.grid.scale.y = hg; B.grid.position.y = hs + hg / 2;
        B.gridTex.repeat.set(1, hg / BAR.w);
        B.pool.material.opacity = share; // no solar, no glow
        // label: this hour's kWh (rounded so solar + grid adds up to what the building needs)
        const row = plan.hours[hour].buyers[b.id];
        const needs = Math.round(row.demand_kwh);
        const solar = Math.min(needs, Math.round(row.solar_used_kwh));
        // % from the unrounded kWh: every building gets the same share each hour, as in the big line
        const pct = row.demand_kwh > 0 ? Math.round((100 * Math.min(row.solar_used_kwh, row.demand_kwh)) / row.demand_kwh) : 0;
        const p = new THREE.Vector3(B.bx, BAR.h + 0.1, B.bz).project(w.camera);
        return { id: b.id, name: b.name, needs, solar, grid: needs - solar, pct, side: B.side, x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      });

      w.renderer.render(w.scene, w.camera);
      setLabels(next);
    };
    w.draw();
  }, [plan, t, hour, builds]);

  return (
    <div className="township" ref={mountRef}>
      {labels.map((l) => (
        <div key={l.id} className={`township-label label-${l.side}`} style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%` }}>
          <p className="label-name">{l.name} <small>{l.pct}% from solar</small></p>
          <p>needs <b>{number(l.needs)}</b> kWh</p>
          <p><i className="key key-sun" />solar <b>{number(l.solar)}</b> <i className="key key-hatch" />grid <b>{number(l.grid)}</b></p>
        </div>
      ))}
      <p className="township-key">
        <span><i className="key key-sun" />Roof panels shine with each hour's solar</span>
        <span><i className="key key-sun" /><i className="key key-hatch" />Bar beside each buyer: amber = share from solar, hatched = from the grid</span>
        {/* on phones the floating labels would overlap, so the shares are listed here instead */}
        <span className="township-shares">
          {labels.map((l) => `${l.name}: needs ${number(l.needs)}, solar ${number(l.solar)}, grid ${number(l.grid)} kWh`).join(" · ")}
        </span>
      </p>
    </div>
  );
}
