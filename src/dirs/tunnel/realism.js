// Realistic render, phase 1 (Ahmed, 2026-10-20: "overall I want a realistic 3D render"; picked: real-time
// upgrade + photo mode, every area, free CC0 assets). This phase: the tunnel and the render pipeline.
//   · image-based light: a CC0 HDR of a real concrete tunnel (Poly Haven, concrete_tunnel_02) lights every
//     physically based material and gives it believable reflections
//   · the tunnel's floor, ceiling and walls become physically based concrete with CC0 scanned textures
//     (Poly Haven: hangar_concrete_floor, brushed_concrete) — colour, normal and roughness maps
//   · the posters become printed vinyl that the lamps actually light, instead of flat self-lit pictures
//   · the nine ceiling bars and the open mouth are real area lights (the intro still flickers them on)
//   · ground-truth ambient occlusion (GTAO) darkens corners, joints and contact points
// ?render=classic switches all of it off for comparison. Phones and ?lite keep the classic look.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TN } from './world.js';

const params = new URLSearchParams(location.search);
export const REAL = params.get('render') !== 'classic';

const texLoader = new THREE.TextureLoader();
function pbrSet(name, rep, aniso) {
  const load = (k, srgb) => { const t = texLoader.load(`/pbr/${name}_${k}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: load('diff', true), normalMap: load('nor', false), roughnessMap: load('rough', false) };
}

export async function setupRealism({ renderer, scene, W, posters }) {
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const { HW, HH, ZM, ZB, GAP, Z0, NL } = TN;
  const L = ZB - ZM + 0.2;

  /* image-based lighting */
  const hdr = await new HDRLoader().loadAsync('/pbr/tunnel_1k.hdr').catch(() => null);
  if (hdr) {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.22;
    hdr.dispose(); pmrem.dispose();
  }

  /* physically based tunnel shell */
  const floorM = new THREE.MeshStandardMaterial({ ...pbrSet('hangar_concrete_floor', [HW * 2 / 2.5, L / 2.5], aniso), color: new THREE.Color(0.32, 0.32, 0.33), roughness: 0.55, metalness: 0, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 1.2 });
  const ceilSet = pbrSet('brushed_concrete', [HW * 2 / 1.4, L / 1.4], aniso);   // finer: at 3 m a repeat the grain read as rock
  // the bars face down, so nothing lights the ceiling directly: a little bounce light from the floor (Ahmed: not black)
  const ceilM = new THREE.MeshStandardMaterial({ ...ceilSet, color: new THREE.Color(0.5, 0.52, 0.56), roughness: 1, metalness: 0, emissive: 0xd8dce4, emissiveMap: ceilSet.map, emissiveIntensity: 0.22 });
  const wallM = new THREE.MeshStandardMaterial({ ...pbrSet('brushed_concrete', [L / 3, HH / 3], aniso), color: new THREE.Color(0.3, 0.3, 0.31), roughness: 1, metalness: 0 });
  let swapped = 0;
  // only the shell itself — the side rooms are groups inside W.tunnel with their own materials
  W.tunnel.children.forEach((o) => {
    const k = o.isMesh && o.material?.defines?.KIND;
    if (k === undefined || k === null) return;
    if (k === 1) { o.material = floorM; swapped++; }
    else if (k === 2) { o.material = ceilM; swapped++; }
    else if (k === 0) { o.material = wallM; swapped++; }
  });

  // the floor's yellow guide lines were painted by the old floor shader: lay them as real paint
  const paint = new THREE.MeshStandardMaterial({ color: 0xc9a10f, roughness: 0.6, metalness: 0 });
  for (const sx of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, L), paint);
    line.rotation.x = -Math.PI / 2; line.position.set(sx * (HW - 0.55), 0.004, (ZB + ZM) / 2); W.tunnel.add(line);
  }

  /* the posters and door strips: printed vinyl, lit by the room */
  const vinyl = new Map();
  (posters || W.tunnel).traverse((o) => {
    if (!o.isMesh || !o.material?.isMeshBasicMaterial || !o.material.map) return;
    if (o.material.transparent || o.material.blending !== THREE.NormalBlending) return;
    const b = o.material;
    if (!vinyl.has(b)) vinyl.set(b, new THREE.MeshStandardMaterial({ map: b.map, color: new THREE.Color(1.1, 1.1, 1.1), roughness: 0.78, metalness: 0, envMapIntensity: 0.06, side: b.side }));   // matte print: a glossy env reflection greyed the blacks
    o.material = vinyl.get(b);
  });

  /* real lights: the nine ceiling bars, and daylight / floodlight through the mouth */
  RectAreaLightUniformsLib.init();
  const lamps = [];
  for (let i = 0; i < NL; i++) {
    const l = new THREE.RectAreaLight(0xfff0d6, 0, 2.6, 0.35);
    l.position.set(0, HH - 0.16, Z0 + i * GAP); l.lookAt(0, 0, Z0 + i * GAP);
    W.tunnel.add(l); lamps.push(l);
  }
  const mouth = new THREE.RectAreaLight(0xfff6e6, 0, HW * 2, HH);
  mouth.position.set(0, HH / 2, ZM - 0.3); mouth.lookAt(0, HH / 2, ZM + 10);
  W.tunnel.add(mouth);
  const LAMP = 12, MOUTH = 3.5;   // brighter washed out the floor's TIGERS stencil
  const hash = (n) => { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); };

  function update(intro, t, camZ, inRoom = false) {
    const inTunnel = camZ > ZM - 6;
    // in a room the tunnel's lights are switched out entirely (not just dimmed) so no surface pays for them
    const show = inTunnel && !inRoom;
    for (const l of lamps) l.visible = show;
    mouth.visible = show;
    lamps.forEach((l, i) => {
      const raw = Math.min(1, Math.max(0, intro.on - (NL - 1 - i)));
      const on = raw >= 1 ? 1 : raw * (hash(Math.floor(t * 16) + i * 7.13) > 0.4 ? 1 : 0);
      l.intensity = inTunnel ? LAMP * on : 0;
    });
    mouth.intensity = inTunnel ? MOUTH * intro.mouth : 0;
  }
  const showLamps = (v) => { for (const l of lamps) l.visible = v; mouth.visible = v; };
  return { update, showLamps, swapped, vinyl: vinyl.size };
}
