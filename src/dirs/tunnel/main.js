// Direction F · "Tunnel": a three.js walk-out through the players' tunnel into a floodlit bowl,
// Ahmed (2026-10-11): the page is just the walk-out now (tunnel, rooms, stadium); no sections below, no loader.
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
import { createChants } from './chants.js';
import { $, $$, splitAll, initMagnetic, initClock, reduced } from '../../ui.js';
import { mountDirNav } from '../../shared/dirnav.js';
import { nextMatch, eventUrl, when, TIERS } from '../../data.js';
import { renderLinks } from './sections.js';
import { priceFor } from './pricing.js';
import { GLOW } from './fx.js';

gsap.registerPlugin(ScrollTrigger);
if (new URLSearchParams(location.search).has('nav')) mountDirNav('tunnel');   // the A–F switcher is for reviews only

const params = new URLSearchParams(location.search);
const still = reduced();
const skip = params.has('skip') || still;
const tParam = params.has('t') ? Math.min(1, Math.max(0, parseFloat(params.get('t')) || 0)) : null;
const lite = params.has('lite') || matchMedia('(max-width: 760px), (pointer: coarse)').matches;
if (still) document.body.classList.add('is-still');

/* ── content ── */
splitAll();
renderLinks();
const next = nextMatch();

/* ── smooth scroll ── */
let lenis = null;
if (!still) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const velocity = () => lenis?.velocity || 0;
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  e.preventDefault();
  const y = id === '#top' ? 0 : id;
  if (lenis) lenis.scrollTo(y, { duration: 1.8, offset: id === '#top' ? 0 : -10 });
  else (id === '#top' ? scrollTo(0, 0) : $(id)?.scrollIntoView());
}));

/* ── globals ── */
initMagnetic();
initClock();

/* ── nav: removed (Ahmed, 2026-10-11) — the page is only the walk-out ── */
const hero = $('#top');

/* ── hero overlays follow the camera's (smoothed) progress ── */
const cue = $('.js-cue'), flash = $('.js-flash');
const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
let lastWalk = 0;
function overlays(p) {
  lastWalk = p;
  if (still) return;
  cue.style.opacity = 1 - sm(0, 0.03, p);
  flash.style.opacity = GLOW ? (Math.exp(-Math.pow((p - 0.645) / 0.03, 2)) * 0.55).toFixed(3) : '0';   // no white flash without glow
  hero.classList.toggle('is-out', p > 0.62);
  chants.update(p, heroPast());
  roomEl.classList.toggle('is-muted', p < 0.085); // the opening title owns the screen until it has faded
}

/* ── fan chants for the walk-out (the club's official recording; see chants.js) ── */
const chants = createChants($('.js-sound'));
window.__chants = chants; // debug handle, like __tunnel
// 0 while the hero is pinned on screen → 1 once you've scrolled a screen past it
const heroPast = () => { const r = hero.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.bottom / innerHeight + 1)); };
addEventListener('scroll', () => chants.update(lastWalk, heroPast()), { passive: true });

/* ── the side rooms (trophies right, club store left): the card follows what you're looking at ── */
const roomEl = $('.js-room'), plaque = $('.js-plaque');
const ROOMS = {
  trophies: { title: 'The trophy room', hint: 'Look around — every case is an Al-Ittihad honour', fine: 'Five trophies modelled from photos · the rest stylised' },
  store: { title: 'The club store', hint: 'Every piece here is in the official store', fine: 'Prices from shop.ittihadclub.sa, 8 Oct 2026' },
  changing: { title: 'The changing room', hint: 'The 2026/27 first team — look along the lockers', fine: 'Squad per ESPN & FotMob, Oct 2026 · stylised shirts' },
};
const sar = (n) => `SAR ${Number.isInteger(n) ? n : n.toFixed(2)}`;
let shownKey = null;
function onRoom({ room, item }) {
  roomEl.classList.toggle('is-in', !!room);
  if (room) {
    roomEl.dataset.room = room;
    $('.js-r-title').textContent = ROOMS[room].title;
    $('.js-r-hint').textContent = ROOMS[room].hint;
    $('.js-r-fine').textContent = ROOMS[room].fine;
  }
  $('.js-r-hint').style.display = item ? 'none' : '';
  if (!item) { plaque.classList.add('is-empty'); return; }
  const key = item.key || `p${item.no}`;
  if (key === shownKey) { plaque.classList.remove('is-empty'); return; }
  shownKey = key;
  const fill = () => {
    const product = item.kind === 'product', player = item.kind === 'player', match = item.kind === 'match';
    if (match) {
      const w = when(item.kickoff);
      $('.js-p-scope').textContent = item.compLabel;
      $('.js-p-name').textContent = `Al Ittihad vs ${item.opp}`;
      $('.js-p-years').innerHTML = '';
      $('.js-p-price').innerHTML = `${w.day} ${w.date} ${w.month} · ${w.time} · From SAR ${item.from}`;
      $('.js-p-note').textContent = item.venue;
      $('.js-p-img').src = item.crest; $('.js-p-shop').href = item.url; $('.js-p-shop span').textContent = 'Book ↗';
      plaque.classList.remove('is-empty');
      return;
    }
    $('.js-p-shop span').textContent = 'Shop now ↗';
    $('.js-p-scope').textContent = player ? `${item.pos} · First team 26/27` : product ? (item.hero ? 'New season · home kit' : item.type) : item.scope;
    $('.js-p-name').textContent = item.name;
    $('.js-p-years').innerHTML = product || player ? '' : item.years.map((y) => `<li>${y}</li>`).join('');
    $('.js-p-price').innerHTML = player ? `No. ${item.no}` : product ? `${sar(item.price)}${item.was ? `<s>${sar(item.was)}</s>` : ''}` : '';
    $('.js-p-note').textContent = [item.note, item.model && item.modelNote].filter(Boolean).join(' · ');
    if (product) { $('.js-p-img').src = item.img; $('.js-p-shop').href = item.url; }
    plaque.classList.remove('is-empty');
  };
  if (plaque.classList.contains('is-empty')) fill();
  else { plaque.classList.add('is-empty'); setTimeout(fill, 220); }
}

/* ── the tifo raised on the far stand (direction B's cards) ── */
function onTifo() {}   // (the tifo name line went with the HUD)
hero.addEventListener('click', (e) => {
  if (e.target.closest('a, button')) return;
  scene?.tifoClick(e.clientX, e.clientY);
});

/* ── seat map: tooltip, map controls, section panel, seat panel (seats.js) ── */
const seatTip = $('.js-seattip'), seatEl = $('.js-seat'), mapCtl = $('.js-mapctl');
// the match you're picking a seat for: the one booked in the matches room, else the next home match
let bookMatch = next;
const setBookMatch = (m) => {
  bookMatch = m;
  // seat selection: the match, its price categories as a legend, and the stadium painted to match
  $('.js-sel-title').textContent = `Al Ittihad vs ${m.opp}`;
  const cats = TIERS[m.slug] || [];
  $('.js-sel-legend').innerHTML = cats.map((c) => `<li><i style="background:${c.color}"></i><span>${c.name}</span><b>SAR ${c.price}</b></li>`).join('');
  $('.js-s-book').href = eventUrl(m.slug);
  const w = when(m.kickoff);
  $('.js-s-match').textContent = `Al Ittihad vs ${m.opp} · ${w.day} ${w.date} ${w.month}`;
  $('.js-sel-date').textContent = `${w.day} ${w.date} ${w.month} · ${w.time} AST · ${m.venue}`;
};
setBookMatch(next);
$('.js-s-back').addEventListener('click', () => scene?.seatBack());
$('.js-z-in').addEventListener('click', () => scene?.seatZoom(0.8));
$('.js-z-out').addEventListener('click', () => scene?.seatZoom(1.25));
$('.js-z-reset').addEventListener('click', () => scene?.seatReset());
// views + modes
const mapNav = $('.js-mapnav');
$$('.js-presets button').forEach((b) => b.addEventListener('click', () => scene?.seatPreset(b.dataset.preset)));
$$('.js-mode button').forEach((b) => b.addEventListener('click', () => scene?.seatMode(b.dataset.mode === 'seats')));
// find your seat: tier → block → row → seat menus from the seat grid
const fT = $('.js-f-tier'), fB = $('.js-f-block'), fR = $('.js-f-row'), fS = $('.js-f-seat');
const opts = (el, n, label = (i) => i) => { const v = el.value; el.innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i + 1}">${label(i + 1)}</option>`).join(''); if (v && +v <= n) el.value = v; };
let layout = null;
function fillFinder() {
  layout ||= scene?.seatLayout();
  if (!layout) return;
  if (!fT.options.length) fT.innerHTML = layout.map((t) => `<option value="${t.code}">${t.name.replace(' tier', '')}</option>`).join('');
  const t = layout.find((x) => x.code === fT.value) || layout[0];
  opts(fB, t.blocks, (i) => `${t.code}${i}`);
  opts(fR, t.rows);
  opts(fS, t.seatsIn(+fB.value - 1));
}
fT.addEventListener('change', fillFinder); fB.addEventListener('change', fillFinder);
$('.js-find').addEventListener('submit', (e) => { e.preventDefault(); scene?.seatFind(fT.value, +fB.value, +fR.value, +fS.value); });
const priceLine = (b) => { const c = b?.centre ? null : priceFor(bookMatch, b); return c ? `${c.name} · SAR ${c.price}` : ''; };
let panelKey = null;
function onSeat({ mode, block, info, hover, x, y, map, seatsMode, lastSeat }) {
  if (seatsMode !== undefined) $$('.js-mode button').forEach((b) => b.classList.toggle('is-on', (b.dataset.mode === 'seats') === seatsMode));
  if (lastSeat !== undefined) $('.js-presets [data-preset=myseat]').disabled = !lastSeat;
  // tooltip: a section at the stadium level, a seat inside a section
  if (hover && x != null) {
    const pl = priceLine(hover);
    seatTip.innerHTML = hover.kind === 'seat'
      ? (hover.taken ? `Row ${hover.row} · Seat ${hover.seat} · <b>Taken</b>` : `<b>Row ${hover.row} · Seat ${hover.seat}</b>${pl ? ` · ${pl}` : ''}`)
      : `<b>${hover.stand}</b> · ${hover.tier} · Block ${hover.block}${pl ? ` · ${pl}` : ''}`;
    const r = hero.querySelector('.th__pin').getBoundingClientRect();
    const tx = Math.min(x - r.left + 16, r.width - seatTip.offsetWidth - 12), ty = Math.max(12, y - r.top - 44);
    seatTip.style.transform = `translate(${tx}px, ${ty}px)`;
  }
  seatTip.classList.toggle('is-on', !!hover);
  // map controls at the stadium and section levels
  const inBlock = mode === 'block' || mode === 'toBlock' || mode === 'toBack';
  const inSeat = mode === 'view' || mode === 'toSeat';
  mapCtl.hidden = !(map && (mode === 'off' || inBlock));
  $('.js-maphint').textContent = inBlock ? 'Pick a seat · drag to look around' : 'Drag to move around · click a section';
  hero.classList.toggle('is-seated', mode !== 'off');
  hero.classList.toggle('is-map', !!map);
  if (map && bookMatch.slug === QUEUE_MATCH && !queue.done) {
    if (!queue.on) { startQueue(); scene?.seatMode(false); $$('.js-mode button[data-mode=seats]').forEach((b) => { b.disabled = true; }); }
  }
  if (!scene?.gameActive) queueEl.hidden = !(map && queue.on);
  $('.js-select').hidden = !(map && mode === 'off' && scene?.seats?.seatsMode !== false);
  mapNav.hidden = !map;
  if (map && !layout) fillFinder();
  // the panel
  const b = info || block;
  const key = b ? `${mode}:${info ? info.key : block.key}` : null;
  if (b && key !== panelKey && (inBlock || inSeat)) {
    panelKey = key;
    $('.js-s-kick').textContent = b.centre ? 'Pitch view' : inSeat ? 'Your view' : 'Section';
    $('.js-s-stand').textContent = b.stand;
    $('.js-s-tier').textContent = b.tier.replace(' tier', '');
    $('.js-s-block').textContent = b.block;
    $('.js-s-row').textContent = info ? info.row : '';
    $('.js-s-seat').textContent = info ? info.seat : '';
    const c = b.centre ? null : priceFor(bookMatch, b);
    $('.js-s-pricewrap').hidden = !c;
    seatEl.classList.toggle('is-centre', !!b.centre);
    if (c) { $('.js-s-swatch').style.background = c.color; $('.js-s-cat').textContent = c.name; $('.js-s-price').textContent = `SAR ${c.price}`; }
    seatEl.classList.toggle('is-seatview', inSeat);
    $('.js-s-back').textContent = inSeat && !b.centre ? 'Back to section' : 'Back to stadium';
    $('.js-s-note').textContent = inSeat
      ? 'Drag to look around · indicative view and price of a stylised stadium, not the official seat plan'
      : 'Pick a seat to see its view · indicative price, not the official seat map';
  }
  if (inBlock || inSeat) { seatEl.hidden = false; requestAnimationFrame(() => seatEl.classList.add('is-in')); }
  else { seatEl.classList.remove('is-in'); panelKey = null; setTimeout(() => { if (!seatEl.classList.contains('is-in')) seatEl.hidden = true; }, 500); }
}

/* ── side rooms: the "Discover" button rides on the door you're passing; inside, the page holds still ── */
const doorBtn = $('.js-door'), visitEl = $('.js-visit');
let doorRoom = null;
function onDoor(d) {
  if (!d) { doorBtn.classList.remove('is-on'); doorRoom = null; return; }
  if (d.room !== doorRoom) { doorRoom = d.room; $('.js-door-label').textContent = d.label; doorBtn.querySelector('.th__doork').textContent = d.kick || 'Enter'; doorBtn.hidden = false; }
  const r = hero.querySelector('.th__pin').getBoundingClientRect();
  const hw = doorBtn.offsetWidth / 2 + 12, tx = Math.min(Math.max(d.x * r.width, hw), r.width - hw);   // kept on screen
  doorBtn.style.transform = `translate(-50%, -50%) translate(${tx}px, ${d.y * r.height}px)`;
  doorBtn.classList.add('is-on');
}
doorBtn.addEventListener('click', () => { if (doorRoom) scene?.enterRoom(doorRoom); });
$('.js-visit-back').addEventListener('click', () => scene?.leaveRoom());
function onVisit({ room, phase }) {
  const inRoom = !!room;
  hero.classList.toggle('is-visiting', inRoom);
  if (inRoom) { lenis?.stop(); doorBtn.classList.remove('is-on'); } else lenis?.start();
  visitEl.hidden = !(inRoom && phase === 'inside');
  $('.js-visit-hint').textContent = room === 'matches' ? 'Use the arrows to browse · scroll to go back' : 'Scroll to look around the room';
  hero.querySelector('.th__pin').style.touchAction = inRoom && room !== 'matches' ? 'none' : 'pan-y';
}

/* ── virtual queue for the first match (Ahmed, 2026-10-12): you're let into the stadium, but seats open
   only when your turn comes; meanwhile, penalties against the mascot. Demo: the queue is simulated
   (about two and a half minutes) and the leaderboard's other fans are samples. ── */
const queueEl = $('.js-queue'), turnEl = $('.js-turn'), gameEl = $('.js-game');
const queue = { on: false, done: false, pos0: 0, pos: 0, t0: 0, T: +params.get('queue') || 150 };   // ?queue=20 for a short demo
const QUEUE_MATCH = next.slug;                       // the first (next) home match
const SAMPLE_FANS = [['Faisal A.', 13], ['Noura K.', 12], ['Omar S.', 11], ['Reem H.', 10], ['Yousef M.', 9]];
function startQueue() {
  if (queue.on || queue.done) return;
  Object.assign(queue, { on: true, pos0: 900 + Math.floor(Math.random() * 500), t0: performance.now() });
  queue.pos = queue.pos0;
  $('.js-q-match').textContent = `Al Ittihad vs ${next.opp}`;
  tickQueue();
}
function tickQueue() {
  if (!queue.on) return;
  const k = Math.min(1, (performance.now() - queue.t0) / 1000 / queue.T);
  queue.pos = Math.max(0, Math.ceil(queue.pos0 * Math.pow(1 - k, 1.25)));
  $('.js-q-pos').textContent = queue.pos.toLocaleString('en');
  $('.js-g-pos').textContent = '#' + queue.pos.toLocaleString('en');
  $('.js-q-bar').style.transform = `scaleX(${k})`;
  const left = Math.max(0, Math.round(queue.T * (1 - k)));
  $('.js-q-eta').textContent = left > 60 ? `About ${Math.ceil(left / 60)} min to go` : `Less than a minute to go`;
  if (queue.pos <= 0) { queue.on = false; queue.done = true; yourTurn(); return; }
  setTimeout(tickQueue, 500);
}
function yourTurn() {
  queueEl.hidden = true;
  turnEl.hidden = false;
  $('.js-turn-later').hidden = !scene?.gameActive;   // mid-game: you can keep playing and choose later
  $$('.js-mode button').forEach((b) => { b.disabled = false; });
}
// keep playing: the turn waits for you, with a button to go in the game's top bar
$('.js-turn-later').addEventListener('click', () => {
  turnEl.hidden = true;
  $('.js-g-q').hidden = true;
  $('.js-g-turn').hidden = false;
});
const chooseSeat = () => {
  queue.chosen = true;
  turnEl.hidden = true;
  $('.js-g-turn').hidden = true;
  const wasPlaying = scene?.gameActive;
  if (wasPlaying) scene.gameStop();
  scene?.seatMode(true);
  setTimeout(() => scene?.seatSelect(), wasPlaying ? 1900 : 0);
};
$('.js-turn-go').addEventListener('click', chooseSeat);
$('.js-g-turn').addEventListener('click', chooseSeat);
const inQueue = () => queue.on && bookMatch.slug === QUEUE_MATCH;
// penalties
$('.js-q-play').addEventListener('click', () => scene?.gameStart());
$('.js-g-back').addEventListener('click', () => scene?.gameStop());
function renderLead(best) {
  const rows = [...SAMPLE_FANS.map(([n, s]) => ({ n, s })), ...(best ? [{ n: 'You', s: best, me: true }] : [])].sort((a, b) => b.s - a.s).slice(0, 6);
  $('.js-g-lead').innerHTML = rows.map((r) => `<li class="${r.me ? 'is-me' : ''}"><span>${r.n}</span><b>${r.s}</b></li>`).join('');
}
let msgT = 0;
function onGame(e) {
  if (e.type === 'start') { gameEl.hidden = false; queueEl.hidden = true; hero.classList.add('is-game'); lenis?.stop(); hero.querySelector('.th__pin').style.touchAction = 'none'; }
  if (e.type === 'stop') {
    gameEl.hidden = true; hero.classList.remove('is-game'); lenis?.start(); hero.querySelector('.th__pin').style.touchAction = 'pan-y';
    if (queue.on) queueEl.hidden = false;
    if (queue.done && !queue.chosen) { turnEl.hidden = false; $('.js-turn-later').hidden = true; }   // your turn is still waiting
  }
  if (e.type === 'start' && queue.done && !queue.chosen) { $('.js-g-q').hidden = true; $('.js-g-turn').hidden = false; }
  // the round's five shots
  const shots = Array.from({ length: 5 }, (_, i) => { const v = e.round[i]; return `<li class="${v === undefined ? '' : v > 0 ? 'is-goal' : 'is-miss'}">${v === undefined ? '' : v > 0 ? v : '×'}</li>`; }).join('');
  $('.js-g-shots').innerHTML = shots;
  $('.js-g-total').textContent = e.round.reduce((a, b) => a + b, 0);
  renderLead(e.best);
  if (e.type === 'result') {
    const m = $('.js-g-msg');
    m.textContent = e.result === 'goal' ? (e.pts === 3 ? 'TOP BINS! +3' : e.pts === 2 ? 'GOAL! +2' : 'GOAL! +1') : e.result === 'saved' ? 'SAVED BY THE TIGER' : 'MISSED';
    m.className = `th__gmsg js-g-msg is-on is-${e.result}`;
    clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('is-on'), 1400);
    if (e.roundOver) setTimeout(() => { m.textContent = `ROUND: ${e.roundTotal} / 15${e.roundTotal >= e.best ? ' · NEW BEST' : ''}`; m.className = 'th__gmsg js-g-msg is-on is-round'; clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('is-on'), 1800); }, 1450);
  }
}

/* ── "Book tickets" in the matches room walks you on down the tunnel and out into the stadium ── */
function onBook(m) {
  if (scene?.visit) { scene.leaveRoom(() => onBook(m)); return; }   // out of the room first, then the walk
  setBookMatch(m);
  scene?.seatPaint((b) => priceFor(m, b)?.color);
  scene?.setMatch(m);   // the visitors' crest on the pitch follows the match you booked
  const y = hero.offsetTop + hero.offsetHeight - innerHeight;
  // then straight into seat selection: a higher view of the bowl, painted by price category
  const arrive = () => scene?.seatSelect();
  if (lenis) lenis.scrollTo(y, { duration: 7, lock: true, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), onComplete: arrive });
  else { scrollTo({ top: y, behavior: 'smooth' }); setTimeout(arrive, 1500); }
}

/* ── the scene ── */
let scene = null;
const canvas = $('.js-gl');
let heroST = null;

async function makeScene(onLoad) {
  try {
    const { createTunnel } = await import('./scene.js');
    onLoad?.(0.5);
    const s = await createTunnel(canvas, { lite, still, onProgress: overlays, onTifo, onRoom, onSeat, onBook, onDoor, onVisit, onGame });
    onLoad?.(1);
    return s;
  } catch (err) {
    console.warn('[tunnel] WebGL unavailable, showing the still', err);
    hero.classList.add('no-gl');
    return null;
  }
}

function wireScene() {
  window.__tunnel = scene; // debug handle
  scene?.seatPaint((b) => priceFor(bookMatch, b)?.color);
  scene?.setMatch(bookMatch);   // the match decides day or night (and the pitch crests)
  if (!scene) {
    // no WebGL: overlays still follow the scroll
    if (!still) ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: (st) => overlays(st.progress) });
    return;
  }
  if (still) {
    scene.lights(true);
    scene.setProgress(1, true);
    scene.renderOnce();
    addEventListener('resize', () => { scene.resize(); scene.renderOnce(); });
    return;
  }
  if (tParam !== null) scene.setProgress(tParam, true);
  else {
    heroST = ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', onUpdate: (st) => scene.setProgress(st.progress) });
    scene.setProgress(heroST.progress, true);
  }
  // only render while the hero is on screen and the tab is visible
  let onScreen = true;
  const sync = () => (onScreen && !document.hidden ? scene.start() : scene.stop());
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { rootMargin: '100px' }).observe(hero);
  document.addEventListener('visibilitychange', sync);
  sync();
}

/* ── boot: v1's preloader plays while the scene builds (Ahmed, 2026-10-14), then lifts off the tunnel
   as the lights flicker on down it ── */
async function boot() {
  const pre = $('.pre');
  canvas.style.opacity = '0';
  if (skip) {
    pre?.remove();
    document.body.classList.remove('is-loading');
    scene = await makeScene();
    if (scene) scene.lights(true);
    wireScene();
    canvas.style.opacity = '';
    lenis?.start();
    ScrollTrigger.refresh();
    return;
  }
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  const year = $('.js-pre-year'), o = { y: 1927 };
  const loader = gsap.timeline()
    .to('.pre__line', { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0)
    .to('.pre__bar', { scaleY: 1, duration: 0.6, stagger: 0.07, ease: 'expo.out' }, 0.5)
    .to(o, { y: 2026, duration: 1.5, ease: 'expo.inOut', onUpdate: () => { year.textContent = Math.round(o.y); } }, 0.2);
  [scene] = await Promise.all([makeScene(), loader.then()]);
  gsap.set('.js-cue', { opacity: 0, y: 16 });
  if (scene) {
    scene.lights(false);
    scene.intro.dolly = 0.6;   // eases in from just inside the end wall (the changing room is behind its door now)
  }
  wireScene();
  const tl = gsap.timeline();
  tl.to('.pre__one, .pre__year, .pre__cap', { y: -40, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'power3.in' }, 0)
    .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' }, 0.35)
    .add(() => { pre.remove(); document.body.classList.remove('is-loading'); lenis?.start(); }, 1.25);
  const t0 = 0.6;   // the tunnel starts coming up under the lifting loader
  tl.to(canvas, { opacity: 1, duration: 0.8, ease: 'power2.out', clearProps: 'opacity' }, t0);
  if (scene) {
    const I = scene.intro;
    tl.to(I, { mouth: 1, duration: 1.6, ease: 'power2.inOut' }, t0 + 0.1)
      .to(I, { on: scene.NL, duration: 2.4, ease: 'none' }, t0 + 0.2)
      .to(I, { led: 1, duration: 0.9, ease: 'steps(6)' }, t0 + 0.6)
      .to(I, { dolly: 0, duration: 3.6, ease: 'power3.out' }, t0);
  }
  tl.to('.js-cue', { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: 'expo.out' }, t0 + 1.0)
    .add(() => ScrollTrigger.refresh());
}
boot();

addEventListener('load', () => ScrollTrigger.refresh());
