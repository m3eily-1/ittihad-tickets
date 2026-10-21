// Direction B's tifo, raised on the far stand of the bowl once you walk out of the tunnel.
// Reuses B's card shader and designs; only the placement (cards on this bowl's tiers) and the
// colour pipeline (this scene is linear + ACES, B's shader writes sRGB) are specific to here.
import * as THREE from 'three';
import { CARD_VERT, CARD_FRAG, MAX_WAVES } from '../tifo/shaders.js';
import { DESIGNS } from '../tifo/patterns.js';
import { nextMatch, when } from '../../data.js';
import { BOWL, ringXZ } from './world.js';

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
  function update(prog, camera) {
    const t = now();
    uniforms.uTime.value = t;
    const enter = prog > 0.53, leave = prog < 0.45;
    mesh.visible = prog > 0.45;
    // close up at the touchline the cards are bright enough; pulled back they fight the fog
    uniforms.uGain.value = 0.62 + 0.75 * Math.min(1, Math.max(0, (prog - 0.8) / 0.2));
    if (!inBowl && enter) {
      inBowl = true;
      // the stand raises the crest as you come out under the lights, then the wave goes round
      if (current === 'crowd') show(designs.custom ? 'custom' : 'crest', { mode: 3, span: 1.9, dur: 0.7 });
      nextAt = t + 9.5;
      nextMex = t + 3.4;
    } else if (inBowl && leave) {
      inBowl = false;
      setInstant('crowd');
    }
    if (busyUntil && t >= busyUntil) settle();
    if (inBowl && !still) {
      if (t > nextAt && !busyUntil && !designs.custom) {
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
      if (!inBowl) return false;
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
    get custom() { return !!designs.custom; },
    // show a user-made design (any canvas, ideally in `aspect`) instead of the rotating ones; null restores them
    setCustom(canvas) {
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
    dispose() { geo.dispose(); mesh.material.dispose(); texPrev.dispose(); texNext.dispose(); },
  };
}
