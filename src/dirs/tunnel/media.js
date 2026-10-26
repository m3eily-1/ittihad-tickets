// Media (Ahmed, 2026-10-22: the menu's "News" tab becomes "Media", with the videos and the images). Only what the
// project already has, each with its source:
// - Videos: the club's uploads (results-data.js CLUB_VIDEOS), every match's highlights (RESULTS[].videos) and the
//   trophy room's finals and celebrations (trophy-media.js; `official: false` = a fan re-upload of the broadcast,
//   tagged "Fan archive" without the uploader's name, as the trophy room shows them). All YouTube; they play here.
// - Photos: the club's aerial of Alinma Stadium (heroes/flyover.js), the squad cut-outs from spl.com.sa (squad.js),
//   the legends' Wikimedia Commons portraits with each one's credit (legends.js), the store's photos
//   (shop.ittihadclub.sa: products.js, jersey3d.js) and the match-day posters from the club's Webook feed (data.js).
//   Left out: season-pass.png and season-poster.png (no source anywhere in the code), aerial.jpg (a crop of
//   aerial-full.jpg) and jersey/height.png (a generated height map, not a photo).
// - News: the announcements from news.js (same list, detail, read state and "Go to").
//
// 2026-10-26 (Ahmed: "the media page is not designed well"): three layouts over the same data, switchable from the
// header (localStorage itt-media-layout, or ?md=feed|stream|inbox), until he picks one:
// - Feed: one mixed grid, newest first, filter chips All · News · Videos · Photos.
// - Streaming: a featured hero (the newest match highlight) over sideways rows.
// - Inbox: the icon rail, a list on the left and the selected item big on the right.
// Layers, stepped back one at a time by Back / Escape: the photo viewer, the player, the announcement, the page.
import './media.css';
import './news.css';
import { feel } from './feel.js';
import { newsItems } from './news.js';
import { RESULTS, CLUB_VIDEOS } from './results-data.js';
import { TROPHY_MEDIA, APPROVED as TROPHY_VIDEOS_OK } from './trophy-media.js';
import { TROPHIES } from './trophies.js';
import { SQUAD } from './squad.js';
import { LEGENDS } from './legends.js';
import { PRODUCTS } from './products.js';
import { COMPS } from './fixtures.js';
import { MATCHES, VENUES } from '../../data.js';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const READ_KEY = 'itt-news-read-v1';   // news.js's key, so the menu's unread badge stays right
const LAYOUT_KEY = 'itt-media-layout';
const LAYOUTS = [['feed', 'Feed'], ['stream', 'Streaming'], ['inbox', 'Inbox']];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NARROW_Q = '(orientation: portrait) and (max-width: 760px)';
const narrow = () => matchMedia(NARROW_Q).matches;
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  photo: '<path d="M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6 M15.5 9.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0"/>',
  video: '<path d="M3 6h13v12H3z M16 10l5-3v10l-5-3"/>',
  news: '<path d="M3 10v4h3l7 4V6L6 10z M16 9a3 3 0 0 1 0 6 M18.5 6.5a7 7 0 0 1 0 11"/>',
  ball: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z"/>',
  ticket: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z M14 7v12"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  expand: '<path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.news}</svg>`;
const yt = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
const ytMax = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/maxresdefault.jpg`;
const ourSide = (r) => (/ittihad/i.test(r.home.name) ? 'home' : 'away');

/* ── videos: three groups, each video { id, tag, title, orig, source, context, date } ── */
const CLUB_TAG = { interview: 'Interview', feature: 'Feature', signing: 'New signing', highlights: 'Highlights' };
function videoGroups() {
  const club = [...CLUB_VIDEOS].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((v) => ({
    id: v.id, tag: CLUB_TAG[v.kind] || 'Video', title: v.titleEn || v.title, orig: v.titleEn ? v.title : '',
    source: v.channel, context: v.date || '', date: v.date || '',
  }));
  const matches = [...RESULTS].sort((a, b) => String(b.date).localeCompare(String(a.date))).flatMap((r) => (r.videos || []).map((v) => ({
    id: v.id, tag: 'Highlights', title: v.title, orig: '', source: v.channel, date: r.date || '',
    context: `${r.home.name} ${r.home.score}–${r.away.score} ${r.away.name} · ${COMPS[r.comp]?.label || r.comp}${r.round ? ` · ${r.round}` : ''} · ${r.date}`,
    score: `${r.home.score}–${r.away.score}`, us: ourSide(r),
  })));
  const trophies = TROPHY_VIDEOS_OK ? TROPHIES.flatMap((t) => (TROPHY_MEDIA[t.key]?.videos || []).map((v) => {
    const official = v.official !== false;
    return {
      id: v.id, tag: official ? (v.kind === 'final' ? 'Final' : 'Celebration') : 'Fan archive', fan: !official, title: v.title, orig: '',
      source: official ? v.channel : 'Fan re-upload of the broadcast', context: `${t.name}${v.year ? ` · ${v.year}` : ''}`, date: String(v.year || ''),
    };
  })) : [];
  return [
    { k: 'club', t: 'Club videos', note: "Interviews, features and signings from the club's YouTube channel (and one from the Saudi Pro League's).", items: club },
    { k: 'matches', t: 'Match highlights', note: "2026–27 highlights from the league, the AFC, the clubs and the league's broadcaster.", items: matches },
    { k: 'trophies', t: 'Trophy moments', note: 'Finals and trophy lifts from the trophy room. "Fan archive" marks a fan re-upload of the broadcast, where no official upload exists.', items: trophies },
  ].filter((g) => g.items.length);
}

/* ── photos: galleries, each image { src, cap, sub, credit } (the gallery's credit unless the image has its own) ── */
function photoGroups() {
  const alinma = VENUES.alinma || { name: 'Alinma Stadium' };
  const STORE = 'Photo: Al-Ittihad club store (shop.ittihadclub.sa)';
  return [
    { k: 'stadium', t: 'Stadium', fit: 'wide', credit: "Photo: Al-Ittihad Club (the club's own aerial)",
      items: [{ src: '/img/aerial-full.jpg', cap: `${alinma.name} from above`, sub: [alinma.aka, alinma.area].filter(Boolean).join(' · ') }] },
    { k: 'squad', t: 'Squad 26/27', fit: 'cut', credit: 'Photo: Saudi Pro League (spl.com.sa)',
      items: SQUAD.filter((p) => p.photo).map((p) => ({ src: p.photo, cap: p.name, sub: `No. ${p.no} · ${p.pos}`, no: p.no })) },
    { k: 'legends', t: 'Legends', fit: 'portrait', credit: 'Free-licence portraits from Wikimedia Commons; each credit is shown with the photo.',
      items: LEGENDS.filter((l) => l.photo && l.credit).map((l) => ({ src: l.photo, cap: l.name, sub: `${l.pos} · ${l.years}`, ar: l.ar, credit: l.credit, own: true })) },
    { k: 'kits', t: 'Kits & store', fit: 'product', credit: STORE,
      items: [
        { src: '/img/jersey/front.webp', cap: '26/27 home shirt: front', sub: "Cut out from the store's photo", cut: true },
        { src: '/img/jersey/back.webp', cap: '26/27 home shirt: back', sub: "Cut out from the store's photo", cut: true },
        ...PRODUCTS.filter((p) => p.img).map((p) => ({ src: p.img, cap: p.name, sub: p.type })),
      ] },
    { k: 'campaigns', t: 'Campaigns', fit: 'banner', credit: "Match-day poster from the club's Webook event feed",
      items: MATCHES.filter((m) => m.poster).map((m) => ({ src: m.poster, cap: `Al Ittihad vs ${m.opp}`, sub: `${m.compLabel}${m.round ? ` · ${m.round}` : ''} · match poster` })) },
  ].filter((g) => g.items.length);
}

function startLayout() {
  const ok = (k) => LAYOUTS.some(([x]) => x === k);
  try { const q = new URLSearchParams(location.search).get('md'); if (ok(q)) return q; } catch { /* no URL */ }
  try { const s = localStorage.getItem(LAYOUT_KEY); if (ok(s)) return s; } catch { /* private mode */ }
  return 'feed';
}

let root = null;
export function openMedia({ matches = [], tab: startTab = 'news', onGo, onClose } = {}) {
  root?.remove();
  const el = root = document.createElement('div');
  el.className = 'md'; el.tabIndex = -1;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Media');
  document.body.append(el);

  const VIDEOS = videoGroups(), PHOTOS = photoGroups();
  const ALLV = VIDEOS.flatMap((g) => g.items);
  const ALLP = PHOTOS.flatMap((g, gi) => g.items.map((p, i) => ({ g: gi, i })));
  const news = newsItems({ matches });
  const read = new Set(load(READ_KEY, []));
  const markRead = (id) => { if (id && !read.has(id)) { read.add(id); save(READ_KEY, [...read]); } };
  const unread = () => news.filter((x) => !read.has(x.id)).length;

  let layout = startLayout();
  let filter = 'all';                                                  // feed
  let tab = ['videos', 'photos', 'news'].includes(startTab) ? startTab : 'news';   // inbox (News first, 2026-10-22)
  const isel = { news: news[0]?.id, videos: 0, photos: 0 };            // inbox: the selected item per tab (photos: index into ALLP)
  let iplay = false;                                                   // inbox: the selected video is playing
  let iOpen = false;                                                   // inbox, phones upright: the detail is showing
  let th = null, thEl = null, thReturn = null;                         // the player layer (feed / streaming): video index
  let sh = null, shEl = null, shReturn = null;                         // the announcement layer (feed / streaming): news id
  let lb = null, lbEl = null, lbReturn = null;                         // the photo viewer { g, i }

  const close = () => {
    feel.back();
    if (root === el) root = null;
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 250);
    onClose?.();
  };
  // one back, a step at a time: the photo, then the video, then the announcement, then the page
  const back = () => {
    if (lb) { closeLb(); return; }
    if (th != null) { closeTh(); return; }
    if (layout === 'inbox' && tab === 'videos' && iplay) { feel.back(); iplay = false; paintDetail(); return; }
    if (sh != null) { closeSh(); return; }
    if (layout === 'inbox' && iOpen && narrow()) { feel.back(); iOpen = false; renderMain(); return; }
    close();
  };

  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown']) {
    el.addEventListener(ev, (e) => {
      e.stopPropagation();
      if (ev !== 'keydown') return;
      if (e.key === 'Escape') { e.preventDefault?.(); back(); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const d = e.key === 'ArrowLeft' ? -1 : 1;
      if (lb) stepLb(d);
      else if (layout === 'inbox' && tab === 'photos' && th == null && !e.target.closest?.('[role="tablist"], .mdi__list')) stepInboxPhoto(d);
    }, { passive: ev !== 'keydown' });
  }

  /* ── shared pieces ── */
  const tag = (v) => `<i class="md__tag${v.fan ? ' is-fan' : ''}">${esc(v.tag)}</i>`;
  const credit = (g, p) => p.credit || g.credit;
  const newsArt = (b, cls = '') => {
    if (!b) return `<span class="md__nart ${cls} is-match"><img src="/teams/al-ittihad.png" alt=""/></span>`;
    if (b.kind === 'match') return `<span class="md__nart ${cls} is-match"><img src="/teams/al-ittihad.png" alt=""/><em>VS</em>${b.crest ? `<img src="${esc(b.crest)}" alt=""/>` : ''}</span>`;
    return `<span class="md__nart ${cls}${b.contain ? ' is-contain' : ''}${b.top ? ' is-top' : ''}" style="background-image:url('${esc(b.src)}')"></span>`;
  };
  const banner = (b) => {
    if (!b) return '';
    if (b.kind === 'match') return `<div class="nw__ban is-match"><img src="/teams/al-ittihad.png" alt=""/><em>VS</em>${b.crest ? `<img src="${esc(b.crest)}" alt=""/>` : ''}</div>`;
    return `<div class="nw__ban ${b.contain ? 'is-contain' : ''} ${b.top ? 'is-top' : ''}" style="background-image:url('${esc(b.src)}')"></div>`;
  };
  const newsBody = (it) => `${banner(it.banner)}
    <div class="nw__text">${(Array.isArray(it.body) ? it.body : [it.body]).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    <div class="nw__foot"><button type="button" class="nw__go" data-act="go" data-go="${esc(it.go)}">${esc(it.cta || 'Go to')}</button></div>`;
  const playerMeta = (v, closeBtn) => `<div class="md__pmeta">${tag(v)}<h3 dir="auto">${esc(v.title)}</h3>${v.orig ? `<p class="md__orig" dir="auto">${esc(v.orig)}</p>` : ''}
      <p class="md__src" dir="auto">${esc(v.source)}</p><p class="md__ctx">${esc(v.context)}</p>
      <div class="md__pacts">${closeBtn ? '<button type="button" class="md__btn is-2" data-act="novid">Close video</button>' : ''}<a class="md__link" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener">YouTube ↗</a></div></div>`;
  const iframe = (v) => `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  const FINE_V = "Every video plays from YouTube; each id was checked on YouTube when it was added. Titles are the uploaders' own; the club videos' English titles are our translation.";
  const FINE_P = `Photo credits: ${PHOTOS.map((g) => `${g.t}: ${g.credit.replace(/^Photo: /, '')}`).join(' · ')}`;
  // the sharper 16:9 still where YouTube has one (maxres is missing on some uploads: a 120 px placeholder then)
  const sharpen = (img, id) => { if (!img || !id) return; const im = new Image(); im.onload = () => { if (im.naturalWidth > 200 && img.isConnected) img.src = im.src; }; im.src = ytMax(id); };

  /* ── header: back, the title, the layout's tools (feed's chips), the layout switcher ── */
  const COUNTS = { all: news.length + ALLV.length + ALLP.length, news: news.length, videos: ALLV.length, photos: ALLP.length };
  const chips = () => `<div class="md__chips" role="group" aria-label="Show">${[['all', 'All'], ['news', 'News'], ['videos', 'Videos'], ['photos', 'Photos']].map(([k, l]) => `<button type="button" data-act="filter" data-k="${k}" aria-pressed="${filter === k}">${l}<em>${COUNTS[k]}</em>${k === 'news' && unread() ? `<i class="md__badge" aria-label="${unread()} unread">${unread()}</i>` : ''}</button>`).join('')}</div>`;
  const switcher = () => `<div class="md__lay" role="group" aria-label="Layout"><span>Layout</span>${LAYOUTS.map(([k, l]) => `<button type="button" data-act="lay" data-k="${k}" aria-pressed="${layout === k}">${l}</button>`).join('')}</div>`;
  const paintHeader = () => {
    el.querySelector('.md__tools').innerHTML = layout === 'feed' ? chips() : '';
    el.querySelector('.md__lays').innerHTML = switcher();
  };

  /* ══ 1. FEED: one mixed grid, newest first ══ */
  // news has no dates (they're today's announcements), so it leads, woven in with the newest videos; the photos have no
  // dates either, so they're woven through every third card, a gallery at a time (stadium, a player, a legend, a kit…)
  const FEED = (() => {
    const vids = ALLV.map((v, i) => ({ t: 'v', i, d: v.date })).sort((a, b) => b.d.localeCompare(a.d));
    const ph = [], longest = Math.max(0, ...PHOTOS.map((g) => g.items.length));
    for (let k = 0; k < longest; k++) PHOTOS.forEach((g, gi) => { if (g.items[k]) ph.push({ t: 'p', g: gi, i: k }); });
    const nw = news.map((x) => ({ t: 'n', id: x.id }));
    const out = [];
    for (let s = 0; vids.length || ph.length || nw.length; s++) {
      if (s % 5 === 1 && nw.length) out.push(nw.shift());
      else if (s % 3 === 2 && ph.length) out.push(ph.shift());
      else out.push(vids.shift() || nw.shift() || ph.shift());
    }
    let nv = 0, nn = 0;
    out.forEach((it) => { if (it.t === 'v') it.big = nv++ % 7 === 0; if (it.t === 'n') it.big = nn++ === 0; });
    return out;
  })();
  const feedCard = (it) => {
    if (it.t === 'v') {
      const v = ALLV[it.i];
      return `<button type="button" class="mdf__c is-v${it.big ? ' is-big' : ''}" data-act="vid" data-i="${it.i}" aria-label="Play: ${esc(v.title)}${v.fan ? ' (fan archive)' : ''}">
        <img class="mdf__img" src="${yt(v.id)}" alt="" loading="lazy" decoding="async"/>${tag(v)}<span class="md__playic">${svg('play')}</span>
        <span class="mdf__cap"><b dir="auto">${esc(v.title)}</b><small dir="auto">${esc(v.source)}</small></span></button>`;
    }
    if (it.t === 'p') {
      const g = PHOTOS[it.g], p = g.items[it.i];
      return `<button type="button" class="mdf__c is-p is-${g.fit}${p.cut ? ' is-cut' : ''}" data-act="ph" data-g="${it.g}" data-i="${it.i}" aria-label="Open photo: ${esc(p.cap)}">
        <img class="mdf__img" src="${esc(p.src)}" alt="" loading="lazy" decoding="async"/>${p.no != null ? `<i class="md__no">${p.no}</i>` : ''}<span class="mdf__pi">${svg('photo')}</span>
        <span class="mdf__cap"><b>${esc(p.cap)}</b><small class="md__cr">${esc(credit(g, p))}</small></span></button>`;
    }
    const x = news.find((n) => n.id === it.id); if (!x) return '';
    return `<button type="button" class="mdf__c is-n${it.big ? ' is-big' : ''}" data-act="nopen" data-id="${esc(x.id)}" aria-label="Announcement: ${esc(x.title)}">
      ${newsArt(x.banner, 'mdf__nart')}<span class="mdf__nt"><b>${esc(x.title)}</b><em>${svg(x.icon)}${esc(x.when || 'News')}</em></span>${!read.has(x.id) ? '<i class="md__dot" aria-label="Unread"></i>' : ''}</button>`;
  };
  const feedHTML = () => {
    const keep = { all: () => true, news: (it) => it.t === 'n', videos: (it) => it.t === 'v', photos: (it) => it.t === 'p' }[filter];
    const items = FEED.filter(keep);
    const fine = filter === 'news' ? '' : `<p class="md__fine">${filter !== 'photos' ? esc(FINE_V) : ''}${filter === 'all' ? '<br/>' : ''}${filter !== 'videos' ? esc(FINE_P) : ''}</p>`;
    return `<section class="md__pane mdf" id="md-pane" aria-label="Feed"><div class="mdf__grid">${items.map(feedCard).join('')}</div>${fine}</section>`;
  };

  /* ══ 2. STREAMING: the featured hero, then sideways rows ══ */
  // the newest match highlight: the first of the matches group (they're newest first)
  const HERO = (() => { let n = 0; for (const g of VIDEOS) { if (g.k === 'matches') return n; n += g.items.length; } return 0; })();
  const vTile = (v, i) => `<button type="button" class="mds__t is-v" data-act="vid" data-i="${i}" aria-label="Play: ${esc(v.title)}${v.fan ? ' (fan archive)' : ''}">
      <span class="md__thumb"><img src="${yt(v.id)}" alt="" loading="lazy" decoding="async"/><span class="md__playic">${svg('play')}</span>${tag(v)}</span>
      <b dir="auto">${esc(v.title)}</b><span class="md__src" dir="auto">${esc(v.source)}</span></button>`;
  const row = (k, title, note, count, tiles, kind) => `<section class="mds__row is-${kind}" id="md-r-${k}" aria-labelledby="md-rt-${k}">
      <header class="mds__rh"><h3 id="md-rt-${k}">${esc(title)}<em>${count}</em></h3>${note ? `<p>${esc(note)}</p>` : ''}</header>
      <div class="mds__wrap"><button type="button" class="mds__arr is-prev" data-act="rowstep" data-d="-1" aria-label="Scroll ${esc(title)} left">${svg('prev')}</button>
        <div class="mds__track">${tiles}</div>
        <button type="button" class="mds__arr is-next" data-act="rowstep" data-d="1" aria-label="Scroll ${esc(title)} right">${svg('next')}</button></div></section>`;
  const streamHTML = () => {
    const h = ALLV[HERO];
    const hero = h ? `<section class="mds__hero" aria-label="Featured">
        <img class="mds__bd" src="${yt(h.id)}" alt="" decoding="async"/>
        <div class="mds__hc"><h3 dir="auto">${esc(h.title)}</h3><p class="mds__hm">${esc(h.context)}</p><p class="md__src" dir="auto">${esc(h.source)}</p>
          <div class="mds__ha"><button type="button" class="md__btn" data-act="vid" data-i="${HERO}">${svg('play')}Play</button>
          <button type="button" class="md__btn is-2" data-act="rowjump" data-k="matches">More highlights</button></div></div></section>` : '';
    let n = 0;
    const vRows = VIDEOS.map((g) => row(g.k, g.t, g.note, g.items.length, g.items.map((v) => vTile(v, n++)).join(''), 'v'));
    const newsRow = row('news', 'Latest news', '', news.length, news.map((x) => `<button type="button" class="mds__t is-n" data-act="nopen" data-id="${esc(x.id)}" aria-label="Announcement: ${esc(x.title)}">
        ${newsArt(x.banner, 'mds__nart')}<span class="mds__nt"><b>${esc(x.title)}</b><em>${svg(x.icon)}${esc(x.when || 'News')}</em></span>${!read.has(x.id) ? '<i class="md__dot" aria-label="Unread"></i>' : ''}</button>`).join(''), 'n');
    const pRows = PHOTOS.map((g, gi) => row(`p-${g.k}`, g.t, g.credit, g.items.length, g.items.map((p, i) => `<button type="button" class="mds__t is-p is-${g.fit}${p.cut ? ' is-cut' : ''}" data-act="ph" data-g="${gi}" data-i="${i}" aria-label="Open photo: ${esc(p.cap)}">
        <span class="mds__sq"><img src="${esc(p.src)}" alt="" loading="lazy" decoding="async"/>${p.no != null ? `<i class="md__no">${p.no}</i>` : ''}</span>
        <b>${esc(p.cap)}</b>${p.own ? `<small class="md__cr">${esc(p.credit)}</small>` : `<span class="md__ctx">${esc(p.sub)}</span>`}</button>`).join(''), `p is-${g.fit}`));
    // order: Latest news · Match highlights · Club videos · Trophy moments · the photo galleries
    const byK = Object.fromEntries(VIDEOS.map((g, i) => [g.k, vRows[i]]));
    return `<section class="md__pane mds" id="md-pane" aria-label="Streaming">${hero}${newsRow}${byK.matches || ''}${byK.club || ''}${byK.trophies || ''}${pRows.join('')}
      <p class="md__fine">${esc(FINE_V)}</p></section>`;
  };
  // the rows: a vertical wheel scrolls them sideways (until the row's end, then the page scrolls on), then they snap
  const wireRows = () => {
    el.querySelectorAll('.mds__track').forEach((tr) => {
      const arrows = () => {
        const wrap = tr.parentElement, max = tr.scrollWidth - tr.clientWidth;
        wrap.querySelector('.is-prev').disabled = tr.scrollLeft <= 2;
        wrap.querySelector('.is-next').disabled = tr.scrollLeft >= max - 2;
        wrap.classList.toggle('is-static', max <= 2);
      };
      let t = 0;
      tr.addEventListener('wheel', (e) => {
        if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // trackpads scroll sideways themselves
        const max = tr.scrollWidth - tr.clientWidth, dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? tr.clientWidth : 1);
        if (max <= 2 || (dy > 0 && tr.scrollLeft >= max - 1) || (dy < 0 && tr.scrollLeft <= 0)) return;
        e.preventDefault();
        tr.classList.add('is-wheel'); tr.scrollLeft += dy;
        clearTimeout(t);
        t = setTimeout(() => {
          tr.classList.remove('is-wheel');
          const m = tr.scrollWidth - tr.clientWidth; if (tr.scrollLeft >= m - 2) return;
          const pad = parseFloat(getComputedStyle(tr).scrollPaddingLeft) || 0;
          let best = 0, bd = Infinity;
          for (const c of tr.children) { const d = Math.abs(c.offsetLeft - pad - tr.scrollLeft); if (d < bd) { bd = d; best = c.offsetLeft - pad; } }
          tr.scrollTo({ left: Math.max(0, best), behavior: reduced() ? 'auto' : 'smooth' });
        }, 160);
      }, { passive: false });
      tr.addEventListener('scroll', arrows, { passive: true });
      arrows();
    });
    sharpen(el.querySelector('.mds__bd'), ALLV[HERO]?.id);
  };

  /* ══ 3. INBOX: the rail, a list, the selected item big ══ */
  const TABS = [['news', 'News', 'news'], ['videos', 'Videos', 'video'], ['photos', 'Photos', 'photo']];
  const railHTML = () => TABS.map(([k, l, ic]) => `<button type="button" role="tab" id="md-tab-${k}" aria-controls="md-pane" aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" class="${tab === k ? 'is-on' : ''}" data-act="tab" data-k="${k}">${svg(ic)}<span>${l}</span>${k === 'news' && unread() ? `<em aria-label="${unread()} unread">${unread()}</em>` : ''}</button>`).join('');
  const listHTML = () => {
    const solo = narrow();
    const on = (b) => (!solo && b ? ' is-on' : '');
    if (tab === 'news') {
      return `<p class="mdi__gh">Announcements<em>${news.length}</em></p>${news.map((x) => `<button type="button" class="mdi__row${on(x.id === isel.news)}" data-act="isel" data-id="${esc(x.id)}">
        ${newsArt(x.banner, 'mdi__th')}<span class="mdi__tx"><b>${esc(x.title)}</b><em>${esc(x.when || 'News')}</em></span>${!read.has(x.id) ? '<i class="md__dot" aria-label="Unread"></i>' : ''}</button>`).join('') || '<p class="mdi__empty">Nothing here yet.</p>'}`;
    }
    if (tab === 'videos') {
      let n = 0;
      return VIDEOS.map((g) => `<p class="mdi__gh">${esc(g.t)}<em>${g.items.length}</em></p>${g.items.map((v) => { const i = n++; return `<button type="button" class="mdi__row${on(i === isel.videos)}" data-act="isel" data-i="${i}" aria-label="${esc(v.title)}${v.fan ? ' (fan archive)' : ''}">
        <span class="mdi__th is-v"><img src="${yt(v.id)}" alt="" loading="lazy" decoding="async"/>${svg('play')}</span><span class="mdi__tx"><b dir="auto">${esc(v.title)}</b><em dir="auto">${esc(v.tag)} · ${esc(v.source)}</em></span></button>`; }).join('')}`).join('');
    }
    let n = 0;
    return PHOTOS.map((g) => `<p class="mdi__gh">${esc(g.t)}<em>${g.items.length}</em></p>${g.items.map((p) => { const i = n++; return `<button type="button" class="mdi__row${on(i === isel.photos)}" data-act="isel" data-i="${i}">
        <span class="mdi__th is-p is-${g.fit}${p.cut ? ' is-cut' : ''}"><img src="${esc(p.src)}" alt="" loading="lazy" decoding="async"/></span><span class="mdi__tx"><b>${esc(p.cap)}</b><em>${esc(p.sub)}</em></span></button>`; }).join('')}`).join('');
  };
  const detailHTML = () => {
    const solo = narrow(), bk = solo ? `<button type="button" class="md__ic mdi__bk" data-act="iback" aria-label="Back to the list">${svg('back')}</button>` : '';
    if (tab === 'news') {
      const it = news.find((x) => x.id === isel.news) || news[0]; if (!it) return '';
      markRead(it.id);
      return `<article class="nw__detail mdi__det"><p class="nw__dh">${bk}${svg(it.icon)}<span>${esc(it.title)}</span></p>${newsBody(it)}</article>`;
    }
    if (tab === 'videos') {
      const v = ALLV[isel.videos]; if (!v) return '';
      return `<article class="mdi__det is-v">${bk ? `<div class="mdi__dbar">${bk}</div>` : ''}<div class="md__frame mdi__frame" style="background-image:url('${yt(v.id)}')">${iplay ? iframe(v) : `<button type="button" class="mdi__poster" data-act="iplay" aria-label="Play: ${esc(v.title)}"><img src="${yt(v.id)}" alt="" decoding="async"/><span class="mdi__big">${svg('play')}</span></button>`}</div>
        ${playerMeta(v, false)}</article>`;
    }
    const ref = ALLP[isel.photos]; if (!ref) return '';
    const g = PHOTOS[ref.g], p = g.items[ref.i];
    return `<article class="mdi__det is-p">${bk ? `<div class="mdi__dbar">${bk}</div>` : ''}<div class="mdi__stage${g.fit === 'cut' || g.fit === 'product' || p.cut ? ' is-cut' : ''}">
        <img src="${esc(p.src)}" alt="${esc(p.cap)}" draggable="false"/>
        <button type="button" class="mdi__nav is-prev" data-act="istep" data-d="-1" aria-label="Previous photo">${svg('prev')}</button>
        <button type="button" class="mdi__nav is-next" data-act="istep" data-d="1" aria-label="Next photo">${svg('next')}</button>
        <button type="button" class="mdi__exp" data-act="iexp" aria-label="Open full screen">${svg('expand')}</button></div>
      <div class="mdi__pcap"><b>${esc(p.cap)}</b>${p.ar ? ` <span lang="ar" dir="rtl">${esc(p.ar)}</span>` : ''}<span class="md__ctx">${esc(p.sub)} · ${esc(g.t)} ${ref.i + 1} / ${g.items.length}</span><small class="md__cr">${esc(credit(g, p))}</small></div></article>`;
  };
  const inboxHTML = () => {
    const solo = narrow(), showD = !solo || iOpen;
    return `<div class="mdi${solo ? ' is-one' : ''}${solo && iOpen ? ' is-open' : ''}"><nav class="md__tabs" role="tablist" aria-label="Media">${railHTML()}</nav>
      <section class="mdi__list" id="md-pane" role="tabpanel" aria-labelledby="md-tab-${tab}">${listHTML()}</section>
      <section class="mdi__detail" aria-live="polite">${showD ? detailHTML() : ''}</section></div>`;
  };
  const paintDetail = () => {
    const d = el.querySelector('.mdi__detail'); if (!d) return;
    d.innerHTML = detailHTML();
    el.querySelector('.md__tabs').innerHTML = railHTML();   // opening an announcement marks it read
    const dot = tab === 'news' && el.querySelector(`.mdi__row[data-id="${CSS.escape(isel.news || '')}"] .md__dot`); if (dot) dot.remove();
    if (tab === 'videos' && !iplay) sharpen(d.querySelector('.mdi__poster img'), ALLV[isel.videos]?.id);
  };
  const markRow = () => {
    el.querySelectorAll('.mdi__row.is-on').forEach((r) => r.classList.remove('is-on'));
    if (narrow()) return;
    const r = tab === 'news' ? el.querySelector(`.mdi__row[data-id="${CSS.escape(isel.news || '')}"]`) : el.querySelector(`.mdi__row[data-i="${isel[tab]}"]`);
    r?.classList.add('is-on'); r?.scrollIntoView({ block: 'nearest' });
  };
  const stepInboxPhoto = (d) => { feel.tap(); isel.photos = (isel.photos + d + ALLP.length) % ALLP.length; paintDetail(); markRow(); };

  /* ── render ── */
  const renderMain = () => {
    const m = el.querySelector('.md__main');
    m.className = `md__main is-${layout}`;
    m.innerHTML = layout === 'feed' ? feedHTML() : layout === 'stream' ? streamHTML() : inboxHTML();
    el.dataset.layout = layout;
    paintHeader();
    if (layout === 'stream') wireRows();
    if (layout === 'inbox' && tab === 'videos' && !iplay) sharpen(el.querySelector('.mdi__poster img'), ALLV[isel.videos]?.id);
    if (layout === 'inbox' && !narrow()) el.querySelector('.mdi__row.is-on')?.scrollIntoView({ block: 'nearest' });
  };
  el.innerHTML = `<header class="md__hd"><button type="button" class="md__ic" data-act="back" aria-label="Back">${svg('back')}</button><h2>Media</h2>
      <div class="md__tools"></div><div class="md__lays"></div></header>
    <div class="md__main"></div>`;
  renderMain();

  /* ── the player layer (feed / streaming) ── */
  const openTh = (i, from) => {
    if (thEl) thEl.remove();
    th = i; thReturn = from || null;
    const v = ALLV[i]; if (!v) { th = null; return; }
    thEl = document.createElement('div');
    thEl.className = 'md__th'; thEl.setAttribute('role', 'dialog'); thEl.setAttribute('aria-modal', 'true'); thEl.setAttribute('aria-label', 'Video');
    thEl.innerHTML = `<div class="md__lbbar"><button type="button" class="md__ic" data-act="novid" aria-label="Close video">${svg('back')}</button></div>
      <div class="md__player"><div class="md__frame" style="background-image:url('${yt(v.id)}')">${iframe(v)}</div>${playerMeta(v, true)}</div>`;
    el.append(thEl);
    requestAnimationFrame(() => thEl?.classList.add('is-on'));
    thEl.querySelector('.md__ic').focus({ preventScroll: true });
  };
  const closeTh = () => {
    feel.back();
    const node = thEl; th = null; thEl = null;
    node?.classList.remove('is-on');
    node?.querySelector('iframe')?.remove();   // stop the sound at once
    setTimeout(() => node?.remove(), reduced() ? 0 : 200);
    (thReturn?.isConnected ? thReturn : el).focus({ preventScroll: true }); thReturn = null;
  };

  /* ── the announcement layer (feed / streaming): a sheet from the right ── */
  const openSh = (id, from) => {
    const it = news.find((x) => x.id === id); if (!it) return;
    if (shEl) shEl.remove();
    sh = id; shReturn = from || null;
    markRead(id);
    shEl = document.createElement('div');
    shEl.className = 'md__sh'; shEl.setAttribute('role', 'dialog'); shEl.setAttribute('aria-modal', 'true'); shEl.setAttribute('aria-label', it.title);
    shEl.innerHTML = `<div class="md__shbg" data-act="shclose"></div><article class="nw__detail md__shp">
      <p class="nw__dh"><button type="button" class="md__ic" data-act="shclose" aria-label="Close announcement">${svg('back')}</button>${svg(it.icon)}<span>${esc(it.title)}</span></p>${newsBody(it)}</article>`;
    el.append(shEl);
    requestAnimationFrame(() => shEl?.classList.add('is-on'));
    shEl.querySelector('.md__ic').focus({ preventScroll: true });
    el.querySelectorAll(`[data-act="nopen"][data-id="${CSS.escape(id)}"] .md__dot`).forEach((d) => d.remove());
    paintHeader();
  };
  const closeSh = () => {
    feel.back();
    const node = shEl; sh = null; shEl = null;
    node?.classList.remove('is-on');
    setTimeout(() => node?.remove(), reduced() ? 0 : 220);
    (shReturn?.isConnected ? shReturn : el).focus({ preventScroll: true }); shReturn = null;
  };

  /* ── the photo viewer: big image, caption + credit, ‹ ›, swipe; Escape / back closes it first ── */
  const lbItem = () => { const g = PHOTOS[lb.g]; return { g, p: g.items[lb.i] }; };
  const paintLb = () => {
    const { g, p } = lbItem(), n = g.items.length;
    lbEl.querySelector('.md__lbn').textContent = `${g.t} · ${lb.i + 1} / ${n}`;
    const img = lbEl.querySelector('.md__lbimg');
    img.classList.toggle('is-cut', g.fit === 'cut' || g.fit === 'product' || !!p.cut);
    img.alt = p.cap; img.src = p.src;
    lbEl.querySelector('.md__lbcap').innerHTML = `<b>${esc(p.cap)}</b>${p.ar ? ` <span lang="ar" dir="rtl">${esc(p.ar)}</span>` : ''}<span class="md__ctx">${esc(p.sub)}</span><small class="md__cr">${esc(credit(g, p))}</small>`;
    lbEl.querySelectorAll('.md__lbnav').forEach((b) => { b.hidden = n < 2; });
    // the neighbours, so ‹ › feel instant
    [-1, 1].forEach((d) => { const q = g.items[(lb.i + d + n) % n]; if (q) { const im = new Image(); im.src = q.src; } });
  };
  const openLb = (gi, i, from) => {
    if (lbEl) lbEl.remove();
    lb = { g: gi, i }; lbReturn = from || null;
    lbEl = document.createElement('div');
    lbEl.className = 'md__lb'; lbEl.setAttribute('role', 'dialog'); lbEl.setAttribute('aria-modal', 'true'); lbEl.setAttribute('aria-label', 'Photo');
    lbEl.innerHTML = `<div class="md__lbbar"><button type="button" class="md__ic" data-act="lbclose" aria-label="Close photo">${svg('back')}</button><p class="md__lbn" aria-live="polite"></p></div>
      <div class="md__lbstage"><img class="md__lbimg" alt="" draggable="false"/>
        <button type="button" class="md__lbnav is-prev" data-act="lbstep" data-d="-1" aria-label="Previous photo">${svg('prev')}</button>
        <button type="button" class="md__lbnav is-next" data-act="lbstep" data-d="1" aria-label="Next photo">${svg('next')}</button></div>
      <div class="md__lbcap"></div>`;
    el.append(lbEl);
    paintLb();
    requestAnimationFrame(() => lbEl?.classList.add('is-on'));
    lbEl.querySelector('[data-act="lbclose"]').focus({ preventScroll: true });
    // swipe: a mostly-sideways drag of 40 px or more steps
    let sx = null, sy = 0;
    const stage = lbEl.querySelector('.md__lbstage');
    stage.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) stepLb(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { sx = null; });
  };
  const stepLb = (d) => { if (!lb) return; const n = PHOTOS[lb.g].items.length; if (n < 2) return; feel.tap(); lb.i = (lb.i + d + n) % n; paintLb(); };
  const closeLb = () => {
    feel.back();
    const node = lbEl; lb = null; lbEl = null;
    node?.classList.remove('is-on');
    setTimeout(() => node?.remove(), reduced() ? 0 : 200);
    (lbReturn?.isConnected ? lbReturn : el).focus({ preventScroll: true });
    lbReturn = null;
  };

  // inbox photos: a sideways swipe on the big image steps too
  let isx = null, isy = 0;
  el.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('.mdi__stage') || e.target.closest('button')) { isx = null; return; } isx = e.clientX; isy = e.clientY; });
  el.addEventListener('pointerup', (e) => {
    if (isx == null) return;
    const dx = e.clientX - isx, dy = e.clientY - isy; isx = null;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) stepInboxPhoto(dx < 0 ? 1 : -1);
  });

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !el.contains(b)) return;
    const a = b.dataset.act;
    if (a === 'back') return back();
    if (a === 'lbclose') return closeLb();
    if (a === 'lbstep') return stepLb(+b.dataset.d);
    if (a === 'novid') return closeTh();
    if (a === 'shclose') return closeSh();
    if (a === 'iback') return back();
    feel.tap();
    if (a === 'lay') {
      if (b.dataset.k === layout) return;
      layout = b.dataset.k; try { localStorage.setItem(LAYOUT_KEY, layout); } catch { /* private mode */ }
      iplay = false; iOpen = false;
      renderMain();
      el.querySelector(`.md__lay [data-k="${layout}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (a === 'filter') {
      if (b.dataset.k === filter) return;
      filter = b.dataset.k; renderMain();
      el.querySelector(`.md__chips [data-k="${filter}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (a === 'vid') return openTh(+b.dataset.i, b);
    if (a === 'ph') return openLb(+b.dataset.g, +b.dataset.i, b);
    if (a === 'nopen') return openSh(b.dataset.id, b);
    if (a === 'rowstep') {
      const tr = b.parentElement.querySelector('.mds__track');
      tr.scrollBy({ left: +b.dataset.d * tr.clientWidth * 0.85, behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
    if (a === 'rowjump') {
      const p = el.querySelector('.md__pane'), s = p?.querySelector(`#md-r-${b.dataset.k}`); if (!s) return;
      p.scrollTo({ top: s.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - 4, behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
    if (a === 'tab') {
      if (b.dataset.k === tab) return;
      tab = b.dataset.k; iplay = false; iOpen = false;
      renderMain();
      el.querySelector(`#md-tab-${tab}`)?.focus({ preventScroll: true });
      return;
    }
    if (a === 'isel') {
      if (tab === 'news') isel.news = b.dataset.id; else isel[tab] = +b.dataset.i;
      iplay = tab === 'videos';            // picking a video plays it
      if (narrow() && !iOpen) { iOpen = true; renderMain(); return; }
      paintDetail(); markRow();
      return;
    }
    if (a === 'iplay') { iplay = true; paintDetail(); return; }
    if (a === 'istep') return stepInboxPhoto(+b.dataset.d);
    if (a === 'iexp') { const r = ALLP[isel.photos]; if (r) openLb(r.g, r.i, b); return; }
    // the destination opens over the media page, which steps aside; that page's back returns here (as news.js does)
    if (a === 'go') { const me = el; me.classList.add('is-under'); onGo?.(b.dataset.go, () => { if (me.isConnected) { me.classList.remove('is-under'); me.focus({ preventScroll: true }); } }); }
  });
  // the inbox rail: arrow keys move between the tabs (the tablist pattern)
  el.addEventListener('keydown', (e) => {
    if (!e.target.closest?.('.md__tabs') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const i = TABS.findIndex(([k]) => k === tab), j = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + TABS.length) % TABS.length;
    el.querySelector(`#md-tab-${TABS[j][0]}`)?.click();
  });
  // turning a phone between upright and sideways switches the inbox between one column and two
  const mq = matchMedia(NARROW_Q);
  const onMq = () => { if (el.isConnected && layout === 'inbox') { iOpen = false; renderMain(); } };
  mq.addEventListener?.('change', onMq);
  new MutationObserver((_, o) => { if (!el.isConnected) { mq.removeEventListener?.('change', onMq); o.disconnect(); } }).observe(document.body, { childList: true });

  requestAnimationFrame(() => { el.classList.add('is-on'); el.focus({ preventScroll: true }); });
  return { close: () => close(), el };
}
