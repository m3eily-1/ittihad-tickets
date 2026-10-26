// Tickets, as their own place (Ahmed, 2026-10-21: "don't show the tickets in the tunnel experience, make a new
// place for it" — the tunnel walk is the tour; booking is its own journey). Every upcoming match and the season
// pass as cards, filtered by competition (with the leagues' logos); a card opens the match centre (match.js),
// whose "Choose your seats" takes you into the 3D seat map. Data: the same fixtures and prices as before.
import './tickets.css';
import { feel } from './feel.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HOME = '/teams/al-ittihad.png';
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>', home: '<path d="M3 11l9-7 9 7 M5 10v10h14V10"/>',
  cart: '<path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

let root = null;
/**
 * @param cards   scene.matches.cards (season pass first, then fixtures)
 * @param comps   COMPS (label, mark)
 * @param bits    (m) => { date, time, comp, price } — formatted by main.js with the shared helpers
 */
export function openTickets({ cards = [], comps = {}, bits, onMatch, onSeason, onResults, onCart, onHome, onClose } = {}) {
  root?.remove();
  root = document.createElement('div');
  root.className = 'tk'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Tickets');
  document.body.append(root);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') close(); }, { passive: true });
  const close = () => { feel.back(); const r = root; root = null; r?.classList.remove('is-on'); setTimeout(() => r?.remove(), 250); onClose?.(); };
  const keys = ['all', ...['rsl', 'afc', 'kings'].filter((k) => cards.some((m) => m.comp === k))];
  let filter = 'all';
  const card = (m, i) => {
    if (m.kind === 'season') return `<button type="button" class="tk__c is-season" data-i="${i}"><span class="tk__k">Al-Ittihad · Membership</span>
      <b class="tk__st">TIGERS <em>SEASON PASS</em></b><span class="tk__sub">Every home match · ${esc(m.season || '26/27')}</span>
      <span class="tk__pr">From SAR ${esc(m.from ?? '')}</span><span class="tk__go">Get the pass</span></button>`;
    const b = bits(m);
    return `<button type="button" class="tk__c ${m.onSale ? '' : 'is-off'}" data-i="${i}">
      <span class="tk__k">${comps[m.comp]?.mark ? `<img src="${esc(comps[m.comp].mark)}" alt=""/>` : ''}<span>${esc(b.comp)}${m.round ? ` · ${esc(String(m.round).replace(/^League stage · /i, ''))}` : ''}</span></span>
      <span class="tk__teams"><img src="${HOME}" alt=""/><span class="tk__when"><b>${esc(b.date)}</b><i>${esc(b.time)}</i></span>${m.crest ? `<img src="${esc(m.crest)}" alt=""/>` : '<i class="tk__nocrest"></i>'}</span>
      <span class="tk__nm">Al Ittihad <em>vs</em> ${esc(m.oppShort || m.opp)}</span>
      <span class="tk__ven">${esc(m.venue && m.venue !== 'TBC' ? m.venue : 'Venue TBC')}</span>
      <span class="tk__pr">${m.onSale ? `From SAR ${esc(b.price ?? '')}` : 'Not on sale yet'}</span>
      <span class="tk__go">${m.onSale ? 'Book tickets' : 'Details'}</span></button>`;
  };
  const render = () => {
    root.innerHTML = `<header class="tk__hd"><button type="button" class="tk__ic" data-act="close" aria-label="Back">${svg('back')}</button><h2>Tickets</h2>
        </header>
      <nav class="tk__tabs">${keys.map((k) => `<button type="button" class="${k === filter ? 'is-on' : ''}" data-act="f" data-k="${k}">${comps[k]?.mark ? `<img src="${esc(comps[k].mark)}" alt=""/>` : ''}${esc(comps[k]?.label || k)}</button>`).join('')}
        ${onResults ? '<button type="button" class="tk__res" data-act="results">Results</button>' : ''}</nav>
      <div class="tk__list">${cards.map((m, i) => (filter === 'all' || m.comp === filter || (m.kind === 'season' && filter === 'all') ? card(m, i) : '')).join('')}</div>
      <p class="tk__fine">Prices and dates from the official ticketing feed and the published fixture lists.</p>`;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act], [data-i]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return close();
    feel.tap();
    if (a === 'f') { filter = b.dataset.k; return render(); }
    if (a === 'cart') return onCart?.();
    if (a === 'home') { const r = root; root = null; r.remove(); return onHome?.(); }
    if (a === 'results') return onResults?.();
    if (b.dataset.i != null) { const m = cards[+b.dataset.i]; if (m.kind === 'season') onSeason?.(m); else onMatch?.(m); }
  });
  // the list runs sideways: a plain mouse wheel (up/down) scrolls it left/right
  root.addEventListener('wheel', (e) => {
    const l = e.target.closest('.tk__list'); if (!l || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault(); l.scrollLeft += e.deltaY;
  }, { passive: false });
  render();
  requestAnimationFrame(() => root?.classList.add('is-on'));
}
export const ticketsOpen = () => !!root;
