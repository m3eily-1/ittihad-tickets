// Stingers: the full stripe wipe that hides a cut, and a lighter band that passes on section changes.
import gsap from 'gsap';
import { $, $$ } from '../../ui.js';

const SKEW = 18; // degrees, matches the CSS

let busy = false;
let lastBand = 0;

function geometry() {
  const vw = innerWidth, vh = innerHeight;
  const off = Math.tan((SKEW * Math.PI) / 180) * vh; // horizontal shift top-to-bottom of a skewed panel
  return { vw, vh, off, W: vw + off * 2 + 80 };
}

function layout() {
  if (!$('.stg')) return; // pages that borrow glitch() without the stinger markup (mix.html)
  const { W, off, vw } = geometry();
  $$('.stg__l').forEach((l) => { l.style.width = `${W}px`; l.style.left = `${-off / 2 - 40}px`; });
  gsap.set('.stg__l', { skewX: -SKEW, x: -(W + off) });
  gsap.set('.band i', { skewX: -SKEW });
  // the ident sits at the viewport centre while the layer covers the screen
  gsap.set('.stg__mark', { left: off / 2 + 40 + vw / 2, xPercent: -50, yPercent: -50 });
}
addEventListener('resize', layout);
layout();

// full wipe: resolves once the screen is covered (do the cut then), returns the whole timeline
export function cut(onCover, { still = false, label = 'Matchday', sub = 'Ittihad Tickets' } = {}) {
  if (still) { onCover?.(); return Promise.resolve(); }
  if (busy) { onCover?.(); return Promise.resolve(); }
  busy = true;
  $('.stg__txt b').textContent = label;
  $('.stg__txt small').textContent = sub;
  const { vw, W, off } = geometry();
  const layers = $$('.stg__l');
  const stg = $('.stg');
  return new Promise((resolve) => {
    gsap.timeline({ onComplete: () => { busy = false; stg.classList.remove('is-on'); resolve(); } })
      .add(() => stg.classList.add('is-on'))
      .fromTo(layers, { x: -(W + off) }, { x: 0, duration: 0.42, stagger: 0.06, ease: 'power3.in' })
      .add(() => onCover?.())
      .fromTo('.stg__mark', { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.3, ease: 'expo.out' }, '-=0.16')
      .to({}, { duration: 0.16 })
      .to(layers, { x: vw + off * 1.5, duration: 0.5, stagger: { each: 0.06, from: 'end' }, ease: 'power3.in' })
      .set(layers, { x: -(W + off) });
  });
}

// passing band: two skewed stripes cross the screen without covering it
export function band({ still = false } = {}) {
  if (still || busy) return;
  const now = performance.now();
  if (now - lastBand < 1100) return; // never more than one pass a second
  lastBand = now;
  const bars = $$('.band i');
  const vw = innerWidth;
  gsap.killTweensOf(bars);
  gsap.fromTo(bars, { x: -vw * 0.5 }, { x: vw * 1.35, duration: 0.62, stagger: 0.07, ease: 'power2.inOut' });
}

// short glitch on a heading: CSS keyframes, re-triggered
export function glitch(el, { still = false } = {}) {
  if (!el || still) return;
  el.classList.remove('is-glitch');
  void el.offsetWidth;
  el.classList.add('is-glitch');
  clearTimeout(el._gt);
  el._gt = setTimeout(() => el.classList.remove('is-glitch'), 520);
}
