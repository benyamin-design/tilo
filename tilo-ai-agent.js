/**
 * tilo-ai-agent.js — ایجنت برنامه‌ریز شخصی (Gemini)
 * فقط وقتی کلید در localStorage همین مرورگر باشد کار می‌کند.
 *
 * در index.html:
 *   1) بلوک قدیمی «بخش ایجنت هوشمند» + اسکریپت inline را حذف کن
 *   2) قبل از </body> بعد از martell:
 *      <script src="./tilo-ai-agent.js?v=1" defer></script>
 *
 * کلید: localStorage.tilo_ai_key  (هرگز داخل سورس نگذار)
 * دیتا: localStorage.tilo_martell_planner
 */
(function () {
  "use strict";
  if (window.__tiloAiAgent) return;
  window.__tiloAiAgent = true;

  var KEY_STORE = "tilo_ai_key";
  var DATA_KEY = "tilo_martell_planner";
  var BACKUP_KEY = "tilo_martell_planner_ai_backup";
  var MODEL = "gemini-flash-latest";
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
    // کلیدهای رایج گوگل
    return /^AIza[0-9A-Za-z_\-]{20,}$/.test(k) || /^AQ\.[0-9A-Za-z_\-\.]{10,}$/.test(k) || k.length > 30;
  }

  function injectUI() {
    if ($("tilo-ai-wrapper")) return;

    var css = document.createElement("style");
    css.id = "tilo-ai-agent-css";
    css.textContent =
      "#tilo-ai-wrapper{position:fixed;bottom:calc(5.4rem + env(safe-area-inset-bottom,0px));left:14px;z-index:10050;" +
      "font-family:inherit;direction:rtl;max-width:min(320px,calc(100vw - 28px))}" +
      "#tilo-key-btn{width:42px;height:42px;border-radius:14px;border:1px solid #2f453c;background:#1f2d27;" +
      "color:#8fa89b;cursor:pointer;font-size:16px;box-shadow:0 6px 18px rgba(0,0,0,.45);" +
      "display:inline-flex;align-items:center;justify-content:center}" +
      "#tilo-key-btn.has-key{border-color:#4ade80;color:#bbf7d0}" +
      "#tilo-agent-box{display:none;margin-top:8px;background:#18241f;border:1px solid #385247;border-radius:16px;" +
      "padding:12px;box-shadow:0 10px 28px rgba(0,0,0,.55)}" +
      "#tilo-agent-box.open{display:block}" +
      "#tilo-agent-box .tm-ai-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px}" +
      "#tilo-agent-box .tm-ai-title{color:#6ee7b7;font-size:12px;font-weight:700}" +
      "#tilo-agent-box .tm-ai-muted{color:#8fa89b;font-size:11px;line-height:1.6;margin:0 0 8px}" +
      "#tilo-agent-input{width:100%;box-sizing:border-box;background:#101915;color:#e2e8f0;border:1px solid #2c3e35;" +
      "border-radius:10px;padding:10px;font-size:13px;resize:vertical;min-height:64px;font-family:inherit}" +
      "#tilo-agent-submit{width:100%;margin-top:8px;background:#2d5a47;color:#fff;border:none;border-radius:10px;" +
      "padding:10px;font-size:13px;font-weight:700;cursor:pointer}" +
      "#tilo-agent-submit:disabled{opacity:.6;cursor:wait}" +
      "#tilo-agent-status{margin-top:6px;font-size:11px;color:#8fa89b;min-height:1.2em}" +
      "#tilo-agent-tools{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}" +
      "#tilo-agent-tools button{flex:1;min-height:36px;border-radius:10px;border:1px solid #2f453c;" +
      "background:#1f2d27;color:#8fa89b;font-size:11px;cursor:pointer}";
    document.head.appendChild(css);

    var wrap = document.createElement("div");
    wrap.id = "tilo-ai-wrapper";
    wrap.innerHTML =
      '<button type="button" id="tilo-key-btn" title="کلید API / ایجنت" aria-label="ایجنت">🔒</button>' +
      '<div id="tilo-agent-box" role="dialog" aria-label="ایجنت برنامه‌ریز">' +
      '<div class="tm-ai-head"><span class="tm-ai-title">⚡ ایجنت برنامه‌ریز تیلو</span>' +
      '<button type="button" id="tilo-agent-close" aria-label="بستن" style="background:none;border:none;color:#8fa89b;cursor:pointer;font-size:16px">✕</button></div>' +
      '<p class="tm-ai-muted">فقط روی این دستگاه. کلید در سورس سایت نیست. دستور فارسی بده تا روی تایم‌بلاک اعمال شود.</p>' +
      '<textarea id="tilo-agent-input" rows="3" placeholder="مثلاً: جای حسابان و دینی را عوض کن / یک پارت ۶۰ دقیقه‌ای هندسه بعد از فیزیک اضافه کن"></textarea>' +
      '<button type="button" id="tilo-agent-submit">اجرای تغییر روی برنامه</button>' +
      '<div id="tilo-agent-status"></div>' +
      '<div id="tilo-agent-tools">' +
      '<button type="button" id="tilo-agent-change-key">تعویض کلید</button>' +
      '<button type="button" id="tilo-agent-clear-key">حذف کلید</button>' +
      "</div></div>";
    document.body.appendChild(wrap);

    $("tilo-key-btn").addEventListener("click", onFabClick);
    $("tilo-agent-close").addEventListener("click", function () {
      $("tilo-agent-box").classList.remove("open");
    });
    $("tilo-agent-submit").addEventListener("click", runAgent);
    $("tilo-agent-change-key").addEventListener("click", function () {
      setupKey(true);
    });
    $("tilo-agent-clear-key").addEventListener("click", clearKey);
    refreshFab();
  }

  function refreshFab() {
    var btn = $("tilo-key-btn");
    if (!btn) return;
    if (hasKey()) {
      btn.textContent = "🤖";
      btn.classList.add("has-key");
    } else {
      btn.textContent = "🔒";
      btn.classList.remove("has-key");
      var box = $("tilo-agent-box");
      if (box) box.classList.remove("open");
    }
  }

  function onFabClick() {
    if (!hasKey()) {
      setupKey(false);
      return;
    }
    $("tilo-agent-box").classList.toggle("open");
  }

  function setupKey(force) {
    var msg = force
      ? "کلید جدید Gemini API را وارد کن (جایگزین می‌شود):"
      : "کلید Gemini API فقط برای همین مرورگر ذخیره می‌شود:\n(معمولاً با AIza شروع می‌شود)";
    var key = window.prompt(msg, "");
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
    alert("کلید فقط روی این دستگاه ذخیره شد. بقیه بازدیدکننده‌ها این کلید را ندارند.");
    $("tilo-agent-box").classList.add("open");
  }

  function clearKey() {
    if (!confirm("کلید API از این مرورگر پاک شود؟")) return;
    try {
      localStorage.removeItem(KEY_STORE);
    } catch (_) {}
    refreshFab();
    alert("کلید حذف شد.");
  }

  function setStatus(text) {
    var el = $("tilo-agent-status");
    if (el) el.textContent = text || "";
  }

  function validatePlanner(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("خروجی باید آبجکت JSON باشد، نه آرایه.");
    }
    if (!Array.isArray(obj.blocks)) throw new Error("فیلد blocks نامعتبر است.");
    if (obj.trash != null && !Array.isArray(obj.trash)) throw new Error("فیلد trash نامعتبر است.");
    obj.blocks.forEach(function (b, i) {
      if (!b || typeof b !== "object") throw new Error("بلاک " + i + " نامعتبر");
      if (!b.id) throw new Error("بلاک بدون id");
      if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) {
        throw new Error("تاریخ بلاک نامعتبر: " + (b.title || i));
      }
      if (b.start != null && b.end != null) {
        if (!(Number(b.start) >= 0 && Number(b.end) > Number(b.start) && Number(b.end) <= 1440)) {
          throw new Error("ساعت نامعتبر برای «" + (b.title || "") + "»");
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
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    return text;
  }

  function buildPrompt(currentData, command) {
    return [
      "تو ایجنت برنامه‌ریز اپ tilo هستی. فقط JSON معتبر برگردان؛ هیچ توضیح اضافه‌ای ننویس.",
      "ساختار اجباری:",
      '{"version":1,"updatedAt":string|null,"blocks":[{"id":string,"date":"YYYY-MM-DD","title":string,"note":string,"category":"deep|health|growth|general|recovery","color":string|null,"start":number|null,"end":number|null,"done":boolean,"domino":boolean}],"trash":[],"finalized":{}}',
      "start/end = دقیقه از نیمه‌شب (۰ تا ۱۴۴۰). برای خرده‌کار start و end را null بگذار.",
      "idهای موجود را تا حد ممکن حفظ کن. فقط طبق دستور کاربر تغییر بده.",
      "دیتای فعلی:",
      currentData,
      "دستور کاربر:",
      command
    ].join("\n");
  }

  async function runAgent() {
    var apiKey = getKey();
    var input = $("tilo-agent-input");
    var btn = $("tilo-agent-submit");
    var command = input ? String(input.value || "").trim() : "";
    if (!apiKey) {
      alert("اول کلید API را با 🔒 وارد کن.");
      return;
    }
    if (!command) {
      alert("دستور را بنویس.");
      return;
    }

    var currentData = localStorage.getItem(DATA_KEY);
    if (!currentData) {
      alert("هنوز دیتای تایم‌بلاک ذخیره نشده. اول چند کار در تایم‌بلاک بساز.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "در حال پردازش…";
    setStatus("ارسال به Gemini…");

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

      var jsonText = extractJsonText(part.text);
      var parsed = JSON.parse(jsonText);
      parsed = validatePlanner(parsed);
      parsed.updatedAt = new Date().toISOString();

      try {
        localStorage.setItem(BACKUP_KEY, currentData);
      } catch (_) {}

      localStorage.setItem(DATA_KEY, JSON.stringify(parsed));
      setStatus("ذخیره شد. در حال رفرش…");
      location.reload();
    } catch (err) {
      console.warn("[tilo-ai-agent]", err);
      setStatus("خطا: " + (err && err.message ? err.message : err));
      alert("خطا در اجرای ایجنت: " + (err && err.message ? err.message : err));
      btn.disabled = false;
      btn.textContent = "اجرای تغییر روی برنامه";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectUI);
  } else {
    injectUI();
  }
})();
