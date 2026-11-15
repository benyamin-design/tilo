/**
 * tilo-ai-agent.js v5 — دستیار tilo (چت، تقویم، چند کلید، بایگانی، حافظه)
 * <script src="./tilo-ai-agent.js?v=5"></script>  بدون defer ترجیح داده می‌شود
 */
(function () {
  "use strict";
  try {
    if (window.__tiloAiV5) return;
    window.__tiloAiV5 = true;
  } catch (_) {
    return;
  }

  var LS = {
    key: "tilo_ai_key",
    keys: "tilo_ai_providers_v1",
    active: "tilo_ai_active_provider",
    model: "tilo_ai_model",
    chat: "tilo_ai_chat_v1",
    sessions: "tilo_ai_sessions_v1",
    memory: "tilo_ai_memory_v1",
    data: "tilo_martell_planner",
    backup: "tilo_martell_planner_ai_backup"
  };

  var PRESETS = [
    {
      id: "gemini",
      name: "Google Gemini (رایگان رسمی)",
      type: "gemini",
      models: ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"]
    },
    {
      id: "groq",
      name: "Groq (سریع، سقف روزانه)",
      type: "openai",
      base: "https://api.groq.com/openai/v1",
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    },
    {
      id: "openrouter",
      name: "OpenRouter (مدل‌های free)",
      type: "openai",
      base: "https://openrouter.ai/api/v1",
      models: ["google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free"]
    }
  ];

  function jget(k, fallback) {
    try {
      var v = localStorage.getItem(k);
      if (v == null) return fallback;
      return JSON.parse(v);
    } catch (_) {
      return fallback;
    }
  }
  function jset(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (_) {}
  }
  function sget(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  }
  function sset(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (_) {}
  }

  function loadProviders() {
    var list = jget(LS.keys, null);
    if (!Array.isArray(list)) {
      list = [];
      var legacy = sget(LS.key);
      if (legacy && legacy.length > 20) {
        list.push({
          id: "p_legacy",
          preset: "gemini",
          name: "Gemini",
          type: "gemini",
          key: legacy,
          model: "gemini-3.5-flash-lite"
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
    var p = list.find(function (x) {
      return x.id === id;
    });
    return p || list[0] || null;
  }

  var chat = jget(LS.chat, []);
  if (!Array.isArray(chat)) chat = [];
  var memory = jget(LS.memory, { notes: "", facts: [] });
  if (!memory || typeof memory !== "object") memory = { notes: "", facts: [] };
  if (!Array.isArray(memory.facts)) memory.facts = [];
  var busy = false;

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "style" && typeof attrs[k] === "object") Object.assign(n.style, attrs[k]);
        else if (k === "text") n.textContent = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    return n;
  }

  function cssBtn(extra) {
    return Object.assign(
      {
        minHeight: "36px",
        border: "1px solid #2f453c",
        background: "#1f2d27",
        color: "#c5d5cc",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "12px",
        padding: "6px 10px"
      },
      extra || {}
    );
  }

  function ensureUI() {
    if (document.getElementById("tilo-ai-tab")) {
      injectMartellBtn();
      return true;
    }
    if (!document.body) return false;

    var tab = el("button", { id: "tilo-ai-tab", type: "button", "aria-label": "دستیار" });
    tab.textContent = "»";
    Object.assign(tab.style, {
      position: "fixed",
      top: "38%",
      right: "0",
      zIndex: "2147483646",
      margin: "0",
      padding: "18px 11px",
      border: "none",
      borderRadius: "14px 0 0 14px",
      background: "#2d5a47",
      color: "#ecfdf5",
      fontSize: "22px",
      fontWeight: "800",
      cursor: "pointer",
      boxShadow: "-4px 0 18px rgba(0,0,0,.5)",
      pointerEvents: "auto"
    });

    var drawer = el("aside", { id: "tilo-ai-drawer" });
    Object.assign(drawer.style, {
      position: "fixed",
      top: "0",
      right: "0",
      width: "min(100vw, 420px)",
      height: "100%",
      maxHeight: "100dvh",
      zIndex: "2147483647",
      background: "#121c18",
      color: "#e2ebe5",
      borderLeft: "1px solid #2f453c",
      display: "flex",
      flexDirection: "column",
      transform: "translateX(110%)",
      transition: "transform .2s ease",
      boxShadow: "-12px 0 40px rgba(0,0,0,.55)",
      direction: "rtl",
      fontFamily: "inherit",
      pointerEvents: "auto"
    });

    var head = el("div");
    Object.assign(head.style, {
      padding: "12px 14px",
      paddingTop: "calc(10px + env(safe-area-inset-top,0px))",
      borderBottom: "1px solid #2f453c",
      background: "#18241f"
    });
    head.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<div><div style="color:#6ee7b7;font-weight:700;font-size:14px">دستیار tilo</div>' +
      '<div style="color:#8fa89b;font-size:10px">چت · تقویم · حافظه روی دستگاه</div></div>' +
      '<div id="tilo-ai-head-actions" style="display:flex;gap:6px;flex-wrap:wrap"></div></div>';

    var headActions = head.querySelector("#tilo-ai-head-actions");
    function addHead(id, label, title) {
      var b = el("button", { id: id, type: "button", title: title || label });
      b.textContent = label;
      Object.assign(b.style, cssBtn({ minWidth: "34px", padding: "6px 8px" }));
      headActions.appendChild(b);
      return b;
    }
    var btnNew = addHead("tilo-ai-new", "＋", "چت جدید");
    var btnArch = addHead("tilo-ai-arch", "📁", "بایگانی");
    var btnMem = addHead("tilo-ai-mem", "🧠", "حافظه");
    var btnProv = addHead("tilo-ai-prov", "⚙️", "مدل و API");
    var btnClose = addHead("tilo-ai-close", "✕", "بستن");

    var toolbar = el("div");
    Object.assign(toolbar.style, {
      display: "flex",
      gap: "8px",
      padding: "8px 12px",
      borderBottom: "1px solid #2f453c",
      background: "#15201b",
      flexWrap: "wrap",
      alignItems: "center"
    });
    var modelSel = el("select", { id: "tilo-ai-model" });
    Object.assign(modelSel.style, {
      flex: "1",
      minHeight: "36px",
      background: "#101915",
      color: "#e2e8f0",
      border: "1px solid #2c3e35",
      borderRadius: "10px",
      padding: "4px 8px",
      fontSize: "12px"
    });
    var provSel = el("select", { id: "tilo-ai-provider" });
    Object.assign(provSel.style, modelSel.style);
    toolbar.appendChild(provSel);
    toolbar.appendChild(modelSel);

    var msgs = el("div", { id: "tilo-ai-msgs" });
    Object.assign(msgs.style, {
      flex: "1",
      overflow: "auto",
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    });

    var archPanel = el("div", { id: "tilo-ai-arch-panel" });
    Object.assign(archPanel.style, {
      display: "none",
      flex: "1",
      overflow: "auto",
      padding: "12px",
      borderTop: "1px solid #2f453c"
    });

    var memPanel = el("div", { id: "tilo-ai-mem-panel" });
    Object.assign(memPanel.style, {
      display: "none",
      padding: "12px",
      borderTop: "1px solid #2f453c",
      background: "#15201b"
    });
    memPanel.innerHTML =
      '<div style="font-size:12px;color:#8fa89b;margin-bottom:6px">حافظه محلی (روی همین دستگاه)</div>' +
      '<textarea id="tilo-ai-mem-notes" rows="4" placeholder="نکات ثابت درباره خودت: رشته، هدف ساعت مطالعه، ضعف درسی..."></textarea>' +
      '<button type="button" id="tilo-ai-mem-save" style="margin-top:8px;width:100%">ذخیره حافظه</button>';
    var memTa = memPanel.querySelector("#tilo-ai-mem-notes");
    Object.assign(memTa.style, {
      width: "100%",
      boxSizing: "border-box",
      background: "#101915",
      color: "#e2e8f0",
      border: "1px solid #2c3e35",
      borderRadius: "10px",
      padding: "8px",
      fontSize: "13px",
      fontFamily: "inherit"
    });
    Object.assign(memPanel.querySelector("#tilo-ai-mem-save").style, cssBtn({ width: "100%", background: "#2d5a47", color: "#fff", borderColor: "#2d5a47" }));

    var settings = el("div", { id: "tilo-ai-settings" });
    Object.assign(settings.style, {
      display: "none",
      padding: "12px",
      borderTop: "1px solid #2f453c",
      background: "#15201b",
      fontSize: "12px"
    });
    settings.innerHTML =
      '<div style="color:#6ee7b7;font-weight:700;margin-bottom:8px">API و مدل</div>' +
      '<label style="display:block;margin-bottom:6px;color:#8fa89b">ارائه‌دهنده</label>' +
      '<select id="tilo-ai-preset"></select>' +
      '<label style="display:block;margin:8px 0 6px;color:#8fa89b">کلید API</label>' +
      '<input id="tilo-ai-key-input" type="password" placeholder="کلید را بچسبان" dir="ltr" />' +
      '<div style="display:flex;gap:6px;margin-top:8px">' +
      '<button type="button" id="tilo-ai-add-key">ذخیره / افزودن</button>' +
      '<button type="button" id="tilo-ai-del-key">حذف فعال</button>' +
      "</div>" +
      '<p style="color:#8fa89b;font-size:10px;margin-top:8px;line-height:1.6">معتبر و پایدار: Google AI Studio (Gemini رایگان با سقف). گزینه‌های کمکی: Groq و OpenRouter free — سقف دارند و ممکن است تغییر کنند. کلید را در سورس سایت نگذار.</p>';
    ["#tilo-ai-preset", "#tilo-ai-key-input"].forEach(function (sel) {
      var node = settings.querySelector(sel);
      Object.assign(node.style, {
        width: "100%",
        boxSizing: "border-box",
        minHeight: "38px",
        background: "#101915",
        color: "#e2e8f0",
        border: "1px solid #2c3e35",
        borderRadius: "10px",
        padding: "8px",
        marginBottom: "4px"
      });
    });
    settings.querySelector("#tilo-ai-add-key").style.cssText =
      "flex:1;min-height:38px;border-radius:10px;border:0;background:#2d5a47;color:#fff;font-weight:700;cursor:pointer";
    settings.querySelector("#tilo-ai-del-key").style.cssText =
      "flex:1;min-height:38px;border-radius:10px;border:1px solid #5c3a3a;background:#2a1c1c;color:#f5c2c2;cursor:pointer";

    var foot = el("div");
    Object.assign(foot.style, {
      borderTop: "1px solid #2f453c",
      padding: "10px 12px",
      paddingBottom: "calc(10px + env(safe-area-inset-bottom,0px))",
      background: "#18241f"
    });
    var input = el("textarea", {
      id: "tilo-ai-input",
      rows: "2",
      placeholder: "سؤال بپرس یا بگو تقویم را عوض کند…"
    });
    Object.assign(input.style, {
      width: "100%",
      boxSizing: "border-box",
      minHeight: "48px",
      background: "#101915",
      color: "#e2e8f0",
      border: "1px solid #2c3e35",
      borderRadius: "12px",
      padding: "10px",
      fontSize: "14px",
      fontFamily: "inherit"
    });
    var send = el("button", { id: "tilo-ai-send", type: "button", text: "ارسال" });
    Object.assign(send.style, cssBtn({ width: "100%", marginTop: "8px", minHeight: "44px", background: "#2d5a47", color: "#fff", borderColor: "#2d5a47", fontWeight: "700", fontSize: "14px" }));
    foot.appendChild(input);
    foot.appendChild(send);

    drawer.appendChild(head);
    drawer.appendChild(toolbar);
    drawer.appendChild(settings);
    drawer.appendChild(memPanel);
    drawer.appendChild(msgs);
    drawer.appendChild(archPanel);
    drawer.appendChild(foot);
    document.body.appendChild(tab);
    document.body.appendChild(drawer);

    function open() {
      drawer.style.transform = "translateX(0)";
      tab.textContent = "«";
      tab.style.background = "#1f3d32";
      // روی تایم‌بلاک هم روی همه چیز باشد
      try {
        drawer.style.zIndex = "2147483647";
        tab.style.zIndex = "2147483646";
      } catch (_) {}
      try {
        input.focus();
      } catch (_) {}
    }
    function close() {
      drawer.style.transform = "translateX(110%)";
      tab.textContent = "»";
      tab.style.background = "#2d5a47";
    }
    function toggle() {
      if (drawer.style.transform === "translateX(0)" || drawer.style.transform === "translateX(0px)") close();
      else open();
    }

    tab.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    btnClose.addEventListener("click", close);
    btnNew.addEventListener("click", function () {
      if (chat.length && !confirm("چت جدید؟ فعلی بایگانی می‌شود.")) return;
      archive();
      chat = [];
      jset(LS.chat, chat);
      paint();
      bot("چت جدید آماده است.");
    });
    btnArch.addEventListener("click", function () {
      var show = archPanel.style.display === "none";
      archPanel.style.display = show ? "block" : "none";
      msgs.style.display = show ? "none" : "flex";
      memPanel.style.display = "none";
      settings.style.display = "none";
      if (show) renderArch();
    });
    btnMem.addEventListener("click", function () {
      var show = memPanel.style.display === "none";
      memPanel.style.display = show ? "block" : "none";
      settings.style.display = "none";
      if (show) memTa.value = memory.notes || "";
    });
    btnProv.addEventListener("click", function () {
      var show = settings.style.display === "none";
      settings.style.display = show ? "block" : "none";
      memPanel.style.display = "none";
      if (show) fillSettings();
    });
    memPanel.querySelector("#tilo-ai-mem-save").addEventListener("click", function () {
      memory.notes = memTa.value || "";
      jset(LS.memory, memory);
      bot("حافظه ذخیره شد (فقط این دستگاه).");
    });
    settings.querySelector("#tilo-ai-add-key").addEventListener("click", addProviderFromForm);
    settings.querySelector("#tilo-ai-del-key").addEventListener("click", delActiveProvider);
    provSel.addEventListener("change", function () {
      sset(LS.active, provSel.value);
      fillModels();
    });
    modelSel.addEventListener("change", function () {
      var p = activeProvider();
      if (!p) return;
      p.model = modelSel.value;
      var list = loadProviders().map(function (x) {
        return x.id === p.id ? p : x;
      });
      saveProviders(list);
      sset(LS.model, modelSel.value);
    });
    send.addEventListener("click", doSend);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });

    window.tiloAI = { open: open, close: close, toggle: toggle };

    function bubble(role, text) {
      var b = el("div");
      b.textContent = text;
      Object.assign(b.style, {
        maxWidth: "92%",
        padding: "10px 12px",
        borderRadius: "14px",
        fontSize: "13px",
        lineHeight: "1.7",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      });
      if (role === "me") {
        Object.assign(b.style, {
          alignSelf: "flex-end",
          background: "#2d5a47",
          color: "#fff"
        });
      } else {
        Object.assign(b.style, {
          alignSelf: "flex-start",
          background: "#1b2822",
          border: "1px solid #2f453c",
          color: "#e2ebe5"
        });
      }
      return b;
    }
    function paint() {
      msgs.innerHTML = "";
      chat.forEach(function (m) {
        msgs.appendChild(bubble(m.role === "me" ? "me" : "bot", m.text));
      });
      msgs.scrollTop = msgs.scrollHeight;
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
    function archive() {
      if (!chat.length) return;
      var all = jget(LS.sessions, []);
      if (!Array.isArray(all)) all = [];
      all.unshift({ at: new Date().toISOString(), messages: chat.slice() });
      jset(LS.sessions, all.slice(0, 30));
    }
    function renderArch() {
      var all = jget(LS.sessions, []);
      archPanel.innerHTML = "";
      var h = el("div");
      h.textContent = "بایگانی چت‌ها (روی دستگاه)";
      Object.assign(h.style, { color: "#6ee7b7", fontWeight: "700", marginBottom: "10px", fontSize: "13px" });
      archPanel.appendChild(h);
      if (!all.length) {
        var empty = el("div");
        empty.textContent = "هنوز بایگانی نیست. با ＋ چت جدید بساز.";
        empty.style.color = "#8fa89b";
        empty.style.fontSize = "12px";
        archPanel.appendChild(empty);
        return;
      }
      all.forEach(function (s, idx) {
        var row = el("div");
        Object.assign(row.style, {
          border: "1px solid #2f453c",
          borderRadius: "12px",
          padding: "10px",
          marginBottom: "8px",
          background: "#1b2822"
        });
        var title = el("div");
        title.textContent = (s.at || "").replace("T", " ").slice(0, 19) + " · " + (s.messages || []).length + " پیام";
        title.style.fontSize = "12px";
        title.style.marginBottom = "8px";
        var openB = el("button", { type: "button", text: "باز کردن" });
        Object.assign(openB.style, cssBtn({ marginLeft: "6px" }));
        var delB = el("button", { type: "button", text: "حذف" });
        Object.assign(delB.style, cssBtn({ color: "#f5c2c2" }));
        openB.onclick = function () {
          if (chat.length) archive();
          chat = (s.messages || []).slice();
          jset(LS.chat, chat);
          archPanel.style.display = "none";
          msgs.style.display = "flex";
          paint();
        };
        delB.onclick = function () {
          all.splice(idx, 1);
          jset(LS.sessions, all);
          renderArch();
        };
        row.appendChild(title);
        row.appendChild(openB);
        row.appendChild(delB);
        archPanel.appendChild(row);
      });
    }

    function fillSettings() {
      var preset = settings.querySelector("#tilo-ai-preset");
      preset.innerHTML = "";
      PRESETS.forEach(function (p) {
        var o = el("option");
        o.value = p.id;
        o.textContent = p.name;
        preset.appendChild(o);
      });
      fillProviders();
      fillModels();
    }
    function fillProviders() {
      var list = loadProviders();
      provSel.innerHTML = "";
      if (!list.length) {
        var o = el("option");
        o.value = "";
        o.textContent = "کلیدی ذخیره نشده — ⚙️";
        provSel.appendChild(o);
        return;
      }
      list.forEach(function (p) {
        var o = el("option");
        o.value = p.id;
        o.textContent = (p.name || p.preset || "API") + (p.model ? " · " + p.model : "");
        provSel.appendChild(o);
      });
      var act = sget(LS.active) || list[0].id;
      provSel.value = act;
    }
    function fillModels() {
      modelSel.innerHTML = "";
      var p = activeProvider();
      var models = (p && p.models) || (PRESETS[0] && PRESETS[0].models) || ["gemini-3.5-flash-lite"];
      if (p && p.model && models.indexOf(p.model) < 0) models = [p.model].concat(models);
      models.forEach(function (m) {
        var o = el("option");
        o.value = m;
        o.textContent = m;
        modelSel.appendChild(o);
      });
      if (p && p.model) modelSel.value = p.model;
    }
    function addProviderFromForm() {
      var presetId = settings.querySelector("#tilo-ai-preset").value;
      var key = String(settings.querySelector("#tilo-ai-key-input").value || "").trim();
      if (key.length < 20) {
        alert("کلید را وارد کن");
        return;
      }
      var preset = PRESETS.find(function (x) {
        return x.id === presetId;
      }) || PRESETS[0];
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
      settings.querySelector("#tilo-ai-key-input").value = "";
      fillProviders();
      fillModels();
      bot("کلید «" + preset.name + "» اضافه شد.");
    }
    function delActiveProvider() {
      var act = activeProvider();
      if (!act) return;
      if (!confirm("این کلید حذف شود؟")) return;
      var list = loadProviders().filter(function (x) {
        return x.id !== act.id;
      });
      saveProviders(list);
      if (list[0]) sset(LS.active, list[0].id);
      else
        try {
          localStorage.removeItem(LS.active);
        } catch (_) {}
      fillProviders();
      fillModels();
      bot("کلید حذف شد.");
    }

    function snapshot() {
      var raw = sget(LS.data);
      return (
        raw ||
        JSON.stringify({ version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} })
      );
    }
    function wantsCal(t) {
      return /تایم[\s\-]?بلاک|تقویم|پارت|بلاک|برنامه\s*(روز|فردا|امروز|هفته)|جابه‌جا|حذف کن|اضافه کن|بساز|تأخیر|ساعت\s*\d/i.test(
        String(t || "")
      );
    }
    function validate(obj) {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("JSON آبجکت نیست");
      if (!Array.isArray(obj.blocks)) throw new Error("blocks نیست");
      obj.blocks.forEach(function (b, i) {
        if (!b || !b.id) throw new Error("بلاک " + i);
        if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) throw new Error("تاریخ " + i);
        if (b.start != null && b.end != null) {
          var s = Number(b.start),
            e = Number(b.end);
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
    function contextPack() {
      var parts = 0;
      try {
        parts = (JSON.parse(sget("sp_pro_parts") || "[]") || []).length;
      } catch (_) {}
      var blocks = 0;
      try {
        blocks = (JSON.parse(snapshot()).blocks || []).length;
      } catch (_) {}
      return {
        partsCount: parts,
        blocksCount: blocks,
        memoryNotes: memory.notes || "",
        planner: snapshot()
      };
    }

    async function callGemini(p, contents, jsonMode) {
      var model = modelSel.value || p.model || "gemini-3.5-flash-lite";
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
      var res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
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
    async function callOpenAI(p, messages, jsonMode) {
      var model = modelSel.value || p.model || (p.models && p.models[0]);
      var res = await fetch(String(p.base).replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + p.key
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: jsonMode ? 0.15 : 0.45
        })
      });
      var data = await res.json();
      if (!res.ok) throw new Error((data.error && data.error.message) || "HTTP " + res.status);
      var t = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!t) throw new Error("پاسخ خالی");
      return t;
    }

    async function doSend() {
      if (busy) return;
      var text = String(input.value || "").trim();
      if (!text) return;
      var p = activeProvider();
      if (!p || !p.key) {
        settings.style.display = "block";
        fillSettings();
        alert("اول از ⚙️ یک کلید API اضافه کن.");
        return;
      }
      me(text);
      input.value = "";
      busy = true;
      send.disabled = true;
      send.textContent = "…";
      var cal = wantsCal(text);
      var ctx = contextPack();
      try {
        var reply;
        if (p.type === "gemini") {
          var contents = [];
          if (cal) {
            contents.push({
              role: "user",
              parts: [
                {
                  text:
                    "فقط JSON تقویم tilo برگردان. حافظه کاربر: " +
                    (ctx.memoryNotes || "—") +
                    "\nدیتا:\n" +
                    ctx.planner +
                    "\nدستور:\n" +
                    text
                }
              ]
            });
            reply = await callGemini(p, contents, true);
            var parsed = validate(JSON.parse(extractJson(reply)));
            parsed.updatedAt = new Date().toISOString();
            try {
              sset(LS.backup, ctx.planner);
            } catch (_) {}
            sset(LS.data, JSON.stringify(parsed));
            bot("تقویم به‌روز شد (" + parsed.blocks.length + " بلاک). رفرش…");
            setTimeout(function () {
              location.reload();
            }, 500);
            return;
          }
          contents.push({
            role: "user",
            parts: [
              {
                text:
                  "دستیار tilo (کنکور + تایم‌بلاک). حافظه: " +
                  (ctx.memoryNotes || "خالی") +
                  " | پارت‌ها: " +
                  ctx.partsCount +
                  " | بلاک‌های تقویم: " +
                  ctx.blocksCount +
                  ". کوتاه و کاربردی."
              }
            ]
          });
          chat.slice(-10).forEach(function (m) {
            contents.push({
              role: m.role === "me" ? "user" : "model",
              parts: [{ text: m.text }]
            });
          });
          contents.push({ role: "user", parts: [{ text: text }] });
          reply = await callGemini(p, contents, false);
          bot(reply);
        } else {
          var messages = [
            {
              role: "system",
              content:
                "دستیار tilo. حافظه: " +
                (ctx.memoryNotes || "—") +
                " | parts=" +
                ctx.partsCount +
                " blocks=" +
                ctx.blocksCount
            }
          ];
          if (cal) {
            messages.push({
              role: "user",
              content: "فقط JSON تقویم برگردان.\n" + ctx.planner + "\nدستور: " + text
            });
            reply = await callOpenAI(p, messages, true);
            var parsed2 = validate(JSON.parse(extractJson(reply)));
            parsed2.updatedAt = new Date().toISOString();
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
          reply = await callOpenAI(p, messages, false);
          bot(reply);
        }
      } catch (err) {
        bot("خطا: " + (err && err.message ? err.message : err));
      } finally {
        busy = false;
        send.disabled = false;
        send.textContent = "ارسال";
      }
    }

    paint();
    fillProviders();
    fillModels();
    if (!chat.length) {
      bot(
        "سلام. از » یا دکمه داخل تقویم باز شو.\n⚙️ چند API/مدل · 🧠 حافظه · 📁 بایگانی · ＋ چت جدید\nبرای تغییر برنامه بگو «در تایم‌بلاک …»"
      );
    }
    injectMartellBtn();
    return true;
  }

  function injectMartellBtn() {
    var root = document.getElementById("tilo-martell");
    if (!root || root.hidden) return;
    var bar = root.querySelector(".tm-top .tm-row") || root.querySelector(".tm-top");
    if (!bar) return;
    if (document.getElementById("tilo-ai-martell-btn")) return;
    var b = el("button", { id: "tilo-ai-martell-btn", type: "button", text: "🤖 دستیار" });
    Object.assign(b.style, cssBtn({ background: "#2d5a47", color: "#fff", borderColor: "#2d5a47", fontWeight: "700" }));
    b.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.tiloAI && window.tiloAI.open) window.tiloAI.open();
      },
      true
    );
    try {
      bar.insertBefore(b, bar.firstChild);
    } catch (_) {
      bar.appendChild(b);
    }
  }

  function boot() {
    try {
      ensureUI();
      injectMartellBtn();
    } catch (e) {
      try {
        console.warn("[tilo-ai]", e);
      } catch (_) {}
    }
  }

  boot();
  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", boot);
  setTimeout(boot, 0);
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setInterval(injectMartellBtn, 1500);
})();
