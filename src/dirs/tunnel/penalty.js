// Penalties while you wait (Ahmed, 2026-10-12): the virtual queue for the first match lets you into the
// stadium, and while you wait for your turn you can take penalties on the real pitch. Drag from the ball
// toward the goal to shoot — direction aims, length sets the power (and height), a curved drag bends it.
// The keeper is the club mascot, the tiger (Ahmed's reference image), hand-built here in a cartoon style
// with outlines: he reads your shot after a beat and dives — corners, especially high ones, beat him.
// Rounds of five; a goal scores 1, 2 for a side, 3 for a corner.
import * as THREE from 'three';

const GOAL_X = 52.5, POST_Z = 3.66, BAR_Y = 2.44, SPOT_X = GOAL_X - 11;
const KEEPER_X = GOAL_X - 0.45;
const CAM = { p: new THREE.Vector3(SPOT_X - 5.2, 1.75, 0), l: new THREE.Vector3(GOAL_X, 1.05, 0) };
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

  // legs: black shorts, striped socks, black boots with white
  for (const s of [-1, 1]) {
    const thigh = part(body, new THREE.CapsuleGeometry(0.15, 0.32, 4, 10), black); thigh.position.set(0.02, 0.78, s * 0.2); thigh.rotation.z = 0.15;
    const shin = part(body, new THREE.CapsuleGeometry(0.11, 0.3, 4, 10), yellow); shin.position.set(-0.04, 0.36, s * 0.22);
    const boot = part(body, new THREE.BoxGeometry(0.34, 0.14, 0.17), black); boot.position.set(-0.1, 0.08, s * 0.22);
    const sole = part(body, new THREE.BoxGeometry(0.36, 0.04, 0.18), white, 0); sole.position.set(-0.1, 0.01, s * 0.22);
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
  return { root, body, arms, head, mouth };
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

export function createPenaltyGame(parent) {
  const group = new THREE.Group(); group.visible = false; parent.add(group);
  const net = parent.userData.goals?.[1];   // the goal you shoot at, for the net bulge
  const mascot = buildMascot();
  mascot.root.position.set(KEEPER_X, 0, 0);
  group.add(mascot.root);
  const ball = buildBall(); group.add(ball);
  // the spot
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), new THREE.MeshBasicMaterial({ color: 0xf2f2ee })); spot.rotation.x = -Math.PI / 2; spot.position.set(SPOT_X, 0.035, 0); group.add(spot);

  const st = {
    active: false, k: 0, phase: 'ready',  // ready · flight · result
    t: 0, from: { p: new THREE.Vector3(), l: new THREE.Vector3() },
    shot: null, keep: null, result: null, resultT: 0,
    round: [], best: 0, goals: 0, shots: 0,
  };
  try { st.best = +localStorage.getItem('itt-pen-best') || 0; } catch { /* private mode */ }
  let listener = null;
  const emit = (e) => listener?.({ ...e, round: st.round.slice(), best: st.best, goals: st.goals, shots: st.shots });

  function resetBall() { ball.position.set(SPOT_X, 0.11, 0); ball.rotation.set(0, 0, 0); }
  resetBall();

  /* the keeper's dive: direction along the goal line (z), height, progress */
  const keeper = { z: 0, y: 1.0, k: 0, dir: 0, t: 0, react: 0.2 };
  function poseKeeper(time) {
    const m = mascot, kk = ease(Math.min(1, keeper.k));
    const sway = st.phase === 'ready' ? Math.sin(time * 3) * 0.12 : 0;               // shuffling on his line
    const dz = keeper.dir * Math.min(Math.abs(keeper.z), 2.4) * kk;
    m.root.position.set(KEEPER_X, Math.max(0, (keeper.y - 1.0) * 0.8) * Math.sin(kk * Math.PI * 0.9), dz + sway);
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

  /* shooting: a drag in screen pixels (dx right, dy up), its length and how much it curved */
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
  function finish(result, pts) {
    st.phase = 'result'; st.result = result; st.resultT = 0;
    if (result === 'goal') { st.goals++; net?.hit(ball.position.z, ball.position.y); }
    st.round.push(pts);
    let roundOver = false;
    if (st.round.length >= 5) {
      const total = st.round.reduce((a, b) => a + b, 0);
      if (total > st.best) { st.best = total; try { localStorage.setItem('itt-pen-best', String(total)); } catch { /* private */ } }
      roundOver = true;
    }
    emit({ type: 'result', result, pts, roundOver, roundTotal: st.round.reduce((a, b) => a + b, 0) });
  }
  const placement = (z, y) => { const az = Math.abs(z); return az > 2.5 && (y > 1.6 || y < 0.55) ? 3 : az > 1.5 ? 2 : 1; };

  function update(dt, time) {
    if (!group.visible) return;
    net?.update(dt, time);
    poseKeeper(time);
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
      if (s.saved) { finish('saved', 0); st.deflect = { v: s.deflect.clone(), p: ball.position.clone() }; }
      else if (u >= 1) {
        const inGoal = Math.abs(ball.position.z) < POST_Z - 0.11 && ball.position.y < BAR_Y - 0.11;
        finish(inGoal ? 'goal' : 'miss', inGoal ? placement(ball.position.z, ball.position.y) : 0);
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
      if (st.resultT > 1.6) {
        st.phase = 'ready'; st.deflect = null;
        keeper.k = 0; keeper.dir = 0;
        resetBall();
        if (st.round.length >= 5) st.round = [];
        emit({ type: 'ready' });
      }
    }
  }

  /* camera: fly down behind the spot and back */
  function apply(dt, P, Lk) {
    if (!st.active && st.k <= 0) return false;
    st.k = THREE.MathUtils.clamp(st.k + (st.active ? dt : -dt) / 1.8, 0, 1);
    const e = ease(st.k);
    if (st.k <= 0) { group.visible = false; return false; }
    const mid = new THREE.Vector3().lerpVectors(st.from.p, CAM.p, 0.5); mid.y = Math.max(st.from.p.y, CAM.p.y) + 8;
    const a = 1 - e;
    P.set(0, 0, 0).addScaledVector(st.from.p, a * a).addScaledVector(mid, 2 * a * e).addScaledVector(CAM.p, e * e);
    Lk.lerpVectors(st.from.l, CAM.l, ease(Math.min(1, st.k * 1.2)));
    return true;
  }

  /* drag input */
  const drag = { on: false, pts: [] };
  return {
    group,
    get active() { return st.active; },
    get phase() { return st.phase; },
    onChange(fn) { listener = fn; },
    start(fromP, fromL) {
      st.from.p.copy(fromP); st.from.l.copy(fromL);
      st.active = true; group.visible = true; st.phase = 'ready'; resetBall(); keeper.k = 0; keeper.dir = 0;
      emit({ type: 'start' });
    },
    stop(toP, toL) { if (toP) { st.from.p.copy(toP); st.from.l.copy(toL); } st.active = false; emit({ type: 'stop' }); },
    update,
    apply,
    down(x, y) { if (!st.active || st.k < 0.95 || st.phase !== 'ready') return false; drag.on = true; drag.pts = [[x, y]]; return true; },
    move(x, y) { if (drag.on) drag.pts.push([x, y]); },
    up(w, h) {
      if (!drag.on) return false;
      drag.on = false;
      const p = drag.pts, a = p[0], b = p[p.length - 1];
      const dx = b[0] - a[0], dy = a[1] - b[1];
      if (Math.hypot(dx, dy) < 30 || dy < 10) return true;                       // too short / backwards: not a shot
      // bend: the drag's furthest sideways bulge from the straight line, signed
      const L = Math.hypot(dx, dy) || 1; let dev = 0;
      for (const q of p) { const d = ((q[0] - a[0]) * -(b[1] - a[1]) + (q[1] - a[1]) * (b[0] - a[0])) / L; if (Math.abs(d) > Math.abs(dev)) dev = d; }
      shoot(dx, dy, -dev / 90, w, h);
      return true;
    },
    get dragging() { return drag.on; },
  };
}
