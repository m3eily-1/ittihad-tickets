// Club + Players (Ahmed, 2026-10-21: FC Mobile's CLUB and PLAYERS screens, in the tunnel's look).
// CLUB: your captain on the left, MY TEAM in the middle (your fantasy XI if you've picked a full one, else the best
// XI from the player cards you own) on a perspective pitch with the team's demo OVR, and tiles on the right:
// Players, Packs, Locker room, Fantasy, Legends. PLAYERS: every card you own (packs.js), sortable and filterable,
// with the selected card large on the right: add it to your fantasy squad (fantasy-ui.js's rules) or quick sell it
// for XP. Ratings are demo values (fantasy-data.js); the screens say so.
import './club.css';
import { P, FORMATIONS, loadTeam, lineup, whyNot, saveTeam } from './fantasy-ui.js';
import { fcCardHTML, tierOf, POS_SHORT } from './fc-card.js';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { openCollection } from './cards.js';
import { LEGENDS } from './legends.js';
import { SQUAD, COACH } from './squad.js';
import { ownedIds, packsCount, onPacks, openPacks, packHTML, packsList, isNew, markSeen, sellCard, SELL_XP } from './packs.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CREST = '/teams/al-ittihad.png';
const POS_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
const POS_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
// pitch slot labels by how many play in that line
const SLOTS = {
  GK: { 1: ['GK'] },
  DEF: { 3: ['CB', 'CB', 'CB'], 4: ['LB', 'CB', 'CB', 'RB'], 5: ['LWB', 'CB', 'CB', 'CB', 'RWB'] },
  MID: { 2: ['CM', 'CM'], 3: ['CM', 'CDM', 'CM'], 4: ['LM', 'CM', 'CM', 'RM'], 5: ['LM', 'CM', 'CDM', 'CM', 'RM'] },
  FWD: { 1: ['ST'], 2: ['ST', 'ST'], 3: ['LW', 'ST', 'RW'] },
};
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M3 11l9-7 9 7 M5 10v10h14V10"/>',
  pack: '<path d="M6 3h12v18H6z M6 7h12 M9 12h6"/>',
  players: '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14a6 6 0 0 1 3.5 6"/>',
  shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3c-1 2-2.5 3-4 3S9 5 8 3z"/>',
  pitch: '<path d="M3 5h18v14H3z M12 5v14 M12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0 M3 9h3v6H3 M21 9h-3v6h3"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z M2 9h20 M9 3l3 6 3-6 M12 9v12"/>',
  sort: '<path d="M7 4v16 M3 16l4 4 4-4 M17 20V4 M13 8l4-4 4 4"/>',
  sell: '<path d="M12 3v18 M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.5 9 10.5 12 11s5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3"/>',
  plus: '<path d="M12 5v14 M5 12h14"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const TOP_SEL = '.pk, .cl, .lc-col, .lc-reveal, .lc-zoom';
const fullName = (p) => `${p.first} ${p.last}`.trim();

/* ── the XI: your fantasy XI when it's complete, else the best XI from the cards you own ── */
function bestOwnedXI() {
  const by = { GK: [], DEF: [], MID: [], FWD: [] };
  ownedIds().map((id) => P[id]).filter(Boolean).sort((a, b) => b.rating - a.rating).forEach((p) => by[p.pos].push(p));
  let best = null;
  for (const [f, [d, m, w]] of Object.entries(FORMATIONS)) {
    const need = { GK: 1, DEF: d, MID: m, FWD: w }, rows = {};
    let n = 0, sum = 0;
    for (const k of Object.keys(need)) { rows[k] = by[k].slice(0, need[k]); rows[k].forEach((p) => { n++; sum += p.rating; }); }
    const score = n * 1000 + sum;   // fill the most slots first, then the highest total
    if (!best || score > best.score) best = { formation: f, need, rows, score };
  }
  return best;
}
export function clubXI() {
  const t = loadTeam(), lu = t.squad.length ? lineup(t) : null;
  if (lu && lu.xi.length === 11) {
    const rows = { GK: [], DEF: [], MID: [], FWD: [] };
    lu.xi.forEach((p) => rows[p.pos].push(p));
    return { source: 'fantasy', name: t.name || 'Tigers XI', formation: t.formation, need: lu.need, rows, captain: P[t.captain] && lu.xi.includes(P[t.captain]) ? P[t.captain] : null };
  }
  const b = bestOwnedXI();
  return { source: 'owned', name: 'My club', formation: b.formation, need: b.need, rows: b.rows, captain: null };
}
const xiList = (x) => ['GK', 'DEF', 'MID', 'FWD'].flatMap((k) => x.rows[k]);
const ovr = (list) => (list.length ? Math.round(list.reduce((a, p) => a + p.rating, 0) / list.length) : 0);

/* ── shared overlay plumbing: fixed root on body, events kept from the 3D scene, Esc closes the top one ── */
function overlay(cls, label) {
  const el = document.createElement('div');
  el.className = `cl ${cls}`; el.tabIndex = -1;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', label); el.setAttribute('data-lenis-prevent', '');
  document.body.append(el);
  for (const ev of ['wheel', 'pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keyup', 'click']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'click' && ev !== 'keydown' });
  return el;
}
function escKeys(el, close) {
  const onKey = (e) => {
    if (!el.isConnected) { removeEventListener('keydown', onKey, true); return; }
    const top = [...document.querySelectorAll(TOP_SEL)].pop();
    if (e.key === 'Escape') {
      if (top === el) { e.preventDefault(); close(); }
      else if (top?.classList.contains('lc-col') && el.classList.contains('is-under')) { e.preventDefault(); top.querySelector('.js-lc-back')?.click(); }
    }
    // the walk's keys stay out while any of these screens is up (form controls keep their own keys)
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '')) e.stopPropagation();
  };
  addEventListener('keydown', onKey, true);
  return () => removeEventListener('keydown', onKey, true);
}
const header = (title, right = '') => `<header class="cl__hd"><button type="button" class="cl__icbtn" data-act="close" aria-label="Back">${svg('back')}</button><h2>${esc(title)}</h2>
  ${right ? `<div class="cl__tr">${right}</div>` : ''}</header>`;

/* ══ CLUB ══ */
// the club's sections live on this page (Ahmed, 2026-10-22: "in the club page, not in the club info"); each opens
// club-info.js at that section, on its own (About, Honours and Stadium tour were taken off the page; Membership moved to the menu's rail).
// The page itself shows the real first team (squad.js); My team and the owned players live in Fantasy now (Ahmed)
const INFO_SECS = [['matches', 'Matches'], ['table', 'Table'], ['videos', 'Videos']];
let clubEl = null;
export function openClub({ onClose, onLocker, onFantasy, onInfo } = {}) {
  clubEl?._close?.(true);
  const el = overlay('cl--club', 'Club');
  clubEl = el;
  let off = [];
  const close = (silent = false) => {
    if (!el.isConnected) return;
    off.forEach((f) => f()); off = [];
    if (clubEl === el) clubEl = null;
    if (silent === true) { el.remove(); return; }
    feel.back(); el.classList.remove('is-on'); setTimeout(() => el.remove(), 260);
    onClose?.();
  };
  el._close = close;
  off.push(escKeys(el, close));

  const render = () => {
    const x = clubXI(), list = xiList(x), team = ovr(list), owned = ownedIds();
    const cap = x.captain || list.slice().sort((a, b) => b.rating - a.rating)[0] || null;
    const nPk = packsCount(), have = progress.cards.length, nx = progress.nextCard, t = loadTeam();
    const topOwned = owned.map((id) => P[id]).sort((a, b) => b.rating - a.rating).slice(0, 3);
    const nextPk = packsList()[0];
    const rows = ['FWD', 'MID', 'DEF', 'GK'].map((pos, r) => {
      const n = x.need[pos], labels = SLOTS[pos][n] || Array(n).fill(POS_SHORT[pos]);
      return `<div class="cl-xi__row" style="--r:${r}">${labels.map((lab, i) => fcCardHTML(x.rows[pos][i] || null, { size: 's', slot: lab })).join('')}</div>`;
    }).join('');
    el.innerHTML = `<div class="cl__bg" aria-hidden="true"></div>
      ${header('Club')}
      <div class="cl-club">
        <section class="cl-cap">
          ${cap ? `<p class="cl-k">${x.captain ? 'Your captain' : 'Your best player'}</p>
            <div class="cl-cap__fig">${cap.photo ? `<img class="cl-cap__ph" src="${esc(cap.photo)}" alt=""/>` : fcCardHTML(cap, { size: 'l' })}<i class="cl-cap__floor"></i></div>
            <div class="cl-cap__id"><b class="cl-cap__r">${cap.rating}</b><span><strong>${esc(fullName(cap))}</strong><em>${esc(POS_NAME[cap.pos])} · ${cap.club?.logo ? `<img src="${esc(cap.club.logo)}" alt=""/>` : ''}${esc(cap.club?.name || '')}</em></span></div>`
          : '<p class="cl-k">No players yet</p>'}
        </section>
        <section class="cl-team cl-sq">
          <header class="cl-team__hd"><img src="${CREST}" alt=""/>
            <div class="cl-team__nm"><h3>First team</h3><em>Season 26/27 · head coach ${esc(COACH)}</em></div>
            <span class="cl-team__f"><small>Players</small><b>${SQUAD.length}</b></span></header>
          <div class="cl-sq__list">${['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].map((p) => `<p class="cl-sq__k">${p}s</p>
            <div class="cl-sq__grid">${SQUAD.filter((q) => q.pos === p).map((q) => `<div class="cl-sq__pl">${q.photo ? `<img src="${esc(q.photo)}" alt="" loading="lazy"/>` : '<span></span>'}<b>${q.no}</b><em>${esc(q.name)}</em></div>`).join('')}</div>`).join('')}</div>
          <p class="cl-note">The club's own squad list (ittihadclub.sa/en/team) · photos: spl.com.sa</p>
        </section>
        <nav class="cl-tiles">
          <div class="cl-secs">${INFO_SECS.map(([k, l]) => `<button type="button" class="cl-sec" data-act="info" data-k="${k}">${esc(l)}</button>`).join('')}</div>
          <button type="button" class="cl-tile is-wide" data-act="legends"><span class="cl-tile__ic">${svg('gem')}</span><span class="cl-tile__t"><b>Legends</b></span><em>${have}/${LEGENDS.length} gems${nx ? ` · next in ${nx.left.toLocaleString('en')} XP` : ''}</em></button>
        </nav>
      </div>`;
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return close();
    feel.tap();
    if (a === 'players') return openPlayers({ onFantasy });
    if (a === 'packs') return openPacks({});
    if (a === 'locker') { close(true); return onLocker?.(); }
    if (a === 'fantasy') return onFantasy?.(() => el.focus({ preventScroll: true }));   // fantasy opens over the club; back returns here
    if (a === 'info') { el.classList.add('is-under'); return onInfo?.(() => { el.classList.remove('is-under'); el.focus({ preventScroll: true }); }, b.dataset.k); }   // a section opens over the club
    if (a === 'legends') {
      // the collection sits below these screens (z-index 175), so the club steps aside until it closes
      el.classList.add('is-under');
      openCollection({ onClose: () => { el.classList.remove('is-under'); render(); el.focus({ preventScroll: true }); } });
    }
  });
  const re = () => { if (el.isConnected) render(); };
  off.push(onPacks(re));
  addEventListener('fantasy:change', re); off.push(() => removeEventListener('fantasy:change', re));
  off.push(progress.on((ev) => { if (ev.type === 'xp' || ev.type === 'card') re(); }));
  render();
  requestAnimationFrame(() => { el.classList.add('is-on'); el.focus({ preventScroll: true }); });
  return { close };
}
export const closeClub = () => clubEl?._close?.();

/* ══ PLAYERS ══ */
let plEl = null;
const SORTS = {
  rating: ['Rating', (a, b) => b.rating - a.rating || (a.last || a.first).localeCompare(b.last || b.first)],
  pos: ['Position', (a, b) => POS_ORDER[a.pos] - POS_ORDER[b.pos] || b.rating - a.rating],
  club: ['Club', (a, b) => (a.club?.name || '').localeCompare(b.club?.name || '') || b.rating - a.rating],
  name: ['Name', (a, b) => (a.last || a.first).localeCompare(b.last || b.first)],
};
export function openPlayers({ onClose, onFantasy } = {}) {
  plEl?._close?.(true);
  const el = overlay('cl--players', 'Players');
  plEl = el;
  let sort = 'rating', pos = 'ALL', ittOnly = false, sel = null, confirm = false, off = [];
  const close = (silent = false) => {
    if (!el.isConnected) return;
    off.forEach((f) => f()); off = [];
    if (plEl === el) plEl = null;
    if (silent === true) { el.remove(); return; }
    feel.back(); el.classList.remove('is-on'); setTimeout(() => el.remove(), 260);
    onClose?.();
  };
  el._close = close;
  off.push(escKeys(el, close));

  const list = () => ownedIds().map((id) => P[id]).filter((p) => p && (pos === 'ALL' || p.pos === pos) && (!ittOnly || p.club?.slug === 'al-ittihad')).sort(SORTS[sort][1]);
  const detail = (p) => {
    if (!p) return '<div class="cl-det is-empty"><p>Open packs to sign players.</p><button type="button" class="cl-btn" data-act="packs">Open packs</button></div>';
    const t = loadTeam(), inSq = t.squad.includes(p.id), why = inSq ? 'In your fantasy squad' : whyNot(t, p), xp = SELL_XP[tierOf(p.rating)];
    return `<div class="cl-det" data-pid="${p.id}">
      <div class="cl-det__card">${fcCardHTML(p, { size: 'l' })}</div>
      <div class="cl-det__info">
        <h3>${esc(fullName(p))}</h3>
        <dl>
          <div><dt>Club</dt><dd>${p.club?.logo ? `<img src="${esc(p.club.logo)}" alt=""/>` : ''}${esc(p.club?.name || '')}</dd></div>
          <div><dt>Position</dt><dd>${esc(POS_NAME[p.pos])} (${esc(POS_SHORT[p.pos])})</dd></div>
          <div><dt>Nationality</dt><dd>${esc(p.nat || '–')}</dd></div>
          <div><dt>Number</dt><dd>${p.no != null && p.no !== '' ? `#${esc(p.no)}` : '–'}</dd></div>
          <div><dt>Rating</dt><dd>${p.rating} <small>demo</small></dd></div>
        </dl>
        <p class="cl-det__src">Photo: spl.com.sa</p>
        <div class="cl-det__acts">
          ${why ? `<button type="button" class="cl-btn is-ghost" disabled>${esc(why)}</button>` : `<button type="button" class="cl-btn" data-act="add">${svg('plus')}Add to fantasy squad</button>`}
          ${confirm ? `<div class="cl-det__confirm"><span>Sell ${esc(p.last || p.first)} for +${xp} XP? The card leaves your club.</span><button type="button" class="cl-btn is-bad" data-act="sell-yes">Sell</button><button type="button" class="cl-btn is-ghost" data-act="sell-no">Keep</button></div>`
            : `<button type="button" class="cl-btn is-ghost" data-act="sell">${svg('sell')}Quick sell → +${xp} XP</button>`}
          ${onFantasy ? '<button type="button" class="cl-link" data-act="fantasy">Edit your fantasy squad</button>' : ''}
        </div>
      </div></div>`;
  };
  const renderDetail = () => { const p = sel != null ? P[sel] : null; el.querySelector('.js-cl-det').innerHTML = detail(p); };
  const render = () => {
    const L = list(), n = ownedIds().length;
    if (sel == null || !L.some((p) => p.id === sel)) { sel = L[0]?.id ?? null; confirm = false; }
    if (sel != null) markSeen(sel);
    const nPk = packsCount();
    el.innerHTML = `<div class="cl__bg" aria-hidden="true"></div>
      ${header('Players', `<button type="button" class="cl__pkbtn" data-act="packs" aria-label="Open packs">${svg('pack')}<b>${nPk}</b><span>Packs</span></button>`)}
      <div class="cl-pl">
        <section class="cl-pl__main">
          <div class="cl-pl__bar">
            <p class="cl-pl__n">Players owned: <b>${n}</b></p>
            <label class="cl-sort">${svg('sort')}<select class="js-cl-sort" aria-label="Sort by">${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <div class="cl-chips" role="group" aria-label="Filter">
              ${['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((k) => `<button type="button" class="${pos === k && (k !== 'ALL' || !ittOnly) ? 'is-on' : ''}" data-act="pos" data-k="${k}" aria-pressed="${pos === k}">${k === 'ALL' ? 'All' : k}</button>`).join('')}
              <button type="button" class="is-itt${ittOnly ? ' is-on' : ''}" data-act="itt" aria-pressed="${ittOnly}"><img src="${CREST}" alt=""/>Al-Ittihad only</button>
            </div>
          </div>
          <div class="cl-grid">${L.map((p, i) => `<button type="button" class="cl-grid__it" data-act="sel" data-id="${p.id}" style="--i:${Math.min(i, 24)}" aria-label="${esc(fullName(p))}, ${p.rating}">${fcCardHTML(p, { size: 'm', selected: p.id === sel, tag: isNew(p.id) && p.id !== sel ? 'NEW' : '' })}</button>`).join('')
            || `<p class="cl-grid__empty">${n ? 'No players match this filter.' : 'No players yet: open a pack to sign some.'}</p>`}</div>
          <p class="cl-note">Ratings are demo values, not official.</p>
        </section>
        <aside class="cl-pl__side js-cl-det"></aside>
      </div>`;
    renderDetail();
    el.querySelector('.js-cl-sort').addEventListener('change', (e) => { sort = e.target.value; feel.tap(); render(); });
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'close') return close();
    feel.tap();
    if (a === 'pos') { pos = b.dataset.k; if (pos === 'ALL') ittOnly = false; return render(); }
    if (a === 'itt') { ittOnly = !ittOnly; return render(); }
    if (a === 'sel') {
      const id = +b.dataset.id; if (id === sel) return;
      sel = id; confirm = false; markSeen(id);
      el.querySelectorAll('.cl-grid .fcc').forEach((c) => c.classList.toggle('is-sel', +c.dataset.pid === id));
      b.querySelector('.fcc__tag')?.remove();
      return renderDetail();
    }
    if (a === 'packs') return openPacks({});
    if (a === 'fantasy') return onFantasy?.(() => el.focus({ preventScroll: true }));   // over the players; back returns here
    if (a === 'add') {
      const p = P[sel], t = loadTeam(), w = whyNot(t, p);
      if (w) { feel.pop(w); return renderDetail(); }
      t.squad.push(p.id); if (t.captain == null && p.pos !== 'GK') t.captain = p.id;
      saveTeam(t); feel.win();
      const r = b.getBoundingClientRect(); feel.pop('ADDED TO YOUR SQUAD', { x: r.left + r.width / 2, y: r.top - 10 });
      return renderDetail();
    }
    if (a === 'sell') { confirm = true; return renderDetail(); }
    if (a === 'sell-no') { confirm = false; return renderDetail(); }
    if (a === 'sell-yes') {
      const L = list(), i = L.findIndex((p) => p.id === sel);
      sellCard(sel);   // progress.award → main.js shows the "+XP" pop-up
      sel = (L[i + 1] || L[i - 1])?.id ?? null; confirm = false;
      return render();   // onPacks also re-renders; harmless
    }
  });
  const re = () => { if (el.isConnected) render(); };
  off.push(onPacks(re));
  addEventListener('fantasy:change', re); off.push(() => removeEventListener('fantasy:change', re));
  render();
  requestAnimationFrame(() => { el.classList.add('is-on'); el.focus({ preventScroll: true }); });
  return { close };
}
export const closePlayers = () => plEl?._close?.();
