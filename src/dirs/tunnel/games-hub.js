// The mini-games hub (Ahmed, 2026-10-21: "make all the mini games"): every game on one screen, FC-style tiles with
// your best score and what each one unlocks. main.js decides how to launch each game (onPlay).
// 2026-10-27: the games, each with its Rookie / Pro / Legend tiers and stars (tiers.js). Penalties asks first: play for
// fun, or this week's Penalty Cup. (Fan leagues, the fanbase goal and the derby week were taken out — Ahmed.)
import './games-hub.css';
import './fanzone.css';
import { progress, ACHIEVEMENTS } from './progress.js';
import { feel } from './feel.js';
import { tiers, TIERS, TIER_LABEL, STARS, UNIT, starRow } from './tiers.js';
import { cup, openPenaltyCup } from './pen-cup.js';
import { esc, left, weekEnd } from './fz-core.js';
import './round-card.js';

export const GAMES_LIST = [
  // (the SPL Cup is hidden for now — Ahmed, 2026-10-26; its code stays in cup.js)
  { id: 'penalties', title: 'Penalties', sub: 'Five shots against the keeper', ach: 'pen-top', art: 'pen', three: true },
  { id: 'freekick', title: 'Free kicks', sub: 'Bend it round the wall', ach: 'fk-goal', art: 'fk', three: true },
  { id: 'keepy', title: 'Keepy-uppy', sub: 'Keep it off the ground', ach: 'keepy-20', art: 'keepy' },
  { id: 'quiz', title: 'Legends quiz', sub: 'Five questions on club legends', ach: 'quiz-4', art: 'quiz' },
];
const TIER_SUB = {
  penalties: { rookie: 'A slower keeper', pro: 'He reads you 7 times in 10', legend: 'Quickest keeper, longest reach' },
  freekick: { rookie: 'Three-man wall', pro: 'Four-man wall', legend: 'Five-man wall, higher jump' },
  keepy: { rookie: 'A lighter ball', pro: 'Match ball', legend: 'Heavier ball, a breeze' },
  quiz: { rookie: '15 seconds a question', pro: '10 seconds', legend: '7 seconds, the hard questions' },
};

// Penalties asks how you want to play (Ahmed, 2026-10-27: "the penalty cup should be inside the penalty game and the
// user should choose if he wants to play for fun or the cup")
function cupLine() {
  const s = cup.stage, nx = cup.next();
  return s === 'champ' ? 'Champion this week' : s === 'out' ? `Out · new draw in ${left(weekEnd() - Date.now())}` : `${nx.label} vs ${nx.opp.split(' ')[0]} · beat ${nx.target} to go through`;
}
function modeSheet() {
  const s = cup.stage, sel = tiers.selected('penalties');
  const dots = [0, 1, 2].map((k) => { const r = cup.state.res[k]; return `<i class="${r ? (r.won ? 'is-win' : 'is-lose') : s === k ? 'is-next' : ''}"></i>`; }).join('');
  return `<div class="gh-mode" role="dialog" aria-label="Penalties: how do you want to play?">
    <div class="gh-mode__in">
      <header><button type="button" class="gh__back js-mode-x" aria-label="Back">← Back</button><h3>Penalties</h3></header>
      <div class="gh-mode__opts">
        <button type="button" class="gh-mode__o" data-mode="fun"><b>Play for fun</b><span>Five shots against the keeper</span>
          <em>${TIER_LABEL[sel]} · <span class="fz-stars is-s">${starRow(tiers.stars('penalties', sel))}</span></em></button>
        <button type="button" class="gh-mode__o is-cup" data-mode="cup"><b>Penalty Cup</b><span>${esc(cupLine())}</span>
          <span class="fz-feat__dots" aria-hidden="true">${dots}</span><em>8 fans · knockout · this week</em></button>
      </div>
    </div></div>`;
}

export function openGamesHub({ onPlay, onClose } = {}) {   // (each game carries its own leaderboard now)
  const el = document.createElement('div');
  el.className = 'gh'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Play');
  const tile = (g, i) => {
    const sel = tiers.selected(g.id), best = tiers.best(g.id, sel), goals = STARS[g.id], n = tiers.stars(g.id, sel);
    const nextGoal = goals[n];
    const a = ACHIEVEMENTS[g.ach], done = progress.has(g.ach);
    return `<div class="gh__g is-${g.art}" style="--d:${i * 0.04}s">
      <button type="button" class="gh__play" data-g="${g.id}" aria-label="Play ${esc(g.title)} on ${TIER_LABEL[sel]}">
        <span class="gh__art" aria-hidden="true"></span>
        <b>${esc(g.title)}</b><small>${esc(TIER_SUB[g.id][sel])}</small>
        <span class="gh__meta"><span class="fz-stars" aria-label="${n} of 3 stars on ${TIER_LABEL[sel]}">${starRow(n)}</span>${best ? `<em>Best ${best}</em>` : ''}${done ? '' : `<i>+${a?.xp || 0} XP</i>`}</span>
        <span class="gh__goal">${nextGoal ? `Next star: ${nextGoal} ${UNIT[g.id]}` : `All three stars on ${TIER_LABEL[sel]}`}</span></button>
      <div class="gh__tiers" role="group" aria-label="${esc(g.title)} difficulty">${TIERS.map((t) => {
        const open = tiers.unlocked(g.id, t);
        return `<button type="button" class="${t === sel ? 'is-on' : ''}" data-tier="${t}" data-game="${g.id}" aria-pressed="${t === sel}" ${open ? '' : 'aria-disabled="true"'} title="${open ? TIER_LABEL[t] : `Unlock: ${tiers.unlockHint(g.id, t)}`}">
          <span>${TIER_LABEL[t]}</span>${open ? `<span class="fz-stars is-s">${starRow(tiers.stars(g.id, t))}</span>` : `<small>${esc(tiers.unlockHint(g.id, t))}</small>`}</button>`;
      }).join('')}</div></div>`;
  };
  const render = () => {
    const sc = el.querySelector('.gh__scroll')?.scrollTop || 0;
    el.innerHTML = `<header class="gh__hd"><button type="button" class="gh__back js-gh-back" aria-label="Back">← Back</button>
        <div><h2>Play</h2></div>
        <p class="gh__lv">Level <b>${progress.level}</b><span><i style="width:${(progress.levelXp / 250) * 100}%"></i></span></p></header>
      <div class="gh__scroll">
        <h3 class="fz-sec">Mini-games <span>${tiers.allStars}/${tiers.maxStars} stars</span></h3>
        <div class="gh__grid">${GAMES_LIST.map(tile).join('')}</div>
      </div>`;
    el.querySelector('.gh__scroll').scrollTop = sc;
  };
  render();
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-on'));
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.js-gh-back')) { feel.back(); close(); onClose?.(); return; }
    const t = e.target.closest('[data-tier]');
    if (t) {
      if (t.getAttribute('aria-disabled') === 'true') { feel.back(); t.classList.remove('is-shake'); void t.offsetWidth; t.classList.add('is-shake'); return; }
      feel.tap(); tiers.select(t.dataset.game, t.dataset.tier); render(); return;
    }
    if (e.target.closest('.js-mode-x') || e.target.classList.contains('gh-mode')) { feel.back(); el.querySelector('.gh-mode')?.remove(); return; }
    const m = e.target.closest('[data-mode]');
    if (m) { feel.tap(); close(); onPlay?.(m.dataset.mode === 'cup' ? 'pcup' : 'penalties'); return; }
    const g = e.target.closest('[data-g]'); if (!g) return;
    if (g.dataset.g === 'penalties') { feel.tap(); el.querySelector('.gh-mode')?.remove(); el.insertAdjacentHTML('beforeend', modeSheet()); return; }
    feel.tap(); close(); onPlay?.(g.dataset.g);
  });
}
// (re-exported for main.js's menu)
export { openPenaltyCup };
