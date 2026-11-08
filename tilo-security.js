/**
 * tilo-security.js — لایهٔ سبک امنیتی سمت‌کاربر
 * قبل از </body> بعد از اسکریپت‌های اصلی:
 *   <script src="./tilo-security.js?v=1" defer></script>
 *
 * چه می‌کند:
 *  - escapeHtml سراسری (window.tiloEscapeHtml)
 *  - پاکسازی رشته‌های مشکوک هنگام خواندن کلیدهای شناخته‌شدهٔ localStorage
 *  - هشدار کنسول اگر کانفیگ Firebase در localStorage باشد (یادآوری Rules)
 *  - پوشش محدود برای innerHTML روی چند ظرف شناخته‌شدهٔ tilo-upgrade
 *
 * چه نمی‌کند:
 *  - رمزنگاری داده
 *  - جلوگیری از دسترسی کسی که گوشی قفل‌نشده دارد
 *  - جایگزین Firestore Rules
 */
(function () {
  "use strict";
  if (window.__tiloSecurityLoaded) return;
  window.__tiloSecurityLoaded = true;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  window.tiloEscapeHtml = escapeHtml;

  function stripDangerous(str) {
    if (typeof str !== "string") return str;
    return str
      .replace(/<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
      .replace(/<\s*iframe[\s\S]*?>[\s\S]*?<\s*\/\s*iframe\s*>/gi, "")
      .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, "")
      .replace(/\bon\w+\s*=\s*[^\s>]+/gi, "")
      .replace(/javascript\s*:/gi, "");
  }

  function sanitizeValue(v, depth) {
    if (depth > 8) return v;
    if (typeof v === "string") return stripDangerous(v);
    if (Array.isArray(v)) return v.map(function (x) { return sanitizeValue(x, depth + 1); });
    if (v && typeof v === "object") {
      var out = {};
      Object.keys(v).forEach(function (k) {
        out[k] = sanitizeValue(v[k], depth + 1);
      });
      return out;
    }
    return v;
  }

  var STORAGE_KEYS = [
    "sp_pro_parts",
    "sp_pro_settings",
    "sp_pro_subjects",
    "tilo_schedule",
    "tilo_archive",
    "tilo_problems",
    "tilo_weekly_parts",
    "tilo_martell_planner",
    "tilo_notes_v2",
    "tilo_notebook_v1",
    "tilo_cached_user"
  ];

  function hardenStorage() {
    try {
      STORAGE_KEYS.forEach(function (key) {
        var raw = localStorage.getItem(key);
        if (!raw) return;
        try {
          var parsed = JSON.parse(raw);
          var clean = sanitizeValue(parsed, 0);
          var next = JSON.stringify(clean);
          if (next !== raw) localStorage.setItem(key, next);
        } catch (_) {
          /* JSON نبود؛ دست نزن */
        }
      });
    } catch (_) {}
  }

  function warnFirebase() {
    try {
      if (localStorage.getItem("tilo_fb_config")) {
        console.info(
          "[tilo-security] کانفیگ Firebase روی این دستگاه ذخیره است. " +
          "امنیت دادهٔ ابری فقط با Firestore Rules درست است، نه با مخفی‌کردن apiKey."
        );
      }
    } catch (_) {}
  }

  /**
   * برای چند ظرف که tilo-upgrade با دادهٔ کاربر پر می‌کند،
   * بعد از هر تغییر DOM متن را در حد پایه از تگ script پاک می‌کنیم.
   * این جایگزین escape در منبع نیست؛ لایهٔ دفاعی اضافه است.
   */
  function observeSinks() {
    var ids = [
      "tilo-timer-quick-queue",
      "tilo-ai-out",
      "tilo-ai-consultant-section"
    ];
    if (typeof MutationObserver !== "function") return;

    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        var node = m.target;
        if (!node || node.nodeType !== 1) return;
        if (ids.indexOf(node.id) === -1 && !ids.some(function (id) {
          return node.closest && node.closest("#" + id);
        })) return;
        // حذف script تزریق‌شده در زیر این گره‌ها
        try {
          node.querySelectorAll("script").forEach(function (s) { s.remove(); });
        } catch (_) {}
      });
    });

    var start = function () {
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) obs.observe(el, { childList: true, subtree: true });
      });
    };
    start();
    setInterval(start, 3000);
  }

  function patchPendingQueueRenderer() {
    /* اگر نسخهٔ upgrade بعداً escape داشت، تداخل بی‌ضرر است */
  }

  hardenStorage();
  warnFirebase();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeSinks);
  } else {
    observeSinks();
  }
  patchPendingQueueRenderer();
})();
