// Direction C · Liquid — liquid WebGL type, DOM-synced poster planes, kinetic headings, ink drips.
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
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { $, $$, split, initCursor, initMagnetic, initMarquee, reduced, fine } from '../../ui.js';
import { mountDirNav } from '../../shared/dirnav.js';
import { MATCHES, SEASON, SPONSORS, LINKS, eventUrl, seasonUrl, when, countdown, pad, nextMatch } from '../../data.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
mountDirNav('liquid');

const params = new URLSearchParams(location.search);
const RM = reduced();
const SKIP = params.has('skip') || RM;
const root = document.documentElement;
root.classList.add(fine() ? 'is-fine' : 'is-touch');
if (RM) root.classList.add('is-reduced');

/* ───────────── content from data.js ───────────── */
const next = nextMatch();
{
  const w = when(next.kickoff);
  $('.js-next-opp').textContent = next.opp;
  $('.js-next-crest').src = next.crest;
  $('.js-next-crest').alt = `${next.opp} crest`;
  $('.js-next-meta').innerHTML = `<b>${w.day} ${w.date} ${w.month}</b> · ${w.time} · ${next.compLabel} · ${next.venue}`;
  $('.js-next-book').href = eventUrl(next.slug);
}

$('.js-fixtures').innerHTML = MATCHES.map((m, i) => {
  const w = when(m.kickoff);
  return `<li class="fx" data-i="${i}">
    <div class="fx__date" aria-hidden="true">
      <span class="fx__idx">${pad(i + 1)} / ${pad(MATCHES.length)}</span>
      <b class="fx__d">${w.date}</b><b class="fx__m">${w.month}</b>
      <span class="fx__t">${w.day} · ${w.time}</span>
    </div>
    <a class="fx__media" href="${eventUrl(m.slug)}" target="_blank" rel="noopener" data-gl data-cursor="label" data-cursor-label="Book" aria-label="Book Al Ittihad vs ${m.opp}, ${w.day} ${w.date} ${w.month}">
      <img src="${m.poster}" alt="Official match poster: Al-Ittihad vs ${m.opp}" width="1280" height="426" loading="${i ? 'lazy' : 'eager'}" />
    </a>
    <div class="fx__info">
      <p class="fx__comp"><span class="fx__tag fx__tag--${m.comp}">${m.compLabel}</span><span>${m.round}</span></p>
      <h3 class="fx__teams"><span class="fx__home">Al Ittihad</span> <i>vs</i> <span class="fx__opp"><img src="${m.crest}" alt="" width="40" height="40" />${m.opp}</span></h3>
      <p class="fx__when"><time datetime="${new Date(m.kickoff * 1000).toISOString()}">${w.day} ${w.date} ${w.month} · ${w.time}</time> Jeddah time</p>
      <p class="fx__venue">${m.venue}</p>
      <div class="fx__buy">
        <p class="fx__price"><small>From</small> SAR <b>${m.from}</b></p>
        <a class="btn btn--y magnetic" href="${eventUrl(m.slug)}" target="_blank" rel="noopener"><span>Book tickets</span></a>
      </div>
    </div>
  </li>`;
}).join('');

$('.js-season-title').textContent = SEASON.title;
$('.js-season-season').textContent = SEASON.season;
$('.js-season-price').textContent = SEASON.from;
$('.js-season-link').href = seasonUrl(SEASON.slug);
$('.js-season-comps').innerHTML = SEASON.comps.map((c, i) => `<li><span>${pad(i + 1)}</span>${c}</li>`).join('');
$('.js-season-venues').innerHTML = SEASON.venues.map((v) => `<li>${v}</li>`).join('');

$('.js-partners').innerHTML = SPONSORS.map(([k, name]) => `<li class="pcell"><img src="/sponsors/${k}-k.png" alt="${name}" loading="lazy" /><span>${name}</span></li>`).join('');

const setHref = (sel, url) => $$(sel).forEach((a) => { a.href = url; });
setHref('.js-appstore', LINKS.appStore);
setHref('.js-playstore', LINKS.playStore);
setHref('.js-resale', LINKS.resale);
setHref('.js-about', LINKS.about);
setHref('.js-store', LINKS.store);
setHref('.js-x', LINKS.x);
setHref('.js-ig', LINKS.instagram);
setHref('.js-yt', LINKS.youtube);
setHref('.js-sc', LINKS.snapchat);

// tapes
const sep = '<i>✶</i>';
$('.js-tape-a').innerHTML = ['Al Ittihad', 'The Tigers', 'Al-Ameed', 'Est. 1927', 'Jeddah'].map((t) => `<span>${t}</span>${sep}`).join('');
$('.js-tape-b').innerHTML = MATCHES.map((m) => `<span><small>vs</small>${m.oppShort}</span>${sep}`).join('');
$('.js-tape-c').innerHTML = Array.from({ length: 4 }, () => '<span>Resale only on Webook</span><i>!</i><span>Official tickets only</span><i>!</i>').join('');

/* ───────────── countdowns ───────────── */
function tickCount(el, ts) {
  const c = countdown(ts);
  const b = el.querySelectorAll('b');
  [c.d, c.h, c.m, c.s].forEach((v, i) => { const t = pad(v); if (b[i].textContent !== t) b[i].textContent = t; });
}
const counts = [[$('.js-next-count'), next.kickoff]];   // (the fixture rows' countdowns were removed: Ahmed, 2026-10-12)
const tickAll = () => counts.forEach(([el, ts]) => tickCount(el, ts));
tickAll();
setInterval(tickAll, 1000);

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

/* ───────────── nav + menu ───────────── */
const nav = $('.nav');
const burger = $('.nav__burger');
const menu = $('.menu');
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
  if (!RM) gsap.fromTo('.menu__links a', { yPercent: 110, skewY: 8 }, { yPercent: 0, skewY: 0, stagger: 0.06, duration: 1, ease: 'expo.out', delay: 0.2 });
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

/* ───────────── cursor + magnetic ───────────── */
initCursor();
initMagnetic();

/* ───────────── WebGL stage ───────────── */
let stage = null;
if (!RM) {
  const { createStage } = await import('./gl.js');
  await Promise.race([
    Promise.all([document.fonts.load('400 100px Anton'), document.fonts.ready]),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
  try {
    stage = createStage({ hero: $('#top'), stage: $('.js-stage'), getVelocity: vel, demo: params.has('demo'), intro: !SKIP });
  } catch (err) {
    console.warn('[liquid] WebGL unavailable, using the DOM version', err);
    stage = null;
  }
  if (stage) {
    if (stage.hasHero) root.classList.add('gl-hero');
    $$('[data-gl]').forEach((el) => {
      const mode = +(el.dataset.glMode || 0);
      const p = stage.addPlane(el, { mode, clip: mode === 2 ? el.closest('.hero') : null });
      if (!p) return;
      p.reveal = 0;
      // the hero trio rises out of the ink with the intro (or is simply there with ?skip)
      if (mode === 2) {
        if (SKIP) p.reveal = 1;
        else gsap.to(p, { reveal: 1, duration: 2.2, ease: 'power2.inOut', delay: 0.7 });
        return;
      }
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to(p, { reveal: 1, duration: 1.9, ease: 'power2.inOut', delay: 0.1 }),
      });
    });
    gsap.ticker.add((_, dt) => stage.frame(dt / 1000));
    document.addEventListener('visibilitychange', () => stage.setRunning(!document.hidden));
    // fixture rows: hovering anywhere on the row wakes its poster
    $$('.fx').forEach((row) => {
      const media = $('.fx__media', row);
      row.addEventListener('pointerenter', () => media.classList.add('is-hot'));
      row.addEventListener('pointerleave', () => media.classList.remove('is-hot'));
    });
  }
}

/* ───────────── hero trio: parallax against the type (pointer + scroll) ───────────── */
if (!RM) {
  const inner = $('.js-players-in');
  const heroEl = $('#top');
  const setX = gsap.quickSetter(inner, 'x', 'px'), setY = gsap.quickSetter(inner, 'y', 'px');
  let tx = 0, ty = 0, px = 0, py = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * -26; ty = (e.clientY / innerHeight - 0.5) * -14; }, { passive: true });
  gsap.ticker.add(() => {
    const r = heroEl.getBoundingClientRect();
    if (r.bottom < 0) return;
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;
    // scrolling away: the trio slides up faster than the type behind it
    setX(px); setY(py + Math.min(0, r.top) * 0.18);
  });
}

/* ───────────── kinetic headings ───────────── */
const kts = $$('.js-kt');
kts.forEach((h) => {
  if (RM) return;
  const s = SplitText.create(h.querySelectorAll('.kt__l'), { type: 'words,chars', wordsClass: 'kw', charsClass: 'kc', mask: 'words' });
  gsap.set(s.chars, { yPercent: 115, rotate: 6 });
  ScrollTrigger.create({
    trigger: h, start: 'top 86%', once: true,
    onEnter: () => gsap.to(s.chars, { yPercent: 0, rotate: 0, duration: 1.15, ease: 'expo.out', stagger: { each: 0.028 } }),
  });
});

// velocity → stretch + skew, on headings and tapes
if (!RM) {
  let sv = 0;
  const tapes = $$('.js-skew');
  const state = new Map();
  gsap.ticker.add(() => {
    sv += (vel() - sv) * 0.14;
    const a = Math.abs(sv) < 0.02 ? 0 : sv;
    const st = 1 + Math.min(Math.abs(a) * 0.011, 0.42);
    const sk = Math.max(-7, Math.min(7, -a * 0.12));
    const key = `${st.toFixed(3)}|${sk.toFixed(2)}`;
    for (const h of kts) {
      if (state.get(h) === key) continue;
      state.set(h, key);
      h.style.transform = `scaleY(${st}) skewY(${sk}deg)`;
    }
    const tsk = Math.max(-14, Math.min(14, -a * 0.35));
    for (const t of tapes) t.style.setProperty('--sk', `${tsk}deg`);
  });
}

/* ───────────── tapes / marquees ───────────── */
if (!RM) {
  initMarquee($('.js-tape-a'), vel, { speed: 70, dir: -1 });
  initMarquee($('.js-tape-b'), vel, { speed: 55, dir: 1 });
  initMarquee($('.js-tape-c'), vel, { speed: 40, dir: -1 });
}

/* ───────────── ink drips between sections ───────────── */
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function setupDrip(el) {
  const svg = $('svg', el), path = $('path', el);
  const seed = +el.dataset.seed || 1;
  let W = 0, H = 0, drips = [], prog = RM ? 1 : 0;
  function build() {
    W = el.clientWidth; H = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const r = rng(seed);
    const n = Math.max(6, Math.round(W / 64));
    drips = Array.from({ length: n }, (_, i) => ({
      x: (i + 0.15 + r() * 0.7) * (W / n),
      w: 12 + r() * (W < 600 ? 22 : 38),
      L: (0.18 + Math.pow(r(), 1.4) * 0.82) * (H - 26),
      d: r() * 0.5,
      drop: r() < 0.35,
    })).sort((a, b) => b.x - a.x);
    draw(prog);
  }
  function draw(p) {
    prog = p;
    const base = 2 + p * 12;
    const f = (n) => n.toFixed(1);
    let d = `M0,-1 H${W} V${f(base)}`, drops = '';
    for (const k of drips) {
      const q = Math.min(1, Math.max(0, (p - k.d) / (1 - k.d)));
      const e = 1 - Math.pow(1 - q, 3);
      const L = k.L * e;
      if (L < 3) continue;
      const hw = Math.min(k.w / 2, L / 2);
      const s = Math.min(hw * 0.9, L * 0.28);
      const x = k.x;
      d += ` L${f(x + hw + s)},${f(base)} Q${f(x + hw)},${f(base)} ${f(x + hw)},${f(base + s)} L${f(x + hw)},${f(base + L - hw)} A${f(hw)},${f(hw)} 0 0 1 ${f(x - hw)},${f(base + L - hw)} L${f(x - hw)},${f(base + s)} Q${f(x - hw)},${f(base)} ${f(x - hw - s)},${f(base)}`;
      if (k.drop && q > 0.55) {
        const dr = hw * 0.55, cy = Math.min(H - dr - 1, base + L + 6 + (q - 0.55) * 60);
        drops += ` M${f(x - dr)},${f(cy)} a${f(dr)},${f(dr)} 0 1,0 ${f(dr * 2)},0 a${f(dr)},${f(dr)} 0 1,0 ${f(-dr * 2)},0`;
      }
    }
    d += ` L0,${f(base)} Z` + drops;
    path.setAttribute('d', d);
  }
  build();
  addEventListener('resize', build);
  if (!RM) ScrollTrigger.create({ trigger: el, start: 'top 98%', end: 'top 30%', scrub: 0.6, onUpdate: (s) => draw(s.progress) });
}
$$('.js-drip').forEach(setupDrip);

/* ───────────── partners: ink fills each cell from where you enter ───────────── */
$$('.pcell').forEach((c) => {
  const at = (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--px', `${((e.clientX - r.left) / r.width) * 100}%`);
    c.style.setProperty('--py', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  c.addEventListener('pointerenter', (e) => { at(e); requestAnimationFrame(() => c.classList.add('is-in')); });
  c.addEventListener('pointerleave', (e) => { at(e); c.classList.remove('is-in'); });
});

/* ───────────── footer: liquid lens on the big line ───────────── */
{
  const word = $('.js-lens-word');
  $$('.foot__line', word).forEach((l) => split(l, { chars: true }));
  const chars = $$('.c', word);
  const lens = $('.js-lens');
  if (fine() && !RM) {
    const tos = chars.map((c) => gsap.quickTo(c, 'scaleY', { duration: 0.5, ease: 'power3' }));
    let centers = [];
    lens.addEventListener('pointerenter', () => { centers = chars.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); });
    lens.addEventListener('pointermove', (e) => {
      centers.forEach(([x, y], i) => {
        const d = Math.hypot((e.clientX - x) / 140, (e.clientY - y) / 260);
        tos[i](1 + 0.55 * Math.exp(-d * d));
      });
    });
    lens.addEventListener('pointerleave', () => tos.forEach((t) => t(1)));
  }
  if (RM) word.classList.add('is-in');
  else {
    gsap.from(chars, {
      yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.02,
      scrollTrigger: { trigger: word, start: 'top 92%', once: true },
      onComplete: () => word.classList.add('is-in'),
    });
  }
}

/* ───────────── scroll reveals ───────────── */
if (!RM) {
  const groups = [
    ['.shead__aside, .fixtures__note', { y: 24 }],
    ['.fx', { y: 60 }],
    ['.sblock, .season__buy, .season__media figcaption', { y: 40 }],
    ['.app__lede, .app__perks li, .app__badges', { y: 30 }],
    ['.resale__in > *', { y: 30 }],
    ['.pcell', { y: 30 }],
    ['.foot__grid > *', { y: 30 }],
  ];
  for (const [sel, from] of groups) {
    ScrollTrigger.batch(sel, {
      start: 'top 90%', once: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, ...from }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true }),
    });
  }
  // season steps: the connecting line draws itself
  gsap.from('.steps', { '--line': 0, duration: 1.4, ease: 'power3.inOut', scrollTrigger: { trigger: '.steps', start: 'top 85%', once: true } });
  // the pool rings breathe
  gsap.to('.pool__ring', { scale: 1.08, opacity: 0.25, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.5 });
}

/* ───────────── hero intro ───────────── */
if (!SKIP) {
  const tl = gsap.timeline({ delay: 0.15 });
  // the nav's CSS transform transition fights the tween (it froze off-screen), so pause it meanwhile
  nav.style.transition = 'none';
  tl.from(nav, { yPercent: -120, duration: 1.1, ease: 'expo.out', clearProps: 'transform,transition' }, 0.6)
    .from('.hero__top > *', { y: 20, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.9)
    .from('.next > *, .hero__ctas > *', { y: 30, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07 }, 1.2)
    .from('.hero__hint', { opacity: 0, duration: 1 }, 1.8);
  if (!stage?.hasHero) tl.from('.hero__fallback span', { yPercent: 100, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 }, 0.2);
}

addEventListener('load', () => ScrollTrigger.refresh());
document.fonts.ready.then(() => ScrollTrigger.refresh());
