// Entry point for /logs. Decides between first-run setup, sign-in, and the app,
// then hands an authenticated data store to the module.
import './hangar.css';
import { auth, store } from './store.js';
import { initApp } from './app.js';

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hide');
const hide = (id) => $(id).classList.add('hide');

function msg(el, text, cls) {
  const m = $(el);
  m.textContent = text;
  m.className = 'msg ' + (cls || '');
}

function launch(email) {
  hide('gate');
  initApp(store, { email });
  $('btnOut').addEventListener('click', async () => {
    await auth.signOut();
    location.reload();
  });
}

async function boot() {
  const r = await auth.status();
  hide('checking');

  // status is a plain GET; a network-level failure means the function is unreachable.
  if (r.error && r.status === 0) { show('noApi'); return; }
  if (r.error) { show('authBox'); msg('authMsg', r.error.message, 'err'); return; }

  if (r.data.signedIn) { launch(r.data.email); return; }
  if (!r.data.hasOwner) { show('setupBox'); return; }
  show('authBox');
}

/* ---------------- first-run setup ---------------- */
$('setupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('suEmail').value.trim();
  const pw = $('suPass').value;
  if (pw !== $('suPass2').value) { msg('setupMsg', 'The two passwords do not match.', 'err'); return; }
  if (pw.length < 10) { msg('setupMsg', 'Use a password of at least 10 characters.', 'err'); return; }
  $('suBtn').disabled = true;
  msg('setupMsg', 'Creating your login…');
  const r = await auth.setup(email, pw);
  $('suBtn').disabled = false;
  if (r.error) { msg('setupMsg', r.error.message, 'err'); return; }
  launch(r.data.email);
});

/* ---------------- sign in ---------------- */
$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('signInBtn').disabled = true;
  msg('authMsg', 'Signing in…');
  const r = await auth.signIn($('email').value.trim(), $('password').value);
  $('signInBtn').disabled = false;
  if (r.error) { msg('authMsg', r.error.message, 'err'); return; }
  launch(r.data.email);
});

boot();
