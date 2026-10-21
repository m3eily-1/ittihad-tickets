// Tifo builder (Ahmed, 2026-10-21: "make it feel like a game"): paint your own card display on a grid in the
// far stand's shape, preview it on a sketch of the stand, then raise it. The caller hands the finished canvas
// to tifo.setCustom(canvas) (tifo.js) and flies the camera to the stand; this module only owns the overlay.
//
//   const tb = mountTifoBuilder();
//   tb.open({ onRaise(canvas) { … }, onClose() { … }, hidden: tifo.hidden });
//
// The design is 52 × 16 cells (the stand reads ~3.25 : 1 from the touchline, tifo.aspect) and is kept in
// localStorage 'itt-tifo-v1'. Templates are drawn procedurally, no artwork is used.
import '@fontsource/anton/400.css';
import '@fontsource/cairo/700.css';
import './tifo-builder.css';
import { progress } from './progress.js';
import { feel } from './feel.js';

export const TB_COLS = 52, TB_ROWS = 16;
const KEY = 'itt-tifo-v1';
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
// the concourse bands the stand hides (fractions of the picture from the top), as tifo.hidden measures them
const HIDDEN_DEFAULT = [[0.59, 0.677], [0.28, 0.355]];

/* ── templates: drawn on a supersampled canvas, then each cell takes the nearest of the template's colours ── */
const SS = 10;
function raster(draw, allowed) {
  const W = TB_COLS * SS, H = TB_ROWS * SS;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = PAL[K].hex; g.fillRect(0, 0, W, H);
  draw(g, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const out = new Int8Array(TB_COLS * TB_ROWS);
  for (let r = 0; r < TB_ROWS; r++) for (let c = 0; c < TB_COLS; c++) {
    let R = 0, G = 0, B = 0, n = 0;
    for (let y = r * SS + 3; y < (r + 1) * SS - 3; y++) for (let x = c * SS + 3; x < (c + 1) * SS - 3; x++) {
      const k = (y * W + x) * 4; R += px[k]; G += px[k + 1]; B += px[k + 2]; n++;
    }
    R /= n; G /= n; B /= n;
    let best = allowed[0], bd = Infinity;
    for (const i of allowed) { const p = PAL_RGB[i]; const d = (R - p[0]) ** 2 + (G - p[1]) ** 2 + (B - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
    out[r * TB_COLS + c] = best;
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
function blit(out, text, colour, top, gap = 2) {
  const w = [...text].reduce((s, ch) => s + GLYPHS[ch][0].length, 0) + (text.length - 1) * gap;
  let x0 = Math.floor((TB_COLS - w) / 2);
  for (const ch of text) {
    GLYPHS[ch].forEach((row, r) => [...row].forEach((v, c) => { if (v === 'X') out[(top + r) * TB_COLS + x0 + c] = colour; }));
    x0 += GLYPHS[ch][0].length + gap;
  }
}

const TEMPLATES = [
  { id: 'stripes', label: 'Stripes', make: () => raster((g, W, H) => stripes(g, W, H, 0, W, SS * 4), [Y, K]) },
  { id: 'year', label: '1927', make: () => {
    // at 16 rows a font smears, so the year is set in hand-cut block digits
    const out = raster((g, W, H) => {
      wings(g, W, H, 0.31);
      g.fillStyle = PAL[Y].hex; g.fillRect(W * 0.19 + SS, 0, W * 0.62 - 2 * SS, SS); g.fillRect(W * 0.19 + SS, H - SS, W * 0.62 - 2 * SS, SS);
    }, [Y, K]);
    blit(out, '1927', Y, 3);
    return out;
  } },
  { id: 'one', label: 'The “1”', make: () => raster((g, W, H) => {
    // the number one in blocks, flanked by the club's stripes
    wings(g, W, H, 0.17);
    const u = H / 16, cx = W / 2;
    g.fillStyle = PAL[Y].hex;
    g.beginPath();
    g.moveTo(cx - u * 1.2, u * 1.5); g.lineTo(cx + u * 2, u * 1.5); g.lineTo(cx + u * 2, u * 12); g.lineTo(cx + u * 4.2, u * 12);
    g.lineTo(cx + u * 4.2, u * 14.5); g.lineTo(cx - u * 4.2, u * 14.5); g.lineTo(cx - u * 4.2, u * 12); g.lineTo(cx - u * 2, u * 12);
    g.lineTo(cx - u * 2, u * 6); g.lineTo(cx - u * 4.4, u * 6); g.lineTo(cx - u * 4.4, u * 3.8); g.closePath(); g.fill();
    g.fillStyle = PAL[Wh].hex; g.fillRect(cx + u * 5.2, u * 1.5, SS, u * 13); g.fillRect(cx - u * 5.2 - SS, u * 1.5, SS, u * 13);
  }, [Y, K, Wh]) },
  { id: 'ittihad', label: 'ITTIHAD', make: () => {
    const out = new Int8Array(TB_COLS * TB_ROWS).fill(K);
    for (let c = 0; c < TB_COLS; c++) { out[c] = out[15 * TB_COLS + c] = Y; out[TB_COLS + c] = out[14 * TB_COLS + c] = Wh; }
    blit(out, 'ITTIHAD', Y, 3);
    return out;
  } },
  { id: 'tiger', label: 'Tiger', make: () => {
    // tiger hide: tapered, wavy black stripes reaching in from the front and back rows over a yellow field,
    // with an amber burn along their edges (seeded, so it's the same every time)
    let sd = 1927;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const out = new Int8Array(TB_COLS * TB_ROWS).fill(Y);
    let n = 0;
    for (let x = 2; x < TB_COLS - 1; x += 4.6 + rnd() * 2) {
      const fromTop = n++ % 2 === 0, len = 0.55 + rnd() * 0.4, w0 = 1.05 + rnd() * 0.6, ph = rnd() * 6.3, amp = 0.6 + rnd() * 0.9, lean = (rnd() - 0.5) * 0.3;
      for (let r = 0; r < TB_ROWS; r++) {
        const t = (fromTop ? r : TB_ROWS - 1 - r) / (TB_ROWS - 1);
        if (t > len) continue;
        const hw = w0 * Math.pow(1 - t / len, 0.6) + 0.15, cx = x + amp * Math.sin(r * 0.5 + ph) + lean * (fromTop ? r : TB_ROWS - 1 - r);
        for (let c = Math.floor(cx - hw - 1); c <= Math.ceil(cx + hw + 1); c++) {
          if (c < 0 || c >= TB_COLS) continue;
          const d = Math.abs(c + 0.5 - cx), i = r * TB_COLS + c;
          if (d < hw) out[i] = K;
          else if (c + 0.5 > cx && d < hw + 1 && out[i] === Y) out[i] = AMBER; // the burn on one side only
        }
      }
    }
    return out;
  } },
  { id: 'arabic', label: 'الاتحاد', make: () => raster((g, W, H) => {
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
      <div class="tb-title"><p class="tb-kick">Mini-game · صمّم التيفو</p><h2 class="tb-h">Tifo builder</h2></div>
      <p class="tb-hint">Every square is a block of fans holding up a card.</p>
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
        <div class="tb-stage"><canvas class="tb-board" aria-label="Tifo grid: drag to paint"></canvas></div>
        <div class="tb-tpls" aria-label="Templates">
          <span class="tb-tlab">Templates</span>
          ${TEMPLATES.map((t) => `<button class="tb-tpl" data-t="${t.id}" type="button"><canvas width="${TB_COLS}" height="${TB_ROWS}"></canvas><span>${t.label}</span></button>`).join('')}
        </div>
      </div>
      <div class="tb-side">
        <p class="tb-plab">On the stand</p>
        <canvas class="tb-prev" aria-label="Preview of the tifo on the far stand"></canvas>
        <button class="tb-raise" type="button"><span class="tb-rt">Raise the tifo</span><span class="tb-xp"></span></button>
        <p class="tb-note">The far stand flips its cards to your design.</p>
      </div>
    </div>
    <div class="tb-flash" aria-hidden="true"><b>Tifo up!</b></div>`;
  document.body.append(root);

  const $ = (s) => root.querySelector(s);
  const board = $('.tb-board'), stage = $('.tb-stage'), prev = $('.tb-prev'), centre = $('.tb-centre'), tpls = $('.tb-tpls');
  const bg = board.getContext('2d'), pg = prev.getContext('2d');

  let cells = new Int8Array(TB_COLS * TB_ROWS).fill(EMPTY);
  let tool = 'paint', colour = Y, size = 1, hidden = HIDDEN_DEFAULT;
  let active = false, cbs = {}, hover = null, drawing = null, raf = 0, saveT = 0, closeT = 0;
  const undo = [];

  /* ── persistence ── */
  const save = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify({ v: 1, cols: TB_COLS, rows: TB_ROWS, cells: Array.from(cells, (v) => (v < 0 ? '.' : v)).join('') })); } catch { /* private mode */ }
    }, 250);
  };
  const load = () => {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d?.cols === TB_COLS && d.rows === TB_ROWS && d.cells?.length === TB_COLS * TB_ROWS) {
        cells = Int8Array.from(d.cells, (ch) => (ch === '.' ? EMPTY : Math.min(PAL.length - 1, +ch || 0)));
        return true;
      }
    } catch { /* nothing saved */ }
    return false;
  };
  const snapshot = () => { undo.push(cells.slice()); if (undo.length > 40) undo.shift(); };

  /* ── the design as a canvas, one pixel per cell (what onRaise hands over) ── */
  function toCanvas() {
    const cv = document.createElement('canvas'); cv.width = TB_COLS; cv.height = TB_ROWS;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const img = g.createImageData(TB_COLS, TB_ROWS), e = rgbOf(EMPTY_HEX);
    cells.forEach((v, i) => { const p = v < 0 ? e : PAL_RGB[v]; img.data.set([p[0], p[1], p[2], 255], i * 4); });
    g.putImageData(img, 0, 0);
    return cv;
  }

  /* ── drawing the board ── */
  let bw = 0, bh = 0, dpr = 1;
  const upright = matchMedia('(max-width: 640px) and (orientation: portrait)');
  function fitBoard() {
    // the board takes the centre column's width, or its height less the templates row, whichever is tighter
    // (held upright the overlay scrolls, so only the width counts)
    const cw = stage.clientWidth, ch = upright.matches ? Infinity : centre.clientHeight - tpls.offsetHeight - 12;
    if (!cw || ch <= 0) return;
    const asp = TB_COLS / TB_ROWS;
    bw = Math.floor(Math.min(cw, ch * asp)); bh = Math.floor(bw / asp);
    dpr = Math.min(2, devicePixelRatio || 1);
    board.style.width = `${bw}px`; board.style.height = `${bh}px`;
    board.width = Math.round(bw * dpr); board.height = Math.round(bh * dpr);
    const pr = prev.getBoundingClientRect();
    prev.width = Math.round(pr.width * dpr); prev.height = Math.round(pr.height * dpr);
    paint();
  }
  const hexOf = (v) => (v < 0 ? null : PAL[v].hex);
  function drawBoard() {
    const W = board.width, H = board.height, cs = W / TB_COLS, gap = Math.max(1, cs * 0.09);
    bg.fillStyle = '#050505'; bg.fillRect(0, 0, W, H);
    for (let r = 0; r < TB_ROWS; r++) for (let c = 0; c < TB_COLS; c++) {
      const v = cells[r * TB_COLS + c], x = c * cs, y = r * cs;
      bg.fillStyle = hexOf(v) || ((r + c) & 1 ? '#191919' : '#1e1e1e');
      bg.fillRect(x + gap / 2, y + gap / 2, cs - gap, cs - gap);
    }
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
    // the brush under the pointer
    if (hover && tool !== 'fill') {
      const [c0, r0] = brushOrigin(hover.c, hover.r);
      bg.strokeStyle = tool === 'erase' ? '#ffffff' : '#ffea00'; bg.lineWidth = 2 * dpr;
      bg.strokeRect(c0 * cs + dpr, r0 * cs + dpr, size * cs - 2 * dpr, size * cs - 2 * dpr);
    } else if (hover) {
      bg.strokeStyle = '#ffea00'; bg.lineWidth = 2 * dpr;
      bg.strokeRect(hover.c * cs + dpr, hover.r * cs + dpr, cs - 2 * dpr, cs - 2 * dpr);
    }
  }

  /* ── the preview: the design on a sketch of the far stand, seen from the touchline ── */
  function drawPreview() {
    const W = prev.width, H = prev.height;
    if (!W || !H) return;
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
    for (let r = 0; r < TB_ROWS; r++) for (let c = 0; c < TB_COLS; c++) {
      const v = cells[r * TB_COLS + c];
      pg.fillStyle = v < 0 ? EMPTY_HEX : PAL[v].hex;
      quad(c / TB_COLS, r / TB_ROWS, (c + 1) / TB_COLS, (r + 1) / TB_ROWS, 0.35 * dpr);
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
  function paint() { cancelAnimationFrame(raf); raf = 0; drawBoard(); drawPreview(); }
  const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };

  /* ── tools ── */
  const brushOrigin = (c, r) => {
    const o = Math.floor((size - 1) / 2);
    return [Math.min(TB_COLS - size, Math.max(0, c - o)), Math.min(TB_ROWS - size, Math.max(0, r - o))];
  };
  function stamp(c, r) {
    const [c0, r0] = brushOrigin(c, r), v = tool === 'erase' ? EMPTY : colour;
    let changed = false;
    for (let y = r0; y < r0 + size; y++) for (let x = c0; x < c0 + size; x++) {
      const i = y * TB_COLS + x;
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
    const from = cells[r * TB_COLS + c];
    if (from === colour) return false;
    const st = [[c, r]];
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < 0 || x >= TB_COLS || y >= TB_ROWS || cells[y * TB_COLS + x] !== from) continue;
      cells[y * TB_COLS + x] = colour;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return true;
  }
  const cellOf = (e) => {
    const r = board.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left) / r.width) * TB_COLS), rr = Math.floor(((e.clientY - r.top) / r.height) * TB_ROWS);
    return { c: Math.min(TB_COLS - 1, Math.max(0, c)), r: Math.min(TB_ROWS - 1, Math.max(0, rr)), inside: c >= 0 && rr >= 0 && c < TB_COLS && rr < TB_ROWS };
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
  const tpl = (id) => { if (!tplCache.has(id)) tplCache.set(id, TEMPLATES.find((t) => t.id === id).make()); return tplCache.get(id); };
  const thumbs = () => {
    root.querySelectorAll('.tb-tpl').forEach((b) => {
      const g = b.querySelector('canvas').getContext('2d'), d = tpl(b.dataset.t), img = g.createImageData(TB_COLS, TB_ROWS);
      d.forEach((v, i) => img.data.set([...PAL_RGB[v], 255], i * 4));
      g.putImageData(img, 0, 0);
    });
  };
  root.querySelectorAll('.tb-tpl').forEach((b) => b.addEventListener('click', () => {
    snapshot();
    cells = tpl(b.dataset.t).slice();
    feel.tap(); save(); queue();
  }));

  $('.tb-back').addEventListener('click', () => { feel.back(); close(); cbs.onClose?.(); });
  $('.tb-raise').addEventListener('click', () => {
    if (!active || root.classList.contains('is-raising')) return;
    const cv = toCanvas();
    clearTimeout(saveT); saveT = 0;
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, cols: TB_COLS, rows: TB_ROWS, cells: Array.from(cells, (v) => (v < 0 ? '.' : v)).join('') })); } catch { /* private mode */ }
    root.classList.add('is-raising');
    try { cbs.onRaise?.(cv); } catch (err) { console.warn('[tifo-builder] onRaise', err); }
    progress.played('tifo');
    progress.achieve('tifo');
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

  function open({ onRaise, onClose, hidden: h } = {}) {
    cbs = { onRaise, onClose };
    if (Array.isArray(h) && h.length) hidden = h;
    clearTimeout(closeT);
    undo.length = 0;
    if (!load()) cells = tpl('year').slice();
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
    // the current design as a canvas (TB_COLS × TB_ROWS), e.g. to put it back up after a reload
    toCanvas() { if (!active) load(); return toCanvas(); },
    get saved() { try { return !!localStorage.getItem(KEY); } catch { return false; } },
  };
}
