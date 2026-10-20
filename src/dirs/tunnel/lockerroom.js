// The locker room as it really is (Ahmed's photos of the club's dressing room, 2026-10-15) — ?locker=actual.
// Built in the same frame as changing.js (x −9…9, z from the tunnel door at ZB to ZB + 16) so the tour,
// the door and the focus card work unchanged. From the photos:
//   · a run of open lockers on three walls, each under a yellow tiger-stripe header with the player's name
//     and number, and a dark band above carrying the club's lines "NUMBER ONE" / "THERE IS ONLY ONE"
//   · dark brown back panels with "AL-ITTIHAD FC", three steel hooks, the 26/27 home shirt on a hanger
//     turned to show name and number, bold diagonal tiger stripes on the lower panel
//   · a continuous walnut bench with a folded towel and kit at every place, a chrome boot rack under it,
//     sliders on the floor
//   · a light grey floor and a white tiled ceiling with square light panels and AC cassettes
// Every locker is the full first team (squad.js), in shirt-number order.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TN, DOORS } from './world.js';
import { SQUAD } from './squad.js';

const X0 = -9, X1 = 9, Z0 = TN.ZB, Z1 = TN.ZB + 16, HC = 3.45;   // HC: the real room's lower ceiling
const LW = 1.15, LD = 0.58;                                      // locker width, depth
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const rnd = (() => { let q = 11; return () => ((q = (q * 16807) % 2147483647) / 2147483647); })();
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
function fit(x, text, maxW, size, font, weight = 400) { x.font = `${weight} ${size}px ${font}`; while (x.measureText(text).width > maxW && size > 8) { size -= 2; x.font = `${weight} ${size}px ${font}`; } return size; }

// the header panels' print: club yellow with darker tiger-fur strokes running on the diagonal
function furStrokes(x, W, H, seed, col = 'rgba(150,108,8,0.42)') {
  let q = seed; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  x.fillStyle = col;
  for (let i = 0; i < Math.round(W * H / 2600); i++) {
    const cx = r() * W * 1.2 - W * 0.1, cy = r() * H, L = 40 + r() * 90, w = 4 + r() * 9, a = -0.9 + (r() - 0.5) * 0.35;
    x.save(); x.translate(cx, cy); x.rotate(a);
    x.beginPath(); x.moveTo(-L / 2, 0); x.quadraticCurveTo(0, -w, L / 2, 0); x.quadraticCurveTo(0, w * 0.4, -L / 2, 0); x.fill();
    x.restore();
  }
}
function headerTex(p) {
  const [c, x] = canvas(512, 270);
  x.fillStyle = '#e4be1e'; x.fillRect(0, 0, 512, 270);
  furStrokes(x, 512, 270, p.no * 97 + 13);
  const ink = '#3a2c12';
  x.textAlign = 'center'; x.fillStyle = ink;
  fit(x, p.shirt, 440, 34, 'Anton'); x.fillText(p.shirt, 256, 62);
  x.font = '400 168px Anton'; x.fillText(String(p.no), 256, 238);
  return tex(c);
}
// the lower back panel: bold diagonal black and yellow tiger stripes
let stripeT = null;
function stripeTex() {
  if (stripeT) return stripeT;
  const [c, x] = canvas(512, 384);
  x.fillStyle = '#1a1612'; x.fillRect(0, 0, 512, 384);
  x.fillStyle = '#e4be1e';
  for (let i = -3; i < 7; i++) {
    const ox = i * 120;
    x.beginPath(); x.moveTo(ox, 384); x.lineTo(ox + 70, 384); x.quadraticCurveTo(ox + 210, 200, ox + 330, 60); x.lineTo(ox + 300, 50); x.quadraticCurveTo(ox + 160, 210, ox, 384); x.fill();
  }
  // fade up into the dark panel, as in the photos
  const g = x.createLinearGradient(0, 0, 0, 384); g.addColorStop(0, 'rgba(46,39,36,1)'); g.addColorStop(0.28, 'rgba(46,39,36,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 384);
  stripeT = tex(c);
  return stripeT;
}
function backTextTex() {
  const [c, x] = canvas(512, 96);
  x.clearRect(0, 0, 512, 96); x.fillStyle = 'rgba(235,232,226,0.92)'; x.textAlign = 'center';
  fit(x, 'AL-ITTIHAD FC', 480, 66, 'Anton'); x.fillText('AL-ITTIHAD FC', 256, 74);
  return tex(c);
}
// the shirt: the store's own back photo of the 26/27 home shirt, with the name and number printed on it
export function shirtTex(img, p) {
  const W = 512, H = Math.round(512 * (img.height / img.width));
  const [c, x] = canvas(W, H);
  x.drawImage(img, 0, 0, W, H);
  x.fillStyle = '#141414'; x.textAlign = 'center';
  fit(x, p.shirt, W * 0.56, 44, 'Anton'); x.fillText(p.shirt, W / 2, H * 0.27);
  x.font = `400 ${Math.round(H * 0.3)}px Anton`; x.fillText(String(p.no), W / 2, H * 0.6);
  const t = tex(c); return t;
}
// the band over the headers: dark, with the club's line in white and a few claw marks
function bandTex(len, line) {
  const W = Math.min(8192, Math.round(len * 300)), H = 120;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#2b2522'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(240,238,232,0.95)'; x.font = '400 78px Anton'; x.textAlign = 'left';
  const tw = x.measureText(line).width, gap = Math.max(900, tw * 2.2);
  for (let px = 40; px < W; px += tw + gap) {
    x.fillText(line, px, 92);
    // three yellow claws trailing the words
    x.fillStyle = 'rgba(228,190,30,0.85)';
    for (let k = 0; k < 3; k++) { const ox = px + tw + 120 + k * 34; x.beginPath(); x.moveTo(ox, 110); x.quadraticCurveTo(ox + 30, 60, ox + 70, 12); x.lineTo(ox + 60, 10); x.quadraticCurveTo(ox + 20, 60, ox - 10, 110); x.fill(); }
    x.fillStyle = 'rgba(240,238,232,0.95)';
  }
  return tex(c);
}

export async function buildActualLockerRoom({ env, lite = false }) {
  const group = new THREE.Group();
  await Promise.all(['400 100px Anton'].map((f) => document.fonts.load(f).catch(() => {})));
  const [backImg, crestImg] = await Promise.all([loadImg('/img/jersey/back.webp'), loadImg('/img/crest.png')]);

  /* materials */
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 0.75, roughness: 0.7, ...o });
  const M = {
    panel: std({ color: 0x2e2724, roughness: 0.8 }),            // dark brown back panels and walls
    divider: std({ color: 0x3b3431, roughness: 0.6 }),
    edge: std({ color: 0x7d746e, roughness: 0.4, metalness: 0.3 }),
    band: std({ color: 0x2b2522 }),
    bench: std({ color: 0x6a361b, roughness: 0.22, envMapIntensity: 1.1 }),   // polished walnut
    steel: std({ color: 0xd8d9db, roughness: 0.2, metalness: 1 }),
    black: std({ color: 0x141414, roughness: 0.6 }),
    towel: std({ color: 0xf2f0ea, roughness: 0.95 }),
    kit: std({ color: 0x1b1b1d, roughness: 0.85 }),
    hanger: std({ color: 0x111111, roughness: 0.5 }),
    stripes: std({ map: stripeTex(), roughness: 0.75, envMapIntensity: 0.5 }),
    backText: new THREE.MeshBasicMaterial({ map: backTextTex(), transparent: true, depthWrite: false, color: new THREE.Color(0.8, 0.8, 0.8) }),
    wall: std({ color: 0x302a27, roughness: 0.85 }),
  };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  const W = X1 - X0, D = Z1 - Z0, cx = 0, cz = (Z0 + Z1) / 2;

  /* shell: light grey floor, white tiled ceiling with light panels, dark walls */
  {
    const [c, x] = canvas(1024, 1024);
    x.fillStyle = '#c9c9c5'; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 26000; i++) { const v = 180 + rnd() * 50; x.fillStyle = `rgba(${v},${v},${v - 2},0.5)`; x.fillRect(rnd() * 1024, rnd() * 1024, 1 + rnd() * 2, 1 + rnd() * 2); }
    const floor = plane(W, D, std({ map: tex(c, [4, 4]), roughness: 0.32, envMapIntensity: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.002, cz); group.add(floor);
  }
  {
    const [c, x] = canvas(512, 512);
    x.fillStyle = '#e9e8e3'; x.fillRect(0, 0, 512, 512);
    x.fillStyle = '#c3c2bd'; for (let i = 0; i <= 512; i += 128) { x.fillRect(i - 2, 0, 4, 512); x.fillRect(0, i - 2, 512, 4); }   // 60 cm tiles
    const ceil = plane(W, D, new THREE.MeshBasicMaterial({ map: tex(c, [W / 2.4, D / 2.4]), color: new THREE.Color(0.86, 0.86, 0.85) }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, HC, cz); group.add(ceil);
    const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 1.14, 1.1) });
    for (let z = Z0 + 2.1; z < Z1 - 1; z += 2.4) for (let xx = -6; xx <= 6; xx += 3) { const l = plane(0.58, 0.58, lampM); l.rotation.x = Math.PI / 2; l.position.set(xx, HC - 0.01, z); group.add(l); }
    // two AC cassettes, as in the photos
    const [ac, ax] = canvas(256, 256); ax.fillStyle = '#e2e1dc'; ax.fillRect(0, 0, 256, 256); ax.strokeStyle = '#b4b3ae'; ax.lineWidth = 3;
    for (let i = 0; i < 4; i++) { ax.strokeRect(20 + i * 6, 20 + i * 6, 216 - i * 12, 216 - i * 12); } ax.fillStyle = '#9d9c97'; ax.fillRect(78, 78, 100, 100);
    for (const [xx, zz] of [[-4.5, Z0 + 6], [4.5, Z0 + 10.8]]) { const a = box(0.84, 0.06, 0.84, std({ map: tex(ac), roughness: 0.6 })); a.position.set(xx, HC - 0.03, zz); group.add(a); }
  }
  const back = plane(W, HC, M.wall); back.rotation.y = Math.PI; back.position.set(cx, HC / 2, Z1); group.add(back);
  const left = plane(D, HC, M.wall); left.rotation.y = Math.PI / 2; left.position.set(X0, HC / 2, cz); group.add(left);
  const right = plane(D, HC, M.wall); right.rotation.y = -Math.PI / 2; right.position.set(X1, HC / 2, cz); group.add(right);
  const [d0, d1] = DOORS.back;
  for (const [x0, x1, y0] of [[X0, d0, 0], [d1, X1, 0], [d0, d1, DOORS.h]]) {
    const hgt = HC - y0, seg = plane(x1 - x0, hgt, M.wall);
    seg.position.set((x0 + x1) / 2, y0 + hgt / 2, Z0 + 0.12); group.add(seg);
  }
  for (const xx of [d0, d1]) { const b = box(0.08, DOORS.h, 0.16, M.edge); b.position.set(xx, DOORS.h / 2, Z0 + 0.06); group.add(b); }
  const lint = box(d1 - d0 + 0.08, 0.08, 0.16, M.edge); lint.position.set(0, DOORS.h, Z0 + 0.06); group.add(lint);
  // the crest on the door wall either side, like the badge on the photos' end wall
  if (crestImg) {
    const ct = new THREE.Texture(crestImg); ct.colorSpace = THREE.SRGBColorSpace; ct.needsUpdate = true;
    for (const xx of [-5.2, 5.2]) { const cr = plane(1.3, 1.3 * (crestImg.height / crestImg.width), new THREE.MeshBasicMaterial({ map: ct, transparent: true, color: new THREE.Color(0.9, 0.9, 0.9) })); cr.position.set(xx, 1.9, Z0 + 0.13); group.add(cr); }
  }

  /* the lockers */
  const players = [...SQUAD].sort((a, b) => a.no - b.no);
  const nSide = 8, nBack = players.length - nSide * 2;            // 8 down each side, the rest across the back
  const runs = [
    // [players, origin of the run's first locker edge, along-wall direction, into-room normal]
    // each wall reads left to right in number order as you face it
    { list: players.slice(0, nSide), o: new THREE.Vector3(X0, 0, Z1 - 0.62), dir: new THREE.Vector3(0, 0, -1), n: new THREE.Vector3(1, 0, 0), line: 'NUMBER ONE' },
    { list: players.slice(nSide, nSide + nBack), o: new THREE.Vector3(nBack * LW / 2, 0, Z1), dir: new THREE.Vector3(-1, 0, 0), n: new THREE.Vector3(0, 0, -1), line: 'THERE IS ONLY ONE' },
    { list: players.slice(nSide + nBack), o: new THREE.Vector3(X1, 0, Z1 - 0.62 - nSide * LW), dir: new THREE.Vector3(0, 0, 1), n: new THREE.Vector3(-1, 0, 0), line: 'NUMBER ONE' },
  ];
  const items = [];
  const shirtH = 0.86, shirtW = backImg ? shirtH * (backImg.width / backImg.height) : 0.64;
  const geo = {
    hook: new THREE.CylinderGeometry(0.022, 0.022, 0.05, 12),
    shirt: (() => { const g = new THREE.PlaneGeometry(shirtW, shirtH, 8, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getX(i) / (shirtW / 2); p.setZ(i, -0.04 * u * u); } g.computeVertexNormals(); return g; })(),
    towel: new THREE.BoxGeometry(0.42, 0.07, 0.3), kit: new THREE.BoxGeometry(0.34, 0.05, 0.26), boot: new THREE.BoxGeometry(0.1, 0.09, 0.28), slide: new THREE.BoxGeometry(0.11, 0.03, 0.27),
    bottle: new THREE.CylinderGeometry(0.035, 0.035, 0.21, 14),
  };
  const bootMs = [0xf2f2ee, 0x151515, 0xe8d31a, 0xc23b2a, 0x3a6fd8].map((c) => std({ color: c, roughness: 0.5 }));
  const bottleM = new THREE.MeshPhysicalMaterial({ color: 0xdfeff7, roughness: 0.1, transparent: true, opacity: 0.55, envMap: env, envMapIntensity: 1.2 });
  const yB = 0.5, yH0 = 2.28, yH1 = 2.88, yBand = 3.33;          // bench top, header bottom/top, band top

  for (const run of runs) {
    const n = run.list.length, len = n * LW;
    const frame = new THREE.Group();
    frame.position.copy(run.o);
    frame.rotation.y = Math.atan2(run.n.x, run.n.z);                 // local +z into the room
    // which way is local +x along the wall?
    const lx = new THREE.Vector3(1, 0, 0).applyEuler(frame.rotation), sgn = lx.dot(run.dir) > 0 ? 1 : -1;
    group.add(frame);
    const at = (s) => sgn * s;                                       // position along the run, in local x
    // continuous pieces: bench, band, boot rails
    const mid = at(len / 2);
    const bench = box(len, 0.06, LD + 0.06, M.bench); bench.position.set(mid, yB - 0.03, (LD + 0.06) / 2); frame.add(bench);
    const lip = box(len, 0.04, 0.03, M.bench); lip.position.set(mid, yB - 0.075, LD + 0.045); frame.add(lip);
    const band = box(len, yBand - yH1, LD, M.band); band.position.set(mid, (yH1 + yBand) / 2, LD / 2); frame.add(band);
    const bandFace = plane(len, yBand - yH1, new THREE.MeshBasicMaterial({ map: bandTex(len, run.line), color: new THREE.Color(0.9, 0.9, 0.9) }));
    bandFace.position.set(mid, (yH1 + yBand) / 2, LD + 0.002); frame.add(bandFace);
    const above = box(len, HC - yBand, 0.1, M.wall); above.position.set(mid, (yBand + HC) / 2, 0.05); frame.add(above);
    for (const [y, z] of [[0.13, 0.16], [0.13, 0.42], [0.22, 0.29]]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 8), M.steel); r.rotation.z = Math.PI / 2; r.position.set(mid, y, z); frame.add(r);
    }
    for (let i = 0; i <= n; i++) {
      // dividers with a lighter edge, and a leg under the bench at each
      const xx = at(i * LW);
      const dv = box(0.07, yH0 - yB, LD - 0.06, M.divider); dv.position.set(xx, (yB + yH0) / 2, (LD - 0.06) / 2); frame.add(dv);
      const ed = box(0.075, yH0 - yB, 0.025, M.edge); ed.position.set(xx, (yB + yH0) / 2, LD - 0.05); frame.add(ed);
      const leg = box(0.05, yB - 0.06, 0.5, M.black); leg.position.set(xx, (yB - 0.06) / 2, 0.28); frame.add(leg);
    }
    run.list.forEach((p, i) => {
      const xc = at((i + 0.5) * LW);
      const L = new THREE.Group(); L.position.x = xc; frame.add(L);
      const bp = box(LW - 0.05, yH0 - yB, 0.03, M.panel); bp.position.set(0, (yB + yH0) / 2, 0.015); L.add(bp);
      const st = plane(LW - 0.07, 0.78, M.stripes); st.position.set(0, yB + 0.39, 0.032); L.add(st);
      const bt = plane(LW * 0.86, LW * 0.86 * (96 / 512), M.backText); bt.position.set(0, 1.98, 0.032); L.add(bt);
      for (const hx of [-0.3, 0, 0.3]) { const h = new THREE.Mesh(geo.hook, M.steel); h.rotation.x = Math.PI / 2; h.position.set(hx, 2.1, 0.055); L.add(h); }
      // header: a solid block flush with the dividers, the tiger print on its face
      const hb = box(LW - 0.012, yH1 - yH0, LD, M.band); hb.position.set(0, (yH0 + yH1) / 2, LD / 2); L.add(hb);
      const hf = plane(LW - 0.02, yH1 - yH0, new THREE.MeshStandardMaterial({ map: headerTex(p), roughness: 0.55, envMap: env, envMapIntensity: 0.6, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 }));
      hf.material.emissiveMap = hf.material.map; hf.material.emissiveIntensity = 0.2;
      hf.position.set(0, (yH0 + yH1) / 2, LD + 0.002); L.add(hf);
      // the shirt on its hanger, back to the room
      let shirt = null;
      if (backImg) {
        const sm = new THREE.MeshStandardMaterial({ map: shirtTex(backImg, p), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75, envMap: env, envMapIntensity: 0.7, emissive: 0x000000 });   // lit only: emissive washed the yellow out
        shirt = new THREE.Mesh(geo.shirt, sm); shirt.position.set(0, 2.06 - 0.05 - shirtH / 2, 0.16); shirt.userData.z0 = 0.16; L.add(shirt);
        const bar = box(0.4, 0.014, 0.014, M.hanger); bar.position.set(0, 2.0, 0.17); L.add(bar);
        const hk = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 6, 14, Math.PI * 1.4), M.steel); hk.position.set(0, 2.06, 0.15); hk.rotation.z = -0.6; L.add(hk);
      }
      // on the bench: a folded towel, the kit on it, sometimes a bottle
      const tw = new THREE.Mesh(geo.towel, M.towel); tw.position.set(-0.08 + (rnd() - 0.5) * 0.06, yB + 0.035, 0.3); tw.rotation.y = (rnd() - 0.5) * 0.2; L.add(tw);
      const kt = new THREE.Mesh(geo.kit, M.kit); kt.position.set(tw.position.x + 0.02, yB + 0.095, 0.3); kt.rotation.y = tw.rotation.y + (rnd() - 0.5) * 0.15; L.add(kt);
      if (rnd() < 0.45) { const b = new THREE.Mesh(geo.bottle, bottleM); b.position.set(0.32, yB + 0.105, 0.22); L.add(b); }
      // under it: boots on the rack, sliders on the floor
      if (!lite) {
        const bm = bootMs[Math.floor(rnd() * bootMs.length)];
        for (const s of [-1, 1]) { const b = new THREE.Mesh(geo.boot, bm); b.position.set(-0.2 + s * 0.07, 0.27, 0.3); b.rotation.y = (rnd() - 0.5) * 0.2; L.add(b); }
        for (const s of [-1, 1]) { const sl = new THREE.Mesh(geo.slide, M.black); sl.position.set(0.18 + s * 0.07, 0.015, 0.78 + rnd() * 0.06); sl.rotation.y = (rnd() - 0.5) * 0.3; L.add(sl); }
      }
      L.updateMatrixWorld(true);
      items.push({ data: { ...p, kind: 'player' }, lock: L, shirt, ph: rnd() * 6.28 });
    });
  }
  // the corners where the runs meet: dark panels to the ceiling
  for (const sx of [-1, 1]) { const c = box(Math.abs(X1) - nBack * LW / 2, HC, 0.62, M.wall); c.position.set(sx * (nBack * LW / 2 + (Math.abs(X1) - nBack * LW / 2) / 2), HC / 2, Z1 - 0.31); group.add(c); }

  /* light: area lights standing in for the ceiling panels */
  RectAreaLightUniformsLib.init();
  const lights = [];
  for (const z of [Z0 + 4, Z0 + 8.5, Z0 + 13]) { const L = new THREE.RectAreaLight(0xffffff, 2.0, 12, 3); L.position.set(0, HC - 0.05, z); L.lookAt(0, 0, z); group.add(L); lights.push(L); }
  for (const [x, z, ry] of [[0, Z1 - 1.6, 0], [X0 + 1.6, cz + 2, 1], [X1 - 1.6, cz + 2, -1]]) {
    // washers on the lockers so the headers and shirts read
    const L = new THREE.RectAreaLight(0xfff6ea, 1.1, ry ? 9 : 14, 0.6); L.position.set(x, HC - 0.1, z); L.lookAt(x + (ry ? -ry * 1.4 : 0), 1.4, z + (ry ? 0 : 1.4)); group.add(L); lights.push(L);
  }

  /* placement in the tunnel's frame, and focus on the locker you face */
  const inv = new THREE.Matrix4(), lc = new THREE.Vector3();
  const local = (p) => lc.copy(p).applyMatrix4(inv);
  function place(matrixWorld) { inv.copy(matrixWorld).invert(); group.updateMatrixWorld(true); items.forEach((it) => { it.focusPos = new THREE.Vector3(0, 1.75, 0.3).applyMatrix4(it.lock.matrixWorld).applyMatrix4(inv); }); }
  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  let focus = -1;
  function update(t, camera) {
    const c0 = local(camera.position);
    group.visible = c0.z > Z0 - 7.5 && Math.abs(c0.x) < 12 && c0.y < 8;
    for (const L of lights) L.intensity = group.visible ? (L.height > 1 ? 2.0 : 1.1) : 0;
    if (!group.visible) return focus;
    const inside = c0.z > Z0 + 0.4 && c0.y < HC;
    camera.getWorldDirection(fwd);
    let best = -1, bd = 0.975;
    if (inside) items.forEach((c, i) => {
      if (!c.focusPos) return;
      to.copy(c.focusPos).applyMatrix4(group.matrixWorld).sub(camera.position);
      if (to.length() > 10) return;
      const s = fwd.dot(to.normalize());
      if (s > bd) { bd = s; best = i; }
    });
    focus = best;
    if (!lite) items.forEach((c, i) => { if (!c.shirt) return; c.shirt.rotation.z = Math.sin(t * 0.8 + c.ph) * 0.01; c.shirt.position.z = c.shirt.userData.z0 + (i === focus ? 0.05 : 0); });
    return focus;
  }
  const inside = (c) => { const p = local(c.position); return p.z > Z0 + 0.4 && p.z < Z1 && p.x > X0 && p.x < X1 && p.y < HC; };
  return { group, items, update, place, get focus() { return focus; }, inside };
}
