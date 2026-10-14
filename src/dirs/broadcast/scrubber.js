// The replay scrubber: a broadcast timeline fixed to the bottom that IS the scrollbar.
// Page progress reads as a 90-minute match clock; markers are the sections ("KICK-OFF" … "FULL TIME").
// Drag or tap the track to scrub, press a marker to cut there behind a stinger.
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$ } from '../../ui.js';
import { cut, band, glitch } from './stinger.js';

gsap.registerPlugin(Draggable);

const clock = (p) => {
  const secs = Math.round(Math.max(0, Math.min(1, p)) * 90 * 60);
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
};

export function createScrubber({ lenis, still }) {
  const track = $('.js-scrub-track');
  const head = $('.js-scrub-head');
  const fill = $('.js-scrub-fill');
  const tip = $('.js-scrub-tip');
  const tc = $('.js-scrub-tc');
  const now = $('.js-scrub-sec');
  const marksEl = $('.js-scrub-marks');
  const secs = $$('[data-mark]').map((el) => ({ el, id: el.id, label: el.dataset.mark, p: 0 }));

  marksEl.innerHTML = secs.map((s, i) => `<button type="button" class="scrub__mk" data-i="${i}" aria-label="Cut to ${s.label}"><span class="scrub__min"></span><b>${s.label}</b></button>`).join('');
  const marks = $$('.scrub__mk', marksEl);

  let max = 1, W = 1, dragging = false, cutting = false, cur = -1, p = 0;

  function measure() {
    max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    W = track.clientWidth;
    secs.forEach((s, i) => {
      const top = s.el.getBoundingClientRect().top + scrollY;
      s.y = i === secs.length - 1 ? max : Math.min(max, top);
      s.p = s.y / max;
      const m = marks[i];
      m.style.left = `${s.p * 100}%`;
      $('.scrub__min', m).textContent = `${Math.round(s.p * 90)}'`;
    });
    // the last marker hugs the end, so its label grows leftwards
    marks.forEach((m, i) => { m.classList.toggle('is-end', secs[i].p > 0.9); m.classList.remove('is-tight'); });
    // labels that would collide with the next one collapse to their minute stamp
    const box = (m) => { const l = m.offsetLeft, w = m.offsetWidth; return m.classList.contains('is-end') ? [l - w, l] : [l, l + w]; };
    for (let i = marks.length - 2; i >= 0; i--) {
      const [, r] = box(marks[i]);
      const [l2] = box(marks[i + 1]);
      if (r + 10 > l2) marks[i].classList.add('is-tight');
    }
    render(lenis.scroll);
  }

  function sectionAt(y) {
    let i = 0;
    for (let k = 0; k < secs.length; k++) if (y + innerHeight * 0.45 >= secs[k].y) i = k;
    // the footer is short: count the very end as full time
    if (y >= max - 2) i = secs.length - 1;
    return i;
  }

  function render(y) {
    p = Math.max(0, Math.min(1, y / max));
    if (!dragging) gsap.set(head, { x: p * W });
    gsap.set(fill, { scaleX: p });
    tc.textContent = clock(p);
    track.setAttribute('aria-valuenow', String(Math.round(p * 90)));
    track.setAttribute('aria-valuetext', `${clock(p)}, ${secs[sectionAt(y)].label}`);
    const i = sectionAt(y);
    if (i !== cur) {
      const first = cur === -1;
      cur = i;
      now.textContent = secs[i].label;
      marks.forEach((m, k) => { m.classList.toggle('is-on', k === i); m.classList.toggle('is-past', k < i); });
      document.body.dataset.sec = secs[i].id;
      if (!first && !cutting && !dragging) {
        band({ still });
        glitch($('.gl-txt', secs[i].el), { still });
      }
      glitch(now.parentElement, { still });
    }
  }

  lenis.on('scroll', ({ scroll }) => render(scroll));
  ScrollTrigger.addEventListener('refresh', measure);
  addEventListener('resize', measure);
  if (window.ResizeObserver) new ResizeObserver(() => measure()).observe(document.body);
  measure();

  /* drag the playhead (or press anywhere on the track) to scrub */
  const seek = (x) => {
    const q = Math.max(0, Math.min(1, x / W));
    lenis.scrollTo(q * max, { immediate: true, force: true });
    showTip(q);
  };
  function showTip(q) {
    const i = sectionAt(q * max);
    tip.innerHTML = `<b>${clock(q)}</b>${secs[i].label}`;
    gsap.set(tip, { x: Math.max(40, Math.min(W - 40, q * W)) });
  }
  const [drag] = Draggable.create(head, {
    type: 'x',
    trigger: track,
    bounds: { minX: 0, maxX: W },
    cursor: 'grab',
    activeCursor: 'grabbing',
    onPress(e) {
      // jump to the press point first, then keep dragging from there
      const r = track.getBoundingClientRect();
      const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
      gsap.set(head, { x: Math.max(0, Math.min(W, x)) });
      this.update();
      dragging = true;
      document.body.classList.add('is-scrubbing');
      seek(this.x);
    },
    onDrag() { seek(this.x); },
    onRelease() {
      dragging = false;
      document.body.classList.remove('is-scrubbing');
      render(lenis.scroll);
    },
  });
  addEventListener('resize', () => drag.applyBounds({ minX: 0, maxX: W }));

  // hover preview: where would I land?
  track.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = track.getBoundingClientRect();
    showTip((e.clientX - r.left) / W);
  });

  // keyboard: arrows nudge a minute, Home/End jump to kick-off/full time
  track.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: 10, PageUp: -10 }[e.key];
    if (step) { e.preventDefault(); lenis.scrollTo(Math.max(0, Math.min(max, (p + step / 90) * max)), { duration: 0.4 }); }
    if (e.key === 'Home') { e.preventDefault(); cutTo(0); }
    if (e.key === 'End') { e.preventDefault(); cutTo(secs.length - 1); }
  });

  /* markers: hard cut behind the stinger */
  function cutTo(i) {
    const s = secs[i];
    if (!s) return;
    cutting = true;
    const target = i === 0 ? 0 : i === secs.length - 1 ? max : s.y;
    cut(() => {
      lenis.scrollTo(target, { immediate: true, force: true });
      render(target);
      glitch($('.gl-txt', s.el), { still });
    }, { still, label: s.label, sub: `${Math.round(s.p * 90)}' · Cut to` }).then(() => { cutting = false; });
  }
  marks.forEach((m, i) => m.addEventListener('click', () => cutTo(i)));

  const cutToId = (id) => { const i = secs.findIndex((s) => s.id === id); if (i < 0) return false; cutTo(i); return true; };
  return { measure, cutTo, cutToId };
}
