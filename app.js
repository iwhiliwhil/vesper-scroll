(() => {
  const FRAMES = 120;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const M = reduce ? 0 : 1;
  const vh = () => innerHeight;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- frame sequence ---------- */
  const seq = $('#seq');
  const sctx = seq.getContext('2d');
  const imgs = new Array(FRAMES);
  const ok = new Uint8Array(FRAMES);
  let want = 0;
  let shown = -1;
  const url = i => 'frames/' + String(i + 1).padStart(4, '0') + '.webp';

  function nearest(i) {
    if (ok[i]) return i;
    for (let d = 1; d < FRAMES; d++) {
      if (i - d >= 0 && ok[i - d]) return i - d;
      if (i + d < FRAMES && ok[i + d]) return i + d;
    }
    return -1;
  }
  function paint() {
    const j = nearest(want);
    if (j < 0 || j === shown) return;
    sctx.clearRect(0, 0, seq.width, seq.height);
    sctx.drawImage(imgs[j], 0, 0, seq.width, seq.height);
    shown = j;
    seq.classList.add('ready');
  }
  function setFrame(f) {
    want = Math.max(0, Math.min(FRAMES - 1, Math.round(f)));
    paint();
  }
  const order = [];
  [8, 4, 2, 1].forEach(step => {
    for (let i = 0; i < FRAMES; i += step) if (!order.includes(i)) order.push(i);
  });
  order.forEach(i => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { ok[i] = 1; paint(); };
    im.src = url(i);
    imgs[i] = im;
  });

  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger, SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', ScrollTrigger.update);
  }
  gsap.ticker.lagSmoothing(0);

  const lines = el => SplitText.create(el, { type: 'lines', linesClass: 'ln' }).lines;
  const each = (tl, els, at, gap, from, dur = 1) => {
    gsap.utils.toArray(els).forEach((el, i) => {
      const to = {};
      for (const k in from) to[k] = k === 'scaleX' ? (parseFloat(getComputedStyle(el).getPropertyValue('--w')) || 1) : (k === 'opacity' ? 1 : 0);
      tl.fromTo(el, from, Object.assign(to, { duration: dur, ease: 'none' }), at + i * gap);
    });
    return tl;
  };
  let introDone = false;
  let bgTriggers = [];

  /* ---------- scenes ---------- */
  function hero() {
    const chars = SplitText.create('.hero-title', { type: 'chars', charsClass: 'ch' }).chars;
    const sub = lines('.hero-sub');
    if (!introDone) {
      introDone = true;
      gsap.from(chars, { y: 80 * M, opacity: 0, stagger: 0.07, duration: 1.4, ease: 'power3.out', delay: 0.15 });
      gsap.from(sub, { y: 24 * M, opacity: 0, duration: 1.2, ease: 'power3.out', delay: 0.75 });
    }

    gsap.set(['.seq-wrap', '.hero-logo'], { xPercent: -50, yPercent: -50 });
    const frame = { f: 0 };
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: () => '+=' + vh() * 4.4,
        pin: true,
        scrub: true,
        invalidateOnRefresh: true
      }
    });
    tl.fromTo('.hero-title', { scale: 1, y: 0 }, { scale: 0.26, y: () => -vh() * 0.38, duration: 2.4, ease: 'power2.inOut' }, 0)
      .fromTo('.hero-sub', { opacity: 1, y: 0 }, { opacity: 0, y: -24 * M, duration: 0.7 }, 0)
      .fromTo('.hero-logo', { opacity: 0, scale: reduce ? 1 : 0.84 }, { opacity: 1, scale: 1, duration: 1, ease: 'power1.out' }, 0)
      .fromTo('.hero-glow', { opacity: 0, scale: reduce ? 1 : 0.6 }, { opacity: 1, scale: 1, duration: 1.2 }, 0)
      .to('.hero-logo', { opacity: 0, scale: reduce ? 1 : 0.42, y: () => vh() * 0.04 * M, duration: 1.2, ease: 'power2.in' }, 1.2)
      .to('.hero-glow', { opacity: 0.35, scale: reduce ? 1 : 1.2, duration: 1.6 }, 1.2)
      .fromTo('.seq-wrap', { y: () => vh() * 0.58 * M, scale: reduce ? 1 : 0.82 }, { y: 0, scale: 1, duration: 2.4, ease: 'power2.inOut' }, 0)
      .to('.hero-title', { opacity: 0, duration: 0.6 }, 2.3)
      .to(frame, { f: FRAMES - 1, duration: 7, onUpdate: () => setFrame(frame.f) }, 1.9)
      .to('.seq-wrap', { scale: reduce ? 1 : 0.9, duration: 0.8 }, 8.9);

    $$('.cap').forEach((c, i) => {
      const t = 3 + i * 2.2;
      tl.fromTo(c, { opacity: 0, y: 40 * M }, { opacity: 1, y: 0, duration: 0.6 }, t)
        .to(c, { opacity: 0, y: -40 * M, duration: 0.6 }, t + 1.5);
    });
  }

  function manifest() {
    const words = SplitText.create('.manifest-text', { type: 'words', wordsClass: 'w' }).words;
    const para = $('.manifest-text');
    const pw = para.clientWidth, ph = para.clientHeight;
    words.forEach(w => {
      w.style.backgroundSize = pw + 'px ' + ph + 'px';
      w.style.backgroundPosition = (-w.offsetLeft) + 'px ' + (-w.offsetTop) + 'px';
    });
    const pin = ScrollTrigger.create({ trigger: '#manifest', start: 'top top', end: () => '+=' + vh() * 1.8, pin: true });
    gsap.timeline({ scrollTrigger: { trigger: '#manifest', start: 'top 65%', end: () => pin.end - vh() * 0.35, scrub: true } })
      .fromTo(words, { opacity: 0.16 }, { opacity: 1, stagger: 0.12, duration: 0.4, ease: 'none' });
    gsap.fromTo('.manifest-text',
      { y: () => vh() * 0.12 * M, scale: reduce ? 1 : 0.96 },
      { y: () => -vh() * 0.06 * M, scale: 1, ease: 'none',
        scrollTrigger: { trigger: '#manifest', start: 'top bottom', end: () => pin.end, scrub: true, invalidateOnRefresh: true } });
  }

  function numbers() {
    $$('#numbers [data-speed]').forEach(el => {
      const s = parseFloat(el.dataset.speed);
      gsap.fromTo(el, { y: () => vh() * 0.22 * s * M }, {
        y: () => -vh() * 0.22 * s * M, ease: 'none',
        scrollTrigger: { trigger: '#numbers', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
      });
    });
    each(gsap.timeline({ scrollTrigger: { trigger: '#numbers', start: 'top 85%', end: 'top 30%', scrub: true } }),
      lines('.numbers-title'), 0, 0.2, { y: 60 * M, opacity: 0 });
    $$('#numbers [data-count]').forEach(el => {
      const o = { v: 0 };
      const n = parseInt(el.dataset.count, 10);
      gsap.to(o, {
        v: n, ease: 'power1.out',
        onUpdate: () => { el.textContent = Math.round(o.v); },
        scrollTrigger: { trigger: el.closest('.stat'), start: 'top 92%', end: 'top 40%', scrub: true }
      });
    });
    $$('.stat-label').forEach(el => {
      gsap.fromTo(el, { opacity: 0, y: 30 * M }, {
        opacity: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: el.closest('.stat'), start: 'top 85%', end: 'top 50%', scrub: true }
      });
    });
  }

  function how() {
    const pin = ScrollTrigger.create({ trigger: '#how', start: 'top top', end: () => '+=' + vh() * 3.6, pin: true });
    const texts = $$('.how-text');
    const scr = $$('.scr');
    gsap.set(texts.slice(1), { opacity: 0, y: 50 * M });
    gsap.set(scr.slice(1), { yPercent: 100 });

    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#how', start: 'top bottom', end: 'top top', scrub: true } })
      .fromTo('.device',
        { y: () => vh() * 0.4 * M, rotationX: 24 * M, rotationY: -18 * M, scale: reduce ? 1 : 0.86 },
        { y: 0, rotationX: 0, rotationY: -6 * M, scale: 1 }, 0)
      .fromTo(texts[0], { opacity: 0, y: 60 * M }, { opacity: 1, y: 0 }, 0.35)
      .fromTo('.how-steps', { opacity: 0 }, { opacity: 1 }, 0.35);

    const pct = $('.m-pct');
    const p = { v: 0 };
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#how', start: 'top top', end: () => pin.end, scrub: true } });
    tl.fromTo('.device', { rotationY: -6 * M }, { rotationY: 6 * M, duration: 9, immediateRender: false }, 0)
      .fromTo('.how-fill', { scaleX: 0 }, { scaleX: 1, duration: 9 }, 0)
      .fromTo('.bar-fill', { scaleX: 0.3 }, { scaleX: 0.55, duration: 1.8 }, 0.3)
      .fromTo('.opt-glow', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0.9)

      .fromTo(texts[0], { opacity: 1, y: 0 }, { opacity: 0, y: -50 * M, duration: 0.5, immediateRender: false }, 2.4)
      .fromTo(texts[1], { opacity: 0, y: 50 * M }, { opacity: 1, y: 0, duration: 0.6, immediateRender: false }, 2.95)
      .fromTo(scr[0], { yPercent: 0 }, { yPercent: -100, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, 2.5)
      .fromTo(scr[1], { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, 2.5)
      .fromTo('.glyph-spin', { rotation: 0 }, { rotation: 200, duration: 3 }, 3)
      .fromTo('.glyph-spin2', { rotation: 0 }, { rotation: -140, duration: 3 }, 3)

      .fromTo(texts[1], { opacity: 1, y: 0 }, { opacity: 0, y: -50 * M, duration: 0.5, immediateRender: false }, 5.4)
      .fromTo(texts[2], { opacity: 0, y: 50 * M }, { opacity: 1, y: 0, duration: 0.6, immediateRender: false }, 5.95)
      .fromTo(scr[1], { yPercent: 0 }, { yPercent: -100, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, 5.5)
      .fromTo(scr[2], { yPercent: 100 }, { yPercent: 0, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, 5.5)
      .to(p, { v: 92, duration: 1.6, onUpdate: () => { pct.textContent = Math.round(p.v); } }, 6.2)
      .to({}, { duration: 0.6 }, 8.4);
    each(tl, '.t-traits i', 3.5, 0.25, { scaleX: 0 });
    each(tl, '.m-chips span', 6.8, 0.25, { opacity: 0, y: 20 * M }, 0.6);
  }

  function reveal() {
    const small = () => innerWidth < 860
      ? 'inset(30% 10% 24% 10% round 24px)'
      : 'inset(32% 33% 14% 33% round 28px)';
    const pin = ScrollTrigger.create({ trigger: '#reveal', start: 'top top', end: () => '+=' + vh() * 2.6, pin: true });
    const head = lines('.reveal-copy h2');

    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#reveal', start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true } })
      .fromTo('.reveal-lead', { y: 80 * M, opacity: 0 }, { y: 0, opacity: 1 }, 0)
      .fromTo('.reveal-frame', { clipPath: small, y: () => vh() * 0.2 * M }, { clipPath: small, y: 0 }, 0)
      .fromTo('.reveal-img', { scale: reduce ? 1 : 1.5 }, { scale: reduce ? 1 : 1.35 }, 0);

    const rtl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#reveal', start: 'top top', end: () => pin.end, scrub: true, invalidateOnRefresh: true } });
    head.forEach((ln, i) => rtl.fromTo(ln, { y: 60 * M, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'none' }, 3.1 + i * 0.2));
    rtl
      .fromTo('.reveal-lead', { opacity: 1, y: 0 }, { opacity: 0, y: -60 * M, duration: 1, immediateRender: false }, 0)
      .fromTo('.reveal-frame', { clipPath: small }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 3, ease: 'power2.inOut', immediateRender: false }, 0)
      .fromTo('.reveal-img', { scale: reduce ? 1 : 1.35 }, { scale: 1, duration: 3.4, ease: 'power2.out', immediateRender: false }, 0)
      .fromTo('.reveal-shade', { opacity: 0 }, { opacity: 1, duration: 1.2 }, 2.4)
      .fromTo('.reveal-copy p', { y: 40 * M, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, 3.6)
      .fromTo('.reveal-img', { scale: 1 }, { scale: reduce ? 1 : 1.08, duration: 3, immediateRender: false }, 3.4);
  }

  function cards() {
    const track = $('.track');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const head = lines('.cards-head h2');

    gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#cards', start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true } })
      .fromTo(track, { x: () => innerWidth * 0.3 * M }, { x: 0 }, 0);
    each(gsap.timeline({ scrollTrigger: { trigger: '#cards', start: 'top bottom', end: 'top 25%', scrub: true } }), head, 0, 0.15, { y: 60 * M, opacity: 0 });

    const tween = gsap.fromTo(track, { x: 0 }, {
      x: () => -dist(),
      ease: 'none',
      immediateRender: false,
      scrollTrigger: {
        trigger: '#cards',
        start: 'top top',
        end: () => '+=' + (dist() + vh() * 0.4),
        pin: true,
        scrub: true,
        invalidateOnRefresh: true
      }
    });

    $$('.card').forEach(card => {
      gsap.fromTo(card.querySelector('.card-art'), { x: 50 * M }, {
        x: -50 * M, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
      });
    });
  }

  function final() {
    const pin = ScrollTrigger.create({ trigger: '#final', start: 'top top', end: () => '+=' + vh() * 1.4, pin: true });
    const l = lines('.final-line');
    const ftl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#final', start: 'top bottom', end: () => pin.end, scrub: true, invalidateOnRefresh: true } });
    ftl
      .fromTo('.final-glow', { scale: reduce ? 1 : 0.3, opacity: 0 }, { scale: 1, opacity: 0.55, duration: 1.6 }, 0)
      .fromTo('.final-warm', { x: () => -innerWidth * 0.32 * M, rotation: -10 * M, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: 2, ease: 'power2.out' }, 0.1)
      .fromTo('.final-cool', { x: () => innerWidth * 0.32 * M, rotation: 10 * M, opacity: 0 }, { x: 0, rotation: 0, opacity: 1, duration: 2, ease: 'power2.out' }, 0.1)
      .fromTo('.final-glow', { scale: 1, opacity: 0.55 }, { scale: reduce ? 1 : 1.35, opacity: 1, duration: 0.6, ease: 'power2.out', immediateRender: false }, 2.0)
      .fromTo('.final-logo', { scale: 1 }, { scale: reduce ? 1 : 1.06, duration: 0.6, ease: 'power2.out', immediateRender: false }, 2.0)
      .fromTo('.final-mark', { y: 40 * M, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, 2.3)
      .fromTo('.final-glow', { scale: reduce ? 1 : 1.35, opacity: 1 }, { scale: reduce ? 1 : 1.2, opacity: 0.75, duration: 1.4, immediateRender: false }, 2.6)
      .fromTo('.final-logo', { scale: reduce ? 1 : 1.06 }, { scale: 1, duration: 1.4, immediateRender: false }, 2.6)
      .to({}, { duration: 0.6 }, 4.0);
    each(ftl, l, 2.6, 0.25, { y: 70 * M, opacity: 0 });
  }

  function blobs() {
    const path = (xs, ys) => ({ x: xs.map(v => () => innerWidth * v * M), y: ys.map(v => () => vh() * v * M) });
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { start: 0, end: 'max', scrub: true, invalidateOnRefresh: true } });
    const moves = [
      ['.blob-violet', [0, 0.3, 0.1, 0.45, 0.2], [0, 0.35, 0.7, 0.4, 0.8], [1, 1.25, 1, 1.3, 1.1]],
      ['.blob-cool', [0, -0.35, -0.15, -0.5, -0.3], [0, 0.2, 0.5, 0.3, 0.55], [1, 0.85, 1.15, 0.9, 1.2]],
      ['.blob-warm', [0, 0.25, 0.5, 0.3, 0.6], [0, -0.3, -0.15, -0.55, -0.4], [1, 1.2, 0.9, 1.25, 1]],
      ['.blob-magenta', [0, -0.15, 0.1, -0.3, -0.1], [0, -0.4, -0.75, -0.5, -0.9], [1, 1.1, 1.3, 1, 1.2]]
    ];
    moves.forEach(([sel, xs, ys, ss]) => {
      const k = path(xs, ys);
      tl.to(sel, { keyframes: { x: k.x.map(f => f()), y: k.y.map(f => f()), scale: ss.map(v => reduce ? 1 : v) }, duration: 1 }, 0);
    });
  }

  function backgrounds() {
    bgTriggers = [];
    let prev = 'night';
    $$('[data-bg-state]').forEach(sec => {
      const s = sec.dataset.bgState;
      if (s === prev) return;
      bgTriggers.push({
        from: prev,
        to: s,
        st: ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'top 20%' })
      });
      prev = s;
    });
  }

  let ctx = null;
  function build() {
    ctx = gsap.context(() => {
      hero();
      manifest();
      numbers();
      how();
      reveal();
      cards();
      final();
      backgrounds();
      blobs();
    });
  }

  /* ---------- ambient: sky, background blend, progress ---------- */
  const sky = $('#sky');
  const x = sky.getContext('2d');
  const fill = $('#progressFill');
  const layers = {};
  $$('[data-bg]').forEach(el => { layers[el.dataset.bg] = { el, v: -1 }; });
  let W = 0, H = 0;
  function resizeSky() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    sky.width = W * dpr; sky.height = H * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeSky();
  addEventListener('resize', resizeSky);

  const stars = Array.from({ length: 300 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.pow(Math.random(), 2.2) * 0.9 + 0.1,
    p: Math.random() * Math.PI * 2,
    s: 0.4 + Math.random() * 1.4
  }));

  function scrollPos() { return lenis ? lenis.scroll : scrollY; }
  function maxScroll() { return Math.max(1, document.documentElement.scrollHeight - innerHeight); }

  function blendBackground() {
    const w = { dusk: 0, violet: 0, warm: 0 };
    let cur = 'night';
    for (const b of bgTriggers) {
      const p = b.st.progress;
      if (p <= 0) break;
      if (p >= 1) { cur = b.to; continue; }
      for (const k in w) w[k] = (k === b.from ? 1 - p : 0) + (k === b.to ? p : 0);
      cur = null;
      break;
    }
    if (cur) for (const k in w) w[k] = k === cur ? 1 : 0;
    for (const k in w) {
      const L = layers[k];
      const v = Math.round(w[k] * 1000) / 1000;
      if (L && L.v !== v) { L.el.style.opacity = v; L.v = v; }
    }
  }

  function render(t) {
    const s = scrollPos();
    fill.style.transform = 'scaleY(' + Math.min(1, s / maxScroll()).toFixed(4) + ')';
    blendBackground();

    x.clearRect(0, 0, W, H);
    const span = H * 1.3;
    for (const st of stars) {
      const sx = st.x * W;
      let sy = st.y * span - s * st.z * 0.08;
      sy = ((sy % span) + span) % span - H * 0.15;
      if (sy < -4 || sy > H + 4) continue;
      const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * st.s + st.p);
      x.globalAlpha = (0.12 + 0.6 * st.z) * tw;
      x.fillStyle = '#EEE9FF';
      x.beginPath();
      x.arc(sx, sy, 0.35 + st.z * 1.0, 0, Math.PI * 2);
      x.fill();
    }
    x.globalAlpha = 1;
  }

  gsap.ticker.add(time => {
    if (lenis) lenis.raf(time * 1000);
    render(time);
  });

  let lastW = innerWidth;
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (innerWidth === lastW) return;
      lastW = innerWidth;
      ctx && ctx.revert();
      build();
      ScrollTrigger.refresh();
    }, 250);
  });

  const start = () => {
    scrollTo(0, 0);
    build();
    ScrollTrigger.refresh();
    setFrame(0);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
})();
