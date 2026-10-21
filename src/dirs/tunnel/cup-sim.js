// SPL Cup — the match simulator (cup.js). Seeded, so the same tie always plays out the same way (a reload can't
// re-roll a result). Strength comes from each club's best XI by DEMO rating (fantasy-data.js) — nothing here is
// a real prediction, and every screen that shows a result says "Simulated · demo".
//
//   bestXI(club)                → { formation, xi: [{ p, slot, line }], avg, atk, mid, def, gk }
//   simMatch(home, away, seed)  → 90' (+ extra time if level) with scorers, assists, stats, player ratings
//   simShootout(home, away, seed) → { home: [1|0…], away: [1|0…], winner }
import { P, FORMATIONS } from './fantasy-ui.js';

/* a small seeded RNG (mulberry32) */
export function rng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (r, arr, w) => { const tot = arr.reduce((s, x, i) => s + w(x, i), 0); let k = r() * tot; for (let i = 0; i < arr.length; i++) { k -= w(arr[i], i); if (k <= 0) return arr[i]; } return arr[arr.length - 1]; };

/* slot labels per line and count (left to right as you look up the pitch) */
const SLOTS = {
  DEF: { 3: ['CB', 'CB', 'CB'], 4: ['LB', 'CB', 'CB', 'RB'], 5: ['LWB', 'CB', 'CB', 'CB', 'RWB'] },
  MID: { 3: ['CM', 'CDM', 'CM'], 4: ['LM', 'CM', 'CM', 'RM'], 5: ['LM', 'CM', 'CDM', 'CM', 'RM'] },
  FWD: { 1: ['ST'], 2: ['ST', 'ST'], 3: ['LW', 'ST', 'RW'] },
};
const PREF = ['4-3-3', '4-4-2', '3-5-2', '4-5-1', '3-4-3', '5-3-2', '5-4-1'];   // tie-break: the commoner shapes first
const cache = new Map();

/** the club's best XI by demo rating, in the formation that fits its squad best */
export function bestXI(club) {
  if (!club?.slug) return null;
  if (cache.has(club.slug)) return cache.get(club.slug);
  const sq = P.filter((p) => p.club.slug === club.slug);
  const by = (pos) => sq.filter((p) => p.pos === pos).sort((a, b) => b.rating - a.rating);
  const G = by('GK'), D = by('DEF'), M = by('MID'), F = by('FWD');
  let best = null;
  for (const f of PREF) {
    const [d, m, w] = FORMATIONS[f];
    if (!G.length || D.length < d || M.length < m || F.length < w) continue;
    const tot = G[0].rating + [D.slice(0, d), M.slice(0, m), F.slice(0, w)].flat().reduce((s, p) => s + p.rating, 0);
    if (!best || tot > best.tot) best = { f, tot, d, m, w };
  }
  if (!best) return null;
  // within a line, the best player in the middle (the way the cards read on FC's pitch)
  const centre = (arr) => { const out = []; arr.forEach((p, i) => (i % 2 ? out.unshift(p) : out.push(p))); return out; };
  const line = (arr, n, key) => centre(arr.slice(0, n)).map((p, i) => ({ p, slot: SLOTS[key][n][i], line: key }));
  const xi = [{ p: G[0], slot: 'GK', line: 'GK' }, ...line(D, best.d, 'DEF'), ...line(M, best.m, 'MID'), ...line(F, best.w, 'FWD')];
  const avg = (ps) => ps.reduce((s, x) => s + x.p.rating, 0) / Math.max(1, ps.length);
  const of = (k) => xi.filter((x) => x.line === k);
  const out = {
    formation: best.f, xi, bench: sq.filter((p) => !xi.some((x) => x.p.id === p.id)),
    avg: best.tot / 11, gk: G[0].rating, def: avg(of('DEF')), mid: avg(of('MID')), atk: avg([...of('FWD'), ...of('MID')].slice(0, 5)),
    top3: [...xi].sort((a, b) => b.p.rating - a.p.rating).slice(0, 3).map((x) => x.p),
  };
  cache.set(club.slug, out);
  return out;
}

/** penalty takers (best five outfielders, forwards first) and the keeper — for the 3D shoot-out and the sim */
export function takers(club) {
  const t = bestXI(club); if (!t) return { kickers: [], keeper: null };
  const order = { FWD: 0, MID: 1, DEF: 2 };
  const outf = t.xi.filter((x) => x.line !== 'GK').map((x) => x.p).sort((a, b) => order[a.pos] - order[b.pos] || b.rating - a.rating);
  return { kickers: outf, keeper: t.xi[0].p };
}

/**
 * simulate a tie. home/away: CLUBS entries. Returns
 * { hg, ag, et, minutes, events: [{ min, side, scorer, assist }], stats: { home, away }, ratings: { home, away }, potm: { home, away } }
 * stats per side: { shots, onTarget, possession, passes, passAcc }
 */
export function simMatch(home, away, seed, { extraTime = true } = {}) {
  const r = rng(seed), H = bestXI(home), A = bestXI(away);
  // possession from the midfields, then shots from attack vs the other defence (the demo ratings are close
  // together, so the differences are stretched: 6 rating points ≈ a 70/30 favourite)
  const possH = clamp(50 + (H.mid - A.mid) * 1.2 + (r() - 0.5) * 10, 32, 68);
  const shotRate = (atk, def, poss) => (10.5 * Math.pow(poss / 50, 0.6) * Math.exp((atk - def) * 0.03)) / 90;
  const conv = (atk, gk) => clamp(0.29 * Math.exp((atk - gk) * 0.02), 0.18, 0.42);
  const side = {
    home: { t: H, shots: 0, on: 0, goals: 0, rate: shotRate(H.atk, A.def, possH) * 1.05, conv: conv(H.atk, A.gk) },   // a touch of home advantage
    away: { t: A, shots: 0, on: 0, goals: 0, rate: shotRate(A.atk, H.def, 100 - possH), conv: conv(A.atk, H.gk) },
  };
  const events = [];
  const scorerW = (x) => ({ FWD: 5, MID: 2.3, DEF: 0.6, GK: 0 }[x.line]) * Math.exp((x.p.rating - 75) * 0.06);
  const assistW = (x) => ({ FWD: 2.6, MID: 4, DEF: 1.3, GK: 0.05 }[x.line]) * Math.exp((x.p.rating - 75) * 0.05);
  const play = (from, to) => {
    for (let min = from; min <= to; min++) {
      for (const k of ['home', 'away']) {
        const s = side[k];
        if (r() < s.rate) {
          s.shots++;
          if (r() < 0.38) {
            s.on++;
            if (r() < s.conv) {
              s.goals++;
              const scorer = pick(r, s.t.xi, scorerW);
              const assist = r() < 0.72 ? pick(r, s.t.xi.filter((x) => x !== scorer), assistW) : null;
              events.push({ min, side: k, scorer: scorer.p.id, assist: assist ? assist.p.id : null });
            }
          }
        }
      }
    }
  };
  play(1, 90);
  let et = false;
  if (extraTime && side.home.goals === side.away.goals) {
    et = true;
    // tired legs: a little fewer chances per minute in extra time
    side.home.rate *= 0.85; side.away.rate *= 0.85;
    play(91, 120);
  }
  // stats: passes follow possession, accuracy the midfield
  const pass = (poss, mid) => ({ passes: Math.round(poss * (et ? 11.5 : 9.2) * (0.92 + r() * 0.16)), passAcc: Math.round(clamp(80 + (mid - 78) * 1.1 + (r() - 0.5) * 6, 66, 93)) });
  const stats = {
    home: { shots: side.home.shots, onTarget: side.home.on, possession: Math.round(possH), ...pass(possH, H.mid) },
    away: { shots: side.away.shots, onTarget: side.away.on, possession: 100 - Math.round(possH), ...pass(100 - possH, A.mid) },
  };
  // player ratings (6.0–10) and the player of the match per side
  const ratings = {}, potm = {};
  for (const k of ['home', 'away']) {
    const s = side[k], o = side[k === 'home' ? 'away' : 'home'], st = stats[k];
    const won = s.goals > o.goals, cs = o.goals === 0;
    const share = (x) => ({ GK: 0.05, DEF: 0.1, MID: 0.13, FWD: 0.06 }[x.line]);
    const tot = s.t.xi.reduce((a, x) => a + share(x), 0);
    ratings[k] = s.t.xi.map((x) => {
      const g = events.filter((e) => e.side === k && e.scorer === x.p.id).length;
      const a = events.filter((e) => e.side === k && e.assist === x.p.id).length;
      const passes = Math.round((st.passes * share(x)) / tot * (0.85 + r() * 0.3));
      const acc = clamp(Math.round(st.passAcc + (r() - 0.5) * 10 + (x.line === 'FWD' ? -6 : x.line === 'DEF' ? 3 : 0)), 55, 98);
      let v = 6.2 + (x.p.rating - 78) * 0.05 + g * 1.05 + a * 0.6 + (won ? 0.35 : 0) + (cs && (x.line === 'DEF' || x.line === 'GK') ? 0.6 : 0) + (r() - 0.5) * 0.9;
      if (x.line === 'GK') v += Math.max(0, o.on - o.goals) * 0.18 - o.goals * 0.25;
      return { id: x.p.id, slot: x.slot, line: x.line, goals: g, assists: a, passes, acc, saves: x.line === 'GK' ? Math.max(0, o.on - o.goals) : 0, rating: Math.round(clamp(v, 5.4, 10) * 10) / 10 };
    });
    potm[k] = [...ratings[k]].sort((a, b) => b.rating - a.rating)[0];
  }
  events.sort((a, b) => a.min - b.min);
  return { hg: side.home.goals, ag: side.away.goals, et, minutes: et ? 120 : 90, events, stats, ratings, potm };
}

/** a simulated shoot-out: 5 each, then sudden death; home kicks first */
export function simShootout(home, away, seed) {
  const r = rng(seed ^ 0x5bd1e995), H = takers(home), A = takers(away);
  const pr = (k, gk) => clamp(0.76 + ((k?.rating || 78) - (gk?.rating || 78)) * 0.012, 0.6, 0.9);
  const h = [], a = [];
  for (let i = 0; i < 30; i++) {
    h.push(r() < pr(H.kickers[i % H.kickers.length], A.keeper) ? 1 : 0);
    if (decided(h, a)) break;
    a.push(r() < pr(A.kickers[i % A.kickers.length], H.keeper) ? 1 : 0);
    if (decided(h, a)) break;
  }
  const hs = h.reduce((x, y) => x + y, 0), as = a.reduce((x, y) => x + y, 0);
  return { home: h, away: a, homePens: hs, awayPens: as, winner: hs > as ? 'home' : 'away' };
}
/** is a shoot-out over? (kicks arrays of 1|0) → 'home' | 'away' | null */
export function decided(h, a) {
  const hs = h.reduce((x, y) => x + y, 0), as = a.reduce((x, y) => x + y, 0);
  if (h.length <= 5 && a.length <= 5) {
    if (hs > as + (5 - a.length)) return 'home';
    if (as > hs + (5 - h.length)) return 'away';
  }
  if (h.length >= 5 && h.length === a.length && hs !== as) return hs > as ? 'home' : 'away';
  return null;
}
