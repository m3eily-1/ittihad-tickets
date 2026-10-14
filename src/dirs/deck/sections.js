// Everything below the hero deck: the dealt hand of fixtures, the scroll-flipped season pass,
// the app wallet stack, the voided resale ticket, the partner card spread and the last-call footer.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, fine, reduced } from '../../ui.js';
import { MATCHES, TIERS, SEASON, VENUES, SPONSORS, LINKS, when, countdown, pad, eventUrl, seasonUrl, nextMatch } from '../../data.js';
import { barcode } from './cards.js';

gsap.registerPlugin(ScrollTrigger);

const cdText = (ts) => {
  const c = countdown(ts);
  return c.done ? 'Kicked off' : `<b>${pad(c.d)}</b>d <b>${pad(c.h)}</b>h <b>${pad(c.m)}</b>m <b>${pad(c.s)}</b>s`;
};

// hover tilt + moving sheen for any flat card
export function tilt(el, { max = 9, lift = 0 } = {}) {
  if (!fine() || reduced()) return;
  gsap.set(el, { transformPerspective: 1100 });
  const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
  const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
  const yy = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
    rx(-ny * max); ry(nx * max); yy(-lift);
    el.style.setProperty('--sx', (50 + nx * 90).toFixed(1));
    el.style.setProperty('--sy', (50 + ny * 90).toFixed(1));
    el.classList.add('is-hover');
  });
  el.addEventListener('pointerleave', () => { rx(0); ry(0); yy(0); el.classList.remove('is-hover'); });
}

/* ───────── 01 · the hand: every fixture, dealt face up ───────── */
export function setupHand() {
  const wrap = $('.js-hand');
  wrap.innerHTML = MATCHES.map((m, i) => {
    const w = when(m.kickoff);
    const tiers = TIERS[m.slug] || [];
    const prices = tiers.map((t) => t.price);
    const ladder = tiers.slice().sort((a, b) => a.price - b.price).map((t) => `<i style="--c:${t.color}" title="${t.name} · SAR ${t.price}"></i>`).join('');
    return `<article class="hc" data-i="${i}">
      <a class="hc__poster" href="${eventUrl(m.slug)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="${m.poster}" alt="" loading="lazy" /></a>
      <div class="hc__body">
        <p class="hc__comp"><b>${m.compLabel}</b><span>${m.round}</span></p>
        <div class="hc__date"><b>${w.date}</b><p><span>${w.day} · ${w.month}</span><span>${w.time} Jeddah</span></p></div>
        <div class="hc__teams">
          <img src="/teams/al-ittihad.png" alt="" loading="lazy" /><i>vs</i><img src="${m.crest}" alt="" loading="lazy" />
          <h3><small>Al-Ittihad vs</small>${m.opp}</h3>
        </div>
        <p class="hc__venue">${m.venue}<small>${VENUES[m.venueKey].area}, Jeddah</small></p>
        <div class="hc__ladder"><div class="hc__bar">${ladder}</div><span>${tiers.length} tiers · SAR ${Math.min(...prices)}–${Math.max(...prices)}</span></div>
        <p class="hc__cd"><span>Kick-off in</span><span class="js-hc-cd" data-k="${m.kickoff}">—</span></p>
      </div>
      <div class="hc__perf" aria-hidden="true"></div>
      <a class="hc__buy" href="${eventUrl(m.slug)}" target="_blank" rel="noopener" aria-label="Book Al-Ittihad vs ${m.opp}, ${w.day} ${w.date} ${w.month}, from SAR ${m.from}">
        <span class="hc__from">From<b>SAR ${m.from}</b></span>
        <span class="hc__go">Book this match <i>→</i></span>
      </a>
      <div class="hc__sheen" aria-hidden="true"></div>
    </article>`;
  }).join('');

  const cds = $$('.js-hc-cd', wrap);
  const t = () => cds.forEach((el) => { el.innerHTML = cdText(+el.dataset.k); });
  t();
  setInterval(t, 1000);
  const cards = $$('.hc', wrap);
  cards.forEach((c) => tilt(c, { max: 7, lift: 6 }));

  // deal: cards start as a pile in the middle and spread into their places as you scroll in
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    const rot = [-9, 4, 11];
    const tl = gsap.timeline({ scrollTrigger: { trigger: wrap, start: 'top 92%', end: 'top 28%', scrub: 0.8, invalidateOnRefresh: true } });
    cards.forEach((c, i) => {
      tl.fromTo(c, {
        x: () => (wrap.offsetWidth / 2) - (c.offsetLeft + c.offsetWidth / 2),
        y: () => 140 - i * 10,
        rotation: rot[i],
        rotationY: 0,
      }, { x: 0, y: 0, rotation: 0, ease: 'power2.out', duration: 1 }, i * 0.08);
    });
    tl.fromTo($$('.hc__body, .hc__buy', wrap), { opacity: 0.25 }, { opacity: 1, duration: 0.6, stagger: 0.05 }, 0.4);
  });
  mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    cards.forEach((c, i) => gsap.from(c, { y: 80, rotation: i % 2 ? 4 : -4, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 90%' } }));
  });
}

/* ───────── 03 · season pass: the card turns over as you read ───────── */
export function setupSeason() {
  $('.js-pc-comps').innerHTML = SEASON.comps.map((c, i) => `<li><i>${pad(i + 1)}</i>${c}</li>`).join('');
  $('.js-pc-venues').innerHTML = SEASON.venues.map((v) => `<li>${v}</li>`).join('');
  $('.js-pc-bars').innerHTML = barcode(SEASON.slug, { w: 200, h: 26 });
  $('.js-sp-comps').innerHTML = SEASON.comps.map((c, i) => `<li><span>${pad(i + 1)}</span><b>${c}</b></li>`).join('');
  $('.js-sp-price').textContent = SEASON.from;
  $('.js-pc-price').textContent = SEASON.from;
  $('.js-season-link').href = seasonUrl(SEASON.slug);

  const pc = $('.js-pc'), inner = $('.js-pc-in');
  let tapped = false;
  pc.addEventListener('click', () => {
    tapped = !tapped;
    gsap.to(pc, { rotationY: tapped ? 180 : 0, duration: 1.1, ease: 'expo.out' });
  });
  pc.setAttribute('role', 'button');
  pc.tabIndex = 0;
  pc.setAttribute('aria-label', 'Turn the season pass over');
  pc.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pc.click(); } });

  if (!reduced()) {
    gsap.fromTo(inner, { rotationY: -14, rotationX: 6 }, {
      rotationY: 180, rotationX: 0, ease: 'none',
      scrollTrigger: {
        trigger: '.sp__grid', start: 'top 55%', end: 'bottom 75%', scrub: 0.9,
        onUpdate: (self) => inner.style.setProperty('--sx', (self.progress * 100).toFixed(1)),
      },
    });
    gsap.from('.sp__step', { y: 50, rotation: (i) => (i ? 3 : -3), opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.sp__steps', start: 'top 85%' } });
    gsap.from('.sp__comps li', { x: -40, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.sp__comps', start: 'top 88%' } });
  }
}

/* ───────── 04 · app: wallet stack that splays into a hand ───────── */
export function setupApp() {
  $('.js-app-store').href = LINKS.appStore;
  $('.js-play-store').href = LINKS.playStore;
  const m = nextMatch();
  const w = when(m.kickoff);
  const later = MATCHES.find((x) => x.opp === 'Diriyah') || MATCHES[MATCHES.length - 1];
  const lw = when(later.kickoff);
  // decorative code grid (not a real ticket code)
  let seed = 1927;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const qr = Array.from({ length: 121 }, (_, i) => {
    const r = Math.floor(i / 11), c = i % 11;
    const finder = (r < 3 && c < 3) || (r < 3 && c > 7) || (r > 7 && c < 3);
    return `<i class="${finder || rnd() > 0.5 ? 'on' : ''}"></i>`;
  }).join('');
  $('.js-wallet').innerHTML = `
    <div class="wc wc--alert" style="--i:2">
      <div class="wc__head"><span>Kick-off alert</span><b>Sample</b></div>
      <p class="wc__big">Al-Ittihad vs ${later.opp}</p>
      <p class="wc__sub">${lw.day} ${lw.date} ${lw.month} · ${lw.time} · ${later.venue}</p>
    </div>
    <div class="wc wc--pass" style="--i:1">
      <div class="wc__head"><img src="/img/crest.png" alt="" width="20" height="22" /><span>Tigers Season Pass ${SEASON.season}</span><b>Sample</b></div>
      <p class="wc__big">Pick your seat</p>
      <p class="wc__sub">Seat selection for Prince Abdullah Al-Faisal arrives as an app notification.</p>
    </div>
    <div class="wc wc--tk" style="--i:0">
      <div class="wc__head"><img src="/img/crest.png" alt="" width="20" height="22" /><span>Match ticket</span><b>Sample</b></div>
      <p class="wc__big">Al-Ittihad vs ${m.opp}</p>
      <p class="wc__sub">${w.day} ${w.date} ${w.month} · ${w.time} · ${m.venue}</p>
      <div class="wc__code"><div class="wc__qr">${qr}</div><p>Your match code lives here — show it at the gate.</p></div>
    </div>`;
  const cards = $$('.wc');
  if (reduced()) return;
  const mm = gsap.matchMedia();
  mm.add('(min-width: 721px)', () => {
    gsap.timeline({ scrollTrigger: { trigger: '.wallet', start: 'top 75%', end: 'center 45%', scrub: 0.8 } })
      .fromTo(cards, { y: (i) => -(2 - i) * 60, x: 0, rotation: 0 }, { y: (i) => [-50, 10, 80][i], x: (i) => [-200, -20, 160][i], rotation: (i) => [-13, -3, 8][i], ease: 'power2.out' });
  });
  mm.add('(max-width: 720px)', () => {
    gsap.timeline({ scrollTrigger: { trigger: '.wallet', start: 'top 85%', end: 'top 30%', scrub: 0.8 } })
      .fromTo(cards, { y: (i) => (2 - i) * 70, rotation: 0 }, { y: 0, rotation: (i) => [-3, 2, -1][i], ease: 'power2.out' });
  });
}

/* ───────── resale: the ticket gets stamped void ───────── */
export function setupResale() {
  $$('.js-resale').forEach((a) => { a.href = LINKS.resale; });
  if (reduced()) return;
  gsap.timeline({ scrollTrigger: { trigger: '.js-rs', start: 'top 72%' } })
    .from('.js-rs', { y: 60, rotation: -2, opacity: 0, duration: 1, ease: 'expo.out' })
    .from('.js-rs-stamp', { scale: 2.6, rotation: -40, opacity: 0, duration: 0.42, ease: 'power4.in' }, 0.45)
    .to('.js-rs', { x: 6, duration: 0.05, yoyo: true, repeat: 3, ease: 'none' });
}

/* ───────── partners: a spread of logo cards flipped face up ───────── */
export function setupPartners() {
  const ul = $('.js-partners');
  ul.innerHTML = SPONSORS.map(([k, name], i) => `<li class="pc2">
    <div class="pc2__in">
      <span class="pc2__n">${pad(i + 1)}</span>
      <img src="/sponsors/${k}-k.png" alt="${name}" loading="lazy" />
      <span class="pc2__name">${name}</span>
      <div class="pc2__sheen" aria-hidden="true"></div>
    </div>
    <div class="pc2__back" aria-hidden="true"><img src="/img/crest.png" alt="" /></div>
  </li>`).join('');
  const items = $$('.pc2', ul);
  items.forEach((el) => tilt($('.pc2__in', el), { max: 14, lift: 8 }));
  if (reduced()) return;
  gsap.fromTo(items, { rotationY: -180 }, {
    rotationY: 0, duration: 1.2, ease: 'expo.out', stagger: { each: 0.07, from: 'start' },
    scrollTrigger: { trigger: ul, start: 'top 85%' },
  });
}

/* ───────── footer: last-call ticket + links ───────── */
export function setupFooter() {
  const m = nextMatch();
  const w = when(m.kickoff);
  $('.js-last-match').innerHTML = `<span>Al-Ittihad vs</span>${m.opp}`;
  $('.js-last-when').textContent = `${w.day} ${w.date} ${w.month} · ${w.time} Jeddah · ${m.compLabel}, ${m.round} · ${m.venue}`;
  $('.js-last-book').href = eventUrl(m.slug);
  const cd = $('.js-last-cd');
  const t = () => { cd.innerHTML = cdText(m.kickoff); };
  t();
  setInterval(t, 1000);
  $('.js-about').href = LINKS.about;
  $('.js-store').href = LINKS.store;
  $('.js-x').href = LINKS.x;
  $('.js-ig').href = LINKS.instagram;
  $('.js-yt').href = LINKS.youtube;
  $('.js-sc').href = LINKS.snapchat;
  if (reduced()) return;
  gsap.from('.js-last', { y: 80, rotation: 1.5, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.js-last', start: 'top 88%' } });
}

/* ───────── headings rise out of their masks ───────── */
export function revealHeadings() {
  if (reduced()) return;
  $$('.js-split').forEach((h) => {
    gsap.from($$('.w > i', h), { yPercent: 110, duration: 1.1, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 86%' } });
  });
}
