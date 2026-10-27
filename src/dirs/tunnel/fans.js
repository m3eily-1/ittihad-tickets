// The people in the stands (Ahmed, 2026-10-27: "work more on the people models in the stadium, making it more real").
// One set of fans, two ways of drawing them:
//   - close up (seats.js: the section you zoom into, the seat you sit in): real 3D figures, jointed so hands meet
//     forearms, with faces, hair and beards, ghutra or shemagh with agal, caps, hijab; striped home shirts, the black
//     away shirt, thobes and abayas; relaxed, leaning in, clapping, cheering, filming on a phone, holding a scarf up,
//     and standing (the ultras behind the west goal). They breathe, look round, clap, wave and jump.
//   - everywhere else (buildCrowd): the same figures baked once into an atlas at start-up and drawn as one camera-
//     facing card per occupied seat, ~40k of them, in a single draw per tier. They animate by swapping frames (clap,
//     cheer, jump) and bounce; phone torches glow after dark. They hide under the tifo's cards, inside the 3D patch,
//     and take the seat-map's category tint like the seats under them.
// Who sits where is a hash of the seat, shared by both, so zooming into a block swaps cards for the same people in 3D.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadRocketbox, RB_LOOKS, rbLookOf } from './rocketbox.js';

// which people fill the stands: 'real' (rocketbox.js: real human models) or 'code' (built here from shapes).
// ?fans=code shows the code-built ones, for comparison (Ahmed, 2026-10-27: "show me all").
export const FAN_MODE = new URLSearchParams(location.search).get('fans') === 'code' ? 'code' : 'real';
let RB = null;   // the realistic people, once buildCrowd has loaded them

export const hash = (a, b, c) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); };

/* ── who's who ── */
// outfit: 0 home stripes · 1 black away · 2 yellow · 3 thobe · 4 abaya · 5 gold (the Fan Pass kit; nobody in the crowd wears it)
// head:   0 short hair · 1 cap · 2 white ghutra + agal · 3 red shemagh + agal · 4 hijab · 5 buzz cut
export const LOOKS = [
  { outfit: 0, head: 0, skin: 0.35, beard: 1, w: 0.2 },
  { outfit: 0, head: 2, skin: 0.5, beard: 1, w: 0.12 },
  { outfit: 1, head: 1, skin: 0.6, beard: 0, w: 0.1 },
  { outfit: 3, head: 3, skin: 0.45, beard: 1, w: 0.1 },
  { outfit: 3, head: 2, skin: 0.28, beard: 1, w: 0.13 },
  { outfit: 2, head: 0, skin: 0.85, beard: 0, w: 0.1 },
  { outfit: 4, head: 4, skin: 0.3, beard: 0, w: 0.07 },
  { outfit: 0, head: 5, skin: 0.65, beard: 1, w: 0.18 },
];
export const POSES = ['relaxed', 'lean', 'clap', 'cheer', 'phone', 'scarf', 'stand'];
// the atlas's rows: one per drawn frame (a pose with motion has two)
export const FRAMES = ['relaxed', 'lean', 'clapA', 'clapB', 'cheerA', 'cheerB', 'phone', 'scarf', 'standA', 'standB'];
const FRAME_OF = { relaxed: [0, 1], lean: [1, 1], clap: [2, 2], cheer: [4, 2], phone: [6, 1], scarf: [7, 1], stand: [8, 2] };
const ANIM = { relaxed: 0, lean: 0, clap: 2, cheer: 1, phone: 4, scarf: 4, stand: 3 };   // the shader's motion kinds

const OCC = 0.8, OCC_ULTRAS = 0.96;
// the ultras stand behind the west goal (lower tier, the -x end)
export const isUltras = (tier, th) => tier === 0 && Math.cos(th) < 0 && Math.abs(Math.cos(th) / 63) > Math.abs(Math.sin(th) / 45) * 1.3;
// a seat's fan, or null if it's empty: { look, pose, flip }
export function fanAt(tier, sx, sy, th) {
  const ul = isUltras(tier, th);
  if (hash(sx, sy, tier) >= (ul ? OCC_ULTRAS : OCC)) return null;
  let h = hash(sx, sy, 5);
  const pose = ul ? 'stand' : h < 0.4 ? 'relaxed' : h < 0.5 ? 'lean' : h < 0.68 ? 'clap' : h < 0.8 ? 'cheer' : h < 0.9 ? 'phone' : 'scarf';
  h = hash(sx, sy, 11);
  const set = FAN_MODE === 'real' ? RB_LOOKS : LOOKS;
  let look = 0;
  for (let i = 0, acc = 0; i < set.length; i++) { acc += set[i].w; if (h < acc) { look = i; break; } look = i; }
  if (ul && (FAN_MODE === 'real' ? set[look].person === 'f06' : set[look].outfit === 4)) look = 0;    // the ultras' end: men's section
  return { look, pose, flip: hash(sx, sy, 31) < 0.5 ? -1 : 1 };
}

/* ── geometry ── */
// part ids (aPart): which colour a piece takes, and which pieces a look hides
const P = { SHIRT: 0, SKIN: 1, FACE: 2, ARM: 3, HAND: 4, LEGS: 5, SHOE: 6, HAIR: 7, CAP: 8, GHUTRA: 9, AGAL: 10, HIJAB: 11, PHONE: 12, TORCH: 13, SCARF: 14, ROBE: 15 };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function piece(geo, part, rig, tf = () => {}) {
  // aLocal keeps each primitive's own coordinates (faces, stripes, checks are drawn in them); a swept tube brings its
  // own (round the tube, along it, round the tube)
  const g0 = geo.index ? geo.toNonIndexed() : geo;
  if (!g0.attributes.aLocal) g0.setAttribute('aLocal', g0.attributes.position.clone());
  tf(g0);
  if (g0.attributes.uv) g0.deleteAttribute('uv');
  g0.clearGroups();
  const n = g0.attributes.position.count;
  g0.setAttribute('aPart', new THREE.Float32BufferAttribute(new Array(n).fill(part), 1));
  g0.setAttribute('aRig', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => rig), 4));
  return g0;
}
const Yax = V(0, 1, 0);
// A smooth tube through control points with an elliptical section at each ([across, depth] radii) — one piece from
// shoulder to wrist or hip to ankle, so elbows and knees bend instead of meeting as two sticks. `ref` is the "across"
// direction at the start (carried along the tube). aLocal = (cos round, fraction along, sin round).
function tube(ctrl, rads, { n = 22, segs = 12, ref = V(1, 0, 0), caps = [true, true] } = {}) {
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const cum = [0];
  for (let i = 1; i < ctrl.length; i++) cum.push(cum[i - 1] + ctrl[i].distanceTo(ctrl[i - 1]));
  const L = cum[cum.length - 1];
  const radAt = (u) => {
    const d = u * L; let i = 0;
    while (i < cum.length - 2 && d > cum[i + 1]) i++;
    let f = (d - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]); f = f * f * (3 - 2 * f);
    return [rads[i][0] + (rads[i + 1][0] - rads[i][0]) * f, rads[i][1] + (rads[i + 1][1] - rads[i][1]) * f];
  };
  const pos = [], nor = [], loc = [], idx = [];
  let B = null;
  for (let j = 0; j <= n; j++) {
    const u = j / n, p = curve.getPointAt(u), T = curve.getTangentAt(u).normalize();
    B = (B || ref.clone()).clone().addScaledVector(T, -(B || ref).dot(T)).normalize();   // parallel transport
    const N = new THREE.Vector3().crossVectors(T, B);
    const [rx, rz] = radAt(u);
    for (let k = 0; k <= segs; k++) {
      const a = (k / segs) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(p.x + B.x * c * rx + N.x * s * rz, p.y + B.y * c * rx + N.y * s * rz, p.z + B.z * c * rx + N.z * s * rz);
      const nn = B.clone().multiplyScalar(c / rx).addScaledVector(N, s / rz).normalize();
      nor.push(nn.x, nn.y, nn.z); loc.push(c, u, s);
    }
  }
  const R = segs + 1;
  for (let j = 0; j < n; j++) for (let k = 0; k < segs; k++) { const a = j * R + k, b = a + R; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  // round the ends off: a cap is a small dome over the last ring
  [0, 1].forEach((end) => {
    if (!caps[end]) return;
    const u = end, p = curve.getPointAt(u), T = curve.getTangentAt(u).normalize().multiplyScalar(end ? 1 : -1);
    const [rx, rz] = radAt(u), base = end ? n * R : 0, tip = pos.length / 3;
    pos.push(p.x + T.x * Math.min(rx, rz) * 0.8, p.y + T.y * Math.min(rx, rz) * 0.8, p.z + T.z * Math.min(rx, rz) * 0.8); nor.push(T.x, T.y, T.z); loc.push(0, u, 0);
    for (let k = 0; k < segs; k++) end ? idx.push(base + k, tip, base + k + 1) : idx.push(base + k + 1, tip, base + k);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aLocal', new THREE.Float32BufferAttribute(loc, 3));
  g.setIndex(idx);
  return g;
}
// squash a box toward an ellipsoid: rounded shoes, hands
function roundBox(w, h, d, k = 0.55, s = 3) {
  const g = new THREE.BoxGeometry(w, h, d, s, s, s), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) / (w / 2), p.getY(i) / (h / 2), p.getZ(i) / (d / 2));
    const e = v.clone().normalize();
    v.lerp(e, k);
    p.setXYZ(i, v.x * w / 2, v.y * h / 2, v.z * d / 2);
  }
  g.computeVertexNormals();
  return g;
}

// joints for each frame, in the body frame (relative to the hips, before the lean): elbow, wrist per side
const ARMS = {
  relaxed: [V(0.23, 0.17, 0.07), V(0.15, 0.13, 0.33)],
  lean: [V(0.21, 0.16, 0.16), V(0.08, 0.27, 0.34)],
  clapA: [V(0.25, 0.22, 0.17), V(0.13, 0.4, 0.36)],
  clapB: [V(0.23, 0.23, 0.19), V(0.035, 0.43, 0.39)],
  cheerA: [V(0.33, 0.74, 0.05), V(0.39, 1.02, 0.08)],
  cheerB: [V(0.28, 0.77, 0.03), V(0.26, 1.06, 0.02)],
  scarf: [V(0.36, 0.72, 0.1), V(0.33, 0.99, 0.12)],
  standA: [V(0.32, 0.74, 0.06), V(0.37, 1.02, 0.08)],
};
const ARM_R = { phone: [V(0.26, 0.62, 0.22), V(0.17, 0.86, 0.36)], standB: [V(0.27, 0.72, 0.1), V(0.22, 0.99, 0.12)] };
const ARM_L = { phone: ARMS.relaxed, standB: [V(0.22, 0.2, 0.06), V(0.2, -0.04, 0.12)] };
const LEAN = { relaxed: -0.06, lean: 0.36, clapA: 0.08, clapB: 0.08, cheerA: -0.02, cheerB: -0.02, phone: 0.02, scarf: -0.03, standA: 0.02, standB: 0.04 };
const FIST = { cheerA: 1, cheerB: 1, standA: 1, standB: 1, scarf: 1, phone: 1 };   // hands closed round something, or punching the air

export function fanGeometry(frame) {
  const standing = frame.startsWith('stand');
  const kind = ANIM[frame.replace(/[AB]$/, '')] ?? 0;
  const lean = LEAN[frame];
  const hip = standing ? V(0, 0.93, 0.0) : V(0, 0.5, -0.06);
  const B = (p) => p.clone().applyAxisAngle(V(1, 0, 0), lean).add(hip);              // body frame → seat frame
  const body = (g) => { g.rotateX(lean); g.translate(hip.x, hip.y, hip.z); };
  const rig = (part, side = 0) => [part, lean, kind, side];                             // 0 legs · 1 body · 2 arm · 3 head
  const parts = [];

  // torso: one swept body from the seat to the neck — hips, a narrower waist, chest, sloping shoulders
  const SP = [[-0.04, 0.165, 0.125, -0.01], [0.06, 0.162, 0.118, 0.0], [0.18, 0.152, 0.108, 0.006], [0.3, 0.17, 0.122, 0.018], [0.4, 0.195, 0.118, 0.012], [0.46, 0.205, 0.11, -0.004], [0.52, 0.15, 0.09, -0.006], [0.56, 0.078, 0.066, 0.004], [0.585, 0.064, 0.058, 0.006]];
  parts.push(piece(tube(SP.map(([y, , , z]) => V(0, y, z)), SP.map(([, rx, rz]) => [rx, rz]), { n: 20, segs: 18, ref: V(1, 0, 0) }), P.SHIRT, rig(1), body));
  parts.push(piece(new THREE.SphereGeometry(0.155, 16, 10), P.LEGS, rig(1), (g) => { g.scale(1.1, 0.62, 0.9); g.translate(0, 0.0, -0.005); body(g); }));   // seat of the trousers
  parts.push(piece(new THREE.CylinderGeometry(0.055, 0.064, 0.1, 12), P.SKIN, rig(1), (g) => { g.translate(0, 0.59, 0.006); body(g); }));
  // head: skull narrowing to the jaw and chin, nose, ears (the face is drawn on it)
  const HC = V(0, 0.698, 0.016);
  const head = (g) => { g.translate(HC.x, HC.y, HC.z); body(g); };
  // grow > 0: a layer over the scalp where cover(d) says (hair above a hairline; a hijab round the face)
  const hairCover = (d) => { const line = -0.42 + 0.74 * Math.min(1, Math.max(0, (d.z + 0.3) / 0.9)) - 0.14 * Math.abs(d.x) * (d.z > 0 ? 1 : 0); const t = Math.min(1, Math.max(0, (d.y - line + 0.03) / 0.09)); return t * t * (3 - 2 * t); };
  const skull = (grow = 0, cover = hairCover, res = [28, 20]) => {
    const g = new THREE.SphereGeometry(0.106, res[0], res[1]), p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const d = v.clone().normalize();
      let { x, y, z } = v;
      const low = Math.max(0, -y - 0.01) / 0.095;                                      // 0 at the cheekbones → 1 at the chin
      x *= (1 - 0.32 * low) * (1 + 0.035 * Math.exp(-(((d.y + 0.05) / 0.12) ** 2)) * (d.z > 0.2 ? 1 : 0));
      z = z * (1 - 0.12 * low) + 0.018 * low * Math.max(0, z / 0.106);
      if (d.z > 0.5) z += 0.006 * Math.exp(-(((d.y - 0.22) / 0.07) ** 2));          // brow ridge
      z -= 0.006 * Math.exp(-(((Math.abs(d.x) - 0.36) ** 2) + ((d.y - 0.06) ** 2)) / 0.012) * (d.z > 0 ? 1 : 0);   // eye sockets
      if (z < 0 && y > -0.02) z *= 1.06;                                                // the back of the head
      if (grow) {
        // hair: out from the scalp above a hairline (high at the forehead, down at the temples, low at the nape)
        const e = cover(d);                                                             // a soft edge, no step
        const k = grow * e * (1 + 0.08 * Math.max(0, d.y)) - 0.012 * (1 - e);
        x += d.x * k; y += d.y * k; z += d.z * k;
      }
      p.setXYZ(i, x * 0.85, y * (y > 0 ? 1.03 : 1.1), z * 0.98);   // a rounder crown, the jaw still long
    }
    g.computeVertexNormals();
    return g;
  };
  parts.push(piece(skull(), P.FACE, rig(3), head));
  parts.push(piece(skull(0.011), P.HAIR, rig(3), head));
  {
    // nose: narrow at the bridge, wider at the nostrils
    const g = roundBox(0.032, 0.052, 0.034, 0.6), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 0.026) / 0.052; p.setX(i, p.getX(i) * (1.15 - 0.55 * t)); p.setZ(i, p.getZ(i) * (0.7 + 0.3 * (1 - t))); }
    g.computeVertexNormals();
    parts.push(piece(g, P.SKIN, rig(3), (x) => { x.rotateX(0.28); x.translate(0, -0.012, 0.096); head(x); }));
  }
  for (const sx of [-1, 1]) parts.push(piece(new THREE.SphereGeometry(0.024, 8, 6), P.SKIN, rig(3), (g) => { g.scale(0.45, 1.05, 0.8); g.translate(sx * 0.09, -0.002, -0.008); head(g); }));
  // cap: crown + a brim to the front
  parts.push(piece(new THREE.SphereGeometry(0.114, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), P.CAP, rig(3), (g) => { g.scale(0.9, 0.98, 1.02); g.translate(0, 0.024, 0); head(g); }));
  parts.push(piece(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 16, 1, false, -Math.PI / 2, Math.PI), P.CAP, rig(3), (g) => { g.scale(1.08, 1, 1.15); g.rotateX(0.12); g.translate(0, 0.034, 0.074); head(g); }));
  // ghutra / shemagh: a cloth over the head, open at the face, falling to the shoulders behind and at the sides
  {
    const g = new THREE.SphereGeometry(0.124, 24, 18, Math.PI * 0.5 + 0.62, Math.PI * 2 - 1.24, 0, Math.PI * 0.86);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0.02) { const k = (0.02 - y) / 0.1; y -= k * k * 0.17; x *= 1 + k * 0.6; z = z * (1 + k * 0.38) - k * 0.035; }   // drape
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    parts.push(piece(g, P.GHUTRA, rig(3), (x) => { x.scale(0.92, 1.08, 1.0); x.translate(0, 0.02, -0.006); head(x); }));
    // the agal: a double black cord round the crown
    for (const dy of [0.056, 0.075]) parts.push(piece(new THREE.TorusGeometry(0.103, 0.012, 6, 24), P.AGAL, rig(3), (x) => { x.rotateX(Math.PI / 2 - 0.12); x.scale(0.92, 1, 1.02); x.translate(0, dy, -0.012); head(x); }));
  }
  // hijab: snug over the head, an oval left open for the face (forehead to chin), wrapped under the chin and down over
  // the neck onto the shoulders and chest
  {
    const face = (d) => { const o = (d.x / 0.64) ** 2 + ((d.y + 0.12) / 0.72) ** 2; return d.z > 0 ? Math.min(1, Math.max(0, (o - 0.8) / 0.35)) : 1; };
    parts.push(piece(skull(0.011, (d) => { const t = face(d); return t * t * (3 - 2 * t); }, [48, 36]), P.HIJAB, rig(3), head));
    const C = [V(0, 0.64, -0.03), V(0, 0.585, -0.022), V(0, 0.535, -0.012), V(0, 0.485, -0.004), V(0, 0.43, 0.0)];
    parts.push(piece(tube(C, [[0.086, 0.088], [0.092, 0.1], [0.13, 0.118], [0.195, 0.128], [0.225, 0.134]], { n: 14, segs: 18, ref: V(1, 0, 0), caps: [false, false] }), P.HIJAB, rig(1), body));
  }
  // arms: one tube shoulder → elbow → wrist (bicep, a rounded elbow, forearm, a narrow wrist), a hand on the end
  for (const sx of [-1, 1]) {
    const tbl = sx > 0 ? ARM_R : ARM_L;
    const [e, w] = tbl[frame] || ARMS[frame] || ARMS.relaxed;
    const S = B(V(sx * 0.175, 0.44, -0.005)), E = B(V(sx * e.x, e.y, e.z)), W = B(V(sx * w.x, w.y, w.z));
    const U = S.clone().lerp(E, 0.45).add(B(V(0, 0, 0.012)).sub(hip)), F = E.clone().lerp(W, 0.35);
    parts.push(piece(tube([S, U, E, F, W], [[0.062, 0.058], [0.056, 0.054], [0.044, 0.042], [0.043, 0.038], [0.03, 0.026]], { n: 20, segs: 10, ref: V(0, 0, 1) }), P.ARM, rig(2, sx)));
    const dir = W.clone().sub(E).normalize(), q = new THREE.Quaternion().setFromUnitVectors(Yax, dir);
    const fist = FIST[frame] || (frame === 'phone' && sx > 0);
    const Hc = W.clone().addScaledVector(dir, fist ? 0.045 : 0.06);
    parts.push(piece(fist ? roundBox(0.075, 0.08, 0.06, 0.6) : roundBox(0.08, 0.11, 0.03, 0.55), P.HAND, rig(2, sx), (g) => { g.rotateY(sx * 0.3); g.applyQuaternion(q); g.translate(Hc.x, Hc.y, Hc.z); }));
    // the thumb, along the inside of the hand
    const Th = W.clone().addScaledVector(dir, 0.03).add(new THREE.Vector3(-sx * 0.028, 0, 0.012).applyQuaternion(q));
    parts.push(piece(new THREE.CapsuleGeometry(0.012, 0.035, 2, 6), P.HAND, rig(2, sx), (g) => { g.rotateZ(sx * 0.5); g.applyQuaternion(q); g.translate(Th.x, Th.y, Th.z); }));
    if (frame === 'phone' && sx > 0) {
      // a phone held up to film, the torch on its back toward the pitch
      const Ph = Hc.clone().add(V(0, 0.07, 0.02));
      parts.push(piece(roundBox(0.075, 0.15, 0.012, 0.15), P.PHONE, rig(2, sx), (g) => { g.rotateX(-0.2); g.translate(Ph.x, Ph.y, Ph.z); }));
      parts.push(piece(new THREE.SphereGeometry(0.013, 8, 6), P.TORCH, rig(2, sx), (g) => { g.translate(Ph.x - 0.02, Ph.y + 0.055, Ph.z + 0.012); }));
    }
  }
  if (frame === 'scarf') {
    // the scarf held up taut between the hands, a little below them, sagging a touch in the middle
    const [, w] = ARMS.scarf;
    const Lh = B(V(-w.x, w.y, w.z)), Rh = B(V(w.x, w.y, w.z)), mid = Lh.clone().add(Rh).multiplyScalar(0.5);
    const g = new THREE.BoxGeometry(Lh.distanceTo(Rh) + 0.06, 0.17, 0.012, 16, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (Lh.distanceTo(Rh) / 2 + 0.03); p.setY(i, p.getY(i) - 0.035 * (1 - x * x)); }
    g.computeVertexNormals();
    parts.push(piece(g, P.SCARF, rig(2, 0), (x) => { x.translate(mid.x, mid.y - 0.03, mid.z + 0.03); }));
  }
  // legs: one tube hip → knee → ankle (thigh, a knee, calf, ankle), rounded shoes
  for (const sx of [-1, 1]) {
    const C = standing
      ? [V(sx * 0.098, 0.93, 0.0), V(sx * 0.103, 0.72, 0.02), V(sx * 0.105, 0.5, 0.035), V(sx * 0.105, 0.31, 0.0), V(sx * 0.105, 0.1, -0.005)]
      : [V(sx * 0.098, 0.5, -0.03), V(sx * 0.104, 0.54, 0.16), V(sx * 0.115, 0.525, 0.36), V(sx * 0.12, 0.33, 0.415), V(sx * 0.125, 0.11, 0.43)];
    parts.push(piece(tube(C, [[0.092, 0.084], [0.08, 0.076], [0.058, 0.058], [0.06, 0.064], [0.042, 0.042]], { n: 22, segs: 12, ref: V(1, 0, 0) }), P.LEGS, rig(0, sx)));
    const A = C[4];
    parts.push(piece(roundBox(0.1, 0.085, 0.27, 0.5), P.SHOE, rig(0, sx), (g) => { g.translate(A.x, 0.042, A.z + 0.06); }));
  }
  // thobe / abaya: one robe over both legs — across the lap, over the knees, falling straight to the ankles
  {
    const C = standing
      ? [V(0, 0.95, 0.0), V(0, 0.7, 0.012), V(0, 0.4, 0.015), V(0, 0.04, 0.012)]
      : [V(0, 0.5, -0.04), V(0, 0.555, 0.16), V(0, 0.545, 0.37), V(0, 0.33, 0.44), V(0, 0.05, 0.46)];
    const R = standing ? [[0.18, 0.14], [0.19, 0.13], [0.2, 0.13], [0.24, 0.16]] : [[0.185, 0.12], [0.195, 0.082], [0.2, 0.078], [0.19, 0.058], [0.215, 0.064]];
    parts.push(piece(tube(C, R, { n: 22, segs: 16, ref: V(1, 0, 0), caps: [false, true] }), P.ROBE, rig(0, 0)));
  }
  return mergeGeometries(parts);
}

/* ── the kits, from the club store's own product photos (Ahmed, 2026-10-27: "use the actual kit") ──
   One canvas, two halves: left, the 26/27 Nike home jersey's front (stripes, claw scratches, crest, swoosh, V-neck);
   right, the back of the black Captain's Shirt (the yellow ship print). The shirt shader maps its torso onto them. */
const KIT_SRC = [
  { url: '/img/store/home-26-27.jpg', crop: [195, 140, 380, 730], bg: [252, 210, 2] },   // x, y, w, h; the photo's white → yellow at the sides
  { url: '/img/store/captains-shirt.jpg', crop: [140, 240, 410, 560], bg: [16, 16, 16] },
];
const kitCanvas = document.createElement('canvas'); kitCanvas.width = 1024; kitCanvas.height = 1024;
const kitTex = new THREE.CanvasTexture(kitCanvas); kitTex.colorSpace = THREE.SRGBColorSpace; kitTex.anisotropy = 4;
export const kitTexture = kitTex;
export const kitsReady = Promise.all(KIT_SRC.map((k, i) => new Promise((res) => {
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => {
    const g = kitCanvas.getContext('2d', { willReadFrequently: true }), [x, y, w, h] = k.crop;
    g.drawImage(im, x, y, w, h, i * 512, 0, 512, 1024);
    const d = g.getImageData(i * 512, 0, 512, 1024), px = d.data;
    for (let j = 0; j < px.length; j += 4) {
      // the studio background: outside the shirt (the edges) it becomes the shirt colour; the swoosh stays white
      const col = (j / 4) % 512, white = px[j] > 235 && px[j + 1] > 235 && px[j + 2] > 235;
      if (white && (i === 1 || col < 40 || col > 472)) { px[j] = k.bg[0]; px[j + 1] = k.bg[1]; px[j + 2] = k.bg[2]; }
    }
    g.putImageData(d, i * 512, 0);
    kitTex.needsUpdate = true; res();
  };
  im.onerror = () => res();
  im.src = k.url;
})));

/* ── material ── */
// shirt numbers: the ten digits in one strip (white on clear), drawn once
let digits = null;
function digitsTex() {
  if (digits) return digits;
  const c = document.createElement('canvas'); c.width = 640; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "400 118px Anton, 'Anton Boot', Impact, sans-serif";
  for (let i = 0; i < 10; i++) g.fillText(String(i), i * 64 + 32, 68, 58);
  digits = new THREE.CanvasTexture(c); digits.flipY = true;
  return digits;
}
// uBake: 1 while baking the atlas (no motion, no fog); look per instance in aLook (skin, outfit, head, beard)
export function fanMaterial(fog, { bake = false } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uFogCol: { value: fog?.color || new THREE.Color() }, uFogD: { value: bake ? 0 : fog?.density || 0 }, uTime: { value: 0 }, uBake: { value: bake ? 1 : 0 }, uTorch: { value: 1 }, uDigits: { value: digitsTex() }, uKit: { value: kitTex } },
    vertexShader: /* glsl */ `
      attribute float aPart; attribute vec3 aLocal; attribute vec4 aRig; attribute vec4 aLook;
      uniform float uTime, uBake;
      varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vPart; varying vec4 vLook; varying float vH; varying float vSeed;
      vec3 rotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
      vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
      vec3 rotZ(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
      void main(){
        vec3 pos = position, nor = normal;
        float head = aLook.z;
        // a look hides the headwear it doesn't wear
        float hide = 0.0;
        if (abs(aPart - 7.0) < 0.5) hide = step(0.5, abs(head - 0.0));
        if (abs(aPart - 8.0) < 0.5) hide = step(0.5, abs(head - 1.0));
        if (abs(aPart - 9.0) < 0.5 || abs(aPart - 10.0) < 0.5) hide = 1.0 - step(abs(head - 2.5), 0.6);
        if (abs(aPart - 11.0) < 0.5) hide = step(0.5, abs(head - 4.0));
        float robe = step(2.5, aLook.y) * step(aLook.y, 4.5);
        if (abs(aPart - 5.0) < 0.5) hide = robe;                                // thobe / abaya: the robe covers the legs
        if (abs(aPart - 15.0) < 0.5) hide = 1.0 - robe;
        mat4 m = modelMatrix * instanceMatrix;
        float seed = fract(sin(dot(m[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        vSeed = seed;
        if (uBake < 0.5) {
          // alive in their seats: breathing and swaying, looking round now and then; clapping, waving, jumping
          float ph = seed * 6.2832;
          float kind = aRig.z, lean = aRig.y, side = aRig.w;
          bool standing = kind > 2.5 && kind < 3.5;
          vec3 hip = standing ? vec3(0.0, 0.93, 0.0) : vec3(0.0, 0.5, -0.06);
          vec3 sh = hip + rotX(vec3(side * 0.2, 0.45, 0.0), lean);
          if (aRig.x > 1.5 && aRig.x < 2.5) {
            float a = 0.0;
            if (kind > 0.5 && kind < 1.5) a = sin(uTime * 3.4 + ph) * 0.3;                     // cheering: arms wave
            else if (kind > 2.5 && kind < 3.5) a = sin(uTime * 3.0 + ph) * 0.22;                // ultras
            else if (kind > 3.5) a = sin(uTime * 1.3 + ph) * 0.04;                              // holding up a phone / scarf
            else a = sin(uTime * 1.1 + ph) * 0.03;
            pos = sh + rotZ(pos - sh, a * side); nor = rotZ(nor, a * side);
            if (kind > 1.5 && kind < 2.5) {                                                     // clapping: hands meet in front
              float c = (0.5 + 0.5 * sin(uTime * 9.0 + ph)) * 0.2;
              pos = sh + rotY(pos - sh, c * side); nor = rotY(nor, c * side);
            }
          }
          if (aRig.x > 2.5) {
            vec3 nk = hip + rotX(vec3(0.0, 0.58, 0.0), lean);
            float look = sin(uTime * 0.35 + ph) * 0.45 * smoothstep(0.3, 0.9, 0.5 + 0.5 * sin(uTime * 0.13 + ph * 1.7));
            float nod = sin(uTime * 0.8 + ph * 2.3) * 0.05;
            pos = nk + rotX(rotY(pos - nk, look), nod); nor = rotX(rotY(nor, look), nod);
          }
          if (aRig.x > 0.5) {
            float sx = sin(uTime * 0.9 + ph) * 0.03 + sin(uTime * 0.27 + ph) * 0.012;           // breathing + sway
            float sz = sin(uTime * 0.6 + ph * 1.3) * 0.03;
            pos = hip + rotZ(rotX(pos - hip, sx), sz); nor = rotZ(rotX(nor, sx), sz);
          }
          if (kind > 0.5 && kind < 1.5) pos.y += abs(sin(uTime * 3.4 + ph)) * 0.035;
          if (standing) pos.y += pow(abs(sin(uTime * 3.0 + ph)), 2.0) * 0.12;
        }
        vec4 w = m * vec4(pos, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * nor); vL = aLocal; vPart = aPart; vLook = aLook; vH = position.y;
        gl_Position = hide > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFogCol; uniform float uFogD, uTorch; uniform sampler2D uDigits, uKit;
      varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vPart; varying vec4 vLook; varying float vH; varying float vSeed;
      bool is(float p){ return abs(vPart - p) < 0.5; }
      void main(){
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        if (dot(n, v) < 0.0) n = -n;
        float outfit = vLook.y, head = vLook.z, beard = vLook.w;
        vec3 skin = mix(vec3(0.62, 0.42, 0.3), vec3(0.19, 0.115, 0.075), vLook.x);
        vec3 Y = vec3(0.86, 0.62, 0.0), K = vec3(0.018, 0.018, 0.02), WH = vec3(0.84, 0.83, 0.8);
        vec3 hairC = vec3(0.022, 0.016, 0.012);
        bool thobe = abs(outfit - 3.0) < 0.5, abaya = abs(outfit - 4.0) < 0.5;
        // the shirt in its own coordinates: torso and arms are swept tubes, aLocal = (cos round, along, sin round)
        float sx = vL.x * 0.17;
        vec3 shirt =
          outfit < 0.5 ? Y : outfit < 1.5 ? K :                                                    // (the home kit and the black tee: their photos, below)
          outfit < 2.5 ? Y : thobe ? WH : abaya ? K : mix(vec3(0.86, 0.6, 0.16), K, step(0.9, vL.y) * step(vL.y, 0.95));   // gold, a black collar
        vec3 legs = mix(vec3(0.05, 0.075, 0.14), vec3(0.03), step(0.55, vSeed));
        vec3 base = shirt; float sss = 0.0, gloss = 0.03, emit = 0.0, fold = 1.0;
        if (is(0.0)) {
          float u = vL.y, back = step(0.3, vL.z);
          float kv = clamp((u - 0.08) / 0.85, 0.0, 1.0);
          if (outfit < 0.5) {
            // the home jersey: its front photo; the back takes the same stripes from a plain row of it
            vec2 kuv = back > 0.5 ? vec2((0.5 - vL.x * 0.5) * 0.5, 0.616) : vec2((0.5 + vL.x * 0.5) * 0.5, kv);
            base = texture2D(uKit, kuv).rgb * 0.92;
          } else if (outfit < 1.5) {
            // the Captain's Shirt: plain black, the ship print on the back
            base = back > 0.5 ? texture2D(uKit, vec2(0.5 + (0.5 - vL.x * 0.5) * 0.5, kv)).rgb * 0.9 : K;
          }
          float nx = 1.0 - (vL.x + 0.4) / 0.8, ny = (u - 0.42) / 0.34;
          float num = floor(fract(vSeed * 13.7) * 12.0);
          float n = num < 0.5 ? 9.0 : num < 1.5 ? 10.0 : num < 2.5 ? 7.0 : num < 3.5 ? 11.0 : num < 4.5 ? 8.0 : num < 5.5 ? 19.0 : num < 6.5 ? 20.0 : num < 7.5 ? 4.0 : num < 8.5 ? 14.0 : num < 9.5 ? 27.0 : num < 10.5 ? 1.0 : 6.0;
          float two = step(9.5, n), d = two > 0.5 ? (nx < 0.5 ? floor(n / 10.0) : mod(n, 10.0)) : n;
          float fx = two > 0.5 ? fract(nx * 2.0) : (nx - 0.25) * 2.0;
          float inBox = step(0.0, fx) * step(fx, 1.0) * step(0.0, ny) * step(ny, 1.0) * step(0.0, nx) * step(nx, 1.0);
          vec2 duv = vec2((d + clamp(fx, 0.0, 1.0)) / 10.0, clamp(ny, 0.0, 1.0));
          float noNum = max(1.0 - step(0.5, abs(outfit - 1.0)), step(2.5, outfit) * step(outfit, 4.5));   // no number on the tee, thobe, abaya
          float on = inBox * back * (1.0 - noNum) * step(vSeed, 0.75);
          float g = texture2D(uDigits, duv).a * on;
          // a yellow edge round black digits, so they read across the stripes
          float e = max(max(texture2D(uDigits, duv + vec2(0.004, 0.0)).a, texture2D(uDigits, duv - vec2(0.004, 0.0)).a), max(texture2D(uDigits, duv + vec2(0.0, 0.03)).a, texture2D(uDigits, duv - vec2(0.0, 0.03)).a)) * on;
          base = mix(base, Y, max(e - g, 0.0) * step(outfit, 0.5));
          base = mix(base, K, g);
          fold = 0.93 + 0.07 * sin(vL.y * 26.0 + vL.x * 2.0);
        }
        if (is(1.0) || is(4.0)) { base = skin; sss = 1.0; gloss = 0.06; }
        else if (is(3.0)) {
          // one tube shoulder to wrist: short sleeves on a shirt, long ones on a thobe or abaya, a cuff at the end
          float sl = (thobe || abaya) ? 0.94 : 0.42;
          float sleeve = step(vL.y, sl);
          vec3 sc = shirt;   // the home kit's raglan sleeves are plain yellow, the tee's black
          base = mix(skin, sc * (1.0 - 0.25 * smoothstep(sl - 0.05, sl, vL.y)), sleeve);
          sss = 1.0 - sleeve;
        }
        else if (is(5.0)) { base = legs; fold = 0.92 + 0.08 * sin(vL.y * 40.0); }
        else if (is(15.0)) {
          // the robe: soft folds falling from the knees
          base = thobe ? WH : K;
          float a = atan(vL.z, vL.x);
          fold = 0.86 + 0.14 * (0.5 + 0.5 * sin(a * 9.0 + vL.y * 4.0)) * smoothstep(0.35, 0.75, vL.y) + 0.06 * (1.0 - smoothstep(0.35, 0.75, vL.y));
        }
        else if (is(6.0)) base = thobe ? vec3(0.2, 0.12, 0.06) : step(0.5, fract(vSeed * 7.3)) > 0.5 ? vec3(0.78) : vec3(0.03);
        else if (is(7.0)) base = hairC;
        else if (is(8.0)) base = step(0.5, fract(vSeed * 3.1)) > 0.5 ? Y : K;
        else if (is(9.0)) {
          // white ghutra, or the red shemagh's check
          vec2 q = fract(vec2(atan(vL.x, vL.z) * 6.0, vL.y * 60.0));
          float chk = step(0.5, q.x) * step(0.5, q.y) + 0.35 * step(0.5, q.x + q.y - floor(q.x + q.y) );
          base = head < 2.5 ? WH : mix(WH, vec3(0.55, 0.04, 0.04), clamp(chk, 0.0, 1.0));
        }
        else if (is(10.0)) base = vec3(0.012);
        else if (is(11.0)) base = K * 1.4;
        else if (is(12.0)) base = vec3(0.03);
        else if (is(13.0)) { base = vec3(1.0, 0.96, 0.88); emit = 3.5 * uTorch; }
        else if (is(14.0)) base = mix(Y, K, step(0.5, fract(vL.x / 0.11)));
        else if (is(2.0)) {
          // the face, drawn on the skull in its own coordinates (+z looks at the pitch)
          vec3 d = normalize(vL);
          base = skin; sss = 1.0; gloss = 0.07;
          float front = smoothstep(0.2, 0.6, d.z), ax = abs(d.x);
          float eyes = (1.0 - smoothstep(0.045, 0.075, length(vec2(ax - 0.34, (d.y - 0.07) * 1.5)))) * front;
          float white = (1.0 - smoothstep(0.07, 0.1, length(vec2((ax - 0.34) * 0.8, (d.y - 0.07) * 2.2)))) * front;
          float brows = (1.0 - smoothstep(0.018, 0.036, abs(d.y - 0.19 + 0.1 * ax))) * step(0.12, ax) * step(ax, 0.52) * front;
          float lips = (1.0 - smoothstep(0.03, 0.05, abs(d.y + 0.38))) * (1.0 - smoothstep(0.16, 0.22, ax)) * front;
          float mouth = (1.0 - smoothstep(0.006, 0.016, abs(d.y + 0.38))) * (1.0 - smoothstep(0.15, 0.2, ax)) * front;
          base = mix(base, vec3(0.62, 0.58, 0.55), white * 0.55);
          base = mix(base, vec3(0.025, 0.018, 0.014), eyes);
          base = mix(base, skin * vec3(0.62, 0.42, 0.38), lips * 0.6);
          base = mix(base, vec3(0.06, 0.03, 0.025), mouth * 0.8);
          // beard: along the jaw to the sideburns and over the chin, a moustache, cheeks left clear; stubble on a buzz cut
          float jaw = smoothstep(-0.26, -0.36, d.y + 0.25 * smoothstep(0.35, 0.75, ax));
          float burns = smoothstep(0.64, 0.74, ax) * smoothstep(0.05, -0.1, d.y) * step(-0.25, d.z);
          float tache = (1.0 - smoothstep(0.025, 0.045, abs(d.y + 0.3))) * (1.0 - smoothstep(0.24, 0.3, ax)) * front;
          float grain = 0.75 + 0.25 * fract(sin(dot(floor(vL * 900.0), vec3(12.9, 78.2, 37.7))) * 43758.5);
          float bd = clamp(max(max(jaw, burns), tache) * (1.0 - lips * 0.9), 0.0, 1.0) * grain;
          base = mix(base, hairC * 1.4, beard * bd * 0.9);
          base = mix(base, mix(skin, hairC, 0.78) * grain, step(4.5, head) * smoothstep(0.18, 0.34, d.y + 0.3 * (1.0 - d.z)));   // a buzz cut, dark from behind too
        }
        // floodlights high above the roof edge; sky fill from above, red bounce from the seats below; the lights behind
        // the stand catch the edges
        vec3 L = normalize(vec3(0.25, 1.0, 0.35));
        float wrap = 0.12 + 0.25 * sss;
        float diff = max((dot(n, L) + wrap) / (1.0 + wrap), 0.0);
        vec3 amb = mix(vec3(0.17, 0.075, 0.045), vec3(0.24, 0.26, 0.31), 0.5 + 0.5 * n.y);
        float ao = 0.55 + 0.45 * smoothstep(0.05, 0.8, vH);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        float spec = pow(max(dot(reflect(-L, n), v), 0.0), 24.0) * gloss;
        vec3 col = base * fold * (amb * 1.15 + vec3(1.0, 0.96, 0.9) * diff * 0.95) * ao;
        col += vec3(0.75, 0.78, 0.9) * fres * 0.22 * (0.35 + base) + spec + base * emit;
        col += skin * vec3(0.18, 0.05, 0.02) * sss * (1.0 - diff) * 0.3;                       // light through skin
        float dd = length(cameraPosition - vW), f = 1.0 - exp(-dd * dd * uFogD * uFogD);
        gl_FragColor = vec4(mix(col, uFogCol, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
// a look as the aLook attribute values
export const lookAttr = (i) => { const L = LOOKS[i]; return [L.skin, L.outfit, L.head, L.beard]; };

// the instanced 3D fans for a set of seats: placements [{ matrix, look, pose }] → { meshes: [{ mesh, idx }] }
const geoCache = new Map();
const geoFor = (frame) => { if (!geoCache.has(frame)) geoCache.set(frame, fanGeometry(frame)); return geoCache.get(frame); };
const rbMats = new Map();
export function fanMeshes(placements, mat) {
  if (FAN_MODE === 'real' && RB) return rbMeshes(placements, mat);
  const byPose = new Map();
  placements.forEach((p, i) => { if (!byPose.has(p.pose)) byPose.set(p.pose, []); byPose.get(p.pose).push(i); });
  const out = [];
  for (const [pose, idx] of byPose) {
    const frame = FRAMES[FRAME_OF[pose][0]];
    const g = geoFor(frame).clone();
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(new Float32Array(idx.flatMap((i) => placements[i].lookVals || lookAttr(placements[i].look))), 4));
    const mesh = new THREE.InstancedMesh(g, mat, idx.length);
    idx.forEach((i, k) => mesh.setMatrixAt(k, placements[i].matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    out.push({ mesh, idx });
  }
  return out;
}

// the realistic people: one instanced mesh per look and pose; a pose with motion (clap, cheer, jump) gets its two
// frames as two meshes, shown in turn, each half of the fans a beat apart (tick(t) from the seat map's loop)
function rbMeshes(placements, mat) {
  const fog = { color: mat.uniforms.uFogCol.value, density: mat.uniforms.uFogD.value };
  const groups = new Map();
  placements.forEach((p, i) => {
    const look = p.lookVals ? rbLookOf(p.lookVals) : p.look, k = `${look}|${p.pose}`;
    if (!groups.has(k)) groups.set(k, { look, pose: p.pose, idx: [] });
    groups.get(k).idx.push(i);
  });
  const out = [];
  for (const { look, pose, idx } of groups.values()) {
    if (!rbMats.has(look)) rbMats.set(look, RB.material(look, fog));
    const [r0, nf] = FRAME_OF[pose];
    const make = (fr, list) => {
      const mesh = new THREE.InstancedMesh(RB.geometry(look, FRAMES[fr]), rbMats.get(look), Math.max(1, list.length));
      list.forEach((i, k) => mesh.setMatrixAt(k, placements[i].matrix));
      mesh.count = list.length; mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false;
      return { mesh, idx: list };
    };
    if (nf < 2) { out.push(make(r0, idx)); continue; }
    const rate = pose === 'clap' ? 2.2 : pose === 'cheer' ? 1.7 : 1.5;
    [0, 1].forEach((half) => {
      const list = idx.filter((_, k) => k % 2 === half);
      if (!list.length) return;
      const a = make(r0, list), b = make(r0 + 1, list);
      const tick = (t) => { const on = ((t * rate + half * 0.5) % 1) < 0.5; a.mesh.visible = on; b.mesh.visible = !on; };
      out.push({ ...a, tick }, { ...b });
    });
  }
  return out;
}

/* ── the atlas: every look × every frame, from the front and from above ── */
const TILE_M = [0.9, 2.25];          // a tile's size in metres
const ELEV = [0.07, 0.84];            // the two bake angles (radians above the horizon)
const CENTRE = (frame) => (frame.startsWith('stand') ? V(0, 1.12, 0.03) : V(0, 0.8, 0.1));
export function bakeFanAtlas(renderer, { tile = [96, 240] } = {}) {
  const real = FAN_MODE === 'real' && RB;
  const cols = real ? RB_LOOKS.length : LOOKS.length, rows = FRAMES.length, [tw, th] = tile;
  const rt = new THREE.WebGLRenderTarget(cols * 2 * tw, rows * th, { samples: 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, colorSpace: THREE.SRGBColorSpace });
  const scene = new THREE.Scene();
  const mat = fanMaterial(null, { bake: true });
  const rmats = real ? RB_LOOKS.map((_, c) => RB.material(c, null, { bake: true })) : [];
  // per frame: one instanced mesh of all the looks (code-built), or one mesh per look (real people)
  const meshes = FRAMES.map((fr) => {
    if (real) return RB_LOOKS.map((_, c) => { const m = new THREE.InstancedMesh(RB.geometry(c, fr), rmats[c], 1); m.frustumCulled = false; scene.add(m); return m; });
    const g = geoFor(fr).clone();
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(new Float32Array(LOOKS.flatMap((_, i) => lookAttr(i))), 4));
    const m = new THREE.InstancedMesh(g, mat, cols); m.frustumCulled = false; scene.add(m); return m;
  });
  const place = (r, c, M) => { if (real) { meshes[r][c].setMatrixAt(0, M); meshes[r][c].instanceMatrix.needsUpdate = true; } else meshes[r].setMatrixAt(c, M); };
  const hw = (cols * TILE_M[0]) / 2, hh = (rows * TILE_M[1]) / 2;
  const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 1, 200);
  const prev = { rt: renderer.getRenderTarget(), auto: renderer.autoClear, col: renderer.getClearColor(new THREE.Color()), a: renderer.getClearAlpha() };
  const torch = [];
  const M = new THREE.Matrix4();
  renderer.setClearColor(new THREE.Color(0.2, 0.11, 0.07), 0);
  renderer.setRenderTarget(rt); renderer.clear();
  renderer.autoClear = false;
  ELEV.forEach((el, e) => {
    const fwd = V(0, Math.sin(el), Math.cos(el)), up = V(0, Math.cos(el), -Math.sin(el)), right = V(1, 0, 0);
    cam.position.copy(fwd).multiplyScalar(80); cam.up.set(0, 1, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
    FRAMES.forEach((fr, r) => {
      const C = CENTRE(fr);
      for (let c = 0; c < cols; c++) {
        const P0 = right.clone().multiplyScalar((c - (cols - 1) / 2) * TILE_M[0]).addScaledVector(up, ((rows - 1) / 2 - r) * TILE_M[1]);
        M.makeTranslation(P0.x - C.x, P0.y - C.y, P0.z - C.z);
        place(r, c, M);
      }
      if (!real) meshes[r].instanceMatrix.needsUpdate = true;
      if (fr === 'phone') {
        // where the torch lands inside its tile (the crowd shader glows it after dark)
        const g = geoFor(fr), pa = g.attributes.aPart, pp = g.attributes.position, t = V(0, 0, 0);
        let n = 0; for (let i = 0; i < pa.count; i++) if (pa.getX(i) === P.TORCH) { t.x += pp.getX(i); t.y += pp.getY(i); t.z += pp.getZ(i); n++; }
        t.divideScalar(Math.max(1, n)).sub(C);
        torch.push(0.5 + t.dot(right) / TILE_M[0], 0.5 + t.dot(up) / TILE_M[1]);
      }
    });
    rt.viewport.set(e * cols * tw, 0, cols * tw, rows * th);
    rt.scissor.set(e * cols * tw, 0, cols * tw, rows * th); rt.scissorTest = true;
    renderer.render(scene, cam);
  });
  rt.scissorTest = false; rt.viewport.set(0, 0, rt.width, rt.height); rt.scissor.set(0, 0, rt.width, rt.height);
  renderer.setRenderTarget(prev.rt); renderer.autoClear = prev.auto; renderer.setClearColor(prev.col, prev.a);
  if (!real) meshes.forEach((m) => m.geometry.dispose());
  mat.dispose(); rmats.forEach((m) => m.dispose());
  return { texture: rt.texture, rt, cols, rows, size: [rt.width, rt.height], torch };
}

/* ── the whole bowl's crowd: one card per occupied seat ── */
// tiers: [{ i, mat (the stand's seat shader), rows, seats, aisles, upper, seatPos(sx, sy) → { p, n, th }, gap(th) → bool }]
export async function buildCrowd({ renderer, tiers, lite = false }) {
  await kitsReady;   // the shirts are printed from the store's photos: bake once they're in
  if (FAN_MODE === 'real') RB = await loadRocketbox();
  const atlas = bakeFanAtlas(renderer, { tile: lite ? [64, 160] : [96, 240] });
  const quad = new THREE.PlaneGeometry(1, 1);
  const meshes = tiers.map((T) => {
    const base = [], dir = [], tile = [], cell = [];
    for (let sy = 0; sy < T.rows; sy++) {
      const v = (sy + 0.5) / T.rows;
      for (let sx = 0; sx < T.seats; sx++) {
        const u = (sx + 0.5) / T.seats, th = u * Math.PI * 2, ac = (u * T.aisles) % 1;
        if (ac < 0.05 || ac > 0.97) continue;                                                     // the stairways
        if (!T.upper && v > 0.48 && v < 0.76 && ac > 0.43 && ac < 0.57 && Math.floor(u * T.aisles) % 2 === 1) continue;   // vomitories
        if (T.gap?.(th)) continue;                                                                // the tunnel mouth
        const f = fanAt(T.i, sx, sy, th);
        if (!f) continue;
        const { p, n } = T.seatPos(sx, sy);
        const [r0, nf] = FRAME_OF[f.pose];
        base.push(p.x, p.y, p.z); dir.push(n.x, n.z);
        tile.push(f.look, r0, nf, hash(sx, sy, 41));
        cell.push(sx, sy, f.flip);
      }
    }
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index; g.setAttribute('position', quad.attributes.position);
    g.setAttribute('aBase', new THREE.InstancedBufferAttribute(new Float32Array(base), 3));
    g.setAttribute('aDir', new THREE.InstancedBufferAttribute(new Float32Array(dir), 2));
    g.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(tile), 4));
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(cell), 3));
    g.instanceCount = base.length / 3;
    const mat = crowdCardMat(T, atlas);
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.raycast = () => {};                     // the seat picker aims at the stands, not the people
    mesh.renderOrder = 1;
    // the stand's own shader carries the live state (tifo, picked block, categories, the 3D patch): follow it
    const S = T.mat.uniforms, U = mat.uniforms;
    mesh.onBeforeRender = () => {
      U.uPatch.value.copy(S.uPatch.value); U.uPick.value.copy(S.uPick.value); U.uCatOn.value = S.uCatOn.value; U.uCats.value = S.uCats.value;
      U.uPhones.value = S.uPhones.value; U.uTifo.value.copy(S.uTifo.value);
      U.tA.value = S.uBowlA?.value || null; U.tB.value = S.uBowlB?.value || null;
      if (S.uBowlT) U.tT.value.copy(S.uBowlT.value); if (S.uBowlW) U.tW.value.copy(S.uBowlW.value); if (S.uBowlRow) U.tRow.value.copy(S.uBowlRow.value);
      if (!U.tA.value || !U.tB.value) U.tT.value.w = 0;
    };
    return { mesh, mat, count: g.instanceCount };
  });
  return { meshes, atlas };
}

function crowdCardMat(T, atlas) {
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAtlas: { value: atlas.texture }, uAtlasSize: { value: new THREE.Vector2(...atlas.size) },
      uGrid: { value: new THREE.Vector2(atlas.cols, atlas.rows) }, uTileM: { value: new THREE.Vector2(...TILE_M) }, uElev: { value: new THREE.Vector2(...ELEV) },
      uTorchUV: { value: new THREE.Vector4(...atlas.torch) }, uRows: { value: T.rows }, uSeats: { value: T.seats }, uAisles: { value: T.aisles }, uUpper: { value: T.upper ? 1 : 0 },
      uPatch: { value: new THREE.Vector4(1, 0, 1, 0) }, uPick: { value: new THREE.Vector4(-1, -1, -1, 0) }, uCatOn: { value: 0 }, uCats: { value: blank }, uPhones: { value: 1 }, uTifo: { value: new THREE.Vector3() },
      tA: { value: blank }, tB: { value: blank }, tT: { value: new THREE.Vector4(-1e6, 1, 0, 0) }, tW: { value: new THREE.Vector4(0.75, 1, 0, 1) }, tRow: { value: new THREE.Vector2(0, 1) },
      uFogCol: T.mat.uniforms.uFogCol, uFogD: T.mat.uniforms.uFogD,
    },
    vertexShader: /* glsl */ `
      attribute vec3 aBase; attribute vec2 aDir; attribute vec4 aTile; attribute vec3 aCell;
      uniform float uTime, uRows, uSeats, uAisles, uUpper, uCatOn; uniform vec3 uCam, uTifo;
      uniform vec2 uGrid, uTileM, uElev; uniform vec4 uPatch, uPick, tT, tW; uniform vec2 tRow;
      uniform sampler2D uCats, tA, tB;
      varying vec2 vUv; varying vec2 vTile; varying vec3 vW; varying float vLit; varying vec3 vCat; varying float vGlow; varying float vTorch; varying float vTint; varying float vTop;
      float h1(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float sx = aCell.x, sy = aCell.y, seed = aTile.w;
        float hide = 0.0;
        // in the 3D patch (seats.js) the same fans are drawn as models
        hide += step(uPatch.x, sx) * step(sx, uPatch.y) * step(uPatch.z, sy) * step(sy, uPatch.w);
        // under the far stand's card display
        if (uTifo.z > 0.0) hide += step(abs(atan(aBase.z, aBase.x) - uTifo.x), uTifo.y);
        // under the whole-stadium tifo's cards (world.js crowdMat paints them; same maths)
        if (tT.w > 0.0) {
          float br = tRow.x + sy;
          vec2 tuv = vec2((sx + 0.5) / uSeats, (br + 0.5) / tRow.y);
          vec4 ca = texture2D(tA, tuv), cb = texture2D(tB, tuv);
          float ts = tT.z - tT.x - fract((tuv.x - tW.x) * tW.y) * tT.y - (br / tRow.y) * 0.45 - h1(sx * 7.1 + sy) * 0.12;
          float fk = clamp(ts / 0.38, 0.0, 1.0);
          float a = fk < 0.5 ? ca.a : cb.a;
          hide += step(0.5, a * tT.w * abs(cos(fk * 3.14159)));
        }
        // which frame: motion swaps between two
        float fr = aTile.y;
        float rate = fr < 2.5 ? 0.0 : fr < 3.5 ? 4.4 : fr < 5.5 ? 1.7 : fr > 7.5 ? 1.5 : 0.0;
        if (aTile.z > 1.5) fr += step(0.5, fract(uTime * rate + seed * 7.0));
        bool standing = aTile.y > 7.5;
        vec3 fwd = normalize(vec3(aDir.x, 0.0, aDir.y));
        vec3 C = aBase + vec3(0.0, standing ? 1.12 : 0.8, 0.0) + fwd * (standing ? 0.2 : 0.1);
        if (standing) C.y += pow(abs(sin(uTime * 3.0 + seed * 40.0)), 2.0) * 0.12;
        else if (aTile.y > 3.5 && aTile.y < 5.5) C.y += abs(sin(uTime * 3.4 + seed * 40.0)) * 0.035;
        // a card facing the camera, the bake from the front or from above (whichever is nearer the view)
        vec3 f = normalize(uCam - C);
        float el = asin(clamp(f.y, -1.0, 1.0));
        float top = step(mix(uElev.x, uElev.y, 0.42 + seed * 0.16), el);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), f)); vec3 up = cross(f, right);
        float sway = (sin(uTime * 0.9 + seed * 30.0) * 0.025) * position.y;
        vec3 wp = C + right * (position.x * uTileM.x + sway) + up * position.y * uTileM.y;
        wp += normalize(uCam - wp) * 0.45;                       // drawn a touch nearer: the row behind doesn't clip it
        // atlas: column = look (+ the from-above half), row = frame (row 0 at the top)
        vec2 t = vec2(position.x * aCell.z + 0.5, position.y + 0.5);
        vTile = vec2(aCell.z > 0.0 ? t.x : 1.0 - t.x, t.y);
        vUv = vec2((aTile.x + top * uGrid.x + t.x) / (uGrid.x * 2.0), 1.0 - (fr + 1.0 - t.y) / uGrid.y);
        vTop = top;
        vTorch = abs(fr - 6.0) < 0.5 ? step(seed, 0.6) : 0.0;
        // lit like the steps under them: brighter at the front, shaded under the roof up top
        float v = (sy + 0.5) / uRows;
        vLit = (0.82 + 0.18 * (1.0 - v)) * mix(1.0, 0.5, uUpper * smoothstep(0.55, 1.0, v));
        vTint = 0.9 + 0.2 * h1(seed * 91.0);
        float u = (sx + 0.5) / uSeats, blk = floor(u * uAisles);
        vCat = uCatOn > 0.0 ? texture2D(uCats, vec2((blk + 0.5) / uAisles, 0.5)).rgb : vec3(0.0);
        vGlow = (1.0 - step(0.5, abs(blk - uPick.z))) * uPick.w;
        vW = wp;
        gl_Position = hide > 0.5 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform vec2 uAtlasSize; uniform vec4 uTorchUV; uniform float uCatOn, uPhones; uniform vec3 uCam, uFogCol; uniform float uFogD;
      varying vec2 vUv; varying vec2 vTile; varying vec3 vW; varying float vLit; varying vec3 vCat; varying float vGlow; varying float vTorch; varying float vTint; varying float vTop;
      void main(){
        vec4 tx = texture2D(uAtlas, vUv);
        // keep far-off fans solid as the atlas's mip levels average their edges away
        vec2 dx = dFdx(vUv * uAtlasSize), dy = dFdy(vUv * uAtlasSize);
        float mip = max(0.0, 0.5 * log2(max(dot(dx, dx), dot(dy, dy))));
        float a = tx.a * (1.0 + mip * 0.3);
        vec2 tu = vTop > 0.5 ? uTorchUV.zw : uTorchUV.xy;
        float torch = vTorch * uPhones * (1.0 - smoothstep(0.0, 0.05, length((vTile - tu) * vec2(0.4, 1.0))));
        if (a < 0.5 && torch < 0.3) discard;
        vec3 col = tx.rgb * vLit * vTint;
        col = mix(col, vCat * (0.35 + 0.5 * vLit), uCatOn * 0.62);
        col = mix(col, col * 1.8 + vec3(0.06, 0.05, 0.0), vGlow);
        col += vec3(1.0, 0.95, 0.85) * torch * 5.0;
        float d = length(uCam - vW), f = 1.0 - exp(-d * d * uFogD * uFogD);
        gl_FragColor = vec4(mix(col, uFogCol, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/* ── one fan on their own, for the avatar builder: mountFanPreview(el, look) → { set(look), dispose() } ──
   look: { skin 0–1, outfit 0–4, head 0–5, beard 0|1, pose: one of POSES } (outfit/head numbers as in LOOKS above).
   Drag to turn them round; they idle (or cheer, clap…) in place. */
export function mountFanPreview(el, look = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.append(renderer.domElement);
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block', touchAction: 'pan-y' });
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const mat = fanMaterial(null);
  const root = new THREE.Group(); scene.add(root);
  // a stadium seat to sit on (the bowl's red moulded seat, simplified), and a soft shadow on the floor
  const seatM = new THREE.MeshStandardMaterial({ color: 0xa8260c, roughness: 0.55 }), metal = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const seat = new THREE.Group();
  const pan = new THREE.Mesh(roundBox(0.46, 0.05, 0.42, 0.35), seatM); pan.position.set(0, 0.44, -0.02); pan.rotation.x = 0.08;
  const back = new THREE.Mesh(roundBox(0.46, 0.44, 0.05, 0.35), seatM); back.position.set(0, 0.72, -0.22); back.rotation.x = -0.18;
  seat.add(pan, back);
  for (const x of [-0.24, 0.24]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.05), metal); leg.position.set(x, 0.22, -0.14); seat.add(leg); }
  root.add(seat);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; root.add(shadow);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x3a1a10, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1, 3, 2); scene.add(key);
  let mesh = null, cur = { skin: 0.4, outfit: 0, head: 0, beard: 1, pose: 'relaxed', ...look };
  function build() {
    if (mesh) { root.remove(mesh); mesh.geometry.dispose(); }
    const pose = cur.pose === 'stand' ? 'stand' : cur.pose;
    const g = geoFor(FRAMES[FRAME_OF[pose]?.[0] ?? 0]).clone();
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(new Float32Array([cur.skin, cur.outfit, cur.head, cur.beard ? 1 : 0]), 4));
    mesh = new THREE.InstancedMesh(g, mat, 1); mesh.setMatrixAt(0, new THREE.Matrix4()); mesh.frustumCulled = false;
    root.add(mesh);
    const standing = pose === 'stand', C = CENTRE(FRAMES[FRAME_OF[pose]?.[0] ?? 0]);
    seat.visible = !standing;
    // framed head to toe, raised arms included
    cam.position.set(0, C.y + 0.4, standing ? 5.4 : 5.0); cam.lookAt(0, C.y + (standing ? 0.0 : 0.12), 0);
  }
  build();
  // turn by dragging, ease back toward a three-quarter view when let go
  let yaw = -0.35, vy = 0, drag = null;
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: yaw }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (drag) yaw = drag.y + (e.clientX - drag.x) * 0.012; });
  const up = () => { drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const size = () => { const w = el.clientWidth || 1, h = el.clientHeight || 1; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(size); ro.observe(el); size();
  let raf = 0, last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    mat.uniforms.uTime.value += dt;
    if (!drag) { vy += (-0.35 - yaw) * dt * 1.5; vy *= 0.9; yaw += vy * dt * 10; }
    root.rotation.y = yaw;
    renderer.render(scene, cam);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    set(next) { cur = { ...cur, ...next }; build(); },
    get look() { return { ...cur }; },
    get camera() { return cam; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); mesh?.geometry.dispose(); mat.dispose(); renderer.dispose(); cv.remove(); },
  };
}
