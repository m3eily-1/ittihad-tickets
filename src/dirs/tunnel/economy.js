// Claws, the fan currency (Ahmed, 2026-10-27): earned by playing, predicting, checking in and finishing missions;
// spent in the rewards shop (ticket perks, store coupons, experiences, avatar items). Lives in this browser.
//
//   claws.balance            // current Claws
//   claws.earn(n, reason)    // +n (a "+n Claws" pop-up is the UI's job, via claws.on)
//   claws.spend(n, reason)   // → true if you had enough
//   claws.on(fn)             // fn({ type: 'earn' | 'spend', amount, reason, balance }); returns an unsubscribe
//   claws.earnCapped(n, reason, bucket)   // like earn, but repeatable sources share a daily cap (CAPS) → what was paid
//   claws.today(bucket)      // Claws paid from a capped source today
//
// The economy in one place (so every source stays coherent): an active day is worth roughly 150–300 Claws (three
// dailies + their bonus, the streak, a few game rounds), a match week roughly 600–900 more, and rewards cost
// 300–5,000 (rewards.js). EARN lists the one-off amounts the modules pay; CAPS limits what repeatable play can pay
// per day, so grinding a mini-game doesn't buy the shop.
const KEY = 'itt-claws-v1';
const load = () => { try { return { balance: 0, log: [], caps: {}, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { balance: 0, log: [], caps: {} }; } };
const st = load();
if (!st.caps || typeof st.caps !== 'object') st.caps = {};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ } };
const fns = new Set();
const emit = (e) => fns.forEach((f) => { try { f(e); } catch (err) { console.warn(err); } });

// local calendar day, 'YYYY-MM-DD' (missions, streaks and caps all turn over at the fan's midnight)
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// what each source pays (Claws, and the XP that goes with it where there is some)
export const EARN = {
  daily: { claws: 40, xp: 20 },          // each daily mission
  dailyAll: { claws: 50, xp: 20 },       // all three dailies done
  streak: [20, 30, 40, 60, 80, 100, 200], // login streak, day 1 → 7 (day 7 adds a Match pack), then it starts again
  matchWeek: { claws: 50, xp: 40 },      // each match-week mission (before / during / at the stadium / after)
  matchWeekAll: { claws: 150, xp: 100 }, // every mission of a match week
  checkIn: { claws: 100, xp: 50 },       // checking in at the stadium; +50 per match of attendance streak, up to +200
  checkInStreak: 50, checkInStreakMax: 200,
  liveGoal: { claws: 40, xp: 20 },       // a right "next goal" call in the live match
  liveCard: { claws: 30, xp: 15 },       // a right "next card" call
  motm: { claws: 50, xp: 30 },           // the right man of the match
  predictOutcome: { claws: 50, xp: 30 }, // a pre-match prediction with the right result…
  predictExact: { claws: 150, xp: 80 },  // …or the exact score
  predictScorer: { claws: 100, xp: 50 }, // the right first goalscorer
  quizAnswer: { claws: 15, xp: 10 },     // each right post-match quiz answer
  achievement: 1,                        // an achievement pays its XP value in Claws as well, once
};
// daily caps for repeatable sources (Claws a day)
export const CAPS = { games: 60, live: 150 };

export const claws = {
  get balance() { return st.balance; },
  get log() { return st.log.slice(); },
  earn(n, reason = '') {
    n = Math.round(n); if (!(n > 0)) return;
    st.balance += n; st.log = [{ n, reason, at: Date.now() }, ...st.log].slice(0, 50); save();
    emit({ type: 'earn', amount: n, reason, balance: st.balance });
  },
  spend(n, reason = '') {
    n = Math.round(n); if (!(n > 0) || st.balance < n) return false;
    st.balance -= n; st.log = [{ n: -n, reason, at: Date.now() }, ...st.log].slice(0, 50); save();
    emit({ type: 'spend', amount: n, reason, balance: st.balance });
    return true;
  },
  on(fn) { fns.add(fn); return () => fns.delete(fn); },
  today(bucket) { const c = st.caps[bucket]; return c && c.day === dayKey() ? c.n : 0; },
  earnCapped(n, reason = '', bucket = 'games') {
    const cap = CAPS[bucket] ?? Infinity, used = this.today(bucket);
    const pay = Math.max(0, Math.min(Math.round(n), cap - used));
    if (!pay) return 0;
    st.caps[bucket] = { day: dayKey(), n: used + pay }; save();
    this.earn(pay, reason);
    return pay;
  },
};
