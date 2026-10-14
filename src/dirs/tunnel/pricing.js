// Indicative seat prices for the seat map (Ahmed's call, 2026-10-11: "indicative by location").
// The categories and prices are each match's real ones (data.js TIERS, from the Webook feed); which
// part of the stadium falls in which category is NOT known (no official seat map yet), so it's assigned
// here by position — best seats on the tunnel side, cheaper toward the ends, the away end at one goal —
// and the panel labels it "indicative". Replace zoneOf with the official map when it arrives.
import { TIERS } from '../../data.js';

// each zone's preferred categories, best match first (categories differ from match to match)
const ZONES = {
  vip: ['VVIP', 'VIP', 'GOLD'],
  gold: ['GOLD', 'SILVER'],
  silver: ['SILVER', 'PREMIUM'],
  premium: ['PREMIUM', 'CAT 1'],
  cat1: ['CAT 1', 'CAT 2'],
  cat2: ['CAT 2', 'CAT 3', 'CAT 1'],
  cat3: ['CAT 3', 'CAT 2', 'CAT 4'],
  cat4: ['CAT 4', 'CAT 3', 'CAT 2'],
  away: ['CAT 4 AWAY', 'CAT 1 AWAY', 'CAT 4', 'CAT 3'],
};

// b: a block from seats.js — { stand, T: { key: lower|middle|upper }, th }
function zoneOf(b) {
  const tier = b.T.key, central = Math.abs(Math.cos(b.th)) < 0.4;
  switch (b.stand) {
    case 'Tunnel side': return tier === 'lower' ? (central ? 'vip' : 'gold') : tier === 'middle' ? 'silver' : 'premium';
    case 'Opposite side': return tier === 'upper' ? 'cat2' : 'cat1';
    case 'Corner': return tier === 'upper' ? 'cat3' : 'cat2';
    default: // behind the goal: the −x end holds the away fans' lower tier
      if (Math.cos(b.th) < 0) return tier === 'lower' ? 'away' : 'cat4';
      return tier === 'upper' ? 'cat4' : 'cat3';
  }
}

export function priceFor(match, b) {
  const cats = TIERS[match?.slug];
  if (!cats || !b) return null;
  for (const name of ZONES[zoneOf(b)]) {
    const c = cats.find((t) => t.name === name);
    if (c) return c;
  }
  return null;
}
