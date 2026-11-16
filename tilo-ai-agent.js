/* tilo-ai-agent.js — دستیار چت tilo (vanilla JS، یک تگ script کافی است)
   <script src="./tilo-ai-agent.js"></script> */
(function () {
  'use strict';
  if (window.__tiloAiAgent) return;
  window.__tiloAiAgent = true;

  /* ---------- ثابت‌ها ---------- */
  var K = {
    keys: 'tilo_ai_keys', cfg: 'tilo_ai_cfg', hist: 'tilo_ai_history', mem: 'tilo_ai_memory',
    practice: 'tilo_ai_practice', planner: 'tilo_martell_planner', backup: 'tilo_martell_planner_ai_backup'
  };
  var PROVIDERS = {
    gemini: { name: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'] },
    openrouter: { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1/chat/completions',
      models: ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'] },
    groq: { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
    xai: { name: 'xAI (Grok)', url: 'https://api.x.ai/v1/chat/completions', models: ['grok-3-mini', 'grok-3'] }
  };

  /* ---------- ذخیره‌سازی ---------- */
  function jget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) {
    if (k === K.planner) return false; // کلید تقویم فقط از writePlanner نوشته می‌شود
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  var keys = jget(K.keys, []);
  var cfg = jget(K.cfg, null) || { provider: 'gemini', model: {}, custom: {} };
  var hist = jget(K.hist, []);
  function practice() { return localStorage.getItem(K.practice) !== '0'; } // پیش‌فرض: روشن (امن)
  function saveHist() { hist = hist.slice(-40); jset(K.hist, hist); }

  /* ---------- تقویم (تنها نقطه‌ی نوشتن tilo_martell_planner) ---------- */
  function writePlanner(raw) {
    if (practice()) return false;
    try { localStorage.setItem(K.planner, raw); return true; } catch (e) { return false; }
  }
  function blocksOf(o) { return Array.isArray(o) ? o : (o && Array.isArray(o.blocks) ? o.blocks : null); }
  function lastJson(text) {
    var re = /```(?:json)?\s*([\s\S]*?)```/gi, m, out = null;
    while ((m = re.exec(text))) { try { out = JSON.parse(m[1]); } catch (e) {} }
    return out;
  }
  function stripFences(t) { return t.replace(/```[\s\S]*?```/g, '').trim(); }
  function applyPlanner(text) {
    var nxt = lastJson(text);
    if (!nxt) return null;
    var raw = localStorage.getItem(K.planner), cur;
    if (!raw) return { ok: false, msg: 'برنامه‌ای برای تغییر پیدا نشد.' };
    try { cur = JSON.parse(raw); } catch (e) { return { ok: false, msg: 'برنامه‌ی فعلی قابل خواندن نیست؛ چیزی تغییر نکرد.' }; }
    if (practice()) return { ok: false, msg: 'حالت تمرین روشن است؛ چیزی ذخیره نشد.' };
    var nb = blocksOf(nxt);
    if (!nb || !nb.length) return { ok: false, msg: 'blocks خالی شد؛ برای امنیت ذخیره نشد.' };
    if (Array.isArray(cur) !== Array.isArray(nxt)) return { ok: false, msg: 'ساختار برنامه‌ی جدید با قبلی فرق داشت؛ ذخیره نشد.' };
    try { localStorage.setItem(K.backup, raw); } catch (e) { return { ok: false, msg: 'بکاپ گرفته نشد؛ تغییری ذخیره نشد.' }; }
    if (!writePlanner(JSON.stringify(nxt))) return { ok: false, msg: 'ذخیره ناموفق بود.' };
    return { ok: true, msg: 'تقویم به‌روز شد (نسخه‌ی قبلی بکاپ شد).' };
  }
  function restoreBackup() {
    if (practice()) return 'حالت تمرین روشن است؛ بازگردانی انجام نشد.';
    var b = localStorage.getItem(K.backup);
    if (!b) return 'بکاپی وجود ندارد.';
    return writePlanner(b) ? 'تقویم به نسخه‌ی قبل برگشت. صفحه را رفرش کن.' : 'بازگردانی ناموفق بود.';
  }

  /* ---------- متن فارسی ---------- */
  function norm(t) { return String(t).replace(/\u200c/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک'); }
  var VERB = /(تغییر|عوض|جابه ?جا|جابجا|منتقل|اضافه|حذف|پاک|ویرایش|بذار|بگذار|ثبت کن|کم کن|زیاد کن|جایگزین|ست کن)/;
  var OBJ = /(برنامه|تقویم|بلاک|پلنر|ساعت|جلسه|کلاس|شنبه|یکشنبه|دوشنبه|سه ?شنبه|چهارشنبه|پنج ?شنبه|جمعه|امروز|فردا)/;
  function looksLikeEdit(t) { t = norm(t); return VERB.test(t) && OBJ.test(t); }

  /* ---------- تماس با مدل‌ها ---------- */
  function getModel() {
    var m = cfg.model[cfg.provider] || PROVIDERS[cfg.provider].models[0];
    return m === '__custom' ? (cfg.custom[cfg.provider] || '').trim() : m;
  }
  async function http(url, headers, body) {
    var ac = new AbortController(), to = setTimeout(function () { ac.abort(); }, 60000), r;
    try {
      r = await fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body), signal: ac.signal });
    } catch (e) { clearTimeout(to); throw { net: true, timeout: !!(e && e.name === 'AbortError') }; }
    clearTimeout(to);
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      var m = j && ((j.error && (j.error.message || j.error)) || j.message);
      throw { status: r.status, msg: typeof m === 'string' ? m : '' };
    }
    return j || {};
  }
  function one(prov, key, model, msgs, sys) {
    if (prov === 'gemini') {
      return http('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
        { 'x-goog-api-key': key },
        { systemInstruction: { parts: [{ text: sys }] },
          contents: msgs.map(function (m) { return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }; }) })
        .then(function (j) {
          var p = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
          var t = p ? p.map(function (x) { return x.text || ''; }).join('') : '';
          if (!t) throw { status: 0, msg: 'پاسخ خالی بود (شاید فیلتر ایمنی مدل فعال شد).' };
          return t;
        });
    }
    var h = { Authorization: 'Bearer ' + key };
    if (prov === 'openrouter') h['X-Title'] = 'tilo';
    return http(PROVIDERS[prov].url, h, { model: model, messages: [{ role: 'system', content: sys }].concat(msgs) })
      .then(function (j) {
        var t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (!t) throw { status: 0, msg: 'پاسخ خالی بود.' };
        return t;
      });
  }
  async function callModel(msgs, sys) {
    var prov = cfg.provider, ks = keys.filter(function (k) { return k.provider === prov; });
    if (!ks.length) throw { nokey: true };
    var model = getModel(), last;
    if (!model) throw { status: 0, msg: 'نام مدل دلخواه را وارد کن.' };
    for (var i = 0; i < ks.length; i++) {
      try { return await one(prov, ks[i].key, model, msgs, sys); }
      catch (e) { last = e; if (e.net || !(e.status === 401 || e.status === 403 || e.status === 429)) throw e; }
    }
    throw last;
  }
  function friendly(e) {
    if (e.nokey) return 'هنوز کلید API نداری. از ⚙ تنظیمات یک کلید برای «' + PROVIDERS[cfg.provider].name + '» اضافه کن.';
    if (e.net) {
      if (navigator.onLine === false) return 'دستگاه آفلاین است. اینترنت را وصل کن و دوباره تلاش کن.';
      if (e.timeout) return 'پاسخی نرسید (زمان انتظار تمام شد). احتمالاً فیلتر یا قطعی اینترنت است؛ با VPN امتحان کن.';
      return 'اتصال به سرویس برقرار نشد. ممکن است اینترنت قطع باشد، سرویس فیلتر شده باشد (VPN روشن کن) یا مرورگر آفلاین باشد.';
    }
    var s = e.status, d = e.msg ? '\n' + e.msg : '';
    if (s === 401 || s === 403) return 'کلید API نامعتبر است یا به این مدل دسترسی ندارد.' + d;
    if (s === 429) return 'سهمیه یا سقف درخواست کلید(ها) تمام شده؛ کمی بعد دوباره امتحان کن یا کلید دیگری اضافه کن.' + d;
    if (s === 404) return 'مدل پیدا نشد؛ نام مدل را بررسی کن.' + d;
    if (s === 400) return 'درخواست پذیرفته نشد.' + d;
    if (s >= 500) return 'سرویس موقتاً در دسترس نیست؛ بعداً دوباره تلاش کن.' + d;
    return (e.msg || 'خطای ناشناخته.');
  }

  /* ---------- پرامپت ---------- */
  function baseSys() {
    var mem = (localStorage.getItem(K.mem) || '').trim();
    return 'تو «دستیار tilo» هستی، همراه مطالعه‌ی دانش‌آموزان کنکور. فارسی، کوتاه، دقیق و کاربردی جواب بده.' +
      (mem ? '\n\nحافظه‌ی مشترک کاربر:\n' + mem : '');
  }

  /* ---------- رابط ---------- */
  var CSS = '' +
    '#tai-fab{position:fixed;left:1rem;bottom:calc(6rem + env(safe-area-inset-bottom));z-index:99970;width:3.2rem;height:3.2rem;border-radius:50%;border:1px solid #2d5a47;background:#0e1613;color:#6ee7b7;font-size:1.3rem;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45)}' +
    '#tai-drawer{position:fixed;top:0;right:0;bottom:0;width:min(400px,92vw);z-index:99985;background:#0e1613;color:#e6f4ee;border-left:1px solid #2d5a47;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .28s cubic-bezier(.16,1,.3,1);font-family:Vazirmatn,system-ui,sans-serif;font-size:14px;direction:rtl}' +
    '#tai-drawer.open{transform:none}#tai-drawer *{box-sizing:border-box}' +
    '#tai-tab{position:absolute;right:100%;top:50%;margin-top:-32px;width:28px;height:64px;border:1px solid #2d5a47;border-right:0;border-radius:12px 0 0 12px;background:#0e1613;color:#6ee7b7;font-size:1.2rem;cursor:pointer}' +
    '#tai-drawer header{display:flex;align-items:center;gap:.4rem;padding:.7rem .8rem;border-bottom:1px solid #1d3a2e}' +
    '#tai-drawer header b{flex:1;color:#6ee7b7}' +
    '#tai-drawer button{font-family:inherit}' +
    '.tai-ic{width:2rem;height:2rem;border-radius:.6rem;border:1px solid #2d5a47;background:#121d18;color:#6ee7b7;cursor:pointer}' +
    '.tai-chip{padding:.25rem .6rem;border-radius:999px;border:1px solid #2d5a47;background:#121d18;color:#8fb5a5;font-size:.75rem;cursor:pointer}' +
    '.tai-chip.on{background:#2d5a47;color:#e6f4ee}' +
    '#tai-bar{display:flex;gap:.4rem;padding:.5rem .8rem;border-bottom:1px solid #1d3a2e}' +
    '#tai-drawer select,#tai-drawer input,#tai-drawer textarea{background:#121d18;color:#e6f4ee;border:1px solid #2d5a47;border-radius:.6rem;padding:.45rem .6rem;font-family:inherit;font-size:.85rem;min-width:0}' +
    '#tai-drawer select.ltr,#tai-drawer input.ltr{direction:ltr;text-align:left}' +
    '#tai-bar select{flex:1}' +
    '#tai-settings{padding:.7rem .8rem;border-bottom:1px solid #1d3a2e;max-height:55vh;overflow:auto;display:flex;flex-direction:column;gap:.5rem}' +
    '#tai-settings[hidden]{display:none}' +
    '#tai-settings h4{margin:.3rem 0 0;color:#6ee7b7;font-size:.85rem}' +
    '#tai-settings small{color:#8fb5a5;line-height:1.6}' +
    '.tai-row{display:flex;gap:.4rem}.tai-row>*{flex:1}.tai-row>button{flex:0 0 auto}' +
    '.tai-btn{padding:.45rem .8rem;border-radius:.6rem;border:1px solid #2d5a47;background:#2d5a47;color:#e6f4ee;cursor:pointer;font-size:.85rem}' +
    '.tai-btn.ghost{background:transparent;color:#6ee7b7}' +
    '.tai-key{display:flex;align-items:center;gap:.5rem;padding:.4rem .6rem;border:1px solid #1d3a2e;border-radius:.6rem;font-size:.8rem}' +
    '.tai-key span{flex:1;direction:ltr;text-align:left;overflow:hidden;text-overflow:ellipsis}' +
    '#tai-msgs{flex:1;overflow-y:auto;padding:.8rem;display:flex;flex-direction:column;gap:.55rem}' +
    '.tai-m{max-width:88%;padding:.55rem .8rem;border-radius:1rem;line-height:1.75;white-space:pre-wrap;word-break:break-word}' +
    '.tai-u{align-self:flex-start;background:#1d3a2e;border-bottom-right-radius:.3rem}' +
    '.tai-a{align-self:flex-end;background:#142620;border:1px solid #1d3a2e;border-bottom-left-radius:.3rem}' +
    '.tai-m .tai-btn{margin-top:.5rem;display:block}' +
    '#tai-form{display:flex;gap:.4rem;align-items:flex-end;padding:.6rem .8rem calc(.6rem + env(safe-area-inset-bottom));border-top:1px solid #1d3a2e}' +
    '#tai-in{flex:1;resize:none;max-height:8rem;line-height:1.6}' +
    '.tai-inject{margin:.4rem;padding:.45rem .9rem;border-radius:.7rem;border:1px solid #2d5a47;background:#0e1613;color:#6ee7b7;cursor:pointer;font-family:inherit}' +
    '@media (prefers-reduced-motion:reduce){#tai-drawer{transition:none}}';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function init() {
    var st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    var root = el('div');
    root.innerHTML =
      '<button id="tai-fab" type="button" title="دستیار هوشمند" aria-label="دستیار هوشمند">✦</button>' +
      '<aside id="tai-drawer" dir="rtl" aria-label="دستیار tilo">' +
        '<button id="tai-tab" type="button" aria-label="باز و بسته کردن">«</button>' +
        '<header><b>دستیار tilo</b><button id="tai-practice" type="button" class="tai-chip"></button>' +
          '<button id="tai-gear" type="button" class="tai-ic" title="تنظیمات">⚙</button>' +
          '<button id="tai-close" type="button" class="tai-ic" title="بستن">×</button></header>' +
        '<div id="tai-bar"><select id="tai-prov" aria-label="ارائه‌دهنده"></select><select id="tai-model" class="ltr" aria-label="مدل"></select></div>' +
        '<section id="tai-settings" hidden>' +
          '<input id="tai-custom" class="ltr" placeholder="نام مدل دلخواه (مثلاً gemini-2.5-flash)" hidden>' +
          '<h4>کلیدهای API</h4><small>کلیدها فقط در مرورگر خودت ذخیره می‌شوند. اگر یک کلید خطا بدهد، کلید بعدیِ همین ارائه‌دهنده امتحان می‌شود.</small>' +
          '<div class="tai-row"><input id="tai-klabel" placeholder="نام (اختیاری)"><input id="tai-kval" class="ltr" type="password" placeholder="کلید API" autocomplete="off"><button id="tai-kadd" type="button" class="tai-btn">افزودن</button></div>' +
          '<div id="tai-keys"></div>' +
          '<h4>حافظه‌ی مشترک (برای همه‌ی مدل‌ها)</h4>' +
          '<textarea id="tai-mem" rows="4" placeholder="هر خط یک نکته؛ مثلاً: رشته‌ام ریاضی است"></textarea>' +
          '<small>در چت بنویس «یادت باشه: …» تا خودکار اضافه شود.</small>' +
          '<div class="tai-row"><button id="tai-clear" type="button" class="tai-btn ghost">پاک کردن گفتگو</button><button id="tai-restore" type="button" class="tai-btn ghost">بازگردانی تقویم</button></div>' +
        '</section>' +
        '<div id="tai-msgs"></div>' +
        '<form id="tai-form"><textarea id="tai-in" rows="1" placeholder="پیام بنویس…"></textarea><button id="tai-send" type="submit" class="tai-btn">ارسال</button></form>' +
      '</aside>';
    while (root.firstChild) document.body.appendChild(root.firstChild);

    var drawer = $('tai-drawer'), msgs = $('tai-msgs'), ta = $('tai-in'), busy = false;

    function setOpen(o) { drawer.classList.toggle('open', o); $('tai-tab').textContent = o ? '»' : '«'; if (o) ta.focus(); }
    function toggle() { setOpen(!drawer.classList.contains('open')); }
    $('tai-fab').onclick = toggle; $('tai-tab').onclick = toggle; $('tai-close').onclick = function () { setOpen(false); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    $('tai-gear').onclick = function () { var s = $('tai-settings'); s.hidden = !s.hidden; };

    function addMsg(role, text) {
      var m = el('div', 'tai-m ' + (role === 'user' ? 'tai-u' : 'tai-a'), text);
      msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight; return m;
    }

    /* تمرین */
    function paintPractice() {
      var b = $('tai-practice'), on = practice();
      b.textContent = on ? 'تمرین: روشن' : 'تمرین: خاموش'; b.classList.toggle('on', on);
      b.title = on ? 'تقویم هرگز تغییر نمی‌کند' : 'دستیار می‌تواند تقویم را تغییر دهد';
    }
    $('tai-practice').onclick = function () { localStorage.setItem(K.practice, practice() ? '0' : '1'); paintPractice(); };
    paintPractice();

    /* ارائه‌دهنده و مدل */
    var prov = $('tai-prov'), mod = $('tai-model'), cust = $('tai-custom');
    Object.keys(PROVIDERS).forEach(function (p) { var o = el('option', '', PROVIDERS[p].name); o.value = p; prov.appendChild(o); });
    function paintModels() {
      mod.innerHTML = '';
      PROVIDERS[cfg.provider].models.concat(['__custom']).forEach(function (m) {
        var o = el('option', '', m === '__custom' ? 'مدل دلخواه…' : m); o.value = m; mod.appendChild(o);
      });
      mod.value = cfg.model[cfg.provider] || PROVIDERS[cfg.provider].models[0];
      cust.hidden = mod.value !== '__custom'; cust.value = cfg.custom[cfg.provider] || '';
      renderKeys();
    }
    prov.value = cfg.provider;
    prov.onchange = function () { cfg.provider = prov.value; jset(K.cfg, cfg); paintModels(); };
    mod.onchange = function () { cfg.model[cfg.provider] = mod.value; jset(K.cfg, cfg); cust.hidden = mod.value !== '__custom'; };
    cust.oninput = function () { cfg.custom[cfg.provider] = cust.value; jset(K.cfg, cfg); };

    /* کلیدها */
    function renderKeys() {
      var box = $('tai-keys'); box.innerHTML = '';
      var ks = keys.filter(function (k) { return k.provider === cfg.provider; });
      if (!ks.length) box.appendChild(el('small', '', 'برای «' + PROVIDERS[cfg.provider].name + '» کلیدی ثبت نشده.'));
      ks.forEach(function (k) {
        var row = el('div', 'tai-key');
        row.appendChild(el('span', '', (k.label ? k.label + ' · ' : '') + '••••' + k.key.slice(-4)));
        var d = el('button', 'tai-btn ghost', 'حذف'); d.type = 'button';
        d.onclick = function () { keys = keys.filter(function (x) { return x.id !== k.id; }); jset(K.keys, keys); renderKeys(); };
        row.appendChild(d); box.appendChild(row);
      });
    }
    $('tai-kadd').onclick = function () {
      var v = $('tai-kval').value.trim();
      if (!v) return;
      if (keys.some(function (k) { return k.provider === cfg.provider && k.key === v; })) { $('tai-kval').value = ''; return; }
      keys.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), provider: cfg.provider, label: $('tai-klabel').value.trim(), key: v });
      jset(K.keys, keys); $('tai-kval').value = ''; $('tai-klabel').value = ''; renderKeys();
    };

    /* حافظه و ابزارها */
    var mem = $('tai-mem'); mem.value = localStorage.getItem(K.mem) || '';
    mem.oninput = function () { try { localStorage.setItem(K.mem, mem.value); } catch (e) {} };
    $('tai-clear').onclick = function () { if (!confirm('گفتگو پاک شود؟ (حافظه‌ی مشترک می‌ماند)')) return; hist = []; saveHist(); msgs.innerHTML = ''; welcome(); };
    $('tai-restore').onclick = function () { addMsg('assistant', restoreBackup()); setOpen(true); $('tai-settings').hidden = true; };

    function welcome() { addMsg('assistant', 'سلام! من دستیار tilo هستم. سؤال درسی، برنامه‌ریزی یا مرور هر چیزی داری بپرس.'); }
    if (hist.length) hist.slice(-20).forEach(function (h) { addMsg(h.role, h.content); }); else welcome();
    paintModels();

    /* ارسال */
    function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'; }
    ta.oninput = grow;
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('tai-form').requestSubmit(); } };
    $('tai-form').onsubmit = async function (ev) {
      ev.preventDefault();
      if (busy) return;
      var t = ta.value.trim(); if (!t) return;
      ta.value = ''; grow(); addMsg('user', t);

      var note = /^(یادت باشه|به خاطر بسپار|یادداشت کن)[:：،,\s]+([\s\S]+)/.exec(norm(t));
      if (note) {
        mem.value = (mem.value ? mem.value.replace(/\s+$/, '') + '\n' : '') + note[2].trim();
        mem.oninput(); addMsg('assistant', 'در حافظه‌ی مشترک ذخیره شد ✓'); return;
      }

      busy = true;
      var wait = addMsg('assistant', 'در حال پردازش…');
      try {
        var edit = looksLikeEdit(t), pr = practice(), raw = localStorage.getItem(K.planner);
        var sys = baseSys(), canEdit = edit && !pr && !!raw && raw.length < 60000;
        if (edit && pr) sys += '\n\nحالت تمرین روشن است و هیچ تغییری ذخیره نمی‌شود؛ فقط توضیح بده چه تغییری پیشنهاد می‌کنی و هیچ بلوک JSON نفرست.';
        if (canEdit) sys += '\n\nبرنامه‌ی فعلی کاربر (JSON):\n' + raw +
          '\n\nاگر کاربر تغییر برنامه خواست: اول یک جمله توضیح بده، سپس کل برنامه‌ی به‌روز را دقیقاً با همان ساختار و کلیدها داخل یک بلوک ```json بگذار. چیزی را بی‌دلیل حذف نکن و آرایه‌ی blocks هرگز خالی نشود. اگر درخواست تغییر برنامه نبود فقط متن جواب بده و JSON نفرست.';
        hist.push({ role: 'user', content: t });
        var out = await callModel(hist.slice(-20), sys), shown = out, res = null;
        if (canEdit) { res = applyPlanner(out); if (res) shown = stripFences(out) || 'انجام شد.'; }
        hist.push({ role: 'assistant', content: stripFences(out) || out }); saveHist();
        wait.textContent = shown;
        if (res) {
          wait.appendChild(document.createTextNode('\n' + (res.ok ? '✓ ' : '⚠ ') + res.msg));
          if (res.ok) { var rb = el('button', 'tai-btn', 'رفرش برای دیدن تقویم جدید'); rb.type = 'button'; rb.onclick = function () { location.reload(); }; wait.appendChild(rb); }
        }
      } catch (e) {
        hist.pop();
        wait.textContent = friendly(e || {});
      }
      busy = false; msgs.scrollTop = msgs.scrollHeight;
    };

    /* دکمه‌ی داخل #tilo-martell */
    function inject() {
      var h = $('tilo-martell');
      if (!h || h.querySelector('.tai-inject')) return;
      var b = el('button', 'tai-inject', '✦ دستیار هوشمند'); b.type = 'button'; b.onclick = function () { setOpen(true); };
      h.appendChild(b);
    }
    inject(); setInterval(inject, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
