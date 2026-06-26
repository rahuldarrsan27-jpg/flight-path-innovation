// Site-wide visual effects: WebGL liquid background, cursor spotlight,
// liquid-glass sheen, 3D tilt and magnetic buttons. All performance-capped
// and disabled under prefers-reduced-motion.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

export function initEffects() {
  injectLiquidFilter();
  if (!reduce) startWebGL();
  if (fine && !reduce) { startCursorGlow(); enableTilt(); enableMagnetic(); }
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
