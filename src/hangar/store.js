// Data access for the Hangar Log, talking to the site's own /api/logs function.
//
// Deliberately shaped like the supabase-js query builder (`from().select()`,
// `.insert()`, `.update().eq()`, `.delete().eq()`, resolving to `{ data, error }`)
// so the application code reads the same as the reference implementation it was
// ported from. The session travels as an HttpOnly cookie, so there is no token
// for this module to hold or leak.

const BASE = '/api/logs';

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { data: null, error: { message: 'No connection. Check your signal and try again.' }, status: 0 };
  }
  let payload = {};
  try { payload = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    return { data: null, error: { message: payload.error || res.statusText || 'Request failed' }, status: res.status };
  }
  return { data: payload.data !== undefined ? payload.data : payload, error: null, status: res.status };
}

/* ---------------------------------------------------------------- auth */
export const auth = {
  status: () => call('GET', '/status'),
  setup: (email, password) => call('POST', '/setup', { email, password }),
  signIn: (email, password) => call('POST', '/signin', { email, password }),
  signOut: () => call('POST', '/signout'),
};

/* ---------------------------------------------------------------- records */
// in_at descending with nulls last, matching the reference ordering.
function orderInAtDesc(rows) {
  return rows.slice().sort((a, b) => {
    if (!a.in_at && !b.in_at) return 0;
    if (!a.in_at) return 1;
    if (!b.in_at) return -1;
    return String(b.in_at).localeCompare(String(a.in_at));
  });
}

class Query {
  constructor(table) {
    this.table = table;
    this.op = null;
    this.payload = null;
    this.id = null;
    this.ordered = false;
  }
  select() { if (!this.op) this.op = 'select'; return this; }
  order() { this.ordered = true; return this; }
  insert(rows) { this.op = 'insert'; this.payload = rows; return this; }
  update(row) { this.op = 'update'; this.payload = row; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(_col, val) { this.id = val; return this; }

  async run() {
    if (this.op === 'select') {
      const r = await call('GET', '/data');
      if (r.error) return r;
      const rows = (r.data && r.data[this.table]) || [];
      return { data: this.ordered ? orderInAtDesc(rows) : rows, error: null };
    }
    if (this.op === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      return call('POST', '/' + this.table, { rows });
    }
    if (this.op === 'update') return call('PATCH', '/' + this.table + '/' + this.id, { row: this.payload });
    if (this.op === 'delete') return call('DELETE', '/' + this.table + '/' + this.id);
    return { data: null, error: { message: 'Unsupported query' } };
  }
  // Thenable, so `await` and `.then()` both work like the supabase builder.
  then(onOk, onErr) { return this.run().then(onOk, onErr); }
}

export const store = {
  from: (table) => new Query(table),
};
