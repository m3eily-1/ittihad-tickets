// The club store, end to end (Ahmed, 2026-10-21: "select a t-shirt → size, name on it or not, add to cart, buy it
// with a payment method and a delivery address — the full journey"). Product sheet → cart → checkout (delivery,
// payment, review) → order confirmation. It's a demo: products and prices are the store snapshot in products.js;
// stock, delivery options and order numbers are made up here, and no payment is taken — the payment step only
// picks a method and never asks for card details. Cart and orders live in this browser (localStorage).
import './shop.css';
import { PRODUCTS } from './products.js';
import { SQUAD } from './squad.js';
import { progress } from './progress.js';
import { feel } from './feel.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sar = (n) => `SAR ${Number(n).toLocaleString('en', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const APPAREL = ['Jersey', 'T-shirt', 'Hoodie', 'Jacket', 'Joggers'];
const PRINTABLE = ['Jersey', 'T-shirt'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const sizesOf = (p) => (APPAREL.includes(p.type) ? SIZES : ['One size']);
const canPrint = (p) => PRINTABLE.includes(p.type) && !/kids/i.test(p.name);
const CITIES = ['Jeddah', 'Riyadh', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Taif', 'Tabuk', 'Abha', 'Buraidah', 'Hail', 'Jazan', 'Najran', 'Yanbu', 'Al Ahsa'];
const PAY = [
  { id: 'applepay', label: 'Apple Pay', sub: 'Pay with Face ID or Touch ID' },
  { id: 'mada', label: 'mada', sub: 'Saudi debit card' },
  { id: 'card', label: 'Credit card', sub: 'Visa · Mastercard' },
  { id: 'stcpay', label: 'STC Pay', sub: 'Pay from your STC Pay wallet' },
  { id: 'tabby', label: 'Tabby', sub: 'Split into 4 payments' },
  { id: 'cod', label: 'Cash on delivery', sub: 'Pay when it arrives' },
];
const SHIP = [
  { id: 'standard', label: 'Standard delivery', sub: '3–5 working days' },
  { id: 'express', label: 'Express delivery', sub: '1–2 working days' },
  { id: 'pickup', label: 'Pick up at the stadium store', sub: 'Alinma Stadium, ready in 24 hours' },
];

/* ── state ── */
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
let cart = load('itt-cart-v1', []);
let addr = load('itt-addr-v1', { name: '', phone: '', city: 'Jeddah', district: '', street: '', code: '' });
const listeners = new Set();
const changed = () => { save('itt-cart-v1', cart); listeners.forEach((f) => f(count())); };
const count = () => cart.reduce((a, l) => a + l.qty, 0);
const subtotal = () => cart.reduce((a, l) => a + l.qty * (PRODUCTS.find((p) => p.key === l.key)?.price || 0), 0);
const lineKey = (l) => `${l.key}|${l.size}|${l.print ? `${l.print.name}#${l.print.no}` : ''}`;

/* ── one overlay root; screens swap inside it ── */
let root = null, onCloseCb = null;
function mount() {
  if (root) return root;
  root = document.createElement('div');
  root.className = 'sh'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  document.body.append(root);
  // nothing in here should walk you round the room or scroll the page
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown', 'keyup']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') close(); }, { passive: true });
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  return root;
}
function screen(html, cls = '') {
  mount();
  root.hidden = false;
  root.innerHTML = `<div class="sh__panel ${cls}">${html}</div>`;
  requestAnimationFrame(() => root.classList.add('is-on'));
  root.querySelector('.sh__panel').scrollTop = 0;
}
function close() {
  if (!root || root.hidden) return;
  feel.back();
  root.classList.remove('is-on');
  setTimeout(() => { root.hidden = true; root.innerHTML = ''; }, 250);
  onCloseCb?.(); onCloseCb = null;
}
const head = (title, kick, back) => `<header class="sh__hd">
  ${back ? `<button type="button" class="sh__back" data-act="${back}">← Back</button>` : ''}
  <div class="sh__ht"><p class="sh__k">${esc(kick)}</p><h2>${esc(title)}</h2></div>
  <button type="button" class="sh__cartbtn" data-act="cart" aria-label="Cart">${cartIcon}<b>${count()}</b></button>
  <button type="button" class="sh__x" data-act="close" aria-label="Close">✕</button></header>`;
const cartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>';
const steps = (n) => `<ol class="sh__steps">${['Delivery', 'Payment', 'Review'].map((s, i) => `<li class="${i < n ? 'is-done' : i === n ? 'is-on' : ''}"><i>${i < n ? '✓' : i + 1}</i>${s}</li>`).join('')}</ol>`;

/* ── 1 · product ── */
let pick = null;   // { p, size, print: null | { name, no }, wantPrint, qty, view }
export function openProduct(product, { onClose, print = null } = {}) {
  const p = typeof product === 'string' ? PRODUCTS.find((x) => x.key === product) : PRODUCTS.find((x) => x.key === product.key) || product;
  if (!p) return;
  if (onClose) onCloseCb = onClose;
  // print: a name and number to start from (the locker room's 'buy this shirt')
  pick = { p, size: sizesOf(p).length === 1 ? sizesOf(p)[0] : null, wantPrint: !!print && canPrint(p), print: print ? { name: String(print.name || ''), no: String(print.no ?? '') } : { name: '', no: '' }, qty: 1, view: print && canPrint(p) ? 'back' : 'front' };
  renderProduct();
}
function renderProduct(err = '') {
  const { p } = pick, printable = canPrint(p);
  screen(`${head(p.type, 'Club store', 'catalog')}
    <div class="sh__prod">
      <div class="sh__media">
        ${pick.view === 'back' ? `<div class="sh__back3"><img src="/img/jersey/back.webp" alt="The back of the shirt"/><b class="sh__pn js-sh-pn">${esc(pick.print.name || 'YOUR NAME')}</b><b class="sh__pno js-sh-pno">${esc(pick.print.no || '00')}</b></div>`
          : `<img class="sh__img" src="${esc(p.img)}" alt="${esc(p.name)}"/>`}
        ${printable ? `<div class="sh__views"><button type="button" class="${pick.view === 'front' ? 'is-on' : ''}" data-act="view" data-v="front">Product</button><button type="button" class="${pick.view === 'back' ? 'is-on' : ''}" data-act="view" data-v="back">Your name on the back</button></div>` : ''}
      </div>
      <div class="sh__info">
        <h3 class="sh__name">${esc(p.name)}</h3>
        <p class="sh__price">${sar(p.price)}${p.was ? ` <s>${sar(p.was)}</s> <em>Sale</em>` : ''}</p>
        <div class="sh__group"><p class="sh__lab">Size ${pick.size ? `<b>${esc(pick.size)}</b>` : ''}</p>
          <div class="sh__sizes">${sizesOf(p).map((s) => `<button type="button" class="${pick.size === s ? 'is-on' : ''}" data-act="size" data-s="${s}">${s}</button>`).join('')}</div></div>
        ${printable ? `<div class="sh__group"><p class="sh__lab">Add a name and number?</p>
          <div class="sh__seg"><button type="button" class="${!pick.wantPrint ? 'is-on' : ''}" data-act="print" data-v="0">No thanks</button><button type="button" class="${pick.wantPrint ? 'is-on' : ''}" data-act="print" data-v="1">Yes, personalise it</button></div>
          ${pick.wantPrint ? `<div class="sh__print">
            <label>Name<input class="js-sh-name" maxlength="12" value="${esc(pick.print.name)}" placeholder="e.g. AHMED" autocomplete="off"/></label>
            <label class="is-no">Number<input class="js-sh-no" inputmode="numeric" maxlength="2" value="${esc(pick.print.no)}" placeholder="10" autocomplete="off"/></label>
            <label class="is-player">Or a first-team player<select class="js-sh-player"><option value="">Choose a player</option>${SQUAD.map((s) => `<option value="${s.no}">${s.no} · ${esc(s.name)}</option>`).join('')}</select></label>
            <p class="sh__fine">Up to 12 letters (A–Z) and a number from 0 to 99. Printing is free in this demo.</p></div>` : ''}</div>` : ''}
        <div class="sh__group sh__qtyrow"><p class="sh__lab">Quantity</p><div class="sh__qty"><button type="button" data-act="qty" data-d="-1" aria-label="Fewer">−</button><b>${pick.qty}</b><button type="button" data-act="qty" data-d="1" aria-label="More">+</button></div></div>
        ${err ? `<p class="sh__err">${esc(err)}</p>` : ''}
        <div class="sh__ctas"><button type="button" class="sh__btn" data-act="add">Add to cart · ${sar(p.price * pick.qty)}</button><button type="button" class="sh__btn is-2" data-act="buy">Buy now</button></div>
        <p class="sh__fine">Demo store: prices from the club store snapshot; stock isn't checked.</p>
      </div>
    </div>`, 'is-product');
}
function addPick() {
  const { p } = pick;
  if (!pick.size) { renderProduct('Choose a size first'); return false; }
  let print = null;
  if (pick.wantPrint) {
    const name = pick.print.name.trim().toUpperCase(), no = pick.print.no.trim();
    if (!name || !/^[A-Z .'-]{1,12}$/.test(name)) { renderProduct('Add a name (A–Z, up to 12 letters) or choose "No thanks"'); return false; }
    if (!/^\d{1,2}$/.test(no)) { renderProduct('Add a number from 0 to 99'); return false; }
    print = { name, no: String(+no) };
  }
  const line = { key: p.key, size: pick.size, print, qty: pick.qty };
  const same = cart.find((l) => lineKey(l) === lineKey(line));
  if (same) same.qty = Math.min(9, same.qty + line.qty); else cart.push(line);
  changed(); feel.xp && feel.pop('ADDED TO CART', { y: innerHeight * 0.18 }); feel.tap();
  return true;
}

/* ── catalog: every product in the store ── */
function renderCatalog() {
  screen(`${head('Club store', 'All products')}
    <div class="sh__grid">${PRODUCTS.map((p) => `<button type="button" class="sh__tile" data-act="open" data-k="${esc(p.key)}"><img src="${esc(p.img)}" alt=""/><span>${esc(p.type)}</span><b>${esc(p.name)}</b><em>${sar(p.price)}${p.was ? ` <s>${sar(p.was)}</s>` : ''}</em></button>`).join('')}</div>`, 'is-catalog');
}
export function openCatalog({ onClose } = {}) { if (onClose) onCloseCb = onClose; renderCatalog(); }

/* ── 2 · cart ── */
function renderCart() {
  const lines = cart.map((l, i) => { const p = PRODUCTS.find((x) => x.key === l.key); if (!p) return ''; return `<li class="sh__line"><img src="${esc(p.img)}" alt=""/>
    <div><b>${esc(p.name)}</b><span>Size ${esc(l.size)}${l.print ? ` · ${esc(l.print.name)} ${esc(l.print.no)}` : ''}</span><em>${sar(p.price)}</em></div>
    <div class="sh__qty is-sm"><button type="button" data-act="lq" data-i="${i}" data-d="-1" aria-label="Fewer">−</button><b>${l.qty}</b><button type="button" data-act="lq" data-i="${i}" data-d="1" aria-label="More">+</button></div>
    <button type="button" class="sh__rm" data-act="rm" data-i="${i}" aria-label="Remove">Remove</button></li>`; }).join('');
  screen(`${head('Your cart', `${count()} item${count() === 1 ? '' : 's'}`, 'catalog')}
    ${cart.length ? `<ul class="sh__lines">${lines}</ul>
      <div class="sh__sum"><p><span>Subtotal</span><b>${sar(subtotal())}</b></p><p class="sh__fine">Delivery is chosen at checkout (free in this demo).</p>
      <button type="button" class="sh__btn" data-act="checkout">Checkout</button><button type="button" class="sh__btn is-2" data-act="catalog">Keep shopping</button></div>`
      : `<div class="sh__empty"><p>Your cart is empty.</p><button type="button" class="sh__btn" data-act="catalog">Browse the store</button></div>`}`, 'is-cart');
}
export function openCart({ onClose } = {}) { if (onClose) onCloseCb = onClose; renderCart(); }

/* ── 3 · checkout: delivery → payment → review ── */
let order = { ship: 'standard', pay: null };
function renderDelivery(err = '') {
  const pickup = order.ship === 'pickup';
  screen(`${head('Checkout', 'Step 1 of 3', 'cart')}${steps(0)}
    <div class="sh__form">
      <p class="sh__lab">How would you like it?</p>
      <div class="sh__opts">${SHIP.map((s) => `<button type="button" class="sh__opt ${order.ship === s.id ? 'is-on' : ''}" data-act="ship" data-v="${s.id}"><i></i><b>${s.label}</b><span>${s.sub}</span><em>Free (demo)</em></button>`).join('')}</div>
      <p class="sh__lab">${pickup ? 'Who is picking it up?' : 'Delivery address'}</p>
      <div class="sh__fields">
        <label>Full name<input class="js-a" data-f="name" value="${esc(addr.name)}" autocomplete="name"/></label>
        <label>Mobile number<div class="sh__tel"><span>+966</span><input class="js-a" data-f="phone" value="${esc(addr.phone)}" inputmode="tel" placeholder="5X XXX XXXX" autocomplete="tel-national"/></div></label>
        ${pickup ? '' : `<label>City<select class="js-a" data-f="city">${CITIES.map((c) => `<option ${addr.city === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>District<input class="js-a" data-f="district" value="${esc(addr.district)}" autocomplete="address-level3"/></label>
        <label class="is-wide">Street and building number<input class="js-a" data-f="street" value="${esc(addr.street)}" autocomplete="street-address"/></label>
        <label>National address short code <small>(optional)</small><input class="js-a" data-f="code" value="${esc(addr.code)}" maxlength="8" placeholder="ABCD1234"/></label>`}
      </div>
      ${err ? `<p class="sh__err">${esc(err)}</p>` : ''}
      <div class="sh__ctas"><button type="button" class="sh__btn" data-act="to-pay">Continue to payment</button></div>
    </div>`, 'is-checkout');
}
function renderPayment(err = '') {
  screen(`${head('Checkout', 'Step 2 of 3', 'delivery')}${steps(1)}
    <div class="sh__form">
      <p class="sh__lab">Payment method</p>
      <div class="sh__opts is-pay">${PAY.map((m) => `<button type="button" class="sh__opt ${order.pay === m.id ? 'is-on' : ''}" data-act="pay" data-v="${m.id}"><i></i><b>${m.label}</b><span>${m.sub}</span></button>`).join('')}</div>
      <p class="sh__demo">Demo: no payment is taken, and this store never asks for card numbers. In the real club store you'd pay on the next screen.</p>
      ${err ? `<p class="sh__err">${esc(err)}</p>` : ''}
      <div class="sh__ctas"><button type="button" class="sh__btn" data-act="to-review">Review order</button></div>
    </div>`, 'is-checkout');
}
function renderReview() {
  const ship = SHIP.find((s) => s.id === order.ship), pay = PAY.find((m) => m.id === order.pay);
  screen(`${head('Checkout', 'Step 3 of 3', 'payment')}${steps(2)}
    <div class="sh__review">
      <ul class="sh__lines is-ro">${cart.map((l) => { const p = PRODUCTS.find((x) => x.key === l.key); return `<li class="sh__line"><img src="${esc(p.img)}" alt=""/><div><b>${esc(p.name)}</b><span>Size ${esc(l.size)}${l.print ? ` · ${esc(l.print.name)} ${esc(l.print.no)}` : ''} · ×${l.qty}</span></div><em>${sar(p.price * l.qty)}</em></li>`; }).join('')}</ul>
      <div class="sh__cards">
        <div><p class="sh__lab">${order.ship === 'pickup' ? 'Pick-up' : 'Deliver to'}</p><p>${esc(addr.name)} · +966 ${esc(addr.phone)}</p>${order.ship === 'pickup' ? '<p>Alinma Stadium store</p>' : `<p>${esc(addr.street)}, ${esc(addr.district)}, ${esc(addr.city)}${addr.code ? ` · ${esc(addr.code)}` : ''}</p>`}<button type="button" class="sh__link" data-act="delivery">Change</button></div>
        <div><p class="sh__lab">Delivery</p><p>${esc(ship.label)}</p><p class="sh__fine">${esc(ship.sub)}</p></div>
        <div><p class="sh__lab">Payment</p><p>${esc(pay.label)}</p><button type="button" class="sh__link" data-act="payment">Change</button></div>
      </div>
      <div class="sh__sum"><p><span>Subtotal</span><b>${sar(subtotal())}</b></p><p><span>Delivery</span><b>Free</b></p><p class="is-total"><span>Total</span><b>${sar(subtotal())}</b></p>
        <button type="button" class="sh__btn" data-act="place">Place order</button></div>
    </div>`, 'is-checkout');
}
function placeOrder() {
  const no = `ITT-${String(Date.now()).slice(-6)}`;
  const ord = { no, at: Date.now(), lines: cart, total: subtotal(), ship: order.ship, pay: order.pay, addr: { ...addr } };
  const orders = load('itt-orders-v1', []); orders.push(ord); save('itt-orders-v1', orders);
  const pay = PAY.find((m) => m.id === order.pay), ship = SHIP.find((s) => s.id === order.ship);
  cart = []; changed();
  feel.win(); feel.confetti(); feel.roar();
  progress.achieve('order');
  screen(`<div class="sh__done">
      <div class="sh__tick">✓</div><p class="sh__k">Order placed</p><h2>Thank you, ${esc(addr.name.split(' ')[0] || 'Tiger')}!</h2>
      <p class="sh__ono">Order <b>${no}</b> · ${sar(ord.total)} · ${esc(pay.label)}</p>
      <p>${order.ship === 'pickup' ? 'We\'ll text you when it\'s ready at the Alinma Stadium store.' : `${esc(ship.label)} to ${esc(addr.city)}: ${esc(ship.sub)}.`}</p>
      <p class="sh__demo">Demo order: nothing was charged and nothing will be delivered.</p>
      <div class="sh__ctas"><button type="button" class="sh__btn" data-act="close">Back to the store</button><button type="button" class="sh__btn is-2" data-act="catalog">Keep shopping</button></div>
    </div>`, 'is-done');
}

/* ── events ── */
function onInput(e) {
  const t = e.target;
  if (t.classList.contains('js-sh-name')) { t.value = t.value.toUpperCase().replace(/[^A-Z .'-]/g, ''); pick.print.name = t.value; const el = root.querySelector('.js-sh-pn'); if (el) el.textContent = t.value || 'YOUR NAME'; }
  if (t.classList.contains('js-sh-no')) { t.value = t.value.replace(/\D/g, '').slice(0, 2); pick.print.no = t.value; const el = root.querySelector('.js-sh-pno'); if (el) el.textContent = t.value || '00'; }
  if (t.classList.contains('js-sh-player') && t.value) {
    const s = SQUAD.find((x) => String(x.no) === t.value);
    if (s) { pick.print = { name: (s.shirt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z .'-]/g, '').slice(0, 12), no: String(s.no) }; pick.view = 'back'; renderProduct(); }
  }
  if (t.classList.contains('js-a')) { addr[t.dataset.f] = t.value; save('itt-addr-v1', addr); }
}
function onClick(e) {
  if (e.target === root) { close(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a !== 'close') feel.tap();
  if (a === 'close') return close();
  if (a === 'cart') return renderCart();
  if (a === 'catalog') return renderCatalog();
  if (a === 'open') return openProduct(b.dataset.k);
  if (a === 'view') { pick.view = b.dataset.v; return renderProduct(); }
  if (a === 'size') { pick.size = b.dataset.s; return renderProduct(); }
  if (a === 'print') { pick.wantPrint = b.dataset.v === '1'; if (pick.wantPrint) pick.view = 'back'; else pick.view = 'front'; return renderProduct(); }
  if (a === 'qty') { pick.qty = Math.max(1, Math.min(9, pick.qty + +b.dataset.d)); return renderProduct(); }
  if (a === 'add') { if (addPick()) renderCart(); return; }
  if (a === 'buy') { if (addPick()) renderDelivery(); return; }
  if (a === 'lq') { const l = cart[+b.dataset.i]; l.qty = Math.max(1, Math.min(9, l.qty + +b.dataset.d)); changed(); return renderCart(); }
  if (a === 'rm') { cart.splice(+b.dataset.i, 1); changed(); return renderCart(); }
  if (a === 'checkout' || a === 'delivery') return renderDelivery();
  if (a === 'ship') { order.ship = b.dataset.v; return renderDelivery(); }
  if (a === 'to-pay') {
    const pickup = order.ship === 'pickup';
    if (!addr.name.trim()) return renderDelivery('Add your full name');
    if (!/^5\d{8}$/.test(addr.phone.replace(/\s/g, ''))) return renderDelivery('Add a Saudi mobile number: 9 digits starting with 5');
    if (!pickup && (!addr.district.trim() || !addr.street.trim())) return renderDelivery('Add the district and the street and building number');
    return renderPayment();
  }
  if (a === 'payment') return renderPayment();
  if (a === 'pay') { order.pay = b.dataset.v; return renderPayment(); }
  if (a === 'to-review') { if (!order.pay) return renderPayment('Choose a payment method'); return renderReview(); }
  if (a === 'place') return placeOrder();
}

export const shop = { openProduct, openCatalog, openCart, get count() { return count(); }, onCount(fn) { listeners.add(fn); fn(count()); return () => listeners.delete(fn); }, get open() { return !!root && !root.hidden; } };
