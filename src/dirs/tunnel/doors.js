// The side rooms' doors (Ahmed, 2026-10-11): closed while you walk the tunnel, each with a "Discover"
// call to action as you pass. Clicking it swings the double doors open into the room and takes you in;
// walk on and they stay shut. Leaves are hinged at the opening's edges and swing into the room.
import * as THREE from 'three';
import { TN, DOORS } from './world.js';
import { NEON } from './fx.js';

export const ROOM_DOORS = [
  { room: 'changing', label: 'The locker room', side: -1, z: DOORS.changing },
  { room: 'trophies', label: 'The trophy room', side: 1, z: DOORS.in },
  { room: 'store', label: 'The club store', side: -1, z: DOORS.store },
  { room: 'gym', label: 'The gym', side: -1, z: DOORS.gym },
  { room: 'fame', label: 'Hall of fame', side: 1, z: DOORS.fame },
  { room: 'fantasy', label: 'SPL Fantasy', side: 1, z: DOORS.fantasy },
];
// the tunnel's end wall, behind you as the walk starts: a door that stays shut (the changing room moved to
// the left wall, Ahmed: "in the tunnel, not behind me")
const END_DOOR = { room: null, label: 'Players only', wall: 'end', x: DOORS.back, z: TN.ZB };
// the trophy room's second doorway has no call to action of its own: it just stays shut,
// (the trophy room's second doorway and the old matches room are walled up now)
const PLAIN = [];

function doorTex(label) {
  const W = 1024, H = 1380, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#16171a'); g.addColorStop(0.5, '#1d1e22'); g.addColorStop(1, '#141518');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // brushed metal
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; x.fillRect(Math.random() * W, 0, 1, H); }
  // the two leaves: frame, inset panel, and a yellow LED strip down the meeting edge
  for (const L of [0, 1]) {
    const x0 = L * W / 2;
    x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = 10; x.strokeRect(x0 + 5, 5, W / 2 - 10, H - 10);
    x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 3; x.strokeRect(x0 + 60, 120, W / 2 - 120, H - 300);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(x0 + 60, H - 150, W / 2 - 120, 8);       // kick plate line
  }
  // the LED strip down the meeting edge (a plain metal edge without the neon)
  x.fillStyle = NEON ? '#fef201' : '#3a3b3f'; x.fillRect(W / 2 - 7, 40, 14, H - 80);
  if (NEON) { x.fillStyle = 'rgba(254,242,1,0.25)'; x.fillRect(W / 2 - 22, 40, 44, H - 80); }
  // push bars
  x.fillStyle = '#9a9ca0'; x.fillRect(W / 2 - 150, H * 0.52, 110, 18); x.fillRect(W / 2 + 40, H * 0.52, 110, 18);
  // the room's name across the top
  x.fillStyle = 'rgba(255,255,255,0.82)'; x.textAlign = 'center';
  x.font = '400 64px Anton'; x.fillText(label.toUpperCase(), W / 2, 90);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildDoors(parent) {
  const H = DOORS.h, doors = [];
  {
    // the end-wall door: hinged at x0 / x1, swinging into the changing room (+z)
    const d = END_DOOR, [x0, x1] = d.x, w = (x1 - x0) / 2;
    const mat = new THREE.MeshBasicMaterial({ map: doorTex(''), color: new THREE.Color(0.75, 0.75, 0.75) });
    const backMat = new THREE.MeshBasicMaterial({ map: doorTex(''), side: THREE.BackSide, color: new THREE.Color(0.75, 0.75, 0.75) });   // the room side: no mirrored label
    const leaves = [x0, x1].map((hx, i) => {
      const g = new THREE.PlaneGeometry(w, H);
      // seen from the tunnel (looking +z) −x is on the right, so the leaf at x0 shows the texture's right half
      const half = i === 0 ? 0.5 : 0;
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 0.5 + half);
      g.rotateY(Math.PI);                                           // face the tunnel
      g.translate((i === 0 ? 1 : -1) * w / 2, H / 2, 0);
      const pivot = new THREE.Group();
      pivot.position.set(hx, 0, d.z - 0.02);
      pivot.add(new THREE.Mesh(g, mat), new THREE.Mesh(g, backMat));
      parent.add(pivot);
      return { pivot, dir: i === 0 ? -1 : 1 };
    });
    doors.push({ ...d, centre: new THREE.Vector3(0, 1.45, d.z), leaves, mat, backMat, open: 0, target: 0 });
  }
  for (const d of [...ROOM_DOORS, ...PLAIN]) {
    const [z0, z1] = d.z, w = (z1 - z0) / 2, x = d.side * TN.HW;
    const tex = doorTex('');   // the room's name is on the poster over the door
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.75, 0.75, 0.75) });
    const backMat = new THREE.MeshBasicMaterial({ map: doorTex(''), side: THREE.BackSide, color: new THREE.Color(0.75, 0.75, 0.75) });   // the room side: no mirrored label
    const leaves = [z0, z1].map((hz, i) => {
      // a leaf hinged at hz, spanning toward the middle; uv takes its half of the door texture
      const g = new THREE.PlaneGeometry(w, H);
      const uv = g.attributes.uv;
      // seen from the tunnel, the leaf at z0 is on the left on the right-hand wall and on the right on the left-hand wall
      const half = (i === 0) === (d.side > 0) ? 0 : 0.5;
      for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * 0.5 + half);
      g.rotateY(d.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      g.translate(0, H / 2, (i === 0 ? 1 : -1) * w / 2);            // out from the hinge along z
      const m = new THREE.Mesh(g, mat);
      const pivot = new THREE.Group();
      pivot.add(new THREE.Mesh(g, backMat));
      pivot.position.set(x, 0, hz);
      pivot.add(m);
      parent.add(pivot);
      return { pivot, dir: (i === 0 ? 1 : -1) * d.side };          // which way it swings into the room
    });
    doors.push({ ...d, centre: new THREE.Vector3(x, 1.45, (z0 + z1) / 2), leaves, mat, backMat, open: 0, target: 0 });
  }
  return {
    doors,
    get(room) { return doors.find((d) => d.room === room); },
    // light: the tunnel's lamps (0..1); open/close easing toward each door's target
    update(dt, light = 1) {
      for (const d of doors) {
        d.open += (d.target - d.open) * (1 - Math.exp(-dt * 3.2));
        const a = d.open * 1.48;
        for (const L of d.leaves) L.pivot.rotation.y = a * L.dir;
        d.mat.color.setScalar(0.12 + 0.63 * light); d.backMat?.color.setScalar(0.75);
      }
    },
  };
}
