// Al-Ittihad honours shown in the trophy room. Years only, no totals (Ahmed's call, 2026-10-08):
// sources disagree on how the 1957–1976 titles are counted, so only years that every source agrees
// on are listed. Not shown: the four His Majesty's League seasons (1958–59, 1959–60, 1960–61,
// 1963–64) that Wikipedia now counts as league titles after the federation's 2025 reclassification;
// older sources count those years as King's Cups instead.
// Sources (checked 2026-10-08): en.wikipedia.org/wiki/Al-Ittihad_Club_(Jeddah) (Honours),
// /wiki/Saudi_Pro_League, /wiki/King%27s_Cup_(Saudi_Arabia), /wiki/Saudi_Crown_Prince_Cup.
// No honours in 2025–26.
// shape: the stylised form used when there's no model of the real trophy (trophymodels.js builds the
//        real ones — acl, league, kings, crown, super — from reference photos)
// model: a GLB generated from a reference photo of the real trophy; it replaces the stylised form
//        once the file exists (see public/models/trophies/README.md)
export const TROPHIES = [
  { key: 'acl', name: 'AFC Champions League', scope: 'Asia', years: ['2004', '2005'], shape: 'tall', metal: 'gold', note: 'Back-to-back — the first club to retain it',
    // Ahmed chose the current Elite trophy for the 3D model (only clean reference); say so when it shows
    modelNote: 'Model shows today\'s AFC Champions League Elite trophy, not the 2004/05 design' },
  { key: 'league', name: 'Saudi League', scope: 'Saudi Arabia', years: ['1981–82', '1996–97', '1998–99', '1999–2000', '2000–01', '2002–03', '2006–07', '2008–09', '2022–23', '2024–25'], shape: 'grand', metal: 'gold' },
  { key: 'kings', name: "King's Cup", scope: 'Saudi Arabia', years: ['1967', '1988', '2010', '2013', '2018', '2025'], shape: 'lidded', metal: 'gold' },
  { key: 'crown', name: 'Crown Prince Cup', scope: 'Saudi Arabia', years: ['1957–58', '1958–59', '1962–63', '1991', '1997', '2001', '2004', '2016–17'], shape: 'bowl', metal: 'gold' },
  { key: 'cwc', name: "Asian Cup Winners' Cup", scope: 'Asia', years: ['1999'], shape: 'urn', metal: 'gold' },
  { key: 'arab', name: 'Arab Champions League', scope: 'Arab world', years: ['2005'], shape: 'globe', metal: 'gold' },
  { key: 'gcc', name: 'GCC Champions League', scope: 'Gulf', years: ['1999'], shape: 'cup', metal: 'silver' },
  { key: 'fed', name: 'Saudi Federation Cup', scope: 'Saudi Arabia', years: ['1986', '1997', '1999'], shape: 'cup', metal: 'silver' },
  { key: 'super', name: 'Saudi Super Cup', scope: 'Saudi Arabia', years: ['2022'], shape: 'spire', metal: 'silver' },
  { key: 'segypt', name: 'Saudi-Egyptian Super Cup', scope: 'Regional', years: ['2001', '2003'], shape: 'plate', metal: 'silver' },
];
