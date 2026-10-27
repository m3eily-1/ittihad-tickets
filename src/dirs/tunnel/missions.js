// Missions (2026-10-27, the game loop: "no reason to come back daily or weekly", "match day isn't the main event").
// One page, opened from the menu rail, with three tabs:
//   Daily      — three missions that rotate with the date, and a login streak (day 1–7 rewards, then it repeats)
//   Match week — missions on the four beats of a match: before kick-off (predict the score and first scorer, pick
//                your fantasy XI, share a matchday card) and at the stadium (check in with your ticket) for the next
//                home match; during the match (live calls on the Live page) and after it (rate the players, the
//                post-match quiz, best goal) for the match on now (match.js LIVE)
//   Fan Pass   — the 34-tier track (fanpass.js)
// A mission completes on its own as you play; Claim pays its Claws and XP (economy.js EARN). Everything is kept on
// this device.
//
// ── Events this module listens for on the fan-events bus (fan-events.js). Fire these names to count: ──
//   'game-result'      { game: 'penalties' | 'freekick' | 'keepy' | 'quiz' | …, score }   a mini-game round ended
//   'pack-open'        { kind }                    a pack was opened (packs.js)
//   'room-visit'       { room }                    a room of the virtual tour was entered (main.js)
//   'live-predict'     { market: 'goal' | 'card' | 'motm', pick }   a call on the live match (live-predict.js)
//   'match-open'       { slug }                    a match centre was opened (match.js)
//   'store-view'       { key }                     a club-store product was opened (shop.js)
//   'share'            { kind, … }                 anything shared (match.js matchday card; social features)
//   'predict'          { slug, home, away, scorer }   a score prediction locked in (minigames.js)
//   'check-in'         { slug, streak }            checked in at the stadium (checkin.js)
//   'rate-players' | 'post-quiz' | 'goal-vote'     { resultId }   the result page's "Your take" (postmatch.js)
//   window 'fantasy:change' (fantasy-ui.js)        the fantasy squad changed
// …and fires: 'mission-done' { id }, 'mission-claim' { id, claws, xp }, 'streak' { day }, 'match-week-done' { week }.
// (The social layer's 'cup-match' and 'league-join' aren't missions yet: a daily can be added to POOL with them.)
import { claws, EARN, dayKey } from './economy.js';
import { progress } from './progress.js';
import { fanEvent, onFanEvent } from './fan-events.js';
import { feel } from './feel.js';
import { packsCount, grantPack } from './packs.js';
import { FIXTURES } from './fixtures.js';
import { RESULTS } from './results-data.js';
import { LIVE } from './match.js';
import { isCheckedIn } from './checkin.js';
import { fanDone } from './postmatch.js';
import { fanPass, fanPassHTML, fanPassClick, fanPassSheetOpen, closeFanPassSheet } from './fanpass.js';
import { CLAW_SVG } from './rewards.js';
import { SQUAD } from './squad.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'itt-missions-v1';
const st = (() => { try { return { daily: null, streak: null, weeks: {}, predPaid: [], ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { daily: null, streak: null, weeks: {}, predPaid: [] }; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ } };
const subs = new Set();
const changed = () => { save(); subs.forEach((f) => { try { f(); } catch (err) { console.warn(err); } }); };

/* ── the daily pool: each { id, title, of, ev, test?, go, game? } ── */
const POOL = [
  { id: 'd-games', title: 'Play two mini-game rounds', of: 2, ev: 'game-result', go: 'games', game: true },
  { id: 'd-pen', title: 'Score 8 or more in a penalties round', ev: 'game-result', test: (d) => d.game === 'penalties' && d.score >= 8, go: 'game:penalties', game: true },
  { id: 'd-fk', title: 'Play a round of free kicks', ev: 'game-result', test: (d) => d.game === 'freekick', go: 'game:freekick', game: true },
  { id: 'd-keepy', title: 'Do 15 keepy-ups in a row', ev: 'game-result', test: (d) => d.game === 'keepy' && d.score >= 15, go: 'game:keepy', game: true },
  { id: 'd-quiz', title: 'Score 3 or more in the Legends quiz', ev: 'game-result', test: (d) => d.game === 'quiz' && d.score >= 3, go: 'game:quiz', game: true },
  { id: 'd-pack', title: 'Open a pack', ev: 'pack-open', go: 'packs', needs: () => packsCount() > 0 },
  { id: 'd-room', title: 'Visit a room on the virtual tour', ev: 'room-visit', go: 'tour' },
  { id: 'd-live', title: 'Make a call in the live match', ev: 'live-predict', go: 'live:pred', needs: () => !!LIVE },
  { id: 'd-match', title: 'Look at an upcoming match', ev: 'match-open', go: 'tickets' },
  { id: 'd-store', title: 'Look at two products in the club store', of: 2, ev: 'store-view', go: 'store' },
  { id: 'd-share', title: 'Share your matchday card', ev: 'share', go: 'nextmatch' },
];
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
function pickDailies(day) {
  const order = POOL.filter((m) => !m.needs || m.needs()).map((m) => [hash(`${day}:${m.id}`), m]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const out = []; let games = 0;
  for (const m of order) { if (m.game && games >= 2) continue; out.push(m.id); if (m.game) games++; if (out.length === 3) break; }
  return out;
}
const daily = () => {
  const day = dayKey();
  if (st.daily?.day !== day) { st.daily = { day, ids: pickDailies(day), prog: {}, claimed: [], bonus: false }; save(); }
  return st.daily;
};
const dailyDef = (id) => POOL.find((m) => m.id === id);

/* ── the login streak: counted when the app opens; a missed day starts again at day 1 ── */
function touchStreak() {
  const day = dayKey(), y = dayKey(new Date(Date.now() - 864e5));
  const s = st.streak || { last: null, day: 0, claimed: null };
  if (s.last !== day) { s.day = s.last === y ? (s.day % 7) + 1 : 1; s.last = day; st.streak = s; save(); }
  return s;
}

/* ── the match week: the next home match (before, at the stadium) and the match on now (during, after) ── */
const now = () => Date.now();
export const nextHomeMatch = () => FIXTURES.find((m) => m.opp && m.kickoff && m.kickoff * 1000 > now()) || null;
const predKey = (m) => m.slug || `${String(m.opp || 'match').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${m.kickoff || 'tbc'}`;
const preds = () => { try { return JSON.parse(localStorage.getItem('itt-predict-v1')) || {}; } catch { return {}; } };
const fantasyXI = () => { try { return (JSON.parse(localStorage.getItem('itt-fantasy-v1'))?.squad || []).filter((x) => x != null).length >= 11; } catch { return false; } };
const WEEK = (nx, lv) => [
  { beat: 'before', id: 'w-predict', title: 'Predict the score and first scorer', go: 'predict', done: () => !!(nx && preds()[predKey(nx)]?.scorer) },
  { beat: 'before', id: 'w-xi', title: 'Pick your fantasy XI', go: 'fantasy', done: () => fantasyXI() },
  { beat: 'before', id: 'w-share', title: 'Share your matchday card', go: 'nextmatch' },
  { beat: 'stadium', id: 'w-checkin', title: 'Check in with your ticket on match day', go: 'mytickets', done: () => !!(nx && isCheckedIn(nx.slug)) },
  ...(lv ? [
    { beat: 'during', id: 'w-goal', title: 'Call the next goal', go: 'live:pred' },
    { beat: 'during', id: 'w-card', title: 'Call the next card', go: 'live:pred' },
    { beat: 'during', id: 'w-motm', title: 'Vote for the man of the match', go: 'live:pred' },
    { beat: 'after', id: 'w-rate', title: 'Rate the players', go: 'result:fan', done: () => fanDone(lv).rated },
    { beat: 'after', id: 'w-quiz', title: 'Take the post-match quiz', go: 'result:fan', done: () => fanDone(lv).quiz },
    { beat: 'after', id: 'w-vote', title: 'Vote for the best goal', go: 'result:fan', done: () => fanDone(lv).vote },
  ] : []),
];
const weekId = () => `${nextHomeMatch()?.slug || 'none'}|${LIVE?.id || 'none'}`;
const week = () => { const id = weekId(); st.weeks[id] ||= { done: [], claimed: [], all: false }; return st.weeks[id]; };
const weekList = () => WEEK(nextHomeMatch(), LIVE);
// state that can be read straight from storage counts too (a prediction made before this module loaded, a check-in…)
function syncWeek() {
  const w = week(); let any = false;
  for (const m of weekList()) if (!w.done.includes(m.id) && m.done?.()) { w.done.push(m.id); any = true; fanEvent('mission-done', { id: m.id }); }
  if (any) changed();
}
function markWeek(id) { const w = week(); if (!w.done.includes(id)) { w.done.push(id); changed(); fanEvent('mission-done', { id }); } }

/* ── events → progress ── */
let lastGame = '';
onFanEvent((type, d = {}) => {
  // the same round reported twice (the game and the page around it) counts once
  if (type === 'game-result') { const k = `${d.game}|${d.score}`; if (k === lastGame) return; lastGame = k; setTimeout(() => { if (lastGame === k) lastGame = ''; }, 1500); }
  const dl = daily(); let any = false;
  for (const id of dl.ids) {
    const m = dailyDef(id); if (!m || m.ev !== type || (m.test && !m.test(d))) continue;
    const of = m.of || 1, cur = dl.prog[id] || 0; if (cur >= of) continue;
    dl.prog[id] = cur + 1; any = true;
    if (dl.prog[id] >= of) fanEvent('mission-done', { id });
  }
  if (any) changed();
  if (type === 'share') markWeek('w-share');
  if (type === 'live-predict' && (!d.resultId || d.resultId === LIVE?.id)) markWeek(d.market === 'goal' ? 'w-goal' : d.market === 'card' ? 'w-card' : 'w-motm');
  if (['predict', 'check-in', 'rate-players', 'post-quiz', 'goal-vote'].includes(type)) syncWeek();
});
addEventListener('fantasy:change', () => syncWeek());

/* ── pre-match predictions, settled once the result is in results-data.js ── */
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const riyadhDay = (ts) => new Date(ts * 1000 + 3 * 3600e3).toISOString().slice(0, 10);
const FORWARDS = SQUAD.filter((p) => p.pos === 'Forward').map((p) => p.name);
function settlePredictions() {
  const all = preds();
  for (const [k, p] of Object.entries(all)) {
    if (st.predPaid.includes(k) || !p.kickoff || !p.opp) continue;
    const r = RESULTS.find((x) => x.date === riyadhDay(p.kickoff) && [x.home.name, x.away.name].some((n) => norm(n).includes(norm(p.opp)) || norm(p.opp).includes(norm(n))));
    if (!r) continue;
    st.predPaid.push(k); save();
    const us = /ittihad/i.test(r.home.name) ? 'home' : 'away', them = us === 'home' ? 'away' : 'home';
    const ug = r[us].score, tg = r[them].score, sign = (a, b) => Math.sign(a - b);
    if (p.home === ug && p.away === tg) { claws.earn(EARN.predictExact.claws, `Exact score: ${ug}–${tg}`); progress.award(EARN.predictExact.xp, 'Exact score predicted'); }
    else if (sign(p.home, p.away) === sign(ug, tg)) { claws.earn(EARN.predictOutcome.claws, 'Right result predicted'); progress.award(EARN.predictOutcome.xp, 'Right result predicted'); }
    if (p.scorer) {
      const first = (r.scorers || []).slice().sort((a, b) => parseInt(a.minute, 10) - parseInt(b.minute, 10))[0];
      const ok = !first ? p.scorer === 'No goals' : first.team === them ? /^An? /.test(p.scorer) && !/Al-Ittihad/.test(p.scorer)
        : FORWARDS.some((n) => norm(n) === norm(first.name)) ? norm(p.scorer) === norm(first.name) : p.scorer === 'Another Al-Ittihad player';
      if (ok) { claws.earn(EARN.predictScorer.claws, `First scorer: ${first ? first.name : 'no goals'}`); progress.award(EARN.predictScorer.xp, 'First scorer predicted'); }
    }
    fanEvent('predict-settled', { slug: k, resultId: r.id });
  }
}

/* ── public state ── */
const dailyDone = (id) => (daily().prog[id] || 0) >= (dailyDef(id)?.of || 1);
export const missions = {
  get claimable() {
    const dl = daily(), s = st.streak, w = week();
    let k = dl.ids.filter((id) => dailyDone(id) && !dl.claimed.includes(id)).length;
    if (!dl.bonus && dl.ids.every(dailyDone)) k++;
    if (s && s.claimed !== s.last) k++;
    k += weekList().filter((m) => w.done.includes(m.id) && !w.claimed.includes(m.id)).length;
    if (!w.all && weekList().every((m) => w.done.includes(m.id))) k++;
    return k + fanPass.claimable;
  },
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
};
fanPass.onChange(changed);
claws.on(() => subs.forEach((f) => { try { f(); } catch { /* */ } }));

/* ── claims ── */
function pay(c, x, why, id) { claws.earn(c, why); if (x) progress.award(x, why); fanEvent('mission-claim', { id, claws: c, xp: x }); }
function claim(kind, id) {
  const dl = daily(), w = week();
  if (kind === 'daily' && dailyDone(id) && !dl.claimed.includes(id)) { dl.claimed.push(id); pay(EARN.daily.claws, EARN.daily.xp, `Daily: ${dailyDef(id).title}`, id); }
  else if (kind === 'bonus' && !dl.bonus && dl.ids.every(dailyDone)) { dl.bonus = true; pay(EARN.dailyAll.claws, EARN.dailyAll.xp, 'All three dailies', 'daily-all'); }
  else if (kind === 'streak') {
    const s = st.streak; if (!s || s.claimed === s.last) return false;
    s.claimed = s.last; pay(EARN.streak[s.day - 1], 0, `Streak · day ${s.day}`, 'streak');
    if (s.day === 7) { grantPack('match', 'Seven-day streak'); progress.achieve('streak-7'); }
    fanEvent('streak', { day: s.day });
  } else if (kind === 'week' && w.done.includes(id) && !w.claimed.includes(id)) { w.claimed.push(id); pay(EARN.matchWeek.claws, EARN.matchWeek.xp, `Match week: ${weekList().find((m) => m.id === id)?.title || id}`, id); }
  else if (kind === 'weekall' && !w.all && weekList().every((m) => w.done.includes(m.id))) { w.all = true; pay(EARN.matchWeekAll.claws, EARN.matchWeekAll.xp, 'Every match-week mission', 'match-week'); progress.achieve('match-week'); fanEvent('match-week-done', { week: weekId() }); }
  else return false;
  changed();
  return true;
}

/* ── the page ── */
const IC = {
  daily: '<path d="M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M9 15l2 2 4-4"/>',
  week: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z"/>',
  go: '<path d="M9 5l7 7-7 7"/>', check: '<path d="M5 12l5 5 9-10"/>',
  before: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 7v5l3 2"/>',
  stadium: '<path d="M3 20V9l9-5 9 5v11 M3 20h18 M7 20v-6h10v6"/>',
  during: '<path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M5 5a10 10 0 0 0 0 14 M19 5a10 10 0 0 1 0 14"/>',
  after: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};
const ic = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const rewardChips = (c, x) => `<span class="mx-rw"><span class="ec-price">${CLAW_SVG}${c}</span>${x ? `<span class="mx-rw__xp">${x} XP</span>` : ''}</span>`;
const row = ({ id, title, sub = '', prog = null, c, x, state, go, kind, icon }) => `<li class="mx-m is-${state}">
    <span class="mx-m__ic">${state === 'todo' ? ic(icon || (kind === 'daily' ? 'daily' : 'week')) : ic('check')}</span>
    <div class="mx-m__b"><b>${esc(title)}</b>${sub ? `<em>${esc(sub)}</em>` : ''}${prog ? `<span class="mx-bar" aria-label="${prog[0]} of ${prog[1]}"><i style="width:${(prog[0] / prog[1]) * 100}%"></i></span><small>${prog[0]} / ${prog[1]}</small>` : ''}</div>
    ${rewardChips(c, x)}
    ${state === 'ready' ? `<button type="button" class="mc__btn" data-act="mx-claim" data-k="${kind}" data-id="${esc(id)}">Claim</button>`
      : state === 'claimed' ? '<span class="mx-m__ok">Claimed</span>'
      : go ? `<button type="button" class="mc__btn is-2" data-act="mx-go" data-go="${esc(go)}">Go</button>` : ''}</li>`;
const untilMidnight = () => { const d = new Date(); const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d; const h = Math.floor(m / 3600e3), mi = Math.floor((m % 3600e3) / 60e3); return `${h}h ${mi}m`; };

function dailyHTML() {
  const dl = daily(), s = touchStreak();
  const days = EARN.streak.map((c, i) => { const n = i + 1, past = n < s.day, today = n === s.day, got = past || (today && s.claimed === s.last); return `<li class="${got ? 'is-got' : ''}${today ? ' is-today' : ''}"><small>Day ${n}</small><span class="ec-price">${CLAW_SVG}${c}</span>${n === 7 ? '<em>+ Match pack</em>' : ''}${got ? `<i>${ic('check')}</i>` : ''}</li>`; }).join('');
  const canStreak = s.claimed !== s.last;
  const list = dl.ids.map((id) => { const m = dailyDef(id); if (!m) return ''; const p = Math.min(dl.prog[id] || 0, m.of || 1), done = p >= (m.of || 1); return row({ id, title: m.title, prog: (m.of || 1) > 1 ? [p, m.of] : null, c: EARN.daily.claws, x: EARN.daily.xp, state: dl.claimed.includes(id) ? 'claimed' : done ? 'ready' : 'todo', go: m.go, kind: 'daily' }); }).join('');
  const allDone = dl.ids.every(dailyDone);
  const bonus = row({ id: 'bonus', title: 'All three done', sub: 'A bonus for the full set', c: EARN.dailyAll.claws, x: EARN.dailyAll.xp, state: dl.bonus ? 'claimed' : allDone ? 'ready' : 'todo', kind: 'bonus' });
  return `<div class="mx-daily">
    <section class="ec-pan mx-streak"><p class="ec-h">Daily streak <span>Day ${s.day} of 7</span></p><ol class="mx-days">${days}</ol>
      <div class="ec-row">${canStreak ? `<button type="button" class="mc__btn" data-act="mx-claim" data-k="streak">Claim day ${s.day}</button>` : `<p class="mx-note">Come back tomorrow for day ${(s.day % 7) + 1}. Miss a day and it starts again.</p>`}</div></section>
    <section class="ec-pan"><p class="ec-h">Today's missions <span>New ones in ${untilMidnight()}</span></p><ul class="mx-list">${list}${bonus}</ul></section></div>`;
}
function weekHTML() {
  const nx = nextHomeMatch(), lv = LIVE, w = week(), list = weekList();
  syncWeek();
  const stOf = (m) => (w.claimed.includes(m.id) ? 'claimed' : w.done.includes(m.id) ? 'ready' : 'todo');
  const beat = (k, title) => { const ms = list.filter((m) => m.beat === k); return ms.length ? `<p class="mx-beat">${ic(k)}${esc(title)}</p><ul class="mx-list">${ms.map((m) => row({ id: m.id, title: m.title, c: EARN.matchWeek.claws, x: EARN.matchWeek.xp, state: stOf(m), go: m.go, kind: 'week', icon: m.beat })).join('')}</ul>` : ''; };
  const n = list.filter((m) => w.done.includes(m.id)).length;
  const when = nx ? new Date(nx.kickoff * 1000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' }) : '';
  const crest = (src) => (src ? `<img src="${esc(src)}" alt=""/>` : '<span class="mc__nocrest"></span>');
  const lvUs = lv && /ittihad/i.test(lv.home.name) ? 'home' : 'away';
  return `<div class="mx-week">
    <section class="ec-pan mx-wk__hd"><div><p class="ec-h">This match week <span>${n} / ${list.length} done</span></p><span class="mx-bar is-big"><i style="width:${(n / list.length) * 100}%"></i></span></div>
      ${row({ id: 'weekall', title: 'Every match-week mission', c: EARN.matchWeekAll.claws, x: EARN.matchWeekAll.xp, state: w.all ? 'claimed' : n === list.length ? 'ready' : 'todo', kind: 'weekall' }).replace('<li', '<div').replace(/<\/li>$/, '</div>')}</section>
    <div class="mx-wk__cols">
      ${nx ? `<section class="ec-pan mx-wk"><header class="mx-wk__m"><div><p>Next home match</p><b>Al Ittihad vs ${esc(nx.opp)}</b><small>${esc(nx.compLabel || '')} · ${esc(when)}${nx.timeTBC ? ' · kick-off TBC' : ''}</small></div>${crest(nx.crest)}</header>
        ${beat('before', 'Before kick-off')}${beat('stadium', 'At the stadium')}</section>` : ''}
      ${lv ? `<section class="ec-pan mx-wk"><header class="mx-wk__m"><div><p>Live now</p><b>${esc(lv.home.name)} vs ${esc(lv.away.name)}</b><small>${esc(lv.comp === 'rsl' ? 'Saudi Pro League' : '')}${lv.round ? ` · ${esc(lv.round)}` : ''}</small></div><span class="lv-chip is-live">Live</span></header>
        ${beat('during', 'During the match')}${beat('after', 'After the match')}</section>` : ''}
    </div>
    <p class="mc__fine">Right calls pay more on top: an exact score, the first scorer, the next goal or card and the man of the match are each settled by the real result.</p></div>`;
}

let root = null, tab = 'daily', opts = {};
export function openMissions(o = {}) {
  opts = o; tab = o.tab || tab;
  root?.remove();
  root = document.createElement('div');
  root.className = 'mx'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Missions');
  document.body.append(root);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('click', onClick);
  const off = missions.onChange(() => { if (!root || !root.isConnected) return off(); if (!root.classList.contains('is-under') && !fanPassSheetOpen()) render(true); });
  render();
  requestAnimationFrame(() => root?.classList.add('is-on'));
}
function render(keep = false) {
  if (!root) return;
  const y = root.querySelector('.mx__body')?.scrollTop || 0, fx = root.querySelector('.js-fp-scroll')?.scrollLeft;
  const dl = daily(), s = touchStreak(), w = week();
  const nD = dl.ids.filter((id) => dailyDone(id) && !dl.claimed.includes(id)).length + (s.claimed !== s.last ? 1 : 0) + (!dl.bonus && dl.ids.every(dailyDone) ? 1 : 0);
  const nW = weekList().filter((m) => w.done.includes(m.id) && !w.claimed.includes(m.id)).length + (!w.all && weekList().every((m) => w.done.includes(m.id)) ? 1 : 0);
  const tabs = [['daily', 'Daily', nD], ['week', 'Match week', nW], ['pass', 'Fan Pass', fanPass.claimable]];
  root.innerHTML = `<header class="mx__hd"><button type="button" class="mx__back" data-act="mx-close" aria-label="Back">Back</button><h2>Missions</h2>
      <nav class="mx__tabs" aria-label="Missions">${tabs.map(([k, l, n]) => `<button type="button" class="${tab === k ? 'is-on' : ''}" data-act="mx-tab" data-k="${k}" aria-pressed="${tab === k}">${l}${n ? `<i>${n}</i>` : ''}</button>`).join('')}</nav>
      <button type="button" class="mx__chip" data-act="mx-go" data-go="rewards" aria-label="Claws: ${claws.balance}. Open the rewards">${CLAW_SVG}<b>${claws.balance.toLocaleString('en')}</b><span>Claws</span></button></header>
    <main class="mx__body">${tab === 'daily' ? dailyHTML() : tab === 'week' ? weekHTML() : fanPassHTML()}</main>`;
  const body = root.querySelector('.mx__body');
  if (keep) body.scrollTop = y;
  const sc = root.querySelector('.js-fp-scroll');
  if (sc) { if (keep && fx != null) sc.scrollLeft = fx; else { const on = sc.querySelector('.fp-col.is-next') || sc.querySelector('.fp-col.is-on:last-of-type'); if (on) sc.scrollLeft = Math.max(0, on.offsetLeft - sc.clientWidth / 2); } }
}
function close(quiet = false) {
  const r = root; root = null; if (!r) return;
  closeFanPassSheet();
  if (!quiet) feel.back();
  r.classList.remove('is-on'); setTimeout(() => r.remove(), 250);
  if (!quiet) opts.onClose?.();
}
function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b || !root) return;
  const a = b.dataset.act;
  if (a === 'mx-close') { if (fanPassSheetOpen()) { closeFanPassSheet(); feel.back(); return render(true); } return close(); }
  if (a === 'mx-tab') { feel.tap(); closeFanPassSheet(); tab = b.dataset.k; return render(); }
  if (a === 'mx-claim') { if (claim(b.dataset.k, b.dataset.id)) { feel.win(); feel.confetti({ n: 90, y: 0.3 }); } return render(true); }
  if (a === 'mx-go') {
    feel.tap();
    const go = b.dataset.go, el = root;
    // games and the tour leave the menu: the page closes; everything else opens over it and back returns here
    if (/^(game:|tour)/.test(go)) { close(true); opts.onGo?.(go, null); return; }
    el.classList.add('is-under');
    opts.onGo?.(go, () => { el.classList.remove('is-under'); if (root === el) render(true); });
    return;
  }
  if (fanPassClick(b)) render(true);
}
// Escape: the Fan Pass's membership sheet first (page-nav.js presses the page's back otherwise)
export const missionsOpen = () => !!root;

/* ── start-up ── */
touchStreak();
daily();
settlePredictions();
syncWeek();
