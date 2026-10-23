(function () {
  'use strict';
  var KEY = 'tilo_konkur_date';

  function iso(d) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
  function streak(parts) {
    var days = {};
    (parts || []).forEach(function (p) { if (p.status === 'completed' && !p.isLife && p.dateISO) days[p.dateISO] = 1; });
    var d = new Date(), n = 0;
    if (!days[iso(d)]) d = new Date(Date.now() - 864e5);
    while (days[iso(d)]) { n++; d = new Date(d.getTime() - 864e5); }
    return n;
  }

  function build(st, dash) {
    if (document.getElementById('tilo-konkur-widget')) return;
    var box = document.createElement('div');
    box.id = 'tilo-konkur-widget';
    box.className = 'soft-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 border border-indigo-500/20';
    box.innerHTML =
      '<div class="flex items-center gap-4">' +
        '<div class="text-center"><div id="tk-days" class="text-3xl font-black text-white" dir="ltr">—</div><div class="text-[11px] text-slate-400">روز تا کنکور</div></div>' +
        '<div class="w-px h-10 bg-slate-700"></div>' +
        '<div class="text-center"><div id="tk-streak" class="text-3xl font-black text-amberSoft" dir="ltr">0</div><div class="text-[11px] text-slate-400">روز پیاپی مطالعه</div></div>' +
      '</div>' +
      '<label class="text-[11px] text-slate-400 flex flex-col gap-1">تاریخ کنکور' +
        '<input id="tk-date" type="date" class="input-calm text-xs py-1.5" dir="ltr">' +
        '<span id="tk-fa" class="text-[10px] text-tealSoft"></span>' +
      '</label>';
    dash.insertBefore(box, dash.firstElementChild);

    var inp = box.querySelector('#tk-date');
    var fa = box.querySelector('#tk-fa');
    inp.addEventListener('change', function () { localStorage.setItem(KEY, inp.value || ''); render(); });

    function render() {
      var v = localStorage.getItem(KEY) || '';
      if (document.activeElement !== inp) inp.value = v;
      var el = box.querySelector('#tk-days');
      if (v) {
        var n = daysBetween(iso(new Date()), v);
        el.textContent = n >= 0 ? String(n) : 'پایان';
        try {
          fa.textContent = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long', timeZone: 'Asia/Tehran' }).format(new Date(v + 'T12:00:00Z'));
        } catch (e) { fa.textContent = v; }
      } else {
        el.textContent = '—';
        fa.textContent = 'تاریخ را انتخاب کن';
      }
      box.querySelector('#tk-streak').textContent = String(streak(st.parts));
    }
    render();
    setInterval(render, 5000);

    var lock = null;
    setInterval(function () {
      var t = st.timer, on = !!(t && t.active && t.running);
      if (on && !lock && navigator.wakeLock) {
        navigator.wakeLock.request('screen').then(function (l) {
          lock = l;
          l.addEventListener('release', function () { lock = null; });
        }).catch(function () {});
      } else if (!on && lock) {
        lock.release().catch(function () {});
        lock = null;
      }
    }, 2000);
  }

  var wait = setInterval(function () {
    var st = window.TiloPlus && window.TiloPlus.vueState;
    var main = document.querySelector('main');
    if (!st || !main) return;
    var dash = Array.prototype.filter.call(main.children, function (e) {
      return e.tagName === 'DIV' && !e.classList.contains('fixed');
    })[0];
    if (!dash) return;
    clearInterval(wait);
    build(st, dash);
  }, 300);
})();
