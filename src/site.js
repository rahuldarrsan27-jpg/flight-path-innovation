// Shared site chrome (nav + footer + AOG) and behaviours for inner pages.
const BRAND = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12l9-2 4-7h1l-1 8 7 2-7 2 1 8h-1l-4-7-9-2z"/></svg><span class="brand-txt">FLIGHT PATH <b>INNOVATION</b></span>`;

const navHTML = (active) => `
  <div class="nav-inner container">
    <a class="brand" href="/" aria-label="Flight Path Innovation home">${BRAND}</a>
    <nav class="nav-links" aria-label="Primary">
      <a href="/#capabilities"${active === 'capabilities' ? ' class="active"' : ''}>Capabilities</a>
      <a href="/network.html"${active === 'network' ? ' class="active"' : ''}>Network</a>
      <a href="/#fleet">Fleet</a>
      <a href="/#approvals">Approvals</a>
      <a href="/#about">About</a>
    </nav>
    <div class="nav-actions">
      <a href="/aog.html" class="btn btn-aog"><span class="pulse"></span>24/7 AOG</a>
      <a href="/#contact" class="btn btn-primary">Request a Quote</a>
    </div>
    <button id="nav-toggle" class="nav-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>`;

const footerHTML = `
  <div class="container footer-grid">
    <div class="f-brand">
      <div class="brand">${BRAND}</div>
      <p>GCAA Part-145 approved aircraft storage, line &amp; base maintenance and component MRO at Accra International Airport.</p>
      <span class="f-badge">GCAA PART-145 · APPROVED</span>
    </div>
    <div class="f-col"><h4>Capabilities</h4>
      <a href="/services/hangar-storage.html">Hangar Storage</a>
      <a href="/services/line-maintenance.html">Line Maintenance</a>
      <a href="/services/base-maintenance.html">Base Maintenance</a>
      <a href="/services/component-mro.html">Component MRO</a>
    </div>
    <div class="f-col"><h4>Company</h4>
      <a href="/network.html">Network &amp; Coverage</a><a href="/#about">About</a><a href="/sustainability.html">Sustainability</a><a href="/careers.html">Careers</a>
    </div>
    <div class="f-col"><h4>Contact</h4>
      <a href="/aog.html">24/7 AOG Support</a><a href="/capability-check.html">Capability Check</a><a href="mailto:sales@flightpathinnovation.com">Commercial</a><a href="/#contact">Request a Quote</a>
    </div>
  </div>
  <div class="container footer-base">
    <span>© 2026 Flight Path Innovation. All rights reserved.</span>
    <span class="footer-legal"><a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · Accra International Airport · Ghana · Reg. No. ——</span>
  </div>`;

export function mountChrome(active) {
  const header = document.createElement('header');
  header.id = 'nav'; header.className = 'nav'; header.innerHTML = navHTML(active);
  document.body.prepend(header);

  const footer = document.createElement('footer');
  footer.className = 'footer'; footer.innerHTML = footerHTML;
  document.body.appendChild(footer);

  const aog = document.createElement('a');
  aog.href = 'tel:+233000000000'; aog.className = 'aog-float';
  aog.setAttribute('aria-label', 'Call 24/7 AOG desk');
  aog.innerHTML = '<span class="pulse"></span>24/7 AOG';
  document.body.appendChild(aog);

  const onScroll = () => header.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const toggle = header.querySelector('#nav-toggle');
  toggle.addEventListener('click', () => {
    const open = header.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  header.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    header.classList.remove('open'); toggle.setAttribute('aria-expanded', false);
  }));
}

export function initReveals() {
  const els = [...document.querySelectorAll('[data-reveal]')];
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
  els.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight * 0.95) { el.classList.add('in'); io.unobserve(el); } });
  setTimeout(() => els.forEach((el) => el.classList.add('in')), 2500);
}
