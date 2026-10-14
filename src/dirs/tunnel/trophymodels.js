// Hand-built models of the real trophies, traced from reference photos (2026-10-11):
//   kings  — King's Cup (current Thomas Lyte design, won by Al-Ittihad in 2025): Thomas Lyte studio shot
//   acl    — AFC Champions League Elite (current design; Ahmed's choice for the centrepiece): Thomas Lyte
//   league — Saudi Pro League trophy (lifted in 2023 and 2025): Getty 2153894447
//   super  — Saudi Super Cup: Getty 2230770566
//   crown  — Crown Prince Cup, 2004 edition: Getty 2068296190
// Proportions and parts follow the photos; engraving and fine ornament are simplified.
// Every builder returns a group 1 unit tall with its foot at y = 0.
import * as THREE from 'three';

const V = (r, y) => new THREE.Vector2(r, y);
const lathe = (pts, mat, seg = 96) => new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
const ring = (r0, r1, y0, y1, mat, seg = 96) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, false), mat); m.position.y = (y0 + y1) / 2; return m; };

// a proper loop handle: leaves the body at (r0,y0), arcs out and returns at (r1,y1), flattened into a band
function handle(mat, side, [r0, y0], [r1, y1], out = 0.08, thick = 0.012, flat = 2.2) {
  const s = side;
  const c = new THREE.CatmullRomCurve3([
    new THREE.Vector3(s * (r0 - 0.01), y0, 0),
    new THREE.Vector3(s * (r0 + out * 0.7), y0 + 0.02, 0),
    new THREE.Vector3(s * (Math.max(r0, r1) + out), (y0 + y1) / 2 + 0.01, 0),
    new THREE.Vector3(s * (r1 + out * 0.45), y1 - 0.015, 0),
    new THREE.Vector3(s * (r1 - 0.01), y1, 0),
  ]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, 64, thick, 12), mat);
  m.scale.z = flat;
  return m;
}

/* ── materials ── */
function malachiteTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d'), img = x.createImageData(S, S);
  const centres = Array.from({ length: 7 }, () => [Math.random() * S, Math.random() * S, 0.06 + Math.random() * 0.08]);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    // concentric banding around a few nodules, like polished malachite
    let best = 1e9, f = 0.1;
    for (const [cx, cy, fr] of centres) { const d = Math.hypot(i - cx, j - cy); if (d < best) { best = d; f = fr; } }
    const v = 0.5 + 0.5 * Math.sin(best * f + Math.sin(i * 0.02) * 2 + Math.sin(j * 0.017) * 2);
    const k = Math.pow(v, 1.6);
    const o = (j * S + i) * 4;
    img.data[o] = 2 + 14 * k; img.data[o + 1] = 26 + 72 * k; img.data[o + 2] = 18 + 34 * k; img.data[o + 3] = 255; // deep malachite green
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// a football's 12 pentagons + seams, painted onto an equirectangular map
function ballTexture({ base = '#d9a441', patch = null, seam = '#6e4a12' } = {}) {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), img = x.createImageData(W, H);
  const phi = (1 + Math.sqrt(5)) / 2;
  const ico = [[-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0], [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi], [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]]
    .map((v) => new THREE.Vector3(...v).normalize());
  const faces = new THREE.IcosahedronGeometry(1, 0);
  const pa = faces.attributes.position, hexes = [];
  for (let f = 0; f < pa.count; f += 3) hexes.push(new THREE.Vector3().fromBufferAttribute(pa, f).add(new THREE.Vector3().fromBufferAttribute(pa, f + 1)).add(new THREE.Vector3().fromBufferAttribute(pa, f + 2)).normalize());
  const all = [...ico.map((v) => [v, 1]), ...hexes.map((v) => [v, 0])];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const B = hex(base), P = patch ? hex(patch) : null, S = hex(seam);
  const d = new THREE.Vector3();
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const lon = (i / W) * Math.PI * 2, lat = (j / H) * Math.PI;
    d.set(Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon));
    let a = -2, b = -2, ka = 0;
    for (const [v, k] of all) { const s = v.dot(d); if (s > a) { b = a; a = s; ka = k; } else if (s > b) b = s; }
    const col = a - b < 0.012 ? S : ka && P ? P : B;
    const o = (j * W + i) * 4;
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function engravedBand(text, { base = '#c79a3c', ink = '#5c3f10', h = 128, w = 1024, size = 64 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  x.fillStyle = ink; x.font = `600 ${size}px "Cairo", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.direction = 'rtl';
  x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function trophyMaterials(env) {
  // kept under the bloom threshold so polished metal reads as metal, not a white glow
  const metal = (color, rough, k = 0.75) => new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough, envMap: env, envMapIntensity: k, side: THREE.DoubleSide });
  const mal = malachiteTexture();
  return {
    gold: metal(0xf3c25e, 0.14),          // polished gold plate
    goldDeep: metal(0xd9a03a, 0.22),
    silver: metal(0xc9ced6, 0.12, 0.6),
    malachite: new THREE.MeshPhysicalMaterial({ map: mal, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 0.45 }),
    green: new THREE.MeshPhysicalMaterial({ color: 0x1f7a3a, roughness: 0.3, clearcoat: 0.8, envMap: env, envMapIntensity: 0.8 }),
    ebony: new THREE.MeshPhysicalMaterial({ color: 0x0b0a09, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.25, envMap: env, envMapIntensity: 0.12 }), // black lacquer base
    env,
  };
}

/* ── King's Cup: malachite plinth, a gold column with a malachite collar, four tall curved blades
   rising round it to a crown that holds a gold football inlaid with malachite pentagons ── */
function kings(M) {
  const g = new THREE.Group();
  g.add(ring(0.17, 0.16, 0, 0.055, M.malachite));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 96, 1, true), new THREE.MeshPhysicalMaterial({
    map: engravedBand('كأس خادم الحرمين الشريفين'), metalness: 1, roughness: 0.18, envMap: M.env, envMapIntensity: 0.75, side: THREE.DoubleSide }));
  band.position.y = 0.0775;
  g.add(band, ring(0.15, 0.15, 0.054, 0.058, M.gold), ring(0.15, 0.15, 0.097, 0.101, M.gold));
  g.add(ring(0.135, 0.13, 0.1, 0.128, M.malachite));
  // central column, waisted, with a malachite collar and a cup under the ball
  g.add(lathe([V(0, 0.128), V(0.075, 0.128), V(0.06, 0.16), V(0.036, 0.26), V(0.03, 0.33), V(0.038, 0.42), V(0.05, 0.47), V(0, 0.47)], M.gold));
  g.add(ring(0.058, 0.058, 0.47, 0.515, M.malachite));
  g.add(lathe([V(0, 0.515), V(0.05, 0.515), V(0.07, 0.56), V(0.085, 0.62), V(0.097, 0.68), V(0.105, 0.71), V(0, 0.71)], M.gold));
  // four blades: thin curved sheets that flare out and up, pointed at the top
  const R = (v) => 0.068 + 0.09 * Math.pow(v, 1.15) - 0.02 * Math.max(0, v - 0.9) * 10;
  const Y = (v) => 0.13 + 0.62 * v;
  const Wd = (v) => (v < 0.88 ? 0.3 + 0.26 * v : (0.3 + 0.26 * 0.88) * (1 - (v - 0.88) / 0.12 * 0.85));
  for (let k = 0; k < 4; k++) {
    const a0 = k * Math.PI / 2 + Math.PI / 4;
    const NU = 10, NV = 48, pos = [], idx = [];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const v = j / NV, u = i / NU - 0.5, a = a0 + u * 2 * Wd(v);
      const r = R(v) + 0.012 * Math.cos(u * Math.PI);   // a gentle convex face
      pos.push(r * Math.cos(a), Y(v) + (v > 0.9 ? (v - 0.9) * 0.4 * (1 - Math.abs(u) * 2) : 0), r * Math.sin(a));
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, M.gold));
  }
  // crown ring with points, under the ball
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.01, 10, 64), M.goldDeep); crown.rotation.x = Math.PI / 2; crown.position.y = 0.705; g.add(crown);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const s = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 6), M.goldDeep); s.position.set(0.108 * Math.cos(a), 0.73, 0.108 * Math.sin(a)); g.add(s); }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.125, 64, 40), new THREE.MeshPhysicalMaterial({
    map: ballTexture({ base: '#e8b552', patch: '#1d6b3c', seam: '#7a5418' }), metalness: 0.85, roughness: 0.16, envMap: M.env, envMapIntensity: 0.75, clearcoat: 0.6 }));
  ball.position.y = 0.84; g.add(ball);
  return g;
}

/* ── AFC Champions League Elite: hexagonal silver foot, a tall flared cup of overlapping flame
   facets, a rim band and two slender loop handles ── */
function acl(M) {
  const g = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.29, 0.13, 6), M.silver); foot.position.y = 0.065; g.add(foot);
  g.add(ring(0.125, 0.12, 0.13, 0.162, M.silver, 6));
  const prof = [V(0, 0.16), V(0.095, 0.16), V(0.1, 0.24), V(0.125, 0.38), V(0.17, 0.53), V(0.235, 0.67), V(0.3, 0.8), V(0.33, 0.865), V(0.318, 0.87), V(0.288, 0.81), V(0, 0.81)];
  const body = new THREE.LatheGeometry(prof, 192);
  // flame facets: alternating ridges whose number of lobes grows toward the rim
  const p = body.attributes.position, tmp = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    tmp.fromBufferAttribute(p, i);
    const r = Math.hypot(tmp.x, tmp.z); if (r < 1e-4) continue;
    const a = Math.atan2(tmp.z, tmp.x), y = tmp.y;
    const t = THREE.MathUtils.clamp((y - 0.17) / 0.65, 0, 1);
    const f = 1 - 0.05 * t * Math.pow(Math.abs(Math.cos(a * 4 + t * 2.4)), 0.6) - 0.03 * t * Math.abs(Math.sin(a * 8 - t * 3));
    p.setXYZ(i, tmp.x * f, y, tmp.z * f);
  }
  body.computeVertexNormals();
  g.add(new THREE.Mesh(body, M.silver));
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.338, 0.335, 0.035, 128, 1, true), M.silver); rim.position.y = 0.865; g.add(rim);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.336, 0.007, 8, 128), M.silver); lip.rotation.x = Math.PI / 2; lip.position.y = 0.883; g.add(lip);
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.33, 0.85, 0), new THREE.Vector3(s * 0.4, 0.74, 0), new THREE.Vector3(s * 0.38, 0.52, 0), new THREE.Vector3(s * 0.27, 0.32, 0), new THREE.Vector3(s * 0.15, 0.22, 0)]);
    const h = new THREE.Mesh(new THREE.TubeGeometry(c, 64, 0.011, 10), M.silver); h.scale.z = 2.2; g.add(h);
  }
  return g;
}

/* ── Saudi Pro League: silver lidded cup with a row of gold beads at the shoulder, green enamel
   rings at the foot, a ball finial and two handles ── */
function league(M) {
  const g = new THREE.Group();
  g.add(lathe([V(0, 0), V(0.165, 0), V(0.168, 0.025), V(0.15, 0.05), V(0.12, 0.08), V(0.08, 0.115), V(0.055, 0.16), V(0.05, 0.21), V(0.072, 0.24), V(0.052, 0.27), V(0.06, 0.3),
    V(0.12, 0.34), V(0.18, 0.4), V(0.205, 0.47), V(0.21, 0.53), V(0.195, 0.57), V(0.205, 0.585), V(0.18, 0.61), V(0.13, 0.64), V(0.1, 0.67), V(0.11, 0.7), V(0.08, 0.73), V(0.065, 0.78), V(0.08, 0.81), V(0.05, 0.84), V(0.03, 0.87), V(0, 0.87)], M.silver));
  for (const [y, r] of [[0.03, 0.163], [0.165, 0.058]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 10, 96), M.green); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), M.gold); b.position.set(0.205 * Math.cos(a), 0.56, 0.205 * Math.sin(a)); g.add(b); }
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 32, 20), M.silver); fin.position.y = 0.91; g.add(fin);
  for (const s of [-1, 1]) g.add(handle(M.silver, s, [0.19, 0.6], [0.17, 0.4], 0.075, 0.013, 1.6));
  return g;
}

/* ── Saudi Super Cup: malachite drum with a gold band, a gold football held in two tall silver
   claws that curl up and in at the top ── */
function superCup(M) {
  const g = new THREE.Group();
  g.add(ring(0.12, 0.115, 0, 0.06, M.malachite));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.05, 96, 1, true), new THREE.MeshPhysicalMaterial({
    map: engravedBand('كأس السوبر السعودي', { size: 70 }), metalness: 1, roughness: 0.18, envMap: M.env, envMapIntensity: 0.75, side: THREE.DoubleSide }));
  band.position.y = 0.085; g.add(band);
  g.add(ring(0.112, 0.105, 0.11, 0.14, M.malachite));
  g.add(lathe([V(0, 0.14), V(0.05, 0.14), V(0.028, 0.2), V(0.024, 0.32), V(0.05, 0.4), V(0, 0.4)], M.gold));
  for (const s of [-1, 1]) {
    // follows the ball's side at a small gap, from under it to a point flicked outward above it
    const pts = [new THREE.Vector3(s * 0.025, 0.38, 0)];
    for (let i = 0; i <= 8; i++) { const a = -1.25 + (i / 8) * 2.35, R = 0.2 + 0.02 * i / 8; pts.push(new THREE.Vector3(s * R * Math.cos(a), 0.6 + R * Math.sin(a), 0)); }
    pts.push(new THREE.Vector3(s * 0.17, 0.86, 0));
    const claw = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.026, 14), M.silver);
    claw.scale.z = 2.6;
    g.add(claw);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 64, 40), new THREE.MeshPhysicalMaterial({
    map: ballTexture({ base: '#e7b54c', seam: '#8a5f1c' }), metalness: 0.9, roughness: 0.15, envMap: M.env, envMapIntensity: 0.75 }));
  ball.position.y = 0.6; g.add(ball);
  return g;
}

/* ── Crown Prince Cup (2004): stepped gold foot with green rings, a swirling gold stem and a gold
   football on top ── */
function crown(M) {
  const g = new THREE.Group();
  g.add(lathe([V(0, 0), V(0.13, 0), V(0.13, 0.05), V(0.11, 0.06), V(0.11, 0.1), V(0.09, 0.11), V(0.07, 0.15), V(0, 0.15)], M.gold));
  for (const [y, r] of [[0.025, 0.133], [0.105, 0.1]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 10, 96), M.green); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t); }
  g.add(lathe([V(0, 0.15), V(0.05, 0.15), V(0.035, 0.25), V(0.03, 0.42), V(0.05, 0.52), V(0, 0.52)], M.gold));
  // three flame ribbons twisting up the stem
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 24; i++) { const v = i / 24, a = k * 2.094 + v * 4.2, r = 0.035 + 0.05 * Math.sin(Math.PI * v); pts.push(new THREE.Vector3(r * Math.cos(a), 0.16 + v * 0.42, r * Math.sin(a))); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.014, 8), M.goldDeep));
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.15, 64, 40), new THREE.MeshPhysicalMaterial({
    map: ballTexture({ base: '#f0c255', seam: '#8e6420' }), metalness: 0.9, roughness: 0.14, envMap: M.env, envMapIntensity: 0.75 }));
  ball.position.y = 0.72; g.add(ball);
  return g;
}

export const REAL_TROPHIES = { kings, acl, league, super: superCup, crown };

/* ── honours with no usable reference photo: classic trophy forms, built to the same standard and
   labelled as stylised (the 2005 Arab Champions League trophy is known only as a gold two-handled cup) ── */
const plinth = (M, h = 0.16, r = 0.15) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, h, 64), M.ebony); p.position.y = h / 2; return p; };
function arab(M) {          // gold two-handled loving cup
  const g = new THREE.Group(); g.add(plinth(M));
  g.add(lathe([V(0, 0.16), V(0.1, 0.16), V(0.1, 0.18), V(0.06, 0.2), V(0.035, 0.3), V(0.05, 0.36), V(0.035, 0.4), V(0.08, 0.45), V(0.15, 0.55), V(0.18, 0.68), V(0.19, 0.8), V(0.205, 0.83), V(0.19, 0.835), V(0.175, 0.8), V(0, 0.8)], M.gold));
  for (const s of [-1, 1]) g.add(handle(M.gold, s, [0.185, 0.78], [0.14, 0.52], 0.09));
  return g;
}
function cwc(M) {           // tall gold lidded cup
  const g = new THREE.Group(); g.add(plinth(M, 0.14, 0.13));
  g.add(lathe([V(0, 0.14), V(0.09, 0.14), V(0.09, 0.16), V(0.05, 0.18), V(0.03, 0.3), V(0.045, 0.34), V(0.03, 0.37), V(0.07, 0.41), V(0.12, 0.5), V(0.135, 0.62), V(0.13, 0.7), V(0.14, 0.72), V(0.1, 0.76), V(0.06, 0.79), V(0.035, 0.83), V(0.05, 0.86), V(0, 0.9)], M.gold));
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), M.gold); fin.position.y = 0.92; g.add(fin);
  for (const s of [-1, 1]) g.add(handle(M.gold, s, [0.13, 0.68], [0.1, 0.46], 0.07, 0.011));
  return g;
}
function gcc(M) {           // silver cup on a tall stem
  const g = new THREE.Group(); g.add(plinth(M, 0.14, 0.14));
  g.add(lathe([V(0, 0.14), V(0.11, 0.14), V(0.11, 0.16), V(0.07, 0.18), V(0.03, 0.22), V(0.022, 0.42), V(0.04, 0.46), V(0.025, 0.5), V(0.1, 0.56), V(0.18, 0.66), V(0.2, 0.76), V(0.215, 0.8), V(0.2, 0.805), V(0.185, 0.77), V(0, 0.75)], M.silver));
  for (const s of [-1, 1]) g.add(handle(M.silver, s, [0.19, 0.76], [0.1, 0.56], 0.08));
  return g;
}
function fed(M) {           // silver two-handled cup with a green enamel band
  const g = new THREE.Group(); g.add(plinth(M, 0.18, 0.16));
  g.add(lathe([V(0, 0.18), V(0.11, 0.18), V(0.1, 0.2), V(0.06, 0.23), V(0.045, 0.33), V(0.07, 0.38), V(0.14, 0.46), V(0.19, 0.58), V(0.2, 0.7), V(0.215, 0.73), V(0.2, 0.735), V(0.185, 0.7), V(0, 0.7)], M.silver));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.196, 0.01, 10, 96), M.green); band.rotation.x = Math.PI / 2; band.position.y = 0.64; g.add(band);
  for (const s of [-1, 1]) g.add(handle(M.silver, s, [0.195, 0.69], [0.14, 0.46], 0.085));
  return g;
}
function segypt(M) {        // silver bowl on a fluted stem
  const g = new THREE.Group(); g.add(plinth(M, 0.16, 0.15));
  const stem = new THREE.LatheGeometry([V(0, 0.16), V(0.1, 0.16), V(0.06, 0.2), V(0.035, 0.3), V(0.03, 0.45), V(0.06, 0.5), V(0, 0.5)], 96);
  const sp = stem.attributes.position, tv = new THREE.Vector3();
  for (let i = 0; i < sp.count; i++) { tv.fromBufferAttribute(sp, i); const a = Math.atan2(tv.z, tv.x), f = 1 + 0.12 * Math.cos(a * 10); sp.setXYZ(i, tv.x * f, tv.y, tv.z * f); }
  stem.computeVertexNormals(); g.add(new THREE.Mesh(stem, M.silver));
  g.add(lathe([V(0, 0.5), V(0.08, 0.5), V(0.2, 0.55), V(0.28, 0.62), V(0.3, 0.66), V(0.285, 0.665), V(0.26, 0.63), V(0, 0.6)], M.silver));
  return g;
}
export const STYLISED_TROPHIES = { arab, cwc, gcc, fed, segypt };
