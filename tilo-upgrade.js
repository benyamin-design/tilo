/**
 * Tilo Upgrade Suite (بهینه‌شده)
 * تم روز/شب مات · منوی کشویی · تایمر · برنامه هفتگی · PDF · بدون آلرت اضافه
 */
(function initTiloUpgrade() {
    'use strict';

    window.TiloPlus = window.TiloPlus || {
        vueState: null,
        deletedIds: JSON.parse(localStorage.getItem('tilo_deleted_ids') || '[]'),
        isSyncingFromCloud: false,
        syncTimeout: null,
        unsubscribeSnapshot: null
    };
    window.TiloPro = window.TiloPro || {
        theme: localStorage.getItem('tilo_ui_theme') || 'night',
        collapsedDays: JSON.parse(localStorage.getItem('tilo_collapsed_days') || '{}')
    };

    const styleEl = document.createElement('style');
    styleEl.id = 'tilo-upgrade-styles';
    styleEl.textContent = `
        main { padding-bottom: 7.5rem !important; scroll-behavior: smooth; }
        .tilo-timer-spacer { height: 96px; width: 100%; pointer-events: none; }
        .tilo-timer-pro-card {
            background: #1b1e24 !important;
            border: 1px solid #2e333d !important;
            box-shadow: 0 12px 28px rgba(0,0,0,0.35) !important;
        }
        .tilo-timer-pro-card::before { display: none !important; }
        .tilo-timer-digits-glow {
            text-shadow: none !important;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.06em !important;
        }
        .tilo-hamburger-btn {
            width: 40px; height: 40px; border-radius: 0.75rem;
            background: rgba(30,41,59,0.92); border: 1px solid rgba(148,163,184,0.22);
            color: #e2e8f0; display: inline-flex; align-items: center; justify-content: center;
            cursor: pointer; transition: border-color .2s, transform .2s;
        }
        .tilo-hamburger-btn:hover { border-color: #64748b; transform: translateY(-1px); }
        .tilo-drawer-backdrop {
            position: fixed; inset: 0; background: rgba(2,6,23,0.72);
            backdrop-filter: blur(5px); z-index: 99990; opacity: 0; pointer-events: none;
            transition: opacity .25s ease;
        }
        .tilo-drawer-backdrop.open { opacity: 1; pointer-events: auto; }
        .tilo-drawer-panel {
            position: fixed; top: 0; right: 0; bottom: 0; width: 290px; max-width: 86vw;
            background: #151820; border-left: 1px solid #2a2e37; z-index: 99995;
            transform: translateX(100%); transition: transform .28s cubic-bezier(0.16,1,0.3,1);
            display: flex; flex-direction: column; padding: 1.1rem; overflow-y: auto;
        }
        .tilo-drawer-panel.open { transform: translateX(0); }
        .btn-calm { transition: transform .18s ease, filter .18s ease !important; }
        .btn-calm:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .btn-calm:active { transform: scale(0.97) !important; }
        .soft-card { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease !important; }
        .soft-card:hover { transform: translateY(-1px); }
        .tilo-break, .tilo-part-option, .tilo-queue-item {
            overflow-wrap: anywhere; word-break: break-word; white-space: normal; line-height: 1.55;
        }
        body.tilo-theme-night {
            background-color: #12151a !important; background-image: none !important; color: #e4e4e7 !important;
        }
        body.tilo-theme-night .soft-card,
        body.tilo-theme-night nav.soft-card,
        body.tilo-theme-night header {
            background: #1b1e24 !important; border-color: #2a2e37 !important;
            box-shadow: 0 6px 18px rgba(0,0,0,0.28) !important; backdrop-filter: none !important;
        }
        body.tilo-theme-night .input-calm {
            background: #131519 !important; border-color: #2e333d !important; color: #f4f4f5 !important;
        }
        body.tilo-theme-day {
            background-color: #f2efe8 !important; background-image: none !important; color: #1f2937 !important;
        }
        body.tilo-theme-day .soft-card,
        body.tilo-theme-day nav.soft-card,
        body.tilo-theme-day header {
            background: #ffffff !important; border-color: #e5e0d8 !important;
            box-shadow: 0 4px 14px rgba(28,25,23,0.05) !important; color: #1f2937 !important;
        }
        body.tilo-theme-day .text-white { color: #111827 !important; }
        body.tilo-theme-day .text-slate-200,
        body.tilo-theme-day .text-slate-300 { color: #374151 !important; }
        body.tilo-theme-day .text-slate-400,
        body.tilo-theme-day .text-slate-500 { color: #6b7280 !important; }
        body.tilo-theme-day .bg-slate-900,
        body.tilo-theme-day .bg-slate-900\\/70,
        body.tilo-theme-day .bg-slate-900\\/80,
        body.tilo-theme-day .bg-slate-800,
        body.tilo-theme-day .bg-slate-800\\/40,
        body.tilo-theme-day .bg-slate-950\\/60,
        body.tilo-theme-day .bg-slate-950\\/80 {
            background-color: #f6f3ec !important; color: #1f2937 !important; border-color: #e5e0d8 !important;
        }
        body.tilo-theme-day .input-calm {
            background: #faf9f6 !important; border-color: #d6cfc2 !important; color: #111827 !important;
        }
        body.tilo-theme-day .border-slate-800,
        body.tilo-theme-day .border-slate-700 { border-color: #e5e0d8 !important; }
        body.tilo-theme-day .tilo-drawer-panel { background: #fcfbf9 !important; border-left-color: #e5e0d8 !important; }
        body.tilo-theme-day .tilo-hamburger-btn {
            background: #fff !important; border-color: #d6cfc2 !important; color: #1f2937 !important;
        }
        body.tilo-theme-day .tilo-timer-pro-card {
            background: #fff !important; border-color: #d6cfc2 !important; box-shadow: 0 8px 20px rgba(0,0,0,0.05) !important;
        }
        body.tilo-theme-day .tilo-timer-digits-glow { color: #111827 !important; }
        body.tilo-theme-day .tilo-part-option {
            background: #f8f6f1 !important; border-color: #e5e0d8 !important; color: #1f2937 !important;
        }
        body.tilo-theme-day .tilo-part-option.is-selected {
            border-color: #4f46e5 !important; background: #eef2ff !important;
        }
        body.tilo-theme-day button.bg-primary { color: #fff !important; }
        .tilo-theme-switch-btn {
            padding: 0.4rem 0.7rem; border-radius: 0.7rem; font-size: 11px; font-weight: 700;
            display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;
            border: 1px solid rgba(148,163,184,0.25);
        }
    `;
    document.head.appendChild(styleEl);

    function applyTheme(mode) {
        const m = mode === 'day' ? 'day' : 'night';
        window.TiloPro.theme = m;
        localStorage.setItem('tilo_ui_theme', m);
        document.body.classList.remove('tilo-theme-day', 'tilo-theme-night');
        document.body.classList.add(m === 'day' ? 'tilo-theme-day' : 'tilo-theme-night');
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', m === 'day' ? '#f2efe8' : '#12151a');
        const btn = document.getElementById('tilo-theme-toggle-btn');
        if (btn) {
            btn.innerHTML = m === 'day'
                ? '<i class="fas fa-moon"></i><span class="hidden sm:inline">شب</span>'
                : '<i class="fas fa-sun"></i><span class="hidden sm:inline">روز</span>';
        }
        try {
            const st = window.TiloPlus.vueState;
            if (st && st.settings) st.settings.theme = m;
        } catch (_) {}
    }

    function todayISO() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
    }
    function todayFa() {
        return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(new Date());
    }

    const waitVue = setInterval(() => {
        const appEl = document.getElementById('app');
        if (!(appEl && appEl.__vue_app__ && appEl.__vue_app__._instance)) return;
        clearInterval(waitVue);
        const state = appEl.__vue_app__._instance.setupState;
        window.TiloPlus.vueState = state;
        applyTheme(localStorage.getItem('tilo_ui_theme') || 'night');
        setupCloud(state);
        setupHeader(state);
        setupTimerExtras(state);
        setupWeekly(state);
        setupPdf(state);
        suppressNoiseAlerts();
    }, 180);

    function suppressNoiseAlerts() {
        const _alert = window.alert;
        window.alert = function (msg) {
            if (typeof msg === 'string' && (
                msg.indexOf('پارت‌های در انتظار') !== -1 ||
                (msg.indexOf('به لیست') !== -1 && msg.indexOf('اضافه') !== -1)
            )) return;
            return _alert.apply(this, arguments);
        };
    }

    async function setupCloud(state) {
        const FB = '10.8.0';
        try {
            const firestoreMod = await import('https://www.gstatic.com/firebasejs/' + FB + '/firebase-firestore.js');
            const authMod = await import('https://www.gstatic.com/firebasejs/' + FB + '/firebase-auth.js');
            const appMod = await import('https://www.gstatic.com/firebasejs/' + FB + '/firebase-app.js');
            const origSetItem = localStorage.setItem.bind(localStorage);
            localStorage.setItem = function (key, value) {
                origSetItem(key, value);
                if (!window.TiloPlus.isSyncingFromCloud && (key === 'sp_pro_parts' || key === 'sp_pro_settings' || key === 'tilo_weekly_parts')) {
                    schedulePush();
                }
            };
            function conn() {
                const raw = localStorage.getItem('tilo_fb_config') || state.firebaseConfigInput;
                if (!raw) return null;
                try {
                    const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    if (!cfg || !cfg.apiKey) return null;
                    const apps = appMod.getApps ? appMod.getApps() : [];
                    const app = apps.length ? apps[0] : appMod.initializeApp(cfg);
                    return { auth: authMod.getAuth(app), db: firestoreMod.getFirestore(app) };
                } catch (_) { return null; }
            }
            function mergeParts(localArr, cloudArr) {
                const map = new Map();
                const del = new Set(window.TiloPlus.deletedIds || []);
                (cloudArr || []).forEach(function (p) { if (p && p.id && !del.has(p.id)) map.set(p.id, p); });
                (localArr || []).forEach(function (p) {
                    if (!p || !p.id || del.has(p.id)) return;
                    var ex = map.get(p.id);
                    if (!ex) map.set(p.id, p);
                    else if (p.status === 'completed' && ex.status !== 'completed') map.set(p.id, p);
                    else if ((p.updatedAt || p.completedAt || 0) > (ex.updatedAt || ex.completedAt || 0)) map.set(p.id, p);
                });
                return Array.from(map.values()).sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
            }
            async function pushNow() {
                var c = conn();
                if (!c || !c.auth.currentUser) return;
                var ref = firestoreMod.doc(c.db, 'tilo_sync_users', c.auth.currentUser.uid);
                var parts = Array.isArray(state.parts) ? state.parts : JSON.parse(localStorage.getItem('sp_pro_parts') || '[]');
                var settings = state.settings || JSON.parse(localStorage.getItem('sp_pro_settings') || '{}');
                var weekly = JSON.parse(localStorage.getItem('tilo_weekly_parts') || '{}');
                await firestoreMod.setDoc(ref, {
                    parts: JSON.parse(JSON.stringify(parts)),
                    settings: JSON.parse(JSON.stringify(settings)),
                    weeklyParts: weekly,
                    deletedIds: (window.TiloPlus.deletedIds || []).slice(-300),
                    updatedAt: Date.now()
                }, { merge: true });
            }
            function schedulePush() {
                clearTimeout(window.TiloPlus.syncTimeout);
                window.TiloPlus.syncTimeout = setTimeout(function () { pushNow().catch(function () {}); }, 800);
            }
            function applyCloud(data) {
                if (!data) return;
                window.TiloPlus.isSyncingFromCloud = true;
                try {
                    if (Array.isArray(data.deletedIds)) {
                        window.TiloPlus.deletedIds = Array.from(new Set([].concat(window.TiloPlus.deletedIds || [], data.deletedIds)));
                        origSetItem('tilo_deleted_ids', JSON.stringify(window.TiloPlus.deletedIds));
                    }
                    var local = Array.isArray(state.parts) ? state.parts : JSON.parse(localStorage.getItem('sp_pro_parts') || '[]');
                    state.parts = mergeParts(local, data.parts || []);
                    origSetItem('sp_pro_parts', JSON.stringify(state.parts));
                    if (data.settings) {
                        state.settings = Object.assign({}, state.settings, data.settings, { onboarded: true });
                        origSetItem('sp_pro_settings', JSON.stringify(state.settings));
                    }
                    if (data.weeklyParts) {
                        origSetItem('tilo_weekly_parts', JSON.stringify(data.weeklyParts));
                        if (typeof window.TiloPlus.renderWeeklyCalendar === 'function') window.TiloPlus.renderWeeklyCalendar();
                    }
                } finally {
                    window.TiloPlus.isSyncingFromCloud = false;
                }
            }
            async function pullListen(user) {
                var c = conn();
                if (!c || !user) return;
                var ref = firestoreMod.doc(c.db, 'tilo_sync_users', user.uid);
                try {
                    var snap = await firestoreMod.getDoc(ref);
                    if (snap.exists()) applyCloud(snap.data());
                    else await pushNow();
                } catch (_) {}
                if (window.TiloPlus.unsubscribeSnapshot) window.TiloPlus.unsubscribeSnapshot();
                window.TiloPlus.unsubscribeSnapshot = firestoreMod.onSnapshot(ref, function (s) {
                    if (s.exists()) applyCloud(s.data());
                });
            }
            if (typeof state.deletePart === 'function') {
                var orig = state.deletePart;
                state.deletePart = function (id) {
                    if (window.TiloPlus.deletedIds.indexOf(id) === -1) {
                        window.TiloPlus.deletedIds.push(id);
                        origSetItem('tilo_deleted_ids', JSON.stringify(window.TiloPlus.deletedIds));
                    }
                    orig(id);
                    schedulePush();
                };
            }
            window.TiloPlus.forceSyncNow = async function () {
                var c = conn();
                if (!c || !c.auth.currentUser) return;
                await pullListen(c.auth.currentUser);
                await pushNow();
            };
            var t = setInterval(function () {
                var c = conn();
                if (c && c.auth) {
                    clearInterval(t);
                    authMod.onAuthStateChanged(c.auth, function (u) {
                        if (u) { state.currentUser = u; pullListen(u); }
                    });
                }
            }, 700);
        } catch (e) {
            console.warn('Tilo cloud optional:', e);
        }
    }

    function setupHeader(state) {
        var headerEl = document.querySelector('main header');
        if (!headerEl || document.getElementById('tilo-hamburger-trigger')) return;
        var rightGroup = headerEl.firstElementChild;
        var hamBtn = document.createElement('button');
        hamBtn.id = 'tilo-hamburger-trigger';
        hamBtn.className = 'tilo-hamburger-btn shrink-0';
        hamBtn.type = 'button';
        hamBtn.innerHTML = '<i class="fas fa-bars"></i>';
        if (rightGroup) rightGroup.insertBefore(hamBtn, rightGroup.firstChild);
        var leftGroup = headerEl.lastElementChild;
        if (leftGroup && !document.getElementById('tilo-theme-toggle-btn')) {
            var themeBtn = document.createElement('button');
            themeBtn.id = 'tilo-theme-toggle-btn';
            themeBtn.type = 'button';
            themeBtn.className = 'tilo-theme-switch-btn';
            themeBtn.addEventListener('click', function () {
                applyTheme(window.TiloPro.theme === 'day' ? 'night' : 'day');
            });
            leftGroup.insertBefore(themeBtn, leftGroup.firstChild);
            applyTheme(window.TiloPro.theme);
        }
        var backdrop = document.createElement('div');
        backdrop.className = 'tilo-drawer-backdrop';
        var drawer = document.createElement('aside');
        drawer.className = 'tilo-drawer-panel text-right';
        drawer.innerHTML = '<div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-700"><div><h3 class="font-black text-sm" id="tilo-drawer-username">tilo</h3><p class="text-[10px] text-slate-400" id="tilo-drawer-sync-label">آفلاین</p></div><button type="button" id="tilo-drawer-close" class="w-8 h-8 rounded-lg bg-slate-800 text-slate-300"><i class="fas fa-times"></i></button></div><div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 mb-3 space-y-1.5 text-xs"><div class="flex justify-between"><span class="text-slate-400">مطالعه امروز</span><strong id="tilo-drawer-study-time">۰</strong></div><div class="flex justify-between"><span class="text-slate-400">غیردرسی</span><strong id="tilo-drawer-nonstudy-time">۰</strong></div><div class="flex justify-between"><span class="text-slate-400">صف پارت</span><strong id="tilo-drawer-pending-badge">0</strong></div></div><button type="button" id="tilo-drawer-force-sync" class="btn-calm w-full mb-3 text-xs py-2.5 bg-slate-800 border border-slate-700">همگام‌سازی ابری (اختیاری)</button><div class="space-y-1 flex-1" id="tilo-drawer-navs"></div>';
        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);
        var tabs = [['dashboard','داشبورد'],['parts','پارت‌ها'],['timer','تایمر'],['calendar','برنامه هفتگی'],['archive','آرشیو'],['calculator','درصدگیر'],['settings','تنظیمات']];
        var navs = drawer.querySelector('#tilo-drawer-navs');
        tabs.forEach(function (pair) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'w-full text-right p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800 mb-1';
            b.textContent = pair[1];
            b.addEventListener('click', function () { state.currentTab = pair[0]; close(); });
            navs.appendChild(b);
        });
        function open() { update(); backdrop.classList.add('open'); drawer.classList.add('open'); }
        function close() { backdrop.classList.remove('open'); drawer.classList.remove('open'); }
        function update() {
            var name = (state.settings && state.settings.userName) || 'کاربر';
            var u = document.getElementById('tilo-drawer-username');
            if (u) u.textContent = name;
            var st = document.getElementById('tilo-drawer-study-time');
            var ns = document.getElementById('tilo-drawer-nonstudy-time');
            var bd = document.getElementById('tilo-drawer-pending-badge');
            var fmt = state.formatMinutes || function (m) { return (m || 0) + ' دقیقه'; };
            if (st && state.todayStats) st.textContent = fmt(state.todayStats.totalTime || 0);
            if (ns && state.todayStats) ns.textContent = fmt(state.todayStats.lifeTime || state.todayStats.nonStudyTime || 0);
            if (bd && state.pendingParts) bd.textContent = state.pendingParts.length || 0;
        }
        hamBtn.addEventListener('click', open);
        backdrop.addEventListener('click', close);
        document.getElementById('tilo-drawer-close').addEventListener('click', close);
        document.getElementById('tilo-drawer-force-sync').addEventListener('click', async function () {
            if (window.TiloPlus.forceSyncNow) await window.TiloPlus.forceSyncNow();
            update();
        });
    }

    function setupTimerExtras(state) {
        var mainEl = document.querySelector('main');
        if (!mainEl) return;
        function tryBuild() {
            var divs = Array.from(mainEl.children).filter(function (el) { return el.tagName === 'DIV' && !el.classList.contains('fixed'); });
            var timerTab = divs.filter(function (d) { return d.innerHTML.indexOf('تایمر') !== -1; })[0] || divs[2];
            if (!timerTab || document.getElementById('tilo-timer-pro-extension')) return;
            var card = timerTab.querySelector('.soft-card');
            if (card) card.classList.add('tilo-timer-pro-card');
            var wrap = document.createElement('div');
            wrap.id = 'tilo-timer-pro-extension';
            wrap.className = 'space-y-4 mt-4';
            wrap.innerHTML = '<div class="soft-card p-4 rounded-2xl space-y-2"><div class="flex justify-between items-center"><span class="text-xs font-bold">صف پارت‌های آماده</span><span id="tilo-timer-queue-count" class="text-[10px] text-slate-400">0</span></div><div id="tilo-timer-quick-queue" class="tilo-part-pick-list space-y-1"></div></div><div class="tilo-timer-spacer"></div>';
            timerTab.appendChild(wrap);
            setInterval(function () {
                var box = document.getElementById('tilo-timer-quick-queue');
                var cnt = document.getElementById('tilo-timer-queue-count');
                if (!box || !Array.isArray(state.pendingParts)) return;
                if (cnt) cnt.textContent = state.pendingParts.length + ' پارت';
                var sig = state.pendingParts.map(function (p) { return p.id; }).join(',');
                if (box.getAttribute('data-sig') === sig) return;
                box.setAttribute('data-sig', sig);
                if (!state.pendingParts.length) {
                    box.innerHTML = '<p class="text-[11px] text-slate-500 text-center py-3">صف خالی است</p>';
                    return;
                }
                box.innerHTML = state.pendingParts.map(function (p) {
                    var sub = (p.subjects && p.subjects[0]) || (p.isLife || p.isNonStudy ? 'غیردرسی' : 'پارت');
                    return '<button type="button" data-pid="' + p.id + '" class="tilo-part-option tilo-break text-xs w-full"><span class="font-bold block">' + sub + '</span><span class="text-slate-400 block">' + (p.topic || '') + ' · ' + (p.plannedTime || 60) + ' دقیقه</span></button>';
                }).join('');
                box.querySelectorAll('[data-pid]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        var id = Number(b.getAttribute('data-pid'));
                        var found = state.pendingParts.filter(function (x) { return x.id === id; })[0];
                        if (found && state.selectPartAndGoToTimer) state.selectPartAndGoToTimer(found);
                    });
                });
            }, 800);
        }
        setTimeout(tryBuild, 400);
        setTimeout(tryBuild, 1200);
    }

    function setupWeekly(state) {
        var days = [
            { id: 'sat', name: 'شنبه' }, { id: 'sun', name: 'یکشنبه' }, { id: 'mon', name: 'دوشنبه' },
            { id: 'tue', name: 'سه‌شنبه' }, { id: 'wed', name: 'چهارشنبه' }, { id: 'thu', name: 'پنج‌شنبه' },
            { id: 'fri', name: 'جمعه' }
        ];
        var activeDay = 'sat';
        var isNonStudy = false;
        var subjects = [];
        function storage() {
            try { return JSON.parse(localStorage.getItem('tilo_weekly_parts') || '{}'); } catch (_) { return {}; }
        }
        function save(obj) { localStorage.setItem('tilo_weekly_parts', JSON.stringify(obj)); }
        function subjectGroups() {
            return state.subjectGroups || [{ category: 'عمومی', items: ['فارسی', 'عربی', 'دین و زندگی', 'زبان انگلیسی'] }];
        }
        function pushToToday(item, goTimer) {
            if (!Array.isArray(state.parts)) return;
            var part = {
                id: Date.now(), dateISO: todayISO(), dateStr: todayFa(),
                isLife: !!item.isNonStudy, isNonStudy: !!item.isNonStudy,
                subjects: item.isNonStudy ? [] : (item.subjects || (item.subject ? [item.subject] : [])),
                topic: item.topic, description: item.description || '',
                type: item.type || (item.isNonStudy ? 'غیردرسی' : 'آموزشی / مطالعاتی'),
                plannedTime: item.plannedTime || 60, realTime: 0, status: 'pending',
                tests: { correct: 0, wrong: 0, unanswered: 0, total: 0 }, updatedAt: Date.now()
            };
            state.parts.unshift(part);
            localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
            if (goTimer && state.selectPartAndGoToTimer) state.selectPartAndGoToTimer(part);
            else state.currentTab = 'parts';
        }
        function tryBuild() {
            var mainEl = document.querySelector('main');
            if (!mainEl) return;
            var divs = Array.from(mainEl.children).filter(function (el) { return el.tagName === 'DIV' && !el.classList.contains('fixed'); });
            var calTab = divs.filter(function (d) { return d.innerHTML.indexOf('برنامه هفتگی') !== -1 || d.innerHTML.indexOf('تقویم') !== -1; })[0] || divs[3];
            if (!calTab || document.getElementById('tilo-calendar-pro-extension')) return;
            var box = document.createElement('div');
            box.id = 'tilo-calendar-pro-extension';
            box.className = 'space-y-4 mt-3';
            calTab.innerHTML = '';
            calTab.appendChild(box);
            function render() {
                var data = storage();
                var dayObj = days.filter(function (d) { return d.id === activeDay; })[0] || days[0];
                var groups = subjectGroups();
                var daysHtml = days.map(function (d) {
                    var n = (data[d.id] || []).length;
                    var on = d.id === activeDay;
                    return '<button type="button" data-d="' + d.id + '" class="p-2 rounded-xl text-[11px] border ' + (on ? 'bg-primary text-white border-primary' : 'bg-slate-900/60 border-slate-800') + '">' + d.name + '<br><span class="text-[10px] opacity-80">' + n + '</span></button>';
                }).join('');
                var subsHtml = '';
                if (!isNonStudy) {
                    subsHtml = groups.map(function (g) {
                        return '<div><div class="text-[10px] font-bold text-slate-400 mb-1">' + g.category + '</div><div class="flex flex-wrap gap-1">' +
                            (g.items || []).map(function (it) {
                                var on = subjects.indexOf(it) !== -1;
                                return '<label class="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] cursor-pointer ' + (on ? 'border-indigo-400 bg-indigo-500/15' : 'border-slate-700') + '"><input type="checkbox" value="' + it.replace(/"/g, '') + '" ' + (on ? 'checked' : '') + ' class="tilo-w-cb"> ' + it + '</label>';
                            }).join('') + '</div></div>';
                    }).join('');
                }
                var dayParts = data[activeDay] || [];
                var listHtml = !dayParts.length
                    ? '<p class="text-[11px] text-slate-500 text-center py-4">خالی است</p>'
                    : dayParts.map(function (p, idx) {
                        return '<div class="p-3 rounded-xl border border-slate-800 bg-slate-900/50 tilo-break text-xs space-y-1"><div class="font-bold">' + (p.topic || '') + '</div><div class="text-slate-400">' + (p.isNonStudy ? 'غیردرسی' : (p.subjects || []).join('، ')) + ' · ' + (p.plannedTime || 60) + ' دقیقه</div><div class="flex flex-wrap gap-1.5 pt-1"><button type="button" data-q="' + idx + '" class="btn-calm bg-teal-700/30 text-teal-200 text-[11px] py-1 px-2">ارسال به امروز</button><button type="button" data-t="' + idx + '" class="btn-calm bg-primary text-white text-[11px] py-1 px-2">تایمر</button><button type="button" data-x="' + idx + '" class="text-rose-400 text-[11px] px-2">حذف</button></div></div>';
                    }).join('');
                box.innerHTML = '<div class="soft-card p-4 rounded-2xl space-y-3"><h3 class="text-sm font-extrabold">برنامه هفتگی</h3><p class="text-[11px] text-slate-400">روز را انتخاب کن. «ارسال به امروز» بدون پیام، مستقیم به پارت‌ها می‌رود و عدد صف پایین به‌روز می‌شود.</p><div class="grid grid-cols-3 sm:grid-cols-7 gap-1.5" id="tilo-week-days">' + daysHtml + '</div></div><div class="soft-card p-4 rounded-2xl space-y-3"><div class="text-xs font-bold">افزودن برای «' + dayObj.name + '»</div><div class="flex gap-2"><button type="button" id="tilo-w-study" class="btn-calm text-xs py-1.5 px-3 ' + (!isNonStudy ? 'bg-primary text-white' : 'bg-slate-800') + '">درسی</button><button type="button" id="tilo-w-life" class="btn-calm text-xs py-1.5 px-3 ' + (isNonStudy ? 'bg-amber-500/80 text-slate-900' : 'bg-slate-800') + '">غیردرسی</button></div><div id="tilo-w-subs" class="' + (isNonStudy ? 'hidden' : '') + ' max-h-40 overflow-y-auto text-xs space-y-2">' + subsHtml + '</div><input id="tilo-w-topic" class="input-calm text-xs" placeholder="عنوان مبحث / فعالیت"><input id="tilo-w-desc" class="input-calm text-xs" placeholder="توضیح اختیاری"><input id="tilo-w-time" type="number" value="60" min="5" class="input-calm text-xs text-center font-bold"><div class="flex flex-wrap gap-2"><button type="button" id="tilo-w-save" class="btn-calm bg-primary text-white text-xs py-2 px-3 flex-1">ذخیره در ' + dayObj.name + '</button><button type="button" id="tilo-w-today" class="btn-calm bg-slate-800 text-xs py-2 px-3">+ صف امروز</button></div></div><div class="soft-card p-4 rounded-2xl space-y-2"><div class="text-xs font-bold">پارت‌های ' + dayObj.name + '</div><div id="tilo-w-list" class="space-y-2">' + listHtml + '</div></div>';
                box.querySelector('#tilo-week-days').querySelectorAll('[data-d]').forEach(function (b) {
                    b.addEventListener('click', function () { activeDay = b.getAttribute('data-d'); render(); });
                });
                box.querySelector('#tilo-w-study').onclick = function () { isNonStudy = false; render(); };
                box.querySelector('#tilo-w-life').onclick = function () { isNonStudy = true; subjects = []; render(); };
                box.querySelectorAll('.tilo-w-cb').forEach(function (cb) {
                    cb.addEventListener('change', function () {
                        var v = cb.value;
                        if (cb.checked) { if (subjects.indexOf(v) === -1) subjects.push(v); }
                        else subjects = subjects.filter(function (x) { return x !== v; });
                    });
                });
                function collectItem() {
                    var topic = (box.querySelector('#tilo-w-topic').value || '').trim();
                    var description = (box.querySelector('#tilo-w-desc').value || '').trim();
                    var plannedTime = parseInt(box.querySelector('#tilo-w-time').value, 10) || 60;
                    if (!isNonStudy && !subjects.length) { window.alert('حداقل یک درس انتخاب کن.'); return null; }
                    if (!topic) { window.alert('عنوان را بنویس.'); return null; }
                    return { id: Date.now(), isNonStudy: isNonStudy, subjects: isNonStudy ? [] : subjects.slice(), subject: subjects.join('، '), topic: topic, description: description, plannedTime: plannedTime, type: isNonStudy ? 'غیردرسی' : 'آموزشی / مطالعاتی' };
                }
                box.querySelector('#tilo-w-save').onclick = function () {
                    var item = collectItem();
                    if (!item) return;
                    var data2 = storage();
                    if (!data2[activeDay]) data2[activeDay] = [];
                    data2[activeDay].unshift(item);
                    save(data2);
                    subjects = [];
                    render();
                };
                box.querySelector('#tilo-w-today').onclick = function () {
                    var item = collectItem();
                    if (!item) return;
                    var data2 = storage();
                    if (!data2[activeDay]) data2[activeDay] = [];
                    data2[activeDay].unshift(item);
                    save(data2);
                    pushToToday(item, false);
                    subjects = [];
                    render();
                };
                var list = box.querySelector('#tilo-w-list');
                list.querySelectorAll('[data-q]').forEach(function (b) {
                    b.addEventListener('click', function () { pushToToday(dayParts[Number(b.getAttribute('data-q'))], false); });
                });
                list.querySelectorAll('[data-t]').forEach(function (b) {
                    b.addEventListener('click', function () { pushToToday(dayParts[Number(b.getAttribute('data-t'))], true); });
                });
                list.querySelectorAll('[data-x]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        dayParts.splice(Number(b.getAttribute('data-x')), 1);
                        save(data);
                        render();
                    });
                });
            }
            window.TiloPlus.renderWeeklyCalendar = render;
            render();
        }
        setTimeout(tryBuild, 500);
        setTimeout(tryBuild, 1500);
    }

    function setupPdf(state) {
        window.TiloPro.openPdfExportModal = function () {
            var name = (state.settings && state.settings.userName) || 'دانش‌آموز';
            var completed = (state.parts || []).filter(function (p) { return p.status === 'completed'; });
            var study = 0;
            completed.forEach(function (p) { if (!p.isLife && !p.isNonStudy) study += Number(p.realTime || 0); });
            var rows = completed.slice(0, 100).map(function (p) {
                return '<tr><td>' + ((p.subjects || []).join('، ') || (p.isLife ? 'غیردرسی' : '')) + '</td><td>' + (p.topic || '') + '</td><td>' + (p.realTime || 0) + ' دقیقه</td><td>' + (p.dateStr || '') + '</td></tr>';
            }).join('');
            var html = '<div dir="rtl" style="font-family:Tahoma,sans-serif;padding:24px;color:#111"><h2>گزارش مطالعه — ' + name + '</h2><p>تاریخ: ' + todayFa() + ' · مجموع مطالعه: ' + study + ' دقیقه · تعداد: ' + completed.length + '</p><table border="1" cellpadding="6" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:12px"><thead><tr><th>درس</th><th>مبحث</th><th>زمان</th><th>تاریخ</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4">داده‌ای نیست</td></tr>') + '</tbody></table></div>';
            var w = window.open('', '_blank', 'width=800,height=900');
            if (!w) return;
            w.document.write('<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>گزارش ' + name + '</title></head><body>' + html + '<script>setTimeout(function(){window.print()},400)<\\/script></body></html>');
            w.document.close();
        };
    }
})();
