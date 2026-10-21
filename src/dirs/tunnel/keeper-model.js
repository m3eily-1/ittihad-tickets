// The goalkeeper (Ahmed, 2026-10-22: "better hand-built 3D"): a procedural keeper from primitives, in the same
// cel-shaded, outlined style as the rest of the pitch (penalty.js hands over its toon / part / canvasTex helpers).
// Torso, head, long-sleeved arms with gloves, legs and boots, in a purple keeper's kit — never the club's yellow
// and black, so he reads as the other side's man. About 2 m tall; low-poly (capsules and boxes, 8–12 segments).
// Feet at the origin, facing −x (out toward the ball), +z to the shooter's right. Rigged on pivots:
//   body (the dive's tilt, pivoting at the feet) → pelvis → hip → knee → ankle (boot)
//                                                → spine → shoulder → elbow → wrist (glove), neck → head
// animate(q) blends the ready stance (idle sway, side-steps) toward a target: a dive, or a central catch / jump /
// smother by height. reach(frame) is the save check's segment — boots to gloves — read off the posed model.
import * as THREE from 'three';

const THIGH = 0.46, SHIN = 0.46, ANKLE = 0.1, UPPER = 0.33, FORE = 0.3, SPINE_Y = 0.06, SHOULDER_Y = 0.56;
const KIT = 0x6b3ce0, KIT_LT = 0x9d7bff, KIT_DK = 0x281a5c, SKIN = 0xc68a5e, HAIR = 0x2a1a12, BOOT = 0xeceaf4, GLOVE = 0xf7f5ff;
const lerp = THREE.MathUtils.lerp;

/* the poses, per joint: lean (spine forward), side (spine bend toward +z), shrug (shoulders up);
   legs { hf hip flex forward, kb knee bend, ab out to the side, pt toes pointed }; arms { al raised out to the
   side (π = overhead, palm still forward), fw raised forward, el elbow bend }; head { tilt toward +z, nod up } */
const READY = { lean: 0.3, side: 0, shrug: 0, leg: () => ({ hf: 0.55, kb: 1.0, ab: 0.14, pt: 0 }), arm: () => ({ al: 0.55, fw: 0.85, el: 0.95 }), tilt: 0, nod: 0.05 };   // gloves out in front, palms to the ball
const DIVE = (dir) => ({
  lean: 0.06, side: dir * 0.12, shrug: 0.06,
  // the near leg has pushed off and trails straight; the far one is still tucked a little
  leg: (s) => (s === dir ? { hf: 0.16, kb: 0.28, ab: 0.06, pt: 0.9 } : { hf: -0.12, kb: 0.45, ab: 0.2, pt: 0.8 }),
  arm: () => ({ al: Math.PI - 0.14, fw: 0.22, el: 0.08 }),   // both at full stretch over his head, one glove over the other
  tilt: dir * 0.3, nod: 0.1,
});
const HIGH = { lean: 0.05, side: 0, shrug: 0.05, leg: () => ({ hf: 0.2, kb: 0.35, ab: 0.1, pt: 0.6 }), arm: () => ({ al: Math.PI - 0.35, fw: 0.3, el: 0.18 }), tilt: 0, nod: 0.3 };
const MID = { lean: 0.22, side: 0, shrug: 0, leg: () => ({ hf: 0.5, kb: 0.9, ab: 0.16, pt: 0 }), arm: () => ({ al: 0.4, fw: 1.4, el: 0.55 }), tilt: 0, nod: 0.05 };
const LOW = { lean: 0.6, side: 0, shrug: 0, leg: () => ({ hf: 1.15, kb: 1.95, ab: 0.22, pt: 0 }), arm: () => ({ al: 0.18, fw: 0.95, el: 0.25 }), tilt: 0, nod: -0.1 };   // down to smother it, gloves together

export function buildKeeper({ toon, part, canvasTex }) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // the shirt: purple with a lighter chest band and pinstripes, a 1 on the back (u = 0.5 on a capsule is +x, behind him)
  const shirtTex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#6b3ce0'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#8460f4'; x.fillRect(0, h * 0.34, w, h * 0.26);
    x.fillStyle = '#281a5c'; for (let i = 0; i < 3; i++) x.fillRect(0, h * (0.36 + i * 0.09), w, 2);
    x.fillRect(0, 0, w, 7);                                                                    // the collar
    x.font = '700 58px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 5; x.strokeStyle = '#281a5c'; x.fillStyle = '#f7f5ff';
    x.strokeText('1', w * 0.5, h * 0.5); x.fillText('1', w * 0.5, h * 0.5);
    x.font = '700 20px Anton, Impact, sans-serif'; x.fillText('1', w * 0.9, h * 0.22);          // small on the chest
  });
  const shirt = toon(KIT, shirtTex), sleeve = toon(KIT), dark = toon(KIT_DK), trim = toon(KIT_LT);
  const skin = toon(SKIN), hair = toon(HAIR), boot = toon(BOOT), glove = toon(GLOVE), eye = toon(0x1a1420);

  const pelvis = new THREE.Group(); body.add(pelvis);
  part(pelvis, new THREE.CylinderGeometry(0.2, 0.185, 0.22, 10), dark);                         // shorts
  // legs: thigh, sock to the knee, boot — hip → knee → ankle pivots
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0, -0.04, s * 0.11); pelvis.add(hip);
    part(hip, new THREE.CylinderGeometry(0.112, 0.102, 0.22, 9), dark).position.y = -0.07;    // a shorts leg
    part(hip, new THREE.CapsuleGeometry(0.083, THIGH - 0.12, 3, 8), skin).position.y = -THIGH / 2;
    const knee = new THREE.Group(); knee.position.y = -THIGH; hip.add(knee);
    part(knee, new THREE.CapsuleGeometry(0.07, SHIN - 0.1, 3, 8), sleeve).position.y = -SHIN / 2;
    part(knee, new THREE.CylinderGeometry(0.077, 0.077, 0.05, 9), glove, 0).position.y = -0.05;  // the sock's white top
    const ankle = new THREE.Group(); ankle.position.y = -SHIN; knee.add(ankle);
    const bt = part(ankle, new THREE.BoxGeometry(0.27, 0.09, 0.11), boot); bt.position.set(-0.06, -0.05, 0);
    part(ankle, new THREE.BoxGeometry(0.28, 0.025, 0.116), dark, 0).position.set(-0.06, -0.098, 0);
    part(ankle, new THREE.BoxGeometry(0.1, 0.092, 0.114), trim, 0).position.set(-0.02, -0.05, 0);   // the stripe
    legs.push({ s, hip, knee, ankle, boot: bt });
  }
  // the torso, leaning from the waist: shirt, neck, head
  const spine = new THREE.Group(); spine.position.y = SPINE_Y; pelvis.add(spine);
  const torso = part(spine, new THREE.CapsuleGeometry(0.19, 0.3, 4, 12), shirt); torso.position.y = 0.3; torso.scale.set(0.72, 1, 1.14);
  part(spine, new THREE.CylinderGeometry(0.055, 0.062, 0.12, 8), skin).position.y = 0.68;
  const head = new THREE.Group(); head.position.y = 0.74; spine.add(head);
  const skull = part(head, new THREE.SphereGeometry(0.125, 12, 9), skin); skull.position.y = 0.08; skull.scale.set(1, 1.1, 0.94);
  const cap = part(head, new THREE.SphereGeometry(0.132, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0); cap.position.set(0.012, 0.1, 0); cap.rotation.z = -0.25;
  part(head, new THREE.BoxGeometry(0.04, 0.05, 0.03), skin, 0).position.set(-0.125, 0.06, 0);       // the nose
  for (const s of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.03, 6, 5), skin, 0).position.set(0, 0.07, s * 0.118);      // ears
    part(head, new THREE.SphereGeometry(0.016, 6, 5), eye, 0).position.set(-0.112, 0.1, s * 0.045);  // eyes
    const brow = part(head, new THREE.BoxGeometry(0.015, 0.014, 0.05), hair, 0); brow.position.set(-0.115, 0.135, s * 0.047); brow.rotation.x = s * 0.18;
  }
  const crown = new THREE.Object3D(); crown.position.y = 0.22; head.add(crown);
  // arms: long sleeves, gloves with a purple back and a lilac cuff — shoulder → elbow → wrist pivots
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0, SHOULDER_Y, s * 0.25); spine.add(sh);
    part(sh, new THREE.SphereGeometry(0.09, 10, 8), sleeve);
    part(sh, new THREE.CapsuleGeometry(0.066, UPPER - 0.1, 3, 8), sleeve).position.y = -UPPER / 2;
    const el = new THREE.Group(); el.position.y = -UPPER; sh.add(el);
    part(el, new THREE.CapsuleGeometry(0.058, FORE - 0.1, 3, 8), sleeve).position.y = -FORE / 2;
    const wr = new THREE.Group(); wr.position.y = -FORE; el.add(wr);
    part(wr, new THREE.CylinderGeometry(0.066, 0.07, 0.08, 9), trim).position.y = -0.01;
    const palm = part(wr, new THREE.BoxGeometry(0.07, 0.17, 0.135), glove); palm.position.set(-0.005, -0.12, 0);   // palm to −x
    part(wr, new THREE.BoxGeometry(0.03, 0.13, 0.12), sleeve, 0).position.set(0.038, -0.115, 0);                // the backhand
    const thumb = part(wr, new THREE.CapsuleGeometry(0.026, 0.06, 2, 6), glove); thumb.position.set(-0.03, -0.08, -s * 0.075); thumb.rotation.x = s * 0.6;
    const grip = new THREE.Object3D(); grip.position.y = -0.12; wr.add(grip);
    arms.push({ s, sh, el, wr, grip });
  }

  const legH = (l) => (THIGH * Math.cos(l.hf) + SHIN * Math.cos(l.hf - l.kb)) * Math.cos(l.ab) + ANKLE;
  const footX = (l) => -THIGH * Math.sin(l.hf) + SHIN * Math.sin(l.kb - l.hf);
  /* k: 0 the ready stance → 1 the target (eased by the caller); dir: the dive (±1, 0 none); hgt: the ball's height
     as he reads it; ph / amt: the side-step's phase and how much he's moving; t: time, for the idle sway */
  function animate({ t = 0, k = 0, dir = 0, hgt = 1, ph = 0, amt = 0 }) {
    const T = dir ? DIVE(dir) : hgt > 1.55 ? HIGH : hgt < 0.8 ? LOW : MID;
    const idle = 1 - k, pulse = Math.sin(t * 5.2) * idle;                  // bouncing on his toes
    const shift = Math.sin(t * 1.6) * idle;                                // the weight going side to side
    spine.rotation.set(lerp(READY.side, T.side, k) - shift * 0.035, 0, lerp(READY.lean, T.lean, k) + pulse * 0.02);
    const sup = [];
    for (const L of legs) {
      const a = READY.leg(L.s), b = T.leg(L.s);
      const l = { hf: lerp(a.hf, b.hf, k), kb: lerp(a.kb, b.kb, k) + pulse * 0.07, ab: lerp(a.ab, b.ab, k), pt: lerp(a.pt, b.pt, k) };
      // a side-step: the feet come off the grass in turn, and the stance opens and closes
      const lift = Math.max(0, Math.sin(ph + (L.s > 0 ? 0 : Math.PI))) * amt * idle;
      l.hf += lift * 0.28; l.kb += lift * 0.55; l.ab += Math.sin(ph) * L.s * 0.06 * amt * idle;
      L.hip.rotation.set(-L.s * l.ab, 0, -l.hf);
      L.knee.rotation.z = l.kb;
      L.ankle.rotation.z = l.hf - l.kb + l.pt;                               // sole flat on the grass unless the toes point
      sup.push(l);
    }
    // the pelvis rides on the straighter leg, over its foot
    const s0 = legH(sup[0]) >= legH(sup[1]) ? sup[0] : sup[1];
    pelvis.position.set(-footX(s0) * idle, legH(s0) + 0.04 * Math.cos(s0.ab), shift * 0.03);
    for (const A of arms) {
      const a = READY.arm(A.s), b = T.arm(A.s);
      A.sh.position.y = SHOULDER_Y + lerp(READY.shrug, T.shrug, k);
      A.sh.rotation.set(-A.s * lerp(a.al, b.al, k), 0, -lerp(a.fw, b.fw, k));
      A.el.rotation.z = -(lerp(a.el, b.el, k) + pulse * 0.08);
      A.wr.rotation.z = lerp(0.2, 0, k);                                    // palms up to the ball when set
    }
    head.rotation.set(lerp(READY.tilt, T.tilt, k), 0, -lerp(READY.nod, T.nod, k) - spine.rotation.z * 0.85);
  }

  /* the save check's segment in `frame`'s space, along his body: from between his boots to whichever of the
     gloves' midpoint and the top of his head is further away (padded by the caller). Matched against the tiger's old
     fixed 2.95 m reach by simulation (40k penalties): saves 28.4% vs 29.0%, every height / width band within a few points */
  const _m = new THREE.Matrix4(), _g = new THREE.Vector3(), _h = new THREE.Vector3(), _b0 = new THREE.Vector3(), _b1 = new THREE.Vector3();
  function reach(frame, feet = new THREE.Vector3(), hands = new THREE.Vector3()) {
    root.updateWorldMatrix(true, true);
    _m.copy(frame.matrixWorld).invert();
    _g.setFromMatrixPosition(arms[0].grip.matrixWorld).add(_h.setFromMatrixPosition(arms[1].grip.matrixWorld)).multiplyScalar(0.5).applyMatrix4(_m);
    _h.setFromMatrixPosition(crown.matrixWorld).applyMatrix4(_m);
    _b0.setFromMatrixPosition(legs[0].boot.matrixWorld).applyMatrix4(_m);
    _b1.setFromMatrixPosition(legs[1].boot.matrixWorld).applyMatrix4(_m);
    feet.copy(_b0).add(_b1).multiplyScalar(0.5);
    hands.copy(feet.distanceToSquared(_g) > feet.distanceToSquared(_h) ? _g : _h);
    return { feet, hands };
  }

  // how far his gloves reach from his feet at full stretch, along his body
  animate({ k: 1, dir: 1 });
  body.rotation.set(0, 0, 0); root.updateWorldMatrix(true, true);
  const stretch = arms.reduce((y, A) => y + A.grip.getWorldPosition(_g).applyMatrix4(_m.copy(root.matrixWorld).invert()).y, 0) / 2;
  animate({ k: 0 });

  return { root, body, pelvis, spine, head, legs, arms, animate, reach, stretch };
}
