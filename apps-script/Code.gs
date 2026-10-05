/* ==========================================================
   Young & Freaks — registration backend (Google Apps Script)

   Lives inside the Google Sheet (Extensions → Apps Script) and is
   deployed as a Web App. The website talks to it with fetch().

   Sheet layout
   ------------
   Tab 1  "Admin"        reserved for future admin settings.
   Tab 2+ "Run 1", "Run 2", ... "Run N"
          The highest-numbered "Run N" tab is the CURRENT run. Adding a
          "Run 6" tab (menu: Young & Freaks → Add next run) switches the
          whole site to Run 6.

   Every run tab:
     Row 1  labels:  Registration Open | Registration Closed | Open for Boys | Open for Girls | Run Title | Run Date / Place
     Row 2  values:  [x]               | [ ]                 | [ ]           | [ ]            | text      | text
     Row 4  headers: see HEADERS below
     Row 5+ one row per person. Rows can be typed in or pasted from an older
            run tab; website sign-ups are appended underneath.

   Columns are found by their header name, so extra columns can be added and
   pasted data doesn't need to line up perfectly, as long as headers match.
   ========================================================== */

var TZ = 'Asia/Kolkata';
var ADMIN_SHEET = 'Admin';
var RUN_RE = /^run\s*(\d+)$/i;

var FLAG_ROW = 2;
var HEADER_ROW = 4;
var FIRST_DATA_ROW = 5;
var FLAG_LABELS = ['Registration Open', 'Registration Closed', 'Open for Boys', 'Open for Girls', 'Run Title', 'Run Date / Place'];
var HEADERS = [
  'ID', 'Password', 'Name', 'DOB', 'Gender', 'Phone', 'Emergency Contact', 'College',
  'Registered At', 'Source', 'Status', 'Attended', 'Previous Runs', 'Notes',
];
var TEXT_HEADERS = ['ID', 'Password', 'DOB', 'Phone', 'Emergency Contact', 'Registered At', 'Previous Runs'];
var STATUSES = ['Pending', 'Confirmed', 'Not Confirmed'];
var GENDERS = ['Male', 'Female', 'Other'];
var ATTENDED = ['Yes', 'No'];

/* ---------------- HTTP entry points ---------------- */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'config';
  try {
    if (action === 'config') return json_(getConfig_());
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

// The site POSTs JSON as text/plain so the browser skips the CORS preflight.
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'register') return json_(register_(body));
    if (body.action === 'status') return json_(status_(body));
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- run tabs ---------------- */

function runSheets_() {
  var list = [];
  SpreadsheetApp.getActive().getSheets().forEach(function (sh) {
    var m = sh.getName().trim().match(RUN_RE);
    if (m) list.push({ sheet: sh, run: +m[1] });
  });
  return list.sort(function (a, b) { return a.run - b.run; });
}

function currentRunSheet_() {
  var list = runSheets_();
  if (!list.length) throw new Error('No "Run N" sheet found.');
  return list[list.length - 1];
}

function readFlags_(sheet) {
  var v = sheet.getRange(FLAG_ROW, 1, 1, FLAG_LABELS.length).getValues()[0];
  var on = function (x) { return x === true || String(x).toUpperCase() === 'TRUE'; };
  var f = { open: on(v[0]), closed: on(v[1]), boys: on(v[2]), girls: on(v[3]), title: String(v[4] || ''), when: String(v[5] || '') };

  // "Closed" always wins. "Open" means everyone. Otherwise boys and/or girls only.
  var allowed = [];
  if (!f.closed) {
    if (f.open) allowed = GENDERS.slice();
    else {
      if (f.boys) allowed.push('Male');
      if (f.girls) allowed.push('Female');
    }
  }
  f.allowed = allowed;
  f.state = allowed.length === 0 ? 'closed'
    : allowed.length === GENDERS.length ? 'open'
    : allowed.length === 2 ? 'boys_girls'
    : allowed[0] === 'Male' ? 'boys' : 'girls';
  return f;
}

function getConfig_() {
  var cur = currentRunSheet_();
  var f = readFlags_(cur.sheet);
  return { ok: true, run: cur.run, state: f.state, allowed: f.allowed, title: f.title, when: f.when };
}

/* ---------------- table access by header name ---------------- */

function table_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var heads = sh.getRange(HEADER_ROW, 1, 1, lastCol).getDisplayValues()[0];
  var col = {};
  heads.forEach(function (h, i) { h = String(h).trim().toLowerCase(); if (h && !(h in col)) col[h] = i; });
  var last = sh.getLastRow();
  var rows = last < FIRST_DATA_ROW ? [] : sh.getRange(FIRST_DATA_ROW, 1, last - FIRST_DATA_ROW + 1, lastCol).getDisplayValues();
  return {
    width: lastCol,
    rows: rows,
    has: function (name) { return name.toLowerCase() in col; },
    idx: function (name) { return col[name.toLowerCase()]; },
    get: function (row, name) { var i = col[name.toLowerCase()]; return i === undefined ? '' : String(row[i]).trim(); },
  };
}

function digitsKey_(s) { return String(s || '').replace(/\D/g, '').slice(-10); }

/* ---------------- register ---------------- */

function register_(b) {
  var name = clean_(b.name, 80);
  var gender = clean_(b.gender, 10);
  var college = clean_(b.college, 120);
  var phone = digits_(b.phone);
  var emergency = digits_(b.emergency);
  var dob = parseDob_(b.dob);

  if (!name) return fail_('Please enter your name.');
  if (!dob) return fail_('Please enter a valid date of birth.');
  if (GENDERS.indexOf(gender) < 0) return fail_('Please choose a gender.');
  if (phone.length !== 10) return fail_('Phone number must be 10 digits.');
  if (emergency.length !== 10) return fail_('Emergency contact must be 10 digits.');
  if (emergency === phone) return fail_('Emergency contact must be a different number.');
  if (!college) return fail_('Please enter your college (or "None").');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var all = runSheets_();
    var cur = all[all.length - 1];
    if (!cur) throw new Error('No "Run N" sheet found.');
    var sh = cur.sheet;
    var f = readFlags_(sh);
    if (f.state === 'closed') return fail_('Registrations for Run ' + pad_(cur.run) + ' are closed right now.');
    if (f.allowed.indexOf(gender) < 0) {
      var who = { boys: 'boys', girls: 'girls', boys_girls: 'boys and girls' }[f.state];
      return fail_('Right now registrations are open only for ' + who + '.');
    }

    var t = table_(sh);
    ['ID', 'Password', 'Name', 'Phone', 'Status'].forEach(function (h) {
      if (!t.has(h)) throw new Error('Run ' + cur.run + ' tab is missing the "' + h + '" column in row ' + HEADER_ROW + '.');
    });

    for (var i = 0; i < t.rows.length; i++) {
      if (digitsKey_(t.get(t.rows[i], 'Phone')) === phone) {
        return fail_('This phone number is already on the Run ' + pad_(cur.run) + ' list (ID ' + t.get(t.rows[i], 'ID') + '). Use "Check status" instead.');
      }
    }

    // ID = sign-up time HHmm; on a clash append 1, 2, 3...
    var now = new Date();
    var base = Utilities.formatDate(now, TZ, 'HHmm');
    var taken = {};
    t.rows.forEach(function (r) { taken[t.get(r, 'ID')] = true; });
    var id = base, n = 0;
    while (taken[id]) id = base + (++n);

    // Which earlier runs has this phone number been on?
    var prev = [];
    all.forEach(function (rs) {
      if (rs.run >= cur.run) return;
      var pt = table_(rs.sheet);
      if (!pt.has('Phone')) return;
      for (var j = 0; j < pt.rows.length; j++) {
        if (digitsKey_(pt.get(pt.rows[j], 'Phone')) === phone) { prev.push(rs.run); break; }
      }
    });

    var values = {
      'ID': id,
      'Password': dob.password,
      'Name': name,
      'DOB': dob.display,
      'Gender': gender,
      'Phone': phone,
      'Emergency Contact': emergency,
      'College': college,
      'Registered At': Utilities.formatDate(now, TZ, 'dd/MM/yyyy HH:mm:ss'),
      'Source': 'Website',
      'Status': 'Pending',
      'Previous Runs': prev.join(', '),
    };
    var row = [];
    for (var c = 0; c < t.width; c++) row.push('');
    Object.keys(values).forEach(function (h) { if (t.has(h)) row[t.idx(h)] = values[h]; });

    var r = Math.max(sh.getLastRow() + 1, FIRST_DATA_ROW);
    sh.getRange(r, 1, 1, t.width).setNumberFormat('@').setValues([row]);
    SpreadsheetApp.flush();

    return { ok: true, id: id, run: cur.run, name: name };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- check status ---------------- */

function status_(b) {
  var id = String(b.id || '').replace(/\D/g, '');
  var pw = String(b.password || '').replace(/\D/g, '');
  if (!id || !pw) return fail_('Enter your ID and password.');

  var cur = currentRunSheet_();
  var t = table_(cur.sheet);
  for (var i = 0; i < t.rows.length; i++) {
    var r = t.rows[i];
    if (t.get(r, 'ID') === id && t.get(r, 'Password').replace(/\D/g, '') === pw) {
      var st = t.get(r, 'Status') || 'Pending';
      var known = STATUSES.filter(function (s) { return s.toLowerCase() === st.toLowerCase(); })[0];
      return { ok: true, run: cur.run, id: id, name: t.get(r, 'Name'), status: known || 'Pending' };
    }
  }
  return fail_('No Run ' + pad_(cur.run) + ' registration matches that ID and password.');
}

/* ---------------- helpers ---------------- */

function fail_(msg) { return { ok: false, error: msg }; }
function pad_(n) { return ('00' + n).slice(-3); }
function digits_(s) { var d = String(s || '').replace(/\D/g, ''); return d.length === 12 && d.indexOf('91') === 0 ? d.slice(2) : d; }

// Strip control chars and anything that would make Sheets read the value as a formula.
function clean_(s, max) {
  return String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/^[\s=+\-@]+/, '').trim().slice(0, max);
}

// Accepts YYYY-MM-DD (from <input type="date">).
function parseDob_(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3];
  var dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  if (y < 1940 || dt > new Date()) return null;
  return { password: m[3] + m[2] + m[1], display: m[3] + '/' + m[2] + '/' + m[1] };
}

/* ==========================================================
   Sheet setup — run from the Apps Script editor or the sheet menu
   ========================================================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Young & Freaks')
    .addItem('Add next run', 'addNextRun')
    .addItem('Set up / repair sheets', 'setup')
    .addToUi();
}

// Creates Admin + Run 1…5 if missing and (re)applies checkboxes, dropdowns and
// text formats to every run tab. Never deletes or overwrites people's rows, so
// it's safe to run on a sheet imported from the Excel template.
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);

  var admin = ss.getSheetByName(ADMIN_SHEET) || ss.insertSheet(ADMIN_SHEET, 0);
  ss.setActiveSheet(admin); ss.moveActiveSheet(1);
  if (admin.getLastRow() === 0) {
    admin.getRange('A1').setValue('Reserved for admin settings (future use).').setFontStyle('italic');
  }

  var past = {
    1: ['The first one', 'Where it all started'],
    2: ['Round two', 'The freaks came back'],
    3: ['Run & Clay Date', 'Sept 27 · Sunday · Casa Del Sole'],
    4: ['Run to Stone Age', 'Oct 04 · Sunday'],
    5: ['', ''],
  };
  for (var n = 1; n <= 5; n++) {
    if (!ss.getSheetByName('Run ' + n)) {
      var sh = ss.insertSheet('Run ' + n, ss.getSheets().length);
      sh.getRange(FLAG_ROW, 5, 1, 2).setValues([past[n]]);
    }
  }
  runSheets_().forEach(function (rs) { formatRunSheet_(rs.sheet); });

  // A blank default "Sheet1" is just noise.
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
}

function addNextRun() {
  var ss = SpreadsheetApp.getActive();
  var next = currentRunSheet_().run + 1;
  var sh = ss.insertSheet('Run ' + next, ss.getSheets().length);
  formatRunSheet_(sh);
  ss.setActiveSheet(sh);
  SpreadsheetApp.getUi().alert('Run ' + next + ' added. The site now shows Run ' + pad_(next) + '.\n\n' +
    '• Registration starts CLOSED. Tick "Registration Open" (or Boys / Girls) in row 2 to open it.\n' +
    '• To carry people over, copy their rows from an older run tab and paste them from row ' + FIRST_DATA_ROW + '. ' +
    'Website sign-ups are added underneath.');
}

function formatRunSheet_(sh) {
  // flag rows: labels, checkboxes (existing TRUE/FALSE values are kept)
  sh.getRange(1, 1, 1, FLAG_LABELS.length).setValues([FLAG_LABELS]).setFontWeight('bold').setBackground('#f5c21b');
  var flags = sh.getRange(FLAG_ROW, 1, 1, 4);
  var kept = flags.getValues()[0].map(function (x) { return x === true || String(x).toUpperCase() === 'TRUE'; });
  flags.insertCheckboxes().setValues([kept]);
  sh.getRange(3, 1).setValue('↑ Tick one: Open = everyone · Boys / Girls = only them · Closed overrides all.').setFontStyle('italic').setFontColor('#777');

  // headers: write them if the row is empty, otherwise add any missing ones on the right
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var current = sh.getRange(HEADER_ROW, 1, 1, lastCol).getDisplayValues()[0].map(function (h) { return String(h).trim(); });
  if (current.join('') === '') {
    sh.getRange(HEADER_ROW, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    var lower = current.map(function (h) { return h.toLowerCase(); });
    var end = current.length;
    while (end > 0 && !current[end - 1]) end--;
    HEADERS.forEach(function (h) {
      if (lower.indexOf(h.toLowerCase()) < 0) { sh.getRange(HEADER_ROW, ++end).setValue(h); lower.push(h.toLowerCase()); }
    });
  }
  var t = table_(sh);
  sh.getRange(HEADER_ROW, 1, 1, t.width).setFontWeight('bold').setBackground('#0e0d0b').setFontColor('#efe8da');
  sh.setFrozenRows(HEADER_ROW);

  var rows = sh.getMaxRows() - FIRST_DATA_ROW + 1;
  var colRange = function (h) { return t.has(h) ? sh.getRange(FIRST_DATA_ROW, t.idx(h) + 1, rows, 1) : null; };

  // Text format keeps leading zeros (IDs like 0905, passwords like 01012001).
  TEXT_HEADERS.forEach(function (h) { var r = colRange(h); if (r) r.setNumberFormat('@'); });

  var list = function (h, items) {
    var r = colRange(h);
    if (r) r.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(items, true).setAllowInvalid(true).build());
    return r;
  };
  list('Gender', GENDERS);
  var attended = list('Attended', ATTENDED);
  var status = list('Status', STATUSES);

  var rules = [];
  if (status) {
    [['Confirmed', '#c8f0c8'], ['Not Confirmed', '#f6c6c6'], ['Pending', '#fff2c2']].forEach(function (p) {
      rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(p[0]).setBackground(p[1]).setRanges([status]).build());
    });
  }
  if (attended) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Yes').setBackground('#c8f0c8').setRanges([attended]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('No').setBackground('#eeeeee').setRanges([attended]).build());
  }
  sh.setConditionalFormatRules(rules);
  sh.autoResizeColumns(1, t.width);
}
