// Fan leagues (2026-10-27): play against people, not just a board. Create a private league (it gets a short code to
// pass on) or join one with a code; or join a public one (Jeddah Tigers, Ultras Section, Family Stand). Each league
// has a weekly table built from mini-game and prediction points (fz-core.js pointsOf): your best score this week in
// each game, times its tier, plus 25 a predicted score. Weeks run Sunday to Saturday; when one ends, a top-half
// finish earns Claws. The other members are sample fans whose points rise through the week (seeded by date).
import { fanEvent } from './fan-events.js';
import { claws } from './economy.js';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { fzPage } from './fz-ui.js';
import { load, save, esc, fmt, left, hash, rng, rand, pickNames, weekIndex, weekStart, weekEnd, weekCurve, weekLabel, myWeek, DAY } from './fz-core.js';

const KEY = 'itt-leagues-v1';
export const PUBLIC = [
  { code: 'JED-TGR', name: 'Jeddah Tigers', size: 24, about: 'Tigers fans across Jeddah' },
  { code: 'ULT-SEC', name: 'Ultras Section', size: 18, about: 'For the ones behind the goal' },
  { code: 'FAM-STD', name: 'Family Stand', size: 14, about: 'Families who go to games together' },
];
const PRIZE = [75, 50, 30];   // Claws for 1st, 2nd, 3rd; the rest of the top half get 15
const st = { joined: [], own: {}, settled: weekIndex() - 1, last: null, ...load(KEY, {}) };
const persist = () => save(KEY, st);

const norm = (c) => { const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 6 ? `${s.slice(0, 3)}-${s.slice(3)}` : null; };
const ALNUM = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => { const r = rng(hash(`${Date.now()}|${Math.random()}`)); let s = ''; for (let i = 0; i < 6; i++) s += ALNUM[Math.floor(r() * ALNUM.length)]; return `${s.slice(0, 3)}-${s.slice(3)}`; };

/* a sample member's points: a steady level per fan (some play a lot), a little different each week, stepping up
   through the week as they play (weekCurve) */
export function memberPts(name, w, t = Date.now()) {
  const skill = rand(`skill|${name}`), wk = rand(`wk|${name}|${w}`);
  const final = 90 + Math.pow(skill, 0.8) * 640 * (0.7 + 0.6 * wk);
  return Math.round(final * weekCurve(`pts|${name}`, w, t));
}
function info(code) {
  const pub = PUBLIC.find((p) => p.code === code);
  if (pub) return { ...pub, kind: 'public' };
  const own = st.own[code];
  if (own) return { code, name: own.name, at: own.at, kind: own.mine ? 'mine' : 'private' };
  return { code, name: `League ${code}`, kind: 'private' };
}
// who's in it at time t: public ones are full; one you made fills up as your invites are taken; a code you joined is set
const JOIN_MIN = [0.5, 3, 12, 40, 120, 300, 700];
function members(code, t = Date.now()) {
  const L = info(code);
  if (L.kind === 'public') return pickNames(`lg|${code}`, L.size - 1).map((name) => ({ name }));
  const names = pickNames(`lg|${code}`, L.kind === 'mine' ? JOIN_MIN.length : 4 + (hash(code) % 5));
  if (L.kind !== 'mine') return names.map((name) => ({ name }));
  return names.map((name, i) => ({ name, joined: L.at + JOIN_MIN[i] * 60e3 })).filter((m) => m.joined <= t);
}
export function table(code, w = weekIndex(), t = Date.now()) {
  const me = progress.name || 'You';
  const at = Math.min(t, weekEnd(w));
  const rows = members(code, at).map((m) => ({ name: m.name, pts: memberPts(m.name, w, at), prev: memberPts(m.name, w, at - DAY) }));
  rows.push({ name: me, me: true, pts: myWeek.pointsIn(w), prev: null });
  rows.sort((a, b) => b.pts - a.pts || (a.me ? -1 : b.me ? 1 : 0));
  // yesterday's order, for the arrows (sample fans only; you move as you play)
  const prevOrder = [...rows].filter((r) => !r.me).sort((a, b) => b.prev - a.prev).map((r) => r.name);
  rows.forEach((r, i) => { r.rank = i + 1; if (!r.me && at - DAY > weekStart(w)) r.move = prevOrder.indexOf(r.name) - rows.filter((x) => !x.me).indexOf(r); });
  return rows;
}
export const leagues = {
  get joined() { return st.joined.slice(); },
  info,
  has: (code) => st.joined.includes(code),
  join(raw, name = '') {
    const code = norm(raw); if (!code) return null;
    if (!st.joined.includes(code)) {
      st.joined.push(code);
      if (!PUBLIC.some((p) => p.code === code) && !st.own[code]) st.own[code] = { name: name ? String(name).slice(0, 24) : `League ${code}`, at: Date.now() };
      persist(); fanEvent('league-join', { code });
      if (st.joined.length === 1) progress.award(30, 'First fan league');
    }
    return code;
  },
  leave(code) { st.joined = st.joined.filter((c) => c !== code); persist(); },
  create(name) {
    const code = newCode();
    st.own[code] = { name: String(name || '').trim().slice(0, 24) || `${progress.name || 'My'} league`, at: Date.now(), mine: true };
    st.joined.push(code); persist(); fanEvent('league-join', { code, created: true });
    return code;
  },
  inviteUrl(code) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('league', `${code}~${info(code).name}`); return u.toString(); },
  // league-mates' best score in a game (for the in-game Friends board): a level that fits the game, seeded per fan
  mates() { const out = new Map(); for (const c of st.joined) if (info(c).kind !== 'public') members(c).forEach((m) => out.set(m.name, c)); return [...out.keys()]; },
  get last() { return st.last; },
};

/* a week that's over: each league's final table; top half earns Claws (once) */
export function settle() {
  const w = weekIndex() - 1;
  if (st.settled >= w) return;
  st.settled = w;
  const mine = myWeek.pointsIn(w);
  if (mine > 0 && st.joined.length) {
    const res = st.joined.map((code) => {
      const rows = table(code, w, weekEnd(w)), r = rows.find((x) => x.me);
      const n = r.rank <= 3 ? PRIZE[r.rank - 1] : r.rank <= Math.ceil(rows.length / 2) ? 15 : 0;
      if (n) claws.earn(n, `${info(code).name} · finished ${r.rank}`);
      return { code, name: info(code).name, rank: r.rank, of: rows.length, claws: n };
    });
    st.last = { w, res, seen: false };
  }
  persist();
}

// a join link: tunnel.html?league=CODE~Name
{
  const raw = new URLSearchParams(location.search).get('league');
  if (raw) { const [c, ...n] = raw.split('~'); const code = leagues.join(c, n.join('~')); if (code) st.pendingOpen = code; }
}
setTimeout(settle, 1500);   // after the app's Claws pop-up is listening

/* ── the page ── */
const ord = (n) => `${n}${[, 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10] || 'th'}`;
export function openLeagues({ onClose, onPlay, code: open = '' } = {}) {
  settle();
  const p = fzPage({ cls: 'fz-lg', title: 'Fan leagues', onClose });
  let sel = open || st.pendingOpen || st.joined[0] || PUBLIC[0].code; st.pendingOpen = null;
  let form = '';   // '' | 'create' | 'join'
  const chip = () => p.chip(`<span>Week ends</span><b>${left(weekEnd() - Date.now())}</b>`);
  const row = (code) => {
    const L = info(code), rows = table(code), me = rows.find((r) => r.me);
    return `<li><button type="button" class="fz-lg__it${code === sel ? ' is-on' : ''}" data-sel="${esc(code)}"><span class="fz-lg__mono" aria-hidden="true">${esc(L.name.replace(/^League /, '').slice(0, 2).toUpperCase())}</span>
      <span class="fz-lg__nm"><b>${esc(L.name)}</b><em>${L.kind === 'public' ? 'Public' : 'Private'} · ${rows.length} fan${rows.length === 1 ? '' : 's'}${leagues.has(code) ? '' : ' · tap to see'}</em></span>
      ${leagues.has(code) ? `<strong>${ord(me.rank)}</strong>` : ''}</button></li>`;
  };
  const list = () => {
    const mine = st.joined, pub = PUBLIC.filter((x) => !mine.includes(x.code));
    return `<section class="fz-panel fz-lg__list">
      <h3>Your leagues</h3>
      ${mine.length ? `<ul>${mine.map((c) => row(c)).join('')}</ul>` : '<p class="fz-empty">You\'re not in a league yet. Join a public one or start your own.</p>'}
      ${form === 'create' ? `<form class="fz-form" data-form="create"><label>League name<input name="n" maxlength="24" placeholder="e.g. Office Tigers" autocomplete="off"/></label><div class="fz-row"><button type="submit" class="sc-btn">Create</button><button type="button" class="sc-btn is-ghost" data-act="form" data-v="">Cancel</button></div></form>`
        : form === 'join' ? `<form class="fz-form" data-form="join"><label>League code<input name="c" maxlength="7" placeholder="ABC-123" autocomplete="off" autocapitalize="characters"/></label><div class="fz-row"><button type="submit" class="sc-btn">Join</button><button type="button" class="sc-btn is-ghost" data-act="form" data-v="">Cancel</button></div></form>`
        : `<div class="fz-row"><button type="button" class="sc-btn" data-act="form" data-v="create">Create a league</button><button type="button" class="sc-btn is-ghost" data-act="form" data-v="join">Join with a code</button></div>`}
      ${pub.length ? `<h3>Public leagues</h3><ul>${pub.map((x) => row(x.code)).join('')}</ul>` : ''}
    </section>`;
  };
  const detail = () => {
    const L = info(sel), rows = table(sel), inIt = leagues.has(sel);
    const shown = inIt ? rows : rows.filter((r) => !r.me);
    return `<section class="fz-panel fz-lg__det">
      <div class="fz-lg__top"><div><h3>${esc(L.name)}</h3><p>${esc(L.about || (L.kind === 'mine' ? `Your league · code ${L.code}` : `Private league · code ${L.code}`))} · week of ${esc(weekLabel())}</p></div>
        ${inIt ? (L.kind === 'public' ? '' : `<button type="button" class="sc-btn is-ghost fz-sm" data-act="invite">Invite · ${esc(L.code)}</button>`) : `<button type="button" class="sc-btn fz-sm" data-act="join" data-code="${esc(sel)}">Join</button>`}</div>
      <ol class="fz-table">${shown.map((r, i) => `<li class="${r.me ? 'is-me' : ''}"><span>${inIt ? r.rank : i + 1}</span><b>${esc(r.name)}${r.me ? ' <em>you</em>' : ''}</b>
        <i class="fz-mv${r.move > 0 ? ' is-up' : r.move < 0 ? ' is-down' : ''}" aria-label="${r.move ? `${r.move > 0 ? 'up' : 'down'} ${Math.abs(r.move)}` : ''}">${r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : ''}</i><strong>${fmt(r.pts)}</strong></li>`).join('')}</ol>
      ${L.kind === 'mine' && rows.length < 3 ? '<p class="fz-note">Send your code to friends: they appear here as they join.</p>' : ''}
      <p class="fz-note">Points this week: your best score in each game, times its tier (Rookie ×1, Pro ×1.25, Legend ×1.5) — penalties and free kicks ×10, keepy-ups ×3 (up to 60), quiz ×30 — plus 25 for each score you predict. Top 3 win 75 / 50 / 30 Claws; the rest of the top half 15.</p>
      <div class="fz-row">${onPlay ? '<button type="button" class="sc-btn" data-act="play">Earn points</button>' : ''}${inIt && L.kind !== 'public' ? '' : ''}${inIt ? `<button type="button" class="sc-btn is-ghost" data-act="leave" data-code="${esc(sel)}">Leave</button>` : ''}</div>
    </section>`;
  };
  const lastBanner = () => {
    const l = st.last; if (!l || l.seen) return '';
    return `<div class="fz-banner"><b>Last week (${esc(weekLabel(l.w))})</b><span>${l.res.map((r) => `${esc(r.name)}: ${ord(r.rank)} of ${r.of}${r.claws ? ` · +${r.claws} Claws` : ''}`).join(' · ')}</span><button type="button" class="cl-link" data-act="seen">OK</button></div>`;
  };
  const render = () => { p.body.innerHTML = `${lastBanner()}<div class="fz-lg__grid">${list()}${detail()}</div>`; chip(); };
  render();
  p.every(() => { if (!p.el.querySelector('input:focus')) render(); else chip(); }, 30000);
  p.el.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-sel]'); if (s) { feel.tap(); sel = s.dataset.sel; render(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    feel.tap();
    if (a === 'form') { form = b.dataset.v; render(); p.body.querySelector('.fz-form input')?.focus(); return; }
    if (a === 'join') { leagues.join(b.dataset.code); p.toast(`Joined ${info(b.dataset.code).name}`); feel.win(); render(); return; }
    if (a === 'leave') { const n = info(b.dataset.code).name; leagues.leave(b.dataset.code); sel = st.joined[0] || PUBLIC[0].code; p.toast(`Left ${n}`); render(); return; }
    if (a === 'seen') { st.last.seen = true; persist(); render(); return; }
    if (a === 'play') { p.close({ silent: true }); onPlay?.(); return; }
    if (a === 'invite') {
      const url = leagues.inviteUrl(sel), text = `Join my Al-Ittihad fan league "${info(sel).name}" — code ${sel}`;
      try { if (navigator.share) { await navigator.share({ title: info(sel).name, text, url }); fanEvent('share', { kind: 'league' }); return; } } catch { /* cancelled: copy instead */ }
      try { await navigator.clipboard.writeText(`${text} ${url}`); p.toast('Invite link copied'); fanEvent('share', { kind: 'league' }); } catch { p.toast(`Your code: ${sel}`); }
    }
  });
  p.el.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.dataset.form === 'create') { const code = leagues.create(f.elements.n.value); sel = code; form = ''; feel.win(); p.toast(`League made · code ${code}`); render(); return; }
    if (f.dataset.form === 'join') {
      const code = norm(f.elements.c.value);
      if (!code) { p.toast('Codes look like ABC-123'); return; }
      leagues.join(code); sel = code; form = ''; feel.win(); p.toast(`Joined ${info(code).name}`); render();
    }
  });
  // typing in the forms shouldn't reach the 3D scene's keys
  for (const ev of ['keydown', 'keyup']) p.el.addEventListener(ev, (e) => { if (e.target.matches('input')) e.stopPropagation(); });
  return p;
}
