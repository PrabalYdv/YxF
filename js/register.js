/* ==========================================================
   Young & Freaks — registration + status check
   Talks to the Google Apps Script Web App in js/config.js.
   The current run number and open/closed state come from the sheet.
   ========================================================== */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const cfg = window.YXF_CONFIG || {};
  const API = (cfg.API_URL || '').trim();
  const pad = (n) => String(n).padStart(3, '0');

  const STATE_TEXT = {
    open: 'Registrations open',
    boys: 'Open for boys only',
    girls: 'Open for girls only',
    boys_girls: 'Open for boys & girls',
    closed: 'Registrations closed',
    offline: 'Registrations open soon',
  };

  const regForm = $('#regForm'), statusForm = $('#statusForm');
  if (!regForm || !statusForm) return;

  /* ---------- tabs ---------- */
  $$('.reg__tab').forEach((tab) => tab.addEventListener('click', () => showPanel(tab.dataset.panel)));
  function showPanel(name) {
    $$('.reg__tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.panel === name)));
    $$('.reg__panel').forEach((p) => (p.hidden = p.id !== name));
  }

  /* ---------- run number everywhere ---------- */
  function applyRun(run) {
    $$('[data-run]').forEach((el) => (el.textContent = pad(run)));
    $$('[data-runs-done]').forEach((el) => {
      el.textContent = run - 1;
      if (el.dataset.count) el.dataset.count = run - 1;
    });
  }
  applyRun(cfg.FALLBACK_RUN || 5);

  /* ---------- open / closed state ---------- */
  function applyState(state, allowed) {
    const box = $('#regState');
    box.dataset.state = state;
    $('#regStateText').textContent = STATE_TEXT[state] || STATE_TEXT.closed;
    $$('[data-reg-state]').forEach((el) => (el.textContent = STATE_TEXT[state] || STATE_TEXT.closed));

    const closed = state === 'closed' || state === 'offline';
    regForm.classList.toggle('is-closed', closed);
    $$('input, select, button', regForm).forEach((el) => (el.disabled = closed));
    $('#regClosedNote').hidden = !closed;
    $('#regClosedNote').textContent = state === 'offline'
      ? 'The form isn’t connected yet. DM us on Instagram to join this one.'
      : 'Registrations are closed right now. Already registered? Check your status.';

    // only allow the genders the sheet has opened
    $$('input[name="gender"]', regForm).forEach((r) => {
      const ok = !closed && allowed.includes(r.value);
      r.disabled = !ok;
      r.closest('label').classList.toggle('is-off', !ok);
      if (!ok) r.checked = false;
      else if (allowed.length === 1) r.checked = true;
    });
  }

  async function loadConfig() {
    if (!API) return applyState('offline', []);
    try {
      const res = await fetch(API + '?action=config', { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      applyRun(data.run);
      applyState(data.state, data.allowed || []);
      $('#regTitle').textContent = data.title || '';
      $('#regWhen').textContent = data.when || 'Date & place on Instagram';
      $('#nextBibName').textContent = data.title || 'Up next';
      $('#nextBibWhen').textContent = data.when || 'Date & place TBA';
    } catch (err) {
      console.warn('Registration config failed', err);
      applyState('offline', []);
    }
  }

  async function post(body) {
    // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    return res.json();
  }

  function setBusy(form, busy, label) {
    const btn = $('button[type="submit"]', form);
    btn.disabled = busy;
    btn.firstChild.textContent = busy ? 'Sending… ' : label + ' ';
  }
  function showError(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }

  /* ---------- register ---------- */
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#regError');
    showError(err, '');
    if (!regForm.reportValidity()) return;
    const fd = new FormData(regForm);
    if (!fd.get('gender')) return showError(err, 'Please choose a gender.');

    setBusy(regForm, true);
    try {
      const data = await post({
        action: 'register',
        name: fd.get('name'), dob: fd.get('dob'), gender: fd.get('gender'),
        phone: fd.get('phone'), emergency: fd.get('emergency'), college: fd.get('college'),
      });
      if (!data.ok) return showError(err, data.error || 'Something went wrong. Try again.');
      try { localStorage.setItem('yxf-id', data.id); } catch (_) {}
      $('#doneId').textContent = data.id;
      $('#doneName').textContent = String(data.name || '').split(' ')[0];
      $('#doneRun').textContent = pad(data.run);
      regForm.hidden = true;
      $('#regDone').hidden = false;
      regForm.reset();
    } catch (_) {
      showError(err, 'Couldn’t reach the server. Check your connection and try again.');
    } finally {
      setBusy(regForm, false, 'Register');
    }
  });

  $('#regAgain').addEventListener('click', () => { $('#regDone').hidden = true; regForm.hidden = false; loadConfig(); });
  $('#regToStatus').addEventListener('click', () => {
    $('#statusForm [name="id"]').value = $('#doneId').textContent;
    showPanel('panelStatus');
  });

  /* ---------- status ---------- */
  try { const saved = localStorage.getItem('yxf-id'); if (saved) $('#statusForm [name="id"]').value = saved; } catch (_) {}

  statusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#statusError'), out = $('#statusResult');
    showError(err, ''); out.hidden = true;
    if (!statusForm.reportValidity()) return;
    if (!API) return showError(err, 'Status checks aren’t live yet.');
    const fd = new FormData(statusForm);
    setBusy(statusForm, true);
    try {
      const data = await post({ action: 'status', id: fd.get('id'), password: fd.get('password') });
      if (!data.ok) return showError(err, data.error || 'Not found.');
      const st = data.status;
      out.dataset.status = st.toLowerCase().replace(/\s+/g, '-');
      $('#statusName').textContent = data.name;
      $('#statusRun').textContent = pad(data.run);
      $('#statusPill').textContent = st;
      $('#statusMsg').textContent = st === 'Confirmed'
        ? 'You’re in. See you at the start line.'
        : st === 'Not Confirmed'
          ? 'We couldn’t fit you in this time. Catch the next one!'
          : 'Still pending. Check back in a bit.';
      out.hidden = false;
    } catch (_) {
      showError(err, 'Couldn’t reach the server. Try again.');
    } finally {
      setBusy(statusForm, false, 'Check status');
    }
  });

  loadConfig();
})();
