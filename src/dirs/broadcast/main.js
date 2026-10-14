// Direction E · "Broadcast": the page is a live matchday TV broadcast. A persistent bug with the next
// match + kick-off clock, ON SALE tag, safe-area marks, ticker crawl and a replay scrubber that maps
// to scroll; stinger wipes between sections and an RGB-split WebGL plate in the hero.
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
import { $, $$, split, initCursor, initMagnetic, initMarquee, initClock, reduced } from '../../ui.js';
import { mountDirNav } from '../../shared/dirnav.js';
import { createHero } from './hero.js';
import { createScrubber } from './scrubber.js';
import { cut } from './stinger.js';
import { renderLinks, renderFixtures, setupSeason, setupVenues, setupPartners, reveals, tickerHTML } from './sections.js';

gsap.registerPlugin(ScrollTrigger);
const dirnav = mountDirNav('broadcast');

const params = new URLSearchParams(location.search);
const still = reduced();
const skip = params.has('skip') || still;
if (still) document.body.classList.add('is-still');

/* ── keep the HUD and content clear of the direction switcher (wherever it docks) ── */
function clearDirNav() {
  const hud = $('.hud');
  let r = 0, b = 0, x = 0;
  if (dirnav && getComputedStyle(dirnav).display !== 'none') {
    const rect = dirnav.getBoundingClientRect();
    if (rect.bottom > innerHeight - hud.offsetHeight - 4) {
      // docked on the HUD band: wide screens stop the HUD short of it, narrow ones lift the HUD over it
      if (rect.width + 40 < innerWidth * 0.42) r = innerWidth - rect.left + 12;
      else b = innerHeight - rect.top + 8;
    } else {
      // docked on the side: keep page content out from under it
      x = innerWidth - rect.left + 6;
    }
  }
  hud.style.setProperty('--dn-r', `${r}px`);
  hud.style.setProperty('--dn-b', `${b}px`);
  document.documentElement.style.setProperty('--dn-x', `${x}px`);
  document.documentElement.style.setProperty('--hud-h', `${hud.offsetHeight}px`);
}

/* ── content ── */
renderLinks();
renderFixtures({ still });
$$('.gl-txt').forEach((el) => { if (!el.closest('.mu')) split(el); });
$('.js-ticker').innerHTML = tickerHTML();
clearDirNav();

/* ── smooth scroll ── */
const lenis = new Lenis({ lerp: 0.09 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* ── globals ── */
initCursor();
initMagnetic();
initClock();
if (!still) initMarquee($('.js-ticker'), () => lenis.velocity, { speed: 70 });
const hero = createHero({ still });
const scrub = createScrubber({ lenis, still });
setupSeason({ still });
setupVenues({ still });
setupPartners({ still });
reveals({ still });

// anchors cut to their section behind a stinger, like a director switching cameras
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href').slice(1);
  if (!id) return;
  e.preventDefault();
  closeMenu();
  if (!scrub.cutToId(id)) lenis.scrollTo(`#${id}`, { duration: 1.4 });
}));

/* ── top frame: goes solid once the hero is behind us ── */
const top = $('.top');
lenis.on('scroll', ({ scroll }) => top.classList.toggle('is-solid', scroll > innerHeight * 0.5));

/* ── mobile menu ── */
const burger = $('.burger');
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
  if (!still) gsap.fromTo('.menu nav a', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', stagger: 0.05, duration: 0.7, ease: 'expo.out', delay: 0.1 });
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

addEventListener('resize', () => { clearDirNav(); ScrollTrigger.refresh(); });

/* ── opener: slate → stinger → graphics key in ── */
async function boot() {
  const pre = $('.pre');
  if (skip) {
    pre.remove();
    document.body.classList.remove('is-loading');
    if (still) hero.start();
    else hero.intro().progress(1);
    requestAnimationFrame(() => { ScrollTrigger.refresh(); scrub.measure(); });
    return;
  }
  lenis.stop();
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  const tc = $('.js-pre-tc');
  const o = { f: 0 };
  const tl = gsap.timeline();
  tl.from('.pre__crest', { scale: 0.7, opacity: 0, duration: 0.8, ease: 'expo.out' }, 0)
    .from('.pre__rec, .pre__name, .pre__tc', { y: 12, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'expo.out' }, 0.15)
    .to('.pre__bar i', { scaleX: 1, duration: 1.3, ease: 'power2.inOut' }, 0.1)
    .to(o, {
      f: 1, duration: 1.3, ease: 'power2.inOut',
      onUpdate: () => {
        // a broadcast timecode rolling up to air
        const fr = Math.floor(o.f * 99);
        tc.textContent = `00:00:${String(Math.floor(fr / 25)).padStart(2, '0')}:${String(fr % 25).padStart(2, '0')}`;
      },
    }, 0.1);
  await tl.then();
  await cut(() => {
    pre.remove();
    document.body.classList.remove('is-loading');
    // the graphics key in as the stinger clears
    const intro = hero.intro().pause(0);
    gsap.delayedCall(0.22, () => intro.play());
  }, { label: 'Kick-off', sub: 'Ittihad Tickets · Matchday' });
  lenis.start();
  ScrollTrigger.refresh();
  scrub.measure();
}
boot();
