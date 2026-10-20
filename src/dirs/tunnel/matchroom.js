// The matches row (Ahmed, 2026-10-14: "enhance the UI of the match cards"; benchmarked against MLS, StubHub,
// Paramount+, Apple Sports). Three card designs while Ahmed compares them — ?cards=stub | poster | site:
//   stub    a match ticket: yellow body, perforated tear line, a black stub with the price and Book button
//   poster  a matchday poster: Ittihad yellow against the opponent's colour, crests large, date tag
//   site    the ticketing site's card (MLS-style): dark card, crests either side, kick-off tag, venue, button
// The row is straight and evenly spaced (no curl into the walls); matches that have kicked off drop out.
//
// Originally: the matches room: the last stop before the pitch, through a door in the tunnel's right wall near the
// mouth. Every upcoming home match is a clear glass card floating in front of you in an arc, like a
// game's match-select menu (Ahmed's picks: floating, transparent, no LED, no overlap). Tournament tabs float
// above the cards; picking one re-deals the carousel and re-lights the room in that tournament's colour.
// Arrows, swipe/drag and the ← → keys move the row (curved like the tilted-grid effect); on-sale cards carry "Book tickets" (click → booking page), the rest
// "Coming soon". Data: fixtures.js.
import * as THREE from 'three';
import { TN } from './world.js';
import { when, eventUrl, TIERS, SEASON, seasonUrl } from '../../data.js';
import { FIXTURES, COMPS } from './fixtures.js';

// the walk pauses here, in the tunnel before the mouth, while you browse the matches (scene.js)
export const MATCH_HOLD_Z = 47.4;   // past every room door (the gym's is the last, at 50.8), at the mouth
export const MROOM = { X0: TN.HW, X1: 18, Z0: 54.5, Z1: 66, H: 3.4 };   // under the stand, so a low ceiling
const loadImg = (src) => new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function fit(x, text, maxW, size, font = 'Anton', weight = 400) {
  x.font = `${weight} ${size}px ${font}`;
  while (x.measureText(text).width > maxW && size > 10) { size -= 2; x.font = `${weight} ${size}px ${font}`; }
  return size;
}
function wrap(x, text, maxW, maxLines) {
  const words = String(text).split(' '), out = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  if (out.length > maxLines) { const keep = out.slice(0, maxLines); keep[maxLines - 1] += '…'; return keep; }
  return out;
}
function rrect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }


// phones (Ahmed: "the tickets are so small on mobile"): a 3D card is ~200 px tall on a phone held sideways, too
// small to read, so there the row is drawn as real HTML cards over the tunnel (main.js) and the 3D ones stay hidden
export const PHONE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
export const CARD_STYLE = (() => { const v = new URLSearchParams(location.search).get('cards'); return ['stub', 'poster', 'site'].includes(v) ? v : 'site'; })();   // Ahmed picked the site card (2026-10-14)
const CW = 1024, CH = CARD_STYLE === 'site' ? 1150 : 1352;   // card canvas, portrait (the site card is shorter: no chips)
const AST = 3 * 3600 * 1000;
const ucf = (s) => s.charAt(0) + s.slice(1).toLowerCase();
export const compName = (m) => COMPS[m.comp]?.label || m.compLabel;
export const venueOf = (m) => (!m.venue || m.venue === 'TBC' ? 'Venue TBC' : m.venue);
export function dateBits(m) {
  if (!m.kickoff) return { big: m.dateText || 'Date TBC', time: 'TBC', long: m.dateText || 'Date TBC', rel: '' };
  const w = when(m.kickoff), y = new Date(m.kickoff * 1000 + AST).getUTCFullYear();
  const days = Math.round((Date.UTC(...ymd(m.kickoff * 1000 + AST)) - Date.UTC(...ymd(Date.now() + AST))) / 864e5);
  const rel = days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : days < 14 ? `In ${days} days` : days < 60 ? `In ${Math.round(days / 7)} weeks` : `In ${Math.round(days / 30)} months`;
  return { big: `${w.day} ${w.date} ${w.month}`, time: m.timeTBC ? 'TBC' : w.time, long: `${ucf(w.day)}, ${w.date} ${ucf(w.month)} ${y}`, rel };
}
const ymd = (t) => { const d = new Date(t); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };
export function priceBits(m) {
  const t = TIERS[m.slug];
  if (!m.onSale) return { from: null, line: 'Tickets not on sale yet' };
  if (!t) return { from: m.from, line: '' };
  const max = Math.max(...t.map((x) => x.price));
  return { from: m.from, line: `${t.length} categories · up to SAR ${max.toLocaleString('en')}` };
}
// a club's colour, read off its crest (the most common saturated colour), so the poster can split in it
const crestColour = new Map();
function clubColour(img, fallback = '#3a3a3a') {
  if (!img) return fallback;
  if (crestColour.has(img)) return crestColour.get(img);
  const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data, bins = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 60 || mx < 60) continue;                       // greys, black, white are not the colour
    const k = `${r >> 5},${g >> 5},${b >> 5}`; const e = bins.get(k) || [0, 0, 0, 0]; e[0] += r; e[1] += g; e[2] += b; e[3]++; bins.set(k, e);
  }
  let best = null; for (const e of bins.values()) if (!best || e[3] > best[3]) best = e;
  const col = best && best[3] > 20 ? `rgb(${best[0] / best[3] | 0},${best[1] / best[3] | 0},${best[2] / best[3] | 0})` : fallback;
  crestColour.set(img, col);
  return col;
}
function crest(x, img, m, X, Y, s, dark = false) {
  if (img) x.drawImage(img, X, Y, s, s);
  else { x.save(); x.beginPath(); x.arc(X + s / 2, Y + s / 2, s / 2 - 4, 0, Math.PI * 2); x.fillStyle = dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'; x.fill(); x.lineWidth = 4; x.strokeStyle = dark ? '#111' : 'rgba(255,255,255,0.6)'; x.stroke(); x.fillStyle = dark ? '#111' : '#fff'; x.textAlign = 'center'; fit(x, m.oppCode || '?', s * 0.7, s * 0.34); x.fillText(m.oppCode || '?', X + s / 2, Y + s / 2 + s * 0.12); x.restore(); }
}
function claws(x, X, Y, h, a = 0.1) {
  // three tiger scratches, like the tunnel walls'
  x.save(); x.fillStyle = `rgba(0,0,0,${a})`;
  for (let i = 0; i < 3; i++) { const ox = X + i * h * 0.16; x.beginPath(); x.moveTo(ox, Y); x.quadraticCurveTo(ox + h * 0.12, Y + h * 0.5, ox + h * 0.02, Y + h); x.quadraticCurveTo(ox + h * 0.06, Y + h * 0.5, ox - h * 0.02, Y + h * 0.04); x.fill(); }
  x.restore();
}
function button(x, X, Y, w, h, m, hot, { onY = '#ffea00', offBg = null, onText = '#111', offText = '#fff', label, size = 46 } = {}) {
  rrect(x, X, Y, w, h, 8);
  if (m.onSale) { x.fillStyle = hot ? '#ffffff' : onY; x.fill(); x.fillStyle = onText; }
  else { if (offBg) { x.fillStyle = offBg; x.fill(); } else { x.lineWidth = 4; x.strokeStyle = hot ? '#fff' : 'rgba(255,255,255,0.55)'; x.stroke(); } x.fillStyle = offText; }
  x.textAlign = 'center'; x.font = `800 ${size}px Cairo`;
  x.fillText(label || (m.onSale ? 'Book tickets  →' : 'Coming soon'), X + w / 2, Y + h / 2 + size * 0.35);
}

/* 1 · ticket stub */
function drawStub(c, m, cr, hot) {
  const x = c.getContext('2d'), W = CW, H = CH, PERF = 968, d = dateBits(m), p = priceBits(m), accent = '#111';
  x.clearRect(0, 0, W, H);
  rrect(x, 0, 0, W, PERF, 12); x.fillStyle = '#f2c418'; x.fill();
  x.fillStyle = '#f2c418'; x.fillRect(0, PERF - 20, W, 20);
  rrect(x, 0, PERF, W, H - PERF, 12); x.fillStyle = '#121212'; x.fill(); x.fillRect(0, PERF, W, 20);
  claws(x, W - 250, 40, 300, 0.07);
  // tear line: notches at the edges, dashes between
  x.save(); x.globalCompositeOperation = 'destination-out';
  for (const cx of [0, W]) { x.beginPath(); x.arc(cx, PERF, 36, 0, Math.PI * 2); x.fill(); }
  x.restore();
  x.fillStyle = 'rgba(255,255,255,0.35)'; for (let px = 60; px < W - 60; px += 34) x.fillRect(px, PERF - 2, 18, 4);
  // header: competition, round
  x.textAlign = 'left'; x.fillStyle = accent; fit(x, compName(m), 620, 34, 'Cairo', 800); x.fillText(compName(m), 56, 84);
  x.textAlign = 'right'; x.font = '600 30px Cairo'; x.fillText(m.round || '', W - 56, 84);
  x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(56, 112, W - 112, 3);
  // crests and names
  const cs = 250, cy = 160, lx = W * 0.27, rx = W * 0.73;
  crest(x, cr.home, m, lx - cs / 2, cy, cs, true); crest(x, cr.away, m, rx - cs / 2, cy, cs, true);
  x.textAlign = 'center'; x.fillStyle = '#111'; x.font = '400 70px Anton'; x.fillText('VS', W / 2, cy + cs / 2 + 26);
  fit(x, 'AL ITTIHAD', 400, 54); x.fillText('AL ITTIHAD', lx, cy + cs + 70);
  fit(x, m.oppShort, 400, 54); x.fillText(m.oppShort, rx, cy + cs + 70);
  // date, then three fields
  fit(x, d.big, W - 112, 150); x.fillText(d.big, W / 2, 668);
  const fields = [['Kick-off', d.time, 0.22], ['Venue', venueOf(m), 0.53], ['When', d.rel || '—', 0.25]];
  x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(56, 718, W - 112, 3);
  let fx = 56;
  fields.forEach(([k, v, fr], i) => {
    const fw = (W - 112) * fr; x.textAlign = 'left';
    if (i) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(fx - 14, 750, 2, 150); }
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.font = '700 28px Cairo'; x.fillText(k, fx, 778);
    x.fillStyle = '#111'; x.font = '800 38px Cairo';
    const lines = wrap(x, v, fw - 24, 2);
    lines.forEach((ln, j) => x.fillText(ln, fx, 832 + j * 44));
    fx += fw + 14;
  });
  // the stub
  x.textAlign = 'left';
  if (p.from != null) {
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '700 28px Cairo'; x.fillText('From', 56, PERF + 82);
    x.fillStyle = '#f2c418'; x.font = '400 92px Anton'; x.fillText(`SAR ${p.from}`, 56, PERF + 178);
    x.fillStyle = 'rgba(255,255,255,0.6)'; fit(x, p.line, 420, 26, 'Cairo', 600); x.fillText(p.line, 56, PERF + 226);
  } else {
    x.fillStyle = '#fff'; x.font = '400 62px Anton'; x.fillText('COMING SOON', 56, PERF + 140);
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.font = '600 28px Cairo'; x.fillText(p.line, 56, PERF + 190);
  }
  button(x, 540, PERF + 90, W - 540 - 56, 128, m, hot, { onY: '#f2c418', label: m.onSale ? 'Book  →' : 'Notify me' });
  x.textAlign = 'left';
}

/* 2 · matchday poster */
function drawPoster(c, m, cr, hot) {
  const x = c.getContext('2d'), W = CW, H = CH, d = dateBits(m), p = priceBits(m), PANEL = 840;
  x.clearRect(0, 0, W, H);
  x.save(); rrect(x, 0, 0, W, H, 12); x.clip();
  const opp = clubColour(cr.away, '#2c2c2c');
  x.fillStyle = '#f2c418'; x.fillRect(0, 0, W, PANEL);
  x.fillStyle = opp; x.beginPath(); x.moveTo(W * 0.64, 0); x.lineTo(W, 0); x.lineTo(W, PANEL); x.lineTo(W * 0.36, PANEL); x.closePath(); x.fill();
  x.fillStyle = 'rgba(0,0,0,0.18)'; x.beginPath(); x.moveTo(W * 0.64, 0); x.lineTo(W * 0.655, 0); x.lineTo(W * 0.375, PANEL); x.lineTo(W * 0.36, PANEL); x.closePath(); x.fill();
  claws(x, 70, 470, 320, 0.12);
  // tags: competition top-left, date top-right
  const tag = (txt, X, Y, right = false) => { x.font = '800 30px Cairo'; const w = x.measureText(txt).width + 44; const tx = right ? X - w : X; rrect(x, tx, Y, w, 60, 6); x.fillStyle = '#111'; x.fill(); x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(txt, tx + 22, Y + 41); };
  tag(compName(m), 40, 40);
  tag(d.rel || 'Date TBC', W - 40, 40, true);
  // crests, large
  const cs = 330;
  x.save(); x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 30; x.shadowOffsetY = 12;
  // the away crest sits on a light disc so it never melts into its own colour
  x.beginPath(); x.arc(W * 0.73, 200 + cs / 2, cs * 0.56, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,0.94)'; x.fill();
  crest(x, cr.home, m, W * 0.27 - cs / 2, 200, cs, true); crest(x, cr.away, m, W * 0.73 - cs * 0.4, 200 + cs * 0.1, cs * 0.8, true);
  x.restore();
  x.textAlign = 'center'; x.font = '400 92px Anton'; x.lineWidth = 10; x.strokeStyle = '#111'; x.strokeText('VS', W / 2, 400); x.fillStyle = '#fff'; x.fillText('VS', W / 2, 400);
  x.fillStyle = '#111'; fit(x, m.round ? m.round.toUpperCase() : '', W * 0.4, 34, 'Anton'); x.textAlign = 'left'; x.fillText(m.round ? m.round.toUpperCase() : '', 50, PANEL - 40);
  // the black panel
  x.fillStyle = '#111'; x.fillRect(0, PANEL, W, H - PANEL);
  x.textAlign = 'left'; x.fillStyle = '#fff'; const nm = `AL ITTIHAD  v  ${m.oppShort}`; fit(x, nm, W - 100, 62); x.fillText(nm, 50, PANEL + 92);
  x.fillStyle = '#f2c418'; const dt = `${d.big}${d.time !== 'TBC' ? ` · ${d.time}` : ''}`; fit(x, dt, W - 100, 96); x.fillText(dt, 50, PANEL + 200);
  x.fillStyle = 'rgba(255,255,255,0.65)'; fit(x, `${venueOf(m)}${d.time === 'TBC' ? ' · kick-off TBC' : ''}`, W - 100, 30, 'Cairo', 600); x.fillText(`${venueOf(m)}${d.time === 'TBC' ? ' · kick-off TBC' : ''}`, 50, PANEL + 252);
  const by = H - 50 - 120;
  if (p.from != null) { x.fillStyle = '#fff'; x.font = '800 40px Cairo'; x.fillText(`From SAR ${p.from}`, 50, by - 28); x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = '600 28px Cairo'; x.textAlign = 'right'; fit(x, p.line, 480, 28, 'Cairo', 600); x.fillText(p.line, W - 50, by - 28); }
  button(x, 50, by, W - 100, 120, m, hot, { onY: '#f2c418' });
  x.restore(); x.textAlign = 'left';
}

/* 3 · the ticketing site's card. Ahmed: the content bigger, same proportions and order — every size here is
   ~1.3× the first version, with tighter margins so it still fits the card. */
function drawSite(c, m, cr, hot) {
  const x = c.getContext('2d'), W = CW, H = CH, d = dateBits(m), p = priceBits(m), M = 44;
  x.clearRect(0, 0, W, H);
  rrect(x, 0, 0, W, H, 16); x.fillStyle = '#262626'; x.fill();
  x.textAlign = 'center';
  const comp = `${compName(m)}${m.round ? ` · ${m.round}` : ''}`;
  x.fillStyle = '#b5b5b5'; fit(x, comp, W - M * 2, 42, 'Cairo', 600); x.fillText(comp, W / 2, 96);
  x.fillStyle = '#fff'; fit(x, d.long, W - M * 2, 64, 'Cairo', 800); x.fillText(d.long, W / 2, 178);
  // crests either side, kick-off tag between
  const cs = 300, cy = 236, lx = W * 0.2, rx = W * 0.8;
  crest(x, cr.home, m, lx - cs / 2, cy, cs); crest(x, cr.away, m, rx - cs / 2, cy, cs);
  x.fillStyle = '#fff'; fit(x, 'AL ITTIHAD', 380, 52, 'Cairo', 800); x.fillText('AL ITTIHAD', lx, cy + cs + 76);
  fit(x, m.oppShort, 380, 52, 'Cairo', 800); x.fillText(m.oppShort, rx, cy + cs + 76);
  const tw = 270, th = 134, tx = W / 2 - tw / 2, ty = cy + cs / 2 - th / 2;
  rrect(x, tx, ty, tw, th, 12); x.fillStyle = '#1a1a1a'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#4a4a4a'; x.stroke();
  x.fillStyle = '#fff'; x.font = '800 72px Cairo'; x.fillText(d.time, W / 2, ty + 92);
  x.fillStyle = '#9a9a9a'; x.font = '600 32px Cairo'; x.fillText(d.time === 'TBC' ? 'Kick-off' : 'Kick-off (KSA)', W / 2, ty + th + 48);
  // venue with a pin
  const vy = 724, vt = venueOf(m); const vs = fit(x, vt, W - M * 2 - 60, 40, 'Cairo', 600); const vw = x.measureText(vt).width;
  const px0 = W / 2 - vw / 2 - 32, pr = vs * 0.34; x.fillStyle = '#9a9a9a';
  x.beginPath(); x.arc(px0, vy - vs * 0.5, pr, Math.PI, 0); x.lineTo(px0, vy + 4); x.closePath(); x.fill();
  x.fillStyle = '#262626'; x.beginPath(); x.arc(px0, vy - vs * 0.5, pr * 0.38, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#b5b5b5'; x.textAlign = 'left'; x.fillText(vt, W / 2 - vw / 2, vy);
  // price, then the button
  x.fillStyle = '#3a3a3a'; x.fillRect(M, 778, W - M * 2, 3);
  x.fillStyle = '#fff'; x.textAlign = 'left'; fit(x, p.from != null ? `From SAR ${p.from}` : 'Tickets not on sale yet', W - M * 2, 70, 'Cairo', 800);
  x.fillText(p.from != null ? `From SAR ${p.from}` : 'Tickets not on sale yet', M, 878);
  button(x, M, H - M - 160, W - M * 2, 160, m, hot, { offBg: '#404040', offText: '#9a9a9a', size: 60 });
  x.textAlign = 'left';
}
/* the season pass (Ahmed, 2026-10-15: "add season pass ticket"): the first card in the row, in the same
   site style — what it covers, where, the price from the live feed, and a button to the pass's own page */
function drawSeason(c, m, cr, hot) {
  const x = c.getContext('2d'), W = CW, H = CH, M = 44;
  x.clearRect(0, 0, W, H);
  rrect(x, 0, 0, W, H, 16); x.fillStyle = '#262626'; x.fill();
  rrect(x, 0, 0, W, H, 16); x.lineWidth = 6; x.strokeStyle = '#ffea00'; x.stroke();   // the one yellow-edged card
  x.textAlign = 'center';
  x.fillStyle = '#b5b5b5'; x.font = '600 42px Cairo'; x.fillText(`Season pass · ${SEASON.season}`, W / 2, 96);
  x.fillStyle = '#fff'; fit(x, SEASON.title, W - M * 2, 64, 'Cairo', 800); x.fillText(SEASON.title, W / 2, 178);
  const cs = 260; if (cr.home) x.drawImage(cr.home, W / 2 - cs / 2, 226, cs, cs);
  // what it covers
  x.textAlign = 'left'; let y = 560;
  SEASON.comps.forEach((t) => {
    x.strokeStyle = '#ffea00'; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(M + 6, y - 16); x.lineTo(M + 22, y); x.lineTo(M + 50, y - 32); x.stroke();
    x.fillStyle = '#fff'; fit(x, t, W - M * 2 - 80, 44, 'Cairo', 700); x.fillText(t, M + 78, y);
    y += 66;
  });
  x.fillStyle = '#9a9a9a'; const vt = SEASON.venues.join(' · '); fit(x, vt, W - M * 2, 32, 'Cairo', 600); x.fillText(vt, M, y + 8);
  x.fillStyle = '#3a3a3a'; x.fillRect(M, 812, W - M * 2, 3);
  x.fillStyle = '#fff'; x.font = '800 70px Cairo'; x.fillText(`From SAR ${SEASON.from}`, M, 912);
  button(x, M, H - M - 160, W - M * 2, 160, { onSale: true }, hot, { size: 60, label: 'Get the season pass  →' });
  x.textAlign = 'left';
}
function drawCard(c, m, crests, hot = false) {
  if (m.kind === 'season') return drawSeason(c, m, crests, hot);
  (CARD_STYLE === 'poster' ? drawPoster : CARD_STYLE === 'site' ? drawSite : drawStub)(c, m, crests, hot);
}

// The tournament filter: a segmented control, the active tournament in yellow sliding between labels.
// st.boxes is filled in on every draw so a click can be mapped back to a label.
function drawTabs(c, st) {
  const W = c.width, H = c.height, x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  const n = st.keys.length, act = st.keys.indexOf(st.active);
  const labels = st.keys.map((k) => COMPS[k].label);
  x.font = '700 54px Cairo';
  const PAD = 60, ws = labels.map((l) => x.measureText(l).width), total = ws.reduce((a, w) => a + w + PAD * 2, 0) + 24;
  let px = (W - total) / 2 + 12;
  st.boxes = ws.map((w) => { const b = [px, px + w + PAD * 2]; px += w + PAD * 2; return b; });
  const [t0, t1] = st.boxes[act];
  if (!st.ind) st.ind = { x: t0, w: t1 - t0 };
  st.ind.x += (t0 - st.ind.x) * 0.22; st.ind.w += (t1 - t0 - st.ind.w) * 0.22;
  const y0 = 30, h = 140;
  rrect(x, st.boxes[0][0] - 12, y0, total, h, 14); x.fillStyle = '#262626'; x.fill();
  rrect(x, st.ind.x, y0 + 12, st.ind.w, h - 24, 10); x.fillStyle = '#ffea00'; x.fill();
  labels.forEach((l, i) => {
    const [b0, b1] = st.boxes[i], mid = (b0 + b1) / 2, under = mid > st.ind.x && mid < st.ind.x + st.ind.w;
    x.fillStyle = under ? '#111' : st.hot === i ? '#fff' : 'rgba(255,255,255,0.7)'; x.textAlign = 'center';
    x.fillText(l, mid, y0 + h / 2 + 19);
  });
  x.textAlign = 'left';
}

// under the centre card: ‹  3 of 15  ›, with a progress bar
function drawNav(c, i, n, hot) {
  const W = c.width, H = c.height, x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  const btn = (X, dir, off, on) => {
    rrect(x, X + 6, 6, H - 12, H - 12, 12);
    x.fillStyle = off ? 'rgba(38,38,38,0.6)' : on ? '#ffea00' : '#262626'; x.fill();
    const cx = X + H / 2, cy = H / 2, s = H * 0.15;
    x.beginPath(); x.moveTo(cx + s * 0.55 * dir, cy - s); x.lineTo(cx - s * 0.55 * dir, cy); x.lineTo(cx + s * 0.55 * dir, cy + s);
    x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = off ? 'rgba(255,255,255,0.25)' : on ? '#111' : '#fff'; x.stroke();
  };
  btn(0, 1, i <= 0, hot === 'prev');
  btn(W - H, -1, i >= n - 1, hot === 'next');
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '700 52px Cairo';
  x.fillText(`${i + 1} of ${n}`, W / 2, H / 2 + 4);
  const bw = W - H * 2 - 160, bx = (W - bw) / 2;
  rrect(x, bx, H / 2 + 34, bw, 10, 5); x.fillStyle = '#404040'; x.fill();
  rrect(x, bx, H / 2 + 34, Math.max(10, bw * ((i + 1) / Math.max(1, n))), 10, 5); x.fillStyle = '#ffea00'; x.fill();
  x.textAlign = 'left';
}

// the row's edge mask, in screen space: everything fades out over the outer 14% of each side
const fadeHook = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vClipXW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvClipXW = gl_Position.xw;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vClipXW;')
    .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= smoothstep(1.0, 0.72, abs(vClipXW.x / vClipXW.y));');
};
const edgeFade = (m) => { m.onBeforeCompile = fadeHook; m.customProgramCacheKey = () => 'edgeFade'; return m; };
export async function buildMatchRoom({ env, lite = false, onBook }) {
  const group = new THREE.Group();
  // (the old matches room — walls, lights, LED strips — was walled up and never shown; it isn't built any more)
  const { X0, X1, Z0, Z1, H } = MROOM;
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

  /* the row (Ahmed, 2026-10-14): straight, evenly spaced, the centre card square-on and its neighbours set
     back and turned a little toward you; nothing curls into the tunnel walls. The tilted-grid curve is gone. */
  const BW = 1.5, BH = BW * (CH / CW);
  const CAMD = 3.9, SP = BW + 0.34;          // centre card 3.9 m ahead (big enough to read); one card + a gap between centres
  const FIXED_AT = new THREE.Vector3(0, 1.7, MATCH_HOLD_Z);      // where the walk holds in the tunnel
  const FWD = new THREE.Vector3(0, 0, -1), RIGHT = new THREE.Vector3(1, 0, 0);   // down the tunnel, toward the mouth
  const C0 = FIXED_AT.clone().addScaledVector(FWD, CAMD);
  const YC = 1.62;                           // card centre height
  const flat = (w, h) => new THREE.PlaneGeometry(w, h);
  // matches that have kicked off (over two hours ago) drop out of the row
  const LIVE = [{ kind: 'season', comp: 'season', slug: SEASON.slug, onSale: true }, ...FIXTURES.filter((m) => !m.kickoff || m.kickoff * 1000 + 2 * 3600e3 > Date.now())];

  await document.fonts.load('800 40px Cairo').catch(() => {});
  LIVE.forEach((m, i) => {
    const crests = { home: homeCrest, away: m.kind === 'season' ? null : awayCrests[FIXTURES.indexOf(m)] };
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    drawCard(c, m, crests);
    const t = tex(c);
    const g = new THREE.Group();
    const screenM = edgeFade(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: 0 }));
    const screen = new THREE.Mesh(flat(BW, BH), screenM);
    // a soft contact shadow under each card, on the tunnel floor
    const shadow = new THREE.Mesh(flat(BW * 1.1, 0.5), edgeFade(new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0 })));
    shadow.rotation.x = -Math.PI / 2;
    g.add(screen);
    g.visible = false;
    group.add(g, shadow);
    const redraw = (hot) => { drawCard(c, m, crests, hot); t.needsUpdate = true; };
    const data = m.kind === 'season' ? { ...SEASON, kind: 'season', key: 'season-pass', url: seasonUrl(SEASON.slug), onSale: true } : { kind: 'match', key: m.slug || `${m.comp}-${m.oppCode}-${i}`, ...m, url: m.onSale ? eventUrl(m.slug) : null };
    items.push({ redraw, hot: false, screen, shadow, data,
      card: g, screenM, ph: i * 1.9, slot: -1, vis: 0, tilt: { x: 0, y: 0, lift: 0 } });
  });

  /* tournament filter, floating above the row */
  const compKeys = ['all', ...['rsl', 'afc', 'kings'].filter((k) => LIVE.some((m) => m.comp === k))];
  const tabC = document.createElement('canvas'); tabC.width = 2400; tabC.height = 200;
  const tabT = tex(tabC);
  const TABW = 3.4;
  const tabMesh = new THREE.Mesh(flat(TABW, TABW * (200 / tabC.width)), edgeFade(new THREE.MeshBasicMaterial({ map: tabT, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })));
  tabMesh.visible = false;
  group.add(tabMesh);
  const tabSt = { keys: compKeys, active: 'all', hot: -1, boxes: [], ind: null };
  const redrawTabs = () => { drawTabs(tabC, tabSt); tabT.needsUpdate = true; };

  /* the arrows + counter under the centre card */
  const navC = document.createElement('canvas'); navC.width = 1024; navC.height = 200;
  const navT = tex(navC);
  const NAVW = 1.9;
  const navMesh = new THREE.Mesh(flat(NAVW, NAVW * (200 / 1024)), edgeFade(new THREE.MeshBasicMaterial({ map: navT, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 })));
  navMesh.visible = false;
  group.add(navMesh);
  let navHot = null;

  /* filter + which card is centred. Arrows, swipe/drag and the ← → keys move the row (not scroll). */
  let filter = 'all', list = [], idx = 0, active = 0;
  const redrawNav = () => { drawNav(navC, idx, list.length, navHot); navT.needsUpdate = true; };
  function setFilter(key) {
    filter = key;
    list = items.filter((it) => key === 'all' || it.data.comp === key);
    items.forEach((it) => { it.slot = list.indexOf(it); });
    tabSt.active = key;
    idx = 0;                       // each tournament opens on its next match
    redrawTabs(); redrawNav();
  }
  function go(i) {
    const n = Math.max(1, list.length), next = Math.min(n - 1, Math.max(0, i));
    if (next !== idx) { idx = next; redrawNav(); }
  }
  setFilter('all');

  const sm = (a, b, v) => { const x = Math.min(1, Math.max(0, (v - a) / (b - a))); return x * x * (3 - 2 * x); };
  let focus = -1, ptrX = 0, enter = 0, hoverUV = null, hoverItem = null;
  addEventListener('pointermove', (e) => { ptrX = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });
  const place = (obj, k, y, back = 0) => {
    obj.position.copy(C0).addScaledVector(RIGHT, k * SP).addScaledVector(FWD, back);
    obj.position.y = y;
    obj.lookAt(FIXED_AT.x, y, FIXED_AT.z);
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
    enter = sm(0.578, 0.6, s) * (1 - sm(0.686, 0.7, s));
    if (!drag.on) active += (idx - active) * 0.12;
    const sel = Math.round(Math.min(list.length - 1, Math.max(0, active)));
    const drift = ptrX * 0.05;               // a touch of parallax with the pointer
    items.forEach((c) => {
      const inList = c.slot >= 0;
      const k = inList ? c.slot - active : 0;
      const ak = Math.abs(k);
      const show = inList ? enter * (1 - sm(1.35, 1.85, ak)) : 0;        // the centre card and one either side
      c.vis += (show - c.vis) * 0.14;                                   // cards fade and slide between filters
      c.card.visible = c.shadow.visible = c.vis > 0.01;
      if (!c.card.visible) return;
      // hover: the card under the pointer lifts toward you and tilts after it
      const hov = hoverItem === c && hoverUV && !drag.on;
      const T = c.tilt;
      T.x += ((hov ? (hoverUV.y - 0.5) * 0.22 : 0) - T.x) * 0.12;
      T.y += ((hov ? (hoverUV.x - 0.5) * -0.3 : 0) - T.y) * 0.12;
      T.lift += ((hov ? 1 : 0) - T.lift) * 0.15;
      const y = YC + Math.sin(t * 0.9 + c.ph) * 0.012 - (1 - c.vis) * 0.5 + T.lift * 0.04;
      place(c.card, k + drift, y, Math.min(1, ak) * 0.55 + (1 - c.vis) * 1.6 - T.lift * 0.12);
      c.card.rotateX(T.x); c.card.rotateY(T.y);
      c.card.scale.setScalar(1 - Math.min(1, ak) * 0.08);
      c.shadow.position.set(c.card.position.x, 0.01, c.card.position.z + 0.15);
      c.shadow.material.opacity = PHONE ? 0 : 0.55 * c.vis * (1 - Math.min(1, ak) * 0.4);
      c.screenM.opacity = PHONE ? 0 : c.vis;   // phones read the cards as a crisp HTML row instead (main.js)
      c.screenM.color.setScalar(1 - Math.min(ak, 1) * 0.4);            // the side cards dimmed, not see-through
    });
    // filter above, arrows below (the container round them was tried and dropped: Ahmed didn't like it)
    tabMesh.visible = navMesh.visible = enter > 0.01;
    tabMesh.material.opacity = navMesh.material.opacity = PHONE ? 0 : enter;
    if (PHONE) tabMesh.visible = navMesh.visible = false;
    place(tabMesh, drift, YC + BH / 2 + 0.28);
    place(navMesh, drift, YC - BH / 2 - 0.24);
    // the filter's indicator slides: redraw only while it moves
    const b = tabSt.boxes[tabSt.keys.indexOf(filter)];
    if (tabSt.ind && b && (Math.abs(b[0] - tabSt.ind.x) > 0.5 || Math.abs(b[1] - b[0] - tabSt.ind.w) > 0.5)) redrawTabs();
    focus = enter > 0.5 && list[sel] ? items.indexOf(list[sel]) : -1;
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
    return { card: items.find((c) => c.screen === h.object), uv: h.uv };
  }
  function hover(x, y, camera, rect) {
    if (drag.on) return false;
    const hit = pick(x, y, camera, rect);
    const tHot = hit?.tab ?? -1;
    if (tHot !== tabSt.hot) { tabSt.hot = tHot; redrawTabs(); }
    const nHot = hit?.nav ?? null;
    if (nHot !== navHot) { navHot = nHot; redrawNav(); }
    items.forEach((it) => { const hot = hit?.card === it; if (hot !== it.hot) { it.hot = hot; it.redraw(hot); } });
    hoverItem = hit?.card || null; hoverUV = hit?.uv || null;
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
      if (hit.card.data.kind === 'season') { window.open(hit.card.data.url, '_blank', 'noopener'); return true; }
      if (hit.card.data.onSale) { if (onBook) onBook(hit.card.data); else window.open(hit.card.data.url, '_blank', 'noopener'); }
    }
    return true;
  }
  const inside = (c) => { const q = c.position; return q.x > X0 + 0.4 && q.x < X1 && q.z > Z0 && q.z < Z1 && q.y < H; };
  return {
    group, items, update, hover, click, setFilter, go, dragStart, dragMove, dragEnd,
    get focus() { return focus; }, get index() { return idx; }, get active() { return enter > 0.5; }, inside,
    cards: items.map((it) => it.data), comps: COMPS,
  };
}
