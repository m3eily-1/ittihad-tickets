// The city and the night sky round the stadium, for the top views (Ahmed, 2026-10-11: "night city").
// Stylised, not a map of Jeddah: a lit plaza and car parks full of cars round the bowl, avenues and ring
// roads under sodium streetlights with traffic moving on them, low-rise blocks with lit windows and a
// cluster of towers on one side for a skyline, under a night sky glowing warm at the horizon.
// Everything is procedural and instanced; distance haze fades it into the sky's horizon colour.
import * as THREE from 'three';

// night: the haze is the sky's horizon colour, kept dark so the lights carry the city
const HORIZON = new THREE.Color(0.03, 0.022, 0.016), ZENITH = new THREE.Color(0.002, 0.003, 0.007);
const GLOW = new THREE.Color(0.052, 0.032, 0.017);   // light pollution on the horizon
// time of day (Ahmed, 2026-10-13: day/night from the match's kick-off): 0 night · 1 full day. Dusk sits
// between, with its own sky. setTimeOfDay() recolours these shared colours in place.
const uDay = { value: 0 };
const SUN = new THREE.Vector3(0.35, 0.55, -0.76).normalize();
const R_CLEAR = 340, R_CITY = 1650;          // nothing built inside R_CLEAR but plaza, car parks and roads
const hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };

const haze = /* glsl */ `
  uniform vec3 uHorizon; uniform float uDay;
  vec3 hazeMix(vec3 col, float d){ return mix(col, uHorizon, 1.0 - exp(-d * mix(0.0007, 0.00028, uDay))); }   // clearer air by day
`;

// roads: avenues out from the stadium, ring roads, and a grid of streets beyond the clear zone
const RINGS = [330, 720, 1150];
const AVENUES = 10;
const BLOCK = 110;

function groundMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uHorizon: { value: HORIZON }, uTime: { value: 0 }, uDay },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      ${haze}
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float line(float d, float w){ return 1.0 - smoothstep(w * 0.5, w * 0.5 + 1.5, abs(d)); }
      void main(){
        vec2 p = vW.xz; float r = length(p), a = atan(p.y, p.x);
        // dusty ground, a little lighter in patches
        float n = h21(floor(p / 24.0)) * 0.5 + h21(floor(p / 7.0)) * 0.25;
        vec3 col = vec3(0.008, 0.007, 0.006) * (0.8 + 0.6 * n);
        // the stadium's spill: the plaza is lit, the glow fades out across the car parks
        float spill = exp(-max(r - 120.0, 0.0) / 90.0);
        // plaza paving round the bowl
        float plaza = smoothstep(118.0, 122.0, r) * (1.0 - smoothstep(150.0, 154.0, r));
        col = mix(col, vec3(0.09, 0.085, 0.08) * (0.85 + 0.15 * h21(floor(p / 3.0))), plaza);
        // car parks: asphalt with bay lines
        float park = smoothstep(156.0, 160.0, r) * (1.0 - smoothstep(292.0, 296.0, r));
        vec3 asph = vec3(0.016, 0.016, 0.018);
        vec2 bay = vec2(fract(r / 7.0), fract(a * r / 2.6));
        float bays = max(line(bay.x * 7.0 - 3.5, 0.25) * 0.0, step(0.94, bay.y)) * step(0.15, abs(fract(r / 14.0) - 0.5));
        col = mix(col, asph + vec3(0.06) * bays, park);
        // roads
        float road = 0.0;
        ${RINGS.map((R) => `road = max(road, line(r - ${R}.0, 18.0));`).join('\n        ')}
        float av = abs(fract(a / 6.2831853 * ${AVENUES}.0 + 0.5) - 0.5) * 6.2831853 / ${AVENUES}.0 * r;   // distance to the nearest avenue
        road = max(road, line(av, 22.0) * step(150.0, r));
        vec2 gq = abs(fract(p / ${BLOCK}.0) - 0.5) * ${BLOCK}.0;
        road = max(road, line(min(gq.x, gq.y), 11.0) * step(${R_CLEAR}.0 + 20.0, r));
        col = mix(col, vec3(0.014, 0.014, 0.016), road);
        // sodium light pooled on the roads, centre lines
        float pool = road * (0.55 + 0.45 * smoothstep(0.4, 0.0, abs(fract(r / 32.0) - 0.5)));
        col += vec3(0.32, 0.16, 0.04) * pool * 0.26;
        col += vec3(0.5, 0.45, 0.3) * road * line(av, 0.6) * step(150.0, r) * 0.12;
        col += vec3(0.5, 0.38, 0.22) * spill * 0.16 * (1.0 - road);
        float d = length(cameraPosition - vW);
        // by day: sand, pale paving, grey asphalt with painted bays, darker roads
        vec3 dayC = mix(vec3(0.36, 0.3, 0.22) * (0.85 + 0.3 * n), vec3(0.46, 0.44, 0.4), plaza);
        dayC = mix(dayC, vec3(0.14, 0.14, 0.15) + vec3(0.3) * bays, park);
        dayC = mix(dayC, vec3(0.11, 0.11, 0.12), road);
        col = mix(col, dayC, uDay);
        col = hazeMix(col, d);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function buildingMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uHorizon: { value: HORIZON }, uTime: { value: 0 }, uDay },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN; varying float vId; varying float vTop;
      void main(){
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * normal); vId = float(gl_InstanceID);
        vTop = (m * vec4(0.0, 1.0, 0.0, 1.0)).y;     // the building's roof height
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vW; varying vec3 vN; varying float vId; varying float vTop;
      ${haze}
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec3 n = normalize(vN);
        float tone = h21(vec2(vId, 3.1));
        vec3 wall = mix(vec3(0.006, 0.006, 0.008), vec3(0.016, 0.014, 0.012), tone);
        vec3 col = wall;
        float winD = 0.0;
        if (abs(n.y) < 0.5) {
          // windows: a grid of storeys and bays across each face, some lit warm, some cool, most dark
          vec2 t = vec2(dot(vW.xz, vec2(n.z, -n.x)), vW.y);
          vec2 cell = floor(t / vec2(2.6, 3.3)), f = fract(t / vec2(2.6, 3.3));
          float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.8) * step(2.0, vW.y);
          winD = win;
          float h = h21(cell + vId * 7.13);
          float lit = step(0.62 - 0.25 * step(60.0, vTop), h);
          vec3 lamp = h21(cell + 1.7) < 0.7 ? vec3(1.0, 0.72, 0.38) : vec3(0.65, 0.78, 1.0);
          col += win * (lit * lamp * (0.4 + 0.4 * h21(cell + 9.1)) + (1.0 - lit) * vec3(0.004, 0.005, 0.008));
          col *= 0.75 + 0.25 * abs(n.x);
          // the bottom storey catches the street light
          col += vec3(0.2, 0.11, 0.035) * (1.0 - smoothstep(0.0, 9.0, vW.y)) * 0.15;
        } else {
          col *= 0.6;                                         // roofs
        }
        // by day: sand-coloured render and white blocks in the sun, windows dark glass
        vec3 dayB = mix(vec3(0.4, 0.35, 0.28), vec3(0.62, 0.58, 0.52), tone);
        dayB *= abs(n.y) < 0.5 ? 0.62 + 0.38 * max(dot(n, normalize(vec3(0.35, 0.0, -0.76))), 0.0) : 1.08;
        dayB = mix(dayB, vec3(0.1, 0.14, 0.18), winD * 0.85);
        col = mix(col, dayB, uDay);
        float d = length(cameraPosition - vW);
        col = hazeMix(col, d);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function carMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uHorizon: { value: HORIZON }, uDay },
    vertexShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN; varying vec3 vC;
      void main(){
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * normal); vC = instanceColor;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW; varying vec3 vN; varying vec3 vC;
      ${haze}
      void main(){
        vec3 n = normalize(vN);
        vec3 col = vC * (0.12 + 0.3 * max(n.y, 0.0)) + vec3(0.04, 0.025, 0.01) * max(n.y, 0.0);
        col *= mix(1.0, 3.4, uDay);   // in daylight
        col = hazeMix(col, length(cameraPosition - vW));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// glowing points: streetlights (still) and traffic (moving round a ring or along an avenue)
function lightsMat(moving) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHorizon: { value: HORIZON }, uScale: { value: 800 }, uDay },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uScale;
      attribute vec3 aCol; attribute vec4 aMove;   // moving: ring radius, start angle, speed (rad/s), lane offset
      varying vec3 vC; varying float vD;
      void main(){
        vec3 p = position;
        ${moving ? 'float a = aMove.y + uTime * aMove.z; float r = aMove.x + aMove.w; p = vec3(cos(a) * r, 0.9, sin(a) * r);' : ''}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vD = -mv.z; vC = aCol;
        gl_PointSize = clamp(uScale * ${moving ? '1.4' : '3.0'} / vD, 1.5, 26.0);   // uScale: pixels per metre at 1 m
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon; uniform float uDay;
      varying vec3 vC; varying float vD;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a = a * a;
        float fade = exp(-vD * 0.0009);
        float on = 1.0 - uDay;   // street and traffic lights are off / invisible by day
        gl_FragColor = vec4(vC * a * fade * on, a * fade * on);
      }`,
  });
}

function skyMat() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uHorizon: { value: GLOW }, uZenith: { value: ZENITH }, uDay, uSun: { value: SUN } },
    vertexShader: /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon, uZenith; uniform float uDay; uniform vec3 uSun;
      varying vec3 vD;
      float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        float e = vD.y;
        // light pollution: warm at the horizon, deep blue overhead; a darker band below the horizon line
        vec3 col = mix(uHorizon, uZenith, pow(clamp(e, 0.0, 1.0), 0.38));
        col = mix(col, uHorizon * 0.6, smoothstep(0.0, -0.06, e));
        col += vec3(0.05, 0.03, 0.015) * exp(-abs(e) * 18.0);          // the glow right on the horizon
        // stars: fine and coarse, fewer near the glowing horizon
        vec2 g = vD.xz / max(e + 0.25, 0.08);
        float s1 = step(0.9965, h21(floor(g * 260.0))), s2 = step(0.9992, h21(floor(g * 90.0) + 3.7));
        col += vec3(0.75, 0.8, 1.0) * (s1 * 0.35 + s2 * 0.8) * smoothstep(0.08, 0.5, e) * (1.0 - smoothstep(0.0, 0.3, uDay));
        // the moon, low over the city, and its halo
        vec3 mDir = normalize(vec3(-0.55, 0.32, -0.77));
        float md = dot(vD, mDir);
        col += (vec3(1.0, 0.96, 0.88) * smoothstep(0.99955, 0.9997, md) * 1.6 + vec3(0.18, 0.17, 0.15) * pow(max(md, 0.0), 220.0)) * (1.0 - smoothstep(0.0, 0.3, uDay));
        float sd = max(dot(vD, uSun), 0.0);
        col += uDay * (vec3(1.0, 0.97, 0.9) * smoothstep(0.9993, 0.9996, sd) * 0.9 + vec3(0.35, 0.3, 0.22) * pow(sd, 12.0) * 0.5);   // the sun
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// the three looks: night (the default), dusk, day. fog: the stadium's own haze colour (world.js FOG.color)
const LOOKS = {
  night: { day: 0, fogD: 0.0032, horizon: [0.03, 0.022, 0.016], zenith: [0.002, 0.003, 0.007], glow: [0.052, 0.032, 0.017], fog: [0.0021, 0.0021, 0.003] },
  dusk: { day: 0.22, fogD: 0.0019, horizon: [0.22, 0.1, 0.05], zenith: [0.012, 0.022, 0.07], glow: [0.75, 0.3, 0.1], fog: [0.09, 0.05, 0.04] },
  day: { day: 1, fogD: 0.0009, horizon: [0.5, 0.57, 0.64], zenith: [0.09, 0.24, 0.62], glow: [0.58, 0.64, 0.72], fog: [0.42, 0.47, 0.53] },
};
// kick-off → look, from Jeddah's sunset (about 17:40 in December to 19:05 in June)
export function lookFor(match) {
  if (!match || !match.kickoff || match.timeTBC) return 'night';
  const d = new Date(match.kickoff * 1000 + 3 * 3600 * 1000);                 // Jeddah time (UTC+3)
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const doy = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  const sunset = 18.42 + 0.7 * Math.cos((2 * Math.PI * (doy - 172)) / 365);
  return hour < sunset - 0.75 ? 'day' : hour < sunset + 0.75 ? 'dusk' : 'night';
}
export function setTimeOfDay(name, fogColor, fogU) {
  const L = LOOKS[name] || LOOKS.night;
  if (fogU) fogU.uFogD.value = L.fogD;
  uDay.value = L.day;
  HORIZON.setRGB(...L.horizon); ZENITH.setRGB(...L.zenith); GLOW.setRGB(...L.glow);
  fogColor?.setRGB(...L.fog);
  return name;
}

export function buildCity({ lite = false } = {}) {
  const group = new THREE.Group();
  const mats = [];

  // sky: follows the camera so it's never clipped
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 24), skyMat());
  sky.frustumCulled = false; sky.renderOrder = -10;
  group.add(sky);

  // ground
  const gm = groundMat(); mats.push(gm);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2400, 96), gm);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6;
  group.add(ground);

  // buildings, on the street grid beyond the clear zone; a tower cluster to one side for a skyline
  const bm = buildingMat(); mats.push(bm);
  const boxes = [];
  const towerC = new THREE.Vector2(-820, -760);
  const step = lite ? BLOCK : BLOCK / 2;
  for (let gx = -R_CITY; gx <= R_CITY; gx += step) for (let gz = -R_CITY; gz <= R_CITY; gz += step) {
    const r = Math.hypot(gx, gz);
    if (r < R_CLEAR + 60 || r > R_CITY) continue;
    const a = Math.atan2(gz, gx);
    const avd = Math.abs(((a / (Math.PI * 2)) * AVENUES + 0.5) % 1 - 0.5) * (Math.PI * 2 / AVENUES) * r;
    if (avd < 40) continue;                                                     // keep the avenues clear
    if (RINGS.some((R) => Math.abs(r - R) < 45)) continue;                      // and the ring roads
    const h = hash(gx, gz);
    if (h < 0.18) continue;                                                     // empty lots
    const tw = Math.exp(-Math.pow(new THREE.Vector2(gx, gz).distanceTo(towerC) / 330, 2));
    const n = lite ? 1 : 1 + Math.floor(hash(gz, gx) * 3);
    for (let k = 0; k < n; k++) {
      const w = 14 + hash(gx + k, gz) * 30, d = 14 + hash(gx, gz + k) * 30;
      let height = 6 + Math.pow(hash(gx * 2 + k, gz), 2.2) * 26;
      if (tw > 0.15 && hash(gx + 9, gz + k) < tw) height = 50 + hash(gx, gz * 3 + k) * 150 * tw;   // the skyline
      const ox = (hash(gx + k * 3, gz) - 0.5) * (step - w - 12), oz = (hash(gx, gz + k * 3) - 0.5) * (step - d - 12);
      boxes.push([gx + ox, gz + oz, w, height, d, hash(gx, gz + 5) * Math.PI]);
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const bld = new THREE.InstancedMesh(box, bm, boxes.length);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
  boxes.forEach(([x, z, w, hgt, d, rot], i) => {
    Q.setFromAxisAngle(UP, Math.round(rot / (Math.PI / 2)) * (Math.PI / 2) + (hash(x, z) - 0.5) * 0.1);
    M.compose(new THREE.Vector3(x, -0.6, z), Q, new THREE.Vector3(w, hgt, d));
    bld.setMatrixAt(i, M);
  });
  bld.frustumCulled = false;
  group.add(bld);

  // car parks: rows of cars round the bowl, gaps along the avenues
  const cm = carMat();
  const cars = [], CAR_COLS = [[0.75, 0.75, 0.74], [0.08, 0.08, 0.09], [0.4, 0.41, 0.43], [0.55, 0.52, 0.48], [0.45, 0.07, 0.05], [0.1, 0.16, 0.3]];
  for (let r = 164; r < 290; r += 7) {
    const per = Math.floor((2 * Math.PI * r) / 2.6);
    for (let i = 0; i < per; i++) {
      const a = (i / per) * Math.PI * 2;
      const avd = Math.abs(((a / (Math.PI * 2)) * AVENUES + 0.5) % 1 - 0.5) * (Math.PI * 2 / AVENUES) * r;
      if (avd < 16 || hash(r, i) > (lite ? 0.45 : 0.78)) continue;
      if (Math.abs(Math.round(r / 14) * 14 - r) < 1) continue;                  // driving aisles
      cars.push([Math.cos(a) * r, Math.sin(a) * r, a, CAR_COLS[Math.floor(hash(i, r) * CAR_COLS.length)]]);
    }
  }
  const carGeo = new THREE.BoxGeometry(4.4, 1.45, 1.85); carGeo.translate(0, 0.72 - 0.6, 0);
  const carMesh = new THREE.InstancedMesh(carGeo, cm, cars.length);
  const col = new THREE.Color();
  cars.forEach(([x, z, a, c], i) => {
    Q.setFromAxisAngle(UP, -a);
    M.compose(new THREE.Vector3(x, 0, z), Q, new THREE.Vector3(1, 1, 1));
    carMesh.setMatrixAt(i, M); carMesh.setColorAt(i, col.setRGB(...c));
  });
  carMesh.frustumCulled = false;
  group.add(carMesh);

  // streetlights along the ring roads and avenues
  const sl = [];
  for (const R of RINGS) { const per = Math.floor((2 * Math.PI * R) / 34); for (let i = 0; i < per; i++) { const a = (i / per) * Math.PI * 2; for (const o of [-10, 10]) sl.push(Math.cos(a) * (R + o), 9, Math.sin(a) * (R + o)); } }
  for (let k = 0; k < AVENUES; k++) { const a = (k / AVENUES) * Math.PI * 2; for (let r = 160; r < 2300; r += 34) { const nx = -Math.sin(a), nz = Math.cos(a); for (const o of [-12, 12]) sl.push(Math.cos(a) * r + nx * o, 9, Math.sin(a) * r + nz * o); } }
  const slGeo = new THREE.BufferGeometry();
  slGeo.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
  slGeo.setAttribute('aCol', new THREE.Float32BufferAttribute(new Array(sl.length).fill(0).map((_, i) => [1.0, 0.55, 0.18][i % 3]), 3));
  slGeo.setAttribute('aMove', new THREE.Float32BufferAttribute(new Array((sl.length / 3) * 4).fill(0), 4));
  const slMat = lightsMat(false); mats.push(slMat);
  const slPts = new THREE.Points(slGeo, slMat); slPts.frustumCulled = false;
  group.add(slPts);

  // traffic on the ring roads: white headlights one way, red tail lights the other
  const N = lite ? 260 : 700, tp = [], tc = [], tm = [];
  for (let i = 0; i < N; i++) {
    const R = RINGS[i % RINGS.length], dir = hash(i, 1) < 0.5 ? 1 : -1;
    const lane = dir * (3 + hash(i, 2) * 4);
    tp.push(0, 0, 0);
    tc.push(...(dir > 0 ? [1.0, 0.95, 0.85] : [1.2, 0.12, 0.06]));
    tm.push(R, hash(i, 3) * Math.PI * 2, dir * (11 + hash(i, 4) * 8) / R, lane);
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  tGeo.setAttribute('aCol', new THREE.Float32BufferAttribute(tc, 3));
  tGeo.setAttribute('aMove', new THREE.Float32BufferAttribute(tm, 4));
  const tMat = lightsMat(true); mats.push(tMat);
  const tPts = new THREE.Points(tGeo, tMat); tPts.frustumCulled = false;
  group.add(tPts);

  return {
    group,
    update(t, camera, pxScale) {
      sky.position.copy(camera.position);
      for (const m of mats) if (m.uniforms.uTime) m.uniforms.uTime.value = t;
      slMat.uniforms.uScale.value = tMat.uniforms.uScale.value = pxScale;
    },
  };
}
