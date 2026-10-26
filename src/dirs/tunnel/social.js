// Friends leaderboard and challenge links (Ahmed, 2026-10-21). There's no server behind this demo, so a challenge
// travels in the link itself: tunnel.html?challenge=<name, game, score>. Opening one adds that friend to your
// board (in this browser) and puts "beat it" on the main menu; beating it shows on the board.
import './social.css';
import { progress } from './progress.js';
import { feel } from './feel.js';

export const GAME_LABEL = { penalties: 'Penalties', freekick: 'Free kicks', crossbar: 'Crossbar challenge', keeper: 'Keeper mode', keepy: 'Keepy-uppy', quiz: 'Legends quiz' };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = (s) => { try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return null; } };

// a challenge in this page's link, if any (read once)
export function incomingChallenge() {
  const raw = new URLSearchParams(location.search).get('challenge');
  const c = raw && dec(raw);
  if (!c || !GAME_LABEL[c.g] || !(c.s >= 0) || !c.n) return null;
  const ch = { name: String(c.n).slice(0, 20), game: c.g, score: Math.min(999, Math.round(c.s)) };
  progress.addFriend(ch);
  return ch;
}
export function challengeUrl(game, score) {
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('challenge', enc({ n: progress.name || 'A friend', g: game, s: score }));
  return u.toString();
}

/* share: ask your name once, then the system share sheet (phones) or copy the link */
export function shareChallenge(game, score) {
  const box = document.createElement('div');
  box.className = 'sc-modal';
  box.innerHTML = `<div class="sc-card" role="dialog" aria-label="Challenge a friend">
    <p class="sc-k">Challenge a friend</p><h3>${esc(GAME_LABEL[game])}: <em>${score}</em></h3>
    <label class="sc-name">Your name<input class="js-sc-name" maxlength="20" value="${esc(progress.name)}" placeholder="e.g. Ahmed"/></label>
    <div class="sc-row"><button type="button" class="sc-btn js-sc-go">Send challenge</button><button type="button" class="sc-btn is-ghost js-sc-x">Cancel</button></div>
    <p class="sc-out js-sc-out" hidden></p></div>`;
  document.body.append(box);
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart', 'keydown']) box.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const close = () => box.remove();
  box.querySelector('.js-sc-x').addEventListener('click', () => { feel.back(); close(); });
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  box.querySelector('.js-sc-go').addEventListener('click', async () => {
    feel.tap();
    progress.name = box.querySelector('.js-sc-name').value.trim() || 'A friend';
    const url = challengeUrl(game, score), text = `I scored ${score} in ${GAME_LABEL[game]} at the Al-Ittihad stadium. Can you beat me?`;
    progress.achieve('challenge');
    try { if (navigator.share) { await navigator.share({ title: 'Beat my score', text, url }); close(); return; } } catch { /* cancelled: fall back to copy */ }
    let copied = false; try { await navigator.clipboard.writeText(`${text} ${url}`); copied = true; } catch { /* no clipboard */ }
    const out = box.querySelector('.js-sc-out'); out.hidden = false;
    out.innerHTML = `${copied ? 'Link copied. Paste it to a friend:' : 'Send this link to a friend:'}<input readonly value="${esc(url)}"/>`;
    out.querySelector('input').select();
  });
  setTimeout(() => box.querySelector('.js-sc-name').focus(), 50);
}

// sample fans on every board (Ahmed, 2026-10-22: "add a few sample fans with real names"): realistic Saudi names
// for made-up fans — not real people — and the board says they're samples. Scores sit in each game's own range.
const SAMPLE = {
  penalties: [['Faisal Al-Harbi', 13], ['Noura Al-Qahtani', 12], ['Omar Al-Ghamdi', 10], ['Reem Al-Zahrani', 9], ['Yousef Al-Otaibi', 7]],
  freekick: [['Khalid Al-Mutairi', 11], ['Sara Al-Shehri', 9], ['Abdullah Al-Dosari', 8], ['Lama Al-Subaie', 6], ['Turki Al-Anazi', 5]],
  crossbar: [['Majed Al-Malki', 6], ['Hessa Al-Rashid', 5], ['Nawaf Al-Juhani', 4], ['Dana Al-Saud', 3]],
  keeper: [['Saud Al-Shammari', 4], ['Ghada Al-Amri', 3], ['Rakan Al-Hazmi', 3], ['Maha Al-Baqami', 2]],
  keepy: [['Hamad Al-Zahrani', 34], ['Jana Al-Ghamdi', 27], ['Bandar Al-Harthi', 21], ['Layan Al-Qurashi', 16], ['Ziyad Al-Johani', 12]],
  quiz: [['Mishal Al-Sulami', 5], ['Rawan Al-Maliki', 5], ['Salem Al-Bishi', 4], ['Areej Al-Harbi', 4], ['Fahad Al-Omari', 3]],
};
/* the board: you and your friends, per game. With `game` it's that game's own board, opened from inside the game
   (Ahmed, 2026-10-22: "the leaderboard should be inside each game"): no game tabs, no "Play", above the game. */
export function openFriends({ onClose, onPlay, game = null } = {}) {
  const el = document.createElement('div');
  el.className = `sc-board${game ? ' is-ingame' : ''}`;
  let tab = game && GAME_LABEL[game] ? game : 'penalties';
  const render = () => {
    const rows = [{ name: progress.name || 'You', score: progress.best(tab), me: true }, ...progress.friends.filter((f) => f.game === tab), ...(SAMPLE[tab] || []).map(([name, score]) => ({ name, score, sample: true }))].sort((a, b) => b.score - a.score);
    el.innerHTML = `<header class="sc-hd"><button type="button" class="sc-back js-sc-back">← Back</button><div><h2>${game ? `${esc(GAME_LABEL[tab])} leaderboard` : 'Leaderboard'}</h2></div></header>
      ${game ? '' : `<nav class="sc-tabs">${Object.entries(GAME_LABEL).map(([k, l]) => `<button type="button" data-t="${k}" class="${k === tab ? 'is-on' : ''}">${l}</button>`).join('')}</nav>`}
      <ol class="sc-list">${rows.map((r, i) => `<li class="${r.me ? 'is-me' : ''}"><span>${i + 1}</span><b>${esc(r.name)}${r.me ? ' <em>you</em>' : ''}</b><strong>${r.score}</strong></li>`).join('')}</ol>

      <div class="sc-row"><button type="button" class="sc-btn js-sc-ch">Challenge a friend</button>${game ? '' : `<button type="button" class="sc-btn is-ghost js-sc-play">Play ${GAME_LABEL[tab]}</button>`}</div>
      <p class="sc-note">Your scores are kept in this browser; friends appear when you open their challenge links.</p>`;
  };
  render();
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-on'));
  for (const ev of ['wheel', 'pointerdown', 'touchmove', 'touchstart']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]'); if (t) { feel.tap(); tab = t.dataset.t; render(); return; }
    if (e.target.closest('.js-sc-back')) { feel.back(); el.classList.remove('is-on'); setTimeout(() => el.remove(), 250); onClose?.(); return; }   // the app's 0.25 s fade
    if (e.target.closest('.js-sc-ch')) { feel.tap(); shareChallenge(tab, progress.best(tab)); return; }
    if (e.target.closest('.js-sc-play')) { feel.tap(); el.remove(); onPlay?.(tab); }
  });
}
