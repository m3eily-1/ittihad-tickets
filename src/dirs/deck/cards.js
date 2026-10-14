// Card data + markup for the Matchday Deck: the three on-sale fixtures plus the season pass,
// rendered as collectible ticket cards (front: the match, back: the feed's tier price list).
import { MATCHES, TIERS, SEASON, when, eventUrl, seasonUrl } from '../../data.js';

const SHORT = { rsl: 'Saudi Pro League', afc: 'AFC Champions League Elite' };

// deck order = kick-off order, season pass last
export const DECK = [
  ...MATCHES.map((m) => ({ kind: 'match', m, w: when(m.kickoff), url: eventUrl(m.slug), tiers: TIERS[m.slug] || [] })),
  { kind: 'season', url: seasonUrl(SEASON.slug) },
];

// stable pseudo-random barcode per slug
export function barcode(seedStr, { w = 120, h = 28 } = {}) {
  let seed = [...seedStr].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let x = 0, s = '';
  while (x < w) {
    const bw = 0.6 + rnd() * 2.2;
    if (rnd() > 0.35) s += `<rect x="${x.toFixed(2)}" y="0" width="${bw.toFixed(2)}" height="${h}"/>`;
    x += bw + 0.4 + rnd();
  }
  return `<svg class="bc" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${s}</svg>`;
}

// typographic seal for opponents with no crest on hand (Al Kholood, Al Nassr, Al Fayha)
let sealN = 0;
export function seal(name, letter) {
  const id = `seal-${++sealN}`;
  const ring = `${name.toUpperCase()} · MATCHDAY · `.repeat(2);
  return `<svg class="seal" viewBox="0 0 200 200" role="img" aria-label="${name}">
    <defs><path id="${id}" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
    <circle cx="100" cy="100" r="96" class="seal__o" />
    <circle cx="100" cy="100" r="62" class="seal__i" />
    <text class="seal__ring"><textPath href="#${id}" textLength="486">${ring}</textPath></text>
    <text class="seal__l" x="100" y="100" text-anchor="middle" dominant-baseline="central">${letter}</text>
  </svg>`;
}

const pad2 = (n) => String(n).padStart(2, '0');
const roundShort = (m) => (m.comp === 'afc' ? m.round : m.round.replace('Matchweek', 'MW'));

function edges(n = 4) {
  return Array.from({ length: n }, (_, i) => `<i class="card__edge" style="--z:${i + 1}"></i>`).join('');
}

function matchFront(c, i, n) {
  const { m, w } = c;
  return `<div class="face face--front">
    <div class="face__top"><img src="/img/crest.png" alt="" width="20" height="22" /><span>Al-Ittihad · Admit one</span><b>№ ${pad2(i + 1)}/${pad2(n)}</b></div>
    <p class="face__comp"><b>${SHORT[m.comp]}</b><span>${roundShort(m)}</span></p>
    <div class="face__art">
      <div class="face__stripes"></div>
      <img class="face__home" src="/teams/al-ittihad.png" alt="" draggable="false" />
      <span class="face__vs">vs</span>
      <img class="face__away" src="${m.crest}" alt="" draggable="false" />
      <div class="face__holo"></div>
    </div>
    <p class="face__opp"><small>Al-Ittihad vs</small><span>${m.opp}</span></p>
    <dl class="face__data">
      <div><dt>Date</dt><dd>${w.day} ${w.date} ${w.month}</dd></div>
      <div><dt>Kick-off</dt><dd>${w.time} <small>JED</small></dd></div>
      <div class="is-wide"><dt>Venue</dt><dd>${m.venue}</dd></div>
    </dl>
    <div class="face__stub">
      ${barcode(m.slug)}
      <div class="face__price"><span>From</span><b>SAR ${m.from}</b></div>
      <span class="face__serial">ITT-${m.oppCode}-${w.date}${w.month}</span>
    </div>
    <div class="face__sheen"></div>
    <div class="face__dim"></div>
  </div>`;
}

function matchBack(c) {
  const { m, w, tiers } = c;
  const rows = tiers.map((t) => `<li><i style="--c:${t.color}"></i><span>${t.name}</span><b>SAR ${t.price}</b></li>`).join('');
  return `<div class="face face--back">
    <div class="back__top"><span>Ticket tiers</span><b>incl. VAT</b></div>
    <p class="back__match">vs ${m.opp} · ${w.day} ${w.date} ${w.month}</p>
    <ul class="back__tiers">${rows}</ul>
    <p class="back__note">Indicative tier list from the club's ticketing feed. Seat availability is live on the booking page.</p>
    <a class="back__go" href="${c.url}" target="_blank" rel="noopener">Choose your seat ↗</a>
    <img class="back__mark" src="/img/crest.png" alt="" />
  </div>`;
}

function seasonFront(i, n) {
  return `<div class="face face--front face--season">
    <div class="face__top"><img src="/img/crest.png" alt="" width="20" height="22" /><span>Al-Ittihad · Holder</span><b>№ ${pad2(i + 1)}/${pad2(n)}</b></div>
    <p class="face__comp"><b>Season ${SEASON.season}</b><span>All home matches</span></p>
    <div class="face__art face__art--pass">
      <img class="face__poster" src="/img/season-pass.png" alt="" draggable="false" />
      <div class="face__holo"></div>
    </div>
    <p class="face__opp"><small>Tigers</small><span>Season Pass</span></p>
    <dl class="face__data">
      <div><dt>Competitions</dt><dd>${SEASON.comps.length}</dd></div>
      <div><dt>Home grounds</dt><dd>${SEASON.venues.length}</dd></div>
      <div class="is-wide"><dt>Covers</dt><dd>League · King's Cup · Asia</dd></div>
    </dl>
    <div class="face__stub">
      ${barcode(SEASON.slug)}
      <div class="face__price"><span>From</span><b>SAR ${SEASON.from}</b></div>
      <span class="face__serial">ITT-PASS-${SEASON.season.replace('/', '')}</span>
    </div>
    <div class="face__sheen"></div>
    <div class="face__dim"></div>
  </div>`;
}

function seasonBack(c) {
  return `<div class="face face--back">
    <div class="back__top"><span>The pass</span><b>incl. VAT</b></div>
    <p class="back__match">Tigers Season Pass ${SEASON.season}</p>
    <ul class="back__tiers back__tiers--pass">
      ${SEASON.comps.map((x, k) => `<li><i class="n">${k + 1}</i><span>${x}</span></li>`).join('')}
    </ul>
    <ul class="back__venues">${SEASON.venues.map((v) => `<li>${v}</li>`).join('')}</ul>
    <ol class="back__steps">
      <li><b>1</b>Buy — your seat is issued for Alinma Stadium matches.</li>
      <li><b>2</b>Pick your seat at Prince Abdullah Al-Faisal from an app notification.</li>
    </ol>
    <a class="back__go" href="${c.url}" target="_blank" rel="noopener">Secure your pass ↗</a>
    <img class="back__mark" src="/img/crest.png" alt="" />
  </div>`;
}

export function cardHTML(c, i, n) {
  const front = c.kind === 'match' ? matchFront(c, i, n) : seasonFront(i, n);
  const back = c.kind === 'match' ? matchBack(c) : seasonBack(c);
  const label = c.kind === 'match' ? `Al-Ittihad vs ${c.m.opp}, ${c.w.day} ${c.w.date} ${c.w.month}` : 'Tigers Season Pass';
  return `<div class="slot${c.kind === 'season' ? ' slot--season' : ''}" data-i="${i}" role="group" aria-roledescription="card" aria-label="${label}">
    <div class="slot__shadow"></div>
    <div class="card" data-cursor="label" data-cursor-label="Drag">
      <div class="card__flip">${edges()}${front}${back}</div>
    </div>
  </div>`;
}
