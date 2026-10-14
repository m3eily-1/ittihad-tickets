// Hero B — tiger stripes. A shader field of tiger stripes lit by a cursor "torch", the crest's
// "1" as an extruded 3D monolith wearing the crest, and claw marks when you drag.
import * as THREE from 'three';
import gsap from 'gsap';
import { $, $$, fine } from '../ui.js';

// the crest's outer "1" silhouette, in crest.png pixel space (494×554)
const ONE = [[145, 12], [425, 12], [425, 392], [470, 392], [470, 520], [24, 520], [24, 392], [80, 392], [80, 250], [24, 250], [24, 150]];

const FRAG = /* glsl */`
precision highp float;
uniform float uT; uniform vec2 uRes; uniform vec2 uMouse; uniform float uLight;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= .5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * asp, uv.y), m = vec2(uMouse.x * asp, uMouse.y);
  float d = distance(p, m);
  p += normalize(p - m + 1e-4) * 0.05 * exp(-d * 7.);                 // stripes bend away from the torch
  float warp = fbm(vec2(p.x * 1.3, p.y * 2.2 + uT * 0.04)) * 4.6;
  float band = sin(p.x * 19. + warp + sin(p.y * 3. + uT * 0.2) * 0.6) * .5 + .5;
  float th = .52 + .32 * fbm(p * 2.6 + 9.);                             // stripes taper like fur
  float stripe = smoothstep(th, th + .045, band);
  float torch = smoothstep(.62, 0., d);
  float light = uLight * (.09 + .95 * torch * torch);
  vec3 fur = mix(vec3(.996, .949, .004), vec3(1., .78, .05), fbm(p * 5.) * .6);
  vec3 col = mix(fur * light, vec3(.012), stripe);
  col *= 1. - .55 * smoothstep(.3, 1.2, length((uv - .5) * vec2(1.2, 1.)));   // vignette
  col *= mix(.55, 1., smoothstep(0., .6, uv.x + uv.y * .4));               // keep the copy corner dark
  gl_FragColor = vec4(col, 1.);
}`;

export function createStripes(root) {
  const canvas = $('.js-stripes-gl', root);
  const claw = $('.js-stripes-claw', root);
  const barsEl = $('.hvs__bars', root);
  barsEl.innerHTML = '<i></i>'.repeat(innerWidth < 720 ? 5 : 9);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // keep the crest yellow true

  // background field
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uni = { uT: { value: 0 }, uRes: { value: new THREE.Vector2() }, uMouse: { value: new THREE.Vector2(0.7, 0.55) }, uLight: { value: 0 } };
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: uni, fragmentShader: FRAG, vertexShader: 'void main(){gl_Position=vec4(position.xy,0.,1.);}', depthWrite: false })));

  // the "1"
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 0, 16);
  const shape = new THREE.Shape(ONE.map(([x, y]) => new THREE.Vector2(x, 554 - y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 70, bevelEnabled: true, bevelThickness: 6, bevelSize: 5, bevelSegments: 3, curveSegments: 1 });
  geo.translate(-247, -277, -35);
  geo.scale(0.01, 0.01, 0.01);

  // face texture: the crest painted over a yellow card so the silhouette has no holes
  const tc = document.createElement('canvas');
  tc.width = 988; tc.height = 1108;
  const tctx = tc.getContext('2d');
  tctx.fillStyle = '#fef201';
  tctx.fillRect(0, 0, tc.width, tc.height);
  const faceTex = new THREE.CanvasTexture(tc);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;
  // extrude caps carry UVs in shape units (pixels), so scale them into 0..1
  faceTex.repeat.set(1 / 494, 1 / 554);
  const img = new Image();
  img.onload = () => { tctx.drawImage(img, 0, 0, tc.width, tc.height); faceTex.needsUpdate = true; };
  img.src = '/img/crest.png';

  const face = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.42, metalness: 0.05 });
  const side = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.3, metalness: 0.6 });
  const one = new THREE.Mesh(geo, [face, side]);
  const pivot = new THREE.Group();
  pivot.add(one);
  scene.add(pivot);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(-4, 5, 8); scene.add(key);
  const rim = new THREE.PointLight(0xfef201, 60, 30); rim.position.set(5, -2, -3); scene.add(rim);
  const torch = new THREE.PointLight(0xffe680, 40, 20); torch.position.set(0, 0, 5); scene.add(torch);

  // layout: monolith right of the copy on desktop, centred behind it on phones
  const layout = () => {
    const w = root.clientWidth, hgt = root.clientHeight;
    renderer.setSize(w, hgt, false);
    claw.width = w * Math.min(devicePixelRatio, 2); claw.height = hgt * Math.min(devicePixelRatio, 2);
    cam.aspect = w / hgt; cam.updateProjectionMatrix();
    uni.uRes.value.set(canvas.width, canvas.height);
    const narrow = w < 900;
    // on narrow screens it tucks into the top-right corner, clear of the headline
    pivot.position.set(narrow ? 1.9 * Math.min(cam.aspect, 1) : 2.6 * Math.min(cam.aspect, 1.9), narrow ? 2.1 : 0.1, 0);
    pivot.scale.setScalar(narrow ? 0.5 : 1);
  };
  layout();
  addEventListener('resize', layout);

  // pointer
  const target = { x: 0.7, y: 0.55 }, mouse = { x: 0.7, y: 0.55 };
  const onMove = (e) => {
    const r = root.getBoundingClientRect();
    target.x = (e.clientX - r.left) / r.width; target.y = 1 - (e.clientY - r.top) / r.height;
    if (drag) addPoint(e.clientX - r.left, e.clientY - r.top);
  };
  addEventListener('pointermove', onMove);

  // claw marks
  const cctx = claw.getContext('2d');
  const strokes = [];
  let drag = null;
  const addPoint = (x, y) => { const last = drag.pts[drag.pts.length - 1]; if (!last || Math.hypot(x - last[0], y - last[1]) > 6) drag.pts.push([x, y]); drag.t = performance.now(); };
  const onDown = (e) => {
    if (e.target.closest('a, button, .switch')) return;
    const r = root.getBoundingClientRect();
    drag = { pts: [], t: performance.now() };
    strokes.push(drag);
    addPoint(e.clientX - r.left, e.clientY - r.top);
  };
  const onUp = (e) => {
    if (!drag) return;
    // a click with no drag leaves a classic three-slash swipe
    if (drag.pts.length < 3) {
      const [x, y] = drag.pts[0];
      drag.pts = Array.from({ length: 12 }, (_, i) => { const t = i / 11; return [x - 70 + t * 140, y - 90 + t * 180 + Math.sin(t * Math.PI) * -26]; });
    }
    drag.t = performance.now();
    drag = null;
    gsap.fromTo(uni.uLight, { value: 1.6 }, { value: 1, duration: 0.8, ease: 'power2.out' });
  };
  root.addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp);

  const drawClaws = (now) => {
    const s = claw.width / root.clientWidth;
    cctx.setTransform(s, 0, 0, s, 0, 0);
    cctx.clearRect(0, 0, root.clientWidth, root.clientHeight);
    for (let k = strokes.length - 1; k >= 0; k--) {
      const st = strokes[k];
      const age = (now - st.t) / 1400;
      if (st !== drag && age > 1) { strokes.splice(k, 1); continue; }
      const a = st === drag ? 1 : 1 - age;
      const P = st.pts;
      if (P.length < 2) continue;
      for (const off of [-16, 0, 16]) {
        cctx.beginPath();
        for (let i = 0; i < P.length; i++) {
          const p0 = P[Math.max(0, i - 1)], p1 = P[Math.min(P.length - 1, i + 1)];
          let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0];
          const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
          const taper = Math.sin((i / (P.length - 1)) * Math.PI);
          const x = P[i][0] + nx * off * (0.6 + taper * 0.4), y = P[i][1] + ny * off * (0.6 + taper * 0.4);
          i ? cctx.lineTo(x, y) : cctx.moveTo(x, y);
        }
        cctx.strokeStyle = `rgba(254,242,1,${a})`;
        cctx.shadowColor = 'rgba(254,242,1,0.8)';
        cctx.shadowBlur = 18;
        cctx.lineWidth = 5 * a + 1;
        cctx.lineCap = 'round';
        cctx.lineJoin = 'round';
        cctx.stroke();
      }
    }
  };

  // render loop (paused off-screen)
  let visible = true, raf = 0;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) loop(); });
  io.observe(root);
  const clock = new THREE.Clock();
  function loop() {
    raf = 0;
    if (!visible) return;
    const t = clock.getElapsedTime();
    mouse.x += (target.x - mouse.x) * 0.08; mouse.y += (target.y - mouse.y) * 0.08;
    uni.uT.value = t; uni.uMouse.value.set(mouse.x, mouse.y);
    const mx = fine() ? mouse.x - 0.5 : Math.sin(t * 0.4) * 0.3;
    const my = fine() ? mouse.y - 0.5 : 0;
    pivot.rotation.y += ((mx * 0.9 + Math.sin(t * 0.5) * 0.12) - pivot.rotation.y) * 0.06;
    pivot.rotation.x += ((-my * 0.5) - pivot.rotation.x) * 0.06;
    one.position.y = Math.sin(t * 0.9) * 0.08;
    // the torch follows the pointer in 3D too
    torch.position.set((mouse.x - 0.5) * 12, (mouse.y - 0.5) * 7, 5);
    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.clearDepth();
    renderer.render(scene, cam);
    drawClaws(performance.now());
    raf = requestAnimationFrame(loop);
  }
  loop();

  return {
    intro() {
      const bars = $$('.hvs__bars i', root);
      const tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } });
      tl.set(bars, { scaleY: 1 })
        .to(bars, { scaleY: 0, duration: 1.3, stagger: { each: 0.06, from: 'center' } }, 0.05)
        .fromTo(uni.uLight, { value: 0 }, { value: 1, duration: 2, ease: 'power2.out' }, 0.4)
        .from(pivot.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 1.6, ease: 'expo.out' }, 0.5)
        .from(pivot.rotation, { y: -Math.PI * 1.2, duration: 2.2, ease: 'expo.out' }, 0.5)
        .from($$('.kicker', root), { autoAlpha: 0, y: 16, duration: 1, ease: 'expo.out' }, 0.8)
        .from($$('.hvs__title .w > i', root), { yPercent: 115, duration: 1.3, stagger: 0.08, ease: 'expo.out' }, 0.85)
        .from($$('.hvs__lede, .hvs__copy .hero__ctas > *, .hvs__hint', root), { autoAlpha: 0, y: 24, duration: 1, stagger: 0.08, ease: 'expo.out' }, 1.2);
      return tl;
    },
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      removeEventListener('resize', layout);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      root.removeEventListener('pointerdown', onDown);
      geo.dispose(); face.dispose(); side.dispose(); faceTex.dispose();
      renderer.dispose();
      gsap.set($$('.hvs__bars i', root), { clearProps: 'all' });
    },
  };
}
