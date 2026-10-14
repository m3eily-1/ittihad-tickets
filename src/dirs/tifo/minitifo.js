// A small Canvas2D "stand": a grid of two-sided cards that flip into pixel-font words and spin
// when a wave passes. Used for the preloader, fixture codes, the app panel and the footer.
// The hero uses the three.js stand (stand.js); this is the cheap DOM-side echo of it.

/* 5×7 pixel font (variable width for punctuation) */
const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
  '·': ['.', '.', '.', '#', '.', '.', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
};

export const textWidth = (str) => [...str].reduce((w, ch, i) => w + (G[ch] || G[' '])[0].length + (i ? 1 : 0), 0);

// stamp text into a palette-index grid (array of rows × cols), centred unless x/y given
export function stamp(grid, str, { fg = 1, x, y } = {}) {
  const rows = grid.length, cols = grid[0].length;
  const w = textWidth(str);
  let cx = x ?? Math.floor((cols - w) / 2);
  const cy = y ?? Math.floor((rows - 7) / 2);
  for (const ch of str) {
    const g = G[ch] || G[' '];
    for (let r = 0; r < 7; r++) for (let c = 0; c < g[r].length; c++) {
      if (g[r][c] !== '#') continue;
      const gx = cx + c, gy = cy + r;
      if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) grid[gy][gx] = fg;
    }
    cx += g[0].length + 1;
  }
  return grid;
}
export const blank = (cols, rows, v = 0) => Array.from({ length: rows }, () => new Array(cols).fill(v));

const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// palette index → [front, back]. Index 0 is the "empty" card (dark), 1 yellow, 2 ink, 3 dim.
const PAL = ['#151515', '#fef201', '#f4f1e8', '#262626'];
const BACK = ['#fef201', '#0d0d0d', '#0d0d0d', '#fef201'];

export class MiniTifo {
  constructor(canvas, { cols, rows, gap = 0.16, still = false, pal = PAL, back = BACK, interactive = true, waveOnMove = true } = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = cols; this.rows = rows; this.gap = gap; this.still = still;
    this.pal = pal; this.backPal = back;
    const n = cols * rows;
    this.cur = new Uint8Array(n); this.tgt = new Uint8Array(n);
    this.t0 = new Float32Array(n).fill(-1);     // flip start
    this.s0 = new Float32Array(n).fill(-9);     // spin start
    this.jit = Float32Array.from({ length: n }, () => Math.random());
    this.visible = true; this.raf = 0; this.last = 0; this.dirty = true;
    this.ptr = null;
    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); this.kick(); });
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.kick(); }, { rootMargin: '80px' });
    this.io.observe(canvas);
    if (interactive && !still) {
      let lastEmit = 0;
      canvas.addEventListener('pointermove', (e) => {
        const { x, y } = this.cellAt(e);
        this.ptr = { x, y, t: performance.now() };
        if (waveOnMove && performance.now() - lastEmit > 140) { lastEmit = performance.now(); this.ripple(x, y, 0.45, 5); }
        this.kick();
      });
      canvas.addEventListener('pointerleave', () => { this.ptr = null; this.kick(); });
    }
  }
  cellAt(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.cols, y: ((e.clientY - r.top) / r.height) * this.rows };
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = this.cv.clientWidth || 300;
    const h = Math.round((w * this.rows) / this.cols * (this.aspect || 1));
    this.cv.style.height = h + 'px';
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.dirty = true;
  }
  // grid: rows×cols palette indices
  set(grid, { sweep = 'ltr', span = 0.9, origin = [0.5, 0.5], instant = false } = {}) {
    const now = performance.now() / 1000;
    const { cols, rows } = this;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, v = grid[r]?.[c] ?? 0;
      if (instant || this.still) { this.cur[i] = v; this.tgt[i] = v; this.t0[i] = -1; continue; }
      // settle any in-flight flip first
      if (this.t0[i] >= 0) this.cur[i] = this.tgt[i];
      if (v === this.cur[i]) { this.tgt[i] = v; this.t0[i] = -1; continue; }
      let o;
      if (sweep === 'ltr') o = c / cols;
      else if (sweep === 'rtl') o = 1 - c / cols;
      else if (sweep === 'random') o = this.jit[i];
      else o = Math.hypot(c / cols - origin[0], (r / rows - origin[1]) * (rows / cols)) * 1.4;
      this.tgt[i] = v;
      this.t0[i] = now + o * span + this.jit[i] * 0.12;
    }
    this.dirty = true;
    this.kick();
  }
  // spin wave from (x,y) in cell units
  ripple(x, y, span = 0.6, range = Infinity) {
    if (this.still) return;
    const now = performance.now() / 1000;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const d = Math.hypot(c + 0.5 - x, r + 0.5 - y);
      if (d > range) continue;
      const i = r * this.cols + c, s = now + (d / Math.max(this.cols, this.rows)) * span * 2 + this.jit[i] * 0.05;
      if (now - this.s0[i] > 0.6 || this.s0[i] > now) this.s0[i] = s;
    }
    this.kick();
  }
  sweepWave(dir = 1, span = 1.1) {
    if (this.still) return;
    const now = performance.now() / 1000;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const i = r * this.cols + c;
      const o = dir > 0 ? c / this.cols : 1 - c / this.cols;
      this.s0[i] = now + o * span + this.jit[i] * 0.06 + r * 0.008;
    }
    this.kick();
  }
  kick() {
    if (this.raf || !this.visible) return;
    this.raf = requestAnimationFrame(this.frame);
  }
  frame = () => {
    this.raf = 0;
    const busy = this.draw();
    if ((busy || this.ptr) && this.visible) this.kick();
  };
  draw() {
    const { ctx, cols, rows, cv } = this;
    const now = performance.now() / 1000;
    const W = cv.width, H = cv.height, cw = W / cols, ch = H / rows;
    const gx = cw * this.gap, gy = ch * this.gap;
    ctx.clearRect(0, 0, W, H);
    let busy = false;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      // flip 0→π (face → target)
      let a = 0, lift = 0;
      if (this.t0[i] >= 0) {
        const p = clamp01((now - this.t0[i]) / 0.42);
        if (p >= 1) { this.cur[i] = this.tgt[i]; this.t0[i] = -1; } else { busy = true; a = Math.PI * easeOutBack(p); lift = Math.sin(Math.PI * p) * 0.18; }
      }
      // spin: one full turn
      const sp = (now - this.s0[i]) / 0.5;
      if (sp > -0.02 && sp < 1) { busy = true; a += Math.PI * 2 * easeOutBack(clamp01(sp)); lift += Math.sin(Math.PI * clamp01(sp)) * 0.35; }
      else if (sp < 0 && this.s0[i] > now) busy = true;
      // pointer: cards near it lift a touch
      if (this.ptr) {
        const d = Math.hypot(c + 0.5 - this.ptr.x, r + 0.5 - this.ptr.y);
        lift += Math.max(0, 1 - d / 3.2) * 0.22;
      }
      const cosA = Math.cos(a);
      const showBack = cosA < 0;
      // which face: during a flip, the back shows the target; at rest the back is the reverse print
      const flipping = this.t0[i] >= 0;
      const col = showBack ? (flipping ? this.pal[this.tgt[i]] : this.backPal[this.cur[i]]) : this.pal[this.cur[i]];
      const k = Math.abs(cosA);
      const h = (ch - gy) * Math.max(k, 0.06);
      const x = c * cw + gx / 2, y = r * ch + gy / 2 + ((ch - gy) - h) / 2 - lift * ch;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, cw - gx, h);
      if (col === this.pal[0]) { ctx.fillStyle = `rgba(255,255,255,${this.jit[i] * 0.035})`; ctx.fillRect(x, y, cw - gx, h); }
      // light catches the card while it turns
      if (k < 0.98) {
        ctx.fillStyle = `rgba(255,255,240,${(1 - k) * 0.35})`;
        ctx.fillRect(x, y, cw - gx, Math.max(1, h * 0.35));
      }
    }
    return busy;
  }
  destroy() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.io.disconnect(); }
}
