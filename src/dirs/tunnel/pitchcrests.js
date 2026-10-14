// Pre-match pitch graphics: the two clubs' crests painted on the grass either side of the centre
// circle, as broadcasters do before big games. Flat decals that keep the mowing stripes and the
// floodlight pools showing through, so they read as paint on grass rather than stickers.
import * as THREE from 'three';
import { nextMatch } from '../../data.js';

const loadImg = (src) => new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

// square, padded canvas so both crests sit on the same footprint
function crestTexture(img) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  // trim the file's transparent padding first, so both crests fill the same footprint
  const tc = document.createElement('canvas'); tc.width = img.width; tc.height = img.height;
  const tx = tc.getContext('2d', { willReadFrequently: true }); tx.drawImage(img, 0, 0);
  const d = tx.getImageData(0, 0, img.width, img.height).data;
  let x0 = img.width, y0 = img.height, x1 = 0, y1 = 0;
  for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) if (d[(j * img.width + i) * 4 + 3] > 16) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  if (x1 <= x0) { x0 = 0; y0 = 0; x1 = img.width - 1; y1 = img.height - 1; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const k = Math.min((S * 0.94) / bw, (S * 0.94) / bh);
  const w = bw * k, h = bh * k;
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, x0, y0, bw, bh, (S - w) / 2, (S - h) / 2, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = true;
  return t;
}

const VERT = /* glsl */ `varying vec2 vUv; varying vec3 vW;
  void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = /* glsl */ `varying vec2 vUv; varying vec3 vW;
  uniform sampler2D uMap; uniform float uAmt, uReveal, uTime, uSweep, uSide;
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main(){
    vec4 t = texture2D(uMap, vUv);
    // reveal: the crest is "painted" in a ring that grows from its centre, with a hot edge
    float r = length(vUv - 0.5) * 1.42;
    float front = uReveal * 1.25 - 0.1;
    if (t.a < 0.02 || r > front) discard;
    float edge = 1.0 - smoothstep(0.0, 0.07, front - r);
    // paint on grass: the same mowing bands as the pitch, blade-level grain, a little grass tint
    float band = step(0.5, fract((vW.x + 54.5) / 9.9));
    float grain = 0.88 + 0.12 * h21(floor(vW.xz * 22.0));
    vec3 col = t.rgb * mix(0.86, 1.0, band) * grain;
    col = mix(col, vec3(0.16, 0.3, 0.12), 0.12);
    // floodlight pool: brighter toward the centre spot
    col *= 0.9 + 0.22 * exp(-dot(vW.xz, vW.xz) / 2200.0);
    // a light sweep crosses the crest every few seconds, like a broadcast pitch projection
    float sw = vUv.x * 0.7 + vUv.y * 0.3 - uSweep;
    col += vec3(1.0, 0.97, 0.85) * exp(-sw * sw / 0.004) * 0.28 * t.a;
    // gentle breathing glow
    col *= 1.0 + 0.08 * sin(uTime * 1.6 + uSide * 1.7);
    col += vec3(1.0, 0.92, 0.5) * edge * 0.9;
    gl_FragColor = vec4(col, t.a * uAmt);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// a club with no crest file (e.g. Pakhtakor): its code in a ring, like the match cards' monogram
function monogramTexture(code) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.beginPath(); x.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fill();
  x.lineWidth = 28; x.strokeStyle = 'rgba(255,255,255,0.85)'; x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '400 300px Anton'; x.fillText(code || '?', S / 2, S / 2 + 105);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
  return t;
}
export async function buildPitchCrests({ size = 24, offset = 24 } = {}) {
  const m = nextMatch();
  const [home, away] = await Promise.all([loadImg('/img/crest.png'), loadImg(m.crest)]);
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(size, size);
  const mats = [];
  const make = (img, x, side) => {
    if (!img) return;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: img.src ? crestTexture(img) : null }, uAmt: { value: 0.92 }, uReveal: { value: 0 }, uTime: { value: 0 }, uSweep: { value: -1 }, uSide: { value: side } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;     // lying on the grass, top of the crest toward the far stand
    mesh.position.set(x, 0.045, 0);
    mesh.renderOrder = 1;
    group.add(mesh);
    mats.push(mat);
  };
  make(home, -offset, 0);   // Al-Ittihad in one half
  if (away) make(away, offset, 1);    // the visitors in the other
  else { make({ width: 1, height: 1 }, offset, 1); mats[1].uniforms.uMap.value = monogramTexture(m.oppCode); }
  group.visible = false;

  // animation: painted in as you walk out (home first, then the visitors), then a light sweep loops
  let shown = false, t0 = 0, tAway = null, now = 0;
  const ease = (v) => 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3);
  function update(t, walk, still = false) {
    const inBowl = walk > 0.6;
    if (inBowl && !shown) { shown = true; t0 = t; }
    if (!inBowl && walk < 0.5 && shown) shown = false; // replays when you come out again
    now = t;
    group.visible = walk > 0.56;
    mats.forEach((m, i) => {
      const u = m.uniforms;
      u.uTime.value = t;
      const start = i === 1 && tAway !== null && shown ? Math.max(t0, tAway) : t0;   // a new visitor's crest paints in again
      u.uReveal.value = still ? 1 : shown ? ease((t - start - 0.6 - i * 0.5) / 1.6) : 0;
      // sweep runs every 4 s once revealed, offset per crest
      const k = ((t - t0 - 2.8 - i * 0.6) % 4 + 4) % 4;
      u.uSweep.value = shown && t - t0 > 2.8 ? k * 0.6 - 0.4 : -1;
    });
  }
  // the visitors' crest follows the match you chose (Ahmed: "the logos on the stadium should reflect the match")
  let match = m;
  async function setMatch(next) {
    if (!next || next === match || !mats[1]) return;
    match = next;
    const img = await loadImg(next.crest);
    const old = mats[1].uniforms.uMap.value;
    mats[1].uniforms.uMap.value = img ? crestTexture(img) : monogramTexture(next.oppCode);
    old?.dispose();
    tAway = now - 0.5;
  }
  return { group, get match() { return match; }, update, setMatch };
}
