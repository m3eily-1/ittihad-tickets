// Mini-games (2026-10-21): three quick 2D games as full-screen overlays above the tunnel menu.
//   keepy   — keepy-uppy with a canvas football
//   quiz    — five questions built only from the Hall of Fame facts in legends.js
//   predict — predict the score of the next home match (stored in this browser, not checked yet)
//
//   const mg = mountMiniGames();
//   mg.open('keepy' | 'quiz' | 'predict', { onClose, match, compLabel });
//   mg.close();  mg.active  → the open game's name, or null
//
// Each open builds its game from scratch; close stops its loops, removes its listeners and empties the root.
import './minigames.css';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { LEGENDS } from './legends.js';
import { FIXTURES } from './fixtures.js';
import { openFriends } from './social.js';
import { fanEvent } from './fan-events.js';
import { tiers, TIER_LABEL, starRow } from './tiers.js';
import { myWeek } from './fz-core.js';
import { openShare } from './share-card.js';
import { SQUAD } from './squad.js';

const ITT_CREST = '/teams/al-ittihad.png';
const MASCOT = '/img/mascot/full.webp';
const PREDICT_KEY = 'itt-predict-v1';
const TAU = Math.PI * 2;

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
};
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ───────────────────────── shell ─────────────────────────
export function mountMiniGames() {
  const root = h('div', { class: 'mg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Mini-game', hidden: true });
  document.body.append(root);
  let active = null, opts = {}, cleanup = null, lastFocus = null, outT = 0;

  const onKey = (e) => { if (e.key === 'Escape' && active) { e.preventDefault(); api.close(); } };

  const teardown = (keep = false) => {
    try { cleanup?.(); } catch (err) { console.warn(err); }
    cleanup = null;
    if (!keep) root.replaceChildren();
  };

  const api = {
    open(game, o = {}) {
      if (!GAMES[game]) { console.warn(`mini-games: unknown game "${game}"`); return; }
      if (active) { const prev = opts; teardown(); active = null; prev.onClose?.(); }
      else { lastFocus = document.activeElement; document.addEventListener('keydown', onKey); }
      active = game; opts = o;
      clearTimeout(outT); root.classList.remove('is-out'); root.replaceChildren();
      root.hidden = false;
      root.dataset.game = game;
      root.setAttribute('aria-label', GAMES[game].title);
      progress.played(game);
      const back = () => { feel.back?.(); api.close(); };
      cleanup = GAMES[game].build(root, { opts: o, back });
    },
    close() {
      if (!active) return;
      const o = opts;
      teardown(true);   // the game stops now; the screen fades out like every page (0.25 s), then empties
      active = null; opts = {};
      root.classList.add('is-out');
      clearTimeout(outT); outT = setTimeout(() => { if (active) return; root.replaceChildren(); root.hidden = true; root.classList.remove('is-out'); delete root.dataset.game; }, 250);
      document.removeEventListener('keydown', onKey);
      try { lastFocus?.focus?.({ preventScroll: true }); } catch { /* gone */ }
      lastFocus = null;
      o.onClose?.();
    },
    get active() { return active; },
  };
  return api;
}

// the top bar every game shares: ← Back on the left, the title, and a slot on the right
function topBar(title, back, right = null) {
  return h('header', { class: 'mg-top' },
    h('button', { class: 'mg-back', type: 'button', 'aria-label': 'Back — close the game', onclick: back }, h('span', { 'aria-hidden': 'true', text: '←' }), ' Back'),
    h('h2', { class: 'mg-title', text: title }),
    h('div', { class: 'mg-top__r' }, right),
  );
}
// the game's own leaderboard, in its top bar (Ahmed, 2026-10-22: "the leaderboard should be inside each game")
const LB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 13v4 M8 21h8 M9 17h6v4H9z"/></svg>';
const lbBtn = (game) => { const b = h('button', { class: 'mg-lb', type: 'button', 'aria-label': 'Leaderboard', onclick: () => { feel.tap(); openFriends({ game }); } }); b.innerHTML = `${LB}<span>Leaderboard</span>`; return b; };
const btn = (label, onclick, { kind = 'primary', aria, cls = '' } = {}) =>
  h('button', { class: `mg-btn mg-btn--${kind} ${cls}`.trim(), type: 'button', 'aria-label': aria, onclick }, label);

// the tier (tiers.js): the one picked in the hub unless the caller says; a chip in the top bar shows it
const tierOf = (game, opts) => (opts?.tier && tiers.unlocked(game, opts.tier) ? opts.tier : tiers.selected(game));
const tierChip = (t) => h('p', { class: 'mg-chip mg-tier', 'aria-label': `Tier: ${TIER_LABEL[t]}` }, h('b', { text: TIER_LABEL[t] }));
// a round's end, for the fan zone: stars on this tier, a tier that opened, and the game-result event (with its tier)
// that the leagues, the derby and the missions hear
function roundEnd(game, tier, score, extra = {}) {
  const rec = tiers.record(game, tier, score);
  fanEvent('game-result', { game, score, tier, stars: rec.stars, newStars: rec.newStars, unlocked: rec.unlocked, best: rec.best, ...extra });
  return rec;
}
const starsLine = (tier, rec) => [
  h('p', { class: 'fz-stars is-l', 'aria-label': `${rec.stars} of 3 stars on ${TIER_LABEL[tier]}`, html: starRow(rec.stars) }),
  rec.unlocked ? h('p', { class: 'mg-unlock', text: `${TIER_LABEL[rec.unlocked]} tier unlocked` }) : null,
];

// ───────────────────────── 1 · keepy-uppy ─────────────────────────
// A truncated icosahedron, precomputed once: 12 pentagons (5 corners each) and the 30 seams between them.
const BALL = (() => {
  const p = (1 + Math.sqrt(5)) / 2;
  const raw = [[0, 1, p], [0, 1, -p], [0, -1, p], [0, -1, -p], [1, p, 0], [1, -p, 0], [-1, p, 0], [-1, -p, 0], [p, 0, 1], [p, 0, -1], [-p, 0, 1], [-p, 0, -1]];
  const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
  const V = raw.map(norm);
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const edge = Math.min(...V.slice(1).map((v) => d2(V[0], v)));
  const nbr = V.map((v, i) => V.map((_, j) => j).filter((j) => j !== i && Math.abs(d2(v, V[j]) - edge) < 1e-6));
  const corner = (i, j) => norm(V[i].map((c, k) => c + (V[j][k] - c) / 3)); // a third along the edge: truncation
  const pts = [], pent = [], idx = {};
  V.forEach((v, i) => {
    // order the neighbours around v
    const ref = Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const u = norm(cross(v, ref)), w = cross(v, u);
    const ord = [...nbr[i]].sort((a, b) => {
      const ang = (j) => { const q = V[j].map((c, k) => c - v[k]); return Math.atan2(q[0] * w[0] + q[1] * w[1] + q[2] * w[2], q[0] * u[0] + q[1] * u[1] + q[2] * u[2]); };
      return ang(a) - ang(b);
    });
    pent.push(ord.map((j) => { idx[`${i}-${j}`] = pts.length; pts.push(corner(i, j)); return idx[`${i}-${j}`]; }));
  });
  const seams = [];
  V.forEach((_, i) => nbr[i].forEach((j) => { if (i < j) seams.push([idx[`${i}-${j}`], idx[`${j}-${i}`]]); }));
  pent.forEach((pp) => pp.forEach((a, k) => seams.push([a, pp[(k + 1) % 5]])));
  return { pts, pent, seams, centres: V };
})();

const rotMul = (a, b) => { const r = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return r; };
const rotZ = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const rotX = (t) => { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = (t) => { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const orth = (m) => { // Gram–Schmidt on the rows, so rounding never skews the ball
  const r0 = [m[0], m[1], m[2]], l0 = Math.hypot(...r0); r0.forEach((_, i) => { r0[i] /= l0; });
  let r1 = [m[3], m[4], m[5]]; const d = r1[0] * r0[0] + r1[1] * r0[1] + r1[2] * r0[2]; r1 = r1.map((c, i) => c - d * r0[i]);
  const l1 = Math.hypot(...r1); r1 = r1.map((c) => c / l1);
  const r2 = [r0[1] * r1[2] - r0[2] * r1[1], r0[2] * r1[0] - r0[0] * r1[2], r0[0] * r1[1] - r0[1] * r1[0]];
  return [...r0, ...r1, ...r2];
};

function drawBall(g, x, y, r, M) {
  const P = BALL.pts.map(([a, b, c]) => [M[0] * a + M[1] * b + M[2] * c, M[3] * a + M[4] * b + M[5] * c, M[6] * a + M[7] * b + M[8] * c]);
  const sx = (q) => { if (q[2] >= 0) return [x + q[0] * r, y - q[1] * r]; const l = Math.hypot(q[0], q[1]) || 1; return [x + (q[0] / l) * r, y - (q[1] / l) * r]; };
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  g.fillStyle = '#f6f5ef'; g.fill();
  g.clip();
  // pentagons facing us
  g.fillStyle = '#121212';
  BALL.pent.forEach((pp, i) => {
    const c = BALL.centres[i], cz = M[6] * c[0] + M[7] * c[1] + M[8] * c[2];
    if (cz < -0.35) return;
    g.beginPath();
    pp.forEach((k, n) => { const [px, py] = sx(P[k]); n ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.closePath(); g.fill();
  });
  // seams
  g.strokeStyle = 'rgba(20,20,20,0.55)'; g.lineWidth = Math.max(1, r * 0.035); g.lineJoin = 'round';
  g.beginPath();
  for (const [a, b] of BALL.seams) {
    if (P[a][2] < 0.02 || P[b][2] < 0.02) continue;
    const [ax, ay] = sx(P[a]), [bx, by] = sx(P[b]);
    g.moveTo(ax, ay); g.lineTo(bx, by);
  }
  g.stroke();
  // light from the top left, a dark rim at the bottom right
  const sh = g.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.05);
  sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.05)');
  sh.addColorStop(0.75, 'rgba(0,0,0,0.12)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)');
  g.fillStyle = sh; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = Math.max(1, r * 0.04); g.stroke();
}

function buildKeepy(root, { opts, back }) {
  const tier = tierOf('keepy', opts), D = tiers.diff('keepy', tier);
  const bestEl = h('b', { text: String(progress.best('keepy')) });
  const count = h('div', { class: 'mg-k__count', 'aria-hidden': 'true', text: '0' });
  const live = h('p', { class: 'mg-sr', 'aria-live': 'polite' });
  const canvas = h('canvas', { class: 'mg-k__cv', tabindex: '0', role: 'application', 'aria-label': 'Keepy-uppy pitch. Tap or click the ball to kick it up. With a keyboard: Space kicks straight, arrow keys kick left or right.' });
  const hint = h('div', { class: 'mg-k__hint' },
    h('p', { class: 'mg-k__hintt', text: 'Tap the ball to start' }),
    h('p', { class: 'mg-k__hints', text: 'Keep it off the grass and inside the screen. Hit its left side to send it right.' }),
  );
  const mascot = h('img', { class: 'mg-k__mascot', src: MASCOT, alt: '', draggable: 'false' });
  const card = h('div', { class: 'mg-k__over', hidden: true });
  const screen = h('section', { class: 'mg-screen mg-k' },
    count, canvas, mascot,
    topBar('Keepy-uppy', back, [tierChip(tier), h('p', { class: 'mg-chip' }, 'Best ', bestEl), lbBtn('keepy')]),
    hint, card, live,
  );
  root.append(screen);

  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, dead = false;
  let state = 'ready'; // ready → play → falling (dropped/out, short pause) → over
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 30, spin: 0, tumble: 0, M: rotMul(rotX(0.5), rotY(0.3)) };
  let touches = 0, lastKick = 0, overAt = 0, reason = '', frames = 0, hit20 = false;

  const groundY = () => H - Math.max(26, H * 0.085);
  const grav = () => H * 1.55 * D.grav * (1 + Math.min(touches, 50) * 0.014);
  const hitR = () => ball.r * D.hit * (1.95 - Math.min(touches, 40) * 0.012);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const nw = Math.max(1, rect.width), nh = Math.max(1, rect.height);
    if (W && H) { ball.x *= nw / W; ball.y *= nh / H; }
    W = nw; H = nh; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ball.r = Math.max(20, Math.min(44, Math.min(W, H) * 0.075));
    if (state === 'ready') { ball.x = W / 2; ball.y = H * 0.5; }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const reset = () => {
    state = 'ready'; touches = 0; reason = ''; hit20 = false;
    ball.x = W / 2; ball.y = H * 0.5; ball.vx = 0; ball.vy = 0; ball.spin = 0; ball.tumble = 0;
    count.textContent = '0'; count.classList.remove('is-bump');
    hint.hidden = false; card.hidden = true; card.replaceChildren();
    canvas.focus({ preventScroll: true });
  };

  const kick = (dir) => {
    // dir: -1..1, where the boot sends it sideways (the opposite side to where it was struck)
    const now = performance.now();
    if (now - lastKick < 110) return;
    lastKick = now;
    if (state === 'ready') { state = 'play'; hint.hidden = true; }
    const apex = H * (0.1 + Math.random() * 0.14);
    const rise = Math.max(H * 0.18, ball.y - apex);
    ball.vy = -Math.sqrt(2 * grav() * rise);
    const span = Math.min(W, H * 1.4) * 0.3;
    ball.vx = Math.max(-1.25, Math.min(1.25, dir)) * span + (Math.random() - 0.5) * span * 0.12;
    ball.spin = -dir * 9 + (Math.random() - 0.5) * 2;
    ball.tumble = 6 + Math.random() * 3;
    touches++;
    count.textContent = String(touches);
    count.classList.remove('is-bump'); void count.offsetWidth; count.classList.add('is-bump');
    if (touches % 10 === 0) { mascot.classList.remove('is-cheer'); void mascot.offsetWidth; mascot.classList.add('is-cheer'); live.textContent = `${touches} touches`; }
    if (touches >= 20 && !hit20) { hit20 = true; progress.achieve('keepy-20'); }
    feel.tap();
  };

  const onDown = (e) => {
    if (state !== 'ready' && state !== 'play') return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const dx = px - ball.x, dy = py - ball.y, R = hitR();
    const onIt = Math.hypot(dx, dy) <= R;
    const under = dy > 0 && dy < ball.r * 3.6 && Math.abs(dx) < R;
    if (onIt || under) kick(-dx / ball.r);
  };
  const onKey = (e) => {
    if (e.target.closest?.('button')) return;
    const k = e.key;
    if (k === 'Enter' && state === 'over') { e.preventDefault(); reset(); return; }
    if (![' ', 'Spacebar', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(k)) return;
    e.preventDefault();
    if (e.repeat) return;
    // with a keyboard you can only kick a ball that's dropping towards you
    if (state === 'ready' || (state === 'play' && ball.vy > 0 && ball.y > H * 0.42)) {
      kick(k === 'ArrowLeft' ? -0.8 : k === 'ArrowRight' ? 0.8 : (W / 2 - ball.x) / (W / 2) * 0.35);
    }
  };
  canvas.addEventListener('pointerdown', onDown);
  screen.addEventListener('keydown', onKey);

  const gameOver = () => {
    state = 'over';
    const score = touches;
    const prevBest = progress.best('keepy');
    const isBest = score > 0 && progress.setBest('keepy', score);
    const xp = Math.min(100, score * 2);
    if (xp > 0) progress.award(xp, `Keepy-uppy · ${score} touches`);
    const rec = roundEnd('keepy', tier, score);
    bestEl.textContent = String(progress.best('keepy'));
    if (isBest) { feel.win(); feel.confetti({ n: 160, y: 0.3 }); }
    card.replaceChildren(h('div', { class: 'mg-card' },
      h('p', { class: 'mg-card__eyebrow', text: reason === 'out' ? 'Out of play' : 'It hit the grass' }),
      h('p', { class: 'mg-card__big', text: String(score) }),
      h('p', { class: 'mg-card__label', text: score === 1 ? 'touch' : 'touches in a row' }),
      isBest ? h('p', { class: 'mg-badge', text: prevBest ? `New best · was ${prevBest}` : 'New best' }) : h('p', { class: 'mg-card__sub', text: `Best ${progress.best('keepy')}` }),
      ...starsLine(tier, rec),
      xp > 0 ? h('p', { class: 'mg-card__xp', text: `+${xp} XP` }) : null,
      h('div', { class: 'mg-card__row' },
        btn('Retry', () => { feel.tap(); reset(); }, { aria: 'Retry keepy-uppy' }),
        btn('Share', () => { feel.tap(); openShare({ kind: 'score', game: 'keepy', score, tier, stars: rec.stars }); }, { kind: 'ghost', aria: 'Share your score' }),
        btn('Back', back, { kind: 'ghost', aria: 'Back — close the game' }),
      ),
    ));
    card.hidden = false;
    live.textContent = `Game over. ${score} touches.${isBest ? ' New best!' : ''}`;
    requestAnimationFrame(() => card.querySelector('.mg-btn')?.focus({ preventScroll: true }));
  };

  const step = (t) => {
    if (dead) return;
    raf = requestAnimationFrame(step);
    const dt = Math.min(1 / 30, last ? (t - last) / 1000 : 0); last = t;
    if (!W || !H) return;
    const gy = groundY();
    if (state === 'ready') {
      ball.y = H * 0.5 + Math.sin(t / 380) * H * 0.018; // a gentle hover
      ball.M = rotMul(rotZ(dt * 0.6), ball.M);
    } else if (state === 'play' || state === 'falling') {
      ball.vy += grav() * dt;
      if (D.drift && state === 'play') ball.vx += Math.sin(t / 900) * W * D.drift * dt * 6;   // Legend: a breeze that turns
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      ball.M = rotMul(rotX(-ball.tumble * dt), rotMul(rotZ(ball.spin * dt), ball.M));
      ball.spin *= 1 - dt * 0.4; ball.tumble *= 1 - dt * 0.6;
      if (ball.y + ball.r >= gy) { // the grass: a dead bounce or two
        ball.y = gy - ball.r; ball.vy = -Math.abs(ball.vy) * 0.38; ball.vx *= 0.7;
        if (state === 'play') { state = 'falling'; reason = 'ground'; overAt = t + 750; feel.miss(); }
      }
      if (state === 'play' && (ball.x < -ball.r || ball.x > W + ball.r)) { state = 'falling'; reason = 'out'; overAt = t + 450; feel.miss(); }
      if (state === 'falling' && t >= overAt) gameOver();
    }
    if (++frames % 120 === 0) ball.M = orth(ball.M);

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // the grass strip, with mowing stripes and the touchline
    const gr = g.createLinearGradient(0, gy, 0, H);
    gr.addColorStop(0, '#16502a'); gr.addColorStop(1, '#0b2a16');
    g.fillStyle = gr; g.fillRect(0, gy, W, H - gy);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    const sw = Math.max(40, W / 14);
    for (let x = 0; x < W; x += sw * 2) g.fillRect(x, gy, sw, H - gy);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, gy, W, 2);
    // the ball's shadow shrinks as it rises
    const lift = Math.max(0, Math.min(1, (gy - ball.y - ball.r) / (H * 0.8)));
    g.fillStyle = `rgba(0,0,0,${0.45 * (1 - lift * 0.7)})`;
    g.beginPath(); g.ellipse(ball.x, gy + 3, ball.r * (1.05 - lift * 0.55), ball.r * 0.22 * (1 - lift * 0.5), 0, 0, TAU); g.fill();
    drawBall(g, ball.x, ball.y, ball.r, ball.M);
  };
  resize();
  reset();
  raf = requestAnimationFrame(step);

  return () => {
    dead = true; cancelAnimationFrame(raf); ro.disconnect();
    canvas.removeEventListener('pointerdown', onDown);
    screen.removeEventListener('keydown', onKey);
  };
}

// ───────────────────────── 2 · legends quiz ─────────────────────────
// Questions come only from legends.js. A distractor is never also a right answer:
//  · "who" questions by fact: a legend can't be offered if one of their own facts shares a year with the asked
//    fact, if their facts repeat it, or if they were at the club in a year the fact names (they might have
//    been part of it too).
//  · count facts like "Four league titles" are never asked: the facts lists aren't complete, so another legend
//    could have the same count. Goal tallies are only set against keepers, defenders and the coach.
//  · "what position": positions that overlap (winger / striker / midfielder) are never offered side by side.
const yearsIn = (s) => (String(s).match(/\b(19|20)\d{2}\b/g) || []).map(Number);
const spanOf = (l) => { const [a, b] = yearsIn(l.years); return [a, b ?? a]; };
const isCoach = (l) => /coach/i.test(l.pos);
const posPhrase = (l) => (isCoach(l) ? 'the head coach' : `a ${l.pos.toLowerCase()}`);
const UNASKABLE = /league titles/i;

// goal tallies: only offered against keepers, defenders and the coach, who couldn't share it
const GOAL_TALLY = /\b\d+ goals\b/i;
const NON_SCORERS = /goalkeeper|defender|coach/i;
// positions that overlap in real life (a winger often plays up front or in midfield): never offered together
const CLOSE_POS = { Winger: ['Striker', 'Midfielder'], Striker: ['Winger'], Midfielder: ['Winger'] };

function factDistractors(L, fact) {
  const ys = yearsIn(fact);
  return LEGENDS.filter((o) => {
    if (o === L) return false;
    if (GOAL_TALLY.test(fact) && !NON_SCORERS.test(o.pos)) return false;
    if (o.facts.some((f) => f === fact)) return false;
    if (ys.length && o.facts.some((f) => yearsIn(f).some((y) => ys.includes(y)))) return false;
    const [a, b] = spanOf(o);
    if (ys.some((y) => y >= a && y <= b)) return false;
    return true;
  });
}

const QTYPES = {
  // "Who was a midfielder at the club 1996–2016?" — right only if both the role and the years match
  who(L) {
    const pool = LEGENDS.filter((o) => o !== L && !(o.pos === L.pos && o.years === L.years));
    return { q: `Who was ${posPhrase(L)} at the club ${L.years}?`, answer: L.name, pool: pool.map((o) => o.name), legends: true };
  },
  fact(L) {
    const facts = L.facts.filter((f) => !UNASKABLE.test(f));
    for (const fact of shuffle(facts)) {
      const pool = factDistractors(L, fact);
      if (pool.length >= 3) return { q: 'Which legend is this?', quote: fact, answer: L.name, pool: pool.map((o) => o.name), legends: true };
    }
    return null;
  },
  pos(L) {
    if (isCoach(L)) return null;
    const all = [...new Set(LEGENDS.filter((o) => !isCoach(o)).map((o) => o.pos))];
    return { q: `What position did ${L.name} play?`, answer: L.pos, pool: all.filter((p) => p !== L.pos && !(CLOSE_POS[L.pos] || []).includes(p)) };
  },
  years(L) {
    const pool = [...new Set(LEGENDS.filter((o) => o !== L).map((o) => o.years))].filter((y) => y !== L.years);
    return { q: isCoach(L) ? `When was ${L.name} the club's head coach?` : `When did ${L.name} play for the club?`, answer: L.years, pool };
  },
};

function makeQuiz(n = 5, types = null) {
  const order = shuffle(types || Object.keys(QTYPES));
  const out = [];
  let ti = 0;
  for (const L of shuffle(LEGENDS)) {
    if (out.length >= n) break;
    // rotate through the types so every round mixes them; fall back to any type that works for this legend
    const tries = [...order.slice(ti % order.length), ...order.slice(0, ti % order.length)];
    for (const t of tries) {
      const q = QTYPES[t](L);
      if (!q || q.pool.length < 3) continue;
      const options = shuffle([q.answer, ...shuffle(q.pool).slice(0, 3)]);
      out.push({ ...q, type: t, options });
      ti++;
      break;
    }
  }
  return out;
}

function buildQuiz(root, { opts, back }) {
  const tier = tierOf('quiz', opts), D = tiers.diff('quiz', tier);
  const QTIME = D.time || 15;
  let qs = [], i = 0, score = 0, timer = 0, deadline = 0, locked = false, nextT = 0;
  const marks = h('div', { class: 'mg-q__marks', 'aria-hidden': 'true' });
  const stage = h('div', { class: 'mg-q__stage' });
  const live = h('p', { class: 'mg-sr', 'aria-live': 'assertive' });
  const screen = h('section', { class: 'mg-screen mg-q' }, topBar('Legends quiz', back, [tierChip(tier), marks, lbBtn('quiz')]), stage, live);
  root.append(screen);
  const byName = Object.fromEntries(LEGENDS.map((l) => [l.name, l]));

  const stop = () => { cancelAnimationFrame(timer); clearTimeout(nextT); timer = 0; nextT = 0; };

  const start = () => {
    stop();
    qs = makeQuiz(5, D.types); i = 0; score = 0;
    marks.replaceChildren(...qs.map(() => h('i', { class: 'mg-q__mark' })));
    show();
  };

  const show = () => {
    locked = false;
    const q = qs[i];
    const bar = h('i', { class: 'mg-q__fill' });
    const secs = h('span', { class: 'mg-q__secs', text: String(QTIME) });
    const opts = q.options.map((o, k) => {
      const L = q.legends ? byName[o] : null;
      return h('button', { class: 'mg-q__opt', type: 'button', 'data-v': o, 'aria-label': `Answer ${k + 1}: ${o}`, onclick: () => answer(o) },
        h('span', { class: 'mg-q__key', 'aria-hidden': 'true', text: String(k + 1) }),
        h('span', { class: 'mg-q__otxt' }, h('span', { class: 'mg-q__name', text: o }), L?.ar ? h('span', { class: 'mg-q__ar', lang: 'ar', dir: 'rtl', text: L.ar }) : null),
      );
    });
    stage.replaceChildren(
      h('div', { class: 'mg-q__card' },
        h('div', { class: 'mg-q__meta' }, h('span', { class: 'mg-q__num', text: `Question ${i + 1} / ${qs.length}` }), secs),
        h('div', { class: 'mg-q__bar', role: 'progressbar', 'aria-label': 'Time left', 'aria-valuemin': '0', 'aria-valuemax': String(QTIME) }, bar),
        h('p', { class: 'mg-q__q', id: 'mg-q-text', text: q.q }),
        q.quote ? h('blockquote', { class: 'mg-q__quote', text: `“${q.quote}”` }) : null,
        h('div', { class: 'mg-q__opts', role: 'group', 'aria-labelledby': 'mg-q-text' }, opts),
        h('p', { class: 'mg-q__fb', 'aria-hidden': 'true' }),
      ),
    );
    live.textContent = `Question ${i + 1}. ${q.q}${q.quote ? ` "${q.quote}"` : ''}`;
    opts[0].focus({ preventScroll: true });
    deadline = performance.now() + QTIME * 1000;
    const tick = () => {
      const left = Math.max(0, deadline - performance.now()) / 1000;
      bar.style.transform = `scaleX(${left / QTIME})`;
      bar.parentElement.classList.toggle('is-low', left < 5);
      secs.textContent = String(Math.ceil(left));
      if (left <= 0) { timer = 0; answer(null); return; }
      timer = requestAnimationFrame(tick);
    };
    timer = requestAnimationFrame(tick);
  };

  const answer = (v) => {
    if (locked) return;
    locked = true;
    cancelAnimationFrame(timer); timer = 0;
    const q = qs[i], ok = v === q.answer;
    feel.tap();
    if (ok) { score++; feel.goal(); } else feel.miss();
    stage.querySelectorAll('.mg-q__opt').forEach((b) => {
      b.disabled = true;
      if (b.dataset.v === q.answer) b.classList.add('is-right');
      else if (b.dataset.v === v) b.classList.add('is-wrong');
    });
    marks.children[i]?.classList.add(ok ? 'is-right' : 'is-wrong');
    const fb = stage.querySelector('.mg-q__fb');
    fb.textContent = ok ? 'Correct! +10 XP' : v == null ? `Time's up — it was ${q.answer}` : `Not quite — it was ${q.answer}`;
    fb.classList.add(ok ? 'is-right' : 'is-wrong');
    live.textContent = fb.textContent;
    nextT = setTimeout(() => { nextT = 0; i++; if (i < qs.length) show(); else end(); }, ok ? 1300 : 2100);
  };

  const end = () => {
    stop();
    const xp = score * 10;
    if (xp) progress.award(xp, `Legends quiz · ${score}/${qs.length}`);
    const rec = roundEnd('quiz', tier, score, { of: qs.length });
    if (score >= 4) progress.achieve('quiz-4');
    const isBest = score > 0 && progress.setBest('quiz', score);
    if (score === qs.length) { feel.win(); feel.confetti({ n: 180 }); }
    const verdict = score === qs.length ? 'Perfect — a true Tiger' : score >= 4 ? 'Legend status' : score >= 2 ? 'Solid fan' : 'Time for the Hall of Fame';
    stage.replaceChildren(
      h('div', { class: 'mg-card mg-q__end' },
        h('p', { class: 'mg-card__eyebrow', text: 'Full time' }),
        h('p', { class: 'mg-card__big' }, String(score), h('small', { text: ` / ${qs.length}` })),
        h('p', { class: 'mg-card__label', text: verdict }),
        isBest ? h('p', { class: 'mg-badge', text: 'New best' }) : h('p', { class: 'mg-card__sub', text: `Best ${progress.best('quiz')} / ${qs.length}` }),
        ...starsLine(tier, rec),
        xp ? h('p', { class: 'mg-card__xp', text: `+${xp} XP` }) : null,
        h('div', { class: 'mg-card__row' },
          btn('Retry', () => { feel.tap(); start(); }, { aria: 'Play the quiz again' }),
          btn('Share', () => { feel.tap(); openShare({ kind: 'score', game: 'quiz', score, tier, stars: rec.stars }); }, { kind: 'ghost', aria: 'Share your score' }),
          btn('Back', back, { kind: 'ghost', aria: 'Back — close the game' }),
        ),
      ),
    );
    live.textContent = `Full time. You scored ${score} out of ${qs.length}. ${verdict}.`;
    stage.querySelector('.mg-btn')?.focus({ preventScroll: true });
  };

  const onKey = (e) => {
    if (locked || !qs[i] || stage.querySelector('.mg-q__end')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) { e.preventDefault(); stage.querySelectorAll('.mg-q__opt')[n - 1]?.click(); }
  };
  screen.addEventListener('keydown', onKey);
  start();
  return () => { stop(); screen.removeEventListener('keydown', onKey); };
}

// ───────────────────────── 3 · predict the score ─────────────────────────
const loadPreds = () => { try { return JSON.parse(localStorage.getItem(PREDICT_KEY)) || {}; } catch { return {}; } };
const savePreds = (p) => { try { localStorage.setItem(PREDICT_KEY, JSON.stringify(p)); } catch { /* private mode */ } };
const matchKey = (m) => m.slug || `${String(m.opp || 'match').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${m.kickoff || 'tbc'}`;
const dateOf = (m) => {
  if (m.dateText) return m.dateText;
  if (!m.kickoff) return 'Date TBC';
  const d = new Date(m.kickoff * 1000);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' });
  return m.timeTBC ? `${day} · Kick-off TBC` : `${day} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })}`;
};
const nextHome = () => {
  const now = Date.now();
  return FIXTURES.find((m) => m.opp && m.kickoff && m.kickoff * 1000 > now) || FIXTURES.find((m) => m.opp) || null;
};

function buildPredict(root, { opts, back }) {
  const m = opts.match || nextHome();
  const screen = h('section', { class: 'mg-screen mg-p' }, topBar('Predict the score', back));
  root.append(screen);
  if (!m) {
    screen.append(h('div', { class: 'mg-card' }, h('p', { class: 'mg-card__label', text: 'No upcoming home match to predict yet.' }), h('div', { class: 'mg-card__row' }, btn('Back', back, { kind: 'ghost' }))));
    return () => {};
  }
  const key = matchKey(m);
  const comp = opts.compLabel || m.compLabel || '';
  const oppName = m.oppShort || m.opp;
  const crest = (src, name, code) => (src
    ? h('img', { class: 'mg-p__crest', src, alt: `${name} crest`, draggable: 'false' })
    : h('span', { class: 'mg-p__crest mg-p__mono', role: 'img', 'aria-label': `${name} crest`, text: code || name.slice(0, 3).toUpperCase() }));

  let score = { home: 0, away: 0 };
  const saved = loadPreds()[key];
  if (saved) score = { home: saved.home, away: saved.away };
  // the first goalscorer (2026-10-27, match week): the forwards by name, anyone else of ours, one of theirs, or no goals
  const SCORERS = [...SQUAD.filter((p) => p.pos === 'Forward').map((p) => p.name), 'Another Al-Ittihad player', `An ${m.opp} player`, 'No goals'];
  let scorer = saved?.scorer || null;
  let editing = !saved;
  const body = h('div', { class: 'mg-p__body' });
  screen.append(body);

  const stepper = (side, label) => {
    const val = h('output', { class: 'mg-p__val', 'aria-live': 'polite', 'aria-label': `${label} goals`, text: String(score[side]) });
    const set = (d) => {
      const v = Math.max(0, Math.min(9, score[side] + d));
      if (v === score[side]) return;
      score[side] = v; val.textContent = String(v); feel.tap();
      val.classList.remove('is-bump'); void val.offsetWidth; val.classList.add('is-bump');
      minus.disabled = v === 0; plus.disabled = v === 9;
    };
    const minus = h('button', { class: 'mg-p__step', type: 'button', 'aria-label': `One goal fewer for ${label}`, onclick: () => set(-1), text: '−' });
    const plus = h('button', { class: 'mg-p__step', type: 'button', 'aria-label': `One goal more for ${label}`, onclick: () => set(1), text: '+' });
    minus.disabled = score[side] === 0; plus.disabled = score[side] === 9;
    return h('div', { class: 'mg-p__stepper' }, minus, val, plus);
  };

  const render = () => {
    const head = h('div', { class: 'mg-p__head' },
      h('p', { class: 'mg-p__comp', text: [comp, m.round].filter(Boolean).join(' · ') }),
      h('p', { class: 'mg-p__date', text: dateOf(m) }),
    );
    const team = (side, name, src, code) => h('div', { class: `mg-p__team mg-p__team--${side}` },
      crest(src, name, code),
      h('p', { class: 'mg-p__name', text: name }),
      editing ? stepper(side, name) : null,
    );
    // editing: VS between the steppers · locked: the predicted score as a scoreboard
    const vs = editing
      ? h('div', { class: 'mg-p__vs', 'aria-hidden': 'true', text: 'VS' })
      : h('div', { class: 'mg-p__board', 'aria-hidden': 'true' }, h('span', { text: String(score.home) }), h('i', { text: '–' }), h('span', { text: String(score.away) }));
    const pitch = h('div', { class: 'mg-p__match' }, team('home', 'AL-ITTIHAD', ITT_CREST, 'ITT'), vs, team('away', oppName, m.crest, m.oppCode));
    const note = h('p', { class: 'mg-p__note' }, 'Checked after the final whistle: the right result, the exact score and the first scorer each pay Claws.');
    const pickScorer = h('div', { class: 'mg-p__sc' }, h('p', { class: 'mg-p__sck', text: 'First goalscorer' }),
      h('div', { class: 'mg-p__scl', role: 'group', 'aria-label': 'First goalscorer' }, ...SCORERS.map((n) => h('button', { type: 'button', class: `mg-p__scb${scorer === n ? ' is-on' : ''}`, 'aria-pressed': String(scorer === n), text: n, onclick: () => { feel.tap(); scorer = n; render(); } }))));
    if (editing) {
      body.replaceChildren(head, pitch, pickScorer,
        h('div', { class: 'mg-p__cta' }, btn('Lock in prediction', lock, { aria: 'Lock in your prediction', cls: 'mg-btn--wide' })),
        note);
    } else {
      body.replaceChildren(head, pitch,
        h('div', { class: 'mg-p__locked', role: 'status' },
          h('p', { class: 'mg-p__yours' }, 'Your prediction: ', h('b', { text: `${score.home}–${score.away}` }), scorer ? ` · first scorer: ${scorer}` : ''),
          h('p', { class: 'mg-p__wait', text: 'We’ll check it after the final whistle.' }),
        ),
        h('div', { class: 'mg-p__cta' },
          btn('Change prediction', () => { feel.tap(); editing = true; render(); body.querySelector('.mg-p__step:not(:disabled)')?.focus({ preventScroll: true }); }, { kind: 'ghost', aria: 'Change your prediction' }),
          btn('Done', back, { aria: 'Done — close the game' }),
        ),
        note);
    }
  };
  function lock() {
    if (!scorer) { feel.back(); body.querySelector('.mg-p__sc')?.classList.remove('is-need'); void body.offsetWidth; body.querySelector('.mg-p__sc')?.classList.add('is-need'); return; }
    const all = loadPreds();
    all[key] = { home: score.home, away: score.away, scorer, opp: m.opp, kickoff: m.kickoff || null, at: Date.now() };
    savePreds(all);
    editing = false;
    feel.win();
    progress.achieve('predict');
    fanEvent('predict', { slug: key, home: score.home, away: score.away, scorer });
    myWeek.predict(key);   // a predicted score is worth league points this week (once a match)
    render();
    body.querySelector('.mg-p__locked')?.classList.add('is-in');
    body.querySelector('.mg-btn--primary')?.focus({ preventScroll: true });
  }
  render();
  (body.querySelector('.mg-p__step:not(:disabled)') || body.querySelector('.mg-btn'))?.focus({ preventScroll: true });
  return () => {};
}

const GAMES = {
  keepy: { title: 'Keepy-uppy', build: buildKeepy },
  quiz: { title: 'Legends quiz', build: buildQuiz },
  predict: { title: 'Predict the score', build: buildPredict },
};

