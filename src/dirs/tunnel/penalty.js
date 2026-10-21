// Penalties while you wait (Ahmed, 2026-10-12): the virtual queue for the first match lets you into the
// stadium, and while you wait for your turn you can take penalties on the real pitch. Drag from the ball
// toward the goal to shoot — direction aims, length sets the power (and height), a curved drag bends it.
// The keeper is the club mascot, the tiger (Ahmed's reference image), hand-built here in a cartoon style
// with outlines: he reads your shot after a beat and dives — corners, especially high ones, beat him.
// Rounds of five; a goal scores 1, 2 for a side, 3 for a corner.
//
// Three more modes on the same pitch (2026-10-21), picked with start(fromP, fromL, mode):
//   'freekick' — ~22 m out, off-centre (moves every attempt), a four-man wall 9.15 m away that jumps when you
//                strike; the ball flies a real arc (gravity + the bend you draw), the wall blocks, the tiger keeps.
//                1 a goal, 2 over the wall or into a side, 3 top corner.
//   'crossbar' — 18 m out, central, no keeper: 3 for hitting the bar (it bounces off), 1 for a post, 0 otherwise.
//   'keeper'   — you're in goal: the tiger runs up from the spot and shoots (his lean is the tell); swipe, tap a
//                spot or use the arrow keys to dive. 1 a save, 2 a top-corner save.
//   'shootout' — the SPL Cup's penalty shoot-out (2026-10-21, cup.js): alternating kicks, home first. On your
//                team's kick you shoot (as in penalties); on theirs you keep (as in keeper mode). Five each, then
//                sudden death. start(fromP, fromL, 'shootout', opts) with
//                  opts = { home, away, you: 'home'|'away', onEvent?, onEnd? }
//                  home/away = { code, name, logo, kickers: [name|player…], keeper: name|player }
//                Its events also carry `shootout` (see soSnap) and kicker/keeper names; when it's decided the game
//                emits { type: 'end', homePens, awayPens, winner } and calls opts.onEnd with the same object.
//                Stopping it early simulates the kicks that are left ({ …, abandoned: true }).
// Every event carries { mode, attempts, maxTotal, round, best, msg? } so the HUD can stay mode-agnostic.
import * as THREE from 'three';
import { progress } from './progress.js';
import { feel } from './feel.js';

const GOAL_X = 52.5, POST_Z = 3.66, BAR_Y = 2.44, SPOT_X = GOAL_X - 11;
const KEEPER_X = GOAL_X - 0.45;
const CAM = { p: new THREE.Vector3(SPOT_X - 5.2, 1.75, 0), l: new THREE.Vector3(GOAL_X, 1.05, 0) };
const G = 9.8, BALL_R = 0.11;
// the real frame (goal.js): 6 cm round posts and bar, centres at z = ±(3.66 + 0.06), bar centre 2.44 m up on a 3 cm base
const FRAME_R = 0.06, POST_C = POST_Z + FRAME_R, BAR_C = BAR_Y + 0.03;
const MODES = { penalties: { attempts: 5, max: 15 }, freekick: { attempts: 5, max: 15 }, crossbar: { attempts: 5, max: 15 }, keeper: { attempts: 5, max: 10 }, shootout: { attempts: 5, max: 5 } };
// a shoot-out is over when one side can't catch up within five, or after a sudden-death pair (kicks: 1|0)
const sum = (a) => a.reduce((x, y) => x + y, 0);
function soDecided(h, a) {
  const hs = sum(h), as = sum(a);
  if (h.length <= 5 && a.length <= 5) { if (hs > as + (5 - a.length)) return 'home'; if (as > hs + (5 - h.length)) return 'away'; }
  if (h.length >= 5 && h.length === a.length && hs !== as) return hs > as ? 'home' : 'away';
  return null;
}
const nameOf = (x) => (typeof x === 'string' ? x : x ? x.name || [x.first, x.last].filter(Boolean).join(' ') : '');
const XP = [0, 10, 15, 25];
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/* ── cartoon shading (fixed key light, banded) + inverted-hull outlines ── */
function toon(color, map = null) {
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(color) }, uMap: { value: map }, uUseMap: { value: map ? 1 : 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec2 vUv; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform vec3 uCol; uniform sampler2D uMap; uniform float uUseMap; varying vec3 vN; varying vec2 vUv; varying vec3 vW;
      void main(){
        vec3 base = uUseMap > 0.5 ? texture2D(uMap, vUv).rgb : uCol;
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        float d = dot(n, normalize(vec3(-0.35, 0.85, 0.4)));
        float band = d > 0.45 ? 1.0 : d > 0.0 ? 0.78 : 0.55;           // cel bands, like the illustration
        float rim = smoothstep(0.62, 0.95, 1.0 - max(dot(n, v), 0.0)) * 0.18;
        gl_FragColor = vec4(base * band + rim, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x140c06, side: THREE.BackSide });
function part(group, geo, mat, outline = 1) {
  const m = new THREE.Mesh(geo, mat);
  group.add(m);
  if (outline) {
    geo.computeBoundingSphere();
    const o = new THREE.Mesh(geo, OUTLINE); o.scale.setScalar(1 + (0.016 * outline) / Math.max(0.03, geo.boundingSphere.radius)); m.add(o);
  }
  return m;
}
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

/* ── the mascot: a muscular cartoon tiger in the yellow-and-black striped #18 kit ── */
export function buildMascot() {
  const root = new THREE.Group();          // at the feet, facing −x (out toward the penalty spot)
  const body = new THREE.Group(); root.add(body);
  const FUR = 0xf08a1c, WHITE = 0xfff4e6, BLACK = 0x161616, YEL = 0xf2c418;
  const furTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#f08a1c'; x.fillRect(0, 0, w, h); x.fillStyle = '#5a2a0c'; for (let i = 0; i < 7; i++) { const y = 20 + i * 34; x.beginPath(); x.moveTo(0, y); x.quadraticCurveTo(w * 0.3, y + 12, w * 0.45, y + 2); x.lineTo(w * 0.42, y + 10); x.quadraticCurveTo(w * 0.25, y + 18, 0, y + 12); x.fill(); x.beginPath(); x.moveTo(w, y + 14); x.quadraticCurveTo(w * 0.7, y + 26, w * 0.55, y + 16); x.lineTo(w * 0.58, y + 24); x.quadraticCurveTo(w * 0.78, y + 32, w, y + 26); x.fill(); } });
  const kitTex = canvasTex(512, 256, (x, w, h) => {
    const sw = w / 12; for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#161616' : '#f2c418'; x.fillRect(i * sw, 0, sw + 1, h); }
    x.fillStyle = '#161616'; x.fillRect(0, 0, w, 16);                                  // collar line
    x.fillStyle = '#ffffff'; x.font = '400 92px Anton'; x.textAlign = 'center';
    x.lineWidth = 8; x.strokeStyle = '#161616'; x.strokeText('18', w * 0.5, h * 0.62); x.fillText('18', w * 0.5, h * 0.62);   // the number, on the back
    x.fillStyle = '#f2c418'; x.strokeText('18', w * 0.2, h * 0.38); x.fillText('18', w * 0.2, h * 0.38);                     // small on the chest
  });
  const fur = toon(FUR, furTex), white = toon(WHITE), black = toon(BLACK), yellow = toon(YEL), kit = toon(YEL, kitTex);
  const pink = toon(0xd86a6a), blue = toon(0x4aa8e8), red = toon(0x8a1d1d);

  // legs: black shorts, striped socks, black boots with white — each on a hip pivot, so the striker can run and kick
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, 0.95, s * 0.2); body.add(hip);
    const thigh = part(hip, new THREE.CapsuleGeometry(0.15, 0.32, 4, 10), black); thigh.position.set(0.02, -0.17, 0); thigh.rotation.z = 0.15;
    const shin = part(hip, new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), yellow); shin.position.set(-0.04, -0.59, s * 0.02);
    const boot = part(hip, new THREE.BoxGeometry(0.34, 0.14, 0.17), black); boot.position.set(-0.1, -0.87, s * 0.02);
    const sole = part(hip, new THREE.BoxGeometry(0.36, 0.04, 0.18), white, 0); sole.position.set(-0.1, -0.94, s * 0.02);
    legs.push({ hip, s });
  }
  // torso: a broad chest in the striped kit
  const torso = part(body, new THREE.SphereGeometry(0.42, 24, 18), kit); torso.scale.set(0.9, 1.05, 1.28); torso.position.set(0, 1.32, 0); torso.rotation.y = Math.PI / 2;
  const waist = part(body, new THREE.CylinderGeometry(0.3, 0.33, 0.24, 18), black); waist.position.set(0, 0.98, 0);
  // shoulders + arms (each on a shoulder pivot so the dive can swing them up), keeper gloves
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0, 1.62, s * 0.5); body.add(sh);
    const sleeve = part(sh, new THREE.SphereGeometry(0.24, 16, 12), kit); sleeve.scale.set(1, 1, 1.05);   // short sleeve over a big shoulder
    const up = part(sh, new THREE.SphereGeometry(0.2, 16, 12), fur); up.scale.set(1, 1.5, 1); up.position.set(0, -0.34, s * 0.06);      // biceps
    const fore = part(sh, new THREE.SphereGeometry(0.22, 16, 12), fur); fore.scale.set(1, 1.55, 1); fore.position.set(-0.04, -0.78, s * 0.1); // the cartoon's huge forearms
    const glove = part(sh, new THREE.SphereGeometry(0.17, 14, 10), white); glove.scale.set(1, 1.2, 0.8); glove.position.set(-0.06, -1.1, s * 0.12);
    sh.rotation.x = -s * 0.42;                                                              // arms held out: ready
    arms.push({ sh, s });
  }
  // head: orange with a white muzzle and cheek tufts, ears, blue eyes, pink nose, open mouth, the mohawk
  const head = new THREE.Group(); head.position.set(-0.02, 2.08, 0); head.scale.setScalar(1.38); body.add(head);
  const skull = part(head, new THREE.SphereGeometry(0.3, 24, 18), fur); skull.scale.set(1, 0.95, 1.05);
  const muzzle = part(head, new THREE.SphereGeometry(0.2, 18, 14), white); muzzle.scale.set(0.8, 0.7, 1.1); muzzle.position.set(-0.22, -0.1, 0);
  for (const s of [-1, 1]) {
    const cheek = part(head, new THREE.ConeGeometry(0.12, 0.28, 8), white); cheek.position.set(-0.08, -0.12, s * 0.3); cheek.rotation.x = s * -1.9;
    const ear = part(head, new THREE.ConeGeometry(0.1, 0.16, 10), fur); ear.position.set(0.02, 0.25, s * 0.2); ear.rotation.x = s * 0.4;
    const inner = part(head, new THREE.ConeGeometry(0.06, 0.1, 8), pink, 0); inner.position.set(-0.02, 0.24, s * 0.2); inner.rotation.x = s * 0.4;
    const eye = part(head, new THREE.SphereGeometry(0.075, 12, 10), white, 0.015); eye.position.set(-0.24, 0.08, s * 0.1);
    const iris = part(head, new THREE.SphereGeometry(0.045, 10, 8), blue, 0); iris.position.set(-0.3, 0.08, s * 0.1);
    const pupil = part(head, new THREE.SphereGeometry(0.022, 8, 6), black, 0); pupil.position.set(-0.335, 0.08, s * 0.1);
    const brow = part(head, new THREE.BoxGeometry(0.03, 0.03, 0.12), black, 0); brow.position.set(-0.27, 0.17, s * 0.1); brow.rotation.x = s * -0.35;
  }
  const nose = part(head, new THREE.SphereGeometry(0.055, 10, 8), pink); nose.scale.set(1, 0.7, 1.2); nose.position.set(-0.38, -0.02, 0);
  const mouth = part(head, new THREE.SphereGeometry(0.1, 14, 10), red, 0.012); mouth.scale.set(0.6, 0.6, 1.1); mouth.position.set(-0.34, -0.17, 0);
  for (let i = 0; i < 6; i++) {
    const spike = part(head, new THREE.ConeGeometry(0.06 - i * 0.004, 0.22 - i * 0.015, 8), i === 2 || i === 3 ? yellow : black);
    spike.position.set(-0.12 + i * 0.07, 0.3 - i * 0.012, 0); spike.rotation.z = 0.5 - i * 0.12;
  }
  // tail: a striped curve with a white tip
  const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.28, 0.95, 0), new THREE.Vector3(0.6, 0.7, 0.15), new THREE.Vector3(0.75, 0.45, 0.45), new THREE.Vector3(0.6, 0.35, 0.7)]);
  part(body, new THREE.TubeGeometry(tailCurve, 24, 0.06, 8), fur);
  const tip = part(body, new THREE.SphereGeometry(0.075, 10, 8), white); tip.position.set(0.6, 0.35, 0.7);
  return { root, body, arms, legs, head, mouth };
}

/* ── a football ── */
function buildBall() {
  const tex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#f6f6f2'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#151515';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { const cx = i * 44 + (j % 2) * 22 + 10, cy = j * 46 + 18; x.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; x.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12); } x.fill(); }
  });
  const g = new THREE.Group();
  part(g, new THREE.SphereGeometry(0.11, 24, 16), toon(0xffffff, tex), 0.04);
  return g;
}


/* ── a wall player: a plain cartoon footballer in the striped kit, built from shared parts, facing −x like the
   mascot (feet at the origin). Arms crossed low, as walls stand. ── */
function buildWallPlayer(g, m) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  for (const s of [-1, 1]) {
    const leg = part(body, g.leg, m.skin); leg.position.set(0, 0.52, s * 0.11);
    const sock = part(body, g.sock, m.yellow); sock.position.set(0, 0.22, s * 0.11);
    const boot = part(body, g.boot, m.black); boot.position.set(-0.06, 0.05, s * 0.11);
    const arm = part(body, g.arm, m.skin);
    const from = new THREE.Vector3(0, 1.56, s * 0.27), to = new THREE.Vector3(-0.22, 0.98, -s * 0.06);
    arm.position.lerpVectors(from, to, 0.5);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
  }
  const shorts = part(body, g.shorts, m.black); shorts.position.set(0, 0.86, 0);
  const torso = part(body, g.torso, m.kit); torso.position.set(0, 1.3, 0); torso.scale.set(0.78, 1, 1);
  const head = part(body, g.head, m.skin); head.position.set(-0.01, 1.84, 0);
  const hair = part(body, g.hair, m.black, 0); hair.position.set(0.015, 1.87, 0);
  return { root, body, base: new THREE.Vector3(), jump: 0 };
}

/* ── a keeper's glove (keeper mode: yours) — palm faces −x, out to the pitch ── */
function buildGlove(g, m) {
  const grp = new THREE.Group();
  const palm = part(grp, g.palm, m.white); palm.scale.set(0.5, 1.2, 1);
  const thumb = part(grp, g.thumb, m.white); thumb.position.set(0, -0.04, 0.12); thumb.rotation.x = -0.7;
  const cuff = part(grp, g.cuff, m.yellow); cuff.position.y = -0.19;
  const band = part(grp, g.band, m.black, 0); band.position.y = -0.12;
  return grp;
}

const HINTS = {
  freekick: 'Drag up from the ball — bend it round the wall or lift it over',
  crossbar: 'Hit the bar — a long, firm drag straight at it',
  keeper: 'Watch his lean — swipe, tap a side or use the arrow keys to dive',
  'so-shoot': 'Your kick — drag from the ball toward the goal · corners beat the tiger',
  'so-save': 'Save it — watch his lean, then swipe, tap a side or use the arrow keys',
};

export function createPenaltyGame(parent) {
  const group = new THREE.Group(); group.visible = false; parent.add(group);
  const net = parent.userData.goals?.[1];   // the goal you shoot at, for the net bulge
  const mascot = buildMascot();
  mascot.root.position.set(KEEPER_X, 0, 0);
  group.add(mascot.root);
  const ball = buildBall(); group.add(ball);
  // the spot
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), new THREE.MeshBasicMaterial({ color: 0xf2f2ee })); spot.rotation.x = -Math.PI / 2; spot.position.set(SPOT_X, 0.035, 0); group.add(spot);

  /* per-mode props, built once and toggled: the free-kick wall, your gloves */
  const M = {
    skin: toon(0xc0895c), black: toon(0x161616), yellow: toon(0xf2c418), white: toon(0xfff4e6),
    kit: toon(0xf2c418, canvasTex(64, 32, (x, w, h) => { const n = 8, sw = w / n; for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? '#161616' : '#f2c418'; x.fillRect(i * sw, 0, sw + 1, h); } })),
  };
  const GEO = {
    leg: new THREE.CapsuleGeometry(0.075, 0.46, 4, 8), sock: new THREE.CapsuleGeometry(0.082, 0.22, 4, 8), boot: new THREE.BoxGeometry(0.26, 0.09, 0.11),
    arm: new THREE.CapsuleGeometry(0.062, 0.52, 4, 8), shorts: new THREE.CylinderGeometry(0.2, 0.22, 0.24, 14), torso: new THREE.CapsuleGeometry(0.22, 0.42, 4, 14),
    head: new THREE.SphereGeometry(0.135, 16, 12), hair: new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
    palm: new THREE.SphereGeometry(0.13, 16, 12), thumb: new THREE.CapsuleGeometry(0.035, 0.08, 3, 8), cuff: new THREE.CylinderGeometry(0.085, 0.09, 0.12, 14), band: new THREE.CylinderGeometry(0.092, 0.092, 0.025, 14),
  };
  const wall = new THREE.Group(); wall.visible = false; group.add(wall);
  const wallers = Array.from({ length: 4 }, (_, i) => { const p = buildWallPlayer(GEO, M); p.root.scale.setScalar(0.96 + ((i * 7) % 3) * 0.03); wall.add(p.root); return p; });
  const gloves = [0, 1].map(() => { const g = buildGlove(GEO, M); g.scale.setScalar(0.72); g.visible = false; group.add(g); return g; });

  const st = {
    mode: 'penalties', active: false, k: 0, phase: 'ready',  // ready · flight · result
    t: 0, from: { p: new THREE.Vector3(), l: new THREE.Vector3() },
    arc: 8, home: { p: new THREE.Vector3(), l: new THREE.Vector3() }, cam: { p: CAM.p.clone(), l: CAM.l.clone() }, camGoal: { p: CAM.p.clone(), l: CAM.l.clone() }, lastL: CAM.l.clone(),
    shot: null, result: null, resultT: 0, deflect: null, free: null,
    round: [], bests: {}, goals: 0, shots: 0,
  };
  try { st.bests.penalties = +localStorage.getItem('itt-pen-best') || 0; } catch { st.bests.penalties = 0; /* private mode */ }
  for (const m of Object.keys(MODES)) st.bests[m] = Math.max(st.bests[m] || 0, progress.best(m));
  const cfg = () => MODES[st.mode];
  let listener = null;
  /* the shoot-out's state: both teams, every kick so far, whose turn; null outside the mode */
  let so = null;
  const keeping = () => st.mode === 'keeper' || (st.mode === 'shootout' && so?.turn === 'save');
  const soSide = (n = so.n) => (n % 2 === 0 ? 'home' : 'away');                     // home kicks first
  const soOther = (s) => (s === 'home' ? 'away' : 'home');
  const soTurn = () => (soSide() === so.you ? 'shoot' : 'save');
  function soTeam(t = {}) {
    const kickers = (t.kickers || t.players || []).map(nameOf).filter(Boolean);
    return { code: t.code || '', name: t.name || t.code || '', logo: t.logo || '', kickers: kickers.length ? kickers : ['Kicker'], keeper: nameOf(t.keeper) || 'Keeper', kicks: [] };
  }
  // what every shoot-out event carries (the HUD's scoreboard bar: "ITT 2 – 1 HIL · ●○○○○")
  function soSnap() {
    const side = so.done ? soSide(so.n - 1) : soSide(), t = so[side];
    const n = so.done ? so.n - 1 : so.n;
    return {
      home: { code: so.home.code, name: so.home.name, logo: so.home.logo, kicks: so.home.kicks.slice() },
      away: { code: so.away.code, name: so.away.name, logo: so.away.logo, kicks: so.away.kicks.slice() },
      you: so.you, turn: so.turn, kickSide: side, kick: so.n, pair: Math.floor(n / 2) + 1, suddenDeath: Math.floor(n / 2) >= 5,
      kicker: t.kickers[Math.floor(n / 2) % t.kickers.length], keeper: so[soOther(side)].keeper,
      homePens: sum(so.home.kicks), awayPens: sum(so.away.kicks), done: so.done, winner: so.winner, abandoned: !!so.abandoned,
    };
  }
  const emit = (e) => {
    const ev = { ...e, mode: st.mode, attempts: cfg().attempts, maxTotal: cfg().max, round: st.round.slice(), best: st.bests[st.mode] || 0, goals: st.goals, shots: st.shots };
    if (st.mode === 'shootout' && so) { const s = soSnap(); Object.assign(ev, { shootout: s, kicker: e.kicker ?? s.kicker, keeper: e.keeper ?? s.keeper, round: so[so.you].kicks.slice() }); }
    listener?.(ev);
    if (st.mode === 'shootout') so?.onEvent?.(ev);
  };

  /* the free kick's set-up: where the ball is, the wall's line, the keeper's start */
  const fk = { B: new THREE.Vector3(GOAL_X - 22, BALL_R, 3), W0: new THREE.Vector3(), n: new THREE.Vector3(1, 0, 0), t: new THREE.Vector3(0, 0, 1), side: 1, jumpT: -1 };
  function resetBall() {
    if (st.mode === 'freekick') ball.position.copy(fk.B);
    else if (st.mode === 'crossbar') ball.position.set(GOAL_X - 18, BALL_R, 0);
    else ball.position.set(SPOT_X, 0.11, 0);
    ball.rotation.set(0, 0, 0);
  }

  /* the keeper's dive: direction along the goal line (z), height, progress; base = where he stands */
  const keeper = { z: 0, y: 1.0, k: 0, dir: 0, t: 0, react: 0.2, base: 0 };
  function poseKeeper(time) {
    const m = mascot, kk = ease(Math.min(1, keeper.k));
    const sway = st.phase === 'ready' ? Math.sin(time * 3) * 0.12 : 0;               // shuffling on his line
    const dz = keeper.dir * Math.min(Math.abs(keeper.z), 2.4) * kk;
    m.root.position.set(KEEPER_X, Math.max(0, (keeper.y - 1.0) * 0.8) * Math.sin(kk * Math.PI * 0.9), keeper.base + dz + sway);
    const roll = keeper.dir * (keeper.y > 1.7 ? 0.9 : 1.35) * kk;                     // a full stretch, lower dives flatter
    m.body.rotation.x = roll;
    m.body.position.y = st.phase === 'ready' ? Math.abs(Math.sin(time * 6)) * 0.03 : 0;
    for (const a of m.arms) {
      // the arm on the diving side reaches up over his head, the other follows
      const up = (a.s === keeper.dir ? 2.7 : 2.2) * kk;
      a.sh.rotation.x = a.s * (-0.42 + up * (a.s === keeper.dir ? 1 : 0.7));
    }
    m.head.rotation.y = st.phase === 'ready' ? Math.sin(time * 1.3) * 0.2 : 0;
  }
  // where his reach is, for the save check: a segment from feet to gloves, padded
  function keeperReach() {
    const roll = mascot.body.rotation.x, base = mascot.root.position;
    const axis = new THREE.Vector3(0, Math.cos(roll), Math.sin(roll));   // rotation.x tips +y toward +z
    const feet = new THREE.Vector3(base.x, base.y + 0.1, base.z);
    const hands = feet.clone().addScaledVector(axis, 2.95);
    return { feet, hands };
  }
  const segDist = (p, a, b) => { const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return a.clone().addScaledVector(ab, t).distanceTo(p); };

  /* penalties — shooting: a drag in screen pixels (dx right, dy up), its length and how much it curved */
  function shoot(dx, dy, bend, w, h) {
    if (st.phase !== 'ready') return;
    const p = THREE.MathUtils.clamp(dy / (h * 0.42), 0.15, 1.35);
    const tz = THREE.MathUtils.clamp((dx / (w * 0.34)) * POST_Z, -8, 8);   // a drag about a third of the screen wide reaches the post
    const ty = 0.15 + p * 2.15;                                                     // a hard drag goes over
    const T = 0.95 - 0.38 * Math.min(p, 1);
    st.shot = { tz, ty, T, bend: THREE.MathUtils.clamp(bend, -1, 1), t: 0, p };
    // the keeper reads you (Ahmed: harder): he picks the right side 72% of the time, judges the height
    // well, reacts fast, and a soft or central shot is his. Only a hard, high, well-placed corner beats him.
    const r = Math.random();
    const central = Math.abs(tz) < 1.2;
    const guessSide = central ? (r < 0.75 ? 0 : Math.sign(tz || 1)) : r < 0.72 ? Math.sign(tz) : r < 0.92 ? -Math.sign(tz) : 0;
    keeper.dir = guessSide; keeper.z = guessSide ? Math.abs(tz) + (Math.random() - 0.5) * 0.9 : 0;
    keeper.y = guessSide ? THREE.MathUtils.clamp(ty + (Math.random() - 0.5) * 0.5, 0.4, 2.2) : THREE.MathUtils.clamp(ty, 0.6, 1.8);
    keeper.k = 0; keeper.t = 0; keeper.react = 0.09 + Math.random() * 0.08 + (1 - Math.min(p, 1)) * 0.0;
    st.phase = 'flight'; st.result = null;
    st.shots++;
    emit({ type: 'shot' });
  }

  /* a result, in any mode: score it, feel it, record it */
  function achieveFor(outcome, pts) {
    if (st.mode === 'penalties') { progress.achieve('pen-goal'); if (pts === 3) progress.achieve('pen-top'); }
    else if (st.mode === 'freekick') progress.achieve('fk-goal');
    else if (st.mode === 'crossbar') { if (outcome === 'bar') progress.achieve('crossbar'); }
    else if (st.mode === 'keeper') progress.achieve('keeper-save');
  }
  /* a shoot-out kick's result: for your kick `goal` scores; for theirs `conceded` scores, anything else is yours */
  function soFinish(result, msg, outcome) {
    if (so.done) return;
    const side = soSide(), shooting = so.turn === 'shoot';
    const kicker = so[side].kickers[Math.floor(so.n / 2) % so[side].kickers.length], keeperName = so[soOther(side)].keeper;
    const scored = shooting ? result === 'goal' : outcome === 'conceded';
    const good = shooting ? scored : !scored;
    so[side].kicks.push(scored ? 1 : 0); so.n++;
    st.phase = 'result'; st.result = result; st.resultT = 0;
    if (good) st.goals++;
    if (shooting && scored) net?.hit(ball.position.z, ball.position.y);
    const w = soDecided(so.home.kicks, so.away.kicks);
    if (w) { so.done = true; so.winner = w; }
    if (good) {
      feel.goal();
      progress.award(10, shooting ? 'Shoot-out penalty' : 'Shoot-out save');
      progress.achieve(shooting ? 'pen-goal' : 'keeper-save');
    } else feel.miss();
    if (so.done) setTimeout(() => { if (so?.winner === so?.you) { feel.win(); feel.roar(); feel.confetti(); } }, 700);
    const text = shooting ? (scored ? `${kicker.toUpperCase()} SCORES` : result === 'saved' ? 'SAVED BY THE TIGER' : 'MISSED')
      : scored ? `${kicker.toUpperCase()} SCORES` : outcome === 'wide' ? 'OFF TARGET — THEY MISS' : 'SAVED!';
    emit({ type: 'result', result: good ? 'goal' : shooting ? result : 'miss', pts: good ? 1 : 0, msg: text || msg, outcome, win: good, scored, kickSide: side, kicker, keeper: keeperName, roundOver: false, roundTotal: sum(so[so.you].kicks), newBest: false });
  }
  // after a kick has played out: the next one (a TV-style cut to the other end), or the end
  function soNext() {
    if (so.done) {
      st.phase = 'over';
      if (so.ended) return;
      so.ended = true;
      const r = { homePens: sum(so.home.kicks), awayPens: sum(so.away.kicks), winner: so.winner, home: so.home.kicks.slice(), away: so.away.kicks.slice(), abandoned: !!so.abandoned };
      emit({ type: 'end', ...r });
      so.onEnd?.(r);
      return;
    }
    so.turn = soTurn();
    showMode();
    st.phase = 'ready'; drag.on = false;
    kp.dived = false; kp.dk = 0; kp.D.copy(STAND); kp.M.copy(STAND);
    setupAttempt(true);
    if (so.turn === 'save') keeperShot(1.2);
    emit({ type: 'ready', cut: true, hint: HINTS[`so-${so.turn}`] });
  }
  function soAbandon() {
    // stopped before it was decided: the kicks that are left are simulated (about three in four go in)
    while (!so.done && so.n < 60) {
      so[soSide()].kicks.push(Math.random() < 0.75 ? 1 : 0); so.n++;
      const w = soDecided(so.home.kicks, so.away.kicks);
      if (w) { so.done = true; so.winner = w; }
    }
    so.abandoned = true;
    if (so.ended) return;
    so.ended = true;
    const r = { homePens: sum(so.home.kicks), awayPens: sum(so.away.kicks), winner: so.winner, home: so.home.kicks.slice(), away: so.away.kicks.slice(), abandoned: true };
    emit({ type: 'end', ...r });
    so.onEnd?.(r);
  }
  function finish(result, pts, msg, outcome = result) {
    if (st.mode === 'shootout') { soFinish(result, msg, outcome); return; }
    st.phase = 'result'; st.result = result; st.resultT = 0;
    if (pts > 0) st.goals++;
    if (st.mode === 'penalties' && result === 'goal') net?.hit(ball.position.z, ball.position.y);
    st.round.push(pts);
    const total = st.round.reduce((a, b) => a + b, 0);
    let roundOver = false, newBest = false;
    if (st.round.length >= cfg().attempts) {
      roundOver = true;
      if (total > (st.bests[st.mode] || 0)) {
        st.bests[st.mode] = total; newBest = true;
        if (st.mode === 'penalties') { try { localStorage.setItem('itt-pen-best', String(total)); } catch { /* private */ } }
      }
      progress.setBest(st.mode, total);
    }
    if (pts > 0) {
      feel.goal();
      if (pts >= 3 || (st.mode === 'keeper' && pts >= 2)) feel.confetti({ n: 90 });
      progress.award(XP[pts] || 10, msg);
      achieveFor(outcome, pts);
    } else feel.miss();
    if (roundOver) setTimeout(() => { feel.win(); if (newBest) feel.confetti(); }, 900);
    emit({ type: 'result', result, pts, msg, outcome, win: pts > 0, roundOver, roundTotal: total, newBest });
  }
  const placement = (z, y) => { const az = Math.abs(z); return az > 2.5 && (y > 1.6 || y < 0.55) ? 3 : az > 1.5 ? 2 : 1; };
  const PEN_MSG = ['', 'GOAL! +1', 'GOAL! +2', 'TOP BINS! +3'];

  function updatePenalty(dt) {
    if (st.phase === 'flight') {
      const s = st.shot;
      s.t += dt;
      keeper.t += dt;
      if (keeper.t > keeper.react && keeper.dir !== 0) keeper.k = Math.min(1, keeper.k + dt / 0.32);   // a quicker dive
      const u = Math.min(1, s.t / s.T);
      // straight line to the target with a little lift and the bend you drew
      const x = THREE.MathUtils.lerp(SPOT_X, GOAL_X + 0.4, u);
      const z = THREE.MathUtils.lerp(0, s.tz * ((GOAL_X + 0.4 - SPOT_X) / (GOAL_X - SPOT_X)), u) + s.bend * 1.3 * Math.sin(Math.PI * u);
      const y = THREE.MathUtils.lerp(0.11, s.ty, u) + 0.35 * (1 - s.p * 0.7) * 4 * u * (1 - u);
      ball.position.set(x, y, z);
      ball.rotation.z -= dt * 22; ball.rotation.y += dt * s.bend * 10;
      // at the keeper's line: saved?
      if (!s.checked && x >= KEEPER_X) {
        s.checked = true;
        const { feet, hands } = keeperReach();
        if (segDist(ball.position, feet, hands) < (keeper.dir === 0 ? 0.62 : 0.56)) { s.saved = true; s.deflect = new THREE.Vector3(-4, 2.5, keeper.dir * 3 || (Math.random() - 0.5) * 6); }
      }
      if (s.saved) { finish('saved', 0, 'SAVED BY THE TIGER'); st.deflect = { v: s.deflect.clone(), p: ball.position.clone() }; }
      else if (u >= 1) {
        const inGoal = Math.abs(ball.position.z) < POST_Z - 0.11 && ball.position.y < BAR_Y - 0.11;
        const pts = inGoal ? placement(ball.position.z, ball.position.y) : 0;
        finish(inGoal ? 'goal' : 'miss', pts, inGoal ? PEN_MSG[pts] : 'MISSED');
      }
    } else if (st.phase === 'result') {
      st.resultT += dt;
      if (st.result === 'saved' && st.deflect) {
        st.deflect.v.y -= 9.8 * dt;
        st.deflect.p.addScaledVector(st.deflect.v, dt);
        if (st.deflect.p.y < 0.11) { st.deflect.p.y = 0.11; st.deflect.v.multiplyScalar(0.5); st.deflect.v.y = Math.abs(st.deflect.v.y) * 0.4; }
        ball.position.copy(st.deflect.p);
      } else if (st.result === 'goal') {
        // into the net and down
        ball.position.x = Math.min(GOAL_X + 1.6, ball.position.x + dt * 3 * Math.max(0, 1 - st.resultT));
        ball.position.y = Math.max(0.11, ball.position.y - dt * 2.5);
      }
      keeper.k = Math.min(1, keeper.k + dt / 0.42);
      if (st.resultT > 1.6) nextAttempt();
    }
  }

  /* ── free kick + crossbar: a real flight. Position is analytic between frames — p(t) = B + v0·t + ½·a·t²,
     gravity plus a constant sideways pull for the bend, solved so the ball reaches your aim point at the line —
     and sampled in small sub-steps for the wall, the keeper and the frame. After any contact it's a free ball. ── */
  const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  const ballAt = (s, t, p, v) => { p.copy(s.B).addScaledVector(s.v0, t).addScaledVector(s.acc, 0.5 * t * t); v.copy(s.v0).addScaledVector(s.acc, t); };
  const inMouth = (p) => Math.abs(p.z) < POST_Z - BALL_R && p.y < BAR_Y - BALL_R;
  const bounce = (v, n, e) => { const vn = v.dot(n); if (vn < 0) v.addScaledVector(n, -(1 + e) * vn); };
  const toFree = (p, v, inNet = false) => { st.free = { p: p.clone(), v: v.clone(), net: inNet }; ball.position.copy(p); };

  function layFreeKick() {
    const side = Math.random() < 0.5 ? -1 : 1, D = 20.5 + Math.random() * 3, bz = side * (1.5 + Math.random() * 5);
    fk.side = side;
    fk.B.set(GOAL_X - Math.sqrt(D * D - bz * bz), BALL_R, bz);
    // the wall lines up 9.15 m off, across the near-post half; the keeper takes a step toward the far post
    fk.n.set(GOAL_X - fk.B.x, 0, side * 1.7 - bz).normalize();
    fk.t.set(-fk.n.z, 0, fk.n.x);
    fk.W0.copy(fk.B).addScaledVector(fk.n, 9.15); fk.W0.y = 0;
    const yaw = Math.atan2(-fk.n.z, fk.n.x);   // front (local −x) toward the ball
    wallers.forEach((w, i) => { w.base.copy(fk.W0).addScaledVector(fk.t, (i - 1.5) * 0.56); w.root.position.copy(w.base); w.root.rotation.y = yaw; w.jump = 0; });
    keeper.base = -side * 0.5;
    fk.jumpT = -1;
  }
  function poseWall(dt, time) {
    if (fk.jumpT >= 0) fk.jumpT += dt;
    wallers.forEach((w, i) => {
      const jt = fk.jumpT - 0.06 - i * 0.025;
      w.jump = jt > 0 && jt < 0.58 ? 0.32 * Math.sin((Math.PI * jt) / 0.58) : 0;
      w.root.position.y = w.jump;
      w.body.rotation.z = fk.jumpT < 0 ? Math.sin(time * 1.7 + i * 1.3) * 0.02 : 0;   // shifting weight while they wait
    });
  }
  // the ball against the wall: each man is a vertical capsule, shins to the top of his head
  function wallHit(p) {
    for (const w of wallers) {
      const s = w.root.scale.x;
      _c.set(w.base.x, THREE.MathUtils.clamp(p.y, 0.25 * s + w.jump, 1.72 * s + w.jump), w.base.z);
      if (_c.distanceTo(p) < 0.25 + BALL_R) return _c;
    }
    return null;
  }
  // the ball against the frame: the bar's axis runs along z at x = GOAL_X, y = BAR_C; the posts stand at z = ±POST_C
  function frameHit(p, rBar, rPost) {
    if (Math.abs(p.x - GOAL_X) > 0.5) return null;
    if (Math.abs(p.z) <= POST_C + 0.04) {
      const d = Math.hypot(p.x - GOAL_X, p.y - BAR_C);
      if (d < rBar) return { kind: 'bar', n: new THREE.Vector3(p.x - GOAL_X, p.y - BAR_C, 0).divideScalar(d || 1), c: new THREE.Vector3(GOAL_X, BAR_C, p.z), r: rBar };
    }
    if (p.y <= BAR_C) for (const sz of [-1, 1]) {
      const d = Math.hypot(p.x - GOAL_X, p.z - sz * POST_C);
      if (d < rPost) return { kind: 'post', n: new THREE.Vector3(p.x - GOAL_X, 0, p.z - sz * POST_C).divideScalar(d || 1), c: new THREE.Vector3(GOAL_X, p.y, sz * POST_C), r: rPost };
    }
    return null;
  }
  function keeperGuess(tz, ty, T) {
    const rel = tz - keeper.base, r = Math.random(), side = Math.sign(rel) || 1;
    // the wall screens him, so a hard, quick strike is a guess (half the time right); a slow, looping one he reads
    const right = THREE.MathUtils.clamp(0.5 + (0.35 * (T - 0.95)) / 0.45, 0.5, 0.85);
    const g = Math.abs(rel) < 1.0 ? (r < 0.7 ? 0 : side) : r < right ? side : r < right + (1 - right) * 0.6 ? -side : 0;
    keeper.dir = g; keeper.z = g ? Math.abs(rel) + (Math.random() - 0.5) * 0.9 : 0;
    keeper.y = g ? THREE.MathUtils.clamp(ty + (Math.random() - 0.5) * 0.5, 0.4, 2.2) : THREE.MathUtils.clamp(ty, 0.6, 1.8);
    keeper.k = 0; keeper.t = 0; keeper.react = Math.max(0.18, T - 0.6) + Math.random() * 0.12;
  }
  function shootBall(dx, dy, bend, w, h) {
    if (st.phase !== 'ready') return;
    const isFK = st.mode === 'freekick';
    const p = THREE.MathUtils.clamp(dy / (h * 0.42), 0.15, 1.35);
    const tz = THREE.MathUtils.clamp(st.cam.l.z + (dx / (w * 0.34)) * POST_Z, -9, 9);
    const ty = 0.15 + p * 2.15;
    const T = isFK ? 1.45 - 0.4 * Math.min(p, 1) : 1.2 - 0.3 * Math.min(p, 1);
    const b = THREE.MathUtils.clamp(bend, -1, 1);
    const dev = (isFK ? 1.7 : 0.9) * b;                                      // the curve's bulge mid-flight, metres
    const B = ball.position.clone();
    const acc = new THREE.Vector3(0, -G, (-8 * dev) / (T * T));
    const v0 = new THREE.Vector3(GOAL_X, ty, tz).sub(B).divideScalar(T).addScaledVector(acc, -0.5 * T);
    st.shot = { B, v0, acc, T, t: 0, p, bend: b, along: -1, overWall: false, checked: false, pending: null, pendT: 0 };
    if (isFK) { fk.jumpT = 0; keeperGuess(tz, ty, T); }
    st.phase = 'flight'; st.result = null; st.free = null;
    st.shots++;
    emit({ type: 'shot' });
  }
  // one sub-step of the analytic flight; true once it has ended (contact or the line)
  function stepBall(s, p, v) {
    const isFK = st.mode === 'freekick';
    if (isFK) {
      const hit = wallHit(p);
      if (hit) { const vv = v.clone(); bounce(vv, p.clone().sub(hit).normalize(), 0.35); toFree(p, vv.multiplyScalar(0.6)); finish('miss', 0, 'BLOCKED BY THE WALL', 'blocked'); return true; }
      const along = _d.copy(p).sub(fk.W0).dot(fk.n);
      if (s.along < 0 && along >= 0 && Math.abs(_d.dot(fk.t)) < 0.56 * 2 + 0.3) s.overWall = true;   // it passed the wall's line inside its width
      s.along = along;
      if (!s.checked && p.x >= KEEPER_X) {
        s.checked = true;
        const { feet, hands } = keeperReach();
        if (segDist(p, feet, hands) < (keeper.dir === 0 ? 0.62 : 0.56)) { toFree(p, new THREE.Vector3(-4, 2.5, keeper.dir * 3 || (Math.random() - 0.5) * 6)); finish('saved', 0, 'SAVED BY THE TIGER', 'saved'); return true; }
      }
    }
    const fh = frameHit(p, isFK ? 0.17 : 0.25, isFK ? 0.17 : 0.22);   // the challenge counts anything within a ball's width of the bar
    if (fh) {
      const vv = v.clone(); bounce(vv, fh.n, 0.62); vv.z *= 0.85;
      toFree(_d.copy(fh.c).addScaledVector(fh.n, Math.max(fh.r, FRAME_R + BALL_R) + 0.01), vv);
      if (isFK) { s.pending = fh.kind; s.pendT = 0; }   // it might still go in off the frame
      else if (fh.kind === 'bar') finish('goal', 3, 'CROSSBAR! +3', 'bar');
      else finish('goal', 1, 'OFF THE POST! +1', 'post');
      return true;
    }
    if (p.x >= GOAL_X) {
      if (inMouth(p)) {
        net?.hit(p.z, p.y);
        toFree(p, v.clone().multiplyScalar(0.5), true);
        if (isFK) {
          let pts = placement(p.z, p.y); const over = s.overWall && pts < 3; if (over) pts = 2;
          finish('goal', pts, pts === 3 ? 'TOP BINS! +3' : over ? 'OVER THE WALL! +2' : `FREE KICK! +${pts}`, 'goal');
        } else finish('miss', 0, 'IN THE NET — NO POINTS', 'net');
      } else {
        toFree(p, v);
        finish('miss', 0, p.y >= BAR_Y ? 'OVER THE BAR' : 'WIDE', p.y >= BAR_Y ? 'over' : 'wide');
      }
      return true;
    }
    return false;
  }
  function freeStep(dt) {
    const f = st.free;
    f.v.y -= G * dt;
    f.p.addScaledVector(f.v, dt);
    if (f.p.y < BALL_R) { f.p.y = BALL_R; f.v.y = f.v.y < -1.2 ? -f.v.y * 0.45 : 0; f.v.x *= 0.82; f.v.z *= 0.82; }
    if (f.p.y <= BALL_R + 1e-3) { const k = Math.exp(-dt * 1.4); f.v.x *= k; f.v.z *= k; }   // rolling
    if (f.net) {   // the net catches it
      const back = GOAL_X + 1.5;
      if (f.p.x > back) { f.p.x = back; f.v.x = -Math.abs(f.v.x) * 0.15; f.v.z *= 0.4; f.v.y *= 0.5; }
      if (f.p.y > BAR_Y - BALL_R) { f.p.y = BAR_Y - BALL_R; f.v.y = -Math.abs(f.v.y) * 0.2; }
      if (Math.abs(f.p.z) > POST_Z - BALL_R) { f.p.z = Math.sign(f.p.z) * (POST_Z - BALL_R); f.v.z *= -0.2; }
    }
    ball.position.copy(f.p);
    ball.rotation.z -= dt * Math.hypot(f.v.x, f.v.z) * 4;
  }
  function updateBall(dt) {
    const s = st.shot;
    if (st.phase === 'flight' && s && !st.free) {
      keeper.t += dt;
      if (keeper.t > keeper.react && keeper.dir !== 0) keeper.k = Math.min(1, keeper.k + dt / 0.32);
      const n = Math.max(2, Math.ceil((dt * (s.v0.length() + 6)) / 0.06));
      for (let i = 1; i <= n; i++) { ballAt(s, s.t + (dt * i) / n, _p, _v); if (stepBall(s, _p, _v)) break; }
      s.t += dt;
      if (!st.free) ball.position.copy(_p);
      ball.rotation.z -= dt * 22; ball.rotation.y += dt * s.bend * 10;
      if (st.phase === 'flight' && !st.free && s.t > s.T + 1.5) finish('miss', 0, 'MISSED', 'wide');   // (can't happen; belt and braces)
    } else if (st.free) {
      freeStep(dt);
      if (st.phase === 'flight' && s?.pending) {   // a free kick off the frame: does it drop in?
        s.pendT += dt;
        const f = st.free, word = s.pending === 'bar' ? 'BAR' : 'POST';
        if (f.p.x >= GOAL_X && inMouth(f.p)) { f.net = true; net?.hit(f.p.z, f.p.y); const pts = Math.max(1, placement(f.p.z, f.p.y)); finish('goal', pts, `IN OFF THE ${word}! +${pts}`, 'goal'); }
        else if (s.pendT > 0.7 || f.p.x >= GOAL_X || (f.v.x < 0 && f.p.x < GOAL_X - 0.4)) finish('miss', 0, `OFF THE ${word}`, s.pending);   // coming back out: no
      }
    }
    if (st.phase === 'result') {
      st.resultT += dt;
      keeper.k = Math.min(1, keeper.k + dt / 0.42);
      if (st.resultT > 1.6) nextAttempt();
    }
  }

  /* ── keeper mode: you're on the line, the tiger takes them ── */
  const KS = GOAL_X - 1.2;                                     // where you meet the ball: a step off your line
  const STAND = new THREE.Vector3(KS, 0.95, 0), TOP = new THREE.Vector3(KS, 1.8, 0);
  const RUN_S = new THREE.Vector3(SPOT_X - 3.4, 0, -1.7), RUN_K = new THREE.Vector3(SPOT_X - 0.55, 0, -0.22), RUN_T = 1.1;
  const RUN_YAW = Math.atan2(RUN_K.z - RUN_S.z, -(RUN_K.x - RUN_S.x));
  const kp = { s: 'wait', t: 0, target: new THREE.Vector3(), T: 0.8, side: 1, dived: false, dk: 0, D: STAND.clone(), M: STAND.clone(), kicked: 0 };
  function keeperShot(wait = 0.7) {
    kp.s = 'wait'; kp.t = 0.7 - wait; kp.dived = false; kp.dk = 0; kp.D.copy(STAND); kp.kicked = 0;
    st.phase = 'ready'; st.shot = null; st.free = null;
    const side = Math.random() < 0.5 ? -1 : 1, r = Math.random();
    kp.side = side;
    const so8 = st.mode === 'shootout' && Math.random() < 0.08;                                                // shoot-outs: now and then he misses
    if (so8) kp.target.set(GOAL_X, Math.random() < 0.5 ? 2.75 + Math.random() * 0.5 : 0.4 + Math.random() * 1.4, Math.random() < 0.5 ? side * (4.1 + Math.random() * 0.6) : side * Math.random() * 2.5);
    else if (r < 0.25) kp.target.set(GOAL_X, 1.75 + Math.random() * 0.45, side * (2.6 + Math.random() * 0.75));    // top corner
    else if (r < 0.37) kp.target.set(GOAL_X, 0.3 + Math.random() * 1.6, side * Math.random() * 0.6);          // down the middle
    else kp.target.set(GOAL_X, 0.25 + Math.random() * 1.6, side * (1.1 + Math.random() * 2.3));
    kp.T = st.mode === 'shootout' ? 0.84 - 0.01 * Math.min(6, Math.floor(so.n / 2)) : 0.86 - 0.035 * st.round.length;   // each one a touch harder
    ball.position.set(SPOT_X, BALL_R, 0); ball.rotation.set(0, 0, 0);
  }
  function nextKeeperRound() { st.round = []; keeperShot(0.5); emit({ type: 'ready', hint: HINTS.keeper }); }
  // dive toward a point on the line: lateral in screen terms (+ = right, which is −z from in the goal), height in metres
  function keeperDive(a, hgt) {
    if (kp.dived || !(kp.s === 'wait' || kp.s === 'run' || kp.s === 'flight')) return;
    kp.dived = true; kp.dk = 0;
    kp.D.set(KS, THREE.MathUtils.clamp(hgt, 0.25, 2.3), THREE.MathUtils.clamp(-a, -3.3, 3.3));
  }
  function swipeDive(dx, dy, w, h) {   // the swipe's direction is the dive's, its length the stretch
    const L = Math.hypot(dx, dy) || 1, reach = THREE.MathUtils.clamp(L / (Math.min(w, h) * 0.22), 0.45, 1) * 3.4;
    keeperDive((dx / L) * reach, STAND.y + (dy / L) * reach * 0.75);
  }
  function tapDive(x, y, w, h) {       // a tap: dive toward that part of the screen
    keeperDive(THREE.MathUtils.clamp((x - w / 2) / (w * 0.3), -1, 1) * 3.3, STAND.y + THREE.MathUtils.clamp((h / 2 - y) / (h * 0.3), -1, 1) * 1.3);
  }
  function kick() {
    kp.s = 'flight'; kp.kicked = 0; st.phase = 'flight'; st.free = null;
    const B = new THREE.Vector3(SPOT_X, BALL_R, 0), acc = new THREE.Vector3(0, -G, 0);
    const v0 = kp.target.clone().sub(B).divideScalar(kp.T).addScaledVector(acc, -0.5 * kp.T);
    st.shot = { B, v0, acc, T: kp.T, t: 0, bend: 0, checked: false };
    st.shots++;
    emit({ type: 'shot' });
  }
  function stepKeeperBall(s, p, v) {
    if (!s.checked && p.x >= KS) {
      s.checked = true;
      const e = ease(Math.min(1, kp.dk));
      // the body: feet to hands. Diving, it lies out along the dive — feet trailing a little lower, toward the middle
      const feet = new THREE.Vector3(KS, THREE.MathUtils.lerp(0.1, kp.D.y * 0.55, e), 0.3 * kp.D.z * e), top = new THREE.Vector3().lerpVectors(TOP, kp.D, e);
      if (segDist(p, feet, top) < 0.4 || p.distanceTo(gloves[0].position) < 0.32 || p.distanceTo(gloves[1].position) < 0.32) {
        const corner = Math.abs(kp.target.z) > 2.4 && kp.target.y > 1.55;
        toFree(p, new THREE.Vector3(-5, 2 + Math.random() * 2.5, (Math.sign(p.z) || 1) * (2 + Math.random() * 2)));
        kp.s = 'result';
        finish('goal', corner ? 2 : 1, corner ? 'TOP-CORNER SAVE! +2' : 'SAVED! +1', 'save');
        return true;
      }
    }
    if (p.x >= GOAL_X && st.mode === 'shootout' && !inMouth(p)) {   // wide or over: their miss
      toFree(p, v.clone());
      kp.s = 'result';
      finish('goal', 1, 'OFF TARGET', 'wide');
      return true;
    }
    if (p.x >= GOAL_X) {
      net?.hit(p.z, p.y);
      toFree(p, v.clone().multiplyScalar(0.5), true);
      kp.s = 'result';
      finish('miss', 0, 'GOAL — THE TIGER SCORES', 'conceded');
      return true;
    }
    return false;
  }
  function poseStriker(time) {
    const m = mascot, run = kp.s === 'run';
    const u = run ? Math.min(1, kp.t / RUN_T) : kp.s === 'flight' || kp.s === 'result' ? 1 : 0;
    const after = kp.s === 'flight' || kp.s === 'result' ? kp.kicked : 0;   // seconds since the kick
    m.root.position.lerpVectors(RUN_S, RUN_K, u);
    m.root.position.x += Math.min(1, after / 0.5) * 0.45;                    // follow-through
    m.root.rotation.y = run ? THREE.MathUtils.lerp(RUN_YAW, Math.PI, THREE.MathUtils.smoothstep(u, 0.6, 1)) : Math.PI;
    // the tell: in the last strides he leans and looks the way he's going to put it
    const tell = run ? THREE.MathUtils.smoothstep(u, 0.55, 0.8) : after > 0 ? 1 : 0;
    m.body.rotation.x = -kp.side * 0.2 * tell;
    m.head.rotation.y = -kp.side * 0.5 * tell;
    const ph = time * 15, stride = run ? 1 - THREE.MathUtils.smoothstep(u, 0.75, 0.9) : 0;
    const cheer = kp.s === 'result' && st.result === 'miss' && st.resultT > 0.3;   // he scored: arms up
    m.body.position.y = run ? Math.abs(Math.sin(ph)) * 0.07 * stride : cheer ? Math.abs(Math.sin(time * 8)) * 0.12 : Math.abs(Math.sin(time * 3)) * 0.02;
    for (const L of m.legs) {
      let r = Math.sin(ph + (L.s > 0 ? 0 : Math.PI)) * 0.65 * stride;
      if (L.s < 0) {   // the kicking leg (his right): back-lift, strike, follow-through
        if (run) r += THREE.MathUtils.smoothstep(u, 0.75, 0.97) * 1.0;
        if (after > 0) r = after < 0.12 ? THREE.MathUtils.lerp(1.0, -1.3, after / 0.12) : -1.3 * Math.max(0, 1 - (after - 0.12) / 0.5);
      }
      L.hip.rotation.z = r;
    }
    for (const a of m.arms) {
      a.sh.rotation.x = cheer ? -a.s * 2.7 : -a.s * (0.25 + 0.25 * tell);
      a.sh.rotation.z = run ? Math.sin(ph + (a.s > 0 ? Math.PI : 0)) * 0.6 * stride : 0;
    }
  }
  function poseGloves(time) {
    const e = ease(Math.min(1, kp.dk));
    kp.M.lerpVectors(STAND, kp.D, e);
    // side by side when set, one over the other across the line of the dive at full stretch
    const dz = kp.D.z, dy = kp.D.y - STAND.y, L = Math.hypot(dz, dy) || 1;
    const sz = THREE.MathUtils.lerp(0.55, (-dy / L) * 0.13, e), sy = THREE.MathUtils.lerp(0, (dz / L) * 0.13, e);
    const bob = kp.dived ? 0 : Math.sin(time * 5) * 0.025;
    const roll = THREE.MathUtils.clamp(Math.atan2(dz, Math.max(dy, -0.4)), -1.7, 1.7) * e;
    gloves.forEach((g, i) => {
      const s = i ? -1 : 1;
      g.position.set(KS, kp.M.y + s * sy + bob, kp.M.z + s * sz);
      g.rotation.set(roll + (1 - e) * s * 0.25, 0, 0);
    });
  }
  function updateKeeper(dt, time) {
    kp.t += dt;
    if (kp.dived) kp.dk = Math.min(1, kp.dk + dt / 0.3);
    if (kp.s === 'wait' && kp.t > 0.7) { kp.s = 'run'; kp.t = 0; }
    if (kp.s === 'run' && kp.t >= RUN_T) kick();
    if (kp.s === 'flight' || kp.s === 'result') kp.kicked += dt;
    const s = st.shot;
    if (kp.s === 'flight' && s && !st.free) {
      const n = Math.max(2, Math.ceil((dt * (s.v0.length() + 6)) / 0.06));
      for (let i = 1; i <= n; i++) { ballAt(s, s.t + (dt * i) / n, _p, _v); if (stepKeeperBall(s, _p, _v)) break; }
      s.t += dt;
      if (!st.free) ball.position.copy(_p);
      ball.rotation.z -= dt * 22;
    } else if (st.free) freeStep(dt);
    if (kp.s === 'result') {
      st.resultT += dt;
      if (st.mode === 'shootout') { if (st.resultT > 1.7 && st.phase === 'result') soNext(); }
      else if (st.resultT > 1.7) {
        if (st.round.length >= cfg().attempts) {   // round over: wait for you
          kp.s = 'idle'; st.phase = 'ready'; st.free = null; kp.dived = false; kp.dk = 0; kp.D.copy(STAND);
          ball.position.set(SPOT_X, BALL_R, 0);
          emit({ type: 'ready', hint: 'Tap or press space to face another five', waiting: true });
        } else { keeperShot(); emit({ type: 'ready', hint: HINTS.keeper }); }
      }
    }
    poseStriker(time);
    poseGloves(time);
  }
  // arrow keys: ← / → dive (hold ↑ or ↓ first for high or low), ↑ / ↓ alone go up the middle or smother
  const held = new Set(); let upTimer = 0;
  addEventListener('keydown', (e) => {
    if (!st.active || !keeping() || st.k < 0.95) return;
    const k = e.key;
    if (!(k.startsWith('Arrow') || k === ' ' || k === 'Enter')) return;
    e.preventDefault();
    if (e.repeat) return;
    if (kp.s === 'idle') { if (st.mode === 'keeper') nextKeeperRound(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      clearTimeout(upTimer);
      keeperDive(k === 'ArrowRight' ? 3.0 : -3.0, held.has('ArrowUp') ? 2.1 : held.has('ArrowDown') ? 0.4 : 1.2);
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      held.add(k);
      clearTimeout(upTimer);
      upTimer = setTimeout(() => { if (held.has(k)) keeperDive(0, k === 'ArrowUp' ? 2.25 : 0.3); }, 160);
    }
  });
  addEventListener('keyup', (e) => { held.delete(e.key); });

  /* the modes: what's on the pitch, where the camera sits */
  function camFor(out) {
    if (st.mode === 'freekick') {
      _d.set(GOAL_X - fk.B.x, 0, -fk.B.z).normalize();
      out.p.copy(fk.B).addScaledVector(_d, -5.4); out.p.y = 1.95;
      out.l.set(GOAL_X, 1.2, fk.B.z * 0.12);
    } else if (st.mode === 'crossbar') { out.p.set(GOAL_X - 18 - 5.2, 1.7, 0); out.l.set(GOAL_X, 1.5, 0); }
    else if (keeping()) { out.p.set(GOAL_X + 0.4, 1.5, 0); out.l.set(SPOT_X, 1.1, 0); }
    else { out.p.copy(CAM.p); out.l.copy(CAM.l); }
  }
  function setupAttempt(snap) {
    st.free = null; st.deflect = null; st.shot = null;
    keeper.k = 0; keeper.dir = 0; keeper.base = 0;
    if (st.mode === 'freekick') layFreeKick();
    resetBall();
    camFor(st.camGoal);
    if (snap) { st.cam.p.copy(st.camGoal.p); st.cam.l.copy(st.camGoal.l); }
  }
  function nextAttempt() {
    if (st.mode === 'shootout') { soNext(); return; }
    st.phase = 'ready';
    if (st.round.length >= cfg().attempts) st.round = [];
    setupAttempt(false);
    emit({ type: 'ready', ...(HINTS[st.mode] ? { hint: HINTS[st.mode] } : {}) });
  }
  function showMode() {
    const m = st.mode;
    mascot.root.visible = m !== 'crossbar';
    wall.visible = m === 'freekick';
    gloves.forEach((g) => { g.visible = keeping(); });
    // the keeper pose (penalties, free kicks) starts from a neutral body: no stride, facing out
    mascot.root.rotation.y = 0;
    for (const L of mascot.legs) L.hip.rotation.z = 0;
    for (const a of mascot.arms) a.sh.rotation.z = 0;
    mascot.body.rotation.x = 0; mascot.head.rotation.y = 0;
  }

  function update(dt, time) {
    if (!group.visible) return;
    net?.update(dt, time);
    // a shoot-out that's been left (or is decided and over): hold the last pose, take no more kicks
    if (st.mode === 'shootout' && (!st.active || st.phase === 'over')) { if (keeping()) { poseStriker(time); poseGloves(time); } else poseKeeper(time); return; }
    if (keeping()) { updateKeeper(dt, time); return; }
    poseKeeper(time);
    if (st.mode === 'freekick') poseWall(dt, time);
    if (st.mode === 'penalties' || st.mode === 'shootout') updatePenalty(dt); else updateBall(dt);
  }

  /* camera: fly down to the mode's view and back; between attempts it glides to the next set-up */
  function apply(dt, P, Lk) {
    if (!st.active && st.k <= 0) return false;
    st.k = THREE.MathUtils.clamp(st.k + (st.active ? dt : -dt) / 1.8, 0, 1);
    const e = ease(st.k);
    if (st.k <= 0) { group.visible = false; return false; }
    const g = 1 - Math.exp(-dt * 2.4);
    st.cam.p.lerp(st.camGoal.p, g); st.cam.l.lerp(st.camGoal.l, g);
    const C = st.cam;
    const mid = new THREE.Vector3().lerpVectors(st.from.p, C.p, 0.5); mid.y = Math.max(st.from.p.y, C.p.y) + st.arc;
    const a = 1 - e;
    P.set(0, 0, 0).addScaledVector(st.from.p, a * a).addScaledVector(mid, 2 * a * e).addScaledVector(C.p, e * e);
    Lk.lerpVectors(st.from.l, C.l, ease(Math.min(1, st.k * 1.2)));
    if (keeping()) {   // your dive throws the view with it
      const oz = kp.M.z - STAND.z, oy = kp.M.y - STAND.y;
      P.z += oz * 0.7 * e; P.y += (oy * 0.35 - 0.25 * Math.min(1, Math.abs(oz) / 3)) * e;
      Lk.z += oz * 0.8 * e; Lk.y += oy * 0.3 * e;
    }
    st.lastL.copy(Lk);
    return true;
  }

  /* drag input */
  const drag = { on: false, pts: [] };
  return {
    group,
    get active() { return st.active; },
    get phase() { return st.phase; },
    get mode() { return st.mode; },
    onChange(fn) { listener = fn; },
    start(fromP, fromL, mode = 'penalties', opts = {}) {
      if (!MODES[mode]) mode = 'penalties';
      if (mode === 'shootout') {   // a new shoot-out every time
        const you = opts?.you === 'away' ? 'away' : 'home';
        so = { home: soTeam(opts?.home), away: soTeam(opts?.away), you, n: 0, turn: 'shoot', done: false, winner: null, abandoned: false, onEvent: opts?.onEvent, onEnd: opts?.onEnd };
        so.turn = soTurn();
        st.mode = mode; st.round = []; st.goals = 0; st.shots = 0;
        kp.dived = false; kp.dk = 0; kp.D.copy(STAND); kp.M.copy(STAND);
      } else so = null;
      const flying = st.k > 0;   // already out on the pitch (or on the way back): go from where the camera is
      st.from.p.copy(fromP); st.from.l.copy(flying ? st.lastL : fromL);
      if (!flying) { st.home.p.copy(fromP); st.home.l.copy(fromL); }   // where the fly-out goes back to
      if (flying) st.k = 0;
      st.arc = flying ? 2 : 8;   // from the stands: a swoop down; from one game to the next: a low hop
      if (mode !== st.mode) { st.mode = mode; st.round = []; st.goals = 0; st.shots = 0; }
      showMode();
      st.active = true; group.visible = true; st.phase = 'ready'; drag.on = false;
      setupAttempt(true);
      if (mode === 'keeper') { if (st.round.length >= cfg().attempts) st.round = []; keeperShot(2.2); }   // first run-up after the fly-in
      if (mode === 'shootout' && so.turn === 'save') keeperShot(2.4);
      progress.played(mode);
      const hint = mode === 'shootout' ? HINTS[`so-${so.turn}`] : HINTS[mode];
      emit({ type: 'start', ...(hint ? { hint } : {}) });
    },
    stop(toP, toL) {
      st.from.p.copy(toP || st.home.p); st.from.l.copy(toL || st.home.l); st.active = false; st.arc = 8; drag.on = false; emit({ type: 'stop' });
      if (st.mode === 'shootout' && so && !so.done) soAbandon();
    },
    update,
    apply,
    down(x, y) {
      if (!st.active || st.k < 0.95) return false;
      if (st.mode === 'shootout' && (so?.done || st.phase === 'over')) return true;   // decided: nothing to take
      if (keeping()) {
        if (kp.s === 'idle') { if (st.mode === 'keeper') nextKeeperRound(); }
        else if (!kp.dived && kp.s !== 'result') { drag.on = true; drag.pts = [[x, y]]; }
        return true;
      }
      if (st.phase !== 'ready') return false;
      drag.on = true; drag.pts = [[x, y]]; return true;
    },
    move(x, y) { if (drag.on) drag.pts.push([x, y]); },
    up(w, h) {
      if (!drag.on) return false;
      drag.on = false;
      const p = drag.pts, a = p[0], b = p[p.length - 1];
      const dx = b[0] - a[0], dy = a[1] - b[1];
      if (keeping()) { if (Math.hypot(dx, dy) < 24) tapDive(b[0], b[1], w, h); else swipeDive(dx, dy, w, h); return true; }
      if (Math.hypot(dx, dy) < 30 || dy < 10) return true;                       // too short / backwards: not a shot
      // bend: the drag's furthest sideways bulge from the straight line, signed
      const L = Math.hypot(dx, dy) || 1; let dev = 0;
      for (const q of p) { const d = ((q[0] - a[0]) * -(b[1] - a[1]) + (q[1] - a[1]) * (b[0] - a[0])) / L; if (Math.abs(d) > Math.abs(dev)) dev = d; }
      if (st.mode === 'penalties' || st.mode === 'shootout') shoot(dx, dy, -dev / 90, w, h); else shootBall(dx, dy, -dev / 90, w, h);
      return true;
    },
    get dragging() { return drag.on; },
    get shootout() { return so ? soSnap() : null; },
  };
}
