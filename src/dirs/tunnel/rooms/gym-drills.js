// The three gym drills (rooms/gym-ui.js runs them). Each is { title, kicker, how, secs, unit, xpPer, mount }.
// mount(stage, api) builds its own markup in the stage and returns
//   { reset, start, frame(dt, t), idle(dt), key(e), end() → { score, line }, destroy }
// api = { room (gym.js module), feel, treadmill (index), side ('left' | 'right': away from the tapped point), playing, t, secs }.

// tap handler that fires on press, not release (fast drills), and never scrolls or zooms the page
const press = (el, fn) => el.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); fn(e); });
const rnd = (a, b) => a + Math.random() * (b - a);

/* ── treadmill sprint: alternate LEFT / RIGHT as fast as you can ── */
const sprint = {
  title: 'Treadmill sprint', kicker: 'Speed', secs: 15, unit: 'm', xpPer: 0.5,
  how: 'Tap <b>LEFT</b> and <b>RIGHT</b> in turn (or ← → keys) to run. Same foot twice and you stumble. Go as far as you can in 15 seconds.',
  mount(stage, api) {
    stage.innerHTML = `<div class="gy-sp">
        <div class="gy-sp__hud">
          <div class="gy-stat"><b class="js-d">0</b><span>metres</span></div>
          <div class="gy-sp__meter"><i class="js-m"></i><em class="js-kmh">0.0 km/h</em></div>
          <div class="gy-stat"><b class="js-top">0.0</b><span>top km/h</span></div>
        </div>
        <div class="gy-sp__pads">
          <button type="button" class="gy-pad js-l" aria-label="Left foot">LEFT<small>←</small></button>
          <button type="button" class="gy-pad js-r" aria-label="Right foot">RIGHT<small>→</small></button>
        </div>
      </div>`;
    const $ = (s) => stage.querySelector(s);
    const dEl = $('.js-d'), mEl = $('.js-m'), kEl = $('.js-kmh'), topEl = $('.js-top'), L = $('.js-l'), R = $('.js-r');
    const MAX = 11.5;   // m/s on the belt (41 km/h): no one gets there
    let v = 0, dist = 0, top = 0, next = null, steps = 0, stumbles = 0;
    const show = () => {
      dEl.textContent = Math.floor(dist);
      mEl.style.transform = `scaleX(${Math.min(1, v / MAX)})`;
      kEl.textContent = `${(v * 3.6).toFixed(1)} km/h`;
      topEl.textContent = (top * 3.6).toFixed(1);
      L.classList.toggle('is-next', api.playing && next !== 'R');
      R.classList.toggle('is-next', api.playing && next !== 'L');
    };
    const step = (foot) => {
      if (!api.playing) return;
      const el = foot === 'L' ? L : R;
      el.classList.remove('is-hit', 'is-bad'); void el.offsetWidth;
      if (next && foot !== next) { v *= 0.82; stumbles++; el.classList.add('is-bad'); api.feel.buzz(25); }
      else { v = Math.min(MAX, v + 0.95); steps++; el.classList.add('is-hit'); api.feel.tap(); }
      next = foot === 'L' ? 'R' : 'L';
      show();
    };
    press(L, () => step('L')); press(R, () => step('R'));
    return {
      reset() { v = 0; dist = 0; top = 0; next = null; steps = 0; stumbles = 0; api.room?.setTreadmillSpeed?.(0, api.treadmill); show(); },
      start() { show(); },
      frame(dt) {
        v = Math.max(0, v - v * 1.15 * dt);
        dist += v * dt; top = Math.max(top, v);
        api.room?.setTreadmillSpeed?.(v, api.treadmill);
        show();
      },
      idle(dt) { if (v > 0) { v = v < 0.05 ? 0 : v - v * 2.2 * dt; api.room?.setTreadmillSpeed?.(v, api.treadmill); show(); } },
      key(e) {
        const k = e.key.toLowerCase();
        if ((k === 'arrowleft' || k === 'a') && !e.repeat) { e.preventDefault(); step('L'); }
        if ((k === 'arrowright' || k === 'd') && !e.repeat) { e.preventDefault(); step('R'); }
      },
      end() {
        show();
        return { score: dist, line: `Top speed ${(top * 3.6).toFixed(1)} km/h · ${steps} strides${stumbles ? ` · ${stumbles} stumble${stumbles > 1 ? 's' : ''}` : ''}` };
      },
      destroy() { api.room?.setTreadmillSpeed?.(0, api.treadmill); },
    };
  },
};

/* ── reaction wall: lights pop on at random, tap them before they go out ── */
const lights = {
  title: 'Reaction wall', kicker: 'Reflexes', secs: 20, unit: 'hits', xpPer: 2,
  how: 'Lights pop on at random, here and on the wall. Tap each one before it goes out. Tapping a dark light costs you nothing but time.',
  mount(stage, api) {
    const N = 12;
    // the grid goes to the side away from where you tapped the wall, so the wall's own lights stay in view
    stage.innerHTML = `<div class="gy-rw is-${api.side === 'left' ? 'left' : 'right'}">
        <div class="gy-rw__grid">${Array.from({ length: N }, (_, i) => `<button type="button" class="gy-lamp" data-i="${i}" aria-label="Light ${i + 1}"></button>`).join('')}</div>
        <div class="gy-rw__stats"><div class="gy-stat"><b class="js-h">0</b><span>hits</span></div><div class="gy-stat"><b class="js-a">—</b><span>avg ms</span></div></div>
      </div>`;
    const lamps = [...stage.querySelectorAll('.gy-lamp')], hEl = stage.querySelector('.js-h'), aEl = stage.querySelector('.js-a');
    const R = api.room;
    let live = new Map(), wait = 0, hits = 0, misses = 0, wrong = 0, times = [], lastI = -1;
    const timers = new Set();
    const set = (i, st) => {
      const el = lamps[i];
      el.classList.remove('is-on', 'is-hit', 'is-miss');
      if (st !== 'off' && st !== 'idle') el.classList.add(`is-${st}`);
      R?.setLight?.(i, st);
    };
    const flash = (i, st, ms = 220) => { set(i, st); const id = setTimeout(() => { timers.delete(id); if (!live.has(i)) set(i, api.playing ? 'idle' : 'off'); }, ms); timers.add(id); };
    const avg = () => (times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0);
    const show = () => { hEl.textContent = hits; aEl.textContent = times.length ? avg() : '—'; };
    const light = (t) => {
      let i; do i = (Math.random() * N) | 0; while ((i === lastI || live.has(i)) && live.size < N - 1);
      lastI = i;
      const win = Math.max(0.6, 1.15 - t * 0.025);   // they get quicker
      live.set(i, { t0: performance.now(), until: t + win });
      set(i, 'on');
    };
    lamps.forEach((el, i) => press(el, () => {
      if (!api.playing) return;
      const L = live.get(i);
      if (L) { live.delete(i); hits++; times.push(performance.now() - L.t0); flash(i, 'hit'); api.feel.tap(); }
      else { wrong++; flash(i, 'miss', 160); api.feel.buzz(20); }
      show();
    }));
    return {
      reset() { for (const id of timers) clearTimeout(id); timers.clear(); live.clear(); hits = misses = wrong = 0; times = []; wait = 0.4; for (let i = 0; i < N; i++) set(i, 'idle'); show(); },
      start() {},
      frame(dt, t) {
        for (const [i, L] of live) if (t >= L.until) { live.delete(i); misses++; flash(i, 'miss', 260); }
        wait -= dt;
        if (wait <= 0 && live.size < (t > 9 ? 2 : 1)) { light(t); wait = rnd(0.18, t > 9 ? 0.45 : 0.6); }
      },
      end() {
        for (const i of live.keys()) set(i, 'off');
        live.clear();
        for (let i = 0; i < N; i++) set(i, 'off');
        show();
        return { score: hits, line: times.length ? `Average reaction ${avg()} ms · ${misses} missed${wrong ? ` · ${wrong} early` : ''}` : 'No lights caught — quicker next time' };
      },
      destroy() { for (const id of timers) clearTimeout(id); timers.clear(); R?.clearLights?.('off'); },
    };
  },
};

/* ── press-ups: tap when the pulsing ring meets the circle ── */
const pressup = {
  title: 'Press-up rhythm', kicker: 'Strength', secs: 20, unit: 'reps', xpPer: 2,
  how: 'Tap (or press Space) as the shrinking ring meets the yellow circle. Every on-time tap is a rep; the rhythm gets quicker.',
  mount(stage, api) {
    stage.innerHTML = `<div class="gy-pu js-pad">
        <div class="gy-stat"><b class="js-n">0</b><span>reps</span></div>
        <div class="gy-pu__mid">
          <svg class="gy-pu__fig" viewBox="0 0 200 90" aria-hidden="true"><line x1="10" y1="82" x2="190" y2="82" class="gy-pu__floor"/>
            <g class="js-body"><line x1="30" y1="78" x2="150" y2="78" class="gy-pu__torso"/><circle cx="164" cy="74" r="9" class="gy-pu__head"/></g>
            <line class="js-arm gy-pu__arm" x1="140" y1="82" x2="140" y2="78"/></svg>
          <div class="gy-pu__ring"><i class="gy-pu__pulse js-pulse"></i><b class="js-call"></b></div>
        </div>
        <div class="gy-stat"><b class="js-p">0</b><span>perfect</span></div>
      </div>`;
    const pad = stage.querySelector('.js-pad'), nEl = stage.querySelector('.js-n'), pEl = stage.querySelector('.js-p');
    const pulse = stage.querySelector('.js-pulse'), call = stage.querySelector('.js-call'), body = stage.querySelector('.js-body'), arm = stage.querySelector('.js-arm');
    const R = api.room;
    const PERFECT = 0.1, GOOD = 0.2;
    let beats = [], used = new Set(), reps = 0, perfect = 0, good = 0, off = 0, missed = 0, callT = 0;
    const period = (t) => 1.45 - 0.45 * Math.min(1, t / api.secs);
    const plan = () => { beats = []; let b = 1.2; while (b < api.secs + 2) { beats.push(b); b += period(b); } };
    const say = (txt, cls) => { call.textContent = txt; call.className = `js-call is-${cls}`; void call.offsetWidth; call.classList.add('is-pop'); callT = 0.6; };
    const show = () => { nEl.textContent = reps; pEl.textContent = perfect; };
    // where we are between beats: the ring shrinks from 2.3x to 1x on the beat; the body is down on the beat
    const pose = (t) => {
      let k = beats.findIndex((b) => b > t); if (k < 0) k = beats.length - 1;
      const prev = k > 0 ? beats[k - 1] : beats[0] - period(0), next = beats[k];
      const ph = Math.min(1, Math.max(0, (t - prev) / (next - prev)));
      pulse.style.transform = `scale(${1 + 1.3 * (1 - ph)})`;
      pulse.style.opacity = String(0.35 + 0.65 * ph);
      const down = (Math.cos(ph * Math.PI * 2) + 1) / 2;   // 1 on the beat, 0 between
      body.setAttribute('transform', `rotate(${-(1 - down) * 16} 30 78)`);
      const hy = 78 - (1 - down) * Math.sin((16 * Math.PI) / 180) * 110;
      arm.setAttribute('y2', hy.toFixed(1));
      R?.pulseMat?.(down);
    };
    const tap = () => {
      if (!api.playing) return;
      const t = api.t;
      let bi = -1, err = 9;
      beats.forEach((b, i) => { const d = Math.abs(t - b); if (d < err) { err = d; bi = i; } });
      if (bi < 0 || used.has(bi) || err > GOOD) {
        const dup = used.has(bi) && err <= GOOD;
        if (bi >= 0) used.add(bi);   // a tap off the beat uses that beat up (no mashing)
        off++; say(dup ? 'ONE PER BEAT' : 'OFF BEAT', 'off'); api.feel.buzz(25); pad.classList.remove('is-bad'); void pad.offsetWidth; pad.classList.add('is-bad'); return; }
      used.add(bi); reps++;
      if (err <= PERFECT) { perfect++; say('PERFECT', 'perfect'); } else { good++; say('GOOD', 'good'); }
      api.feel.tap(); api.feel.buzz(12);
      show();
    };
    press(pad, tap);
    return {
      reset() { plan(); used = new Set(); reps = perfect = good = off = missed = 0; call.textContent = ''; pose(0); show(); },
      start() {},
      frame(dt, t) {
        pose(t);
        beats.forEach((b, i) => { if (!used.has(i) && !used.has(`m${i}`) && t > b + GOOD) { used.add(`m${i}`); missed++; if (callT <= 0) say('MISS', 'off'); } });
        if (callT > 0) callT -= dt;
      },
      idle() { R?.pulseMat?.(0); },
      key(e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); tap(); } },
      end() { show(); R?.pulseMat?.(0); return { score: reps, line: `${perfect} perfect · ${good} good${missed ? ` · ${missed} missed` : ''}` }; },
      destroy() { R?.pulseMat?.(0); },
    };
  },
};

export const DRILLS = { treadmill: sprint, lights, pressup };
