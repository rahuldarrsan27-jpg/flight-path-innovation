import './style.css';
import { mountChrome, initReveals } from './site.js';
import { initEffects } from './effects.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

mountChrome('capabilities');
initReveals();
initEffects();
