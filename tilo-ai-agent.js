/**
 * tilo-ai-agent.js v4 — دستیار چت tilo
 * نصب: <script src="./tilo-ai-agent.js?v=4"></script>  (بدون defer بهتر است)
 * یا با defer هم کار می‌کند.
 */
(function () {
  "use strict";
  try {
    if (window.__tiloAiV4) return;
    window.__tiloAiV4 = true;
  } catch (_) {
    return;
  }

  var KEY = "tilo_ai_key";
  var DATA = "tilo_martell_planner";
  var BACKUP = "tilo_martell_planner_ai_backup";
  var CHAT = "tilo_ai_chat_v1";
  var SESS = "tilo_ai_sessions_v1";
  var MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash"
  ];

  function loadChat() {
    try {
      var a = JSON.parse(localStorage.getItem(CHAT) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (_) {
      return [];
    }
  }
  function saveChat(arr) {
    try {
      localStorage.setItem(CHAT, JSON.stringify((arr || []).slice(-50)));
    } catch (_) {}
  }

  var chat = loadChat();
  var busy = false;

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "style" && typeof attrs[k] === "object") {
          Object.assign(n.style, attrs[k]);
        } else if (k === "style") {
          n.setAttribute("style", attrs[k]);
        } else if (k.slice(0, 2) === "on") {
          n[k] = attrs[k];
        } else {
          n.setAttribute(k, attrs[k]);
        }
      });
    }
    if (html != null) n.innerHTML = html;
    return n;
  }

  function hasKey() {
    try {
      var k = localStorage.getItem(KEY);
      return !!(k && k.trim().length > 20);
    } catch (_) {
      return false;
    }
  }
  function getKey() {
    try {
      return (localStorage.getItem(KEY) || "").trim();
    } catch (_) {
      return "";
    }
  }

  function ensureUI() {
    if (document.getElementById("tilo-ai-tab")) return true;
    if (!document.body) return false;

    // --- زبانه کنار صفحه (اینلاین، بدون وابستگی به CSS خارجی) ---
    var tab = el("button", {
      id: "tilo-ai-tab",
      type: "button",
      "aria-label": "دستیار tilo"
    });
    tab.textContent = "»";
    Object.assign(tab.style, {
      position: "fixed",
      top: "40%",
      right: "0",
      left: "auto",
      transform: "translateY(-50%)",
      zIndex: "2147483646",
      margin: "0",
      padding: "16px 10px",
      border: "none",
      borderRadius: "14px 0 0 14px",
      background: "#2d5a47",
      color: "#ecfdf5",
      fontSize: "22px",
      fontWeight: "800",
      lineHeight: "1",
      cursor: "pointer",
      boxShadow: "-4px 0 18px rgba(0,0,0,0.45)",
      pointerEvents: "auto",
      display: "block"
    });

    // --- پنل ---
    var drawer = el("aside", { id: "tilo-ai-drawer", "aria-label": "چت دستیار" });
    Object.assign(drawer.style, {
      position: "fixed",
      top: "0",
      right: "0",
      width: "min(100vw, 400px)",
      height: "100%",
      maxHeight: "100dvh",
      zIndex: "2147483647",
      background: "#121c18",
      color: "#e2ebe5",
      borderLeft: "1px solid #2f453c",
      display: "flex",
      flexDirection: "column",
      transform: "translateX(110%)",
      transition: "transform 0.2s ease",
      boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
      direction: "rtl",
      fontFamily: "inherit",
      pointerEvents: "auto"
    });

    var head = el("div");
    Object.assign(head.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "8px",
      padding: "12px 14px",
      paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
      borderBottom: "1px solid #2f453c",
      background: "#18241f"
    });
    var titleWrap = el("div");
    titleWrap.innerHTML =
      '<div style="color:#6ee7b7;font-weight:700;font-size:14px">دستیار tilo</div>' +
      '<div style="color:#8fa89b;font-size:10px;margin-top:2px">چت · تقویم · راهنمای مطالعه</div>';
    var actions = el("div");
    Object.assign(actions.style, { display: "flex", gap: "6px" });

    function smallBtn(id, label, title) {
      var b = el("button", { id: id, type: "button", title: title || label });
      b.textContent = label;
      Object.assign(b.style, {
        minWidth: "36px",
        minHeight: "36px",
        border: "1px solid #2f453c",
        background: "#1f2d27",
        color: "#c5d5cc",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px"
      });
      return b;
    }
    var btnNew = smallBtn("tilo-ai-new", "＋", "چت جدید");
    var btnKey = smallBtn("tilo-ai-key", "🔑", "کلید API");
    var btnClose = smallBtn("tilo-ai-close", "✕", "بستن");
    actions.appendChild(btnNew);
    actions.appendChild(btnKey);
    actions.appendChild(btnClose);
    head.appendChild(titleWrap);
    head.appendChild(actions);

    var msgs = el("div", { id: "tilo-ai-msgs" });
    Object.assign(msgs.style, {
      flex: "1",
      overflow: "auto",
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      WebkitOverflowScrolling: "touch"
    });

    var foot = el("div");
    Object.assign(foot.style, {
      borderTop: "1px solid #2f453c",
      padding: "10px 12px",
      paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
      background: "#18241f"
    });
    var input = el("textarea", {
      id: "tilo-ai-input",
      rows: "2",
      placeholder: "اینجا بنویس… Enter = ارسال"
    });
    Object.assign(input.style, {
      width: "100%",
      boxSizing: "border-box",
      minHeight: "48px",
      maxHeight: "120px",
      resize: "vertical",
      background: "#101915",
      color: "#e2e8f0",
      border: "1px solid #2c3e35",
      borderRadius: "12px",
      padding: "10px",
      fontSize: "14px",
      fontFamily: "inherit"
    });
    var send = el("button", { id: "tilo-ai-send", type: "button" });
    send.textContent = "ارسال";
    Object.assign(send.style, {
      width: "100%",
      marginTop: "8px",
      minHeight: "44px",
      border: "none",
      borderRadius: "12px",
      background: "#2d5a47",
      color: "#fff",
      fontWeight: "700",
      fontSize: "14px",
      cursor: "pointer"
    });
    var hint = el("div");
    hint.textContent = "کلید فقط روی این دستگاه. چت جدید با دکمه ＋";
    Object.assign(hint.style, { fontSize: "10px", color: "#8fa89b", marginTop: "6px" });
    foot.appendChild(input);
    foot.appendChild(send);
    foot.appendChild(hint);

    drawer.appendChild(head);
    drawer.appendChild(msgs);
    drawer.appendChild(foot);

    document.body.appendChild(tab);
    document.body.appendChild(drawer);

    function open() {
      drawer.style.transform = "translateX(0)";
      tab.textContent = "«";
      tab.style.background = "#1f3d32";
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
      if (drawer.style.transform === "translateX(0px)" || drawer.style.transform === "translateX(0)") close();
      else open();
    }

    tab.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    btnClose.addEventListener("click", close);
    btnKey.addEventListener("click", function () {
      promptKey();
    });
    btnNew.addEventListener("click", function () {
      if (chat.length && !confirm("چت فعلی بایگانی و چت جدید شروع شود؟")) return;
      archiveSession();
      chat = [];
      saveChat(chat);
      paint();
      bot("چت جدید شروع شد. بپرس یا بگو برنامه‌ات را در تایم‌بلاک عوض کنم.");
    });
    send.addEventListener("click", function () {
      doSend();
    });
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
          color: "#fff",
          borderBottomLeftRadius: "4px"
        });
      } else {
        Object.assign(b.style, {
          alignSelf: "flex-start",
          background: "#1b2822",
          border: "1px solid #2f453c",
          color: "#e2ebe5",
          borderBottomRightRadius: "4px"
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
      saveChat(chat);
      paint();
    }
    function me(t) {
      chat.push({ role: "me", text: String(t) });
      saveChat(chat);
      paint();
    }

    function archiveSession() {
      try {
        var all = JSON.parse(localStorage.getItem(SESS) || "[]");
        if (!Array.isArray(all)) all = [];
        if (chat.length) {
          all.unshift({ at: new Date().toISOString(), messages: chat.slice() });
          localStorage.setItem(SESS, JSON.stringify(all.slice(0, 20)));
        }
      } catch (_) {}
    }

    function promptKey() {
      var k = window.prompt(
        "کلید Gemini API (از aistudio.google.com)\nفقط روی این مرورگر ذخیره می‌شود:",
        hasKey() ? "" : ""
      );
      if (k == null) return false;
      k = String(k).trim();
      if (k.length < 25) {
        alert("کلید نامعتبر");
        return false;
      }
      try {
        localStorage.setItem(KEY, k);
      } catch (e) {
        alert("ذخیره نشد");
        return false;
      }
      bot("کلید ذخیره شد. می‌توانی چت کنی.");
      return true;
    }

    function wantsCal(t) {
      return /تایم[\s\-]?بلاک|تقویم|پارت|بلاک|برنامه\s*(روز|فردا|امروز|هفته)|جابه‌جا|حذف کن|اضافه کن|بساز|تأخیر|ساعت\s*\d/i.test(
        String(t || "")
      );
    }

    function snapshot() {
      var raw = localStorage.getItem(DATA);
      if (raw) return raw;
      return JSON.stringify({ version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} });
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
          if (!(s >= 0 && e > s && e <= 1440)) throw new Error("ساعت «" + (b.title || i) + "»");
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

    async function gemini(model, contents, jsonMode) {
      var url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
        encodeURIComponent(getKey());
      var body = {
        contents: contents,
        generationConfig: {
          temperature: jsonMode ? 0.15 : 0.45,
          maxOutputTokens: 8192
        }
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

    async function withFallback(contents, jsonMode) {
      var last;
      for (var i = 0; i < MODELS.length; i++) {
        try {
          return await gemini(MODELS[i], contents, jsonMode);
        } catch (e) {
          last = e;
          if (/not found|NOT_FOUND|404|429|RESOURCE|quota/i.test(String(e.message || ""))) continue;
          throw e;
        }
      }
      throw last || new Error("مدل در دسترس نیست");
    }

    function todayTehran() {
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tehran",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(new Date());
      } catch (_) {
        return "";
      }
    }

    async function doSend() {
      if (busy) return;
      var text = String(input.value || "").trim();
      if (!text) return;
      if (!hasKey() && !promptKey()) return;

      me(text);
      input.value = "";
      busy = true;
      send.disabled = true;
      send.textContent = "…";

      var cal = wantsCal(text);
      try {
        var contents = [];
        if (cal) {
          contents.push({
            role: "user",
            parts: [
              {
                text:
                  "دستیار tilo. فقط JSON تقویم برگردان.\nامروز تهران: " +
                  todayTehran() +
                  '\nساختار: {"version":1,"updatedAt":null,"blocks":[{"id":"string","date":"YYYY-MM-DD","title":"string","note":"","category":"deep|health|growth|general|recovery","color":null,"start":0,"end":60,"done":false,"domino":false}],"trash":[],"finalized":{}}\nدیتا:\n' +
                  snapshot() +
                  "\nدستور:\n" +
                  text
              }
            ]
          });
          var raw = await withFallback(contents, true);
          var parsed = validate(JSON.parse(extractJson(raw)));
          parsed.updatedAt = new Date().toISOString();
          try {
            localStorage.setItem(BACKUP, snapshot());
          } catch (_) {}
          localStorage.setItem(DATA, JSON.stringify(parsed));
          bot("تقویم به‌روز شد (" + parsed.blocks.length + " بلاک). رفرش…");
          setTimeout(function () {
            location.reload();
          }, 600);
          return;
        }

        contents.push({
          role: "user",
          parts: [
            {
              text:
                "تو دستیار فارسی tilo هستی (مطالعه کنکور و تایم‌بلاک). کوتاه و کاربردی جواب بده. امروز: " +
                todayTehran()
            }
          ]
        });
        chat
          .filter(function (m) {
            return m.role === "me" || m.role === "bot";
          })
          .slice(-10)
          .forEach(function (m) {
            contents.push({
              role: m.role === "me" ? "user" : "model",
              parts: [{ text: m.text }]
            });
          });
        contents.push({ role: "user", parts: [{ text: text }] });

        var reply = await withFallback(contents, false);
        bot(reply);
      } catch (err) {
        bot("خطا: " + (err && err.message ? err.message : err));
      } finally {
        busy = false;
        send.disabled = false;
        send.textContent = "ارسال";
      }
    }

    paint();
    if (!chat.length) {
      bot(
        "سلام — لبه راست صفحه را با » باز کردی.\n۱) 🔑 کلید Gemini\n۲) حرف بزن یا بگو تقویم را عوض کند.\n۳) ＋ = چت جدید (قبلی بایگانی می‌شود)."
      );
    }
    return true;
  }

  function boot() {
    try {
      ensureUI();
    } catch (e) {
      try {
        console.warn("[tilo-ai]", e);
      } catch (_) {}
    }
  }

  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  }
  window.addEventListener("load", boot);
  setTimeout(boot, 0);
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
})();
