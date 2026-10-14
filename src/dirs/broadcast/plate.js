// The hero "plate": a full-bleed WebGL pass that composites the player cut-out over a studio
// backdrop, then runs it through a broadcast post chain — CRT scanlines, a slow roll bar, a hair of
// chromatic fringe, and on cuts a stripe-edged diagonal wipe with RGB split + slice displacement.
import * as THREE from 'three';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA, uB;
uniform vec2 uRes, uSizeA, uSizeB, uPtr;
uniform float uMix, uGlitch, uTime, uIn, uScale, uLift, uShiftX, uDpr, uStill;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// cut-out anchored to the bottom centre, height = uScale of the canvas
vec2 fit(vec2 px, vec2 size, float par) {
  float h = uRes.y * uScale;
  float w = h * size.x / size.y;
  vec2 o = vec2((uRes.x - w) * 0.5 + uShiftX * uRes.x + par, uLift * uRes.y);
  return (px - o) / vec2(w, h);
}
vec4 tap(sampler2D t, vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(t, uv);
}
// one layer of players with per-channel offsets (the RGB split)
vec4 players(sampler2D t, vec2 size, vec2 px, float split, float par) {
  vec4 r = tap(t, fit(px + vec2(split, 0.0), size, par));
  vec4 g = tap(t, fit(px, size, par));
  vec4 b = tap(t, fit(px - vec2(split, 0.0), size, par));
  float a = max(max(r.a, g.a), b.a);
  return vec4(r.r * r.a, g.g * g.a, b.b * b.a, a);
}

void main() {
  vec2 px = vUv * uRes;
  float t = uTime;
  float g = uGlitch;

  // slice displacement while glitching: a few bands jump sideways
  float band = floor(vUv.y * 22.0 + floor(t * 18.0) * 7.0);
  float rnd = hash(vec2(band, floor(t * 14.0)));
  float jump = step(0.74, rnd) * (rnd - 0.5) * 0.09 * g * uRes.x;
  px.x += jump;

  // studio backdrop: black, a crest-yellow key light behind the players, faint diagonal stripes
  vec2 c = vUv - vec2(0.5 + uPtr.x * 0.02, 0.32);
  c.x *= uRes.x / uRes.y;
  float glow = exp(-dot(c, c) * 3.2);
  vec3 col = vec3(0.039) + vec3(0.996, 0.949, 0.004) * glow * 0.2;
  float diag = (px.x + px.y * 0.62 - uPtr.x * 30.0 * uDpr) / (46.0 * uDpr);
  float stripe = step(0.5, fract(diag));
  col += stripe * 0.022 * smoothstep(0.95, 0.15, vUv.y) * (0.4 + glow);
  // floor line the players stand on
  col += vec3(0.996, 0.949, 0.004) * 0.06 * smoothstep(0.03, 0.0, abs(vUv.y - uLift - 0.002));

  // players, A outgoing / B incoming across a diagonal wipe
  float split = (1.0 + 13.0 * g) * uDpr * (1.0 - uStill);
  float par = uPtr.x * -18.0 * uDpr;
  vec4 A = players(uA, uSizeA, px, split, par);
  vec4 B = players(uB, uSizeB, px, split, par);
  float edge = vUv.x * 1.0 + vUv.y * 0.42 - (uMix * 1.9 - 0.3);
  vec4 P = edge < 0.0 ? B : A;
  // intro: players scan in from the floor up
  float scanIn = uIn * 1.25 - 0.1;
  float mIn = smoothstep(scanIn, scanIn - 0.06, vUv.y + hash(vec2(floor(vUv.y * 90.0), floor(t * 30.0))) * 0.03 * (1.0 - uIn));
  P *= mIn;
  col = col * (1.0 - P.a) + P.rgb;

  // the wipe's leading edge is a band of crest stripes
  if (uMix > 0.001 && uMix < 0.999) {
    float bw = 0.07;
    float inBand = step(-bw, edge) * step(edge, 0.0);
    float st = step(0.5, fract((px.x - px.y) / (22.0 * uDpr)));
    vec3 sc = mix(vec3(0.039), vec3(0.996, 0.949, 0.004), st);
    col = mix(col, sc, inBand);
    // hairline yellow at the very front
    col = mix(col, vec3(0.996, 0.949, 0.004), smoothstep(0.004, 0.0, abs(edge)));
  }

  // CRT: scanlines, slow roll bar, vignette, a touch of noise
  float sl = 0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159 / (1.5 * uDpr));
  col *= 1.0 - 0.13 * sl * (1.0 - uStill * 0.5);
  float roll = fract(vUv.y - t * 0.06);
  col *= 1.0 + 0.045 * smoothstep(0.0, 0.08, roll) * smoothstep(0.16, 0.08, roll) * (1.0 - uStill);
  vec2 v = vUv - 0.5;
  col *= 1.0 - dot(v, v) * 0.75;
  col += (hash(gl_FragCoord.xy + fract(t * (1.0 - uStill)) * 91.0) - 0.5) * (0.03 + 0.05 * g);
  // glitch tint flash on the displaced bands, kept small
  col += vec3(0.996, 0.949, 0.004) * step(0.93, rnd) * g * 0.08;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createPlate(canvas, srcs, { still = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const dpr = Math.min(devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const cam = new THREE.Camera();
  const loader = new THREE.TextureLoader();
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  blank.needsUpdate = true;
  const tex = srcs.map(() => null);
  const sizes = srcs.map(() => new THREE.Vector2(1, 1));

  const u = {
    uA: { value: blank }, uB: { value: blank },
    uSizeA: { value: new THREE.Vector2(1, 1) }, uSizeB: { value: new THREE.Vector2(1, 1) },
    uRes: { value: new THREE.Vector2(1, 1) }, uPtr: { value: new THREE.Vector2() },
    uMix: { value: 0 }, uGlitch: { value: 0 }, uTime: { value: 0 }, uIn: { value: 1 },
    uScale: { value: 0.8 }, uLift: { value: 0 }, uShiftX: { value: 0 }, uDpr: { value: dpr }, uStill: { value: still ? 1 : 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, depthTest: false, depthWrite: false });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const ready = Promise.all(srcs.map((s, i) => new Promise((res) => {
    loader.load(s, (t) => {
      t.colorSpace = THREE.NoColorSpace;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      tex[i] = t;
      sizes[i].set(t.image.width, t.image.height);
      res();
    }, undefined, () => res());
  })));

  let cur = 0;
  function set(slot, i) {
    const t = tex[i] || blank;
    u[slot === 'A' ? 'uA' : 'uB'].value = t;
    u[slot === 'A' ? 'uSizeA' : 'uSizeB'].value.copy(sizes[i]);
  }
  ready.then(() => { set('A', cur); set('B', cur); });

  // frame(w, h) → { scale, lift } lets the page place the players around its own layout
  let frame = null;
  function resize(fn) {
    if (fn) frame = fn;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    u.uRes.value.set(w * dpr, h * dpr);
    const f = frame?.(w, h) || { scale: Math.min(0.86, 0.62 + (w / h) * 0.08), lift: 0 };
    u.uScale.value = f.scale;
    u.uLift.value = f.lift;
    u.uShiftX.value = f.shift || 0;
  }
  resize();

  const ptr = { x: 0, tx: 0 };
  return {
    ready,
    uniforms: u,
    resize,
    pointer(x) { ptr.tx = x; },
    // prepare a cut to slide i: B gets the incoming players
    prepare(i) { set('B', i); u.uMix.value = 0; },
    commit(i) { cur = i; set('A', i); u.uMix.value = 0; },
    render(time) {
      ptr.x += (ptr.tx - ptr.x) * 0.06;
      u.uPtr.value.set(ptr.x, 0);
      u.uTime.value = time;
      renderer.render(scene, cam);
    },
    destroy() { renderer.dispose(); mat.dispose(); tex.forEach((t) => t?.dispose()); },
  };
}
