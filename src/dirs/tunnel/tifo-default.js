// The stadium's own tifo, all the way round (Ahmed, 2026-10-22: "making the tifo take the full seats around the
// stadium"). With the tifo builder gone, the whole-bowl machinery in tifo.js only ever showed the far stand's
// rotating designs; this paints one panorama for every seat instead (BOWL_GRID: x round the bowl from the corner
// between the tunnel side and the right-hand goal end, y from the upper back row down to the lower front row).
// Verified lines only: the crest, AL-ITTIHAD, 1927 and the club's colours — nothing written in the club's voice.
import { BOWL_GRID } from './tifo.js';

const Y = '#ffea00', K = '#0d0d0d';

export function stadiumTifo(crest) {
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
  // the far stand, opposite the tunnel — what you see walking out: the crest, as big as the stand allows
  field(st.far, K);
  if (crest) { const h = H * 0.92, w = h * (crest.width / crest.height); g.drawImage(crest, st.far.cx - w / 2, (H - h) / 2, w, h); }
  // the tunnel side: AL-ITTIHAD across it
  const tun = field(st.tunnel, Y);
  words('AL-ITTIHAD', st.tunnel.cx, H * 0.42, tun.w * 0.94, H * 0.62, K);
  // the goal ends: the founding year
  for (const k of ['west', 'east']) { const f = field(st[k], k === 'west' ? Y : K, 0.1); words('1927', st[k].cx, H * 0.5, f.w * 0.9, H * 0.7, k === 'west' ? K : Y); }
  return c;
}
