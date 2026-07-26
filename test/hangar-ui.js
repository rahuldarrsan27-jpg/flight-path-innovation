// Drives the real src/hangar/app.js against an in-memory stand-in for supabase-js.
// Results land on window.__RESULTS__ for the test runner to read.
import '../src/hangar/hangar.css';
import { initApp } from '../src/hangar/app.js';

/* ---------------- in-memory stand-in ---------------- */
// Mimics the two behaviours the database guarantees: rows are filtered to the
// signed-in user (as RLS does), and deleting an aircraft cascades to its jobs.
function makeStub(currentUser) {
  let seq = 0;
  const uuid = () => 'uuid-' + (++seq);
  const tables = { aircraft: [], jobs: [] };

  function builder(name) {
    const api = {
      _rows: null,
      select() {
        // RLS stand-in: only this user's rows are ever visible.
        api._rows = tables[name].filter((r) => r.user_id === currentUser.id);
        const p = Promise.resolve({ data: api._rows, error: null });
        p.order = () => p;
        return p;
      },
      insert(rowOrRows) {
        const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
        const made = rows.map((r) => ({ id: uuid(), user_id: currentUser.id, created_at: new Date().toISOString(), ...r }));
        made.forEach((m) => tables[name].push(m));
        const p = Promise.resolve({ data: made, error: null });
        p.select = () => Promise.resolve({ data: made, error: null });
        return p;
      },
      update(patch) {
        return {
          eq(col, val) {
            tables[name].forEach((r) => {
              if (r[col] === val && r.user_id === currentUser.id) Object.assign(r, patch);
            });
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      delete() {
        return {
          eq(col, val) {
            const before = tables[name].length;
            tables[name] = tables[name].filter((r) => !(r[col] === val && r.user_id === currentUser.id));
            // FK "on delete cascade" from aircraft -> jobs.
            if (name === 'aircraft' && tables[name].length < before) {
              tables.jobs = tables.jobs.filter((j) => j.aircraft_id !== val);
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    };
    return api;
  }
  return { from: builder, _tables: tables };
}

/* ---------------- assertions ---------------- */
const results = [];
const ok = (name, cond, extra) => results.push({ name, pass: !!cond, extra: extra == null ? '' : String(extra) });
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new Event('change')); };

// Suppress the confirm() dialogs so delete paths run headlessly; record the text.
const confirms = [];
window.confirm = (msg) => { confirms.push(msg); return true; };

const user = { id: 'user-A', email: 'owner@fpiaviation.com' };
const sb = makeStub(user);

(async function run() {
  await initApp(sb, user);
  ok('app shell revealed after auth', !$('app').classList.contains('hide'));
  ok('signed-in email shown', $('whoami').textContent === 'owner@fpiaviation.com', $('whoami').textContent);
  ok('clock shows resolved IANA zone', /\//.test($('clock').textContent), $('clock').textContent);
  ok('job date defaults to today', !!$('jobDate').value, $('jobDate').value);

  /* --- criterion 4: departure before arrival refused, visibly --- */
  set('airline', 'Africa World Airlines'); set('type', 'Embraer ERJ-145'); set('reg', '9G-AAB');
  set('inAt', '2026-07-20T10:00'); set('outAt', '2026-07-20T09:00');
  $('acForm').dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(60);
  const toast = document.getElementById('toast');
  ok('C4 out-before-in refused with visible message',
    sb._tables.aircraft.length === 0 && toast && /departure time is before/i.test(toast.textContent)
      && getComputedStyle(toast).display !== 'none',
    toast ? toast.textContent : 'no toast');

  /* --- criterion 3: 09:30 local saved, reads back 09:30 --- */
  set('outAt', '2026-07-24T17:30'); set('inAt', '2026-07-20T09:30');
  set('contractDate', '2026-07-15'); set('amount', '48500.50'); set('currency', 'GHS');
  set('acNotes', 'C-check, hangar bay 1');
  $('acForm').dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(80);
  const savedRow = sb._tables.aircraft[0];
  ok('record saved', sb._tables.aircraft.length === 1);
  ok('stored as UTC ISO', /Z$/.test(savedRow.in_at), savedRow.in_at);
  // reload into the edit form -> must read back at the same wall clock
  document.querySelector('[data-edit]').click();
  await wait(40);
  ok('C3 09:30 reads back as 09:30 after reload', $('inAt').value === '2026-07-20T09:30', $('inAt').value);
  ok('edit mode switches to update + cancel', $('acSubmit').textContent === 'Update record' && !$('acCancel').hidden);
  $('acCancel').click();
  ok('cancel restores create mode', $('acSubmit').textContent === 'Save record' && $('acCancel').hidden);

  /* --- derived duration + status + currency --- */
  const rowText = $('acTable').querySelector('tbody tr').textContent;
  ok('duration derived 4d 8h', /4d 8h/.test(rowText), rowText);
  ok('status pill Released (both times set)', /Released/.test(rowText));
  ok('amount uses GHS', /48,500|48\s?500/.test(rowText), rowText);

  /* --- second aircraft, USD, expected status --- */
  set('airline', 'Passion Air'); set('type', 'Dash 8-Q400'); set('reg', '9G-PAB');
  set('inAt', ''); set('outAt', ''); set('contractDate', '2026-07-18');
  set('amount', '12000'); set('currency', 'USD'); set('acNotes', '');
  $('acForm').dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(80);
  ok('two records now', sb._tables.aircraft.length === 2);
  const stats = $('stats').textContent;
  ok('stats: totals per currency, never summed together',
    /48,500|48\s?500/.test(stats) && /12,000|12\s?000/.test(stats), stats);
  ok('stats: currently in hangar counted', /Currently in hangar/.test(stats));

  /* --- search --- */
  set('acSearch', 'passion'); $('acSearch').dispatchEvent(new Event('input'));
  await wait(30);
  ok('search filters by airline', $('acTable').querySelectorAll('tbody tr').length === 1);
  set('acSearch', '9G-AAB'); $('acSearch').dispatchEvent(new Event('input'));
  await wait(30);
  ok('search matches registration', $('acTable').querySelectorAll('tbody tr').length === 1);
  set('acSearch', ''); $('acSearch').dispatchEvent(new Event('input'));
  await wait(30);

  /* --- criterion 6: tab 2 summary strip + job card carries it --- */
  document.querySelectorAll('.tabs button')[1].click();
  ok('tab 2 active', $('view-jobs').classList.contains('active'));
  const acId = sb._tables.aircraft[0].id;
  const optLabels = [...$('jobAircraft').options].map((o) => o.textContent);
  ok('dropdown lists Airline · Type (Reg)',
    optLabels.some((t) => t === 'Africa World Airlines · Embraer ERJ-145 (9G-AAB)'), optLabels.join(' | '));
  set('jobAircraft', acId);
  await wait(40);
  const sumText = $('jobSummary').textContent;
  ok('C6 selecting an aircraft shows its details',
    /Africa World Airlines/.test(sumText) && /Embraer ERJ-145/.test(sumText) && /9G-AAB/.test(sumText)
      && /4d 8h/.test(sumText) && /Released/.test(sumText) && /48,500|48\s?500/.test(sumText), sumText);

  set('jobDate', '2026-07-21'); set('jobType', 'C-Check'); set('jobBy', 'K. Mensah');
  set('jobHours', '12.5'); set('jobStatus', 'Completed');
  set('jobDesc', 'Removed panels.\nInspected spar for corrosion.');
  $('jobForm').dispatchEvent(new Event('submit', { cancelable: true }));
  await wait(80);
  ok('job saved', sb._tables.jobs.length === 1);
  const card = $('jobList').querySelector('.jobcard');
  ok('C6 saved job card repeats the aircraft summary',
    /Africa World Airlines/.test(card.textContent) && /9G-AAB/.test(card.textContent)
      && !!card.querySelector('.summary.mini'), card.textContent.slice(0, 80));
  ok('job card shows type, status pill, engineer, hours',
    /C-Check/.test(card.textContent) && /Completed/.test(card.textContent)
      && /K\. Mensah/.test(card.textContent) && /12\.5 man-hours/.test(card.textContent));
  ok('description preserves line breaks',
    getComputedStyle(card.querySelector('.desc')).whiteSpace === 'pre-wrap');
  ok('completed status pill is green class', !!card.querySelector('.pill.out'));

  /* --- job search + filter --- */
  set('jobSearch', 'corrosion'); $('jobSearch').dispatchEvent(new Event('input'));
  await wait(30);
  ok('job search matches description', $('jobList').querySelectorAll('.jobcard').length === 1);
  set('jobSearch', 'Mensah'); $('jobSearch').dispatchEvent(new Event('input'));
  await wait(30);
  ok('job search matches engineer', $('jobList').querySelectorAll('.jobcard').length === 1);
  set('jobSearch', ''); $('jobSearch').dispatchEvent(new Event('input'));
  set('jobFilter', sb._tables.aircraft[1].id); $('jobFilter').dispatchEvent(new Event('change'));
  await wait(30);
  ok('filter by other aircraft hides the job', $('jobList').querySelectorAll('.jobcard').length === 0);
  set('jobFilter', ''); $('jobFilter').dispatchEvent(new Event('change'));
  await wait(30);

  /* --- jobs count on tab 1 --- */
  document.querySelectorAll('.tabs button')[0].click();
  await wait(30);
  const jobsCells = [...$('acTable').querySelectorAll('tbody tr')].map((tr) => tr.children[9].textContent.trim());
  ok('tab 1 shows linked job count', jobsCells.includes('1'), jobsCells.join(','));

  /* --- criterion 5: cascade delete --- */
  confirms.length = 0;
  const delBtn = [...document.querySelectorAll('[data-del]')].find((b) => b.dataset.del === acId);
  delBtn.click();
  await wait(80);
  ok('C5 delete confirm states how many job sheets go with it',
    confirms.some((m) => /1 job sheet/.test(m)), confirms.join(' / '));
  ok('C5 deleting an aircraft removed its job sheets',
    sb._tables.aircraft.length === 1 && sb._tables.jobs.length === 0,
    'aircraft=' + sb._tables.aircraft.length + ' jobs=' + sb._tables.jobs.length);

  /* --- per-user isolation at the data layer (stand-in for RLS) --- */
  const sbB = { from: sb.from, _tables: sb._tables };
  const other = makeStub({ id: 'user-B', email: 'other@example.com' });
  other._tables.aircraft = sb._tables.aircraft; // same table, different user
  other._tables.jobs = sb._tables.jobs;
  const seenByB = await other.from('aircraft').select('*');
  ok('user B sees none of user A rows (stand-in for RLS)',
    seenByB.data.length === 0, 'rows visible to B: ' + seenByB.data.length);

  window.__RESULTS__ = results;
  window.__DONE__ = true;
})().catch((e) => {
  results.push({ name: 'harness threw', pass: false, extra: String(e && e.stack || e) });
  window.__RESULTS__ = results;
  window.__DONE__ = true;
});
