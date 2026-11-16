/**
 * tilo-ai-agent.js — نسخه نهایی ترکیبی (Claude UX امن + Gemini UI)
 * رفع: URL جمینای، مدل‌های به‌روز، تمرین پیش‌فرض روشن، merge بلاک‌ها، دکمه martell
 *
 * <script src="./tilo-ai-agent.js?v=10"></script>
 */
(function () {
  'use strict';
  if (window.__TILO_AI_FINAL__) return;
  window.__TILO_AI_FINAL__ = true;

  var SK = {
    keys: 'tilo_ai_api_keys',
    active: 'tilo_ai_active_key_id',
    model: 'tilo_ai_selected_model',
    custom: 'tilo_ai_custom_model',
    practice: 'tilo_ai_practice_mode',
    chat: 'tilo_ai_chat_history',
    memory: 'tilo_ai_shared_memory',
    planner: 'tilo_martell_planner',
    backup: 'tilo_martell_planner_ai_backup'
  };

  var PROVIDERS = {
    gemini: {
      id: 'gemini',
      name: 'Google Gemini',
      models: [
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-flash-latest',
        'gemini-2.5-flash'
      ]
    },
    openrouter: {
      id: 'openrouter',
      name: 'OpenRouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      models: [
        'google/gemma-4-31b-it:free',
        'nvidia/nemotron-3.5-lightning:free',
        'openrouter/free',
        'google/gemini-2.5-flash'
      ]
    },
    groq: {
      id: 'groq',
      name: 'Groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
    },
    xai: {
      id: 'xai',
      name: 'xAI (Grok)',
      endpoint: 'https://api.x.ai/v1/chat/completions',
      models: ['grok-4.3', 'grok-4-fast', 'grok-3-mini', 'grok-3']
    }
  };

  function jget(k, fb) {
    try {
      var r = localStorage.getItem(k);
      if (r == null) return fb;
      return JSON.parse(r);
    } catch (e) {
      return fb;
    }
  }
  function jset(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      return false;
    }
  }
  function sget(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function sset(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }

  /* تمرین: پیش‌فرض روشن اگر هرگز ست نشده */
  function isPractice() {
    var v = sget(SK.practice);
    if (v === null) return true;
    return v === 'true' || v === '1';
  }
  function setPractice(on) {
    sset(SK.practice, on ? 'true' : 'false');
  }

  var state = {
    open: false,
    tab: 'chat',
    loading: false,
    keys: [],
    activeKeyId: '',
    selectedModel: 'gemini:gemini-3.5-flash-lite',
    customModel: '',
    chat: [],
    memory: []
  };

  function load() {
    var keys = jget(SK.keys, []);
    state.keys = Array.isArray(keys) ? keys : [];
    state.activeKeyId = sget(SK.active) || (state.keys[0] && state.keys[0].id) || '';
    state.selectedModel = sget(SK.model) || 'gemini:gemini-3.5-flash-lite';
    state.customModel = sget(SK.custom) || '';
    var chat = jget(SK.chat, []);
    state.chat = Array.isArray(chat) ? chat.slice(-60) : [];
    var mem = jget(SK.memory, []);
    state.memory = Array.isArray(mem) ? mem : [];
  }

  function saveKeys() {
    jset(SK.keys, state.keys);
    sset(SK.active, state.activeKeyId || '');
  }
  function saveChat() {
    jset(SK.chat, state.chat.slice(-60));
  }
  function saveMem() {
    jset(SK.memory, state.memory.slice(-50));
  }

  function parseModel() {
    var raw = state.selectedModel || 'gemini:gemini-3.5-flash-lite';
    var i = raw.indexOf(':');
    var provider = i === -1 ? 'gemini' : raw.slice(0, i);
    var model = i === -1 ? raw : raw.slice(i + 1);
    if (model === '__custom__') {
      model = (state.customModel || '').trim() || (PROVIDERS[provider] && PROVIDERS[provider].models[0]) || 'gemini-3.5-flash-lite';
    }
    return { provider: provider, model: model };
  }

  function keyFor(provider) {
    var active = state.keys.find(function (k) {
      return k.id === state.activeKeyId && k.provider === provider;
    });
    if (active && active.key) return active;
    return (
      state.keys.find(function (k) {
        return k.provider === provider && k.key;
      }) || null
    );
  }

  function keysFor(provider) {
    return state.keys.filter(function (k) {
      return k.provider === provider && k.key;
    });
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmt(text) {
    var safe = esc(text);
    safe = safe.replace(/```[\s\S]*?```/g, function (m) {
      var inner = m.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
      return '<pre class="tai-code" dir="ltr">' + inner + '</pre>';
    });
    safe = safe.replace(/`([^`\n]+)`/g, '<code dir="ltr">$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }

  function looksEdit(t) {
    t = String(t || '')
      .replace(/\u200c/g, ' ')
      .toLowerCase();
    var domain =
      /برنامه|تقویم|پارت|بلوک|بلاک|ساعت|تایم|زمان|شنبه|یکشنبه|دوشنبه|سه‌?شنبه|چهارشنبه|پنج‌?شنبه|جمعه|امروز|فردا|هفته|مارتل|planner|block/;
    var action =
      /تغییر|عوض|اصلاح|ویرایش|اضافه|بذار|بگذار|حذف|پاک|جابجا|جا به جا|منتقل|تنظیم|بچین|آپدیت|به‌?روزرسانی|کم کن|زیاد کن|ثبت|جایگزین/;
    return domain.test(t) && action.test(t);
  }

  function plannerSnap() {
    try {
      var raw = sget(SK.planner);
      if (!raw) return { raw: null, parsed: null };
      return { raw: raw, parsed: JSON.parse(raw) };
    } catch (e) {
      return { raw: sget(SK.planner), parsed: null };
    }
  }

  function writePlanner(candidate) {
    if (isPractice()) return { ok: false, reason: 'practice' };
    var cur = plannerSnap();
    var next = null;
    if (Array.isArray(candidate)) {
      if (cur.parsed && typeof cur.parsed === 'object' && !Array.isArray(cur.parsed)) {
        next = Object.assign({}, cur.parsed, { blocks: candidate });
      } else {
        next = { version: 1, blocks: candidate, trash: [], finalized: {} };
      }
    } else if (candidate && typeof candidate === 'object') {
      if (cur.parsed && typeof cur.parsed === 'object' && !Array.isArray(cur.parsed)) {
        next = Object.assign({}, cur.parsed, candidate);
      } else {
        next = candidate;
      }
    }
    if (!next || !Array.isArray(next.blocks) || next.blocks.length === 0) {
      return { ok: false, reason: 'empty' };
    }
    if (!next.trash) next.trash = [];
    if (!next.finalized) next.finalized = {};
    if (next.version == null) next.version = 1;
    next.updatedAt = new Date().toISOString();

    try {
      if (cur.raw) sset(SK.backup, cur.raw);
      var ser = JSON.stringify(next);
      localStorage.setItem(SK.planner, ser);
      try {
        window.dispatchEvent(new CustomEvent('tilo:planner-updated', { detail: next }));
      } catch (e) {}
      return { ok: true, count: next.blocks.length };
    } catch (e) {
      return { ok: false, reason: 'storage' };
    }
  }

  function restoreBackup() {
    if (isPractice()) return 'حالت تمرین روشن است؛ بازگردانی انجام نشد.';
    var b = sget(SK.backup);
    if (!b) return 'بکاپی وجود ندارد.';
    try {
      localStorage.setItem(SK.planner, b);
      return 'تقویم بازگردانی شد. صفحه را رفرش کن.';
    } catch (e) {
      return 'بازگردانی ناموفق بود.';
    }
  }

  function systemPrompt() {
    var now = '';
    try {
      now = new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date());
    } catch (e) {}
    var snap = plannerSnap();
    var mem =
      state.memory.length > 0
        ? state.memory
            .map(function (m, i) {
              return i + 1 + '. ' + m.text;
            })
            .join('\n')
        : 'خالی';
    return [
      'تو دستیار tilo هستی. فارسی، کوتاه و کاربردی جواب بده.',
      'زمان تهران: ' + now,
      'حالت تمرین: ' + (isPractice() ? 'روشن (تقویم را تغییر نده و تگ PLANNER_JSON نگذار)' : 'خاموش'),
      '',
      'حافظه مشترک کاربر:',
      mem,
      '',
      'تقویم فعلی (JSON):',
      snap.raw || '{"version":1,"blocks":[],"trash":[],"finalized":{}}',
      '',
      'قوانین:',
      '1) نکته ماندگار کاربر را با تگ <MEMORY_ADD>...</MEMORY_ADD> بفرست.',
      '2) فقط اگر تمرین خاموش است و کاربر صریحاً تغییر تقویم خواست، کل JSON معتبر را در <PLANNER_JSON>...</PLANNER_JSON> بگذار. blocks هرگز خالی نباشد و فیلدهای قبلی حفظ شوند.',
      '3) در چت عادی تگ PLANNER_JSON نگذار.'
    ].join('\n');
  }

  function extract(raw) {
    var cleaned = String(raw || '');
    var memories = [];
    var planner = null;
    cleaned = cleaned.replace(/<MEMORY_ADD>([\s\S]*?)<\/MEMORY_ADD>/gi, function (_, t) {
      t = String(t || '').trim();
      if (t) memories.push(t);
      return '';
    });
    cleaned = cleaned.replace(/<PLANNER_JSON>([\s\S]*?)<\/PLANNER_JSON>/gi, function (_, j) {
      j = String(j || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```$/, '')
        .trim();
      try {
        planner = JSON.parse(j);
      } catch (e) {
        planner = null;
      }
      return '';
    });
    /* fallback: بلوک ```json */
    if (!planner) {
      var m = /```json\s*([\s\S]*?)```/i.exec(String(raw || ''));
      if (m) {
        try {
          planner = JSON.parse(m[1]);
        } catch (e) {}
      }
    }
    return { text: cleaned.trim(), memories: memories, planner: planner };
  }

  async function http(url, headers, body) {
    var ac = new AbortController();
    var to = setTimeout(function () {
      ac.abort();
    }, 60000);
    try {
      var r = await fetch(url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
        body: JSON.stringify(body),
        signal: ac.signal
      });
      var j = null;
      try {
        j = await r.json();
      } catch (e) {}
      if (!r.ok) {
        var msg = (j && j.error && (j.error.message || j.error)) || (j && j.message) || '';
        throw { status: r.status, msg: typeof msg === 'string' ? msg : '', net: false };
      }
      return j || {};
    } catch (e) {
      if (e && e.status != null) throw e;
      throw { net: true, timeout: !!(e && e.name === 'AbortError'), msg: (e && e.message) || '' };
    } finally {
      clearTimeout(to);
    }
  }

  async function callGemini(apiKey, model, sys, history, userText) {
    /* URL صحیح — بدون Markdown */
    var url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) +
      ':generateContent?key=' +
      encodeURIComponent(apiKey);

    var contents = [];
    history.slice(-12).forEach(function (m) {
      if (!m || !m.content || m.role === 'error') return;
      var role = m.role === 'assistant' ? 'model' : 'user';
      if (contents.length && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + m.content;
      } else {
        contents.push({ role: role, parts: [{ text: m.content }] });
      }
    });
    contents.push({ role: 'user', parts: [{ text: userText }] });
    if (contents[0] && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: 'ادامه بده' }] });
    }

    var j = await http(url, {}, {
      systemInstruction: { parts: [{ text: sys }] },
      contents: contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 8192 }
    });
    var parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    var t = Array.isArray(parts)
      ? parts
          .map(function (p) {
            return p.text || '';
          })
          .join('')
      : '';
    if (!t.trim()) throw { status: 0, msg: 'پاسخ خالی از Gemini' };
    return t;
  }

  async function callOpenAI(prov, apiKey, model, sys, history, userText) {
    var messages = [{ role: 'system', content: sys }];
    history.slice(-12).forEach(function (m) {
      if (!m || !m.content || m.role === 'error') return;
      messages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      });
    });
    messages.push({ role: 'user', content: userText });

    var headers = { Authorization: 'Bearer ' + apiKey };
    if (prov.id === 'openrouter') {
      headers['HTTP-Referer'] = location.origin || 'https://benyamin-design.github.io';
      headers['X-Title'] = 'tilo';
    }
    var j = await http(prov.endpoint, headers, {
      model: model,
      messages: messages,
      temperature: 0.5
    });
    var t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!t || !String(t).trim()) throw { status: 0, msg: 'پاسخ خالی' };
    return t;
  }

  async function callWithKeyFallback(provider, model, sys, history, userText) {
    var list = keysFor(provider);
    if (!list.length) throw { nokey: true, provider: provider };
    var last;
    for (var i = 0; i < list.length; i++) {
      try {
        if (provider === 'gemini') return await callGemini(list[i].key, model, sys, history, userText);
        return await callOpenAI(PROVIDERS[provider], list[i].key, model, sys, history, userText);
      } catch (e) {
        last = e;
        if (e.net) throw e;
        if (!(e.status === 401 || e.status === 403 || e.status === 429)) throw e;
      }
    }
    throw last || { msg: 'همه کلیدها ناموفق بودند' };
  }

  function friendly(e) {
    if (!e) return 'خطای ناشناخته';
    if (e.nokey) return 'کلید API برای این ارائه‌دهنده ثبت نشده. از تب «کلیدها» اضافه کن.';
    if (e.net) {
      if (navigator.onLine === false) return 'دستگاه آفلاین است.';
      if (e.timeout) return 'زمان انتظار تمام شد. VPN/اینترنت را چک کن.';
      return 'اتصال برقرار نشد (Failed to fetch). معمولاً فیلتر Gemini یا قطعی اینترنت است — VPN بزن یا OpenRouter/Groq را امتحان کن.';
    }
    var s = e.status;
    var d = e.msg ? '\n' + e.msg : '';
    if (s === 401 || s === 403) return 'کلید نامعتبر یا بدون دسترسی.' + d;
    if (s === 429) return 'سقف درخواست پر شده.' + d;
    if (s === 404) return 'مدل پیدا نشد؛ مدل دیگری انتخاب کن.' + d;
    return (e.msg || 'خطا') + (s ? ' (' + s + ')' : '');
  }

  /* ---------- UI ---------- */
  function injectCSS() {
    if (document.getElementById('tai-final-css')) return;
    var s = document.createElement('style');
    s.id = 'tai-final-css';
    s.textContent =
      '#tai-root{--bg:#0e1613;--card:#14201b;--line:#2d5a47;--acc:#6ee7b7;--txt:#ecfdf5;--mut:#94b8a8;font-family:Vazirmatn,system-ui,sans-serif;direction:rtl;color:var(--txt)}' +
      '#tai-root *{box-sizing:border-box}' +
      '#tai-tab{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483000;background:#0e1613;color:var(--acc);border:1px solid var(--line);border-right:0;border-radius:12px 0 0 12px;padding:14px 9px;cursor:pointer;font-weight:800;font-size:16px;box-shadow:-4px 0 18px rgba(0,0,0,.45)}' +
      '#tai-fab{position:fixed;left:14px;bottom:calc(5.5rem + env(safe-area-inset-bottom,0px));z-index:2147483000;width:48px;height:48px;border-radius:14px;border:1px solid var(--line);background:#0e1613;color:var(--acc);font-size:18px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.4)}' +
      '#tai-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483001;opacity:0;pointer-events:none;transition:opacity .2s}' +
      '#tai-backdrop.show{opacity:1;pointer-events:auto}' +
      '#tai-drawer{position:fixed;top:0;right:0;height:100%;height:100dvh;width:min(100vw,400px);z-index:2147483002;background:var(--bg);border-left:1px solid var(--line);display:flex;flex-direction:column;transform:translateX(105%);transition:transform .22s ease;box-shadow:-12px 0 40px rgba(0,0,0,.5)}' +
      '#tai-drawer.open{transform:translateX(0)}' +
      '#tai-drawer header{padding:12px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));border-bottom:1px solid #1d3a2e;display:flex;align-items:center;gap:8px;background:#121c18}' +
      '#tai-drawer header b{flex:1;color:var(--acc);font-size:15px}' +
      '.tai-ic{min-width:32px;height:32px;border-radius:10px;border:1px solid var(--line);background:#1a2a24;color:var(--acc);cursor:pointer}' +
      '.tai-chip{padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:#1a2a24;color:var(--mut);font-size:11px;cursor:pointer}' +
      '.tai-chip.on{background:#2d5a47;color:#fff;border-color:#2d5a47}' +
      '.tai-chip.warn{color:#fde68a;border-color:#a16207}' +
      '#tai-bar{display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid #1d3a2e;background:#101915}' +
      '#tai-bar select{flex:1;min-height:38px;background:#0e1613;color:var(--txt);border:1px solid var(--line);border-radius:10px;padding:6px;font-size:12px;direction:ltr;text-align:left}' +
      '#tai-sub{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid #1d3a2e}' +
      '#tai-sub button{flex:1;min-height:34px;border-radius:10px;border:1px solid #1d3a2e;background:#14201b;color:var(--mut);cursor:pointer;font-size:12px}' +
      '#tai-sub button.on{background:#1d3a2e;color:var(--acc);border-color:var(--line)}' +
      '#tai-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}' +
      '.tai-msg{max-width:92%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.75;word-break:break-word}' +
      '.tai-user{align-self:flex-end;background:#2d5a47;color:#fff}' +
      '.tai-bot{align-self:flex-start;background:#18241f;border:1px solid #1d3a2e}' +
      '.tai-err{align-self:stretch;background:#2a1c1c;border:1px solid #7f1d1d;color:#fecaca;font-size:12.5px}' +
      '.tai-meta{font-size:10px;opacity:.75;margin-bottom:4px}' +
      '.tai-code{direction:ltr;text-align:left;background:#0a1210;padding:8px;border-radius:8px;overflow:auto;font-size:11px}' +
      '.tai-card{background:var(--card);border:1px solid #1d3a2e;border-radius:12px;padding:12px;margin-bottom:8px}' +
      '.tai-card h4{margin:0 0 8px;color:var(--acc);font-size:13px}' +
      '.tai-field{width:100%;min-height:38px;margin:6px 0;background:#0e1613;color:var(--txt);border:1px solid var(--line);border-radius:10px;padding:8px;font-family:inherit;font-size:13px}' +
      '.tai-btn{min-height:40px;border:0;border-radius:10px;background:#2d5a47;color:#fff;font-weight:700;cursor:pointer;padding:8px 12px;font-family:inherit}' +
      '.tai-btn.ghost{background:transparent;border:1px solid var(--line);color:var(--acc)}' +
      '.tai-btn.danger{background:#2a1c1c;border:1px solid #5c3a3a;color:#f5c2c2}' +
      '.tai-row{display:flex;gap:8px;align-items:center}' +
      '.tai-list{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px;border:1px solid #1d3a2e;border-radius:10px;margin-top:6px;font-size:12px}' +
      '#tai-foot{padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid #1d3a2e;background:#121c18}' +
      '#tai-in{width:100%;min-height:46px;max-height:110px;resize:none;background:#0e1613;color:var(--txt);border:1px solid var(--line);border-radius:12px;padding:10px;font-family:inherit;font-size:14px}' +
      '#tai-send{width:100%;margin-top:8px}' +
      '.tai-inject{margin:0 6px;padding:6px 10px;border-radius:10px;border:1px solid #2d5a47;background:#2d5a47;color:#fff;font-weight:700;font-size:12px;cursor:pointer;position:relative;z-index:30}' +
      '.tai-badge{font-size:11px;margin-top:6px;padding:4px 8px;border-radius:8px;display:inline-block}' +
      '.tai-badge.ok{background:rgba(110,231,183,.12);color:var(--acc)}' +
      '.tai-badge.warn{background:rgba(251,191,36,.12);color:#fde68a}';
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function build() {
    if (document.getElementById('tai-drawer')) return;
    injectCSS();
    var root = document.createElement('div');
    root.id = 'tai-root';
    root.innerHTML =
      '<button type="button" id="tai-tab" aria-label="دستیار">»</button>' +
      '<button type="button" id="tai-fab" aria-label="دستیار">✦</button>' +
      '<div id="tai-backdrop"></div>' +
      '<aside id="tai-drawer" aria-label="دستیار tilo">' +
      '<header><b>دستیار tilo</b>' +
      '<button type="button" id="tai-practice" class="tai-chip">تمرین</button>' +
      '<button type="button" id="tai-close" class="tai-ic">✕</button></header>' +
      '<div id="tai-bar"><select id="tai-prov"></select><select id="tai-model"></select></div>' +
      '<input id="tai-custom" class="tai-field" dir="ltr" placeholder="مدل دلخواه" style="display:none;margin:0 12px;width:calc(100% - 24px)" />' +
      '<div id="tai-sub">' +
      '<button type="button" data-tab="chat" class="on">چت</button>' +
      '<button type="button" data-tab="memory">حافظه</button>' +
      '<button type="button" data-tab="keys">کلیدها</button>' +
      '<button type="button" data-tab="help">؟</button></div>' +
      '<div id="tai-body"></div>' +
      '<div id="tai-foot">' +
      '<textarea id="tai-in" rows="2" placeholder="پیام بنویس… (Enter = ارسال)"></textarea>' +
      '<button type="button" id="tai-send" class="tai-btn">ارسال</button></div></aside>';
    document.body.appendChild(root);

    var prov = document.getElementById('tai-prov');
    Object.keys(PROVIDERS).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id;
      o.textContent = PROVIDERS[id].name;
      prov.appendChild(o);
    });

    document.getElementById('tai-tab').onclick = toggle;
    document.getElementById('tai-fab').onclick = toggle;
    document.getElementById('tai-backdrop').onclick = close;
    document.getElementById('tai-close').onclick = close;
    document.getElementById('tai-practice').onclick = function () {
      setPractice(!isPractice());
      paintPractice();
      render();
    };
    document.getElementById('tai-send').onclick = send;
    document.getElementById('tai-in').onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };
    document.getElementById('tai-prov').onchange = function () {
      var id = this.value;
      var m = PROVIDERS[id].models[0];
      state.selectedModel = id + ':' + m;
      sset(SK.model, state.selectedModel);
      fillModels();
    };
    document.getElementById('tai-model').onchange = function () {
      var p = document.getElementById('tai-prov').value;
      state.selectedModel = p + ':' + this.value;
      sset(SK.model, state.selectedModel);
      document.getElementById('tai-custom').style.display = this.value === '__custom__' ? 'block' : 'none';
    };
    document.getElementById('tai-custom').oninput = function () {
      state.customModel = this.value;
      sset(SK.custom, state.customModel);
    };
    document.querySelectorAll('#tai-sub [data-tab]').forEach(function (b) {
      b.onclick = function () {
        state.tab = b.getAttribute('data-tab');
        document.querySelectorAll('#tai-sub [data-tab]').forEach(function (x) {
          x.classList.toggle('on', x === b);
        });
        render();
      };
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    paintPractice();
    fillModelsFromState();
    render();
  }

  function open() {
    build();
    state.open = true;
    document.getElementById('tai-drawer').classList.add('open');
    document.getElementById('tai-backdrop').classList.add('show');
    document.getElementById('tai-tab').textContent = '«';
  }
  function close() {
    state.open = false;
    var d = document.getElementById('tai-drawer');
    var b = document.getElementById('tai-backdrop');
    if (d) d.classList.remove('open');
    if (b) b.classList.remove('show');
    var t = document.getElementById('tai-tab');
    if (t) t.textContent = '»';
  }
  function toggle() {
    if (state.open) close();
    else open();
  }
  window.tiloAI = { open: open, close: close, toggle: toggle };

  function paintPractice() {
    var b = document.getElementById('tai-practice');
    if (!b) return;
    var on = isPractice();
    b.textContent = on ? 'تمرین: روشن' : 'تمرین: خاموش';
    b.className = 'tai-chip' + (on ? ' warn on' : '');
  }

  function fillModelsFromState() {
    var pm = parseModel();
    var prov = document.getElementById('tai-prov');
    if (prov) prov.value = pm.provider;
    fillModels();
  }

  function fillModels() {
    var prov = document.getElementById('tai-prov');
    var mod = document.getElementById('tai-model');
    if (!prov || !mod) return;
    var id = prov.value;
    var list = (PROVIDERS[id] && PROVIDERS[id].models) || [];
    mod.innerHTML = '';
    list.forEach(function (m) {
      var o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      mod.appendChild(o);
    });
    var o2 = document.createElement('option');
    o2.value = '__custom__';
    o2.textContent = 'مدل دلخواه…';
    mod.appendChild(o2);
    var pm = parseModel();
    if (pm.provider === id) {
      try {
        mod.value = state.selectedModel.indexOf('__custom__') >= 0 ? '__custom__' : pm.model;
      } catch (e) {}
    }
    document.getElementById('tai-custom').style.display = mod.value === '__custom__' ? 'block' : 'none';
  }

  function nowTime() {
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date());
    } catch (e) {
      return '';
    }
  }

  function render() {
    var body = document.getElementById('tai-body');
    if (!body) return;
    if (state.tab === 'chat') renderChat(body);
    else if (state.tab === 'memory') renderMem(body);
    else if (state.tab === 'keys') renderKeys(body);
    else renderHelp(body);
  }

  function renderChat(body) {
    var html = '';
    if (isPractice()) {
      html +=
        '<div class="tai-card" style="border-color:#a16207;background:rgba(251,191,36,.08)"><div style="font-size:12px;color:#fde68a;font-weight:700">🛡️ حالت تمرین روشن — تقویم ذخیره نمی‌شود. برای اعمال واقعی، تمرین را خاموش کن.</div></div>';
    }
    if (!state.chat.length) {
      html +=
        '<div class="tai-card" style="text-align:center"><div style="color:#6ee7b7;font-weight:800">سلام، دستیار tilo</div><p style="font-size:12px;color:#94b8a8;margin:6px 0 0">اول از تب کلیدها API بگذار. با VPN برای Gemini تست کن.</p></div>';
    }
    state.chat.forEach(function (m) {
      if (m.role === 'error') {
        html += '<div class="tai-msg tai-err">' + fmt(m.content) + '</div>';
        return;
      }
      var cls = m.role === 'user' ? 'tai-user' : 'tai-bot';
      html +=
        '<div class="tai-msg ' +
        cls +
        '"><div class="tai-meta">' +
        esc(m.role === 'user' ? 'شما' : m.model || 'AI') +
        ' · ' +
        esc(m.time || '') +
        '</div><div>' +
        fmt(m.content) +
        '</div>';
      if (m.plannerSaved) html += '<div class="tai-badge ok">✅ تقویم ذخیره شد</div>';
      if (m.practiceBlocked) html += '<div class="tai-badge warn">🛡️ تمرین روشن بود — ذخیره نشد</div>';
      html += '</div>';
    });
    if (state.loading) {
      html += '<div class="tai-msg tai-bot"><div class="tai-meta">…</div>در حال پردازش</div>';
    }
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;
  }

  function renderMem(body) {
    var list =
      state.memory.length === 0
        ? '<p style="color:#94b8a8;font-size:12px;text-align:center">خالی است</p>'
        : state.memory
            .map(function (m) {
              return (
                '<div class="tai-list"><span style="flex:1">' +
                esc(m.text) +
                '</span><button type="button" class="tai-btn danger" data-del="' +
                esc(m.id) +
                '" style="min-height:32px;padding:4px 8px">حذف</button></div>'
              );
            })
            .join('');
    body.innerHTML =
      '<div class="tai-card"><h4>حافظه مشترک (همه مدل‌ها)</h4>' +
      '<input id="tai-mem-in" class="tai-field" placeholder="مثلاً: دوازدهم ریاضی، هدف ۶ ساعت" />' +
      '<button type="button" id="tai-mem-add" class="tai-btn" style="width:100%">افزودن</button></div>' +
      '<div class="tai-card"><h4>موارد</h4>' +
      list +
      '<button type="button" id="tai-chat-clear" class="tai-btn ghost" style="width:100%;margin-top:8px">پاک کردن تاریخچه چت</button></div>';
    document.getElementById('tai-mem-add').onclick = function () {
      var v = (document.getElementById('tai-mem-in').value || '').trim();
      if (!v) return;
      state.memory.unshift({ id: 'm' + Date.now(), text: v });
      saveMem();
      render();
    };
    document.getElementById('tai-chat-clear').onclick = function () {
      if (!confirm('چت پاک شود؟')) return;
      state.chat = [];
      saveChat();
      state.tab = 'chat';
      render();
    };
    body.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-del');
        state.memory = state.memory.filter(function (x) {
          return x.id !== id;
        });
        saveMem();
        render();
      };
    });
  }

  function renderKeys(body) {
    var hasBak = !!sget(SK.backup);
    var list =
      state.keys.length === 0
        ? '<p style="color:#94b8a8;font-size:12px;text-align:center">کلیدی نیست</p>'
        : state.keys
            .map(function (k) {
              var active = k.id === state.activeKeyId;
              var pn = PROVIDERS[k.provider] ? PROVIDERS[k.provider].name : k.provider;
              return (
                '<div class="tai-list" style="' +
                (active ? 'border-color:#6ee7b7' : '') +
                '"><div style="flex:1;min-width:0"><div style="font-weight:700">' +
                esc(k.label || pn) +
                ' <span style="color:#6ee7b7;font-size:10px">' +
                esc(pn) +
                '</span></div><div dir="ltr" style="font-size:11px;color:#94b8a8">••••' +
                esc((k.key || '').slice(-4)) +
                '</div></div><button type="button" class="tai-btn ghost" data-act="' +
                esc(k.id) +
                '" style="min-height:32px;padding:4px 8px">' +
                (active ? '✓' : 'فعال') +
                '</button><button type="button" class="tai-btn danger" data-delk="' +
                esc(k.id) +
                '" style="min-height:32px;padding:4px 8px">حذف</button></div>'
              );
            })
            .join('');

    body.innerHTML =
      '<div class="tai-card"><h4>افزودن کلید</h4>' +
      '<select id="tai-kp" class="tai-field"><option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter</option><option value="groq">Groq</option><option value="xai">xAI Grok</option></select>' +
      '<input id="tai-kl" class="tai-field" placeholder="نام اختیاری" />' +
      '<input id="tai-kv" class="tai-field" type="password" dir="ltr" placeholder="کلید API" />' +
      '<button type="button" id="tai-kadd" class="tai-btn" style="width:100%">ذخیره کلید</button></div>' +
      '<div class="tai-card"><h4>کلیدهای ذخیره‌شده</h4>' +
      list +
      '</div>' +
      '<div class="tai-card"><h4>بکاپ تقویم</h4>' +
      '<button type="button" id="tai-restore" class="tai-btn ghost" style="width:100%" ' +
      (hasBak ? '' : 'disabled') +
      '>' +
      (hasBak ? 'بازگردانی آخرین بکاپ' : 'بکاپ نیست') +
      '</button>' +
      '<button type="button" id="tai-ping" class="tai-btn ghost" style="width:100%;margin-top:8px">تست اتصال</button></div>';

    document.getElementById('tai-kadd').onclick = function () {
      var p = document.getElementById('tai-kp').value;
      var key = (document.getElementById('tai-kv').value || '').trim();
      var label = (document.getElementById('tai-kl').value || '').trim();
      if (key.length < 20) return alert('کلید کامل نیست');
      var id = 'k' + Date.now();
      state.keys.unshift({
        id: id,
        provider: p,
        label: label || (PROVIDERS[p] && PROVIDERS[p].name) || p,
        key: key
      });
      state.activeKeyId = id;
      state.selectedModel = p + ':' + PROVIDERS[p].models[0];
      sset(SK.model, state.selectedModel);
      saveKeys();
      fillModelsFromState();
      render();
    };
    body.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () {
        state.activeKeyId = b.getAttribute('data-act');
        saveKeys();
        render();
      };
    });
    body.querySelectorAll('[data-delk]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-delk');
        if (!confirm('حذف کلید؟')) return;
        state.keys = state.keys.filter(function (k) {
          return k.id !== id;
        });
        if (state.activeKeyId === id) state.activeKeyId = (state.keys[0] && state.keys[0].id) || '';
        saveKeys();
        render();
      };
    });
    document.getElementById('tai-restore').onclick = function () {
      var msg = restoreBackup();
      state.chat.push({ role: 'assistant', content: msg, time: nowTime(), model: 'سیستم' });
      saveChat();
      state.tab = 'chat';
      render();
    };
    document.getElementById('tai-ping').onclick = async function () {
      state.tab = 'chat';
      state.chat.push({ role: 'assistant', content: 'در حال تست اتصال…', time: nowTime(), model: 'سیستم' });
      saveChat();
      render();
      try {
        var pm = parseModel();
        await callWithKeyFallback(pm.provider, pm.model, 'فقط بنویس: ok', [], 'بگو ok');
        state.chat.push({ role: 'assistant', content: 'اتصال OK ✓', time: nowTime(), model: pm.provider });
      } catch (e) {
        state.chat.push({ role: 'error', content: friendly(e) });
      }
      saveChat();
      render();
    };
  }

  function renderHelp(body) {
    body.innerHTML =
      '<div class="tai-card"><h4>راهنما</h4>' +
      '<p style="font-size:12.5px;line-height:1.85;color:#c5d5cc;margin:0">' +
      '<b style="color:#6ee7b7">۱) کلید Gemini</b><br>aistudio.google.com → API key → تب کلیدها → ذخیره<br><br>' +
      '<b style="color:#6ee7b7">۲) Failed to fetch</b><br>اینترنت + VPN برای Gemini ضروری است. یا OpenRouter/Groq را امتحان کن.<br><br>' +
      '<b style="color:#6ee7b7">۳) حالت تمرین</b><br>روشن = فقط آموزش، تقویم ذخیره نمی‌شود (پیشنهاد: همیشه موقع تست روشن باشد).<br><br>' +
      '<b style="color:#6ee7b7">۴) تغییر تقویم</b><br>تمرین را خاموش کن و دستور جزئی بده، مثلاً: «فقط یک بلاک حسابان ۹–۱۰:۳۰ به امروز اضافه کن»<br><br>' +
      '<b style="color:#6ee7b7">۵) حافظه</b><br>در چت: «یادت باشه: …» یا از تب حافظه اضافه کن.' +
      '</p></div>';
  }

  async function send() {
    if (state.loading) return;
    var input = document.getElementById('tai-in');
    var text = ((input && input.value) || '').trim();
    if (!text) return;
    if (input) input.value = '';

    /* یادت باشه */
    var note = /^(یادت باشه|به خاطر بسپار|یادداشت کن)[:：،,\s]+([\s\S]+)/i.exec(text);
    if (note) {
      state.memory.unshift({ id: 'm' + Date.now(), text: note[2].trim() });
      saveMem();
      state.chat.push({ role: 'user', content: text, time: nowTime() });
      state.chat.push({ role: 'assistant', content: 'در حافظه مشترک ذخیره شد ✓', time: nowTime(), model: 'حافظه' });
      saveChat();
      state.tab = 'chat';
      render();
      return;
    }

    var pm = parseModel();
    if (!keyFor(pm.provider)) {
      state.chat.push({ role: 'error', content: 'کلید ' + (PROVIDERS[pm.provider] && PROVIDERS[pm.provider].name) + ' را از تب کلیدها اضافه کن.' });
      saveChat();
      state.tab = 'keys';
      document.querySelectorAll('#tai-sub [data-tab]').forEach(function (x) {
        x.classList.toggle('on', x.getAttribute('data-tab') === 'keys');
      });
      render();
      return;
    }

    state.tab = 'chat';
    document.querySelectorAll('#tai-sub [data-tab]').forEach(function (x) {
      x.classList.toggle('on', x.getAttribute('data-tab') === 'chat');
    });
    state.chat.push({ role: 'user', content: text, time: nowTime() });
    saveChat();
    state.loading = true;
    render();

    var hist = state.chat.filter(function (m) {
      return m.role === 'user' || m.role === 'assistant';
    });
    hist = hist.slice(0, -1);

    try {
      var sys = systemPrompt();
      var raw = await callWithKeyFallback(pm.provider, pm.model, sys, hist, text);
      var parsed = extract(raw);

      parsed.memories.forEach(function (t) {
        if (!state.memory.some(function (m) { return m.text === t; })) {
          state.memory.unshift({ id: 'm' + Date.now() + Math.random().toString(36).slice(2, 5), text: t });
        }
      });
      if (parsed.memories.length) saveMem();

      var plannerSaved = false;
      var practiceBlocked = false;
      var reply = parsed.text || 'انجام شد.';

      if (looksEdit(text) && isPractice()) {
        practiceBlocked = true;
      } else if (!isPractice() && looksEdit(text) && parsed.planner) {
        var wr = writePlanner(parsed.planner);
        if (wr.ok) plannerSaved = true;
        else if (wr.reason === 'empty') reply += '\n\n(blocks خالی بود — ذخیره نشد)';
      }

      state.chat.push({
        role: 'assistant',
        content: reply,
        time: nowTime(),
        model: pm.provider + ':' + pm.model,
        plannerSaved: plannerSaved,
        practiceBlocked: practiceBlocked
      });
    } catch (e) {
      state.chat.push({ role: 'error', content: friendly(e) });
    }
    state.loading = false;
    saveChat();
    render();
  }

  function injectMartell() {
    var root = document.getElementById('tilo-martell');
    if (!root) return;
    var existing = root.querySelector('.tai-inject');
    if (existing) {
      existing.style.display = root.hidden ? 'none' : '';
      return;
    }
    var bar = root.querySelector('.tm-top .tm-row') || root.querySelector('.tm-top');
    if (!bar) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tai-inject';
    b.textContent = '✦ دستیار';
    b.addEventListener(
      'click',
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        open();
      },
      true
    );
    try {
      bar.insertBefore(b, bar.firstChild);
    } catch (e) {
      bar.appendChild(b);
    }
    if (root.hidden) b.style.display = 'none';
  }

  function boot() {
    try {
      load();
      if (document.body) {
        build();
        injectMartell();
      }
    } catch (e) {
      console.warn('[tilo-ai]', e);
    }
  }

  load();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.addEventListener('load', boot);
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setInterval(injectMartell, 1200);
})();
