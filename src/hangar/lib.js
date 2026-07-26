// Pure helpers for the Hangar Log module — no Supabase, no DOM, no globals.
// Kept dependency-free so they can be unit-tested directly (see test/hangar.test.mjs).

export function pad(n) { return String(n).padStart(2, '0'); }

// Client-local date/time, read from the device's own clock and zone.
export function todayLocal(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
export function nowLocal() {
  const d = new Date();
  return todayLocal(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// datetime-local <-> UTC ISO. toInput uses the local getters, so a time stored as
// UTC reads back at the same wall-clock in the viewer's zone (09:30 Accra -> 09:30).
export function toInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return todayLocal(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
export function toISO(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}
export function departureBeforeArrival(inISO, outISO) {
  return !!(inISO && outISO && new Date(outISO) < new Date(inISO));
}

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Formatting — no fixed locale, so dates/times/currency follow the viewer's device.
export function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}
export function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
export function fmtMoney(a, cur) {
  if (a === '' || a == null || isNaN(a)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: cur || 'GHS', maximumFractionDigits: 2,
    }).format(Number(a));
  } catch (e) {
    return (cur || '') + ' ' + Number(a).toLocaleString();
  }
}
export function duration(a, b) {
  if (!a || !b) return '—';
  const ms = new Date(b) - new Date(a);
  if (isNaN(ms) || ms < 0) return '—';
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
  return d > 0 ? d + 'd ' + (h % 24) + 'h' : h + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
}
export function statusOf(ac) {
  if (ac.outAt) return { cls: 'out', label: 'Released' };
  if (ac.inAt) return { cls: 'in', label: 'In hangar' };
  return { cls: 'wait', label: 'Expected' };
}
export function acLabel(ac) {
  return ac.airline + ' · ' + ac.type + (ac.reg ? ' (' + ac.reg + ')' : '');
}

// snake_case DB row <-> camelCase in-memory shape.
export function acFromRow(r) {
  return {
    id: r.id, airline: r.airline, type: r.type, reg: r.reg, contractDate: r.contract_date,
    inAt: r.in_at, outAt: r.out_at, amount: r.amount, currency: r.currency, notes: r.notes,
  };
}
export function jobFromRow(r) {
  return {
    id: r.id, aircraftId: r.aircraft_id, date: r.job_date, jobType: r.job_type,
    by: r.performed_by, hours: r.hours, status: r.status, desc: r.description, createdAt: r.created_at,
  };
}

// Restore: aircraft ids in a backup may be arbitrary strings (from the offline app).
// Insert aircraft first, then map old id -> newly-issued uuid to keep jobs attached.
// Empty strings become null; numeric strings become numbers.
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
export function aircraftRowsFromBackup(d) {
  return (d.aircraft || []).map((a) => ({
    airline: a.airline, type: a.type, reg: a.reg || null,
    contract_date: a.contractDate || null, in_at: toISO(a.inAt), out_at: toISO(a.outAt),
    amount: numOrNull(a.amount), currency: a.currency || 'GHS', notes: a.notes || null,
  }));
}
export function jobRowsFromBackup(d, idMap) {
  return (d.jobs || []).filter((j) => idMap[j.aircraftId]).map((j) => ({
    aircraft_id: idMap[j.aircraftId], job_date: j.date || null, job_type: j.jobType || null,
    performed_by: j.by || null, hours: numOrNull(j.hours), status: j.status || null,
    description: j.desc || '',
  }));
}

// CSV: one row per job, each carrying its aircraft columns; aircraft with no jobs still
// get a row. Leading UTF-8 BOM so Excel renders the Ghana Cedi symbol.
export function csvString(db) {
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const header = ['Airline', 'Aircraft type', 'Registration', 'Contract signed', 'In hangar',
    'Out of hangar', 'Duration', 'Amount', 'Currency', 'Job date', 'Job type', 'Performed by',
    'Man-hours', 'Job status', 'Description'];
  const lines = [header.map(q).join(',')];
  (db.aircraft || []).forEach((a) => {
    const js = (db.jobs || []).filter((j) => j.aircraftId === a.id);
    const base = [a.airline, a.type, a.reg, a.contractDate, fmtDateTime(a.inAt),
      fmtDateTime(a.outAt), duration(a.inAt, a.outAt), a.amount, a.currency];
    if (!js.length) lines.push(base.concat(['', '', '', '', '', '']).map(q).join(','));
    else js.forEach((j) => lines.push(
      base.concat([j.date, j.jobType, j.by, j.hours, j.status, j.desc]).map(q).join(',')));
  });
  return '﻿' + lines.join('\r\n');
}
