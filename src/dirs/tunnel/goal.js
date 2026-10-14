// A real goal (Ahmed, 2026-10-14: "the goal net is not matching live"). Replaces the posts-plus-glass-box:
// 12 cm round posts and bar, a box net on a white stanchion frame — the roof runs 1 m back from the bar,
// the back drops to a ground bar 2 m behind the line — and knotted square netting (≈12 cm mesh) that
// hangs slack: the roof sags, the back and sides belly out. A shot that scores punches a bulge into it.
// Built in local space with the depth along +x; the far goal is turned around.
import * as THREE from 'three';

const W = 7.32, H = 2.44, R = 0.06, TOP_D = 1.0, BASE_D = 2.0, TILE = 1.2;   // TILE: metres per net texture repeat

let netTex = null;
function netTexture() {
  if (netTex) return netTex;
  const S = 512, cells = 10, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 3.2; x.lineCap = 'round';
  const step = S / cells;
  for (let i = 0; i <= cells; i++) {
    // twine wanders a touch so the mesh isn't a ruled grid
    x.beginPath(); for (let k = 0; k <= cells; k++) x.lineTo(i * step + Math.sin(k * 1.7 + i) * 1.2, k * step); x.stroke();
    x.beginPath(); for (let k = 0; k <= cells; k++) x.lineTo(k * step, i * step + Math.cos(k * 1.3 + i) * 1.2); x.stroke();
  }
  x.fillStyle = '#fff';
  for (let i = 0; i <= cells; i++) for (let k = 0; k <= cells; k++) { x.beginPath(); x.arc(i * step, k * step, 2.3, 0, Math.PI * 2); x.fill(); }   // knots
  netTex = new THREE.CanvasTexture(c);
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  netTex.anisotropy = 8;
  return netTex;
}

// soft side-lit white so round tubes read as round under the stadium's flat materials
let tubeTex = null;
function tubeTexture() {
  if (tubeTex) return tubeTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 4;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, '#9a9c9e'); g.addColorStop(0.3, '#ffffff'); g.addColorStop(0.55, '#e9eaeb'); g.addColorStop(0.85, '#8d8f92'); g.addColorStop(1, '#9a9c9e');
  x.fillStyle = g; x.fillRect(0, 0, 64, 4);
  tubeTex = new THREE.CanvasTexture(c); tubeTex.colorSpace = THREE.SRGBColorSpace;
  return tubeTex;
}

function tube(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 20, 1), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

// a subdivided bilinear panel between four corners, UVs in metres/TILE, with a slack function (u, v) → offset
function panel(c00, c10, c01, c11, nu, nv, sag) {
  const pos = [], uv = [], idx = [], p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const lu = c00.distanceTo(c10), lv = c00.distanceTo(c01);
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    a.lerpVectors(c00, c10, u); b.lerpVectors(c01, c11, u); p.lerpVectors(a, b, v);
    p.add(sag(u, v));
    pos.push(p.x, p.y, p.z); uv.push((u * lu) / TILE, (v * lv) / TILE);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = j * (nu + 1) + i; idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export function buildGoal(side = 1) {
  const group = new THREE.Group();
  group.rotation.y = side > 0 ? 0 : Math.PI;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* frame */
  const white = new THREE.MeshBasicMaterial({ map: tubeTexture(), color: new THREE.Color(1.25, 1.25, 1.22), fog: true });
  const steel = new THREE.MeshBasicMaterial({ map: tubeTexture(), color: new THREE.Color(0.95, 0.95, 0.95), fog: true });
  const hz = W / 2 + R;
  for (const z of [-hz, hz]) {
    group.add(tube(V(0, 0, z), V(0, H + R, z), R, white));                    // post
    group.add(tube(V(0, H, z), V(TOP_D, H, z), 0.024, steel));                 // stanchion: back from the bar…
    group.add(tube(V(TOP_D, H, z), V(BASE_D, 0.02, z), 0.024, steel));         // …and down to the ground
    group.add(tube(V(0, 0.02, z), V(BASE_D, 0.02, z), 0.024, steel));          // ground bar, side
  }
  group.add(tube(V(0, H, -hz - R), V(0, H, hz + R), R, white));                // crossbar
  group.add(tube(V(BASE_D, 0.02, -hz), V(BASE_D, 0.02, hz), 0.024, steel));    // ground bar, back
  group.add(tube(V(TOP_D, H, -hz), V(TOP_D, H, hz), 0.02, steel));             // roof back rail

  /* net */
  const uniforms = { uHit: { value: new THREE.Vector3(0, 1, 0) }, uAmp: { value: 0 }, uTime: { value: 0 } };
  const netMat = new THREE.MeshBasicMaterial({ map: netTexture(), color: new THREE.Color(0.96, 0.96, 0.95), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true });
  netMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'uniform vec3 uHit; uniform float uAmp; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      // a shot that scores punches the net back around where it hit; the depth term keeps the frame edges pinned
      float dHit = length(transformed.yz - uHit.yz);
      float pin = smoothstep(0.0, 0.5, ${H.toFixed(2)} - transformed.y + 0.02) * smoothstep(0.0, 0.25, transformed.y) * smoothstep(0.0, 0.6, ${(W / 2).toFixed(2)} - abs(transformed.z));
      transformed.x += uAmp * exp(-dHit * dHit / 0.9) * pin * step(0.3, transformed.x);
      // and a slow breath of air through it
      transformed.x += sin(uTime * 1.3 + transformed.z * 0.9 + transformed.y * 1.7) * 0.012 * step(0.3, transformed.x) * pin;`);
  };
  netMat.customProgramCacheKey = () => 'goalnet';
  const hzN = W / 2 + 0.02;
  // roof: bar → roof rail, sagging in the middle
  group.add(new THREE.Mesh(panel(V(0.04, H, -hzN), V(0.04, H, hzN), V(TOP_D, H, -hzN), V(TOP_D, H, hzN), 36, 6,
    (u, v) => V(0, -0.13 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) - 0.02 * Math.sin(Math.PI * v), 0)), netMat));
  // back: roof rail → back ground bar, bellied out and loose at the foot
  group.add(new THREE.Mesh(panel(V(BASE_D, 0.02, -hzN), V(BASE_D, 0.02, hzN), V(TOP_D, H, -hzN), V(TOP_D, H, hzN), 36, 14,
    (u, v) => V(0.1 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.15)) + 0.05 * (1 - v) * Math.sin(Math.PI * u), -0.05 * Math.sin(Math.PI * u) * (1 - v) * (1 - v), 0)), netMat));
  // sides: post → stanchion, bellied outward
  for (const s of [-1, 1]) {
    const z = s * hzN;
    group.add(new THREE.Mesh(panel(V(0.04, 0.02, z), V(BASE_D, 0.02, z), V(0.04, H, z), V(TOP_D, H, z), 12, 10,
      (u, v) => V(0, 0, s * 0.07 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v))), netMat));
  }

  /* the bulge: hit(z, y) in local coords, then update(dt) springs it out and lets it settle */
  const sp = { a: 0, v: 0 };
  return {
    group,
    hit(z, y) { uniforms.uHit.value.set(0, y, z); sp.v = 3.2; },
    update(dt, time) {
      uniforms.uTime.value = time;
      sp.v += (-sp.a * 60 - sp.v * 7) * dt; sp.a += sp.v * dt;
      uniforms.uAmp.value = sp.a;
    },
  };
}
