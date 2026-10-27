// Item packs (Ahmed, 2026-10-21: FC Mobile's ITEM PACK screen, "Tap to open"): a pack inventory you earn by
// playing, and the opening — the foil pack shakes, tears open with light rays, and the best player walks out
// (nationality → position → club → card) before the rest of the pack is laid out. Players are fantasy-ui.js's P
// (every SPL squad from spl.com.sa); their RATINGS ARE DEMO VALUES. Legend gems are never in a pack: they stay
// XP milestones (progress.js), so an XP item or a duplicate's XP can still cross a milestone and trigger that reveal.
//
// Storage (this browser only):
//   itt-packs-v1      unopened packs   [{ id, kind: 'starter'|'match'|'gold'|'elite', from: 'Cup win', at }]
//   itt-owned-v1      your club        [player ids] (indexes into P)
//   itt-owned-new-v1  ids not looked at yet in the Players screen (the 'NEW' tag)
//   itt-packs-init-v1 first-run flag   (the starter pack and the seeded club below are given once)
import './packs.css';
import './cards.css';   // feel.pop's "+1 pack" toast is styled there (.fx-pop)
import { P } from './fantasy-ui.js';
import { fcCardHTML, tierOf, POS_SHORT } from './fc-card.js';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { claws } from './economy.js';
import { fanEvent } from './fan-events.js';
import { shopHTML, shopClick, shopSheetOpen, closeShopSheet, CLAW_SVG, onRewards } from './rewards.js';

const K_PACKS = 'itt-packs-v1', K_OWNED = 'itt-owned-v1', K_NEW = 'itt-owned-new-v1', K_INIT = 'itt-packs-init-v1';
const CREST = '/teams/al-ittihad.png';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const isItt = (p) => p.club?.slug === 'al-ittihad';

// what each pack holds. `w` = odds per tier [bronze <65, silver 65–74, gold 75–84, elite 85+] (demo ratings);
// `min` = the guaranteed best card; `xp` = chance of an extra XP item and its range
export const PACK_KINDS = {
  starter: { name: 'Starter', cards: 5, w: [0.3, 0.5, 0.2, 0], min: 75, itt: true, xp: [0, 0, 0], blurb: 'Five players to start your club' },
  match: { name: 'Match', cards: 3, w: [0.4, 0.45, 0.14, 0.01], min: 0, xp: [0.5, 25, 60], blurb: 'Three players and a chance of XP' },
  gold: { name: 'Gold', cards: 4, w: [0, 0.35, 0.6, 0.05], min: 75, xp: [0.3, 40, 90], blurb: 'Four players, one 75+ guaranteed' },
  elite: { name: 'Elite', cards: 5, w: [0, 0.1, 0.65, 0.25], min: 85, xp: [0.4, 80, 150], blurb: 'Five players, one 85+ guaranteed' },
};
// a duplicate (or a quick-sold card) turns into XP by its tier
export const DUP_XP = { bronze: 10, silver: 20, gold: 40, elite: 80 };
export const SELL_XP = { bronze: 10, silver: 15, gold: 25, elite: 40 };

/* ── state ── */
const fns = new Set();
const emit = () => {
  const d = { packs: packsCount(), owned: ownedIds().length };
  fns.forEach((f) => { try { f(d); } catch (err) { console.warn(err); } });
  dispatchEvent(new CustomEvent('packs:change', { detail: d }));
};
let packs = null, owned = null, fresh = null;
function init() {
  if (packs) return;
  packs = load(K_PACKS, []); owned = load(K_OWNED, null); fresh = new Set(load(K_NEW, []));
  if (!Array.isArray(packs)) packs = [];
  if (!Array.isArray(owned)) {
    // FIRST RUN SEED (demo): so the Players and Club screens aren't empty, your club starts with a starter XI of
    // 11 Al-Ittihad players (the lower-rated ones by demo rating, so packs feel like upgrades: 1 GK, 4 DEF,
    // 3 MID, 3 FWD = a 4-3-3) plus 5 random lower-rated (under 70) players from the rest of the league.
    const pick = (pos, n) => P.filter((p) => isItt(p) && p.pos === pos).sort((a, b) => a.rating - b.rating).slice(0, n).map((p) => p.id);
    const others = shuffle(P.filter((p) => !isItt(p) && p.rating < 70 && p.photo)).slice(0, 5).map((p) => p.id);
    owned = [...pick('GK', 1), ...pick('DEF', 4), ...pick('MID', 3), ...pick('FWD', 3), ...others];
    save(K_OWNED, owned);
  }
  if (!load(K_INIT, false)) {
    // first visit: one starter pack, granted once
    save(K_INIT, true);
    if (!packs.some((p) => p.kind === 'starter')) { packs.push(newPack('starter', 'Welcome gift')); save(K_PACKS, packs); }
  }
}
const newPack = (kind, from) => ({ id: `pk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, kind: PACK_KINDS[kind] ? kind : 'match', from: String(from || ''), at: Date.now() });
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Add a pack to the inventory (e.g. grantPack('gold', 'Cup win')). Returns the pack. Shows a "+1 pack" toast. */
export function grantPack(kind = 'match', from = '') {
  init();
  const pk = newPack(kind, from);
  packs.push(pk); save(K_PACKS, packs);
  feel.pop(`+1 ${PACK_KINDS[pk.kind].name.toUpperCase()} PACK`);
  feel.tap();
  emit(); refresh?.();
  return pk;
}
export const packsCount = () => { init(); return packs.length; };

/* ── rewards (Ahmed, 2026-10-22: "merge rewards with the packs" — they were a News tab): welcome gifts, claimed here
   beside the packs. The claimed list keeps its old key so earlier claims carry over. Since 2026-10-27 the Rewards tab
   is the Claws shop (rewards.js) and each gift also starts your Claws balance, so the first redeem comes early. ── */
const K_CLAIMED = 'itt-news-claimed-v1';
export const REWARDS = [
  { id: 'r-welcome', title: 'Welcome to the tunnel', body: 'A welcome gift for your first visit', xp: 100, claws: 300 },
  { id: 'r-arcade', title: 'Arcade starter', body: 'Something to start your mini-game run', xp: 50, claws: 100 },
  { id: 'r-matchday', title: 'Matchday bonus', body: 'For your first match week with the app', xp: 50, claws: 100 },
];
const claimedSet = () => new Set(load(K_CLAIMED, []));
export const rewardsLeft = () => { const c = claimedSet(); return REWARDS.filter((r) => !c.has(r.id)).length; };
export function claimReward(id) {
  const c = claimedSet(), r = REWARDS.find((x) => x.id === id);
  if (!r || c.has(id)) return 0;
  c.add(id); save(K_CLAIMED, [...c]); progress.award(r.xp, r.title); if (r.claws) claws.earn(r.claws, r.title); emit();
  return r.xp;
}
// the menu's Packs badge: packs to open + rewards to claim
export const packsBadge = () => packsCount() + rewardsLeft();
export const packsList = () => { init(); return packs.slice(); };
/** fn({ packs, owned }) on every change; returns an unsubscribe. Also fired as window 'packs:change'. */
export function onPacks(fn) { fns.add(fn); return () => fns.delete(fn); }
export const ownedIds = () => { init(); return owned.slice(); };
export const isOwned = (id) => { init(); return owned.includes(+id); };
// the 'NEW' tags (cards from a pack you haven't looked at in the Players screen)
export const isNew = (id) => { init(); return fresh.has(+id); };
export function markSeen(id) { init(); if (fresh.delete(+id)) save(K_NEW, [...fresh]); }
/** Quick sell: removes an owned card and awards its SELL_XP. Returns the XP (0 if not owned). */
export function sellCard(id) {
  init(); id = +id;
  if (!owned.includes(id)) return 0;
  owned = owned.filter((x) => x !== id); save(K_OWNED, owned); markSeen(id);
  const xp = SELL_XP[tierOf(P[id].rating)];
  progress.award(xp, `Quick sell: ${P[id].last || P[id].first}`);
  emit();
  return xp;
}

/* ── what's inside: decided (and saved) the moment you tap, so closing mid-animation loses nothing ── */
const TIER_RANGE = [[0, 64], [65, 74], [75, 84], [85, 99]];
function draw(kind) {
  const K = PACK_KINDS[kind], got = new Set(), cards = [];
  const from = (lo, hi, pref) => {
    let pool = P.filter((p) => p.rating >= lo && p.rating <= hi && !got.has(p.id) && (!pref || isItt(p)));
    if (!pool.length) pool = P.filter((p) => p.rating >= lo && !got.has(p.id));
    // a nudge towards cards you don't have yet (duplicates still happen)
    const notMine = pool.filter((p) => !owned.includes(p.id));
    if (notMine.length && Math.random() < 0.7) pool = notMine;
    const p = pool[(Math.random() * pool.length) | 0];
    got.add(p.id); return p;
  };
  // the guaranteed one first (starter: an Al-Ittihad 75+)
  if (K.min) cards.push(from(K.min, 99, K.itt));
  while (cards.length < K.cards) {
    let r = Math.random(), t = 0;
    while (t < 3 && r >= K.w[t]) { r -= K.w[t]; t++; }
    const [lo, hi] = TIER_RANGE[t];
    cards.push(from(lo, hi, false));
  }
  const items = cards.map((p) => ({ type: 'card', p, dup: owned.includes(p.id) }));
  // the same player can't be new twice in one pack (already excluded by `got`)
  if (Math.random() < K.xp[0]) items.push({ type: 'xp', xp: Math.round((K.xp[1] + Math.random() * (K.xp[2] - K.xp[1])) / 5) * 5 });
  items.forEach((it) => { if (it.type === 'card' && it.dup) it.xp = DUP_XP[tierOf(it.p.rating)]; });
  return items;
}
function openOne(pk) {
  const items = draw(pk.kind);
  packs = packs.filter((x) => x.id !== pk.id); save(K_PACKS, packs);
  for (const it of items) if (it.type === 'card' && !it.dup) { owned.push(it.p.id); fresh.add(it.p.id); }
  save(K_OWNED, owned); save(K_NEW, [...fresh]);
  emit();
  fanEvent('pack-open', { kind: pk.kind });
  const xp = items.reduce((a, it) => a + (it.xp || 0), 0);
  let paid = false;
  // XP is paid once the summary shows (or when you leave early), so its pop-up doesn't land on the walkout
  return { pk, items, xp, pay() { if (paid || !xp) return; paid = true; progress.award(xp, `${PACK_KINDS[pk.kind].name} pack`); } };
}

/* ── the pack, drawn in CSS: crimped foil, a tear strip, the crest and the kind ── */
const teeth = (n, y0, y1, top) => {
  // a crimped edge as a clip-path: n teeth between y0 and y1 (%), along the top or the bottom
  const pts = [];
  for (let i = 0; i <= n * 2; i++) pts.push(`${((i / (n * 2)) * 100).toFixed(2)}% ${i % 2 ? y1 : y0}%`);
  return top ? pts : pts.reverse();
};
const CLIP_TOP = `polygon(${[...teeth(14, 0, 3.2, true), '100% 100%', '0 100%'].join(',')})`;
const CLIP_BODY = `polygon(0 0, 100% 0, ${teeth(14, 100, 96.6, false).join(',')})`;
export function packHTML(pk, { big = false } = {}) {
  const K = PACK_KINDS[pk.kind];
  return `<div class="pk-pack is-${pk.kind}${big ? ' is-big' : ''}" data-pack="${esc(pk.id)}">
    <div class="pk-pack__top" style="clip-path:${CLIP_TOP}"><span>AL ITTIHAD · ITEM PACK</span></div>
    <div class="pk-pack__body" style="clip-path:${CLIP_BODY}">
      <i class="pk-pack__shine"></i>
      <img class="pk-pack__crest" src="${CREST}" alt=""/>
      <b class="pk-pack__kind">${esc(K.name)}</b><span class="pk-pack__pk">PACK</span>
      <span class="pk-pack__n">${K.cards} PLAYERS${K.min ? ` · ${K.min}+` : ''}</span>
    </div>
  </div>`;
}

/* ── the screen ── */
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M3 11l9-7 9 7 M5 10v10h14V10"/>',
  pack: '<path d="M6 3h12v18H6z M6 7h12 M9 12h6"/>',
  gift: '<path d="M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7c-2-4-6-3-5 0 M12 7c2-4 6-3 5 0"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const TOP_SEL = '.pk, .cl, .lc-col, .lc-reveal, .lc-zoom';
let root = null, refresh = null;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// tab: 'packs' | 'rewards' — the two views, switched by tabs in the header (Ahmed, 2026-10-22: "the rewards should
// take a full page view with packs, use tabs to switch between them")
export function openPacks({ onClose, tab = 'packs' } = {}) {
  init();
  closePacks(true);
  let sel = packs[0]?.id, phase = 'idle', cur = null, timers = [];
  const later = (ms, f) => { const t = setTimeout(f, reduced() ? Math.min(ms, 80) : ms); timers.push(t); return t; };
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  root = document.createElement('div');
  const me = root;
  me.className = 'pk'; me.tabIndex = -1;
  me.setAttribute('role', 'dialog'); me.setAttribute('aria-label', 'Item packs'); me.setAttribute('data-lenis-prevent', '');
  me.innerHTML = `<div class="pk__bg" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <header class="pk__hd"><button type="button" class="pk__icbtn" data-act="close" aria-label="Back">${svg('back')}</button><h2>Packs &amp; rewards</h2>
      <nav class="pk__tabs js-pk-tabs" aria-label="Packs or rewards"></nav>
      <div class="pk__tr"><span class="pk__count js-pk-count"></span></div></header>
    <main class="pk__main js-pk-main"></main>
    <p class="pk__note">Players from spl.com.sa · legend gems come from XP milestones, not packs</p>`;
  document.body.append(me);
  for (const ev of ['wheel', 'pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keyup', 'click']) me.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'click' && ev !== 'keydown' });
  const $ = (s) => me.querySelector(s);
  const isTop = () => [...document.querySelectorAll(TOP_SEL)].pop() === me;
  const onKey = (e) => {
    if (!me.isConnected || !isTop()) return;
    if (e.key === 'Escape') { e.preventDefault(); if (phase === 'walk' || phase === 'tear') skip(); else if (view === 'rewards' && shopSheetOpen()) { closeShopSheet(); feel.back(); renderIdle(); } else close(); }
    else if ((e.key === 'Enter' || e.key === ' ') && phase === 'idle' && document.activeElement === me) { e.preventDefault(); tapPack(); }
    e.stopPropagation();
  };
  addEventListener('keydown', onKey, true);
  const close = (silent = false) => {
    if (!me.isConnected) return;
    clear(); cur?.pay();
    removeEventListener('keydown', onKey, true);
    if (root === me) { root = null; refresh = null; }
    if (silent === true) { me.remove(); return; }
    feel.back();
    me.classList.remove('is-on');
    setTimeout(() => me.remove(), 260);
    onClose?.();
  };
  me._close = close;

  /* idle: the next pack big, "Tap to open", the rest in a strip */
  const count = () => { $('.js-pk-count').innerHTML = view === 'rewards' ? `${CLAW_SVG}<b>${claws.balance.toLocaleString('en')}</b><span>Claws</span>` : `${svg('pack')}<b>${packs.length}</b>`; $('.js-pk-count').classList.toggle('is-claws', view === 'rewards'); };
  let view = tab === 'rewards' ? 'rewards' : 'packs';
  const tabs = () => {
    const left = rewardsLeft();
    $('.js-pk-tabs').innerHTML = [['packs', 'Packs', packs.length], ['rewards', 'Rewards', left]].map(([k, l, n]) => `<button type="button" class="${view === k ? 'is-on' : ''}" data-act="view" data-k="${k}" aria-pressed="${view === k}">${l}${n ? `<i>${n}</i>` : ''}</button>`).join('');
  };
  // the rewards, a page of their own: one card per gift, "Receive all" while more than one is left
  // the rewards: the Claws shop (rewards.js), with the welcome gifts on top while any are left to claim
  const renderRewards = () => {
    const c = claimedSet(), left = rewardsLeft();
    const gifts = left ? `<section class="pk-rws ec-gifts">
        <header class="pk-rws__hd"><p>${left} gift${left === 1 ? '' : 's'} to claim</p>${left > 1 ? '<button type="button" class="pk-btn" data-act="claimall">Receive all</button>' : ''}</header>
        <div class="pk-rws__grid">${REWARDS.filter((r) => !c.has(r.id)).map((r) => `<article class="pk-rw"><span class="pk-rw__ic">${svg('gift')}</span>
          <b>${esc(r.title)}</b><em>${esc(r.body)}</em><strong>+${r.xp} XP${r.claws ? ` · <span class="ec-price">${CLAW_SVG}${r.claws}</span>` : ''}</strong>
          <button type="button" class="pk-btn" data-act="claim" data-id="${esc(r.id)}">Claim</button></article>`).join('')}</div>
      </section>` : '';
    const main = $('.js-pk-main'), y = main.scrollTop;
    main.innerHTML = shopHTML({ gifts });
    main.scrollTop = y;
  };
  const renderIdle = () => {
    phase = 'idle'; me.dataset.phase = 'idle';
    count(); tabs();
    me.dataset.view = view;
    if (view === 'rewards') { renderRewards(); return; }
    const pk = packs.find((x) => x.id === sel) || packs[0];
    sel = pk?.id;
    if (!pk) {
      $('.js-pk-main').innerHTML = `<div class="pk__empty"><div class="pk-pack is-ghost"><div class="pk-pack__body"><img class="pk-pack__crest" src="${CREST}" alt=""/></div></div>
        <h3>No packs to open</h3><p>Win packs by playing: match cards, mini-games and challenges hand them out. Your players are in the Club.</p>
        <button type="button" class="pk-btn" data-act="close">Back</button></div>`;
      return;
    }
    const K = PACK_KINDS[pk.kind];
    $('.js-pk-main').innerHTML = `<section class="pk__stage">
        <div class="pk__rays" aria-hidden="true"></div>
        <button type="button" class="pk__packbtn js-pk-tap" data-act="open" aria-label="Open the ${esc(K.name)} pack">${packHTML(pk, { big: true })}</button>
        <div class="pk__cap"><p class="pk__kind">${esc(K.name)} pack${pk.from ? ` <span>· ${esc(pk.from)}</span>` : ''}</p><p class="pk__blurb">${esc(K.blurb)}</p>
        <p class="pk__tap">Tap to open</p></div>
      </section>
      <div class="pk__side">${packs.length > 1 ? `<aside class="pk__strip"><p class="pk__sh">Your packs <b>${packs.length}</b></p><div class="pk__list">${packs.map((x) => `<button type="button" class="pk__mini${x.id === sel ? ' is-on' : ''}" data-act="sel" data-id="${esc(x.id)}" aria-label="${esc(PACK_KINDS[x.kind].name)} pack">${packHTML(x)}<span>${esc(PACK_KINDS[x.kind].name)}</span></button>`).join('')}</div></aside>` : ''}</div>`;
    tilt();
  };
  // desktop: the pack follows the pointer a little
  const tilt = () => {
    const btn = $('.js-pk-tap'); if (!btn || matchMedia('(hover: none)').matches) return;
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--rx', `${(((e.clientY - r.top) / r.height) - 0.5) * -14}deg`);
      btn.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 18}deg`);
    });
    btn.addEventListener('pointerleave', () => { btn.style.setProperty('--rx', '0deg'); btn.style.setProperty('--ry', '0deg'); });
  };

  /* opening: shake → tear + rays → walkout of the best card → the pack laid out */
  const tapPack = () => {
    if (phase !== 'idle') return;
    const pk = packs.find((x) => x.id === sel); if (!pk) return;
    cur = openOne(pk); count();
    phase = 'shake'; me.dataset.phase = 'shake';
    const stage = $('.pk__stage');
    stage.classList.add('is-shake'); feel.tap(); feel.buzz([10, 60, 10, 60, 20]);
    later(320, () => feel.tap());
    later(640, () => feel.tap());
    later(950, () => {
      phase = 'tear'; me.dataset.phase = 'tear';
      stage.classList.remove('is-shake'); stage.classList.add('is-torn');
      feel.roar(); feel.buzz([40, 30, 80]);
      later(950, walkout);
    });
  };
  const best = () => cur.items.filter((i) => i.type === 'card').sort((a, b) => b.p.rating - a.p.rating)[0];
  let wStep = 0;
  const walkout = () => {
    if (!cur) return;
    phase = 'walk'; me.dataset.phase = 'walk';
    const it = best(), p = it.p, tier = tierOf(p.rating);
    $('.js-pk-main').innerHTML = `<section class="pk-walk is-${tier}" data-act="skip">
        <div class="pk__rays is-on" aria-hidden="true"></div><div class="pk-walk__floor" aria-hidden="true"></div>
        <p class="pk-walk__k">Best in the pack</p>
        <div class="pk-walk__hint" data-step="1"><small>Nationality</small><b>${esc(p.nat || '—')}</b></div>
        <div class="pk-walk__hint" data-step="2"><small>Position</small><b>${esc(POS_SHORT[p.pos] || p.pos)}</b></div>
        <div class="pk-walk__hint is-club" data-step="3"><small>Club</small>${p.club?.logo ? `<img src="${esc(p.club.logo)}" alt=""/>` : ''}<b>${esc(p.club?.name || '')}</b></div>
        <div class="pk-walk__card">${fcCardHTML(p, { size: 'l', tag: it.dup ? '' : 'NEW' })}<p class="pk-walk__nm">${esc(`${p.first} ${p.last}`.trim())}</p>${it.dup ? `<p class="pk-walk__dup">Duplicate · +${it.xp} XP</p>` : ''}</div>
        <p class="pk-walk__skip">Tap to skip</p>
      </section>`;
    const w = $('.pk-walk');
    const go = (n) => { if (!cur || phase !== 'walk') return; wStep = n; w.dataset.step = n; if (n < 4) feel.tap(); };
    wStep = 0; requestAnimationFrame(() => go(1));
    later(1000, () => go(2));
    later(2000, () => go(3));
    later(3000, () => { go(4); feel.win(); if (tier === 'elite' || tier === 'gold') { feel.roar(); feel.confetti({ n: tier === 'elite' ? 200 : 110, y: 0.45 }); } });
    later(4600, summary);
  };
  const skip = () => {
    if (phase === 'tear') { clear(); walkout(); return; }
    if (phase === 'walk') { if (wStep < 4) { clear(); const w = $('.pk-walk'); wStep = 4; w.dataset.step = 4; feel.win(); later(900, summary); } else { clear(); summary(); } }
  };
  const summary = () => {
    if (!cur) return;
    clear(); phase = 'sum'; me.dataset.phase = 'sum';
    const c = cur; c.pay();
    const order = [...c.items].sort((a, b) => (b.type === 'card') - (a.type === 'card') || (b.p?.rating || 0) - (a.p?.rating || 0));
    const nNew = order.filter((i) => i.type === 'card' && !i.dup).length;
    $('.js-pk-main').innerHTML = `<section class="pk-sum">
        <header class="pk-sum__hd"><p class="pk-sum__k">${esc(PACK_KINDS[c.pk.kind].name)} pack opened</p>
          <h3>${nNew} new player${nNew === 1 ? '' : 's'}${c.xp ? ` <span>+${c.xp} XP</span>` : ''}</h3></header>
        <div class="pk-sum__grid">${order.map((it, i) => it.type === 'xp'
          ? `<div class="pk-sum__it" style="--i:${i}"><div class="pk-xp"><b>+${it.xp}</b><span>XP</span></div><em>XP boost</em></div>`
          : `<div class="pk-sum__it${it.dup ? ' is-dup' : ''}" style="--i:${i}">${fcCardHTML(it.p, { size: 'm', tag: it.dup ? '' : 'NEW' })}<em>${it.dup ? `Duplicate · +${it.xp} XP` : esc(it.p.club?.name || '')}</em></div>`).join('')}</div>
        <div class="pk-sum__btns">${packs.length ? `<button type="button" class="pk-btn" data-act="next">Open next <b>${packs.length}</b></button>` : ''}<button type="button" class="pk-btn${packs.length ? ' is-ghost' : ''}" data-act="${packs.length ? 'idle' : 'close'}">${packs.length ? 'Back to packs' : 'Done'}</button></div>
      </section>`;
    cur = null;
  };

  me.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return close();
    if (a === 'skip') return skip();
    if (a === 'open') return tapPack();
    if (a.startsWith('rw-')) { if (shopClick(b)) renderIdle(); return; }
    feel.tap();
    if (a === 'sel') { sel = b.dataset.id; return renderIdle(); }
    if (a === 'view') { if (phase !== 'idle') return; view = b.dataset.k; return renderIdle(); }
    if (a === 'claim') { if (claimReward(b.dataset.id)) feel.win(); return renderIdle(); }
    if (a === 'claimall') { REWARDS.forEach((r) => claimReward(r.id)); feel.win(); feel.confetti(); return renderIdle(); }
    if (a === 'next') { sel = packs[0]?.id; renderIdle(); requestAnimationFrame(() => tapPack()); return; }
    if (a === 'idle') { sel = packs[0]?.id; return renderIdle(); }
  });
  refresh = () => { if (phase === 'idle' && me.isConnected) renderIdle(); };
  // the Claws chip and the shop follow the balance; the subscriptions end with the page
  closeShopSheet();
  const offC = claws.on(() => { if (!me.isConnected) return offC(); if (phase === 'idle') count(); });
  const offR = onRewards(() => { if (!me.isConnected) return offR(); if (phase === 'idle' && view === 'rewards' && !shopSheetOpen()) renderRewards(); });
  renderIdle();
  requestAnimationFrame(() => { me.classList.add('is-on'); me.focus({ preventScroll: true }); });
  return { close };
}
export function closePacks(silent = false) {
  root?._close?.(silent);
}
