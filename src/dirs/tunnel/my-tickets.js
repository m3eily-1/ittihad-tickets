// My tickets (Ahmed, 2026-10-26: "there should be a place where the user can access his tickets"). Every ticket
// bought in the checkout (tickets-cart.js), kept in this browser, grouped by match with the upcoming ones first. Each
// is a ticket-style card with a scannable-looking code drawn here from the ticket's id (a QR-like grid, not a real
// QR); tapping one opens it big, for showing at the gate. Opened from the menu rail, the Tickets page and the
// checkout's done screen. The page look is the store's (shop.css: .sh root, header, panels).
import './shop.css';
import './tix.css';
import { feel } from './feel.js';
import { when } from '../../data.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const KEY = 'itt-mytix-v1';
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

let tickets = load(KEY, []);
const subs = new Set();
const AFTER = 3 * 3600e3;   // a match stays "upcoming" until about full time
const isUpcoming = (t) => !t.date || t.date * 1000 + AFTER > Date.now();
export const purchased = () => tickets.slice();
export function addPurchased(list) { tickets = tickets.concat(list); save(KEY, tickets); subs.forEach((f) => f()); }
export const myTickets = {
  get upcoming() { return tickets.filter(isUpcoming).length; },
  onChange(fn) { subs.add(fn); fn(); return () => subs.delete(fn); },
};
// "MON 02 NOV · 21:15 · King Abdullah Sports City Stadium"; the season pass has no date
export function whenLine(t, venue = true) {
  if (!t.date) return `Every home match${venue && t.venue ? ` · ${t.venue}` : ''}`;
  const w = when(t.date);
  return `${w.day} ${w.date} ${w.month} · ${w.time}${venue && t.venue ? ` · ${t.venue}` : ''}`;
}

/* ── the code: a QR-like grid drawn from the ticket id (three finder squares, timing rows, seeded modules) ── */
function seed(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
export function codeSvg(id, n = 25) {
  const rnd = seed(String(id)), on = [];
  const finder = (x, y) => x < 7 && y < 7 ? [x, y] : x >= n - 7 && y < 7 ? [x - (n - 7), y] : x < 7 && y >= n - 7 ? [x, y - (n - 7)] : null;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const f = finder(x, y);
    let v;
    if (f) { const [a, b] = f, d = Math.max(Math.abs(a - 3), Math.abs(b - 3)); v = d !== 2; }      // ring, gap, 3×3 eye
    else if ((x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)) v = false;   // the white band round each finder
    else if (y === 6) v = x % 2 === 0;
    else if (x === 6) v = y % 2 === 0;
    else v = rnd() < 0.5;
    if (v) on.push(`M${x + 2} ${y + 2}h1v1h-1z`);
  }
  const s = n + 4;
  return `<svg class="mt-code" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges" role="img" aria-label="Ticket code ${esc(id)}"><rect width="${s}" height="${s}" fill="#fff"/><path d="${on.join('')}" fill="#0a0a0a"/></svg>`;
}

/* ── the page ── */
let root = null, big = null, opts = {};
function groups() {
  const m = new Map();
  for (const t of tickets) { if (!m.has(t.matchSlug)) m.set(t.matchSlug, []); m.get(t.matchSlug).push(t); }
  const rank = (g) => { const t = g[0]; return isUpcoming(t) ? (t.date ? t.date : 9e12) : 2e13 - (t.date || 0); };   // upcoming by date, then the season pass, then the played ones (latest first)
  return [...m.values()].sort((a, b) => rank(a) - rank(b));
}
const card = (t) => `<button type="button" class="mt-tk ${isUpcoming(t) ? '' : 'is-past'}" data-id="${esc(t.id)}" aria-label="Open ticket ${esc(t.block)} row ${esc(t.row)} seat ${esc(t.seat)}">
  <span class="mt-tk__main">
    <span class="mt-tk__cat"><i style="background:${esc(t.color)}"></i>${esc(t.cat)}</span>
    <b class="mt-tk__stand">${esc(t.stand)}</b>
    <span class="mt-tk__meta"><span><em>Tier</em>${esc(t.tier)}</span><span><em>Block</em>${esc(t.block)}</span><span><em>Row</em>${esc(t.row)}</span><span><em>Seat</em>${esc(t.seat)}</span></span>
    <span class="mt-tk__who">${esc(t.holder || '')}${t.holder ? ' · ' : ''}${esc(t.id)}</span>
  </span>
  <span class="mt-tk__stub">${codeSvg(t.id, 21)}<span>Tap to show</span></span>
</button>`;
function render() {
  const gs = groups(), up = myTickets.upcoming;
  root.innerHTML = `<div class="sh__panel is-mine">
    <header class="sh__hd"><button type="button" class="sh__back" data-act="close" aria-label="Back">Back</button><div class="sh__ht"><h2>My tickets</h2></div>
      ${tickets.length ? `<p class="tc-chip"><span>Upcoming</span><b>${up}</b></p>` : ''}</header>
    <div class="sh__body">${gs.length ? gs.map((g) => { const t = g[0], past = !isUpcoming(t); return `<section class="mt-g ${past ? 'is-past' : ''}">
        <header class="mt-g__h">${t.crest ? `<img src="${esc(t.crest)}" alt=""/>` : ''}<div><p class="mt-g__k">${esc(t.comp || '')}${past ? ' · Played' : ''}</p><h3>${esc(t.matchLabel)}</h3><p class="mt-g__d">${esc(whenLine(t))}</p></div><em>${esc(plural(g.length, 'ticket'))}</em></header>
        <div class="mt-g__row">${g.map(card).join('')}</div></section>`; }).join('')
      : `<div class="sh__empty mt-empty"><p>No tickets yet. Pick a match, choose your seats and they land here.</p><button type="button" class="sh__btn" data-act="find">Find a match</button></div>`}</div>
  </div>`;
}
/** onClose: back; onFind: the empty state's "Find a match" (default: back) */
export function openMyTickets(o = {}) {
  opts = o;
  root?.remove();
  root = document.createElement('div');
  root.className = 'sh mt'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'My tickets');
  document.body.append(root);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown', 'keyup']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act], [data-id]'); if (!b) return;
    if (b.dataset.act === 'close') return close();
    feel.tap();
    if (b.dataset.act === 'find') { const f = opts.onFind; close(true); return f ? f() : undefined; }
    if (b.dataset.id) openBig(b.dataset.id);
  });
  render();
  requestAnimationFrame(() => root?.classList.add('is-on'));
}
function close(quiet = false) {
  if (!quiet) feel.back();
  const r = root; root = null; big?.remove(); big = null;
  r?.classList.remove('is-on'); setTimeout(() => r?.remove(), 250);
  if (!quiet) opts.onClose?.();
}
// one ticket, big: the code to scan and the seat, for the gate
function openBig(id) {
  const t = tickets.find((x) => x.id === id); if (!t) return;
  big?.remove();
  big = document.createElement('div');
  big.className = 'sh mt-big'; big.setAttribute('role', 'dialog'); big.setAttribute('aria-modal', 'true'); big.setAttribute('aria-label', 'Ticket');
  big.innerHTML = `<div class="sh__panel">
    <header class="sh__hd"><button type="button" class="sh__back" data-act="close" aria-label="Back">Back</button><div class="sh__ht"><h2>Your ticket</h2></div></header>
    <div class="sh__body"><article class="mt-big__card">
      <div class="mt-big__code">${codeSvg(t.id, 25)}<p>${esc(t.id)}</p></div>
      <div class="mt-big__info">
        <p class="mt-g__k">${esc(t.comp || '')}</p>
        <h3>${esc(t.matchLabel)}</h3>
        <p class="mt-g__d">${esc(whenLine(t))}</p>
        <dl class="mt-big__meta"><div><dt>Stand</dt><dd>${esc(t.stand)}</dd></div><div><dt>Tier</dt><dd>${esc(t.tier)}</dd></div><div><dt>Block</dt><dd>${esc(t.block)}</dd></div><div><dt>Row</dt><dd>${esc(t.row)}</dd></div><div><dt>Seat</dt><dd>${esc(t.seat)}</dd></div></dl>
        <p class="mt-tk__cat"><i style="background:${esc(t.color)}"></i>${esc(t.cat)}${t.holder ? ` · ${esc(t.holder)}` : ''}</p>
        <p class="sh__fine">Show this code at the gate. Turn your screen brightness up so it scans first time.</p>
      </div>
    </article></div></div>`;
  document.body.append(big);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown', 'keyup']) big.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  big.addEventListener('click', (e) => { if (e.target.closest('[data-act="close"]')) { feel.back(); const b = big; big = null; b.classList.remove('is-on'); setTimeout(() => b.remove(), 250); } });
  requestAnimationFrame(() => big?.classList.add('is-on'));
}
