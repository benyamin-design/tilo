/**
 * tilo-ai-agent.js v8 — دستیار tilo
 * - زبانه » + FAB + دکمه داخل تایم‌بلاک (رفع باگ نمایش)
 * - حالت تمرین (بدون نوشتن روی تقویم)
 * - چند API: Gemini / Grok(xAI) / OpenRouter / Groq — حذف و افزودن
 * - حافظه مشترک بین همه مدل‌ها
 * - راهنمای مبتدی با ؟
 * - بازگردانی پشتیبان + محافظت از پاک شدن
 *
 * نصب: <script src="./tilo-ai-agent.js?v=8"></script>
 */
(function () {
  "use strict";
  if (window.__tiloAiV8) return;
  window.__tiloAiV8 = true;

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

  /* مدل‌های پیشنهادی — Nov 2026 (ممکن است در پنل ارائه‌دهنده عوض شوند) */
  var PRESETS = [
    {
      id: "gemini",
      name: "Google Gemini",
      type: "gemini",
      hint: "رایگان با سقف — aistudio.google.com",
      models: [
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-flash-latest",
        "gemini-3.1-flash-lite"
      ]
    },
    {
      id: "xai",
      name: "Grok (xAI)",
      type: "openai",
      base: "https://api.x.ai/v1",
      hint: "پولی — console.x.ai — API Key",
      models: ["grok-4.3", "grok-4-fast", "grok-3-mini", "grok-code-fast-1"]
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      type: "openai",
      base: "https://openrouter.ai/api/v1",
      hint: "رایگان محدود :free — openrouter.ai/keys",
      models: [
        "google/gemma-4-31b-it:free",
        "google/gemma-4-26b-a4b-it:free",
        "nvidia/nemotron-3.5-lightning:free",
        "openrouter/free"
      ]
    },
    {
      id: "groq",
      name: "Groq",
      type: "openai",
      base: "https://api.groq.com/openai/v1",
      hint: "سریع — console.groq.com",
      models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    }
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
    var d = document.getElementById("tilo-ai-drawer");
    var t = document.getElementById("tilo-ai-tab");
    if (!d) {
      buildUI();
      d = document.getElementById("tilo-ai-drawer");
    }
    if (!d) return;
    d.style.transform = "translateX(0)";
    d.style.visibility = "visible";
    isOpen = true;
    if (t) {
      t.textContent = "«";
      t.setAttribute("aria-expanded", "true");
    }
    syncPracticeUI();
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

  window.tiloAI = { open: openPanel, close: closePanel, toggle: togglePanel };

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
    if (!document.body) return;

    var tab = document.createElement("button");
    tab.id = "tilo-ai-tab";
    tab.type = "button";
    tab.textContent = "»";
    tab.setAttribute("aria-label", "دستیار tilo");
    tab.style.cssText =
      "position:fixed;top:38%;right:0;z-index:2147483646;margin:0;padding:18px 11px;" +
      "border:none;border-radius:14px 0 0 14px;background:#2d5a47;color:#ecfdf5;" +
      "font-size:22px;font-weight:800;cursor:pointer;box-shadow:-4px 0 18px rgba(0,0,0,.5);" +
      "pointer-events:auto;display:block !important";

    var fab = document.createElement("button");
    fab.id = "tilo-ai-fab";
    fab.type = "button";
    fab.setAttribute("data-tilo-ai-open", "1");
    fab.innerHTML = "🤖<span style='font-size:9px;display:block;margin-top:2px'>دستیار</span>";
    fab.style.cssText =
      "position:fixed;left:12px;bottom:calc(6.5rem + env(safe-area-inset-bottom,0px));z-index:2147483645;" +
      "width:52px;height:52px;border-radius:16px;border:1px solid #3d5c4f;background:#1f2d27;color:#d1fae5;" +
      "font-size:15px;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.45);line-height:1.1;padding:6px 0";

    var drawer = document.createElement("aside");
    drawer.id = "tilo-ai-drawer";
    drawer.style.cssText =
      "position:fixed;top:0;right:0;width:min(100vw,420px);height:100%;max-height:100dvh;" +
      "z-index:2147483647;background:#0f1a16;color:#e2ebe5;border-left:1px solid #2f453c;" +
      "display:flex;flex-direction:column;transform:translateX(110%);transition:transform .22s ease;" +
      "box-shadow:-16px 0 48px rgba(0,0,0,.55);direction:rtl;font-family:inherit;pointer-events:auto";

    drawer.innerHTML =
      '<div style="padding:12px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));border-bottom:1px solid #2f453c;background:linear-gradient(180deg,#1a2a24,#15201b)">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
      '<div style="min-width:0"><div style="display:flex;align-items:center;gap:6px">' +
      '<span style="color:#6ee7b7;font-weight:800;font-size:15px">دستیار tilo</span>' +
      '<button type="button" data-ai-act="help" title="راهنما" style="width:28px;height:28px;border-radius:999px;border:1px solid #3d5c4f;background:#1f2d27;color:#a7f3d0;font-weight:800;cursor:pointer;font-size:13px">؟</button>' +
      "</div>" +
      '<div style="color:#8fa89b;font-size:10px;margin-top:3px">چت · تقویم · تمرین · حافظه مشترک</div></div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">' +
      '<button type="button" data-ai-act="new" title="چت جدید" style="min-height:32px;padding:5px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">＋</button>' +
      '<button type="button" data-ai-act="arch" title="بایگانی" style="min-height:32px;padding:5px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">📁</button>' +
      '<button type="button" data-ai-act="mem" title="حافظه" style="min-height:32px;padding:5px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">🧠</button>' +
      '<button type="button" data-ai-act="set" title="API و مدل" style="min-height:32px;padding:5px 8px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">⚙️</button>' +
      '<button type="button" data-ai-act="restore" title="بازگردانی پشتیبان" style="min-height:32px;padding:5px 8px;border-radius:10px;border:1px solid #3d5c4f;background:#1f2d27;color:#6ee7b7;cursor:pointer">↩︎</button>' +
      '<button type="button" id="tilo-ai-close" style="min-height:32px;width:32px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer">✕</button>' +
      "</div></div>" +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px">' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#c5d5cc;cursor:pointer">' +
      '<input type="checkbox" id="tilo-ai-practice" style="width:16px;height:16px;accent-color:#2d5a47" />' +
      '<span>حالت <b style="color:#fde68a">تمرین</b> <span style="color:#8fa89b">(تقویم ذخیره نمی‌شود)</span></span></label>' +
      '<span id="tilo-ai-mode-badge" style="font-size:10px;padding:3px 8px;border-radius:999px;border:1px solid #3d5c4f;color:#a7f3d0">عادی</span>' +
      "</div></div>" +
      '<div style="display:flex;gap:8px;padding:8px 12px;border-bottom:1px solid #2f453c;background:#121c18">' +
      '<select id="tilo-ai-provider" style="flex:1;min-height:36px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:4px 8px;font-size:12px"></select>' +
      '<select id="tilo-ai-model" style="flex:1.2;min-height:36px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:4px 8px;font-size:11px"></select>' +
      "</div>" +
      '<div id="tilo-ai-help" style="display:none;padding:12px;border-bottom:1px solid #2f453c;background:#15201b;font-size:12px;line-height:1.75;color:#c5d5cc;max-height:40vh;overflow:auto"></div>' +
      '<div id="tilo-ai-settings" style="display:none;padding:12px;border-bottom:1px solid #2f453c;background:#15201b;font-size:12px">' +
      '<div style="color:#6ee7b7;font-weight:700;margin-bottom:8px">مدیریت API</div>' +
      '<label style="color:#8fa89b;display:block;margin-bottom:4px">ارائه‌دهنده</label>' +
      '<select id="tilo-ai-preset" style="width:100%;min-height:36px;margin-bottom:8px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px"></select>' +
      '<div id="tilo-ai-preset-hint" style="color:#8fa89b;font-size:10px;margin:-4px 0 8px;line-height:1.5"></div>' +
      '<label style="color:#8fa89b;display:block;margin-bottom:4px">کلید API (فقط این دستگاه)</label>' +
      '<input id="tilo-ai-key-input" type="password" placeholder="کلید را بچسبان" dir="ltr" style="width:100%;box-sizing:border-box;min-height:38px;margin-bottom:8px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:8px" />' +
      '<div style="display:flex;gap:6px">' +
      '<button type="button" data-ai-act="addkey" style="flex:1;min-height:38px;border:0;border-radius:10px;background:#2d5a47;color:#fff;font-weight:700;cursor:pointer">افزودن / ذخیره</button>' +
      '<button type="button" data-ai-act="delkey" style="flex:1;min-height:38px;border:1px solid #5c3a3a;border-radius:10px;background:#2a1c1c;color:#f5c2c2;cursor:pointer">حذف کلید فعال</button>' +
      "</div>" +
      '<p style="color:#8fa89b;font-size:10px;margin:10px 0 0;line-height:1.6">کلید داخل سورس GitHub نیست. فقط localStorage همین مرورگر.</p></div>' +
      '<div id="tilo-ai-mem" style="display:none;padding:12px;border-bottom:1px solid #2f453c;background:#15201b">' +
      '<div style="color:#6ee7b7;font-weight:700;font-size:12px;margin-bottom:6px">حافظه مشترک (همه مدل‌ها)</div>' +
      '<textarea id="tilo-ai-mem-notes" rows="4" placeholder="رشته، پایه، هدف ساعت مطالعه، نقاط ضعف، سبک برنامه‌ریزی..." style="width:100%;box-sizing:border-box;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:8px;font-family:inherit;font-size:13px"></textarea>' +
      '<textarea id="tilo-ai-mem-style" rows="2" placeholder="ترجیحات: مثلاً استراحت ۱۵ دقیقه، ورزش عصر، سنگ بزرگ صبح" style="width:100%;box-sizing:border-box;margin-top:6px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:10px;padding:8px;font-family:inherit;font-size:13px"></textarea>' +
      '<button type="button" data-ai-act="savemem" style="width:100%;margin-top:8px;min-height:36px;border:0;border-radius:10px;background:#2d5a47;color:#fff;cursor:pointer">ذخیره حافظه</button></div>' +
      '<div id="tilo-ai-arch" style="display:none;flex:1;overflow:auto;padding:12px"></div>' +
      '<div id="tilo-ai-msgs" style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px"></div>' +
      '<div style="border-top:1px solid #2f453c;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));background:#15201b">' +
      '<textarea id="tilo-ai-input" rows="2" placeholder="سؤال بپرس یا دستور تقویم بده…" style="width:100%;box-sizing:border-box;min-height:48px;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:12px;padding:10px;font-size:14px;font-family:inherit"></textarea>' +
      '<button type="button" id="tilo-ai-send" style="width:100%;margin-top:8px;min-height:44px;border:0;border-radius:12px;background:#2d5a47;color:#fff;font-weight:700;font-size:14px;cursor:pointer">ارسال</button></div>';

    document.body.appendChild(tab);
    document.body.appendChild(fab);
    document.body.appendChild(drawer);

    document.getElementById("tilo-ai-help").innerHTML =
      "<b style='color:#6ee7b7'>راهنمای مبتدی — کلید API</b><br><br>" +
      "<b>۱) Google Gemini (پیشنهاد اول)</b><br>" +
      "برو به <span dir='ltr'>aistudio.google.com</span> → Get API key → کلید را کپی کن → اینجا ⚙️ → Google Gemini → ذخیره.<br>" +
      "مدل پیشنهادی روزانه: <span dir='ltr'>gemini-3.5-flash-lite</span><br><br>" +
      "<b>۲) OpenRouter (تست رایگان)</b><br>" +
      "<span dir='ltr'>openrouter.ai/keys</span> → مدل‌های <span dir='ltr'>:free</span> سقف روزانه دارند.<br><br>" +
      "<b>۳) Grok / xAI (پولی)</b><br>" +
      "<span dir='ltr'>console.x.ai</span> → API Key → ارائه‌دهنده Grok.<br><br>" +
      "<b>۴) حالت تمرین</b><br>" +
      "تیک «حالت تمرین» را بزن تا مدل فقط جواب بدهد و روی تایم‌بلاک چیزی ذخیره نشود — برای آموزش دستور دادن عالی است.<br><br>" +
      "<b>۵) اگر برنامه پاک شد</b><br>" +
      "دکمه ↩︎ یا پشتیبان martell → ورود فایل.";

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
        else if (act === "help") toggleHelp();
        else if (act === "addkey") addKey();
        else if (act === "delkey") delKey();
        else if (act === "restore") restoreBackup();
        else if (act === "savemem") {
          memory.notes = (document.getElementById("tilo-ai-mem-notes") || {}).value || "";
          memory.style = (document.getElementById("tilo-ai-mem-style") || {}).value || "";
          jset(LS.memory, memory);
          bot("حافظه مشترک ذخیره شد — برای همه مدل‌ها یکسان است.");
        }
      },
      true
    );

    document.getElementById("tilo-ai-practice").checked = practiceMode;
    document.getElementById("tilo-ai-practice").addEventListener("change", function () {
      practiceMode = !!this.checked;
      sset(LS.practice, practiceMode ? "1" : "0");
      syncPracticeUI();
      bot(
        practiceMode
          ? "حالت تمرین روشن: حتی اگر بگویی تقویم را عوض کند، ذخیره نمی‌شود."
          : "حالت عادی: دستورهای تقویم روی تایم‌بلاک اعمال می‌شوند (با محافظت)."
      );
    });

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
    document.getElementById("tilo-ai-preset").addEventListener("change", updatePresetHint);

    fillProviders();
    fillModels();
    fillPresets();
    syncPracticeUI();
    paint();
    if (!chat.length) {
      bot(
        "سلام — سه راه باز کردن: » راست · 🤖 چپ · داخل تایم‌بلاک «دستیار».\n" +
          "۱) ؟ راهنمای کلید API\n۲) ⚙️ افزودن کلید\n۳) برای آموزش: حالت تمرین را روشن کن\n۴) حافظه 🧠 بین همه مدل‌ها مشترک است."
      );
    }
  }

  function syncPracticeUI() {
    var badge = document.getElementById("tilo-ai-mode-badge");
    var cb = document.getElementById("tilo-ai-practice");
    if (cb) cb.checked = practiceMode;
    if (!badge) return;
    if (practiceMode) {
      badge.textContent = "تمرین";
      badge.style.color = "#fde68a";
      badge.style.borderColor = "#a16207";
    } else {
      badge.textContent = "عادی";
      badge.style.color = "#a7f3d0";
      badge.style.borderColor = "#3d5c4f";
    }
  }

  function injectMartell() {
    var root = document.getElementById("tilo-martell");
    if (!root) return;
    /* حتی اگر hidden باشد دکمه را آماده نگه می‌داریم */
    if (document.getElementById("tilo-ai-martell-btn")) {
      var existing = document.getElementById("tilo-ai-martell-btn");
      existing.style.display = root.hidden ? "none" : "";
      return;
    }
    var bar = root.querySelector(".tm-top .tm-row") || root.querySelector(".tm-top");
    if (!bar) return;
    var b = document.createElement("button");
    b.id = "tilo-ai-martell-btn";
    b.type = "button";
    b.setAttribute("data-tilo-ai-open", "1");
    b.textContent = "🤖 دستیار";
    b.style.cssText =
      "min-height:36px;padding:6px 10px;border-radius:10px;border:1px solid #2d5a47;" +
      "background:#2d5a47;color:#fff;font-weight:700;font-size:12px;cursor:pointer;" +
      "pointer-events:auto;position:relative;z-index:20;flex-shrink:0";
    try {
      bar.insertBefore(b, bar.firstChild);
    } catch (e) {
      bar.appendChild(b);
    }
    if (root.hidden) b.style.display = "none";
  }

  function bot(t) {
    chat.push({ role: "bot", text: String(t) });
    jset(LS.chat, chat.slice(-60));
    paint();
  }
  function me(t) {
    chat.push({ role: "me", text: String(t) });
    jset(LS.chat, chat.slice(-60));
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
  function toggleHelp() {
    var h = document.getElementById("tilo-ai-help");
    h.style.display = h.style.display === "none" || !h.style.display ? "block" : "none";
    document.getElementById("tilo-ai-settings").style.display = "none";
    document.getElementById("tilo-ai-mem").style.display = "none";
  }
  function toggleSet() {
    var p = document.getElementById("tilo-ai-settings");
    p.style.display = p.style.display === "none" || !p.style.display ? "block" : "none";
    document.getElementById("tilo-ai-help").style.display = "none";
    document.getElementById("tilo-ai-mem").style.display = "none";
    if (p.style.display === "block") updatePresetHint();
  }
  function toggleMem() {
    var p = document.getElementById("tilo-ai-mem");
    var show = p.style.display === "none" || !p.style.display;
    p.style.display = show ? "block" : "none";
    document.getElementById("tilo-ai-settings").style.display = "none";
    document.getElementById("tilo-ai-help").style.display = "none";
    if (show) {
      document.getElementById("tilo-ai-mem-notes").value = memory.notes || "";
      document.getElementById("tilo-ai-mem-style").value = memory.style || "";
    }
  }
  function toggleArch() {
    var a = document.getElementById("tilo-ai-arch");
    var m = document.getElementById("tilo-ai-msgs");
    var show = a.style.display === "none" || !a.style.display;
    a.style.display = show ? "block" : "none";
    m.style.display = show ? "none" : "flex";
    document.getElementById("tilo-ai-settings").style.display = "none";
    document.getElementById("tilo-ai-mem").style.display = "none";
    document.getElementById("tilo-ai-help").style.display = "none";
    if (!show) return;
    var all = jget(LS.sessions, []);
    a.innerHTML = '<div style="color:#6ee7b7;font-weight:700;margin-bottom:8px">بایگانی چت‌ها</div>';
    if (!all.length) {
      a.innerHTML += '<div style="color:#8fa89b;font-size:12px">خالی است.</div>';
      return;
    }
    all.forEach(function (s, idx) {
      var row = document.createElement("div");
      row.style.cssText =
        "border:1px solid #2f453c;border-radius:12px;padding:10px;margin-bottom:8px;background:#1b2822";
      row.innerHTML =
        '<div style="font-size:12px;margin-bottom:6px">' +
        String(s.at || "").slice(0, 19) +
        " · " +
        (s.messages || []).length +
        " پیام</div>";
      var o = document.createElement("button");
      o.textContent = "باز کردن";
      o.style.cssText =
        "margin-left:6px;min-height:32px;padding:4px 8px;border-radius:8px;border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;cursor:pointer";
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
    updatePresetHint();
  }
  function updatePresetHint() {
    var id = (document.getElementById("tilo-ai-preset") || {}).value;
    var hint = document.getElementById("tilo-ai-preset-hint");
    if (!hint) return;
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id === id) {
        hint.textContent = PRESETS[i].hint || "";
        return;
      }
    }
    hint.textContent = "";
  }
  function fillProviders() {
    var s = document.getElementById("tilo-ai-provider");
    if (!s) return;
    var list = loadProviders();
    s.innerHTML = "";
    if (!list.length) {
      var o = document.createElement("option");
      o.value = "";
      o.textContent = "بدون کلید — ⚙️ اضافه کن";
      s.appendChild(o);
      return;
    }
    list.forEach(function (p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = (p.name || p.preset) + (p.model ? " · " + p.model.split("/").pop() : "");
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
      alert("کلید را کامل وارد کن");
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
    bot("کلید «" + preset.name + "» اضافه شد. مدل را از لیست بالا انتخاب کن.");
  }
  function delKey() {
    var p = activeProvider();
    if (!p) {
      alert("کلید فعالی نیست");
      return;
    }
    if (!confirm("کلید «" + (p.name || "") + "» حذف شود؟")) return;
    var list = loadProviders().filter(function (x) {
      return x.id !== p.id;
    });
    saveProviders(list);
    if (list[0]) sset(LS.active, list[0].id);
    else
      try {
        localStorage.removeItem(LS.active);
      } catch (e) {}
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
  function countBlocks(raw) {
    try {
      var o = typeof raw === "string" ? JSON.parse(raw) : raw;
      return o && Array.isArray(o.blocks) ? o.blocks.length : 0;
    } catch (e) {
      return 0;
    }
  }
  function validate(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("JSON آبجکت نیست");
    if (!Array.isArray(obj.blocks)) throw new Error("blocks نیست");
    obj.blocks.forEach(function (b, i) {
      if (!b || !b.id) throw new Error("بلاک " + i + " بدون id");
      if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) throw new Error("تاریخ بلاک " + i);
      if (b.start != null && b.end != null) {
        var s = +b.start,
          e = +b.end;
        if (!(s >= 0 && e > s && e <= 1440)) throw new Error("ساعت «" + (b.title || i) + "»");
      }
    });
    if (obj.version == null) obj.version = 1;
    if (!Array.isArray(obj.trash)) obj.trash = [];
    if (!obj.finalized) obj.finalized = {};
    return obj;
  }
  function safeApply(newObj, oldRaw) {
    var oldCount = countBlocks(oldRaw);
    var newCount = countBlocks(newObj);
    if (oldCount > 0 && newCount === 0) {
      throw new Error("مدل همه را خالی کرد — ذخیره نشد. از حالت تمرین استفاده کن یا دستور جزئی بده.");
    }
    if (oldCount >= 4 && newCount < Math.ceil(oldCount * 0.4)) {
      if (
        !confirm(
          "تعداد بلاک از " + oldCount + " به " + newCount + " می‌رسد. ذخیره شود؟\nلغو = هیچ تغییری نیست."
        )
      ) {
        throw new Error("ذخیره لغو شد.");
      }
    }
    return validate(newObj);
  }
  function extractJson(raw) {
    var text = String(raw || "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    var a = text.indexOf("{");
    var b = text.lastIndexOf("}");
    if (a >= 0 && b > a) return text.slice(a, b + 1);
    return text;
  }
  function restoreBackup() {
    var bak = sget(LS.backup);
    if (!bak) {
      alert("پشتیبان AI نیست. از دکمه «ورود فایل» در تایم‌بلاک استفاده کن.");
      return;
    }
    if (!confirm("تقویم از پشتیبان قبل از آخرین دستور AI برگردد؟")) return;
    try {
      validate(JSON.parse(bak));
      sset(LS.data, bak);
      bot("بازگردانی شد. رفرش…");
      setTimeout(function () {
        location.reload();
      }, 400);
    } catch (e) {
      alert("پشتیبان خراب: " + (e.message || e));
    }
  }
  function wantsCal(t) {
    return /تایم[\s\-]?بلاک|تقویم|پارت|بلاک|برنامه\s*(روز|فردا|امروز|هفته)|جابه‌جا|حذف کن|اضافه کن|بساز|تأخیر|ساعت\s*\d/i.test(
      String(t || "")
    );
  }
  function memoryBlock() {
    return (
      "حافظه کاربر (مشترک):\n" +
      (memory.notes || "—") +
      "\nترجیحات:\n" +
      (memory.style || "—")
    );
  }

  async function callGemini(p, contents, jsonMode) {
    var model =
      (document.getElementById("tilo-ai-model") || {}).value || p.model || "gemini-3.5-flash-lite";
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
  async function callOpenAI(p, messages) {
    var model = (document.getElementById("tilo-ai-model") || {}).value || p.model;
    var headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + p.key
    };
    if (p.preset === "openrouter" || (p.base && p.base.indexOf("openrouter") >= 0)) {
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
      document.getElementById("tilo-ai-settings").style.display = "block";
      alert("اول از ⚙️ یک کلید اضافه کن. راهنما: ؟");
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

      if (cal && practiceMode) {
        /* تمرین: پیشنهاد بده، ذخیره نکن */
        var practicePrompt =
          "حالت تمرین tilo. تقویم را تغییر نده؛ فقط پیشنهاد بده و JSON نمونه را داخل بلوک کد نشان بده.\n" +
          memoryBlock() +
          "\nدیتای فعلی:\n" +
          snapshot() +
          "\nدرخواست:\n" +
          text;
        if (p.type === "gemini") {
          bot(
            await callGemini(
              p,
              [{ role: "user", parts: [{ text: practicePrompt }] }],
              false
            )
          );
        } else {
          bot(
            await callOpenAI(p, [
              { role: "system", content: "حالت تمرین tilo — ذخیره نکن، فقط راهنما و JSON نمونه." },
              { role: "user", content: practicePrompt }
            ])
          );
        }
        bot("⚠️ حالت تمرین: هیچ چیزی روی تقویم ذخیره نشد.");
        return;
      }

      if (cal && !practiceMode) {
        var before = snapshot();
        var calPrompt =
          "فقط JSON معتبر تقویم tilo برگردان. بدون توضیح.\n" +
          memoryBlock() +
          "\nساختار blocks با id,date,title,note,category,color,start,end,done,domino\nدیتا:\n" +
          before +
          "\nدستور:\n" +
          text;
        var raw;
        if (p.type === "gemini") {
          raw = await callGemini(p, [{ role: "user", parts: [{ text: calPrompt }] }], true);
        } else {
          raw = await callOpenAI(p, [
            { role: "system", content: "Only output valid JSON for tilo calendar." },
            { role: "user", content: calPrompt }
          ]);
        }
        var parsed = safeApply(JSON.parse(extractJson(raw)), before);
        parsed.updatedAt = new Date().toISOString();
        sset(LS.backup, before);
        sset(LS.data, JSON.stringify(parsed));
        bot("تقویم ذخیره شد (" + parsed.blocks.length + " بلاک). رفرش…");
        setTimeout(function () {
          location.reload();
        }, 500);
        return;
      }

      /* چت عادی */
      if (p.type === "gemini") {
        var contents = [
          {
            role: "user",
            parts: [
              {
                text:
                  "دستیار tilo (کنکور + تایم‌بلاک). " +
                  memoryBlock() +
                  " | پارت‌ها:" +
                  partsCount +
                  ". کوتاه و کاربردی به فارسی."
              }
            ]
          }
        ];
        chat.slice(-10).forEach(function (m) {
          contents.push({
            role: m.role === "me" ? "user" : "model",
            parts: [{ text: m.text }]
          });
        });
        contents.push({ role: "user", parts: [{ text: text }] });
        bot(await callGemini(p, contents, false));
      } else {
        var messages = [
          {
            role: "system",
            content:
              "دستیار tilo فارسی. " + memoryBlock() + " | parts=" + partsCount
          }
        ];
        chat.slice(-10).forEach(function (m) {
          messages.push({
            role: m.role === "me" ? "user" : "assistant",
            content: m.text
          });
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
        console.warn("[tilo-ai v8]", e);
      } catch (e2) {}
    }
  }

  boot();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  window.addEventListener("load", boot);
  setTimeout(boot, 0);
  setTimeout(boot, 400);
  setTimeout(boot, 1200);
  setInterval(injectMartell, 1000);

  /* وقتی martell باز/بسته می‌شود دکمه را نشان بده */
  var mo = null;
  function watchMartell() {
    var root = document.getElementById("tilo-martell");
    if (!root || mo) return;
    mo = new MutationObserver(function () {
      injectMartell();
    });
    mo.observe(root, { attributes: true, childList: true, subtree: true });
  }
  setTimeout(watchMartell, 800);
})();
