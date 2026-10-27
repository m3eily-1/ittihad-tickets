// Your fan (2026-10-27, the game-design review: "the fan has no identity, the profile just says Tigers fan"). One
// fan avatar: a name, a skin tone, a kit, headwear, a beard and a celebration. It wears what you earn or redeem
// (rewards.js's wardrobe), shows on the menu's profile chip, and sits in your booked seat in the stadium.
// Cultural dress (ghutra, thobe, hijab, abaya) is never paywalled; the away kit, the all-yellow kit, the cap, the
// shemagh and three celebrations are earned.
//
//   getAvatar()        → { name, skin, outfit, head, beard, pose }   (a copy)
//   setAvatar(patch)   → saves, fires fanEvent('avatar-change', { look, name, changed }) and the onAvatar listeners
//   onAvatar(fn)       → fn(avatar, look) on every change (and when a reward unlocks something); returns an unsubscribe
//   avatarLook()       → { skin, outfit, head, beard, pose } for fans.js (mountFanPreview / the seat), locks applied
//   avatarName()       → the fan's name, or '' when none is set
//   avatarSVG(size)    → a flat head-and-shoulders in the avatar's colours (the menu chip's thumbnail)
//   openAvatar({ onClose, onProfile })   the "Edit your fan" page
//   bindProfileChip(el)                  keeps a menu profile button's thumbnail and name in step
//
// Storage: itt-avatar-v1 = { name, skin, outfit, head, beard, pose }
import './avatar.css';
import { fanEvent } from './fan-events.js';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { mountFanPreview } from './fans.js';
import { owns, onRewards, CLAW_SVG, AVATAR_ITEMS, setShopCat } from './rewards.js';
import { openPacks } from './packs.js';

const KEY = 'itt-avatar-v1';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── what can be worn, and what it takes ── */
// need: null = free · { item } = a rewards-shop / Fan Pass item (any one of `item` owns it) · { ach, how } = an achievement
const itemNeed = (...ids) => ({ item: ids });
export const SKINS = [0, 0.2, 0.4, 0.6, 0.8, 1];
export const OUTFITS = [
  { v: 0, name: 'Home kit', sub: 'Yellow and black stripes', need: null },
  { v: 3, name: 'White thobe', sub: 'Matchday whites', need: null },
  { v: 4, name: 'Black abaya', sub: 'Matchday black', need: null },
  { v: 1, name: 'Captain\'s Shirt', sub: 'Black, the ship on the back', need: itemNeed('kit-away') },
  { v: 2, name: 'All-yellow kit', sub: 'Head to toe in yellow', need: itemNeed('kit-yellow') },
  { v: 5, name: 'Gold kit', sub: 'Fan Pass reward', need: itemNeed('kit-gold') },
];
export const HEADS = [
  { v: 0, name: 'Short hair', need: null },
  { v: 5, name: 'Buzz cut', need: null },
  { v: 2, name: 'White ghutra', need: null },
  { v: 4, name: 'Hijab', need: null },
  { v: 1, name: 'Club cap', need: itemNeed('head-cap') },
  { v: 3, name: 'Red shemagh', need: itemNeed('head-shemagh') },
];
export const CELEBRATIONS = [
  { v: 'relaxed', name: 'Relaxed', need: null },
  { v: 'clap', name: 'Clap', need: null },
  { v: 'cheer', name: 'Cheer', need: null },
  { v: 'lean', name: 'Lean in', need: null },
  { v: 'scarf', name: 'Scarf up', need: itemNeed('scarf-classic', 'scarf-gold') },
  { v: 'phone', name: 'Phone torch', need: { ach: 'check-in', how: 'Check in at a match' } },
  { v: 'stand', name: 'Ultras stand', need: { ach: 'match-week', how: 'Finish a full match week' } },
];
const SLOTS = { outfit: OUTFITS, head: HEADS, pose: CELEBRATIONS };
const DEFAULT = { name: '', skin: 0.4, outfit: 0, head: 0, beard: 1, pose: 'relaxed' };

const unlocked = (need) => !need || (need.item ? need.item.some((id) => owns(id)) : progress.has(need.ach));
const optOf = (slot, v) => SLOTS[slot].find((o) => o.v === v);
const isFree = (slot, v) => { const o = optOf(slot, v); return !!o && unlocked(o.need); };
// the shop's entry for a locked option (its Claws price), if it's sold there
const shopItem = (need) => need?.item && AVATAR_ITEMS.find((a) => need.item.includes(a.id) && a.cost != null);

/* ── the store ── */
const load = () => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...DEFAULT }; } };
let st = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ } };
const subs = new Set();
const notify = () => { const a = getAvatar(), l = avatarLook(); subs.forEach((f) => { try { f(a, l); } catch (err) { console.warn('[avatar]', err); } }); };

export const getAvatar = () => ({ ...st });
// the community profile's name (the menu chip showed it before the avatar had one)
const profileName = () => { try { return JSON.parse(localStorage.getItem('itt-community-v1'))?.profile?.name || ''; } catch { return ''; } };
export const avatarName = () => st.name || progress.name || profileName();
export function avatarLook() {
  // anything not (or no longer) unlocked falls back to the free default, so the seat never shows a locked item
  const outfit = isFree('outfit', st.outfit) ? st.outfit : DEFAULT.outfit;
  const head = isFree('head', st.head) ? st.head : DEFAULT.head;
  const pose = isFree('pose', st.pose) ? st.pose : DEFAULT.pose;
  const skin = Math.min(1, Math.max(0, Number(st.skin) || 0));
  return { skin, outfit, head, beard: st.beard && head !== 4 ? 1 : 0, pose };
}
export function setAvatar(patch = {}) {
  const next = { ...st };
  if ('name' in patch) next.name = String(patch.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if ('skin' in patch) next.skin = Math.min(1, Math.max(0, Number(patch.skin) || 0));
  if ('beard' in patch) next.beard = patch.beard ? 1 : 0;
  for (const k of ['outfit', 'head', 'pose']) if (k in patch && isFree(k, patch[k])) next[k] = patch[k];
  const changed = Object.keys(next).filter((k) => next[k] !== st[k]);
  if (!changed.length) return getAvatar();
  st = next; save();
  if (changed.includes('name') && next.name) progress.name = next.name;
  fanEvent('avatar-change', { look: avatarLook(), name: avatarName(), changed });
  notify();
  return getAvatar();
}
export function onAvatar(fn) { subs.add(fn); return () => subs.delete(fn); }
// a redeemed or granted item can change what avatarLook() resolves to
onRewards(notify);
// another tab saved the avatar
addEventListener('storage', (e) => { if (e.key === KEY) { st = load(); notify(); } });

/* ── colours: the skin ramp picked to match how the fan shader renders it (lit and tone-mapped), light → dark ── */
const SKIN_A = [224, 179, 148], SKIN_B = [90, 58, 40];
export const skinHex = (t) => `#${SKIN_A.map((a, i) => Math.round(a + (SKIN_B[i] - a) * Math.min(1, Math.max(0, t))).toString(16).padStart(2, '0')).join('')}`;
const Y = '#ffea00', K = '#0c0c0c', WH = '#ecebe6', HAIR = '#1a120e';

/* ── the thumbnail: a flat head and shoulders ── */
let svgN = 0;
export function avatarSVG(look = avatarLook()) {
  const id = `av${++svgN}`, s = skinHex(look.skin), o = look.outfit, h = look.head;
  const body = 'M3 40 C3 31.5 10 28.5 20 28.5 C30 28.5 37 31.5 37 40 Z';
  const shirt = o === 0 ? `<g clip-path="url(#${id}b)"><rect x="0" y="27" width="40" height="13" fill="${Y}"/><rect x="6" y="27" width="9" height="13" fill="${K}"/><rect x="25" y="27" width="9" height="13" fill="${K}"/><path d="M16 28.6 L20 32 L24 28.6" fill="none" stroke="${K}" stroke-width="1.6"/></g>`
    : o === 1 ? `<path d="${body}" fill="${K}"/>`
    : `<path d="${body}" fill="${o === 2 ? Y : o === 3 ? WH : o === 5 ? '#d9a73a' : K}"/>`;
  const face = `<rect x="16.8" y="22" width="6.4" height="8" fill="${s}"/><ellipse cx="20" cy="17.5" rx="6.6" ry="7.6" fill="${s}"/>`;
  const eyes = `<rect x="16.6" y="16.4" width="1.6" height="1.6" fill="${HAIR}"/><rect x="21.8" y="16.4" width="1.6" height="1.6" fill="${HAIR}"/>`;
  const beard = look.beard && h !== 4 ? `<path d="M13.6 18.5 C13.8 24.6 16.8 25.8 20 25.8 C23.2 25.8 26.2 24.6 26.4 18.5 C25.2 21.4 22.8 22.2 20 22.2 C17.2 22.2 14.8 21.4 13.6 18.5 Z" fill="${HAIR}"/>` : '';
  const cloth = 'M11.2 19 C11 8 29 8 28.8 19 L31.5 31.5 L26.4 31.5 L26.4 19.5 C26.4 12.6 13.6 12.6 13.6 19.5 L13.6 31.5 L8.5 31.5 Z';
  const top = h === 0 ? `<path d="M13.3 16.5 C12.8 8.6 27.2 8.6 26.7 16.5 C25.4 12.4 14.6 12.4 13.3 16.5 Z" fill="${HAIR}"/>`
    : h === 5 ? `<path d="M13.4 15.6 C13.4 9.6 26.6 9.6 26.6 15.6 C25 12.6 15 12.6 13.4 15.6 Z" fill="${HAIR}" opacity="0.7"/>`
    : h === 1 ? `<path d="M13 14.6 C13 7.6 27 7.6 27 14.6 Z" fill="${K}"/><rect x="11.4" y="13.6" width="17.2" height="2.2" fill="${K}"/><rect x="18.8" y="9.6" width="2.4" height="2.4" fill="${Y}"/>`
    : h === 2 || h === 3 ? `${h === 3 ? `<defs><pattern id="${id}p" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="${WH}"/><rect width="1.5" height="1.5" fill="#b3121a"/></pattern></defs>` : ''}<path d="${cloth}" fill="${h === 3 ? `url(#${id}p)` : WH}"/><path d="M12.6 12.6 C15.6 10.2 24.4 10.2 27.4 12.6" fill="none" stroke="${K}" stroke-width="1.8"/>`
    : '';
  // the hijab wraps the face: drawn under it, round the head and down to the shoulders
  const hijab = h === 4 ? `<path d="M9.6 21 C9 7 31 7 30.4 21 L32 31.5 L8 31.5 Z" fill="#161616"/>` : '';
  const faceIn = h === 4 ? `<ellipse cx="20" cy="18.2" rx="5.4" ry="6.6" fill="${s}"/>` : face;
  return `<svg class="av-thumb" viewBox="0 0 40 40" aria-hidden="true"><defs><clipPath id="${id}b"><path d="${body}"/></clipPath></defs>
    <rect width="40" height="40" fill="#333"/>${shirt}${hijab}${faceIn}${beard}${eyes}${top}</svg>`;
}

/* ── the menu's profile chip: the thumbnail in place of the crest, the fan's name ── */
export function bindProfileChip(btn) {
  if (!btn || btn.dataset.av) return;
  btn.dataset.av = '1';
  btn.classList.add('av-chip');
  const img = btn.querySelector(':scope > img');
  const pic = document.createElement('span'); pic.className = 'av-chip__pic';
  if (img) img.replaceWith(pic); else btn.prepend(pic);
  const name = btn.querySelector('b');
  const sync = () => {
    if (!btn.isConnected) return off();
    pic.innerHTML = avatarSVG();
    if (name) name.textContent = avatarName() || 'Tigers fan';
    btn.setAttribute('aria-label', `${avatarName() || 'Tigers fan'}: edit your fan`);
  };
  const off = onAvatar(sync);
  sync();
}

/* ── the page ── */
let root = null, preview = null, trying = null, opts = {}, offRw = null;
const LOCK = '<svg class="av-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v10H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/></svg>';
const needLine = (need) => { const it = shopItem(need); return it ? `${CLAW_SVG}${it.cost.toLocaleString('en')}` : esc(need?.how || 'Fan Pass'); };

function tiles(slot, list, cur) {
  return list.map((o) => {
    const ok = unlocked(o.need), on = trying?.slot === slot ? trying.v === o.v : cur === o.v;
    const sel = !trying && cur === o.v;
    return `<button type="button" class="av-tile${on ? ' is-on' : ''}${ok ? '' : ' is-locked'}" data-act="pick" data-slot="${slot}" data-v="${esc(o.v)}" aria-pressed="${sel}">
      ${slot === 'outfit' ? `<span class="av-kit av-kit--${o.v}" aria-hidden="true"></span>` : ''}<b>${esc(o.name)}</b>
      ${ok ? '' : `<em>${LOCK}${needLine(o.need)}</em>`}</button>`;
  }).join('');
}
function renderOpts() {
  if (!root) return;
  const a = getAvatar(), look = avatarLook();
  const hijab = (trying?.slot === 'head' ? trying.v : look.head) === 4;
  root.querySelector('.js-av-opts').innerHTML = `
    <div class="av-grp"><label class="av-lab" for="av-name">Name</label>
      <input id="av-name" class="av-name" name="name" type="text" maxlength="20" autocomplete="nickname" spellcheck="false" placeholder="Tigers fan" value="${esc(a.name || progress.name || '')}"/></div>
    <div class="av-grp"><p class="av-lab">Skin tone</p><div class="av-skins" role="radiogroup" aria-label="Skin tone">${SKINS.map((t, i) => `<button type="button" class="av-sw${Math.abs(look.skin - t) < 0.01 ? ' is-on' : ''}" data-act="skin" data-v="${t}" role="radio" aria-checked="${Math.abs(look.skin - t) < 0.01}" aria-label="Skin tone ${i + 1}" style="--sw:${skinHex(t)}"></button>`).join('')}</div></div>
    <div class="av-grp"><p class="av-lab">Kit</p><div class="av-tiles">${tiles('outfit', OUTFITS, look.outfit)}</div></div>
    <div class="av-grp"><p class="av-lab">Headwear</p><div class="av-tiles">${tiles('head', HEADS, look.head)}</div></div>
    <div class="av-grp"><p class="av-lab">Beard</p><div class="av-seg">${[[1, 'Beard'], [0, 'Clean-shaven']].map(([v, l]) => `<button type="button" class="${!hijab && look.beard === v ? 'is-on' : ''}" data-act="beard" data-v="${v}" aria-pressed="${!hijab && look.beard === v}" ${hijab ? 'disabled' : ''}>${l}</button>`).join('')}</div></div>
    <div class="av-grp"><p class="av-lab">Celebration</p><div class="av-tiles">${tiles('pose', CELEBRATIONS, look.pose)}</div></div>`;
  renderTry();
}
// trying on a locked option: the preview wears it, and a bar says what it takes
function renderTry() {
  const bar = root?.querySelector('.js-av-try'); if (!bar) return;
  const o = trying && optOf(trying.slot, trying.v);
  if (!o) { bar.hidden = true; bar.innerHTML = ''; return; }
  const it = shopItem(o.need);
  bar.hidden = false;
  bar.innerHTML = `<p>${LOCK}<span><b>${esc(o.name)}</b><em>${it ? `${CLAW_SVG}${it.cost.toLocaleString('en')} Claws in Rewards` : `${esc(o.need.how)} to unlock it`}</em></span></p>
    <div class="av-try__btns">${it ? '<button type="button" class="sh__btn" data-act="shop">Get it</button>' : ''}<button type="button" class="sh__btn is-2" data-act="untry">Keep mine</button></div>`;
}
const previewLook = () => { const l = avatarLook(); if (trying) l[trying.slot] = trying.v; if (l.head === 4) l.beard = 0; return l; };
const refresh = () => { preview?.set(previewLook()); renderOpts(); };
const saveName = () => { const i = root?.querySelector('.av-name'); if (i) setAvatar({ name: i.value }); };

/** onClose: back · onProfile(back): the fan profile (city, player, interests) over this page */
export function openAvatar(o = {}) {
  opts = o;
  if (root) close(true);
  trying = null;
  root = document.createElement('div');
  root.className = 'sh av'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Edit your fan');
  root.setAttribute('data-lenis-prevent', '');
  root.innerHTML = `<div class="sh__panel av__panel">
    <header class="sh__hd"><button type="button" class="sh__back" data-act="close" aria-label="Back">Back</button><div class="sh__ht"><h2>Edit your fan</h2></div>
      ${opts.onProfile ? '<button type="button" class="av-prof" data-act="profile">Fan profile</button>' : ''}</header>
    <div class="sh__body av__body">
      <section class="av__stage"><div class="av__view js-av-view"></div><p class="av__hint">Drag to turn</p><div class="av-try js-av-try" hidden></div></section>
      <section class="av__opts js-av-opts"></section>
    </div></div>`;
  document.body.append(root);
  const me = root;
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keyup']) me.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  // typing in the name field shouldn't reach the walk's keys; Escape still goes to page-nav (it listens in capture)
  me.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && e.target.matches('.av-name')) { e.target.blur(); } });
  me.addEventListener('change', (e) => { if (e.target.matches('.av-name')) saveName(); });
  me.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'close') return close();
    if (a === 'skin') { feel.tap(); setAvatar({ skin: +b.dataset.v }); return refresh(); }
    if (a === 'beard') { feel.tap(); setAvatar({ beard: +b.dataset.v }); return refresh(); }
    if (a === 'pick') {
      const slot = b.dataset.slot, raw = b.dataset.v, v = slot === 'pose' ? raw : +raw;
      feel.tap();
      if (isFree(slot, v)) { trying = null; setAvatar({ [slot]: v }); }
      else trying = trying && trying.slot === slot && trying.v === v ? null : { slot, v };
      return refresh();
    }
    if (a === 'untry') { feel.back(); trying = null; return refresh(); }
    if (a === 'shop') {
      feel.tap(); saveName();
      setShopCat('avatar');
      me.classList.add('is-under');
      openPacks({ tab: 'rewards', onClose: () => { if (!me.isConnected) return; me.classList.remove('is-under'); if (trying && isFree(trying.slot, trying.v)) { setAvatar({ [trying.slot]: trying.v }); trying = null; } refresh(); } });
      return;
    }
    if (a === 'profile') {
      feel.tap(); saveName();
      me.classList.add('is-under');
      opts.onProfile?.(() => { if (me.isConnected) me.classList.remove('is-under'); notify(); });   // its name may now be the chip's
    }
  });
  renderOpts();
  preview = mountFanPreview(me.querySelector('.js-av-view'), previewLook());
  offRw = onRewards(() => { if (root === me) refresh(); });
  requestAnimationFrame(() => root?.classList.add('is-on'));
}
function close(quiet = false) {
  if (!root) return;
  saveName();
  if (!quiet) feel.back();
  const r = root; root = null; trying = null;
  offRw?.(); offRw = null;
  preview?.dispose(); preview = null;
  r.classList.remove('is-on'); setTimeout(() => r.remove(), 250);
  if (!quiet) opts.onClose?.();
}
export const closeAvatar = () => close(true);
