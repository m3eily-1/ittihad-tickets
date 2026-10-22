// Media (Ahmed, 2026-10-22: the menu's "News" tab becomes "Media", with the videos and the images). One page, three
// tabs: Videos · Photos · News. Only what the project already has, each with its source:
// - Videos: the club's uploads (results-data.js CLUB_VIDEOS), every match's highlights (RESULTS[].videos) and the
//   trophy room's finals and celebrations (trophy-media.js; `official: false` = a fan re-upload of the broadcast,
//   tagged "Fan archive" without the uploader's name, as the trophy room shows them). All YouTube; they play here.
// - Photos: the club's aerial of Alinma Stadium (heroes/flyover.js), the squad cut-outs from spl.com.sa (squad.js),
//   the legends' Wikimedia Commons portraits with each one's credit (legends.js), the store's photos
//   (shop.ittihadclub.sa: products.js, jersey3d.js) and the match-day posters from the club's Webook feed (data.js).
//   Left out: season-pass.png and season-poster.png (no source anywhere in the code), aerial.jpg (a crop of
//   aerial-full.jpg) and jersey/height.png (a generated height map, not a photo).
// - News: the announcements from news.js (same list, detail, read state and "Go to").
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
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => matchMedia('(orientation: portrait) and (max-width: 760px)').matches;
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  news: '<path d="M3 10v4h3l7 4V6L6 10z M16 9a3 3 0 0 1 0 6 M18.5 6.5a7 7 0 0 1 0 11"/>',
  ball: '<path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z"/>',
  ticket: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z M14 7v12"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.news}</svg>`;
const yt = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
const ourSide = (r) => (/ittihad/i.test(r.home.name) ? 'home' : 'away');

/* ── videos: three groups, each video { id, tag, title, orig, source, context } ── */
const CLUB_TAG = { interview: 'Interview', feature: 'Feature', signing: 'New signing', highlights: 'Highlights' };
function videoGroups() {
  const club = [...CLUB_VIDEOS].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((v) => ({
    id: v.id, tag: CLUB_TAG[v.kind] || 'Video', title: v.titleEn || v.title, orig: v.titleEn ? v.title : '',
    source: v.channel, context: v.date || '',
  }));
  const matches = [...RESULTS].sort((a, b) => String(b.date).localeCompare(String(a.date))).flatMap((r) => (r.videos || []).map((v) => ({
    id: v.id, tag: 'Highlights', title: v.title, orig: '', source: v.channel,
    context: `${r.home.name} ${r.home.score}–${r.away.score} ${r.away.name} · ${COMPS[r.comp]?.label || r.comp}${r.round ? ` · ${r.round}` : ''} · ${r.date}`,
    score: `${r.home.score}–${r.away.score}`, us: ourSide(r),
  })));
  const trophies = TROPHY_VIDEOS_OK ? TROPHIES.flatMap((t) => (TROPHY_MEDIA[t.key]?.videos || []).map((v) => {
    const official = v.official !== false;
    return {
      id: v.id, tag: official ? (v.kind === 'final' ? 'Final' : 'Celebration') : 'Fan archive', fan: !official, title: v.title, orig: '',
      source: official ? v.channel : 'Fan re-upload of the broadcast', context: `${t.name}${v.year ? ` · ${v.year}` : ''}`,
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

let root = null;
export function openMedia({ matches = [], tab: startTab = 'news', onGo, onClose } = {}) {
  root?.remove();
  const el = root = document.createElement('div');
  el.className = 'md'; el.tabIndex = -1;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Media');
  document.body.append(el);

  const VIDEOS = videoGroups(), PHOTOS = photoGroups();
  const ALLV = VIDEOS.flatMap((g) => g.items);
  const news = newsItems({ matches });
  const read = new Set(load(READ_KEY, []));
  let tab = ['videos', 'photos', 'news'].includes(startTab) ? startTab : 'news';   // News first (Ahmed, 2026-10-22)
  let vid = null, vidScroll = 0;      // the playing video (index into ALLV) and where the grid was
  let lb = null;                      // the open photo { g, i }
  let nsel = news[0]?.id, nOpen = false;   // the selected announcement; nOpen: its detail is showing (phones upright)
  const scroll = {};                  // each tab's scroll, kept while switching

  const close = () => {
    feel.back();
    if (root === el) root = null;
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 250);
    onClose?.();
  };
  // one back, a step at a time: the photo, then the video, then the announcement (upright phones), then the page
  const back = () => {
    if (lb) { closeLb(); return; }
    if (tab === 'videos' && vid != null) { feel.back(); vid = null; renderPane(); pane().scrollTop = vidScroll; return; }
    if (tab === 'news' && nOpen && narrow()) { feel.back(); nOpen = false; renderPane(); return; }
    close();
  };

  for (const ev of ['wheel', 'pointerdown', 'touchstart', 'touchmove', 'keydown']) {
    el.addEventListener(ev, (e) => {
      e.stopPropagation();
      if (ev !== 'keydown') return;
      if (e.key === 'Escape') { e.preventDefault?.(); back(); }
      else if (lb && e.key === 'ArrowLeft') stepLb(-1);
      else if (lb && e.key === 'ArrowRight') stepLb(1);
    }, { passive: ev !== 'keydown' });
  }

  const pane = () => el.querySelector('.md__pane');
  const unread = () => news.filter((x) => !read.has(x.id)).length;
  const TABS = [['news', 'News'], ['videos', 'Videos'], ['photos', 'Photos']];
  const tabsHTML = () => TABS.map(([k, l]) => `<button type="button" role="tab" id="md-tab-${k}" aria-controls="md-pane" aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" class="${tab === k ? 'is-on' : ''}" data-act="tab" data-k="${k}">${l}${k === 'news' && unread() ? `<em aria-label="${unread()} unread">${unread()}</em>` : ''}</button>`).join('');

  const jump = (groups) => `<nav class="md__jump" aria-label="Jump to">${groups.map((g) => `<button type="button" data-act="jump" data-k="${g.k}">${esc(g.t)}<em>${g.items.length}</em></button>`).join('')}</nav>`;

  const videoTile = (v, i) => `<button type="button" class="md__vid${vid === i ? ' is-playing' : ''}" data-act="vid" data-i="${i}" aria-label="Play: ${esc(v.title)}${v.fan ? ' (fan archive)' : ''}">
      <span class="md__thumb"><img src="${yt(v.id)}" alt="" loading="lazy" decoding="async"/><span class="md__playic">${svg('play')}</span><i class="md__tag${v.fan ? ' is-fan' : ''}">${esc(v.tag)}</i></span>
      <b dir="auto">${esc(v.title)}</b><span class="md__src" dir="auto">${esc(v.source)}</span><span class="md__ctx">${esc(v.context)}</span></button>`;

  const player = () => {
    const v = ALLV[vid]; if (!v) return '';
    return `<div class="md__player">
      <div class="md__frame"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0" title="${esc(v.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
      <div class="md__pmeta"><i class="md__tag${v.fan ? ' is-fan' : ''}">${esc(v.tag)}</i><h3 dir="auto">${esc(v.title)}</h3>${v.orig ? `<p class="md__orig" dir="auto">${esc(v.orig)}</p>` : ''}
        <p class="md__src" dir="auto">${esc(v.source)}</p><p class="md__ctx">${esc(v.context)}</p>
        <div class="md__pacts"><button type="button" class="md__btn is-2" data-act="novid">Close video</button><a class="md__link" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}" target="_blank" rel="noopener">YouTube ↗</a></div></div></div>`;
  };

  const panes = {
    videos: () => {
      let n = 0;
      return `${player()}${jump(VIDEOS)}${VIDEOS.map((g) => `<section class="md__sec" id="md-g-${g.k}"><h3 class="md__grp">${esc(g.t)}<em>${g.items.length}</em></h3><p class="md__note">${esc(g.note)}</p>
        <div class="md__grid is-v">${g.items.map((v) => videoTile(v, n++)).join('')}</div></section>`).join('')}
        <p class="md__fine">Every video plays from YouTube; each id was checked on YouTube when it was added. Titles are the uploaders' own; the club videos' English titles are our translation.</p>`;
    },
    photos: () => `${jump(PHOTOS)}${PHOTOS.map((g, gi) => `<section class="md__sec" id="md-g-${g.k}"><h3 class="md__grp">${esc(g.t)}<em>${g.items.length}</em></h3><p class="md__note">${esc(g.credit)}</p>
        <div class="md__grid is-p is-${g.fit}">${g.items.map((p, i) => `<button type="button" class="md__ph" data-act="ph" data-g="${gi}" data-i="${i}" aria-label="Open photo: ${esc(p.cap)}">
          <span class="md__img${p.cut ? ' is-cut' : ''}"><img src="${esc(p.src)}" alt="" loading="lazy" decoding="async"/>${p.no != null ? `<i class="md__no">${p.no}</i>` : ''}</span>
          <b>${esc(p.cap)}</b>${p.own ? `<small class="md__cr">${esc(p.credit)}</small>` : `<span class="md__ctx">${esc(p.sub)}</span>`}</button>`).join('')}</div></section>`).join('')}`,
    news: () => {
      const it = news.find((x) => x.id === nsel) || news[0];
      const solo = narrow();
      const showDetail = !solo || nOpen;
      if (it && showDetail && !read.has(it.id)) { read.add(it.id); save(READ_KEY, [...read]); }
      const banner = (b) => {
        if (!b) return '';
        if (b.kind === 'match') return `<div class="nw__ban is-match"><img src="/teams/al-ittihad.png" alt=""/><em>VS</em>${b.crest ? `<img src="${esc(b.crest)}" alt=""/>` : ''}</div>`;
        return `<div class="nw__ban ${b.contain ? 'is-contain' : ''} ${b.top ? 'is-top' : ''}" style="background-image:url('${esc(b.src)}')"></div>`;
      };
      const list = `<section class="nw__list"><p class="nw__lh">${svg('news')}Announcements</p>
          <ul>${news.map((x) => `<li><button type="button" class="${!solo && x.id === it?.id ? 'is-on' : ''}" data-act="nsel" data-id="${esc(x.id)}">${svg(x.icon)}<span><b>${esc(x.title)}</b><em>${esc(x.when)}</em></span>${!read.has(x.id) ? '<i class="nw__dot" aria-label="Unread"></i>' : ''}</button></li>`).join('') || '<li class="nw__empty">Nothing here yet.</li>'}</ul></section>`;
      const detail = `<article class="nw__detail">${it ? `<p class="nw__dh">${svg(it.icon)}${esc(it.title)}</p>${banner(it.banner)}
          <div class="nw__text">${(Array.isArray(it.body) ? it.body : [it.body]).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
          <div class="nw__foot"><button type="button" class="nw__go" data-act="go" data-go="${esc(it.go)}">${esc(it.cta || 'Go to')}</button></div>` : ''}</article>`;
      return `<div class="nw__body is-solo md__news${solo ? ' is-one' : ''}">${solo ? (nOpen ? detail : list) : list + detail}</div>`;
    },
  };

  const renderPane = () => {
    const p = pane();
    p.className = `md__pane is-${tab}`;
    p.setAttribute('aria-labelledby', `md-tab-${tab}`);
    p.innerHTML = panes[tab]();
    el.querySelector('.md__tabs').innerHTML = tabsHTML();   // after the pane: opening an announcement marks it read
  };
  el.innerHTML = `<header class="md__hd"><button type="button" class="md__ic" data-act="back" aria-label="Back">${svg('back')}</button><h2>Media</h2></header>
    <nav class="md__tabs" role="tablist" aria-label="Media"></nav>
    <section class="md__pane" id="md-pane" role="tabpanel"></section>`;
  renderPane();

  /* ── the photo viewer: big image, caption + credit, ‹ ›, swipe; Escape / back closes it first ── */
  let lbEl = null, lbReturn = null;
  const lbItem = () => { const g = PHOTOS[lb.g]; return { g, p: g.items[lb.i] }; };
  const paintLb = () => {
    const { g, p } = lbItem(), n = g.items.length, credit = p.credit || g.credit;
    lbEl.querySelector('.md__lbn').textContent = `${g.t} · ${lb.i + 1} / ${n}`;
    const img = lbEl.querySelector('.md__lbimg');
    img.classList.toggle('is-cut', g.fit === 'cut' || g.fit === 'product' || !!p.cut);
    img.alt = p.cap; img.src = p.src;
    lbEl.querySelector('.md__lbcap').innerHTML = `<b>${esc(p.cap)}</b>${p.ar ? ` <span lang="ar" dir="rtl">${esc(p.ar)}</span>` : ''}<span class="md__ctx">${esc(p.sub)}</span><small class="md__cr">${esc(credit)}</small>`;
    lbEl.querySelectorAll('.md__lbnav').forEach((b) => { b.hidden = n < 2; });
    // the neighbours, so ‹ › feel instant
    [-1, 1].forEach((d) => { const q = g.items[(lb.i + d + n) % n]; if (q) { const im = new Image(); im.src = q.src; } });
  };
  const openLb = (gi, i, from) => {
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
    if (lbReturn?.isConnected) lbReturn.focus({ preventScroll: true });
    else el.focus({ preventScroll: true });
    lbReturn = null;
  };

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !el.contains(b)) return;
    const a = b.dataset.act;
    if (a === 'back') return back();
    if (a === 'lbclose') return closeLb();
    if (a === 'lbstep') return stepLb(+b.dataset.d);
    feel.tap();
    if (a === 'tab') {
      if (b.dataset.k === tab) return;
      scroll[tab] = pane().scrollTop;
      tab = b.dataset.k; vid = null;
      renderPane(); pane().scrollTop = scroll[tab] || 0;
      el.querySelector(`#md-tab-${tab}`)?.focus({ preventScroll: true });
      return;
    }
    if (a === 'jump') {
      const p = pane(), s = p.querySelector(`#md-g-${b.dataset.k}`); if (!s) return;
      p.scrollTo({ top: s.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - 2, behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
    if (a === 'vid') {
      if (vid == null) vidScroll = pane().scrollTop;
      vid = +b.dataset.i; renderPane(); pane().scrollTop = 0;
      el.querySelector('[data-act="novid"]')?.focus({ preventScroll: true });
      return;
    }
    if (a === 'novid') { vid = null; renderPane(); pane().scrollTop = vidScroll; return; }
    if (a === 'ph') return openLb(+b.dataset.g, +b.dataset.i, b);
    if (a === 'nsel') { nsel = b.dataset.id; nOpen = true; renderPane(); return; }
    // the destination opens over the media page, which steps aside; that page's back returns here (as news.js does)
    if (a === 'go') { const me = el; me.classList.add('is-under'); onGo?.(b.dataset.go, () => { if (me.isConnected) { me.classList.remove('is-under'); me.focus({ preventScroll: true }); } }); }
  });
  // tabs: arrow keys move between them (the tablist pattern)
  el.querySelector('.md__tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const i = TABS.findIndex(([k]) => k === tab), j = (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    el.querySelector(`#md-tab-${TABS[j][0]}`)?.click();
  });
  // turning a phone between upright and sideways switches the news between one column and two
  const mq = matchMedia('(orientation: portrait) and (max-width: 760px)');
  const onMq = () => { if (el.isConnected && tab === 'news') renderPane(); };
  mq.addEventListener?.('change', onMq);
  new MutationObserver((_, o) => { if (!el.isConnected) { mq.removeEventListener?.('change', onMq); o.disconnect(); } }).observe(document.body, { childList: true });

  requestAnimationFrame(() => { el.classList.add('is-on'); el.focus({ preventScroll: true }); });
  return { close: () => close(), el };
}
