/**
 * tilo-martell-bridge.js — اتصال تایم‌بلاک → صف/تایمر tilo
 * بعد از tilo-upgrade.js و tilo-martell.js:
 *   <script src="./tilo-martell-bridge.js?v=1" defer></script>
 */
(function () {
  "use strict";
  if (window.__tiloMartellBridge) return;
  window.__tiloMartellBridge = true;

  function pushPending(detail) {
    if (!detail) return false;
    var title = String(detail.title || detail.topic || "پارت").trim();
    if (!title) return false;
    var minutes = Math.max(1, Number(detail.minutes || detail.plannedTime || 60) || 60);

    // مسیر ۱: API رسمی اگر وجود داشت
    try {
      if (window.TiloPro && typeof window.TiloPro.queueFromMartell === "function") {
        window.TiloPro.queueFromMartell(detail);
        return true;
      }
    } catch (_) {}

    // مسیر ۲: localStorage صف کمکی
    try {
      var key = "tilo_martell_timer_queue";
      var q = [];
      try { q = JSON.parse(localStorage.getItem(key) || "[]"); } catch (_) { q = []; }
      if (!Array.isArray(q)) q = [];
      q.push({
        id: "mm-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        title: title,
        topic: title,
        plannedTime: minutes,
        subjects: detail.isNonStudy ? [] : [title],
        isNonStudy: !!detail.isNonStudy,
        isLife: !!detail.isLife,
        category: detail.category || "deep",
        note: String(detail.note || ""),
        from: "martell",
        at: new Date().toISOString()
      });
      localStorage.setItem(key, JSON.stringify(q.slice(-40)));
      return true;
    } catch (_) {
      return false;
    }
  }

  window.tiloMartellToTimer = function (detail) {
    return pushPending(detail);
  };

  window.addEventListener("tilo:queue-part", function (ev) {
    pushPending(ev && ev.detail);
  });
})();
