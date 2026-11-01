// Kit memory (Ahmed, 2026-11-01, from the list of new games): pairs of the club store's products, face down. Turn two
// at a time; a pair stays up and names the product. Clear the table before the clock runs out — your score is the
// seconds left. Rookie: 6 pairs and a peek at the start · Pro: 8 pairs · Legend: 10 pairs (tiers.js DIFF.kits).
// The products, names and prices are the store's own (products.js, shop.ittihadclub.sa).
import './kit-memory.css';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { tiers } from './tiers.js';
import { openShare } from './share-card.js';
import { PRODUCTS } from './products.js';
import { h, topBar, lbBtn, btn, tierOf, tierChip, roundEnd, starsLine } from './minigames.js';

const CREST = '/teams/al-ittihad.png';
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };
const sar = (n) => `SAR ${Number.isInteger(n) ? n : n.toFixed(2)}`;
// the store's names are long ("Al Ittihad Home Jersey 26/27 - Men"); the card shows the part that tells them apart
const short = (p) => p.name.replace(/^Al[- ]Ittihad( Club| FC)?\s*/i, '').replace(/\s*[—|-]\s*(Men|Al-Ittihad Club)$/i, '').replace(/\s*\|.*$/, '');

export function buildKitMemory(root, { opts, back }) {
  const tier = tierOf('kits', opts), D = tiers.diff('kits', tier);
  const bestEl = h('b', { text: String(tiers.best('kits', tier)) });
  const clock = h('i', { class: 'km-clock__fill' });
  const timeEl = h('b', { text: String(D.time) });
  const pairsEl = h('b', { text: `0/${D.pairs}` });
  const grid = h('div', { class: 'km-grid', role: 'grid', 'aria-label': 'Cards' });
  const toast = h('p', { class: 'km-toast', 'aria-hidden': 'true' });
  const live = h('p', { class: 'mg-sr', 'aria-live': 'polite' });
  const start = h('div', { class: 'km-start' },
    h('p', { class: 'mg-k__hintt', text: D.peek ? 'Watch the table' : 'Find the pairs' }),
    h('p', { class: 'mg-k__hints', text: `${D.pairs} pairs from the club store · ${D.time} seconds${D.peek ? ' · every card shows for a moment first' : ''}` }),
    btn('Start', () => { feel.tap(); begin(); }, { aria: 'Start Kit memory', cls: 'mg-btn--wide' }),
  );
  const card = h('div', { class: 'mg-k__over', hidden: true });
  const screen = h('section', { class: 'mg-screen km' },
    topBar('Kit memory', back, [tierChip(tier), h('p', { class: 'mg-chip' }, 'Best ', bestEl), lbBtn('kits')]),
    h('div', { class: 'km-hud' },
      h('p', { class: 'km-hud__k' }, 'Pairs ', pairsEl),
      h('div', { class: 'km-clock', 'aria-hidden': 'true' }, clock),
      h('p', { class: 'km-hud__k' }, timeEl, ' s'),
    ),
    h('div', { class: 'km-table' }, grid, start),
    toast, card, live,
  );
  root.append(screen);

  let state = 'ready', deck = [], open = [], found = 0, left = D.time, raf = 0, lastT = 0, dead = false, lock = false, combo = 0, toastT = 0;

  // the biggest cards that fit: try each column count, keep the one with the largest card (cards are 4:5)
  const fit = () => {
    const box = grid.parentElement.getBoundingClientRect(), n = deck.length || D.pairs * 2, gap = Math.max(6, Math.min(12, box.width / 90));
    let best = { s: 0, cols: 4 };
    for (let cols = 2; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const w = Math.min((box.width - gap * (cols - 1)) / cols, ((box.height - gap * (rows - 1)) / rows) * 0.8);
      if (w > best.s) best = { s: w, cols };
    }
    grid.style.setProperty('--cols', best.cols);
    grid.style.setProperty('--cw', `${Math.floor(best.s)}px`);
    grid.style.setProperty('--gap', `${gap}px`);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(grid.parentElement);

  const deal = () => {
    const pick = shuffle(PRODUCTS).slice(0, D.pairs);
    deck = shuffle([...pick, ...pick]).map((p, i) => ({ p, i, up: false, done: false }));
    grid.replaceChildren(...deck.map((c, i) => {
      const b = h('button', { class: 'km-card', type: 'button', 'aria-label': `Card ${i + 1}, face down`, onclick: () => flip(i) },
        h('span', { class: 'km-card__in' },
          h('span', { class: 'km-card__back', 'aria-hidden': 'true' }, h('img', { src: CREST, alt: '', draggable: 'false' })),
          h('span', { class: 'km-card__face', 'aria-hidden': 'true' }, h('img', { src: c.p.img, alt: '', draggable: 'false' }), h('em', { text: short(c.p) })),
        ));
      c.el = b;
      return b;
    }));
    fit();
  };
  const show = (c, up) => { c.up = up; c.el.classList.toggle('is-up', up); c.el.setAttribute('aria-label', up || c.done ? `${c.p.name}${c.done ? ', paired' : ''}` : `Card ${c.i + 1}, face down`); };
  const say = (t) => { toast.textContent = t; toast.classList.remove('is-on'); void toast.offsetWidth; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 1400); };

  function begin() {
    start.hidden = true;
    if (D.peek) {
      state = 'peek'; lock = true;
      deck.forEach((c) => show(c, true));
      setTimeout(() => { if (dead) return; deck.forEach((c) => show(c, false)); setTimeout(() => { lock = false; go(); }, 450); }, D.peek * 1000);
    } else go();
  }
  function go() {
    state = 'play'; lastT = 0;
    grid.querySelector('.km-card')?.focus({ preventScroll: true });
    raf = requestAnimationFrame(tick);
  }
  function tick(t) {
    if (dead || state !== 'play') return;
    raf = requestAnimationFrame(tick);
    const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
    left = Math.max(0, left - dt);
    timeEl.textContent = String(Math.ceil(left));
    clock.style.transform = `scaleX(${left / D.time})`;
    screen.classList.toggle('is-late', left <= 10);
    if (left <= 0) end(false);
  }
  function flip(i) {
    const c = deck[i];
    if (state !== 'play' || lock || c.up || c.done) return;
    feel.tap();
    show(c, true); open.push(c);
    if (open.length < 2) return;
    const [a, b] = open; open = [];
    if (a.p.key === b.p.key) {
      combo++;
      a.done = b.done = true;
      setTimeout(() => { for (const x of [a, b]) { x.el.classList.add('is-done'); show(x, true); } }, 160);
      found++; pairsEl.textContent = `${found}/${D.pairs}`;
      say(`${short(a.p)} · ${sar(a.p.price)}`);
      live.textContent = `Pair: ${a.p.name}. ${found} of ${D.pairs}.`;
      if (combo >= 2) feel.pop?.(`${combo} IN A ROW`, (() => { const r = b.el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top }; })());
      if (found === D.pairs) setTimeout(() => end(true), 450);
    } else {
      combo = 0; lock = true;
      setTimeout(() => { if (dead) return; show(a, false); show(b, false); lock = false; }, 750);
    }
  }
  function end(cleared) {
    if (state === 'over') return;
    state = 'over'; cancelAnimationFrame(raf);
    const score = cleared ? Math.max(1, Math.ceil(left)) : 0;
    const prevBest = tiers.best('kits', tier);
    progress.setBest('kits', score);
    const rec = roundEnd('kits', tier, score, { pairs: found });
    const isBest = score > 0 && score > prevBest;
    const xp = cleared ? 30 + score : found * 3;
    if (xp > 0) progress.award(xp, cleared ? `Kit memory · ${score}s left` : `Kit memory · ${found} pairs`);
    if (cleared && score >= 15) progress.achieve('kits-15');
    bestEl.textContent = String(tiers.best('kits', tier));
    if (cleared) { feel.win(); if (isBest) feel.confetti({ n: 160, y: 0.3 }); } else feel.miss();
    card.replaceChildren(h('div', { class: 'mg-card' },
      h('p', { class: 'mg-card__eyebrow', text: cleared ? 'Table cleared' : "Time's up" }),
      h('p', { class: 'mg-card__big', text: cleared ? String(score) : `${found}/${D.pairs}` }),
      h('p', { class: 'mg-card__label', text: cleared ? (score === 1 ? 'second left' : 'seconds left') : 'pairs found' }),
      isBest ? h('p', { class: 'mg-badge', text: prevBest ? `New best · was ${prevBest}` : 'New best' }) : h('p', { class: 'mg-card__sub', text: `Best ${tiers.best('kits', tier)}s left` }),
      ...starsLine(tier, rec),
      xp > 0 ? h('p', { class: 'mg-card__xp', text: `+${xp} XP` }) : null,
      h('div', { class: 'mg-card__row' },
        btn('Retry', () => { feel.tap(); reset(); }, { aria: 'Play Kit memory again' }),
        btn('Share', () => { feel.tap(); openShare({ kind: 'score', game: 'kits', score, tier, stars: rec.stars }); }, { kind: 'ghost', aria: 'Share your score' }),
        btn('Back', back, { kind: 'ghost', aria: 'Back — close the game' }),
      ),
    ));
    card.hidden = false;
    live.textContent = cleared ? `Table cleared with ${score} seconds left.` : `Time's up. ${found} of ${D.pairs} pairs.`;
    requestAnimationFrame(() => card.querySelector('.mg-btn')?.focus({ preventScroll: true }));
  }
  function reset() {
    cancelAnimationFrame(raf);
    state = 'ready'; open = []; found = 0; left = D.time; lock = false; combo = 0;
    pairsEl.textContent = `0/${D.pairs}`; timeEl.textContent = String(D.time); clock.style.transform = '';
    screen.classList.remove('is-late');
    card.hidden = true; card.replaceChildren(); start.hidden = false;
    deal();
    start.querySelector('.mg-btn')?.focus({ preventScroll: true });
  }
  reset();

  return () => { dead = true; cancelAnimationFrame(raf); ro.disconnect(); clearTimeout(toastT); };
}
