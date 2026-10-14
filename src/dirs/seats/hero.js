// Hero: 60,000 seat particles. Bowl → crest "1" → next match date, scrubbed by scroll.
// The pointer scatters seats (vertex shader); a click claims the nearest one (CPU mirror of the shader).
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$ } from '../../ui.js';
import { eventUrl, when } from '../../data.js';
import { buildBowl, buildOne, buildText, rng, PITCH } from './layouts.js';
import { VERT, FRAG } from './shaders.js';

export const N = 60000;
const FOV = 35, CAM_Z = 8;
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export async function createHero(root, { next, skip, still }) {
  const stage = $('.hero__stage', root);
  const canvas = $('.js-gl', root);
  const card = $('.js-seat', root);
  const lead = $('.js-lead', root);
  const hud = { stage: $('.js-hud-stage', root), view: $('.js-hud-view', root), ptr: $('.js-hud-ptr', root), count: $$('.js-seat-count', root) };
  const rail = $$('.hero__rail i', root);
  const steps = $$('.hero__steps li', root);
  const w = when(next.kickoff);

  /* ── renderer ── */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    root.classList.add('no-gl');
    return { intro: () => gsap.timeline(), claimRandom: () => {} };
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, CAM_Z);

  /* ── layouts ── */
  const rand = rng(1927);
  await Promise.race([document.fonts.load("400 100px 'Anton'"), new Promise((r) => setTimeout(r, 2500))]);
  const crest = await loadImg('/img/crest.png');
  const bowl = buildBowl(N);
  const one = buildOne(N, crest, rand);
  const date = buildText(N, `${w.date} ${w.month}`, rand);

  const aRand = new Float32Array(N * 4), aDir = new Float32Array(N * 3), aIdx = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    aRand[i * 4] = rand(); aRand[i * 4 + 1] = rand(); aRand[i * 4 + 2] = one.yn[i]; aRand[i * 4 + 3] = date.yn[i];
    const th = rand() * Math.PI * 2, z = rand() * 2 - 1, r = Math.sqrt(1 - z * z);
    aDir[i * 3] = r * Math.cos(th); aDir[i * 3 + 1] = r * Math.sin(th); aDir[i * 3 + 2] = z;
    aIdx[i] = i;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(bowl.pos, 3));
  geo.setAttribute('aOne', new THREE.BufferAttribute(one.pos, 3));
  geo.setAttribute('aDate', new THREE.BufferAttribute(date.pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 4));
  geo.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(one.col, 3));
  geo.setAttribute('aMeta', new THREE.BufferAttribute(bowl.meta, 2));
  geo.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

  const U = {
    uM0: { value: new THREE.Matrix3() }, uM1: { value: new THREE.Matrix3() }, uM2: { value: new THREE.Matrix3() },
    uO0: { value: new THREE.Vector3() }, uO1: { value: new THREE.Vector3() }, uO2: { value: new THREE.Vector3() },
    uMix1: { value: 0 }, uMix2: { value: 0 }, uIntro: { value: skip ? 1 : 0 }, uT: { value: 0 }, uWave: { value: still ? 0 : 1 },
    uSize: { value: 2.2 }, uDpr: { value: renderer.getPixelRatio() }, uAspect: { value: 1 }, uFocal: { value: CAM_Z },
    uView: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(9, 9) }, uMouseStr: { value: 0 }, uMouseR: { value: 0.16 },
    uPick: { value: new THREE.Vector3(99, 99, 99) }, uPickAmt: { value: 0 }, uPickIdx: { value: -1 }, uPickR: { value: 0.12 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // pitch markings ride with the bowl and fade as it morphs away
  const pitch = new THREE.Group();
  const lm = new THREE.LineBasicMaterial({ color: 0xfef201, transparent: true, opacity: 0.32 });
  const { hx, hz } = PITCH;
  const seg = [];
  const box = (x0, z0, x1, z1) => seg.push(x0, 0, z0, x1, 0, z0, x1, 0, z0, x1, 0, z1, x1, 0, z1, x0, 0, z1, x0, 0, z1, x0, 0, z0);
  box(-hx * 0.86, -hz * 0.86, hx * 0.86, hz * 0.86);
  seg.push(0, 0, -hz * 0.86, 0, 0, hz * 0.86);
  box(-hx * 0.86, -hz * 0.36, -hx * 0.62, hz * 0.36);
  box(hx * 0.62, -hz * 0.36, hx * 0.86, hz * 0.36);
  for (let k = 0; k < 40; k++) {
    const a0 = (k / 40) * Math.PI * 2, a1 = ((k + 1) / 40) * Math.PI * 2;
    seg.push(Math.cos(a0) * 0.15, 0, Math.sin(a0) * 0.15, Math.cos(a1) * 0.15, 0, Math.sin(a1) * 0.15);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  const pitchLines = new THREE.LineSegments(lg, lm);
  const pitchFill = new THREE.Mesh(new THREE.PlaneGeometry(hx * 1.86, hz * 1.86).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfef201, transparent: true, opacity: 0.05, depthWrite: false }));
  pitch.add(pitchFill, pitchLines);
  pitchFill.position.y = pitchLines.position.y = bowl.pos[1] - 0.04; // just below the first row
  scene.add(pitch);

  /* ── state ── */
  const st = { m1: 0, m2: 0, rot: skip || still ? 0.55 : -1.1, tilt: 0.56, mx: 0, my: 0, W: 1, H: 1 };
  const L = { s0: 1, s1: 1, s2: 1, o0: [0, 0], o1: [0, 0], o2: [0, 0] };
  const R0 = new THREE.Matrix4(), R1 = new THREE.Matrix4(), tmp4 = new THREE.Matrix4();

  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    st.W = W; st.H = H;
    const aspect = W / H;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
    const th = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    U.uView.value.set(th * aspect, th);
    U.uAspect.value = aspect;
    const vh = 2 * CAM_Z * th, vw = vh * aspect;
    if (aspect >= 1.2) {
      Object.assign(L, {
        s0: Math.min((0.54 * vw) / 6.5, (0.86 * vh) / 4.4), o0: [0.2 * vw, 0.0 * vh],
        s1: (0.62 * vh) / 3.6, o1: [0.24 * vw, -0.01 * vh],
        s2: Math.min((0.42 * vw) / date.width, (0.4 * vh) / 2), o2: [0.255 * vw, 0.02 * vh],
      });
      U.uSize.value = 2.3;
      U.uMouseR.value = 0.15;
    } else if (aspect >= 0.75) {
      Object.assign(L, {
        s0: (0.9 * vw) / 6.5, o0: [0, 0.2 * vh],
        s1: (0.44 * vh) / 3.6, o1: [0, 0.2 * vh],
        s2: (0.84 * vw) / date.width, o2: [0, 0.22 * vh],
      });
      U.uSize.value = 2.1;
      U.uMouseR.value = 0.18;
    } else {
      Object.assign(L, {
        s0: (0.84 * vw) / 6.5, o0: [0, 0.17 * vh],
        s1: Math.min((0.38 * vh) / 3.6, (0.8 * vw) / 3.2), o1: [0, 0.16 * vh],
        s2: (0.88 * vw) / date.width, o2: [0, 0.2 * vh],
      });
      U.uSize.value = 1.7;
      U.uMouseR.value = 0.22;
    }
    U.uO0.value.set(L.o0[0], L.o0[1], 0);
    U.uO1.value.set(L.o1[0], L.o1[1], 0);
    U.uO2.value.set(L.o2[0], L.o2[1], 0);
    U.uPickR.value = 0.08 * L.s0 * 2.4;
  }

  function matrices(t) {
    // bowl: spin about its own axis, then tip towards the camera for the 3/4 view
    R0.makeRotationX(st.tilt).multiply(tmp4.makeRotationY(st.rot));
    U.uM0.value.setFromMatrix4(R0).multiplyScalar(L.s0);
    pitch.position.set(L.o0[0], L.o0[1], 0);
    pitch.quaternion.setFromRotationMatrix(R0);
    pitch.scale.setScalar(L.s0);
    // crest "1": a gentle breathing turn plus pointer tilt
    R1.makeRotationY(Math.sin(t * 0.45) * (still ? 0 : 0.22) + st.mx * 0.25).multiply(tmp4.makeRotationX(-st.my * 0.18));
    U.uM1.value.setFromMatrix4(R1).multiplyScalar(L.s1);
    tmp4.makeRotationY(st.mx * 0.2).multiply(R1.makeRotationX(-st.my * 0.12));
    U.uM2.value.setFromMatrix4(tmp4).multiplyScalar(L.s2);
  }

  /* ── CPU mirror of the vertex shader (no wave / scatter) for picking and tracking ── */
  const ss = (v) => v * v * (3 - 2 * v);
  const stag = (m, r, k) => ss(Math.min(1, Math.max(0, m * 1.8 - r * 0.4 - k * 0.4)));
  const ap = (m, a, i, o, out) => {
    const e = m.elements, x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
    out[0] = e[0] * x + e[3] * y + e[6] * z + o.x;
    out[1] = e[1] * x + e[4] * y + e[7] * z + o.y;
    out[2] = e[2] * x + e[5] * y + e[8] * z + o.z;
  };
  const q0 = [0, 0, 0], q1 = [0, 0, 0], q2 = [0, 0, 0];
  function posOf(i, out) {
    ap(U.uM0.value, bowl.pos, i, U.uO0.value, q0);
    ap(U.uM1.value, one.pos, i, U.uO1.value, q1);
    ap(U.uM2.value, date.pos, i, U.uO2.value, q2);
    const e1 = stag(U.uMix1.value, aRand[i * 4], aRand[i * 4 + 2]);
    const e2 = stag(U.uMix2.value, aRand[i * 4 + 1], aRand[i * 4 + 3]);
    const sw = (Math.sin(Math.PI * e1) + Math.sin(Math.PI * e2)) * 0.55;
    let ei = Math.min(1, Math.max(0, U.uIntro.value * 1.7 - aRand[i * 4] * 0.7));
    ei = 1 - (1 - ei) ** 3;
    for (let k = 0; k < 3; k++) {
      let p = q0[k] + (q1[k] - q0[k]) * e1;
      p = p + (q2[k] - p) * e2 + aDir[i * 3 + k] * sw;
      const sc = aDir[i * 3 + k] * (5 + aRand[i * 4 + 1] * 7) + (k === 1 ? -1.5 : 0);
      out[k] = sc + (p - sc) * ei;
    }
    return out;
  }
  const VP = new THREE.Matrix4();
  const toScreen = (p) => {
    const e = VP.elements;
    const x = e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12];
    const y = e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13];
    const ww = e[3] * p[0] + e[7] * p[1] + e[11] * p[2] + e[15];
    return [((x / ww) * 0.5 + 0.5) * st.W, (0.5 - (y / ww) * 0.5) * st.H];
  };

  /* ── claim a seat ── */
  let picked = -1;
  const P = [0, 0, 0];
  function nearest(sx, sy, maxPx) {
    VP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    let best = -1, bd = maxPx * maxPx;
    for (let i = 0; i < N; i++) {
      const [x, y] = toScreen(posOf(i, P));
      const d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function claim(i) {
    if (i < 0) return;
    picked = i;
    U.uPickIdx.value = i;
    const s = bowl.seats;
    $('.js-seat-block', card).textContent = s.block[i];
    $('.js-seat-row', card).textContent = String(s.row[i]).padStart(2, '0');
    $('.js-seat-no', card).textContent = String(s.seat[i]).padStart(2, '0');
    $('.js-seat-tier', card).textContent = s.tierNames[s.tier[i]];
    $('.js-seat-id', card).textContent = `#${String(i + 1).padStart(5, '0')} / ${fmt(N)}`;
    card.hidden = false;
    lead.classList.add('is-on');
    gsap.killTweensOf(U.uPickAmt);
    gsap.fromTo(U.uPickAmt, { value: 0 }, { value: 1, duration: 0.9, ease: 'expo.out' });
    gsap.fromTo(card, { autoAlpha: 0, y: 14, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: 'expo.out', overwrite: true });
    gsap.fromTo($$('.seat__code b', card), { yPercent: 100 }, { yPercent: 0, duration: 0.7, stagger: 0.06, ease: 'expo.out' });
    root.classList.add('has-seat');
    place();
  }
  function release() {
    if (picked < 0) return;
    gsap.to(U.uPickAmt, { value: 0, duration: 0.4, onComplete: () => { U.uPickIdx.value = -1; } });
    gsap.to(card, { autoAlpha: 0, y: 10, duration: 0.3, overwrite: true, onComplete: () => { card.hidden = true; } });
    lead.classList.remove('is-on');
    root.classList.remove('has-seat');
    picked = -1;
  }
  $('.js-seat-close', card).addEventListener('click', release);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') release(); });

  function place() {
    if (picked < 0) return;
    posOf(picked, P);
    U.uPick.value.set(P[0], P[1], P[2]);
    const [x, y] = toScreen(P);
    const cw = card.offsetWidth, ch = card.offsetHeight, W = st.W, H = st.H;
    let cx, cy;
    if (W < 640) { cx = 16; cy = H - ch - 16; } else {
      cx = x + 40; cy = y - ch - 40;
      if (cx + cw > W - 24) cx = x - cw - 40;
      if (cy < 84) cy = Math.min(y + 40, H - ch - 24);
    }
    card.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    // leader line: point → nearest card corner
    const ax = Math.abs(x - cx) < Math.abs(x - (cx + cw)) ? cx : cx + cw;
    const ay = Math.abs(y - cy) < Math.abs(y - (cy + ch)) ? cy : cy + ch;
    lead.setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('line', lead).setAttribute('x1', x); $('line', lead).setAttribute('y1', y);
    $('line', lead).setAttribute('x2', ax); $('line', lead).setAttribute('y2', ay);
    $('circle', lead).setAttribute('cx', x); $('circle', lead).setAttribute('cy', y);
    const off = x < -20 || x > W + 20 || y < -20 || y > H + 20;
    lead.style.opacity = off ? 0 : '';
  }

  function claimRandom() {
    VP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    for (let tries = 0; tries < 400; tries++) {
      const i = Math.floor(Math.random() * N);
      const [x, y] = toScreen(posOf(i, P));
      if (x > st.W * 0.3 && x < st.W * 0.92 && y > st.H * 0.22 && y < st.H * 0.7) return claim(i);
    }
    claim(Math.floor(Math.random() * N));
  }

  /* ── pointer: springy scatter field + click to claim ── */
  const ptr = { tx: 9, ty: 9, x: 9, y: 9, vx: 0, vy: 0, s: 0, vs: 0, ts: 0, speed: 0, down: null };
  const ndc = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1), e.clientX - r.left, e.clientY - r.top];
  };
  stage.addEventListener('pointermove', (e) => {
    const [x, y] = ndc(e);
    if (ptr.tx > 5) { ptr.x = x; ptr.y = y; }
    ptr.speed = Math.min(3, ptr.speed + Math.hypot(x - ptr.tx, y - ptr.ty) * 6);
    ptr.tx = x; ptr.ty = y;
    ptr.ts = picked >= 0 || e.target.closest('.seat, a, button') ? 0 : 1;
    st.mx = x; st.my = y;
  });
  stage.addEventListener('pointerleave', () => { ptr.ts = 0; });
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.seat, a, button')) return;
    const [, , px, py] = ndc(e);
    ptr.down = { x: px, y: py, t: performance.now() };
    if (e.pointerType !== 'mouse') { const [x, y] = ndc(e); ptr.tx = x; ptr.ty = y; ptr.x = x; ptr.y = y; ptr.ts = 1; ptr.s = 0.6; }
  });
  stage.addEventListener('pointerup', (e) => {
    const d = ptr.down;
    ptr.down = null;
    if (e.pointerType !== 'mouse') ptr.ts = 0;
    if (!d || e.target.closest('.seat, a, button')) return;
    const [, , px, py] = ndc(e);
    if (Math.hypot(px - d.x, py - d.y) > 8 || performance.now() - d.t > 600) return;
    const i = nearest(px, py, st.W < 640 ? 48 : 36);
    if (i >= 0) { ptr.ts = 0; claim(i); } else release();
  });

  /* ── scroll: bowl → one → date ── */
  const panels = $$('.js-hc', root);
  gsap.set(panels.slice(1), { autoAlpha: 0, y: 40 });
  const tl = gsap.timeline({ defaults: { ease: 'none' } })
    .to(panels[0], { autoAlpha: 0, y: -50, duration: 0.8, ease: 'power2.in' }, 1.4)
    .to(U.uMix1, { value: 1, duration: 3 }, 1.5)
    .to(panels[1], { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 3.8)
    .to(panels[1], { autoAlpha: 0, y: -50, duration: 0.8, ease: 'power2.in' }, 5.9)
    .to(U.uMix2, { value: 1, duration: 3 }, 6)
    .to(panels[2], { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 8.2)
    .set({}, {}, 10);
  let stageNo = 1;
  ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.7, animation: tl,
    onUpdate: (self) => {
      const p = self.progress;
      const lit = Math.round(p * rail.length);
      rail.forEach((d, k) => d.classList.toggle('on', k < lit));
      const s = U.uMix2.value > 0.5 ? 3 : U.uMix1.value > 0.5 ? 2 : 1;
      if (s !== stageNo) {
        stageNo = s;
        steps.forEach((li, k) => li.classList.toggle('is-on', k === s - 1));
        if (hud.stage) hud.stage.textContent = ['01 / 03 · Bowl', '02 / 03 · The One', `03 / 03 · ${w.date} ${w.month}`][s - 1];
        panels.forEach((pn, k) => { pn.style.pointerEvents = k === s - 1 ? 'auto' : 'none'; });
      }
    },
  });
  panels.forEach((pn, k) => { pn.style.pointerEvents = k === 0 ? 'auto' : 'none'; });

  /* ── loop (paused while the hero is off-screen) ── */
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(root);
  let last = performance.now(), t = 0, frame = 0;
  function tick() {
    if (!visible) { last = performance.now(); return; }
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    U.uT.value = still ? 0 : t;
    if (!still) st.rot += dt * (picked >= 0 ? 0.015 : 0.07);
    // springs: the scatter hole trails the pointer and wobbles back into place
    const k = 160, c = 15;
    ptr.vx += (k * (ptr.tx - ptr.x) - c * ptr.vx) * dt; ptr.x += ptr.vx * dt;
    ptr.vy += (k * (ptr.ty - ptr.y) - c * ptr.vy) * dt; ptr.y += ptr.vy * dt;
    const ks = 70, cs = 7;
    ptr.vs += (ks * (ptr.ts * (1 + ptr.speed * 0.25) - ptr.s) - cs * ptr.vs) * dt; ptr.s += ptr.vs * dt;
    ptr.speed *= Math.exp(-dt * 3);
    U.uMouse.value.set(ptr.x, ptr.y);
    U.uMouseStr.value = Math.max(0, ptr.s);
    camera.position.x += (st.mx * 0.22 - camera.position.x) * 0.05;
    camera.position.y += (st.my * 0.14 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    matrices(t);
    const fade = 1 - Math.min(1, U.uMix1.value * 2.2);
    lm.opacity = 0.32 * fade * U.uIntro.value;
    pitchFill.material.opacity = 0.05 * fade * U.uIntro.value;
    pitch.visible = fade > 0.001;
    VP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    place();
    renderer.render(scene, camera);
    if (++frame % 4 === 0) {
      if (hud.view) hud.view.textContent = `${String(Math.round(((((st.rot * 180) / Math.PI) % 360) + 360) % 360)).padStart(3, '0')}°`;
      if (hud.ptr) hud.ptr.textContent = ptr.tx > 5 ? '—' : `${ptr.tx >= 0 ? '+' : '−'}${Math.abs(ptr.tx).toFixed(2)} ${ptr.ty >= 0 ? '+' : '−'}${Math.abs(ptr.ty).toFixed(2)}`;
    }
  }
  layout();
  addEventListener('resize', () => { layout(); place(); });
  gsap.ticker.add(tick);

  /* ── intro ── */
  const intro = () => {
    const tlI = gsap.timeline();
    const o = { n: 0 };
    tlI.to(U.uIntro, { value: 1, duration: 2.8, ease: 'power2.inOut' }, 0)
      .to(st, { rot: 0.55, duration: 3.4, ease: 'expo.out' }, 0)
      .to(o, { n: N, duration: 2.6, ease: 'power3.inOut', onUpdate: () => hud.count.forEach((el) => { el.textContent = fmt(o.n); }) }, 0.1)
      .to($$('.hc--1 .w > i', root), { yPercent: 0, duration: 1.1, stagger: 0.05, ease: 'expo.out' }, 0.9)
      .fromTo($$('.hc--1 [data-in], .hero__hud > *, .hero__rail, .hero__steps, .hero__hint', root), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out' }, 1.3);
    return tlI;
  };
  if (skip) hud.count.forEach((el) => { el.textContent = fmt(N); });

  return { intro, claimRandom, release };
}
