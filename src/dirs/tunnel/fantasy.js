// The SPL Fantasy room (Ahmed, 2026-10-19): a side room off the tunnel's right wall, opposite the club store.
// EA FC menu look: a dark room, the tunnel's black tiger print on the walls, a big screen over the far wall with
// your team's name, value and captain, and a pitch table in the middle where your starting XI stands as
// Ultimate Team cards in formation. The team itself is built in the overlay (fantasy-ui.js); this room redraws
// whenever it changes. The table is playable too (Ahmed, 2026-10-21): tap a card to swap or replace the player,
// the armband to pick a captain, KICK-OFF to play a demo matchweek on the screen (rooms/fantasy-room-ui.js).
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
  const trim = box(TD + 0.18, 0.05, TW + 0.18, std({ color: 0xf2c418, roughness: 0.4 })); trim.position.set(TX, TY - 0.045, cz); group.add(trim);   // its top stays under the pitch

  /* your XI as cards on the table, in formation, facing the door. Every slot of the formation has a card (an
     empty one is a ghost "+ DEF"), and each is clickable for the table's interactions (rooms/fantasy-room-ui.js):
     userData.click = 'fx:card:<slot>', slot = position + index in its row, e.g. 'DEF2' */
  const cards = new THREE.Group(); group.add(cards);
  const CW = 0.34, CH = CW * (520 / 360);
  const cardGeo = new THREE.PlaneGeometry(CW, CH);
  const glowM = new THREE.MeshBasicMaterial({ map: (() => {
    const [c, x] = canvas(400, 560); x.translate(20, 20); shield(x, 360, 520);
    x.shadowColor = '#ffea00'; x.shadowBlur = 22; x.lineWidth = 12; x.strokeStyle = '#ffea00'; x.stroke(); x.stroke();
    return tex(c);
  })(), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const glowGeo = new THREE.PlaneGeometry(CW * (400 / 360), CH * (560 / 520));
  // the captain's armband: a yellow band with the C round it
  const bandTex = (() => {
    const [c, x] = canvas(512, 96); x.fillStyle = '#ffea00'; x.fillRect(0, 0, 512, 96);
    x.fillStyle = '#111'; x.fillRect(0, 0, 512, 9); x.fillRect(0, 87, 512, 9);
    x.font = '400 64px Anton'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) x.fillText('C', 64 + i * 128, 52);
    return tex(c);
  })();
  const bandM = new THREE.MeshStandardMaterial({ map: bandTex, emissive: 0xffffff, emissiveMap: bandTex, emissiveIntensity: 0.35, roughness: 0.6, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.4 });
  const bandGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.045, 28, 1, true);
  function emptyCanvas(pos) {
    const W = 360, H = 520, [c, x] = canvas(W, H);
    x.save(); x.translate(W * 0.03, H * 0.03); x.scale(0.94, 0.94);
    shield(x, W, H); x.fillStyle = 'rgba(8,10,14,0.62)'; x.fill();
    x.setLineDash([22, 14]); x.lineWidth = 7; x.strokeStyle = 'rgba(255,234,0,0.85)'; x.stroke(); x.restore();
    x.textAlign = 'center'; x.fillStyle = '#ffea00'; x.font = '400 170px Anton'; x.fillText('+', W / 2, H * 0.52);
    x.fillStyle = '#fff'; x.font = '700 48px Cairo'; x.fillText(pos, W / 2, H * 0.68);
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.font = '600 28px Cairo'; x.fillText('Tap to add', W / 2, H * 0.77);
    return c;
  }
  function badgeTex(pts, cap) {
    const [c, x] = canvas(256, 128);
    x.fillStyle = pts > 0 ? '#ffea00' : '#2a2a2a'; x.fillRect(16, 10, 224, 108);
    x.fillStyle = '#000'; x.globalAlpha = 0.35; x.fillRect(16, 110, 224, 8); x.globalAlpha = 1;
    x.fillStyle = pts > 0 ? '#111' : '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '400 78px Anton'; x.fillText(`${pts > 0 ? '+' : ''}${pts}`, cap ? 108 : 128, 66);
    if (cap) { x.font = '400 40px Anton'; x.fillText('×2', 204, 66); }
    return tex(c);
  }

  const items = [];
  const slots = [];   // { slot, pos, player, holder, card, glow, band, badge, y0, lift, sc }
  let drawing = 0, team = loadTeam(), selected = null, hovered = null, capMode = false, tally = null;
  async function refresh() {
    const my = ++drawing;
    const t = loadTeam(), { xi, need } = lineup(t);
    team = t;
    if (!tally) drawHome(t);
    const layout = [];
    ['GK', 'DEF', 'MID', 'FWD'].forEach((pos, ri) => {
      const row = xi.filter((p) => p.pos === pos);
      for (let i = 0; i < need[pos]; i++) layout.push({ slot: `${pos}${i}`, pos, ri, i, n: need[pos], player: row[i] || null });
    });
    const canv = await Promise.all(layout.map((s) => (s.player ? cardCanvas(s.player, s.player.id === t.captain) : emptyCanvas(s.pos))));
    if (my !== drawing) return;
    for (const s of slots) { s.card.material.map?.dispose(); s.card.material.dispose(); if (s.badge) { s.badge.material.map?.dispose(); s.badge.material.dispose(); } cards.remove(s.holder); }
    slots.length = 0; items.length = 0;
    layout.forEach((s, k) => {
      // GK at the far end, forwards nearest the door; spread across the table's width
      const along = TX + TD / 2 - 0.35 - s.ri * ((TD - 0.7) / 3), across = cz - TW / 2 + (TW / (s.n + 1)) * (s.i + 1);
      const holder = new THREE.Group(); holder.userData.click = `fx:card:${s.slot}`;
      holder.position.set(along, TY + 0.27, across); holder.rotation.y = -Math.PI / 2;   // face the doorway (−x)
      const card = new THREE.Mesh(cardGeo, new THREE.MeshBasicMaterial({ map: tex(canv[k]), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, fog: false }));
      holder.add(card);
      const glow = new THREE.Mesh(glowGeo, glowM); glow.position.z = -0.006; glow.visible = selected === s.slot; holder.add(glow);
      let band = null;
      if (s.player && s.player.id === t.captain) { band = new THREE.Mesh(bandGeo, bandM); band.position.set(CW / 2 - 0.035, CH / 2 - 0.07, 0.05); band.rotation.set(0.4, 0, -0.3); holder.add(band); }
      cards.add(holder);
      slots.push({ ...s, holder, card, glow, band, badge: null, y0: TY + 0.27, lift: 0, sc: 1 });
      if (s.player) items.push({ data: { kind: 'fantasy', ...s.player, club: s.player.club.name }, focusPos: holder.position.clone(), mesh: holder });
    });
    if (selected && !slots.some((s) => s.slot === selected)) selected = null;
    if (tally) { tally.shown = new Set(); }   // badges come back on the next tally frame
  }

  /* the table's two controls, on the near edge either side of the forwards: the captain's armband (left) and KICK-OFF (right) */
  const labelPlane = (text, w, sub = null) => {
    const [c, x] = canvas(512, 140); x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, 512, 140); x.fillStyle = '#ffea00'; x.fillRect(0, 0, 512, 8);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `400 ${sub ? 62 : 76}px Anton`; x.fillText(text, 256, sub ? 58 : 76);
    if (sub) { x.font = '700 28px Cairo'; x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillText(sub, 256, 112); }
    const m = plane(w, w * (140 / 512), new THREE.MeshBasicMaterial({ map: tex(c), toneMapped: false })); m.rotation.y = -Math.PI / 2; return m;
  };
  const nearX = TX - TD / 2 + 0.36;
  const kick = new THREE.Group(); kick.userData.click = 'fx:kickoff'; kick.position.set(nearX, TY, cz + 2.05); group.add(kick);
  const kBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 40), std({ color: 0x0c0c0c, roughness: 0.3, metalness: 0.4 })); kBase.position.y = 0.03; kick.add(kBase);
  const kRing = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.016, 10, 48), std({ color: 0xf2c418, metalness: 0.6, roughness: 0.3 })); kRing.rotation.x = Math.PI / 2; kRing.position.y = 0.062; kick.add(kRing);
  const domeM = new THREE.MeshStandardMaterial({ color: 0xffe100, emissive: 0xffd000, emissiveIntensity: 0.45, roughness: 0.25, envMap: env, envMapIntensity: 0.8 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeM); dome.scale.y = 0.6; dome.position.y = 0.06; kick.add(dome);
  const kLab = labelPlane('KICK-OFF', 0.46, 'Play a matchweek'); kLab.position.set(0.2, 0.3, 0); kick.add(kLab);
  const kPost = box(0.02, 0.2, 0.02, std({ color: 0x111111 })); kPost.position.set(0.2, 0.12, 0); kick.add(kPost);
  const arm = new THREE.Group(); arm.userData.click = 'fx:captain'; arm.position.set(nearX, TY, cz - 2.05); group.add(arm);
  const aBase = box(0.3, 0.04, 0.3, std({ color: 0x0c0c0c, roughness: 0.3, metalness: 0.4 })); aBase.position.y = 0.02; arm.add(aBase);
  const aBand = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 36, 1, true), bandM); aBand.position.y = 0.12; arm.add(aBand);
  const aLab = labelPlane('CAPTAIN', 0.42, 'Give the armband'); aLab.position.set(0.2, 0.3, 0); arm.add(aLab);
  const aPost = kPost.clone(); arm.add(aPost);
  // a generous invisible hit volume round each control (button, post and label), so a quick tap lands
  const hitM = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  for (const g of [kick, arm]) { const hb = box(0.56, 0.46, 0.56, hitM); hb.position.set(0.08, 0.23, 0); g.add(hb); }
  let pressT = -1;

  /* the big screen: your team (home), or a matchweek's points counting up (the tally) */
  function drawHome(t) {
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
    x.fillStyle = '#ffea00'; x.font = '700 40px Cairo'; x.fillText('Press KICK-OFF on the table to play a matchweek', 1990, 112);
    screenT.needsUpdate = true;
  }
  // res = { gw, seed, total, rows: [{ id, name, pos, pts, cap, ev }] } from rooms/fantasy-room-sim.js; k = 0…1
  const rowAt = (i) => i * 0.065;   // when row i starts counting
  function drawTally(res, k) {
    if (!tally || tally.res !== res) tally = { res, shown: new Set() };
    const x = sx; x.clearRect(0, 0, 2048, 900);
    const g = x.createLinearGradient(0, 0, 2048, 900); g.addColorStop(0, '#0d1117'); g.addColorStop(1, '#151b24'); x.fillStyle = g; x.fillRect(0, 0, 2048, 900);
    x.fillStyle = '#f2c418'; x.beginPath(); x.moveTo(0, 0); x.lineTo(900, 0); x.lineTo(800, 150); x.lineTo(0, 150); x.closePath(); x.fill();
    x.fillStyle = '#111'; x.font = '400 96px Anton'; x.textAlign = 'left'; x.fillText(`MATCHWEEK ${res.gw}`, 50, 112);
    x.fillStyle = '#ff4d4d'; x.fillRect(940, 46, 150, 66); x.fillStyle = '#fff'; x.font = '400 48px Anton'; x.textAlign = 'center'; x.fillText('DEMO', 1015, 98);
    x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '600 32px Cairo'; x.fillText('Simulated points · not real results', 1120, 92);
    let sum = 0;
    res.rows.forEach((r, i) => {
      const a = THREE.MathUtils.clamp((k - rowAt(i)) / 0.09, 0, 1);
      const col = i < 6 ? 0 : 1, j = i < 6 ? i : i - 6, X = 50 + col * 690, Y = 200 + j * 108;
      x.globalAlpha = 0.25 + 0.75 * Math.min(1, a * 3);
      x.fillStyle = r.cap ? 'rgba(255,234,0,0.14)' : 'rgba(255,255,255,0.05)'; x.fillRect(X, Y, 660, 94);
      x.fillStyle = '#ffea00'; x.fillRect(X, Y, 6, 94);
      x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '700 30px Cairo'; x.textAlign = 'left'; x.fillText(r.pos, X + 24, Y + 58);
      x.fillStyle = '#fff'; x.font = '400 46px Anton'; let s = 46; while (x.measureText(r.name).width > 330 && s > 26) { s -= 2; x.font = `400 ${s}px Anton`; } x.fillText(r.name, X + 110, Y + 52);
      if (r.cap) { const nw = x.measureText(r.name).width; x.fillStyle = '#ffea00'; x.fillRect(X + 122 + nw, Y + 16, 44, 44); x.fillStyle = '#111'; x.font = '400 36px Anton'; x.textAlign = 'center'; x.fillText('C', X + 144 + nw, Y + 52); x.textAlign = 'left'; }
      x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '600 26px Cairo'; x.fillText(r.ev, X + 110, Y + 84);
      const shown = Math.round(r.pts * a); sum += shown;
      x.fillStyle = a > 0 ? '#ffea00' : 'rgba(255,255,255,0.3)'; x.font = '400 64px Anton'; x.textAlign = 'right'; x.fillText(a > 0 ? String(shown) : '–', X + 640, Y + 70);
      x.globalAlpha = 1;
      if (a > 0 && !tally.shown.has(r.id)) { tally.shown.add(r.id); setBadge(r.id, r.pts, r.cap); }
    });
    x.textAlign = 'left'; x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '700 44px Cairo'; x.fillText('Total', 1440, 270);
    x.fillStyle = '#ffea00'; x.font = '400 330px Anton'; x.fillText(String(sum), 1430, 590);
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '700 36px Cairo'; x.fillText(`Best ${Math.max(res.best || 0, k >= 1 ? res.total : 0)}`, 1440, 680);
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.font = '600 28px Cairo'; x.fillText(`Seed ${res.seed} · same team, same week, same points`, 1440, 740);
    screenT.needsUpdate = true;
  }
  function setBadge(id, pts, cap) {
    const s = slots.find((q) => q.player && q.player.id === id); if (!s) return;
    if (s.badge) { s.badge.material.map?.dispose(); s.badge.material.dispose(); s.holder.remove(s.badge); }
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex(pts, cap), toneMapped: false, depthWrite: false, fog: false }));
    b.position.set(0, CH / 2 + 0.1, 0.01); b.scale.set(0.001, 0.001, 1); b.userData.t0 = performance.now();
    s.holder.add(b); s.badge = b;
  }
  function endTally() {
    tally = null;
    for (const s of slots) if (s.badge) { s.badge.material.map?.dispose(); s.badge.material.dispose(); s.holder.remove(s.badge); s.badge = null; }
    drawHome(team);
  }

  await refresh();
  addEventListener('fantasy:change', () => refresh());

  /* light */
  RectAreaLightUniformsLib.init();
  const L = new THREE.RectAreaLight(0xffffff, 1.4, D - 2, W - 2); L.position.set(cx, H - 0.05, cz); L.rotation.x = -Math.PI / 2; group.add(L);

  const fwd = new THREE.Vector3(), to = new THREE.Vector3();
  let focus = -1, lastT = 0;
  function update(t, camera) {
    const p = camera.position;
    const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    group.visible = p.x > -1 && p.z > Z0 - 8 && p.z < Z1 + 8;
    L.intensity = group.visible ? 1.4 : 0;
    if (!group.visible) return focus;
    const e = 1 - Math.exp(-dt * 12), now = performance.now();
    slots.forEach((s, i) => {
      const hov = hovered === `fx:card:${s.slot}`, sel = selected === s.slot;
      s.lift += ((sel ? 0.1 : 0) - s.lift) * e;
      s.sc += ((hov || sel ? 1.08 : capMode && s.player ? 1 + 0.03 * Math.sin(t * 6 + i) : 1) - s.sc) * e;
      s.holder.position.y = s.y0 + s.lift + Math.sin(t * 1.4 + i) * 0.015;
      s.holder.scale.setScalar(s.sc);
      s.glow.visible = sel || (capMode && hov);
      if (s.band) s.band.rotation.y += dt * 1.6;
      if (s.badge) { const a = Math.min(1, (now - s.badge.userData.t0) / 380), o = 1 + 2.2 * (a - 1) ** 3 + 1.2 * (a - 1) ** 2; s.badge.scale.set(0.24 * o, 0.12 * o, 1); }
    });
    // KICK-OFF: glows on hover, dips when pressed; the armband floats and spins while you're choosing a captain
    const pk = pressT < 0 ? 0 : Math.min(1, (now - pressT) / 320);
    dome.position.y = 0.06 - 0.035 * Math.sin(Math.PI * pk);
    domeM.emissiveIntensity += ((hovered === 'fx:kickoff' ? 0.9 : 0.4 + 0.15 * Math.sin(t * 3)) - domeM.emissiveIntensity) * e;
    aBand.position.y += ((capMode ? 0.3 : 0.12) - aBand.position.y) * e;
    aBand.rotation.y += dt * (capMode ? 4 : 0.8);
    aBand.scale.setScalar(aBand.scale.x + ((hovered === 'fx:captain' || capMode ? 1.15 : 1) - aBand.scale.x) * e);
    const inside = p.x > X0 + 0.4;
    camera.getWorldDirection(fwd);
    let best = -1, bd = 0.985;
    if (inside) items.forEach((c, i) => { to.copy(c.focusPos).sub(p); if (to.length() > 9) return; const s = fwd.dot(to.normalize()); if (s > bd) { bd = s; best = i; } });
    focus = best;
    return focus;
  }
  const inside = (c) => { const p = c.position; return p.x > X0 + 0.4 && p.x < X1 && p.z > Z0 && p.z < Z1 && p.y < H; };
  group.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.fog = false; });

  /* the table's interactions are driven from rooms/fantasy-room-ui.js through these */
  const api = {
    get slots() { return slots; },
    get team() { return team; },
    slotOf: (slot) => slots.find((s) => s.slot === slot) || null,
    select(slot) { selected = slot; },
    get selected() { return selected; },
    hover(id) { hovered = id; },
    setCaptainMode(on) { capMode = !!on; },
    get captainMode() { return capMode; },
    press() { pressT = performance.now(); },
    drawTally, endTally,
    get tallyOn() { return !!tally; },
    // where things are, for tests and for placing UI near them
    kickoff: kick, armband: arm, screen,
  };
  return { group, items, update, inside, refresh, get focus() { return focus; }, api };
}
