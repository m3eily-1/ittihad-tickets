// The SPL Fantasy room (Ahmed, 2026-10-19): a side room off the tunnel's right wall, opposite the club store.
// EA FC menu look: a dark room, the tunnel's black tiger print on the walls, a big screen over the far wall with
// your team's name, value and captain, and a pitch table in the middle where your starting XI stands as
// Ultimate Team cards in formation. The team itself is built in the overlay (fantasy-ui.js); this room redraws
// whenever it changes.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TN, DOORS } from './world.js';
import { muralTex, QUOTES } from './posters.js';
import { loadTeam, lineup, P } from './fantasy-ui.js';

export const FANT = { X0: TN.HW, X1: 16.5, Z0: 59.6, Z1: 71.6, H: 4.2 };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const imgCache = new Map();
const loadImg = (src) => { if (!src) return Promise.resolve(null); if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; })); return imgCache.get(src); };
function fit(x, text, maxW, size, font, weight = 400) { x.font = `${weight} ${size}px ${font}`; while (x.measureText(text).width > maxW && size > 8) { size -= 2; x.font = `${weight} ${size}px ${font}`; } return size; }

// an Ultimate Team-style shield: tier colour by rating, rating + position + crest top-left, the photo, the name
function shield(x, W, H) {
  x.beginPath();
  x.moveTo(W * 0.5, 0); x.quadraticCurveTo(W * 0.78, H * 0.035, W, H * 0.02); x.lineTo(W, H * 0.8);
  x.quadraticCurveTo(W * 0.98, H * 0.9, W * 0.5, H); x.quadraticCurveTo(W * 0.02, H * 0.9, 0, H * 0.8);
  x.lineTo(0, H * 0.02); x.quadraticCurveTo(W * 0.22, H * 0.035, W * 0.5, 0); x.closePath();
}
async function cardCanvas(p, cap) {
  const W = 360, H = 520, [c, x] = canvas(W, H);
  const tier = p.rating >= 80 ? ['#f7e08a', '#c9a227', '#3b2f0b'] : p.rating >= 72 ? ['#e9ecef', '#9aa3ad', '#22262b'] : ['#e7b88d', '#9a6a3f', '#2d1d0e'];
  shield(x, W, H);
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, tier[0]); g.addColorStop(0.55, tier[1]); g.addColorStop(1, tier[0]);
  x.fillStyle = g; x.fill();
  x.save(); shield(x, W, H); x.clip();
  x.globalAlpha = 0.12; x.strokeStyle = '#000'; x.lineWidth = 2; for (let i = -H; i < W; i += 18) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + H, 0); x.stroke(); }
  x.globalAlpha = 1;
  const [ph, logo] = await Promise.all([loadImg(p.photo), loadImg(p.club.logo)]);
  if (ph) { const h = H * 0.6, w = h * (ph.width / ph.height); x.drawImage(ph, W * 0.62 - w / 2, H * 0.06, w, h); }
  x.restore();
  x.fillStyle = tier[2]; x.textAlign = 'center';
  x.font = '400 92px Anton'; x.fillText(String(p.rating), 72, 118);
  x.font = '700 36px Cairo'; x.fillText(p.pos, 72, 160);
  x.fillRect(42, 176, 60, 3);
  if (logo) x.drawImage(logo, 44, 190, 56, 56);
  x.font = '700 26px Cairo'; x.fillText(p.nat || '', 72, 282);
  x.fillStyle = tier[2]; fit(x, (p.last || p.first).toUpperCase(), W - 50, 52, 'Anton'); x.fillText((p.last || p.first).toUpperCase(), W / 2, H * 0.74);
  x.fillRect(W * 0.2, H * 0.765, W * 0.6, 3);
  x.font = '700 30px Cairo'; x.fillText(`SAR ${p.price.toFixed(1)}m`, W / 2, H * 0.84);
  if (cap) { x.beginPath(); x.arc(W - 52, 64, 30, 0, Math.PI * 2); x.fillStyle = '#111'; x.fill(); x.fillStyle = '#ffea00'; x.font = '400 40px Anton'; x.fillText('C', W - 52, 79); }
  return c;
}

export async function buildFantasy({ env }) {
  const { X0, X1, Z0, Z1, H } = FANT;
  const group = new THREE.Group();
  await document.fonts.load('400 100px Anton').catch(() => {});
  await document.fonts.load('700 40px Cairo').catch(() => {});
  const std = (o) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 0.5, roughness: 0.6, ...o });
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

  /* shell */
  const floor = plane(W, D, std({ color: 0x0f1012, roughness: 0.25, envMapIntensity: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.002, cz); group.add(floor);
  const ceil = plane(W, D, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.05, 0.055) })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz); group.add(ceil);
  const wallM = (w, h, k) => new THREE.MeshBasicMaterial({ map: muralTex(QUOTES[0], w / h, null, k, true, true, true), color: new THREE.Color(0.5, 0.5, 0.5) });
  const back = plane(D, H, wallM(D, H, 7)); back.rotation.y = -Math.PI / 2; back.position.set(X1, H / 2, cz); group.add(back);
  const north = plane(W, H, wallM(W, H, 8)); north.rotation.y = Math.PI; north.position.set(cx, H / 2, Z1); group.add(north);
  const south = plane(W, H, wallM(W, H, 9)); south.position.set(cx, H / 2, Z0); group.add(south);
  const [d0, d1] = DOORS.fantasy;
  for (const [z0, z1, door] of [[Z0, d0, false], [d0, d1, true], [d1, Z1, false]]) {
    const y0 = door ? DOORS.h : 0, hgt = H - y0;
    const seg = plane(z1 - z0, hgt, wallM(z1 - z0, hgt, 10)); seg.rotation.y = Math.PI / 2; seg.position.set(X0 + 0.12, y0 + hgt / 2, (z0 + z1) / 2); group.add(seg);
  }
  // light strips across the ceiling, angled like the game's menus
  const stripM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.05, 1.05, 1.02) });
  for (let i = 0; i < 4; i++) { const s = box(0.08, 0.03, D - 2, stripM); s.position.set(X0 + 2.4 + i * 3, H - 0.02, cz); s.rotation.y = 0.18; group.add(s); }

  /* the big screen on the far wall */
  const [sc, sx] = canvas(2048, 900);
  const screenT = tex(sc);
  const screen = plane(7.6, 7.6 * (900 / 2048), new THREE.MeshBasicMaterial({ map: screenT, toneMapped: false }));
  screen.rotation.y = -Math.PI / 2; screen.position.set(X1 - 0.16, 2.35, cz); group.add(screen);   // in front of the bezel
  const bezel = box(0.08, 7.6 * (900 / 2048) + 0.12, 7.72, std({ color: 0x0a0a0a })); bezel.position.set(X1 - 0.1, 2.35, cz); group.add(bezel);

  /* the pitch table */
  const TW = 5.6, TD = 3.6, TY = 0.9, TX = cx - 0.8;
  const [pc, px] = canvas(1400, 900);
  for (let i = 0; i < 10; i++) { px.fillStyle = i % 2 ? '#2f7a33' : '#348a39'; px.fillRect(i * 140, 0, 140, 900); }
  px.strokeStyle = 'rgba(255,255,255,0.85)'; px.lineWidth = 6;
  px.strokeRect(40, 40, 1320, 820); px.beginPath(); px.moveTo(700, 40); px.lineTo(700, 860); px.stroke();
  px.beginPath(); px.arc(700, 450, 110, 0, Math.PI * 2); px.stroke();
  px.strokeRect(40, 250, 180, 400); px.strokeRect(1180, 250, 180, 400); px.strokeRect(40, 360, 60, 180); px.strokeRect(1300, 360, 60, 180);
  const pitchTop = plane(TW, TD, new THREE.MeshBasicMaterial({ map: tex(pc), color: new THREE.Color(0.78, 0.78, 0.78) }));   // unlit: the area light washed it out
  pitchTop.rotation.x = -Math.PI / 2; pitchTop.rotation.z = Math.PI / 2; pitchTop.position.set(TX, TY + 0.001, cz); group.add(pitchTop);
  const tbase = box(TD + 0.16, TY, TW + 0.16, std({ color: 0x111111, roughness: 0.35 })); tbase.position.set(TX, TY / 2, cz); group.add(tbase);
  const trim = box(TD + 0.18, 0.05, TW + 0.18, std({ color: 0xf2c418, roughness: 0.4 })); trim.position.set(TX, TY - 0.045, cz);   // its top stays under the pitch group.add(trim);

  /* your XI as cards on the table, in formation, facing the door */
  const cards = new THREE.Group(); group.add(cards);
  const cardGeo = new THREE.PlaneGeometry(0.34, 0.34 * (520 / 360));
  const items = [];
  let drawing = 0;
  async function refresh() {
    const my = ++drawing;
    const t = loadTeam(), { xi } = lineup(t);
    // the screen
    const x = sx; x.clearRect(0, 0, 2048, 900);
    const g = x.createLinearGradient(0, 0, 2048, 900); g.addColorStop(0, '#0d1117'); g.addColorStop(1, '#151b24'); x.fillStyle = g; x.fillRect(0, 0, 2048, 900);
    x.fillStyle = '#f2c418'; x.beginPath(); x.moveTo(0, 0); x.lineTo(760, 0); x.lineTo(660, 150); x.lineTo(0, 150); x.closePath(); x.fill();
    x.fillStyle = '#111'; x.font = '400 96px Anton'; x.textAlign = 'left'; x.fillText('SPL FANTASY', 50, 112);
    x.fillStyle = '#fff'; x.font = '400 150px Anton'; x.fillText(t.name.toUpperCase(), 60, 330);
    const value = t.squad.reduce((a, id) => a + P[id].price, 0), cap = t.captain != null ? P[t.captain] : null;
    const stat = (k, v, X) => { x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '700 44px Cairo'; x.fillText(k, X, 460); x.fillStyle = '#fff'; x.font = '400 110px Anton'; x.fillText(v, X, 580); };
    stat('Squad', `${t.squad.length}/15`, 60); stat('Value', `SAR ${value.toFixed(1)}m`, 520); stat('Formation', t.formation, 1180);
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '700 44px Cairo'; x.fillText('Captain', 60, 700);
    x.fillStyle = '#ffea00'; x.font = '400 90px Anton'; x.fillText(cap ? `${cap.first} ${cap.last}`.trim().toUpperCase() : '—', 60, 800);
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.font = '600 34px Cairo'; x.textAlign = 'right'; x.fillText('Ratings and prices are demo values', 1990, 860);
    screenT.needsUpdate = true;
    // the cards
    const textures = await Promise.all(xi.map((p) => cardCanvas(p, p.id === t.captain)));
    if (my !== drawing) return;
    for (const o of [...cards.children]) { o.material.map?.dispose(); o.material.dispose(); cards.remove(o); }
    items.length = 0;
    const rows = ['GK', 'DEF', 'MID', 'FWD'];
    rows.forEach((pos, ri) => {
      const row = xi.filter((p) => p.pos === pos), n = row.length;
      row.forEach((p, i) => {
        const m = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: tex(textures[xi.indexOf(p)]), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
        // GK at the far end, forwards nearest the door; spread across the table's width
        const along = TX + TD / 2 - 0.35 - ri * ((TD - 0.7) / 3), across = cz - TW / 2 + (TW / (n + 1)) * (i + 1);
        m.position.set(along, TY + 0.27, across); m.rotation.y = -Math.PI / 2;   // face the doorway (−x)
        cards.add(m);
        items.push({ data: { kind: 'fantasy', ...p, club: p.club.name }, focusPos: m.position.clone(), mesh: m });
      });
    });
    if (!xi.length) {
      const [ec, ex] = canvas(1024, 256); ex.fillStyle = '#fff'; ex.textAlign = 'center'; ex.font = '400 110px Anton'; ex.fillText('PICK YOUR XI', 512, 150); ex.font = '700 40px Cairo'; ex.fillStyle = '#ffea00'; ex.fillText('Open the team builder', 512, 220);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: tex(ec), transparent: true, side: THREE.DoubleSide }));
      m.position.set(TX, TY + 0.4, cz); m.rotation.y = -Math.PI / 2; cards.add(m);
    }
  }
  await refresh();
  addEventListener('fantasy:change', () => refresh());

  /* light */
  RectAreaLightUniformsLib.init();
  const L = new THREE.RectAreaLight(0xffffff, 1.4, D - 2, W - 2); L.position.set(cx, H - 0.05, cz); L.rotation.x = -Math.PI / 2; group.add(L);

  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  let focus = -1;
  function update(t, camera) {
    const p = camera.position;
    group.visible = p.x > -1 && p.z > Z0 - 8 && p.z < Z1 + 8;
    L.intensity = group.visible ? 1.4 : 0;
    if (!group.visible) return focus;
    items.forEach((it, i) => { it.mesh.position.y = 0.9 + 0.27 + Math.sin(t * 1.4 + i) * 0.015; });
    const inside = p.x > X0 + 0.4;
    camera.getWorldDirection(fwd);
    let best = -1, bd = 0.985;
    if (inside) items.forEach((c, i) => { to.copy(c.focusPos).sub(p); if (to.length() > 9) return; const s = fwd.dot(to.normalize()); if (s > bd) { bd = s; best = i; } });
    focus = best;
    return focus;
  }
  const inside = (c) => { const p = c.position; return p.x > X0 + 0.4 && p.x < X1 && p.z > Z0 && p.z < Z1 && p.y < H; };
  group.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.fog = false; });
  return { group, items, update, inside, refresh, get focus() { return focus; } };
}
