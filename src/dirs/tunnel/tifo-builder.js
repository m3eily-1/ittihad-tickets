// Tifo builder (Ahmed, 2026-10-21: "make it feel like a game"): paint your own card display on a grid, preview
// it, then raise it. The caller hands the finished canvas to tifo.setCustom(canvas) (tifo.js); this module only
// owns the overlay.
//
//   const tb = mountTifoBuilder();
//   tb.open({ onRaise(canvas) { … }, onClose() { … }, hidden: tifo.hidden });
//
// Two places to put it (Ahmed, 2026-10-21: "make the tifo the full stadium seats"):
//  · Whole stadium (the default): a 96 × 16 panorama wrapped round the bowl (tifo.js BOWL_GRID) — x runs round
//    the four stands, y down the three tiers — so every seat in the ground holds up a card.
//  · Far stand: the original 52 × 16 picture on the stand opposite the tunnel (it reads ~3.25 : 1 from the
//    touchline, tifo.aspect), with the rows its concourses hide (tifo.hidden).
// The canvas handed to onRaise carries the mode in canvas.dataset.tifo ('bowl' | 'far'). Each mode's design is
// kept in localStorage ('itt-tifo-bowl-v1', 'itt-tifo-v1'), the mode in 'itt-tifo-mode'. Templates are drawn
// procedurally, no artwork is used.
import '@fontsource/anton/400.css';
import '@fontsource/cairo/700.css';
import './tifo-builder.css';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { BOWL_GRID } from './tifo.js';

export const TB_COLS = 52, TB_ROWS = 16;                                // the far stand
export const TB_BOWL_COLS = BOWL_GRID.cols, TB_BOWL_ROWS = BOWL_GRID.rows; // the whole stadium
const MODE_KEY = 'itt-tifo-mode';
const MODES = {
  bowl: { cols: TB_BOWL_COLS, rows: TB_BOWL_ROWS, key: 'itt-tifo-bowl-v1', start: 'ittihad', bowl: true, stands: BOWL_GRID.stands, bands: BOWL_GRID.bands },
  far: { cols: TB_COLS, rows: TB_ROWS, key: 'itt-tifo-v1', start: 'year', bowl: false, stands: [], bands: [] },
};
const EMPTY = -1;
const EMPTY_HEX = '#121212'; // an unpainted cell is a black card on the stand

const PAL = [
  { hex: '#ffea00', name: 'Yellow' },
  { hex: '#111111', name: 'Black' },
  { hex: '#f4f0e6', name: 'White' },
  { hex: '#d4a017', name: 'Gold' },
  { hex: '#ff9e00', name: 'Amber' },
  { hex: '#7a7a7a', name: 'Silver' },
  { hex: '#007a3d', name: 'Green' },
  { hex: '#d71920', name: 'Flare red' },
];
const Y = 0, K = 1, Wh = 2, AMBER = 4;
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const PAL_RGB = PAL.map((p) => rgbOf(p.hex));
// the concourse bands the far stand hides (fractions of the picture from the top), as tifo.hidden measures them
const HIDDEN_DEFAULT = [[0.59, 0.677], [0.28, 0.355]];
const GAPK = 0.7;   // whole stadium: the concourse strips between the tiers on the board, in cells

/* ── templates: drawn on a supersampled canvas, then each cell takes the nearest of the template's colours.
   G is the mode (MODES): cols, rows and, for the whole stadium, its stands and tier bands. ── */
const SS = 10;
function raster(G, draw, allowed) {
  const W = G.cols * SS, H = G.rows * SS;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = PAL[K].hex; g.fillRect(0, 0, W, H);
  draw(g, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const out = new Int8Array(G.cols * G.rows);
  for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
    let R = 0, Gr = 0, B = 0, n = 0;
    for (let y = r * SS + 3; y < (r + 1) * SS - 3; y++) for (let x = c * SS + 3; x < (c + 1) * SS - 3; x++) {
      const k = (y * W + x) * 4; R += px[k]; Gr += px[k + 1]; B += px[k + 2]; n++;
    }
    R /= n; Gr /= n; B /= n;
    let best = allowed[0], bd = Infinity;
    for (const i of allowed) { const p = PAL_RGB[i]; const d = (R - p[0]) ** 2 + (Gr - p[1]) ** 2 + (B - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    out[r * G.cols + c] = best;
  }
  return out;
}
// Anton text fitted by cap height into a box
function fit(g, text, cx, cy, maxW, maxH, color, font = '400 100px Anton', track = 0.03) {
  g.font = font;
  let m = g.measureText(text);
  let s = maxH / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent || 1);
  const sized = (k) => font.replace(/\d+px/, `${Math.round(100 * k)}px`);
  g.font = sized(s); g.letterSpacing = `${100 * s * track}px`; m = g.measureText(text);
  if (m.width > maxW) { s *= maxW / m.width; g.font = sized(s); g.letterSpacing = `${100 * s * track}px`; m = g.measureText(text); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(text, cx, cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
}
const stripes = (g, W, H, x0, x1, band, col = PAL[Y].hex) => {
  g.fillStyle = col;
  for (let x = x0; x < x1; x += band * 2) g.fillRect(x, 0, Math.min(band, x1 - x), H);
};
const wings = (g, W, H, inner) => { const b = SS * 2; stripes(g, W, H, 0, W * (0.5 - inner), b); stripes(g, W, H, W * (0.5 + inner), W, b); };
const longSides = (G) => G.stands.filter((s) => !s.end);
const goalEnds = (G) => G.stands.filter((s) => s.end);

// hand-cut block glyphs, two-cell strokes: digits 6 × 11, letters 10 tall
const GLYPHS = {
  1: ['..XX..', '.XXX..', 'XXXX..', '..XX..', '..XX..', '..XX..', '..XX..', '..XX..', '..XX..', 'XXXXXX', 'XXXXXX'],
  9: ['.XXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XXXXXX', '.XXXXX', '....XX', '....XX', 'XX..XX', 'XXXXXX', '.XXXX.'],
  2: ['.XXXX.', 'XXXXXX', 'XX..XX', '....XX', '...XXX', '..XXX.', '.XXX..', 'XXX...', 'XX....', 'XXXXXX', 'XXXXXX'],
  7: ['XXXXXX', 'XXXXXX', '....XX', '....XX', '...XX.', '...XX.', '..XX..', '..XX..', '..XX..', '..XX..', '..XX..'],
  I: Array(10).fill('XX'),
  T: ['XXXXXX', 'XXXXXX', ...Array(8).fill('..XX..')],
  H: [...Array(4).fill('XX..XX'), 'XXXXXX', 'XXXXXX', ...Array(4).fill('XX..XX')],
  A: ['.XXXX.', 'XXXXXX', 'XX..XX', 'XX..XX', 'XXXXXX', 'XXXXXX', ...Array(4).fill('XX..XX')],
  D: ['XXXXX.', 'XXXXXX', ...Array(6).fill('XX..XX'), 'XXXXXX', 'XXXXX.'],
};
// one-cell strokes, 5 tall: a word per stand round the bowl (a cell there is ~4 m of seats)
const SMALL = {
  1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
  9: ['XXX', 'X.X', 'XXX', '..X', 'XXX'],
  2: ['XXX', '..X', 'XXX', 'X..', 'XXX'],
  7: ['XXX', '..X', '..X', '.X.', '.X.'],
  I: Array(5).fill('X'),
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'],
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
};
// text centred on column cx (the far stand: the middle); round the bowl it wraps across the seam
function blit(out, G, text, colour, top, { cx = G.cols / 2, gap = 2, set = GLYPHS } = {}) {
  const w = [...text].reduce((s, ch) => s + set[ch][0].length, 0) + (text.length - 1) * gap;
  let x0 = Math.floor(cx - w / 2);
  for (const ch of text) {
    set[ch].forEach((row, r) => [...row].forEach((v, c) => {
      if (v !== 'X' || top + r < 0 || top + r >= G.rows) return;
      const x = G.bowl ? (((x0 + c) % G.cols) + G.cols) % G.cols : x0 + c;
      if (x >= 0 && x < G.cols) out[(top + r) * G.cols + x] = colour;
    }));
    x0 += set[ch][0].length + gap;
  }
}
// the big "1" in blocks (u: one sixteenth of the picture's height)
function bigOne(g, cx, H) {
  const u = H / 16;
  g.fillStyle = PAL[Y].hex;
  g.beginPath();
  g.moveTo(cx - u * 1.2, u * 1.5); g.lineTo(cx + u * 2, u * 1.5); g.lineTo(cx + u * 2, u * 12); g.lineTo(cx + u * 4.2, u * 12);
  g.lineTo(cx + u * 4.2, u * 14.5); g.lineTo(cx - u * 4.2, u * 14.5); g.lineTo(cx - u * 4.2, u * 12); g.lineTo(cx - u * 2, u * 12);
  g.lineTo(cx - u * 2, u * 6); g.lineTo(cx - u * 4.4, u * 6); g.lineTo(cx - u * 4.4, u * 3.8); g.closePath(); g.fill();
  g.fillStyle = PAL[Wh].hex; g.fillRect(cx + u * 5.2, u * 1.5, SS, u * 13); g.fillRect(cx - u * 5.2 - SS, u * 1.5, SS, u * 13);
}

const TEMPLATES = [
  { id: 'stripes', label: 'Stripes', make: (G) => raster(G, (g, W, H) => stripes(g, W, H, 0, W, SS * (G.bowl ? 3 : 4)), [Y, K]) },
  { id: 'year', label: '1927', make: (G) => {
    // at 16 rows a font smears, so the year is set in hand-cut block digits
    if (G.bowl) {
      // round the bowl: the year along both touchlines, stripes behind the goals, a yellow rim top and bottom
      const out = raster(G, (g, W, H) => {
        for (const s of goalEnds(G)) stripes(g, W, H, s.x0 * W, s.x1 * W, SS * 2);
        g.fillStyle = PAL[Y].hex; g.fillRect(0, 0, W, SS); g.fillRect(0, H - SS, W, SS);
      }, [Y, K]);
      for (const s of longSides(G)) blit(out, G, '1927', Y, 3, { cx: s.cx * G.cols, gap: 1 });
      return out;
    }
    const out = raster(G, (g, W, H) => {
      wings(g, W, H, 0.31);
      g.fillStyle = PAL[Y].hex; g.fillRect(W * 0.19 + SS, 0, W * 0.62 - 2 * SS, SS); g.fillRect(W * 0.19 + SS, H - SS, W * 0.62 - 2 * SS, SS);
    }, [Y, K]);
    blit(out, G, '1927', Y, 3);
    return out;
  } },
  { id: 'one', label: 'The “1”', make: (G) => raster(G, (g, W, H) => {
    if (G.bowl) {
      // a big "1" behind each goal, the club's stripes along the touchlines
      for (const s of longSides(G)) stripes(g, W, H, s.x0 * W, s.x1 * W, SS * 2);
      for (const s of goalEnds(G)) bigOne(g, s.cx * W, H);
      return;
    }
    // the number one in blocks, flanked by the club's stripes
    wings(g, W, H, 0.17);
    bigOne(g, W / 2, H);
  }, [Y, K, Wh]) },
  { id: 'ittihad', label: 'ITTIHAD', make: (G) => {
    const out = new Int8Array(G.cols * G.rows).fill(K);
    if (G.bowl) {
      // the year round the upper tier, a yellow middle tier, ITTIHAD along both touchlines in the lower tier
      // with the stripes behind the goals (the word is wider than a goal end: it would run into the next one)
      const mid = G.bands.find((b) => b.key === 'middle'), up = G.bands.find((b) => b.key === 'upper'), lo = G.bands.find((b) => b.key === 'lower');
      for (let r = mid.r0; r < mid.r1; r++) for (let c = 0; c < G.cols; c++) out[r * G.cols + c] = Y;
      for (const s of G.stands) blit(out, G, '1927', Y, up.r1 - 5, { cx: s.cx * G.cols, gap: 1, set: SMALL });
      for (const s of longSides(G)) blit(out, G, 'ITTIHAD', Y, lo.r0, { cx: s.cx * G.cols, gap: 1, set: SMALL });
      for (const s of goalEnds(G)) for (let c = Math.ceil(s.x0 * G.cols) + 1; c < Math.floor(s.x1 * G.cols) - 1; c++) if (Math.floor(c / 2) % 2 === 0) for (let r = lo.r0; r < lo.r1 - 1; r++) out[r * G.cols + c] = Y;
      return out;
    }
    for (let c = 0; c < G.cols; c++) { out[c] = out[15 * G.cols + c] = Y; out[G.cols + c] = out[14 * G.cols + c] = Wh; }
    blit(out, G, 'ITTIHAD', Y, 3);
    return out;
  } },
  { id: 'tiger', label: 'Tiger', make: (G) => {
    // tiger hide: tapered, wavy black stripes reaching in from the front and back rows over a yellow field,
    // with an amber burn along their edges (seeded, so it's the same every time); round the bowl it wraps
    let sd = 1927;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const C = G.cols, R = G.rows;
    const out = new Int8Array(C * R).fill(Y);
    let n = 0;
    for (let x = 2; x < C - 1; x += 4.6 + rnd() * 2) {
      const fromTop = n++ % 2 === 0, len = 0.55 + rnd() * 0.4, w0 = 1.05 + rnd() * 0.6, ph = rnd() * 6.3, amp = 0.6 + rnd() * 0.9, lean = (rnd() - 0.5) * 0.3;
      for (let r = 0; r < R; r++) {
        const t = (fromTop ? r : R - 1 - r) / (R - 1);
        if (t > len) continue;
        const hw = w0 * Math.pow(1 - t / len, 0.6) + 0.15, cx = x + amp * Math.sin(r * 0.5 + ph) + lean * (fromTop ? r : R - 1 - r);
        for (let c0 = Math.floor(cx - hw - 1); c0 <= Math.ceil(cx + hw + 1); c0++) {
          const c = G.bowl ? ((c0 % C) + C) % C : c0;
          if (c < 0 || c >= C) continue;
          const d = Math.abs(c0 + 0.5 - cx), i = r * C + c;
          if (d < hw) out[i] = K;
          else if (c0 + 0.5 > cx && d < hw + 1 && out[i] === Y) out[i] = AMBER; // the burn on one side only
        }
      }
    }
    return out;
  } },
  { id: 'arabic', label: 'الاتحاد', make: (G) => raster(G, (g, W, H) => {
    if (G.bowl) {
      // the name along both touchlines, stripes behind the goals
      for (const s of goalEnds(G)) stripes(g, W, H, s.x0 * W, s.x1 * W, SS * 2);
      for (const s of longSides(G)) fit(g, 'الاتحاد', s.cx * W, H * 0.5, (s.x1 - s.x0) * W * 0.86, H * 0.66, PAL[Y].hex, '700 100px Cairo', 0);
      return;
    }
    wings(g, W, H, 0.36);
    fit(g, 'الاتحاد', W / 2, H * 0.5, W * 0.66, H * 0.62, PAL[Y].hex, '700 100px Cairo', 0);
  }, [Y, K]) },
];

const ICON = {
  paint: '<path d="M4 20c2.5 0 4-1.5 4-3.5S6.5 13 5.5 14 4 17 4 20Z"/><path d="m9 15 10.5-10.5a2 2 0 0 1 3 3L12 18"/>',
  fill: '<path d="m5 11 7-7 8 8-7 7a2 2 0 0 1-3 0l-5-5a2 2 0 0 1 0-3Z"/><path d="M5 12h15"/><path d="M21 16s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3Z"/>',
  erase: '<path d="m7 21-4-4a2 2 0 0 1 0-3L14 3a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3L10 21"/><path d="M7 21h14"/><path d="m9 8 7 7"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  clear: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 15h10l1-15"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const COPY = {
  bowl: { hint: 'Every square is a block of seats holding up cards — all the way round the bowl.', plab: 'The bowl from above', note: 'Every seat in the stadium flips its card to your design, stand by stand.', prev: 'Preview of the tifo round the whole bowl, seen from above' },
  far: { hint: 'Every square is a block of fans holding up a card.', plab: 'On the stand', note: 'The far stand flips its cards to your design.', prev: 'Preview of the tifo on the far stand' },
};

export function mountTifoBuilder() {
  const root = document.createElement('div');
  root.className = 'tb';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Tifo builder');
  root.innerHTML = `
    <div class="tb-top">
      <button class="tb-back" type="button">← Back</button>
      <div class="tb-title"><h2 class="tb-h">Tifo builder</h2></div>
      <div class="tb-mode" role="radiogroup" aria-label="Where the tifo goes">
        <button class="tb-mb" data-mode="bowl" type="button" role="radio">Whole stadium</button>
        <button class="tb-mb" data-mode="far" type="button" role="radio">Far stand</button>
      </div>
      <p class="tb-hint"></p>
    </div>
    <div class="tb-main">
      <div class="tb-tools">
        <div class="tb-tset" role="toolbar" aria-label="Tools">
          <button class="tb-tool is-on" data-tool="paint" type="button" title="Paint (B)">${svg('paint')}<span>Paint</span></button>
          <button class="tb-tool" data-tool="fill" type="button" title="Fill (F)">${svg('fill')}<span>Fill</span></button>
          <button class="tb-tool" data-tool="erase" type="button" title="Erase (E)">${svg('erase')}<span>Erase</span></button>
          <button class="tb-tool tb-size" type="button" title="Brush size (S)"><i class="tb-dot"></i><span>Size 1</span></button>
          <button class="tb-tool tb-undo" type="button" title="Undo (Ctrl+Z)">${svg('undo')}<span>Undo</span></button>
          <button class="tb-tool tb-clear" type="button" title="Clear the board">${svg('clear')}<span>Clear</span></button>
        </div>
        <div class="tb-pal" role="radiogroup" aria-label="Card colour">
          ${PAL.map((p, i) => `<button class="tb-sw${i === 0 ? ' is-on' : ''}" data-c="${i}" type="button" role="radio" aria-checked="${i === 0}" title="${p.name} (${i + 1})" style="--c:${p.hex}"></button>`).join('')}
        </div>
      </div>
      <div class="tb-centre">
        <div class="tb-stage"><div class="tb-ruler" aria-hidden="true"></div><canvas class="tb-board" aria-label="Tifo grid: drag to paint"></canvas></div>
        <div class="tb-tpls" aria-label="Templates">
          <span class="tb-tlab">Templates</span>
          ${TEMPLATES.map((t) => `<button class="tb-tpl" data-t="${t.id}" type="button"><canvas></canvas><span>${t.label}</span></button>`).join('')}
        </div>
      </div>
      <div class="tb-side">
        <p class="tb-plab"></p>
        <canvas class="tb-prev"></canvas>
        <button class="tb-raise" type="button"><span class="tb-rt">Raise the tifo</span><span class="tb-xp"></span></button>
        <p class="tb-note"></p>
      </div>
    </div>
    <div class="tb-flash" aria-hidden="true"><b>Tifo up!</b></div>`;
  document.body.append(root);

  const $ = (s) => root.querySelector(s);
  const board = $('.tb-board'), stage = $('.tb-stage'), prev = $('.tb-prev'), centre = $('.tb-centre'), tpls = $('.tb-tpls'), ruler = $('.tb-ruler');
  const bg = board.getContext('2d'), pg = prev.getContext('2d');

  let mode = 'bowl', G = MODES.bowl, COLS = G.cols, ROWS = G.rows;
  let cells = new Int8Array(COLS * ROWS).fill(EMPTY);
  let tool = 'paint', colour = Y, size = 1, hidden = HIDDEN_DEFAULT;
  let active = false, cbs = {}, hover = null, drawing = null, raf = 0, saveT = 0, closeT = 0;
  const undo = [];

  /* ── persistence ── */
  const record = () => JSON.stringify({ v: 1, cols: COLS, rows: ROWS, cells: Array.from(cells, (v) => (v < 0 ? '.' : v)).join('') });
  const saveNow = () => { clearTimeout(saveT); saveT = 0; try { localStorage.setItem(G.key, record()); localStorage.setItem(MODE_KEY, mode); } catch { /* private mode */ } };
  const save = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 250); };
  const load = () => {
    try {
      const d = JSON.parse(localStorage.getItem(G.key));
      if (d?.cols === COLS && d.rows === ROWS && d.cells?.length === COLS * ROWS) {
        cells = Int8Array.from(d.cells, (ch) => (ch === '.' ? EMPTY : Math.min(PAL.length - 1, +ch || 0)));
        return true;
      }
    } catch { /* nothing saved */ }
    return false;
  };
  const savedMode = () => { try { const m = localStorage.getItem(MODE_KEY); return MODES[m] ? m : null; } catch { return null; } };
  const snapshot = () => { undo.push(cells.slice()); if (undo.length > 40) undo.shift(); };

  /* ── the design as a canvas, one pixel per cell (what onRaise hands over), tagged with its mode ── */
  function toCanvas() {
    const cv = document.createElement('canvas'); cv.width = COLS; cv.height = ROWS;
    cv.dataset.tifo = mode;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const img = g.createImageData(COLS, ROWS), e = rgbOf(EMPTY_HEX);
    cells.forEach((v, i) => { const p = v < 0 ? e : PAL_RGB[v]; img.data.set([p[0], p[1], p[2], 255], i * 4); });
    g.putImageData(img, 0, 0);
    return cv;
  }

  /* ── the board's rows: round the bowl, a concourse strip between the tiers (it hides no rows of the picture,
     the picture just breaks round it, as on the stands) ── */
  let bw = 0, bh = 0, dpr = 1, cs = 1, gh = 0;
  const gapsBefore = (r) => (G.bowl ? G.bands.reduce((n, b) => n + (b.r0 > 0 && b.r0 <= r ? 1 : 0), 0) : 0);
  const rowTop = (r) => r * cs + gapsBefore(r) * gh;
  const rowAt = (y) => {
    // y in canvas pixels → the row it's on (a concourse strip counts as the nearer of its two rows)
    for (let r = 0; r < ROWS; r++) { const t = rowTop(r); if (y < t + cs) return y < t && r > 0 && t - y > gh / 2 ? r - 1 : r; }
    return ROWS - 1;
  };
  const upright = matchMedia('(max-width: 640px) and (orientation: portrait)');
  function fitBoard() {
    // the board takes the centre column's width, or its height less the templates row, whichever is tighter
    // (held upright the overlay scrolls, so only the width counts)
    const rh = G.bowl ? ruler.offsetHeight + 4 : 0;
    const cw = stage.clientWidth, ch = upright.matches ? Infinity : centre.clientHeight - tpls.offsetHeight - 12 - rh;
    if (!cw || ch <= 0) return;
    // (the concourse strips keep a readable height however small the cells get)
    const gaps = G.bowl ? G.bands.length - 1 : 0, GMIN = 11;
    const heightOf = (w) => { const c = w / COLS; return ROWS * c + gaps * Math.max(GMIN, c * GAPK); };
    let w = cw;
    if (heightOf(w) > ch) { let c = ch / (ROWS + gaps * GAPK); if (c * GAPK < GMIN) c = (ch - gaps * GMIN) / ROWS; w = c * COLS; }
    bw = Math.floor(w); bh = Math.floor(heightOf(bw));
    dpr = Math.min(2, devicePixelRatio || 1);
    board.style.width = `${bw}px`; board.style.height = `${bh}px`;
    ruler.style.width = `${bw}px`;
    board.width = Math.round(bw * dpr); board.height = Math.round(bh * dpr);
    cs = board.width / COLS; gh = G.bowl ? Math.max(0, (board.height - ROWS * cs) / (G.bands.length - 1)) : 0;
    const pr = prev.getBoundingClientRect();
    prev.width = Math.round(pr.width * dpr); prev.height = Math.round(pr.height * dpr);
    ring = null;
    paint();
  }
  const hexOf = (v) => (v < 0 ? null : PAL[v].hex);
  function drawBoard() {
    const W = board.width, H = board.height, gap = Math.max(1, cs * 0.09);
    bg.fillStyle = '#050505'; bg.fillRect(0, 0, W, H);
    for (let r = 0; r < ROWS; r++) {
      const y = rowTop(r);
      for (let c = 0; c < COLS; c++) {
        const v = cells[r * COLS + c], x = c * cs;
        bg.fillStyle = hexOf(v) || ((r + c) & 1 ? '#191919' : '#1e1e1e');
        bg.fillRect(x + gap / 2, y + gap / 2, cs - gap, cs - gap);
      }
    }
    if (G.bowl) drawBowlMarks(W, H);
    else {
      // centre guides
      bg.fillStyle = 'rgba(255,255,255,0.14)';
      bg.fillRect(W / 2 - dpr / 2, 0, dpr, H); bg.fillRect(0, H / 2 - dpr / 2, W, dpr);
      // where the concourses cut through the picture
      for (const [a, b] of hidden) {
        const y0 = a * H, y1 = b * H;
        bg.save(); bg.beginPath(); bg.rect(0, y0, W, y1 - y0); bg.clip();
        bg.fillStyle = 'rgba(0,0,0,0.5)'; bg.fillRect(0, y0, W, y1 - y0);
        bg.strokeStyle = 'rgba(255,234,0,0.22)'; bg.lineWidth = dpr;
        for (let x = -H; x < W; x += 10 * dpr) { bg.beginPath(); bg.moveTo(x, y1); bg.lineTo(x + (y1 - y0), y0); bg.stroke(); }
        bg.restore();
        if (y1 - y0 > 9 * dpr) {
          bg.font = `700 ${Math.round(Math.min(11 * dpr, (y1 - y0) * 0.7))}px Cairo, sans-serif`;
          bg.fillStyle = 'rgba(255,255,255,0.7)'; bg.textBaseline = 'middle'; bg.textAlign = 'right';
          bg.fillText('HIDDEN BY THE CONCOURSE', W - 6 * dpr, (y0 + y1) / 2);
        }
      }
    }
    // the brush under the pointer
    if (hover) {
      const [c0, r0] = tool === 'fill' ? [hover.c, hover.r] : brushOrigin(hover.c, hover.r), n = tool === 'fill' ? 1 : size;
      bg.strokeStyle = tool === 'erase' ? '#ffffff' : '#ffea00'; bg.lineWidth = 2 * dpr;
      const y0 = rowTop(r0), y1 = rowTop(r0 + n - 1) + cs;
      bg.strokeRect(c0 * cs + dpr, y0 + dpr, n * cs - 2 * dpr, y1 - y0 - 2 * dpr);
    }
  }
  // whole stadium: the stands' corners, the concourses between the tiers, the tunnel's cut through the lower tier
  function drawBowlMarks(W, H) {
    const fs = Math.round(Math.min(10 * dpr, gh * 0.78));
    // concourse strips, with the LED ribbon that runs round them
    for (const b of G.bands) {
      if (!b.r0) continue;
      const y0 = rowTop(b.r0) - gh, y1 = y0 + gh;
      bg.fillStyle = '#08090b'; bg.fillRect(0, y0, W, gh);
      bg.fillStyle = 'rgba(15,134,196,0.75)'; bg.fillRect(0, y0 + gh * 0.38, W, Math.max(dpr, gh * 0.24));
      if (fs >= 7 * dpr) {
        bg.font = `700 ${fs}px Cairo, sans-serif`; bg.textBaseline = 'middle';
        const above = G.bands.find((x) => x.r1 === b.r0);
        bg.fillStyle = 'rgba(255,255,255,0.72)'; bg.textAlign = 'left';
        bg.fillText(`▲ ${above.label.toUpperCase()}   ▼ ${b.label.toUpperCase()}`, 6 * dpr, (y0 + y1) / 2);
        bg.textAlign = 'right'; bg.fillStyle = 'rgba(255,255,255,0.45)';
        bg.fillText('CONCOURSE', W - 6 * dpr, (y0 + y1) / 2);
      }
    }
    // the corners, where one stand meets the next
    bg.strokeStyle = 'rgba(255,255,255,0.5)'; bg.lineWidth = Math.max(1, dpr); bg.setLineDash([4 * dpr, 4 * dpr]);
    for (const s of G.stands) if (s.x0 > 0.001) { const x = Math.round(s.x0 * W) + 0.5; bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, H); bg.stroke(); }
    bg.setLineDash([]);
    // stand centres: a tick top and bottom
    bg.fillStyle = 'rgba(255,255,255,0.35)';
    for (const s of G.stands) { const x = s.cx * W; bg.fillRect(x - dpr / 2, 0, dpr, cs * 0.35); bg.fillRect(x - dpr / 2, H - cs * 0.35, dpr, cs * 0.35); }
    // the tunnel cuts through the lower tier: those cells aren't on the stand
    const lo = G.bands.find((b) => b.key === 'lower'), t = BOWL_GRID.tunnel;
    const x0 = (t.x - t.w / 2) * W, x1 = (t.x + t.w / 2) * W, y0 = rowTop(lo.r0), y1 = H;
    bg.save(); bg.beginPath(); bg.rect(x0, y0, x1 - x0, y1 - y0); bg.clip();
    bg.fillStyle = 'rgba(0,0,0,0.72)'; bg.fillRect(x0, y0, x1 - x0, y1 - y0);
    bg.strokeStyle = 'rgba(255,234,0,0.35)'; bg.lineWidth = dpr;
    for (let x = x0 - (y1 - y0); x < x1; x += 6 * dpr) { bg.beginPath(); bg.moveTo(x, y1); bg.lineTo(x + (y1 - y0), y0); bg.stroke(); }
    bg.restore();
    bg.fillStyle = '#ffea00'; bg.beginPath(); bg.moveTo((x0 + x1) / 2, H - cs * 0.55); bg.lineTo((x0 + x1) / 2 - cs * 0.4, H); bg.lineTo((x0 + x1) / 2 + cs * 0.4, H); bg.closePath(); bg.fill();
  }
  function buildRuler() {
    ruler.innerHTML = G.bowl ? G.stands.map((s) => `<span class="tb-st${s.end ? ' is-end' : ''}" style="left:${(s.x0 * 100).toFixed(3)}%;width:${((s.x1 - s.x0) * 100).toFixed(3)}%"><b>${s.label}</b></span>`).join('')
      + `<span class="tb-tun" style="left:${(BOWL_GRID.tunnel.x * 100).toFixed(3)}%">Tunnel</span>` : '';
  }

  /* ── the preview ── */
  // whole stadium: the bowl from above, the design laid round its rings (screen y down = toward the tunnel)
  let ring = null;
  function ringPts() {
    const W = prev.width, H = prev.height, s = Math.min(W / 246, H / 204) * 0.98, cx = W / 2, cy = H / 2;
    const P = (x, key, v) => { const [X, Z] = BOWL_GRID.pointAt(x, key, v); return [cx + X * s, cy + Z * s]; };
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      const b = G.bands.find((x) => r >= x.r0 && r < x.r1), n = b.r1 - b.r0;
      const vb = 1 - (r - b.r0) / n, vf = 1 - (r + 1 - b.r0) / n, back = [], front = [];
      for (let c = 0; c <= COLS; c++) { back.push(P(c / COLS, b.key, vb)); front.push(P(c / COLS, b.key, vf)); }
      rows.push({ back, front });
    }
    // the rings between the tiers (concourse + LED ribbon), and the tunnel's cut
    const loop = (key, v) => Array.from({ length: 129 }, (_, i) => P(i / 128, key, v));
    const bands = [['lower', 1, 'middle', 0], ['middle', 1, 'upper', 0]].map(([a, va, b, vb]) => ({ outer: loop(b, vb), inner: loop(a, va) }));
    const t = BOWL_GRID.tunnel;
    const tun = [P(t.x - t.w / 2, 'lower', -0.06), P(t.x + t.w / 2, 'lower', -0.06), P(t.x + t.w / 2, 'lower', 1), P(t.x - t.w / 2, 'lower', 1)];
    return { s, cx, cy, rows, bands, tun };
  }
  const poly = (pts) => { pg.beginPath(); pg.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) pg.lineTo(pts[i][0], pts[i][1]); pg.closePath(); };
  function drawBowlPreview() {
    const W = prev.width, H = prev.height;
    if (!ring) ring = ringPts();
    const { s, cx, cy, rows, bands, tun } = ring;
    pg.fillStyle = '#050506'; pg.fillRect(0, 0, W, H);
    const halo = pg.createRadialGradient(cx, cy, 0, cx, cy, W * 0.55);
    halo.addColorStop(0, 'rgba(255,248,220,0.1)'); halo.addColorStop(1, 'rgba(255,248,220,0)');
    pg.fillStyle = halo; pg.fillRect(0, 0, W, H);
    for (let r = 0; r < ROWS; r++) {
      const { back, front } = rows[r];
      for (let c = 0; c < COLS; c++) {
        const v = cells[r * COLS + c];
        pg.fillStyle = v < 0 ? EMPTY_HEX : PAL[v].hex;
        poly([back[c], back[c + 1], front[c + 1], front[c]]); pg.fill();
        pg.strokeStyle = pg.fillStyle; pg.lineWidth = 0.6; pg.stroke();   // no hairline seams between the cells
      }
    }
    for (const b of bands) {
      pg.fillStyle = '#07080a'; pg.beginPath();
      pg.moveTo(...b.outer[0]); b.outer.forEach((p) => pg.lineTo(p[0], p[1])); pg.closePath();
      pg.moveTo(...b.inner[0]); [...b.inner].reverse().forEach((p) => pg.lineTo(p[0], p[1])); pg.closePath();
      pg.fill('evenodd');
      pg.strokeStyle = 'rgba(15,134,196,0.85)'; pg.lineWidth = Math.max(1, dpr * 0.8);
      pg.beginPath(); b.outer.forEach((p, i) => { const q = b.inner[i], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; i ? pg.lineTo(...m) : pg.moveTo(...m); }); pg.closePath(); pg.stroke();
    }
    pg.fillStyle = '#050506'; poly(tun); pg.fill();
    // the pitch
    const pw = 105 * s, ph = 68 * s, px = cx - pw / 2, py = cy - ph / 2;
    pg.fillStyle = '#1b5a28'; pg.fillRect(px - 6 * s, py - 6 * s, pw + 12 * s, ph + 12 * s);
    pg.strokeStyle = 'rgba(255,255,255,0.7)'; pg.lineWidth = Math.max(1, dpr * 0.8);
    pg.strokeRect(px, py, pw, ph);
    pg.beginPath(); pg.moveTo(cx, py); pg.lineTo(cx, py + ph); pg.stroke();
    pg.beginPath(); pg.arc(cx, cy, 9.15 * s, 0, Math.PI * 2); pg.stroke();
    pg.strokeRect(px, cy - 20 * s, 16.5 * s, 40 * s); pg.strokeRect(px + pw - 16.5 * s, cy - 20 * s, 16.5 * s, 40 * s);
    // you walk out of the tunnel here
    pg.fillStyle = '#ffea00';
    const tx = (tun[0][0] + tun[1][0]) / 2, ty = tun[0][1];
    pg.beginPath(); pg.moveTo(tx, ty - 5 * dpr); pg.lineTo(tx - 4 * dpr, ty + 1 * dpr); pg.lineTo(tx + 4 * dpr, ty + 1 * dpr); pg.closePath(); pg.fill();
  }
  // far stand: the design on a sketch of the stand, seen from the touchline
  function drawStandPreview() {
    const W = prev.width, H = prev.height;
    const sky = pg.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0b0d12'); sky.addColorStop(1, '#030304');
    pg.fillStyle = sky; pg.fillRect(0, 0, W, H);
    for (const x of [0.06, 0.94]) {
      const gl = pg.createRadialGradient(W * x, H * 0.05, 0, W * x, H * 0.05, W * 0.3);
      gl.addColorStop(0, 'rgba(255,248,220,0.35)'); gl.addColorStop(1, 'rgba(255,248,220,0)');
      pg.fillStyle = gl; pg.fillRect(0, 0, W, H);
    }
    const top = H * 0.1, bot = H * 0.74, tw = W * 0.8, bwid = W * 0.97, sag = H * 0.1;
    const P = (u, v) => [W / 2 + (u - 0.5) * (tw + (bwid - tw) * v), top + (bot - top) * v + (u - 0.5) ** 2 * 4 * sag * (1 - 0.4 * v)];
    pg.fillStyle = '#000';
    const quad = (u0, v0, u1, v1, inset) => {
      const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1);
      pg.beginPath(); pg.moveTo(a[0] + inset, a[1] + inset); pg.lineTo(b[0] - inset, b[1] + inset); pg.lineTo(c[0] - inset, c[1] - inset); pg.lineTo(d[0] + inset, d[1] - inset); pg.closePath(); pg.fill();
    };
    quad(-0.01, -0.02, 1.01, 1.02, 0);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = cells[r * COLS + c];
      pg.fillStyle = v < 0 ? EMPTY_HEX : PAL[v].hex;
      quad(c / COLS, r / ROWS, (c + 1) / COLS, (r + 1) / ROWS, 0.35 * dpr);
    }
    // the concourses and their LED fascias
    for (const [a, b] of hidden) {
      pg.fillStyle = '#07080a'; quad(-0.01, a, 1.01, b, 0);
      pg.fillStyle = 'rgba(255,234,0,0.55)'; quad(0, a + (b - a) * 0.35, 1, a + (b - a) * 0.6, 0);
    }
    // pitch
    const pitch = pg.createLinearGradient(0, H * 0.8, 0, H);
    pitch.addColorStop(0, '#14451f'); pitch.addColorStop(1, '#1f6b2e');
    pg.fillStyle = pitch; pg.fillRect(0, H * 0.8, W, H * 0.2);
    pg.fillStyle = 'rgba(255,255,255,0.75)'; pg.fillRect(0, H * 0.83, W, Math.max(1, dpr));
  }
  function drawPreview() { if (!prev.width || !prev.height) return; if (G.bowl) drawBowlPreview(); else drawStandPreview(); }
  function paint() { cancelAnimationFrame(raf); raf = 0; drawBoard(); drawPreview(); }
  const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };

  /* ── tools ── */
  const brushOrigin = (c, r) => {
    const o = Math.floor((size - 1) / 2);
    return [Math.min(COLS - size, Math.max(0, c - o)), Math.min(ROWS - size, Math.max(0, r - o))];
  };
  function stamp(c, r) {
    const [c0, r0] = brushOrigin(c, r), v = tool === 'erase' ? EMPTY : colour;
    let changed = false;
    for (let y = r0; y < r0 + size; y++) for (let x = c0; x < c0 + size; x++) {
      const i = y * COLS + x;
      if (cells[i] !== v) { cells[i] = v; changed = true; }
    }
    return changed;
  }
  function line(a, b) {
    let changed = false;
    const n = Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      changed = stamp(Math.round(a.c + (b.c - a.c) * t), Math.round(a.r + (b.r - a.r) * t)) || changed;
    }
    return changed;
  }
  function flood(c, r) {
    const from = cells[r * COLS + c];
    if (from === colour) return false;
    const st = [[c, r]];
    while (st.length) {
      const [x0, y] = st.pop();
      // round the bowl the picture has no left or right edge: the fill runs on across the seam
      const x = G.bowl ? ((x0 % COLS) + COLS) % COLS : x0;
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS || cells[y * COLS + x] !== from) continue;
      cells[y * COLS + x] = colour;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return true;
  }
  const cellOf = (e) => {
    const r = board.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const c = Math.floor(fx * COLS), rr = rowAt(fy * board.height);
    return { c: Math.min(COLS - 1, Math.max(0, c)), r: Math.min(ROWS - 1, Math.max(0, rr)), inside: fx >= 0 && fy >= 0 && fx < 1 && fy < 1 };
  };

  board.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    const p = cellOf(e);
    snapshot();
    if (tool === 'fill') {
      if (flood(p.c, p.r)) { feel.tap(); save(); } else undo.pop();
      hover = e.pointerType === 'mouse' ? p : null;
      queue();
      return;
    }
    try { board.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    drawing = { id: e.pointerId, last: p, changed: stamp(p.c, p.r) };
    if (drawing.changed) feel.buzz(4);
    hover = e.pointerType === 'mouse' ? p : null;
    queue();
  });
  board.addEventListener('pointermove', (e) => {
    const p = cellOf(e);
    if (drawing && e.pointerId === drawing.id) {
      if (p.c !== drawing.last.c || p.r !== drawing.last.r) { drawing.changed = line(drawing.last, p) || drawing.changed; drawing.last = p; }
    }
    hover = e.pointerType === 'mouse' && p.inside ? p : null;
    queue();
  });
  const endStroke = (e) => {
    if (!drawing || e.pointerId !== drawing.id) return;
    if (drawing.changed) save(); else undo.pop();
    drawing = null;
    if (e.pointerType !== 'mouse') hover = null;
    queue();
  };
  board.addEventListener('pointerup', endStroke);
  board.addEventListener('pointercancel', endStroke);
  board.addEventListener('pointerleave', () => { if (!drawing) { hover = null; queue(); } });
  board.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ── controls ── */
  const setTool = (t) => {
    tool = t;
    root.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('is-on', b.dataset.tool === t));
    queue();
  };
  const setColour = (i) => {
    colour = i;
    root.querySelectorAll('.tb-sw').forEach((b) => { const on = +b.dataset.c === i; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
    if (tool === 'erase') setTool('paint');
  };
  const setSize = (n) => {
    size = n;
    $('.tb-size span').textContent = `Size ${n}`;
    $('.tb-dot').style.setProperty('--s', n);
    queue();
  };
  const doUndo = () => { const s = undo.pop(); if (s) { cells = s; feel.back(); save(); queue(); } };
  const doClear = () => { if (cells.every((v) => v === EMPTY)) return; snapshot(); cells.fill(EMPTY); feel.back(); save(); queue(); };

  root.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { feel.tap(); setTool(b.dataset.tool); }));
  root.querySelectorAll('.tb-sw').forEach((b) => b.addEventListener('click', () => { feel.tap(); setColour(+b.dataset.c); }));
  $('.tb-size').addEventListener('click', () => { feel.tap(); setSize(size % 3 + 1); });
  $('.tb-undo').addEventListener('click', doUndo);
  $('.tb-clear').addEventListener('click', doClear);

  const tplCache = new Map();
  const tpl = (id) => { const k = `${mode}:${id}`; if (!tplCache.has(k)) tplCache.set(k, TEMPLATES.find((t) => t.id === id).make(G)); return tplCache.get(k); };
  const thumbs = () => {
    root.querySelectorAll('.tb-tpl').forEach((b) => {
      const cv = b.querySelector('canvas');
      cv.width = COLS; cv.height = ROWS;
      const g = cv.getContext('2d'), d = tpl(b.dataset.t), img = g.createImageData(COLS, ROWS);
      d.forEach((v, i) => img.data.set([...PAL_RGB[v], 255], i * 4));
      g.putImageData(img, 0, 0);
    });
  };
  root.querySelectorAll('.tb-tpl').forEach((b) => b.addEventListener('click', () => {
    snapshot();
    cells = tpl(b.dataset.t).slice();
    feel.tap(); save(); queue();
  }));

  /* ── where it goes: the whole stadium or the far stand (each keeps its own design) ── */
  function setMode(m, { quiet = false } = {}) {
    if (!MODES[m]) m = 'bowl';
    if (active && m !== mode && saveT) saveNow();   // the design you leave is kept
    mode = m; G = MODES[m]; COLS = G.cols; ROWS = G.rows;
    root.classList.toggle('is-bowl', G.bowl);
    root.querySelectorAll('.tb-mb').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
    $('.tb-hint').textContent = COPY[m].hint; $('.tb-plab').textContent = COPY[m].plab; $('.tb-note').textContent = COPY[m].note;
    prev.setAttribute('aria-label', COPY[m].prev);
    undo.length = 0;
    if (!load()) cells = tpl(G.start).slice();
    hover = null; drawing = null;
    buildRuler();
    thumbs();
    if (!quiet) { try { localStorage.setItem(MODE_KEY, m); } catch { /* private mode */ } }
    if (active) requestAnimationFrame(fitBoard);
  }
  root.querySelectorAll('.tb-mb').forEach((b) => b.addEventListener('click', () => { if (b.dataset.mode === mode) return; feel.tap(); setMode(b.dataset.mode); }));

  $('.tb-back').addEventListener('click', () => { feel.back(); close(); cbs.onClose?.(); });
  $('.tb-raise').addEventListener('click', () => {
    if (!active || root.classList.contains('is-raising')) return;
    const cv = toCanvas();
    saveNow();
    root.classList.add('is-raising');
    try { cbs.onRaise?.(cv); } catch (err) { console.warn('[tifo-builder] onRaise', err); }
    progress.played('tifo');
    feel.win(); feel.roar(); feel.confetti({ n: 220 });
    // the stand takes over: the overlay steps aside so the camera move reads (onClose is for "Back" only)
    closeT = setTimeout(() => close(), 900);
  });

  const onKey = (e) => {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); $('.tb-back').click(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || e.target?.closest?.('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= String(PAL.length)) setColour(+k - 1);
    else if (k === 'b' || k === 'p') setTool('paint');
    else if (k === 'f') setTool('fill');
    else if (k === 'e') setTool('erase');
    else if (k === 's') setSize(size % 3 + 1);
  };
  const ro = new ResizeObserver(() => active && fitBoard());
  ro.observe(centre);
  ro.observe(prev);

  // open({ onRaise, onClose, hidden, mode }): mode 'bowl' | 'far' (default: the last one used, else the whole stadium)
  function open({ onRaise, onClose, hidden: h, mode: m } = {}) {
    cbs = { onRaise, onClose };
    if (Array.isArray(h) && h.length) hidden = h;
    clearTimeout(closeT);
    setMode(m || savedMode() || 'bowl', { quiet: !m });
    $('.tb-xp').textContent = progress.has('tifo') ? '' : `+60 XP`;
    root.classList.remove('is-raising', 'is-out');
    root.hidden = false;
    active = true;
    addEventListener('keydown', onKey);
    // the templates' text needs the fonts in before it's measured
    Promise.all([document.fonts?.load('400 40px Anton'), document.fonts?.load('700 40px Cairo', 'الاتحاد')]).catch(() => {}).then(() => { tplCache.clear(); thumbs(); });
    requestAnimationFrame(() => { root.classList.add('is-in'); fitBoard(); });
    $('.tb-raise').focus({ preventScroll: true });
  }
  function close() {
    if (!active) return;
    active = false;
    clearTimeout(closeT);
    removeEventListener('keydown', onKey);
    drawing = null; hover = null;
    root.classList.remove('is-in');
    root.classList.add('is-out');
    setTimeout(() => { if (!active) { root.hidden = true; root.classList.remove('is-out', 'is-raising'); } }, 320);
  }

  return {
    open,
    close,
    get active() { return active; },
    get mode() { return mode; },
    setMode(m) { setMode(m); if (active) queue(); },
    // the current design as a canvas (one pixel per cell, dataset.tifo = its mode), e.g. to put it back up after a reload
    toCanvas() { if (!active) { setMode(savedMode() || 'bowl', { quiet: true }); } return toCanvas(); },
    get saved() { try { return !!(localStorage.getItem(MODES.bowl.key) || localStorage.getItem(MODES.far.key)); } catch { return false; } },
  };
}
