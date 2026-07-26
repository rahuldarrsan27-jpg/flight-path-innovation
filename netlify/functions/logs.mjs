/**
 * Hangar Log API — server-side auth + storage for the protected /logs module.
 *
 * Runs as a Netlify Function on the site's own deploy. No third-party service and
 * nothing to configure: records live in Netlify Blobs (private, server-only), and
 * the session-signing secret is generated on first use and kept in Blobs, so no
 * secret is ever committed to the repository.
 *
 * Security model:
 *  - One owner account. The first POST /setup claims it; every later attempt is
 *    refused, so sign-ups close themselves — there is no dashboard toggle to forget.
 *  - Password stored as scrypt(salt, 64 bytes); compared with timingSafeEqual.
 *  - Session is an HttpOnly, Secure, SameSite=Lax cookie holding an HMAC-signed
 *    payload. It is not readable by JavaScript, so XSS cannot lift it.
 *  - Records are stored under the owner's id and every data route requires a valid
 *    session, so record data can never be served to an unauthenticated caller —
 *    including by direct API call.
 */
import { getStore } from '@netlify/blobs';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const COOKIE = 'fpi_logs';
const SESSION_DAYS = 30;
const MAX_FAILS = 10;
const LOCK_MINUTES = 15;

const store = () => getStore({ name: 'fpi-logs', consistency: 'strong' });

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });

/* ---------------------------------------------------------------- secret */
async function secret(s) {
  let v = await s.get('secret');
  if (!v) {
    v = randomBytes(32).toString('hex');
    await s.set('secret', v);
  }
  return v;
}

/* ---------------------------------------------------------------- session */
const b64u = (buf) => Buffer.from(buf).toString('base64url');

function sign(payload, key) {
  const body = b64u(JSON.stringify(payload));
  const mac = createHmac('sha256', key).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token, key) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const want = createHmac('sha256', key).update(body).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}
function cookieHeader(token, days) {
  const parts = [
    `${COOKIE}=${token || ''}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax',
    `Max-Age=${days > 0 ? days * 86400 : 0}`,
  ];
  return parts.join('; ');
}
function readCookie(req) {
  const raw = req.headers.get('cookie') || '';
  const hit = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE + '='));
  return hit ? hit.slice(COOKIE.length + 1) : '';
}
async function currentUser(req, s) {
  const p = verify(readCookie(req), await secret(s));
  if (!p) return null;
  const owner = await s.get('owner', { type: 'json' });
  // A session is only valid for the owner it was issued to.
  return owner && owner.id === p.sub ? owner : null;
}

/* ---------------------------------------------------------------- passwords */
const hashPw = (pw, salt) => scryptSync(pw, salt, 64).toString('hex');
function pwMatches(pw, owner) {
  const a = Buffer.from(hashPw(pw, owner.salt), 'hex');
  const b = Buffer.from(owner.hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------------------------------------------------------------- records */
const dataKey = (owner) => `data:${owner.id}`;
async function readData(s, owner) {
  const d = await s.get(dataKey(owner), { type: 'json' });
  return d && Array.isArray(d.aircraft) ? d : { aircraft: [], jobs: [] };
}
const writeData = (s, owner, d) => s.setJSON(dataKey(owner), d);

const AC_FIELDS = ['airline', 'type', 'reg', 'contract_date', 'in_at', 'out_at', 'amount', 'currency', 'notes'];
const JOB_FIELDS = ['aircraft_id', 'job_date', 'job_type', 'performed_by', 'hours', 'status', 'description'];

// Only known columns are copied in, so a caller cannot inject id/user fields.
function pick(row, fields) {
  const out = {};
  for (const f of fields) if (row && Object.prototype.hasOwnProperty.call(row, f)) out[f] = row[f];
  return out;
}

/* ---------------------------------------------------------------- handler */
export default async (req) => {
  const s = store();
  const url = new URL(req.url);
  // Accept both the pretty route (/api/logs/...) and the raw function path, so the
  // module works whether it is reached via `config.path` or the netlify.toml redirect.
  const seg = url.pathname
    .replace(/^\/(?:api\/logs|\.netlify\/functions\/logs)\/?/, '')
    .split('/').filter(Boolean);
  const action = seg[0] || '';
  const id = seg[1] || '';
  const method = req.method.toUpperCase();

  let body = {};
  if (method !== 'GET' && method !== 'DELETE') {
    try { body = await req.json(); } catch { body = {}; }
  }

  try {
    /* ---------- public: is there an owner yet, and am I signed in? ---------- */
    if (action === 'status' && method === 'GET') {
      const owner = await s.get('owner', { type: 'json' });
      const me = await currentUser(req, s);
      return json({ hasOwner: !!owner, signedIn: !!me, email: me ? me.email : null });
    }

    /* ---------- one-time: claim the single owner account ---------- */
    if (action === 'setup' && method === 'POST') {
      const existing = await s.get('owner', { type: 'json' });
      if (existing) return json({ error: 'An owner account already exists. Sign in instead.' }, 409);
      const email = String(body.email || '').trim().toLowerCase();
      const pw = String(body.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400);
      if (pw.length < 10) return json({ error: 'Use a password of at least 10 characters.' }, 400);
      const salt = randomBytes(16).toString('hex');
      const owner = { id: randomUUID(), email, salt, hash: hashPw(pw, salt), createdAt: new Date().toISOString() };
      await s.setJSON('owner', owner);
      const token = sign({ sub: owner.id, exp: Date.now() + SESSION_DAYS * 86400000 }, await secret(s));
      return json({ email: owner.email }, 200, { 'set-cookie': cookieHeader(token, SESSION_DAYS) });
    }

    /* ---------- sign in ---------- */
    if (action === 'signin' && method === 'POST') {
      const owner = await s.get('owner', { type: 'json' });
      const lock = (await s.get('lockout', { type: 'json' })) || { fails: 0, until: 0 };
      if (lock.until > Date.now()) {
        const mins = Math.ceil((lock.until - Date.now()) / 60000);
        return json({ error: `Too many attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` }, 429);
      }
      const email = String(body.email || '').trim().toLowerCase();
      const pw = String(body.password || '');
      const ok = owner && email === owner.email && pw && pwMatches(pw, owner);
      if (!ok) {
        const fails = lock.fails + 1;
        await s.setJSON('lockout', {
          fails: fails >= MAX_FAILS ? 0 : fails,
          until: fails >= MAX_FAILS ? Date.now() + LOCK_MINUTES * 60000 : 0,
        });
        return json({ error: 'Wrong email or password.' }, 401);
      }
      await s.setJSON('lockout', { fails: 0, until: 0 });
      const token = sign({ sub: owner.id, exp: Date.now() + SESSION_DAYS * 86400000 }, await secret(s));
      return json({ email: owner.email }, 200, { 'set-cookie': cookieHeader(token, SESSION_DAYS) });
    }

    /* ---------- sign out ---------- */
    if (action === 'signout' && method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': cookieHeader('', 0) });
    }

    /* ================= everything below needs a session ================= */
    const owner = await currentUser(req, s);
    if (!owner) return json({ error: 'Not signed in.' }, 401);

    if (action === 'data' && method === 'GET') {
      return json({ data: await readData(s, owner) });
    }

    if (action === 'aircraft' || action === 'jobs') {
      const d = await readData(s, owner);
      const list = action === 'aircraft' ? d.aircraft : d.jobs;
      const fields = action === 'aircraft' ? AC_FIELDS : JOB_FIELDS;

      if (method === 'POST') {
        const rows = Array.isArray(body.rows) ? body.rows : [body.row || body];
        const made = rows.map((r) => {
          const row = { id: randomUUID(), ...pick(r, fields), created_at: new Date().toISOString() };
          if (action === 'aircraft' && !row.currency) row.currency = 'GHS';
          return row;
        });
        // A job may only attach to an aircraft this owner has.
        if (action === 'jobs' && made.some((j) => !d.aircraft.find((a) => a.id === j.aircraft_id))) {
          return json({ error: 'Unknown aircraft for this job.' }, 400);
        }
        list.push(...made);
        await writeData(s, owner, d);
        return json({ data: made });
      }

      if (method === 'PATCH' && id) {
        const i = list.findIndex((r) => r.id === id);
        if (i < 0) return json({ error: 'Not found.' }, 404);
        list[i] = { ...list[i], ...pick(body.row || body, fields) };
        await writeData(s, owner, d);
        return json({ data: [list[i]] });
      }

      if (method === 'DELETE' && id) {
        const i = list.findIndex((r) => r.id === id);
        if (i < 0) return json({ error: 'Not found.' }, 404);
        list.splice(i, 1);
        // Deleting an aircraft takes its job sheets with it (the cascade is intentional).
        if (action === 'aircraft') d.jobs = d.jobs.filter((j) => j.aircraft_id !== id);
        await writeData(s, owner, d);
        return json({ data: [] });
      }
    }

    return json({ error: 'Unknown request.' }, 404);
  } catch (err) {
    console.error('logs api', err);
    return json({ error: 'Server error. Please try again.' }, 500);
  }
};

export const config = {
  path: ['/api/logs/:action', '/api/logs/:action/:id'],
};
