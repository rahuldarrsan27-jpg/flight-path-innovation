// Pure-logic checks for the Hangar Log helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toInput, toISO, departureBeforeArrival, duration, statusOf, acLabel,
  fmtMoney, aircraftRowsFromBackup, jobRowsFromBackup, csvString,
} from '../src/hangar/lib.js';

test('a time entered locally reads back at the same wall clock', () => {
  // 09:30 typed into a datetime-local box -> stored UTC -> back into the box.
  const typed = '2026-07-01T09:30';
  const stored = toISO(typed);
  assert.match(stored, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'stored as UTC ISO');
  assert.equal(toInput(stored), typed, 'round-trips to 09:30 in the viewer zone');
});

test('departure before arrival is detected', () => {
  const inAt = toISO('2026-07-01T09:30');
  assert.equal(departureBeforeArrival(inAt, toISO('2026-07-01T08:00')), true);
  assert.equal(departureBeforeArrival(inAt, toISO('2026-07-05T16:30')), false);
  assert.equal(departureBeforeArrival(inAt, null), false, 'still in hangar is fine');
  assert.equal(departureBeforeArrival(null, toISO('2026-07-05T16:30')), false);
});

test('duration is derived, never stored', () => {
  assert.equal(duration(toISO('2026-07-01T09:00'), toISO('2026-07-05T16:00')), '4d 7h');
  assert.equal(duration(toISO('2026-07-01T09:00'), toISO('2026-07-01T14:30')), '5h 30m');
  assert.equal(duration(toISO('2026-07-01T09:00'), null), '—');
});

test('status is derived from arrival and departure', () => {
  assert.equal(statusOf({}).label, 'Expected');
  assert.equal(statusOf({ inAt: 'x' }).label, 'In hangar');
  assert.equal(statusOf({ inAt: 'x', outAt: 'y' }).label, 'Released');
  assert.equal(statusOf({ inAt: 'x' }).cls, 'in');       // amber
  assert.equal(statusOf({ inAt: 'x', outAt: 'y' }).cls, 'out'); // green
  assert.equal(statusOf({}).cls, 'wait');                // grey
});

test('aircraft label matches the Tab 2 dropdown format', () => {
  assert.equal(acLabel({ airline: 'Passion Air', type: 'Dash 8-Q400', reg: '9G-PSN' }),
    'Passion Air · Dash 8-Q400 (9G-PSN)');
  assert.equal(acLabel({ airline: 'Passion Air', type: 'Dash 8-Q400' }), 'Passion Air · Dash 8-Q400');
});

test('money uses the row currency and never mixes them', () => {
  assert.ok(fmtMoney(1000, 'GHS').includes('1,000'));
  assert.ok(fmtMoney(1000, 'USD').includes('1,000'));
  assert.notEqual(fmtMoney(1000, 'GHS'), fmtMoney(1000, 'USD'), 'GHS and USD render differently');
  assert.equal(fmtMoney(null, 'GHS'), '—');
  assert.equal(fmtMoney('', 'GHS'), '—');
});

test('restore maps arbitrary string ids so jobs stay attached', () => {
  const backup = {
    aircraft: [
      { id: 'lx8f2a', airline: 'Africa World Airlines', type: 'Embraer ERJ-145', reg: '9G-AAB', amount: '42000', inAt: '2026-07-01T09:30' },
      { id: '7', airline: 'Passion Air', type: 'Dash 8-Q400', reg: '', amount: '' },
    ],
    jobs: [
      { aircraftId: '7', desc: 'Wheel change', hours: '3.5' },
      { aircraftId: 'lx8f2a', desc: 'A-Check', hours: '' },
      { aircraftId: 'ghost', desc: 'orphan — dropped' },
    ],
  };

  const acRows = aircraftRowsFromBackup(backup);
  assert.equal(acRows.length, 2);
  assert.equal(acRows[0].amount, 42000, 'numeric string became a number');
  assert.equal(acRows[1].amount, null, 'empty string became null');
  assert.equal(acRows[1].reg, null, 'empty string became null');
  assert.equal(acRows[1].currency, 'GHS', 'GHS is the default');
  assert.match(acRows[0].in_at, /Z$/, 'local datetime stored as UTC');

  // ids the database would issue, in insert order
  const idMap = { lx8f2a: 'uuid-A', 7: 'uuid-B' };
  const jobRows = jobRowsFromBackup(backup, idMap);
  assert.equal(jobRows.length, 2, 'the orphan job is dropped');
  assert.equal(jobRows[0].aircraft_id, 'uuid-B', 'Wheel change stayed with Passion Air');
  assert.equal(jobRows[1].aircraft_id, 'uuid-A', 'A-Check stayed with Africa World Airlines');
  assert.equal(jobRows[0].hours, 3.5);
  assert.equal(jobRows[1].hours, null);
});

test('CSV carries a BOM, one row per job, and a row for jobless aircraft', () => {
  const csv = csvString({
    aircraft: [
      { id: 'a1', airline: 'Africa World Airlines', type: 'Embraer ERJ-145', reg: '9G-AAB', amount: 42000, currency: 'GHS' },
      { id: 'a2', airline: 'Passion Air', type: 'Dash 8-Q400', reg: '9G-PSN', amount: 15000, currency: 'USD' },
    ],
    jobs: [
      { aircraftId: 'a1', jobType: 'A-Check', desc: 'Done', hours: 12 },
      { aircraftId: 'a1', jobType: 'Engine', desc: 'Borescope "clean"', hours: 4 },
    ],
  });
  assert.equal(csv.charCodeAt(0), 0xfeff, 'starts with a UTF-8 BOM for Excel');
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  assert.equal(lines.length, 4, 'header + 2 jobs + 1 jobless aircraft');
  assert.ok(lines[0].startsWith('"Airline"'));
  assert.ok(lines[1].includes('Africa World Airlines') && lines[1].includes('A-Check'));
  assert.ok(lines[2].includes('""clean""'), 'quotes escaped');
  assert.ok(lines[3].includes('Passion Air'), 'aircraft with no jobs still gets a row');
});
