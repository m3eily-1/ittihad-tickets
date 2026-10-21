// SPL Cup — a knockout tournament mode after FC Mobile's "The World's Game" (Ahmed, 2026-10-21), with the 18
// Saudi Pro League clubs instead of countries and this tunnel's look (black / yellow, Anton + Cairo, 4px corners).
//   select team → bracket (16 clubs, seeded) → per tie: both line-ups → VS → the match (simulated, cup-sim.js)
//   → if level after 120', the shoot-out (played by you in 3D when the caller passes playShootout, else simulated)
//   → result (score, scorers, stats) → players of the match → next round, or eliminated / champions.
// The squads are real (spl.com.sa, fantasy-data.js); the ratings, and so every result, are demo values, and the
// screens say so. Tournament progress lives in this browser (localStorage 'itt-cup-v1').
//
// Exports
//   openCup({ onClose, playShootout, onCart })      the tournament (resumes a saved bracket)
//   openLineups({ home, away, onClose, onCart, label })   match day: VS, then "Possible line-ups (demo)"
//   openMatchday(fixture, { onClose, onCart })      the same for a fixtures.js entry (Al-Ittihad v fixture.opp)
//   openVs({ home, away, label }) → Promise          the VS intro; resolves when it finishes (or is tapped)
//   shootoutHUD(event)                               the 3D shoot-out's scoreboard bar: pass it every game event
//
// playShootout({ home, away, you, onResult }) — the caller plays the shoot-out in the stadium:
//   home / away = { slug, code, name, logo, kickers: [names], keeper: name },  you = 'home' | 'away'
//   e.g. (o) => toPitch(() => scene.gameStart('shootout', { ...o, onEvent: shootoutHUD,
//                                                           onEnd: (r) => { scene.gameStop(); o.onResult(r); } }))
//   onResult({ homePens, awayPens, winner: 'home'|'away', home: [1|0…], away: [1|0…], abandoned? })
import './cup.css';
import { CLUBS } from './fantasy-data.js';
import { fcCardHTML } from './fc-card.js';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { P } from './fantasy-ui.js';
import { bestXI, takers, simMatch, simShootout, hash } from './cup-sim.js';

const KEY = 'itt-cup-v1';
const ROUND = ['Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
const ROUNDS = ['Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];
const XP_ROUND = [60, 90, 140, 250];
// the standard 16-team draw, top to bottom on the left, then the right: 1 and 2 can only meet in the final
const SEED_PAIRS = [[1, 16], [8, 9], [5, 12], [4, 13], [3, 14], [6, 11], [7, 10], [2, 15]];
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = (s) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* private mode */ } };
const bySlug = (s) => CLUBS.find((c) => c.slug === s) || null;
const nm = (p) => (p ? p.last || p.first : '');
const full = (p) => (p ? [p.first, p.last].filter(Boolean).join(' ') : '');
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M3 11l9-7 9 7 M5 10v10h14V10"/>',
  cart: '<path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>',
  ball: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z"/>',
  share: '<path d="M12 3v12 M7 8l5-5 5 5 M5 13v7h14v-7"/>',
};
const svg = (k) => `<svg class="cu-i" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const TROPHY = `<svg class="cu-trophy" viewBox="0 0 64 80" aria-hidden="true"><defs><linearGradient id="cu-tg" x1="0" x2="1"><stop offset="0" stop-color="#8c6a10"/><stop offset=".45" stop-color="#fff36b"/><stop offset=".7" stop-color="#ffea00"/><stop offset="1" stop-color="#a8850c"/></linearGradient></defs>
  <path fill="none" stroke="url(#cu-tg)" stroke-width="4" d="M15 13H7v5c0 7 5 12 11 13 M49 13h8v5c0 7-5 12-11 13"/>
  <path fill="url(#cu-tg)" d="M14 5h36v15c0 12-7 21-18 23-11-2-18-11-18-23z"/><path fill="rgba(255,255,255,.35)" d="M20 9h5v12c0 7 2 12 5 16-6-2-10-8-10-16z"/>
  <path fill="url(#cu-tg)" d="M28 42h8v12h-8z M20 54h24l3 8H17z"/><path fill="#141414" stroke="url(#cu-tg)" stroke-width="2" d="M14 63h36v10H14z"/></svg>`;

/* ── strength, stars, crests ── */
const AVG = new Map(CLUBS.map((c) => [c.slug, bestXI(c)?.avg ?? 70]));
const LO = Math.min(...AVG.values()), HI = Math.max(...AVG.values());
// stars from the best-XI demo average: the weakest club 3, the strongest 5, in halves
export const starsOf = (c) => (c?.slug && AVG.has(c.slug) ? Math.round((3 + ((AVG.get(c.slug) - LO) / (HI - LO || 1)) * 2) * 2) / 2 : 0);
const ovr = (c) => (c?.slug && AVG.has(c.slug) ? Math.round(AVG.get(c.slug)) : null);
const stars = (v) => (v ? `<span class="cu-stars" style="--v:${v}" role="img" aria-label="${v} of 5 stars">★★★★★</span>` : '');
const crest = (t, cls = '') => (t?.logo ? `<img class="${cls}" src="${esc(t.logo)}" alt=""/>` : `<span class="${cls} cu-mono">${esc((t?.code || t?.name || '?').slice(0, 3))}</span>`);
const RANKED = [...CLUBS].sort((a, b) => AVG.get(b.slug) - AVG.get(a.slug));

/* ── a team for match day: a CLUBS entry when it's an SPL club, else whatever the fixture tells us ── */
const norm = (s) => String(s || '').toLowerCase().replace(/\b(sc|fc|club)\b/g, '').replace(/[^a-z]/g, '');
function resolveTeam(x) {
  if (!x) return null;
  if (typeof x === 'string') return bySlug(x) || CLUBS.find((c) => norm(c.name) === norm(x) || norm(c.slug) === norm(x)) || { name: x, code: x.slice(0, 3).toUpperCase(), logo: null, ext: true };
  if (x.slug && bySlug(x.slug)) return bySlug(x.slug);
  const name = x.name || x.opp || x.oppShort;
  const hit = CLUBS.find((c) => norm(c.name) === norm(name) || (x.oppCode && c.code === x.oppCode));
  return hit || { name, code: x.code || x.oppCode || String(name || '').slice(0, 3).toUpperCase(), logo: x.logo || x.crest || null, ext: true };
}

/* ── shared mounting: a fixed overlay that keeps every pointer / wheel / key event away from the 3D scene ── */
function mount(cls) {
  const el = document.createElement('div');
  el.className = `cu ${cls}`;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('data-lenis-prevent', '');
  el.tabIndex = -1;
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'click', 'contextmenu', 'keydown', 'keyup']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  // the wheel: scroll our own lists, never the page under the overlay
  el.addEventListener('wheel', (e) => {
    e.stopPropagation();
    for (let n = e.target; n && n !== el; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return;
      if (n.scrollWidth > n.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return;
    }
    e.preventDefault();
  }, { passive: false });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !el.contains(b) || b.disabled) return;
    const a = b.dataset.act, fn = el._acts?.[a];
    if (!fn) return;
    if (!['close', 'back'].includes(a)) feel.tap(); else feel.back();
    fn(b, e);
  });
  document.body.append(el);
  requestAnimationFrame(() => { el.classList.add('is-on'); el.focus({ preventScroll: true }); });
  return el;
}
// keys: while an overlay is up, nothing reaches the scene; Escape goes back
addEventListener('keydown', guardKeys, true);
addEventListener('keyup', guardKeys, true);
function guardKeys(e) {
  const top = [...document.querySelectorAll('.cu')].filter((x) => !x.hidden && x.isConnected).pop();
  if (!top) return;
  e.stopPropagation();
  // no keyboard scrolling of the page underneath (Space / Enter still press a focused button)
  const onBtn = e.target?.closest?.('button');
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key) || (e.key === ' ' && !onBtn)) e.preventDefault();
  if (e.type === 'keydown' && e.key === 'Escape') top._esc?.();
}
const header = ({ title, kicker = 'SPL Cup', onCart }) => `<header class="cu-hd">
    <button type="button" class="cu-ic" data-act="back" aria-label="Back">${svg('back')}</button>
    <div class="cu-hd__t"><h2>${esc(title)}</h2></div>
    <div class="cu-hd__r"><button type="button" class="cu-ib" data-act="close" aria-label="Home">${svg('home')}</button></div>
  </header>`;
function screen(el, { title, kicker, body, cls = '', acts = {}, onCart, back }) {
  el.innerHTML = `${header({ title, kicker, onCart })}<main class="cu-body ${cls}">${body}</main>`;
  el._acts = { cart: () => onCart?.(), ...acts, back: back || acts.back || acts.close };
  el._esc = el._acts.back;
}
function toast(el, text) {
  const t = document.createElement('p'); t.className = 'cu-toast'; t.textContent = text; el.append(t);
  setTimeout(() => t.remove(), 2200);
}
async function share(el, text) {
  const url = location.origin + location.pathname;
  try { if (navigator.share) { await navigator.share({ title: 'SPL Cup', text, url }); return; } } catch { return; /* cancelled */ }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast(el, 'Copied. Paste it to a friend'); } catch { toast(el, 'Sharing isn\'t available in this browser'); }
}
function modal(el, html, acts = {}) {
  const m = document.createElement('div');
  m.className = 'cu-modal';
  m.innerHTML = `<div class="cu-modal__card" role="dialog">${html}</div>`;
  el.append(m);
  const prev = { acts: el._acts, esc: el._esc };
  const close = () => { m.remove(); el._acts = prev.acts; el._esc = prev.esc; };
  el._acts = { ...prev.acts, ...Object.fromEntries(Object.entries(acts).map(([k, f]) => [k, (b, e) => { close(); f(b, e); }])), 'm-close': close, back: close };
  el._esc = close;
  m.addEventListener('click', (e) => { if (e.target === m) close(); });
  return close;
}

/* ── the VS intro ── */
export function openVs({ home, away, label = 'SPL Cup' } = {}) {
  const H = resolveTeam(home), A = resolveTeam(away);
  return new Promise((resolve) => {
    const el = mount('cu--vs');
    const side = (t, k, tag) => {
      const x = t && !t.ext ? bestXI(t) : null;
      return `<div class="cu-vs__p is-${k}">
        <div class="cu-vs__in">${crest(t, 'cu-vs__crest')}<h3>${esc(t?.name || 'TBC')}</h3>${stars(starsOf(t))}
        <p>${x ? `Rating <b>${ovr(t)}</b> · ${x.formation}` : esc(t?.ext ? 'Not in this demo\'s squads' : '')}</p><em>${tag}</em></div></div>`;
    };
    el.innerHTML = `<div class="cu-vs"><p class="cu-vs__k">${esc(label)}</p>${side(H, 'l', 'Home')}<b class="cu-vs__x">VS</b>${side(A, 'r', 'Away')}<p class="cu-vs__skip">Tap to skip</p></div>`;
    let done = false;
    const end = () => { if (done) return; done = true; el.classList.add('is-out'); setTimeout(() => { el.remove(); resolve(); }, 260); };
    el._acts = {}; el._esc = end;
    el.addEventListener('click', end);
    feel.roar();
    setTimeout(end, RM() ? 1200 : 2900);
  });
}

/* ── a line-up: the team card on the left, the XI on a dark pitch on the right ── */
const ROW_Y = { FWD: 14, MID: 38.5, DEF: 63, GK: 86 };
function pitchHTML(t) {
  if (!t) return '';
  const lines = { GK: [], DEF: [], MID: [], FWD: [] };
  t.xi.forEach((x) => lines[x.line].push(x));
  const cells = [];
  for (const [k, L] of Object.entries(lines)) L.forEach((x, i) => {
    const spread = L.length >= 5 ? 84 : L.length === 4 ? 76 : L.length === 3 ? 62 : 40;
    const left = 50 + (L.length > 1 ? (i / (L.length - 1) - 0.5) * spread : 0);
    const lift = x.slot === 'CDM' ? 'is-down' : ['LW', 'RW', 'LWB', 'RWB', 'LB', 'RB'].includes(x.slot) ? 'is-up' : '';
    cells.push(`<div class="cu-pos ${lift}" style="left:${left.toFixed(1)}%;top:${ROW_Y[k]}%">${fcCardHTML(x.p, { size: 's', slot: x.slot })}</div>`);
  });
  return `<div class="cu-pitch"><div class="cu-pitch__m"><i class="m-half"></i><i class="m-circ"></i><i class="m-box is-t"></i><i class="m-box is-b"></i><i class="m-six is-t"></i><i class="m-six is-b"></i></div>${cells.join('')}<p class="cu-pitch__note">Demo ratings</p></div>`;
}
function deal(el) {
  if (RM()) return;
  const pitch = el.querySelector('.cu-pitch'); if (!pitch) return;
  const pr = pitch.getBoundingClientRect(), dx0 = pr.left + pr.width / 2, dy0 = pr.bottom + 20;
  // dealt from below the pitch, goalkeeper first, then up the lines
  [...pitch.querySelectorAll('.cu-pos')].forEach((c, i) => {
    const r = c.getBoundingClientRect();
    const dx = dx0 - (r.left + r.width / 2), dy = dy0 - (r.top + r.height / 2);
    c.animate([{ transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${(i % 2 ? 1 : -1) * 18}deg) scale(0.4)`, opacity: 0 }, { transform: 'translate(-50%, -50%)', opacity: 1 }],
      { duration: 420, delay: 80 + i * 55, easing: 'cubic-bezier(.2,.8,.25,1.1)', fill: 'backwards' });
  });
}
function teamPanel(team, { tag, note, tabs = '', buttons = '' }) {
  const x = team && !team.ext ? bestXI(team) : null;
  return `<aside class="cu-team">
    <p class="cu-team__tag">${esc(tag)}</p>
    ${crest(team, 'cu-team__crest')}
    <h3>${esc(team?.name || '')}</h3>${stars(starsOf(team))}
    ${x ? `<dl class="cu-facts"><div><dt>Rating</dt><dd>${ovr(team)}</dd></div><div><dt>Formation</dt><dd>${x.formation}</dd></div></dl>` : ''}
    ${tabs}
    ${note ? `<p class="cu-note">${esc(note)}</p>` : ''}
    <div class="cu-team__go">${buttons}</div>
  </aside>`;
}
// one screen per team; `teams` = [{ club, tag }], ends with `finalLabel` → onFinal
function lineupsView(el, { teams, idx = 0, kicker, title = 'Line-ups', note, finalLabel, onFinal, onCart, onBack, onHome = onBack }) {
  const T = teams[idx], club = T.club, x = club && !club.ext ? bestXI(club) : null;
  const tabs = teams.length > 1 ? `<div class="cu-seg">${teams.map((t, i) => `<button type="button" class="${i === idx ? 'is-on' : ''}" data-act="tab" data-i="${i}">${crest(t.club)}<span>${esc(t.club.code || t.club.name)}</span></button>`).join('')}</div>` : '';
  const last = idx >= teams.length - 1;
  const buttons = last ? `<button type="button" class="cu-btn" data-act="final">${esc(finalLabel)}</button>`
    : `<button type="button" class="cu-btn" data-act="next">${esc(teams[idx + 1].club.code || 'Next')} line-up</button>`;
  const extra = teams.extraNote && last ? teams.extraNote : '';
  screen(el, {
    title, kicker, cls: 'cu-lu', onCart,
    body: `${teamPanel(club, { tag: T.tag, note: [note, extra].filter(Boolean).join(' '), tabs, buttons })}
      <section class="cu-lu__pitch">${x ? pitchHTML(x) : `<div class="cu-pitch is-empty"><p>${esc(club?.name || 'This team')}'s line-up isn't available.</p></div>`}</section>`,
    acts: {
      close: onHome, back: onBack,
      tab: (b) => lineupsView(el, { teams, idx: +b.dataset.i, kicker, title, note, finalLabel, onFinal, onCart, onBack, onHome }),
      next: () => lineupsView(el, { teams, idx: idx + 1, kicker, title, note, finalLabel, onFinal, onCart, onBack, onHome }),
      final: () => onFinal?.(),
    },
  });
  deal(el);
}

/* ── match day (the matches room's fixtures): VS, then both possible line-ups ── */
export async function openLineups({ home = 'al-ittihad', away, onClose, onCart, label = 'Match day' } = {}) {
  const H = resolveTeam(home), A = resolveTeam(away);
  await openVs({ home: H, away: A, label });
  const el = mount('cu--lu');
  const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 250); onClose?.(); };
  const teams = [{ club: H, tag: 'Home' }];
  if (A && !A.ext) teams.push({ club: A, tag: 'Away' });
  else if (A) teams.extraNote = `${A.name}'s line-up isn't available: they're not one of the Saudi Pro League squads in this demo.`;
  lineupsView(el, { teams, kicker: label, title: 'Possible line-ups (demo)', note: 'Best XI by demo rating. Not the official team sheet.', finalLabel: 'Close', onFinal: close, onCart, onBack: close });
}
export function openMatchday(m, opts = {}) {
  return openLineups({ home: 'al-ittihad', away: m, label: [m?.compLabel, m?.round].filter(Boolean).join(' · ') || 'Match day', ...opts });
}

/* ── the shoot-out scoreboard bar: "ITT 2 – 1 HIL · Penalties · ●○○○○" (3D HUD and the simulated shoot-out) ── */
function dots(kicks, n) { return Array.from({ length: n }, (_, i) => `<i class="${kicks[i] === 1 ? 'is-in' : kicks[i] === 0 ? 'is-out' : ''}"></i>`).join(''); }
function sobHTML(s, line = '') {
  const n = Math.max(5, s.home.kicks.length, s.away.kicks.length);
  const hp = s.home.kicks.reduce((a, b) => a + b, 0), ap = s.away.kicks.reduce((a, b) => a + b, 0);
  const sd = Math.min(s.home.kicks.length, s.away.kicks.length) >= 5;
  return `<div class="cu-sob__bar"><span class="cu-sob__t ${s.you === 'home' ? 'is-you' : ''}">${crest(s.home)}<b>${esc(s.home.code)}</b></span>
      <span class="cu-sob__s"><b>${hp}</b><i>–</i><b>${ap}</b></span>
      <span class="cu-sob__t is-r ${s.you === 'away' ? 'is-you' : ''}"><b>${esc(s.away.code)}</b>${crest(s.away)}</span></div>
    <div class="cu-sob__sub"><span class="cu-sob__d">${dots(s.home.kicks, n)}</span><em>${sd ? 'Sudden death' : 'Penalties'}</em><span class="cu-sob__d">${dots(s.away.kicks, n)}</span></div>
    ${line ? `<p class="cu-sob__line">${line}</p>` : ''}`;
}
let hud = null;
export function shootoutHUD(e) {
  if (!e || e.mode !== 'shootout') return;
  if (e.type === 'end' || e.type === 'stop') {
    const h = hud; hud = null;
    if (h) { const off = () => { h.remove(); if (!hud) document.body.classList.remove('cu-so-on'); }; if (e.type === 'end') setTimeout(off, 1500); else off(); }
    return;
  }
  const s = e.shootout; if (!s) return;
  if (!hud) { hud = document.createElement('div'); hud.className = 'cu-sob is-hud'; hud.setAttribute('aria-live', 'polite'); document.body.append(hud); document.body.classList.add('cu-so-on'); }
  const yourTurn = s.turn === 'shoot';
  const win = s.done ? esc(`${s.winner === 'home' ? s.home.code : s.away.code} win the shoot-out`) : '';
  const line = e.type === 'result' ? [esc(e.msg || ''), win].filter(Boolean).join(' · ')
    : s.done ? win
      : yourTurn ? `Your kick · <b>${esc(s.kicker)}</b>` : `Save it · <b>${esc(s.kicker)}</b> to shoot`;
  hud.innerHTML = sobHTML(s, line);
  hud.classList.toggle('is-done', !!s.done);
  if (e.cut && !RM()) { const c = document.createElement('div'); c.className = 'cu-cut'; c.innerHTML = `<b>${yourTurn ? 'YOUR KICK' : 'SAVE IT'}</b>`; document.body.append(c); c.addEventListener('animationend', () => c.remove()); }
}

/* ── the tournament ── */
let cupEl = null;
export function openCup({ onClose, playShootout, onCart } = {}) {
  cupEl?.remove();
  const el = cupEl = mount('cu--cup');
  let state = valid(load()) ? load() : null;
  let pick = state?.team || 'al-ittihad';
  const close = () => { if (cupEl === el) cupEl = null; el.classList.remove('is-on'); setTimeout(() => el.remove(), 250); onClose?.(); };
  const base = { onCart, acts: { close } };
  const seedFor = (r, i) => { const [a, b] = state.rounds[r][i]; return hash(`${state.seed}|${r}|${i}|${a}|${b}`); };
  const youIn = (r) => state.rounds[r]?.findIndex((t) => t.includes(state.team)) ?? -1;

  function valid(s) { return s && s.v === 1 && bySlug(s.team) && Array.isArray(s.rounds) && s.rounds[0]?.length === 8 && Array.isArray(s.res); }

  /* SELECT TEAM */
  function select() {
    const strip = RANKED.map((c) => `<button type="button" class="cu-club ${c.slug === pick ? 'is-on' : ''}" data-act="pick" data-slug="${c.slug}" aria-label="${esc(c.name)}">${crest(c)}<b>${esc(c.code)}</b>${stars(starsOf(c))}</button>`).join('');
    screen(el, {
      ...base, title: 'Select team', cls: 'cu-sel',
      body: `<div class="cu-strip" role="list">${strip}</div><section class="cu-hero js-hero">${heroHTML()}</section>
        <footer class="cu-foot"><button type="button" class="cu-btn is-ghost" data-act="intro">Introduction</button><button type="button" class="cu-btn is-ghost" data-act="all">All clubs</button><span class="cu-sp"></span><button type="button" class="cu-btn is-big" data-act="select">Select</button></footer>`,
      acts: { close, pick: (b) => setPick(b.dataset.slug), intro, all: allClubs, select: () => { feel.win(); start(pick); } },
    });
    el.querySelector('.cu-club.is-on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    heroIn();
  }
  function seedOf(slug) {
    const field = fieldFor(slug); return field.findIndex((c) => c.slug === slug) + 1;
  }
  function heroHTML() {
    const c = bySlug(pick), t = bestXI(c), [a, b, d] = t.top3;
    return `<img class="cu-hero__wm" src="${esc(c.logo)}" alt=""/>
      <div class="cu-hero__info"><p class="cu-k">Your club</p><h3>${esc(c.name)}</h3>${stars(starsOf(c))}
        <dl class="cu-facts"><div><dt>Team rating</dt><dd>${ovr(c)}</dd></div><div><dt>Formation</dt><dd>${t.formation}</dd></div><div><dt>Seed</dt><dd>${seedOf(c.slug)} / 16</dd></div></dl>
        <p class="cu-note">Top players · demo ratings</p></div>
      <div class="cu-hero__cards">${[b, a, d].filter(Boolean).map((p, i) => `<div class="cu-hero__c is-${i}">${fcCardHTML(p, { size: 'l', tag: i === 1 ? 'STAR' : '' })}</div>`).join('')}</div>`;
  }
  function heroIn() {
    if (RM()) return;
    el.querySelectorAll('.cu-hero__c').forEach((c, i) => c.animate([{ opacity: 0, transform: `translateY(30px) rotate(${(i - 1) * 8}deg)` }, { opacity: 1, transform: 'none' }], { duration: 380, delay: i * 70, easing: 'cubic-bezier(.2,.8,.3,1.05)', fill: 'backwards' }));
  }
  function setPick(slug) {
    pick = slug;
    el.querySelectorAll('.cu-club').forEach((b) => b.classList.toggle('is-on', b.dataset.slug === slug));
    const h = el.querySelector('.js-hero'); if (h) { h.innerHTML = heroHTML(); heroIn(); }
  }
  function intro() {
    modal(el, `<p class="cu-k">Introduction</p><h3>The SPL Cup</h3>
      <p>Sixteen Saudi Pro League clubs, one knockout bracket. Pick your club and win four ties in a row: the round of 16, the quarter-final, the semi-final and the final.</p>
      <p>Before every tie you see both line-ups, then the match plays out. Matches are simulated from each squad's best XI. If it's still level after extra time, it goes to penalties${playShootout ? ' and you take the shoot-out yourself in the stadium: shoot your team\'s kicks, then dive to save theirs' : ''}.</p>
      <p>Every round you win earns XP. Your bracket is saved in this browser, so you can come back to it.</p>
      <p class="cu-note">Squads from spl.com.sa. Ratings and results are demo values, not predictions.</p>
      <div class="cu-row"><button type="button" class="cu-btn" data-act="m-close">Got it</button></div>`);
  }
  function allClubs() {
    modal(el, `<p class="cu-k">All clubs</p><h3>Choose your club</h3><div class="cu-grid">${RANKED.map((c) => `<button type="button" class="cu-club ${c.slug === pick ? 'is-on' : ''}" data-act="gpick" data-slug="${c.slug}">${crest(c)}<b>${esc(c.name)}</b>${stars(starsOf(c))}</button>`).join('')}</div><div class="cu-row"><button type="button" class="cu-btn is-ghost" data-act="m-close">Close</button></div>`,
      { gpick: (b) => { setPick(b.dataset.slug); el.querySelector('.cu-club.is-on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } });
  }

  /* the field: the 16 strongest by demo rating, and always your club (it takes the 16th place if it must) */
  function fieldFor(slug) {
    const f = RANKED.slice(0, 16);
    if (!f.some((c) => c.slug === slug)) f[15] = bySlug(slug);
    return f.sort((a, b) => AVG.get(b.slug) - AVG.get(a.slug));
  }
  function start(slug) {
    const f = fieldFor(slug);
    state = { v: 1, team: slug, seed: (Date.now() ^ Math.floor(Math.random() * 2 ** 31)) >>> 0, round: 0, status: 'playing', wins: 0, xp: 0,
      rounds: [SEED_PAIRS.map(([a, b]) => [f[a - 1].slug, f[b - 1].slug]), [], [], []], res: [Array(8).fill(null), Array(4).fill(null), Array(2).fill(null), [null]] };
    save(state);
    progress.played('cup');
    bracket(0);
  }

  /* BRACKET: R16 · QF · SF on each side, the final either side of the trophy */
  const XL = [6, 18.5, 31, 43.5], XR = [94, 81.5, 69, 56.5], SW = 10.6, Y0 = 5, Y1 = 95, YF = 60;
  function pos(r, i, s) {
    if (r === 3) return { x: s ? XR[3] : XL[3], y: YF, left: !s };
    const n = 8 >> r, left = i < n / 2, li = left ? i : i - n / 2, k = li * 2 + s;
    return { x: (left ? XL : XR)[r], y: Y0 + ((k + 0.5) / n) * (Y1 - Y0), left };
  }
  function bracket(drawFrom = -1) {
    if (state.status !== 'playing' && drawFrom < 0) drawFrom = 9;
    const r = state.round, slots = [], paths = [];
    for (let rr = 0; rr < 4; rr++) {
      const n = 8 >> rr;
      for (let i = 0; i < n; i++) {
        const tie = state.rounds[rr]?.[i], res = state.res[rr]?.[i];
        for (let s = 0; s < 2; s++) {
          const p = pos(rr, i, s), slug = tie?.[s], c = bySlug(slug);
          const g = res ? (s ? res.ag : res.hg) : null, won = res && res.w === slug, out = res && !won;
          const cls = [c ? '' : 'is-empty', slug === state.team ? 'is-you' : '', won ? 'is-win' : '', out ? 'is-out' : '', rr === r && state.status === 'playing' && tie?.includes(state.team) ? 'is-next' : ''].join(' ');
          slots.push(`<div class="cu-slot ${cls}" style="left:${p.x}%;top:${p.y}%;--d:${(rr * 0.18 + 0.1).toFixed(2)}s">${c ? `${crest(c)}<b>${esc(c.code)}</b>${g != null ? `<em>${g}${res.pens ? `<sup>${s ? res.pens.a : res.pens.h}</sup>` : ''}</em>` : ''}` : '<b>—</b>'}</div>`);
        }
        if (rr < 3) {
          const a = pos(rr, i, 0), b = pos(rr, i, 1), nx = pos(rr + 1, i >> 1, i & 1), dir = a.left ? 1 : -1;
          const xe = a.x + (dir * SW) / 2, xn = nx.x - (dir * SW) / 2, xm = (xe + xn) / 2;
          const youWent = res && res.w === state.team, played = !!res;
          paths.push(`<path class="${youWent ? 'is-you' : played ? 'is-done' : ''} ${rr >= drawFrom ? 'is-draw' : ''}" style="--d:${((rr - Math.max(0, drawFrom)) * 0.3 + 0.15).toFixed(2)}s" pathLength="1" d="M${xe} ${a.y}H${xm}M${xe} ${b.y}H${xm}M${xm} ${a.y}V${b.y}M${xm} ${nx.y}H${xn}"/>`);
        }
      }
    }
    const i = youIn(r), tie = state.rounds[r]?.[i], opp = tie ? bySlug(tie[0] === state.team ? tie[1] : tie[0]) : null, me = bySlug(state.team);
    const champ = state.res[3]?.[0]?.w ? bySlug(state.res[3][0].w) : null;
    const foot = state.status === 'playing'
      ? `<p class="cu-next"><span class="cu-k">Next · ${ROUND[r]}</span><span>${crest(me)}<b>${esc(me.name)}</b><i>v</i>${crest(opp)}<b>${esc(opp?.name)}</b></span></p><span class="cu-sp"></span>
        <button type="button" class="cu-btn is-ghost" data-act="new">New cup</button><button type="button" class="cu-btn is-big" data-act="go">Continue</button>`
      : `<p class="cu-next"><span class="cu-k">${state.status === 'won' ? 'Champions' : 'Cup winners'}</span><span>${crest(champ)}<b>${esc(champ?.name || '')}</b></span></p><span class="cu-sp"></span>
        <button type="button" class="cu-btn is-ghost" data-act="end">Back</button><button type="button" class="cu-btn is-big" data-act="again">Play again</button>`;
    screen(el, {
      ...base, title: state.status === 'playing' ? ROUNDS[r] : 'Bracket', cls: 'cu-br',
      body: `<div class="cu-bk ${drawFrom < 9 ? 'is-anim' : ''}"><svg class="cu-bk__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths.join('')}</svg>
          <div class="cu-bk__cup"><span>Final</span>${TROPHY}</div>${slots.join('')}</div>
        <p class="cu-fine">Ties are simulated from demo ratings · level after extra time goes to penalties</p>
        <footer class="cu-foot">${foot}</footer>`,
      acts: {
        close, go: playTie, end: endScreen, again: () => { state = null; save(null); select(); },
        new: () => modal(el, `<p class="cu-k">New cup</p><h3>Start again?</h3><p>This bracket will be lost.</p><div class="cu-row"><button type="button" class="cu-btn is-ghost" data-act="m-close">Keep playing</button><button type="button" class="cu-btn" data-act="restart">Start a new cup</button></div>`,
          { restart: () => { state = null; save(null); select(); } }),
      },
    });
  }

  /* one tie: line-ups → VS → the match → (penalties) → result → players of the match → what's next */
  async function playTie() {
    const r = state.round, i = youIn(r); if (i < 0) return bracket();
    const [hs, as] = state.rounds[r][i], home = bySlug(hs), away = bySlug(as), you = hs === state.team ? 'home' : 'away';
    const mine = you === 'home' ? home : away, them = you === 'home' ? away : home;
    const sim = simMatch(home, away, seedFor(r, i));
    const label = `SPL Cup · ${ROUND[r]}`;
    await new Promise((res) => lineupsView(el, {
      teams: [{ club: mine, tag: you === 'home' ? 'Home · You' : 'Away · You' }, { club: them, tag: you === 'home' ? 'Away' : 'Home' }],
      kicker: label, title: 'Line-ups', note: 'Best XI by demo rating', finalLabel: 'Kick off', onFinal: res, onCart, onBack: () => bracket(9), onHome: close,
    }));
    if (!el.isConnected) return;
    await openVs({ home, away, label });
    if (!el.isConnected) return;
    const pens = await live({ home, away, sim, you, label, seed: seedFor(r, i) });
    if (!el.isConnected) return;
    const w = sim.hg > sim.ag ? hs : sim.ag > sim.hg ? as : pens.winner === 'home' ? hs : as;
    // record it straight away (a reload mustn't replay a decided tie), then play the rest of the round
    state.res[r][i] = { hg: sim.hg, ag: sim.ag, et: sim.et, w, pens: pens ? { h: pens.homePens, a: pens.awayPens, home: pens.home, away: pens.away, by: pens.by } : null };
    const won = w === state.team;
    simRound(r, i);
    if (won) {
      state.wins++; state.xp += XP_ROUND[r];
      progress.award(XP_ROUND[r], `SPL Cup · ${ROUND[r]} won`);
      progress.setBest('cup', state.wins);
      if (r === 3) state.status = 'won'; else state.round = r + 1;
    } else {
      state.status = 'out';
      for (let rr = r + 1; rr < 4; rr++) simRound(rr, -1);   // the rest of the cup, so the bracket has a winner
    }
    save(state);
    await result({ home, away, sim, pens: state.res[r][i].pens, you, label, won });
    if (!el.isConnected) return;
    await potm({ home, away, sim, you, label });
    if (!el.isConnected) return;
    if (state.status === 'playing') bracket(r); else endScreen();
  }
  // simulate the round's other ties (skip = yours) and draw the next round
  function simRound(r, skip) {
    state.rounds[r].forEach(([a, b], j) => {
      if (j === skip || state.res[r][j]) return;
      const m = simMatch(bySlug(a), bySlug(b), seedFor(r, j));
      let w = m.hg > m.ag ? a : b, pens = null;
      if (m.hg === m.ag) { const s = simShootout(bySlug(a), bySlug(b), seedFor(r, j)); w = s.winner === 'home' ? a : b; pens = { h: s.homePens, a: s.awayPens, by: 'sim' }; }
      state.res[r][j] = { hg: m.hg, ag: m.ag, et: m.et, w, pens };
    });
    if (r < 3) state.rounds[r + 1] = Array.from({ length: (8 >> r) / 2 }, (_, k) => [state.res[r][2 * k].w, state.res[r][2 * k + 1].w]);
  }

  /* the match, sped up: a clock, the score, the goals as they go in */
  function live({ home, away, sim, you, label, seed }) {
    return new Promise((resolve) => {
      screen(el, {
        ...base, title: 'Match', kicker: label, cls: 'cu-live',
        body: `<div class="cu-live__board"><p class="cu-tag">Simulated · demo</p>${scoreRow(home, away, 0, 0, you)}
            <div class="cu-clock"><b class="js-min">0'</b><span class="js-ph">Kick-off</span></div><div class="cu-prog"><i class="js-prog"></i></div></div>
          <div class="cu-live__mid"><ol class="cu-feed js-feed"><li class="is-none">Kick-off</li></ol><ul class="cu-st cu-live__st js-lst"></ul></div><div class="cu-live__pens js-pens" hidden></div>
          <footer class="cu-foot"><span class="cu-sp"></span><button type="button" class="cu-btn is-ghost js-skip" data-act="skip">Skip to full time</button></footer>`,
        acts: { close, skip: () => { fast = true; } },
      });
      const $ = (s) => el.querySelector(s);
      let min = 0, hg = 0, ag = 0, fast = false, k = 0;
      const total = sim.minutes;
      const step = () => {
        if (!el.isConnected) return;
        if (fast) { while (min < total) tick(); return end(); }
        tick();
        if (min >= total) return end();
        setTimeout(step, min === 45 || min === 90 ? 650 : 62);
      };
      const tick = () => {
        min++;
        while (k < sim.events.length && sim.events[k].min <= min) {
          const e = sim.events[k++];
          if (e.side === 'home') hg++; else ag++;
          const sc = P[e.scorer], as = e.assist != null ? P[e.assist] : null, t = e.side === 'home' ? home : away;
          const li = document.createElement('li'); li.className = `is-${e.side === you ? 'you' : 'them'}`;
          li.innerHTML = `<em>${e.min}'</em>${crest(t)}${svg('ball')}<b>${esc(nm(sc))}</b>${as ? `<span>assist ${esc(nm(as))}</span>` : ''}`;
          $('.js-feed .is-none')?.remove();
          $('.js-feed').prepend(li);
          $('.cu-sr__s').innerHTML = `<b>${hg}</b><i>–</i><b>${ag}</b>`;
          $('.cu-sr__s').classList.remove('is-pop'); void $('.cu-sr__s').offsetWidth; $('.cu-sr__s').classList.add('is-pop');
          if (!fast) { if (e.side === you) feel.goal(); else feel.miss(); }
        }
        $('.js-min').textContent = `${min}'`;
        $('.js-ph').textContent = min < 45 ? 'First half' : min === 45 ? 'Half-time' : min < 90 ? 'Second half' : min === 90 ? (sim.et ? 'Level: extra time' : 'Full time') : min < 120 ? 'Extra time' : 'End of extra time';
        $('.js-prog').style.width = `${(min / 120) * 100}%`;
        liveStats();
      };
      // the stats build up as the match goes (the same totals the result screen shows)
      const S = sim.stats;
      const liveStats = () => {
        const f = min / total, gh = hg, ga = ag;
        const poss = Math.round(S.home.possession + (1 - f) * Math.sin(min * 0.7) * 6);
        const rows = [['Possession', poss, 100 - poss, '%'], ['Shots', Math.max(gh, Math.round(S.home.shots * f)), Math.max(ga, Math.round(S.away.shots * f))],
          ['On target', Math.max(gh, Math.round(S.home.onTarget * f)), Math.max(ga, Math.round(S.away.onTarget * f))]];
        $('.js-lst').innerHTML = rows.map(([l, h, a, u = '']) => `<li><span class="cu-st__v">${h}${u}</span><span class="cu-st__l">${l}</span><span class="cu-st__v is-r">${a}${u}</span><span class="cu-st__bar"><i style="--w:${(h / (h + a || 1)) * 100}%"></i></span></li>`).join('');
      };
      const end = () => {
        $('.js-skip')?.remove();
        $('.js-ph').textContent = sim.et ? 'After extra time' : 'Full time';
        $('.js-min').textContent = `${total}:00`;
        if (sim.hg !== sim.ag) { setTimeout(() => el.isConnected && resolve(null), 1300); return; }
        pensStep({ home, away, you, seed, resolve });
      };
      liveStats();
      setTimeout(step, 400);
    });
  }
  function scoreRow(home, away, hg, ag, you) {
    return `<div class="cu-sr"><div class="cu-sr__t ${you === 'home' ? 'is-you' : ''}">${crest(home)}<b>${esc(home.name)}</b></div>
      <div class="cu-sr__s"><b>${hg}</b><i>–</i><b>${ag}</b></div>
      <div class="cu-sr__t is-r ${you === 'away' ? 'is-you' : ''}"><b>${esc(away.name)}</b>${crest(away)}</div></div>`;
  }
  const soTeam = (c) => { const t = takers(c); return { slug: c.slug, code: c.code, name: c.name, logo: c.logo, kickers: t.kickers.map(full), keeper: full(t.keeper) }; };
  function pensStep({ home, away, you, seed, resolve }) {
    const box = el.querySelector('.js-pens'); box.hidden = false;
    el.querySelector('.cu-live')?.classList.add('has-pens');
    feel.roar();
    const simulate = () => {
      const s = simShootout(home, away, seed), H = [], A = [];
      const show = (line) => { box.innerHTML = `<div class="cu-sob">${sobHTML({ home: { ...soTeam(home), kicks: H }, away: { ...soTeam(away), kicks: A }, you }, line)}</div><p class="cu-tag">Shoot-out simulated · demo</p>`; };
      show('Penalties');
      let n = 0;
      const next = () => {
        if (!el.isConnected) return;
        if (n >= s.home.length + s.away.length) {
          show(esc(`${(s.winner === 'home' ? home : away).name} win the shoot-out`));
          if (s.winner === you) feel.win(); else feel.miss();
          setTimeout(() => el.isConnected && resolve({ ...s, by: 'sim' }), 1500);
          return;
        }
        const side = n % 2 === 0 ? 'home' : 'away', v = s[side][n >> 1];
        (side === 'home' ? H : A).push(v);
        const kick = (side === 'home' ? home : away), tk = takers(kick).kickers;
        show(`${esc(nm(tk[(n >> 1) % tk.length]))} · ${v ? 'scores' : 'misses'}`);
        n++;
        setTimeout(next, RM() ? 250 : 720);
      };
      setTimeout(next, 600);
    };
    if (!playShootout) { simulate(); return; }
    box.innerHTML = `<div class="cu-pens"><p class="cu-k">Level after extra time</p><h3>Penalties</h3><p>Take the shoot-out yourself in the stadium: shoot your team's kicks, then dive to save theirs.</p>
      <div class="cu-row"><button type="button" class="cu-btn is-ghost" data-act="psim">Simulate it</button><button type="button" class="cu-btn is-big" data-act="pplay">Take the shoot-out</button></div></div>`;
    el._acts = { ...el._acts, psim: simulate, pplay: () => {
      let done = false;
      el.hidden = true;
      playShootout({ home: soTeam(home), away: soTeam(away), you, onResult: (r) => {
        if (done) return; done = true;
        el.hidden = false; el.focus({ preventScroll: true });
        resolve({ homePens: r.homePens, awayPens: r.awayPens, winner: r.winner, home: r.home || [], away: r.away || [], by: r.abandoned ? 'part' : 'you' });
      } });
    } };
  }

  /* RESULT: score [pens], scorers, a summary timeline and the match stats */
  function result({ home, away, sim, pens, you, label, won }) {
    return new Promise((resolve) => {
      const scorers = (side) => {
        const by = new Map();
        sim.events.filter((e) => e.side === side).forEach((e) => by.set(e.scorer, [...(by.get(e.scorer) || []), e.min]));
        return [...by].map(([id, mins]) => `<li>${svg('ball')}<b>${esc(nm(P[id]))}</b><span>${mins.map((m) => `${m}'`).join(', ')}</span></li>`).join('');
      };
      const timeline = sim.events.map((e) => `${e.min > 90 && !sim.events.some((x) => x.min > 90 && x.min < e.min) ? '<li class="is-div">Extra time</li>' : ''}<li class="is-${e.side}"><em>${e.min}'</em>${crest(e.side === 'home' ? home : away)}<b>${esc(full(P[e.scorer]))}</b>${e.assist != null ? `<span>Assist: ${esc(full(P[e.assist]))}</span>` : ''}</li>`).join('')
        || '<li class="is-none">No goals</li>';
      const S = sim.stats, rows = [['Possession', S.home.possession, S.away.possession, '%'], ['Shots', S.home.shots, S.away.shots], ['Shots on target', S.home.onTarget, S.away.onTarget], ['Passes', S.home.passes, S.away.passes], ['Pass accuracy', S.home.passAcc, S.away.passAcc, '%']];
      const stats = rows.map(([l, h, a, u = '']) => `<li><span class="cu-st__v">${h}${u}</span><span class="cu-st__l">${l}</span><span class="cu-st__v is-r">${a}${u}</span>
          <span class="cu-st__bar"><i style="--w:${(h / (h + a || 1)) * 100}%"></i></span></li>`).join('');
      const penLine = pens ? `<p class="cu-res__pens">(${pens.h} – ${pens.a} on penalties)</p>` : '';
      const soNote = pens ? (pens.by === 'you' ? 'Shoot-out taken by you' : pens.by === 'part' ? 'Shoot-out: you left early, the rest simulated' : 'Shoot-out simulated') : '';
      const winner = (pens ? (pens.h > pens.a ? home : away) : sim.hg > sim.ag ? home : away);
      const text = `${label}: ${home.name} ${sim.hg}–${sim.ag} ${away.name}${pens ? ` (${pens.h}–${pens.a} pens)` : ''}. ${won ? 'Through!' : 'Out.'} (simulated, demo)`;
      const tab = (k) => {
        el.querySelectorAll('.cu-tabs button').forEach((b) => b.classList.toggle('is-on', b.dataset.k === k));
        el.querySelectorAll('.cu-pane').forEach((p) => { p.hidden = p.dataset.k !== k; });
      };
      screen(el, {
        ...base, title: won ? 'You go through' : 'Full time', kicker: label, cls: 'cu-res',
        body: `<section class="cu-res__board ${won ? 'is-won' : 'is-lost'}">
            <p class="cu-tag">Simulated · demo</p>
            ${scoreRow(home, away, sim.hg, sim.ag, you)}${penLine}
            <p class="cu-res__clock">${sim.minutes}:00${sim.et ? ' · after extra time' : ''}</p>
            <div class="cu-res__sc"><ul>${scorers('home')}</ul><ul class="is-r">${scorers('away')}</ul></div>
            ${pens ? `<div class="cu-sob is-mini">${sobHTML({ home: { code: home.code, logo: home.logo, kicks: pens.home || [] }, away: { code: away.code, logo: away.logo, kicks: pens.away || [] }, you }, esc(soNote))}</div>` : ''}
            <p class="cu-res__w">${crest(winner)}<b>${esc(winner.name)}</b> go through</p>
          </section>
          <section class="cu-panel">
            <nav class="cu-tabs"><button type="button" class="is-on" data-act="tab" data-k="sum">Summary</button><button type="button" data-act="tab" data-k="stats">Match stats</button></nav>
            <ol class="cu-pane cu-tl" data-k="sum">${timeline}</ol>
            <ul class="cu-pane cu-st" data-k="stats" hidden><li class="cu-st__hd"><span>${crest(home)}${esc(home.code)}</span><span>${esc(away.code)}${crest(away)}</span></li>${stats}</ul>
          </section>
          <footer class="cu-foot"><span class="cu-sp"></span><button type="button" class="cu-btn is-ghost" data-act="share">${svg('share')}Share</button><button type="button" class="cu-btn is-big" data-act="go">Continue</button></footer>`,
        acts: { close, tab: (b) => tab(b.dataset.k), share: () => share(el, text), go: resolve },
      });
      if (won) feel.win();
    });
  }

  /* PLAYER OF THE MATCH, one per side */
  function potm({ home, away, sim, you, label }) {
    return new Promise((resolve) => {
      const card = (side, club) => {
        const r = sim.potm[side], p = P[r.id];
        const lines = [r.goals ? `<li><b>${r.goals}</b> goal${r.goals > 1 ? 's' : ''}</li>` : '', r.assists ? `<li><b>${r.assists}</b> assist${r.assists > 1 ? 's' : ''}</li>` : '',
          r.saves ? `<li><b>${r.saves}</b> save${r.saves > 1 ? 's' : ''}</li>` : '', `<li><b>${r.passes}</b> passes · ${r.acc}%</li>`].join('');
        return `<article class="cu-pm ${side === you ? 'is-you' : ''}"><p class="cu-pm__side">${crest(club)}<span>${esc(club.name)}</span></p>
          <div class="cu-pm__card">${fcCardHTML(p, { size: 'l', selected: side === you, slot: r.slot })}</div>
          <div class="cu-pm__txt"><p class="cu-k">Player of the match</p><h3>${esc(full(p))}</h3><p class="cu-pm__r"><b>${r.rating.toFixed(1)}</b><span>match rating</span></p><ul>${lines}</ul></div></article>`;
      };
      screen(el, {
        ...base, title: 'Player of the match', kicker: label, cls: 'cu-pms',
        body: `<div class="cu-pms__row">${card('home', home)}${card('away', away)}</div><p class="cu-fine">Match ratings and stats come from the simulation (demo)</p>
          <footer class="cu-foot"><span class="cu-sp"></span><button type="button" class="cu-btn is-big" data-act="go">Continue</button></footer>`,
        acts: { close, go: resolve },
      });
      if (!RM()) el.querySelectorAll('.cu-pm').forEach((c, i) => c.animate([{ opacity: 0, transform: `translateX(${i ? 40 : -40}px)` }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 100 + i * 120, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' }));
    });
  }

  /* CHAMPIONS / ELIMINATED */
  function pathHTML() {
    const out = [];
    for (let r = 0; r < 4; r++) {
      const i = state.rounds[r]?.findIndex((t) => t.includes(state.team)); if (i == null || i < 0) break;
      const res = state.res[r][i]; if (!res) break;
      const [a, b] = state.rounds[r][i], me = a === state.team, opp = bySlug(me ? b : a);
      const gf = me ? res.hg : res.ag, ga = me ? res.ag : res.hg, won = res.w === state.team;
      out.push(`<li class="${won ? 'is-won' : 'is-lost'}"><span>${ROUND[r]}</span>${crest(opp)}<b>${esc(opp.name)}</b><em>${gf}–${ga}${res.pens ? ` (${me ? res.pens.h : res.pens.a}–${me ? res.pens.a : res.pens.h} p)` : ''}${res.et && !res.pens ? ' aet' : ''}</em></li>`);
    }
    return out.join('');
  }
  function endScreen() {
    const me = bySlug(state.team), won = state.status === 'won';
    const champ = bySlug(state.res[3]?.[0]?.w);
    const lost = !won ? (() => { for (let r = 0; r < 4; r++) { const i = state.rounds[r]?.findIndex((t) => t.includes(state.team)); const res = i >= 0 ? state.res[r][i] : null; if (res && res.w !== state.team) return r; } return 0; })() : -1;
    screen(el, {
      ...base, title: won ? 'Champions' : 'Eliminated', cls: `cu-end ${won ? 'is-won' : 'is-out'}`,
      body: `<div class="cu-end__art">${won ? TROPHY : crest(me, 'cu-end__crest')}${won ? crest(me, 'cu-end__badge') : '<b class="cu-end__stamp">OUT</b>'}</div>
        <div class="cu-end__txt"><p class="cu-k">SPL Cup${won ? ' winners' : ''}</p><h3>${won ? 'Champions' : 'Eliminated'}</h3>
          <p>${won ? `${esc(me.name)} won all four ties.` : `${esc(me.name)} went out in the ${ROUND[lost].toLowerCase()}. ${champ ? `${esc(champ.name)} won the cup (simulated).` : ''}`}</p>
          <ul class="cu-path">${pathHTML()}</ul>
          <p class="cu-end__xp">${state.xp ? `+${state.xp} XP · ` : ''}${state.wins} ${state.wins === 1 ? 'round' : 'rounds'} won · best ${progress.best('cup')}</p></div>
        <footer class="cu-foot"><span class="cu-sp"></span><button type="button" class="cu-btn is-ghost" data-act="share">${svg('share')}Share</button><button type="button" class="cu-btn is-ghost" data-act="bk">Bracket</button><button type="button" class="cu-btn is-big" data-act="again">Play again</button></footer>`,
      acts: {
        close, bk: () => bracket(9),
        share: () => share(el, won ? `${me.name} won the SPL Cup! (simulated, demo)` : `${me.name} reached the ${ROUND[lost].toLowerCase()} of the SPL Cup. (simulated, demo)`),
        again: () => { state = null; save(null); select(); },
      },
    });
    if (won) { feel.win(); feel.roar(); feel.confetti({ n: 220 }); setTimeout(() => feel.confetti({ n: 120, x: 0.3 }), 500); setTimeout(() => feel.confetti({ n: 120, x: 0.7 }), 900); }
    else feel.miss();
  }

  if (state?.status === 'playing') bracket(9); else { state = null; select(); }
  return { close };
}
