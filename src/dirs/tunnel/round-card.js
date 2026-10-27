// After a round of penalties or free kicks on the pitch (2026-10-27): a small card under the game's banner with the
// round's stars on its tier, a tier that just opened, and Share (the score card). It goes when the next shot starts.
import { onFanEvent } from './fan-events.js';
import { TIER_LABEL, starRow } from './tiers.js';
import { openShare } from './share-card.js';
import { feel } from './feel.js';

let card = null, hideT = 0;
const GAME = { penalties: 'Penalties', freekick: 'Free kicks' };
function hide() { const c = card; card = null; clearTimeout(hideT); if (!c) return; c.classList.remove('is-on'); setTimeout(() => c.remove(), 250); }
onFanEvent((type, e) => {
  if (type !== 'game-result' || !e.three || e.cup || !GAME[e.game]) return;
  const host = document.querySelector('.js-game'); if (!host || host.hidden) return;
  hide();
  const c = card = document.createElement('div');
  c.className = 'fz-round'; c.setAttribute('role', 'status');
  c.innerHTML = `<span class="fz-stars is-l" aria-label="${e.stars || 0} of 3 stars">${starRow(e.stars || 0)}</span>
    <div><b>${GAME[e.game]} · ${TIER_LABEL[e.tier] || ''}</b><small>${e.score} this round${e.newStars ? ` · <em>+${e.newStars} star${e.newStars > 1 ? 's' : ''}</em>` : ''}${e.unlocked ? ` · <em>${TIER_LABEL[e.unlocked]} unlocked</em>` : ''}</small></div>
    <button type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3 M7 8l5-5 5 5 M5 12v8h14v-8"/></svg>Share</button>`;
  for (const ev of ['pointerdown', 'touchstart', 'pointerup', 'touchend']) c.addEventListener(ev, (x) => x.stopPropagation());
  c.querySelector('button').addEventListener('click', (x) => { x.stopPropagation(); feel.tap(); openShare({ kind: 'score', game: e.game, score: e.score, tier: e.tier, stars: e.stars }); });
  host.append(c);
  setTimeout(() => { if (card === c) { c.classList.add('is-on'); if (e.unlocked) feel.win(); } }, 1600);
  hideT = setTimeout(hide, 12000);
});
// the next shot (or leaving the pitch) clears it
addEventListener('pointerdown', (x) => { if (card && !card.contains(x.target) && !x.target.closest?.('.sc-modal')) setTimeout(() => { if (card && !document.querySelector('.fz-share')) hide(); }, 4000); }, true);
