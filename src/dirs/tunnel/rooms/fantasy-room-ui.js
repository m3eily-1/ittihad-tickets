// SPL Fantasy room: playing with the pitch table (Ahmed, 2026-10-21: "drag players onto the 3D pitch table,
// captain's armband, a 'kick-off' that simulates a matchweek with points"). The ids come from fantasy.js:
//   fx:card:<slot>  a card on the table (slot = 'DEF2' …; empty slots are ghost "+" cards) → select it and pick a
//                   replacement in a compact side panel; tap a second card of the same position to swap the two
//   fx:captain      the armband on the table → captain mode: the next card you tap gets the armband
//   fx:kickoff      the KICK-OFF button → a DEMO matchweek (rooms/fantasy-room-sim.js, seeded): the points count
//                   up on the room's screen and in a panel; captain ×2; best saved as progress 'fantasy-gw'
// The 2D builder's rules and storage stay in charge (fantasy-ui.js: whyNot, saveTeam), so the builder and the
// table always agree; the table redraws itself on 'fantasy:change'.
import './fantasy-room-ui.css';
import { loadTeam, lineup, P, whyNot, saveTeam, RULES } from '../fantasy-ui.js';
import { simulate } from './fantasy-room-sim.js';

const KEY = 'itt-fantasy-room-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => `SAR ${v.toFixed(1)}m`;
const nm = (p) => `${p.first} ${p.last}`.trim();
const short = (p) => p.last || p.first;
const DUR = 4300, rowAt = (i) => i * 0.065;   // the tally's timing (fantasy.js draws the screen on the same clock)

let root = null, ctxRef = null, panel = null, pickSlot = null, query = '', raf = 0, hinted = false, counting = null;
const $ = (s) => root.querySelector(s);
const api = () => ctxRef?.room?.api;

function ensure() {
  if (root) return;
  root = document.createElement('div');
  root.className = 'fr';
  root.setAttribute('data-lenis-prevent', '');
  root.innerHTML = '<div class="fr-hint js-fr-hint" hidden></div><aside class="fr-panel js-fr-panel" hidden></aside><div class="fr-toast js-fr-toast" hidden></div>';
  document.body.append(root);
  // keep the scene's keys (W A S D on window), wheel and drags out of the panels
  for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'keydown', 'keyup', 'touchstart', 'touchmove']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') { closePanel(); setCap(false); } }, { passive: true });
  root.addEventListener('click', onClick);
  root.addEventListener('input', (e) => { if (e.target.classList.contains('js-fr-q')) { query = e.target.value.trim().toLowerCase(); renderList(); } });
  addEventListener('fantasy:change', () => { if (panel === 'pick') renderPick(); });
}
function toast(msg) {
  const el = $('.js-fr-toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200);
}
function hint(html, { cancel = false, ms = 0 } = {}) {
  const el = $('.js-fr-hint');
  clearTimeout(hint.t);
  if (!html) { el.hidden = true; return; }
  el.innerHTML = `<span>${html}</span>${cancel ? '<button type="button" data-act="capoff">Cancel</button>' : ''}`;
  el.hidden = false;
  if (ms) hint.t = setTimeout(() => { el.hidden = true; }, ms);
}

/* ── captain mode ── */
function setCap(on) {
  api()?.setCaptainMode(on);
  if (!root) return;
  if (on) { closePanel(); hint('<b>Captain</b> · tap a player on the table to give them the armband (they score double)', { cancel: true }); }
  else if ($('.js-fr-hint').querySelector('[data-act="capoff"]')) hint(null);
}

/* ── the picker: one slot, its bench options and transfers ── */
function slotNow() { return pickSlot ? api()?.slotOf(pickSlot) : null; }
function openPick(s) {
  pickSlot = s.slot; query = '';
  api()?.select(s.slot);
  panel = 'pick';
  renderPick();
}
function renderPick() {
  const s = slotNow(); if (!s) { closePanel(); return; }
  const t = loadTeam(), p = s.player, { bench } = lineup(t);
  const bank = RULES.BUDGET - t.squad.reduce((a, id) => a + P[id].price, 0);
  const bs = bench.filter((b) => b.pos === s.pos);
  const el = $('.js-fr-panel');
  el.innerHTML = `
    <header class="fr-hd">
      <div><p class="fr-k">${s.pos} · ${p ? 'on the table' : 'empty slot'}</p><h3 class="fr-h">${p ? esc(nm(p)) : `Add a ${s.pos}`}</h3></div>
      <button type="button" class="fr-x" data-act="close" aria-label="Close">✕</button>
    </header>
    <p class="fr-meta">${p ? `${esc(p.club.name)} · rating ${p.rating} · ${money(p.price)} · ` : ''}Bank <b class="${bank < 0 ? 'is-neg' : ''}">${money(bank)}</b></p>
    ${p ? `<div class="fr-acts">
      <button type="button" class="fr-btn${t.captain === p.id ? ' is-on' : ''}" data-act="cap">${t.captain === p.id ? 'Captain ✓' : 'Make captain'}</button>
      <button type="button" class="fr-btn is-2" data-act="del">Remove</button></div>
      <p class="fr-tip">Tip: tap another ${s.pos} card on the table to swap the two.</p>` : ''}
    ${bs.length ? `<p class="fr-lab">From your bench</p><div class="fr-bench">${bs.map((b) => `<button type="button" class="fr-pl" data-act="bench" data-id="${b.id}">${face(b)}<span><b>${esc(nm(b))}</b><small>${esc(b.club.name)} · ${b.rating}</small></span><em>Start</em></button>`).join('')}</div>` : ''}
    <p class="fr-lab">Transfer in</p>
    <input class="fr-q js-fr-q" type="search" placeholder="Search ${s.pos}s" value="${esc(query)}" autocomplete="off"/>
    <div class="fr-list js-fr-list"></div>
    <p class="fr-fine">${RULES.PER_CLUB} per club max · SAR ${RULES.BUDGET}m budget · ratings and prices are demo values</p>`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('is-on'));
  renderList();
}
const face = (p) => (p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy"/>` : `<i>${esc(p.club.code)}</i>`);
function renderList() {
  const s = slotNow(); if (!s || !root) return;
  const t = loadTeam(), out = s.player?.id ?? null;
  const list = P.filter((p) => p.pos === s.pos && !t.squad.includes(p.id) && (!query || nm(p).toLowerCase().includes(query) || p.club.name.toLowerCase().includes(query)))
    .map((p) => ({ p, w: whyNot(t, p, out) }))
    .sort((a, b) => (!!a.w - !!b.w) || b.p.rating - a.p.rating)
    .slice(0, 40);
  const el = $('.js-fr-list'); if (!el) return;
  el.innerHTML = list.map(({ p, w }) => `<button type="button" class="fr-pl${w ? ' is-off' : ''}" data-act="in" data-id="${p.id}" ${w ? `aria-disabled="true" title="${esc(w)}"` : ''}>
      ${face(p)}<span><b>${esc(nm(p))}</b><small>${w ? esc(w) : `${esc(p.club.name)} · ${p.rating}`}</small></span><em>${money(p.price)}</em></button>`).join('') || '<p class="fr-empty">No players match</p>';
}
function closePanel() {
  if (raf) return;   // the tally is still counting
  if (panel === 'tally') api()?.endTally();
  panel = null; pickSlot = null;
  api()?.select(null);
  if (!root) return;
  const el = $('.js-fr-panel'); el.classList.remove('is-on'); el.hidden = true; el.innerHTML = '';
}

/* ── the table's actions, through fantasy-ui's rules and storage ── */
function transferIn(id) {
  const s = slotNow(), p = P[id]; if (!s || !p) return;
  const t = loadTeam(), out = s.player?.id ?? null, w = whyNot(t, p, out);
  if (w) { toast(w); return; }
  if (out != null) { t.squad[t.squad.indexOf(out)] = p.id; if (t.captain === out) t.captain = p.id; }
  else { t.squad.push(p.id); if (t.captain == null && p.pos !== 'GK') t.captain = p.id; }
  saveTeam(t);
  ctxRef.feel.tap();
  toast(out != null ? `${short(p)} in, ${short(P[out])} out` : `${short(p)} joins your XI`);
  closePanel();
}
function swapIds(a, b, msg) {
  const t = loadTeam(), i = t.squad.indexOf(a), j = t.squad.indexOf(b);
  if (i < 0 || j < 0) return;
  [t.squad[i], t.squad[j]] = [t.squad[j], t.squad[i]];
  saveTeam(t); ctxRef.feel.tap(); toast(msg); closePanel();
}
function makeCaptain(p) {
  const t = loadTeam(); if (!t.squad.includes(p.id)) return;
  t.captain = p.id; saveTeam(t);
  ctxRef.feel.win(); ctxRef.feel.pop(`${short(p).toUpperCase()} · CAPTAIN`, { y: innerHeight * 0.3 });
}

/* ── kick-off: a demo matchweek ── */
function kickoff() {
  const t = loadTeam(), { xi } = lineup(t);
  if (!xi.length) { toast('Your XI is empty: tap a + card on the table to add players'); return; }
  if (raf) return;
  closePanel(); setCap(false);
  const st = load(), gw = st.gw || 1;
  const res = simulate(xi, t.captain, gw);
  res.best = ctxRef.progress.best('fantasy-gw');
  st.gw = gw + 1; st.last = { gw, total: res.total, seed: res.seed }; save(st);
  openTally(res, 11 - xi.length);
}
function openTally(res, empty) {
  panel = 'tally';
  const el = $('.js-fr-panel');
  el.innerHTML = `
    <header class="fr-hd">
      <div><p class="fr-k">Matchweek ${res.gw} <span class="fr-demo">DEMO</span></p><h3 class="fr-h">Points</h3></div>
      <div class="fr-total"><small>Total</small><b class="js-fr-total">0</b></div>
    </header>
    <ol class="fr-rows">${res.rows.map((r, i) => `<li class="js-fr-row${r.cap ? ' is-cap' : ''}" data-i="${i}" title="${esc(r.ev)}"><i>${r.pos}</i><span><b>${esc(r.name)}${r.cap ? ' <u>C</u>' : ''}</b><small>${esc(r.ev)}</small></span><em class="js-fr-pts">–</em></li>`).join('')}</ol>
    ${empty > 0 ? `<p class="fr-fine">${empty} empty slot${empty > 1 ? 's' : ''} on the table scored 0.</p>` : ''}
    <div class="fr-end js-fr-end" hidden></div>
    <p class="fr-fine">Simulated, not real results · seed ${esc(res.seed)}: the same XI in the same week always scores the same.</p>`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('is-on'));
  const rows = [...el.querySelectorAll('.js-fr-row')], seen = new Set(), t0 = performance.now();
  counting = res;
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / DUR);
    api()?.drawTally(res, k);
    let sum = 0;
    res.rows.forEach((r, i) => {
      const a = Math.min(1, Math.max(0, (k - rowAt(i)) / 0.09)), v = Math.round(r.pts * a);
      sum += v;
      if (a > 0 && !seen.has(i)) { seen.add(i); rows[i].classList.add('is-on'); rows[i].scrollIntoView?.({ block: 'nearest' }); if (r.pts >= 10) ctxRef.feel.roar(); else ctxRef.feel.tap(); }
      if (a > 0) rows[i].querySelector('.js-fr-pts').textContent = String(v);
    });
    $('.js-fr-total').textContent = String(sum);
    if (k < 1) { raf = requestAnimationFrame(step); return; }
    raf = 0;
    finish(res);
  };
  raf = requestAnimationFrame(step);
}
// the week's result counts (best score, XP) — also when you walk out before the count ends (quiet)
function settle(res) {
  counting = null;
  const best = ctxRef.progress.setBest('fantasy-gw', res.total);
  ctxRef.progress.award(best ? 40 : 20, `Matchweek ${res.gw}`);
  return best;
}
function finish(res) {
  const best = settle(res);
  ctxRef.feel.win();
  if (best && res.total > 0) ctxRef.feel.confetti({ n: 160 });
  const end = $('.js-fr-end');
  end.innerHTML = `<p class="fr-best">${best ? `<b>New best!</b> ${res.total} points` : `Best so far: <b>${Math.max(res.best, res.total)}</b>`}</p>
    <div class="fr-acts"><button type="button" class="fr-btn" data-act="next">Next matchweek</button><button type="button" class="fr-btn is-2" data-act="close">Done</button></div>`;
  end.hidden = false;
  end.scrollIntoView?.({ block: 'nearest' });
}

function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, s = slotNow();
  if (a === 'close') { ctxRef.feel.back(); closePanel(); return; }
  if (a === 'capoff') { setCap(false); return; }
  if (a === 'next') { ctxRef.feel.tap(); api()?.press(); closePanel(); kickoff(); return; }
  if (a === 'in') { transferIn(+b.dataset.id); return; }
  if (a === 'bench' && s?.player) { const p = P[+b.dataset.id]; swapIds(s.player.id, p.id, `${short(p)} starts, ${short(s.player)} to the bench`); return; }
  if (a === 'cap' && s?.player) { makeCaptain(s.player); renderPick(); return; }
  if (a === 'del' && s?.player) {
    const t = loadTeam(), id = s.player.id;
    t.squad = t.squad.filter((x) => x !== id); if (t.captain === id) t.captain = null;
    saveTeam(t); ctxRef.feel.back(); toast(`${short(s.player)} removed`); closePanel();
  }
}

// the scene reports a tap on pointerup; the browser's own click follows a moment later at the same spot. Anything
// we open on the tap (a panel, the shop sheet) would catch that click, so swallow it once.
function eatGhostClick() {
  const t0 = performance.now();
  const h = (e) => { removeEventListener('click', h, true); if (performance.now() - t0 < 600) { e.stopPropagation(); e.preventDefault(); } };
  addEventListener('click', h, true);
  setTimeout(() => removeEventListener('click', h, true), 600);
}

/* ── the room contract (room-ui.js) ── */
export function click(id, hit, ctx) {
  ctxRef = ctx; ensure();
  eatGhostClick();
  const A = api(); if (!A) return;
  if (raf) return;   // let the tally finish counting
  if (id === 'fx:kickoff') { A.press(); ctx.feel.tap(); kickoff(); return; }
  if (id === 'fx:captain') { ctx.feel.tap(); setCap(!A.captainMode); return; }
  const m = /^fx:card:(\w+)$/.exec(id); if (!m) return;
  const s = A.slotOf(m[1]); if (!s) return;
  if (panel === 'tally') closePanel();
  if (A.captainMode) {
    if (!s.player) { toast('Add a player to this slot first'); return; }
    makeCaptain(s.player); setCap(false); return;
  }
  const sel = A.selected, a = sel && A.slotOf(sel);
  if (sel === s.slot) { ctx.feel.back(); closePanel(); return; }
  if (a?.player && s.player && a.pos === s.pos) { swapIds(a.player.id, s.player.id, `Swapped ${short(a.player)} and ${short(s.player)}`); return; }
  ctx.feel.tap();
  openPick(s);
}
export function hover(id, ctx) { ctx.room?.api?.hover(id); }
export function enter(ctx) {
  ctxRef = ctx; ensure();
  if (hinted) return;
  // once the 2D team builder (opened on the way in) is closed, say what the table does
  const show = () => { if (hinted || !ctxRef?.scene?.roomName) return; hinted = true; hint('Tap a card to <b>swap or transfer</b> · the <b>armband</b> picks your captain · <b>KICK-OFF</b> plays a matchweek', { ms: 6500 }); };
  const fx = document.querySelector('.fx');
  if (!fx || fx.hidden) { show(); return; }
  const mo = new MutationObserver(() => { if (fx.hidden) { mo.disconnect(); setTimeout(show, 300); } });
  mo.observe(fx, { attributes: true, attributeFilter: ['hidden'] });
}
export function leave(ctx) {
  ctxRef = ctx;
  if (raf) { cancelAnimationFrame(raf); raf = 0; if (counting) settle(counting); }
  if (root) { closePanel(); hint(null); }
  ctx.room?.api?.endTally();
  setCap(false);
  ctx.room?.api?.hover(null);
}
