// One FC-style player card for every screen (tournament line-ups, packs, club, players). Players are fantasy-ui.js's
// P entries (fantasy-data.js: names, numbers, positions, nationalities and photos from spl.com.sa). The rating is a
// DEMO value (nothing official exists) — the card says so in its corner tag, and screens that show many cards
// should carry one "Demo ratings" note too.
import './fc-card.css';

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// rarity by rating: bronze / silver / gold / elite (the card's frame)
export const tierOf = (r) => (r >= 85 ? 'elite' : r >= 75 ? 'gold' : r >= 65 ? 'silver' : 'bronze');
// a pitch-position label from the data's GK / DEF / MID / FWD (the line-up screens pass their own slot label)
export const POS_SHORT = { GK: 'GK', DEF: 'DF', MID: 'MF', FWD: 'FW' };

/**
 * @param p      a fantasy P entry { id, club, first, last, pos, nat, no, photo, rating }
 * @param opts   { size: 's'|'m'|'l', slot: 'CB'… (label under the card), selected, locked, tag: 'NEW'… }
 */
export function fcCardHTML(p, { size = 'm', slot = '', selected = false, locked = false, tag = '' } = {}) {
  if (!p) return `<div class="fcc is-${size} is-empty">${slot ? `<span class="fcc__slot">${esc(slot)}</span>` : ''}</div>`;
  const name = (p.last || p.first || '').toUpperCase();
  return `<div class="fcc is-${size} is-${tierOf(p.rating)}${selected ? ' is-sel' : ''}${locked ? ' is-locked' : ''}" data-pid="${p.id}">
    <div class="fcc__in">
      <div class="fcc__tl"><b>${p.rating}</b><span>${esc(POS_SHORT[p.pos] || p.pos)}</span></div>
      ${tag ? `<i class="fcc__tag">${esc(tag)}</i>` : ''}
      ${p.photo ? `<img class="fcc__ph" src="${esc(p.photo)}" alt="" loading="lazy"/>` : '<span class="fcc__ph is-none"></span>'}
      <p class="fcc__nm">${esc(name)}</p>
      <p class="fcc__ft"><span>${esc(p.nat || '')}</span>${p.club?.logo ? `<img src="${esc(p.club.logo)}" alt=""/>` : ''}<span>#${p.no ?? ''}</span></p>
      <em class="fcc__demo" title="Demo rating: not an official value">DEMO</em>
    </div>
    ${slot ? `<span class="fcc__slot">${esc(slot)}</span>` : ''}
  </div>`;
}
