// The world: a concrete players' tunnel (baked/fake lighting in GLSL) that opens onto a
// stylised floodlit bowl. Everything is low-poly procedural geometry; no real-time lights.
import * as THREE from 'three';
import { buildGoal } from './goal.js';
import { TROPHIES } from './trophies.js';
import { NEON } from './fx.js';
import * as TX from './textures.js';
import { buildRoof } from './roof.js';

// tunnel frame (metres). The tunnel runs along +z under the near stand; the mouth sits in the
// podium wall at z = ZM, the pitch centre is the origin.
export const TN = { HW: 3.5, HH: 3.6, ZM: 45, ZB: 100, GAP: 6, Z0: 49, NL: 9 };
export const FOG = { color: new THREE.Color(0x07070a), density: 0.0032 };
// The bowl follows Al-Jawhara (King Abdullah Sports City / Alinma Stadium): a rounded-rectangle plan,
// drawn as a superellipse. ringXZ gives the point at angle th on a ring with semi-axes a (x) and b (z).
// Measured from the club's top-down aerial (scaled by the pitch, 105 × 68 m): stand fronts ≈ 10.5 m
// behind the goal lines and ≈ 11 m off the touchlines, corners rounded so that a pitch corner clears the
// stand by ≈ 7 m diagonally (no athletics track — a grass run-off all round, as in Hum3D's model).
export const SE_N = 4.6;
// Polar form: the point on the superellipse in direction th. (The parametric form |cos|^(2/n) has an
// infinite slope at the axes, which bunched the points and opened a ~7 m gap at the middle of each stand.)
export function ringXZ(a, b, th) {
  const c = Math.cos(th), s = Math.sin(th);
  const r = Math.pow(Math.pow(Math.abs(c) / a, SE_N) + Math.pow(Math.abs(s) / b, SE_N), -1 / SE_N);
  return [r * c, r * s];
}
// seating tiers as rings [x semi-axis, z semi-axis, height]: front edge → back edge
// two doorways in the right-hand wall (x = +HW) lead into the trophy room and back out: [z0, z1]
export const DOORS = { out: [75.2, 78.4], in: [84.6, 88.0], h: 2.7, store: [68.2, 71.6], back: [-1.3, 1.3], matches: [57.0, 60.4], changing: [90.6, 94.0], gym: [50.8, 54.2], fame: [54.4, 57.6], fantasy: [64.6, 68.0] };   // gym and fame staggered so each gets its own Enter button   // fantasy: right wall, opposite the store   // gym: left wall near the mouth; fame (hall of fame): right wall opposite   // changing: left wall, the first door you meet // store: left wall (x = -HW); back: x span in the end wall, into the changing room
// three tiers with LED fascias between them, like the real stadium
export const BOWL = { lower: [[63, 45, 1.6], [82, 63, 12.5]], middle: [[85, 66, 15.5], [97, 77, 25]], upper: [[100, 80, 28], [115, 94, 43]] };

const common = /* glsl */ `
  varying vec3 vW; varying vec3 vN; varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uCam;
  float h11(float n){ return fract(sin(n) * 43758.5453); }
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float n = dot(i, vec3(1.0, 57.0, 113.0));
    return mix(mix(mix(h11(n), h11(n + 1.0), f.x), mix(h11(n + 57.0), h11(n + 58.0), f.x), f.y),
               mix(mix(h11(n + 113.0), h11(n + 114.0), f.x), mix(h11(n + 170.0), h11(n + 171.0), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.07; a *= 0.5; } return s; }
  vec3 fogMix(vec3 col, float dist, vec3 fogCol, float dens){ float f = 1.0 - exp(-dist * dist * dens * dens); return mix(col, fogCol, f); }
`;

const vert = /* glsl */ `
  varying vec3 vW; varying vec3 vN; varying vec2 vUv;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const out = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

/* ───────────────────────── tunnel lighting ───────────────────────── */
const tunnelLight = /* glsl */ `
  uniform float uOn, uLed, uMouth;
  const float HW = ${TN.HW.toFixed(2)}, HH = ${TN.HH.toFixed(2)}, ZM = ${TN.ZM.toFixed(2)}, GAP = ${TN.GAP.toFixed(2)}, Z0 = ${TN.Z0.toFixed(2)}, NL = ${TN.NL.toFixed(1)};
  float lampOn(float i){
    float raw = clamp(uOn - (NL - 1.0 - i), 0.0, 1.0);
    if (raw >= 1.0) return 1.0;
    return raw * step(0.4, h11(floor(uTime * 16.0) + i * 7.13));
  }
  vec3 tLight(vec3 p, vec3 n, vec3 v, float gloss){
    vec3 acc = vec3(0.0);
    float fi = floor((p.z - Z0) / GAP);
    for (int k = 0; k < 2; k++){
      float i = fi + float(k);
      if (i < 0.0 || i > NL - 1.0) continue;
      float on = lampOn(i);
      vec3 lp = vec3(0.0, HH - 0.12, Z0 + i * GAP);
      vec3 L = lp - p; float d2 = dot(L, L); L *= inversesqrt(d2);
      vec3 c = vec3(1.0, 0.9, 0.74) * on;
      acc += c * (max(dot(n, L), 0.0) * 0.9 + 0.1) * 4.2 / (1.0 + d2 * 0.9) * (n.y < -0.5 ? 0.3 : 1.0);
      vec3 r = reflect(-v, n);
      acc += c * pow(max(dot(r, L), 0.0), 90.0) * gloss * 7.0 / (1.0 + d2 * 0.04);
    }
    // the yellow LED edges spill onto the floor and the bottom of the walls
    float dx = HW - abs(p.x);
    vec3 Yc = vec3(1.0, 0.78, 0.02);
    acc += Yc * uLed * ${NEON ? '1.0' : '0.0'} * (0.9 * exp(-(dx * 2.8 + p.y * 2.0)) + 0.35 * exp(-(dx * 3.2 + (HH - p.y) * 3.2)));
    // floodlight pouring in through the mouth
    float m = exp(-max(p.z - ZM, 0.0) * 0.085);
    acc += vec3(1.0, 0.96, 0.86) * m * 2.2 * uMouth * (0.55 + 0.45 * max(-n.z, 0.0) + 0.3 * n.y);
    // its glossy reflection along the floor
    vec3 r = reflect(-v, n);
    vec3 toM = normalize(vec3(0.0, 1.6, ZM) - p);
    acc += vec3(1.0, 0.95, 0.85) * pow(max(dot(r, toM), 0.0), 18.0) * gloss * 3.0 * uMouth * exp(-max(p.z - ZM, 0.0) * 0.02);
    return acc * 0.62; // exposure is lifted in the tunnel so only true emitters reach the bloom threshold
  }
`;

function tunnelMat(kind, extra = {}) {
  return new THREE.ShaderMaterial({
    defines: { KIND: kind },
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOn: { value: 0 }, uLed: { value: 0 }, uMouth: { value: 0 }, uMap: { value: extra.map || null }, uEmis: { value: extra.emis || 0 }, uFade: { value: 1 } },
    vertexShader: vert,
    transparent: kind === 3,
    depthWrite: kind !== 3,
    polygonOffset: kind === 3,
    polygonOffsetFactor: -2,
    fragmentShader: /* glsl */ `
      ${common}
      ${tunnelLight}
      uniform sampler2D uMap; uniform float uEmis, uFade;
      void main(){
        vec3 p = vW, n = normalize(vN);
        vec3 v = normalize(uCam - p);
        vec3 alb; float gloss = 0.2; float a = 1.0; vec3 emis = vec3(0.0);
        float grit = fbm(p * vec3(1.6, 2.2, 1.6));
        float fine = vnoise(p * 23.0);
        #if KIND == 0
          // walls: black gloss dado with a yellow pinstripe, raw concrete above, panel seams
          float seam = 1.0 - smoothstep(0.0, 0.012, 0.5 - abs(fract(p.z / 3.0) - 0.5));
          vec3 conc = vec3(0.12, 0.116, 0.11) * (0.65 + 0.55 * grit) * (0.9 + 0.2 * fine);
          vec3 dado = vec3(0.025) * (0.8 + 0.4 * grit);
          float lo = step(p.y, 1.15);
          alb = mix(conc, dado, lo);
          gloss = mix(0.25, 1.0, lo);
          float stripe = step(1.15, p.y) * step(p.y, 1.21);
          alb = mix(alb, ${NEON ? 'vec3(0.75, 0.62, 0.0)' : 'vec3(0.16, 0.135, 0.04)'}, stripe);
          alb *= 1.0 - 0.7 * seam * step(1.21, p.y);
        #elif KIND == 1
          // floor: dark epoxy, painted guide lines near the walls
          alb = vec3(0.03, 0.03, 0.032) * (0.8 + 0.5 * grit);
          gloss = 1.0 - 0.5 * grit;
          float lx = abs(abs(p.x) - (HW - 0.55));
          float line = 1.0 - smoothstep(0.05, 0.065, lx);
          alb = mix(alb, ${NEON ? 'vec3(0.7, 0.58, 0.0)' : 'vec3(0.14, 0.12, 0.035)'} * (0.75 + 0.25 * fine), line);
        #elif KIND == 2
          // ceiling: the floor's dark epoxy (Ahmed: same colour as the floor), with faint panel seams
          float cseam = 1.0 - smoothstep(0.0, 0.012, 0.5 - abs(fract(p.z / 3.0) - 0.5));
          alb = vec3(0.03, 0.03, 0.032) * (0.8 + 0.5 * grit) * (1.0 - 0.4 * cseam);
          gloss = 0.5;
          emis = alb * 1.6 * clamp(uOn / NL, 0.0, 1.0);   // lit by the lamps hanging just under it, like the floor
        #elif KIND == 3
          vec4 t = texture2D(uMap, vUv);
          a = t.a * uFade;
          alb = t.rgb * (0.85 + 0.3 * grit);
          gloss = 0.3;
          emis = t.rgb * uEmis;
        #else
          alb = vec3(0.04) * (0.7 + 0.6 * grit);
        #endif
        vec3 col = alb * tLight(p, n, v, gloss) + emis;
        float dist = length(uCam - p);
        col *= mix(1.0, 0.35, smoothstep(10.0, 46.0, dist)) ;
        gl_FragColor = vec4(col, a);
        ${out}
      }
    `,
  });
}

/* ───────────────────────── stadium shading ───────────────────────── */
export const fogU = { uFogCol: { value: FOG.color }, uFogD: { value: FOG.density } };   // shared: day/night retunes it (city.js)

// The stands' seats, painted onto real steps (steppedTier): each row is a concrete riser (facing the
// pitch) and a tread. A tread carries its row's seat pans and, from above, the fans' shoulders and heads;
// a riser shows the backrests of the row in front of it and those fans' shirts, which is what you see of a
// row from the pitch side. Far off, cells average out instead of shimmering.
const crowdVert = /* glsl */ `
  attribute vec2 aStep;
  varying vec3 vW; varying vec3 vN; varying vec2 vUv; varying vec2 vStep;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vStep = aStep;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
function crowdMat({ rows, seats, aisles, upper = 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uRows: { value: rows }, uSeats: { value: seats }, uAisles: { value: aisles }, uUpper: { value: upper }, uPhones: { value: 1 }, uTifo: { value: new THREE.Vector3(0, 0, 0) }, uPick: { value: new THREE.Vector4(-1, -1, -1, 0) }, uPatch: { value: new THREE.Vector4(1, 0, 1, 0) }, uCats: { value: null }, uCatOn: { value: 0 },
      // the whole-stadium tifo (tifo.js binds these): designs before/after a flip; (sweep start, sweep length, now, strength);
      // (start angle, direction, idle-wave start, gain); (this tier's first row, rows in the bowl)
      uBowlA: { value: null }, uBowlB: { value: null }, uBowlT: { value: new THREE.Vector4(-1e6, 1, 0, 0) }, uBowlW: { value: new THREE.Vector4(0.75, 1, 0, 1) }, uBowlRow: { value: new THREE.Vector2(0, 1) },
      ...fogU },
    vertexShader: crowdVert,
    side: THREE.DoubleSide,
    fragmentShader: /* glsl */ `
      ${common}
      varying vec2 vStep; // x: 0 tread / 1 riser; y: across the face (tread front→back, riser foot→lip)
      uniform float uRows, uSeats, uAisles, uUpper, uPhones; uniform vec3 uFogCol; uniform float uFogD;
      uniform vec3 uTifo; // centre angle, half arc, strength: seats under the tifo cards go dark
      uniform vec4 uPick; // seat picker (seats.js): seat column, seat row, block, strength
      uniform vec4 uPatch; // seats drawn as 3D models around a picked seat (x0, x1, row0, row1): left bare here
      uniform sampler2D uCats; uniform float uCatOn; // seat selection: each block's price-category colour (seats.js)
      uniform sampler2D uBowlA, uBowlB; uniform vec4 uBowlT, uBowlW; uniform vec2 uBowlRow; // the whole-stadium tifo (tifo.js)
      void main(){
        float riser = step(0.5, vStep.x), l = vStep.y;
        vec2 g = vec2(vUv.x * uSeats, vUv.y * uRows);
        vec2 id = floor(g);
        float fx = fract(g.x) - 0.5;
        float h = h21(id), h2 = h21(id + 17.31), h3 = h21(id + 41.7);
        float valid = step(0.0, id.y);                                     // the front riser has no row before it
        float inPatch = step(uPatch.x, id.x) * step(id.x, uPatch.y) * step(uPatch.z, id.y) * step(id.y, uPatch.w);
        float seatOn = valid * (1.0 - inPatch);
        float occ = step(h, 0.55) * seatOn;
        float grit = h21(floor(vW.xz * 4.0) + floor(vW.y * 4.0));
        vec3 conc = mix(vec3(0.115, 0.113, 0.11), vec3(0.06, 0.06, 0.063), riser) * (0.85 + 0.3 * grit);
        vec3 col = conc;
        vec3 seatC = vec3(0.64, 0.125, 0.048);   // one colour throughout (Ahmed)
        vec3 shirt = h2 < 0.52 ? vec3(0.62, 0.5, 0.02) : vec3(0.02);   // club colours only (Ahmed): yellow or black
        shirt *= 0.55 + 0.45 * fract(h * 7.31);
        float wide = smoothstep(0.45, 0.39, abs(fx));                       // inside one seat's width, gaps between
        float jit = (h3 - 0.5) * 0.12;
        if (riser > 0.5) {
          // backrests of the row in front, rounded at the top, plastic catching the light along the lip
          float top = 0.9 - 1.2 * fx * fx;
          float back = wide * smoothstep(0.04, 0.12, l) * smoothstep(top + 0.04, top - 0.04, l);
          col = mix(col, seatC * (0.7 + 0.45 * l) + vec3(0.1, 0.04, 0.02) * smoothstep(top - 0.14, top - 0.03, l), back * seatOn);
          // that row's fans: shirts filling the riser, a little narrower than the seat
          float torso = smoothstep(0.34, 0.26, abs(fx - jit));
          col = mix(col, shirt * (0.65 + 0.35 * l), torso * occ);
          col *= 0.5 + 0.5 * smoothstep(0.0, 0.3, l);                       // dark at the foot of the step
        } else {
          // seat pan at the front of the tread, its shadow behind it
          float pan = wide * smoothstep(0.16, 0.24, l) * smoothstep(0.62, 0.54, l);
          col *= 1.0 - 0.45 * wide * smoothstep(0.5, 0.62, l) * smoothstep(0.95, 0.7, l) * seatOn;
          col = mix(col, seatC * (0.95 + 0.25 * smoothstep(0.54, 0.2, l)), pan * seatOn);
          // fans from above: shoulders over the pan, head toward the back
          vec2 q = vec2(fx - jit, l - 0.52);
          float body = smoothstep(0.33, 0.24, length(q * vec2(1.0, 1.5)));
          float head = smoothstep(0.13, 0.085, length(vec2(fx - jit, l - 0.78) * vec2(1.0, 1.3)));
          col = mix(col, shirt, body * occ);
          col = mix(col, vec3(0.09, 0.065, 0.05), head * occ);
          col *= 1.0 - 0.4 * smoothstep(0.82, 1.0, l);                       // under the lip of the step behind
        }
        // aisles + vomitories
        float ac = fract(vUv.x * uAisles);
        float aisle = step(ac, 0.02);
        col = mix(col, vec3(0.6, 0.6, 0.58) * (riser > 0.5 ? 0.62 : 1.0), aisle); // white concrete stairways
        float vom = (1.0 - uUpper) * step(0.5, vUv.y) * step(vUv.y, 0.74) * step(0.465, ac) * step(ac, 0.535) * step(0.5, mod(floor(vUv.x * uAisles), 2.0));
        col = mix(col, vec3(0.004), vom);
        // far-away cells average out instead of shimmering
        float px = length(fwidth(g));
        vec3 avg = vec3(0.36, 0.11, 0.05) * (riser > 0.5 ? 0.8 : 1.0);
        col = mix(col, avg, smoothstep(0.35, 0.9, px) * (1.0 - aisle) * (1.0 - vom));
        // floodlit from above: treads catch more than the risers; shade under the roof
        float lit = (riser > 0.5 ? 0.62 : 0.92) * (0.75 + 0.25 * (1.0 - vUv.y));
        lit *= mix(1.0, 0.35, uUpper * smoothstep(0.55, 1.0, vUv.y));
        col *= lit;
        // phone torches twinkling across the crowd
        float tw = 0.5 + 0.5 * sin(uTime * (1.2 + h * 4.0) + h2 * 40.0);
        float ph = step(h3, 0.012) * occ * tw * smoothstep(0.3, 0.08, length(vec2(fx, l - 0.6)));
        float wave = 0.4 + 0.9 * smoothstep(0.88, 1.0, 0.5 + 0.5 * sin((vUv.x - uTime * 0.025) * 6.2832 * 3.0));
        col += vec3(1.0, 0.95, 0.82) * ph * 4.0 * wave * uPhones * (1.0 - smoothstep(1.0, 2.6, px));
        // the whole-stadium tifo (tifo.js): every seat holds up a card in its colour of the design (the texture is
        // one texel per seat row × a slice of angle round the bowl). A raise turns the cards over in a sweep round
        // the bowl, lower rows a beat ahead of the upper ones; once it's up a Mexican wave goes round now and then.
        if (uBowlT.w > 0.0) {
          float br = uBowlRow.x + clamp(id.y, 0.0, uRows - 1.0);
          vec2 tuv = vec2((id.x + 0.5) / uSeats, (br + 0.5) / uBowlRow.y);
          vec4 ca = texture2D(uBowlA, tuv), cb = texture2D(uBowlB, tuv);
          float ts = uBowlT.z - uBowlT.x - fract((tuv.x - uBowlW.x) * uBowlW.y) * uBowlT.y - (br / uBowlRow.y) * 0.45 - h * 0.12;
          float fk = clamp(ts / 0.38, 0.0, 1.0);
          vec4 cc = fk < 0.5 ? ca : cb;
          float edge = abs(cos(fk * 3.14159));                                  // edge-on half way through the turn
          float held = sin(fk * 3.14159);                                       // lifted high as it turns: catches the light
          float near = 1.0 - smoothstep(0.12, 0.45, px);                        // close up, a card per seat with gaps between
          float card = (riser > 0.5 ? smoothstep(0.03, 0.1, l) : smoothstep(0.08, 0.16, l) * smoothstep(0.99, 0.9, l)) * smoothstep(0.5, 0.43, abs(fx));
          float cover = cc.a * mix(1.0, card, near) * edge * seatOn * (1.0 - aisle) * (1.0 - vom) * uBowlT.w;
          float shade = (riser > 0.5 ? 0.9 : 1.0) * mix(1.0, 0.62, uUpper * smoothstep(0.55, 1.0, vUv.y)) * (0.9 + 0.2 * h2);
          float wd = fract(tuv.x - uBowlW.x - fract((uBowlT.z - uBowlW.z) / 14.0) * uBowlW.y + 0.5) - 0.5;
          float wave = step(0.5, uBowlW.z) * exp(-wd * wd * 1400.0);
          col = mix(col, cc.rgb * uBowlW.w * shade * (1.0 + 0.4 * held + 0.5 * wave), cover);
        }
        if (uTifo.z > 0.0) {
          float da = abs(atan(vW.z, vW.x) - uTifo.x);
          col *= 1.0 - 0.9 * uTifo.z * smoothstep(uTifo.y + 0.02, uTifo.y - 0.04, da);
        }
        // seat selection: blocks tinted by their price category, like a ticketing seat map
        if (uCatOn > 0.0) { vec3 cc = texture2D(uCats, vec2((floor(vUv.x * uAisles) + 0.5) / uAisles, 0.5)).rgb; col = mix(col, cc * (0.35 + 0.5 * lit), uCatOn * 0.62 * (1.0 - aisle)); }
        // seat picker: the block under the pointer lifts, the seat itself glows yellow
        float inBlk = (1.0 - step(0.5, abs(floor(vUv.x * uAisles) - uPick.z))) * uPick.w;
        col = mix(col, col * 1.8 + vec3(0.06, 0.05, 0.0), inBlk * (1.0 - aisle));
        float me = (1.0 - step(0.5, abs(id.x - uPick.x))) * (1.0 - step(0.5, abs(id.y - uPick.y))) * uPick.w;
        col = mix(col, vec3(1.7, 1.5, 0.05), me * wide);
        float dist = length(uCam - vW);
        col = fogMix(col, dist, uFogCol, uFogD);
        gl_FragColor = vec4(col, 1.0);
        ${out}
      }
    `,
  });
}

// One tier as real steps: per row a vertical riser (facing the pitch) and a level tread, following the
// tier's superellipse. uv.x runs round the bowl; uv.y is the row (a riser carries the row in front of it,
// so a riser's uv.y sits in that row). aStep: (0 tread / 1 riser, position across the face).
export function stepRow(ring, v) {
  // the front edge of row fraction v: [x semi-axis, z semi-axis, height]
  const [r0, r1] = ring;
  return [r0[0] + (r1[0] - r0[0]) * v, r0[1] + (r1[1] - r0[1]) * v, r0[2] + (r1[2] - r0[2]) * v];
}
function steppedTier(r0, r1, rows, segs, gap) {
  const pos = [], nor = [], uv = [], st = [], idx = [];
  const ringP = (v, th) => { const [a, b] = stepRow([r0, r1], v); return ringXZ(a, b, th); };
  let base = 0;
  const quadStrip = (fn) => {
    // fn(t, side) → [x, y, z, nx, ny, nz, u, v, kind, local]
    const start = base;
    for (let s = 0; s <= segs; s++) {
      for (const side of [0, 1]) { const q = fn(s / segs, side); pos.push(q[0], q[1], q[2]); nor.push(q[3], q[4], q[5]); uv.push(q[6], q[7]); st.push(q[8], q[9]); base++; }
    }
    for (let s = 0; s < segs; s++) {
      if (gap && gap(((s + 0.5) / segs) * Math.PI * 2)) continue;
      const a = start + s * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
  };
  for (let r = 0; r < rows; r++) {
    const v0 = r / rows, v1 = (r + 1) / rows;
    const y0 = r0[2] + (r1[2] - r0[2]) * v0, y1 = r0[2] + (r1[2] - r0[2]) * v1;
    const vr = (r - 0.5) / rows; // the riser shows the row in front of it
    quadStrip((t, side) => {
      const th = t * Math.PI * 2, [x, z] = ringP(v0, th), [xb, zb] = ringP(v1, th);
      const nx = x - xb, nz = z - zb, nl = Math.hypot(nx, nz) || 1;      // faces the pitch
      return [x, side ? y1 : y0, z, nx / nl, 0, nz / nl, t, vr, 1, side];
    });
    quadStrip((t, side) => {
      const th = t * Math.PI * 2, [x, z] = ringP(side ? v1 : v0, th);
      return [x, y1, z, 0, 1, 0, t, side ? v1 - 1e-4 : v0 + 1e-4, 0, side];
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aStep', new THREE.Float32BufferAttribute(st, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// cheap fake-lit concrete for the structure: brighter facing the pitch and the sky
function concMat(base, { emis = 0, flip = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBase: { value: new THREE.Color(base) }, uEmis: { value: emis }, ...fogU },
    vertexShader: vert,
    side: THREE.DoubleSide,
    fragmentShader: /* glsl */ `
      ${common}
      uniform vec3 uBase; uniform float uEmis; uniform vec3 uFogCol; uniform float uFogD;
      void main(){
        vec3 n = normalize(vN);
        vec3 v = normalize(uCam - vW);
        if (dot(n, v) < 0.0) n = -n;
        vec3 toC = normalize(vec3(-vW.x, 40.0, -vW.z));
        float l = 0.25 + 0.75 * max(dot(n, toC), 0.0);
        vec3 col = uBase * l * (0.75 + 0.5 * fbm(vW * 0.35)) + uBase * uEmis;
        col = fogMix(col, length(uCam - vW), uFogCol, uFogD);
        gl_FragColor = vec4(col, 1.0);
        ${out}
      }
    `,
  });
}

/* ───────────────────────── geometry helpers ───────────────────────── */
// a band between two ellipses: (a0,b0,y0) → (a1,b1,y1). u runs around, v up the band.
function band(r0, r1, segs, gap) {
  const pos = [], uv = [], idx = [];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs, th = t * Math.PI * 2;
    const [x0, z0] = ringXZ(r0[0], r0[1], th), [x1, z1] = ringXZ(r1[0], r1[1], th);
    pos.push(x0, r0[2], z0, x1, r1[2], z1);
    uv.push(t, 0, t, 1);
  }
  for (let s = 0; s < segs; s++) {
    const th = ((s + 0.5) / segs) * Math.PI * 2;
    if (gap && gap(th)) continue;
    const a = s * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const basic = (r, gC, b, opts = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, gC, b), toneMapped: true, ...opts });

/* ───────────────────────── build ───────────────────────── */
export async function buildWorld({ lite = false } = {}) {
  await TX.loadFonts();
  const crestImg = await TX.loadImage('/img/crest.png');

  const root = new THREE.Group();
  const tunnel = new THREE.Group();
  const stadium = new THREE.Group();
  root.add(tunnel, stadium);
  const mats = []; // every material with uTime/uCam
  const tMats = []; // tunnel-lit materials
  const reg = (m, t = false) => { mats.push(m); if (t) tMats.push(m); return m; };

  const { HW, HH, ZM, ZB, GAP, Z0, NL } = TN;
  const L = ZB - ZM + 0.2, zc = (ZB + ZM - 0.2) / 2;

  /* ── tunnel shell ── */
  const wallM = reg(tunnelMat(0), true), floorM = reg(tunnelMat(1), true), ceilM = reg(tunnelMat(2), true), backM = reg(tunnelMat(4), true);
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), m);
  const floor = plane(HW * 2, L, floorM); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, zc);
  const ceil = plane(HW * 2, L, ceilM); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, HH, zc);
  // left wall: runs either side of the club-store and changing-room doorways, lintels over them
  const zl = [ZM - 0.1, DOORS.gym[0], DOORS.gym[1], DOORS.store[0], DOORS.store[1], DOORS.changing[0], DOORS.changing[1], ZB + 0.1];
  for (let i = 0; i < zl.length - 1; i++) {
    const z0 = zl[i], z1 = zl[i + 1], door = i % 2 === 1;
    const y0 = door ? DOORS.h : 0, hgt = HH - y0;
    const seg = plane(z1 - z0, hgt, wallM);
    seg.rotation.y = Math.PI / 2;
    seg.position.set(-HW, y0 + hgt / 2, (z0 + z1) / 2);
    tunnel.add(seg);
  }
  tunnel.add(floor, ceil);
  // end wall, with the doorway to the changing room behind it
  const [bx0, bx1] = DOORS.back;
  for (const [x0, x1, y0] of [[-HW, bx0, 0], [bx1, HW, 0], [bx0, bx1, DOORS.h]]) {
    const hgt = HH - y0;
    const seg = plane(x1 - x0, hgt, backM);
    seg.rotation.y = Math.PI;
    seg.position.set((x0 + x1) / 2, y0 + hgt / 2, ZB);
    tunnel.add(seg);
  }
  // right wall: one doorway now, the trophy room's (Ahmed: its second door read as a duplicate room, and
  // the old matches room is gone — its cards float in the tunnel)
  const zs = [ZM - 0.1, DOORS.fame[0], DOORS.fame[1], DOORS.fantasy[0], DOORS.fantasy[1], DOORS.in[0], DOORS.in[1], ZB + 0.1];
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1], door = i % 2 === 1;
    const y0 = door ? DOORS.h : 0, hgt = HH - y0;
    const seg = plane(z1 - z0, hgt, wallM);
    seg.rotation.y = -Math.PI / 2;
    seg.position.set(HW, y0 + hgt / 2, (z0 + z1) / 2);
    tunnel.add(seg);
  }

  // ceiling light bars (instanced so each can flicker on independently)
  const barGeo = new THREE.BoxGeometry(HW * 1.3, 0.05, 0.32);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bars = new THREE.InstancedMesh(barGeo, barMat, NL);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < NL; i++) {
    m4.makeTranslation(0, HH - 0.03, Z0 + i * GAP);
    bars.setMatrixAt(i, m4);
    bars.setColorAt(i, new THREE.Color(0, 0, 0));
  }
  tunnel.add(bars);

  // yellow LED edges along floor and ceiling corners
  const ledMat = basic(0, 0, 0);
  const ledGeo = new THREE.BoxGeometry(0.035, 0.035, L);
  for (const sx of [-1, 1]) for (const y of [0.02, HH - 0.02]) {
    const s = new THREE.Mesh(ledGeo, ledMat);
    s.position.set(sx * (HW - 0.02), y, zc);
    tunnel.add(s);
  }

  // stencils and signage on the walls
  const stencils = [];   // the big stencilled words: the poster layouts take them down or shrink them (posters.js)
  const decal = (texture, w, h, set, emis = 0) => {
    const m = reg(tunnelMat(3, { map: texture, emis }), true);
    const mesh = plane(w, h, m);
    set(mesh);
    tunnel.add(mesh);
    return mesh;
  };
  stencils.push(decal(TX.wallEst(), 11.25, 3.0, (o) => { o.rotation.y = Math.PI / 2; o.position.set(-HW + 0.01, 1.75, 79.4); }));
  stencils.push(decal(TX.wallSeats(), 11.25, 3.0, (o) => { o.rotation.y = -Math.PI / 2; o.position.set(HW - 0.01, 1.75, 69); }));
  stencils.push(decal(TX.wallDean(), 11.25, 3.0, (o) => { o.rotation.y = Math.PI / 2; o.position.set(-HW + 0.01, 1.75, 61); }));
  decal(TX.floorMark(), 3.6, 7.2, (o) => { o.rotation.x = -Math.PI / 2; o.position.set(0, 0.012, 53.5); });
  // more graphics so no stretch of wall is bare (Ahmed)
  const leagueYears = TROPHIES.find((t) => t.key === 'league').years, asiaYears = TROPHIES.find((t) => t.key === 'acl').years;
  stencils.push(decal(TX.wallHonours(leagueYears, asiaYears), 9.2, 2.91, (o) => { o.rotation.y = -Math.PI / 2; o.position.set(HW - 0.01, 1.72, 79.6); }));
  stencils.push(decal(TX.wallStripes(), 10.4, 2.8, (o) => { o.rotation.y = -Math.PI / 2; o.position.set(HW - 0.01, 1.75, 94.0); }));
  stencils.push(decal(TX.wallColours(), 15.0, 2.81, (o) => { o.rotation.y = -Math.PI / 2; o.position.set(HW - 0.01, 1.75, 54.5); }));
  stencils.push(decal(TX.wallTigers(), 8.6, 2.72, (o) => { o.rotation.y = Math.PI / 2; o.position.set(-HW + 0.01, 1.72, 50.6); }));
  stencils.push(decal(TX.wallWayfinding(), 5.0, 2.71, (o) => { o.rotation.y = Math.PI / 2; o.position.set(-HW + 0.01, 1.72, 97.1); }));

  // crest light-box on the left wall
  if (crestImg) {
    const c = document.createElement('canvas');
    c.width = 494; c.height = 554;
    c.getContext('2d').drawImage(crestImg, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.05, 1.9), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    box.position.set(-HW + 0.09, 1.95, 87);
    tunnel.add(box);
    stencils.push(box, decal(t, 1.62, 1.82, (o) => { o.rotation.y = Math.PI / 2; o.position.set(-HW + 0.19, 1.95, 87); }, 0.8));
  }

  // banner hung across the tunnel
  const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 - 0.5, (HW * 2 - 0.5) * (300 / 2048)), new THREE.MeshBasicMaterial({ map: TX.banner(), color: new THREE.Color(0.55, 0.55, 0.55) }));
  bannerMesh.position.set(0, HH - 0.62, 80);
  tunnel.add(bannerMesh);
  const rodGeo = new THREE.BoxGeometry(0.03, 0.42, 0.03);
  for (const sx of [-1, 1]) { const r = new THREE.Mesh(rodGeo, new THREE.MeshBasicMaterial({ color: 0x111111 })); r.position.set(sx * 2.6, HH - 0.21, 80); tunnel.add(r); }

  // "WALK OUT" LED sign near the mouth
  const signMat = new THREE.MeshBasicMaterial({ map: TX.walkSign(), color: new THREE.Color(1.8, 1.8, 1.8) });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), signMat);
  sign.position.set(0, HH - 0.42, 50.2);
  tunnel.add(sign);


  /* ── the doorway: a sheet of floodlight glare that the eye adapts to ── */
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HH), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.05, 2.7), transparent: true, opacity: 1, depthWrite: false }));
  glare.position.set(0, HH / 2, ZM - 0.15);
  tunnel.add(glare);

  // light shafts: stacked additive slices that pour in from the top of the mouth
  const shaftTex = TX.shaft();
  const shafts = [];
  for (let i = 0; i < 9; i++) {
    const d = i * 0.75;
    const top = HH - d * 0.42;
    if (top < 0.4) break;
    const m = new THREE.MeshBasicMaterial({ map: shaftTex, color: new THREE.Color(1, 0.95, 0.82), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2 - 0.2, top), m);
    s.position.set(0, top / 2, ZM + 0.2 + d);
    s.userData.base = 0.11 * (1 - i / 10);
    tunnel.add(s);
    shafts.push(s);
  }

  // dust motes hanging in the light
  const NDUST = lite ? 220 : 520;
  const dpos = new Float32Array(NDUST * 3), dseed = new Float32Array(NDUST);
  for (let i = 0; i < NDUST; i++) {
    const r = Math.random();
    dpos[i * 3] = (Math.random() - 0.5) * HW * 1.9;
    dpos[i * 3 + 1] = Math.random() * HH;
    dpos[i * 3 + 2] = ZM - 4 + Math.pow(r, 1.6) * 34;
    dseed[i] = Math.random();
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dGeo.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime, uPx; varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.21 + seed * 40.0) * 0.35;
        p.y += sin(uTime * 0.13 + seed * 17.0) * 0.25;
        p.z += cos(uTime * 0.17 + seed * 23.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min((0.9 + seed * 1.6) * uPx * (12.0 / -mv.z), 5.0 * uPx);
        vA = exp(-max(p.z - ${ZM.toFixed(1)}, 0.0) * 0.09) * (0.35 + 0.65 * seed) * smoothstep(0.3, 2.0, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; uniform float uAmt;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * uAmt; gl_FragColor = vec4(vec3(1.0, 0.95, 0.8) * a * 1.6, 1.0); }`,
  });
  const dust = new THREE.Points(dGeo, dustMat);
  dust.visible = false;   // Ahmed: no floating dust (kept built so its uniforms stay valid)
  tunnel.add(dust);

  // mouth frame: yellow LED outline, seen from both sides
  const frameMat = basic(3.2, 2.7, 0.06);
  const fv = new THREE.BoxGeometry(0.07, HH + 0.07, 0.07), fh = new THREE.BoxGeometry(HW * 2 + 0.14, 0.07, 0.07);
  for (const sx of [-1, 1]) { const f = new THREE.Mesh(fv, frameMat); f.position.set(sx * (HW + 0.035), HH / 2, ZM - 0.05); tunnel.add(f); }
  const ftop = new THREE.Mesh(fh, frameMat); ftop.position.set(0, HH + 0.035, ZM - 0.05); tunnel.add(ftop);

  /* ───────────── stadium ───────────── */
  const SEG = lite ? 160 : 256;
  const pitchT = TX.pitch();
  const pitchMesh = new THREE.Mesh(new THREE.PlaneGeometry(pitchT.w, pitchT.h), new THREE.MeshBasicMaterial({ map: pitchT.tex, color: new THREE.Color(1.15, 1.15, 1.1), fog: true }));
  pitchMesh.rotation.x = -Math.PI / 2;
  pitchMesh.position.y = 0.03;
  stadium.add(pitchMesh);
  const apronShape = new THREE.Shape(Array.from({ length: 128 }, (_, i) => { const [x, z] = ringXZ(BOWL.lower[0][0] + 0.5, BOWL.lower[0][1] + 0.5, (i / 128) * Math.PI * 2); return new THREE.Vector2(x, -z); }));
  const apron = new THREE.Mesh(new THREE.ShapeGeometry(apronShape), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.11, 0.24, 0.1), fog: true }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.12;
  stadium.add(apron);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(700, 32), new THREE.MeshBasicMaterial({ color: 0x050505, fog: true }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.6;
  // (replaced by city.js)

  // goals: real frames and nets (goal.js)
  stadium.userData.goals = [-1, 1].map((sx) => {
    const g = buildGoal(sx);
    g.group.position.set(sx * 52.5, 0.03, 0);
    stadium.add(g.group);
    return g;
  });

  // the bowl, lofted from one cross-section profile
  const ribbon = TX.ledRibbon({ bg: '#0f86c4', a: '#ffffff', b: '#bfe9ff' });
  ribbon.repeat.set(9, 1);
  const ribbonMat = new THREE.MeshBasicMaterial({ map: ribbon, color: new THREE.Color(1.05, 1.05, 1.05), side: THREE.DoubleSide, fog: true }); // under bloom so the text reads
  const lower = reg(crowdMat({ rows: 24, seats: 720, aisles: 44 }));
  const middle = reg(crowdMat({ rows: 20, seats: 900, aisles: 48 }));
  const upper = reg(crowdMat({ rows: 22, seats: 1040, aisles: 52, upper: 1 }));
  const dark = reg(concMat(0x1a1a1c));
  const whiteWall = reg(concMat(0x9fa1a3)); // the lower tier's white front wall
  const darker = reg(concMat(0x0e0e10));
  const P = [
    [63, 45, 0, whiteWall, 'gap'], [...BOWL.lower[0], lower, 'gap'], [...BOWL.lower[1], darker], [82, 63, 13.4, ribbonMat],
    [82, 63, 15.5, darker], [...BOWL.middle[0], middle], [...BOWL.middle[1], darker], [97, 77, 26.2, ribbonMat],
    [97, 77, 28, darker], [...BOWL.upper[0], upper], [...BOWL.upper[1], darker], [116, 95, 47],
    [122, 100, 44, darker], [122, 100, 0],  // dark facade below the petals
  ];
  const mouthGap = (th) => Math.sin(th) > 0 && Math.abs(ringXZ(BOWL.lower[0][0], BOWL.lower[0][1], th)[0]) < HW + 1.3;
  for (let i = 0; i < P.length - 1; i++) {
    const [a0, b0, y0, mat, flag] = P[i];
    const [a1, b1, y1] = P[i + 1];
    if (!mat) continue;
    const gapFn = flag === 'gap' ? mouthGap : null;
    // seating tiers are real steps; everything else (walls, fascias, ribbons) stays a smooth band
    const geo = mat.uniforms?.uRows ? steppedTier([a0, b0, y0], [a1, b1, y1], mat.uniforms.uRows.value, SEG, gapFn) : band([a0, b0, y0], [a1, b1, y1], SEG, gapFn);
    stadium.add(new THREE.Mesh(geo, mat));
  }
  // lintel over the mouth
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 0.4, 0.4, 0.4), dark);
  lintel.position.set(0, HH + 0.2, ZM + 0.05);
  // the stand over the tunnel: a concrete wedge filling the notch, its top following the seat rake and
  // its underside the tunnel's ceiling, so the opening reads as a cut in the stand (not seats overhead)
  {
    const w = HW + 1.8, [fa, fb, fy] = BOWL.lower[0], [ba, bb, by] = BOWL.lower[1];
    const zF = fb, zB = bb, wB = w * (ba / fa) + 1, yAt = (z) => fy + ((z - zF) / (bb - fb)) * (by - fy) + 0.25;
    const v = [
      // its underside sits just above the tunnel ceiling (it was flush, and its dark concrete won over the
      // ceiling's grey near the mouth)
      [-w, HH + 0.06, zF], [w, HH + 0.06, zF], [w, yAt(zF) + HH - fy, zF], [-w, yAt(zF) + HH - fy, zF],   // front face
      [-wB, HH + 0.06, zB], [wB, HH + 0.06, zB], [wB, yAt(zB) + 0.3, zB], [-wB, yAt(zB) + 0.3, zB],         // back
    ];
    const f = [[0, 1, 2, 3], [1, 5, 6, 2], [5, 4, 7, 6], [4, 0, 3, 7], [3, 2, 6, 7], [4, 5, 1, 0]];
    const pos = [];
    for (const q of f) for (const i of [0, 1, 2, 0, 2, 3]) pos.push(...v[q[i]]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    stadium.add(new THREE.Mesh(g, dark));
    // side walls of the notch, down to the pitch, in the stand's white concrete
    for (const sx of [-1, 1]) {
      // thick enough to hide the stand's stepped cut edge, flush with the tunnel walls
      // starts just outside the tunnel wall plane (sharing it z-fights), runs past the stand's cut edge
      const x0 = HW + 0.06, ww = w - x0 + 0.6;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, HH + 2, 9), whiteWall);
      wall.position.set(sx * (x0 + ww / 2), (HH + 2) / 2, zF + 4.5);
      stadium.add(wall);
    }
  }
  stadium.add(lintel);

  // pitch-side LED boards (a gap where the tunnel comes out)
  const boardTex = TX.ledRibbon();
  const boards = [];
  const boardM = (rep) => { const t = boardTex.clone(); t.repeat.set(rep, 1); t.needsUpdate = true; boards.push(t); return new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.8, 1.8, 1.8), fog: true }); };
  const back0 = new THREE.MeshBasicMaterial({ color: 0x060606, fog: true });
  const board = (len, x, z, ry, rep) => {
    const mats6 = [back0, back0, back0, back0, boardM(rep), back0];
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.2), mats6);
    b.position.set(x, 0.45, z);
    b.rotation.y = ry;
    stadium.add(b);
  };
  // pitch-side boards, kept clear of the stands' rounded corners
  board(90, 0, -39, 0, 4.7);
  board(40, -25, 39, Math.PI, 2.1);
  board(40, 25, 39, Math.PI, 2.1);
  board(60, -58, 0, Math.PI / 2, 3.2);
  board(60, 58, 0, -Math.PI / 2, 3.2);

  /* ── Al-Jawhara's crown roof, with the floodlights under its inner edge (roof.js) ── */
  const glowTex = TX.radial();
  const coreTex = TX.radial([[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,250,230,0.6)'], [0.4, 'rgba(255,240,200,0.08)'], [1, 'rgba(255,240,200,0)']]);
  const roof = buildRoof({ fogU, mats, coreTex, lite });
  stadium.add(roof.group);
  const heads = roof.heads;

  // warm haze hanging over the floodlit bowl
  const dome = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(0.11, 0.09, 0.045), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  dome.scale.set(520, 360, 1);
  dome.position.set(0, 70, 0);
  stadium.add(dome);

  /* ── sky ── */
  // the sky is city.js's now

  return {
    root, tunnel, stadium, mats, tMats, bars, ledMat, frameMat, glare, shafts, dust, dustMat, ribbon, boards, heads, glowTex, roofLook: roof.group.userData, stencils,
    crowd: [lower, middle, upper], tifoTiers: [lower, middle, upper],
  };
}
