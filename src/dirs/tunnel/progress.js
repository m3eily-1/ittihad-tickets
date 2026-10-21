// Fan progress (Ahmed, 2026-10-21: "make it feel like a game"): XP, levels, one-off achievements, and the
// Hall of Fame legends as collectible cards — each legend unlocks with an achievement, Benzema last of all.
// Everything lives in this browser (localStorage); there is no account behind it.
//
// Games and rooms only ever call two things:
//   progress.award(amount, reason)   → +XP (a "+50 XP" pop-up, a tick sound)
//   progress.achieve(id)             → once per achievement: its XP, and the legend card it unlocks (a reveal)
// The UI (main.js) listens with progress.on(fn) and gets { type: 'xp' | 'level' | 'achieve' | 'card', ... }.
import { LEGENDS } from './legends.js';

const KEY = 'itt-progress-v1';
export const LEVEL_XP = 250;   // XP per level

// every achievement, what it's worth, and the legend it unlocks (by name in LEGENDS)
export const ACHIEVEMENTS = {
  tunnel:        { xp: 100, label: 'Walk out to the pitch',            card: 'Mohammed Noor' },
  'rooms-3':     { xp: 80,  label: 'Visit three rooms',                card: 'Ahmed Jamil' },
  fame:          { xp: 60,  label: 'Visit the Hall of Fame',           card: 'Anghel Iordănescu' },
  'pen-goal':    { xp: 50,  label: 'Score a penalty',                  card: 'Hamzah Idris' },
  'pen-top':     { xp: 80,  label: 'Score a top-corner penalty',       card: 'Fahad Al-Muwallad' },
  'keeper-save': { xp: 80,  label: 'Make a save in Keeper mode',       card: 'Mabrouk Zaid' },
  'fk-goal':     { xp: 100, label: 'Score a free kick',                card: 'Manaf Abushgeer' },
  crossbar:      { xp: 100, label: 'Hit the crossbar',                 card: 'Redha Tukar' },
  'keepy-20':    { xp: 80,  label: '20 keepy-ups in a row',            card: 'Hamad Al-Montashari' },
  'quiz-4':      { xp: 80,  label: 'Score 4 or more in the Legends quiz', card: 'Mohammed Al-Khilaiwi' },
  'fantasy-xi':  { xp: 80,  label: 'Pick a full fantasy XI',           card: 'Naif Hazazi' },
  collection:    { xp: 200, label: 'Collect every other legend',       card: 'Karim Benzema' },
  // XP only
  tifo:          { xp: 60,  label: 'Raise your own tifo' },
  predict:       { xp: 40,  label: 'Predict a score' },
  challenge:     { xp: 40,  label: 'Challenge a friend' },
  'game-all':    { xp: 150, label: 'Play every mini-game' },
};

const load = () => { try { return { xp: 0, done: [], played: [], ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { xp: 0, done: [], played: [] }; } };
const st = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ } };
const fns = new Set();
const emit = (e) => fns.forEach((f) => { try { f(e); } catch (err) { console.warn(err); } });

export const cardIdOf = (name) => LEGENDS.findIndex((l) => l.name === name);
export const GAMES = ['penalties', 'freekick', 'keeper', 'crossbar', 'keepy', 'quiz', 'predict', 'tifo'];

export const progress = {
  get xp() { return st.xp; },
  get level() { return Math.floor(st.xp / LEVEL_XP) + 1; },
  get levelXp() { return st.xp % LEVEL_XP; },
  has: (id) => st.done.includes(id),
  // legends you hold, as indexes into LEGENDS
  get cards() { return st.done.map((id) => ACHIEVEMENTS[id]?.card).filter(Boolean).map(cardIdOf).filter((i) => i >= 0); },
  unlockOf(i) { const name = LEGENDS[i]?.name; const id = Object.keys(ACHIEVEMENTS).find((k) => ACHIEVEMENTS[k].card === name); return id ? { id, ...ACHIEVEMENTS[id] } : null; },
  on(fn) { fns.add(fn); return () => fns.delete(fn); },
  award(amount, reason = '') {
    if (!(amount > 0)) return;
    const before = this.level;
    st.xp += Math.round(amount); save();
    emit({ type: 'xp', amount: Math.round(amount), reason, xp: st.xp });
    if (this.level > before) emit({ type: 'level', level: this.level });
  },
  achieve(id) {
    const a = ACHIEVEMENTS[id];
    if (!a || st.done.includes(id)) return false;
    st.done.push(id); save();
    emit({ type: 'achieve', id, label: a.label });
    this.award(a.xp, a.label);
    if (a.card) emit({ type: 'card', id, index: cardIdOf(a.card), legend: LEGENDS[cardIdOf(a.card)] });
    // the last legend comes when you hold all the others
    if (id !== 'collection' && this.cards.length >= LEGENDS.length - 1) this.achieve('collection');
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
