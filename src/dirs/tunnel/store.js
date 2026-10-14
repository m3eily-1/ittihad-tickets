// The club store: a side room off the tunnel's left wall, opposite the trophy room.
// Redesigned to feel like a real shop (Ahmed, 2026-10-14). There are two versions; `?shop=` switches
// between them:
//   mega      a bright club megastore. White slatwall bays under yellow category headers,
//             LED troffers, a light porcelain floor, shirts on hangers and rails, folded-tee tables,
//             caps and balls on shelves, mannequins in the kit, a printing counter and a till.
//   flagship  (default) a Nike-style flagship. Concrete and black steel, warm spot-lit bays with fewer pieces,
//             a mannequin line-up on a long plinth, an oak table, the same printing counter and till.
// Every product comes from shop.ittihadclub.sa (products.js). The jerseys are the 26/27 home shirt in
// 3D (jersey3d.js); the other garments are the store's own product photos, cut out and hung on hangers.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TN, DOORS } from './world.js';
import { PRODUCTS } from './products.js';
import { buildGhostJersey } from './jersey3d.js';
import { muralTex, QUOTES } from './posters.js';

const SHOP = (() => { const v = new URLSearchParams(location.search).get('shop'); return v === 'mega' ? 'mega' : 'flagship'; })();   // flagship is the default (Ahmed, 2026-10-14)
const FLAG = SHOP === 'flagship';
export const STORE = { X0: -21.5, X1: -TN.HW, Z0: 58, Z1: 82, H: 4.2 };   // a shop-height ceiling
const CX = -12.5, CZ = (DOORS.store[0] + DOORS.store[1]) / 2; // straight through the door

const sar = (n) => `SAR ${Number.isInteger(n) ? n : n.toFixed(2)}`;
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, { srgb = true, rep = null, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

export const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

// Product photos sit on a flat studio background, either white or light grey. Flood that background out
// from the edges (by distance to the corner colour, so soft shadows go too), then crop to the garment.
export function cutOut(img, tol = 26) {
  if (!img) return null;
  const W = img.naturalWidth, H = img.naturalHeight;
  const [c, x] = canvas(W, H);
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H), px = d.data;
  const r0 = px[0], g0 = px[1], b0 = px[2];
  const seen = new Uint8Array(W * H), stack = [];
  const bg = (i) => Math.abs(px[i * 4] - r0) + Math.abs(px[i * 4 + 1] - g0) + Math.abs(px[i * 4 + 2] - b0) < tol * 3 || (px[i * 4] > 236 && px[i * 4 + 1] > 236 && px[i * 4 + 2] > 236);
  for (let i = 0; i < W; i++) stack.push(i, (H - 1) * W + i);
  for (let j = 0; j < H; j++) stack.push(j * W, j * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i] || !bg(i)) continue;
    seen[i] = 1; px[i * 4 + 3] = 0;
    const cx = i % W, cy = (i / W) | 0;
    if (cx > 0) stack.push(i - 1); if (cx < W - 1) stack.push(i + 1);
    if (cy > 0) stack.push(i - W); if (cy < H - 1) stack.push(i + W);
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (px[(j * W + i) * 4 + 3]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  x.putImageData(d, 0, 0);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const [o, ox] = canvas(cw, ch);
  ox.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
  return { canvas: o, aspect: cw / ch, tex: tex(o) };
}

/* ── printed surfaces ── */
function signTex(en, ar, { fg = '#111', bg = '#f2c418', w = 1200, h = 260, align = 'center' } = {}) {
  const [c, x] = canvas(w, h);
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.fillStyle = fg; x.textBaseline = 'middle';
  const pad = h * 0.3;
  x.font = `700 ${h * 0.4}px Cairo`;
  if (align === 'center') {
    x.textAlign = 'center';
    x.fillText(en, w / 2, h * (ar ? 0.34 : 0.5));
    if (ar) { x.font = `700 ${h * 0.3}px Cairo`; x.globalAlpha = 0.85; x.fillText(ar, w / 2, h * 0.74); }
  } else {
    x.textAlign = 'left'; x.fillText(en, pad, h * 0.52);
    if (ar) { x.textAlign = 'right'; x.font = `700 ${h * 0.4}px Cairo`; x.fillText(ar, w - pad, h * 0.52); }
  }
  return tex(c);
}
function shelfTag(p) {
  const [c, x] = canvas(512, 150);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 150);
  x.fillStyle = '#f2c418'; x.fillRect(0, 0, 10, 150);
  x.fillStyle = '#111'; x.textBaseline = 'alphabetic';
  let s = 34; x.font = `600 ${s}px Cairo`;
  while (x.measureText(p.name).width > 470 && s > 20) { s -= 1; x.font = `600 ${s}px Cairo`; }
  x.fillText(p.name, 28, 54);
  x.font = '700 48px Cairo'; x.fillText(sar(p.price), 28, 122);
  if (p.was) { const w = x.measureText(sar(p.price)).width; x.font = '400 30px Cairo'; x.fillStyle = '#8a8a8a'; const t = sar(p.was); x.fillText(t, 44 + w, 120); x.fillRect(44 + w, 109, x.measureText(t).width, 2); }
  return tex(c);
}
function tileTex() {
  // 60 cm porcelain tiles: 2 × 2 per repeat, grout lines and a faint per-tile shade
  const S = 1024, [c, x] = canvas(S, S);
  x.fillStyle = '#9b9c9a'; x.fillRect(0, 0, S, S);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const v = 178 + ((i * 7 + j * 13) % 5) * 3;
    x.fillStyle = `rgb(${v},${v},${v - 3})`; x.fillRect(i * 512 + 2, j * 512 + 2, 508, 508);
    for (let k = 0; k < 900; k++) { const g = v + (rnd() - 0.5) * 16; x.fillStyle = `rgba(${g},${g},${g - 2},0.35)`; x.fillRect(i * 512 + 2 + rnd() * 506, j * 512 + 2 + rnd() * 506, 2 + rnd() * 5, 2 + rnd() * 5); }
  }
  return c;
}
function concreteTex(base = 128, size = 1024) {
  const [c, x] = canvas(size, size);
  x.fillStyle = `rgb(${base},${base},${base - 3})`; x.fillRect(0, 0, size, size);
  for (let k = 0; k < 260; k++) {
    const r = 20 + rnd() * 140, g = base + (rnd() - 0.5) * 26;
    const gr = x.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${g},${g},${g - 3},0.35)`); gr.addColorStop(1, `rgba(${g},${g},${g - 3},0)`);
    x.save(); x.translate(rnd() * size, rnd() * size); x.fillStyle = gr; x.fillRect(-r, -r, r * 2, r * 2); x.restore();
  }
  for (let k = 0; k < 9000; k++) { const g = base + (rnd() - 0.5) * 50; x.fillStyle = `rgba(${g},${g},${g},0.5)`; x.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2); }
  return c;
}
function slatTex(bg = '#eeeeea', groove = '#b9bab6') {
  // slatwall: horizontal grooves every 15 cm with an aluminium insert (one repeat = 1.2 m tall)
  const [c, x] = canvas(256, 512);
  x.fillStyle = bg; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 8; i++) { const y = i * 64 + 30; x.fillStyle = groove; x.fillRect(0, y, 256, 8); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, y, 256, 2); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(0, y + 8, 256, 1); }
  return c;
}
function numbersBoard(crest) {
  // the printing wall: rows of flock letters and numbers ready to press
  const W = 2048, H = 1024, [c, x] = canvas(W, H);
  x.fillStyle = '#161616'; x.fillRect(0, 0, W, H);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const rows = ['0123456789', 'ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', '0123456789'];
  rows.forEach((r, j) => {
    const n = r.length, cw = (W - 160) / n;
    for (let i = 0; i < n; i++) {
      const cx = 80 + cw * (i + 0.5), cy = 150 + j * 210;
      x.fillStyle = '#262626'; x.fillRect(cx - cw * 0.42, cy - 90, cw * 0.84, 180);
      x.font = `400 ${j % 3 === 0 ? 150 : 120}px Anton`;
      x.fillStyle = (i + j) % 2 ? '#f2c418' : '#f4f4f0';
      x.fillText(r[i], cx, cy + 6);
    }
  });
  return tex(c);
}
function posScreen(crest) {
  const [c, x] = canvas(640, 400);
  x.fillStyle = '#f5f5f2'; x.fillRect(0, 0, 640, 400);
  x.fillStyle = '#111'; x.fillRect(0, 0, 640, 56);
  if (crest) x.drawImage(crest, 18, 8, 40, 40 * (crest.height / crest.width));
  x.fillStyle = '#fff'; x.font = '700 24px Cairo'; x.fillText('Al-Ittihad store', 72, 36);
  x.fillStyle = '#e6e6e2'; for (let i = 0; i < 4; i++) x.fillRect(24, 80 + i * 58, 380, 44);
  x.fillStyle = '#f2c418'; x.fillRect(430, 300, 186, 76);
  x.fillStyle = '#111'; x.font = '700 26px Cairo'; x.fillText('Pay', 498, 346);
  return tex(c);
}
function bagTex(crest) {
  const [c, x] = canvas(256, 320);
  x.fillStyle = '#f2c418'; x.fillRect(0, 0, 256, 320);
  if (crest) { const w = 110, h = w * (crest.height / crest.width); x.drawImage(crest, 128 - w / 2, 150 - h / 2, w, h); }
  x.fillStyle = '#111'; x.font = '700 26px Cairo'; x.textAlign = 'center'; x.fillText('AL-ITTIHAD', 128, 272);
  return tex(c);
}
function ballTex(crest) {
  // the club's small yellow ball: yellow panels with darker stitched seams and the crest
  const [c, x] = canvas(1024, 512);
  x.fillStyle = '#f0c419'; x.fillRect(0, 0, 1024, 512);
  x.strokeStyle = 'rgba(120,90,0,0.55)'; x.lineWidth = 4;
  for (let k = 0; k < 6; k++) { x.beginPath(); for (let u = 0; u <= 1024; u += 8) x.lineTo(u, 256 + Math.sin(u / 1024 * Math.PI * 4 + k) * 150 * Math.cos(k)); x.stroke(); }
  for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(k * 205 + 40, 0); x.bezierCurveTo(k * 205 + 120, 180, k * 205 - 20, 330, k * 205 + 60, 512); x.stroke(); }
  if (crest) { const w = 150, h = w * (crest.height / crest.width); x.drawImage(crest, 256 - w / 2, 256 - h / 2, w, h); x.drawImage(crest, 768 - w / 2, 256 - h / 2, w, h); }
  return tex(c);
}
function capTex(crest) {
  // the yellow shield cap: yellow front panels, black back and sides; u = 0.25 is the front
  const [c, x] = canvas(1024, 256);
  x.fillStyle = '#141414'; x.fillRect(0, 0, 1024, 256);
  x.fillStyle = '#f2c418'; x.fillRect(110, 0, 300, 256);
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(256, 0); x.lineTo(256, 256); x.stroke();
  if (crest) { const w = 150, h = w * (crest.height / crest.width); x.drawImage(crest, 256 - w / 2, 150 - h / 2, w, h); }
  return tex(c);
}

// the changing room's floor (Ahmed: the store floor the same): the tunnel's dark epoxy with grit and cloudy
// patches, at the same grit size per metre (its 2048 px span 18 m), and the dull yellow guide line
// 1.55 m in from the walls
function epoxyFloor() {
  const { X0, X1, Z0, Z1 } = STORE, W = X1 - X0, D = Z1 - Z0;
  const CW = 2048, CH = Math.round(2048 * (D / W));
  const [c, x] = canvas(CW, CH);
  x.fillStyle = '#26272a'; x.fillRect(0, 0, CW, CH);
  const n = Math.round(70000 * (CH / 2048));
  for (let i = 0; i < n; i++) { const v = 25 + Math.random() * 60; x.fillStyle = `rgba(${v},${v},${v + 2},${0.35 + Math.random() * 0.4})`; x.fillRect(Math.random() * CW, Math.random() * CH, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5); }
  for (let i = 0; i < 52; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; x.beginPath(); x.arc(Math.random() * CW, Math.random() * CH, 80 + Math.random() * 220, 0, Math.PI * 2); x.fill(); }
  // canvas top = the south wall (z = Z0); x runs X0 (back) → X1 (door)
  const px = (xx) => ((xx - X0) / W) * CW, pz = (zz) => ((zz - Z0) / D) * CH, lw = (0.06 / W) * CW;
  x.fillStyle = 'rgba(230,180,30,0.95)';
  const a = X0 + 1.55, e = X1 - 0.9, s = Z0 + 1.55, n2 = Z1 - 1.55;
  x.fillRect(px(a), pz(s), px(e) - px(a), lw);              // along the south wall
  x.fillRect(px(a), pz(n2) - lw, px(e) - px(a), lw);        // along the north wall
  x.fillRect(px(a), pz(s), lw, pz(n2) - pz(s));             // along the back wall
  const t = tex(c);
  return new THREE.MeshPhysicalMaterial({ map: t, color: 0xffffff, roughness: 0.3, metalness: 0, specularIntensity: 0.35 });   // as in changing.js: the texture is the colour, no env map
}

// the crest's silhouette, traced from the PNG's alpha (Moore-neighbour walk round the outer edge, then
// Ramer–Douglas–Peucker to thin it), as a THREE.Shape in metres centred on the badge
function crestShape(img, ch) {
  const GW = 260, GH = Math.round(GW * (img.height / img.width));
  const [c, x] = canvas(GW, GH); x.drawImage(img, 0, 0, GW, GH);
  const a = x.getImageData(0, 0, GW, GH).data;
  const on = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && a[(j * GW + i) * 4 + 3] > 110;
  let sx = -1, sy = -1;
  find: for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (on(i, j)) { sx = i; sy = j; break find; }
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];   // clockwise on screen
  const pts = [[sx, sy]];
  let cx = sx, cy = sy, start = 7;
  for (let n = 0; n < GW * GH; n++) {
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const d = (start + k) % 8, nx = cx + D[d][0], ny = cy + D[d][1];
      if (on(nx, ny)) { cx = nx; cy = ny; start = (d + 6) % 8; moved = true; break; }
    }
    if (!moved || (cx === sx && cy === sy)) break;
    pts.push([cx, cy]);
  }
  const rdp = (p, eps) => {
    if (p.length < 3) return p;
    const [x1, y1] = p[0], [x2, y2] = p[p.length - 1], L = Math.hypot(x2 - x1, y2 - y1) || 1;
    let best = 0, bi = 0;
    for (let i = 1; i < p.length - 1; i++) { const dd = Math.abs((y2 - y1) * p[i][0] - (x2 - x1) * p[i][1] + x2 * y1 - y2 * x1) / L; if (dd > best) { best = dd; bi = i; } }
    return best > eps ? [...rdp(p.slice(0, bi + 1), eps).slice(0, -1), ...rdp(p.slice(bi), eps)] : [p[0], p[p.length - 1]];
  };
  const half = Math.floor(pts.length / 2);
  const simple = [...rdp(pts.slice(0, half + 1), 0.6).slice(0, -1), ...rdp(pts.slice(half), 0.6).slice(0, -1)];
  const cw = ch * (img.width / img.height);
  return new THREE.Shape(simple.map(([i, j]) => new THREE.Vector2(((i + 0.5) / GW - 0.5) * cw, (0.5 - (j + 0.5) / GH) * ch)));
}
function crest3D(img, map, ch, env) {
  const cw = ch * (img.width / img.height), depth = 0.16, bev = 0.025;
  const uv = {   // the face takes the badge image; the sides take one dark texel
    generateTopUV: (g, v, a, b, c) => [a, b, c].map((k) => new THREE.Vector2(v[k * 3] / cw + 0.5, v[k * 3 + 1] / ch + 0.5)),
    generateSideWallUV: () => [new THREE.Vector2(0, 0), new THREE.Vector2(0, 0), new THREE.Vector2(0, 0), new THREE.Vector2(0, 0)],
  };
  const geo = new THREE.ExtrudeGeometry(crestShape(img, ch), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 1, UVGenerator: uv });
  const face = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(0.92, 0.92, 0.92) });   // the badge in its true colours (lit, the spots washed it to cream)
  const side = new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 0.32, metalness: 0.35, envMap: env, envMapIntensity: 0.9 });
  const m = new THREE.Mesh(geo, [face, side]);
  m.position.z = bev;   // the back sits on the wall
  const g = new THREE.Group(); g.add(m);
  return g;
}

/* ── geometry helpers ── */
function tube(a, b, r, mat, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg, 1), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export async function buildStore({ env, lite = false }) {
  const { X0, X1, Z0, Z1, H } = STORE;
  const group = new THREE.Group();
  await Promise.all(['700 100px Cairo', '600 100px Cairo', '400 100px Anton'].map((f) => document.fonts.load(f).catch(() => {})));

  /* materials */
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: FLAG ? 0.45 : 0.6, ...o });
  const mat = {
    wall: FLAG ? std({ map: tex(concreteTex(112), { rep: [3, 1] }), roughness: 0.92 }) : std({ color: 0xe4e4e0, roughness: 0.9 }),
    floor: epoxyFloor(),
    ceil: new THREE.MeshBasicMaterial({ color: FLAG ? new THREE.Color(0.045, 0.045, 0.047) : new THREE.Color(0.5, 0.5, 0.49) }),
    slat: FLAG ? std({ color: 0x1b1b1c, roughness: 0.55, metalness: 0.4 }) : std({ map: tex(slatTex(), { rep: [2, 2.4] }), roughness: 0.6 }),
    steel: std({ color: FLAG ? 0x161617 : 0xc9cacc, roughness: 0.35, metalness: 0.85 }),
    chrome: std({ color: 0xdedfe0, roughness: 0.18, metalness: 1 }),
    wood: std({ color: FLAG ? 0xa57a4c : 0xf3f3f0, roughness: FLAG ? 0.55 : 0.4 }),
    counter: std({ color: FLAG ? 0x1c1c1d : 0xf6f6f4, roughness: 0.35 }),
    yellow: std({ color: 0xf2c418, roughness: 0.5 }),
    black: std({ color: 0x151515, roughness: 0.6 }),
    form: std({ color: FLAG ? 0x2a2a2c : 0xf3f3f1, roughness: 0.45 }),          // mannequin
    shorts: std({ color: 0x111111, roughness: 0.75 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.12, envMap: env, envMapIntensity: 1.2, depthWrite: false }),
    lockerBay: new THREE.MeshStandardMaterial({ color: 0x4d4f55, roughness: 0.55, envMap: env, envMapIntensity: 0.55 }),    // = changing.js clubhouse bayM
    lockerBack: new THREE.MeshStandardMaterial({ color: 0x34363b, roughness: 0.7, envMap: env, envMapIntensity: 0.4 }),    // = bayBackM
    hanger: std({ color: FLAG ? 0x1a1a1a : 0x111111, roughness: 0.5 }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 1.04, 1.0) }),
    doorM: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.95, 0.02) }),
  };
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);

  /* shell (the room lies on the tunnel's -x side) */
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const floor = plane(W, D, mat.floor); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.002, cz);
  const ceil = plane(W, D, mat.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz);
  // the walls: the tunnel's yellow print, as in the changing room (Ahmed)
  const tunWall = (w, h) => new THREE.MeshBasicMaterial({ map: muralTex(QUOTES[0], w / h, null, 0, true, true, true), color: new THREE.Color(0.85, 0.85, 0.85) });
  const back = plane(D, H, tunWall(D, H)); back.rotation.y = Math.PI / 2; back.position.set(X0, H / 2, cz);
  const north = plane(W, H, tunWall(W, H)); north.rotation.y = Math.PI; north.position.set(cx, H / 2, Z1);
  const south = plane(W, H, tunWall(W, H)); south.position.set(cx, H / 2, Z0);
  group.add(floor, ceil, back, north, south);
  const [d0, d1] = DOORS.store;
  for (const [z0, z1, door] of [[Z0, d0, false], [d0, d1, true], [d1, Z1, false]]) {
    const y0 = door ? DOORS.h : 0, hgt = H - y0;
    const seg = plane(z1 - z0, hgt, tunWall(z1 - z0, hgt));
    seg.rotation.y = -Math.PI / 2;
    seg.position.set(X1 - 0.12, y0 + hgt / 2, (z0 + z1) / 2);
    group.add(seg);
  }
  for (const z of [d0, d1]) { const b = box(0.16, DOORS.h, 0.03, mat.doorM); b.position.set(X1 - 0.06, DOORS.h / 2, z); group.add(b); }
  const lint = box(0.16, 0.03, d1 - d0 + 0.03, mat.doorM); lint.position.set(X1 - 0.06, DOORS.h, CZ); group.add(lint);
  // skirting
  const skirt = (len, x, z, ry) => { const s = box(len, 0.1, 0.015, FLAG ? mat.black : std({ color: 0xd9d9d6, roughness: 0.5 })); s.position.set(x, 0.05, z); s.rotation.y = ry; group.add(s); };
  skirt(W, cx, Z1 - 0.008, 0); skirt(W, cx, Z0 + 0.008, 0); skirt(D, X0 + 0.008, cz, Math.PI / 2);

  /* assets */
  const imgs = await Promise.all(PRODUCTS.map((p) => loadImg(p.img)));
  const P = Object.fromEntries(PRODUCTS.map((p, i) => [p.key, { p, img: imgs[i] }]));
  const crest = await loadImg('/img/crest.png');
  const crestTex = crest ? (() => { const t = new THREE.Texture(crest); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; })() : null;
  const cut = {};
  for (const k of ['1927-hoodie', '1927-jacket', 'blackout-track-jacket', 'tifo-aura-hoodie', 'asia-tigers-kids-tee', 'captains-shirt', 'origen-carbon-watch']) cut[k] = cutOut(P[k]?.img);
  const photoTex = (k) => { const im = P[k]?.img; if (!im) return null; const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };

  // the 26/27 home shirt in 3D: a light one to hang in numbers, a finer one for the mannequins
  const jLow = await buildGhostJersey({ env, height: 0.74, depth: 0.1, nx: lite ? 28 : 44 });
  const jHi = await buildGhostJersey({ env, height: 0.78, depth: 0.13, nx: lite ? 60 : 110 });
  const jersey = (src) => { if (!src) return null; const g = src.group.clone(); return g; };

  const items = [];
  const addItem = (key, pos, extra = {}, frame = null) => { const r = P[key]; if (r) items.push({ data: { ...r.p, kind: 'product', ...extra }, focusPos: pos.clone(), frame }); };
  const tag = (p, w = 0.3) => { const m = plane(w, w * (150 / 512), new THREE.MeshBasicMaterial({ map: shelfTag(p), color: new THREE.Color(0.9, 0.9, 0.9) })); return m; };

  /* ── hanging things ── */
  const hangerGeo = { hook: new THREE.TorusGeometry(0.022, 0.0035, 6, 14, Math.PI * 1.4), bar: new THREE.BoxGeometry(0.4, 0.014, 0.012) };
  function hanger(width = 0.4) {
    const g = new THREE.Group();
    const hook = new THREE.Mesh(hangerGeo.hook, mat.chrome); hook.rotation.z = -Math.PI * 0.2; hook.position.y = 0.035; g.add(hook);
    const bar = new THREE.Mesh(hangerGeo.bar, mat.hanger); bar.scale.x = width / 0.4; g.add(bar);
    return g;
  }
  const garmentMats = {};
  function garment(key, h) {
    // a product photo cut out and hung: a gently curved card, front print on both faces
    const c = cut[key]; if (!c) return null;
    if (!garmentMats[key]) garmentMats[key] = std({ map: c.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: FLAG ? 0.35 : 0.5, emissive: 0xffffff, emissiveMap: c.tex, emissiveIntensity: FLAG ? 0.12 : 0.2 });
    const w = h * c.aspect, geo = new THREE.PlaneGeometry(w, h, 10, 1), pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const u = pa.getX(i) / (w / 2); pa.setZ(i, -0.035 * u * u); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, garmentMats[key]);
    return { mesh: m, w, h };
  }
  // one thing on a hanger, its hook at the origin
  function hung(kind, key) {
    const g = new THREE.Group();
    if (kind === 'jersey') {
      const j = jersey(jLow); if (!j) return g;
      j.position.y = -0.37 - 0.03; g.add(j);
      const hg = hanger(0.36); hg.position.y = -0.06; g.add(hg);
    } else {
      const h = key.includes('tee') || key.includes('shirt') ? 0.66 : 0.74;
      const gm = garment(key, h); if (!gm) return g;
      gm.mesh.position.y = -gm.h / 2 - 0.03; g.add(gm.mesh);
      const hg = hanger(Math.min(0.42, gm.w * 0.62)); hg.position.y = -0.07; hg.position.z = 0.01; g.add(hg);
    }
    return g;
  }

  /* ── wall bays ──
     A bay is a local frame on a wall: x along the wall, +z into the room, y up. */
  const BW = 2.3, BH = 3.0, DEP = 0.58;   // a bay is a niche 58 cm deep, not a flat panel (Ahmed: "I want the 3D feeling")
  // soft shading painted into each niche: darker into the corners and under the canopy, a pool of light
  // from the canopy's lamp falling down the back panel
  const nicheShade = (() => {
    const [c, x] = canvas(256, 512);
    const v = x.createLinearGradient(0, 0, 0, 512); v.addColorStop(0, 'rgba(0,0,0,0.62)'); v.addColorStop(0.16, 'rgba(0,0,0,0.18)'); v.addColorStop(0.75, 'rgba(0,0,0,0.06)'); v.addColorStop(1, 'rgba(0,0,0,0.3)');
    x.fillStyle = v; x.fillRect(0, 0, 256, 512);
    const h = x.createLinearGradient(0, 0, 256, 0); h.addColorStop(0, 'rgba(0,0,0,0.45)'); h.addColorStop(0.14, 'rgba(0,0,0,0)'); h.addColorStop(0.86, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.fillStyle = h; x.fillRect(0, 0, 256, 512);
    return tex(c);
  })();
  const sideShade = (() => {
    const [c, x] = canvas(128, 512);
    const h = x.createLinearGradient(0, 0, 128, 0); h.addColorStop(0, 'rgba(0,0,0,0.55)'); h.addColorStop(1, 'rgba(0,0,0,0.05)');   // u = 0 at the back panel
    x.fillStyle = h; x.fillRect(0, 0, 128, 512);
    const v = x.createLinearGradient(0, 0, 0, 512); v.addColorStop(0, 'rgba(0,0,0,0.5)'); v.addColorStop(0.18, 'rgba(0,0,0,0)');
    x.fillStyle = v; x.fillRect(0, 0, 128, 512);
    return tex(c);
  })();
  const poolTex = (() => {
    const [c, x] = canvas(256, 512);
    const g = x.createRadialGradient(128, 30, 10, 128, 120, 300); g.addColorStop(0, 'rgba(255,246,228,0.9)'); g.addColorStop(0.45, 'rgba(255,246,228,0.32)'); g.addColorStop(1, 'rgba(255,246,228,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 512);
    return tex(c);
  })();
  const shadeM = new THREE.MeshBasicMaterial({ map: nicheShade, transparent: true, depthWrite: false });
  const sideShadeM = new THREE.MeshBasicMaterial({ map: sideShade, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const poolM = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, opacity: FLAG ? 0.42 : 0.2 });
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.97, 0.9) });
  const contactM = (() => { const [c, x] = canvas(128, 128); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false }); })();

  function bay(kind, opts = {}) {
    const g = new THREE.Group();
    const frameM = FLAG ? mat.lockerBay : mat.counter, backM = FLAG ? mat.lockerBack : mat.slat;
    // the niche: back panel, side returns, a plinth, and a canopy carrying the section name and a lamp
    const back = box(BW, BH, 0.04, backM); back.position.set(0, BH / 2, 0.02); g.add(back);
    for (const sx of [-1, 1]) {
      const side = box(0.07, BH + 0.5, DEP, frameM); side.position.set(sx * (BW / 2 + 0.035), (BH + 0.5) / 2, DEP / 2); g.add(side);
      const ss = plane(DEP - 0.01, BH, sideShadeM); ss.rotation.y = -sx * Math.PI / 2; ss.position.set(sx * (BW / 2 - 0.002), BH / 2, DEP / 2);
      ss.scale.x = sx; g.add(ss);
    }
    const plinth = box(BW, 0.14, DEP - 0.04, FLAG ? mat.black : mat.counter); plinth.position.set(0, 0.07, (DEP - 0.04) / 2); g.add(plinth);
    const canopy = box(BW + 0.14, 0.5, DEP + 0.06, FLAG ? mat.lockerBay : mat.black); canopy.position.set(0, BH + 0.25, (DEP + 0.06) / 2); g.add(canopy);
    const lamp = box(BW - 0.3, 0.012, 0.04, lampM); lamp.position.set(0, BH - 0.006, DEP - 0.12); g.add(lamp);
    const shade = plane(BW, BH - 0.14, shadeM); shade.position.set(0, BH / 2 + 0.07, 0.042); g.add(shade);
    const pool = plane(BW * 0.9, BH * 0.85, poolM); pool.position.set(0, BH - BH * 0.85 / 2, 0.043); g.add(pool);
    if (opts.title) {
      const [en, ar] = opts.title;
      const s = plane(BW + 0.1, 0.46, new THREE.MeshBasicMaterial({ map: signTex(en, ar, { w: 1100, h: 220, fg: '#ffffff', bg: '#111111' }), color: new THREE.Color(0.93, 0.93, 0.93) }));
      s.position.set(0, BH + 0.25, DEP + 0.062); g.add(s);
    }
    const fo = (x, y, list, deep, fn) => {
      // a face-out arm with garments one behind the other
      const arm = tube(V(x, y, 0.04), V(x, y, 0.06 + deep * 0.09 + 0.08), 0.008, mat.chrome, 6); g.add(arm);
      const cs = plane(0.7, 0.85, contactM); cs.position.set(x + 0.03, y - 0.45, 0.044); g.add(cs);
      for (let i = 0; i < deep; i++) {
        const h = fn(list[i % list.length]);
        h.position.set(x, y + 0.012, 0.1 + i * 0.09);
        h.rotation.y = (rnd() - 0.5) * 0.06;
        g.add(h);
      }
    };
    const shelf = (y, d = 0.42) => {
      const s = box(BW - 0.02, 0.04, d, mat.wood); s.position.set(0, y, d / 2 + 0.04); g.add(s);
      const lip = box(BW - 0.02, 0.07, 0.02, FLAG ? mat.black : mat.steel); lip.position.set(0, y - 0.015, d + 0.05); g.add(lip);
      const under = plane(BW - 0.02, 0.5, shadeM); under.position.set(0, y - 0.27, 0.045); under.scale.y = 0.6; g.add(under);
      return s;
    };
    const deep = FLAG ? 2 : 3;
    if (kind === 'jerseys') {
      const cols = [-0.55, 0.55];
      for (const x of cols) { fo(x, 2.6, [0], deep, () => hung('jersey')); fo(x, 1.55, [0], deep, () => hung('jersey')); }
      const t = tag(P['home-26-27'].p); t.position.set(0, 0.62, 0.06); g.add(t);
      shelf(0.42);
      addItem('home-26-27', V(0, 1.8, 0.4), {}, g);
    } else if (kind === 'outer') {
      // hoodies and jackets face-out, two up two down
      const keys = opts.keys;
      const cols = FLAG ? [-0.5, 0.5] : [-0.55, 0.55];
      cols.forEach((x, i) => { fo(x, 2.62, [keys[i % keys.length]], deep, (k) => hung('cut', k)); fo(x, 1.6, [keys[(i + 1) % keys.length]], deep, (k) => hung('cut', k)); });
      keys.forEach((k, i) => { const t = tag(P[k].p, 0.26); t.position.set((i - (keys.length - 1) / 2) * 0.6, 0.58, 0.06); g.add(t); });
      addItem(keys[0], V(0, 1.9, 0.4), {}, g);
    } else if (kind === 'tees') {
      const keys = opts.keys;
      fo(-0.55, 2.62, [keys[0]], deep, (k) => hung('cut', k));
      fo(0.55, 2.62, [keys[1 % keys.length]], deep, (k) => hung('cut', k));
      for (const [y, kk] of [[1.45, keys], [0.9, keys.slice().reverse()]]) {
        shelf(y);
        kk.forEach((k, i) => { const st = foldedStack(k, FLAG ? 3 : 5); st.position.set((i - (kk.length - 1) / 2) * 0.62, y + 0.016, 0.25); g.add(st); });
      }
      keys.forEach((k, i) => { const t = tag(P[k].p, 0.24); t.position.set((i - (keys.length - 1) / 2) * 0.62, 1.4, 0.465); g.add(t); });
      addItem(keys[0], V(0, 1.7, 0.4), {}, g);
    } else if (kind === 'caps') {
      const ys = [0.65, 1.2, 1.75, 2.3];
      ys.forEach((y, j) => {
        shelf(y, 0.36);
        const n = 5;
        for (let i = 0; i < n; i++) {
          const x = (i - (n - 1) / 2) * 0.42;
          if (j === 0) { const b = ball(); b.position.set(x, y + 0.126, 0.22); b.rotation.y = rnd() * 6; g.add(b); }
          else { const cp = cap(); cp.position.set(x, y + 0.016, 0.2); cp.rotation.y = (rnd() - 0.5) * 0.25; g.add(cp); }
        }
      });
      const t1 = tag(P['yellow-cap'].p, 0.26); t1.position.set(-0.4, 1.72, 0.4); g.add(t1);
      { const t2 = tag(P['ball-yellow'].p, 0.26); t2.position.set(0.4, 0.62, 0.43); g.add(t2); }
      addItem('yellow-cap', V(0, 1.6, 0.4), {}, g);
    } else if (kind === 'graphic') {
      // a backlit lifestyle graphic, the store's own campaign photo
      const t = photoTex(opts.key); const im = P[opts.key]?.img;
      if (t && im) {
        const a = im.naturalWidth / im.naturalHeight, h = BH - 0.3, w = Math.min(BW - 0.1, h * a);
        const fr = box(w + 0.08, h + 0.08, 0.08, mat.black); fr.position.set(0, BH / 2 + 0.1, 0.06); g.add(fr);
        const ph = plane(w, h, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.92, 0.92, 0.92) })); ph.position.set(0, BH / 2 + 0.1, 0.101); g.add(ph);
        addItem(opts.key, V(0, 1.7, 0.4), {}, g);
      }
    }
    return g;
  }
  function placeOnWall(obj, wall, s) {
    // wall: 'n' | 's' | 'b'; s = position along the wall (x for n/s, z for b)
    if (wall === 'n') { obj.position.set(s, 0, Z1 - 0.005); obj.rotation.y = Math.PI; }
    else if (wall === 's') { obj.position.set(s, 0, Z0 + 0.005); obj.rotation.y = 0; }
    else { obj.position.set(X0 + 0.005, 0, s); obj.rotation.y = Math.PI / 2; }
    group.add(obj);
    obj.updateMatrixWorld(true);
    return obj;
  }

  /* ── small products ── */
  const capParts = (() => {
    const t = capTex(crest);
    const crown = new THREE.SphereGeometry(0.1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2); crown.scale(0.95, 1.08, 1.08);
    const sh = new THREE.Shape(); sh.absarc(0, 0, 0.175, Math.PI * 0.15, Math.PI * 0.85, false); sh.absarc(0, 0, 0.09, Math.PI * 0.85, Math.PI * 0.15, true);
    const brim = new THREE.ShapeGeometry(sh, 16); brim.rotateX(-Math.PI / 2); brim.scale(1, 1, 0.95);
    return { crown, brim, cm: std({ map: t, roughness: 0.8 }), bm: std({ color: 0x141414, roughness: 0.75, side: THREE.DoubleSide }), btn: std({ color: 0x141414 }) };
  })();
  function cap() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(capParts.crown, capParts.cm); g.add(c);
    const b = new THREE.Mesh(capParts.brim, capParts.bm); b.position.set(0, 0.012, 0.0); b.rotation.x = 0.12; g.add(b);
    const bt = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), capParts.btn); bt.position.y = 0.078; g.add(bt);
    g.position.y = 0.002;
    const w = new THREE.Group(); w.add(g); return w;
  }
  const ballMat = std({ map: ballTex(crest), roughness: 0.45 });
  const ballGeo = new THREE.SphereGeometry(0.11, 28, 18);
  const ball = () => new THREE.Mesh(ballGeo, ballMat);
  const foldMats = {};
  function foldedStack(key, n) {
    // folded tees: the chest print on top, fabric edges and fold lines on the sides
    if (!foldMats[key]) {
      const c = cut[key];
      const [cv, x] = canvas(512, 400);
      x.fillStyle = '#121212'; x.fillRect(0, 0, 512, 400);
      if (c) { const sw = c.canvas.width, sh = c.canvas.height; x.drawImage(c.canvas, sw * 0.22, sh * 0.12, sw * 0.56, sh * 0.5, 30, 0, 452, 400); }
      const gr = x.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(0.08, 'rgba(0,0,0,0)'); gr.addColorStop(0.92, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)');
      x.fillStyle = gr; x.fillRect(0, 0, 512, 400);
      const [sv, sx] = canvas(256, 32); sx.fillStyle = '#151515'; sx.fillRect(0, 0, 256, 32); sx.fillStyle = 'rgba(255,255,255,0.08)'; sx.fillRect(0, 15, 256, 2);
      const side = std({ map: tex(sv), roughness: 0.9 });
      foldMats[key] = [side, side, std({ map: tex(cv), roughness: 0.85, emissive: 0xffffff, emissiveMap: tex(cv), emissiveIntensity: 0.12 }), side, side, side];
    }
    const g = new THREE.Group(), geo = new THREE.BoxGeometry(0.3, 0.032, 0.24);
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, foldMats[key]); m.position.set((rnd() - 0.5) * 0.012, i * 0.033 + 0.016, (rnd() - 0.5) * 0.01); m.rotation.y = (rnd() - 0.5) * 0.05; g.add(m); }
    return g;
  }

  /* ── floor fixtures ── */
  function rail(len, n) {
    // a side-hung rail of home shirts, fanned a little so you catch the fronts
    const g = new THREE.Group(), y = 1.52;
    for (const sx of [-1, 1]) {
      g.add(tube(V(sx * len / 2, 0, 0), V(sx * len / 2, y, 0), 0.016, mat.chrome));
      const foot = box(0.04, 0.03, 0.55, mat.chrome); foot.position.set(sx * len / 2, 0.015, 0); g.add(foot);
    }
    g.add(tube(V(-len / 2, y, 0), V(len / 2, y, 0), 0.014, mat.chrome));
    for (let i = 0; i < n; i++) {
      const h = hung('jersey'); h.position.set(-len / 2 + 0.15 + (i / (n - 1)) * (len - 0.3), y + 0.01, 0);
      h.rotation.y = Math.PI / 2 + (rnd() - 0.5) * 0.3;
      h.scale.z = 0.45;
      g.add(h);
    }
    const t = tag(P['home-26-27'].p, 0.26); t.position.set(len / 2 - 0.2, 1.25, 0.02); t.rotation.y = 0; g.add(t);
    return g;
  }
  function table(w, d, keys) {
    const g = new THREE.Group(), h = 0.86;
    const top = box(w, 0.05, d, mat.wood); top.position.y = h - 0.025; g.add(top);
    if (FLAG) { for (const sx of [-1, 1]) { const leg = box(0.06, h - 0.05, d - 0.1, mat.steel); leg.position.set(sx * (w / 2 - 0.12), (h - 0.05) / 2, 0); g.add(leg); } }
    else { const base = box(w - 0.1, h - 0.05, d - 0.1, mat.counter); base.position.y = (h - 0.05) / 2; g.add(base); const kick = box(w - 0.14, 0.08, d - 0.14, mat.black); kick.position.y = 0.04; g.add(kick); }
    const n = keys.length, cols = Math.max(2, Math.floor(w / 0.42));
    for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) {
      const k = keys[(i + j) % n];
      const st = foldedStack(k, (FLAG ? 2 : 4) + ((i + j) % 3)); st.position.set(-w / 2 + (i + 0.5) * (w / cols), h, (j - 0.5) * (d * 0.48)); g.add(st);
    }
    keys.forEach((k, i) => { const t = tag(P[k].p, 0.22); t.position.set(-w / 2 + 0.3 + i * 0.5, h - 0.15, d / 2 + 0.002); g.add(t); });
    return g;
  }
  function ballBin() {
    const g = new THREE.Group(), r = 0.42, h = 0.62;
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32, 1, true), (() => {
      const [c, x] = canvas(256, 128); x.clearRect(0, 0, 256, 128); x.strokeStyle = '#111'; x.lineWidth = 3;
      for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 128); x.stroke(); }
      for (let j = 0; j <= 4; j++) { x.beginPath(); x.moveTo(0, j * 32); x.lineTo(256, j * 32); x.stroke(); }
      return std({ map: tex(c, { rep: [3, 1] }), alphaTest: 0.4, side: THREE.DoubleSide, transparent: false, metalness: 0.6, roughness: 0.4 });
    })());
    bin.position.y = h / 2 + 0.04; g.add(bin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 40), mat.black); rim.rotation.x = Math.PI / 2; rim.position.y = h + 0.04; g.add(rim);
    for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * (r - 0.12); const b = ball(); b.position.set(Math.cos(a) * rr, h - 0.06 + (i > 9 ? 0.12 : 0) + rnd() * 0.04, Math.sin(a) * rr); b.rotation.set(rnd() * 6, rnd() * 6, 0); g.add(b); }
    const t = tag(P['ball-yellow'].p, 0.26); t.position.set(0, 0.42, r + 0.01); g.add(t);
    return g;
  }
  function mannequin() {
    // a headless form in the home kit: neck, the 3D shirt, black shorts, arms down from the sleeves
    const g = new THREE.Group();
    const j = jersey(jHi);
    if (j) { j.position.y = 1.33; g.add(j); }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.16, 18), mat.form); neck.position.set(0, 1.74, -0.01); g.add(neck);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat.form); cap.position.set(0, 1.82, -0.01); g.add(cap);
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.175, 0.2, 24), mat.shorts); pelvis.scale.z = 0.62; pelvis.position.y = 0.88; g.add(pelvis);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.24, 18), mat.shorts); leg.position.set(sx * 0.085, 0.7, 0); leg.rotation.z = sx * 0.05; g.add(leg);
      g.add(tube(V(sx * 0.09, 0.62, 0), V(sx * 0.1, 0.1, 0.0), 0.05, mat.form, 14));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.24), mat.form); foot.position.set(sx * 0.1, 0.05, 0.05); g.add(foot);
      g.add(tube(V(sx * 0.255, 1.43, 0), V(sx * 0.27, 0.92, 0.02), 0.036, mat.form, 12));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), mat.form); hand.scale.set(0.8, 1.4, 0.9); hand.position.set(sx * 0.27, 0.87, 0.02); g.add(hand);
    }
    const pole = tube(V(0, 0.02, -0.08), V(0, 0.6, -0.08), 0.012, mat.chrome); g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 32), mat.chrome); base.position.y = 0.01; g.add(base);
    return g;
  }

  /* ── counters ── */
  function printCounter() {
    const g = new THREE.Group();
    const body = box(2.6, 0.95, 0.75, mat.counter); body.position.set(0, 0.475, 0); g.add(body);
    const top = box(2.68, 0.04, 0.8, FLAG ? mat.wood : mat.black); top.position.set(0, 0.97, 0); g.add(top);
    const front = plane(2.4, 0.5, new THREE.MeshBasicMaterial({ map: signTex('Name & number printing', 'طباعة الاسم والرقم', { w: 1400, h: 290, fg: FLAG ? '#f2f0ea' : '#ffffff', bg: FLAG ? '#1c1c1d' : '#111111' }), color: new THREE.Color(0.92, 0.92, 0.92) }));
    front.position.set(0, 0.55, 0.376); g.add(front);
    // the heat press, open, a home shirt laid on it back-up
    const press = new THREE.Group(); press.position.set(-0.55, 0.99, -0.02); g.add(press);
    const baseP = box(0.5, 0.06, 0.6, mat.black); baseP.position.y = 0.03; press.add(baseP);
    const platen = box(0.42, 0.03, 0.5, std({ color: 0x2a2a2a, roughness: 0.7 })); platen.position.y = 0.075; press.add(platen);
    const backImg = new Image(); backImg.src = '/img/jersey/back.png';
    const bt = new THREE.Texture(backImg); bt.colorSpace = THREE.SRGBColorSpace; backImg.onload = () => { bt.needsUpdate = true; };
    const shirt = plane(0.4, 0.4 * (1374 / 1024), std({ map: bt, alphaTest: 0.5, roughness: 0.8 })); shirt.rotation.x = -Math.PI / 2; shirt.position.set(0, 0.092, 0.02); press.add(shirt);
    const post = box(0.08, 0.5, 0.08, mat.black); post.position.set(0, 0.3, -0.32); press.add(post);
    const upper = new THREE.Group(); upper.position.set(0, 0.55, -0.32); upper.rotation.x = -0.75; press.add(upper);
    const up = box(0.42, 0.07, 0.5, std({ color: 0x9a9b9d, metalness: 0.7, roughness: 0.35 })); up.position.set(0, 0, 0.27); upper.add(up);
    const handle = tube(V(-0.12, 0.06, 0.5), V(0.12, 0.06, 0.5), 0.015, mat.black); upper.add(handle);
    // a stack of shirts waiting and a small screen
    const st = new THREE.Group(); for (let i = 0; i < 4; i++) { const f = box(0.34, 0.03, 0.28, std({ color: i % 2 ? 0xf2c418 : 0x151515, roughness: 0.85 })); f.position.y = i * 0.031 + 0.015; st.add(f); }
    st.position.set(0.45, 0.99, 0.0); g.add(st);
    // the letters and numbers board on the wall behind
    const board = plane(3.4, 1.7, new THREE.MeshBasicMaterial({ map: numbersBoard(crest), color: new THREE.Color(0.9, 0.9, 0.9) }));
    board.position.set(0, 2.25, -0.95); g.add(board);
    const bf = box(3.5, 1.8, 0.04, mat.black); bf.position.set(0, 2.25, -0.98); g.add(bf);
    const sign = plane(3.4, 3.4 * (240 / 1100), new THREE.MeshBasicMaterial({ map: signTex('Print your name', 'اطبع اسمك', { w: 1100, h: 240, fg: '#ffffff', bg: '#111111' }), transparent: true, color: new THREE.Color(0.95, 0.95, 0.95) }));
    sign.position.set(0, 3.4, -0.95); g.add(sign);
    return g;
  }
  function till() {
    const g = new THREE.Group();
    const body = box(3.0, 1.0, 0.8, mat.counter); body.position.set(0, 0.5, 0); g.add(body);
    const top = box(3.08, 0.04, 0.86, FLAG ? mat.wood : std({ color: 0x1a1a1a, roughness: 0.3 })); top.position.set(0, 1.02, 0); g.add(top);
    const band = box(3.0, 0.12, 0.01, mat.yellow); band.position.set(0, 0.86, 0.405); g.add(band);
    if (crestTex) { const cr = plane(0.42, 0.42 * (554 / 494), new THREE.MeshBasicMaterial({ map: crestTex, transparent: true, color: new THREE.Color(0.9, 0.9, 0.9) })); cr.position.set(0, 0.48, 0.402); g.add(cr); }
    // POS screen (facing the cashier, tilted) and the card reader (facing you)
    const scr = new THREE.Group(); scr.position.set(-0.6, 1.04, -0.15); g.add(scr);
    const stand = box(0.06, 0.22, 0.06, mat.black); stand.position.y = 0.11; scr.add(stand);
    const mon = box(0.42, 0.28, 0.03, mat.black); mon.position.set(0, 0.32, 0); mon.rotation.x = -0.25; scr.add(mon);
    const disp = plane(0.39, 0.25, new THREE.MeshBasicMaterial({ map: posScreen(crest), color: new THREE.Color(0.85, 0.85, 0.85) })); disp.position.set(0, 0.32, 0.016); disp.rotation.x = -0.25; scr.add(disp);
    const reader = box(0.08, 0.02, 0.15, mat.black); reader.position.set(-0.1, 1.05, 0.2); reader.rotation.x = 0.4; g.add(reader);
    // bags, stacked flat and two standing
    const bm = std({ map: bagTex(crest), roughness: 0.8 }), bs = std({ color: 0xe8b914, roughness: 0.85 });
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.13), [bs, bs, bs, bs, bm, bm]); b.position.set(0.55 + i * 0.36, 1.24, -0.12); b.rotation.y = (i - 0.5) * 0.2; g.add(b);
      const hdl = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 6, 16, Math.PI), mat.black); hdl.position.set(0.55 + i * 0.36, 1.44, -0.12); hdl.rotation.y = (i - 0.5) * 0.2; g.add(hdl);
    }
    const flat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.44), [bs, bs, bm, bs, bs, bs]); flat.position.set(1.15, 1.08, -0.15); g.add(flat);
    // the watch, under glass at the end of the counter
    const wc = cut['origen-carbon-watch'];
    if (wc) {
      const ped = box(0.3, 0.1, 0.3, mat.black); ped.position.set(1.2, 1.09, 0.18); g.add(ped);
      const gl = box(0.3, 0.32, 0.3, mat.glass); gl.position.set(1.2, 1.3, 0.18); g.add(gl);
      const w = plane(0.16 * wc.aspect, 0.16, new THREE.MeshBasicMaterial({ map: wc.tex, alphaTest: 0.5, color: new THREE.Color(0.9, 0.9, 0.9) })); w.position.set(1.2, 1.24, 0.18); g.add(w);
      const t = tag(P['origen-carbon-watch'].p, 0.24); t.position.set(1.2, 1.11, 0.332); g.add(t);
    }
    // the wall behind: crest and the store's name
    const sign = plane(4, 4 * (260 / 1200), new THREE.MeshBasicMaterial({ map: signTex('Al-Ittihad store', 'متجر الاتحاد', { fg: '#111', bg: null }), transparent: true, color: new THREE.Color(0.95, 0.95, 0.95) }));
    sign.position.set(0, 2.9, -1.0); g.add(sign);
    if (crestTex) { const cr = plane(0.9, 0.9 * (554 / 494), new THREE.MeshBasicMaterial({ map: crestTex, transparent: true, color: new THREE.Color(0.95, 0.95, 0.95) })); cr.position.set(0, 2.0, -1.0); g.add(cr); }
    return g;
  }

  /* ── layout ── */
  const T = {
    jerseys: ['Jerseys', 'الأطقم'], outer: ['Hoodies & jackets', 'هوديز وجاكيتات'], tees: ['T-shirts', 'تيشيرتات'],
    caps: ['Caps & balls', 'قبعات وكرات'], acc: ['Caps', 'قبعات'],
  };
  if (!FLAG) {
    // north wall (z = 82): jerseys, jerseys, tees, then the printing counter toward the back
    placeOnWall(bay('jerseys', { title: T.jerseys }), 'n', -5.6);
    placeOnWall(bay('jerseys', { title: T.jerseys }), 'n', -8.0);
    placeOnWall(bay('tees', { title: T.tees, keys: ['asia-tigers-kids-tee', 'captains-shirt'] }), 'n', -10.4);
    placeOnWall(bay('graphic', { key: 'tech-fleece-jogger' }), 'n', -12.8);
    const pc = printCounter(); pc.rotation.y = Math.PI; pc.position.set(-17.6, 0, Z1 - 1.05); group.add(pc);
    addItem('home-26-27', V(-17.6, 1.2, Z1 - 1.05), { type: 'Name & number printing' });
    // back wall (x = -21.5): outerwear either side of the store sign and a campaign photo
    placeOnWall(bay('outer', { title: T.outer, keys: ['1927-hoodie', 'tifo-aura-hoodie'] }), 'b', 61.0);
    placeOnWall(bay('outer', { title: T.outer, keys: ['1927-jacket', 'blackout-track-jacket'] }), 'b', 63.4);
    placeOnWall(bay('graphic', { key: 'nike-26-27-tee' }), 'b', 65.8);
    placeOnWall(bay('caps', { title: T.caps }), 'b', 74.0);
    placeOnWall(bay('outer', { title: T.outer, keys: ['blackout-track-jacket', '1927-hoodie'] }), 'b', 76.4);
    placeOnWall(bay('jerseys', { title: T.jerseys }), 'b', 78.8);
    // south wall (z = 58): the till by the door, then tees, caps, outerwear
    const tl = till(); tl.position.set(-6.8, 0, Z0 + 1.05); group.add(tl);
    placeOnWall(bay('tees', { title: T.tees, keys: ['captains-shirt', 'asia-tigers-kids-tee'] }), 's', -11.2);
    placeOnWall(bay('caps', { title: T.caps }), 's', -13.6);
    placeOnWall(bay('outer', { title: T.outer, keys: ['tifo-aura-hoodie', '1927-jacket'] }), 's', -16.0);
    placeOnWall(bay('jerseys', { title: T.jerseys }), 's', -18.4);
    // floor: a rail of home shirts, two tables of folded tees, a ball bin, the mannequins in the middle
    const r1 = rail(2.2, 14); r1.position.set(-9.6, 0, 62.9); group.add(r1);
    const t1 = table(1.8, 0.9, ['asia-tigers-kids-tee', 'captains-shirt']); t1.position.set(-9.6, 0, 77.0); group.add(t1);
    const t2 = table(1.6, 0.9, ['captains-shirt', 'asia-tigers-kids-tee']); t2.position.set(-16.8, 0, 62.4); group.add(t2);
    const bb = ballBin(); bb.position.set(-18.4, 0, 74.2); group.add(bb);
    addItem('ball-yellow', V(-18.4, 0.7, 74.2));
    // the feature wall behind the mannequins: a yellow panel, the crest and the store's name
    const fw = box(0.06, 3.3, 5.6, mat.yellow); fw.position.set(X0 + 0.03, 1.75, CZ); group.add(fw);
    if (crestTex) { const cr = plane(0.95, 0.95 * (554 / 494), new THREE.MeshBasicMaterial({ map: crestTex, transparent: true, color: new THREE.Color(0.95, 0.95, 0.95) })); cr.rotation.y = Math.PI / 2; cr.position.set(X0 + 0.065, 2.82, CZ); group.add(cr); }
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.2, 48), mat.counter); plinth.position.set(CX, 0.1, CZ); group.add(plinth);
    const prim = new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.26, 0.04, 48), mat.yellow); prim.position.set(CX, 0.02, CZ); group.add(prim);
    [[0, 0, 0], [-0.55, -0.75, 0.25], [-0.55, 0.75, -0.25]].forEach(([dx, dz, ry]) => { const m = mannequin(); m.position.set(CX + dx, 0.2, CZ + dz); m.rotation.y = Math.PI / 2 + ry; group.add(m); });
  } else {
    // flagship: spot-lit bays on bare concrete, the kit line-up on a long plinth against the back wall
    placeOnWall(bay('jerseys', { title: T.jerseys }), 'n', -5.8);
    placeOnWall(bay('jerseys', { title: T.jerseys }), 'n', -8.2);
    placeOnWall(bay('tees', { title: T.tees, keys: ['asia-tigers-kids-tee', 'captains-shirt'] }), 'n', -10.6);
    const pc = printCounter(); pc.rotation.y = Math.PI; pc.position.set(-16.4, 0, Z1 - 1.05); group.add(pc);
    addItem('home-26-27', V(-16.4, 1.2, Z1 - 1.05), { type: 'Name & number printing' });
    placeOnWall(bay('graphic', { key: 'nike-26-27-tee' }), 'b', 61.6);
    placeOnWall(bay('outer', { title: T.outer, keys: ['1927-hoodie', '1927-jacket'] }), 'b', 64.0);
    // the back wall, straight through the door: one big crest (Ahmed, in place of the mannequin line-up),
    // a solid 3D badge standing off the wall (Ahmed: "make the logo 3D"), with its shadow behind
    if (crest) {
      const ch = 3.1, cw = ch * (crest.width / crest.height), cy = 1.95;
      // a plain panel in the wall's yellow behind it, so the wall's scratches stay clear of the crest
      const panel = box(0.006, 4.0, 4.4, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xecbe15).multiplyScalar(0.85) }));   // above the skirting
      panel.position.set(X0 + 0.004, 2.1, CZ); group.add(panel);
      // the crest as a solid: its outline extruded 18 cm with a rounded edge, the badge printed on the face
      const c3 = crest3D(crest, crestTex, ch, env); c3.rotation.y = Math.PI / 2; c3.position.set(X0 + 0.01, cy, CZ); group.add(c3);
      const [sc, sx] = canvas(256, 288); sx.filter = 'blur(10px)'; sx.globalAlpha = 0.55; sx.drawImage(crest, 24, 24, 208, 240);
      const sh = plane(cw * 1.08, ch * 1.08, new THREE.MeshBasicMaterial({ map: tex(sc, { srgb: false }), color: 0x000000, transparent: true, depthWrite: false }));
      sh.rotation.y = Math.PI / 2; sh.position.set(X0 + 0.012, cy - 0.12, CZ - 0.1); group.add(sh);
    }
    placeOnWall(bay('caps', { title: T.caps }), 'b', 76.2);
    placeOnWall(bay('outer', { title: T.outer, keys: ['blackout-track-jacket', 'tifo-aura-hoodie'] }), 'b', 78.6);
    const tl = till(); tl.position.set(-7.0, 0, Z0 + 1.05); group.add(tl);
    placeOnWall(bay('outer', { title: T.outer, keys: ['tifo-aura-hoodie', 'blackout-track-jacket'] }), 's', -11.4);
    placeOnWall(bay('tees', { title: T.tees, keys: ['captains-shirt', 'asia-tigers-kids-tee'] }), 's', -13.8);
    placeOnWall(bay('graphic', { key: 'tech-fleece-jogger' }), 's', -16.2);
    placeOnWall(bay('jerseys', { title: T.jerseys }), 's', -18.6);
    const t1 = table(3.2, 1.1, ['asia-tigers-kids-tee', 'captains-shirt']); t1.position.set(CX, 0, CZ); t1.rotation.y = Math.PI / 2; group.add(t1);
    const r1 = rail(1.8, 10); r1.position.set(-9.4, 0, 62.8); group.add(r1);
    const bb = ballBin(); bb.position.set(-17.6, 0, 75.0); group.add(bb);
    addItem('ball-yellow', V(-17.6, 0.7, 75.0));
  }
  // the hero item for the centre of the room (the card shown first)
  if (!FLAG) addItem('home-26-27', V(CX, 1.4, CZ), { hero: true });

  /* ── light ── */
  RectAreaLightUniformsLib.init();
  const lights = [];
  const area = (color, I, w, h, x, y, z, tx, ty, tz) => { const L = new THREE.RectAreaLight(color, I, w, h); L.position.set(x, y, z); L.lookAt(tx, ty, tz); group.add(L); lights.push([L, I]); };
  if (!FLAG) {
    // rows of LED troffers across the ceiling, and the area lights they stand for
    for (const z of [61.5, 66.5, 73.3, 78.3]) {
      for (const x0 of [-5.5, -10.5, -15.5, -19.8]) { const t = box(3.2, 0.03, 0.22, mat.led); t.position.set(x0, H - 0.02, z); group.add(t); }
    }
    for (const z of [62, 70, 78]) area(0xfff8ee, 2.6, 16, 1.2, cx, H - 0.06, z, cx, 0, z);
    // wall washers so the bays read
    area(0xffffff, 2, 16, 0.4, cx, H - 0.2, Z1 - 1.4, cx, 1.5, Z1);
    area(0xffffff, 2, 16, 0.4, cx, H - 0.2, Z0 + 1.4, cx, 1.5, Z0);
    area(0xffffff, 2, 0.4, 22, X0 + 1.4, H - 0.2, cz, X0, 1.5, cz);
  } else {
    // black track with spot cans, warm pools on each bay, the line-up and the table
    const trackM = mat.black;
    for (const z of [61, 70, 79]) { const tr = box(16.5, 0.04, 0.05, trackM); tr.position.set(cx, H - 0.35, z); group.add(tr); }
    for (const z of [61, 70, 79]) for (let x = -5; x > -21; x -= 1.8) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 12), trackM); can.position.set(x, H - 0.47, z); can.rotation.x = (z < 70 ? -1 : z > 70 ? 1 : 0) * 0.5; group.add(can);
    }
    const warm = 0xffd8a8;
    for (const x of [-7.0, -10.6]) area(warm, 16, 1.2, 1.2, x, H - 0.5, Z1 - 2.2, x, 1.7, Z1);
    for (const x of [-12.6, -17.4]) area(warm, 16, 1.2, 1.2, x, H - 0.5, Z0 + 2.2, x, 1.7, Z0);
    area(warm, 18, 1.2, 6.5, X0 + 2.8, H - 0.5, CZ, X0, 1.3, CZ);
    area(warm, 14, 2.4, 1.2, X0 + 2.4, H - 0.5, 62.8, X0, 1.7, 62.8);
    area(warm, 14, 2.4, 1.2, X0 + 2.4, H - 0.5, 77.4, X0, 1.7, 77.4);
    area(warm, 14, 3.4, 1.2, CX, H - 0.4, CZ, CX, 0, CZ);
    area(warm, 6, 3.2, 1.0, -7.0, H - 0.4, Z0 + 1.6, -7.0, 0, Z0 + 1.6);
    area(warm, 6, 3.2, 1.0, -16.4, H - 0.4, Z1 - 1.6, -16.4, 0, Z1 - 1.6);
    area(0xfff1e0, 0.9, 16, 22, cx, H - 0.1, cz, cx, 0, cz);     // a low fill
  }

  /* per-frame */
  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  let focus = -1, lit = true;
  function update(t, camera) {
    group.visible = camera.position.z > 52 && camera.position.z < 90;
    // lights are kept in the scene (switching them would recompile every shader): just dim them away
    const want = group.visible && camera.position.x < X1 + 2.5;
    if (want !== lit) { lit = want; for (const [L, I] of lights) L.intensity = lit ? I : 0; }
    if (!group.visible) return focus;
    const inside = camera.position.x < X1 - 0.4 && camera.position.y < H;
    camera.getWorldDirection(fwd);
    let best = -1, bd = 0.955;
    if (inside) items.forEach((c, i) => {
      to.copy(c.focusPos).sub(camera.position);
      if (to.length() > 12) return;
      const s = fwd.dot(to.normalize());
      if (s > bd) { bd = s; best = i; }
    });
    focus = best;
    return focus;
  }

  // the tunnel's haze stops at the shop door
  group.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.fog = false; });

  // focus positions given in a bay's own frame: bring them to the room
  group.updateMatrixWorld(true);
  for (const it of items) if (it.frame) { it.focusPos.applyMatrix4(it.frame.matrixWorld); it.frame = null; }
  const inside = (c) => { const p = c.position; return p.x < X1 - 0.4 && p.x > X0 && p.z > Z0 && p.z < Z1 && p.y < H; };
  return { group, items, update, get focus() { return focus; }, inside };
}
