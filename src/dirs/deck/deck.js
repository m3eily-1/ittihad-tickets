// The hero deck: a stack of collectible match tickets. Drag the top card — it tilts with drag
// velocity; fling it past the threshold and it is thrown off-screen with inertia, then re-tucks
// at the back of the deck (endless). A short drag springs back. Arrow keys / buttons cycle,
// double-click or F flips the top card to its tier price list.
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { $, $$, fine, reduced } from '../../ui.js';
import { DECK, cardHTML } from './cards.js';

gsap.registerPlugin(Draggable, InertiaPlugin);

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createDeck(root, { onChange = () => {} } = {}) {
  const n = DECK.length;
  root.innerHTML = DECK.map((c, i) => cardHTML(c, i, n)).join('');
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const S = $$('.slot', root).map((el, i) => ({
    el, i, c: DECK[i],
    card: $('.card', el), flip: $('.card__flip', el), shadow: $('.slot__shadow', el), dims: $$('.face__dim', el),
    flipped: false, flying: false, drag: null,
  }));
  let order = S.slice(); // order[0] is the top card
  let active = true, interacted = false, dragging = false;
  const W = () => root.offsetWidth || 300;

  // fanned resting pose for depth i
  const pose = (i) => {
    const w = W();
    return { x: i * w * 0.075, y: -i * w * 0.03, rotation: i * 3.6, scale: 1 - i * 0.05 };
  };

  function setFlip(s, on, instant = false) {
    s.flipped = on;
    s.el.classList.toggle('is-flipped', on);
    gsap.to(s.flip, { rotationY: on ? 180 : 0, duration: instant ? 0 : 1.05, ease: 'expo.out', overwrite: 'auto' });
    if (!instant && s === order[0]) {
      gsap.fromTo(s.card, { z: 0 }, { z: 60, duration: 0.32, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: false });
    }
    if (s === order[0]) emit();
  }

  function emit() {
    const s = order[0];
    onChange({ index: s.i, card: s.c, flipped: s.flipped, depth: order.map((o) => o.i) });
  }

  function layout(animate = true) {
    order.forEach((s, i) => {
      s.el.classList.toggle('is-top', i === 0);
      s.el.setAttribute('aria-hidden', String(i !== 0));
      s.el.inert = i !== 0;
      if (s.flying) return;
      s.el.style.zIndex = String(n - i + 1);
      gsap.to(s.el, { ...pose(i), autoAlpha: 1, duration: animate ? 0.95 : 0, ease: 'expo.out', overwrite: 'auto' });
      gsap.to(s.dims, { opacity: Math.min(i * 0.17, 0.6), duration: animate ? 0.6 : 0, overwrite: 'auto' });
      if (i !== 0) gsap.to(s.card, { rotationX: 0, rotationY: 0, duration: animate ? 0.6 : 0, overwrite: 'auto' });
    });
    S.forEach((s) => s.drag && (s === order[0] && !s.flying ? s.drag.enable() : s.drag.disable()));
  }

  // ── throw the top card off-screen, it comes back in behind the deck
  function fling(s, vx, vy, dx = 0, dy = 0) {
    if (s.flying || order[0] !== s) return;
    interacted = true;
    const speed = Math.hypot(vx, vy);
    let ux, uy;
    if (speed > 350) { ux = vx / speed; uy = vy / speed; } else { const d = Math.hypot(dx, dy) || 1; ux = dx / d; uy = dy / d; }
    if (Math.abs(ux) < 0.25 && Math.abs(uy) < 0.25) ux = -1;
    const off = Math.max(innerWidth, 900) + W() * 1.4;
    const endX = gsap.getProperty(s.el, 'x') + ux * off;
    const endY = gsap.getProperty(s.el, 'y') + uy * off * 0.7;
    const v = Math.max(speed, 2200);

    order = order.filter((o) => o !== s);
    order.push(s);
    s.flying = true;
    s.el.style.zIndex = String(n + 5);
    s.drag?.disable();
    layout();
    emit();

    const dur = reduced() ? 0.35 : 0.75;
    gsap.killTweensOf(s.el, 'x,y,rotation');
    gsap.to(s.el, {
      inertia: { x: { velocity: ux * v, end: endX }, y: { velocity: uy * v, end: endY }, duration: { min: 0.3, max: dur } },
      onComplete: () => tuck(s),
    });
    gsap.to(s.el, { rotation: gsap.getProperty(s.el, 'rotation') + ux * 38 + uy * 10, scale: 1, duration: dur, ease: 'power2.out' });
    gsap.to(s.card, { rotationY: ux * 55, rotationX: -uy * 30, duration: dur, ease: 'power2.out', overwrite: 'auto' });
  }

  function tuck(s) {
    s.flying = false;
    const idx = order.indexOf(s);
    if (idx === 0) return layout(); // pulled back to the top while flying
    const p = pose(idx);
    const w = W();
    s.el.style.zIndex = String(n - idx + 1);
    if (s.flipped) setFlip(s, false, true);
    gsap.set(s.card, { rotationX: 0, rotationY: 0, z: 0 });
    gsap.set(s.dims, { opacity: Math.min(idx * 0.17, 0.6) });
    gsap.fromTo(s.el,
      { x: p.x + w * 0.18, y: p.y - w * 0.62, rotation: p.rotation + 14, scale: p.scale * 0.94, autoAlpha: 0 },
      { ...p, autoAlpha: 1, duration: reduced() ? 0.3 : 1.05, ease: 'expo.out', overwrite: 'auto' });
  }

  function springBack(s) {
    gsap.to(s.el, { ...pose(0), duration: 1.1, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' });
    gsap.to(s.card, { rotationX: 0, rotationY: 0, duration: 1.1, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
  }

  const next = () => { const s = order[0]; if (!s.flying) fling(s, -2600, -260); };
  function prev() {
    interacted = true;
    const s = order[order.length - 1];
    gsap.killTweensOf([s.el, s.card]);
    s.flying = false;
    order = [s, ...order.slice(0, -1)];
    if (s.flipped) setFlip(s, false, true);
    const w = W();
    gsap.set(s.el, { x: -Math.max(innerWidth * 0.55, w * 1.6), y: -w * 0.1, rotation: -26, scale: 1, autoAlpha: 1 });
    gsap.set(s.card, { rotationY: -50, rotationX: 0, z: 0 });
    gsap.set(s.dims, { opacity: 0 });
    gsap.to(s.card, { rotationY: 0, duration: 1.1, ease: 'expo.out' });
    layout();
    emit();
  }
  // bring card i to the top by riffling through the ones above it
  function goTo(i) {
    const k = order.findIndex((s) => s.i === i);
    if (k <= 0) { if (k === 0) gsap.fromTo(order[0].el, { y: -14 }, { y: 0, duration: 0.8, ease: 'elastic.out(1,0.4)' }); return; }
    if (k > n / 2) { for (let j = 0; j < n - k; j++) gsap.delayedCall(j * 0.12, prev); return; }
    for (let j = 0; j < k; j++) gsap.delayedCall(j * 0.12, next);
  }
  const flipTop = () => { interacted = true; setFlip(order[0], !order[0].flipped); };

  // ── dragging
  S.forEach((s) => {
    InertiaPlugin.track(s.el, 'x,y');
    s.drag = Draggable.create(s.el, {
      type: touch ? 'x' : 'x,y',
      allowNativeTouchScrolling: touch,
      zIndexBoost: false,
      minimumMovement: 3,
      onPress() {
        if (order[0] !== s) return;
        dragging = true;
        root.classList.add('is-grab');
        gsap.killTweensOf(s.el, 'scale');
        gsap.to(s.el, { scale: 1.035, duration: 0.35, ease: 'power3' });
      },
      onDrag() {
        interacted = true;
        const vx = InertiaPlugin.getVelocity(s.el, 'x');
        const dx = this.x, dy = this.y;
        gsap.to(s.el, { rotation: clamp(dx * 0.045 + vx * 0.0035, -30, 30), duration: 0.45, ease: 'power3', overwrite: 'auto' });
        gsap.to(s.card, { rotationY: clamp(dx * 0.07 + vx * 0.004, -38, 38), rotationX: clamp(-dy * 0.06, -22, 22), duration: 0.45, ease: 'power3', overwrite: 'auto' });
      },
      onRelease() {
        dragging = false;
        root.classList.remove('is-grab');
        if (order[0] !== s || s.flying) return;
        const vx = InertiaPlugin.getVelocity(s.el, 'x'), vy = touch ? 0 : InertiaPlugin.getVelocity(s.el, 'y');
        const dx = this.x, dy = this.y, w = W();
        const dist = Math.hypot(dx, dy), speed = Math.hypot(vx, vy);
        if (dist > w * 0.42 || (speed > 650 && dist > w * 0.07)) fling(s, vx, vy, dx, dy);
        else springBack(s);
      },
    })[0];
    s.el.addEventListener('dblclick', (e) => { if (order[0] === s && !e.target.closest('a')) flipTop(); });
  });

  // ── hover tilt on the top card
  const stage = root.parentElement;
  const onMove = (e) => {
    if (dragging || !fine() || e.pointerType !== 'mouse') return;
    const s = order[0];
    if (s.flying) return;
    const r = root.getBoundingClientRect();
    const nx = clamp((e.clientX - (r.left + r.width / 2)) / r.width, -1, 1);
    const ny = clamp((e.clientY - (r.top + r.height / 2)) / r.height, -1, 1);
    gsap.to(s.card, { rotationY: nx * 16, rotationX: -ny * 12, duration: 0.7, ease: 'power3', overwrite: 'auto' });
  };
  const onLeave = () => { if (!dragging && !order[0].flying) gsap.to(order[0].card, { rotationX: 0, rotationY: 0, duration: 1, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' }); };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);

  // ── specular sheen + shadow follow the tilt (top two cards only, and only while on-screen)
  const tick = () => {
    if (!active) return;
    for (let k = 0; k < Math.min(2, order.length); k++) {
      const s = order[k];
      const ry = gsap.getProperty(s.card, 'rotationY') % 360, rx = gsap.getProperty(s.card, 'rotationX');
      const rot = gsap.getProperty(s.el, 'rotation');
      const sc = gsap.getProperty(s.el, 'scale');
      s.card.style.setProperty('--sx', (50 + ry * 1.7 + rot * 0.9).toFixed(1));
      s.card.style.setProperty('--sy', (50 - rx * 2).toFixed(1));
      const lift = (sc - 1) * 600;
      s.shadow.style.transform = `translate3d(${(-ry * 0.9 + 8).toFixed(1)}px, ${(18 + lift + Math.abs(rx) * 0.4).toFixed(1)}px, 0) scale(${(1 + lift * 0.004).toFixed(3)})`;
      s.shadow.style.opacity = (0.85 - lift * 0.01).toFixed(2);
    }
  };
  gsap.ticker.add(tick);

  // ── keyboard + buttons
  const onKey = (e) => {
    if (!active || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    else if ((e.key === 'f' || e.key === 'F') || (e.target === root && (e.key === 'Enter' || e.key === ' '))) { e.preventDefault(); flipTop(); }
  };
  document.addEventListener('keydown', onKey);

  const onResize = () => layout(false);
  addEventListener('resize', onResize);

  // deal-in intro: back cards land first, the top card last
  function intro({ hint = true } = {}) {
    const tl = gsap.timeline();
    const backFirst = order.slice().reverse();
    backFirst.forEach((s, k) => {
      const i = order.indexOf(s);
      tl.fromTo(s.el,
        { x: pose(i).x + (k % 2 ? 1 : -1) * W() * 0.5, y: innerHeight * 0.9, rotation: (k % 2 ? 1 : -1) * (24 + k * 6), scale: 1.08, autoAlpha: 0 },
        { ...pose(i), autoAlpha: 1, duration: 1.15, ease: 'expo.out', immediateRender: true }, k * 0.13);
    });
    // a hint that the top card can be pulled
    if (hint && !reduced() && fine()) {
      tl.add(() => {
        if (interacted) return;
        const s = order[0];
        gsap.timeline()
          .to(s.el, { x: -W() * 0.16, rotation: -5, duration: 0.55, ease: 'power3.out' })
          .to(s.card, { rotationY: -14, duration: 0.55, ease: 'power3.out' }, 0)
          .to(s.el, { x: 0, rotation: 0, duration: 1, ease: 'elastic.out(1, 0.45)' })
          .to(s.card, { rotationY: 0, duration: 1, ease: 'elastic.out(1, 0.45)' }, '<');
      }, '+=0.6');
    }
    return tl;
  }

  layout(false);
  emit();

  return {
    next, prev, goTo, flip: flipTop, intro,
    top: () => order[0],
    setActive(v) { active = v; },
    destroy() {
      gsap.ticker.remove(tick);
      document.removeEventListener('keydown', onKey);
      removeEventListener('resize', onResize);
      S.forEach((s) => { s.drag?.kill(); InertiaPlugin.untrack(s.el); });
    },
  };
}
