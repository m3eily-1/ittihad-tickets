import '@fontsource/anton/400.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './styles.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { $, $$, splitAll, initCursor, initMagnetic, initMarquee, initClock, reduced } from './ui.js';
import { mountDirNav } from './shared/dirnav.js';
import { setupFixtures, setupStory, setupSeason, setupVenues, setupApp, renderPartners, setupFooter, scrollReveals } from './sections.js';

gsap.registerPlugin(ScrollTrigger);

// heroes load on demand so three.js is only fetched for the Stripes concept
const HEROES = {
  ticket: () => import('./heroes/ticket.js').then((m) => m.createTicket),
  stripes: () => import('./heroes/stripes.js').then((m) => m.createStripes),
  flap: () => import('./heroes/flap.js').then((m) => m.createFlap),
  flyover: () => import('./heroes/flyover.js').then((m) => m.createFlyover),
};
const VARIANTS = Object.keys(HEROES);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const params = new URLSearchParams(location.search);

mountDirNav('v1');

/* ── text + content ── */
splitAll();
renderPartners();
setupFixtures();

/* ── smooth scroll ── */
const lenis = new Lenis({ lerp: 0.09 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  e.preventDefault();
  closeMenu();
  lenis.scrollTo(id === '#top' ? 0 : id, { duration: 1.6, offset: id === '#top' ? 0 : -20 });
}));

/* ── globals ── */
initCursor();
initMagnetic();
initClock();
initMarquee($('.js-marquee'), () => lenis.velocity, { speed: 70 });
initMarquee($('.js-partners'), () => lenis.velocity, { speed: 40, dir: 1 });
setupStory();
setupSeason();
setupVenues();
setupApp();
setupFooter();
scrollReveals();

/* ── nav: hides on the way down, returns on the way up, goes solid after the hero ── */
const nav = $('.nav');
let lastY = 0;
lenis.on('scroll', ({ scroll }) => {
  const down = scroll > lastY && scroll > 200;
  if (!document.body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', down);
  nav.classList.toggle('is-solid', scroll > innerHeight * 0.6);
  $('.switch').classList.toggle('is-away', scroll > hero.offsetHeight - innerHeight * 0.5);
  lastY = scroll;
});
const burger = $('.nav__burger');
function closeMenu() { document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); lenis.start(); }
burger.addEventListener('click', () => {
  const open = !document.body.classList.contains('menu-open');
  document.body.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', String(open));
  open ? lenis.stop() : lenis.start();
  if (open) gsap.from('.menu a', { yPercent: 100, opacity: 0, stagger: 0.05, duration: 0.9, ease: 'expo.out', delay: 0.15 });
});

/* ── hero concepts ── */
const hero = $('#top');
let variant = VARIANTS.includes(params.get('hero')) ? params.get('hero') : store.get('itt-hero');
if (!VARIANTS.includes(variant)) variant = 'ticket';
let inst = null, mountId = 0;

async function mountHero(v, { intro = true } = {}) {
  const id = ++mountId;
  inst?.destroy();
  inst = null;
  variant = v;
  hero.dataset.variant = v;
  $$('[data-hero-opt]').forEach((b) => { b.classList.toggle('is-on', b.dataset.heroOpt === v); b.setAttribute('aria-pressed', String(b.dataset.heroOpt === v)); });
  store.set('itt-hero', v);
  const u = new URL(location.href);
  u.searchParams.set('hero', v);
  history.replaceState?.(null, '', u);
  const create = await HEROES[v]();
  if (id !== mountId) return null; // a newer switch won the race
  inst = create($(`.hv--${v}`));
  initMagnetic(hero);
  ScrollTrigger.refresh();
  return intro ? inst.intro?.() : null;
}

// switching sweeps seven crest stripes across the screen
$$('[data-hero-opt]').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.heroOpt;
  if (v === variant) return;
  const bars = $$('.wipe i');
  lenis.scrollTo(0, { immediate: true, force: true });
  gsap.timeline()
    .set(bars, { transformOrigin: '50% 100%' })
    .to(bars, { scaleY: 1, duration: 0.55, stagger: 0.04, ease: 'expo.in' })
    .add(async () => {
      const intro = await mountHero(v, { intro: false });
      gsap.timeline()
        .set(bars, { transformOrigin: '50% 0%' })
        .to(bars, { scaleY: 0, duration: 0.7, stagger: 0.04, ease: 'expo.out' })
        .add(() => inst?.intro?.(), 0.1);
      return intro;
    });
}));

/* ── preloader → hero intro ── */
async function boot() {
  const skip = params.has('skip') || reduced();
  const year = $('.js-pre-year');
  const pre = $('.pre');
  if (skip) {
    pre.remove();
    document.body.classList.remove('is-loading');
    lenis.start();
    await mountHero(variant, { intro: false });
    inst?.intro?.()?.progress(1);
    return;
  }
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  const ready = HEROES[variant](); // fetch the hero module while the loader plays
  const o = { y: 1927 };
  const tl = gsap.timeline();
  tl.to('.pre__line', { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0)
    .to('.pre__bar', { scaleY: 1, duration: 0.6, stagger: 0.07, ease: 'expo.out' }, 0.5)
    .to(o, { y: 2026, duration: 1.5, ease: 'expo.inOut', onUpdate: () => { year.textContent = Math.round(o.y); } }, 0.2);
  await Promise.all([tl.then(), ready]);
  await mountHero(variant, { intro: false });
  gsap.timeline()
    .to('.pre__one, .pre__year, .pre__cap', { y: -40, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power3.in' })
    .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' }, 0.35)
    .add(() => { inst?.intro?.(); }, 0.75)
    .add(() => { pre.remove(); document.body.classList.remove('is-loading'); lenis.start(); });
}
boot();

addEventListener('load', () => ScrollTrigger.refresh());
