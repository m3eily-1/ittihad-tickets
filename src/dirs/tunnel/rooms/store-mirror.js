// The try-on mirror (store room): the home shirt's back with your name and number, as you type — and the 3D
// mirror in the room shows the same print. "Add to cart" hands over to the store's product sheet with the print
// filled in (size is picked there). Own root on <body>, prefix st-, z 172 (the shop sheet, z 185, opens above).
import './store-room.css';
import { PRODUCTS } from '../products.js';
import { SQUAD } from '../squad.js';

const KEY = 'itt-store-room-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clean = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z .'-]/g, '').slice(0, 12);
const HOME = PRODUCTS.find((p) => p.key === 'home-26-27');
// a few first-team shirts to try (forwards and midfielders first)
const PICKS = [...SQUAD.filter((s) => s.pos === 'Forward'), ...SQUAD.filter((s) => s.pos === 'Midfielder')].slice(0, 4)
  .map((s) => ({ name: clean(s.shirt), no: String(s.no) })).filter((s) => s.name);

let root = null, ctxRef = null, state = { name: '', no: '' };

function build() {
  root = document.createElement('div');
  root.className = 'st-mirror'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Try-on mirror');
  root.setAttribute('data-lenis-prevent', '');
  document.body.append(root);
  // the scene listens on window (W A S D, wheel, drags): keep everything that happens in here to ourselves
  for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'keydown', 'keyup', 'touchstart', 'touchmove', 'contextmenu']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') closeMirror(); }, { passive: ev !== 'contextmenu' });
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
}
function render() {
  const you = (ctxRef?.progress?.name || '').trim();
  const chips = [...(you ? [{ name: clean(you), no: state.no || '10', you: true }] : []), ...PICKS];
  root.innerHTML = `<div class="st-mirror__panel">
    <header class="st-hd">
      <button type="button" class="st-back" data-act="close">← Back</button>
      <div><h2 class="st-h">Your name on the back</h2></div>
    </header>
    <div class="st-mirror__body">
      <div class="st-mirror__glass" aria-hidden="true">
        <div class="st-shirt"><img src="/img/jersey/back.webp" alt=""/><b class="st-shirt__n js-st-n">${esc(state.name || 'YOUR NAME')}</b><b class="st-shirt__no js-st-no">${esc(state.no || '10')}</b></div>
        <i class="st-mirror__sheen"></i>
      </div>
      <div class="st-mirror__form">
        <div class="st-row">
          <label class="st-field">Name<input class="js-st-name" maxlength="12" value="${esc(state.name)}" placeholder="e.g. AHMED" autocomplete="off" spellcheck="false"/></label>
          <label class="st-field is-no">Number<input class="js-st-num" inputmode="numeric" maxlength="2" value="${esc(state.no)}" placeholder="10" autocomplete="off"/></label>
        </div>
        ${chips.length ? `<p class="st-lab">Or try one on</p><div class="st-chips">${chips.map((c) => `<button type="button" data-act="chip" data-n="${esc(c.name)}" data-no="${esc(c.no)}">${c.you ? 'You · ' : ''}${esc(c.name)} <b>${esc(c.no)}</b></button>`).join('')}</div>` : ''}
        <p class="st-price">${esc(HOME?.name || 'Home jersey 26/27')} <b>SAR ${HOME ? HOME.price.toLocaleString('en') : ''}</b></p>
        <div class="st-ctas">
          <button type="button" class="st-btn" data-act="add">Add to cart</button>
          <button type="button" class="st-btn is-2" data-act="close">Keep browsing</button>
        </div>
        <p class="st-fine">You pick the size next. The mirror in the store shows your print too.</p>
      </div>
    </div>
  </div>`;
}
function sync() {
  const n = root.querySelector('.js-st-n'), no = root.querySelector('.js-st-no');
  if (n) n.textContent = state.name || 'YOUR NAME';
  if (no) no.textContent = state.no || '10';
  ctxRef?.room?.api?.setMirrorPrint(state.name, state.no);
  const st = load(); st.print = { name: state.name, no: state.no }; save(st);
}
function onInput(e) {
  const t = e.target;
  if (t.classList.contains('js-st-name')) { t.value = clean(t.value); state.name = t.value; sync(); }
  if (t.classList.contains('js-st-num')) { t.value = t.value.replace(/\D/g, '').slice(0, 2); state.no = t.value; sync(); }
}
function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b) { if (e.target === root) closeMirror(); return; }
  const a = b.dataset.act;
  if (a === 'close') { ctxRef?.feel?.back(); closeMirror(); return; }
  if (a === 'chip') {
    ctxRef?.feel?.tap();
    state = { name: b.dataset.n, no: b.dataset.no };
    root.querySelector('.js-st-name').value = state.name; root.querySelector('.js-st-num').value = state.no;
    sync(); return;
  }
  if (a === 'add') {
    const name = state.name.trim(), no = state.no.trim();
    if (!name || !no) {
      const el = root.querySelector(!name ? '.js-st-name' : '.js-st-num');
      el.focus(); el.closest('.st-field').classList.add('is-err'); setTimeout(() => el.closest('.st-field')?.classList.remove('is-err'), 900);
      return;
    }
    ctxRef?.feel?.tap();
    const shop = ctxRef?.shop;
    closeMirror();
    shop?.openProduct('home-26-27', { print: { name, no: String(+no) } });
  }
}

export function openMirror(ctx) {
  ctxRef = ctx;
  if (!root) build();
  const st = load();
  state = st.print ? { name: st.print.name || '', no: st.print.no || '' } : { name: '', no: '' };
  render();
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('is-on'));
  if (matchMedia('(pointer: fine)').matches) setTimeout(() => root.querySelector('.js-st-name')?.focus(), 60);
}
export function closeMirror() {
  if (!root || root.hidden) return;
  root.classList.remove('is-on');
  document.activeElement?.blur?.();
  setTimeout(() => { if (!root.classList.contains('is-on')) root.hidden = true; }, 220);
}
