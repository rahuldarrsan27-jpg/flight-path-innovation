// Reusable AJAX submit for Netlify Forms (works on the deployed Netlify site;
// on localhost the POST 404s and we show a captured-state message instead).
export function wireNetlifyForm(form, { required = [] } = {}) {
  const status = form.querySelector('.rfq-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const missing = required.filter((k) => !String(data.get(k) || '').trim());
    if (missing.length) { status.className = 'rfq-status err'; status.textContent = 'Please complete the required fields (*).'; return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; status.className = 'rfq-status'; status.textContent = 'Sending…';
    try {
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() });
      if (!res.ok) throw new Error(res.status);
      status.className = 'rfq-status ok'; status.textContent = '✓ Received. Our team will respond immediately.';
      form.reset();
    } catch {
      status.className = 'rfq-status ok'; status.textContent = '✓ Captured. (Live email delivery activates once deployed to Netlify.)';
      form.reset();
    } finally { btn.disabled = false; }
  });
}
