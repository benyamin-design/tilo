// <script src="./tilo-ai-agent.js?v=12"></script>
(function () {
  'use strict';
  if (window.__TILO_AI_AGENT_V12__) return;
  window.__TILO_AI_AGENT_V12__ = true;

  const KEYS = {
    API_KEYS: 'tilo_ai_api_keys_v1',
    ACTIVE_KEYS_MAP: 'tilo_ai_active_keys_map_v1',
    SELECTED_MODEL: 'tilo_ai_selected_model_v1',
    CUSTOM_MODEL: 'tilo_ai_custom_model_v1',
    PRACTICE: 'tilo_ai_practice_mode',
    STRENGTH: 'tilo_ai_strength_v1',
    CHAT: 'tilo_ai_chat_history_v1',
    MEMORY: 'tilo_ai_shared_memory_v1',
    PLANNER: 'tilo_martell_planner',
    PLANNER_BACKUP: 'tilo_martell_planner_ai_backup'
  };

  // light = کم‌توکن، strong = جزئیات بیشتر
  const STRENGTH = {
    light:    { maxTokens: 512,  hist: 3, mem: 3, plannerLines: 12, label: 'سبک' },
    balanced: { maxTokens: 900,  hist: 5, mem: 5, plannerLines: 20, label: 'متعادل' },
    strong:   { maxTokens: 1400, hist: 8, mem: 8, plannerLines: 35, label: 'قوی' }
  };

  const PROVIDERS = {
    gemini: {
      id: 'gemini', name: 'Google Gemini', type: 'gemini',
      models: ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest']
    },
    openrouter: {
      id: 'openrouter', name: 'OpenRouter', type: 'openai',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      models: ['openrouter/free', 'nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-31b-it:free']
    },
    groq: {
      id: 'groq', name: 'Groq', type: 'openai',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      models: ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b']
    },
    xai: {
      id: 'xai', name: 'xAI (Grok)', type: 'openai',
      endpoint: 'https://api.x.ai/v1/chat/completions',
      models: ['grok-3-mini', 'grok-3', 'grok-2-latest']
    }
  };

  const state = {
    isOpen: false,
    activeTab: 'chat',
    isLoading: false,
    isTesting: false,
    testResult: null,
    keys: [],
    activeKeysMap: {},
    selectedModel: 'gemini:gemini-3.5-flash-lite',
    customModel: '',
    practiceMode: true,
    strength: 'light',
    chatHistory: [],
    sharedMemory: [],
    abortCtrl: null
  };

  function safeReadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const p = JSON.parse(raw);
      return p == null ? fallback : p;
    } catch (_) { return fallback; }
  }
  function safeWriteJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function tehranTime() {
    try {
      return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date());
    } catch (_) { return ''; }
  }

  function loadState() {
    state.keys = Array.isArray(safeReadJSON(KEYS.API_KEYS, [])) ? safeReadJSON(KEYS.API_KEYS, []) : [];
    const map = safeReadJSON(KEYS.ACTIVE_KEYS_MAP, {});
    state.activeKeysMap = map && typeof map === 'object' ? map : {};
    state.selectedModel = localStorage.getItem(KEYS.SELECTED_MODEL) || 'gemini:gemini-3.5-flash-lite';
    state.customModel = localStorage.getItem(KEYS.CUSTOM_MODEL) || '';
    const pr = localStorage.getItem(KEYS.PRACTICE);
    if (pr === null) { state.practiceMode = true; try { localStorage.setItem(KEYS.PRACTICE, 'true'); } catch (_) {} }
    else state.practiceMode = pr === 'true';
    const st = localStorage.getItem(KEYS.STRENGTH);
    state.strength = (st && STRENGTH[st]) ? st : 'light';
    state.chatHistory = (safeReadJSON(KEYS.CHAT, []) || []).slice(-40);
    state.sharedMemory = (safeReadJSON(KEYS.MEMORY, []) || []).slice(-40);
  }
  function persistKeys() {
    safeWriteJSON(KEYS.API_KEYS, state.keys);
    safeWriteJSON(KEYS.ACTIVE_KEYS_MAP, state.activeKeysMap);
  }
  function persistChat() { safeWriteJSON(KEYS.CHAT, state.chatHistory.slice(-40)); }
  function persistMemory() { safeWriteJSON(KEYS.MEMORY, state.sharedMemory.slice(-40)); }

  function parseSelectedModel() {
    const raw = state.selectedModel || 'gemini:gemini-3.5-flash-lite';
    const i = raw.indexOf(':');
    if (i < 0) return { provider: 'gemini', model: raw };
    const provider = raw.slice(0, i);
    const modelPart = raw.slice(i + 1);
    if (modelPart === '__custom__') {
      const fb = (PROVIDERS[provider] && PROVIDERS[provider].models[0]) || 'gemini-3.5-flash-lite';
      return { provider, model: (state.customModel || '').trim() || fb };
    }
    return { provider, model: modelPart };
  }

  function getActiveKey(providerId) {
    const list = state.keys.filter(k => k && k.provider === providerId && k.key);
    if (!list.length) return null;
    const id = state.activeKeysMap[providerId];
    if (id) {
      const m = list.find(k => k.id === id);
      if (m) return m;
    }
    return list[0];
  }

  function strengthCfg() { return STRENGTH[state.strength] || STRENGTH.light; }

  /** خلاصه فشرده تقویم — نه کل JSON */
  function compactPlannerSummary(maxLines) {
    try {
      const raw = localStorage.getItem(KEYS.PLANNER);
      if (!raw) return 'تقویم خالی است.';
      let obj = JSON.parse(raw);
      if (Array.isArray(obj)) obj = { blocks: obj };
      const blocks = Array.isArray(obj.blocks) ? obj.blocks : [];
      if (!blocks.length) return 'تقویم خالی است.';
      const lines = [];
      for (let i = 0; i < blocks.length && lines.length < maxLines; i++) {
        const b = blocks[i] || {};
        const title = b.title || b.name || b.subject || b.label || 'بدون‌عنوان';
        const day = b.day || b.date || b.weekday || '';
        const start = b.start || b.from || b.startTime || '';
        const end = b.end || b.to || b.endTime || '';
        const done = b.done || b.completed ? '✓' : '·';
        lines.push(done + ' ' + [day, start && end ? start + '-' + end : start || end, title].filter(Boolean).join(' | '));
      }
      const more = blocks.length > maxLines ? ' (+' + (blocks.length - maxLines) + ' مورد دیگر)' : '';
      return 'تعداد پارت‌ها: ' + blocks.length + more + '\n' + lines.join('\n');
    } catch (_) {
      return 'خواندن تقویم ممکن نشد.';
    }
  }

  function buildSystemInstruction() {
    const cfg = strengthCfg();
    let nowFa = '';
    try {
      nowFa = new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date());
    } catch (_) { nowFa = ''; }

    const mem = state.sharedMemory.slice(0, cfg.mem).map(m => '- ' + (m.text || '')).join('\n') || '- (خالی)';
    const plan = compactPlannerSummary(cfg.plannerLines);

    // پرامپت کوتاه هدفمند
    return [
      'دستیار فارسی tilo برای برنامه‌ریزی مطالعه. پاسخ کوتاه و کاربردی.',
      'زمان تهران: ' + nowFa,
      'تمرین: ' + (state.practiceMode ? 'روشن — تقویم را تغییر نده' : 'خاموش — در صورت دستور، JSON بده'),
      'حافظه:', mem,
      'خلاصه تقویم:', plan,
      'تگ‌ها فقط در صورت نیاز:',
      '<MEMORY_ADD>نکته کوتاه</MEMORY_ADD>',
      state.practiceMode ? '' : '<PLANNER_JSON>{"blocks":[...]}</PLANNER_JSON> — blocks خالی ممنوع',
      'اگر دستور تغییر تقویم نبود تگ PLANNER نده.'
    ].filter(Boolean).join('\n');
  }

  function hasCalendarIntent(t) {
    t = String(t || '').toLowerCase();
    const targets = ['برنامه', 'تقویم', 'پارت', 'ساعت', 'تایم', 'امروز', 'فردا', 'هفته', 'مارتل'];
    const verbs = ['اضافه', 'حذف', 'عوض', 'جابجا', 'بذار', 'پاک', 'تغییر', 'ثبت', 'منتقل'];
    return targets.some(w => t.includes(w)) && verbs.some(w => t.includes(w));
  }

  function parseModelOutput(raw) {
    let text = String(raw || '');
    const memories = [];
    let plannerJson = null;
    text = text.replace(/<MEMORY_ADD>([\s\S]*?)<\/MEMORY_ADD>/gi, (_, inner) => {
      const c = String(inner || '').trim();
      if (c) memories.push(c);
      return '';
    });
    text = text.replace(/<PLANNER_JSON>([\s\S]*?)<\/PLANNER_JSON>/gi, (_, inner) => {
      try {
        let j = String(inner || '').trim().replace(/^```json?\s*/i, '').replace(/```$/, '').trim();
        plannerJson = JSON.parse(j);
      } catch (_) { plannerJson = null; }
      return '';
    });
    return { cleanText: text.trim(), memories, plannerJson };
  }

  function readPlanner() {
    try {
      const raw = localStorage.getItem(KEYS.PLANNER);
      if (!raw) return { raw: null, obj: {} };
      let p = JSON.parse(raw);
      if (Array.isArray(p)) p = { blocks: p };
      return { raw, obj: p && typeof p === 'object' ? p : {} };
    } catch (_) {
      return { raw: localStorage.getItem(KEYS.PLANNER), obj: {} };
    }
  }

  function writePlannerSafely(payload) {
    if (state.practiceMode || localStorage.getItem(KEYS.PRACTICE) === 'true') {
      return { saved: false, reason: 'practice' };
    }
    const cur = readPlanner();
    let next;
    if (Array.isArray(payload)) next = Object.assign({}, cur.obj, { blocks: payload });
    else if (payload && typeof payload === 'object') next = Object.assign({}, cur.obj, payload);
    else return { saved: false, reason: 'invalid' };
    if (!Array.isArray(next.blocks) || !next.blocks.length) return { saved: false, reason: 'empty' };
    try {
      if (cur.raw != null) localStorage.setItem(KEYS.PLANNER_BACKUP, cur.raw);
      const s = JSON.stringify(next);
      localStorage.setItem(KEYS.PLANNER, s);
      try { window.dispatchEvent(new CustomEvent('tilo:planner-updated', { detail: next })); } catch (_) {}
      return { saved: true };
    } catch (_) { return { saved: false, reason: 'write' }; }
  }

  function mapErr(name, status, apiMsg, rawErr) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'آفلاین هستید.';
    if (rawErr) {
      const m = String(rawErr.message || rawErr);
      if (/Failed to fetch|NetworkError|Load failed/i.test(m) || rawErr.name === 'TypeError') {
        return 'خطای شبکه (' + name + '). VPN/اینترنت را چک کنید.';
      }
      if (/abort/i.test(m)) return 'متوقف شد.';
      return name + ': ' + m;
    }
    if (status === 401 || status === 403) return 'کلید نامعتبر (' + name + ').';
    if (status === 429) return 'سقف درخواست پر شد (' + name + '). کمی صبر کنید.';
    if (status === 413) return 'پیام خیلی بزرگ است. چت را پاک کنید یا حالت «سبک» را بزنید.';
    if (status === 503) return name + ' شلوغ است. بعداً یا مدل دیگر را امتحان کنید.';
    if (status === 404) return 'مدل پیدا نشد. شناسه مدل را از کنسول سرویس کپی کنید.';
    if (status === 402) return 'سقف توکن/اعتبار. max_tokens را کم کنید یا کمی اعتبار بخرید.';
    return name + ' خطا ' + status + (apiMsg ? ': ' + apiMsg : '');
  }

  async function requestGemini(apiKey, model, systemInstruction, history, userPrompt, signal) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(apiKey);
    const cfg = strengthCfg();
    const contents = [];
    history.slice(-cfg.hist).forEach(item => {
      if (!item || !item.content) return;
      const role = item.role === 'assistant' ? 'model' : 'user';
      if (contents.length && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n' + item.content;
      } else contents.push({ role, parts: [{ text: item.content }] });
    });
    contents.push({ role: 'user', parts: [{ text: userPrompt }] });
    if (contents[0] && contents[0].role === 'model') {
      contents.unshift({ role: 'user', parts: [{ text: '.' }] });
    }
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: contents,
          generationConfig: { temperature: 0.5, maxOutputTokens: cfg.maxTokens }
        })
      });
    } catch (e) { throw new Error(mapErr('Gemini', 0, '', e)); }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      throw new Error(mapErr('Gemini', res.status, data && data.error && data.error.message, null));
    }
    const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    const text = Array.isArray(parts) ? parts.map(p => p.text || '').join('') : '';
    if (!text.trim()) throw new Error('پاسخ خالی از Gemini');
    return text;
  }

  async function requestOpenAICompatible(providerObj, apiKey, model, systemInstruction, history, userPrompt, signal) {
    const cfg = strengthCfg();
    const messages = [{ role: 'system', content: systemInstruction }];
    history.slice(-cfg.hist).forEach(item => {
      if (!item || !item.content) return;
      messages.push({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content });
    });
    messages.push({ role: 'user', content: userPrompt });

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    if (providerObj.id === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin || 'https://benyamin-design.github.io';
      headers['X-Title'] = 'tilo';
    }

    let res;
    try {
      res = await fetch(providerObj.endpoint, {
        method: 'POST',
        headers: headers,
        signal: signal,
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.5,
          max_tokens: cfg.maxTokens
        })
      });
    } catch (e) { throw new Error(mapErr(providerObj.name, 0, '', e)); }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const apiMsg = data && data.error && data.error.message ? data.error.message : '';
      throw new Error(mapErr(providerObj.name, res.status, apiMsg, null));
    }
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text || !String(text).trim()) throw new Error('پاسخ خالی از ' + providerObj.name);
    return String(text);
  }

  function injectStyles() {
    if (document.getElementById('tai-styles')) return;
    const s = document.createElement('style');
    s.id = 'tai-styles';
    s.textContent = `
#tai-root{--bg:#0e1613;--sf:#13201b;--bd:#2d5a47;--ac:#6ee7b7;--tx:#ecfdf5;--mu:#93b8a8;--dn:#f87171;
font-family:Vazirmatn,system-ui,sans-serif;direction:rtl;color:var(--tx)}
#tai-root *{box-sizing:border-box}
#tai-edge-tab{position:fixed!important;right:0;top:50%;transform:translateY(-50%);z-index:2147483646;
display:flex;flex-direction:column;align-items:center;gap:6px;background:#172821;color:var(--ac);
border:1px solid var(--bd);border-right:none;border-radius:12px 0 0 12px;padding:12px 8px;cursor:pointer}
#tai-edge-tab .arr{font-weight:900;font-size:14px}
#tai-edge-tab .txt{writing-mode:vertical-rl;font-size:11px;font-weight:800;color:var(--tx)}
#tai-fab{position:fixed;left:16px;bottom:84px;z-index:2147483646;display:inline-flex;align-items:center;gap:8px;
background:#162921;color:var(--ac);border:1.5px solid var(--bd);border-radius:999px;padding:10px 14px;
font-size:12px;font-weight:800;cursor:pointer}
@media(min-width:768px){#tai-fab{bottom:22px;left:22px}}
#tai-backdrop{position:fixed;inset:0;background:rgba(5,10,8,.65);z-index:2147483646;opacity:0;pointer-events:none;transition:opacity .2s}
#tai-backdrop.open{opacity:1;pointer-events:auto}
#tai-drawer{position:fixed;top:0;right:0;bottom:0;width:min(100vw,400px);height:100dvh;background:var(--bg);
border-left:1px solid var(--bd);z-index:2147483647;display:flex;flex-direction:column;transform:translateX(100%);
transition:transform .25s cubic-bezier(.16,1,.3,1)}
#tai-drawer.open{transform:translateX(0)}
.tai-hd{padding:10px 12px;background:var(--sf);border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;gap:8px}
.tai-brand{display:flex;align-items:center;gap:8px}
.tai-badge{width:30px;height:30px;border-radius:8px;background:rgba(110,231,183,.14);border:1px solid var(--bd);
color:var(--ac);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px}
.tai-title{margin:0;font-size:13px;font-weight:900}
.tai-sub{margin:0;font-size:10px;color:var(--mu)}
.tai-hd-btns{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.tai-pill{border-radius:999px;padding:4px 9px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid var(--bd);background:#192b24;color:var(--mu)}
.tai-pill.on{background:rgba(251,191,36,.16);border-color:rgba(251,191,36,.5);color:#fde68a}
.tai-x{width:28px;height:28px;border-radius:8px;border:1px solid var(--bd);background:#192b24;color:var(--tx);cursor:pointer;font-size:16px}
.tai-bar{padding:8px 10px;background:#101a16;border-bottom:1px solid rgba(45,90,71,.5);display:flex;flex-direction:column;gap:6px}
.tai-row{display:flex;gap:6px;align-items:center}
#tai-model-select,#tai-strength-select{flex:1;direction:ltr;text-align:left;background:var(--bg);color:var(--ac);
border:1px solid var(--bd);border-radius:8px;padding:6px 8px;font-size:11px;font-weight:700;font-family:ui-monospace,monospace}
#tai-custom-model{direction:ltr;text-align:left;background:var(--bg);color:var(--tx);border:1px solid var(--bd);
border-radius:8px;padding:6px 8px;font-size:11px;font-family:ui-monospace,monospace;width:100%;display:none}
#tai-key-pill{padding:5px 8px;border-radius:8px;font-size:10px;font-weight:800;border:1px solid var(--bd);background:var(--sf);color:var(--mu);cursor:pointer;white-space:nowrap}
#tai-key-pill.ready{color:var(--ac)}#tai-key-pill.missing{color:var(--dn);border-color:rgba(248,113,113,.45)}
.tai-tabs{display:grid;grid-template-columns:repeat(4,1fr);background:var(--sf);border-bottom:1px solid var(--bd)}
.tai-tab{background:0;border:0;border-bottom:2px solid transparent;color:var(--mu);padding:8px 2px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
.tai-tab.active{color:var(--ac);border-bottom-color:var(--ac);background:rgba(110,231,183,.06)}
#tai-body{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px}
.tai-msg{max-width:92%;padding:8px 10px;border-radius:12px;font-size:12px;line-height:1.65;word-break:break-word}
.tai-msg.user{align-self:flex-start;background:#1a382c;border:1px solid var(--bd)}
.tai-msg.assistant{align-self:flex-end;background:var(--sf);border:1px solid rgba(45,90,71,.65)}
.tai-msg.error{align-self:stretch;max-width:100%;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.45);color:#fecaca}
.tai-msg-head{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:9px;color:var(--mu);margin-bottom:3px}
.tai-copy{background:0;border:1px solid var(--bd);color:var(--mu);border-radius:6px;padding:2px 6px;font-size:9px;cursor:pointer}
.tai-copy:hover{color:var(--ac);border-color:var(--ac)}
.tai-tag{display:inline-block;margin-top:4px;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800}
.tai-tag.ok{background:rgba(110,231,183,.14);border:1px solid var(--bd);color:var(--ac)}
.tai-tag.warn{background:rgba(251,191,36,.14);border:1px solid rgba(251,191,36,.45);color:#fde68a}
#tai-footer{padding:8px 10px;background:var(--sf);border-top:1px solid var(--bd);display:flex;flex-direction:column;gap:6px}
.tai-chips{display:flex;gap:5px;overflow-x:auto}
.tai-chip{background:var(--bg);border:1px solid rgba(45,90,71,.75);color:var(--mu);border-radius:999px;padding:4px 8px;font-size:10px;font-weight:700;white-space:nowrap;cursor:pointer}
.tai-input-wrap{display:flex;align-items:flex-end;gap:6px}
#tai-textarea{flex:1;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:10px;padding:8px 10px;font:inherit;font-size:12px;resize:none;min-height:36px;max-height:100px;outline:0}
#tai-send-btn,#tai-stop-btn{border:none;border-radius:10px;padding:8px 12px;font:inherit;font-size:12px;font-weight:900;cursor:pointer;flex-shrink:0}
#tai-send-btn{background:var(--ac);color:#07120e}
#tai-send-btn:disabled{opacity:.45;cursor:not-allowed}
#tai-stop-btn{background:rgba(248,113,113,.2);color:#fecaca;border:1px solid rgba(248,113,113,.45);display:none}
.tai-card{background:var(--sf);border:1px solid var(--bd);border-radius:11px;padding:10px;display:flex;flex-direction:column;gap:7px}
.tai-card-title{margin:0;font-size:12px;font-weight:900;color:var(--ac)}
.tai-field{background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:8px;padding:7px 9px;font:inherit;font-size:11.5px;width:100%}
.tai-btn{border:none;border-radius:8px;padding:7px 10px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
.tai-btn.p{background:var(--ac);color:#07120e}
.tai-btn.s{background:#192b24;color:var(--tx);border:1px solid var(--bd)}
.tai-btn.d{background:rgba(248,113,113,.14);color:#fca5a5;border:1px solid rgba(248,113,113,.45);padding:4px 8px;font-size:10px}
.tai-item{background:var(--bg);border:1px solid rgba(45,90,71,.55);border-radius:8px;padding:7px 9px;display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:11px}
`;
    document.head.appendChild(s);
  }

  function modelOptionsHtml() {
    let h = '';
    Object.keys(PROVIDERS).forEach(pk => {
      const p = PROVIDERS[pk];
      h += '<optgroup label="' + esc(p.name) + '">';
      p.models.forEach(m => {
        const v = p.id + ':' + m;
        h += '<option value="' + esc(v) + '"' + (state.selectedModel === v ? ' selected' : '') + '>' + esc(m) + '</option>';
      });
      const cv = p.id + ':__custom__';
      h += '<option value="' + esc(cv) + '"' + (state.selectedModel === cv ? ' selected' : '') + '>' + esc(p.id) + ' / custom...</option>';
      h += '</optgroup>';
    });
    return h;
  }

  function mountUI() {
    try {
      if (!document.body) return false;
      if (document.getElementById('tai-drawer')) return true;
      injectStyles();
      const root = document.createElement('aside');
      root.id = 'tai-root';
      root.innerHTML =
        '<button type="button" id="tai-edge-tab" aria-label="دستیار"><span class="arr" id="tai-edge-arrow">«</span><span class="txt">دستیار AI</span></button>' +
        '<button type="button" id="tai-fab"><span>دستیار tilo</span></button>' +
        '<div id="tai-backdrop"></div>' +
        '<section id="tai-drawer">' +
        '<header class="tai-hd"><div class="tai-brand"><div class="tai-badge">AI</div><div><p class="tai-title">دستیار tilo</p><p class="tai-sub">کم‌توکن · قابل توقف</p></div></div>' +
        '<div class="tai-hd-btns">' +
        '<button type="button" class="tai-pill" id="tai-practice-toggle"><span id="tai-practice-text">تمرین</span></button>' +
        '<button type="button" class="tai-x" id="tai-close-btn">×</button></div></header>' +
        '<div class="tai-bar"><div class="tai-row">' +
        '<select id="tai-model-select" dir="ltr"></select>' +
        '<select id="tai-strength-select" dir="rtl" title="قدرت / مصرف توکن">' +
        '<option value="light">سبک</option><option value="balanced">متعادل</option><option value="strong">قوی</option></select>' +
        '<button type="button" id="tai-key-pill">کلید</button></div>' +
        '<input id="tai-custom-model" dir="ltr" placeholder="شناسه مدل سفارشی..." /></div>' +
        '<nav class="tai-tabs">' +
        '<button type="button" class="tai-tab active" data-tab="chat">چت</button>' +
        '<button type="button" class="tai-tab" data-tab="memory">حافظه</button>' +
        '<button type="button" class="tai-tab" data-tab="keys">کلیدها</button>' +
        '<button type="button" class="tai-tab" data-tab="guide">راهنما</button></nav>' +
        '<div id="tai-body"></div>' +
        '<footer id="tai-footer"><div class="tai-chips">' +
        '<button type="button" class="tai-chip" data-q="برنامه امروز را در ۳ نکته خلاصه کن">خلاصه امروز</button>' +
        '<button type="button" class="tai-chip" data-q="یک پیشنهاد کوتاه برای فردا بده">پیشنهاد فردا</button></div>' +
        '<div class="tai-input-wrap">' +
        '<textarea id="tai-textarea" rows="1" placeholder="پیام کوتاه..."></textarea>' +
        '<button type="button" id="tai-stop-btn">توقف</button>' +
        '<button type="button" id="tai-send-btn">ارسال</button></div></footer></section>';
      document.body.appendChild(root);
      bindEvents();
      renderAll();
      return true;
    } catch (e) {
      console.warn('tilo-ai mount', e);
      return false;
    }
  }

  function openDrawer() {
    if (!document.getElementById('tai-drawer')) mountUI();
    const d = document.getElementById('tai-drawer');
    const b = document.getElementById('tai-backdrop');
    if (d) d.classList.add('open');
    if (b) b.classList.add('open');
    state.isOpen = true;
    const a = document.getElementById('tai-edge-arrow');
    if (a) a.textContent = '»';
    renderAll();
  }
  function closeDrawer() {
    const d = document.getElementById('tai-drawer');
    const b = document.getElementById('tai-backdrop');
    if (d) d.classList.remove('open');
    if (b) b.classList.remove('open');
    state.isOpen = false;
    const a = document.getElementById('tai-edge-arrow');
    if (a) a.textContent = '«';
  }
  function toggleDrawer() { state.isOpen ? closeDrawer() : openDrawer(); }

  function stopGen() {
    if (state.abortCtrl) {
      try { state.abortCtrl.abort(); } catch (_) {}
      state.abortCtrl = null;
    }
    state.isLoading = false;
    const stop = document.getElementById('tai-stop-btn');
    const send = document.getElementById('tai-send-btn');
    if (stop) stop.style.display = 'none';
    if (send) send.disabled = false;
    renderAll();
  }

  function rich(text) {
    return esc(text).replace(/\n/g, '<br>');
  }

  function copyText(t) {
    const str = String(t || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).catch(function () { fallbackCopy(str); });
    } else fallbackCopy(str);
  }
  function fallbackCopy(str) {
    const ta = document.createElement('textarea');
    ta.value = str;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }

  function updateTop() {
    const pt = document.getElementById('tai-practice-text');
    const pb = document.getElementById('tai-practice-toggle');
    if (pt) pt.textContent = state.practiceMode ? 'تمرین: روشن' : 'تمرین: خاموش';
    if (pb) pb.classList.toggle('on', state.practiceMode);

    const sel = document.getElementById('tai-model-select');
    if (sel) { sel.innerHTML = modelOptionsHtml(); try { sel.value = state.selectedModel; } catch (_) {} }
    const st = document.getElementById('tai-strength-select');
    if (st) st.value = state.strength;
    const custom = document.getElementById('tai-custom-model');
    if (custom) {
      const isC = state.selectedModel.endsWith(':__custom__');
      custom.style.display = isC ? 'block' : 'none';
      custom.value = state.customModel;
    }
    const parsed = parseSelectedModel();
    const key = getActiveKey(parsed.provider);
    const pill = document.getElementById('tai-key-pill');
    if (pill) {
      const name = PROVIDERS[parsed.provider] ? PROVIDERS[parsed.provider].name : parsed.provider;
      if (key) { pill.className = 'ready'; pill.textContent = '✓ کلید'; }
      else { pill.className = 'missing'; pill.textContent = '! ' + name; }
    }
    document.querySelectorAll('#tai-root .tai-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === state.activeTab);
    });
    const foot = document.getElementById('tai-footer');
    if (foot) foot.style.display = state.activeTab === 'chat' ? 'flex' : 'none';
    const stop = document.getElementById('tai-stop-btn');
    const send = document.getElementById('tai-send-btn');
    if (stop) stop.style.display = state.isLoading ? 'inline-block' : 'none';
    if (send) send.style.display = state.isLoading ? 'none' : 'inline-block';
  }

  function renderChat(body) {
    let h = '';
    if (state.practiceMode) {
      h += '<div class="tai-card" style="border-color:rgba(251,191,36,.4)"><div style="font-size:11px;color:#fde68a">🛡️ تمرین روشن — تقویم ذخیره نمی‌شود. حالت قدرت: <b>' + esc(strengthCfg().label) + '</b></div></div>';
    }
    if (!state.chatHistory.length) {
      h += '<div class="tai-card" style="text-align:center"><div style="font-weight:900;color:var(--ac)">آماده</div><p style="font-size:11px;color:var(--mu);margin:4px 0 0">پیام کوتاه بفرست. برای کم‌مصرف‌ترین حالت «سبک» را انتخاب کن.</p></div>';
    } else {
      state.chatHistory.forEach((msg, idx) => {
        if (msg.role === 'error') {
          h += '<div class="tai-msg error">' + rich(msg.content) + '</div>';
          return;
        }
        const u = msg.role === 'user';
        h += '<div class="tai-msg ' + (u ? 'user' : 'assistant') + '"><div class="tai-msg-head"><span>' +
          esc(u ? 'شما' : (msg.modelLabel || 'AI')) + '</span><span><span dir="ltr">' + esc(msg.time || '') +
          '</span> <button type="button" class="tai-copy" data-copy-idx="' + idx + '">کپی</button></span></div><div>' +
          rich(msg.content) + '</div>';
        if (msg.plannerSaved) h += '<div class="tai-tag ok">تقویم به‌روز شد</div>';
        if (msg.practiceBlocked) h += '<div class="tai-tag warn">تمرین روشن بود</div>';
        h += '</div>';
      });
    }
    if (state.isLoading) h += '<div class="tai-msg assistant" style="opacity:.8">در حال فکر...</div>';
    body.innerHTML = h;
    body.scrollTop = body.scrollHeight;
    body.querySelectorAll('[data-copy-idx]').forEach(btn => {
      btn.onclick = function () {
        const i = +btn.getAttribute('data-copy-idx');
        const m = state.chatHistory[i];
        if (m) copyText(m.content);
        btn.textContent = 'کپی شد';
        setTimeout(function () { btn.textContent = 'کپی'; }, 1000);
      };
    });
  }

  function renderMemory(body) {
    const rows = state.sharedMemory.length
      ? state.sharedMemory.map(m =>
          '<div class="tai-item"><span style="flex:1">' + esc(m.text) + '</span>' +
          '<button type="button" class="tai-btn d" data-del-mem="' + esc(m.id) + '">حذف</button></div>').join('')
      : '<p style="font-size:11px;color:var(--mu);text-align:center">خالی</p>';
    body.innerHTML =
      '<div class="tai-card"><h4 class="tai-card-title">حافظه مشترک</h4>' +
      '<div style="display:flex;gap:6px"><input class="tai-field" id="tai-mem-in" placeholder="نکته کوتاه..." />' +
      '<button type="button" class="tai-btn p" id="tai-mem-add">+</button></div></div>' +
      '<div class="tai-card"><div style="display:flex;justify-content:space-between"><h4 class="tai-card-title">موارد</h4>' +
      '<button type="button" class="tai-btn s" id="tai-clear-chat">پاک‌کردن چت</button></div>' + rows + '</div>';
    const add = document.getElementById('tai-mem-add');
    const inp = document.getElementById('tai-mem-in');
    if (add && inp) add.onclick = function () {
      const t = inp.value.trim();
      if (!t) return;
      state.sharedMemory.unshift({ id: 'm' + Date.now(), text: t });
      persistMemory();
      renderAll();
    };
    const cc = document.getElementById('tai-clear-chat');
    if (cc) cc.onclick = function () { state.chatHistory = []; persistChat(); renderAll(); };
    body.querySelectorAll('[data-del-mem]').forEach(btn => {
      btn.onclick = function () {
        state.sharedMemory = state.sharedMemory.filter(x => x.id !== btn.getAttribute('data-del-mem'));
        persistMemory();
        renderAll();
      };
    });
  }

  function renderKeys(body) {
    const rows = state.keys.length
      ? state.keys.map(k => {
          const active = getActiveKey(k.provider);
          const isA = active && active.id === k.id;
          return '<div class="tai-item" style="' + (isA ? 'border-color:#6ee7b7' : '') + '"><div style="flex:1;min-width:0"><b>' +
            esc(k.label || k.provider) + '</b> <span style="color:var(--ac);font-size:10px">' + esc(k.provider) +
            '</span></div><button type="button" class="tai-btn s" data-act="' + esc(k.id) + '">' + (isA ? '✓' : 'فعال') +
            '</button><button type="button" class="tai-btn d" data-del="' + esc(k.id) + '">حذف</button></div>';
        }).join('')
      : '<p style="font-size:11px;color:var(--mu);text-align:center">کلیدی نیست</p>';
    let testH = '';
    if (state.testResult) {
      testH = '<div style="font-size:11px;padding:8px;border-radius:8px;border:1px solid ' +
        (state.testResult.ok ? 'var(--bd)' : 'rgba(248,113,113,.45)') + ';color:' +
        (state.testResult.ok ? 'var(--ac)' : '#fecaca') + '">' + esc(state.testResult.message) + '</div>';
    }
    body.innerHTML =
      '<div class="tai-card"><h4 class="tai-card-title">کلید جدید</h4>' +
      '<select id="tai-np" class="tai-field"><option value="gemini">Gemini</option><option value="openrouter">OpenRouter</option>' +
      '<option value="groq">Groq</option><option value="xai">xAI</option></select>' +
      '<input class="tai-field" id="tai-nl" placeholder="برچسب" />' +
      '<input class="tai-field" id="tai-nk" dir="ltr" type="password" placeholder="API key" />' +
      '<button type="button" class="tai-btn p" id="tai-save-k">ذخیره</button></div>' +
      '<div class="tai-card"><div style="display:flex;justify-content:space-between;align-items:center">' +
      '<h4 class="tai-card-title">کلیدها</h4><button type="button" class="tai-btn s" id="tai-test">تست اتصال</button></div>' +
      testH + rows + '</div>' +
      '<div class="tai-card"><button type="button" class="tai-btn s" id="tai-restore">بازگردانی بکاپ تقویم</button></div>';

    const save = document.getElementById('tai-save-k');
    if (save) save.onclick = function () {
      const provider = document.getElementById('tai-np').value;
      const label = document.getElementById('tai-nl').value.trim();
      const secret = document.getElementById('tai-nk').value.trim();
      if (!secret || secret.length < 8) return;
      const entry = { id: 'k' + Date.now(), provider: provider, label: label || provider, key: secret };
      state.keys.unshift(entry);
      state.activeKeysMap[provider] = entry.id;
      if (parseSelectedModel().provider !== provider && PROVIDERS[provider]) {
        state.selectedModel = provider + ':' + PROVIDERS[provider].models[0];
        try { localStorage.setItem(KEYS.SELECTED_MODEL, state.selectedModel); } catch (_) {}
      }
      persistKeys();
      renderAll();
    };
    body.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = function () {
        const id = btn.getAttribute('data-act');
        const found = state.keys.find(k => k.id === id);
        if (!found) return;
        state.activeKeysMap[found.provider] = found.id;
        if (PROVIDERS[found.provider] && parseSelectedModel().provider !== found.provider) {
          state.selectedModel = found.provider + ':' + PROVIDERS[found.provider].models[0];
          try { localStorage.setItem(KEYS.SELECTED_MODEL, state.selectedModel); } catch (_) {}
        }
        persistKeys();
        renderAll();
      };
    });
    body.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = function () {
        const id = btn.getAttribute('data-del');
        const found = state.keys.find(k => k.id === id);
        state.keys = state.keys.filter(k => k.id !== id);
        if (found && state.activeKeysMap[found.provider] === id) delete state.activeKeysMap[found.provider];
        persistKeys();
        renderAll();
      };
    });
    const test = document.getElementById('tai-test');
    if (test) test.onclick = handleTest;
    const rest = document.getElementById('tai-restore');
    if (rest) rest.onclick = function () {
      const b = localStorage.getItem(KEYS.PLANNER_BACKUP);
      if (!b) return;
      try {
        localStorage.setItem(KEYS.PLANNER, b);
        window.dispatchEvent(new CustomEvent('tilo:planner-updated', { detail: JSON.parse(b) }));
      } catch (_) {}
    };
  }

  function renderGuide(body) {
    body.innerHTML =
      '<div class="tai-card"><h4 class="tai-card-title">کم‌مصرف‌ترین حالت</h4>' +
      '<p style="font-size:11.5px;line-height:1.7;margin:0;color:var(--tx)">قدرت «سبک» = توکن کمتر. چت را کوتاه نگه دار. تقویم کامل ارسال نمی‌شود؛ فقط خلاصه.</p></div>' +
      '<div class="tai-card"><h4 class="tai-card-title">توقف</h4>' +
      '<p style="font-size:11.5px;line-height:1.7;margin:0;color:var(--tx)">هنگام پاسخ دکمه «توقف» ظاهر می‌شود.</p></div>' +
      '<div class="tai-card"><h4 class="tai-card-title">کپی</h4>' +
      '<p style="font-size:11.5px;line-height:1.7;margin:0;color:var(--tx)">روی هر پیام دکمه کپی هست.</p></div>' +
      '<div class="tai-card"><h4 class="tai-card-title">Groq</h4>' +
      '<p style="font-size:11.5px;line-height:1.7;margin:0;color:var(--mu)">مدل‌هایی مثل openai/gpt-oss-20b را در custom بنویس.</p></div>';
  }

  function renderAll() {
    try {
      updateTop();
      const body = document.getElementById('tai-body');
      if (!body) return;
      if (state.activeTab === 'chat') renderChat(body);
      else if (state.activeTab === 'memory') renderMemory(body);
      else if (state.activeTab === 'keys') renderKeys(body);
      else renderGuide(body);
    } catch (e) { console.warn('render', e); }
  }

  async function handleTest() {
    if (state.isTesting) return;
    const sel = parseSelectedModel();
    const p = PROVIDERS[sel.provider];
    const key = getActiveKey(sel.provider);
    if (!key) {
      state.testResult = { ok: false, message: 'کلید ' + (p && p.name) + ' نیست' };
      renderAll();
      return;
    }
    state.isTesting = true;
    state.testResult = null;
    renderAll();
    const t0 = Date.now();
    try {
      if (sel.provider === 'gemini') await requestGemini(key.key, sel.model, 'فقط OK', [], 'تست', null);
      else await requestOpenAICompatible(p, key.key, sel.model, 'فقط OK', [], 'تست', null);
      state.testResult = { ok: true, message: '✅ موفق ' + (Date.now() - t0) + 'ms — ' + sel.model };
    } catch (e) {
      state.testResult = { ok: false, message: e.message || 'ناموفق' };
    } finally {
      state.isTesting = false;
      renderAll();
    }
  }

  async function handleSend() {
    if (state.isLoading) return;
    const ta = document.getElementById('tai-textarea');
    if (!ta) return;
    const userText = ta.value.trim();
    if (!userText) return;

    const sel = parseSelectedModel();
    const p = PROVIDERS[sel.provider];
    const key = getActiveKey(sel.provider);
    if (!key) {
      state.chatHistory.push({ role: 'error', content: 'کلید ' + (p && p.name) + ' ثبت نشده. تب کلیدها.' });
      persistChat();
      state.activeTab = 'keys';
      renderAll();
      return;
    }

    ta.value = '';
    ta.style.height = 'auto';
    const prev = state.chatHistory.filter(m => m.role === 'user' || m.role === 'assistant');
    state.chatHistory.push({ role: 'user', time: tehranTime(), content: userText });
    persistChat();
    state.isLoading = true;
    state.abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    renderAll();

    try {
      const sys = buildSystemInstruction();
      let raw;
      if (sel.provider === 'gemini') {
        raw = await requestGemini(key.key, sel.model, sys, prev, userText, state.abortCtrl && state.abortCtrl.signal);
      } else {
        raw = await requestOpenAICompatible(p, key.key, sel.model, sys, prev, userText, state.abortCtrl && state.abortCtrl.signal);
      }
      const parsed = parseModelOutput(raw);
      if (parsed.memories.length) {
        parsed.memories.forEach(mem => {
          if (!state.sharedMemory.some(m => m.text === mem)) {
            state.sharedMemory.unshift({ id: 'm' + Date.now(), text: mem });
          }
        });
        persistMemory();
      }
      let plannerSaved = false, practiceBlocked = false;
      let finalReply = parsed.cleanText || 'پاسخ دریافت شد.';
      const cal = hasCalendarIntent(userText);
      if (cal && state.practiceMode) practiceBlocked = true;
      else if (!state.practiceMode && cal && parsed.plannerJson) {
        const w = writePlannerSafely(parsed.plannerJson);
        if (w.saved) plannerSaved = true;
      }
      state.chatHistory.push({
        role: 'assistant',
        modelLabel: sel.provider + ':' + sel.model,
        time: tehranTime(),
        content: finalReply,
        plannerSaved: plannerSaved,
        practiceBlocked: practiceBlocked
      });
      persistChat();
    } catch (e) {
      state.chatHistory.push({ role: 'error', content: e.message || 'خطا' });
      persistChat();
    } finally {
      state.isLoading = false;
      state.abortCtrl = null;
      renderAll();
    }
  }

  function bindEvents() {
    const edge = document.getElementById('tai-edge-tab');
    const fab = document.getElementById('tai-fab');
    const bd = document.getElementById('tai-backdrop');
    const close = document.getElementById('tai-close-btn');
    const practice = document.getElementById('tai-practice-toggle');
    const modelSel = document.getElementById('tai-model-select');
    const strengthSel = document.getElementById('tai-strength-select');
    const custom = document.getElementById('tai-custom-model');
    const keyPill = document.getElementById('tai-key-pill');
    const ta = document.getElementById('tai-textarea');
    const send = document.getElementById('tai-send-btn');
    const stop = document.getElementById('tai-stop-btn');

    function tog(e) { e.preventDefault(); e.stopPropagation(); toggleDrawer(); }
    if (edge) edge.addEventListener('click', tog, true);
    if (fab) fab.addEventListener('click', tog, true);
    if (bd) bd.addEventListener('click', closeDrawer);
    if (close) close.addEventListener('click', closeDrawer);
    if (stop) stop.addEventListener('click', stopGen);

    if (practice) practice.addEventListener('click', function () {
      state.practiceMode = !state.practiceMode;
      try { localStorage.setItem(KEYS.PRACTICE, state.practiceMode ? 'true' : 'false'); } catch (_) {}
      renderAll();
    });
    if (modelSel) modelSel.addEventListener('change', function () {
      state.selectedModel = modelSel.value;
      try { localStorage.setItem(KEYS.SELECTED_MODEL, state.selectedModel); } catch (_) {}
      renderAll();
    });
    if (strengthSel) strengthSel.addEventListener('change', function () {
      state.strength = strengthSel.value in STRENGTH ? strengthSel.value : 'light';
      try { localStorage.setItem(KEYS.STRENGTH, state.strength); } catch (_) {}
      renderAll();
    });
    if (custom) custom.addEventListener('input', function () {
      state.customModel = custom.value;
      try { localStorage.setItem(KEYS.CUSTOM_MODEL, state.customModel); } catch (_) {}
    });
    if (keyPill) keyPill.addEventListener('click', function () { state.activeTab = 'keys'; renderAll(); });
    document.querySelectorAll('#tai-root .tai-tab').forEach(btn => {
      btn.addEventListener('click', function () {
        state.activeTab = btn.getAttribute('data-tab') || 'chat';
        renderAll();
      });
    });
    document.querySelectorAll('#tai-root .tai-chip').forEach(chip => {
      chip.addEventListener('click', function () {
        if (ta) { ta.value = chip.getAttribute('data-q') || ''; handleSend(); }
      });
    });
    if (send) send.addEventListener('click', handleSend);
    if (ta) {
      ta.addEventListener('input', function () {
        ta.style.height = 'auto';
        ta.style.height = Math.min(100, ta.scrollHeight) + 'px';
      });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.isOpen) closeDrawer();
    });
  }

  function bootstrap() {
    try {
      loadState();
      window.tiloAI = { open: openDrawer, close: closeDrawer, toggle: toggleDrawer, stop: stopGen };
      function start() { mountUI(); }
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
      else start();
      window.addEventListener('load', function () { if (!document.getElementById('tai-drawer')) mountUI(); });
    } catch (e) { console.warn('tilo-ai bootstrap', e); }
  }

  bootstrap();
})();
