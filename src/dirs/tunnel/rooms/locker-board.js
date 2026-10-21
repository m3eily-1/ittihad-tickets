// The changing room's tactics board (Ahmed, 2026-10-21: "tap the tactics board to drag magnets into a
// formation"). One source for the four formations, the XI each one starts from (a plausible line-up picked from
// the squad by position — the fan's XI, not the coach's), the saved board (localStorage 'itt-tactics-v1') and the
// painting of the 3D board's canvas. Used by both locker rooms (changing.js, lockerroom.js) and the overlay
// (locker-ui.js).
import { SQUAD } from '../squad.js';

export const TACTICS_KEY = 'itt-tactics-v1';
// slots: [u, v, shirt number] — u from your own goal line (0) to the opponents' (1), v from your left touchline
// (0) to your right (1). Slot 0 is always the keeper.
export const FORMATIONS = {
  '4-3-3': [[0.06, 0.5, 1], [0.25, 0.13, 12], [0.2, 0.37, 20], [0.2, 0.63, 2], [0.25, 0.87, 15],
    [0.38, 0.5, 5], [0.5, 0.29, 10], [0.5, 0.71, 23], [0.7, 0.15, 34], [0.77, 0.5, 21], [0.7, 0.85, 7]],
  '4-4-2': [[0.06, 0.5, 1], [0.25, 0.13, 12], [0.2, 0.37, 20], [0.2, 0.63, 2], [0.25, 0.87, 15],
    [0.48, 0.13, 34], [0.44, 0.38, 10], [0.44, 0.62, 5], [0.48, 0.87, 7], [0.72, 0.38, 21], [0.72, 0.62, 9]],
  '3-5-2': [[0.06, 0.5, 1], [0.21, 0.26, 20], [0.18, 0.5, 2], [0.21, 0.74, 6],
    [0.44, 0.08, 12], [0.48, 0.31, 10], [0.37, 0.5, 5], [0.48, 0.69, 23], [0.44, 0.92, 15], [0.72, 0.38, 21], [0.72, 0.62, 9]],
  '4-2-3-1': [[0.06, 0.5, 1], [0.25, 0.13, 12], [0.2, 0.37, 20], [0.2, 0.63, 2], [0.25, 0.87, 15],
    [0.38, 0.38, 30], [0.38, 0.62, 5], [0.58, 0.16, 34], [0.58, 0.5, 10], [0.58, 0.84, 7], [0.77, 0.5, 21]],
};
export const FORMATION_KEYS = Object.keys(FORMATIONS);
export const playerOf = (no) => SQUAD.find((p) => p.no === no) || null;
export const presetOf = (f) => (FORMATIONS[f] || FORMATIONS['4-3-3']).map(([u, v, no]) => ({ u, v, no }));
export const defaultTactics = () => ({ f: '4-3-3', pos: presetOf('4-3-3') });
const num = (v) => typeof v === 'number' && Number.isFinite(v);
export function loadTactics() {
  try {
    const s = JSON.parse(localStorage.getItem(TACTICS_KEY));
    if (s && FORMATIONS[s.f] && Array.isArray(s.pos) && s.pos.length === 11 && s.pos.every((p) => p && num(p.u) && num(p.v) && num(p.no))) return s;
  } catch { /* nothing saved, or private mode */ }
  return null;
}
export function saveTactics(s) { try { localStorage.setItem(TACTICS_KEY, JSON.stringify({ f: s.f, pos: s.pos.map(({ u, v, no }) => ({ u: +u.toFixed(4), v: +v.toFixed(4), no })) })); } catch { /* private mode */ } }

/* the 3D board: a white magnetic board in a steel frame, a green pitch drawn on it, a yellow magnet for each
   player (number, and his name under it), "YOUR XI" and the formation in marker across the top */
export function paintTactics(x, W, H, s = defaultTactics()) {
  x.save();
  x.fillStyle = '#f5f5f1'; x.fillRect(0, 0, W, H);
  const pad = Math.round(W * 0.035), top = Math.round(H * 0.15);
  // title
  x.fillStyle = '#141414'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  x.font = `400 ${Math.round(H * 0.095)}px Anton`; x.fillText('YOUR XI', pad, top - H * 0.035);
  const tw = x.measureText('YOUR XI').width;
  x.fillStyle = '#c99a00'; x.fillText(s.f, pad + tw + W * 0.025, top - H * 0.035);
  x.font = `600 ${Math.round(H * 0.032)}px Cairo, sans-serif`; x.fillStyle = 'rgba(20,20,20,0.55)'; x.textAlign = 'right';
  x.fillText('TAP THE BOARD TO SET UP YOUR TEAM', W - pad, top - H * 0.045);
  // the pitch
  const px = pad, py = top, pw = W - pad * 2, ph = H - top - pad;
  x.fillStyle = '#2f7a3d'; x.fillRect(px, py, pw, ph);
  x.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 10; i += 2) x.fillRect(px + (pw / 10) * i, py, pw / 10, ph);
  x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = Math.max(2, W / 400);
  const L = (u) => px + u * pw, T = (v) => py + v * ph;
  x.strokeRect(px + 6, py + 6, pw - 12, ph - 12);
  x.beginPath(); x.moveTo(L(0.5), py + 6); x.lineTo(L(0.5), py + ph - 6); x.stroke();
  x.beginPath(); x.arc(L(0.5), T(0.5), ph * 0.14, 0, Math.PI * 2); x.stroke();
  for (const side of [0, 1]) {
    const bx = side ? L(1) - 6 - pw * 0.16 : px + 6, sx = side ? L(1) - 6 - pw * 0.055 : px + 6;
    x.strokeRect(bx, T(0.2), pw * 0.16, ph * 0.6); x.strokeRect(sx, T(0.36), pw * 0.055, ph * 0.28);
  }
  // magnets
  const r = Math.min(pw, ph) * 0.068;
  x.textAlign = 'center';
  for (const p of s.pos) {
    const cx = L(Math.min(0.97, Math.max(0.03, p.u))), cy = T(Math.min(0.95, Math.max(0.05, p.v)));
    x.fillStyle = 'rgba(0,0,0,0.3)'; x.beginPath(); x.arc(cx + r * 0.12, cy + r * 0.18, r, 0, Math.PI * 2); x.fill();
    x.fillStyle = p === s.pos[0] ? '#f5f5f1' : '#ffe100'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.lineWidth = r * 0.14; x.strokeStyle = '#141414'; x.stroke();
    x.fillStyle = '#141414'; x.font = `400 ${Math.round(r * 1.05)}px Anton`; x.textBaseline = 'middle'; x.fillText(String(p.no), cx, cy + r * 0.06);
    const name = (playerOf(p.no)?.shirt || '').toUpperCase();
    if (name) {
      x.font = `700 ${Math.round(r * 0.52)}px Cairo, sans-serif`;
      const nw = x.measureText(name).width + r * 0.4;
      x.fillStyle = 'rgba(10,10,10,0.78)'; x.fillRect(cx - nw / 2, cy + r * 1.12, nw, r * 0.7);
      x.fillStyle = '#fff'; x.fillText(name, cx, cy + r * 1.5);
    }
  }
  x.restore();
}
