// The treasure hunt's state (hunt.js has the coins in the scene): which Golden Tigers you've found this week, and
// whether a hunt is on. Light, so the games hub and the menu can read it before the 3D tour has loaded.
import { load, save, weekIndex, weekEnd, left } from './fz-core.js';

// [room, name, coins]
export const HUNT_ROOMS = [
  ['trophies', 'the trophy room', 2],
  ['store', 'the club store', 2],
  ['changing', 'the locker room', 2],
  ['gym', 'the gym', 1],
  ['fame', 'the hall of fame', 1],
];
export const HUNT_TOTAL = HUNT_ROOMS.reduce((a, r) => a + r[2], 0);
export const HUNT_PAY = { coin: 10, all: 100 };
const KEY = 'itt-hunt-v1';

export const st = load(KEY, { w: -1, found: [], on: false, done: false });
export const fresh = () => { if (st.w !== weekIndex()) { st.w = weekIndex(); st.found = []; st.done = false; save(KEY, st); } };
fresh();
const subs = new Set();
export const changed = () => { save(KEY, st); subs.forEach((f) => { try { f(); } catch (err) { console.warn(err); } }); };

export const hunt = {
  get found() { fresh(); return st.found.length; },
  get total() { return HUNT_TOTAL; },
  get on() { return st.on; },
  get done() { fresh(); return st.done; },
  get resets() { return left(weekEnd() - Date.now()); },
  foundIn(room) { fresh(); return st.found.filter((id) => id.startsWith(`${room}-`)).length; },
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
};
