import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[tunnel]')) errors.push(m.text().slice(0, 300)); });
await page.goto('http://localhost:4822/tunnel.html?skip=1', { waitUntil: 'networkidle2', timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);
await page.evaluate(() => { try { localStorage.removeItem('itt-fantasy-v1'); } catch {} window.__tunnel.enterRoom('fantasy'); });
await page.waitForFunction(() => window.__tunnel.visit?.phase === 'inside', { timeout: 25000 }).catch(() => errors.push('never inside'));
await sleep(900);
await page.screenshot({ path: '_shots/goal/fx-0.png' });
// pick a legal 15: best-rated by position within budget/club limits, by clicking list items
for (const [pos, n] of [['GK', 2], ['DEF', 5], ['MID', 5], ['FWD', 3]]) {
  await page.click(`.js-fx-tabs button[data-pos="${pos}"]`); await sleep(150);
  await page.select('.js-fx-sort', 'price'); await sleep(100);
  let got = 0, tries = 0;
  while (got < n && tries < 60) {
    const items = await page.$$('.fx__item:not(.is-in):not(.is-off)');
    const it = items[Math.min(items.length - 1, 8 + tries)]; if (!it) break;
    await it.click(); await sleep(80); tries++;
    got = await page.evaluate((p) => JSON.parse(localStorage.getItem('itt-fantasy-v1') || '{"squad":[]}').squad.length, pos) - ({ GK: 0, DEF: 2, MID: 7, FWD: 12 }[pos]);
  }
}
await sleep(400);
await page.screenshot({ path: '_shots/goal/fx-1.png' });
const st = await page.evaluate(() => JSON.parse(localStorage.getItem('itt-fantasy-v1')));
console.log('squad', st.squad.length, 'formation', st.formation, 'cap', st.captain);
await page.click('.js-fx-close'); await sleep(1500);
await page.screenshot({ path: '_shots/goal/fx-2.png' });
await page.keyboard.down('w'); await sleep(900); await page.keyboard.up('w'); await sleep(600);
await page.screenshot({ path: '_shots/goal/fx-3.png' });
console.log('errors', errors.slice(0, 6));
await browser.close();
