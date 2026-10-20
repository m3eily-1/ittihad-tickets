// The trophy room: a side room off the tunnel (same black/concrete/yellow-LED language), entered
// through a doorway in the right-hand wall and left by a second one further down. Display cases on
// three walls and a centrepiece, each with a spotlight, a slowly turning trophy and a plaque.
// Trophies are stylised lathe forms, not replicas; the honours data lives in trophies.js.
import * as THREE from 'three';
import { NEON } from './fx.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TN, DOORS } from './world.js';
import { TROPHIES } from './trophies.js';
import { REAL_TROPHIES, STYLISED_TROPHIES, trophyMaterials } from './trophymodels.js';

export const ROOM = { X0: TN.HW, X1: 21.5, Z0: 72, Z1: 98, H: 5.2 };
export const MAXL = 16;
const FREEZE = new URLSearchParams(location.search).has('tfreeze'); // debug: trophies face-on, still

// where each honour stands: [x, z, facing yaw] (yaw turns the plaque toward the room)
const SPOTS = {
  acl: [11.5, 85, -Math.PI / 2],
  gcc: [8, ROOM.Z1 - 1.25, Math.PI], arab: [12.5, ROOM.Z1 - 1.25, Math.PI], cwc: [17, ROOM.Z1 - 1.25, Math.PI],
  kings: [ROOM.X1 - 1.25, 80, -Math.PI / 2], league: [ROOM.X1 - 1.25, 86, -Math.PI / 2], crown: [ROOM.X1 - 1.25, 92, -Math.PI / 2],
  segypt: [8, ROOM.Z0 + 1.25, 0], fed: [12.5, ROOM.Z0 + 1.25, 0], super: [17, ROOM.Z0 + 1.25, 0],
};

/* ───────── shading: fake spotlights, LED skirting, same wall treatment as the tunnel ───────── */
const VERT = /* glsl */ `
  varying vec3 vW; varying vec3 vN;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
// B: the room's bounds, so the floor inlay and LED skirting follow its walls
export function roomMat(kind, uL, B = ROOM) {
  return new THREE.ShaderMaterial({
    defines: { KIND: kind },
    // uXf: world → room-local, for a room built in its own frame and then turned into place (the changing room)
    uniforms: { uCam: { value: new THREE.Vector3() }, uL, uOn: { value: 0 }, uTint: { value: new THREE.Color(1.0, 0.78, 0.02) }, uXf: { value: new THREE.Matrix4() } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN;
      uniform vec3 uCam; uniform vec4 uL[${MAXL}]; uniform float uOn; uniform vec3 uTint; uniform mat4 uXf;
      float h11(float n){ return fract(sin(n) * 43758.5453); }
      float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float n = dot(i, vec3(1.0, 57.0, 113.0));
        return mix(mix(mix(h11(n), h11(n + 1.0), f.x), mix(h11(n + 57.0), h11(n + 58.0), f.x), f.y), mix(mix(h11(n + 113.0), h11(n + 114.0), f.x), mix(h11(n + 170.0), h11(n + 171.0), f.x), f.y), f.z); }
      void main(){
        vec3 p = (uXf * vec4(vW, 1.0)).xyz, n = normalize(mat3(uXf) * vN), v = normalize((uXf * vec4(uCam, 1.0)).xyz - p);
        if (dot(n, v) < 0.0) n = -n;
        float grit = vn(p * vec3(1.6, 2.2, 1.6)) * 0.6 + vn(p * 7.0) * 0.4;
        vec3 alb; float gloss = 0.2;
        #if KIND == 0
          // walls: gloss black dado, yellow pinstripe, raw concrete above
          float lo = step(p.y, 1.15);
          alb = mix(vec3(0.12, 0.116, 0.11) * (0.65 + 0.6 * grit), vec3(0.022), lo);
          gloss = mix(0.2, 1.0, lo);
          alb = mix(alb, ${NEON ? 'vec3(0.75, 0.62, 0.0)' : 'vec3(0.16, 0.135, 0.04)'}, step(1.15, p.y) * step(p.y, 1.21));
        #elif KIND == 1
          // floor: polished black stone, yellow inlay that rings the room
          alb = vec3(0.022, 0.022, 0.024) * (0.8 + 0.5 * grit);
          gloss = 1.0;
          float dx = min(p.x - ${B.X0.toFixed(2)}, ${B.X1.toFixed(2)} - p.x), dz = min(p.z - ${B.Z0.toFixed(1)}, ${B.Z1.toFixed(1)} - p.z);
          float inlay = 1.0 - smoothstep(0.03, 0.045, abs(min(dx, dz) - 0.7));
          alb = mix(alb, ${NEON ? 'vec3(0.7, 0.58, 0.0)' : 'vec3(0.14, 0.12, 0.035)'}, inlay);
        #elif KIND == 2
          alb = vec3(0.02) * (0.7 + 0.6 * grit);
          gloss = 0.05;
        #elif KIND == 4
          // dark walnut panelling (the trophy hall): framed panels, a dado rail at 1 m, fine grain
          float u = abs(n.x) > 0.5 ? p.z : p.x;
          float grain = vn(vec3(u * 3.0, p.y * 60.0, 0.0)) * 0.5 + vn(vec3(u * 9.0, p.y * 140.0, 1.0)) * 0.3;
          alb = vec3(0.075, 0.042, 0.022) * (0.7 + 0.6 * grain);
          float pu = fract(u / 1.6), pv = p.y < 1.0 ? p.y : fract((p.y - 1.0) / 1.7);
          float frame = 1.0 - smoothstep(0.0, 0.015, min(min(pu, 1.0 - pu) * 1.6, min(pv, 1.0 - pv) * (p.y < 1.0 ? 1.0 : 1.7)));
          alb *= 1.0 - 0.45 * frame;
          alb = mix(alb, vec3(0.13, 0.075, 0.035), step(0.96, p.y) * step(p.y, 1.04));   // the dado rail
          gloss = 0.55;
        #elif KIND == 5
          // polished oak planks, laid along x
          float row = floor(p.z / 0.19), off = h11(row) * 3.0;
          float plank = floor((p.x + off) / 1.9);
          float tone = h11(row * 7.1 + plank * 3.3);
          float g2 = vn(vec3(p.x * 2.5, p.z * 40.0, 2.0));
          alb = vec3(0.2, 0.105, 0.05) * (0.75 + 0.35 * tone) * (0.85 + 0.3 * g2);
          float seam = 1.0 - smoothstep(0.0, 0.006, min(fract(p.z / 0.19), 1.0 - fract(p.z / 0.19)) * 0.19);
          alb *= 1.0 - 0.5 * seam;
          gloss = 1.4;
        #elif KIND == 6
          // plain dark polished wood (pedestals, cabinet frames)
          alb = vec3(0.06, 0.033, 0.018) * (0.8 + 0.4 * vn(vec3(p.x * 2.0, p.y * 50.0, p.z * 2.0)));
          gloss = 1.0;
        #else
          // plinths: lacquered black
          alb = vec3(0.016);
          gloss = 1.2;
        #endif
        vec3 acc = KIND >= 4 ? vec3(0.11, 0.08, 0.05) : vec3(0.035);   // the wood hall: warm ambient light
        vec3 r = reflect(-v, n);
        for (int i = 0; i < ${MAXL}; i++) {
          vec4 L = uL[i];
          if (L.w <= 0.0) continue;
          vec3 d = L.xyz - p; float d2 = dot(d, d); vec3 l = d * inversesqrt(d2);
          float cone = smoothstep(0.72, 0.93, dot(-l, vec3(0.0, -1.0, 0.0)));
          vec3 c = vec3(1.0, 0.93, 0.8) * L.w * uOn;
          acc += c * (max(dot(n, l), 0.0) * cone * 11.0 / (1.0 + d2 * 0.35));
          acc += c * pow(max(dot(r, l), 0.0), 60.0) * gloss * 5.0 / (1.0 + d2 * 0.05);
        }
        // LED skirting: yellow wash low on the walls and along the floor edge
        float wallDist = min(min(p.x - ${B.X0.toFixed(2)}, ${B.X1.toFixed(2)} - p.x), min(p.z - ${B.Z0.toFixed(1)}, ${B.Z1.toFixed(1)} - p.z));
        acc += uTint * uOn * 0.5 * ${NEON ? '1.0' : '0.0'} * exp(-(max(wallDist, 0.0) * 3.0 + p.y * 2.4));   // LED skirting (room accent colour)
        gl_FragColor = vec4(alb * acc, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/* ───────── stylised trophies: lathed profiles (radius, height) in metres ───────── */
const V = (r, y) => new THREE.Vector2(r, y);
const PROFILES = {
  cup: [V(0, 0), V(0.12, 0), V(0.12, 0.03), V(0.05, 0.05), V(0.03, 0.12), V(0.05, 0.16), V(0.03, 0.2), V(0.04, 0.26), V(0.11, 0.31), V(0.16, 0.38), V(0.175, 0.47), V(0.16, 0.47), V(0.145, 0.39), V(0.09, 0.33), V(0, 0.32)],
  tall: [V(0, 0), V(0.15, 0), V(0.15, 0.05), V(0.07, 0.08), V(0.045, 0.2), V(0.07, 0.25), V(0.04, 0.3), V(0.035, 0.42), V(0.09, 0.48), V(0.17, 0.57), V(0.2, 0.68), V(0.19, 0.76), V(0.215, 0.79), V(0.2, 0.79), V(0.175, 0.7), V(0.12, 0.58), V(0, 0.55)],
  grand: [V(0, 0), V(0.2, 0), V(0.2, 0.06), V(0.16, 0.08), V(0.06, 0.12), V(0.045, 0.22), V(0.08, 0.27), V(0.05, 0.31), V(0.08, 0.36), V(0.2, 0.44), V(0.27, 0.56), V(0.28, 0.66), V(0.3, 0.69), V(0.28, 0.69), V(0.255, 0.58), V(0.15, 0.46), V(0, 0.44)],
  lidded: [V(0, 0), V(0.13, 0), V(0.13, 0.04), V(0.05, 0.07), V(0.035, 0.2), V(0.06, 0.24), V(0.15, 0.32), V(0.18, 0.44), V(0.16, 0.5), V(0.17, 0.52), V(0.12, 0.56), V(0.06, 0.6), V(0.03, 0.63), V(0.05, 0.67), V(0.0, 0.72)],
  bowl: [V(0, 0), V(0.14, 0), V(0.14, 0.03), V(0.05, 0.06), V(0.04, 0.16), V(0.12, 0.2), V(0.24, 0.26), V(0.3, 0.33), V(0.28, 0.33), V(0.22, 0.28), V(0.1, 0.23), V(0, 0.22)],
  urn: [V(0, 0), V(0.12, 0), V(0.12, 0.04), V(0.06, 0.07), V(0.07, 0.12), V(0.16, 0.22), V(0.18, 0.32), V(0.12, 0.44), V(0.08, 0.5), V(0.11, 0.54), V(0.1, 0.55), V(0.065, 0.5), V(0, 0.48)],
  globe: [V(0, 0), V(0.13, 0), V(0.13, 0.04), V(0.06, 0.07), V(0.03, 0.18), V(0.02, 0.36), V(0.06, 0.38), V(0, 0.39)],
  spire: [V(0, 0), V(0.14, 0), V(0.14, 0.05), V(0.07, 0.08), V(0.06, 0.3), V(0.085, 0.42), V(0.05, 0.6), V(0.0, 0.74)],
  plate: [V(0, 0), V(0.12, 0), V(0.12, 0.04), V(0.04, 0.07), V(0.03, 0.2), V(0, 0.21)],
};
function trophy(shape, mat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(PROFILES[shape], 48), mat);
  g.add(body);
  const pts = PROFILES[shape];
  const top = Math.max(...pts.map((p) => p.y));
  // handles on the cup forms
  if (['cup', 'tall', 'grand', 'lidded', 'urn'].includes(shape)) {
    const big = shape === 'grand' || shape === 'tall';
    const R = big ? 0.12 : 0.085, y = top * (shape === 'lidded' ? 0.6 : 0.72);
    const rim = shape === 'grand' ? 0.27 : shape === 'tall' ? 0.19 : 0.16;
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(R, big ? 0.016 : 0.012, 10, 28, Math.PI * 1.15), mat);
      h.position.set(s * (rim + R * 0.35), y - R * 0.25, 0);
      h.rotation.z = s > 0 ? -Math.PI * 0.6 : Math.PI * 1.45;
      g.add(h);
    }
  }
  if (shape === 'globe') {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 40, 24), mat);
    ball.position.y = 0.53;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 64), mat);
    band.position.y = 0.53; band.rotation.x = Math.PI / 2.4;
    g.add(ball, band);
  }
  if (shape === 'plate') {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 64), mat);
    plate.rotation.x = Math.PI / 2; plate.position.y = 0.46;
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 48), mat);
    boss.rotation.x = Math.PI / 2; boss.position.set(0, 0.46, 0.02);
    g.add(plate, boss);
  }
  if (shape === 'spire') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 64), mat);
    ring.position.y = 0.45; ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  return g;
}

/* ───────── real models (AI image-to-3D GLBs), swapped in over the stylised forms ───────── */
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
function swapInModel(t, spinners, { height, env }) {
  loader.load(t.model, (gltf) => {
    const src = gltf.scene;
    // stand it on its base and scale it to the case
    const box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3());
    const k = height / Math.max(size.y, 1e-3);
    src.scale.setScalar(k);
    box.setFromObject(src);
    const c = box.getCenter(new THREE.Vector3());
    src.position.set(-c.x, -box.min.y, -c.z);
    src.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (m && 'envMap' in m) { m.envMap = env; m.envMapIntensity = 1.2; m.needsUpdate = true; }
    });
    for (const g of spinners) {
      const inst = new THREE.Group();
      inst.add(src.clone(true));
      g.clear();
      g.scale.setScalar(1);
      g.add(inst);
    }
  }, undefined, () => { /* no model yet: keep the stylised trophy */ });
}

/* ───────── canvas textures ───────── */
function plaqueTex(t) {
  const W = 1024, H = 520;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#0b0b0b'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fef201'; x.fillRect(0, 0, W, 10);
  x.font = '500 30px "JetBrains Mono"'; x.fillStyle = 'rgba(244,241,232,0.55)';
  x.letterSpacing = '4px';
  x.fillText(t.scope.toUpperCase(), 48, 74);
  x.letterSpacing = '0px';
  let size = 92;
  x.font = `400 ${size}px Anton`;
  while (x.measureText(t.name.toUpperCase()).width > W - 96 && size > 40) { size -= 4; x.font = `400 ${size}px Anton`; }
  x.fillStyle = '#fef201';
  x.fillText(t.name.toUpperCase(), 48, 82 + size);
  // years, wrapped
  x.font = '500 34px "JetBrains Mono"'; x.fillStyle = '#f4f1e8';
  let lx = 48, ly = 82 + size + 76;
  for (const y of t.years) {
    const w = x.measureText(y).width;
    if (lx + w > W - 48) { lx = 48; ly += 50; }
    x.fillText(y, lx, ly);
    lx += w + 34;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
export function ledSign(text, w = 1400, h = 220) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#050505'; x.fillRect(0, 0, w, h);
  x.font = `400 ${h * 0.6}px Anton`; x.letterSpacing = `${h * 0.05}px`;
  x.fillStyle = '#fef201'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, w / 2, h * 0.54);
  x.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < w; i += 6) x.fillRect(i, 0, 2, h);
  for (let j = 0; j < h; j += 6) x.fillRect(0, j, w, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function wallTitle() {
  const W = 2400, H = 520;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  x.font = '400 360px Anton'; x.letterSpacing = '18px';
  x.fillStyle = 'rgba(244,241,232,0.9)'; x.textAlign = 'center';
  x.fillText('HONOURS', W / 2, 360);
  x.font = '500 46px "JetBrains Mono"'; x.letterSpacing = '12px';
  x.fillStyle = '#fef201';
  x.fillText('AL-ITTIHAD CLUB · JEDDAH · SINCE 1927', W / 2, 470);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ───────── build ───────── */
export function buildMuseum({ renderer, lite = false }) {
  const { X0, X1, Z0, Z1, H } = ROOM;
  const group = new THREE.Group();
  const uL = { value: Array.from({ length: MAXL }, () => new THREE.Vector4(0, 0, 0, 0)) };
  const mats = [];
  const M = (k) => { const m = roomMat(k, uL); mats.push(m); return m; };
  // Ahmed's reference (2026-10-13): a warm, wood-panelled trophy hall — walnut walls, oak floor, open
  // pedestals with plaques, and lit cabinets of honours along the back wall
  const wallM = M(4), floorM = M(5), ceilM = M(2), plinthM = M(6), woodM = M(6);
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);

  /* shell */
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const floor = plane(W, D, floorM); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.002, cz);
  const ceil = plane(W, D, ceilM); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz);
  const back = plane(D, H, wallM); back.rotation.y = -Math.PI / 2; back.position.set(X1, H / 2, cz);
  const north = plane(W, H, wallM); north.rotation.y = Math.PI; north.position.set(cx, H / 2, Z1);
  const south = plane(W, H, wallM); south.position.set(cx, H / 2, Z0);
  group.add(floor, ceil, back, north, south);
  // the tunnel-side wall, seen from inside the room, with the two doorways cut out
  const zs = [Z0, DOORS.in[0], DOORS.in[1], Z1];   // one doorway (the second one is closed up)
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1], door = i === 1;
    const y0 = door ? DOORS.h : 0, hgt = H - y0;
    const seg = plane(z1 - z0, hgt, wallM);
    seg.rotation.y = Math.PI / 2;
    seg.position.set(X0 + 0.12, y0 + hgt / 2, (z0 + z1) / 2);
    group.add(seg);
  }
  // door reveals: yellow LED frames, visible from both sides (kept just under full bloom — you pass close)
  const ledM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.2, 0.05) });
  const doorM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.95, 0.02) });
  for (const [z0, z1] of [DOORS.in]) {
    for (const z of [z0, z1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, DOORS.h, 0.03), doorM); b.position.set(X0 + 0.06, DOORS.h / 2, z); group.add(b); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, z1 - z0 + 0.03), doorM); top.position.set(X0 + 0.06, DOORS.h, (z0 + z1) / 2); group.add(top);
  }
  // signs: "Trophy room" over the way in (tunnel side), "To the pitch" over the way out (room side)
  const signIn = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.42), new THREE.MeshBasicMaterial({ map: ledSign('TROPHY ROOM'), color: new THREE.Color(1.7, 1.7, 1.7) }));
  signIn.rotation.y = -Math.PI / 2; signIn.position.set(X0 - 0.02, DOORS.h + 0.42, (DOORS.in[0] + DOORS.in[1]) / 2);
  const signOut = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.42), new THREE.MeshBasicMaterial({ map: ledSign('TO THE PITCH  →'), color: new THREE.Color(1.7, 1.7, 1.7) }));
  signOut.rotation.y = Math.PI / 2; signOut.position.set(X0 + 0.14, DOORS.h + 0.42, (DOORS.out[0] + DOORS.out[1]) / 2);
  // (the LED sign over the door was replaced by the tunnel poster's room name)
  // LED strips where the walls meet the floor (the tunnel's own detail)
  const strip = (len, x, z, ry) => { const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.03), ledM); s.position.set(x, 0.02, z); s.rotation.y = ry; group.add(s); };
  strip(W, cx, Z1 - 0.02, 0); strip(W, cx, Z0 + 0.02, 0); strip(D, X1 - 0.02, cz, Math.PI / 2);
  // wall title over the back cases
  const title = new THREE.Mesh(new THREE.PlaneGeometry(11, 11 * (520 / 2400)), new THREE.MeshBasicMaterial({ map: wallTitle(), transparent: true, color: new THREE.Color(0.5, 0.5, 0.5) }));
  title.rotation.y = -Math.PI / 2; title.position.set(X1 - 0.03, 4.55, 85); title.scale.setScalar(0.62);
  group.add(title);

  /* metals: lit by a small studio environment so they read as real gold and silver */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b44c, metalness: 1, roughness: 0.2, envMap: env, envMapIntensity: 1.25, side: THREE.DoubleSide });
  const silver = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.16, envMap: env, envMapIntensity: 1.1, side: THREE.DoubleSide });
  const realM = trophyMaterials(env);

  /* cases */
  // spotlight beams: an additive gradient (a custom fresnel shader here produced invalid pixels that
  // bloom smeared across the whole frame)
  const bc = document.createElement('canvas'); bc.width = 4; bc.height = 256;
  const bx = bc.getContext('2d'); const grd = bx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,244,214,1)'); grd.addColorStop(0.5, 'rgba(255,244,214,0.35)'); grd.addColorStop(1, 'rgba(255,244,214,0.04)');
  bx.fillStyle = grd; bx.fillRect(0, 0, 4, 256);
  const beamTex = new THREE.CanvasTexture(bc); beamTex.colorSpace = THREE.SRGBColorSpace;
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 4.8) });
  const glassM = new THREE.MeshBasicMaterial({ color: 0xcfe0f0, transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide });
  const edgeM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
  const cases = [], blockers = [];
  let li = 0;
  for (const t of TROPHIES) {
    const [x, z, yaw] = SPOTS[t.key];
    const centre = t.key === 'acl', big = t.key === 'league';
    const c = new THREE.Group();
    c.position.set(x, 0, z);
    c.rotation.y = yaw;
    const ph = centre ? 1.05 : 1.0;
    // plinth
    const plinth = centre
      ? new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, ph, 64), plinthM)
      : new THREE.Mesh(new THREE.BoxGeometry(big ? 1.5 : 1.1, ph, big ? 1.3 : 1.1), plinthM);
    plinth.position.y = ph / 2;
    c.add(plinth);
    // a yellow LED line round the top edge
    const edge = centre
      ? new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.012, 6, 96), ledM)
      : new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(big ? 1.5 : 1.1, 0.001, big ? 1.3 : 1.1)), new THREE.LineBasicMaterial({ color: new THREE.Color(2.4, 2.0, 0.05) }));
    if (centre) edge.rotation.x = Math.PI / 2;
    edge.position.y = ph + 0.003;
    c.add(edge);
    // glass vitrine (the centrepiece stands open)
    if (false) {   // open pedestals now, as in the reference (no glass cases)
      const gw = big ? 1.36 : 0.98, gh = big ? 1.5 : 1.25, gd = big ? 1.16 : 0.98;
      const box = new THREE.BoxGeometry(gw, gh, gd);
      const glass = new THREE.Mesh(box, glassM);
      glass.position.y = ph + gh / 2;
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(box), edgeM);
      lines.position.copy(glass.position);
      c.add(glass, lines);
    }
    // the trophy
    const mat = t.metal === 'gold' ? gold : silver;
    const spin = [];
    const n = 1;   // one trophy per pedestal (Ahmed: a single AFC cup at the centre)
    for (let k = 0; k < n; k++) {
      // the real trophy, modelled from its photo, where we have one; a stylised form otherwise
      const build = REAL_TROPHIES[t.key] || STYLISED_TROPHIES[t.key];
      let tr;
      if (build) {
        tr = new THREE.Group();
        const m = build(realM);
        const h = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y;
        m.scale.setScalar((centre ? 0.9 : big ? 1.1 : 0.95) / h);
        tr.add(m);
      } else {
        tr = trophy(t.shape, mat);
        tr.scale.setScalar(centre ? 1.45 : big ? 1.45 : 1.25);
      }
      tr.position.set(0, ph + 0.005, 0);
      tr.rotation.y = k * 1.3;
      c.add(tr);
      spin.push(tr);
    }
    // a real model replaces the stylised one when public/models/trophies/<key>.glb exists
    if (t.model) swapInModel(t, spin, { height: centre ? 1.05 : big ? 1.0 : 0.85, env });
    // plaque on the front face (and the back of the centrepiece too)
    const tex = plaqueTex(t);
    const plq = (sideYaw = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92 * (520 / 1024)), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.95, 0.95, 0.95) }));
      if (centre) { m.position.set(Math.sin(sideYaw) * 1.21, ph * 0.52, Math.cos(sideYaw) * 1.21); m.rotation.y = sideYaw; }
      else { m.position.set(0, ph * 0.52, (big ? 0.65 : 0.55) + 0.003); }
      c.add(m);
    };
    plq(0);
    if (centre) plq(Math.PI);
    // spotlight: lamp in the ceiling, a soft beam, and a light the room shader uses
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(centre ? 0.34 : 0.22, 32), lampM);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.y = H - 0.01;
    c.add(lamp);
    const bh = H - ph - 0.05;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(centre ? 0.3 : 0.18, centre ? 1.25 : 0.75, bh, 32, 1, true), beamMat);
    beam.position.y = ph + bh / 2;
    if (!lite) c.add(beam);
    group.add(c);
    const lw = centre ? 1.6 : big ? 1.25 : 1;
    if (li < MAXL) uL.value[li++].set(x, H - 0.05, z, lw);
    cases.push({ data: t, group: c, spin, focusPos: new THREE.Vector3(x, ph + 0.5, z), lightIdx: li - 1, base: lw });
    // you can't walk through a pedestal (Ahmed): a circle round it that the free camera stays out of
    blockers.push({ x, z, r: centre ? 1.2 : big ? 1.0 : 0.78 });
  }

  /* the honours cabinets along the back wall: a bay per competition, one small replica per title, each
     with its year on a little plate — so the shelves hold exactly the club's honours (trophies.js) */
  {
    const yearTex = (txt) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#b8913a'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#1b1206'; x.font = '600 34px "JetBrains Mono"'; x.textAlign = 'center'; x.fillText(txt, 128, 44); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const labelTex = (t) => { const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#b8913a'; x.fillRect(0, 0, 1024, 128); x.fillStyle = '#1b1206'; let sz = 64; x.font = `400 ${sz}px Anton`; const n = t.name.toUpperCase(); while (x.measureText(n).width > 960 && sz > 30) { sz -= 2; x.font = `400 ${sz}px Anton`; } x.textAlign = 'center'; x.fillText(n, 512, 86); const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace; return tt; };
    // warm back panels: light pools under each shelf's lamp and falls off toward the shelf below (no glow)
    const backTex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 512; const x = c.getContext('2d');
      const ys = [0.95, 1.72, 2.44, 3.16, 3.7].map((y) => 512 - ((y - 0.95) / (3.7 - 0.95)) * 512);   // canvas rows, top = 3.7 m
      for (let k = 0; k < 4; k++) {
        const yTop = ys[k + 1], yBot = ys[k];
        const g = x.createLinearGradient(0, yTop, 0, yBot);
        g.addColorStop(0, '#c98f4c'); g.addColorStop(0.35, '#8a5a2c'); g.addColorStop(1, '#3a2312');
        x.fillStyle = g; x.fillRect(0, yTop, 64, yBot - yTop);
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const backLit = new THREE.MeshBasicMaterial({ map: backTex, color: new THREE.Color(0.85, 0.85, 0.85) });
    const lightLine = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.98, 0.86, 0.62) });
    const order = [...TROPHIES].sort((a, b) => b.years.length - a.years.length);
    const protos = {};
    function replica(t, maxW) {
      if (!protos[t.key]) {
        const build = REAL_TROPHIES[t.key] || STYLISED_TROPHIES[t.key];
        const m = build ? build(realM) : trophy(t.shape, t.metal === 'gold' ? gold : silver);
        const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
        const holder = new THREE.Group(); m.position.y -= box.min.y; holder.add(m);
        protos[t.key] = { holder, size };
      }
      const { holder, size } = protos[t.key];
      const r = holder.clone();
      r.scale.setScalar(Math.min(0.5 / size.y, maxW / Math.max(size.x, size.z)));   // ≤ 0.5 m tall (shelf gap 0.72)
      return r;
    }
    const BW = 2.05, z0 = cz - (order.length * BW) / 2, depth = 0.5, xb = X1 - depth / 2 - 0.02;
    const shelfY = [1.0, 1.72, 2.44, 3.16], top = 3.7;
    order.forEach((t, i) => {
      const zc = z0 + i * BW + BW / 2;
      const g = new THREE.Group(); g.position.set(xb, 0, zc); g.rotation.y = -Math.PI / 2; group.add(g);   // local +z faces the room
      const back = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.1, top - 0.95), backLit); back.position.set(0, (top + 0.95) / 2, -depth / 2 + 0.01); g.add(back);
      for (const sx of [-BW / 2, BW / 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, top + 0.2, depth), woodM); post.position.set(sx, (top + 0.2) / 2, 0); g.add(post); }
      const base = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.95, depth + 0.06), woodM); base.position.set(0, 0.475, 0.03); g.add(base);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.1, 0.22, depth + 0.12), woodM); crown.position.set(0, top + 0.11, 0.04); g.add(crown);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.82, BW * 0.82 / 8), new THREE.MeshBasicMaterial({ map: labelTex(t) })); label.position.set(0, top + 0.11, depth / 2 + 0.105); g.add(label);
      const mat = t.metal === 'gold' ? gold : silver;
      const perShelf = Math.max(1, Math.ceil(t.years.length / 3));
      shelfY.forEach((y, k) => {
        if (k > 0) { const sh = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.1, 0.04, depth - 0.04), woodM); sh.position.set(0, y - 0.02, 0); g.add(sh); }
        if (k < 3) { const ll = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.2, 0.012, 0.03), lightLine); ll.position.set(0, shelfY[k + 1] - 0.05, depth / 2 - 0.08); g.add(ll); }
      });
      t.years.forEach((yr, j) => {
        const k = Math.floor(j / perShelf), m = j % perShelf, n = Math.min(perShelf, t.years.length - k * perShelf);
        const gap = Math.min(0.5, (BW - 0.3) / n);
        const x = (m - (n - 1) / 2) * gap;
        // the same trophy models as on the pedestals, shrunk to sit on the shelf with headroom and never
        // touch their neighbours
        const r = replica(t, gap * 0.82); r.position.set(x, shelfY[k] + 0.002, -0.04); r.rotation.y = (j % 2 ? -1 : 1) * 0.25; g.add(r);
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), new THREE.MeshBasicMaterial({ map: yearTex(yr) })); plate.position.set(x, shelfY[k] + 0.03, depth / 2 - 0.03); plate.rotation.x = -0.25; g.add(plate);
      });
    });
  }

  /* per-frame */
  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  let focus = -1;
  function update(t, camera, { on = 1 } = {}) {
    for (const m of mats) { m.uniforms.uCam.value.copy(camera.position); m.uniforms.uOn.value = on; }
    group.visible = camera.position.z > 62;
    if (!group.visible) return focus;
    // which case you're looking at, while you're in the room
    const inside = camera.position.x > X0 + 0.4 && camera.position.y < H;
    camera.getWorldDirection(fwd);
    let best = -1, bd = 0.955;
    if (inside) cases.forEach((c, i) => {
      to.copy(c.focusPos).sub(camera.position);
      const d = to.length();
      if (d > 11) return;
      const s = fwd.dot(to.normalize());
      if (s > bd) { bd = s; best = i; }
    });
    focus = best;
    cases.forEach((c, i) => {
      c.spin.forEach((s, k) => { s.rotation.y = FREEZE ? 0 : t * (i === focus ? 0.55 : 0.22) + k * 1.3 + i; });
      // the case you're looking at gets a touch more light
      const L = uL.value[c.lightIdx];
      L.w += ((i === focus ? c.base * 1.35 : c.base) - L.w) * 0.08;
    });
    return focus;
  }

  const inside = (c) => { const p = c.position; return p.x > X0 + 0.4 && p.x < X1 && p.z > Z0 && p.z < Z1 && p.y < H; };
  return { group, cases, blockers, env, update, get focus() { return focus; }, inside };
}
