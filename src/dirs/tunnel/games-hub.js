// The mini-games hub (Ahmed, 2026-10-21: "make all the mini games"): every game on one screen, FC-style tiles with
// your best score and what each one unlocks. main.js decides how to launch each game (onPlay).
// 2026-10-27 (the social + competitive layer): it's the fan zone now — the derby week on top, then the weekly
// Penalty Cup, your fan leagues and the fanbase goal, then the games, each with its Rookie / Pro / Legend tiers and
// stars (tiers.js). The leagues, derby and goal pages open over the hub; a game started from one of them comes back
// to it (onPlay's second argument says which, so main.js can reopen the hub on that page).
import './games-hub.css';
import './fanzone.css';
import { progress, ACHIEVEMENTS } from './progress.js';
import { feel } from './feel.js';
import { tiers, TIERS, TIER_LABEL, STARS, UNIT, starRow } from './tiers.js';
import { derbyInfo, tally, openDerby, now as derbyNow } from './derby.js';
import { cup, openPenaltyCup } from './pen-cup.js';
import { leagues, table, openLeagues } from './leagues.js';
import { goalCardHTML, openFanGoal } from './fan-goal.js';
import { esc, left, fmt, myWeek, weekEnd } from './fz-core.js';
import { meter } from './fz-ui.js';
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
const ord = (n) => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10] || 'th'}`;

/* the band above the games: what's on this week */
function derbyBand() {
  const d = derbyInfo(); if (!d) return '';
  const T = tally(d), pc = Math.round(T.k * 100), now = derbyNow();
  const right = d.state === 'live' ? `<em><small>${d.clock}</small><b class="js-gh-dl">${left(d.ko - now)}</b></em>` : d.state === 'soon' ? `<em><small>Opens in</small><b>${left(d.opens - now)}</b></em>` : `<em><small>Result</small><b>${T.k >= 0.5 ? 'Tigers won' : `${esc(d.rival.fans.split(' ')[0])} won`}</b></em>`;
  return `<button type="button" class="fz-dband is-${d.state}" data-open="derby">
    <span class="fz-dband__cr"><img src="/teams/al-ittihad.png" alt=""/>${d.m.crest ? `<img src="${esc(d.m.crest)}" alt=""/>` : ''}</span>
    <span class="fz-dband__t"><b>${esc(d.rival.title)}</b><small>Al-Ittihad vs ${esc(d.m.opp)} · ${d.state === 'soon' ? 'the fans\' battle opens a week before' : `Tigers ${pc}% · ${esc(d.rival.fans.split(' ')[0])} ${100 - pc}%`}</small>${d.state !== 'soon' ? meter(T.k, { cls: 'is-vs' }) : ''}</span>${right}<strong aria-hidden="true">›</strong></button>`;
}
function cupTile() {
  const s = cup.stage, nx = cup.next();
  const line = s === 'champ' ? 'Champion this week' : s === 'out' ? `Out · new draw in ${left(weekEnd() - Date.now())}` : `${nx.label} vs ${nx.opp.split(' ')[0]} · beat ${nx.target}`;
  const dots = [0, 1, 2].map((k) => { const r = cup.state.res[k]; return `<i class="${r ? (r.won ? 'is-win' : 'is-lose') : s === k ? 'is-next' : ''}"></i>`; }).join('');
  return `<button type="button" class="fz-feat is-cup" data-g="pcup"><b>Penalty Cup</b><span>${esc(line)}</span><span class="fz-feat__dots" aria-hidden="true">${dots}</span><em>8 fans · knockout · weekly</em></button>`;
}
function leagueTile() {
  const j = leagues.joined;
  let line = 'Join a league or start your own';
  if (j.length) { const rows = table(j[0]), me = rows.find((r) => r.me); line = `${ord(me.rank)} of ${rows.length} in ${leagues.info(j[0]).name}`; }
  return `<button type="button" class="fz-feat is-lg" data-open="leagues"><b>Fan leagues</b><span>${esc(line)}</span><em>${fmt(myWeek.points)} points this week${j.length > 1 ? ` · ${j.length} leagues` : ''}</em></button>`;
}

export function openGamesHub({ onPlay, onClose, open = '' } = {}) {   // (each game carries its own leaderboard now)
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
        ${derbyBand()}
        <div class="fz-feats">${cupTile()}${leagueTile()}${goalCardHTML('fz-feat is-goal')}</div>
        <h3 class="fz-sec">Mini-games <span>${tiers.allStars}/${tiers.maxStars} stars</span></h3>
        <div class="gh__grid">${GAMES_LIST.map(tile).join('')}</div>
      </div>`;
    el.querySelector('.gh__scroll').scrollTop = sc;
  };
  render();
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-on'));
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const tick = setInterval(() => { if (!el.isConnected) { clearInterval(tick); return; } const c = el.querySelector('.js-gh-dl'), d = derbyInfo(); if (c && d) c.textContent = left(d.ko - derbyNow()); }, 1000);
  const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 250); };
  // a page over the hub: the hub steps aside, back brings it back (refreshed); a game from it leaves both
  const sub = (name) => {
    el.classList.add('is-under');
    const back = () => { el.classList.remove('is-under'); render(); };
    const play = (g) => { close(); onPlay?.(g, name); };
    if (name === 'derby') openDerby({ onClose: back, onPlay: play });
    if (name === 'leagues') openLeagues({ onClose: back, onPlay: () => { el.classList.remove('is-under'); render(); } });
    if (name === 'goal') openFanGoal({ onClose: back, onPlay: play });
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.js-gh-back')) { feel.back(); close(); onClose?.(); return; }
    const t = e.target.closest('[data-tier]');
    if (t) {
      if (t.getAttribute('aria-disabled') === 'true') { feel.back(); t.classList.remove('is-shake'); void t.offsetWidth; t.classList.add('is-shake'); return; }
      feel.tap(); tiers.select(t.dataset.game, t.dataset.tier); render(); return;
    }
    const o = e.target.closest('[data-open], [data-go="goal"]');
    if (o) { feel.tap(); sub(o.dataset.open || 'goal'); return; }
    const g = e.target.closest('[data-g]'); if (!g) return;
    feel.tap(); close(); onPlay?.(g.dataset.g);
  });
  if (open) setTimeout(() => sub(open), 30);
}
// (re-exported for main.js's menu)
export { openPenaltyCup };
