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
  // treadmills facing the mirror. Each has its own belt (a scrolling slat texture) and console screen, so the
  // sprint drill (rooms/gym-ui.js) can run one up to speed: setTreadmillSpeed(v) below.
  const beltCanvas = (() => { const [c, x] = canvas(64, 256); x.fillStyle = '#101010'; x.fillRect(0, 0, 64, 256); x.fillStyle = '#1e1e1e'; for (let y = 0; y < 256; y += 16) x.fillRect(0, y, 64, 5); x.fillStyle = '#f2c418'; x.fillRect(0, 120, 64, 7); return c; })();
  const treads = [];
  function treadmill(i) {
    const g = new THREE.Group();
    const deck = box(0.8, 0.18, 1.9, M.steel); deck.position.set(0, 0.12, 0); g.add(deck);
    const bt = tex(beltCanvas, [1, 2]);
    const belt = box(0.56, 0.02, 1.6, std({ map: bt, roughness: 0.9 })); belt.position.set(0, 0.22, 0.05); belt.userData.noMerge = true; g.add(belt);
    for (const x of [-0.35, 0.35]) { const p = box(0.05, 1.2, 0.05, M.steel); p.position.set(x, 0.75, -0.85); p.rotation.x = 0.15; g.add(p); }
    const con = box(0.8, 0.32, 0.12, M.steel); con.position.set(0, 1.35, -0.95); con.rotation.x = 0.5; g.add(con);
    const [sc, sx] = canvas(256, 112), st = tex(sc);
    const scr = plane(0.5, 0.22, new THREE.MeshBasicMaterial({ map: st })); scr.position.set(0, 1.36, -0.88); scr.rotation.x = -Math.PI + 0.5; scr.rotation.y = Math.PI; scr.userData.noMerge = true; g.add(scr);
    const strip = box(0.8, 0.02, 0.02, M.yellow); strip.position.set(0, 0.215, 0.95); g.add(strip);
    // an invisible hit box: the rest of the machine is folded into the room's merged mesh (merge.js)
    const hit = box(0.85, 1.5, 2.0, new THREE.MeshBasicMaterial()); hit.position.set(0, 0.75, 0); hit.visible = false; g.add(hit);
    g.userData.click = 'gym:treadmill'; g.userData.treadmill = i;
    const T = { belt: bt, screen: [sc, sx, st], v: 0, shown: -1 };
    drawScreen(T, 0); treads.push(T);
    return g;
  }
  function drawScreen(T, v) {
    const [c, x, t] = T.screen, kmh = v * 3.6;
    x.fillStyle = '#10161b'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = kmh > 0.5 ? '#f2c418' : 'rgba(242,196,24,0.45)'; x.textAlign = 'center';
    x.font = '400 64px Anton'; x.fillText(kmh.toFixed(1), c.width / 2, 72);
    x.font = '700 22px Cairo'; x.fillStyle = 'rgba(255,255,255,0.6)'; x.fillText('KM/H', c.width / 2, 102);
    t.needsUpdate = true; T.shown = v;
  }
  for (let i = 0; i < 4; i++) add(treadmill(i), cx - 1.5 + i * 1.2, 0, Z1 - 1.5, Math.PI);
  // flat benches, plyo boxes, kettlebells, med balls
  for (const [x, z] of [[cx - 3.3, cz - 0.3], [cx - 1.6, cz - 0.3]]) { const b = box(0.32, 0.08, 1.2, M.pad); add(b, x, 0.46, z); add(box(0.08, 0.42, 1.0, M.steel), x, 0.21, z); }
  for (const [h, x] of [[0.3, 0], [0.45, 0.7], [0.6, 1.45]]) add(box(0.6, h, 0.75, M.wood), X1 - 3.8 - x, h / 2, Z0 + 2.7);   // clear of the doorway
  for (let i = 0; i < 6; i++) { const k = new THREE.Group(); const body = new THREE.Mesh(new THREE.SphereGeometry(0.09 + i * 0.01, 16, 12), M.plate); body.position.y = 0.1 + i * 0.01; k.add(body); const hd = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14, Math.PI), M.plate); hd.position.y = 0.2 + i * 0.02; k.add(hd); add(k, X1 - 5.4 + i * 0.32, 0, Z0 + 3.6); }
  for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), i % 2 ? M.yellow : M.plate), X0 + 1.2 + i * 0.4, 0.17, Z0 + 2.2);

  /* light */
  RectAreaLightUniformsLib.init();
  const lights = [];
  for (const z of [Z0 + 2, cz, Z1 - 2]) { const L = new THREE.RectAreaLight(0xffffff, 2.6, W - 3, 0.6); L.position.set(cx, H - 0.06, z); L.lookAt(cx, 0, z); group.add(L); lights.push([L, 2.6]); }

  /* drill stations (Ahmed, 2026-10-21: "mini drills on the equipment"): the reaction-light wall on the far wall,
     a press-up mat in front of the benches, and floating tags over the stations. rooms/gym-ui.js runs the drills. */
  const paintTag = (x, text) => {
    x.fillStyle = '#ffea00'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#0a0a0a'; x.fillRect(0, 118, 512, 10);
    x.fillStyle = '#0a0a0a'; x.textAlign = 'center'; x.font = `400 ${text.length > 10 ? 54 : 64}px Anton`; x.fillText(text, 256, 84);
  };
  const tag = (text, w = 1.15) => {
    const [c, x] = canvas(512, 128); paintTag(x, text);
    const t = tex(c), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false })); sp.scale.set(w, w / 4, 1);
    sp.userData.repaint = (txt) => { paintTag(x, txt); t.needsUpdate = true; };
    return sp;
  };
  const tags = [];
  let sprintTag = null, sprintLabel = 'SPRINT', sprintT = 0;
  // the reaction wall: 12 round lights in a black panel, 4 across, 3 down
  const LIT = { off: new THREE.Color(0.13, 0.13, 0.1), on: new THREE.Color(1.6, 1.4, 0.15), hit: new THREE.Color(0.25, 1.4, 0.45), miss: new THREE.Color(1.5, 0.22, 0.2), idle: new THREE.Color(0.24, 0.21, 0.04) };
  const lamps = [];
  {
    const g = new THREE.Group(); g.position.set(X0 + 0.04, 0, 54.6); g.rotation.y = Math.PI / 2; group.add(g);
    const plate = box(2.6, 1.72, 0.08, std({ color: 0x0b0b0b, roughness: 0.4 })); plate.position.set(0, 1.3, 0.04); plate.userData.noMerge = true; g.add(plate);
    const edge = box(2.66, 0.04, 0.1, M.yellow); edge.position.set(0, 2.17, 0.05); g.add(edge);
    const [c, x] = canvas(1024, 96); x.fillStyle = '#f1efe9'; x.textAlign = 'center'; x.font = '400 66px Anton'; x.fillText('REACTION WALL', 512, 74);
    const hd = plane(2.3, 2.3 * 96 / 1024, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); hd.position.set(0, 1.98, 0.085); g.add(hd);
    const bezel = std({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.35 });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
      const lx = -0.87 + k * 0.58, ly = 1.62 - r * 0.42;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.135, 0.17, 32), bezel); ring.position.set(lx, ly, 0.083); g.add(ring);
      const m = new THREE.MeshBasicMaterial({ color: LIT.off.clone() });
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.135, 32), m); dot.position.set(lx, ly, 0.082); dot.userData.noMerge = true; g.add(dot);
      lamps.push({ m, state: 'off', t: 0 });
    }
    g.userData.click = 'gym:lights';
  }
  // the press-up mat: yellow-edged, with hand marks
  let matM;
  {
    const g = new THREE.Group(); g.position.set(cx - 2.5, 0, 54.72); group.add(g);
    const [c, x] = canvas(1024, 480);
    x.fillStyle = '#ffea00'; x.fillRect(0, 0, 1024, 480); x.fillStyle = '#121212'; x.fillRect(16, 16, 992, 448);
    x.fillStyle = 'rgba(255,234,0,0.85)'; x.textAlign = 'center'; x.font = '400 120px Anton'; x.fillText('PRESS-UP', 600, 290);
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 8; for (const y of [110, 370]) { x.beginPath(); x.ellipse(170, y, 44, 60, 0, 0, Math.PI * 2); x.stroke(); }
    matM = new THREE.MeshBasicMaterial({ map: tex(c), color: new THREE.Color(0.85, 0.85, 0.85) });
    const mat = plane(1.9, 0.9, matM); mat.rotation.x = -Math.PI / 2; mat.position.y = 0.012; mat.userData.noMerge = true; g.add(mat);
    const hit = box(1.9, 0.5, 0.9, new THREE.MeshBasicMaterial()); hit.position.y = 0.25; hit.visible = false; g.add(hit);
    const t = tag('PRESS-UPS'); t.position.set(0, 1.0, 0); g.add(t); tags.push({ sp: t, y: 1.0, id: 'gym:pressup' });
    g.userData.click = 'gym:pressup';
  }
  {
    const t = sprintTag = tag('SPRINT'); t.position.set(cx + 0.3, 2.05, Z1 - 1.5); t.userData.click = 'gym:treadmill'; t.userData.treadmill = 1; group.add(t); tags.push({ sp: t, y: 2.05, id: 'gym:treadmill' });
    const w = tag('REACTION'); w.position.set(X0 + 0.5, 0.25, 54.6); w.userData.click = 'gym:lights'; group.add(w); tags.push({ sp: w, y: 0.25, id: 'gym:lights' });
  }

  const items = [];
  let lastT = 0, active = 1, hot = null, pulse = 0;
  function update(t, camera) {
    const p = camera.position;
    group.visible = p.x < 1 && p.z > Z0 - 8 && p.z < Z1 + 8;
    for (const [L, I] of lights) L.intensity = group.visible ? I : 0;
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    if (!group.visible) return -1;
    let run = 0;
    for (const T of treads) {
      if (T.v > 0.001) T.belt.offset.y = (T.belt.offset.y + T.v * dt / 1.6) % 1;
      if (Math.abs(T.v - T.shown) > 0.08 || (T.v === 0 && T.shown !== 0)) drawScreen(T, T.v);
      run = Math.max(run, T.v);
    }
    // the SPRINT tag reads the belt speed while one is running (the consoles face the mirror, away from you)
    const label = run > 0.05 ? `${(run * 3.6).toFixed(1)} KM/H` : 'SPRINT';
    if (label !== sprintLabel && (t - sprintT > 0.12 || label === 'SPRINT')) { sprintTag.userData.repaint(label); sprintLabel = label; sprintT = t; }
    for (const g of tags) { const k = g.id === hot ? 1.14 : 1; g.sp.position.y = g.y + Math.sin(t * 2 + g.y) * 0.03; g.sp.scale.set(1.15 * k, 1.15 * k / 4, 1); }
    matM.color.setScalar(0.85 + 0.55 * pulse);
    return -1;
  }
  const inside = (c) => { const p = c.position; return p.x < X1 - 0.4 && p.x > X0 && p.z > Z0 && p.z < Z1 && p.y < H; };
  group.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.fog = false; });
  return {
    group, items, update, inside, get focus() { return -1; },
    /* the drills' API (rooms/gym-ui.js) */
    treadmills: 4,
    // belt speed in m/s (0 stops it); i = which treadmill (default: the last one set, or the second from the left)
    setTreadmillSpeed(v, i = active) { active = i; const T = treads[i]; if (T) T.v = Math.max(0, v || 0); },
    lights: lamps.length,
    // state: 'off' | 'idle' (dimly lit: the drill is armed) | 'on' | 'hit' | 'miss'
    setLight(i, state = 'off') { const L = lamps[i]; if (!L) return; L.state = state; L.m.color.copy(LIT[state] || LIT.off); },
    clearLights(state = 'off') { lamps.forEach((_, i) => this.setLight(i, state)); },
    // 0..1: the press-up mat glows with the drill's beat
    pulseMat(k) { pulse = Math.max(0, Math.min(1, k || 0)); },
    // hover feedback: the station's tag grows
    highlight(id) { hot = id || null; },
  };
}
