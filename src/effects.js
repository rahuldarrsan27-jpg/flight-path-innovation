// Site-wide visual effects: WebGL liquid background, cursor spotlight,
// liquid-glass sheen, 3D tilt and magnetic buttons. All performance-capped
// and disabled under prefers-reduced-motion.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

export function initEffects() {
  injectLiquidFilter();
  if (!reduce) startWebGL();
  if (fine && !reduce) { startCursorGlow(); enableTilt(); enableMagnetic(); }
  initConsent();
  initWhatsApp();
  initGrade();
  initKinetic();
  initScrollFX();
}

/* ---------- Scroll choreography: progress bar + subtle parallax ---------- */
function initScrollFX() {
  const bar = document.createElement('div'); bar.id = 'scroll-progress'; document.body.appendChild(bar);
  const layers = [...document.querySelectorAll('.cap-img')];
  let ticking = false;
  function update() {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    if (reduce) return;
    for (const el of layers) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50) continue;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -0.5..0.5
      el.style.transform = `translateY(${p * -18}px) scale(1.1)`;
    }
  }
  addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
  update();
}

/* ---------- Cinematic grade: film grain + vignette ---------- */
function initGrade() {
  if (document.getElementById('grain')) return;
  const g = document.createElement('div'); g.id = 'grain'; document.body.appendChild(g);
  const v = document.createElement('div'); v.id = 'vignette'; document.body.appendChild(v);
}

/* ---------- Kinetic headline mask reveal ---------- */
function initKinetic() {
  if (reduce) return;
  const heads = [...document.querySelectorAll('main h1, main h2')];
  const io = new IntersectionObserver((es, o) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target); } });
  }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
  heads.forEach((h) => {
    if (h.dataset.k) return; h.dataset.k = '1';
    h.innerHTML = `<span class="kinetic-inner">${h.innerHTML}</span>`;
    h.classList.add('kinetic');
    io.observe(h);
    if (h.getBoundingClientRect().top < innerHeight * 0.92) { h.classList.add('in'); io.unobserve(h); }
  });
  setTimeout(() => heads.forEach((h) => h.classList.add('in')), 2600); // safety: never leave a heading hidden
}

/* ---------- Cookie consent (gates analytics) ---------- */
function loadAnalytics() {
  // Drop your analytics snippet here — it only runs after consent = accept.
  // Plausible example:
  //   const s = document.createElement('script');
  //   s.defer = true; s.dataset.domain = 'fpiaviation.com';
  //   s.src = 'https://plausible.io/js/script.js'; document.head.appendChild(s);
}
function initConsent() {
  if (localStorage.getItem('fpi-consent')) { if (localStorage.getItem('fpi-consent') === 'accept') loadAnalytics(); return; }
  const bar = document.createElement('div');
  bar.id = 'consent';
  bar.innerHTML = `<p>We use privacy-friendly analytics to improve this site. See our <a href="/privacy.html">privacy policy</a>.</p>
    <div class="consent-btns"><button data-c="decline">Decline</button><button data-c="accept" class="acc">Accept</button></div>`;
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('show'));
  bar.addEventListener('click', (e) => {
    const c = e.target.dataset.c; if (!c) return;
    localStorage.setItem('fpi-consent', c);
    if (c === 'accept') loadAnalytics();
    bar.remove();
  });
}

/* ---------- Floating WhatsApp ---------- */
function initWhatsApp() {
  const a = document.createElement('a');
  a.id = 'wa-float';
  a.href = 'https://wa.me/233554352912?text=Hello%20FPI%20Aviation';
  a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Chat with us on WhatsApp');
  a.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.06 1.6 5.82L2 22l4.4-1.15a9.9 9.9 0 0 0 5.64 1.74h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.03c-.24.68-1.4 1.3-1.94 1.34-.5.04-.5.4-3.15-.66-2.66-1.05-4.35-3.77-4.48-3.95-.13-.18-1.08-1.44-1.08-2.75s.69-1.95.94-2.22c.24-.27.53-.34.7-.34l.5.01c.16 0 .38-.06.59.45.24.58.82 2 .9 2.14.07.14.12.31.02.5-.09.18-.14.29-.28.45l-.42.49c-.14.14-.28.29-.12.57.16.28.72 1.18 1.54 1.91 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.18-.2.7-.81.89-1.09.18-.28.37-.23.62-.14.25.09 1.6.76 1.87.9.28.14.46.21.53.32.07.12.07.66-.17 1.34z"/></svg>`;
  document.body.appendChild(a);
}

/* ---------- Animated SVG turbulence filter (organic edges) ---------- */
function injectLiquidFilter() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  svg.innerHTML = `<defs><filter id="liquid"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.016" numOctaves="2" seed="6" result="n">
    <animate attributeName="baseFrequency" dur="20s" values="0.012 0.016;0.018 0.010;0.012 0.016" repeatCount="indefinite"/>
  </feTurbulence><feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
  document.body.appendChild(svg);
}

/* ---------- WebGL liquid-metal background ---------- */
function startWebGL() {
  const canvas = document.createElement('canvas');
  canvas.id = 'gl-bg';
  document.body.appendChild(canvas);
  const gl = canvas.getContext('webgl2', { antialias: false, depth: false, powerPreference: 'low-power' });
  if (!gl) { canvas.remove(); return; } // graceful fallback to CSS navy

  const vert = `#version 300 es
  void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position=vec4(p*2.0-1.0,0,1); }`;
  const frag = `#version 300 es
  precision highp float; out vec4 o;
  uniform vec2 uR; uniform float uT; uniform vec2 uM;
  float h(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
  float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
  float fbm(vec2 p){float s=0.0,a=0.5;for(int i=0;i<5;i++){s+=a*nz(p);p*=2.02;a*=0.5;}return s;}
  void main(){
    vec2 uv=gl_FragCoord.xy/uR; vec2 p=uv; p.x*=uR.x/uR.y;
    float t=uT*0.045;
    vec2 q=vec2(fbm(p*2.2+t), fbm(p*2.2-t+5.0));
    vec2 r=vec2(fbm(p*2.2+q*1.6+t*1.3+2.0), fbm(p*2.2+q*1.6-t+9.0));
    float f=fbm(p*2.2+r*1.8);
    float md=distance(uv,uM); f+=0.16*exp(-md*4.5);
    vec3 navy=vec3(0.020,0.040,0.075);
    vec3 deep=vec3(0.050,0.105,0.190);
    vec3 gold=vec3(0.94,0.74,0.42);
    vec3 cyan=vec3(0.50,0.85,1.00);
    vec3 col=mix(navy,deep,smoothstep(0.20,0.72,f));
    col+=gold*smoothstep(0.60,0.88,f)*0.55;
    col+=cyan*smoothstep(0.80,0.97,r.x)*0.20;
    col+=gold*exp(-md*5.0)*0.10;
    float v=smoothstep(1.30,0.18,length(uv-0.5));
    col*=mix(0.55,1.0,v);
    o=vec4(col,1.0);
  }`;

  const prog = link(gl, vert, frag);
  if (!prog) { canvas.remove(); return; }
  gl.useProgram(prog);
  const uR = gl.getUniformLocation(prog, 'uR');
  const uT = gl.getUniformLocation(prog, 'uT');
  const uM = gl.getUniformLocation(prog, 'uM');

  const SCALE = 0.6; // render at 60% res — it's a soft backdrop
  let W = 0, H = 0, lastW = -1, lastH = -1;
  function resize() {
    const vw = innerWidth || document.documentElement.clientWidth || 1280;
    const vh = innerHeight || document.documentElement.clientHeight || 720;
    if (vw === lastW && vh === lastH) return;
    lastW = vw; lastH = vh;
    const dpr = Math.min(devicePixelRatio, 1.25) * SCALE;
    W = Math.max(2, (vw * dpr) | 0); H = Math.max(2, (vh * dpr) | 0);
    canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H);
  }
  resize();
  addEventListener('resize', resize);

  let tmx = 0.5, tmy = 0.5, mx = 0.5, my = 0.5, visible = true;
  addEventListener('pointermove', (e) => { tmx = e.clientX / innerWidth; tmy = e.clientY / innerHeight; }, { passive: true });
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) resize(); });
  const t0 = performance.now();
  (function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    resize(); // self-correct if viewport changed (covers zero-size init)
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    gl.uniform2f(uR, W, H); gl.uniform1f(uT, (now - t0) / 1000); gl.uniform2f(uM, mx, 1 - my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  })(t0);
}
function link(gl, vs, fs) {
  const c = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const v = c(gl.VERTEX_SHADER, vs), f = c(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

/* ---------- Cursor spotlight ---------- */
function startCursorGlow() {
  const g = document.createElement('div');
  g.id = 'cursor-glow';
  document.body.appendChild(g);
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; g.classList.add('on'); }, { passive: true });
  addEventListener('pointerleave', () => g.classList.remove('on'));
  (function loop() {
    requestAnimationFrame(loop);
    x += (tx - x) * 0.12; y += (ty - y) * 0.12;
    g.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
  })();
}

/* ---------- 3D tilt on cards ---------- */
function enableTilt() {
  const sel = '.cap-card, .sibling, .sustain, .culture, .scope-card, .stat-card, .reach, .why';
  document.querySelectorAll(sel).forEach((el) => {
    el.setAttribute('data-tilt', '');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateX(${-py * 5}deg) rotateY(${px * 5}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

/* ---------- Magnetic primary buttons ---------- */
function enableMagnetic() {
  document.querySelectorAll('.btn-primary').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const mx = (e.clientX - r.left - r.width / 2) * 0.3;
      const my = (e.clientY - r.top - r.height / 2) * 0.4;
      btn.style.transform = `translate(${mx}px,${my}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}
