// Taking a shirt off its hook (Ahmed, 2026-10-21: "tap a shirt: take it off the hook, see the player card, try it
// on"). Shared by both locker rooms (changing.js, lockerroom.js): the room's update loop calls lift.update(t,
// camera) each frame. take(no) lifts that player's shirt up off the hook and flies it to a spot in front of the
// camera (anchor: where on screen, in NDC, and how much of the view's height it fills), turned to show its back;
// print({ name, no }) repaints it with your name while you try it on; hang() flies it back and restores it.
import * as THREE from 'three';

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mapOf = (m) => (m.uniforms?.uMap ? m.uniforms.uMap.value : m.map);
const setMap = (m, t) => { if (m.uniforms?.uMap) { m.uniforms.uMap.value = t; m.uniforms.uUse && (m.uniforms.uUse.value = t ? 1 : 0); } else { m.map = t; m.needsUpdate = true; } };

export function shirtLift(items, { img = null, paint = null } = {}) {
  const byNo = new Map(items.filter((it) => it.shirt).map((it) => [it.data.no, it]));
  let cur = null;         // { it, k, dir, saved, hookP, hookQ, hookS, h, anchor, map0, custom }
  let hoverNo = null, lastT = null;
  const P = new THREE.Vector3(), B = new THREE.Vector3(), Q = new THREE.Quaternion(), QB = new THREE.Quaternion(), S = new THREE.Vector3();
  const M = new THREE.Matrix4(), INV = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), YAW = new THREE.Quaternion();

  function restore() {
    if (!cur) return;
    const { it, saved } = cur, s = it.shirt;
    s.position.copy(saved.p); s.quaternion.copy(saved.q); s.scale.copy(saved.s);
    if (cur.custom) { setMap(s.material, cur.map0); cur.custom.dispose(); }
    s.renderOrder = saved.ro;
    cur = null;
  }
  const api = {
    get taken() { return cur ? cur.it.data.no : null; },
    get busy() { return !!cur; },
    get hoverNo() { return hoverNo; },
    owns: (it) => !!cur && cur.it === it,
    has: (no) => byNo.has(no),
    hover(no) { hoverNo = no ?? null; },
    // anchor: { x, y } in NDC (−1…1) and h, the share of the view's height the shirt fills
    take(no, anchor = {}) {
      const it = byNo.get(no);
      if (!it) return false;
      if (cur && cur.it !== it) restore();
      if (cur) { cur.dir = 1; Object.assign(cur.anchor, anchor); return true; }
      const s = it.shirt;
      s.updateWorldMatrix(true, false);
      const hookP = new THREE.Vector3(), hookQ = new THREE.Quaternion(), hookS = new THREE.Vector3();
      s.matrixWorld.decompose(hookP, hookQ, hookS);
      if (!s.geometry.boundingBox) s.geometry.computeBoundingBox();
      const bb = s.geometry.boundingBox, h = (bb.max.y - bb.min.y) * hookS.y;
      cur = { it, k: 0, dir: 1, saved: { p: s.position.clone(), q: s.quaternion.clone(), s: s.scale.clone(), ro: s.renderOrder }, hookP, hookQ, hookS, h,
        anchor: { x: -0.4, y: -0.02, h: 0.62, ...anchor }, map0: mapOf(s.material), custom: null };
      s.renderOrder = 2;   // drawn over the room it passes in front of
      return true;
    },
    hang() { if (cur) cur.dir = -1; },
    reset() { restore(); },
    // your name on it while you try it on; null puts his own back
    print(p) {
      if (!cur || !img || !paint) return;
      const m = cur.it.shirt.material;
      const old = cur.custom;
      if (p) { cur.custom = paint(img, { ...cur.it.data, shirt: p.name || 'YOUR NAME', no: p.no === '' || p.no == null ? '00' : p.no }); setMap(m, cur.custom); }
      else { cur.custom = null; setMap(m, cur.map0); }
      old?.dispose();
    },
    update(t, camera) {
      const dt = lastT == null ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      if (!cur) return;
      cur.k = Math.min(1, Math.max(0, cur.k + cur.dir * dt / 0.8));
      if (cur.k <= 0 && cur.dir < 0) { restore(); return; }
      const s = cur.it.shirt, e = ease(cur.k), A = cur.anchor;
      // in front of the camera, sized to fill A.h of the view's height
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV()) / 2);
      const d = cur.h / (A.h * 2 * tan);
      B.set(A.x * d * tan * camera.aspect, A.y * d * tan, -d).applyMatrix4(camera.matrixWorld);
      camera.getWorldQuaternion(QB);
      // a slow turn as it floats, so it reads as cloth in the air, not a sticker on the screen
      YAW.setFromAxisAngle(UP, (0.16 + Math.sin(t * 0.9) * 0.1) * e); QB.multiply(YAW);
      // up off the hook first, then out to you
      P.copy(cur.hookP).addScaledVector(UP, 0.16 * smooth(0, 0.35, cur.k)).lerp(B, e);
      Q.slerpQuaternions(cur.hookQ, QB, e);
      S.copy(cur.hookS);
      M.compose(P, Q, S);
      s.parent.updateWorldMatrix(true, false);
      INV.copy(s.parent.matrixWorld).invert();
      M.premultiply(INV).decompose(s.position, s.quaternion, s.scale);
    },
  };
  return api;
}
