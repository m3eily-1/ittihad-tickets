// Everything below the hero: fixtures (dot-matrix dates + countdowns + tier price strips),
// season pass (halftone poster), app LED board, resale, partners, footer dot field.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, fine } from '../../ui.js';
import { MATCHES, TIERS, SEASON, VENUES, SPONSORS, LINKS, eventUrl, seasonUrl, when, countdown, pad } from '../../data.js';
import { dotDisplay, bitmap } from './dotfont.js';
import { ONE } from './layouts.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ── countdown ticker shared by every dot display ── */
const timers = [];
export function addCountdown(el, ts) {
  const d = dotDisplay(el, '00:00:00:00', { pitch: 10, r: 3.5 });
  const lab = document.createElement('div');
  lab.className = 'dm-labels';
  lab.innerHTML = '<span>Days</span><span>Hrs</span><span>Min</span><span>Sec</span>';
  el.append(lab);
  timers.push({ d, ts });
}
function tickCountdowns() {
  for (const { d, ts } of timers) {
    const c = countdown(ts);
    d.set(`${pad(Math.min(99, c.d))}:${pad(c.h)}:${pad(c.m)}:${pad(c.s)}`);
  }
}
setInterval(tickCountdowns, 1000);

/* ── fixtures ── */
export function renderFixtures() {
  const grid = $('.js-fixtures');
  $('.js-fx-count').textContent = MATCHES.length;
  grid.innerHTML = MATCHES.map((m, i) => {
    const w = when(m.kickoff);
    const tiers = TIERS[m.slug] || [];
    const prices = tiers.map((t) => t.price);
    const lo = Math.min(...prices), hi = Math.max(...prices);
    const lx = (p) => (hi === lo ? 50 : (Math.log(p / lo) / Math.log(hi / lo)) * 100);
    const seen = {};
    const dots = tiers.map((t) => {
      const k = Math.round(lx(t.price));
      const stack = (seen[k] = (seen[k] ?? -1) + 1);
      return `<button type="button" class="tier" style="--x:${lx(t.price).toFixed(2)}%;--s:${stack};--c:${t.color}" data-tip="${esc(t.name)} · SAR ${t.price}" aria-label="${esc(t.name)}, SAR ${t.price}"></button>`;
    }).join('');
    return `
    <article class="fxc" data-reveal style="--d:${i}">
      <header class="fxc__top">
        <span class="fxc__comp"><i class="fxc__pip fxc__pip--${m.comp}"></i>${esc(m.compLabel)}</span>
        <span class="fxc__n">${pad(i + 1)}/${pad(MATCHES.length)}</span>
      </header>
      <div class="fxc__date">
        <div class="fxc__dm js-fx-day" data-day="${w.date}"></div>
        <div class="fxc__dt">
          <b>${w.month}</b>
          <span>${w.day} · ${w.time} <abbr title="Jeddah time">AST</abbr></span>
          <span class="fxc__round">${esc(m.round)}</span>
        </div>
      </div>
      <div class="dotline"></div>
      <div class="fxc__teams">
        <div class="fxc__team"><img src="/teams/al-ittihad.png" alt="" width="44" height="44" /><b>Al Ittihad</b><small>Jeddah · Home</small></div>
        <span class="fxc__vs">vs</span>
        <div class="fxc__team fxc__team--away"><img src="${m.crest}" alt="" width="44" height="44" /><b>${esc(m.opp)}</b><small>${esc(m.oppFrom)}</small></div>
      </div>
      <p class="fxc__venue"><span>Venue</span>${esc(m.venue)}</p>
      <div class="fxc__tiers">
        <div class="fxc__tierhead"><span>Ticket categories</span><span>${tiers.length} · SAR ${lo}–${hi}</span></div>
        <div class="fxc__axis">${dots}</div>
        <div class="fxc__scale"><span>SAR ${lo}</span><span>log scale</span><span>SAR ${hi}</span></div>
      </div>
      <div class="fxc__count"><span class="fxc__label">Kick-off in</span><div class="js-fx-count"></div></div>
      <footer class="fxc__foot">
        <p class="fxc__from"><small>From</small><b>SAR ${m.from}</b><small>incl. VAT</small></p>
        <a class="btn btn--y fxc__book" href="${eventUrl(m.slug)}" target="_blank" rel="noopener" aria-label="Book Al Ittihad vs ${esc(m.opp)}"><span>Book tickets →</span></a>
      </footer>
    </article>`;
  }).join('');
  $$('.fxc', grid).forEach((card, i) => {
    dotDisplay($('.js-fx-day', card), $('.js-fx-day', card).dataset.day, { pitch: 10, r: 4 });
    addCountdown($('.js-fx-count', card), MATCHES[i].kickoff);
    // spotlight that follows the pointer across the card
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
  // tiers: tap shows the tip on touch screens
  grid.addEventListener('click', (e) => {
    const t = e.target.closest('.tier');
    $$('.tier.is-tip', grid).forEach((x) => x !== t && x.classList.remove('is-tip'));
    if (t) t.classList.toggle('is-tip');
  });
  tickCountdowns();
}

/* ── season pass ── */
export function setupSeason({ still }) {
  $('.js-sp-season').textContent = SEASON.season;
  dotDisplay($('.js-sp-price'), String(SEASON.from), { pitch: 10, r: 4 });
  $('.js-sp-comps').innerHTML = SEASON.comps.map((c, i) => `<li><span>${pad(i + 1)}</span><b>${esc(c)}</b><i></i><em>Included</em></li>`).join('');
  const vs = [VENUES.alinma, VENUES.faisal];
  $('.js-sp-venues').innerHTML = SEASON.venues.map((name, i) => `
    <li>
      <svg viewBox="0 0 64 44" aria-hidden="true">${ringDots(32, 22, 28, 18, 30)}${ringDots(32, 22, 19, 11, 22)}<rect x="24" y="17" width="16" height="10" /></svg>
      <div><b>${esc(name)}</b><small>${esc(vs[i]?.aka ?? '')} · ${esc(vs[i]?.area ?? '')}</small></div>
    </li>`).join('');
  $('.js-sp-v0').textContent = SEASON.venues[0];
  $('.js-sp-v1').textContent = SEASON.venues[1];
  $('.js-sp-fixtures').textContent = SEASON.fixtures.join(', ');
  $('.js-sp-book').href = seasonUrl(SEASON.slug);
  halftone($('.sp__art'), still);
}
function ringDots(cx, cy, rx, ry, n) {
  let s = '';
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    s += `<circle cx="${(cx + Math.cos(a) * rx).toFixed(1)}" cy="${(cy + Math.sin(a) * ry).toFixed(1)}" r="1.4" />`;
  }
  return s;
}

// the poster as a yellow/ink halftone; a lens around the pointer reveals the original
function halftone(fig, still) {
  const cv = $('.js-halftone', fig);
  const ctx = cv.getContext('2d');
  const src = new Image();
  src.src = '/img/season-pass.png';
  let cells = null, cols = 0, rows = 0, pitch = 10, W = 0, H = 0, prog = still ? 1 : 0, lens = { x: -999, y: -999, a: 0 };
  const build = () => {
    const r = fig.getBoundingClientRect();
    if (!r.width || !src.complete) return;
    const dpr = Math.min(devicePixelRatio, 2);
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pitch = W < 500 ? 5 : 7;
    cols = Math.ceil(W / pitch); rows = Math.ceil(H / pitch);
    const o = document.createElement('canvas');
    o.width = cols; o.height = rows;
    const oc = o.getContext('2d', { willReadFrequently: true });
    const s = Math.max(cols / src.width, rows / src.height);
    oc.drawImage(src, (cols - src.width * s) / 2, (rows - src.height * s) / 2, src.width * s, src.height * s);
    const d = oc.getImageData(0, 0, cols, rows).data;
    cells = new Float32Array(cols * rows * 2);
    for (let k = 0; k < cols * rows; k++) {
      const R = d[k * 4], G = d[k * 4 + 1], B = d[k * 4 + 2];
      cells[k * 2] = (0.3 * R + 0.59 * G + 0.11 * B) / 255;
      cells[k * 2 + 1] = R > 110 && G > 95 && (R + G) / 2 - B > 55 ? 1 : 0; // yellow pixels stay yellow
    }
    draw();
  };
  const draw = () => {
    if (!cells) return;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.62, maxD = Math.hypot(W, H) * 0.62;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const k = y * cols + x;
      const px = x * pitch + pitch / 2, py = y * pitch + pitch / 2;
      const reveal = Math.min(1, Math.max(0, (prog * 1.3 - Math.hypot(px - cx, py - cy) / maxD) * 4));
      const ld = Math.hypot(px - lens.x, py - lens.y);
      const mag = 1 + lens.a * 0.6 * Math.max(0, 1 - ld / 160);
      const r = pitch * 0.5 * Math.sqrt(cells[k * 2]) * reveal * mag * 0.95;
      if (r < 0.35) continue;
      ctx.fillStyle = cells[k * 2 + 1] ? '#fef201' : `rgba(244,241,232,${0.25 + cells[k * 2] * 0.6})`;
      ctx.beginPath();
      ctx.arc(px, py, Math.min(r, pitch * 0.62), 0, Math.PI * 2);
      ctx.fill();
    }
  };
  src.onload = build;
  new ResizeObserver(build).observe(fig);
  if (!still) {
    ScrollTrigger.create({ trigger: fig, start: 'top 80%', once: true, onEnter: () => gsap.to({ v: 0 }, { v: 1, duration: 2.2, ease: 'power2.out', onUpdate() { prog = this.targets()[0].v; draw(); } }) });
  }
  let raf = 0;
  const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  fig.addEventListener('pointermove', (e) => {
    const r = fig.getBoundingClientRect();
    lens.x = e.clientX - r.left; lens.y = e.clientY - r.top;
    fig.style.setProperty('--mx', `${lens.x}px`);
    fig.style.setProperty('--my', `${lens.y}px`);
    queue();
  });
  fig.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { fig.classList.add('is-lens'); gsap.to(lens, { a: 1, duration: 0.5, onUpdate: queue }); } });
  fig.addEventListener('pointerleave', () => { fig.classList.remove('is-lens'); gsap.to(lens, { a: 0, duration: 0.5, onUpdate: queue }); });
  // touch: tap flips between halftone and the original poster
  fig.addEventListener('click', (e) => { if (e.pointerType !== 'mouse') fig.classList.toggle('is-open'); });
}

/* ── app: a stadium LED board ── */
export function setupApp(getVelocity, { still }) {
  $('.js-appstore').href = LINKS.appStore;
  $('.js-playstore').href = LINKS.playStore;
  const cv = $('.js-led');
  const ctx = cv.getContext('2d');
  const msg = bitmap('YOUR TICKET · IN YOUR POCKET · SHOW YOUR CODE AT THE GATE · SEE YOU IN THE STANDS · ');
  const total = msg.length;
  let W = 0, H = 0, pitch = 10, cols = 0, off = 0, visible = false, boost = 0;
  const ROWS = 11; // 7 lit rows + 2 margin each side
  const size = () => {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    pitch = r.width < 600 ? 7 : r.width < 1000 ? 9 : 11;
    W = r.width; H = pitch * ROWS;
    cv.style.height = `${H}px`;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / pitch) + 1;
    draw();
  };
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const shift = off % 1, base = Math.floor(off);
    for (let x = 0; x < cols; x++) {
      const col = msg[(((base + x) % total) + total) % total];
      const px = (x - shift) * pitch + pitch / 2;
      for (let y = 0; y < ROWS; y++) {
        const on = y >= 2 && y < 9 && col[y - 2];
        const py = y * pitch + pitch / 2;
        if (on) {
          ctx.fillStyle = 'rgba(254,242,1,.18)';
          ctx.beginPath(); ctx.arc(px, py, pitch * 0.62, 0, 6.2832); ctx.fill();
          ctx.fillStyle = '#fef201';
          ctx.beginPath(); ctx.arc(px, py, pitch * 0.36, 0, 6.2832); ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(244,241,232,.07)';
          ctx.beginPath(); ctx.arc(px, py, pitch * 0.3, 0, 6.2832); ctx.fill();
        }
      }
    }
  };
  new ResizeObserver(size).observe(cv.parentElement);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
  if (!still) {
    gsap.ticker.add((_, dt) => {
      if (!visible) return;
      boost += (Math.min(Math.abs(getVelocity() || 0), 40) - boost) * 0.08;
      off += (dt / 1000) * (16 + boost * 2.2);
      draw();
    });
  }
}

/* ── resale, partners, footer links ── */
export function renderLinks() {
  $$('.js-resale').forEach((a) => { a.href = LINKS.resale; });
  $('.js-store').href = LINKS.store;
  $('.js-about').href = LINKS.about;
  $('.js-x').href = LINKS.x;
  $('.js-ig').href = LINKS.instagram;
  $('.js-yt').href = LINKS.youtube;
  $('.js-sc').href = LINKS.snapchat;
}
export function renderPartners() {
  $('.js-pt-count').textContent = SPONSORS.length;
  $('.js-partners').innerHTML = SPONSORS.map(([key, name], i) => `
    <li class="pt__cell" data-reveal style="--d:${i % 3}">
      <span class="pt__n">P/${pad(i + 1)}</span>
      <img src="/sponsors/${key}-k.png" alt="${esc(name)}" loading="lazy" />
      <span class="pt__name">${esc(name)}</span>
    </li>`).join('');
}

/* ── footer: a dot field that swells around the pointer, with the crest's "1" picked out ── */
export function footerField({ still }) {
  const foot = $('.ft'), cv = $('.js-field');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, pitch = 22, pts = [], mx = -999, my = -999, a = 0;
  const size = () => {
    const r = foot.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio, 2);
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pitch = W < 700 ? 18 : 22;
    // the "1" sits on the right, scaled to the footer height
    const oh = Math.min(H * 0.86, 620), s = oh / 554, ox = W - (W < 700 ? 494 * s * 0.75 : 494 * s + W * 0.04), oy = (H - oh) * 0.35;
    const path = new Path2D();
    ONE.forEach(([x, y], k) => (k ? path.lineTo(ox + x * s, oy + y * s) : path.moveTo(ox + x * s, oy + y * s)));
    path.closePath();
    pts = [];
    for (let y = pitch / 2; y < H; y += pitch) for (let x = pitch / 2; x < W; x += pitch) pts.push([x, y, W >= 700 && ctx.isPointInPath(path, x, y) ? 1 : 0]);
    draw();
  };
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const [x, y, inOne] of pts) {
      const d = Math.hypot(x - mx, y - my);
      const near = a * Math.max(0, 1 - d / 180);
      const r = 1.1 + near * 3.2 + inOne * 0.7;
      ctx.fillStyle = near > 0.05 ? `rgba(254,242,1,${0.25 + near * 0.75})` : inOne ? 'rgba(254,242,1,.28)' : 'rgba(244,241,232,.09)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
  };
  new ResizeObserver(size).observe(foot);
  if (still || !fine()) return;
  let raf = 0;
  const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  foot.addEventListener('pointermove', (e) => {
    const r = foot.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
    queue();
  });
  const fade = (v) => gsap.to(stateA, { v, duration: 0.6, overwrite: true, onUpdate: () => { a = stateA.v; queue(); } });
  const stateA = { v: 0 };
  foot.addEventListener('pointerenter', () => fade(1));
  foot.addEventListener('pointerleave', () => fade(0));
}
