// Hero · the broadcast opener. A "coming up" rotation through the home fixtures: each cut runs a
// stripe-edged wipe + RGB split in the WebGL plate while the match graphic and lower-thirds re-key.
import gsap from 'gsap';
import { $, $$, fine } from '../../ui.js';
import { MATCHES, when, countdown, pad, eventUrl, nextMatch } from '../../data.js';
import { createPlate } from './plate.js';

const TRIOS = ['/img/players/trio-diriyah.webp', '/img/players/trio-shabab.webp'];
const trioOf = (i) => i % 2;
const HOLD = 7; // seconds per fixture

// "Shabab Al Ahli" → ["Shabab", "Al Ahli"]: two-line name straps
function lines(name) {
  const w = name.split(' ');
  if (w.length < 2) return [name];
  if (w.length === 2) return w;
  return [w[0], w.slice(1).join(' ')];
}
const nameHTML = (name) => lines(name).map((l) => `<span class="ln"><i>${l}</i></span>`).join(' ');
export const cdText = (ts) => {
  const c = countdown(ts);
  return c.done ? 'Kicked off' : `${pad(Math.min(99, c.d))}D ${pad(c.h)}:${pad(c.m)}:${pad(c.s)}`;
};

export function createHero({ still }) {
  const hero = $('#kickoff');
  const canvas = $('.js-gl', hero);
  const chan = $('.chan', hero);
  const order = MATCHES.map((_, i) => i);
  let idx = Math.max(0, MATCHES.indexOf(nextMatch()));

  /* channel tabs: one per fixture, with a fill that runs while it's on air */
  chan.innerHTML = MATCHES.map((m, i) => {
    const w = when(m.kickoff);
    return `<button class="chan__b" role="tab" type="button" aria-selected="false" data-i="${i}" aria-label="${m.opp}, ${w.day} ${w.date} ${w.month}">
      <span class="chan__n">CH ${pad(i + 1)}</span>
      <img src="${m.crest}" alt="" />
      <span class="chan__t"><b>${m.oppCode}</b><small>${w.date} ${w.month}</small></span>
      <i class="chan__p"></i>
    </button>`;
  }).join('');
  const tabs = $$('.chan__b', chan);

  /* the home name never changes; wrap it once */
  $('.mu__side--home .mu__name', hero).innerHTML = nameHTML('Al Ittihad');

  function fill(i) {
    const m = MATCHES[i];
    const w = when(m.kickoff);
    $('.js-h-opp', hero).innerHTML = nameHTML(m.opp);
    $('.js-h-crest', hero).src = m.crest;
    $('.js-h-crest', hero).alt = `${m.opp} crest`;
    $('.js-h-from', hero).textContent = `Away · ${m.oppFrom}`;
    $('.js-h-time', hero).textContent = w.time;
    $('.js-h-comp', hero).textContent = m.compLabel;
    $('.js-h-round', hero).textContent = m.round;
    $('.js-h-venue', hero).textContent = m.venue;
    $('.js-h-date', hero).textContent = `${w.day} ${w.date} ${w.month}`;
    $('.js-h-ko', hero).textContent = w.time;
    $('.js-h-price', hero).textContent = m.from;
    $('.js-h-book', hero).href = eventUrl(m.slug);
    $('.js-h-book', hero).setAttribute('aria-label', `Book tickets for Al Ittihad v ${m.opp}`);
    $('.js-h-idx', hero).textContent = `${pad(i + 1)} / ${pad(MATCHES.length)}`;
    $('.js-h-cd', hero).textContent = cdText(m.kickoff);
    hero.dataset.comp = m.comp;
    tabs.forEach((t, j) => { t.classList.toggle('is-on', j === i); t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1; });
  }
  fill(idx);
  setInterval(() => { $('.js-h-cd', hero).textContent = cdText(MATCHES[idx].kickoff); }, 1000);

  /* WebGL plate (falls back to the plain cut-out) */
  const plate = createPlate(canvas, TRIOS, { still });
  if (!plate) hero.classList.add('no-gl');
  const fb = $('.js-fb', hero);
  fb.src = TRIOS[trioOf(idx)];
  const frameFn = (w, h) => {
    const hud = $('.hud')?.offsetHeight || 0;
    if (w < 720) {
      const low = $('.hero__low', hero);
      const lowTop = low.offsetTop + 12;
      const top = $('.mu', hero).offsetTop - 10;
      const maxH = Math.max(160, lowTop - top);
      const scale = Math.min(maxH, (w * 1.08) * (874 / 941)) / h;
      return { scale, lift: (h - lowTop) / h };
    }
    return { scale: Math.min(0.86, 0.6 + (w / h) * 0.08), lift: Math.max(0, (hud - 30) / h) };
  };
  if (plate) {
    plate.resize(frameFn);
    plate.ready.then(() => plate.commit(trioOf(idx)));
    addEventListener('resize', () => plate.resize());
  }

  // render only while the hero is on screen and the tab is visible
  let onScreen = true;
  const t0 = performance.now();
  const tick = () => plate?.render((performance.now() - t0) / 1000);
  let running = false;
  const sync = () => {
    const want = onScreen && !document.hidden && !!plate;
    if (want === running) return;
    running = want;
    want ? gsap.ticker.add(tick) : gsap.ticker.remove(tick);
  };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  sync();

  if (fine()) {
    hero.addEventListener('pointermove', (e) => {
      const x = e.clientX / innerWidth - 0.5;
      plate?.pointer(x * 2);
      gsap.to('.mu__side--home', { x: x * -14, duration: 1, ease: 'power3', overwrite: 'auto' });
      gsap.to('.mu__side--away', { x: x * 14, duration: 1, ease: 'power3', overwrite: 'auto' });
    });
  }

  /* ── cuts ── */
  let busy = false, prog = null;

  function runProgress() {
    prog?.kill();
    tabs.forEach((t) => gsap.set($('.chan__p', t), { scaleX: 0 }));
    if (still) return;
    prog = gsap.fromTo($('.chan__p', tabs[idx]), { scaleX: 0 }, {
      scaleX: 1, duration: HOLD, ease: 'none',
      onComplete: () => go((idx + 1) % order.length),
    });
    if (paused) prog.pause();
  }

  function go(i) {
    if (busy || i === idx) return;
    busy = true;
    prog?.kill();
    idx = i;
    if (still) {
      fill(i);
      plate?.commit(trioOf(i));
      fb.src = TRIOS[trioOf(i)];
      busy = false;
      runProgress();
      return;
    }
    plate?.prepare(trioOf(i));
    const u = plate?.uniforms;
    const tl = gsap.timeline({
      onComplete: () => {
        plate?.commit(trioOf(i));
        fb.src = TRIOS[trioOf(i)];
        busy = false;
        runProgress();
      },
    });
    hero.classList.add('is-cut');
    if (u) {
      tl.to(u.uGlitch, { value: 1, duration: 0.14, ease: 'power2.in' }, 0)
        .to(u.uMix, { value: 1, duration: 0.85, ease: 'power2.inOut' }, 0.02)
        .to(u.uGlitch, { value: 0, duration: 0.55, ease: 'power2.out' }, 0.4);
    }
    // graphics out: names drop through their masks, straps retract left
    tl.to($$('.js-h-opp .ln > i', hero), { yPercent: 110, duration: 0.32, stagger: 0.04, ease: 'power3.in' }, 0)
      .to($$('.mu__side--away .mu__crest, .mu__side--away .mu__role', hero), { opacity: 0, x: 24, duration: 0.25, ease: 'power2.in' }, 0)
      .to($$('.lt > p', hero), { clipPath: 'inset(0 100% 0 0)', duration: 0.32, stagger: 0.04, ease: 'power3.in' }, 0)
      .to($$('.mu__vs span, .buy__from', hero), { opacity: 0, duration: 0.2 }, 0)
      .add(() => fill(i), 0.42)
      .set($$('.js-h-opp .ln > i', hero), { yPercent: -110 }, 0.43)
      .to($$('.js-h-opp .ln > i', hero), { yPercent: 0, duration: 0.7, stagger: 0.06, ease: 'expo.out' }, 0.45)
      .to($$('.mu__side--away .mu__crest, .mu__side--away .mu__role', hero), { opacity: 1, x: 0, duration: 0.6, ease: 'expo.out' }, 0.5)
      .to($$('.lt > p', hero), { clipPath: 'inset(0 0% 0 0)', duration: 0.6, stagger: 0.07, ease: 'expo.out' }, 0.55)
      .to($$('.mu__vs span, .buy__from', hero), { opacity: 1, duration: 0.3 }, 0.6)
      .add(() => hero.classList.remove('is-cut'), 0.62);
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => go(i)));
  chan.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const n = (idx + (e.key === 'ArrowRight' ? 1 : MATCHES.length - 1)) % MATCHES.length;
    go(n);
    tabs[n].focus();
  });

  // hold the rotation while someone is reading the price or choosing a channel, or it's off screen
  let paused = false;
  const hold = (v) => { paused = v; if (prog) v ? prog.pause() : prog.resume(); };
  $$('.chan, .buy', hero).forEach((el) => {
    el.addEventListener('pointerenter', () => hold(true));
    el.addEventListener('pointerleave', () => hold(false));
  });
  new IntersectionObserver(([e]) => hold(!e.isIntersecting), { threshold: 0.35 }).observe(hero);

  /* ── opener: the graphics key in over the plate ── */
  function intro() {
    const u = plate?.uniforms;
    const tl = gsap.timeline({ onComplete: runProgress });
    if (u) {
      u.uIn.value = 0;
      u.uGlitch.value = 0.8;
      tl.to(u.uIn, { value: 1, duration: 1.3, ease: 'power2.out' }, 0)
        .to(u.uGlitch, { value: 0, duration: 1.0, ease: 'power2.out' }, 0.25);
    }
    tl.from('.hero__top > *', { y: -16, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'expo.out' }, 0.1)
      .from($$('.mu__name .ln > i', hero), { yPercent: 110, duration: 0.9, stagger: 0.07, ease: 'expo.out' }, 0.25)
      .from($$('.mu__crest', hero), { scale: 0.6, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'back.out(2)' }, 0.35)
      .from($$('.mu__role', hero), { opacity: 0, x: -12, duration: 0.6, stagger: 0.1, ease: 'expo.out' }, 0.5)
      .from('.mu__vs', { scale: 1.6, opacity: 0, duration: 0.7, ease: 'expo.out' }, 0.45)
      .fromTo($$('.lt > p', hero), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.8, stagger: 0.1, ease: 'expo.out' }, 0.6)
      .from('.buy', { y: 20, opacity: 0, duration: 0.8, ease: 'expo.out' }, 0.8);
    return tl;
  }

  return { intro, start: runProgress, go };
}
