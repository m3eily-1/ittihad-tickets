import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ' ' + m.text().slice(0, 300)); });
await page.goto('http://localhost:4822/tunnel.html', { waitUntil: 'networkidle2', timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(6000);
await page.evaluate(() => { try { localStorage.removeItem('itt-fantasy-v1'); } catch {} });
// scroll down the tunnel until the door button says SPL Fantasy
let found = false;
for (let i = 0; i < 80 && !found; i++) {
  await page.mouse.move(720, 450); await page.mouse.wheel({ deltaY: 120 }); await sleep(250);
  const lab = await page.evaluate(() => { const b = document.querySelector('.js-door'); return b && b.classList.contains('is-on') ? b.textContent : ''; });
  if (/Fantasy/.test(lab)) found = true;
}
console.log('door found', found);
await sleep(400);
const box = await (await page.$('.js-door')).boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await sleep(5000);
const st = await page.evaluate(() => ({ open: !document.querySelector('.fx').hidden, visit: window.__tunnel.visit }));
console.log('after enter', JSON.stringify(st));
await page.screenshot({ path: '_shots/goal/fxu-0.png' });
// click the first list row with the mouse
const row = await page.$('.fx__item:not(.is-off)'); const rb = await row.boundingBox();
console.log('boxes', await page.evaluate(() => ['.th__pin', '.fx', '.fx__main', '.fx__market', '.js-fx-list'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return q + ' ' + Math.round(r.y) + ' h' + Math.round(r.height) + ' st' + document.querySelector(q).scrollTop; }).join(' | ')));
console.log('hit', await page.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e ? e.className + ' < ' + (e.parentElement?.className || '') : 'none'; }, rb.x + rb.width / 2, rb.y + rb.height / 2), JSON.stringify(rb));
await page.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2); await sleep(400);
console.log('after click', await page.evaluate(() => localStorage.getItem('itt-fantasy-v1')));
// wheel inside the list
const lb = await (await page.$('.js-fx-list')).boundingBox();
await page.mouse.move(lb.x + 100, lb.y + 200); await page.mouse.wheel({ deltaY: 600 }); await sleep(500);
console.log('list scrollTop', await page.evaluate(() => document.querySelector('.js-fx-list').scrollTop));
// type in search
await page.click('.js-fx-q'); await page.keyboard.type('nesyri'); await sleep(400);
console.log('rows after search', await page.evaluate(() => document.querySelectorAll('.fx__item').length), await page.evaluate(() => document.querySelector('.js-fx-q').value));
// tabs + select
await page.mouse.click(...(await (async () => { const b = await (await page.$('.js-fx-tabs button[data-pos="GK"]')).boundingBox(); return [b.x + 10, b.y + 10]; })())); await sleep(200);
console.log('tab', await page.evaluate(() => document.querySelector('.js-fx-tabs .is-on').dataset.pos));
await page.screenshot({ path: '_shots/goal/fxu-1.png' });
console.log('errors', errors.slice(0, 8));
await browser.close();
