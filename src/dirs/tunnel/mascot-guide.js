// The onboarding guide's presenter: the club's tiger mascot in the #18 kit (Ahmed, 2026-10-20: "use the official
// artwork"; the design SOSFactory × 3e60 made for the Saudi Pro League's club mascots, 2016). The artwork is cut
// into three layers in public/img/mascot — body, head, lower jaw — so it can talk: the jaw drops and closes, the
// head nods and tilts, the body breathes, and it hops when it says hello. Positions are in the cut-out's own
// pixels (549 × 743).
const W = 549, H = 743;
const LAYERS = [
  ['body', 0, 210, 549, 533],
  ['head', 212, 0, 239, 262],
  ['jaw', 292, 205, 120, 59],
];
const pct = (v, of) => `${(v / of) * 100}%`;

export function createMascotView(host) {
  host.innerHTML = '';
  host.style.aspectRatio = `${W} / ${H}`;
  const el = {};
  // the head and jaw ride together in one frame that turns on the neck, so the jaw never slides off the face
  const headFrame = document.createElement('div');
  headFrame.className = 'th__tl th__tl--frame';
  Object.assign(headFrame.style, { inset: '0', transformOrigin: `${pct(336, W)} ${pct(251, H)}` });
  for (const [name, x, y, w, h] of LAYERS) {
    const img = new Image();
    img.src = `/img/mascot/${name}.webp`; img.alt = ''; img.draggable = false;
    img.className = `th__tl th__tl--${name}`;
    Object.assign(img.style, { left: pct(x, W), top: pct(y, H), width: pct(w, W), height: pct(h, H) });
    (name === 'body' ? host : headFrame).append(img); el[name] = img;
  }
  host.append(headFrame);
  el.body.style.transformOrigin = '50% 100%';
  let raf = 0, running = false, talking = false, hopT = -1, t0 = performance.now(), talkMix = 0;
  function frame() {
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    talkMix += ((talking ? 1 : 0) - talkMix) * 0.18;
    const breathe = Math.sin(t * 2.2);
    let hop = 0;
    if (hopT >= 0) { const k = (t - hopT) / 0.9; if (k >= 1) hopT = -1; else hop = Math.sin(k * Math.PI) * (1 - k * 0.3); }
    host.style.transform = `translateY(${-hop * 6}%) rotate(${Math.sin(t * 0.9) * 0.8}deg)`;
    el.body.style.transform = `scaleY(${1 + breathe * 0.006})`;
    const nod = talkMix * Math.sin(t * 8.5) * 2.2, tilt = Math.sin(t * 1.1) * 2.5 + talkMix * Math.sin(t * 3.1) * 1.5;
    headFrame.style.transform = `translateY(${breathe * -0.25}%) rotate(${tilt + nod * 0.35}deg)`;
    const open = talkMix * (0.5 + 0.5 * Math.sin(t * 15)) * Math.abs(Math.sin(t * 4.3));
    el.jaw.style.transform = `translateY(${open * 9}%)`;
    raf = requestAnimationFrame(frame);
  }
  return {
    start() { if (running) return; running = true; t0 = performance.now(); frame(); },
    stop() { running = false; cancelAnimationFrame(raf); },
    talk(on) { talking = on; },
    wave() { hopT = (performance.now() - t0) / 1000; },
  };
}
