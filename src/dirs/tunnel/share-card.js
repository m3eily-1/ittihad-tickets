// Share cards (2026-10-27): a 1080 × 1350 image drawn on a canvas in the club's colours — Anton titles, Cairo text,
// the crest — for a mini-game score, a new legend, the next matchday and a Penalty Cup win. The phone's share sheet
// takes the PNG (WhatsApp, Snapchat, X…) when it can share files; anywhere else the PNG downloads.
//
//   openShare({ kind: 'score', game, score, tier, stars })
//   openShare({ kind: 'legend', index })
//   openShare({ kind: 'matchday', match })
//   openShare({ kind: 'cup', opp, score, target, week })
import { fanEvent } from './fan-events.js';
import { feel } from './feel.js';
import { progress } from './progress.js';
import { LEGENDS } from './legends.js';
import { TIER_LABEL, STARS, UNIT } from './tiers.js';
import { esc, DATE, weekLabel } from './fz-core.js';

const W = 1080, H = 1350, Y = '#ffea00', K = '#070707';
const CREST = '/img/crest.png';
const GAME = { penalties: 'Penalties', freekick: 'Free kicks', keepy: 'Keepy-uppy', quiz: 'Legends quiz', crossbar: 'Crossbar challenge', keeper: 'Keeper mode' };
const MAX = { penalties: 15, freekick: 15, quiz: 5 };

const img = (src) => new Promise((ok) => { if (!src) { ok(null); return; } const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
async function fonts() {
  try { await Promise.all(['400 120px Anton', '700 40px Cairo', '600 40px Cairo', '400 40px Cairo'].map((f) => document.fonts.load(f))); } catch { /* fall back to system faces */ }
}
// Anton / Cairo text that shrinks to fit a width
function anton(g, text, x, y, size, { color = '#fff', align = 'left', maxW = W - 160 } = {}) {
  let s = size; g.font = `400 ${s}px Anton, Impact, sans-serif`;
  while (g.measureText(text).width > maxW && s > 20) { s -= 4; g.font = `400 ${s}px Anton, Impact, sans-serif`; }
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(text, x, y);
  return s;
}
function cairo(g, text, x, y, size, { color = 'rgba(255,255,255,0.8)', weight = 700, align = 'left', maxW = W - 160 } = {}) {
  let s = size; g.font = `${weight} ${s}px Cairo, system-ui, sans-serif`;
  while (g.measureText(text).width > maxW && s > 14) { s -= 2; g.font = `${weight} ${s}px Cairo, system-ui, sans-serif`; }
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(text, x, y);
}
function star(g, cx, cy, r, on) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = on ? Y : '#2a2a2a'; g.fill();
}
function panel(g, x, y, w, h) {
  g.fillStyle = '#121212'; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = Y; g.fillRect(x, y, w, 6);   // the 2 px yellow top edge, at print scale
}
function contain(g, im, x, y, w, h) {
  if (!im) return;
  const k = Math.min(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k;
  g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function cover(g, im, x, y, w, h) {
  const k = Math.max(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 3, iw, ih); g.restore();
}

async function draw(o) {
  await fonts();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // flat black, one soft yellow light from the top (no stripes: Ahmed, 2026-10-27)
  g.fillStyle = K; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 0, 40, W / 2, 0, H * 0.75);
  glow.addColorStop(0, 'rgba(255,214,0,0.22)'); glow.addColorStop(1, 'rgba(255,214,0,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.fillStyle = Y; g.fillRect(0, 0, W, 14);
  // the crest and the club's name
  const crest = await img(CREST);
  contain(g, crest, 72, 64, 120, 120);
  anton(g, 'AL-ITTIHAD', 214, 140, 64);
  const name = progress.name || 'A Tigers fan';
  const foot = (t) => { g.fillStyle = Y; g.fillRect(0, H - 120, W, 120); anton(g, t, 72, H - 42, 50, { color: '#111', maxW: W - 144 }); };

  if (o.kind === 'score') {
    const label = GAME[o.game] || 'Mini-game';
    anton(g, label.toUpperCase(), 72, 330, 110, { color: Y });
    cairo(g, `${o.tier ? `${TIER_LABEL[o.tier]} tier · ` : ''}${name}`, 72, 400, 40);
    panel(g, 72, 460, W - 144, 520);
    const big = String(o.score);
    anton(g, big, W / 2, 800, 320, { align: 'center', maxW: W - 260 });
    cairo(g, MAX[o.game] ? `out of ${MAX[o.game]}` : UNIT[o.game] || 'points', W / 2, 880, 40, { align: 'center' });
    if (STARS[o.game]) for (let i = 0; i < 3; i++) star(g, W / 2 + (i - 1) * 110, 1060, 46, i < (o.stars || 0));
    foot('CAN YOU BEAT IT?');
  } else if (o.kind === 'legend') {
    const L = LEGENDS[o.index] || LEGENDS[0];
    anton(g, 'NEW LEGEND', 72, 300, 92, { color: Y });
    panel(g, 72, 350, W - 144, 760);
    const ph = L.photo ? await img(L.photo) : null;
    if (ph) cover(g, ph, 96, 380, 380, 500);
    else { g.fillStyle = '#1c1c1c'; g.fillRect(96, 380, 380, 500); const ini = L.name.split(/\s+/).map((w) => w.replace(/^(Al|El)-/, '')[0]).join('').slice(0, 2).toUpperCase(); anton(g, ini, 286, 700, 200, { align: 'center', color: Y }); }
    anton(g, L.name.toUpperCase(), 510, 470, 72, { maxW: W - 600 });
    if (L.ar) { g.direction = 'rtl'; cairo(g, L.ar, W - 96, 540, 44, { align: 'right', color: Y, maxW: W - 600 }); g.direction = 'ltr'; }
    cairo(g, `${L.pos} · ${L.years}`, 510, 610, 36, { maxW: W - 600 });
    let y = 940;
    for (const f of L.facts.slice(0, 3)) { g.fillStyle = Y; g.fillRect(96, y - 26, 10, 30); cairo(g, f, 124, y, 34, { color: '#fff', weight: 600, maxW: W - 260 }); y += 56; }
    if (L.credit) cairo(g, L.credit, 96, 1100 - 4, 18, { color: 'rgba(255,255,255,0.45)', weight: 400, maxW: W - 200 });
    foot(`LEGENDS COLLECTION · ${progress.cards.length}/${LEGENDS.length}`);
  } else if (o.kind === 'matchday') {
    const m = o.match;
    anton(g, 'MATCHDAY', 72, 320, 120, { color: Y });
    cairo(g, [m.compLabel, m.round].filter(Boolean).join(' · '), 72, 390, 38);
    panel(g, 72, 450, W - 144, 560);
    const [home, away] = await Promise.all([img('/teams/al-ittihad.png'), img(m.crest)]);
    contain(g, home, 130, 520, 300, 300);
    if (away) contain(g, away, W - 430, 520, 300, 300);
    else { anton(g, m.oppCode || (m.opp || '').slice(0, 3).toUpperCase(), W - 280, 720, 140, { align: 'center', color: '#fff' }); }
    anton(g, 'VS', W / 2, 700, 90, { align: 'center', color: Y });
    anton(g, 'AL-ITTIHAD', 280, 900, 52, { align: 'center', maxW: 380 });
    anton(g, (m.oppShort || m.opp || '').toUpperCase(), W - 280, 900, 52, { align: 'center', maxW: 380 });
    const d = m.kickoff ? new Date(m.kickoff * 1000) : null;
    const time = d && !m.timeTBC ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }) : 'Kick-off TBC';
    cairo(g, d ? `${DATE.format(d)} · ${time}` : 'Date TBC', W / 2, 970, 40, { align: 'center', color: '#fff' });
    cairo(g, m.venue && m.venue !== 'TBC' ? m.venue : 'Venue TBC', W / 2, 1110, 34, { align: 'center' });
    foot(o.derby ? `${o.derby.toUpperCase()} · ${name.toUpperCase()}` : `${name.toUpperCase()} · SEE YOU THERE`);
  } else if (o.kind === 'cup') {
    anton(g, 'CHAMPION', 72, 330, 150, { color: Y });
    cairo(g, `Weekly Penalty Cup · ${weekLabel(o.week)}`, 72, 400, 40);
    panel(g, 72, 460, W - 144, 600);
    // a cup, drawn: bowl, handles, stem, base
    g.fillStyle = Y;
    g.beginPath(); g.moveTo(W / 2 - 150, 520); g.lineTo(W / 2 + 150, 520); g.quadraticCurveTo(W / 2 + 140, 720, W / 2 + 30, 760); g.lineTo(W / 2 - 30, 760); g.quadraticCurveTo(W / 2 - 140, 720, W / 2 - 150, 520); g.fill();
    g.lineWidth = 22; g.strokeStyle = Y;
    g.beginPath(); g.arc(W / 2 - 150, 600, 60, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
    g.beginPath(); g.arc(W / 2 + 150, 600, 60, Math.PI * 1.5, Math.PI * 0.5); g.stroke();
    g.fillRect(W / 2 - 22, 760, 44, 80); g.fillRect(W / 2 - 110, 840, 220, 46);
    anton(g, name.toUpperCase(), W / 2, 960, 64, { align: 'center', maxW: W - 260 });
    cairo(g, o.opp ? `Beat ${o.opp} ${o.score}–${o.target} in the final` : 'Won the final', W / 2, 1020, 36, { align: 'center', color: '#fff' });
    foot('3 ROUNDS · 3 WINS');
  }
  return c;
}

const TEXT = {
  score: (o) => `I scored ${o.score} in ${GAME[o.game] || 'a mini-game'} at the Al-Ittihad stadium. Can you beat it?`,
  legend: (o) => `I just unlocked ${LEGENDS[o.index]?.name || 'a legend'} in my Al-Ittihad legends collection.`,
  matchday: (o) => `Al-Ittihad vs ${o.match?.opp || ''} — matchday.`,
  cup: () => 'I won the Weekly Penalty Cup.',
};

/* the sheet: a preview of the card, Share (or Save image where there's no share sheet), Cancel */
export async function openShare(o) {
  const box = document.createElement('div');
  box.className = 'sc-modal fz-share';
  box.innerHTML = `<div class="sc-card" role="dialog" aria-label="Share">
    <h3>Share</h3><div class="fz-share__img"><p>Drawing your card…</p></div>
    <div class="sc-row"><button type="button" class="sc-btn js-fz-go" disabled>Share</button><button type="button" class="sc-btn is-ghost js-sc-x">Cancel</button></div>
    <p class="fz-share__note js-fz-note" hidden></p></div>`;
  document.body.append(box);
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart', 'keydown']) box.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const close = () => box.remove();
  box.querySelector('.js-sc-x').addEventListener('click', () => { feel.back(); close(); });
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  let blob = null;
  try {
    const c = await draw(o);
    blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
    const url = URL.createObjectURL(blob);
    box.querySelector('.fz-share__img').innerHTML = `<img src="${url}" alt="Your ${esc(o.kind)} card"/>`;
  } catch (err) { console.warn('[share-card]', err); box.querySelector('.fz-share__img').innerHTML = '<p>Couldn\'t draw the card.</p>'; return; }
  const file = new File([blob], `ittihad-${o.kind}.png`, { type: 'image/png' });
  const canFiles = !!navigator.canShare?.({ files: [file] });
  const go = box.querySelector('.js-fz-go');
  go.disabled = false; go.textContent = canFiles ? 'Share' : 'Save image';
  go.addEventListener('click', async () => {
    feel.tap();
    if (canFiles) {
      try { await navigator.share({ files: [file], title: 'Al-Ittihad', text: TEXT[o.kind]?.(o) || '' }); fanEvent('share', { kind: o.kind }); close(); return; }
      catch (err) { if (err?.name === 'AbortError') return; }   // cancelled: stay on the sheet
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = file.name; document.body.append(a); a.click(); a.remove();
    fanEvent('share', { kind: o.kind });
    const n = box.querySelector('.js-fz-note'); n.hidden = false; n.textContent = 'Saved. Post it from your photos.';
  });
}
export const shareBtnHTML = (cls = '') => `<button type="button" class="${cls}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3 M7 8l5-5 5 5 M5 12v8h14v-8"/></svg><span>Share</span></button>`;
export { draw as drawShareCard };
