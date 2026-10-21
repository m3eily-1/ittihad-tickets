// SPL Fantasy — the team builder (Ahmed, 2026-10-19: "copy the Premier League's fantasy game, EA Sports FC
// style, Saudi Pro League"). The game's rules are Fantasy Premier League's: a 15-player squad (2 GK, 5 DEF,
// 5 MID, 3 FWD) inside a SAR 100m budget, no more than 3 from one club, a starting XI in any legal formation,
// a captain who scores double. The look is EA FC Ultimate Team: gold shield cards, rating and position in the
// corner, crest, dark angled menus. Players are the real squads (fantasy-data.js); prices and ratings are demo.
// The squad lives in localStorage and the 3D room (fantasy.js) shows your XI; changes fire `fantasy:change`.
import { CLUBS, PLAYERS } from './fantasy-data.js';
import { feel } from './feel.js';

const BUDGET = 100, LIMIT = { GK: 2, DEF: 5, MID: 5, FWD: 3 }, PER_CLUB = 3;
export const FORMATIONS = { '3-4-3': [3, 4, 3], '3-5-2': [3, 5, 2], '4-3-3': [4, 3, 3], '4-4-2': [4, 4, 2], '4-5-1': [4, 5, 1], '5-3-2': [5, 3, 2], '5-4-1': [5, 4, 1] };
const KEY = 'itt-fantasy-v1';
export const P = PLAYERS.map((r, id) => ({ id, club: CLUBS[r[0]], first: r[1], last: r[2], pos: r[3], nat: r[4], no: r[5], photo: r[6], price: r[7], rating: r[8] }));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => `SAR ${v.toFixed(1)}m`;

export function loadTeam() {
  try { const t = JSON.parse(localStorage.getItem(KEY)); if (t && Array.isArray(t.squad)) return { formation: '4-4-2', captain: null, name: 'Tigers XI', ...t }; } catch { /* private mode */ }
  return { squad: [], formation: '4-4-2', captain: null, name: 'Tigers XI' };
}
function save(t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* private */ } dispatchEvent(new CustomEvent('fantasy:change', { detail: t })); }
// shared with the 3D pitch table (rooms/fantasy-room-ui.js): the same rules and the same storage
export const RULES = { BUDGET, LIMIT, PER_CLUB };
export const saveTeam = (t) => save(t);
// why p can't join team t (null if it can); `without` = the id leaving to make room (a replacement)
export function whyNot(t, p, without = null) {
  const sq = t.squad.filter((id) => id !== without);
  if (sq.includes(p.id)) return 'In your squad';
  if (sq.filter((id) => P[id].pos === p.pos).length >= LIMIT[p.pos]) return `You have ${LIMIT[p.pos]} ${p.pos}s`;
  if (sq.filter((id) => P[id].club === p.club).length >= PER_CLUB) return `Max ${PER_CLUB} from ${p.club.name}`;
  if (sq.reduce((a, id) => a + P[id].price, 0) + p.price > BUDGET + 1e-6) return 'Not enough in the bank';
  return null;
}
// the starting XI: the first N of each position in squad order, by the formation; the rest is the bench
export function lineup(t) {
  const [d, m, f] = FORMATIONS[t.formation], need = { GK: 1, DEF: d, MID: m, FWD: f };
  const xi = [], bench = [], seen = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const id of t.squad) { const p = P[id]; if (seen[p.pos] < need[p.pos]) { xi.push(p); seen[p.pos]++; } else bench.push(p); }
  return { xi, bench, need };
}

function card(p, { cap = false, small = false, empty = null } = {}) {
  if (!p) return `<div class="fx-card is-empty${small ? ' is-sm' : ''}"><span>${esc(empty || '+')}</span></div>`;
  return `<div class="fx-card${small ? ' is-sm' : ''}${p.rating >= 80 ? ' is-gold' : p.rating >= 72 ? ' is-silver' : ' is-bronze'}" data-id="${p.id}">
    <div class="fx-card__top"><b>${p.rating}</b><i>${p.pos}</i><img src="${p.club.logo}" alt="" loading="lazy"/><em>${esc(p.nat)}</em></div>
    ${p.photo ? `<img class="fx-card__ph" src="${p.photo}" alt="" loading="lazy"/>` : `<div class="fx-card__ph is-none">${esc(p.club.code)}</div>`}
    <div class="fx-card__nm">${esc(p.last || p.first)}</div>
    <div class="fx-card__pr">${money(p.price)}</div>
    ${cap ? '<span class="fx-card__c">C</span>' : ''}
  </div>`;
}

export function mountFantasyUI() {
  const root = document.createElement('div');
  root.className = 'fx'; root.hidden = true;
  root.setAttribute('data-lenis-prevent', '');   // the list scrolls itself, not the page
  root.innerHTML = `
    <div class="fx__bar">
      <button class="fx-back js-fx-back" type="button" aria-label="Back" hidden>Back</button>
      <div class="fx__brand"><b>SPL</b> FANTASY <span>26/27</span></div>
      <h2 class="fx__h">Fantasy</h2>
      <div class="fx__stats">
        <div><small>Players</small><b class="js-fx-count">0/15</b></div>
        <div><small>Bank</small><b class="js-fx-bank">SAR 100.0m</b></div>
        <div><small>Formation</small><select class="js-fx-form">${Object.keys(FORMATIONS).map((f) => `<option>${f}</option>`).join('')}</select></div>
      </div>
      <button class="fx__mine js-fx-mine" type="button" hidden>My players <b class="js-fx-mine-n"></b></button>
      <button class="fx__close js-fx-close" type="button">Done</button>
    </div>
    <div class="fx__main">
      <section class="fx__pitch">
        <h3 class="fx__ttl">My team</h3>
        <div class="fx__field js-fx-field"></div>
        <div class="fx__bench"><small>Bench</small><div class="js-fx-bench"></div></div>
      </section>
      <section class="fx__market">
        <div class="fx__tabs js-fx-tabs">${['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((t, i) => `<button type="button" data-pos="${t}" class="${i ? '' : 'is-on'}">${t}</button>`).join('')}</div>
        <div class="fx__filters">
          <select class="js-fx-club"><option value="">All clubs</option>${CLUBS.map((c, i) => `<option value="${i}">${esc(c.name)}</option>`).join('')}</select>
          <select class="js-fx-sort"><option value="rating">Rating</option><option value="price">Price</option><option value="name">Name</option></select>
          <input class="js-fx-q" type="search" placeholder="Search player"/>
        </div>
        <div class="fx__list js-fx-list"></div>
        <p class="fx__note">Squads from spl.com.sa · ratings and prices are demo values</p>
      </section>
    </div>
    <div class="fx__pop js-fx-pop" hidden></div>
    <div class="fx__toast js-fx-toast" hidden></div>`;
  (document.querySelector('.th__pin') || document.body).append(root);   // over the 3D view (append returns nothing, so no `||` chain)
  const $ = (s) => root.querySelector(s);
  let t = loadTeam(), tab = 'ALL', onCloseCb = null, opens = 0;

  const spent = () => t.squad.reduce((a, id) => a + P[id].price, 0);
  const toast = (msg) => { const el = $('.js-fx-toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 1800); };
  const why = (p) => whyNot(t, p);
  function add(p) { const w = why(p); if (w) { toast(w); return; } t.squad.push(p.id); if (t.captain == null && p.pos !== 'GK') t.captain = p.id; save(t); render(); }
  function remove(id) { t.squad = t.squad.filter((x) => x !== id); if (t.captain === id) t.captain = null; save(t); render(); }

  function renderPitch() {
    const { xi, bench, need } = lineup(t);
    const rows = ['FWD', 'MID', 'DEF', 'GK'].map((pos, r) => {
      const inRow = xi.filter((p) => p.pos === pos);
      const slots = Array.from({ length: need[pos] }, (_, i) => card(inRow[i], { cap: inRow[i] && inRow[i].id === t.captain, empty: pos }));
      return `<div class="fx__row" style="--r:${r}">${slots.join('')}</div>`;
    });
    // the page draws My club's tilted dark pitch under the rows (Ahmed, 2026-10-22: "the map that was in my club");
    // the room's copy keeps its flat green field (the turf is hidden there)
    $('.js-fx-field').innerHTML = `<div class="fx__turf" aria-hidden="true"><i class="is-half"></i><i class="is-circle"></i><i class="is-box is-top"></i><i class="is-box is-bot"></i></div>${rows.join('')}`;
    const missing = 15 - t.squad.length;
    $('.js-fx-bench').innerHTML = bench.map((p) => card(p, { small: true, cap: p.id === t.captain })).join('') + Array.from({ length: Math.max(0, Math.min(4, missing)) }, () => card(null, { small: true })).join('');
    $('.js-fx-count').textContent = `${t.squad.length}/15`;
    const bank = BUDGET - spent();
    $('.js-fx-bank').textContent = money(bank); $('.js-fx-bank').classList.toggle('is-neg', bank < 0);
    $('.js-fx-form').value = t.formation;
  }
  function renderList() {
    const club = $('.js-fx-club').value, q = $('.js-fx-q').value.trim().toLowerCase(), sort = $('.js-fx-sort').value;
    let list = P.filter((p) => (tab === 'ALL' || p.pos === tab) && (club === '' || p.club === CLUBS[+club]) && (!q || `${p.first} ${p.last}`.toLowerCase().includes(q)));
    list.sort((a, b) => (sort === 'price' ? b.price - a.price : sort === 'name' ? (a.last || a.first).localeCompare(b.last || b.first) : b.rating - a.rating));
    list = list.slice(0, 80);
    $('.js-fx-list').innerHTML = list.map((p) => {
      const w = why(p), inSq = t.squad.includes(p.id);
      return `<button type="button" class="fx__item${inSq ? ' is-in' : w ? ' is-off' : ''}" data-id="${p.id}">
        ${card(p, { small: true })}
        <span class="fx__info"><b>${esc(`${p.first} ${p.last}`.trim())}</b><small>${esc(p.club.name)} · ${p.pos}${p.no ? ` · #${p.no}` : ''}</small></span>
        <span class="fx__price">${money(p.price)}</span>
        <span class="fx__add">${inSq ? '✓' : '+'}</span>
      </button>`;
    }).join('') || '<p class="fx__empty">No players match</p>';
  }
  function render() { renderPitch(); renderList(); }

  // pitch: tap a card for captain / bench swap / remove
  root.addEventListener('click', (e) => {
    if (e.target.closest('button, .fx__item, .fx-card[data-id]') && !e.target.closest('.js-fx-back, .js-fx-close')) feel.tap();   // the app's tap on every tap
    const item = e.target.closest('.fx__item');
    if (item) { const p = P[+item.dataset.id]; if (t.squad.includes(p.id)) remove(p.id); else add(p); return; }
    const c = e.target.closest('.fx__field .fx-card[data-id], .fx__bench .fx-card[data-id]');
    const pop = $('.js-fx-pop');
    if (c) {
      const p = P[+c.dataset.id], r = c.getBoundingClientRect(), rr = root.getBoundingClientRect();
      const { bench } = lineup(t), onBench = bench.includes(p);
      const swaps = onBench ? lineup(t).xi.filter((x) => x.pos === p.pos) : bench.filter((x) => x.pos === p.pos);
      pop.innerHTML = `<b>${esc(`${p.first} ${p.last}`.trim())}</b>
        <button type="button" data-act="cap" data-id="${p.id}">${t.captain === p.id ? 'Captain ✓' : 'Make captain'}</button>
        ${swaps.map((s) => `<button type="button" data-act="swap" data-id="${p.id}" data-with="${s.id}">${onBench ? 'Start instead of' : 'Bench for'} ${esc(s.last || s.first)}</button>`).join('')}
        <button type="button" data-act="del" data-id="${p.id}">Remove</button>`;
      pop.style.left = `${Math.min(r.left - rr.left, rr.width - 230)}px`; pop.style.top = `${r.bottom - rr.top + 6}px`;
      pop.hidden = false; return;
    }
    const act = e.target.closest('[data-act]');
    if (act) {
      const id = +act.dataset.id;
      if (act.dataset.act === 'cap') t.captain = id;
      if (act.dataset.act === 'del') { remove(id); pop.hidden = true; return; }
      if (act.dataset.act === 'swap') { const a = t.squad.indexOf(id), b = t.squad.indexOf(+act.dataset.with); [t.squad[a], t.squad[b]] = [t.squad[b], t.squad[a]]; }
      save(t); render(); pop.hidden = true; return;
    }
    if (!e.target.closest('.js-fx-pop')) pop.hidden = true;
    const tb = e.target.closest('.js-fx-tabs button');
    if (tb) { tab = tb.dataset.pos; root.querySelectorAll('.js-fx-tabs button').forEach((b) => b.classList.toggle('is-on', b === tb)); renderList(); }
  });
  $('.js-fx-form').addEventListener('change', (e) => { t.formation = e.target.value; save(t); render(); });
  ['.js-fx-club', '.js-fx-sort'].forEach((s) => $(s).addEventListener('change', renderList));
  $('.js-fx-q').addEventListener('input', renderList);
  // keep the walk's keys and wheel out while the builder is open
  root.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('keydown', (e) => e.stopPropagation());
  root.addEventListener('pointerdown', (e) => e.stopPropagation());

  // the 3D pitch table saved a change: pick it up (our own saves pass our own object)
  addEventListener('fantasy:change', (e) => { if (e.detail === t) return; t = loadTeam(); if (!root.hidden) render(); });

  const api = {
    // page: opened from the menu (Ahmed, 2026-10-22: "treat them as pages like club and community") — over the menu,
    // with the back top-left; otherwise over its room in the walk, as before
    // onPlayers(back): the page's "My players" (your owned cards, moved here from the Club page — Ahmed, 2026-10-22)
    open({ page = false, onClose = null, onPlayers = null, owned = 0 } = {}) {
      (page ? document.body : (document.querySelector('.th__pin') || document.body)).append(root);
      root.classList.toggle('is-page', page); $('.js-fx-back').hidden = !page;
      playersCb = page ? onPlayers : null; $('.js-fx-mine').hidden = !playersCb; $('.js-fx-mine-n').textContent = owned || '';
      opens++; onCloseCb = onClose;   // the page's back returns to the screen it was opened from (the menu, the club, the news)
      t = loadTeam(); render(); root.hidden = false; requestAnimationFrame(() => root.classList.add('is-on')); },
    close() {
      if (root.hidden) return;
      feel.back(); root.classList.remove('is-on'); const n = ++opens; setTimeout(() => { if (n === opens) root.hidden = true; }, 250);
      const cb = onCloseCb; onCloseCb = null; cb?.();
    },
    get isOpen() { return !root.hidden; },
  };
  $('.js-fx-close').addEventListener('click', () => api.close());
  $('.js-fx-back').addEventListener('click', () => api.close());
  let playersCb = null;
  $('.js-fx-mine').addEventListener('click', () => {
    if (!playersCb) return;
    root.classList.add('is-under');   // the players page sits under this one, so this steps aside until it closes
    playersCb(() => { root.classList.remove('is-under'); t = loadTeam(); render(); });
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('is-page')) api.close(); });
  return api;
}
