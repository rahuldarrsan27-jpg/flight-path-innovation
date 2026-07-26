import './hangar.css';
import { sb } from './client.js';
import { configured } from './config.js';
import { initApp } from './app.js';

const $ = (id) => document.getElementById(id);

// Not wired to a database yet: show the setup notice, never a broken login screen.
if (!configured) {
  $('checking').classList.add('hide');
  $('needsConfig').classList.remove('hide');
} else {
  // Gate on a real session. No session -> /login, remembering where we were headed.
  sb.auth.getSession().then(({ data }) => {
    const session = data && data.session;
    if (!session) {
      const next = encodeURIComponent(location.pathname + location.search + location.hash);
      location.replace('/login.html?next=' + next);
      return;
    }
    $('checking').classList.add('hide');
    initApp(sb, session.user);
  });

  $('btnOut').addEventListener('click', () => {
    sb.auth.signOut().then(() => location.replace('/login.html'));
  });

  // Signing out in another tab must not leave this one showing data.
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') location.replace('/login.html');
  });
}
