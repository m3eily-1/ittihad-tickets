// Collectible legend cards (Ahmed, 2026-10-21): the Hall of Fame's twelve legends as FC-style cards. No photos
// and no made-up ratings: the card carries what legends.js has (position, years, the sourced facts) and a big
// monogram. Each unlocks with an achievement (progress.js); the collection screen shows what's still to win.
import './cards.css';
import { LEGENDS } from './legends.js';
import { progress, ACHIEVEMENTS } from './progress.js';
import { feel } from './feel.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const POS = { Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Striker: 'ST', Winger: 'WG', 'Head coach': 'COACH' };
const initials = (n) => n.split(/\s+/).map((w) => w.replace(/^(Al|El)-/, '')[0]).join('').slice(0, 2).toUpperCase();
const CREST = '/teams/al-ittihad.png';

export function cardHTML(i, { locked = false, big = false } = {}) {
  const L = LEGENDS[i];
  const special = L.name === 'Karim Benzema';
  if (locked) {
    const u = progress.unlockOf(i);
    return `<article class="lc is-locked${big ? ' is-big' : ''}" data-card="${i}"><div class="lc__in">
      <img class="lc__crest" src="${CREST}" alt=""/><b class="lc__q">?</b>
      <p class="lc__lock">${esc(u ? u.label : 'Keep playing')}</p></div></article>`;
  }
  return `<article class="lc${special ? ' is-special' : ''}${big ? ' is-big' : ''}" data-card="${i}"><div class="lc__in">
    <div class="lc__tl"><b>${POS[L.pos] || L.pos}</b><span>${esc(L.years)}</span><img src="${CREST}" alt=""/></div>
    ${L.photo ? `<div class="lc__mono has-photo" aria-hidden="true"><img src="${esc(L.photo)}" alt=""/></div>` : `<div class="lc__mono" aria-hidden="true">${esc(initials(L.name))}</div>`}
    <h4 class="lc__name">${esc(L.name)}</h4>
    ${L.ar ? `<p class="lc__ar" lang="ar" dir="rtl">${esc(L.ar)}</p>` : ''}
    <ul class="lc__facts">${L.facts.slice(0, big ? 3 : 2).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    <p class="lc__set">Ittihad Legends · ${String(i + 1).padStart(2, '0')}/${LEGENDS.length}</p></div>${big && L.credit ? `<p class="lc__credit">${esc(L.credit)}</p>` : ''}</article>`;
}

/* the collection screen */
let colEl = null;
export function openCollection({ onClose } = {}) {
  closeCollection();
  const have = new Set(progress.cards);
  colEl = document.createElement('div');
  colEl.className = 'lc-col'; colEl.setAttribute('role', 'dialog'); colEl.setAttribute('aria-label', 'Legends collection');
  colEl.innerHTML = `<header class="lc-col__hd"><button type="button" class="lc-back js-lc-back">← Back</button>
      <div><h2>Legends collection <em>${have.size}/${LEGENDS.length}</em></h2></div>
      <div class="lc-col__prog">${progress.nextCard ? `<p class="lc-col__next"><i class="lc-gem" aria-hidden="true"></i>Next legend in ${progress.nextCard.left.toLocaleString('en')} XP</p>` : ''}<div class="lc-col__bar"><i style="width:${(have.size / LEGENDS.length) * 100}%"></i></div></div></header>
    <div class="lc-col__grid">${LEGENDS.map((_, i) => cardHTML(i, { locked: !have.has(i) })).join('')}</div>
    <p class="lc-col__note">Legends are rare gems: one unlocks at each XP milestone, so keep playing. Facts from Wikipedia and the press; photos from Wikimedia Commons where a free one exists; no ratings.</p>`;
  document.body.append(colEl);
  requestAnimationFrame(() => colEl?.classList.add('is-on'));
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart']) colEl.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  colEl.querySelector('.js-lc-back').addEventListener('click', () => { feel.back(); closeCollection(); onClose?.(); });
  colEl.addEventListener('click', (e) => {
    const c = e.target.closest('[data-card]'); if (!c) return;
    feel.tap();
    const i = +c.dataset.card;
    zoomCard(i, !have.has(i));
  });
}
export function closeCollection() { const c = colEl; colEl = null; if (!c) return; c.classList.remove('is-on'); setTimeout(() => c.remove(), 250); }   // the app's 0.25 s fade

function zoomCard(i, locked) {
  const z = document.createElement('div');
  z.className = 'lc-zoom';
  z.innerHTML = `${cardHTML(i, { locked, big: true })}<p class="lc-zoom__hint">Tap anywhere to close</p>`;
  document.body.append(z);
  requestAnimationFrame(() => z.classList.add('is-on'));
  z.addEventListener('click', () => { feel.back(); z.classList.remove('is-on'); setTimeout(() => z.remove(), 250); });
}

/* the unlock reveal: a pack flips over to the new legend, confetti and the crowd. Several queue up. */
const queue = [];
let showing = false;
export function revealCard(i) {
  queue.push(i);
  if (!showing) next();
}
function next() {
  const i = queue.shift();
  if (i == null) { showing = false; return; }
  showing = true;
  const L = LEGENDS[i];
  const r = document.createElement('div');
  r.className = 'lc-reveal';
  r.innerHTML = `<div class="lc-reveal__rays"></div>
    <p class="lc-reveal__k"><i class="lc-gem" aria-hidden="true"></i>Rare legend gem</p>
    <div class="lc-flip"><div class="lc-flip__back"><img src="${CREST}" alt=""/><b>LEGEND</b></div><div class="lc-flip__front">${cardHTML(i, { big: true })}</div></div>
    <p class="lc-reveal__t">${esc(L.name)}</p>
    <div class="lc-reveal__btns"><button type="button" class="lc-btn js-lc-ok">Collect</button><button type="button" class="lc-btn is-ghost js-lc-all">View collection</button></div>`;
  document.body.append(r);
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart']) r.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  requestAnimationFrame(() => r.classList.add('is-on'));
  setTimeout(() => { r.classList.add('is-flip'); feel.win(); feel.roar(); feel.confetti({ n: 180, y: 0.45 }); }, 900);
  const done = (all) => { feel.tap(); r.classList.remove('is-on'); setTimeout(() => { r.remove(); if (all) openCollection(); next(); }, 300); };
  r.querySelector('.js-lc-ok').addEventListener('click', () => done(false));
  r.querySelector('.js-lc-all').addEventListener('click', () => done(true));
}

export { ACHIEVEMENTS };
