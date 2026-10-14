// Direction B · "Tifo": the stand as thousands of fan cards. Mexican waves, cascading tifos and a
// page that keeps talking in cards.
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
import { $, $$, initCursor, initMagnetic, initMarquee, initClock, reduced, fine } from '../../ui.js';
import { mountDirNav } from '../../shared/dirnav.js';
import { nextMatch, eventUrl, when } from '../../data.js';
import { MiniTifo, stamp, blank } from './minitifo.js';
import { cardText, flipIn, renderFixtures, setupSeason, setupApp, renderPartners, setupFooter, reveals } from './sections.js';

gsap.registerPlugin(ScrollTrigger);
mountDirNav('tifo');

const params = new URLSearchParams(location.search);
const still = reduced();
const skip = params.has('skip') || still;
const next = nextMatch();
const nw = when(next.kickoff);

/* ── content ── */
$$('.js-cards').forEach(cardText);
$('.js-next-line').innerHTML = `Next home match · ${nw.day} ${nw.date} ${nw.month} · ${nw.time} AST<span class="k-opp"> · vs ${next.opp}</span>`;
$('.js-next-book').href = eventUrl(next.slug);
$('.js-tp-match').textContent = `${nw.date} ${nw.month}`;
renderFixtures({ still });
setupSeason({ still });
renderPartners();
setupApp({ still });
setupFooter({ still });

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
initMarquee($('.js-chant-a'), () => lenis.velocity, { speed: 70 });
initMarquee($('.js-chant-b'), () => lenis.velocity, { speed: 55, dir: 1 });
if (!fine()) document.documentElement.classList.add('touch');

/* ── nav ── */
const nav = $('.nav');
let lastY = 0;
lenis.on('scroll', ({ scroll }) => {
  if (!document.body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', scroll > lastY && scroll > 260);
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
  gsap.fromTo('.menu nav a', { rotationX: -90, opacity: 0 }, { rotationX: 0, opacity: 1, transformOrigin: '50% 0%', stagger: 0.06, duration: 0.9, ease: 'back.out(1.4)', delay: 0.15 });
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

reveals({ still });

/* ── hero: the stand ── */
const hero = $('#top');
const STATES = [
  { key: 'crest', name: 'The crest' },
  { key: 'year', name: 'Since 1927' },
  { key: 'match', name: `${nw.date} ${nw.month} · ${next.oppCode}` },
  { key: 'message', name: 'Your message' },
];
const fontsReady = Promise.race([
  Promise.all([document.fonts.load('400 100px Anton'), document.fonts.ready]),
  new Promise((r) => setTimeout(r, 2500)),
]);
const crestReady = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = '/img/crest.png'; });
const cleanMsg = (s) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 10);

let stand = null, designs = {}, stateIdx = 0, narrow = false, message = cleanMsg(params.get('msg') || '') || 'ITTIHAD';

async function buildHero() {
  const [{ createStand }, P] = await Promise.all([import('./stand.js'), import('./patterns.js'), fontsReady]);
  const crest = await crestReady;
  stand = createStand($('.js-stand'), { still });
  const g = stand.grid;
  designs.crowd = P.DESIGNS.crowd(g);
  designs.crest = crest ? P.DESIGNS.crest(g, { crest }) : P.DESIGNS.year(g);
  // phones see only the middle of the stand, so text tifos are laid out narrower there
  narrow = innerWidth / innerHeight < 1;
  designs.year = P.DESIGNS.year(g, { narrow });
  designs.match = P.DESIGNS.match(g, { line1: `${nw.date} ${nw.month}`, line2: `VS ${next.oppCode}`, narrow });
  designs.message = P.DESIGNS.message(g, { text: message, narrow });
  $$('.tp__opt').forEach((b) => P.thumb($('canvas', b), designs[b.dataset.tifo], g));
  $('.js-hud-count').textContent = stand.count.toLocaleString('en-US');
  window.__tifo = { stand, designs, P, raise: (...a) => raise(...a) }; // debug handle
  return P;
}

function markState(i) {
  stateIdx = i;
  $$('.tp__opt').forEach((b, k) => { b.classList.toggle('is-on', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  $('.js-hud-n').textContent = String(i + 1).padStart(2, '0');
  $('.js-hud-name').textContent = STATES[i].name;
  $$('.js-hud-bars i').forEach((b, k) => b.classList.toggle('is-on', k === i));
  $('.tp').classList.toggle('is-msg', STATES[i].key === 'message');
}
function raise(i, opts = {}) {
  if (!stand) return;
  markState(i);
  stand.setTifo(designs[STATES[i].key], { key: STATES[i].key, ...opts });
}

/* selector + message */
$$('.tp__opt').forEach((b, i) => b.addEventListener('click', () => {
  raise(i, { mode: i % 2 ? 1 : 3, span: 1.3 });
  if (STATES[i].key === 'message') setTimeout(() => $('.js-msg-input').focus({ preventScroll: true }), 50);
}));
const input = $('.js-msg-input');
const boxes = $('.js-msg-boxes');
boxes.innerHTML = '<i></i>'.repeat(10);
function paintBoxes(prev = '') {
  const v = input.value;
  const ph = v ? '' : input.placeholder; // dim sample letters until the visitor types
  $$('i', boxes).forEach((b, k) => {
    const ch = v[k] || ph[k] || '';
    b.classList.toggle('is-ph', !v[k] && !!ph[k]);
    if (b.textContent !== ch) {
      b.textContent = ch;
      if (v[k] && !still) gsap.fromTo(b, { rotationX: -180 }, { rotationX: 0, duration: 0.5, ease: 'back.out(1.8)' });
    }
    b.classList.toggle('is-caret', k === Math.min(v.length, 9) && document.activeElement === input);
    b.classList.toggle('is-full', !!v[k]);
  });
  return prev;
}
input.value = message === 'ITTIHAD' ? '' : message;
input.placeholder = 'ITTIHAD';
input.addEventListener('input', () => { const c = cleanMsg(input.value); if (c !== input.value) input.value = c; paintBoxes(); });
input.addEventListener('focus', () => paintBoxes());
input.addEventListener('blur', () => paintBoxes());
paintBoxes();
$('.js-msg').addEventListener('submit', async (e) => {
  e.preventDefault();
  const P = await heroP;
  message = cleanMsg(input.value).trim() || 'ITTIHAD';
  designs.message = P.DESIGNS.message(stand.grid, { text: message, narrow });
  P.thumb($('.tp__opt[data-tifo="message"] canvas'), designs.message, stand.grid);
  raise(3, { mode: 1, span: 1.2 });
  input.blur();
});

/* stand input: waves on move, flip on click (not on the UI on top of it) */
const isUI = (t) => t.closest('a, button, input, form, .tp, .nav');
let down = null;
hero.addEventListener('pointermove', (e) => { if (stand && !isUI(e.target)) stand.onMove(e); });
hero.addEventListener('pointerleave', () => stand?.pointerLeave());
hero.addEventListener('pointerdown', (e) => { down = isUI(e.target) ? null : { x: e.clientX, y: e.clientY }; });
hero.addEventListener('pointerup', (e) => {
  if (!down || !stand || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) return;
  down = null;
  const cell = stand.cellAt(e.clientX, e.clientY);
  if (!cell) return;
  stand.ripple(cell.u, cell.v);
  raise((stateIdx + 1) % STATES.length, { mode: 0, origin: [cell.u, cell.v], span: 1.5 });
});
// cursor label over the stand itself
const cursor = $('.cursor');
hero.addEventListener('pointermove', (e) => {
  if (!cursor || !stand) return;
  const over = !isUI(e.target) && !!stand.cellAt(e.clientX, e.clientY);
  cursor.classList.toggle('is-label', over);
  if (over) $('.cursor__label').textContent = 'Flip';
});
hero.addEventListener('pointerleave', () => cursor?.classList.remove('is-label'));

/* scroll: the hero holds while three tifos go up in turn */
function scrollStates() {
  if (still) { $('.hero__scroll').remove(); return; }
  let last = 0;
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: () => `+=${innerHeight * 1.6}`,
    pin: true,
    pinSpacing: true,
    onUpdate: (st) => {
      stand?.setScroll(st.progress);
      const i = Math.min(2, Math.floor(st.progress * 3.2));
      if (i !== last) {
        last = i;
        raise(i, { mode: i > stateIdx ? 2 : 3, span: 1.1 });
      }
      $('.hero__scroll').style.opacity = String(1 - Math.min(1, st.progress * 4));
    },
  });
  // the copy drifts up as the cards take over
  gsap.to('.hero__copy', { y: () => -innerHeight * 0.08, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: () => `+=${innerHeight * 1.6}`, scrub: true } });
}

/* ── boot: preloader → stand raises the crest ── */
const heroP = buildHero();
async function boot() {
  const pre = $('.pre');
  heroP.catch((err) => { console.warn('[tifo] stand fallback', err); hero.classList.add('no-gl'); });
  scrollStates();
  if (skip) {
    pre.remove();
    document.body.classList.remove('is-loading');
    await heroP.catch(() => {});
    if (!stand) return;
    const want = params.get('tifo');
    const idx = Math.max(0, STATES.findIndex((s) => s.key === want));
    markState(idx);
    stand.setInstant(designs[STATES[idx].key]);
    // debug: ?flip=<state> starts a sweep at load; ?wave=<s> starts a Mexican wave already <s> in
    const flip = STATES.findIndex((s) => s.key === params.get('flip'));
    if (flip >= 0) setTimeout(() => raise(flip, { mode: 0, origin: [0.5, 0], span: 1.6 }), +(params.get('flipAt') || 600));
    if (params.has('wave')) stand.mexican(1, -(+params.get('wave') || 0));
    if (params.has('ripple')) {
      const [u, v] = params.get('ripple').split(',').map(Number);
      [0, 120, 240, 360].forEach((d) => setTimeout(() => stand.ripple(u + d / 4000, v), d + 1200));
    }
    return;
  }
  // a little card stand flips to 1927 while the hero builds
  lenis.stop();
  const mt = new MiniTifo($('.js-pre-grid'), { cols: 25, rows: 9, interactive: false });
  mt.set(blank(25, 9), { instant: true });
  const count = $('.js-pre-count');
  const o = { n: 0 };
  await new Promise((r) => setTimeout(r, 150));
  mt.set(stamp(blank(25, 9), '1927', { fg: 1 }), { sweep: 'ltr', span: 0.9 });
  const tl = gsap.timeline();
  tl.to(o, { n: 1927, duration: 1.4, ease: 'expo.inOut', onUpdate: () => { count.textContent = String(Math.round(o.n)).padStart(4, '0'); } });
  await Promise.all([tl.then(), heroP.catch(() => {})]);
  mt.sweepWave(1, 0.5);
  if (stand) {
    stand.setInstant(designs.crowd);
    markState(0);
  }
  gsap.set($$('.hero__title .cc'), { rotationX: -100, opacity: 0, '--f': 1 });
  gsap.set('.hero__kicker, .hero__lede, .tp, .hud, .hero__scroll', { opacity: 0, y: 18 });
  await new Promise((r) => setTimeout(r, 650));
  gsap.timeline()
    .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' })
    .add(() => { stand?.setTifo(designs.crest, { key: 'crest', mode: 0, origin: [0.5, 0], span: 1.9, dur: 0.7 }); }, 0.35)
    .add(() => flipIn($('.hero__title'), { stagger: 0.035 }), 0.55)
    .to('.hero__kicker, .hero__lede, .tp, .hud, .hero__scroll', { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 0.9)
    .add(() => { pre.remove(); mt.destroy(); document.body.classList.remove('is-loading'); lenis.start(); });
}
boot();

addEventListener('load', () => ScrollTrigger.refresh());
