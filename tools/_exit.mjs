import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4822/tunnel.html?skip=1', { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__tunnel, { timeout: 60000 }); await new Promise((r) => setTimeout(r, 2500));
for (const room of ['trophies', 'store', 'changing', 'gym', 'fame', 'fantasy']) {
  await page.evaluate((r) => window.__tunnel.enterRoom(r), room);
  await page.waitForFunction(() => window.__tunnel.visit?.phase === 'inside', { timeout: 25000 }); await new Promise((r) => setTimeout(r, 400));
  if (room === 'fantasy') { await page.click('.js-fx-close'); await new Promise((r) => setTimeout(r, 500)); }
  // turn round (arrow keys) and walk back to the door
  await page.keyboard.down('ArrowLeft'); await new Promise((r) => setTimeout(r, 1960)); await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('w'); await new Promise((r) => setTimeout(r, 3500)); await page.keyboard.up('w'); await new Promise((r) => setTimeout(r, 300));
  const shown = await page.evaluate(() => !document.querySelector('.js-exit').hidden);
  console.log(room, 'cam', await page.evaluate(() => window.__tunnel.camera.position.toArray().map((v) => v.toFixed(2)).join(',')));
  if (room === 'trophies') await page.screenshot({ path: '_shots/goal/exit.png' });
  let left = false;
  if (shown) { await page.click('.js-exit-yes'); await page.waitForFunction(() => !window.__tunnel.visit, { timeout: 15000 }).catch(() => {}); left = await page.evaluate(() => !window.__tunnel.visit); }
  else { await page.evaluate(() => window.__tunnel.leaveRoom()); await page.waitForFunction(() => !window.__tunnel.visit, { timeout: 15000 }).catch(() => {}); }
  console.log(room, 'popup', shown, 'left via Yes', left);
}
console.log('errors', errors);
await browser.close();
