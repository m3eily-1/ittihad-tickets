// The Weekly Penalty Cup (2026-10-27): a knockout of eight — you and seven sample fans — drawn fresh every Sunday.
// Quarter-final, semi-final, final: each tie is five penalties in the penalty game (penalty.js, opts.cup) against
// the keeper of that round's tier, and you have to score more than your opponent's score (level → sudden death).
// Lose and you're out until next week; the rest of the bracket plays itself out (seeded by the week). The champion
// gets Claws, XP and a share card. (Not the SPL Cup, which stays hidden — this is the arcade's own weekly cup.)
import { fanEvent } from './fan-events.js';
import { claws } from './economy.js';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { fzPage } from './fz-ui.js';
import { openShare } from './share-card.js';
import { TIER_LABEL } from './tiers.js';
import { load, save, esc, left, rng, hash, pickNames, weekIndex, weekEnd, weekLabel } from './fz-core.js';

const KEY = 'itt-pcup-v1';
export const ROUNDS = [
  { id: 'qf', label: 'Quarter-final', short: 'QF', tier: 'rookie', lo: 4, hi: 7, claws: 15, xp: 40 },
  { id: 'sf', label: 'Semi-final', short: 'SF', tier: 'pro', lo: 6, hi: 9, claws: 25, xp: 60 },
  { id: 'f', label: 'Final', short: 'Final', tier: 'pro', lo: 7, hi: 10, claws: 100, xp: 150 },
];
const fresh = (w) => ({ w, res: [], champ: false, shared: false });
let st = load(KEY, null);
const cur = () => { const w = weekIndex(); if (!st || st.w !== w) { st = fresh(w); save(KEY, st); } return st; };
const persist = () => save(KEY, st);

/* the week's draw: eight players (you are slot 0), each sample fan with a level; the matches you're not in are
   played by the seed — a better player usually, not always, goes through, by a believable penalty score */
function draw(w = weekIndex()) {
  const r = rng(hash(`pcup|${w}`));
  const names = pickNames(`pcup|${w}`, 7);
  const players = [{ name: progress.name || 'You', me: true, skill: 0 }, ...names.map((name) => ({ name, skill: 0.25 + r() * 0.75 }))];
  // your opponents' scores in each round you reach, inside that round's range
  const target = ROUNDS.map((R) => R.lo + Math.floor(r() * (R.hi - R.lo + 1)));
  return { players, target, r };
}
function sim(a, b, r) {
  const sa = 5 + Math.round(a.skill * 6 + r() * 4), sb = 5 + Math.round(b.skill * 6 + r() * 4);
  if (sa === sb) { const aw = r() < 0.5 + (a.skill - b.skill) * 0.4; return { win: aw ? a : b, sa: aw ? sa + 1 : sa, sb: aw ? sb : sb + 1, sd: true }; }
  return { win: sa > sb ? a : b, sa, sb };
}
/* the whole bracket as it stands: rounds of matches { a, b, sa, sb, win, played } */
export function bracket() {
  const s = cur(), { players, target } = draw(s.w);
  const rounds = [];
  let alive = players;
  ROUNDS.forEach((R, k) => {
    const ms = [];
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i], b = alive[i + 1];
      if (!a || !b) continue;
      if (a.me || b.me) {
        const opp = a.me ? b : a, res = s.res[k];
        ms.push({ a, b, me: true, opp, target: target[k], played: !!res, sa: res?.score, sb: target[k], win: res ? (res.won ? (a.me ? a : b) : opp) : null, sd: res?.sd });
      } else { const m = sim(a, b, rng(hash(`pcup|${s.w}|${a.name}|${b.name}`))); ms.push({ a, b, ...m, played: true }); }
    }
    rounds.push(ms);
    alive = ms.map((m) => m.win || (m.me ? { ...players[0], pending: true } : null)).filter(Boolean);
  });
  return { rounds, target, players };
}
export const cup = {
  get state() { return cur(); },
  // where you are: the round to play (0–2), 'out', or 'champ'
  get stage() { const s = cur(); if (s.champ) return 'champ'; if (s.res.some((x) => !x.won)) return 'out'; return s.res.length; },
  next() { const s = this.stage; if (typeof s !== 'number') return null; const b = bracket(); const m = b.rounds[s].find((x) => x.me); return { round: s, ...ROUNDS[s], opp: m.opp.name, target: m.target }; },
  // a round's result from the pitch
  result(round, r) {
    const s = cur();
    if (r.abandoned && !r.shots) return null;   // left before a kick: not played
    if (s.res.length !== round) return null;
    s.res.push({ score: r.score, won: !!r.won && !r.abandoned, sd: !!r.sd, at: Date.now() });
    const R = ROUNDS[round], won = s.res[round].won;
    fanEvent('cup-match', { round: R.id, won });
    if (won) {
      progress.award(R.xp, `Penalty Cup · ${R.label}`);
      claws.earn(R.claws, `Penalty Cup · ${R.label} won`);
      if (round === ROUNDS.length - 1) { s.champ = true; fanEvent('cup-win', { week: s.w }); }
    }
    persist();
    return s.res[round];
  },
};

/* ── the page: the bracket (QF · SF · Final · Champion), your next tie and its button ── */
export function openPenaltyCup({ onClose, onPlay, flash = null } = {}) {
  const p = fzPage({ cls: 'fz-cup', title: 'Penalty Cup', label: 'Weekly Penalty Cup', onClose });
  const chip = () => p.chip(`<span>Ends in</span><b>${left(weekEnd() - Date.now())}</b>`);
  // mask: the ties before this round aren't played yet, so who comes through stays hidden; showT: the score to beat
  const pl = (x, m, side, { mask = false, showT = false } = {}) => {
    const won = m.played && m.win === x, me = x.me && !x.pending;
    const sc = m.played ? (side === 'a' ? m.sa : m.sb) : '';
    const name = x.pending || (mask && !me) ? 'Winner of a tie' : me ? (progress.name ? `${x.name} (you)` : 'You') : x.name;
    return `<p class="fz-bk__p${me ? ' is-me' : ''}${won ? ' is-win' : m.played ? ' is-lose' : ''}"><b>${esc(name)}</b>${sc !== '' && sc != null ? `<em>${sc}</em>` : showT && !x.me ? `<em class="is-t">${m.target}</em>` : ''}</p>`;
  };
  const render = () => {
    const b = bracket(), stage = cup.stage, nx = cup.next(), s = cur();
    // ties you're not in show once your own tie in that round is played (or you're out)
    const reveal = (k) => stage === 'out' || stage === 'champ' || (typeof stage === 'number' && stage > k);
    const champ = stage === 'champ' ? b.rounds[2][0] : null;
    const finalWinner = reveal(2) ? b.rounds[2][0]?.win : null;
    const head = stage === 'champ'
      ? `<div class="fz-hero is-win"><div><h3>Champion</h3><p>You won this week's cup${champ ? ` · ${champ.sa}–${champ.sb} in the final` : ''}. +${ROUNDS.reduce((a, R) => a + R.claws, 0)} Claws across the three rounds.</p></div><button type="button" class="sc-btn" data-act="share">Share your win</button></div>`
      : stage === 'out'
        ? `<div class="fz-hero"><div><h3>Knocked out in the ${esc(ROUNDS[s.res.length - 1].label.toLowerCase())}</h3><p>${finalWinner ? `${esc(finalWinner.name)} won the cup. ` : ''}A new draw opens on Sunday — in ${left(weekEnd() - Date.now())}.</p></div></div>`
        : `<div class="fz-hero"><div><h3>${esc(nx.label)} vs ${esc(nx.opp)}</h3><p>${esc(nx.opp.split(' ')[0])} scored <b>${nx.target}</b>. Score more in five penalties against a ${TIER_LABEL[nx.tier]} keeper; level goes to sudden death. Win: +${nx.claws} Claws.</p></div><button type="button" class="sc-btn" data-act="play">Take the penalties</button></div>`;
    const col = (k) => {
      const R = ROUNDS[k];
      const mask = k > 0 && !reveal(k - 1);
      return `<div class="fz-bk__col"><h4>${esc(R.label)}<small>${TIER_LABEL[R.tier]} keeper</small></h4><div class="fz-bk__ms">${b.rounds[k].map((m) => {
        const hide = !m.me && !reveal(k);
        const mm = hide ? { ...m, played: false } : m;
        const o = { mask, showT: m.me && !m.played && stage === k };
        return `<div class="fz-bk__m${m.me && !m.a.pending ? ' is-mine' : ''}">${pl(m.a, mm, 'a', o)}${pl(m.b, mm, 'b', o)}${m.played && m.sd && !hide ? '<i>after sudden death</i>' : ''}</div>`;
      }).join('')}</div></div>`;
    };
    p.body.innerHTML = `${head}<div class="fz-bk" role="group" aria-label="Bracket">${col(0)}${col(1)}${col(2)}
      <div class="fz-bk__col is-champ"><h4>Champion<small>${esc(weekLabel())}</small></h4><div class="fz-bk__ms"><div class="fz-bk__m${stage === 'champ' ? ' is-mine' : ''}"><p class="fz-bk__p${finalWinner ? ' is-win' : ''}"><b>${esc(finalWinner ? (finalWinner.me ? (progress.name || 'You') : finalWinner.name) : '?')}</b></p></div>
        <p class="fz-note">Champion: +${ROUNDS[2].claws} Claws and ${ROUNDS[2].xp} XP. Each tie won: +${ROUNDS[0].claws} / +${ROUNDS[1].claws} Claws.</p></div></div></div>
      <p class="fz-note">Eight fans, drawn every Sunday. Your opponents' scores are set when the draw is made; the other ties play out as you go.</p>`;
    chip();
  };
  render();
  p.every(chip, 1000);
  if (flash) setTimeout(() => {
    p.toast(flash.won ? `You're through · ${flash.score}–${flash.target}${flash.sd ? ' after sudden death' : ''}` : flash.abandoned ? 'You left the tie — it counts as a loss' : `Out · ${flash.score}–${flash.target}`);
    if (flash.won) { feel.win(); if (cup.stage === 'champ') { feel.roar(); feel.confetti({ n: 200 }); } }
  }, 350);
  p.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    feel.tap();
    if (b.dataset.act === 'play') {
      const nx = cup.next(); if (!nx) return;
      p.close({ silent: true });
      onPlay?.({ tier: nx.tier, cup: { target: nx.target, opp: nx.opp.split(' ')[0], label: nx.label }, round: nx.round });
    }
    if (b.dataset.act === 'share') {
      const f = bracket().rounds[2][0];
      openShare({ kind: 'cup', opp: f?.opp?.name, score: f?.sa, target: f?.sb, week: cur().w });
    }
  });
  return p;
}
