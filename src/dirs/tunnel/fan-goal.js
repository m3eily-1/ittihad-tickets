// The fanbase goal (2026-10-27): one target the whole fanbase chases each week — "Tigers fans score 1,000,000
// penalties" — and a reward the stands share: the stadium tifo goes up at the next home game. The fanbase's count is
// simulated (seeded by the week, rising through it; some weeks it falls short), your own penalty goals are added,
// and if it's reached and you helped, you collect 50 Claws. (The 3D stadium's tifo is up anyway; this page only
// presents the goal and its reward state.)
import { FIXTURES } from './fixtures.js';
import { claws } from './economy.js';
import { feel } from './feel.js';
import { fzPage, meter } from './fz-ui.js';
import { load, save, esc, fmt, left, rand, weekIndex, weekEnd, weekCurve, weekLabel, myWeek, DATE } from './fz-core.js';

export const TARGET = 1000000;
const KEY = 'itt-fangoal-v1';
const st = { claimed: [], ...load(KEY, {}) };

export function goalState(w = weekIndex(), t = Date.now()) {
  const pace = 0.9 + rand(`goal|${w}`) * 0.24;   // how this week's fanbase is going: 90–114 % of the target by Saturday
  const fans = Math.round(TARGET * pace * weekCurve('goal', w, Math.min(t, weekEnd(w))));
  const mine = myWeek.goalsIn(w), total = fans + mine;
  const done = total >= TARGET;
  // the reward lands at the first home game after the goal week closes
  const reward = FIXTURES.find((m) => m.kickoff && m.kickoff * 1000 > weekEnd(w)) || null;
  return { w, total, mine, done, k: Math.min(1, total / TARGET), reward, ends: weekEnd(w), over: t >= weekEnd(w) };
}
export const fanGoal = {
  get now() { return goalState(); },
  get last() { return goalState(weekIndex() - 1); },
  canClaim(g) { return g.done && g.mine > 0 && !st.claimed.includes(g.w); },
  claim(g) { if (!this.canClaim(g)) return false; st.claimed.push(g.w); save(KEY, st); claws.earn(50, 'Fanbase goal reached'); return true; },
};
const rewardText = (g) => (g.reward ? `the tifo goes up vs ${g.reward.opp}, ${DATE.format(g.reward.kickoff * 1000)}` : 'the tifo goes up at the next home game');

/* a compact card for the games hub and the community */
export function goalCardHTML(cls = '') {
  const g = goalState();
  return `<button type="button" class="fz-goalcard ${cls}" data-go="goal"><b>Fanbase goal</b><span>${fmt(g.total)} / ${fmt(TARGET)} penalties</span>${meter(g.k)}<em>${g.done ? 'Reached · ' : ''}${Math.floor(g.k * 100)}% · ${left(g.ends - Date.now())} left</em></button>`;
}

export function openFanGoal({ onClose, onPlay } = {}) {
  const p = fzPage({ cls: 'fz-goal', title: 'Fanbase goal', onClose });
  const render = () => {
    const g = goalState(), last = goalState(weekIndex() - 1);
    p.chip(`<span>Ends in</span><b>${left(g.ends - Date.now())}</b>`);
    const lastClaim = fanGoal.canClaim(last), claim = fanGoal.canClaim(g);
    p.body.innerHTML = `
      ${lastClaim ? `<div class="fz-hero is-win"><div><h3>Last week's goal was reached</h3><p>${fmt(last.total)} penalties, ${last.mine} of them yours.</p></div><button type="button" class="sc-btn" data-act="claim" data-w="last">Collect 50 Claws</button></div>` : ''}
      <section class="fz-panel fz-goal__main">
        <h3>${fmt(TARGET)} penalties this week</h3>
        <p class="fz-goal__sub">Tigers fans together, ${esc(weekLabel())}. Reach it and ${esc(rewardText(g))}.</p>
        <p class="fz-goal__num"><b>${fmt(g.total)}</b><span>${Math.floor(g.k * 100)}%</span></p>
        ${meter(g.k, { cls: 'is-big' })}
        <dl class="fz-stats"><div><dt>Your goals</dt><dd>${fmt(g.mine)}</dd></div><div><dt>Still to score</dt><dd>${fmt(Math.max(0, TARGET - g.total))}</dd></div><div><dt>Reward</dt><dd>${g.done ? 'Unlocked' : 'Locked'}</dd></div></dl>
        <div class="fz-reward${g.done ? ' is-on' : ''}"><b>${g.done ? 'Unlocked' : 'The reward'}</b><span>The tifo display in the stands${g.reward ? ` at Al-Ittihad vs ${esc(g.reward.opp)}, ${esc(DATE.format(g.reward.kickoff * 1000))}` : ''}${g.done ? '' : ' — once the count passes the line'}. Everyone who scored at least one: +50 Claws.</span></div>
        <div class="fz-row">${claim ? '<button type="button" class="sc-btn" data-act="claim" data-w="now">Collect 50 Claws</button>' : ''}${onPlay ? `<button type="button" class="sc-btn${claim ? ' is-ghost' : ''}" data-act="play">Score penalties</button>` : ''}</div>
        <p class="fz-note">Every penalty you score counts — in Penalties and in the Penalty Cup.</p>
      </section>`;
  };
  render();
  p.every(render, 5000);
  p.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    feel.tap();
    if (b.dataset.act === 'claim') { if (fanGoal.claim(b.dataset.w === 'last' ? goalState(weekIndex() - 1) : goalState())) { feel.win(); p.toast('+50 Claws'); } render(); return; }
    if (b.dataset.act === 'play') { p.close({ silent: true }); onPlay?.('penalties'); }
  });
  return p;
}
