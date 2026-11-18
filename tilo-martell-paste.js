/**
 * tilo-martell-paste.js — چسباندن متن برنامه (از Gemini و …) و ساخت خودکار پارت‌ها
 * بدون API · فقط localStorage
 *
 * نصب: بعد از tilo-martell.js
 *   <script src="./tilo-martell-paste.js?v=1" defer></script>
 *
 * متن نمونه قابل‌قبول:
 *   15:30 تا 16:55 | عنوان: هندسه ۳ | دسته: کار عمیق / تخصصی
 *   ۰۵:۰۰-۰۶:۳۰ مطالعه کتاب
 *   07:00 تا 14:30 | مدرسه و کلاس فیزیک
 */
(function () {
  "use strict";
  if (window.__TILO_MARTELL_PASTE__) return;
  window.__TILO_MARTELL_PASTE__ = true;

  const KEY = "tilo_martell_planner";
  const BACKUP_KEY = "tilo_martell_planner_paste_backup";

  const CATS = {
    deep: { name: "کار عمیق / تخصصی", color: "#6366f1", keys: ["عمیق", "تخصصی", "هندسه", "فیزیک", "شیمی", "حسابان", "گسسته", "زیست", "آمار", "نمونه سوال", "تثبیت", "حل"] },
    general: { name: "نیمه‌عمیق / عمومی", color: "#06b6d4", keys: ["نیمه‌عمیق", "عمومی", "دین", "فارسی", "عربی", "زبان", "نگارش", "مدرسه", "کلاس"] },
    recovery: { name: "ریکاوری و استراحت", color: "#64748b", keys: ["ریکاوری", "استراحت", "ناهار", "شام", "صبحانه", "خواب", "بازیابی", "خاموشی"] },
    growth: { name: "رشد فردی", color: "#f59e0b", keys: ["رشد", "کتاب", "باشگاه ذهن", "بازبینی", "برنامه فردا", "پیشرفت"] },
    health: { name: "ورزش و سلامت", color: "#10b981", keys: ["ورزش", "سلامت", "دویدن", "پیاده‌روی", "باشگاه"] }
  };

  const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

  function toEnDigits(s) {
    return String(s || "").replace(/[۰-۹٠-٩]/g, function (ch) {
      const i = PERSIAN_DIGITS.indexOf(ch);
      if (i >= 0) return String(i);
      const j = ARABIC_DIGITS.indexOf(ch);
      return j >= 0 ? String(j) : ch;
    });
  }

  function uid() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayKey() {
    try {
      const p = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date());
      const get = t => p.find(x => x.type === t).value;
      return get("year") + "-" + get("month") + "-" + get("day");
    } catch (_) {
      const d = new Date();
      return d.toISOString().slice(0, 10);
    }
  }

  function parseHHMM(str) {
    const t = toEnDigits(str).trim();
    const m = t.match(/^(\d{1,2})[:\.](\d{2})$/);
    if (!m) return null;
    const h = +m[1];
    const min = +m[2];
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  function guessCategory(title, explicit) {
    const blob = toEnDigits((explicit || "") + " " + (title || "")).toLowerCase();
    // explicit Persian category names first
    if (/کار\s*عمیق|تخصصی/.test(blob)) return "deep";
    if (/نیمه\s*عمیق|عمومی/.test(blob)) return "general";
    if (/ریکاور|استراحت|بازیابی/.test(blob)) return "recovery";
    if (/رشد\s*فردی|رشد/.test(blob)) return "growth";
    if (/ورزش|سلامت/.test(blob)) return "health";
    if (/مدرسه|کلاس/.test(blob)) return "general";

    for (const key of Object.keys(CATS)) {
      for (const k of CATS[key].keys) {
        if (blob.indexOf(k) !== -1) return key;
      }
    }
    // default: study-ish title → deep
    if (/مطالعه|درس|تمرین|حل|مرور|تست/.test(blob)) return "deep";
    return "general";
  }

  /**
   * Parse free text into blocks for a given date.
   * Supports:
   *  - 15:30 تا 16:55 | عنوان: ... | دسته: ...
   *  - 15:30-16:55 عنوان
   *  - bullet / numbered lines
   *  - JSON array or { blocks: [...] }
   */
  function parsePaste(text, dateKey) {
    const raw = String(text || "").trim();
    if (!raw) return { blocks: [], errors: ["متن خالی است."] };

    // Try JSON first
    if (raw[0] === "{" || raw[0] === "[") {
      try {
        let obj = JSON.parse(raw);
        let list = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.blocks) ? obj.blocks : null);
        if (list) {
          const blocks = list.map(function (b) {
            const title = String(b.title || b.name || "").trim().slice(0, 120);
            if (!title) return null;
            let start = null, end = null;
            if (typeof b.start === "number") start = b.start;
            if (typeof b.end === "number") end = b.end;
            if (typeof b.start === "string") start = parseHHMM(b.start);
            if (typeof b.end === "string") end = parseHHMM(b.end);
            const cat = Object.prototype.hasOwnProperty.call(CATS, b.category)
              ? b.category
              : guessCategory(title, b.categoryName || b.category || "");
            return {
              id: uid(),
              date: dateKey,
              title: title,
              note: String(b.note || "").slice(0, 600),
              category: cat,
              color: CATS[cat].color,
              start: start,
              end: end,
              done: false,
              domino: !!b.domino
            };
          }).filter(Boolean);
          return { blocks: blocks, errors: blocks.length ? [] : ["در JSON عنوان معتبری نبود."] };
        }
      } catch (_) { /* fall through to line parser */ }
    }

    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const blocks = [];
    const errors = [];

    // Pattern: time تا/to/- time | optional labels
    const re = /^[-•*]?\s*(\d{1,2}[:\.]\d{2})\s*(?:تا|to|-|–|—)\s*(\d{1,2}[:\.]\d{2})\s*(?:\|)?\s*(.*)$/i;

    lines.forEach(function (line, idx) {
      const en = toEnDigits(line);
      const m = en.match(re);
      if (!m) {
        // title-only line without time → skip silently if too short
        if (en.length > 8) errors.push("خط " + (idx + 1) + " ساعت ندارد و رد شد.");
        return;
      }
      const start = parseHHMM(m[1]);
      const end = parseHHMM(m[2]);
      if (start == null || end == null || start >= end) {
        errors.push("خط " + (idx + 1) + ": ساعت نامعتبر.");
        return;
      }

      let rest = (m[3] || "").trim();
      let title = rest;
      let catExplicit = "";

      // | عنوان: x | دسته: y
      const titleMatch = rest.match(/(?:عنوان|title)\s*[:：]\s*([^|]+)/i);
      const catMatch = rest.match(/(?:دسته|category|cat)\s*[:：]\s*([^|]+)/i);
      if (titleMatch) title = titleMatch[1].trim();
      if (catMatch) catExplicit = catMatch[1].trim();

      // strip leading pipes / labels if plain
      title = title.replace(/^\|\s*/, "").replace(/\s*\|\s*دسته\s*[:：].*$/i, "").trim();
      if (!title) title = "بدون عنوان";
      title = title.slice(0, 120);

      const cat = guessCategory(title, catExplicit);
      blocks.push({
        id: uid(),
        date: dateKey,
        title: title,
        note: "",
        category: cat,
        color: CATS[cat].color,
        start: start,
        end: end,
        done: false,
        domino: false
      });
    });

    if (!blocks.length && !errors.length) errors.push("هیچ پارتی با فرمت ساعت پیدا نشد.");
    return { blocks: blocks, errors: errors };
  }

  function readData() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} };
      const p = JSON.parse(raw);
      if (!p || typeof p !== "object") throw new Error("bad");
      if (!Array.isArray(p.blocks)) p.blocks = [];
      if (!Array.isArray(p.trash)) p.trash = [];
      if (!p.finalized || typeof p.finalized !== "object") p.finalized = {};
      return p;
    } catch (_) {
      return { version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} };
    }
  }

  function writeData(data, mode, dateKey, newBlocks) {
    const prevRaw = localStorage.getItem(KEY);
    if (prevRaw) {
      try { localStorage.setItem(BACKUP_KEY, prevRaw); } catch (_) {}
    }

    let next = readData();
    if (mode === "replace-day") {
      next.blocks = next.blocks.filter(b => b.date !== dateKey).concat(newBlocks);
    } else {
      // append
      next.blocks = next.blocks.concat(newBlocks);
    }
    next.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(next));
    try {
      window.dispatchEvent(new CustomEvent("tilo:planner-updated", { detail: next }));
    } catch (_) {}
    // soft refresh if martell exposes API
    try {
      if (window.tiloMartell && typeof window.tiloMartell.refresh === "function") {
        window.tiloMartell.refresh();
      }
    } catch (_) {}
  }

  function fmtMin(m) {
    if (m == null) return "—";
    const h = Math.floor(m / 60);
    const min = m % 60;
    return String(h).padStart(2, "0") + ":" + String(min).padStart(2, "0");
  }

  function injectStyles() {
    if (document.getElementById("tmpaste-css")) return;
    const s = document.createElement("style");
    s.id = "tmpaste-css";
    s.textContent = [
      "#tmpaste-panel{margin:12px;padding:12px;border-radius:14px;border:1px solid rgba(53,99,78,.35);",
      "background:color-mix(in srgb,#35634e 8%,var(--tm-card,#fff));direction:rtl;font-family:inherit}",
      "body.tilo-theme-night #tmpaste-panel{background:rgba(22,41,33,.9);border-color:rgba(110,231,183,.25)}",
      "#tmpaste-panel h3{margin:0 0 6px;font-size:13px;font-weight:800;color:#35634e}",
      "body.tilo-theme-night #tmpaste-panel h3{color:#6ee7b7}",
      "#tmpaste-panel .tmp-hint{font-size:11px;color:#68766d;margin:0 0 8px;line-height:1.6}",
      "#tmpaste-ta{width:100%;min-height:90px;max-height:180px;resize:vertical;border-radius:10px;",
      "border:1px solid rgba(53,99,78,.35);padding:8px 10px;font:inherit;font-size:12px;",
      "background:var(--tm-bg,#f4f6f2);color:var(--tm-text,#253b31);box-sizing:border-box}",
      "body.tilo-theme-night #tmpaste-ta{background:#0e1613;color:#ecfdf5;border-color:#2d5a47}",
      "#tmpaste-panel .tmp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}",
      "#tmpaste-panel label{font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px}",
      "#tmpaste-panel select,#tmpaste-date{font:inherit;font-size:12px;border-radius:8px;padding:5px 8px;",
      "border:1px solid rgba(53,99,78,.35);background:var(--tm-card,#fff)}",
      "#tmpaste-apply,#tmpaste-preview{border:0;border-radius:10px;padding:8px 12px;font:inherit;",
      "font-size:12px;font-weight:800;cursor:pointer}",
      "#tmpaste-apply{background:#35634e;color:#fff}",
      "#tmpaste-preview{background:transparent;border:1px solid rgba(53,99,78,.4)!important;color:#35634e}",
      "#tmpaste-out{margin-top:8px;font-size:11.5px;line-height:1.65;max-height:160px;overflow:auto}",
      "#tmpaste-out .ok{color:#15803d}#tmpaste-out .err{color:#b94738}",
      "#tmpaste-out .item{padding:4px 0;border-bottom:1px dashed rgba(0,0,0,.08)}",
      "#tmpaste-toggle{width:100%;text-align:right;background:0;border:0;font:inherit;font-size:12px;",
      "font-weight:800;color:#35634e;cursor:pointer;padding:4px 0}",
      "body.tilo-theme-night #tmpaste-toggle{color:#6ee7b7}"
    ].join("");
    document.head.appendChild(s);
  }

  function buildPanel() {
    injectStyles();
    const panel = document.createElement("section");
    panel.id = "tmpaste-panel";
    panel.innerHTML = [
      '<button type="button" id="tmpaste-toggle">▾ چسباندن برنامه از متن (بدون هوش مصنوعی)</button>',
      '<div id="tmpaste-body">',
      '<p class="tmp-hint">متن برنامه را از Gemini کپی کن و اینجا بچسبان. فقط همان روز عوض می‌شود؛ بقیهٔ هفته دست نمی‌خورد. قبل از ذخیره بکاپ گرفته می‌شود.</p>',
      '<textarea id="tmpaste-ta" placeholder="مثال:\\n15:30 تا 16:55 | عنوان: هندسه ۳ | دسته: کار عمیق / تخصصی\\n16:55 تا 17:15 | عنوان: استراحت | دسته: ریکاوری و استراحت"></textarea>',
      '<div class="tmp-row">',
      '<label>روز <input type="date" id="tmpaste-date" /></label>',
      '<label><input type="radio" name="tmpaste-mode" value="replace-day" checked /> جایگزینی فقط همین روز</label>',
      '<label><input type="radio" name="tmpaste-mode" value="append" /> افزودن به برنامهٔ روز</label>',
      '</div>',
      '<div class="tmp-row">',
      '<button type="button" id="tmpaste-preview">پیش‌نمایش</button>',
      '<button type="button" id="tmpaste-apply">اعمال و ذخیره</button>',
      '</div>',
      '<div id="tmpaste-out"></div>',
      '</div>'
    ].join("");

    const dateInput = panel.querySelector("#tmpaste-date");
    dateInput.value = todayKey();

    let open = true;
    const body = panel.querySelector("#tmpaste-body");
    panel.querySelector("#tmpaste-toggle").onclick = function () {
      open = !open;
      body.style.display = open ? "block" : "none";
      this.textContent = (open ? "▾" : "▸") + " چسباندن برنامه از متن (بدون هوش مصنوعی)";
    };

    const out = panel.querySelector("#tmpaste-out");

    function currentMode() {
      const r = panel.querySelector('input[name="tmpaste-mode"]:checked');
      return r ? r.value : "replace-day";
    }

    function run(previewOnly) {
      const dateKey = dateInput.value || todayKey();
      const text = panel.querySelector("#tmpaste-ta").value;
      const parsed = parsePaste(text, dateKey);
      if (!parsed.blocks.length) {
        out.innerHTML = '<p class="err">' + (parsed.errors.join("<br>") || "پارسی پیدا نشد.") + "</p>";
        return;
      }
      let html = '<p class="ok">' + parsed.blocks.length + " پارت برای " + dateKey +
        (previewOnly ? " (پیش‌نمایش — هنوز ذخیره نشده)" : "") + "</p>";
      parsed.blocks.forEach(function (b) {
        html += '<div class="item"><span style="color:' + b.color + '">●</span> ' +
          fmtMin(b.start) + "–" + fmtMin(b.end) + " · <b>" + escapeHtml(b.title) + "</b> · " +
          escapeHtml(CATS[b.category].name) + "</div>";
      });
      if (parsed.errors.length) {
        html += '<p class="err">' + parsed.errors.map(escapeHtml).join("<br>") + "</p>";
      }
      out.innerHTML = html;

      if (!previewOnly) {
        if (!window.confirm(
          (currentMode() === "replace-day"
            ? "پارت‌های همین روز پاک و با این " + parsed.blocks.length + " پارت جایگزین شوند؟"
            : parsed.blocks.length + " پارت به این روز اضافه شود؟") +
          "\n(از بقیهٔ هفته بکاپ گرفته می‌شود)"
        )) return;
        try {
          writeData(null, currentMode(), dateKey, parsed.blocks);
          out.innerHTML = html + '<p class="ok">ذخیره شد. اگر صفحه مارتل باز است یک‌بار ببند و دوباره باز کن یا رفرش بزن.</p>';
          // try force remount by custom event many apps listen to storage
          try {
            window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: localStorage.getItem(KEY) }));
          } catch (_) {}
        } catch (e) {
          out.innerHTML = '<p class="err">خطا در ذخیره: ' + escapeHtml(e.message || String(e)) + "</p>";
        }
      }
    }

    panel.querySelector("#tmpaste-preview").onclick = function () { run(true); };
    panel.querySelector("#tmpaste-apply").onclick = function () { run(false); };
    return panel;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tryMount() {
    const host = document.getElementById("tilo-martell");
    if (!host) return false;
    if (document.getElementById("tmpaste-panel")) return true;
    // prefer appending at the very end of scrollable content
    const panel = buildPanel();
    host.appendChild(panel);
    return true;
  }

  // Observe martell open/close
  const obs = new MutationObserver(function () {
    tryMount();
  });
  function start() {
    tryMount();
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    }
    // also poll lightly for a few seconds after load
    let n = 0;
    const t = setInterval(function () {
      tryMount();
      if (++n > 40) clearInterval(t);
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.tiloMartellPaste = {
    parse: parsePaste,
    apply: function (text, dateKey, mode) {
      const d = dateKey || todayKey();
      const parsed = parsePaste(text, d);
      if (!parsed.blocks.length) throw new Error(parsed.errors.join(" ") || "خالی");
      writeData(null, mode || "replace-day", d, parsed.blocks);
      return parsed.blocks.length;
    }
  };
})();
