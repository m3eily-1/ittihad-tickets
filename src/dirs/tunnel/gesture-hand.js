// The hand that shows you how (Ahmed, 2026-10-22: FC Mobile's ghost hand — "use the hand gestures guide in the
// tunnel and the penalties to educate the user"). A see-through hand acts the gesture out — a swipe along a path,
// a sideways drag, a tap — with a short label under it, and loops until you do it yourself (or it times out).
// It never takes a click: pointer-events none, sitting under the menu and the pages (z-index 155).
//
//   const h = showHand({ path: [[x, y], …], label, kind: 'swipe' | 'drag' | 'tap', anchor?, timeout?, labelAt? })
//   h.stop()       // fades out; also called by itself after `timeout` ms
//   hintOnce(key)  // true the first time in this visit (sessionStorage), so each lesson shows once
//
// path points are viewport pixels, or 0–1 fractions of the viewport. With `anchor` (an element) they're fractions
// of its box instead, and the hand follows it while it moves (the door's Enter button slides with the camera).
import './gesture-hand.css';

const HAND = `<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M24 6c3.6 0 6 2.6 6 6.2V34l1.4-.4V27c0-3.4 2.4-5.6 5.4-5.6s5.4 2.2 5.4 5.6v6.4l1.4-.2V30c0-3.2 2.3-5.4 5.2-5.4 3 0 5.2 2.2 5.2 5.4v4.6c2.7-.6 5.6 1.4 5.6 4.8V54c0 11-8.4 20-20.4 20h-4c-7.2 0-12-3.2-15.8-8.8L7.6 51.6c-1.8-2.8-1.2-6.2 1.4-8 2.6-1.8 6-1.2 7.8 1.4l1.2 1.8V12.2C18 8.6 20.4 6 24 6z"/></svg>`;
let live = null;

export function hintOnce(key) {
  try { if (sessionStorage.getItem(`itt-hint-${key}`) === '1') return false; sessionStorage.setItem(`itt-hint-${key}`, '1'); } catch { /* private mode: show it */ }
  return true;
}

export function showHand({ path, label = '', kind = 'swipe', anchor = null, timeout = 12000, labelAt = 'below' } = {}) {
  live?.stop(true);
  const el = document.createElement('div');
  el.className = `gh-hand is-${kind}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg class="gh-hand__trail"><path/></svg><span class="gh-hand__dot"></span><span class="gh-hand__h">${HAND}</span>${label ? `<p class="gh-hand__l"></p>` : ''}`;
  if (label) el.querySelector('.gh-hand__l').textContent = label;
  document.body.append(el);
  const hand = el.querySelector('.gh-hand__h'), dot = el.querySelector('.gh-hand__dot'), trail = el.querySelector('.gh-hand__trail path'), lab = el.querySelector('.gh-hand__l');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // points → pixels (fractions of the anchor's box, or of the viewport)
  const pts = () => {
    const r = anchor?.getBoundingClientRect?.();
    const W = r ? r.width : innerWidth, H = r ? r.height : innerHeight, X = r ? r.left : 0, Y = r ? r.top : 0;
    return path.map(([x, y]) => [X + (Math.abs(x) <= 1 ? x * W : x), Y + (Math.abs(y) <= 1 ? y * H : y)]);
  };
  // a smooth curve through the points (Catmull-Rom), sampled by t in 0–1
  const at = (P, t) => {
    if (P.length === 1) return P[0];
    const n = P.length - 1, f = Math.min(n - 1e-6, Math.max(0, t * n)), i = Math.floor(f), u = f - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)];
    const c = (a, b, c2, d) => 0.5 * ((2 * b) + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u * u + (-a + 3 * b - 3 * c2 + d) * u * u * u);
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
  };

  // one loop: rest → press → travel (the trail draws behind it) → lift → fade; a tap presses twice in place
  const LOOP = kind === 'tap' ? 1500 : 2200;
  let raf = 0, t0 = performance.now(), dead = false;
  const frame = (now) => {
    if (dead) return;
    const P = pts(), k = ((now - t0) % LOOP) / LOOP;
    let pos, press = 0, alpha = 1, drawn = 0;
    if (kind === 'tap') {
      pos = P[0];
      const tap = (c) => Math.max(0, 1 - Math.abs(k - c) / 0.08);
      press = Math.max(tap(0.3), tap(0.55));
      alpha = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
    } else {
      const s = Math.min(1, Math.max(0, (k - 0.18) / 0.5));   // travel from 18% to 68% of the loop
      const e = s < 0.5 ? 2 * s * s : 1 - (-2 * s + 2) ** 2 / 2;
      pos = reduce ? P[P.length - 1] : at(P, e);
      press = k > 0.1 && k < 0.72 ? 1 : 0;
      drawn = reduce ? 1 : e;
      alpha = k < 0.1 ? k / 0.1 : k > 0.8 ? Math.max(0, (1 - k) / 0.2) : 1;
    }
    hand.style.transform = `translate(${pos[0]}px, ${pos[1]}px) scale(${1 - press * 0.1})`;
    dot.style.transform = `translate(${pos[0]}px, ${pos[1]}px) scale(${0.4 + press * 0.6})`;
    dot.style.opacity = press * 0.9;
    el.style.setProperty('--a', alpha);
    if (kind !== 'tap') {
      // the trail: the curve from the start up to where the hand is
      const N = 28, last = Math.max(1, Math.round(N * drawn));
      let d = '';
      for (let j = 0; j <= last; j++) { const q = at(P, (j / N) * 1); d += `${j ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }
      trail.setAttribute('d', drawn > 0.01 ? d : '');
    }
    if (lab) {   // under the gesture, or above it (the games keep their own hint line at the bottom)
      const a = P[0], b = P[P.length - 1], y = labelAt === 'above' ? Math.min(...P.map((q) => q[1])) - 56 : Math.max(a[1], b[1]) + 74;
      lab.style.transform = `translate(${(a[0] + b[0]) / 2}px, ${y}px) translateX(-50%)`;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => el.classList.add('is-on'));

  const ctl = {
    stop(now = false) {
      if (dead) return; dead = true;
      cancelAnimationFrame(raf); clearTimeout(tm);
      if (live === ctl) live = null;
      if (now) { el.remove(); return; }
      el.classList.remove('is-on'); setTimeout(() => el.remove(), 300);
    },
    get on() { return !dead; },
  };
  const tm = timeout ? setTimeout(() => ctl.stop(), timeout) : 0;
  live = ctl;
  return ctl;
}
export const hideHand = () => live?.stop();
