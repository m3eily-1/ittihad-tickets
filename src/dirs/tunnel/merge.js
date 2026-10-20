// Performance: fold a room's static furniture into one mesh per material. The rooms are built from thousands of
// small boxes and planes (hangers, shelves, dividers, hooks…); each was its own draw call, so the store alone
// cost ~2,000 a frame. Meshes that move, or that the room keeps a handle on, are left as they are.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeStatic(root, keep = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const keepSet = new Set();
  for (const k of keep) k?.traverse?.((o) => keepSet.add(o));
  const visibleTo = (o) => { for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return false; return true; };
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || keepSet.has(o) || Array.isArray(o.material)) return;
    if (o.renderOrder !== 0 || o.userData.noMerge || o.morphTargetInfluences || !visibleTo(o)) return;
    if (o.matrixWorld.determinant() < 0) return;   // mirrored meshes would turn inside out
    // detailed meshes (the 3D shirts) stay separate so the ones off-screen can still be skipped
    if ((o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3) > 1500) return;
    const g = o.geometry, attrs = Object.keys(g.attributes).sort().join(',');
    const key = `${o.material.uuid}|${attrs}|${g.index ? 'i' : 'n'}|${o.castShadow}|${o.receiveShadow}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let before = 0, after = 0;
  const rel = new THREE.Matrix4();
  for (const list of groups.values()) {
    before += list.length;
    if (list.length < 2) { after += list.length; continue; }
    const geos = list.map((m) => { rel.multiplyMatrices(inv, m.matrixWorld); return m.geometry.clone().applyMatrix4(rel); });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) { after += list.length; continue; }
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, list[0].material);
    mesh.name = 'merged';
    root.add(mesh);
    for (const m of list) m.parent.remove(m);
    after += 1;
  }
  return { before, after };
}
