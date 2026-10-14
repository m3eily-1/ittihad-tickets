// The three point layouts the hero morphs between. Each returns Float32Arrays of N xyz positions
// (plus per-point colours / metadata), so the GPU can blend them with nothing but uniforms.

// crest.png pixel-space outline of the "1" (same as src/heroes/stripes.js)
export const ONE = [[145, 12], [425, 12], [425, 392], [470, 392], [470, 520], [24, 520], [24, 392], [80, 392], [80, 250], [24, 250], [24, 150]];

// deterministic random so the seat codes are stable between visits
export function rng(seed = 1927) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── 1 · the bowl: tiered superellipse rings of seats around a pitch ──
   x/z is the ground plane (pitch half-size 1.0 × 0.66), y rises with every row. */
export const PITCH = { hx: 1.0, hz: 0.66 };
const TIERS = [
  { name: 'Lower tier', rows: 30, d0: 0.2, dr: 0.031, y0: 0.03, dy: 0.017, blocks: 28, base: 100 },
  { name: 'Upper tier', rows: 26, d0: 1.26, dr: 0.033, y0: 0.7, dy: 0.026, blocks: 36, base: 200 },
];
const GAP = 0.07; // aisle between blocks, as a fraction of a block

function ring(a, b, n, K = 480) {
  const pts = [], cum = [0];
  const e = 2 / n;
  for (let k = 0; k <= K; k++) {
    const t = (k / K) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    pts.push([a * Math.sign(c) * Math.abs(c) ** e, b * Math.sign(s) * Math.abs(s) ** e]);
    if (k) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  const len = cum[K];
  // arc-length → point
  const at = (u) => {
    const target = u * len;
    let lo = 0, hi = K;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid; else hi = mid; }
    const f = (target - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
  };
  return { len, at };
}

export function buildBowl(N) {
  const rows = [];
  for (const [ti, t] of TIERS.entries()) {
    for (let r = 0; r < t.rows; r++) {
      const d = t.d0 + r * t.dr;
      // inner rows hug the pitch (squarer), outer rows round off into an oval
      const n = 3.4 - 1.3 * Math.min(1, d / 2.1);
      rows.push({ ti, r, tier: t, y: t.y0 + r * t.dy, ring: ring(PITCH.hx + d * 1.05, PITCH.hz + d, n) });
    }
  }
  const total = rows.reduce((s, row) => s + row.ring.len * (1 - GAP), 0);
  const spacing = total / N;
  let sum = 0;
  rows.forEach((row) => { row.count = Math.round((row.ring.len * (1 - GAP)) / spacing); sum += row.count; });
  rows[rows.length - 1].count += N - sum; // land on exactly N

  const pos = new Float32Array(N * 3);
  const meta = new Float32Array(N * 2); // angle around the bowl (0..1), height in the bowl (0..1)
  const block = new Uint16Array(N), rowNo = new Uint8Array(N), seat = new Uint16Array(N), tier = new Uint8Array(N);
  const maxY = TIERS[1].y0 + TIERS[1].rows * TIERS[1].dy;
  let i = 0;
  for (const row of rows) {
    const B = row.tier.blocks, per = row.count / B;
    for (let j = 0; j < row.count; j++) {
      const u = (j + 0.5) / row.count;
      const bk = Math.floor(u * B), loc = u * B - bk;
      const s = (bk + GAP / 2 + loc * (1 - GAP)) / B;
      const [x, z] = row.ring.at(s);
      pos[i * 3] = x; pos[i * 3 + 1] = row.y; pos[i * 3 + 2] = z;
      meta[i * 2] = s; meta[i * 2 + 1] = row.y / maxY;
      block[i] = row.tier.base + bk + 1;
      rowNo[i] = row.r + 1;
      seat[i] = Math.floor(loc * per) + 1;
      tier[i] = row.ti;
      i++;
    }
  }
  // centre the bowl vertically on its own mass
  for (let k = 0; k < N; k++) pos[k * 3 + 1] -= maxY * 0.35;
  return { pos, meta, seats: { block, row: rowNo, seat, tier, tierNames: TIERS.map((t) => t.name) } };
}

/* jittered hex-grid sampling of whatever passes `inside(x, y)` in a w×h raster, exactly N points */
function sampleRaster(N, w, h, area, inside, rand) {
  const step = Math.sqrt(area / N);
  const out = [];
  const rowH = step * 0.866;
  for (let y = rowH / 2, r = 0; y < h; y += rowH, r++) {
    for (let x = (r % 2 ? step / 2 : 0) + step / 4; x < w; x += step) {
      const jx = x + (rand() - 0.5) * step * 0.3, jy = y + (rand() - 0.5) * step * 0.3;
      if (inside(jx, jy)) out.push([jx, jy]);
    }
  }
  // shuffle, then trim or top up to exactly N
  for (let k = out.length - 1; k > 0; k--) { const m = Math.floor(rand() * (k + 1)); [out[k], out[m]] = [out[m], out[k]]; }
  const base = out.length;
  while (out.length < N) {
    const [x, y] = out[Math.floor(rand() * base)];
    const jx = x + (rand() - 0.5) * step, jy = y + (rand() - 0.5) * step;
    out.push(inside(jx, jy) ? [jx, jy] : [x, y]);
  }
  out.length = N;
  return out;
}

/* ── 2 · the crest's "1", coloured from crest.png itself ── */
export function buildOne(N, img, rand) {
  const W = 494, H = 554;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const path = new Path2D();
  ONE.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  const alpha = (x, y) => px[((y | 0) * W + (x | 0)) * 4 + 3];
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && alpha(x, y) > 160 && ctx.isPointInPath(path, x, y);
  let area = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (inside(x, y)) area += 4;
  const pts = sampleRaster(N, W, H, area, inside, rand);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), yn = new Float32Array(N);
  const S = 3.6 / H;
  pts.forEach(([x, y], k) => {
    pos[k * 3] = (x - W / 2) * S;
    pos[k * 3 + 1] = (H / 2 - y) * S;
    pos[k * 3 + 2] = (rand() - 0.5) * 0.09;
    const o = ((y | 0) * W + (x | 0)) * 4;
    let r = px[o] / 255, g = px[o + 1] / 255, b = px[o + 2] / 255;
    // the crest's black reads as dark graphite so the stripes stay visible against the page
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    if (l < 0.35) { const k2 = 0.2 + l * 0.4; r = k2; g = k2; b = k2 * 0.95; }
    col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b;
    yn[k] = y / H;
  });
  return { pos, col, yn };
}

/* ── 3 · the next match date in Anton, rasterised on a canvas ── */
export function buildText(N, text, rand) {
  const W = 1800, H = 640;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "400 520px 'Anton', Impact, sans-serif";
  ctx.fillText(text, W / 2, H / 2 + 10);
  const px = ctx.getImageData(0, 0, W, H).data;
  let minX = W, maxX = 0, minY = H, maxY = 0, area = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[(y * W + x) * 4 + 3] > 128) { area++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && px[((y | 0) * W + (x | 0)) * 4 + 3] > 128;
  const pts = sampleRaster(N, W, H, area, inside, rand);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, S = 2 / (maxY - minY);
  const pos = new Float32Array(N * 3), yn = new Float32Array(N);
  pts.forEach(([x, y], k) => {
    pos[k * 3] = (x - cx) * S;
    pos[k * 3 + 1] = (cy - y) * S;
    pos[k * 3 + 2] = (rand() - 0.5) * 0.06;
    yn[k] = (x - minX) / (maxX - minX); // the date sweeps in left → right
  });
  return { pos, yn, width: (maxX - minX) * S, height: 2 };
}
