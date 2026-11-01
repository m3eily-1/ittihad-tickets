// The stadium treasure hunt (Ahmed, 2026-11-01, from the list of new games): eight Golden Tigers — gold coins with the
// crest — hidden round the virtual tour's rooms, new spots every week (the fan zone's week, fz-core.js). Two in the
// trophy room, two in the club store, two in the locker room, one in the gym, one in the hall of fame. Tap one to pick
// it up (+10 Claws); all eight pay 100 Claws and the "Find all eight Golden Tigers" achievement.
// Where they go: each room is searched once, when you first walk into it on a hunt, with a seeded random (the same for
// every fan that week): spots with room round the coin, seen from somewhere you can stand, tucked near something, and
// not in plain view from the doorway. A chip over the tour counts them; in a room with one still hidden, a bar
// warms up as you get closer to it.
import * as THREE from 'three';
import './hunt.css';
import { claws } from './economy.js';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { rng, hash } from './fz-core.js';
import { HUNT_ROOMS, HUNT_TOTAL, HUNT_PAY, st, fresh, changed, hunt } from './hunt-state.js';
import { ROOM as MUSEUM } from './museum.js';
import { STORE } from './store.js';
import { CHANGING } from './changing.js';
import { GYM } from './gym.js';
import { FAME } from './fame.js';

const CREST = '/teams/al-ittihad.png';
// bounds of each room, in its own frame
const BOUNDS = { trophies: MUSEUM, store: STORE, changing: CHANGING, gym: GYM, fame: FAME };

/* ── the coin ── */
let coinProto = null;
function coinMesh() {
  if (!coinProto) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(100, 90, 10, 128, 128, 128); gr.addColorStop(0, '#fff1a6'); gr.addColorStop(0.55, '#e8b923'); gr.addColorStop(1, '#a77d0c');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#8a6608'; g.lineWidth = 14; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    const face = new THREE.CanvasTexture(c); face.colorSpace = THREE.SRGBColorSpace;
    const im = new Image(); im.onload = () => { g.drawImage(im, 58, 48, 140, 156); face.needsUpdate = true; }; im.src = CREST;
    const faceM = new THREE.MeshStandardMaterial({ map: face, metalness: 0.55, roughness: 0.3, emissive: 0x4a3600, emissiveIntensity: 0.6 });
    const rimM = new THREE.MeshStandardMaterial({ color: 0xd9a514, metalness: 0.85, roughness: 0.28, emissive: 0x3a2a00 });
    const glow = document.createElement('canvas'); glow.width = glow.height = 128;
    const gg = glow.getContext('2d'), rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,224,90,0.6)'); rg.addColorStop(0.4, 'rgba(255,212,0,0.25)'); rg.addColorStop(1, 'rgba(255,212,0,0)');
    gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
    const glowT = new THREE.CanvasTexture(glow);
    coinProto = { geo: new THREE.CylinderGeometry(0.17, 0.17, 0.035, 32), mats: [rimM, faceM, faceM], glowM: new THREE.SpriteMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }) };
  }
  const g = new THREE.Group();
  const coin = new THREE.Mesh(coinProto.geo, coinProto.mats); coin.rotation.x = Math.PI / 2; g.add(coin);
  const glow = new THREE.Sprite(coinProto.glowM); glow.scale.set(0.6, 0.6, 1); g.add(glow);
  // a bigger, invisible target, so a tap near it on a phone still picks it up
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); g.add(hit);
  g.userData.spin = coin;
  return g;
}

/* ── where they go, room by room ── */
const rc = new THREE.Raycaster();
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]].map((v) => new THREE.Vector3(...v).normalize());
function spotsFor(room, R, B, n, seed) {
  const r = rng(seed), group = R.group;
  group.updateMatrixWorld(true);
  const solids = [];
  group.traverse((o) => { if (o.isMesh && !o.userData.hunt && !o.isSprite) solids.push(o); });
  const W = (x, y, z) => group.localToWorld(new THREE.Vector3(x, y, z));
  const probe = { position: new THREE.Vector3() };
  const ok = (wp) => { for (const [dx, dz] of [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) { probe.position.set(wp.x + dx, wp.y, wp.z + dz); if (!R.inside(probe)) return false; } return !(R.blockers || []).some((b) => Math.hypot(wp.x - b.x, wp.z - b.z) < b.r + 0.45); };
  // where you can stand (eye height), and the doorway end you come in at
  const stands = [];
  for (let x = B.X0 + 0.6; x < B.X1 - 0.4; x += 1) for (let z = B.Z0 + 0.6; z < B.Z1 - 0.4; z += 1) { const p = W(x, 1.6, z); if (ok(p)) stands.push(p); }
  if (!stands.length) return [];
  const clearTo = (from, to) => { const d = from.distanceTo(to); rc.set(from, to.clone().sub(from).normalize()); rc.far = d; const hit = rc.intersectObjects(solids, false)[0]; return !hit || hit.distance > d - 0.25; };
  const entry = stands.reduce((a, p) => (R.inside({ position: p }) && door(p) < door(a) ? p : a), stands[0]);
  function door(p) { const l = group.worldToLocal(p.clone()); return room === 'changing' ? l.z - B.Z0 : room === 'store' || room === 'gym' ? B.X1 - l.x : l.x - B.X0; }
  const heights = [0.45, 0.95, 1.55, ...(B.H > 4 ? [2.3] : [])];
  const cands = [];
  for (let i = 0; i < 160 && cands.length < 40; i++) {
    const lx = B.X0 + 0.5 + r() * (B.X1 - B.X0 - 1), lz = B.Z0 + 0.5 + r() * (B.Z1 - B.Z0 - 1), ly = heights[(r() * heights.length) | 0];
    const p = W(lx, ly, lz);
    if (!R.inside({ position: p })) continue;
    // room round it: nothing within 0.3 m any way; "tucked": how many directions meet something within 1.4 m
    let near = 0, bad = false;
    for (const d of DIRS) { rc.set(p, d); rc.far = 1.4; const hit = rc.intersectObjects(solids, false)[0]; if (hit && hit.distance < 0.3) { bad = true; break; } if (hit) near++; }
    if (bad) continue;
    // seen from somewhere you can stand (within 8 m) — which also rules out a spot inside something solid
    const seen = stands.filter((s) => s.distanceTo(p) < 8).sort((a, b) => a.distanceTo(p) - b.distanceTo(p)).slice(0, 5).some((s) => clearTo(s, p));
    if (!seen) continue;
    const plain = entry.distanceTo(p) < 9 && clearTo(entry, p);
    cands.push({ local: group.worldToLocal(p.clone()), world: p, score: near + (plain ? -4 : 2) + r() * 2 });
  }
  cands.sort((a, b) => b.score - a.score);
  const out = [];
  for (const c of cands) { if (out.every((o) => o.world.distanceTo(c.world) > 3)) out.push(c); if (out.length === n) break; }
  return out;
}

/* ── in the scene: coins, taps, the chip and its warmth bar ── */
export function mountHunt(scene, host, { onComplete } = {}) {
  const placed = new Map();   // room → [{ id, mesh, world }]
  const chip = document.createElement('div');
  chip.className = 'hn-chip'; chip.hidden = true;
  chip.innerHTML = '<i class="hn-coin" aria-hidden="true"></i><p><b class="js-hn-n"></b><span class="js-hn-t"></span></p><span class="hn-warm" aria-hidden="true"><i></i></span>';
  chip.setAttribute('role', 'status');
  host.append(chip);
  const nEl = chip.querySelector('.js-hn-n'), tEl = chip.querySelector('.js-hn-t'), warm = chip.querySelector('.hn-warm i');

  function place(room) {
    if (placed.has(room)) return;
    const def = HUNT_ROOMS.find((r) => r[0] === room), R = scene.roomModule(room);
    if (!def || !R?.group) return;
    const spots = spotsFor(room, R, BOUNDS[room], def[2], hash(`hunt|${st.w}|${room}`));
    const list = spots.map((s, i) => {
      const id = `${room}-${i}`;
      if (st.found.includes(id)) return null;
      const m = coinMesh();
      m.position.copy(s.local); m.userData.click = `hunt:${id}`; m.userData.hunt = true;
      m.traverse((o) => { o.userData.hunt = true; });
      R.group.add(m);
      return { id, mesh: m, world: s.world, ph: Math.random() * 6 };
    }).filter(Boolean);
    placed.set(room, list);
  }
  function clear() { for (const list of placed.values()) for (const c of list) c.mesh.parent?.remove(c.mesh); placed.clear(); }

  // a coin picked up: it rises, spins fast and shrinks into the chip
  function take(id) {
    const room = id.split('-')[0], list = placed.get(room) || [], i = list.findIndex((c) => c.id === id);
    if (i < 0 || st.found.includes(id)) return false;
    const c = list.splice(i, 1)[0];
    const t0 = performance.now(), y0 = c.mesh.position.y;
    const fly = () => { const k = Math.min(1, (performance.now() - t0) / 550); c.mesh.position.y = y0 + k * 0.6; c.mesh.userData.spin.rotation.z += 0.5; c.mesh.scale.setScalar(1 - k * k); if (k < 1) requestAnimationFrame(fly); else c.mesh.parent?.remove(c.mesh); };
    fly();
    st.found.push(id); changed();
    claws.earn(HUNT_PAY.coin, 'Treasure hunt · a Golden Tiger');
    feel.win(); feel.pop(`GOLDEN TIGER ${st.found.length}/${HUNT_TOTAL}`, { big: st.found.length === HUNT_TOTAL });
    if (st.found.length >= HUNT_TOTAL && !st.done) {
      st.done = true; st.on = false; changed();
      claws.earn(HUNT_PAY.all, 'Treasure hunt complete');
      progress.achieve('hunt-all');
      feel.roar(); feel.confetti({ n: 220 });
      setTimeout(() => onComplete?.(), 900);
    }
    paint(true);
    return true;
  }

  // the chip: in the tunnel, which rooms still hide some; in a room, how many are here and how warm you are
  let lastTxt = '';
  function paint(force = false) {
    const room = scene.roomName, on = st.on && !st.done && (room ? HUNT_ROOMS.some((r) => r[0] === room) : scene.canWalk);
    chip.hidden = !on;
    if (!on) return;
    const n = st.found.length;
    let txt;
    if (room) {
      const here = HUNT_ROOMS.find((r) => r[0] === room)[2] - hunt.foundIn(room);
      txt = here ? `${here} hidden in here` : 'None left in here';
      chip.classList.toggle('is-warm', here > 0);
    } else {
      const rooms = HUNT_ROOMS.filter((r) => hunt.foundIn(r[0]) < r[2]).map((r) => r[1].replace(/^the /, ''));
      txt = rooms.length ? `Look in: ${rooms.join(', ')}` : '';
      chip.classList.remove('is-warm');
    }
    const key = `${n}|${txt}`;
    if (key !== lastTxt || force) { lastTxt = key; nEl.textContent = `Golden Tigers ${n}/${HUNT_TOTAL}`; tEl.textContent = txt; }
  }
  const tmp = new THREE.Vector3();
  function tick() {
    requestAnimationFrame(tick);
    if (!st.on || st.done) { if (!chip.hidden) chip.hidden = true; return; }
    const room = scene.roomName;
    if (room && !placed.has(room)) place(room);
    paint();
    const list = room ? placed.get(room) : null;
    if (!list?.length) { warm.style.transform = 'scaleX(0)'; return; }
    const t = performance.now() / 1000, cam = scene.camera.position;
    let best = Infinity;
    for (const c of list) {
      c.mesh.userData.spin.rotation.z = t * 1.8 + c.ph;
      c.mesh.position.y += Math.sin(t * 2 + c.ph) * 0.0009;
      best = Math.min(best, cam.distanceTo(c.mesh.getWorldPosition(tmp)));
    }
    warm.style.transform = `scaleX(${Math.max(0.06, Math.min(1, 1 - (best - 1.2) / 10)).toFixed(3)})`;
  }
  requestAnimationFrame(tick);

  return {
    start() { fresh(); st.on = true; changed(); paint(true); },
    stop() { st.on = false; changed(); paint(true); },
    // a tap in a room: true when it was a coin (main.js asks before the room's own handlers)
    click(e) { return typeof e?.id === 'string' && e.id.startsWith('hunt:') ? take(e.id.slice(5)) || true : false; },
    reset() { clear(); },
    debug: { spotsFor, placed },
  };
}
