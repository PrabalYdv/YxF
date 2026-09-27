/* ==========================================================
   Young & Freaks — interactions
   GSAP + ScrollTrigger for scroll choreography, Lenis for smooth scroll.
   Everything degrades to a normal static page if the CDNs fail.
   ========================================================== */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  $('#year').textContent = new Date().getFullYear();

  /* ---------- split hero title into chars ---------- */
  $$('.hero__title .split').forEach((el) => {
    el.innerHTML = el.textContent.split('').map((c) => `<span class="char">${c}</span>`).join('');
  });

  /* ---------- split manifesto into words ---------- */
  const manifesto = $('[data-reveal-words]');
  if (manifesto) {
    manifesto.innerHTML = manifesto.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  }

  const hasGsap = window.gsap && window.ScrollTrigger;
  if (!hasGsap) {
    $('#loader')?.remove();
    $$('.manifesto .w').forEach((w) => (w.style.opacity = 1));
    initRing(); initTilt(); initCursor(); initPeek();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    }));
  }

  /* ---------- loader: on your marks, get set, go ---------- */
  function runLoader() {
    const loader = $('#loader');
    document.body.classList.add('is-loading');
    lenis?.stop();
    if (!loader || reduced) { loader?.remove(); document.body.classList.remove('is-loading'); lenis?.start(); return heroIntro(); }

    const call = $('#loaderCall'), clock = $('#loaderClock');
    const timer = { v: 0 };
    const fmt = (s) => `00:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}`;

    const tl = gsap.timeline({
      onComplete() { loader.remove(); document.body.classList.remove('is-loading'); lenis?.start(); },
    });
    tl.from('.loader__lanes span', { scaleX: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out' })
      .call(() => (call.textContent = 'Get set'), null, 0.55)
      .call(() => (call.textContent = 'Go!'), null, 1.05)
      .to(timer, { v: 3.03, duration: 1.3, ease: 'power1.in', onUpdate: () => (clock.textContent = fmt(timer.v)) }, 0.9)
      .to(loader, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, '+=0.15')
      .add(heroIntro(), '-=0.45');
  }

  function heroIntro() {
    const tl = gsap.timeline();
    tl.from('.hero__title .char', { yPercent: 115, rotateX: -90, transformPerspective: 600, duration: 1.1, stagger: 0.045, ease: 'expo.out' })
      .from('.hero__title .line--amp em', { scale: 0, rotate: -120, duration: 1, ease: 'back.out(2)' }, 0.25)
      .from('.hero__meta, .hero__foot > *', { y: 20, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0.4)
      .from('.nav', { opacity: 0, duration: 0.8 }, 0.4);
    return tl;
  }

  runLoader();

  /* ---------- nav hide/show ---------- */
  const nav = $('.nav');
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      nav.classList.toggle('is-solid', y > 40);
      nav.classList.toggle('is-hidden', y > lastY && y > 400);
      lastY = y;
    },
  });

  /* ---------- hero title parallax out ---------- */
  gsap.to('.hero__title', {
    yPercent: -20, opacity: 0.1, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  /* ---------- tapes: infinite marquee that speeds up with scroll velocity ---------- */
  const tapeTweens = $$('.tape__track').map((track, i) => {
    track.innerHTML += track.innerHTML; // duplicate for a seamless loop
    const dir = i % 2 ? 1 : -1;
    return gsap.fromTo(track, { xPercent: dir < 0 ? 0 : -50 }, { xPercent: dir < 0 ? -50 : 0, duration: 38 + i * 6, ease: 'none', repeat: -1 });
  });
  ScrollTrigger.create({
    trigger: '.tapes', start: 'top bottom', end: 'bottom top',
    onUpdate(self) {
      const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 250, 6);
      tapeTweens.forEach((t) => gsap.to(t, { timeScale: boost, duration: 0.2, overwrite: true, onComplete: () => gsap.to(t, { timeScale: 1, duration: 1 }) }));
    },
  });
  gsap.fromTo('.tape--a', { rotate: -8 }, { rotate: -2, ease: 'none', scrollTrigger: { trigger: '.tapes', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.tape--b', { rotate: 7 }, { rotate: 1, ease: 'none', scrollTrigger: { trigger: '.tapes', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* ---------- manifesto word reveal ---------- */
  gsap.to('.manifesto .w', {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: '.manifesto', start: 'top 80%', end: 'bottom 45%', scrub: true },
  });
  gsap.from('.about__big p', {
    yPercent: 60, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.about__grid', start: 'top 80%' },
  });

  /* ---------- counters ---------- */
  $$('[data-count]').forEach((el) => {
    const obj = { v: 0 };
    gsap.to(obj, {
      v: +el.dataset.count, duration: 1.4, ease: 'power2.out',
      onUpdate: () => (el.textContent = Math.round(obj.v)),
      scrollTrigger: { trigger: el, start: 'top 90%' },
    });
  });

  /* ---------- the route: pinned horizontal scroll (desktop) ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', () => {
    const cards = $('.route__cards');
    const dist = () => cards.scrollWidth - window.innerWidth;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '.route', start: 'top top', end: () => '+=' + dist(), pin: '.route__pin', scrub: 0.8, invalidateOnRefresh: true },
    });
    tl.to(cards, { x: () => -dist(), ease: 'none' }, 0)
      .to('.route__progress', { scaleX: 1, ease: 'none' }, 0);
    $$('.km').forEach((km, i) => {
      gsap.from(km, { rotateY: -25, rotateZ: i % 2 ? 3 : -3, y: 60, opacity: 0.2, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: km, containerAnimation: tl, start: 'left 95%', toggleActions: 'play none none reverse' } });
    });
  });
  mm.add('(max-width: 760px)', () => {
    $$('.km').forEach((km) => gsap.from(km, { y: 60, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: km, start: 'top 88%' } }));
  });

  /* ---------- bibs drop in like they're being pinned on ---------- */
  gsap.from('.bib', {
    y: 140, rotateX: 55, opacity: 0, duration: 1.2, stagger: 0.14, ease: 'expo.out',
    scrollTrigger: { trigger: '.bibs', start: 'top 80%' },
  });

  /* ---------- film strip drifts sideways as you scroll ---------- */
  const film = $('.film__row');
  gsap.fromTo(film, { x: () => window.innerWidth * 0.1 }, {
    x: () => -(film.scrollWidth - window.innerWidth * 0.9), ease: 'none',
    scrollTrigger: { trigger: '.film', start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true },
  });
  $$('.film img').forEach((img) => gsap.fromTo(img, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: '.film', start: 'top bottom', end: 'bottom top', scrub: true } }));

  /* ---------- "doing" rows ---------- */
  $$('.doing__list li').forEach((li) => gsap.from(li, {
    opacity: 0, y: 40, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: li, start: 'top 92%' },
  }));

  /* ---------- box: the cube breaks open as you scroll ---------- */
  const cube = $('.cube');
  gsap.timeline({ scrollTrigger: { trigger: '.box', start: 'top 70%', end: 'bottom bottom', scrub: 1 } })
    .fromTo(cube, { rotateX: -24, rotateY: 35 }, { rotateX: 340, rotateY: 400, ease: 'none' }, 0)
    .fromTo(cube, { '--explode': '0px' }, { '--explode': '140px', ease: 'power2.in' }, 0.3)
    .fromTo('.cube__face', { opacity: 1 }, { opacity: 0.0, stagger: 0.02, ease: 'power1.in' }, 0.7);
  gsap.from('.box__title', { y: 80, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.box__title', start: 'top 85%' } });

  /* ---------- footer word rises ---------- */
  gsap.from('.foot__word', { yPercent: 60, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.foot', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  initRing(); initTilt(); initCursor(); initPeek();
  window.addEventListener('load', () => ScrollTrigger.refresh());

  /* ==========================================================
     3D reel ring — draggable, auto-spinning carousel
     ========================================================== */
  function initRing() {
    const ring = $('#ring'), stage = $('#ringStage');
    if (!ring || !stage) return;
    const reels = $$('.reel', stage);
    const N = reels.length;
    let R = 0, angle = 0, vel = reduced ? 0 : 0.08, dragging = false, moved = 0, lastX = 0, tilt = -6;

    function layout() {
      const w = Math.max(170, Math.min(270, window.innerWidth * 0.42));
      ring.style.setProperty('--rw', w + 'px');
      R = (w / 2) / Math.tan(Math.PI / N) + w * 0.35;
      reels.forEach((el, i) => (el.dataset.a = (360 / N) * i));
    }
    function render() {
      stage.style.transform = `translateZ(${-R * 0.35}px) rotateX(${tilt}deg) rotateY(${angle}deg)`;
      reels.forEach((el) => {
        const a = +el.dataset.a;
        el.style.transform = `rotateY(${a}deg) translateZ(${R}px)`;
        // dim cards as they rotate away
        const rel = (((a + angle) % 360) + 360) % 360;
        const facing = Math.cos((rel * Math.PI) / 180);
        el.style.filter = `brightness(${0.35 + 0.65 * Math.max(facing, 0)})`;
      });
    }
    layout(); render();
    window.addEventListener('resize', () => { layout(); render(); });

    ring.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lastX = e.clientX; ring.classList.add('is-drag'); });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
      vel = dx * 0.25; angle += vel;
    });
    window.addEventListener('pointerup', () => { dragging = false; ring.classList.remove('is-drag'); });
    // a drag shouldn't count as a click on the reel link
    reels.forEach((el) => el.addEventListener('click', (e) => { if (moved > 6) e.preventDefault(); }));

    let inView = true;
    new IntersectionObserver(([en]) => (inView = en.isIntersecting)).observe(ring);
    (function tick() {
      requestAnimationFrame(tick);
      if (!inView) return;
      if (!dragging) {
        const idle = reduced ? 0 : 0.08;
        vel += (idle - vel) * 0.03; // ease back to a slow idle spin
        angle += vel;
      }
      render();
    })();
  }

  /* ==========================================================
     3D tilt on hover for cards and bibs
     ========================================================== */
  function initTilt() {
    if (!finePointer || reduced || !window.gsap) return;
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(el, { rotationY: px * 16, rotationX: -py * 16, z: 10, transformPerspective: 900, duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { rotationY: 0, rotationX: 0, z: 0, duration: 0.8, ease: 'elastic.out(1, .5)' }));
    });
  }

  /* ==========================================================
     Custom cursor with contextual labels
     ========================================================== */
  function initCursor() {
    const cur = $('.cursor');
    if (!cur || !finePointer) return;
    const label = $('.cursor__label', cur);
    const pos = { x: innerWidth / 2, y: innerHeight / 2 }, tgt = { ...pos };
    window.addEventListener('pointermove', (e) => { tgt.x = e.clientX; tgt.y = e.clientY; });
    (function loop() {
      pos.x += (tgt.x - pos.x) * 0.22; pos.y += (tgt.y - pos.y) * 0.22;
      cur.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      requestAnimationFrame(loop);
    })();
    const set = (text) => { label.textContent = text || ''; cur.classList.toggle('is-big', !!text); };
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor], .reel, .ring, a');
      if (!t) return set('');
      if (t.dataset.cursor) return set(t.dataset.cursor);
      if (t.classList.contains('reel')) return set('Watch');
      if (t.classList.contains('ring')) return set('Drag');
      set('');
    });
  }

  /* ==========================================================
     Image peek following the cursor on the "what happens" list
     ========================================================== */
  function initPeek() {
    const peek = $('.doing__peek');
    if (!peek || !finePointer) return;
    const img = $('img', peek);
    const p = { x: 0, y: 0, tx: 0, ty: 0, show: 0, ts: 0, rot: 0 };
    $$('.doing__list li').forEach((li) => {
      li.addEventListener('pointerenter', () => { img.src = li.dataset.img; p.ts = 1; });
      li.addEventListener('pointerleave', () => (p.ts = 0));
    });
    window.addEventListener('pointermove', (e) => { p.tx = e.clientX; p.ty = e.clientY; });
    (function loop() {
      const dx = p.tx - p.x;
      p.x += dx * 0.14; p.y += (p.ty - p.y) * 0.14; p.show += (p.ts - p.show) * 0.15;
      p.rot += (dx * 0.08 - p.rot) * 0.2;
      peek.style.opacity = p.show;
      peek.style.transform = `translate(${p.x - 120}px, ${p.y - 160}px) rotate(${p.rot}deg) scale(${0.6 + 0.4 * p.show})`;
      requestAnimationFrame(loop);
    })();
  }
})();
