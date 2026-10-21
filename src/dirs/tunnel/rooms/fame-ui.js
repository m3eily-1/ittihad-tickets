// The Hall of Fame's plaques (Ahmed, 2026-10-21: "tap a legend's plaque to hear their story and unlock their
// card"). fame.js tags each plaque userData.click = 'legend:<index into LEGENDS>'. A tap opens a panel: the
// legend's FC-style card (locked or not, from progress.cards), name, Arabic name, position, years and the
// sourced facts as a short story, with "Hear the story" (speechSynthesis, English). The spoken text is built
// only from legends.js fields — nothing is added. Cards are never unlocked here (achievements own that): a
// locked card shows the achievement that wins it. Hearing a whole story gives 10 XP, once per legend.
import './fame.css';
import { LEGENDS } from '../legends.js';
import { cardHTML, openCollection } from '../cards.js';

const HEARD_KEY = 'itt-fame-heard-v1';
const heard = new Set((() => { try { return JSON.parse(localStorage.getItem(HEARD_KEY)) || []; } catch { return []; } })());
const saveHeard = () => { try { localStorage.setItem(HEARD_KEY, JSON.stringify([...heard])); } catch { /* private mode */ } };
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// for the voice only: read "1996–2016" as "1996 to 2016" and "&" as "and" (formatting, not new words about anyone)
const speakable = (t) => String(t).replace(/(\d)\s*[–-]\s*(\d)/g, '$1 to $2').replace(/&/g, ' and ');

const canSpeak = (ctx) => 'speechSynthesis' in window && !ctx.feel.muted;
let P = null;   // the open panel: { root, ctx, i, off, story }

export function click(id, hit, ctx) {
  const m = /^legend:(\d+)$/.exec(id); if (!m) return;
  const i = +m[1]; if (!LEGENDS[i]) return;
  ctx.feel.tap();
  ctx.progress.achieve('fame');   // first plaque tap (no-op once done)
  if (P) { show(i); return; }
  open(i, ctx);
}
export function hover(id, ctx) {
  if (P) return;
  const m = /^legend:(\d+)$/.exec(id || '');
  ctx.room?.highlight?.(m ? +m[1] : null);
}
export function leave(ctx) { close(); ctx.room?.highlight?.(null); }

function open(i, ctx) {
  const root = document.createElement('div');
  root.className = 'hf';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Hall of Fame legend');
  root.innerHTML = `<div class="hf-panel">
      <header class="hf-top">
        <button type="button" class="hf-back js-hf-back">← Back</button>
        <p class="hf-k js-hf-k"></p>
        <div class="hf-nav"><button type="button" class="hf-arrow js-hf-prev" aria-label="Previous legend">‹</button><button type="button" class="hf-arrow js-hf-next" aria-label="Next legend">›</button></div>
      </header>
      <div class="hf-body js-hf-body"></div>
    </div>`;
  document.body.append(root);
  for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'touchstart', 'touchmove', 'touchend', 'click', 'keydown']) root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  // on touch screens the tap that opened this is followed by a click that lands on whatever is now under the
  // finger (Start, the shade…): swallow clicks for a moment
  const born = performance.now();
  root.addEventListener('click', (e) => { if (performance.now() - born < 450) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  // a tap on the shade outside the panel closes it
  root.addEventListener('click', (e) => { if (e.target === root) { ctx.feel.back(); close(); } });
  root.querySelector('.js-hf-back').addEventListener('click', () => { ctx.feel.back(); close(); });
  root.querySelector('.js-hf-prev').addEventListener('click', () => { ctx.feel.tap(); show((P.i + LEGENDS.length - 1) % LEGENDS.length); });
  root.querySelector('.js-hf-next').addEventListener('click', () => { ctx.feel.tap(); show((P.i + 1) % LEGENDS.length); });
  addEventListener('keydown', onKey, true);
  // a card unlocked while the panel is open (an achievement elsewhere): redraw it
  const off = ctx.progress.on((e) => { if (P && e.type === 'card' && e.index === P.i) renderCard(); });
  P = { root, ctx, i, off, story: null };
  show(i);
  requestAnimationFrame(() => root.classList.add('is-on'));
}

function close() {
  if (!P) return;
  const p = P; P = null;
  stopStory(p);
  removeEventListener('keydown', onKey, true);
  p.off?.();
  p.ctx.room?.highlight?.(null);
  p.root.classList.remove('is-on');
  setTimeout(() => p.root.remove(), 220);
}

function onKey(e) {
  if (!P || e.key === 'Tab') return;
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); P.ctx.feel.back(); close(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); show((P.i + LEGENDS.length - 1) % LEGENDS.length); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); show((P.i + 1) % LEGENDS.length); }
}

const isLocked = (i) => !P.ctx.progress.cards.includes(i);

function renderCard() {
  const slot = P.root.querySelector('.js-hf-card'); if (!slot) return;
  slot.innerHTML = cardHTML(P.i, { locked: isLocked(P.i), big: true });
  renderStatus();
}

function renderStatus() {
  const el = P.root.querySelector('.js-hf-status'); if (!el) return;
  const i = P.i, locked = isLocked(i), u = P.ctx.progress.unlockOf(i);
  const parts = [];
  parts.push(heard.has(i) ? '<li class="is-ok">✓ Story heard</li>' : '<li>Hear the whole story · <b>+10 XP</b></li>');
  parts.push(locked
    ? `<li class="is-lock">Card locked · unlock it: <b>${esc(u ? u.label : 'keep playing')}</b></li>`
    : '<li class="is-ok">✓ Card in your collection</li>');
  el.innerHTML = parts.join('');
}

function show(i) {
  if (!P) return;
  stopStory(P);
  P.i = i;
  const L = LEGENDS[i], ctx = P.ctx;
  ctx.room?.highlight?.(i);
  P.root.querySelector('.js-hf-k').textContent = `Hall of Fame · ${String(i + 1).padStart(2, '0')}/${LEGENDS.length}`;
  const voice = canSpeak(ctx);
  P.root.querySelector('.js-hf-body').innerHTML = `
    <div class="hf-card js-hf-card"></div>
    <div class="hf-text">
      <h2 class="hf-name" data-seg="0">${esc(L.name)}</h2>
      ${L.ar ? `<p class="hf-ar" lang="ar" dir="rtl">${esc(L.ar)}</p>` : ''}
      <p class="hf-meta" data-seg="1"><b>${esc(L.pos)}</b><span>${esc(L.years)}</span></p>
      <ol class="hf-story">${L.facts.map((f, k) => `<li data-seg="${k + 2}">${esc(f)}</li>`).join('')}</ol>
      <div class="hf-act">
        <button type="button" class="hf-btn js-hf-play">${voice ? '▶ Hear the story' : '▶ Read the story'}</button>
        <button type="button" class="hf-btn is-ghost js-hf-col">Collection</button>
      </div>
      ${voice ? '' : `<p class="hf-note">${ctx.feel.muted ? 'Sound is off, so the story plays as a read-along. Switch the chants on to hear it.' : 'This browser can’t speak, so the story plays as a read-along.'}</p>`}
      <ul class="hf-status js-hf-status"></ul>
    </div>`;
  renderCard();
  P.root.querySelector('.js-hf-play').addEventListener('click', () => { if (P.story) { ctx.feel.back(); stopStory(P); } else playStory(); });
  P.root.querySelector('.js-hf-col').addEventListener('click', () => { ctx.feel.tap(); stopStory(P); openCollection(); });
  P.root.querySelector('.hf-text').scrollTop = 0;
}

/* the story: name · position and years · each fact, one utterance each so the line being spoken lights up */
function playStory() {
  const p = P, L = LEGENDS[p.i], i = p.i;
  const segs = [L.name, `${L.pos}, ${L.years}`, ...L.facts];
  const els = segs.map((_, k) => p.root.querySelector(`[data-seg="${k}"]`));
  const voice = canSpeak(p.ctx);
  const story = { k: -1, timer: 0, utts: [], done: false };
  p.story = story;
  const btn = p.root.querySelector('.js-hf-play');
  btn.textContent = '■ Stop'; btn.classList.add('is-on');
  p.root.querySelector('.hf-text').classList.add('is-telling');
  let en = null;
  if (voice) {
    speechSynthesis.cancel();
    const vs = speechSynthesis.getVoices();
    en = vs.find((v) => /^en(-|_)GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  }
  const next = () => {
    if (P !== p || p.story !== story) return;
    clearTimeout(story.timer);
    els[story.k]?.classList.remove('is-now');
    if (story.k >= 0) els[story.k]?.classList.add('is-said');
    story.k++;
    if (story.k >= segs.length) { finish(); return; }
    const el = els[story.k];
    el?.classList.add('is-now');
    // keep the line in view inside the text column (never scrollIntoView: scrolling the page walks the tunnel)
    const box = p.root.querySelector('.hf-text');
    if (el && box && box.scrollHeight > box.clientHeight) {
      const top = el.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' });
    }
    const text = segs[story.k], k = story.k;
    if (voice) {
      const u = new SpeechSynthesisUtterance(speakable(text));
      u.lang = en?.lang || 'en-GB'; if (en) u.voice = en; u.rate = 0.95;
      let moved = false;
      const t0 = performance.now(), readMs = 1300 + text.length * 55;
      // no voice installed (or it fails at once): hold the line for as long as it takes to read it
      const go = (ev) => {
        if (moved) return; moved = true;
        const took = performance.now() - t0;
        const silent = (ev?.type === 'error' && ev.error !== 'interrupted' && ev.error !== 'canceled') || (ev?.type === 'end' && took < 250);
        story.timer = setTimeout(next, silent ? Math.max(260, readMs - took) : 260);
      };
      u.onend = go; u.onerror = go;
      story.utts.push(u);   // keep a reference (Chrome drops events for collected utterances)
      speechSynthesis.speak(u);
      setTimeout(() => { if (!moved && p.story === story && story.k === k) go(); }, 2500 + text.length * 120);   // if the voice never reports back
    } else story.timer = setTimeout(next, 1300 + text.length * 55);
  };
  const finish = () => {
    story.done = true;
    const first = !heard.has(i);
    if (first) { heard.add(i); saveHeard(); p.ctx.progress.award(10, 'Heard a legend'); }
    stopStory(p, true);
    renderStatus();
  };
  next();
}

function stopStory(p, keep = false) {
  const s = p?.story; if (!s) return;
  p.story = null;
  clearTimeout(s.timer);
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const btn = p.root.querySelector('.js-hf-play');
  if (btn) { btn.textContent = canSpeak(p.ctx) ? '▶ Hear the story' : '▶ Read the story'; btn.classList.remove('is-on'); }
  const t = p.root.querySelector('.hf-text');
  t?.classList.remove('is-telling');
  t?.querySelectorAll('.is-now, .is-said').forEach((el) => { el.classList.remove('is-now'); if (!keep) el.classList.remove('is-said'); });
  if (keep) setTimeout(() => t?.querySelectorAll('.is-said').forEach((el) => el.classList.remove('is-said')), 1600);
}
