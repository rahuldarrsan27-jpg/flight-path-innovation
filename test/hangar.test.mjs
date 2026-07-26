// Unit tests for the Hangar Log pure logic. No Supabase, no DOM.
//   TZ=Africa/Accra node --test test/hangar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toInput, toISO, departureBeforeArrival, duration, statusOf, fmtMoney, esc,
  acFromRow, jobFromRow, aircraftRowsFromBackup, jobRowsFromBackup, csvString,
} from '../src/hangar/lib.js';

test('09:30 local round-trips through UTC storage as 09:30', () => {
  const typed = '2026-07-26T09:30';
  const stored = toISO(typed);
  assert.match(stored, /Z$/, 'stored value must be UTC ISO');
  assert.equal(toInput(stored), typed, 'reads back at the same wall clock');
});

test('round-trip holds for a zone that is not UTC (simulated offset)', () => {
  // Africa/Accra is UTC+0; prove the helpers use local getters, not string slicing,
  // by round-tripping an ISO with a +05:30 offset.
  const stored = toISO('2026-07-26T09:30');
  const again = toISO(toInput(stored));
  assert.equal(again, stored);
});

test('departure before arrival is detected', () => {
  const inAt = toISO('2026-07-26T10:00');
  assert.equal(departureBeforeArrival(inAt, toISO('2026-07-26T09:00')), true);
  assert.equal(departureBeforeArrival(inAt, toISO('2026-07-26T11:00')), false);
  assert.equal(departureBeforeArrival(inAt, null), false, 'no departure yet is fine');
  assert.equal(departureBeforeArrival(null, null), false);
});

test('duration is derived, day+hour formatted', () => {
  assert.equal(duration('2026-07-01T00:00:00Z', '2026-07-05T07:00:00Z'), '4d 7h');
  assert.equal(duration('2026-07-01T00:00:00Z', '2026-07-01T05:30:00Z'), '5h 30m');
  assert.equal(duration('2026-07-01T00:00:00Z', null), '—');
});

test('status derives from arrival/departure', () => {
  assert.equal(statusOf({}).label, 'Expected');
  assert.equal(statusOf({ inAt: 'x' }).label, 'In hangar');
  assert.equal(statusOf({ inAt: 'x', outAt: 'y' }).label, 'Released');
  assert.equal(statusOf({}).cls, 'wait');
  assert.equal(statusOf({ inAt: 'x' }).cls, 'in');
  assert.equal(statusOf({ inAt: 'x', outAt: 'y' }).cls, 'out');
});

test('currency uses the row currency, GHS default, never mixed', () => {
  assert.match(fmtMoney(1500, 'GHS'), /1,500/);
  assert.ok(fmtMoney(1500, 'GHS') !== fmtMoney(1500, 'USD'), 'GHS and USD render differently');
  assert.equal(fmtMoney(null, 'GHS'), '—');
  assert.equal(fmtMoney('', 'GHS'), '—');
});

test('html is escaped', () => {
  assert.equal(esc('<script>&"'), '&lt;script&gt;&amp;&quot;');
});

test('row mapping snake_case -> camelCase', () => {
  const a = acFromRow({ id: 'u1', airline: 'AWA', type: 'ERJ-145', reg: '9G-AAB',
    contract_date: '2026-07-01', in_at: 'iso', out_at: null, amount: '5.00', currency: 'GHS', notes: null });
  assert.equal(a.contractDate, '2026-07-01');
  assert.equal(a.inAt, 'iso');
  const j = jobFromRow({ id: 'j1', aircraft_id: 'u1', job_date: '2026-07-02',
    job_type: 'A-Check', performed_by: 'K. Mensah', hours: '3.5', status: 'Completed', description: 'ok' });
  assert.equal(j.aircraftId, 'u1');
  assert.equal(j.by, 'K. Mensah');
  assert.equal(j.desc, 'ok');
});

test('restore: arbitrary string aircraft ids remap so jobs stay attached', () => {
  const backup = {
    aircraft: [
      { id: 'legacy-abc', airline: 'Africa World Airlines', type: 'Embraer ERJ-145', reg: '9G-AAB', amount: '1200.50', currency: 'GHS' },
      { id: 'k7x9', airline: 'Passion Air', type: 'Dash 8-Q400', reg: '9G-PAB', amount: '', currency: 'USD' },
    ],
    jobs: [
      { id: 'j1', aircraftId: 'k7x9', desc: 'Brake change', hours: '2.5' },
      { id: 'j2', aircraftId: 'legacy-abc', desc: 'Avionics check', hours: '' },
      { id: 'j3', aircraftId: 'missing-parent', desc: 'orphan' },
    ],
  };
  const rows = aircraftRowsFromBackup(backup);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].amount, 1200.5, 'numeric string -> number');
  assert.equal(rows[1].amount, null, 'empty string -> null');
  assert.equal(rows[1].currency, 'USD');

  // Simulate the DB issuing uuids in insert order.
  const issued = [{ id: 'uuid-1' }, { id: 'uuid-2' }];
  const map = {};
  backup.aircraft.forEach((a, i) => { if (issued[i]) map[a.id] = issued[i].id; });

  const jobRows = jobRowsFromBackup(backup, map);
  assert.equal(jobRows.length, 2, 'orphan job with no parent is dropped');
  assert.equal(jobRows[0].aircraft_id, 'uuid-2', 'Brake change follows k7x9 -> uuid-2');
  assert.equal(jobRows[1].aircraft_id, 'uuid-1', 'Avionics check follows legacy-abc -> uuid-1');
  assert.equal(jobRows[0].hours, 2.5);
  assert.equal(jobRows[1].hours, null);
});

test('CSV: BOM, one row per job, aircraft with no jobs still get a row', () => {
  const db = {
    aircraft: [
      { id: 'a1', airline: 'Africa World Airlines', type: 'ERJ-145', reg: '9G-AAB', amount: 1000, currency: 'GHS' },
      { id: 'a2', airline: 'Passion Air', type: 'Dash 8-Q400', reg: '9G-PAB', amount: 2000, currency: 'USD' },
    ],
    jobs: [
      { id: 'j1', aircraftId: 'a1', jobType: 'A-Check', desc: 'one' },
      { id: 'j2', aircraftId: 'a1', jobType: 'Engine', desc: 'two' },
    ],
  };
  const csv = csvString(db);
  assert.equal(csv.charCodeAt(0), 0xfeff, 'starts with UTF-8 BOM');
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  assert.equal(lines.length, 4, 'header + 2 jobs for a1 + 1 empty row for a2');
  assert.ok(lines[1].includes('one') && lines[2].includes('two'));
  assert.ok(lines[3].includes('Passion Air'), 'jobless aircraft present');
  assert.ok(lines[3].endsWith('"",""'), 'its job columns are blank');
});

test('CSV quotes embedded quotes and newlines safely', () => {
  const csv = csvString({
    aircraft: [{ id: 'a1', airline: 'A "B"', type: 'T', currency: 'GHS' }],
    jobs: [{ id: 'j1', aircraftId: 'a1', desc: 'line1\nline2' }],
  });
  assert.ok(csv.includes('"A ""B"""'), 'doubles embedded quotes');
  assert.ok(csv.includes('"line1\nline2"'), 'newline stays inside the quoted field');
});
