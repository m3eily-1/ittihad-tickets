// The matches room: the last stop before the pitch, through a door in the tunnel's right wall near the
// mouth. Every upcoming home match is a clear glass card floating in front of you in an arc, like a
// game's match-select menu (Ahmed's picks: floating, transparent, no LED, no overlap). Tournament tabs float
// above the cards; picking one re-deals the carousel and re-lights the room in that tournament's colour.
// Arrows, swipe/drag and the ← → keys move the row (curved like the tilted-grid effect); on-sale cards carry "Book tickets" (click → booking page), the rest
// "Coming soon". Data: fixtures.js.
import * as THREE from 'three';
import { TN, DOORS } from './world.js';
import { roomMat, ledSign, MAXL } from './museum.js';
import { when, eventUrl, SITE } from '../../data.js';
import { FIXTURES, COMPS, TAB_STYLE } from './fixtures.js';

// the walk pauses here, in the tunnel before the mouth, while you browse the matches (scene.js)
export const MATCH_HOLD_Z = 63;
export const MROOM = { X0: TN.HW, X1: 18, Z0: 54.5, Z1: 66, H: 3.4 };   // under the stand, so a low ceiling
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
const compLine = (m) => `${(COMPS[m.comp]?.label || m.compLabel).toUpperCase()}${m.round ? ` · ${m.round.toUpperCase()}` : ''}`;

function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function fit(x, text, maxW, size, font = 'Anton', weight = 400) {
  x.font = `${weight} ${size}px ${font}`;
  while (x.measureText(text).width > maxW && size > 10) { size -= 2; x.font = `${weight} ${size}px ${font}`; }
  return size;
}
function rrect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function monogram(x, code, X, Y, s) {
  x.save(); x.beginPath(); x.arc(X + s / 2, Y + s / 2, s / 2 - 4, 0, Math.PI * 2);
  x.fillStyle = 'rgba(255,255,255,0.1)'; x.fill(); x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.5)'; x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; fit(x, code, s * 0.7, s * 0.34); x.fillText(code, X + s / 2, Y + s / 2 + s * 0.12); x.restore();
}

// a square clear-glass card: competition on top, the two crests side by side with each club's name
// under its crest, the date and kick-off, then price and the CTA (book, or coming soon)
function drawCard(c, m, crests, hot = false) {
  const W = c.width, H = c.height, x = c.getContext('2d');
  const accent = COMPS[m.comp]?.accent || '#fef201';
  x.clearRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(255,255,255,0.1)');
  // a solid dark card (Ahmed: a background for contrast), with the glass sheen and edge kept on top
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1b1c20'); bg.addColorStop(1, '#0d0e10');
  rrect(x, 3, 3, W - 6, H - 6, 16); x.fillStyle = bg; x.fill();
  rrect(x, 3, 3, W - 6, H - 6, 16); x.fillStyle = g; x.fill();
  x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.42)'; x.stroke();
  x.fillStyle = accent; x.fillRect(56, 3, 150, 8);
  x.textAlign = 'center';
  x.fillStyle = accent; fit(x, compLine(m), W - 112, 34, 'JetBrains Mono', 600); x.fillText(compLine(m), W / 2, 88);
  // crests with names beneath
  const cs = 320, cy = 116, lx = W * 0.26, rx = W * 0.74;   // big crests
  if (crests.home) x.drawImage(crests.home, lx - cs / 2, cy, cs, cs);
  if (crests.away) x.drawImage(crests.away, rx - cs / 2, cy, cs, cs); else monogram(x, m.oppCode || '?', rx - cs / 2, cy, cs);
  x.fillStyle = '#ffffff';
  fit(x, 'AL ITTIHAD', 420, 60); x.fillText('AL ITTIHAD', lx, cy + cs + 66);
  fit(x, m.oppShort, 420, 60); x.fillText(m.oppShort, rx, cy + cs + 66);
  x.font = '400 64px Anton'; x.globalAlpha = 0.55; x.fillText('VS', W / 2, cy + cs / 2 + 24); x.globalAlpha = 1;
  // date + kick-off
  x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(56, 548, W - 112, 2);
  x.fillStyle = '#ffffff';
  if (m.kickoff) {
    const w = when(m.kickoff);
    x.font = '400 108px Anton'; x.fillText(`${w.day} ${w.date} ${w.month}`, W / 2, 668);
    x.font = '600 42px Cairo'; x.globalAlpha = 0.9; x.fillText(m.timeTBC ? 'KICK-OFF TBC' : `KICK-OFF ${w.time}`, W / 2, 728); x.globalAlpha = 1;
  } else {
    x.font = '400 108px Anton'; x.fillText(m.dateText || 'DATE TBC', W / 2, 668);
    x.font = '600 42px Cairo'; x.globalAlpha = 0.9; x.fillText('KICK-OFF TBC', W / 2, 726); x.globalAlpha = 1;
  }
  // price + CTA
  const bw = W - 112, bh = 130, bx = 56, by = H - 56 - bh;
  if (m.onSale) {
    x.font = '600 34px Cairo'; x.globalAlpha = 0.8; x.fillText(`FROM SAR ${m.from}`, W / 2, by - 30); x.globalAlpha = 1;
    rrect(x, bx, by, bw, bh, 10); x.fillStyle = hot ? '#ffffff' : '#fef201'; x.fill();
    x.fillStyle = '#0a0a0a'; x.font = '400 72px Anton'; x.fillText('BOOK TICKETS  →', W / 2, by + 92);
  } else {
    x.font = '600 34px Cairo'; x.globalAlpha = 0.7; x.fillText('TICKETS NOT ON SALE YET', W / 2, by - 30); x.globalAlpha = 1;
    rrect(x, bx, by, bw, bh, 10); x.lineWidth = 4; x.strokeStyle = hot ? '#ffffff' : 'rgba(255,255,255,0.6)'; x.stroke();
    x.fillStyle = '#ffffff'; x.font = '400 72px Anton'; x.fillText('COMING SOON', W / 2, by + 92);
  }
  x.textAlign = 'left';
}

// The tournament filter, drawn as one strip on one canvas. Three styles while Ahmed picks
// (?tabs=underline | bar | title). st.ind / st.sizes animate between filters; st.boxes is
// filled in on every draw so a click can be mapped back to a label.
function drawTabs(c, st) {
  const W = c.width, H = c.height, x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  const n = st.keys.length, act = st.keys.indexOf(st.active), accent = COMPS[st.active].accent;
  const labels = st.keys.map((k) => COMPS[k].label.toUpperCase());
  x.textAlign = 'left';
  if (st.style === 'title') {
    // the active tournament large, the others small and dim either side; the strip slides so the
    // active one is always centred
    const ws = labels.map((l, i) => { x.font = `400 ${st.sizes[i]}px Anton`; return x.measureText(l).width; });
    const GAP = 72;
    let px = 0; const xs = ws.map((w) => { const v = px; px += w + GAP; return v; });
    const target = W / 2 - (xs[act] + ws[act] / 2);
    st.offT = target;
    st.off = st.off == null ? target : st.off + (target - st.off) * 0.2;
    st.boxes = xs.map((v, i) => [v + st.off - GAP / 2, v + st.off + ws[i] + GAP / 2]);
    labels.forEach((l, i) => {
      x.font = `400 ${st.sizes[i]}px Anton`;
      x.fillStyle = i === act ? accent : st.hot === i ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
      x.fillText(l, xs[i] + st.off, H * 0.74);
    });
    return;
  }
  const bar = st.style === 'bar';
  x.font = bar ? '400 54px Anton' : '400 64px Anton';
  const ws = labels.map((l) => x.measureText(l).width);
  const PAD = bar ? 56 : 0, GAP = bar ? 0 : 96;
  const total = ws.reduce((a, w) => a + w + PAD * 2, 0) + GAP * (n - 1);
  let px = (W - total) / 2;
  st.boxes = ws.map((w) => { const b = [px, px + w + PAD * 2]; px += w + PAD * 2 + GAP; return b; });
  const [t0, t1] = st.boxes[act];
  if (!st.ind) st.ind = { x: t0, w: t1 - t0 };
  st.ind.x += (t0 - st.ind.x) * 0.2; st.ind.w += (t1 - t0 - st.ind.w) * 0.2;
  if (bar) {
    // one clear glass strip with a block of the tournament's colour sliding behind the active label
    const y0 = 34, h = 128, a = st.boxes[0][0], b = st.boxes[n - 1][1];
    rrect(x, a, y0, b - a, h, 8); x.fillStyle = 'rgba(255,255,255,0.07)'; x.fill();
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.4)'; x.stroke();
    rrect(x, st.ind.x + 7, y0 + 7, st.ind.w - 14, h - 14, 5); x.fillStyle = accent; x.fill();
    x.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 1; i < n; i++) { const bx = st.boxes[i][0]; if (bx < st.ind.x - 4 || bx > st.ind.x + st.ind.w + 4) x.fillRect(bx - 1, y0 + 30, 2, h - 60); }
    labels.forEach((l, i) => {
      const [b0, b1] = st.boxes[i], mid = (b0 + b1) / 2;
      const under = mid > st.ind.x && mid < st.ind.x + st.ind.w;
      x.fillStyle = under ? '#0a0a0a' : st.hot === i ? '#ffffff' : 'rgba(255,255,255,0.7)';
      x.fillText(l, b0 + PAD, y0 + h / 2 + 20);
    });
    return;
  }
  // underline: bare labels, the active one in the tournament's colour with a thick bar under it
  x.fillStyle = 'rgba(255,255,255,0.14)'; x.fillRect(st.boxes[0][0], 152, st.boxes[n - 1][1] - st.boxes[0][0], 2);
  x.fillStyle = accent; x.fillRect(st.ind.x, 146, st.ind.w, 10);
  labels.forEach((l, i) => {
    x.fillStyle = i === act ? accent : st.hot === i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)';
    x.fillText(l, st.boxes[i][0], 118);
  });
}

// the arrows under the centre card: ‹  03 / 17  ›  (disabled at either end)
function drawNav(c, i, n, hot) {
  const W = c.width, H = c.height, x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  const btn = (X, dir, off, on) => {
    rrect(x, X + 3, 3, H - 6, H - 6, 8);
    x.fillStyle = off ? 'rgba(255,255,255,0.03)' : on ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'; x.fill();
    x.lineWidth = 3; x.strokeStyle = off ? 'rgba(255,255,255,0.15)' : on ? '#ffffff' : 'rgba(255,255,255,0.45)'; x.stroke();
    const cx = X + H / 2, cy = H / 2, s = H * 0.16;
    x.beginPath(); x.moveTo(cx + s * 0.5 * dir, cy - s); x.lineTo(cx - s * 0.5 * dir, cy); x.lineTo(cx + s * 0.5 * dir, cy + s);
    x.lineWidth = 9; x.lineCap = 'square'; x.lineJoin = 'miter'; x.strokeStyle = off ? 'rgba(255,255,255,0.2)' : '#ffffff'; x.stroke();
  };
  btn(0, 1, i <= 0, hot === 'prev');
  btn(W - H, -1, i >= n - 1, hot === 'next');
  x.textAlign = 'center'; x.fillStyle = '#ffffff'; x.font = '600 56px Cairo';
  x.fillText(`${pad2(i + 1)}`, W / 2 - 74, H / 2 + 20);
  x.globalAlpha = 0.45; x.fillText(`/ ${pad2(n)}`, W / 2 + 66, H / 2 + 20); x.globalAlpha = 1;
  x.textAlign = 'left';
}
const pad2 = (v) => String(v).padStart(2, '0');

// Bends a flat plane onto the inside of the row's cylinder (axis at local z = r, toward the viewer):
// x along the plane becomes arc length, so a card's ends curl toward you like the tilted-grid strips.
// z0 offsets a layer in front of (+) or behind (−) the card on the same axis.
function bendPlane(geo, r, z0 = 0) {
  const R = r - z0, p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = p.getX(i) / R; p.setXYZ(i, R * Math.sin(a), p.getY(i), r - R * Math.cos(a)); }
  p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}

// the tilted grid's edge mask, in screen space: everything fades out over the outer 14% of each side
const fadeHook = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vClipXW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvClipXW = gl_Position.xw;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vClipXW;')
    .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= smoothstep(1.0, 0.72, abs(vClipXW.x / vClipXW.y));');
};
const edgeFade = (m) => { m.onBeforeCompile = fadeHook; m.customProgramCacheKey = () => 'edgeFade'; return m; };
export async function buildMatchRoom({ env, lite = false, onBook }) {
  const { X0, X1, Z0, Z1, H } = MROOM;
  const group = new THREE.Group();
  const uL = { value: Array.from({ length: MAXL }, () => new THREE.Vector4(0, 0, 0, 0)) };
  const mats = [];
  const M = (k) => { const m = roomMat(k, uL, MROOM); mats.push(m); return m; };
  const wallM = M(0), floorM = M(1), ceilM = M(2);
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  const ledM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.2, 0.05) });
  // dimmer than the other doorways: you pass right through this one and it would rim the whole view
  const doorM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.95, 0.02) });

  /* shell */
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  const floor = plane(W, D, floorM); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.002, cz);
  const ceil = plane(W, D, ceilM); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz);
  const back = plane(D, H, wallM); back.rotation.y = -Math.PI / 2; back.position.set(X1, H / 2, cz);
  const north = plane(W, H, wallM); north.rotation.y = Math.PI; north.position.set(cx, H / 2, Z1);
  const south = plane(W, H, wallM); south.position.set(cx, H / 2, Z0);
  group.add(floor, ceil, back, north, south);
  const [d0, d1] = DOORS.matches;
  for (const [z0, z1, door] of [[Z0, d0, false], [d0, d1, true], [d1, Z1, false]]) {
    const y0 = door ? DOORS.h : 0, hgt = H - y0;
    const seg = plane(z1 - z0, hgt, wallM);
    seg.rotation.y = Math.PI / 2;
    seg.position.set(X0 + 0.12, y0 + hgt / 2, (z0 + z1) / 2);
    group.add(seg);
  }
  // door reveal: dark concrete (you walk right through it, so a lit reveal would rim the whole view),
  // with a thin LED line only on the edge facing the tunnel
  const revealM = new THREE.MeshBasicMaterial({ color: 0x141414 });
  for (const z of [d0, d1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.14, DOORS.h, 0.02), revealM); r.position.set(X0 + 0.06, DOORS.h / 2, z); group.add(r);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.02, DOORS.h, 0.03), doorM); l.position.set(X0 - 0.005, DOORS.h / 2, z); group.add(l);
  }
  const lintR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, d1 - d0), revealM); lintR.position.set(X0 + 0.06, DOORS.h, (d0 + d1) / 2); group.add(lintR);
  const lint = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, d1 - d0 + 0.03), doorM); lint.position.set(X0 - 0.005, DOORS.h, (d0 + d1) / 2); group.add(lint);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.42), new THREE.MeshBasicMaterial({ map: ledSign('MATCHES'), color: new THREE.Color(1.7, 1.7, 1.7) }));
  sign.rotation.y = -Math.PI / 2; sign.position.set(X0 - 0.02, DOORS.h + 0.42, (d0 + d1) / 2);
  group.add(sign);
  sign.visible = false;   // the room is gone (its cards are out in the tunnel)
  const strip = (len, x, z, ry) => { const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.03), ledM); s.position.set(x, 0.02, z); s.rotation.y = ry; group.add(s); };
  strip(W, cx, Z1 - 0.02, 0); strip(W, cx, Z0 + 0.02, 0); strip(D, X1 - 0.02, cz, Math.PI / 2);

  let li = 0;
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.7, 4.2) });
  const light = (x, z, w) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), lampM); m.rotation.x = Math.PI / 2; m.position.set(x, H - 0.01, z); group.add(m);
    if (li < MAXL) uL.value[li++].set(x, H - 0.05, z, w);
  };

  const homeCrest = await loadImg('/teams/al-ittihad.png');
  const awayCrests = await Promise.all(FIXTURES.map((m) => loadImg(m.crest)));
  const items = [];

  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sheenTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 64;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.09)');
    g.addColorStop(0.7, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 512, 64);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
  })();

  // the room itself is walled up (Ahmed: "remove the last room"); only its cards remain, out in the tunnel
  for (const o of group.children) o.visible = false;

  /* the row: the tilted-grid curve (Ahmed's pick). The cards sit on the inside of a cylinder whose axis
     is in front of the camera; the camera stands 0.6 R behind that axis (the effect's CAMERA = 1.6), so
     the centre card faces you flat at 1.6 R and its neighbours bend round and come toward you. Each card
     is itself bent along the arc, and the row fades out at both screen edges. */
  // Ahmed (2026-10-11): the cards float in the tunnel itself, just before the mouth, not in a room; sized
  // so the curved row fits the tunnel's 7 m width
  const BW = 1.6, BH = BW;   // square
  const R = 2.9, CAMD = 1.6 * R;           // centre card 4.6 m ahead
  const PITCH = (BW + 0.16) / R;           // one card + a small gap, in radians round the axis
  const SEG = 28;                          // facets per card: enough that the curve never shows corners
  const FIXED_AT = new THREE.Vector3(0, 1.7, MATCH_HOLD_Z);      // where the walk holds in the tunnel
  const yaw0 = -Math.PI / 2;                                      // facing down the tunnel, toward the mouth
  const AXIS = FIXED_AT.clone().add(new THREE.Vector3(Math.cos(yaw0), 0, Math.sin(yaw0)).multiplyScalar(CAMD - R));
  const curved = (w, h, z0 = 0, segs = SEG) => bendPlane(new THREE.PlaneGeometry(w, h, segs, 1), R, z0);

  FIXTURES.forEach((m, i) => {
    const crests = { home: homeCrest, away: awayCrests[i] };
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
    drawCard(c, m, crests);
    const t = tex(c);
    const g = new THREE.Group();
    const halo = new THREE.Mesh(curved(BW * 1.8, BH * 1.8, -0.08), edgeFade(new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: new THREE.Color(...(COMPS[m.comp]?.tint || [1, 0.8, 0])) })));
    const screenM = edgeFade(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: 0 }));
    const screen = new THREE.Mesh(curved(BW, BH), screenM);
    const sheenM = edgeFade(new THREE.MeshBasicMaterial({ map: sheenTex.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    sheenM.map.needsUpdate = true;
    const sheen = new THREE.Mesh(curved(BW, BH, 0.004), sheenM);
    g.add(halo, screen);   // (the sweeping sheen was removed: Ahmed, no shimmer)
    g.visible = false;
    group.add(g);
    const redraw = (hot) => { drawCard(c, m, crests, hot); t.needsUpdate = true; };
    items.push({ redraw, hot: false, screen, sheenM, data: { kind: 'match', key: m.slug || `${m.comp}-${m.oppCode}-${i}`, ...m, url: m.onSale ? eventUrl(m.slug) : null },
      card: g, halo, screenM, ph: i * 1.9, slot: -1, vis: 0 });
  });

  /* tournament filter, floating above the row (one strip, three styles while Ahmed picks) */
  const compKeys = ['all', ...['rsl', 'afc', 'kings'].filter((k) => FIXTURES.some((m) => m.comp === k))];
  // the title style slides its strip to keep the active tournament centred, so it needs room either side
  const tabC = document.createElement('canvas'); tabC.width = TAB_STYLE === 'title' ? 3600 : 2400; tabC.height = 200;
  const tabT = tex(tabC);
  const TABW = 3.6 * (tabC.width / 2400);
  const tabMesh = new THREE.Mesh(curved(TABW, TABW * (200 / tabC.width), 0, 64), edgeFade(new THREE.MeshBasicMaterial({ map: tabT, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })));
  tabMesh.visible = false;
  group.add(tabMesh);
  const tabSt = { style: TAB_STYLE, keys: compKeys, active: 'all', hot: -1, boxes: [], ind: null, off: null, sizes: compKeys.map((k) => (k === 'all' ? 120 : 44)) };
  const redrawTabs = () => { drawTabs(tabC, tabSt); tabT.needsUpdate = true; };

  /* the arrows + counter under the centre card */
  const navC = document.createElement('canvas'); navC.width = 1024; navC.height = 200;
  const navT = tex(navC);
  const NAVW = 2.0;   // arrows ≈ 0.45 m square: an easy target even as the camera sways with the pointer
  const navMesh = new THREE.Mesh(curved(NAVW, NAVW * (200 / 1024), 0, 16), edgeFade(new THREE.MeshBasicMaterial({ map: navT, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })));
  navMesh.visible = false;
  group.add(navMesh);
  let navHot = null;

  /* a colour wash on the back wall in the tournament's colour */
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0 }));
  wash.rotation.y = -Math.PI / 2; wash.position.set(X1 - 0.05, 1.6, cz);
  group.add(wash);

  light(cx, cz, 0.55);
  light(9, 59, 0.6);

  /* filter + which card is centred. Arrows, swipe/drag and the ← → keys move the row (not scroll). */
  let filter = 'all', list = [], idx = 0, active = 0;
  const tint = new THREE.Color(...COMPS.all.tint), tintTarget = tint.clone();
  const redrawNav = () => { drawNav(navC, idx, list.length, navHot); navT.needsUpdate = true; };
  function setFilter(key) {
    filter = key;
    list = items.filter((it) => key === 'all' || it.data.comp === key);
    items.forEach((it) => { it.slot = list.indexOf(it); });
    tabSt.active = key;
    idx = 0;                       // each tournament opens on its next match
    redrawTabs(); redrawNav();
    tintTarget.setRGB(...COMPS[key].tint);
  }
  function go(i) {
    const n = Math.max(1, list.length), next = Math.min(n - 1, Math.max(0, i));
    if (next !== idx) { idx = next; redrawNav(); }
  }
  setFilter('all');

  const sm = (a, b, v) => { const x = Math.min(1, Math.max(0, (v - a) / (b - a))); return x * x * (3 - 2 * x); };
  let focus = -1, ptrX = 0, enter = 0;
  addEventListener('pointermove', (e) => { ptrX = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });
  const tmp = new THREE.Vector3();
  const onRow = (obj, th, y, push = 0) => {
    const a = yaw0 + th, r = R + push;
    obj.position.set(AXIS.x + Math.cos(a) * r, y, AXIS.z + Math.sin(a) * r);
    obj.lookAt(AXIS.x, y, AXIS.z);
  };

  /* swipe / drag: the row follows the finger, then settles on the nearest card (a flick carries on) */
  const drag = { on: false, x0: 0, a0: 0, moved: false, lastX: 0, lastT: 0, v: 0, endT: 0 };
  const pxPerCard = () => Math.min(innerWidth * 0.32, 420);
  function dragStart(x) {
    if (enter < 0.5) return false;
    Object.assign(drag, { on: true, x0: x, a0: active, moved: false, lastX: x, lastT: performance.now(), v: 0 });
    return true;
  }
  function dragMove(x) {
    if (!drag.on) return;
    const dx = x - drag.x0;
    if (Math.abs(dx) > 8) drag.moved = true;
    const now = performance.now(), dt = Math.max(1, now - drag.lastT);
    drag.v = drag.v * 0.6 + ((x - drag.lastX) / dt) * 0.4;   // px per ms
    drag.lastX = x; drag.lastT = now;
    if (drag.moved) active = Math.min(list.length - 0.6, Math.max(-0.4, drag.a0 - dx / pxPerCard()));
  }
  function dragEnd() {
    if (!drag.on) return;
    drag.on = false;
    if (!drag.moved) return;
    drag.endT = performance.now(); // the click that ends a swipe doesn't book or filter
    go(Math.round(active - drag.v * 0.35 * (400 / pxPerCard())));
  }
  addEventListener('keydown', (e) => {
    if (enter < 0.5 || e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowRight') { go(idx + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(idx - 1); e.preventDefault(); }
  });

  function update(t, camera, { on = 1, s = 0 } = {}) {
    const p = camera.position;
    group.visible = p.z > 44 && p.z < 72 && p.y < 7;
    if (!group.visible) return focus;
    // room colour follows the tournament
    tint.lerp(tintTarget, 0.06);
    for (const m of mats) { m.uniforms.uCam.value.copy(p); m.uniforms.uOn.value = on; m.uniforms.uTint.value.copy(tint); }
    ledM.color.setRGB(tint.r * 2.6, tint.g * 2.6, tint.b * 2.6);
    wash.material.color.copy(tint); wash.material.opacity = 0.32 * enter;  // kept low: bright light behind clear glass washes out the type

    enter = sm(0.578, 0.6, s) * (1 - sm(0.686, 0.7, s));
    if (!drag.on) active += (idx - active) * 0.12;
    const sel = Math.round(Math.min(list.length - 1, Math.max(0, active)));
    const drift = ptrX * 0.03;               // a touch of parallax with the pointer
    items.forEach((c) => {
      const inList = c.slot >= 0;
      const k = inList ? c.slot - active : 0;
      const ak = Math.abs(k);
      const show = inList ? enter * (1 - sm(1.35, 1.85, ak)) : 0;        // the centre card and one either side (the tunnel walls are close)
      c.vis += (show - c.vis) * 0.14;                                   // cards fade/fly between filters
      c.card.visible = c.vis > 0.01;
      if (!c.card.visible) return;
      const y = 1.48 + Math.sin(t * 0.9 + c.ph) * 0.025 - (1 - c.vis) * 0.6;
      onRow(c.card, k * PITCH + drift, y, (1 - c.vis) * 2.2);
      tmp.copy(c.card.position);
      const isSel = inList && c.slot === sel && enter > 0.5;
      c.screenM.opacity = c.vis;                                     // solid cards: the ones to the side are dimmed, not see-through
      c.screenM.color.setScalar(1 - Math.min(ak, 1) * 0.35);
      c.sheenM.opacity = 0;                                          // no shimmer (Ahmed)
      c.sheenM.map.offset.x = 0.35 - k * 0.3 - ptrX * 0.25;
      c.halo.material.opacity += ((isSel ? 0.16 : 0) * c.vis - c.halo.material.opacity) * 0.15;
    });
    // filter above, arrows below, both on the same cylinder as the cards
    tabMesh.visible = navMesh.visible = enter > 0.01;
    tabMesh.material.opacity = navMesh.material.opacity = enter;
    onRow(tabMesh, drift, 2.5);
    onRow(navMesh, drift, 0.36);
    // animate the tab indicator / sizes, redrawing only while something is still moving
    let moving = false;
    if (tabSt.style === 'title') tabSt.sizes = tabSt.sizes.map((v, i) => { const to = tabSt.keys[i] === filter ? 120 : 44; if (Math.abs(to - v) > 0.3) moving = true; return v + (to - v) * 0.2; });
    else if (tabSt.ind) { const b = tabSt.boxes[tabSt.keys.indexOf(filter)]; if (b && (Math.abs(b[0] - tabSt.ind.x) > 0.5 || Math.abs(b[1] - b[0] - tabSt.ind.w) > 0.5)) moving = true; }
    if (tabSt.style === 'title' && tabSt.offT != null && Math.abs(tabSt.offT - tabSt.off) > 0.5) moving = true;
    if (moving) redrawTabs();
    focus = enter > 0.5 ? sel : -1;
    return focus;
  }

  /* pointer: tabs filter, arrows step, on-sale cards book */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x, y, camera, rect) {
    if (!group.visible || enter < 0.5) return null;
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const targets = [tabMesh, navMesh, ...items.filter((c) => c.card.visible && c.vis > 0.5).map((c) => c.screen)];
    const h = ray.intersectObjects(targets, false)[0];
    if (!h) return null;
    if (h.object === tabMesh) {
      const px = h.uv.x * tabC.width, i = tabSt.boxes.findIndex(([a, b]) => px >= a && px <= b);
      return i >= 0 ? { tab: i } : null;
    }
    if (h.object === navMesh) {
      const px = h.uv.x * navC.width, side = navC.height;
      if (px <= side && idx > 0) return { nav: 'prev' };
      if (px >= navC.width - side && idx < list.length - 1) return { nav: 'next' };
      return null;
    }
    return { card: items.find((c) => c.screen === h.object) };
  }
  function hover(x, y, camera, rect) {
    if (drag.on) return false;
    const hit = pick(x, y, camera, rect);
    const tHot = hit?.tab ?? -1;
    if (tHot !== tabSt.hot) { tabSt.hot = tHot; redrawTabs(); }
    const nHot = hit?.nav ?? null;
    if (nHot !== navHot) { navHot = nHot; redrawNav(); }
    items.forEach((it) => { const hot = hit?.card === it; if (hot !== it.hot) { it.hot = hot; it.redraw(hot); } });
    return !!(hit?.tab != null || hit?.nav || (hit?.card && (hit.card.data.onSale || hit.card.slot !== sel())));
  }
  const sel = () => Math.round(Math.min(list.length - 1, Math.max(0, active)));
  function click(x, y, camera, rect) {
    if (performance.now() - drag.endT < 250) return enter > 0.5;
    const hit = pick(x, y, camera, rect);
    if (!hit) return false;
    if (hit.tab != null) { const key = tabSt.keys[hit.tab]; if (key !== filter) setFilter(key); return true; }
    if (hit.nav) { go(idx + (hit.nav === 'next' ? 1 : -1)); return true; }
    if (hit.card) {
      // a card off to the side comes to the centre first; the centred one books
      if (hit.card.slot !== sel()) { go(hit.card.slot); return true; }
      // Ahmed: booking walks you on down the tunnel into the stadium to pick your seat there
      if (hit.card.data.onSale) { if (onBook) onBook(hit.card.data); else window.open(hit.card.data.url, '_blank', 'noopener'); }
    }
    return true;
  }
  const inside = (c) => { const q = c.position; return q.x > X0 + 0.4 && q.x < X1 && q.z > Z0 && q.z < Z1 && q.y < H; };
  return {
    group, items, update, hover, click, setFilter, go, dragStart, dragMove, dragEnd,
    get focus() { return focus; }, get index() { return idx; }, get active() { return enter > 0.5; }, inside,
  };
}
