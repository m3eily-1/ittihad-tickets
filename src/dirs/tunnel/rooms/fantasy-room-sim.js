// A demo matchweek for the SPL Fantasy table (Ahmed, 2026-10-21: "a 'kick-off' that simulates a matchweek with
// points"). NOT REAL RESULTS: every number is drawn from a seeded random generator, with Fantasy Premier League's
// scoring and rough per-position odds (better-rated players a little likelier to score). The seed is the
// matchweek plus your XI and captain, so the same team in the same week always scores the same.
//   minutes: 60+ = 2, under 60 = 1 · goal GK/DEF 6, MID 5, FWD 4 · assist 3 · clean sheet GK/DEF 4, MID 1
//   GK: 1 per 3 saves · GK/DEF: −1 per 2 conceded · yellow −1 · bonus 3/2/1 to the best three · captain ×2
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const poisson = (r, l) => { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 12); return k - 1; };
const ORDER = ['GK', 'DEF', 'MID', 'FWD'];
const GOAL = { GK: 6, DEF: 6, MID: 5, FWD: 4 }, CS = { GK: 4, DEF: 4, MID: 1, FWD: 0 };
const G_RATE = { GK: 0.004, DEF: 0.06, MID: 0.17, FWD: 0.38 }, A_RATE = { GK: 0.012, DEF: 0.08, MID: 0.19, FWD: 0.14 };

export function simulate(xi, captain, gw) {
  const seedN = hash(`${gw}|${xi.map((p) => p.id).join(',')}|${captain}`);
  const r = rng(seedN);
  const conceded = {};   // per club, so teammates share a clean sheet
  const clubGoals = (c) => (conceded[c.slug] ??= poisson(r, 1.2));
  const rows = xi.map((p) => {
    const q = 0.65 + Math.max(0, p.rating - 60) / 32;   // ~0.65 (60s) … ~1.4 (80s)
    const u = r(), mins = u < 0.07 ? 0 : u < 0.2 ? 20 + Math.floor(r() * 39) : 90;
    const ev = [];
    let pts = 0;
    if (!mins) return { id: p.id, name: (p.last || p.first).toUpperCase(), pos: p.pos, base: 0, ev: 'Did not play' };
    pts += mins >= 60 ? 2 : 1; ev.push(`${mins}'`);
    const f = mins / 90, G = poisson(r, G_RATE[p.pos] * q * f), A = poisson(r, A_RATE[p.pos] * q * f);
    if (G) { pts += G * GOAL[p.pos]; ev.push(G > 1 ? `${G} goals` : 'goal'); }
    if (A) { pts += A * 3; ev.push(A > 1 ? `${A} assists` : 'assist'); }
    const c = clubGoals(p.club);
    if (!c && mins >= 60 && CS[p.pos]) { pts += CS[p.pos]; ev.push('clean sheet'); }
    if ((p.pos === 'GK' || p.pos === 'DEF') && c >= 2) { pts -= Math.floor(c / 2); ev.push(`${c} conceded`); }
    if (p.pos === 'GK') { const sv = poisson(r, 2.8 * f); if (sv >= 3) { pts += Math.floor(sv / 3); ev.push(`${sv} saves`); } }
    if (r() < 0.11) { pts -= 1; ev.push('yellow'); }
    return { id: p.id, name: (p.last || p.first).toUpperCase(), pos: p.pos, base: pts, ev: ev.join(' · ') };
  });
  // bonus to the three best (ties: the earlier in the XI)
  [...rows].filter((x) => x.ev !== 'Did not play').sort((a, b) => b.base - a.base).slice(0, 3).forEach((x, i) => { x.base += 3 - i; x.ev += ` · +${3 - i} bonus`; });
  for (const x of rows) { x.cap = x.id === captain; x.pts = x.cap ? x.base * 2 : x.base; }
  rows.sort((a, b) => ORDER.indexOf(a.pos) - ORDER.indexOf(b.pos));   // read like a team sheet: GK first
  return { gw, seed: seedN.toString(36).toUpperCase(), rows, total: rows.reduce((a, x) => a + x.pts, 0) };
}
