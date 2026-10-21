// The trophy room's interactions (Ahmed, 2026-10-21: "for the trophy I want to hear the story of it and see the
// moments of the winning and the festival"). Tap a trophy: it rises off its pedestal and turns in front of you
// (museum.js present()), and a story panel opens beside it — the years won as a timeline, the story (read aloud
// with the browser's own voice, sentence by sentence), "Lift it" (it comes up over your head with confetti and the
// crowd) and the videos of the wins. Contract: ../room-ui.js.
//
// Words and videos come from ../trophy-media.js (TROPHY_MEDIA[key] = { story, videos }, shown only once APPROVED).
// That file may not exist yet, so it's picked up through import.meta.glob: an empty match when it's missing, and
// Vite adds it (dev and build) the moment it appears. Until then the story is built only from trophies.js — the
// name and the years — and nothing else is said about the club's history.
import './trophies-ui.css';
import { TROPHIES } from '../trophies.js';

const MEDIA_FILE = import.meta.glob('../trophy-media.js');
let mediaP = null;
const loadMedia = () => (mediaP ||= (MEDIA_FILE['../trophy-media.js']?.() ?? Promise.resolve({})).catch(() => ({})));

const LIFTED_KEY = 'itt-trophy-lifted-v1';   // trophies you've lifted (the +20 XP is once per trophy)
const lifted = (() => { try { return new Set(JSON.parse(localStorage.getItem(LIFTED_KEY)) || []); } catch { return new Set(); } })();
const saveLifted = () => { try { localStorage.setItem(LIFTED_KEY, JSON.stringify([...lifted])); } catch { /* private mode */ } };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
// the story, as sentences: the approved text, or one built only from trophies.js
function storyOf(t, media) {
  const s = media?.APPROVED && media?.TROPHY_MEDIA?.[t.key]?.story;
  if (s) return (Array.isArray(s) ? s.join(' ') : String(s)).split(/(?<=[.!?])\s+(?=\S)/).map((x) => x.trim()).filter(Boolean);
  const out = [`Al-Ittihad have won the ${t.name} in ${list(t.years)}.`];
  if (t.note) out.push(/[.!?]$/.test(t.note) ? t.note : `${t.note}.`);
  return out;
}
// videos: only once approved; each { id, title, channel, kind: 'final' | 'celebration', year, official } —
// official: false is a fan re-upload of the broadcast: shown, tagged "Fan archive", without the uploader's name
function videosOf(t, media) {
  if (!media?.APPROVED) return [];
  const m = media?.TROPHY_MEDIA?.[t.key] || {};
  const vs = m.videos || m.moments || [];
  return (Array.isArray(vs) ? vs : []).map((v) => {
    const raw = typeof v === 'string' ? v : v.id || v.videoId || v.youtube || v.yt || v.url || '';
    const id = (String(raw).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/) || [])[1] || (/^[\w-]{11}$/.test(raw) ? raw : '');
    return id && { id, title: v.title || '', channel: v.channel || v.author || v.by || '', kind: v.kind || '', year: v.year || '', official: v.official !== false };
  }).filter(Boolean);
}
// how the voice should say a season: "1999–2000" → "1999 to 2000"
const KIND = { final: 'The final', celebration: 'Celebrations' };
// the story's sources (approved stories only), as small links under it
function sourcesOf(t, media) {
  const src = media?.APPROVED && media?.TROPHY_MEDIA?.[t.key]?.story ? media.TROPHY_MEDIA[t.key].sources || [] : [];
  return src.map((u) => {
    try {
      const url = new URL(u), host = url.hostname.replace(/^(www|en|africa)\./, '');
      // Wikipedia: the article's title; anything else: the site
      const h = /wikipedia\.org$/.test(host) ? decodeURIComponent(url.pathname.split('/').pop()).replace(/_/g, ' ') : host;
      return { u, h };
    } catch { return null; }
  }).filter(Boolean);
}
const spoken = (s) => s.replace(/(\d{4})[–-](\d{2,4})/g, '$1 to $2').replace(/—/g, ', ');

/* ───────── the browser's voice ───────── */
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
function voice() {
  const vs = synth?.getVoices?.() || [];
  const en = vs.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pref = ['Daniel', 'Google UK English Male', 'Arthur', 'Google UK English Female', 'Serena', 'Samantha', 'Google US English', 'Alex'];
  for (const n of pref) { const v = en.find((x) => x.name.startsWith(n)); if (v) return v; }
  return en.find((v) => /GB/i.test(v.lang) && v.localService) || en.find((v) => v.localService) || en[0] || null;
}
synth?.addEventListener?.('voiceschanged', () => {});   // (Chrome fills the list late; asking once warms it)
synth?.getVoices?.();

/* ───────── the panel ───────── */
let ui = null;        // { root, panel, ... } once built
let cur = null;       // { t, ctx, sents, media }
let reading = null;   // { token, i, timer, voiced }

function build() {
  const root = document.createElement('div');
  root.className = 'tr-root';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'tr-name');
  root.innerHTML = `
    <div class="tr-stage js-tr-stage"><span class="tr-hint">Drag to turn it</span></div>
    <aside class="tr-panel js-tr-panel">
      <header class="tr-hd">
        <button type="button" class="tr-back js-tr-close" aria-label="Close and put the trophy back">← Back to the room</button>
        <span class="tr-kick js-tr-scope"></span>
      </header>
      <h2 class="tr-name" id="tr-name"></h2>
      <ol class="tr-years js-tr-years" aria-label="Years won"></ol>
      <div class="tr-acts">
        <button type="button" class="tr-btn tr-btn--y js-tr-hear"><span class="tr-ico" aria-hidden="true">▶</span><span class="js-tr-hear-l">Hear the story</span></button>
        <button type="button" class="tr-btn js-tr-lift">Lift it</button>
      </div>
      <p class="tr-sub js-tr-voicehint" hidden></p>
      <div class="tr-story js-tr-story" aria-live="polite"></div>
      <p class="tr-src js-tr-src" hidden></p>
      <section class="tr-moments" aria-labelledby="tr-mh">
        <h3 class="tr-mh" id="tr-mh">Moments</h3>
        <div class="tr-player js-tr-player" hidden>
          <div class="tr-frame js-tr-frame"></div>
          <div class="tr-prow"><p class="tr-ptitle js-tr-ptitle"></p><button type="button" class="tr-back tr-back--s js-tr-pclose">✕ Close video</button></div>
        </div>
        <div class="tr-vids js-tr-vids"></div>
      </section>
      <p class="tr-fine js-tr-fine"></p>
    </aside>`;
  document.body.append(root);
  const $ = (s) => root.querySelector(s);
  ui = {
    root, panel: $('.js-tr-panel'), stage: $('.js-tr-stage'), scope: $('.js-tr-scope'), name: $('#tr-name'), years: $('.js-tr-years'),
    hear: $('.js-tr-hear'), hearL: $('.js-tr-hear-l'), lift: $('.js-tr-lift'), story: $('.js-tr-story'), vids: $('.js-tr-vids'),
    player: $('.js-tr-player'), frame: $('.js-tr-frame'), ptitle: $('.js-tr-ptitle'), fine: $('.js-tr-fine'), src: $('.js-tr-src'), vhint: $('.js-tr-voicehint'),
  };
  // nothing in here reaches the 3D scene (look-around drags, the room's click raycast, wheel walking, the joystick)
  for (const ev of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'wheel', 'touchstart', 'touchmove', 'touchend', 'click', 'dblclick', 'contextmenu']) {
    root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  }
  $('.js-tr-close').addEventListener('click', () => close());
  ui.hear.addEventListener('click', () => { cur?.ctx.feel.tap(); reading ? stopReading() : startReading(); });
  ui.lift.addEventListener('click', liftIt);
  $('.js-tr-pclose').addEventListener('click', () => { cur?.ctx.feel.back(); closeVideo(); });
  ui.vids.addEventListener('click', (e) => { const b = e.target.closest('[data-vid]'); if (b) { cur?.ctx.feel.tap(); playVideo(b.dataset.vid, b.dataset.title); } });
  // drag the empty side to turn the floating trophy
  let drag = null;
  ui.stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, id: e.pointerId }; ui.stage.setPointerCapture?.(e.pointerId); ui.stage.classList.add('is-drag'); });
  ui.stage.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; cur?.ctx.room?.nudge?.((e.clientX - drag.x) * 0.012); drag.x = e.clientX; });
  const end = () => { drag = null; ui.stage.classList.remove('is-drag'); };
  ui.stage.addEventListener('pointerup', end); ui.stage.addEventListener('pointercancel', end);
  addEventListener('resize', () => { if (cur) cur.ctx.room?.setView?.(viewFor()); });
  return ui;
}

// keys: Escape closes the panel; the room's walking keys are held while it's open (a capture listener on window
// runs before the scene's own key handler)
function onKey(e) {
  if (!cur) return;
  if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
  if (/^(w|a|s|d|arrowup|arrowdown|arrowleft|arrowright|pageup|pagedown| )$/i.test(e.key) && !e.target.closest?.('input, textarea')) e.stopPropagation();
}

// where the trophy floats: the middle of the part of the screen the panel leaves free
function viewFor() {
  const W = innerWidth, H = innerHeight, r = ui.panel.getBoundingClientRect();
  const side = r.height > H * 0.8;   // a side panel (landscape) or a bottom sheet (portrait)
  const fx0 = 0, fx1 = side ? r.left : W, fy0 = 0, fy1 = side ? H : r.top;
  const fw = Math.max(80, fx1 - fx0), fh = Math.max(80, fy1 - fy0);
  return {
    x: ((fx0 + fx1) / 2 / W) * 2 - 1,
    y: -(((fy0 + fy1) / 2 / H) * 2 - 1) + 0.04,
    fill: Math.min(0.5 * fh / H, 1.1 * fw / H),   // (a little under: the near rim of a wide cup reads bigger in perspective)
  };
}

function render() {
  const { t, sents, media } = cur;
  ui.scope.textContent = t.scope;
  ui.name.textContent = t.name;
  ui.years.innerHTML = t.years.map((y) => `<li class="tr-year" data-y="${esc(y)}"><span>${esc(y)}</span></li>`).join('');
  ui.story.innerHTML = sents.map((s, i) => `<span class="tr-s" data-i="${i}">${esc(s)}</span>`).join(' ');
  const src = sourcesOf(t, media);
  ui.src.hidden = !src.length;
  ui.src.innerHTML = src.length ? `Sources: ${src.map((x) => `<a href="${esc(x.u)}" target="_blank" rel="noopener noreferrer">${esc(x.h)}</a>`).join(' · ')}` : '';
  renderVids();
  ui.fine.textContent = t.modelNote || '';
  ui.fine.hidden = !t.modelNote;
  syncHear();
  ui.lift.textContent = lifted.has(t.key) ? 'Lift it again' : 'Lift it';
  ui.lift.disabled = !!cur.ctx.room?.lifting;
}
function renderVids() {
  const { t, media } = cur;
  const vids = videosOf(t, media);
  ui.vids.innerHTML = vids.length
    ? vids.map((v) => `
      <button type="button" class="tr-vid" data-vid="${esc(v.id)}" data-title="${esc(v.title)}" aria-label="Play ${esc(v.title || 'video')}${v.official ? '' : ' (fan archive)'}">
        <span class="tr-thumb"><img src="https://i.ytimg.com/vi/${encodeURIComponent(v.id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async"><i aria-hidden="true">▶</i>${v.official ? '' : '<b class="tr-tag">Fan archive</b>'}</span>
        <span class="tr-vm">${[v.year, KIND[v.kind] || ''].filter(Boolean).map(esc).join(' · ')}</span>
        <span class="tr-vt" dir="auto">${esc(v.title)}</span>${v.official && v.channel ? `<span class="tr-vc" dir="auto">${esc(v.channel)}</span>` : ''}
      </button>`).join('')
    : '<p class="tr-soon">Videos of the wins are coming soon</p>';
  ui.vids.classList.toggle('is-empty', !vids.length);
  ui.vids.setAttribute('aria-busy', media ? 'false' : 'true');
  if (!ui.player.hidden && !vids.length) closeVideo();
}

function open(key, ctx) {
  const t = TROPHIES.find((x) => x.key === key);
  if (!t) return;
  if (!ui) build();
  stopReading();
  closeVideo();
  const first = !cur;
  cur = { t, ctx, media: null, sents: storyOf(t, null) };
  render();
  ui.root.hidden = false;
  ui.root.classList.remove('is-lift');
  requestAnimationFrame(() => ui.root.classList.add('is-in'));
  ui.panel.scrollTop = 0;
  if (first) addEventListener('keydown', onKey, true);
  ctx.feel.tap();
  // the panel is laid out now: frame the trophy in the space it leaves
  ctx.room?.present?.(key, viewFor());
  loadMedia().then((media) => {
    if (cur?.t !== t) return;
    cur.media = media;
    if (reading) { renderVids(); return; }   // (the story being read keeps its sentences)
    cur.sents = storyOf(t, media);
    render();
  });
  setTimeout(() => ui.root.querySelector('.js-tr-close')?.focus({ preventScroll: true }), 60);
}

function close({ instant = false } = {}) {
  if (!cur) return;
  const { ctx } = cur;
  stopReading();
  closeVideo();
  cur = null;
  removeEventListener('keydown', onKey, true);
  ctx.room?.reset?.(instant);
  if (!instant) ctx.feel.back();
  ui.root.classList.remove('is-in', 'is-lift');
  const r = ui.root;
  setTimeout(() => { if (!cur) r.hidden = true; }, instant ? 0 : 260);
}

/* ───────── read aloud: one utterance per sentence (Chrome cuts long ones off), the spoken one highlighted;
   with the sound off — or no voice in this browser — the same highlight steps through silently ───────── */
function syncHear() {
  const muted = cur?.ctx.feel.muted, voiced = !!synth && !muted;
  ui.hearL.textContent = reading ? 'Stop' : voiced ? 'Hear the story' : 'Read the story';
  ui.hear.querySelector('.tr-ico').textContent = reading ? '■' : '▶';
  ui.hear.setAttribute('aria-pressed', reading ? 'true' : 'false');
  ui.vhint.hidden = voiced || !muted;
  ui.vhint.textContent = muted ? 'Sound is off — the story reads along without the voice.' : '';
}
function mark(i) {
  ui.story.querySelectorAll('.tr-s').forEach((el) => el.classList.toggle('is-on', +el.dataset.i === i));
  ui.story.classList.toggle('is-reading', i >= 0);
  // light the years the sentence mentions
  const s = i >= 0 ? cur.sents[i] : '';
  ui.years.querySelectorAll('.tr-year').forEach((el) => el.classList.toggle('is-on', !!s && s.includes(el.dataset.y)));
  const on = ui.story.querySelector('.tr-s.is-on');
  if (on) { const pr = ui.panel.getBoundingClientRect(), r = on.getBoundingClientRect(); if (r.bottom > pr.bottom - 20 || r.top < pr.top + 60) on.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
function startReading() {
  if (!cur) return;
  closeVideo();
  const token = {};
  reading = { token, i: 0, timer: 0 };
  syncHear();
  sayNext(token);
}
function sayNext(token) {
  if (!reading || reading.token !== token || !cur) return;
  const i = reading.i;
  if (i >= cur.sents.length) { stopReading(); return; }
  mark(i);
  const text = cur.sents[i];
  const next = () => { if (reading?.token !== token) return; clearTimeout(reading.timer); reading.i++; reading.timer = setTimeout(() => sayNext(token), 260); };
  const silent = () => { reading.timer = setTimeout(next, 900 + text.split(/\s+/).length * 330); };
  if (!synth || cur.ctx.feel.muted) { silent(); return; }
  const u = new SpeechSynthesisUtterance(spoken(text));
  const v = voice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
  u.rate = 0.96; u.pitch = 1;
  let started = false;
  u.onstart = () => { started = true; };
  u.onend = () => { if (reading?.token === token && !cur?.ctx.feel.muted) next(); };
  u.onerror = (e) => { if (reading?.token === token && e.error !== 'interrupted' && e.error !== 'canceled') { started = true; silent(); } };
  synth.cancel();
  synth.speak(u);
  // no voice came (no voices installed, autoplay rules): carry on silently; the sound switched off: hush, carry on
  reading.timer = setTimeout(function watch() {
    if (reading?.token !== token) return;
    if (cur?.ctx.feel.muted) { synth.cancel(); syncHear(); silent(); return; }
    if (!started) { synth.cancel(); silent(); return; }
    reading.timer = setTimeout(watch, 400);
  }, 1600);
}
function stopReading() {
  if (!reading) return;
  clearTimeout(reading.timer);
  reading = null;
  try { synth?.cancel(); } catch { /* ignore */ }
  if (ui && cur) { mark(-1); syncHear(); }
}

/* ───────── lift it ───────── */
async function liftIt() {
  if (!cur || ui.lift.disabled) return;
  const { t, ctx } = cur;
  ui.lift.disabled = true;
  ui.root.classList.add('is-lift');   // the panel steps aside for the moment
  const done = ctx.room?.lift?.(t.key);
  setTimeout(() => {
    if (cur?.t !== t) return;
    ctx.feel.win(); ctx.feel.roar(); ctx.feel.confetti({ n: 220, x: 0.5, y: 0.3 });
    if (!lifted.has(t.key)) { lifted.add(t.key); saveLifted(); ctx.progress.award(20, 'Lifted a trophy'); }
  }, 650);
  await (done || new Promise((r) => setTimeout(r, 4000)));
  if (cur?.t !== t) return;
  ui.root.classList.remove('is-lift');
  ui.lift.disabled = false;
  ui.lift.textContent = 'Lift it again';
}

/* ───────── moments ───────── */
function playVideo(id, title) {
  stopReading();
  ui.frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1" title="${esc(title || 'Video')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  ui.ptitle.textContent = title || '';
  ui.ptitle.dir = 'auto';
  ui.player.hidden = false;
  ui.player.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function closeVideo() { if (!ui) return; ui.frame.innerHTML = ''; ui.player.hidden = true; }

/* ───────── the room-ui contract ───────── */
export function click(id, hit, ctx) {
  if (!String(id).startsWith('trophy:')) return;
  open(id.slice(7), ctx);
}
export function hover(id, ctx) { ctx.room?.hover?.(id && String(id).startsWith('trophy:') ? id.slice(7) : null); }
export function enter() { loadMedia(); }
export function leave(ctx) { ctx.room?.hover?.(null); if (cur) close({ instant: true }); else ctx.room?.reset?.(true); }
