// Room interactions (Ahmed, 2026-10-21): what happens when you click an object in a room. scene.js reports
// clicks on anything with userData.click = '<id>' (and hovers); each room has its own UI module, loaded the
// first time you click in that room. A room UI module exports:
//   click(id, hit, ctx)   — hit = { room, id, object, point }
//   hover?(id, ctx)       — id or null
//   enter?(ctx) / leave?(ctx) — optional, when you step inside / walk out
// ctx = { scene, room: <the room's scene module>, shop, progress, feel }
import { shop } from './shop.js';
import { progress } from './progress.js';
import { feel } from './feel.js';

const LOADERS = {
  trophies: () => import('./rooms/trophies-ui.js'),
  changing: () => import('./rooms/locker-ui.js'),
  gym: () => import('./rooms/gym-ui.js'),
  fame: () => import('./rooms/fame-ui.js'),
  store: () => import('./rooms/store-ui.js'),
  fantasy: () => import('./rooms/fantasy-room-ui.js'),
};
const mods = {};
async function mod(room) {
  if (!LOADERS[room]) return null;
  if (!mods[room]) mods[room] = LOADERS[room]().catch((err) => { console.warn('[rooms] no UI for', room, err); return null; });
  return mods[room];
}
let sceneRef = null;
const ctxOf = (room) => ({ scene: sceneRef, room: sceneRef?.roomModule(room), shop, progress, feel });
export function initRoomUI(scene) { sceneRef = scene; }
export async function roomClick(hit) { const m = await mod(hit.room); m?.click?.(hit.id, hit, ctxOf(hit.room)); }
export async function roomHover({ room, id }) { const m = await mod(room); m?.hover?.(id, ctxOf(room)); }
export async function roomVisit(room, inside) { if (!room) return; const m = await mod(room); (inside ? m?.enter : m?.leave)?.(ctxOf(room)); }
