import './style.css';
import { mountChrome, initReveals } from './site.js';
import { initEffects } from './effects.js';
import { wireNetlifyForm } from './netlify-form.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
mountChrome('');
initReveals();
initEffects();

const f = document.querySelector('form[name=aog]');
if (f) wireNetlifyForm(f, { required: ['operator', 'phone', 'defect'] });
