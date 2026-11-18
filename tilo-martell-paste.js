/**
 * tilo-martell-paste.js v3 — چسباندن متن برنامه و ساخت خودکار پارت‌ها
 * بدون API · فقط همان روز را پاک و جایگزین می‌کند
 *
 * نصب (بعد از tilo-martell.js):
 *   <script src="./tilo-martell-paste.js?v=3" defer></script>
 *
 * می‌توانی اول متن بنویسی چی می‌خواهی، بعد لیست ساعت‌ها:
 *
 *   فقط امروز سه‌شنبه را عوض کن
 *   ۰۵:۰۰ تا ۰۶:۳۰ | عنوان: مطالعه کتاب | دسته: رشد فردی | توضیح: باشگاه ذهن
 *   ۱۵:۳۰ تا ۱۶:۵۵ | عنوان: هندسه ۳ | دسته: کار عمیق / تخصصی
 */
(function () {
  "use strict";
  if (window.__TILO_MARTELL_PASTE_V3__) return;
  window.__TILO_MARTELL_PASTE_V3__ = true;

  const KEY = "tilo_martell_planner";
  const BACKUP_KEY = "tilo_martell_planner_paste_backup";

  const CATS = {
    deep: {
      name: "کار عمیق / تخصصی",
      base: "#6366f1",
      palette: ["#6366f1", "#4f46e5", "#7c3aed", "#8b5cf6", "#4338ca", "#a78bfa"],
      keys: ["عمیق", "تخصصی", "هندسه", "فیزیک", "شیمی", "حسابان", "گسسته", "زیست", "آمار", "نمونه سوال", "تثبیت", "حل", "تست"]
    },
    general: {
      name: "نیمه‌عمیق / عمومی",
      base: "#06b6d4",
      palette: ["#06b6d4", "#0891b2", "#0e7490", "#22d3ee", "#0284c7", "#38bdf8"],
      keys: ["نیمه‌عمیق", "عمومی", "دین", "فارسی", "عربی", "زبان", "نگارش", "مدرسه", "کلاس"]
    },
    recovery: {
      name: "ریکاوری و استراحت",
      base: "#64748b",
      palette: ["#64748b"],
      keys: ["ریکاوری", "استراحت", "ناهار", "شام", "صبحانه", "خواب", "بازیابی", "خاموشی"]
    },
    growth: {
      name: "رشد فردی",
      base: "#f59e0b",
      palette: ["#f59e0b", "#d97706", "#fbbf24", "#ea580c", "#fb923c", "#eab308"],
      keys: ["رشد", "کتاب", "باشگاه ذهن", "بازبینی", "برنامه فردا", "پیشرفت"]
    },
    health: {
      name: "ورزش و سلامت",
      base: "#10b981",
      palette: ["#10b981", "#059669", "#34d399", "#047857", "#6ee7b7", "#14b8a6"],
      keys: ["ورزش", "سلامت", "دویدن", "پیاده‌روی", "باشگاه"]
    }
  };

  const DAY_NAMES = {
    "شنبه": 0, "یکشنبه": 1, "دوشنبه": 2, "سه‌شنبه": 3, "سه شنبه": 3,
    "چهارشنبه": 4, "چهار شنبه": 4, "پنجشنبه": 5, "پنج شنبه": 5, "جمعه": 6
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
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayKey() {
    try {
      const p = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tehran",
        year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const get = t => p.find(x => x.type === t).value;
      return get("year") + "-" + get("month") + "-" + get("day");
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function addDays(key, n) {
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return yy + "-" + mm + "-" + dd;
  }

  /** شنبه هفتهٔ جاری (تهران) */
  function weekStartSaturday(key) {
    const [y, m, d] = key.split("-").map(Number);
    // JS: 0=Sun ...6=Sat — تبدیل به شنبه=0
    const utc = new Date(Date.UTC(y, m - 1, d));
    const jsDay = utc.getUTCDay(); // 0 Sun
    const satIndex = (jsDay + 1) % 7; // 0 = Sat
    return addDays(key, -satIndex);
  }

  function dateFromDayName(name, baseKey) {
    if (!name || DAY_NAMES[name] === undefined) return null;
    const start = weekStartSaturday(baseKey || todayKey());
    return addDays(start, DAY_NAMES[name]);
  }

  function parseHHMM(str) {
    const t = toEnDigits(str).trim();
    const m = t.match(/^(\d{1,2})[:\.](\d{2})$/);
    if (!m) return null;
    const h = +m[1], min = +m[2];
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  function fmtMin(m) {
    if (m == null) return "—";
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }

  function guessCategory(title, explicit) {
    const blob = ((explicit || "") + " " + (title || "")).toLowerCase();
    if (/کار\s*عمیق|تخصصی/.test(blob)) return "deep";
    if (/نیمه\s*عمیق|عمومی/.test(blob)) return "general";
    if (/ریکاور|استراحت|بازیابی/.test(blob)) return "recovery";
    if (/رشد\s*فردی|^رشد|رشد\s/.test(blob)) return "growth";
    if (/ورزش|سلامت/.test(blob)) return "health";
    if (/مدرسه|کلاس/.test(blob)) return "general";
    for (const key of Object.keys(CATS)) {
      for (const k of CATS[key].keys) {
        if (blob.indexOf(k) !== -1) return key;
      }
    }
    if (/مطالعه|درس|تمرین|حل|مرور|تست|نمونه/.test(blob)) return "deep";
    return "general";
  }

  /** رنگ متنوع برای هر پارت؛ استراحت همیشه یک رنگ ثابت */
  function pickColor(cat, indexInCat) {
    const c = CATS[cat] || CATS.general;
    if (cat === "recovery") return c.base;
    const pal = c.palette || [c.base];
    return pal[indexInCat % pal.length];
  }

  /**
   * هدر متن را می‌خواند:
   * - «فقط امروز» / «امروز»
   * - نام روز: سه‌شنبه، فردا، …
   * - «جایگزین کن» (پیش‌فرض) یا «اضافه کن»
   */
  function readHeader(text, fallbackDate) {
    const lines = String(text || "").split(/\r?\n/);
    let dateKey = fallbackDate || todayKey();
    let mode = "replace-day";
    let headerLines = 0;
    const headerBlob = lines.slice(0, 6).join("\n");

    if (/فقط\s*امروز|برنامه\s*امروز|امروز\s*را|امروز\s*رو/.test(headerBlob)) {
      dateKey = todayKey();
    }
    if (/فردا/.test(headerBlob)) {
      dateKey = addDays(todayKey(), 1);
    }
    Object.keys(DAY_NAMES).forEach(function (name) {
      if (headerBlob.indexOf(name) !== -1) {
        const d = dateFromDayName(name, todayKey());
        if (d) dateKey = d;
      }
    });
    if (/اضافه\s*کن|افزودن|append/i.test(headerBlob)) mode = "append";
    if (/جایگزین|پاک\s*کن|عوض\s*کن|replace/i.test(headerBlob)) mode = "replace-day";

    // خطوط اول بدون ساعت = هدر توضیحی (رد می‌شوند از پارس پارت)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const en = toEnDigits(lines[i]);
      if (!/\d{1,2}[:\.]\d{2}/.test(en)) headerLines = i + 1;
      else break;
    }

    return { dateKey: dateKey, mode: mode, headerLines: headerLines };
  }

  function parseLineFields(rest) {
    let title = rest;
    let catExplicit = "";
    let note = "";

    const titleMatch = rest.match(/(?:عنوان|title|تیتر)\s*[:：]\s*([^|]+)/i);
    const catMatch = rest.match(/(?:دسته|category|cat)\s*[:：]\s*([^|]+)/i);
    const noteMatch = rest.match(/(?:توضیح|توضیحات|note|شرح)\s*[:：]\s*([^|]+)/i);

    if (titleMatch) title = titleMatch[1].trim();
    if (catMatch) catExplicit = catMatch[1].trim();
    if (noteMatch) note = noteMatch[1].trim();

    // اگر بدون برچسب بود: بقیه متن عنوان است
    if (!titleMatch) {
      title = rest
        .replace(/\s*\|\s*دسته\s*[:：].*$/i, "")
        .replace(/\s*\|\s*توضیح\w*\s*[:：].*$/i, "")
        .replace(/^\|\s*/, "")
        .trim();
    }
    if (!title) title = "بدون عنوان";
    return {
      title: title.slice(0, 120),
      catExplicit: catExplicit,
      note: note.slice(0, 600)
    };
  }

  function parsePaste(text, forcedDate) {
    const raw = String(text || "").trim();
    if (!raw) return { blocks: [], errors: ["متن خالی است."], dateKey: forcedDate || todayKey(), mode: "replace-day" };

    const header = readHeader(raw, forcedDate || todayKey());
    const dateKey = forcedDate || header.dateKey;
    const mode = header.mode;

    // JSON
    if (raw[0] === "{" || raw[0] === "[") {
      try {
        const obj = JSON.parse(raw);
        const list = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.blocks) ? obj.blocks : null);
        if (list) {
          const catCount = {};
          const blocks = list.map(function (b) {
            const title = String(b.title || b.name || "").trim().slice(0, 120);
            if (!title) return null;
            let start = typeof b.start === "number" ? b.start : parseHHMM(b.start);
            let end = typeof b.end === "number" ? b.end : parseHHMM(b.end);
            const cat = Object.prototype.hasOwnProperty.call(CATS, b.category)
              ? b.category
              : guessCategory(title, b.categoryName || b.category || "");
            catCount[cat] = (catCount[cat] || 0) + 1;
            return {
              id: uid(),
              date: dateKey,
              title: title,
              note: String(b.note || "").slice(0, 600),
              category: cat,
              color: pickColor(cat, catCount[cat] - 1),
              start: start,
              end: end,
              done: false,
              domino: !!b.domino
            };
          }).filter(Boolean);
          return { blocks: blocks, errors: blocks.length ? [] : ["JSON بدون عنوان."], dateKey: dateKey, mode: mode };
        }
      } catch (_) {}
    }

    const allLines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const lines = allLines.slice(header.headerLines);
    const blocks = [];
    const errors = [];
    const catCount = {};
    const re = /^[-•*٫]?\s*(\d{1,2}[:\.]\d{2})\s*(?:تا|to|-|–|—)\s*(\d{1,2}[:\.]\d{2})\s*(?:\|)?\s*(.*)$/i;

    lines.forEach(function (line, idx) {
      const en = toEnDigits(line);
      const m = en.match(re);
      if (!m) {
        if (en.length > 10 && !/فقط|امروز|فردا|جایگزین|اضافه/.test(line)) {
          errors.push("خط بدون ساعت رد شد: " + line.slice(0, 40));
        }
        return;
      }
      const start = parseHHMM(m[1]);
      const end = parseHHMM(m[2]);
      if (start == null || end == null || start >= end) {
        errors.push("ساعت نامعتبر در: " + line.slice(0, 40));
        return;
      }
      const fields = parseLineFields(m[3] || "");
      const cat = guessCategory(fields.title, fields.catExplicit);
      catCount[cat] = (catCount[cat] || 0) + 1;
      blocks.push({
        id: uid(),
        date: dateKey,
        title: fields.title,
        note: fields.note,
        category: cat,
        color: pickColor(cat, catCount[cat] - 1),
        start: start,
        end: end,
        done: false,
        domino: false
      });
    });

    // مرتب‌سازی زمانی
    blocks.sort(function (a, b) { return (a.start || 0) - (b.start || 0); });

    if (!blocks.length && !errors.length) errors.push("هیچ پارتی با فرمت ساعت پیدا نشد.");
    return { blocks: blocks, errors: errors, dateKey: dateKey, mode: mode };
  }

  function readData() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} };
      const p = JSON.parse(raw);
      if (!Array.isArray(p.blocks)) p.blocks = [];
      if (!Array.isArray(p.trash)) p.trash = [];
      if (!p.finalized || typeof p.finalized !== "object") p.finalized = {};
      return p;
    } catch (_) {
      return { version: 1, updatedAt: null, blocks: [], trash: [], finalized: {} };
    }
  }

  function writeData(mode, dateKey, newBlocks) {
    const prevRaw = localStorage.getItem(KEY);
    if (prevRaw) {
      try { localStorage.setItem(BACKUP_KEY, prevRaw); } catch (_) {}
    }
    const next = readData();
    if (mode === "replace-day") {
      // فقط همان روز پاک → بقیه هفته دست‌نخورده
      next.blocks = next.blocks.filter(function (b) { return b.date !== dateKey; }).concat(newBlocks);
    } else {
      next.blocks = next.blocks.concat(newBlocks);
    }
    next.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(next));
    try {
      window.dispatchEvent(new CustomEvent("tilo:planner-updated", { detail: next }));
    } catch (_) {}
    try {
      if (window.tiloMartell && typeof window.tiloMartell.refresh === "function") {
        window.tiloMartell.refresh();
      }
    } catch (_) {}
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyles() {
    if (document.getElementById("tmpaste-css")) return;
    const s = document.createElement("style");
    s.id = "tmpaste-css";
    s.textContent = `
#tmpaste-panel{
  margin:16px 12px 24px;
  padding:0;
  border-radius:18px;
  border:1px solid rgba(53,99,78,.22);
  background:linear-gradient(165deg, color-mix(in srgb,#35634e 7%,var(--tm-card,#fff)) 0%, var(--tm-card,#fff) 48%);
  box-shadow:0 10px 28px rgba(37,59,49,.06), 0 1px 0 rgba(255,255,255,.4) inset;
  direction:rtl;
  font-family:inherit;
  overflow:hidden;
}
body.tilo-theme-night #tmpaste-panel{
  background:linear-gradient(165deg, rgba(45,90,71,.22) 0%, rgba(14,22,19,.96) 55%);
  border-color:rgba(110,231,183,.16);
  box-shadow:0 12px 32px rgba(0,0,0,.35);
}
#tmpaste-toggle{
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  text-align:right;
  background:transparent;
  border:0;
  font:inherit;
  font-size:13px;
  font-weight:800;
  color:#2f5a45;
  cursor:pointer;
  padding:14px 16px;
  letter-spacing:-.01em;
}
body.tilo-theme-night #tmpaste-toggle{color:#9fe6c5}
#tmpaste-toggle .tmp-ico{
  width:34px;height:34px;border-radius:12px;
  display:inline-flex;align-items:center;justify-content:center;
  background:rgba(53,99,78,.12);color:#35634e;font-size:15px;flex-shrink:0;
}
body.tilo-theme-night #tmpaste-toggle .tmp-ico{background:rgba(110,231,183,.12);color:#6ee7b7}
#tmpaste-toggle .tmp-chev{opacity:.55;font-size:12px;transition:transform .2s ease}
#tmpaste-toggle[aria-expanded="false"] .tmp-chev{transform:rotate(-90deg)}
#tmpaste-body{padding:0 16px 16px}
#tmpaste-panel .tmp-hint{
  font-size:11.5px;line-height:1.7;color:#6b7a71;margin:0 0 12px;
  padding:10px 12px;border-radius:12px;
  background:rgba(53,99,78,.06);border:1px solid rgba(53,99,78,.08);
}
body.tilo-theme-night #tmpaste-panel .tmp-hint{
  color:#9bb5a8;background:rgba(110,231,183,.05);border-color:rgba(110,231,183,.1);
}
#tmpaste-ta{
  width:100%;min-height:120px;max-height:240px;resize:vertical;
  border-radius:14px;border:1.5px solid rgba(53,99,78,.18);
  padding:12px 14px;font:inherit;font-size:12.5px;line-height:1.7;
  background:color-mix(in srgb, var(--tm-bg,#f4f6f2) 88%, #fff);
  color:var(--tm-text,#253b31);box-sizing:border-box;
  transition:border-color .15s ease, box-shadow .15s ease;
}
#tmpaste-ta:focus{
  outline:none;border-color:#548068;
  box-shadow:0 0 0 3px rgba(53,99,78,.15);
}
body.tilo-theme-night #tmpaste-ta{
  background:#0c1411;color:#ecfdf5;border-color:rgba(110,231,183,.18);
}
body.tilo-theme-night #tmpaste-ta:focus{
  border-color:#6ee7b7;box-shadow:0 0 0 3px rgba(110,231,183,.12);
}
#tmpaste-panel .tmp-row{
  display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;
}
#tmpaste-panel .tmp-mode{
  display:flex;gap:6px;flex-wrap:wrap;width:100%;
}
#tmpaste-panel .tmp-chip{
  appearance:none;border:1px solid rgba(53,99,78,.2);background:rgba(255,255,255,.55);
  color:#3d5c4c;border-radius:999px;padding:7px 12px;font:inherit;font-size:11px;font-weight:750;
  cursor:pointer;transition:all .15s ease;
}
#tmpaste-panel .tmp-chip:has(input:checked),
#tmpaste-panel .tmp-chip.on{
  background:#35634e;color:#fff;border-color:#35634e;
  box-shadow:0 4px 12px rgba(53,99,78,.25);
}
body.tilo-theme-night #tmpaste-panel .tmp-chip{
  background:rgba(255,255,255,.04);color:#b7d4c6;border-color:rgba(110,231,183,.18);
}
body.tilo-theme-night #tmpaste-panel .tmp-chip:has(input:checked){
  background:#2d5a47;color:#ecfdf5;border-color:#3d7a5f;
}
#tmpaste-panel .tmp-chip input{position:absolute;opacity:0;pointer-events:none}
#tmpaste-date{
  font:inherit;font-size:12px;border-radius:10px;padding:8px 10px;
  border:1px solid rgba(53,99,78,.2);background:rgba(255,255,255,.7);color:inherit;
}
body.tilo-theme-night #tmpaste-date{background:#0c1411;border-color:rgba(110,231,183,.18);color:#ecfdf5}
#tmpaste-panel .tmp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
#tmpaste-apply,#tmpaste-preview,#tmpaste-clear{
  border:0;border-radius:12px;padding:10px 14px;font:inherit;font-size:12.5px;font-weight:800;
  cursor:pointer;transition:transform .12s ease, box-shadow .15s ease, filter .15s ease;
}
#tmpaste-apply{
  background:linear-gradient(145deg,#3d7a5f,#2f5a45);color:#fff;
  box-shadow:0 6px 16px rgba(53,99,78,.28);
}
#tmpaste-apply:active{transform:scale(.98)}
#tmpaste-preview{
  background:rgba(53,99,78,.08);color:#2f5a45;border:1px solid rgba(53,99,78,.2)!important;
}
body.tilo-theme-night #tmpaste-preview{background:rgba(110,231,183,.08);color:#9fe6c5;border-color:rgba(110,231,183,.2)!important}
#tmpaste-clear{
  background:transparent;color:#a85a4e;border:1px solid rgba(185,71,56,.25)!important;margin-inline-start:auto;
}
body.tilo-theme-night #tmpaste-clear{color:#f0a89c;border-color:rgba(248,113,113,.3)!important}
#tmpaste-out{margin-top:12px;font-size:12px;line-height:1.65;max-height:200px;overflow:auto;
  border-radius:14px;padding:2px}
#tmpaste-out .tmp-summary{
  display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;
}
#tmpaste-out .tmp-badge{
  font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:999px;
  background:rgba(53,99,78,.1);color:#2f5a45;
}
body.tilo-theme-night #tmpaste-out .tmp-badge{background:rgba(110,231,183,.1);color:#9fe6c5}
#tmpaste-out .ok{color:#15803d;font-weight:700;margin:0 0 8px}
body.tilo-theme-night #tmpaste-out .ok{color:#6ee7b7}
#tmpaste-out .err{color:#b94738;font-size:11.5px}
#tmpaste-out .item{
  display:flex;gap:10px;align-items:flex-start;
  padding:10px 10px;margin-bottom:6px;border-radius:12px;
  background:rgba(53,99,78,.04);border:1px solid rgba(53,99,78,.08);
}
body.tilo-theme-night #tmpaste-out .item{background:rgba(255,255,255,.03);border-color:rgba(110,231,183,.08)}
#tmpaste-out .dot{
  width:12px;height:12px;border-radius:50%;flex-shrink:0;margin-top:4px;
  box-shadow:0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
}
#tmpaste-out .tmp-time{
  font-variant-numeric:tabular-nums;font-weight:800;font-size:11.5px;
  letter-spacing:.02em;opacity:.85;direction:ltr;unicode-bidi:isolate;
}
#tmpaste-out .tmp-title{font-weight:750;font-size:12.5px}
#tmpaste-out .tmp-meta{font-size:10.5px;opacity:.72;margin-top:2px}
#tmpaste-out .tmp-note{font-size:10.5px;opacity:.65;margin-top:3px}
`;
    document.head.appendChild(s);
  }

  function buildPanel() {
    injectStyles();
    const panel = document.createElement("section");
    panel.id = "tmpaste-panel";
    panel.innerHTML = [
      '<button type="button" id="tmpaste-toggle" aria-expanded="true">',
      '<span style="display:inline-flex;align-items:center;gap:10px">',
      '<span class="tmp-ico">📋</span>',
      '<span>چسباندن برنامه از متن</span>',
      '</span><span class="tmp-chev">▾</span></button>',
      '<div id="tmpaste-body">',
      '<p class="tmp-hint">اول یک خط توضیح بنویس (مثلاً «فقط امروز را جایگزین کن»)، بعد لیست ساعت‌ها را از Gemini بچسبان. ',
      'عنوان، دسته و توضیح را با | جدا کن. استراحت رنگ ثابت خاکستری می‌گیرد؛ بقیه رنگ‌های متفاوت.</p>',
      '<textarea id="tmpaste-ta" placeholder="فقط امروز را جایگزین کن&#10;05:00 تا 06:30 | عنوان: مطالعه کتاب | دسته: رشد فردی | توضیح: باشگاه ذهن&#10;15:30 تا 16:55 | عنوان: هندسه ۳ | دسته: کار عمیق / تخصصی&#10;16:55 تا 17:15 | عنوان: استراحت | دسته: ریکاوری و استراحت"></textarea>',
      '<div class="tmp-row">',
      '<label style="font-size:11px;font-weight:700">روز <input type="date" id="tmpaste-date" /></label>',
      '</div>',
      '<div class="tmp-mode tmp-row">',
      '<label class="tmp-chip on"><input type="radio" name="tmpaste-mode" value="replace-day" checked /> پاک‌کردن همان روز + جایگزینی</label>',
      '<label class="tmp-chip"><input type="radio" name="tmpaste-mode" value="append" /> فقط اضافه کردن</label>',
      '</div>',
      '<div class="tmp-actions">',
      '<button type="button" id="tmpaste-preview">پیش‌نمایش</button>',
      '<button type="button" id="tmpaste-apply">اعمال و ذخیره</button>',
      '<button type="button" id="tmpaste-clear">خالی</button>',
      '</div>',
      '<div id="tmpaste-out"></div>',
      '</div>'
    ].join("");

    const dateInput = panel.querySelector("#tmpaste-date");
    dateInput.value = todayKey();

    let open = true;
    const body = panel.querySelector("#tmpaste-body");
    const toggle = panel.querySelector("#tmpaste-toggle");
    toggle.onclick = function () {
      open = !open;
      body.style.display = open ? "block" : "none";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    // chip visual state
    panel.querySelectorAll(".tmp-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        panel.querySelectorAll(".tmp-chip").forEach(function (c) { c.classList.remove("on"); });
        chip.classList.add("on");
      });
    });

    const out = panel.querySelector("#tmpaste-out");
    const ta = panel.querySelector("#tmpaste-ta");

    function selectedMode() {
      const r = panel.querySelector('input[name="tmpaste-mode"]:checked');
      return r ? r.value : "replace-day";
    }

    function run(previewOnly) {
      const forced = dateInput.dataset.userTouched === "1" ? dateInput.value : null;
      const parsed = parsePaste(ta.value, forced || undefined);
      if (dateInput.dataset.userTouched !== "1") {
        dateInput.value = parsed.dateKey;
      }
      const dateKey = dateInput.value || parsed.dateKey;
      const mode = selectedMode() || parsed.mode;
      parsed.blocks.forEach(function (b) { b.date = dateKey; });

      if (!parsed.blocks.length) {
        out.innerHTML = '<p class="err">' + escapeHtml(parsed.errors.join(" | ") || "پارتی پیدا نشد.") + "</p>";
        return;
      }

      let html = '<div class="tmp-summary">' +
        '<span class="tmp-badge">' + parsed.blocks.length + ' پارت</span>' +
        '<span class="tmp-badge">' + escapeHtml(dateKey) + '</span>' +
        '<span class="tmp-badge">' + (mode === "replace-day" ? "جایگزینی روز" : "افزودن") + '</span>' +
        (previewOnly ? '<span class="tmp-badge">پیش‌نمایش</span>' : '') +
        '</div>';

      parsed.blocks.forEach(function (b) {
        html += '<div class="item">' +
          '<span class="dot" style="background:' + b.color + ';color:' + b.color + '"></span>' +
          '<div><div class="tmp-time">' + fmtMin(b.start) + " – " + fmtMin(b.end) + '</div>' +
          '<div class="tmp-title">' + escapeHtml(b.title) + '</div>' +
          '<div class="tmp-meta">' + escapeHtml(CATS[b.category].name) + '</div>' +
          (b.note ? '<div class="tmp-note">' + escapeHtml(b.note) + '</div>' : '') +
          '</div></div>';
      });
      if (parsed.errors.length) {
        html += '<p class="err">' + parsed.errors.map(escapeHtml).join("<br>") + '</p>';
      }
      if (!previewOnly) {
        /* keep for after save */
      }
      out.innerHTML = html;

      if (previewOnly) return;

      const msg = mode === "replace-day"
        ? "پارت‌های روز " + dateKey + " پاک و با این " + parsed.blocks.length + " پارت جایگزین شود؟\\nبقیه هفته دست نمی‌خورد."
        : parsed.blocks.length + " پارت به روز " + dateKey + " اضافه شود؟";
      if (!window.confirm(msg)) return;

      try {
        writeData(mode, dateKey, parsed.blocks);
        out.innerHTML = html + '<p class="ok">ذخیره شد. اگر لیست عوض نشد مارتل را ببند و دوباره باز کن.</p>';
        try {
          window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: localStorage.getItem(KEY) }));
        } catch (_) {}
      } catch (e) {
        out.innerHTML = '<p class="err">خطا: ' + escapeHtml(e.message || String(e)) + '</p>';
      }
    }

    dateInput.addEventListener("change", function () {
      dateInput.dataset.userTouched = "1";
    });

    panel.querySelector("#tmpaste-preview").onclick = function () { run(true); };
    panel.querySelector("#tmpaste-apply").onclick = function () { run(false); };
    panel.querySelector("#tmpaste-clear").onclick = function () {
      ta.value = "";
      out.innerHTML = "";
    };

    return panel;
  }

  function tryMount() {
    const host = document.getElementById("tilo-martell");
    if (!host) return false;
    if (document.getElementById("tmpaste-panel")) return true;
    host.appendChild(buildPanel());
    return true;
  }

  const obs = new MutationObserver(function () { tryMount(); });
  function start() {
    tryMount();
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    let n = 0;
    const t = setInterval(function () {
      tryMount();
      if (++n > 40) clearInterval(t);
    }, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.tiloMartellPaste = {
    parse: parsePaste,
    apply: function (text, dateKey, mode) {
      const parsed = parsePaste(text, dateKey);
      const d = dateKey || parsed.dateKey;
      parsed.blocks.forEach(function (b) { b.date = d; });
      if (!parsed.blocks.length) throw new Error(parsed.errors.join(" ") || "خالی");
      writeData(mode || parsed.mode || "replace-day", d, parsed.blocks);
      return parsed.blocks.length;
    }
  };
})();
