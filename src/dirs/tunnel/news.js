// News / inbox (Ahmed, 2026-10-21: "a page for news similar to this design" — FC Mobile's inbox): a tab rail
// (announcements, rewards, friends), the list in the middle, the open item on the right with a banner, the text
// and "Go to". Announcements are built only from what the app already knows (the next fixtures, the season pass,
// the store, the games); rewards are demo XP gifts you claim. Read / claimed state lives in this browser.
import './news.css';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { SEASON } from '../../data.js';
import { GAME_LABEL } from './social.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const ICON = {
  news: '<path d="M3 10v4h3l7 4V6L6 10z M16 9a3 3 0 0 1 0 6 M18.5 6.5a7 7 0 0 1 0 11"/>',
  mail: '<path d="M3 6h18v12H3z M3 7l9 6 9-6"/>',
  friends: '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14a6 6 0 0 1 3.5 6"/>',
  gift: '<path d="M3 10h18v4H3z M5 14h14v7H5z M12 10v11 M12 10c-2-4-6-4-6-1.5S10 10 12 10c2 0 6 1 6-1.5S14 6 12 10"/>',
  ball: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z"/>',
  ticket: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z M14 7v12"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M3 11l9-7 9 7 M5 10v10h14V10"/>',
  cart: '<path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

// the rewards: welcome gifts for this demo (XP only)
const REWARDS = [
  { id: 'r-welcome', title: 'Welcome to the tunnel', body: 'A welcome gift for your first visit. Claim it, then walk out and see the stadium.', xp: 100 },
  { id: 'r-arcade', title: 'Arcade starter pack', body: 'Something to start your mini-game run. Every game earns XP, and every XP milestone wins a rare legend.', xp: 50 },
  { id: 'r-matchday', title: 'Matchday bonus', body: 'A bonus for checking in on matchday week. Book your seats from the match cards in the tunnel.', xp: 50 },
];

export function newsItems({ matches = [] } = {}) {
  const next = matches.filter((m) => m.kind !== 'season' && m.opp).slice(0, 2);
  const A = [];
  next.forEach((m, i) => A.push({
    id: `n-match-${m.slug || m.oppShort || i}`, icon: 'ticket', title: i ? `Coming up: Al Ittihad vs ${m.oppShort || m.opp}` : `Next home match: Al Ittihad vs ${m.oppShort || m.opp}`,
    when: m.dateText || '', banner: { kind: 'match', crest: m.crest },
    body: [`${m.compLabel || 'Saudi Pro League'}${m.round ? ` · ${m.round}` : ''}.`, m.onSale ? `Tickets are on sale${m.from ? `, from SAR ${m.from}` : ''}. Pick your seat in the 3D stadium, or join the virtual queue when it opens.` : 'Tickets aren\'t on sale yet. Check back here when they open.'],
    go: 'tickets', cta: 'Book tickets',
  }));
  A.push({ id: 'n-season', icon: 'ticket', title: `${SEASON.title} ${SEASON.season}`, when: 'On sale', banner: { kind: 'img', src: '/img/season-poster.png' },
    body: [`One pass for every home match: ${SEASON.comps.join(', ')}.`, `From SAR ${SEASON.from}, at ${SEASON.venues.join(' and ')}.`], go: 'season', cta: 'Get the pass' });
  A.push({ id: 'n-arcade', icon: 'ball', title: 'New: 8 mini-games in the arcade', when: 'New', banner: { kind: 'img', src: '/img/mascot/full.webp', contain: true },
    body: ['Penalties, free kicks, the crossbar challenge, keeper mode, keepy-uppy, the legends quiz, predict the score and the tifo builder.', 'Challenge a friend with your score from the end of any round.'], go: 'games', cta: 'Play now' });
  A.push({ id: 'n-fantasy', icon: 'news', title: 'SPL Fantasy is open', when: 'New', banner: { kind: 'img', src: '/img/squad/2.png', top: true },
    body: ['Pick 15 from the whole Saudi Pro League with SAR 100m, three per club at most, then choose your captain.', 'Ratings and prices in this demo are not official.'], go: 'fantasy', cta: 'Build your XI' });
  A.push({ id: 'n-store', icon: 'news', title: 'Club store: your name on the shirt', when: 'New', banner: { kind: 'img', src: '/img/jersey/back.webp', contain: true },
    body: ['Choose a size, add a name and number or a first-team player\'s, and check out with delivery or stadium pick-up.', 'A demo store: no payment is taken.'], go: 'room:store', cta: 'Open the store' });
  A.push({ id: 'n-legends', icon: 'news', title: 'Rare legend gems', when: 'New', banner: { kind: 'img', src: '/teams/al-ittihad.png', contain: true },
    body: ['Twelve club legends to collect. One unlocks at each XP milestone, so every room, match card and game moves you closer.'], go: 'cards', cta: 'See the collection' });
  return A;
}

let root = null;
export function openNews({ matches = [], onGo, onClose } = {}) {
  const read = new Set(load('itt-news-read-v1', []));
  const claimed = new Set(load('itt-news-claimed-v1', []));
  const items = { news: newsItems({ matches }), mail: REWARDS.map((r) => ({ ...r, icon: 'gift', when: claimed.has(r.id) ? 'Claimed' : `+${r.xp} XP` })), friends: progress.friends.map((f, i) => ({ id: `f-${i}-${f.name}`, icon: 'friends', title: `${f.name} challenged you`, when: `${GAME_LABEL[f.game] || f.game} · ${f.score}`, body: [`${f.name} scored ${f.score} in ${GAME_LABEL[f.game] || f.game}. Your best is ${progress.best(f.game)}.`], go: `game:${f.game}`, cta: 'Beat it', banner: { kind: 'img', src: '/img/mascot/full.webp', contain: true } })) };
  let tab = 'news', sel = items.news[0]?.id;
  const unread = (k) => items[k].filter((it) => (k === 'mail' ? !claimed.has(it.id) : !read.has(it.id))).length;
  root?.remove();
  root = document.createElement('div');
  root.className = 'nw'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'News');
  document.body.append(root);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') close(); }, { passive: true });
  const close = () => { feel.back(); root.classList.remove('is-on'); setTimeout(() => { root?.remove(); root = null; }, 250); onClose?.(); };
  const banner = (b, it) => {
    if (!b) return `<div class="nw__ban is-gift"><span>${svg('gift')}</span><b>+${it.xp} XP</b></div>`;
    if (b.kind === 'match') return `<div class="nw__ban is-match"><img src="/teams/al-ittihad.png" alt=""/><em>VS</em>${b.crest ? `<img src="${esc(b.crest)}" alt=""/>` : ''}</div>`;
    return `<div class="nw__ban ${b.contain ? 'is-contain' : ''} ${b.top ? 'is-top' : ''}" style="background-image:url('${esc(b.src)}')"></div>`;
  };
  const render = () => {
    const list = items[tab], it = list.find((x) => x.id === sel) || list[0];
    if (it && tab !== 'mail' && !read.has(it.id)) { read.add(it.id); save('itt-news-read-v1', [...read]); }
    const head = { news: ['news', 'Announcements'], mail: ['gift', 'Rewards'], friends: ['friends', 'Friends'] }[tab];
    root.innerHTML = `<header class="nw__hd"><button type="button" class="nw__icbtn" data-act="close" aria-label="Back">${svg('back')}</button><h2>News</h2>
        <div class="nw__tr"><button type="button" class="nw__icbtn" data-act="go" data-go="cart" aria-label="Cart">${svg('cart')}</button><button type="button" class="nw__icbtn" data-act="close" aria-label="Home">${svg('home')}</button></div></header>
      <div class="nw__body">
        <nav class="nw__tabs">${[['news', 'news', 'News'], ['mail', 'gift', 'Rewards'], ['friends', 'friends', 'Friends']].map(([k, ic, l]) => `<button type="button" class="${tab === k ? 'is-on' : ''}" data-act="tab" data-k="${k}" aria-label="${l}">${svg(ic)}<span>${l}</span>${unread(k) ? `<i>${unread(k)}</i>` : ''}</button>`).join('')}</nav>
        <section class="nw__list"><p class="nw__lh">${svg(head[0])}${head[1]}</p>
          <ul>${list.map((x) => `<li><button type="button" class="${x.id === it?.id ? 'is-on' : ''}" data-act="sel" data-id="${esc(x.id)}">${svg(x.icon)}<span><b>${esc(x.title)}</b><em>${esc(x.when)}</em></span>${(tab === 'mail' ? !claimed.has(x.id) : !read.has(x.id)) ? '<i class="nw__dot"></i>' : ''}</button></li>`).join('') || '<li class="nw__empty">Nothing here yet. Friends show up when you open their challenge links.</li>'}</ul>
          ${tab === 'mail' ? `<button type="button" class="nw__all" data-act="all" ${REWARDS.every((r) => claimed.has(r.id)) ? 'disabled' : ''}>Receive all</button>` : ''}</section>
        <article class="nw__detail">${it ? `<p class="nw__dh">${svg(it.icon)}${esc(it.title)}</p>${banner(it.banner, it)}
          <div class="nw__text">${(Array.isArray(it.body) ? it.body : [it.body]).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
          <div class="nw__foot">${tab === 'mail' ? `<button type="button" class="nw__go" data-act="claim" data-id="${esc(it.id)}" ${claimed.has(it.id) ? 'disabled' : ''}>${claimed.has(it.id) ? 'Claimed' : `Claim +${it.xp} XP`}</button>` : `<button type="button" class="nw__go" data-act="go" data-go="${esc(it.go)}">${esc(it.cta || 'Go to')}</button>`}</div>` : ''}</article>
      </div>`;
  };
  const claim = (id) => { const r = REWARDS.find((x) => x.id === id); if (!r || claimed.has(id)) return; claimed.add(id); save('itt-news-claimed-v1', [...claimed]); progress.award(r.xp, r.title); items.mail.find((x) => x.id === id).when = 'Claimed'; };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return close();
    feel.tap();
    if (a === 'tab') { tab = b.dataset.k; sel = items[tab][0]?.id; return render(); }
    if (a === 'sel') { sel = b.dataset.id; return render(); }
    if (a === 'claim') { claim(b.dataset.id); feel.win(); return render(); }
    if (a === 'all') { REWARDS.forEach((r) => claim(r.id)); feel.win(); feel.confetti(); return render(); }
    if (a === 'go') { const g = b.dataset.go; if (g !== 'cart') { root.remove(); root = null; } onGo?.(g); }
  });
  render();
  requestAnimationFrame(() => root.classList.add('is-on'));
}
// how many unread / unclaimed (for the menu's badge)
export function newsBadge(matches = []) {
  const read = new Set(load('itt-news-read-v1', [])), claimed = new Set(load('itt-news-claimed-v1', []));
  return newsItems({ matches }).filter((x) => !read.has(x.id)).length + REWARDS.filter((r) => !claimed.has(r.id)).length;
}
