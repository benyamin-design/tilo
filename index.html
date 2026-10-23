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
        body.tilo-theme-day .fixed.inset-0,
        body.tilo-theme-day .bg-slate-950,
        body.tilo-theme-day .bg-slate-950\/80,
        body.tilo-theme-day .bg-slate-950\/85,
        body.tilo-theme-day [class*="bg-[#162032]"],
        body.tilo-theme-day .bg-\[\#162032\] {
            background-color: rgba(243, 240, 232, 0.92) !important;
        }
        body.tilo-theme-day .fixed.inset-0 .soft-card {
            background: #ffffff !important;
            color: #111827 !important;
            border-color: #e5e0d8 !important;
        }
        body.tilo-theme-day .tilo-drawer-panel button,
        body.tilo-theme-day .tilo-drawer-panel .text-slate-300 {
            color: #374151 !important;
        }
        main { padding-bottom: 9rem !important; }
        .tilo-timer-spacer { height: 120px !important; }
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
        if (leftGroup && !document.getElementById('tilo-theme-toggle-btn') && !leftGroup.querySelector('.tilo-theme-switch-btn')) {
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
        var tabs = [['dashboard','داشبورد'],['parts','پارت‌ها'],['timer','تایمر'],['calendar','برنامه هفتگی'],['problems','دفترچه مشکلات'],['calculator','درصدگیر'],['settings','تنظیمات']];
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
            var timerTab = divs[2];
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
        var dropOpen = false;
        var formType = 'آموزشی / مطالعاتی';
        var formCategory = 'کنکوری';
        var formTime = 60;
        var subParts = [{ title: 'بخش اول', timeRange: '', duration: 60 }];

        function storage() {
            try { return JSON.parse(localStorage.getItem('tilo_weekly_parts') || '{}'); } catch (_) { return {}; }
        }
        function save(obj) { localStorage.setItem('tilo_weekly_parts', JSON.stringify(obj)); }
        function subjectGroups() {
            return state.subjectGroups || [{ category: 'عمومی', items: ['فارسی', 'عربی', 'دین و زندگی', 'زبان انگلیسی'] }];
        }
        function categories() {
            return state.partCategories || ['کنکوری', 'امتحان نهایی', 'مرور و جمع‌بندی', 'آزمون آزمایشی', 'جبرانی', 'غیردرسی / بازیابی'];
        }
        function escapeHtml(s) {
            return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function pushToToday(item, goTimer) {
            if (!Array.isArray(state.parts)) return;
            var part = {
                id: Date.now(),
                dateISO: todayISO(),
                dateStr: todayFa(),
                isLife: !!item.isNonStudy,
                isNonStudy: !!item.isNonStudy,
                subjects: item.isNonStudy ? [] : (item.subjects || []),
                topic: item.topic,
                description: item.description || '',
                type: item.type || (item.isNonStudy ? 'غیردرسی' : 'آموزشی / مطالعاتی'),
                category: item.category || 'کنکوری',
                plannedTime: item.plannedTime || 60,
                subParts: item.subParts ? JSON.parse(JSON.stringify(item.subParts)) : [],
                realTime: 0,
                status: 'pending',
                tests: { correct: 0, wrong: 0, unanswered: 0, total: 0 },
                updatedAt: Date.now()
            };
            state.parts.unshift(part);
            localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
            if (goTimer && state.selectPartAndGoToTimer) state.selectPartAndGoToTimer(part);
            else state.currentTab = 'parts';
        }

        function tryBuild() {
            var mainEl = document.querySelector('main');
            if (!mainEl) return;
            var divs = Array.from(mainEl.children).filter(function (el) {
                return el.tagName === 'DIV' && !el.classList.contains('fixed');
            });
            var calTab = divs[3];
            if (!calTab || document.getElementById('tilo-calendar-pro-extension')) return;

            var box = document.createElement('div');
            box.id = 'tilo-calendar-pro-extension';
            box.className = 'space-y-4 mt-2';
            Array.from(calTab.children).forEach(function (c) { c.style.display = 'none'; });
            calTab.appendChild(box);

            function render() {
                var data = storage();
                var dayObj = days.filter(function (d) { return d.id === activeDay; })[0] || days[0];
                var groups = subjectGroups();
                var cats = categories();

                var daysHtml = days.map(function (d) {
                    var n = (data[d.id] || []).length;
                    var on = d.id === activeDay;
                    return '<button type="button" data-d="' + d.id + '" class="p-2.5 rounded-2xl text-[11px] border transition ' +
                        (on ? 'bg-primary text-white border-primary font-black shadow-md' : 'bg-slate-900/70 border-slate-800 text-slate-300') +
                        '"><span class="font-bold block">' + d.name + '</span><span class="text-[10px] opacity-80">' + n + ' پارت</span></button>';
                }).join('');

                var subChecks = groups.map(function (g) {
                    return '<div class="mb-2"><div class="text-[10px] font-bold text-tealSoft bg-slate-900/90 px-2 py-1 rounded-lg mb-1">' +
                        escapeHtml(g.category) + '</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-1">' +
                        (g.items || []).map(function (it) {
                            var on = subjects.indexOf(it) !== -1;
                            return '<label class="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/70 cursor-pointer text-xs">' +
                                '<input type="checkbox" value="' + escapeHtml(it) + '" class="tilo-w-cb w-4 h-4 accent-indigo-500 rounded" ' + (on ? 'checked' : '') + '>' +
                                '<span class="text-slate-200">' + escapeHtml(it) + '</span></label>';
                        }).join('') + '</div></div>';
                }).join('');

                var selectedLabel = subjects.length ? subjects.join(' ، ') : 'روی فلش بزنید و درس‌ها را انتخاب کنید...';
                var presets = [60, 75, 90];
                var presetBtns = presets.map(function (p) {
                    return '<button type="button" data-preset="' + p + '" class="px-3 py-1.5 rounded-xl text-xs ' +
                        (formTime === p ? 'bg-primary text-white font-bold' : 'bg-slate-800 text-slate-300') + '">' + p + ' دقیقه</button>';
                }).join('');

                var subPartsHtml = subParts.map(function (sp, idx) {
                    return '<div class="flex flex-wrap sm:flex-nowrap items-center gap-1.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800" data-sp="' + idx + '">' +
                        '<span class="text-[11px] font-bold text-primarySoft shrink-0">بخش ' + (idx + 1) + ':</span>' +
                        '<input type="text" data-f="title" value="' + escapeHtml(sp.title) + '" placeholder="کار (مثلاً: درس‌نامه)" class="input-calm text-xs py-1.5 px-2 flex-1 min-w-[90px]">' +
                        '<input type="text" data-f="timeRange" value="' + escapeHtml(sp.timeRange) + '" placeholder="بازه (مثلاً 16 تا 17)" class="input-calm text-xs py-1.5 px-2 w-28 text-center">' +
                        '<input type="number" data-f="duration" value="' + (sp.duration || 60) + '" min="5" class="input-calm text-xs py-1.5 px-1.5 w-14 text-center font-bold text-tealSoft">' +
                        '<span class="text-[10px] text-slate-500">دقیقه</span>' +
                        (subParts.length > 1 ? '<button type="button" data-rm-sp="' + idx + '" class="text-roseSoft p-1"><i class="fas fa-times"></i></button>' : '') +
                        '</div>';
                }).join('');

                var typeOpts = ['آموزشی / مطالعاتی', 'تست و تمرین', 'مرور و جمع‌بندی', 'غیردرسی'].map(function (t) {
                    return '<option value="' + t + '"' + (formType === t ? ' selected' : '') + '>' + t + '</option>';
                }).join('');
                var catOpts = cats.map(function (c) {
                    return '<option value="' + escapeHtml(c) + '"' + (formCategory === c ? ' selected' : '') + '>' + escapeHtml(c) + '</option>';
                }).join('');

                var dayParts = data[activeDay] || [];
                var listHtml = !dayParts.length
                    ? '<p class="text-[11px] text-slate-500 text-center py-6">هنوز پارتی برای «' + dayObj.name + '» تعریف نشده. از فرم بالا اضافه کن.</p>'
                    : dayParts.map(function (p, idx) {
                        var subs = (p.subjects || []).join('، ') || (p.isNonStudy ? 'غیردرسی' : '');
                        return '<div class="bg-slate-900/75 p-4 rounded-2xl border border-slate-800 space-y-2 tilo-break text-xs">' +
                            '<div class="flex flex-wrap gap-1.5 items-center">' +
                            '<span class="' + (p.isNonStudy ? 'bg-amberSoft/20 text-amberSoft' : 'bg-primary/20 text-indigo-300') + ' px-2.5 py-0.5 rounded-md font-bold text-[11px]">' + escapeHtml(subs) + '</span>' +
                            '<span class="text-slate-400">• ' + escapeHtml(p.type || '') + '</span>' +
                            '<span class="text-tealSoft font-bold">• ' + (p.plannedTime || 60) + ' دقیقه</span></div>' +
                            '<h5 class="font-bold text-white text-sm">' + escapeHtml(p.topic) + '</h5>' +
                            (p.description ? '<p class="text-slate-300 bg-slate-950/50 p-2 rounded-xl border border-slate-800/80">' + escapeHtml(p.description) + '</p>' : '') +
                            '<div class="flex flex-wrap gap-1.5 pt-1">' +
                            '<button type="button" data-q="' + idx + '" class="btn-calm bg-tealSoft/15 text-tealSoft border border-tealSoft/30 text-[11px] py-1.5 px-2.5"><i class="fas fa-plus"></i> ارسال به صف امروز</button>' +
                            '<button type="button" data-t="' + idx + '" class="btn-calm bg-primary text-white text-[11px] py-1.5 px-2.5"><i class="fas fa-stopwatch"></i> تایمر</button>' +
                            '<button type="button" data-x="' + idx + '" class="text-roseSoft p-1.5"><i class="fas fa-trash"></i></button></div></div>';
                    }).join('');

                box.innerHTML =
                    '<div class="soft-card p-4 rounded-3xl space-y-3 border border-indigo-500/20">' +
                    '<h3 class="text-sm font-extrabold flex items-center gap-2"><i class="fas fa-calendar-week text-sage"></i> برنامه هفتگی</h3>' +
                    '<p class="text-[11px] text-slate-400">روز را انتخاب کن؛ فرم افزودن دقیقاً مثل «تعریف پارت مطالعه» است.</p>' +
                    '<div class="grid grid-cols-3 sm:grid-cols-7 gap-1.5">' + daysHtml + '</div></div>' +

                    '<div class="soft-card p-5 rounded-3xl space-y-4 border border-primary/20">' +
                    '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">' +
                    '<h4 class="text-sm font-extrabold text-white flex items-center gap-2"><i class="fas fa-plus-circle text-primarySoft"></i> تعریف پارت مطالعه برای <span class="text-tealSoft">' + dayObj.name + '</span></h4></div>' +

                    '<div class="flex gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 w-fit">' +
                    '<button type="button" id="tilo-w-study" class="px-4 py-1.5 rounded-lg text-xs ' + (!isNonStudy ? 'bg-primary text-white font-bold' : 'text-slate-400') + '"><i class="fas fa-book"></i> پارت درسی</button>' +
                    '<button type="button" id="tilo-w-life" class="px-4 py-1.5 rounded-lg text-xs ' + (isNonStudy ? 'bg-amberSoft text-slate-900 font-bold' : 'text-slate-400') + '"><i class="fas fa-coffee"></i> غیردرسی</button></div>' +

                    '<div class="relative ' + (isNonStudy ? 'hidden' : '') + '" id="tilo-w-sub-wrap">' +
                    '<label class="block text-xs text-slate-400 mb-1.5">انتخاب درس یا فعالیت *</label>' +
                    '<button type="button" id="tilo-w-drop-btn" class="input-calm flex justify-between items-center text-right text-xs w-full">' +
                    '<span id="tilo-w-sel-label" class="truncate ' + (subjects.length ? 'text-white font-bold' : 'text-slate-400') + '">' + escapeHtml(selectedLabel) + '</span>' +
                    '<i class="fas fa-chevron-down text-slate-400"></i></button>' +
                    '<div id="tilo-w-drop" class="' + (dropOpen ? '' : 'hidden') + ' absolute z-50 left-0 right-0 mt-2 soft-card bg-[#162032] rounded-2xl p-3 max-h-72 overflow-y-auto border border-slate-700 shadow-2xl">' +
                    '<div class="flex justify-between items-center pb-2 mb-2 border-b border-slate-700">' +
                    '<span class="text-xs text-slate-400">' + subjects.length + ' درس</span>' +
                    '<button type="button" id="tilo-w-drop-close" class="text-xs bg-primary text-white px-3 py-1 rounded-lg">تأیید و بستن</button></div>' +
                    subChecks + '</div></div>' +

                    '<div><label class="block text-xs text-slate-400 mb-1.5">مبحث دقیق *</label>' +
                    '<input type="text" id="tilo-w-topic" class="input-calm text-xs md:text-sm" placeholder="مثلاً: حرکت بر خط راست / مشتق" value=""></div>' +

                    '<div><label class="block text-xs text-slate-400 mb-1.5">توضیحات پارت (زیرمبحث، صفحات کتاب یا منبع تست)</label>' +
                    '<input type="text" id="tilo-w-desc" class="input-calm text-xs md:text-sm" placeholder="مثلاً: مطالعه درس‌نامه از صفحه ۴۰ تا ۵۲ + حل تست..."></div>' +

                    '<div class="grid grid-cols-2 gap-2.5">' +
                    '<div><label class="block text-xs text-slate-400 mb-1.5">نوع فعالیت</label>' +
                    '<select id="tilo-w-type" class="input-calm text-xs">' + typeOpts + '</select></div>' +
                    '<div><label class="block text-xs text-slate-400 mb-1.5">دسته‌بندی</label>' +
                    '<select id="tilo-w-cat" class="input-calm text-xs">' + catOpts + '</select></div></div>' +

                    '<div><label class="block text-xs text-slate-400 mb-1.5">مدت زمان پارت (دقیقه)</label>' +
                    '<div class="flex flex-wrap gap-2 items-center">' +
                    '<input type="number" id="tilo-w-time" value="' + formTime + '" min="5" max="400" class="input-calm text-xs font-bold text-center w-20">' +
                    presetBtns + '</div></div>' +

                    '<div class="bg-slate-900/50 border border-slate-800 rounded-2xl p-3 space-y-2">' +
                    '<div class="flex flex-wrap justify-between items-center gap-2">' +
                    '<span class="text-xs text-tealSoft font-bold"><i class="fas fa-sitemap"></i> تقسیم پارت به بخش‌های کوچک‌تر (' + subParts.length + ' از ۴ بخش)</span>' +
                    (subParts.length < 4 ? '<button type="button" id="tilo-w-add-sp" class="text-xs bg-primary/20 text-indigo-300 px-3 py-1 rounded-lg">+ افزودن بخش جدید</button>' : '') +
                    '</div>' + subPartsHtml + '</div>' +

                    '<div class="flex flex-wrap gap-2 pt-1">' +
                    '<button type="button" id="tilo-w-save" class="btn-calm bg-primary text-white text-xs flex-1 py-3"><i class="fas fa-plus"></i> افزودن به برنامه «' + dayObj.name + '»</button>' +
                    '<button type="button" id="tilo-w-both" class="btn-calm bg-slate-800 text-slate-200 text-xs border border-slate-700 py-3"><i class="fas fa-bolt text-tealSoft"></i> + صف امروز</button></div>' +
                    '</div>' +

                    '<div class="soft-card p-4 rounded-3xl space-y-3">' +
                    '<h4 class="font-bold text-sm text-white flex items-center gap-2"><i class="fas fa-list-ul text-amberSoft"></i> پارت‌های برنامه‌ریزی‌شده برای <span class="text-tealSoft">' + dayObj.name + '</span></h4>' +
                    '<div class="space-y-2">' + listHtml + '</div></div>';

                // events
                box.querySelectorAll('[data-d]').forEach(function (b) {
                    b.addEventListener('click', function () { activeDay = b.getAttribute('data-d'); dropOpen = false; render(); });
                });
                box.querySelector('#tilo-w-study').onclick = function () { isNonStudy = false; render(); };
                box.querySelector('#tilo-w-life').onclick = function () { isNonStudy = true; subjects = []; formType = 'غیردرسی'; formCategory = 'غیردرسی / بازیابی'; render(); };

                var dropBtn = box.querySelector('#tilo-w-drop-btn');
                var drop = box.querySelector('#tilo-w-drop');
                if (dropBtn && drop) {
                    dropBtn.onclick = function () { dropOpen = !dropOpen; drop.classList.toggle('hidden', !dropOpen); };
                    var closeBtn = box.querySelector('#tilo-w-drop-close');
                    if (closeBtn) closeBtn.onclick = function () { dropOpen = false; drop.classList.add('hidden'); };
                }
                box.querySelectorAll('.tilo-w-cb').forEach(function (cb) {
                    cb.addEventListener('change', function () {
                        var v = cb.value;
                        if (cb.checked) { if (subjects.indexOf(v) === -1) subjects.push(v); }
                        else subjects = subjects.filter(function (x) { return x !== v; });
                        var lbl = box.querySelector('#tilo-w-sel-label');
                        if (lbl) {
                            lbl.textContent = subjects.length ? subjects.join(' ، ') : 'روی فلش بزنید و درس‌ها را انتخاب کنید...';
                            lbl.className = 'truncate ' + (subjects.length ? 'text-white font-bold' : 'text-slate-400');
                        }
                    });
                });

                box.querySelectorAll('[data-preset]').forEach(function (b) {
                    b.onclick = function () {
                        formTime = Number(b.getAttribute('data-preset'));
                        var ti = box.querySelector('#tilo-w-time');
                        if (ti) ti.value = formTime;
                        if (subParts.length === 1) subParts[0].duration = formTime;
                        render();
                    };
                });
                var timeInp = box.querySelector('#tilo-w-time');
                if (timeInp) timeInp.addEventListener('change', function () { formTime = parseInt(timeInp.value, 10) || 60; });

                var typeSel = box.querySelector('#tilo-w-type');
                var catSel = box.querySelector('#tilo-w-cat');
                if (typeSel) typeSel.onchange = function () { formType = typeSel.value; };
                if (catSel) catSel.onchange = function () { formCategory = catSel.value; };

                box.querySelectorAll('[data-sp]').forEach(function (row) {
                    var idx = Number(row.getAttribute('data-sp'));
                    row.querySelectorAll('input').forEach(function (inp) {
                        inp.addEventListener('change', function () {
                            var f = inp.getAttribute('data-f');
                            if (f === 'duration') subParts[idx].duration = parseInt(inp.value, 10) || 60;
                            else subParts[idx][f] = inp.value;
                        });
                    });
                });
                box.querySelectorAll('[data-rm-sp]').forEach(function (b) {
                    b.onclick = function () {
                        var i = Number(b.getAttribute('data-rm-sp'));
                        if (subParts.length > 1) { subParts.splice(i, 1); render(); }
                    };
                });
                var addSp = box.querySelector('#tilo-w-add-sp');
                if (addSp) addSp.onclick = function () {
                    if (subParts.length < 4) {
                        subParts.push({ title: 'بخش ' + (subParts.length + 1), timeRange: '', duration: 30 });
                        render();
                    }
                };

                function collect() {
                    var topic = (box.querySelector('#tilo-w-topic').value || '').trim();
                    var description = (box.querySelector('#tilo-w-desc').value || '').trim();
                    formTime = parseInt((box.querySelector('#tilo-w-time') || {}).value, 10) || formTime;
                    formType = (box.querySelector('#tilo-w-type') || {}).value || formType;
                    formCategory = (box.querySelector('#tilo-w-cat') || {}).value || formCategory;
                    // sync subParts from inputs
                    box.querySelectorAll('[data-sp]').forEach(function (row) {
                        var idx = Number(row.getAttribute('data-sp'));
                        row.querySelectorAll('input').forEach(function (inp) {
                            var f = inp.getAttribute('data-f');
                            if (!subParts[idx]) return;
                            if (f === 'duration') subParts[idx].duration = parseInt(inp.value, 10) || 60;
                            else subParts[idx][f] = inp.value;
                        });
                    });
                    if (!isNonStudy && !subjects.length) {
                        window.alert('لطفاً حداقل یک درس را انتخاب کنید.');
                        dropOpen = true; render();
                        return null;
                    }
                    if (!topic) { window.alert('مبحث دقیق را بنویس.'); return null; }
                    return {
                        id: Date.now(),
                        isNonStudy: isNonStudy,
                        subjects: isNonStudy ? [] : subjects.slice(),
                        topic: topic,
                        description: description,
                        type: formType,
                        category: formCategory,
                        plannedTime: formTime,
                        subParts: JSON.parse(JSON.stringify(subParts))
                    };
                }

                function resetForm() {
                    subjects = [];
                    subParts = [{ title: 'بخش اول', timeRange: '', duration: formTime }];
                    dropOpen = false;
                }

                box.querySelector('#tilo-w-save').onclick = function () {
                    var item = collect();
                    if (!item) return;
                    var data2 = storage();
                    if (!data2[activeDay]) data2[activeDay] = [];
                    data2[activeDay].unshift(item);
                    save(data2);
                    resetForm();
                    render();
                };
                box.querySelector('#tilo-w-both').onclick = function () {
                    var item = collect();
                    if (!item) return;
                    var data2 = storage();
                    if (!data2[activeDay]) data2[activeDay] = [];
                    data2[activeDay].unshift(item);
                    save(data2);
                    pushToToday(item, false);
                    resetForm();
                    render();
                };

                box.querySelectorAll('[data-q]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        pushToToday(dayParts[Number(b.getAttribute('data-q'))], false);
                    });
                });
                box.querySelectorAll('[data-t]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        pushToToday(dayParts[Number(b.getAttribute('data-t'))], true);
                    });
                });
                box.querySelectorAll('[data-x]').forEach(function (b) {
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


    /* --- بازگردانی: پارت‌های انجام‌شده روزانه + PDF + تحلیل --- */
    (function restoreCompletedAndAi() {
        const wait = setInterval(() => {
            const state = window.TiloPlus && window.TiloPlus.vueState;
            const mainEl = document.querySelector('main');
            if (!state || !mainEl) return;
            clearInterval(wait);

            function dayMeta(dateISO, fallback) {
                try {
                    if (!dateISO) return { weekday: 'روز', full: fallback || '—' };
                    const [y, m, d] = dateISO.split('-').map(Number);
                    const dt = new Date(y, m - 1, d, 12);
                    const weekday = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long' }).format(dt);
                    const full = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(dt);
                    return { weekday, full };
                } catch (_) {
                    return { weekday: 'روز', full: fallback || dateISO };
                }
            }

            function ensureBox() {
                const divs = Array.from(mainEl.children).filter(el => el.tagName === 'DIV' && !el.classList.contains('fixed'));
                const partsTab = divs[1];
                if (!partsTab) return null;
                let box = document.getElementById('tilo-parts-completed-grouped');
                if (!box) {
                    box = document.createElement('div');
                    box.id = 'tilo-parts-completed-grouped';
                    box.className = 'space-y-4 mt-6';
                    partsTab.appendChild(box);
                }
                return box;
            }

            function renderGroups() {
                const box = ensureBox();
                if (!box || !Array.isArray(state.parts)) return;
                const sig = state.parts.map(p => p.id + ':' + p.status + ':' + (p.updatedAt || 0)).join('|') + JSON.stringify(window.TiloPro.collapsedDays || {});
                if (box.dataset.sig === sig) return;
                box.dataset.sig = sig;
                const completed = state.parts.filter(p => p.status === 'completed')
                    .sort((a, b) => (b.completedAt || b.id || 0) - (a.completedAt || a.id || 0));
                const map = new Map();
                completed.forEach(p => {
                    const k = p.dateISO || p.dateStr || 'x';
                    if (!map.has(k)) map.set(k, []);
                    map.get(k).push(p);
                });
                const keys = Array.from(map.keys()).sort((a, b) => String(b).localeCompare(String(a)));
                const name = (state.settings && state.settings.userName) || 'دانش‌آموز';
                let html = `<div class="soft-card p-4 rounded-2xl space-y-3 border border-slate-700">
                    <div class="flex flex-wrap justify-between gap-2 items-center">
                        <h3 class="text-sm font-extrabold">آرشیو روزانه پارت‌های انجام‌شده</h3>
                        <button type="button" id="tilo-pdf-btn" class="btn-calm bg-primary text-white text-[11px] py-1.5 px-3">PDF گزارش (${name})</button>
                    </div>`;
                if (!keys.length) {
                    html += `<p class="text-[11px] text-slate-500 text-center py-4">هنوز پارتی تکمیل نشده.</p></div>`;
                    box.innerHTML = html;
                    bindPdf();
                    return;
                }
                keys.forEach(k => {
                    const items = map.get(k);
                    const meta = dayMeta(items[0].dateISO, items[0].dateStr);
                    const mins = items.reduce((s, p) => s + Number(p.realTime || 0), 0);
                    const collapsed = !!(window.TiloPro.collapsedDays && window.TiloPro.collapsedDays[k]);
                    html += `<div class="rounded-xl border border-slate-800 overflow-hidden">
                        <button type="button" data-day="${k}" class="tilo-day-toggle w-full text-right p-3 flex justify-between items-center bg-slate-900/50 hover:bg-slate-800/60">
                            <span class="text-xs font-bold">${meta.weekday} · ${meta.full} · ${items.length} پارت · ${mins} دقیقه</span>
                            <span class="text-tealSoft">«</span>
                        </button>
                        <div class="tilo-day-body ${collapsed ? 'hidden' : ''} p-2 space-y-2">
                            ${items.map(p => `
                                <div class="p-2.5 rounded-lg border border-slate-800 text-xs tilo-break">
                                    <div class="font-bold">${p.topic || 'بدون عنوان'}</div>
                                    <div class="text-slate-400">${(p.subjects || []).join('، ') || (p.isLife ? 'غیردرسی' : '')} · ${p.realTime || 0} دقیقه</div>
                                    ${p.notes || p.description ? `<div class="text-slate-300 mt-1">${p.notes || p.description}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>`;
                });
                html += `</div>`;
                box.innerHTML = html;
                box.querySelectorAll('.tilo-day-toggle').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const k = btn.getAttribute('data-day');
                        window.TiloPro.collapsedDays = window.TiloPro.collapsedDays || {};
                        window.TiloPro.collapsedDays[k] = !window.TiloPro.collapsedDays[k];
                        localStorage.setItem('tilo_collapsed_days', JSON.stringify(window.TiloPro.collapsedDays));
                        renderGroups();
                    });
                });
                bindPdf();
            }

            function bindPdf() {
                const b = document.getElementById('tilo-pdf-btn');
                if (b) b.onclick = () => window.TiloPro.openPdfExportModal && window.TiloPro.openPdfExportModal();
            }

            setInterval(renderGroups, 1200);
            renderGroups();

            // تحلیل زیر داشبورد
            const divs = Array.from(mainEl.children).filter(el => el.tagName === 'DIV' && !el.classList.contains('fixed'));
            const dash = divs[0];
            if (dash && !document.getElementById('tilo-ai-consultant-section')) {
                const ai = document.createElement('div');
                ai.id = 'tilo-ai-consultant-section';
                ai.className = 'soft-card p-5 rounded-2xl mt-5 space-y-3 border border-indigo-500/20';
                ai.innerHTML = `
                    <div class="flex flex-wrap justify-between gap-2 items-center">
                        <h3 class="text-sm font-extrabold">تحلیل عملکرد (مشاوره متنی)</h3>
                        <button type="button" id="tilo-run-ai" class="btn-calm bg-primary text-white text-xs py-2 px-3">اجرای تحلیل</button>
                    </div>
                    <div id="tilo-ai-out" class="text-xs text-slate-400">با زدن دکمه، بر اساس پارت‌های ثبت‌شده یک جمع‌بندی کاربردی می‌گیری.</div>
                `;
                dash.appendChild(ai);
                document.getElementById('tilo-run-ai').onclick = () => {
                    const completed = (state.parts || []).filter(p => p.status === 'completed');
                    let study = 0, tests = 0, correct = 0, wrong = 0;
                    const sub = {};
                    completed.forEach(p => {
                        if (p.isLife || p.isNonStudy) return;
                        study += Number(p.realTime || 0);
                        (p.subjects || []).forEach(s => { sub[s] = (sub[s] || 0) + Number(p.realTime || 0); });
                        if (p.tests) {
                            tests += Number(p.tests.total || 0);
                            correct += Number(p.tests.correct || 0);
                            wrong += Number(p.tests.wrong || 0);
                        }
                    });
                    const top = Object.entries(sub).sort((a, b) => b[1] - a[1])[0];
                    const weak = Object.entries(sub).sort((a, b) => a[1] - b[1])[0];
                    const acc = (correct + wrong) > 0 ? ((correct / (correct + wrong)) * 100).toFixed(1) : '—';
                    const name = (state.settings && state.settings.userName) || 'تو';
                    document.getElementById('tilo-ai-out').innerHTML = `
                        <div class="space-y-2 text-slate-300 leading-relaxed">
                            <p><strong class="text-white">${name}</strong> تا الان <strong class="text-tealSoft">${study} دقیقه</strong> مطالعه درسی ثبت کرده (${completed.length} پارت تکمیل‌شده).</p>
                            <p>دقت تست‌ها: <strong>${acc}%</strong> (${correct} درست / ${wrong} غلط از ${tests} تست).</p>
                            <p>بیشترین زمان: <strong class="text-white">${top ? top[0] : '—'}</strong>${top ? ` (${top[1]} دقیقه)` : ''}.</p>
                            <p>کم‌توجهی نسبی: <strong class="text-amberSoft">${weak && top && weak[0] !== top[0] ? weak[0] : 'هنوز داده کافی نیست'}</strong>.</p>
                            <p class="text-slate-400">پیشنهاد: هر پارت درس‌نامه را با ۱۵–۲۰ تست ببند و درس کم‌زمان را در برنامه هفتگی جبران کن.</p>
                        </div>`;
                };
            }
        }, 400);
    })();

})();
