import './hangar.css';
import { sb } from './client.js';
import { configured } from './config.js';

const $ = (id) => document.getElementById(id);

// Only ever return to a path on this site — never an attacker-supplied absolute URL.
function safeNext() {
  const raw = new URLSearchParams(location.search).get('next') || '/hangar.html';
  return /^\/[A-Za-z0-9._~\-/?#=&%]*$/.test(raw) && !raw.startsWith('//') ? raw : '/hangar.html';
}

function msg(text, cls) {
  const m = $('authMsg');
  m.textContent = text;
  m.className = 'msg ' + (cls || '');
}

if (!configured) {
  $('needsConfig').classList.remove('hide');
} else {
  $('authBox').classList.remove('hide');

  // Already signed in? Go straight through.
  sb.auth.getSession().then(({ data }) => {
    if (data && data.session) location.replace(safeNext());
  });

  $('authForm').addEventListener('submit', (e) => {
    e.preventDefault();
    msg('Signing in…');
    sb.auth.signInWithPassword({
      email: $('email').value.trim(),
      password: $('password').value,
    }).then((r) => {
      if (r.error) msg(r.error.message, 'err');
      else location.replace(safeNext());
    });
  });

  $('signUpBtn').addEventListener('click', () => {
    const em = $('email').value.trim(), pw = $('password').value;
    if (!em || pw.length < 8) {
      msg('Enter your email and a password of at least 8 characters.', 'err');
      return;
    }
    msg('Creating your account…');
    sb.auth.signUp({ email: em, password: pw }).then((r) => {
      if (r.error) { msg(r.error.message, 'err'); return; }
      if (r.data.session) location.replace(safeNext());
      else msg('Account created. Check your email for the confirmation link, then sign in.', 'ok');
    });
  });
}
