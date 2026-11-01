// One-two (Ahmed, 2026-11-01, from the second list of new games): pass, move, get it back. You break from halfway with
// the ball; a line of defenders slides across in front of you and a teammate runs across behind them. Tap where to
// pass: lead him through a gap. He gives it straight back and you run through the same gap to meet it. Three one-twos
// take you into the box and you score; then a new attack from halfway, a little quicker. One misplaced pass (cut out,
// missed him, out of play) or the clock running out (closed down) ends the run. Score: the one-twos you played.
// Real footballers (players.js), like Run out. Rookie / Pro / Legend set the line, his pace and the clock (tiers.js DIFF.onetwo).
//   tap / click → pass there (drag to aim first; on a computer the aim follows the mouse) · keys: ← → aim, Space pass
import * as THREE from 'three';
import './run-out.css';
import './one-two.css';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { tiers } from './tiers.js';
import { openShare } from './share-card.js';
import { h, topBar, lbBtn, btn, tierOf, tierChip, roundEnd, starsLine } from './minigames.js';
import { canvasTex, crowdTex, boardTex, glowTex, makeBall } from './pitch-kit.js';
import { loadPlayers } from './players.js';

const STEP = 14;            // metres up the pitch for each one-two
const LINE = 7;             // the defenders, this far in front of you
const DEEP = 12.5;          // your teammate, beyond them
const PER_ATTACK = 3;       // one-twos, then the shot
const GOAL_Z = -52.5;       // the goal line (halfway is z = 0)
const MATE_X = 5.5;         // he runs between −5.5 and 5.5
const OUT_X = 9.5;          // past this the pass has gone out of play
const RUN_V = 7.5;          // your sprint (m/s)
const BALL_R = 0.12;

// the half of the pitch you attack, 15 px a metre: mowing stripes, the lines, both boxes, the spot and the arc
const PX = 15, Z_FAR = -62, Z_NEAR = 10;
const pitchTex = () => canvasTex(68 * PX, (Z_NEAR - Z_FAR) * PX, (g, w, hh) => {
  const X = (x) => (x + 34) * PX, Zp = (z) => (z - Z_FAR) * PX;
  for (let z = Z_FAR, i = 0; z < Z_NEAR; z += 5, i++) { g.fillStyle = i % 2 ? '#2b7330' : '#327f37'; g.fillRect(0, Zp(z), w, 5 * PX); }
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.04)`; g.fillRect(Math.random() * w, Math.random() * hh, 1, 2); }
  g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 2; g.fillStyle = 'rgba(255,255,255,0.92)';
  const rect = (x0, z0, x1, z1) => g.strokeRect(X(x0), Zp(z0), X(x1) - X(x0), Zp(z1) - Zp(z0));
  rect(-34, GOAL_Z, 34, Z_NEAR + 5);                                    // touchlines and the goal line
  g.beginPath(); g.moveTo(0, Zp(0)); g.lineTo(w, Zp(0)); g.stroke();      // halfway
  g.beginPath(); g.arc(X(0), Zp(0), 9.15 * PX, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(X(0), Zp(0), 2, 0, Math.PI * 2); g.fill();
  rect(-20.16, GOAL_Z, 20.16, GOAL_Z + 16.5);                           // the box
  rect(-9.16, GOAL_Z, 9.16, GOAL_Z + 5.5);                              // the six-yard box
  g.beginPath(); g.arc(X(0), Zp(GOAL_Z + 11), 2, 0, Math.PI * 2); g.fill();
  const a = Math.acos(5.5 / 9.15);                                      // the arc: the part of the spot's circle outside the box
  g.beginPath(); g.arc(X(0), Zp(GOAL_Z + 11), 9.15 * PX, Math.PI / 2 - a, Math.PI / 2 + a); g.stroke();
  for (const s of [-1, 1]) { g.beginPath(); g.arc(X(s * 34), Zp(GOAL_Z), PX, s < 0 ? 0 : Math.PI / 2, s < 0 ? Math.PI / 2 : Math.PI); g.stroke(); }
});
const netTex = () => canvasTex(64, 64, (g, w) => {
  g.clearRect(0, 0, w, w);
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
  for (let i = 0; i <= w; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
}, { repeat: [6, 2] });

const tri = (u, m) => { const p = 4 * m, k = ((u + m) % p + p) % p; return k < 2 * m ? k - m : 3 * m - k; };   // bounce between −m and m
// the closest point of the segment a→b to p, as t ∈ [0, 1] and the distance
function closest(ax, az, bx, bz, px, pz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return { t, d: Math.hypot(ax + dx * t - px, az + dz * t - pz) };
}

export function buildOneTwo(root, { opts, back }) {
  const tier = tierOf('onetwo', opts), D = tiers.diff('onetwo', tier);
  const bestEl = h('b', { text: String(tiers.best('onetwo', tier)) });
  const scoreEl = h('p', { class: 'ro-dist', 'aria-hidden': 'true' }, h('b', { text: '0' }));
  const goalsEl = h('b', { text: '0' });
  const clockFill = h('i', { class: 'ot-clock__fill' });
  const live = h('p', { class: 'mg-sr', 'aria-live': 'polite' });
  const coarse = matchMedia('(pointer: coarse)').matches;
  const canvas = h('canvas', { class: 'ro-cv', tabindex: '0', role: 'application', 'aria-label': 'One-two. Tap where to pass, or aim with the left and right arrow keys and pass with Space.' });
  const hint = h('div', { class: 'ro-hint' },
    h('p', { class: 'mg-k__hintt', text: 'Tap where to pass' }),
    h('p', { class: 'mg-k__hints', text: `Lead your teammate through a gap in the line. He gives it back: three one-twos and you're in on goal.${coarse ? '' : ' ← → and Space work too.'}` }),
  );
  const banner = h('p', { class: 'ro-banner', 'aria-hidden': 'true' });
  const fade = h('div', { class: 'ot-fade', 'aria-hidden': 'true' });
  const card = h('div', { class: 'mg-k__over', hidden: true });
  const screen = h('section', { class: 'mg-screen ro ot' },
    canvas,
    topBar('One-two', back, [tierChip(tier), h('p', { class: 'mg-chip' }, 'Best ', bestEl), lbBtn('onetwo')]),
    h('div', { class: 'ot-clock', 'aria-hidden': 'true' }, clockFill),
    scoreEl, h('p', { class: 'mg-chip ot-goals' }, 'Goals ', goalsEl),
    hint, banner, fade, card, live,
  );
  root.append(screen);

  /* ── three ── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b14);
  scene.fog = new THREE.Fog(0x0a1020, 60, 170);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xe4ecff, 0x1d2a17, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(8, 30, 14); scene.add(sun);
  const disposables = [];
  const track = (x) => (disposables.push(x), x);

  // the pitch, the dark apron round it, the stands on three sides with LED boards in front, the goal
  const grassT = track(pitchTex());
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(68, Z_NEAR - Z_FAR), new THREE.MeshLambertMaterial({ map: grassT }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.z = (Z_NEAR + Z_FAR) / 2; scene.add(pitch);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(140, 160), new THREE.MeshLambertMaterial({ color: 0x24602a }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.01, -30); scene.add(apron);
  const crowdT = track(crowdTex()), boardT = track(boardTex());
  const crowdM = new THREE.MeshLambertMaterial({ map: crowdT, emissive: 0x222222, emissiveMap: crowdT });
  const boardM = new THREE.MeshBasicMaterial({ map: boardT, toneMapped: false });
  for (const s of [-1, 1]) {
    const stand = new THREE.Mesh(new THREE.PlaneGeometry(130, 34), crowdM);
    stand.rotation.order = 'YXZ'; stand.rotation.set(-(Math.PI / 2 - 0.62), -s * Math.PI / 2, 0);   // facing the pitch, raked back
    stand.position.set(s * 52, 13.5, -25); scene.add(stand);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(130, 0.9), boardM);
    board.rotation.y = -s * Math.PI / 2; board.position.set(s * 37, 0.45, -25); scene.add(board);
  }
  {
    const end = new THREE.Mesh(new THREE.PlaneGeometry(130, 34), crowdM);
    end.rotation.x = 0.62; end.position.set(0, 13.5, GOAL_Z - 22); scene.add(end);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(90, 0.9), boardM); board.position.set(0, 0.45, GOAL_Z - 5); scene.add(board);
  }
  const glowT = track(glowTex());
  for (const [x, z] of [[-46, -70], [46, -70], [-50, 8], [50, 8], [-50, -32], [50, -32]]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xfff6dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.scale.set(14, 14, 1); sp.position.set(x, 30, z); scene.add(sp);
  }
  {
    // the goal: square white posts and bar, a net of squares behind
    const post = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.44, 0.12), post); p.position.set(s * 3.72, 1.22, GOAL_Z); scene.add(p); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(7.56, 0.12, 0.12), post); bar.position.set(0, 2.44, GOAL_Z); scene.add(bar);
    const netM = new THREE.MeshBasicMaterial({ map: track(netTex()), transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const backNet = new THREE.Mesh(new THREE.PlaneGeometry(7.44, 2.44), netM); backNet.position.set(0, 1.22, GOAL_Z - 2); scene.add(backNet);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(7.44, 2), netM); roof.rotation.x = Math.PI / 2; roof.position.set(0, 2.44, GOAL_Z - 1); scene.add(roof);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.44), netM); side.rotation.y = Math.PI / 2; side.position.set(s * 3.72, 1.22, GOAL_Z - 1); scene.add(side); }
  }

  /* ── the players (players.js: real people, loaded before the first kick) ── */
  let team = null, me = null, mates = [], keeper = null;
  function cast() {
    me = team.make({ kit: 'home', person: 0, name: progress.name || 'Tiger', num: '27' });
    me.g.rotation.y = Math.PI; scene.add(me.g);   // facing up the pitch: the camera sees your back
    // a teammate beyond each line (the 9, the 10, the 7), facing up the pitch too
    mates = ['9', '10', '7'].map((num, k) => { const p = team.make({ kit: 'home', person: (k + 1) % 2, num }); p.g.rotation.y = Math.PI; scene.add(p.g); return p; });
    keeper = team.make({ kit: 'keeper', person: 1, num: '1' });
    keeper.g.position.set(0, 0, GOAL_Z + 0.6); scene.add(keeper.g);
  }
  const ball = makeBall(BALL_R); scene.add(ball);
  const shadowM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  const blob = (r) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), shadowM); m.rotation.x = -Math.PI / 2; m.position.y = 0.015; scene.add(m); return m; };
  const meShadow = blob(0.42), ballShadow = blob(0.13);
  // the aim: a row of square dots on the grass · Rookie's guide: a square where your teammate will be when it gets there
  const dotM = new THREE.MeshBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.9, toneMapped: false });
  const dotG = new THREE.BoxGeometry(0.16, 0.02, 0.16);
  const dots = Array.from({ length: 16 }, () => { const m = new THREE.Mesh(dotG, dotM); m.visible = false; scene.add(m); return m; });
  const guide = new THREE.Group();
  for (const [w, d, x, z] of [[1.4, 0.1, 0, -0.65], [1.4, 0.1, 0, 0.65], [0.1, 1.4, -0.65, 0], [0.1, 1.4, 0.65, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), dotM); b.position.set(x, 0.02, z); guide.add(b); }
  guide.visible = false; scene.add(guide);

  /* ── state ── */
  let W = 0, H = 0, raf = 0, last = 0, dead = false, t = 0;
  let state = 'ready';     // ready → aim → pass → back → (aim … | shot → goal → aim …) · fail → over
  let score = 0, goals = 0, attack = 0, phase = 0, clock = 0, pace = 1, aimAng = 0, aiming = !coarse, why = '', failT = 0, stateT = 0;
  const you = { x: 0, z: 0, run: 0, kick: 0 };
  const bl = { x: 0, z: -0.6, y: BALL_R, vx: 0, vz: 0, vy: 0, roll: 0 };
  let lines = [], route = null, ret = null, gapX = 0, cutBy = null, shot = null, celebrate = 0;
  const mateState = Array.from({ length: PER_ATTACK }, () => ({ u: 0, dir: 1, x: 0, z: 0, catchT: -1, face: Math.PI }));

  // a line of defenders: evenly spread across 14 m, each sliding on his own sine; together they open and close gaps
  function makeLine(k) {
    const n = D.def, s = 14 / n, zL = -(k * STEP) - LINE;
    const men = [];
    for (let i = 0; i < n; i++) {
      const p = team.make({ kit: 'away', person: i % 2 }); scene.add(p.g);
      men.push({ p, g: p.g, base: -7 + s * (i + 0.5), A: s * 0.44, ph: Math.random() * Math.PI * 2, w: D.slide * (0.8 + Math.random() * 0.45), x: 0, z: zL, frozen: false, push: 0, look: 0 });
    }
    return { k, z: zL, men };
  }
  const defX = (m, at) => m.frozen ? m.x : m.base + m.A * Math.sin(at * m.w * pace + m.ph);
  const mateZ = (k) => -(k * STEP) - DEEP;

  function newAttack() {
    for (const L of lines) for (const m of L.men) team.release(m.p);
    lines = Array.from({ length: PER_ATTACK }, (_, k) => makeLine(k));
    phase = 0; you.x = 0; you.z = 0; you.run = 0; route = null; ret = null; shot = null; cutBy = null;
    mateState.forEach((ms, k) => Object.assign(ms, { u: (Math.random() * 2 - 1) * MATE_X, dir: Math.random() < 0.5 ? -1 : 1, z: mateZ(k), catchT: -1, face: Math.PI }));
    keeper.g.position.set(0, 0, GOAL_Z + 0.6); keeper.g.rotation.set(0, 0, 0);
    placeBall();
    clock = D.clock + 0.6;   // a moment to look up first
  }
  const placeBall = () => { Object.assign(bl, { x: you.x, z: you.z - 0.6, y: BALL_R, vx: 0, vz: 0, vy: 0 }); };
  function reset() {
    state = 'ready'; score = 0; goals = 0; attack = 0; pace = 1; aimAng = 0; why = ''; t = 0; failT = 0; celebrate = 0;
    scoreEl.firstChild.textContent = '0'; goalsEl.textContent = '0';
    hint.hidden = false; card.hidden = true; card.replaceChildren(); banner.classList.remove('is-on');
    newAttack();
    canvas.focus({ preventScroll: true });
  }

  /* ── passing ── */
  const aimDir = () => ({ x: Math.sin(aimAng), z: -Math.cos(aimAng) });
  function pass() {
    if (!team || (state !== 'ready' && state !== 'aim')) return;
    if (state === 'ready') hint.hidden = true;
    const d = aimDir();
    Object.assign(bl, { x: you.x + d.x * 0.6, z: you.z + d.z * 0.6, vx: d.x * D.ball, vz: d.z * D.ball });
    you.kick = 1; state = 'pass'; stateT = 0; gapX = null;
    feel.tap();
  }
  // where the active teammate will be `dt` seconds from now (no change of direction)
  const mateAt = (k, dt) => tri(mateState[k].u + mateState[k].dir * D.mate * pace * dt, MATE_X);

  /* ── controls: aim at the pointer on the grass, pass on release; ← → and Space ── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  const aimAt = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(ground, hit)) return;
    const dx = hit.x - you.x, dz = hit.z - you.z;
    if (dz > -0.5) { aimAng = Math.sign(dx || 1) * 1.25; return; }
    aimAng = Math.max(-1.25, Math.min(1.25, Math.atan2(dx, -dz)));
  };
  let down = false;
  const onDown = (e) => { e.preventDefault(); canvas.setPointerCapture?.(e.pointerId); down = true; aiming = true; aimAt(e); };
  const onMove = (e) => { if (down || !coarse) { aiming = true; aimAt(e); } };
  const onUp = (e) => { if (!down) return; down = false; aimAt(e); if (coarse) aiming = false; if (state === 'over') return; pass(); };
  const onKey = (e) => {
    if (e.target.closest?.('button')) return;
    const k = e.key.toLowerCase();
    if (k === 'enter' && state === 'over') { e.preventDefault(); reset(); return; }
    if (['arrowleft', 'a'].includes(k)) { e.preventDefault(); aiming = true; aimAng = Math.max(-1.25, aimAng - 0.06); }
    else if (['arrowright', 'd'].includes(k)) { e.preventDefault(); aiming = true; aimAng = Math.min(1.25, aimAng + 0.06); }
    else if ([' ', 'spacebar', 'enter', 'arrowup', 'w'].includes(k)) { e.preventDefault(); if (!e.repeat) pass(); }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { down = false; });
  screen.addEventListener('keydown', onKey);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = W / H < 0.8 ? 66 : 52; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  function say(text) { banner.textContent = text; banner.classList.remove('is-on'); void banner.offsetWidth; banner.classList.add('is-on'); }
  const toScreen = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; };

  function fail(reason) {
    state = 'fail'; failT = 0; why = reason; feel.miss();
    live.textContent = `${{ cut: 'Cut out', miss: 'Missed him', out: 'Out of play', clock: 'Closed down' }[reason]}. ${score} one-two${score === 1 ? '' : 's'}.`;
  }
  // the teammate has it: he lays it straight back, into your path beyond the line, and you run through the gap to meet it
  function caught(k) {
    const ms = mateState[k];
    ms.catchT = t; score++; scoreEl.firstChild.textContent = String(score);
    const at = toScreen(ms.x, 2.2, ms.z); feel.pop?.('ONE-TWO', at); feel.buzz?.(12);
    live.textContent = `One-two. ${score}.`;
    pace = Math.min(1.4, 1 + score * 0.025);
    const L = lines[phase], tz = -((phase + 1) * STEP);
    const gx = gapX ?? ms.x, tx = Math.max(-5, Math.min(5, (gx + ms.x) / 2));
    // the beaten line stops and steps out of your way
    for (const m of L.men) { m.x = defX(m, t); m.frozen = true; const off = m.x - gx; if (Math.abs(off) < 1.1) m.push = (Math.sign(off || 1) * 1.1) - off; }
    route = { pts: [[you.x, you.z], [gx, L.z], [tx, tz]], seg: 0 };
    const len = Math.hypot(gx - you.x, L.z - you.z) + Math.hypot(tx - gx, tz - L.z);
    const arrive = len / RUN_V, wait = 0.18;
    ret = { from: [ms.x, ms.z], to: [tx, tz], t0: t + wait, dur: Math.max(0.45, arrive - wait) };
    Object.assign(bl, { x: ms.x, z: ms.z + 0.5, vx: 0, vz: 0 });
    state = 'back'; stateT = 0;
  }
  function received() {
    you.x = route.pts[2][0]; you.z = route.pts[2][1]; route = null; ret = null; placeBall();
    phase++;
    if (phase >= PER_ATTACK) { startShot(); return; }
    state = 'aim'; stateT = 0; clock = D.clock;
    aimAng = 0;
  }
  // into the box: a low shot into a corner, the keeper the wrong way
  function startShot() {
    state = 'shot'; stateT = 0;
    const side = Math.random() < 0.5 ? -1 : 1, tx = side * 2.9, ty = 0.5 + Math.random() * 1.2;
    const dist = Math.hypot(tx - you.x, GOAL_Z - you.z), dur = dist / 24;
    shot = { from: [bl.x, bl.z], to: [tx, GOAL_Z - 1.2], ty, dur, side, t0: 0.32 };
  }
  function scored() {
    goals++; goalsEl.textContent = String(goals);
    state = 'goal'; stateT = 0; celebrate = 0;
    feel.goal(); feel.roar(); say('Goal!'); feel.confetti({ n: 110, y: 0.25 });
    live.textContent = `Goal! ${goals} goal${goals === 1 ? '' : 's'}, ${score} one-twos.`;
    if (goals === 3) progress.achieve('onetwo-hat');
  }

  function gameOver() {
    state = 'over';
    const prevBest = tiers.best('onetwo', tier);
    progress.setBest('onetwo', score);
    const rec = roundEnd('onetwo', tier, score, { goals });
    const isBest = score > 0 && score > prevBest;
    const xp = Math.min(120, score * 6 + goals * 10);
    if (xp > 0) progress.award(xp, `One-two · ${score}`);
    bestEl.textContent = String(tiers.best('onetwo', tier));
    if (isBest) { feel.win(); feel.confetti({ n: 160, y: 0.3 }); }
    const eyebrow = { cut: 'Cut out by the defence', miss: 'The pass missed him', out: 'Out of play', clock: 'Closed down' }[why];
    card.replaceChildren(h('div', { class: 'mg-card' },
      h('p', { class: 'mg-card__eyebrow', text: eyebrow }),
      h('p', { class: 'mg-card__big', text: String(score) }),
      h('p', { class: 'mg-card__label', text: `one-two${score === 1 ? '' : 's'} · ${goals} goal${goals === 1 ? '' : 's'}` }),
      isBest ? h('p', { class: 'mg-badge', text: prevBest ? `New best · was ${prevBest}` : 'New best' }) : h('p', { class: 'mg-card__sub', text: `Best ${tiers.best('onetwo', tier)}` }),
      ...starsLine(tier, rec),
      xp > 0 ? h('p', { class: 'mg-card__xp', text: `+${xp} XP` }) : null,
      h('div', { class: 'mg-card__row' },
        btn('Play again', () => { feel.tap(); reset(); }, { aria: 'Play One-two again' }),
        btn('Share', () => { feel.tap(); openShare({ kind: 'score', game: 'onetwo', score, tier, stars: rec.stars }); }, { kind: 'ghost', aria: 'Share your score' }),
        btn('Back', back, { kind: 'ghost', aria: 'Back — close the game' }),
      ),
    ));
    card.hidden = false;
    live.textContent = `${eyebrow}. ${score} one-twos, ${goals} goals.${isBest ? ' New best!' : ''}`;
    requestAnimationFrame(() => card.querySelector('.mg-btn')?.focus({ preventScroll: true }));
  }

  const step = (now) => {
    if (dead) return;
    raf = requestAnimationFrame(step);
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 0); last = now;
    if (state !== 'fail' || failT < 0.6) t += dt;
    stateT += dt;

    // the clock (not before the first pass)
    if (state === 'aim') {
      clock -= dt;
      if (clock <= 0) { fail('clock'); cutBy = lines[phase].men.reduce((a, m) => (Math.abs(defX(m, t) - you.x) < Math.abs(defX(a, t) - you.x) ? m : a)); cutBy.frozen = true; cutBy.x = defX(cutBy, t); }
    }
    clockFill.style.transform = `scaleX(${state === 'aim' ? Math.max(0, Math.min(1, clock / D.clock)) : state === 'ready' ? 1 : 0})`;
    screen.classList.toggle('is-late', state === 'aim' && clock < 1.5);

    // teammates: the one you're playing to runs across behind his line (Legend: and cuts back when he likes); the others jog on the spot
    mateState.forEach((ms, k) => {
      const active = k === phase && (state === 'ready' || state === 'aim' || state === 'pass');
      if (active) {
        if (D.juke && state !== 'pass' && Math.random() < D.juke * dt) ms.dir *= -1;
        ms.u += ms.dir * D.mate * pace * dt;
        ms.x = tri(ms.u, MATE_X);
        const going = Math.sign(tri(ms.u + 0.01 * ms.dir, MATE_X) - ms.x) || ms.dir;
        ms.face += ((going > 0 ? Math.PI / 2 : -Math.PI / 2) - ms.face) * Math.min(1, dt * 10);   // side-on, the way he's running
      } else if (ms.catchT < 0) ms.x = tri(ms.u, MATE_X);
      else if (t - ms.catchT > 0.4) ms.x += ((ms.x >= you.x ? 1 : -1) * 10 - ms.x) * Math.min(1, dt * 1.2);   // laid it off: away out wide, out of your way
      if (ms.catchT >= 0) ms.face += (0 - ms.face) * Math.min(1, dt * 10);   // turned to lay it back
      const p = mates[k];
      p.g.position.set(ms.x, 0, ms.z);
      p.g.rotation.y = active ? ms.face : (ms.catchT >= 0 ? ms.face : Math.PI);
      const kick = ms.catchT >= 0 && t - ms.catchT < 0.4 ? (t - ms.catchT) / 0.4 : 0;
      p.pose({ run: active ? 1 : 0.12, phase: t * 11 + k, kick });
    });

    // defenders: slide, freeze once beaten, step aside, turn to watch you go
    for (const L of lines) for (const m of L.men) {
      if (m.frozen && m.push) { const s = m.push * Math.min(1, dt * 8); m.x += s; m.push -= s; if (Math.abs(m.push) < 0.01) m.push = 0; }
      const x = defX(m, t), moving = !m.frozen, press = m === cutBy && why === 'clock' ? Math.min(1, failT / 0.5) : 0;   // closing you down
      m.g.position.set(x + press * (you.x - x), 0, m.z + press * (you.z - m.z - 0.9));
      if (m.frozen && L.k < phase + (state === 'back' ? 1 : 0)) m.look += ((you.z < m.z ? Math.PI : 0) - m.look) * Math.min(1, dt * 6);
      m.g.rotation.y = m.look;
      const vx = moving ? m.A * m.w * pace * Math.cos(t * m.w * pace + m.ph) : 0;
      m.p.pose({ crouch: press ? 0 : m.frozen ? 0.12 : 0.32, shuffle: Math.min(1, Math.abs(vx) / 2.2), run: press, phase: t * 9 + m.ph });   // a defender's stance, side-stepping
    }

    // the ball
    if (state === 'pass') {
      const ax = bl.x, az = bl.z;
      bl.x += bl.vx * dt; bl.z += bl.vz * dt;
      const L = lines[phase], ms = mateState[phase];
      if (gapX == null && bl.z <= L.z) gapX = ax + (bl.x - ax) * ((L.z - az) / ((bl.z - az) || -1e-6));
      // the first thing the ball reaches along this frame's stretch: a defender, or your teammate
      let first = null;
      for (const m of L.men) { const c = closest(ax, az, bl.x, bl.z, defX(m, t), m.z); if (c.d < D.reach + BALL_R && (!first || c.t < first.t)) first = { t: c.t, m }; }
      const cm = closest(ax, az, bl.x, bl.z, ms.x, ms.z);
      if (cm.d < D.catch && (!first || cm.t < first.t)) first = { t: cm.t, mate: true };
      if (first?.m) { cutBy = first.m; bl.x = ax + (bl.x - ax) * first.t; bl.z = az + (bl.z - az) * first.t; cutBy.x = defX(cutBy, t); cutBy.frozen = true; fail('cut'); }
      else if (first?.mate) caught(phase);
      else if (bl.z < ms.z - 2.5) fail('miss');
      else if (Math.abs(bl.x) > OUT_X) fail('out');
    } else if (state === 'back' && ret) {
      const k = Math.max(0, Math.min(1, (t - ret.t0) / ret.dur));
      bl.x = ret.from[0] + (ret.to[0] - ret.from[0]) * k; bl.z = ret.from[1] + 0.5 + (ret.to[1] - 0.6 - ret.from[1] - 0.5) * k;   // to just in front of your feet
    } else if (state === 'fail') {
      if (why === 'cut') { bl.vx = 0; bl.vz = 0; if (cutBy) { bl.x = cutBy.x; bl.z = cutBy.z + 0.45; } }
      else if (why === 'clock') { if (failT > 0.5 && cutBy) { bl.x = cutBy.g.position.x; bl.z = cutBy.g.position.z + 0.45; } }
      else { bl.vx *= Math.exp(-dt * 1.2); bl.vz *= Math.exp(-dt * 1.2); bl.x += bl.vx * dt; bl.z += bl.vz * dt; }
      failT += dt; if (failT > 1.3) gameOver();
    } else if (state === 'shot' && shot) {
      if (stateT > shot.t0) {
        if (!shot.kicked) { shot.kicked = true; you.kick = 1; feel.tap(); }
        const k = Math.min(1, (stateT - shot.t0) / shot.dur);
        bl.x = shot.from[0] + (shot.to[0] - shot.from[0]) * k; bl.z = shot.from[1] + (shot.to[1] - shot.from[1]) * k;
        bl.y = BALL_R + shot.ty * Math.sin(Math.min(1, k * 1.1) * Math.PI * 0.5);
        // the keeper goes the other way
        const kd = Math.min(1, (stateT - shot.t0) / 0.45);
        keeper.g.position.x = -shot.side * 1.6 * kd; keeper.g.position.y = Math.sin(kd * Math.PI) * 0.35; keeper.g.rotation.z = shot.side * 1.25 * kd;
        if (k >= 1) scored();
      }
    } else if (state === 'goal') {
      celebrate += dt;
      if (celebrate > 1.7 && !fade.classList.contains('is-on')) fade.classList.add('is-on');
      if (celebrate > 2.05) { attack++; bl.y = BALL_R; newAttack(); state = 'aim'; stateT = 0; aimAng = 0; fade.classList.remove('is-on'); say(`Attack ${attack + 1}`); }
    } else if (state === 'ready' || state === 'aim') placeBall();
    if (state !== 'shot' && state !== 'goal') bl.y = BALL_R;
    const sp = Math.hypot(bl.vx, bl.vz) || (state === 'back' ? 12 : 0);
    bl.roll += sp * dt / BALL_R;
    ball.position.set(bl.x, bl.y, bl.z); ball.rotation.x = -bl.roll;
    ballShadow.position.set(bl.x, 0.015, bl.z);

    // you: on the run behind the line to meet the return
    if (state === 'back' && route) {
      let move = RUN_V * dt;
      while (move > 0 && route.seg < 2) {
        const [tx, tz] = route.pts[route.seg + 1], dx = tx - you.x, dz = tz - you.z, d = Math.hypot(dx, dz);
        if (d <= move) { you.x = tx; you.z = tz; move -= d; route.seg++; } else { you.x += dx / d * move; you.z += dz / d * move; move = 0; }
      }
      you.run = 1;
      if (route.seg >= 2 && t >= ret.t0 + ret.dur) received();
    } else if (state === 'pass') { you.run = Math.min(1, you.run + dt * 3); you.z -= dt * 1.5; }
    else you.run = Math.max(state === 'aim' || state === 'ready' ? 0.2 : 0, you.run - dt * 3);
    you.kick = Math.max(0, you.kick - dt * 3.2);
    me.g.position.set(you.x, 0, you.z);
    me.g.rotation.y = Math.PI - (state === 'aim' || state === 'ready' ? aimAng * 0.6 : 0);
    me.pose({ run: you.run, phase: t * 11, kick: you.kick > 0 ? 1 - you.kick : 0, arms: state === 'goal' ? 'up' : 'run' });
    keeper.pose({ crouch: state === 'shot' && shot?.kicked ? 0 : 0.4, arms: 'out' });
    meShadow.position.set(you.x, 0.015, you.z);

    // the aim dots, and Rookie's guide
    const showAim = (state === 'aim' || state === 'ready') && aiming;
    const d = aimDir();
    dots.forEach((m, i) => { const s = 1 + i * 0.8; m.visible = showAim; m.position.set(you.x + d.x * s, 0.03, you.z + d.z * s); });
    guide.visible = D.lead && (state === 'aim' || state === 'ready');
    if (guide.visible) {
      const ms = mateState[phase], dist = Math.hypot(ms.x - you.x, ms.z - you.z);
      guide.position.set(mateAt(phase, dist / D.ball), 0, ms.z);
      guide.scale.setScalar(1 + Math.sin(t * 6) * 0.06);
    }

    // the camera: behind you and up, looking up the pitch; on the shot it settles on the goal
    const tall = W / H < 0.8;
    const fx = state === 'shot' || state === 'goal' ? you.x * 0.3 : you.x * 0.5;
    const cz = you.z + (tall ? 11 : 9), cy = tall ? 8.6 : 6.6;
    camera.position.x += (fx - camera.position.x) * Math.min(1, dt * 3);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 3);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 3);
    camera.lookAt(camera.position.x * 0.6, 0.3, camera.position.z - (tall ? 20 : 18));
    renderer.render(scene, camera);
  };

  resize();
  camera.position.set(0, W / H < 0.8 ? 8.6 : 6.6, W / H < 0.8 ? 11 : 9);
  camera.lookAt(0, 0.3, camera.position.z - 18);
  renderer.render(scene, camera);
  // the players come out first (their models load once; a second game is quick)
  const hintT = hint.firstChild.textContent;
  hint.firstChild.textContent = 'The players are coming out…';
  loadPlayers().then((T) => {
    if (dead) { T.dispose(); return; }
    team = T; cast(); reset();
    hint.firstChild.textContent = hintT;
    raf = requestAnimationFrame(step);
  }).catch((err) => { console.warn('[one-two]', err); hint.firstChild.textContent = 'The players could not load. Try again in a moment.'; });
  // debug handle, like __runout: the state, and a pass at an angle (radians from straight up the pitch)
  window.__onetwo = {
    get state() { return state; }, get score() { return score; }, get goals() { return goals; }, get phase() { return phase; },
    get you() { return { ...you }; }, get mate() { return { ...mateState[phase] }; }, get t() { return t; },
    lines: () => lines.map((L) => ({ z: L.z, men: L.men.map((m) => ({ x: defX(m, t), base: m.base, A: m.A, ph: m.ph, w: m.w * pace, frozen: m.frozen })) })),
    D, get pace() { return pace; }, mateAt, MATE_X,
    pass(a) { aimAng = a; pass(); },
    players: () => ({ me, mates, keeper, lines }),
  };

  return () => {
    dead = true; cancelAnimationFrame(raf); ro.disconnect(); delete window.__onetwo;
    canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp);
    screen.removeEventListener('keydown', onKey);
    team?.dispose();   // the players first: their geometry and textures are the stands' too
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose()); });
    disposables.forEach((x) => x.dispose());
    renderer.dispose(); renderer.forceContextLoss();
  };
}
