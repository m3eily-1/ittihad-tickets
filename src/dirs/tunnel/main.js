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
import { mountFantasyUI } from './fantasy-ui.js';

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
  changing: { title: 'The locker room', hint: 'The 2026/27 first team — look along the lockers', fine: 'Squad per the club’s own list, Oct 2026' },
  gym: { title: 'The gym', hint: 'Where the Tigers train', fine: '' },
  fantasy: { title: 'SPL Fantasy', hint: 'Open the team builder to pick your 15', fine: 'Squads from spl.com.sa · ratings and prices are demo values' },
  fame: { title: 'Hall of fame', hint: 'Look at a legend to read their story', fine: 'Sourced from Wikipedia and the press · photos to come' },
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
    if (item.kind === 'fantasy') {
      $('.js-p-scope').textContent = `${item.pos} · ${item.club}${item.no ? ` · #${item.no}` : ''}`;
      $('.js-p-name').textContent = `${item.first} ${item.last}`.trim();
      $('.js-p-years').innerHTML = `<li>Rating ${item.rating} (demo)</li><li>${item.nat}</li>`;
      $('.js-p-price').innerHTML = `SAR ${item.price.toFixed(1)}m`; $('.js-p-note').textContent = '';
      $('.js-p-img').src = item.photo || '/img/crest.png'; $('.js-p-shop').style.display = 'none';
      plaque.classList.remove('is-empty');
      return;
    }
    if (item.kind === 'legend') {
      $('.js-p-scope').textContent = `${item.pos} · ${item.years}`;
      $('.js-p-name').textContent = item.ar ? `${item.name} · ${item.ar}` : item.name;
      $('.js-p-years').innerHTML = item.facts.map((f) => `<li>${f}</li>`).join('');
      $('.js-p-price').innerHTML = ''; $('.js-p-note').textContent = '';
      $('.js-p-img').src = '/img/crest.png'; $('.js-p-shop').style.display = 'none';
      plaque.classList.remove('is-empty');
      return;
    }
    $('.js-p-shop').style.display = '';
    if (item.kind === 'season') {
      $('.js-p-scope').textContent = `Season pass · ${item.season}`;
      $('.js-p-name').textContent = item.title;
      $('.js-p-years').innerHTML = item.comps.map((c) => `<li>${c}</li>`).join('');
      $('.js-p-price').innerHTML = `From SAR ${item.from}`;
      $('.js-p-note').textContent = item.venues.join(' · ');
      $('.js-p-img').src = '/teams/al-ittihad.png'; $('.js-p-shop').href = item.url; $('.js-p-shop span').textContent = 'Get the pass ↗';
      plaque.classList.remove('is-empty');
      return;
    }
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
// SPL Fantasy (Ahmed, 2026-10-19): the team builder opens over its room
const fantasyUI = mountFantasyUI();
const fxBtn = document.createElement('button'); fxBtn.type = 'button'; fxBtn.className = 'btn btn--y btn--sm'; fxBtn.textContent = 'Team builder'; fxBtn.hidden = true;
fxBtn.addEventListener('click', () => fantasyUI.open());
visitEl.prepend(fxBtn);
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
/* at a room's door: "Back to the tunnel?" — Yes walks you out, Stay closes it (it asks again only after you've
   walked away from the door and come back) */
const exitEl = $('.js-exit');
const ROOM_NAMES = { trophies: 'the trophy room', store: 'the club store', changing: 'the locker room', gym: 'the gym', fame: 'the hall of fame', fantasy: 'SPL Fantasy' };
function onExitAsk(room) {
  if (!room) { exitEl.hidden = true; return; }
  $('.js-exit-room').textContent = `You're at the door of ${ROOM_NAMES[room] || 'the room'}.`;
  exitEl.hidden = false;
}
$('.js-exit-yes').addEventListener('click', () => { exitEl.hidden = true; scene?.leaveRoom(); });
$('.js-exit-no').addEventListener('click', () => { exitEl.hidden = true; });
function onVisit({ room, phase }) {
  const inRoom = !!room;
  hero.classList.toggle('is-visiting', inRoom);
  if (inRoom) { lenis?.stop(); doorBtn.classList.remove('is-on'); } else lenis?.start();
  visitEl.hidden = !(inRoom && phase === 'inside');
  fxBtn.hidden = room !== 'fantasy'; fxBtn.style.display = room === 'fantasy' ? '' : 'none';   // .btn's display beats [hidden]
  if (room === 'fantasy' && phase === 'inside') fantasyUI.open();
  if (!inRoom) { fantasyUI.close(); exitEl.hidden = true; }
  $('.js-visit-hint').textContent = room === 'matches' ? 'Use the arrows to browse · scroll to go back' : 'Drag to look around · scroll or W A S D to walk';
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
    const s = await createTunnel(canvas, { lite, still, onProgress: overlays, onTifo, onRoom, onSeat, onBook, onDoor, onVisit, onGame, onExitAsk });
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
    if (!params.has('skip')) maybeShowGuide();   // (still mode: Reduce Motion on, e.g. many iPhones)
    return;
  }
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  const year = $('.js-pre-year'), o = { y: 1927 };
  const loader = gsap.timeline()
    .to('.pre__line', { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0)
    .to('.pre__bar', { scaleY: 1, duration: 0.6, stagger: 0.07, ease: 'expo.out' }, 0.5)
    .to(o, { y: 2026, duration: 1.5, ease: 'expo.inOut', onUpdate: () => { year.textContent = Math.round(o.y); } }, 0.2);
  // the guide comes up as soon as the loader has drawn, while the tunnel is still loading behind it — on a phone
  // connection that was 15 s+ of waiting before (Ahmed: "I don't see it on mobile")
  loader.then(() => maybeShowGuide());
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
    .add(() => { pre.remove(); document.body.classList.remove('is-loading'); if (guideEl.hidden) lenis?.start(); }, 1.25);
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

/* ── mobile (Ahmed, 2026-10-15): landscape only; the info card starts folded, and any open panel folds away
   as soon as you move (scroll, drag, walk). Tap a folded panel to open it. ── */
{
  const mobile = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
  // Android can lock landscape once in full screen; iPhones can't, so they only get the prompt
  const lockBtn = $('.js-rotlock');
  // full screen by default on phones (Ahmed): browsers only grant it inside a tap, so the very first tap anywhere
  // asks for it and then locks landscape (Android Chrome). iPhone Safari has no full screen for pages — there it
  // comes from opening the site from the home screen (manifest + apple-mobile-web-app-capable).
  const goFull = async () => {
    const d = document.documentElement;
    if (document.fullscreenElement || !d.requestFullscreen) return;
    try { await d.requestFullscreen({ navigationUI: 'hide' }); await screen.orientation?.lock?.('landscape'); } catch { /* refused: carry on in the page */ }
  };
  if (mobile && document.documentElement.requestFullscreen) {
    const first = () => { removeEventListener('click', first, true); removeEventListener('touchend', first, true); goFull(); };
    addEventListener('click', first, true);
    addEventListener('touchend', first, true);
  }
  if (screen.orientation?.lock && document.documentElement.requestFullscreen) {
    lockBtn.hidden = false;
    lockBtn.addEventListener('click', async () => { try { await document.documentElement.requestFullscreen(); await screen.orientation.lock('landscape'); } catch { /* not allowed here */ } });
  }
  if (mobile) {
    const panels = ['.js-room', '.js-select', '.js-queue', '.js-seat'].map((q) => $(q)).filter(Boolean);
    $('.js-room').classList.add('is-min');
    const fold = () => panels.forEach((p) => { if (!p.hidden) p.classList.add('is-min'); });
    panels.forEach((p) => p.addEventListener('click', (e) => { if (p.classList.contains('is-min')) { e.preventDefault(); e.stopPropagation(); p.classList.remove('is-min'); } }, true));
    let lastY = scrollY;
    addEventListener('scroll', () => { if (Math.abs(scrollY - lastY) > 24) { lastY = scrollY; fold(); } }, { passive: true });
    let t0 = null;
    addEventListener('touchstart', (e) => { t0 = e.target.closest?.('.js-room, .js-select, .js-queue, .js-seat') ? null : [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    addEventListener('touchmove', (e) => { if (t0 && Math.hypot(e.touches[0].clientX - t0[0], e.touches[0].clientY - t0[1]) > 24) { t0 = null; fold(); } }, { passive: true });
    addEventListener('keydown', (e) => { if (/^(w|a|s|d|arrow)/i.test(e.key)) fold(); });
  }
}

/* ── navigation guide (Ahmed, 2026-10-20): the tiger mascot talks you through getting around, one step per
   speech bubble, typed out as it speaks. Once after the loader; the ? button in the corner brings it back.
   (A mascot, not a player: no real person is quoted.) Worded for touch or mouse/touchpad. ── */
import { createMascotView } from './mascot-guide.js';
const guideEl = $('.js-guide');
document.body.append(guideEl);   // above the loader (which sits over the 3D view), so it can show while the tunnel loads
let tiger = null, gStep = 0, typing = 0;
function guideSteps() {
  const touch = matchMedia('(pointer: coarse)').matches;
  const hello = ['Welcome', 'Hey, Tiger fan!', "I'm the club's tiger. Give me a minute and I'll show you how to get around the tunnel."];
  const end = ["You're ready", "Let's walk out!", 'Tap the ? button any time and I\'ll go through it again. Enjoy the Tigers!'];
  return touch ? [hello,
    ['Walk', 'Walk the tunnel', 'Push the joystick at the bottom left up to walk towards the pitch, down to walk back. Swiping works too.'],
    ['Look', 'Look around', 'Drag anywhere else on the screen with your other thumb to look around, just like in a game.'],
    ['Rooms', 'Visit a room', 'When you pass a door, tap Enter. Try the locker room, the store, the trophy room, the gym, the hall of fame and SPL Fantasy.'],
    ['In a room', 'Explore inside', 'Joystick to walk and step sideways, drag to look. Walk back to the door, or tap Back to tunnel, to leave.'],
    ['Tickets', 'Book your seat', 'Just before the pitch, swipe through the match cards and tap Book tickets.'],
    end,
  ] : [hello,
    ['Walk', 'Walk the tunnel', 'Scroll, or swipe up and down with two fingers on your touchpad, to walk towards the pitch.'],
    ['Look', 'Look around', 'Drag with the mouse, or swipe sideways with two fingers. Hold Shift to look up and down.'],
    ['Rooms', 'Visit a room', 'When you pass a door, click Enter. Try the locker room, the store, the trophy room, the gym, the hall of fame and SPL Fantasy.'],
    ['In a room', 'Explore inside', 'Drag to look, scroll or use W A S D to walk. Walk back to the door, or press Esc, when you want to leave.'],
    ['Tickets', 'Book your seat', 'Just before the pitch, use the arrows on the match cards and click Book tickets.'],
    end,
  ];
}
function showStep(i) {
  const steps = guideSteps();
  gStep = Math.max(0, Math.min(steps.length - 1, i));
  const [k, title, text] = steps[gStep];
  $('.js-guide-step').textContent = `${gStep + 1} of ${steps.length} · ${k}`;
  $('.js-guide-title').textContent = title;
  $('.js-guide-dots').innerHTML = steps.map((_, j) => `<i class="${j <= gStep ? 'is-on' : ''}"></i>`).join('');
  $('.js-guide-back').style.visibility = gStep ? 'visible' : 'hidden';
  $('.js-guide-ok').textContent = gStep === steps.length - 1 ? "Let's go" : 'Next';
  $('.js-guide-skip').style.visibility = gStep === steps.length - 1 ? 'hidden' : 'visible';
  // type the line out while the tiger talks
  const el = $('.js-guide-text'), my = ++typing;
  el.classList.remove('is-done'); el.textContent = '';
  if (gStep === 0) tiger?.wave();
  tiger?.talk(true);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let n = reduce ? text.length : 0;
  const tick = () => {
    if (my !== typing) return;
    n = Math.min(text.length, n + 2);
    el.textContent = text.slice(0, n);
    if (n < text.length) setTimeout(tick, 22);
    else { el.classList.add('is-done'); tiger?.talk(false); }
  };
  tick();
}
function openGuide() {
  guideEl.hidden = false; requestAnimationFrame(() => guideEl.classList.add('is-on'));
  lenis?.stop();
  try { tiger = tiger || createMascotView($('.js-tiger')); tiger.start(); } catch { tiger = null; }
  showStep(0);
  $('.js-guide-ok').focus({ preventScroll: true });
}
function closeGuide() {
  typing++; tiger?.talk(false); setTimeout(() => tiger?.stop(), 400);
  guideEl.classList.remove('is-on'); setTimeout(() => { guideEl.hidden = true; }, 350);
  if (!scene?.visit && !document.body.classList.contains('is-loading')) lenis?.start();
  try { localStorage.setItem('itt-guide-seen', '1'); } catch { /* private mode */ }
}
function nextStep() {
  const el = $('.js-guide-text');
  if (!el.classList.contains('is-done')) { typing++; el.textContent = guideSteps()[gStep][2]; el.classList.add('is-done'); tiger?.talk(false); return; }   // first click finishes the line
  if (gStep >= guideSteps().length - 1) closeGuide(); else showStep(gStep + 1);
}
$('.js-guide-ok').addEventListener('click', nextStep);
$('.js-guide-back').addEventListener('click', () => showStep(gStep - 1));
$('.js-guide-skip').addEventListener('click', closeGuide);
addEventListener('keydown', (e) => {
  if (guideEl.hidden) return;
  if (e.key === 'Escape') { e.stopPropagation(); closeGuide(); }
  else if (e.key === 'Enter' || e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); nextStep(); }
  else if (e.key === 'ArrowLeft') { e.stopPropagation(); showStep(gStep - 1); }
}, true);
$('.js-help').addEventListener('click', openGuide);
// the wheel and drags shouldn't reach the walk while the guide is up
for (const ev of ['wheel', 'pointerdown', 'touchmove']) guideEl.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
export function maybeShowGuide() {
  let seen = false; try { seen = localStorage.getItem('itt-guide-seen') === '1'; } catch { /* private */ }
  if (!seen || params.has('guide')) openGuide();
}

/* ── phone joystick (Ahmed, 2026-10-20: "joystick controllers like PUBG"): a stick under the left thumb.
   In the tunnel up/down walks you along it (it drives the page scroll, like swiping) and left/right turns your
   head; in a room it walks and strafes. Looking is still a drag anywhere else on the screen. Hidden while a
   panel takes over (seat map, penalty game, match cards, the team builder, the guide). ── */
{
  const joy = $('.js-joy'), knob = $('.js-joyk');
  if (joy && matchMedia('(pointer: coarse)').matches) {
    const st = { id: null, cx: 0, cy: 0, x: 0, y: 0, r: 1 };
    const set = (x, y) => { st.x = x; st.y = y; knob.style.transform = `translate(${x * st.r}px, ${-y * st.r}px)`; scene?.setJoystick(x, y); };
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = joy.getBoundingClientRect(); st.id = e.pointerId; st.cx = r.left + r.width / 2; st.cy = r.top + r.height / 2; st.r = r.width * 0.36;
      joy.setPointerCapture(e.pointerId); joy.classList.add('is-on'); move(e);
    });
    const move = (e) => {
      if (e.pointerId !== st.id) return;
      e.stopPropagation();
      let dx = (e.clientX - st.cx) / st.r, dy = -(e.clientY - st.cy) / st.r;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      const dead = (v) => (Math.abs(v) < 0.12 ? 0 : v);   // a little dead zone so resting the thumb doesn't drift
      set(dead(dx), dead(dy));
    };
    const end = (e) => { if (e.pointerId !== st.id) return; st.id = null; joy.classList.remove('is-on'); set(0, 0); };
    joy.addEventListener('pointermove', move);
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      // hide it when something else has the screen
      // (and at the match cards: Ahmed — no joystick once you reach the tickets)
      const busy = !guideEl.hidden || !!scene?.matches?.active || hero.classList.contains('is-map') || !!document.querySelector('.fx.is-on') || !$('.js-game')?.hidden || document.body.classList.contains('is-loading');
      joy.classList.toggle('is-off', busy);
      if (busy && st.id === null && (st.x || st.y)) set(0, 0);
      if (scene && !busy && (st.x || st.y) && scene.canWalk) {
        // walking the tunnel is the page scroll
        if (st.y) { const v = st.y * innerHeight * 1.1 * dt; if (lenis) lenis.scrollTo(lenis.scroll + v, { immediate: true }); else scrollBy(0, v); }
        if (st.x) scene.turn(-st.x * 1.2 * dt);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

/* ── phone match row (Ahmed, 2026-10-20: "the tickets are so small on mobile"): when the walk holds at the
   match cards, phones get the same cards as real HTML — big type, a swipeable row, the filter as chips — over
   the tunnel; the joystick (or a swipe up) walks on past them. ── */
import { dateBits, priceBits, venueOf, compName } from './matchroom.js';
{
  const row = $('.js-mrow');
  if (row && matchMedia('(pointer: coarse)').matches) {
    let built = false, filter = 'all', shown = false;
    const HOME_CREST = '/teams/al-ittihad.png';   // (a plain path string, so the Pages build prefixes it like the others)
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const card = (m, i) => {
      if (m.kind === 'season') return `<article class="th__mc is-season"><small>Season pass · ${esc(m.season)}</small><h4>${esc(m.title)}</h4>
        <ul>${m.comps.map((c) => `<li>${esc(c)}</li>`).join('')}</ul><div class="th__mcp">From SAR ${m.from}</div>
        <button class="btn btn--y btn--sm" type="button" data-i="${i}">Get the season pass →</button></article>`;
      const d = dateBits(m), p = priceBits(m);
      return `<article class="th__mc"><small>${esc(compName(m))}${m.round ? ` · ${esc(m.round)}` : ''}</small><h4>${esc(d.long)}</h4>
        <div class="th__mcrow"><div><img src="${HOME_CREST}" alt=""/><span>AL ITTIHAD</span></div>
        <div class="th__mcko">${esc(d.time)}<em>Kick-off</em></div>
        <div>${m.crest ? `<img src="${esc(m.crest)}" alt=""/>` : ''}<span>${esc(m.oppShort)}</span></div></div>
        <div class="th__mcv">${esc(venueOf(m))}</div>
        <div class="th__mcp">${p.from != null ? `From SAR ${p.from}` : 'Not on sale yet'}</div>
        <button class="btn btn--y btn--sm" type="button" data-i="${i}" ${m.onSale ? '' : 'disabled'}>${m.onSale ? 'Book tickets →' : 'Coming soon'}</button></article>`;
    };
    const render = () => {
      const all = scene.matches.cards, comps = scene.matches.comps;
      const keys = ['all', ...['rsl', 'afc', 'kings'].filter((k) => all.some((m) => m.comp === k))];
      $('.js-mtabs').innerHTML = keys.map((k) => `<button type="button" data-k="${k}" class="${k === filter ? 'is-on' : ''}">${esc(comps[k].label)}</button>`).join('');
      $('.js-mlist').innerHTML = all.map((m, i) => (filter === 'all' || m.comp === filter ? card(m, i) : '')).join('');
      $('.js-mlist').scrollLeft = 0;
    };
    // with the joystick gone at the cards, this walks you on past them
    $('.js-mon').addEventListener('click', () => { const y = 0.585 * (document.documentElement.scrollHeight - innerHeight); if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else scrollTo(0, y); });
    row.addEventListener('click', (e) => {
      const t = e.target.closest('[data-k]'); if (t) { filter = t.dataset.k; render(); return; }
      const b = e.target.closest('[data-i]'); if (!b) return;
      const m = scene.matches.cards[+b.dataset.i];
      if (m.kind === 'season') window.open(m.url, '_blank', 'noopener');
      else if (m.onSale) onBook(m);
    });
    for (const ev of ['touchstart', 'touchmove', 'pointerdown', 'wheel']) row.addEventListener(ev, (e) => { if (e.target.closest('.js-mlist, .js-mtabs')) e.stopPropagation(); }, { passive: true });
    const loop = () => {
      const on = !!scene?.matches?.active && !scene?.visit;
      if (on && !built) { built = true; render(); }
      if (on !== shown) { shown = on; if (on) { row.hidden = false; requestAnimationFrame(() => row.classList.add('is-on')); } else { row.classList.remove('is-on'); setTimeout(() => { if (!shown) row.hidden = true; }, 350); } }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
