// One way back on every page (Ahmed, 2026-10-22: "i need the app to have consistent experience"): Escape presses the
// top page's own back button, so it always does what back does — one step, to the screen you came from, with
// feel.back(). main.js imports this first, so this listener runs before the pages' own key handlers, and it stops the
// Escape there: a page underneath (the club, the community, the cup) never closes as well.
const PAGES = '.nw, .tk, .mc, .cl, .ci, .cm, .pk, .cu, .gh, .sc-board, .lc-col, .sh, .fx.is-page, .mg, .lc-zoom, .sc-modal';
// these know better than a back button: a sheet inside them, the pack opening, the cup's modals and VS intro
const OWN = '.cm, .pk, .cu';
const BACK = '.sc-modal .js-sc-x, [aria-label="Back"], .gh__back, .lc-back, .sc-back, .mg-back, .sh__back, .fx-back, .cm-back';
const FADES = '.mg, .sc-modal';   // no is-on class: shown is open

const shown = (el) => {
  if (!el.isConnected || el.hidden || el.classList.contains('is-under') || el.classList.contains('is-out')) return false;
  if (!el.matches(FADES) && !el.classList.contains('is-on')) return false;   // still opening, or already closing
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
};
export function topPage() {
  return [...document.querySelectorAll(PAGES)].filter(shown)
    .sort((a, b) => (parseInt(getComputedStyle(a).zIndex, 10) || 0) - (parseInt(getComputedStyle(b).zIndex, 10) || 0) || (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .pop() || null;
}
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const top = topPage();
  if (!top || top.matches(OWN)) return;
  const back = top.matches('.lc-zoom') ? top : [...top.querySelectorAll(BACK)].find((b) => b.getClientRects().length && !b.disabled);
  if (!back) return;
  e.preventDefault(); e.stopImmediatePropagation();
  back.click();
}, true);
