import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage();
p.on('console', (m) => console.log(m.type(), m.text().slice(0, 300)));
await p.goto('http://localhost:4822/tunnel.html?skip=1&t=0', { waitUntil: 'networkidle2' });
for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 3000)); console.log('t', (i + 1) * 3, await p.evaluate(() => ({ tunnel: !!window.__tunnel, nogl: document.querySelector('#top').classList.contains('no-gl'), op: getComputedStyle(document.querySelector('.js-gl')).opacity }))); }
await b.close();
