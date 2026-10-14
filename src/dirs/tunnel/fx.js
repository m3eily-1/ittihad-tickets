// Look switches. Neon is off (Ahmed, 2026-10-11: "hide the neon effect"): no yellow LED strips or their glow
// on the walls and floors, and the lit signs are plain printed ones. ?neon=1 brings it back to compare.
export const NEON = new URLSearchParams(location.search).get('neon') === '1';
// Glow is off too (Ahmed, 2026-10-11: "remove any glow or neon effects"): no bloom, lens flares, light
// shafts or cones, halos, mouth glare or flash, and nothing drawn brighter than white. ?glow=1 restores it.
export const GLOW = new URLSearchParams(location.search).get('glow') === '1';
