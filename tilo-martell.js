/**
 * tilo-martell.js — تایم‌بلاک زندگی (سبک دن مارتل)
 * اتصال: قبل از </body>
 *   <script src="./tilo-martell.js?v=1" defer></script>
 * اختیاری در منو: <button type="button" data-tilo-martell-open>تایم‌بلاک زندگی</button>
 * API: window.tiloMartell.open() / .close()
 */
(() => {
  "use strict";
  if (window.tiloMartell) return;

  const KEY = "tilo_martell_planner";
  const VERSION = 1;
  const DAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
  const CATS = {
    deep: { name: "کار عمیق / تخصصی", color: "#6366f1" },
    health: { name: "ورزش و سلامت", color: "#10b981" },
    growth: { name: "رشد فردی", color: "#f59e0b" },
    general: { name: "نیمه‌عمیق / عمومی", color: "#06b6d4" },
    recovery: { name: "ریکاوری و استراحت", color: "#64748b" }
  };

  const tehranParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23"
  });
  const persianDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "UTC", day: "numeric", month: "long"
  });
  const persianFullDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "UTC", year: "numeric", month: "long", day: "numeric"
  });
  const nf = new Intl.NumberFormat("fa-IR");

  let root, launcher, screen, editor, copyDialog;
  let data = emptyData();
  let rawSnapshot = null;
  let storageProblem = "";
  let opened = false;
  let returnFocus = null;
  let oldOverflow = "";
  let inertSnapshot = [];
  let renderFocus = null;
  let editingId = null;
  let editorSnapshot = null;
  let editorTrigger = null;
  let copySnapshot = null;
  let copyTrigger = null;

  const ui = {
    selected: today(),
    week: weekStart(today()),
    view: "day",
    review: false,
    message: ""
  };

  function emptyData() {
    return { version: VERSION, updatedAt: null, blocks: [], finalized: {} };
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  function partsNow() {
    return Object.fromEntries(
      tehranParts.formatToParts(new Date())
        .filter(p => p.type !== "literal")
        .map(p => [p.type, p.value])
    );
  }

  function today() {
    const p = partsNow();
    return `${p.year}-${p.month}-${p.day}`;
  }

  function utcDate(key) {
    return new Date(`${key}T12:00:00Z`);
  }

  function validDate(key) {
    if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const d = utcDate(key);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === key;
  }

  function addDays(key, count) {
    const d = utcDate(key);
    d.setUTCDate(d.getUTCDate() + count);
    return d.toISOString().slice(0, 10);
  }

  function dayIndex(key) {
    return (utcDate(key).getUTCDay() + 1) % 7;
  }

  function weekStart(key) {
    return addDays(key, -dayIndex(key));
  }

  function dateLabel(key, full) {
    return (full ? persianFullDate : persianDate).format(utcDate(key));
  }

  function dayLabel(key) {
    return `${DAYS[dayIndex(key)]}، ${dateLabel(key)}`;
  }

  function uid() {
    return window.crypto?.randomUUID?.() ||
      `tm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function timeText(minutes) {
    const m = Math.max(0, Math.min(1440, minutes | 0));
    if (m === 1440) return "24:00";
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }

  function parseTime(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return null;
    const [h, m] = value.split(":").map(Number);
    if (h === 24 && m === 0) return 1440;
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  function timed(b) {
    return Number.isInteger(b.start) && Number.isInteger(b.end);
  }

  function duration(b) {
    return timed(b) ? b.end - b.start : 0;
  }

  function blockColor(b) {
    return /^#[0-9a-fA-F]{6}$/.test(b.color || "") ? b.color : (CATS[b.category] || CATS.deep).color;
  }

  function sorted(blocks) {
    return [...blocks].sort((a, b) =>
      (a.start ?? 1500) - (b.start ?? 1500) ||
      String(a.title).localeCompare(String(b.title), "fa")
    );
  }

  function blocksOn(date, source) {
    source = source || data;
    return sorted(source.blocks.filter(b => b.date === date));
  }

  function checkData(source) {
    if (!source || source.version !== VERSION ||
        !Array.isArray(source.blocks) ||
        !source.finalized || typeof source.finalized !== "object" ||
        Array.isArray(source.finalized)) {
      throw new Error("ساختار داده قابل خواندن نیست.");
    }
    const ids = new Set();
    const dominoDates = new Set();
    const byDate = new Map();

    for (const b of source.blocks) {
      if (!b || typeof b.id !== "string" || !b.id || ids.has(b.id) ||
          !validDate(b.date) ||
          typeof b.title !== "string" || !b.title.trim() || b.title.length > 120 ||
          typeof b.note !== "string" || b.note.length > 600 ||
          !Object.prototype.hasOwnProperty.call(CATS, b.category) ||
          typeof b.done !== "boolean" || typeof b.domino !== "boolean" ||
          !(b.color === "" || /^#[0-9a-fA-F]{6}$/.test(b.color))) {
        throw new Error("یکی از کارهای ذخیره‌شده معتبر نیست.");
      }
      ids.add(b.id);
      const quick = b.start === null && b.end === null;
      if (!quick && !(
        Number.isInteger(b.start) && Number.isInteger(b.end) &&
        b.start >= 0 && b.end <= 1440 && b.start < b.end
      )) {
        throw new Error("ساعت شروع و پایان معتبر نیست.");
      }
      if (b.domino) {
        if (dominoDates.has(b.date)) throw new Error("هر روز فقط یک سنگ بزرگ.");
        dominoDates.add(b.date);
      }
      if (!quick) {
        if (!byDate.has(b.date)) byDate.set(b.date, []);
        byDate.get(b.date).push(b);
      }
    }
    for (const list of byDate.values()) {
      list.sort((a, b) => a.start - b.start);
      for (let i = 1; i < list.length; i++) {
        if (list[i].start < list[i - 1].end) {
          throw new Error("تداخل ساعت بین دو بلاک وجود دارد.");
        }
      }
    }
  }

  function load() {
    try {
      rawSnapshot = localStorage.getItem(KEY);
      if (rawSnapshot === null) data = emptyData();
      else {
        const parsed = JSON.parse(rawSnapshot);
        checkData(parsed);
        data = parsed;
      }
      storageProblem = "";
    } catch (error) {
      storageProblem = "ذخیره قابل استفاده نیست. " + (error.message || "");
    }
  }

  function transaction(mutator, affectedDates) {
    affectedDates = affectedDates || [];
    if (storageProblem) throw new Error("مشکل ذخیره‌سازی؛ داده قبلی دست‌نخورده است.");
    let currentRaw;
    try { currentRaw = localStorage.getItem(KEY); }
    catch { throw new Error("دسترسی به حافظه محلی نیست."); }
    if (currentRaw !== rawSnapshot) {
      load();
      render();
      throw new Error("در تب دیگر تغییر کرده؛ دوباره امتحان کن.");
    }
    const next = JSON.parse(JSON.stringify(data));
    mutator(next);
    for (const date of affectedDates) delete next.finalized[date];
    checkData(next);
    next.updatedAt = new Date().toISOString();
    const json = JSON.stringify(next);
    try { localStorage.setItem(KEY, json); }
    catch { throw new Error("ذخیره نشد؛ حافظه پر است."); }
    data = next;
    rawSnapshot = json;
    ui.message = "";
  }

  function tell(message) {
    ui.message = message;
    render();
  }

  function focusKey(el) {
    if (!el || !el.getAttribute) return null;
    return el.getAttribute("data-action") + "|" + (el.getAttribute("data-id") || el.getAttribute("data-date") || "");
  }

  function restoreActionFocus(key) {
    if (!key || !screen) return;
    const [action, rest] = key.split("|");
    const el = [...screen.querySelectorAll("[data-action]")].find(n =>
      n.getAttribute("data-action") === action &&
      (n.getAttribute("data-id") || n.getAttribute("data-date") || "") === (rest || "")
    );
    el?.focus({ preventScroll: true });
  }

  function ensureFresh(snapshot) {
    try {
      if (localStorage.getItem(KEY) !== snapshot) {
        load();
        throw new Error("داده عوض شده؛ فرم را ببند و دوباره باز کن.");
      }
    } catch (e) {
      if (e.message && e.message.includes("عوض")) throw e;
      load();
    }
  }

  function dialogError(dialog, msg) {
    const box = dialog.querySelector(".tm-form-error");
    if (box) {
      box.hidden = false;
      box.textContent = msg;
    } else {
      alert(msg);
    }
  }

  const CSS = `
#tilo-martell-launcher{position:fixed;z-index:9990;min-height:46px;padding:10px 16px;border:1px solid #4b7861;border-radius:16px;background:#35634e;color:#fff;font:inherit;font-size:13px;cursor:pointer;box-shadow:0 5px 20px #0002;left:14px;bottom:calc(18px + env(safe-area-inset-bottom,0px))}
#tilo-martell{--tm-bg:var(--t-bg,#f4f6f2);--tm-card:var(--t-card,#fff);--tm-text:var(--t-text,#253b31);--tm-muted:var(--t-muted,#68766d);--tm-border:var(--t-border,#dbe3dc);--tm-accent:#35634e;position:fixed;inset:0;z-index:10000;direction:rtl;color:var(--tm-text);background:var(--tm-bg);font-family:inherit;font-size:14px;line-height:1.7;overflow:auto;overscroll-behavior:contain;padding-bottom:env(safe-area-inset-bottom,0px)}
body.tilo-theme-night #tilo-martell{--tm-bg:var(--t-bg,#121c18);--tm-card:var(--t-card,#1b2822);--tm-text:var(--t-text,#e2ebe5);--tm-muted:var(--t-muted,#acbbb2);--tm-border:var(--t-border,#35463c)}
#tilo-martell *,#tilo-martell *::before,#tilo-martell *::after{box-sizing:border-box}
#tilo-martell[hidden],#tilo-martell [hidden]{display:none!important}
#tilo-martell button,#tilo-martell input,#tilo-martell select,#tilo-martell textarea{font:inherit;color:inherit}
#tilo-martell button{cursor:pointer;min-height:44px;border:1px solid var(--tm-border);border-radius:12px;background:var(--tm-card);padding:8px 12px;line-height:1.5;touch-action:manipulation}
#tilo-martell button:disabled{opacity:.5;cursor:not-allowed}
#tilo-martell :focus-visible{outline:3px solid #7fac91;outline-offset:3px}
#tilo-martell .tm-primary{background:#35634e;color:#fff;border-color:#35634e}
#tilo-martell .tm-danger{color:#b94738}
body.tilo-theme-night #tilo-martell .tm-danger{color:#ffb0a3}
#tilo-martell .tm-muted{color:var(--tm-muted);font-size:12px}
#tilo-martell .tm-top{position:sticky;top:0;z-index:5;display:flex;gap:12px;align-items:center;justify-content:space-between;background:var(--tm-card);border-bottom:1px solid var(--tm-border);padding:12px max(14px,env(safe-area-inset-right,0px))}
#tilo-martell h2,#tilo-martell h3,#tilo-martell p{margin:0}
#tilo-martell h2{font-size:17px}
#tilo-martell h3{font-size:15px}
#tilo-martell .tm-wrap{max-width:1150px;margin:auto;padding:14px}
#tilo-martell .tm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#tilo-martell .tm-between{justify-content:space-between}
#tilo-martell .tm-stack{display:grid;gap:12px}
#tilo-martell .tm-card{background:var(--tm-card);border:1px solid var(--tm-border);padding:15px;border-radius:17px}
#tilo-martell .tm-days{display:grid;grid-template-columns:repeat(7,minmax(82px,1fr));gap:6px;overflow-x:auto;padding:4px 2px 9px}
#tilo-martell .tm-days button{text-align:center;padding:8px 5px}
#tilo-martell .tm-days small{display:block;font-size:11px;white-space:nowrap}
#tilo-martell .tm-selected{box-shadow:inset 0 0 0 2px #548068;border-color:#548068}
#tilo-martell .tm-today::after{content:"امروز";display:block;font-size:10px;color:var(--tm-muted)}
#tilo-martell .tm-tabs button[aria-pressed="true"]{background:#35634e;color:#fff;border-color:#35634e}
#tilo-martell .tm-notice{background:var(--tm-card);border:1px solid #a88c49;padding:12px;border-radius:12px;margin-bottom:12px;overflow-wrap:anywhere}
#tilo-martell .tm-summary{display:grid;gap:12px;margin:12px 0}
#tilo-martell .tm-domino{border-inline-start:4px solid #a68a48}
#tilo-martell .tm-energy{height:10px;display:flex;direction:rtl;overflow:hidden;background:var(--tm-border);border-radius:99px;margin:12px 0 8px}
#tilo-martell .tm-energy span{display:block;height:100%}
#tilo-martell .tm-dot{width:8px;height:8px;display:inline-block;border-radius:50%;background:var(--bc);margin-inline-end:4px}
#tilo-martell .tm-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px}
#tilo-martell .tm-calendar{padding:0;overflow:hidden}
#tilo-martell .tm-calendar-head{padding:12px 15px;border-bottom:1px solid var(--tm-border)}
#tilo-martell .tm-time-scroll{max-height:62vh;min-height:280px;overflow:auto;direction:rtl;overscroll-behavior:contain;position:relative}
#tilo-martell .tm-timeline{height:1728px;position:relative;margin:0 8px}
#tilo-martell .tm-hour{position:absolute;width:100%;border-top:1px solid var(--tm-border);height:72px;font-size:11px;color:var(--tm-muted)}
#tilo-martell .tm-hour>span{display:block;width:49px;text-align:center;padding-top:4px;direction:ltr;font-variant-numeric:tabular-nums}
#tilo-martell .tm-block{position:absolute;inset-inline:58px 5px;overflow:hidden;border:1px solid var(--tm-border);border-inline-start:4px solid var(--bc);border-radius:8px;background:var(--tm-card)}
#tilo-martell .tm-block .tm-block-main{display:block;width:100%;height:100%;min-height:0;padding:3px 8px;padding-inline-end:49px;border:0;text-align:start;border-radius:0;background:transparent;overflow:hidden}
#tilo-martell .tm-block strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#tilo-martell .tm-block small{font-size:10px}
#tilo-martell .tm-block .tm-block-toggle{position:absolute;inset-inline-end:2px;top:2px;width:44px;padding:5px;border:0;background:transparent}
#tilo-martell .tm-done{opacity:.57}
#tilo-martell .tm-done .tm-title{text-decoration:line-through}
#tilo-martell .tm-week-scroll{overflow-x:auto;padding:2px 2px 10px}
#tilo-martell .tm-week{display:grid;grid-template-columns:repeat(7,minmax(140px,1fr));gap:8px;align-items:start;min-width:1030px}
#tilo-martell .tm-week-col{border:1px solid var(--tm-border);border-radius:13px;background:var(--tm-card);min-height:200px;padding:8px}
#tilo-martell .tm-week-col>button{width:100%;margin-bottom:8px}
#tilo-martell .tm-mini{border:1px solid var(--tm-border);border-inline-start:4px solid var(--bc);border-radius:10px;margin-bottom:8px;padding:6px;overflow-wrap:anywhere}
#tilo-martell .tm-mini .tm-edit{width:100%;border:0;text-align:start;padding:3px}
#tilo-martell .tm-mini strong{display:block;font-size:12px}
#tilo-martell .tm-tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 6px;border:1px solid var(--tm-border);border-radius:7px}
#tilo-martell .tm-item{display:flex;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--tm-border)}
#tilo-martell .tm-item:last-child{border-bottom:0}
#tilo-martell .tm-item .tm-edit{flex:1;text-align:start;border:0;padding:3px 6px;min-width:0}
#tilo-martell .tm-item .tm-title{display:block;overflow-wrap:anywhere}
#tilo-martell .tm-check{width:44px;flex:0 0 44px;padding:5px}
#tilo-martell .tm-item-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#tilo-martell .tm-clock{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;white-space:nowrap}
#tilo-martell progress{width:100%;height:10px;margin-top:8px;accent-color:#548068}
#tilo-martell .tm-empty{padding:26px 16px;text-align:center}
#tilo-martell .tm-empty p{margin-bottom:12px}
#tilo-martell .tm-review{margin-top:12px}
#tilo-martell .tm-review-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--tm-border)}
#tilo-martell .tm-review-item>div{min-width:0;overflow-wrap:anywhere}
#tilo-martell dialog{direction:rtl;width:min(540px,calc(100% - 20px));max-height:90dvh;overflow:auto;margin:auto;padding:0;border:1px solid var(--tm-border);border-radius:20px;background:var(--tm-card);color:var(--tm-text);box-shadow:0 20px 70px #0005}
#tilo-martell dialog::backdrop{background:#08170f88}
#tilo-martell .tm-form{display:grid;gap:13px;padding:19px}
#tilo-martell .tm-field{display:grid;gap:5px;font-size:12px}
#tilo-martell input:not([type="checkbox"]),#tilo-martell select,#tilo-martell textarea{width:100%;min-height:44px;border:1px solid var(--tm-border);border-radius:10px;padding:10px;background:var(--tm-bg)}
#tilo-martell textarea{min-height:75px;resize:vertical}
#tilo-martell input[type="checkbox"]{width:20px;height:20px;accent-color:#35634e}
#tilo-martell .tm-checklabel{display:flex;align-items:center;gap:9px;min-height:44px}
#tilo-martell .tm-fields-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#tilo-martell .tm-form-error{color:#b94738;overflow-wrap:anywhere;font-size:13px}
body.tilo-theme-night #tilo-martell .tm-form-error{color:#ffb0a3}
#tilo-martell .tm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:5px}
#tilo-martell .tm-actions>.tm-primary{flex:1}
#tilo-martell .tm-footer{text-align:center;padding:20px 0 8px;font-size:11px;color:var(--tm-muted)}
@media(min-width:760px){#tilo-martell .tm-wrap{padding:20px}#tilo-martell .tm-summary{grid-template-columns:1fr 1fr}}
`;

  function tag(b) {
    return `<span class="tm-tag"><i class="tm-dot" style="--bc:${blockColor(b)}"></i>${esc(CATS[b.category].name)}</span>`;
  }

  function blockTime(b) {
    return timed(b)
      ? `<span class="tm-clock">${timeText(b.start)} – ${timeText(b.end)}</span>`
      : "بدون ساعت";
  }

  function toggleButton(b, className) {
    className = className || "tm-check";
    return `<button type="button" class="${className}" data-action="toggle" data-id="${esc(b.id)}"
      aria-pressed="${b.done}" aria-label="${esc((b.done ? "لغو انجام: " : "انجام شد: ") + b.title)}">${b.done ? "✓" : "○"}</button>`;
  }

  function summaryHTML(list) {
    const domino = list.find(b => b.domino);
    const totalMinutes = list.reduce((sum, b) => sum + duration(b), 0) || 1;
    const keys = ["deep", "health", "recovery", "growth", "general"];
    const amounts = keys.map(key => ({
      key,
      minutes: list.filter(b => b.category === key).reduce((s, b) => s + duration(b), 0)
    }));
    const doneCount = list.filter(b => b.done).length;
    const progress = list.length ? Math.round((doneCount / list.length) * 100) : 0;

    return `<div class="tm-summary">
      <section class="tm-card tm-domino">
        <div class="tm-row tm-between">
          <strong>★ سنگ بزرگ امروز</strong>
          <button type="button" data-action="add-domino">تعیین</button>
        </div>
        ${domino ? `
          <p style="margin-top:10px"><strong class="tm-title">${esc(domino.title)}</strong></p>
          <p class="tm-muted">${blockTime(domino)} · ${esc(CATS[domino.category].name)}</p>
          ${toggleButton(domino)}
        ` : `<p class="tm-muted" style="margin-top:10px">یک کار را به‌عنوان مهم‌ترین قدم روز علامت بزن.</p>`}
      </section>
      <section class="tm-card">
        <strong>تعادل انرژی</strong>
        <div class="tm-energy" aria-hidden="true">
          ${amounts.filter(a => a.minutes > 0).map(a =>
            `<span style="width:${(a.minutes / totalMinutes) * 100}%;background:${CATS[a.key].color}"></span>`
          ).join("")}
        </div>
        <div class="tm-legend">
          ${amounts.filter(a => a.minutes > 0).map(a =>
            `<span><i class="tm-dot" style="--bc:${CATS[a.key].color}"></i>${esc(CATS[a.key].name)} ${nf.format(a.minutes)}د</span>`
          ).join("") || '<span class="tm-muted">هنوز بلاک ساعت‌دار نیست</span>'}
        </div>
        <p class="tm-muted" style="margin-top:8px">پیشرفت: ${nf.format(doneCount)} از ${nf.format(list.length)}</p>
        <progress max="100" value="${progress}"></progress>
      </section>
    </div>`;
  }

  function dailyHTML(list) {
    const hourLines = Array.from({ length: 24 }, (_, h) =>
      `<div class="tm-hour" style="top:${h * 72}px"><span>${timeText(h * 60)}</span></div>`
    ).join("");

    const blocks = list.filter(timed).map(b => {
      const top = b.start * 1.2;
      const height = Math.max(duration(b) * 1.2, 28);
      return `<div class="tm-block ${b.done ? "tm-done" : ""}" style="top:${top}px;height:${height}px;--bc:${blockColor(b)}">
        <button type="button" class="tm-block-main" data-action="edit" data-id="${esc(b.id)}"
          title="${esc(b.title)}">
          <strong class="tm-title">${b.domino ? "★ " : ""}${esc(b.title)}</strong>
          <small>${blockTime(b)}</small>
        </button>
        ${duration(b) >= 40 ? toggleButton(b, "tm-block-toggle") : ""}
      </div>`;
    }).join("");

    return `<section class="tm-card tm-calendar" aria-label="تقویم ساعتی">
      <div class="tm-calendar-head tm-row tm-between">
        <strong>${esc(dayLabel(ui.selected))}</strong>
        <span class="tm-muted">لمس بلاک = ویرایش</span>
      </div>
      <div class="tm-time-scroll" tabindex="0">
        <div class="tm-timeline">${hourLines}${blocks}</div>
      </div>
    </section>`;
  }

  function weekHTML() {
    const cols = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(ui.week, i);
      const list = blocksOn(date);
      const items = list.map(b => `
        <div class="tm-mini ${b.done ? "tm-done" : ""}" style="--bc:${blockColor(b)}">
          <button type="button" class="tm-edit" data-action="edit" data-id="${esc(b.id)}">
            <strong class="tm-title">${b.domino ? "★ " : ""}${esc(b.title)}</strong>
            <small class="tm-muted">${blockTime(b)}</small>
          </button>
          <div class="tm-row tm-between">${tag(b)}${toggleButton(b)}</div>
        </div>`).join("");

      return `<section class="tm-week-col ${date === ui.selected ? "tm-selected" : ""}">
        <button type="button" data-action="day" data-date="${date}" class="${date === today() ? "tm-today" : ""}">
          <strong>${DAYS[i]}</strong><br><small>${esc(dateLabel(date))}</small>
        </button>
        ${items || '<p class="tm-muted">خالی</p>'}
        <button type="button" data-action="add-date" data-date="${date}">+ بلاک</button>
      </section>`;
    }).join("");

    return `<section class="tm-week-scroll" tabindex="0"><div class="tm-week">${cols}</div></section>`;
  }

  function checklistHTML(list) {
    if (!list.length) {
      return `<section class="tm-card tm-empty">
        <p>برای این روز هنوز کاری نیست.</p>
        <button type="button" class="tm-primary" data-action="add">اولین بلاک</button>
        <button type="button" data-action="quick">خرده‌کار بدون ساعت</button>
      </section>`;
    }
    const items = list.map(b => `
      <div class="tm-item ${b.done ? "tm-done" : ""}">
        ${toggleButton(b)}
        <button type="button" class="tm-edit" data-action="edit" data-id="${esc(b.id)}">
          <strong class="tm-title">${b.domino ? "★ " : ""}${esc(b.title)}</strong>
          <span class="tm-item-meta">${tag(b)}<span class="tm-muted">${blockTime(b)}</span></span>
        </button>
      </div>`).join("");

    return `<section class="tm-card">
      <div class="tm-row tm-between">
        <h3>چک‌لیست اجرایی</h3>
        <button type="button" data-action="quick">+ خرده‌کار</button>
      </div>
      ${items}
    </section>`;
  }

  function reviewHTML() {
    const date = today();
    const pending = blocksOn(date).filter(b => !b.done);
    const tomorrow = addDays(date, 1);
    const finalized = !!data.finalized[tomorrow];

    return `<section class="tm-card tm-review" id="tm-review-section">
      <div class="tm-row tm-between">
        <h3>بازبینی شب (۸ PM)</h3>
        <button type="button" data-action="review">${ui.review ? "بستن" : "باز کردن"}</button>
      </div>
      ${!ui.review ? `<p class="tm-muted">کارهای مانده را به فردا بفرست و برنامه فردا را نهایی کن.</p>` : `
        <p class="tm-muted">امروز: ${esc(dayLabel(date))}</p>
        ${pending.length ? pending.map(b => `
          <div class="tm-review-item">
            <div><strong>${esc(b.title)}</strong><div class="tm-muted">${blockTime(b)}</div></div>
            <button type="button" data-action="rollover" data-id="${esc(b.id)}">→ فردا</button>
          </div>`).join("") : '<p class="tm-muted">همه کارهای امروز انجام شده یا لیست خالی است.</p>'}
        <div class="tm-row" style="margin-top:12px">
          <button type="button" data-action="tomorrow">رفتن به فردا</button>
          <button type="button" class="tm-primary" data-action="finalize" ${finalized ? "disabled" : ""}>
            ${finalized ? "فردا تأیید شده" : "نهایی کردن برنامه فردا"}
          </button>
        </div>
      `}
    </section>`;
  }

  function render() {
    if (!screen) return;
    const list = blocksOn(ui.selected);
    const hour = Number(partsNow().hour);
    const reviewHint = hour >= 20 ? '<span class="tm-muted"> · زمان بازبینی شب</span>' : "";

    screen.innerHTML = `
      <header class="tm-top">
        <div>
          <h2 id="tm-main-title">تایم‌بلاک زندگی</h2>
          <p class="tm-muted">سبک دن مارتل${reviewHint}</p>
        </div>
        <div class="tm-row">
          <button type="button" data-action="backup">پشتیبان</button>
          <button type="button" data-action="close" aria-label="بستن">×</button>
        </div>
      </header>
      <div class="tm-wrap tm-stack">
        ${storageProblem ? `<div class="tm-notice" role="alert">${esc(storageProblem)}
          <button type="button" data-action="reload">تلاش دوباره</button></div>` : ""}
        ${ui.message ? `<div class="tm-notice">${esc(ui.message)}
          <button type="button" data-action="dismiss">باشه</button></div>` : ""}

        <div class="tm-card tm-toolbar tm-stack">
          <div class="tm-row tm-between">
            <div class="tm-row">
              <button type="button" data-action="prev">هفته قبل</button>
              <button type="button" data-action="today">امروز</button>
              <button type="button" data-action="next">هفته بعد</button>
            </div>
            <div class="tm-row tm-tabs">
              <button type="button" data-action="view" data-view="day" aria-pressed="${ui.view === "day"}">نمای روز</button>
              <button type="button" data-action="view" data-view="week" aria-pressed="${ui.view === "week"}">کل هفته</button>
            </div>
          </div>
          <div class="tm-days">
            ${Array.from({ length: 7 }, (_, i) => {
              const date = addDays(ui.week, i);
              return `<button type="button" data-action="day" data-date="${date}"
                class="${date === ui.selected ? "tm-selected" : ""} ${date === today() ? "tm-today" : ""}">
                <strong>${DAYS[i]}</strong><small>${esc(dateLabel(date))}</small>
              </button>`;
            }).join("")}
          </div>
          <div class="tm-row">
            <button type="button" class="tm-primary" data-action="add">+ بلاک زمانی</button>
            <button type="button" data-action="quick">خرده‌کار</button>
            <button type="button" data-action="copy">کپی روتین روز</button>
            <button type="button" data-action="review">بازبینی ۸ شب</button>
          </div>
        </div>

        ${summaryHTML(list)}
        ${ui.view === "week" ? weekHTML() : dailyHTML(list)}
        ${checklistHTML(list)}
        ${reviewHTML()}
        <p class="tm-footer">ذخیره محلی · کلید ${esc(KEY)}</p>
      </div>`;

    if (renderFocus) {
      restoreActionFocus(renderFocus);
      renderFocus = null;
    }
  }

  function openEditor(opts) {
    opts = opts || {};
    if (storageProblem) {
      tell("ذخیره‌سازی در دسترس نیست.");
      return;
    }
    editingId = opts.id || null;
    const existing = editingId ? data.blocks.find(b => b.id === editingId) : null;
    const date = opts.date || existing?.date || ui.selected;
    const quick = !!(opts.quick || (existing && existing.start === null));
    const wantDomino = !!(opts.domino || existing?.domino);

    editorSnapshot = rawSnapshot;
    editorTrigger = focusKey(document.activeElement);

    const catOpts = Object.keys(CATS).map(k =>
      `<option value="${k}" ${(existing?.category || "deep") === k ? "selected" : ""}>${esc(CATS[k].name)}</option>`
    ).join("");

    editor.innerHTML = `
      <form class="tm-form">
        <div class="tm-row tm-between">
          <h3 id="tm-editor-title">${existing ? "ویرایش کار" : "کار جدید"}</h3>
          <button type="button" data-dialog-close aria-label="بستن">×</button>
        </div>
        <label class="tm-field">عنوان
          <input name="title" required maxlength="120" value="${esc(existing?.title || "")}" placeholder="مثلاً حسابان / تمرین بدن / کتاب">
        </label>
        <label class="tm-field">توضیح کوتاه
          <textarea name="note" maxlength="600" placeholder="اختیاری">${esc(existing?.note || "")}</textarea>
        </label>
        <label class="tm-field">روز
          <input type="date" name="date" required value="${esc(date)}">
        </label>
        <label class="tm-field">دسته انرژی
          <select name="category">${catOpts}</select>
        </label>
        <label class="tm-field">رنگ سفارشی (اختیاری)
          <input name="color" placeholder="#35634e" value="${esc(existing?.color || "")}">
        </label>
        <label class="tm-checklabel">
          <input type="checkbox" name="quick" ${quick ? "checked" : ""}>
          خرده‌کار بدون ساعت مشخص
        </label>
        <div class="tm-fields-2" data-time-fields ${quick ? "hidden" : ""}>
          <label class="tm-field">شروع
            <input name="start" placeholder="08:00" value="${existing && timed(existing) ? timeText(existing.start) : "08:00"}">
          </label>
          <label class="tm-field">پایان
            <input name="end" placeholder="09:30" value="${existing && timed(existing) ? timeText(existing.end) : "09:00"}">
          </label>
        </div>
        <label class="tm-checklabel">
          <input type="checkbox" name="domino" ${wantDomino ? "checked" : ""}>
          ★ سنگ بزرگ / Leading Domino این روز
        </label>
        ${existing ? `<label class="tm-checklabel">
          <input type="checkbox" name="done" ${existing.done ? "checked" : ""}>
          انجام شده
        </label>` : ""}
        <p class="tm-form-error" role="alert" hidden></p>
        <div class="tm-actions">
          <button type="submit" class="tm-primary">ذخیره</button>
          <button type="button" data-dialog-close>انصراف</button>
          ${existing ? '<button type="button" class="tm-danger" data-delete>حذف</button>' : ""}
        </div>
      </form>`;
    editor.showModal();
  }

  function normalizeDigits(value) {
    return String(value)
      .replace(/[۰-۹]/g, c => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
      .replace(/[٠-٩]/g, c => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))
      .trim();
  }

  function saveEditor(event) {
    event.preventDefault();
    const form = event.target;
    try {
      ensureFresh(editorSnapshot);
      const values = new FormData(form);
      const date = String(values.get("date") || "");
      const quick = values.has("quick");
      const title = String(values.get("title") || "").trim();
      const note = String(values.get("note") || "").trim();
      const category = String(values.get("category") || "deep");
      const color = String(values.get("color") || "").trim();
      const start = quick ? null : parseTime(normalizeDigits(values.get("start")));
      const end = quick ? null : parseTime(normalizeDigits(values.get("end")));

      if (!title) throw new Error("عنوان لازم است.");
      if (!validDate(date)) throw new Error("تاریخ معتبر نیست.");
      if (!Object.prototype.hasOwnProperty.call(CATS, category)) throw new Error("دسته نامعتبر.");
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("رنگ مثل #35634e باشد.");
      if (!quick && (start === null || end === null || start >= end || start >= 1440)) {
        throw new Error("ساعت‌ها را درست وارد کن (پایان بعد از شروع).");
      }

      const old = editingId ? data.blocks.find(b => b.id === editingId) : null;
      if (editingId && !old) throw new Error("این کار دیگر وجود ندارد.");

      const block = {
        id: old?.id || uid(),
        date, title, note, category, color,
        start, end,
        done: old ? values.has("done") : false,
        domino: values.has("domino")
      };

      transaction(next => {
        if (block.domino) {
          next.blocks.forEach(b => { if (b.date === date) b.domino = false; });
        }
        if (old) {
          const index = next.blocks.findIndex(b => b.id === old.id);
          next.blocks[index] = block;
        } else next.blocks.push(block);
      }, [...new Set([date, ...(old ? [old.date] : [])])]);

      ui.selected = date;
      ui.week = weekStart(date);
      ui.message = "ذخیره شد.";
      editor.close();
      render();
    } catch (error) {
      dialogError(editor, error.message || "ذخیره نشد.");
    }
  }

  function deleteEdited() {
    const b = data.blocks.find(item => item.id === editingId);
    if (!b) return;
    if (!window.confirm(`«${b.title}» حذف شود؟`)) return;
    try {
      ensureFresh(editorSnapshot);
      transaction(next => {
        next.blocks = next.blocks.filter(item => item.id !== b.id);
      }, [b.date]);
      editor.close();
      ui.message = "حذف شد.";
      render();
    } catch (error) {
      dialogError(editor, error.message);
    }
  }

  function openCopy() {
    const list = blocksOn(ui.selected);
    if (!list.length) { tell("اول برای این روز کار بساز."); return; }
    if (storageProblem) { tell("ذخیره در دسترس نیست."); return; }
    copySnapshot = rawSnapshot;
    copyTrigger = focusKey(document.activeElement);
    const sourceDate = ui.selected;
    copyDialog.innerHTML = `
      <form class="tm-form" data-source="${sourceDate}">
        <div class="tm-row tm-between">
          <h3 id="tm-copy-title">کپی روتین روز</h3>
          <button type="button" data-dialog-close>×</button>
        </div>
        <p>${nf.format(list.length)} کار از <strong>${esc(dayLabel(sourceDate))}</strong></p>
        <p class="tm-muted">روزهای مقصد را انتخاب کن. برنامه موجود پاک نمی‌شود.</p>
        <div class="tm-stack" style="gap:0">
          ${Array.from({ length: 7 }, (_, i) => {
            const date = addDays(ui.week, i);
            if (date === sourceDate) return "";
            return `<label class="tm-checklabel">
              <input type="checkbox" name="targets" value="${date}">
              ${esc(dayLabel(date))}
            </label>`;
          }).join("")}
        </div>
        <p class="tm-form-error" role="alert" hidden></p>
        <div class="tm-actions">
          <button type="submit" class="tm-primary">کپی</button>
          <button type="button" data-dialog-close>انصراف</button>
        </div>
      </form>`;
    copyDialog.showModal();
  }

  function saveCopy(event) {
    event.preventDefault();
    const form = event.target;
    try {
      ensureFresh(copySnapshot);
      const sourceDate = form.dataset.source;
      const source = blocksOn(sourceDate);
      const targets = [...new Set(new FormData(form).getAll("targets"))];
      if (!targets.length) throw new Error("حداقل یک روز انتخاب کن.");
      let added = 0;
      transaction(next => {
        for (const date of targets) {
          let hasDomino = next.blocks.some(b => b.date === date && b.domino);
          for (const b of source) {
            const duplicate = next.blocks.some(item =>
              item.date === date && item.title === b.title &&
              item.note === b.note && item.start === b.start &&
              item.end === b.end && item.category === b.category &&
              item.color === b.color
            );
            if (duplicate) continue;
            const domino = b.domino && !hasDomino;
            if (domino) hasDomino = true;
            next.blocks.push({ ...b, id: uid(), date, done: false, domino });
            added++;
          }
        }
      }, targets);
      copyDialog.close();
      tell(added ? `${nf.format(added)} کار کپی شد.` : "مورد جدیدی اضافه نشد.");
    } catch (error) {
      dialogError(copyDialog, error.message || "کپی نشد.");
    }
  }

  function selectDate(date) {
    if (!validDate(date)) return;
    ui.selected = date;
    ui.week = weekStart(date);
    ui.message = "";
    render();
  }

  function rollover(id) {
    const b = data.blocks.find(item => item.id === id);
    const date = today();
    const tomorrow = addDays(date, 1);
    if (!b || b.date !== date || b.done) throw new Error("این کار در لیست مانده امروز نیست.");
    let lostStar = false;
    transaction(next => {
      const item = next.blocks.find(block => block.id === id);
      const existingDomino = next.blocks.some(block => block.date === tomorrow && block.domino);
      if (item.domino && existingDomino) { item.domino = false; lostStar = true; }
      item.date = tomorrow;
      item.done = false;
    }, [date, tomorrow]);
    tell("به فردا منتقل شد." + (lostStar ? " سنگ بزرگ فردا حفظ شد." : ""));
  }

  function downloadBackup() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) { tell("داده‌ای نیست."); return; }
      const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tilo-martell-${today()}.json`;
      a.hidden = true;
      root.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      tell("پشتیبان گرفته نشد.");
    }
  }

  function handleAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button || !screen.contains(button)) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    renderFocus = focusKey(button);
    try {
      switch (action) {
        case "close": close(); break;
        case "prev": selectDate(addDays(ui.selected, -7)); break;
        case "next": selectDate(addDays(ui.selected, 7)); break;
        case "today": selectDate(today()); break;
        case "day": selectDate(button.dataset.date); break;
        case "view":
          ui.view = button.dataset.view === "week" ? "week" : "day";
          render();
          break;
        case "add": openEditor(); break;
        case "add-date": openEditor({ date: button.dataset.date }); break;
        case "add-domino": openEditor({ domino: true }); break;
        case "quick": openEditor({ quick: true }); break;
        case "edit": openEditor({ id }); break;
        case "toggle": {
          if (!data.blocks.some(b => b.id === id)) throw new Error("کار پیدا نشد.");
          transaction(next => {
            const b = next.blocks.find(item => item.id === id);
            b.done = !b.done;
          });
          render();
          break;
        }
        case "copy": openCopy(); break;
        case "review":
          ui.review = !ui.review;
          render();
          if (ui.review) screen.querySelector("#tm-review-section")?.scrollIntoView({ block: "start" });
          break;
        case "rollover": rollover(id); break;
        case "tomorrow":
          selectDate(addDays(today(), 1));
          root.scrollTo({ top: 0 });
          break;
        case "finalize": {
          const tomorrow = addDays(today(), 1);
          if (!blocksOn(tomorrow).length) throw new Error("اول برای فردا حداقل یک کار بساز.");
          transaction(next => { next.finalized[tomorrow] = true; });
          tell("برنامه فردا تأیید شد.");
          break;
        }
        case "dismiss": ui.message = ""; render(); break;
        case "reload": load(); render(); break;
        case "backup": downloadBackup(); break;
      }
    } catch (error) {
      tell(error.message || "انجام نشد.");
    }
  }

  function focusableElements(container) {
    return [...container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.closest("[hidden]") && el.getClientRects().length > 0);
  }

  function open() {
    if (!root) {
      init();
      if (!root) return;
    }
    if (opened) {
      root.focus({ preventScroll: true });
      return;
    }
    returnFocus = document.activeElement;
    load();
    render();
    oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inertSnapshot = [];
    for (const element of document.body.children) {
      if (element === root || !(element instanceof HTMLElement)) continue;
      if (["SCRIPT", "STYLE", "LINK"].includes(element.tagName)) continue;
      inertSnapshot.push([element, element.inert]);
      element.inert = true;
    }
    root.hidden = false;
    opened = true;
    requestAnimationFrame(() => root.focus({ preventScroll: true }));
  }

  function close() {
    if (!opened) return;
    if (editor.open) editor.close();
    if (copyDialog.open) copyDialog.close();
    root.hidden = true;
    opened = false;
    document.body.style.overflow = oldOverflow;
    for (const [element, previous] of inertSnapshot) {
      if (element.isConnected) element.inert = previous;
    }
    inertSnapshot = [];
    const target = returnFocus?.isConnected ? returnFocus : launcher;
    target?.focus({ preventScroll: true });
    returnFocus = null;
  }

  function init() {
    if (root || !document.body) return;

    const style = document.createElement("style");
    style.id = "tilo-martell-styles";
    style.textContent = CSS;
    document.head.appendChild(style);

    launcher = document.createElement("button");
    launcher.id = "tilo-martell-launcher";
    launcher.type = "button";
    launcher.textContent = "تایم‌بلاک زندگی";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-controls", "tilo-martell");
    launcher.addEventListener("click", open);

    root = document.createElement("section");
    root.id = "tilo-martell";
    root.hidden = true;
    root.tabIndex = -1;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "tm-main-title");
    root.setAttribute("lang", "fa");
    root.setAttribute("dir", "rtl");

    screen = document.createElement("div");
    screen.className = "tm-screen";
    editor = document.createElement("dialog");
    editor.id = "tm-editor";
    editor.setAttribute("aria-labelledby", "tm-editor-title");
    copyDialog = document.createElement("dialog");
    copyDialog.id = "tm-copy";
    copyDialog.setAttribute("aria-labelledby", "tm-copy-title");

    root.append(screen, editor, copyDialog);
    document.body.append(launcher, root);

    screen.addEventListener("click", handleAction);
    editor.addEventListener("submit", saveEditor);
    editor.addEventListener("change", event => {
      if (event.target.name === "quick") {
        const fields = editor.querySelector("[data-time-fields]");
        if (fields) fields.hidden = event.target.checked;
      }
    });
    editor.addEventListener("click", event => {
      if (event.target.closest("[data-dialog-close]")) editor.close();
      if (event.target.closest("[data-delete]")) deleteEdited();
    });
    editor.addEventListener("close", () => {
      if (!opened) return;
      restoreActionFocus(editorTrigger);
      if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    });

    copyDialog.addEventListener("submit", saveCopy);
    copyDialog.addEventListener("click", event => {
      if (event.target.closest("[data-dialog-close]")) copyDialog.close();
    });
    copyDialog.addEventListener("close", () => {
      if (!opened) return;
      restoreActionFocus(copyTrigger);
      if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    });

    root.addEventListener("keydown", event => {
      if (!opened || editor.open || copyDialog.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusableElements(screen);
      if (!elements.length) {
        event.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      const outsideList = !elements.includes(active);
      if (event.shiftKey && (active === first || outsideList)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outsideList)) {
        event.preventDefault();
        first.focus();
      }
    });

    document.addEventListener("click", event => {
      const target = event.target instanceof Element
        ? event.target.closest("[data-tilo-martell-open]")
        : null;
      if (!target) return;
      event.preventDefault();
      open();
    });

    window.addEventListener("storage", event => {
      if (event.key !== KEY && event.key !== null) return;
      load();
      if (opened) {
        ui.message = storageProblem ? "داده تب دیگر خوانده نشد." : "با تب دیگر همگام شد.";
        render();
      }
    });

    let lastToday = today();
    setInterval(() => {
      if (!opened || document.hidden) return;
      const currentToday = today();
      if (currentToday === lastToday) return;
      lastToday = currentToday;
      if (editor.open || copyDialog.open) return;
      render();
    }, 60000);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden || !opened) return;
      try {
        if (localStorage.getItem(KEY) !== rawSnapshot) {
          load();
          ui.message = "اطلاعات به‌روز شد.";
        }
      } catch { load(); }
      lastToday = today();
      render();
    });

    load();
  }

  window.tiloMartell = Object.freeze({ open, close });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
