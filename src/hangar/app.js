// The two-tab Hangar Log application. Receives an authenticated Supabase client
// (so it can be driven against a stand-in in tests) and wires the whole UI.
import {
  todayLocal, nowLocal, toInput, toISO, departureBeforeArrival, esc,
  fmtDate, fmtDateTime, fmtMoney, duration, statusOf, acLabel,
  acFromRow, jobFromRow, aircraftRowsFromBackup, jobRowsFromBackup, csvString,
} from './lib.js';

const $ = (id) => document.getElementById(id);

export function initApp(sb, user) {
  const db = { aircraft: [], jobs: [] };

  /* ---------- toast ---------- */
  let toastEl, toastTimer;
  function toast(msg, isErr) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = isErr ? 'err' : '';
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, isErr ? 6000 : 2600);
  }
  function fail(what, error) {
    console.error(what, error);
    toast(what + ': ' + (error && error.message ? error.message : 'unknown error'), true);
  }

  /* ---------- load ---------- */
  function refresh() {
    return Promise.all([
      sb.from('aircraft').select('*').order('in_at', { ascending: false, nullsFirst: false }),
      sb.from('jobs').select('*'),
    ]).then((res) => {
      if (res[0].error) return fail('Could not load aircraft', res[0].error);
      if (res[1].error) return fail('Could not load jobs', res[1].error);
      db.aircraft = res[0].data.map(acFromRow);
      db.jobs = res[1].data.map(jobFromRow);
      renderAll();
    });
  }

  /* ---------- tabs + now links ---------- */
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.view').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      $('view-' + b.dataset.tab).classList.add('active');
    });
  });
  document.querySelectorAll('button.now').forEach((b) => {
    b.addEventListener('click', () => {
      const el = $(b.dataset.now);
      el.value = el.type === 'date' ? todayLocal() : nowLocal();
      el.dispatchEvent(new Event('change'));
    });
  });

  /* ================= TAB 1: aircraft ================= */
  const acForm = $('acForm');
  acForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('acId').value;
    const row = {
      airline: $('airline').value.trim(),
      type: $('type').value.trim(),
      reg: $('reg').value.trim() || null,
      serial: $('serial').value.trim() || null,
      contract_date: $('contractDate').value || null,
      in_at: toISO($('inAt').value),
      out_at: toISO($('outAt').value),
      amount: $('amount').value === '' ? null : Number($('amount').value),
      currency: $('currency').value,
      notes: $('acNotes').value.trim() || null,
    };
    if (departureBeforeArrival(row.in_at, row.out_at)) {
      toast('The departure time is before the arrival time. Please check the dates.', true);
      return;
    }
    $('acSubmit').disabled = true;
    const q = id ? sb.from('aircraft').update(row).eq('id', id) : sb.from('aircraft').insert(row);
    q.then((r) => {
      $('acSubmit').disabled = false;
      if (r.error) return fail('Could not save the record', r.error);
      toast(id ? 'Record updated' : 'Record saved');
      resetAcForm(); refresh();
    });
  });
  $('acCancel').addEventListener('click', resetAcForm);

  function resetAcForm() {
    acForm.reset(); $('acId').value = '';
    $('acFormTitle').textContent = 'New aircraft record';
    $('acSubmit').textContent = 'Save record'; $('acCancel').hidden = true;
  }
  function editAircraft(id) {
    const a = db.aircraft.find((x) => x.id === id); if (!a) return;
    $('acId').value = a.id; $('airline').value = a.airline; $('type').value = a.type;
    $('reg').value = a.reg || ''; $('serial').value = a.serial || '';
    $('contractDate').value = a.contractDate || '';
    $('inAt').value = toInput(a.inAt); $('outAt').value = toInput(a.outAt);
    $('amount').value = a.amount == null ? '' : a.amount;
    $('currency').value = a.currency || 'GHS'; $('acNotes').value = a.notes || '';
    $('acFormTitle').textContent = 'Editing: ' + acLabel(a);
    $('acSubmit').textContent = 'Update record'; $('acCancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function deleteAircraft(id) {
    const a = db.aircraft.find((x) => x.id === id);
    const n = db.jobs.filter((j) => j.aircraftId === id).length;
    let msg = 'Delete the record for ' + acLabel(a) + '?';
    if (n) msg += '\n\nThis will also delete ' + n + ' job sheet' + (n > 1 ? 's' : '') + ' linked to it.';
    if (!confirm(msg)) return;
    sb.from('aircraft').delete().eq('id', id).then((r) => {
      if (r.error) return fail('Could not delete', r.error);
      toast('Record deleted'); refresh();
    });
  }
  function renderAircraft() {
    const query = $('acSearch').value.trim().toLowerCase();
    const rows = db.aircraft.filter((a) =>
      !query || (a.airline + ' ' + a.type + ' ' + (a.reg || '')).toLowerCase().indexOf(query) >= 0);
    const tb = $('acTable').querySelector('tbody');
    tb.innerHTML = rows.map((a) => {
      const st = statusOf(a);
      const jobs = db.jobs.filter((j) => j.aircraftId === a.id).length;
      return '<tr>' +
        "<td><strong>" + esc(a.airline) + '</strong></td><td>' + esc(a.type) + '</td>' +
        '<td>' + esc(a.reg || '—') + '</td><td>' + esc(a.serial || '—') + '</td>' +
        '<td>' + fmtDate(a.contractDate) + '</td>' +
        '<td>' + fmtDateTime(a.inAt) + '</td><td>' + fmtDateTime(a.outAt) + '</td>' +
        '<td>' + duration(a.inAt, a.outAt) + '</td>' +
        "<td class='num'>" + fmtMoney(a.amount, a.currency) + '</td>' +
        "<td><span class='pill " + st.cls + "'>" + st.label + '</span></td>' +
        "<td class='num'>" + jobs + '</td>' +
        "<td class='rowact'><button class='link' data-edit='" + a.id + "'>Edit</button>" +
        "<button class='link danger' data-del='" + a.id + "'>Delete</button></td></tr>";
    }).join('');
    $('acEmpty').hidden = rows.length > 0;
    tb.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => editAircraft(b.dataset.edit); });
    tb.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => deleteAircraft(b.dataset.del); });
  }
  function renderStats() {
    const inHangar = db.aircraft.filter((a) => a.inAt && !a.outAt).length;
    const totals = {};
    db.aircraft.forEach((a) => {
      if (a.amount != null && !isNaN(a.amount)) {
        const c = a.currency || 'GHS';
        totals[c] = (totals[c] || 0) + Number(a.amount);
      }
    });
    const money = Object.keys(totals).map((c) => fmtMoney(totals[c], c)).join('  ') || '—';
    $('stats').innerHTML =
      "<div class='stat'><div class='n'>" + db.aircraft.length + "</div><div class='l'>Aircraft records</div></div>" +
      "<div class='stat'><div class='n'>" + inHangar + "</div><div class='l'>Currently in hangar</div></div>" +
      "<div class='stat'><div class='n'>" + db.jobs.length + "</div><div class='l'>Job sheets</div></div>" +
      "<div class='stat'><div class='n' style='font-size:17px'>" + esc(money) + "</div><div class='l'>Contracted value</div></div>";
  }
  $('acSearch').addEventListener('input', renderAircraft);

  /* ================= TAB 2: jobs ================= */
  const jobForm = $('jobForm');
  function summaryHtml(a, mini) {
    if (!a) return '';
    const st = statusOf(a);
    const item = (k, v) => "<div class='item'><span class='k'>" + k + "</span><span class='v'>" + v + '</span></div>';
    return "<div class='summary" + (mini ? ' mini' : '') + "'>" +
      item('Airline', '<strong>' + esc(a.airline) + '</strong>') + item('Type', esc(a.type)) +
      (a.reg ? item('Reg', esc(a.reg)) : '') +
      (a.serial ? item('Serial (MSN)', esc(a.serial)) : '') +
      item('Contract', fmtDate(a.contractDate)) +
      item('In', fmtDateTime(a.inAt)) + item('Out', fmtDateTime(a.outAt)) +
      item('Duration', duration(a.inAt, a.outAt)) + item('Amount', fmtMoney(a.amount, a.currency)) +
      item('Status', "<span class='pill " + st.cls + "'>" + st.label + '</span>') + '</div>';
  }
  function renderAircraftOptions() {
    const opts = db.aircraft.map((a) => "<option value='" + a.id + "'>" + esc(acLabel(a)) + '</option>').join('');
    const sel = $('jobAircraft'), keep = sel.value;
    sel.innerHTML = "<option value=''>Select a recorded aircraft…</option>" + opts;
    sel.value = keep;
    const f = $('jobFilter'), keepF = f.value;
    f.innerHTML = "<option value=''>All aircraft</option>" + opts;
    f.value = keepF;
  }
  $('jobAircraft').addEventListener('change', () => {
    const a = db.aircraft.find((x) => x.id === $('jobAircraft').value);
    $('jobSummary').innerHTML = summaryHtml(a, false);
  });
  jobForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = $('jobId').value;
    const row = {
      aircraft_id: $('jobAircraft').value,
      job_date: $('jobDate').value || null,
      job_type: $('jobType').value,
      performed_by: $('jobBy').value.trim() || null,
      hours: $('jobHours').value === '' ? null : Number($('jobHours').value),
      status: $('jobStatus').value,
      description: $('jobDesc').value.trim(),
    };
    if (!row.aircraft_id) { toast('Pick an aircraft first.', true); return; }
    $('jobSubmit').disabled = true;
    const q = id ? sb.from('jobs').update(row).eq('id', id) : sb.from('jobs').insert(row);
    q.then((r) => {
      $('jobSubmit').disabled = false;
      if (r.error) return fail('Could not save the job', r.error);
      toast(id ? 'Job updated' : 'Job saved');
      resetJobForm(); refresh();
    });
  });
  $('jobCancel').addEventListener('click', resetJobForm);
  function resetJobForm() {
    jobForm.reset(); $('jobId').value = ''; $('jobDate').value = todayLocal();
    $('jobSummary').innerHTML = '';
    $('jobFormTitle').textContent = 'Log a job';
    $('jobSubmit').textContent = 'Save job'; $('jobCancel').hidden = true;
  }
  function editJob(id) {
    const j = db.jobs.find((x) => x.id === id); if (!j) return;
    $('jobId').value = j.id; $('jobAircraft').value = j.aircraftId;
    $('jobDate').value = j.date || ''; $('jobType').value = j.jobType || 'Other';
    $('jobBy').value = j.by || ''; $('jobHours').value = j.hours == null ? '' : j.hours;
    $('jobStatus').value = j.status || 'In progress'; $('jobDesc').value = j.desc || '';
    $('jobAircraft').dispatchEvent(new Event('change'));
    $('jobFormTitle').textContent = 'Editing job sheet';
    $('jobSubmit').textContent = 'Update job'; $('jobCancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function deleteJob(id) {
    if (!confirm('Delete this job sheet?')) return;
    sb.from('jobs').delete().eq('id', id).then((r) => {
      if (r.error) return fail('Could not delete', r.error);
      toast('Job deleted'); refresh();
    });
  }
  function renderJobs() {
    const filter = $('jobFilter').value, query = $('jobSearch').value.trim().toLowerCase();
    const rows = db.jobs.filter((j) => {
      if (filter && j.aircraftId !== filter) return false;
      if (!query) return true;
      return ((j.desc || '') + ' ' + (j.by || '') + ' ' + (j.jobType || '')).toLowerCase().indexOf(query) >= 0;
    }).sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
    $('jobList').innerHTML = rows.map((j) => {
      const a = db.aircraft.find((x) => x.id === j.aircraftId);
      return "<div class='jobcard'>" + summaryHtml(a, true) +
        "<div class='head'><div><span class='title'>" + esc(j.jobType || 'Job') + '</span> ' +
        "<span class='pill " + (j.status === 'Completed' ? 'out' : j.status === 'On hold' ? 'wait' : 'in') + "'>" +
        esc(j.status || '') + "</span></div><div class='rowact'>" +
        "<button class='link' data-jedit='" + j.id + "'>Edit</button>" +
        "<button class='link danger' data-jdel='" + j.id + "'>Delete</button></div></div>" +
        "<div class='meta'>" + fmtDate(j.date) + (j.by ? ' · ' + esc(j.by) : '') +
        (j.hours ? ' · ' + esc(j.hours) + ' man-hours' : '') + '</div>' +
        "<div class='desc'>" + esc(j.desc) + '</div></div>';
    }).join('');
    $('jobEmpty').hidden = rows.length > 0;
    $('jobList').querySelectorAll('[data-jedit]').forEach((b) => { b.onclick = () => editJob(b.dataset.jedit); });
    $('jobList').querySelectorAll('[data-jdel]').forEach((b) => { b.onclick = () => deleteJob(b.dataset.jdel); });
  }
  $('jobFilter').addEventListener('change', renderJobs);
  $('jobSearch').addEventListener('input', renderJobs);

  /* ================= backup / restore / csv ================= */
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('btnExport').onclick = () => download('hangar-backup-' + todayLocal() + '.json', JSON.stringify(db, null, 2));
  $('btnCsv').onclick = () => download('hangar-log-' + todayLocal() + '.csv', csvString(db), 'text/csv');
  $('btnImport').onclick = () => $('fileInput').click();
  $('fileInput').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let d;
      try { d = JSON.parse(r.result); } catch (err) { toast('That file is not a valid backup.', true); return; }
      if (!Array.isArray(d.aircraft) || !Array.isArray(d.jobs)) { toast('That file is not a valid backup.', true); return; }
      if (!confirm('Add ' + d.aircraft.length + ' aircraft and ' + d.jobs.length +
        ' jobs from this file to your account?\n\nNothing already online is deleted.')) return;
      uploadBackup(d);
      e.target.value = '';
    };
    r.readAsText(f);
  };
  // Adds a backup in. Old aircraft ids (arbitrary strings) map to the new uuids the
  // database issues, so job sheets stay attached to the right aircraft.
  function uploadBackup(d) {
    toast('Uploading…');
    sb.from('aircraft').insert(aircraftRowsFromBackup(d)).select().then((r) => {
      if (r.error) return fail('Upload failed', r.error);
      const map = {};
      (d.aircraft || []).forEach((a, i) => { if (r.data[i]) map[a.id] = r.data[i].id; });
      const jobRows = jobRowsFromBackup(d, map);
      if (!jobRows.length) { toast('Uploaded ' + r.data.length + ' aircraft'); return refresh(); }
      sb.from('jobs').insert(jobRows).then((r2) => {
        if (r2.error) return fail('Aircraft uploaded, but the jobs failed', r2.error);
        toast('Uploaded ' + r.data.length + ' aircraft and ' + jobRows.length + ' jobs');
        refresh();
      });
    });
  }

  /* ================= boot ================= */
  function renderAll() { renderStats(); renderAircraft(); renderAircraftOptions(); renderJobs(); }

  (function clock() {
    const d = new Date();
    let zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* older browser */ }
    $('clock').textContent = d.toLocaleDateString(undefined,
      { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' +
      d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) + (zone ? ' · ' + zone : '');
    setTimeout(clock, 20000);
  })();

  if (user && $('whoami')) $('whoami').textContent = user.email || '';
  $('jobDate').value = todayLocal();
  $('gate') && $('gate').classList.add('hide');
  $('app').classList.remove('hide');
  return refresh();
}
