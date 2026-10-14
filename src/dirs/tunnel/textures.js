// Canvas-painted textures for the tunnel walk-out: wall stencils, banner, floor marking,
// pitch, LED ribbons and the soft sprites used for glows, flares and light shafts.
import * as THREE from 'three';

const Y = '#fef201';
const INK = '#f4f1e8';

export async function loadFonts() {
  const wait = new Promise((r) => setTimeout(r, 2500));
  const load = Promise.all([
    document.fonts.load('400 120px Anton'),
    document.fonts.load('600 40px "JetBrains Mono"'),
    document.fonts.load('500 40px "JetBrains Mono"'),
  ]).then(() => document.fonts.ready).catch(() => {});
  await Promise.race([load, wait]);
}

export const loadImage = (src) => new Promise((res) => {
  const i = new Image();
  i.decoding = 'async';
  i.onload = () => res(i);
  i.onerror = () => res(null);
  i.src = src;
});

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = false, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// seeded random so the paint wear is identical on every load
function rng(seed = 7) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// knock random flecks out of whatever is painted: worn spray paint on concrete
function wear(g, w, h, { n = 1400, max = 5, seed = 3, alpha = 0.9 } = {}) {
  const r = rng(seed);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < n; i++) {
    g.globalAlpha = r() * alpha;
    g.beginPath();
    g.arc(r() * w, r() * h, r() * max + 0.4, 0, Math.PI * 2);
    g.fill();
  }
  // a few long scuffs
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    g.globalAlpha = 0.25 + r() * 0.4;
    g.lineWidth = 1 + r() * 3;
    const x = r() * w, y = r() * h;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 240, y + (r() - 0.5) * 30); g.stroke();
  }
  g.restore();
}

// horizontal bridges cut through letters so the type reads as a stencil
function bridges(g, x, y, w, h, rows = [0.36, 0.64], gap = 0.045) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (const r of rows) g.fillRect(x, y + h * r, w, h * gap);
  g.restore();
}

function overspray(g, draw, color, blur) {
  g.save();
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.globalAlpha = 0.35;
  draw();
  g.restore();
  draw();
}

/* ── left wall: EST. 1927 ── */
export function wallEst() {
  const [c, g] = cv(2400, 640);
  g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  g.font = '600 46px "JetBrains Mono"';
  g.fillText('AL-ITTIHAD CLUB · JEDDAH', 40, 110);
  g.fillStyle = Y;
  g.font = '400 520px Anton';
  const draw = () => g.fillText('1927', 30, 610);
  overspray(g, draw, Y, 18);
  const w = g.measureText('1927').width;
  bridges(g, 30, 236, w, 374, [0.47], 0.028);
  g.fillStyle = INK;
  g.font = '400 210px Anton';
  g.fillText('EST.', w + 90, 610);
  g.font = '500 40px "JetBrains Mono"';
  g.fillText('THE TIGERS', w + 96, 360);
  g.fillText('AL-AMEED', w + 96, 404);
  wear(g, c.width, c.height, { seed: 11 });
  return tex(c);
}

/* ── overhead banner ── */
export function banner() {
  const [c, g] = cv(2048, 300);
  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = Y;
  g.fillRect(0, 0, c.width, 10);
  g.fillRect(0, c.height - 10, c.width, 10);
  // tiger-stripe ends
  for (let i = 0; i < 5; i++) {
    g.fillRect(28 + i * 26, 30, 12, c.height - 60);
    g.fillRect(c.width - 40 - i * 26, 30, 12, c.height - 60);
  }
  g.font = '400 196px Anton';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const a = 'THE TIGERS ARE ', b = 'HOME';
  const wa = g.measureText(a).width, wb = g.measureText(b).width;
  const x0 = c.width / 2 - (wa + wb) / 2;
  g.textAlign = 'left';
  g.fillStyle = INK;
  g.fillText(a, x0, 158);
  g.fillStyle = Y;
  g.fillText(b, x0 + wa, 158);
  return tex(c);
}

/* ── right wall: 62,000 seats ── */
export function wallSeats() {
  const [c, g] = cv(2400, 640);
  g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  g.font = '400 290px Anton';
  overspray(g, () => g.fillText('62,000 SEATS.', 30, 300), INK, 14);
  g.fillStyle = Y;
  overspray(g, () => g.fillText('ONE IS YOURS.', 30, 590), Y, 14);
  g.fillStyle = INK;
  g.font = '500 34px "JetBrains Mono"';
  g.fillText('ALINMA STADIUM · APPROX. CAPACITY', 1740, 300);
  wear(g, c.width, c.height, { seed: 23, n: 1100 });
  return tex(c);
}

/* ── left wall: Al-Ameed ── */
export function wallDean() {
  const [c, g] = cv(2400, 640);
  g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  g.font = '400 440px Anton';
  const draw = () => g.fillText('AL-AMEED', 30, 520);
  overspray(g, draw, INK, 16);
  const w = g.measureText('AL-AMEED').width;
  g.fillStyle = Y;
  g.fillRect(36, 556, w - 12, 22);
  g.font = '600 44px "JetBrains Mono"';
  g.fillText('THE DEAN', w + 80, 420);
  g.fillStyle = INK;
  g.font = '500 38px "JetBrains Mono"';
  g.fillText('JEDDAH · SINCE 1927', w + 80, 474);
  wear(g, c.width, c.height, { seed: 41 });
  return tex(c);
}

/* ── more wall graphics so the tunnel isn't bare (Ahmed, 2026-10-11). Same stencil language; only real
   club content: the honours are the trophy room's years (trophies.js), the rest is the club's name,
   colours, nickname and founding year. ── */

// right wall: the honours — "CHAMPIONS" and the league title years
export function wallHonours(league, asia) {
  const [c, g] = cv(2400, 760);
  g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  g.font = '600 44px "JetBrains Mono"';
  g.fillText('HONOURS · YEARS ONLY', 40, 96);
  g.fillStyle = Y;
  g.font = '400 300px Anton';
  overspray(g, () => g.fillText('CHAMPIONS', 30, 410), Y, 14);
  g.fillStyle = INK;
  g.font = '600 38px "JetBrains Mono"';
  g.fillText('SAUDI LEAGUE', 40, 500);
  g.font = '500 44px "JetBrains Mono"';
  const per = 5;
  league.forEach((y, i) => g.fillText(y, 40 + (i % per) * 300, 570 + Math.floor(i / per) * 62));
  g.fillStyle = Y;
  g.font = '600 38px "JetBrains Mono"';
  g.fillText('ASIA', 1620, 500);
  g.fillStyle = INK;
  g.font = '400 150px Anton';
  g.fillText(asia.join(' · '), 1610, 660);
  wear(g, c.width, c.height, { seed: 57, n: 1200 });
  return tex(c);
}

// right wall, at the start: a band of tiger stripes with the club's name in Arabic and English
export function wallStripes() {
  const [c, g] = cv(2600, 700);
  g.save();
  g.beginPath(); g.rect(0, 120, c.width, 460); g.clip();
  for (let x = -600; x < c.width + 600; x += 150) {
    g.fillStyle = Y;
    g.beginPath(); g.moveTo(x, 580); g.lineTo(x + 70, 580); g.lineTo(x + 70 + 300, 120); g.lineTo(x + 300, 120); g.closePath(); g.fill();
  }
  g.restore();
  // the name, knocked out of a black plate over the stripes
  g.fillStyle = '#0b0b0b'; g.fillRect(560, 210, 1480, 280);
  g.fillStyle = Y; g.fillRect(560, 210, 1480, 8); g.fillRect(560, 482, 1480, 8);
  g.textAlign = 'center';
  g.fillStyle = INK;
  g.font = '700 150px Cairo';
  g.fillText('نادي الاتحاد', 1300, 380);
  g.font = '600 40px "JetBrains Mono"';
  g.fillStyle = Y;
  g.fillText('AL-ITTIHAD CLUB · JEDDAH', 1300, 455);
  wear(g, c.width, c.height, { seed: 63, n: 1500 });
  return tex(c);
}

// right wall, toward the mouth: the colours
export function wallColours() {
  const [c, g] = cv(3200, 600);
  g.textBaseline = 'alphabetic';
  g.fillStyle = Y;
  g.font = '400 380px Anton';
  overspray(g, () => g.fillText('YELLOW', 30, 470), Y, 16);
  const wy = g.measureText('YELLOW').width;
  g.fillStyle = INK;
  g.font = '400 220px Anton';
  g.fillText('&', 60 + wy, 470);
  const wa = g.measureText('&').width;
  g.font = '400 380px Anton';
  g.fillStyle = '#0b0b0b';
  g.strokeStyle = INK; g.lineWidth = 6;
  g.fillText('BLACK', 110 + wy + wa, 470); g.strokeText('BLACK', 110 + wy + wa, 470);
  const wb = g.measureText('BLACK').width;
  g.fillStyle = INK;
  g.font = '600 44px "JetBrains Mono"';
  g.fillText('SINCE 1927', 160 + wy + wa + wb, 300);
  g.fillStyle = Y;
  g.fillRect(160 + wy + wa + wb, 330, 360, 14);
  wear(g, c.width, c.height, { seed: 71, n: 1300 });
  return tex(c);
}

// left wall, toward the mouth: the nickname and three claw marks
export function wallTigers() {
  const [c, g] = cv(2400, 760);
  g.textBaseline = 'alphabetic';
  g.fillStyle = INK;
  g.font = '400 420px Anton';
  overspray(g, () => g.fillText('TIGERS', 30, 560), INK, 16);
  const w = g.measureText('TIGERS').width;
  // claw marks raked across the end of the word
  g.fillStyle = Y;
  for (let i = 0; i < 3; i++) {
    const x = w - 260 + i * 120;
    g.beginPath(); g.moveTo(x, 120); g.quadraticCurveTo(x + 70, 380, x + 40, 690); g.lineTo(x + 16, 690); g.quadraticCurveTo(x + 40, 380, x - 26, 130); g.closePath(); g.fill();
  }
  g.fillStyle = Y;
  g.font = '600 44px "JetBrains Mono"';
  g.fillText('THE TIGERS', w + 90, 470);
  g.fillStyle = INK;
  g.font = '500 38px "JetBrains Mono"';
  g.fillText('AL-ITTIHAD · JEDDAH', w + 90, 524);
  wear(g, c.width, c.height, { seed: 83, n: 1200 });
  return tex(c);
}

// left wall, at the start: stencilled tunnel wayfinding
export function wallWayfinding() {
  const [c, g] = cv(1400, 760);
  g.textBaseline = 'alphabetic';
  g.fillStyle = Y; g.fillRect(40, 60, 1320, 16);
  g.fillStyle = INK;
  g.font = '600 46px "JetBrains Mono"';
  g.fillText('TUNNEL 01', 40, 150);
  g.font = '400 210px Anton';
  overspray(g, () => g.fillText("PLAYERS'", 30, 380), INK, 12);
  overspray(g, () => g.fillText('TUNNEL', 30, 600), INK, 12);
  g.fillStyle = Y;
  g.font = '400 120px Anton';
  g.fillText('PITCH  →', 860, 600);
  g.fillStyle = INK;
  g.font = '500 32px "JetBrains Mono"';
  g.fillText('PLAYERS & MATCH OFFICIALS', 40, 690);
  wear(g, c.width, c.height, { seed: 97, n: 900 });
  return tex(c);
}

/* ── floor stencil (drawn squat, stretched along the floor so it reads in perspective) ── */
export function floorMark() {
  const [c, g] = cv(1024, 512);
  g.fillStyle = Y;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '400 300px Anton';
  g.save();
  g.scale(1, 1.6);
  g.fillText('TIGERS', 512, 160);
  g.restore();
  g.fillRect(140, 470, 744, 18);
  wear(g, c.width, c.height, { seed: 5, n: 1800, max: 7 });
  return tex(c);
}

/* ── hanging LED sign at the mouth ── */
export function walkSign() {
  const [c, g] = cv(1024, 192);
  g.fillStyle = '#050505';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = Y;
  g.font = '400 128px Anton';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('WALK OUT  →', 512, 102);
  // dot-matrix grille
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x < c.width; x += 6) g.fillRect(x, 0, 2, c.height);
  for (let y = 0; y < c.height; y += 6) g.fillRect(0, y, c.width, 2);
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = '#050505';
  g.fillRect(0, 0, c.width, c.height);
  return tex(c);
}

/* ── scrolling LED ribbon text (fascia + pitch boards) ── */
export function ledRibbon({ bg = '#000', a = Y, b = INK } = {}) {
  const [c, g] = cv(2048, 96);
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.font = '400 70px Anton';
  g.textBaseline = 'middle';
  const words = ['AL-ITTIHAD', '✶', 'EST. 1927', '✶', 'JEDDAH', '✶', 'THE TIGERS', '✶', 'AL-AMEED', '✶'];
  const total = words.reduce((s, w) => s + g.measureText(w).width + 44, 0);
  let x = (c.width - total) / 2 + 22;
  words.forEach((w, i) => {
    g.fillStyle = i % 2 ? b : a;
    g.fillText(w, x, 52);
    x += g.measureText(w).width + 44;
  });
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < c.height; y += 4) g.fillRect(0, y, c.width, 1);
  g.globalCompositeOperation = 'destination-over';
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  return tex(c, { repeat: true });
}

/* ── pitch: mowing stripes, markings, baked floodlight pools ── */
export function pitch() {
  const L = 105, W = 68, M = 2; // metres; the rest of the run-off is the bowl's grass apron
  const s = 18;
  const [c, g] = cv(Math.round((L + M * 2) * s), Math.round((W + M * 2) * s));
  const X = (m) => (m + M) * s, Yp = (m) => (m + M) * s;
  // grass
  const bands = 18;
  for (let i = 0; i < bands + 4; i++) {
    g.fillStyle = i % 2 ? '#2a6a2b' : '#326f2f';
    g.fillRect(X(-M + (i * (L + M * 2)) / (bands + 4)), 0, ((L + M * 2) / (bands + 4)) * s + 1, c.height);
  }
  // fine grain
  const r = rng(9);
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,210,0.035)' : 'rgba(0,0,0,0.05)';
    g.fillRect(r() * c.width, r() * c.height, 2, 2);
  }
  // floodlight pools from the four corners and a hot centre
  const pool = (x, y, rad, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,252,225,${a})`);
    gr.addColorStop(1, 'rgba(255,252,225,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
  };
  g.globalCompositeOperation = 'lighter';
  pool(X(L / 2), Yp(W / 2), 60 * s, 0.16);
  [[0.08, 0.1], [0.92, 0.1], [0.08, 0.9], [0.92, 0.9]].forEach(([u, v]) => pool(X(L * u), Yp(W * v), 34 * s, 0.07));
  g.globalCompositeOperation = 'source-over';
  // vignette towards the run-off
  const vg = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.3, c.width / 2, c.height / 2, c.width * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg;
  g.fillRect(0, 0, c.width, c.height);
  // markings
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 0.14 * s;
  const rect = (x, y, w, h) => g.strokeRect(X(x), Yp(y), w * s, h * s);
  rect(0, 0, L, W);
  g.beginPath(); g.moveTo(X(L / 2), Yp(0)); g.lineTo(X(L / 2), Yp(W)); g.stroke();
  g.beginPath(); g.arc(X(L / 2), Yp(W / 2), 9.15 * s, 0, Math.PI * 2); g.stroke();
  const dot = (x, y, rr = 0.3) => { g.beginPath(); g.arc(X(x), Yp(y), rr * s, 0, Math.PI * 2); g.fill(); };
  dot(L / 2, W / 2);
  for (const side of [0, 1]) {
    const x0 = side ? L - 16.5 : 0, x1 = side ? L - 5.5 : 0;
    rect(x0, W / 2 - 20.16, 16.5, 40.32);
    rect(x1, W / 2 - 9.16, 5.5, 18.32);
    const px = side ? L - 11 : 11;
    dot(px, W / 2);
    g.beginPath();
    const a = Math.acos(5.5 / 9.15);
    if (side) g.arc(X(px), Yp(W / 2), 9.15 * s, Math.PI - a, Math.PI + a);
    else g.arc(X(px), Yp(W / 2), 9.15 * s, -a, a);
    g.stroke();
  }
  for (const [x, y, a0] of [[0, 0, 0], [L, 0, Math.PI / 2], [L, W, Math.PI], [0, W, -Math.PI / 2]]) {
    g.beginPath(); g.arc(X(x), Yp(y), 1 * s, a0, a0 + Math.PI / 2); g.stroke();
  }
  const t = tex(c, { aniso: 16 });
  return { tex: t, w: L + M * 2, h: W + M * 2 };
}

/* ── soft sprites ── */
export function radial(stops = [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,248,220,0.45)'], [1, 'rgba(255,240,200,0)']], size = 256) {
  const [c, g] = cv(size, size);
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return tex(c, { srgb: false, aniso: 1 });
}

export function ring(size = 256) {
  const [c, g] = cv(size, size);
  const gr = g.createRadialGradient(size / 2, size / 2, size * 0.32, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.5)');
  gr.addColorStop(0.75, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return tex(c, { srgb: false, aniso: 1 });
}

export function hexagon(size = 128) {
  const [c, g] = cv(size, size);
  g.translate(size / 2, size / 2);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * size * 0.46, Math.sin(a) * size * 0.46);
  }
  g.closePath();
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
  gr.addColorStop(0, 'rgba(255,255,255,0.25)');
  gr.addColorStop(0.85, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0.1)');
  g.fillStyle = gr;
  g.filter = 'blur(2px)';
  g.fill();
  return tex(c, { srgb: false, aniso: 1 });
}

// horizontal anamorphic streak
export function streak() {
  const [c, g] = cv(512, 32);
  const gr = g.createLinearGradient(0, 0, 512, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.5, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 512, 32);
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 32);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 512, 32);
  return tex(c, { srgb: false, aniso: 1 });
}

// a slab of light with vertical rays, for the shafts coming through the mouth
export function shaft() {
  const [c, g] = cv(256, 256);
  const r = rng(17);
  for (let i = 0; i < 60; i++) {
    const x = r() * 256, w = 4 + r() * 22;
    const gr = g.createLinearGradient(x - w, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, `rgba(255,255,255,${0.05 + r() * 0.12})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x - w, 0, w * 2, 256);
  }
  g.globalCompositeOperation = 'destination-in';
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0.15)');
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 256);
  const h = g.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.15, 'rgba(0,0,0,1)');
  h.addColorStop(0.85, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 256, 256);
  return tex(c, { srgb: false, aniso: 1 });
}
