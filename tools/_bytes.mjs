import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'] });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
const sizes = new Map();
page.on('response', async (r) => { try { const b = await r.buffer(); sizes.set(r.url().replace('http://localhost:4822', ''), b.length); } catch {} });
await page.goto('http://localhost:4822/tunnel.html?skip=1', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__tunnel, { timeout: 60000 }); await new Promise((r) => setTimeout(r, 4000));
const all = [...sizes].filter(([u]) => !u.includes('/node_modules/') && !u.includes('/@') && !u.endsWith('.js') && !u.endsWith('.css')).sort((a, b) => b[1] - a[1]);
const tot = all.reduce((a, [, b]) => a + b, 0);
console.log('asset MB', (tot / 1e6).toFixed(1), 'files', all.length);
for (const [u, b] of all.slice(0, 18)) console.log((b / 1e3).toFixed(0).padStart(6), 'KB', u);
const groups = {}; for (const [u, b] of all) { const k = u.split('/').slice(0, 4).join('/'); groups[k] = (groups[k] || 0) + b; }
console.log(Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, b]) => `${k} ${(b / 1e6).toFixed(1)}MB`).join(' | '));
await browser.close();
