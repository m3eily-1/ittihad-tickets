// Real footballers for the 3D mini-games (Ahmed, 2026-11-01: "i don't like the roblox style" → realistic players).
// The two men from the Microsoft Rocketbox library that the stands already use (rocketbox.js, MIT), rigged with real
// faces and hands, re-dressed as footballers by where things sit on the body (never by colour): the store's home
// shirt, an away kit or a keeper's, shorts, socks and boots, bare arms and knees in the person's own skin tone, a
// name and number on the back. They run, shuffle, kick, crouch and celebrate on their own skeleton, posed by hand each
// frame (no animation files).
//
//   const team = await loadPlayers();
//   const p = team.make({ kit: 'home' | 'away' | 'keeper', person: 0 | 1, name, num });
//   p.g → add to the scene (front is +z) · p.pose({ run, phase, kick, crouch, shuffle, arms, air })
//   team.release(p) when it leaves the scene · team.dispose() when the game closes
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadRocketbox } from './rocketbox.js';
import { kitTexture } from './fans.js';

const PEOPLE = ['m20', 'm09'];          // short hair, no headwear (m19 wears a shemagh, f06 an abaya)
const KITS = {
  // shirt / sleeves are only used by the plain kits; home prints the store's 26/27 shirt (fans.js kit canvas)
  home: { shirt: 0xffd400, shorts: 0x101010, socks: 0x101010, ink: '#ffffff', edge: '#000000' },
  away: { shirt: 0xf2f2f2, shorts: 0x1d4fa3, socks: 0xf2f2f2, ink: '#1d4fa3', edge: null },
  keeper: { shirt: 0x1f9d55, shorts: 0x101010, socks: 0x1f9d55, ink: '#0d0d0d', edge: null },
};
const SLEEVE = 0.36;   // a short sleeve ends this far out along the T-pose arm (m)

/* ── posing helpers (as rocketbox.js): rotate a bone about a world axis; aim a bone so its child lands on a point ── */
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
function turn(bone, axis, angle) {
  if (!angle) return;
  bone.updateWorldMatrix(true, false);
  const wq = bone.getWorldQuaternion(q1), pq = bone.parent.getWorldQuaternion(q2).invert();
  bone.quaternion.copy(pq.multiply(q3.setFromAxisAngle(axis, angle).multiply(wq)));
  bone.updateWorldMatrix(false, true);
}
function aimAt(bone, child, target) {
  bone.updateWorldMatrix(true, true);
  const a = bone.getWorldPosition(v1), b = child.getWorldPosition(v2);
  const q = new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), target.clone().sub(a).normalize());
  const wq = bone.getWorldQuaternion(q1), pq = bone.parent.getWorldQuaternion(q2).invert();
  bone.quaternion.copy(pq.multiply(q.multiply(wq)));
  bone.updateWorldMatrix(false, true);
}

// the person's own skin, from their hands' texels (T-pose: the ends of the arms), for the arms and knees we bare
function skinOf(rig) {
  const img = rig.maps[0]?.image; if (!img) return new THREE.Color(0x9a6a48);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const bp = rig.bindPos.array, uv = rig.mesh.geometry.attributes.uv, mi = rig.matIdx.array;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < uv.count; i += 3) {
    if (mi[i] !== 0 || Math.abs(bp[i * 3]) < 0.66) continue;
    const x = Math.min(c.width - 1, Math.max(0, Math.floor(uv.getX(i) * c.width))), y = Math.min(c.height - 1, Math.max(0, Math.floor((1 - uv.getY(i)) * c.height)));
    const k = (y * c.width + x) * 4; r += px[k]; gg += px[k + 1]; b += px[k + 2]; n++;
  }
  return n ? new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace) : new THREE.Color(0x9a6a48);
}

// the name and number on the back: white on the home stripes with a black edge; the away and keeper kits in their ink
function backTex(name, num, kit) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const K = KITS[kit];
  const draw = (text, size, y) => {
    g.font = `400 ${size}px Anton, Impact, sans-serif`;
    while (g.measureText(text).width > 220 && size > 20) { size -= 4; g.font = `400 ${size}px Anton, Impact, sans-serif`; }
    if (K.edge) { g.strokeStyle = K.edge; g.lineWidth = size / 7; g.strokeText(text, 128, y); }
    g.fillStyle = K.ink; g.fillText(text, 128, y);
  };
  if (name) draw(name.toUpperCase(), 44, 58);
  if (num) draw(String(num), 160, 230);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// the body material: the person's texture, re-dressed in the fragment shader by bind-pose position (metres, facing +z)
function dressMaterial(map, kit, skin, back) {
  const K = KITS[kit];
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.78, metalness: 0 });
  const U = {
    uKit: { value: kitTexture }, uHome: { value: kit === 'home' ? 1 : 0 },
    uShirt: { value: new THREE.Color(K.shirt) }, uShorts: { value: new THREE.Color(K.shorts) }, uSocks: { value: new THREE.Color(K.socks) },
    uSkin: { value: skin }, uBack: { value: back }, uHasBack: { value: back ? 1 : 0 }, uSleeve: { value: SLEEVE },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBind;\nvarying vec3 vB;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvB = aBind;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uKit, uBack; uniform float uHome, uHasBack, uSleeve; uniform vec3 uShirt, uShorts, uSocks, uSkin;
        varying vec3 vB;
        float lumD(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 t = diffuseColor.rgb; float L = lumD(t), ax = abs(vB.x);
          float fold = clamp(0.78 + 2.2 * L, 0.78, 1.12);          // the old clothes' light and shade, kept
          float sk = clamp(0.85 + 1.4 * L, 0.85, 1.1);
          vec3 c = t;
          if (vB.y > 0.95 && vB.y < 1.5 && ax < uSleeve) {
            // the shirt: the store's home shirt printed on (front from its photo, back a row of its stripes), or plain
            float front = step(0.0, vB.z), kv = clamp((vB.y - 0.97) / 0.55, 0.05, 1.0), sleeve = step(0.24, ax);
            vec3 kit = uShirt;
            if (uHome > 0.5) kit = sleeve > 0.5 ? vec3(0.86, 0.62, 0.0)
              : front > 0.5 ? texture2D(uKit, vec2((0.5 + clamp(vB.x / 0.23, -1.0, 1.0) * 0.5) * 0.5, kv)).rgb
              : texture2D(uKit, vec2((0.5 - clamp(vB.x / 0.23, -1.0, 1.0) * 0.5) * 0.5, 0.616)).rgb;
            c = kit * fold;
            if (uHasBack > 0.5 && vB.z < -0.02 && ax < 0.17 && vB.y > 1.06 && vB.y < 1.42) {
              vec4 p = texture2D(uBack, vec2(0.5 - vB.x / 0.34, (vB.y - 1.06) / 0.36));
              c = mix(c, p.rgb, p.a);
            }
          } else if (vB.y > 1.15 && ax >= uSleeve && ax < 0.6) {
            c = uSkin * sk;                                         // bare arms (the hands keep their own texture)
          } else if (vB.y < 1.0 && ax < 0.32) {
            c = vB.y > 0.6 ? uShorts * fold : vB.y > 0.45 ? uSkin * sk : vB.y > 0.1 ? uSocks * fold : vec3(0.02) * fold;   // shorts, knees, socks, boots
          }
          diffuseColor.rgb = c;
        }`);
  };
  m.customProgramCacheKey = () => 'player-dress-v1';
  return m;
}

// the bones a frame poses (reset to the standing pose first)
const POSED = ['Pelvis', 'Spine', 'Spine1', 'Neck', 'Head', 'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot', 'L_UpperArm', 'L_Forearm', 'R_UpperArm', 'R_Forearm'].map((n) => `Bip01_${n}`);
const X = new THREE.Vector3(), Z = new THREE.Vector3(), gq = new THREE.Quaternion();

// each game gets its own team (its own materials, disposed when it closes); the people stay loaded in rocketbox.js
export async function loadPlayers() {
  const RB = await loadRocketbox();
  {
    const src = PEOPLE.map((key) => {
      const rig = RB.rigs[key];
      if (!rig.mesh.geometry.attributes.aBind) rig.mesh.geometry.setAttribute('aBind', rig.bindPos);
      return { rig, skin: skinOf(rig) };
    });
    const mats = new Map(), owned = new Set();
    const matsFor = (pi, kit, name, num) => {
      const { rig, skin } = src[pi], [body, head, extra] = rig.maps;
      const k = `${pi}|${kit}|${name || ''}|${num || ''}`;
      if (!mats.has(k)) {
        const back = name || num ? backTex(name, num, kit) : null;
        const list = [dressMaterial(body, kit, skin, back), new THREE.MeshStandardMaterial({ map: head, roughness: 0.7 })];
        if (extra) list.push(new THREE.MeshStandardMaterial({ map: extra, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
        mats.set(k, { list, back });
      }
      return mats.get(k).list;
    };
    function make({ kit = 'home', person = 0, name = '', num = '' } = {}) {
      const pi = person % src.length, { rig } = src[pi];
      const obj = cloneSkinned(rig.root.children[0]);
      let mesh = null; obj.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
      // back to the bind pose in the file's own space: the stands pose and bake the same people (rocketbox.js) with
      // their root moved, which leaves the bones' local offsets shifted (a player floated 1.7 m up)
      obj.updateMatrixWorld(true); mesh.skeleton.pose();
      const mm = matsFor(pi, kit, name, num);
      mesh.material = mesh.geometry.groups.map((gr) => mm[gr.materialIndex] || mm[0]);
      mesh.frustumCulled = false;
      const holder = new THREE.Group(); holder.applyMatrix4(rig.C); holder.add(obj);
      const g = new THREE.Group(); g.add(holder);
      const bones = {}; mesh.skeleton.bones.forEach((b) => { bones[b.name] = b; });
      // the standing pose: arms down by the sides from the T-pose, elbows soft; stored, and reset to every frame
      g.updateWorldMatrix(true, true);
      for (const [s, sx] of [['L', 1], ['R', -1]]) {
        const ua = bones[`Bip01_${s}_UpperArm`], fa = bones[`Bip01_${s}_Forearm`], hd = bones[`Bip01_${s}_Hand`];
        const sh = ua.getWorldPosition(new THREE.Vector3());
        const el = sh.clone().add(new THREE.Vector3(sx * 0.05, -0.28, -0.01));
        aimAt(ua, fa, el); aimAt(fa, hd, el.clone().add(new THREE.Vector3(sx * 0.01, -0.25, 0.05)));
      }
      const base = POSED.map((n) => bones[n].quaternion.clone());
      const hipY = holder.position.y;
      const p = {
        g, mesh,
        // run 0…1 · phase (radians, the stride) · kick 0…1 (the right foot) · crouch 0…1 · shuffle −1…1 (side-step)
        // arms: 'run' | 'out' (a keeper) | 'up' (celebrating) · air 0…1 (in a jump: knees up)
        pose({ run = 0, phase = 0, kick = 0, crouch = 0, shuffle = 0, arms = 'run', air = 0 } = {}) {
          POSED.forEach((n, i) => bones[n].quaternion.copy(base[i]));
          g.updateWorldMatrix(true, false);
          g.getWorldQuaternion(gq);
          X.set(1, 0, 0).applyQuaternion(gq); Z.set(0, 0, 1).applyQuaternion(gq);
          const bob = Math.abs(Math.cos(phase));
          holder.position.y = hipY + run * (bob * 0.05 - 0.03) - crouch * 0.12;
          // the body leans into the run, or sits into a crouch; the head stays up
          turn(bones.Bip01_Spine, X, run * 0.16 + crouch * 0.25);
          turn(bones.Bip01_Head, X, -(run * 0.12 + crouch * 0.18));
          for (const [side, sg] of [['L', 1], ['R', -1]]) {
            const ph = side === 'L' ? phase : phase + Math.PI, ls = Math.sin(ph), lc = Math.cos(ph);
            // a stride: the thigh swings, the knee folds as the leg comes through; a crouch bends both
            let th = -ls * 0.72 * run * (1 - air * 0.6) - crouch * 0.55 - air * 0.6;
            let kn = run * (0.2 + 1.15 * Math.max(0, lc) ** 1.4) * (1 - air * 0.4) + crouch * 1.0 + air * 1.1;
            if (side === 'R' && kick > 0) {
              // the kick: wind back, then the leg comes through and follows up
              const k = kick;
              th = k < 0.3 ? 0.75 * (k / 0.3) : 0.75 - 2.25 * Math.min(1, (k - 0.3) / 0.45);
              kn = k < 0.3 ? 1.3 * (k / 0.3) : 1.3 * Math.max(0, 1 - (k - 0.3) / 0.35);
            }
            turn(bones[`Bip01_${side}_Thigh`], X, th);
            if (shuffle) turn(bones[`Bip01_${side}_Thigh`], Z, sg * (0.12 + 0.16 * Math.sin(phase * 2) * shuffle * sg));
            turn(bones[`Bip01_${side}_Calf`], X, kn);
            turn(bones[`Bip01_${side}_Foot`], X, -kn * 0.25);
            // arms: against the legs when running; out wide for a keeper; up for a goal
            const ua = bones[`Bip01_${side}_UpperArm`], fa = bones[`Bip01_${side}_Forearm`];
            if (arms === 'up') { turn(ua, Z, sg * 2.7); turn(fa, Z, sg * 0.25); }
            else if (arms === 'out') { turn(ua, Z, sg * 0.85); turn(ua, X, -0.35); turn(fa, X, -0.5); }
            else { turn(ua, X, ls * 0.7 * run - crouch * 0.2); turn(ua, Z, sg * (0.12 + crouch * 0.25)); turn(fa, X, -(0.25 + 1.1 * run)); }
          }
        },
      };
      p.pose();
      owned.add(p);
      return p;
    }
    return {
      make,
      release(p) { if (!p) return; p.g.parent?.remove(p.g); p.mesh.skeleton.dispose(); owned.delete(p); },
      dispose() {
        for (const p of owned) { p.g.parent?.remove(p.g); p.mesh.skeleton.dispose(); }
        owned.clear();
        for (const { list, back } of mats.values()) { list.forEach((m) => m.dispose()); back?.dispose(); }   // (not the maps: the stands share them)
        mats.clear();
      },
    };
  }
}
