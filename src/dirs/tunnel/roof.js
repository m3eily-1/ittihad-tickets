// Al-Jawhara's crown roof, modelled from the club's aerial photo and the Commons interior photo
// ("Jawhara Stadium.jpg"). From above: a ring of white faceted membrane triangles whose bases sit on
// the roof's inner edge and whose points face out, with gold petals between them that end in a
// scalloped outer rim. From inside: white radial space trusses, an inner edge of shallow arches and
// floodlights under each truss tip (there are no light towers). Stylised, not to scale.
import * as THREE from 'three';
import { ringXZ } from './world.js';

const N = 40;                         // roof bays
const RI = [85, 66, 55];              // inner edge: truss tips [a, b, y]
const RB = [119, 97, 60];             // back ring over the columns
const RO = [128, 106, 51];            // outer rim of the petals (they drape down)
const lerp = (a, b, t) => a + (b - a) * t;
const at = (ring, th, dy = 0) => { const [x, z] = ringXZ(ring[0], ring[1], th); return new THREE.Vector3(x, ring[2] + dy, z); };
const between = (r0, r1, t) => [lerp(r0[0], r1[0], t), lerp(r0[1], r1[1], t), lerp(r0[2], r1[2], t)];

// flat-faceted membrane: lit from above and from the bowl's glow, the underside a pale grey
function membraneMat(top, under, glow, fogU) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTop: { value: new THREE.Color(...top) }, uUnder: { value: new THREE.Color(...under) }, uGlow: { value: glow }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, ...fogU },
    vertexShader: /* glsl */ `varying vec3 vW; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `varying vec3 vW; varying vec3 vN;
      uniform vec3 uTop, uUnder, uCam, uFogCol; uniform float uGlow, uFogD;
      void main(){
        vec3 n = normalize(vN);
        vec3 col;
        if (gl_FrontFacing == (n.y > 0.0)) {
          // top: moonlit facets plus the floodlit bowl glowing through the fabric
          float l = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.3, 1.0, 0.25))), 0.0);
          col = uTop * (l * 0.55 + uGlow);
        } else {
          // underside: catches the floodlights below
          col = uUnder * (0.55 + 0.45 * smoothstep(110.0, 70.0, length(vW.xz)));
        }
        float d = length(uCam - vW);
        col = mix(col, uFogCol, 1.0 - exp(-d * d * uFogD * uFogD));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function geo(tris) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals(); // non-indexed → flat facets
  return g;
}

export function buildRoof({ fogU, mats, coreTex, lite = false }) {
  const group = new THREE.Group();
  const th = (k) => (k / N) * Math.PI * 2 + Math.PI / 2; // a bay centred on the far stand's axis

  /* ── the outside, after the club's aerial photos (Ahmed, 2026-10-13): a low dark dome running from the
     roof opening down to the ground, with 24 cream pointed petals radiating from the opening's edge (each
     folded along its centre, lit from within at night), and a lattice band round the base that glows warm
     gold at night ── */
  const P = 24, V = 18, U = 240;
  const D0 = [86, 67, 56.5], D1 = [142, 120, 15];   // the dome's foot sits on a 15 m lattice base
  const domeAt = (v, ang, lift = 0) => {
    const sv = Math.sin((v * Math.PI) / 2), cv = 1 - Math.cos((v * Math.PI) / 2);
    const [x, z] = ringXZ(lerp(D0[0], D1[0], sv), lerp(D0[1], D1[1], sv), ang);
    return new THREE.Vector3(x, lerp(D0[2], D1[2], cv) + lift, z);
  };
  {
    const shell = [];
    for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
      const a0 = (i / U) * Math.PI * 2, a1 = ((i + 1) / U) * Math.PI * 2, v0 = j / V, v1 = (j + 1) / V;
      const p00 = domeAt(v0, a0), p10 = domeAt(v0, a1), p01 = domeAt(v1, a0), p11 = domeAt(v1, a1);
      shell.push(p00, p01, p10, p10, p01, p11);
    }
    const g = geo(shell); g.computeVertexNormals();
    const shellM = membraneMat([0.14, 0.14, 0.155], [0.3, 0.29, 0.3], 0.02, fogU);
    mats.push(shellM);
    group.add(new THREE.Mesh(g, shellM));
  }
  {
    const petals = [], R = 12, REACH = 0.78;
    for (let k = 0; k < P; k++) {
      const c = th(0) + (k / P) * Math.PI * 2, half = Math.PI / P;
      for (let j = 0; j < R; j++) {
        const v0 = (j / R) * REACH, v1 = ((j + 1) / R) * REACH;
        const w0 = half * (1 - j / R) * 0.97, w1 = half * (1 - (j + 1) / R) * 0.97;
        const fold0 = 0.25 + 1.4 * (1 - j / R), fold1 = 0.25 + 1.4 * (1 - (j + 1) / R);   // the raised centre fold
        const L0 = domeAt(v0, c - w0, 0.25), C0 = domeAt(v0, c, fold0), R0 = domeAt(v0, c + w0, 0.25);
        const L1 = domeAt(v1, c - w1, 0.25), C1 = domeAt(v1, c, fold1), R1 = domeAt(v1, c + w1, 0.25);
        petals.push(L0, L1, C0, C0, L1, C1, C0, C1, R0, R0, C1, R1);
      }
    }
    const petalM = membraneMat([0.93, 0.89, 0.8], [0.55, 0.52, 0.48], 0.45, fogU);   // cream membrane, lit through at night
    petalM.userData.nightGlow = 0.45;
    mats.push(petalM);
    group.add(new THREE.Mesh(geo(petals), petalM));
    group.userData.petalM = petalM;
  }
  {
    // the base: a ring of diamond lattice from the dome's foot to the ground
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, 0, 128); bg.addColorStop(0, '#2a2016'); bg.addColorStop(1, '#5a4228');
    x.fillStyle = bg; x.fillRect(0, 0, 256, 128);   // lit from inside, brighter toward the ground
    x.strokeStyle = '#ffffff'; x.lineWidth = 12;
    for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 64, 128); x.lineTo(i * 64 + 64, 0); x.moveTo(i * 64 + 64, 128); x.lineTo(i * 64, 0); x.stroke(); }
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 8); x.fillRect(0, 120, 256, 8);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(70, 1);
    const pos = [], uv = [];
    for (let i = 0; i <= U; i++) {
      const a = (i / U) * Math.PI * 2;
      const top = domeAt(1, a, 0.2), [bx, bz] = ringXZ(D1[0] + 1.5, D1[1] + 1.5, a);
      pos.push(top.x, top.y, top.z, bx, 0, bz); uv.push(i / U, 1, i / U, 0);
    }
    const idx = []; for (let i = 0; i < U; i++) { const p = i * 2; idx.push(p, p + 1, p + 2, p + 2, p + 1, p + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const baseM = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.0, 0.72, 0.32), side: THREE.DoubleSide, fog: true });
    group.add(new THREE.Mesh(g, baseM));
    group.userData.baseM = baseM;
  }

  /* ── underside (from the interior references): radial space trusses, a ring truss along the inner
     edge, a deep V-truss hanging in every bay with a triangular floodlight in it, and white portal frames
     standing behind the top tier that carry the back of the roof ── */
  const members = [];
  const seg = (a, b, w = 0.32) => members.push([a, b, w]);
  const vTris = []; // floodlight triangles, one per bay
  const FOOT = [116, 95, 43];             // top of the upper tier, where the portal frames stand
  const backLowY = RB[2] - 9.5 - RB[2];   // back of each truss sits on its portal beam
  for (let k = 0; k < N; k++) {
    const t = th(k);
    const back = at(RB, t, -0.6), tip = at(RI, t, -0.4);
    const backLow = at(RB, t, backLowY), tipLow = at(RI, t, -2.6);
    seg(back, tip, 0.45); seg(backLow, tipLow, 0.4); seg(back, backLow, 0.4); seg(tip, tipLow, 0.35);
    const W = 8;
    for (let i = 0; i < W; i++) {
      const u0 = i / W, u1 = (i + 1) / W;
      const top = (u) => back.clone().lerp(tip, u), bot = (u) => backLow.clone().lerp(tipLow, u);
      seg(i % 2 ? top(u0) : bot(u0), i % 2 ? bot(u1) : top(u1), 0.22);
    }
    // ring truss along the inner edge (two chords + web) to the next tip
    const tipN = at(RI, th(k + 1), -0.4), tipLowN = at(RI, th(k + 1), -2.6);
    seg(tip, tipN, 0.36); seg(tipLow, tipLowN, 0.34);
    for (let i = 0; i < 4; i++) {
      const u0 = i / 4, u1 = (i + 1) / 4;
      seg(tip.clone().lerp(tipN, u0), tipLow.clone().lerp(tipLowN, u1), 0.18);
    }
    // the V-truss hanging in the bay: from both tips down to an apex further out and lower
    const apex = at(between(RI, RB, 0.32), th(k + 0.5), -9.5);
    seg(tipLow, apex, 0.42); seg(tipLowN, apex, 0.42);
    const mid0 = tipLow.clone().lerp(apex, 0.5), mid1 = tipLowN.clone().lerp(apex, 0.5);
    seg(mid0, mid1, 0.26); seg(tipLow, mid1, 0.18); seg(tipLowN, mid0, 0.18);
    // floodlight panel inside the V (upper part of the triangle)
    const c = new THREE.Vector3().addVectors(tipLow, tipLowN).add(apex).multiplyScalar(1 / 3);
    const shrink = (v, f) => c.clone().lerp(v, f);
    vTris.push(shrink(tipLow, 0.62), shrink(tipLowN, 0.62), shrink(apex, 0.62));
    // portal frame: two white posts and a beam behind the top tier, carrying the truss back
    const pA = at(FOOT, th(k - 0.16)), pB = at(FOOT, th(k + 0.16));
    const topA = at([RB[0], RB[1], RB[2] + backLowY], th(k - 0.16)), topB = at([RB[0], RB[1], RB[2] + backLowY], th(k + 0.16));
    seg(pA, topA, 0.9); seg(pB, topB, 0.9); seg(topA, topB, 0.8);
    for (const h of [0, 1]) {
      const F = [116.4, 95.4, 43];
      const a = at(F, th(k + h / 2)), b = at(F, th(k + (h + 1) / 2)), top = at(F, th(k + (h + 0.5) / 2), 7.5);
      seg(a, top, 0.45); seg(top, b, 0.45);
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const steel = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.78, 0.78, 0.77), fog: true }); // white steel
  const inst = new THREE.InstancedMesh(box, steel, members.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), mid = new THREE.Vector3(), sc = new THREE.Vector3();
  members.forEach(([a, b, w], i) => {
    dir.subVectors(b, a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    mid.addVectors(a, b).multiplyScalar(0.5);
    m4.compose(mid, q, sc.set(w, len, w));
    inst.setMatrixAt(i, m4);
  });
  group.add(inst);

  /* ── the zigzag facade seen from inside: white triangles of diamond-patterned panels standing behind
     the top tier (two per bay, apex up, between the roof's columns) ── */
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#b9bcc2'; x.fillRect(0, 0, 512, 512);
    let s = 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const D = 20;
    for (let j = -1; j < 512 / (D / 2) + 1; j++) for (let i = -1; i < 512 / D + 1; i++) {
      const cx = i * D + (j % 2 ? D / 2 : 0), cy = j * (D / 2);
      const r = rnd();
      x.fillStyle = r < 0.1 ? '#141824' : r < 0.25 ? '#6f7686' : r < 0.45 ? '#dfe2e7' : '#f6f7f9';
      x.beginPath(); x.moveTo(cx, cy - D / 2 + 1.5); x.lineTo(cx + D / 2 - 1.5, cy); x.lineTo(cx, cy + D / 2 - 1.5); x.lineTo(cx - D / 2 + 1.5, cy); x.closePath(); x.fill();
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const pos = [], uv = [];
    const R0 = [116.5, 95.5, 43], H = 7.5;
    for (let k = 0; k < N * 2; k++) {
      const t0 = th(k / 2), t1 = th((k + 1) / 2), tm = th((k + 0.5) / 2);
      const a = at(R0, t0), b = at(R0, t1), top = at(R0, tm, H);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, top.x, top.y, top.z);
      uv.push(0, 0, 1.4, 0, 0.7, 1.6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const facade = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.85, 0.85, 0.87), side: THREE.DoubleSide, fog: true }));
    group.add(facade);
  }

  /* ── floodlights: the LED triangles inside each V-truss, aimed at the pitch ── */
  const dc = document.createElement('canvas'); dc.width = dc.height = 128;
  const dx = dc.getContext('2d');
  dx.fillStyle = '#3a3a3a'; dx.fillRect(0, 0, 128, 128);
  dx.fillStyle = '#ffffff';
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { dx.beginPath(); dx.arc(5 + i * 10.5 + (j % 2) * 5, 5 + j * 10.5, 3.2, 0, Math.PI * 2); dx.fill(); }
  const dots = new THREE.CanvasTexture(dc); dots.colorSpace = THREE.SRGBColorSpace; dots.wrapS = dots.wrapT = THREE.RepeatWrapping;
  const lpos = [], luv = [];
  for (const v of vTris) lpos.push(v.x, v.y, v.z);
  for (let i = 0; i < vTris.length / 3; i++) luv.push(0, 0, 4, 0, 2, 3.4);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lpos, 3));
  lg.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2));
  group.add(new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ map: dots, color: new THREE.Color(5, 4.8, 4.3), side: THREE.DoubleSide, fog: false })));
  const heads = [];
  for (let k = 0; k < N; k += 5) { // a flare from every fifth lamp: more reads as ghost blobs
    const p = new THREE.Vector3().addVectors(vTris[k * 3], vTris[k * 3 + 1]).add(vTris[k * 3 + 2]).multiplyScalar(1 / 3);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: coreTex, color: new THREE.Color(2.0, 1.95, 1.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    glow.scale.set(lite ? 6 : 8, lite ? 6 : 8, 1);
    glow.position.copy(p);
    group.add(glow);
    heads.push({ p: p.clone(), d: new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), p).normalize(), glow });
  }
  return { group, heads };
}
