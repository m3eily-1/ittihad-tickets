// Club posters along the tunnel walls (Ahmed, 2026-10-13: "theme the tunnel for Ittihad, with posters").
// Only real club content: the squad (official photos where the club site has them, a number card otherwise),
// the official match-day posters, the honours by year (years only, as in the trophy room), and the club —
// crest, Al-Ameed, the Tigers, the 26/27 home kit.
// Layouts (?posters=full | gallery | mix | upper). Ahmed's pick (2026-10-13): full — posters cover the
// walls floor to ceiling, edge to edge, only the doorways left open, no bare wall anywhere.
// The earlier options, kept for comparison:
//   gallery — the big stencilled words come down; framed posters line both walls at eye level
//   mix     — the stencils stay; posters fill the gaps between them
//   upper   — the stencils shrink to the lower wall; a row of posters runs high above them
import * as THREE from 'three';
import { TN, DOORS } from './world.js';
import { SQUAD } from './squad.js';
import { TROPHIES } from './trophies.js';
import { MATCHES, when } from '../../data.js';

export const POSTER_MODE = new URLSearchParams(location.search).get('posters') || 'mural';
const Y = '#f2c418', K = '#111213', INK = '#f4f1e8';
const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function canvas(draw, W = 600, H = 840) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  draw(c.getContext('2d'), W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const fit = (x, text, maxW, size, font = 'Anton') => { x.font = `400 ${size}px ${font}`; while (x.measureText(text).width > maxW && size > 14) { size -= 2; x.font = `400 ${size}px ${font}`; } return size; };
function claws(x, W, H, alpha = 0.18) {
  x.fillStyle = `rgba(242,196,24,${alpha})`;
  for (let i = 0; i < 3; i++) { const cx = W * 0.62 + i * 46; x.beginPath(); x.moveTo(cx, 0); x.quadraticCurveTo(cx + 60, H * 0.5, cx + 20, H); x.lineTo(cx + 2, H); x.quadraticCurveTo(cx + 40, H * 0.5, cx - 22, 0); x.fill(); }
}

/* ── the poster designs ── */
function playerPoster(p, img, crest) {
  return canvas((x, W, H) => {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2c2d32'); g.addColorStop(1, '#0e0f11');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    claws(x, W, H);
    x.fillStyle = 'rgba(242,196,24,0.95)'; x.font = '400 380px Anton'; x.textAlign = 'right'; x.globalAlpha = img ? 0.22 : 0.9;
    x.fillText(String(p.no), W - 24, img ? 400 : 520); x.globalAlpha = 1;
    if (img) { const sh = img.height * 0.78, sw = sh * (W / 640); x.drawImage(img, (img.width - sw) / 2, 0, sw, sh, 0, 40, W, 640); }
    else if (crest) { x.globalAlpha = 0.9; x.drawImage(crest, 40, 120, 170, 190); x.globalAlpha = 1; }
    x.fillStyle = K; x.fillRect(0, H - 170, W, 170); x.fillStyle = Y; x.fillRect(0, H - 170, W, 8);
    x.textAlign = 'left'; x.fillStyle = Y; x.font = '400 96px Anton'; x.fillText(String(p.no), 28, H - 46);
    const nw = x.measureText(String(p.no)).width + 52;
    x.fillStyle = INK; fit(x, p.name.toUpperCase(), W - nw - 28, 52); x.fillText(p.name.toUpperCase(), nw, H - 70);
    x.fillStyle = 'rgba(244,241,232,0.6)'; x.font = '500 22px "JetBrains Mono"'; x.fillText(`${p.pos.toUpperCase()} · SQUAD 2026/27`, nw, H - 32);
  });
}
function matchPoster(m, img) {
  return canvas((x, W, H) => {
    x.fillStyle = K; x.fillRect(0, 0, W, H);
    x.fillStyle = Y; x.fillRect(0, 0, W, 120);
    x.fillStyle = K; x.textAlign = 'center'; x.font = '400 84px Anton'; x.fillText('MATCHDAY', W / 2, 92);
    if (img) { const sh = img.height, sw = sh * (W / 420); x.drawImage(img, Math.max(0, (img.width - sw) / 2), 0, Math.min(sw, img.width), sh, 0, 140, W, 420); }
    const w = when(m.kickoff);
    x.fillStyle = 'rgba(244,241,232,0.6)'; x.font = '500 24px "JetBrains Mono"'; x.fillText(m.compLabel.toUpperCase(), W / 2, 612);
    x.fillStyle = INK; fit(x, `AL ITTIHAD VS ${m.opp.toUpperCase()}`, W - 60, 56); x.fillText(`AL ITTIHAD VS ${m.opp.toUpperCase()}`, W / 2, 680);
    x.fillStyle = Y; x.font = '400 64px Anton'; x.fillText(`${w.day} ${w.date} ${w.month} · ${w.time}`, W / 2, 760);
    x.fillStyle = 'rgba(244,241,232,0.6)'; x.font = '500 20px "JetBrains Mono"'; fit(x, m.venue.toUpperCase(), W - 60, 20, '"JetBrains Mono"'); x.fillText(m.venue.toUpperCase(), W / 2, 806);
  });
}
function honoursPoster(t, crest) {
  return canvas((x, W, H) => {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f2c418'); g.addColorStop(1, '#d9a90e');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = -H; i < W; i += 60) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + 26, H); x.lineTo(i + 26 + H, 0); x.lineTo(i + H, 0); x.fill(); }
    if (crest) x.drawImage(crest, 36, 36, 92, 103);
    x.fillStyle = K; x.textAlign = 'left'; x.font = '500 22px "JetBrains Mono"'; x.fillText(`HONOURS · ${t.scope.toUpperCase()}`, 150, 76);
    x.font = '400 40px Anton'; x.fillText('AL-ITTIHAD', 150, 124);
    const words = t.name.toUpperCase().split(' '); let line = '', lines = [];
    x.font = '400 92px Anton';
    for (const wd of words) { const tryL = line ? line + ' ' + wd : wd; if (x.measureText(tryL).width > W - 72 && line) { lines.push(line); line = wd; } else line = tryL; }
    lines.push(line);
    lines.forEach((l, i) => x.fillText(l, 36, 270 + i * 92));
    // the years, as a list (years only)
    x.font = '400 54px Anton'; const y0 = 300 + lines.length * 92;
    t.years.forEach((yr, i) => { const col = i % 2, row = Math.floor(i / 2); x.fillText(yr, 36 + col * 270, y0 + row * 66); });
  });
}
function clubPoster(kind, imgs) {
  return canvas((x, W, H) => {
    x.fillStyle = K; x.fillRect(0, 0, W, H); claws(x, W, H, 0.14);
    x.textAlign = 'center';
    if (kind === 'crest') {
      if (imgs.crest) x.drawImage(imgs.crest, W / 2 - 170, 120, 340, 381);
      x.fillStyle = Y; x.font = '400 110px Anton'; x.fillText('EST. 1927', W / 2, 650);
      x.fillStyle = INK; x.font = '500 28px "JetBrains Mono"'; x.fillText('AL-ITTIHAD CLUB · JEDDAH', W / 2, 712);
    } else if (kind === 'ameed') {
      x.fillStyle = INK; x.font = '700 150px Cairo'; x.fillText('العميد', W / 2, 330);
      x.fillStyle = Y; x.font = '400 120px Anton'; x.fillText('AL-AMEED', W / 2, 500);
      x.fillStyle = 'rgba(244,241,232,0.6)'; x.font = '500 26px "JetBrains Mono"'; x.fillText('THE DEAN · SINCE 1927', W / 2, 570);
      if (imgs.crest) x.drawImage(imgs.crest, W / 2 - 60, 640, 120, 134);
    } else if (kind === 'tigers') {
      x.fillStyle = Y; x.fillRect(0, 0, W, H);
      x.fillStyle = K; for (let i = 0; i < 6; i++) { const yy = 60 + i * 130; x.beginPath(); x.moveTo(0, yy); x.quadraticCurveTo(W * 0.35, yy + 50, W * 0.55, yy + 10); x.lineTo(W * 0.5, yy + 38); x.quadraticCurveTo(W * 0.3, yy + 70, 0, yy + 56); x.fill(); x.beginPath(); x.moveTo(W, yy + 40); x.quadraticCurveTo(W * 0.68, yy + 90, W * 0.48, yy + 54); x.lineTo(W * 0.52, yy + 80); x.quadraticCurveTo(W * 0.72, yy + 112, W, yy + 92); x.fill(); }
      x.fillStyle = K; x.fillRect(0, H - 220, W, 220);
      x.fillStyle = Y; x.font = '400 140px Anton'; x.fillText('THE TIGERS', W / 2, H - 70);
    } else if (kind === 'kit') {
      x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, W, H);
      if (imgs.kit) { const s = Math.min(W / imgs.kit.width, 620 / imgs.kit.height); x.drawImage(imgs.kit, (W - imgs.kit.width * s) / 2, 40, imgs.kit.width * s, imgs.kit.height * s); }
      x.fillStyle = K; x.fillRect(0, H - 170, W, 170); x.fillStyle = Y; x.fillRect(0, H - 170, W, 8);
      x.fillStyle = Y; x.font = '400 64px Anton'; x.fillText('HOME KIT 2026/27', W / 2, H - 82);
      x.fillStyle = 'rgba(244,241,232,0.6)'; x.font = '500 22px "JetBrains Mono"'; x.fillText('AVAILABLE IN THE CLUB STORE', W / 2, H - 36);
    }
  });
}

/* ── placement ── */
// wall spans that stay clear: doors, the crest light-box, and the wall graphics kept in every layout
const KEEP = {
  left: [[DOORS.gym[0] - 0.4, DOORS.gym[1] + 0.4], [DOORS.changing[0] - 0.4, DOORS.changing[1] + 0.4], [DOORS.store[0] - 0.4, DOORS.store[1] + 0.4], [86.0, 88.0], [94.4, 100]],
  right: [[DOORS.fame[0] - 0.4, DOORS.fame[1] + 0.4], [DOORS.in[0] - 0.4, DOORS.in[1] + 0.4], [88.6, 100]],
};
// the big stencil words (world.js `stencils`), by wall and span — they come down in the gallery layout
const STENCIL = { left: [[73.8, 85], [55.4, 66.6], [46.3, 54.9]], right: [[75.3, 83.9], [63.4, 74.6], [47, 62]] };

function slots(blocked, w, gap, z0 = 47.5, z1 = 99) {
  const out = []; let z = z0;
  while (z + w <= z1) {
    const hit = blocked.find(([a, b]) => z < b && z + w > a);
    if (hit) { z = hit[1] + 0.05; continue; }
    out.push(z + w / 2); z += w + gap;
  }
  return out;
}

export async function buildPosters(tunnel, stencils = []) {
  const mode = POSTER_MODE;
  const [crest, kit, ...photos] = await Promise.all([load('/img/crest.png'), load('/img/store/home-26-27.jpg'), ...SQUAD.map((p) => (p.photo ? load(p.photo) : null))]);
  const promos = await Promise.all(['/img/promo-afc.jpg', '/img/promo-shabab.png', '/img/promo-diriyah.png'].map(load));
  // the running order: a mix, so each stretch of wall has a player, a match, an honour and the club
  const players = SQUAD.map((p, i) => ({ p, img: photos[i] })).sort((a, b) => (b.img ? 1 : 0) - (a.img ? 1 : 0));
  const honours = [...TROPHIES].sort((a, b) => b.years.length - a.years.length);
  const club = ['crest', 'kit', 'ameed', 'tigers'];
  const queue = [];
  for (let i = 0; queue.length < 80; i++) {
    if (club[i]) queue.push(() => clubPoster(club[i], { crest, kit }));
    if (players[i]) queue.push(() => playerPoster(players[i].p, players[i].img, crest));
    if (MATCHES[i]) queue.push(() => matchPoster(MATCHES[i], promos[i]));
    if (honours[i]) queue.push(() => honoursPoster(honours[i], crest));
    if (players[i + 12]) queue.push(() => playerPoster(players[i + 12].p, players[i + 12].img, crest));
    if (i > 40) break;
  }

  if (mode === 'mural') {
    // groups of three players printed straight onto the wall (Ahmed): every player once, grouped by position,
    // from the league's official cut-outs (no player repeats)
    const withPhoto = SQUAD.filter((p) => p.photo);
    const imgs = await Promise.all(withPhoto.map((p) => load(p.photo)));
    const trios = [];
    for (let i = 0; i + 2 < withPhoto.length; i += 3) {
      const three = imgs.slice(i, i + 3);
      if (!three.every(Boolean)) continue;
      const c = document.createElement('canvas'); c.width = 1700; c.height = 1100; const x = c.getContext('2d');
      const draw = (im, cx, h) => x.drawImage(im, cx - h / 2, c.height - h, h, h);   // square cut-outs
      draw(three[0], 470, 1000); draw(three[2], 1230, 1000); draw(three[1], 850, 1100);   // the middle one in front
      trios.push(c);
    }
    return buildMural(tunnel, stencils, crest, trios);
  }
  if (mode === 'full') return buildFull(tunnel, stencils, queue);
  // layout
  let W = 1.1, Hh = 1.54, yc = 1.62, gap = 0.55, block = { left: [...KEEP.left], right: [...KEEP.right] };
  if (mode === 'gallery') { for (const s of stencils) s.visible = false; }
  else if (mode === 'mix') { W = 0.8; Hh = 1.12; yc = 1.55; gap = 0.4; block.left.push(...STENCIL.left); block.right.push(...STENCIL.right); }
  else if (mode === 'upper') {
    W = 0.56; Hh = 0.78; yc = 2.92; gap = 0.3;
    // the stencils shrink to the lower two-thirds of the wall
    for (const s of stencils) { s.scale.setScalar(0.68); s.position.y = 1.2; }
    block = { left: [[DOORS.gym[0] - 0.3, DOORS.gym[1] + 0.3], [DOORS.changing[0] - 0.3, DOORS.changing[1] + 0.3], [DOORS.store[0] - 0.3, DOORS.store[1] + 0.3], [86.0, 88.0], [94.4, 100]], right: [[DOORS.fame[0] - 0.3, DOORS.fame[1] + 0.3], [DOORS.in[0] - 0.3, DOORS.in[1] + 0.3], [88.6, 100]] };
  }
  const frameGeo = new THREE.BoxGeometry(W + 0.08, Hh + 0.08, 0.05);
  const posterGeo = new THREE.PlaneGeometry(W, Hh);
  const frameM = new THREE.MeshBasicMaterial({ color: 0x0b0b0c });
  const lipM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.48, 0.1) });   // a thin brass lip
  const group = new THREE.Group(); tunnel.add(group);
  let q = 0;
  for (const side of ['left', 'right']) {
    const zs = slots(block[side], W + 0.08, gap);
    const x = side === 'left' ? -TN.HW + 0.03 : TN.HW - 0.03, yaw = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    for (const z of zs) {
      const make = queue[q++ % queue.length];
      const p = new THREE.Group(); p.position.set(x, yc, z); p.rotation.y = yaw; group.add(p);
      const fr = new THREE.Mesh(frameGeo, frameM); fr.position.z = 0.025; p.add(fr);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.015, 0.06), lipM); lip.position.set(0, -Hh / 2 - 0.05, 0.03); p.add(lip);
      const ps = new THREE.Mesh(posterGeo, new THREE.MeshBasicMaterial({ map: make(), color: new THREE.Color(0.9, 0.9, 0.9) })); ps.position.z = 0.052; p.add(ps);
    }
  }
  return { group, mode };
}

/* ── full: poster panels covering both walls, floor to ceiling, joined edge to edge ── */
function buildFull(tunnel, stencils, queue) {
  for (const s of stencils) s.visible = false;
  const H = TN.HH - 0.02, PW = H * (600 / 840);           // a poster's natural width at full height
  const SEAM = 0.025;
  const open = {                                          // doorways (with their frames) stay open
    left: [[DOORS.gym[0] - 0.12, DOORS.gym[1] + 0.12], [DOORS.changing[0] - 0.12, DOORS.changing[1] + 0.12], [DOORS.store[0] - 0.12, DOORS.store[1] + 0.12]],
    right: [[DOORS.fame[0] - 0.12, DOORS.fame[1] + 0.12], [DOORS.in[0] - 0.12, DOORS.in[1] + 0.12]],
  };
  const Z0 = TN.ZM + 0.05, Z1 = TN.ZB - 0.05;
  const group = new THREE.Group(); tunnel.add(group);
  const seamM = new THREE.MeshBasicMaterial({ color: 0x0a0a0b });
  let q = 0;
  for (const side of ['left', 'right']) {
    // the wall's free runs between doorways
    const cuts = [...open[side]].sort((a, b) => a[0] - b[0]);
    const runs = []; let z = Z0;
    for (const [a, b] of cuts) { if (a > z) runs.push([z, a]); z = b; }
    if (z < Z1) runs.push([z, Z1]);
    const x = side === 'left' ? -TN.HW + 0.015 : TN.HW - 0.015, yaw = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    for (const [a, b] of runs) {
      const len = b - a, n = Math.max(1, Math.round(len / PW)), w = len / n;
      for (let i = 0; i < n; i++) {
        const tex = queue[q++ % queue.length]();
        // cover-crop the poster to this panel's shape, so nothing is stretched
        const pa = (w - SEAM) / H, ta = 600 / 840;
        if (pa > ta) { tex.repeat.set(1, ta / pa); tex.offset.set(0, (1 - ta / pa) / 2); }
        else { tex.repeat.set(pa / ta, 1); tex.offset.set((1 - pa / ta) / 2, 0); }
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w - SEAM, H), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.82, 0.82, 0.82) }));
        m.position.set(x, H / 2 + 0.01, a + w * (i + 0.5)); m.rotation.y = yaw; group.add(m);
        const s = new THREE.Mesh(new THREE.PlaneGeometry(SEAM, H), seamM);
        s.position.set(x * 0.9995, H / 2 + 0.01, a + w * i); s.rotation.y = yaw; group.add(s);
      }
    }
  }
  return { group, mode: 'full' };
}

/* ── mural (Ahmed, 2026-10-13: "one big generic poster with quotes"): each stretch of wall between doorways
   is a single printed poster, floor to ceiling, carrying one big line. Verified lines only (Ahmed, 2026-10-22):
   the club store's own campaign line, and plain facts about the club — nothing written in its voice, nothing
   attributed to a person. Sources: shop.ittihad.sa (the campaign); en.wikipedia.org/wiki/Al-Ittihad_Club_(Jeddah)
   and saudipedia.com (founded in Jeddah in 1927, the oldest Saudi club — the "1" on the crest —, "The Tigers",
   yellow and black); trophies.js for the titles (checked 2026-10-08). ── */
export const QUOTES = [
  { en: ['UNLEASH', 'THE TIGER.'], ar: 'النمور' },   // the club shop's own campaign line (shop.ittihad.sa, Ahmed's reference)
  { en: ['FOUNDED IN JEDDAH.', '1927.'], ar: 'الاتحاد · منذ 1927' },
  { en: ['SAUDI ARABIA\'S', 'OLDEST CLUB.'], ar: 'جدة · 1927' },
  { en: ['ASIAN CHAMPIONS.', '2004 · 2005.'], ar: 'دوري أبطال آسيا' },
  { en: ['YELLOW & BLACK.', 'SINCE 1927.'], ar: 'الأصفر والأسود' },
  { en: ['SAUDI CHAMPIONS.', '2022–23 · 2024–25.'], ar: 'الدوري السعودي' },
  { en: ['THE TIGERS.', 'AL-ITTIHAD.'], ar: 'النمور' },
  { en: ['KING\'S CUP.', '2025.'], ar: 'كأس الملك' },
];
// a set of claw scratches: groups of 3–4 torn, tapering marks raking diagonally down the wall
// big black tiger claw scratches (Ahmed): sets of 3–4 torn marks raking most of the wall's height, placed only
// where they don't touch text (keep: rectangles [x0, y0, x1, y1] to stay clear of)
function scratches(x, W, H, color, seed, keep = []) {
  let q = 9301 + seed * 49297; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  x.fillStyle = color;
  const M = H * 0.05;
  const hits = (b) => keep.some((k) => b[0] < k[2] + M && b[2] > k[0] - M && b[1] < k[3] + M && b[3] > k[1] - M);
  let gx = H * 0.06 + r() * H * 0.2;
  while (gx < W) {
    const n = 3 + (r() < 0.5 ? 1 : 0), ang = 1.12 + r() * 0.22, len = H * (0.62 + r() * 0.22);
    const gap = H * (0.085 + r() * 0.03), y0 = H * (0.04 + r() * 0.08);
    const ext = len * Math.cos(ang) + gap * (n - 1) + H * 0.08;
    const box = [gx, y0, gx + ext, Math.min(H - 40, y0 + len * Math.sin(ang) + gap * 0.5)];
    if (box[2] > W - H * 0.04) break;
    if (hits(box)) { gx += H * 0.08; continue; }
    for (let i = 0; i < n; i++) {
      const mid = Math.abs(i - (n - 1) / 2);
      const sx = gx + i * gap, sy = y0 + mid * gap * 0.4;   // the middle claws reach furthest
      const L = len * (1 - mid * 0.12), w = H * (0.04 + r() * 0.016);
      const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, bend = (r() - 0.5) * 0.22;
      const pts = 18, left = [], right = [];
      for (let j = 0; j <= pts; j++) {
        const t = j / pts, along = L * t, c = Math.sin(Math.PI * t) * bend * L * 0.2;
        const px = sx + dx * along + nx * c, py = sy + dy * along + ny * c;
        const th = w * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.2)), 0.55) * (0.8 + 0.4 * r());
        left.push([px + nx * th, py + ny * th]); right.push([px - nx * th * 0.55, py - ny * th * 0.55]);
      }
      x.beginPath(); left.forEach(([p, z], j) => (j ? x.lineTo(p, z) : x.moveTo(p, z))); right.reverse().forEach(([p, z]) => x.lineTo(p, z)); x.closePath(); x.fill();
    }
    gx = box[2] + H * (0.3 + r() * 0.5);
  }
}
// the faint tiger print behind everything: long wavy stripes a shade lighter than the black
function tigerPrint(x, W, H, seed) {
  let q = 4271 + seed * 7919; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  x.save(); x.fillStyle = 'rgba(255,255,255,0.055)';
  for (let i = 0, n = Math.round(W * H / 9000); i < n; i++) {
    const cx = r() * W, cy = r() * H, L = 120 + r() * 380, w = 10 + r() * 34, a = -0.55 + (r() - 0.5) * 0.6, wob = (r() - 0.5) * 0.6;
    x.save(); x.translate(cx, cy); x.rotate(a);
    x.beginPath(); x.moveTo(-L / 2, 0);
    x.bezierCurveTo(-L / 6, -w * (1 + wob), L / 6, -w * (0.6 - wob), L / 2, 0);
    x.bezierCurveTo(L / 6, w * 0.3, -L / 6, w * (0.5 + wob), -L / 2, 0);
    x.fill(); x.restore();
  }
  x.restore();
}
// type with a worn print: drawn on its own layer, then flecked away, as on the "Unleash the Tiger" poster
function grunge(x, W, H, draw, seed) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  draw(g);
  let q = 1597 + seed * 104729; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0, n = Math.round(W * H / 55); i < n; i++) { g.globalAlpha = 0.35 + r() * 0.65; const s2 = 0.8 + r() * 2.6; g.fillRect(r() * W, r() * H, s2, s2); }
  g.globalAlpha = 1;
  x.drawImage(c, 0, 0);
}
// torn paper of tiger fur coming in from both edges of a panel (the poster's sides)
function tornFur(x, W, H, seed) {
  let q = 2203 + seed * 6007; const r = () => ((q = (q * 16807) % 2147483647) / 2147483647);
  for (const side of [0, 1]) {
    const base = W * (0.035 + r() * 0.03), pts = [];
    for (let y = -10; y <= H + 10; y += 14) pts.push([base * (0.55 + r() * 0.9) + (r() < 0.12 ? r() * base * 0.8 : 0), y]);
    const X = (v) => (side ? W - v : v);
    x.save();
    x.beginPath(); x.moveTo(X(0), -10); pts.forEach(([v, y]) => x.lineTo(X(v), y)); x.lineTo(X(0), H + 10); x.closePath();
    x.fillStyle = '#d4a514'; x.fill();
    x.clip();
    x.fillStyle = '#111';
    for (let i = 0; i < 70; i++) { const cy = r() * H, cx = X(r() * base * 1.4), L = 40 + r() * 110, w = 4 + r() * 12;
      x.save(); x.translate(cx, cy); x.rotate(-0.9 + (r() - 0.5) * 0.7); x.beginPath(); x.moveTo(-L / 2, 0); x.quadraticCurveTo(0, -w, L / 2, 0); x.quadraticCurveTo(0, w * 0.3, -L / 2, 0); x.fill(); x.restore(); }
    x.restore();
    // the torn rim: a thin pale edge where the paper split
    x.strokeStyle = 'rgba(240,236,226,0.85)'; x.lineWidth = 3; x.beginPath(); pts.forEach(([v, y], i) => (i ? x.lineTo(X(v) + (side ? -2 : 2), y) : x.moveTo(X(v) + (side ? -2 : 2), y))); x.stroke();
  }
}
export function muralTex(q, aspect, crest, k, plain = false, light = false, simple = false, people = null) {
  const Hc = 768, Wc = Math.min(8192, Math.round(Hc * aspect));
  return canvas((x, W, H) => {
    // dark prints, or club-yellow ones (Ahmed: "too much black" — the walls alternate)
    // Ahmed (2026-10-15, from the club's own posts — "Unleash the Tiger", the team bus, the King's Cup card):
    // black walls with a faint tiger-stripe print, yellow claws, distressed white type, torn tiger-fur edges
    x.fillStyle = '#0b0b0c'; x.fillRect(0, 0, W, H);
    tigerPrint(x, W, H, k);
    // the simple line's layout first, so the scratches can keep clear of it
    let lay = null;
    if (simple && !plain && !people) {
      x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      const maxW = q.en.length === 1 ? 0.88 : 0.6;   // stacked lines leave room beside them for a set of scratches
      let sz = Math.round((H - 40) * (q.en.length === 1 ? 0.78 : 0.42)); x.font = `400 ${sz}px Anton`;
      while ((Math.max(...q.en.map((l) => x.measureText(l).width)) > W * maxW || sz * q.en.length * 0.95 > (H - 40) * 0.86) && sz > 40) { sz -= 4; x.font = `400 ${sz}px Anton`; }
      const tw = Math.max(...q.en.map((l) => x.measureText(l).width)), lh = sz * 0.95;
      const cx = q.en.length === 1 ? W / 2 : Math.max(tw / 2 + W * 0.05, W * 0.36);
      const y0 = (H - 40) / 2 - (lh * q.en.length) / 2 + sz * 0.82;
      lay = { sz, lh, cx, y0, box: [cx - tw / 2, y0 - sz * 0.82, cx + tw / 2, y0 + lh * (q.en.length - 1) + sz * 0.1] };
    }
    // big black tiger claw scratches (Ahmed), clear of any text; a band along the foot
    if (simple && !plain && !people) tornFur(x, W, H, k);
    scratches(x, W, H, 'rgba(242,196,24,0.92)', k, lay ? [lay.box] : []);
    x.fillStyle = '#050505'; x.fillRect(0, H - 40, W, 40); x.fillStyle = Y; x.fillRect(0, H - 40, W, 6);
    x.fillStyle = Y; x.font = '500 22px "JetBrains Mono"'; x.textBaseline = 'middle';
    if (!simple) { const tag = 'AL-ITTIHAD CLUB  ·  JEDDAH  ·  EST. 1927', tw = x.measureText(tag).width + 80; for (let xx = 30; xx < W; xx += tw) x.fillText(tag, xx, H - 20); }
    if (people) {
      const ph = (H - 40) * 0.97, pw = ph * (people.width / people.height);
      const px = (W - pw) / 2;
      x.drawImage(people, px, H - 40 - ph, pw, ph);
    }
    if (plain) return;   // stripes and the foot band only (no repeated crests)
    // the line, as big as the wall allows
    if (simple) {
      if (people) return;
      // the line, stacked and as big as the panel takes (Ahmed: fill the wall, no empty space)
      grunge(x, W, H, (g) => {
        g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = `400 ${lay.sz}px Anton`;
        q.en.forEach((l, i) => { g.fillStyle = i ? Y : '#f1efe9'; g.fillText(l, lay.cx, lay.y0 + lay.lh * i); });
      }, k);
      return;
    }
    const pad = Math.min(W * 0.06, 220), cw = crest ? H * 0.42 : 0;
    const textW = W - pad * 2 - (cw ? cw + pad : 0);
    let size = Math.round(H * 0.3);
    x.font = `400 ${size}px Anton`;
    const widest = () => Math.max(...q.en.map((l) => x.measureText(l).width));
    while (widest() > textW && size > 40) { size -= 4; x.font = `400 ${size}px Anton`; }
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    const lh = size * 0.98, top = H * 0.5 - (lh * q.en.length) / 2 - H * 0.05;
    q.en.forEach((l, i) => { x.fillStyle = light ? K : i === q.en.length - 1 ? Y : INK; x.fillText(l, pad, top + lh * (i + 1)); });
    if (!simple) { x.fillStyle = light ? 'rgba(17,18,19,0.72)' : 'rgba(244,241,232,0.7)'; x.font = `700 ${Math.round(size * 0.32)}px Cairo`; x.fillText(q.ar, pad, top + lh * q.en.length + size * 0.42); }
    if (crest) { const ch = cw * (554 / 494); x.globalAlpha = 0.95; x.drawImage(crest, W - pad - cw, (H - 40 - ch) / 2, cw, ch); x.globalAlpha = 1; }
  }, Wc, Hc);
}
function buildMural(tunnel, stencils, crest, trios = []) {
  for (const s of stencils) s.visible = false;
  const H = TN.HH - 0.02;
  const open = {
    left: [[DOORS.gym[0] - 0.04, DOORS.gym[1] + 0.04, 'THE GYM', 'صالة اللياقة'], [DOORS.changing[0] - 0.04, DOORS.changing[1] + 0.04, 'THE LOCKER ROOM', 'غرفة الملابس'], [DOORS.store[0] - 0.04, DOORS.store[1] + 0.04, 'THE CLUB STORE', 'متجر النادي']],
    right: [[DOORS.fame[0] - 0.04, DOORS.fame[1] + 0.04, 'HALL OF FAME', 'قاعة المشاهير'], [DOORS.in[0] - 0.04, DOORS.in[1] + 0.04, 'THE TROPHY ROOM', 'قاعة الكؤوس']],
  };
  const Z0 = TN.ZM + 0.05, Z1 = TN.ZB - 0.05;
  const group = new THREE.Group(); tunnel.add(group);
  let k = 0, tUsed = 0, qUsed = 0;
  // over each doorway: the same print, carrying the room's name
  for (const side of ['left', 'right']) {
    const x = side === 'left' ? -TN.HW + 0.015 : TN.HW - 0.015, yaw = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    for (const [a, b, en, ar] of open[side]) {
      const w = b - a, h = TN.HH - DOORS.h - 0.02;
      const t = canvas((x2, Wc, Hc) => {
        x2.fillStyle = '#0b0b0c'; x2.fillRect(0, 0, Wc, Hc); tigerPrint(x2, Wc, Hc, Math.round(a * 3));   // black, like the walls
        x2.textAlign = 'center'; const fs = fit(x2, en, Wc - 160, Hc * 0.36), tw2 = x2.measureText(en).width;
        scratches(x2, Wc, Hc, 'rgba(242,196,24,0.92)', a * 7, [[Wc / 2 - tw2 / 2, Hc * 0.6 - fs * 0.8, Wc / 2 + tw2 / 2, Hc * 0.6 + fs * 0.15]]);
        x2.fillStyle = Y; x2.fillRect(0, Hc - 16, Wc, 16);
        grunge(x2, Wc, Hc, (g) => { g.textAlign = 'center'; g.fillStyle = '#f1efe9'; g.font = `400 ${fs}px Anton`; g.fillText(en, Wc / 2, Hc * 0.6); }, Math.round(a));

      }, Math.round(1024 * (w / h) / 2) * 2 > 2048 ? 2048 : Math.round(512 * (w / h)), 512);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.85, 0.85, 0.85) }));
      m.position.set(x, DOORS.h + h / 2 + 0.01, (a + b) / 2); m.rotation.y = yaw; group.add(m);
    }
  }
  for (const side of ['left', 'right']) {
    const runs = []; let z = Z0;
    for (const [a, b] of [...open[side]].sort((p, q) => p[0] - q[0]).map((o) => o.slice(0, 2))) { if (a > z) runs.push([z, a]); z = b; }
    if (z < Z1) runs.push([z, Z1]);
    const x = side === 'left' ? -TN.HW + 0.015 : TN.HW - 0.015, yaw = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    for (const [a, b] of runs) {
      // panels of ~6.5 m, seamless, alternating a big trio of players and a big slogan (Ahmed: fill the walls)
      const n = Math.max(1, Math.round((b - a) / 6.5)), len = (b - a) / n;
      for (let i = 0; i < n; i++) {
        const people = k % 2 === 0 && tUsed < trios.length ? trios[tUsed++] : null;
        const q = people ? QUOTES[0] : QUOTES[(qUsed++) % QUOTES.length];   // each slogan once (while they last)
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len + 0.002, H), new THREE.MeshBasicMaterial({ map: muralTex(q, len / H, null, k, false, true, true, people), color: new THREE.Color(0.85, 0.85, 0.85) }));
        m.position.set(x, H / 2 + 0.01, a + len * (i + 0.5)); m.rotation.y = yaw; group.add(m);
        k++;
      }
    }
  }
  // (ceiling panels removed: the tunnel top stays the grey concrete — Ahmed: no black up there)
  return { group, mode: 'mural' };
}
