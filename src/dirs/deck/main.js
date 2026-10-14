// Direction D · Matchday Deck — entry.
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
import { $, $$, split, initCursor, initMagnetic, reduced } from '../../ui.js';
import { mountDirNav } from '../../shared/dirnav.js';
import { SEASON, countdown, pad, nextMatch } from '../../data.js';
import { DECK } from './cards.js';
import { createDeck } from './deck.js';
import { setupJourney } from './journey.js';
import { setupHand, setupSeason, setupApp, setupResale, setupPartners, setupFooter, revealHeadings } from './sections.js';

gsap.registerPlugin(ScrollTrigger);
const params = new URLSearchParams(location.search);
const skip = params.has('skip') || reduced();

mountDirNav('deck');

/* ── headings split into masks ── */
$$('.js-split').forEach((el) => { $$('em', el).forEach((em) => split(em)); split(el); });

/* ── smooth scroll (Lenis drives ScrollTrigger) ── */
const lenis = new Lenis({ lerp: 0.09 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  closeMenu();
  lenis.scrollTo(id === '#top' ? 0 : id, { duration: 1.5, offset: 0 });
}));

/* ── nav: tucks away on the way down, back on the way up ── */
const nav = $('.dn');
let lastY = 0;
lenis.on('scroll', ({ scroll }) => {
  const down = scroll > lastY && scroll > 160;
  if (!document.body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', down);
  nav.classList.toggle('is-solid', scroll > 40);
  lastY = scroll;
});
const burger = $('.dn__burger');
const menu = $('.dm');
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
  if (!reduced()) gsap.fromTo('.dm__cards a', { y: 120, rotation: (i) => (i % 2 ? 6 : -6), opacity: 0 }, { y: 0, rotation: 0, opacity: 1, stagger: 0.06, duration: 0.9, ease: 'expo.out', delay: 0.1 });
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ── hero: headline driven by the deck's top card ── */
const H = {
  kick: $('.js-hd-kick'), comp: $('.js-hd-comp'), round: $('.js-hd-round'), pre: $('.js-hd-pre'), opp: $('.js-hd-opp'),
  meta: $('.js-hd-meta'), countLbl: $('.js-hd-countlbl'), count: $$('.js-hd-count b'), book: $('.js-hd-book'),
  bookLbl: $('.js-hd-booklbl'), flipLbl: $('.js-flip-lbl'), idx: $('.js-count'), big: $('.js-idx-big'),
};
$('.js-total').textContent = pad(DECK.length);
let countTo = nextMatch().kickoff;
const tickCount = () => {
  const c = countdown(countTo);
  [c.d, c.h, c.m, c.s].forEach((v, i) => { H.count[i].textContent = pad(v); });
};
setInterval(tickCount, 1000);

const textOf = (c) => {
  if (c.kind === 'season') {
    return {
      kick: 'Hold the whole season', comp: `Season ${SEASON.season}`, round: 'Every home match', pre: 'Tigers', opp: 'Season Pass',
      meta: [['Competitions', SEASON.comps.length], ['Home grounds', SEASON.venues.length], ['Covers', "League · King's Cup · Asia"], ['From', `SAR ${SEASON.from} <small>incl. VAT</small>`]],
      countLbl: 'Next home match in', countTo: nextMatch().kickoff, book: 'Secure your pass',
    };
  }
  const { m, w } = c;
  return {
    kick: m === nextMatch() ? 'Next home match' : 'Upcoming home match', comp: m.compLabel, round: m.round, pre: 'Al-Ittihad vs', opp: m.opp,
    meta: [['Date', `${w.day} ${w.date} ${w.month}`], ['Kick-off', `${w.time} <small>Jeddah</small>`], ['Venue', m.venue], ['From', `SAR ${m.from} <small>incl. VAT</small>`]],
    countLbl: 'Kick-off in', countTo: m.kickoff, book: 'Book this match',
  };
};

// fit the opponent name to the headline column on one line
function fitOpp() {
  const el = H.opp;
  const line = el.firstElementChild;
  if (!line) return;
  const col = el.parentElement.clientWidth;
  el.style.fontSize = '100px';
  const w = line.offsetWidth || 1;
  const max = Math.min(innerWidth * 0.13, innerHeight * 0.2, 190);
  el.style.fontSize = `${Math.min(max, (100 * col) / w * 0.98).toFixed(1)}px`;
}
const charsOf = (t) => [...t].map((ch) => `<span class="c">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');

let lastIndex = -1, first = true;
function onDeckChange({ index, card, flipped }) {
  H.flipLbl.textContent = flipped ? 'Show the front' : card.kind === 'season' ? 'Flip for details' : 'Flip for prices';
  if (index === lastIndex) return;
  const dir = index > lastIndex ? 1 : -1;
  lastIndex = index;
  const t = textOf(card);
  countTo = t.countTo;
  tickCount();
  H.book.href = card.url;
  H.idx.textContent = pad(index + 1);
  H.big.textContent = pad(index + 1);
  $$('.stub').forEach((s, i) => s.classList.toggle('is-on', i === index));
  const apply = () => {
    H.kick.textContent = t.kick;
    H.comp.textContent = t.comp;
    H.round.textContent = t.round;
    H.pre.textContent = t.pre;
    H.opp.innerHTML = `<span class="hd__line">${charsOf(t.opp)}</span>`;
    H.opp.setAttribute('aria-label', t.opp);
    H.meta.innerHTML = t.meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    H.countLbl.textContent = t.countLbl;
    H.bookLbl.textContent = t.book;
    fitOpp();
  };
  if (first || reduced()) { first = false; apply(); return; }
  gsap.killTweensOf('.hd__opp .c, .hd__meta > div, .hd__comp, .hd__pre');
  gsap.timeline()
    .to('.hd__opp .c', { yPercent: -110 * dir, duration: 0.32, stagger: 0.012, ease: 'power3.in' })
    .to('.hd__meta > div, .hd__comp, .hd__pre', { y: -14 * dir, opacity: 0, duration: 0.25, stagger: 0.02, ease: 'power2.in' }, 0)
    .add(apply)
    .fromTo('.hd__opp .c', { yPercent: 110 * dir }, { yPercent: 0, duration: 0.8, stagger: 0.018, ease: 'expo.out' })
    .fromTo('.hd__meta > div, .hd__comp, .hd__pre', { y: 14 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.04, ease: 'expo.out' }, '<0.05')
    .fromTo('.js-idx-big', { yPercent: 30 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out' }, '<');
}

/* ── compact fixture list under the deck: every card reachable without dragging ── */
const stubs = $('.js-stubs');
stubs.innerHTML = DECK.map((c, i) => {
  const season = c.kind === 'season';
  const d = season ? `<b>26/27</b><small>Season</small>` : `<b>${c.w.date}</b><small>${c.w.month} · ${c.w.day}</small>`;
  const t = season
    ? `<b>Tigers Season Pass</b><small>${SEASON.comps.length} comps · ${SEASON.venues.length} grounds</small>`
    : `<b>vs ${c.m.opp}</b><small>${c.m.comp === 'afc' ? 'AFC Elite' : `Pro League ${c.m.round.replace('Matchweek ', 'MW')}`} · ${c.w.time}</small>`;
  const label = season ? 'Show the season pass card' : `Show Al-Ittihad vs ${c.m.opp} on the deck`;
  const go = season ? `Secure the Tigers Season Pass, from SAR ${SEASON.from}` : `Book Al-Ittihad vs ${c.m.opp}, from SAR ${c.m.from}`;
  const from = season ? SEASON.from : c.m.from;
  return `<li class="stub${season ? ' stub--season' : ''}"><button class="stub__pick" type="button" data-pick="${i}" aria-label="${label}"><span class="stub__d">${d}</span><span class="stub__t">${t}</span></button><a class="stub__go" href="${c.url}" target="_blank" rel="noopener" aria-label="${go}"><small>From</small><b>SAR ${from}</b><i>${season ? 'Buy' : 'Book'} ↗</i></a></li>`;
}).join('');

const deck = createDeck($('.js-deck'), { onChange: onDeckChange });
if (matchMedia('(hover: none), (pointer: coarse)').matches) {
  $('.deck__hint').innerHTML = '<span class="deck__hand" aria-hidden="true"></span>Swipe the top card to deal · tap the arrows to cycle';
}
$('.js-next').addEventListener('click', deck.next);
$('.js-prev').addEventListener('click', deck.prev);
$('.js-flip').addEventListener('click', deck.flip);
$$('[data-pick]').forEach((b) => b.addEventListener('click', () => deck.goTo(+b.dataset.pick)));
ScrollTrigger.create({ trigger: '#top', start: 'top bottom', end: 'bottom top', onToggle: (self) => deck.setActive(self.isActive) });
addEventListener('resize', fitOpp);

/* ── the rest of the page ── */
setupHand();
setupJourney();
setupSeason();
setupApp();
setupResale();
setupPartners();
setupFooter();
revealHeadings();
initCursor();
initMagnetic();

/* ── intro: the deck is dealt onto the table ── */
async function boot() {
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  fitOpp();
  const tl = gsap.timeline();
  tl.add(deck.intro({ hint: !skip }), 0.1)
    .from('.hd__kick, .hd__comp, .hd__pre', { y: 24, opacity: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out' }, 0.25)
    .from('.hd__opp .c', { yPercent: 110, duration: 1, stagger: 0.025, ease: 'expo.out' }, 0.35)
    .from('.hd__meta > div, .hd__count, .hd__ctas > *', { y: 24, opacity: 0, duration: 0.9, stagger: 0.05, ease: 'expo.out' }, 0.55)
    .from('.stub', { y: 40, opacity: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out' }, 0.7)
    .from('.dn > *', { y: -30, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 0.2)
    .from('.hero__table > *', { opacity: 0, duration: 1.2 }, 0.2)
    .from('.deck__ctrl', { opacity: 0, y: 16, duration: 0.8 }, 1.1);
  if (skip) tl.progress(1);
  ScrollTrigger.refresh();
}
boot();
addEventListener('load', () => ScrollTrigger.refresh());
