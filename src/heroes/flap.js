// Hero C — a stadium departures board. Split-flap cells riffle through the alphabet to the
// next kick-off; the countdown ticks live; hovering a fixture re-flips the board to it.
import gsap from 'gsap';
import { $, $$ } from '../ui.js';
import { MATCHES, nextMatch, when, countdown, pad, eventUrl } from '../data.js';

const CHARS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:·-'/";
const VENUE_SHORT = {
  'King Abdullah Sports City Stadium': 'KING ABDULLAH SPORTS CITY',
  'Prince Abdullah Al Faisal Sports City Stadium': 'PRINCE ABDULLAH AL FAISAL',
  'Alinma Stadium': 'ALINMA STADIUM',
};

// tiny mechanical click, synthesised so there is no audio file to load
let actx = null;
function click() {
  if (!actx || actx.state !== 'running') return;
  const len = 0.012, buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const src = actx.createBufferSource(), g = actx.createGain(), f = actx.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 1600;
  g.gain.value = 0.18;
  src.buffer = buf; src.connect(f).connect(g).connect(actx.destination); src.start();
}
let lastClick = 0;
const maybeClick = () => { const n = performance.now(); if (n - lastClick > 22) { lastClick = n; click(); } };

class Cell {
  constructor(parent) {
    this.ch = ' ';
    this.el = document.createElement('span');
    this.el.className = 'flap';
    this.el.innerHTML = '<span class="f-t"><b> </b></span><span class="f-b"><b> </b></span><span class="f-ft"><b> </b></span><span class="f-fb"><b> </b></span>';
    [this.t, this.b, this.ft, this.fb] = [...this.el.children].map((s) => s.firstChild);
    [, , this.ftEl, this.fbEl] = [...this.el.children];
    parent.append(this.el);
    this.queue = Promise.resolve();
  }
  // one physical flip from the current char to `next`
  step(next, dur) {
    return new Promise((res) => {
      const cur = this.ch;
      this.t.textContent = next; this.ft.textContent = cur; this.fb.textContent = next;
      gsap.set(this.ftEl, { rotationX: 0 }); gsap.set(this.fbEl, { rotationX: 90 });
      gsap.timeline({ onComplete: () => { this.b.textContent = next; this.ch = next; gsap.set(this.fbEl, { rotationX: 90 }); res(); } })
        .to(this.ftEl, { rotationX: -90, duration: dur / 2, ease: 'power1.in' })
        .to(this.fbEl, { rotationX: 0, duration: dur / 2, ease: 'power1.out' });
      maybeClick();
    });
  }
  set(target, { riffle = true } = {}) {
    target = CHARS.includes(target) ? target : ' ';
    this.queue = this.queue.then(async () => {
      if (target === this.ch) return;
      let i = CHARS.indexOf(this.ch), j = CHARS.indexOf(target);
      const path = [];
      if (riffle) {
        // walk the drum forward, but cap long walks so the board settles quickly
        let steps = (j - i + CHARS.length) % CHARS.length;
        const skip = Math.max(1, Math.ceil(steps / 7));
        while (steps > skip) { i = (i + skip) % CHARS.length; steps -= skip; path.push(CHARS[i]); }
      }
      path.push(target);
      for (const c of path) await this.step(c, c === target ? 0.14 : 0.07);
    });
    return this.queue;
  }
}

function makeRow(el, n) {
  el.innerHTML = '';
  return Array.from({ length: n }, () => new Cell(el));
}
function fit(text, n, align = 'left') {
  text = text.toUpperCase().slice(0, n);
  const free = n - text.length;
  if (align === 'center') return ' '.repeat(Math.floor(free / 2)) + text + ' '.repeat(Math.ceil(free / 2));
  return text + ' '.repeat(free);
}

export function createFlap(root) {
  const board = $('.js-board', root);
  const rowCount = $('.js-flap-count', root), rowMatch = $('.js-flap-match', root), rowInfo = $('.js-flap-info', root);
  const list = $('.js-flap-list', root);
  const book = $('.js-flap-book', root);
  let current = nextMatch();
  let rows = {};
  let narrow = false, mid = false;

  const build = () => {
    narrow = innerWidth < 720;
    mid = !narrow && innerWidth < 1100;
    const spec = narrow ? { count: 15, match: 14, info: 24 } : mid ? { count: 15, match: 24, info: 32 } : { count: 15, match: 24, info: 58 };
    rows = { count: makeRow(rowCount, spec.count), match: makeRow(rowMatch, spec.match), info: makeRow(rowInfo, spec.info), spec };
    if (narrow) {
      // a second match line on phones: ITTIHAD V / OPPONENT
      let extra = $('.js-flap-match2', board);
      if (!extra) { extra = document.createElement('div'); extra.className = 'board__row js-flap-match2'; rowMatch.after(extra); }
      rows.match2 = makeRow(extra, spec.match);
    } else $('.js-flap-match2', board)?.remove();
    sizeCells();
    rows.count.forEach((c, i) => { if ([2, 6, 10, 14].includes(i)) c.el.classList.add('is-y'); });
  };
  const sizeCells = () => {
    const inner = board.clientWidth - parseFloat(getComputedStyle(board).paddingLeft) * 2;
    const gap = narrow ? 2 : 4;
    [[rowCount, rows.spec.count], [rowMatch, rows.spec.match], [$('.js-flap-match2', board), rows.spec.match], [rowInfo, rows.spec.info]].forEach(([el, n]) => {
      if (!el) return;
      el.style.gap = `${gap}px`;
      el.style.setProperty('--cell', `${Math.floor((inner - gap * (n - 1)) / n)}px`);
    });
  };

  const countText = () => { const c = countdown(current.kickoff); return `${pad(Math.min(c.d, 99))}D ${pad(c.h)}H ${pad(c.m)}M ${pad(c.s)}S`; };
  const show = (m, { riffle = true } = {}) => {
    current = m;
    const w = when(m.kickoff);
    const comp = m.comp === 'afc' ? 'AFC ELITE' : `RSL ${m.round.replace('Matchweek ', 'MW')}`;
    if (narrow) {
      rows.match.forEach((c, i) => c.set(fit('ITTIHAD V', rows.spec.match)[i], { riffle }));
      rows.match2.forEach((c, i) => c.set(fit(m.oppShort, rows.spec.match)[i], { riffle }));
      rows.info.forEach((c, i) => c.set(fit(`${comp} · ${w.date} ${w.month} ${w.time}`, rows.spec.info)[i], { riffle }));
    } else {
      rows.match.forEach((c, i) => c.set(fit(`ITTIHAD V ${m.oppShort}`, rows.spec.match)[i], { riffle }));
      const info = mid ? `${comp} · ${w.day} ${w.date} ${w.month} · ${w.time}` : `${comp} · ${w.day} ${w.date} ${w.month} · ${w.time} · ${VENUE_SHORT[m.venue] || m.venue}`;
      rows.info.forEach((c, i) => c.set(fit(info, rows.spec.info)[i], { riffle }));
    }
    rows.count.forEach((c, i) => c.set(countText()[i], { riffle }));
    book.href = eventUrl(m.slug);
    $$('li', list).forEach((li) => li.classList.toggle('is-on', li.dataset.slug === m.slug));
  };

  // fixtures list under the board
  list.innerHTML = MATCHES.map((m) => {
    const w = when(m.kickoff);
    return `<li data-slug="${m.slug}" tabindex="0"><span>${w.date} ${w.month}</span><b>vs ${m.opp}</b><span>${w.time}</span><span class="hvf__status">● On sale</span></li>`;
  }).join('');
  const pick = (li) => { const m = MATCHES.find((x) => x.slug === li.dataset.slug); if (m && m !== current) { show(m); restartCycle(); } };
  $$('li', list).forEach((li) => {
    li.addEventListener('pointerenter', () => pick(li));
    li.addEventListener('focus', () => pick(li));
    li.addEventListener('click', () => pick(li));
  });

  // countdown ticks every second (only changed cells flip)
  const tick = setInterval(() => { const s = countText(); rows.count.forEach((c, i) => c.set(s[i], { riffle: false })); }, 1000);
  // and the board cycles through the fixtures on its own
  let cycle;
  const restartCycle = () => { clearInterval(cycle); cycle = setInterval(() => show(MATCHES[(MATCHES.indexOf(current) + 1) % MATCHES.length]), 9000); };

  const soundBtn = $('.js-flap-sound', root);
  const onSound = () => {
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.querySelector('b').textContent = on ? 'on' : 'off';
    if (on) { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } else actx?.suspend();
  };
  soundBtn.addEventListener('click', onSound);

  let rz;
  const onResize = () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      const mode = (w) => (w < 720 ? 0 : w < 1100 ? 1 : 2);
      if (mode(innerWidth) !== (narrow ? 0 : mid ? 1 : 2)) { build(); show(current, { riffle: false }); } else sizeCells();
    }, 120);
  };
  addEventListener('resize', onResize);
  build();

  return {
    intro() {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.from(board, { autoAlpha: 0, y: 40, rotationX: 30, transformPerspective: 1200, duration: 1.4 }, 0)
        .from($$('.hvf__top, .hvf__list li, .hv--flap .hero__ctas > *', root), { autoAlpha: 0, y: 20, duration: 1, stagger: 0.06 }, 0.4)
        .add(() => { show(current); restartCycle(); }, 0.5);
      return tl;
    },
    destroy() {
      clearInterval(tick); clearInterval(cycle);
      removeEventListener('resize', onResize);
      soundBtn.removeEventListener('click', onSound);
      actx?.suspend();
    },
  };
}
