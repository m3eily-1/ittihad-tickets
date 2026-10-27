// After the match (2026-10-27, match-week missions): the result page's "Your take" tab — rate the players, a
// three-question quiz built only from that result's own data (score, scorers, player of the match, stats), and a
// best-goal vote among Al-Ittihad's goals. Ratings compare yours with the published ones (FotMob's, where the result
// has them). One go per result, kept on this device.
//
//   fanTab(r) → bool (anything to show)    fanHTML(r, crest)    fanClick(b, r) / fanInput(e, r) → true = re-render
// Fires: 'rate-players' { resultId } · 'post-quiz' { resultId, score, of } · 'goal-vote' { resultId, goal }
import { claws, EARN } from './economy.js';
import { progress } from './progress.js';
import { fanEvent } from './fan-events.js';
import { feel } from './feel.js';
import { SQUAD } from './squad.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'itt-postmatch-v1';
const all = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ } };
const S = (r) => (all[r.id] ||= { rated: null, quiz: [], vote: null });
const draft = new Map();   // result id → { name: rating } before submitting

const us = (r) => (/ittihad/i.test(r.home.name) ? 'home' : 'away');
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const order = (arr, seed) => arr.map((v, i) => [hash(`${seed}:${i}:${v}`), v]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const uniq = (a) => a.filter((v, i) => v != null && a.indexOf(v) === i);

// Al-Ittihad's players in this match: everyone with a published rating, else the starting line-up
const ourPlayers = (r) => {
  const side = us(r);
  if (r.ratings?.[side]) return r.ratings[side].map(([no, name, v, mins]) => ({ no, name, pub: v, mins }));
  if (r.lineups?.[side]) return r.lineups[side].rows.flat().map(([no, name]) => ({ no, name, pub: null }));
  return [];
};
const ourGoals = (r) => (r.scorers || []).filter((g) => g.team === us(r));

function quizOf(r) {
  const qs = [], side = us(r), them = side === 'home' ? 'away' : 'home';
  const hs = r.home.score, as = r.away.score;
  const sc = (h, a) => `${r.home.name} ${h} – ${a} ${r.away.name}`;
  qs.push({ q: 'What was the final score?', a: sc(hs, as), o: uniq([sc(hs, as), sc(as, hs), sc(hs + (hs ? -1 : 1), as), sc(hs, as + 1), sc(hs + 1, as + 1)]).slice(0, 4) });
  const goals = (r.scorers || []).slice().sort((a, b) => parseInt(a.minute, 10) - parseInt(b.minute, 10));
  if (goals.length) {
    const names = uniq([...goals.map((g) => g.name), ...ourPlayers(r).map((p) => p.name), ...SQUAD.filter((p) => p.pos === 'Forward').map((p) => p.name)]);
    qs.push({ q: 'Who scored the first goal?', a: goals[0].name, o: uniq([goals[0].name, ...names.filter((n) => n !== goals[0].name).slice(0, 3)]) });
  }
  if (r.ratings?.potm) {
    const rated = ['home', 'away'].flatMap((s) => r.ratings[s] || []).filter((x) => x[2] != null && x[1] !== r.ratings.potm).sort((a, b) => b[2] - a[2]).map((x) => x[1]);
    qs.push({ q: "Who was FotMob's player of the match?", a: r.ratings.potm, o: [r.ratings.potm, ...rated.slice(0, 3)] });
  }
  if (Array.isArray(r.stats?.onTarget)) {
    const v = r.stats.onTarget[side === 'home' ? 0 : 1];
    qs.push({ q: 'How many shots on target did Al-Ittihad have?', a: String(v), o: uniq([v, v + 2, Math.max(0, v - 2), v + 4].map(String)) });
  } else if (r.attendance) {
    const v = Number(r.attendance), f = (n) => Math.round(n).toLocaleString('en');
    qs.push({ q: 'What was the attendance?', a: f(v), o: [f(v), f(v * 1.6), f(v * 0.6), f(v * 2.3)] });
  }
  void them;
  return qs.slice(0, 3).map((x, i) => ({ ...x, o: order(x.o, `${r.id}-${i}`) }));
}

export const fanTab = (r) => !!r && (ourPlayers(r).length > 0 || quizOf(r).length > 0 || ourGoals(r).length > 1);

export function fanHTML(r, crest = () => '') {
  const s = S(r), side = us(r), pl = ourPlayers(r), qs = quizOf(r), gl = ourGoals(r);
  const d = draft.get(r.id) || {};
  const rate = pl.length ? (s.rated
    ? `<section class="ec-pan"><p class="ec-h">Your ratings${pl.some((p) => p.pub != null) ? ' <span>vs FotMob</span>' : ''}</p><ol class="ec-rate is-done">${pl.map((p) => { const mine = s.rated[p.name]; const diff = p.pub != null && mine != null ? mine - p.pub : null; return `<li><b>${p.no}</b><span>${esc(p.name)}</span><em>${mine != null ? mine.toFixed(1) : '–'}</em><i class="${p.pub == null ? 'is-na' : ''}">${p.pub != null ? p.pub.toFixed(1) : '–'}</i>${diff != null ? `<small class="${Math.abs(diff) <= 0.5 ? 'is-close' : ''}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</small>` : '<small></small>'}</li>`; }).join('')}</ol>
        <p class="mc__fine">${pl.some((p) => p.pub != null) ? `Your rating, FotMob's and the gap. Ratings: <a href="${esc(r.ratingsSource || '#')}" target="_blank" rel="noopener">FotMob</a>.` : 'Your ratings, kept on this device.'}</p></section>`
    : `<section class="ec-pan"><p class="ec-h">Rate the players</p><ol class="ec-rate">${pl.map((p) => { const v = d[p.name] ?? 6; return `<li><b>${p.no}</b><span>${esc(p.name)}${p.mins ? `<small>${p.mins}'</small>` : ''}</span><input type="range" min="1" max="10" step="0.5" value="${v}" data-pm="rate" data-n="${esc(p.name)}" aria-label="Rating for ${esc(p.name)}"/><em class="js-pm-v">${Number(v).toFixed(1)}</em></li>`; }).join('')}</ol>
        <div class="ec-row"><button type="button" class="mc__btn" data-act="pm-rate">Submit ratings</button><p class="mc__fine">Out of 10. Then see how FotMob rated them.</p></div></section>`) : '';
  const done = s.quiz.length >= qs.length, right = s.quiz.filter((a, i) => qs[i] && a === qs[i].a).length;
  const quiz = qs.length ? `<section class="ec-pan"><p class="ec-h">Post-match quiz ${done ? `<span>${right} / ${qs.length}</span>` : `<span>${s.quiz.length + 1} of ${qs.length}</span>`}</p>
      ${done ? `<ol class="ec-quiz__r">${qs.map((q, i) => `<li class="${s.quiz[i] === q.a ? 'is-right' : 'is-wrong'}"><b>${esc(q.q)}</b><span>${esc(q.a)}${s.quiz[i] !== q.a ? ` · you said ${esc(s.quiz[i])}` : ''}</span></li>`).join('')}</ol>`
        : (() => { const q = qs[s.quiz.length]; return `<p class="ec-quiz__q">${esc(q.q)}</p><div class="ec-quiz__o">${q.o.map((o) => `<button type="button" class="ec-chipb is-wide" data-act="pm-q" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div><p class="mc__fine">${EARN.quizAnswer.claws} Claws for each right answer. One go.</p>`; })()}</section>` : '';
  const vote = gl.length > 1 ? `<section class="ec-pan"><p class="ec-h">Best goal</p><div class="ec-goals">${gl.map((g) => { const id = `${g.name}|${g.minute}`, ev = (r.events || []).find((e) => e.minute === g.minute); return `<button type="button" class="ec-goal${s.vote === id ? ' is-on' : ''}" data-act="pm-vote" data-v="${esc(id)}" ${s.vote ? 'disabled' : ''}><b>${esc(g.minute)}'</b><span><strong>${esc(g.name)}</strong>${ev ? `<em>${esc(ev.text)}</em>` : ''}</span>${s.vote === id ? '<i>Your vote</i>' : ''}</button>`; }).join('')}</div>
      <p class="mc__fine">${s.vote ? "Thanks for voting. Only your own vote is kept, on this device, so there's no fan split to show." : 'Pick the Al-Ittihad goal you liked most.'}</p></section>` : '';
  void side; void crest;
  return `<div class="ec-fan">${rate}<div class="ec-fan__side">${quiz}${vote}</div></div>`;
}
export function fanInput(e, r) {
  const t = e.target; if (t.dataset?.pm !== 'rate') return false;
  const d = draft.get(r.id) || {}; d[t.dataset.n] = +t.value; draft.set(r.id, d);
  const v = t.parentElement.querySelector('.js-pm-v'); if (v) v.textContent = (+t.value).toFixed(1);
  return false;
}
export function fanClick(b, r) {
  const a = b.dataset.act; if (!a?.startsWith('pm-')) return false;
  const s = S(r);
  if (a === 'pm-rate' && !s.rated) {
    const d = draft.get(r.id) || {};
    s.rated = Object.fromEntries(ourPlayers(r).map((p) => [p.name, d[p.name] ?? 6])); save();
    progress.award(20, 'Rated the players');
    feel.win();
    fanEvent('rate-players', { resultId: r.id });
    return true;
  }
  if (a === 'pm-q') {
    const qs = quizOf(r), q = qs[s.quiz.length]; if (!q) return true;
    s.quiz.push(b.dataset.v); save();
    if (b.dataset.v === q.a) { feel.win(); claws.earn(EARN.quizAnswer.claws, 'Post-match quiz'); progress.award(EARN.quizAnswer.xp, 'Post-match quiz'); } else feel.back();
    if (s.quiz.length >= qs.length) fanEvent('post-quiz', { resultId: r.id, score: s.quiz.filter((x, i) => x === qs[i].a).length, of: qs.length });
    return true;
  }
  if (a === 'pm-vote' && !s.vote) {
    s.vote = b.dataset.v; save();
    progress.award(10, 'Voted for the best goal');
    feel.win();
    fanEvent('goal-vote', { resultId: r.id, goal: s.vote });
    return true;
  }
  return false;
}
/** what's done for a result (missions read it) */
export const fanDone = (r) => { const s = all[r.id] || {}; return { rated: !!s.rated, quiz: (s.quiz || []).length >= Math.max(1, quizOf(r).length), vote: !!s.vote }; };
