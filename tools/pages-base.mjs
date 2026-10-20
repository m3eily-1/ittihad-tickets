// GitHub Pages serves the site under /<repo>/, not at the root. Vite's `--base` fixes the paths it
// builds, but the code also names public files in plain strings ('/img/…', '/sponsors/…', page links
// like '/tunnel.html'). This prefixes those in the built files.
//   node tools/pages-base.mjs dist /ittihad-tickets/
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const [dir = 'dist', base = '/'] = process.argv.slice(2);
const b = base.endsWith('/') ? base : base + '/';
const ROOTS = 'img|audio|models|sponsors|teams|icons|pbr';
const PAGES = 'index|seats|tifo|liquid|deck|broadcast|tunnel';
let files = 0, hits = 0;
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!['.js', '.html', '.css'].includes(extname(p))) continue;
    const src = readFileSync(p, 'utf8');
    const out = src
      .replace(new RegExp(`(['"\`(])/((?:${ROOTS})/)`, 'g'), (_, q, r) => (hits++, `${q}${b}${r}`))
      .replace(new RegExp(`(['"\`])/((?:${PAGES})\\.html)`, 'g'), (_, q, r) => (hits++, `${q}${b}${r}`))
      .replace(/href:\s*(['"])\/\1/g, (m, q) => (hits++, `href: ${q}${b}${q}`))
      .replace(/(['"])\/favicon\.ico/g, (_, q) => (hits++, `${q}${b}favicon.ico`));
    if (out !== src) { writeFileSync(p, out); files++; }
  }
})(dir);
console.log(`pages-base: ${hits} paths prefixed with ${b} in ${files} files`);
