// The 26/27 home shirt as an "invisible mannequin" product shot, in 3D. Built from the store's own photos
// (shop.ittihadclub.sa): the front ghost-mannequin photo and the back photo, cut out and aligned in
// public/img/jersey/, plus a height map baked from the front silhouette — the torso fills out, the
// sleeves stay slimmer, the edges round over and the collar opening dips into the body so you look
// into the shirt at the inside back label, as in the photo. The knit is a fine rib normal map.
import * as THREE from 'three';

const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

function ribNormalMap() {
  // fine vertical ribs, like the shirt's jacquard knit in the close-up photos
  const W = 256, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), img = x.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const a = (i / W) * Math.PI * 2 * 16;
    const nx = Math.cos(a) * 0.55 + Math.cos(a * 3 + j * 0.3) * 0.12;
    const ny = Math.sin((j / H) * Math.PI * 2 * 6 + i * 0.2) * 0.08;
    const o = (j * W + i) * 4;
    img.data[o] = 128 + nx * 127; img.data[o + 1] = 128 + ny * 127; img.data[o + 2] = 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 34);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export async function buildGhostJersey({ env, height = 1.55, depth = 0.24, lite = false, nx = 0 } = {}) {
  const [fImg, bImg, hImg] = await Promise.all([load('/img/jersey/front.webp'), load('/img/jersey/back.webp'), load('/img/jersey/height.png')]);
  if (!fImg || !bImg || !hImg) return null;
  const aspect = fImg.width / fImg.height, w = height * aspect;

  // read the height map
  const hc = document.createElement('canvas'); hc.width = hImg.width; hc.height = hImg.height;
  const hx = hc.getContext('2d', { willReadFrequently: true }); hx.drawImage(hImg, 0, 0);
  const hd = hx.getImageData(0, 0, hc.width, hc.height).data;
  const sample = (u, v, ch) => {         // bilinear, u,v in 0..1 with v = 0 at the top
    const X = u * (hc.width - 1), Y = v * (hc.height - 1);
    const x0 = Math.floor(X), y0 = Math.floor(Y), x1 = Math.min(x0 + 1, hc.width - 1), y1 = Math.min(y0 + 1, hc.height - 1);
    const fx = X - x0, fy = Y - y0, g = (x, y) => hd[(y * hc.width + x) * 4 + ch] / 255;
    return (g(x0, y0) * (1 - fx) + g(x1, y0) * fx) * (1 - fy) + (g(x0, y1) * (1 - fx) + g(x1, y1) * fx) * fy;
  };

  const NX = nx || (lite ? 120 : 200), NY = Math.round(NX / aspect);
  // which grid vertices are on the shirt, and which sit on its edge (an on-shirt vertex next to an
  // off-shirt one). Edge vertices are pinned to z = 0 on BOTH surfaces, so front and back share one seam.
  const inside = new Uint8Array((NX + 1) * (NY + 1));
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) inside[j * (NX + 1) + i] = sample(i / NX, j / NY, 2) > 0.5 ? 1 : 0;
  const isIn = (i, j) => i >= 0 && j >= 0 && i <= NX && j <= NY && inside[j * (NX + 1) + i];
  const onEdge = (i, j) => { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!isIn(i + di, j + dj)) return true; return false; };

  function surface(back) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NY;              // v from the top
      let z = 0;
      if (isIn(i, j) && !onEdge(i, j)) {
        const hgt = sample(u, v, back ? 1 : 0) * 2 - 1;
        z = back ? -depth * Math.max(0, hgt) : depth * hgt;
      }
      pos.push((u - 0.5) * w, (0.5 - v) * height, z);
      uv.push(back ? 1 - u : u, 1 - v);          // seen from behind, the back photo's left is world +x
    }
    const id = (i, j) => j * (NX + 1) + i;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      // a cell is kept when any corner is on the shirt; the texture's alpha trims it to the exact outline
      if (!(isIn(i, j) || isIn(i + 1, j) || isIn(i, j + 1) || isIn(i + 1, j + 1))) continue;
      const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
      if (back) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const ribs = ribNormalMap();
  const mat = (img) => {
    const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      map: t, alphaTest: 0.5, side: THREE.DoubleSide,
      normalMap: ribs, normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.72, metalness: 0,
      sheen: 0.08, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x808080), // a soft polyester sheen, not a grey film
      envMap: env, envMapIntensity: 0.55,
      toneMapped: false, // keep the club's yellow and black true, as in a product photo
    });
  };
  const group = new THREE.Group();
  // the two surfaces lie flat together along the seam: nudge the back behind so they don't flicker
  const backMat = mat(bImg); backMat.polygonOffset = true; backMat.polygonOffsetFactor = 1; backMat.polygonOffsetUnits = 2;
  group.add(new THREE.Mesh(surface(false), mat(fImg)), new THREE.Mesh(surface(true), backMat));
  // a product-shot light rig: soft key high on one side, a fill, and a cool rim from behind. Short-range
  // point lights so nothing else in the tunnel (trophies, stadium) is affected.
  const lights = new THREE.Group();
  const pl = (color, intensity, x, y, z) => { const l = new THREE.PointLight(color, intensity, 7, 2); l.position.set(x, y, z); lights.add(l); };
  pl(0xfff3e0, 9, 2.2, 1.4, 1.6);     // key: front, upper right of the doorway view
  pl(0xffffff, 3.5, 2.0, 0.2, -1.8);  // fill
  pl(0xdfe8ff, 6, -2.0, 1.6, 0.6);    // rim from behind
  return { group, lights, width: w, height };
}
