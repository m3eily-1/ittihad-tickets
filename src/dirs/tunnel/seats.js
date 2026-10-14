// The seat map, at the end of the walk (Ahmed's picks, 2026-10-11). Three levels:
//   stadium  — move freely round the bowl (drag to orbit, right/shift-drag to pan, pinch or ctrl+wheel or
//              the +/− buttons to zoom); point at the stands and the section (block) under the pointer
//              lights up. Click it →
//   section  — the camera flies in front of that block. Its seats are real 3D moulded seats with simple
//              3D fans in some of them (Ahmed: "seats + simple 3D fans"); point at a seat, click it →
//   seat     — the camera sits in that seat for its view of the pitch; drag to look around.
// "Back" steps out one level (seat → section → stadium); Esc too; scrolling away leaves it all.
//
// Seats are the model's own grid: the rows × seats × aisles the stand shader paints on the steps, so the
// seat you click is the seat you land in. Block / row / seat numbers count that grid — not Al-Jawhara's
// official seat plan — so the panel says "indicative view".
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOWL, ringXZ, stepRow } from './world.js';

const TIERS = [['lower', 'Lower tier', 'L'], ['middle', 'Middle tier', 'M'], ['upper', 'Upper tier', 'U']];
const EYE = 1.18;                 // seated eye height above the tread
const FLY = 2.2;                  // seconds per flight
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const hash = (a, b, c) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); };
const wrap = (sx, n) => ((sx % n) + n) % n;

// where in the bowl a block sits, from its angle round the pitch (the pitch runs along x; the tunnel
// comes in on the +z side)
function standOf(th) {
  const x = Math.cos(th) / 63, z = Math.sin(th) / 45;
  if (Math.abs(x) > Math.abs(z) * 1.3) return 'Behind the goal';
  if (Math.abs(z) > Math.abs(x) * 1.3) return z > 0 ? 'Tunnel side' : 'Opposite side';
  return 'Corner';
}

/* ── 3D seat and fan models (one merged geometry each; aPart picks the colour) ──
   parts: 0 seat plastic / shirt (instance colour) · 1 skin · 2 trousers (or thobe) · 3 hair (or shemagh)
          4 dark metal · 5 shoes */
function part(geo, p, tf) {
  tf(geo);
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  g.clearGroups();
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(p), 1));
  return g;
}
const at = (x, y, z, rx = 0, ry = 0, rz = 0) => (g) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); };
function rounded(w, h, r, arch = 0) {
  // a rounded rectangle centred on the origin (the top edge can arch up, like a seat back's top)
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.quadraticCurveTo(0, y + h + arch, x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const slab = (shape, depth) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 6 }); g.translate(0, 0, -depth / 2); return g; };
function seatGeometry() {
  // a moulded stadium seat as in the real bowl: a contoured backrest that wraps a little at the sides and
  // arches at the top, a rounded pan tilted back, two dark side brackets down to the tread.
  // Local frame: on the tread, facing +z (the pitch).
  const back = slab(rounded(0.44, 0.4, 0.07, 0.04), 0.03);
  const bp = back.attributes.position;
  for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i); bp.setZ(i, bp.getZ(i) + x * x * 0.9 + (y < -0.12 ? (y + 0.12) * -0.35 : 0)); }   // wrap + lumbar curve
  back.computeVertexNormals();
  const pan = slab(rounded(0.44, 0.39, 0.07), 0.04);
  const pp = pan.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i); pp.setZ(pp.getZ(i) !== undefined ? i : i, pp.getZ(i) - x * x * 0.25); }   // dished a touch
  pan.computeVertexNormals();
  return mergeGeometries([
    part(pan, 0, (g) => { g.rotateX(-Math.PI / 2 + 0.08); g.translate(0, 0.44, 0.06); }),
    part(back, 0, (g) => { g.rotateX(-0.2); g.translate(0, 0.7, -0.17); }),
    part(new THREE.BoxGeometry(0.03, 0.46, 0.05), 4, at(-0.235, 0.23, -0.12)),
    part(new THREE.BoxGeometry(0.03, 0.46, 0.05), 4, at(0.235, 0.23, -0.12)),
    part(new THREE.BoxGeometry(0.03, 0.03, 0.34), 4, at(-0.235, 0.42, 0.0)),
    part(new THREE.BoxGeometry(0.03, 0.03, 0.34), 4, at(0.235, 0.42, 0.0)),
  ]);
}
// a seated fan in one of three poses: relaxed (forearms on the thighs), cheering (arms up), leaning in
// (elbows on knees). Sized to an adult: hips on the pan at 0.47 m, eyes about 1.2 m above the tread.
function fanGeometry(pose) {
  const cap = (r, l, s = 8) => new THREE.CapsuleGeometry(r, l, 3, s);
  const lean = pose === 'lean' ? 0.32 : -0.06;
  // which part of the body each piece is, for the idle motion in the shader (rig, lean, cheering)
  const rig = (g, r) => { g.setAttribute('aRig', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(0).flatMap(() => [r, lean, pose === 'cheer' ? 1 : 0, 0]), 4)); return g; };
  const torsoProfile = [[0.001, 0], [0.15, 0.0], [0.165, 0.08], [0.145, 0.2], [0.17, 0.34], [0.19, 0.44], [0.16, 0.5], [0.07, 0.54], [0.001, 0.55]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.LatheGeometry(torsoProfile, 14);
  torso.scale(1.1, 1, 0.72);
  // pivot the upper body about the hips
  const hip = new THREE.Vector3(0, 0.5, -0.07);
  const body = (g) => { g.rotateX(lean); g.translate(hip.x, hip.y, hip.z); };
  const parts = [
    rig(part(torso, 0, body), 1),                                                           // shirt
    rig(part(new THREE.CylinderGeometry(0.048, 0.055, 0.09, 10), 1, (g) => { g.translate(0, 0.58, 0); body(g); }), 1),   // neck
    rig(part(new THREE.SphereGeometry(0.1, 14, 10), 1, (g) => { g.scale(0.9, 1.1, 1.0); g.translate(0, 0.73, 0.01); body(g); }), 3),   // head
    rig(part(new THREE.SphereGeometry(0.106, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), 3, (g) => { g.scale(0.92, 1.05, 1.02); g.rotateX(-0.25); g.translate(0, 0.75, -0.005); body(g); }), 3),   // hair / shemagh
    rig(part(new THREE.BoxGeometry(0.2, 0.06, 0.03), 3, (g) => { g.translate(0, 0.66, -0.1); body(g); }), 3),   // nape (hair, or the shemagh's fall)
  ];
  // arms
  for (const sx of [-1, 1]) {
    const sh = new THREE.Vector3(sx * 0.2, 0.47, 0);                                         // shoulder, in the body frame
    if (pose === 'cheer') {
      parts.push(rig(part(cap(0.05, 0.26), 0, (g) => { g.translate(0, 0.15, 0); g.rotateZ(sx * -2.7); g.translate(sh.x, sh.y, sh.z); body(g); }), 2));
      parts.push(rig(part(cap(0.044, 0.24), 1, (g) => { g.translate(0, 0.14, 0); g.rotateZ(sx * -2.95); g.translate(sh.x + sx * 0.13, sh.y + 0.29, sh.z); body(g); }), 2));
      parts.push(rig(part(new THREE.SphereGeometry(0.045, 8, 6), 1, (g) => { g.translate(sh.x + sx * 0.17, sh.y + 0.58, sh.z); body(g); }), 2));
    } else {
      // upper arm down the side, forearm forward onto the thigh (or the knee, leaning in)
      parts.push(rig(part(cap(0.05, 0.25), 0, (g) => { g.translate(0, -0.15, 0); g.rotateX(0.18); g.rotateZ(sx * 0.08); g.translate(sh.x, sh.y, sh.z); body(g); }), 2));
      const elbow = new THREE.Vector3(sh.x + sx * 0.02, sh.y - 0.29, sh.z + 0.05);
      const fx = pose === 'lean' ? 0.5 : 1.25;
      parts.push(rig(part(cap(0.042, 0.24), 1, (g) => { g.translate(0, -0.14, 0); g.rotateX(-fx); g.translate(elbow.x, elbow.y, elbow.z); body(g); }), 2));
    }
  }
  // legs: thighs along the pan, shins down to the tread in front, shoes
  for (const sx of [-1, 1]) {
    parts.push(rig(part(cap(0.075, 0.32), 2, at(sx * 0.1, 0.55, 0.11, Math.PI / 2 - 0.08)), 0));
    parts.push(rig(part(cap(0.058, 0.36), 2, at(sx * 0.105, 0.29, 0.33, 0.12)), 0));
    parts.push(rig(part(new THREE.BoxGeometry(0.1, 0.08, 0.25), 5, at(sx * 0.105, 0.04, 0.4)), 0));
  }
  return mergeGeometries(parts);
}
function modelMat(fog, fan = false) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uFogCol: { value: fog.color }, uFogD: { value: fog.density }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aPart;
      uniform float uTime;
      ${fan ? 'attribute vec4 aVar;   // skin tone, trousers, shoes, dress (0 jersey · 1 thobe + shemagh)\n      attribute vec4 aRig;   // body part (0 legs · 1 body · 2 arm · 3 head), lean, cheering' : ''}
      varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vPart; varying vec4 vVar;
      vec3 rotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
      vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
      vec3 rotZ(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
      void main(){
        vec3 pos = position, nor = normal;
        ${fan ? `
        // alive in their seats: breathing and swaying, looking around now and then; the cheering ones wave
        // their arms and bounce. Each fan keeps their own rhythm.
        float ph = aVar.x * 6.2832 + aVar.z * 12.7 + aVar.y * 3.1;
        float cheer = aRig.z;
        vec3 hip = vec3(0.0, 0.5, -0.07);
        if (aRig.x > 1.5 && aRig.x < 2.5) {
          float side = sign(pos.x);
          vec3 sh = hip + rotX(vec3(side * 0.2, 0.47, 0.0), aRig.y);
          float a = cheer > 0.5 ? sin(uTime * 3.4 + ph) * 0.38 : sin(uTime * 1.1 + ph) * 0.05;
          pos = sh + rotZ(pos - sh, a * side); nor = rotZ(nor, a * side);
        }
        if (aRig.x > 2.5) {
          vec3 nk = hip + rotX(vec3(0.0, 0.56, 0.0), aRig.y);
          float look = sin(uTime * 0.35 + ph) * 0.5 * smoothstep(0.3, 0.9, 0.5 + 0.5 * sin(uTime * 0.13 + ph * 1.7));
          float nod = sin(uTime * 0.8 + ph * 2.3) * 0.06;
          pos = nk + rotX(rotY(pos - nk, look), nod); nor = rotX(rotY(nor, look), nod);
        }
        if (aRig.x > 0.5) {
          float sx = sin(uTime * 0.9 + ph) * 0.035 + cheer * sin(uTime * 3.4 + ph) * 0.05;
          float sz = sin(uTime * 0.6 + ph * 1.3) * 0.035;
          pos = hip + rotZ(rotX(pos - hip, sx), sz); nor = rotZ(rotX(nor, sx), sz);
        }
        pos.y += cheer * abs(sin(uTime * 3.4 + ph)) * 0.04;
        ` : ''}
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(pos, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * nor); vPart = aPart;
        vCol = instanceColor; vVar = ${fan ? 'aVar' : 'vec4(0.0)'};
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFogCol; uniform float uFogD;
      varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying float vPart; varying vec4 vVar;
      void main(){
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        if (dot(n, v) < 0.0) n = -n;
        float thobe = step(0.5, vVar.w);
        vec3 skin = mix(vec3(0.6, 0.41, 0.3), vec3(0.22, 0.14, 0.095), vVar.x);
        vec3 trousers = mix(vec3(0.03, 0.03, 0.035), vec3(0.08, 0.11, 0.18), step(0.6, vVar.y));
        vec3 white = vec3(0.8, 0.79, 0.76);
        // a shemagh: red and white check, or a plain white ghutra
        vec3 shemagh = mix(white, mix(white, vec3(0.6, 0.05, 0.05), step(0.5, fract(vW.x * 26.0) + step(0.5, fract(vW.y * 26.0)) * 0.0)), step(0.4, vVar.y));
        vec3 base =
          vPart < 0.5 ? mix(vCol, white, thobe) :
          vPart < 1.5 ? skin :
          vPart < 2.5 ? mix(trousers, white, thobe) :
          vPart < 3.5 ? mix(vec3(0.02, 0.015, 0.012), shemagh, thobe) :
          vPart < 4.5 ? vec3(0.06) :
          mix(vec3(0.75), vec3(0.03), step(0.5, vVar.z));
        // floodlights high above the roof line, a soft fill from the pitch, a little sheen on plastic
        vec3 L = normalize(vec3(0.2, 1.0, 0.25));
        float diff = max(dot(n, L), 0.0), fill = 0.5 + 0.5 * n.y;
        float spec = pow(max(dot(reflect(-L, n), v), 0.0), 28.0) * (vPart < 0.5 ? ${fan ? '0.04' : '0.35'} : 0.04);
        vec3 col = base * (0.26 + 0.62 * diff + 0.24 * fill) + spec;
        float d = length(cameraPosition - vW), f = 1.0 - exp(-d * d * uFogD * uFogD);
        gl_FragColor = vec4(mix(col, uFogCol, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function createSeatPicker(W, scene, fog) {
  const tiers = TIERS.map(([key, name, code], i) => {
    const mat = W.crowd[i];
    const mesh = W.stadium.children.find((o) => o.isMesh && o.material === mat);
    const U = mat.uniforms;
    return { i, key, name, code, mat, mesh, ring: BOWL[key], rows: U.uRows.value, seats: U.uSeats.value, aisles: U.uAisles.value };
  });

  /* ── geometry helpers on a tier ── */
  const tf = (T, v, th) => { const [a, b, y] = stepRow(T.ring, v); const [x, z] = ringXZ(a, b, th); return new THREE.Vector3(x, y, z); };
  const inward = (T, th) => { const p0 = tf(T, 0, th), p1 = tf(T, 1, th); return p0.sub(p1).setY(0).normalize(); };
  function seatSpot(T, sx, sy) {
    // the seat's pan centre on its tread, and the way it faces
    const th = ((sx + 0.5) / T.seats) * Math.PI * 2;
    const p = tf(T, (sy + 0.5) / T.rows, th);
    p.y = stepRow(T.ring, (sy + 1) / T.rows)[2];
    return { p, n: inward(T, th), th };
  }
  const blockOf = (T, sx) => Math.floor(((sx + 0.5) / T.seats) * T.aisles);
  function describeBlock(T, blk) {
    const th = ((blk + 0.5) / T.aisles) * Math.PI * 2;
    return { key: `${T.code}${blk}`, T, blk, th, stand: standOf(th), tier: T.name, block: `${T.code}${blk + 1}` };
  }
  function describeSeat(T, sx, sy) {
    const blk = blockOf(T, sx), b = describeBlock(T, blk);
    const per = T.seats / T.aisles, first = Math.ceil(blk * per - 0.5);
    const { p, n } = seatSpot(T, sx, sy);
    return { ...b, key: `${T.code}-${sx}-${sy}`, sx, sy, row: sy + 1, seat: sx - first + 1, eye: p.clone().addScaledVector(n, -0.06).setY(p.y + EYE), look: new THREE.Vector3(0, 0, 0) };
  }
  function blockPose(b) {
    const T = b.T, n = inward(T, b.th);
    const mid = tf(T, 0.5, b.th);
    const D = [26, 30, 36][T.i], H = [3, 4, 5][T.i];
    return { p: mid.clone().addScaledVector(n, D).add(new THREE.Vector3(0, H, 0)), l: mid.clone().add(new THREE.Vector3(0, -1, 0)) };
  }

  /* ── the 3D seats of the section you zoom into ── */
  const seatGeo = seatGeometry(), mMat = modelMat(fog), fMat = modelMat(fog, true);
  const POSES = ['relaxed', 'cheer', 'lean'];
  const fanGeos = POSES.map((p) => fanGeometry(p));
  let patch = null;
  const SEAT_C = new THREE.Color(0.66, 0.13, 0.05), HOT_C = new THREE.Color(1.6, 1.35, 0.05);
  const SHIRTS = [[0.52, new THREE.Color(0.62, 0.5, 0.02)], [1, new THREE.Color(0.025, 0.025, 0.025)]];   // club colours only (Ahmed)
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion();
  function buildPatch(b) {
    clearPatch();
    const T = b.T, per = T.seats / T.aisles;
    const x0 = Math.ceil((b.blk - 0.5) * per - 0.5), x1 = Math.floor((b.blk + 1.5) * per - 0.5);   // the block ± half a block
    const inBlock = (sx) => blockOf(T, wrap(sx, T.seats)) === b.blk;
    const ids = [], mats = [];
    const byPose = POSES.map(() => ({ mats: [], cols: [], vars: [], seat: [] }));
    for (let sy = 0; sy < T.rows; sy++) for (let sx = x0; sx <= x1; sx++) {
      const { p, n } = seatSpot(T, wrap(sx, T.seats), sy);
      Q.setFromUnitVectors(Z, n);
      M4.compose(p, Q, new THREE.Vector3(1, 1, 1));
      ids.push([sx, sy]); mats.push(M4.clone());
      if (hash(sx, sy, T.i) < 0.55) {
        // 70% relaxed, 15% cheering, 15% leaning in; a little turn and size variation each
        const hp = hash(sx, sy, 5), pi = hp < 0.7 ? 0 : hp < 0.85 ? 1 : 2, P = byPose[pi];
        const j = new THREE.Quaternion().setFromAxisAngle(UP, (hash(sy, sx, 3) - 0.5) * 0.3);
        M4.compose(p, Q.clone().multiply(j), new THREE.Vector3(1, 1, 1).multiplyScalar(0.93 + hash(sx, sy, 7) * 0.12));
        P.mats.push(M4.clone()); P.seat.push(ids.length - 1);
        const hs = hash(sx, sy, 11);
        P.cols.push(SHIRTS.find(([k]) => hs < k)[1].clone().multiplyScalar(0.6 + 0.4 * hash(sx, sy, 13)));
        P.vars.push(hash(sx, sy, 17), hash(sx, sy, 19), hash(sx, sy, 23), hash(sx, sy, 29) < 0.3 ? 1 : 0);   // skin, trousers, shoes, thobe
      }
    }
    const seats = new THREE.InstancedMesh(seatGeo, mMat, ids.length);
    mats.forEach((m, i) => { seats.setMatrixAt(i, m); seats.setColorAt(i, SEAT_C); });   // one colour (Ahmed)
    const fans = byPose.map((P, pi) => {
      const g = fanGeos[pi].clone();
      g.setAttribute('aVar', new THREE.InstancedBufferAttribute(new Float32Array(P.vars.length ? P.vars : [0, 0, 0, 0]), 4));
      const m = new THREE.InstancedMesh(g, fMat, Math.max(1, P.mats.length));
      P.mats.forEach((mm, i) => { m.setMatrixAt(i, mm); m.setColorAt(i, P.cols[i]); });
      if (!P.mats.length) m.setColorAt(0, SEAT_C);
      m.count = P.mats.length;
      return { mesh: m, seat: P.seat };
    });
    for (const m of [seats, ...fans.map((f) => f.mesh)]) { m.frustumCulled = false; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; W.stadium.add(m); }
    const taken = new Set(byPose.flatMap((P) => P.seat));   // a fan's in it: it can't be picked
    patch = { T, blk: b.blk, x0, x1, seats, fans, ids, hot: -1, inBlock, taken };
    // the painted seats under the 3D ones are left bare
    T.mat.uniforms.uPatch.value.set(x0, x1, 0, T.rows - 1);
  }
  function clearPatch() {
    if (!patch) return;
    for (const m of [patch.seats, ...patch.fans.map((f) => f.mesh)]) { W.stadium.remove(m); m.dispose(); if (m !== patch.seats) m.geometry.dispose(); }
    patch.T.mat.uniforms.uPatch.value.set(1, 0, 1, 0);
    patch = null;
  }
  function hotSeat(i) {
    if (!patch || patch.hot === i) return;
    if (patch.hot >= 0) patch.seats.setColorAt(patch.hot, SEAT_C);
    if (i >= 0) patch.seats.setColorAt(i, HOT_C);
    patch.seats.instanceColor.needsUpdate = true;
    patch.hot = i;
  }
  // in your seat, the fans in it and right beside it step out of the way
  function clearAround(sx, sy) {
    if (!patch) return;
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const f of patch.fans) {
      f.seat.forEach((si, fi) => {
        const [x, y] = patch.ids[si];
        if (y === sy && Math.abs(wrap(x, patch.T.seats) - sx) <= 1) f.mesh.setMatrixAt(fi, hidden);
      });
      f.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /* ── picking ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const aim = (x, y, camera, rect) => { ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  function blockAt(x, y, camera, rect) {
    aim(x, y, camera, rect);
    const h = ray.intersectObjects(tiers.filter((t) => t.mesh).map((t) => t.mesh), false)[0];
    if (!h || !h.uv) return null;
    const T = tiers.find((t) => t.mesh === h.object);
    const u = THREE.MathUtils.euclideanModulo(h.uv.x, 1);
    return describeBlock(T, Math.floor(u * T.aisles));
  }
  function seatAt(x, y, camera, rect) {
    if (!patch) return null;
    aim(x, y, camera, rect);
    const h = ray.intersectObjects([patch.seats, ...patch.fans.map((f) => f.mesh)], false)[0];
    if (!h) return null;
    const fan = patch.fans.find((f) => f.mesh === h.object);
    const si = fan ? fan.seat[h.instanceId] : h.instanceId;
    const [sx, sy] = patch.ids[si];
    if (!patch.inBlock(sx)) return null;
    return { si, taken: patch.taken.has(si), info: describeSeat(patch.T, wrap(sx, patch.T.seats), sy) };
  }
  // seat selection: paint each block in its price category's colour (fn(block) → css colour or null)
  let catTarget = 0, catOn = 0, seatsMode = true, lastSeat = null;
  function paint(fn) {
    for (const T of tiers) {
      const data = new Uint8Array(T.aisles * 4);
      for (let blk = 0; blk < T.aisles; blk++) {
        const css = fn(describeBlock(T, blk));
        const c = css ? new THREE.Color(css) : null;
        data.set(c ? [c.r * 255, c.g * 255, c.b * 255, 255] : [40, 40, 40, 255], blk * 4);
      }
      const tex = new THREE.DataTexture(data, T.aisles, 1, THREE.RGBAFormat);
      tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
      T.mat.uniforms.uCats.value?.dispose();
      T.mat.uniforms.uCats.value = tex;
    }
    catTarget = seatsMode ? 1 : 0;
  }
  const setBlockGlow = (b) => {
    for (const t of tiers) t.mat.uniforms.uPick.value.set(-1, -1, -1, 0);
    if (b) b.T.mat.uniforms.uPick.value.set(-1, -1, b.blk, 1);
  };

  /* ── camera: free orbit at the stadium level, flights between levels ── */
  const st = {
    mode: 'off',           // off (stadium) · toBlock · block · toSeat · view · toBack (seat → block) · out (→ stadium)
    k: 0, from: { p: new THREE.Vector3(), l: new THREE.Vector3() }, to: { p: new THREE.Vector3(), l: new THREE.Vector3() },
    block: null, seat: null, sp: 0, look: { yaw: 0, pitch: 0 },
  };
  const orbit = { yaw: 0, pitch: 0, zoom: 1, px: 0, pz: 0 };          // stadium level
  const bOrbit = { yaw: 0, pitch: 0, zoom: 1 };                       // section level
  const cur = { p: new THREE.Vector3(), l: new THREE.Vector3() };
  const base = { p: new THREE.Vector3(), l: new THREE.Vector3() };
  let hover = null, listener = null, enabled = false;
  const emit = () => listener?.({ mode: st.mode, block: st.block, info: st.seat, seatsMode, lastSeat: !!lastSeat });

  const sph = new THREE.Spherical();
  // turn a pose round its look point: yaw/pitch (radians), zoom (× distance), pan (metres, xz)
  function orbitPose(p, l, o, out) {
    const pivot = new THREE.Vector3(l.x + (o.px || 0), l.y, l.z + (o.pz || 0));
    sph.setFromVector3(new THREE.Vector3().subVectors(p, l));
    sph.theta += o.yaw; sph.phi = THREE.MathUtils.clamp(sph.phi + o.pitch, 0.12, 1.5); sph.radius *= o.zoom;
    out.p.setFromSpherical(sph).add(pivot);
    out.p.y = Math.max(out.p.y, 3);
    out.l.copy(pivot);
    return out;
  }
  const stadiumPose = (P, Lk, out) => {
    if (Math.abs(orbit.yaw) + Math.abs(orbit.pitch) + Math.abs(orbit.zoom - 1) + Math.abs(orbit.px) + Math.abs(orbit.pz) <= 0.002) { out.p.copy(P); out.l.copy(Lk); return out; }
    return orbitPose(P, Lk, orbit, out);
  };
  const blockView = () => { const b = blockPose(st.block); return orbitPose(b.p, b.l, bOrbit, { p: new THREE.Vector3(), l: new THREE.Vector3() }); };
  function flyTo(mode, to) {
    st.from.p.copy(cur.p); st.from.l.copy(cur.l);
    if (to) { st.to.p.copy(to.p); st.to.l.copy(to.l); }
    st.mode = mode; st.k = 0;
    emit();
  }
  function openBlock(b, sp) {
    st.block = b; st.seat = null; st.sp = sp;
    Object.assign(bOrbit, { yaw: 0, pitch: 0, zoom: 1 });
    setBlockGlow(null); hover = null;
    buildPatch(b);
    flyTo('toBlock', blockPose(b));
  }
  function openSeat(s) {
    if (!s.centre) lastSeat = s;
    st.seat = s; st.look.yaw = 0; st.look.pitch = 0;
    hotSeat(-1); hover = null;
    clearAround(s.sx, s.sy);
    flyTo('toSeat', { p: s.eye, l: s.look });
  }
  function back() {
    if ((st.mode === 'view' || st.mode === 'toSeat') && !st.block) { st.seat = null; flyTo('out'); return; }   // the centre-circle view
    if (st.mode === 'view' || st.mode === 'toSeat') {
      buildPatch(st.block);                        // puts back the fans that made room
      st.seat = null;
      flyTo('toBack', blockView());
    } else if (st.mode === 'block' || st.mode === 'toBlock' || st.mode === 'toBack') {
      st.seat = null;
      flyTo('out');
    }
  }
  // straight to a seat from anywhere (find-your-seat, "My seat")
  function goSeat(info, sp) {
    const b = describeBlock(info.T, info.blk);
    st.block = b; st.sp = sp;
    setBlockGlow(null); hover = null;
    buildPatch(b);
    openSeat(info);
  }
  // the view presets, as in the Allianz Arena's 3D stadium: Arena (the overview), Bird's-eye (straight down),
  // Centre (standing on the centre spot, looking round), My seat (back to the last seat you sat in)
  function preset(name, sp) {
    if (name === 'arena' || name === 'bird') {
      if (st.mode !== 'off') { st.seat = null; flyTo('out'); }
      glide = name === 'arena' ? { yaw: 0, pitch: 0, zoom: 1, px: 0, pz: 0 } : { yaw: 0, pitch: -0.95, zoom: 1.05, px: 22, pz: 22 };
    } else if (name === 'center') {
      clearPatch(); st.block = null; st.sp = sp;
      openSeat({ key: 'centre', centre: true, stand: 'Centre circle', tier: 'On the pitch', block: '—', row: '—', seat: '—', eye: new THREE.Vector3(0, 1.75, 0), look: new THREE.Vector3(0, 9, 60) });
    } else if (name === 'myseat' && lastSeat) goSeat(lastSeat, sp);
  }
  // find a seat by its numbers (tier code, block, row, seat — the model's grid, as shown on the panel)
  function findSeat(code, blockNo, row, seatNo, sp) {
    const T = tiers.find((t) => t.code === code);
    if (!T) return false;
    const blk = blockNo - 1, per = T.seats / T.aisles;
    const first = Math.ceil(blk * per - 0.5), last = Math.floor((blk + 1) * per - 0.5);
    const sx = first + seatNo - 1;
    if (blk < 0 || blk >= T.aisles || row < 1 || row > T.rows || sx < first || sx > last) return false;
    goSeat(describeSeat(T, wrap(sx, T.seats), row - 1), sp);
    return true;
  }
  function leaveAll() { if (st.mode !== 'off' && st.mode !== 'out') { st.seat = null; flyTo('out'); } }

  // P, Lk: the walk's camera pose this frame, overwritten while the seat map has the camera.
  // Returns true when it does (the walk's bob / pointer sway stay off).
  // a glide of the stadium-level orbit (a drag takes over)
  let glide = null;
  function apply(dt, P, Lk, sp, canMap) {
    enabled = canMap;
    fMat.uniforms.uTime.value += dt;
    catOn += ((canMap && st.mode === 'off' && tiers[0].mat.uniforms.uCats.value ? catTarget : 0) - catOn) * (1 - Math.exp(-dt * 3));
    for (const T of tiers) T.mat.uniforms.uCatOn.value = catOn;
    if (glide && canMap && st.mode === 'off' && !drag.on) {
      const k = 1 - Math.exp(-dt * 1.6);
      let done = true;
      for (const key of Object.keys(glide)) { orbit[key] += (glide[key] - orbit[key]) * k; if (Math.abs(glide[key] - orbit[key]) > 0.002) done = false; }
      if (done) glide = null;
    }
    if (st.mode === 'off') {
      // stadium level: free orbit while the map is available, easing home when it isn't
      if (!canMap) { orbit.yaw *= 0.9; orbit.pitch *= 0.9; orbit.px *= 0.9; orbit.pz *= 0.9; orbit.zoom += (1 - orbit.zoom) * 0.1; }
      // untouched, the walk's own pose passes straight through (orbitPose clamps height, which would
      // lift the camera into the tunnel ceiling)
      const moved = Math.abs(orbit.yaw) + Math.abs(orbit.pitch) + Math.abs(orbit.zoom - 1) + Math.abs(orbit.px) + Math.abs(orbit.pz) > 0.002;
      if (moved) { stadiumPose(P, Lk, base); P.copy(base.p); Lk.copy(base.l); }
      else if (!canMap) Object.assign(orbit, { yaw: 0, pitch: 0, zoom: 1, px: 0, pz: 0 });
      cur.p.copy(P); cur.l.copy(Lk);
      return moved;
    }
    if (Math.abs(sp - st.sp) > 0.015) leaveAll();                   // scrolling returns you to the walk
    if (st.mode === 'out') stadiumPose(P, Lk, st.to);               // the stadium pose keeps moving with the walk
    if (st.mode === 'block') {
      const bv = blockView();
      cur.p.lerp(bv.p, 0.2); cur.l.lerp(bv.l, 0.2);
    } else if (st.mode === 'view') {
      cur.p.copy(st.to.p);
      const dir = new THREE.Vector3().subVectors(st.seat.look, st.seat.eye).normalize().applyAxisAngle(UP, st.look.yaw);
      const side = new THREE.Vector3().crossVectors(dir, UP).normalize();
      dir.applyAxisAngle(side, st.look.pitch);
      cur.l.copy(cur.p).addScaledVector(dir, 40);
    } else {
      // a flight: an arc up and over rather than through the stand
      st.k = Math.min(1, st.k + dt / FLY);
      const e = ease(st.k), a = 1 - e;
      const mid = new THREE.Vector3().lerpVectors(st.from.p, st.to.p, 0.5);
      mid.y = Math.max(st.from.p.y, st.to.p.y) + 3 + st.from.p.distanceTo(st.to.p) * 0.06;
      cur.p.set(0, 0, 0).addScaledVector(st.from.p, a * a).addScaledVector(mid, 2 * a * e).addScaledVector(st.to.p, e * e);
      cur.l.lerpVectors(st.from.l, st.to.l, ease(Math.min(1, st.k * 1.2)));
      if (st.k >= 1) {
        st.mode = st.mode === 'toBlock' || st.mode === 'toBack' ? 'block' : st.mode === 'toSeat' ? 'view' : 'off';
        if (st.mode === 'off') { clearPatch(); st.block = null; }
        emit();
      }
    }
    P.copy(cur.p); Lk.copy(cur.l);
    return true;
  }

  /* ── input ── */
  const drag = { on: false, x: 0, y: 0, x0: 0, y0: 0, pan: false, moved: false, endT: 0 };
  const canDrag = () => (st.mode === 'off' && enabled) || st.mode === 'block' || st.mode === 'view';
  return {
    get mode() { return st.mode; },
    get info() { return st.seat; },
    get block() { return st.block; },
    get mapOn() { return enabled || st.mode !== 'off'; },
    onChange(fn) { listener = fn; },
    // hover: stadium level lights a block; section level lights a seat. Returns what the tooltip shows.
    hover(x, y, camera, rect, mouse) {
      let hit = null;
      if (mouse && !drag.on) {
        if (st.mode === 'off' && enabled && seatsMode) hit = blockAt(x, y, camera, rect);
        else if (st.mode === 'block') hit = seatAt(x, y, camera, rect);
      }
      const key = hit ? (hit.info ? hit.info.key : hit.key) : null;
      if (key !== (hover && hover.key)) {
        hover = hit ? { key, hit } : null;
        if (st.mode === 'off') setBlockGlow(hit);
        if (st.mode === 'block') hotSeat(hit && !hit.taken ? hit.si : -1);
      }
      if (!hit) return null;
      return hit.info ? { kind: 'seat', taken: hit.taken, ...hit.info } : { kind: 'block', ...hit };
    },
    click(x, y, camera, rect, sp) {
      if (performance.now() - drag.endT < 250) return st.mode !== 'off' || enabled;   // the end of a drag isn't a click
      if (st.mode === 'off' && enabled) {
        if (!seatsMode) return true;                     // Arena mode: look around, nothing to pick
        const b = hover?.hit && !hover.hit.info ? hover.hit : blockAt(x, y, camera, rect);
        if (!b) return false;
        openBlock(b, sp);
        return true;
      }
      if (st.mode === 'block') {
        const s = hover?.hit?.info ? hover.hit : seatAt(x, y, camera, rect);
        if (s && !s.taken) openSeat(s.info);   // a taken seat can't be picked
        return true;
      }
      return st.mode !== 'off';
    },
    dragStart(x, y, pan) {
      if (!canDrag()) return false;
      glide = null;
      Object.assign(drag, { on: true, x, y, x0: x, y0: y, pan, moved: false });
      return true;
    },
    dragMove(x, y) {
      if (!drag.on) return;
      const dx = x - drag.x, dy = y - drag.y;
      drag.x = x; drag.y = y;
      if (Math.abs(x - drag.x0) + Math.abs(y - drag.y0) > 6) drag.moved = true;
      if (!drag.moved) return;
      if (st.mode === 'off') {
        if (drag.pan) {
          // pan along the ground, relative to the way the camera faces
          const f = new THREE.Vector3().subVectors(cur.l, cur.p).setY(0).normalize(), r = new THREE.Vector3().crossVectors(f, UP);
          const k = 0.12 * orbit.zoom;
          orbit.px = THREE.MathUtils.clamp(orbit.px - r.x * dx * k + f.x * dy * k, -60, 60);
          orbit.pz = THREE.MathUtils.clamp(orbit.pz - r.z * dx * k + f.z * dy * k, -45, 45);
        } else {
          orbit.yaw -= dx * 0.005;
          orbit.pitch = THREE.MathUtils.clamp(orbit.pitch - dy * 0.004, -0.9, 0.6);
        }
      } else if (st.mode === 'block') {
        bOrbit.yaw = THREE.MathUtils.clamp(bOrbit.yaw - dx * 0.004, -0.7, 0.7);
        bOrbit.pitch = THREE.MathUtils.clamp(bOrbit.pitch - dy * 0.003, -0.35, 0.35);
      } else if (st.mode === 'view') {
        st.look.yaw = THREE.MathUtils.clamp(st.look.yaw - dx * 0.0025, -1.1, 1.1);
        st.look.pitch = THREE.MathUtils.clamp(st.look.pitch - dy * 0.002, -0.4, 0.3);
      }
    },
    dragEnd() { if (!drag.on) return; drag.on = false; if (drag.moved) drag.endT = performance.now(); },
    get dragging() { return drag.on && drag.moved; },
    zoom(f) {
      if (st.mode === 'off' && enabled) orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * f, 0.3, 1.45);
      else if (st.mode === 'block') bOrbit.zoom = THREE.MathUtils.clamp(bOrbit.zoom * f, 0.45, 1.5);
    },
    paint,
    preset,
    findSeat,
    get seatsMode() { return seatsMode; },
    setSeatsMode(v) { seatsMode = v; catTarget = v && tiers[0].mat.uniforms.uCats.value ? 1 : 0; if (!v) { setBlockGlow(null); hover = null; } emit(); },
    get lastSeat() { return lastSeat; },
    // the seat grid, for the find-your-seat menus
    layout: () => tiers.map((T) => ({ code: T.code, name: T.name, blocks: T.aisles, rows: T.rows, seatsIn: (blk) => { const per = T.seats / T.aisles; return Math.floor((blk + 1) * per - 0.5) - Math.ceil(blk * per - 0.5) + 1; } })),
    // seat selection on arrival: glide up to a higher view of the whole bowl
    selectView() { glide = { yaw: 0, pitch: -0.42, zoom: 0.92, px: 0, pz: 0 }; },
    resetView() { if (st.mode === 'off') Object.assign(orbit, { yaw: 0, pitch: 0, zoom: 1, px: 0, pz: 0 }); else if (st.mode === 'block') Object.assign(bOrbit, { yaw: 0, pitch: 0, zoom: 1 }); },
    back,
    clearHover() { if (hover) { hover = null; setBlockGlow(null); hotSeat(-1); } },
    apply,
  };
}
