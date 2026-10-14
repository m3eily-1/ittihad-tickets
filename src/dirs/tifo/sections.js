// Everything below the hero, in the same card language: card-flip headings, tile mosaics that flip
// away to reveal images, rows whose backgrounds fill card by card, and small card stands that wave.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, fine } from '../../ui.js';
import { MATCHES, SEASON, VENUES, SPONSORS, LINKS, eventUrl, seasonUrl, when, countdown, pad } from '../../data.js';
import { MiniTifo, stamp, blank, textWidth } from './minitifo.js';

/* ── headings whose letters arrive as flipping cards ── */
export function cardText(el) {
  if (el.dataset.cards) return el;
  el.dataset.cards = '1';
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 1) { walk(n); return; }
      if (n.nodeType !== 3) return;
      const frag = document.createDocumentFragment();
      for (const tok of n.textContent.split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) { frag.append(' '); continue; }
        const w = document.createElement('span');
        w.className = 'cw';
        for (const ch of tok) {
          const c = document.createElement('span');
          c.className = 'cc';
          c.textContent = ch;
          w.append(c);
        }
        frag.append(w);
      }
      n.replaceWith(frag);
    });
  };
  walk(el);
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  $$('.cw', el).forEach((w) => w.setAttribute('aria-hidden', 'true'));
  return el;
}
export function flipIn(el, { delay = 0, stagger = 0.028 } = {}) {
  const chars = $$('.cc', el);
  return gsap.fromTo(chars,
    { rotationX: -100, '--f': 1, opacity: 0 },
    { rotationX: 0, '--f': 0, opacity: 1, duration: 0.9, ease: 'back.out(1.6)', stagger: { each: stagger, from: 'start' }, delay, clearProps: 'transform' });
}

/* ── fixtures ── */
const CODE_COLS = 19, CODE_ROWS = 9;
export function renderFixtures({ still }) {
  const list = $('.js-fixtures');
  list.innerHTML = MATCHES.map((m, i) => {
    const w = when(m.kickoff);
    const v = VENUES[m.venueKey];
    const tiles = Array.from({ length: 3 * 28 }, (_, k) => `<i style="--d:${(k % 28) * 16 + Math.floor(k / 28) * 40 + Math.round(Math.random() * 40)}"></i>`).join('');
    return `
    <article class="fx" data-i="${i}">
      <div class="fx__tiles" aria-hidden="true">${tiles}</div>
      <div class="fx__date">
        <b>${w.date}</b>
        <span>${w.month}<br /><small>${w.day} · ${w.time} AST</small></span>
      </div>
      <div class="fx__main">
        <p class="fx__comp"><span>${m.compLabel}</span><span>${m.round}</span></p>
        <h3 class="fx__teams">
          <span class="fx__home"><b class="fx__crest"><img src="/teams/al-ittihad.png" alt="" width="30" height="30" /></b>Al Ittihad</span>
          <i>vs</i>
          <span class="fx__away"><b class="fx__crest"><img src="${m.crest}" alt="" width="30" height="30" /></b>${m.opp}</span>
        </h3>
        <p class="fx__venue">${m.venue} · ${v ? v.area : 'Jeddah'}</p>
      </div>
      <div class="fx__code" aria-hidden="true"><canvas></canvas><span>${m.oppCode} · ${m.oppFrom}</span></div>
      <div class="fx__buy">
        <p class="fx__from">From <b>SAR ${m.from}</b></p>
        <p class="fx__count js-count" data-k="${m.kickoff}" aria-label="Time to kick-off"></p>
        <a class="btn btn--y fx__cta magnetic" href="${eventUrl(m.slug)}" target="_blank" rel="noopener" aria-label="Book Al Ittihad vs ${m.opp}"><span>Book</span></a>
      </div>
    </article>`;
  }).join('');

  // each row carries the opponent's three-letter code on a tiny card stand
  const minis = $$('.fx').map((row, i) => {
    const m = MATCHES[i];
    const mt = new MiniTifo($('.fx__code canvas', row), { cols: CODE_COLS, rows: CODE_ROWS, still, gap: 0.18, waveOnMove: false });
    const g = stamp(blank(CODE_COLS, CODE_ROWS), m.oppCode, { fg: 1 });
    mt.set(g, { instant: true });
    const alt = stamp(blank(CODE_COLS, CODE_ROWS, 1), pad(+when(m.kickoff).date), { fg: 0 });
    row.addEventListener('pointerenter', () => mt.set(alt, { sweep: 'ltr', span: 0.5 }));
    row.addEventListener('pointerleave', () => mt.set(g, { sweep: 'rtl', span: 0.5 }));
    return mt;
  });

  // countdowns
  const tick = () => $$('.js-count').forEach((el) => {
    const c = countdown(+el.dataset.k);
    el.innerHTML = c.done ? '<span>Kicked off</span>' : `<span><b>${pad(c.d)}</b>d</span><span><b>${pad(c.h)}</b>h</span><span><b>${pad(c.m)}</b>m</span><span><b>${pad(c.s)}</b>s</span>`;
  });
  tick();
  setInterval(tick, 1000);

  // poster peek: follows the pointer, assembled from flipping tiles
  const peek = $('.fx-peek');
  if (fine() && !still) {
    const img = $('.fx-peek__img', peek), tiles = $('.fx-peek__tiles', peek);
    tiles.innerHTML = '<i></i>'.repeat(12 * 4);
    const xTo = gsap.quickTo(peek, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(peek, 'y', { duration: 0.6, ease: 'power3' });
    const rTo = gsap.quickTo(peek, 'rotation', { duration: 0.8, ease: 'power3' });
    let lastX = 0;
    list.addEventListener('pointermove', (e) => {
      xTo(e.clientX + 28); yTo(e.clientY - 70);
      rTo(gsap.utils.clamp(-8, 8, (e.clientX - lastX) * 0.6));
      lastX = e.clientX;
    });
    $$('.fx', list).forEach((row, i) => {
      row.addEventListener('pointerenter', (e) => {
        img.style.backgroundImage = `url(${MATCHES[i].poster})`;
        gsap.set(peek, { x: e.clientX + 28, y: e.clientY - 70 });
        peek.classList.add('is-on');
        gsap.fromTo($$('i', tiles), { rotationX: 0, opacity: 1 }, { rotationX: 90, opacity: 0, duration: 0.45, ease: 'power2.in', stagger: { grid: [4, 12], from: 'start', amount: 0.35 }, overwrite: true });
      });
      row.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
    });
  }
  return minis;
}

/* ── season pass ── */
export function setupSeason({ still }) {
  $('.js-season-title').textContent = SEASON.title;
  $('.js-season-tag').textContent = `Season ${SEASON.season}`;
  $('.js-season-from').textContent = SEASON.from;
  $('.js-season-cta').href = seasonUrl(SEASON.slug);
  $('.js-season-comps').innerHTML = SEASON.comps.map((c, i) => `<li><i>${pad(i + 1)}</i>${c}</li>`).join('');
  $('.js-season-venues').innerHTML = SEASON.venues.map((v, i) => `<li><i>${String.fromCharCode(65 + i)}</i>${v}</li>`).join('');

  // tile mosaic over the pass artwork: crest stripes that flip away as you scroll in
  const tiles = $('.js-sp-tiles');
  const N = 8;
  tiles.innerHTML = Array.from({ length: N * N }, (_, k) => `<i class="${(k % N) % 2 ? 'k' : 'y'}"></i>`).join('');
  const card = $('.js-sp-card');
  if (still) { tiles.remove(); return; }
  gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 85%', end: 'center 45%', scrub: 0.6 } })
    .to($$('i', tiles), { rotationX: -90, opacity: 0, ease: 'power1.in', stagger: { grid: [N, N], from: 'end', amount: 1 }, duration: 0.6 });
  // tilt with the pointer
  if (fine()) {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(card, 'rotationY', { duration: 0.8, ease: 'power3' });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 16);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 16);
      card.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); });
  }
}

/* ── app: a card stand that cycles words; the pointer sends waves ── */
export function setupApp({ still }) {
  $('.js-appstore').href = LINKS.appStore;
  $('.js-playstore').href = LINKS.playStore;
  $$('.js-resale').forEach((a) => { a.href = LINKS.resale; });
  const cols = 27, rows = 11;
  const mt = new MiniTifo($('.js-app-tifo'), { cols, rows, still, gap: 0.14 });
  const words = ['GET', 'THE', 'APP', 'ITT', '1927'];
  const label = $('.js-app-word');
  let i = 0;
  const show = (k, opts) => {
    const w = words[k % words.length];
    mt.set(stamp(blank(cols, rows), w, { fg: 1 }), opts);
    label.textContent = w;
  };
  show(0, { instant: true });
  if (still) return mt;
  let timer = 0;
  ScrollTrigger.create({
    trigger: '.app__stand', start: 'top 80%', end: 'bottom top',
    onToggle: (st) => {
      clearInterval(timer);
      if (st.isActive) {
        show(++i, { sweep: 'radial', origin: [0.5, 1], span: 0.8 });
        timer = setInterval(() => show(++i, { sweep: i % 2 ? 'ltr' : 'radial', origin: [Math.random(), 1], span: 0.8 }), 2600);
      }
    },
  });
  $('.app__stand').addEventListener('click', (e) => {
    const { x, y } = mt.cellAt(e);
    show(++i, { sweep: 'radial', origin: [x / cols, y / rows], span: 0.7 });
  });
  return mt;
}

/* ── partners: tiles that flip to the partner's name ── */
export function renderPartners() {
  $('.js-partners').innerHTML = SPONSORS.map(([k, name], i) => `
    <li class="pt__tile" tabindex="0" style="--i:${i}">
      <div class="pt__in">
        <div class="pt__front"><img src="/sponsors/${k}-k.png" alt="${name}" loading="lazy" /></div>
        <div class="pt__back" aria-hidden="true"><span>${name}</span><i>${pad(i + 1)}</i></div>
      </div>
    </li>`).join('');
  // tap flips on touch
  $$('.pt__tile').forEach((t) => t.addEventListener('click', () => { if (!fine()) t.classList.toggle('is-flip'); }));
}

/* ── footer ── */
export function setupFooter({ still }) {
  const map = { '.js-store': LINKS.store, '.js-about': LINKS.about, '.js-x': LINKS.x, '.js-ig': LINKS.instagram, '.js-yt': LINKS.youtube, '.js-sc': LINKS.snapchat };
  for (const [s, href] of Object.entries(map)) $$(s).forEach((a) => { a.href = href; });
  const words = ['ITTIHAD', 'TIGERS', 'AL-AMEED', '1927', 'JEDDAH'];
  const cols = Math.max(...words.map(textWidth)) + 4, rows = 11;
  const mt = new MiniTifo($('.js-foot-tifo'), { cols, rows, still, gap: 0.16 });
  let i = 0;
  mt.set(stamp(blank(cols, rows), words[0], { fg: 1 }), { instant: true });
  if (still) return mt;
  const next = (origin = [0.5, 0.5], sweep = 'radial') => { i = (i + 1) % words.length; mt.set(stamp(blank(cols, rows), words[i], { fg: 1 }), { sweep, origin, span: 0.9 }); };
  $('.foot__stand').addEventListener('click', (e) => { const { x, y } = mt.cellAt(e); next([x / cols, y / rows]); });
  let timer = 0;
  ScrollTrigger.create({
    trigger: '.foot__stand', start: 'top 90%', end: 'bottom top',
    onEnter: () => mt.sweepWave(1, 1.2),
    onToggle: (st) => { clearInterval(timer); if (st.isActive) timer = setInterval(() => next([0, 0.5], 'ltr'), 4200); },
  });
  return mt;
}

/* ── scroll reveals ── */
export function reveals({ still }) {
  if (still) return;
  $$('.shead__title.js-cards, .app__title.js-cards').forEach((h) => {
    gsap.set($$('.cc', h), { rotationX: -100, opacity: 0, '--f': 1 });
    ScrollTrigger.create({ trigger: h, start: 'top 86%', once: true, onEnter: () => flipIn(h) });
  });
  $$('.shead__aside, .sec-num').forEach((el) => gsap.from(el, { opacity: 0, y: 16, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));

  // fixture rows deal in like cards onto a table
  ScrollTrigger.batch('.fx', {
    start: 'top 92%', once: true,
    onEnter: (els) => gsap.fromTo(els, { rotationX: -70, y: 60, opacity: 0, transformOrigin: '50% 0%' }, { rotationX: 0, y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.1, clearProps: 'transform' }),
  });
  gsap.set('.fx', { opacity: 0 });

  // the club statement: each word is a card, turned over as you scroll
  const club = $('.js-club');
  cardText(club);
  const words = $$('.cw', club);
  gsap.set(words, { rotationX: -88, opacity: 0.12, transformOrigin: '50% 100%', transformPerspective: 500 });
  // highlighted words land as yellow cards, each held at its own slight angle
  const tilt = (i, el) => (el.closest('em') ? gsap.utils.random(-3.5, 3.5) : 0);
  gsap.to(words, { rotationX: 0, rotation: tilt, opacity: 1, ease: 'power2.out', stagger: 0.12, duration: 0.5, scrollTrigger: { trigger: club, start: 'top 82%', end: 'bottom 55%', scrub: 0.8 } });

  // season details + steps
  gsap.from('.sp__price > *', { yPercent: 60, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '.sp__price', start: 'top 88%', once: true } });
  gsap.from('.sp__comps li, .sp__venues li', { rotationX: -90, opacity: 0, transformOrigin: '50% 0%', duration: 0.8, ease: 'back.out(1.4)', stagger: 0.07, scrollTrigger: { trigger: '.sp__lists', start: 'top 88%', once: true } });
  gsap.from('.how__step', { rotationY: -70, opacity: 0, transformOrigin: '0% 50%', duration: 1.1, ease: 'expo.out', stagger: 0.14, scrollTrigger: { trigger: '.how', start: 'top 85%', once: true } });
  gsap.from('.resale', { clipPath: 'inset(0 100% 0 0)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: '.resale', start: 'top 88%', once: true } });
  gsap.from('.app__badges a', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.app__badges', start: 'top 92%', once: true } });

  // partner tiles flip up one after another, like a section of the stand
  gsap.from('.pt__in', { rotationX: 180, duration: 1.1, ease: 'back.out(1.2)', stagger: { each: 0.07, grid: 'auto', from: 'start' }, scrollTrigger: { trigger: '.pt', start: 'top 85%', once: true }, clearProps: 'transform' });
}
