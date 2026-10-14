// Hero A — the next fixture as a physical ticket. Drag (or click) the stub to tear it off;
// the ticket gets stamped and the booking CTA appears.
import gsap from 'gsap';
import { $, $$, fine } from '../ui.js';
import { nextMatch, when, countdown, pad, eventUrl } from '../data.js';

export function createTicket(root) {
  const m = nextMatch();
  const w = when(m.kickoff);
  const tk = $('.js-hero-ticket', root);
  const stage = $('.tk-stage', root);
  const stub = $('.tk__stub', root);
  const stamp = $('.tk__stamp', root);
  const after = $('.tk__after', root);
  const body = $('.tk__body', root);

  $('.js-tk-opp', root).textContent = m.opp;
  $('.js-tk-crest', root).src = m.crest;
  $('.js-tk-date', root).textContent = `${w.day} ${w.date} ${w.month}`;
  $('.js-tk-time', root).textContent = `${w.time} AST`;
  $('.js-tk-comp', root).textContent = m.comp === 'afc' ? 'AFC Elite' : `RSL · ${m.round.replace('Matchweek', 'MW')}`;
  $('.js-tk-venue', root).textContent = `◎ ${m.venue}, Jeddah`;
  $('.js-tk-stubday', root).textContent = w.day;
  $('.js-tk-stubdate', root).textContent = `${w.date}\n${w.month}`;
  $('.js-tk-code', root).textContent = `ITT-${m.oppCode}-${w.date}${w.month}`;
  $('.js-tk-book', root).href = eventUrl(m.slug);
  stub.tabIndex = 0;
  stub.setAttribute('role', 'button');
  stub.setAttribute('aria-label', `Tear the stub to book Al Ittihad vs ${m.opp}`);

  // barcode from the slug so it is stable per match
  const bars = $('.tk__bars', root);
  let seed = [...m.slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let x = 0, svg = '';
  while (x < 120) { const bw = 0.6 + rnd() * 2.2; if (rnd() > 0.35) svg += `<rect x="${x.toFixed(2)}" y="0" width="${bw.toFixed(2)}" height="28"/>`; x += bw + 0.4 + rnd(); }
  bars.innerHTML = svg;

  // live countdown
  const cd = $$('.js-tk-count b', root);
  const tickCount = () => { const c = countdown(m.kickoff); [c.d, c.h, c.m, c.s].forEach((v, i) => { cd[i].textContent = pad(v); }); };
  tickCount();
  const timer = setInterval(tickCount, 1000);

  // tilt + sheen
  const rxTo = gsap.quickTo(tk, 'rotationX', { duration: 0.8, ease: 'power3' });
  const ryTo = gsap.quickTo(tk, 'rotationY', { duration: 0.8, ease: 'power3' });
  const onMove = (e) => {
    if (dragging || !fine()) return;
    const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
    rxTo(ny * -10); ryTo(nx * 14);
    body.style.setProperty('--sheen', `${(nx * 160).toFixed(1)}%`);
  };
  addEventListener('pointermove', onMove);

  // outline type drifting behind
  const rows = $$('.js-hvt-row', root);
  let drift = 0;
  const onTick = (_, dt) => {
    drift += dt * 0.02;
    rows.forEach((r, i) => { r.style.transform = `translate3d(${((i ? drift : -drift) % 600) - (i ? 600 : 0)}px,0,0)`; });
  };
  gsap.ticker.add(onTick);

  // ── tearing
  const vertical = () => matchMedia('(max-width: 720px)').matches;
  let dragging = false, torn = false, sx = 0, sy = 0, moved = 0, pulled = 0;
  const pull = (d) => {
    const v = vertical();
    gsap.set(stub, v ? { rotation: Math.min(d * 0.1, 14), y: d * 0.25 } : { rotation: Math.min(d * 0.09, 16), x: d * 0.22 });
    // the perforation shakes harder as it gets close to giving
    gsap.set(body, { x: v ? 0 : -Math.min(d, 140) * 0.03, rotation: -Math.min(d, 140) * 0.012 });
  };
  const down = (e) => {
    if (torn) return;
    dragging = true; moved = 0; pulled = 0; sx = e.clientX; sy = e.clientY;
    stub.setPointerCapture(e.pointerId);
    gsap.to(tk, { rotationX: 0, rotationY: 0, duration: 0.4 });
  };
  const move = (e) => {
    if (!dragging) return;
    const d = vertical() ? Math.max(0, e.clientY - sy) : Math.max(0, e.clientX - sx);
    moved = Math.max(moved, Math.hypot(e.clientX - sx, e.clientY - sy));
    pulled = d;
    pull(d);
    if (d > 110) tear();
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    if (torn) return;
    if (moved < 6 || pulled > 55) { tear(); return; } // a plain click, or a decent pull, tears it
    gsap.to(stub, { rotation: 0, x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
    gsap.to(body, { x: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
  };
  stub.addEventListener('pointerdown', down);
  stub.addEventListener('pointermove', move);
  stub.addEventListener('pointerup', up);
  stub.addEventListener('pointercancel', up);
  stub.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tear(); } });

  function tear() {
    if (torn) return;
    torn = true; dragging = false;
    const v = vertical();
    stage.classList.add('is-torn');
    const tl = gsap.timeline();
    tl.to(stub, v
      ? { y: innerHeight * 0.9, x: 60, rotation: 24, duration: 1.1, ease: 'power2.in' }
      : { x: 220, y: innerHeight * 0.9, rotation: 48, duration: 1.15, ease: 'power2.in' }, 0)
      .to(stub, { autoAlpha: 0, duration: 0.2 }, 0.95)
      .to(body, { x: 0, rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 0)
      .to(tk, { x: v ? 0 : Math.min(innerWidth * 0.04, 60), duration: 0.8, ease: 'expo.out' }, 0.1)
      .fromTo(stamp, { opacity: 0, scale: 2.4 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'power4.in' }, 0.45)
      .to(tk, { y: 6, duration: 0.06, yoyo: true, repeat: 1 }, 0.8)
      .fromTo(after, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0.9);
  }

  $('.js-tk-reset', root).addEventListener('click', () => {
    torn = false;
    stage.classList.remove('is-torn');
    gsap.to(after, { autoAlpha: 0, duration: 0.3 });
    gsap.to(stamp, { opacity: 0, duration: 0.3 });
    gsap.to(tk, { x: 0, duration: 0.8, ease: 'expo.out' });
    gsap.fromTo(stub, { x: 0, y: -40, rotation: 0, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(2)', delay: 0.2 });
  });

  return {
    intro() {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.from($$('.js-hvt-row', root), { autoAlpha: 0, duration: 2 }, 0)
        .from($$('.kicker', root), { autoAlpha: 0, y: 16, duration: 1 }, 0.1)
        .from($$('.hvt__title .w > i', root), { yPercent: 115, duration: 1.3, stagger: 0.07 }, 0.15)
        .from(tk, { y: '60vh', rotationX: 50, rotationZ: -8, duration: 1.8, ease: 'expo.out' }, 0.25)
        .from($$('.hvt__hint', root), { autoAlpha: 0, duration: 1 }, 1.2)
        // a little tug on the stub so people discover it
        .to(stub, { rotation: 7, x: 10, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 }, 1.9);
      return tl;
    },
    destroy() {
      clearInterval(timer);
      removeEventListener('pointermove', onMove);
      gsap.ticker.remove(onTick);
      gsap.killTweensOf([tk, stub, body, stamp, after]);
      gsap.set([tk, stub, body, stamp, after], { clearProps: 'all' });
      stage.classList.remove('is-torn');
    },
  };
}
