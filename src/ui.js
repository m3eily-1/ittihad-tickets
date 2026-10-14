// Page-wide interaction primitives: text splitting, cursor, magnetic elements, marquees, clock.
import gsap from 'gsap';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

// Wrap words in masks (.w > i), optionally chars (.c) inside them.
export function split(el, { chars = false } = {}) {
  if (el.dataset.split) return el;
  el.dataset.split = '1';
  const nodes = [...el.childNodes];
  el.textContent = '';
  for (const n of nodes) {
    if (n.nodeType !== 3) { el.append(n); continue; }
    for (const tok of n.textContent.split(/(\s+)/)) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) { el.append(' '); continue; }
      const w = document.createElement('span');
      w.className = 'w';
      const i = document.createElement('i');
      if (chars) {
        for (const ch of tok) {
          const c = document.createElement('span');
          c.className = 'c';
          c.textContent = ch;
          i.append(c);
        }
      } else i.textContent = tok;
      w.append(i);
      el.append(w);
    }
  }
  return el;
}

export function splitAll() {
  $$('.js-split').forEach((el) => {
    // <em> inside headings keeps its colour: split its text in place
    $$('em', el).forEach((em) => split(em));
    split(el);
  });
  $$('.js-fill').forEach((el) => split(el));
  $$('.js-foot-word').forEach((el) => split(el, { chars: true }));
  // nav links roll to a yellow copy on hover
  $$('[data-roll]').forEach((a) => {
    const txt = a.textContent;
    a.innerHTML = `<span>${txt}</span><span aria-hidden="true">${txt}</span>`;
  });
}

// ── cursor: dot + lagging ring; grows on links, shows a label on [data-cursor="label"]
export function initCursor() {
  const el = $('.cursor');
  if (!el || !fine()) return;
  const dot = $('.cursor__dot', el), ring = $('.cursor__ring', el), label = $('.cursor__label', el);
  const dx = gsap.quickTo(dot, 'x', { duration: 0.06 }), dy = gsap.quickTo(dot, 'y', { duration: 0.06 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.42, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.42, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    el.classList.remove('is-hidden');
  });
  document.addEventListener('pointerleave', () => el.classList.add('is-hidden'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor]');
    if (t) {
      label.textContent = t.dataset.cursorLabel || '';
      el.classList.add('is-label');
      el.classList.remove('is-link');
      return;
    }
    el.classList.remove('is-label');
    el.classList.toggle('is-link', !!e.target.closest('a, button, .fxr, .venue:not(.is-open), .hvf__list li'));
  });
}

// ── magnetic: element drifts toward the pointer, its label a little further
export function initMagnetic(root = document) {
  if (!fine()) return;
  $$('.magnetic', root).forEach((m) => {
    if (m.dataset.mag) return;
    m.dataset.mag = '1';
    const inner = m.querySelector('span');
    const xTo = gsap.quickTo(m, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(m, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const ixTo = inner && gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const iyTo = inner && gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    m.addEventListener('pointermove', (e) => {
      const r = m.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      xTo(x * 0.3); yTo(y * 0.4);
      if (inner) { ixTo(x * 0.12); iyTo(y * 0.14); }
    });
    m.addEventListener('pointerleave', () => { xTo(0); yTo(0); if (inner) { ixTo(0); iyTo(0); } });
  });
}

// ── marquee: content duplicated until it overfills, drift speeds up with scroll velocity
export function initMarquee(track, getVelocity, { speed = 60, dir = -1 } = {}) {
  if (!track) return;
  const base = track.innerHTML;
  track.innerHTML = base + base;
  while (track.scrollWidth < innerWidth * 2.2) track.innerHTML += base;
  let x = 0, boost = 0;
  const half = () => track.scrollWidth / 2;
  gsap.ticker.add((_, dt) => {
    const v = getVelocity?.() || 0;
    boost += (Math.min(Math.abs(v) * 0.9, 30) - boost) * 0.08;
    x += dir * (speed + boost * 22) * (dt / 1000);
    const h = half();
    if (x <= -h) x += h;
    if (x > 0) x -= h;
    track.style.transform = `translate3d(${x}px,0,0)`;
  });
}

// ── Jeddah clock in the nav
export function initClock() {
  const el = $('.js-clock');
  if (!el) return;
  const tick = () => {
    el.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' }).format(new Date());
  };
  tick();
  setInterval(tick, 10000);
}
