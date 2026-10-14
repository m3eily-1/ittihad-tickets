// Season journey: a pinned horizontal run through the Tigers Season Pass 26/27 home fixtures.
// Only the feed's facts: matchweeks for MW1/5/6 (no dates, no results), live dates for the
// fixtures on sale. Desktop pins + scrubs with parallax layers; ≤720px / reduced motion it is a
// native horizontal swipe with scroll-snap.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$ } from '../../ui.js';
import { MATCHES, SEASON, VENUES, when, countdown, pad, eventUrl, seasonUrl } from '../../data.js';
import { seal, barcode } from './cards.js';

gsap.registerPlugin(ScrollTrigger);

const byOpp = (o) => MATCHES.find((m) => m.opp === o);

const STOPS = [
  { key: 'mw1', tag: 'MW 01', rail: 'MW01', opp: 'Al Kholood', letter: 'K', title: 'Matchweek 01', hl: 'Matchweek', hn: '01', comp: 'Saudi Pro League 26/27', venue: 'alinma' },
  { key: 'mw5', tag: 'MW 05', rail: 'MW05', opp: 'Al Nassr', letter: 'N', title: 'Matchweek 05', hl: 'Matchweek', hn: '05', comp: 'Saudi Pro League 26/27', venue: 'alinma' },
  { key: 'mw6', tag: 'MW 06', rail: 'MW06', opp: 'Al Fayha', letter: 'F', title: 'Matchweek 06', hl: 'Matchweek', hn: '06', comp: 'Saudi Pro League 26/27', venue: 'alinma' },
  { key: 'mw9', tag: 'MW 09', rail: 'MW09', opp: 'Al Shabab', title: 'Matchweek 09', hl: 'Matchweek', hn: '09', comp: 'Saudi Pro League 26/27', venue: 'faisal', detour: true, m: byOpp('Al Shabab') },
  { key: 'mw11', tag: 'MW 11', rail: 'MW11', opp: 'Diriyah', title: 'Matchweek 11', hl: 'Matchweek', hn: '11', comp: 'Saudi Pro League 26/27', venue: 'alinma', m: byOpp('Diriyah') },
  { key: 'afc', tag: 'ACLE', rail: 'ACLE', opp: 'Shabab Al Ahli', title: 'League stage', hl: 'League stage', hn: 'ACLE', comp: 'AFC Champions League Elite', venue: 'alinma', afc: true, m: byOpp('Shabab Al Ahli') },
];

function stopHTML(s, k) {
  const v = VENUES[s.venue];
  const art = s.m ? `<img class="jp__crestimg" src="${s.m.crest}" alt="${s.opp} crest" loading="lazy" />` : seal(s.opp, s.letter);
  const venueName = s.afc ? s.m.venue : v.name;
  const venueSub = s.afc ? `${v.name} · ${v.area}` : `${v.aka} · ${v.area}`;
  let live = '';
  if (s.m) {
    const w = when(s.m.kickoff);
    live = `<div class="jp__live">
      <div class="jp__when"><b>${w.day} ${w.date} ${w.month}</b><span>${w.time} Jeddah</span></div>
      <div class="jp__cd js-jr-cd" data-k="${s.m.kickoff}" aria-label="Time to kick-off">—</div>
      <a class="btn btn--y magnetic jp__book" href="${eventUrl(s.m.slug)}" target="_blank" rel="noopener"><span>Book · from SAR ${s.m.from}</span></a>
    </div>`;
  }
  const status = s.detour
    ? '<span class="jp__stamp jp__stamp--detour">Away from Alinma</span>'
    : `<span class="jp__stamp">Season pass fixture</span>`;
  const note = s.detour
    ? `<p class="jp__note"><b>Season-pass holders:</b> you pick your seat here from a notification in the Al-Ittihad Tickets app.</p>`
    : s.m ? '' : `<p class="jp__note">One of the home league fixtures on the 26/27 pass at ${v.name}.</p>`;
  return `<article class="jp jp--stop${s.detour ? ' jp--detour' : ''}${s.m ? ' jp--live' : ''}" data-stop="${k}" aria-label="${s.title}: Al-Ittihad vs ${s.opp}">
    <div class="jp__bg" data-depth="0.35" aria-hidden="true"><span>${s.tag}</span></div>
    ${s.detour ? '<div class="jp__grass" data-depth="0.18" aria-hidden="true"></div>' : '<div class="jp__aerial" data-depth="0.18" aria-hidden="true"></div>'}
    <div class="jp__art" data-depth="-0.22">${art}</div>
    <div class="jp__card" data-depth="-0.08">
      <div class="jp__cardtop"><span>Stop ${pad(k + 1)} · ${s.comp}</span>${status}</div>
      <h3 class="jp__h" aria-label="${s.title}"><span>${s.hl}</span><b>${s.hn}</b></h3>
      <p class="jp__vs">Al-Ittihad <i>vs</i> ${s.opp}</p>
      <dl class="jp__dl"><div><dt>Venue</dt><dd>${venueName}<small>${venueSub}</small></dd></div></dl>
      ${note}
      ${live}
      <div class="jp__perf" aria-hidden="true"></div>
      <div class="jp__foot">${barcode(`${s.key}-${s.opp}`)}<span>ITT · ${s.tag.replace(' ', '')} · 26/27</span></div>
    </div>
  </article>`;
}

export function setupJourney() {
  const sec = $('#journey');
  const track = $('.js-jr-track', sec);
  const intro = `<article class="jp jp--intro">
    <p class="kicker"><i class="dot"></i> 02 · Season journey</p>
    <h2 class="jp__big">The road <em>runs</em> through Alinma.</h2>
    <p class="jp__lede">The Tigers Season Pass ${SEASON.season} home fixtures at Alinma Stadium, card by card — with one detour across town.</p>
    <p class="jp__go"><span>Scroll</span><i aria-hidden="true"></i></p>
  </article>`;
  const end = `<article class="jp jp--end">
    <div class="jp__endart" aria-hidden="true"><img src="/img/season-pass.png" alt="" loading="lazy" /></div>
    <div class="jp__endcopy">
      <p class="kicker">End of the line · or the start of it</p>
      <h2 class="jp__big">One pass.<br /><em>Every stop.</em></h2>
      <p class="jp__lede">${SEASON.comps.join(' · ')}. Both home grounds.</p>
      <p class="jp__price"><small>From</small> SAR <b>${SEASON.from}</b> <small>incl. VAT</small></p>
      <a class="btn btn--y btn--lg magnetic" href="${seasonUrl(SEASON.slug)}" target="_blank" rel="noopener"><span>Secure your season pass</span></a>
    </div>
  </article>`;
  track.innerHTML = intro + STOPS.map(stopHTML).join('') + end;

  // rail
  const stopsEl = $('.js-jr-stops', sec);
  stopsEl.innerHTML = STOPS.map((s) => `<li class="${s.detour ? 'is-detour' : ''}${s.m ? ' is-live' : ''}"><i></i><span>${s.rail}</span></li>`).join('');
  const railItems = $$('li', stopsEl);
  const fill = $('.js-jr-fill', sec);
  const numEl = $('.js-jr-n', sec);
  $('.js-jr-t', sec).textContent = pad(STOPS.length);
  const panels = $$('.jp--stop', track);

  // live countdowns
  const cds = $$('.js-jr-cd', track);
  const tickCd = () => cds.forEach((el) => {
    const c = countdown(+el.dataset.k);
    el.innerHTML = c.done ? 'Kicked off' : `<b>${pad(c.d)}</b>d <b>${pad(c.h)}</b>h <b>${pad(c.m)}</b>m <b>${pad(c.s)}</b>s`;
  });
  tickCd();
  setInterval(tickCd, 1000);

  // place rail dots at each stop's share of the run
  let stopAt = [];
  const measure = (dist) => {
    stopAt = panels.map((p) => gsap.utils.clamp(0, 1, (p.offsetLeft + p.offsetWidth / 2 - innerWidth / 2) / Math.max(1, dist)));
    railItems.forEach((li, i) => { li.style.left = `${(stopAt[i] * 100).toFixed(2)}%`; });
  };
  let cur = -1;
  const setProgress = (p) => {
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
    let k = 0;
    stopAt.forEach((a, i) => { if (p >= a - 0.04) k = i; });
    if (p < stopAt[0] - 0.04) k = -1;
    if (k !== cur) {
      cur = k;
      railItems.forEach((li, i) => { li.classList.toggle('is-on', i === k); li.classList.toggle('is-past', i < k); });
      numEl.textContent = pad(Math.max(1, k + 1));
      panels.forEach((p2, i) => p2.classList.toggle('is-current', i === k));
    }
  };

  const mm = gsap.matchMedia();
  mm.add('(min-width: 721px) and (prefers-reduced-motion: no-preference)', () => {
    sec.classList.add('is-pinned');
    const dist = () => track.scrollWidth - innerWidth;
    const run = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: sec,
        start: 'top top',
        end: () => `+=${dist()}`,
        pin: true,
        scrub: 0.9,
        invalidateOnRefresh: true,
        onRefresh: () => measure(dist()),
        onUpdate: (self) => setProgress(self.progress),
      },
    });
    measure(dist());

    // parallax: each layer drifts at its own depth while its panel crosses the screen
    $$('[data-depth]', track).forEach((el) => {
      const d = +el.dataset.depth * 0.6;
      const panel = el.closest('.jp');
      gsap.fromTo(el, { xPercent: 0, x: () => innerWidth * d * 0.5 }, {
        x: () => -innerWidth * d * 0.5,
        ease: 'none',
        scrollTrigger: { trigger: panel, containerAnimation: run, start: 'left right', end: 'right left', scrub: true, invalidateOnRefresh: true },
      });
    });
    // seals and crests roll in
    $$('.jp__art', track).forEach((el) => {
      gsap.fromTo(el.firstElementChild, { rotation: -40, scale: 0.7 }, {
        rotation: 0, scale: 1, ease: 'none',
        scrollTrigger: { trigger: el.closest('.jp'), containerAnimation: run, start: 'left 95%', end: 'center 55%', scrub: true },
      });
    });
    // intro title wipes away as the run starts
    gsap.to('.jp--intro .jp__big, .jp--intro .jp__lede', {
      x: -120, opacity: 0.15, ease: 'none',
      scrollTrigger: { trigger: '.jp--intro', containerAnimation: run, start: 'left left', end: 'right left', scrub: true },
    });
    return () => { sec.classList.remove('is-pinned'); gsap.set(track, { x: 0 }); };
  });

  mm.add('(max-width: 720px), (prefers-reduced-motion: reduce)', () => {
    const scroller = track;
    const dist = () => scroller.scrollWidth - scroller.clientWidth;
    measure(dist() + innerWidth - scroller.clientWidth);
    const onScroll = () => setProgress(gsap.utils.clamp(0, 1, scroller.scrollLeft / Math.max(1, dist())));
    // measure again with the scroller's own geometry
    stopAt = panels.map((p) => gsap.utils.clamp(0, 1, (p.offsetLeft + p.offsetWidth / 2 - scroller.clientWidth / 2) / Math.max(1, dist())));
    railItems.forEach((li, i) => { li.style.left = `${(stopAt[i] * 100).toFixed(2)}%`; });
    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener('scroll', onScroll);
  });
}
