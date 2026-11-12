/**
 * tilo-martell-bridge.js — اتصال واقعی تایم‌بلاک → پارت/تایمر tilo
 * <script src="./tilo-martell-bridge.js?v=2" defer></script>
 */
(function () {
  "use strict";
  if (window.__tiloMartellBridge) return;
  window.__tiloMartellBridge = true;

  function tehranISO() {
    try {
      var fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tehran",
        year: "numeric", month: "2-digit", day: "2-digit"
      });
      // en-CA often gives YYYY-MM-DD
      var parts = fmt.formatToParts(new Date());
      var y = parts.find(function (p) { return p.type === "year"; }).value;
      var m = parts.find(function (p) { return p.type === "month"; }).value;
      var d = parts.find(function (p) { return p.type === "day"; }).value;
      return y + "-" + m + "-" + d;
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function tehranDateStr() {
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        timeZone: "Asia/Tehran", month: "short", day: "numeric"
      }).format(new Date());
    } catch (_) {
      return "";
    }
  }

  function buildPart(detail) {
    var title = String((detail && (detail.title || detail.topic)) || "پارت").trim();
    var minutes = Math.max(1, Number((detail && (detail.minutes || detail.plannedTime)) || 60) || 60);
    var nonStudy = !!(detail && (detail.isNonStudy || detail.isLife || detail.category === "recovery" || detail.category === "health" || detail.category === "growth"));
    return {
      id: Date.now() + Math.floor(Math.random() * 999),
      dateISO: tehranISO(),
      dateStr: tehranDateStr(),
      subjects: nonStudy ? [] : [title],
      topic: title,
      customTitle: title,
      description: String((detail && detail.note) || ""),
      type: nonStudy ? "غیردرسی" : "آموزشی / مطالعاتی",
      category: nonStudy ? "غیردرسی / بازیابی" : "کنکوری",
      plannedTime: minutes,
      subParts: [],
      realTime: 0,
      pauseCount: 0,
      pauseMinutes: 0,
      descriptiveCount: 0,
      status: "pending",
      tests: { correct: 0, wrong: 0, unanswered: 0, total: 0 },
      notes: "",
      isLife: nonStudy,
      isNonStudy: nonStudy,
      updatedAt: Date.now(),
      fromMartell: true
    };
  }

  function getVueProxy() {
    var el = document.querySelector("#app");
    if (!el) return null;
    try {
      if (el.__vue_app__ && el.__vue_app__._instance) {
        return el.__vue_app__._instance.proxy || el.__vue_app__._instance.ctx || null;
      }
    } catch (_) {}
    try {
      if (el._vnode && el._vnode.component) {
        return el._vnode.component.proxy || el._vnode.component.ctx || null;
      }
    } catch (_) {}
    return null;
  }

  function unwrap(refOrVal) {
    if (refOrVal && typeof refOrVal === "object" && "value" in refOrVal) return refOrVal.value;
    return refOrVal;
  }

  function setRef(refOrVal, next) {
    if (refOrVal && typeof refOrVal === "object" && "value" in refOrVal) refOrVal.value = next;
  }

  function pushToVue(part, goTimer) {
    var proxy = getVueProxy();
    if (!proxy) return false;
    try {
      var parts = proxy.parts;
      var arr = unwrap(parts);
      if (!Array.isArray(arr)) return false;
      arr.unshift(part);
      if (parts && "value" in parts) parts.value = arr;

      if (typeof proxy.saveAll === "function") proxy.saveAll();
      else if (typeof proxy.saveParts === "function") proxy.saveParts();
      else {
        try { localStorage.setItem("sp_pro_parts", JSON.stringify(arr)); } catch (_) {}
      }

      if (goTimer) {
        if (typeof proxy.selectPartAndGoToTimer === "function") {
          proxy.selectPartAndGoToTimer(part);
        } else {
          var timer = proxy.timer;
          var t = unwrap(timer) || {};
          t.mode = "part";
          t.selectedPartId = part.id;
          if (timer && "value" in timer) timer.value = t;
          if (proxy.currentTab && "value" in proxy.currentTab) proxy.currentTab.value = "timer";
          else if ("currentTab" in proxy) proxy.currentTab = "timer";
        }
      }
      return true;
    } catch (e) {
      console.warn("[tilo-martell-bridge] vue push failed", e);
      return false;
    }
  }

  function pushToStorage(part) {
    try {
      var raw = localStorage.getItem("sp_pro_parts");
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) arr = [];
      arr.unshift(part);
      localStorage.setItem("sp_pro_parts", JSON.stringify(arr));
      return true;
    } catch (_) {
      return false;
    }
  }

  function pushPending(detail) {
    if (!detail) return false;
    var part = buildPart(detail);
    var ok = pushToVue(part, true);
    if (!ok) {
      pushToStorage(part);
      try {
        alert("پارت «" + part.topic + "» ذخیره شد. یک‌بار صفحه را رفرش کن یا برو تب تایمر.");
      } catch (_) {}
    }
    return true;
  }

  window.tiloMartellToTimer = function (detail) {
    return pushPending(detail);
  };

  window.addEventListener("tilo:queue-part", function (ev) {
    pushPending(ev && ev.detail);
  });
})();
