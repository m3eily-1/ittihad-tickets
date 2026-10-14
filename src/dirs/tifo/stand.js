// The hero: a two-tier raked stand of ~14k instanced cards seen from the touchline, under a roof
// of floodlights. Cards flip in cascading sweeps to form tifos; the pointer sends ripples through
// them and an ambient Mexican wave rolls along the stand.
import * as THREE from 'three';
import { CARD_VERT, CARD_FRAG, PITCH_VERT, PITCH_FRAG, MAX_WAVES } from './shaders.js';

/* ── stand layout (metres) ── */
export const COLS = 224;
const AISLE = 16;            // a stairway every 16 columns
export const LOWER = 30, UPPER = 38, ROWS = LOWER + UPPER; // one rake, a walkway after row 30
const PHI = 0.8;             // half the arc the stand wraps (rad)
const R0 = 34;               // front row radius from the centre spot
const FOG = new THREE.Color('#08090b');
const isAisle = (c) => c % AISLE === AISLE / 2;

function rowAt(r) {
  if (r < LOWER) return { R: R0 + r * 0.8, y: 1.4 + r * 0.45 };
  const k = r - LOWER;
  return { R: R0 + LOWER * 0.8 + 0.7 + k * 0.8, y: 1.4 + LOWER * 0.45 + 0.35 + k * 0.48 };
}
const TOP = rowAt(ROWS - 1);
const LOW_TOP = rowAt(LOWER - 1);
const UP_BASE = rowAt(LOWER);
const CARD_LIFT = 0.85;      // cards are held at chest height above the step

/* ── camera rig: framed so the stand fills the top of the screen, the pitch the bottom ── */
const DBG = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);
function rig(aspect, p = 0) {
  if (DBG) {
    const [x, y, z, ly, lz, hf] = DBG;
    const vf = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hf / 2)) / aspect));
    return { fov: vf, pos: new THREE.Vector3(x, y, z - p * 7), look: new THREE.Vector3(0, ly + p * 6, lz) };
  }
  // wide screens see the whole stand; phones close in on the tifo's centre
  const k = THREE.MathUtils.clamp((aspect - 0.46) / (1.3 - 0.46), 0, 1);
  const hfov = aspect >= 1.3 ? Math.min(60, 48 + (aspect - 1.6) * 10) : THREE.MathUtils.lerp(25, 44, k);
  const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov / 2)) / aspect));
  // portrait/tablet layouts stack the copy under the stand, so the camera looks down a touch more
  const e = aspect >= 1.3 ? 1.6 : aspect < 0.62 ? -3.2 : THREE.MathUtils.lerp(-6, -0.4, (aspect - 0.62) / (1.3 - 0.62));
  const elev = THREE.MathUtils.degToRad(e + p * 2.2);
  const pos = new THREE.Vector3(0, 10 + p * 1.2, 44 - p * 9);
  const look = pos.clone().add(new THREE.Vector3(0, Math.sin(elev), -Math.cos(elev)).multiplyScalar(100));
  return { fov: Math.min(vfov, 80), pos, look };
}

/* ── geometry builders ── */
function arcBand(R0_, R1, y0, y1, seg, color0, color1) {
  // a band between two arcs (radius/height pairs) facing the pitch
  const pos = [], col = [], idx = [];
  const c0 = new THREE.Color(color0), c1 = new THREE.Color(color1);
  for (let i = 0; i <= seg; i++) {
    const phi = -PHI - 0.02 + (i / seg) * (2 * PHI + 0.04);
    const s = Math.sin(phi), c = Math.cos(phi);
    pos.push(R0_ * s, y0, -R0_ * c, R1 * s, y1, -R1 * c);
    col.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
    if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
function terraces() {
  const parts = [];
  for (let r = 0; r < ROWS; r++) {
    const a = rowAt(r);
    const run = 0.8;
    const rise = r < LOWER ? 0.45 : 0.48;
    // tread
    parts.push(arcBand(a.R - run * 0.5, a.R + run * 0.5, a.y, a.y, 60, '#1c1c1f', '#1a1a1d'));
    // riser up to the next step
    if (r !== LOWER - 1 && r < ROWS - 1) parts.push(arcBand(a.R + run * 0.5, a.R + run * 0.5, a.y, a.y + rise, 60, '#0f0f11', '#121214'));
  }
  // front wall, walkway lip, back wall
  parts.push(arcBand(R0 - 0.41, R0 - 0.41, 0, 1.4, 60, '#121214', '#18181a'));
  parts.push(arcBand(LOW_TOP.R + 0.4, UP_BASE.R - 0.4, LOW_TOP.y + 0.02, LOW_TOP.y + 0.02, 60, '#0a0a0b', '#0a0a0b'));
  parts.push(arcBand(UP_BASE.R - 0.4, UP_BASE.R - 0.4, LOW_TOP.y, UP_BASE.y, 60, '#0e0e10', '#0e0e10'));
  parts.push(arcBand(TOP.R + 0.4, TOP.R + 0.4, TOP.y, TOP.y + 9, 60, '#0d0d0f', '#09090a'));
  return parts;
}
function merge(geos) {
  let n = 0, m = 0;
  for (const g of geos) { n += g.attributes.position.count; m += g.index.count; }
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), idx = new Uint32Array(m);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3);
    col.set(g.attributes.color.array, vo * 3);
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) idx[io + i] = ix[i] + vo;
    vo += g.attributes.position.count; io += ix.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,245,1)');
  g.addColorStop(0.12, 'rgba(255,250,220,0.8)');
  g.addColorStop(0.4, 'rgba(255,240,180,0.18)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// LED ribbon text, scrolled by texture offset
function ledTexture(text, { bg = '#050505', fg = '#fef201', h = 96 } = {}) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = `400 ${h * 0.62}px Anton`;
  x.letterSpacing = `${h * 0.04}px`;
  const w = Math.min(4096, Math.ceil(x.measureText(text).width + h));
  c.width = w; c.height = h;
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.font = `400 ${h * 0.62}px Anton`;
  x.letterSpacing = `${h * 0.04}px`;
  x.fillStyle = fg; x.textBaseline = 'middle';
  x.fillText(text, h * 0.5, h * 0.54);
  // LED pixel grid
  x.fillStyle = 'rgba(0,0,0,0.38)';
  for (let i = 0; i < w; i += 4) x.fillRect(i, 0, 1, h);
  for (let j = 0; j < h; j += 4) x.fillRect(0, j, w, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return { tex: t, ratio: w / h };
}
function ledBand(R, y0, h, text, opts) {
  const { tex, ratio } = ledTexture(text, opts);
  const arc = 2 * PHI * R;
  const reps = Math.max(1, Math.round(arc / (h * ratio)));
  tex.repeat.set(-reps, 1); // seen from inside the arc: mirror so it reads left→right
  const g = new THREE.CylinderGeometry(R, R, h, 96, 1, true, Math.PI - PHI - 0.02, 2 * PHI + 0.04);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: true, toneMapped: false }));
  m.position.y = y0 + h / 2;
  return { mesh: m, tex };
}

/* ── the stand ── */
export function createStand(canvas, { still = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(FOG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 90, 230);
  const camera = new THREE.PerspectiveCamera(40, 1.6, 0.5, 400);

  /* cards */
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const aPos = [], aInfo = [], aCell = [], aRand = [];
  const pick = []; // sparse sample for pointer mapping
  for (let r = 0; r < ROWS; r++) {
    const { R, y } = rowAt(r);
    const cw = (R * 2 * PHI) / COLS;
    for (let c = 0; c < COLS; c++) {
      if (isAisle(c)) continue;
      const phi = -PHI + ((c + 0.5) / COLS) * 2 * PHI;
      const x = R * Math.sin(phi), z = -R * Math.cos(phi);
      const yy = y + CARD_LIFT + (Math.random() - 0.5) * 0.12;
      aPos.push(x, yy, z);
      aInfo.push(-phi, cw * (0.86 + Math.random() * 0.06), 0.66 * (0.94 + Math.random() * 0.08));
      const u = (c + 0.5) / COLS, v = (r + 0.5) / ROWS;
      aCell.push(u, v);
      aRand.push(Math.random(), Math.random(), Math.random(), Math.random());
      if (r % 2 === 0 && c % 2 === 0) pick.push(x, yy, z, u, v);
    }
  }
  const count = aPos.length / 3;
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(aPos), 3));
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array(aInfo), 3));
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(aCell), 2));
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(new Float32Array(aRand), 4));
  geo.instanceCount = count;

  const texOf = () => {
    const t = new THREE.DataTexture(new Uint8Array(COLS * ROWS * 4), COLS, ROWS, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  const texPrev = texOf(), texNext = texOf();
  const waves = Array.from({ length: MAX_WAVES }, () => new THREE.Vector4(0, 0, -99, 0));
  const uniforms = {
    uTime: { value: 0 },
    uPrev: { value: texPrev },
    uNext: { value: texNext },
    uT0: { value: 1e6 },
    uSpan: { value: 1.4 },
    uDur: { value: 0.6 },
    uMode: { value: 0 },
    uOrigin: { value: new THREE.Vector2(0.5, 0) },
    uWaves: { value: waves },
    uPtr: { value: new THREE.Vector3(0.5, 0.5, 0) },
    uAsp: { value: 1.6 },
    uMotion: { value: still ? 0 : 1 },
    uFog: { value: new THREE.Vector3(FOG.r, FOG.g, FOG.b) },
    uSheenX: { value: -999 },
  };
  // the shader writes sRGB directly; fog colour must be in the same space
  const fogS = FOG.clone().convertLinearToSRGB();
  uniforms.uFog.value.set(fogS.r, fogS.g, fogS.b);
  const cardMat = new THREE.ShaderMaterial({ vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, uniforms, side: THREE.DoubleSide });
  const cards = new THREE.Mesh(geo, cardMat);
  cards.frustumCulled = false;
  scene.add(cards);

  /* concrete */
  const concrete = new THREE.Mesh(merge(terraces()), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  scene.add(concrete);

  /* pitch */
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 140),
    new THREE.ShaderMaterial({ vertexShader: PITCH_VERT, fragmentShader: PITCH_FRAG, uniforms: { uFog: uniforms.uFog } }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(0, 0, -6);
  scene.add(pitch);

  /* roof canopy + floodlights */
  const roofY = TOP.y + 4.2;
  const roofFront = R0 + 22;
  const roof = new THREE.Mesh(
    merge([
      arcBand(roofFront, TOP.R + 2, roofY, roofY + 2.2, 60, '#141416', '#070708'),
      arcBand(roofFront - 0.01, roofFront - 0.01, roofY - 1.6, roofY, 60, '#0e0e10', '#1a1a1c'),
    ]),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  scene.add(roof);
  const strip = new THREE.Mesh(
    new THREE.CylinderGeometry(roofFront - 0.05, roofFront - 0.05, 0.28, 96, 1, true, Math.PI - PHI - 0.02, 2 * PHI + 0.04),
    new THREE.MeshBasicMaterial({ color: '#fff3c4', side: THREE.BackSide, fog: false, toneMapped: false }),
  );
  strip.position.y = roofY - 1.75 - 0.2;
  scene.add(strip);
  const glowTex = glowTexture();
  const glows = new THREE.Group();
  const LAMPS = 15;
  for (let i = 0; i < LAMPS; i++) {
    const phi = -PHI + 0.05 + (i / (LAMPS - 1)) * (2 * PHI - 0.1);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#fff7d6', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.95 }));
    s.position.set((roofFront - 0.6) * Math.sin(phi), roofY - 1.9, -(roofFront - 0.6) * Math.cos(phi));
    s.scale.setScalar(9);
    s.userData.ph = Math.random() * 6.28;
    glows.add(s);
    // a long soft halo for atmosphere
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffe9a0', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.12 }));
    h.position.copy(s.position);
    h.scale.set(46, 30, 1);
    glows.add(h);
  }
  scene.add(glows);

  /* LED ribbons: pitch-side boards and the fascia between tiers */
  const leds = [];
  const ledA = ledBand(R0 - 3.2, 0, 1.05, 'ITTIHAD TICKETS  ◆  THE TIGERS  ◆  JEDDAH  ◆  SINCE 1927  ◆  ');
  scene.add(ledA.mesh); leds.push([ledA.tex, 0.035]);
  const ledB = ledBand(R0 + 21.9, TOP.y + 4.2 - 1.55, 1.1, 'AL-AMEED  ◆  BOOK ON TICKETS.ITTIHADCLUB.SA  ◆  THE TIGERS  ◆  ', { fg: '#bdb9ae' });
  scene.add(ledB.mesh); leds.push([ledB.tex, -0.02]);
  // board backs (dark band behind the pitch-side LED)
  const boardBack = new THREE.Mesh(
    new THREE.CylinderGeometry(R0 - 3.1, R0 - 3.1, 1.25, 96, 1, true, Math.PI - PHI - 0.02, 2 * PHI + 0.04),
    new THREE.MeshBasicMaterial({ color: '#050505', side: THREE.DoubleSide }),
  );
  boardBack.position.y = 0.6;
  scene.add(boardBack);

  /* ── visual cell aspect: measured from a reference desktop camera, so tifos read round ── */
  function measure() {
    const ref = new THREE.PerspectiveCamera(40, 1.6, 0.5, 400);
    const k = rig(1.6);
    ref.fov = k.fov; ref.position.copy(k.pos); ref.lookAt(k.look); ref.updateMatrixWorld(); ref.updateProjectionMatrix();
    const P = (r, c) => {
      const { R, y } = rowAt(r);
      const phi = -PHI + ((c + 0.5) / COLS) * 2 * PHI;
      return new THREE.Vector3(R * Math.sin(phi), y + CARD_LIFT, -R * Math.cos(phi)).project(ref);
    };
    const mid = COLS / 2;
    let ratio = 0;
    const samples = [6, 18, 28, LOWER + 8, LOWER + 20, LOWER + 34];
    for (const r of samples) {
      const a = P(r, mid), b = P(r + 1, mid), c = P(r, mid + 1);
      ratio += Math.abs(b.y - a.y) / Math.abs(c.x - a.x) / 1.6; // NDC y vs x → pixels
    }
    const ca = ratio / samples.length;
    // how many rows of picture the concourse hides
    const step = Math.abs(P(LOWER - 2, mid).y - P(LOWER - 1, mid).y);
    const gapRows = Math.max(0, Math.round(Math.abs(P(LOWER, mid).y - P(LOWER - 1, mid).y) / step) - 1);
    return { ca, gapRows };
  }
  const { ca, gapRows } = measure();
  const GRID = { cols: COLS, rows: ROWS, ca, gapAt: LOWER, gapRows };
  uniforms.uAsp.value = COLS / ((ROWS + gapRows) * ca);

  /* ── sizing ── */
  let W = 1, H = 1, scrollP = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    placeCamera();
    dirty = 3;
  }
  function placeCamera() {
    const k = rig(camera.aspect, scrollP);
    camera.fov = k.fov;
    camera.position.copy(k.pos);
    camera.position.x += ptr.x * 1.4;
    camera.position.y += ptr.y * 0.5;
    camera.lookAt(k.look);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ── pointer → stand cell ── */
  const tmp = new THREE.Vector3();
  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1, ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    let best = -1, bd = Infinity;
    for (let i = 0; i < pick.length; i += 5) {
      tmp.set(pick[i], pick[i + 1], pick[i + 2]).project(camera);
      const dx = (tmp.x - nx) * camera.aspect, dy = tmp.y - ny;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0 || bd > 0.004) return null;
    return { u: pick[best + 3], v: pick[best + 4] };
  }

  /* ── waves ── */
  let wi = 0;
  const now = () => performance.now() / 1000 - t0;
  const t0 = performance.now() / 1000;
  function addWave(u, v, kind) {
    if (still) return;
    waves[wi].set(u, v, now(), kind);
    wi = (wi + 1) % MAX_WAVES;
  }
  const ripple = (u, v) => addWave(u, v, 0);
  // delay < 0 starts the wave part-way along the stand (used for screenshots)
  const mexican = (dir = 1, delay = 0) => {
    addWave(0, 0, dir > 0 ? 1 : 2);
    waves[(wi + MAX_WAVES - 1) % MAX_WAVES].z += delay;
  };

  /* ── tifo transitions (queued so the stand never snaps) ── */
  let busyUntil = 0, pending = null, current = null;
  function setTifo(data, { mode = 0, origin = [0.5, 0], span = 1.5, dur = 0.62, key } = {}) {
    if (now() < busyUntil) { pending = [data, { mode, origin, span, dur, key }]; return; }
    current = key;
    texNext.image.data.set(data);
    texNext.needsUpdate = true;
    if (still) {
      texPrev.image.data.set(data); texPrev.needsUpdate = true;
      uniforms.uT0.value = 1e6; dirty = 3; loop(); return;
    }
    uniforms.uMode.value = mode;
    uniforms.uOrigin.value.set(origin[0], origin[1]);
    uniforms.uSpan.value = span;
    uniforms.uDur.value = dur;
    uniforms.uT0.value = now();
    busyUntil = now() + span + 0.2 + 0.3 + dur + 0.05;
  }
  function settle() {
    texPrev.image.data.set(texNext.image.data);
    texPrev.needsUpdate = true;
    uniforms.uT0.value = 1e6;
    busyUntil = 0;
    if (pending) { const [d, o] = pending; pending = null; setTifo(d, o); }
  }
  function setInstant(data) {
    texPrev.image.data.set(data); texNext.image.data.set(data);
    texPrev.needsUpdate = texNext.needsUpdate = true;
    uniforms.uT0.value = 1e6; dirty = 3; loop();
  }

  /* ── loop, paused off-screen ── */
  let visible = true, raf = 0, dirty = 3, lastPtrMove = -10, nextMex = 2.2, mexDir = 1, ptrStrength = 0, ptrCell = null;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });

  function loop() {
    if (raf) return;
    raf = requestAnimationFrame(frame);
  }
  function frame() {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = now();
    uniforms.uTime.value = t;
    if (busyUntil && t >= busyUntil) settle();
    if (!still) {
      // ambient Mexican wave when nobody is playing with the stand
      if (t > nextMex) {
        if (t - lastPtrMove > 2.5) { mexican(mexDir); mexDir *= -1; }
        nextMex = t + 7.5 + Math.random() * 2;
      }
      ptr.x += (ptr.tx - ptr.x) * 0.04;
      ptr.y += (ptr.ty - ptr.y) * 0.04;
      ptrStrength += ((t - lastPtrMove < 1.2 && ptrCell ? 1 : 0) - ptrStrength) * 0.08;
      if (ptrCell) uniforms.uPtr.value.set(ptrCell.u, ptrCell.v, ptrStrength);
      else uniforms.uPtr.value.z = ptrStrength;
      // floodlight sweep across the stand every few seconds
      uniforms.uSheenX.value = ((t * 11) % 190) - 95;
      glows.children.forEach((s, i) => { if (i % 2 === 0) s.material.opacity = 0.85 + Math.sin(t * 2 + s.userData.ph) * 0.08; });
      for (const [tex, sp] of leds) tex.offset.x = (tex.offset.x + sp * 0.016) % 1;
      placeCamera();
    }
    renderer.render(scene, camera);
    if (still) { if (--dirty > 0) loop(); return; }
    loop();
  }

  /* ── input ── */
  let lastEmit = { u: -1, v: -1, t: 0 };
  function onMove(e) {
    ptr.tx = (e.clientX / innerWidth) * 2 - 1;
    ptr.ty = -((e.clientY / innerHeight) * 2 - 1);
    const cell = cellAt(e.clientX, e.clientY);
    ptrCell = cell;
    if (!cell) return;
    lastPtrMove = now();
    const d = Math.hypot((cell.u - lastEmit.u) * uniforms.uAsp.value, cell.v - lastEmit.v);
    if (d > 0.045 || (now() - lastEmit.t > 0.35 && d > 0.01)) {
      ripple(cell.u, cell.v);
      lastEmit = { u: cell.u, v: cell.v, t: now() };
    }
  }

  resize();
  loop();

  return {
    grid: GRID,
    count,
    renderer,
    cellAt,
    onMove,
    ripple,
    mexican,
    setTifo,
    setInstant,
    get current() { return current; },
    get busy() { return now() < busyUntil; },
    setScroll(p) { scrollP = p; if (still) { placeCamera(); dirty = 2; loop(); } },
    render() { dirty = 2; loop(); },
    pointerLeave() { ptrCell = null; ptr.tx = 0; ptr.ty = 0; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); },
  };
}
