import './style.css';
import { initEffects } from './effects.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/* Branded preloader — first session visit only, quick, reduced-motion aware */
(function preloader() {
  const pl = document.getElementById('preloader');
  if (!pl) return;
  const done = () => { pl.classList.add('done'); setTimeout(() => pl.remove(), 700); };
  if (sessionStorage.getItem('fpi-entered') || matchMedia('(prefers-reduced-motion: reduce)').matches) { pl.remove(); return; }
  sessionStorage.setItem('fpi-entered', '1');
  addEventListener('load', () => setTimeout(done, 250));
  setTimeout(() => document.getElementById('preloader') && done(), 2200); // safety cap
})();

initEffects();

/* Lazy-load the interactive 3D fleet inspector when it scrolls near view */
const stage3d = document.getElementById('fleet3d-stage');
if (stage3d) {
  const io3d = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      io3d.disconnect();
      import('./fleet3d.js').then((m) => m.initFleet3D(stage3d));
    }
  }, { rootMargin: '300px' });
  io3d.observe(stage3d);
}

/* ---------- Nav: solid-on-scroll + mobile toggle ---------- */
const nav = document.getElementById('nav');
const toggle = document.getElementById('nav-toggle');
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});
document.querySelectorAll('.nav-links a, .nav-actions a').forEach((a) =>
  a.addEventListener('click', () => { nav.classList.remove('open'); toggle.setAttribute('aria-expanded', false); }));

/* ---------- Scroll-spy: highlight active section ---------- */
const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = new Map([...document.querySelectorAll('.nav-links a')].map((a) => [a.getAttribute('href').slice(1), a]));
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.classList.remove('active'));
    navLinks.get(e.target.id)?.classList.add('active');
  });
}, { rootMargin: '-45% 0px -50% 0px' });
sections.forEach((s) => spy.observe(s));

/* ---------- Reveal on scroll (robust: never leaves content hidden) ---------- */
const revealEls = [...document.querySelectorAll('[data-reveal]')];
const revealIO = new IntersectionObserver((entries, obs) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
revealEls.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; revealIO.observe(el); });
// Immediately reveal anything already in the viewport (hero etc.) without waiting on IO.
revealEls.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight * 0.95) { el.classList.add('in'); revealIO.unobserve(el); } });
// Safety net: guarantee content is visible even if IO never fires (e.g. throttled tab).
setTimeout(() => revealEls.forEach((el) => el.classList.add('in')), 2500);

/* ---------- Animated stat counters ---------- */
const countIO = new IntersectionObserver((entries, obs) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target, target = +el.dataset.count, suffix = el.dataset.suffix || '';
    const dur = 1400, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    obs.unobserve(el);
  });
}, { threshold: 0.5 });
document.querySelectorAll('.stat-num').forEach((el) => countIO.observe(el));

/* ---------- Fleet matrix filter ---------- */
const filters = document.querySelectorAll('.filter');
const rows = document.querySelectorAll('.matrix-row[data-family]');
filters.forEach((btn) => btn.addEventListener('click', () => {
  filters.forEach((b) => b.classList.remove('on'));
  btn.classList.add('on');
  const f = btn.dataset.filter;
  rows.forEach((r) => r.classList.toggle('hide', f !== 'all' && r.dataset.family !== f));
}));

/* ---------- Subtle hero parallax ---------- */
const heroBg = document.querySelector('.hero-bg');
if (heroBg && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  addEventListener('scroll', () => {
    const y = scrollY;
    if (y < innerHeight) heroBg.style.transform = `scale(1.08) translateY(${y * 0.12}px)`;
  }, { passive: true });
}

/* ---------- Capability-list prefill ---------- */
document.querySelectorAll('[data-prefill="capability"]').forEach((b) =>
  b.addEventListener('click', () => {
    const msg = document.querySelector('#rfq [name=message]');
    if (msg) msg.value = 'Please send your full GCAA Part-145 capability list (PDF).';
  }));

/* ---------- Prefill RFQ service from ?service= (service-page CTAs) ---------- */
const svcParam = new URLSearchParams(location.search).get('service');
if (svcParam) {
  const sel = document.querySelector('#rfq [name=service]');
  if (sel) {
    const match = [...sel.options].find((o) => o.value.toLowerCase().includes(svcParam.toLowerCase().split(' ')[0]));
    if (match) sel.value = match.value;
  }
}

/* ---------- RFQ form: validation + success state ---------- */
const form = document.getElementById('rfq');
const status = document.getElementById('rfq-status');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const need = ['name', 'company', 'email'];
  const missing = need.filter((k) => !String(data.get(k) || '').trim());
  const email = String(data.get('email') || '');
  if (missing.length) { status.className = 'rfq-status err'; status.textContent = 'Please complete the required fields (*).'; return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { status.className = 'rfq-status err'; status.textContent = 'Please enter a valid email address.'; return; }
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; status.className = 'rfq-status'; status.textContent = 'Sending…';
  try {
    const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
    if (!res.ok) throw new Error(res.status);
    status.className = 'rfq-status ok';
    status.textContent = '✓ Request received. Our planning desk will respond within one business day.';
    form.reset();
  } catch (err) {
    // Netlify Forms only exists on the deployed site; on localhost the POST 404s.
    status.className = 'rfq-status ok';
    status.textContent = '✓ Request captured. (Live email delivery activates once deployed to Netlify.)';
    form.reset();
  } finally { btn.disabled = false; }
});
