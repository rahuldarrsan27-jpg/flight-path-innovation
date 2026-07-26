// Drives the real /api/logs handler (netlify/functions/logs.mjs) against an
// in-memory Blobs stub. The only edit to the source is the blobs import path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Materialise the handler with the blobs import swapped for the stub.
const dir = mkdtempSync(join(tmpdir(), 'logs-api-'));
cpSync(join(here, 'blobs-stub.mjs'), join(dir, 'blobs-stub.mjs'));
const src = readFileSync(join(root, 'netlify/functions/logs.mjs'), 'utf8')
  .replace("from '@netlify/blobs'", "from './blobs-stub.mjs'");
writeFileSync(join(dir, 'logs.mjs'), src);

const { default: handler } = await import(join(dir, 'logs.mjs'));
const stub = await import(join(dir, 'blobs-stub.mjs'));

const URLBASE = 'https://fpiaviation.com/api/logs/';
function req(method, path, { body, cookie } = {}) {
  const headers = {};
  const sendBody = body && method !== 'GET' && method !== 'HEAD';
  if (sendBody) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return new Request(URLBASE + path, {
    method, headers, body: sendBody ? JSON.stringify(body) : undefined,
  });
}
async function call(method, path, opts) {
  const res = await handler(req(method, path, opts));
  let json = null;
  try { json = JSON.parse(await res.clone().text()); } catch { /* empty */ }
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
}
const cookieFrom = (setCookie) => setCookie.split(';')[0];

const EMAIL = 'owner@fpiaviation.com';
const PW = 'a-strong-hangar-pass';

test('signed out: no owner yet, and data routes expose nothing', async () => {
  stub.__reset();
  const status = await call('GET', 'status');
  assert.equal(status.status, 200);
  assert.equal(status.json.hasOwner, false);
  assert.equal(status.json.signedIn, false);

  // Direct API call with no session must be refused, with no records in the body.
  for (const [m, p] of [['GET', 'data'], ['POST', 'aircraft'], ['POST', 'jobs']]) {
    const r = await call(m, p, { body: { rows: [{ airline: 'X', type: 'Y' }] } });
    assert.equal(r.status, 401, `${m} /${p} should be 401`);
    assert.equal(r.json.error, 'Not signed in.');
    assert.equal(r.json.data, undefined);
  }
});

test('setup claims the single owner, then sign-ups are closed for good', async () => {
  stub.__reset();
  const weak = await call('POST', 'setup', { body: { email: EMAIL, password: 'short' } });
  assert.equal(weak.status, 400);

  const made = await call('POST', 'setup', { body: { email: EMAIL, password: PW } });
  assert.equal(made.status, 200);
  assert.match(made.setCookie, /^fpi_logs=/);
  assert.match(made.setCookie, /HttpOnly/);
  assert.match(made.setCookie, /Secure/);
  assert.match(made.setCookie, /SameSite=Lax/);

  // Any later attempt to create an account is refused — no dashboard toggle needed.
  const again = await call('POST', 'setup', { body: { email: 'someone@else.com', password: 'another-long-pass' } });
  assert.equal(again.status, 409);
});

test('sign-in rejects a wrong password and accepts the right one', async () => {
  stub.__reset();
  await call('POST', 'setup', { body: { email: EMAIL, password: PW } });

  const bad = await call('POST', 'signin', { body: { email: EMAIL, password: 'wrong-password-here' } });
  assert.equal(bad.status, 401);
  assert.equal(bad.setCookie, null);

  const good = await call('POST', 'signin', { body: { email: EMAIL, password: PW } });
  assert.equal(good.status, 200);
  assert.match(good.setCookie, /HttpOnly/);
});

test('a tampered or forged session cookie is refused', async () => {
  stub.__reset();
  const s = await call('POST', 'setup', { body: { email: EMAIL, password: PW } });
  const cookie = cookieFrom(s.setCookie);

  // flip a character in the signature
  const tampered = cookie.slice(0, -1) + (cookie.slice(-1) === 'a' ? 'b' : 'a');
  assert.equal((await call('GET', 'data', { cookie: tampered })).status, 401);

  // re-sign the same payload with an attacker's key
  const body = cookie.split('=')[1].split('.')[0];
  const forged = 'fpi_logs=' + body + '.' + createHmac('sha256', 'attacker-key').update(body).digest('base64url');
  assert.equal((await call('GET', 'data', { cookie: forged })).status, 401);

  // a valid signature over a *different* owner id is still refused
  const secret = await (await import(join(dir, 'blobs-stub.mjs'))).getStore({ name: 'fpi-logs' }).get('secret');
  const other = Buffer.from(JSON.stringify({ sub: 'not-the-owner', exp: Date.now() + 1e6 })).toString('base64url');
  const wrongSub = 'fpi_logs=' + other + '.' + createHmac('sha256', secret).update(other).digest('base64url');
  assert.equal((await call('GET', 'data', { cookie: wrongSub })).status, 401);

  // and the genuine cookie still works
  assert.equal((await call('GET', 'data', { cookie })).status, 200);
});

test('an expired session is refused', async () => {
  stub.__reset();
  await call('POST', 'setup', { body: { email: EMAIL, password: PW } });
  const store = (await import(join(dir, 'blobs-stub.mjs'))).getStore({ name: 'fpi-logs' });
  const secret = await store.get('secret');
  const owner = await store.get('owner', { type: 'json' });
  const past = Buffer.from(JSON.stringify({ sub: owner.id, exp: Date.now() - 1000 })).toString('base64url');
  const expired = 'fpi_logs=' + past + '.' + createHmac('sha256', secret).update(past).digest('base64url');
  assert.equal((await call('GET', 'data', { cookie: expired })).status, 401);
});

test('records round-trip, and deleting an aircraft removes its job sheets', async () => {
  stub.__reset();
  const s = await call('POST', 'setup', { body: { email: EMAIL, password: PW } });
  const cookie = cookieFrom(s.setCookie);

  const ac = await call('POST', 'aircraft', {
    cookie,
    body: { rows: [{ airline: 'Africa World Airlines', type: 'Embraer ERJ-145', reg: '9G-AAB', in_at: '2026-07-01T09:30:00.000Z', amount: 42000, currency: 'GHS' }] },
  });
  assert.equal(ac.status, 200);
  const acId = ac.json.data[0].id;
  assert.match(acId, /^[0-9a-f-]{36}$/);
  assert.equal(ac.json.data[0].currency, 'GHS');

  const j = await call('POST', 'jobs', {
    cookie, body: { rows: [{ aircraft_id: acId, job_type: 'A-Check', description: 'line 1\nline 2', hours: 12.5 }] },
  });
  assert.equal(j.status, 200);
  const jobId = j.json.data[0].id;

  // a job cannot attach to an aircraft that does not exist
  const orphan = await call('POST', 'jobs', { cookie, body: { rows: [{ aircraft_id: 'nope', description: 'x' }] } });
  assert.equal(orphan.status, 400);

  // update
  const upd = await call('PATCH', 'jobs/' + jobId, { cookie, body: { row: { status: 'Completed' } } });
  assert.equal(upd.status, 200);
  assert.equal(upd.json.data[0].status, 'Completed');

  let data = (await call('GET', 'data', { cookie })).json.data;
  assert.equal(data.aircraft.length, 1);
  assert.equal(data.jobs.length, 1);
  assert.equal(data.jobs[0].description, 'line 1\nline 2', 'line breaks preserved');

  // cascade
  assert.equal((await call('DELETE', 'aircraft/' + acId, { cookie })).status, 200);
  data = (await call('GET', 'data', { cookie })).json.data;
  assert.equal(data.aircraft.length, 0);
  assert.equal(data.jobs.length, 0, 'job sheets deleted with their aircraft');
});

test('client-supplied id/user fields are ignored on write', async () => {
  stub.__reset();
  const s = await call('POST', 'setup', { body: { email: EMAIL, password: PW } });
  const cookie = cookieFrom(s.setCookie);
  const r = await call('POST', 'aircraft', {
    cookie, body: { rows: [{ id: 'attacker-chosen', user_id: 'someone-else', airline: 'A', type: 'B' }] },
  });
  assert.notEqual(r.json.data[0].id, 'attacker-chosen');
  assert.equal(r.json.data[0].user_id, undefined);
});

test('sign-out clears the cookie', async () => {
  stub.__reset();
  await call('POST', 'setup', { body: { email: EMAIL, password: PW } });
  const out = await call('POST', 'signout');
  assert.equal(out.status, 200);
  assert.match(out.setCookie, /Max-Age=0/);
});

test('repeated wrong passwords lock sign-in temporarily', async () => {
  stub.__reset();
  await call('POST', 'setup', { body: { email: EMAIL, password: PW } });
  let last;
  for (let i = 0; i < 11; i++) {
    last = await call('POST', 'signin', { body: { email: EMAIL, password: 'nope-nope-nope' } });
  }
  assert.equal(last.status, 429, 'locked out after repeated failures');
  // even the correct password is held off while locked
  assert.equal((await call('POST', 'signin', { body: { email: EMAIL, password: PW } })).status, 429);
});
