/* Work Hours — personal, offline, no server. Data lives in localStorage on this device.
   An entry is only: date (YYYY-MM-DD, shown DD.MM.YYYY), start (HH:MM), end (HH:MM). */
(function () {
  'use strict';
  var KEY = 'workhours.v1';
  var SKEY = 'workhours.settings.v1';
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var $ = function (id) { return document.getElementById(id); };
  var reDate = /^\d{4}-\d{2}-\d{2}$/, reTime = /^\d{2}:\d{2}$/;

  // ---------- storage ----------
  function clean(e) { // keep only date/start/end (older versions also stored break/note)
    return { id: e.id || uid(), date: e.date, start: e.start, end: reTime.test(e.end || '') ? e.end : '' };
  }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(d) ? d.filter(function (e) { return e && reDate.test(e.date) && reTime.test(e.start); }).map(clean) : [];
    } catch (e) { return []; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(entries)); }
  function loadSettings() { try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveSettings() { localStorage.setItem(SKEY, JSON.stringify(settings)); }
  var entries = load();
  var settings = loadSettings();
  save();
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }

  // ---------- helpers ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function dayName(iso, short) { var d = parseISO(iso).getDay(); return short ? DAYS_SHORT[d] : DAYS[d]; }
  function toMin(t) { var p = t.split(':'); return (+p[0]) * 60 + (+p[1]); }
  /** Minutes between start and end; a shift past midnight (end < start) counts into the next day. */
  function workedMin(e) {
    if (!e.start || !e.end) return 0;
    var span = toMin(e.end) - toMin(e.start);
    return span < 0 ? span + 1440 : span;
  }
  function hm(min) { return Math.floor(min / 60) + ':' + pad(min % 60); }            // 8:30
  function hLong(min) { var h = Math.floor(min / 60), m = min % 60; return h + ' h' + (m ? ' ' + m + ' min' : ''); } // 8 h 30 min
  function total(list) { return list.reduce(function (s, e) { return s + workedMin(e); }, 0); }
  function sortDesc() { entries.sort(function (a, b) { return (b.date + b.start).localeCompare(a.date + a.start); }); }
  var toastT;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // ---- typed DD.MM.YYYY / HH:MM fields (always 24h, independent of phone region) ----
  function maskDate(v) { var d = v.replace(/\D/g, '').slice(0, 8); return d.length > 4 ? d.slice(0, 2) + '.' + d.slice(2, 4) + '.' + d.slice(4) : d.length > 2 ? d.slice(0, 2) + '.' + d.slice(2) : d; }
  /** Auto-format typed time: '0830' -> 08:30, '745' -> 7:45 (single-digit hour when the first digit can't start a 2-digit hour), '7:45' kept */
  function maskTime(v) {
    var sep = /^(\d{0,2})\s*[:.,]\s*(\d{0,2})/.exec(v);
    if (sep) return sep[1] + ':' + sep[2];
    var d = v.replace(/\D/g, '');
    var hLen = (d[0] > '2' || (d[0] === '2' && d[1] > '3')) ? 1 : 2;
    d = d.slice(0, hLen + 2);
    return d.length > hLen ? d.slice(0, hLen) + ':' + d.slice(hLen) : d;
  }
  function dmyToIso(s) {
    var m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec((s || '').trim()); if (!m) return '';
    var d = +m[1], mo = +m[2], y = +m[3], dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  /** '8' -> 08:00, '830' -> 08:30, '0830'/'08:30' -> 08:30; '' if invalid */
  function normTime(s) {
    s = (s || '').trim(); if (!s) return '';
    var h, m, x = /^(\d{1,2})[:.](\d{1,2})$/.exec(s);
    if (x) { h = +x[1]; m = +x[2]; }
    else {
      var d = s.replace(/\D/g, ''); if (!d) return '';
      if (d.length <= 2) { h = +d; m = 0; } else if (d.length === 3) { h = +d[0]; m = +d.slice(1); } else { h = +d.slice(0, 2); m = +d.slice(2, 4); }
    }
    if (h > 23 || m > 59) return '';
    return pad(h) + ':' + pad(m);
  }
  document.querySelectorAll('.mask-date').forEach(function (el) {
    el.addEventListener('input', function () { el.value = maskDate(el.value); el.classList.remove('bad'); });
    el.addEventListener('blur', function () { if (el.value && !dmyToIso(el.value)) el.classList.add('bad'); });
  });
  document.querySelectorAll('.mask-time').forEach(function (el) {
    el.addEventListener('input', function () { el.value = maskTime(el.value); el.classList.remove('bad'); });
    el.addEventListener('blur', function () { if (!el.value) return; var n = normTime(el.value); if (n) el.value = n; else el.classList.add('bad'); });
  });

  // ---------- render ----------
  function render() {
    sortDesc();
    var groups = {}, order = [];
    entries.forEach(function (e) {
      var k = e.date.slice(0, 7);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(e);
    });
    $('list').innerHTML = order.map(function (k) {
      var list = groups[k], m = +k.slice(5, 7);
      return '<div class="month"><div class="month-head"><span>' + MONTHS[m - 1] + ' ' + k.slice(0, 4) + '</span>' +
        '<span class="tot">Total ' + hm(total(list)) + '</span></div><div class="entries">' +
        list.map(function (e) {
          return '<button class="entry" data-id="' + e.id + '"><div class="d"><b>' + fmtDate(e.date) + '</b><span>' + dayName(e.date, true) + '</span></div>' +
            '<div class="mid">' + e.start + '–' + (e.end || '?') + '</div>' +
            '<div class="h">' + (e.end ? hm(workedMin(e)) : '—') + '</div></button>';
        }).join('') + '</div></div>';
    }).join('');
    $('empty').hidden = entries.length > 0;
  }
  $('list').addEventListener('click', function (ev) {
    var b = ev.target.closest('.entry'); if (!b) return;
    var e = entries.find(function (x) { return x.id === b.dataset.id; });
    if (e) openEntryDlg(e);
  });

  // ---------- add / edit ----------
  var editing = null;
  function openEntryDlg(e) {
    editing = e || null;
    $('entryTitle').textContent = e ? 'Edit hours' : 'Add hours';
    $('fDate').value = fmtDate(e ? e.date : isoDate(new Date()));
    $('fStart').value = e ? e.start : '';
    $('fEnd').value = e ? e.end : '';
    $('delBtn').hidden = !e;
    document.querySelectorAll('#entryForm input').forEach(function (i) { i.classList.remove('bad'); });
    updateCalc();
    $('entryDlg').showModal();
    if (e) $('entryTitle').focus(); else $('fStart').focus(); // new entry: straight to Start
  }
  function formEntry() { return { date: dmyToIso($('fDate').value), start: normTime($('fStart').value), end: normTime($('fEnd').value) }; }
  function updateCalc() {
    var f = formEntry();
    $('dateFmt').textContent = f.date ? '· ' + dayName(f.date) : '';
    $('calc').textContent = f.start && f.end ? 'Total: ' + hLong(workedMin(f)) + (toMin(f.end) < toMin(f.start) ? ' (ends next day)' : '') : '';
  }
  ['fDate', 'fStart', 'fEnd'].forEach(function (id) { $(id).addEventListener('input', updateCalc); $(id).addEventListener('change', updateCalc); });
  // jump from Start to End once 4 digits are typed
  $('fStart').addEventListener('input', function () { if (/^\d{1,2}:\d{2}$/.test(this.value) && normTime(this.value)) $('fEnd').focus(); });
  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      var d = new Date(); d.setDate(d.getDate() + (+c.dataset.days));
      $('fDate').value = fmtDate(isoDate(d)); $('fDate').classList.remove('bad'); updateCalc();
    });
  });
  $('addBtn').addEventListener('click', function () { openEntryDlg(null); });
  $('cancelEntry').addEventListener('click', function () { $('entryDlg').close(); });
  $('entryForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = formEntry();
    if (!f.date) { $('fDate').classList.add('bad'); toast('Date as DD.MM.YYYY'); return; }
    if (!f.start) { $('fStart').classList.add('bad'); $('fStart').focus(); toast('Start time as HH:MM'); return; }
    if (!f.end) { $('fEnd').classList.add('bad'); $('fEnd').focus(); toast('End time as HH:MM'); return; }
    var wasEdit = !!editing;
    if (editing) { Object.assign(editing, f); } else { f.id = uid(); entries.push(f); }
    save(); render(); $('entryDlg').close();
    toast((wasEdit ? 'Updated' : 'Saved') + ' · ' + hLong(workedMin(f)));
  });
  $('delBtn').addEventListener('click', function () {
    if (!editing) return;
    if (!confirm('Delete ' + fmtDate(editing.date) + ' ' + editing.start + '–' + editing.end + '?')) return;
    var gone = editing;
    entries = entries.filter(function (x) { return x !== gone; });
    save(); render(); $('entryDlg').close(); toast('Deleted');
  });

  // ---------- export ----------
  var xMode = 'month';
  function monthsAvailable() {
    var set = {}; set[isoDate(new Date()).slice(0, 7)] = 1;
    entries.forEach(function (e) { set[e.date.slice(0, 7)] = 1; });
    return Object.keys(set).sort().reverse();
  }
  function lastDay(ym) { return ym + '-' + pad(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate()); }
  function exportRange() {
    if (xMode === 'month') { var ym = $('xMonth').value; return { from: ym + '-01', to: lastDay(ym) }; }
    var a = dmyToIso($('xFrom').value), b = dmyToIso($('xTo').value);
    if (a && b && a > b) { var t = a; a = b; b = t; }
    return { from: a, to: b };
  }
  function selected() {
    var r = exportRange(); if (!r.from || !r.to) return { r: r, list: [] };
    var list = entries.filter(function (e) { return e.date >= r.from && e.date <= r.to; })
      .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
    return { r: r, list: list };
  }
  function updateXSummary() {
    var s = selected();
    $('xSummary').textContent = (!s.r.from || !s.r.to) ? 'Enter both dates as DD.MM.YYYY'
      : s.list.length + ' day' + (s.list.length === 1 ? '' : 's') + ' · Total ' + hm(total(s.list));
  }
  $('exportBtn').addEventListener('click', function () {
    $('xMonth').innerHTML = monthsAvailable().map(function (ym) {
      return '<option value="' + ym + '">' + MONTHS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) + '</option>';
    }).join('');
    var t = new Date();
    if (!$('xFrom').value) $('xFrom').value = fmtDate(isoDate(new Date(t.getFullYear(), t.getMonth(), 1)));
    if (!$('xTo').value) $('xTo').value = fmtDate(isoDate(t));
    $('xName').value = settings.name || '';
    updateXSummary();
    $('exportDlg').showModal();
  });
  document.querySelectorAll('.seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      xMode = b.dataset.mode;
      document.querySelectorAll('.seg-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
      $('modeMonth').hidden = xMode !== 'month'; $('modeRange').hidden = xMode !== 'range';
      updateXSummary();
    });
  });
  ['xMonth', 'xFrom', 'xTo'].forEach(function (id) { $(id).addEventListener('change', updateXSummary); $(id).addEventListener('input', updateXSummary); });
  $('cancelExport').addEventListener('click', function () { $('exportDlg').close(); });

  function buildPdf(list, r, name) {
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var font = 'helvetica';
    if (window.WH_FONTS) {
      doc.addFileToVFS('DejaVuSans.ttf', window.WH_FONTS.regular); doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
      doc.addFileToVFS('DejaVuSans-Bold.ttf', window.WH_FONTS.bold); doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
      font = 'DejaVu';
    }
    var W = doc.internal.pageSize.getWidth();
    doc.setFont(font, 'bold'); doc.setFontSize(18); doc.text('Work Hours', 14, 18);
    doc.setFont(font, 'normal'); doc.setFontSize(10.5); doc.setTextColor(90);
    var y = 25;
    if (name) { doc.text(name, 14, y); y += 5.5; }
    doc.text('Period: ' + fmtDate(r.from) + ' – ' + fmtDate(r.to), 14, y);
    doc.setTextColor(0);
    var body = list.map(function (e) {
      return [fmtDate(e.date), dayName(e.date, true), e.start, e.end || '—', e.end ? hm(workedMin(e)) : '—'];
    });
    doc.autoTable({
      startY: y + 6,
      head: [['Date', 'Day', 'Start', 'End', 'Total']],
      body: body.length ? body : [['No entries', '', '', '', '']],
      foot: [['Total', '', '', '', { content: hm(total(list)), styles: { halign: 'right' } }]],
      theme: 'grid',
      styles: { font: font, fontSize: 10.5, cellPadding: 2.6, lineColor: [210, 214, 220], lineWidth: 0.2, textColor: [20, 20, 20] },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [238, 241, 246], textColor: 20, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 26 }, 2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' }, 4: { cellWidth: 32, halign: 'right' } },
      showFoot: 'lastPage',
      margin: { left: 14, right: 14 },
      didDrawPage: function () {
        var H = doc.internal.pageSize.getHeight();
        doc.setFont(font, 'normal'); doc.setFontSize(8.5); doc.setTextColor(130);
        doc.text('Page ' + doc.internal.getNumberOfPages(), W - 14, H - 8, { align: 'right' });
        doc.setTextColor(0);
      }
    });
    return doc;
  }

  function shareOrDownload(blob, filename, title) {
    var file;
    try { file = new File([blob], filename, { type: blob.type }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: title }).catch(function (err) {
        if (err && err.name === 'AbortError') return; download(blob, filename);
      });
    }
    download(blob, filename);
    return Promise.resolve();
  }
  function download(blob, filename) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  $('exportForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var s = selected();
    if (!s.r.from || !s.r.to) { toast('Enter both dates as DD.MM.YYYY'); return; }
    settings.name = $('xName').value.trim(); saveSettings();
    var doc = buildPdf(s.list, s.r, settings.name);
    var fname = xMode === 'month'
      ? 'work-hours-' + MONTHS[+s.r.from.slice(5, 7) - 1].toLowerCase() + '-' + s.r.from.slice(0, 4) + '.pdf'
      : 'work-hours-' + fmtDate(s.r.from) + '-' + fmtDate(s.r.to) + '.pdf';
    shareOrDownload(doc.output('blob'), fname, 'Work hours').then(function () { $('exportDlg').close(); });
  });

  // ---------- backup ----------
  $('menuBtn').addEventListener('click', function () {
    $('storageInfo').textContent = entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies') + ' saved on this device.';
    $('menuDlg').showModal();
  });
  $('backupBtn').addEventListener('click', function () {
    var data = { app: 'work-hours', version: 2, exported: new Date().toISOString(), settings: settings, entries: entries };
    shareOrDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      'work-hours-backup-' + fmtDate(isoDate(new Date())) + '.json', 'Work hours backup');
  });
  $('restoreBtn').addEventListener('click', function () { $('restoreFile').value = ''; $('restoreFile').click(); });
  $('restoreFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result);
        var list = Array.isArray(data) ? data : data.entries;
        if (!Array.isArray(list)) throw new Error('bad');
        var valid = list.filter(function (e) { return e && reDate.test(e.date) && reTime.test(e.start); }).map(clean); // old break/note fields are dropped
        var byId = {}; entries.forEach(function (e) { byId[e.id] = e; });
        var added = 0, updated = 0;
        valid.forEach(function (e) { if (byId[e.id]) { Object.assign(byId[e.id], e); updated++; } else { entries.push(e); byId[e.id] = e; added++; } });
        if (data.settings && data.settings.name && !settings.name) { settings.name = data.settings.name; saveSettings(); }
        save(); render(); $('menuDlg').close();
        toast('Imported: ' + added + ' new, ' + updated + ' updated');
      } catch (e) { toast('That file is not a Work Hours backup'); }
    };
    rd.readAsText(f);
  });

  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
