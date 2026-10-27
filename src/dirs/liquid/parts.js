// Direction C pieces that other pages reuse (mix.html): ink drips, the footer's liquid lens, and the
// hero trio's parallax. Moved here verbatim from liquid/main.js, which imports them back.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, split, fine } from '../../ui.js';

/* ───────────── ink drips between sections ───────────── */
function rng(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function setupDrip(el, RM = false) {
  const svg = $('svg', el), path = $('path', el);
  const seed = +el.dataset.seed || 1;
  let W = 0, H = 0, drips = [], prog = RM ? 1 : 0;
  function build() {
    W = el.clientWidth; H = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const r = rng(seed);
    const n = Math.max(6, Math.round(W / 64));
    drips = Array.from({ length: n }, (_, i) => ({
      x: (i + 0.15 + r() * 0.7) * (W / n),
      w: 12 + r() * (W < 600 ? 22 : 38),
      L: (0.18 + Math.pow(r(), 1.4) * 0.82) * (H - 26),
      d: r() * 0.5,
      drop: r() < 0.35,
    })).sort((a, b) => b.x - a.x);
    draw(prog);
  }
  function draw(p) {
    prog = p;
    const base = 2 + p * 12;
    const f = (n) => n.toFixed(1);
    let d = `M0,-1 H${W} V${f(base)}`, drops = '';
    for (const k of drips) {
      const q = Math.min(1, Math.max(0, (p - k.d) / (1 - k.d)));
      const e = 1 - Math.pow(1 - q, 3);
      const L = k.L * e;
      if (L < 3) continue;
      const hw = Math.min(k.w / 2, L / 2);
      const s = Math.min(hw * 0.9, L * 0.28);
      const x = k.x;
      d += ` L${f(x + hw + s)},${f(base)} Q${f(x + hw)},${f(base)} ${f(x + hw)},${f(base + s)} L${f(x + hw)},${f(base + L - hw)} A${f(hw)},${f(hw)} 0 0 1 ${f(x - hw)},${f(base + L - hw)} L${f(x - hw)},${f(base + s)} Q${f(x - hw)},${f(base)} ${f(x - hw - s)},${f(base)}`;
      if (k.drop && q > 0.55) {
        const dr = hw * 0.55, cy = Math.min(H - dr - 1, base + L + 6 + (q - 0.55) * 60);
        drops += ` M${f(x - dr)},${f(cy)} a${f(dr)},${f(dr)} 0 1,0 ${f(dr * 2)},0 a${f(dr)},${f(dr)} 0 1,0 ${f(-dr * 2)},0`;
      }
    }
    d += ` L0,${f(base)} Z` + drops;
    path.setAttribute('d', d);
  }
  build();
  addEventListener('resize', build);
  if (!RM) ScrollTrigger.create({ trigger: el, start: 'top 98%', end: 'top 30%', scrub: 0.6, onUpdate: (s) => draw(s.progress) });
}

/* ───────────── footer: liquid lens on the big line ───────────── */
export function setupFooterLens(RM = false) {
  const word = $('.js-lens-word');
  $$('.foot__line', word).forEach((l) => split(l, { chars: true }));
  const chars = $$('.c', word);
  const lens = $('.js-lens');
  if (fine() && !RM) {
    const tos = chars.map((c) => gsap.quickTo(c, 'scaleY', { duration: 0.5, ease: 'power3' }));
    let centers = [];
    lens.addEventListener('pointerenter', () => { centers = chars.map((c) => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); });
    lens.addEventListener('pointermove', (e) => {
      centers.forEach(([x, y], i) => {
        const d = Math.hypot((e.clientX - x) / 140, (e.clientY - y) / 260);
        tos[i](1 + 0.55 * Math.exp(-d * d));
      });
    });
    lens.addEventListener('pointerleave', () => tos.forEach((t) => t(1)));
  }
  if (RM) word.classList.add('is-in');
  else {
    gsap.from(chars, {
      yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.02,
      scrollTrigger: { trigger: word, start: 'top 92%', once: true },
      onComplete: () => word.classList.add('is-in'),
    });
  }
}

/* ───────────── hero trio: parallax against the type (pointer + scroll) ───────────── */
export function initPlayersParallax(inner, heroEl) {
  const setX = gsap.quickSetter(inner, 'x', 'px'), setY = gsap.quickSetter(inner, 'y', 'px');
  let tx = 0, ty = 0, px = 0, py = 0;
  addEventListener('pointermove', (e) => { tx = (e.clientX / innerWidth - 0.5) * -26; ty = (e.clientY / innerHeight - 0.5) * -14; }, { passive: true });
  gsap.ticker.add(() => {
    const r = heroEl.getBoundingClientRect();
    if (r.bottom < 0) return;
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;
    // scrolling away: the trio slides up faster than the type behind it
    setX(px); setY(py + Math.min(0, r.top) * 0.18);
  });
}
