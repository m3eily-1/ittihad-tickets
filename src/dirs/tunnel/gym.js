// The gym (Ahmed, 2026-10-15: "pro training gym"): a side room off the tunnel's left wall, near the mouth,
// across from the hall of fame. Black rubber floor, a turf sprint lane, two power racks with loaded bars,
// a dumbbell rack, benches, treadmills facing a mirror wall, plyo boxes, kettlebells and med balls, the
// tunnel's black tiger print on the walls with "UNLEASH THE TIGER." and the crest. No product cards here.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TN, DOORS } from './world.js';
import { muralTex, QUOTES } from './posters.js';

export const GYM = { X0: -19.5, X1: -TN.HW, Z0: 49.6, Z1: 57.8, H: 4.0 };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

export async function buildGym({ env, lite = false }) {
  const { X0, X1, Z0, Z1, H } = GYM;
  const group = new THREE.Group();
  const crest = await loadImg('/img/crest.png');
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 0.6, roughness: 0.6, ...o });
  const M = {
    steel: std({ color: 0x1c1c1e, metalness: 0.7, roughness: 0.35 }), chrome: std({ color: 0xd9dadc, metalness: 1, roughness: 0.15 }),
    yellow: std({ color: 0xf2c418, roughness: 0.5 }), plate: std({ color: 0x121212, roughness: 0.55 }), pad: std({ color: 0x161616, roughness: 0.8 }),
    rubber: std({ color: 0x0e0e0e, roughness: 0.9 }), wood: std({ color: 0x8a5a33, roughness: 0.6 }), screen: new THREE.MeshBasicMaterial({ color: 0x1f2a33 }),
  };
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const cyl = (r, h, m, seg = 20) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
  const add = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; group.add(o); return o; };

  /* shell */
  const [fc, fx] = canvas(512, 512);
  fx.fillStyle = '#151516'; fx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { const v = 22 + Math.random() * 30; fx.fillStyle = `rgba(${v},${v},${v},0.7)`; fx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5); }   // rubber crumb
  fx.fillStyle = '#0b0b0b'; fx.fillRect(0, 0, 512, 3); fx.fillRect(0, 0, 3, 512);   // 1 m tiles
  const floor = plane(W, D, std({ map: tex(fc, [W, D]), roughness: 0.85 })); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.002, cz); group.add(floor);
  // the turf sprint lane along the south wall, with white lines and yard marks
  const [tc, tx] = canvas(2048, 256);
  tx.fillStyle = '#2f6b2a'; tx.fillRect(0, 0, 2048, 256);
  for (let i = 0; i < 30000; i++) { const g = 80 + Math.random() * 70; tx.fillStyle = `rgba(30,${g},30,0.5)`; tx.fillRect(Math.random() * 2048, Math.random() * 256, 1, 3); }
  tx.fillStyle = '#f2f2ee'; tx.fillRect(0, 10, 2048, 8); tx.fillRect(0, 238, 2048, 8); for (let i = 1; i < 10; i++) tx.fillRect(i * 2048 / 10, 18, 6, 220);
  const turf = plane(W - 1, 1.8, std({ map: tex(tc), roughness: 0.95 })); turf.rotation.x = -Math.PI / 2; turf.position.set(cx - 0.3, 0.006, Z0 + 1.1); group.add(turf);
  const ceil = plane(W, D, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.07, 0.07, 0.075) })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz); group.add(ceil);
  const ledM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.1, 1.08) });
  for (const z of [Z0 + 2, cz, Z1 - 2]) add(box(W - 3, 0.04, 0.12, ledM), cx, H - 0.03, z);
  const wallM = (w, h, k = 2) => new THREE.MeshBasicMaterial({ map: muralTex(QUOTES[0], w / h, null, k, true, true, true), color: new THREE.Color(0.7, 0.7, 0.7) });
  const back = plane(D, H, wallM(D, H, 4)); back.rotation.y = Math.PI / 2; back.position.set(X0, H / 2, cz); group.add(back);
  const north = plane(W, H, wallM(W, H, 5)); north.rotation.y = Math.PI; north.position.set(cx, H / 2, Z1); group.add(north);
  const south = plane(W, H, wallM(W, H, 6)); south.position.set(cx, H / 2, Z0); group.add(south);
  const [d0, d1] = DOORS.gym;
  for (const [z0, z1, door] of [[Z0, d0, false], [d0, d1, true], [d1, Z1, false]]) {
    const y0 = door ? DOORS.h : 0, hgt = H - y0;
    const seg = plane(z1 - z0, hgt, wallM(z1 - z0, hgt)); seg.rotation.y = -Math.PI / 2; seg.position.set(X1 - 0.12, y0 + hgt / 2, (z0 + z1) / 2); group.add(seg);
  }
  // the far wall: the club's line, worn white, and the crest
  {
    const [c, x] = canvas(2048, 512);
    x.textAlign = 'left'; x.font = '400 230px Anton'; x.fillStyle = '#f1efe9'; x.fillText('UNLEASH', 40, 230); x.fillStyle = '#f2c418'; x.fillText('THE TIGER.', 40, 470);
    x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 26000; i++) { x.globalAlpha = 0.4 + Math.random() * 0.6; x.fillRect(Math.random() * 2048, Math.random() * 512, 2, 2); }
    const s = plane(5.0, 1.25, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); s.rotation.y = Math.PI / 2; s.position.set(X0 + 0.03, 2.9, cz - 0.7); group.add(s);
  }
  if (crest) { const ct = new THREE.Texture(crest); ct.colorSpace = THREE.SRGBColorSpace; ct.needsUpdate = true; const cr = plane(1.2, 1.2 * (crest.height / crest.width), new THREE.MeshBasicMaterial({ map: ct, transparent: true })); cr.rotation.y = Math.PI / 2; cr.position.set(X0 + 0.03, 2.75, Z1 - 0.9); group.add(cr); }

  /* mirror wall along the north side, behind the treadmills */
  // (a real mirror needs a second render of the room; a dark smoked-glass panel with a frame reads better than flat grey)
  const mirror = plane(6.4, 2.0, new THREE.MeshPhysicalMaterial({ color: 0x2a2d31, metalness: 0.9, roughness: 0.08, envMap: env, envMapIntensity: 0.9 }));
  mirror.rotation.y = Math.PI; mirror.position.set(cx + 0.6, 1.35, Z1 - 0.03); group.add(mirror);
  const mf = box(6.5, 2.1, 0.02, M.yellow); mf.position.set(cx + 0.6, 1.35, Z1 - 0.015); group.add(mf);

  /* equipment */
  // power racks with a loaded bar and a bench inside
  function rack() {
    const g = new THREE.Group();
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const u = box(0.08, 2.3, 0.08, M.steel); u.position.set(x, 1.15, z); g.add(u); }
    for (const z of [-0.6, 0.6]) { const t = box(1.28, 0.08, 0.08, M.steel); t.position.set(0, 2.3, z); g.add(t); }
    for (const x of [-0.6, 0.6]) { const t = box(0.08, 0.08, 1.28, M.steel); t.position.set(x, 2.3, 0); g.add(t); }
    const base = box(1.5, 0.04, 1.5, M.wood); base.position.y = 0.02; g.add(base);
    const bar = cyl(0.016, 2.2, M.chrome); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.45, -0.62); g.add(bar);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const p = cyl(0.225 - k * 0.04, 0.05, k ? M.plate : M.yellow, 28); p.rotation.z = Math.PI / 2; p.position.set(s * (0.82 + k * 0.055), 1.45, -0.62); g.add(p); }
    const bench = box(0.3, 0.06, 1.2, M.pad); bench.position.set(0, 0.45, 0.05); g.add(bench);
    const leg = box(0.06, 0.42, 1.0, M.steel); leg.position.set(0, 0.21, 0.05); g.add(leg);
    return g;
  }
  add(rack(), X0 + 2.2, 0, Z0 + 2.3);
  add(rack(), X0 + 4.6, 0, Z0 + 2.3);
  // dumbbell rack: two tiers, pairs getting bigger
  {
    const g = new THREE.Group();
    for (const y of [0.55, 0.9]) { const s = box(3.2, 0.04, 0.35, M.steel); s.position.set(0, y, 0); s.rotation.x = y > 0.6 ? -0.2 : -0.1; g.add(s); }
    for (const x of [-1.55, 1.55]) { const l = box(0.06, 0.95, 0.4, M.steel); l.position.set(x, 0.47, 0); g.add(l); }
    for (let i = 0; i < 8; i++) for (const tier of [0, 1]) {
      const s = 0.06 + i * 0.008, x = -1.4 + i * 0.4, y = tier ? 0.98 : 0.63;
      const h = cyl(0.012, 0.32, M.chrome, 8); h.rotation.z = Math.PI / 2; h.position.set(x, y, 0); g.add(h);
      for (const e of [-1, 1]) { const b = cyl(s, 0.07, tier ? M.yellow : M.plate, 6); b.rotation.z = Math.PI / 2; b.position.set(x + e * 0.12, y, 0); g.add(b); }
    }
    add(g, cx + 1.2, 0, Z0 + 2.6);
  }
  // treadmills facing the mirror
  function treadmill() {
    const g = new THREE.Group();
    const deck = box(0.8, 0.18, 1.9, M.steel); deck.position.set(0, 0.12, 0); g.add(deck);
    const belt = box(0.56, 0.02, 1.6, M.rubber); belt.position.set(0, 0.22, 0.05); g.add(belt);
    for (const x of [-0.35, 0.35]) { const p = box(0.05, 1.2, 0.05, M.steel); p.position.set(x, 0.75, -0.85); p.rotation.x = 0.15; g.add(p); }
    const con = box(0.8, 0.32, 0.12, M.steel); con.position.set(0, 1.35, -0.95); con.rotation.x = 0.5; g.add(con);
    const scr = plane(0.5, 0.22, M.screen); scr.position.set(0, 1.36, -0.88); scr.rotation.x = -Math.PI + 0.5; scr.rotation.y = Math.PI; g.add(scr);
    const strip = box(0.8, 0.02, 0.02, M.yellow); strip.position.set(0, 0.215, 0.95); g.add(strip);
    return g;
  }
  for (let i = 0; i < 4; i++) add(treadmill(), cx - 1.5 + i * 1.2, 0, Z1 - 1.5, Math.PI);
  // flat benches, plyo boxes, kettlebells, med balls
  for (const [x, z] of [[cx - 3.3, cz - 0.3], [cx - 1.6, cz - 0.3]]) { const b = box(0.32, 0.08, 1.2, M.pad); add(b, x, 0.46, z); add(box(0.08, 0.42, 1.0, M.steel), x, 0.21, z); }
  for (const [h, x] of [[0.3, 0], [0.45, 0.7], [0.6, 1.45]]) add(box(0.6, h, 0.75, M.wood), X1 - 1.6 - x, h / 2, Z0 + 2.7);
  for (let i = 0; i < 6; i++) { const k = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.09 + i * 0.01, 16, 12), M.plate); body.position.y = 0.1 + i * 0.01; k.add(body); const hd = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI), M.plate); hd.position.y = 0.2 + i * 0.02; k.add(hd); add(k, X1 - 5.4 + i * 0.32, 0, Z0 + 3.6); }
  for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), i % 2 ? M.yellow : M.plate), X0 + 1.2 + i * 0.4, 0.17, Z0 + 2.2);

  /* light */
  RectAreaLightUniformsLib.init();
  const lights = [];
  for (const z of [Z0 + 2, cz, Z1 - 2]) { const L = new THREE.RectAreaLight(0xffffff, 2.6, W - 3, 0.6); L.position.set(cx, H - 0.06, z); L.lookAt(cx, 0, z); group.add(L); lights.push([L, 2.6]); }

  const items = [];
  function update(t, camera) {
    const p = camera.position;
    group.visible = p.x < 1 && p.z > Z0 - 8 && p.z < Z1 + 8;
    for (const [L, I] of lights) L.intensity = group.visible ? I : 0;
    return -1;
  }
  const inside = (c) => { const p = c.position; return p.x < X1 - 0.4 && p.x > X0 && p.z > Z0 && p.z < Z1 && p.y < H; };
  group.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.fog = false; });
  return { group, items, update, inside, get focus() { return -1; } };
}
