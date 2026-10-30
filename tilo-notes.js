/**
 * tilo-notes.js — دفترچه یادداشت مستقل
 * فقط این فایل را بعد از tilo-upgrade.js اضافه کن؛ بقیه فایل‌ها دست‌نخورده می‌مانند.
 */
(function initTiloNotes() {
  'use strict';
  if (window.__TiloNotesLoaded) return;
  window.__TiloNotesLoaded = true;

  var STORAGE = 'tilo_notebook_v1';
  var PIN_KEY = 'tilo_notebook_pin';
  var BG_KEY = 'tilo_notebook_bg';

  var COLORS = [
    { id: 'default', name: 'عادی', fg: 'inherit', bg: 'transparent' },
    { id: 'red', name: 'قرمز', fg: '#f87171', bg: 'rgba(248,113,113,.08)' },
    { id: 'orange', name: 'نارنجی', fg: '#fb923c', bg: 'rgba(251,146,60,.08)' },
    { id: 'amber', name: 'کهربایی', fg: '#fbbf24', bg: 'rgba(251,191,36,.08)' },
    { id: 'green', name: 'سبز', fg: '#4ade80', bg: 'rgba(74,222,128,.08)' },
    { id: 'teal', name: 'فیروزه‌ای', fg: '#2dd4bf', bg: 'rgba(45,212,191,.08)' },
    { id: 'blue', name: 'آبی', fg: '#60a5fa', bg: 'rgba(96,165,250,.08)' },
    { id: 'purple', name: 'بنفش', fg: '#c084fc', bg: 'rgba(192,132,252,.08)' },
    { id: 'pink', name: 'صورتی', fg: '#f472b6', bg: 'rgba(244,114,182,.08)' }
  ];

  var BACKGROUNDS = [
    { id: 'night', name: 'شب آرام', css: 'linear-gradient(165deg,#0f1419 0%,#1a1f2e 50%,#12161f 100%)', paper: '#161b24', text: '#e8edf5' },
    { id: 'paper', name: 'کاغذ کرم', css: 'linear-gradient(165deg,#f5f0e6 0%,#ebe4d6 100%)', paper: '#fffcf5', text: '#1f2937' },
    { id: 'forest', name: 'سبز ملایم', css: 'linear-gradient(165deg,#0f1a14 0%,#152820 100%)', paper: '#13241c', text: '#d8efe4' },
    { id: 'ocean', name: 'آبی عمیق', css: 'linear-gradient(165deg,#0c1520 0%,#122033 100%)', paper: '#121c2c', text: '#d6e6f7' },
    { id: 'lavender', name: 'یاسی', css: 'linear-gradient(165deg,#1a1424 0%,#221a30 100%)', paper: '#1e1730', text: '#ebe4f7' },
    { id: 'slate', name: 'خاکستری', css: 'linear-gradient(165deg,#18181b 0%,#27272a 100%)', paper: '#1f1f23', text: '#e4e4e7' }
  ];

  var DEFAULT_CATS = [
    { id: 'study', name: 'درس و مطالعه', icon: '📚' },
    { id: 'daily', name: 'روند روز', icon: '📅' },
    { id: 'life', name: 'زندگی و کار', icon: '💼' },
    { id: 'idea', name: 'ایده', icon: '💡' },
    { id: 'mood', name: 'حال و انرژی', icon: '🌱' },
    { id: 'other', name: 'متفرقه', icon: '📝' }
  ];

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE);
      if (!raw) return emptyData();
      var d = JSON.parse(raw);
      if (!d.pages) d.pages = [];
      if (!d.categories) d.categories = DEFAULT_CATS.slice();
      return d;
    } catch (e) {
      return emptyData();
    }
  }

  function emptyData() {
    var now = Date.now();
    return {
      pages: [{
        id: now,
        title: 'صفحه اول',
        body: '',
        color: 'default',
        categoryId: 'daily',
        pinned: false,
        createdAt: now,
        updatedAt: now
      }],
      categories: DEFAULT_CATS.slice(),
      activeId: now
    };
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
    } catch (e) {
      alert('فضای ذخیره‌سازی پر است. چند یادداشت قدیمی را حذف کن.');
    }
  }

  function hashPin(pin) {
    var h = 0;
    var s = 'tilo-notes-' + String(pin);
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return String(h);
  }

  function todayISO() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
  }

  function faDate(ts) {
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(new Date(ts));
    } catch (e) {
      return new Date(ts).toLocaleString('fa-IR');
    }
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function colorOf(id) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i];
    return COLORS[0];
  }

  function bgOf(id) {
    for (var i = 0; i < BACKGROUNDS.length; i++) if (BACKGROUNDS[i].id === id) return BACKGROUNDS[i];
    return BACKGROUNDS[0];
  }

  function injectStyles() {
    if (document.getElementById('tilo-notes-css')) return;
    var css = document.createElement('style');
    css.id = 'tilo-notes-css';
    css.textContent = [
      '#tilo-notes-root{position:fixed;inset:0;z-index:120000;display:none!important;flex-direction:column;font-family:inherit}',
      '#tilo-notes-root.open{display:flex!important}',
      '#tilo-notes-root *{box-sizing:border-box}',
      '.tn-bar{display:flex;align-items:center;gap:.5rem;padding:.65rem .85rem;border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(12px);flex-shrink:0}',
      '.tn-btn{border:0;border-radius:.75rem;padding:.45rem .7rem;font-size:12px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.08);color:inherit;transition:.15s}',
      '.tn-btn:hover{background:rgba(255,255,255,.14)}',
      '.tn-btn-primary{background:#6366f1;color:#fff}',
      '.tn-btn-primary:hover{background:#4f46e5}',
      '.tn-btn-danger{background:rgba(248,113,113,.15);color:#f87171}',
      '.tn-layout{display:flex;flex:1;min-height:0}',
      '.tn-sidebar{width:min(300px,42vw);border-left:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;min-height:0;flex-shrink:0}',
      '.tn-sidebar-scroll{flex:1;overflow:auto;padding:.6rem}',
      '.tn-page-item{display:block;width:100%;text-align:right;padding:.7rem .75rem;border-radius:.9rem;border:1px solid transparent;background:transparent;color:inherit;cursor:pointer;margin-bottom:.35rem}',
      '.tn-page-item:hover{background:rgba(255,255,255,.05)}',
      '.tn-page-item.active{background:rgba(99,102,241,.18);border-color:rgba(99,102,241,.35)}',
      '.tn-page-item .tn-title{font-size:13px;font-weight:800;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tn-page-item .tn-meta{font-size:10px;opacity:.65;margin-top:.2rem}',
      '.tn-main{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}',
      '.tn-editor-wrap{flex:1;display:flex;flex-direction:column;padding:.75rem;min-height:0}',
      '.tn-title-input{width:100%;background:transparent;border:0;font-size:1.15rem;font-weight:900;color:inherit;outline:none;margin-bottom:.5rem;padding:.25rem 0}',
      '.tn-body{flex:1;width:100%;resize:none;border:0;outline:none;background:transparent;color:inherit;font-size:15px;line-height:1.85;padding:.25rem 0;min-height:180px}',
      '.tn-tools{display:flex;flex-wrap:wrap;gap:.4rem;padding:.5rem .75rem;border-top:1px solid rgba(255,255,255,.08);align-items:center}',
      '.tn-chip{width:22px;height:22px;border-radius:999px;border:2px solid transparent;cursor:pointer;padding:0}',
      '.tn-chip.on{border-color:#fff;box-shadow:0 0 0 2px rgba(99,102,241,.6)}',
      '.tn-lock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,10,14,.92);z-index:5;padding:1.5rem}',
      '.tn-lock-card{width:min(340px,100%);padding:1.4rem;border-radius:1.25rem;background:rgba(22,27,36,.95);border:1px solid rgba(255,255,255,.1);text-align:center}',
      '.tn-input{width:100%;padding:.7rem .85rem;border-radius:.85rem;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.25);color:inherit;outline:none;font-size:14px;margin:.4rem 0}',
      '.tn-ai{margin:.5rem .75rem;padding:.85rem;border-radius:1rem;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.25);font-size:12px;line-height:1.7;display:none}',
      '.tn-ai.open{display:block}',
      '.tn-empty{opacity:.5;text-align:center;padding:2rem 1rem;font-size:13px}',
      '@media (max-width:720px){.tn-sidebar{width:100%;max-height:38vh;border-left:0;border-bottom:1px solid rgba(255,255,255,.08)}.tn-layout{flex-direction:column}}'
    ].join('');
    document.head.appendChild(css);
  }

  var data = load();
  var unlocked = !localStorage.getItem(PIN_KEY);
  var filterCat = '';
  var searchQ = '';
  var aiOpen = false;

  function activePage() {
    var id = data.activeId;
    for (var i = 0; i < data.pages.length; i++) if (data.pages[i].id === id) return data.pages[i];
    return data.pages[0] || null;
  }

  function ensureRoot() {
    var root = document.getElementById('tilo-notes-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'tilo-notes-root';
    document.body.appendChild(root);
    return root;
  }

  function applyBg(root) {
    var bgId = localStorage.getItem(BG_KEY) || 'night';
    var bg = bgOf(bgId);
    root.style.background = bg.css;
    root.style.color = bg.text;
    root.dataset.bg = bgId;
  }

  function filteredPages() {
    var list = data.pages.slice().sort(function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    if (filterCat) list = list.filter(function (p) { return p.categoryId === filterCat; });
    if (searchQ) {
      var q = searchQ.toLowerCase();
      list = list.filter(function (p) {
        return (p.title || '').toLowerCase().indexOf(q) !== -1 ||
          (p.body || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    return list;
  }

  function catName(id) {
    for (var i = 0; i < data.categories.length; i++) {
      if (data.categories[i].id === id) {
        return (data.categories[i].icon || '') + ' ' + data.categories[i].name;
      }
    }
    return '📝 متفرقه';
  }

  function analyzeText(text) {
    var t = (text || '').trim();
    if (!t) return 'متنی برای تحلیل نیست. چند خط از روند روز یا نکات درس بنویس.';
    var lines = t.split(/\n+/).filter(Boolean);
    var words = t.split(/\s+/).filter(Boolean).length;
    var hasStudy = /درس|مطالعه|تست|کنکور|فیزیک|ریاضی|شیمی|زیست|عربی|حفظ/.test(t);
    var hasMood = /خست|استرس|نگران|امید|انرژی|خوب|بد|موفق/.test(t);
    var hasPlan = /فردا|برنامه|باید|هدف|تموم|تمام/.test(t);
    var tips = [];
    tips.push('حدود <strong>' + words + ' کلمه</strong> در <strong>' + lines.length + ' بند</strong> ثبت شده.');
    if (hasStudy) tips.push('ردپای <strong>مطالعه/درس</strong> دیده می‌شود — اگر تست زدی، تعداد و درصد را هم یادداشت کن تا روند مشخص شود.');
    if (hasMood) tips.push('نشانه‌های <strong>حال‌وهوا</strong> هست؛ ثبت کوتاه انرژی روزانه به شناسایی الگوی خستگی کمک می‌کند.');
    if (hasPlan) tips.push('عبارات برنامه‌محور دیدی؛ یک خط «سه کار اولویت فردا» در همان صفحه بنویس.');
    if (!hasStudy && !hasMood) tips.push('می‌توانی با برچسب دسته «روند روز» یا «درس» نظم بیشتری بدهی.');
    if (words < 30) tips.push('یادداشت کوتاه است؛ برای تحلیل بهتر، ۲–۳ جمله درباره نتیجه یا احساس بعد از کار اضافه کن.');
    else if (words > 200) tips.push('یادداشت مفصل است — عالی برای مرور هفتگی. با دکمه کپی می‌توانی برای مشاور بفرستی.');
    return tips.map(function (x) { return '• ' + x; }).join('<br>');
  }

  function render() {
    injectStyles();
    var root = ensureRoot();
    applyBg(root);
    var bg = bgOf(localStorage.getItem(BG_KEY) || 'night');
    var page = activePage();
    var col = colorOf(page && page.color);

    if (!unlocked) {
      root.innerHTML =
        '<div class="tn-lock">' +
        '<div class="tn-lock-card">' +
        '<div style="font-size:2rem;margin-bottom:.4rem">🔒</div>' +
        '<h3 style="margin:0 0 .35rem;font-size:1rem">دفترچه قفل است</h3>' +
        '<p style="font-size:12px;opacity:.7;margin:0 0 .8rem">رمز ورود را وارد کن</p>' +
        '<input id="tn-pin-in" class="tn-input" type="password" inputmode="numeric" placeholder="رمز" dir="ltr">' +
        '<button type="button" class="tn-btn tn-btn-primary" id="tn-pin-ok" style="width:100%;margin-top:.4rem">ورود</button>' +
        '<button type="button" class="tn-btn" id="tn-pin-close" style="width:100%;margin-top:.4rem">بستن</button>' +
        '</div></div>';
      root.querySelector('#tn-pin-ok').onclick = function () {
        var v = root.querySelector('#tn-pin-in').value;
        if (hashPin(v) === localStorage.getItem(PIN_KEY)) {
          unlocked = true;
          render();
        } else alert('رمز نادرست است.');
      };
      root.querySelector('#tn-pin-close').onclick = closeNotes;
      root.querySelector('#tn-pin-in').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') root.querySelector('#tn-pin-ok').click();
      });
      return;
    }

    var pages = filteredPages();
    var listHtml = pages.length ? pages.map(function (p) {
      var c = colorOf(p.color);
      return '<button type="button" class="tn-page-item' + (p.id === data.activeId ? ' active' : '') + '" data-id="' + p.id + '">' +
        '<span class="tn-title" style="color:' + c.fg + '">' + (p.pinned ? '📌 ' : '') + esc(p.title || 'بدون عنوان') + '</span>' +
        '<span class="tn-meta">' + esc(catName(p.categoryId)) + ' · ' + faDate(p.updatedAt || p.createdAt) + '</span>' +
        '</button>';
    }).join('') : '<div class="tn-empty">صفحه‌ای در این فیلتر نیست</div>';

    var catOpts = data.categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + ((page && page.categoryId === c.id) ? ' selected' : '') + '>' +
        esc((c.icon || '') + ' ' + c.name) + '</option>';
    }).join('');

    var filterOpts = '<option value="">همه دسته‌ها</option>' + data.categories.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (filterCat === c.id ? ' selected' : '') + '>' +
        esc((c.icon || '') + ' ' + c.name) + '</option>';
    }).join('');

    var colorChips = COLORS.map(function (c) {
      return '<button type="button" class="tn-chip' + ((page && page.color === c.id) ? ' on' : '') +
        '" data-color="' + c.id + '" title="' + c.name + '" style="background:' + (c.fg === 'inherit' ? '#94a3b8' : c.fg) + '"></button>';
    }).join('');

    var bgChips = BACKGROUNDS.map(function (b) {
      var on = (localStorage.getItem(BG_KEY) || 'night') === b.id;
      return '<button type="button" class="tn-btn" data-bg="' + b.id + '" style="font-size:11px;' +
        (on ? 'outline:2px solid #818cf8' : '') + '">' + esc(b.name) + '</button>';
    }).join('');

    root.innerHTML =
      '<div class="tn-bar">' +
      '<button type="button" class="tn-btn" id="tn-close" title="بستن">✕</button>' +
      '<strong style="flex:1;font-size:13px">📓 دفترچه یادداشت</strong>' +
      '<button type="button" class="tn-btn" id="tn-new">+ صفحه</button>' +
      '<button type="button" class="tn-btn tn-btn-primary" id="tn-save">ذخیره</button>' +
      '</div>' +
      '<div class="tn-layout">' +
      '<aside class="tn-sidebar" style="background:' + bg.paper + '">' +
      '<div style="padding:.6rem;display:flex;flex-direction:column;gap:.4rem">' +
      '<input class="tn-input" id="tn-search" placeholder="جست‌وجو در یادداشت‌ها..." value="' + esc(searchQ) + '" style="margin:0">' +
      '<select class="tn-input" id="tn-filter" style="margin:0">' + filterOpts + '</select>' +
      '</div>' +
      '<div class="tn-sidebar-scroll">' + listHtml + '</div>' +
      '</aside>' +
      '<section class="tn-main">' +
      (page ? (
        '<div class="tn-editor-wrap" style="background:' + bg.paper + ';border-radius:0">' +
        '<input class="tn-title-input" id="tn-title" value="' + esc(page.title) + '" placeholder="عنوان صفحه...">' +
        '<textarea class="tn-body" id="tn-body" placeholder="اینجا بنویس... درس، روند روز، کار، ایده یا هر چیزی که می‌خواهی نگه داری." style="color:' +
          (col.fg === 'inherit' ? 'inherit' : col.fg) + ';background:' + col.bg + '">' + esc(page.body) + '</textarea>' +
        '</div>' +
        '<div class="tn-ai' + (aiOpen ? ' open' : '') + '" id="tn-ai-box">' + (aiOpen ? analyzeText(page.body) : '') + '</div>' +
        '<div class="tn-tools">' +
        '<span style="font-size:11px;opacity:.7">رنگ متن:</span>' + colorChips +
        '<select class="tn-input" id="tn-cat" style="width:auto;margin:0;padding:.35rem .5rem;font-size:11px">' + catOpts + '</select>' +
        '<button type="button" class="tn-btn" id="tn-pin">' + (page.pinned ? 'برداشتن سنجاق' : 'سنجاق') + '</button>' +
        '<button type="button" class="tn-btn" id="tn-copy">کپی</button>' +
        '<button type="button" class="tn-btn" id="tn-ai">تحلیل</button>' +
        '<button type="button" class="tn-btn" id="tn-today">یادداشت امروز</button>' +
        '<button type="button" class="tn-btn tn-btn-danger" id="tn-del">حذف صفحه</button>' +
        '</div>' +
        '<div class="tn-tools" style="border-top:0;padding-top:0">' +
        '<span style="font-size:11px;opacity:.7">پس‌زمینه:</span>' + bgChips +
        '<button type="button" class="tn-btn" id="tn-add-cat">+ دسته</button>' +
        '<button type="button" class="tn-btn" id="tn-pin-set">' + (localStorage.getItem(PIN_KEY) ? 'تغییر/حذف رمز' : 'گذاشتن رمز') + '</button>' +
        '</div>'
      ) : '<div class="tn-empty">صفحه‌ای نیست. «+ صفحه» را بزن.</div>') +
      '</section></div>';

    // events
    root.querySelector('#tn-close').onclick = closeNotes;

    root.querySelector('#tn-new').onclick = function () {
      persistEditor();
      var now = Date.now();
      var p = {
        id: now, title: 'یادداشت جدید', body: '', color: 'default',
        categoryId: filterCat || 'daily', pinned: false, createdAt: now, updatedAt: now
      };
      data.pages.unshift(p);
      data.activeId = now;
      save(data);
      aiOpen = false;
      render();
    };

    root.querySelector('#tn-save').onclick = function () {
      persistEditor();
      save(data);
      var b = root.querySelector('#tn-save');
      if (b) { b.textContent = 'ذخیره شد'; setTimeout(function () { if (b) b.textContent = 'ذخیره'; }, 900); }
    };

    var searchEl = root.querySelector('#tn-search');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        searchQ = searchEl.value.trim();
        // soft re-list without full persist disruption
        persistEditor();
        render();
        var s2 = document.querySelector('#tn-search');
        if (s2) { s2.focus(); s2.selectionStart = s2.selectionEnd = s2.value.length; }
      });
    }

    var filterEl = root.querySelector('#tn-filter');
    if (filterEl) {
      filterEl.onchange = function () {
        filterCat = filterEl.value;
        persistEditor();
        render();
      };
    }

    root.querySelectorAll('.tn-page-item').forEach(function (btn) {
      btn.onclick = function () {
        persistEditor();
        data.activeId = Number(btn.getAttribute('data-id'));
        save(data);
        aiOpen = false;
        render();
      };
    });

    if (!page) return;

    root.querySelectorAll('[data-color]').forEach(function (chip) {
      chip.onclick = function () {
        persistEditor();
        page.color = chip.getAttribute('data-color');
        page.updatedAt = Date.now();
        save(data);
        render();
      };
    });

    root.querySelectorAll('[data-bg]').forEach(function (btn) {
      btn.onclick = function () {
        localStorage.setItem(BG_KEY, btn.getAttribute('data-bg'));
        persistEditor();
        render();
      };
    });

    var catEl = root.querySelector('#tn-cat');
    if (catEl) {
      catEl.onchange = function () {
        page.categoryId = catEl.value;
        page.updatedAt = Date.now();
        save(data);
      };
    }

    root.querySelector('#tn-pin').onclick = function () {
      persistEditor();
      page.pinned = !page.pinned;
      page.updatedAt = Date.now();
      save(data);
      render();
    };

    root.querySelector('#tn-copy').onclick = function () {
      persistEditor();
      var text = (page.title || '') + '\n\n' + (page.body || '');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          alert('متن صفحه کپی شد.');
        }).catch(function () {
          prompt('کپی کن:', text);
        });
      } else prompt('کپی کن:', text);
    };

    root.querySelector('#tn-ai').onclick = function () {
      persistEditor();
      aiOpen = !aiOpen;
      render();
    };

    root.querySelector('#tn-today').onclick = function () {
      persistEditor();
      var stamp = faDate(Date.now());
      var block = '\n\n—— ' + stamp + ' ——\n';
      page.body = (page.body || '') + block;
      page.updatedAt = Date.now();
      if (!page.title || page.title === 'یادداشت جدید') page.title = 'روند روز ' + todayISO();
      page.categoryId = 'daily';
      save(data);
      render();
      var body = document.getElementById('tn-body');
      if (body) { body.focus(); body.scrollTop = body.scrollHeight; }
    };

    root.querySelector('#tn-del').onclick = function () {
      if (data.pages.length <= 1) {
        alert('حداقل یک صفحه باید بماند.');
        return;
      }
      if (!confirm('این صفحه حذف شود؟')) return;
      data.pages = data.pages.filter(function (p) { return p.id !== page.id; });
      data.activeId = data.pages[0].id;
      save(data);
      aiOpen = false;
      render();
    };

    root.querySelector('#tn-add-cat').onclick = function () {
      var name = prompt('نام دسته جدید:');
      if (!name || !name.trim()) return;
      var id = 'c' + Date.now();
      data.categories.push({ id: id, name: name.trim(), icon: '🏷️' });
      save(data);
      render();
    };

    root.querySelector('#tn-pin-set').onclick = function () {
      var has = !!localStorage.getItem(PIN_KEY);
      if (has) {
        var cur = prompt('رمز فعلی را وارد کن (برای حذف یا تغییر):');
        if (hashPin(cur) !== localStorage.getItem(PIN_KEY)) {
          alert('رمز نادرست است.');
          return;
        }
        var next = prompt('رمز جدید (خالی = حذف قفل):');
        if (next === null) return;
        if (!String(next).trim()) {
          localStorage.removeItem(PIN_KEY);
          alert('قفل برداشته شد.');
        } else {
          localStorage.setItem(PIN_KEY, hashPin(String(next).trim()));
          alert('رمز به‌روز شد.');
        }
      } else {
        var n1 = prompt('رمز جدید (فقط عدد پیشنهاد می‌شود):');
        if (!n1 || !String(n1).trim()) return;
        var n2 = prompt('تکرار رمز:');
        if (n1 !== n2) {
          alert('رمزها یکسان نیستند.');
          return;
        }
        localStorage.setItem(PIN_KEY, hashPin(String(n1).trim()));
        alert('رمز ذخیره شد. از این به بعد برای ورود لازم است.');
      }
      render();
    };

    // autosave on blur
    var titleEl = root.querySelector('#tn-title');
    var bodyEl = root.querySelector('#tn-body');
    if (titleEl) titleEl.addEventListener('blur', function () { persistEditor(); save(data); });
    if (bodyEl) {
      bodyEl.addEventListener('blur', function () { persistEditor(); save(data); });
      var tmr;
      bodyEl.addEventListener('input', function () {
        clearTimeout(tmr);
        tmr = setTimeout(function () { persistEditor(); save(data); }, 600);
      });
    }
  }

  function persistEditor() {
    var page = activePage();
    if (!page) return;
    var titleEl = document.getElementById('tn-title');
    var bodyEl = document.getElementById('tn-body');
    var catEl = document.getElementById('tn-cat');
    if (titleEl) page.title = titleEl.value;
    if (bodyEl) page.body = bodyEl.value;
    if (catEl) page.categoryId = catEl.value;
    page.updatedAt = Date.now();
  }

  function openNotes() {
    unlocked = !localStorage.getItem(PIN_KEY);
    injectStyles();
    var root = ensureRoot();
    root.classList.add('open');
    root.style.display = 'flex';
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.zIndex = '120000';
    document.body.style.overflow = 'hidden';
    render();
  }

  function closeNotes() {
    persistEditor();
    save(data);
    var root = document.getElementById('tilo-notes-root');
    if (root) {
      root.classList.remove('open');
      root.style.display = 'none';
    }
    document.body.style.overflow = '';
    unlocked = !localStorage.getItem(PIN_KEY);
  }

  function injectMenuButton() {
    var navs = document.getElementById('tilo-drawer-navs');
    if (!navs || document.getElementById('tilo-notes-menu-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'tilo-notes-menu-btn';
    btn.className = 'w-full text-right px-3 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800/80 transition';
    btn.innerHTML = '<i class="fas fa-book me-1"></i> دفترچه یادداشت';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var backdrop = document.querySelector('.tilo-drawer-backdrop');
      var panel = document.querySelector('.tilo-drawer-panel');
      if (backdrop) backdrop.classList.remove('open');
      if (panel) panel.classList.remove('open');
      setTimeout(openNotes, 50);
    });
    navs.appendChild(btn);
  }

  // اگر منوی همبرگری بعداً ساخته شد، دکمه را اضافه کن
  var obs = setInterval(function () {
    injectMenuButton();
  }, 800);
  setTimeout(function () { injectMenuButton(); }, 1200);

  // میانبر اختیاری از کنسول / بیرون
  window.TiloNotes = { open: openNotes, close: closeNotes };

  // دکمه شناور کوچک (اگر منو دیر لود شد)
  setTimeout(function () {
    if (document.getElementById('tilo-notes-fab')) return;
    var fab = document.createElement('button');
    fab.id = 'tilo-notes-fab';
    fab.type = 'button';
    fab.title = 'دفترچه یادداشت';
    fab.textContent = '📓';
    fab.style.cssText = 'position:fixed;bottom:5.5rem;left:1rem;z-index:99990;width:2.85rem;height:2.85rem;border-radius:999px;border:1px solid rgba(148,163,184,.45);background:rgba(22,27,36,.96);font-size:1.15rem;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.4);pointer-events:auto';
    fab.onclick = openNotes;
    document.body.appendChild(fab);
  }, 2000);
})();
