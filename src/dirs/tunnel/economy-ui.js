// The Claws wiring (2026-10-27): the "+n Claws" pop-up (like feel.xp's "+50 XP", just under it), the menu's Claws
// chip and the Missions badge, and the sources that aren't a module of their own: achievements pay their XP value
// in Claws once, and mini-game rounds pay a few Claws by score (shared daily cap, economy.js CAPS.games).
// main.js imports this once.
import './economy.css';
import { claws, EARN } from './economy.js';
import { progress, ACHIEVEMENTS } from './progress.js';
import { onFanEvent } from './fan-events.js';
import { missions } from './missions.js';
import { CLAW_SVG } from './rewards.js';

// the pop-up: under an XP pop-up that lands at the same moment
let lastXp = 0;
progress.on((e) => { if (e.type === 'xp') lastXp = performance.now(); });
claws.on((e) => {
  if (e.type !== 'earn') return;
  const show = () => {
    const el = document.createElement('div');
    el.className = 'fx-pop ec-pop'; el.innerHTML = `${CLAW_SVG}+${e.amount.toLocaleString('en')} CLAWS`;
    el.style.left = `${innerWidth / 2}px`; el.style.top = `${innerHeight * 0.22 + 38}px`;
    document.body.append(el);
    el.addEventListener('animationend', () => el.remove());
  };
  if (performance.now() - lastXp < 400) setTimeout(show, 220); else requestAnimationFrame(() => (performance.now() - lastXp < 60 ? setTimeout(show, 220) : show()));
});

// achievements: their XP in Claws as well
progress.on((e) => { if (e.type === 'achieve') { const a = ACHIEVEMENTS[e.id]; if (a) claws.earn(Math.round(a.xp * EARN.achievement), `Achievement: ${a.label}`); } });

// mini-game rounds: a few Claws by score, capped a day (the same round reported twice counts once)
const GAME_CLAWS = { penalties: (s) => s * 2, freekick: (s) => s * 2, keepy: (s) => Math.floor(s / 2), quiz: (s) => s * 6 };
let lastRound = '';
onFanEvent((type, d = {}) => {
  if (type !== 'game-result') return;
  const k = `${d.game}|${d.score}`; if (k === lastRound) return; lastRound = k; setTimeout(() => { if (lastRound === k) lastRound = ''; }, 1500);
  const n = Math.min(30, (GAME_CLAWS[d.game] || (() => 10))(+d.score || 0));
  if (n > 0) claws.earnCapped(n, `Mini-game · ${d.game}`, 'games');
});

// the menu: the Claws chip and the Missions badge (both rebuilt with the menu, so painted by class)
const paint = () => {
  document.querySelectorAll('.js-ms-claws').forEach((el) => { el.textContent = claws.balance.toLocaleString('en'); });
  const n = missions.claimable;
  document.querySelectorAll('.js-ms-mx').forEach((el) => { el.textContent = n; el.hidden = !n; });
};
claws.on(paint); missions.onChange(paint); progress.on(paint);
export const paintEconomy = paint;
window.__claws = claws; // debug handle, like __progress
