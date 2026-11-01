// The stadium's own tifo, all the way round (Ahmed, 2026-10-22: "making the tifo take the full seats around the
// stadium"). With the tifo builder gone, the whole-bowl machinery in tifo.js only ever showed the far stand's
// rotating designs; this paints one panorama for every seat instead (BOWL_GRID: x round the bowl from the corner
// between the tunnel side and the right-hand goal end, y from the upper back row down to the lower front row).
// Verified lines only: the crest, AL-ITTIHAD, 1927 and the club's colours — nothing written in the club's voice.
import { BOWL_GRID } from './tifo.js';

const Y = '#ffea00', K = '#0d0d0d';

// [field, crest or word, word colour] per stand
const LAYOUTS = [
  { far: [K, 'crest'], tunnel: [Y, 'AL-ITTIHAD', K], west: [Y, '1927', K], east: [K, '1927', Y] },
  { far: [Y, 'AL-ITTIHAD', K], tunnel: [K, 'crest'], west: [K, 'crest'], east: [Y, 'crest'] },
  { far: [K, '1927', Y], tunnel: [K, 'AL-ITTIHAD', Y], west: [Y, 'crest'], east: [K, 'crest'] },
];
export const TIFO_LAYOUTS = LAYOUTS.length;

export function stadiumTifo(crest, layout = 0) {
  const W = 2048, H = Math.round(W / BOWL_GRID.aspect);
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.dataset.tifo = 'bowl';
  const g = c.getContext('2d');
  const st = Object.fromEntries(BOWL_GRID.stands.map((s) => [s.key, { x0: s.x0 * W, x1: s.x1 * W, cx: s.cx * W }]));
  const font = (px) => `400 ${px}px Anton, 'Anton Boot', Impact, sans-serif`;
  // the shirt's stripes everywhere first
  const stripe = W / 96;
  for (let x = 0, i = 0; x < W; x += stripe, i++) { g.fillStyle = i % 2 ? K : Y; g.fillRect(x, 0, stripe + 1, H); }
  // a solid field per stand, a little in from its corners so the stripes frame it
  const field = (s, col, inset = 0.08) => { const w = s.x1 - s.x0; g.fillStyle = col; g.fillRect(s.x0 + w * inset, 0, w * (1 - inset * 2), H); return { x: s.x0 + w * inset, w: w * (1 - inset * 2) }; };
  const words = (txt, cx, cy, maxW, maxH, col) => {
    let px = maxH; g.font = font(px);
    while (px > 8 && g.measureText(txt).width > maxW) { px -= 2; g.font = font(px); }
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx, cy);
  };
  // what each stand holds up: a field colour and the crest or a word on it. Layout 0 is the stadium's tifo as you walk
  // out (the crest on the far stand opposite the tunnel); 1 and 2 are what the cards flip to round the bowl
  // (Ahmed, 2026-11-01: "why the tifo is static")
  const L = LAYOUTS[layout % LAYOUTS.length];
  for (const k of ['far', 'tunnel', 'west', 'east']) {
    const [bg, what, ink] = L[k], f = field(st[k], bg, k === 'west' || k === 'east' ? 0.1 : 0.08);
    if (what === 'crest') { if (crest) { const hh = H * 0.92, w = Math.min(f.w * 0.9, hh * (crest.width / crest.height)), h2 = w * (crest.height / crest.width); g.drawImage(crest, st[k].cx - w / 2, (H - h2) / 2, w, h2); } }
    else words(what, st[k].cx, what === '1927' ? H * 0.5 : H * 0.42, f.w * (what === '1927' ? 0.9 : 0.94), H * (what === '1927' ? 0.7 : 0.62), ink);
  }
  return c;
}
