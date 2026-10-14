// Direction A · "Every Seat": 60,000 seat particles and a dot-matrix data-viz page around them.
import '../../shared/base.css';
import '@fontsource/anton/400.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { $, $$, split, initCursor, initMagnetic, initClock, reduced, fine } from '../../ui.js';
import { mountDirNav } from '../../shared/dirnav.js';
import { nextMatch, eventUrl, when } from '../../data.js';
import { renderFixtures, setupSeason, setupApp, renderLinks, renderPartners, footerField, addCountdown } from './sections.js';

gsap.registerPlugin(ScrollTrigger);
mountDirNav('seats');

const params = new URLSearchParams(location.search);
const still = reduced();
const skip = params.has('skip') || still;
const next = nextMatch();
const nw = when(next.kickoff);

/* ── content ── */
$$('.js-split').forEach((el) => { $$('em', el).forEach((em) => split(em)); split(el); });
renderLinks();
renderFixtures();
renderPartners();
$$('.js-next-opp').forEach((el) => { el.textContent = next.opp; });
$('.js-next-comp').textContent = next.compLabel;
$('.js-next-date').textContent = `${nw.date} ${nw.month}`;
$('.js-next-meta').innerHTML = `<span>${nw.day} ${nw.date} ${nw.month}</span><span>${nw.time} AST</span><span class="hc__mcomp">${next.compLabel}</span><span>${next.round}</span><span>${next.venue}</span>`;
$$('.js-next-book, .js-seat-book').forEach((a) => { a.href = eventUrl(next.slug); });
$('.js-seat-crest').src = next.crest;
$('.js-seat-match').textContent = `Al Ittihad vs ${next.opp}`;
$('.js-seat-when').textContent = `${nw.day} ${nw.date} ${nw.month} · ${nw.time} AST`;
addCountdown($('.js-next-count'), next.kickoff);
// the hero rail: a row of dots that light up with scroll progress
$('.hero__rail').innerHTML = '<i></i>'.repeat(innerWidth < 640 ? 36 : 72);

/* ── smooth scroll ── */
const lenis = new Lenis({ lerp: 0.09 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  e.preventDefault();
  closeMenu();
  lenis.scrollTo(id === '#top' ? 0 : id, { duration: 1.6, offset: id === '#top' ? 0 : -10 });
}));

/* ── globals ── */
initCursor();
initMagnetic();
initClock();
setupSeason({ still });
setupApp(() => lenis.velocity, { still });
footerField({ still });

// cursor turns into a crosshair over the seats
const cursor = $('.cursor');
const stage = $('.hero__stage');
stage.addEventListener('pointerover', (e) => cursor?.classList.toggle('is-aim', !e.target.closest('a, button, .seat')));
stage.addEventListener('pointerleave', () => cursor?.classList.remove('is-aim'));

/* ── nav ── */
const nav = $('.nav');
let lastY = 0;
lenis.on('scroll', ({ scroll }) => {
  if (!document.body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', scroll > lastY && scroll > 240);
  nav.classList.toggle('is-solid', scroll > 40);
  lastY = scroll;
});
const burger = $('.nav__burger');
const menu = $('.menu');
function closeMenu() {
  if (!document.body.classList.contains('menu-open')) return;
  document.body.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Open menu');
  menu.setAttribute('aria-hidden', 'true');
  lenis.start();
}
burger.addEventListener('click', () => {
  if (document.body.classList.contains('menu-open')) return closeMenu();
  document.body.classList.add('menu-open');
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Close menu');
  menu.setAttribute('aria-hidden', 'false');
  lenis.stop();
  gsap.from('.menu nav a', { yPercent: 60, opacity: 0, stagger: 0.06, duration: 0.9, ease: 'expo.out', delay: 0.12 });
});

/* ── scroll reveals ── */
function reveals() {
  if (still) { $$('.fxc').forEach((c) => c.classList.add('is-live')); return; }
  $$('.shead__title, .ft__title').forEach((h) => {
    gsap.from($$('.w > i', h), { yPercent: 110, duration: 1.1, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } });
  });
  $$('[data-rule]').forEach((r) => gsap.from(r, { scaleX: 0, transformOrigin: '0 50%', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: r, start: 'top 92%', once: true } }));
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: 'expo.out', overwrite: true }),
  });
  gsap.set('[data-reveal]', { opacity: 0 });
  // fixture date dots switch on in a diagonal sweep as each card arrives
  $$('.fxc').forEach((c) => ScrollTrigger.create({ trigger: c, start: 'top 80%', once: true, onEnter: () => c.classList.add('is-live') }));
}
reveals();

/* ── hero ── */
const heroEl = $('#top');
const heroP = import('./hero.js').then(({ createHero }) => createHero(heroEl, { next, skip, still }));
heroP.then((hero) => {
  $('.js-claim').addEventListener('click', () => hero.claimRandom());
  if (skip) {
    if (params.has('claim')) hero.claimRandom();
    return;
  }
  hero.intro();
}).catch((err) => {
  console.warn('[seats] hero fallback', err);
  heroEl.classList.add('no-gl');
});
if (!skip) {
  // hold the headline until the seats start landing
  gsap.set($$('.hc--1 .w > i'), { yPercent: 110 });
  gsap.set($$('.hc--1 [data-in], .hero__hud > *, .hero__rail, .hero__steps, .hero__hint'), { opacity: 0 });
  heroP.catch(() => gsap.set($$('.hc--1 .w > i, .hc--1 [data-in], .hero__hud > *, .hero__rail, .hero__steps, .hero__hint'), { clearProps: 'all' }));
}
if (!fine()) document.documentElement.classList.add('touch');

addEventListener('load', () => ScrollTrigger.refresh());
