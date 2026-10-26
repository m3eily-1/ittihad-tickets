// Snapshot of the club's public Webook feed (api.webook.com/api/v2/filter/events/al-ittihad-club,
// visible_in=ittihad), taken 2026-10-08. Prices include 15% VAT. Kickoffs are unix seconds.
export const SITE = 'https://tickets.ittihadclub.sa';

export const MATCHES = [
  {
    slug: 'afc-elite-26-27-al-ittihad-fc-vs-shabab-al-ahli-uae-131026',
    comp: 'afc',
    compLabel: 'AFC Champions League Elite',
    round: 'League stage',
    opp: 'Shabab Al Ahli',
    oppShort: 'SHABAB AL AHLI',
    oppCode: 'SAH',
    oppFrom: 'Dubai, UAE',
    crest: '/teams/shabab-al-ahli.png',
    kickoff: 1791915300,
    venue: 'King Abdullah Sports City Stadium',
    venueKey: 'alinma',
    from: 15,
    poster: '/img/promo-afc.jpg',
  },
  {
    slug: 'rsl-26-27al-ittihad-vs-al-shabab-16102026',
    comp: 'rsl',
    compLabel: 'Saudi Pro League',
    round: 'Matchweek 9',
    opp: 'Al Shabab',
    oppShort: 'AL SHABAB',
    oppCode: 'SHB',
    oppFrom: 'Riyadh',
    crest: '/teams/al-shabab.png',
    kickoff: 1792173600,
    venue: 'Prince Abdullah Al Faisal Sports City Stadium',
    venueKey: 'faisal',
    from: 20,
    poster: '/img/promo-shabab.png',
  },
  {
    slug: 'rsl-26-27al-ittihad-vs-diriyah-23102026',
    comp: 'rsl',
    compLabel: 'Saudi Pro League',
    round: 'Matchweek 11',
    opp: 'Diriyah',
    oppShort: 'DIRIYAH',
    oppCode: 'DIR',
    oppFrom: 'Riyadh',
    crest: '/teams/diriyah.png',
    kickoff: 1792769400,
    venue: 'Alinma Stadium',
    venueKey: 'alinma',
    from: 25,
    poster: '/img/promo-diriyah.png',
  },
  // on sale on the club's ticket site (tickets.ittihadclub.sa/en/event/afc-elite-2627-ittihad-vs-al-ain-021126,
  // checked 2026-10-26): 2 Nov 2026, 21:15, King Abdullah Sports City Stadium, "starts from 15"
  {
    slug: 'afc-elite-2627-ittihad-vs-al-ain-021126',
    comp: 'afc',
    compLabel: 'AFC Champions League Elite',
    round: 'League stage · MD4',
    opp: 'Al Ain',
    oppShort: 'AL AIN',
    oppCode: 'AIN',
    oppFrom: 'Al Ain, UAE',
    crest: '/teams/al-ain.png',
    kickoff: 1793643300,
    venue: 'King Abdullah Sports City Stadium',
    venueKey: 'alinma',
    from: 15,
  },
];

// Ticket tiers per match from each event's event_tickets (price incl. VAT, the feed's own colour).
// Where each tier sits in the bowl is not in the feed (the seat chart is a third-party embed),
// so any stand layout drawn from these is indicative.
export const TIERS = {
  // the season pass's ticket types (Ahmed, 2026-10-22, from the Webook pass page): CAT 3 at SAR 230 is the "from"
  'tigers-season-tickets--season--27': [
    { name: 'GOLD', price: 10500, color: '#877f14' },
    { name: 'SILVER', price: 6500, color: '#606468' },
    { name: 'PREMIUM', price: 1250, color: '#b53fd0' },
    { name: 'CAT 1', price: 700, color: '#8e2f4c' },
    { name: 'CAT 2', price: 350, color: '#eaa630' },
    { name: 'CAT 3', price: 230, color: '#5fb25a' },
  ],
  'afc-elite-26-27-al-ittihad-fc-vs-shabab-al-ahli-uae-131026': [
    { name: 'GOLD', price: 500, color: '#877f14' },
    { name: 'SILVER', price: 250, color: '#606468' },
    { name: 'PREMIUM', price: 60, color: '#c92fd9' },
    { name: 'CAT 1', price: 30, color: '#992c4e' },
    { name: 'CAT 2', price: 20, color: '#f8a502' },
    { name: 'CAT 3', price: 15, color: '#58b44f' },
    { name: 'CAT 4', price: 15, color: '#4176a5' },
    { name: 'CAT 4 AWAY', price: 15, color: '#517fbb' },
  ],
  // Al Ain (AFC, 2 Nov): its categories sit behind the site's login, so these are the last AFC home match's at the
  // same stadium (the page's "starts from 15" matches its cheapest) — indicative until the real list is checked
  'afc-elite-2627-ittihad-vs-al-ain-021126': [
    { name: 'GOLD', price: 500, color: '#877f14' },
    { name: 'SILVER', price: 250, color: '#606468' },
    { name: 'PREMIUM', price: 60, color: '#c92fd9' },
    { name: 'CAT 1', price: 30, color: '#992c4e' },
    { name: 'CAT 2', price: 20, color: '#f8a502' },
    { name: 'CAT 3', price: 15, color: '#58b44f' },
    { name: 'CAT 4', price: 15, color: '#4176a5' },
    { name: 'CAT 4 AWAY', price: 15, color: '#517fbb' },
  ],
  'rsl-26-27al-ittihad-vs-al-shabab-16102026': [
    { name: 'VVIP', price: 1000, color: '#74253e' },
    { name: 'VIP', price: 750, color: '#74253e' },
    { name: 'GOLD', price: 500, color: '#968531' },
    { name: 'SILVER', price: 250, color: '#68646d' },
    { name: 'PREMIUM', price: 50, color: '#8a2aa2' },
    { name: 'CAT 1', price: 30, color: '#438bc7' },
    { name: 'CAT 1 AWAY', price: 30, color: '#545384' },
    { name: 'CAT 2', price: 25, color: '#3a7e35' },
    { name: 'CAT 3', price: 20, color: '#c0752a' },
  ],
  'rsl-26-27al-ittihad-vs-diriyah-23102026': [
    { name: 'GOLD', price: 600, color: '#877f14' },
    { name: 'SILVER', price: 300, color: '#606468' },
    { name: 'PREMIUM', price: 80, color: '#c92fd9' },
    { name: 'CAT 1', price: 40, color: '#992c4e' },
    { name: 'CAT 2', price: 30, color: '#f8a502' },
    { name: 'CAT 3', price: 25, color: '#58b44f' },
    { name: 'CAT 4', price: 25, color: '#4176a5' },
  ],
};

export const SEASON = {
  slug: 'tigers-season-tickets--season--27',
  title: 'Tigers Season Pass',
  season: '26/27',
  // CAT 3, SAR 230 incl. VAT — the cheapest of the pass's six ticket types (TIERS above); settled 2026-10-22
  from: 230,
  comps: ['Saudi Pro League', "King's Cup", 'AFC Champions League'],
  venues: ['Alinma Stadium', 'Prince Abdullah Al-Faisal Sports City Stadium'],
  fixtures: ['Al Kholood', 'Al Nassr', 'Al Fayha', 'Diriyah', 'Shabab Al Ahli'],
};

export const VENUES = {
  alinma: {
    name: 'Alinma Stadium',
    aka: 'King Abdullah Sports City',
    area: 'North Jeddah',
    lat: 21.762984, lng: 39.164033,
  },
  faisal: {
    name: 'Prince Abdullah Al Faisal',
    aka: 'Sports City Stadium',
    area: 'Central Jeddah',
    lat: 21.446478, lng: 39.251910,
  },
};

export const SPONSORS = [
  ['nike', 'Nike'], ['tcl', 'TCL'], ['flow', 'Flow'], ['genesis', 'Genesis'], ['hankook', 'Hankook'],
  ['imc', 'IMC'], ['milaf-cola', 'Milaf Cola'], ['al-balad-development', 'Al Balad Development'],
  ['jeddah-central-development', 'Jeddah Central Development'],
];

export const LINKS = {
  appStore: 'https://apps.apple.com/app/al-ittihad-tickets/id6477918526',
  playStore: 'https://play.google.com/store/apps/details?id=com.webook.ittihad.android',
  store: 'https://shop.ittihadclub.sa/en',
  about: 'https://ittihadclub.sa/en/about',
  resale: 'https://resell.webook.com',
  x: 'https://x.com/ittihad',
  instagram: 'https://www.instagram.com/ittihadclub.sa/',
  youtube: 'https://www.youtube.com/c/ittihadclub',
  snapchat: 'https://www.snapchat.com/add/snap.ittihad',
};

export const eventUrl = (slug) => `${SITE}/en/event/${slug}`;
export const seasonUrl = (slug) => `${SITE}/en/season/${slug}`;

// Jeddah is UTC+3 all year
const AST = 3 * 3600 * 1000;
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function when(ts) {
  const d = new Date(ts * 1000 + AST);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    day: DAYS[d.getUTCDay()],
    date: String(d.getUTCDate()).padStart(2, '0'),
    month: MONTHS[d.getUTCMonth()],
    time: `${hh}:${mm}`,
  };
}

export function countdown(ts, now = Date.now()) {
  let s = Math.max(0, Math.floor(ts - now / 1000));
  const d = Math.floor(s / 86400); s -= d * 86400;
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return { d, h, m, s, done: ts * 1000 <= now };
}
export const pad = (n) => String(n).padStart(2, '0');

// the next fixture that hasn't kicked off yet (falls back to the last one)
export const nextMatch = (now = Date.now()) => MATCHES.find((m) => m.kickoff * 1000 > now) || MATCHES[MATCHES.length - 1];
