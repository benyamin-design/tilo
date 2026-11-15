/**
 * tilo-ai-agent.js v6
 * زبانه » + دکمه شناور + دکمه داخل تقویم — هر سه یک پنل را باز می‌کنند
 * <script src="./tilo-ai-agent.js?v=6"></script>
 */
(function () {
  "use strict";
  if (window.__tiloAiV6) return;
  window.__tiloAiV6 = true;

  var LS = {
    keys: "tilo_ai_providers_v1",
    active: "tilo_ai_active_provider",
    chat: "tilo_ai_chat_v1",
    sessions: "tilo_ai_sessions_v1",
    memory: "tilo_ai_memory_v1",
    data: "tilo_martell_planner",
    backup: "tilo_martell_planner_ai_backup",
    legacyKey: "tilo_ai_key"
  };

  var PRESETS = [
    { id: "gemini", name: "Gemini (رسمی)", type: "gemini", models: ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"] },
    { id: "groq", name: "Groq", type: "openai", base: "https://api.groq.com/openai/v1", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
    { id: "openrouter", name: "OpenRouter free", type: "openai", base: "https://openrouter.ai/api/v1", models: ["google/gemini-2.0-flash-exp:free"] }
  ];

  function jget(k, fb) {
    try {
      var v = localStorage.getItem(k);
      if (v == null) return fb;
      return JSON.parse(v);
    } catch (e) {
      return fb;
    }
  }
  function jset(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
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

  function loadProviders() {
    var list = jget(LS.keys, null);
    if (!Array.isArray(list)) {
      list = [];
      var leg = sget(LS.legacyKey);
      if (leg && leg.length > 20) {
        list.push({
          id: "p_legacy",
          preset: "gemini",
          name: "Gemini",
          type: "gemini",
          key: leg,
          model: "gemini-3.5-flash-lite",
          models: PRESETS[0].models.slice()
        });
      }
      jset(LS.keys, list);
    }
    return list;
  }
  function saveProviders(list) {
    jset(LS.keys, list);
  }
  function activeProvider() {
    var list = loadProviders();
    var id = sget(LS.active);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null;
  }

  var chat = jget(LS.chat, []);
  if (!Array.isArray(chat)) chat = [];
  var memory = jget(LS.memory, { notes: "" }) || { notes: "" };
  var busy = false;
  var isOpen = false;

  function openPanel() {
    var d = document.getElementById("tilo-ai-drawer");
    var t = document.getElementById("tilo-ai-tab");
    if (!d) return;
    d.style.transform = "translateX(0)";
    d.style.visibility = "visible";
    isOpen = true;
    if (t) {
      t.textContent = "«";
      t.setAttribute("aria-expanded", "true");
    }
  }
  function closePanel() {
    var d = document.getElementById("tilo-ai-drawer");
    var t = document.getElementById("tilo-ai-tab");
    if (!d) return;
    d.style.transform = "translateX(110%)";
    isOpen = false;
    if (t) {
      t.textContent = "»";
      t.setAttribute("aria-expanded", "false");
    }
  }
  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }

  window.tiloAI = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel
  };

  // کلیک سراسری با capture تا داخل martell هم کار کند
  document.addEventListener(
    "click",
    function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var hit = t.closest(
        "#tilo-ai-tab, #tilo-ai-fab, #tilo-ai-martell-btn, [data-tilo-ai-open], #tilo-ai-close"
      );
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      if (hit.id === "tilo-ai-close") closePanel();
      else togglePanel();
    },
    true
  );

  function buildUI() {
    if (document.getElementById("tilo-ai-tab")) return;

    // ——— زبانه » (عوض نشده) ———
    var tab = document.createElement("button");
    tab.id = "tilo-ai-tab";
    tab.type = "button";
    tab.textContent = "»";
    tab.setAttribute("aria-label", "دستیار tilo");
    tab.setAttribute("aria-expanded", "false");
    tab.style.cssText =
      "position:fixed;top:38%;right:0;z-index:2147483646;margin:0;padding:18px 11px;" +
      "border:none;border-radius:14px 0 0 14px;background:#2d5a47;color:#ecfdf5;" +
      "font-size:22px;font-weight:800;cursor:pointer;box-shadow:-4px 0 18px rgba(0,0,0,.5);" +
      "pointer-events:auto;display:block !important;visibility:visible !important";

    // ——— دکمه شناور پشتیبان (صفحه اصلی) ———
    var fab = document.createElement("button");
    fab.id = "tilo-ai-fab";
    fab.type = "button";
    fab.setAttribute("data-tilo-ai-open", "1");
    fab.innerHTML = "🤖<span style='font-size:10px;display:block'>دستیار</span>";
    fab.style.cssText =
      "position:fixed;left:12px;bottom:calc(6.5rem + env(safe-area-inset-bottom,0px));z-index:2147483645;" +
      "width:52px;height:52px;border-radius:16px;border:1px solid #3d5c4f;background:#1f2d27;color:#d1fae5;" +
      "font-size:16px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.45);line-height:1.15;padding:6px 0";

    // ——— کشو ———
    var drawer = document.createElement("aside");
    drawer.id = "tilo-ai-drawer";
    drawer.style.cssText =
      "position:fixed;top:0;right:0;width:min(100vw,420px);height:100%;max-height:100dvh;" +
      "z-index:2147483647;background:#121c18;color:#e2ebe5;border-left:1px solid #2f453c;" +
      "display:flex;flex-direction:column;transform:translateX(110%);transition:transform .2s ease;" +
      "box-shadow:-12px 0 40px rgba(0,0,0,.55);direction:rtl;font-family:inherit;pointer-events:auto";

    drawer.innerHTML =
      '<div style="padding:12px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));border-bottom:1px solid #2f453c;background:#18241f">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<div><div style="color:#6ee7b7;font-weight:700;font-size:14px">دستیار tilo</div>' +
      '<div style="color:#8fa89b;font-size:10px">» زبانه · 🤖 شناور · داخل تقویم</div></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      '<button type="button" data-ai-act="new" style="min-height:34px;padding:6px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">＋</button>' +
      '<button type="button" data-ai-act="arch" style="min-height:34px;padding:6px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">📁</button>' +
      '<button type="button" data-ai-act="mem" style="min-height:34px;padding:6px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">🧠</button>' +
      '<button type="button" data-ai-act="set" style="min-height:34px;padding:6px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">⚙️</button>' +
      '<button type="button" id="tilo-ai-close" style="min-height:34px;width:34px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">✕</button>' +
      "</div></div></div>" +
      '<div style="display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid #2f453c;background:#15201b">' +
      '<select id="tilo-ai-provider" style="flex:1;min-height:36px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:4px 8px;font-size:12px"></select>' +
      '<select id="tilo-ai-model" style="flex:1;min-height:36px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:4px 8px;font-size:12px"></select>' +
      "</div>" +
      '<div id="tilo-ai-settings" style="display:none;padding:12px;border-bottom:1px solid #2f453c;background:#15201b;font-size:12px">' +
      '<div style="color:#6ee7b7;font-weight:700;margin-bottom:8px">API و کلید</div>' +
      '<select id="tilo-ai-preset" style="width:100%;min-height:36px;margin-bottom:6px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px"></select>' +
      '<input id="tilo-ai-key-input" type="password" placeholder="کلید API" dir="ltr" style="width:100%;box-sizing:border-box;min-height:36px;margin-bottom:6px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:8px" />' +
      '<div style="display:flex;gap:6px"><button type="button" data-ai-act="addkey" style="flex:1;min-height:36px;border:0;border-radius:10px;background:#2d5a47;color:#fff;font-weight:700;cursor:pointer">ذخیره</button>' +
      '<button type="button" data-ai-act="delkey" style="flex:1;min-height:36px;border:1px solid #5c3a3a;border-radius:10px;background:#2a1c1c;color:#f5c2c2;cursor:pointer">حذف فعال</button></div>' +
      '<p style="color:#8fa89b;font-size:10px;margin:8px 0 0;line-height:1.6">معتبر: Google AI Studio. کمکی: Groq / OpenRouter free. کلید در سورس سایت نگذار.</p></div>' +
      '<div id="tilo-ai-mem" style="display:none;padding:12px;border-bottom:1px solid #2f453c;background:#15201b">' +
      '<textarea id="tilo-ai-mem-notes" rows="4" placeholder="حافظه محلی: رشته، هدف ساعت، نقاط ضعف..." style="width:100%;box-sizing:border-box;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:8px;font-family:inherit"></textarea>' +
      '<button type="button" data-ai-act="savemem" style="width:100%;margin-top:8px;min-height:36px;border:0;border-radius:10px;background:#2d5a47;color:#fff;cursor:pointer">ذخیره حافظه</button></div>' +
      '<div id="tilo-ai-arch" style="display:none;flex:1;overflow:auto;padding:12px"></div>' +
      '<div id="tilo-ai-msgs" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px"></div>' +
      '<div style="border-top:1px solid #2f453c;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));background:#18241f">' +
      '<textarea id="tilo-ai-input" rows="2" placeholder="اینجا بنویس… Enter = ارسال" style="width:100%;box-sizing:border-box;min-height:48px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:12px;padding:10px;font-size:14px;font-family:inherit"></textarea>' +
      '<button type="button" id="tilo-ai-send" style="width:100%;margin-top:8px;min-height:44px;border:0;border-radius:12px;background:#2d5a47;color:#fff;font-weight:700;font-size:14px;cursor:pointer">ارسال</button></div>';

    document.body.appendChild(tab);
    document.body.appendChild(fab);
    document.body.appendChild(drawer);

    // اکشن‌های داخل پنل (capture)
    drawer.addEventListener(
      "click",
      function (e) {
        var b = e.target.closest("[data-ai-act]");
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        var act = b.getAttribute("data-ai-act");
        if (act === "new") newChat();
        else if (act === "arch") toggleArch();
        else if (act === "mem") toggleMem();
        else if (act === "set") toggleSet();
        else if (act === "addkey") addKey();
        else if (act === "delkey") delKey();
        else if (act === "savemem") {
          memory.notes = (document.getElementById("tilo-ai-mem-notes") || {}).value || "";
          jset(LS.memory, memory);
          bot("حافظه ذخیره شد.");
        }
      },
      true
    );

    document.getElementById("tilo-ai-send").addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      doSend();
    });
    document.getElementById("tilo-ai-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });
    document.getElementById("tilo-ai-provider").addEventListener("change", function () {
      sset(LS.active, this.value);
      fillModels();
    });
    document.getElementById("tilo-ai-model").addEventListener("change", function () {
      var p = activeProvider();
      if (!p) return;
      p.model = this.value;
      var list = loadProviders().map(function (x) {
        return x.id === p.id ? p : x;
      });
      saveProviders(list);
    });

    fillProviders();
    fillModels();
    fillPresets();
    paint();
    if (!chat.length) {
      bot(
        "سه راه برای باز کردن من:\n۱) زبانه » سمت راست\n۲) دکمه 🤖 پایین چپ\n۳) داخل تایم‌بلاک: «🤖 دستیار»\n\n⚙️ کلید API بگذار، بعد حرف بزن یا بگو تقویم را عوض کند."
      );
    }
  }

  function injectMartell() {
    var root = document.getElementById("tilo-martell");
    if (!root || root.hidden) return;
    if (document.getElementById("tilo-ai-martell-btn")) return;
    var bar = root.querySelector(".tm-top .tm-row") || root.querySelector(".tm-top");
    if (!bar) return;
    var b = document.createElement("button");
    b.id = "tilo-ai-martell-btn";
    b.type = "button";
    b.setAttribute("data-tilo-ai-open", "1");
    b.textContent = "🤖 دستیار";
    b.style.cssText =
      "min-height:36px;padding:6px 10px;border-radius:10px;border:1px solid #2d5a47;" +
      "background:#2d5a47;color:#fff;font-weight:700;font-size:12px;cursor:pointer;pointer-events:auto;z-index:5;position:relative";
    try {
      bar.insertBefore(b, bar.firstChild);
    } catch (e) {
      bar.appendChild(b);
    }
  }

  function bot(t) {
    chat.push({ role: "bot", text: String(t) });
    jset(LS.chat, chat.slice(-50));
    paint();
  }
  function me(t) {
    chat.push({ role: "me", text: String(t) });
    jset(LS.chat, chat.slice(-50));
    paint();
  }
  function paint() {
    var box = document.getElementById("tilo-ai-msgs");
    if (!box) return;
    box.innerHTML = "";
    chat.forEach(function (m) {
      var d = document.createElement("div");
      d.textContent = m.text;
      d.style.cssText =
        "max-width:92%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word;" +
        (m.role === "me"
          ? "align-self:flex-end;background:#2d5a47;color:#fff"
          : "align-self:flex-start;background:#1b2822;border:1px solid #2f453c;color:#e2ebe5");
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }

  function archive() {
    if (!chat.length) return;
    var all = jget(LS.sessions, []);
    if (!Array.isArray(all)) all = [];
    all.unshift({ at: new Date().toISOString(), messages: chat.slice() });
    jset(LS.sessions, all.slice(0, 30));
  }
  function newChat() {
    if (chat.length && !confirm("چت جدید؟ قبلی بایگانی می‌شود.")) return;
    archive();
    chat = [];
    jset(LS.chat, chat);
    paint();
    bot("چت جدید.");
  }
  function toggleArch() {
    var a = document.getElementById("tilo-ai-arch");
    var m = document.getElementById("tilo-ai-msgs");
    var show = a.style.display === "none" || !a.style.display;
    a.style.display = show ? "block" : "none";
    m.style.display = show ? "none" : "flex";
    document.getElementById("tilo-ai-settings").style.display = "none";
    document.getElementById("tilo-ai-mem").style.display = "none";
    if (show) {
      var all = jget(LS.sessions, []);
      a.innerHTML = '<div style="color:#6ee7b7;font-weight:700;margin-bottom:8px">بایگانی</div>';
      if (!all.length) {
        a.innerHTML += '<div style="color:#8fa89b;font-size:12px">خالی است.</div>';
        return;
      }
      all.forEach(function (s, idx) {
        var row = document.createElement("div");
        row.style.cssText = "border:1px solid #2f453c;border-radius:12px;padding:10px;margin-bottom:8px;background:#1b2822";
        row.innerHTML =
          '<div style="font-size:12px;margin-bottom:6px">' +
          String(s.at || "").slice(0, 19) +
          " · " +
          (s.messages || []).length +
          " پیام</div>";
        var o = document.createElement("button");
        o.textContent = "باز کردن";
        o.style.cssText = "margin-left:6px;min-height:32px;padding:4px 8px;border-radius:8px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer";
        o.onclick = function () {
          if (chat.length) archive();
          chat = (s.messages || []).slice();
          jset(LS.chat, chat);
          a.style.display = "none";
          m.style.display = "flex";
          paint();
        };
        var d = document.createElement("button");
        d.textContent = "حذف";
        d.style.cssText = o.style.cssText;
        d.onclick = function () {
          all.splice(idx, 1);
          jset(LS.sessions, all);
          toggleArch();
          toggleArch();
        };
        row.appendChild(o);
        row.appendChild(d);
        a.appendChild(row);
      });
    }
  }
  function toggleMem() {
    var p = document.getElementById("tilo-ai-mem");
    var show = p.style.display === "none" || !p.style.display;
    p.style.display = show ? "block" : "none";
    document.getElementById("tilo-ai-settings").style.display = "none";
    if (show) document.getElementById("tilo-ai-mem-notes").value = memory.notes || "";
  }
  function toggleSet() {
    var p = document.getElementById("tilo-ai-settings");
    p.style.display = p.style.display === "none" || !p.style.display ? "block" : "none";
    document.getElementById("tilo-ai-mem").style.display = "none";
  }
  function fillPresets() {
    var s = document.getElementById("tilo-ai-preset");
    if (!s) return;
    s.innerHTML = "";
    PRESETS.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      s.appendChild(o);
    });
  }
  function fillProviders() {
    var s = document.getElementById("tilo-ai-provider");
    if (!s) return;
    var list = loadProviders();
    s.innerHTML = "";
    if (!list.length) {
      var o = document.createElement("option");
      o.value = "";
      o.textContent = "بدون کلید — ⚙️";
      s.appendChild(o);
      return;
    }
    list.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name || p.preset;
      s.appendChild(o);
    });
    s.value = sget(LS.active) || list[0].id;
  }
  function fillModels() {
    var s = document.getElementById("tilo-ai-model");
    if (!s) return;
    s.innerHTML = "";
    var p = activeProvider();
    var models = (p && (p.models || [p.model])) || PRESETS[0].models;
    models.forEach(function (m) {
      if (!m) return;
      var o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      s.appendChild(o);
    });
    if (p && p.model) s.value = p.model;
  }
  function addKey() {
    var presetId = document.getElementById("tilo-ai-preset").value;
    var key = String(document.getElementById("tilo-ai-key-input").value || "").trim();
    if (key.length < 20) {
      alert("کلید را وارد کن");
      return;
    }
    var preset = PRESETS[0];
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === presetId) preset = PRESETS[i];
    var list = loadProviders();
    var id = "p_" + Date.now().toString(36);
    list.push({
      id: id,
      preset: preset.id,
      name: preset.name,
      type: preset.type,
      base: preset.base || "",
      key: key,
      model: preset.models[0],
      models: preset.models.slice()
    });
    saveProviders(list);
    sset(LS.active, id);
    document.getElementById("tilo-ai-key-input").value = "";
    fillProviders();
    fillModels();
    bot("کلید ذخیره شد: " + preset.name);
  }
  function delKey() {
    var p = activeProvider();
    if (!p) return;
    if (!confirm("حذف کلید فعال؟")) return;
    var list = loadProviders().filter(function (x) {
      return x.id !== p.id;
    });
    saveProviders(list);
    if (list[0]) sset(LS.active, list[0].id);
    fillProviders();
    fillModels();
    bot("کلید حذف شد.");
  }

  function snapshot() {
    return (
      sget(LS.data) ||
      JSON.stringify({ version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} })
    );
  }
  function wantsCal(t) {
    return /تایم[\s\-]?بلاک|تقویم|پارت|بلاک|برنامه\s*(روز|فردا|امروز|هفته)|جابه‌جا|حذف کن|اضافه کن|بساز|تأخیر|ساعت\s*\d/i.test(
      String(t || "")
    );
  }
  function validate(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("JSON نامعتبر");
    if (!Array.isArray(obj.blocks)) throw new Error("blocks نیست");
    obj.blocks.forEach(function (b, i) {
      if (!b || !b.id) throw new Error("بلاک " + i);
      if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) throw new Error("تاریخ " + i);
      if (b.start != null && b.end != null) {
        var s = +b.start,
          e = +b.end;
        if (!(s >= 0 && e > s && e <= 1440)) throw new Error("ساعت " + (b.title || i));
      }
    });
    if (obj.version == null) obj.version = 1;
    if (!Array.isArray(obj.trash)) obj.trash = [];
    if (!obj.finalized) obj.finalized = {};
    return obj;
  }
  function extractJson(raw) {
    var text = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    var a = text.indexOf("{");
    var b = text.lastIndexOf("}");
    if (a >= 0 && b > a) return text.slice(a, b + 1);
    return text;
  }

  async function callGemini(p, contents, jsonMode) {
    var model = (document.getElementById("tilo-ai-model") || {}).value || p.model || "gemini-3.5-flash-lite";
    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent?key=" +
      encodeURIComponent(p.key);
    var body = {
      contents: contents,
      generationConfig: { temperature: jsonMode ? 0.15 : 0.45, maxOutputTokens: 8192 }
    };
    if (jsonMode) body.generationConfig.responseMimeType = "application/json";
    var res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var data = await res.json();
    if (!res.ok || data.error) throw new Error((data.error && data.error.message) || "HTTP " + res.status);
    var t =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    if (!t) throw new Error("پاسخ خالی");
    return t;
  }
  async function callOpenAI(p, messages) {
    var model = (document.getElementById("tilo-ai-model") || {}).value || p.model;
    var res = await fetch(String(p.base).replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + p.key },
      body: JSON.stringify({ model: model, messages: messages, temperature: 0.4 })
    });
    var data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || "HTTP " + res.status);
    var t = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!t) throw new Error("پاسخ خالی");
    return t;
  }

  async function doSend() {
    if (busy) return;
    var input = document.getElementById("tilo-ai-input");
    var send = document.getElementById("tilo-ai-send");
    var text = String((input && input.value) || "").trim();
    if (!text) return;
    var p = activeProvider();
    if (!p || !p.key) {
      document.getElementById("tilo-ai-settings").style.display = "block";
      alert("اول از ⚙️ کلید اضافه کن");
      return;
    }
    me(text);
    if (input) input.value = "";
    busy = true;
    if (send) {
      send.disabled = true;
      send.textContent = "…";
    }
    try {
      var cal = wantsCal(text);
      var partsCount = 0;
      try {
        partsCount = (JSON.parse(sget("sp_pro_parts") || "[]") || []).length;
      } catch (e) {}
      if (p.type === "gemini") {
        if (cal) {
          var raw = await callGemini(
            p,
            [
              {
                role: "user",
                parts: [
                  {
                    text:
                      "فقط JSON تقویم tilo. حافظه:" +
                      (memory.notes || "—") +
                      "\n" +
                      snapshot() +
                      "\nدستور:" +
                      text
                  }
                ]
              }
            ],
            true
          );
          var parsed = validate(JSON.parse(extractJson(raw)));
          parsed.updatedAt = new Date().toISOString();
          sset(LS.backup, snapshot());
          sset(LS.data, JSON.stringify(parsed));
          bot("تقویم به‌روز شد. رفرش…");
          setTimeout(function () {
            location.reload();
          }, 500);
          return;
        }
        var contents = [
          {
            role: "user",
            parts: [
              {
                text:
                  "دستیار tilo. حافظه:" +
                  (memory.notes || "—") +
                  " | پارت‌ها:" +
                  partsCount +
                  ". کوتاه و کاربردی."
              }
            ]
          }
        ];
        chat.slice(-10).forEach(function (m) {
          contents.push({ role: m.role === "me" ? "user" : "model", parts: [{ text: m.text }] });
        });
        contents.push({ role: "user", parts: [{ text: text }] });
        bot(await callGemini(p, contents, false));
      } else {
        var messages = [{ role: "system", content: "دستیار tilo. حافظه:" + (memory.notes || "—") }];
        if (cal) {
          messages.push({ role: "user", content: "فقط JSON تقویم\n" + snapshot() + "\n" + text });
          var raw2 = await callOpenAI(p, messages);
          var parsed2 = validate(JSON.parse(extractJson(raw2)));
          sset(LS.data, JSON.stringify(parsed2));
          bot("تقویم به‌روز شد. رفرش…");
          setTimeout(function () {
            location.reload();
          }, 500);
          return;
        }
        chat.slice(-10).forEach(function (m) {
          messages.push({ role: m.role === "me" ? "user" : "assistant", content: m.text });
        });
        messages.push({ role: "user", content: text });
        bot(await callOpenAI(p, messages));
      }
    } catch (err) {
      bot("خطا: " + (err && err.message ? err.message : err));
    } finally {
      busy = false;
      if (send) {
        send.disabled = false;
        send.textContent = "ارسال";
      }
    }
  }

  function boot() {
    try {
      if (!document.body) return;
      buildUI();
      injectMartell();
    } catch (e) {
      try {
        console.warn("[tilo-ai v6]", e);
      } catch (e2) {}
    }
  }

  boot();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", boot);
  setTimeout(boot, 0);
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
  setInterval(injectMartell, 1000);
})();
