// Block figures and pixel textures shared by the 3D mini-games (Run out, One-two): Ahmed, 2026-11-01, "like lego or
// pixels like roblox". A cube head with a pixel face, a box body, box arms and legs that swing from the shoulder and
// hip; shirts drawn pixel by pixel and shown with nearest-neighbour filtering so every pixel stays a crisp block.
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
// pixel art (Ahmed, 2026-11-01: "like lego or pixels like roblox"): tiny canvases, drawn square by square, shown
// with nearest-neighbour filtering so every pixel stays a crisp block
export function pixTex(w, hgt, draw) {
  const t = canvasTex(w, hgt, draw);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.anisotropy = 1;
  return t;
}
// a 3 × 5 pixel font, for the name and number on the back of the shirt
export const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
};
export function pixText(g, text, x, y, k = 1) {
  for (const ch of text) { const f = FONT[ch]; if (f) for (let i = 0; i < 15; i++) if (f[i] === '1') g.fillRect(x + (i % 3) * k, y + Math.floor(i / 3) * k, k, k); x += 4 * k; }
}
export const textW = (text, k = 1) => text.length * 4 * k - k;
// the shirt: a front of stripes; a back with the name and number on a panel
export const shirtTex = ({ back = false, name = '', num = '', a = Y, b = K, ink = K, panel = Y } = {}) => pixTex(24, 24, (g) => {
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 4, 0, 4, 24); }
  if (!back) { g.fillStyle = ink; g.fillRect(9, 0, 6, 1); g.fillRect(10, 1, 4, 1); return; }   // a little V at the collar
  g.fillStyle = panel; g.fillRect(2, 1, 20, 21);
  g.fillStyle = ink;
  const nm = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  pixText(g, nm, Math.round((24 - textW(nm)) / 2), 3);
  pixText(g, num, Math.round((24 - textW(num, 2)) / 2), 10, 2);
});
// a limb: sleeve (or shorts) at the top, skin, then the cuff (or sock)
export const limbTex = (top, mid, low, rows = [3, 2, 3]) => pixTex(4, 8, (g) => {
  g.fillStyle = top; g.fillRect(0, 0, 4, rows[0]);
  g.fillStyle = mid; g.fillRect(0, rows[0], 4, rows[1]);
  g.fillStyle = low; g.fillRect(0, rows[0] + rows[1], 4, rows[2]);
});
// the head: a face of pixels (two eyes, a smile) under the hair; the back and top all hair
export const faceTex = (skin, hair) => pixTex(8, 8, (g) => {
  g.fillStyle = skin; g.fillRect(0, 0, 8, 8);
  g.fillStyle = hair; g.fillRect(0, 0, 8, 2);
  g.fillStyle = '#111'; g.fillRect(2, 3, 1, 2); g.fillRect(5, 3, 1, 2);
  g.fillRect(2, 6, 1, 1); g.fillRect(3, 7, 2, 1); g.fillRect(5, 6, 1, 1);
});
export const sideTex = (skin, hair) => pixTex(8, 8, (g) => { g.fillStyle = skin; g.fillRect(0, 0, 8, 8); g.fillStyle = hair; g.fillRect(0, 0, 8, 3); g.fillRect(6, 0, 2, 6); });
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

/* ── people, built like a block figure: a cube head, a box body, box arms and legs that swing from the shoulder and
   hip. Front is +z (the back of the shirt on −z). ── */
export const css = (c) => `#${new THREE.Color(c).getHexString()}`;
export function makePlayer({ shirt = Y, stripe = K, ink = K, panel = Y, name = '', num = '', shorts = 0x111111, socks = 0x111111, skin = 0xa5704e, hair = 0x1a120c }) {
  const m = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const S = css(skin), Hc = css(hair), Sh = css(shirt), St = css(stripe), Ss = css(shorts), Sk = css(socks);
  const front = m({ map: shirtTex({ a: Sh, b: St, ink }) }), backM = m({ map: shirtTex({ back: true, name, num, a: Sh, b: St, ink, panel }) });
  const plain = m({ color: shirt }), skinM = m({ color: skin }), hairM = m({ color: hair }), shortM = m({ color: shorts }), bootM = m({ color: 0x111111 });
  const armM = m({ map: limbTex(Sh, Sh, S, [4, 1, 3]) }), legM = m({ map: limbTex(Ss, S, Sk) });
  const g = new THREE.Group();
  const U = 0.34;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(2 * U, 2 * U, U), [plain, plain, plain, plain, front, backM]);
  torso.position.y = 3 * U; g.add(torso);
  const faceM = m({ map: faceTex(S, Hc) }), sideM = m({ map: sideTex(S, Hc) });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.15 * U, 1.15 * U, 1.15 * U), [sideM, sideM, hairM, skinM, faceM, hairM]);
  head.position.y = 4 * U + 0.6 * U; g.add(head);
  const limb = (x, y, mat, end) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.98 * U, 2 * U, U), [mat, mat, end[0], end[1], mat, mat]);
    box.position.y = -U; pivot.add(box); g.add(pivot); return pivot;
  };
  const legs = [-0.5 * U, 0.5 * U].map((x) => limb(x, 2 * U, legM, [shortM, bootM]));
  const arms = [-1.5 * U, 1.5 * U].map((x) => limb(x, 4 * U - 0.02, armM, [plain, skinM]));
  return { g, legs, arms, torso };
}

// a low-poly ball: twenty flat faces, some of them black
export function makeBall(r = 0.12) {
  const g = new THREE.IcosahedronGeometry(r, 0), c = [];
  for (let f = 0; f < g.attributes.position.count / 3; f++) { const k = [0, 3, 7, 11, 14, 18].includes(f) ? 0.08 : 0.95; for (let v = 0; v < 3; v++) c.push(k, k, k); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }));
}
