// In-memory stand-in for @netlify/blobs, so the real API handler can be driven in tests.
const stores = new Map();

export function getStore(opts) {
  const name = typeof opts === 'string' ? opts : opts.name;
  if (!stores.has(name)) stores.set(name, new Map());
  const m = stores.get(name);
  return {
    async get(key, o) {
      const v = m.get(key);
      if (v === undefined) return null;
      return o && o.type === 'json' ? JSON.parse(v) : v;
    },
    async set(key, val) { m.set(key, String(val)); },
    async setJSON(key, val) { m.set(key, JSON.stringify(val)); },
    async delete(key) { m.delete(key); },
  };
}

export function __reset() { stores.clear(); }
export function __raw(name) { return stores.get(name); }
