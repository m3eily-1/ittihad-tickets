// One fixed, full-screen WebGL canvas for the whole page.
// · the hero: the fluid sim's dye (the type, advected) composited with chromatic splitting
// · every [data-gl] element: a plane that tracks the element's rect each frame (DOM → WebGL sync)
//   The real <img> stays in the DOM (and visible until its texture is ready) for a11y/fallback.
import * as THREE from 'three';
import { createFluid, supportsFluid } from './fluid.js';

const Y = new THREE.Vector3(0.996, 0.949, 0.004);

/* ───────────── hero composite ───────────── */
const HERO_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const HERO_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uDye; uniform sampler2D uVel; uniform sampler2D uText;
uniform vec3 uY; uniform float uShift; uniform float uTime; uniform float uFade;
varying vec2 vUv;
float ink(float v, float aa) { return smoothstep(0.42 - aa, 0.42 + aa, v); }
void main() {
  vec2 vel = texture2D(uVel, vUv).xy;
  vec2 d = vel * uShift;
  float speed = length(vel);
  vec4 dye = texture2D(uDye, vUv);
  // threshold the advected dye so smears read as sharp-edged liquid, not blur
  float aa = clamp(fwidth(dye.r) * 0.9, 0.012, 0.2);
  float mG = ink(dye.r, aa);
  float mR = ink(texture2D(uDye, vUv + d).r, aa);
  float mB = ink(texture2D(uDye, vUv - d).r, aa);
  float stripes = dye.g;
  float smoke = clamp(dye.b, 0.0, 1.4);

  vec3 col = vec3(0.039);
  // faint crest stripes in the field, a touch brighter where the ink moves
  col += uY * stripes * (0.055 + min(speed * 0.0004, 0.06));
  // smoke: dim yellow ink behind the pointer, hot near the core
  col = mix(col, uY * 0.36, smoothstep(0.05, 1.1, smoke) * 0.75);
  col = mix(col, uY * 0.8, smoothstep(0.9, 1.4, smoke) * 0.4);
  col = mix(col, uY, clamp(mG, 0.0, 1.0));
  // chromatic fringes where the type is displaced
  col += vec3(1.0, 0.1, 0.32) * max(mR - mG, 0.0) * 0.95;
  col += vec3(0.08, 0.86, 1.0) * max(mB - mG, 0.0) * 0.85;
  // vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.55;
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

/* ───────────── poster planes ───────────── */
const PLANE_VERT = /* glsl */ `
uniform float uVel; uniform float uHover; uniform vec2 uMouse; uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  // bend with scroll velocity: the middle of the plane lags behind its edges
  float bow = sin(uv.x * 3.14159265);
  wp.y += bow * uVel;
  // hover: a soft bulge toward the viewer reads as a small outward push in 2D
  vec2 dm = (uv - uMouse) * vec2(uSize.x / uSize.y, 1.0);
  float f = exp(-dot(dm, dm) * 6.0) * uHover;
  wp.xy += (uv - uMouse) * uSize * f * 0.035;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const PLANE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex; uniform vec2 uSize; uniform vec2 uImg; uniform vec2 uMouse;
uniform float uHover; uniform float uTime; uniform float uVel; uniform float uReveal; uniform float uMode; uniform vec3 uY;
uniform float uClip; uniform float uViewH;
varying vec2 vUv;
float A(vec2 c) { return texture2D(uTex, c).a; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec2 cover(vec2 uv) {
  float sc = max(uSize.x / uImg.x, uSize.y / uImg.y);
  vec2 s = uImg * sc;
  return (uv - 0.5) * (uSize / s) + 0.5;
}
void main() {
  // clip to the owning section (the canvas is fixed, so planes would otherwise spill past the hero)
  if (uClip > 0.0 && uViewH - gl_FragCoord.y > uClip) discard;
  vec2 uv = vUv;
  float asp = uSize.x / uSize.y;
  if (uMode > 1.5) {
    // ── players: faces stay clean; only bodies ripple; yellow rim light + halo hug the silhouette
    vec2 dm2 = (vUv - uMouse) * vec2(asp, 1.0);
    float d2 = length(dm2);
    float body = smoothstep(0.62, 0.3, vUv.y);
    float f2 = exp(-d2 * d2 * 14.0) * uHover * body;
    vec2 q = vUv + (dm2 / max(d2, 1e-4)) * sin(d2 * 40.0 - uTime * 5.0) * 0.004 * f2 / vec2(asp, 1.0);
    q.x += sin(q.y * 22.0 + uTime * 1.4) * 0.0012 * body;
    vec2 px = 1.0 / uSize;
    vec2 cs = vec2(px.x * 4.0 * f2, 0.0);
    vec4 t = texture2D(uTex, q);
    vec3 c = vec3(texture2D(uTex, q + cs).r, t.g, texture2D(uTex, q - cs).b);
    float a = t.a;
    // lit edge: inside the figure, but the pixel toward the light (up-left) is empty
    float lit = a * (1.0 - A(q + vec2(-1.2, 1.8) * px)) * smoothstep(0.25, 0.55, vUv.y);
    float rimAll = a * (1.0 - min(min(A(q + vec2(2.0, 0.0) * px), A(q - vec2(2.0, 0.0) * px)), A(q + vec2(0.0, 2.0) * px)));
    c = mix(c, uY, clamp(lit * 0.7 + rimAll * 0.18 + rimAll * uHover * 0.3, 0.0, 1.0));
    // soft halo just outside the silhouette
    float h = 0.0;
    for (int i = 0; i < 8; i++) {
      float an = float(i) * 0.785398;
      h += A(q + vec2(cos(an), sin(an)) * px * 14.0);
    }
    h = h / 8.0 * (1.0 - a);
    float pulse = 0.16 + 0.06 * sin(uTime * 1.3) + 0.16 * uHover;
    float fade = smoothstep(0.0, 0.2, vUv.y);
    // ink reveal (bottom-up) reused for the intro
    float n = noise(vUv * vec2(5.0 * asp, 5.0) + uTime * 0.15) * 0.35;
    float p2 = uReveal * 1.25 - 0.1;
    float shown = 1.0 - smoothstep(p2 - 0.03, p2, (1.0 - vUv.y) * 0.62 + n);
    float alpha = (a + h * pulse) * fade * shown;
    vec3 outc = (c * a + uY * h * pulse) / max(a + h * pulse, 1e-4);
    gl_FragColor = vec4(outc, alpha);
    return;
  }
  vec2 dm = (uv - uMouse) * vec2(asp, 1.0);
  float dist = length(dm);
  float fall = exp(-dist * dist * 5.0) * uHover;
  // bulge: magnify toward the pointer
  uv = uMouse + (uv - uMouse) * (1.0 - 0.22 * fall);
  // ripple rings out from the pointer
  float rip = sin(dist * 34.0 - uTime * 6.0) * 0.007 * fall;
  uv += (dm / max(dist, 1e-4)) * rip / vec2(asp, 1.0);
  // mode 1 (crest pool): a constant slow water wobble
  if (uMode > 0.5) {
    uv.x += sin(uv.y * 18.0 + uTime * 1.6) * 0.004 + sin(uv.y * 7.0 - uTime) * 0.003;
    uv.y += cos(uv.x * 14.0 + uTime * 1.3) * 0.004;
  }
  // gentle zoom-out as it reveals, slight zoom-in on hover
  uv = (uv - 0.5) * (1.0 - 0.05 * uHover - 0.12 * (1.0 - uReveal)) + 0.5;
  vec2 c = cover(uv);
  vec2 sh = vec2(0.0015 * uHover + abs(uVel) * 0.00025, 0.0) + (dm / max(dist, 1e-4)) * 0.012 * fall;
  vec4 tg = texture2D(uTex, c);
  float r = texture2D(uTex, c + sh).r;
  float b = texture2D(uTex, c - sh).b;
  float shift = clamp(fall * 1.6 + uHover * 0.35 + abs(uVel) * 0.05, 0.0, 1.0);
  vec3 col = vec3(mix(tg.r, r, shift), tg.g, mix(tg.b, b, shift));
  float a = tg.a;
  // liquid reveal: a noisy ink edge floods the plane bottom-up
  float n = noise(vUv * vec2(5.0 * asp, 5.0) + uTime * 0.15) * 0.35 + noise(vUv * 22.0) * 0.08;
  float edge = (1.0 - vUv.y) * 0.62 + n;
  float p = uReveal * 1.25 - 0.1;
  float shown = 1.0 - smoothstep(p - 0.03, p, edge);
  // a yellow ink rim rides just ahead of the advancing edge
  float rim = smoothstep(p - 0.03, p, edge) * (1.0 - smoothstep(p + 0.025, p + 0.07, edge));
  col = mix(col, uY, rim);
  float alpha = max(shown * a, rim * (uMode > 0.5 ? a : 1.0));
  gl_FragColor = vec4(col, alpha);
}`;

export function createStage({ hero, stage, getVelocity, demo = false, intro = false }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  canvas.setAttribute('aria-hidden', 'true');
  // probe first so a machine without WebGL quietly keeps the DOM version (no three.js error spam)
  const probe = document.createElement('canvas');
  const ok = (() => { try { return !!(probe.getContext('webgl2') || probe.getContext('webgl')); } catch { return false; } })();
  if (!ok) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  document.body.prepend(canvas);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = true;

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const geoHi = new THREE.PlaneGeometry(1, 1, 48, 16);
  let W = 0, H = 0;
  function size() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2; cam.bottom = -H / 2;
    cam.updateProjectionMatrix();
  }
  size();

  // place a unit plane on a DOM rect (screen px → centred ortho space)
  function place(mesh, r) {
    mesh.position.set(r.left + r.width / 2 - W / 2, H / 2 - (r.top + r.height / 2), 0);
    mesh.scale.set(r.width, r.height, 1);
  }

  const pointer = { x: -1e4, y: -1e4, px: -1e4, py: -1e4, moved: false, t: 0 };
  const onMove = (x, y) => {
    pointer.x = x; pointer.y = y; pointer.moved = true; pointer.t = performance.now();
  };
  addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) { pointer.px = pointer.x = t.clientX; pointer.py = pointer.y = t.clientY; } }, { passive: true });

  /* ── hero ── */
  let heroState = null;
  const fluidOK = supportsFluid(renderer);
  if (hero && fluidOK) {
    const textCanvas = document.createElement('canvas');
    const textTex = new THREE.CanvasTexture(textCanvas);
    textTex.minFilter = THREE.LinearFilter; textTex.magFilter = THREE.LinearFilter; textTex.generateMipmaps = false;
    const fluid = createFluid(renderer, { restTexture: textTex });
    const mat = new THREE.ShaderMaterial({
      vertexShader: HERO_VERT, fragmentShader: HERO_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        uDye: { value: null }, uVel: { value: null }, uText: { value: textTex }, uY: { value: Y },
        uShift: { value: 0 }, uTime: { value: 0 }, uFade: { value: 1 },
      },
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    scene.add(mesh);
    heroState = { textCanvas, textTex, fluid, mat, mesh, w: 0, h: 0, restore: intro ? 0 : 0.06, introT: intro ? 0 : 1, ghost: 0, gx: 0.5, gy: 0.5 };
  }

  function drawType() {
    if (!heroState) return;
    const r = hero.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const sx = Math.min(dpr, 2);
    const cw = Math.round(r.width * sx), ch = Math.round(r.height * sx);
    const c = heroState.textCanvas;
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = 'lighter';

    // crest stripes in G: seven vertical bars, fading in toward the bottom
    const bars = 13, bw = cw / bars;
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, 'rgba(0,255,0,0.15)'); g.addColorStop(0.55, 'rgba(0,255,0,0.65)'); g.addColorStop(1, 'rgba(0,255,0,1)');
    ctx.fillStyle = g;
    for (let i = 1; i < bars; i += 2) ctx.fillRect(i * bw, 0, bw, ch);

    // the headline in R, each line fitted to the stage width
    const box = { x: (s.left - r.left) * sx, y: (s.top - r.top) * sx, w: s.width * sx, h: s.height * sx };
    // try a few line breaks and keep the one whose type covers the most of the stage
    const CANDIDATES = [['THE TIGERS', 'ARE HOME'], ['THE TIGERS', 'ARE', 'HOME'], ['THE', 'TIGERS', 'ARE HOME'], ['THE', 'TIGERS', 'ARE', 'HOME']];
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 100px Anton, Impact, sans-serif`;
    const gap = 0.055;
    let best = null;
    for (const lines of CANDIDATES) {
      const meas = lines.map((t) => {
        const m = ctx.measureText(t);
        const ink = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        return { t, size: (box.w / ink) * 100, asc: m.actualBoundingBoxAscent / 100, desc: Math.max(0, m.actualBoundingBoxDescent) / 100, left: m.actualBoundingBoxLeft / 100, ink: ink / 100 };
      });
      let total = meas.reduce((a, m) => a + (m.asc + m.desc) * m.size, 0) + (meas.length - 1) * gap * meas[0].size;
      const k = Math.min(1, box.h / total);
      const area = meas.reduce((a, m) => a + m.ink * m.size * (m.asc + m.desc) * m.size, 0) * k * k;
      if (!best || area > best.area) best = { meas, k, total: total * k, area };
    }
    const { meas, k, total } = best;
    const align = getComputedStyle(stage).textAlign === 'center' ? 'center' : 'left';
    let y = box.y + (box.h - total) / 2;
    ctx.fillStyle = 'rgb(255,0,0)';
    for (const m of meas) {
      const sz = m.size * k;
      ctx.font = `400 ${sz}px Anton, Impact, sans-serif`;
      y += m.asc * sz;
      const x = (align === 'center' ? box.x + (box.w - m.ink * sz) / 2 : box.x) + m.left * sz;
      ctx.fillText(m.t, x, y);
      y += m.desc * sz + gap * meas[0].size * k;
    }
    heroState.textTex.needsUpdate = true;
  }

  function resizeHero() {
    if (!heroState) return;
    const r = hero.getBoundingClientRect();
    if (Math.abs(r.width - heroState.w) < 2 && Math.abs(r.height - heroState.h) < 2) return;
    heroState.w = r.width; heroState.h = r.height;
    drawType();
    const dyeMax = Math.min(1800, Math.max(r.width, r.height) * Math.min(dpr, 1.5));
    heroState.fluid.resize(r.width, r.height, dyeMax);
    // upload the type texture before the dye copies it
    renderer.initTexture(heroState.textTex);
    heroState.fluid.fill(heroState.introT >= 1);
  }
  resizeHero();

  /* ── planes ── */
  const loader = new THREE.TextureLoader();
  const planes = [];
  function addPlane(el, { mode = 0, clip = null } = {}) {
    const img = el.querySelector('img');
    if (!img) return;
    const mat = new THREE.ShaderMaterial({
      vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, transparent: true, depthTest: false, depthWrite: false,
      uniforms: {
        uTex: { value: null }, uSize: { value: new THREE.Vector2(1, 1) }, uImg: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uHover: { value: 0 }, uTime: { value: 0 }, uVel: { value: 0 },
        uReveal: { value: 0 }, uMode: { value: mode }, uY: { value: Y }, uClip: { value: 0 }, uViewH: { value: 1 },
      },
    });
    const mesh = new THREE.Mesh(geoHi, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    const p = { el, mat, mesh, ready: false, hover: 0, mx: 0.5, my: 0.5, inside: false, mode, clip: clip || null };
    if (mode === 2) mesh.renderOrder = 1;
    loader.load(img.currentSrc || img.src, (tex) => {
      tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      tex.anisotropy = 4;
      mat.uniforms.uTex.value = tex;
      mat.uniforms.uImg.value.set(tex.image.width, tex.image.height);
      renderer.initTexture(tex);
      p.ready = true;
      el.classList.add('is-gl');
    });
    planes.push(p);
    return p;
  }

  /* ── frame ── */
  let time = 0, sv = 0, cleared = false, running = true;
  const params = new URLSearchParams(location.search);

  function frame(dt) {
    if (!running) return;
    dt = Math.min(dt, 1 / 30);
    time += dt;
    const v = getVelocity?.() || 0;
    sv += (v - sv) * 0.12;
    let any = false;

    // hero
    if (heroState) {
      const r = hero.getBoundingClientRect();
      const vis = r.bottom > 0 && r.top < H;
      heroState.mesh.visible = vis;
      if (vis) {
        any = true;
        place(heroState.mesh, r);
        // the type drifts a touch against the pointer; the players (DOM-driven) drift the other way
        if (pointer.x > -1e3) {
          heroState.ox = (heroState.ox || 0) + ((pointer.x / W - 0.5) * 14 - (heroState.ox || 0)) * 0.06;
          heroState.oy = (heroState.oy || 0) + ((pointer.y / H - 0.5) * 8 - (heroState.oy || 0)) * 0.06;
          heroState.mesh.position.x += heroState.ox;
          heroState.mesh.position.y -= heroState.oy;
        }
        const hs = heroState, f = hs.fluid;
        // intro: the ink pours in and settles into type
        if (hs.introT < 1) {
          hs.introT = Math.min(1, hs.introT + dt / 2.6);
          hs.restore = 0.004 + hs.introT * hs.introT * 0.06;
          if (hs.introT < 0.5 && Math.random() < 0.55) {
            const a = Math.random() * Math.PI * 2;
            f.splat(0.25 + Math.random() * 0.5, 0.3 + Math.random() * 0.4, Math.cos(a) * 900, Math.sin(a) * 900, 0.6, 0.006);
          }
        } else hs.restore = 0.1;
        // ambient: an invisible "ghost" pointer drifts through the type so it's never still
        const gx = 0.5 + 0.42 * Math.sin(time * 0.29) * Math.cos(time * 0.11);
        const gy = 0.5 + 0.26 * Math.sin(time * 0.43 + 1.3);
        const breathe = (0.55 + 0.45 * Math.sin(time * 0.37)) * Math.max(0.45, Math.min(1, r.width / r.height));
        f.splat(gx, gy, (gx - hs.gx) * 2800 * breathe, (gy - hs.gy) * 2800 * breathe, 0.012, 0.003);
        hs.gx = gx; hs.gy = gy;
        // ?demo=1: a stronger scripted stir (for headless screenshots of the pointer effect)
        if (demo) {
          const t = time * 0.9;
          const dx = 0.5 + 0.38 * Math.sin(t * 1.3), dy = 0.52 + 0.22 * Math.sin(t * 2.1);
          if (hs.dx != null) f.splat(dx, dy, (dx - hs.dx) * 9000, (dy - hs.dy) * 9000, 0.09, 0.0026);
          hs.dx = dx; hs.dy = dy;
        }
        // the real pointer / finger
        if (pointer.moved) {
          const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
          const ddx = pointer.x - pointer.px, ddy = pointer.y - pointer.py;
          if (inside && pointer.px > -1e3 && (ddx || ddy)) {
            const ux = (pointer.x - r.left) / r.width, uy = 1 - (pointer.y - r.top) / r.height;
            const mag = Math.min(1, Math.hypot(ddx, ddy) / 40);
            f.splat(ux, uy, (ddx / r.width) * 7000, (-ddy / r.height) * 7000, 0.08 + mag * 0.14, 0.0024);
          }
          pointer.px = pointer.x; pointer.py = pointer.y;
          pointer.moved = false;
        }
        f.step(dt, { restore: hs.restore, melt: Math.max(-900, Math.min(900, sv * 45)), time });
        hs.mat.uniforms.uDye.value = f.dye;
        hs.mat.uniforms.uVel.value = f.velocity;
        hs.mat.uniforms.uShift.value = f.simTexel.x * 0.022;
        hs.mat.uniforms.uTime.value = time;
        // fade out as the hero scrolls away
        hs.mat.uniforms.uFade.value = Math.max(0.25, 1 - Math.max(0, -r.top) / r.height * 0.8);
      }
    }

    // planes
    for (const p of planes) {
      const r = p.el.getBoundingClientRect();
      const vis = p.ready && r.bottom > -80 && r.top < H + 80 && r.width > 0;
      p.mesh.visible = vis;
      if (!vis) continue;
      any = true;
      place(p.mesh, r);
      const u = p.mat.uniforms;
      const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
      const target = inside || p.el.classList.contains('is-hot') ? 1 : 0;
      p.hover += (target - p.hover) * (target ? 0.08 : 0.05);
      if (inside) {
        p.mx += ((pointer.x - r.left) / r.width - p.mx) * 0.18;
        p.my += ((1 - (pointer.y - r.top) / r.height) - p.my) * 0.18;
      }
      u.uMouse.value.set(p.mx, p.my);
      u.uHover.value = p.hover;
      u.uSize.value.set(r.width, r.height);
      u.uTime.value = time;
      u.uVel.value = Math.max(-60, Math.min(60, -sv * 1.4));
      u.uReveal.value = p.reveal ?? 1;
      u.uViewH.value = H * dpr;
      u.uClip.value = p.clip ? p.clip.getBoundingClientRect().bottom * dpr : 0;
      // the trio is a solid in the flow: ink bends around their silhouette
      if (p.mode === 2 && heroState) {
        const hr = hero.getBoundingClientRect();
        heroState.fluid.setObstacle(u.uTex.value, [(r.left - hr.left) / hr.width, 1 - (r.bottom - hr.top) / hr.height, (r.right - hr.left) / hr.width, 1 - (r.top - hr.top) / hr.height]);
      }
    }

    if (!any) {
      if (!cleared) { renderer.setRenderTarget(null); renderer.clear(); cleared = true; }
      return;
    }
    cleared = false;
    renderer.setRenderTarget(null);
    renderer.render(scene, cam);
  }

  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { size(); resizeHero(); }, 120);
  });

  if (params.has('glstats')) setInterval(() => console.log(renderer.info.render.calls), 2000);

  return {
    renderer, addPlane, frame, planes, redraw: () => { if (heroState) { heroState.w = 0; resizeHero(); } },
    setRunning(v) { running = v; },
    hasHero: !!heroState,
  };
}
