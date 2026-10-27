// Realistic fans (Ahmed, 2026-10-27: "the model is not yet so good" → try real human models). Four people from the
// Microsoft Rocketbox library (MIT, public/models/fans/LICENSE-Rocketbox.txt): rigged, with real faces and hands.
// Here they are posed in the stadium's seats (each bone aimed at the same joints fans.js uses) and baked into static
// meshes, one per pose frame, then dressed: the store's home kit printed over two of the men's shirts, the thobe and
// shemagh as they come (or a white ghutra), the woman's dress and scarf turned into a black abaya and hijab.
//
//   const R = await loadRocketbox()      → { looks: [...], geometry(look, frame), material(fog, { bake }) }
//
// Geometry is in the seat frame of fans.js: metres, on the tread at the seat's pan centre, facing +z (the pitch).
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { kitsReady, kitTexture } from './fans.js';

const DIR = '/models/fans/';
const PEOPLE = {
  m09: { file: 'Male_Adult_09', tex: ['m017_body_color.jpg', 'm017_head_color.jpg', 'm017_opacity_color.png'] },
  m20: { file: 'Male_Adult_20', tex: ['m027_body_color.jpg', 'm027_head_color.jpg', null] },
  m19: { file: 'Male_Adult_19', tex: ['m250_body_color.jpg', 'm250_head_color.jpg', 'm250_keffiyeh_color.jpg'] },
  f06: { file: 'Female_Adult_06', tex: ['f202_body_color.jpg', 'f202_head_color.jpg', 'f202_opacity_color.png'] },
};
// dress: 0 as they come · 1 the home kit over the shirt · 2 the Captain's Shirt print on the back · 3 abaya + hijab
// white: the shemagh's red check taken out (a white ghutra); sleeve: how far out the kit's sleeves reach (T-pose |x|, m)
// The home kit over a thobe, with a shemagh or a ghutra, is the commonest look in the stands.
export const RB_LOOKS = [
  { person: 'm19', dress: 1, tone: 1.0, sleeve: 0.42, white: 0, w: 0.2 },
  { person: 'm19', dress: 1, tone: 0.84, sleeve: 0.42, white: 1, w: 0.22 },
  { person: 'm19', dress: 0, tone: 0.92, sleeve: 0, white: 0, w: 0.12 },
  { person: 'm19', dress: 0, tone: 0.8, sleeve: 0, white: 1, w: 0.16 },
  { person: 'f06', dress: 3, tone: 1.0, sleeve: 0, white: 0, w: 0.08 },
  { person: 'm20', dress: 1, tone: 0.8, sleeve: 0.62, white: 0, w: 0.14 },
  { person: 'm09', dress: 2, tone: 0.75, sleeve: 0.62, white: 0, w: 0.08 },
];
// the nearest of these to an avatar (avatar.js look values: skin, outfit, head, beard)
export function rbLookOf([, outfit, head]) {
  if (outfit === 4 || head === 4) return 4;
  if (outfit === 3) return head === 3 ? 2 : 3;
  if (outfit === 1) return 6;
  return head === 3 ? 0 : head === 2 ? 1 : 5;
}

/* ── posing: aim each bone so its child lands on a target, in the seat frame ── */
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
function aimAt(bone, child, target) {
  bone.updateWorldMatrix(true, true);
  const a = bone.getWorldPosition(v1), b = child.getWorldPosition(v2);
  const cur = b.sub(a).normalize(), want = target.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(cur, want);
  const wq = bone.getWorldQuaternion(q1), pq = bone.parent.getWorldQuaternion(q2);
  bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
  bone.updateWorldMatrix(false, true);
}
function turn(bone, axis, angle) {
  // rotate a bone about a world axis
  bone.updateWorldMatrix(true, false);
  const wq = bone.getWorldQuaternion(q1).clone(), pq = bone.parent.getWorldQuaternion(q2).clone();
  const r = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  bone.quaternion.copy(pq.invert().multiply(r.multiply(wq)));
  bone.updateWorldMatrix(false, true);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the frames' joints (as in fans.js): elbow, wrist per side in the body frame; lean of the upper body
const ARMS = {
  relaxed: [V(0.23, 0.17, 0.07), V(0.15, 0.13, 0.33)], lean: [V(0.21, 0.16, 0.16), V(0.08, 0.27, 0.34)],
  clapA: [V(0.25, 0.22, 0.17), V(0.13, 0.4, 0.36)], clapB: [V(0.23, 0.23, 0.19), V(0.035, 0.43, 0.39)],
  cheerA: [V(0.33, 0.74, 0.05), V(0.39, 1.02, 0.08)], cheerB: [V(0.28, 0.77, 0.03), V(0.26, 1.06, 0.02)],
  scarf: [V(0.36, 0.72, 0.1), V(0.33, 0.99, 0.12)], standA: [V(0.32, 0.74, 0.06), V(0.37, 1.02, 0.08)],
};
const ARM_R = { phone: [V(0.26, 0.62, 0.22), V(0.17, 0.86, 0.36)], standB: [V(0.27, 0.72, 0.1), V(0.22, 0.99, 0.12)] };
const ARM_L = { phone: ARMS.relaxed, standB: [V(0.22, 0.2, 0.06), V(0.2, -0.04, 0.12)] };
const LEAN = { relaxed: -0.06, lean: 0.36, clapA: 0.08, clapB: 0.08, cheerA: -0.02, cheerB: -0.02, phone: 0.02, scarf: -0.03, standA: 0.02, standB: 0.04 };

function pose(rig, frame) {
  // the rig stays in the file's own space (centimetres; boneInverses were made there); targets come from the seat frame
  const { bones: B, root } = rig;
  const toN = (p) => p.clone().applyMatrix4(rig.Ci), toS = (p) => p.clone().applyMatrix4(rig.C);
  const ax = (a) => a.clone().applyQuaternion(rig.Rinv);
  const wp = (b) => b.getWorldPosition(new THREE.Vector3());
  rig.skeleton.pose();
  root.position.set(0, 0, 0); root.updateWorldMatrix(true, true);
  const standing = frame.startsWith('stand');
  // the pelvis onto the seat (or standing on the tread)
  const hipT = standing ? V(0, 0.98, 0) : V(0, 0.665, -0.05);   // the pelvis bone sits above the seat of the trousers
  root.position.add(toN(hipT).sub(wp(B.Bip01_Pelvis))); root.updateWorldMatrix(true, true);
  // legs: thigh to the knee, shin to the ankle, foot flat and forward
  for (const s of ['L', 'R']) {
    const th = B[`Bip01_${s}_Thigh`], ca = B[`Bip01_${s}_Calf`], ft = B[`Bip01_${s}_Foot`], toe = B[`Bip01_${s}_Toe0`];
    const hp = toS(wp(th));
    const K = standing ? V(hp.x, 0.5, 0.05) : V(hp.x * 1.1, 0.6, 0.4), A = standing ? V(hp.x, 0.02, 0.0) : V(hp.x * 1.2, 0.02, 0.47);   // soles on the tread
    aimAt(th, ca, toN(K)); aimAt(ca, ft, toN(A));
    aimAt(ft, toe, toN(toS(wp(ft)).add(V(0, -0.05, 0.14))));
  }
  // upper body: lean from the spine, head level-ish
  const lean = LEAN[frame];
  turn(B.Bip01_Spine, ax(V(1, 0, 0)), lean * 0.6); turn(B.Bip01_Spine1, ax(V(1, 0, 0)), lean * 0.4);
  turn(B.Bip01_Head, ax(V(1, 0, 0)), -lean * 0.5 + 0.05);
  // arms: shoulder → elbow → wrist along the frame's joint directions, the hand on along the forearm
  const Q = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), lean);
  const body = (p) => p.clone().applyQuaternion(Q).add(hipT);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const tbl = sx < 0 ? ARM_R : ARM_L;
    const [e, w] = tbl[frame] || ARMS[frame] || ARMS.relaxed;
    const ua = B[`Bip01_${s}_UpperArm`], fa = B[`Bip01_${s}_Forearm`], hd = B[`Bip01_${s}_Hand`], f2 = B[`Bip01_${s}_Finger2`];
    const E = body(V(sx * e.x, e.y, e.z)), W = body(V(sx * w.x, w.y, w.z));
    const dE = E.clone().sub(body(V(sx * 0.18, 0.45, 0))), dW = W.clone().sub(E);
    aimAt(ua, fa, toN(toS(wp(ua)).add(dE)));
    aimAt(fa, hd, toN(toS(wp(fa)).add(dW)));
    if (f2) aimAt(hd, f2, toN(toS(wp(hd)).add(dW.clone().normalize().multiplyScalar(0.08))));
  }
  root.updateWorldMatrix(true, true);
  rig.skeleton.update();
}

/* ── baking a pose: skin every vertex on the CPU into a static mesh (positions + normals) ── */
const mA = new THREE.Matrix4(), mS = new THREE.Matrix4(), nM = new THREE.Matrix3();
function bake(rig) {
  const { mesh } = rig, g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const bm = rig.skeleton.boneMatrices, n = P.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    mS.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    for (let k = 0; k < 4; k++) {
      const w = SW.getComponent(i, k); if (!w) continue;
      mA.fromArray(bm, SI.getComponent(i, k) * 16);
      for (let e = 0; e < 16; e++) mS.elements[e] += mA.elements[e] * w;
    }
    mS.multiply(mesh.bindMatrix).premultiply(rig.C);   // bone matrices are already world: skinned = Σ w·bone·bind·v, then to the seat frame
    v.fromBufferAttribute(P, i).applyMatrix4(mS);
    nM.getNormalMatrix(mS); nn.fromBufferAttribute(N, i).applyMatrix3(nM).normalize();
    pos.set([v.x, v.y, v.z], i * 3); nor.set([nn.x, nn.y, nn.z], i * 3);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', g.attributes.uv);
  out.setAttribute('aBind', rig.bindPos);
  out.setAttribute('aMat', rig.matIdx);
  out.computeBoundingSphere();
  return out;
}

/* ── loading ── */
let ready = null;
export function loadRocketbox() {
  if (ready) return ready;
  ready = (async () => {
    // the FBX files name their original 2K .tga textures; we bring our own small JPGs, so those requests get a blank pixel
    const blank = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const quiet = new THREE.LoadingManager(); quiet.setURLModifier((u) => (/\.tga$/i.test(u) ? blank : u));
    const L = new FBXLoader(quiet), T = new THREE.TextureLoader();
    const tex = (f) => (f ? T.loadAsync(DIR + f).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.flipY = true; t.anisotropy = 4; return t; }) : Promise.resolve(null));
    const rigs = {};
    await Promise.all(Object.entries(PEOPLE).map(async ([key, p]) => {
      const [obj, ...maps] = await Promise.all([L.loadAsync(DIR + p.file + '.fbx'), ...p.tex.map(tex)]);
      let mesh = null; obj.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
      // native space is centimetres; C takes it to the seat frame (metres, facing +z, the pitch)
      const root = new THREE.Group(); root.add(obj);
      root.updateWorldMatrix(true, true);
      const bones = Object.fromEntries(mesh.skeleton.bones.map((b) => [b.name, b]));
      const eye = bones.Bip01_LEye.getWorldPosition(new THREE.Vector3()), head = bones.Bip01_Head.getWorldPosition(new THREE.Vector3());
      const R = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), eye.z < head.z ? Math.PI : 0);
      const C = new THREE.Matrix4().compose(new THREE.Vector3(), R, new THREE.Vector3(0.01, 0.01, 0.01)), Ci = C.clone().invert();
      // the bind pose (T-pose, metres, facing +z) — the kit is projected in it
      const P = mesh.geometry.attributes.position, bp = new Float32Array(P.count * 3), v = new THREE.Vector3();
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(C); bp.set([v.x, v.y, v.z], i * 3); }
      // which material each vertex wears (body · head · extra)
      const mi = new Float32Array(P.count);
      for (const gr of mesh.geometry.groups) mi.fill(gr.materialIndex, gr.start, gr.start + gr.count);
      rigs[key] = { mesh, root, skeleton: mesh.skeleton, bones, maps, C, Ci, Rinv: R.clone().invert(), bindPos: new THREE.BufferAttribute(bp, 3), matIdx: new THREE.BufferAttribute(mi, 1) };
    }));
    await kitsReady;
    const cache = new Map();
    return {
      looks: RB_LOOKS,
      rigs,
      geometry(look, frame) {
        const L2 = RB_LOOKS[look], k = `${L2.person}|${frame}`;
        if (!cache.has(k)) { const r = rigs[L2.person]; pose(r, frame); cache.set(k, bake(r)); r.skeleton.pose(); }
        return cache.get(k);
      },
      material(look, fog, opts) { return rbMaterial(rigs[RB_LOOKS[look].person], RB_LOOKS[look], fog, opts); },
    };
  })();
  return ready;
}

/* ── the material: the person's own textures, re-dressed per look; lit like fans.js ── */
function rbMaterial(rig, look, fog, { bake: baking = false } = {}) {
  const [body, head, extra] = rig.maps;
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uBody: { value: body }, uHead: { value: head }, uExtra: { value: extra || head }, uHasExtra: { value: extra ? 1 : 0 },
      uKit: { value: kitTexture }, uDress: { value: look.dress }, uTone: { value: look.tone }, uSleeve: { value: look.sleeve }, uWhite: { value: look.white },
      uFogCol: { value: fog?.color || new THREE.Color() }, uFogD: { value: baking ? 0 : fog?.density || 0 }, uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aBind; attribute float aMat;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vB; varying float vMat;
      void main(){
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vUv = uv; vN = normalize(mat3(m) * normal); vW = w.xyz; vB = aBind; vMat = aMat;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uBody, uHead, uExtra, uKit; uniform float uHasExtra, uDress, uTone, uSleeve, uWhite, uFogD; uniform vec3 uFogCol;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vB; varying float vMat;
      float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
      // skin: warm, red over green over blue, but not olive (green close to red) or grey (all three close)
      bool skinLike(vec3 c){ float gr = c.g / max(c.r, 0.01), br = c.b / max(c.r, 0.01); return c.r > 0.16 && c.r > c.g + 0.035 && gr < 0.86 && gr > 0.45 && br > 0.3 && br < 0.86 && lum(c) > 0.1; }
      void main(){
        vec4 t = vMat < 0.5 ? texture2D(uBody, vUv) : vMat < 1.5 ? texture2D(uHead, vUv) : texture2D(uExtra, vUv);
        if (vMat > 1.5 && uHasExtra > 0.5 && t.a < 0.5) discard;                         // hair cards, eyelashes
        vec3 c = t.rgb;
        // skin: the hands are the ends of the T-pose arms; on the head, warm and saturated (not a white or grey scarf)
        float mx = max(c.r, max(c.g, c.b)), sat = (mx - min(c.r, min(c.g, c.b))) / max(mx, 0.01);
        bool skin = vMat < 0.5 ? (abs(vB.x) > 0.6 || (skinLike(c) && uDress < 2.5)) : (vMat < 1.5 && sat > 0.2 && c.r > c.b);
        // a little variety in skin tone
        if (skin) c *= mix(vec3(1.0), vec3(0.78, 0.7, 0.66), 1.0 - uTone);
        if (uDress > 0.5 && uDress < 2.5 && vMat < 0.5 && !skin && vB.y > 0.95 && vB.y < 1.62 && abs(vB.x) < uSleeve) {
          // the shirt (the body texture between the belt and the collar, arms out in the T-pose)
          float across = abs(vB.x), front = step(0.0, vB.z - 0.0);
          float sleeve = step(0.24, across);
          float kv = clamp((vB.y - 0.97) / 0.55, 0.05, 1.0);   // (the photo's last rows are the studio floor)
          vec3 kit;
          if (uDress < 1.5) {
            kit = sleeve > 0.5 ? vec3(0.86, 0.62, 0.0)
              : front > 0.5 ? texture2D(uKit, vec2((0.5 + clamp(vB.x / 0.23, -1.0, 1.0) * 0.5) * 0.5, kv)).rgb
              : texture2D(uKit, vec2((0.5 - clamp(vB.x / 0.23, -1.0, 1.0) * 0.5) * 0.5, 0.616)).rgb;
          } else {
            kit = (front < 0.5 && sleeve < 0.5) ? texture2D(uKit, vec2(0.5 + (0.5 - clamp(vB.x / 0.25, -1.0, 1.0) * 0.5) * 0.5, kv)).rgb : vec3(0.02);
          }
          // keep the cloth's folds: the old shirt's light and shade over the kit's colour
          c = kit * clamp(0.72 + 1.6 * lum(t.rgb), 0.72, 1.15);
        }
        if (uDress > 2.5 && uDress < 3.5 && !skin) {
          // abaya and hijab: the dress and scarf in black, their folds kept
          c = vec3(0.006, 0.006, 0.0075) + lum(c) * vec3(0.03, 0.03, 0.034);   // (linear light: true black cloth, folds still read)
        }
        if (uWhite > 0.5 && vMat > 1.5 && lum(c) > 0.12) c = vec3(lum(c) * 0.25 + 0.68);     // ghutra: the shemagh's check taken out (the agal stays black)
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        if (dot(n, v) < 0.0) n = -n;
        vec3 L = normalize(vec3(0.25, 1.0, 0.35));
        float diff = max((dot(n, L) + 0.2) / 1.2, 0.0);
        vec3 amb = mix(vec3(0.17, 0.075, 0.045), vec3(0.24, 0.26, 0.31), 0.5 + 0.5 * n.y);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = c * (amb * 1.3 + vec3(1.0, 0.96, 0.9) * diff * 1.05) + vec3(0.75, 0.78, 0.9) * fres * 0.15 * (0.3 + c);
        float dd = length(cameraPosition - vW), f = 1.0 - exp(-dd * dd * uFogD * uFogD);
        gl_FragColor = vec4(mix(col, uFogCol, f), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
