// Every upcoming Al-Ittihad home match for the matches room, by competition. The three on sale come
// from the live feed (data.js MATCHES). The rest are from the official 2026/27 fixture lists (see
// UPCOMING below for sources); they aren't on sale yet, so their cards say "Coming soon".
import { MATCHES } from '../../data.js';

// tournament themes: the room's light, the card accent and the wall title change with the filter
// mark: the competition's logo for the ticket filter (Ahmed), cut from the logos on Wikipedia
export const COMPS = {
  all: { label: 'All matches', wall: 'MATCHDAY', tint: [1.0, 0.78, 0.02], accent: '#fef201' },
  rsl: { mark: '/img/comps/rsl-mark.png', label: 'Saudi Pro League', wall: 'SAUDI PRO LEAGUE', tint: [0.08, 0.85, 0.5], accent: '#2fe39a' },
  afc: { mark: '/img/comps/afc-mark.png', label: 'AFC Champions League Elite', wall: 'AFC CHAMPIONS LEAGUE ELITE', tint: [0.22, 0.42, 1.0], accent: '#6f8dff' },
  kings: { mark: '/img/comps/kings-mark.png', label: "King's Cup", wall: "KING'S CUP", tint: [0.95, 0.66, 0.16], accent: '#f0b84a' },
};

// The rest of the home season, from the published 2026/27 fixture lists (ESPN and Goal fixtures pages,
// checked 2026-10-11). Kick-off times for the league aren't announced this far out, so those carry the
// date at midday Jeddah time plus timeTBC (the card then says "KICK-OFF TBC"). The AFC games are 21:15
// on ESPN but 22:15 on Goal, so they're also TBC until the club confirms. Venues: the AFC home games are
// at King Abdullah Sports City; league venues rotate, so TBC. King's Cup: the only tie is away (R16 at
// Al Jabalain, 30 Nov), so it has no card and its tab stays hidden. Crests: ESPN team logos, except
// Pakhtakor (none found, monogram).
const rsl = (round, opp, oppShort, oppCode, crest, kickoff) => ({
  comp: 'rsl', compLabel: 'Saudi Pro League', round, opp, oppShort, oppCode, crest, kickoff, timeTBC: true, venue: 'TBC',
});
const afc = (round, opp, oppShort, oppCode, oppFrom, crest, kickoff) => ({
  comp: 'afc', compLabel: 'AFC Champions League Elite', round, opp, oppShort, oppCode, oppFrom, crest, kickoff, timeTBC: true,
  venue: 'King Abdullah Sports City Stadium',
});
export const UPCOMING = [
  // (Al Ain, AFC MD4, 2 Nov — on sale now: it moved to data.js MATCHES on 2026-10-26)
  rsl('Matchweek 13', 'NEOM SC', 'NEOM', 'NEO', '/teams/neom.png', 1793869200),                                   // Thu 5 Nov 2026
  afc('League stage · MD5', 'Pakhtakor', 'PAKHTAKOR', 'PAK', 'Tashkent, Uzbekistan', null, 1795457700),           // Mon 23 Nov 2026
  rsl('Matchweek 15', 'Al Ahli', 'AL AHLI', 'AHL', '/teams/al-ahli.png', 1795683600),                             // Thu 26 Nov 2026
  rsl('Matchweek 17', 'Al Taawoun', 'AL TAAWOUN', 'TAW', '/teams/al-taawoun.png', 1796893200),                    // Thu 10 Dec 2026
  afc('League stage · MD7', 'Al-Gharafa', 'AL GHARAFA', 'GHA', 'Doha, Qatar', '/teams/al-gharafa.png', 1802110500), // Mon 8 Feb 2027
  rsl('Matchweek 19', 'Al Qadsiah', 'AL QADSIAH', 'QAD', '/teams/al-qadsiah.png', 1802336400),                    // Thu 11 Feb 2027
  rsl('Matchweek 21', 'Al Fateh', 'AL FATEH', 'FAT', '/teams/al-fateh.png', 1803546000),                          // Thu 25 Feb 2027
  rsl('Matchweek 24', 'Al Faisaly', 'AL FAISALY', 'FAI', '/teams/al-faisaly.png', 1806656400),                    // Fri 2 Apr 2027
  rsl('Matchweek 25', 'Al Hilal', 'AL HILAL', 'HIL', '/teams/al-hilal.png', 1807174800),                          // Thu 8 Apr 2027
  rsl('Matchweek 27', 'Al Ettifaq', 'AL ETTIFAQ', 'ETF', '/teams/al-ettifaq.png', 1808038800),                    // Sun 18 Apr 2027
  rsl('Matchweek 29', 'Abha', 'ABHA', 'ABH', '/teams/abha.png', 1808989200),                                      // Thu 29 Apr 2027
  rsl('Matchweek 31', 'Al Khaleej', 'AL KHALEEJ', 'KHA', '/teams/al-khaleej.png', 1810112400),                    // Wed 12 May 2027
  rsl('Matchweek 33', 'Al Riyadh', 'AL RIYADH', 'RIY', '/teams/al-riyadh.png', 1811149200),                       // Mon 24 May 2027
];

// demo sales (Ahmed, 2026-10-26: "add some matches that have ticket sales I can book" → demo-labelled): the next
// three fixtures can be booked in the app with typical categories (data.js TIERS, by these slugs) while the real
// sales aren't open yet. Every card, match page and seat panel says "Demo · not on sale yet".
const DEMO = { NEO: 20, PAK: 15, AHL: 20 };   // oppCode → "from" price of the template it uses
const demoSlug = (m) => `demo-${m.oppCode.toLowerCase()}-${m.kickoff}`;
export const FIXTURES = [
  ...MATCHES.map((m) => ({ ...m, onSale: true })),
  ...UPCOMING.map((m) => (DEMO[m.oppCode] ? { ...m, slug: demoSlug(m), from: DEMO[m.oppCode], onSale: true, demo: true } : { ...m, onSale: false })),
].sort((a, b) => (a.kickoff || 9e9) - (b.kickoff || 9e9));

// the tab style for the tournament filter while Ahmed compares them: ?tabs=underline | bar | title
export const TAB_STYLE = new URLSearchParams(location.search).get('tabs') || 'underline';
