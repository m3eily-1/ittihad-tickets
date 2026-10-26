// Match centre (Ahmed, 2026-10-21: "book tickets should go to a match details page"; and for ended games: summary,
// score, statistics, key events, news, videos). One page for both: an upcoming fixture shows the overview, the
// ticket categories and possible line-ups, with "Choose your seats" into the 3D booking; a finished match (from
// results-data.js, researched and sourced) shows the score, scorers, stats, key events, news and highlight videos.
// Only facts from the data files are shown — nothing here is made up.
import './match.css';
import { TIERS } from '../../data.js';
import { feel } from './feel.js';

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
  root?.remove();
  root = document.createElement('div');
  root.className = 'mc'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Match centre');
  document.body.append(root);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') closeMatch(); }, { passive: true });
  requestAnimationFrame(() => root?.classList.add('is-on'));
  return root;
}
let onCloseCb = null;
export function closeMatch() { if (!root) return; feel.back(); const r = root; root = null; r.classList.remove('is-on'); setTimeout(() => r.remove(), 250); onCloseCb?.(); onCloseCb = null; }

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
