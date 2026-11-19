/**
 * tilo | ماژول تایم‌بلاک زندگی (سبک دن مارتل) - نسخه بهینه‌شده
 * کلید ذخیره‌سازی: tilo_martell_planner
 * منطقه زمانی مرجع: Asia/Tehran | شروع هفته: شنبه
 */
(function () {
    'use strict';

    if (window.__TILO_LIFE_TIMEBLOCK_LOADED__) return;
    window.__TILO_LIFE_TIMEBLOCK_LOADED__ = true;

    const STORAGE_KEY = 'tilo_martell_planner';
    const BACKUP_KEY = 'tilo_martell_planner_ai_backup';
    const TILO_PARTS_KEY = 'sp_pro_parts';
    const SCHEMA_VERSION = 2;

    const WEEKDAYS_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

    const CATEGORIES = {
        deep: {
            id: 'deep',
            label: 'کار عمیق / تخصصی',
            short: 'عمیق',
            icon: '🎯',
            studyRelevant: true,
            defaultColor: '#10b981',
            palette: ['#10b981', '#059669', '#14b8a6', '#34d399']
        },
        general: {
            id: 'general',
            label: 'نیمه‌عمیق / عمومی',
            short: 'عمومی',
            icon: '📘',
            studyRelevant: true,
            defaultColor: '#38bdf8',
            palette: ['#38bdf8', '#6366f1', '#60a5fa', '#818cf8']
        },
        recovery: {
            id: 'recovery',
            label: 'ریکاوری و استراحت',
            short: 'استراحت',
            icon: '☕',
            studyRelevant: false,
            defaultColor: '#64748b',
            palette: ['#64748b']
        },
        growth: {
            id: 'growth',
            label: 'رشد فردی',
            short: 'رشد فردی',
            icon: '🌱',
            studyRelevant: true,
            defaultColor: '#f59e0b',
            palette: ['#f59e0b', '#eab308', '#d97706']
        },
        health: {
            id: 'health',
            label: 'ورزش و سلامت',
            short: 'سلامت',
            icon: '💪',
            studyRelevant: false,
            defaultColor: '#f43f5e',
            palette: ['#f43f5e', '#fb7185', '#ec4899']
        }
    };

    /* ==================== ابزارهای رنگ، تاریخ و زمان تهران ==================== */

    function hexToRgba(hex, alpha = 0.1) {
        const clean = String(hex || '#10b981').replace('#', '').trim();
        let r = 16, g = 185, b = 129;
        if (clean.length === 3) {
            r = parseInt(clean[0] + clean[0], 16);
            g = parseInt(clean[1] + clean[1], 16);
            b = parseInt(clean[2] + clean[2], 16);
        } else if (clean.length >= 6) {
            r = parseInt(clean.slice(0, 2), 16);
            g = parseInt(clean.slice(2, 4), 16);
            b = parseInt(clean.slice(4, 6), 16);
        }
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
            return `rgba(16, 185, 129, ${alpha})`;
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function toEnDigits(str) {
        return String(str || '')
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    }

    function toFaDigits(str) {
        return String(str ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
    }

    function getTehranTodayISO() {
        try {
            return toEnDigits(new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Tehran',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date()));
        } catch (_) {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
    }

    function getTehranNowMinutes() {
        try {
            const parts = new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Tehran',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).formatToParts(new Date());
            const h = Number(parts.find(p => p.type === 'hour')?.value || 0);
            const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
            return h * 60 + m;
        } catch (_) {
            const d = new Date();
            return d.getHours() * 60 + d.getMinutes();
        }
    }

    function parseISOToUTCNoon(iso) {
        const [y, m, d] = String(iso || getTehranTodayISO()).split('-').map(Number);
        return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
    }

    function addDaysISO(iso, deltaDays) {
        const dt = parseISOToUTCNoon(iso);
        dt.setUTCDate(dt.getUTCDate() + deltaDays);
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function getSaturdayOfWeekISO(iso) {
        const dt = parseISOToUTCNoon(iso);
        const jsDay = dt.getUTCDay(); // Sun=0 .. Sat=6
        const offsetFromSaturday = (jsDay + 1) % 7;
        return addDaysISO(iso, -offsetFromSaturday);
    }

    function getPersianDateInfo(iso) {
        try {
            const dt = parseISOToUTCNoon(iso);
            const weekday = new Intl.DateTimeFormat('fa-IR', {
                timeZone: 'Asia/Tehran',
                weekday: 'long'
            }).format(dt);
            const dayNum = new Intl.DateTimeFormat('fa-IR', {
                timeZone: 'Asia/Tehran',
                day: 'numeric'
            }).format(dt);
            const monthName = new Intl.DateTimeFormat('fa-IR', {
                timeZone: 'Asia/Tehran',
                month: 'long'
            }).format(dt);
            const fullDate = new Intl.DateTimeFormat('fa-IR', {
                timeZone: 'Asia/Tehran',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }).format(dt);
            return { weekday, dayNum, monthName, fullDate, shortDate: `${dayNum} ${monthName}` };
        } catch (_) {
            return { weekday: 'روز', dayNum: '', monthName: '', fullDate: iso, shortDate: iso };
        }
    }

    function minutesToHHMM(mins, fa = true) {
        if (mins === null || mins === undefined || Number.isNaN(Number(mins))) return '';
        const clamped = Math.max(0, Math.min(1440, Math.round(Number(mins))));
        const h = Math.floor(clamped / 60);
        const m = clamped % 60;
        const raw = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        return fa ? toFaDigits(raw) : raw;
    }

    function hhmmToMinutes(str) {
        const clean = toEnDigits(str).trim();
        const match = clean.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) return null;
        const h = Number(match[1]);
        const m = Number(match[2]);
        if (h < 0 || h > 24 || m < 0 || m > 59) return null;
        const total = h * 60 + m;
        return total > 1440 ? 1440 : total;
    }

    function formatDurationFa(mins) {
        const m = Math.max(0, Math.round(Number(mins) || 0));
        if (m === 0) return '۰ دقیقه';
        const h = Math.floor(m / 60);
        const rem = m % 60;
        if (h > 0 && rem > 0) return `${toFaDigits(h)} ساعت و ${toFaDigits(rem)} دقیقه`;
        if (h > 0) return `${toFaDigits(h)} ساعت`;
        return `${toFaDigits(rem)} دقیقه`;
    }

    function generateId(prefix = 'blk') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    /* ==================== مدیریت داده و ایمنی localStorage ==================== */

    function normalizeBlock(raw, index = 0) {
        const catKey = CATEGORIES[raw?.category] ? raw.category : 'deep';
        const catObj = CATEGORIES[catKey];
        let start = raw?.start !== null && raw?.start !== undefined && raw?.start !== '' ? Number(raw.start) : null;
        let end = raw?.end !== null && raw?.end !== undefined && raw?.end !== '' ? Number(raw.end) : null;

        if (start !== null && (Number.isNaN(start) || start < 0 || start > 1440)) start = null;
        if (end !== null && (Number.isNaN(end) || end < 0 || end > 1440)) end = null;
        if (start !== null && end !== null && end <= start) {
            end = Math.min(1440, start + 30);
        }
        if (start === null || end === null) {
            start = null;
            end = null;
        }

        let color = raw?.color || catObj.palette[index % catObj.palette.length];
        if (catKey === 'recovery') color = CATEGORIES.recovery.defaultColor;

        return {
            id: String(raw?.id || generateId('blk')),
            date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.date || '')) ? raw.date : getTehranTodayISO(),
            title: String(raw?.title || 'بدون عنوان').trim(),
            note: String(raw?.note || '').trim(),
            category: catKey,
            color,
            start,
            end,
            done: Boolean(raw?.done),
            domino: Boolean(raw?.domino)
        };
    }

    function enforceSingleDominoPerDay(blocks, preferredDominoId = null) {
        const seenDates = new Set();
        if (preferredDominoId) {
            const target = blocks.find(b => b.id === preferredDominoId && b.domino);
            if (target) {
                seenDates.add(target.date);
                blocks.forEach(b => {
                    if (b.date === target.date && b.id !== target.id) b.domino = false;
                });
            }
        }
        blocks.forEach(b => {
            if (!b.domino) return;
            if (seenDates.has(b.date)) {
                b.domino = false;
            } else {
                seenDates.add(b.date);
            }
        });
        return blocks;
    }

    function normalizeStore(raw) {
        let parsed = raw;
        if (typeof raw === 'string') {
            try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
        }
        if (Array.isArray(parsed)) {
            parsed = { blocks: parsed };
        }
        if (!parsed || typeof parsed !== 'object') {
            parsed = {};
        }

        const blocks = Array.isArray(parsed.blocks)
            ? enforceSingleDominoPerDay(parsed.blocks.map((b, i) => normalizeBlock(b, i)))
            : [];
        const trash = Array.isArray(parsed.trash)
            ? parsed.trash.map((b, i) => normalizeBlock(b, i))
            : [];
        const finalized = parsed.finalized && typeof parsed.finalized === 'object' && !Array.isArray(parsed.finalized)
            ? parsed.finalized
            : {};

        return {
            version: SCHEMA_VERSION,
            updatedAt: Number(parsed.updatedAt) || Date.now(),
            blocks,
            trash,
            finalized
        };
    }

    function loadStore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return normalizeStore(raw);
        } catch (_) {
            return normalizeStore(null);
        }
    }

    function createAutoBackup() {
        try {
            const current = localStorage.getItem(STORAGE_KEY);
            if (current) {
                localStorage.setItem(BACKUP_KEY, current);
            }
        } catch (_) {}
    }

    function saveStore(store, options = { backup: false }) {
        try {
            if (options.backup) createAutoBackup();
            const normalized = normalizeStore(store);
            normalized.updatedAt = Date.now();
            const serialized = JSON.stringify(normalized);
            localStorage.setItem(STORAGE_KEY, serialized);

            try {
                window.dispatchEvent(new CustomEvent('tilo:planner-updated', { detail: normalized }));
                window.dispatchEvent(new StorageEvent('storage', {
                    key: STORAGE_KEY,
                    newValue: serialized
                }));
            } catch (_) {}

            return normalized;
        } catch (err) {
            console.warn('tilo-martell: saveStore failed', err);
            return store;
        }
    }

    /* ==================== وضعیت برنامه (State) ==================== */

    const uiState = {
        isOpen: false,
        store: loadStore(),
        selectedDate: getTehranTodayISO(),
        weekStartISO: getSaturdayOfWeekISO(getTehranTodayISO()),
        viewMode: 'day', // 'day' | 'week'
        daySubView: 'list', // 'list' | 'timeline'
        expandedNotes: {},
        openAccordions: {
            paste: false,
            routine: false,
            review: false,
            energy: false,
            backup: false
        },
        sheetOpen: false,
        editingBlockId: null,
        form: {
            title: '',
            note: '',
            category: 'deep',
            color: '#10b981',
            hasTime: true,
            startStr: '16:00',
            endStr: '17:15',
            domino: false
        },
        delayOpen: false,
        customDelayInput: '20',
        pasteRaw: '',
        pasteTargetMode: 'selected',
        pasteApplyMode: 'replace',
        pastePreview: null,
        routineTarget: 'tomorrow',
        routineMode: 'append',
        selectedForTimer: {},
        toastMsg: '',
        toastTimer: null
    };

    function showToast(msg) {
        uiState.toastMsg = msg;
        clearTimeout(uiState.toastTimer);
        renderToast();
        uiState.toastTimer = setTimeout(() => {
            uiState.toastMsg = '';
            renderToast();
        }, 2500);
    }

    /* ==================== پارسر هوشمند آفلاین برنامه متنی ==================== */

    function inferCategoryFromText(text) {
        const t = String(text || '').toLowerCase();
        if (/استراحت|ریکاوری|ناهار|شام|صبحانه|خواب|چرت|میان.?وعده|نفس|استراحت کوتاه/.test(t)) return 'recovery';
        if (/ورزش|سلامت|باشگاه|دویدن|پیاده.?روی|تمرین بدنی|یوگا|کشش/.test(t)) return 'health';
        if (/رشد فردی|کتاب|پادکست|زبان|مهارت|طراحی|برنامه.?نویسی|مدیتیشن|ژورنال|بازبینی/.test(t)) return 'growth';
        if (/عمومی|نیمه.?عمیق|فارسی|ادبیات|عربی|دینی|دین و زندگی|زبان انگلیسی|هویت|سلامت و بهداشت|مرور|خلاصه/.test(t)) return 'general';
        return 'deep';
    }

    function parseCategoryLabel(rawCat, fallbackText) {
        const c = String(rawCat || '').trim();
        if (!c) return inferCategoryFromText(fallbackText);
        if (/عمیق|تخصصی|deep/i.test(c)) return 'deep';
        if (/نیمه|عمومی|general/i.test(c)) return 'general';
        if (/ریکاوری|استراحت|recovery/i.test(c)) return 'recovery';
        if (/رشد|growth/i.test(c)) return 'growth';
        if (/ورزش|سلامت|health/i.test(c)) return 'health';
        return inferCategoryFromText(`${c} ${fallbackText}`);
    }

    function parseScheduleText(rawText) {
        const normalized = toEnDigits(rawText || '').trim();
        if (!normalized) return null;

        const lines = normalized.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) return null;

        let detectedTarget = null;
        let detectedApplyMode = null;
        let startIdx = 0;

        const firstLine = lines[0];
        const hasTimeOnFirstLine = /\d{1,2}:\d{2}/.test(firstLine);

        if (!hasTimeOnFirstLine) {
            if (/فردا/.test(firstLine)) detectedTarget = 'tomorrow';
            else if (/امروز/.test(firstLine)) detectedTarget = 'today';
            else {
                const dayNames = [
                    { key: 'sat', re: /شنبه/ },
                    { key: 'sun', re: /یکشنبه|یک\s*شنبه/ },
                    { key: 'mon', re: /دوشنبه|دو\s*شنبه/ },
                    { key: 'tue', re: /سه‌شنبه|سه\s*شنبه/ },
                    { key: 'wed', re: /چهارشنبه|چهار\s*شنبه/ },
                    { key: 'thu', re: /پنج‌شنبه|پنج\s*شنبه/ },
                    { key: 'fri', re: /جمعه/ }
                ];
                for (const d of dayNames) {
                    if ((d.key !== 'sun' && d.re.test(firstLine) && !/یکشنبه|دوشنبه|سه‌شنبه|چهارشنبه|پنج‌شنبه/.test(firstLine)) ||
                        (d.key === 'sun' && d.re.test(firstLine)) ||
                        (d.key !== 'sat' && d.key !== 'sun' && d.re.test(firstLine))) {
                        detectedTarget = d.key;
                        break;
                    }
                }
            }

            if (/جایگزین|پاک|ریست|بجای|به جای/.test(firstLine)) detectedApplyMode = 'replace';
            else if (/اضافه|افزودن|الحاق/.test(firstLine)) detectedApplyMode = 'append';

            if (detectedTarget || detectedApplyMode || firstLine.length < 45) {
                startIdx = 1;
            }
        }

        const catCounters = { deep: 0, general: 0, recovery: 0, growth: 0, health: 0 };
        const parsedBlocks = [];

        for (let i = startIdx; i < lines.length; i++) {
            let line = lines[i].replace(/^[-•*▪▫\d.)]+\s*/, '').trim();
            if (!line) continue;

            let start = null;
            let end = null;

            const timeRangeMatch = line.match(/(\d{1,2}:\d{2})\s*(?:تا|الی|-|–|—|to)\s*(\d{1,2}:\d{2})/i);
            if (timeRangeMatch) {
                start = hhmmToMinutes(timeRangeMatch[1]);
                end = hhmmToMinutes(timeRangeMatch[2]);
                if (start !== null && end !== null && end <= start) {
                    end = Math.min(1440, start + 30);
                }
                line = line.replace(timeRangeMatch[0], '').replace(/^\s*\|\s*/, '').trim();
            }

            const segments = line.split('|').map(s => s.trim()).filter(Boolean);
            let title = '';
            let rawCat = '';
            let note = '';
            let isDomino = false;

            segments.forEach(seg => {
                if (/سنگ بزرگ|domino|⭐/i.test(seg)) {
                    isDomino = true;
                }
                if (/^(?:عنوان|کار|مبحث|title)\s*:/i.test(seg)) {
                    title = seg.replace(/^(?:عنوان|کار|مبحث|title)\s*:/i, '').trim();
                } else if (/^(?:دسته|دسته‌بندی|نوع|category)\s*:/i.test(seg)) {
                    rawCat = seg.replace(/^(?:دسته|دسته‌بندی|نوع|category)\s*:/i, '').trim();
                } else if (/^(?:توضیح|توضیحات|یادداشت|نکته|note)\s*:/i.test(seg)) {
                    note = seg.replace(/^(?:توضیح|توضیحات|یادداشت|نکته|note)\s*:/i, '').trim();
                } else if (!title) {
                    title = seg;
                } else if (!note) {
                    note = seg;
                }
            });

            title = title.replace(/⭐/g, '').trim();
            if (!title) continue;

            const category = parseCategoryLabel(rawCat, `${title} ${note}`);
            const catObj = CATEGORIES[category];
            const color = category === 'recovery'
                ? catObj.defaultColor
                : catObj.palette[catCounters[category] % catObj.palette.length];
            catCounters[category]++;

            parsedBlocks.push({
                id: generateId('blk'),
                title,
                note,
                category,
                color,
                start,
                end,
                done: false,
                domino: isDomino
            });
        }

        return {
            detectedTarget,
            detectedApplyMode,
            blocks: parsedBlocks
        };
    }

    function resolveTargetDateFromMode(mode) {
        const today = getTehranTodayISO();
        if (mode === 'today') return today;
        if (mode === 'tomorrow') return addDaysISO(today, 1);
        if (mode === 'selected') return uiState.selectedDate;
        const map = { sat: 0, sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6 };
        if (mode in map) {
            return addDaysISO(uiState.weekStartISO, map[mode]);
        }
        return uiState.selectedDate;
    }

    /* ==================== عملیات روی داده‌ها ==================== */

    function getBlocksForDate(dateISO) {
        return uiState.store.blocks
            .filter(b => b.date === dateISO)
            .sort((a, b) => {
                if (a.start === null && b.start === null) return 0;
                if (a.start === null) return 1;
                if (b.start === null) return -1;
                return a.start - b.start;
            });
    }

    function findOverlap(dateISO, start, end, excludeId = null) {
        if (start === null || end === null) return null;
        return getBlocksForDate(dateISO).find(b => {
            if (b.id === excludeId || b.start === null || b.end === null) return false;
            return start < b.end && end > b.start;
        }) || null;
    }

    function upsertBlock(blockData) {
        const isEdit = Boolean(blockData.id && uiState.store.blocks.some(b => b.id === blockData.id));
        const normalized = normalizeBlock({
            ...blockData,
            id: isEdit ? blockData.id : generateId('blk')
        });

        let nextBlocks = [...uiState.store.blocks];
        if (isEdit) {
            nextBlocks = nextBlocks.map(b => (b.id === normalized.id ? normalized : b));
        } else {
            nextBlocks.push(normalized);
        }

        if (normalized.domino) {
            nextBlocks = enforceSingleDominoPerDay(nextBlocks, normalized.id);
        }

        uiState.store.blocks = nextBlocks;
        uiState.store = saveStore(uiState.store, { backup: false });
        showToast(isEdit ? 'تغییرات ذخیره شد ✓' : 'تایم‌بلاک اضافه شد ✓');
    }

    function toggleBlockDomino(blockId) {
        const target = uiState.store.blocks.find(b => b.id === blockId);
        if (!target) return;
        const willBeDomino = !target.domino;
        uiState.store.blocks.forEach(b => {
            if (b.date === target.date) {
                b.domino = willBeDomino ? (b.id === target.id) : false;
            }
        });
        uiState.store = saveStore(uiState.store);
        showToast(willBeDomino ? `«${target.title}» سنگ بزرگ روز شد ⭐` : 'سنگ بزرگ برداشته شد');
    }

    function toggleBlockDone(blockId) {
        const blk = uiState.store.blocks.find(b => b.id === blockId);
        if (!blk) return;
        blk.done = !blk.done;
        uiState.store = saveStore(uiState.store);
        if (blk.done) {
            try { if (navigator.vibrate) navigator.vibrate(15); } catch (_) {}
            showToast('انجام شد ✓');
        }
    }

    function deleteBlockToTrash(blockId) {
        const idx = uiState.store.blocks.findIndex(b => b.id === blockId);
        if (idx === -1) return;
        const [removed] = uiState.store.blocks.splice(idx, 1);
        uiState.store.trash.unshift(removed);
        uiState.store.trash = uiState.store.trash.slice(0, 40);
        uiState.store = saveStore(uiState.store, { backup: true });
        showToast('به سطل بازیابی منتقل شد');
    }

    function restoreFromTrash(blockId) {
        const idx = uiState.store.trash.findIndex(b => b.id === blockId);
        if (idx === -1) return;
        const [restored] = uiState.store.trash.splice(idx, 1);
        restored.domino = false;
        uiState.store.blocks.push(restored);
        uiState.store = saveStore(uiState.store);
        showToast('کار بازیابی شد ✓');
    }

    function nudgeBlockTime(blockId, deltaMinutes) {
        const blk = uiState.store.blocks.find(b => b.id === blockId);
        if (!blk || blk.start === null || blk.end === null) return;
        const duration = blk.end - blk.start;
        const nextStart = Math.max(0, Math.min(1440 - duration, blk.start + deltaMinutes));
        if (nextStart === blk.start) return;
        blk.start = nextStart;
        blk.end = nextStart + duration;
        uiState.store = saveStore(uiState.store);
        showToast(deltaMinutes > 0 ? `+${toFaDigits(deltaMinutes)} دقیقه عقب افتاد` : `${toFaDigits(Math.abs(deltaMinutes))} دقیقه جلو افتاد`);
    }

    function moveBlockOrder(blockId, direction) {
        const dayBlocks = getBlocksForDate(uiState.selectedDate);
        const idx = dayBlocks.findIndex(b => b.id === blockId);
        const targetIdx = idx + direction;
        if (idx === -1 || targetIdx < 0 || targetIdx >= dayBlocks.length) return;

        const curr = dayBlocks[idx];
        const adj = dayBlocks[targetIdx];

        // جابه‌جایی زمان اگر هر دو دارای ساعت مشخص باشند
        if (curr.start !== null && curr.end !== null && adj.start !== null && adj.end !== null) {
            const first = direction < 0 ? adj : curr;
            const second = direction < 0 ? curr : adj;
            const baseStart = first.start;
            const gap = Math.max(0, second.start - first.end);
            const durFirst = first.end - first.start;
            const durSecond = second.end - second.start;

            // بعد از جابه‌جایی، second اول قرار می‌گیرد و first دوم
            second.start = baseStart;
            second.end = Math.min(1440, baseStart + durSecond);

            first.start = Math.min(1440 - durFirst, second.end + gap);
            first.end = Math.min(1440, first.start + durFirst);
        }

        // جابه‌جایی جایگاه در آرایه اصلی برای حفظ ترتیب کارهای بدون ساعت
        const storeIdxA = uiState.store.blocks.findIndex(b => b.id === curr.id);
        const storeIdxB = uiState.store.blocks.findIndex(b => b.id === adj.id);
        if (storeIdxA !== -1 && storeIdxB !== -1) {
            const temp = uiState.store.blocks[storeIdxA];
            uiState.store.blocks[storeIdxA] = uiState.store.blocks[storeIdxB];
            uiState.store.blocks[storeIdxB] = temp;
        }

        uiState.store = saveStore(uiState.store);
    }

    function applyBatchShift(dateISO, deltaMins) {
        const delta = Number(deltaMins) || 0;
        if (delta === 0) {
            showToast('مقدار دقیقه را وارد کنید');
            return;
        }
        const nowMins = dateISO === getTehranTodayISO() ? getTehranNowMinutes() : -1;
        let shiftedCount = 0;

        uiState.store.blocks.forEach(b => {
            if (b.date !== dateISO || b.done || b.start === null || b.end === null) return;
            if (nowMins >= 0 && b.end <= nowMins) return;
            const dur = b.end - b.start;
            const nextStart = Math.max(0, Math.min(1440 - dur, b.start + delta));
            if (nextStart !== b.start) {
                b.start = nextStart;
                b.end = nextStart + dur;
                shiftedCount++;
            }
        });

        if (shiftedCount > 0) {
            uiState.store = saveStore(uiState.store, { backup: true });
            const absMin = toFaDigits(Math.abs(delta));
            showToast(delta > 0
                ? `${toFaDigits(shiftedCount)} کار ${absMin} دقیقه عقب افتاد`
                : `${toFaDigits(shiftedCount)} کار ${absMin} دقیقه جلو افتاد`);
        } else {
            showToast('کار انجام‌نشده و زمان‌داری برای جابه‌جایی یافت نشد');
        }
    }

    function sendBlocksToStudyTimer(blockIds) {
        const selected = uiState.store.blocks.filter(b => blockIds.includes(b.id));
        if (!selected.length) {
            showToast('حداقل یک پارت مطالعاتی انتخاب کنید');
            return;
        }

        const todayISO = getTehranTodayISO();
        const todayFa = getPersianDateInfo(todayISO).fullDate;

        try {
            window.dispatchEvent(new CustomEvent('tilo:send-to-timer', {
                detail: { blocks: JSON.parse(JSON.stringify(selected)) }
            }));
        } catch (_) {}

        try {
            const existingRaw = localStorage.getItem(TILO_PARTS_KEY);
            const existingParts = existingRaw ? JSON.parse(existingRaw) : [];
            if (Array.isArray(existingParts)) {
                const mapped = selected.map((b, i) => {
                    const dur = (b.start !== null && b.end !== null) ? Math.max(15, b.end - b.start) : 60;
                    return {
                        id: Date.now() + i,
                        dateISO: todayISO,
                        dateStr: todayFa,
                        isNonStudy: !CATEGORIES[b.category]?.studyRelevant,
                        isLife: !CATEGORIES[b.category]?.studyRelevant,
                        subjects: [CATEGORIES[b.category]?.short || 'مطالعه'],
                        topic: b.title,
                        description: b.note || 'ارسال‌شده از تایم‌بلاک زندگی',
                        type: b.category === 'deep' ? 'تست و مطالعه تخصصی' : 'مطالعه و مرور',
                        category: 'خودخوان',
                        plannedTime: dur,
                        realTime: 0,
                        status: 'pending',
                        tests: { correct: 0, wrong: 0, unanswered: 0, total: 0 }
                    };
                });
                localStorage.setItem(TILO_PARTS_KEY, JSON.stringify([...mapped, ...existingParts]));
            }
        } catch (_) {}

        uiState.selectedForTimer = {};
        showToast(`${toFaDigits(selected.length)} پارت به صف تایمر مطالعه ارسال شد 🚀`);
    }

    /* ==================== استایل‌های CSS بهینه‌شده و فشرده ==================== */

    function injectStyles() {
        if (document.getElementById('tltb-styles')) return;
        const style = document.createElement('style');
        style.id = 'tltb-styles';
        style.textContent = `
            #tltb-launcher-btn {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                background: linear-gradient(135deg, #162922 0%, #0e1613 100%);
                color: #6ee7b7;
                border: 1px solid #2d5a47;
                border-radius: 13px;
                padding: 8px 14px;
                font-family: 'Vazirmatn', system-ui, sans-serif;
                font-size: 12px;
                font-weight: 800;
                cursor: pointer;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
                transition: transform 0.16s ease, border-color 0.16s ease;
                direction: rtl;
            }
            #tltb-launcher-btn:hover {
                transform: translateY(-1px);
                border-color: #6ee7b7;
            }
            #tltb-floating-launcher {
                position: fixed;
                right: 16px;
                bottom: 84px;
                z-index: 99980;
            }
            @media (min-width: 768px) {
                #tltb-floating-launcher {
                    bottom: 24px;
                    right: 24px;
                }
            }

            /* پنجره اصلی تمام‌صفحه */
            #tltb-overlay {
                --tltb-bg: #0e1613;
                --tltb-surface: #14201b;
                --tltb-elevated: #1a2a23;
                --tltb-border: #2d5a47;
                --tltb-border-soft: rgba(45, 90, 71, 0.42);
                --tltb-accent: #6ee7b7;
                --tltb-accent-bg: rgba(110, 231, 183, 0.12);
                --tltb-text: #ecfdf5;
                --tltb-muted: #8fb3a3;
                --tltb-danger: #f87171;
                --tltb-warn: #fbbf24;

                position: fixed;
                inset: 0;
                z-index: 2147483000;
                background: var(--tltb-bg);
                color: var(--tltb-text);
                font-family: 'Vazirmatn', system-ui, -apple-system, sans-serif;
                direction: rtl;
                display: none;
                flex-direction: column;
                overflow: hidden;
            }
            #tltb-overlay.open {
                display: flex;
            }

            body.tilo-theme-day #tltb-overlay {
                --tltb-bg: #f3f5f2;
                --tltb-surface: #ffffff;
                --tltb-elevated: #eaf0ec;
                --tltb-border: #86efac;
                --tltb-border-soft: #d1ded7;
                --tltb-accent: #059669;
                --tltb-accent-bg: rgba(5, 150, 105, 0.1);
                --tltb-text: #0f1f18;
                --tltb-muted: #527062;
            }

            #tltb-overlay * {
                box-sizing: border-box;
                -webkit-tap-highlight-color: transparent;
            }

            /* هدر چسبان بالا */
            .tltb-topbar {
                background: var(--tltb-surface);
                border-bottom: 1px solid var(--tltb-border-soft);
                padding: 10px 14px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-shrink: 0;
            }
            .tltb-title-group h2 {
                margin: 0;
                font-size: 15px;
                font-weight: 900;
                color: var(--tltb-text);
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .tltb-title-group p {
                margin: 1px 0 0 0;
                font-size: 10.5px;
                color: var(--tltb-muted);
            }
            .tltb-top-actions {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .tltb-pill-btn {
                background: var(--tltb-elevated);
                color: var(--tltb-text);
                border: 1px solid var(--tltb-border-soft);
                border-radius: 10px;
                padding: 5px 10px;
                font-family: inherit;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transition: all 0.15s ease;
            }
            .tltb-pill-btn:hover {
                border-color: var(--tltb-accent);
                color: var(--tltb-accent);
            }
            .tltb-pill-btn.accent {
                background: var(--tltb-accent);
                color: #06140e;
                border-color: var(--tltb-accent);
            }
            .tltb-close-btn {
                width: 32px;
                height: 32px;
                border-radius: 10px;
                border: 1px solid var(--tltb-border-soft);
                background: var(--tltb-elevated);
                color: var(--tltb-text);
                font-size: 17px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* اسکرول محتوای اصلی */
            .tltb-scroll-area {
                flex: 1;
                overflow-y: auto;
                padding: 10px 12px 86px 12px;
            }
            .tltb-container {
                max-width: 820px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            /* کارت‌های نرم و فشرده */
            .tltb-card {
                background: var(--tltb-surface);
                border: 1px solid var(--tltb-border-soft);
                border-radius: 15px;
                padding: 10px 12px;
            }

            /* نوار ناوبری هفته و روزها */
            .tltb-week-nav {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
                gap: 6px;
            }
            .tltb-week-label {
                font-size: 11.5px;
                font-weight: 800;
                color: var(--tltb-text);
            }
            .tltb-days-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 4px;
            }
            .tltb-day-pill {
                background: var(--tltb-bg);
                border: 1px solid var(--tltb-border-soft);
                border-radius: 11px;
                padding: 6px 2px;
                text-align: center;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
                transition: all 0.14s ease;
            }
            .tltb-day-pill .d-name {
                font-size: 9.5px;
                font-weight: 700;
                color: var(--tltb-muted);
            }
            .tltb-day-pill .d-num {
                font-size: 12px;
                font-weight: 900;
                color: var(--tltb-text);
            }
            .tltb-day-pill .d-dot {
                width: 4px;
                height: 4px;
                border-radius: 50%;
                background: transparent;
            }
            .tltb-day-pill.has-blocks .d-dot {
                background: var(--tltb-accent);
            }
            .tltb-day-pill.is-today {
                border-style: dashed;
                border-color: var(--tltb-accent);
            }
            .tltb-day-pill.selected {
                background: var(--tltb-accent-bg);
                border: 1.5px solid var(--tltb-accent);
            }
            .tltb-day-pill.selected .d-name,
            .tltb-day-pill.selected .d-num {
                color: var(--tltb-accent);
            }

            /* کارت سنگ بزرگ روز (Domino) */
            .tltb-domino-card {
                background: linear-gradient(135deg, rgba(110, 231, 183, 0.13) 0%, var(--tltb-surface) 100%);
                border: 1.5px solid var(--tltb-border);
                border-radius: 14px;
                padding: 9px 11px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                cursor: pointer;
            }
            .tltb-domino-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 10px;
                font-weight: 900;
                color: var(--tltb-accent);
                background: var(--tltb-accent-bg);
                padding: 2px 8px;
                border-radius: 999px;
                margin-bottom: 3px;
            }

            /* هدر بخش روز */
            .tltb-section-head {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
                margin-bottom: 8px;
            }
            .tltb-segmented {
                display: inline-flex;
                background: var(--tltb-bg);
                border: 1px solid var(--tltb-border-soft);
                border-radius: 9px;
                padding: 2px;
            }
            .tltb-seg-btn {
                border: none;
                background: transparent;
                color: var(--tltb-muted);
                font-family: inherit;
                font-size: 10.5px;
                font-weight: 800;
                padding: 4px 9px;
                border-radius: 7px;
                cursor: pointer;
            }
            .tltb-seg-btn.active {
                background: var(--tltb-elevated);
                color: var(--tltb-accent);
            }

            /* کارت بلاک فشرده و قابل کلیک برای ویرایش */
            .tltb-block-list {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .tltb-block-item {
                border: 1px solid var(--tltb-border-soft);
                border-right-width: 3.5px;
                border-radius: 12px;
                padding: 7px 9px;
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                transition: opacity 0.18s ease, transform 0.12s ease, border-color 0.15s ease;
            }
            .tltb-block-item:hover {
                border-color: var(--tltb-accent);
            }
            .tltb-block-item.is-done {
                opacity: 0.58;
            }
            .tltb-block-item.is-done .tltb-blk-title {
                text-decoration: line-through;
            }
            .tltb-check-btn {
                width: 22px;
                height: 22px;
                border-radius: 7px;
                border: 1.5px solid var(--tltb-border);
                background: rgba(0, 0, 0, 0.15);
                color: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                flex-shrink: 0;
                font-size: 12px;
                font-weight: 900;
                transition: all 0.14s ease;
            }
            .tltb-check-btn.checked {
                background: var(--tltb-accent);
                border-color: var(--tltb-accent);
                color: #06140e;
            }
            .tltb-blk-main {
                flex: 1;
                min-width: 0;
            }
            .tltb-blk-top {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 5px;
                margin-bottom: 2px;
            }
            /* استایل مجزا برای ساعت شروع-پایان و مدت زمان */
            .tltb-time-range {
                font-size: 11px;
                font-weight: 800;
                color: var(--tltb-text);
                letter-spacing: 0.1px;
            }
            .tltb-duration-tag {
                font-size: 9.5px;
                font-weight: 600;
                color: var(--tltb-muted);
                background: rgba(255, 255, 255, 0.04);
                padding: 1px 6px;
                border-radius: 5px;
            }
            body.tilo-theme-day .tltb-duration-tag {
                background: rgba(0, 0, 0, 0.05);
            }
            .tltb-cat-badge {
                font-size: 9.5px;
                font-weight: 800;
                padding: 1px 6px;
                border-radius: 5px;
            }
            .tltb-blk-title {
                font-size: 12.5px;
                font-weight: 800;
                line-height: 1.4;
                color: var(--tltb-text);
                margin: 0;
                word-break: break-word;
            }
            .tltb-blk-note {
                font-size: 11px;
                color: var(--tltb-muted);
                margin: 4px 0 0 0;
                line-height: 1.5;
                background: rgba(0, 0, 0, 0.18);
                padding: 4px 8px;
                border-radius: 7px;
            }
            body.tilo-theme-day .tltb-blk-note {
                background: rgba(0, 0, 0, 0.04);
            }

            /* دکمه‌های جمع‌وجور روی کارت */
            .tltb-blk-actions {
                display: flex;
                align-items: center;
                gap: 2px;
                flex-shrink: 0;
            }
            .tltb-icon-btn {
                min-width: 25px;
                height: 25px;
                padding: 0 4px;
                border-radius: 7px;
                border: 1px solid transparent;
                background: rgba(0, 0, 0, 0.14);
                color: var(--tltb-muted);
                font-family: inherit;
                font-size: 10.5px;
                font-weight: 800;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.13s ease;
            }
            body.tilo-theme-day .tltb-icon-btn {
                background: rgba(0, 0, 0, 0.04);
            }
            .tltb-icon-btn:hover {
                border-color: var(--tltb-border);
                color: var(--tltb-text);
            }
            .tltb-icon-btn.domino-on {
                color: #fbbf24;
                background: rgba(251, 191, 36, 0.14);
                border-color: rgba(251, 191, 36, 0.4);
            }
            .tltb-icon-btn:disabled {
                opacity: 0.28;
                cursor: default;
            }

            /* محور ساعتی (Timeline) بهینه‌شده و جمع‌وجور */
            .tltb-timeline {
                display: flex;
                flex-direction: column;
                gap: 4px;
                position: relative;
            }
            .tltb-tl-row {
                display: grid;
                grid-template-columns: 44px 1fr;
                gap: 8px;
                align-items: stretch;
            }
            .tltb-tl-axis {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                position: relative;
                padding-top: 4px;
            }
            .tltb-tl-hour {
                font-size: 10px;
                font-weight: 800;
                color: var(--tltb-muted);
                line-height: 1;
            }
            .tltb-tl-rail {
                flex: 1;
                width: 2px;
                background: var(--tltb-border-soft);
                margin: 4px 12px 0 0;
                border-radius: 2px;
            }
            .tltb-tl-card {
                border: 1px solid var(--tltb-border-soft);
                border-right-width: 3.5px;
                border-radius: 11px;
                padding: 6px 9px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                cursor: pointer;
                transition: border-color 0.14s ease, opacity 0.16s ease;
            }
            .tltb-tl-card:hover {
                border-color: var(--tltb-accent);
            }
            .tltb-tl-card.is-done {
                opacity: 0.56;
            }
            .tltb-tl-card.is-done .tltb-blk-title {
                text-decoration: line-through;
            }
            .tltb-free-slot {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 10px;
                color: var(--tltb-muted);
                padding: 4px 10px;
                border-radius: 9px;
                background: rgba(110, 231, 183, 0.04);
                border: 1px dashed var(--tltb-border-soft);
                cursor: pointer;
            }
            .tltb-free-slot:hover {
                border-color: var(--tltb-accent);
                color: var(--tltb-accent);
            }
            .tltb-now-line {
                display: flex;
                align-items: center;
                gap: 6px;
                color: #fb7185;
                font-size: 10px;
                font-weight: 900;
                margin: 2px 0;
                padding-right: 4px;
            }
            .tltb-now-line::before {
                content: '●';
                font-size: 8px;
            }
            .tltb-now-line::after {
                content: '';
                flex: 1;
                height: 1.5px;
                background: linear-gradient(90deg, transparent, #fb7185);
            }

            /* نوار ثابت پایین برای افزودن سریع */
            .tltb-bottom-bar {
                background: var(--tltb-surface);
                border-top: 1px solid var(--tltb-border-soft);
                padding: 8px 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .tltb-add-primary-btn {
                width: 100%;
                max-width: 480px;
                background: var(--tltb-accent);
                color: #06140e;
                border: none;
                border-radius: 12px;
                padding: 10px 16px;
                font-family: inherit;
                font-size: 13px;
                font-weight: 900;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                box-shadow: 0 4px 16px rgba(110, 231, 183, 0.2);
            }

            /* آکاردئون‌های بخش‌های فرعی */
            .tltb-accordion {
                background: var(--tltb-surface);
                border: 1px solid var(--tltb-border-soft);
                border-radius: 14px;
                overflow: hidden;
            }
            .tltb-acc-header {
                width: 100%;
                background: transparent;
                border: none;
                color: var(--tltb-text);
                padding: 11px 13px;
                font-family: inherit;
                font-size: 12px;
                font-weight: 800;
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                text-align: right;
            }
            .tltb-acc-body {
                padding: 10px 13px 13px 13px;
                border-top: 1px solid var(--tltb-border-soft);
                display: flex;
                flex-direction: column;
                gap: 9px;
            }

            /* فرم‌ها و ورودی‌ها */
            .tltb-input, .tltb-select, .tltb-textarea {
                width: 100%;
                background: var(--tltb-bg);
                color: var(--tltb-text);
                border: 1px solid var(--tltb-border-soft);
                border-radius: 10px;
                padding: 8px 10px;
                font-family: inherit;
                font-size: 12px;
                outline: none;
            }
            .tltb-input:focus, .tltb-select:focus, .tltb-textarea:focus {
                border-color: var(--tltb-accent);
            }

            /* باتم‌شیت افزودن و ویرایش */
            .tltb-sheet-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(5, 10, 8, 0.72);
                backdrop-filter: blur(4px);
                z-index: 2147483100;
                display: flex;
                align-items: flex-end;
                justify-content: center;
            }
            @media (min-width: 640px) {
                .tltb-sheet-backdrop {
                    align-items: center;
                    padding: 16px;
                }
            }
            .tltb-sheet {
                background: var(--tltb-surface);
                border: 1px solid var(--tltb-border);
                border-radius: 22px 22px 0 0;
                width: 100%;
                max-width: 480px;
                max-height: 90dvh;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            @media (min-width: 640px) {
                .tltb-sheet {
                    border-radius: 20px;
                }
            }
            .tltb-cat-pills {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
            }
            .tltb-cat-pill {
                border: 1px solid var(--tltb-border-soft);
                background: var(--tltb-bg);
                color: var(--tltb-muted);
                border-radius: 9px;
                padding: 5px 9px;
                font-family: inherit;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
            }
            .tltb-cat-pill.active {
                color: #06140e;
                border-color: transparent;
            }

            /* Toast */
            #tltb-toast {
                position: fixed;
                top: 14px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 2147483600;
                background: #14261f;
                color: #6ee7b7;
                border: 1px solid #2d5a47;
                padding: 7px 16px;
                border-radius: 999px;
                font-family: 'Vazirmatn', sans-serif;
                font-size: 11.5px;
                font-weight: 800;
                box-shadow: 0 8px 24px rgba(0,0,0,0.45);
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    /* ==================== رندر رابط کاربری ==================== */

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderToast() {
        let el = document.getElementById('tltb-toast');
        if (!uiState.toastMsg) {
            if (el) el.remove();
            return;
        }
        if (!el) {
            el = document.createElement('div');
            el.id = 'tltb-toast';
            document.body.appendChild(el);
        }
        el.textContent = uiState.toastMsg;
    }

    function renderWeekHeaderAndDays() {
        const todayISO = getTehranTodayISO();
        const startInfo = getPersianDateInfo(uiState.weekStartISO);
        const endInfo = getPersianDateInfo(addDaysISO(uiState.weekStartISO, 6));

        const daysHtml = WEEKDAYS_FA.map((dayName, idx) => {
            const dateISO = addDaysISO(uiState.weekStartISO, idx);
            const info = getPersianDateInfo(dateISO);
            const hasBlocks = uiState.store.blocks.some(b => b.date === dateISO);
            const isSelected = uiState.selectedDate === dateISO;
            const isToday = todayISO === dateISO;

            return `
                <button type="button" class="tltb-day-pill ${hasBlocks ? 'has-blocks' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}" data-select-date="${dateISO}">
                    <span class="d-name">${dayName}</span>
                    <span class="d-num">${info.dayNum}</span>
                    <span class="d-dot"></span>
                </button>
            `;
        }).join('');

        return `
            <div class="tltb-card">
                <div class="tltb-week-nav">
                    <button type="button" class="tltb-pill-btn" data-nav-week="-7">‹ هفته قبل</button>
                    <span class="tltb-week-label">${startInfo.shortDate} تا ${endInfo.shortDate}</span>
                    <button type="button" class="tltb-pill-btn" data-nav-week="7">هفته بعد ›</button>
                </div>
                <div class="tltb-days-grid">${daysHtml}</div>
            </div>
        `;
    }

    function renderDominoSection(dayBlocks) {
        const domino = dayBlocks.find(b => b.domino);
        if (!domino) {
            if (!dayBlocks.length) return '';
            return `
                <div class="tltb-card" style="display:flex; align-items:center; justify-content:space-between; gap:8px; border-style:dashed;">
                    <span style="font-size:11.5px; color:var(--tltb-muted);">
                        ⭐ هنوز <strong>سنگ بزرگ امروز</strong> انتخاب نشده است.
                    </span>
                    <button type="button" class="tltb-pill-btn" data-set-first-domino="1">انتخاب اولین کار</button>
                </div>
            `;
        }

        const hasTime = domino.start !== null && domino.end !== null;
        const timeRange = hasTime ? `${minutesToHHMM(domino.start)} – ${minutesToHHMM(domino.end)}` : 'بدون ساعت';
        const durText = hasTime ? formatDurationFa(domino.end - domino.start) : '';

        return `
            <div class="tltb-domino-card" data-card-edit="${domino.id}">
                <div style="display:flex; align-items:center; gap:9px; flex:1; min-width:0;">
                    <button type="button" class="tltb-check-btn ${domino.done ? 'checked' : ''}" data-toggle-done="${domino.id}">✓</button>
                    <div style="min-width:0; flex:1;">
                        <div class="tltb-domino-badge">
                            <span>⭐ سنگ بزرگ روز · ${timeRange}</span>
                            ${durText ? `<span style="opacity:0.75; font-weight:600;">(${durText})</span>` : ''}
                        </div>
                        <div class="tltb-blk-title" style="${domino.done ? 'text-decoration:line-through; opacity:0.65;' : ''}">${escapeHtml(domino.title)}</div>
                        ${domino.note ? `<div style="font-size:10.5px; color:var(--tltb-muted); margin-top:2px;">${escapeHtml(domino.note)}</div>` : ''}
                    </div>
                </div>
                <button type="button" class="tltb-icon-btn domino-on" data-toggle-domino="${domino.id}" title="لغو سنگ بزرگ">⭐</button>
            </div>
        `;
    }

    function renderBlockCard(b, index, totalCount) {
        const cat = CATEGORIES[b.category] || CATEGORIES.deep;
        const hasTime = b.start !== null && b.end !== null;
        const timeRangeStr = hasTime ? `${minutesToHHMM(b.start)} – ${minutesToHHMM(b.end)}` : 'بدون ساعت';
        const durStr = hasTime ? formatDurationFa(b.end - b.start) : '';
        const noteOpen = Boolean(uiState.expandedNotes[b.id]);

        const cardBgTint = hexToRgba(b.color, 0.09);
        const cardBorderTint = hexToRgba(b.color, 0.28);

        return `
            <div class="tltb-block-item ${b.done ? 'is-done' : ''}"
                 data-card-edit="${b.id}"
                 style="background-color:${cardBgTint}; border-color:${cardBorderTint}; border-right-color:${escapeHtml(b.color)};">
                <button type="button" class="tltb-check-btn ${b.done ? 'checked' : ''}" data-toggle-done="${b.id}" aria-label="انجام شد">✓</button>
                <div class="tltb-blk-main">
                    <div class="tltb-blk-top">
                        <span class="tltb-time-range">${timeRangeStr}</span>
                        ${durStr ? `<span class="tltb-duration-tag">${durStr}</span>` : ''}
                        <span class="tltb-cat-badge" style="background:${hexToRgba(b.color, 0.18)}; color:${b.color};">${cat.icon} ${cat.short}</span>
                    </div>
                    <p class="tltb-blk-title">${escapeHtml(b.title)}</p>
                    ${b.note && noteOpen ? `<div class="tltb-blk-note">${escapeHtml(b.note)}</div>` : ''}
                </div>
                <div class="tltb-blk-actions">
                    <button type="button" class="tltb-icon-btn ${b.domino ? 'domino-on' : ''}" data-toggle-domino="${b.id}" title="سنگ بزرگ روز">${b.domino ? '⭐' : '☆'}</button>
                    <button type="button" class="tltb-icon-btn" data-move-block="${b.id}:-1" ${index === 0 ? 'disabled' : ''} title="بالا">↑</button>
                    <button type="button" class="tltb-icon-btn" data-move-block="${b.id}:1" ${index === totalCount - 1 ? 'disabled' : ''} title="پایین">↓</button>
                    ${hasTime ? `<button type="button" class="tltb-icon-btn" data-nudge-block="${b.id}:-15" title="۱۵ دقیقه جلوتر">−۱۵</button>` : ''}
                    ${hasTime ? `<button type="button" class="tltb-icon-btn" data-nudge-block="${b.id}:15" title="۱۵ دقیقه عقب‌تر">+۱۵</button>` : ''}
                    ${b.note ? `<button type="button" class="tltb-icon-btn" data-toggle-note="${b.id}" title="توضیحات">${noteOpen ? '▴' : '📝'}</button>` : ''}
                    ${cat.studyRelevant ? `<button type="button" class="tltb-icon-btn" data-send-single-timer="${b.id}" title="ارسال به تایمر">⏱️</button>` : ''}
                    <button type="button" class="tltb-icon-btn" data-del-block="${b.id}" title="حذف">🗑️</button>
                </div>
            </div>
        `;
    }

    function renderHourlyTimeline(dayBlocks) {
        const timed = dayBlocks.filter(b => b.start !== null && b.end !== null);
        const untimed = dayBlocks.filter(b => b.start === null || b.end === null);
        const isToday = uiState.selectedDate === getTehranTodayISO();
        const nowMins = getTehranNowMinutes();

        if (!timed.length && !untimed.length) {
            return renderEmptyDayState();
        }

        let html = '<div class="tltb-timeline">';
        let prevEnd = null;
        let nowRendered = false;

        timed.forEach((b, i) => {
            const cat = CATEGORIES[b.category] || CATEGORIES.deep;
            const durStr = formatDurationFa(b.end - b.start);
            const cardBgTint = hexToRgba(b.color, 0.1);
            const cardBorderTint = hexToRgba(b.color, 0.3);

            if (prevEnd !== null && b.start - prevEnd >= 15) {
                const gapMins = b.start - prevEnd;
                html += `
                    <div class="tltb-tl-row">
                        <div class="tltb-tl-axis">
                            <span class="tltb-tl-hour">${minutesToHHMM(prevEnd)}</span>
                            <span class="tltb-tl-rail"></span>
                        </div>
                        <div class="tltb-free-slot" data-add-at-slot="${prevEnd}:${b.start}" title="کلیک برای پر کردن این وقت آزاد">
                            <span>✨ ${formatDurationFa(gapMins)} وقت آزاد</span>
                            <span style="font-weight:800;">+ افزودن</span>
                        </div>
                    </div>
                `;
            }

            if (isToday && !nowRendered && nowMins <= b.start) {
                nowRendered = true;
                html += `<div class="tltb-now-line">الان (${minutesToHHMM(nowMins)})</div>`;
            }

            html += `
                <div class="tltb-tl-row">
                    <div class="tltb-tl-axis">
                        <span class="tltb-tl-hour">${minutesToHHMM(b.start)}</span>
                        ${i < timed.length - 1 ? '<span class="tltb-tl-rail"></span>' : ''}
                    </div>
                    <div class="tltb-tl-card ${b.done ? 'is-done' : ''}"
                         data-card-edit="${b.id}"
                         style="background-color:${cardBgTint}; border-color:${cardBorderTint}; border-right-color:${escapeHtml(b.color)};">
                        <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
                            <button type="button" class="tltb-check-btn ${b.done ? 'checked' : ''}" data-toggle-done="${b.id}">✓</button>
                            <div style="min-width:0; flex:1;">
                                <div class="tltb-blk-top">
                                    <span class="tltb-time-range">${minutesToHHMM(b.start)} – ${minutesToHHMM(b.end)}</span>
                                    <span class="tltb-duration-tag">${durStr}</span>
                                    <span class="tltb-cat-badge" style="background:${hexToRgba(b.color, 0.18)}; color:${b.color};">${cat.short}</span>
                                </div>
                                <div class="tltb-blk-title">${escapeHtml(b.title)}</div>
                            </div>
                        </div>
                        <div class="tltb-blk-actions">
                            <button type="button" class="tltb-icon-btn ${b.domino ? 'domino-on' : ''}" data-toggle-domino="${b.id}" title="سنگ بزرگ">${b.domino ? '⭐' : '☆'}</button>
                            <button type="button" class="tltb-icon-btn" data-nudge-block="${b.id}:-15" title="۱۵ دقیقه جلوتر">−۱۵</button>
                            <button type="button" class="tltb-icon-btn" data-nudge-block="${b.id}:15" title="۱۵ دقیقه عقب‌تر">+۱۵</button>
                        </div>
                    </div>
                </div>
            `;
            prevEnd = b.end;
        });

        if (isToday && !nowRendered) {
            html += `<div class="tltb-now-line">الان (${minutesToHHMM(nowMins)})</div>`;
        }

        html += '</div>';

        if (untimed.length) {
            html += `
                <div style="margin-top:10px;">
                    <div style="font-size:10.5px; font-weight:800; color:var(--tltb-muted); margin-bottom:5px;">کارهای بدون ساعت مشخص:</div>
                    <div class="tltb-block-list">${untimed.map((b, idx) => renderBlockCard(b, idx, untimed.length)).join('')}</div>
                </div>
            `;
        }

        return html;
    }

    function renderEmptyDayState() {
        const info = getPersianDateInfo(uiState.selectedDate);
        return `
            <div style="text-align:center; padding:22px 12px; border:1px dashed var(--tltb-border-soft); border-radius:14px;">
                <div style="font-size:22px; margin-bottom:4px;">🌿</div>
                <div style="font-size:13px; font-weight:900; color:var(--tltb-text);">برنامه ${info.weekday} (${info.shortDate}) هنوز خالی است</div>
                <p style="font-size:11px; color:var(--tltb-muted); margin:5px auto 12px auto; max-width:320px; line-height:1.6;">
                    یک «سنگ بزرگ» و چند تایم‌بلاک کوتاه بچین، یا برنامه متنی را یک‌جا پیست کن.
                </p>
                <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:6px;">
                    <button type="button" class="tltb-pill-btn accent" data-open-add="1">+ ساخت اولین تایم‌بلاک</button>
                    <button type="button" class="tltb-pill-btn" data-open-acc="paste">📋 چسباندن از متن</button>
                </div>
            </div>
        `;
    }

    function renderDayView() {
        const dayBlocks = getBlocksForDate(uiState.selectedDate);
        const info = getPersianDateInfo(uiState.selectedDate);
        const doneCount = dayBlocks.filter(b => b.done).length;

        const delayHtml = uiState.delayOpen ? `
            <div style="background:var(--tltb-bg); border:1px solid var(--tltb-border); border-radius:12px; padding:9px; margin-bottom:8px; display:flex; flex-direction:column; gap:7px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                    <span style="font-size:11px; font-weight:800;">جابه‌جایی دسته‌ای کارهای مانده امروز:</span>
                    <button type="button" class="tltb-pill-btn" data-toggle-delay="0">بستن</button>
                </div>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    ${[-30, -15, 15, 30, 45, 60].map(m => `<button type="button" class="tltb-pill-btn" data-exec-delay="${m}">${m > 0 ? `+${toFaDigits(m)}` : `−${toFaDigits(Math.abs(m))}`} د</button>`).join('')}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    <input type="number" id="tltb-custom-delay-input" class="tltb-input" style="max-width:110px; text-align:center; padding:5px 8px;" min="1" max="600" placeholder="دقیقه" value="${escapeHtml(uiState.customDelayInput)}" />
                    <button type="button" class="tltb-pill-btn accent" data-exec-custom-delay="1">عقب (+)</button>
                    <button type="button" class="tltb-pill-btn" data-exec-custom-delay="-1">جلو (−)</button>
                </div>
            </div>
        ` : '';

        const mainBody = !dayBlocks.length
            ? renderEmptyDayState()
            : (uiState.daySubView === 'timeline'
                ? renderHourlyTimeline(dayBlocks)
                : `<div class="tltb-block-list">${dayBlocks.map((b, idx) => renderBlockCard(b, idx, dayBlocks.length)).join('')}</div>`);

        return `
            ${renderDominoSection(dayBlocks)}

            <div class="tltb-card">
                <div class="tltb-section-head">
                    <div>
                        <span style="font-size:13px; font-weight:900; color:var(--tltb-text);">${info.weekday} · ${info.fullDate}</span>
                        <span style="font-size:10.5px; color:var(--tltb-muted); margin-right:6px;">(${toFaDigits(doneCount)}/${toFaDigits(dayBlocks.length)} انجام‌شده)</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:5px;">
                        ${dayBlocks.some(b => !b.done && b.start !== null) ? `<button type="button" class="tltb-pill-btn" data-toggle-delay="1" title="تأخیر یا جلو انداختن دسته‌ای">⏳ جابه‌جایی</button>` : ''}
                        <div class="tltb-segmented">
                            <button type="button" class="tltb-seg-btn ${uiState.daySubView === 'list' ? 'active' : ''}" data-subview="list">لیست</button>
                            <button type="button" class="tltb-seg-btn ${uiState.daySubView === 'timeline' ? 'active' : ''}" data-subview="timeline">محور ساعتی</button>
                        </div>
                    </div>
                </div>
                ${delayHtml}
                ${mainBody}
            </div>
        `;
    }

    function renderWeekOverview() {
        const cards = WEEKDAYS_FA.map((dayName, idx) => {
            const dateISO = addDaysISO(uiState.weekStartISO, idx);
            const info = getPersianDateInfo(dateISO);
            const blocks = getBlocksForDate(dateISO);
            const domino = blocks.find(b => b.domino);
            const studyMins = blocks.reduce((acc, b) => {
                if (!CATEGORIES[b.category]?.studyRelevant || b.start === null || b.end === null) return acc;
                return acc + (b.end - b.start);
            }, 0);

            return `
                <div class="tltb-card" style="cursor:pointer;" data-jump-day="${dateISO}">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="font-size:13px; color:var(--tltb-accent);">${dayName} · ${info.shortDate}</strong>
                        <span style="font-size:10.5px; color:var(--tltb-muted);">${toFaDigits(blocks.length)} بلاک · ${formatDurationFa(studyMins)} مطالعه</span>
                    </div>
                    ${domino
                        ? `<div style="font-size:11.5px; font-weight:700;">⭐ سنگ بزرگ: ${escapeHtml(domino.title)}</div>`
                        : `<div style="font-size:11px; color:var(--tltb-muted);">${blocks.length ? `${blocks.slice(0, 2).map(b => escapeHtml(b.title)).join('، ')}` : 'بدون برنامه'}</div>`
                    }
                </div>
            `;
        }).join('');

        return `<div style="display:flex; flex-direction:column; gap:8px;">${cards}</div>`;
    }

    /* ==================== بخش‌های جمع‌شونده پایین صفحه ==================== */

    function renderAccordions() {
        const dayBlocks = getBlocksForDate(uiState.selectedDate);
        const selectedInfo = getPersianDateInfo(uiState.selectedDate);
        const reviewData = uiState.store.finalized[uiState.selectedDate] || { note: '', completedAt: null };

        const previewHtml = uiState.pastePreview ? `
            <div style="background:var(--tltb-bg); border:1px solid var(--tltb-border); border-radius:12px; padding:9px; display:flex; flex-direction:column; gap:5px;">
                <div style="font-size:11px; font-weight:900; color:var(--tltb-accent);">
                    پیش‌نمایش (${toFaDigits(uiState.pastePreview.blocks.length)} پارت برای ${getPersianDateInfo(resolveTargetDateFromMode(uiState.pasteTargetMode)).weekday} ${getPersianDateInfo(resolveTargetDateFromMode(uiState.pasteTargetMode)).shortDate}):
                </div>
                ${uiState.pastePreview.blocks.map(b => `
                    <div style="font-size:10.5px; padding:4px 8px; border-right:3px solid ${b.color}; background:${hexToRgba(b.color, 0.08)}; border-radius:6px;">
                        <strong>${b.start !== null ? `${minutesToHHMM(b.start)} – ${minutesToHHMM(b.end)}` : 'بدون ساعت'}</strong> | ${escapeHtml(b.title)} <span style="color:${b.color};">(${CATEGORIES[b.category].short})</span>
                    </div>
                `).join('')}
                <button type="button" class="tltb-pill-btn accent" style="justify-content:center; margin-top:3px;" data-apply-paste="1">
                    ✓ تایید و اعمال روی همین روز (همراه با بکاپ)
                </button>
            </div>
        ` : '';

        const totalMinsByCat = { deep: 0, general: 0, recovery: 0, growth: 0, health: 0 };
        let totalTimedMins = 0;
        dayBlocks.forEach(b => {
            if (b.start !== null && b.end !== null) {
                const d = b.end - b.start;
                totalMinsByCat[b.category] = (totalMinsByCat[b.category] || 0) + d;
                totalTimedMins += d;
            }
        });

        const studyBlocks = dayBlocks.filter(b => CATEGORIES[b.category]?.studyRelevant);

        return `
            <!-- ۱. چسباندن برنامه از متن -->
            <div class="tltb-accordion">
                <button type="button" class="tltb-acc-header" data-toggle-acc="paste">
                    <span>📋 چسباندن برنامه از متن (آفلاین)</span>
                    <span>${uiState.openAccordions.paste ? '▴' : '▾'}</span>
                </button>
                ${uiState.openAccordions.paste ? `
                    <div class="tltb-acc-body">
                        <textarea id="tltb-paste-textarea" class="tltb-textarea" rows="4" placeholder="مثال:&#10;فقط امروز را جایگزین کن&#10;15:30 تا 16:55 | عنوان: هندسه ۳ | دسته: کار عمیق / تخصصی | توضیح: حل نمونه">${escapeHtml(uiState.pasteRaw)}</textarea>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                            <div>
                                <label style="font-size:10px; color:var(--tltb-muted); display:block; margin-bottom:3px;">روز هدف:</label>
                                <select id="tltb-paste-target" class="tltb-select">
                                    <option value="selected" ${uiState.pasteTargetMode === 'selected' ? 'selected' : ''}>روز انتخاب‌شده (${selectedInfo.weekday})</option>
                                    <option value="today" ${uiState.pasteTargetMode === 'today' ? 'selected' : ''}>امروز</option>
                                    <option value="tomorrow" ${uiState.pasteTargetMode === 'tomorrow' ? 'selected' : ''}>فردا</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size:10px; color:var(--tltb-muted); display:block; margin-bottom:3px;">حالت اعمال (فقط همان روز):</label>
                                <select id="tltb-paste-mode" class="tltb-select">
                                    <option value="replace" ${uiState.pasteApplyMode === 'replace' ? 'selected' : ''}>جایگزینی کامل فقط همان روز</option>
                                    <option value="append" ${uiState.pasteApplyMode === 'append' ? 'selected' : ''}>افزودن به برنامه همان روز</option>
                                </select>
                            </div>
                        </div>
                        <button type="button" class="tltb-pill-btn" style="justify-content:center;" data-preview-paste="1">🔍 پیش‌نمایش هوشمند متن</button>
                        ${previewHtml}
                    </div>
                ` : ''}
            </div>

            <!-- ۲. کپی روتین -->
            <div class="tltb-accordion">
                <button type="button" class="tltb-acc-header" data-toggle-acc="routine">
                    <span>🔁 کپی روتین (${selectedInfo.weekday} به روز دیگر)</span>
                    <span>${uiState.openAccordions.routine ? '▴' : '▾'}</span>
                </button>
                ${uiState.openAccordions.routine ? `
                    <div class="tltb-acc-body">
                        <p style="font-size:10.5px; color:var(--tltb-muted); margin:0;">
                            مبدأ: <strong>${selectedInfo.weekday} (${selectedInfo.shortDate})</strong> — ${toFaDigits(dayBlocks.length)} تایم‌بلاک
                        </p>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                            <select id="tltb-routine-target" class="tltb-select">
                                <option value="tomorrow" ${uiState.routineTarget === 'tomorrow' ? 'selected' : ''}>مقصد: فردا</option>
                                <option value="sat" ${uiState.routineTarget === 'sat' ? 'selected' : ''}>مقصد: شنبه این هفته</option>
                                <option value="sun" ${uiState.routineTarget === 'sun' ? 'selected' : ''}>مقصد: یکشنبه این هفته</option>
                                <option value="mon" ${uiState.routineTarget === 'mon' ? 'selected' : ''}>مقصد: دوشنبه این هفته</option>
                                <option value="tue" ${uiState.routineTarget === 'tue' ? 'selected' : ''}>مقصد: سه‌شنبه این هفته</option>
                                <option value="wed" ${uiState.routineTarget === 'wed' ? 'selected' : ''}>مقصد: چهارشنبه این هفته</option>
                                <option value="thu" ${uiState.routineTarget === 'thu' ? 'selected' : ''}>مقصد: پنجشنبه این هفته</option>
                                <option value="fri" ${uiState.routineTarget === 'fri' ? 'selected' : ''}>مقصد: جمعه این هفته</option>
                            </select>
                            <select id="tltb-routine-mode" class="tltb-select">
                                <option value="append" ${uiState.routineMode === 'append' ? 'selected' : ''}>افزودن به مقصد (امن)</option>
                                <option value="replace" ${uiState.routineMode === 'replace' ? 'selected' : ''}>جایگزینی فقط روز مقصد</option>
                            </select>
                        </div>
                        <button type="button" class="tltb-pill-btn accent" style="justify-content:center;" data-exec-routine="1">کپی برنامه به روز مقصد</button>
                    </div>
                ` : ''}
            </div>

            <!-- ۳. بازبینی شب -->
            <div class="tltb-accordion">
                <button type="button" class="tltb-acc-header" data-toggle-acc="review">
                    <span>🌙 بازبینی شب و جمع‌بندی پایان روز</span>
                    <span>${uiState.openAccordions.review ? '▴' : '▾'}</span>
                </button>
                ${uiState.openAccordions.review ? `
                    <div class="tltb-acc-body">
                        <div style="display:flex; justify-content:space-between; font-size:11px;">
                            <span>انجام‌شده: <strong style="color:var(--tltb-accent);">${toFaDigits(dayBlocks.filter(b => b.done).length)}</strong></span>
                            <span>باقی‌مانده: <strong style="color:var(--tltb-warn);">${toFaDigits(dayBlocks.filter(b => !b.done).length)}</strong></span>
                        </div>
                        <textarea id="tltb-review-note" class="tltb-textarea" rows="2" placeholder="امروز چطور گذشت؟ چه چیزی انرژی‌ات را گرفت یا به تو سرعت داد؟">${escapeHtml(reviewData.note || '')}</textarea>
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            <button type="button" class="tltb-pill-btn accent" style="flex:1; justify-content:center;" data-save-review="1">ثبت بازبینی شب</button>
                            ${dayBlocks.some(b => !b.done) ? `<button type="button" class="tltb-pill-btn" data-carry-tomorrow="1">انتقال مانده‌ها به فردا ➔</button>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- ۴. تعادل انرژی و ارسال گروهی به تایمر -->
            <div class="tltb-accordion">
                <button type="button" class="tltb-acc-header" data-toggle-acc="energy">
                    <span>⚡ تعادل انرژی روز و ارسال به تایمر</span>
                    <span>${uiState.openAccordions.energy ? '▴' : '▾'}</span>
                </button>
                ${uiState.openAccordions.energy ? `
                    <div class="tltb-acc-body">
                        <div style="display:flex; flex-direction:column; gap:5px;">
                            ${Object.values(CATEGORIES).map(c => {
                                const mins = totalMinsByCat[c.id] || 0;
                                const pct = totalTimedMins > 0 ? Math.round((mins / totalTimedMins) * 100) : 0;
                                return `
                                    <div style="font-size:10.5px;">
                                        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                                            <span>${c.icon} ${c.label}</span>
                                            <span style="color:var(--tltb-muted);">${formatDurationFa(mins)} (${toFaDigits(pct)}٪)</span>
                                        </div>
                                        <div style="height:5px; background:var(--tltb-bg); border-radius:99px; overflow:hidden;">
                                            <div style="height:100%; width:${pct}%; background:${c.defaultColor};"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        ${studyBlocks.length ? `
                            <div style="border-top:1px solid var(--tltb-border-soft); padding-top:8px; margin-top:2px;">
                                <div style="font-size:11px; font-weight:800; margin-bottom:5px;">ارسال پارت‌های مطالعاتی به صف تایمر:</div>
                                <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:7px;">
                                    ${studyBlocks.map(b => `
                                        <label style="display:flex; align-items:center; gap:7px; font-size:11px; background:var(--tltb-bg); padding:6px 9px; border-radius:9px; cursor:pointer;">
                                            <input type="checkbox" data-timer-chk="${b.id}" ${uiState.selectedForTimer[b.id] ? 'checked' : ''} />
                                            <span style="flex:1;">${escapeHtml(b.title)}</span>
                                            <span style="color:var(--tltb-muted); font-size:10px;">${b.start !== null ? formatDurationFa(b.end - b.start) : '۶۰ دقیقه'}</span>
                                        </label>
                                    `).join('')}
                                </div>
                                <button type="button" class="tltb-pill-btn accent" style="width:100%; justify-content:center;" data-send-selected-timer="1">⏱️ ارسال انتخاب‌شده‌ها به تایمر</button>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>

            <!-- ۵. پشتیبان‌گیری و سطل بازیابی -->
            <div class="tltb-accordion">
                <button type="button" class="tltb-acc-header" data-toggle-acc="backup">
                    <span>💾 پشتیبان‌گیری و سطل بازیابی (${toFaDigits(uiState.store.trash.length)})</span>
                    <span>${uiState.openAccordions.backup ? '▴' : '▾'}</span>
                </button>
                ${uiState.openAccordions.backup ? `
                    <div class="tltb-acc-body">
                        <div style="display:flex; flex-wrap:wrap; gap:6px;">
                            <button type="button" class="tltb-pill-btn" data-export-json="1">⬇️ دانلود پشتیبان</button>
                            <label class="tltb-pill-btn" style="cursor:pointer;">
                                ⬆️ بازیابی فایل
                                <input type="file" id="tltb-import-file" accept=".json" style="display:none;" />
                            </label>
                            ${localStorage.getItem(BACKUP_KEY) ? `<button type="button" class="tltb-pill-btn" data-restore-autobackup="1">↩️ بکاپ خودکار</button>` : ''}
                        </div>
                        ${uiState.store.trash.length ? `
                            <div style="margin-top:6px;">
                                <div style="font-size:10.5px; font-weight:800; color:var(--tltb-muted); margin-bottom:4px;">حذف‌شده‌های اخیر:</div>
                                <div style="display:flex; flex-direction:column; gap:4px;">
                                    ${uiState.store.trash.slice(0, 10).map(t => `
                                        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--tltb-bg); padding:6px 9px; border-radius:9px; font-size:11px;">
                                            <span>${escapeHtml(t.title)} <span style="color:var(--tltb-muted); font-size:9.5px;">(${getPersianDateInfo(t.date).shortDate})</span></span>
                                            <button type="button" class="tltb-pill-btn" data-restore-trash="${t.id}">بازیابی</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /* ==================== باتم‌شیت افزودن و ویرایش کار ==================== */

    function openAddOrEditSheet(block = null, presetSlot = null) {
        if (block) {
            uiState.editingBlockId = block.id;
            uiState.form = {
                title: block.title,
                note: block.note || '',
                category: block.category,
                color: block.color,
                hasTime: block.start !== null && block.end !== null,
                startStr: block.start !== null ? minutesToHHMM(block.start, false) : '16:00',
                endStr: block.end !== null ? minutesToHHMM(block.end, false) : '17:15',
                domino: Boolean(block.domino)
            };
        } else {
            let defStart = 960; // 16:00
            let defEnd = 1020;  // 17:00
            if (presetSlot && presetSlot.start !== undefined && presetSlot.end !== undefined) {
                defStart = presetSlot.start;
                defEnd = presetSlot.end;
            } else {
                const existing = getBlocksForDate(uiState.selectedDate).filter(b => b.end !== null);
                const lastEnd = existing.length ? existing[existing.length - 1].end : 960;
                defStart = Math.min(1380, lastEnd);
                defEnd = Math.min(1440, defStart + 60);
            }
            uiState.editingBlockId = null;
            uiState.form = {
                title: '',
                note: '',
                category: 'deep',
                color: CATEGORIES.deep.defaultColor,
                hasTime: true,
                startStr: minutesToHHMM(defStart, false),
                endStr: minutesToHHMM(defEnd, false),
                domino: !getBlocksForDate(uiState.selectedDate).some(b => b.domino)
            };
        }
        uiState.sheetOpen = true;
        renderOverlay();
        setTimeout(() => {
            const inp = document.getElementById('tltb-form-title');
            if (inp) inp.focus();
        }, 40);
    }

    function renderAddEditSheet() {
        if (!uiState.sheetOpen) return '';
        const f = uiState.form;
        const startMins = f.hasTime ? hhmmToMinutes(f.startStr) : null;
        const endMins = f.hasTime ? hhmmToMinutes(f.endStr) : null;
        const overlap = f.hasTime ? findOverlap(uiState.selectedDate, startMins, endMins, uiState.editingBlockId) : null;

        return `
            <div class="tltb-sheet-backdrop" id="tltb-sheet-backdrop">
                <div class="tltb-sheet">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:14px; font-weight:900;">${uiState.editingBlockId ? 'ویرایش تایم‌بلاک' : 'افزودن تایم‌بلاک جدید'}</h3>
                        <button type="button" class="tltb-close-btn" data-close-sheet="1">×</button>
                    </div>

                    <input type="text" id="tltb-form-title" class="tltb-input" placeholder="عنوان کار (مثلاً: تست‌زنی حسابان ۲)" value="${escapeHtml(f.title)}" />

                    <div>
                        <div style="font-size:10.5px; color:var(--tltb-muted); margin-bottom:5px;">دسته‌بندی انرژی:</div>
                        <div class="tltb-cat-pills">
                            ${Object.values(CATEGORIES).map(c => {
                                const active = f.category === c.id;
                                return `<button type="button" class="tltb-cat-pill ${active ? 'active' : ''}" style="${active ? `background:${c.defaultColor};` : ''}" data-pick-cat="${c.id}">${c.icon} ${c.short}</button>`;
                            }).join('')}
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; justify-content:space-between; background:var(--tltb-bg); padding:8px 11px; border-radius:11px;">
                        <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; cursor:pointer;">
                            <input type="checkbox" id="tltb-form-hastime" ${f.hasTime ? 'checked' : ''} />
                            <span>دارای ساعت مشخص</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:800; color:var(--tltb-accent); cursor:pointer;">
                            <input type="checkbox" id="tltb-form-domino" ${f.domino ? 'checked' : ''} />
                            <span>⭐ سنگ بزرگ روز</span>
                        </label>
                    </div>

                    ${f.hasTime ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px;">
                            <div>
                                <label style="font-size:10px; color:var(--tltb-muted); display:block; margin-bottom:3px;">شروع:</label>
                                <input type="time" id="tltb-form-start" class="tltb-input" dir="ltr" value="${escapeHtml(f.startStr)}" />
                            </div>
                            <div>
                                <label style="font-size:10px; color:var(--tltb-muted); display:block; margin-bottom:3px;">پایان:</label>
                                <input type="time" id="tltb-form-end" class="tltb-input" dir="ltr" value="${escapeHtml(f.endStr)}" />
                            </div>
                        </div>
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                            ${[30, 45, 60, 75, 90].map(dur => `<button type="button" class="tltb-pill-btn" data-quick-dur="${dur}">${toFaDigits(dur)} دقیقه</button>`).join('')}
                        </div>
                    ` : ''}

                    ${overlap ? `
                        <div style="background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.45); color:#fde68a; border-radius:10px; padding:7px 9px; font-size:10.5px; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                            <span>تداخل با «${escapeHtml(overlap.title)}»</span>
                            <button type="button" class="tltb-pill-btn" data-fix-overlap="${overlap.end}">تنظیم بعد از آن</button>
                        </div>
                    ` : ''}

                    <textarea id="tltb-form-note" class="tltb-textarea" rows="2" placeholder="یادداشت یا جزئیات کوتاه (اختیاری)...">${escapeHtml(f.note)}</textarea>

                    <button type="button" class="tltb-add-primary-btn" style="max-width:100%;" data-submit-form="1">
                        ✓ ${uiState.editingBlockId ? 'ذخیره تغییرات' : 'افزودن به برنامه'}
                    </button>
                </div>
            </div>
        `;
    }

    /* ==================== رندر کل صفحه با حفظ دقیق موقعیت اسکرول ==================== */

    function renderOverlay() {
        let overlay = document.getElementById('tltb-overlay');
        if (!overlay) {
            overlay = document.createElement('section');
            overlay.id = 'tltb-overlay';
            overlay.setAttribute('aria-label', 'تایم‌بلاک زندگی');
            document.body.appendChild(overlay);
        }

        // ذخیره موقعیت فعلی اسکرول قبل از بازسازی DOM
        const prevScrollArea = overlay.querySelector('.tltb-scroll-area');
        const savedScrollTop = prevScrollArea ? prevScrollArea.scrollTop : 0;

        overlay.classList.toggle('open', uiState.isOpen);
        if (!uiState.isOpen) return;

        overlay.innerHTML = `
            <header class="tltb-topbar">
                <div class="tltb-title-group">
                    <h2>🌿 تایم‌بلاک زندگی</h2>
                    <p>سبک دن مارتل · مناسب بازبینی شب</p>
                </div>
                <div class="tltb-top-actions">
                    <button type="button" class="tltb-pill-btn" data-jump-today="1">امروز</button>
                    <button type="button" class="tltb-pill-btn" data-toggle-view="1">${uiState.viewMode === 'day' ? 'نمای هفته' : 'نمای روز'}</button>
                    <button type="button" class="tltb-close-btn" data-close-planner="1" aria-label="بستن">×</button>
                </div>
            </header>

            <div class="tltb-scroll-area">
                <div class="tltb-container">
                    ${renderWeekHeaderAndDays()}
                    ${uiState.viewMode === 'day' ? renderDayView() : renderWeekOverview()}
                    ${renderAccordions()}
                </div>
            </div>

            <div class="tltb-bottom-bar">
                <button type="button" class="tltb-add-primary-btn" data-open-add="1">
                    <span>+</span>
                    <span>افزودن تایم‌بلاک برای ${getPersianDateInfo(uiState.selectedDate).weekday}</span>
                </button>
            </div>

            ${renderAddEditSheet()}
        `;

        bindOverlayEvents(overlay);

        // بازگردانی دقیق موقعیت اسکرول تا صفحه نپرد
        const newScrollArea = overlay.querySelector('.tltb-scroll-area');
        if (newScrollArea && savedScrollTop > 0) {
            newScrollArea.scrollTop = savedScrollTop;
        }
    }

    function bindOverlayEvents(overlay) {
        overlay.querySelector('[data-close-planner]')?.addEventListener('click', closePlanner);
        overlay.querySelector('[data-jump-today]')?.addEventListener('click', () => {
            const today = getTehranTodayISO();
            uiState.selectedDate = today;
            uiState.weekStartISO = getSaturdayOfWeekISO(today);
            uiState.viewMode = 'day';
            renderOverlay();
            const sc = overlay.querySelector('.tltb-scroll-area');
            if (sc) sc.scrollTop = 0;
        });
        overlay.querySelector('[data-toggle-view]')?.addEventListener('click', () => {
            uiState.viewMode = uiState.viewMode === 'day' ? 'week' : 'day';
            renderOverlay();
        });

        overlay.querySelectorAll('[data-nav-week]').forEach(btn => {
            btn.addEventListener('click', () => {
                const delta = Number(btn.getAttribute('data-nav-week'));
                uiState.weekStartISO = addDaysISO(uiState.weekStartISO, delta);
                uiState.selectedDate = addDaysISO(uiState.selectedDate, delta);
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-select-date]').forEach(btn => {
            btn.addEventListener('click', () => {
                uiState.selectedDate = btn.getAttribute('data-select-date');
                uiState.viewMode = 'day';
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-jump-day]').forEach(card => {
            card.addEventListener('click', () => {
                uiState.selectedDate = card.getAttribute('data-jump-day');
                uiState.viewMode = 'day';
                renderOverlay();
            });
        });

        overlay.querySelectorAll('[data-subview]').forEach(btn => {
            btn.addEventListener('click', () => {
                uiState.daySubView = btn.getAttribute('data-subview');
                renderOverlay();
            });
        });

        // انتخاب اولین کار به‌عنوان سنگ بزرگ
        overlay.querySelector('[data-set-first-domino]')?.addEventListener('click', e => {
            e.stopPropagation();
            const dayBlocks = getBlocksForDate(uiState.selectedDate);
            if (!dayBlocks.length) return;
            const candidate = dayBlocks.find(b => !b.done) || dayBlocks[0];
            toggleBlockDomino(candidate.id);
            renderOverlay();
        });

        // کلیک روی بدنه کارت برای باز کردن ویرایش (بدون تداخل با دکمه‌های داخلی)
        overlay.querySelectorAll('[data-card-edit]').forEach(cardEl => {
            cardEl.addEventListener('click', e => {
                if (e.target.closest('button, input, label, a')) return;
                const id = cardEl.getAttribute('data-card-edit');
                const blk = uiState.store.blocks.find(b => b.id === id);
                if (blk) openAddOrEditSheet(blk);
            });
        });

        // دکمه‌های داخلی کارت‌ها (همگی با stopPropagation)
        overlay.querySelectorAll('[data-toggle-done]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                toggleBlockDone(btn.getAttribute('data-toggle-done'));
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-toggle-domino]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                toggleBlockDomino(btn.getAttribute('data-toggle-domino'));
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-move-block]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const [id, dir] = btn.getAttribute('data-move-block').split(':');
                moveBlockOrder(id, Number(dir));
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-nudge-block]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const [id, delta] = btn.getAttribute('data-nudge-block').split(':');
                nudgeBlockTime(id, Number(delta));
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-toggle-note]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id = btn.getAttribute('data-toggle-note');
                uiState.expandedNotes[id] = !uiState.expandedNotes[id];
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-send-single-timer]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                sendBlocksToStudyTimer([btn.getAttribute('data-send-single-timer')]);
            });
        });
        overlay.querySelectorAll('[data-del-block]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                deleteBlockToTrash(btn.getAttribute('data-del-block'));
                renderOverlay();
            });
        });

        // کلیک روی وقت آزاد در محور ساعتی برای افزودن سریع در همان بازه
        overlay.querySelectorAll('[data-add-at-slot]').forEach(slotEl => {
            slotEl.addEventListener('click', () => {
                const [s, e] = slotEl.getAttribute('data-add-at-slot').split(':').map(Number);
                openAddOrEditSheet(null, { start: s, end: e });
            });
        });

        // تأخیر و جلو انداختن دسته‌ای
        overlay.querySelectorAll('[data-toggle-delay]').forEach(btn => {
            btn.addEventListener('click', () => {
                uiState.delayOpen = btn.getAttribute('data-toggle-delay') === '1';
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-exec-delay]').forEach(btn => {
            btn.addEventListener('click', () => {
                applyBatchShift(uiState.selectedDate, Number(btn.getAttribute('data-exec-delay')));
                uiState.delayOpen = false;
                renderOverlay();
            });
        });
        const customDelayInp = overlay.querySelector('#tltb-custom-delay-input');
        if (customDelayInp) {
            customDelayInp.addEventListener('input', () => {
                uiState.customDelayInput = customDelayInp.value;
            });
        }
        overlay.querySelectorAll('[data-exec-custom-delay]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sign = Number(btn.getAttribute('data-exec-custom-delay')) || 1;
                const val = Math.abs(parseInt(toEnDigits(uiState.customDelayInput), 10) || 0);
                if (!val) {
                    showToast('مقدار دقیقه را وارد کنید');
                    return;
                }
                applyBatchShift(uiState.selectedDate, sign * val);
                uiState.delayOpen = false;
                renderOverlay();
            });
        });

        // باز کردن باتم‌شیت افزودن
        overlay.querySelectorAll('[data-open-add]').forEach(btn => {
            btn.addEventListener('click', () => openAddOrEditSheet(null));
        });

        // آکاردئون‌ها
        overlay.querySelectorAll('[data-toggle-acc]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-toggle-acc');
                uiState.openAccordions[key] = !uiState.openAccordions[key];
                renderOverlay();
            });
        });
        overlay.querySelectorAll('[data-open-acc]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-open-acc');
                uiState.openAccordions[key] = true;
                renderOverlay();
            });
        });

        // چسباندن برنامه از متن
        const pasteTa = overlay.querySelector('#tltb-paste-textarea');
        if (pasteTa) {
            pasteTa.addEventListener('input', () => { uiState.pasteRaw = pasteTa.value; });
        }
        overlay.querySelector('#tltb-paste-target')?.addEventListener('change', e => {
            uiState.pasteTargetMode = e.target.value;
            renderOverlay();
        });
        overlay.querySelector('#tltb-paste-mode')?.addEventListener('change', e => {
            uiState.pasteApplyMode = e.target.value;
        });
        overlay.querySelector('[data-preview-paste]')?.addEventListener('click', () => {
            const parsed = parseScheduleText(uiState.pasteRaw);
            if (!parsed || !parsed.blocks.length) {
                showToast('هیچ تایم‌بلاک معتبری در متن پیدا نشد');
                return;
            }
            if (parsed.detectedTarget) uiState.pasteTargetMode = parsed.detectedTarget;
            if (parsed.detectedApplyMode) uiState.pasteApplyMode = parsed.detectedApplyMode;
            uiState.pastePreview = parsed;
            renderOverlay();
        });
        overlay.querySelector('[data-apply-paste]')?.addEventListener('click', () => {
            if (!uiState.pastePreview || !uiState.pastePreview.blocks.length) return;
            const targetDate = resolveTargetDateFromMode(uiState.pasteTargetMode);
            const newBlocks = uiState.pastePreview.blocks.map(b => ({
                ...b,
                id: generateId('blk'),
                date: targetDate
            }));

            let nextAll = [...uiState.store.blocks];
            if (uiState.pasteApplyMode === 'replace') {
                nextAll = nextAll.filter(b => b.date !== targetDate);
            }
            nextAll = enforceSingleDominoPerDay([...nextAll, ...newBlocks]);

            uiState.store.blocks = nextAll;
            uiState.store = saveStore(uiState.store, { backup: true });
            uiState.selectedDate = targetDate;
            uiState.weekStartISO = getSaturdayOfWeekISO(targetDate);
            uiState.pasteRaw = '';
            uiState.pastePreview = null;
            renderOverlay();
            showToast(`برنامه ${getPersianDateInfo(targetDate).weekday} با موفقیت اعمال شد ✓`);
        });

        // کپی روتین
        overlay.querySelector('#tltb-routine-target')?.addEventListener('change', e => { uiState.routineTarget = e.target.value; });
        overlay.querySelector('#tltb-routine-mode')?.addEventListener('change', e => { uiState.routineMode = e.target.value; });
        overlay.querySelector('[data-exec-routine]')?.addEventListener('click', () => {
            const sourceBlocks = getBlocksForDate(uiState.selectedDate);
            if (!sourceBlocks.length) {
                showToast('روز مبدأ خالی است');
                return;
            }
            const targetDate = resolveTargetDateFromMode(uiState.routineTarget);
            if (targetDate === uiState.selectedDate) {
                showToast('روز مبدأ و مقصد یکسان هستند');
                return;
            }
            const cloned = sourceBlocks.map(b => ({
                ...b,
                id: generateId('blk'),
                date: targetDate,
                done: false
            }));

            let nextAll = [...uiState.store.blocks];
            if (uiState.routineMode === 'replace') {
                nextAll = nextAll.filter(b => b.date !== targetDate);
            }
            nextAll = enforceSingleDominoPerDay([...nextAll, ...cloned]);
            uiState.store.blocks = nextAll;
            uiState.store = saveStore(uiState.store, { backup: true });
            showToast(`برنامه به ${getPersianDateInfo(targetDate).weekday} کپی شد ✓`);
        });

        // بازبینی شب
        overlay.querySelector('[data-save-review]')?.addEventListener('click', () => {
            const note = overlay.querySelector('#tltb-review-note')?.value || '';
            uiState.store.finalized[uiState.selectedDate] = {
                note: note.trim(),
                completedAt: Date.now()
            };
            uiState.store = saveStore(uiState.store);
            showToast('بازبینی شب ثبت شد 🌙');
        });
        overlay.querySelector('[data-carry-tomorrow]')?.addEventListener('click', () => {
            const undone = getBlocksForDate(uiState.selectedDate).filter(b => !b.done);
            if (!undone.length) return;
            const tomorrow = addDaysISO(uiState.selectedDate, 1);
            const moved = undone.map(b => ({
                ...b,
                id: generateId('blk'),
                date: tomorrow,
                domino: false
            }));
            uiState.store.blocks.push(...moved);
            uiState.store = saveStore(uiState.store, { backup: true });
            showToast(`${toFaDigits(moved.length)} کار ناتمام به فردا منتقل شد`);
        });

        // انتخاب گروهی تایمر
        overlay.querySelectorAll('[data-timer-chk]').forEach(chk => {
            chk.addEventListener('change', () => {
                const id = chk.getAttribute('data-timer-chk');
                if (chk.checked) uiState.selectedForTimer[id] = true;
                else delete uiState.selectedForTimer[id];
            });
        });
        overlay.querySelector('[data-send-selected-timer]')?.addEventListener('click', () => {
            const ids = Object.keys(uiState.selectedForTimer);
            sendBlocksToStudyTimer(ids);
            renderOverlay();
        });

        // پشتیبان‌گیری و سطل زباله
        overlay.querySelector('[data-export-json]')?.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(uiState.store, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `tilo-timeblock-${getTehranTodayISO()}.json`;
            a.click();
        });
        overlay.querySelector('#tltb-import-file')?.addEventListener('change', e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    uiState.store = saveStore(parsed, { backup: true });
                    renderOverlay();
                    showToast('فایل پشتیبان بازیابی شد ✓');
                } catch (_) {
                    showToast('فایل پشتیبان معتبر نیست');
                }
            };
            reader.readAsText(file);
        });
        overlay.querySelector('[data-restore-autobackup]')?.addEventListener('click', () => {
            const raw = localStorage.getItem(BACKUP_KEY);
            if (!raw) return;
            uiState.store = saveStore(raw, { backup: false });
            renderOverlay();
            showToast('آخرین بکاپ خودکار بازگردانی شد ✓');
        });
        overlay.querySelectorAll('[data-restore-trash]').forEach(btn => {
            btn.addEventListener('click', () => {
                restoreFromTrash(btn.getAttribute('data-restore-trash'));
                renderOverlay();
            });
        });

        // رویدادهای باتم‌شیت افزودن / ویرایش
        if (uiState.sheetOpen) {
            overlay.querySelector('#tltb-sheet-backdrop')?.addEventListener('click', e => {
                if (e.target.id === 'tltb-sheet-backdrop') {
                    uiState.sheetOpen = false;
                    renderOverlay();
                }
            });
            overlay.querySelector('[data-close-sheet]')?.addEventListener('click', () => {
                uiState.sheetOpen = false;
                renderOverlay();
            });
            overlay.querySelector('#tltb-form-title')?.addEventListener('input', e => { uiState.form.title = e.target.value; });
            overlay.querySelector('#tltb-form-note')?.addEventListener('input', e => { uiState.form.note = e.target.value; });
            overlay.querySelector('#tltb-form-hastime')?.addEventListener('change', e => {
                uiState.form.hasTime = e.target.checked;
                renderOverlay();
            });
            overlay.querySelector('#tltb-form-domino')?.addEventListener('change', e => {
                uiState.form.domino = e.target.checked;
            });
            overlay.querySelector('#tltb-form-start')?.addEventListener('change', e => {
                uiState.form.startStr = e.target.value;
                renderOverlay();
            });
            overlay.querySelector('#tltb-form-end')?.addEventListener('change', e => {
                uiState.form.endStr = e.target.value;
                renderOverlay();
            });
            overlay.querySelectorAll('[data-pick-cat]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const catId = btn.getAttribute('data-pick-cat');
                    uiState.form.category = catId;
                    uiState.form.color = CATEGORIES[catId].defaultColor;
                    renderOverlay();
                });
            });
            overlay.querySelectorAll('[data-quick-dur]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const dur = Number(btn.getAttribute('data-quick-dur'));
                    const s = hhmmToMinutes(uiState.form.startStr) ?? 960;
                    uiState.form.endStr = minutesToHHMM(Math.min(1440, s + dur), false);
                    renderOverlay();
                });
            });
            overlay.querySelector('[data-fix-overlap]')?.addEventListener('click', e => {
                const newStart = Number(e.currentTarget.getAttribute('data-fix-overlap'));
                const curS = hhmmToMinutes(uiState.form.startStr) ?? newStart;
                const curE = hhmmToMinutes(uiState.form.endStr) ?? (curS + 60);
                const dur = Math.max(15, curE - curS);
                uiState.form.startStr = minutesToHHMM(Math.min(1440 - dur, newStart), false);
                uiState.form.endStr = minutesToHHMM(Math.min(1440, newStart + dur), false);
                renderOverlay();
            });
            overlay.querySelector('[data-submit-form]')?.addEventListener('click', () => {
                const title = uiState.form.title.trim();
                if (!title) {
                    showToast('عنوان کار را وارد کنید');
                    return;
                }
                const start = uiState.form.hasTime ? hhmmToMinutes(uiState.form.startStr) : null;
                const end = uiState.form.hasTime ? hhmmToMinutes(uiState.form.endStr) : null;

                upsertBlock({
                    id: uiState.editingBlockId,
                    date: uiState.selectedDate,
                    title,
                    note: uiState.form.note,
                    category: uiState.form.category,
                    color: uiState.form.color,
                    start,
                    end,
                    domino: uiState.form.domino
                });
                uiState.sheetOpen = false;
                renderOverlay();
            });
        }
    }

    /* ==================== باز و بسته کردن و اتصال به صفحه ==================== */

    function openPlanner(dateISO = null) {
        uiState.store = loadStore();
        if (dateISO && /^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
            uiState.selectedDate = dateISO;
            uiState.weekStartISO = getSaturdayOfWeekISO(dateISO);
        }
        uiState.isOpen = true;
        renderOverlay();
    }

    function closePlanner() {
        uiState.isOpen = false;
        uiState.sheetOpen = false;
        renderOverlay();
    }

    function togglePlanner() {
        if (uiState.isOpen) closePlanner();
        else openPlanner();
    }

    function mountLauncher() {
        injectStyles();

        const martellContainer = document.getElementById('tilo-martell');
        if (martellContainer) {
            if (!martellContainer.querySelector('#tltb-launcher-btn')) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = 'tltb-launcher-btn';
                btn.innerHTML = '<span>🌿</span><span>تایم‌بلاک زندگی</span>';
                btn.addEventListener('click', () => openPlanner());
                martellContainer.appendChild(btn);
            }
            const floating = document.getElementById('tltb-floating-launcher');
            if (floating) floating.remove();
            return;
        }

        if (!document.getElementById('tltb-floating-launcher')) {
            const wrap = document.createElement('div');
            wrap.id = 'tltb-floating-launcher';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'tltb-launcher-btn';
            btn.innerHTML = '<span>🌿</span><span>تایم‌بلاک زندگی</span>';
            btn.addEventListener('click', () => openPlanner());
            wrap.appendChild(btn);
            document.body.appendChild(wrap);
        }
    }

    const publicApi = {
        open: openPlanner,
        close: closePlanner,
        toggle: togglePlanner,
        getStore: () => loadStore(),
        getTodayBlocks: () => getBlocksForDate(getTehranTodayISO()),
        refresh: () => {
            uiState.store = loadStore();
            if (uiState.isOpen) renderOverlay();
        }
    };

    window.tiloMartellPlanner = publicApi;
    window.tiloMartell = publicApi;

    window.addEventListener('tilo:planner-updated', () => {
        uiState.store = loadStore();
        if (uiState.isOpen) renderOverlay();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && uiState.isOpen) {
            if (uiState.sheetOpen) {
                uiState.sheetOpen = false;
                renderOverlay();
            } else {
                closePlanner();
            }
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            mountLauncher();
            setInterval(mountLauncher, 1500);
        });
    } else {
        mountLauncher();
        setInterval(mountLauncher, 1500);
    }
})();
