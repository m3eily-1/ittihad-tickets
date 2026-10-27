// Section graphics: fixtures board, stat attack, venue graphic, second screen, sponsor slate, ticker.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, fine } from '../../ui.js';
import { MATCHES, SEASON, VENUES, SPONSORS, LINKS, eventUrl, seasonUrl, when, pad, nextMatch } from '../../data.js';
import { cdText } from './hero.js';
import { glitch } from './stinger.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const timers = [];
setInterval(() => timers.forEach(({ el, ts }) => { el.textContent = cdText(ts); }), 1000);

/* ── links + small bits of copy that come from data ── */
export function renderLinks() {
  $$('.js-resale').forEach((a) => { a.href = LINKS.resale; });
  $('.js-about').href = LINKS.about;
  $('.js-store').href = LINKS.store;
  $('.js-app-ios').href = LINKS.appStore;
  $('.js-app-and').href = LINKS.playStore;
  $('.js-socials').innerHTML = [
    ['twitter', LINKS.x, 'X'], ['instagram', LINKS.instagram, 'Instagram'],
    ['youtube', LINKS.youtube, 'YouTube'], ['snapchat', LINKS.snapchat, 'Snapchat'],
  ].map(([icon, href, name]) => `<a href="${href}" target="_blank" rel="noopener" aria-label="${name}"><img src="/icons/${icon}.svg" alt="" width="18" height="18" /></a>`).join('');

  const n = nextMatch(), w = when(n.kickoff);
  // the bug and the full-time board both point at the next fixture
  $('.js-bug-opp').textContent = n.oppCode;
  $('.js-bug-crest').src = n.crest;
  $('.js-bug-when').textContent = `${w.date} ${w.month} ${w.time}`;
  $('.js-bug-match').setAttribute('aria-label', `Next home match: Al Ittihad v ${n.opp}, ${w.day} ${w.date} ${w.month} ${w.time}`);
  timers.push({ el: $('.js-bug-cd'), ts: n.kickoff });
  $('.js-bug-cd').textContent = cdText(n.kickoff);
  $('.js-ft-next').href = eventUrl(n.slug);
  $('.js-ft-match').textContent = `Al Ittihad v ${n.opp}`;
  $('.js-ft-when').textContent = `${w.day} ${w.date} ${w.month} · ${w.time} AST`;
  // phone mock
  $('.js-ph-opp').textContent = n.oppCode;
  $('.js-ph-crest').src = n.crest;
  $('.js-ph-title').textContent = `Al Ittihad v ${n.opp}`;
  $('.js-ph-meta').textContent = `${w.day} ${w.date} ${w.month} · ${w.time} · ${n.venue}`;
  $('.js-ph-list').innerHTML = MATCHES.filter((m) => m !== n).map((m) => { const mw = when(m.kickoff); return `<li><img src="${m.crest}" alt="" />v ${esc(m.opp)}<span>${mw.date} ${mw.month}</span></li>`; }).join('');
  timers.push({ el: $('.js-ph-cd'), ts: n.kickoff });
  $('.js-ph-cd').textContent = cdText(n.kickoff);
}

/* ── ticker crawl ── */
export function tickerHTML() {
  const item = (a, b) => `<span class="tick__i"><b>${esc(a)}</b>${b}</span>`;
  const sep = '<i class="tick__sep" aria-hidden="true"></i>';
  const parts = MATCHES.map((m) => {
    const w = when(m.kickoff);
    return item(m.compLabel, `Al Ittihad <em>v</em> ${esc(m.opp)} · ${w.day} ${w.date} ${w.month} ${w.time} AST · ${esc(m.venue)} · <em>From SAR ${m.from}</em>`);
  });
  parts.push(item(`${SEASON.title} ${SEASON.season}`, `${SEASON.comps.join(' · ')} · <em>From SAR ${SEASON.from} incl. VAT</em>`));
  parts.push(item('Notice', 'Resale only on Webook · resell.webook.com'));
  return parts.join(sep) + sep;
}

/* ── fixtures: "upcoming on sale" graphic rows ── */
export function renderFixtures({ still }) {
  const list = $('.js-fixtures');
  $('.js-fx-n').textContent = MATCHES.length;
  list.innerHTML = MATCHES.map((m, i) => {
    const w = when(m.kickoff);
    return `<li class="fxc" data-i="${i}" data-comp="${m.comp}">
      <a class="fxc__a" href="${eventUrl(m.slug)}" target="_blank" rel="noopener" data-cursor data-cursor-label="Book" aria-label="Book Al Ittihad v ${esc(m.opp)}, ${w.day} ${w.date} ${w.month} ${w.time}, from SAR ${m.from}">
        <span class="fxc__slab" aria-hidden="true"></span>
        <span class="fxc__id">GFX ${pad(i + 1)}</span>
        <div class="fxc__date"><span>${w.day}</span><b>${w.date}</b><span>${w.month}</span></div>
        <div class="fxc__main">
          <p class="fxc__comp"><b>${esc(m.compLabel)}</b><span>${esc(m.round)}</span></p>
          <div class="fxc__teams">
            <span class="fxc__t"><img src="/teams/al-ittihad.png" alt="" /><b>Al Ittihad</b></span>
            <span class="fxc__ko"><small>KO</small>${w.time}</span>
            <span class="fxc__t fxc__t--away"><b>${esc(m.opp)}</b><img src="${m.crest}" alt="" /></span>
          </div>
          <p class="fxc__lt"><span>Venue</span>${esc(m.venue)} · Jeddah</p>
        </div>
        <div class="fxc__side">
          <p class="fxc__cd"><span>Kick-off in</span><b class="js-cd">${cdText(m.kickoff)}</b></p>
          <p class="fxc__from"><span>From</span><b>SAR ${m.from}</b></p>
          <span class="fxc__cta">Book <i aria-hidden="true">↗</i></span>
        </div>
      </a>
    </li>`;
  }).join('');
  $$('.fxc', list).forEach((li, i) => timers.push({ el: $('.js-cd', li), ts: MATCHES[i].kickoff }));

  // hover: the preview monitor follows the pointer with that match's official poster
  const pvw = $('.pvw'), img = $('.js-pvw');
  if (fine()) {
    const xTo = gsap.quickTo(pvw, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(pvw, 'y', { duration: 0.5, ease: 'power3' });
    let on = -1;
    list.addEventListener('pointermove', (e) => {
      xTo(Math.min(e.clientX + 28, innerWidth - 384)); yTo(Math.max(70, e.clientY - 178));
    });
    $$('.fxc', list).forEach((li, i) => {
      li.addEventListener('pointerenter', (e) => {
        if (on !== i) { img.src = MATCHES[i].poster; on = i; if (!still) glitch(pvw); }
        gsap.set(pvw, { x: Math.min(e.clientX + 28, innerWidth - 384), y: Math.max(70, e.clientY - 178) });
        pvw.classList.add('is-on');
        if (!still) glitch($('.fxc__teams', li));
      });
      li.addEventListener('pointerleave', () => pvw.classList.remove('is-on'));
    });
  }

  if (still) return;
  $$('.fxc', list).forEach((li) => {
    gsap.timeline({ scrollTrigger: { trigger: li, start: 'top 88%', once: true } })
      .fromTo(li, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'expo.inOut' })
      .from($('.fxc__date', li), { xPercent: -60, opacity: 0, duration: 0.7, ease: 'expo.out' }, 0.35)
      .from($$('.fxc__comp, .fxc__teams, .fxc__lt', li), { x: -30, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'expo.out' }, 0.4)
      .from($$('.fxc__side > *', li), { y: 14, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'expo.out' }, 0.55);
  });
}

/* ── season pass: stat attack ── */
export function setupSeason({ still }) {
  $('.js-sp-comps').innerHTML = SEASON.comps.map((c, i) => `<li><span>${pad(i + 1)}</span>${esc(c)}</li>`).join('');
  $('.js-sp-venues').innerHTML = SEASON.venues.map((v, i) => `<li><span>${pad(i + 1)}</span>${esc(v)}</li>`).join('');
  $('.js-sp-book').href = seasonUrl(SEASON.slug);
  $('.js-sp-line').textContent = `From SAR ${SEASON.from} incl. VAT · Season ${SEASON.season}`;
  $$('#season [data-count]').forEach((el) => { el.textContent = still ? el.dataset.count : '0'; });
  if (still) return;

  const stats = $$('.sp .stat');
  gsap.timeline({ scrollTrigger: { trigger: '.sp__grid', start: 'top 80%', once: true } })
    .fromTo(stats, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.9, stagger: 0.09, ease: 'expo.inOut' })
    .add(() => {
      $$('#season [data-count]').forEach((el, i) => {
        const o = { v: 0 }, to = +el.dataset.count;
        gsap.to(o, { v: to, duration: to > 10 ? 1.6 : 0.9, delay: i * 0.12, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
      });
    }, 0.3)
    .from($$('.sp .stat__list li, .sp .steps li'), { x: -24, opacity: 0, duration: 0.6, stagger: 0.05, ease: 'expo.out' }, 0.5)
    .from($$('.sp .stat__seg i'), { scaleX: 0, transformOrigin: '0 50%', duration: 0.7, stagger: 0.08, ease: 'expo.out' }, 0.5);
}

/* ── venues: telestrated aerial + relative position map ── */
const deg = (v, pos, neg) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;
function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function setupVenues({ still }) {
  const keys = Object.keys(VENUES);
  const tabs = $('.vn__tabs');
  const data = $('.js-vn-data');
  const mon = $('.js-vn-mon');
  const dist = km(VENUES.alinma, VENUES.faisal);

  tabs.innerHTML = keys.map((k, i) => `<button type="button" role="tab" class="vn__tab" data-k="${k}" aria-selected="${i === 0}"><span>${pad(i + 1)}</span>${esc(VENUES[k].name)}</button>`).join('');

  // map: both grounds projected with equal km scale, joined by their straight-line distance
  const map = $('.js-vn-map');
  const lat0 = (VENUES.alinma.lat + VENUES.faisal.lat) / 2, lng0 = (VENUES.alinma.lng + VENUES.faisal.lng) / 2;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.57;
  const s = 160 / (Math.abs(VENUES.alinma.lat - VENUES.faisal.lat) * ky); // px per km to fit 160px tall
  const P = (v) => [160 + (v.lng - lng0) * kx * s, 110 - (v.lat - lat0) * ky * s];
  const [ax, ay] = P(VENUES.alinma), [fx, fy] = P(VENUES.faisal);
  let grid = '';
  for (let x = 0; x <= 320; x += 20) grid += `<line x1="${x}" y1="0" x2="${x}" y2="220" />`;
  for (let y = 0; y <= 220; y += 20) grid += `<line x1="0" y1="${y}" x2="320" y2="${y}" />`;
  const label = (k, x, y, side) => `<g class="vn__pin" data-k="${k}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle class="vn__pulse" r="10" /><circle r="4.5" /><line x1="${side * 8}" y1="0" x2="${side * 30}" y2="0" />
      <text x="${side * 34}" y="-3" text-anchor="${side > 0 ? 'start' : 'end'}">${esc(VENUES[k].name).toUpperCase()}</text>
      <text class="vn__sub" x="${side * 34}" y="10" text-anchor="${side > 0 ? 'start' : 'end'}">${esc(VENUES[k].area).toUpperCase()}</text>
    </g>`;
  map.innerHTML = `<g class="vn__gridl">${grid}</g>
    <line class="vn__route" x1="${ax}" y1="${ay}" x2="${fx}" y2="${fy}" />
    <text class="vn__km" x="${(ax + fx) / 2 + 10}" y="${(ay + fy) / 2}" >≈ ${Math.round(dist)} KM</text>
    <g class="vn__n" transform="translate(296 26)"><path d="M0 -12 L6 6 L0 2 L-6 6 Z" /><text y="20" text-anchor="middle">N</text></g>
    ${label('alinma', ax, ay, -1)}${label('faisal', fx, fy, 1)}`;

  // position-only feed for the ground without an aerial
  let pos = '';
  for (let r = 40; r <= 200; r += 40) pos += `<circle cx="200" cy="200" r="${r}" />`;
  for (let x = 0; x <= 400; x += 25) pos += `<line x1="${x}" y1="0" x2="${x}" y2="400" class="f" />`;
  for (let y = 0; y <= 400; y += 25) pos += `<line x1="0" y1="${y}" x2="400" y2="${y}" class="f" />`;
  $('.js-vn-pos').innerHTML = `${pos}<g class="vn__sweep"><path d="M200 200 L200 0 A200 200 0 0 1 341 59 Z" /></g><circle cx="200" cy="200" r="7" class="dot" />`;

  const nextAt = (k) => MATCHES.filter((m) => m.venueKey === k);
  function show(k, first = false) {
    const v = VENUES[k];
    $$('.vn__tab', tabs).forEach((t) => { t.classList.toggle('is-on', t.dataset.k === k); t.setAttribute('aria-selected', String(t.dataset.k === k)); });
    $$('.vn__pin', map).forEach((p) => p.classList.toggle('is-on', p.dataset.k === k));
    mon.dataset.feed = k === 'alinma' ? 'aerial' : 'pos';
    $('.js-vn-feed').innerHTML = `<i></i>${k === 'alinma' ? 'Aerial' : 'Position'} · ${esc(v.name)}`;
    const ms = nextAt(k);
    data.innerHTML = `
      <p class="vn__name">${esc(v.name)}</p>
      <dl>
        <div><dt>Also known as</dt><dd>${esc(v.aka)}</dd></div>
        <div><dt>Area</dt><dd>${esc(v.area)}</dd></div>
        <div><dt>Lat</dt><dd class="mono">${deg(v.lat, 'N', 'S')}</dd></div>
        <div><dt>Lng</dt><dd class="mono">${deg(v.lng, 'E', 'W')}</dd></div>
        ${k === 'alinma' ? '<div><dt>Capacity</dt><dd>Roughly 62,000</dd></div>' : ''}
      </dl>
      <p class="vn__on">On sale here</p>
      <ul class="vn__ms">${ms.map((m) => { const w = when(m.kickoff); return `<li><a href="${eventUrl(m.slug)}" target="_blank" rel="noopener"><span>${w.date} ${w.month}</span><b>v ${esc(m.opp)}</b><i>SAR ${m.from}+ ↗</i></a></li>`; }).join('')}</ul>`;
    // coordinates scramble into place like a live readout
    const coord = $('.js-vn-coord');
    const target = `${deg(v.lat, 'N', 'S')} · ${deg(v.lng, 'E', 'W')}`;
    if (still || first) { coord.textContent = target; return; }
    glitch(mon);
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, duration: 0.7, ease: 'none',
      onUpdate: () => {
        const n = Math.floor(o.p * target.length);
        coord.textContent = target.slice(0, n) + target.slice(n).replace(/[0-9]/g, () => Math.floor(Math.random() * 10));
      },
    });
    gsap.from($$('dl > div, .vn__ms li', data), { x: 20, opacity: 0, duration: 0.5, stagger: 0.04, ease: 'expo.out' });
  }
  show('alinma', true);
  tabs.addEventListener('click', (e) => { const t = e.target.closest('.vn__tab'); if (t) show(t.dataset.k); });
  $$('.vn__pin', map).forEach((p) => p.addEventListener('click', () => show(p.dataset.k)));
  tabs.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const on = keys.findIndex((k) => $(`.vn__tab[data-k="${k}"]`).classList.contains('is-on'));
    const n = keys[(on + 1) % keys.length];
    show(n);
    $(`.vn__tab[data-k="${n}"]`).focus();
  });

  if (still) return;
  gsap.timeline({ scrollTrigger: { trigger: '.vn__stage', start: 'top 78%', once: true } })
    .fromTo('.vn__mon', { clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0% 0 0% 0)', duration: 1, ease: 'expo.inOut' })
    .from('.tele line', { scale: 0, transformOrigin: '50% 50%', duration: 0.9, ease: 'expo.out' }, 0.5)
    .from('.vn__panel > *', { x: 30, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'expo.out' }, 0.3)
    .from('.vn__route', { strokeDashoffset: 300, duration: 1.2, ease: 'power2.inOut' }, 0.7);
  // slow push-in on the aerial while it scrolls past
  gsap.fromTo('.vn__feed--aerial img', { scale: 1.18 }, { scale: 1.02, ease: 'none', scrollTrigger: { trigger: '.vn__stage', start: 'top bottom', end: 'bottom top', scrub: true } });
}

/* ── partners: sponsor slate that cycles, grid that drives it ── */
export function setupPartners({ still }) {
  const grid = $('.js-partners');
  grid.innerHTML = SPONSORS.map(([key, name], i) => `<li><button type="button" class="pt__cell" data-i="${i}" aria-label="${esc(name)}"><span class="pt__n">${pad(i + 1)}</span><img src="/sponsors/${key}-k.png" alt="${esc(name)}" loading="lazy" /></button></li>`).join('');
  const logo = $('.js-pt-logo'), name = $('.js-pt-name'), num = $('.js-pt-idx');
  const cells = $$('.pt__cell', grid);
  let i = -1, timer = null, inView = false, wipe = null;
  function show(n) {
    if (n === i) return;
    i = n;
    const [key, nm] = SPONSORS[n];
    cells.forEach((c, k) => c.classList.toggle('is-on', k === n));
    const swap = () => {
      logo.innerHTML = `<img src="/sponsors/${key}-k.png" alt="${esc(nm)}" />`;
      name.textContent = nm;
      num.textContent = `${pad(n + 1)} / ${pad(SPONSORS.length)}`;
    };
    if (still) return swap();
    // a yellow plate wipes across, the logo swaps underneath, the plate wipes off the other side
    wipe?.kill();
    wipe = gsap.timeline()
      .set('.pt__win', { '--wa': '0%', '--wb': '0%' })
      .to('.pt__win', { '--wb': '100%', duration: 0.3, ease: 'power3.in' })
      .add(swap)
      .to('.pt__win', { '--wa': '100%', duration: 0.38, ease: 'power3.out' })
      .fromTo(logo, { opacity: 0, scale: 1.08, filter: 'blur(6px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out' }, '<0.05')
      .fromTo(name, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'expo.out' }, '<0.05');
  }
  show(0);
  const loop = () => { clearInterval(timer); if (!still && inView) timer = setInterval(() => show((i + 1) % SPONSORS.length), 2200); };
  ScrollTrigger.create({ trigger: '.pt', start: 'top bottom', end: 'bottom top', onToggle: (s) => { inView = s.isActive; inView ? loop() : clearInterval(timer); } });
  cells.forEach((c, n) => {
    c.addEventListener('pointerenter', () => { show(n); clearInterval(timer); });
    c.addEventListener('focus', () => { show(n); clearInterval(timer); });
    c.addEventListener('click', () => show(n));
  });
  grid.addEventListener('pointerleave', loop);
  if (!still) gsap.from(cells, { opacity: 0, y: 16, duration: 0.6, stagger: 0.04, ease: 'expo.out', scrollTrigger: { trigger: grid, start: 'top 90%', once: true } });
}

/* ── section headers + odds and ends ── */
// one graphic header keys in: tag wipes on, title rises out of its masks, meta fades up
export function revealHead(h) {
  gsap.timeline({ scrollTrigger: { trigger: h, start: 'top 82%', once: true } })
    .fromTo($('.gh__tag', h), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'expo.inOut' })
    .from($$('.gh__title .w > i', h), { yPercent: 110, duration: 0.9, stagger: 0.05, ease: 'expo.out' }, 0.2)
    .from($$('.gh__meta, .ap__lede, .ap__badges', h), { opacity: 0, y: 12, duration: 0.7, stagger: 0.08, ease: 'expo.out' }, 0.45);
}

export function reveals({ still }) {
  if (still) return;
  $$('.gh, .ap__copy').forEach(revealHead);
  gsap.from('.phone', { y: 80, rotate: 6, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.ap', start: 'top 70%', once: true } });
  gsap.fromTo('.notice__in', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'expo.inOut', scrollTrigger: { trigger: '.notice', start: 'top 85%', once: true } });
  gsap.from('.ft__big .w > i', { yPercent: 110, duration: 1, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.ft', start: 'top 75%', once: true } });
}
