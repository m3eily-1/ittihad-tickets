// Crowd sound for the walk-out. Ahmed's call (2026-10-08): the club's own official recording is the goal.
// Until that file arrives `CHANTS.src` stays null and a crowd is synthesised in the browser instead
// (Ahmed's call, 2026-10-11): a roar bed, rhythmic massed claps and stadium drums, no voices or words.
// Drop the recording in public/audio/ and set src (e.g. '/audio/ittihad-chants.mp3') to replace it.
//
// The sound follows the walk: muffled through the tunnel walls, opening up as you reach the mouth,
// full in the bowl, fading as you scroll on past the stadium. It plays only from the nav toggle
// (Ahmed's call: toggle only), and the choice is remembered on this device.
export const CHANTS = {
  src: null,
  credit: 'Official Al-Ittihad fan chants — courtesy of Al-Ittihad Club',
  synthCredit: 'Stadium atmosphere (synthesised placeholder until the official chants recording)',
};

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const store = {
  get: () => { try { return localStorage.getItem('itt-tunnel-sound'); } catch { return null; } },
  set: (v) => { try { localStorage.setItem('itt-tunnel-sound', v); } catch { /* private mode */ } },
};

/* ── the synthesised crowd ── */
function noiseBuffer(ctx, seconds = 4) {
  const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0; // pinkish: rolled-off white noise sounds like a distant crowd
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
  }
  return buf;
}

function createCrowd(ctx, out) {
  const noise = noiseBuffer(ctx);
  const clapNoise = noiseBuffer(ctx, 1);

  // roar bed: two bands of looping noise, slowly swelling like a crowd breathing
  const bed = ctx.createGain(); bed.gain.value = 0.55; bed.connect(out);
  for (const [f, q, g] of [[420, 0.7, 0.9], [1300, 0.9, 0.5]]) {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const amp = ctx.createGain(); amp.gain.value = g;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.05;
    const depth = ctx.createGain(); depth.gain.value = g * 0.35;
    lfo.connect(depth).connect(amp.gain);
    src.connect(bp).connect(amp).connect(bed);
    src.start(0, Math.random() * 3); lfo.start();
  }

  // massed claps: each clap is a cluster of short noise bursts with human timing spread
  const claps = ctx.createGain(); claps.gain.value = 0.9; claps.connect(out);
  const clapBp = ctx.createBiquadFilter(); clapBp.type = 'bandpass'; clapBp.frequency.value = 1600; clapBp.Q.value = 0.8;
  clapBp.connect(claps);
  function clap(t, level = 1) {
    for (let i = 0; i < 14; i++) {
      const s = ctx.createBufferSource(); s.buffer = clapNoise;
      const g = ctx.createGain();
      const at = Math.max(ctx.currentTime, t + (Math.random() - 0.5) * 0.045); // a stadium never claps in perfect sync
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.16 * level * (0.6 + Math.random() * 0.6), at + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0008, at + 0.09 + Math.random() * 0.04);
      s.playbackRate.value = 0.8 + Math.random() * 0.5;
      s.connect(g).connect(clapBp);
      s.start(at, Math.random() * 0.8, 0.15);
    }
  }

  // drums: a deep bass drum and a higher tom, as the ultras' drummers play
  const drums = ctx.createGain(); drums.gain.value = 0.8; drums.connect(out);
  function drum(t, low = true) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(low ? 120 : 210, t);
    o.frequency.exponentialRampToValueAtTime(low ? 48 : 110, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(low ? 0.9 : 0.45, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0008, t + (low ? 0.45 : 0.22));
    o.connect(g).connect(drums);
    o.start(t); o.stop(t + 0.5);
  }

  // the pattern (8 beats at 132 bpm): boom · boom · clap clap clap · boom-boom · clap
  const BEAT = 60 / 132;
  const PATTERN = [
    ['d', 0], ['c', 0], ['d', 1], ['c', 1], ['c', 2], ['c', 2.5], ['c', 3], ['t', 3],
    ['d', 4], ['c', 4], ['d', 5], ['c', 5], ['c', 6], ['c', 6.5], ['c', 7], ['d', 7], ['t', 7.5],
  ];
  let next = 0, timer = 0, running = false;
  function schedule() {
    while (next < ctx.currentTime + 0.6) {
      for (const [k, b] of PATTERN) {
        const t = next + b * BEAT;
        if (k === 'c') clap(t, b % 1 ? 0.75 : 1);
        else drum(t, k === 'd');
      }
      next += 8 * BEAT;
    }
  }
  return {
    start() { if (running) return; running = true; next = Math.max(next, ctx.currentTime + 0.1); schedule(); timer = setInterval(schedule, 200); },
    stop() { running = false; clearInterval(timer); },
  };
}

export function createChants(button) {
  // ?chants=/audio/file.mp3 tries a recording before it's wired in
  const SRC = new URLSearchParams(location.search).get('chants') || CHANTS.src;
  if (!button) return { update() {} };
  button.hidden = false;
  button.title = SRC ? CHANTS.credit : CHANTS.synthCredit;
  let ctx = null, audio = null, crowd = null, filter = null, gain = null, on = false;
  let walk = 0, pastHero = 0;

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    gain = ctx.createGain();
    gain.gain.value = 0;
    filter.connect(gain).connect(ctx.destination);
    if (SRC) {
      audio = new Audio(SRC);
      audio.loop = true;
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      ctx.createMediaElementSource(audio).connect(filter);
    } else {
      crowd = createCrowd(ctx, filter);
    }
  }

  function apply() {
    if (!ctx) return;
    // tunnel: faint and muffled; the mouth (walk ≈ 0.6) opens it up; the bowl is full and bright
    const open = smooth(0.5, 0.68, walk);
    const level = (0.12 + 0.88 * open) * (1 - pastHero) * (on ? 1 : 0);
    const now = ctx.currentTime;
    gain.gain.setTargetAtTime(level, now, 0.25);
    filter.frequency.setTargetAtTime(380 * Math.pow(18000 / 380, open), now, 0.3);
  }

  function set(v) {
    on = v;
    button.setAttribute('aria-pressed', String(on));
    button.classList.toggle('is-on', on);
    button.querySelector('b').textContent = on ? 'on' : 'off';
    store.set(on ? '1' : '0');
    if (on) {
      if (!ctx) build();
      ctx.resume();
      if (audio) audio.play().catch((e) => { console.warn('[chants] could not start', e); set(false); });
      crowd?.start();
    }
    apply();
    if (!on) setTimeout(() => { if (!on) { audio?.pause(); crowd?.stop(); } }, 900);
  }
  button.addEventListener('click', () => set(!on));
  // a remembered "on" still needs a gesture: the first click or key anywhere starts it
  if (store.get() === '1') {
    const resume = (e) => {
      removeEventListener('pointerdown', resume); removeEventListener('keydown', resume);
      if (e.target.closest?.('.js-sound')) return; // the toggle handles its own click
      set(true);
    };
    addEventListener('pointerdown', resume);
    addEventListener('keydown', resume);
  }

  return {
    // walk: the walk-out progress (0 changing room … 1 wide shot); past: 0 in the hero → 1 well below it
    update(w, past = 0) { walk = w; pastHero = past; apply(); },
    get state() { return { on, playing: audio ? !audio.paused : !!(crowd && on), gain: gain?.gain.value ?? 0, cutoff: filter?.frequency.value ?? 0 }; },
  };
}
