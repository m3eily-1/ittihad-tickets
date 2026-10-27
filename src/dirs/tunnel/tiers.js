// Difficulty tiers and stars for the four mini-games (2026-10-27): Rookie → Pro → Legend. Each tier has three star
// goals; two stars on a tier unlock the next. Pro is the games as they were tuned before tiers (Ahmed: "harder"),
// Rookie is gentler, Legend is the sharpest keeper, the biggest wall, the heaviest ball, the quickest clock.
// The games read their numbers from DIFF; nothing is rewritten, only scaled.
//
//   tiers.selected(game)            → the tier the game starts at (yours to pick in the games hub)
//   tiers.record(game, tier, score) → { stars, newStars, unlocked } after a round
import { progress } from './progress.js';
import { claws } from './economy.js';
import { load, save } from './fz-core.js';

export const TIERS = ['rookie', 'pro', 'legend'];
export const TIER_LABEL = { rookie: 'Rookie', pro: 'Pro', legend: 'Legend' };
// star goals per tier: the same targets on every tier — the tier makes them harder to reach
export const STARS = { penalties: [6, 9, 12], freekick: [3, 6, 9], keepy: [10, 20, 35], quiz: [3, 4, 5] };
export const UNIT = { penalties: 'pts', freekick: 'pts', keepy: 'touches', quiz: 'right' };
const UNLOCK_AT = 2;   // stars on the tier below

export const DIFF = {
  // read: how often the keeper picks your side · react: his reaction (s) · reach: his save radius (m) · dive: dive time (s)
  penalties: {
    rookie: { read: 0.5, react: 0.17, reach: 0.48, dive: 0.4 },
    pro: { read: 0.72, react: 0.09, reach: 0.56, dive: 0.32 },
    legend: { read: 0.84, react: 0.05, reach: 0.62, dive: 0.27 },
  },
  // wall: men in it · jump: how high they jump (m) · read: added to the keeper's chance to read it · reach / dive as above
  freekick: {
    rookie: { wall: 3, jump: 0.22, read: -0.15, react: 0.12, reach: 0.5, dive: 0.38 },
    pro: { wall: 4, jump: 0.32, read: 0, react: 0, reach: 0.56, dive: 0.32 },
    legend: { wall: 5, jump: 0.42, read: 0.1, react: -0.08, reach: 0.62, dive: 0.28 },
  },
  // grav: gravity × · hit: tap radius × · drift: a sideways breeze (screen widths a second, both ways)
  keepy: { rookie: { grav: 0.82, hit: 1.2, drift: 0 }, pro: { grav: 1, hit: 1, drift: 0 }, legend: { grav: 1.22, hit: 0.82, drift: 0.05 } },
  // time: seconds a question · types: the question kinds asked (legend: only the ones you can't guess from the year)
  quiz: { rookie: { time: 15, types: null }, pro: { time: 10, types: null }, legend: { time: 7, types: ['fact', 'who', 'years'] } },
};

const KEY = 'itt-tiers-v1';
const st = load(KEY, null) || (() => {
  // first run: earlier bests were set on today's Pro difficulty
  const s = { best: {}, sel: {} };
  for (const g of Object.keys(STARS)) { const b = progress.best(g); if (b) s.best[g] = { pro: b }; }
  return s;
})();
save(KEY, st);

const starsFor = (game, score) => (STARS[game] || []).filter((t) => score >= t).length;
export const tiers = {
  best: (game, tier) => st.best[game]?.[tier] || 0,
  stars: (game, tier) => starsFor(game, st.best[game]?.[tier] || 0),
  unlocked(game, tier) {
    const i = TIERS.indexOf(tier);
    if (i <= 0) return true;
    // a tier is open once the one below has two stars (or you've already scored on it)
    return this.best(game, tier) > 0 || this.stars(game, TIERS[i - 1]) >= UNLOCK_AT;
  },
  top(game) { return [...TIERS].reverse().find((t) => this.unlocked(game, t)) || 'rookie'; },
  selected(game) { const s = st.sel[game]; return s && this.unlocked(game, s) ? s : this.top(game); },
  select(game, tier) { if (!this.unlocked(game, tier)) return false; st.sel[game] = tier; save(KEY, st); return true; },
  diff(game, tier) { return DIFF[game]?.[tier] || DIFF[game]?.pro || {}; },
  totalStars(game) { return TIERS.reduce((a, t) => a + this.stars(game, t), 0); },
  get allStars() { return Object.keys(STARS).reduce((a, g) => a + this.totalStars(g), 0); },
  maxStars: Object.keys(STARS).length * TIERS.length * 3,
  unlockHint(game, tier) { const i = TIERS.indexOf(tier); return i > 0 ? `${UNLOCK_AT}★ on ${TIER_LABEL[TIERS[i - 1]]}` : ''; },
  // after a round: the new best, stars won and a tier that opened (small XP and Claws for each)
  record(game, tier, score) {
    if (!STARS[game]) return { stars: 0, newStars: 0, unlocked: null };
    const next = TIERS[TIERS.indexOf(tier) + 1];
    const wasOpen = next ? this.unlocked(game, next) : true;
    const before = this.stars(game, tier);
    st.best[game] = st.best[game] || {};
    if (score > (st.best[game][tier] || 0)) st.best[game][tier] = score;
    save(KEY, st);
    const stars = this.stars(game, tier), newStars = stars - before;
    const unlocked = next && !wasOpen && this.unlocked(game, next) ? next : null;
    if (newStars > 0) { progress.award(newStars * 15, `${newStars} new star${newStars > 1 ? 's' : ''}`); claws.earn(newStars * 5, `${TIER_LABEL[tier]} stars`); }
    if (unlocked) { st.sel[game] = unlocked; save(KEY, st); claws.earn(25, `${TIER_LABEL[unlocked]} tier unlocked`); }
    return { stars, newStars, unlocked, best: st.best[game][tier] };
  },
};
export const starRow = (n, max = 3) => Array.from({ length: max }, (_, i) => `<i class="fz-star${i < n ? ' is-on' : ''}" aria-hidden="true"></i>`).join('');
