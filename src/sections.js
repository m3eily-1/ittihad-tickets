// Below-the-hero sections: fixtures, story, season pass, stadiums, steps, app, partners, footer.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, fine, reduced } from './ui.js';
import { MATCHES, SEASON, SPONSORS, when, countdown, pad, eventUrl, seasonUrl } from './data.js';

/* ── fixtures ─────────────────────────────────────────── */
export function setupFixtures() {
  const list = $('.js-fixtures');
  list.innerHTML = MATCHES.map((m, i) => {
    const w = when(m.kickoff);
    return `<li class="fxr" data-comp="${m.comp}" data-i="${i}">
      <a class="fxr__hit" href="${eventUrl(m.slug)}" target="_blank" rel="noopener" aria-label="Book Al Ittihad vs ${m.opp}, ${w.day} ${w.date} ${w.month}" style="position:absolute;inset:0;z-index:2"></a>
      <div class="fxr__date"><span>${w.day}</span><b>${w.date}</b><span>${w.month} · ${w.time}</span></div>
      <div class="fxr__teams"><img src="${m.crest}" alt="" loading="lazy" /><p class="fxr__opp"><small>Al Ittihad vs</small>${m.opp}</p></div>
      <p class="fxr__comp">${m.compLabel}<b>${m.round} · ${m.venue}</b></p>
      <div class="fxr__cd"><span class="fxr__mut">Kick-off in</span><b class="js-fx-cd" data-k="${m.kickoff}">—</b></div>
      <div class="fxr__buy"><p class="fxr__price"><span class="fxr__mut">From</span><b>SAR ${m.from}</b></p><span class="fxr__go" aria-hidden="true">→</span></div>
    </li>`;
  }).join('');

  // counts on the filter chips
  ['all', 'rsl', 'afc'].forEach((k) => { $(`.js-n-${k}`).textContent = k === 'all' ? MATCHES.length : MATCHES.filter((m) => m.comp === k).length; });

  const cds = $$('.js-fx-cd');
  const tick = () => cds.forEach((el) => { const c = countdown(+el.dataset.k); el.textContent = c.done ? 'Live' : `${c.d}d ${pad(c.h)}:${pad(c.m)}:${pad(c.s)}`; });
  tick();
  setInterval(tick, 1000);

  // filter chips: rows fold away and the rest settle
  $$('.filters button').forEach((b) => b.addEventListener('click', () => {
    $$('.filters button').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    const f = b.dataset.filter;
    const rows = $$('.fxr');
    gsap.to(rows, {
      autoAlpha: 0, y: -10, duration: 0.25, stagger: 0.03, onComplete: () => {
        rows.forEach((r) => r.classList.toggle('is-out', f !== 'all' && r.dataset.comp !== f));
        gsap.fromTo(rows.filter((r) => !r.classList.contains('is-out')), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07, ease: 'expo.out' });
        ScrollTrigger.refresh();
      },
    });
  }));

  // the official match poster floats after the cursor while hovering a row
  const pv = $('.fx-preview'), pin = $('.fx-preview__in');
  if (fine()) {
    const xTo = gsap.quickTo(pv, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(pv, 'y', { duration: 0.6, ease: 'power3' });
    const rTo = gsap.quickTo(pv, 'rotation', { duration: 0.8, ease: 'power3' });
    let lastX = 0, cur = -1;
    list.addEventListener('pointermove', (e) => {
      xTo(e.clientX + 30); yTo(e.clientY - 70);
      rTo(gsap.utils.clamp(-10, 10, (e.clientX - lastX) * 0.6));
      lastX = e.clientX;
    });
    $$('.fxr').forEach((row) => {
      row.addEventListener('pointerenter', () => {
        const i = +row.dataset.i;
        if (i !== cur) {
          cur = i;
          const im = new Image();
          im.src = MATCHES[i].poster; im.alt = '';
          pin.append(im);
          gsap.fromTo(im, { clipPath: 'inset(100% 0 0 0)', scale: 1.3 }, { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 0.7, ease: 'expo.out', onComplete: () => { while (pin.children.length > 1) pin.firstChild.remove(); } });
        }
        gsap.to(pv, { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' });
      });
      row.addEventListener('pointerleave', () => gsap.to(pv, { opacity: 0, scale: 0.7, duration: 0.4, ease: 'power3' }));
    });
  }
}

/* ── story: words light up as you scroll; numbers roll ─────── */
export function setupStory() {
  const words = $$('.story__big .w');
  const yellow = new Set(['tigers', 'chants', 'unforgettable']);
  words.forEach((w) => { if (yellow.has(w.textContent.toLowerCase().replace(/[^a-z]/g, ''))) w.dataset.y = '1'; });
  ScrollTrigger.create({
    trigger: '.story__big', start: 'top 80%', end: 'bottom 45%', scrub: true,
    onUpdate: (s) => {
      const n = Math.round(s.progress * words.length);
      words.forEach((w, i) => { w.classList.toggle('is-lit', i < n && !w.dataset.y); w.classList.toggle('is-y', i < n && !!w.dataset.y); });
    },
  });
  $$('.js-odo').forEach((el) => {
    const to = +el.dataset.to;
    const o = { v: to > 100 ? to - 120 : 0 };
    el.textContent = Math.round(o.v);
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 2.2, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } }) });
  });
}

/* ── season pass card ─────────────────────────────────── */
export function setupSeason() {
  $('.js-season-price').textContent = SEASON.from;
  $('.js-season-link').href = seasonUrl(SEASON.slug);
  const pass = $('.js-pass');
  const wrap = $('.season__card-wrap');
  const set = (x, y) => {
    pass.style.setProperty('--ry', `${(x - 0.5) * 26}deg`);
    pass.style.setProperty('--rx', `${(0.5 - y) * 22}deg`);
    pass.style.setProperty('--mx', `${x * 100}%`);
    pass.style.setProperty('--my', `${y * 100}%`);
  };
  wrap.addEventListener('pointermove', (e) => {
    const r = pass.getBoundingClientRect();
    set(gsap.utils.clamp(0, 1, (e.clientX - r.left) / r.width), gsap.utils.clamp(0, 1, (e.clientY - r.top) / r.height));
  });
  wrap.addEventListener('pointerleave', () => { pass.style.transition = 'transform .8s cubic-bezier(.19,1,.22,1)'; set(0.5, 0.5); setTimeout(() => { pass.style.transition = ''; }, 800); });
  pass.addEventListener('click', () => pass.classList.toggle('is-alt'));
  // card spins in on scroll; on touch it also sways with scroll so the foil moves
  gsap.from(pass, { rotationY: -70, rotationX: 20, y: 120, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.season', start: 'top 70%' } });
  if (!fine()) {
    ScrollTrigger.create({ trigger: '.season', start: 'top bottom', end: 'bottom top', onUpdate: (s) => set(0.5 + Math.sin(s.progress * Math.PI * 3) * 0.35, 0.4) });
  }
  // pass number rolls
  const no = $('.js-pass-no');
  ScrollTrigger.create({
    trigger: pass, start: 'top 80%', once: true, onEnter: () => {
      const o = { v: 0 };
      gsap.to(o, { v: 1927, duration: 2, ease: 'expo.out', onUpdate: () => { no.textContent = String(Math.round(o.v)).padStart(7, '0'); } });
    },
  });
  gsap.from('.season__comps li', { x: -40, opacity: 0, stagger: 0.08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.season__comps', start: 'top 85%' } });
}

/* ── stadiums accordion ─────────────────────────────────── */
export function setupVenues() {
  $$('.js-venue-list').forEach((ul) => {
    const ms = MATCHES.filter((m) => m.venueKey === ul.dataset.key);
    ul.innerHTML = ms.length
      ? ms.map((m) => { const w = when(m.kickoff); return `<li><b>vs ${m.opp}</b><span>${w.day} ${w.date} ${w.month} · ${w.time}</span></li>`; }).join('')
      : '<li class="is-empty">No matches on sale here right now</li>';
  });
  // coordinates "decode" in when a venue opens
  const decode = (el) => {
    const final = `${(+el.dataset.lat).toFixed(4)}° N   ${(+el.dataset.lng).toFixed(4)}° E`;
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, duration: 1.1, ease: 'power2.out', onUpdate: () => {
        const k = Math.floor(o.p * final.length);
        el.textContent = final.slice(0, k) + final.slice(k).replace(/[0-9]/g, () => Math.floor(Math.random() * 10));
      },
    });
  };
  const venues = $$('.venue');
  const open = (v) => {
    if (v.classList.contains('is-open')) return;
    venues.forEach((x) => x.classList.toggle('is-open', x === v));
    decode($('.js-coord', v));
  };
  venues.forEach((v) => {
    v.addEventListener('click', () => open(v));
    if (fine()) v.addEventListener('pointerenter', () => open(v));
  });
  ScrollTrigger.create({ trigger: '.venues__row', start: 'top 75%', once: true, onEnter: () => decode($('.venue.is-open .js-coord')) });
  $$('.js-coord').forEach((el) => { el.textContent = `${(+el.dataset.lat).toFixed(4)}° N   ${(+el.dataset.lng).toFixed(4)}° E`; });
  gsap.from(venues, { y: 80, opacity: 0, stagger: 0.12, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.venues__row', start: 'top 85%' } });
}

/* ── app phone + QR ─────────────────────────────────── */
export function setupApp() {
  const qr = $('.js-qr');
  const N = 25;
  const cells = [];
  const finder = (r, c) => {
    for (const [fr, fc] of [[0, 0], [0, N - 7], [N - 7, 0]]) {
      const y = r - fr, x = c - fc;
      if (y >= 0 && y < 7 && x >= 0 && x < 7) return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4) ? 1 : 0;
      if (y >= -1 && y <= 7 && x >= -1 && x <= 7) return 0;
    }
    return -1;
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const i = document.createElement('i');
    const f = finder(r, c);
    i.dataset.f = f;
    if (f === 0 || (f === -1 && Math.random() > 0.52)) i.className = 'off';
    qr.append(i);
    cells.push(i);
  }
  const free = cells.filter((c) => c.dataset.f === '-1');
  const scramble = () => free.forEach((c) => c.classList.toggle('off', Math.random() > 0.52));
  let sc;
  qr.addEventListener('pointerenter', () => { sc = setInterval(scramble, 90); });
  qr.addEventListener('pointerleave', () => clearInterval(sc));
  $('.js-mt-match').textContent = `vs ${MATCHES[0].opp}`;

  gsap.fromTo('.js-phone', { rotationY: -34, rotationX: 14, y: 120 }, { rotationY: -8, rotationX: 4, y: 0, ease: 'none', scrollTrigger: { trigger: '.app', start: 'top bottom', end: 'center center', scrub: 1 } });
}

/* ── partners ─────────────────────────────────── */
export function renderPartners() {
  $('.js-partners').innerHTML = SPONSORS.map(([k, n]) => `<img src="/sponsors/${k}-k.png" alt="${n}" loading="lazy" />`).join('');
}

/* ── footer ─────────────────────────────────── */
export function setupFooter() {
  const mega = $('.js-mega');
  if (fine()) {
    $('.foot').addEventListener('pointermove', (e) => { mega.style.setProperty('--sx', `${(e.clientX / innerWidth) * 60}px`); });
  }
  gsap.fromTo(mega, { yPercent: 40 }, { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  // letters bounce one after another on hover
  const big = $('.foot__big');
  big.addEventListener('pointerenter', () => gsap.fromTo($$('.c', big), { y: 0 }, { y: -18, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 1, stagger: 0.025 }));
}

/* ── generic scroll reveals ─────────────────────────────────── */
export function scrollReveals() {
  $$('.sec-title').forEach((h) => {
    gsap.from($$('.w > i', h), { yPercent: 115, rotation: 4, duration: 1.3, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 88%' } });
  });
  gsap.from('.fxr', { y: 60, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.fx', start: 'top 85%' } });
  gsap.from('.step', { y: 80, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.steps', start: 'top 85%' } });
  gsap.from('.stat', { y: 60, opacity: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: '.stats', start: 'top 88%' } });
  gsap.from('.resale', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.resale', start: 'top 92%' } });
  if (!reduced()) {
    gsap.to('.story__stripes', { xPercent: -8, ease: 'none', scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: true } });
  }
}
