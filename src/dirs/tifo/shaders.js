// GLSL for the card stand. Every card is one instance: its rest pose, tifo colours, flip timing,
// wave response and lighting are all resolved here, so the CPU only updates a handful of uniforms.

export const MAX_WAVES = 12;

export const CARD_VERT = /* glsl */ `
  attribute vec3 aPos;     // rest position (card centre)
  attribute vec3 aInfo;    // yaw, width, height
  attribute vec2 aCell;    // tifo texel centre (u along the stand, v front→back)
  attribute vec4 aRand;

  uniform float uTime;
  uniform sampler2D uPrev;
  uniform sampler2D uNext;
  uniform float uT0;       // transition start
  uniform float uSpan;     // sweep length (s)
  uniform float uDur;      // single-card flip (s)
  uniform int uMode;       // 0 radial from uOrigin, 1 left→right, 2 front→back, 3 centre-out
  uniform vec2 uOrigin;
  uniform vec4 uWaves[${MAX_WAVES}]; // u, v, t0, kind (0 pointer ripple, 1/2 Mexican wave →/←)
  uniform vec3 uPtr;       // pointer cell + strength
  uniform float uAsp;      // visual width/height of the grid
  uniform float uMotion;   // 0 when reduced motion

  varying vec3 vFront;
  varying vec3 vBack;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  varying float vShade;
  varying float vTurn;
  varying float vLift;

  const float PI = 3.14159265;

  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }
  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
  float backOut(float x) { float c1 = 1.9, c3 = c1 + 1.; return 1. + c3 * pow(x - 1., 3.) + c1 * pow(x - 1., 2.); }

  vec3 reversePrint(vec3 c) {
    // the other side of each card: black cards are yellow on the back, the rest are black
    float l = dot(c, vec3(0.3, 0.59, 0.11));
    return l < 0.25 ? vec3(0.996, 0.949, 0.004) : vec3(0.07);
  }

  void main() {
    vec2 cell = aCell;
    vec2 asp = vec2(uAsp, 1.);

    /* ── tifo transition: a sweep of flips with human timing ── */
    float ord;
    if (uMode == 0) ord = length((cell - uOrigin) * asp) / (uAsp * 0.95);
    else if (uMode == 1) ord = cell.x;
    else if (uMode == 2) ord = cell.y;
    else ord = abs(cell.x - 0.5) * 2.;
    ord = clamp(ord, 0., 1.);
    float late = step(0.94, aRand.z) * 0.3 * aRand.w;              // a few fans are always late
    float delay = ord * uSpan + aRand.y * 0.2 + late;
    float p = clamp((uTime - uT0 - delay) / uDur, 0., 1.);
    float flipA = PI * backOut(p);
    float flipLift = sin(PI * p) * 0.6;

    /* ── waves ── */
    float spin = 0., lift = 0., tilt = 0.;
    for (int i = 0; i < ${MAX_WAVES}; i++) {
      vec4 w = uWaves[i];
      float age = uTime - w.z;
      if (age < 0. || age > 9.) continue;
      if (w.w < 0.5) {
        // pointer ripple: a ring of full turns spreading from the cursor
        float dist = length((cell - w.xy) * asp);
        float range = 0.26;
        if (dist > range) continue;
        float x = age * 0.95 - dist + (aRand.x - 0.5) * 0.025;
        float ph = smoothstep(-0.01, 0.2, x);
        spin += backOut(ph);
        lift += exp(-x * x / 0.003) * 0.75 * (1. - dist / range);
      } else {
        // Mexican wave: a band of standing fans rolling along the stand
        float dir = w.w < 1.5 ? 1. : -1.;
        float pos = (dir > 0. ? cell.x : 1. - cell.x) * uAsp;
        float x = age * 0.62 - 0.25 - pos + (aRand.x - 0.5) * 0.06 + cell.y * 0.05;
        float b = exp(-x * x / 0.018);
        lift += b * 1.35;
        tilt += b;
      }
    }
    float pd = length((cell - uPtr.xy) * asp);
    float near = exp(-pd * pd / 0.004) * uPtr.z;
    lift += near * 0.5;
    tilt += near * 0.35;

    /* ── pose ── */
    float bob = sin(uTime * (1.3 + aRand.w * 0.9) + aRand.x * 6.2831) * 0.045;
    float ax = flipA + spin * 2. * PI + (aRand.y - 0.5) * 0.2 + 0.08 - tilt * 0.85 * uMotion;
    float yaw = aInfo.x + (aRand.z - 0.5) * 0.1;
    float roll = (aRand.w - 0.5) * 0.09;
    mat3 R = rotY(yaw) * rotZ(roll) * rotX(ax);
    vec3 local = vec3(position.x * aInfo.y, position.y * aInfo.z, 0.);
    vec3 wp = aPos + R * local;
    wp.y += (lift + flipLift + bob) * uMotion;

    vN = R * vec3(0., 0., 1.);
    vW = wp;
    vUv = uv;
    vShade = 0.86 + aRand.x * 0.2;
    vTurn = abs(sin(ax));
    vLift = clamp(lift * 0.7, 0., 1.) * uMotion;

    vec3 prevC = texture2D(uPrev, cell).rgb;
    vec3 nextC = texture2D(uNext, cell).rgb;
    vFront = prevC;
    vBack = p > 0.0001 ? nextC : reversePrint(prevC);

    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
  }
`;

export const CARD_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uFog;
  uniform float uSheenX;

  varying vec3 vFront;
  varying vec3 vBack;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  varying float vShade;
  varying float vTurn;
  varying float vLift;

  void main() {
    bool front = gl_FrontFacing;
    vec3 base = front ? vFront : vBack;
    vec3 N = normalize(vN) * (front ? 1. : -1.);
    vec3 V = normalize(cameraPosition - vW);

    // two floodlight banks on the roof behind the camera, one warm fill from the pitch
    vec3 L1 = normalize(vec3(-0.45, 0.8, 0.55));
    vec3 L2 = normalize(vec3(0.5, 0.75, 0.6));
    vec3 L3 = normalize(vec3(0., -0.2, 1.));
    float dif = max(dot(N, L1), 0.) * 0.55 + max(dot(N, L2), 0.) * 0.5 + max(dot(N, L3), 0.) * 0.25;
    float sp = pow(max(dot(N, normalize(L1 + V)), 0.), 60.) + pow(max(dot(N, normalize(L2 + V)), 0.), 60.);

    // a slow floodlight sweep that glints off the cards as it passes
    float sheen = exp(-pow((vW.x - uSheenX) / 7., 2.));

    vec2 e = min(vUv, 1. - vUv);
    float edge = smoothstep(0., 0.07, min(e.x * 1.6, e.y));
    // a soft fold/print line across each card
    float fold = 1. - 0.06 * smoothstep(0.02, 0., abs(vUv.y - 0.5));

    vec3 col = base * (0.22 + dif * 0.95) * vShade * fold;
    col *= mix(0.45, 1., edge);
    col *= 1. + vLift * 0.45;
    col += vec3(1., 0.98, 0.9) * (sp * 0.32 + sheen * (0.05 + sp * 0.9 + vTurn * 0.12));

    float dist = length(cameraPosition - vW);
    col = mix(col, uFog, smoothstep(110., 210., dist) * 0.6);
    gl_FragColor = vec4(col, 1.);
  }
`;

export const PITCH_VERT = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
export const PITCH_FRAG = /* glsl */ `
  uniform vec3 uFog;
  varying vec3 vW;
  void main() {
    // mown stripes, lit where the floodlights pool in front of the stand
    float stripe = step(0.5, fract(vW.z / 5.5));
    vec3 g = mix(vec3(0.035, 0.07, 0.04), vec3(0.045, 0.088, 0.05), stripe);
    float pool = exp(-pow((vW.z + 26.) / 18., 2.)) * exp(-pow(vW.x / 60., 2.));
    g *= 0.7 + pool * 1.5;
    // touchline in front of the boards
    float line = smoothstep(0.12, 0.0, abs(vW.z + 29.)) * step(abs(vW.x), 52.);
    g = mix(g, vec3(0.55, 0.58, 0.5), line * 0.6);
    float d = length(cameraPosition - vW);
    g = mix(g, uFog, smoothstep(60., 200., d));
    gl_FragColor = vec4(g, 1.);
  }
`;
