// Fan progress (Ahmed, 2026-10-21: "make it feel like a game"): XP, levels, one-off achievements, and the
// Hall of Fame legends as collectible cards. They're rare (Ahmed, 2026-10-21: "unique gems, not with every action"):
// a legend unlocks only when your total XP crosses the next milestone in CARD_XP, so a reveal is an occasion.
// Everything lives in this browser (localStorage); there is no account behind it.
//
// Games and rooms only ever call two things:
//   progress.award(amount, reason)   → +XP (a "+50 XP" pop-up, a tick sound)
//   progress.achieve(id)             → once per achievement: its XP (which may cross a legend milestone → a reveal)
// The UI (main.js) listens with progress.on(fn) and gets { type: 'xp' | 'level' | 'achieve' | 'card', ... }.
import { LEGENDS } from './legends.js';

const KEY = 'itt-progress-v1';
export const LEVEL_XP = 250;   // XP per level

// every achievement, what it's worth, and the legend it unlocks (by name in LEGENDS)
export const ACHIEVEMENTS = {
  tunnel:        { xp: 100, label: 'Walk out to the pitch' },
  'rooms-3':     { xp: 80,  label: 'Visit three rooms' },
  fame:          { xp: 60,  label: 'Visit the Hall of Fame' },
  'pen-goal':    { xp: 50,  label: 'Score a penalty' },
  'pen-top':     { xp: 80,  label: 'Score a top-corner penalty' },
  'keeper-save': { xp: 80,  label: 'Make a save in Keeper mode' },
  'fk-goal':     { xp: 100, label: 'Score a free kick' },
  crossbar:      { xp: 100, label: 'Hit the crossbar' },
  'keepy-20':    { xp: 80,  label: '20 keepy-ups in a row' },
  'quiz-4':      { xp: 80,  label: 'Score 4 or more in the Legends quiz' },
  'fantasy-xi':  { xp: 80,  label: 'Pick a full fantasy XI' },
  // XP only
  tifo:          { xp: 60,  label: 'Raise your own tifo' },
  predict:       { xp: 40,  label: 'Predict a score' },
  challenge:     { xp: 40,  label: 'Challenge a friend' },
  'game-all':    { xp: 150, label: 'Play every mini-game' },
  order:         { xp: 100, label: 'Place an order in the club store' },
};

const load = () => { try { return { xp: 0, done: [], played: [], ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { xp: 0, done: [], played: [] }; } };
const st = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ } };
const fns = new Set();
const emit = (e) => fns.forEach((f) => { try { f(e); } catch (err) { console.warn(err); } });

export const cardIdOf = (name) => LEGENDS.findIndex((l) => l.name === name);
// XP milestones for the twelve legends, further apart as you go; Benzema (the club's latest captain) comes last
export const CARD_XP = [300, 700, 1200, 1800, 2500, 3300, 4200, 5200, 6300, 7500, 8800, 10200];
const CARD_ORDER = [...LEGENDS.map((_, i) => i).filter((i) => LEGENDS[i].name !== 'Karim Benzema'), cardIdOf('Karim Benzema')].filter((i) => i >= 0);
const cardsAt = (xp) => CARD_ORDER.slice(0, CARD_XP.filter((t) => xp >= t).length);
export const GAMES = ['penalties', 'freekick', 'keeper', 'crossbar', 'keepy', 'quiz', 'predict', 'tifo'];

export const progress = {
  get xp() { return st.xp; },
  get level() { return Math.floor(st.xp / LEVEL_XP) + 1; },
  get levelXp() { return st.xp % LEVEL_XP; },
  has: (id) => st.done.includes(id),
  // legends you hold, as indexes into LEGENDS
  get cards() { return cardsAt(st.xp); },
  // what it takes to win legend i: the XP milestone
  unlockOf(i) { const k = CARD_ORDER.indexOf(i); return k < 0 ? null : { id: `xp-${CARD_XP[k]}`, xp: CARD_XP[k], label: `Reach ${CARD_XP[k].toLocaleString('en')} XP` }; },
  get nextCard() { const k = cardsAt(st.xp).length; return k < CARD_XP.length ? { index: CARD_ORDER[k], xp: CARD_XP[k], left: CARD_XP[k] - st.xp } : null; },
  on(fn) { fns.add(fn); return () => fns.delete(fn); },
  award(amount, reason = '') {
    if (!(amount > 0)) return;
    const before = this.level, had = cardsAt(st.xp).length;
    st.xp += Math.round(amount); save();
    emit({ type: 'xp', amount: Math.round(amount), reason, xp: st.xp });
    if (this.level > before) emit({ type: 'level', level: this.level });
    // crossed a legend milestone: a rare reveal
    for (const i of cardsAt(st.xp).slice(had)) emit({ type: 'card', index: i, legend: LEGENDS[i] });
  },
  achieve(id) {
    const a = ACHIEVEMENTS[id];
    if (!a || st.done.includes(id)) return false;
    st.done.push(id); save();
    emit({ type: 'achieve', id, label: a.label });
    this.award(a.xp, a.label);
    return true;
  },
  // a mini-game was played (for "play every mini-game")
  played(game) {
    if (!st.played.includes(game)) { st.played.push(game); save(); }
    if (GAMES.every((g) => st.played.includes(g))) this.achieve('game-all');
  },
  // the friends board: your best scores per game, and friends you've had challenge links from
  best(game) { return st.best?.[game] || 0; },
  setBest(game, score) { st.best = st.best || {}; if (score > (st.best[game] || 0)) { st.best[game] = score; save(); return true; } return false; },
  get name() { return st.name || ''; },
  set name(v) { st.name = String(v || '').slice(0, 20); save(); },
  get friends() { return st.friends || []; },
  addFriend(f) {
    st.friends = (st.friends || []).filter((x) => !(x.name === f.name && x.game === f.game));
    st.friends.push({ name: f.name, game: f.game, score: f.score, at: Date.now() }); save();
  },
};
