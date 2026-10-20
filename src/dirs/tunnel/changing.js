// The players' changing room: where the walk begins. It sits behind the tunnel's end wall; thirty
// lockers (the 2026–27 first team, squad.js) line three walls, each with a stylised home shirt —
// the 26/27 shirt's own silhouette, turned round to show the name and number — a lit name plate
// and a bench. You leave through the door into the back of the tunnel.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TN, DOORS } from './world.js';
import { roomMat, MAXL } from './museum.js';
import { cutOut, loadImg } from './store.js';
import { SQUAD } from './squad.js';
import { nextMatch } from '../../data.js';
import { muralTex, QUOTES } from './posters.js';

export const CHANGING = { X0: -9, X1: 9, Z0: TN.ZB, Z1: TN.ZB + 16, H: 4.2 };
const LW = 1.34; // locker width

/* ── the shirt back: the home shirt's silhouette filled with its stripes, plus name and number ── */
function shirtCanvas(mask, p) {
  const W = 360, H = Math.round(360 * (mask.height / mask.width));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // stripes, centred on the spine like the 26/27 home shirt
  const sw = W / 9;
  for (let i = -1; i < 10; i++) {
    x.fillStyle = i % 2 === 0 ? '#f6d400' : '#0d0d0d';
    x.fillRect(W / 2 - sw / 2 + (i - 4) * sw, 0, sw + 1, H);
  }
  x.fillStyle = '#f6d400'; // yellow sleeves
  x.fillRect(0, 0, W * 0.2, H * 0.45); x.fillRect(W * 0.8, 0, W * 0.2, H * 0.45);
  // soft folds
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.25, 'rgba(0,0,0,0)'); g.addColorStop(0.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // name and number, white with a black keyline
  x.textAlign = 'center';
  x.lineJoin = 'round';
  let size = 34;
  x.font = `400 ${size}px Anton`;
  while (x.measureText(p.shirt).width > W * 0.5 && size > 18) { size -= 1; x.font = `400 ${size}px Anton`; }
  x.lineWidth = 6; x.strokeStyle = '#0a0a0a'; x.strokeText(p.shirt, W / 2, H * 0.27);
  x.fillStyle = '#ffffff'; x.fillText(p.shirt, W / 2, H * 0.27);
  x.font = '400 150px Anton';
  x.lineWidth = 12; x.strokeText(String(p.no), W / 2, H * 0.62);
  x.fillText(String(p.no), W / 2, H * 0.62);
  // clip to the shirt (mirrored: we're looking at the back)
  x.globalCompositeOperation = 'destination-in';
  x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage(mask, 0, 0, W, H); x.restore();
  return c;
}


/* ── lockers styled on the club's real dressing room (Ahmed's reference photo): a yellow header box with
   ITTIHAD over each one, a dark printed back panel — the player's name large, a yellow stripe, the
   number — a row of hooks, a wooden bench, and a crest panel at the end of each side run ── */
function headerTex() {
  const W = 512, H = 160, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f2e64a'); g.addColorStop(1, '#d8cc2c');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, H - 6, W, 6);
  x.fillStyle = '#141414'; x.textAlign = 'center';
  x.font = '400 92px Anton';
  x.fillText('I T T I H A D', W / 2, 116);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function backPanel(p) {
  const W = 512, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#36373b'); g.addColorStop(1, '#232427');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // the name, huge and cropped, behind where the shirt hangs
  const last = p.shirt.toUpperCase();
  x.fillStyle = 'rgba(214,215,218,0.32)';
  let size = 300; x.font = `400 ${size}px Anton`;
  while (x.measureText(last).width > W * 1.25 && size > 120) { size -= 10; x.font = `400 ${size}px Anton`; }
  x.textAlign = 'left'; x.fillText(last, 18, 300);
  // yellow stripe down the right edge, ITTIHAD running down it
  x.fillStyle = '#e9dc2f'; x.fillRect(W - 70, 0, 34, H);
  x.save(); x.translate(W - 46, 40); x.rotate(Math.PI / 2); x.fillStyle = '#141414'; x.font = '400 30px Anton'; x.fillText('ITTIHAD · ITTIHAD · ITTIHAD · ITTIHAD', 0, 0); x.restore();
  // the number, big, bottom right; name small above it
  x.textAlign = 'right';
  x.fillStyle = '#e9dc2f'; x.font = '400 230px Anton';
  x.lineWidth = 8; x.strokeStyle = '#111'; x.strokeText(String(p.no), W - 92, H - 70); x.fillText(String(p.no), W - 92, H - 70);
  x.fillStyle = '#e8e6df'; x.font = '400 46px Anton'; x.fillText(p.name.toUpperCase(), W - 92, H - 300);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function crestPanel(crest) {
  const W = 512, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#36373b'); g.addColorStop(1, '#232427');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // ITTIHAD stacked down the panel, big and grey
  x.fillStyle = 'rgba(214,215,218,0.3)'; x.textAlign = 'center'; x.font = '400 128px Anton';
  'ITTIHAD'.split('').forEach((ch, i) => x.fillText(ch, W / 2, 140 + i * 118));
  if (crest) { const cw = 300, ch = cw * (crest.height / crest.width); x.drawImage(crest, (W - cw) / 2, 250, cw, ch); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export async function buildChanging({ env, lite = false }) {
  // ?locker=real (Ahmed: "real-room realism"): one clean design with physically based materials, real area
  // lights over each run of lockers, a reflective floor — graphite cabinets, brushed steel, oak, a little yellow
  // Ahmed's pick (2026-10-14): the EA FC Clubhouse bays, rendered with the real lighting (PBR + area lights)
  const STYLE = new URLSearchParams(location.search).get('locker') || 'clubhouse';
  const REAL = STYLE === 'real', PBRL = REAL || STYLE === 'clubhouse';
  const pbr = (color, { map = null, rough = 0.6, metal = 0, envI = 0.6 } = {}) => new THREE.MeshStandardMaterial({ color, map, roughness: rough, metalness: metal, envMap: env, envMapIntensity: envI });
  const { X0, X1, Z0, Z1, H } = CHANGING;
  const group = new THREE.Group();
  const uL = { value: Array.from({ length: MAXL }, () => new THREE.Vector4(0, 0, 0, 0)) };
  const mats = [];
  const plane = (w, h, m) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);

  /* The room after Ahmed's reference (a top club's dressing room) in Ittihad colours: white walls and ceiling,
     a polished black floor, a U of yellow-cushioned benches over black boot cubbies, yellow dividers, hooks,
     an upper row of yellow cabinets with framed player prints, crests on the wall, recessed downlights, a lit
     crest oval in the ceiling, and a yellow table in the middle. Even, bright light — no spot cones. */
  const bright = (color, { map = null, gloss = 0 } = {}) => new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(color) }, uMap: { value: map }, uUse: { value: map ? 1 : 0 }, uGloss: { value: gloss } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform vec3 uCol; uniform sampler2D uMap; uniform float uUse, uGloss; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main(){
        vec4 t = uUse > 0.5 ? texture2D(uMap, vUv) : vec4(1.0);
        if (t.a < 0.4) discard;
        vec3 base = t.rgb * uCol;
        vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
        if (dot(n, v) < 0.0) n = -n;
        float l = 0.56 + 0.26 * max(n.y, 0.0) + 0.12 * abs(n.x) + 0.08 * abs(n.z);
        l *= 0.72 + 0.28 * smoothstep(0.0, 1.4, vW.y);          // shadowed low down, as under the benches
        l *= 1.0 - 0.12 * smoothstep(3.4, 4.2, vW.y) * (1.0 - max(-n.y, 0.0));   // and up in the corners by the ceiling
        vec3 col = base * l;
        if (uGloss > 0.0) col += uGloss * 0.22 * pow(max(reflect(-v, n).y, 0.0), 24.0);   // the floor catching the downlights
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  /* EA FC Clubhouse style (Ahmed's references, 2026-10-13), in Ittihad colours: dark concrete room, a
     honeycomb of ceiling light panels, angled dark-grey bays each under a slanted hood carrying the crest,
     three hooks with the shirt on its hanger, yellow padded seat and backrest cushions (crest on the
     backrest), a cubby underneath with a kit bag, and shelf units of bottles, towels and bags. */
  const YEL = 0xf2c418, BLK = 0x151515;
  // black, not grey (Ahmed, 2026-10-13): walls, ceiling, floor and the bays
  // bays black, the room around them lighter (Ahmed: black bays, then "too much black")
  const ceilBM = bright(0xb9b9b6);
  const yelM = bright(YEL), blackM = bright(BLK), metalM = bright(0x9a9ca0);
  const RW = PBRL && { wall: REAL ? pbr(0xcfcac1, { rough: 0.92, envI: 0.25 }) : pbr(0x34363b, { rough: 0.85, envI: 0.35 }), ceil: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.78, 0.77, 0.75) }), floor: pbr(0x1d1e21, { rough: 0.16, envI: 1.3 }) };
  // locker finishes (Ahmed: solid colour doesn't look good) — ?finish=wood | carbon | matte | oak
  const FINISH = new URLSearchParams(location.search).get('finish') || 'shaded';
  // locker styles from Ahmed's references (?locker=clubhouse | leipzig | bayern | ittihad)
  const LOCKER = new URLSearchParams(location.search).get('locker') || 'clubhouse';
  const tx = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };
  const rnd = (() => { let q = 7; return () => ((q = (q * 16807) % 2147483647) / 2147483647); })();
  const grain = (base, dark, light) => tx(512, 1024, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const xx = rnd() * w, a = 0.08 + rnd() * 0.18; x.strokeStyle = rnd() < 0.5 ? dark : light; x.globalAlpha = a; x.lineWidth = 1 + rnd() * 4; x.beginPath(); x.moveTo(xx, 0); x.bezierCurveTo(xx + (rnd() - 0.5) * 40, h * 0.33, xx + (rnd() - 0.5) * 40, h * 0.66, xx + (rnd() - 0.5) * 30, h); x.stroke(); }
    x.globalAlpha = 1;
  });
  const leather = (base, stitch, perforated = false) => tx(512, 256, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
    if (perforated) { x.fillStyle = 'rgba(0,0,0,0.35)'; for (let yy = 24; yy < h - 20; yy += 16) for (let xx = 24 + (yy % 32 ? 8 : 0); xx < w - 20; xx += 16) { x.beginPath(); x.arc(xx, yy, 2.6, 0, Math.PI * 2); x.fill(); } }
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = stitch; x.lineWidth = 3; x.setLineDash([10, 8]); x.strokeRect(14, 14, w - 28, h - 28);
  });
  const carbon = tx(256, 256, (x, w, h) => {
    const s2 = 16; for (let j = 0; j < h / s2; j++) for (let i = 0; i < w / s2; i++) { const g = x.createLinearGradient(i * s2, j * s2, (i + ((i + j) % 2 ? 1 : 0)) * s2, (j + ((i + j) % 2 ? 0 : 1)) * s2); g.addColorStop(0, '#1a1b1e'); g.addColorStop(0.5, '#34363b'); g.addColorStop(1, '#16171a'); x.fillStyle = g; x.fillRect(i * s2, j * s2, s2, s2); }
  }, [3, 3]);
  const matte = (base) => tx(512, 512, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) { const v = rnd(); x.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.15 * rnd()})` : `rgba(255,255,255,${0.05 * rnd()})`; x.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(0.12, 'rgba(0,0,0,0)'); g.addColorStop(0.88, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.22)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  // soft studio shading: lighter at the top, a gentle falloff to the sides and the floor
  const shadedTex = (base) => tx(256, 512, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    let g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0.18)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(0.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  const F = {
    wood: { bay: grain('#3a2416', '#1c0f07', '#6a442a'), back: grain('#2c1a10', '#140a05', '#523420'), hood: grain('#2a190e', '#120904', '#4e3220'), cushion: leather('#e8b812', 'rgba(60,40,0,0.55)') },
    oak: { bay: grain('#b88d5a', '#7a5630', '#e0bf8e'), back: grain('#9c7448', '#694a28', '#c9a273'), hood: grain('#a67c4e', '#6e4e2a', '#d2ad7c'), cushion: leather('#f2c418', 'rgba(20,20,20,0.6)') },
    carbon: { bay: carbon, back: carbon, hood: carbon, cushion: leather('#f2c418', 'rgba(20,20,20,0.5)', true) },
    matte: { bay: matte('#202023'), back: matte('#1a1a1d'), hood: matte('#18181b'), cushion: leather('#eebf16', 'rgba(20,20,20,0.6)') },
    shaded: { bay: shadedTex('#5f6168'), back: shadedTex('#3a3b40'), hood: shadedTex('#4c4e55'), cushion: leather('#f2c418', 'rgba(20,20,20,0.45)') },
  }[FINISH] || null;
  const fm = (t, fallback) => (F ? bright(0xffffff, { map: t }) : bright(fallback));
  const CH = STYLE === 'clubhouse';
  const bayM = CH ? pbr(0x4d4f55, { rough: 0.55, envI: 0.55 }) : fm(F?.bay, 0x232326);
  const bayBackM = CH ? pbr(0x34363b, { rough: 0.7, envI: 0.4 }) : fm(F?.back, 0x232327);
  const hoodM = CH ? pbr(0x3e4046, { rough: 0.6, envI: 0.5 }) : fm(F?.hood, 0x1b1b1e);
  const bagM = CH ? pbr(0x151517, { rough: 0.7 }) : bright(0x0e0e10);
  const cushionM = CH ? pbr(0xffffff, { map: leather('#f2c418', 'rgba(20,20,20,0.45)'), rough: 0.5, envI: 0.5 }) : F ? bright(0xffffff, { map: F.cushion }) : null;

  /* shell */
  const W = X1 - X0, D = Z1 - Z0, cx = 0, cz = (Z0 + Z1) / 2;
  // the tunnel's floor (Ahmed): dark epoxy with grit, glossy enough to catch the room's lights, and the same
  // dull yellow guide line painted a little in front of the benches
  const epoxy = (() => {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 2048; const x = c.getContext('2d');
    x.fillStyle = '#26272a'; x.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 70000; i++) { const v = 25 + Math.random() * 60; x.fillStyle = `rgba(${v},${v},${v + 2},${0.35 + Math.random() * 0.4})`; x.fillRect(Math.random() * 2048, Math.random() * 2048, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5); }
    for (let i = 0; i < 40; i++) { const g = x.createRadialGradient(Math.random() * 2048, Math.random() * 2048, 0, 0, 0, 0); x.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; x.beginPath(); x.arc(Math.random() * 2048, Math.random() * 2048, 80 + Math.random() * 220, 0, Math.PI * 2); x.fill(); }   // cloudy patches
    // guide line 1.05 m in front of the back and side benches (the plane maps x: X0..X1, y: Z1..Z0)
    // canvas top = the door side
    const px = (xx) => ((xx - X0) / W) * 2048, pz = (zz) => ((zz - Z0) / D) * 2048, lw = (0.06 / W) * 2048;
    x.fillStyle = 'rgba(230,180,30,0.95)';
    x.fillRect(px(X0 + 1.55), pz(Z1 - 1.55) - lw, px(X1 - 1.55) - px(X0 + 1.55), lw);
    x.fillRect(px(X0 + 1.55), pz(Z0 + 1.6), lw, pz(Z1 - 1.55) - pz(Z0 + 1.6));
    x.fillRect(px(X1 - 1.55) - lw, pz(Z0 + 1.6), lw, pz(Z1 - 1.55) - pz(Z0 + 1.6));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  // not flat black (Ahmed): visible grit, a glossy sheen where the lights catch it, the guide line showing
  const floorEpoxy = new THREE.MeshPhysicalMaterial({ map: epoxy, color: 0xffffff, roughness: 0.3, metalness: 0, specularIntensity: 0.35 });   // the texture is the colour (a dark tint on top crushed it to black)   // no env map: it painted blurry blobs   // as dark and glossy as the tunnel (measured against it)
  const floor = plane(W, D, floorEpoxy); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.002, cz);
  const ceil = plane(W, D, RW ? RW.ceil : ceilBM); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz);
  const tunWall = (w, h) => new THREE.MeshBasicMaterial({ map: muralTex(QUOTES[0], w / h, null, 0, true, true, true), color: new THREE.Color(0.85, 0.85, 0.85) });   // the tunnel's yellow print
  const back = plane(W, H, tunWall(W, H)); back.rotation.y = Math.PI; back.position.set(cx, H / 2, Z1);
  const left = plane(D, H, tunWall(D, H)); left.rotation.y = Math.PI / 2; left.position.set(X0, H / 2, cz);
  const right = plane(D, H, tunWall(D, H)); right.rotation.y = -Math.PI / 2; right.position.set(X1, H / 2, cz);
  group.add(floor, ceil, back, left, right);
  const [d0, d1] = DOORS.back;
  for (const [x0, x1, y0] of [[X0, d0, 0], [d1, X1, 0], [d0, d1, DOORS.h]]) {
    const hgt = H - y0;
    const seg = plane(x1 - x0, hgt, tunWall(x1 - x0, hgt));
    seg.position.set((x0 + x1) / 2, y0 + hgt / 2, Z0 + 0.12);
    group.add(seg);
  }
  for (const xx of [d0, d1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, DOORS.h, 0.16), blackM); b.position.set(xx, DOORS.h / 2, Z0 + 0.06); group.add(b); }
  const lint = new THREE.Mesh(new THREE.BoxGeometry(d1 - d0 + 0.06, 0.06, 0.16), blackM); lint.position.set(0, DOORS.h, Z0 + 0.06); group.add(lint);

  // ceiling: a honeycomb of hexagonal light panels (lit, not glowing)
  const crestImg = await loadImg('/img/crest.png');
  const hexM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.52, 0.52, 0.5) });
  const hexRimM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.08, 0.09) });
  const hexGeo = new THREE.CircleGeometry(0.62, 6), hexRim = new THREE.CircleGeometry(0.7, 6);
  if (PBRL) {
    RectAreaLightUniformsLib.init();
    const coveM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.98, 0.96, 0.92) });
    // a light line along each run of lockers, set into the ceiling, and the area light it stands for
    const runs = [[0, Z1 - 1.25, W - 2.2, 0], [X0 + 1.25, cz + 0.9, D - 3.6, Math.PI / 2], [X1 - 1.25, cz + 0.9, D - 3.6, -Math.PI / 2]];
    for (const [lx, lz, len, yaw] of runs) {
      if (REAL) { const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.14), coveM); strip.rotation.set(Math.PI / 2, 0, yaw ? Math.PI / 2 : 0); strip.position.set(lx, H - 0.01, lz); group.add(strip); }
      const L = new THREE.RectAreaLight(0xfff2dc, 7, len, 0.5); L.position.set(lx, H - 0.05, lz);
      L.lookAt(lx + (yaw ? (yaw > 0 ? -1.2 : 1.2) : 0), 0.9, lz + (yaw ? 0 : 1.2) * (yaw ? 0 : 1)); group.add(L);
    }
    // a soft fill over the middle of the room
    const fill = new THREE.RectAreaLight(0xffffff, 1.6, 6, 6); fill.position.set(0, H - 0.05, cz + 1); fill.lookAt(0, 0, cz + 1); group.add(fill);
  }
  if (!REAL) for (let r = 0, zz = Z0 + 3.2; zz < Z1 - 2.6; r++, zz += 1.25) for (let xx = -4.2 + (r % 2) * 0.72; xx <= 4.3; xx += 1.44) {
    const rim = new THREE.Mesh(hexRim, hexRimM); rim.rotation.set(Math.PI / 2, 0, Math.PI / 6); rim.position.set(xx, H - 0.012, zz); group.add(rim);
    const h = new THREE.Mesh(hexGeo, hexM); h.rotation.set(Math.PI / 2, 0, Math.PI / 6); h.position.set(xx, H - 0.02, zz); group.add(h);
  }
  let crestTex = null;
  if (crestImg) {
    crestTex = new THREE.Texture(crestImg); crestTex.colorSpace = THREE.SRGBColorSpace; crestTex.needsUpdate = true;
    // the crest on the floor in the middle, like the game's floor projection (printed, no glow)
    const fc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4 * (554 / 494)), new THREE.MeshBasicMaterial({ map: crestTex, transparent: true, opacity: 0.55, depthWrite: false }));
    fc.rotation.set(-Math.PI / 2, 0, Math.PI); fc.position.set(0, 0.006, cz + 1);   // (not added: Ahmed — no crest on the floor)
  }

  /* bays: left wall (front → back), back wall (left → right), right wall (back → front); a shelf unit at the
     end of each side run */
  const nSide = 10, nBack = 12;
  const slots = [], crestSlots = [];
  for (let i = 0; i < nSide; i++) (i === nSide - 1 ? crestSlots : slots).push([X0 + 0.32, Z0 + 2.0 + i * LW + LW / 2, Math.PI / 2]);
  for (let i = 0; i < nBack; i++) slots.push([-(nBack * LW) / 2 + i * LW + LW / 2, Z1 - 0.32, Math.PI]);
  for (let i = nSide - 1; i >= 0; i--) (i === nSide - 1 ? crestSlots : slots).push([X1 - 0.32, Z0 + 2.0 + i * LW + LW / 2, -Math.PI / 2]);

  // the divider between bays: vertical to the bench, then waisted back, then flaring forward into the hood
  const divShape = new THREE.Shape([[-0.3, 0], [0.36, 0], [0.36, 0.95], [0.06, 2.2], [0.44, 3.05], [-0.3, 3.05]].map(([zz, yy]) => new THREE.Vector2(zz, yy)));
  const divGeo = new THREE.ExtrudeGeometry(divShape, { depth: 0.08, bevelEnabled: false });
  divGeo.rotateY(-Math.PI / 2); divGeo.translate(0.04, 0, 0);
  const HOOD_A = Math.atan2(0.38, 0.85), HOOD_L = Math.hypot(0.38, 0.85);
  const hoodGeo = new THREE.BoxGeometry(LW, HOOD_L, 0.06);
  const panelGeo = new THREE.PlaneGeometry(LW - 0.04, 2.2);
  const seatGeo = new RoundedBoxGeometry(LW - 0.12, 0.11, 0.5, 3, 0.045);
  const restGeo = new RoundedBoxGeometry(LW - 0.14, 0.44, 0.1, 3, 0.045);
  const plankGeo = new THREE.BoxGeometry(LW - 0.04, 0.05, 0.62);
  const cubbyBackGeo = new THREE.PlaneGeometry(LW - 0.04, 0.42);
  const hookGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.08, 10); hookGeo.rotateX(Math.PI / 2);
  const bagGeo = new RoundedBoxGeometry(0.62, 0.26, 0.3, 3, 0.1);
  const bagBandGeo = new THREE.BoxGeometry(0.63, 0.06, 0.31);
  const crestGeo = new THREE.PlaneGeometry(0.34, 0.34 * (554 / 494));
  // the hood crest is a grey mark pressed into the panel, as in the game: a greyscale copy of the crest
  const greyCrest = crestImg && (() => { const c = document.createElement('canvas'); c.width = crestImg.width; c.height = crestImg.height; const x = c.getContext('2d'); x.filter = 'grayscale(1) contrast(1.4)'; x.drawImage(crestImg, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const crestDimM = greyCrest && new THREE.MeshBasicMaterial({ map: greyCrest, transparent: true, color: new THREE.Color(0.22, 0.22, 0.23) });
  const crestLitM = crestTex && new THREE.MeshBasicMaterial({ map: crestTex, transparent: true });                                            // full colour on the cushions
  const items = [];
  // a player's locker portrait (Ahmed: "instead of the repeated logo, every player's official photography"):
  // the club's official headshot on a dark card with a yellow claw stripe, number and name on a band below.
  // Players the club site has no photo for yet get a silhouette.
  function portraitTex(p, img) {
    const W = 512, Hh = 640, c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, 0, Hh); bg.addColorStop(0, '#34353b'); bg.addColorStop(1, '#16171a');
    x.fillStyle = bg; x.fillRect(0, 0, W, Hh);
    x.fillStyle = 'rgba(242,196,24,0.9)'; x.beginPath(); x.moveTo(W * 0.62, 0); x.lineTo(W * 0.8, 0); x.lineTo(W * 0.3, Hh); x.lineTo(W * 0.12, Hh); x.fill();
    x.fillStyle = 'rgba(242,196,24,0.25)'; x.beginPath(); x.moveTo(W * 0.86, 0); x.lineTo(W * 0.92, 0); x.lineTo(W * 0.42, Hh); x.lineTo(W * 0.36, Hh); x.fill();
    if (img) {
      // head and shoulders: the top ~62% of the cut-out, filling the card's width
      const sh = img.height * 0.62, sw = sh * (W / (Hh - 120));
      const sx = (img.width - sw) / 2;
      x.drawImage(img, sx, 0, sw, sh, 0, 0, W, Hh - 120);
    } else {
      x.fillStyle = '#4a4c52';
      x.beginPath(); x.arc(W / 2, 200, 92, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.moveTo(W * 0.14, Hh - 120); x.quadraticCurveTo(W * 0.18, 330, W / 2, 318); x.quadraticCurveTo(W * 0.82, 330, W * 0.86, Hh - 120); x.fill();
    }
    x.fillStyle = '#111214'; x.fillRect(0, Hh - 120, W, 120);
    x.fillStyle = '#f2c418'; x.fillRect(0, Hh - 120, W, 6);
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = '#f2c418'; x.font = '400 92px Anton'; x.fillText(String(p.no), 24, Hh - 22);
    const nw = x.measureText(String(p.no)).width;
    let size = 44; x.font = `400 ${size}px Anton`; const n = p.shirt.toUpperCase();
    while (x.measureText(n).width > W - nw - 64 && size > 20) { size -= 2; x.font = `400 ${size}px Anton`; }
    x.fillStyle = '#f4f1e8'; x.fillText(n, nw + 44, Hh - 40);
    x.font = '500 20px "JetBrains Mono"'; x.fillStyle = 'rgba(244,241,232,0.55)'; x.fillText(p.pos.toUpperCase(), nw + 46, Hh - 80);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const portraitGeo = new THREE.PlaneGeometry(0.62, 0.62 * (640 / 512));
  // a spotlight in every player's locker (Ahmed): a recessed lamp under the hood and the pool of light it
  // throws down the back panel, the shirt and the cushion — painted light, no glow
  const poolTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 0, 10, 128, 60, 380);
    g.addColorStop(0, 'rgba(255,246,222,0.95)'); g.addColorStop(0.35, 'rgba(255,240,210,0.5)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const seatPoolTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 40, 4, 128, 64, 130);
    g.addColorStop(0, 'rgba(255,246,222,0.7)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const poolM = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, opacity: STYLE === 'clubhouse' || STYLE === 'real' ? 0.35 : 0.55 });
  const seatPoolM = new THREE.MeshBasicMaterial({ map: seatPoolTex, transparent: true, depthWrite: false, opacity: 0.5 });
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.9) });
  const rimM = new THREE.MeshBasicMaterial({ color: 0x0a0a0b });
  const poolGeo = new THREE.PlaneGeometry(LW - 0.1, 2.1), seatPoolGeo = new THREE.PlaneGeometry(LW - 0.16, 0.46);
  const lampGeo = new THREE.CircleGeometry(0.055, 24), lampRimGeo = new THREE.CircleGeometry(0.075, 24);
  function spotlight(g) {
    const rim = new THREE.Mesh(lampRimGeo, rimM); rim.rotation.x = Math.PI / 2; rim.position.set(0, 2.195, -0.02); g.add(rim);
    const lamp = new THREE.Mesh(lampGeo, lampM); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 2.19, -0.02); g.add(lamp);
    const pool = new THREE.Mesh(poolGeo, poolM); pool.position.set(0, 2.2 - 1.05, -0.284); g.add(pool);
    const sp = new THREE.Mesh(seatPoolGeo, seatPoolM); sp.rotation.x = -Math.PI / 2; sp.position.set(0, 0.557, 0.03); g.add(sp);
  }
  // EA FC extras (Ahmed: "show me this option"): ?extras=1 adds a name plate over each locker and a top shelf
  // with the player's boots
  const EXTRAS = new URLSearchParams(location.search).get('extras') === '1';
  const plateTex = (name) => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#d9dadc'); g.addColorStop(1, '#9a9ca0'); x.fillStyle = g; x.fillRect(0, 0, 512, 96); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 92, 512, 4); if (crestImg) x.drawImage(crestImg, 14, 12, 64, 72); x.fillStyle = '#1a1a1c'; let sz = 50; x.font = `400 ${sz}px Anton`; while (x.measureText(name).width > 400 && sz > 24) { sz -= 2; x.font = `400 ${sz}px Anton`; } x.textAlign = 'center'; x.fillText(name, 290, 66); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const plateGeo = new THREE.PlaneGeometry(0.78, 0.78 * (96 / 512));
  const topShelfGeo = new THREE.BoxGeometry(LW - 0.1, 0.035, 0.26);
  const bootG = new THREE.BoxGeometry(0.1, 0.085, 0.27);
  const bootCols = [0xe0482c, 0xf2f2f2, 0x2d6bd8, 0xf2c418, 0x1d1d1d, 0x6fd25a, 0xd63a8a].map((c) => bright(c));
  /* rectangular lockers for the Leipzig, Bayern and Ittihad references */
  const RS = {
    leipzig: { frame: shadedTex('#c3c4c7'), back: shadedTex('#e2e2e0'), bench: shadedTex('#2a2a2d'), perf: true },
    bayern: { frame: tx(256, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#d8a90c'); g.addColorStop(0.35, '#f6cf2a'); g.addColorStop(0.5, '#fff1a8'); g.addColorStop(0.62, '#f2c418'); g.addColorStop(1, '#cf9f08'); x.fillStyle = g; x.fillRect(0, 0, w, h); }),
              back: shadedTex('#e7b912'), bench: grain('#c49a63', '#8a6438', '#e2c08e') },
    ittihad: { frame: shadedTex('#1b1b1d'), back: null, bench: grain('#6b4a2c', '#3c2614', '#94693f') },
  };
  const perfTex = tx(256, 512, (x, w, h) => { x.fillStyle = '#b8b9bc'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(30,30,32,0.75)'; for (let yy = 10; yy < h; yy += 14) for (let xx = 10 + (yy % 28 ? 7 : 0); xx < w; xx += 14) { x.beginPath(); x.arc(xx, yy, 3.2, 0, Math.PI * 2); x.fill(); } }, [1, 2]);
  const towelYM = bright(0xf2c418), towelWM = bright(0xf2f1ec);
  function rectBay(g, style, { portrait, player, featured }) {
    const S = RS[style];
    const frameM = bright(0xffffff, { map: S.frame });
    const sideM = S.perf ? bright(0xffffff, { map: perfTex }) : frameM;
    for (const sx of [-LW / 2, LW / 2]) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.62, 0.6), [sideM, sideM, frameM, frameM, frameM, frameM]); d.position.set(sx, 1.31, 0); g.add(d); }
    const backTex = style === 'ittihad' ? (player ? backPanel(player) : crestPanel(crestImg)) : S.back;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(LW - 0.05, 2.62), bright(0xffffff, { map: backTex })); back.position.set(0, 1.31, -0.29); g.add(back);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(LW - 0.05, 0.04, 0.55), frameM); shelf.position.set(0, 2.22, 0); g.add(shelf);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(LW, 0.05, 0.62), frameM); cap.position.set(0, 2.645, 0); g.add(cap);
    // bench and the cubby under it
    const benchM = bright(0xffffff, { map: S.bench });
    const bench = new THREE.Mesh(new RoundedBoxGeometry(LW, 0.08, 0.46, 2, 0.02), benchM); bench.position.set(0, 0.46, 0.07); g.add(bench);
    const under = new THREE.Mesh(new THREE.BoxGeometry(LW - 0.05, 0.42, 0.04), frameM); under.position.set(0, 0.21, 0.27); g.add(under);
    // top cubby: boots (Leipzig/Bayern) or a kit bag
    if (player && style !== 'ittihad') { const bm = bootCols[(player.no * 7) % bootCols.length]; for (const sx of [-0.08, 0.08]) { const b = new THREE.Mesh(bootG, bm); b.position.set(sx, 2.29, 0.02); b.rotation.y = 0.3 + sx * 2; g.add(b); } }
    // folded kit on the bench (Leipzig's matchday look)
    if (player && style === 'leipzig') { const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.26), towelYM); t.position.set(-0.3, 0.53, 0.1); g.add(t); const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.24), towelWM); t2.position.set(0.32, 0.525, 0.08); g.add(t2); }
    // header: a silver name plate (Leipzig), the player's print (Bayern), the yellow ITTIHAD box (Ittihad)
    if (style === 'leipzig' && player) { const pl = new THREE.Mesh(plateGeo, new THREE.MeshBasicMaterial({ map: plateTex(player.shirt.toUpperCase()), color: new THREE.Color(0.9, 0.9, 0.9) })); pl.scale.setScalar(0.85); pl.position.set(0, 2.86, 0.0); g.add(pl); }
    if (style === 'bayern') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(LW, 0.42, 0.4), frameM); box.position.set(0, 2.88, -0.1); g.add(box);
      if (portrait) { const pm = new THREE.Mesh(portraitGeo, new THREE.MeshBasicMaterial({ map: portrait })); pm.scale.setScalar(0.32 / 0.62); pm.position.set(0, 2.88, 0.105); g.add(pm); }
    }
    if (style === 'ittihad') { const hm = [0, 0, 0, 0, 0, 0].map(() => bright(0xb8a020)); hm[4] = new THREE.MeshBasicMaterial({ map: headerTex(), color: new THREE.Color(0.92, 0.92, 0.92) }); const h = new THREE.Mesh(new THREE.BoxGeometry(LW - 0.03, 0.4, 0.1), hm); h.position.set(0, 2.88, 0.2); g.add(h); }
    if (player) spotlight(g);
    for (let k = -1; k <= 1; k++) { const h = new THREE.Mesh(hookGeo, metalM); h.position.set(k * 0.34, 1.86 - (k === 0 ? 0 : 0.05), -0.25); g.add(h); }
    return g;
  }
  /* the real locker: a flush graphite cabinet with a brushed-steel edge, an open bay with the shirt, a
     black-glass name plate (white name, yellow number) in the closed top cabinet, and an oak bench */
  const RL = REAL && (() => {
    const slats = tx(256, 512, (x, w, h) => { x.fillStyle = '#3a3c41'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 32) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(i, 0, 2, h); x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(i + 2, 0, 1, h); } });
    const oak = grain('#a77a48', '#6e4b26', '#cfa772');
    return {
      body: pbr(0x2c2e33, { rough: 0.55, envI: 0.5 }), back: pbr(0xffffff, { map: slats, rough: 0.7, envI: 0.3 }),
      steel: pbr(0xb9bcc2, { rough: 0.32, metal: 1, envI: 1.0 }), oak: pbr(0xffffff, { map: oak, rough: 0.45, envI: 0.6 }),
      glass: pbr(0x0b0c0e, { rough: 0.08, envI: 1.2 }), accent: pbr(0xf2c418, { rough: 0.4, envI: 0.4 }),
    };
  })();
  const nameTex = (p) => tx(512, 128, (x, w, h) => { x.fillStyle = '#0b0c0e'; x.fillRect(0, 0, w, h); x.textBaseline = 'middle'; x.fillStyle = '#f2c418'; x.font = '400 84px Anton'; x.fillText(String(p.no), 26, h / 2 + 4); const nw = x.measureText(String(p.no)).width + 50; x.fillStyle = '#f4f1e8'; let sz = 52; x.font = `400 ${sz}px Anton`; while (x.measureText(p.shirt.toUpperCase()).width > w - nw - 26 && sz > 22) { sz -= 2; x.font = `400 ${sz}px Anton`; } x.fillText(p.shirt.toUpperCase(), nw, h / 2 + 4); });
  function realBay(g, player) {
    const D2 = 0.62, TOP = 2.7;
    for (const sx of [-LW / 2, LW / 2]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, TOP, D2), RL.body); side.position.set(sx, TOP / 2, 0); g.add(side);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.044, TOP, 0.012), RL.steel); edge.position.set(sx, TOP / 2, D2 / 2); g.add(edge);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(LW - 0.04, 2.15), RL.back); back.position.set(0, 1.075, -D2 / 2 + 0.01); g.add(back);
    const top = new THREE.Mesh(new THREE.BoxGeometry(LW - 0.04, TOP - 2.15, D2), RL.body); top.position.set(0, 2.15 + (TOP - 2.15) / 2, 0); g.add(top);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(LW, 0.012, 0.012), RL.steel); lip.position.set(0, 2.15, D2 / 2); g.add(lip);
    if (player) { const np = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshStandardMaterial({ map: nameTex(player), roughness: 0.1, envMap: env, envMapIntensity: 0.9, emissive: 0xffffff, emissiveMap: nameTex(player), emissiveIntensity: 0.35 })); np.position.set(0, 2.43, D2 / 2 + 0.002); g.add(np); }
    const bench = new THREE.Mesh(new RoundedBoxGeometry(LW, 0.07, 0.44, 2, 0.015), RL.oak); bench.position.set(0, 0.46, 0.08); g.add(bench);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(LW - 0.04, 0.42, 0.04), RL.body); plinth.position.set(0, 0.21, 0.26); g.add(plinth);
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, LW - 0.1, 10), RL.steel); hang.rotation.z = Math.PI / 2; hang.position.set(0, 1.92, -0.12); g.add(hang);
    if (player) spotlight(g);
    return g;
  }
  function bay(x, z, yaw, { hoodCrest = true, featured = false, bag = false, portrait = null, player = null } = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; group.add(g);
    if (REAL) return realBay(g, player);
    if (RS[LOCKER]) return rectBay(g, LOCKER, { portrait, player, featured });
    for (const sx of [-LW / 2, LW / 2]) { const d = new THREE.Mesh(divGeo, bayM); d.position.x = sx; g.add(d); }
    const panel = new THREE.Mesh(panelGeo, bayBackM); panel.position.set(0, 1.1, -0.29); g.add(panel);
    // the hood: a slanted panel over the bay, bottom-back to top-front, the crest on it
    const hood = new THREE.Mesh(hoodGeo, hoodM); hood.rotation.x = HOOD_A; hood.position.set(0, 2.2 + 0.85 / 2, 0.06 + 0.38 / 2); g.add(hood);
    if (portrait) {
      spotlight(g);
      const pm = new THREE.Mesh(portraitGeo, new THREE.MeshBasicMaterial({ map: portrait, color: new THREE.Color(0.92, 0.92, 0.92) }));
      pm.rotation.x = HOOD_A; pm.position.set(0, 2.63 - Math.sin(HOOD_A) * 0.035, 0.25 + Math.cos(HOOD_A) * 0.035); g.add(pm);
    } else if (hoodCrest && crestTex) {
      const c = new THREE.Mesh(crestGeo, featured ? crestLitM : crestDimM);
      c.rotation.x = HOOD_A; c.position.set(0, 2.62 - Math.sin(HOOD_A) * 0.04, 0.25 + Math.cos(HOOD_A) * 0.04); c.scale.setScalar(1.25); g.add(c);
    }
    // bench: plank, yellow seat cushion, yellow backrest cushion with the crest; the cubby under it
    const plank = new THREE.Mesh(plankGeo, bayM); plank.position.set(0, 0.42, 0.02); g.add(plank);
    const seat = new THREE.Mesh(seatGeo, cushionM || yelM); seat.position.set(0, 0.5, 0.03); g.add(seat);
    const rest = new THREE.Mesh(restGeo, cushionM || yelM); rest.position.set(0, 0.86, -0.22); rest.rotation.x = -0.08; g.add(rest);
    if (crestTex) { const c = new THREE.Mesh(crestGeo, crestLitM); c.scale.setScalar(0.62); c.position.set(0, 0.87, -0.166); c.rotation.x = -0.08; g.add(c); }
    const cb = new THREE.Mesh(cubbyBackGeo, blackM); cb.position.set(0, 0.22, -0.28); g.add(cb);
    if (bag) {
      const b = new THREE.Mesh(bagGeo, bagM); b.position.set(0, 0.15, 0.02); b.rotation.y = 0.12; g.add(b);   // a black kit bag with a yellow band
      const band = new THREE.Mesh(bagBandGeo, yelM); band.position.set(0, 0.17, 0.02); band.rotation.y = 0.12; g.add(band);
    }
    if (EXTRAS && player) {
      // name plate above the hood, and the boots on a top shelf over the hooks
      const pl = new THREE.Mesh(plateGeo, new THREE.MeshBasicMaterial({ map: plateTex(player.shirt.toUpperCase()), color: new THREE.Color(0.9, 0.9, 0.9) }));
      pl.position.set(0, 3.22, 0.36); g.add(pl);
      const ts = new THREE.Mesh(topShelfGeo, bayM); ts.position.set(0, 1.97, -0.1); g.add(ts);
      const bm = bootCols[(player.no * 7) % bootCols.length];
      for (const sx of [-0.07, 0.07]) { const b = new THREE.Mesh(bootG, bm); b.position.set(sx + 0.3, 2.03, -0.06); b.rotation.y = 0.35 + sx * 2; g.add(b); }
    }
    // three hooks; the shirt hangs from the middle one (matchKit)
    for (let k = -1; k <= 1; k++) { const h = new THREE.Mesh(hookGeo, metalM); h.position.set(k * 0.34, 1.86 - (k === 0 ? 0 : 0.05), -0.25); g.add(h); }
    return g;
  }
  if (REAL) {
    const acc = (len, set) => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.02), RL.accent); set(m); group.add(m); };
    acc(nBack * LW, (m) => m.position.set(0, 2.72, Z1 - 0.32 + 0.31));
    acc(nSide * LW, (m) => { m.rotation.y = Math.PI / 2; m.position.set(X0 + 0.32 + 0.31, 2.72, Z0 + 2.0 + (nSide * LW) / 2); });
    acc(nSide * LW, (m) => { m.rotation.y = Math.PI / 2; m.position.set(X1 - 0.32 - 0.31, 2.72, Z0 + 2.0 + (nSide * LW) / 2); });
  }
  // shelf units: bottles, rolled towels and kit bags on three shelves
  crestSlots.forEach(([x, z, yaw]) => {
    if (REAL) { bay(x, z, yaw, {}); return; }
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; group.add(g);
    for (const sx of [-LW / 2, LW / 2]) { const d = new THREE.Mesh(divGeo, bayM); d.position.x = sx; g.add(d); }
    const panel = new THREE.Mesh(panelGeo, bayBackM); panel.position.set(0, 1.1, -0.29); g.add(panel);
    const hood = new THREE.Mesh(hoodGeo, hoodM); hood.rotation.x = HOOD_A; hood.position.set(0, 2.2 + 0.85 / 2, 0.06 + 0.38 / 2); g.add(hood);
    const shelfGeo = new THREE.BoxGeometry(LW - 0.06, 0.04, 0.5);
    const bottle = new THREE.CylinderGeometry(0.04, 0.04, 0.24, 14), cap = new THREE.CylinderGeometry(0.022, 0.03, 0.05, 10);
    const roll = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 14); roll.rotateZ(Math.PI / 2);
    const white = bright(0xf2f2ee);
    [0.05, 0.75, 1.45].forEach((sy, k) => {
      const s = new THREE.Mesh(shelfGeo, bayM); s.position.set(0, sy, -0.04); g.add(s);
      if (k === 0) { const b = new THREE.Mesh(bagGeo, bagM); b.position.set(0, sy + 0.15, -0.02); g.add(b); const bd = new THREE.Mesh(bagBandGeo, yelM); bd.position.set(0, sy + 0.17, -0.02); g.add(bd); }
      if (k === 1) for (let j = 0; j < 3; j++) { const b = new THREE.Mesh(bottle, white); b.position.set(-0.35 + j * 0.2, sy + 0.14, -0.06); g.add(b); const c = new THREE.Mesh(cap, yelM); c.position.set(-0.35 + j * 0.2, sy + 0.28, -0.06); g.add(c); }
      if (k === 1) { const b = new THREE.Mesh(bottle, white); b.rotation.z = Math.PI / 2; b.position.set(0.3, sy + 0.06, 0.02); g.add(b); }
      if (k === 2) for (let j = 0; j < 3; j++) { const r = new THREE.Mesh(roll, white); r.position.set(-0.2 + (j % 2) * 0.06, sy + 0.08 + Math.floor(j / 2) * 0.11, -0.05 + (j % 2) * 0.12); g.add(r); }
    });
  });
  /* ── matchday dressing, after real home dressing rooms and EA FC's locker-room intros: each player's shirt
     hung on his peg (name and number out), boots in front of the bench, a folded towel, water here and there;
     a tactics screen and whiteboard by the door; a physio corner; club lettering above the cabinets; soft
     shadows under the cabinets and along the benches ── */
  const heroImg = await loadImg('/img/store/home-26-27.jpg');
  const mask = heroImg ? cutOut(heroImg).image : null;
  const shirtGeo = new THREE.PlaneGeometry(0.62, 0.62 * (mask ? mask.height / mask.width : 1.19), 8, 10);
  { const pos = shirtGeo.attributes.position; for (let i = 0; i < pos.count; i++) { const xx = pos.getX(i), yy = pos.getY(i); pos.setZ(i, -0.05 * (xx / 0.31) ** 2 + 0.02 * Math.cos(yy * 6)); } shirtGeo.computeVertexNormals(); }
  const hangerGeo = new THREE.BoxGeometry(0.36, 0.02, 0.02);
  const towelGeo = new THREE.BoxGeometry(0.36, 0.06, 0.24);
  const bottleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12);
  const towelM = bright(0xf7f6f2);
  function matchKit(g, p, i) {
    let shirt = null;
    if (mask) {
      const t = new THREE.CanvasTexture(shirtCanvas(mask, p)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      shirt = new THREE.Mesh(shirtGeo, bright(0xffffff, { map: t }));
      shirt.position.set(0, 1.44, -0.2); shirt.userData.z0 = -0.2;
      shirt.rotation.y = (Math.random() - 0.5) * 0.1;
      g.add(shirt);
      const hanger = new THREE.Mesh(hangerGeo, metalM); hanger.position.set(0, 1.78, -0.21); g.add(hanger);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.08, 0.012), metalM); neck.position.set(0, 1.83, -0.23); g.add(neck);
    }
    // (benches kept clear, as in the game: kit on the hook, bag in the cubby)
    return shirt;
  }

  // canvas helpers
  const cvs = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const decalM = (t) => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: new THREE.Color(0.9, 0.9, 0.9) });

  // (the central bench table was tried and removed — Ahmed, 2026-10-13)

  // the tactics wall, inside by the door (local z = Z0, facing into the room): a screen and a whiteboard
  {
    const screen = new THREE.Group(); screen.position.set(-5.2, 2.05, Z0 + 0.16); group.add(screen);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.35, 0.06), blackM); screen.add(bezel);
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(2.18, 1.23), new THREE.MeshBasicMaterial({ map: cvs(1024, 576, (x, w, h) => {
      x.fillStyle = '#0d1a10'; x.fillRect(0, 0, w, h);
      // a pitch, with a 4-3-3 team shape (shape only: no line-up is claimed)
      x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 3; x.strokeRect(330, 40, 660, 496); x.beginPath(); x.moveTo(660, 40); x.lineTo(660, 536); x.stroke(); x.beginPath(); x.arc(660, 288, 60, 0, Math.PI * 2); x.stroke(); x.strokeRect(330, 178, 100, 220); x.strokeRect(890, 178, 100, 220);
      const dots = [[370, 288], [470, 120], [460, 230], [460, 346], [470, 456], [580, 180], [560, 288], [580, 396], [720, 130], [750, 288], [720, 446]];
      for (const [dx, dy] of dots) { x.fillStyle = '#f2c418'; x.beginPath(); x.arc(dx, dy, 18, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 3; x.stroke(); }
      x.fillStyle = '#f2c418'; x.font = '400 54px Anton'; x.fillText('MATCHDAY', 34, 110);
      x.fillStyle = '#fff'; x.font = '400 40px Anton'; x.fillText(`VS ${(nextMatch()?.opp || '').toUpperCase()}`, 34, 168);
      x.font = '600 24px "JetBrains Mono"'; x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillText('TEAM SHAPE · 4-3-3', 34, 220);
      if (crestImg) x.drawImage(crestImg, 34, 420, 90, 101);
    }), color: new THREE.Color(0.95, 0.95, 0.95) }));
    tv.position.z = 0.035; screen.add(tv);
    const board = new THREE.Group(); board.position.set(5.2, 1.75, Z0 + 0.16); group.add(board);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.04), metalM); board.add(frame);
    const wb = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), new THREE.MeshBasicMaterial({ map: cvs(1024, 580, (x, w, h) => {
      x.fillStyle = '#f7f7f4'; x.fillRect(0, 0, w, h);
      // a set-piece sketch: half a pitch, X's and O's, run arrows
      x.strokeStyle = '#1d4fb8'; x.lineWidth = 4; x.strokeRect(120, 60, 780, 470); x.strokeRect(330, 60, 360, 150); x.strokeRect(430, 60, 160, 60);
      x.font = '600 46px "Comic Sans MS", "Marker Felt", cursive'; x.fillStyle = '#c42020';
      for (const [px, py] of [[380, 250], [520, 230], [640, 260], [470, 330]]) x.fillText('X', px, py);
      x.fillStyle = '#1d1d1d'; for (const [px, py] of [[420, 170], [560, 150], [610, 190]]) { x.beginPath(); x.arc(px, py, 18, 0, Math.PI * 2); x.lineWidth = 4; x.strokeStyle = '#1d1d1d'; x.stroke(); }
      x.strokeStyle = '#c42020'; x.lineWidth = 4; const arrow = (ax, ay, bx, by) => { x.beginPath(); x.moveTo(ax, ay); x.quadraticCurveTo((ax + bx) / 2 + 40, (ay + by) / 2, bx, by); x.stroke(); const a = Math.atan2(by - ay, bx - ax); x.beginPath(); x.moveTo(bx, by); x.lineTo(bx - 20 * Math.cos(a - 0.4), by - 20 * Math.sin(a - 0.4)); x.moveTo(bx, by); x.lineTo(bx - 20 * Math.cos(a + 0.4), by - 20 * Math.sin(a + 0.4)); x.stroke(); };
      arrow(385, 240, 450, 150); arrow(525, 220, 545, 120); arrow(645, 250, 620, 160);
      x.fillStyle = '#1d1d1d'; x.font = '600 40px "Comic Sans MS", "Marker Felt", cursive'; x.fillText('SET PIECES', 130, 40 + 520);
    }) }));
    wb.position.z = 0.025; board.add(wb);
  }

  // the physio corner: a treatment table with towels; match balls in a net bag and water crates
  {
    const pt = new THREE.Group(); pt.position.set(5.6, 0, Z0 + 3.4); group.add(pt);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 1.95), blackM); pad.position.y = 0.76; pt.add(pad);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.02, 1.97), yelM); stripe.position.y = 0.7; pt.add(stripe);
    for (const [lx, lz] of [[-0.3, -0.85], [0.3, -0.85], [-0.3, 0.85], [0.3, 0.85]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.05), metalM); leg.position.set(lx, 0.35, lz); pt.add(leg); }
    for (let k = 0; k < 3; k++) { const tw = new THREE.Mesh(towelGeo, towelM); tw.position.set(0, 0.85 + k * 0.06, 0.62); tw.rotation.y = (k - 1) * 0.1; pt.add(tw); }
    const bag = new THREE.Group(); bag.position.set(-11.4, 0, -1.6); pt.add(bag);
    const ballM = bright(0xf6f6f2);
    for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), ballM); b.position.set((k % 3 - 1) * 0.2, 0.11 + Math.floor(k / 3) * 0.17, ((k % 2) - 0.5) * 0.16); bag.add(b); }
    for (let k = 0; k < 2; k++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.3), yelM); crate.position.set(0.7, 0.15 + k * 0.3, 0); bag.add(crate);
      for (let j = 0; j < 4; j++) { const bt = new THREE.Mesh(bottleGeo, blackM); bt.position.set(0.58 + (j % 2) * 0.24, 0.37 + k * 0.3, (Math.floor(j / 2) - 0.5) * 0.14); bag.add(bt); }
    }
  }

  // club lettering above the cabinets, and soft shadows
  // the walls above the bays and the door wall carry the tunnel's quote murals (Ahmed: posters in here too)
  const muralWall = (q, w, h, k, set) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: muralTex(QUOTES[q % QUOTES.length], w / h, crestImg, k, false, true), color: new THREE.Color(0.85, 0.85, 0.85) })); set(m); group.add(m); };
  const BAND_Y0 = EXTRAS ? 3.38 : 3.1, BAND_H = H - BAND_Y0 - 0.01;
  // quotes round the top of the room (Ahmed): dressing-room lines in the club's voice, not quotes from anyone,
  // black on the yellow wall like the tunnel, none repeated from the tunnel
  const ROOM_Q = [
    { en: ['EARN THE SHIRT.'] }, { en: ['THIS IS OUR HOUSE.'] }, { en: ['TOGETHER. ALWAYS.'] },
    { en: ['LEAVE IT ALL OUT THERE.'] }, { en: ['PRIDE OF JEDDAH.'] },
  ];
  if (PBRL) {
    const quoteBand = (q, w, k, set) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, BAND_H), new THREE.MeshBasicMaterial({ map: muralTex(q, w / BAND_H, null, k, false, true, true), color: new THREE.Color(0.85, 0.85, 0.85) })); set(m); group.add(m); };
    quoteBand(ROOM_Q[0], W - 0.02, 0, (m) => { m.rotation.y = Math.PI; m.position.set(0, BAND_Y0 + BAND_H / 2, Z1 - 0.012); });
    quoteBand(ROOM_Q[1], D - 0.02, 1, (m) => { m.rotation.y = Math.PI / 2; m.position.set(X0 + 0.012, BAND_Y0 + BAND_H / 2, cz); });
    quoteBand(ROOM_Q[2], D - 0.02, 2, (m) => { m.rotation.y = -Math.PI / 2; m.position.set(X1 - 0.012, BAND_Y0 + BAND_H / 2, cz); });
    // over the door wall, either side of the doorway
    const [dd0, dd1] = DOORS.back, hw2 = dd0 - X0 - 0.02;
    quoteBand(ROOM_Q[3], hw2, 3, (m) => { m.position.set(X0 + 0.01 + hw2 / 2, BAND_Y0 + BAND_H / 2, Z0 + 0.14); });
    quoteBand(ROOM_Q[4], hw2, 4, (m) => { m.position.set(X1 - 0.01 - hw2 / 2, BAND_Y0 + BAND_H / 2, Z0 + 0.14); });
  }
  if (!PBRL) muralWall(0, W - 0.02, BAND_H, 0, (m) => { m.rotation.y = Math.PI; m.position.set(0, BAND_Y0 + BAND_H / 2, Z1 - 0.015); });
  if (!PBRL) muralWall(2, D - 0.02, BAND_H, 1, (m) => { m.rotation.y = Math.PI / 2; m.position.set(X0 + 0.015, BAND_Y0 + BAND_H / 2, cz); });
  if (!PBRL) muralWall(3, D - 0.02, BAND_H, 2, (m) => { m.rotation.y = -Math.PI / 2; m.position.set(X1 - 0.015, BAND_Y0 + BAND_H / 2, cz); });
  // the door wall, either side of the doorway and above it
  { const [d0, d1] = DOORS.back, hw = d0 - X0 - 0.02;
    // plain prints here (crest, stripes): the tactics screen and whiteboard hang on this wall
    const plainWall = (w, h, k, set) => { if (PBRL) return; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: muralTex(QUOTES[0], w / h, crestImg, k, true, true), color: new THREE.Color(0.85, 0.85, 0.85) })); set(m); group.add(m); };
    plainWall(hw, H - 0.02, 3, (m) => { m.position.set(X0 + 0.01 + hw / 2, H / 2, Z0 + 0.135); });
    plainWall(hw, H - 0.02, 4, (m) => { m.position.set(X1 - 0.01 - hw / 2, H / 2, Z0 + 0.135); });
    plainWall(d1 - d0 + 0.04, H - DOORS.h - 0.04, 5, (m) => { m.position.set(0, DOORS.h + (H - DOORS.h) / 2 + 0.01, Z0 + 0.135); });
  }
  const shade = cvs(4, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const shadowM = new THREE.MeshBasicMaterial({ map: shade, transparent: true, depthWrite: false });
  const wallShadow = (len, set) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.55), shadowM); set(m); group.add(m); };
  // under the cabinets (back wall, both sides)
  wallShadow(16.2, (m) => { m.rotation.y = Math.PI; m.position.set(0, 2.06, Z1 - 0.015); });
  wallShadow(13.6, (m) => { m.rotation.y = Math.PI / 2; m.position.set(X0 + 0.015, 2.06, Z0 + 2.0 + 13.4 / 2); });
  wallShadow(13.6, (m) => { m.rotation.y = -Math.PI / 2; m.position.set(X1 - 0.015, 2.06, Z0 + 2.0 + 13.4 / 2); });
  // along the bench fronts, on the floor
  const floorShadow = (len, set) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.7), shadowM); m.rotation.x = -Math.PI / 2; set(m); group.add(m); };
  floorShadow(16.2, (m) => { m.rotation.z = Math.PI; m.position.set(0, 0.006, Z1 - 0.95); });
  floorShadow(13.6, (m) => { m.rotation.z = -Math.PI / 2; m.position.set(X0 + 0.95, 0.006, Z0 + 2.0 + 13.4 / 2); });
  floorShadow(13.6, (m) => { m.rotation.z = Math.PI / 2; m.position.set(X1 - 0.95, 0.006, Z0 + 2.0 + 13.4 / 2); });

  const photos = await Promise.all(SQUAD.map((p) => (p.photo ? loadImg(p.photo) : null)));
  slots.slice(SQUAD.length).forEach((s) => bay(...s, { featured: true }));   // a spare bay: the club crest
  SQUAD.forEach((p, i) => {
    const s = slots[i];
    if (!s) return;
    const [x, z] = s;
    const g = bay(...s, { portrait: portraitTex(p, photos[i]), bag: i % 3 !== 1, player: p });
    const shirt = matchKit(g, p, i);
    items.push({ data: { ...p, kind: 'player' }, focusPos: new THREE.Vector3(x, 1.9, z), shirt, ph: Math.random() * 6.28 });
  });

  /* per-frame */
  // the room is built in its own frame and then turned into place on the tunnel's left wall (scene.js):
  // everything here works in that frame
  const fwd = new THREE.Vector3(), to = new THREE.Vector3(), lc = new THREE.Vector3(), inv = new THREE.Matrix4();
  const local = (p) => lc.copy(p).applyMatrix4(inv);
  function place(matrixWorld) { inv.copy(matrixWorld).invert(); for (const m of mats) m.uniforms.uXf.value.copy(inv); }
  let focus = -1;
  function update(t, camera, { on = 1 } = {}) {
    for (const m of mats) { m.uniforms.uCam.value.copy(camera.position); m.uniforms.uOn.value = on; }
    const c0 = local(camera.position);
    group.visible = c0.z > Z0 - 7.5 && Math.abs(c0.x) < 12 && c0.y < 8;
    if (!group.visible) return focus;
    const inside = c0.z > Z0 + 0.4 && c0.y < H;
    camera.getWorldDirection(fwd);
    let best = -1, bd = 0.975;
    if (inside) items.forEach((c, i) => {
      to.copy(c.focusPos).applyMatrix4(group.matrixWorld).sub(camera.position);
      if (to.length() > 10) return;
      const s = fwd.dot(to.normalize());
      if (s > bd) { bd = s; best = i; }
    });
    focus = best;
    // shirts sway a touch; the one you're looking at turns toward you
    if (!lite) items.forEach((c, i) => { if (!c.shirt) return; c.shirt.rotation.z = Math.sin(t * 0.8 + c.ph) * 0.012; c.shirt.position.z = (c.shirt.userData.z0 ?? -0.12) + (i === focus ? 0.05 : 0); });
    return focus;
  }

  const inside = (c) => { const p = local(c.position); return p.z > Z0 + 0.4 && p.z < Z1 && p.x > X0 && p.x < X1 && p.y < H; };
  return { group, items, update, place, get focus() { return focus; }, inside };
}
