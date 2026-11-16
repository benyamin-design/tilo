/**
 * tilo-ai-agent.js v9
 * دستیار tilo — ظاهر تمیزتر، خطای شبکه واضح، حالت تمرین، چند API
 * <script src="./tilo-ai-agent.js?v=9"></script>
 */
(function () {
  "use strict";
  if (window.__tiloAiV9) return;
  window.__tiloAiV9 = true;

  var LS = {
    providers: "tilo_ai_providers_v2",
    active: "tilo_ai_active_provider",
    chat: "tilo_ai_chat_v2",
    sessions: "tilo_ai_sessions_v2",
    memory: "tilo_ai_memory_v2",
    practice: "tilo_ai_practice_mode",
    data: "tilo_martell_planner",
    backup: "tilo_martell_planner_ai_backup",
    legacyKey: "tilo_ai_key"
  };

  var PRESETS = [
    {
      id: "gemini",
      name: "Google Gemini",
      type: "gemini",
      hint: "aistudio.google.com — اگر Failed to fetch دیدی VPN بزن",
      models: ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest"]
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      type: "openai",
      base: "https://openrouter.ai/api/v1",
      hint: "openrouter.ai/keys — مدل‌های :free",
      models: ["google/gemma-4-31b-it:free", "nvidia/nemotron-3.5-lightning:free", "openrouter/free"]
    },
    {
      id: "groq",
      name: "Groq",
      type: "openai",
      base: "https://api.groq.com/openai/v1",
      hint: "console.groq.com",
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    },
    {
      id: "xai",
      name: "Grok (xAI)",
      type: "openai",
      base: "https://api.x.ai/v1",
      hint: "console.x.ai — پولی",
      models: ["grok-4.3", "grok-4-fast", "grok-3-mini"]
    }
  ];

  function jget(k, fb) {
    try {
      var v = localStorage.getItem(k);
      return v == null ? fb : JSON.parse(v);
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
    var list = jget(LS.providers, null);
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
      jset(LS.providers, list);
    }
    return list;
  }
  function saveProviders(list) {
    jset(LS.providers, list);
  }
  function activeProvider() {
    var list = loadProviders();
    var id = sget(LS.active);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null;
  }

  var chat = jget(LS.chat, []);
  if (!Array.isArray(chat)) chat = [];
  var memory = jget(LS.memory, { notes: "", style: "" }) || { notes: "", style: "" };
  var practiceMode = sget(LS.practice) === "1";
  var busy = false;
  var isOpen = false;

  function openPanel() {
    buildUI();
    var d = document.getElementById("tilo-ai-drawer");
    var t = document.getElementById("tilo-ai-tab");
    if (!d) return;
    d.style.transform = "translateX(0)";
    isOpen = true;
    if (t) t.textContent = "«";
    fillProviders();
    fillModels();
  }
  function closePanel() {
    var d = document.getElementById("tilo-ai-drawer");
    var t = document.getElementById("tilo-ai-tab");
    if (d) d.style.transform = "translateX(110%)";
    isOpen = false;
    if (t) t.textContent = "»";
  }
  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }
  window.tiloAI = { open: openPanel, close: closePanel, toggle: togglePanel };

  document.addEventListener(
    "click",
    function (e) {
      if (!e.target || !e.target.closest) return;
      var hit = e.target.closest(
        "#tilo-ai-tab,#tilo-ai-fab,#tilo-ai-martell-btn,[data-tilo-ai-open],#tilo-ai-close"
      );
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      if (hit.id === "tilo-ai-close") closePanel();
      else togglePanel();
    },
    true
  );

  function css(el, o) {
    Object.assign(el.style, o);
  }

  function buildUI() {
    if (document.getElementById("tilo-ai-tab")) return;
    if (!document.body) return;

    var style = document.createElement("style");
    style.id = "tilo-ai-v9-css";
    style.textContent =
      "#tilo-ai-drawer *{box-sizing:border-box}" +
      "#tilo-ai-drawer select,#tilo-ai-drawer input,#tilo-ai-drawer textarea{font-family:inherit}" +
      "#tilo-ai-drawer .ai-row{display:flex;gap:8px;align-items:center}" +
      "#tilo-ai-drawer .ai-chip{font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid #2f453c;background:#1a2621;color:#a7f3d0}" +
      "#tilo-ai-drawer .ai-chip.warn{color:#fde68a;border-color:#854d0e}" +
      "#tilo-ai-msgs .b{max-width:88%;padding:10px 12px;border-radius:16px;font-size:13.5px;line-height:1.75;white-space:pre-wrap;word-break:break-word}" +
      "#tilo-ai-msgs .me{align-self:flex-end;background:#2d5a47;color:#fff;border-bottom-left-radius:6px}" +
      "#tilo-ai-msgs .bot{align-self:flex-start;background:#18241f;border:1px solid #2f453c;color:#e8f0eb;border-bottom-right-radius:6px}" +
      "#tilo-ai-msgs .err{align-self:stretch;background:#2a1c1c;border:1px solid #7f1d1d;color:#fecaca;font-size:12.5px}" +
      "#tilo-ai-model,#tilo-ai-provider{direction:ltr;text-align:left}";
    document.head.appendChild(style);

    var tab = document.createElement("button");
    tab.id = "tilo-ai-tab";
    tab.type = "button";
    tab.textContent = "»";
    css(tab, {
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
      boxShadow: "-4px 0 18px rgba(0,0,0,.5)"
    });

    var fab = document.createElement("button");
    fab.id = "tilo-ai-fab";
    fab.type = "button";
    fab.setAttribute("data-tilo-ai-open", "1");
    fab.innerHTML = "🤖";
    css(fab, {
      position: "fixed",
      left: "12px",
      bottom: "calc(6.5rem + env(safe-area-inset-bottom,0px))",
      zIndex: "2147483645",
      width: "48px",
      height: "48px",
      borderRadius: "14px",
      border: "1px solid #3d5c4f",
      background: "#1f2d27",
      color: "#d1fae5",
      fontSize: "18px",
      cursor: "pointer",
      boxShadow: "0 8px 20px rgba(0,0,0,.4)"
    });

    var drawer = document.createElement("aside");
    drawer.id = "tilo-ai-drawer";
    css(drawer, {
      position: "fixed",
      top: "0",
      right: "0",
      width: "min(100vw, 400px)",
      height: "100%",
      maxHeight: "100dvh",
      zIndex: "2147483647",
      background: "#0e1613",
      color: "#e2ebe5",
      borderLeft: "1px solid #2f453c",
      display: "flex",
      flexDirection: "column",
      transform: "translateX(110%)",
      transition: "transform .2s ease",
      boxShadow: "-12px 0 40px rgba(0,0,0,.5)",
      direction: "rtl",
      fontFamily: "inherit"
    });

    drawer.innerHTML =
      '<header style="padding:12px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));background:#15201b;border-bottom:1px solid #2f453c">' +
      '<div class="ai-row" style="justify-content:space-between">' +
      '<div><div style="font-weight:800;color:#6ee7b7;font-size:15px">دستیار tilo <button type="button" data-ai="help" style="width:26px;height:26px;border-radius:50%;border:1px solid #3d5c4f;background:#1f2d27;color:#a7f3d0;cursor:pointer;font-weight:800">؟</button></div>' +
      '<div style="font-size:10px;color:#8fa89b;margin-top:2px">چت · تمرین · تقویم</div></div>' +
      '<div class="ai-row" style="flex-wrap:wrap;justify-content:flex-end">' +
      '<button type="button" data-ai="new" class="ico">＋</button>' +
      '<button type="button" data-ai="arch" class="ico">📁</button>' +
      '<button type="button" data-ai="mem" class="ico">🧠</button>' +
      '<button type="button" data-ai="set" class="ico">⚙️</button>' +
      '<button type="button" data-ai="restore" class="ico" style="color:#6ee7b7">↩︎</button>' +
      '<button type="button" id="tilo-ai-close" class="ico">✕</button></div></div>' +
      '<div class="ai-row" style="margin-top:10px;justify-content:space-between">' +
      '<label style="font-size:12px;display:flex;gap:8px;align-items:center;cursor:pointer">' +
      '<input type="checkbox" id="tilo-ai-practice" /> حالت <b style="color:#fde68a">تمرین</b></label>' +
      '<span id="tilo-ai-badge" class="ai-chip">عادی</span></div></header>' +
      '<div style="padding:8px 12px;display:flex;gap:8px;border-bottom:1px solid #2f453c;background:#101915">' +
      '<select id="tilo-ai-provider" style="flex:1;min-height:40px;background:#0e1613;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:6px;font-size:12px"></select>' +
      '<select id="tilo-ai-model" style="flex:1.15;min-height:40px;background:#0e1613;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:6px;font-size:11px"></select></div>' +
      '<div id="tilo-ai-panel-help" style="display:none;padding:12px;font-size:12px;line-height:1.8;color:#c5d5cc;background:#15201b;border-bottom:1px solid #2f453c;max-height:35vh;overflow:auto"></div>' +
      '<div id="tilo-ai-panel-set" style="display:none;padding:12px;background:#15201b;border-bottom:1px solid #2f453c;font-size:12px">' +
      '<div style="color:#6ee7b7;font-weight:700;margin-bottom:8px">مدیریت API</div>' +
      '<select id="tilo-ai-preset" style="width:100%;min-height:38px;margin-bottom:6px;background:#0e1613;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px"></select>' +
      '<div id="tilo-ai-hint" style="color:#8fa89b;font-size:10px;margin-bottom:8px"></div>' +
      '<input id="tilo-ai-key" type="password" placeholder="کلید API را بچسبان" dir="ltr" style="width:100%;min-height:40px;margin-bottom:8px;background:#0e1613;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:8px" />' +
      '<div style="display:flex;gap:8px">' +
      '<button type="button" data-ai="add" style="flex:1;min-height:40px;border:0;border-radius:10px;background:#2d5a47;color:#fff;font-weight:700;cursor:pointer">ذخیره</button>' +
      '<button type="button" data-ai="del" style="flex:1;min-height:40px;border:1px solid #5c3a3a;border-radius:10px;background:#2a1c1c;color:#f5c2c2;cursor:pointer">حذف فعال</button></div>' +
      '<button type="button" data-ai="ping" style="width:100%;margin-top:8px;min-height:36px;border:1px solid #2f453c;border-radius:10px;background:#1f2d27;color:#a7f3d0;cursor:pointer">تست اتصال شبکه / API</button></div>' +
      '<div id="tilo-ai-panel-mem" style="display:none;padding:12px;background:#15201b;border-bottom:1px solid #2f453c">' +
      '<textarea id="tilo-ai-mem-notes" rows="3" placeholder="حافظه مشترک: رشته، هدف، ضعف..." style="width:100%;background:#0e1613;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:8px;font-size:13px"></textarea>' +
      '<button type="button" data-ai="savemem" style="width:100%;margin-top:8px;min-height:36px;border:0;border-radius:10px;background:#2d5a47;color:#fff;cursor:pointer">ذخیره حافظه</button></div>' +
      '<div id="tilo-ai-panel-arch" style="display:none;flex:1;overflow:auto;padding:12px"></div>' +
      '<div id="tilo-ai-msgs" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px"></div>' +
      '<footer style="padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid #2f453c;background:#15201b">' +
      '<textarea id="tilo-ai-input" rows="2" placeholder="پیام…" style="width:100%;min-height:46px;background:#0e1613;color:#e2e8f0;border:1px solid #2c3e35;border-radius:12px;padding:10px;font-size:14px"></textarea>' +
      '<button type="button" id="tilo-ai-send" style="width:100%;margin-top:8px;min-height:44px;border:0;border-radius:12px;background:#2d5a47;color:#fff;font-weight:700;cursor:pointer">ارسال</button></footer>';

    var icoCss = document.createElement("style");
    icoCss.textContent =
      "#tilo-ai-drawer .ico{min-width:32px;min-height:32px;padding:4px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer;font-size:13px}";
    document.head.appendChild(icoCss);

    document.body.appendChild(tab);
    document.body.appendChild(fab);
    document.body.appendChild(drawer);

    document.getElementById("tilo-ai-panel-help").innerHTML =
      "<b style='color:#6ee7b7'>اگر «Failed to fetch» دیدی</b><br>" +
      "۱) اینترنت را چک کن (در اسکرین‌شات سرعت ۰ بود)<br>" +
      "۲) برای Gemini معمولاً در ایران به <b>VPN</b> نیاز است<br>" +
      "۳) کلید را از aistudio.google.com تازه بساز و در ⚙️ ذخیره کن<br>" +
      "۴) دکمه «تست اتصال» را بزن<br><br>" +
      "<b>حالت تمرین</b> = مدل جواب می‌دهد ولی تقویم را عوض نمی‌کند.<br>" +
      "<b>↩︎</b> = بازگردانی آخرین پشتیبان قبل از AI.";

    drawer.addEventListener(
      "click",
      function (e) {
        var b = e.target.closest("[data-ai]");
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        var a = b.getAttribute("data-ai");
        if (a === "new") newChat();
        else if (a === "help") toggle("tilo-ai-panel-help");
        else if (a === "set") {
          toggle("tilo-ai-panel-set");
          fillPresets();
        } else if (a === "mem") {
          toggle("tilo-ai-panel-mem");
          document.getElementById("tilo-ai-mem-notes").value = memory.notes || "";
        } else if (a === "arch") showArch();
        else if (a === "add") addKey();
        else if (a === "del") delKey();
        else if (a === "restore") restoreBackup();
        else if (a === "savemem") {
          memory.notes = document.getElementById("tilo-ai-mem-notes").value || "";
          jset(LS.memory, memory);
          push("bot", "حافظه ذخیره شد.");
        } else if (a === "ping") ping();
      },
      true
    );

    document.getElementById("tilo-ai-practice").checked = practiceMode;
    document.getElementById("tilo-ai-practice").onchange = function () {
      practiceMode = !!this.checked;
      sset(LS.practice, practiceMode ? "1" : "0");
      badge();
      push("bot", practiceMode ? "تمرین روشن — تقویم ذخیره نمی‌شود." : "حالت عادی.");
    };
    document.getElementById("tilo-ai-send").onclick = function (e) {
      e.preventDefault();
      doSend();
    };
    document.getElementById("tilo-ai-input").onkeydown = function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    };
    document.getElementById("tilo-ai-provider").onchange = function () {
      sset(LS.active, this.value);
      fillModels();
    };
    document.getElementById("tilo-ai-model").onchange = function () {
      var p = activeProvider();
      if (!p) return;
      p.model = this.value;
      saveProviders(
        loadProviders().map(function (x) {
          return x.id === p.id ? p : x;
        })
      );
    };
    document.getElementById("tilo-ai-preset").onchange = function () {
      var id = this.value;
      var h = document.getElementById("tilo-ai-hint");
      for (var i = 0; i < PRESETS.length; i++)
        if (PRESETS[i].id === id) {
          h.textContent = PRESETS[i].hint;
          return;
        }
    };

    fillProviders();
    fillModels();
    badge();
    paint();
    if (!chat.length) {
      push(
        "bot",
        "سلام. اول اینترنت/VPN را چک کن، بعد ⚙️ کلید بگذار.\nاگر Failed to fetch دیدی → ؟ و «تست اتصال»."
      );
    }
  }

  function toggle(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var on = el.style.display === "none" || !el.style.display;
    ["tilo-ai-panel-help", "tilo-ai-panel-set", "tilo-ai-panel-mem", "tilo-ai-panel-arch"].forEach(
      function (x) {
        var n = document.getElementById(x);
        if (n) n.style.display = "none";
      }
    );
    document.getElementById("tilo-ai-msgs").style.display = "flex";
    if (on) {
      el.style.display = "block";
      if (id === "tilo-ai-panel-arch") document.getElementById("tilo-ai-msgs").style.display = "none";
    }
  }

  function badge() {
    var b = document.getElementById("tilo-ai-badge");
    if (!b) return;
    b.textContent = practiceMode ? "تمرین" : "عادی";
    b.className = "ai-chip" + (practiceMode ? " warn" : "");
  }

  function push(role, text) {
    chat.push({ role: role, text: String(text) });
    jset(LS.chat, chat.slice(-50));
    paint();
  }
  function paint() {
    var box = document.getElementById("tilo-ai-msgs");
    if (!box) return;
    box.innerHTML = "";
    chat.forEach(function (m) {
      var d = document.createElement("div");
      d.className = "b " + (m.role === "me" ? "me" : m.role === "err" ? "err" : "bot");
      d.textContent = m.text;
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }

  function fillProviders() {
    var s = document.getElementById("tilo-ai-provider");
    if (!s) return;
    var list = loadProviders();
    s.innerHTML = "";
    if (!list.length) {
      s.innerHTML = '<option value="">بدون کلید — ⚙️</option>';
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
    if (p && p.model) {
      try {
        s.value = p.model;
      } catch (e) {}
    }
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
    document.getElementById("tilo-ai-hint").textContent = PRESETS[0].hint;
  }

  function addKey() {
    var presetId = document.getElementById("tilo-ai-preset").value;
    var key = String(document.getElementById("tilo-ai-key").value || "").trim();
    if (key.length < 20) {
      alert("کلید کامل نیست");
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
    document.getElementById("tilo-ai-key").value = "";
    fillProviders();
    fillModels();
    push("bot", "کلید " + preset.name + " ذخیره شد. مدل را از لیست انتخاب کن.");
  }
  function delKey() {
    var p = activeProvider();
    if (!p) return alert("کلیدی نیست");
    if (!confirm("حذف «" + p.name + "»؟")) return;
    var list = loadProviders().filter(function (x) {
      return x.id !== p.id;
    });
    saveProviders(list);
    if (list[0]) sset(LS.active, list[0].id);
    fillProviders();
    fillModels();
    push("bot", "کلید حذف شد.");
  }

  function newChat() {
    if (chat.length && !confirm("چت جدید؟")) return;
    if (chat.length) {
      var all = jget(LS.sessions, []);
      if (!Array.isArray(all)) all = [];
      all.unshift({ at: new Date().toISOString(), messages: chat.slice() });
      jset(LS.sessions, all.slice(0, 20));
    }
    chat = [];
    jset(LS.chat, chat);
    paint();
  }
  function showArch() {
    toggle("tilo-ai-panel-arch");
    var a = document.getElementById("tilo-ai-panel-arch");
    var all = jget(LS.sessions, []);
    a.innerHTML = "<b style='color:#6ee7b7'>بایگانی</b>";
    if (!all.length) {
      a.innerHTML += "<p style='color:#8fa89b;font-size:12px'>خالی</p>";
      return;
    }
    all.forEach(function (s, i) {
      var row = document.createElement("div");
      row.style.cssText =
        "margin-top:8px;padding:8px;border:1px solid #2f453c;border-radius:10px;font-size:12px";
      row.textContent = String(s.at || "").slice(0, 19) + " · " + (s.messages || []).length + " پیام";
      var btn = document.createElement("button");
      btn.textContent = "باز";
      btn.style.cssText = "margin-right:8px;cursor:pointer";
      btn.onclick = function () {
        chat = (s.messages || []).slice();
        jset(LS.chat, chat);
        a.style.display = "none";
        document.getElementById("tilo-ai-msgs").style.display = "flex";
        paint();
      };
      row.appendChild(btn);
      a.appendChild(row);
    });
  }

  function snapshot() {
    return (
      sget(LS.data) ||
      JSON.stringify({ version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} })
    );
  }
  function wantsCal(t) {
    return /تایم[\s\-]?بلاک|تقویم|پارت|بلاک|برنامه\s*(روز|فردا|امروز)|جابه‌جا|حذف کن|اضافه کن|بساز|تأخیر/i.test(
      String(t || "")
    );
  }
  function extractJson(raw) {
    var text = String(raw || "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    var a = text.indexOf("{");
    var b = text.lastIndexOf("}");
    return a >= 0 && b > a ? text.slice(a, b + 1) : text;
  }
  function validate(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("JSON نامعتبر");
    if (!Array.isArray(obj.blocks)) throw new Error("blocks نیست");
    return obj;
  }
  function safeApply(obj, oldRaw) {
    var oldC = 0,
      newC = 0;
    try {
      oldC = (JSON.parse(oldRaw).blocks || []).length;
    } catch (e) {}
    newC = (obj.blocks || []).length;
    if (oldC > 0 && newC === 0) throw new Error("مدل همه را خالی کرد — ذخیره نشد");
    if (oldC >= 4 && newC < oldC * 0.4 && !confirm("بلاک‌ها خیلی کم می‌شوند. ادامه؟"))
      throw new Error("لغو شد");
    return validate(obj);
  }
  function restoreBackup() {
    var bak = sget(LS.backup);
    if (!bak) return alert("پشتیبان AI نیست");
    if (!confirm("بازگردانی؟")) return;
    sset(LS.data, bak);
    push("bot", "بازگردانی شد. رفرش…");
    setTimeout(function () {
      location.reload();
    }, 400);
  }

  function friendlyErr(err) {
    var m = String((err && err.message) || err || "");
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) {
      return (
        "اتصال به سرور مدل برقرار نشد (Failed to fetch).\n\n" +
        "• اینترنت گوشی را چک کن (الان ممکن است قطع/ضعیف باشد)\n" +
        "• برای Gemini معمولاً VPN لازم است\n" +
        "• یا از OpenRouter/Groq با VPN مناسب امتحان کن\n" +
        "• دکمه «تست اتصال» در ⚙️"
      );
    }
    if (/API key|invalid|401|403/i.test(m)) return "کلید API رد شد. از ⚙️ کلید جدید بگذار.";
    if (/429|quota|rate/i.test(m)) return "سقف رایگان مدل پر شده. بعداً یا مدل دیگر.";
    return m;
  }

  async function ping() {
    push("bot", "در حال تست…");
    if (!navigator.onLine) {
      push("err", "مرورگر آفلاین است (navigator.onLine=false).");
      return;
    }
    var p = activeProvider();
    if (!p || !p.key) {
      push("err", "اول کلید بگذار.");
      return;
    }
    try {
      if (p.type === "gemini") {
        await callGemini(p, [{ role: "user", parts: [{ text: "فقط بگو: ok" }] }], false);
      } else {
        await callOpenAI(p, [{ role: "user", content: "say ok" }]);
      }
      push("bot", "اتصال OK — مدل پاسخ داد.");
    } catch (e) {
      push("err", friendlyErr(e));
    }
  }

  async function callGemini(p, contents, jsonMode) {
    var model =
      (document.getElementById("tilo-ai-model") || {}).value || p.model || "gemini-3.5-flash-lite";
    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(model) +
      ":generateContent?key=" +
      encodeURIComponent(p.key);
    var ctrl = new AbortController();
    var timer = setTimeout(function () {
      ctrl.abort();
    }, 45000);
    try {
      var res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: jsonMode ? 0.15 : 0.4,
            maxOutputTokens: 8192,
            responseMimeType: jsonMode ? "application/json" : undefined
          }
        }),
        signal: ctrl.signal
      });
      var data = await res.json();
      if (!res.ok || data.error)
        throw new Error((data.error && data.error.message) || "HTTP " + res.status);
      var t =
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0] &&
        data.candidates[0].content.parts[0].text;
      if (!t) throw new Error("پاسخ خالی");
      return t;
    } finally {
      clearTimeout(timer);
    }
  }
  async function callOpenAI(p, messages) {
    var model = (document.getElementById("tilo-ai-model") || {}).value || p.model;
    var headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + p.key
    };
    if ((p.base || "").indexOf("openrouter") >= 0) {
      headers["HTTP-Referer"] = location.origin;
      headers["X-Title"] = "tilo";
    }
    var res = await fetch(String(p.base).replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: headers,
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
      toggle("tilo-ai-panel-set");
      fillPresets();
      return alert("اول کلید API را در ⚙️ ذخیره کن");
    }
    if (!navigator.onLine) {
      push("err", "آفلاین هستی. اینترنت را روشن کن.");
      return;
    }
    push("me", text);
    if (input) input.value = "";
    busy = true;
    if (send) {
      send.disabled = true;
      send.textContent = "…";
    }
    try {
      var cal = wantsCal(text);
      if (cal && practiceMode) {
        var pr =
          "حالت تمرین. تقویم را عوض نکن؛ فقط پیشنهاد فارسی بده.\nحافظه:\n" +
          (memory.notes || "—") +
          "\nداده:\n" +
          snapshot() +
          "\nدرخواست:\n" +
          text;
        var ans =
          p.type === "gemini"
            ? await callGemini(p, [{ role: "user", parts: [{ text: pr }] }], false)
            : await callOpenAI(p, [
                { role: "system", content: "practice mode tilo" },
                { role: "user", content: pr }
              ]);
        push("bot", ans + "\n\n⚠️ تمرین: ذخیره نشد.");
        return;
      }
      if (cal && !practiceMode) {
        var before = snapshot();
        var cp =
          "فقط JSON تقویم tilo. حافظه:" +
          (memory.notes || "") +
          "\n" +
          before +
          "\nدستور:" +
          text;
        var raw =
          p.type === "gemini"
            ? await callGemini(p, [{ role: "user", parts: [{ text: cp }] }], true)
            : await callOpenAI(p, [
                { role: "system", content: "JSON only" },
                { role: "user", content: cp }
              ]);
        var parsed = safeApply(JSON.parse(extractJson(raw)), before);
        parsed.updatedAt = new Date().toISOString();
        sset(LS.backup, before);
        sset(LS.data, JSON.stringify(parsed));
        push("bot", "تقویم ذخیره شد. رفرش…");
        setTimeout(function () {
          location.reload();
        }, 500);
        return;
      }
      if (p.type === "gemini") {
        var contents = [
          {
            role: "user",
            parts: [
              {
                text: "دستیار tilo فارسی. حافظه:\n" + (memory.notes || "—") + "\nکوتاه جواب بده."
              }
            ]
          }
        ];
        chat.slice(-8).forEach(function (m) {
          if (m.role === "err") return;
          contents.push({
            role: m.role === "me" ? "user" : "model",
            parts: [{ text: m.text }]
          });
        });
        contents.push({ role: "user", parts: [{ text: text }] });
        push("bot", await callGemini(p, contents, false));
      } else {
        var messages = [
          { role: "system", content: "دستیار tilo. حافظه: " + (memory.notes || "—") }
        ];
        chat.slice(-8).forEach(function (m) {
          if (m.role === "err") return;
          messages.push({
            role: m.role === "me" ? "user" : "assistant",
            content: m.text
          });
        });
        messages.push({ role: "user", content: text });
        push("bot", await callOpenAI(p, messages));
      }
    } catch (err) {
      push("err", friendlyErr(err));
    } finally {
      busy = false;
      if (send) {
        send.disabled = false;
        send.textContent = "ارسال";
      }
    }
  }

  function injectMartell() {
    var root = document.getElementById("tilo-martell");
    if (!root) return;
    var btn = document.getElementById("tilo-ai-martell-btn");
    if (btn) {
      btn.style.display = root.hidden ? "none" : "";
      return;
    }
    var bar = root.querySelector(".tm-top .tm-row") || root.querySelector(".tm-top");
    if (!bar) return;
    btn = document.createElement("button");
    btn.id = "tilo-ai-martell-btn";
    btn.type = "button";
    btn.setAttribute("data-tilo-ai-open", "1");
    btn.textContent = "🤖 دستیار";
    css(btn, {
      minHeight: "36px",
      padding: "6px 10px",
      borderRadius: "10px",
      border: "1px solid #2d5a47",
      background: "#2d5a47",
      color: "#fff",
      fontWeight: "700",
      fontSize: "12px",
      cursor: "pointer",
      zIndex: "30",
      position: "relative"
    });
    try {
      bar.insertBefore(btn, bar.firstChild);
    } catch (e) {
      bar.appendChild(btn);
    }
  }

  function boot() {
    try {
      buildUI();
      injectMartell();
    } catch (e) {
      console.warn("[tilo-ai]", e);
    }
  }
  boot();
  document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1200);
  setInterval(injectMartell, 1000);
})();
