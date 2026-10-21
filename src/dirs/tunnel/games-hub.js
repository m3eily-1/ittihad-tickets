// The mini-games hub (Ahmed, 2026-10-21: "make all the mini games"): every game on one screen, FC-style tiles with
// your best score and what each one unlocks. main.js decides how to launch each game (onPlay).
import './games-hub.css';
import { progress, ACHIEVEMENTS } from './progress.js';
import { feel } from './feel.js';

export const GAMES_LIST = [
  { id: 'cup', title: 'SPL Cup', sub: 'Pick a club, win the knockout', ach: 'pen-goal', art: 'cup', three: true },
  { id: 'penalties', title: 'Penalties', sub: 'Five shots against the keeper', ach: 'pen-top', art: 'pen', three: true },
  { id: 'freekick', title: 'Free kicks', sub: 'Bend it round the wall', ach: 'fk-goal', art: 'fk', three: true },
  { id: 'keepy', title: 'Keepy-uppy', sub: 'Keep it off the ground', ach: 'keepy-20', art: 'keepy' },
  { id: 'quiz', title: 'Legends quiz', sub: 'Five questions on club legends', ach: 'quiz-4', art: 'quiz' },
];
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// onLeaderboard(back): the friends' leaderboard, opened over the hub (Ahmed, 2026-10-22: moved here from the menu rail)
export function openGamesHub({ onPlay, onClose, onLeaderboard } = {}) {
  const el = document.createElement('div');
  el.className = 'gh'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Mini-games');
  el.innerHTML = `<header class="gh__hd"><button type="button" class="gh__back js-gh-back">← Back</button>
      <div><h2>Mini-games</h2></div>
      <p class="gh__lv">Level <b>${progress.level}</b><span><i style="width:${(progress.levelXp / 250) * 100}%"></i></span></p>
      ${onLeaderboard ? '<button type="button" class="gh__lb js-gh-lb"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 13v4 M8 21h8 M9 17h6v4H9z"/></svg>Leaderboard</button>' : ''}</header>
    <div class="gh__grid">${GAMES_LIST.map((g, i) => {
      const a = ACHIEVEMENTS[g.ach], done = progress.has(g.ach), best = progress.best(g.id);
      return `<button type="button" class="gh__g is-${g.art}" data-g="${g.id}" style="--d:${i * 0.04}s">
        <span class="gh__art" aria-hidden="true"></span>
        <b>${esc(g.title)}</b><small>${esc(g.sub)}</small>
        <span class="gh__meta">${best ? `<em>Best ${best}</em>` : ''}${a?.card ? `<i class="${done ? 'is-done' : ''}">${done ? '✓ Legend won' : 'Wins a legend'}</i>` : `<i class="${done ? 'is-done' : ''}">+${a?.xp || 0} XP</i>`}</span></button>`;
    }).join('')}</div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-on'));
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.js-gh-back')) { feel.back(); close(); onClose?.(); return; }
    if (e.target.closest('.js-gh-lb')) { feel.tap(); el.classList.add('is-under'); onLeaderboard?.(() => el.classList.remove('is-under')); return; }
    const g = e.target.closest('[data-g]'); if (!g) return;
    feel.tap(); close(); onPlay?.(g.dataset.g);
  });
}
