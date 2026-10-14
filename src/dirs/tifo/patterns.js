// Tifo designs for the three.js stand. Each design is drawn on a 2D canvas in "visual" space
// (cells are taller than wide when seen from the pitch), supersampled, then quantised to the
// three card colours and written into an RGBA grid the shader samples per card.

export const PAL = {
  Y: [254, 242, 1],
  K: [18, 18, 18],
  W: [242, 236, 222],
};
const LIST = [PAL.Y, PAL.K, PAL.W];

function nearest(r, g, b) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < LIST.length; i++) {
    const p = LIST[i];
    const d = (r - p[0]) ** 2 * 0.9 + (g - p[1]) ** 2 * 1.2 + (b - p[2]) ** 2 * 0.7;
    if (d < bd) { bd = d; best = i; }
  }
  return LIST[best];
}

/**
 * @param {object} grid {cols, rows, ca (visual cell aspect h/w), gapAt (row index where the upper tier starts), gapRows}
 * @param {(ctx, W, H) => void} draw  paints the design on a canvas of size W × H (top = back row)
 */
export function rasterize(grid, draw, { ss = 4, bg = '#121212' } = {}) {
  const { cols, rows, ca, gapAt = rows, gapRows = 0 } = grid;
  // gaps: [[row, n], …] — the concourses between tiers eat part of the picture, like a real tifo
  const gaps = grid.gaps || [[gapAt, gapRows]];
  const vRows = rows + gaps.reduce((s, g) => s + g[1], 0);
  const vrOf = (r) => r + gaps.reduce((s, [at, n]) => s + (r >= at ? n : 0), 0);
  const W = cols * ss, H = Math.round(vRows * ca * ss);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  draw(ctx, W, H);
  const img = ctx.getImageData(0, 0, W, H).data;
  const out = new Uint8Array(cols * rows * 4);
  const rowH = ca * ss;
  for (let r = 0; r < rows; r++) {
    const vr = vrOf(r); // visual row counted from the front (bottom)
    const y0 = Math.floor(H - (vr + 1) * rowH), y1 = Math.floor(H - vr * rowH);
    for (let c = 0; c < cols; c++) {
      let R = 0, Gs = 0, B = 0, n = 0;
      // sample the middle of the cell (avoid bleeding from neighbours)
      for (let y = y0 + Math.floor(rowH * 0.2); y < y1 - Math.floor(rowH * 0.2); y += 1) {
        const inset = ss > 2 ? 1 : 0;
        for (let x = c * ss + inset; x < (c + 1) * ss - inset; x++) {
          const k = (y * W + x) * 4;
          R += img[k]; Gs += img[k + 1]; B += img[k + 2]; n++;
        }
      }
      const p = n ? nearest(R / n, Gs / n, B / n) : PAL.K;
      const o = (r * cols + c) * 4;
      out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = 255;
    }
  }
  out.canvas = cv; out.rowH = rowH; // the whole picture, incl. rows hidden by the concourse
  return out;
}

/* ── shared dressing: the crest's own black/yellow stripes on the wings ── */
function wings(ctx, W, H, inner = 0.27) {
  const band = W * 0.024;
  ctx.save();
  for (const side of [-1, 1]) {
    const x0 = W / 2 + side * W * inner;
    for (let i = 0; i < 40; i++) {
      const x = side < 0 ? x0 - (i + 1) * band * 2 : x0 + i * band * 2 + band;
      if (x < -band || x > W + band) continue;
      ctx.fillStyle = '#fef201';
      ctx.fillRect(x, 0, band, H);
    }
  }
  ctx.restore();
}
function frame(ctx, W, H) {
  // thin yellow rule along the front and back rows
  ctx.fillStyle = '#fef201';
  ctx.fillRect(0, 0, W, H * 0.022);
  ctx.fillRect(0, H * 0.978, W, H * 0.022);
}

// fits Anton text by cap height into a box; returns the font size used
function fitText(ctx, text, cx, cy, maxW, maxH, color, { font = 'Anton', track = 0.02 } = {}) {
  let size = maxH * 1.35;
  ctx.font = `400 ${size}px ${font}`;
  let m = ctx.measureText(text);
  let capH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  size *= maxH / capH;
  ctx.font = `400 ${size}px ${font}`;
  ctx.letterSpacing = `${size * track}px`;
  m = ctx.measureText(text);
  if (m.width > maxW) {
    size *= maxW / m.width;
    ctx.font = `400 ${size}px ${font}`;
    ctx.letterSpacing = `${size * track}px`;
    m = ctx.measureText(text);
  }
  capH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, cx, cy + capH / 2 - m.actualBoundingBoxDescent);
  return { size, capH, width: m.width };
}

export const DESIGNS = {
  // a seeded crowd: mostly dark, scarves of yellow, a few white shirts — before the tifo goes up
  crowd: (grid) => {
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return rasterize(grid, (ctx, W, H) => {
      for (let i = 0; i < 9000; i++) {
        const x = rnd() * W, y = rnd() * H, r = 2 + rnd() * 5;
        const t = rnd();
        ctx.fillStyle = t < 0.3 ? '#fef201' : t < 0.38 ? '#f2ecde' : '#121212';
        ctx.fillRect(x, y, r * 2, r * 1.2);
      }
    });
  },

  crest: (grid, { crest }) => rasterize(grid, (ctx, W, H) => {
    wings(ctx, W, H, 0.3);
    frame(ctx, W, H);
    // black field behind the crest so its outline reads against the wings
    const h = H * 0.9, w = h * (crest.width / crest.height);
    ctx.fillStyle = '#121212';
    ctx.fillRect(W / 2 - W * 0.3, H * 0.022, W * 0.6, H * 0.956);
    ctx.drawImage(crest, W / 2 - w / 2, (H - h) / 2, w, h);
  }),

  year: (grid, { narrow } = {}) => rasterize(grid, (ctx, W, H) => {
    const f = narrow ? 0.66 : 1;
    wings(ctx, W, H, 0.34 * f);
    frame(ctx, W, H);
    ctx.fillStyle = '#121212';
    ctx.fillRect(W / 2 - W * 0.34 * f, H * 0.022, W * 0.68 * f, H * 0.956);
    fitText(ctx, '1927', W / 2, H * 0.5, W * 0.6 * f, H * 0.74, '#fef201', { track: 0.04 });
  }),

  match: (grid, { line1, line2, narrow }) => rasterize(grid, (ctx, W, H) => {
    const f = narrow ? 0.66 : 1;
    wings(ctx, W, H, 0.34 * f);
    frame(ctx, W, H);
    ctx.fillStyle = '#121212';
    ctx.fillRect(W / 2 - W * 0.34 * f, H * 0.022, W * 0.68 * f, H * 0.956);
    const a = fitText(ctx, line1, W / 2, H * 0.29, W * 0.6 * f, H * 0.34, '#fef201', { track: 0.04 });
    fitText(ctx, line2, W / 2, H * 0.71, Math.min(W * 0.6 * f, a.width), H * 0.34, '#f2ecde', { track: 0.04 });
  }),

  message: (grid, { text, narrow }) => rasterize(grid, (ctx, W, H) => {
    const f = narrow ? 0.6 : 1;
    wings(ctx, W, H, 0.4 * f);
    frame(ctx, W, H);
    ctx.fillStyle = '#121212';
    ctx.fillRect(W / 2 - W * 0.4 * f, H * 0.022, W * 0.8 * f, H * 0.956);
    const words = text.trim().split(/\s+/);
    // try one line; if it gets too small, break into two
    ctx.font = `400 100px Anton`;
    const one = ctx.measureText(text).width;
    const scaleOne = (W * 0.74 * f) / one;
    if (words.length > 1 && scaleOne * 100 < H * 0.6) {
      let best = 1, bd = Infinity;
      for (let i = 1; i < words.length; i++) {
        const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
        if (d < bd) { bd = d; best = i; }
      }
      fitText(ctx, words.slice(0, best).join(' '), W / 2, H * 0.29, W * 0.74 * f, H * 0.34, '#fef201', { track: 0.04 });
      fitText(ctx, words.slice(best).join(' '), W / 2, H * 0.71, W * 0.74 * f, H * 0.34, '#fef201', { track: 0.04 });
    } else {
      fitText(ctx, text, W / 2, H * 0.5, W * 0.74 * f, H * 0.62, '#fef201', { track: 0.04 });
    }
  }),
};

// small preview of a grid for the selector buttons
export function thumb(canvas, data, grid) {
  const { cols, rows } = grid;
  canvas.width = cols; canvas.height = rows;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(cols, rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const s = (r * cols + c) * 4, d = ((rows - 1 - r) * cols + c) * 4;
    img.data[d] = data[s]; img.data[d + 1] = data[s + 1]; img.data[d + 2] = data[s + 2]; img.data[d + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
