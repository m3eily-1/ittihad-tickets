// Supporters community (Ahmed, 2026-10-21: "add a community where users can find other Ittihad supporters and
// share interests and chat"; he chose a demo first). Laid out like the news inbox (FC Mobile's inbox): a tab rail
// (My profile, Find fans, Groups, Match rooms, Messages), the list in the middle, the open item on the right.
// It's a DEMO: sample fans, demo groups and simulated replies, labelled as such on screen at all times. All
// reads and writes go through `store` (community-data.js), which is where a real backend (Supabase) plugs in.
import './community.css';
import { progress } from './progress.js';
import { feel } from './feel.js';
import { LEGENDS } from './legends.js';
import { SQUAD } from './squad.js';
import { store, INTERESTS, CITIES, GUIDELINES, AV_COLORS, DEMO_NOTE } from './community-data.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M3 11l9-7 9 7 M5 10v10h14V10"/>',
  cart: '<path d="M3 4h2l2.4 11h11l2-8H6.2 M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>',
  user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0"/>',
  find: '<path d="M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M3.5 20a6.5 6.5 0 0 1 10-5.5 M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M19.2 19.2L22 22"/>',
  group: '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.5a3.5 3.5 0 0 1 0 6.5 M18 14a6 6 0 0 1 3.5 6"/>',
  room: '<path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z M14 7v12"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z M8 9h8 M8 12h5"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 14v4 M8 21h8 M9 18h6"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z M9 12l2 2 4-4"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z M11.5 13.5L20 4"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const initials = (name) => (String(name || '').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
const light = (c) => { const n = parseInt(String(c).slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; };
const avatar = (name, color = AV_COLORS[0], cls = '') => `<span class="cm-av ${cls}" style="--av:${esc(color)};--avt:${light(color) ? '#111' : '#fff'}" aria-hidden="true">${esc(initials(name))}</span>`;
const DD = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const ago = (at) => { const d = (Date.now() - at) / 60e3; return d < 1 ? 'now' : d < 60 ? `${Math.floor(d)}m` : d < 1440 ? `${Math.floor(d / 60)}h` : DD.format(at); };
const QUICK = ['Yalla!', 'COYT', 'Up the Tigers', 'Agreed', 'See you there'];
const ALL_TABS = [['profile', 'user', 'My profile'], ['fans', 'find', 'Find fans'], ['dms', 'chat', 'DM'], ['groups', 'group', 'Groups'], ['rooms', 'room', 'Match rooms']];   // DM first (Ahmed, 2026-10-22)
const REPORT_WHY = ['Abuse or harassment', 'Hate speech', 'Spam or scams', 'Sharing personal info', 'Something else'];
const playerLabel = (name) => { const p = SQUAD.find((x) => x.name === name); return p ? `#${p.no} ${p.name}` : name || ''; };

let root = null, cleanup = null;
// mode 'profile' = your fan profile on its own (the main menu's profile chip — Ahmed moved it out of the community);
// the community itself no longer has a profile tab
// room: open straight on that match room (the live match's "Match room" button, Ahmed 2026-10-26)
export function openCommunity({ onClose, onFriends, onCart, onHome, mode = 'community', room = '' } = {}) {
  const PROFILE = mode === 'profile';
  // (Ahmed: find fans lives inside DM now — its own tab is gone; the DM tab stays lit while you browse fans)
  const TABS = PROFILE ? ALL_TABS.filter(([k]) => k === 'profile') : ALL_TABS.filter(([k]) => k !== 'profile' && k !== 'fans' && k !== 'rooms');   // match rooms sit inside Groups (segmented)
  cleanup?.(); root?.remove();
  root = document.createElement('div');
  const el = root;
  el.className = 'cm'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Supporters community');
  document.body.append(el);

  const me = () => store.getProfile() || { name: progress.name || '', color: AV_COLORS[0], interests: [] };
  const toRoom = !PROFILE && room && store.getRoom(room) ? room : '';
  const sel = { fans: null, groups: store.listGroups()[0]?.id, rooms: toRoom || store.listRooms()[0]?.id, dms: store.listDMs()[0]?.fan.id };
  const filt = { city: '', player: '', interests: [], sort: 'common' };
  const typing = new Map();      // thread → Set of fan ids typing
  const unread = new Set();      // threads with replies you haven't opened (this session)
  let tab = PROFILE ? 'profile' : toRoom ? 'rooms' : 'dms';
  let modal = null;              // 'rules' | { kind:'report', … } | { kind:'block', id }
  let draft = null;              // the profile form while you edit it

  // ── the shell: header, demo banner, rail | list | detail ──
  el.innerHTML = `<header class="cm__hd"><button type="button" class="cm__icbtn" data-act="close" aria-label="Back">${svg('back')}</button>
      <div class="cm__ttl"><h2>${PROFILE ? 'My profile' : 'Community'}</h2></div>
</header>
    <p class="cm__demo" role="note"><button type="button" data-act="rules">${svg('shield')}Guidelines</button></p>
    <div class="cm__body${PROFILE ? ' is-profile' : ''}"><nav class="cm__tabs" aria-label="Community sections"></nav><section class="cm__list"></section><article class="cm__detail"></article></div>
    <div class="cm__modal" hidden></div><p class="cm__toast" role="status" aria-live="polite"></p>`;
  const $ = (s) => el.querySelector(s);
  const railEl = $('.cm__tabs'), listEl = $('.cm__list'), detEl = $('.cm__detail'), modalEl = $('.cm__modal'), toastEl = $('.cm__toast');

  let toastT = 0;
  const toast = (t) => { toastEl.textContent = t; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2600); };

  const threadOf = () => (tab === 'groups' && sel.groups ? `g:${sel.groups}` : tab === 'rooms' && sel.rooms ? `r:${sel.rooms}` : tab === 'dms' && sel.dms ? `dm:${sel.dms}` : null);
  const nameOf = (from) => (from === 'me' ? me().name || 'You' : store.getFan(from)?.name || 'Fan');
  const colorOf = (from) => (from === 'me' ? me().color || AV_COLORS[0] : store.getFan(from)?.color);

  // ── rail ──
  const renderRail = () => {
    const dmUnread = [...unread].filter((t) => t.startsWith('dm:')).length;
    const badge = { profile: store.isComplete() ? 0 : '!', dms: dmUnread };
    railEl.innerHTML = TABS.map(([k, ic, l]) => { const on = tab === k || (k === 'dms' && tab === 'fans') || (k === 'groups' && tab === 'rooms'); return `<button type="button" class="${on ? 'is-on' : ''}" data-act="tab" data-k="${k}" aria-pressed="${on}">${svg(ic)}<span>${l}</span>${badge[k] ? `<i>${badge[k]}</i>` : ''}</button>`; }).join('');
  };

  // ── list (middle) ──
  const chip = (t, on, act = '', extra = '') => `<button type="button" class="cm-chip ${on ? 'is-on' : ''}" ${act ? `data-act="${act}" data-v="${esc(t)}"` : ''} ${extra}>${esc(t)}</button>`;
  const tag = (t, on) => `<span class="cm-tag ${on ? 'is-on' : ''}">${esc(t)}</span>`;
  const renderList = () => {
    const p = store.getProfile();
    if (tab === 'profile') {
      const m = me(), cards = progress.cards.length;
      listEl.innerHTML = `<p class="cm__lh">${svg('user')}Your fan card</p><div class="cm__scroll">
        <div class="cm-card">${avatar(m.name, m.color, 'is-l')}<div><b>${esc(m.name || 'Your name')}</b><em>${esc([p?.city, p?.since && `Supporter since ${p.since}`].filter(Boolean).join(' · ') || 'Fill in your profile')}</em></div></div>
        <dl class="cm-stats"><div><dt>Level</dt><dd>${progress.level}</dd></div><div><dt>Legend gems</dt><dd>${cards}<small>/${LEGENDS.length}</small></dd></div><div><dt>Following</dt><dd>${store.following.length}</dd></div><div><dt>Groups</dt><dd>${store.joined.length}</dd></div></dl>
        ${p?.interests?.length ? `<div class="cm-tags">${p.interests.map((x) => tag(x, true)).join('')}</div>` : ''}
        <div class="cm-rules"><p>${svg('shield')}Community guidelines</p><ul>${GUIDELINES.map(([h]) => `<li>${esc(h)}</li>`).join('')}</ul><button type="button" class="cm-link" data-act="rules">Read them all</button></div>
        ${store.blocked.length ? `<div class="cm-blocked"><p>Blocked fans</p><ul>${store.blocked.map((id) => `<li>${avatar(store.getFan(id)?.name, store.getFan(id)?.color, 'is-s')}<span>${esc(store.getFan(id)?.name)}</span><button type="button" class="cm-link" data-act="unblock" data-id="${esc(id)}">Unblock</button></li>`).join('')}</ul></div>` : ''}
      </div>`;
      return;
    }
    if (tab === 'fans') {
      const fans = store.listFans(filt);
      if (!fans.some((f) => f.id === sel.fans)) sel.fans = fans[0]?.id || null;
      listEl.innerHTML = `<p class="cm__lh"><button type="button" class="cm-link cm-dmback" data-act="tab" data-k="dms">← DM</button>${svg('find')}Find fans<span class="cm__count">${fans.length} sample fans</span></p>
        <div class="cm-filt"><label><span>City</span><select data-f="city"><option value="">All cities</option>${CITIES.map((c) => `<option ${filt.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label><span>Favourite player</span><select data-f="player"><option value="">Any player</option>${SQUAD.map((s) => `<option value="${esc(s.name)}" ${filt.player === s.name ? 'selected' : ''}>${esc(playerLabel(s.name))}</option>`).join('')}</select></label>
          <label><span>Sort</span><select data-f="sort">${[['common', 'Most in common'], ['level', 'Highest level'], ['since', 'Longest support']].map(([v, l]) => `<option value="${v}" ${filt.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <div class="cm-chips" role="group" aria-label="Interests">${INTERESTS.map((x) => chip(x, filt.interests.includes(x), 'filt-int')).join('')}</div>
        <ul class="cm__items">${fans.map((f) => `<li><button type="button" class="${f.id === sel.fans ? 'is-on' : ''}" data-act="sel" data-id="${esc(f.id)}">${avatar(f.name, f.color)}
          <span class="cm-it"><b>${esc(f.name)}${store.isFollowing(f.id) ? '<small class="cm-fl">Following</small>' : ''}</b><em>${esc(f.city)} · Lv ${f.level}</em>
            <span class="cm-tags">${[...f.interests].sort((a, b) => f.shared.includes(b) - f.shared.includes(a)).slice(0, 3).map((x) => tag(x, f.shared.includes(x))).join('')}</span></span>
          ${p ? `<strong class="cm-common">${f.shared.length}<small>in common</small></strong>` : ''}</button></li>`).join('') || '<li class="cm__empty">No fans match these filters.</li>'}</ul>`;
      return;
    }
    if (tab === 'groups') {
      listEl.innerHTML = `<div class="cm-seg" role="tablist"><button type="button" class="${tab === 'groups' ? 'is-on' : ''}" data-act="tab" data-k="groups">Public groups</button><button type="button" class="${tab === 'rooms' ? 'is-on' : ''}" data-act="tab" data-k="rooms">Match rooms</button></div><ul class="cm__items">${store.listGroups().map((g) => `<li><button type="button" class="${g.id === sel.groups ? 'is-on' : ''}" data-act="sel" data-id="${esc(g.id)}">
          <span class="cm-gm" aria-hidden="true">${esc(initials(g.name))}</span><span class="cm-it"><b>${esc(g.name)}</b><em>${g.members.toLocaleString('en')} members</em><span class="cm-tags">${tag(g.topic, p?.interests?.includes(g.topic))}${g.city ? tag(g.city, p?.city === g.city) : ''}</span></span>
          ${g.joined ? '<small class="cm-joined">Joined</small>' : ''}${unread.has(`g:${g.id}`) ? '<i class="cm__dot"></i>' : ''}</button></li>`).join('')}</ul>`;
      return;
    }
    if (tab === 'rooms') {
      const rooms = store.listRooms();
      listEl.innerHTML = `<div class="cm-seg" role="tablist"><button type="button" class="${tab === 'groups' ? 'is-on' : ''}" data-act="tab" data-k="groups">Public groups</button><button type="button" class="${tab === 'rooms' ? 'is-on' : ''}" data-act="tab" data-k="rooms">Match rooms</button></div><ul class="cm__items">${rooms.map((r) => `<li><button type="button" class="${r.id === sel.rooms ? 'is-on' : ''}" data-act="sel" data-id="${esc(r.id)}">
          <span class="cm-crests" aria-hidden="true"><img src="/teams/al-ittihad.png" alt=""/>${r.crest ? `<img src="${esc(r.crest)}" alt=""/>` : `<i>${esc(initials(r.opp))}</i>`}</span>
          <span class="cm-it"><b>${esc(r.name)}</b><em>${esc(r.date)}</em><span class="cm-sub">${esc(r.comp)}</span></span>${unread.has(`r:${r.id}`) ? '<i class="cm__dot"></i>' : ''}</button></li>`).join('') || '<li class="cm__empty">No upcoming fixtures yet.</li>'}</ul>`;
      return;
    }
    const dms = store.listDMs();
    if (!dms.some((d) => d.fan.id === sel.dms)) sel.dms = dms[0]?.fan.id || null;
    listEl.innerHTML = `<p class="cm__lh">${svg('chat')}DM<button type="button" class="cm-btn cm-findbtn" data-act="tab" data-k="fans">${svg('find')}Find fans</button></p><ul class="cm__items">${dms.map(({ fan, last }) => `<li><button type="button" class="${fan.id === sel.dms ? 'is-on' : ''}" data-act="sel" data-id="${esc(fan.id)}">${avatar(fan.name, fan.color)}
        <span class="cm-it"><b>${esc(fan.name)}</b><span class="cm-sub">${last ? esc(`${last.from === 'me' ? 'You: ' : ''}${store.isReported(last.id) ? 'Reported message' : last.text}`) : 'Say hello'}</span></span>
        ${last ? `<time>${ago(last.at)}</time>` : ''}${unread.has(`dm:${fan.id}`) ? '<i class="cm__dot"></i>' : ''}</button></li>`).join('') || '<li class="cm__empty">No messages yet. Tap Find fans and message someone you have things in common with.</li>'}</ul>`;
  };

  // ── detail (right) ──
  const msgHTML = (m) => {
    const mine = m.from === 'me', fan = !mine && store.getFan(m.from), rep = store.isReported(m.id);
    return `<li class="cm-msg ${mine ? 'is-me' : ''}" data-mid="${esc(m.id)}">${avatar(nameOf(m.from), colorOf(m.from), 'is-s')}<div>
      <p class="cm-msg__h"><b>${esc(nameOf(m.from))}</b><time>${ago(m.at)}</time></p>
      <p class="cm-msg__t ${rep ? 'is-rep' : ''}">${rep ? 'You reported this message. It is hidden for you.' : esc(m.text)}</p>
      ${mine && m.masked ? '<p class="cm-msg__n">Some words or personal info were hidden.</p>' : ''}
      ${fan && !rep ? `<p class="cm-msg__a"><button type="button" data-act="report" data-kind="message" data-id="${esc(m.id)}" data-fan="${esc(fan.id)}">Report</button><button type="button" data-act="block" data-id="${esc(fan.id)}">Block</button></p>` : ''}</div></li>`;
  };
  const typingText = (id) => { const who = [...(typing.get(id) || [])].filter((f) => !store.isBlocked(f)).map((f) => store.getFan(f)?.name).filter(Boolean); return who.length ? `${who.join(' and ')} ${who.length > 1 ? 'are' : 'is'} typing…` : ''; };
  const chatHTML = (id, { canPost = true, placeholder = 'Write a message', join = '' } = {}) => {
    const msgs = store.thread(id).filter((m) => !store.isBlocked(m.from));
    return `<ol class="cm-msgs" aria-live="polite">${msgs.map(msgHTML).join('') || '<li class="cm__empty">No messages yet. Say hello.</li>'}</ol>
      <p class="cm-typing">${esc(typingText(id))}</p>
      ${canPost ? `<div class="cm-quick" role="group" aria-label="Quick replies">${QUICK.map((q) => `<button type="button" data-act="quick" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <form class="cm-comp" data-form="chat" data-thread="${esc(id)}"><input type="text" name="t" maxlength="400" autocomplete="off" enterkeyhint="send" placeholder="${esc(placeholder)}" aria-label="Message"/><button type="submit" aria-label="Send">${svg('send')}<span>Send</span></button></form>`
        : `<div class="cm-joinbar"><p>${esc(join)}</p><button type="button" class="cm-btn" data-act="join" data-id="${esc(sel.groups)}">Join group</button></div>`}`;
  };
  const scrollChat = () => { const ol = detEl.querySelector('.cm-msgs'); if (ol) ol.scrollTop = ol.scrollHeight; };

  const renderDetail = () => {
    detEl.className = `cm__detail is-${tab}`;
    if (tab === 'profile') return renderForm();
    if (tab === 'fans') {
      const f = sel.fans && store.listFans({}).find((x) => x.id === sel.fans);
      if (!f) { detEl.innerHTML = '<p class="cm__empty">Pick a fan from the list.</p>'; return; }
      const p = store.getProfile(), fol = store.isFollowing(f.id), rep = store.isReported(f.id);
      detEl.innerHTML = `<p class="cm__dh">${svg('user')}Fan profile</p><div class="cm__scroll cm-fan">
        <div class="cm-fan__top">${avatar(f.name, f.color, 'is-xl')}<div><h3>${esc(f.name)}</h3><p>${esc(f.bio)}</p>
          <p class="cm-fan__c">${p ? (f.shared.length ? `You share ${f.shared.length} interest${f.shared.length > 1 ? 's' : ''}` : 'No shared interests yet') : 'Fill in your profile to see what you share'}${p?.city === f.city ? ' · same city' : ''}${p?.player === f.player ? ' · same favourite player' : ''}</p></div></div>
        <dl class="cm-meta"><div><dt>City</dt><dd>${esc(f.city)}</dd></div><div><dt>Supporter since</dt><dd>${f.since}</dd></div><div><dt>Level</dt><dd>${f.level}</dd></div><div><dt>Favourite player</dt><dd>${esc(playerLabel(f.player))}</dd></div></dl>
        <p class="cm-k">Interests</p><div class="cm-tags is-l">${f.interests.map((x) => tag(x, f.shared.includes(x))).join('')}</div>
</div>
        <div class="cm__foot"><button type="button" class="cm-link" data-act="report" data-kind="fan" data-id="${esc(f.id)}" ${rep ? 'disabled' : ''}>${rep ? 'Reported' : 'Report'}</button><button type="button" class="cm-link" data-act="block" data-id="${esc(f.id)}">Block</button>
          <span class="cm__sp"></span><button type="button" class="cm-btn is-ghost ${fol ? 'is-on' : ''}" data-act="follow" data-id="${esc(f.id)}" aria-pressed="${fol}">${fol ? 'Following' : 'Follow'}</button><button type="button" class="cm-btn" data-act="message" data-id="${esc(f.id)}">Message</button></div>`;
      return;
    }
    if (tab === 'groups') {
      const g = store.getGroup(sel.groups); if (!g) { detEl.innerHTML = ''; return; }
      const id = `g:${g.id}`; unread.delete(id);
      detEl.innerHTML = `<div class="cm-ch"><span class="cm-gm" aria-hidden="true">${esc(initials(g.name))}</span><div class="cm-ch__t"><b>${esc(g.name)}</b><em>${g.members.toLocaleString('en')} members · ${esc(g.topic)}${g.city ? ` · ${esc(g.city)}` : ''}</em><span class="cm-ch__a">${esc(g.about)}</span></div>
          ${g.joined ? `<button type="button" class="cm-btn is-ghost" data-act="leave" data-id="${esc(g.id)}">Leave</button>` : `<button type="button" class="cm-btn" data-act="join" data-id="${esc(g.id)}">Join</button>`}</div>
        ${chatHTML(id, { canPost: g.joined, placeholder: `Message ${g.name}`, join: 'Join the group to chat with its members.' })}`;
      scrollChat(); return;
    }
    if (tab === 'rooms') {
      const r = store.getRoom(sel.rooms); if (!r) { detEl.innerHTML = '<p class="cm__empty">Match rooms open for the next fixtures.</p>'; return; }
      const id = `r:${r.id}`; unread.delete(id);
      detEl.innerHTML = `<div class="cm-ch"><span class="cm-crests is-l" aria-hidden="true"><img src="/teams/al-ittihad.png" alt=""/>${r.crest ? `<img src="${esc(r.crest)}" alt=""/>` : `<i>${esc(initials(r.opp))}</i>`}</span>
          <div class="cm-ch__t"><b>${esc(r.name)} · ${esc(r.date)}</b><em>${esc(r.comp)} · match room</em></div></div>
        ${chatHTML(id, { placeholder: `Talk about ${r.opp}` })}`;
      scrollChat(); return;
    }
    const f = sel.dms && store.getFan(sel.dms);
    if (!f) { detEl.innerHTML = `<div class="cm-blank">${svg('chat')}<p>Your chats with other fans show up here.</p><button type="button" class="cm-btn" data-act="tab" data-k="fans">Find fans</button></div>`; return; }
    const id = `dm:${f.id}`; unread.delete(id);
    detEl.innerHTML = `<div class="cm-ch">${avatar(f.name, f.color)}<div class="cm-ch__t"><b>${esc(f.name)}</b><em>${esc(f.city)} · Lv ${f.level} · ${esc(f.interests.slice(0, 2).join(', '))}</em></div>
        <button type="button" class="cm-link" data-act="report" data-kind="fan" data-id="${esc(f.id)}">Report</button><button type="button" class="cm-link" data-act="block" data-id="${esc(f.id)}">Block</button></div>
      ${chatHTML(id, { placeholder: `Message ${f.name}` })}`;
    scrollChat();
  };

  // ── the profile form ──
  const renderForm = () => {
    const p = store.getProfile();
    draft = draft || { name: p?.name || progress.name || '', city: p?.city || '', player: p?.player || '', legend: p?.legend || '', since: p?.since || '', interests: [...(p?.interests || [])], color: p?.color || AV_COLORS[0] };
    const d = draft, done = store.isComplete(d), years = Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i);
    detEl.innerHTML = `<p class="cm__dh">${svg('user')}${p ? 'Edit your fan profile' : 'Create your fan profile'}${p ? '' : '<span class="cm-xp">+30 XP</span>'}</p>
      <form class="cm__scroll cm-form" data-form="profile" novalidate>
        <div class="cm-form__av">${avatar(d.name, d.color, 'is-xl js-av')}<div><p class="cm-k">Avatar colour</p><div class="cm-sw" role="radiogroup" aria-label="Avatar colour">${AV_COLORS.map((c) => `<button type="button" role="radio" aria-checked="${d.color === c}" aria-label="Colour ${c}" class="${d.color === c ? 'is-on' : ''}" data-act="color" data-v="${c}" style="--av:${c}"></button>`).join('')}</div>
          <p class="cm-lv">Level ${progress.level} · ${progress.cards.length}/${LEGENDS.length} legend gems</p></div></div>
        <div class="cm-grid">
          <label><span>Display name</span><input name="name" maxlength="24" autocomplete="nickname" value="${esc(d.name)}" placeholder="How other fans see you" required/></label>
          <label><span>City</span><select name="city"><option value="">Choose a city</option>${CITIES.map((c) => `<option ${d.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label><span>Favourite player</span><select name="player"><option value="">Choose a player</option>${SQUAD.map((s) => `<option value="${esc(s.name)}" ${d.player === s.name ? 'selected' : ''}>${esc(playerLabel(s.name))}</option>`).join('')}</select></label>
          <label><span>Favourite legend</span><select name="legend"><option value="">Choose a legend</option>${LEGENDS.map((l) => `<option ${d.legend === l.name ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
          <label><span>Supporter since</span><select name="since"><option value="">Year</option>${years.map((y) => `<option ${+d.since === y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        </div>
        <p class="cm-k">Interests <small>pick a few</small></p><div class="cm-chips is-wrap">${INTERESTS.map((x) => chip(x, d.interests.includes(x), 'int')).join('')}</div>
        <p class="cm-note">Don't use your full name or anything private. Other fans see your display name, city, interests and level.</p>
      </form>
      <div class="cm__foot"><p class="cm-hint">${done ? 'Looks complete.' : 'Add a name, city, player, year and an interest to complete it.'}</p><span class="cm__sp"></span><button type="button" class="cm-btn" data-act="save">${p ? 'Save' : 'Create profile'}</button></div>`;
  };
  const readForm = () => {
    const f = detEl.querySelector('form[data-form="profile"]'); if (!f || !draft) return;
    for (const k of ['name', 'city', 'player', 'legend', 'since']) draft[k] = f.elements[k].value;
    draft.since = draft.since ? +draft.since : '';
  };
  const saveProfile = () => {
    readForm();
    if (!draft.name.trim()) { toast('Add a display name first.'); detEl.querySelector('input[name="name"]')?.focus(); return; }
    const p = store.saveProfile(draft); draft = null;
    if (store.isComplete(p) && store.awardedOnce('profile')) { progress.award(30, 'Fan profile'); feel.win(); toast('Profile complete · +30 XP'); } else { feel.tap(); toast('Profile saved'); }
    render();
  };

  // ── modals: guidelines, report, block ──
  const renderModal = () => {
    if (!modal) { modalEl.hidden = true; modalEl.innerHTML = ''; return; }
    modalEl.hidden = false;
    if (modal === 'rules') {
      modalEl.innerHTML = `<div class="cm-box" role="dialog" aria-label="Community guidelines"><p class="cm-k">${svg('shield')}Community guidelines</p><h3>Keep it Ittihad</h3>
        <ol>${GUIDELINES.map(([h, t]) => `<li><b>${esc(h)}</b><span>${esc(t)}</span></li>`).join('')}</ol>
        <div class="cm-box__f"><button type="button" class="cm-btn" data-act="modal-ok">${store.seenRules ? 'Close' : 'I agree'}</button></div></div>`;
    } else if (modal.kind === 'report') {
      modalEl.innerHTML = `<div class="cm-box" role="dialog" aria-label="Report"><p class="cm-k">Report</p><h3>${modal.type === 'message' ? 'Report this message' : `Report ${esc(store.getFan(modal.id)?.name)}`}</h3>
        <div class="cm-why">${REPORT_WHY.map((w) => `<button type="button" data-act="report-why" data-v="${esc(w)}">${esc(w)}</button>`).join('')}</div>
        <p class="cm-note">Reports go to the club's moderators.</p>
        <div class="cm-box__f"><button type="button" class="cm-btn is-ghost" data-act="modal-x">Cancel</button></div></div>`;
    } else if (modal.kind === 'block') {
      const f = store.getFan(modal.id);
      modalEl.innerHTML = `<div class="cm-box" role="dialog" aria-label="Block"><p class="cm-k">Block</p><h3>Block ${esc(f?.name)}?</h3>
        <p class="cm-note">You won't see their profile or messages, and they can't message you. You can unblock them from My profile.</p>
        <div class="cm-box__f"><button type="button" class="cm-btn is-ghost" data-act="modal-x">Cancel</button><button type="button" class="cm-btn is-bad" data-act="block-ok">Block</button></div></div>`;
    }
    modalEl.querySelector('button')?.focus({ preventScroll: true });
  };
  const closeModal = () => { if (modal === 'rules') store.seenRules = true; modal = null; renderModal(); };

  const render = () => { renderRail(); renderList(); renderDetail(); };

  // ── live messages (simulated replies now, a realtime channel later) ──
  const off = store.onMessage((e) => {
    const cur = threadOf();
    if (e.type === 'typing') {
      const s = typing.get(e.thread) || new Set(); e.on ? s.add(e.from) : s.delete(e.from); typing.set(e.thread, s);
      if (e.thread === cur) { const t = detEl.querySelector('.cm-typing'); if (t) t.textContent = typingText(cur); }
      return;
    }
    if (e.msg.from !== 'me' && store.isBlocked(e.msg.from)) return;
    if (e.thread === cur) {
      const ol = detEl.querySelector('.cm-msgs');
      if (ol) { ol.querySelector('.cm__empty')?.remove(); ol.insertAdjacentHTML('beforeend', msgHTML(e.msg)); scrollChat(); }
      if (e.msg.from !== 'me') feel.tap();
    } else if (e.msg.from !== 'me') unread.add(e.thread);
    renderRail();
    if ((tab === 'dms' && e.thread.startsWith('dm:')) || (tab === 'groups' && e.thread.startsWith('g:')) || (tab === 'rooms' && e.thread.startsWith('r:'))) {
      const sc = listEl.querySelector('.cm__items')?.scrollTop; renderList(); const u = listEl.querySelector('.cm__items'); if (u && sc) u.scrollTop = sc;
    }
  });
  const send = (thread, text) => {
    const m = store.send(thread, text); if (!m) return;
    feel.tap();
    if (store.awardedOnce('message')) { progress.award(10, 'First message'); toast('First message · +10 XP'); }
  };

  // ── events ──
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act, id = b.dataset.id;
    if (a === 'close') return close();
    if (a === 'home') { close({ silent: !!onHome }); return onHome?.(); }
    // the leaderboard opens over the community (which steps aside) and back returns here; a game started there leaves both
    if (a === 'friends') { el.classList.add('is-under'); return onFriends?.({ back: () => el.classList.remove('is-under'), leave: () => close({ silent: true }) }); }
    if (a === 'cart') { feel.tap(); return onCart?.(); }                    // the cart opens above it
    feel.tap();
    if (a === 'tab') { if (tab === 'profile') readForm(); tab = b.dataset.k; return render(); }
    if (a === 'sel') { if (tab === 'profile') return; sel[tab] = id; renderList(); renderDetail(); renderRail(); return; }
    if (a === 'filt-int') { const v = b.dataset.v; filt.interests = filt.interests.includes(v) ? filt.interests.filter((x) => x !== v) : [...filt.interests, v]; renderList(); renderDetail(); return; }
    if (a === 'int') { readForm(); const v = b.dataset.v; draft.interests = draft.interests.includes(v) ? draft.interests.filter((x) => x !== v) : [...draft.interests, v]; b.classList.toggle('is-on'); updateHint(); return; }
    if (a === 'color') { readForm(); draft.color = b.dataset.v; detEl.querySelectorAll('.cm-sw button').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-checked', x === b); }); updateAv(); return; }
    if (a === 'save') return saveProfile();
    if (a === 'follow') { const on = store.follow(id); toast(on ? `Following ${store.getFan(id)?.name}` : 'Unfollowed'); renderList(); renderDetail(); return; }
    if (a === 'message') { sel.dms = store.openDM(id).slice(3); tab = 'dms'; render(); detEl.querySelector('.cm-comp input')?.focus({ preventScroll: true }); return; }
    if (a === 'join' || a === 'leave') {
      const g = store.getGroup(id); store.joinGroup(id, a === 'join');
      if (a === 'join' && store.awardedOnce('group')) { progress.award(20, 'First fan group'); feel.win(); toast(`Joined ${g.name} · +20 XP`); } else toast(a === 'join' ? `Joined ${g.name}` : `Left ${g.name}`);
      renderList(); renderDetail(); return;
    }
    if (a === 'quick') { const t = threadOf(); if (t) send(t, b.dataset.v); return; }
    if (a === 'rules') { modal = 'rules'; return renderModal(); }
    if (a === 'report') { modal = { kind: 'report', type: b.dataset.kind, id, fan: b.dataset.fan }; return renderModal(); }
    if (a === 'report-why') { store.report(modal.type, modal.id, b.dataset.v); modal = null; renderModal(); toast('Thanks for reporting. It\'s hidden for you.'); render(); return; }
    if (a === 'block') { modal = { kind: 'block', id }; return renderModal(); }
    if (a === 'block-ok') {
      const f = store.getFan(modal.id); store.block(modal.id, true); modal = null; renderModal();
      if (sel.dms === f?.id) sel.dms = null; if (sel.fans === f?.id) sel.fans = null;
      toast(`${f?.name} is blocked`); render(); return;
    }
    if (a === 'unblock') { store.block(id, false); toast(`${store.getFan(id)?.name} is unblocked`); renderList(); return; }
    if (a === 'modal-ok' || a === 'modal-x') return closeModal();
  });
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
  el.addEventListener('change', (e) => {
    const s = e.target.closest('select[data-f]');
    if (s) { filt[s.dataset.f] = s.value; renderList(); renderDetail(); return; }
    if (e.target.closest('form[data-form="profile"]')) { readForm(); updateHint(); }
  });
  el.addEventListener('input', (e) => { if (e.target.name === 'name' && e.target.closest('form[data-form="profile"]')) { readForm(); updateAv(); updateHint(); } });
  const updateAv = () => { const av = detEl.querySelector('.js-av'); if (av && draft) av.outerHTML = avatar(draft.name, draft.color, 'is-xl js-av'); };
  const updateHint = () => { const h = detEl.querySelector('.cm-hint'); if (h && draft) h.textContent = store.isComplete(draft) ? 'Looks complete.' : 'Add a name, city, player, year and an interest to complete it.'; };
  el.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.dataset.form === 'chat') { const i = f.elements.t; if (i.value.trim()) { send(f.dataset.thread, i.value); i.value = ''; } return; }
    if (f.dataset.form === 'profile') saveProfile();
  });

  // keep pointer, wheel and keys away from the 3D scene underneath
  for (const ev of ['wheel', 'pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup', 'click', 'keydown', 'keyup', 'keypress', 'contextmenu']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  const onKey = (e) => {
    if (e.type === 'keydown' && e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (modal) closeModal(); else if (document.activeElement && el.contains(document.activeElement) && document.activeElement.matches('input,select')) document.activeElement.blur(); else close(); return; }
    if (!el.contains(e.target)) e.stopPropagation();   // keys aimed elsewhere (the page) stop here; keys in our inputs reach them and stop at the root
  };
  window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true);

  // phones: the on-screen keyboard shrinks the visual viewport; fit to it and give the chat the whole screen while typing
  const vv = window.visualViewport;
  const fit = () => { if (!vv) return; el.style.top = `${vv.offsetTop}px`; el.style.height = `${vv.height}px`; el.style.bottom = 'auto'; };
  vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit); fit();
  const small = matchMedia('(max-height: 520px)');
  const onFocus = (e) => { if (small.matches && e.target.matches?.('.cm-comp input')) el.classList.add('is-typing'); };
  const onBlur = (e) => { if (e.target.matches?.('.cm-comp input')) setTimeout(() => { if (!el.contains(document.activeElement) || !document.activeElement.matches('.cm-comp input')) { el.classList.remove('is-typing'); scrollChat(); } }, 120); };
  el.addEventListener('focusin', onFocus); el.addEventListener('focusout', onBlur);

  let closed = false;
  cleanup = () => { off(); window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); clearTimeout(toastT); };
  function close({ silent = false } = {}) {
    if (closed) return; closed = true;
    feel.back(); cleanup(); cleanup = null; el.classList.remove('is-on');
    setTimeout(() => { el.remove(); if (root === el) root = null; }, 250);
    if (!silent) onClose?.();
  }

  render();
  if (!store.seenRules) { modal = 'rules'; renderModal(); }
  requestAnimationFrame(() => el.classList.add('is-on'));
  return { close: () => close() };
}
