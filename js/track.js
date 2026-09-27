/* ==========================================================
   Hero 3D scene: a stadium running track with glowing runners
   lapping it, and a morphing "freak" blob floating in the infield.
   ========================================================== */
(function () {
  const canvas = document.getElementById('scene');
  if (!canvas || !window.THREE) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) { return; } // no WebGL: the page still works without the scene
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const COLORS = { cream: 0xefe8da, yellow: 0xf5c21b, pink: 0xe0237f, ink: 0x0e0d0b };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COLORS.ink, 9, 24);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const world = new THREE.Group();
  scene.add(world);

  /* ---- stadium path: two straights (length L) + two semicircles (radius r) ---- */
  const L = 5.2;
  function stadium(s, r, out) {
    const P = 2 * L + 2 * Math.PI * r;
    s = ((s % P) + P) % P;
    if (s < L) return out.set(-L / 2 + s, 0, -r);
    s -= L;
    if (s < Math.PI * r) { const a = -Math.PI / 2 + s / r; return out.set(L / 2 + r * Math.cos(a), 0, r * Math.sin(a)); }
    s -= Math.PI * r;
    if (s < L) return out.set(L / 2 - s, 0, r);
    s -= L;
    const a = Math.PI / 2 + s / r;
    return out.set(-L / 2 + r * Math.cos(a), 0, r * Math.sin(a));
  }
  const perimeter = (r) => 2 * L + 2 * Math.PI * r;

  /* ---- lane lines ---- */
  const LANES = 6, R0 = 2.3, LANE_W = 0.26;
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= LANES; i++) {
    const r = R0 + i * LANE_W, P = perimeter(r), N = 260, pts = [];
    for (let k = 0; k <= N; k++) pts.push(stadium((k / N) * P, r, new THREE.Vector3()));
    const edge = i === 0 || i === LANES;
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: COLORS.cream, transparent: true, opacity: edge ? 0.55 : 0.18 })
    );
    world.add(line);
  }

  /* ---- track surface (subtle filled ring) ---- */
  (function () {
    const N = 220, inner = R0, outer = R0 + LANES * LANE_W;
    const pos = [], idx = [];
    const Pi = perimeter(inner), Po = perimeter(outer);
    for (let k = 0; k <= N; k++) {
      const a = stadium((k / N) * Pi, inner, new THREE.Vector3());
      const b = stadium((k / N) * Po, outer, new THREE.Vector3());
      pos.push(a.x, -0.01, a.z, b.x, -0.01, b.z);
      if (k < N) { const j = k * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    world.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3a2a1a, transparent: true, opacity: 0.35, side: THREE.DoubleSide })));
  })();

  /* ---- start line + lane numbers as small ticks ---- */
  {
    const pts = [];
    for (let i = 0; i <= LANES; i++) {
      const r = R0 + i * LANE_W;
      pts.push(new THREE.Vector3(-L / 2 + 1.2, 0.001, -r));
    }
    const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[pts.length - 1]]);
    world.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: COLORS.yellow })));
  }

  /* ---- ground dots grid for depth ---- */
  {
    const pos = [];
    for (let x = -12; x <= 12; x += 0.6) for (let z = -8; z <= 8; z += 0.6) pos.push(x, -0.02, z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    world.add(new THREE.Points(g, new THREE.PointsMaterial({ color: COLORS.cream, size: 0.025, transparent: true, opacity: 0.35 })));
  }

  /* ---- runners with fading trails ---- */
  const TRAIL = 46, GAP = 0.055;
  const runners = [];
  const palette = [COLORS.yellow, COLORS.pink, COLORS.cream, COLORS.yellow, COLORS.pink, COLORS.cream, COLORS.yellow, COLORS.pink];
  palette.forEach((hex, i) => {
    const lane = i % LANES;
    const r = R0 + lane * LANE_W + LANE_W / 2;
    const col = new THREE.Color(hex);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), new THREE.MeshBasicMaterial({ color: col }));
    head.position.y = 0.07;

    const posArr = new Float32Array(TRAIL * 3), colArr = new Float32Array(TRAIL * 3);
    for (let k = 0; k < TRAIL; k++) {
      const f = Math.pow(1 - k / TRAIL, 1.6);
      colArr[k * 3] = col.r * f; colArr[k * 3 + 1] = col.g * f; colArr[k * 3 + 2] = col.b * f;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const trail = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true }));

    world.add(head, trail);
    runners.push({ r, head, trail, s: Math.random() * perimeter(r), v: 1.1 + Math.random() * 0.9, wob: Math.random() * 6 });
  });

  /* ---- the freak blob ---- */
  const blobMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uA: { value: new THREE.Color(COLORS.pink) },
      uB: { value: new THREE.Color(COLORS.yellow) },
      uC: { value: new THREE.Color(0x1a0f14) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vN; varying vec3 vView; varying float vD;
      float wave(vec3 p){
        return sin(p.x*2.6+uTime*1.1)*sin(p.y*3.1+uTime*.8)*sin(p.z*2.2+uTime*1.3)
             + .5*sin(p.x*5.3-uTime*1.6+p.y*4.1);
      }
      void main(){
        float d = wave(position)*.16;
        vD = d;
        vec3 p = position + normal*d;
        vN = normalize(normalMatrix*normal);
        vec4 mv = modelViewMatrix*vec4(p,1.);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: `
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uTime;
      varying vec3 vN; varying vec3 vView; varying float vD;
      void main(){
        float fr = pow(1.-max(dot(normalize(vN),vView),0.),2.2);
        vec3 col = mix(uC, uA, smoothstep(-.12,.2,vD));
        col = mix(col, uB, fr);
        float bands = smoothstep(.45,.5,fract(vD*18.+uTime*.2))*.08;
        gl_FragColor = vec4(col+bands,1.);
      }`,
  });
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 40), blobMat);
  blob.position.set(0, 1.25, 0);
  world.add(blob);

  /* ---- layout / interaction ---- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // pull the camera back on narrow (portrait) screens so the whole track fits
    const a = w / h;
    camera.userData.base = a < 0.8 ? 7.5 : a < 1.2 ? 12 : 11;
    camera.userData.height = a < 0.8 ? 13 : 5.2;
    blob.scale.setScalar(a < 0.8 ? 0.75 : 1);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX / window.innerWidth - 0.5;
    mouse.ty = e.clientY / window.innerHeight - 0.5;
  });

  let scrollK = 0;
  window.addEventListener('scroll', () => { scrollK = Math.min(window.scrollY / window.innerHeight, 1.5); }, { passive: true });

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    const base = camera.userData.base;
    camera.position.set(mouse.x * 2.2, camera.userData.height + mouse.y * -1.6 + scrollK * 2.5, base - scrollK * 2);
    camera.lookAt(0, 0.4 - scrollK * 0.6, 0);
    world.rotation.y = t * 0.06 + mouse.x * 0.35;

    for (const rn of runners) {
      rn.s += rn.v * dt * (1 + 0.15 * Math.sin(t * 0.7 + rn.wob));
      stadium(rn.s, rn.r, tmp);
      rn.head.position.set(tmp.x, 0.07, tmp.z);
      const arr = rn.trail.geometry.attributes.position.array;
      for (let k = 0; k < TRAIL; k++) {
        stadium(rn.s - k * GAP, rn.r, tmp);
        arr[k * 3] = tmp.x; arr[k * 3 + 1] = 0.06; arr[k * 3 + 2] = tmp.z;
      }
      rn.trail.geometry.attributes.position.needsUpdate = true;
    }

    blobMat.uniforms.uTime.value = t;
    blob.position.y = 1.25 + Math.sin(t * 1.2) * 0.12;
    blob.rotation.y = t * 0.3;
    blob.rotation.x = Math.sin(t * 0.4) * 0.3;

    renderer.render(scene, camera);
  }

  if (reduced) {
    // one still frame, but keep it correct on resize
    frame();
    window.addEventListener('resize', frame);
    return;
  }
  (function loop() {
    requestAnimationFrame(loop);
    if (visible && !document.hidden) frame();
    else clock.getDelta(); // don't jump when returning
  })();
})();
