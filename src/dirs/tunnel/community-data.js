// Supporters community — the DATA LAYER (Ahmed, 2026-10-21: "a community where users can find other Ittihad
// supporters and share interests and chat"; he chose a demo first). There is no backend on GitHub Pages, so
// everything here is a clearly labelled DEMO: ~40 generated sample fans, demo fan groups, one room per upcoming
// fixture, and simulated replies drawn from a generic, positive template bank (no scores, no news, no facts).
//
// The UI (community.js) only ever talks to `store` below. To go live, keep the method names and swap the bodies:
//   getProfile / saveProfile  → a `profiles` table row keyed by auth.uid()            (Supabase: from('profiles'))
//   listFans / getFan         → a query on `profiles` (+ a view for "in common")        (from('profiles').select())
//   listGroups / joinGroup    → `groups` + `group_members`                               (from('group_members').upsert())
//   follow / block / report   → `follows`, `blocks`, `reports` (reports go to a moderation queue)
//   thread(id) / send(id,msg) → a `messages` table keyed by thread id                    (from('messages').insert())
//   onMessage(fn)             → a Realtime channel on `messages` (supabase.channel(...).on('postgres_changes', …))
// …and delete the SIMULATION block (sample fans, seeded threads, simulated replies) at the bottom.
import { SQUAD } from './squad.js';
import { FIXTURES } from './fixtures.js';

const KEY = 'itt-community-v1';                       // profile, follows, groups, blocks, reports, DM list, XP flags
const TKEY = (id) => `itt-community-v1:t:${id}`;       // one key per chat thread
const MAX_MSGS = 200;

export const DEMO_NOTE = 'Demo community · sample fans, simulated replies';
export const INTERESTS = ['Matchday', 'Away days', 'Tifo & chants', 'Fantasy', 'Gaming', 'Retro shirts', 'Youth & academy', "Women's football", 'Stats & tactics', 'Photography'];
export const CITIES = ['Jeddah', 'Makkah', 'Madinah', 'Riyadh', 'Dammam', 'Khobar', 'Taif', 'Yanbu', 'Rabigh', 'Tabuk', 'Abha', 'Jazan', 'Hail', 'Buraidah', 'Najran', 'Al Ahsa', 'Outside Saudi Arabia'];
export const PLAYERS = SQUAD.map((p) => p.name);
export const GUIDELINES = [
  ['Be respectful', 'Rivalry is part of football. Insults, threats and harassment are not.'],
  ['No hate', 'Nothing that attacks anyone for their origin, religion, gender or anything else.'],
  ['Keep personal info private', "Don't share phone numbers, emails, addresses or ticket barcodes. We hide numbers and emails automatically."],
  ['Report, block, move on', 'Use Report on anything that breaks these rules, and Block to stop seeing someone.'],
];

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode / full */ } };

// ── safety: a simple word filter + personal-info masking (a real backend would also run this server-side) ──
const BAD = ['fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt', 'wanker', 'twat', 'slut', 'whore', 'prick', 'motherf', 'sharmoot', 'manyak', 'khara'];
const BAD_RE = new RegExp(`\\b(${BAD.join('|')})[a-z]*`, 'gi');
export function clean(text) {
  let t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
  t = t.replace(BAD_RE, (w) => w[0] + '*'.repeat(w.length - 1));
  t = t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email hidden]');
  t = t.replace(/\+?\d[\d\s-]{7,}\d/g, (s) => (s.replace(/\D/g, '').length >= 9 ? '[number hidden]' : s));
  return t;
}

// ── the state that lives with the signed-in user ──
const st = { profile: null, following: [], joined: [], blocked: [], reported: [], dms: [], awarded: {}, seenRules: false, ...load(KEY, {}) };
const persist = () => save(KEY, st);
const fns = new Set();
const emit = (e) => fns.forEach((f) => { try { f(e); } catch (err) { console.warn(err); } });

// ═══════════════ SIMULATION (demo only — delete when a backend is plugged in) ═══════════════
// a seeded random, so every visitor sees the same sample fans
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const R = rng(1927);   // the club's founding year
const pick = (a, r = R) => a[Math.floor(r() * a.length)];
const pickN = (a, n, r = R) => { const b = [...a], out = []; while (out.length < n && b.length) out.push(b.splice(Math.floor(r() * b.length), 1)[0]); return out; };
const FIRST = ['Abdullah', 'Faisal', 'Omar', 'Khalid', 'Saud', 'Nawaf', 'Turki', 'Yousef', 'Hamza', 'Majed', 'Rayan', 'Ziyad', 'Bandar', 'Fahad', 'Sultan', 'Hussam', 'Ammar', 'Mazen', 'Anas', 'Talal', 'Waleed', 'Bader',
  'Noura', 'Sara', 'Lama', 'Reem', 'Hessa', 'Dana', 'Jana', 'Rawan', 'Shahad', 'Joud', 'Layan', 'Ghadi', 'Maha', 'Haya', 'Areej', 'Wejdan', 'Mashael', 'Razan'];
const INIT = 'ABDFGHJKMNQRSTZ';
const CITY_W = ['Jeddah', 'Jeddah', 'Jeddah', 'Jeddah', 'Jeddah', 'Jeddah', 'Makkah', 'Makkah', 'Madinah', 'Madinah', 'Riyadh', 'Riyadh', 'Dammam', 'Taif', 'Yanbu', 'Rabigh', 'Tabuk', 'Abha', 'Khobar'];
const BIOS = ['Never misses a home game.', 'North stand regular.', 'Here for the chants.', 'Collects matchday programmes.', 'Fantasy manager, proud of it.', 'Takes the whole family to games.', 'Into tactics boards and long chats.', 'Travels for away games when I can.', 'Learning every chant this season.', 'Yellow and black since day one.', 'Plays the club on every football game.', 'Shoots the stands, not the pitch.'];
export const AV_COLORS = ['#ffea00', '#f5f5f5', '#f0b84a', '#2fe39a', '#6f8dff', '#ff8a5c', '#c9a7ff', '#7fd4ff'];

export const FANS = FIRST.map((first, i) => {
  const name = `${first} ${INIT[Math.floor(R() * INIT.length)]}.`;
  return {
    id: `fan-${i + 1}`, name, demo: true,
    city: pick(CITY_W), player: pick(PLAYERS), interests: pickN(INTERESTS, 2 + Math.floor(R() * 4)),
    since: 1980 + Math.floor(R() * 45), level: 1 + Math.floor(R() * 24), bio: pick(BIOS), color: pick(AV_COLORS),
  };
});
const fanById = Object.fromEntries(FANS.map((f) => [f.id, f]));

export const GROUPS = [
  { id: 'jeddah-matchday', name: 'Jeddah Matchday Crew', topic: 'Matchday', city: 'Jeddah', members: 1240, about: 'Meet-ups, gate times and getting to the stadium together on home matchdays.' },
  { id: 'away-days', name: 'Away Days', topic: 'Away days', members: 486, about: 'Sharing trips, travel plans and the best away-end moments.' },
  { id: 'tifo-makers', name: 'Tifo Makers', topic: 'Tifo & chants', members: 312, about: 'Designs, chants and planning the next display in the stands.' },
  { id: 'spl-fantasy', name: 'SPL Fantasy League', topic: 'Fantasy', members: 958, about: 'Team reveals, captain picks and a friendly mini-league.' },
  { id: 'retro-shirts', name: 'Retro Shirt Collectors', topic: 'Retro shirts', members: 207, about: 'Old kits, swaps and the stories behind them.' },
  { id: 'tigers-gaming', name: 'Tigers Gaming', topic: 'Gaming', members: 640, about: 'Playing as the club on football games, squads and online matches.' },
  { id: 'tactics-board', name: 'Tactics Board', topic: 'Stats & tactics', members: 275, about: 'Formations, pressing and calm chats about the game.' },
  { id: 'academy-watch', name: 'Academy Watch', topic: 'Youth & academy', members: 154, about: 'Following the youth teams and the next generation.' },
  { id: 'womens-football', name: "Women's Football Fans", topic: "Women's football", members: 188, about: "Supporting the women's game and going to matches together." },
  { id: 'stands-photo', name: 'Stands Photography', topic: 'Photography', members: 121, about: 'Photos from the stands: share your shots and tips.' },
  { id: 'riyadh-tigers', name: 'Riyadh Tigers', topic: 'Matchday', city: 'Riyadh', members: 403, about: 'Ittihad fans in the capital: watch parties and trips to Jeddah.' },
  { id: 'makkah-madinah', name: 'Makkah & Madinah Fans', topic: 'Matchday', city: 'Makkah', members: 330, about: 'Car shares and meet-ups for fans coming in from Makkah and Madinah.' },
];
const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

// match rooms: the first three upcoming fixtures with an opponent
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' });
export const ROOMS = FIXTURES.filter((m) => m.opp && (!m.kickoff || m.kickoff * 1000 + 2 * 3600e3 > Date.now())).slice(0, 3).map((m) => ({
  id: `room-${m.slug || m.oppCode || m.kickoff}`, opp: m.opp, crest: m.crest || null, comp: m.compLabel || '',
  date: m.kickoff ? DAY.format(new Date(m.kickoff * 1000)).replace(',', '') : 'Date TBC',
  name: `Al Ittihad vs ${m.opp}`,
}));
const roomById = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

// the reply bank: short, generic and positive — never a score, a result, a signing or any other claim
const LINES = {
  Matchday: ['Yalla! See you in the stands.', 'Who is going early? I like to be in before the warm-up.', 'Wearing the yellow this time for sure.', 'Matchday feeling already.', 'Meet by the gate before kick-off?', 'Bringing my little brother for his first game.'],
  'Away days': ['Anyone sharing a car for the next away trip?', 'The away end is always loud. Love it.', 'Packing the flag already.', 'Away days are the best days.'],
  'Tifo & chants': ['We should practise the new chant before the game.', 'I can help paint the banner this week.', 'The stands look amazing when everyone holds the cards up.', 'Louder from the first minute!'],
  Fantasy: ['Still deciding on my captain this week.', 'Thinking of saving my transfer for later.', 'My mini-league is so close this season.', 'Going with an Ittihad-heavy team, of course.'],
  Gaming: ['Anyone up for an online match tonight?', 'Built my squad around the midfield.', 'I always play as the club in career mode.'],
  'Retro shirts': ['Found an old home shirt at my uncle\'s house.', 'The classic stripes never get old.', 'Anyone want to swap? I have a spare.'],
  'Youth & academy': ['Love seeing the young players get chances.', 'Going to watch the youth game this weekend.', 'The academy is the future of the club.'],
  "Women's football": ["Who's coming to the next women's match?", 'The atmosphere at the women\'s games keeps growing.', 'Let\'s get more people out to support.'],
  'Stats & tactics': ['Interesting idea. The midfield shape matters a lot.', 'I like it when we press high.', 'Would love to see more crosses from the wings.'],
  Photography: ['The floodlights make the best photos.', 'Share your shots from the stands after the game!', 'Golden hour before kick-off is perfect.'],
  general: ['COYT!', 'Yalla Ittihad!', 'Agreed, well said.', 'Nice one!', 'Up the Tigers!', 'This is why I love this club.', 'Ha, same here.', 'Totally with you.'],
  dm: ['Hey! Good to meet another fan.', 'Thanks for the message! Are you going to the next home game?', 'Nice, we have a lot in common.', 'Always happy to talk Ittihad.', 'Hi! Which stand do you usually sit in?'],
  room: (opp) => [`Can't wait for this one against ${opp}.`, 'Who is going? Let\'s fill the stands.', 'Wearing yellow and black, see you there.', `Full support against ${opp}, yalla!`, 'Getting my tickets sorted this week.', 'This is going to be a loud night.'],
};
const KEYWORDS = [['Fantasy', /fantasy|captain|transfer|points|mini-?league/i], ['Tifo & chants', /tifo|chant|banner|flag|sing/i], ['Away days', /away|trip|travel|car ?share|bus/i],
  ['Retro shirts', /shirt|kit|jersey|retro/i], ['Gaming', /game ?play|fifa|fc ?2|console|online|career/i], ['Photography', /photo|camera|picture|shot/i], ['Stats & tactics', /tactic|formation|press|stats|midfield|defen/i],
  ['Youth & academy', /academy|youth|u-?\d\d|young/i], ["Women's football", /women|ladies/i], ['Matchday', /ticket|gate|stand|kick-?off|matchday|stadium|seat/i]];
const topicOf = (text) => KEYWORDS.find(([, re]) => re.test(text))?.[0];

const ago = (min) => Date.now() - min * 60e3;
const msg = (from, text, at) => ({ id: `m${at.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, from, text, at });

// who might answer in a thread
function cast(id) {
  if (id.startsWith('dm:')) return [fanById[id.slice(3)]].filter(Boolean);
  if (id.startsWith('g:')) {
    const g = groupById[id.slice(2)];
    const fit = FANS.filter((f) => (g?.topic && f.interests.includes(g.topic)) || (g?.city && f.city === g.city));
    return fit.length >= 3 ? fit : FANS.slice(0, 8);
  }
  return FANS;   // match rooms: everyone
}
function lineFor(id, userText, r = Math.random) {
  const room = roomById[id.slice(2)];
  const t = userText && topicOf(userText);
  if (t && r() < 0.75) return pick(LINES[t], r);
  if (id.startsWith('dm:')) { const f = fanById[id.slice(3)]; return r() < 0.5 ? pick(LINES.dm, r) : pick(LINES[pick(f?.interests || ['general'], r)] || LINES.general, r); }
  if (room) return r() < 0.6 ? pick(LINES.room(room.opp), r) : pick(LINES.general, r);
  const g = groupById[id.slice(2)];
  return g && r() < 0.65 ? pick(LINES[g.topic], r) : pick(LINES.general, r);
}
// a few sample messages so no thread starts empty (seeded per thread, stored on first open)
function seed(id) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  const r = rng(h), who = cast(id).filter((f) => !id.startsWith('dm:') || f), n = id.startsWith('dm:') ? 0 : 3 + Math.floor(r() * 3);
  const out = []; let min = 60 * (2 + Math.floor(r() * 20));
  for (let i = 0; i < n; i++) { min -= 8 + Math.floor(r() * 50); out.push(msg(pick(who, r).id, lineFor(id, '', r), ago(Math.max(1, min)))); }
  return out;
}
const timers = new Set();
function simulateReplies(id, userText) {
  const pool = cast(id).filter((f) => !st.blocked.includes(f.id));
  if (!pool.length) return;
  const n = id.startsWith('dm:') ? 1 : 1 + (Math.random() < 0.5 ? 1 : 0);
  let delay = 0;
  pickN(pool, n, Math.random).forEach((f) => {
    const start = delay + 400 + Math.random() * 800, wait = 1000 + Math.random() * 3000;
    delay = start + wait;
    const t1 = setTimeout(() => { timers.delete(t1); emit({ type: 'typing', thread: id, from: f.id, on: true }); }, start);
    const t2 = setTimeout(() => {
      timers.delete(t2);
      emit({ type: 'typing', thread: id, from: f.id, on: false });
      const m = msg(f.id, lineFor(id, userText), Date.now());
      const list = store.thread(id); list.push(m); save(TKEY(id), list.slice(-MAX_MSGS));
      emit({ type: 'message', thread: id, msg: m });
    }, start + wait);
    timers.add(t1); timers.add(t2);
  });
}
// ═══════════════ end of SIMULATION ═══════════════

const shared = (f, p) => (p?.interests || []).filter((x) => f.interests.includes(x));
const common = (f, p) => shared(f, p).length * 2 + (p?.city && f.city === p.city ? 2 : 0) + (p?.player && f.player === p.player ? 1 : 0);

export const store = {
  demo: true,
  // profile
  getProfile: () => st.profile,
  saveProfile(p) { st.profile = { ...p, name: clean(p.name).slice(0, 24), updated: Date.now() }; persist(); return st.profile; },
  isComplete: (p = st.profile) => !!(p && p.name && p.city && p.player && p.interests?.length && p.since),
  // fans
  getFan: (id) => fanById[id] || null,
  shared,
  listFans({ city = '', player = '', interests = [], sort = 'common' } = {}) {
    const p = st.profile;
    let a = FANS.filter((f) => !st.blocked.includes(f.id) && (!city || f.city === city) && (!player || f.player === player) && interests.every((x) => f.interests.includes(x)));
    a = a.map((f) => ({ ...f, common: common(f, p), shared: shared(f, p) }));
    if (sort === 'common') a.sort((x, y) => y.common - x.common || y.level - x.level);
    else if (sort === 'level') a.sort((x, y) => y.level - x.level);
    else if (sort === 'since') a.sort((x, y) => x.since - y.since);
    return a;
  },
  isFollowing: (id) => st.following.includes(id),
  follow(id, on = !st.following.includes(id)) { st.following = st.following.filter((x) => x !== id); if (on) st.following.push(id); persist(); return on; },
  get following() { return [...st.following]; },
  // safety
  isBlocked: (id) => st.blocked.includes(id),
  block(id, on = true) { st.blocked = st.blocked.filter((x) => x !== id); if (on) { st.blocked.push(id); st.following = st.following.filter((x) => x !== id); } persist(); },
  get blocked() { return [...st.blocked]; },
  report(kind, id, reason = '') { if (!st.reported.some((r) => r.id === id)) { st.reported.push({ kind, id, reason, at: Date.now() }); persist(); } },   // → a moderation queue
  isReported: (id) => st.reported.some((r) => r.id === id),
  get seenRules() { return st.seenRules; },
  set seenRules(v) { st.seenRules = !!v; persist(); },
  // groups
  listGroups: () => GROUPS.map((g) => ({ ...g, joined: st.joined.includes(g.id), members: g.members + (st.joined.includes(g.id) ? 1 : 0) })),
  getGroup: (id) => { const g = groupById[id]; return g && { ...g, joined: st.joined.includes(id), members: g.members + (st.joined.includes(id) ? 1 : 0) }; },
  joinGroup(id, on = true) { st.joined = st.joined.filter((x) => x !== id); if (on) st.joined.push(id); persist(); return on; },
  isJoined: (id) => st.joined.includes(id),
  get joined() { return [...st.joined]; },
  // match rooms
  listRooms: () => ROOMS,
  getRoom: (id) => roomById[id] || null,
  // DMs
  listDMs: () => st.dms.map((id) => ({ fan: fanById[id], last: store.thread(`dm:${id}`).at(-1) })).filter((d) => d.fan && !st.blocked.includes(d.fan.id)).sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0)),
  openDM(fanId) { if (!st.dms.includes(fanId)) { st.dms.push(fanId); persist(); } return `dm:${fanId}`; },
  // threads: 'g:<group>', 'r:<room>', 'dm:<fan>'
  thread(id) {
    let list = load(TKEY(id), null);
    if (!list) { list = seed(id); save(TKEY(id), list); }
    return list;
  },
  send(id, text) {
    const t = clean(text); if (!t) return null;
    const m = msg('me', t, Date.now()); m.masked = t !== String(text).replace(/\s+/g, ' ').trim();
    const list = store.thread(id); list.push(m); save(TKEY(id), list.slice(-MAX_MSGS));
    emit({ type: 'message', thread: id, msg: m });
    simulateReplies(id, t);   // live: other people's messages arrive through onMessage instead
    return m;
  },
  onMessage(fn) { fns.add(fn); return () => fns.delete(fn); },
  // XP once-only flags
  awardedOnce(key) { if (st.awarded[key]) return false; st.awarded[key] = Date.now(); persist(); return true; },
  stopSimulation() { timers.forEach(clearTimeout); timers.clear(); },
};
