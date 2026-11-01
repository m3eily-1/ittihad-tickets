// Run out (Ahmed, 2026-11-01, from the list of new games): an endless runner. You start in the players' tunnel with the
// ball at your feet, burst out into the floodlit bowl, and keep going for as long as you can: three lanes, kit hampers
// and cones in the tunnel, then cones, training mannequins, hurdles and defenders who slide across. Golden Tiger coins
// along the way pay Claws. Score: the metres you ran. Rookie / Pro / Legend set the pace and the gaps (tiers.js DIFF.runout).
//   swipe left / right (or tap the left / right of the screen) → change lane · swipe up (tap the middle) → jump
//   keys: ← → or A D · ↑ W or Space
import * as THREE from 'three';
import './run-out.css';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { tiers } from './tiers.js';
import { openShare } from './share-card.js';
import { h, topBar, lbBtn, btn, tierOf, tierChip, roundEnd, starsLine } from './minigames.js';
import { Y, K, canvasTex, pixTex, grassTex, crowdTex, boardTex, glowTex, makePlayer, makeBall } from './blocky.js';

const LANES = [-1.7, 0, 1.7];
const TUN = 64;                  // metres of tunnel before the pitch
const G = 20, JUMP_V = 6.6;      // gravity, take-off speed (≈ 1.1 m high, 0.66 s in the air)
const CREST = '/teams/al-ittihad.png';

const concreteTex = () => canvasTex(128, 128, (g, w, hh) => {
  g.fillStyle = '#3a3c40'; g.fillRect(0, 0, w, hh);
  for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.06)`; g.fillRect(Math.random() * w, Math.random() * hh, 2, 2); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, 2);
}, { repeat: [3, 32] });
const wallTex = () => canvasTex(256, 256, (g, w, hh) => {
  // a dark panelled wall, a club-yellow band at hand height, the panel joins
  const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#2a2b2e'); gr.addColorStop(1, '#141517');
  g.fillStyle = gr; g.fillRect(0, 0, w, hh);
  g.fillStyle = Y; g.fillRect(0, hh * 0.6, w, hh * 0.07);
  g.fillStyle = K; g.fillRect(0, hh * 0.67, w, hh * 0.03);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, 3, hh);
}, { repeat: [16, 1] });

export function buildRunOut(root, { opts, back }) {
  const tier = tierOf('runout', opts), D = tiers.diff('runout', tier);
  const bestEl = h('b', { text: String(tiers.best('runout', tier)) });
  const distEl = h('p', { class: 'ro-dist', 'aria-hidden': 'true' }, h('b', { text: '0' }), h('small', { text: 'm' }));
  const coinEl = h('b', { text: '0' });
  const live = h('p', { class: 'mg-sr', 'aria-live': 'polite' });
  const canvas = h('canvas', { class: 'ro-cv', tabindex: '0', role: 'application', 'aria-label': 'Run out. Swipe or use the arrow keys: left and right change lane, up jumps.' });
  const hint = h('div', { class: 'ro-hint' },
    h('p', { class: 'mg-k__hintt', text: 'Tap to run out' }),
    h('p', { class: 'mg-k__hints', text: matchMedia('(pointer: coarse)').matches ? 'Swipe left or right to change lane, swipe up to jump' : 'Arrow keys or A / D to change lane, Space or ↑ to jump' }),
  );
  const banner = h('p', { class: 'ro-banner', 'aria-hidden': 'true' });
  const card = h('div', { class: 'mg-k__over', hidden: true });
  const screen = h('section', { class: 'mg-screen ro' },
    canvas,
    topBar('Run out', back, [tierChip(tier), h('p', { class: 'mg-chip' }, 'Best ', bestEl), lbBtn('runout')]),
    distEl, h('p', { class: 'mg-chip ro-coins' }, h('i', { 'aria-hidden': 'true' }), coinEl),
    hint, banner, card, live,
  );
  root.append(screen);

  /* ── three ── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b14);
  scene.fog = new THREE.Fog(0x0a1020, 45, 190);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 320);
  const hemi = new THREE.HemisphereLight(0xe4ecff, 0x1d2a17, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(6, 30, 12); scene.add(sun);
  const disposables = [];
  const track = (x) => (disposables.push(x), x);

  // the pitch: mowing stripes every 5 m that come at you; the stands both sides, the LED boards in front of them
  const grassT = track(grassTex());
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 260), new THREE.MeshLambertMaterial({ map: grassT }));
  grass.rotation.x = -Math.PI / 2; grass.position.z = -110; scene.add(grass);
  const crowdT = track(crowdTex()), boardT = track(boardTex());
  const boardM = new THREE.MeshBasicMaterial({ map: boardT, toneMapped: false });
  for (const s of [-1, 1]) {
    const stand = new THREE.Mesh(new THREE.PlaneGeometry(260, 34), new THREE.MeshLambertMaterial({ map: crowdT, emissive: 0x222222, emissiveMap: crowdT }));
    stand.rotation.order = 'YXZ'; stand.rotation.set(-(Math.PI / 2 - 0.62), -s * Math.PI / 2, 0);   // facing the pitch, raked back at 35°
    stand.position.set(s * 27, 13.5, -110); scene.add(stand);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(260, 0.9), boardM);
    board.rotation.y = -s * Math.PI / 2; board.position.set(s * 12.5, 0.45, -110); scene.add(board);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(260, 16), new THREE.MeshBasicMaterial({ color: 0x0b0d12 }));
    roof.rotation.order = 'YXZ'; roof.rotation.set(Math.PI / 2 - 0.15, -s * Math.PI / 2, 0);
    roof.position.set(s * 40, 28, -110); scene.add(roof);
  }
  // floodlights along the roof's edge, passing overhead
  const glowT = track(glowTex());
  const lights = [];
  for (let i = 0; i < 16; i++) for (const s of [-1, 1]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xfff6dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.set(9, 9, 1); sp.userData = { s0: i * 16, x: s * 33, y: 27 }; scene.add(sp); lights.push(sp);
  }

  // the tunnel: walls, ceiling and its strip lights, a concrete floor; it slides past as you run (group z = distance)
  const tunnel = new THREE.Group(); scene.add(tunnel);
  {
    const wallT = track(wallTex()), floorT = track(concreteTex());
    const wallM = new THREE.MeshBasicMaterial({ map: wallT, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(TUN + 12, 3.8), wallM); w.rotation.y = s * Math.PI / 2; w.position.set(-s * 3.5, 1.9, -(TUN - 12) / 2); tunnel.add(w); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(7, TUN + 12), new THREE.MeshBasicMaterial({ color: 0x111215 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.8, -(TUN - 12) / 2); tunnel.add(ceil);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, TUN + 12), new THREE.MeshLambertMaterial({ map: floorT, color: 0xc8c8c8 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, -(TUN - 12) / 2); tunnel.add(floor);
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff3d0, toneMapped: false });
    // a strip light every 4 m, and the pool of light it throws on the floor
    const poolM = new THREE.MeshBasicMaterial({ map: track(glowTex()), color: 0xfff1c8, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let s = -8; s < TUN; s += 4) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.22), lampM); l.position.set(0, 3.76, -s); tunnel.add(l);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.6), poolM); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.02, -s); tunnel.add(pool);
    }
    // the mouth: a frame of the stand above it, and the light pouring in
    const frameM = new THREE.MeshBasicMaterial({ color: 0x0b0b0b });
    const top = new THREE.Mesh(new THREE.BoxGeometry(7.4, 6, 0.4), frameM); top.position.set(0, 3.8 + 3, -TUN); tunnel.add(top);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(6, 9.8, 0.4), frameM); side.position.set(s * 6.5, 4.9, -TUN); tunnel.add(side); }
  }

  /* ── you, the ball, your shadow ── */
  const name = progress.name || 'Tiger';
  const me = makePlayer({ name, num: '27' });
  me.g.rotation.y = Math.PI;   // facing down the track (−z): the camera sees the back of your shirt
  scene.add(me.g);
  const ball = makeBall();
  scene.add(ball);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; scene.add(blob);

  /* ── obstacles and coins (one prototype each, cloned per spawn) ── */
  const P = {};
  {
    const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
    const cone = new THREE.Group();
    const coneM = std({ color: 0xff6a00 }), white = std({ color: 0xffffff });
    // a cone of stacked blocks, a white one in the middle
    [[0.46, 0.08, coneM], [0.34, 0.14, coneM], [0.26, 0.1, white], [0.18, 0.18, coneM]].reduce((y, [w, hh, mm]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, w), mm); b.position.y = y + hh / 2; cone.add(b); return y + hh; }, 0);
    P.cone = { obj: cone, w: 0.5, dep: 0.5, hgt: 0.5, jump: true };
    const dummy = new THREE.Group(), dM = std({ color: 0x1f6fe0 }), dM2 = std({ color: 0x0f3f86 });
    // a training mannequin of blocks: base, post, body, shoulders, head
    for (const [w, hh, d, y, mm] of [[0.6, 0.06, 0.6, 0.03, dM2], [0.08, 0.26, 0.08, 0.19, dM2], [0.5, 1.12, 0.3, 0.88, dM], [0.68, 0.2, 0.3, 1.5, dM], [0.32, 0.32, 0.32, 1.78, dM]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mm); b.position.y = y; dummy.add(b); }
    P.dummy = { obj: dummy, w: 0.6, dep: 0.5, hgt: 2, jump: false };
    const hurdle = new THREE.Group(), hM = std({ color: 0xffd400 }), hK = std({ color: 0x111111 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 0.06), hM); bar.position.y = 0.52; hurdle.add(bar);
    for (const x of [-2.6, 0, 2.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.05), hK); leg.position.set(x, 0.26, 0); hurdle.add(leg); const ft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.4), hK); ft.position.set(x, 0.02, 0); hurdle.add(ft); }
    P.hurdle = { obj: hurdle, w: 5.4, dep: 0.3, hgt: 0.56, jump: true, wide: true };
    const hamper = new THREE.Group(), bM = std({ color: 0x1a1a1a }), bY = std({ color: 0xffd400 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.7), bM); box.position.y = 0.31; hamper.add(box);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.08, 0.72), bY); strip.position.y = 0.48; hamper.add(strip);
    P.hamper = { obj: hamper, w: 0.95, dep: 0.75, hgt: 0.64, jump: true };
    const def = makePlayer({ shirt: 0xf3f3f3, stripe: 0xf3f3f3, panel: 0xf3f3f3, ink: 0x1d4fa3, num: '4', shorts: 0x1d4fa3, socks: 0xf3f3f3, skin: 0x8a5a3b, hair: 0x0d0a08 });
    P.defender = { obj: def.g, w: 0.6, dep: 0.4, hgt: 1.8, jump: false };
    // a Golden Tiger: a gold coin with the crest on both faces
    // (pixel art too: an eight-sided coin, the crest drawn into 16 × 16 pixels)
    const coinFace = track(pixTex(16, 16, (g) => { g.fillStyle = '#a77d0c'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#e8b923'; g.fillRect(1, 1, 14, 14); g.fillStyle = '#fff1a6'; g.fillRect(2, 2, 3, 1); g.fillRect(2, 2, 1, 3); }));
    const crest = new Image(); crest.onload = () => { const c = coinFace.image, g = c.getContext('2d'); g.drawImage(crest, 4, 3, 8, 10); coinFace.needsUpdate = true; }; crest.src = CREST;
    const faceM = std({ map: coinFace, metalness: 0.6, roughness: 0.35, emissive: 0x3a2a00 }), rimM = std({ color: 0xd9a514, metalness: 0.8, roughness: 0.3, emissive: 0x2a1d00 });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8), [rimM, faceM, faceM]);
    coin.rotation.x = Math.PI / 2;
    const cg = new THREE.Group(); cg.add(coin);
    P.coin = { obj: cg };
  }
  const live3 = [];   // { kind, s, x, lane, mesh, slide?, coin? }
  const spawn = (kind, s, x, extra = {}) => {
    const p = P[kind], m = p.obj.clone();
    scene.add(m);
    const o = { kind, s, x, mesh: m, ...p, ...extra };
    live3.push(o); return o;
  };

  /* ── state ── */
  let W = 0, H = 0, raf = 0, last = 0, dead = false;
  let state = 'ready';                  // ready → run → fall → over
  let d = 0, v = 0, coins = 0, lane = 1, x = 0, y = 0, vy = 0, phase = 0, nextS = 0, outside = false, fallT = 0, t = 0, ach = false;
  const reset = () => {
    for (const o of live3) scene.remove(o.mesh);
    live3.length = 0;
    state = 'ready'; d = 0; v = 0; coins = 0; lane = 1; x = 0; y = 0; vy = 0; phase = 0; nextS = 22; outside = false; fallT = 0; ach = false;
    me.g.rotation.set(0, Math.PI, 0); me.g.position.set(0, 0, 0);
    distEl.firstChild.textContent = '0'; coinEl.textContent = '0';
    hint.hidden = false; card.hidden = true; card.replaceChildren(); banner.classList.remove('is-on');
    // the first coins, to show what they are
    for (let i = 0; i < 4; i++) spawn('coin', 10 + i * 2.2, LANES[1], { coinY: 0.8 });
    canvas.focus({ preventScroll: true });
  };

  const speedAt = () => D.v0 + (D.vMax - D.v0) * Math.min(1, d / D.ramp);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  function spawnRow(s) {
    if (s < TUN - 6) {
      // the tunnel: kit hampers and cones, one or two lanes
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.35 ? 2 : 1);
      for (const l of lanes) spawn(Math.random() < 0.5 ? 'hamper' : 'cone', s, LANES[l]);
      const free = [0, 1, 2].find((l) => !lanes.includes(l));
      if (Math.random() < 0.5) for (let i = 0; i < 4; i++) spawn('coin', s + 3 + i * 2, LANES[free], { coinY: 0.8 });
      return;
    }
    const r = Math.random();
    if (r < D.slide) {
      // a defender sliding across the lanes
      spawn('defender', s, 0, { slide: { at: Math.random() * Math.PI * 2, w: 1.2 + Math.random() * 0.8 } });
      return;
    }
    if (r < D.slide + 0.16 && s > TUN + 30) {
      // a hurdle across the whole track, coins in an arc over it
      spawn('hurdle', s, 0);
      const l = (Math.random() * 3) | 0;
      for (let i = -2; i <= 2; i++) spawn('coin', s + i * 1.3, LANES[l], { coinY: 0.8 + (1 - (i * i) / 5) * 0.9 });
      return;
    }
    // one or two lanes blocked, at least one lane always runs clear
    const n = Math.random() < 0.45 + Math.min(0.3, d / 3000) ? 2 : 1;
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, n);
    for (const l of lanes) spawn(Math.random() < 0.5 ? 'dummy' : 'cone', s, LANES[l]);
    const free = [0, 1, 2].filter((l) => !lanes.includes(l));
    if (Math.random() < 0.55) { const l = pick(free); for (let i = 0; i < 5; i++) spawn('coin', s + 3 + i * 2, LANES[l], { coinY: 0.8 }); }
  }

  /* ── controls ── */
  const move = (dir) => {
    if (state === 'ready') begin();
    if (state !== 'run') return;
    const nl = Math.max(0, Math.min(2, lane + dir));
    if (nl !== lane) { lane = nl; feel.tap(); }
  };
  const jump = () => {
    if (state === 'ready') { begin(); return; }
    if (state !== 'run' || y > 0.02) return;
    vy = JUMP_V; feel.buzz?.(10);
  };
  function begin() { if (state !== 'ready') return; state = 'run'; hint.hidden = true; v = D.v0 * 0.6; }
  const sw = { on: false, x: 0, y: 0, done: false };
  const onDown = (e) => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); Object.assign(sw, { on: true, x: e.clientX, y: e.clientY, done: false }); };
  const onMove = (e) => {
    if (!sw.on || sw.done) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    sw.done = true;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1); else if (dy < 0) jump();
  };
  const onUp = (e) => {
    if (!sw.on) return;
    sw.on = false;
    if (sw.done) return;
    if (state === 'ready') { begin(); return; }
    // a tap: the outer thirds change lane, the middle jumps
    const r = canvas.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width;
    if (fx < 0.33) move(-1); else if (fx > 0.67) move(1); else jump();
  };
  const onKey = (e) => {
    if (e.target.closest?.('button')) return;
    const k = e.key.toLowerCase();
    if (k === 'enter' && state === 'over') { e.preventDefault(); reset(); return; }
    if (['arrowleft', 'a'].includes(k)) { e.preventDefault(); move(-1); }
    else if (['arrowright', 'd'].includes(k)) { e.preventDefault(); move(1); }
    else if (['arrowup', 'w', ' ', 'spacebar'].includes(k)) { e.preventDefault(); if (!e.repeat) jump(); }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { sw.on = false; });
  screen.addEventListener('keydown', onKey);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W / H < 0.8 ? 72 : 60;   // a phone held upright sees all three lanes
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  function say(text) { banner.textContent = text; banner.classList.remove('is-on'); void banner.offsetWidth; banner.classList.add('is-on'); }
  function crash() {
    state = 'fall'; fallT = 0; feel.miss();
    live.textContent = `Down! ${Math.floor(d)} metres.`;
  }
  function gameOver() {
    state = 'over';
    const score = Math.floor(d);
    const prevBest = tiers.best('runout', tier);
    progress.setBest('runout', score);
    const rec = roundEnd('runout', tier, score, { coins });
    const isBest = score > 0 && score > prevBest;
    const xp = Math.min(120, Math.floor(score / 10) + coins);
    if (xp > 0) progress.award(xp, `Run out · ${score} m`);
    bestEl.textContent = String(tiers.best('runout', tier));
    if (isBest) { feel.win(); feel.confetti({ n: 160, y: 0.3 }); }
    card.replaceChildren(h('div', { class: 'mg-card' },
      h('p', { class: 'mg-card__eyebrow', text: outside ? 'Brought down on the pitch' : 'Down in the tunnel' }),
      h('p', { class: 'mg-card__big' }, String(score), h('small', { text: ' m' })),
      h('p', { class: 'mg-card__label', text: `${coins} Golden Tiger${coins === 1 ? '' : 's'}` }),
      isBest ? h('p', { class: 'mg-badge', text: prevBest ? `New best · was ${prevBest} m` : 'New best' }) : h('p', { class: 'mg-card__sub', text: `Best ${tiers.best('runout', tier)} m` }),
      ...starsLine(tier, rec),
      xp > 0 ? h('p', { class: 'mg-card__xp', text: `+${xp} XP` }) : null,
      h('div', { class: 'mg-card__row' },
        btn('Run again', () => { feel.tap(); reset(); }, { aria: 'Run again' }),
        btn('Share', () => { feel.tap(); openShare({ kind: 'score', game: 'runout', score, tier, stars: rec.stars }); }, { kind: 'ghost', aria: 'Share your score' }),
        btn('Back', back, { kind: 'ghost', aria: 'Back — close the game' }),
      ),
    ));
    card.hidden = false;
    live.textContent = `Game over. ${score} metres, ${coins} coins.${isBest ? ' New best!' : ''}`;
    requestAnimationFrame(() => card.querySelector('.mg-btn')?.focus({ preventScroll: true }));
  }

  const step = (now) => {
    if (dead) return;
    raf = requestAnimationFrame(step);
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 0); last = now; t += dt;
    const d0 = d;
    if (state === 'run') {
      v += (speedAt() - v) * (1 - Math.exp(-dt * 1.5));
      d += v * dt;
      vy -= G * dt; y = Math.max(0, y + vy * dt); if (y === 0) vy = 0;
      phase += dt * (5 + v * 0.38);
      if (!outside && d > TUN) { outside = true; feel.roar(); say('Out on the pitch'); }
      if (!ach && d >= 500) { ach = true; progress.achieve('run-500'); }
      while (nextS < d + 110) { spawnRow(nextS); nextS += Math.max(D.gap * 0.6, D.gap - d / 260) + Math.random() * 4; }
      distEl.firstChild.textContent = String(Math.floor(d));
    } else if (state === 'fall') {
      fallT += dt; v *= Math.exp(-dt * 5); d += v * dt;
      vy -= G * dt; y = Math.max(0, y + vy * dt);
      if (fallT > 1.1) gameOver();
    } else if (state === 'ready') phase += dt * 2.2;
    x += (LANES[lane] - x) * (1 - Math.exp(-dt * 14));

    // you: legs and arms swing, a little bob; tipping forward when you're brought down
    const run = state === 'run' ? 1 : state === 'ready' ? 0.25 : 0;
    const sL = Math.sin(phase) * (y > 0.02 ? 0.35 : 0.95) * run;
    me.legs[0].rotation.x = sL; me.legs[1].rotation.x = -sL;
    me.arms[0].rotation.x = -sL * 0.8; me.arms[1].rotation.x = sL * 0.8;
    me.g.position.set(x, y + Math.abs(Math.cos(phase)) * 0.05 * run, 0);
    me.g.rotation.z = (LANES[lane] - x) * -0.12;
    if (state === 'fall' || state === 'over') me.g.rotation.x = Math.min(1.35, (state === 'over' ? 1 : fallT / 0.5) * 1.35) * -1;
    // the ball, a touch ahead, nudged on each stride
    const bz = state === 'fall' || state === 'over' ? -0.9 - (fallT * v * 0.3) : -0.75;
    ball.position.set(x + (LANES[lane] - x) * -0.2, 0.11 + Math.abs(Math.sin(phase * 0.5)) * 0.1 * run + (state === 'run' ? y * 0.8 : 0), bz);
    ball.rotation.x -= (v * dt) / 0.11;
    blob.position.set(x, 0.02, 0); blob.scale.setScalar(1 - Math.min(0.5, y * 0.4));

    // the world comes at you
    tunnel.position.z = d; tunnel.visible = d < TUN + 40;
    grassT.offset.y = d / 10;
    crowdT.offset.x = -d / 26; boardT.offset.x = -d / 21.7;
    for (const l of lights) { const u = ((l.userData.s0 - d) % 256 + 256) % 256; l.position.set(l.userData.x, l.userData.y, -u + 20); }
    // inside the tunnel the bowl's floodlights barely reach you
    const k = THREE.MathUtils.smoothstep(d, TUN - 14, TUN + 4);
    hemi.intensity = 0.75 + 0.45 * k; sun.intensity = 0.7 + 1.1 * k;

    // obstacles and coins: place, collide, collect, recycle
    for (let i = live3.length - 1; i >= 0; i--) {
      const o = live3[i];
      let ox = o.x;
      if (o.slide) { ox = Math.sin(t * o.slide.w + o.slide.at) * 1.9; o.mesh.rotation.y = (Math.PI / 2) * Math.sign(Math.cos(t * o.slide.w + o.slide.at) || 1); }   // facing the way he's going
      const z = -(o.s - d);
      o.mesh.position.set(ox, o.kind === 'coin' ? o.coinY : 0, z);
      if (o.kind === 'coin') {
        o.mesh.rotation.y += dt * 3;
        if (state === 'run' && Math.abs(o.s - d) < 0.7 + v * dt && Math.abs(ox - x) < 0.7 && Math.abs(o.coinY - (y + 0.9)) < 0.9) {
          coins++; coinEl.textContent = String(coins);
          scene.remove(o.mesh); live3.splice(i, 1);
          feel.buzz?.(6);
          continue;
        }
      } else if (state === 'run') {
        // swept along this frame's stretch of track, so a fast frame can't step through it
        const hw = o.wide ? 2.75 : o.w / 2;
        if (o.s - o.dep / 2 - 0.3 <= d && o.s + o.dep / 2 + 0.3 >= d0 && Math.abs(ox - x) < hw + 0.22 && !(o.jump && y > o.hgt - 0.08)) crash();
      }
      if (z > 8) { scene.remove(o.mesh); live3.splice(i, 1); }
    }

    // the camera: behind and above, easing into your lane; a touch lower and closer in the tunnel
    const cz = 5.6 + (W / H < 0.8 ? 1.4 : 0), cy = 2.6 + k * 0.5;
    camera.position.set(x * 0.6, cy, cz);
    camera.lookAt(x * 0.35, 1.0, -8);
    renderer.render(scene, camera);
  };

  resize();
  reset();
  raf = requestAnimationFrame(step);
  window.__runout = { get d() { return d; }, get lane() { return lane; }, get y() { return y; }, get state() { return state; }, live: live3, move, jump };   // debug handle, like __tunnel

  return () => {
    dead = true; cancelAnimationFrame(raf); ro.disconnect(); delete window.__runout;
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp);
    screen.removeEventListener('keydown', onKey);
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); });
    disposables.forEach((x) => x.dispose());
    renderer.dispose(); renderer.forceContextLoss();
  };
}
