// The hall of fame (Ahmed, 2026-10-15): a side room off the tunnel's right wall, near the mouth. Twelve
// legends (legends.js, each sourced) on tall black panels around the walls, a spotlight pool on each, the
// room's title over the far wall. No photos yet — the club or Ahmed would need to supply them with rights —
// so each panel is typographic: years, name, Arabic name, position, the sourced achievements, the crest.
// The room sits between the tunnel and the bowl: its ceiling is kept under the lower tier's deck.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TN, DOORS } from './world.js';
import { LEGENDS } from './legends.js';
import { muralTex, QUOTES } from './posters.js';

export const FAME = { X0: TN.HW, X1: 19.5, Z0: 49.6, Z1: 57.8, H: 4.0 };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
function fit(x, text, maxW, size, font, weight = 400) { x.font = `${weight} ${size}px ${font}`; while (x.measureText(text).width > maxW && size > 8) { size -= 2; x.font = `${weight} ${size}px ${font}`; } return size; }
function wrap(x, text, maxW) { const out = []; let line = ''; for (const w of text.split(' ')) { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
const GOLD = '#e0b520';

function legendTex(L, crest, i) {
  const W = 640, H = 1280, [c, x] = canvas(W, H);
  x.fillStyle = '#0c0c0d'; x.fillRect(0, 0, W, H);
  // faint tiger print, as on the tunnel walls
  let q = 77 + i * 131; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  x.fillStyle = 'rgba(255,255,255,0.05)';
  for (let k = 0; k < 90; k++) { const cx = r() * W, cy = r() * H, Lg = 80 + r() * 220, w = 8 + r() * 22; x.save(); x.translate(cx, cy); x.rotate(-0.6 + (r() - 0.5) * 0.5); x.beginPath(); x.moveTo(-Lg / 2, 0); x.quadraticCurveTo(0, -w, Lg / 2, 0); x.quadraticCurveTo(0, w * 0.4, -Lg / 2, 0); x.fill(); x.restore(); }
  // gold frame
  x.strokeStyle = GOLD; x.lineWidth = 6; x.strokeRect(22, 22, W - 44, H - 44);
  x.lineWidth = 2; x.strokeRect(36, 36, W - 72, H - 72);
  // the crest, large and dim, behind the name
  if (crest) { x.globalAlpha = 0.12; const cw = 440, ch = cw * (crest.height / crest.width); x.drawImage(crest, (W - cw) / 2, 230, cw, ch); x.globalAlpha = 1; }
  x.textAlign = 'center';
  x.fillStyle = GOLD; x.font = '400 64px Anton'; x.fillText(L.years, W / 2, 140);
  x.fillStyle = 'rgba(255,255,255,0.7)'; x.font = '700 30px Cairo'; x.fillText(L.pos, W / 2, 190);
  // the name, stacked, as big as it fits
  const parts = L.name.toUpperCase().split(' ');
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : '', last = parts[parts.length - 1];
  x.fillStyle = '#f1efe9';
  if (first) { fit(x, first, W - 120, 72, 'Anton'); x.fillText(first, W / 2, 560); }
  const ls = fit(x, last, W - 100, 150, 'Anton'); x.fillText(last, W / 2, 560 + ls * 0.95 + 10);
  if (L.ar) { x.fillStyle = GOLD; x.font = '700 48px Cairo'; x.fillText(L.ar, W / 2, 560 + ls + 90); }
  // what they did
  x.fillStyle = GOLD; x.fillRect(W / 2 - 60, 880, 120, 4);
  x.font = '600 32px Cairo'; x.fillStyle = 'rgba(255,255,255,0.88)';
  let y = 950;
  for (const f of L.facts) { for (const ln of wrap(x, f, W - 140)) { x.fillText(ln, W / 2, y); y += 42; } y += 18; }
  if (crest) { const cw = 90, ch = cw * (crest.height / crest.width); x.drawImage(crest, (W - cw) / 2, H - 70 - ch, cw, ch); }
  return tex(c);
}

export async function buildFame({ env }) {
  const { X0, X1, Z0, Z1, H } = FAME;
  const group = new THREE.Group();
  await document.fonts.load('400 100px Anton').catch(() => {});
  await document.fonts.load('700 40px Cairo').catch(() => {});
  const crest = await loadImg('/img/crest.png');
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 0.45, roughness: 0.6, ...o });
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  /* shell: polished black stone floor, the tunnel's black print on the walls, a dark ceiling */
  const [fc, fx] = canvas(1024, 1024);
  fx.fillStyle = '#121213'; fx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 40; i++) { fx.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`; fx.lineWidth = 1 + Math.random() * 2; fx.beginPath(); let px = Math.random() * 1024, py = Math.random() * 1024; fx.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (Math.random() - 0.4) * 160; py += (Math.random() - 0.5) * 160; fx.lineTo(px, py); } fx.stroke(); }   // marble veins
  fx.strokeStyle = 'rgba(224,181,32,0.35)'; fx.lineWidth = 3; for (let i = 0; i <= 1024; i += 256) { fx.beginPath(); fx.moveTo(i, 0); fx.lineTo(i, 1024); fx.stroke(); fx.beginPath(); fx.moveTo(0, i); fx.lineTo(1024, i); fx.stroke(); }   // brass joints
  const floor = plane(W, D, std({ map: tex(fc, [W / 4, D / 4]), roughness: 0.18, envMapIntensity: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.002, cz); group.add(floor);
  const ceil = plane(W, D, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.05, 0.055) })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz); group.add(ceil);
  const wallM = (w, h) => new THREE.MeshBasicMaterial({ map: muralTex(QUOTES[0], w / h, null, 3, true, true, true), color: new THREE.Color(0.55, 0.55, 0.55) });
  const back = plane(D, H, wallM(D, H)); back.rotation.y = -Math.PI / 2; back.position.set(X1, H / 2, cz); group.add(back);
  const north = plane(W, H, wallM(W, H)); north.rotation.y = Math.PI; north.position.set(cx, H / 2, Z1); group.add(north);
  const south = plane(W, H, wallM(W, H)); south.position.set(cx, H / 2, Z0); group.add(south);
  const [d0, d1] = DOORS.fame;
  for (const [z0, z1, door] of [[Z0, d0, false], [d0, d1, true], [d1, Z1, false]]) {
    const y0 = door ? DOORS.h : 0, hgt = H - y0;
    const seg = plane(z1 - z0, hgt, wallM(z1 - z0, hgt)); seg.rotation.y = Math.PI / 2; seg.position.set(X0 + 0.12, y0 + hgt / 2, (z0 + z1) / 2); group.add(seg);
  }

  /* the title over the far wall */
  {
    const [c, x] = canvas(2048, 300);
    x.textAlign = 'center'; x.fillStyle = '#f1efe9'; x.font = '400 170px Anton'; x.fillText('HALL OF FAME', 1024, 190);
    x.fillStyle = GOLD; x.font = '700 70px Cairo'; x.fillText('قاعة المشاهير', 1024, 280);
    const t = plane(5.2, 5.2 * (300 / 2048), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); t.rotation.y = -Math.PI / 2; t.position.set(X1 - 0.05, H - 0.55, cz); group.add(t);
  }

  /* the legends: panels on three walls, each with a brass rail and a pool of light */
  const PW = 1.3, PH = 2.6, PY = 0.35 + PH / 2;
  const slots = [];
  // far wall (x = X1): 4; long walls (z = Z1, z = Z0): 4 each, kept clear of the door end
  for (let i = 0; i < 4; i++) slots.push({ x: X1 - 0.06, z: Z0 + 1.1 + (i + 0.5) * ((D - 2.2) / 4), ry: -Math.PI / 2 });
  for (let i = 0; i < 4; i++) slots.push({ x: X1 - 2.0 - i * 3.3, z: Z1 - 0.06, ry: Math.PI });
  for (let i = 0; i < 4; i++) slots.push({ x: X1 - 2.0 - i * 3.3, z: Z0 + 0.06, ry: 0 });
  const poolTex = (() => { const [c, x] = canvas(256, 512); const g = x.createRadialGradient(128, 20, 10, 128, 140, 320); g.addColorStop(0, 'rgba(255,240,205,0.85)'); g.addColorStop(0.5, 'rgba(255,240,205,0.25)'); g.addColorStop(1, 'rgba(255,240,205,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 512); return tex(c); })();
  const poolM = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, opacity: 0.35 });
  const brass = std({ color: 0xc9a227, metalness: 0.9, roughness: 0.3, envMapIntensity: 1 });
  const items = [];
  LEGENDS.forEach((L, i) => {
    const s = slots[i]; if (!s) return;
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.ry; group.add(g);
    const pool = plane(PW * 1.8, H - 0.1, poolM); pool.position.set(0, (H - 0.1) / 2, 0.01); g.add(pool);
    const frame = box(PW + 0.08, PH + 0.08, 0.06, std({ color: 0x0a0a0a, roughness: 0.4 })); frame.position.set(0, PY, 0.04); g.add(frame);
    const panel = plane(PW, PH, new THREE.MeshBasicMaterial({ map: legendTex(L, crest, i), color: new THREE.Color(0.92, 0.92, 0.92) })); panel.position.set(0, PY, 0.072); g.add(panel);
    const rail = box(PW + 0.3, 0.04, 0.12, brass); rail.position.set(0, 0.3, 0.08); g.add(rail);
    const lamp = box(0.5, 0.05, 0.12, std({ color: 0x111111 })); lamp.position.set(0, H - 0.25, 0.25); g.add(lamp);
    g.updateMatrixWorld(true);
    items.push({ data: { ...L, kind: 'legend' }, focusPos: new THREE.Vector3(0, PY, 0.2).applyMatrix4(g.matrixWorld) });
  });
  // a plinth in the middle with the club's year
  { const p = box(1.6, 0.9, 1.6, std({ color: 0x0d0d0e, roughness: 0.25, envMapIntensity: 0.8 })); p.position.set(cx + 1, 0.45, cz); group.add(p);
    const [c, x] = canvas(512, 256); x.fillStyle = GOLD; x.textAlign = 'center'; x.font = '400 170px Anton'; x.fillText('1927', 256, 200);
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const f = plane(1.4, 0.7, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true })); f.position.set(cx + 1 + Math.sin(ry) * 0.805, 0.45, cz + Math.cos(ry) * 0.805); f.rotation.y = ry; group.add(f); }
    if (crest) { const ct = new THREE.Texture(crest); ct.colorSpace = THREE.SRGBColorSpace; ct.needsUpdate = true; const cr = plane(0.9, 0.9 * (crest.height / crest.width), new THREE.MeshBasicMaterial({ map: ct, transparent: true, side: THREE.DoubleSide })); cr.position.set(cx + 1, 1.5, cz); group.add(cr); items.push({ data: { kind: 'legend', name: 'Al-Ittihad', ar: 'الاتحاد', pos: 'Founded 1927', years: 'Jeddah', facts: ['AFC Champions League 2004 & 2005', '14 league titles'] }, focusPos: new THREE.Vector3(cx + 1, 1.4, cz), crestSpin: cr }); }
  }

  /* light */
  RectAreaLightUniformsLib.init();
  const lights = [];
  for (const [x, z] of [[cx, cz]]) { const L = new THREE.RectAreaLight(0xfff0d8, 2.2, W - 2, D - 2); L.position.set(x, H - 0.05, z); L.lookAt(x, 0, z); group.add(L); lights.push([L, 2.2]); }

  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  let focus = -1;
  function update(t, camera) {
    const p = camera.position;
    group.visible = p.x > -1 && p.z > Z0 - 8 && p.z < Z1 + 8;
    for (const [L, I] of lights) L.intensity = group.visible ? I : 0;
    if (!group.visible) return focus;
    const crestIt = items.find((it) => it.crestSpin); if (crestIt) crestIt.crestSpin.rotation.y = t * 0.4;
    const inside = p.x > X0 + 0.4;
    camera.getWorldDirection(fwd);
    let best = -1, bd = 0.97;
    if (inside) items.forEach((c, i) => { to.copy(c.focusPos).sub(p); if (to.length() > 12) return; const s = fwd.dot(to.normalize()); if (s > bd) { bd = s; best = i; } });
    focus = best;
    return focus;
  }
  const inside = (c) => { const p = c.position; return p.x > X0 + 0.4 && p.x < X1 && p.z > Z0 && p.z < Z1 && p.y < H; };
  group.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.fog = false; });
  return { group, items, update, inside, get focus() { return focus; } };
}
