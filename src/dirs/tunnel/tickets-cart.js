// Seat booking as an in-app purchase (Ahmed, 2026-10-26: "when I click on book ticket it should add this ticket to
// cart and back to seat selection so the user can pick other seats; after he finishes the seat selection he should
// click on Next, where he will be redirected to cross selling, then checkout"). Here: the basket of seats (up to 6 a
// match), the tickets bar on the seat map, the "Add to your match day" page (club-store products from products.js and
// the season pass), and one checkout for the tickets plus any store items: details → payment → review → done. The
// payment step only picks a method and never asks for card details; no payment is taken. Basket, add-ons and the
// bought tickets live in this browser (localStorage). The bought tickets are shown by my-tickets.js.
import './shop.css';
import './tix.css';
import { PRODUCTS } from './products.js';
import { SQUAD } from './squad.js';
import { PAY as SHOP_PAY, SHIP, CITIES } from './shop.js';
import { feel } from './feel.js';
import { addPurchased, openMyTickets, whenLine } from './my-tickets.js';
import { TIERS } from '../../data.js';
import { couponsFor, couponValue, useCoupon, CLAW_SVG } from './rewards.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sar = (n) => `SAR ${Number(n).toLocaleString('en', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export const MAX_PER_MATCH = 6;
const PAY = SHOP_PAY.filter((m) => m.id !== 'cod');   // tickets are paid up front: no cash on delivery
const APPAREL = ['Jersey', 'T-shirt', 'Hoodie', 'Jacket', 'Joggers'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const sizesOf = (p) => (APPAREL.includes(p.type) ? SIZES : ['One size']);
const canPrint = (p) => ['Jersey', 'T-shirt'].includes(p.type) && !/kids/i.test(p.name);
// the match-day add-ons: the club store's own products (products.js), the kit first
const XSELL = [
  ['home-26-27', 'Your name and number printed free'],
  ['nike-26-27-tee', 'The 26/27 cut, name printing free'],
  ['tifo-aura-hoodie', 'For the evening kick-offs'],
  ['yellow-cap', 'Shield logo · one size'],
  ['ball-yellow', 'Small size, in club yellow'],
];
const prod = (k) => PRODUCTS.find((p) => p.key === k);

/* ── state: the basket of seats, the add-ons, the holder (shared with the store's address book) ── */
let basket = load('itt-tix-basket-v1', []);
let extras = load('itt-tix-extras-v1', []);   // [{ key, size, print: null | { name, no }, qty: 1 }]
let addr = { name: '', phone: '', city: 'Jeddah', district: '', street: '', code: '', ...load('itt-addr-v1', {}) };
const subs = new Set();
const changed = () => { save('itt-tix-basket-v1', basket); save('itt-tix-extras-v1', extras); subs.forEach((f) => f()); renderBar(); };
const total = () => basket.reduce((a, t) => a + t.price, 0);
const xtotal = () => extras.reduce((a, l) => a + l.qty * (prod(l.key)?.price || 0), 0);
const xKey = (l) => `${l.key}|${l.size}|${l.print ? `${l.print.name}#${l.print.no}` : ''}`;
// the basket's matches in the order they were added, each with its seats
const groups = (list = basket) => { const m = new Map(); for (const t of list) { if (!m.has(t.matchSlug)) m.set(t.matchSlug, []); m.get(t.matchSlug).push(t); } return [...m.values()]; };
const seatLine = (t) => `${t.tier} · ${t.block} · Row ${t.row} · Seat ${t.seat}`;

let cfg = { onSeason: null };
export const ticketCart = {
  MAX: MAX_PER_MATCH,
  get items() { return basket.slice(); },
  get count() { return basket.length; },
  get total() { return total(); },
  countFor: (slug) => basket.filter((t) => t.matchSlug === slug).length,
  has: (id) => basket.some((t) => t.id === id),
  /** t: { id, matchSlug, matchLabel, date, venue, stand, tier, block, row, seat, cat, color, price, … } → 'added' | 'dup' | 'full' */
  add(t) {
    if (this.has(t.id)) return 'dup';
    if (this.countFor(t.matchSlug) >= MAX_PER_MATCH) return 'full';
    basket.push(t); changed(); return 'added';
  },
  remove(id) { basket = basket.filter((t) => t.id !== id); changed(); },
  onChange(fn) { subs.add(fn); fn(); return () => subs.delete(fn); },
  init(o) { cfg = { ...cfg, ...o }; },
  mountBar,
  toast,
  openCrossSell,
};

/* ── the tickets bar on the seat map: "N tickets · SAR total", the seats as a small list, and Next ── */
let bar = null, barOpen = false, onNextCb = null, toastT = 0;
function mountBar(host, { onNext } = {}) {
  onNextCb = onNext || (() => openCrossSell());
  bar = document.createElement('div');
  bar.className = 'tc-bar'; bar.hidden = true;
  bar.innerHTML = `<div class="tc-bar__in">
      <div class="tc-bar__list js-tcb-list" id="tc-bar-list" hidden></div>
      <div class="tc-bar__row">
        <button type="button" class="tc-bar__sum js-tcb-sum" aria-expanded="false" aria-controls="tc-bar-list"><span class="js-tcb-n"></span><b class="js-tcb-t"></b><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 8 L6 4 L10 8"/></svg></button>
        <button type="button" class="btn btn--y tc-bar__next js-tcb-next"><span>Next</span></button>
      </div>
    </div>`;
  host.append(bar);
  // the stadium behind it doesn't turn or pick a seat through the bar
  for (const ev of ['pointerdown', 'wheel', 'touchstart', 'click']) bar.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('js-tcb-sum')) { feel.tap(); barOpen = !barOpen; return renderBar(); }
    if (b.classList.contains('js-tcb-next')) { feel.tap(); barOpen = false; renderBar(); return onNextCb?.(); }
    if (b.dataset.rm) { feel.back(); ticketCart.remove(b.dataset.rm); }
  });
  renderBar();
}
function renderBar() {
  if (!bar) return;
  const n = basket.length;
  bar.hidden = !n;
  if (!n) barOpen = false;
  bar.classList.toggle('is-open', barOpen);
  bar.querySelector('.js-tcb-n').textContent = plural(n, 'ticket');
  bar.querySelector('.js-tcb-t').textContent = sar(total());
  bar.querySelector('.js-tcb-sum').setAttribute('aria-expanded', String(barOpen));
  const list = bar.querySelector('.js-tcb-list');
  list.hidden = !barOpen;
  list.innerHTML = groups().map((g) => `<p class="tc-bar__m">${esc(g[0].matchLabel)} <span>${esc(plural(g.length, 'ticket'))}</span></p>
    <ul>${g.map((t) => `<li><i style="background:${esc(t.color)}"></i><span><b>${esc(t.stand)}</b> ${esc(seatLine(t))}</span><em><span class="tc-bar__cat">${esc(t.cat)} · </span>${sar(t.price)}</em>
      <button type="button" class="tc-bar__rm" data-rm="${esc(t.id)}" aria-label="Remove ${esc(t.block)} row ${esc(t.row)} seat ${esc(t.seat)}">✕</button></li>`).join('')}</ul>`).join('');
}
function toast(msg) {
  if (!bar) return;
  let el = bar.parentElement.querySelector('.tc-toast');
  if (!el) { el = document.createElement('p'); el.className = 'tc-toast'; el.setAttribute('role', 'status'); bar.parentElement.append(el); }
  el.textContent = msg; el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 3200);
}

/* ── one overlay root (the store's page look, shop.css); screens swap inside it ── */
let root = null;
function mount() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'sh tc'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Tickets checkout');
  document.body.append(root);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown', 'keyup']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  return root;
}
// a header that stays put, a body that scrolls under it, and an optional action row pinned at the bottom
function screen(head, body, foot = '', cls = '') {
  mount();
  root.hidden = false;
  root.innerHTML = `<div class="sh__panel ${cls}">${head}<div class="sh__body">${body}</div>${foot ? `<div class="tc-foot">${foot}</div>` : ''}</div>`;
  requestAnimationFrame(() => root.classList.add('is-on'));
}
function close() {
  if (!root || root.hidden) return;
  root.classList.remove('is-on');
  setTimeout(() => { if (!root.classList.contains('is-on')) { root.hidden = true; root.innerHTML = ''; } }, 250);
}
const head = (title, back, chip = true) => `<header class="sh__hd">
  ${back ? `<button type="button" class="sh__back" data-act="${back}" aria-label="Back">Back</button>` : ''}
  <div class="sh__ht"><h2>${esc(title)}</h2></div>
  ${chip && basket.length ? `<p class="tc-chip"><span>${esc(plural(basket.length, 'ticket'))}${extras.length ? ` + ${esc(plural(extras.length, 'item'))}` : ''}</span><b>${sar(total() + xtotal())}</b></p>` : ''}
</header>`;
const steps = (n) => `<ol class="sh__steps">${['Details', 'Payment', 'Review'].map((s, i) => `<li class="${i < n ? 'is-done' : i === n ? 'is-on' : ''}"><i>${i < n ? '✓' : i + 1}</i>${s}</li>`).join('')}</ol>`;

/* ── 1 · cross-selling: "Add to your match day" ── */
let pick = null;   // the size / name sheet for one product: { p, size, wantPrint, print: { name, no }, err }
function seasonInBasket() { return basket.some((t) => t.season); }
export function openCrossSell() {
  if (!basket.length) return;
  renderCross();
}
function renderCross() {
  const has = (k) => extras.find((l) => l.key === k);
  const tiles = XSELL.map(([k, sub]) => {
    const p = prod(k); if (!p) return '';
    const l = has(k);
    return `<article class="tc-x ${l ? 'is-added' : ''}"><img src="${esc(p.img)}" alt=""/>
      <div class="tc-x__b"><span class="tc-x__k">${esc(p.type)}</span><b>${esc(p.name)}</b>
        <span class="tc-x__s">${l ? esc(lineSub(l)) : esc(sub)}</span>
        <em>${sar(p.price)}${p.was ? ` <s>${sar(p.was)}</s>` : ''}</em></div>
      <button type="button" class="tc-x__btn ${l ? 'is-on' : ''}" data-act="x" data-k="${esc(k)}" aria-pressed="${l ? 'true' : 'false'}">${l ? 'Added ✓' : 'Add'}</button></article>`;
  }).join('');
  const pass = seasonInBasket() ? '' : `<article class="tc-x is-pass"><img src="/img/season-pass.png" alt=""/>
      <div class="tc-x__b"><span class="tc-x__k">Al-Ittihad · Membership</span><b>Tigers Season Pass 26/27</b>
        <span class="tc-x__s">Every home match · from SAR 230</span><em>One seat, the whole season</em></div>
      <button type="button" class="tc-x__btn" data-act="season">See the pass</button></article>`;
  screen(head('Add to your match day', 'map'),
    `<p class="tc-lede">${esc(plural(basket.length, 'ticket'))} in your cart · ${sar(total())}. Add something for the day, or skip to checkout.</p>
     <div class="tc-xgrid">${pass}${tiles}</div>
     ${pick ? pickSheet() : ''}`,
    `<button type="button" class="sh__btn is-2" data-act="skip">Skip</button><button type="button" class="sh__btn" data-act="checkout">Continue to checkout · ${sar(total() + xtotal())}</button>`,
    'is-cross');
}
const lineSub = (l) => `${l.size === 'One size' ? 'One size' : `Size ${l.size}`}${l.print ? ` · ${l.print.name} ${l.print.no}` : ''}`;
function pickSheet() {
  const { p } = pick, printable = canPrint(p);
  return `<div class="tc-pick" role="dialog" aria-label="${esc(p.name)}"><div class="tc-pick__card"><div class="tc-pick__a">
    <div class="tc-pick__top"><img src="${esc(p.img)}" alt=""/><div><b>${esc(p.name)}</b><em>${sar(p.price)}</em></div></div>
    <p class="sh__lab">Size ${pick.size ? `<b>${esc(pick.size)}</b>` : ''}</p>
    <div class="sh__sizes">${sizesOf(p).map((s) => `<button type="button" class="${pick.size === s ? 'is-on' : ''}" data-act="psize" data-s="${s}">${s}</button>`).join('')}</div>
    ${printable ? `<p class="sh__lab tc-pick__gap">Add a name and number?</p>
      <div class="sh__seg"><button type="button" class="${!pick.wantPrint ? 'is-on' : ''}" data-act="pprint" data-v="0">No thanks</button><button type="button" class="${pick.wantPrint ? 'is-on' : ''}" data-act="pprint" data-v="1">Yes, personalise it</button></div>` : ''}
    </div><div class="tc-pick__b">
      ${printable && pick.wantPrint ? `<div class="sh__print">
        <label>Name<input class="js-tc-pn" maxlength="12" value="${esc(pick.print.name)}" placeholder="e.g. AHMED" autocomplete="off"/></label>
        <label class="is-no">Number<input class="js-tc-pno" inputmode="numeric" maxlength="2" value="${esc(pick.print.no)}" placeholder="10" autocomplete="off"/></label>
        <label class="is-player">Or a first-team player<select class="js-tc-pl"><option value="">Choose a player</option>${SQUAD.map((s) => `<option value="${s.no}">${s.no} · ${esc(s.name)}</option>`).join('')}</select></label></div>` : ''}
    ${pick.err ? `<p class="sh__err">${esc(pick.err)}</p>` : ''}
    <div class="sh__ctas"><button type="button" class="sh__btn is-2" data-act="pcancel">Cancel</button><button type="button" class="sh__btn" data-act="padd">Add · ${sar(p.price)}</button></div>
  </div></div></div>`;
}
function addPick() {
  const { p } = pick;
  if (!pick.size) { pick.err = 'Choose a size first'; return false; }
  let print = null;
  if (pick.wantPrint) {
    const name = pick.print.name.trim().toUpperCase(), no = pick.print.no.trim();
    if (!/^[A-Z .'-]{1,12}$/.test(name)) { pick.err = 'Add a name (A–Z, up to 12 letters) or choose "No thanks"'; return false; }
    if (!/^\d{1,2}$/.test(no)) { pick.err = 'Add a number from 0 to 99'; return false; }
    print = { name, no: String(+no) };
  }
  const line = { key: p.key, size: pick.size, print, qty: 1 };
  extras = extras.filter((l) => l.key !== p.key).concat(line);
  changed(); feel.tap();
  return true;
}

/* ── 2 · checkout: details → payment → review ── */
let co = { ship: 'standard', pay: null, coupon: null };
// a ticket perk from the Claws shop (rewards.js) on the review step, as a discount line (2026-10-27)
const tixCoupon = () => couponsFor('ticket').find((c) => c.code === co.coupon) || null;
const tixDiscount = () => { const c = tixCoupon(); return c ? couponValue(c, { tickets: basket, tiers: TIERS }) : { amount: 0, label: '' }; };
const rewardsBlock = () => {
  const cs = couponsFor('ticket'); if (!cs.length) return '';
  return `<div class="ec-apply"><p class="sh__lab">Your rewards</p><div class="ec-apply__l">${cs.map((c) => { const v = couponValue(c, { tickets: basket, tiers: TIERS }); const on = co.coupon === c.code; return `<button type="button" class="ec-apply__o${on ? ' is-on' : ''}" data-act="coupon" data-v="${c.code}" aria-pressed="${on}">${CLAW_SVG}<span><b>${esc(c.r.title)}</b><em>${esc(v.label)}${v.amount ? ` · − ${sar(v.amount)}` : ''}</em></span><i>${on ? 'Applied' : 'Apply'}</i></button>`; }).join('')}</div></div>`;
};
function renderDetails(err = '') {
  const pickup = co.ship === 'pickup';
  screen(head('Checkout', 'cross'), `${steps(0)}
    <div class="sh__form">
      <p class="sh__lab">Ticket holder</p>
      <div class="sh__fields">
        <label>Full name<input class="js-a" data-f="name" value="${esc(addr.name)}" autocomplete="name"/></label>
        <label>Mobile number<div class="sh__tel"><span>+966</span><input class="js-a" data-f="phone" value="${esc(addr.phone)}" inputmode="tel" placeholder="5X XXX XXXX" autocomplete="tel-national"/></div></label>
      </div>
      <p class="sh__fine">Your tickets arrive in My tickets on this phone, and we text the order to this number.</p>
      ${extras.length ? `<p class="sh__lab tc-gap">Your store items · how would you like them?</p>
        <div class="sh__opts">${SHIP.map((s) => `<button type="button" class="sh__opt ${co.ship === s.id ? 'is-on' : ''}" data-act="ship" data-v="${s.id}"><i></i><b>${s.label}</b><span>${s.sub}</span><em>Free</em></button>`).join('')}</div>
        ${pickup ? '' : `<div class="sh__fields">
          <label>City<select class="js-a" data-f="city">${CITIES.map((c) => `<option ${addr.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label>District<input class="js-a" data-f="district" value="${esc(addr.district)}" autocomplete="address-level3"/></label>
          <label class="is-wide">Street and building number<input class="js-a" data-f="street" value="${esc(addr.street)}" autocomplete="street-address"/></label>
          <label>National address short code <small>(optional)</small><input class="js-a" data-f="code" value="${esc(addr.code)}" maxlength="8" placeholder="ABCD1234"/></label></div>`}` : ''}
      ${err ? `<p class="sh__err">${esc(err)}</p>` : ''}
      <div class="sh__ctas"><button type="button" class="sh__btn" data-act="to-pay">Continue to payment</button></div>
    </div>`, '', 'is-checkout');
}
function renderPayment(err = '') {
  screen(head('Checkout', 'details'), `${steps(1)}
    <div class="sh__form">
      <p class="sh__lab">Payment method</p>
      <div class="sh__opts is-pay">${PAY.map((m) => `<button type="button" class="sh__opt ${co.pay === m.id ? 'is-on' : ''}" data-act="pay" data-v="${m.id}"><i></i><b>${m.label}</b><span>${m.sub}</span></button>`).join('')}</div>
      <p class="sh__fine">You confirm with the method you choose. Card numbers are never typed in here.</p>
      ${err ? `<p class="sh__err">${esc(err)}</p>` : ''}
      <div class="sh__ctas"><button type="button" class="sh__btn" data-act="to-review">Review order</button></div>
    </div>`, '', 'is-checkout');
}
function renderReview() {
  const pay = PAY.find((m) => m.id === co.pay), ship = SHIP.find((s) => s.id === co.ship), disc = tixDiscount(), all = total() + xtotal() - disc.amount;
  const tix = groups().map((g) => `<section class="tc-rg"><p class="tc-rg__h"><b>${esc(g[0].matchLabel)}</b><span>${esc(whenLine(g[0]))}</span></p>
    <ul class="tc-rl">${g.map((t) => `<li><i style="background:${esc(t.color)}"></i><span><b>${esc(t.stand)}</b>${esc(seatLine(t))}</span><em>${esc(t.cat)}</em><strong>${sar(t.price)}</strong></li>`).join('')}</ul></section>`).join('');
  const items = extras.length ? `<section class="tc-rg"><p class="tc-rg__h"><b>Club store</b><span>${esc(plural(extras.length, 'item'))}</span></p>
    <ul class="sh__lines is-ro">${extras.map((l) => { const p = prod(l.key); return p ? `<li class="sh__line"><img src="${esc(p.img)}" alt=""/><div><b>${esc(p.name)}</b><span>${esc(lineSub(l))}</span></div><em>${sar(p.price * l.qty)}</em></li>` : ''; }).join('')}</ul></section>` : '';
  screen(head('Checkout', 'payment'), `${steps(2)}
    <div class="sh__review">
      ${tix}${items}
      <div class="sh__cards">
        <div><p class="sh__lab">Ticket holder</p><p>${esc(addr.name)} · +966 ${esc(addr.phone)}</p><button type="button" class="sh__link" data-act="details">Change</button></div>
        ${extras.length ? `<div><p class="sh__lab">Store items</p><p>${esc(ship.label)}</p><p class="sh__fine">${co.ship === 'pickup' ? 'Alinma Stadium store' : `${esc(addr.street)}, ${esc(addr.district)}, ${esc(addr.city)}`}</p></div>` : ''}
        <div><p class="sh__lab">Payment</p><p>${esc(pay.label)}</p><button type="button" class="sh__link" data-act="payment">Change</button></div>
      </div>
      ${rewardsBlock()}
      <div class="sh__sum"><p><span>Tickets · ${basket.length}</span><b>${sar(total())}</b></p>${tixCoupon() ? `<p class="ec-disc"><span>${esc(disc.label)}</span><b>− ${sar(disc.amount)}</b></p>` : ''}
        ${extras.length ? `<p><span>Store items · ${extras.length}</span><b>${sar(xtotal())}</b></p><p><span>Delivery</span><b>Free</b></p>` : ''}
        <p class="is-total"><span>Total</span><b>${sar(all)}</b></p>
        <button type="button" class="sh__btn" data-act="place">Pay ${sar(all)}</button></div>
    </div>`, '', 'is-checkout');
}
function placeOrder() {
  const disc = tixDiscount(), cp = tixCoupon();
  const no = `ITT-${String(Date.now()).slice(-6)}`, at = Date.now(), all = total() + xtotal() - disc.amount;
  if (cp) useCoupon(cp.code, no);
  co.coupon = null;
  const pay = PAY.find((m) => m.id === co.pay), ship = SHIP.find((s) => s.id === co.ship);
  const bought = basket.map((t, i) => ({ ...t, id: `${no}-${i + 1}`, seatId: t.id, orderNo: no, holder: addr.name.trim(), at }));
  addPurchased(bought);
  const orders = load('itt-tix-orders-v1', []);
  orders.push({ no, at, total: all, discount: cp ? { code: cp.code, label: disc.label, amount: disc.amount } : null, pay: co.pay, tickets: bought.map((t) => t.id), items: extras, ship: extras.length ? co.ship : null, addr: { ...addr } });
  save('itt-tix-orders-v1', orders);
  const nT = basket.length, nX = extras.length, first = addr.name.trim().split(' ')[0];
  basket = []; extras = []; changed();
  feel.win(); feel.confetti(); feel.roar();
  screen('', `<div class="sh__done">
      <div class="sh__tick">✓</div><h2>You're going${first ? `, ${esc(first)}` : ''}!</h2>
      <p class="sh__ono">Order <b>${no}</b> · ${sar(all)} · ${esc(pay.label)}</p>
      <p>${esc(plural(nT, 'ticket'))} ${nT === 1 ? 'is' : 'are'} in My tickets. Show the code at the gate on match day.</p>
      ${nX ? `<p>${esc(plural(nX, 'store item'))}: ${co.ship === 'pickup' ? 'ready at the Alinma Stadium store in 24 hours.' : `${esc(ship.label.toLowerCase())} to ${esc(addr.city)}, ${esc(ship.sub)}.`}</p>` : ''}
      <div class="sh__ctas"><button type="button" class="sh__btn" data-act="mine">View my tickets</button><button type="button" class="sh__btn is-2" data-act="close">Back to the stadium</button></div>
    </div>`, '', 'is-done');
}

/* ── events ── */
function onInput(e) {
  const t = e.target;
  if (t.classList.contains('js-a')) { addr[t.dataset.f] = t.value; save('itt-addr-v1', { ...load('itt-addr-v1', {}), ...addr }); }
  if (!pick) return;
  if (t.classList.contains('js-tc-pn')) { t.value = t.value.toUpperCase().replace(/[^A-Z .'-]/g, ''); pick.print.name = t.value; }
  if (t.classList.contains('js-tc-pno')) { t.value = t.value.replace(/\D/g, '').slice(0, 2); pick.print.no = t.value; }
  if (t.classList.contains('js-tc-pl') && t.value) {
    const s = SQUAD.find((x) => String(x.no) === t.value);
    if (s) { pick.print = { name: (s.shirt || s.name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z .'-]/g, '').slice(0, 12), no: String(s.no) }; renderCross(); }
  }
}
function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (b.classList.contains('sh__back') || a === 'close' || a === 'pcancel') feel.back(); else feel.tap();
  if (a === 'map' || a === 'close') { pick = null; return close(); }
  if (a === 'cross') return renderCross();
  if (a === 'x') {
    const p = prod(b.dataset.k);
    if (extras.some((l) => l.key === p.key)) { extras = extras.filter((l) => l.key !== p.key); changed(); return renderCross(); }
    if (sizesOf(p).length === 1 && !canPrint(p)) { extras.push({ key: p.key, size: 'One size', print: null, qty: 1 }); changed(); feel.pop('ADDED', { x: e.clientX, y: e.clientY - 30 }); return renderCross(); }
    pick = { p, size: null, wantPrint: false, print: { name: '', no: '' }, err: '' };
    return renderCross();
  }
  if (a === 'psize') { pick.size = b.dataset.s; pick.err = ''; return renderCross(); }
  if (a === 'pprint') { pick.wantPrint = b.dataset.v === '1'; pick.err = ''; return renderCross(); }
  if (a === 'pcancel') { pick = null; return renderCross(); }
  if (a === 'padd') { if (addPick()) pick = null; return renderCross(); }
  if (a === 'season') { pick = null; close(); return cfg.onSeason?.(() => renderCross()); }
  if (a === 'skip') { pick = null; if (extras.length) { extras = []; changed(); } return renderDetails(); }
  if (a === 'checkout' || a === 'details') { pick = null; return renderDetails(); }
  if (a === 'ship') { co.ship = b.dataset.v; return renderDetails(); }
  if (a === 'to-pay') {
    if (!addr.name.trim()) return renderDetails('Add the ticket holder\'s full name');
    if (!/^5\d{8}$/.test(addr.phone.replace(/\s/g, ''))) return renderDetails('Add a Saudi mobile number: 9 digits starting with 5');
    if (extras.length && co.ship !== 'pickup' && (!addr.district.trim() || !addr.street.trim())) return renderDetails('Add the district and the street and building number for the store items');
    return renderPayment();
  }
  if (a === 'payment') return renderPayment();
  if (a === 'pay') { co.pay = b.dataset.v; return renderPayment(); }
  if (a === 'to-review') { if (!co.pay) return renderPayment('Choose a payment method'); return renderReview(); }
  if (a === 'coupon') { co.coupon = co.coupon === b.dataset.v ? null : b.dataset.v; return renderReview(); }
  if (a === 'place') { if (!basket.length) return close(); return placeOrder(); }
  if (a === 'mine') { const r = root; openMyTickets({ onFind: cfg.onFindMatch }); setTimeout(() => { if (r === root) close(); }, 260); }
}
export const ticketsCheckoutOpen = () => !!root && !root.hidden;
