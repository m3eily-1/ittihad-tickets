// Textures and props shared by the 3D mini-games (Run out, One-two): the grass, the crowd, the LED boards, the
// floodlight glow, a football. (2026-11-01: they began as block figures; Ahmed didn't like the Roblox look, so the
// players are real people now, players.js, and the props real shapes.)
import * as THREE from 'three';

export const Y = '#ffd400', K = '#0d0d0d';

/* ── canvas textures ── */
export function canvasTex(w, hgt, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = hgt;
  draw(c.getContext('2d'), w, hgt);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 4;
  return t;
}
export const grassTex = (repeat = [6, 26]) => canvasTex(64, 512, (g, w, hh) => {
  g.fillStyle = '#2f7d34'; g.fillRect(0, 0, w, hh / 2); g.fillStyle = '#286d2d'; g.fillRect(0, hh / 2, w, hh / 2);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(Math.random() * w, Math.random() * hh, 1, 2); }
}, { repeat });
export const crowdTex = () => canvasTex(512, 512, (g, w, hh) => {
  g.fillStyle = '#121212'; g.fillRect(0, 0, w, hh);
  const rows = 26, rh = hh / rows;
  const shirts = [Y, Y, Y, Y, K, K, '#f2f2f2', '#f2f2f2', '#d8b27a', '#8b5a3c'];
  for (let r = 0; r < rows; r++) {
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, r * rh + rh - 2, w, 2);
    for (let x = 2; x < w; x += 7 + Math.random() * 3) {
      if (Math.random() < 0.08) continue;
      g.fillStyle = shirts[(Math.random() * shirts.length) | 0];
      g.fillRect(x, r * rh + rh * 0.38, 5, rh * 0.5);
      g.fillStyle = Math.random() < 0.5 ? '#c9946e' : '#6e4a33'; g.fillRect(x + 1, r * rh + rh * 0.14, 3, rh * 0.24);
    }
  }
}, { repeat: [10, 1] });
export const boardTex = () => canvasTex(1024, 64, (g, w, hh) => {
  g.fillStyle = K; g.fillRect(0, 0, w, hh);
  g.fillStyle = Y; g.font = "400 40px Anton, Impact, sans-serif"; g.textBaseline = 'middle';
  ['AL ITTIHAD', '1927', 'THE TIGERS', 'AL ITTIHAD', '1927'].forEach((t, i) => g.fillText(t, 30 + i * 205, hh / 2 + 2));
}, { repeat: [12, 1] });
export const glowTex = () => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,250,225,0.55)'); gr.addColorStop(1, 'rgba(255,250,225,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});

// a football: a smooth sphere, twelve black pentagons (at an icosahedron's corners) on white, faint seams between
// (2026-11-01: the 3D games went from blocks to real-looking players and props)
let ballTex = null;
function footballTex() {
  if (ballTex) return ballTex;
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const p = (1 + Math.sqrt(5)) / 2;
  const V = [[0, 1, p], [0, 1, -p], [0, -1, p], [0, -1, -p], [1, p, 0], [1, -p, 0], [-1, p, 0], [-1, -p, 0], [p, 0, 1], [p, 0, -1], [-p, 0, 1], [-p, 0, -1]].map((v) => { const l = Math.hypot(...v); return v.map((x) => x / l); });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const lon = (x / W) * Math.PI * 2, lat = (y / H) * Math.PI;
    const dx = Math.sin(lat) * Math.cos(lon), dy = Math.cos(lat), dz = Math.sin(lat) * Math.sin(lon);
    let a = -1, b = -1;
    for (const v of V) { const k = v[0] * dx + v[1] * dy + v[2] * dz; if (k > a) { b = a; a = k; } else if (k > b) b = k; }
    const ang = Math.acos(Math.min(1, a)), seam = Math.abs(a - b) < 0.012;
    const k = ang < 0.33 ? 18 : seam ? 150 : 246;
    const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ballTex = new THREE.CanvasTexture(c); ballTex.colorSpace = THREE.SRGBColorSpace; ballTex.anisotropy = 4;
  return ballTex;
}
export function makeBall(r = 0.12) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ map: footballTex(), roughness: 0.45 }));
}
