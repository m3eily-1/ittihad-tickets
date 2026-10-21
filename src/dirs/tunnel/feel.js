// Game feel (Ahmed, 2026-10-21): button ticks, phone haptics, "+50 XP" pop-ups, confetti and a crowd roar.
// Sounds are synthesised with WebAudio (no files to load). Haptics use navigator.vibrate, which Android
// browsers support; iPhones ignore it. Everything is quiet when the chants are switched off (feel.muted).
let ctx = null;
const ac = () => {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
function tone(freq, dur, { type = 'sine', vol = 0.12, at = 0, slide = 0 } = {}) {
  const a = ac(); if (!a || feel.muted) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
// a burst of filtered noise: the crowd
function noise(dur, { vol = 0.25, from = 500, to = 1800, at = 0 } = {}) {
  const a = ac(); if (!a || feel.muted) return;
  const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + at;
  src.buffer = buf; f.type = 'bandpass'; f.Q.value = 0.6;
  f.frequency.setValueAtTime(from, t); f.frequency.linearRampToValueAtTime(to, t + dur * 0.35); f.frequency.linearRampToValueAtTime(from, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.18); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination); src.start(t); src.stop(t + dur + 0.05);
}
const buzz = (p) => { try { navigator.vibrate?.(p); } catch { /* not allowed */ } };

// confetti in club colours, on one fixed canvas that only exists while it's falling
function confetti({ n = 140, x = 0.5, y = 0.35 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
  c.className = 'fx-confetti'; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 400 });
  document.body.append(c);
  const g = c.getContext('2d'), cols = ['#ffea00', '#ffffff', '#111111', '#ffd400'];
  const ps = Array.from({ length: n }, () => ({ x: x * c.width, y: y * c.height, vx: (Math.random() - 0.5) * 22 * dpr, vy: (-Math.random() * 18 - 6) * dpr, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, w: (6 + Math.random() * 8) * dpr, h: (3 + Math.random() * 5) * dpr, col: cols[(Math.random() * cols.length) | 0] }));
  const t0 = performance.now();
  const step = () => {
    const k = (performance.now() - t0) / 1800;
    g.clearRect(0, 0, c.width, c.height);
    for (const p of ps) {
      p.vy += 0.55 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - k * k); g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    }
    if (k < 1) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

// "+50 XP" floating up from a point (or the top of the screen)
function pop(text, { x, y, big = false } = {}) {
  const el = document.createElement('div');
  el.className = `fx-pop${big ? ' is-big' : ''}`; el.textContent = text;
  el.style.left = `${x ?? innerWidth / 2}px`; el.style.top = `${y ?? innerHeight * 0.22}px`;
  document.body.append(el);
  el.addEventListener('animationend', () => el.remove());
}

export const feel = {
  muted: false,
  tap() { tone(880, 0.05, { type: 'triangle', vol: 0.06 }); buzz(8); },
  back() { tone(520, 0.06, { type: 'triangle', vol: 0.05 }); buzz(6); },
  xp(amount, at) { tone(1046, 0.08, { type: 'triangle', vol: 0.07 }); tone(1568, 0.12, { type: 'triangle', vol: 0.06, at: 0.07 }); pop(`+${amount} XP`, at); },
  goal() { noise(1.6, { vol: 0.32, from: 600, to: 2200 }); tone(523, 0.18, { type: 'square', vol: 0.04 }); tone(784, 0.3, { type: 'square', vol: 0.04, at: 0.12 }); buzz([30, 40, 60]); },
  miss() { noise(0.7, { vol: 0.12, from: 300, to: 500 }); tone(220, 0.3, { type: 'sawtooth', vol: 0.04, slide: 0.6 }); buzz(40); },
  roar() { noise(2.2, { vol: 0.34, from: 500, to: 2000 }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.08, at: i * 0.09 })); buzz([20, 30, 20, 30, 80]); },
  level(n) { this.win(); this.roar(); confetti({ n: 200 }); pop(`LEVEL ${n}`, { big: true }); },
  confetti,
  pop,
  buzz,
};
