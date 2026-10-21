// The club store's interactions (Ahmed, 2026-10-21: "I want every part of the store to be interactive"; chose a
// try-on mirror, a crest you can spin, products you pick up). The ids come from store.js:
//   product:<key>   any product display (a shirt on a hanger, a folded stack, a cap, a ball, a shelf tag, a rail,
//                   a table, a campaign photo, the watch) → it comes off the shelf toward you, then its product sheet
//   section:<name>  a bay, its header or the store sign → the catalogue
//   crest           the big 3D crest on the back wall → it spins (three in a row: the crowd cheers, +10 XP once)
//   mirror, print   the try-on mirror and the printing counter → your name and number on the shirt's back
//   cart            the till → the cart
// Mouse hover grows the product under the pointer a touch (store.js's api.highlight).
import { openMirror, closeMirror } from './store-mirror.js';

const KEY = 'itt-store-room-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };

// the scene reports a tap on pointerup; the browser's own click follows a moment later at the same spot. Anything
// we open on the tap (a panel, the shop sheet) would catch that click, so swallow it once.
function eatGhostClick() {
  const t0 = performance.now();
  const h = (e) => { removeEventListener('click', h, true); if (performance.now() - t0 < 600) { e.stopPropagation(); e.preventDefault(); } };
  addEventListener('click', h, true);
  setTimeout(() => removeEventListener('click', h, true), 600);
}

const streak = { n: 0, last: 0 };
let busy = false;   // a pick-up is in flight (a second tap waits for the sheet)

export async function click(id, hit, ctx) {
  const api = ctx.room?.api;
  if (ctx.shop.open) return;
  eatGhostClick();
  if (id.startsWith('product:')) {
    if (busy) return;
    busy = true;
    ctx.feel.tap();
    api?.highlight(null);
    try { await api?.pickUp(hit.object, ctx.scene.camera); } finally { busy = false; }
    ctx.shop.openProduct(id.slice(8));
    return;
  }
  if (id === 'crest') {
    if (!api?.spinCrest()) return;
    ctx.feel.tap(); ctx.feel.buzz(12);
    const now = performance.now();
    streak.n = now - streak.last < 3200 ? streak.n + 1 : 1;
    streak.last = now;
    if (streak.n === 3) {
      ctx.feel.roar();
      ctx.feel.pop('ITTIHAD!', { y: innerHeight * 0.3, big: true });
      const st = load();
      if (!st.crestXp) { st.crestXp = 1; save(st); ctx.progress.award(10, 'Spun the crest'); }
    }
    return;
  }
  if (id === 'mirror' || id === 'print') { ctx.feel.tap(); openMirror(ctx); return; }
  if (id === 'cart') { ctx.feel.tap(); ctx.shop.openCart(); return; }
  if (id.startsWith('section:')) { ctx.feel.tap(); ctx.shop.openCatalog(); }
}

/* hover: the scene only reports the id; the exact object comes from our own raycast at the pointer */
let hoverId = null, ptr = null, raf = 0, ctxRef = null;
const onMove = (e) => { ptr = [e.clientX, e.clientY]; if (hoverId?.startsWith('product:') && !raf) raf = requestAnimationFrame(pick); };
function pick() {
  raf = 0;
  const api = ctxRef?.room?.api, sc = ctxRef?.scene;
  if (!api || !sc || !ptr) return;
  if (!hoverId?.startsWith('product:')) { api.highlight(null); return; }
  api.highlight(api.objectAt(ptr[0], ptr[1], sc.camera, sc.renderer.domElement.getBoundingClientRect()));
}
export function hover(id, ctx) { ctxRef = ctx; hoverId = id; pick(); }

export function enter(ctx) {
  ctxRef = ctx;
  addEventListener('pointermove', onMove, { passive: true });
  const st = load();
  if (st.print) ctx.room?.api?.setMirrorPrint(st.print.name, st.print.no);
}
export function leave(ctx) {
  removeEventListener('pointermove', onMove);
  hoverId = null;
  ctx.room?.api?.highlight(null);
  closeMirror();
}
