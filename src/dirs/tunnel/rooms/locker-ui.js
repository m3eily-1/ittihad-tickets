// The changing room's interactions (Ahmed, 2026-10-21: "tap a shirt: take it off the hook, see the player card,
// try it on (your name/number), 'Buy this shirt' straight into the store; tap the tactics board to drag magnets
// into a formation"). The room UI contract is in ../room-ui.js; the 3D side (the shirt flying off its hook, the
// board's canvas) is the room module's API — takeShirt / hangShirt / printShirt / hoverShirt / drawBoard, in both
// changing.js and lockerroom.js (?locker=actual).
import './locker-ui.css';
import { SQUAD } from '../squad.js';
import { PRODUCTS } from '../products.js';
import { FORMATIONS, FORMATION_KEYS, presetOf, loadTactics, saveTactics, defaultTactics, playerOf } from './locker-board.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
// shirt print: A–Z only, as the store prints it (the accents in the squad's names come off)
const printName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z .'-]/g, '').slice(0, 12);
const SHIRT = 'home-26-27';
const price = () => { const p = PRODUCTS.find((x) => x.key === SHIRT); return p ? `SAR ${Math.round(p.price)}` : ''; };
const TRIED = 'itt-lk-tried-v1', MINE = 'itt-lk-print-v1';

/* ── one overlay root: the shirt sheet or the tactics board ── */
let root = null, mode = null, cx = null, timer = 0, openedAt = 0;
function mount() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'lk'; root.hidden = true; root.tabIndex = -1;
  document.body.append(root);
  // nothing in here walks you round the room, turns the camera or scrolls the page
  for (const ev of ['wheel', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keyup', 'contextmenu']) {
    root.addEventListener(ev, (e) => {
      if (ev === 'pointerdown') onDown(e); else if (ev === 'pointermove') onMove(e); else if (ev === 'pointerup' || ev === 'pointercancel') onUp(e);
      if (ev === 'keydown' && e.key === 'Escape') { e.preventDefault(); close(); }
      e.stopPropagation();
    }, { passive: ev !== 'pointerdown' && ev !== 'keydown' });
  }
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  // keys that land outside the panel (focus on the page) mustn't walk the camera or leave the room either
  addEventListener('keydown', (e) => {
    // (only keys aimed at the page itself: the store's sheet over this one handles its own)
    if (!mode || (e.target !== document.body && e.target !== document.documentElement) || cx?.shop?.open) return;
    if (e.key === 'Escape') close();
    e.stopPropagation();
  }, true);
  addEventListener('resize', () => { if (mode === 'shirt') aim(); if (mode === 'tac') layout(); });
  return root;
}
function show(cls, html) {
  mount();
  clearTimeout(timer);
  root.className = `lk ${cls}`; root.innerHTML = html; root.hidden = false; openedAt = performance.now();
  root.focus({ preventScroll: true });
}
function close({ now = false } = {}) {
  if (!root || !mode) return;
  const was = mode; mode = null;
  if (!now) cx?.feel?.back();
  if (was === 'shirt') cx?.room?.hangShirt?.();
  if (was === 'tac') { saveTactics(tac); cx?.room?.drawBoard?.(tac); }
  root.classList.remove('is-on');
  const done = () => { root.hidden = true; root.innerHTML = ''; root.className = 'lk'; };
  if (now) done(); else timer = setTimeout(done, 320);
}

/* ── the shirt: player card, try it on, buy ── */
let sh = null;   // { p, mine: bool, name, no }
function aim() {
  // the shirt floats in the part of the view the sheet leaves free
  const s = root?.querySelector('.lk-sheet'); if (!s || !sh) return;
  const r = { left: s.offsetLeft, top: s.offsetTop }, W = innerWidth, H = innerHeight;   // (offsets: the slide-in transform doesn't count)
  const portrait = H > W * 1.05;
  const anchor = portrait
    ? { x: 0, y: 1 - (r.top / H), h: Math.min(0.62, 0.82 * r.top / H) }
    : { x: ((r.left) / 2) / (W / 2) - 1, y: -0.02, h: 0.64 };
  cx?.room?.takeShirt?.(sh.p.no, anchor);
}
function openShirt(no, ctx) {
  const p = SQUAD.find((x) => x.no === no); if (!p) return;
  const last = load(MINE, null);
  sh = { p, mine: false, name: last?.name || printName(ctx.progress?.name || ''), no: last?.no ?? '' };
  mode = 'shirt';
  show('is-shirt', `<div class="lk-scrim" data-act="close"></div>
    <aside class="lk-sheet" role="dialog" aria-modal="true" aria-label="${esc(p.name)}'s shirt">
      <header class="lk-hd"><button type="button" class="lk-back" data-act="close">← Back to the room</button><p class="lk-k">Locker · No. ${p.no}</p></header>
      <div class="lk-card">
        <div class="lk-photo">${p.photo ? `<img src="${esc(p.photo)}" alt=""/>` : '<svg viewBox="0 0 100 125" aria-hidden="true"><circle cx="50" cy="44" r="19"/><path d="M14 125c2-34 16-50 36-50s34 16 36 50z"/></svg>'}</div>
        <div class="lk-meta"><b class="lk-no">${p.no}</b><h2 class="lk-name">${esc(p.name)}</h2><p class="lk-pos">${esc(p.pos)}</p></div>
      </div>
      <div class="lk-try">
        <div class="lk-prev"><img src="/img/jersey/back.webp" alt="The back of the 26/27 home shirt"/><b class="lk-pn js-lk-pn"></b><b class="lk-pno js-lk-pno"></b></div>
        <div class="lk-ctl">
          <div class="lk-seg" role="group" aria-label="Whose name"><button type="button" data-act="his" class="is-on">His shirt</button><button type="button" data-act="mine">Try it on</button></div>
          <div class="lk-fields">
            <label>Your name<input class="js-lk-name" maxlength="12" value="${esc(sh.name)}" placeholder="e.g. AHMED" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done"/></label>
            <label class="is-no">No.<input class="js-lk-no" inputmode="numeric" maxlength="2" value="${esc(sh.no)}" placeholder="${p.no}" autocomplete="off" enterkeyhint="done"/></label>
          </div>
          <p class="lk-fine js-lk-note"></p>
        </div>
      </div>
      <button type="button" class="lk-btn" data-act="buy">Buy this shirt${price() ? ` · ${price()}` : ''}</button>
    </aside>`);
  paintShirt();
  aim();
  ctx.feel?.tap();
  // the shirt comes off the hook first, then the card slides in beside it
  requestAnimationFrame(() => { timer = setTimeout(() => root.classList.add('is-on'), 260); });
}
const shown = () => (sh.mine ? { name: sh.name, no: sh.no } : { name: printName(sh.p.shirt), no: String(sh.p.no) });
function paintShirt() {
  const v = shown();
  root.classList.toggle('is-mine', sh.mine);
  root.querySelectorAll('.lk-seg button').forEach((b) => b.classList.toggle('is-on', (b.dataset.act === 'mine') === sh.mine));
  root.querySelector('.js-lk-pn').textContent = v.name || 'YOUR NAME';
  root.querySelector('.js-lk-pno').textContent = v.no === '' ? '00' : v.no;
  root.querySelector('.js-lk-note').textContent = sh.mine ? 'Up to 12 letters (A–Z) and a number from 0 to 99.' : `${printName(sh.p.shirt)} ${sh.p.no}, as it hangs in his locker.`;
  cx?.room?.printShirt?.(sh.mine ? { name: sh.name || 'YOUR NAME', no: sh.no === '' ? '00' : sh.no } : null);
}
function tryOn() {
  sh.mine = true; paintShirt();
  const tried = load(TRIED, []);
  if (!tried.includes(sh.p.no)) { tried.push(sh.p.no); store(TRIED, tried); cx?.progress?.award(15, 'Tried on a shirt'); }
  const inp = root.querySelector(sh.name ? '.js-lk-no' : '.js-lk-name');
  if (matchMedia('(pointer: fine)').matches) inp?.focus({ preventScroll: true });
}
function buy() {
  const v = shown();
  cx?.shop?.openProduct(SHIRT, { print: { name: v.name, no: v.no } });
}

/* ── the tactics board: eleven magnets on a pitch ── */
let tac = null, drag = null;
const vertical = () => innerHeight > innerWidth * 1.05;   // a phone held upright: the pitch stands up too
function openTactics(ctx) {
  tac = loadTactics() || defaultTactics();
  mode = 'tac';
  show('is-tac', `<div class="lk-tac" role="dialog" aria-modal="true" aria-label="Tactics board">
      <div class="lk-pitchwrap"><div class="lk-pitch js-lk-pitch"></div></div>
      <aside class="lk-side">
        <button type="button" class="lk-back" data-act="close">← Back to the room</button>
        <div><p class="lk-k">Tactics board</p><h2 class="lk-h">Your XI</h2><p class="lk-fine">Drag the magnets where you want them. Your line-up, not the coach's.</p></div>
        <div class="lk-forms" role="group" aria-label="Formation">${FORMATION_KEYS.map((f) => `<button type="button" data-act="form" data-f="${f}">${f}</button>`).join('')}</div>
        <div class="lk-acts"><button type="button" class="lk-btn is-ghost" data-act="reset">Reset</button><button type="button" class="lk-btn" data-act="done">Pin it up</button></div>
      </aside>
    </div>`);
  ctx.feel?.tap();
  layout();
  requestAnimationFrame(() => root.classList.add('is-on'));
}
function pitchSvg(v) {
  // markings in pitch metres (105 × 68), lying down or standing up
  const R = (x, y, w, h) => (v ? `<rect x="${y}" y="${105 - x - w}" width="${h}" height="${w}"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);
  const C = (x, y, r) => (v ? `<circle cx="${y}" cy="${105 - x}" r="${r}"/>` : `<circle cx="${x}" cy="${y}" r="${r}"/>`);
  const Ln = (x1, y1, x2, y2) => (v ? `<line x1="${y1}" y1="${105 - x1}" x2="${y2}" y2="${105 - x2}"/>` : `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  const stripes = Array.from({ length: 10 }, (_, i) => (i % 2 ? '' : R(i * 10.5, 0, 10.5, 68).replace('<rect', '<rect class="s"'))).join('');
  return `<svg viewBox="0 0 ${v ? '68 105' : '105 68'}" preserveAspectRatio="none" aria-hidden="true"><g class="st">${stripes}</g><g class="ln">
    ${R(1.5, 1.5, 102, 65)}${Ln(52.5, 1.5, 52.5, 66.5)}${C(52.5, 34, 9.15)}${C(52.5, 34, 0.5)}
    ${R(1.5, 13.84, 16.5, 40.32)}${R(1.5, 24.84, 5.5, 18.32)}${R(87, 13.84, 16.5, 40.32)}${R(98, 24.84, 5.5, 18.32)}${C(12.5, 34, 0.5)}${C(92.5, 34, 0.5)}</g>
    <text x="${v ? 34 : 101}" y="${v ? 4.2 : 34}" class="dir" ${v ? '' : 'transform="rotate(90 101 34)"'}>ATTACK</text></svg>`;
}
function layout() {
  const wrap = root?.querySelector('.lk-pitchwrap'), pitch = root?.querySelector('.js-lk-pitch'); if (!wrap || !pitch) return;
  const v = vertical(), a = v ? 68 / 105 : 105 / 68, r = wrap.getBoundingClientRect();
  let w = r.width, h = w / a; if (h > r.height) { h = r.height; w = h * a; }
  pitch.style.width = `${Math.floor(w)}px`; pitch.style.height = `${Math.floor(h)}px`;
  pitch.style.setProperty('--tok', `${Math.round(Math.max(36, Math.min(54, Math.min(w, h) * 0.095)))}px`);
  if (pitch.dataset.v !== String(v)) {
    pitch.dataset.v = String(v);
    pitch.innerHTML = pitchSvg(v) + tac.pos.map((_, i) => `<button type="button" class="lk-tok${i === 0 ? ' is-gk' : ''}" data-i="${i}" aria-label=""><b></b><span></span></button>`).join('');
  }
  paintTokens(true);
}
function place(el, p) {
  const v = vertical();
  el.style.left = `${(v ? p.v : p.u) * 100}%`; el.style.top = `${(v ? 1 - p.u : p.v) * 100}%`;
}
function paintTokens(instant = false) {
  const pitch = root.querySelector('.js-lk-pitch');
  if (instant) pitch.classList.add('is-still');
  pitch.querySelectorAll('.lk-tok').forEach((el) => {
    const p = tac.pos[+el.dataset.i], pl = playerOf(p.no);
    el.querySelector('b').textContent = p.no;
    el.querySelector('span').textContent = (pl?.shirt || '').toUpperCase();
    el.setAttribute('aria-label', `${p.no} ${pl?.name || ''}`);
    place(el, p);
  });
  root.querySelectorAll('.lk-forms button').forEach((b) => b.classList.toggle('is-on', b.dataset.f === tac.f));
  if (instant) requestAnimationFrame(() => requestAnimationFrame(() => pitch.classList.remove('is-still')));
}
function setFormation(f) {
  if (!FORMATIONS[f]) return;
  tac = { f, pos: presetOf(f) };
  paintTokens(); saveTactics(tac);
}
function onDown(e) {
  if (mode !== 'tac') return;
  const el = e.target.closest?.('.lk-tok'); if (!el) return;
  e.preventDefault();
  el.setPointerCapture?.(e.pointerId);
  drag = { id: e.pointerId, el, i: +el.dataset.i, moved: false };
  el.classList.add('is-drag');
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const r = root.querySelector('.js-lk-pitch').getBoundingClientRect();
  const fx = Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width)), fy = Math.min(0.97, Math.max(0.03, (e.clientY - r.top) / r.height));
  const p = tac.pos[drag.i];
  if (vertical()) { p.v = fx; p.u = 1 - fy; } else { p.u = fx; p.v = fy; }
  drag.moved = true;
  place(drag.el, p);
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.el.classList.remove('is-drag');
  if (drag.moved) { saveTactics(tac); cx?.feel?.tap(); }
  drag = null;
}

/* ── events ── */
function onInput(e) {
  const t = e.target;
  if (!sh || mode !== 'shirt') return;
  if (t.classList.contains('js-lk-name')) { t.value = printName(t.value); sh.name = t.value; }
  else if (t.classList.contains('js-lk-no')) { t.value = t.value.replace(/\D/g, '').slice(0, 2); sh.no = t.value; }
  else return;
  store(MINE, { name: sh.name, no: sh.no });
  if (!sh.mine) { tryOn(); return; }
  paintShirt();
}
function onClick(e) {
  // a tap in the room opens this on pointerup; the browser's click for that same tap lands here a moment later
  if (performance.now() - openedAt < 450) return;
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'close') return close();
  cx?.feel?.tap();
  if (a === 'his') { sh.mine = false; return paintShirt(); }
  if (a === 'mine') return tryOn();
  if (a === 'buy') return buy();
  if (a === 'form') return setFormation(b.dataset.f);
  if (a === 'reset') return setFormation(tac.f);
  if (a === 'done') return close();
}

/* ── the room UI contract (../room-ui.js) ── */
export function click(id, hit, ctx) {
  if (mode) return;
  cx = ctx;
  const m = /^shirt:(\d+)$/.exec(id || '');
  if (m) return openShirt(+m[1], ctx);
  if (id === 'board') return openTactics(ctx);
}
export function hover(id, ctx) {
  const m = /^shirt:(\d+)$/.exec(id || '');
  ctx.room?.hoverShirt?.(m ? +m[1] : null);
}
export function leave(ctx) {
  cx = cx || ctx;
  close({ now: true });
  ctx.room?.resetShirt?.();
  ctx.room?.hoverShirt?.(null);
}
