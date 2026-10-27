// The Claws shop (Ahmed, 2026-10-27: "XP has nothing to spend on" → Claws, spent on four kinds of reward). It lives
// in the Packs page's Rewards tab (packs.js renders it with shopHTML and hands its clicks to shopClick). Four
// categories: ticket perks, store coupons, experiences (draw entries) and avatar items. Redeeming is confirm →
// spend → a "redeemed" state with a code. Ticket-perk coupons apply in the tickets checkout (tickets-cart.js) and
// store coupons in the club store's checkout (shop.js), each as a discount line. The rewards are illustrative: the
// prices in Claws, the perks and the draws are this app's, not offers the club has announced.
//
//   ownedItems() → ['kit-away', …]   owns(id) → bool     the fan avatar's wardrobe (the avatar builder reads these)
//   AVATAR_ITEMS                                         every avatar item: { id, slot, name, cost | null, pass }
//   grantItem(id, from)                                  the Fan Pass's item rewards (already owned → false)
//   couponsFor('ticket' | 'store') → unused coupons that apply in that checkout
//   couponValue(coupon, ctx) → { amount, label }          the discount for a basket (see each kind below)
//   useCoupon(code, orderNo)                             spent at checkout
//   onRewards(fn)                                        any change (redeem, use, grant)
//
// Storage: itt-rewards-v1 = { items: [ids], coupons: [{ code, id, at, usedOn }] }
import { claws } from './economy.js';
import { fanEvent } from './fan-events.js';
import { progress } from './progress.js';
import { feel } from './feel.js';

const KEY = 'itt-rewards-v1';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (n) => Number(n).toLocaleString('en');
const load = () => { try { return { items: [], coupons: [], ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { items: [], coupons: [] }; } };
const st = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ } };
const subs = new Set();
const changed = () => { save(); subs.forEach((f) => { try { f(); } catch (err) { console.warn(err); } }); };
export const onRewards = (fn) => { subs.add(fn); return () => subs.delete(fn); };

/* ── the avatar wardrobe ── */
// (the home kit and cultural dress — ghutra, thobe, abaya, hijab — are free in the avatar editor, avatar.js, so
// they're never sold here or given by the Fan Pass)
export const AVATAR_ITEMS = [
  { id: 'scarf-classic', slot: 'scarf', name: 'Classic scarf', sub: 'Yellow and black, for the stands', cost: 300 },
  { id: 'head-cap', slot: 'head', name: 'Club cap', sub: 'Black with the crest', cost: 400 },
  { id: 'head-shemagh', slot: 'head', name: 'Red shemagh', sub: 'For the big nights', cost: 600 },
  { id: 'kit-away', slot: 'kit', name: 'Captain\'s Shirt', sub: 'Black, the ship on the back', cost: 900 },
  { id: 'kit-yellow', slot: 'kit', name: 'All-yellow kit', sub: 'Head to toe in yellow', cost: 1200 },
  // Fan Pass only (fanpass.js): never in the shop
  { id: 'scarf-gold', slot: 'scarf', name: 'Gold Fan Pass scarf', sub: 'Fan Pass premium track, tier 17', cost: null, pass: true },
  { id: 'kit-gold', slot: 'kit', name: 'Gold Fan Pass kit', sub: 'Fan Pass premium track, tier 34', cost: null, pass: true },
];
export const ownedItems = () => st.items.slice();
export const owns = (id) => st.items.includes(id);
export function grantItem(id, from = '') {
  if (!AVATAR_ITEMS.some((x) => x.id === id) || owns(id)) return false;
  st.items.push(id); changed();
  fanEvent('avatar-item', { id, from });
  return true;
}

/* ── the catalogue ── */
export const CATS = [
  ['ticket', 'Ticket perks'],
  ['store', 'Store coupons'],
  ['exp', 'Experiences'],
  ['avatar', 'Avatar items'],
];
// apply: how a coupon works at checkout. pct = % off the tickets (max SAR), upgrade = one ticket at the next
// category down's price, off = SAR off the store order (from a minimum), print = name and number printing
export const CATALOG = [
  { id: 'tk-10', cat: 'ticket', title: '10% off a ticket order', body: 'Up to SAR 100 off the tickets in one checkout', cost: 1500, icon: 'ticket', apply: { kind: 'ticket', type: 'pct', v: 10, max: 100 } },
  { id: 'tk-early', cat: 'ticket', title: 'Early booking window', body: 'Book a home match 24 hours before general sale', cost: 2500, icon: 'clock', use: 'Shown when a home match opens its pre-sale. Keep the code.' },
  { id: 'tk-upgrade', cat: 'ticket', title: 'Free seat upgrade', body: 'One ticket in a category up, at the price of the one below', cost: 5000, icon: 'up', apply: { kind: 'ticket', type: 'upgrade' } },
  { id: 'st-25', cat: 'store', title: 'SAR 25 off in the club store', body: 'On a store order of SAR 100 or more', cost: 800, icon: 'bag', apply: { kind: 'store', type: 'off', v: 25, min: 100 } },
  { id: 'st-50', cat: 'store', title: 'SAR 50 off in the club store', body: 'On a store order of SAR 200 or more', cost: 1500, icon: 'bag', apply: { kind: 'store', type: 'off', v: 50, min: 200 } },
  { id: 'st-print', cat: 'store', title: 'Free name & number printing', body: 'On one shirt from the club store', cost: 600, icon: 'shirt', apply: { kind: 'store', type: 'print' } },
  { id: 'ex-photo', cat: 'exp', title: 'Pitch-side photo', body: 'A draw entry: a photo at pitch level before a home match', cost: 1000, icon: 'camera', draw: true },
  { id: 'ex-training', cat: 'exp', title: 'Watch training', body: 'A draw entry: watch a first-team training session', cost: 1500, icon: 'whistle', draw: true },
  { id: 'ex-meet', cat: 'exp', title: 'Meet a player', body: 'A draw entry: meet a first-team player', cost: 3000, icon: 'star', draw: true },
  { id: 'ex-mascot', cat: 'exp', title: 'Mascot walk-out', body: 'A draw entry: your child walks out with the team', cost: 4000, icon: 'kid', draw: true },
  ...AVATAR_ITEMS.filter((a) => !a.pass).map((a) => ({ id: a.id, cat: 'avatar', title: a.name, body: a.sub, cost: a.cost, icon: a.slot, avatar: true })),
];
const byId = (id) => CATALOG.find((x) => x.id === id);

const RW_ICON = {
  ticket: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z M14 7v10"/>',
  clock: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 7v5l3 2"/>',
  up: '<path d="M12 19V6 M6 12l6-6 6 6 M5 21h14"/>',
  bag: '<path d="M4 8h16l-1.5 12h-13z M8 8a4 4 0 0 1 8 0"/>',
  shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v12H3z M12 13m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0"/>',
  whistle: '<path d="M14 9h7v4h-4.2A6 6 0 1 1 11 7h3z M8 13h.01"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  kid: '<path d="M12 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M6 21l2-8h8l2 8 M8 13l-3-3 M16 13l3-3"/>',
  kit: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z"/>',
  scarf: '<path d="M4 6c5 3 11 3 16 0 M4 6v4c5 3 11 3 16 0V6 M8 11v9l2-1 2 1v-8"/>',
  head: '<path d="M4 15a8 8 0 0 1 16 0z M2 15h20 M12 7V4"/>',
  gift: '<path d="M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7c-2-4-6-3-5 0 M12 7c2-4 6-3 5 0"/>',
};
export const rwIcon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${RW_ICON[k] || RW_ICON.gift}</svg>`;
// the Claws mark: three claw slashes (used by the chip, the pop-up and every price)
export const CLAW_SVG = '<svg class="ec-claw" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20C7 13 9 8 13 4 M11 21c1-6 3-10 7-13 M16 21c.6-3.5 2-6 4.5-8"/></svg>';

/* ── coupons ── */
const PREFIX = { ticket: 'TKT', store: 'STR', exp: 'DRW', avatar: 'AVT' };
const newCode = (r) => `ITT-${PREFIX[r.cat]}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
export const myCoupons = () => st.coupons.map((c) => ({ ...c, r: byId(c.id) })).filter((c) => c.r);
export const couponsFor = (kind) => myCoupons().filter((c) => !c.usedOn && c.r.apply?.kind === kind);
export function useCoupon(code, orderNo) {
  const c = st.coupons.find((x) => x.code === code); if (!c || c.usedOn) return false;
  c.usedOn = orderNo || 'used'; c.usedAt = Date.now(); changed();
  fanEvent('coupon-used', { id: c.id, code });
  return true;
}
/** ctx for tickets: { tickets: [{ price, matchSlug, cat }], tiers: TIERS } · for the store: { subtotal, lines: [{ print }] } */
export function couponValue(c, ctx = {}) {
  const a = c.r?.apply || c.apply; if (!a) return { amount: 0, label: '' };
  if (a.type === 'pct') {
    const t = (ctx.tickets || []).reduce((s, x) => s + x.price, 0);
    return { amount: Math.min(a.max || Infinity, Math.round(t * a.v) / 100), label: `${a.v}% off the tickets` };
  }
  if (a.type === 'upgrade') {
    // the priciest ticket is charged at the next category down's price for that match
    let best = { amount: 0, label: 'Seat upgrade · no lower category to price it from' };
    for (const t of ctx.tickets || []) {
      const cats = (ctx.tiers?.[t.matchSlug] || []).filter((x) => x.price < t.price).sort((x, y) => y.price - x.price);
      if (cats[0] && t.price - cats[0].price > best.amount) best = { amount: t.price - cats[0].price, label: `Seat upgrade · ${t.cat} at the ${cats[0].name} price` };
    }
    return best;
  }
  if (a.type === 'off') {
    const ok = (ctx.subtotal || 0) >= (a.min || 0);
    return { amount: ok ? a.v : 0, label: ok ? `SAR ${a.v} off` : `SAR ${a.v} off · needs an order of SAR ${a.min}` };
  }
  if (a.type === 'print') {
    const has = (ctx.lines || []).some((l) => l.print);
    return { amount: 0, label: has ? 'Name & number printing covered' : 'Name & number printing · add a printed shirt' };
  }
  return { amount: 0, label: '' };
}

/* ── redeem ── */
function redeem(id) {
  const r = byId(id); if (!r) return null;
  if (r.avatar && owns(id)) return null;
  if (!claws.spend(r.cost, `Reward: ${r.title}`)) return null;
  let code = null;
  if (r.avatar) { st.items.push(id); } else { code = newCode(r); st.coupons.unshift({ code, id, at: Date.now(), usedOn: null }); }
  changed();
  progress.achieve('redeem');
  fanEvent('redeem', { id, cat: r.cat, cost: r.cost, code });
  return { r, code };
}

/* ── the shop, inside the Packs page (packs.js) ── */
let cat = 'all', sheet = null;   // sheet: { id, step: 'confirm' | 'done', code }
const useLine = (r) => r.apply?.kind === 'ticket' ? 'Apply it at checkout when you book tickets.'
  : r.apply?.kind === 'store' ? 'Apply it at checkout in the club store.'
  : r.draw ? "You're in the draw. If you're picked, you'll hear about it here before the match."
  : r.avatar ? 'Yours to wear on your fan avatar.' : (r.use || 'Keep the code.');
const card = (r) => {
  const bal = claws.balance, have = r.avatar && owns(r.id), short = r.cost - bal;
  return `<article class="ec-rw${have ? ' is-owned' : ''}"><span class="ec-rw__ic">${rwIcon(r.icon)}</span>
    <b>${esc(r.title)}</b><em>${esc(r.body)}</em>
    <strong class="ec-price">${CLAW_SVG}${n0(r.cost)}</strong>
    ${have ? '<button type="button" class="pk-btn is-ghost" disabled>Owned</button>'
      : `<button type="button" class="pk-btn${short > 0 ? ' is-ghost' : ''}" data-act="rw-pick" data-id="${esc(r.id)}" ${short > 0 ? 'aria-disabled="true"' : ''}>${short > 0 ? `${n0(short)} to go` : 'Redeem'}</button>`}</article>`;
};
const mine = () => {
  const cs = myCoupons(), items = AVATAR_ITEMS.filter((a) => owns(a.id));
  if (!cs.length && !items.length) return '<p class="ec-empty">Nothing redeemed yet. Rewards you redeem, and their codes, are kept here.</p>';
  return `<div class="ec-mine">${cs.map((c) => `<article class="ec-cp${c.usedOn ? ' is-used' : ''}"><span class="ec-rw__ic">${rwIcon(c.r.icon)}</span>
      <div><b>${esc(c.r.title)}</b><em>${esc(c.usedOn ? (c.r.draw ? 'Entered' : `Used · order ${c.usedOn}`) : useLine(c.r))}</em></div><code>${esc(c.code)}</code></article>`).join('')}
    ${items.length ? `<p class="ec-sub">Avatar wardrobe</p><div class="ec-wear">${items.map((a) => `<span class="ec-wear__i">${rwIcon(a.slot)}<b>${esc(a.name)}</b></span>`).join('')}</div>` : ''}</div>`;
};
const sheetHTML = () => {
  if (!sheet) return '';
  const r = byId(sheet.id); if (!r) return '';
  if (sheet.step === 'done') {
    return `<div class="ec-sheet" role="dialog" aria-label="Reward redeemed"><div class="ec-sheet__card is-done">
      <span class="ec-sheet__tick" aria-hidden="true">✓</span><h3>Redeemed</h3><p class="ec-sheet__t">${esc(r.title)}</p>
      ${sheet.code ? `<p class="ec-code"><span>Your code</span><code>${esc(sheet.code)}</code></p>` : ''}
      <p class="ec-sheet__p">${esc(useLine(r))}</p>
      <p class="ec-sheet__bal">Balance ${CLAW_SVG}<b>${n0(claws.balance)}</b></p>
      <div class="ec-sheet__btns"><button type="button" class="pk-btn" data-act="rw-close">Done</button><button type="button" class="pk-btn is-ghost" data-act="rw-mine">My rewards</button></div></div></div>`;
  }
  return `<div class="ec-sheet" role="dialog" aria-label="Redeem ${esc(r.title)}"><div class="ec-sheet__card">
    <span class="ec-rw__ic is-big">${rwIcon(r.icon)}</span><h3>Redeem?</h3><p class="ec-sheet__t">${esc(r.title)}</p><p class="ec-sheet__p">${esc(r.body)}</p>
    <dl class="ec-sheet__sum"><div><dt>Cost</dt><dd>${CLAW_SVG}${n0(r.cost)}</dd></div><div><dt>Balance after</dt><dd>${CLAW_SVG}${n0(claws.balance - r.cost)}</dd></div></dl>
    <div class="ec-sheet__btns"><button type="button" class="pk-btn" data-act="rw-yes">Redeem · ${n0(r.cost)}</button><button type="button" class="pk-btn is-ghost" data-act="rw-close">Cancel</button></div></div></div>`;
};
/** the shop's markup (gifts: the Packs page's own welcome-gift cards, shown first while any are unclaimed) */
export function shopHTML({ gifts = '' } = {}) {
  const tabs = [['all', 'All'], ...CATS, ['mine', 'My rewards']];
  const list = cat === 'mine' ? mine() : `<div class="ec-grid">${CATALOG.filter((r) => cat === 'all' || r.cat === cat).map(card).join('')}</div>`;
  const nMine = myCoupons().filter((c) => !c.usedOn).length;
  return `<section class="ec-shop">
    <header class="ec-shop__hd"><nav class="ec-cats" aria-label="Reward categories">${tabs.map(([k, l]) => `<button type="button" class="${cat === k ? 'is-on' : ''}" data-act="rw-cat" data-k="${k}" aria-pressed="${cat === k}">${esc(l)}${k === 'mine' && nMine ? `<i>${nMine}</i>` : ''}</button>`).join('')}</nav></header>
    ${gifts && cat === 'all' ? gifts : ''}
    ${list}
    <p class="ec-fine">Earn Claws with daily missions, match-week missions, the Fan Pass, mini-games and predictions. Rewards and draws are run in this app; codes are kept on this device.</p>
    ${sheetHTML()}</section>`;
}
/** handles a click inside the shop; returns true when it was the shop's (then re-render) */
export function shopClick(b) {
  const a = b?.dataset?.act; if (!a || !a.startsWith('rw-')) return false;
  if (a === 'rw-cat') { cat = b.dataset.k; sheet = null; feel.tap(); return true; }
  if (a === 'rw-pick') {
    const r = byId(b.dataset.id); if (!r) return true;
    if (claws.balance < r.cost) { feel.back(); feel.pop(`${n0(r.cost - claws.balance)} MORE CLAWS`, { y: innerHeight * 0.3 }); return false; }
    feel.tap(); sheet = { id: r.id, step: 'confirm' }; return true;
  }
  if (a === 'rw-close') { feel.back(); sheet = null; return true; }
  if (a === 'rw-mine') { feel.tap(); sheet = null; cat = 'mine'; return true; }
  if (a === 'rw-yes') {
    const res = sheet && redeem(sheet.id);
    if (!res) { sheet = null; return true; }
    feel.win(); feel.confetti({ n: 120, y: 0.4 });
    sheet = { id: res.r.id, step: 'done', code: res.code };
    return true;
  }
  return false;
}
export const shopSheetOpen = () => !!sheet;
export function closeShopSheet() { sheet = null; }
export function setShopCat(k) { cat = k; sheet = null; }
