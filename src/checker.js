import './style.css';
import { mountChrome, initReveals } from './site.js';
import { initEffects } from './effects.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
mountChrome('');
initReveals();
initEffects();

// Indicative turnaround windows (illustrative — confirm real figures before launch).
const TAT = {
  'Hangar Storage': 'From same-day induction',
  'Line Maintenance': '4–24 hours',
  'Component MRO': '5–15 working days',
};
const BASE_TAT = { 'A-Check': '1–3 days', 'C-Check': '10–21 days', 'D-Check': '4–8 weeks' };

const form = document.getElementById('checker-form');
const levelWrap = document.getElementById('check-level-wrap');
const result = document.getElementById('checker-result');
const crLine = document.getElementById('cr-line');
const crTat = document.getElementById('cr-tat');
const crCta = document.getElementById('cr-cta');

// show check-level only for Base Maintenance
form.service.addEventListener('change', () => {
  levelWrap.hidden = form.service.value !== 'Base Maintenance';
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const type = form.type.value, service = form.service.value, level = form.level.value;
  if (!type || !service) return;
  const isBase = service === 'Base Maintenance';
  const tat = isBase ? BASE_TAT[level] : TAT[service];
  crLine.innerHTML = `Yes — we are GCAA Part-145 rated for <b>${service}${isBase ? ' · ' + level : ''}</b> on the <b>${type}</b>.`;
  crTat.textContent = tat;
  // deep-link to the RFQ with the requirement prefilled
  const svcParam = isBase ? 'Base Maintenance (C/D)' : service;
  crCta.href = `/?service=${encodeURIComponent(svcParam)}&type=${encodeURIComponent(type)}#contact`;
  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
