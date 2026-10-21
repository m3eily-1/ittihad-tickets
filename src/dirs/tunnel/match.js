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

function countdown(ms) {
  if (!(ms > 0)) return '';
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return `<div class="mc__cd">${[[d, 'Days'], [h, 'Hours'], [m, 'Min']].map(([v, l]) => `<span><b>${String(v).padStart(2, '0')}</b><i>${l}</i></span>`).join('')}</div>`;
}

/* ── upcoming: overview · tickets · line-ups ── */
export function openMatch(m, { dateLong = '', time = '', compLabel = '', onSeats, onPredict, onLineups, onCart, onHome, onClose } = {}) {
  onCloseCb = onClose || null;
  mount();
  const cats = TIERS[m.slug] || [];
  const kickoff = m.kickoff ? m.kickoff * 1000 : 0;
  let tab = 'overview';
  const render = () => {
    const from = cats.length ? Math.min(...cats.map((c) => c.price)) : m.from;
    // (the same key as minigames.js's predict screen)
    const pred = (() => { try { return (JSON.parse(localStorage.getItem('itt-predict-v1')) || {})[m.slug || `${String(m.opp || 'match').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${m.kickoff || 'tbc'}`]; } catch { return null; } })();
    root.innerHTML = `${header('Match centre')}
      <section class="mc__hero">
        <p class="mc__comp">${esc(compLabel)}${m.round ? ` · ${esc(m.round)}` : ''}</p>
        <div class="mc__vs"><div class="mc__team"><img src="${HOME}" alt=""/><b>Al Ittihad</b><small>Home</small></div>
          <div class="mc__mid"><p class="mc__date">${esc(dateLong)}</p><p class="mc__time">${esc(time)}</p>${kickoff ? countdown(kickoff - Date.now()) : ''}</div>
          <div class="mc__team">${m.crest ? `<img src="${esc(m.crest)}" alt=""/>` : '<span class="mc__nocrest"></span>'}<b>${esc(m.opp || m.oppShort || '')}</b><small>Away</small></div></div>
        <p class="mc__venue">${esc(m.venue && m.venue !== 'TBC' ? m.venue : 'Venue to be confirmed')}</p>
      </section>
      <nav class="mc__tabs">${[['overview', 'Overview'], ['tickets', 'Tickets'], ['lineups', 'Line-ups']].map(([k, l]) => `<button type="button" class="${tab === k ? 'is-on' : ''}" data-act="tab" data-k="${k}">${l}</button>`).join('')}</nav>
      <section class="mc__body">${tab === 'overview' ? `
          <div class="mc__grid">
            <div class="mc__box"><p class="mc__k">Kick-off</p><p class="mc__v">${esc(dateLong)}${time ? ` · ${esc(time)}` : ''}</p>${m.timeTBC ? '<p class="mc__fine">Kick-off time to be confirmed by the league</p>' : ''}</div>
            <div class="mc__box"><p class="mc__k">Competition</p><p class="mc__v">${esc(compLabel)}</p>${m.round ? `<p class="mc__fine">${esc(m.round)}</p>` : ''}</div>
            <div class="mc__box"><p class="mc__k">Venue</p><p class="mc__v">${esc(m.venue && m.venue !== 'TBC' ? m.venue : 'To be confirmed')}</p></div>
            <div class="mc__box"><p class="mc__k">Tickets</p><p class="mc__v">${m.onSale ? `On sale${from != null ? ` · from SAR ${from}` : ''}` : 'Not on sale yet'}</p>${cats.length ? `<p class="mc__fine">${cats.length} categories</p>` : ''}</div>
          </div>
          ${onPredict ? `<button type="button" class="mc__pred" data-act="predict"><span class="mc__predsc" aria-hidden="true">${pred ? `${pred.home} - ${pred.away}` : '? - ?'}</span><span><b>Predict the score</b><em>${pred ? 'Your prediction is in · change it' : 'Call it before kick-off · +40 XP'}</em></span><strong>›</strong></button>` : ''}` : tab === 'tickets' ? `
          ${cats.length ? `<ul class="mc__cats">${cats.map((c) => `<li><i style="background:${esc(c.color)}"></i><b>${esc(c.name)}</b><span>SAR ${c.price}</span></li>`).join('')}</ul>
            <p class="mc__fine">Prices from the official ticketing feed. Pick a category in the 3D stadium, then your exact seat.</p>`
            : `<p class="mc__empty">${m.onSale ? 'Choose your seat in the 3D stadium to see the prices.' : 'Tickets for this match aren\'t on sale yet.'}</p>`}` : `
          <div class="mc__line"><p>See both teams' possible line-ups as player cards.</p><p class="mc__fine">Demo: picked by position from the current squads, not the coaches' choices.</p>
            <button type="button" class="mc__btn is-2" data-act="lineups">Show the line-ups</button></div>`}
      </section>
      <footer class="mc__ft">${m.onSale ? `<button type="button" class="mc__btn" data-act="seats">Choose your seats${from != null ? ` · from SAR ${from}` : ''}</button>` : '<button type="button" class="mc__btn" disabled>Not on sale yet</button>'}</footer>`;
  };
  root.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return closeMatch();
    feel.tap();
    if (a === 'tab') { tab = b.dataset.k; return render(); }
    if (a === 'seats') { const cb = onSeats; onCloseCb = null; closeMatch(); cb?.(); return; }
    if (a === 'lineups') return onLineups?.();
    if (a === 'predict') { const cb = onPredict; onCloseCb = null; closeMatch(); return cb?.(); }   // the game opens in its place, and brings it back
    if (a === 'cart') return onCart?.();
    if (a === 'home') { onCloseCb = null; closeMatch(); return onHome?.(); }
  };
  render();
  const tick = setInterval(() => { if (!root) clearInterval(tick); else if (tab === 'overview' || true) { const cd = root.querySelector('.mc__cd'); if (cd && kickoff) cd.outerHTML = countdown(kickoff - Date.now()); } }, 30000);
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
