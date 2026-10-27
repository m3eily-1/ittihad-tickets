// The Fan Pass (2026-10-27, the game loop): a 34-tier track, one tier per Saudi Pro League round, advanced by XP
// (300 a tier, so the last tier sits on the last legend gem, 10,200 XP). Two tracks: free for everyone, premium for
// Tiger members (club membership, sold in the club's own app; here you link it once on this device). Tiers pay Claws,
// packs and avatar items. It's the game track only: the Tigers Season Pass is the real season ticket and keeps its
// name in Tickets; nothing here calls the Fan Pass a "season pass".
//
//   fanPass.tier / .xpIn / .claimable / .member / .onChange(fn)   fanPassHTML() / fanPassClick(b) (in missions.js)
import { progress, CARD_XP } from './progress.js';
import { claws } from './economy.js';
import { grantPack } from './packs.js';
import { grantItem, owns, AVATAR_ITEMS, rwIcon, CLAW_SVG } from './rewards.js';
import { fanEvent } from './fan-events.js';
import { feel } from './feel.js';
import { RESULTS } from './results-data.js';
import { FIXTURES } from './fixtures.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const TIERS_N = 34, XP_TIER = 300;
const KEY = 'itt-fanpass-v1';
const st = (() => { try { return { free: [], prem: [], member: false, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { free: [], prem: [], member: false }; } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ } };
const subs = new Set();
const changed = () => { save(); subs.forEach((f) => { try { f(); } catch (err) { console.warn(err); } }); };

// what each tier gives. Free: Claws most tiers, a pack every five, three avatar items. Premium: more Claws, better
// packs, the two Fan Pass-only items (scarf-gold, kit-gold), the shemagh and the all-yellow kit.
const freeOf = (n) => n === 34 ? { type: 'item', id: 'kit-away' } : n === 8 ? { type: 'item', id: 'head-cap' } : n === 22 ? { type: 'item', id: 'scarf-classic' }
  : n % 10 === 0 ? { type: 'pack', kind: 'gold' } : n % 5 === 0 ? { type: 'pack', kind: 'match' } : { type: 'claws', n: 50 + 10 * Math.floor(n / 7) };
const premOf = (n) => n === 34 ? { type: 'item', id: 'kit-gold' } : n === 17 ? { type: 'item', id: 'scarf-gold' } : n === 12 ? { type: 'item', id: 'head-shemagh' } : n === 27 ? { type: 'item', id: 'kit-yellow' }
  : n % 10 === 0 ? { type: 'pack', kind: 'elite' } : n % 5 === 0 ? { type: 'pack', kind: 'gold' } : { type: 'claws', n: 100 + 25 * Math.floor(n / 7) };
export const tierReward = (n, track) => (track === 'prem' ? premOf(n) : freeOf(n));
const PACK_NAME = { match: 'Match pack', gold: 'Gold pack', elite: 'Elite pack' };
const itemName = (id) => AVATAR_ITEMS.find((a) => a.id === id)?.name || id;
const rewardLabel = (r) => (r.type === 'claws' ? `${r.n} Claws` : r.type === 'pack' ? PACK_NAME[r.kind] : itemName(r.id));

// the league round we're in: the latest Saudi Pro League round already played, from the results and fixtures
const roundOf = (m) => +(String(m.round || '').match(/Matchweek (\d+)/i)?.[1] || 0);
export function currentRound(now = Date.now()) {
  const played = [
    ...RESULTS.filter((r) => r.comp === 'rsl' && new Date(r.kickoffUTC || `${r.date}T12:00:00Z`).getTime() <= now),
    ...FIXTURES.filter((m) => m.comp === 'rsl' && m.kickoff && m.kickoff * 1000 <= now),
  ].map(roundOf);
  return Math.max(1, ...played);
}

export const fanPass = {
  get tier() { return Math.min(TIERS_N, Math.floor(progress.xp / XP_TIER)); },
  get xpIn() { return progress.xp % XP_TIER; },
  get member() { return !!st.member; },
  claimed: (n, track) => (track === 'prem' ? st.prem : st.free).includes(n),
  get claimable() {
    let k = 0; for (let n = 1; n <= this.tier; n++) { if (!st.free.includes(n)) k++; if (st.member && !st.prem.includes(n)) k++; }
    return k;
  },
  onChange(fn) { subs.add(fn); return () => subs.delete(fn); },
};
progress.on((e) => {
  if (e.type !== 'xp') return;
  if (fanPass.tier >= 10) progress.achieve('fanpass-10');
  const before = Math.floor((progress.xp - e.amount) / XP_TIER);
  if (Math.min(TIERS_N, Math.floor(progress.xp / XP_TIER)) > Math.min(TIERS_N, before)) { fanEvent('fanpass-tier', { tier: fanPass.tier }); changed(); }
});

function claim(n, track) {
  if (n > fanPass.tier || fanPass.claimed(n, track) || (track === 'prem' && !st.member)) return false;
  const r = tierReward(n, track);
  (track === 'prem' ? st.prem : st.free).push(n); save();
  const why = `Fan Pass tier ${n}`;
  if (r.type === 'claws') claws.earn(r.n, why);
  else if (r.type === 'pack') grantPack(r.kind, why);
  else if (!grantItem(r.id, why)) claws.earn(300, `${why} · ${itemName(r.id)} already yours`);
  fanEvent('fanpass-claim', { tier: n, track });
  changed();
  return true;
}

/* ── the tab (missions.js) ── */
let linking = false;
const cell = (n, track, reached) => {
  const r = tierReward(n, track), done = fanPass.claimed(n, track), locked = track === 'prem' && !st.member;
  const ic = r.type === 'claws' ? CLAW_SVG : r.type === 'pack' ? rwIcon('gift') : rwIcon(AVATAR_ITEMS.find((a) => a.id === r.id)?.slot);
  const can = reached && !done && !locked;
  return `<button type="button" class="fp-cell is-${r.type}${done ? ' is-done' : ''}${can ? ' is-ready' : ''}${locked ? ' is-locked' : ''}${r.type === 'item' && AVATAR_ITEMS.find((a) => a.id === r.id)?.pass ? ' is-excl' : ''}" data-act="fp-claim" data-n="${n}" data-t="${track}" ${can ? '' : 'disabled'} aria-label="Tier ${n}, ${track === 'prem' ? 'premium' : 'free'}: ${esc(rewardLabel(r))}${done ? ', claimed' : can ? ', ready to claim' : ''}">
    ${ic}<b>${r.type === 'claws' ? r.n : esc(r.type === 'pack' ? PACK_NAME[r.kind].replace(' pack', '') : itemName(r.id))}</b><small>${done ? 'Claimed' : can ? 'Claim' : locked ? 'Members' : r.type === 'claws' ? 'Claws' : r.type === 'pack' ? 'Pack' : 'Avatar'}</small></button>`;
};
export function fanPassHTML() {
  const t = fanPass.tier, round = currentRound(), gems = new Map(CARD_XP.map((x, i) => [Math.ceil(x / XP_TIER), i]));
  const k = fanPass.claimable;
  const head = `<section class="ec-pan fp-hd">
      <div class="fp-hd__t"><p class="ec-h">Fan Pass · 26/27</p><p class="fp-hd__tier"><b>${t}</b><span>of ${TIERS_N}</span></p>
        <div class="fp-hd__bar"><i style="width:${t >= TIERS_N ? 100 : (fanPass.xpIn / XP_TIER) * 100}%"></i></div>
        <p class="fp-hd__n">${t >= TIERS_N ? 'Every tier reached' : `${XP_TIER - fanPass.xpIn} XP to tier ${t + 1}`} · the league is in round ${round} of ${TIERS_N}</p></div>
      <div class="fp-hd__r">${k ? `<button type="button" class="mc__btn" data-act="fp-all">Claim all · ${k}</button>` : ''}
        ${st.member ? '<p class="fp-mem is-on">✓ Tiger member · premium track on</p>' : `<button type="button" class="mc__btn is-2" data-act="fp-link">Link your Tiger membership</button>`}</div>
    </section>`;
  const sheet = linking ? `<div class="ec-sheet" role="dialog" aria-label="Link membership"><div class="ec-sheet__card">
      <h3>Link membership</h3><p class="ec-sheet__p">Tiger members (Tiger, Tiger Plus or Tiger Legend, joined in the Al-Ittihad app) get the premium track: more Claws, Gold and Elite packs, and two Fan Pass-only avatar items. Every tier you've reached opens straight away.</p>
      <div class="ec-sheet__btns"><button type="button" class="mc__btn" data-act="fp-yes">I'm a member · link it</button><button type="button" class="mc__btn is-2" data-act="fp-no">Not now</button></div></div></div>` : '';
  const cols = Array.from({ length: TIERS_N }, (_, i) => i + 1).map((n) => `<div class="fp-col${n <= t ? ' is-on' : ''}${n === t + 1 ? ' is-next' : ''}${n === round ? ' is-round' : ''}" data-tier="${n}">
      <p class="fp-col__n"><b>${n}</b>${gems.has(n) ? '<i class="lc-gem" title="A legend gem unlocks here" aria-label="Legend gem"></i>' : ''}</p>
      ${cell(n, 'free', n <= t)}${cell(n, 'prem', n <= t)}
      <p class="fp-col__r">${n === round ? 'This round' : `R${n}`}</p></div>`).join('');
  return `<div class="fp">${head}
    <div class="fp-track"><div class="fp-lanes" aria-hidden="true"><span>Free</span><span>Premium</span></div><div class="fp-scroll js-fp-scroll">${cols}</div></div>
    <p class="mc__fine">Every 300 XP is a tier: missions, match weeks, predictions and the mini-games all count. Gems mark where a legend unlocks. The Fan Pass is this app's game track, not a ticket: the Tigers Season Pass for every home match is in Tickets.</p>
    ${sheet}</div>`;
}
export function fanPassClick(b) {
  const a = b.dataset.act; if (!a?.startsWith('fp-')) return false;
  if (a === 'fp-claim') { if (claim(+b.dataset.n, b.dataset.t)) feel.win(); return true; }
  if (a === 'fp-all') { let k = 0; for (let n = 1; n <= fanPass.tier; n++) { if (claim(n, 'free')) k++; if (claim(n, 'prem')) k++; } if (k) { feel.win(); feel.confetti({ n: 120 }); } return true; }
  if (a === 'fp-link') { feel.tap(); linking = true; return true; }
  if (a === 'fp-no') { feel.back(); linking = false; return true; }
  if (a === 'fp-yes') { linking = false; st.member = true; changed(); feel.win(); fanEvent('membership-link', {}); return true; }
  return false;
}
export const fanPassSheetOpen = () => linking;
export function closeFanPassSheet() { linking = false; }

