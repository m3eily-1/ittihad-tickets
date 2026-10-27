// Derby weeks (2026-10-27): when a rival comes to Jeddah — Al Ahli (the Jeddah derby), Al Hilal or Al Nassr — the
// week before kick-off is a fans' battle: every mini-game round Tigers fans play counts for Ittihad, the rival's fans
// play for theirs, and one bar shows who's ahead. A countdown runs to kick-off; after it, a banner says which
// fanbase won the week (the match itself is the match). Fixtures come from fixtures.js — nothing invented: if no
// rival is next, the page shows the next rival fixture in the data and when its week opens.
// The other fanbase's and the Tigers' totals are simulated (seeded by the fixture, rising through the week); your
// own plays are added to the Tigers' side. Review overrides: ?derby=live | over.
import { FIXTURES } from './fixtures.js';
import { fanEvent, onFanEvent } from './fan-events.js';
import { claws } from './economy.js';
import { feel } from './feel.js';
import { fzPage, meter } from './fz-ui.js';
import { openShare } from './share-card.js';
import { load, save, esc, fmt, left, rng, hash, rand, myWeek, DATE, DAY } from './fz-core.js';

export const RIVALS = {
  AHL: { name: 'Al Ahli', fans: 'Ahli fans', title: 'Jeddah derby week', short: 'Jeddah derby' },
  HIL: { name: 'Al Hilal', fans: 'Hilal fans', title: 'Rivals week', short: 'Rivals week' },
  NAS: { name: 'Al Nassr', fans: 'Nassr fans', title: 'Rivals week', short: 'Rivals week' },
};
const WEEK = 7 * DAY, AFTER = 3 * DAY;
const KEY = 'itt-derby-v1';
const st = { claimed: [], ...load(KEY, {}) };

// the clock (a review override moves it into, or just past, the next rival's week)
const OVR = new URLSearchParams(location.search).get('derby');
let shift = 0;
export const now = () => Date.now() + shift;   // (the derby's clock: real time unless ?derby= moves it)
const rivalFixtures = () => FIXTURES.filter((m) => RIVALS[m.oppCode] && m.kickoff).sort((a, b) => a.kickoff - b.kickoff);
{
  const m = rivalFixtures().find((x) => x.kickoff * 1000 > Date.now());
  if (m && OVR === 'live') shift = m.kickoff * 1000 - 2.6 * DAY - Date.now();
  if (m && OVR === 'over') shift = m.kickoff * 1000 + 0.4 * DAY - Date.now();
}

/* the derby that's on (or next): its fixture, state and times */
export function derbyInfo(t = now()) {
  const list = rivalFixtures();
  const m = list.find((x) => x.kickoff * 1000 + AFTER > t);
  if (!m) return null;
  // it opens a week before kick-off — or earlier, as soon as the rival is the next fixture (the match before kicks off)
  // the battle closes at kick-off; with the time still TBC, at the start of matchday (Jeddah time)
  const ko = m.timeTBC ? Math.floor((m.kickoff * 1000 + 3 * 3600e3) / DAY) * DAY - 3 * 3600e3 : m.kickoff * 1000, prev = FIXTURES.filter((x) => x.kickoff && x.kickoff < m.kickoff).pop();
  const opens = prev ? Math.min(ko - WEEK, prev.kickoff * 1000) : ko - WEEK;
  const state = t >= ko ? 'over' : t >= opens ? 'live' : 'soon';
  return { m, key: `${m.oppCode}-${m.kickoff}`, rival: RIVALS[m.oppCode], ko, opens, state, clock: m.timeTBC ? 'Matchday in' : 'Kick-off in' };
}
// a side's share of its week's plays by time t: seven seeded days, filled as they pass (a lead can change hands)
function curve(key, open, ko, t) {
  if (t >= ko) return 1; if (t <= open) return 0;
  const n = Math.max(1, Math.ceil((ko - open) / DAY)), r = rng(hash(key)), days = Array.from({ length: n }, (_, i) => 0.4 + r() + i * 0.08);
  const tot = days.reduce((a, b) => a + b, 0), f = (t - open) / DAY, d = Math.floor(f);
  return (days.slice(0, d).reduce((a, b) => a + b, 0) + (days[d] || 0) * (f - d)) / tot;
}
export function tally(d, t = now()) {
  const vol = 140000 + rand(`dv|${d.key}`) * 120000, share = 0.46 + rand(`ds|${d.key}`) * 0.1;
  const mine = myWeek.derbyAll[d.key] || { plays: 0, pts: 0 };
  const at = Math.min(t, d.ko);
  const itt = Math.round(vol * share * curve(`di|${d.key}`, d.opens, d.ko, at)) + mine.plays;
  const riv = Math.round(vol * (1 - share) * curve(`dr|${d.key}`, d.opens, d.ko, at));
  return { itt, riv, k: itt + riv ? itt / (itt + riv) : 0.5, mine };
}

// your rounds count while the week is live
onFanEvent((type, e) => {
  if (type !== 'game-result' || !e.tier) return;   // (the copy without a tier is the same round, reported again)
  const d = derbyInfo(); if (!d || d.state !== 'live') return;
  myWeek.addDerby(d.key, e.score || 0);
  const first = myWeek.derbyPlay(e.score || 0);
  fanEvent('derby-play', { opp: d.m.oppCode, game: e.game, score: e.score || 0 });
  if (first) claws.earn(20, `${d.rival.short} · first play today`);
});

const crest = (src, code) => (src ? `<img src="${esc(src)}" alt=""/>` : `<i class="fz-mono">${esc(code)}</i>`);
const when = (m) => { const d = new Date(m.kickoff * 1000); return `${DATE.format(d)} · ${m.timeTBC ? 'kick-off TBC' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })}`; };

/* the menu's next-matches panel: one compact row */
export function derbyMenuRow() {
  const d = derbyInfo(); if (!d) return '';
  const T = tally(d), pc = Math.round(T.k * 100);
  const sub = d.state === 'live' ? `Tigers ${pc}% · ${d.rival.fans.split(' ')[0]} ${100 - pc}%` : d.state === 'over' ? (T.k >= 0.5 ? 'Tigers fans won the week' : `${d.rival.fans} won the week`) : `${d.rival.name} · ${DATE.format(d.ko)}`;
  const tm = d.state === 'live' ? `<small>${d.clock}</small>${left(d.ko - now())}` : d.state === 'soon' ? `<small>Opens in</small>${left(d.opens - now())}` : '<small>Result</small>Final';
  return `<button type="button" class="nm-ls__r is-derby is-${d.state}" data-go="derby">${crest(d.m.crest, d.m.oppCode)}<b>${esc(d.rival.title)}<small>${esc(sub)}</small></b><em class="js-dy-left">${tm}</em><strong>›</strong></button>`;
}
export function bindDerbyRow(host) {
  const tick = () => { const r = host?.querySelector('.is-derby'); if (!r || !r.isConnected) return; const n = document.createElement('div'); n.innerHTML = derbyMenuRow(); const nr = n.firstElementChild; if (nr) r.querySelector('.js-dy-left').innerHTML = nr.querySelector('.js-dy-left').innerHTML; };
  const t = setInterval(() => { if (!host?.isConnected) { clearInterval(t); return; } tick(); }, 1000);
}

/* ── the page ── */
export function openDerby({ onClose, onPlay } = {}) {
  const d = derbyInfo();
  const p = fzPage({ cls: 'fz-dy', title: d ? d.rival.title : 'Derby week', onClose });
  if (!d) { p.body.innerHTML = '<p class="fz-empty">No rival fixtures left in the published list.</p>'; return p; }
  const m = d.m;
  const render = () => {
    const x = derbyInfo() || d, T = tally(x), pc = Math.round(T.k * 100), won = T.k >= 0.5;
    const claimKey = `${x.key}`, canClaim = x.state === 'over' && won && T.mine.plays > 0 && !st.claimed.includes(claimKey);
    const banner = x.state === 'over'
      ? `<div class="fz-hero ${won ? 'is-win' : ''}"><div><h3>${won ? 'Tigers fans won the week' : `${esc(x.rival.fans)} won the week`}</h3><p>${fmt(T.itt)} plays to ${fmt(T.riv)} · ${pc}%–${100 - pc}%${T.mine.plays ? ` · you played ${T.mine.plays}` : ''}.</p></div>${canClaim ? '<button type="button" class="sc-btn" data-act="claim">Collect 40 Claws</button>' : ''}</div>`
      : x.state === 'soon'
        ? `<div class="fz-hero"><div><h3>The fans' battle opens ${esc(DATE.format(x.opens))}</h3><p>The week before ${esc(x.rival.name)} come to Jeddah, every round you play counts for the Tigers. Opens in ${left(x.opens - now())}.</p></div></div>`
        : '';
    p.body.innerHTML = `${banner}
      <section class="fz-panel fz-dy__match">
        <div class="fz-dy__teams"><span>${crest('/teams/al-ittihad.png', 'ITT')}<b>Al-Ittihad</b></span><i>VS</i><span>${crest(m.crest, m.oppCode)}<b>${esc(m.opp)}</b></span></div>
        <p class="fz-dy__meta">${esc([m.compLabel, m.round].filter(Boolean).join(' · '))}<br/>${esc(when(m))}${m.venue && m.venue !== 'TBC' ? ` · ${esc(m.venue)}` : ' · venue TBC'}</p>
        <p class="fz-dy__clock">${x.state === 'over' ? 'Matchday' : `<small>${x.clock}</small><b class="js-dy-clock">${left(x.ko - now())}</b>`}</p>
      </section>
      <section class="fz-panel fz-dy__battle${x.state === 'soon' ? ' is-dim' : ''}">
        <h3>Fans' battle</h3>
        <div class="fz-vs"><p><b>${pc}%</b><span>Tigers fans · ${fmt(T.itt)} plays</span></p><p class="is-r"><b>${100 - pc}%</b><span>${esc(x.rival.fans)} · ${fmt(T.riv)} plays</span></p></div>
        ${meter(T.k, { cls: 'is-vs' })}
        <p class="fz-note">${x.state === 'live' ? `Every mini-game round you finish adds a play for the Tigers. Your plays: <b>${T.mine.plays}</b> (${fmt(T.mine.pts)} points). First play each day: +20 Claws; if the Tigers win the week, +40 more.` : x.state === 'soon' ? 'Opens a week before kick-off.' : `Your plays: ${T.mine.plays}.`}</p>
        <div class="fz-row">${x.state === 'live' && onPlay ? '<button type="button" class="sc-btn" data-act="play" data-g="penalties">Play penalties</button><button type="button" class="sc-btn is-ghost" data-act="play" data-g="freekick">Free kicks</button>' : ''}<button type="button" class="sc-btn is-ghost" data-act="card">Share matchday card</button></div>
      </section>`;
  };
  render();
  p.every(() => { const c = p.el.querySelector('.js-dy-clock'); if (c) c.textContent = left(d.ko - now()); }, 1000);
  p.every(render, 60000);
  p.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    feel.tap();
    if (b.dataset.act === 'play') { p.close({ silent: true }); onPlay?.(b.dataset.g); return; }
    if (b.dataset.act === 'card') { openShare({ kind: 'matchday', match: m, derby: d.rival.short }); return; }
    if (b.dataset.act === 'claim') { st.claimed.push(d.key); save(KEY, st); claws.earn(40, `${d.rival.short} · Tigers fans won the week`); feel.win(); p.toast('+40 Claws'); render(); }
  });
  return p;
}
