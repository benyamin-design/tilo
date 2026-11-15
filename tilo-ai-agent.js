/**
 * tilo-ai-agent.js v3 — دستیار چت tilo (همه‌جا، باز/بسته، تقویم + راهنما)
 * کلید فقط localStorage.tilo_ai_key
 *
 * <script src="./tilo-ai-agent.js?v=3" defer></script>
 */
(function () {
  "use strict";
  if (window.__tiloAiAgentV3) return;
  window.__tiloAiAgentV3 = true;
  window.__tiloAiAgent = true;

  var KEY_STORE = "tilo_ai_key";
  var DATA_KEY = "tilo_martell_planner";
  var BACKUP_KEY = "tilo_martell_planner_ai_backup";
  var CHAT_KEY = "tilo_ai_chat_v1";
  var MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash"
  ];

  var chat = [];
  try {
    chat = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
    if (!Array.isArray(chat)) chat = [];
  } catch (_) {
    chat = [];
  }

  function $(id) {
    return document.getElementById(id);
  }

  function hasKey() {
    try {
      var k = localStorage.getItem(KEY_STORE);
      return !!(k && k.trim().length > 20);
    } catch (_) {
      return false;
    }
  }

  function getKey() {
    try {
      return (localStorage.getItem(KEY_STORE) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function looksLikeKey(k) {
    k = String(k || "").trim();
    return k.length >= 25;
  }

  function saveChat() {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-40)));
    } catch (_) {}
  }

  function inject() {
    if ($("tilo-ai-root")) return;

    var style = document.createElement("style");
    style.id = "tilo-ai-v3-css";
    style.textContent = [
      "#tilo-ai-root{position:fixed;inset:0;pointer-events:none;z-index:2147483000;font-family:inherit;direction:rtl}",
      "#tilo-ai-tab{pointer-events:auto;position:fixed;top:42%;right:0;transform:translateY(-50%);",
      "z-index:2147483001;border:0;border-radius:12px 0 0 12px;padding:14px 8px;cursor:pointer;",
      "background:#2d5a47;color:#ecfdf5;font-size:18px;font-weight:800;line-height:1;",
      "box-shadow:-4px 0 20px rgba(0,0,0,.4);min-width:36px}",
      "#tilo-ai-tab.open{background:#1f3d32}",
      "#tilo-ai-drawer{pointer-events:auto;position:fixed;top:0;right:0;height:100%;height:100dvh;width:min(100vw,400px);",
      "background:#121c18;color:#e2ebe5;border-left:1px solid #2f453c;display:flex;flex-direction:column;",
      "transform:translateX(105%);transition:transform .22s ease;box-shadow:-12px 0 40px rgba(0,0,0,.45)}",
      "#tilo-ai-drawer.open{transform:translateX(0)}",
      "#tilo-ai-drawer .ai-head{display:flex;align-items:center;justify-content:space-between;gap:8px;",
      "padding:12px 14px;padding-top:calc(12px + env(safe-area-inset-top,0px));border-bottom:1px solid #2f453c;background:#18241f}",
      "#tilo-ai-drawer .ai-head strong{font-size:14px;color:#6ee7b7}",
      "#tilo-ai-drawer .ai-head .sub{display:block;font-size:10px;color:#8fa89b;font-weight:500;margin-top:2px}",
      "#tilo-ai-drawer .ai-actions{display:flex;gap:6px;flex-wrap:wrap}",
      "#tilo-ai-drawer .ai-actions button,#tilo-ai-send,#tilo-ai-drawer .icon-btn{",
      "border:1px solid #2f453c;background:#1f2d27;color:#c5d5cc;border-radius:10px;min-height:36px;padding:6px 10px;font-size:12px;cursor:pointer}",
      "#tilo-ai-drawer .icon-btn{width:36px;padding:0;font-size:16px}",
      "#tilo-ai-msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;",
      "padding-bottom:8px;-webkit-overflow-scrolling:touch}",
      "#tilo-ai-msgs .bubble{max-width:92%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word}",
      "#tilo-ai-msgs .me{align-self:flex-left;margin-inline-start:auto;background:#2d5a47;color:#fff;border-bottom-left-radius:4px}",
      "#tilo-ai-msgs .bot{align-self:flex-start;background:#1b2822;border:1px solid #2f453c;color:#e2ebe5;border-bottom-right-radius:4px}",
      "#tilo-ai-msgs .sys{align-self:center;font-size:11px;color:#8fa89b;background:transparent;border:0;text-align:center}",
      "#tilo-ai-foot{border-top:1px solid #2f453c;padding:10px 12px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));background:#18241f}",
      "#tilo-ai-input{width:100%;box-sizing:border-box;min-height:44px;max-height:120px;resize:vertical;",
      "background:#101915;color:#e2e8f0;border:1px solid #2c3e35;border-radius:12px;padding:10px;font-size:14px;font-family:inherit}",
      "#tilo-ai-send{width:100%;margin-top:8px;background:#2d5a47;color:#fff;border-color:#2d5a47;font-weight:700;min-height:42px}",
      "#tilo-ai-send:disabled{opacity:.6;cursor:wait}",
      "#tilo-ai-hint{font-size:10px;color:#8fa89b;margin-top:6px;line-height:1.5}"
    ].join("");
    document.head.appendChild(style);

    var root = document.createElement("div");
    root.id = "tilo-ai-root";
    root.innerHTML =
      '<button type="button" id="tilo-ai-tab" aria-label="دستیار tilo">»</button>' +
      '<aside id="tilo-ai-drawer" aria-label="چت دستیار">' +
      '<div class="ai-head">' +
      "<div><strong>دستیار tilo</strong><span class=\"sub\">چت + تغییر تقویم تایم‌بلاک</span></div>" +
      '<div class="ai-actions">' +
      '<button type="button" id="tilo-ai-keybtn" class="icon-btn" title="کلید API">🔑</button>' +
      '<button type="button" id="tilo-ai-clear-chat" title="پاک کردن چت">🧹</button>' +
      '<button type="button" id="tilo-ai-close" class="icon-btn" title="بستن">✕</button>' +
      "</div></div>" +
      '<div id="tilo-ai-msgs"></div>' +
      '<div id="tilo-ai-foot">' +
      '<textarea id="tilo-ai-input" rows="2" placeholder="با من حرف بزن… مثلاً برنامه فردا را بچین / چطور فیزیک را جمع کنم؟"></textarea>' +
      '<button type="button" id="tilo-ai-send">ارسال</button>' +
      '<div id="tilo-ai-hint">کلید API فقط روی این دستگاه است. برای تغییر تقویم بگو «در تایم‌بلاک …»</div>' +
      "</div></aside>";
    document.body.appendChild(root);

    $("tilo-ai-tab").addEventListener("click", toggle);
    $("tilo-ai-close").addEventListener("click", close);
    $("tilo-ai-keybtn").addEventListener("click", function () {
      askKey(false);
    });
    $("tilo-ai-clear-chat").addEventListener("click", function () {
      if (!confirm("تاریخچه چت پاک شود؟")) return;
      chat = [];
      saveChat();
      renderChat();
    });
    $("tilo-ai-send").addEventListener("click", send);
    $("tilo-ai-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    renderChat();
    if (!chat.length) {
      pushBot(
        "سلام — دستیار tilo هستم.\n• می‌توانی عادی با من حرف بزنی (مطالعه، برنامه‌ریزی، انگیزه).\n• برای تغییر تقویم بگو مثلاً: «امروز ۹–۱۱ حسابان بگذار و ۱۰ دقیقه استراحت».\nاول یک‌بار 🔑 را بزن و کلید Gemini را وارد کن."
      );
    }
  }

  function isOpen() {
    var d = $("tilo-ai-drawer");
    return !!(d && d.classList.contains("open"));
  }

  function open() {
    var d = $("tilo-ai-drawer");
    var t = $("tilo-ai-tab");
    if (d) d.classList.add("open");
    if (t) {
      t.classList.add("open");
      t.textContent = "«";
    }
    try {
      $("tilo-ai-input").focus();
    } catch (_) {}
  }

  function close() {
    var d = $("tilo-ai-drawer");
    var t = $("tilo-ai-tab");
    if (d) d.classList.remove("open");
    if (t) {
      t.classList.remove("open");
      t.textContent = "»";
    }
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  function pushBot(text) {
    chat.push({ role: "bot", text: String(text || "") });
    saveChat();
    renderChat();
  }

  function pushMe(text) {
    chat.push({ role: "me", text: String(text || "") });
    saveChat();
    renderChat();
  }

  function renderChat() {
    var box = $("tilo-ai-msgs");
    if (!box) return;
    box.innerHTML = chat
      .map(function (m) {
        var cls = m.role === "me" ? "me" : m.role === "sys" ? "sys" : "bot";
        return '<div class="bubble ' + cls + '"></div>';
      })
      .join("");
    var nodes = box.querySelectorAll(".bubble");
    chat.forEach(function (m, i) {
      nodes[i].textContent = m.text;
    });
    box.scrollTop = box.scrollHeight;
  }

  function askKey(required) {
    var cur = hasKey() ? " (الان کلید ذخیره است — برای عوض کردن کلید جدید بده)" : "";
    var key = window.prompt("کلید Gemini API از AI Studio" + cur + "\nمعمولاً با AIza شروع می‌شود:", "");
    if (key == null) return false;
    key = String(key).trim();
    if (!looksLikeKey(key)) {
      alert("کلید خیلی کوتاه یا نامعتبر است.");
      return false;
    }
    try {
      localStorage.setItem(KEY_STORE, key);
    } catch (e) {
      alert("ذخیره ممکن نشد.");
      return false;
    }
    pushBot("کلید ذخیره شد. می‌توانی چت کنی یا تقویم را تغییر بدهی.");
    return true;
  }

  function wantsCalendarChange(text) {
    var t = String(text || "");
    return /تایم[\s\-]?بلاک|تقویم|پارت|بلاک|برنامه\s*(روز|فردا|امروز|هفته)|جابه‌جا|جا به جا|حذف کن|اضافه کن|بساز|تأخیر|جلو بینداز|ساعت\s*\d/i.test(
      t
    );
  }

  function validatePlanner(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("JSON باید آبجکت باشد");
    if (!Array.isArray(obj.blocks)) throw new Error("blocks نیست");
    if (obj.trash != null && !Array.isArray(obj.trash)) throw new Error("trash نامعتبر");
    obj.blocks.forEach(function (b, i) {
      if (!b || !b.id) throw new Error("بلاک " + i + " بدون id");
      if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) throw new Error("تاریخ بلاک " + i);
      if (b.start != null && b.end != null) {
        var s = Number(b.start),
          e = Number(b.end);
        if (!(s >= 0 && e > s && e <= 1440)) throw new Error("ساعت بلاک «" + (b.title || i) + "»");
      }
    });
    if (obj.version == null) obj.version = 1;
    if (!Array.isArray(obj.trash)) obj.trash = [];
    if (!obj.finalized) obj.finalized = {};
    return obj;
  }

  function extractJson(raw) {
    var text = String(raw || "").trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    var a = text.indexOf("{");
    var b = text.lastIndexOf("}");
    if (a >= 0 && b > a) return text.slice(a, b + 1);
    return text;
  }

  function plannerSnapshot() {
    var raw = localStorage.getItem(DATA_KEY);
    if (raw) return raw;
    return JSON.stringify({ version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} });
  }

  function systemPreamble(calendarMode) {
    var today = "";
    try {
      today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch (_) {}

    if (calendarMode) {
      return [
        "تو دستیار tilo هستی. کاربر می‌خواهد تقویم تایم‌بلاک را عوض کند.",
        "فقط یک JSON معتبر برگردان (بدون توضیح).",
        "امروز تهران: " + today,
        'ساختار: {"version":1,"updatedAt":null,"blocks":[{"id":"string","date":"YYYY-MM-DD","title":"string","note":"","category":"deep|health|growth|general|recovery","color":null,"start":0,"end":60,"done":false,"domino":false}],"trash":[],"finalized":{}}',
        "start/end دقیقه از نیمه‌شب. idهای قبلی را حفظ کن مگر حذف لازم باشد.",
        "دیتای فعلی:",
        plannerSnapshot()
      ].join("\n");
    }

    return [
      "تو دستیار فارسی اپ tilo هستی (برنامه مطالعه کنکور + تایم‌بلاک زندگی).",
      "کوتاه، عملی و مهربان جواب بده. اگر لازم است قدم‌به‌قدم راهنمایی کن.",
      "اگر کاربر خواست خودِ برنامه داخل تقویم عوض شود، بگو دقیقاً چه دستوری بدهد یا تأیید بگیر.",
      "امروز تهران: " + today,
      "خلاصه‌ای از تعداد بلاک‌های ذخیره‌شده: " +
        (function () {
          try {
            var d = JSON.parse(plannerSnapshot());
            return Array.isArray(d.blocks) ? d.blocks.length + " بلاک" : "نامشخص";
          } catch (_) {
            return "نامشخص";
          }
        })()
    ].join("\n");
  }

  async function callGemini(model, parts) {
    var key = getKey();
    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent?key=" +
      encodeURIComponent(key);
    var body = {
      contents: parts,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192
      }
    };
    // برای حالت تقویم JSON سخت‌گیر
    if (parts._calendar) {
      body.generationConfig.responseMimeType = "application/json";
      body.generationConfig.temperature = 0.15;
    }
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var data = await res.json();
    if (!res.ok || data.error) {
      var err = new Error((data.error && data.error.message) || "HTTP " + res.status);
      err.status = res.status;
      err.raw = data;
      throw err;
    }
    var text =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    if (!text) throw new Error("پاسخ خالی");
    return text;
  }

  async function callWithFallback(parts, calendarMode) {
    parts._calendar = calendarMode;
    var lastErr;
    for (var i = 0; i < MODELS.length; i++) {
      try {
        return await callGemini(MODELS[i], parts);
      } catch (e) {
        lastErr = e;
        // مدل پیدا نشد یا سهمیه — مدل بعدی
        if (e && /not found|NOT_FOUND|404|429|RESOURCE/i.test(String(e.message || ""))) continue;
        throw e;
      }
    }
    throw lastErr || new Error("هیچ مدلی جواب نداد");
  }

  function buildContents(userText, calendarMode) {
    var contents = [];
    contents.push({
      role: "user",
      parts: [{ text: systemPreamble(calendarMode) }]
    });
    // چند پیام آخر برای چت
    var recent = chat.filter(function (m) {
      return m.role === "me" || m.role === "bot";
    }).slice(-8);
    recent.forEach(function (m) {
      contents.push({
        role: m.role === "me" ? "user" : "model",
        parts: [{ text: m.text }]
      });
    });
    contents.push({ role: "user", parts: [{ text: userText }] });
    return contents;
  }

  async function send() {
    var input = $("tilo-ai-input");
    var btn = $("tilo-ai-send");
    var text = input ? String(input.value || "").trim() : "";
    if (!text) return;

    if (!hasKey()) {
      if (!askKey(true)) return;
    }

    pushMe(text);
    if (input) input.value = "";
    btn.disabled = true;
    btn.textContent = "…";

    var calendarMode = wantsCalendarChange(text);

    try {
      var reply = await callWithFallback(buildContents(text, calendarMode), calendarMode);

      if (calendarMode) {
        var parsed = validatePlanner(JSON.parse(extractJson(reply)));
        parsed.updatedAt = new Date().toISOString();
        try {
          localStorage.setItem(BACKUP_KEY, plannerSnapshot());
        } catch (_) {}
        localStorage.setItem(DATA_KEY, JSON.stringify(parsed));
        pushBot(
          "تقویم تایم‌بلاک به‌روز شد ✅\nتعداد بلاک‌ها: " +
            parsed.blocks.length +
            "\nصفحه را یک‌بار رفرش می‌کنم تا تایم‌بلاک جدید را ببینی."
        );
        setTimeout(function () {
          location.reload();
        }, 700);
        return;
      }

      pushBot(reply);
    } catch (err) {
      console.warn("[tilo-ai]", err);
      pushBot(
        "خطا: " +
          (err && err.message ? err.message : err) +
          "\nاگر سهمیه تمام شده یا مدل در منطقه/پروژه‌ات نیست، مدل دیگر را در AI Studio چک کن یا فردا دوباره امتحان کن."
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "ارسال";
    }
  }

  // API عمومی
  window.tiloAI = {
    open: open,
    close: close,
    toggle: toggle
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
