// Match centre (Ahmed, 2026-10-21: "book tickets should go to a match details page"; and for ended games: summary,
// score, statistics, key events, news, videos). One page for both: an upcoming fixture shows the overview, the
// ticket categories and possible line-ups, with "Choose your seats" into the 3D booking; a finished match (from
// results-data.js, researched and sourced) shows the score, scorers, stats, key events, news and highlight videos.
// Only facts from the data files are shown — nothing here is made up.
import './match.css';
import { TIERS } from '../../data.js';
import { feel } from './feel.js';
import { RESULTS } from './results-data.js';
import { CLUBS, PLAYERS } from './fantasy-data.js';
import { COMPS } from './fixtures.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HOME = '/teams/al-ittihad.png';
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>', home: '<path d="M3 11l9-7 9 7 M5 10v10h14V10"/>',
  cart: '<path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>',
  ball: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z"/>',
  card: '<path d="M8 4h8v16H8z"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

let root = null;
function mount() {
  stopLive?.(); stopLive = null;   // a live page being replaced stops its clock subscription
  root?.remove();
  root = document.createElement('div');
  root.className = 'mc'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Match centre');
  document.body.append(root);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') closeMatch(); }, { passive: true });
  requestAnimationFrame(() => root?.classList.add('is-on'));
  return root;
}
let onCloseCb = null;
export function closeMatch() { stopLive?.(); stopLive = null; if (!root) return; feel.back(); const r = root; root = null; r.classList.remove('is-on'); setTimeout(() => r.remove(), 250); onCloseCb?.(); onCloseCb = null; }

const header = (title) => `<header class="mc__hd"><button type="button" class="mc__ic" data-act="close" aria-label="Back">${svg('back')}</button><h2>${esc(title)}</h2></header>`;

/* ── upcoming (Ahmed, 2026-10-22: "too noisy, I want a more simple design. Make the key thumbnail a square on the left
   side and the other information on the right side"): the match's poster as a square key art (or the two crests on
   black when the fixture has none), and on the right one calm stack: competition, the match, when, where, the price,
   the ticket categories as a list, predict and line-ups as two quiet rows, and "Choose your seats" at the bottom. ── */
const MI = {
  cal: '<path d="M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4"/>',
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 1 1 13 0c0 4.8-6.5 11-6.5 11z M12 10m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0"/>',
  cup: '<path d="M7 4h10v5a5 5 0 0 1-10 0z M7 6H4v1a3 3 0 0 0 3 3 M17 6h3v1a3 3 0 0 1-3 3 M12 14v4 M8 20h8"/>',
  tix: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z M14 7v10"/>',
  ball: ICON.ball,
  go: '<path d="M9 5l7 7-7 7"/>',
  pitch: '<path d="M2.5 5.5h19v13h-19z M12 5.5v13 M12 12m-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0 M2.5 9h3v6h-3 M21.5 9h-3v6h3"/>',
};
const mi = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${MI[k]}</svg>`;
const metaRow = (icon, html) => `<li>${mi(icon)}<span>${html}</span></li>`;
export function openMatch(m, { dateLong = '', time = '', compLabel = '', onSeats, onPredict, onLineups, onCart, onHome, onClose } = {}) {
  onCloseCb = onClose || null;
  mount();
  root.classList.add('is-match');
  const cats = TIERS[m.slug] || [];
  const opp = m.opp || m.oppShort || '';
  const venue = m.venue && m.venue !== 'TBC' ? m.venue : '';
  const hasTime = time && time !== 'TBC';
  const art = m.poster
    ? `<figure class="mc__art"><img src="${esc(m.poster)}" alt="Matchday poster: Al Ittihad vs ${esc(opp)}"/></figure>`
    : `<figure class="mc__art is-crests" aria-label="Al Ittihad vs ${esc(opp)}"><div><img src="${HOME}" alt=""/><i>vs</i>${m.crest ? `<img src="${esc(m.crest)}" alt=""/>` : '<span class="mc__nocrest"></span>'}</div><figcaption>Al Ittihad <em>vs</em> ${esc(opp)}</figcaption></figure>`;
  const render = () => {
    const from = cats.length ? Math.min(...cats.map((c) => c.price)) : m.from;
    // (the same key as minigames.js's predict screen)
    const pred = (() => { try { return (JSON.parse(localStorage.getItem('itt-predict-v1')) || {})[m.slug || `${String(m.opp || 'match').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${m.kickoff || 'tbc'}`]; } catch { return null; } })();
    root.innerHTML = `${header('Match centre')}
      <div class="mc__wrap">
        ${art}
        <div class="mc__info">
          <div class="mc__scroll">
            <p class="mc__comp">${esc(compLabel)}${m.round ? ` · ${esc(m.round)}` : ''}</p>
            <h3 class="mc__title">Al Ittihad <em>vs</em> ${esc(opp)}</h3>
            <ul class="mc__meta">
              ${metaRow('cal', `${esc(dateLong)}${hasTime ? ` · <b>${esc(time)}</b>` : ' · <b>Kick-off TBC</b>'}${m.timeTBC ? '<small>Kick-off time to be confirmed by the league</small>' : ''}`)}
              ${metaRow('pin', esc(venue || 'Venue to be confirmed'))}
              ${metaRow('tix', m.onSale ? `Tickets ${from != null ? `from <b>SAR ${from}</b>` : 'on sale'}` : 'Tickets not on sale yet')}
            </ul>
            <p class="mc__sk">Ticket categories</p>
            ${cats.length ? `<ul class="mc__list">${cats.map((c) => `<li><i style="background:${esc(c.color)}"></i><b>${esc(c.name)}</b><span>SAR ${c.price.toLocaleString('en')}</span></li>`).join('')}</ul>
              <p class="mc__fine">${m.demo ? '' : 'Prices from the official ticketing feed. '}Pick a category in the 3D stadium, then your exact seat.</p>`
              : `<p class="mc__empty">${m.onSale ? 'Choose your seat in the 3D stadium to see the prices.' : 'Tickets for this match aren\'t on sale yet.'}</p>`}
            <div class="mc__rows">
              ${onPredict ? `<button type="button" class="mc__row" data-act="predict">${mi('ball')}<span><b>Predict the score</b><em>${pred ? `Your prediction: ${esc(pred.home)} - ${esc(pred.away)} · change it` : 'Call it before kick-off · +40 XP'}</em></span>${mi('go')}</button>` : ''}
              <button type="button" class="mc__row" data-act="lineups">${mi('pitch')}<span><b>See possible line-ups</b><em>Picked by position from the current squads, not the coaches' choices</em></span>${mi('go')}</button>
            </div>
          </div>
          <div class="mc__cta">${m.onSale ? `<button type="button" class="mc__btn" data-act="seats">Choose your seats${from != null ? ` · from SAR ${from}` : ''}</button>` : '<button type="button" class="mc__btn" disabled>Not on sale yet</button>'}</div>
        </div>
      </div>`;
  };
  root.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return closeMatch();
    feel.tap();
    if (a === 'seats') { const cb = onSeats; onCloseCb = null; closeMatch(); cb?.(); return; }
    if (a === 'lineups') return onLineups?.();
    if (a === 'predict') { const cb = onPredict; onCloseCb = null; closeMatch(); return cb?.(); }   // the game opens in its place, and brings it back
    if (a === 'cart') return onCart?.();
    if (a === 'home') { onCloseCb = null; closeMatch(); return onHome?.(); }
  };
  render();
}

/* ── finished: score · summary · stats · key events · news · videos ── */
const STAT_LABEL = { possession: 'Possession', shots: 'Shots', onTarget: 'Shots on target', corners: 'Corners', fouls: 'Fouls', passAcc: 'Pass accuracy' };
export function openResult(r, { compLabel = '', homeCrest = '', awayCrest = '', onCart, onHome, onClose } = {}) {
  onCloseCb = onClose || null;
  mount();
  const tabs = [['summary', 'Summary'], r.stats && ['stats', 'Stats'], r.events?.length && ['events', 'Key events'], r.news?.length && ['news', 'News'], r.videos?.length && ['videos', 'Videos']].filter(Boolean);
  let tab = 'summary', playing = null;
  const isHome = (side) => /ittihad/i.test(r[side].name);
  const crest = (side) => (side === 'home' ? homeCrest : awayCrest);   // the caller passes each side's crest
  const scorers = (side) => (r.scorers || []).filter((s) => s.team === side).map((s) => `<li>${esc(s.name)} <em>${esc(s.minute)}'${s.note ? ` (${esc(s.note)})` : ''}</em></li>`).join('');
  const render = () => {
    root.innerHTML = `${header('Match centre')}
      <section class="mc__hero is-result">
        <p class="mc__comp">${esc(compLabel)}${r.round ? ` · ${esc(r.round)}` : ''} · Full time</p>
        <div class="mc__vs"><div class="mc__team">${crest('home') ? `<img src="${esc(crest('home'))}" alt=""/>` : '<span class="mc__nocrest"></span>'}<b>${esc(r.home.name)}</b><ul class="mc__sc">${scorers('home')}</ul></div>
          <div class="mc__mid"><p class="mc__score">${r.home.score}<i>–</i>${r.away.score}</p>${r.pens ? `<p class="mc__pens">(${r.pens.home} – ${r.pens.away} pens)</p>` : ''}<p class="mc__date">${esc(r.date)}</p></div>
          <div class="mc__team">${crest('away') ? `<img src="${esc(crest('away'))}" alt=""/>` : '<span class="mc__nocrest"></span>'}<b>${esc(r.away.name)}</b><ul class="mc__sc">${scorers('away')}</ul></div></div>
        <p class="mc__venue">${esc(r.venue || '')}${r.attendance ? ` · ${Number(r.attendance).toLocaleString('en')} fans` : ''}</p>
      </section>
      <nav class="mc__tabs">${tabs.map(([k, l]) => `<button type="button" class="${tab === k ? 'is-on' : ''}" data-act="tab" data-k="${k}">${l}</button>`).join('')}</nav>
      <section class="mc__body">${
        tab === 'summary' ? `<p class="mc__sum">${esc(r.summary || '')}</p>`
        : tab === 'stats' ? `<ul class="mc__stats">${Object.entries(r.stats).filter(([, v]) => Array.isArray(v)).map(([k, [h, a]]) => { const t = (+h + +a) || 1, pct = k === 'possession' || k === 'passAcc'; return `<li><b>${h}${pct ? '%' : ''}</b><span>${STAT_LABEL[k] || k}</span><b>${a}${pct ? '%' : ''}</b><i><s style="width:${pct ? h : (h / t) * 100}%"></s></i><i class="is-a"><s style="width:${pct ? a : (a / t) * 100}%"></s></i></li>`; }).join('')}</ul>${r.statsSource ? `<p class="mc__fine">Source: <a href="${esc(r.statsSource)}" target="_blank" rel="noopener">${esc(new URL(r.statsSource).hostname)}</a></p>` : ''}`
        : tab === 'events' ? `<ol class="mc__ev">${r.events.map((ev) => `<li><b>${esc(ev.minute)}'</b><span>${esc(ev.text)}</span></li>`).join('')}</ol>${r.eventsSource ? `<p class="mc__fine">From the match report: <a href="${esc(r.eventsSource)}" target="_blank" rel="noopener">${esc(new URL(r.eventsSource).hostname)}</a></p>` : ''}`
        : tab === 'news' ? `<ul class="mc__news">${r.news.map((n) => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener"><b>${esc(n.title)}</b><span>${esc(n.outlet)} ↗</span></a></li>`).join('')}</ul>`
        : `<div class="mc__vids">${playing ? `<div class="mc__player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(playing)}?autoplay=1&rel=0" title="Highlights" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><button type="button" class="mc__btn is-2" data-act="stopvid">Close video</button></div>` : ''}
            ${r.videos.map((v) => `<button type="button" class="mc__vid" data-act="vid" data-id="${esc(v.id)}"><img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt=""/><b dir="auto">${esc(v.title)}</b><span>${esc(v.channel)}</span></button>`).join('')}</div>`
      }</section>`;
  };
  root.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return closeMatch();
    feel.tap();
    if (a === 'tab') { tab = b.dataset.k; playing = null; return render(); }
    if (a === 'vid') { playing = b.dataset.id; return render(); }
    if (a === 'stopvid') { playing = null; return render(); }
    if (a === 'cart') return onCart?.();
    if (a === 'home') { onCloseCb = null; closeMatch(); return onHome?.(); }
  };
  render();
}

/* ── the season pass, its own page (Ahmed, 2026-10-22: "a dedicated page, not moving to the stadium until the user
   selects a category"; then the match centre's simple layout): the pass's square key art on the left; on the right
   the title, what it covers, its six ticket types as a pick list (cheapest first) and "Choose your seats" once one is
   picked, into the 3D seat map with that category lit. Prices and types from the Webook pass page (TIERS). ── */
export function openSeason(pass, { season, onSeats, onClose } = {}) {
  onCloseCb = onClose || null;
  mount();
  root.classList.add('is-match', 'is-pass');
  root.setAttribute('aria-label', 'Season pass');
  const cats = (TIERS[pass.slug] || []).slice().sort((a, b) => a.price - b.price);
  let pick = null;
  const render = () => {
    const c = cats.find((x) => x.name === pick);
    root.innerHTML = `${header('Season pass')}
      <div class="mc__wrap">
        <figure class="mc__art"><img src="/img/season-pass.png" alt="${esc(season.title)} ${esc(season.season)}"/></figure>
        <div class="mc__info">
          <div class="mc__scroll">
            <p class="mc__comp">Al-Ittihad · Season ${esc(season.season)}</p>
            <h3 class="mc__title">${esc(season.title)} <em>${esc(season.season)}</em></h3>
            <p class="mc__lede">One seat for every home match${cats.length ? ` · from <b>SAR ${cats[0].price.toLocaleString('en')}</b>` : ''}</p>
            <ul class="mc__meta">
              ${metaRow('cup', season.comps.map(esc).join(' · '))}
              ${metaRow('pin', season.venues.map(esc).join(' and '))}
              ${season.fixtures?.length ? metaRow('ball', `Home matches it covers so far: ${season.fixtures.map(esc).join(', ')}`) : ''}
            </ul>
            <p class="mc__sk">Choose a category</p>
            <ul class="mc__list is-pick">${cats.map((x) => `<li><button type="button" class="${x.name === pick ? 'is-on' : ''}" data-act="cat" data-k="${esc(x.name)}" aria-pressed="${x.name === pick}"><i style="background:${esc(x.color)}"></i><b>${esc(x.name)}</b><span>SAR ${x.price.toLocaleString('en')}</span><s aria-hidden="true"></s></button></li>`).join('')}</ul>
            <p class="mc__fine">Prices include VAT, from the Webook season pass page. Pick a category to see where it sits in the stadium.</p>
          </div>
          <div class="mc__cta">${c ? `<button type="button" class="mc__btn" data-act="seats">Choose your seats · ${esc(c.name)} · SAR ${c.price.toLocaleString('en')}</button>` : '<button type="button" class="mc__btn" disabled>Pick a category</button>'}</div>
        </div>
      </div>`;
  };
  root.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return closeMatch();
    feel.tap();
    if (a === 'cat') {   // re-render in place, keeping the scroll
      const sc = () => [root.querySelector('.mc__scroll'), root.querySelector('.mc__wrap')], y = sc().map((el) => el?.scrollTop || 0);
      pick = b.dataset.k; render(); sc().forEach((el, i) => { if (el) el.scrollTop = y[i]; }); return;
    }
    if (a === 'seats') { const cat = cats.find((x) => x.name === pick), cb = onSeats; onCloseCb = null; closeMatch(); cb?.(cat); }
  };
  render();
}

/* ── live match (Ahmed, 2026-10-26: "add a live match to the matches list; the user can see the stats and the
   commentary and everything else"). There is no live feed, so the most recent finished match in results-data.js
   that has events and stats is replayed minute by minute, as if it were live: one match minute every 1.5 s, a short
   pause at half-time, FT at the end. Everything shown comes from that result — its events, scorers, cards, stats,
   news and videos; nothing is added. One shared clock drives the menu's live row, the Tickets card and the page, so
   they always agree. It starts when the app loads; after full time it holds FT for a minute, then kicks off again. ── */
export const LIVE = RESULTS.filter((r) => r.events?.length && r.stats).sort((a, b) => (b.kickoffUTC || b.date).localeCompare(a.kickoffUTC || a.date))[0] || null;
const LIVE_CREST = '/teams/al-ittihad.png';
// each side's crest, the way the result pages pick it (club-info.js crestOf / logoOf)
const logoOf = (slug) => CLUBS.find((c) => c.slug === slug)?.logo || '';
const crestOf = (t) => (/ittihad/i.test(t.name) ? LIVE_CREST : logoOf(t.slug));
export const liveOpts = (r = LIVE) => ({ compLabel: COMPS[r.comp]?.label || r.comp, homeCrest: crestOf(r.home), awayCrest: crestOf(r.away) });

const TICK = 1500, HT_TICKS = 4, FT_HOLD = 40;   // ms per match minute · half-time pause (6 s) · FT shown for 60 s before the replay restarts
const parseMin = (m) => { const [b, a] = String(m).split('+'); return { base: parseInt(b, 10) || 0, add: parseInt(a, 10) || 0 }; };
const clocks = new Map();
/** The shared replay clock for a result: the slots (one per match minute, the HT pause, FT), the state now, seek, on. */
export function liveClock(r = LIVE) {
  if (clocks.has(r.id)) return clocks.get(r.id);
  // stoppage time only as far as the data reaches (the latest 45+x / 90+x event); extra time if a minute passes 90
  const mins = [...(r.events || []), ...(r.scorers || []), ...(r.cards || [])].map((e) => parseMin(e.minute));
  const end = Math.max(90, ...mins.map((m) => m.base));
  const s1 = Math.max(0, ...mins.filter((m) => m.base === 45).map((m) => m.add)), s2 = Math.max(0, ...mins.filter((m) => m.base === end).map((m) => m.add));
  const slots = [];
  for (let b = 1; b <= 45; b++) slots.push({ h: 1, base: b, add: 0 });
  for (let a = 1; a <= s1; a++) slots.push({ h: 1, base: 45, add: a });
  const ht = slots.length;
  for (let i = 0; i < HT_TICKS; i++) slots.push({ ht: true });
  const h2 = slots.length;
  for (let b = 46; b <= end; b++) slots.push({ h: 2, base: b, add: 0 });
  for (let a = 1; a <= s2; a++) slots.push({ h: 2, base: end, add: a });
  const ft = slots.length, play = ft - HT_TICKS, cycle = ft + FT_HOLD;
  // the slot a data minute falls in ("45+2" → first-half stoppage, "46" → the second half)
  const slotOf = (minute) => { const m = parseMin(minute); return m.base <= 45 ? m.base - 1 + (m.base === 45 ? Math.min(m.add, s1) : 0) : h2 + m.base - 46 + (m.base === end ? Math.min(m.add, s2) : 0); };
  const goals = (r.scorers || []).map((s) => ({ ...s, k: slotOf(s.minute) }));
  // match minutes played by slot k, for the stats (the HT pause doesn't count)
  const playedAt = (k) => (k < ht ? k + 1 : k < h2 ? ht : k < ft ? ht + k - h2 + 1 : play) / play;
  const label = (k) => { const s = slots[k]; return k >= ft ? 'FT' : s.ht ? 'HT' : `${s.base}${s.add ? `+${s.add}` : ''}'`; };
  const pos = (k) => Math.min(1, (k >= h2 ? k - HT_TICKS : Math.min(k, ht)) / play);   // 0 → 1 along the match, the pause left out
  const qs = new URLSearchParams(location.search).get('livemin');   // debug: ?livemin=63 starts the replay there
  let t0 = performance.now() - (qs ? Math.max(0, slotOf(qs)) : 0) * TICK;
  const kNow = () => Math.floor((performance.now() - t0) / TICK) % cycle;
  const at = (k) => {
    const done = k >= ft, sc = { home: 0, away: 0 };
    if (done) { sc.home = r.home.score; sc.away = r.away.score; } else goals.forEach((g) => { if (g.k <= k) sc[g.team]++; });
    return { k, label: label(k), phase: done ? 'ft' : slots[k].ht ? 'ht' : 'live', played: playedAt(k), pos: done ? 1 : pos(k), score: sc };
  };
  const subs = new Set();
  let timer = 0, last = -1;
  const tick = () => { const k = kNow(); if (k === last) return; last = k; const s = at(k); subs.forEach((f) => f(s)); };
  const c = {
    r, slots, ht, h2, ft, slotOf, pos, at,
    now: () => at(kNow()),
    // seek to a minute ("63", "45+2", "HT", "FT") — the debug hook, and the restart when the page opens after FT
    seek(minute) { const k = minute === 'FT' ? ft : minute === 'HT' ? ht : Math.max(0, slotOf(minute)); t0 = performance.now() - k * TICK - 1; last = -1; tick(); },
    on(f) { subs.add(f); if (!timer) timer = setInterval(tick, 200); return () => { subs.delete(f); if (!subs.size) { clearInterval(timer); timer = 0; } }; },
  };
  clocks.set(r.id, c);
  return c;
}
// the clock starts with the app (Ahmed: the minute keeps moving), so the menu, Tickets and the page all join it in play
if (LIVE) { liveClock(LIVE); window.__live = { seek: (m) => liveClock(LIVE).seek(String(m)), now: () => liveClock(LIVE).now() }; }

// the commentary: one line per real item in the data — the event texts (goals matched to their scorer, cards to
// their card), any scorer or card the texts don't mention, the substitutions from the line-ups, and the whistles
// (kick-off, half-time, full time)
const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '');
const lastNorm = (n) => norm(n).trim().split(' ').pop();
// the same player under two spellings ("Abdoulaye Kanté" in the cards, "Abdoulaye Kanté" on the team sheet, or only
// the surname matching): the line-ups and the scorers / cards come from different ESPN pages
const samePlayer = (a, b) => norm(a).trim() === norm(b).trim() || lastNorm(a) === lastNorm(b);
// the name under a shirt: the surname, keeping its particle ("Al Mosa", not "Mosa")
const shortName = (n) => { const w = String(n).split(' ').filter(Boolean); return w.length < 2 ? String(n) : /^(al|el|bin|ben|abu|de|da|van|von)$/i.test(w[w.length - 2]) ? w.slice(-2).join(' ') : w[w.length - 1]; };
// the line-ups' substitutions, both teams, in minute order; the player going off named from the starting rows (or an
// earlier sub, if a substitute is himself taken off)
function luSubs(r) {
  const out = [];
  ['home', 'away'].forEach((side) => {
    const L = r.lineups?.[side]; if (!L) return;
    const known = new Map(L.rows.flat().map(([no, name]) => [no, name]));
    (L.subs || []).slice().sort((a, b) => a[0] - b[0]).forEach(([min, [onNo, onName], offNo]) => {
      out.push({ side, minute: String(min), on: { no: onNo, name: onName }, off: { no: offNo, name: known.get(offNo) || `No. ${offNo}` } });
      known.set(onNo, onName);
    });
  });
  return out.sort((a, b) => parseInt(a.minute, 10) - parseInt(b.minute, 10));
}
function liveFeed(r, c) {
  // which side an event text is about: the first team or player it names (the two squads from fantasy-data.js, plus
  // the result's own scorers and cards); none found → no side
  const toks = [];
  ['home', 'away'].forEach((side) => {
    const t = r[side], ci = CLUBS.findIndex((x) => x.slug === t.slug);
    toks.push([norm(t.name).replace(/^al /, '').trim(), side]);
    if (ci >= 0) PLAYERS.forEach((p) => { if (p[0] === ci) toks.push([norm(String(p[2]).split(' ').pop()), side]); });
  });
  [...(r.scorers || []), ...(r.cards || [])].forEach((x) => toks.push([norm(String(x.name).split(' ').pop()), x.team]));
  const sideOf = (text) => { const t = norm(text); let best = null, at = Infinity; toks.forEach(([w, s]) => { if (w.length < 4) return; const i = t.indexOf(w); if (i >= 0 && i < at) { at = i; best = s; } }); return best; };
  const usedS = new Set(), usedC = new Set(), items = [];
  (r.events || []).forEach((ev) => {
    const sc = (r.scorers || []).find((s) => s.minute === ev.minute && !usedS.has(s));
    if (sc) { usedS.add(sc); return items.push({ kind: 'goal', minute: ev.minute, side: sc.team, who: sc.name, note: sc.note, text: ev.text }); }
    const cd = /yellow|booked|red card|sent off|caution/i.test(ev.text) && (r.cards || []).find((x) => x.minute === ev.minute && !usedC.has(x));
    if (cd) { usedC.add(cd); return items.push({ kind: cd.type === 'red' ? 'red' : 'yellow', minute: ev.minute, side: cd.team, who: cd.name, text: ev.text }); }
    const kind = /comes on|replac|substitut|\bon for\b/i.test(ev.text) ? 'sub' : /\bvar\b|penalty|ruled out|offside/i.test(ev.text) ? 'var' : 'chance';
    items.push({ kind, minute: ev.minute, side: sideOf(ev.text), text: ev.text });
  });
  (r.scorers || []).forEach((s) => { if (!usedS.has(s)) items.push({ kind: 'goal', minute: s.minute, side: s.team, who: s.name, note: s.note, text: '' }); });
  (r.cards || []).forEach((x) => { if (!usedC.has(x)) items.push({ kind: x.type === 'red' ? 'red' : 'yellow', minute: x.minute, side: x.team, who: x.name, text: '' }); });
  // every substitution on the team sheet as "↑ On · ↓ Off" at its minute (Ahmed, 2026-10-26, with the line-ups); a
  // report line that already tells it (73' "En-Nesyri comes on for Ilenikhena") takes the names rather than doubling
  luSubs(r).forEach((s) => {
    const ev = items.find((it) => it.kind === 'sub' && !it.on && String(it.minute) === s.minute && norm(it.text).includes(lastNorm(s.on.name)));
    if (ev) Object.assign(ev, { side: s.side, on: s.on, off: s.off });
    else items.push({ kind: 'sub', minute: s.minute, side: s.side, on: s.on, off: s.off, text: '' });
  });
  items.forEach((it) => { it.k = c.slotOf(it.minute); it.label = `${it.minute}'`; });
  items.push({ kind: 'whistle', k: 0, label: "1'", head: 'Kick-off', text: r.venue || '' }, { kind: 'whistle', k: c.ht, label: 'HT', head: 'Half-time', text: '' },
    { kind: 'whistle', k: c.h2, label: "46'", head: 'Second half', text: '' }, { kind: 'whistle', k: c.ft, label: 'FT', head: 'Full time', text: '' });
  items.sort((a, b) => a.k - b.k || (b.kind === 'whistle') - (a.kind === 'whistle'));   // a whistle opens its minute
  // the score after each goal, and at the whistles
  const sc = { home: 0, away: 0 };
  items.forEach((it) => { if (it.kind === 'goal') sc[it.side]++; if (it.kind === 'goal' || it.kind === 'whistle') it.score = it.k >= c.ft ? { home: r.home.score, away: r.away.score } : { ...sc }; });
  return items;
}

const LV_ICON = {
  goal: ICON.ball,
  yellow: '<path d="M8 4h8v16H8z"/>', red: '<path d="M8 4h8v16H8z"/>',
  sub: '<path d="M7 4v13 M3.5 13.5L7 17l3.5-3.5 M17 20V7 M13.5 10.5L17 7l3.5 3.5"/>',
  chance: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 12m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0"/>',
  var: '<path d="M3 5h18v12H3z M8 21h8 M12 17v4"/>',
  whistle: '<path d="M14 9h7v4h-4.2A6 6 0 1 1 11 7h3z M8 13h.01"/>',
};
const lvIcon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${LV_ICON[k] || LV_ICON.chance}</svg>`;
// the line-ups' small marks: on (green, up) and off (red, down)
const LU_UP = '<svg class="lu-ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5 M5.5 11.5L12 5l6.5 6.5"/></svg>';
const LU_DN = '<svg class="lu-ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15 M5.5 12.5L12 19l6.5-6.5"/></svg>';
const LV_STATS = [['possession', 'Possession', true], ['shots', 'Shots'], ['onTarget', 'Shots on target'], ['corners', 'Corners'], ['fouls', 'Fouls'], ['passAcc', 'Pass accuracy', true]];
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let stopLive = null;

export function openLive(r = LIVE, { compLabel = '', homeCrest = '', awayCrest = '', onClose } = {}) {
  if (!r) return;
  onCloseCb = onClose || null;
  mount();
  root.classList.add('is-live');
  root.setAttribute('aria-label', 'Live match');
  const c = liveClock(r);
  if (c.now().phase === 'ft') c.seek('1');   // opened after the final whistle: the replay kicks off again
  const items = liveFeed(r, c);
  const crest = (side) => (side === 'home' ? homeCrest : awayCrest);
  const media = (r.news?.length || 0) + (r.videos?.length || 0);
  const tabs = [['feed', 'Commentary'], r.lineups && ['lu', 'Line-ups'], ['stats', 'Stats'], ['line', 'Timeline'], media && ['media', 'News & videos']].filter(Boolean);
  let tab = 'feed', playing = null, st = c.now(), fed = 0, frozen = false, mediaFT = null, luKey = '', luSeen = new Map();
  const teamOf = (side) => (side ? r[side].name : '');
  const host = (cls) => root.querySelector(cls);
  const crestImg = (side, cls = '') => (crest(side) ? `<img class="${cls}" src="${esc(crest(side))}" alt=""/>` : `<span class="mc__nocrest ${cls}"></span>`);
  const scorers = (side) => (r.scorers || []).filter((s) => s.team === side && c.slotOf(s.minute) <= st.k).map((s) => `<li>${esc(s.name.split(' ').pop())} <em>${esc(s.minute)}'${s.note ? ` (${esc(s.note)})` : ''}</em></li>`).join('');

  const feedLi = (it, isNew) => {
    const team = it.side ? `<span class="lv-c__tm">${esc(teamOf(it.side))}</span>` : '';
    const head = it.kind === 'goal' ? `<p class="lv-c__goal">Goal <em>${it.score.home} – ${it.score.away}</em></p><p class="lv-c__who">${esc(it.who)}${it.note ? ` (${esc(it.note)})` : ''} · ${esc(teamOf(it.side))}</p>`
      : it.kind === 'whistle' ? `<p class="lv-c__k">${esc(it.head)}${it.score && it.k ? ` · ${it.score.home} – ${it.score.away}` : ''}</p>`
      : it.kind === 'yellow' || it.kind === 'red' ? `<p class="lv-c__k">${it.kind === 'red' ? 'Red' : 'Yellow'} card · ${esc(it.who)}</p>`
      : it.kind === 'sub' ? `<p class="lv-c__k">Substitution</p>${it.on ? `<p class="lv-c__sub"><span class="is-on">${LU_UP}${esc(it.on.name)}</span><i>·</i><span class="is-off">${LU_DN}${esc(it.off.name)}</span></p>` : ''}` : it.kind === 'var' ? '<p class="lv-c__k">VAR</p>' : '';
    return `<li class="lv-c is-${it.kind}${it.side ? ` is-${it.side}${/ittihad/i.test(teamOf(it.side)) ? ' is-us' : ''}` : ''}${isNew ? ' is-new' : ''}"><b class="lv-c__m">${esc(it.label)}</b><span class="lv-c__ic">${lvIcon(it.kind)}</span>
      <div class="lv-c__tx">${head}${it.text ? `<p>${esc(it.text)}</p>` : ''}${it.kind !== 'goal' ? team : ''}</div>${it.side ? crestImg(it.side, 'lv-c__cr') : ''}</li>`;
  };
  // stats: the counts grow toward the real final figures with the minutes played; possession and pass accuracy are
  // percentages, so they show the real final split (eased in by the bars); cards are counted exactly from the data
  const statRows = () => {
    const rows = LV_STATS.filter(([k]) => Array.isArray(r.stats?.[k])).map(([k, l, pct]) => {
      const [h, a] = r.stats[k];
      if (pct) return { k, l, h, a, pct };
      let vh = Math.round(h * st.played), va = Math.round(a * st.played);
      if (k === 'onTarget' || k === 'shots') { vh = Math.max(vh, st.score.home); va = Math.max(va, st.score.away); }   // never fewer than the goals already in
      return { k, l, h: vh, a: va };
    });
    if (r.cards?.length) {
      const n = (side, type) => r.cards.filter((x) => x.team === side && x.type === type && c.slotOf(x.minute) <= st.k).length;
      rows.push({ k: 'yellow', l: 'Yellow cards', h: n('home', 'yellow'), a: n('away', 'yellow') });
      if (r.cards.some((x) => x.type === 'red')) rows.push({ k: 'red', l: 'Red cards', h: n('home', 'red'), a: n('away', 'red') });
    }
    // with onTarget clamped up to the goals, shots must stay at least on target
    const sh = rows.find((x) => x.k === 'shots'), ot = rows.find((x) => x.k === 'onTarget');
    if (sh && ot) { sh.h = Math.max(sh.h, ot.h); sh.a = Math.max(sh.a, ot.a); }
    return rows;
  };
  const widths = (x) => { const t = x.pct ? 100 : (x.h + x.a) || 1; return [(x.h / t) * 100, (x.a / t) * 100]; };
  const syncStats = (first) => {
    const ul = host('.js-lv-stats'); if (!ul) return;
    statRows().forEach((x) => {
      let li = ul.querySelector(`[data-k="${x.k}"]`);
      if (!li) { ul.insertAdjacentHTML('beforeend', `<li data-k="${x.k}"><b></b><span>${esc(x.l)}</span><b></b><i><s></s></i><i class="is-a"><s></s></i></li>`); li = ul.lastElementChild; }
      const [bh, ba] = li.querySelectorAll('b'), [sh, sa] = li.querySelectorAll('s'), [wh, wa] = widths(x);
      bh.textContent = `${x.h}${x.pct ? '%' : ''}`; ba.textContent = `${x.a}${x.pct ? '%' : ''}`;
      if (first) { sh.style.width = sa.style.width = x.pct ? '50%' : '0%'; }
      const set = () => { sh.style.width = `${wh}%`; sa.style.width = `${wa}%`; };
      if (first && !reducedMotion()) requestAnimationFrame(() => requestAnimationFrame(set)); else set();
    });
  };
  // the timeline: 0' → FT, goals and cards as markers (home above the line, away below), stacked when close together
  const syncLine = () => {
    const tr = host('.js-lv-track'); if (!tr) return;
    tr.querySelector('.lv-tl__fill').style.width = `${st.pos * 100}%`;
    const keys = items.filter((it) => (it.kind === 'goal' || it.kind === 'yellow' || it.kind === 'red') && it.k <= st.k);
    const lanes = { home: [], away: [] };
    tr.querySelectorAll('.lv-tl__mk').forEach((m) => m.remove());
    tr.insertAdjacentHTML('beforeend', keys.map((it) => {
      const x = c.pos(it.k) * 100, L = lanes[it.side];
      let lane = L.findIndex((lx) => x - lx >= 5); if (lane < 0) lane = L.length; L[Math.min(lane, 2)] = x;
      return `<span class="lv-tl__mk is-${it.kind} is-${it.side}" style="left:${x}%;--lane:${Math.min(lane, 2)}" title="${esc(`${it.label} ${it.kind === 'goal' ? 'Goal' : `${it.kind === 'red' ? 'Red' : 'Yellow'} card`}: ${it.who} (${teamOf(it.side)})`)}"><i>${lvIcon(it.kind)}</i><b>${esc(it.label)}</b></span>`;
    }).join(''));
    // room above and below the line for as many lanes as are in use, so no marker is cut off by the scroller
    tr.parentElement.style.setProperty('--up', Math.min(lanes.home.length, 3)); tr.parentElement.style.setProperty('--dn', Math.min(lanes.away.length, 3));
    const ol = host('.js-lv-keys');
    if (ol) ol.innerHTML = keys.length ? keys.slice().reverse().map((it) => `<li class="is-${it.kind}"><b>${esc(it.label)}</b><span class="lv-c__ic">${lvIcon(it.kind)}</span><span>${esc(it.who)}${it.note ? ` (${esc(it.note)})` : ''}</span>${crestImg(it.side, 'lv-c__cr')}</li>`).join('') : '<li class="is-none">No goals or cards yet</li>';
  };
  const syncFeed = (first) => {
    const ol = host('.js-lv-feed'); if (!ol) return;
    const n = items.filter((it) => it.k <= st.k).length;
    if (first) { ol.innerHTML = items.slice(0, n).reverse().map((it) => feedLi(it, false)).join(''); fed = n; return; }
    if (n < fed) { fed = 0; ol.innerHTML = ''; }
    const anim = !reducedMotion();
    for (; fed < n; fed++) ol.insertAdjacentHTML('afterbegin', feedLi(items[fed], anim));
  };
  // line-ups (Ahmed, 2026-10-26: "in the live match show the formation and line-up"): ESPN's formations on one pitch,
  // home at the left end, away at the right (stood up on an upright phone, home on top). As the replay passes a
  // substitution the incoming player takes the outgoing one's spot (green ↑ and the minute on the shirt, the player
  // he replaced in red ↓ under the name); scorers so far get a ball, booked players a card.
  const luAll = r.lineups ? luSubs(r).map((s) => ({ ...s, k: c.slotOf(s.minute) })) : [];
  const isUs = (side) => /ittihad/i.test(r[side].name);
  const luSide = (side) => {
    const L = r.lineups[side];
    const rows = L.rows.map((row) => row.map(([no, name]) => ({ no, name, sub: null })));
    const spots = rows.flat();
    luAll.forEach((s) => { if (s.side !== side || s.k > st.k) return; const sp = spots.find((x) => x.no === s.off.no); if (sp) Object.assign(sp, { no: s.on.no, name: s.on.name, sub: s }); });
    // the bench as it stands: the substitutes still to come on (in the order they will), then the unused ones; a player
    // leaves it when he comes on (he is then on the pitch and in the substitutions), which keeps the panel to one screen
    const reserves = [...luAll.filter((s) => s.side === side && s.k > st.k).map((s) => ({ no: s.on.no, name: s.on.name })), ...(L.bench || []).map(([no, name]) => ({ no, name }))];
    return { L, rows, reserves };
  };
  const luMarks = (side, name) => {
    const g = (r.scorers || []).filter((x) => x.team === side && c.slotOf(x.minute) <= st.k && samePlayer(x.name, name));
    const cd = (r.cards || []).filter((x) => x.team === side && c.slotOf(x.minute) <= st.k && samePlayer(x.name, name));
    return { g, cd, html: g.map(() => `<i class="lu-ball">${svg('ball')}</i>`).join('') + cd.map((x) => `<i class="lu-card is-${x.type === 'red' ? 'red' : 'yellow'}"></i>`).join('') };
  };
  const luMan = (side, p, id) => {
    const m = luMarks(side, p.name), seen = `${p.no}:${m.g.length}:${m.cd.length}`;
    // a spot that changed since the last paint (a sub came on, a goal, a card) pops once
    const fresh = luSeen.has(id) && luSeen.get(id) !== seen && !reducedMotion(); luSeen.set(id, seen);
    const lbl = [`${p.no} ${p.name}`, ...m.g.map((x) => `goal ${x.minute}'`), ...m.cd.map((x) => `${x.type} card ${x.minute}'`), p.sub && `on ${p.sub.minute}' for ${p.sub.off.name}`].filter(Boolean).join(', ');
    return `<li class="lu-p${fresh ? ' is-new' : ''}" aria-label="${esc(lbl)}"><span class="lu-p__t" aria-hidden="true"><b>${p.no}</b>${p.sub ? `<em class="lu-up">${LU_UP}${esc(p.sub.minute)}'</em>` : ''}${m.html ? `<span class="lu-p__mk">${m.html}</span>` : ''}</span>
      <span class="lu-p__n" aria-hidden="true">${esc(shortName(p.name))}</span>${p.sub ? `<span class="lu-dn" aria-hidden="true">${LU_DN}${esc(shortName(p.sub.off.name))}</span>` : ''}</li>`;
  };
  const syncLu = (first) => {
    const el = host('.js-lv-lu'); if (!el) return;
    // repaint only when something on the sheet changed — a sub, a goal or a card — so the pitch doesn't flicker each minute
    const key = [luAll.filter((s) => s.k <= st.k).length, ...[r.scorers, r.cards].map((l) => (l || []).filter((x) => c.slotOf(x.minute) <= st.k).length)].join('|');
    if (!first && key === luKey) return;
    luKey = key;
    if (first) luSeen = new Map();
    const S = { home: luSide('home'), away: luSide('away') };
    // the home side's columns run goalkeeper → forwards from its end; the away side's forwards → goalkeeper
    const half = (side) => { const cols = side === 'home' ? S[side].rows.slice().reverse() : S[side].rows; return `<div class="lu-half is-${side}${isUs(side) ? ' is-us' : ''}">${cols.map((row, ci) => `<ul class="lu-col">${row.map((p, pi) => luMan(side, p, `${side}${ci}-${pi}`)).join('')}</ul>`).join('')}</div>`; };
    const tm = (side) => `<p class="lu-tm is-${side}${isUs(side) ? ' is-us' : ''}">${side === 'away' ? `<em>${esc(S[side].L.formation)}</em>` : ''}${crestImg(side)}<b>${esc(r[side].name)}</b>${side === 'home' ? `<em>${esc(S[side].L.formation)}</em>` : ''}</p>`;
    const done = luAll.filter((s) => s.k <= st.k).reverse();
    const subTxt = (side, p) => { const m = luMarks(side, p.name); return `${esc(shortName(p.name))}${m.html}`; };
    const sideY = el.querySelector('.lu-side')?.scrollTop || 0;   // the benches keep their scroll through a repaint
    el.innerHTML = `${tm('home')}
      <div class="lu-pitch" role="group" aria-label="${esc(`${r.home.name} ${S.home.L.formation} against ${r.away.name} ${S.away.L.formation}`)}">
        <i class="lu-l is-half"></i><i class="lu-l is-circle"></i><i class="lu-l is-spot"></i><i class="lu-l is-box is-a"></i><i class="lu-l is-box is-b"></i><i class="lu-l is-six is-a"></i><i class="lu-l is-six is-b"></i>
        ${half('home')}${half('away')}
      </div>${tm('away')}
      <aside class="lu-side">
        <section class="lu-blk"><p class="lu-h">Bench</p><div class="lu-bench">${['home', 'away'].map((side) => `<div class="${isUs(side) ? 'is-us' : ''}"><p class="lu-bt">${crestImg(side)}${esc(r[side].name)}</p>
          <ul>${S[side].reserves.map((p) => `<li><b>${p.no}</b><span>${esc(shortName(p.name))}</span></li>`).join('')}</ul></div>`).join('')}</div></section>
        <section class="lu-blk"><p class="lu-h">Substitutions</p><ol class="lu-subs">${done.length ? done.map((s) => `<li><b>${esc(s.minute)}'</b>${crestImg(s.side, 'lv-c__cr')}<span class="lu-io"><span class="is-on">${LU_UP}${subTxt(s.side, s.on)}</span><span class="is-off">${LU_DN}${subTxt(s.side, s.off)}</span></span></li>`).join('') : '<li class="is-none">No substitutions yet</li>'}</ol></section>
      </aside>
      ${r.lineupsSource ? `<p class="mc__fine lu-fine">Line-ups: <a href="${esc(r.lineupsSource)}" target="_blank" rel="noopener">ESPN</a></p>` : ''}`;
    if (sideY) el.querySelector('.lu-side').scrollTop = sideY;
  };
  const body = () => {
    if (tab === 'feed') return `<ol class="lv-feed js-lv-feed" aria-live="polite"></ol>${r.eventsSource ? `<p class="mc__fine">Replayed from the match report: <a href="${esc(r.eventsSource)}" target="_blank" rel="noopener">${esc(new URL(r.eventsSource).hostname)}</a> · ${esc(r.date)}</p>` : ''}`;
    if (tab === 'lu') return '<div class="lu js-lv-lu"></div>';
    if (tab === 'stats') return `<div class="lv-st__hd">${crestImg('home')}<b>${esc(r.home.name)}</b><b>${esc(r.away.name)}</b>${crestImg('away')}</div><ul class="lv-st js-lv-stats" data-us="${/ittihad/i.test(r.home.name) ? 'home' : 'away'}"></ul>${r.statsSource ? `<p class="mc__fine">Counts build toward the final match figures from <a href="${esc(r.statsSource)}" target="_blank" rel="noopener">${esc(new URL(r.statsSource).hostname)}</a>; possession and pass accuracy are the final figures.</p>` : ''}`;
    if (tab === 'line') return `<div class="lv-tl"><div class="lv-tl__track js-lv-track"><s class="lv-tl__fill"></s><i class="lv-tl__ht" style="left:${c.pos(c.ht) * 100}%"></i></div>
      <div class="lv-tl__ax"><span>0'</span><span style="left:${c.pos(c.ht) * 100}%">HT</span><span>FT</span></div></div>
      <p class="lv-tl__lg"><span>${crestImg('home')}${esc(r.home.name)} above</span><span>${crestImg('away')}${esc(r.away.name)} below</span></p><ol class="lv-keys js-lv-keys"></ol>`;
    // news & videos: only once the match is over, as the result page shows them
    if (st.phase !== 'ft') return `<p class="mc__empty lv-wait">Highlights after full time.</p>`;
    return `${r.videos?.length ? `<div class="mc__vids">${playing ? `<div class="mc__player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(playing)}?autoplay=1&rel=0" title="Highlights" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><button type="button" class="mc__btn is-2" data-act="stopvid">Close video</button></div>` : ''}
      ${r.videos.map((v) => `<button type="button" class="mc__vid" data-act="vid" data-id="${esc(v.id)}"><img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt=""/><b dir="auto">${esc(v.title)}</b><span>${esc(v.channel)}</span></button>`).join('')}</div>` : ''}
      ${r.news?.length ? `<ul class="mc__news lv-news">${r.news.map((n) => `<li><a href="${esc(n.url)}" target="_blank" rel="noopener"><b>${esc(n.title)}</b><span>${esc(n.outlet)} ↗</span></a></li>`).join('')}</ul>` : ''}`;
  };
  const renderBody = () => {
    const b = host('.js-lv-body'); b.innerHTML = body(); b.scrollTop = 0;
    mediaFT = st.phase === 'ft';
    if (tab === 'feed') syncFeed(true); else if (tab === 'lu') syncLu(true); else if (tab === 'stats') syncStats(true); else if (tab === 'line') syncLine();
  };
  const paintHead = () => {
    const chip = host('.js-lv-chip');
    chip.textContent = st.phase === 'live' ? 'Live' : st.phase === 'ht' ? 'Half-time' : 'Full time';
    chip.classList.toggle('is-live', st.phase === 'live');
    host('.js-lv-min').textContent = st.phase === 'live' ? st.label : '';
    host('.js-lv-score').innerHTML = `${st.score.home}<i>–</i>${st.score.away}`;
    host('.js-lv-sc-home').innerHTML = scorers('home'); host('.js-lv-sc-away').innerHTML = scorers('away');
    host('.js-lv-bar').style.width = `${st.pos * 100}%`;
    host('.js-lv-ft').hidden = !(st.phase === 'ft' && r.pens);
  };
  const render = () => {
    root.innerHTML = `${header('Live match')}
      <section class="mc__hero is-result is-live">
        <p class="mc__comp">${esc(compLabel)}${r.round ? ` · ${esc(r.round)}` : ''}</p>
        <div class="mc__vs"><div class="mc__team">${crestImg('home')}<b>${esc(r.home.name)}</b><ul class="mc__sc js-lv-sc-home"></ul></div>
          <div class="mc__mid"><p class="lv-clock"><span class="lv-chip js-lv-chip"></span><b class="js-lv-min"></b></p><p class="mc__score js-lv-score" aria-live="polite"></p>${r.pens ? `<p class="mc__pens js-lv-ft" hidden>(${r.pens.home} – ${r.pens.away} pens)</p>` : '<i class="js-lv-ft" hidden></i>'}</div>
          <div class="mc__team">${crestImg('away')}<b>${esc(r.away.name)}</b><ul class="mc__sc js-lv-sc-away"></ul></div></div>
        <p class="mc__venue">${esc(r.venue || '')}</p>
        <i class="lv-bar" aria-hidden="true"><s class="js-lv-bar"></s></i>
      </section>
      <nav class="mc__tabs">${tabs.map(([k, l]) => `<button type="button" class="${tab === k ? 'is-on' : ''}" data-act="tab" data-k="${k}">${l}</button>`).join('')}</nav>
      <section class="mc__body js-lv-body"></section>`;
    paintHead(); renderBody();
  };
  // each minute: the scoreboard, then only the open tab (in place, so the lists keep their scroll and the bars glide)
  const onTick = (s) => {
    if (frozen || !root?.classList.contains('is-live')) return;
    const scored = s.score.home + s.score.away > st.score.home + st.score.away && s.k > st.k;
    st = s; if (s.phase === 'ft') frozen = true;   // the page stays at full time; the menu's row replays on
    paintHead();
    if (scored) { feel.goal(); const el = host('.js-lv-score'); el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash'); }
    if (tab === 'feed') syncFeed(); else if (tab === 'lu') syncLu(); else if (tab === 'stats') syncStats(); else if (tab === 'line') syncLine(); else if (mediaFT !== (st.phase === 'ft')) renderBody();
  };
  stopLive = c.on(onTick);
  root.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return closeMatch();
    feel.tap();
    if (a === 'tab') { tab = b.dataset.k; playing = null; root.querySelectorAll('.mc__tabs button').forEach((x) => x.classList.toggle('is-on', x.dataset.k === tab)); return renderBody(); }
    if (a === 'vid') { playing = b.dataset.id; return renderBody(); }
    if (a === 'stopvid') { playing = null; return renderBody(); }
  };
  render();
}

// the live row on the menu's next-matches list: the opponent, the competition, LIVE + the minute, the score
export function bindLiveRow(el, r = LIVE) {
  if (!el || !r) return;
  const c = liveClock(r), us = /ittihad/i.test(r.home.name) ? 'home' : 'away', them = us === 'home' ? 'away' : 'home';
  const code = (t) => CLUBS.find((x) => x.slug === t.slug)?.code || t.name.replace(/^Al[ -]/i, '').slice(0, 3).toUpperCase();
  const paint = (s) => {
    if (!el.isConnected) return off();
    el.setAttribute('aria-label', `${s.phase === 'ft' ? 'Full time' : `Live, ${s.label}`}: ${r.home.name} ${s.score.home}, ${r.away.name} ${s.score.away}`);
    el.innerHTML = `${crestOf(r[them]) ? `<img src="${esc(crestOf(r[them]))}" alt=""/>` : '<i></i>'}<b>${esc(r[them].name)}<small>${esc(COMPS[r.comp]?.label || r.comp)}</small></b>
      <em><span class="lv-rowclk"><span class="lv-chip${s.phase === 'live' ? ' is-live' : ''}">${s.phase === 'live' ? 'Live' : s.phase === 'ht' ? 'HT' : 'FT'}</span>${s.phase === 'live' ? esc(s.label) : ''}</span><small>${esc(code(r.home))} ${s.score.home}–${s.score.away} ${esc(code(r.away))}</small></em><strong>›</strong>`;
  };
  const off = c.on(paint); paint(c.now());
}

// the Tickets page's live card (tickets.js re-renders its whole page on a filter change, so the card is put back
// after each render, between the filter tabs and the list)
export function attachLiveCard(tk, onOpen, r = LIVE) {
  if (!tk || !r) return;
  const c = liveClock(r), o = liveOpts(r);
  tk.classList.add('has-live');
  const card = document.createElement('button');
  card.type = 'button'; card.className = 'lv-tk';
  card.addEventListener('click', (e) => { e.stopPropagation(); feel.tap(); onOpen?.(); });
  const paint = (s) => {
    if (!tk.isConnected) { off(); mo.disconnect(); return; }
    card.setAttribute('aria-label', `${s.phase === 'ft' ? 'Full time' : `Live, ${s.label}`}: ${r.home.name} ${s.score.home}, ${r.away.name} ${s.score.away}. Follow the match`);
    card.innerHTML = `<span class="lv-rowclk"><span class="lv-chip${s.phase === 'live' ? ' is-live' : ''}">${s.phase === 'live' ? 'Live' : s.phase === 'ht' ? 'HT' : 'FT'}</span>${s.phase === 'live' ? esc(s.label) : ''}</span>
      <span class="lv-tk__m">${o.homeCrest ? `<img src="${esc(o.homeCrest)}" alt=""/>` : ''}<b>${esc(r.home.name)}</b><strong>${s.score.home} – ${s.score.away}</strong><b>${esc(r.away.name)}</b>${o.awayCrest ? `<img src="${esc(o.awayCrest)}" alt=""/>` : ''}</span>
      <span class="lv-tk__c">${esc(o.compLabel)}${r.round ? ` · ${esc(r.round)}` : ''}</span><span class="lv-tk__go">${s.phase === 'ft' ? 'See the match' : 'Follow live'} ›</span>`;
  };
  const place = () => { if (!card.isConnected) { const l = tk.querySelector('.tk__list'); if (l) l.before(card); } };
  const mo = new MutationObserver(place); mo.observe(tk, { childList: true });
  const off = c.on(paint); paint(c.now()); place();
}
