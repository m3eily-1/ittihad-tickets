// The gym's drills (Ahmed, 2026-10-21: "mini drills on the equipment — sprint on the treadmill by tapping, a
// reaction-light wall, a press-up counter — for XP"). Tap a station in the room (gym.js tags them
// userData.click = 'gym:treadmill' | 'gym:lights' | 'gym:pressup') and a short drill opens over the room:
// how to play → 3-2-1 → 15–20 s of play → a result card (score, best, XP) with Retry / Back.
// The 3D room plays along through the gym module's API: the treadmill belt runs at your speed, the wall's
// lights mirror the overlay's, the mat glows with the press-up beat.
import './gym.css';
import { DRILLS } from './gym-drills.js';

let S = null;   // the open drill: { root, ctx, def, run, phase, raf, ... }
const XP_CAP = 50;

export function click(id, hit, ctx) {
  if (S) return;
  const key = id.split(':')[1];
  if (!DRILLS[key]) return;
  ctx.feel.tap();
  open(key, hit, ctx);
}
export function hover(id, ctx) { if (!S) ctx.room?.highlight?.(id); }
export function enter(ctx) { ctx.room?.clearLights?.('off'); }
export function leave(ctx) { close(); ctx.room?.highlight?.(null); }

function open(key, hit, ctx) {
  const def = DRILLS[key];
  const root = document.createElement('div');
  root.className = `gy gy--${key}`;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', def.title);
  root.innerHTML = `
    <div class="gy-bar"><i class="js-gy-bar"></i></div>
    <header class="gy-top">
      <button type="button" class="gy-back js-gy-back">← Back</button>
      <div class="gy-head"><h2 class="gy-h">${def.title}</h2></div>
      <div class="gy-clock"><b class="js-gy-time">${def.secs}</b><span>sec</span></div>
    </header>
    <div class="gy-stage js-gy-stage"></div>
    <div class="gy-count js-gy-count" aria-live="assertive"></div>
    <div class="gy-modal js-gy-modal"></div>`;
  document.body.append(root);
  // nothing in the drill reaches the 3D scene (it walks on WASD, looks on drag, zooms on wheel)
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'touchstart', 'touchmove', 'touchend', 'click', 'contextmenu', 'keydown']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: ev !== 'contextmenu' });
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  // on touch screens the tap that opened this is followed by a click that lands on whatever is now under the
  // finger (Start, the shade…): swallow clicks for a moment
  const born = performance.now();
  root.addEventListener('click', (e) => { if (performance.now() - born < 450) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  // which half of the screen the tapped point is on (the reaction grid goes to the other half)
  let side = 'right';
  const cam = ctx.scene?.camera;
  if (hit?.point && cam) side = hit.point.clone().project(cam).x < 0 ? 'right' : 'left';
  S = { root, ctx, def, key, side, phase: 'intro', raf: 0, run: null, last: 0, t: 0, treadmill: hit?.object?.userData?.treadmill ?? 1 };
  S.stage = root.querySelector('.js-gy-stage');
  S.timeEl = root.querySelector('.js-gy-time'); S.barEl = root.querySelector('.js-gy-bar');
  S.countEl = root.querySelector('.js-gy-count'); S.modal = root.querySelector('.js-gy-modal');
  root.querySelector('.js-gy-back').addEventListener('click', () => { ctx.feel.back(); close(); });
  addEventListener('keydown', onKey, true);
  S.run = def.mount(S.stage, api());
  intro();
  requestAnimationFrame(() => root.classList.add('is-on'));
  S.last = performance.now();
  S.raf = requestAnimationFrame(loop);
}

// what a drill can reach
function api() {
  const s = S;
  return {
    room: s.ctx.room, feel: s.ctx.feel, treadmill: s.treadmill, side: s.side,
    get playing() { return s.phase === 'play'; },
    get t() { return s.t; },
    secs: s.def.secs,
  };
}

function close() {
  if (!S) return;
  const s = S; S = null;
  cancelAnimationFrame(s.raf);
  removeEventListener('keydown', onKey, true);
  s.run?.destroy?.();
  const R = s.ctx.room;
  R?.setTreadmillSpeed?.(0, s.treadmill); R?.clearLights?.('off'); R?.pulseMat?.(0); R?.highlight?.(null);
  s.root.classList.remove('is-on');
  setTimeout(() => s.root.remove(), 220);
}

function onKey(e) {
  if (!S) return;
  if (e.key === 'Tab') return;
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); S.ctx.feel.back(); close(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && (S.phase === 'intro' || S.phase === 'result') && !e.repeat && !e.target.closest?.('button')) { e.preventDefault(); start(); return; }
  if (S.phase === 'play') S.run?.key?.(e);
}

function loop(now) {
  if (!S) return;
  const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
  if (S.phase === 'play') {
    S.t += dt;
    const left = Math.max(0, S.def.secs - S.t);
    S.timeEl.textContent = Math.ceil(left);
    S.barEl.style.transform = `scaleX(${left / S.def.secs})`;
    S.root.classList.toggle('is-last', left <= 3);
    S.run.frame?.(dt, S.t);
    if (left <= 0) finish();
  } else S.run.idle?.(dt);
  S.raf = requestAnimationFrame(loop);
}

function intro() {
  const { def, ctx } = S;
  const best = ctx.progress.best(`gym-${S.key}`);
  S.phase = 'intro';
  S.root.classList.remove('is-play', 'is-last');
  S.modal.innerHTML = `<div class="gy-card">
      <p class="gy-k">${def.kicker}</p>
      <h3 class="gy-card__h">${def.title}</h3>
      <p class="gy-card__how">${def.how}</p>
      <p class="gy-card__best">${best ? `Your best: <b>${best} ${def.unit}</b>` : `${def.secs} seconds · up to ${XP_CAP} XP`}</p>
      <div class="gy-card__btns"><button type="button" class="gy-btn js-gy-go">Start</button></div>
    </div>`;
  S.modal.classList.add('is-on');
  S.modal.querySelector('.js-gy-go').addEventListener('click', start);
  setTimeout(() => S?.modal.querySelector('.js-gy-go')?.focus({ preventScroll: true }), 60);
}

function start() {
  if (!S || S.phase === 'count' || S.phase === 'play') return;
  const s = S;
  s.ctx.feel.tap();
  s.modal.classList.remove('is-on'); s.modal.innerHTML = '';
  s.phase = 'count'; s.t = 0;
  s.timeEl.textContent = s.def.secs; s.barEl.style.transform = 'scaleX(1)';
  s.run.reset?.();
  s.root.classList.add('is-play');
  let n = 3;
  const tick = () => {
    if (S !== s) return;
    if (n > 0) { s.countEl.textContent = n; s.countEl.className = 'gy-count js-gy-count is-on'; s.ctx.feel.tap(); n--; s.cd = setTimeout(tick, 650); return; }
    s.countEl.textContent = 'GO'; s.countEl.className = 'gy-count js-gy-count is-on is-go';
    s.ctx.feel.buzz(30);
    setTimeout(() => { if (S === s) s.countEl.className = 'gy-count js-gy-count'; }, 500);
    s.phase = 'play'; s.t = 0;
    s.run.start?.();
  };
  void s.countEl.offsetWidth;
  tick();
}

function finish() {
  const s = S, { def, ctx } = s;
  s.phase = 'result';
  s.root.classList.remove('is-play', 'is-last');
  const r = s.run.end();   // { score, line }
  const score = Math.max(0, Math.round(r.score));
  const fresh = ctx.progress.setBest(`gym-${s.key}`, score);
  const best = ctx.progress.best(`gym-${s.key}`);
  const xp = Math.min(XP_CAP, Math.round(score * def.xpPer));
  if (xp > 0) ctx.progress.award(xp, def.title);
  ctx.feel.win();
  if (fresh && score > 0) ctx.feel.confetti({ n: 120, y: 0.3 });
  s.modal.innerHTML = `<div class="gy-card is-result">
      <p class="gy-k">${fresh && score > 0 ? 'New best' : 'Time'}</p>
      <div class="gy-res"><b>${score}</b><span>${def.unit}</span></div>
      <p class="gy-card__line">${r.line || ''}</p>
      <ul class="gy-res__meta"><li>Best <b>${best} ${def.unit}</b></li><li>${xp > 0 ? `<b>+${xp} XP</b>` : 'No XP this time'}</li></ul>
      <div class="gy-card__btns"><button type="button" class="gy-btn js-gy-go">Retry</button><button type="button" class="gy-btn is-ghost js-gy-out">Back</button></div>
    </div>`;
  s.modal.classList.add('is-on');
  s.modal.querySelector('.js-gy-go').addEventListener('click', start);
  s.modal.querySelector('.js-gy-out').addEventListener('click', () => { ctx.feel.back(); close(); });
  setTimeout(() => S?.modal.querySelector('.js-gy-go')?.focus({ preventScroll: true }), 60);
}
