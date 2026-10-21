// Direction B's tifo, raised on the far stand of the bowl once you walk out of the tunnel.
// Reuses B's card shader and designs; only the placement (cards on this bowl's tiers) and the
// colour pipeline (this scene is linear + ACES, B's shader writes sRGB) are specific to here.
import * as THREE from 'three';
import { CARD_VERT, CARD_FRAG, MAX_WAVES } from '../tifo/shaders.js';
import { DESIGNS } from '../tifo/patterns.js';
import { nextMatch, when } from '../../data.js';
import { BOWL, ringXZ, stepRow, TN } from './world.js';

const PHI = 1.12;            // half the arc: the whole far side seen from the tunnel mouth, into the corners
const CARD_LIFT = 0.85;      // held at chest height above the step
const ORDER = ['crest', 'year', 'match'];

// B's vertex shader with a lean uniform (cards tip back toward a camera that is above them)
const VERT = CARD_VERT
  .replace('uniform float uMotion;', 'uniform float uMotion;\n  uniform float uLean;')
  .replace('+ 0.08 -', '+ uLean -')
  .replace('(aRand.y - 0.5) * 0.2', '(aRand.y - 0.5) * 0.06')
  .replace('(aRand.z - 0.5) * 0.1', '(aRand.z - 0.5) * 0.03')
  .replace('(aRand.w - 0.5) * 0.09', '(aRand.w - 0.5) * 0.025')
  .replace('* 0.045;', '* 0.02;')
  // sitting in the tifo section (seats.js), the cards right in front of you would be a black wall of
  // card backs: cards within uNear of the camera fold away. The walk never comes that close to them.
  .replace('uniform float uLean;', 'uniform float uLean;\n  uniform float uNear;')
  .replace('gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);', 'wp = mix(aPos, wp, smoothstep(uNear, uNear + 4.0, distance(aPos, cameraPosition)));\n    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);');
// B writes sRGB straight out; here the renderer tone-maps linear light, so convert first
const FRAG = CARD_FRAG
  .replace('uniform float uSheenX;', 'uniform float uSheenX;\n  uniform float uGain;')
  .replace('gl_FragColor = vec4(col, 1.);', 'gl_FragColor = vec4(min(pow(max(col, 0.), vec3(2.2)) * uGain, vec3(1.02)), 1.); // stays under the bloom threshold\n    #include <tonemapping_fragment>\n    #include <colorspace_fragment>');

const ring = (t, s) => t[0].map((v, i) => v + (t[1][i] - v) * s);

/* ── the whole-stadium tifo's picture frame (Ahmed, 2026-10-21: "make the tifo the full stadium seats") ──
   A panorama wrapped round the bowl: x runs round it (left to right as you face each stand from the pitch),
   y runs down the tiers (upper back row at the top, lower front row at the bottom). The seam sits in the
   corner between the tunnel side and the right-hand goal end, so every stand is in one piece; x follows the
   distance along the stands (not the angle, which would stretch the corners ~3×), pinned so that every row
   has its corners and stand centres at the same x. Each tier owns whole rows of the grid (proportional to
   its depth up the rake); the concourses between the tiers hide no rows — the picture breaks round them. */
const TAU = Math.PI * 2;
function arcTable(a, b, n = 2048) {
  const s = new Float64Array(n + 1);
  let [px, pz] = ringXZ(a, b, 0);
  for (let k = 1; k <= n; k++) { const [x, z] = ringXZ(a, b, (k / n) * TAU); s[k] = s[k - 1] + Math.hypot(x - px, z - pz); px = x; pz = z; }
  return s;
}
// arc length from th = 0, unwrapped past a full turn
const arcAt = (s, th) => {
  const n = s.length - 1, turns = Math.floor(th / TAU), f = ((th - turns * TAU) / TAU) * n, i = Math.min(n - 1, Math.floor(f));
  return s[i] + (s[i + 1] - s[i]) * (f - i) + turns * s[n];
};
// the stands' corners and centres, in order round from the seam (a ring's corner is where |x/a| = |z/b|)
const anchorsOf = (a, b) => { const c = Math.atan2(b, a), P = Math.PI; return [c, P / 2, P - c, P, P + c, 1.5 * P, TAU - c, TAU, TAU + c]; };
const REF = (() => {
  const [a, b] = ring(BOWL.lower, 0.5), s = arcTable(a, b), A = anchorsOf(a, b), s0 = arcAt(s, A[0]), L = s[s.length - 1];
  return { a, b, X: A.map((th) => (arcAt(s, th) - s0) / L), L };
})();
// th → panorama x on the ring (a, b)
function rowMapper(a, b) {
  const s = arcTable(a, b), A = anchorsOf(a, b), S = A.map((th) => arcAt(s, th));
  return (th) => {
    const t = A[0] + ((((th - A[0]) % TAU) + TAU) % TAU);
    let k = 0;
    while (k < 7 && t >= A[k + 1]) k++;
    return Math.min(0.99999, REF.X[k] + ((arcAt(s, t) - S[k]) / (S[k + 1] - S[k])) * (REF.X[k + 1] - REF.X[k]));
  };
}
const refMap = rowMapper(REF.a, REF.b);
export const BOWL_GRID = (() => {
  const cols = 96, rows = 16;
  const X = REF.X;
  const stands = [
    { key: 'tunnel', label: 'Tunnel side', x0: X[0], x1: X[2], cx: X[1], end: false },
    { key: 'west', label: 'Behind the goal', x0: X[2], x1: X[4], cx: X[3], end: true },
    { key: 'far', label: 'Opposite side', x0: X[4], x1: X[6], cx: X[5], end: false },
    { key: 'east', label: 'Behind the goal', x0: X[6], x1: X[8], cx: X[7], end: true },
  ];
  // rows of the grid per tier, top (upper back) to bottom (lower front): proportional to each tier's rake
  const bands = [
    { key: 'upper', label: 'Upper tier', r0: 0, r1: 6 },
    { key: 'middle', label: 'Middle tier', r0: 6, r1: 10 },
    { key: 'lower', label: 'Lower tier', r0: 10, r1: 16 },
  ];
  // panorama x → angle round the bowl (on the reference ring), for drawing the design from above
  const N = 1024, inv = new Float32Array(N + 1);
  { const A = anchorsOf(REF.a, REF.b), dth = TAU / 8192; let th = A[0];
    for (let i = 0; i <= N; i++) { while (th < A[8] - dth && refMap(th) < i / N) th += dth; inv[i] = th; } }
  const thOf = (x) => { const f = Math.min(1, Math.max(0, x)) * N, i = Math.min(N - 1, Math.floor(f)); return inv[i] + (inv[i + 1] - inv[i]) * (f - i); };
  // a point of the design seen from above: x along the panorama, tier key, v from the tier's front (0) to back (1)
  const pointAt = (x, key, v) => { const [a, b] = stepRow(BOWL[key], v); return ringXZ(a, b, thOf(x)); };
  // where the tunnel cuts through the front of the lower tier
  const tunnel = { x: X[1], w: (2 * (TN.HW + 1.3)) / REF.L };
  return { cols, rows, stands, bands, tunnel, thOf, pointAt, aspect: REF.L / 70 /* perimeter : depth up the three tiers */ };
})();

export async function createBowlTifo({ lite = false, refCam, still = false, onChange } = {}) {
  // the far stand, opposite the tunnel: all three tiers, so the tifo fills the view as you walk out
  const TH_C = -Math.PI / 2;
  const COLS = lite ? 200 : 300;
  const tiers = [{ t: BOWL.lower, rows: lite ? 22 : 30 }, { t: BOWL.middle, rows: lite ? 16 : 22 }, { t: BOWL.upper, rows: lite ? 18 : 26 }];
  const START = [0, tiers[0].rows, tiers[0].rows + tiers[1].rows];  // first row of each tier
  const LOWER = START[1], ROWS = START[2] + tiers[2].rows;
  const tierOf = (r) => (r < START[1] ? 0 : r < START[2] ? 1 : 2);

  // world position of a card cell (column c, row r counted from the front)
  const at = (c, r, out = new THREE.Vector3()) => {
    const k = tierOf(r);
    const { t, rows } = tiers[k];
    const [a, b, y] = ring(t, (r - START[k] + 0.5) / rows);
    const th = TH_C - PHI + ((c + 0.5) / COLS) * 2 * PHI;
    const [x, z] = ringXZ(a, b, th);
    return out.set(x, y + CARD_LIFT, z);
  };

  /* ── instances ── */
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const aPos = [], aInfo = [], aCell = [], aRand = [], pick = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3(), up = new THREE.Vector3();
  for (let r = 0; r < ROWS; r++) {
    const { t, rows } = tiers[tierOf(r)];
    // row pitch measured along the rake
    const k0 = ring(t, 0), k1 = ring(t, 1);
    const pitch = Math.hypot(k1[0] - k0[0], k1[2] - k0[2]) / rows;
    for (let c = 0; c < COLS; c++) {
      at(c, r, p);
      at(Math.min(c + 1, COLS - 1), r, q);
      const cw = c < COLS - 1 ? p.distanceTo(q) : (up.copy(p).sub(at(c - 1, r, q)).length());
      const yaw = Math.atan2(-p.x, -p.z); // face the centre spot
      aPos.push(p.x, p.y + (Math.random() - 0.5) * 0.04, p.z);
      aInfo.push(yaw, cw * 1.02, pitch * 1.0);
      const u = (c + 0.5) / COLS, v = (r + 0.5) / ROWS;
      aCell.push(u, v);
      aRand.push(Math.random(), Math.random(), Math.random(), Math.random());
      if (r % 2 === 0 && c % 2 === 0) pick.push(p.x, p.y, p.z, u, v);
    }
  }
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(aPos), 3));
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array(aInfo), 3));
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(aCell), 2));
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(new Float32Array(aRand), 4));
  geo.instanceCount = aPos.length / 3;

  const texOf = () => {
    const tx = new THREE.DataTexture(new Uint8Array(COLS * ROWS * 4), COLS, ROWS, THREE.RGBAFormat);
    tx.magFilter = tx.minFilter = THREE.NearestFilter;
    tx.generateMipmaps = false;
    tx.colorSpace = THREE.NoColorSpace;
    tx.needsUpdate = true;
    return tx;
  };
  const texPrev = texOf(), texNext = texOf();
  const waves = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4(0, 0, -99, 0));
  const uniforms = {
    uTime: { value: 0 }, uPrev: { value: texPrev }, uNext: { value: texNext },
    uT0: { value: 1e6 }, uSpan: { value: 1.6 }, uDur: { value: 0.62 }, uMode: { value: 0 },
    uOrigin: { value: new THREE.Vector2(0.5, 0) }, uWaves: { value: waves },
    uPtr: { value: new THREE.Vector3(0.5, 0.5, 0) }, uAsp: { value: 3 }, uMotion: { value: still ? 0 : 1 },
    uFog: { value: new THREE.Vector3(7 / 255, 7 / 255, 10 / 255) } /* the scene fog, in the sRGB space B's shader mixes in */, uSheenX: { value: -999 },
    uLean: { value: -0.32 }, uGain: { value: 0.8 }, uNear: { value: 18 },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.visible = false;

  /* ── how a grid cell reads from the wide shot, so designs aren't squashed ── */
  const ref = refCam.clone();
  ref.updateMatrixWorld();
  ref.updateProjectionMatrix();
  const P = (c, r) => at(c, r, new THREE.Vector3()).project(ref);
  const mid = COLS / 2;
  let ratio = 0;
  const samples = [3, Math.floor(LOWER / 2), LOWER - 3, START[1] + 4, START[2] - 3, START[2] + 4, ROWS - 3];
  for (const r of samples) {
    const a = P(mid, r), b = P(mid, r + 1), c = P(mid + 1, r);
    ratio += Math.abs(b.y - a.y) / Math.abs(c.x - a.x) / ref.aspect;
  }
  const ca = ratio / samples.length;
  // how many rows of picture each concourse (and its LED fascia) hides, seen from the touchline
  const gapAt = (r0) => {
    const step = Math.abs(P(mid, r0 - 2).y - P(mid, r0 - 1).y);
    return Math.max(1, Math.round(Math.abs(P(mid, r0).y - P(mid, r0 - 1).y) / step) - 1);
  };
  const GAPS = [[START[1], gapAt(START[1])], [START[2], gapAt(START[2])]];
  const gapRows = GAPS[0][1] + GAPS[1][1];
  const GRID = { cols: COLS, rows: ROWS, ca, gaps: GAPS };
  uniforms.uAsp.value = COLS / ((ROWS + gapRows) * ca);
  // the picture's frame for user-made designs (tifo-builder.js): its visual width/height, a canvas size in
  // that shape, and the bands of it (fractions from the top) the concourses between the tiers hide
  const V_ROWS = ROWS + gapRows;
  const vrOf = (r) => r + GAPS.reduce((s, [g, n]) => s + (r >= g ? n : 0), 0);
  const ASPECT = uniforms.uAsp.value;
  const SIZE = { w: COLS, h: Math.round(COLS / ASPECT) };
  const HIDDEN = GAPS.map(([g, n]) => { const vr = vrOf(g) - n; return [1 - (vr + n) / V_ROWS, 1 - vr / V_ROWS]; });

  /* ── designs ── */
  const crest = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = '/img/crest.png'; });
  const nm = nextMatch(), nw = when(nm.kickoff);
  const designs = {
    crowd: DESIGNS.crowd(GRID),
    crest: crest ? DESIGNS.crest(GRID, { crest }) : DESIGNS.year(GRID),
    year: DESIGNS.year(GRID),
    match: DESIGNS.match(GRID, { line1: `${nw.date} ${nw.month}`, line2: `VS ${nm.oppCode}` }),
  };

  // No banners over the LED screens between the tiers (Ahmed, 2026-10-11): the screens stay visible and
  // the picture breaks around them, as a real tifo does — the design already skips the rows they hide.

  // a user-made design: any canvas, stretched over the whole picture (incl. the rows the concourses hide),
  // each card taking the colour under its centre. Colours are kept as painted (sRGB), not quantised.
  function paintCustom(src) {
    const sw = src.width, sh = src.height;
    const px = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
    const out = new Uint8Array(COLS * ROWS * 4);
    for (let r = 0; r < ROWS; r++) {
      const sy = Math.min(sh - 1, Math.floor((1 - (vrOf(r) + 0.5) / V_ROWS) * sh)); // row 0 is the front (bottom)
      for (let c = 0; c < COLS; c++) {
        const sx = Math.min(sw - 1, Math.floor(((c + 0.5) / COLS) * sw));
        const k = (sy * sw + sx) * 4, o = (r * COLS + c) * 4;
        const a = px[k + 3] / 255; // transparent cells read as black cards
        out[o] = px[k] * a + 18 * (1 - a); out[o + 1] = px[k + 1] * a + 18 * (1 - a); out[o + 2] = px[k + 2] * a + 18 * (1 - a); out[o + 3] = 255;
      }
    }
    return out;
  }

  /* ── timing (same queueing as B: a new tifo waits for the current sweep) ── */
  const t0 = performance.now() / 1000;
  const now = () => performance.now() / 1000 - t0;
  let wi = 0, busyUntil = 0, pending = null, current = 'crowd';
  function addWave(u, v, kind, delay = 0) {
    if (still) return;
    waves[wi].set(u, v, now() + delay, kind);
    wi = (wi + 1) % MAX_WAVES;
  }
  function show(key, { mode = 3, origin = [0.5, 0], span = 1.7, dur = 0.62 } = {}) {
    if (still) { setInstant(key); return; }
    if (now() < busyUntil) { pending = [key, { mode, origin, span, dur }]; return; }
    current = key;
    onChange?.(key);
    texNext.image.data.set(designs[key]);
    texNext.needsUpdate = true;
    uniforms.uMode.value = mode;
    uniforms.uOrigin.value.set(origin[0], origin[1]);
    uniforms.uSpan.value = span;
    uniforms.uDur.value = dur;
    uniforms.uT0.value = now();
    busyUntil = now() + span + 0.55 + dur + 0.05;
  }
  function settle() {
    texPrev.image.data.set(texNext.image.data);
    texPrev.needsUpdate = true;
    uniforms.uT0.value = 1e6;
    busyUntil = 0;
    if (pending) { const [k, o] = pending; pending = null; show(k, o); }
  }
  function setInstant(key) {
    current = key;
    onChange?.(key);
    texPrev.image.data.set(designs[key]); texNext.image.data.set(designs[key]);
    texPrev.needsUpdate = texNext.needsUpdate = true;
    uniforms.uT0.value = 1e6; busyUntil = 0; pending = null;
  }
  setInstant('crowd');

  /* ── the whole stadium (BOWL_GRID): the design painted onto every seat by the stands' own shader
     (world.js crowdMat samples a texture made here: one texel per seat row × a slice of angle round the
     bowl). Nothing runs per seat per frame — a raise uploads the texture once; the sweep is a few uniforms. ── */
  const BU = {
    uBowlA: { value: null }, uBowlB: { value: null },
    uBowlT: { value: new THREE.Vector4(-1e6, 7, 0, 0) },        // sweep start, sweep length (s), now, strength
    uBowlW: { value: new THREE.Vector4(0.75, 1, 0, 1.0) },     // start angle (fraction: the far stand), direction, idle-wave start, gain
  };
  const BOWL_SWEEP = 6.5;   // seconds for the flip to go once round the bowl
  const bowl = { tiers: null, TW: lite ? 768 : 1024, TR: 0, xs: null, ys: null, texA: null, texB: null, empty: null, busyUntil: 0, on: 0, sup: false, vis: false };
  function bindTiers(mats) {
    if (bowl.tiers || !mats?.length) return;
    bowl.tiers = mats;
    // [first row, rows] per tier (lower → upper), each seat row's design x per angle slice, and its design y
    let R = 0;
    const meta = mats.map((m) => { const rows = m.uniforms.uRows.value, o = { r0: R, rows }; R += rows; return o; });
    const TR = (bowl.TR = R), TW = bowl.TW;
    bowl.xs = new Float32Array(TW * TR); bowl.ys = new Float32Array(TR);
    const KEYS = ['lower', 'middle', 'upper'];
    meta.forEach(({ r0, rows }, k) => {
      const key = KEYS[k] || 'upper', band = BOWL_GRID.bands.find((b) => b.key === key);
      for (let i = 0; i < rows; i++) {
        const v = (i + 0.5) / rows, [a, b] = stepRow(BOWL[key], v), map = rowMapper(a, b), row = r0 + i;
        for (let j = 0; j < TW; j++) bowl.xs[row * TW + j] = map(((j + 0.5) / TW) * TAU);
        bowl.ys[row] = (band.r1 - v * (band.r1 - band.r0)) / BOWL_GRID.rows;   // fraction from the top of the design
      }
    });
    const tex = () => {
      const tx = new THREE.DataTexture(new Uint8Array(TW * TR * 4), TW, TR, THREE.RGBAFormat);
      tx.magFilter = tx.minFilter = THREE.NearestFilter;
      tx.generateMipmaps = false;
      tx.colorSpace = THREE.SRGBColorSpace;   // designs are painted in sRGB; the stands shade in linear light
      tx.needsUpdate = true;
      return tx;
    };
    bowl.texA = tex(); bowl.texB = tex(); bowl.empty = new Uint8Array(TW * TR * 4);
    BU.uBowlA.value = bowl.texA; BU.uBowlB.value = bowl.texB;
    mats.forEach((m, k) => {
      for (const key of Object.keys(BU)) m.uniforms[key] = BU[key];   // shared: one write drives all three tiers
      m.uniforms.uBowlRow = { value: new THREE.Vector2(meta[k].r0, TR) };
    });
  }
  // any canvas, stretched over the panorama; each seat row × angle slice takes the colour under it.
  // Transparent pixels leave those seats to the crowd.
  function paintBowl(src) {
    const sw = src.width, sh = src.height, TW = bowl.TW, TR = bowl.TR;
    const px = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
    const out = new Uint8Array(TW * TR * 4);
    for (let r = 0; r < TR; r++) {
      const sy = Math.min(sh - 1, Math.floor(bowl.ys[r] * sh));
      for (let j = 0; j < TW; j++) {
        const sx = Math.min(sw - 1, Math.floor(bowl.xs[r * TW + j] * sw)), k = (sy * sw + sx) * 4, o = (r * TW + j) * 4;
        out[o] = px[k]; out[o + 1] = px[k + 1]; out[o + 2] = px[k + 2]; out[o + 3] = px[k + 3] > 127 ? 255 : 0;
      }
    }
    return out;
  }
  // turn the bowl's cards over to `data` (null: back to the crowd), sweeping round from the far stand
  function bowlShow(data, { delay = 0, instant = still } = {}) {
    if (!bowl.tiers) return;
    if (bowl.busyUntil) bowlSettle(false);
    bowl.texB.image.data.set(data || bowl.empty); bowl.texB.needsUpdate = true;
    BU.uBowlW.value.z = 0;
    if (instant) { bowlSettle(); return; }
    BU.uBowlT.value.x = now() + delay; BU.uBowlT.value.y = BOWL_SWEEP;
    bowl.busyUntil = now() + delay + BOWL_SWEEP + 1.0;
  }
  function bowlSettle(idle = true) {
    bowl.texA.image.data.set(bowl.texB.image.data); bowl.texA.needsUpdate = true;
    BU.uBowlT.value.x = -1e6; bowl.busyUntil = 0;
    // once it's up, a Mexican wave goes round every 14 s
    if (idle && designs.bowl && !still) BU.uBowlW.value.z = now() + 1.5;
  }
  // the stands' crowd materials next to the cards, lower → upper (when scene.js hasn't bound them)
  function findTiers(root) {
    const ms = [];
    root.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uBowlRow && !ms.some((x) => x.m === o.material)) ms.push({ m: o.material, y: o.geometry.boundingSphere?.center.y ?? 0 }); });
    return ms.length >= 3 ? ms.sort((a, b) => a.y - b.y).map((x) => x.m) : null;
  }
  // the far stand's own card display steps aside while the whole bowl carries the design
  function farOff(off) {
    geo.instanceCount = off ? 0 : aPos.length / 3;
    for (const m of bowl.tiers || []) m.uniforms.uTifo.value.y = off ? -1 : PHI;   // no darkened arc under absent cards
  }

  /* ── after a raise: a slow tour of the bowl so the whole design reads (scene.js calls tour.apply each frame).
     First the view from high over the tunnel end while the flip goes round, then a lap just under the roof's
     edge looking across at each stand in turn. Any input (scroll, drag, key) hands the camera back, easing
     to the walk's own view. Reduced motion: a cut to the high view, held until input. ── */
  const TOUR_LAP = 34, TOUR_LEN = 9 + TOUR_LAP;
  const tour = { on: false, t0: 0, tOff: 0, amtOff: 0, sp0: -1, amt: 0 };
  const tp = { p: new THREE.Vector3(), l: new THREE.Vector3(), q: new THREE.Vector3(), m: new THREE.Vector3() };
  const sm = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
  const EVS = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
  const stopOnInput = () => tourStop();
  function tourStart() {
    if (tour.on || !inBowl) return;
    Object.assign(tour, { on: true, t0: now(), sp0: -1 });
    // (listening from after the click that raised it has finished dispatching)
    setTimeout(() => { if (tour.on) for (const ev of EVS) addEventListener(ev, stopOnInput, { passive: true, capture: true }); }, 0);
  }
  function tourStop() {
    for (const ev of EVS) removeEventListener(ev, stopOnInput, { capture: true });
    if (!tour.on) return;
    tour.on = false; tour.tOff = now(); tour.amtOff = tour.amt;
  }
  function tourPose(tt, out) {
    if (still) { out.p.set(0, 118, 96); out.l.set(0, 0, -20); return out; }
    const ph = Math.PI / 2 + (Math.max(0, tt - 7.5) / TOUR_LAP) * TAU;
    const c = Math.cos(ph), sn = Math.sin(ph);
    out.p.set(c * 44, 47, sn * 33); out.l.set(-c * 64, 19, -sn * 49);
    const hi = sm(1 - (tt - 6) / 3.5);   // high over the tunnel end, looking down across the whole bowl
    if (hi > 0) { out.p.lerp(tp.q.set(0, 118, 96), hi); out.l.lerp(tp.m.set(0, 0, -20), hi); }
    return out;
  }
  // P, Lk: the walk's pose this frame, blended toward the tour's. Returns true while the tour has the camera.
  function tourApply(dt, P, Lk, sp) {
    const t = now();
    if (tour.on) {
      if (tour.sp0 < 0) tour.sp0 = sp;
      else if (Math.abs(sp - tour.sp0) > 0.004) tourStop();   // scrolling walks on
      if (!inBowl || !designs.bowl || (!still && t - tour.t0 > TOUR_LEN)) tourStop();
    }
    tour.amt = tour.on ? (still ? 1 : sm((t - tour.t0) / 2.6)) : still ? 0 : tour.amtOff * (1 - sm((t - tour.tOff) / 2.2));
    if (tour.amt <= 0.0005) return false;
    tourPose(t - tour.t0, tp);
    P.lerp(tp.p, tour.amt); Lk.lerp(tp.l, tour.amt);
    return true;
  }

  /* ── pointer → cell ── */
  const tmp = new THREE.Vector3();
  function cellAt(x, y, camera, rect) {
    const nx = ((x - rect.left) / rect.width) * 2 - 1, ny = -((y - rect.top) / rect.height) * 2 + 1;
    let best = -1, bd = Infinity;
    for (let i = 0; i < pick.length; i += 5) {
      tmp.set(pick[i], pick[i + 1], pick[i + 2]).project(camera);
      if (tmp.z > 1) continue;
      const dx = (tmp.x - nx) * camera.aspect, dy = tmp.y - ny;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0 || bd > 0.003) return null;
    return { u: pick[best + 3], v: pick[best + 4] };
  }

  /* ── the show: plays while you're in the bowl, resets when you go back down the tunnel ── */
  let inBowl = false, nextAt = 0, nextMex = 0, mexDir = 1, lastPtr = -10, ptrCell = null, ptrS = 0, lastEmit = { u: -1, v: -1, t: 0 };
  let lastT = 0;
  function update(prog, camera) {
    const t = now(), dt = Math.min(0.1, t - lastT);
    lastT = t;
    uniforms.uTime.value = t;
    const enter = prog > 0.53, leave = prog < 0.45;
    // the whole bowl's design follows the cards: scene.js switches the cards off (after this update) while
    // the seat map is choosing seats, so the stands can show their seats — read here a frame later
    const sup = bowl.vis && !mesh.visible;
    if (!bowl.tiers && mesh.parent) bindTiers(findTiers(mesh.parent));
    mesh.visible = prog > 0.45;
    bowl.vis = mesh.visible;
    // close up at the touchline the cards are bright enough; pulled back they fight the fog
    uniforms.uGain.value = 0.62 + 0.75 * Math.min(1, Math.max(0, (prog - 0.8) / 0.2));
    if (!inBowl && enter) {
      inBowl = true;
      // the stand raises the crest as you come out under the lights, then the wave goes round
      // (or, with a whole-stadium design up, every stand turns its cards over to it)
      if (designs.bowl) bowlShow(designs.bowl, { delay: 0.4 });
      else if (current === 'crowd') show(designs.custom ? 'custom' : 'crest', { mode: 3, span: 1.9, dur: 0.7 });
      nextAt = t + 9.5;
      nextMex = t + 3.4;
    } else if (inBowl && leave) {
      inBowl = false;
      setInstant('crowd');
      if (designs.bowl) bowlShow(null, { instant: true });
      tourStop();
    }
    if (busyUntil && t >= busyUntil) settle();
    if (bowl.busyUntil && t >= bowl.busyUntil) bowlSettle();
    if (bowl.tiers) {
      const want = inBowl && !sup && (designs.bowl || bowl.busyUntil) ? 1 : 0;
      bowl.on = still ? want : bowl.on + (want - bowl.on) * (1 - Math.exp(-dt * 4));
      if (bowl.on < 0.002) bowl.on = 0;
      BU.uBowlT.value.z = t;
      BU.uBowlT.value.w = bowl.on;
    }
    if (inBowl && !still) {
      if (t > nextAt && !busyUntil && !designs.custom && !designs.bowl) {
        show(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length], { mode: 1, span: 1.8 });
        nextAt = t + 9.5;
      }
      if (t > nextMex) {
        if (t - lastPtr > 2) { addWave(0, 0, mexDir > 0 ? 1 : 2); mexDir *= -1; }
        nextMex = t + 6.5 + Math.random() * 2;
      }
      ptrS += ((t - lastPtr < 1.2 && ptrCell ? 1 : 0) - ptrS) * 0.08;
      if (ptrCell) uniforms.uPtr.value.set(ptrCell.u, ptrCell.v, ptrS);
      else uniforms.uPtr.value.z = ptrS;
      uniforms.uSheenX.value = ((t * 16) % 260) - 130;
    }
  }

  return {
    arc: { centre: TH_C, half: PHI },
    mesh,
    count: geo.instanceCount,
    update,
    get current() { return current; },
    get inBowl() { return inBowl; },
    show,
    setInstant,
    // the stand used to ripple out from the pointer; Ahmed (2026-10-11) read it as a stray yellow light
    // following the mouse, so it's off. Only clicks and the automatic Mexican wave move the cards now.
    onMove(x, y, camera, rect) {
      return;
      // eslint-disable-next-line no-unreachable
      if (!inBowl || still) return;
      const cell = cellAt(x, y, camera, rect);
      ptrCell = cell;
      if (!cell) return;
      lastPtr = now();
      const d = Math.hypot((cell.u - lastEmit.u) * uniforms.uAsp.value, cell.v - lastEmit.v);
      if (d > 0.05 || (now() - lastEmit.t > 0.35 && d > 0.01)) {
        addWave(cell.u, cell.v, 0);
        lastEmit = { u: cell.u, v: cell.v, t: now() };
      }
    },
    // clicking the stand flips to the next tifo, sweeping out from where you clicked
    onClick(x, y, camera, rect) {
      if (!inBowl || designs.bowl) return false;
      const cell = cellAt(x, y, camera, rect);
      if (!cell) return false;
      if (designs.custom) { show('custom', { mode: 0, origin: [cell.u, cell.v], span: 1.5 }); return true; }
      show(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length], { mode: 0, origin: [cell.u, cell.v], span: 1.5 });
      nextAt = now() + 9;
      return true;
    },
    // the tifo builder: visual width/height of the picture, a canvas size in that shape, concourse bands
    aspect: ASPECT,
    size: SIZE,
    hidden: HIDDEN,
    get custom() { return !!(designs.custom || designs.bowl); },
    // the whole-stadium mode: the panorama's grid, stands and tier bands (tifo-builder.js draws its board from it)
    bowlGrid: BOWL_GRID,
    // 'bowl' (every seat), 'far' (the far stand's cards) or null (no user design up)
    get mode() { return designs.bowl ? 'bowl' : designs.custom ? 'far' : null; },
    // where a design reads best: the far stand from the walk at 0.76; the whole bowl from the tour (below)
    get viewHint() { return designs.bowl ? { mode: 'bowl', progress: 0.76, tour: true } : { mode: 'far', progress: 0.76, tour: false }; },
    // the stands' crowd materials, lower → upper (scene.js; found in the stadium on the first update otherwise)
    bindTiers,
    // the slow orbit after a whole-stadium raise: setCustom starts it; scene.js blends it into the camera each
    // frame with tour.apply(dt, P, Lk, scrollProgress) → true while it has the camera
    tour: { start: tourStart, stop: tourStop, apply: tourApply, get active() { return tour.on; } },
    // show a user-made design instead of the rotating ones; null restores the crowd everywhere.
    // canvas.dataset.tifo = 'bowl' (the whole stadium: a BOWL_GRID panorama, any resolution) or 'far' (the far
    // stand, ideally in `aspect`); untagged, a canvas wider than 4.2 : 1 counts as a panorama.
    // { tour: false } skips the camera tour after a whole-stadium raise.
    setCustom(canvas, { tour: autoTour = true } = {}) {
      const mode = canvas ? canvas.dataset?.tifo || (canvas.width / canvas.height > 4.2 ? 'bowl' : 'far') : null;
      if (mode === 'bowl') {
        if (!bowl.tiers && mesh.parent) bindTiers(findTiers(mesh.parent));
        if (!bowl.tiers) { console.warn('[tifo] no stands to paint'); return; }
        designs.bowl = paintBowl(canvas);
        // the far stand's own cards go down (the seats carry the design now); they're back when it comes down
        delete designs.custom;
        farOff(true);
        setInstant('crowd');
        // the flip waits for the builder to step aside (it fades out ~0.9 s after Raise)
        if (inBowl) { bowlShow(designs.bowl, { delay: 0.9 }); if (autoTour) tourStart(); }
        return;
      }
      if (designs.bowl) {
        delete designs.bowl;
        farOff(false);
        tourStop();
        bowlShow(null);   // the cards go down round the bowl, back to the crowd
        if (!canvas && inBowl) { pending = null; show('crest', { mode: 1, span: 1.8 }); nextAt = now() + 9.5; }
      }
      if (canvas) {
        designs.custom = paintCustom(canvas);
        // raised now if you're in the bowl (a sweep out from the centre), else when you next walk out
        if (still) setInstant('custom');
        else if (inBowl) { pending = null; show('custom', { mode: 3, span: 1.9, dur: 0.7 }); nextAt = now() + 9.5; }
      } else if (designs.custom) {
        delete designs.custom;
        if (current === 'custom' || pending?.[0] === 'custom') {
          if (still) setInstant('crest');
          else if (inBowl) { pending = null; show('crest', { mode: 1, span: 1.8 }); nextAt = now() + 9.5; }
          else setInstant('crowd');
        }
      }
    },
    dispose() { tourStop(); geo.dispose(); mesh.material.dispose(); texPrev.dispose(); texNext.dispose(); bowl.texA?.dispose(); bowl.texB?.dispose(); },
  };
}
