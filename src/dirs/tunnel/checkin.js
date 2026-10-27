// At the stadium (2026-10-27, match-week missions): "Check in" on a booked ticket in My tickets. On the real app it
// would open on match day at the gate; here it can be tapped any time on a booked ticket, standing in for arriving.
// It pays Claws and XP and builds an attendance streak: consecutive matches you hold tickets for that you checked
// in at, each one in a row adding a bonus (economy.js EARN.checkIn / checkInStreak).
//
//   checkIn(slug, label) → { claws, xp, streak } | null (already in)     isCheckedIn(slug)     attendanceStreak()
//   A season-pass ticket checks in for the next home match (its slug), so it counts like a match ticket.
import { claws, EARN } from './economy.js';
import { progress } from './progress.js';
import { fanEvent } from './fan-events.js';

const KEY = 'itt-checkin-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
let list = load();   // [{ slug, label, at, streak }], in the order you checked in
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode */ } };

export const isCheckedIn = (slug) => list.some((x) => x.slug === slug);
export const checkIns = () => list.slice();
export const attendanceStreak = () => list[list.length - 1]?.streak || 0;

/** ticketedSlugs: the matches you hold tickets for, oldest first (so a skipped one breaks the streak) */
export function checkIn(slug, label = '', ticketedSlugs = []) {
  if (!slug || isCheckedIn(slug)) return null;
  // the streak goes on when the match before this one (of those you had tickets for) was checked in too
  const order = ticketedSlugs.filter((s, i, a) => a.indexOf(s) === i);
  const i = order.indexOf(slug), prev = i > 0 ? order[i - 1] : list[list.length - 1]?.slug;
  const streak = prev && isCheckedIn(prev) ? attendanceStreak() + 1 : 1;
  list.push({ slug, label, at: Date.now(), streak }); save();
  const bonus = Math.min(EARN.checkInStreakMax, EARN.checkInStreak * (streak - 1));
  claws.earn(EARN.checkIn.claws + bonus, `Checked in${label ? ` · ${label}` : ''}${bonus ? ` · ${streak} in a row` : ''}`);
  progress.award(EARN.checkIn.xp, 'Checked in at the stadium');
  progress.achieve('check-in');
  fanEvent('check-in', { slug, label, streak });
  return { claws: EARN.checkIn.claws + bonus, xp: EARN.checkIn.xp, streak };
}
