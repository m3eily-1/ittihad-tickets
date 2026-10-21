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
import './ui.css';   // the shared look, last (see the file)

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
import { progress, LEVEL_XP } from './progress.js';
import { feel } from './feel.js';
import { LEGENDS } from './legends.js';
import { openCollection, revealCard } from './cards.js';
import { openFriends, shareChallenge, incomingChallenge, GAME_LABEL } from './social.js';
import { openGamesHub } from './games-hub.js';
import { shop } from './shop.js';
import { initRoomUI, roomClick, roomHover, roomVisit } from './room-ui.js';

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
let shopItem = null;
function onRoom({ room, item }) {
  hero.classList.toggle('is-instore', room === 'store');
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
    shopItem = product ? item : null;   // the store's products open the in-app shop, not the club site
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
    if (product) { $('.js-p-img').src = item.img; $('.js-p-shop').href = '#'; $('.js-p-shop span').textContent = 'Choose size · Buy'; }
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
let mapTA = null, pinchTaught = false;
// phones: a one-off chip the first time the map opens — two fingers pinch, the +/− buttons are gone (Ahmed)
function teachPinch() {
  pinchTaught = true;
  const c = document.createElement('p');
  c.className = 'th__pinch'; c.innerHTML = '<i aria-hidden="true"></i><span>Pinch to zoom · drag to turn</span>';
  hero.querySelector('.th__pin').append(c);
  requestAnimationFrame(() => c.classList.add('is-on'));
  setTimeout(() => { c.classList.remove('is-on'); setTimeout(() => c.remove(), 400); }, 3200);
}
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
const onSeatHooks = [], onVisitHooks = [];   // the game layer (end of file) listens in
function onSeat({ mode, block, info, hover, x, y, map, seatsMode, lastSeat }) {
  onSeatHooks.forEach((f) => f({ map }));
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
  $('.js-maphint').textContent = inBlock ? 'Pick a seat · drag to look around · pinch to zoom' : 'Drag to move around · pinch to zoom · click a section';
  hero.classList.toggle('is-seated', mode !== 'off');
  hero.classList.toggle('is-map', !!map);
  if (map && bookMatch.slug === QUEUE_MATCH && !queue.done && !arcade) {   // (not when you came out to play a mini-game)
    if (!queue.on) { startQueue(); scene?.seatMode(false); $$('.js-mode button[data-mode=seats]').forEach((b) => { b.disabled = true; }); }
  }
  // during penalties the map is off, but the queue card stays (Ahmed)
  queueEl.hidden = !queue.on || !(map || scene?.gameActive || !gameEl.hidden);
  $('.js-select').hidden = !(map && mode === 'off' && scene?.seats?.seatsMode !== false);
  // the stadium views only once seats are open to pick (not while you wait in the queue) — Ahmed
  mapNav.hidden = !map || queue.on;
  // the zoom controls too: only once seats are open to pick (Ahmed)
  mapCtl.hidden = !(map && !queue.on && (mode === 'off' || inBlock));
  // pinch to zoom (Ahmed): on the map the page gives every finger to the stadium, so two fingers pinch it
  const pinEl = hero.querySelector('.th__pin'), wantTA = map ? 'none' : null;
  if (wantTA !== mapTA) { mapTA = wantTA; if (map) pinEl.style.touchAction = 'none'; else if (!scene?.visit && !hero.classList.contains('is-game')) pinEl.style.touchAction = tunnelPan(); }
  if (map && !mapCtl.hidden && COARSE && !pinchTaught && !arcade) teachPinch();
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
let visitRoom = null;
function onVisit({ room, phase }) {
  // tell the room UIs when you step in and out
  if (room && phase === 'inside' && visitRoom !== room) { visitRoom = room; roomVisit(room, true); }
  if (!room && visitRoom) { roomVisit(visitRoom, false); visitRoom = null; }
  onVisitHooks.forEach((f) => f({ room, phase }));
  const inRoom = !!room;
  hero.classList.toggle('is-visiting', inRoom);
  if (inRoom) { lenis?.stop(); doorBtn.classList.remove('is-on'); } else lenis?.start();
  visitEl.hidden = !(inRoom && phase === 'inside');
  fxBtn.hidden = room !== 'fantasy'; fxBtn.style.display = room === 'fantasy' ? '' : 'none';   // .btn's display beats [hidden]
  if (room === 'fantasy' && phase === 'inside') fantasyUI.open();
  if (!inRoom) { fantasyUI.close(); exitEl.hidden = true; }
  $('.js-visit-hint').textContent = room === 'matches' ? 'Use the arrows to browse · scroll to go back' : 'Drag to look around · scroll or W A S D to walk';
  hero.querySelector('.th__pin').style.touchAction = inRoom && room !== 'matches' ? 'none' : tunnelPan();
}

/* ── virtual queue for the first match (Ahmed, 2026-10-12): you're let into the stadium, but seats open
   only when your turn comes; meanwhile, penalties against the mascot. Demo: the queue is simulated
   (about two and a half minutes) and the leaderboard's other fans are samples. ── */
// phone controls (Ahmed): the joystick (a swipe only looks), or the classic swipe-to-walk — chosen in Settings
const COARSE = matchMedia('(pointer: coarse)').matches;
let CONTROLS = 'joystick';
try { CONTROLS = localStorage.getItem('itt-controls') || 'joystick'; } catch { /* private mode */ }
const tunnelPan = () => (COARSE && CONTROLS === 'joystick' ? 'none' : 'pan-y');
function applyControls() {
  const pin = hero.querySelector('.th__pin');
  pin.dataset.pan = tunnelPan();
  if (!scene?.visit && !hero.classList.contains('is-game')) pin.style.touchAction = tunnelPan();
  hero.classList.toggle('is-swipe', CONTROLS === 'swipe');
  document.querySelectorAll('.js-ctl').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ctl === CONTROLS)));
}
const queueEl = $('.js-queue'), turnEl = $('.js-turn'), gameEl = $('.js-game');
const queue = { on: false, done: false, pos0: 0, pos: 0, t0: 0, T: +params.get('queue') || 150 };   // ?queue=20 for a short demo
const QUEUE_MATCH = next.slug;                       // the first (next) home match
const SAMPLE_FANS = [['Faisal A.', 13], ['Noura K.', 12], ['Omar S.', 11], ['Reem H.', 10], ['Yousef M.', 9]];
function startQueue() {
  if (queue.on || queue.done) return;
  { let b = 0; try { b = +localStorage.getItem('itt-pen-best') || 0; } catch { /* private */ } renderLead(b); }
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
  mapNav.hidden = !hero.classList.contains('is-map');   // seats are open: the views come back
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
// skip the queue (Ahmed): straight to your turn — the queue is a demo, so this just ends it
$('.js-q-skip').addEventListener('click', () => { if (!queue.on) return; queue.on = false; queue.done = true; queueEl.hidden = true; yourTurn(); });
$('.js-g-turn').addEventListener('click', chooseSeat);
// penalties
$('.js-q-play').addEventListener('click', () => scene?.gameStart());
$('.js-g-back').addEventListener('click', () => scene?.gameStop());
function renderLead(best) {
  const rows = [...SAMPLE_FANS.map(([n, s]) => ({ n, s })), ...(best ? [{ n: 'You', s: best, me: true }] : [])].sort((a, b) => b.s - a.s).slice(0, 6);
  // (the leaderboard now lives inside the queue card — Ahmed)
  $('.js-q-lead').innerHTML = rows.slice(0, 5).map((r) => `<li class="${r.me ? 'is-me' : ''}"><span>${r.n}</span><b>${r.s}</b></li>`).join('');
}
let msgT = 0;
let gameMode = 'penalties';
const PEN_HINT = 'Drag from the ball toward the goal to shoot · curve it to bend · corners score most';
function onGame(e) {
  if (e.type === 'start') { $('.js-g-q').hidden = !queue.on; gameMode = e.mode || 'penalties'; $('.js-g-banner').textContent = e.hint || PEN_HINT; }
  if (e.type === 'ready' && e.hint) $('.js-g-banner').textContent = e.hint;
  // the queue card stays up while you take penalties (Ahmed), so you can watch your place and skip the queue
  // (while playing, the card's own "Play penalties" button is pointless)
  if (e.type === 'start' || e.type === 'stop') $('.js-q-play').style.display = e.type === 'start' ? 'none' : '';
  if (e.type === 'start') { gameEl.hidden = false; if (queue.on) queueEl.hidden = false; hero.classList.add('is-game'); lenis?.stop(); hero.querySelector('.th__pin').style.touchAction = 'none'; }
  if (e.type === 'stop') {
    setArcade(false); flushReveals(); shareBtn?.remove();
    gameEl.hidden = true; hero.classList.remove('is-game'); lenis?.start(); hero.querySelector('.th__pin').style.touchAction = tunnelPan();
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
    m.textContent = e.msg || (e.result === 'goal' ? (e.pts === 3 ? 'TOP BINS! +3' : e.pts === 2 ? 'GOAL! +2' : 'GOAL! +1') : e.result === 'saved' ? 'SAVED BY THE TIGER' : 'MISSED');
    m.className = `th__gmsg js-g-msg is-on is-${e.result}`;
    clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('is-on'), 1400);
    if (e.roundOver) gameOver(e);
    if (e.roundOver) setTimeout(() => { m.textContent = `ROUND: ${e.roundTotal}${e.maxTotal ? ` / ${e.maxTotal}` : ' / 15'}${e.roundTotal >= e.best ? ' · NEW BEST' : ''}`; m.className = 'th__gmsg js-g-msg is-on is-round'; clearTimeout(msgT); msgT = setTimeout(() => m.classList.remove('is-on'), 1800); }, 1450);
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
    const s = await createTunnel(canvas, { lite, still, onProgress: overlays, onTifo, onRoom, onSeat, onBook, onDoor, onVisit, onGame, onExitAsk, onRoomClick: roomClick, onRoomHover: roomHover, onLoad: (v) => loadP(v) });
    initRoomUI(s);
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
let loadP = () => {};
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
    if (!params.has('skip')) openStart();   // (still mode: Reduce Motion on, e.g. many iPhones)
    return;
  }
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
  // the stadium starts loading straight away; the loader's three stages track it (Ahmed: "multiple loaders")
  let target = 0;
  loadP = (v) => { target = Math.max(target, v); };
  const sceneP = makeScene();
  const show = (step) => document.querySelectorAll('.pl').forEach((el) => el.classList.toggle('is-on', el.dataset.step === step));
  const tipEl = $('.js-pre-tip');
  const TIPS = [COARSE ? 'Tip: the left stick walks you down the tunnel' : 'Tip: scroll to walk, drag to look around', 'Tip: every room door opens, try the trophy room', 'Tip: win the legend cards by playing the mini-games',
    ...LEGENDS.filter((l) => l.facts.length).map((l) => `Did you know? ${l.name}: ${l.facts[0]}`)];
  let tipI = Math.floor(Math.random() * TIPS.length);
  const nextTip = () => { tipI = (tipI + 1) % TIPS.length; tipEl.textContent = TIPS[tipI]; tipEl.classList.remove('is-in'); void tipEl.offsetWidth; tipEl.classList.add('is-in'); };
  nextTip(); const tipT = setInterval(nextTip, 3600);
  // 1 · floodlights flare into the crest (the stadium is already loading underneath)
  await new Promise((r) => setTimeout(r, params.has('nointro') ? 0 : 2500));
  // 2 · the season's key art: one status line and a thin bar on the real progress
  show('art');
  let bytes = 0;
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) bytes += e.transferSize || e.encodedBodySize || 0; });
  try { po.observe({ type: 'resource', buffered: true }); } catch { /* old browser */ }
  const shown = { p: 0 }, bar = $('.js-pl-bar'), status = $('.js-pl-status');
  const fill = () => {
    shown.p += (target - shown.p) * (target >= 1 ? 0.25 : 0.12);
    if (target - shown.p < 0.002) shown.p = target;
    const p = shown.p;
    bar.style.transform = `scaleX(${p})`;
    status.textContent = p < 0.35 ? `Downloading the stadium · ${(bytes / 1048576).toFixed(1)} MB` : p < 0.7 ? 'Building the stadium' : p < 0.99 ? 'Warming up the tunnel and the rooms' : 'Ready';
  };
  gsap.ticker.add(fill);
  scene = await sceneP;
  if (scene?.prepare) await scene.prepare(loadP); else loadP(1);
  await new Promise((r) => { const w = () => (shown.p >= 0.999 ? r() : requestAnimationFrame(w)); w(); });
  gsap.ticker.remove(fill); po.disconnect(); clearInterval(tipT);
  gsap.set('.js-cue', { opacity: 0, y: 16 });
  if (scene) {
    scene.lights(false);
    scene.intro.dolly = 0.6;   // eases in from just inside the end wall (the changing room is behind its door now)
  }
  wireScene();
  const tl = gsap.timeline();
  // the loader hands straight over to the menu (Ahmed: "open the menu direct, don't show the stadium") — the
  // tunnel comes up underneath it, so it's ready when you pick something
  openStart();
  tl.to(pre, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 0.15)
    .add(() => { pre.remove(); document.body.classList.remove('is-loading'); }, 0.6);
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
  // four steps (Ahmed): walk, look, rooms, tickets — the welcome rides on the first, the goodbye on the last
  const touch = matchMedia('(pointer: coarse)').matches, joy = touch && CONTROLS === 'joystick';
  const walk = !touch ? 'Scroll, or swipe up and down with two fingers on your touchpad, to walk towards the pitch.'
    : joy ? 'Push the joystick at the bottom left to walk towards the pitch. Prefer swiping? Switch in Settings (⚙).'
    : 'Swipe up to walk towards the pitch, down to walk back. Prefer a joystick? Switch in Settings (⚙).';
  const look = !touch ? 'Drag with the mouse, or swipe sideways with two fingers. Hold Shift to look up and down.'
    : joy ? 'Drag anywhere else on the screen with your other thumb to look around.'
    : 'Drag sideways with one finger to look around.';
  const rooms = `When you pass a door, ${touch ? 'tap' : 'click'} Enter: the locker room, store, trophy room, SPL Fantasy, hall of fame and gym. Walk back to the door to leave.`;
  const book = `At the end of the tunnel, pick a match and ${touch ? 'tap' : 'click'} Book tickets. Enjoy the Tigers!`;
  return [
    ['Walk', "Hey, Tiger fan! Let's walk", walk],
    ['Look', 'Look around', look],
    ['Rooms', 'Visit the rooms', rooms],
    ['Tickets', 'Book your seat', book],
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
  try { sessionStorage.setItem('itt-guide-seen', '1'); } catch { /* private mode */ }
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
// (no ? button: the guide is only the welcome at the start — Ahmed)
// the wheel and drags shouldn't reach the walk while the guide is up
for (const ev of ['wheel', 'pointerdown', 'touchmove']) guideEl.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
export function maybeShowGuide() {
  // once per visit: closing the app (or the tab) and opening it again shows it again (Ahmed)
  let seen = false; try { seen = sessionStorage.getItem('itt-guide-seen') === '1'; } catch { /* private */ }
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
    // the knob follows the thumb; what drives the walk is eased (sx, sy) so it starts and stops gently (Ahmed: slow and smooth)
    const set = (x, y) => { st.x = x; st.y = y; knob.style.transform = `translate(${x * st.r}px, ${-y * st.r}px)`; };
    let sx = 0, sy = 0;
    const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.35);   // fine control near the centre
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
      const busy = CONTROLS !== 'joystick' || !guideEl.hidden || !$('.js-start').hidden || !!scene?.matches?.active || hero.classList.contains('is-map') || !!document.querySelector('.fx.is-on') || !$('.js-game')?.hidden || document.body.classList.contains('is-loading');
      joy.classList.toggle('is-off', busy);
      // the settings only matter for walking: gone once the tunnel ends (Ahmed)
      const setBtn = $('.js-settings'), tunnelOver = !!scene?.matches?.active || hero.classList.contains('is-map') || !$('.js-game')?.hidden;
      if (setBtn && COARSE) { setBtn.hidden = tunnelOver; if (tunnelOver) { $('.js-settings-panel').hidden = true; setBtn.setAttribute('aria-expanded', 'false'); } }
      if (busy && st.id === null && (st.x || st.y)) set(0, 0);
      const k = 1 - Math.exp(-dt * 4.5);
      sx += ((busy ? 0 : curve(st.x)) - sx) * k; sy += ((busy ? 0 : curve(st.y)) - sy) * k;
      if (Math.abs(sx) < 0.002) sx = 0; if (Math.abs(sy) < 0.002) sy = 0;
      scene?.setJoystick(sx * 0.75, sy * 0.75);   // in a room
      // the tunnel: the stick only walks you along it (the page scroll), slowly; looking is your other thumb
      // a brisk walk at full push (0.1 felt too slow, 0.32 too fast)
      if (scene && sy && scene.canWalk) { const v = sy * innerHeight * 0.22 * dt; if (lenis) lenis.scrollTo(lenis.scroll + v, { immediate: true }); else scrollBy(0, v); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

/* ── phone match row (Ahmed, 2026-10-20: "the tickets are so small on mobile"): when the walk holds at the
   match cards, phones get the same cards as real HTML — big type, a swipeable row, the filter as chips — over
   the tunnel; the joystick hides there and a button walks you on past them. ── */
import { dateBits, priceBits, venueOf, compName } from './matchroom.js';
{
  const row = $('.js-mrow');
  if (row && matchMedia('(pointer: coarse)').matches) {
    let built = false, filter = 'all', shown = false;
    const HOME_CREST = '/teams/al-ittihad.png';   // (a plain path string, so the Pages build prefixes it like the others)
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const card = (m, i) => {
      if (m.kind === 'season') return `<article class="th__mc is-season"><div class="th__holo" aria-hidden="true"></div>
        <div class="th__mshead"><span>AL-ITTIHAD · MEMBERSHIP</span><b>${esc(m.season)}</b></div>
        <div class="th__msrow"><i class="th__chip" aria-hidden="true"></i><img src="${HOME_CREST}" alt=""/></div>
        <h4><span>TIGERS</span> SEASON PASS</h4>
        <p class="th__msnum">1927 •••• •••• 2627</p>
        <small>All home matches · ${m.comps.map(esc).join(' · ')}</small>
        <div class="th__mcp">From SAR ${m.from}</div>
        <button class="btn btn--sm th__msbtn" type="button" data-i="${i}">Get the season pass →</button></article>`;
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
      $('.js-mtabs').innerHTML = keys.map((k) => `<button type="button" data-k="${k}" class="${k === filter ? 'is-on' : ''}">${comps[k].mark ? `<img src="${comps[k].mark}" alt=""/>` : ''}${esc(comps[k].label)}</button>`).join('');
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
    const holo = (x) => row.style.setProperty('--hx', x.toFixed(3));
    $('.js-mlist').addEventListener('scroll', (e) => holo(e.target.scrollLeft / 300), { passive: true });
    row.addEventListener('touchmove', (e) => holo(e.touches[0].clientX / innerWidth * 2), { passive: true });
    const loop = () => {
      const on = !!scene?.matches?.active && !scene?.visit;
      if (on && !built) { built = true; render(); }
      if (on !== shown) { shown = on; if (on) { row.hidden = false; requestAnimationFrame(() => row.classList.add('is-on')); } else { row.classList.remove('is-on'); setTimeout(() => { if (!shown) row.hidden = true; }, 350); } }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

/* ── settings (Ahmed: switch between the joystick and the previous swipe controls) ── */
{
  const btn = $('.js-settings'), panel = $('.js-settings-panel');
  if (btn && panel) {
    if (!COARSE) btn.hidden = true;   // only phones have a choice to make
    const open = (on) => { panel.hidden = !on; btn.setAttribute('aria-expanded', String(on)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(panel.hidden); });
    $('.js-settings-close').addEventListener('click', () => open(false));
    panel.querySelectorAll('.js-ctl').forEach((b) => b.addEventListener('click', () => {
      CONTROLS = b.dataset.ctl;
      try { localStorage.setItem('itt-controls', CONTROLS); } catch { /* private */ }
      applyControls();
    }));
    for (const ev of ['pointerdown', 'touchstart', 'touchmove', 'wheel']) panel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    addEventListener('pointerdown', (e) => { if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) open(false); });
  }
  applyControls();
}

/* ── penalty aim: the arrow follows your drag; the banner shows while you line up a shot ── */
{
  const svg = $('.js-g-arrow'), path = $('.js-g-path'), pow = $('.js-g-pow'), banner = $('.js-g-banner'), headPath = svg.querySelector('marker path');
  let pts = null;
  const draw = () => {
    if (!pts || pts.length < 2) { path.setAttribute('d', ''); pow.textContent = ''; return; }
    const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1], mid = pts[Math.floor(pts.length / 2)];
    const len = Math.hypot(x1 - x0, y1 - y0), p = Math.min(1, len / (innerHeight * 0.45));
    // a smooth curve through the start, the middle of the drag and the end (the bend you drew)
    path.setAttribute('d', `M${x0},${y0} Q${2 * mid[0] - (x0 + x1) / 2},${2 * mid[1] - (y0 + y1) / 2} ${x1},${y1}`);
    path.style.strokeWidth = `${4 + p * 6}px`;
    path.style.stroke = p > 0.85 ? '#ff6a3d' : '#ffea00';
    headPath.setAttribute('fill', path.style.stroke);   // the arrowhead matches the line
    pow.setAttribute('x', x1 + 14); pow.setAttribute('y', y1 - 10);
    pow.textContent = `Power ${Math.round(p * 100)}%`;
  };
  const r = () => svg.getBoundingClientRect();
  addEventListener('pointerdown', (e) => { if (!scene?.gameActive || e.target.closest('button, a, aside')) return; const b = r(); pts = [[e.clientX - b.left, e.clientY - b.top]]; draw(); }, true);
  addEventListener('pointermove', (e) => { if (!pts) return; const b = r(); pts.push([e.clientX - b.left, e.clientY - b.top]); draw(); }, true);
  const end = () => { if (!pts) return; pts = null; setTimeout(draw, 120); };
  addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
  // the banner: up while you line up, away while the ball flies and the result shows
  // the how-to shows once, before the first kick of the visit, then stays away (Ahmed)
  // per game: each mode's own how-to (e.hint from penalty.js), once per visit
  let taughtSet = []; try { taughtSet = JSON.parse(sessionStorage.getItem('itt-pen-tip2')) || []; } catch { /* private */ }
  let taught = false;
  const tick = () => {
    taught = taughtSet.includes(gameMode);
    if (scene?.gameActive && !taught && $('.js-g-msg').classList.contains('is-on')) { taughtSet.push(gameMode); taught = true; try { sessionStorage.setItem('itt-pen-tip2', JSON.stringify(taughtSet)); } catch { /* private */ } }
    if (scene?.gameActive) banner.classList.toggle('is-off', taught);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ── seat selection panel folds to its title and opens again (Ahmed) ── */
{
  const sel = $('.js-select'), fold = $('.js-sel-fold');
  fold?.addEventListener('click', (e) => {
    e.stopPropagation();
    const shut = !sel.classList.contains('is-folded');
    sel.classList.toggle('is-folded', shut); sel.classList.remove('is-min');
    fold.setAttribute('aria-expanded', String(!shut));
    fold.setAttribute('aria-label', shut ? 'Expand seat selection' : 'Collapse seat selection');
  });
  // a tap on the folded title opens it too
  sel?.addEventListener('click', (e) => { if (sel.classList.contains('is-folded') && e.target !== fold && !fold.contains(e.target)) fold.click(); });
}

let playGame = () => {}, reopenMenu = () => {};   // set by the menu block below
let arcade = false;   // out on the pitch for a mini-game: no ticket queue, legend reveals wait for the end
// …and no ticket UI at all while you're there (Ahmed: "the tickets overlap with the games") — hero.is-arcade in CSS
const setArcade = (v) => { arcade = v; hero.classList.toggle('is-arcade', v); };
/* ── main menu (Ahmed, 2026-10-21): after the loader, a game-style home screen laid out like EA FC Mobile's —
   profile and stats along the top, the rooms down the left rail, a hero carousel in the middle, the next matches
   and two big tiles (tour, penalties) on the right, and a bottom bar. Every choice fast-travels the walk there. ── */
const MS_ICON = {
  changing: '<path d="M5 3h14v18H5z M12 3v18 M8.5 10v2 M15.5 10v2"/>',
  trophies: '<path d="M7 4h10v4a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 13v4 M8 21h8 M9 17h6v4H9z"/>',
  gym: '<path d="M3 9v6 M6 7v10 M18 7v10 M21 9v6 M6 12h12"/>',
  fame: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  matches: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z M14 7v12"/>',
  pass: '<path d="M3 6h18v12H3z M3 10h18 M6 15h5"/>',
  fantasy: '<path d="M4 4h16v16H4z M4 12h16 M12 4v16 M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/>',
  penalties: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z"/>',
  store: '<path d="M4 8h16l-1.5 12h-13z M8 8a4 4 0 0 1 8 0"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11"/>',
  cards: '<path d="M7 3h10l2 2v14l-7 3-7-3V5z M12 8l1.4 2.9 3.1.4-2.3 2.1.6 3.1L12 15l-2.8 1.5.6-3.1-2.3-2.1 3.1-.4z"/>',
  friends: '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14a6 6 0 0 1 3.5 6"/>',
  games: '<path d="M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4z M7 10v4 M5 12h4 M16 11h.01 M18 13h.01"/>',
};
const msEsc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const msIcon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${MS_ICON[k]}</svg>`;
function buildMenu() {
  const host = $('.js-ms'); if (!host || host.dataset.built) return;
  host.dataset.built = '1';
  const BG = ['claw', 'lights', 'mosaic'];
  host.classList.add(`is-bg-${BG.includes(params.get('msbg')) ? params.get('msbg') : 'claw'}`);
  const HOME = '/teams/al-ittihad.png';
  const cards = scene?.matches?.cards || [];
  const next = cards.filter((m) => m.kind !== 'season' && m.opp).slice(0, 4);
  const ch = challenge;
  const hero = [
    { go: 'fantasy', kick: 'SPL Fantasy · 26/27', title: 'Build your XI', sub: 'The whole Saudi Pro League · SAR 100m to spend', img: '/img/squad/2.png' },
    { go: 'season', kick: 'Al-Ittihad · Membership', title: 'Season pass', sub: 'Every home match · from SAR 230', img: '/img/season-poster.png' },
    { go: 'tour', kick: 'Stadium tour', title: 'Walk out like a Tiger', sub: "The players' tunnel, the rooms and the pitch", img: '/img/aerial.jpg' },
  ];
  const rail = [['cards', 'cards', 'Legends'], ['room:changing', 'changing', 'Locker room'], ['room:trophies', 'trophies', 'Trophies'], ['room:gym', 'gym', 'Gym'], ['room:fame', 'fame', 'Hall of fame']];
  const nav = [['tickets', 'matches', 'Matches'], ['season', 'pass', 'Season pass'], ['fantasy', 'fantasy', 'Fantasy'], ['friends', 'friends', 'Friends'], ['room:store', 'store', 'Store']];
  const matchSlide = (m) => {
    const d = dateBits(m), p = priceBits(m);
    return `<div class="ms__mt"><p class="ms__mtk">${msEsc(compName(m))}${m.round ? ` · ${msEsc(m.round)}` : ''}</p>
      <div class="ms__mtrow"><img src="${HOME}" alt=""/><div class="ms__mtvs"><b>${msEsc(d.big)}</b><span>${msEsc(d.time)}</span></div>${m.crest ? `<img src="${msEsc(m.crest)}" alt=""/>` : '<i></i>'}</div>
      <p class="ms__mtn">Al Ittihad <em>vs</em> ${msEsc(m.oppShort || m.opp)}</p>
      <p class="ms__mtp">${p.from != null ? `From SAR ${p.from}` : 'Not on sale yet'}</p></div>`;
  };
  host.innerHTML = `
    <header class="ms__top">
      <button type="button" class="ms__me" data-go="cards"><img src="${HOME}" alt=""/><div><b class="js-ms-name">${msEsc(progress.name || 'Tigers fan')}</b><span><i class="js-ms-lv">${progress.level}</i><u class="ms__xp"><s class="js-ms-xp" style="width:${(progress.levelXp / LEVEL_XP) * 100}%"></s></u><em class="js-ms-xpt">${progress.levelXp}/${LEVEL_XP} XP</em></span></div></button>
      <p class="ms__cards"><b class="js-ms-cards">${progress.cards.length}/${LEGENDS.length}</b> legends</p>
      <div class="ms__tr"><button type="button" class="ms__ic ms__cart" data-go="cart" aria-label="Cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg><b class="js-ms-cartn">${shop.count}</b></button><button type="button" class="ms__ic js-ms-sound" aria-label="Crowd chants">${msIcon('sound')}</button></div>
    </header>
    <nav class="ms__rail">${rail.map(([g, ic, l]) => `<button type="button" class="ms__rb" data-go="${g}">${msIcon(ic)}<span>${l}</span></button>`).join('')}</nav>
    ${ch ? `<button type="button" class="ms__ch" data-go="game:${ch.game}"><b>${msEsc(ch.name)} challenged you</b><span>${msEsc(GAME_LABEL[ch.game])} · ${ch.score} to beat</span><em>Beat it →</em></button>` : ''}
    <section class="ms__hero js-ms-hero">
      ${hero.map((h, i) => `<div class="ms__slide${i ? '' : ' is-on'}" data-i="${i}"><span class="ms__bg" style="background-image:url('${h.img}')"></span>
        <p class="ms__k">${msEsc(h.kick)}</p><h2>${msEsc(h.title)}</h2><p class="ms__s">${msEsc(h.sub)}</p>
        <button type="button" class="ms__go" data-go="${h.go}">Go now</button></div>`).join('')}
      <div class="ms__dots">${hero.map((_, i) => `<i class="${i ? '' : 'is-on'}"></i>`).join('')}</div>
    </section>
    <aside class="ms__side">
      <button type="button" class="ms__card js-ms-card" data-go="tickets"><p class="ms__ct">Next matches</p>
        ${next.map((m, i) => `<div class="ms__cs${i ? '' : ' is-on'}">${matchSlide(m)}</div>`).join('') || '<div class="ms__cs is-on"><div class="ms__mt"><p class="ms__mtn">Tickets</p></div></div>'}
        <div class="ms__dots">${next.map((_, i) => `<i class="${i ? '' : 'is-on'}"></i>`).join('')}</div></button>
      <div class="ms__tiles">
        <button type="button" class="ms__tile is-tour" data-go="tour"><b>Tour</b><span>Walk the tunnel</span></button>
        <button type="button" class="ms__tile is-play" data-go="games"><b>Play</b><span>8 mini-games</span></button>
      </div>
    </aside>
    <nav class="ms__bar">${nav.map(([g, ic, l], i) => `<button type="button" class="${i === nav.length - 1 ? 'is-hi' : ''}" data-go="${g}">${msIcon(ic)}<span>${l}</span></button>`).join('')}</nav>`;
  // the two carousels turn on their own; a click on a dot isn't needed — the card itself books
  const spin = (sel, every) => {
    const slides = [...host.querySelectorAll(`${sel} > .ms__slide, ${sel} > .ms__cs`)], dots = [...host.querySelectorAll(`${sel} .ms__dots i`)];
    if (slides.length < 2) return;
    let i = 0;
    setInterval(() => { if (host.closest('[hidden]')) return; slides[i].classList.remove('is-on'); dots[i]?.classList.remove('is-on'); i = (i + 1) % slides.length; slides[i].classList.add('is-on'); dots[i]?.classList.add('is-on'); }, every);
  };
  spin('.js-ms-hero', 5200); spin('.js-ms-card', 3600);
  const snd = $('.js-ms-sound'), real = $('.js-sound');
  const syncSnd = () => snd.classList.toggle('is-off', real?.getAttribute('aria-pressed') === 'false');
  snd.addEventListener('click', (e) => { e.stopPropagation(); real?.click(); setTimeout(syncSnd, 50); }); syncSnd();
}
function openStart() {
  flushReveals();
  const el = $('.js-start');
  if (!el || params.has('nostart')) { maybeShowGuide(); return; }
  buildMenu();
  lenis?.stop();
  el.hidden = false; requestAnimationFrame(() => el.classList.add('is-on'));
}
{
  const el = $('.js-start');
  for (const ev of ['wheel', 'pointerdown', 'touchmove']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const close = () => { el.classList.remove('is-on'); setTimeout(() => { el.hidden = true; }, 350); lenis?.start(); };
  // scroll to a walk progress (0 → 1 over the hero), then carry on
  const travel = (prog, then) => {
    const st = heroST, y = st ? st.start + prog * (st.end - st.start) : prog * (document.documentElement.scrollHeight - innerHeight);
    const dur = Math.min(3, 0.8 + Math.abs(y - scrollY) / innerHeight * 0.12);
    if (lenis) lenis.scrollTo(y, { duration: dur, easing: (t) => 1 - Math.pow(1 - t, 3), onComplete: () => then?.() });
    else { scrollTo(0, y); setTimeout(() => then?.(), 300); }
  };
  const wait = (ok, then, tries = 120) => (ok() ? then() : tries > 0 ? setTimeout(() => wait(ok, then, tries - 1), 50) : then());
  const toRoom = (room) => {
    const z = scene.progressForZ(scene.doorZ(room) ?? 60);
    travel(z, () => wait(() => Math.abs(scene.progress - z) < 0.002, () => scene.enterRoomNow(room)));
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]'); if (!b || !scene) return;
    const go = b.dataset.go;
    feel.tap();
    // screens over the menu: the menu stays underneath
    if (go === 'cards') { openCollection(); return; }
    if (go === 'cart') { shop.openCart(); return; }
    if (go === 'friends') { openFriends({ onPlay: (g) => { close(); playGame(g); } }); return; }
    if (go === 'games') { openGamesHub({ onPlay: (g) => { close(); playGame(g); } }); return; }
    close();
    if (go.startsWith('game:')) { playGame(go.slice(5)); return; }
    if (go === 'tour') { maybeShowGuide(); return; }
    if (go === 'tickets' || go === 'season') { travel(0.45); return; }   // the hold in front of the match cards (the pass is the first card)
    if (go === 'fantasy') { toRoom('fantasy'); return; }
    if (go.startsWith('room:')) { toRoom(go.slice(5)); return; }
    if (go === 'penalties') playGame('penalties');
  });
  // the mini-games: the 3D ones out on the pitch, the 2D ones over the menu (back returns to it)
  const toPitch = (then) => { setArcade(true); travelPitch(then); };
  const travelPitch = (then) => travel(1, () => wait(() => scene.progress > 0.995, () => setTimeout(then, 400)));
  playGame = (g) => {
    if (!scene) return;
    if (['penalties', 'freekick', 'crossbar', 'keeper'].includes(g)) { toPitch(() => scene.gameStart(g)); return; }
    // the tifo: stop at the view that looks up at the far stand (scene KEYS, 0.76), paint, and raise it there
    if (g === 'tifo') { setArcade(true); travel(0.76, () => tifoBuilder().open({ hidden: scene.tifo?.hidden, onRaise: (c) => { scene.tifo?.setCustom(c); setTimeout(() => { setArcade(false); flushReveals(); }, 1500); }, onClose: () => { setArcade(false); flushReveals(); openStart(); } })); return; }
    const m = (scene.matches?.cards || []).find((x) => x.kind !== 'season' && x.opp);
    miniGames().open(g, { match: m, compLabel: m ? compName(m) : '', onClose: () => openStart() });
  };
  reopenMenu = () => openStart();
}

/* ── game layer (Ahmed, 2026-10-21): XP, levels, legend cards, friends' challenges, and the feel that goes with them ── */
const challenge = incomingChallenge();
// the 2D mini-games and the tifo builder load when first played
let mgInst = null, tbInst = null;
function miniGames() { return { open: async (g, o) => { if (!mgInst) mgInst = (await import('./minigames.js')).mountMiniGames(); mgInst.open(g, o); } }; }
function tifoBuilder() { return { open: async (o) => { if (!tbInst) tbInst = (await import('./tifo-builder.js')).mountTifoBuilder(); tbInst.open(o); } }; }
// cards won mid-game wait until you leave the pitch
let pendingCards = [];
function flushReveals() { const p = pendingCards; pendingCards = []; p.forEach((i, k) => setTimeout(() => revealCard(i), 400 + k * 50)); }
function refreshProfile() {
  const q = (s) => document.querySelector(s);
  if (q('.js-ms-lv')) { q('.js-ms-lv').textContent = progress.level; q('.js-ms-xp').style.width = `${(progress.levelXp / LEVEL_XP) * 100}%`; q('.js-ms-xpt').textContent = `${progress.levelXp}/${LEVEL_XP} XP`; q('.js-ms-cards').textContent = `${progress.cards.length}/${LEGENDS.length}`; }
  if (homeLv) homeLv.textContent = `Lv ${progress.level}`;
}
progress.on((e) => {
  if (e.type === 'xp') feel.xp(e.amount);
  if (e.type === 'level') setTimeout(() => feel.level(e.level), 350);
  // (and never in the middle of booking: while the seat map is open it waits for the menu — just a small note now)
  if (e.type === 'card') { const booking = hero.classList.contains('is-map') && !arcade; if (booking) feel.pop('LEGEND UNLOCKED', { y: innerHeight * 0.16 }); if (scene?.gameActive || arcade || booking) pendingCards.push(e.index); else setTimeout(() => revealCard(e.index), 700); }
  refreshProfile();
});
// sound follows the chants switch
{
  const b = $('.js-sound');
  const sync = () => { feel.muted = b?.getAttribute('aria-pressed') === 'false'; };
  if (b) new MutationObserver(sync).observe(b, { attributes: true, attributeFilter: ['aria-pressed'] });
  sync();
}
// every button ticks (the screens with their own sounds handle theirs)
document.addEventListener('click', (e) => { const b = e.target.closest('.th button, .js-mrow button'); if (b && !b.closest('.js-start')) feel.tap(); }, true);
// achievements along the walk
onSeatHooks.push(({ map }) => { if (map) progress.achieve('tunnel'); });
{
  let rooms = []; try { rooms = JSON.parse(localStorage.getItem('itt-rooms-v1')) || []; } catch { /* private */ }
  onVisitHooks.push(({ room, phase }) => {
    if (!room || phase !== 'inside' || room === 'matches') return;
    if (!rooms.includes(room)) { rooms.push(room); try { localStorage.setItem('itt-rooms-v1', JSON.stringify(rooms)); } catch { /* private */ } progress.award(20, 'New room'); }
    if (room === 'fame') progress.achieve('fame');
    if (rooms.length >= 3) progress.achieve('rooms-3');
  });
}
addEventListener('fantasy:change', (e) => { if ((e.detail?.squad || []).filter(Boolean).length >= 11) progress.achieve('fantasy-xi'); });
// after a round: challenge a friend with your score
let shareBtn = null;
function gameOver(e) {
  const mode = e.mode || 'penalties';
  if (mode === 'penalties') progress.setBest('penalties', e.roundTotal);
  shareBtn?.remove();
  shareBtn = document.createElement('button');
  shareBtn.type = 'button'; shareBtn.className = 'btn btn--y th__gshare';
  const beat = challenge && challenge.game === mode ? (e.roundTotal > challenge.score ? ` · you beat ${challenge.name}!` : ` · ${challenge.name} has ${challenge.score}`) : '';
  shareBtn.innerHTML = `<span>Challenge a friend · ${e.roundTotal}${beat}</span>`;
  shareBtn.addEventListener('click', () => shareChallenge(mode, e.roundTotal));
  gameEl.append(shareBtn);
  if (challenge && challenge.game === mode && e.roundTotal > challenge.score) { feel.confetti(); feel.roar(); }
}
// the menu button, top centre: back to the main menu from anywhere in the walk
let homeLv = null;
{
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'th__home js-home'; b.setAttribute('aria-label', 'Main menu');
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16 M4 12h16 M4 17h16"/></svg><span>Menu</span><i>Lv 1</i>';
  hero.querySelector('.th__pin').append(b);
  homeLv = b.querySelector('i'); refreshProfile();
  b.addEventListener('click', () => { if (scene?.visit) scene.leaveRoom(); reopenMenu(); });
  const tick = () => {
    const busy = !$('.js-start').hidden || !guideEl.hidden || !gameEl.hidden || document.body.classList.contains('is-loading') || !!document.querySelector('.fx.is-on') || (COARSE && !!scene?.matches?.active);
    b.classList.toggle('is-off', busy);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
window.__progress = progress; // debug handle

/* ── the club store (Ahmed, 2026-10-21: "the full journey"): product sheet → cart → checkout → order (shop.js) ── */
$('.js-p-shop').addEventListener('click', (e) => { if (!shopItem) return; e.preventDefault(); shop.openProduct(shopItem); });
{
  // a cart button in the store (and anywhere once something's in the cart), plus "All products"
  const bar = document.createElement('div');
  bar.className = 'th__shopbar';
  bar.innerHTML = '<button type="button" class="js-shop-all">All products</button><button type="button" class="th__cartb js-shop-cart" aria-label="Cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg><b class="js-shop-n">0</b></button>';
  hero.querySelector('.th__pin').append(bar);
  bar.querySelector('.js-shop-all').addEventListener('click', () => shop.openCatalog());
  bar.querySelector('.js-shop-cart').addEventListener('click', () => shop.openCart());
  shop.onCount((n) => { bar.querySelector('.js-shop-n').textContent = n; hero.classList.toggle('has-cart', n > 0); document.querySelectorAll('.js-ms-cartn').forEach((el) => { el.textContent = n; }); });
}
window.__shop = shop; // debug handle
