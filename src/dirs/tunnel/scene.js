// Hero controller: renderer + post, the scroll-driven camera walk-out, pointer look, lens flares.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { buildWorld, TN, FOG, DOORS, fogU } from './world.js';
import * as TX from './textures.js';
import { createBowlTifo } from './tifo.js';
import { buildMuseum } from './museum.js';
import { buildStore } from './store.js';
import { buildGym } from './gym.js';
import { buildFame } from './fame.js';
import { buildFantasy } from './fantasy.js';
import { buildChanging } from './changing.js';
import { buildActualLockerRoom } from './lockerroom.js';
import { buildMatchRoom, MATCH_HOLD_Z } from './matchroom.js';
import { buildPitchCrests } from './pitchcrests.js';
import { createSeatPicker } from './seats.js';
import { buildDoors, ROOM_DOORS } from './doors.js';
import { buildCity, setTimeOfDay, lookFor } from './city.js';
import { NEON, GLOW } from './fx.js';
import { createPenaltyGame } from './penalty.js';
import { buildPosters } from './posters.js';
import { REAL, setupRealism } from './realism.js';
import { mergeStatic } from './merge.js';

// camera keyframes: [progress, position, look-at]
const KEYS = [
  [0.0, [0, 1.7, 99.2], [0, 2.0, 40]],         // just inside the end wall: the changing room's door is ahead on the left
  [0.1, [0.4, 1.7, 90], [2.6, 1.95, 80]],       // glances at the trophy room's doors (right)
  [0.21, [0, 1.72, 82], [-0.6, 2.3, 62]],
  [0.33, [0.3, 1.7, 74], [-3.0, 1.95, 64]],     // the club store's (left)
  [0.44, [-0.3, 1.7, 66], [3.0, 1.95, 57]],     // the matches room's (right)
  [0.54, [0, 1.72, 57.5], [0, 1.95, 30]],
  [0.61, [0, 1.78, 48.8], [0, 2.3, 20]],
  [0.67, [0, 2.6, 40], [0, 4.2, 0]],
  [0.76, [2, 13, 30], [0, 10, -14]], // looks up at the far stand so its tifo reads
  [0.86, [-6, 40, 42], [-4, 0, -12]],
  [1.0, [-32, 96, 112], [-22, 22, -22]],
];

// textures loading through three's default manager (the realistic materials): counted so the loader can wait for them
const PENDING = { n: 0 };
{ const M = THREE.DefaultLoadingManager, st = M.itemStart.bind(M), en = M.itemEnd.bind(M), er = M.itemError.bind(M);
  M.itemStart = (u) => { PENDING.n++; st(u); }; M.itemEnd = (u) => { PENDING.n--; en(u); }; M.itemError = (u) => { er(u); }; }
const DBG_CAM = new URLSearchParams(location.search).get('cam')?.split(',').map(Number); // debug close-ups
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export async function createTunnel(canvas, { lite = false, still = false, onProgress, onTifo, onRoom, onSeat, onBook, onDoor, onVisit, onGame, onExitAsk, onLoad, onRoomClick, onRoomHover } = {}) {
  // loading progress for the loader's crest fill (main.js): the build steps below take it to 0.7, prepare() to 1
  let built = 0; const STEPS = 12; const step = () => onLoad?.(0.7 * Math.min(1, ++built / STEPS));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: lite, powerPreference: 'high-performance', alpha: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  const bloomOn = !lite && GLOW;
  const dprCap = bloomOn || (REAL && !lite) ? 1.5 : 2;   // the post chain (MSAA + AO) at 2× cost twice the frame time for little gain

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG.color, FOG.density);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 6000);   // far enough for the city and sky round the stadium

  const W = await buildWorld({ lite });
  step();
  scene.add(W.root);

  /* ── path ── */
  const pos = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal');
  const look = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2])), false, 'centripetal');
  const n = KEYS.length - 1;
  function sample(p, outP, outL) {
    p = clamp01(p);
    let i = 0;
    while (i < n - 1 && p > KEYS[i + 1][0]) i++;
    const lt = clamp01((p - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]));
    const u = (i + lt) / n;
    pos.getPoint(u, outP);
    look.getPoint(u, outL);
  }

  /* ── the walk (Ahmed, 2026-10-11): it starts in the tunnel and goes straight down it and out into the
     bowl. Every room — the changing room behind you, and the three side rooms — is behind closed doors,
     entered only from its "Discover" button (see the room visits below), so scrolling never turns into one. ── */
  // scroll → walk progress. Down the tunnel past every room door, a hold right before the mouth where the
  // upcoming matches float in front of you (matchroom.js; Ahmed: all the rooms come before the tickets), then the bowl.
  // (Ahmed, 2026-10-21: the tickets moved out of the tunnel to their own screen — the walk is the tour now, so it no
  // longer stops for the match cards; set CARDS back to true to bring the hold and the cards back)
  const CARDS = false;
  const HOLD = CARDS ? [0.4, 0.5] : [0.45, 0.45];
  const P_HOLD = (() => { const a = new THREE.Vector3(), b = new THREE.Vector3(); let lo = 0.5, hi = 0.66;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; sample(m, a, b); if (a.z > MATCH_HOLD_Z) lo = m; else hi = m; } return (lo + hi) / 2; })();
  const camP = (si) => si < HOLD[0] ? (si / HOLD[0]) * P_HOLD
    : si < HOLD[1] ? P_HOLD
    : si < 0.56 ? P_HOLD + ((si - HOLD[1]) / (0.56 - HOLD[1])) * (0.67 - P_HOLD)
    : 0.67 + ((si - 0.56) / 0.44) * 0.33;
  // 0 → 1 → 0 across the hold: the cards fly in as you arrive and part as you walk on
  const holdK = (sv) => (CARDS ? smooth(HOLD[0] - 0.012, HOLD[0], sv) * (1 - smooth(HOLD[1], HOLD[1] + 0.015, sv)) : 0);   // gone quickly once you walk on
  const walkPre = (sv) => camP(sv);
  const samplePre = (sv, outP, outL) => sample(camP(sv), outP, outL);

  /* ── B's tifo on the far stand: it goes up when you walk out into the bowl ── */
  const refCam = new THREE.PerspectiveCamera(56, 1.6, 0.6, 2000);
  // designs are proportioned for the touchline view, where the tifo is seen face-on
  { const a = new THREE.Vector3(), b = new THREE.Vector3(); sample(0.8, a, b); refCam.position.copy(a); refCam.lookAt(b); }
  const tifo = await createBowlTifo({ lite, refCam, still, onChange: onTifo });
  step();
  W.stadium.add(tifo.mesh);
  // the two clubs' crests painted either side of the centre circle
  const crests = await buildPitchCrests();
  step();
  W.stadium.add(crests.group);
  for (const m of W.tifoTiers) m.uniforms.uTifo.value.set(tifo.arc.centre, tifo.arc.half, 0);

  /* ── the trophy room off the tunnel ── */
  const museum = buildMuseum({ renderer, lite });
  step();
  W.tunnel.add(museum.group);
  const store = await buildStore({ env: museum.env, lite });
  step();
  W.tunnel.add(store.group);
  const gym = await buildGym({ env: museum.env, lite });
  step();
  W.tunnel.add(gym.group);
  const fame = await buildFame({ env: museum.env, lite });
  step();
  W.tunnel.add(fame.group);
  const fantasy = await buildFantasy({ env: museum.env });
  step();
  W.tunnel.add(fantasy.group);
  // ?locker=actual: the real dressing room, from Ahmed's photos (lockerroom.js); otherwise the designed one
  const changing = new URLSearchParams(location.search).get('locker') === 'actual' ? await buildActualLockerRoom({ env: museum.env, lite }) : await buildChanging({ env: museum.env, lite });
  step();
  W.tunnel.add(changing.group);
  const matches = await buildMatchRoom({ env: museum.env, lite, onBook: (m) => onBook?.(m) });
  step();
  W.tunnel.add(matches.group);
  let roomState = { room: null, focus: -1 };
  /* ── side rooms behind closed doors (doors.js). "Discover" opens the doors and takes you in; inside,
     scrolling (wheel, drag, arrow keys) moves you round the room, and scrolling past either end — or
     "Back to tunnel" — brings you back out to where you were, the doors close and the walk carries on. ── */
  const posterSet = await buildPosters(W.tunnel, W.stencils);   // club posters along the walls (posters.js)
  step();
  // realistic render, phase 1 (realism.js): PBR shell, lit posters, area lights, image-based light
  const realism = REAL && !lite ? await setupRealism({ renderer, scene, W, posters: posterSet?.group }) : null;
  step();
  const doors = buildDoors(W.tunnel);
  // the night city and sky round the stadium, for the top views (city.js)
  const city = buildCity({ lite });
  W.stadium.add(city.group);
  const V = (p, l) => [p, l];
  // the changing room was built behind the tunnel's end wall; it now stands off the left wall, its doorway at
  // DOORS.changing (Ahmed: "in the tunnel, not behind me"). CHG maps its own frame onto the tunnel.
  const CH_Z = (DOORS.changing[0] + DOORS.changing[1]) / 2;
  const CHG = ([x, y, z]) => [-(z - TN.ZB) - TN.HW, y, x + CH_Z];
  changing.group.rotation.y = -Math.PI / 2;
  changing.group.position.set(TN.ZB - TN.HW, 0, CH_Z);
  changing.group.updateMatrixWorld(true);
  changing.place(changing.group.matrixWorld);
  // performance: one draw call per material for each room's static furniture (merge.js)
  if (!new URLSearchParams(location.search).has('nomerge')) {
    const keepOf = (R, k) => (R.items || R.cases || []).flatMap((c) => [].concat(c[k] || []));
    const stats = [
      ['store', mergeStatic(store.group)],
      ['gym', mergeStatic(gym.group)],
      ['fame', mergeStatic(fame.group, fame.items.map((c) => c.crestSpin))],
      ['trophies', mergeStatic(museum.group, keepOf(museum, 'spin'))],
      ['changing', mergeStatic(changing.group, keepOf(changing, 'shirt'))],
    ];
    if (new URLSearchParams(location.search).has('perf')) console.info('[merge]', stats.map(([n, s]) => `${n} ${s.before}→${s.after}`).join(' · '));
  }
  const TOURS = {
    trophies: [V([1.2, 1.72, 86.3], [9, 1.75, 86.3]), V([6.3, 1.72, 86.3], [11.5, 1.45, 85]), V([8.6, 1.7, 90.4], [12.5, 1.3, 98]),
      V([13.4, 1.7, 91.6], [21.5, 1.35, 89]), V([16.2, 1.7, 86.2], [21.5, 1.35, 84.5]), V([14.6, 1.7, 80.2], [12.5, 1.25, 72]),
      V([9.4, 1.72, 84.2], [2, 1.8, 87.5]), V([4.6, 1.72, 86.3], [-3, 1.8, 86.3])],
    store: [V([-1.2, 1.72, 69.9], [-9, 1.75, 69.9]), V([-6.6, 1.72, 69.9], [-12.5, 2.1, 69.9]), V([-9.5, 1.72, 75.2], [-12, 2.0, 82]),
      V([-14.8, 1.72, 75.5], [-21.5, 2.0, 72.5]), V([-16.6, 1.72, 66.5], [-21.5, 2.0, 63]), V([-13.4, 1.72, 64.6], [-12, 2.0, 58]),
      V([-7.4, 1.72, 69.9], [0, 1.8, 69.9]), V([-4.4, 1.72, 69.9], [3, 1.8, 69.9])],
    gym: [V([-1.2, 1.72, 52.5], [-9, 1.75, 52.5]), V([-6.0, 1.72, 52.5], [-12, 1.6, 53.7]), V([-10, 1.72, 53.4], [-19, 1.6, 53.7])],
    fantasy: [V([1.2, 1.72, 66.3], [9, 1.6, 66.3]), V([5.6, 1.85, 66.3], [12, 1.0, 66.3]), V([6.4, 1.85, 66.3], [16.5, 1.9, 65.6])],
    fame: [V([1.2, 1.72, 56.0], [9, 1.75, 56.0]), V([6.0, 1.72, 55.4], [12, 1.9, 53.7]), V([10, 1.72, 54.2], [19, 1.9, 53.7])],
    matches: [V([1.4, 1.72, 58.7], [9, 1.7, 58.7]), V([6.1, 1.7, 59.0], [12, 1.72, 59.6])],
    // (in the changing room's own frame, turned onto the left wall by CHG below)
    changing: [V([0, 1.7, 97.2], [0, 1.7, 110]), V([0, 1.66, 103.6], [0, 1.55, 116]), V([-1.4, 1.65, 107.6], [-9, 1.55, 110.5]),
      V([1.4, 1.65, 108.4], [9, 1.55, 105.5]), V([0.4, 1.68, 104.4], [0, 1.8, 97]), V([0, 1.7, 98.4], [0, 1.8, 90])].map(([p, l]) => [CHG(p), CHG(l)]),
  };
  for (const k in TOURS) {
    const t = TOURS[k];
    TOURS[k] = { pos: new THREE.CatmullRomCurve3(t.map((v) => new THREE.Vector3(...v[0])), false, 'centripetal'), look: new THREE.CatmullRomCurve3(t.map((v) => new THREE.Vector3(...v[1])), false, 'centripetal'), n: t.length };
  }
  const HOLD_LOOK = new THREE.Vector3();
  let visit = null;   // { room, phase: toDoor | enter | inside | out, k, lp, lpT, lp0, from, cb }
  const vCur = { p: new THREE.Vector3(), l: new THREE.Vector3() };
  const ease3 = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  // look along a direction swung from one pose's to another's (a turn, not a slide of the look point)
  const qa = new THREE.Quaternion(), d0 = new THREE.Vector3(), d1 = new THREE.Vector3();
  function turn(p0, l0, p1, l1, e, out) {
    d0.subVectors(l0, p0).normalize(); d1.subVectors(l1, p1).normalize();
    if (d0.dot(d1) < -0.999) d0.applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.01);   // turning right round: pick a side
    qa.setFromUnitVectors(d0, d1);
    const q = new THREE.Quaternion().slerp(qa, e);
    out.l.copy(out.p).addScaledVector(d0.clone().applyQuaternion(q), 10);
  }
  function enterRoom(room) {
    if (visit) return;
    const T = TOURS[room];
    visit = { room, T, phase: 'toDoor', k: 0, lp: 0, lpT: 0, lp0: room === 'matches' ? 1 : 1 / (T.n - 1), from: { p: camera.position.clone(), l: vCur.l.clone() } };
    doors.get(room).target = 1;
    onVisit?.({ room, phase: 'in' });
  }
  function leaveRoom(cb) {
    if (!visit || visit.phase === 'out') return;
    Object.assign(visit, { phase: 'out', k: 0, from: { p: vCur.p.clone(), l: vCur.l.clone() }, cb });
  }
  /* inside a room the camera is yours (Ahmed: "change the camera view free, not on scrolling"): drag to
     look round, scroll / W S / arrow keys to walk, A D to step sideways. You stay inside the room's walls. */
  const fly = { keys: new Set(), push: 0, look: null, joy: { x: 0, y: 0 } };   // joy: the phone's left stick (main.js), −1…1, y up = forward
  const ROOMS_BY_NAME = [['trophies', museum], ['store', store], ['changing', changing], ['gym', gym], ['fame', fame], ['fantasy', fantasy]];
  const roomOf = (r) => (r === 'trophies' ? museum : r === 'store' ? store : r === 'changing' ? changing : r === 'gym' ? gym : r === 'fame' ? fame : r === 'fantasy' ? fantasy : null);
  const probe = { position: new THREE.Vector3() };
  function canStand(room, p) {
    const R = roomOf(room); if (!R) return true;
    for (const [dx, dz] of [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) { probe.position.set(p.x + dx, p.y, p.z + dz); if (!R.inside(probe)) return false; }
    // solid things in the room (the trophy pedestals): keep the camera ~0.45 m clear of them
    for (const b of R.blockers || []) if (Math.hypot(p.x - b.x, p.z - b.z) < b.r + 0.45) return false;
    return true;
  }
  const fwdV = new THREE.Vector3(), sideV = new THREE.Vector3(), stepV = new THREE.Vector3(), tryP = new THREE.Vector3();
  function freeLook(v, dt) {
    if (!v.free) {
      // start from where the doorway step left you, looking the same way
      const d = new THREE.Vector3().subVectors(vCur.l, vCur.p).normalize();
      v.free = { p: vCur.p.clone(), yaw: Math.atan2(d.x, d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), vel: 0, side: 0 };
    }
    const f = v.free, K = fly.keys;
    const fwdIn = THREE.MathUtils.clamp((K.has('w') || K.has('arrowup') ? 1 : 0) - (K.has('s') || K.has('arrowdown') ? 1 : 0) + fly.joy.y, -1, 1);
    const sideIn = THREE.MathUtils.clamp((K.has('d') ? 1 : 0) - (K.has('a') ? 1 : 0) + fly.joy.x, -1, 1);
    if (K.has('arrowleft')) f.yaw += dt * 1.6;
    if (K.has('arrowright')) f.yaw -= dt * 1.6;
    f.vel += (fwdIn * 2.6 + fly.push - f.vel) * (1 - Math.exp(-dt * 6)); fly.push *= Math.exp(-dt * 5);
    f.side += (sideIn * 2.2 - f.side) * (1 - Math.exp(-dt * 6));
    fwdV.set(Math.sin(f.yaw), 0, Math.cos(f.yaw)); sideV.set(-fwdV.z, 0, fwdV.x);
    stepV.copy(fwdV).multiplyScalar(f.vel * dt).addScaledVector(sideV, f.side * dt);
    // slide along walls: try the whole step, then each axis on its own
    for (const s2 of [[1, 1], [1, 0], [0, 1]]) { tryP.set(f.p.x + stepV.x * s2[0], f.p.y, f.p.z + stepV.z * s2[1]); if (canStand(v.room, tryP)) { f.p.copy(tryP); break; } }
    // back at the doorway (Ahmed): ask before taking you out to the tunnel; once you've answered, it waits
    // until you've walked away from the door before it can ask again
    const D = ROOM_DOORS.find((d) => d.room === v.room);
    if (D) {
      const dx = Math.abs(f.p.x - D.side * TN.HW), inZ = f.p.z > D.z[0] - 0.9 && f.p.z < D.z[1] + 0.9;
      if (dx < 1.25 && inZ && !f.asked) { f.asked = true; onExitAsk?.(v.room); }
      else if ((dx > 2.1 || !inZ) && f.asked) { f.asked = false; onExitAsk?.(null); }
    }
    vCur.p.copy(f.p);
    vCur.l.set(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch)).multiplyScalar(10).add(f.p);
  }
  // P, Lk: the walk's pose this frame (where you'll come back to); overwritten while in a room
  function visitApply(dt, P, Lk) {
    if (!visit) { vCur.p.copy(P); vCur.l.copy(Lk); return false; }
    const v = visit, T = v.T;
    const at = (lp, oP, oL) => { T.pos.getPoint(clamp01(lp), oP); T.look.getPoint(clamp01(lp), oL); };
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    if (v.phase === 'toDoor') {
      // turn and step up to the doors while they swing open
      v.k = Math.min(1, v.k + dt / 0.7);   // (Ahmed: entering a room took too long — was 1.1 s)
      at(0, a, b);
      const e = ease3(v.k);
      vCur.p.lerpVectors(v.from.p, a, e);
      turn(v.from.p, v.from.l, a, b, e, vCur);
      if (v.k >= 1) { v.phase = 'enter'; v.k = 0; }
    } else if (v.phase === 'enter') {
      v.k = Math.min(1, v.k + dt / 0.9);   // (was 1.5 s)
      v.lp = v.lp0 * ease3(v.k); v.lpT = v.lp;
      at(v.lp, vCur.p, vCur.l);
      if (v.k >= 1) { v.phase = 'inside'; onVisit?.({ room: v.room, phase: 'inside' }); if (v.room !== 'matches') pin.style.touchAction = 'none'; }   // one finger looks round, not scrolls
    } else if (v.phase === 'inside' && v.room === 'matches') {
      v.lp += (clamp01(v.lpT) - v.lp) * (1 - Math.exp(-dt * 4));
      at(v.lp, vCur.p, vCur.l);
      if (v.lpT > 1.06 || v.lpT < v.lp0 - 0.08) leaveRoom();       // scrolled past the end (or back past the start)
    } else if (v.phase === 'inside') {
      freeLook(v, dt);
    } else {
      // back out through the doorway to where the walk left off
      v.k = Math.min(1, v.k + dt / 1.6);
      const e = ease3(v.k), q = 1 - e;
      at(0, a, b);
      vCur.p.set(0, 0, 0).addScaledVector(v.from.p, q * q).addScaledVector(a, 2 * q * e).addScaledVector(P, e * e);
      turn(v.from.p, v.from.l, P, Lk, ease3(Math.min(1, v.k * 1.15)), vCur);
      if (v.k > 0.7) doors.get(v.room).target = 0;
      if (v.k >= 1) { const cb = v.cb; visit = null; pin.style.touchAction = PAN(); onVisit?.({ room: null }); cb?.(); }
    }
    if (visit) { P.copy(vCur.p); Lk.copy(vCur.l); }
    return !!visit;
  }
  // how far into the matches room you are (its cards fly in as you arrive, out as you leave)
  // the nearest door ahead gets its "Discover" button, while you're walking the tunnel
  const dv = new THREE.Vector3();
  let doorShown = null;
  function doorCta(sp) {
    let best = null;
    const c = camera.position;
    if (!visit && holdK(sp) < 0.05 && Math.abs(c.x) < TN.HW && c.z > TN.ZM + 2 && c.z < TN.ZB) {
      for (const d of ROOM_DOORS) {
        const D = doors.get(d.room), dz = c.z - D.centre.z;
        if (dz < -1.2 || dz > 9) continue;   // close enough to read
        dv.copy(D.centre).project(camera);
        // a door just off the side of a narrow (phone) frame keeps its button, pinned to that edge
        if (dv.z > 1 || Math.abs(dv.x) > 2.6 || Math.abs(dv.y) > 0.9) continue;
        const edge = aspect < 1 ? 0.62 : 0.86;
        if (!best || Math.abs(dz) < best.dz) best = { room: d.room, label: d.label, dz: Math.abs(dz), x: (THREE.MathUtils.clamp(dv.x, -edge, edge) + 1) / 2, y: (1 - dv.y) / 2 };
      }
    }
    if (best || doorShown) onDoor?.(best);
    doorShown = best;
  }

  // the seat map at the end of the walk (seats.js): orbit the bowl, zoom into a section, sit in a seat
  const seats = createSeatPicker(W, scene, FOG);
  // penalties while you wait in the virtual queue (penalty.js)
  const game = createPenaltyGame(W.stadium);
  game.onChange((e) => onGame?.(e));
  const lastLk = new THREE.Vector3();
  seats.onChange((st) => onSeat?.({ ...st, hover: null, map: seats.mapOn }));
  let mapOn = false, sway = 1;
  let seatMapOn = false;   // set by main.js while you're booking (tickets → match centre → choose your seats)
  // hover is re-checked every frame, not just on pointer moves: the camera moves under a still mouse
  const seatPtr = { x: 0, y: 0, mouse: false, moved: false, hit: null, key: null, mode: 'off', map: false };
  function seatHover() {
    const hit = seats.hover(seatPtr.x, seatPtr.y, camera, canvas.getBoundingClientRect(), seatPtr.mouse);
    const key = hit?.key || null;
    if (key !== seatPtr.key || (seatPtr.moved && hit) || seats.mode !== seatPtr.mode || seats.mapOn !== seatPtr.map) {
      seatPtr.key = key; seatPtr.hit = hit; seatPtr.moved = false; seatPtr.mode = seats.mode; seatPtr.map = seats.mapOn;
      onSeat?.({ mode: seats.mode, block: seats.block, info: seats.info, hover: hit, x: seatPtr.x, y: seatPtr.y, map: seats.mapOn });
    }
  }

  /* ── lens flares: screen-space ghosts for each floodlight head ── */
  const flareScene = new THREE.Scene();
  const flareCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const glowT = W.glowTex, ringT = TX.ring(), hexT = TX.hexagon(), streakT = TX.streak();
  const FL = [
    { s: 1, size: 0.12, t: glowT, c: [1.6, 1.5, 1.3] },
    { s: 1, size: 0.9, h: 0.012, t: streakT, c: [1.3, 1.2, 0.95] },
    { s: 0.45, size: 0.05, t: hexT, c: [0.35, 0.32, 0.12] },
    { s: -0.15, size: 0.08, t: hexT, c: [0.18, 0.24, 0.2] },
    { s: -0.55, size: 0.035, t: glowT, c: [0.4, 0.34, 0.12] },
    { s: -1.0, size: 0.2, t: ringT, c: [0.12, 0.11, 0.06] },
  ];
  const flares = W.heads.map(() => FL.map((f) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: f.t, color: new THREE.Color(...f.c), transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, opacity: 0 }));
    m.userData = f;
    flareScene.add(m);
    return m;
  }));
  const tmpV = new THREE.Vector3();
  const col = new THREE.Color();
  function updateFlares(amount, aspect) {
    const camIn = camera.position.z > TN.ZM;
    W.heads.forEach(({ p: h, d: dir, glow }, i) => {
      // lamps only flare when their face points at you
      const facing = smooth(0.05, 0.45, tmpV.copy(camera.position).sub(h).normalize().dot(dir));
      glow.material.opacity = facing;
      tmpV.copy(h).project(camera);
      let vis = amount * facing;
      const behind = tmpV.z > 1 || tmpV.z < -1;
      if (behind) vis = 0;
      vis *= 1 - smooth(0.9, 1.25, Math.max(Math.abs(tmpV.x), Math.abs(tmpV.y)));
      if (camIn && vis > 0) {
        // inside the tunnel only what is visible through the mouth can flare
        const d = tmpV.copy(h).sub(camera.position);
        const t = (TN.ZM - camera.position.z) / d.z;
        const x = camera.position.x + d.x * t, y = camera.position.y + d.y * t;
        if (t < 0 || Math.abs(x) > TN.HW || y < 0 || y > TN.HH) vis = 0;
        tmpV.copy(h).project(camera);
      }
      const lx = tmpV.x, ly = tmpV.y;
      flares[i].forEach((m) => {
        const f = m.userData;
        m.visible = vis > 0.002;
        if (!m.visible) return;
        m.position.set(lx * f.s, ly * f.s, 0);
        m.scale.set(f.size / aspect, (f.h || f.size), 1);
        m.material.opacity = vis * (f.s === 1 ? 1 : 0.8 * (1 - 0.5 * Math.hypot(lx, ly)));
      });
    });
  }

  /* ── post ── */
  let composer = null, bloom = null, gtao = null;
  if (realism && !bloomOn) {
    // ambient occlusion over the whole frame (the flare overlay goes on after it)
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 2, 2);
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
    gtao.blendIntensity = 0.9;
    composer.addPass(gtao);
    const fp = new RenderPass(flareScene, flareCam); fp.clear = false; fp.clearDepth = true;
    composer.addPass(fp);
    composer.addPass(new OutputPass());
  }
  if (bloomOn) {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const fp = new RenderPass(flareScene, flareCam);
    fp.clear = false;
    fp.clearDepth = true;
    composer.addPass(fp);
    bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.3, 0.1, 1.1);
    // the bloom's blur is measured in pixels, so on a big, sharp screen the glow shrank to a thin rim and
    // the room looked darker than in the small preview pane. Run it at a fixed height on every screen so
    // the glow covers the same share of the frame everywhere.
    const BLOOM_H = 720, bloomSize = bloom.setSize.bind(bloom);
    bloom.setSize = (bw, bh) => { const k = BLOOM_H / Math.max(1, bh); bloomSize(Math.max(2, Math.round(bw * k)), BLOOM_H); };
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* performance: build every shader the walk will need up front, quietly after load. Entering a room changes
     how many lights are on, which needs new shader variants; compiled on the spot that was a visible hitch. */
  async function warmShaders() {
    if (!renderer.compileAsync) return;
    for (const [, R] of ROOMS_BY_NAME) {
      const was = R.group.visible;
      R.group.visible = true; realism?.showLamps(false);
      const job = renderer.compileAsync(scene, camera);
      R.group.visible = was; realism?.showLamps(true);
      await job.catch(() => {});
      await new Promise((r) => setTimeout(r, 30));
    }
  }
  /* everything rendered before you go in (Ahmed): every room's shaders, the whole scene, and every texture still
     loading — the loader's crest fills as it goes (0.7 → 1), then one frame is drawn so nothing pops in */
  async function prepare(onP = () => {}) {
    const rooms = ROOMS_BY_NAME.length;
    if (renderer.compileAsync) {
      let i = 0;
      for (const [, R] of ROOMS_BY_NAME) {
        const was = R.group.visible;
        R.group.visible = true; realism?.showLamps(false);
        const job = renderer.compileAsync(scene, camera);
        R.group.visible = was; realism?.showLamps(true);
        await job.catch(() => {});
        onP(0.7 + 0.18 * (++i / rooms));
      }
      await renderer.compileAsync(scene, camera).catch(() => {});
    }
    onP(0.9);
    // textures still on their way (the realistic materials load through three's default manager)
    await new Promise((res) => { const t0 = performance.now(); const wait = () => (PENDING.n <= 0 || performance.now() - t0 > 9000 ? res() : setTimeout(wait, 60)); wait(); });
    onP(0.96);
    resize(); frame();
    await new Promise((r) => requestAnimationFrame(() => r()));
    onP(1);
  }

  /* ── state ── */
  let target = 0, prog = 0, w = 1, h = 1, aspect = 1;
  const intro = { on: 0, led: 0, mouth: 0, dolly: 0 };
  const ptr = { x: 0, y: 0, sx: 0, sy: 0 };
  let walk = 0, bobAmt = 0, lastP = 0;
  const P = new THREE.Vector3(), Lk = new THREE.Vector3();
  const clock = { last: performance.now(), elapsedTime: 0, getDelta() { const n = performance.now(); const d = (n - this.last) / 1000; this.last = n; this.elapsedTime += d; return d; } };
  let running = false, raf = 0, disposed = false;

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    aspect = w / h;
    const dpr = Math.min(devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    // portrait screens get a wider lens so the tunnel still reads
    baseFov = aspect < 0.8 ? 74 : aspect < 1.2 ? 64 : 56;
    camera.fov = baseFov * lens.z;
    // portrait: shift the lens so the vanishing point sits in the upper third, clear of the copy
    if (aspect < 0.8) camera.setViewOffset(w, h, 0, h * 0.17, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
    W.dustMat.uniforms.uPx.value = dpr * (h / 900);
  }

  // pinch to zoom in the tunnel and the rooms (Ahmed): a lens zoom on top of the walk; it resets when you change place
  let baseFov = 56;
  const lens = { z: 1, t: 1, ctx: '' };
  const lensOn = () => (visit ? visit.phase === 'inside' && visit.room !== 'matches' : !mapOn && !game.active && !matches.active);
  function lensApply(dt) {
    const ctx = visit ? `room:${visit.room}` : mapOn || game.active || matches.active ? 'other' : 'tunnel';
    if (ctx !== lens.ctx) { lens.ctx = ctx; lens.t = 1; }
    lens.z += (lens.t - lens.z) * (1 - Math.exp(-dt * 8));
    const fov = baseFov * lens.z;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
  const lensZoom = (f) => { lens.t = THREE.MathUtils.clamp(lens.t * f, 0.42, 1.12); };

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    // scroll target eased with a critically-damped feel
    prog += (target - prog) * (1 - Math.exp(-dt * 4.2));
    if (Math.abs(target - prog) < 1e-5) prog = target;
    const sp = prog;            // scroll progress: drives the camera
    const p = walkPre(sp);      // the original walk: drives everything that happens along it

    samplePre(sp, P, Lk);
    // head-bob while walking the tunnel (proportional to how fast you scroll)
    const dp = Math.abs(sp - lastP);
    lastP = sp;
    walk += dp * 220;
    bobAmt += (Math.min(dp * 260, 1) * (1 - smooth(0.58, 0.66, p)) - bobAmt) * (1 - Math.exp(-dt * 6));
    P.y += Math.abs(Math.sin(walk)) * 0.05 * bobAmt;
    P.x += Math.sin(walk * 0.5) * 0.03 * bobAmt;
    P.z += intro.dolly;
    { const k = holdK(sp); if (k > 0) { P.x += (0 - P.x) * k; Lk.lerp(HOLD_LOOK.set(0, 1.72, MATCH_HOLD_Z - 20), k); } }   // face the cards
    const inRoom = visitApply(dt, P, Lk);   // a side room you opened takes the camera
    // the seat map opens once you've arrived at the end of the walk; it takes the camera while in use
    mapOn = seatMapOn && sp > 0.985 && tifo.inBowl && !matches.active && !inRoom && !game.active;   // the seat map is the booking journey's, not the tour's
    const seated = seats.apply(dt, P, Lk, sp, mapOn);
    if (!game.active && game.phase !== 'flight') lastLk.copy(Lk);
    const playing = game.apply(dt, P, Lk);   // taking penalties: the game has the camera
    if (playing) mapOn = false;
    game.update(dt, t);
    lensApply(dt);
    camera.position.copy(P);
    if (DBG_CAM) { P.set(DBG_CAM[0], DBG_CAM[1], DBG_CAM[2]); Lk.set(DBG_CAM[3], DBG_CAM[4], DBG_CAM[5]); camera.position.copy(P); }
    // tight near plane only while brushing past things in the tunnel; deep range for the bowl
    const near = P.z > 38 && P.y < 7 ? 0.05 : 0.6;
    if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
    camera.lookAt(Lk);
    // pointer look-around, damped
    ptr.sx += (ptr.x - ptr.sx) * (1 - Math.exp(-dt * 3));
    ptr.sy += (ptr.y - ptr.sy) * (1 - Math.exp(-dt * 3));
    sway += ((seated ? 0 : 1) - sway) * (1 - Math.exp(-dt * 2));
    camera.rotateY(-ptr.sx * 0.09 * sway);
    camera.rotateX(-ptr.sy * 0.055 * sway);
    // free look in the tunnel (Ahmed): drag to look round while scroll still walks you; walking on brings
    // the view gently back to straight ahead. Rooms, the seat map, the game and the match row keep the camera.
    const freeOK = !inRoom && !seated && !playing && !matches.active;
    if (!freeOK) { tlook.tYaw = 0; tlook.tPitch = 0; }
    else if (!tlook.on && !fly.joy.x && !fly.joy.y && Math.abs(sp - tlook.sp) > 0.0004) { tlook.tYaw *= Math.exp(-dt * 1.2); tlook.tPitch *= Math.exp(-dt * 1.2); }   // (not while steering with the stick)
    tlook.sp = sp;
    tlook.yaw += (tlook.tYaw - tlook.yaw) * (1 - Math.exp(-dt * 8));
    tlook.pitch += (tlook.tPitch - tlook.pitch) * (1 - Math.exp(-dt * 8));
    camera.rotateY(tlook.yaw); camera.rotateX(tlook.pitch);
    camera.rotateZ(Math.sin(walk * 0.5) * 0.004 * bobAmt);
    camera.updateMatrixWorld();
    seatHover();

    const cz = camera.position.z;
    // eye adaptation: the doorway is blown out from deep inside, resolves as you near it
    const glare = 0.05 + 0.55 * smooth(56, 88, cz);
    W.glare.material.opacity = glare * intro.mouth * (1 - 0.85 * holdK(sp));   // dimmed behind the match cards so the glass reads
    W.glare.visible = GLOW && cz > TN.ZM - 0.2;
    const exitFlash = Math.exp(-Math.pow((cz - 45.5) / 3.2, 2));
    // Ahmed (2026-10-11): the lights read too strong everywhere, so the whole walk sits ~20% darker
    renderer.toneMappingExposure = 0.8 + 0.42 * smooth(44, 50, cz) + (GLOW ? exitFlash * 0.5 : 0);
    if (bloom) bloom.strength = 0.18 + exitFlash * 0.35 + smooth(0.62, 0.8, p) * 0.08;
    W.shafts.forEach((s) => { s.material.opacity = GLOW ? s.userData.base * intro.mouth * (0.4 + 0.6 * smooth(46, 70, cz)) * smooth(0.2, 2.5, cz - s.position.z) : 0; });
    // tunnel shading uniforms
    for (const m of W.mats) { m.uniforms.uTime.value = t; m.uniforms.uCam.value.copy(camera.position); }
    realism?.update(intro, t, cz, !!visit && visit.phase !== 'toDoor');
    if (gtao) gtao.enabled = cz > TN.ZM - 4 && camera.position.y < 8;   // AO in the tunnel and rooms; the open bowl doesn't need it
    for (const m of W.tMats) { m.uniforms.uOn.value = intro.on; m.uniforms.uLed.value = intro.led; m.uniforms.uMouth.value = intro.mouth; }
    W.dustMat.uniforms.uTime.value = t;
    W.dustMat.uniforms.uAmt.value = intro.mouth * smooth(42, 47, cz);
    // flicker ceiling bars in sync with the shader
    for (let i = 0; i < TN.NL; i++) {
      const raw = clamp01(intro.on - (TN.NL - 1 - i));
      const fl = raw >= 1 ? 1 : raw * (hash(Math.floor(t * 16) + i * 7.13) > 0.4 ? 1 : 0);
      col.setRGB(1.0 * fl, 0.96 * fl, 0.88 * fl);   // white, but under the bloom threshold: no glow (Ahmed)
      W.bars.setColorAt(i, col);
    }
    W.bars.instanceColor.needsUpdate = true;
    if (NEON) {
      W.ledMat.color.setRGB(2.0 * intro.led, 1.65 * intro.led, 0.03 * intro.led);
      W.frameMat.color.setRGB(3.2 * intro.mouth, 2.7 * intro.mouth, 0.06 * intro.mouth);
    }
    // LED ribbons crawl
    W.ribbon.offset.x = -t * 0.012;
    W.boards.forEach((b, i) => { b.offset.x = (i % 2 ? 1 : -1) * t * 0.05; });
    // the changing room sits behind the bowl's outer wall; the stadium can't be seen from in there
    // (the mouth's glare fills the far end of the tunnel), so drop it rather than clip through
    W.stadium.visible = !(camera.position.z > TN.ZB - 0.5 && camera.position.y < 6);
    // inside a room the stadium can't be seen — and its outer wall runs through the changing room's corner
    if (changing.inside(camera) || museum.inside(camera) || store.inside(camera) || gym.inside(camera) || fame.inside(camera) || fantasy.inside(camera)) W.stadium.visible = false;
    // the gym and the hall of fame sit under the lower tier: hide the bowl the moment their doors open
    if (visit && (visit.room === 'gym' || visit.room === 'fame' || visit.room === 'fantasy')) W.stadium.visible = false;
    // while the walk holds at the match cards, the floodlit bowl beyond the mouth (far brighter than white)
    // would shine straight through their glass, so it's left out until you walk on
    if (GLOW && holdK(sp) > 0.5 && !seats.mapOn) W.stadium.visible = false;   // (without bloom the bowl is a fine backdrop)
    // the tunnel is only drawn when you can see into it
    W.tunnel.visible = cz > 20 || camera.position.y < 14;
    if (!GLOW) crests.group.traverse((o) => { if (o.material?.uniforms?.uSweep) o.material.uniforms.uSweep.value = -1; });   // no light sweep
    tifo.update(p, camera);
    crests.update(t, p, still);
    if (seats.mapOn && (seats.seatsMode || seats.mode !== 'off')) tifo.mesh.visible = false;   // choosing seats: the stands show their seats, not the tifo
    for (const m of W.tifoTiers) m.uniforms.uTifo.value.z = tifo.mesh.visible ? 1 : 0;
    const fm = museum.update(t, camera, { on: intro.mouth });
    const fs = store.update(t, camera, { on: intro.mouth });
    gym.update(t, camera);
    const ff = fame.update(t, camera);
    const fy = fantasy.update(t, camera);
    const fc = changing.update(t, camera, { on: intro.mouth });
    const fx = matches.update(t, camera, { on: intro.mouth, s: 0.578 + 0.062 * holdK(sp) });   // the cards are out while the walk holds before the mouth
    doors.update(dt, clamp01(intro.on / TN.NL));
    city.update(t, camera, renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)));
    doorCta(sp);
    /* performance: a side room is drawn only while you're in it or its doors are open for you — behind closed
       doors it cost ~1,500 draw calls a frame (its lights go with it, since hidden groups' lights are skipped) */
    for (const [name, R] of ROOMS_BY_NAME) R.group.visible = R.group.visible && ((visit && visit.room === name) || R.inside(camera));
    const room = museum.inside(camera) ? 'trophies' : store.inside(camera) ? 'store' : changing.inside(camera) ? 'changing' : gym.inside(camera) ? 'gym' : fame.inside(camera) ? 'fame' : fantasy.inside(camera) ? 'fantasy' : null;
    const focus = room === 'trophies' ? fm : room === 'store' ? fs : room === 'changing' ? fc : room === 'fame' ? ff : room === 'fantasy' ? fy : room === 'matches' ? fx : -1;
    if (room !== roomState.room || focus !== roomState.focus) {
      roomState = { room, focus };
      const item = focus < 0 ? null : room === 'trophies' ? museum.cases[focus].data : room === 'store' ? store.items[focus].data : room === 'fame' ? fame.items[focus].data : room === 'fantasy' ? fantasy.items[focus].data : room === 'matches' ? matches.items[focus].data : changing.items[focus].data;
      onRoom?.({ room, inside: !!room, focus, item });
    }
    // flares once the stadium is in view
    // the roof lamps are many and close: keep their flares soft so they don't wash over the stands
    updateFlares(GLOW ? smooth(0.5, 0.75, p) * (lite ? 0.25 : 0.35) : 0, aspect);

    if (composer) composer.render();
    else {
      renderer.autoClear = false;
      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(flareScene, flareCam);
    }
    onProgress?.(p);
  }

  function hash(n) { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); }

  function loop() {
    if (!running || disposed) return;
    frame();
    raf = requestAnimationFrame(loop);
  }

  resize();
  addEventListener('resize', resize);
  // pointers: the matches room's card row, and the seat map (drag orbits / looks, right- or shift-drag
  // pans, two fingers pinch to zoom). pan-y keeps vertical swipes scrolling the page on touch screens.
  const pin = canvas.parentElement;
  // phones with the joystick: one finger only looks; with classic swipe controls (settings, main.js) a swipe walks
  const PAN = () => pin.dataset.pan || 'pan-y';
  pin.style.touchAction = PAN();
  const pts = new Map();
  let pinch = 0;
  const roomDrag = { on: false, x: 0, y: 0, sx: 0, sy: 0, t: 0 };
  /* room objects you can click (Ahmed, 2026-10-21: "interact with the objects, not only view them"): any mesh in a
     room — or an ancestor of it — with userData.click = '<id>' is clickable. A short tap/click (no drag) inside a room
     raycasts them and reports onRoomClick({ room, id, object, point }); hovering sets a pointer cursor and reports
     onRoomHover({ room, id | null }). The rooms' own UI modules (room-ui.js) decide what each id does. */
  const rc = new THREE.Raycaster(), rcV = new THREE.Vector2();
  function roomHit(x, y) {
    if (visit?.phase !== 'inside') return null;
    const R = roomOf(visit.room); if (!R) return null;
    const rect = canvas.getBoundingClientRect();
    rcV.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    rc.setFromCamera(rcV, camera);
    const targets = [];
    R.group.traverseVisible((o) => { if (o.userData.click && (o.isMesh || o.isGroup || o.isObject3D)) targets.push(o); });
    if (!targets.length) return null;
    for (const h of rc.intersectObjects(targets, true)) {
      let o = h.object; while (o && !o.userData.click) o = o.parent;
      if (o) return { room: visit.room, id: o.userData.click, object: o, point: h.point.clone(), distance: h.distance };
    }
    return null;
  }
  let hoverId = null, hoverT = 0;
  const tlook = { on: false, x: 0, y: 0, yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, sp: 0 };   // tunnel free look
  const onPtr = (e) => {
    ptr.x = (e.clientX / innerWidth) * 2 - 1;
    ptr.y = (e.clientY / innerHeight) * 2 - 1;
    const rect = canvas.getBoundingClientRect();
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (seats.mapOn) seats.zoom(pinch / Math.max(1, d)); else lensZoom(pinch / Math.max(1, d));
      pinch = d;
      return;
    }
    if (roomDrag.on && visit?.phase === 'inside' && visit.free) {
      const f = visit.free;
      f.yaw += (e.clientX - roomDrag.x) * 0.0042; f.pitch = THREE.MathUtils.clamp(f.pitch + (e.clientY - roomDrag.y) * 0.0032, -0.9, 0.9);
      roomDrag.x = e.clientX; roomDrag.y = e.clientY;
    }
    if (tlook.on) { tlook.tYaw = THREE.MathUtils.clamp(tlook.tYaw + (e.clientX - tlook.x) * 0.0042, -2.8, 2.8); tlook.tPitch = THREE.MathUtils.clamp(tlook.tPitch + (e.clientY - tlook.y) * 0.0032, -0.7, 0.6); tlook.x = e.clientX; tlook.y = e.clientY; }
    game.move(e.clientX, e.clientY);
    if (visit?.phase === 'inside' && !roomDrag.on && e.pointerType === 'mouse' && performance.now() - hoverT > 80) {
      hoverT = performance.now();
      const id = roomHit(e.clientX, e.clientY)?.id || null;
      if (id !== hoverId) { hoverId = id; canvas.style.cursor = id ? 'pointer' : ''; onRoomHover?.({ room: visit.room, id }); }
    }
    matches.dragMove(e.clientX);
    seats.dragMove(e.clientX, e.clientY);
    seatPtr.x = e.clientX; seatPtr.y = e.clientY; seatPtr.mouse = e.pointerType === 'mouse'; seatPtr.moved = true;
    canvas.style.cursor = matches.hover(e.clientX, e.clientY, camera, rect) || seatPtr.hit ? 'pointer' : matches.active ? 'grab' : seats.dragging ? 'grabbing' : seats.mapOn ? 'grab' : hoverId && visit ? 'pointer' : '';
  };
  addEventListener('pointermove', onPtr, { passive: true });
  const onDown = (e) => {
    if (!pin.contains(e.target) || e.target.closest?.('a, button, .js-joy')) return;   // the joystick's finger isn't half a pinch
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (game.down(e.clientX, e.clientY)) { e.preventDefault(); return; }
    if (pts.size === 2 && (seats.mapOn || lensOn())) { seats.dragEnd(); roomDrag.on = false; tlook.on = false; const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); e.preventDefault(); return; }
    if (visit?.phase === 'inside' && visit.room !== 'matches') { roomDrag.on = true; roomDrag.x = roomDrag.sx = e.clientX; roomDrag.y = roomDrag.sy = e.clientY; roomDrag.t = performance.now(); canvas.style.cursor = 'grabbing'; e.preventDefault(); return; }
    if (e.button === 0 && matches.dragStart(e.clientX)) { e.preventDefault(); return; }   // no text selection while dragging
    if ((e.button === 0 || e.button === 2) && seats.dragStart(e.clientX, e.clientY, e.button === 2 || e.shiftKey)) { e.preventDefault(); return; }
    if (e.button === 0 && !visit && !seats.mapOn && !game.active && !matches.active) { tlook.on = true; tlook.x = e.clientX; tlook.y = e.clientY; canvas.style.cursor = 'grabbing'; }
  };
  const onUp = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = 0;
    const r = canvas.getBoundingClientRect();
    game.up(r.width, r.height);
    matches.dragEnd();
    seats.dragEnd();
    // a tap, not a drag: maybe a room object
    if (roomDrag.on && Math.hypot(e.clientX - roomDrag.sx, e.clientY - roomDrag.sy) < 9 && performance.now() - roomDrag.t < 500) {
      const hit = roomHit(e.clientX, e.clientY);
      if (hit) onRoomClick?.(hit);
    }
    if (roomDrag.on) canvas.style.cursor = hoverId ? 'pointer' : '';
    roomDrag.on = false;
    if (tlook.on) { tlook.on = false; canvas.style.cursor = ''; }
  };
  const onKey = (e) => {
    if (visit?.phase === 'inside') {
      if (e.key === 'Escape') leaveRoom();
      if (visit.room === 'matches') {
        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { visit.lpT += 0.1; e.preventDefault(); }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') { visit.lpT -= 0.1; e.preventDefault(); }
      } else if (/^(w|a|s|d|arrowup|arrowdown|arrowleft|arrowright)$/.test(e.key.toLowerCase())) { fly.keys.add(e.key.toLowerCase()); e.preventDefault(); }
      return;
    }
    if (e.key === 'Escape') seats.back();
  };
  const onMenu = (e) => { if (seats.mapOn) e.preventDefault(); };            // right-drag pans the map
  // touchpad (Ahmed): a two-finger swipe sideways turns the view, up/down still walks; with Shift held, up/down
  // looks up and down instead. The sideways part of a mouse wheel is ignored by the page scroll, so it's free.
  const TURN = 0.003, TILT = 0.0028;
  const onWheel = (e) => {
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.6 && Math.abs(e.deltaX) > 0.5;
    const tilt = e.shiftKey && !e.ctrlKey && Math.abs(e.deltaY) > Math.abs(e.deltaX);
    if (e.ctrlKey && !seats.mapOn && lensOn()) { e.preventDefault(); e.stopPropagation(); lensZoom(Math.exp(e.deltaY * 0.01)); return; }   // trackpad pinch
    if (visit) {   // the page is held while you're in a room
      if (visit.phase === 'inside') {
        if (visit.room === 'matches') visit.lpT += e.deltaY * 0.0004;
        else if (visit.free && (sideways || tilt)) {
          if (sideways) visit.free.yaw -= e.deltaX * TURN;
          else visit.free.pitch = THREE.MathUtils.clamp(visit.free.pitch - e.deltaY * TILT, -0.9, 0.9);
        } else fly.push = THREE.MathUtils.clamp(fly.push + e.deltaY * 0.02, -4, 4);
      }
      return;
    }
    if (!seats.mapOn && !game.active && !matches.active && (sideways || tilt)) {
      e.preventDefault(); e.stopPropagation();   // the turn shouldn't also walk (smooth scroll listens on window)
      if (sideways) tlook.tYaw = THREE.MathUtils.clamp(tlook.tYaw - e.deltaX * TURN, -2.8, 2.8);
      else tlook.tPitch = THREE.MathUtils.clamp(tlook.tPitch - e.deltaY * TILT, -0.7, 0.6);
      return;
    }
    if (seats.mapOn && e.ctrlKey) { e.preventDefault(); seats.zoom(Math.exp(e.deltaY * 0.01)); }   // trackpad pinch
  };
  addEventListener('keydown', onKey);
  addEventListener('keyup', (e) => fly.keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => fly.keys.clear());
  addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  pin.addEventListener('contextmenu', onMenu);
  pin.addEventListener('wheel', onWheel, { passive: false });

  // no glow: hide every additive glow layer (halos, cones, shafts, sprites; the city's own lights stay), and
  // bring anything drawn brighter than white down to white so nothing blooms or reads as lit-up
  if (!GLOW) {
    scene.traverse((o) => {
      if (city.group === o || o.parent === city.group) return;
      const m = o.material;
      if (!m || Array.isArray(m)) return;
      if (m.blending === THREE.AdditiveBlending) { o.visible = false; return; }
      if (m.color && (m.isMeshBasicMaterial || m.isSpriteMaterial || m.isLineBasicMaterial)) { const k = Math.max(m.color.r, m.color.g, m.color.b); if (k > 1) m.color.multiplyScalar(1 / k); }
    });
  }
  // ?neon=0: the walk without its neon. LED strips go (yellow, brighter-than-white basic materials with no
  // texture); lit signs (textured, brighter than white) become plain printed signs.
  if (!NEON) {
    scene.traverse((o) => {
      const m = o.material;
      if (o.isLineSegments && m?.color && m.color.r > 0.95 && m.color.b < m.color.r * 0.6) { o.visible = false; return; }   // glowing yellow edges
      if (!o.isMesh || !m || !m.isMeshBasicMaterial) return;
      const c = m.color;
      if (!m.map && c.r > 0.95 && c.b < c.r * 0.6) o.visible = false;   // LED strips and the yellow door frames
      else if (m.map && c.r > 1.3) c.setScalar(0.6);
    });
    W.ledMat.color.setScalar(0); W.frameMat.color.setScalar(0);
  }

  return {
    camera,
    renderer, scene, // debug: profiling
    get progress() { return prog; },
    tifo,
    museum,
    store,
    world: W, // debug
    crests,
    changing,
    matches,
    // clicks in the hero: the matches room first, then the stand (a seat; it used to flip the tifo, which
    // now only changes on its own). The click that ends a look-around drag does nothing.
    tifoClick(x, y) {
      const rect = canvas.getBoundingClientRect();
      return matches.click(x, y, camera, rect) || seats.click(x, y, camera, rect, prog);
    },
    seats,
    seatBack() { seats.back(); },
    seatZoom(f) { seats.zoom(f); },
    prepare,
    gameStart(mode = 'penalties', opts) { game.start(camera.position.clone(), lastLk.clone(), mode, opts); },
    gameStop() { game.stop(); },
    get gameActive() { return game.active; },
    enterRoom,
    // the phone joystick: in a room it walks and strafes; in the tunnel its sideways part turns you (the walk
    // itself is the page scroll, driven from main.js)
    setJoystick(x, y) { fly.joy.x = x; fly.joy.y = y; },
    turn(dyaw) { if (!visit) tlook.tYaw = THREE.MathUtils.clamp(tlook.tYaw + dyaw, -2.8, 2.8); },
    get canWalk() { return !visit && !seats.mapOn && !game.active && !matches.active; },
    leaveRoom,
    get visit() { return visit && { room: visit.room, phase: visit.phase }; },
    doors, // debug
    seatReset() { seats.resetView(); },
    seatPaint(fn) { seats.paint(fn); },
    setMatch(m) { crests.setMatch(m); this.setLook(lookFor(m)); },
    // day / dusk / night from the match's kick-off (?tod=day|dusk|night overrides, for previews)
    setLook(name) {
      const forced = new URLSearchParams(location.search).get('tod');
      const look = setTimeOfDay(forced || name, FOG.color, fogU);
      scene.fog.color.copy(FOG.color); scene.fog.density = fogU.uFogD.value;
      // the outside: petals lit from within and the base lattice glowing gold after dark; sunlit by day
      const R = W.roofLook, dayK = look === 'day' ? 1 : look === 'dusk' ? 0.35 : 0;
      if (R?.petalM) R.petalM.uniforms.uGlow.value = R.petalM.userData.nightGlow * (1 - dayK) + 0.1 * dayK;
      if (R?.petalM) R.petalM.uniforms.uTop.value.setRGB(0.93, 0.89, 0.8).multiplyScalar(1 + 0.6 * dayK);
      if (R?.baseM) R.baseM.color.setRGB(...(look === 'day' ? [0.62, 0.62, 0.64] : look === 'dusk' ? [1.0, 0.68, 0.3] : [1.0, 0.72, 0.32]));
      renderer.setClearColor(FOG.color);
      return look;
    },
    seatSelect() { seats.selectView(); },
    seatPreset(name) { seats.preset(name, prog); },
    seatFind(code, b, r, n) { return seats.findSeat(code, b, r, n, prog); },
    seatMode(v) { seats.setSeatsMode(v); },
    seatLayout() { return seats.layout(); },
    // the walk progress that puts you at tunnel depth z (the start menu's fast travel to a room's door)
    progressForZ(z) { const a = new THREE.Vector3(), b = new THREE.Vector3(); let lo = 0, hi = HOLD[0]; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; samplePre(m, a, b); if (a.z > z) lo = m; else hi = m; } return (lo + hi) / 2; },
    enterRoomNow(room) { enterRoom(room); },
    seatMapEnabled(v) { seatMapOn = !!v; },
    get seatMapOn() { return seatMapOn; },
    // the room UIs (room-ui.js) reach their room's module and the camera through these
    roomModule: (r) => roomOf(r),
    get camera() { return camera; },
    get roomName() { return visit?.phase === 'inside' ? visit.room : null; },
    // where to stand to be at a room's door (just short of it, walking in)
    doorZ(room) { const D = ROOM_DOORS.find((d) => d.room === room); return D ? (D.z[0] + D.z[1]) / 2 + 1.1 : null; },
    setProgress(v, snap = false) { target = clamp01(v); if (snap) { prog = target; lastP = target; } },
    intro, // tween these (on 0..NL, led/mouth 0..1, dolly metres)
    lights(full = true) { intro.on = full ? TN.NL : 0; intro.led = intro.mouth = full ? 1 : 0; },
    NL: TN.NL,
    start() { if (running || disposed) return; running = true; clock.getDelta(); raf = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(raf); },
    renderOnce() { frame(); },
    resize,
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onPtr);
      removeEventListener('pointerdown', onDown);
      pin.removeEventListener('contextmenu', onMenu);
      pin.removeEventListener('wheel', onWheel);
      removeEventListener('keydown', onKey);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      tifo.dispose();
      renderer.dispose();
    },
  };
}
