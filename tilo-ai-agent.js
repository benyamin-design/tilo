/**
 * tilo-ai-agent.js — ایجنت برنامه‌ریز شخصی روی تایم‌بلاک (Gemini)
 * کلید فقط در localStorage: tilo_ai_key
 *
 * <script src="./tilo-ai-agent.js?v=2" defer></script>
 */
(function () {
  "use strict";
  if (window.__tiloAiAgent) return;
  window.__tiloAiAgent = true;

  var KEY_STORE = "tilo_ai_key";
  var DATA_KEY = "tilo_martell_planner";
  var BACKUP_KEY = "tilo_martell_planner_ai_backup";
  var MODEL = "gemini-3.5-flash-lite";
  var API =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    MODEL +
    ":generateContent";

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

  function looksLikeGeminiKey(k) {
    k = String(k || "").trim();
    if (k.length < 25) return false;
    return (
      /^AIza[0-9A-Za-z_\-]{20,}$/.test(k) ||
      /^AQ\.[0-9A-Za-z_\-\.]{10,}$/.test(k) ||
      k.length > 30
    );
  }

  function injectCSS() {
    if ($("tilo-ai-agent-css")) return;
    var css = document.createElement("style");
    css.id = "tilo-ai-agent-css";
    css.textContent = [
      /* دکمه شناور — گوشه پایین‌چپ، بالای نوار موبایل، z خیلی بالا */
      "#tilo-ai-fab{position:fixed;z-index:10080;left:12px;bottom:calc(6.8rem + env(safe-area-inset-bottom,0px));",
      "display:flex;flex-direction:column;align-items:center;gap:4px;border:0;background:transparent;padding:0;cursor:pointer}",
      "#tilo-ai-fab .dot{width:48px;height:48px;border-radius:16px;border:1px solid #3d5c4f;background:linear-gradient(145deg,#1f2d27,#2d5a47);",
      "color:#d1fae5;font-size:18px;display:flex;align-items:center;justify-content:center;",
      "box-shadow:0 8px 24px rgba(0,0,0,.5),0 0 0 2px rgba(110,231,183,.15)}",
      "#tilo-ai-fab.has-key .dot{border-color:#4ade80;box-shadow:0 8px 24px rgba(45,90,71,.55),0 0 0 2px rgba(74,222,128,.25)}",
      "#tilo-ai-fab .lbl{font-size:10px;color:#a7f3d0;background:rgba(24,36,31,.92);padding:2px 8px;border-radius:999px;border:1px solid #385247}",
      /* پنل شناور */
      "#tilo-ai-panel{position:fixed;z-index:10085;left:12px;right:12px;bottom:calc(10.5rem + env(safe-area-inset-bottom,0px));",
      "max-width:360px;margin:0 auto;display:none;direction:rtl;font-family:inherit;",
      "background:#18241f;border:1px solid #385247;border-radius:16px;padding:12px;",
      "box-shadow:0 16px 40px rgba(0,0,0,.55)}",
      "#tilo-ai-panel.open{display:block}",
      "#tilo-ai-panel .hd{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}",
      "#tilo-ai-panel .ttl{color:#6ee7b7;font-size:13px;font-weight:700}",
      "#tilo-ai-panel .muted{color:#8fa89b;font-size:11px;line-height:1.65;margin:0 0 8px}",
      "#tilo-ai-input{width:100%;box-sizing:border-box;min-height:72px;resize:vertical;background:#101915;color:#e2e8f0;",
      "border:1px solid #2c3e35;border-radius:10px;padding:10px;font-size:13px;font-family:inherit}",
      "#tilo-ai-run{width:100%;margin-top:8px;background:#2d5a47;color:#fff;border:0;border-radius:10px;padding:11px;font-weight:700;font-size:13px;cursor:pointer}",
      "#tilo-ai-run:disabled{opacity:.65;cursor:wait}",
      "#tilo-ai-status{min-height:1.2em;margin-top:6px;font-size:11px;color:#8fa89b}",
      "#tilo-ai-tools{display:flex;gap:6px;margin-top:8px}",
      "#tilo-ai-tools button{flex:1;min-height:36px;border-radius:10px;border:1px solid #2f453c;background:#1f2d27;color:#8fa89b;font-size:11px;cursor:pointer}",
      /* دکمه داخل هدر تایم‌بلاک */
      "#tilo-martell .tm-ai-inbar{background:#2d5a47;color:#fff;border-color:#2d5a47;font-weight:700}",
      "#tilo-martell .tm-ai-inbar.off{background:transparent;color:var(--tm-muted,#8fa89b);border-color:var(--tm-border,#2f453c);font-weight:600}"
    ].join("");
    document.head.appendChild(css);
  }

  function injectChrome() {
    if ($("tilo-ai-fab")) return;
    injectCSS();

    var fab = document.createElement("button");
    fab.type = "button";
    fab.id = "tilo-ai-fab";
    fab.innerHTML = '<span class="dot" aria-hidden="true">🔒</span><span class="lbl">ایجنت</span>';
    fab.title = "ایجنت برنامه‌ریز tilo";
    fab.addEventListener("click", onFab);
    document.body.appendChild(fab);

    var panel = document.createElement("div");
    panel.id = "tilo-ai-panel";
    panel.setAttribute("role", "dialog");
    panel.innerHTML =
      '<div class="hd"><span class="ttl">⚡ ایجنت روی تقویم تایم‌بلاک</span>' +
      '<button type="button" id="tilo-ai-close" style="background:none;border:0;color:#8fa89b;font-size:18px;cursor:pointer">✕</button></div>' +
      '<p class="muted">دستور فارسی برای <b>تقویم/تایم‌بلاک</b>: اضافه، حذف، جابه‌جایی، تأخیر، برنامه‌ریزی روز. فقط با کلید روی همین دستگاه.</p>' +
      '<textarea id="tilo-ai-input" placeholder="مثال: فردا از ۸ تا ۱۲ سه پارت حسابان، فیزیک، شیمی بساز و بینشان ۱۵ دقیقه استراحت بگذار"></textarea>' +
      '<button type="button" id="tilo-ai-run">اعمال روی تقویم</button>' +
      '<div id="tilo-ai-status"></div>' +
      '<div id="tilo-ai-tools">' +
      '<button type="button" id="tilo-ai-key">کلید API</button>' +
      '<button type="button" id="tilo-ai-clear">حذف کلید</button>' +
      "</div>";
    document.body.appendChild(panel);

    $("tilo-ai-close").addEventListener("click", function () {
      panel.classList.remove("open");
    });
    $("tilo-ai-run").addEventListener("click", runAgent);
    $("tilo-ai-key").addEventListener("click", function () {
      setupKey(true);
    });
    $("tilo-ai-clear").addEventListener("click", clearKey);
    refreshFab();
  }

  function refreshFab() {
    var fab = $("tilo-ai-fab");
    if (!fab) return;
    var dot = fab.querySelector(".dot");
    if (hasKey()) {
      fab.classList.add("has-key");
      if (dot) dot.textContent = "🤖";
    } else {
      fab.classList.remove("has-key");
      if (dot) dot.textContent = "🔒";
    }
    syncMartellButton();
  }

  function onFab() {
    if (!hasKey()) {
      setupKey(false);
      return;
    }
    $("tilo-ai-panel").classList.toggle("open");
  }

  function openPanel() {
    if (!hasKey()) {
      setupKey(false);
      return;
    }
    $("tilo-ai-panel").classList.add("open");
    try {
      $("tilo-ai-input").focus();
    } catch (_) {}
  }

  function setupKey(force) {
    var key = window.prompt(
      force
        ? "کلید Gemini API (جایگزین):"
        : "کلید Gemini API فقط برای همین مرورگر:\nاز aistudio.google.com — معمولاً با AIza…",
      ""
    );
    if (key == null) return;
    key = String(key).trim();
    if (!looksLikeGeminiKey(key)) {
      alert("کلید نامعتبر به‌نظر می‌رسد.");
      return;
    }
    try {
      localStorage.setItem(KEY_STORE, key);
    } catch (e) {
      alert("ذخیره کلید ممکن نشد.");
      return;
    }
    refreshFab();
    alert("کلید ذخیره شد. حالا می‌توانی روی تقویم دستور بدهی.");
    openPanel();
  }

  function clearKey() {
    if (!confirm("کلید از این مرورگر پاک شود؟")) return;
    try {
      localStorage.removeItem(KEY_STORE);
    } catch (_) {}
    refreshFab();
    $("tilo-ai-panel").classList.remove("open");
  }

  function setStatus(t) {
    var el = $("tilo-ai-status");
    if (el) el.textContent = t || "";
  }

  /** دکمه داخل هدر تایم‌بلاک */
  function syncMartellButton() {
    var screen = document.querySelector("#tilo-martell .tm-top .tm-row");
    if (!screen) return;
    var btn = document.getElementById("tilo-ai-martell-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "tilo-ai-martell-btn";
      btn.textContent = hasKey() ? "🤖 ایجنت" : "🔒 ایجنت";
      btn.className = hasKey() ? "tm-ai-inbar" : "tm-ai-inbar off";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openPanel();
      });
      screen.insertBefore(btn, screen.firstChild);
    } else {
      btn.textContent = hasKey() ? "🤖 ایجنت" : "🔒 ایجنت";
      btn.className = hasKey() ? "tm-ai-inbar" : "tm-ai-inbar off";
    }
  }

  // هر بار که تایم‌بلاک رندر می‌شود دکمه را برگردان
  var mo;
  function watchMartell() {
    var root = document.getElementById("tilo-martell");
    if (!root) return;
    if (mo) mo.disconnect();
    mo = new MutationObserver(function () {
      syncMartellButton();
    });
    mo.observe(root, { childList: true, subtree: true });
    syncMartellButton();
  }

  function validatePlanner(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("خروجی باید آبجکت JSON باشد.");
    }
    if (!Array.isArray(obj.blocks)) throw new Error("blocks نامعتبر");
    if (obj.trash != null && !Array.isArray(obj.trash)) throw new Error("trash نامعتبر");
    obj.blocks.forEach(function (b, i) {
      if (!b || typeof b !== "object") throw new Error("بلاک " + i);
      if (!b.id) throw new Error("بلاک بدون id");
      if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) {
        throw new Error("تاریخ نامعتبر: " + (b.title || i));
      }
      if (b.start != null && b.end != null) {
        var s = Number(b.start);
        var e = Number(b.end);
        if (!(s >= 0 && e > s && e <= 1440)) {
          throw new Error("ساعت نامعتبر: " + (b.title || ""));
        }
      }
    });
    if (obj.version == null) obj.version = 1;
    if (!Array.isArray(obj.trash)) obj.trash = [];
    if (!obj.finalized || typeof obj.finalized !== "object") obj.finalized = {};
    return obj;
  }

  function extractJsonText(raw) {
    var text = String(raw || "").trim();
    if (text.charAt(0) === "`") {
      text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    var a = text.indexOf("{");
    var b = text.lastIndexOf("}");
    if (a >= 0 && b > a) text = text.slice(a, b + 1);
    return text;
  }

  function buildPrompt(currentData, command) {
    var todayHint = "";
    try {
      todayHint = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
    } catch (_) {}

    return [
      "تو ایجنت برنامه‌ریز تقویم tilo (تایم‌بلاک زندگی) هستی.",
      "فقط JSON کامل و معتبر برگردان؛ توضیح اضافه ننویس.",
      "امروز به وقت تهران (تقریبی): " + todayHint,
      "ساختار:",
      '{"version":1,"updatedAt":string|null,"blocks":[{"id":string,"date":"YYYY-MM-DD","title":string,"note":string,"category":"deep|health|growth|general|recovery","color":string|null,"start":number|null,"end":number|null,"done":boolean,"domino":boolean}],"trash":[],"finalized":{}}',
      "start/end = دقیقه از نیمه‌شب (0 تا 1440). خرده‌کار: start و end = null.",
      "می‌توانی بلاک اضافه، حذف، ویرایش عنوان/ساعت/دسته، جابه‌جایی، تأخیر جمعی، و برنامه‌ریزی یک روز کامل انجام دهی.",
      "idهای موجود را تا حد ممکن حفظ کن. فقط طبق دستور کاربر تغییر بده.",
      "دیتای فعلی تقویم:",
      currentData,
      "دستور کاربر:",
      command
    ].join("\n");
  }

  async function runAgent() {
    var apiKey = getKey();
    var input = $("tilo-ai-input");
    var btn = $("tilo-ai-run");
    var command = input ? String(input.value || "").trim() : "";
    if (!apiKey) {
      setupKey(false);
      return;
    }
    if (!command) {
      alert("دستور را بنویس (مثلاً برنامه امروز یا جابه‌جایی دو پارت).");
      return;
    }

    var currentData = localStorage.getItem(DATA_KEY);
    if (!currentData) {
      // ساختار خالی معتبر
      currentData = JSON.stringify({
        version: 1,
        updatedAt: null,
        blocks: [],
        trash: [],
        finalized: {}
      });
    }

    btn.disabled = true;
    btn.textContent = "در حال اعمال روی تقویم…";
    setStatus("ارسال به Gemini (" + MODEL + ")…");

    try {
      var res = await fetch(API + "?key=" + encodeURIComponent(apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(currentData, command) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      });

      var result = await res.json();
      if (!res.ok || result.error) {
        throw new Error((result.error && result.error.message) || "HTTP " + res.status);
      }

      var part =
        result.candidates &&
        result.candidates[0] &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts[0];
      if (!part || !part.text) throw new Error("پاسخ خالی از مدل");

      var parsed = validatePlanner(JSON.parse(extractJsonText(part.text)));
      parsed.updatedAt = new Date().toISOString();

      try {
        localStorage.setItem(BACKUP_KEY, currentData);
      } catch (_) {}
      localStorage.setItem(DATA_KEY, JSON.stringify(parsed));

      setStatus("تقویم به‌روز شد.");
      // رفرش نرم تایم‌بلاک اگر باز است
      try {
        if (window.tiloMartell && typeof window.tiloMartell.open === "function") {
          location.reload();
        } else {
          location.reload();
        }
      } catch (_) {
        location.reload();
      }
    } catch (err) {
      console.warn("[tilo-ai-agent]", err);
      setStatus("خطا: " + (err && err.message ? err.message : err));
      alert("خطا: " + (err && err.message ? err.message : err));
      btn.disabled = false;
      btn.textContent = "اعمال روی تقویم";
    }
  }

  function boot() {
    injectChrome();
    watchMartell();
    setInterval(syncMartellButton, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
