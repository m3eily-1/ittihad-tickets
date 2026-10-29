// Venue rules and FAQs for the match centre (Ahmed, 2026-10-29: "in the match center show the venue rules and FAQs").
// Verified only:
//   RULES — the ticket terms & conditions on the club's ticket site event page (tickets.ittihadclub.sa, Al Ittihad vs
//           Al Ain, AFC Elite 26/27, read 2026-10-29); the same terms are set by the organiser for its home matches.
//   FAQS  — webook's Help Center, "Tickets & Events" (wbk.zendesk.com, read 2026-10-29), the platform the club's
//           ticketing runs on. "Where are my tickets" points at this app's My tickets.
export const RULES_SRC = 'From the ticket terms on the club\'s ticket site';
export const FAQ_SRC = 'From the webook Help Center, the platform behind the club\'s tickets';

export const RULES = [
  ['General rules', [
    'Every person needs their own ticket, adults and children over one year old.',
    'All payments are non-refundable.',
    'The only official platform for reselling tickets is webook.com. Tickets bought or sold anywhere else can be cancelled with no refund, the account closed and legal action taken.',
    'If the match is cancelled or rescheduled for legal, security or other reasons beyond the organiser\'s control, tickets stay valid for the new date announced by the authorities.',
  ]],
  ['Entry and attendance', [
    'Check the date, kick-off time, venue and age restrictions before you go, and arrive early.',
    'Latecomers can be refused entry, with no refund.',
    'No re-entry once you leave, except for medical emergencies with the organiser\'s approval.',
    'Everyone and their belongings are searched at the gates; prohibited or dangerous items are confiscated.',
  ]],
  ['Prohibited items and actions', [
    'No outside food or drink: food and drink vendors are inside the stadium.',
    'No perfume bottles: they are disposed of at the entrance.',
    'No pets or animals.',
    'No professional cameras or recording equipment without prior written approval.',
    'No smoking, including e-cigarettes, and no lighters or matches, except in designated areas.',
  ]],
  ['Conduct', [
    'Anyone behaving in a disruptive or inappropriate way can be removed.',
    'Follow public decency laws, in keeping with the culture and values of Saudi Arabia.',
    'By attending you agree that photos, video and audio from the match can be used for publication and promotion.',
  ]],
  ['Fans and seating', [
    'Supporters in the away team\'s sections can be refused entry or removed, with no refund.',
    'Wear colours that support the team of the section you booked; rival team\'s kit is refused entry.',
    'The organiser can move ticket holders to other seats if directed or in an emergency.',
  ]],
  ['Accessible tickets', [
    'For people with a physical (mobility) disability only; a valid government-issued disability card is checked at the gate.',
    'Companions can\'t enter without the person with a disability.',
    'Limited, first come first served; reviewed by the organiser and the club, and sent 24 hours before the match.',
  ]],
];

export const FAQS = [
  ['How do I choose my seat?', 'Open the seat map, pick a section, then an available seat, confirm it and carry on to checkout.'],
  ['Where are my tickets?', 'In My tickets, from the menu, with every upcoming and past match you\'ve booked.'],
  ['Can I transfer my ticket?', 'If the organiser allows it, open your ticket, tap Send tickets and share it by link or email. Resale is only allowed on webook.com.'],
  ['My QR code isn\'t working', 'Open the ticket in the app rather than a screenshot, refresh the ticket page, and contact support if it still doesn\'t scan.'],
  ['Can I get a refund?', 'Tickets for club matches are non-refundable. Any refund request goes through customer support with your account email, the match, your order number and the reason.'],
  ['What if the match is cancelled?', 'If it\'s officially cancelled, eligible customers are refunded automatically under the organiser\'s and webook\'s policy, and notified by email.'],
  ['What if the match is rescheduled?', 'Your ticket normally stays valid for the new date. If you can\'t make it, refunds depend on the organiser\'s and webook\'s policies.'],
  ['How long does a refund take?', 'Approved refunds go back to the original payment method, in 7 to 21 business days depending on the bank or payment provider.'],
  ['Are there age restrictions?', 'Some events have them, so check the match details before buying. Every child over one year old needs their own ticket.'],
];

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// two blocks for the match centre's column: each topic opens in place
export function venueInfoHTML() {
  return `<section class="mc__info2" aria-label="Venue rules">
      <p class="mc__sk">Venue rules</p>
      ${RULES.map(([t, items]) => `<details class="mc__acc"><summary>${esc(t)}</summary><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></details>`).join('')}
      <p class="mc__fine">${esc(RULES_SRC)}.</p>
    </section>
    <section class="mc__info2" aria-label="FAQs">
      <p class="mc__sk">FAQs</p>
      ${FAQS.map(([q, a]) => `<details class="mc__acc"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
      <p class="mc__fine">${esc(FAQ_SRC)}.</p>
    </section>`;
}
