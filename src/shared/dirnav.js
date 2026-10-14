// Prototype control: a slim vertical bar on the right edge for hopping between the landing directions.
// Every page calls mountDirNav('<key>'). It brings its own styles so pages can't break it.
const DIRS = [
  { key: 'v1', href: '/', label: 'v1', name: 'Original' },
  { key: 'seats', href: '/seats.html', label: 'A', name: 'Every Seat' },
  { key: 'tifo', href: '/tifo.html', label: 'B', name: 'Tifo' },
  { key: 'liquid', href: '/liquid.html', label: 'C', name: 'Liquid' },
  { key: 'deck', href: '/deck.html', label: 'D', name: 'Matchday Deck' },
  { key: 'broadcast', href: '/broadcast.html', label: 'E', name: 'Broadcast' },
  { key: 'tunnel', href: '/tunnel.html', label: 'F', name: 'Tunnel' },
];

const CSS = `
.dirnav{position:fixed;right:10px;top:50%;transform:translateY(-50%);z-index:96;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:1px solid rgba(244,241,232,.14);border-radius:4px;background:rgba(10,10,10,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font:500 11px/1 'JetBrains Mono',ui-monospace,monospace;color:rgba(244,241,232,.6)}
.dirnav b{font-weight:500;letter-spacing:.14em;text-transform:uppercase;font-size:9px;writing-mode:vertical-rl;rotate:180deg;padding:6px 0 8px}
.dirnav a{position:relative;display:grid;place-items:center;width:26px;height:26px;border-radius:2px;color:inherit;text-decoration:none;transition:background .25s,color .25s}
.dirnav a:hover{color:#f4f1e8;background:rgba(244,241,232,.08)}
.dirnav a.is-on{background:#fef201;color:#0a0a0a}
.dirnav a::after{content:attr(data-name);position:absolute;right:calc(100% + 10px);top:50%;white-space:nowrap;padding:6px 8px;border-radius:3px;background:#fef201;color:#0a0a0a;opacity:0;transform:translate(4px,-50%);pointer-events:none;transition:opacity .2s,transform .2s}
.dirnav a:hover::after{opacity:1;transform:translate(0,-50%)}
@media (max-width:720px){.dirnav{right:4px;padding:3px}.dirnav b{display:none}.dirnav a{width:22px;height:22px;font-size:10px}}
`;

export function mountDirNav(current) {
  if (document.querySelector('.dirnav')) return;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const nav = document.createElement('nav');
  nav.className = 'dirnav';
  nav.setAttribute('aria-label', 'Design directions');
  nav.innerHTML = `<b>Direction</b>${DIRS.map((d) => `<a href="${d.href}${location.search.includes('skip') ? '?skip=1' : ''}" data-name="${d.label} · ${d.name}" class="${d.key === current ? 'is-on' : ''}"${d.key === current ? ' aria-current="page"' : ''}>${d.label}</a>`).join('')}`;
  document.body.append(nav);
  // ?shot hides it for clean screenshots
  if (new URLSearchParams(location.search).has('shot')) nav.style.display = 'none';
  return nav;
}
