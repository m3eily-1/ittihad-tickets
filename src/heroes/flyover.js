// Hero D — top-down over the bowl (the club's own aerial of Alinma Stadium). Scrolling dives
// the camera into the pitch; a colour lens follows the cursor over the graded photo.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, fine, reduced } from '../ui.js';

export function createFlyover(root) {
  const img = $('.js-flyover-img', root);
  const lens = $('.js-flyover-lens', root);
  const rings = $('.hvo__rings', root);
  const left = $('.hvo__l', root), right = $('.hvo__r', root);
  const end = $('.hvo__end', root);
  const hint = $('.hvo__hint', root);
  const state = { scale: 1, r: 0 };

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to([img, lens], { scale: 3.3, rotation: 14, duration: 1 }, 0)
    .to(state, { scale: 3.3, duration: 1 }, 0)
    .to(rings, { scale: 2.6, opacity: 0, duration: 0.6 }, 0)
    .to(left, { xPercent: -80, opacity: 0, duration: 0.5 }, 0.05)
    .to(right, { xPercent: 80, opacity: 0, duration: 0.5 }, 0.05)
    .to($('.hvo__copy .kicker', root), { opacity: 0, duration: 0.2 }, 0)
    .to(hint, { opacity: 0, duration: 0.1 }, 0)
    .fromTo(end, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' }, 0.72);

  const st = ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: () => `+=${innerHeight * 1.6}`,
    pin: true,
    refreshPriority: 1, // pinned before the sections below measure themselves
    scrub: reduced() ? true : 0.8,
    animation: tl,
  });

  // colour lens
  const rTo = gsap.quickTo(state, 'r', { duration: 0.5, ease: 'power3' });
  const onMove = (e) => {
    if (!fine()) return;
    const b = img.getBoundingClientRect();
    // the lens shares the image's transform, so map the pointer into its unscaled box
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const a = (-gsap.getProperty(img, 'rotation') * Math.PI) / 180;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / state.scale + img.offsetWidth / 2;
    const ly = (dx * Math.sin(a) + dy * Math.cos(a)) / state.scale + img.offsetHeight / 2;
    lens.style.setProperty('--x', `${lx}px`);
    lens.style.setProperty('--y', `${ly}px`);
    rTo(e.target.closest('a, button, .switch') ? 0 : 150);
  };
  const onLeave = () => rTo(0);
  const paint = () => lens.style.setProperty('--r', `${state.r / state.scale}px`);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);
  gsap.ticker.add(paint);

  return {
    intro() {
      const t = gsap.timeline({ defaults: { ease: 'expo.out' } });
      t.from(img, { scale: 1.5, filter: 'grayscale(1) brightness(0.2) blur(12px)', duration: 2.4 }, 0)
        .from(rings, { scale: 0.4, opacity: 0, duration: 2 }, 0.3)
        .from($$('.kicker', root), { autoAlpha: 0, y: 16, duration: 1 }, 0.6)
        .from($$('.hvo__title .w > i', root), { yPercent: 115, duration: 1.4, stagger: 0.06 }, 0.7)
        .from(hint, { autoAlpha: 0, duration: 1 }, 1.4);
      return t;
    },
    destroy() {
      st.kill(true);
      tl.kill();
      gsap.ticker.remove(paint);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      gsap.set([img, lens, rings, left, right, end, hint, $('.hvo__copy .kicker', root)], { clearProps: 'all' });
    },
  };
}
