/**
 * tilo-notes.js v2 — دفترچه یادداشت مستقل و پایدار
 * در index.html: <script src="./tilo-notes.js?v=2"></script>
 */
(function () {
  'use strict';
  if (window.__TiloNotesV2) return;
  window.__TiloNotesV2 = true;

  var STORE = 'tilo_notebook_v2';
  var PIN = 'tilo_notebook_pin_v2';
  var BG = 'tilo_notebook_bg_v2';

  var COLORS = [
    { id: 'def', label: 'عادی', c: '#e2e8f0' },
    { id: 'red', label: 'قرمز', c: '#f87171' },
    { id: 'ora', label: 'نارنجی', c: '#fb923c' },
    { id: 'yel', label: 'زرد', c: '#fbbf24' },
    { id: 'grn', label: 'سبز', c: '#4ade80' },
    { id: 'tea', label: 'فیروزه', c: '#2dd4bf' },
    { id: 'blu', label: 'آبی', c: '#60a5fa' },
    { id: 'pur', label: 'بنفش', c: '#c084fc' },
    { id: 'pnk', label: 'صورتی', c: '#f472b6' }
  ];

  var BGS = [
    { id: 'ink', name: 'مرکب شب', page: '#12151c', ui: '#0c0e14', text: '#e8edf5', line: 'rgba(255,255,255,.08)' },
    { id: 'cream', name: 'کاغذ کرم', page: '#fffcf7', ui: '#f3eee6', text: '#1f2937', line: 'rgba(0,0,0,.08)' },
    { id: 'sage', name: 'سبز ملایم', page: '#14201a', ui: '#0e1612', text: '#d9efe4', line: 'rgba(255,255,255,.08)' },
    { id: 'ocean', name: 'آبی آرام', page: '#121a28', ui: '#0d131c', text: '#d7e6f8', line: 'rgba(255,255,255,.08)' },
    { id: 'plum', name: 'بنفش کم‌رنگ', page: '#1a1524', ui: '#120f1a', text: '#ebe4f8', line: 'rgba(255,255,255,.08)' }
  ];

  var DEFAULT_CATS = [
    { id: 'study', name: 'درس و نکته', emoji: '📚' },
    { id: 'daily', name: 'روند روز', emoji: '📅' },
    { id: 'work', name: 'کار و زندگی', emoji: '💼' },
    { id: 'idea', name: 'ایده', emoji: '💡' },
    { id: 'review', name: 'مرور و جمع‌بندی', emoji: '🔁' },
    { id: 'other', name: 'متفرقه', emoji: '📝' }
  ];

  function now() { return Date.now(); }

  function empty() {
    var id = now();
    return {
      activeId: id,
      cats: DEFAULT_CATS.slice(),
      pages: [{
        id: id,
        title: 'صفحه اول',
        body: '',
        color: 'def',
        cat: 'study',
        pinned: false,
        createdAt: id,
        updatedAt: id
      }]
    };
  }

  function load() {
    try {
      var r = localStorage.getItem(STORE);
      if (!r) {
        // migrate v1 if exists
        var old = localStorage.getItem('tilo_notebook_v1');
        if (old) {
          var o = JSON.parse(old);
          var d = empty();
          if (o.pages && o.pages.length) {
            d.pages = o.pages.map(function (p) {
              return {
                id: p.id || now(),
                title: p.title || 'بدون عنوان',
                body: p.body || '',
                color: p.color === 'default' ? 'def' : (p.color || 'def'),
                cat: p.categoryId || 'other',
                pinned: !!p.pinned,
                createdAt: p.createdAt || now(),
                updatedAt: p.updatedAt || now()
              };
            });
            d.activeId = d.pages[0].id;
          }
          if (o.categories && o.categories.length) {
            d.cats = o.categories.map(function (c) {
              return { id: c.id, name: c.name, emoji: c.icon || '🏷️' };
            });
          }
          save(d);
          return d;
        }
        return empty();
      }
      var d2 = JSON.parse(r);
      if (!d2.pages) d2.pages = empty().pages;
      if (!d2.cats) d2.cats = DEFAULT_CATS.slice();
      return d2;
    } catch (e) {
      return empty();
    }
  }

  function save(d) {
    try { localStorage.setItem(STORE, JSON.stringify(d)); }
    catch (e) { alert('حافظه پر است. چند صفحه قدیمی را حذف کن.'); }
  }

  function hash(s) {
    var h = 2166136261;
    s = 'tn2:' + String(s);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return String(h >>> 0);
  }

  function faTime(ts) {
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date(ts));
    } catch (e) {
      return '';
    }
  }

  function todayISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function color(id) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i];
    return COLORS[0];
  }

  function theme() {
    var id = localStorage.getItem(BG) || 'ink';
    for (var i = 0; i < BGS.length; i++) if (BGS[i].id === id) return BGS[i];
    return BGS[0];
  }

  function catLabel(d, id) {
    for (var i = 0; i < d.cats.length; i++) {
      if (d.cats[i].id === id) return (d.cats[i].emoji || '') + ' ' + d.cats[i].name;
    }
    return '📝 متفرقه';
  }

  function analyze(text) {
    var t = (text || '').trim();
    if (!t) return 'هنوز متنی نیست. نکته درس، خلاصه یا روند روز را بنویس تا جمع‌بندی نشان داده شود.';
    var words = t.split(/\s+/).filter(Boolean).length;
    var lines = t.split(/\n/).filter(function (x) { return x.trim(); }).length;
    var bits = [];
    bits.push('تقریباً <b>' + words + '</b> کلمه در <b>' + lines + '</b> خط.');
    if (/تست|درست|غلط|درصد|گزینه/.test(t)) bits.push('ردپای <b>تست‌زنی</b> هست — تعداد و درصد را هم ثبت کن.');
    if (/نکته|فرمول|تعریف|قانون|قضیه/.test(t)) bits.push('حالت <b>نکته‌نویسی</b>؛ برای مرور بعدی عالی است.');
    if (/فردا|باید|هدف|برنامه/.test(t)) bits.push('عبارات برنامه‌محور دیدی؛ سه اولویت فردا را جدا بنویس.');
    if (/خست|استرس|نگران|خوب|بد/.test(t)) bits.push('حال‌وهوا ثبت شده؛ الگوی انرژی را هفتگی مرور کن.');
    if (words < 40) bits.push('کمی کوتاه است؛ یک مثال یا نتیجه هم اضافه کن.');
    if (words > 250) bits.push('یادداشت کامل است — با «کپی» می‌توانی برای مشاور بفرستی.');
    return bits.map(function (b) { return '• ' + b; }).join('<br>');
  }

  var state = load();
  var unlocked = !localStorage.getItem(PIN);
  var filter = '';
  var q = '';
  var showAi = false;
  var listMode = true; // mobile: list first

  function page() {
    for (var i = 0; i < state.pages.length; i++) {
      if (state.pages[i].id === state.activeId) return state.pages[i];
    }
    return state.pages[0] || null;
  }

  function filtered() {
    var list = state.pages.slice().sort(function (a, b) {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    if (filter) list = list.filter(function (p) { return p.cat === filter; });
    if (q) {
      var qq = q.toLowerCase();
      list = list.filter(function (p) {
        return (p.title || '').toLowerCase().indexOf(qq) >= 0 ||
          (p.body || '').toLowerCase().indexOf(qq) >= 0;
      });
    }
    return list;
  }

  function css() {
    if (document.getElementById('tn2-css')) return;
    var s = document.createElement('style');
    s.id = 'tn2-css';
    s.textContent = [
      '#tn2-root{position:fixed!important;inset:0!important;z-index:2147483000!important;display:none!important;flex-direction:column!important;font-family:Tahoma,Vazirmatn,system-ui,sans-serif!important}',
      '#tn2-root.tn2-on{display:flex!important}',
      '#tn2-root *{box-sizing:border-box}',
      '#tn2-root button{font-family:inherit}',
      '.tn2-top{display:flex;align-items:center;gap:8px;padding:10px 12px;flex-shrink:0;border-bottom:1px solid var(--tn2-line)}',
      '.tn2-ico{width:36px;height:36px;border-radius:10px;border:1px solid var(--tn2-line);background:transparent;color:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
      '.tn2-ico:active{transform:scale(.96)}',
      '.tn2-primary{background:#6366f1!important;border-color:#6366f1!important;color:#fff!important}',
      '.tn2-body{flex:1;min-height:0;display:flex}',
      '.tn2-side{width:min(320px,100%);display:flex;flex-direction:column;min-height:0;border-inline-start:1px solid var(--tn2-line);background:var(--tn2-ui)}',
      '.tn2-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:var(--tn2-page)}',
      '.tn2-search{width:100%;padding:10px 12px;border:1px solid var(--tn2-line);border-radius:12px;background:transparent;color:inherit;outline:none;font-size:14px}',
      '.tn2-select{width:100%;padding:9px 12px;border:1px solid var(--tn2-line);border-radius:12px;background:transparent;color:inherit;outline:none;font-size:13px}',
      '.tn2-list{flex:1;overflow:auto;padding:8px}',
      '.tn2-item{width:100%;text-align:right;padding:12px;border-radius:14px;border:1px solid transparent;background:transparent;color:inherit;cursor:pointer;margin-bottom:6px}',
      '.tn2-item.on{border-color:#6366f1;background:rgba(99,102,241,.14)}',
      '.tn2-item b{display:block;font-size:13px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tn2-item span{font-size:11px;opacity:.65}',
      '.tn2-title{width:100%;border:0;background:transparent;color:inherit;font-size:20px;font-weight:800;outline:none;padding:16px 16px 8px}',
      '.tn2-text{width:100%;flex:1;border:0;resize:none;background:transparent;color:inherit;outline:none;padding:8px 16px 16px;font-size:16px;line-height:1.9;min-height:220px}',
      '.tn2-foot{flex-shrink:0;border-top:1px solid var(--tn2-line);padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:var(--tn2-ui)}',
      '.tn2-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.tn2-chip{width:24px;height:24px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}',
      '.tn2-chip.on{border-color:#fff;box-shadow:0 0 0 2px #6366f1}',
      '.tn2-btn{border:1px solid var(--tn2-line);background:transparent;color:inherit;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer}',
      '.tn2-btn.danger{color:#f87171;border-color:rgba(248,113,113,.35)}',
      '.tn2-ai{display:none;padding:10px 12px;margin:0 12px 8px;border-radius:12px;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.28);font-size:12px;line-height:1.75}',
      '.tn2-ai.on{display:block}',
      '.tn2-lock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);z-index:5;padding:20px}',
      '.tn2-card{width:min(360px,100%);padding:22px;border-radius:18px;background:var(--tn2-page);border:1px solid var(--tn2-line);text-align:center}',
      '.tn2-fab{position:fixed!important;bottom:88px!important;left:14px!important;z-index:99990!important;width:48px!important;height:48px!important;border-radius:14px!important;border:1px solid rgba(148,163,184,.35)!important;background:linear-gradient(145deg,#312e81,#4f46e5)!important;color:#fff!important;cursor:pointer!important;box-shadow:0 10px 28px rgba(79,70,229,.45)!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:18px!important;pointer-events:auto!important}',
      '@media (min-width:860px){.tn2-side{display:flex!important}.tn2-main{display:flex!important}}',
      '@media (max-width:859px){',
      '.tn2-body.list .tn2-main{display:none!important}',
      '.tn2-body.list .tn2-side{width:100%;border:0}',
      '.tn2-body.edit .tn2-side{display:none!important}',
      '.tn2-body.edit .tn2-main{width:100%}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function rootEl() {
    var el = document.getElementById('tn2-root');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tn2-root';
    document.body.appendChild(el);
    return el;
  }

  function persistFields() {
    var p = page();
    if (!p) return;
    var t = document.getElementById('tn2-title');
    var b = document.getElementById('tn2-text');
    var c = document.getElementById('tn2-cat');
    if (t) p.title = t.value;
    if (b) p.body = b.value;
    if (c) p.cat = c.value;
    p.updatedAt = now();
  }

  function open() {
    css();
    unlocked = !localStorage.getItem(PIN);
    var el = rootEl();
    el.className = 'tn2-on';
    el.style.cssText = 'display:flex!important;position:fixed!important;inset:0!important;z-index:2147483000!important';
    document.body.style.overflow = 'hidden';
    listMode = true;
    paint();
  }

  function close() {
    persistFields();
    save(state);
    var el = document.getElementById('tn2-root');
    if (el) {
      el.className = '';
      el.style.cssText = 'display:none!important';
    }
    document.body.style.overflow = '';
  }

  function paint() {
    css();
    var el = rootEl();
    var th = theme();
    el.style.setProperty('--tn2-page', th.page);
    el.style.setProperty('--tn2-ui', th.ui);
    el.style.setProperty('--tn2-line', th.line);
    el.style.background = th.ui;
    el.style.color = th.text;

    if (!unlocked) {
      el.innerHTML =
        '<div class="tn2-lock"><div class="tn2-card">' +
        '<div style="font-size:28px;margin-bottom:8px"><i class="fas fa-lock"></i></div>' +
        '<div style="font-weight:800;margin-bottom:6px">دفترچه قفل است</div>' +
        '<input id="tn2-pin" type="password" inputmode="numeric" class="tn2-search" placeholder="رمز ورود" dir="ltr" style="margin:10px 0;text-align:center">' +
        '<button type="button" class="tn2-btn tn2-primary" id="tn2-pin-ok" style="width:100%;padding:12px">ورود</button>' +
        '<button type="button" class="tn2-btn" id="tn2-pin-x" style="width:100%;margin-top:8px;padding:12px">بستن</button>' +
        '</div></div>';
      el.querySelector('#tn2-pin-ok').onclick = function () {
        var v = el.querySelector('#tn2-pin').value;
        if (hash(v) === localStorage.getItem(PIN)) { unlocked = true; paint(); }
        else alert('رمز نادرست است');
      };
      el.querySelector('#tn2-pin-x').onclick = close;
      return;
    }

    var p = page();
    var list = filtered();
    var items = list.map(function (x) {
      var col = color(x.color);
      return '<button type="button" class="tn2-item' + (x.id === state.activeId ? ' on' : '') + '" data-id="' + x.id + '">' +
        '<b style="color:' + col.c + '">' + (x.pinned ? '📌 ' : '') + esc(x.title || 'بدون عنوان') + '</b>' +
        '<span>' + esc(catLabel(state, x.cat)) + ' · ' + faTime(x.updatedAt) + '</span></button>';
    }).join('') || '<div style="opacity:.5;text-align:center;padding:24px;font-size:13px">موردی نیست</div>';

    var catOpts = state.cats.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (p && p.cat === c.id ? ' selected' : '') + '>' +
        esc((c.emoji || '') + ' ' + c.name) + '</option>';
    }).join('');

    var filterOpts = '<option value="">همه دسته‌ها</option>' + state.cats.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (filter === c.id ? ' selected' : '') + '>' +
        esc((c.emoji || '') + ' ' + c.name) + '</option>';
    }).join('');

    var chips = COLORS.map(function (c) {
      return '<button type="button" class="tn2-chip' + (p && p.color === c.id ? ' on' : '') +
        '" data-color="' + c.id + '" title="' + c.label + '" style="background:' + c.c + '"></button>';
    }).join('');

    var bgBtns = BGS.map(function (b) {
      var on = (localStorage.getItem(BG) || 'ink') === b.id;
      return '<button type="button" class="tn2-btn" data-bg="' + b.id + '" style="' +
        (on ? 'outline:2px solid #818cf8' : '') + '">' + esc(b.name) + '</button>';
    }).join('');

    el.innerHTML =
      '<div class="tn2-top">' +
      '<button type="button" class="tn2-ico" id="tn2-close" title="بستن"><i class="fas fa-times"></i></button>' +
      '<div style="flex:1;font-weight:900;font-size:14px">دفترچه یادداشت</div>' +
      '<button type="button" class="tn2-btn" id="tn2-new"><i class="fas fa-plus"></i> صفحه</button>' +
      '<button type="button" class="tn2-btn tn2-primary" id="tn2-save">ذخیره</button>' +
      '</div>' +
      '<div class="tn2-body ' + (listMode ? 'list' : 'edit') + '" id="tn2-body-wrap">' +
      '<aside class="tn2-side">' +
      '<div style="padding:10px;display:grid;gap:8px">' +
      '<input class="tn2-search" id="tn2-q" placeholder="جست‌وجو در نکات و یادداشت‌ها..." value="' + esc(q) + '">' +
      '<select class="tn2-select" id="tn2-filter">' + filterOpts + '</select>' +
      '</div>' +
      '<div class="tn2-list">' + items + '</div>' +
      '</aside>' +
      '<section class="tn2-main">' +
      (p ? (
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--tn2-line)">' +
        '<button type="button" class="tn2-ico" id="tn2-back" title="لیست" style="display:none"><i class="fas fa-arrow-right"></i></button>' +
        '<div style="flex:1;font-size:11px;opacity:.65">' + faTime(p.updatedAt) + '</div></div>' +
        '<input class="tn2-title" id="tn2-title" value="' + esc(p.title) + '" placeholder="عنوان نکته یا صفحه...">' +
        '<textarea class="tn2-text" id="tn2-text" placeholder="نکته‌ها، خلاصه درس، روند روز، ایده‌ها... اینجا مکتوب کن. ذخیره خودکار است." style="color:' +
          color(p.color).c + '">' + esc(p.body) + '</textarea>' +
        '<div class="tn2-ai' + (showAi ? ' on' : '') + '" id="tn2-ai">' + (showAi ? analyze(p.body) : '') + '</div>' +
        '<div class="tn2-foot">' +
        '<div class="tn2-row"><span style="font-size:11px;opacity:.7">رنگ:</span>' + chips +
        '<select class="tn2-select" id="tn2-cat" style="width:auto;min-width:140px">' + catOpts + '</select></div>' +
        '<div class="tn2-row">' +
        '<button type="button" class="tn2-btn" id="tn2-copy"><i class="fas fa-copy"></i> کپی</button>' +
        '<button type="button" class="tn2-btn" id="tn2-ai-btn"><i class="fas fa-magic"></i> تحلیل</button>' +
        '<button type="button" class="tn2-btn" id="tn2-today"><i class="fas fa-calendar-day"></i> امروز</button>' +
        '<button type="button" class="tn2-btn" id="tn2-pin">' + (p.pinned ? 'برداشتن سنجاق' : 'سنجاق') + '</button>' +
        '<button type="button" class="tn2-btn danger" id="tn2-del">حذف</button></div>' +
        '<div class="tn2-row"><span style="font-size:11px;opacity:.7">پس‌زمینه:</span>' + bgBtns +
        '<button type="button" class="tn2-btn" id="tn2-addcat">+ دسته</button>' +
        '<button type="button" class="tn2-btn" id="tn2-setpin">' + (localStorage.getItem(PIN) ? 'رمز' : 'گذاشتن رمز') + '</button></div>' +
        '</div>'
      ) : '<div style="padding:40px;text-align:center;opacity:.6">صفحه‌ای نیست</div>') +
      '</section></div>';

    // mobile back button visibility
    var back = el.querySelector('#tn2-back');
    if (back) {
      if (window.innerWidth < 860) {
        back.style.display = listMode ? 'none' : 'inline-flex';
      }
    }

    el.querySelector('#tn2-close').onclick = close;

    el.querySelector('#tn2-new').onclick = function () {
      persistFields();
      var id = now();
      state.pages.unshift({
        id: id, title: 'نکته جدید', body: '', color: 'def',
        cat: filter || 'study', pinned: false, createdAt: id, updatedAt: id
      });
      state.activeId = id;
      save(state);
      listMode = false;
      showAi = false;
      paint();
    };

    el.querySelector('#tn2-save').onclick = function () {
      persistFields();
      save(state);
      var b = el.querySelector('#tn2-save');
      b.textContent = 'ذخیره شد';
      setTimeout(function () { b.textContent = 'ذخیره'; }, 800);
    };

    el.querySelector('#tn2-q').oninput = function (e) {
      q = e.target.value.trim();
      persistFields();
      paint();
      var nq = document.getElementById('tn2-q');
      if (nq) { nq.focus(); nq.selectionStart = nq.selectionEnd = nq.value.length; }
    };
    el.querySelector('#tn2-filter').onchange = function (e) {
      filter = e.target.value;
      persistFields();
      paint();
    };

    el.querySelectorAll('.tn2-item').forEach(function (btn) {
      btn.onclick = function () {
        persistFields();
        state.activeId = Number(btn.getAttribute('data-id'));
        save(state);
        listMode = false;
        showAi = false;
        paint();
      };
    });

    if (back) back.onclick = function () {
      persistFields();
      save(state);
      listMode = true;
      paint();
    };

    if (!p) return;

    el.querySelectorAll('[data-color]').forEach(function (ch) {
      ch.onclick = function () {
        persistFields();
        p.color = ch.getAttribute('data-color');
        p.updatedAt = now();
        save(state);
        paint();
      };
    });
    el.querySelectorAll('[data-bg]').forEach(function (b) {
      b.onclick = function () {
        localStorage.setItem(BG, b.getAttribute('data-bg'));
        persistFields();
        paint();
      };
    });

    el.querySelector('#tn2-copy').onclick = function () {
      persistFields();
      var text = (p.title || '') + '\n\n' + (p.body || '');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { alert('کپی شد'); })
          .catch(function () { prompt('کپی:', text); });
      } else prompt('کپی:', text);
    };

    el.querySelector('#tn2-ai-btn').onclick = function () {
      persistFields();
      showAi = !showAi;
      paint();
    };

    el.querySelector('#tn2-today').onclick = function () {
      persistFields();
      p.body = (p.body || '') + '\n\n—— ' + faTime(now()) + ' ——\n';
      if (!p.title || p.title === 'نکته جدید' || p.title === 'صفحه اول') p.title = 'روند ' + todayISO();
      p.cat = 'daily';
      p.updatedAt = now();
      save(state);
      paint();
      var ta = document.getElementById('tn2-text');
      if (ta) { ta.focus(); ta.scrollTop = ta.scrollHeight; }
    };

    el.querySelector('#tn2-pin').onclick = function () {
      persistFields();
      p.pinned = !p.pinned;
      p.updatedAt = now();
      save(state);
      paint();
    };

    el.querySelector('#tn2-del').onclick = function () {
      if (state.pages.length <= 1) return alert('حداقل یک صفحه لازم است');
      if (!confirm('حذف این صفحه؟')) return;
      state.pages = state.pages.filter(function (x) { return x.id !== p.id; });
      state.activeId = state.pages[0].id;
      save(state);
      listMode = true;
      paint();
    };

    el.querySelector('#tn2-addcat').onclick = function () {
      var name = prompt('نام دسته جدید:');
      if (!name || !name.trim()) return;
      state.cats.push({ id: 'c' + now(), name: name.trim(), emoji: '🏷️' });
      save(state);
      paint();
    };

    el.querySelector('#tn2-setpin').onclick = function () {
      var has = !!localStorage.getItem(PIN);
      if (has) {
        var cur = prompt('رمز فعلی:');
        if (hash(cur) !== localStorage.getItem(PIN)) return alert('نادرست');
        var nx = prompt('رمز جدید (خالی = حذف قفل):');
        if (nx === null) return;
        if (!String(nx).trim()) localStorage.removeItem(PIN);
        else localStorage.setItem(PIN, hash(String(nx).trim()));
      } else {
        var a = prompt('رمز جدید:');
        if (!a || !String(a).trim()) return;
        var b = prompt('تکرار رمز:');
        if (a !== b) return alert('یکسان نیست');
        localStorage.setItem(PIN, hash(String(a).trim()));
      }
      paint();
    };

    var title = el.querySelector('#tn2-title');
    var text = el.querySelector('#tn2-text');
    var cat = el.querySelector('#tn2-cat');
    var timer;
    function auto() {
      clearTimeout(timer);
      timer = setTimeout(function () { persistFields(); save(state); }, 500);
    }
    if (title) title.addEventListener('input', auto);
    if (text) text.addEventListener('input', auto);
    if (cat) cat.addEventListener('change', function () { persistFields(); save(state); });
  }

  function mountFab() {
    if (document.getElementById('tn2-fab')) return;
    var fab = document.createElement('button');
    fab.id = 'tn2-fab';
    fab.type = 'button';
    fab.className = 'tn2-fab';
    fab.title = 'دفترچه یادداشت';
    fab.setAttribute('aria-label', 'دفترچه یادداشت');
    fab.innerHTML = '<i class="fas fa-pen-fancy"></i>';
    fab.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      open();
    }, true);
    document.body.appendChild(fab);
  }

  function mountMenu() {
    var navs = document.getElementById('tilo-drawer-navs');
    if (!navs || document.getElementById('tn2-menu')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'tn2-menu';
    btn.className = 'w-full text-right px-3 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800/80 transition';
    btn.innerHTML = '<i class="fas fa-pen-fancy" style="margin-left:6px"></i> دفترچه یادداشت';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var bd = document.querySelector('.tilo-drawer-backdrop');
      var pn = document.querySelector('.tilo-drawer-panel');
      if (bd) bd.classList.remove('open');
      if (pn) pn.classList.remove('open');
      setTimeout(open, 30);
    }, true);
    navs.appendChild(btn);
  }

  // remove old v1 fab if present
  function cleanupOld() {
    var old = document.getElementById('tilo-notes-fab');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var oldBtn = document.getElementById('tilo-notes-menu-btn');
    if (oldBtn && oldBtn.parentNode) oldBtn.parentNode.removeChild(oldBtn);
    var oldRoot = document.getElementById('tilo-notes-root');
    if (oldRoot && oldRoot.parentNode) oldRoot.parentNode.removeChild(oldRoot);
  }

  window.TiloNotes = { open: open, close: close };

  function boot() {
    cleanupOld();
    css();
    mountFab();
    mountMenu();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setInterval(function () { mountFab(); mountMenu(); }, 1000);
})();
