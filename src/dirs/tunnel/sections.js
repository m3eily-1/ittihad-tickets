// Everything after the hero, in the walk-out language: tunnel-gate fixtures, light sweeps,
// stencilled numbers, the swinging season-pass credential, the gate scanner, LED boards.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';
import { $, $$, fine, initMarquee } from '../../ui.js';
import { MATCHES, SEASON, VENUES, SPONSORS, LINKS, eventUrl, seasonUrl, when, countdown, pad, nextMatch } from '../../data.js';

gsap.registerPlugin(ScrollTrigger, Draggable);

/* ── links from data ── */
export function renderLinks() {
  const set = (sel, href) => $$(sel).forEach((a) => { a.href = href; });
  set('.js-appstore', LINKS.appStore);
  set('.js-playstore', LINKS.playStore);
  set('.js-resale', LINKS.resale);
  set('.js-about', LINKS.about);
  set('.js-store', LINKS.store);
  set('.js-x', LINKS.x);
  set('.js-ig', LINKS.instagram);
  set('.js-yt', LINKS.youtube);
  set('.js-snap', LINKS.snapchat);
  set('.js-season-link', seasonUrl(SEASON.slug));
}

/* ── countdowns: one ticker for the whole page ── */
const counts = [];
export function addCountdown(el, ts) {
  if (!el) return;
  el.innerHTML = ['d', 'h', 'm', 's'].map((k) => `<span><b data-k="${k}">00</b><i>${k}</i></span>`).join('');
  counts.push({ el, ts, b: $$('b', el) });
  tick();
}
function tick() {
  for (const c of counts) {
    const r = countdown(c.ts);
    if (r.done) { c.el.innerHTML = '<span class="is-live">Kicked off</span>'; continue; }
    const v = [r.d, r.h, r.m, r.s];
    c.b.forEach((b, i) => { const s = pad(v[i]); if (b.textContent !== s) b.textContent = s; });
  }
}
setInterval(tick, 1000);

/* ── fixtures: each one a gate with its own little tunnel ── */
function gateSvg() {
  // frames recede to a vanishing point; hovering slides them towards you (CSS)
  const frames = Array.from({ length: 7 }, (_, i) => `<rect class="gt-f" style="--i:${i}" x="-50" y="-30" width="100" height="60" />`).join('');
  const rays = [[-50, -30], [50, -30], [-50, 30], [50, 30], [-50, 0], [50, 0], [0, -30], [0, 30]]
    .map(([x, y]) => `<line x1="0" y1="0" x2="${x * 3}" y2="${y * 3}" />`).join('');
  return `<svg class="gate__tun" viewBox="-150 -90 300 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g class="gt-rays">${rays}</g><g class="gt-frames">${frames}</g></svg>`;
}

export function renderFixtures() {
  const list = $('.js-gates');
  list.innerHTML = MATCHES.map((m, i) => {
    const w = when(m.kickoff);
    return `<li class="gate" data-gate>
      <a class="gate__in" href="${eventUrl(m.slug)}" target="_blank" rel="noopener" aria-label="Book Al Ittihad vs ${m.opp}, ${w.day} ${w.date} ${w.month}">
        <div class="gate__vp">${gateSvg()}<span class="gate__glow"></span><img class="gate__crest" src="${m.crest}" alt="" /></div>
        <div class="gate__no"><span>Gate</span><b>${pad(i + 1)}</b></div>
        <div class="gate__date"><span>${w.day}</span><b>${w.date}</b><span>${w.month}</span><i>${w.time} AST</i></div>
        <div class="gate__main">
          <p class="gate__comp"><span class="gate__tag gate__tag--${m.comp}">${m.compLabel}</span><span>${m.round}</span></p>
          <h3 class="gate__teams"><span>Al Ittihad</span> <em>vs</em> <span>${m.opp}</span></h3>
          <p class="gate__venue">${m.venue}</p>
        </div>
        <div class="gate__side">
          <div class="gate__count js-gc" data-ts="${m.kickoff}"></div>
          <p class="gate__from">From <b>SAR ${m.from}</b></p>
          <span class="btn btn--y gate__btn"><span>Book tickets ↗</span></span>
        </div>
      </a>
    </li>`;
  }).join('');
  $$('.js-gc', list).forEach((el) => addCountdown(el, +el.dataset.ts));
  // floodlight follows the pointer across each gate
  $$('.gate__in', list).forEach((a) => {
    a.addEventListener('pointermove', (e) => {
      const r = a.getBoundingClientRect();
      a.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      a.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  });
}

/* ── light sweep across headings: a lit copy of the heading wiped on by scroll ── */
export function setupSweeps(still) {
  $$('.js-sweep').forEach((h) => {
    const html = h.innerHTML;
    h.innerHTML = `<span class="sw__base">${html}</span><span class="sw__lit" aria-hidden="true">${html}</span><span class="sw__glint" aria-hidden="true">${html}</span>`;
    if (still) { h.style.setProperty('--s', '130'); return; }
    gsap.fromTo(h, { '--s': -20 }, {
      '--s': 130, ease: 'none',
      scrollTrigger: { trigger: h, start: 'top 88%', end: 'top 30%', scrub: 0.6 },
    });
    // the heading itself rises out of the floor
    gsap.from(h, { rotateX: -55, y: 60, opacity: 0, transformOrigin: '50% 100%', duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 92%' } });
  });
}

/* ── reveals with tunnel perspective ── */
export function setupReveals(still) {
  if (still) return;
  $$('[data-gate]').forEach((g, i) => {
    gsap.from(g, {
      rotateX: -62, y: 90, opacity: 0, transformOrigin: '50% 100%', duration: 1.4, ease: 'expo.out', delay: i * 0.08,
      scrollTrigger: { trigger: g, start: 'top 92%' },
    });
  });
  gsap.from('.tn-head__aside, .tf__note', { opacity: 0, y: 24, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.tf', start: 'top 70%' } });
  $$('.ts__block, .ts__lede, .ts__buy, .ta__lede, .ta__badges').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 40, rotateX: -25, transformOrigin: '50% 100%', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
}

/* ── numbers: stencilled onto the wall, a spray-head light sweeping across ── */
export function setupWall(still) {
  const odo = (el, run = true) => {
    const to = +el.dataset.to, from = +el.dataset.from;
    if (!run) { el.textContent = to; return; }
    const o = { v: from };
    gsap.to(o, { v: to, duration: 1.8, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
  };
  $$('[data-wall]').forEach((it, i) => {
    const n = $('.js-odo', it);
    if (still) { odo(n, false); it.classList.add('is-sprayed'); return; }
    n.textContent = n.dataset.from;
    ScrollTrigger.create({
      trigger: it, start: 'top 85%', once: true,
      onEnter: () => gsap.delayedCall(i * 0.15, () => { it.classList.add('is-sprayed'); odo(n); }),
    });
  });
  const tag = $('.tw__tag');
  if (!still && tag) gsap.fromTo(tag, { xPercent: 8 }, { xPercent: -8, ease: 'none', scrollTrigger: { trigger: '.tw', start: 'top bottom', end: 'bottom top', scrub: true } });
}

/* ── season pass: a credential on a lanyard you can swing ── */
export function setupSeason(getVelocity, still) {
  $('.js-season-from').textContent = SEASON.from;
  $('.js-pass-title').textContent = SEASON.title;
  $('.js-pass-comps').innerHTML = SEASON.comps.map((c) => `<li>${c}</li>`).join('');
  $('.js-comps').innerHTML = SEASON.comps.map((c, i) => `<li><span>${pad(i + 1)}</span>${c}</li>`).join('');
  const vn = [VENUES.alinma, VENUES.faisal];
  $('.js-venues').innerHTML = SEASON.venues.map((v, i) => `<li><span class="ts__arrow">${i ? '↗' : '↖'}</span><b>${v}</b><small>${vn[i].area}</small></li>`).join('');
  $('.cred__code').innerHTML = Array.from({ length: 34 }, (_, i) => `<i style="width:${[1, 2, 3, 1, 2][(i * 7) % 5]}px"></i>`).join('');

  const lan = $('.js-lanyard');
  const card = $('.cred');
  if (still || !lan) return;
  gsap.set(lan, { transformOrigin: '50% 0%' });
  // idle sway that also reacts to scroll speed
  let ang = 0, vel = 0, dragging = false;
  const rotTo = gsap.quickSetter(lan, 'rotation', 'deg');
  gsap.ticker.add((_, dt) => {
    if (dragging) return;
    const s = Math.min(dt / 1000, 0.05);
    const kick = (getVelocity?.() || 0) * 0.02;
    vel += (-ang * 38 - vel * 2.6 + kick * 60) * s;
    ang += vel * s;
    rotTo(ang);
    card.style.setProperty('--sheen', `${50 + ang * 4}%`);
  });
  Draggable.create(lan, {
    type: 'rotation',
    bounds: { minRotation: -40, maxRotation: 40 },
    onPress() { dragging = true; },
    onDrag() { ang = this.rotation; card.style.setProperty('--sheen', `${50 + ang * 4}%`); },
    onRelease() { ang = this.rotation; vel = 0; dragging = false; },
  });
  if (fine()) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  }
  // it drops in on its strap and swings
  gsap.from(lan, { y: -220, opacity: 0, duration: 1.6, ease: 'elastic.out(1, 0.5)', scrollTrigger: { trigger: '.ts', start: 'top 65%', onEnter: () => { vel += 110; } } });
}

/* ── app: a ticket slides over the gate reader, the beam sweeps, the lamp goes gold ── */
export function setupApp(still) {
  const m = nextMatch();
  const w = when(m.kickoff);
  $('.js-mtk-match').innerHTML = `Al Ittihad <em>vs</em> ${m.opp}`;
  $('.js-mtk-when').textContent = `${w.day} ${w.date} ${w.month} · ${w.time} AST`;
  const code = $('.mtk__code');
  // deterministic pseudo-code pattern (decorative)
  let s = 1927;
  code.innerHTML = Array.from({ length: 121 }, () => { s = (s * 9301 + 49297) % 233280; return `<i class="${s / 233280 > 0.52 ? 'on' : ''}"></i>`; }).join('');
  const scan = $('.js-scan');
  if (still) { scan.classList.add('is-ok'); return; }
  const tl = gsap.timeline({ scrollTrigger: { trigger: scan, start: 'top 75%', end: 'center 40%', scrub: 0.8 } });
  tl.fromTo('.js-mtk', { xPercent: 70, yPercent: 30, rotation: 10, opacity: 0 }, { xPercent: 0, yPercent: 0, rotation: -4, opacity: 1, ease: 'power3.out', duration: 1 })
    .fromTo('.gate-scan__beam', { '--b': 0 }, { '--b': 1, ease: 'none', duration: 0.6 }, 0.75)
    .add(() => {}, 1.4);
  ScrollTrigger.create({ trigger: scan, start: 'center 52%', onEnter: () => scan.classList.add('is-ok'), onLeaveBack: () => scan.classList.remove('is-ok') });
}

/* ── partners on a pitch-side LED board ── */
export function renderPartners(getVelocity) {
  const track = $('.js-partners');
  track.innerHTML = SPONSORS.map(([k, name]) => `<span class="led__item"><img src="/sponsors/${k}-k.png" alt="${name}" loading="lazy" /></span><i class="led__sep">✶</i>`).join('');
  $('.js-partner-names').innerHTML = SPONSORS.map(([, name]) => `<li>${name}</li>`).join('');
  initMarquee(track, getVelocity, { speed: 46 });
  initMarquee($('.js-tape'), getVelocity, { speed: 40 });
  initMarquee($('.js-tape2'), getVelocity, { speed: 40, dir: 1 });
}

/* ── footer: a floodlight follows the pointer across the big words ── */
export function setupFooter() {
  const spot = $('.js-spot');
  if (!spot) return;
  const setX = gsap.quickTo(spot, '--fx', { duration: 0.6, ease: 'power3' });
  const setY = gsap.quickTo(spot, '--fy', { duration: 0.6, ease: 'power3' });
  spot.addEventListener('pointermove', (e) => {
    const r = spot.getBoundingClientRect();
    setX(((e.clientX - r.left) / r.width) * 100);
    setY(((e.clientY - r.top) / r.height) * 100);
  });
  gsap.fromTo(spot, { '--fx': 10 }, { '--fx': 70, ease: 'none', scrollTrigger: { trigger: spot, start: 'top bottom', end: 'bottom 60%', scrub: 1 } });
}
