// profiling: frame time, draw calls, triangles, lights and shader programs at points along the walk
import puppeteer from 'puppeteer-core';
const q = process.argv[2] || '';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--hide-scrollbars', '--disable-frame-rate-limit'] });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
const t0 = Date.now();
await page.goto(`http://localhost:4822/tunnel.html?skip=1${q}`, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__tunnel, { timeout: 60000 });
console.log('ready ms', Date.now() - t0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2500);
const res = await page.evaluate(async () => {
  const T = window.__tunnel, r = T.renderer;
  let lights = { all: 0, area: 0, point: 0, spot: 0 };
  T.scene.traverse((o) => { if (o.isLight) { lights.all++; if (o.isRectAreaLight) lights.area++; if (o.isPointLight) lights.point++; if (o.isSpotLight) lights.spot++; } });
  let meshes = 0, mats = new Set(), geos = new Set();
  T.scene.traverse((o) => { if (o.isMesh) { meshes++; [].concat(o.material).forEach((m) => mats.add(m)); geos.add(o.geometry); } });
  r.info.autoReset = false;
  const oneFrame = () => new Promise((res) => { r.info.reset(); requestAnimationFrame(() => requestAnimationFrame(() => res({ calls: r.info.render.calls, tris: r.info.render.triangles }))); });
  const measure = (n) => new Promise((res) => { const ts = []; let last = performance.now(); const f = () => { const now = performance.now(); ts.push(now - last); last = now; if (ts.length < n) requestAnimationFrame(f); else res(ts); }; requestAnimationFrame(f); });
  const out = { lights, meshes, materials: mats.size, geometries: geos.size, mem: { ...r.info.memory }, programs: r.info.programs.length, points: [] };
  for (const s of [0, 0.2, 0.45, 0.6, 0.8, 1]) {
    window.scrollTo(0, s * (document.documentElement.scrollHeight - innerHeight));
    await new Promise((x) => setTimeout(x, 2200));
    const ts = (await measure(90)).slice(10).sort((a, b) => a - b);
    const f = await oneFrame();
    out.points.push({ s, median: +ts[Math.floor(ts.length / 2)].toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), calls: f.calls, tris: f.tris });
  }
  for (const room of ['store', 'changing', 'trophies', 'fantasy', 'gym', 'fame']) {
    window.scrollTo(0, 0.3 * (document.documentElement.scrollHeight - innerHeight)); await new Promise((x) => setTimeout(x, 1500));
    T.enterRoom(room);
    const t0 = performance.now(); while (T.visit?.phase !== 'inside' && performance.now() - t0 < 15000) await new Promise((x) => setTimeout(x, 100));
    await new Promise((x) => setTimeout(x, 800));
    const ts = (await measure(70)).slice(10).sort((a, b) => a - b); const f = await oneFrame();
    out.points.push({ room, median: +ts[Math.floor(ts.length / 2)].toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), calls: f.calls, tris: f.tris });
    T.leaveRoom(); const t1 = performance.now(); while (T.visit && performance.now() - t1 < 8000) await new Promise((x) => setTimeout(x, 100));
  }
  out.programsAfter = r.info.programs.length;
  return out;
});
console.log(JSON.stringify({ ...res, points: undefined }));
for (const p of res.points) console.log(JSON.stringify(p));
await browser.close();
