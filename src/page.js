import './style.css';
import { mountChrome, initReveals } from './site.js';
import { initEffects } from './effects.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

mountChrome(document.body.dataset.nav || '');
initReveals();
initEffects();
