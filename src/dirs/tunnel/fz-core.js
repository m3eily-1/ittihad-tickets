// The fan zone's shared bits (2026-10-27, the social + competitive layer): one week clock, a seeded random, the
// sample-fan names, storage helpers and the weekly record of what *you* did (points for leagues, plays for the derby,
// goals for the community goal). Everything lives in this browser; the other fans are simulated, seeded by date so
// every visitor sees the same people and their scores move the same way through the week.
import { fanEvent, onFanEvent } from './fan-events.js';

export const DAY = 864e5;
const TZ = 3 * 3600e3;                      // Jeddah time (UTC+3, no daylight saving)
// weeks run Sunday 00:00 → Saturday 24:00 Jeddah time (the Saudi working week)
export const weekIndex = (t = Date.now()) => Math.floor((t + TZ - 3 * DAY) / (7 * DAY));
export const weekStart = (w = weekIndex()) => w * 7 * DAY + 3 * DAY - TZ;
export const weekEnd = (w = weekIndex()) => weekStart(w + 1);
export const weekFrac = (t = Date.now()) => Math.min(1, Math.max(0, (t - weekStart(weekIndex(t))) / (7 * DAY)));
export const dayIndex = (t = Date.now()) => Math.floor((t + TZ) / DAY);

// seeded random (mulberry32) and a string hash (FNV-1a)
export function rng(seed) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const rand = (key) => rng(hash(key))();

// realistic Saudi names for made-up fans (not real people); the first ones are the games' own sample fans
export const FAN_NAMES = [
  'Faisal Al-Harbi', 'Noura Al-Qahtani', 'Omar Al-Ghamdi', 'Reem Al-Zahrani', 'Yousef Al-Otaibi', 'Khalid Al-Mutairi', 'Sara Al-Shehri',
  'Abdullah Al-Dosari', 'Lama Al-Subaie', 'Turki Al-Anazi', 'Hamad Al-Zahrani', 'Jana Al-Ghamdi', 'Bandar Al-Harthi', 'Layan Al-Qurashi',
  'Ziyad Al-Johani', 'Mishal Al-Sulami', 'Rawan Al-Maliki', 'Salem Al-Bishi', 'Areej Al-Harbi', 'Fahad Al-Omari', 'Majed Al-Malki',
  'Hessa Al-Rashid', 'Nawaf Al-Juhani', 'Saud Al-Shammari', 'Ghada Al-Amri', 'Rakan Al-Hazmi', 'Maha Al-Baqami', 'Sultan Al-Thubaiti',
  'Razan Al-Sharif', 'Hussam Al-Barakati', 'Wejdan Al-Luhaibi', 'Mazen Al-Saedi', 'Joud Al-Zubaidi', 'Anas Al-Hejaili', 'Shahad Al-Muwallad',
  'Talal Al-Fasi', 'Haya Al-Ruwaili', 'Ammar Bakhsh', 'Mashael Al-Sindi', 'Waleed Kateb', 'Rayan Al-Attas', 'Dana Al-Jifri',
];
export const pickNames = (seedKey, n, exclude = []) => {
  const r = rng(hash(seedKey)), pool = FAN_NAMES.filter((x) => !exclude.includes(x)), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
};

export const load = (key, def) => { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch { return def; } };
export const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ } };
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => Math.round(n).toLocaleString('en');
export function left(ms) {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}
export const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' });
export const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' });
export const weekLabel = (w = weekIndex()) => `${SHORT.format(weekStart(w))} – ${SHORT.format(weekEnd(w) - 1)}`;

/* a simulated fan's share of a weekly total by time t: the week's seven days each get a seeded share (a quarter of
   days they don't play), filled in as each day passes — so their scores step up through the week, not in a line */
export function weekCurve(key, w, t = Date.now()) {
  if (t >= weekEnd(w)) return 1;
  if (t <= weekStart(w)) return 0;
  const r = rng(hash(`${key}|${w}`)), days = Array.from({ length: 7 }, () => (r() < 0.25 ? 0 : 0.3 + r()));
  const total = days.reduce((a, b) => a + b, 0) || 1;
  const f = (t - weekStart(w)) / DAY, d = Math.floor(f);
  return (days.slice(0, d).reduce((a, b) => a + b, 0) + (days[d] || 0) * (f - d)) / total;
}

/* ── your week: best score per game (by tier), plays, penalty goals, predictions; points for the leagues ── */
export const TIER_MULT = { rookie: 1, pro: 1.25, legend: 1.5 };
const GAME_PTS = { penalties: (s) => s * 10, freekick: (s) => s * 10, keepy: (s) => Math.min(s, 60) * 3, quiz: (s) => s * 30 };
export const PRED_PTS = 25;
const WKEY = 'itt-fz-week-v1';
const wk = load(WKEY, {});
const freshWeek = (w) => ({ w, best: {}, plays: 0, goals: 0, preds: [], derby: 0, derbyPts: 0, derbyDays: [] });
function cur() {
  const w = weekIndex();
  if (!wk.now || wk.now.w !== w) {
    if (wk.now) { wk.hist = { ...(wk.hist || {}), [wk.now.w]: { pts: pointsOf(wk.now), plays: wk.now.plays, goals: wk.now.goals, derby: wk.now.derby } }; }
    wk.now = freshWeek(w); save(WKEY, wk);
  }
  return wk.now;
}
export function pointsOf(r) {
  let p = 0;
  for (const [g, byTier] of Object.entries(r.best || {})) {
    const f = GAME_PTS[g]; if (!f) continue;
    p += Math.max(0, ...Object.entries(byTier).map(([tier, s]) => f(s) * (TIER_MULT[tier] || 1)));
  }
  return Math.round(p + (r.preds?.length || 0) * PRED_PTS);
}
export const myWeek = {
  get record() { return cur(); },
  get points() { return pointsOf(cur()); },
  pointsIn(w) { return w === weekIndex() ? pointsOf(cur()) : wk.hist?.[w]?.pts || 0; },
  playedIn(w) { return w === weekIndex() ? cur().plays : wk.hist?.[w]?.plays || 0; },
  goalsIn(w) { return w === weekIndex() ? cur().goals : wk.hist?.[w]?.goals || 0; },
  bestIn(game) { return Math.max(0, ...Object.values(cur().best[game] || {})); },
  predict(key) { const r = cur(); if (!key || r.preds.includes(key)) return false; r.preds.push(key); save(WKEY, wk); fanEvent('league-points', { points: pointsOf(r) }); return true; },
  // the derby's own tally (derby.js decides when a play counts)
  derbyPlay(pts) { const r = cur(); r.derby++; r.derbyPts += pts; const d = dayIndex(); const first = !r.derbyDays.includes(d); if (first) r.derbyDays.push(d); save(WKEY, wk); return first; },
  get derbyAll() { return wk.derbyAll || {}; },
  addDerby(key, pts) { wk.derbyAll = wk.derbyAll || {}; const o = wk.derbyAll[key] || { plays: 0, pts: 0 }; o.plays++; o.pts += pts; wk.derbyAll[key] = o; save(WKEY, wk); },
};
onFanEvent((type, d) => {
  // (rounds are reported with their tier by the games themselves; a copy without one — main.js's — is the same round)
  if (type === 'game-result' && GAME_PTS[d.game] && d.tier) {
    const r = cur(), t = d.tier || 'pro';
    r.best[d.game] = r.best[d.game] || {};
    if ((d.score || 0) > (r.best[d.game][t] || 0)) r.best[d.game][t] = d.score;
    r.plays++; save(WKEY, wk);
  }
  if (type === 'pen-goal') { const r = cur(); r.goals++; save(WKEY, wk); fanEvent('community-contribute', { n: 1 }); }
});
