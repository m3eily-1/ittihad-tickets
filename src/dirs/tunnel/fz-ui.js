// One page shell for the fan-zone pages (leagues, the cup, the derby, the fan goal): the app's board page (.sc-board,
// so the shared look, the 0.25 s fade, Escape-to-back and is-under all apply), back top-left, one Anton title,
// an optional chip on the right, and a body that scrolls under the header.
import './fanzone.css';
import { feel } from './feel.js';
import { esc } from './fz-core.js';

export function fzPage({ cls, title, chip = '', onClose, label = title }) {
  const el = document.createElement('div');
  el.className = `sc-board fz-page ${cls}`;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', label);
  el.innerHTML = `<header class="sc-hd fz-hd"><button type="button" class="sc-back js-fz-back" aria-label="Back">← Back</button><div><h2>${esc(title)}</h2></div><p class="fz-chip js-fz-chip"${chip ? '' : ' hidden'}>${chip}</p></header>
    <div class="fz-body js-fz-body"></div><p class="fz-toast" role="status" aria-live="polite"></p>`;
  document.body.append(el);
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  requestAnimationFrame(() => el.classList.add('is-on'));
  let closed = false, toastT = 0;
  const timers = new Set();
  const api = {
    el,
    body: el.querySelector('.js-fz-body'),
    chip(html) { const c = el.querySelector('.js-fz-chip'); c.hidden = !html; c.innerHTML = html || ''; },
    every(fn, ms) { const t = setInterval(() => { if (!el.isConnected) { clearInterval(t); return; } fn(); }, ms); timers.add(t); return t; },
    toast(t) { const n = el.querySelector('.fz-toast'); n.textContent = t; n.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => n.classList.remove('is-on'), 2600); },
    // a page opened from this one: this steps aside until it comes back
    under(on) { el.classList.toggle('is-under', on); },
    close({ silent = false } = {}) {
      if (closed) return; closed = true;
      timers.forEach(clearInterval); el.classList.remove('is-on'); setTimeout(() => el.remove(), 250);
      if (!silent) onClose?.();
    },
  };
  el.querySelector('.js-fz-back').addEventListener('click', () => { feel.back(); api.close(); });
  return api;
}
// a bar split two ways (the derby) or filled to a goal
export const meter = (k, { cls = '' } = {}) => `<span class="fz-meter ${cls}"><i style="width:${Math.max(0, Math.min(100, k * 100)).toFixed(1)}%"></i></span>`;
