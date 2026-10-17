import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { number } from "../format.js";

/**
 * The Overview's 3D township: an artist's impression, an EXAMPLE, not a model of Elmina.
 * Like the scale model in a property sales gallery: a made-up round town on a base, under the sky
 * of the hour. The base's edge stands for the 5 km CREAM limit.
 *  - 3 buyer buildings in a central plaza, each with a bar in front: amber from the bottom for the
 *    share met by solar, hatched above for the grid
 *  - rings of houses around them, cut by radial roads into 8 neighbourhoods (one per example
 *    rooftop type), terrace and landed; roof panels shine amber with that hour's solar
 * Each label sits as close to its bar as it can without covering the plaza, with a short leader line.
 * Models: Kenney city kits (CC0), bundled in public/models/kenney, so it works offline. Textures are
 * recoloured copies with no warm hues, because amber means solar only. Drawn only when the hour
 * or the size changes. If WebGL or the models fail, onFail() shows the 2D site plan instead.
 */
const MODELS = `${import.meta.env.BASE_URL}models/kenney/`;
const SUN = 0xf2a900;
const INK = 0x13212e;
const ASPHALT = 0x5b606b;
const PANEL_DARK = [0x1c, 0x2c, 0x48];          // a panel with no sun: dark blue cells (sRGB)
const PANEL_LIT = [0xf2, 0xa9, 0x00];           // a panel at the day's peak: pure solar amber (sRGB)

// ------------------------------------------------------------------ the made-up round layout
// Kenney units: a house is about 1.3 wide. x = east, z = towards the viewer; angles go from +x to +z.
const EDGE_R = 19.0;                    // the base's rim: the 5 km CREAM limit
const PLAZA_R = 8.8;
const RING_ROADS = [9.5, 14.5];
const HOUSE_RINGS = [                   // facing -1: front door towards the centre, +1: away from it
  { r: 11.0, facing: -1 }, { r: 13.0, facing: 1 }, { r: 16.0, facing: -1 },
];
const SECTORS = 8;                      // radial roads every 45 degrees; one neighbourhood between each pair
const TERRACE = new Set([0, 2, 5, 7]);  // terrace neighbourhoods; the others are landed houses
const TERRACE_MODELS = ["building-type-h", "building-type-e"];    // single- and double-storey terraces, 1.3 wide
const LANDED_MODELS = ["building-type-a", "building-type-c", "building-type-g", "building-type-j", "building-type-o", "building-type-s"];
// The three buildings stand in one row across the plaza, each with its bar just to its right, at the
// same depth: nothing stands in front of anything else, so every building and every bar stays in view.
const BUYER_LAYOUT = [                  // x, z of each building's centre on the plaza
  { model: "commercial/building-n", x: -6.74, z: 0, scale: 1.45 },             // Office A
  { model: "commercial/building-e", x: 4.59, z: 0, scale: 2.3 },               // Retail building: low and wide
  { model: "commercial/building-skyscraper-a", x: -1.18, z: 0, scale: 2.1 },   // Office B: the tall tower, in the middle
];
const PLAZA_BEDS = [[-5.2, 4.4, 1.1], [0, 5.4, 1.2], [5.2, 4.4, 1.1], [-5.2, -4.4, 1.1], [0, -5.4, 1.2], [5.2, -4.4, 1.1]]; // round planting beds: x, z, radius
const CARS = ["cars/sedan", "cars/suv", "cars/hatchback-sports", "cars/van"];
const BAR = { w: 1.7, h: 7.6 };         // the first thing you see; bar height = 100% of that hour's need
const ELEVATION = THREE.MathUtils.degToRad(27);   // low enough that the round town fills a wide screen
const AZIMUTH = THREE.MathUtils.degToRad(18);
const VIEW_FROM = new THREE.Vector3(Math.sin(AZIMUTH) * Math.cos(ELEVATION), Math.sin(ELEVATION), Math.cos(AZIMUTH) * Math.cos(ELEVATION));
const LOOK_AT = new THREE.Vector3(0, 0.8, 0);
const RING_TAG_ANGLE = THREE.MathUtils.degToRad(35);  // where on the rim the "5 km" tag sits (front right, clear of the key)

// Sky through the day: cool blues only (amber means solar). [hour, colour at the top of the sky]
const SKY = [[5, "#22304a"], [6, "#7f8fae"], [7, "#aebfd8"], [9, "#c9dcee"], [12, "#cfe4f4"], [15, "#c7dcef"],
  [17, "#b0c3dc"], [18, "#8796b6"], [19, "#4c5b7c"], [20, "#2a3753"], [21, "#1d2840"]];

const lerp = (a, b, f) => a + (b - a) * f;
const onCircle = (r, a, y = 0) => new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
/** Turn about the vertical axis that points a model's front (+z) along the flat direction (dx, dz). */
const facingAngle = (dx, dz) => Math.atan2(dx, dz);
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
/** A solar panel's cells and frame lines: cell colour on a frame colour. */
const panelTexture = (cell, frame) => canvasTexture(64, 40, (g) => {
  g.fillStyle = cell; g.fillRect(0, 0, 64, 40);
  g.strokeStyle = frame; g.lineWidth = 2;
  for (let x = 0; x <= 64; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 40); g.stroke(); }
  for (let y = 0; y <= 40; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); }
});
/** Paving joints for the plaza, one slab per 1.2 units. */
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

/** Draw every placement of one model in a single call. place: { x, z, rot, s, y }. */
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

/** The flat roof faces of a house model: one entry per sloped plane, with its normal, area and corners. */
function roofFaces(geometry) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const corner = (i) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i);
  const faces = new Map();
  for (let i = 0; i < (index ? index.count : pos.count); i += 3) {
    const [a, b, c] = [corner(i), corner(i + 1), corner(i + 2)];
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const area = n.length() / 2;
    n.normalize();
    if (area < 1e-5 || n.y < 0.45 || n.y > 0.97) continue; // a sloped roof face, not a wall or a flat top
    const key = `${[n.x, n.y, n.z].map((v) => Math.round(v * 20))}|${Math.round(n.dot(a) * 20)}`;
    const face = faces.get(key) ?? { n, area: 0, points: [] };
    face.area += area;
    face.points.push(a, b, c);
    faces.set(key, face);
  }
  return [...faces.values()];
}

/**
 * A solar panel on the roof face that best faces the viewer: `toViewer` is the flat direction to
 * the camera in the model's own coordinates. Returns the panel's matrix in model coordinates.
 */
function roofPanel(faces, toViewer) {
  const biggest = Math.max(0, ...faces.map((f) => f.area));
  const roof = faces.filter((f) => f.area >= 0.25 * biggest)
    .sort((p, q) => q.n.dot(toViewer) - p.n.dot(toViewer))[0];
  if (!roof) return null;
  // a flat frame on the roof: u along the ridge (level), v up/down the slope
  const n = roof.n;
  const u = new THREE.Vector3(n.z, 0, -n.x).normalize();
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
/** Houses of each neighbourhood: along each ring, between the two radial roads of its sector. */
function houseGroups() {
  return Array.from({ length: SECTORS }, (_, ti) => {
    const a0 = (ti * 2 * Math.PI) / SECTORS;
    const a1 = ((ti + 1) * 2 * Math.PI) / SECTORS;
    const terrace = TERRACE.has(ti);
    const step = terrace ? 1.32 : 1.7;     // terrace houses touch; landed houses have gardens between them
    return HOUSE_RINGS.flatMap((ring, ri) => {
      const margin = 0.95 / ring.r;        // keep clear of the radial roads
      const count = Math.floor((ring.r * (a1 - a0 - 2 * margin)) / step);
      return Array.from({ length: count }, (__, k) => {
        const a = (a0 + a1) / 2 + ((k - (count - 1) / 2) * step) / ring.r;
        const p = onCircle(ring.r, a);
        return {
          model: terrace ? TERRACE_MODELS[(ti + ri) % 2] : LANDED_MODELS[(k + ti + ri) % LANDED_MODELS.length],
          x: p.x, z: p.z, rot: facingAngle(ring.facing * Math.cos(a), ring.facing * Math.sin(a)),
        };
      });
    });
  });
}

function road(scene, material, length, angle, from) {
  const turn = new THREE.Group();
  turn.rotation.y = -angle;
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(length, 1), material);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(from + length / 2, 0.011, 0);
  strip.receiveShadow = true;
  turn.add(strip);
  scene.add(turn);
}
function dashedLine(points, scene, closed = false) {
  const line = new (closed ? THREE.LineLoop : THREE.Line)(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({ color: 0xf4f5f6, dashSize: 0.3, gapSize: 0.3 }));
  line.computeLineDistances();
  scene.add(line);
}
const circle = (r, y, n = 160) => Array.from({ length: n }, (_, i) => onCircle(r, (i / n) * 2 * Math.PI, y));

function buildScene(models, rng) {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x7d8a6c, 3);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 140 });
  sun.shadow.radius = 3;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  // the round base: lawn on top, light grey sides; its rim (a hairline ink ring) is the 5 km CREAM limit
  const side = new THREE.MeshStandardMaterial({ color: 0xc9ced3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(EDGE_R, EDGE_R, 0.5, 160), [side, new THREE.MeshStandardMaterial({ color: 0xaab89a }), side]);
  base.position.y = -0.25;
  base.receiveShadow = true;
  const rim = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle(EDGE_R - 0.03, 0.02)), new THREE.LineBasicMaterial({ color: INK }));
  const paving = pavingTexture();
  paving.repeat.set((2 * PLAZA_R) / 1.2, (2 * PLAZA_R) / 1.2);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R, 96), new THREE.MeshStandardMaterial({ map: paving }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.005;
  plaza.receiveShadow = true;
  scene.add(base, rim, plaza);
  for (const [x, z, r] of PLAZA_BEDS) {
    const bed = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: 0xaab89a }));
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(x, 0.01, z);
    bed.receiveShadow = true;
    scene.add(bed);
  }

  // roads: two ring roads and 8 radial roads, asphalt with white dashed centre lines
  const asphalt = new THREE.MeshStandardMaterial({ color: ASPHALT });
  for (const r of RING_ROADS) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.5, r + 0.5, 160), asphalt);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.receiveShadow = true;
    scene.add(ring);
    dashedLine(circle(r, 0.03), scene, true);
  }
  const roadStart = RING_ROADS[0] + 0.5;
  for (let k = 0; k < SECTORS; k += 1) {
    const a = (k * 2 * Math.PI) / SECTORS;
    road(scene, asphalt, EDGE_R - 0.15 - roadStart, a, roadStart);
    dashedLine([onCircle(roadStart + 0.3, a, 0.03), onCircle(RING_ROADS[1] - 0.6, a, 0.03)], scene);
    dashedLine([onCircle(RING_ROADS[1] + 0.6, a, 0.03), onCircle(EDGE_R - 0.4, a, 0.03)], scene);
  }

  // houses, drawn per model; panels per neighbourhood so each can shine with its own rooftop type
  const groups = houseGroups();
  const byModel = {};
  groups.flat().forEach((h) => { (byModel[h.model] ??= []).push(h); });
  Object.entries(byModel).forEach(([name, places]) => instanced(models[`suburban/${name}`], places, scene));
  const faces = Object.fromEntries(Object.keys(byModel).map((name) => [name, roofFaces(models[`suburban/${name}`].geometry)]));
  const toViewer = new THREE.Vector2(VIEW_FROM.x, VIEW_FROM.z).normalize();
  const panelGeometry = new THREE.BoxGeometry(1, 0.03, 1);
  const cellMap = panelTexture("#ffffff", "#7d8794"); // white cells, grey frame lines: tinted by the colour below
  const panels = groups.map((houses) => {
    // Unlit and not tone-mapped: the colour set each hour is exactly what shows, so the peak is true #f2a900
    const material = new THREE.MeshBasicMaterial({ map: cellMap, toneMapped: false });
    const mesh = new THREE.InstancedMesh(panelGeometry, material, houses.length);
    houses.forEach((h, i) => {
      // the direction to the viewer, turned into the house's own coordinates
      const c = Math.cos(h.rot);
      const s = Math.sin(h.rot);
      const local = new THREE.Vector3(toViewer.x * c - toViewer.y * s, 0, toViewer.x * s + toViewer.y * c);
      const panel = roofPanel(faces[h.model], local) ?? new THREE.Matrix4().makeScale(0, 0, 0);
      const house = new THREE.Matrix4().compose(new THREE.Vector3(h.x, 0, h.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, h.rot, 0)), new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, house.multiply(panel));
    });
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });

  // trees: back gardens between the inner rings, behind the outer ring, a green belt at the rim,
  // and the plaza beds (a fixed pseudo-random scatter, same every time)
  const trees = { "suburban/tree-large": [], "suburban/tree-small": [] };
  const nearRadialRoad = (r, a) => {
    const step = (2 * Math.PI) / SECTORS;
    const off = Math.abs(((a % step) + step) % step);
    return Math.min(off, step - off) * r < 0.9;
  };
  const plant = (r, a, s) => {
    if (nearRadialRoad(r, a)) return;
    const p = onCircle(r, a);
    trees[rng() < 0.6 ? "suburban/tree-large" : "suburban/tree-small"].push({ x: p.x, z: p.z, s, rot: rng() * 6 });
  };
  for (const [r, spacing] of [[12.0, 1.2], [17.1, 1.25], [17.9, 1.1], [18.6, 1.0]]) {
    for (let a = 0; a < 2 * Math.PI; a += spacing / r) plant(r + (rng() - 0.5) * 0.35, a + (rng() - 0.5) * 0.04, 1.4 + rng() * 0.6);
  }
  for (const [x, z, r] of PLAZA_BEDS) {
    for (let k = 0; k < 3; k += 1) trees["suburban/tree-large"].push({ x: x + (rng() - 0.5) * r, z: z + (rng() - 0.5) * r, s: 1.4 + rng() * 0.4, rot: rng() * 6 });
  }
  Object.entries(trees).forEach(([name, places]) => instanced(models[name], places, scene));

  // a few cars on the ring roads and radial roads, and street lamps along both ring roads
  const cars = Object.fromEntries(CARS.map((c) => [c, []]));
  for (let i = 0; i < 18; i += 1) {
    const lane = rng() < 0.5 ? 1 : -1;
    const model = cars[CARS[i % CARS.length]];
    if (i < 12) {
      const r = RING_ROADS[i % 2] + lane * 0.22;
      const a = rng() * 2 * Math.PI;
      if (nearRadialRoad(r, a)) continue;
      const p = onCircle(r, a);
      model.push({ x: p.x, z: p.z, y: 0.09, s: 0.3, rot: facingAngle(-Math.sin(a) * lane, Math.cos(a) * lane) });
    } else {
      const a = (Math.floor(rng() * SECTORS) * 2 * Math.PI) / SECTORS;
      const r = RING_ROADS[0] + 1.5 + rng() * 8;
      if (Math.abs(r - RING_ROADS[1]) < 0.9) continue;
      const p = onCircle(r, a).addScaledVector(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), lane * 0.22);
      model.push({ x: p.x, z: p.z, y: 0.09, s: 0.3, rot: facingAngle(Math.cos(a) * lane, Math.sin(a) * lane) });
    }
  }
  Object.entries(cars).forEach(([name, places]) => places.length && instanced(models[name], places, scene));
  const lamps = [];
  for (const [r, arm] of [[RING_ROADS[0] + 0.65, 1], [RING_ROADS[1] + 0.65, 1]]) {
    for (let a = Math.PI / SECTORS; a < 2 * Math.PI; a += Math.PI / SECTORS) {
      const p = onCircle(r, a);
      lamps.push({ x: p.x, z: p.z, s: 1.5, rot: facingAngle(arm * Math.cos(a), arm * Math.sin(a)) }); // arm over the road
    }
  }
  instanced(models["roads/light-square"], lamps, scene);

  // buyer buildings, each with its bar beside it: amber (solar) below, hatched (grid) above, in a thin ink frame
  const hatch = hatchTexture();
  const glow = glowTexture();
  const buyers = BUYER_LAYOUT.map((b) => {
    const model = models[b.model];
    instanced(model, [{ x: b.x, z: b.z, s: b.scale }], scene);
    model.geometry.computeBoundingBox();
    const size = model.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(b.scale);
    const bx = b.x + size.x / 2 + 0.25 + BAR.w / 2;   // just to the right of its building
    const bz = b.z;
    const solar = new THREE.Mesh(new THREE.BoxGeometry(BAR.w, 1, BAR.w), new THREE.MeshBasicMaterial({ color: SUN, toneMapped: false })); // lit from within
    const gridTex = hatch.clone();
    gridTex.needsUpdate = true;
    // unlit like the solar half, so the ink-on-white hatching reads at every hour, dusk included
    const grid = new THREE.Mesh(new THREE.BoxGeometry(BAR.w, 1, BAR.w), new THREE.MeshBasicMaterial({ map: gridTex, toneMapped: false }));
    const caseBox = new THREE.BoxGeometry(BAR.w + 0.1, BAR.h, BAR.w + 0.1);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(caseBox), new THREE.LineBasicMaterial({ color: INK })); // the full height = 100% of the need
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8),
      new THREE.MeshBasicMaterial({ map: glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    for (const o of [solar, grid]) { o.position.set(bx, 0, bz); o.castShadow = true; }
    outline.position.set(bx, BAR.h / 2, bz);
    pool.position.set(bx, 0.02, bz);
    scene.add(solar, grid, outline, pool);
    return { ...b, solar, grid, gridTex, pool, bx, bz, top: size.y };
  });
  return { scene, sun, hemi, panels, buyers };
}

/** Fit the round town to the canvas as large as it can go, whatever the canvas's shape. */
function frame(camera, width, height, buyers) {
  camera.position.copy(LOOK_AT).addScaledVector(VIEW_FROM, 300);
  camera.lookAt(LOOK_AT);
  camera.updateMatrixWorld();
  const points = [...circle(EDGE_R, 0, 48), ...circle(EDGE_R, -0.5, 48)];
  // headroom above the bars, so each label can sit right above its bar (more on short stages, where
  // a label is tall compared with the town)
  const room = height < 520 ? 6 : 3.6;
  buyers.forEach((b) => points.push(new THREE.Vector3(b.bx, BAR.h + room, b.bz), new THREE.Vector3(b.x, b.top, b.z)));
  const box = new THREE.Box3();
  points.forEach((p) => box.expandByPoint(p.applyMatrix4(camera.matrixWorldInverse)));
  const aspect = width / height;
  let w = (box.max.x - box.min.x) * 1.02;
  let h = (box.max.y - box.min.y) * 1.06;  // a little air above and below the rim
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const cx = (box.max.x + box.min.x) / 2;
  const cy = (box.max.y + box.min.y) / 2;
  Object.assign(camera, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2 });
  camera.updateProjectionMatrix();
}

/** Small seeded random numbers, so the trees stand in the same places on every load. */
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const overlaps = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
/** Is the point (x, y) inside the polygon? (screen pixels) */
function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/** Does a label box cover any of the plaza? (checked on a 4 x 4 grid of points, plus the plaza's outline) */
function coversPlaza(box, plaza) {
  for (let i = 0; i <= 3; i += 1) {
    for (let j = 0; j <= 3; j += 1) {
      if (inside(plaza, box.l + (i / 3) * (box.r - box.l), box.t + (j / 3) * (box.b - box.t))) return true;
    }
  }
  return plaza.some(([x, y]) => x > box.l && x < box.r && y > box.t && y < box.b);
}

/** Does the straight line from (x1, y1) to (x2, y2) pass through the box? (sampled every 4 px) */
function crosses(box, x1, y1, x2, y2) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4));
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    if (x > box.l + 2 && x < box.r - 2 && y > box.t + 2 && y < box.b - 2) return true;
  }
  return false;
}

/**
 * Put each label as close to its bar as it can go: try every spot on a 10 px grid around the bar's
 * top, nearest first, and take the first one clear of the plaza, the bars, the other labels and the
 * fixed tags whose leader line crosses no other bar or label. Runs only when the size changes, never
 * during Play. sizes: measured label boxes by id.
 */
function layoutLabels(labels, sizes, stage, fixed) {
  const placed = [];
  if (!stage.plaza) return placed;
  // the middle bar has the fewest free spots, so its label goes first; the outer ones then take the sides
  for (const l of [...labels].sort((a, b) => Math.abs(a.ax - stage.w / 2) - Math.abs(b.ax - stage.w / 2))) {
    const { w = 230, h = 92 } = sizes[l.id] ?? {};
    const spots = [];                                    // label centres around the bar top, by leader length
    for (let dx = -460; dx <= 460; dx += 10) {
      for (let dy = -340; dy <= 340; dy += 10) {
        const length = Math.hypot(Math.max(0, Math.abs(dx) - w / 2), Math.max(0, Math.abs(dy) - h / 2));
        if (length >= 14) spots.push({ dx, dy, length });  // never on top of the bar's own top
      }
    }
    spots.sort((a, b) => a.length - b.length);
    // first look for a spot clear of the plaza; on a small screen, if there is none, allow the plaza
    // rather than hide the label
    for (const keepPlazaClear of [true, false]) {
      const spot = spots.find(({ dx, dy }) => {
        const box = { l: l.ax + dx - w / 2, t: l.ay + dy - h / 2 };
        box.r = box.l + w;
        box.b = box.t + h;
        if (box.l < 8 || box.t < 8 || box.r > stage.w - 8 || box.b > stage.h - 8) return false;
        if (stage.bars.some((b) => overlaps(box, b)) || fixed.some((f) => overlaps(box, f))
          || placed.some((p) => overlaps(box, p.box)) || (keepPlazaClear && coversPlaza(box, stage.plaza))) return false;
        const lx = Math.max(box.l, Math.min(l.ax, box.r)); // where the leader leaves the label
        const ly = Math.max(box.t, Math.min(l.ay, box.b));
        // the space just above a bar counts as that bar's, so no leader skims across another bar's top
        const others = [...stage.bars.filter((_, i) => i !== l.bar).map((b) => ({ ...b, t: b.t - 30 })), ...placed.map((p) => p.box)];
        if (others.some((o) => crosses(o, lx, ly, l.ax, l.ay))) return false;
        placed.push({ ...l, box, lx, ly });
        return true;
      });
      if (spot) break;
    }
  }
  return placed;
}

export default function Township({ plan, t, hour, onFail }) {
  const mountRef = useRef(null);
  const world = useRef(null);
  const labelsKey = useRef("");                     // labels only change with the hour or the size, not every frame
  const labelRefs = useRef({});
  const keyRef = useRef(null);
  const ringRef = useRef(null);
  const [labels, setLabels] = useState([]);
  const [ringTag, setRingTag] = useState(null);
  const [sizes, setSizes] = useState({});
  const [fixed, setFixed] = useState([]);            // boxes of the EXAMPLE tag, the key and the rim tag
  const [stage, setStage] = useState({ w: 0, h: 0 }); // canvas size, plaza outline and bar boxes on screen
  const [builds, setBuilds] = useState(0); // counts finished scene builds, so the hour is drawn once models arrive

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
      .concat(BUYER_LAYOUT.map((b) => b.model), CARS, ["roads/light-square"]))];
    loadModels(names).then((models) => {
      if (cancelled) return;
      const built = buildScene(models, seeded(7));
      world.current = { renderer, camera, ...built, draw: null };
      const fit = () => {
        const { clientWidth: w, clientHeight: h } = mount;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        frame(camera, w, h, built.buyers);
        const tag = onCircle(EDGE_R, RING_TAG_ANGLE).project(camera);
        setRingTag({ x: (tag.x + 1) / 2, y: (1 - tag.y) / 2 });
        // what the labels must keep clear of, in screen pixels: the plaza's outline and each bar
        const px = (v) => { const p = v.project(camera); return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h]; };
        const bars = built.buyers.map((b) => {
          const corners = [-1, 1].flatMap((dx) => [-1, 1].flatMap((dz) => [0, BAR.h].map((y) => px(new THREE.Vector3(b.bx + (dx * BAR.w) / 2, y, b.bz + (dz * BAR.w) / 2)))));
          const xs = corners.map((c) => c[0]);
          const ys = corners.map((c) => c[1]);
          return { l: Math.min(...xs) - 4, r: Math.max(...xs) + 4, t: Math.min(...ys) - 4, b: Math.max(...ys) + 4 };
        });
        setStage({ w, h, plaza: circle(PLAZA_R, 0, 48).map(px), bars });
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
  }, [onFail]);

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
        if (!w.panels[ti]) return;
        const glow = Math.max(0, at(r.hourly_kwh_one_roof, t) / maxRoof);
        w.panels[ti].visible = plan.scenario.rooftops > 0;
        // dark blue -> amber at the peak, mixed in screen colours so low sun reads as dim blue, not brown
        const f = Math.pow(glow, 0.8);
        const [red, green, blue] = PANEL_DARK.map((c, k) => lerp(c, PANEL_LIT[k], f) / 255);
        w.panels[ti].material.color.setRGB(red, green, blue, THREE.SRGBColorSpace);
      });

      // bars: solar share at the bottom (amber), grid on top (hatched). Heights move smoothly
      // with t; the labels show the same hour as the big line above.
      const { clientWidth: width, clientHeight: height } = mountRef.current;
      plan.buyers.forEach((b, i) => {
        const B = w.buyers[i];
        const demand = at(series[i].demand, t);
        const share = demand > 0 ? Math.min(1, at(series[i].used, t) / demand) : 0;
        const hs = Math.max(0.001, BAR.h * share);
        const hg = Math.max(0.001, BAR.h - hs);
        B.solar.scale.y = hs; B.solar.position.y = hs / 2;
        B.grid.scale.y = hg; B.grid.position.y = hs + hg / 2;
        B.gridTex.repeat.set(1, hg / BAR.w);
        B.pool.material.opacity = share; // no solar, no glow
      });
      w.renderer.render(w.scene, w.camera);

      // labels change only with the hour, the plan or the size: rebuild them only then, not every frame
      const key = `${plan.day}|${plan.scenario.rooftops}|${hour}|${width}x${height}`;
      if (key === labelsKey.current) return;
      labelsKey.current = key;
      setLabels(plan.buyers.map((b, i) => {
        const B = w.buyers[i];
        // label: this hour's kWh (rounded so solar + grid adds up to what the building needs)
        const row = plan.hours[hour].buyers[b.id];
        const needs = Math.round(row.demand_kwh);
        const solar = Math.min(needs, Math.round(row.solar_used_kwh));
        // % from the unrounded kWh: every building gets the same share each hour, as in the big line
        const pct = row.demand_kwh > 0 ? Math.round((100 * Math.min(row.solar_used_kwh, row.demand_kwh)) / row.demand_kwh) : 0;
        const p = new THREE.Vector3(B.bx, BAR.h, B.bz).project(w.camera);
        return { id: b.id, bar: i, name: b.name, needs, solar, grid: needs - solar, pct, ax: ((p.x + 1) / 2) * width, ay: ((1 - p.y) / 2) * height };
      }));
    };
    w.draw();
  }, [plan, t, hour, builds]);

  // Measure the labels and the fixed tags once they are on screen, so labels can be placed clear of them
  useLayoutEffect(() => {
    const next = {};
    let changed = false;
    labels.forEach((l) => {
      const el = labelRefs.current[l.id];
      if (!el) return;
      next[l.id] = { w: el.offsetWidth, h: el.offsetHeight };
      if (sizes[l.id]?.w !== next[l.id].w || sizes[l.id]?.h !== next[l.id].h) changed = true;
    });
    if (changed) setSizes(next);
    const mount = mountRef.current;
    const origin = mount.getBoundingClientRect();
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: Math.round(r.left - origin.left) - 8, t: Math.round(r.top - origin.top) - 8, r: Math.round(r.right - origin.left) + 8, b: Math.round(r.bottom - origin.top) + 8 };
    };
    const nextFixed = [mount.parentElement?.querySelector(".ov-label"), keyRef.current, ringRef.current].map(box).filter(Boolean);
    if (JSON.stringify(nextFixed) !== JSON.stringify(fixed)) setFixed(nextFixed);
  }, [labels, sizes, fixed, stage]);

  // Label spots depend only on where the bars are (not on the numbers), so they are worked out
  // again only when the size changes, never during Play
  const anchors = labels.map((l) => `${l.id}:${l.bar}:${Math.round(l.ax)}:${Math.round(l.ay)}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const placed = useMemo(() => layoutLabels(labels, sizes, stage, fixed), [anchors, sizes, stage, fixed]);
  return (
    <div className="township" ref={mountRef}>
      <svg className="township-leaders" aria-hidden="true">
        {placed.map((l) => (
          <g key={l.id}>
            <line x1={l.lx} y1={l.ly} x2={l.ax} y2={l.ay} />
            <circle cx={l.ax} cy={l.ay} r="3.5" />
          </g>
        ))}
      </svg>
      {labels.map((l) => {
        const spot = placed.find((p) => p.id === l.id);
        return (
        <div key={l.id} ref={(el) => { labelRefs.current[l.id] = el; }} className="township-label"
             style={spot ? { left: spot.box.l, top: spot.box.t } : { left: 0, top: 0, visibility: "hidden" }}>
          <p className="label-name">{l.name} <small>{l.pct}% from solar</small></p>
          <p>needs <b>{number(l.needs)}</b> kWh</p>
          <p><i className="key key-sun" />solar <b>{number(l.solar)}</b> <i className="key key-hatch" />grid <b>{number(l.grid)}</b></p>
        </div>
        );
      })}
      {ringTag && (
        <span className="township-ring" ref={ringRef} style={{ left: `${ringTag.x * 100}%`, top: `${ringTag.y * 100}%` }}>5 km CREAM limit · not to scale</span>
      )}
      <p className="township-key" ref={keyRef}>
        <span><i className="key key-sun" />Roof panels shine with each hour's solar</span>
        <span><i className="key key-sun" /><i className="key key-hatch" />Bar beside each buyer: amber = share from solar, hatched = expected grid purchase</span>
        {/* on phones the floating labels would overlap, so the shares are listed here instead */}
        <span className="township-shares">
          {labels.map((l) => `${l.name}: needs ${number(l.needs)}, solar ${number(l.solar)}, grid ${number(l.grid)} kWh`).join(" · ")}
        </span>
      </p>
    </div>
  );
}
