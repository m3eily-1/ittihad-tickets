// One bus for "the fan did something" (2026-10-27: the game loop). Games, pages and the match centre report what
// happened; missions, the Fan Pass, streaks and the community goal listen. Nothing here stores anything.
//
//   fanEvent('pen-goal', { top: true })     // report
//   const off = onFanEvent((type, data) => …) // listen; returns an unsubscribe
//
// Event names in use are listed where they're fired; keep them kebab-case.
const fns = new Set();
export function fanEvent(type, data = {}) {
  for (const f of fns) { try { f(type, data); } catch (err) { console.warn('[fan-events]', err); } }
}
export function onFanEvent(fn) { fns.add(fn); return () => fns.delete(fn); }
