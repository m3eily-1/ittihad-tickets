// Direction G · Mix — C's liquid hero (with its nav, menu and footer), then E's on-sale fixtures with the
// PVW poster preview, then D's flip-card season pass and wallet. Each part runs on its source page's own
// modules; this file only wires them together on one Lenis scroll. The C glue below (content, nav/menu,
// WebGL stage, intro) mirrors liquid/main.js, trimmed to the parts G has.
import '@fontsource/anton/400.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '../../shared/base.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { $, $$, split, initCursor, initMagnetic, reduced, fine } from '../../ui.js';
import { mountDirNav } from '../../shared/dirnav.js';
import { LINKS, eventUrl, when, countdown, pad, nextMatch } from '../../data.js';
// C · liquid
import { setupDrip, setupFooterLens, initPlayersParallax } from '../liquid/parts.js';
// E · broadcast
import { renderFixtures, revealHead } from '../broadcast/sections.js';
// D · deck
import { setupSeason, setupApp, revealHeadings } from '../deck/sections.js';

gsap.registerPlugin(ScrollTrigger);
const dirnav = mountDirNav('mix');

const params = new URLSearchParams(location.search);
const RM = reduced();
const SKIP = params.has('skip') || RM;
const root = document.documentElement;
root.classList.add(fine() ? 'is-fine' : 'is-touch');
if (RM) { root.classList.add('is-reduced'); document.body.classList.add('is-still'); }

/* ───────────── C · hero + footer content ───────────── */
const next = nextMatch();
{
  const w = when(next.kickoff);
  $('.js-next-opp').textContent = next.opp;
  $('.js-next-crest').src = next.crest;
  $('.js-next-crest').alt = `${next.opp} crest`;
  $('.js-next-meta').innerHTML = `<b>${w.day} ${w.date} ${w.month}</b> · ${w.time} · ${next.compLabel} · ${next.venue}`;
  $('.js-next-book').href = eventUrl(next.slug);
}
const setHref = (sel, url) => $$(sel).forEach((a) => { a.href = url; });
setHref('.js-resale', LINKS.resale);
setHref('.js-about', LINKS.about);
setHref('.js-store', LINKS.store);
setHref('.js-x', LINKS.x);
setHref('.js-ig', LINKS.instagram);
setHref('.js-yt', LINKS.youtube);
setHref('.js-sc', LINKS.snapchat);

{
  const b = $$('.js-next-count b');
  const tick = () => { const c = countdown(next.kickoff); [c.d, c.h, c.m, c.s].forEach((v, i) => { const t = pad(v); if (b[i].textContent !== t) b[i].textContent = t; }); };
  tick();
  setInterval(tick, 1000);
}

/* ───────────── E · fixtures ───────────── */
// E keeps its content clear of the direction switcher when it docks on the side (broadcast/main.js clearDirNav)
function clearDirNav() {
  let x = 0;
  if (dirnav && getComputedStyle(dirnav).display !== 'none') {
    const r = dirnav.getBoundingClientRect();
    if (r.bottom <= innerHeight - 4) x = innerWidth - r.left + 6;
  }
  $('.g-e').style.setProperty('--dn-x', `${x}px`);
}
clearDirNav();
renderFixtures({ still: RM });
$$('.g-e .gl-txt').forEach((el) => split(el));

/* ───────────── D · season pass + app ───────────── */
$$('.g-d .js-split').forEach((el) => { $$('em', el).forEach((em) => split(em)); split(el); });
setupSeason();
setupApp();

/* ───────────── smooth scroll ───────────── */
let lenis = null;
const vel = () => (lenis ? lenis.velocity : 0);
if (!RM) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  closeMenu();
  if (lenis) lenis.scrollTo(id === '#top' ? 0 : id, { duration: 1.6, offset: id === '#top' ? 0 : -10 });
  else (id === '#top' ? scrollTo(0, 0) : $(id)?.scrollIntoView());
}));

/* ───────────── C · nav + menu ───────────── */
const nav = $('.g-c .nav');
const burger = $('.g-c .nav__burger');
const menu = $('.g-c .menu');
let lastY = 0;
function onScroll(y) {
  const down = y > lastY && y > 240;
  if (!document.body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', down);
  nav.classList.toggle('is-solid', y > innerHeight * 0.55);
  lastY = y;
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else addEventListener('scroll', () => onScroll(scrollY), { passive: true });

function openMenu() {
  const r = burger.getBoundingClientRect();
  menu.style.setProperty('--ox', `${r.left + r.width / 2}px`);
  menu.style.setProperty('--oy', `${r.top + r.height / 2}px`);
  document.body.classList.add('menu-open');
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Close menu');
  menu.setAttribute('aria-hidden', 'false');
  lenis?.stop();
  if (!RM) gsap.fromTo('.g-c .menu__links a', { yPercent: 110, skewY: 8 }, { yPercent: 0, skewY: 0, stagger: 0.06, duration: 1, ease: 'expo.out', delay: 0.2 });
}
function closeMenu() {
  if (!document.body.classList.contains('menu-open')) return;
  document.body.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Open menu');
  menu.setAttribute('aria-hidden', 'true');
  lenis?.start();
}
burger.addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ───────────── cursor + magnetic (all three components) ───────────── */
initCursor();
initMagnetic();

/* ───────────── scroll-driven parts ───────────── */
if (!RM) $$('.g-e .gh').forEach(revealHead);   // E · header keys in
revealHeadings();                               // D · headings rise out of their masks
$$('.g-c .js-drip').forEach((el) => setupDrip(el, RM));   // C · black ink drips into the footer
setupFooterLens(RM);                            // C · footer lens
if (!RM) {
  ScrollTrigger.batch('.g-c .foot__grid > *', {
    start: 'top 90%', once: true,
    onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });
}

/* ───────────── C · hero intro ───────────── */
let stage = null;
function intro() {
  if (SKIP) return;
  const tl = gsap.timeline({ delay: 0.15 });
  // the nav's CSS transform transition fights the tween (it froze off-screen), so pause it meanwhile
  nav.style.transition = 'none';
  tl.from(nav, { yPercent: -120, duration: 1.1, ease: 'expo.out', clearProps: 'transform,transition' }, 0.6)
    .from('.g-c .hero__top > *', { y: 20, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.9)
    .from('.g-c .next > *, .g-c .hero__ctas > *', { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07 }, 1.2)
    .from('.g-c .hero__hint', { opacity: 0, duration: 1 }, 1.8);
  if (!stage?.hasHero) tl.from('.g-c .hero__fallback span', { yPercent: 100, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 }, 0.2);
}

/* ───────────── C · WebGL stage: liquid type + the players plane ───────────── */
if (!RM) {
  const { createStage } = await import('../liquid/gl.js');
  await Promise.race([
    Promise.all([document.fonts.load('400 100px Anton'), document.fonts.ready]),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
  try {
    stage = createStage({ hero: $('#top'), stage: $('.js-stage'), getVelocity: vel, intro: !SKIP });
  } catch (err) {
    console.warn('[mix] WebGL unavailable, using the DOM version', err);
    stage = null;
  }
  if (stage) {
    if (stage.hasHero) root.classList.add('gl-hero');
    // only C's hero carries [data-gl]; E's and D's images stay plain DOM, as on their own pages
    $$('.g-c [data-gl]').forEach((el) => {
      const mode = +(el.dataset.glMode || 0);
      const p = stage.addPlane(el, { mode, clip: mode === 2 ? el.closest('.hero') : null });
      if (!p) return;
      p.reveal = 0;
      if (SKIP) p.reveal = 1;
      else gsap.to(p, { reveal: 1, duration: 2.2, ease: 'power2.inOut', delay: 0.7 });
    });
    gsap.ticker.add((_, dt) => stage.frame(dt / 1000));
    document.addEventListener('visibilitychange', () => stage.setRunning(!document.hidden));
  }
  initPlayersParallax($('.js-players-in'), $('#top'));
}
intro();

addEventListener('resize', () => { clearDirNav(); ScrollTrigger.refresh(); });
addEventListener('load', () => ScrollTrigger.refresh());
document.fonts.ready.then(() => ScrollTrigger.refresh());
