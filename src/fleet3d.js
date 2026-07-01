// Interactive fleet inspector.
// Preferred: in-house three.js glTF render (branded, no author bar, real hotspots)
// loading a self-hosted /models/<key>.glb. If that file is absent or fails to
// load, it FALLS BACK to the Sketchfab embed — so nothing breaks until you add
// your own model files. See public/models/README.md.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const GOLD = 0xf0bd6c, CYAN = 0x7fd8ff;

const MODELS = {
  atr72:   { label: 'ATR 72-600',    glb: '/models/atr72.glb',   uid: '1e1a7186f7444d288675262fcee44744' },
  ejet:    { label: 'Embraer E-Jet', glb: '/models/ejet.glb',    uid: '6a674201fceb4395bee35dce685e1ff6' },
  b737max: { label: 'Boeing 737 MAX', glb: '/models/b737max.glb', uid: '2747cad8b4c64122abe992c9ad1e8bd1' },
  a320neo: { label: 'Airbus A320neo', glb: '/models/a320neo.glb', uid: 'b14863d4091e41e6abe25832a0af3b00' },
};
const SF = 'autostart=1&autospin=0.3&ui_theme=dark&dnt=1&transparent=1&ui_hint=2&ui_color=f0bd6c';
const HOT = {
  nose:   { t: 'Nose · Avionics & Radar', s: 'Component MRO',   href: '/services/component-mro.html' },
  wing:   { t: 'Wing · Hydraulics & Fuel', s: 'Base Maintenance', href: '/services/base-maintenance.html' },
  engine: { t: 'Engine · Powerplant',      s: 'Line Maintenance', href: '/services/line-maintenance.html' },
};

export function initFleet3D(stage) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.domElement.className = 'f3-canvas'; renderer.domElement.style.display = 'none';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(6, 3, 8.5);
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(5, 8, 6); scene.add(key);
  const gold = new THREE.PointLight(GOLD, 70, 60); gold.position.set(-5, 2, 4); scene.add(gold);
  const cyan = new THREE.PointLight(CYAN, 55, 60); cyan.position.set(4, -1, -5); scene.add(cyan);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.07; controls.enablePan = false;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.8;
  controls.minDistance = 3.5; controls.maxDistance = 30; controls.maxPolarAngle = Math.PI * 0.56;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  const loaderEl = document.createElement('div');
  loaderEl.className = 'f3-loader'; loaderEl.innerHTML = '<span></span>LOADING AIRFRAME';
  stage.appendChild(loaderEl);

  // Sketchfab fallback iframe (created lazily)
  let iframe = null;
  function showSketchfab(uid) {
    renderer.domElement.style.display = 'none';
    hideHotspots();
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.className = 'f3-frame'; iframe.title = 'Interactive 3D aircraft model';
      iframe.allow = 'autoplay; fullscreen; xr-spatial-tracking'; iframe.setAttribute('allowfullscreen', '');
      iframe.addEventListener('load', () => loaderEl.classList.remove('on'));
      stage.appendChild(iframe);
    }
    iframe.style.display = 'block';
    iframe.src = `https://sketchfab.com/models/${uid}/embed?${SF}`;
  }
  function hideSketchfab() { if (iframe) { iframe.style.display = 'none'; iframe.src = 'about:blank'; } }

  // Hotspot DOM markers
  const markers = {};
  Object.keys(HOT).forEach((k) => {
    const el = document.createElement('button');
    el.className = 'f3-hot'; el.type = 'button'; el.style.display = 'none';
    el.innerHTML = `<span class="f3-dot"></span><span class="f3-card"><b>${HOT[k].t}</b><i>${HOT[k].s} →</i></span>`;
    el.addEventListener('click', () => (location.href = HOT[k].href));
    stage.appendChild(el); markers[k] = el;
  });
  function hideHotspots() { Object.values(markers).forEach((el) => (el.style.display = 'none')); }

  const gltf = new GLTFLoader();
  let model = null, anchors = [], inhouse = false;

  function clearModel() {
    if (!model) return;
    scene.remove(model);
    model.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
    model = null; anchors = [];
  }

  function buildAnchors(box) {
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const lenX = s.x >= s.z; // longest horizontal axis = fuselage
    const half = (lenX ? s.x : s.z) / 2, wide = (lenX ? s.z : s.x);
    const A = (dl, dw, dy) => { const p = c.clone(); if (lenX) p.x += dl; else p.z += dl; p.x += lenX ? 0 : dw; p.z += lenX ? dw : 0; p.y += dy; return p; };
    anchors = [
      { key: 'nose', pos: A(half * 0.9, 0, s.y * 0.1) },
      { key: 'wing', pos: A(0, wide * 0.34, -s.y * 0.05) },
      { key: 'engine', pos: A(half * 0.25, wide * 0.24, -s.y * 0.28) },
    ];
  }

  function loadType(m) {
    loaderEl.classList.add('on'); inhouse = false;
    gltf.load(
      m.glb,
      (g) => {
        hideSketchfab(); clearModel();
        model = g.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
        const scale = 6 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        model.position.sub(ctr.multiplyScalar(scale));
        scene.add(model);
        buildAnchors(new THREE.Box3().setFromObject(model));
        controls.target.set(0, 0, 0); controls.autoRotate = !reduce;
        renderer.domElement.style.display = 'block'; loaderEl.classList.remove('on');
        inhouse = true;
      },
      undefined,
      () => { clearModel(); inhouse = false; showSketchfab(m.uid); }, // missing/failed glb → fallback
    );
  }

  // pills
  const pills = [...document.querySelectorAll('#fleet3d-switch .f3-pill')];
  const credit = document.getElementById('fleet3d-credit');
  function select(key) {
    pills.forEach((b) => b.classList.toggle('on', b.dataset.type === key));
    if (credit) credit.textContent = `Live 3D · ${MODELS[key].label}`;
    loadType(MODELS[key]);
  }
  pills.forEach((btn) => btn.addEventListener('click', () => { if (!btn.classList.contains('on')) select(btn.dataset.type); }));
  select('atr72');

  function resize() { const w = stage.clientWidth, h = stage.clientHeight || 520; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  const tmp = new THREE.Vector3();
  let running = true;
  new IntersectionObserver((e) => { running = e[0].isIntersecting; }, { threshold: 0.01 }).observe(stage);

  (function frame() {
    requestAnimationFrame(frame);
    if (!running || !inhouse) return;
    controls.update();
    anchors.forEach(({ key: k, pos }) => {
      tmp.copy(pos).project(camera);
      const vis = tmp.z < 1;
      markers[k].style.display = vis ? 'block' : 'none';
      markers[k].style.left = (tmp.x * 0.5 + 0.5) * stage.clientWidth + 'px';
      markers[k].style.top = (-tmp.y * 0.5 + 0.5) * stage.clientHeight + 'px';
    });
    renderer.render(scene, camera);
  })();
}
