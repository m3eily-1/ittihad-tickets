// Screenshot a page of the dev server with the system Chrome (real time, so GSAP runs).
//   node tools/shot.mjs <path> <out.png> [--w=1440] [--h=900] [--scroll=<selector|px>] [--wait=1500] [--full] [--mobile]
// e.g. node tools/shot.mjs "/seats.html?skip=1" _shots/seats-hero.png
//      node tools/shot.mjs "/seats.html?skip=1" _shots/seats-fix.png --scroll=#matches --wait=2500
// Needs the dev server on http://localhost:4822 (launch.json "ittihad-tickets"). Prints console errors.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const [path = '/', out = '_shots/shot.png', ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => { const b = a.replace(/^--/, ''), i = b.indexOf('='); return i < 0 ? [b, true] : [b.slice(0, i), b.slice(i + 1)]; }));
const mobile = !!opt.mobile;
const w = +(opt.w || (mobile ? 390 : 1440)), h = +(opt.h || (mobile ? 844 : 900));
mkdirSync(dirname(out), { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: w, height: h, deviceScaleFactor: +(opt.dpr || 1), isMobile: mobile, hasTouch: mobile });
// other pages being edited trigger Vite full reloads / error overlays: ignore HMR for stable shots
await page.evaluateOnNewDocument(() => {
  const WS = window.WebSocket;
  window.WebSocket = function (url, proto) { if (String(proto).includes('vite')) return { addEventListener() {}, send() {}, close() {}, readyState: 0 }; return new WS(url, proto); };
  document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'vite-error-overlay{display:none!important}'; document.head.append(st); });
});
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4822' + path, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));
if (opt.scroll) {
  await page.evaluate(async (s) => {
    const y = isNaN(+s) ? document.querySelector(s).getBoundingClientRect().top + scrollY : +s;
    // step there so scroll-triggered scenes fire on the way
    const steps = 12;
    for (let i = 1; i <= steps; i++) { scrollTo(0, (y * i) / steps); await new Promise((r) => setTimeout(r, 60)); }
  }, opt.scroll);
}
// --js='code' runs in the page once it has loaded (e.g. switch a filter before the shot)
if (opt.js) { await new Promise((r) => setTimeout(r, 2500)); await page.evaluate(opt.js); }
await new Promise((r) => setTimeout(r, +(opt.wait || 1500)));
await page.screenshot({ path: out, fullPage: !!opt.full });
console.log(out);
if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'));
await browser.close();
