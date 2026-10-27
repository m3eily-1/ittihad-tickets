// Live predictions (2026-10-27, match-week missions "during the match"): on the live match's Predict tab you call the
// next goal, the next card and vote for the man of the match. The live match is a replay of a real result
// (match.js liveClock), so every call is settled by that match's own events as the replay reaches them: a right
// "next goal" pays the moment that goal goes in, on whatever page you're on. Man of the match is settled at full time
// against the published player of the match (FotMob's, in results-data.js). Payouts share a daily cap (economy.js).
//
//   startLivePredict(clock)                  match.js, once, with the shared clock: settles calls as it ticks
//   predHTML(r, st, crest) / predClick(b, r, st) / predKey(r, st)    the Predict tab inside openLive
//
// Fires: 'live-predict' { market, pick } when a call is made · 'live-predict-won' { market, pick } when one is right.
import { claws, EARN } from './economy.js';
import { progress } from './progress.js';
import { fanEvent } from './fan-events.js';
import { feel } from './feel.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = new Map();   // result id → { goal, card, motm, done: [] } for the replay now playing (a new kick-off clears it)
const fresh = () => ({ goal: null, card: null, motm: null, done: [] });
const state = (r) => { if (!S.has(r.id)) S.set(r.id, fresh()); return S.get(r.id); };
const clocks = new Map();
const MOTM_CLOSE = '75';

// the goals and cards as clock slots
const evs = (r, c, kind) => (kind === 'goal' ? r.scorers || [] : r.cards || []).map((x) => ({ ...x, k: c.slotOf(x.minute) })).sort((a, b) => a.k - b.k);
const sideName = (r, v) => (v === 'none' ? null : r[v].name);
const label = (r, market, v) => (market === 'motm' ? v : v === 'none' ? (market === 'goal' ? 'No more goals' : 'No more cards') : sideName(r, v));

function pay(r, market, call) {
  const e = market === 'goal' ? EARN.liveGoal : market === 'card' ? EARN.liveCard : EARN.motm;
  const got = claws.earnCapped(e.claws, `Live call: ${market === 'motm' ? 'man of the match' : `next ${market}`}`, 'live');
  progress.award(e.xp, market === 'motm' ? 'Man of the match, called' : `Called the next ${market}`);
  if (market === 'goal') progress.achieve('live-call');
  call.paid = got;
  fanEvent('live-predict-won', { market, pick: call.pick, resultId: r.id });
  feel.win();
}
function settle(r, c, s) {
  const p = state(r);
  for (const market of ['goal', 'card']) {
    const call = p[market]; if (!call || call.res) continue;
    const nx = evs(r, c, market).find((x) => x.k > call.k);
    if (nx && s.k >= nx.k) call.res = nx.team, call.by = nx;
    else if (!nx && s.phase === 'ft') call.res = 'none';
    if (!call.res) continue;
    call.won = call.res === call.pick;
    if (call.won) pay(r, market, call);
    p.done.unshift({ market, ...call });
    p[market] = null;
  }
  if (p.motm && !p.motm.res && s.phase === 'ft' && r.ratings?.potm) {
    const call = p.motm; call.res = r.ratings.potm; call.won = call.pick === call.res;
    if (call.won) pay(r, 'motm', call);
    p.done.unshift({ market: 'motm', ...call });
  }
}
export function startLivePredict(c) {
  const r = c.r; if (!r || clocks.has(r.id)) return;
  let prev = null;
  clocks.set(r.id, c);
  c.on((s) => {
    if (prev != null && s.k < prev) S.set(r.id, fresh());   // the replay kicked off again: a new match to call
    prev = s.k;
    settle(r, c, s);
  });
}

/* ── the tab ── */
// everyone who played, by side (the ratings list when there is one, else the starting line-ups)
const playersOf = (r, side) => (r.ratings?.[side] ? r.ratings[side].map(([no, name]) => ({ no, name })) : (r.lineups?.[side]?.rows || []).flat().map(([no, name]) => ({ no, name })));
export const predKey = (r, s) => { const p = state(r); return [s.phase, s.k >= clocks.get(r.id)?.slotOf(MOTM_CLOSE), p.goal?.pick, p.card?.pick, p.motm?.pick, p.done.length].join('|'); };
export function predHTML(r, s, crest) {
  const p = state(r), c = clocks.get(r.id), ft = s.phase === 'ft';
  const opts = (market) => {
    const call = p[market], none = market === 'goal' ? 'No more goals' : 'No more cards';
    const b = (v) => `<button type="button" class="ec-lp__o${call?.pick === v ? ' is-on' : ''}" data-act="lp" data-m="${market}" data-v="${v}" ${call || ft ? 'disabled' : ''} aria-pressed="${call?.pick === v}">${v === 'none' ? '<i class="ec-lp__x">0</i>' : crest(v)}<b>${esc(v === 'none' ? none : r[v].name)}</b></button>`;
    const last = p.done.find((d) => d.market === market);
    const msg = call ? `Your call: <b>${esc(label(r, market, call.pick))}</b>. Waiting for the next ${market}…`
      : ft ? 'Full time: calls are closed.'
      : last ? (last.won ? `Right! ${esc(label(r, market, last.res))}${last.by ? ` (${esc(last.by.name)}, ${esc(last.by.minute)}')` : ''}${last.paid ? ` · +${last.paid} Claws` : ''}. Call the next one.` : `It was ${esc(label(r, market, last.res))}${last.by ? ` (${esc(last.by.name)}, ${esc(last.by.minute)}')` : ''}. Call the next one.`)
      : `Who gets the next ${market}? A right call pays ${market === 'goal' ? EARN.liveGoal.claws : EARN.liveCard.claws} Claws.`;
    return `<section class="ec-pan ec-lp"><p class="ec-h">Next ${market}</p><div class="ec-lp__os">${b('home')}${b('none')}${b('away')}</div><p class="ec-lp__st" aria-live="polite">${msg}</p></section>`;
  };
  const closed = c && s.k >= c.slotOf(MOTM_CLOSE);
  const mo = p.motm, potm = r.ratings?.potm;
  const motm = potm ? `<section class="ec-pan ec-lp is-motm"><p class="ec-h">Man of the match</p>
      <p class="ec-lp__st">${mo?.res ? (mo.won ? `Right! ${esc(potm)}${mo.paid ? ` · +${mo.paid} Claws` : ''}` : `Player of the match: <b>${esc(potm)}</b>. You voted ${esc(mo.pick)}.`)
        : mo ? `Your vote: <b>${esc(mo.pick)}</b>. Settled at full time.` : ft ? `Player of the match: <b>${esc(potm)}</b>.` : closed ? `Voting closed at ${MOTM_CLOSE}'.` : `Vote before the ${MOTM_CLOSE}th minute. Right pays ${EARN.motm.claws} Claws at full time.`}</p>
      <div class="ec-lp__pl">${['home', 'away'].map((side) => `<div><p class="ec-lp__tm">${crest(side)}${esc(r[side].name)}</p><div class="ec-lp__chips">${playersOf(r, side).map((x) => `<button type="button" class="ec-chipb${mo?.pick === x.name ? ' is-on' : ''}${ft && x.name === potm ? ' is-res' : ''}" data-act="lp" data-m="motm" data-v="${esc(x.name)}" ${mo || closed || ft ? 'disabled' : ''}><b>${x.no}</b>${esc(x.name)}</button>`).join('')}</div></div>`).join('')}</div></section>` : '';
  const hist = p.done.length ? `<section class="ec-pan"><p class="ec-h">Your calls this match</p><ol class="ec-lp__h">${p.done.map((d) => `<li class="${d.won ? 'is-won' : ''}"><b>${d.market === 'motm' ? 'Man of the match' : `Next ${d.market}`}</b><span>${esc(label(r, d.market, d.pick))}</span><em>${d.won ? `Right${d.paid ? ` · +${d.paid}` : ''}` : 'Wrong'}</em></li>`).join('')}</ol></section>` : '';
  return `<div class="ec-lpw">${opts('goal')}${opts('card')}${motm}${hist}
    <p class="mc__fine">Calls are settled by this match's own events as they happen; man of the match by FotMob's player of the match. Live calls pay up to ${150} Claws a day.</p></div>`;
}
export function predClick(b, r, s) {
  if (b.dataset.act !== 'lp') return false;
  const p = state(r), c = clocks.get(r.id), m = b.dataset.m, v = b.dataset.v;
  if (s.phase === 'ft' || b.disabled) return true;
  if (m === 'motm') { if (p.motm || (c && s.k >= c.slotOf(MOTM_CLOSE))) return true; p.motm = { pick: v, k: s.k }; }
  else { if (p[m]) return true; p[m] = { pick: v, k: s.k }; }
  fanEvent('live-predict', { market: m, pick: v, resultId: r.id });
  return true;
}
