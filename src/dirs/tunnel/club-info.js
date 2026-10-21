// Club info (Ahmed, 2026-10-21: "a tab for club info", "where the user can see the club ranking", "videos for the
// club", "become a member", "book a real stadium tour"). One screen, tabs down the side: about, honours, squad,
// the league table, results (each opens the match centre's result view), videos, membership and the stadium tour.
// Everything is from the project's sourced data: trophies.js, squad.js, legends.js, results-data.js (ESPN etc.,
// researched 2026-10-21), and the membership/tour research in _research/tour-membership.md.
import './club-info.css';
import { TROPHIES } from './trophies.js';
import { SQUAD, COACH } from './squad.js';
import { LEGENDS } from './legends.js';
import { RESULTS, TABLE, AFC_TABLE, CLUB_VIDEOS } from './results-data.js';
import { CLUBS } from './fantasy-data.js';
import { COMPS } from './fixtures.js';
import { VENUES, SPONSORS, LINKS } from '../../data.js';
import { openResult } from './match.js';
import { feel } from './feel.js';
import { clubXI, openPlayers } from './club.js';
import { openPacks, packsCount, ownedIds } from './packs.js';
import { fcCardHTML } from './fc-card.js';
import { openCollection } from './cards.js';
import { progress } from './progress.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CREST = '/teams/al-ittihad.png';
const logoOf = (slug) => CLUBS.find((c) => c.slug === slug)?.logo || '';
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>', home: '<path d="M3 11l9-7 9 7 M5 10v10h14V10"/>',
  cart: '<path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

// membership: the club's "Tiger Membership" (ittihadclub.sa/en/membership; 26/27 tiers from the club's posts of
// 29 Jul 2026). Joining happens in the club's own app — this page only informs and links out (Ahmed's choice).
const MEMBERSHIP = {
  url: 'https://www.ittihadclub.sa/en/membership',
  app: 'https://apps.apple.com/app/id1640456418',
  tiers: [
    { name: 'Tiger', price: 'SAR 115', perks: ['Ticket priority', 'Named membership card', 'Welcome bag with a scarf'] },
    { name: 'Tiger Plus', price: 'SAR 575', perks: ['Ticket priority', 'Named membership card', '10% off tickets', 'Welcome bag with a scarf, a store shirt and a keychain'] },
    { name: 'Tiger Legend', price: 'Price TBC for 26/27', perks: ['Welcome gift box', 'Ticket priority', 'The 26/27 player-edition shirt'] },
  ],
  note: 'Members also earn and redeem WalaOne points (the club’s loyalty partner since July 2026). Voting rights in the general assembly need registration on the Ministry of Sport portal.',
};
// the stadium tour: no public tour of the club's stadium is on sale (research, 2026-10-21), so this registers interest
const TOUR_ROUTE = ["The players' tunnel", 'The locker room', 'The press room', 'Pitch side', 'The trophy room'];

let root = null;
export function openClubInfo({ tab: startTab = 'about', onVirtualTour, onLocker, onFantasy, onCart, onHome, onClose } = {}) {
  root?.remove();
  root = document.createElement('div');
  root.className = 'ci'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Club info');
  document.body.append(root);
  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape' && !document.querySelector('.mc')) close(); }, { passive: true });
  const close = () => { feel.back(); const r = root; root = null; r?.classList.remove('is-on'); setTimeout(() => r?.remove(), 250); onClose?.(); };
  let tab = startTab, vid = null, tableKind = 'rsl';
  const TABS = [['about', 'About'], ['honours', 'Honours'], ['squad', 'Squad'], ['table', 'Table'], ['results', 'Results'], ['videos', 'Videos'], ['member', 'Membership'], ['tour', 'Stadium tour']];
  const tourReg = () => { try { return JSON.parse(localStorage.getItem('itt-tour-interest-v1')); } catch { return null; } };

  const panes = {
    // your side of the club (was the separate "My club" screen — Ahmed: one thing): the XI, players, packs, rooms
    team: () => {
      const x = clubXI(), list = ['GK', 'DEF', 'MID', 'FWD'].flatMap((k) => x.rows[k]), ovr = list.length ? Math.round(list.reduce((a, p) => a + p.rating, 0) / list.length) : 0;
      return `<div class="ci__team">
        <div class="ci__teamhd"><img src="${CREST}" alt=""/><div><p class="ci__k">My team</p><h3>${esc(x.name)}</h3><p class="ci__fine">${x.source === 'fantasy' ? 'Your fantasy XI' : 'Best XI from your player cards'} · ${esc(x.formation)}</p></div><span class="ci__ovr"><b>${ovr || '–'}</b><small>OVR · DEMO</small></span></div>
        <div class="ci__pitch">${['FWD', 'MID', 'DEF', 'GK'].map((k) => `<div class="ci__row">${x.rows[k].map((p) => fcCardHTML(p, { size: 's' })).join('')}</div>`).join('')}</div>
        <div class="ci__tiles">
          <button type="button" data-act="players"><b>Players</b><span>${ownedIds().length} owned</span></button>
          <button type="button" data-act="packs"><b>Packs</b><span>${packsCount()} to open</span></button>
          <button type="button" data-act="fantasy"><b>Fantasy</b><span>Edit your squad</span></button>
          <button type="button" data-act="locker"><b>Locker room</b><span>Shirts &amp; tactics</span></button>
          <button type="button" data-act="legends"><b>Legends</b><span>${progress.cards.length}/${LEGENDS.length} gems</span></button>
        </div>
        <p class="ci__fine">Ratings are demo values, not official. Squads and photos: spl.com.sa.</p></div>`;
    },
    about: () => `<div class="ci__about">
      <div class="ci__hero"><img src="${CREST}" alt=""/><div><h3>Al-Ittihad Club</h3><p lang="ar" dir="rtl">نادي الاتحاد</p><p class="ci__fine">Founded 1927 · Jeddah, Saudi Arabia</p></div></div>
      <div class="ci__grid">
        <div class="ci__box"><p class="ci__k">Nicknames</p><p>The Tigers (النمور) · Al-Ameed (العميد) · عميد الأندية</p></div>
        <div class="ci__box"><p class="ci__k">Colours</p><p><i class="ci__sw" style="background:#ffea00"></i><i class="ci__sw" style="background:#000"></i> Yellow and black</p></div>
        <div class="ci__box"><p class="ci__k">Head coach</p><p>${esc(COACH)}</p></div>
        <div class="ci__box"><p class="ci__k">Home grounds 26/27</p><p>${Object.values(VENUES).map((v) => esc(v.name + (v.aka ? ` (${v.aka})` : ''))).join('<br/>')}</p></div>
        <div class="ci__box"><p class="ci__k">League position</p><p>${TABLE ? (() => { const r = TABLE.rows.find((x) => x.slug === 'al-ittihad'); return r ? `${ordinal(r.pos)} · ${r.pts} pts from ${r.p}` : '–'; })() : '–'}</p></div>
        <div class="ci__box"><p class="ci__k">Legends</p><p>${LEGENDS.length} in the Hall of Fame</p></div>
      </div>
      <p class="ci__k">Partners</p><div class="ci__partners">${SPONSORS.map(([k, n]) => `<span title="${esc(n)}"><img src="/sponsors/${k}.png" alt="${esc(n)}"/></span>`).join('')}</div>
      <p class="ci__k">Official channels</p><div class="ci__links">${[['Club website', LINKS.about], ['Online store', LINKS.store], ['X', LINKS.x], ['Instagram', LINKS.instagram], ['YouTube', LINKS.youtube], ['Snapchat', LINKS.snapchat]].map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${l} ↗</a>`).join('')}</div></div>`,
    honours: () => `<ul class="ci__hon">${TROPHIES.map((t) => `<li><b>${esc(t.name)}</b><span>${esc(t.scope)}</span><em>${t.years.length}×</em><p>${t.years.map((y) => `<i>${esc(y)}</i>`).join('')}</p></li>`).join('')}</ul>
      <p class="ci__fine">Years every source agrees on (see the trophy room for the stories). Totals aren't shown because sources count the early titles differently.</p>`,
    squad: () => { const by = (p) => SQUAD.filter((s) => s.pos === p); return ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].map((p) => `<p class="ci__k">${p}s</p><div class="ci__squad">${by(p).map((s) => `<div class="ci__pl">${s.photo ? `<img src="${esc(s.photo)}" alt="" loading="lazy"/>` : '<span></span>'}<b>${s.no}</b><em>${esc(s.name)}</em></div>`).join('')}</div>`).join('') + `<p class="ci__fine">The club's own list (ittihadclub.sa/en/team). Photos: spl.com.sa. Head coach: ${esc(COACH)}.</p>`; },
    table: () => {
      const T = tableKind === 'afc' ? AFC_TABLE : TABLE;
      return `<nav class="ci__sub"><button type="button" class="${tableKind === 'rsl' ? 'is-on' : ''}" data-act="tk" data-k="rsl">${COMPS.rsl.mark ? `<img src="${COMPS.rsl.mark}" alt=""/>` : ''}Saudi Pro League</button>${AFC_TABLE ? `<button type="button" class="${tableKind === 'afc' ? 'is-on' : ''}" data-act="tk" data-k="afc">${COMPS.afc.mark ? `<img src="${COMPS.afc.mark}" alt=""/>` : ''}AFC Champions League Elite · West</button>` : ''}</nav>
        ${T ? `<table class="ci__table"><thead><tr><th>#</th><th class="is-l">Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th class="is-x">GF</th><th class="is-x">GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>
          ${T.rows.map((r) => `<tr class="${/ittihad/i.test(r.name) ? 'is-me' : ''}"><td>${r.pos}</td><td class="is-l">${logoOf(r.slug) ? `<img src="${esc(logoOf(r.slug))}" alt=""/>` : ''}${esc(r.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td class="is-x">${r.gf}</td><td class="is-x">${r.ga}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>
          <p class="ci__fine">As of ${esc(T.asOf)} · source: <a href="${esc(T.source)}" target="_blank" rel="noopener">${esc(new URL(T.source).hostname)}</a>${tableKind === 'rsl' ? ' · some clubs have games in hand (postponed fixtures)' : ''}</p>` : '<p class="ci__fine">No verified table yet.</p>'}`;
    },
    results: () => `<ul class="ci__res">${[...RESULTS].reverse().map((r, i) => { const idx = RESULTS.length - 1 - i, us = /ittihad/i.test(r.home.name) ? 'home' : 'away', them = us === 'home' ? 'away' : 'home', w = r[us].score > r[them].score ? 'W' : r[us].score < r[them].score ? 'L' : 'D';
        return `<li><button type="button" data-act="res" data-i="${idx}"><span class="ci__wdl is-${w}">${w}</span><span class="ci__rc">${esc(COMPS[r.comp]?.label || r.comp)} · ${esc(r.round || '')}<br/><small>${esc(r.date)}</small></span>
          <span class="ci__rt">${logoOf(r.home.slug) ? `<img src="${esc(logoOf(r.home.slug))}" alt=""/>` : ''}${esc(r.home.name)}</span><b class="ci__rs">${r.home.score} – ${r.away.score}</b><span class="ci__rt is-a">${esc(r.away.name)}${logoOf(r.away.slug) ? `<img src="${esc(logoOf(r.away.slug))}" alt=""/>` : ''}</span><em>${r.videos?.length ? 'Highlights' : ''}</em></button></li>`; }).join('')}</ul>
      <p class="ci__fine">Scores, scorers and stats from ESPN's match pages; reports linked in each match.</p>`,
    videos: () => { const all = [...CLUB_VIDEOS.map((v) => ({ ...v, from: 'Club' })), ...RESULTS.flatMap((r) => (r.videos || []).slice(0, 1).map((v) => ({ ...v, from: `${r.home.name} ${r.home.score}–${r.away.score} ${r.away.name}`, kind: 'highlights', date: r.date })))].sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return `${vid ? `<div class="ci__player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(vid)}?autoplay=1&rel=0" title="Video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><button type="button" class="ci__btn is-2" data-act="novid">Close video</button></div>` : ''}
        <div class="ci__vids">${all.map((v) => `<button type="button" class="ci__vid" data-act="vid" data-id="${esc(v.id)}"><img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy"/><i>${esc(v.kind || 'video')}</i><b dir="auto">${esc(v.titleEn || v.title)}</b><span>${esc(v.kind === 'highlights' ? v.from : v.channel)}${v.date ? ` · ${esc(v.date)}` : ''}</span></button>`).join('')}</div>
        <p class="ci__fine">Official channels (the club, the Saudi Pro League, the AFC and the league's broadcaster); every video checked on YouTube. <a href="${esc(LINKS.youtube)}" target="_blank" rel="noopener">More on the club's channel ↗</a></p>`; },
    member: () => `<div class="ci__mem">${MEMBERSHIP.tiers.map((t, i) => `<div class="ci__tier is-${i}"><p class="ci__k">Tiger membership</p><h4>${esc(t.name)}</h4><p class="ci__price">${esc(t.price)}</p><ul>${t.perks.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`).join('')}</div>
      <p class="ci__note">${esc(MEMBERSHIP.note)}</p>
      <div class="ci__ctas"><a class="ci__btn" href="${MEMBERSHIP.app}" target="_blank" rel="noopener">Join in the Al-Ittihad app ↗</a><a class="ci__btn is-2" href="${MEMBERSHIP.url}" target="_blank" rel="noopener">View on ittihadclub.sa ↗</a></div>
      <p class="ci__fine">Membership is sold by the club in its own app, not here. Tiers and benefits from the club's 26/27 announcements; check the club's page for the latest. The Tigers Season Pass is separate (see Tickets).</p>`,
    tour: () => { const reg = tourReg(); return `<div class="ci__tour"><p class="ci__k">Coming soon</p><h4>Stadium tour</h4>
        <p>There's no public tour of the stadium on sale yet. Register your interest and we'll let you know if one opens. Until then, walk the tunnel in the virtual tour.</p>
        <p class="ci__k">What a tour could include</p><ol>${TOUR_ROUTE.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        ${reg ? `<p class="ci__ok">Thanks${reg.name ? `, ${esc(reg.name)}` : ''}: we'll let you know (saved in this browser).</p>` : `<form class="ci__form js-ci-tour"><label>Name<input name="name" maxlength="40" autocomplete="name"/></label><label>Group size<select name="n">${[1, 2, 3, 4, 5, 6, 8, 10].map((n) => `<option>${n}</option>`).join('')}</select></label><button type="submit" class="ci__btn">Notify me</button></form>`}
        <div class="ci__ctas"><button type="button" class="ci__btn is-2" data-act="vtour">Take the virtual tour</button></div>
        <p class="ci__fine">The stadium is run by the Ministry of Sport and the club museum isn't open to the public, so no tour can be booked. This sign-up is kept in this browser only.</p></div>`; },
  };
  const render = () => {
    root.innerHTML = `<header class="ci__hd"><button type="button" class="ci__ic" data-act="close" aria-label="Back">${svg('back')}</button><h2>Club info</h2>
        <div class="ci__tr"><button type="button" class="ci__ic" data-act="cart" aria-label="Cart">${svg('cart')}</button><button type="button" class="ci__ic" data-act="home" aria-label="Home">${svg('home')}</button></div></header>
      <div class="ci__body"><nav class="ci__tabs">${TABS.map(([k, l]) => `<button type="button" class="${tab === k ? 'is-on' : ''}" data-act="tab" data-k="${k}">${l}</button>`).join('')}</nav>
        <section class="ci__pane">${panes[tab]()}</section></div>`;
  };
  root.addEventListener('submit', (e) => {
    if (!e.target.classList.contains('js-ci-tour')) return; e.preventDefault();
    const f = new FormData(e.target);
    try { localStorage.setItem('itt-tour-interest-v1', JSON.stringify({ name: String(f.get('name') || '').slice(0, 40), n: +f.get('n') || 1, at: Date.now() })); } catch { /* private */ }
    feel.win(); render();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') return close();
    feel.tap();
    if (a === 'tab') { tab = b.dataset.k; vid = null; render(); root.querySelector('.ci__pane').scrollTop = 0; return; }
    if (a === 'tk') { tableKind = b.dataset.k; return render(); }
    if (a === 'vid') { vid = b.dataset.id; render(); root.querySelector('.ci__pane').scrollTop = 0; return; }
    if (a === 'novid') { vid = null; return render(); }
    if (a === 'res') { const r = RESULTS[+b.dataset.i], crestOf = (t) => (/ittihad/i.test(t.name) ? CREST : logoOf(t.slug)); return openResult(r, { compLabel: COMPS[r.comp]?.label || r.comp, homeCrest: crestOf(r.home), awayCrest: crestOf(r.away), onCart, onHome: () => { close(); onHome?.(); } }); }
    if (a === 'players') return openPlayers({ onFantasy: () => { const r = root; root = null; r.remove(); onFantasy?.(); }, onClose: () => render() });
    if (a === 'packs') return openPacks({ onClose: () => render() });
    if (a === 'fantasy') { const r = root; root = null; r.remove(); return onFantasy?.(); }
    if (a === 'locker') { const r = root; root = null; r.remove(); return onLocker?.(); }
    if (a === 'legends') { root.style.visibility = 'hidden'; return openCollection({ onClose: () => { if (root) { root.style.visibility = ''; render(); } } }); }
    if (a === 'vtour') { const r = root; root = null; r.remove(); return onVirtualTour?.(); }
    if (a === 'cart') return onCart?.();
    if (a === 'home') { const r = root; root = null; r.remove(); return onHome?.(); }
  });
  render();
  requestAnimationFrame(() => root?.classList.add('is-on'));
}
const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10] || 'th'}`;
