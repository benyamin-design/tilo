/**
 * Tilo Upgrade Suite - Stage 1/4
 * استایل‌های ارتقایافته تایمر و اسکرول + موتور همگام‌سازی ابری دوطرفه (موبایل و لپ‌تاپ)
 */
(function initTiloStage1() {
    window.TiloPlus = window.TiloPlus || {
        vueState: null,
        db: null,
        auth: null,
        unsubscribeSnapshot: null,
        isSyncingFromCloud: false,
        syncTimeout: null,
        deletedIds: JSON.parse(localStorage.getItem('tilo_deleted_ids') || '[]')
    };

    // ۱. تزریق استایل‌های جدید (فضای پایین تایمر، ظاهر حرفه‌ای تایمر و منوی همبرگری)
    const styleEl = document.createElement('style');
    styleEl.id = 'tilo-upgrade-styles';
    styleEl.textContent = `
        /* فضای اسکرول اضافه در پایین صفحه و بخش تایمر */
        main {
            padding-bottom: 11rem !important;
            scroll-behavior: smooth;
        }
        .tilo-timer-spacer {
            height: 140px;
            width: 100%;
            pointer-events: none;
        }

        /* ارتقای ظاهری بخش تایمر */
        .tilo-timer-pro-card {
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.96)) !important;
            border: 1px solid rgba(99, 102, 241, 0.28) !important;
            box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.55), 0 0 35px rgba(99, 102, 241, 0.12) !important;
            position: relative;
            overflow: hidden;
        }
        .tilo-timer-pro-card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle at center, rgba(45, 212, 191, 0.06) 0%, transparent 60%);
            pointer-events: none;
        }
        .tilo-timer-digits-glow {
            text-shadow: 0 0 25px rgba(99, 102, 241, 0.45), 0 0 8px rgba(45, 212, 191, 0.3);
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.08em !important;
        }

        /* استایل منوی همبرگری و دراور کشویی */
        .tilo-hamburger-btn {
            width: 42px;
            height: 42px;
            border-radius: 0.85rem;
            background: rgba(30, 41, 59, 0.9);
            border: 1px solid rgba(129, 140, 248, 0.25);
            color: #f8fafc;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .tilo-hamburger-btn:hover {
            border-color: #2dd4bf;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(45, 212, 191, 0.15);
        }
        .tilo-drawer-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, 0.75);
            backdrop-filter: blur(6px);
            z-index: 99990;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.25s ease;
        }
        .tilo-drawer-backdrop.open {
            opacity: 1;
            pointer-events: auto;
        }
        .tilo-drawer-panel {
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            width: 300px;
            max-width: 85vw;
            background: #0f172a;
            border-left: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
            z-index: 99995;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            flex-direction: column;
            padding: 1.25rem;
            overflow-y: auto;
        }
        .tilo-drawer-panel.open {
            transform: translateX(0);
        }
    `;
    document.head.appendChild(styleEl);

    // ۲. اتصال به هسته Vue و راه‌اندازی همگام‌سازی ابری واقعی بین دستگاه‌ها
    const waitVue = setInterval(async () => {
        const appEl = document.getElementById('app');
        if (appEl && appEl.__vue_app__ && appEl.__vue_app__._instance) {
            clearInterval(waitVue);
            const state = appEl.__vue_app__._instance.setupState;
            window.TiloPlus.vueState = state;
            await setupCrossDeviceCloudSync(state);
        }
    }, 200);

    async function setupCrossDeviceCloudSync(state) {
        const FB_VERSION = "10.8.0";
        try {
            const firestoreMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`);
            const authMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`);
            const appMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`);

            // رهگیری تغییرات localStorage برای ارسال خودکار به ابر
            const origSetItem = localStorage.setItem.bind(localStorage);
            localStorage.setItem = function(key, value) {
                origSetItem(key, value);
                if (!window.TiloPlus.isSyncingFromCloud && (key === 'sp_pro_parts' || key === 'sp_pro_settings' || key === 'tilo_weekly_parts')) {
                    schedulePushToCloud();
                }
            };

            function getActiveAuthAndDb() {
                const rawCfg = localStorage.getItem('tilo_fb_config') || state.firebaseConfigInput;
                if (!rawCfg) return null;
                try {
                    const cfg = JSON.parse(rawCfg);
                    const apps = appMod.getApps ? appMod.getApps() : [];
                    const app = apps.length ? apps[0] : appMod.initializeApp(cfg);
                    const auth = authMod.getAuth(app);
                    const db = firestoreMod.getFirestore(app);
                    return { auth, db };
                } catch (e) {
                    return null;
                }
            }

            // ادغام هوشمند پارت‌های موبایل و لپ‌تاپ بدون پاک شدن اطلاعات
            function mergePartsSmart(localArr, cloudArr) {
                const map = new Map();
                const delSet = new Set(window.TiloPlus.deletedIds || []);

                (Array.isArray(cloudArr) ? cloudArr : []).forEach(p => {
                    if (p && p.id && !delSet.has(p.id)) map.set(p.id, p);
                });
                (Array.isArray(localArr) ? localArr : []).forEach(p => {
                    if (p && p.id && !delSet.has(p.id)) {
                        const existing = map.get(p.id);
                        if (!existing) {
                            map.set(p.id, p);
                        } else {
                            // اگر در یکی از دستگاه‌ها تکمیل شده، نسخه تکمیل‌شده اولویت دارد
                            if (p.status === 'completed' && existing.status !== 'completed') {
                                map.set(p.id, p);
                            } else if ((p.completedAt || 0) > (existing.completedAt || 0)) {
                                map.set(p.id, p);
                            }
                        }
                    }
                });
                return Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
            }

            async function pushToCloudNow() {
                const conn = getActiveAuthAndDb();
                if (!conn || !conn.auth.currentUser) return;
                const uid = conn.auth.currentUser.uid;
                const userDocRef = firestoreMod.doc(conn.db, 'tilo_sync_users', uid);

                try {
                    if (state.cloudStatus) state.cloudStatus = { text: 'در حال ذخیره ابری...', class: 'bg-amberSoft animate-pulse' };
                    const currentParts = Array.isArray(state.parts) ? state.parts : JSON.parse(localStorage.getItem('sp_pro_parts') || '[]');
                    const currentSettings = state.settings || JSON.parse(localStorage.getItem('sp_pro_settings') || '{}');
                    const weeklyParts = JSON.parse(localStorage.getItem('tilo_weekly_parts') || '{}');

                    await firestoreMod.setDoc(userDocRef, {
                        parts: JSON.parse(JSON.stringify(currentParts)),
                        settings: JSON.parse(JSON.stringify(currentSettings)),
                        weeklyParts: weeklyParts,
                        deletedIds: window.TiloPlus.deletedIds.slice(-300),
                        updatedAt: Date.now()
                    }, { merge: true });

                    if (state.cloudStatus) state.cloudStatus = { text: 'همگام‌سازی شده', class: 'bg-sage' };
                } catch (err) {
                    console.error('Cloud Push Error:', err);
                    if (state.cloudStatus) state.cloudStatus = { text: 'خطا در همگام‌سازی', class: 'bg-roseSoft' };
                }
            }

            function schedulePushToCloud() {
                clearTimeout(window.TiloPlus.syncTimeout);
                window.TiloPlus.syncTimeout = setTimeout(pushToCloudNow, 700);
            }

            async function pullAndListenCloud(user) {
                const conn = getActiveAuthAndDb();
                if (!conn || !user) return;
                const userDocRef = firestoreMod.doc(conn.db, 'tilo_sync_users', user.uid);

                try {
                    const snap = await firestoreMod.getDoc(userDocRef);
                    if (snap.exists()) {
                        applyCloudData(snap.data(), true);
                    } else {
                        await pushToCloudNow();
                    }
                } catch (e) {
                    console.error('Initial Pull Error:', e);
                }

                if (window.TiloPlus.unsubscribeSnapshot) window.TiloPlus.unsubscribeSnapshot();
                window.TiloPlus.unsubscribeSnapshot = firestoreMod.onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        applyCloudData(docSnap.data(), false);
                    }
                });
            }

            function applyCloudData(data, pushBackMerged) {
                if (!data) return;
                window.TiloPlus.isSyncingFromCloud = true;
                try {
                    if (Array.isArray(data.deletedIds)) {
                        const mergedDel = Array.from(new Set([...window.TiloPlus.deletedIds, ...data.deletedIds]));
                        window.TiloPlus.deletedIds = mergedDel;
                        origSetItem('tilo_deleted_ids', JSON.stringify(mergedDel));
                    }

                    const localParts = Array.isArray(state.parts) ? state.parts : JSON.parse(localStorage.getItem('sp_pro_parts') || '[]');
                    const mergedParts = mergePartsSmart(localParts, data.parts || []);
                    state.parts = mergedParts;
                    origSetItem('sp_pro_parts', JSON.stringify(mergedParts));

                    if (data.settings) {
                        state.settings = { ...state.settings, ...data.settings, onboarded: true };
                        state.showWelcomeModal = false;
                        origSetItem('sp_pro_settings', JSON.stringify(state.settings));
                    }

                    if (data.weeklyParts) {
                        origSetItem('tilo_weekly_parts', JSON.stringify(data.weeklyParts));
                        if (typeof window.TiloPlus.renderWeeklyCalendar === 'function') {
                            window.TiloPlus.renderWeeklyCalendar();
                        }
                    }

                    if (state.cloudStatus) state.cloudStatus = { text: 'متصل و همگام', class: 'bg-sage' };
                } finally {
                    window.TiloPlus.isSyncingFromCloud = false;
                }

                if (pushBackMerged) {
                    schedulePushToCloud();
                }
            }

            // ثبت حذف پارت‌ها برای جلوگیری از بازگشت ناخواسته از دستگاه دیگر
            const origDeletePart = state.deletePart;
            if (typeof origDeletePart === 'function') {
                state.deletePart = function(id) {
                    if (!window.TiloPlus.deletedIds.includes(id)) {
                        window.TiloPlus.deletedIds.push(id);
                        origSetItem('tilo_deleted_ids', JSON.stringify(window.TiloPlus.deletedIds));
                    }
                    origDeletePart(id);
                    schedulePushToCloud();
                };
            }

            window.TiloPlus.forceSyncNow = async function() {
                const conn = getActiveAuthAndDb();
                if (!conn || !conn.auth.currentUser) {
                    alert('ابتدا وارد حساب گوگل خود شوید.');
                    return;
                }
                await pullAndListenCloud(conn.auth.currentUser);
                await pushToCloudNow();
            };

            // بررسی وضعیت لاگین در هر لحظه
            const checkAuthTimer = setInterval(() => {
                const conn = getActiveAuthAndDb();
                if (conn && conn.auth) {
                    clearInterval(checkAuthTimer);
                    authMod.onAuthStateChanged(conn.auth, (u) => {
                        if (u) {
                            state.currentUser = u;
                            pullAndListenCloud(u);
                        }
                    });
                }
            }, 600);

        } catch (err) {
            console.error('Tilo Stage 1 Init Error:', err);
        }
    }
})();
/**
 * Tilo Upgrade Suite - Stage 2/4
 * منوی همبرگری کشویی (Drawer) + کلید همگام‌سازی دستی فوری + حالت تمرکز
 */
(function initTiloStage2() {
    const waitReady = setInterval(() => {
        const state = window.TiloPlus && window.TiloPlus.vueState;
        const headerEl = document.querySelector('main header');
        if (state && document.body && headerEl) {
            clearInterval(waitReady);
            buildHamburgerMenu(state, headerEl);
        }
    }, 250);

    function buildHamburgerMenu(state, headerEl) {
        if (document.getElementById('tilo-hamburger-trigger')) return;

        // ۱. ساخت دکمه همبرگری و افزودن به هدر بالای صفحه
        const rightGroup = headerEl.firstElementChild;
        const hamBtn = document.createElement('button');
        hamBtn.id = 'tilo-hamburger-trigger';
        hamBtn.className = 'tilo-hamburger-btn shrink-0';
        hamBtn.title = 'منوی سریع و ابزارها';
        hamBtn.innerHTML = '<i class="fas fa-bars text-base text-tealSoft"></i>';

        if (rightGroup) {
            rightGroup.insertBefore(hamBtn, rightGroup.firstChild);
        } else {
            headerEl.insertBefore(hamBtn, headerEl.firstChild);
        }

        // ۲. ساخت لایه تاریک پشت منو (Backdrop) و پنل کشویی
        const backdrop = document.createElement('div');
        backdrop.className = 'tilo-drawer-backdrop';

        const drawer = document.createElement('aside');
        drawer.className = 'tilo-drawer-panel text-right select-none';
        drawer.innerHTML = `
            <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-tealSoft flex items-center justify-center shadow">
                        <i class="fas fa-graduation-cap text-slate-950 text-base"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-white text-sm" id="tilo-drawer-username">tilo Pro</h3>
                        <p class="text-[10px] text-tealSoft" id="tilo-drawer-sync-label">آماده همگام‌سازی</p>
                    </div>
                </div>
                <button id="tilo-drawer-close" class="w-8 h-8 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- خلاصه وضعیت امروز در منو -->
            <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 mb-4 space-y-2">
                <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-400">📚 مطالعه درسی امروز:</span>
                    <strong class="text-white font-bold" id="tilo-drawer-study-time">۰ دقیقه</strong>
                </div>
                <div class="flex justify-between items-center text-xs">
                    <span class="text-slate-400">☕ کار غیر درسی امروز:</span>
                    <strong class="text-amberSoft font-bold" id="tilo-drawer-nonstudy-time">۰ دقیقه</strong>
                </div>
            </div>

            <!-- دکمه همگام‌سازی فوری بین گوشی و لپ‌تاپ -->
            <button id="tilo-drawer-force-sync" class="btn-calm bg-gradient-to-r from-primary/25 to-tealSoft/20 border border-tealSoft/40 text-tealSoft text-xs py-2.5 px-3 rounded-xl w-full mb-4 font-bold hover:border-tealSoft">
                <i class="fas fa-sync-alt" id="tilo-sync-icon"></i>
                <span>همگام‌سازی فوری (گوشی و لپ‌تاپ)</span>
            </button>

            <!-- لیست دسترسی سریع به بخش‌ها -->
            <div class="space-y-1.5 flex-1">
                <p class="text-[10px] font-bold text-slate-500 px-2 mb-1">دسترسی سریع به بخش‌ها</p>
                <button data-tab="dashboard" class="tilo-drawer-nav w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/70 transition">
                    <span class="flex items-center gap-2.5"><i class="fas fa-chart-pie w-5 text-primarySoft"></i> داشبورد و تحلیل</span>
                </button>
                <button data-tab="parts" class="tilo-drawer-nav w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/70 transition">
                    <span class="flex items-center gap-2.5"><i class="fas fa-layer-group w-5 text-tealSoft"></i> مدیریت پارت‌ها</span>
                    <span id="tilo-drawer-pending-badge" class="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">0</span>
                </button>
                <button data-tab="timer" class="tilo-drawer-nav w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/70 transition">
                    <span class="flex items-center gap-2.5"><i class="fas fa-stopwatch w-5 text-amberSoft"></i> تایمر مهندسی مطالعه</span>
                </button>
                <button data-tab="calendar" class="tilo-drawer-nav w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/70 transition">
                    <span class="flex items-center gap-2.5"><i class="fas fa-calendar-week w-5 text-sage"></i> برنامه هفتگی و تقویم</span>
                </button>
                <button data-tab="archive" class="tilo-drawer-nav w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/70 transition">
                    <span class="flex items-center gap-2.5"><i class="fas fa-folder-open w-5 text-indigo-400"></i> آرشیو آموزشی</span>
                </button>
                <button data-tab="calculator" class="tilo-drawer-nav w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/70 transition">
                    <span class="flex items-center gap-2.5"><i class="fas fa-percentage w-5 text-roseSoft"></i> درصدگیر کنکور</span>
                </button>
                <button data-tab="settings" class="tilo-drawer-nav w-full flex items-center justify-between p-2.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800/70 transition">
                    <span class="flex items-center gap-2.5"><i class="fas fa-sliders-h w-5 text-slate-400"></i> تنظیمات و حساب ابری</span>
                </button>
            </div>

            <!-- ابزارهای کمکی پایین منو -->
            <div class="pt-4 mt-4 border-t border-slate-800 space-y-2">
                <button id="tilo-fullscreen-btn" class="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white">
                    <i class="fas fa-expand text-primarySoft"></i> حالت تمام‌صفحه تمرکز
                </button>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);

        function openDrawer() {
            updateDrawerStats();
            backdrop.classList.add('open');
            drawer.classList.add('open');
        }

        function closeDrawer() {
            backdrop.classList.remove('open');
            drawer.classList.remove('open');
        }

        function updateDrawerStats() {
            const nameEl = document.getElementById('tilo-drawer-username');
            const syncEl = document.getElementById('tilo-drawer-sync-label');
            const studyEl = document.getElementById('tilo-drawer-study-time');
            const nonStudyEl = document.getElementById('tilo-drawer-nonstudy-time');
            const badgeEl = document.getElementById('tilo-drawer-pending-badge');

            if (nameEl) nameEl.textContent = (state.settings && state.settings.userName) ? state.settings.userName : 'کاربر tilo';
            if (syncEl) {
                syncEl.textContent = state.currentUser
                    ? `متصل: ${state.currentUser.email || 'اکانت گوگل'}`
                    : (state.cloudStatus ? state.cloudStatus.text : 'حالت آفلاین');
            }
            if (studyEl && state.todayStats && typeof state.formatMinutes === 'function') {
                studyEl.textContent = state.formatMinutes(state.todayStats.totalTime || 0);
                nonStudyEl.textContent = state.formatMinutes(state.todayStats.nonStudyTime || 0);
            }
            if (badgeEl && Array.isArray(state.pendingParts)) {
                badgeEl.textContent = state.pendingParts.length;
            }

            drawer.querySelectorAll('.tilo-drawer-nav').forEach(btn => {
                const isActive = btn.getAttribute('data-tab') === state.currentTab;
                btn.className = `tilo-drawer-nav w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition ${
                    isActive ? 'bg-primary/20 text-primarySoft font-bold border border-primary/30' : 'text-slate-300 hover:bg-slate-800/70'
                }`;
            });
        }

        hamBtn.addEventListener('click', openDrawer);
        backdrop.addEventListener('click', closeDrawer);
        document.getElementById('tilo-drawer-close').addEventListener('click', closeDrawer);

        drawer.querySelectorAll('.tilo-drawer-nav').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                if (targetTab) state.currentTab = targetTab;
                closeDrawer();
            });
        });

        document.getElementById('tilo-drawer-force-sync').addEventListener('click', async () => {
            const icon = document.getElementById('tilo-sync-icon');
            if (icon) icon.classList.add('fa-spin');
            if (typeof window.TiloPlus.forceSyncNow === 'function') {
                await window.TiloPlus.forceSyncNow();
            }
            setTimeout(() => {
                if (icon) icon.classList.remove('fa-spin');
                updateDrawerStats();
            }, 600);
        });

        document.getElementById('tilo-fullscreen-btn').addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
            closeDrawer();
        });
    }
})();
/**
 * Tilo Upgrade Suite - Stage 3/4
 * ارتقای ظاهری و امکانات تایمر حرفه‌ای + نوار پیشرفت + فضای اسکرول اضافه در پایین تایمر
 */
(function initTiloStage3() {
    const waitTimerReady = setInterval(() => {
        const state = window.TiloPlus && window.TiloPlus.vueState;
        const mainEl = document.querySelector('main');
        if (state && mainEl) {
            clearInterval(waitTimerReady);
            enhanceTimerSection(state, mainEl);
        }
    }, 300);

    function findTimerTabElement(mainEl) {
        // پیدا کردن دقیق تب تایمر در ساختار صفحه بدون تداخل با Vue
        const divs = Array.from(mainEl.children).filter(el => el.tagName === 'DIV' && !el.classList.contains('fixed'));
        for (const d of divs) {
            if (d.innerHTML.includes('finishActiveTimer') || d.innerHTML.includes('تایمر مهندسی') || d.innerHTML.includes('پارت جاری')) {
                return d;
            }
        }
        // در صورتی که ترتیب استاندارد تب‌ها باشد (۰:داشبورد، ۱:پارت‌ها، ۲:تایمر)
        return divs[2] || null;
    }

    function enhanceTimerSection(state, mainEl) {
        const timerTabEl = findTimerTabElement(mainEl);
        if (!timerTabEl || document.getElementById('tilo-timer-pro-extension')) return;

        // ۱. زیباسازی کارت اصلی تایمر فعلی
        const mainTimerCard = timerTabEl.querySelector('.soft-card');
        if (mainTimerCard) {
            mainTimerCard.classList.add('tilo-timer-pro-card');
        }

        // ۲. ساخت پنل امکانات پیشرفته تایمر + فضای اسکرول پایین
        const extWrapper = document.createElement('div');
        extWrapper.id = 'tilo-timer-pro-extension';
        extWrapper.className = 'space-y-5 mt-5 select-none';
        extWrapper.innerHTML = `
            <!-- نوار پیشرفت زنده و کنترل‌های سریع زمان -->
            <div class="soft-card p-5 rounded-3xl border border-indigo-500/25 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="text-xs font-extrabold text-white flex items-center gap-2">
                        <i class="fas fa-bolt text-amberSoft"></i> کنترلگر سریع و نوار پیشرفت تایمر
                    </span>
                    <span id="tilo-timer-progress-text" class="text-[11px] font-bold text-tealSoft bg-tealSoft/10 px-2.5 py-1 rounded-lg">
                        ۰٪ تکمیل شده
                    </span>
                </div>

                <!-- نوار پیشرفت گرافیکی -->
                <div class="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                    <div id="tilo-timer-progress-bar" class="bg-gradient-to-r from-primary via-indigo-400 to-tealSoft h-full rounded-full transition-all duration-500" style="width: 0%"></div>
                </div>

                <!-- دکمه‌های تغییر سریع زمان در حین کار -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <button type="button" data-adj="300" class="tilo-timer-adj btn-calm bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-tealSoft py-2.5">
                        <i class="fas fa-plus-circle"></i> +۵ دقیقه
                    </button>
                    <button type="button" data-adj="600" class="tilo-timer-adj btn-calm bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-primarySoft py-2.5">
                        <i class="fas fa-plus-circle"></i> +۱۰ دقیقه
                    </button>
                    <button type="button" data-adj="-300" class="tilo-timer-adj btn-calm bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-amberSoft py-2.5">
                        <i class="fas fa-minus-circle"></i> -۵ دقیقه
                    </button>
                    <button type="button" id="tilo-timer-reset-btn" class="btn-calm bg-roseSoft/15 hover:bg-roseSoft/25 border border-roseSoft/30 text-xs text-roseSoft py-2.5">
                        <i class="fas fa-redo"></i> بازنشانی تایمر
                    </button>
                </div>
            </div>

            <!-- شروع سریع پومودورو یا انتخاب فوری از لیست انتظار بدون خروج از تب تایمر -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="soft-card p-5 rounded-3xl space-y-3">
                    <h4 class="text-xs font-extrabold text-white flex items-center gap-2">
                        <i class="fas fa-fire text-roseSoft"></i> شروع فوری تایمر (بدون نیاز به ساخت پارت قبلی)
                    </h4>
                    <p class="text-[11px] text-slate-400">با یک کلیک یک پارت فوری بسازید و تایمر را همان لحظه روشن کنید:</p>
                    <div class="grid grid-cols-2 gap-2 pt-1">
                        <button type="button" data-quick-min="25" data-quick-study="1" data-quick-title="پومودورو تمرکزی" class="tilo-quick-timer btn-calm bg-primary/20 hover:bg-primary/30 border border-primary/40 text-indigo-200 text-xs py-2.5">
                            🍅 پومودورو ۲۵ دقیقه
                        </button>
                        <button type="button" data-quick-min="50" data-quick-study="1" data-quick-title="پارت مطالعه استاندارد" class="tilo-quick-timer btn-calm bg-tealSoft/15 hover:bg-tealSoft/25 border border-tealSoft/30 text-tealSoft text-xs py-2.5">
                            📚 مطالعه ۵۰ دقیقه
                        </button>
                        <button type="button" data-quick-min="75" data-quick-study="1" data-quick-title="پارت تست و تحلیل" class="tilo-quick-timer btn-calm bg-sage/15 hover:bg-sage/25 border border-sage/30 text-sage text-xs py-2.5">
                            🎯 تست‌زنی ۷۵ دقیقه
                        </button>
                        <button type="button" data-quick-min="20" data-quick-study="0" data-quick-title="استراحت و کار شخصی" class="tilo-quick-timer btn-calm bg-amberSoft/15 hover:bg-amberSoft/25 border border-amberSoft/30 text-amberSoft text-xs py-2.5">
                            ☕ غیردرسی ۲۰ دقیقه
                        </button>
                    </div>
                </div>

                <!-- لیست انتخاب سریع پارت‌های در انتظار در همان صفحه تایمر -->
                <div class="soft-card p-5 rounded-3xl space-y-3">
                    <div class="flex justify-between items-center">
                        <h4 class="text-xs font-extrabold text-white flex items-center gap-2">
                            <i class="fas fa-list-check text-tealSoft"></i> تغییر سریع پارت از صف انتظار
                        </h4>
                        <span id="tilo-timer-queue-count" class="text-[10px] text-slate-400">0 پارت</span>
                    </div>
                    <div id="tilo-timer-quick-queue" class="space-y-2 max-h-40 overflow-y-auto pr-1">
                        <p class="text-xs text-slate-500 text-center py-4">پارتی در صف انتظار نیست.</p>
                    </div>
                </div>
            </div>

            <!-- فضای خالی اختصاصی پایین تایمر برای اسکرول راحت در موبایل و لپ‌تاپ -->
            <div class="tilo-timer-spacer flex items-center justify-center">
                <span class="text-[10px] text-slate-600">• فضای تنفس و اسکرول آزاد تایمر •</span>
            </div>
        `;

        timerTabEl.appendChild(extWrapper);

        // ۳. رویدادهای دکمه‌های تغییر زمان (+۵، +۱۰، -۵ دقیقه)
        extWrapper.querySelectorAll('.tilo-timer-adj').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!state.timer || !state.timer.activePart) {
                    alert('ابتدا یک پارت را روشن کنید یا از دکمه‌های «شروع فوری» پایین استفاده کنید.');
                    return;
                }
                const delta = parseInt(btn.getAttribute('data-adj'), 10);
                const nextSec = Math.max(60, (state.timer.seconds || 0) + delta);
                state.timer.seconds = nextSec;
                if (delta > 0 && state.timer.activePart) {
                    state.timer.activePart.plannedTime = Math.max(
                        state.timer.activePart.plannedTime || 60,
                        Math.ceil(nextSec / 60)
                    );
                }
            });
        });

        // بازنشانی تایمر به زمان اولیه پارت
        document.getElementById('tilo-timer-reset-btn').addEventListener('click', () => {
            if (!state.timer || !state.timer.activePart) return;
            state.timer.seconds = (state.timer.activePart.plannedTime || 60) * 60;
        });

        // ۴. رویداد شروع فوری پومودورو / پارت سریع
        extWrapper.querySelectorAll('.tilo-quick-timer').forEach(btn => {
            btn.addEventListener('click', () => {
                const mins = parseInt(btn.getAttribute('data-quick-min'), 10) || 45;
                const isStudy = btn.getAttribute('data-quick-study') === '1';
                const title = btn.getAttribute('data-quick-title') || 'پارت سریع';

                const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
                const todayFa = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(new Date());

                const quickPart = {
                    id: Date.now(),
                    dateISO: todayISO,
                    dateStr: todayFa,
                    isNonStudy: !isStudy,
                    subjects: isStudy ? ['مطالعه آزاد'] : [],
                    topic: title,
                    description: 'شروع شده از پنل سریع تایمر',
                    type: isStudy ? 'آموزشی / مطالعاتی' : 'سایر کارهای شخصی',
                    plannedTime: mins,
                    realTime: 0,
                    status: 'pending',
                    tests: { correct: 0, wrong: 0, total: 0 }
                };

                if (Array.isArray(state.parts)) {
                    state.parts.unshift(quickPart);
                    localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                }
                if (typeof state.selectPartAndGoToTimer === 'function') {
                    state.selectPartAndGoToTimer(quickPart);
                }
            });
        });

        // ۵. بروزرسانی زنده نوار پیشرفت، افکت اعداد تایمر و لیست صف انتظار
        setInterval(() => {
            if (!state.timer) return;

            // اعمال درخشش روی اعداد تایمر
            const digitEl = timerTabEl.querySelector('.text-4xl, .text-5xl, .text-6xl');
            if (digitEl && !digitEl.classList.contains('tilo-timer-digits-glow')) {
                digitEl.classList.add('tilo-timer-digits-glow');
            }

            const barEl = document.getElementById('tilo-timer-progress-bar');
            const txtEl = document.getElementById('tilo-timer-progress-text');

            if (state.timer.activePart && barEl && txtEl) {
                const totalSec = Math.max(60, (state.timer.activePart.plannedTime || 60) * 60);
                const remSec = Math.max(0, state.timer.seconds || 0);
                const pct = Math.min(100, Math.max(0, Math.round(((totalSec - remSec) / totalSec) * 100)));
                barEl.style.width = pct + '%';
                txtEl.textContent = `${pct}٪ طی شده (${state.timer.activePart.topic})`;
            } else if (barEl && txtEl) {
                barEl.style.width = '0%';
                txtEl.textContent = 'در انتظار شروع پارت';
            }

            // بروزرسانی لیست صف انتظار داخل تب تایمر
            const queueBox = document.getElementById('tilo-timer-quick-queue');
            const queueCount = document.getElementById('tilo-timer-queue-count');
            if (queueBox && Array.isArray(state.pendingParts)) {
                if (queueCount) queueCount.textContent = `${state.pendingParts.length} پارت آماده`;
                const sig = state.pendingParts.map(p => p.id).join(',');
                if (queueBox.getAttribute('data-sig') !== sig) {
                    queueBox.setAttribute('data-sig', sig);
                    if (state.pendingParts.length === 0) {
                        queueBox.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">پارتی در صف انتظار نیست.</p>';
                    } else {
                        queueBox.innerHTML = state.pendingParts.map(p => `
                            <div class="flex items-center justify-between bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-xl text-xs">
                                <div class="truncate pr-1">
                                    <span class="font-bold text-white">${p.isNonStudy ? '☕ ' : '📚 '}${p.topic}</span>
                                    <span class="text-[10px] text-slate-400 mr-1">(${p.plannedTime} دقیقه)</span>
                                </div>
                                <button type="button" data-start-id="${p.id}" class="tilo-queue-play btn-calm bg-primary text-white text-[11px] py-1 px-2.5 rounded-lg shrink-0">
                                    شروع
                                </button>
                            </div>
                        `).join('');

                        queueBox.querySelectorAll('.tilo-queue-play').forEach(b => {
                            b.addEventListener('click', () => {
                                const pid = Number(b.getAttribute('data-start-id'));
                                const found = state.pendingParts.find(x => x.id === pid);
                                if (found && typeof state.selectPartAndGoToTimer === 'function') {
                                    state.selectPartAndGoToTimer(found);
                                }
                            });
                        });
                    }
                }
            }
        }, 700);
    }
})();
/**
 * Tilo Upgrade Suite - Stage 4/4
 * سیستم کامل مدیریت پارت‌ها و برنامه‌ریزی پیشرفته در تب «برنامه هفتگی و تقویم»
 */
(function initTiloStage4() {
    const waitCalendarReady = setInterval(() => {
        const state = window.TiloPlus && window.TiloPlus.vueState;
        const mainEl = document.querySelector('main');
        if (state && mainEl) {
            clearInterval(waitCalendarReady);
            enhanceWeeklyCalendar(state, mainEl);
        }
    }, 350);

    function findCalendarTabElement(mainEl) {
        const divs = Array.from(mainEl.children).filter(el => el.tagName === 'DIV' && !el.classList.contains('fixed'));
        for (const d of divs) {
            if (d.innerHTML.includes('برنامه هفتگی') && (d.innerHTML.includes('تقویم') || d.innerHTML.includes('روزهای هفته'))) {
                return d;
            }
        }
        return divs[3] || null; // تب تقویم و برنامه هفتگی
    }

    function enhanceWeeklyCalendar(state, mainEl) {
        const calTabEl = findCalendarTabElement(mainEl);
        if (!calTabEl || document.getElementById('tilo-calendar-pro-extension')) return;

        // ذخیره سراسری تابع رندر برای بروزرسانی از طریق همگام‌سازی ابری
        window.TiloPlus.renderWeeklyCalendar = renderCalendarUI;

        const daysOfWeek = [
            { id: 'sat', name: 'شنبه' },
            { id: 'sun', name: 'یکشنبه' },
            { id: 'mon', name: 'دوشنبه' },
            { id: 'tue', name: 'سه‌شنبه' },
            { id: 'wed', name: 'چهارشنبه' },
            { id: 'thu', name: 'پنج‌شنبه' },
            { id: 'fri', name: 'جمعه' }
        ];

        function getWeeklyStorage() {
            try {
                return JSON.parse(localStorage.getItem('tilo_weekly_parts') || '{}');
            } catch (e) {
                return {};
            }
        }

        function saveWeeklyStorage(obj) {
            localStorage.setItem('tilo_weekly_parts', JSON.stringify(obj));
        }

        const container = document.createElement('div');
        container.id = 'tilo-calendar-pro-extension';
        container.className = 'space-y-6 mt-4 select-none';
        container.innerHTML = `
            <div class="soft-card p-5 md:p-6 rounded-3xl border border-indigo-500/25 space-y-4">
                <div class="flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <h3 class="text-base md:text-lg font-extrabold text-white flex items-center gap-2">
                            <i class="fas fa-calendar-alt text-sage"></i> تقویم و برنامه‌ریز پیشرفته هفتگی
                        </h3>
                        <p class="text-xs text-slate-400 mt-1">برای هر روز هفته پارت‌های درسی یا غیردرسی ☕ دلخواهت را از قبل بچین.</p>
                    </div>
                </div>

                <!-- تب‌بندی روزهای هفته -->
                <div id="tilo-cal-days-bar" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2"></div>
            </div>

            <!-- پنل مدیریت پارت‌های روز انتخاب‌شده -->
            <div class="soft-card p-5 md:p-6 rounded-3xl space-y-5">
                <div class="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-4">
                    <div>
                        <span class="text-[10px] text-tealSoft font-bold">برنامه روز:</span>
                        <h4 id="tilo-cal-selected-day-title" class="text-base font-black text-white">شنبه</h4>
                    </div>
                    <button type="button" id="tilo-cal-quick-add-modal-btn" class="btn-calm bg-primary text-white text-xs py-2 px-3.5">
                        <i class="fas fa-plus"></i> افزودن پارت به این روز
                    </button>
                </div>

                <!-- لیست پارت‌های این روز از هفته -->
                <div id="tilo-cal-day-parts-list" class="space-y-3"></div>
            </div>

            <!-- مودال افزودن پارت به روز هفته -->
            <div id="tilo-cal-modal-backdrop" class="fixed inset-0 z-[100050] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 hidden">
                <div class="soft-card bg-[#162032] w-full max-w-md rounded-3xl p-6 border border-slate-700 shadow-2xl space-y-4">
                    <div class="flex justify-between items-center">
                        <h4 class="font-bold text-white text-sm" id="tilo-cal-modal-title">افزودن پارت به روز هفته</h4>
                        <button type="button" id="tilo-cal-modal-close" class="text-slate-400 hover:text-white"><i class="fas fa-times text-base"></i></button>
                    </div>
                    <div class="space-y-3">
                        <div class="flex gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 w-fit">
                            <button type="button" id="tilo-cal-type-study" class="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary text-white transition">پارت درسی</button>
                            <button type="button" id="tilo-cal-type-nonstudy" class="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition">کار غیر درسی ☕</button>
                        </div>
                        <div id="tilo-cal-subject-group">
                            <label class="block text-xs text-slate-300 mb-1 font-medium">درس مربوطه:</label>
                            <select id="tilo-cal-subject-select" class="input-calm text-xs">
                                <option value="ریاضیات پایه">ریاضیات پایه</option>
                                <option value="حسابان">حسابان</option>
                                <option value="جبر و احتمال">جبر و احتمال</option>
                                <option value="هندسه">هندسه</option>
                                <option value="فیزیک">فیزیک</option>
                                <option value="شیمی">شیمی</option>
                                <option value="فارسی">فارسی</option>
                                <option value="عربی">عربی</option>
                                <option value="دین و زندگی">دین و زندگی</option>
                                <option value="زبان انگلیسی">زبان انگلیسی</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-slate-300 mb-1 font-medium">عنوان دقیق (مبحث یا فعالیت):</label>
                            <input type="text" id="tilo-cal-input-topic" class="input-calm text-xs" placeholder="مثلاً: تست مشتق و کاربرد">
                        </div>
                        <div>
                            <label class="block text-xs text-slate-300 mb-1 font-medium">زمان هدف (دقیقه):</label>
                            <input type="number" id="tilo-cal-input-time" value="60" min="5" max="300" class="input-calm text-xs font-bold text-center">
                        </div>
                        <button type="button" id="tilo-cal-modal-save" class="btn-calm bg-primary text-white text-xs w-full py-3">ذخیره در برنامه این روز</button>
                    </div>
                </div>
            </div>
        `;

        calTabEl.innerHTML = '';
        calTabEl.appendChild(container);

        let activeDayId = 'sat';
        let isModalNonStudy = false;

        function renderCalendarUI() {
            const data = getWeeklyStorage();

            // ۱. رندر دکمه‌های روزهای هفته
            const daysBar = document.getElementById('tilo-cal-days-bar');
            if (daysBar) {
                daysBar.innerHTML = daysOfWeek.map(d => {
                    const count = (data[d.id] || []).length;
                    const isActive = d.id === activeDayId;
                    return `
                        <button type="button" data-day-id="${d.id}" class="tilo-day-btn flex flex-col items-center justify-center p-3 rounded-2xl border transition text-xs ${
                            isActive ? 'bg-primary/25 border-primary text-white font-black shadow-lg shadow-primary/20' : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                        }">
                            <span class="font-bold">${d.name}</span>
                            <span class="text-[10px] ${isActive ? 'text-tealSoft' : 'text-slate-500'} mt-1">${count} پارت</span>
                        </button>
                    `;
                }).join('');

                daysBar.querySelectorAll('.tilo-day-btn').forEach(b => {
                    b.addEventListener('click', () => {
                        activeDayId = b.getAttribute('data-day-id');
                        renderCalendarUI();
                    });
                });
            }

            // ۲. نمایش عنوان روز انتخاب شده
            const selectedDayObj = daysOfWeek.find(x => x.id === activeDayId) || daysOfWeek[0];
            const titleEl = document.getElementById('tilo-cal-selected-day-title');
            if (titleEl) titleEl.textContent = selectedDayObj.name;

            // ۳. رندر لیست پارت‌های آن روز
            const listEl = document.getElementById('tilo-cal-day-parts-list');
            if (listEl) {
                const dayParts = data[activeDayId] || [];
                if (dayParts.length === 0) {
                    listEl.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">هیچ پارت یا برنامه‌ای برای این روز ثبت نشده است.</p>';
                } else {
                    listEl.innerHTML = dayParts.map((p, idx) => `
                        <div class="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div class="space-y-1">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <span class="${p.isNonStudy ? 'bg-amberSoft/20 text-amberSoft' : 'bg-primary/20 text-indigo-300'} text-[11px] px-2.5 py-0.5 rounded-md font-bold">
                                        ${p.isNonStudy ? '☕ غیر درسی' : p.subject}
                                    </span>
                                    <span class="text-xs text-slate-400">هدف: ${p.plannedTime} دقیقه</span>
                                </div>
                                <h5 class="font-bold text-white text-sm">${p.topic}</h5>
                            </div>
                            <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end border-t sm:border-t-0 border-slate-800 pt-2.5 sm:pt-0">
                                <button type="button" data-send-today="${idx}" class="btn-calm bg-tealSoft/15 hover:bg-tealSoft/25 border border-tealSoft/30 text-tealSoft text-[11px] py-1.5 px-3">
                                    <i class="fas fa-arrow-right"></i> انتقال به امروز
                                </button>
                                <button type="button" data-send-timer="${idx}" class="btn-calm bg-primary text-white text-[11px] py-1.5 px-3">
                                    <i class="fas fa-play"></i> شروع تایمر
                                </button>
                                <button type="button" data-del-idx="${idx}" class="text-roseSoft hover:bg-rose-500/10 p-2 rounded-lg">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('');

                    // دکمه انتقال به امروز
                    listEl.querySelectorAll('[data-send-today]').forEach(b => {
                        b.addEventListener('click', () => {
                            const idx = Number(b.getAttribute('data-send-today'));
                            const p = dayParts[idx];
                            if (!p) return;

                            const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
                            const todayFa = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(new Date());

                            const newPart = {
                                id: Date.now(),
                                dateISO: todayISO,
                                dateStr: todayFa,
                                isNonStudy: p.isNonStudy,
                                subjects: p.isNonStudy ? [] : [p.subject],
                                topic: p.topic,
                                description: 'انتقال‌یافته از برنامه هفتگی',
                                type: p.isNonStudy ? 'سایر کارهای شخصی' : 'آموزشی / مطالعاتی',
                                plannedTime: p.plannedTime,
                                realTime: 0,
                                status: 'pending',
                                tests: { correct: 0, wrong: 0, total: 0 }
                            };

                            if (Array.isArray(state.parts)) {
                                state.parts.unshift(newPart);
                                localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                                alert('پارت با موفقیت به صف امروز اضافه شد!');
                            }
                        });
                    });

                    // دکمه شروع مستقیم تایمر از روی برنامه هفتگی
                    listEl.querySelectorAll('[data-send-timer]').forEach(b => {
                        b.addEventListener('click', () => {
                            const idx = Number(b.getAttribute('data-send-timer'));
                            const p = dayParts[idx];
                            if (!p) return;

                            const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
                            const todayFa = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(new Date());

                            const newPart = {
                                id: Date.now(),
                                dateISO: todayISO,
                                dateStr: todayFa,
                                isNonStudy: p.isNonStudy,
                                subjects: p.isNonStudy ? [] : [p.subject],
                                topic: p.topic,
                                description: 'شروع مستقیم از برنامه هفتگی',
                                type: p.isNonStudy ? 'سایر کارهای شخصی' : 'آموزشی / مطالعاتی',
                                plannedTime: p.plannedTime,
                                realTime: 0,
                                status: 'pending',
                                tests: { correct: 0, wrong: 0, total: 0 }
                            };

                            if (Array.isArray(state.parts)) {
                                state.parts.unshift(newPart);
                                localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                            }
                            if (typeof state.selectPartAndGoToTimer === 'function') {
                                state.selectPartAndGoToTimer(newPart);
                            }
                        });
                    });

                    // دکمه حذف پارت از برنامه روز
                    listEl.querySelectorAll('[data-del-idx]').forEach(b => {
                        b.addEventListener('click', () => {
                            const idx = Number(b.getAttribute('data-del-idx'));
                            dayParts.splice(idx, 1);
                            saveWeeklyStorage(data);
                            renderCalendarUI();
                        });
                    });
                }
            }
        }

        // مودال مدیریت
        const modalBackdrop = document.getElementById('tilo-cal-modal-backdrop');
        const openModalBtn = document.getElementById('tilo-cal-quick-add-modal-btn');
        const closeModalBtn = document.getElementById('tilo-cal-modal-close');
        const saveModalBtn = document.getElementById('tilo-cal-modal-save');
        const btnStudy = document.getElementById('tilo-cal-type-study');
        const btnNonStudy = document.getElementById('tilo-cal-type-nonstudy');
        const subjGroup = document.getElementById('tilo-cal-subject-group');

        openModalBtn.addEventListener('click', () => {
            document.getElementById('tilo-cal-input-topic').value = '';
            document.getElementById('tilo-cal-input-time').value = '60';
            isModalNonStudy = false;
            updateModalTypeUI();
            modalBackdrop.classList.remove('hidden');
        });

        closeModalBtn.addEventListener('click', () => modalBackdrop.classList.add('hidden'));
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) modalBackdrop.classList.add('hidden');
        });

        btnStudy.addEventListener('click', () => { isModalNonStudy = false; updateModalTypeUI(); });
        btnNonStudy.addEventListener('click', () => { isModalNonStudy = true; updateModalTypeUI(); });

        function updateModalTypeUI() {
            if (isModalNonStudy) {
                btnNonStudy.className = 'px-4 py-1.5 rounded-lg text-xs font-bold bg-amberSoft text-slate-950 transition shadow';
                btnStudy.className = 'px-4 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition';
                subjGroup.classList.add('hidden');
            } else {
                btnStudy.className = 'px-4 py-1.5 rounded-lg text-xs font-bold bg-primary text-white transition shadow';
                btnNonStudy.className = 'px-4 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition';
                subjGroup.classList.remove('hidden');
            }
        }

        saveModalBtn.addEventListener('click', () => {
            const topic = document.getElementById('tilo-cal-input-topic').value.trim();
            const time = parseInt(document.getElementById('tilo-cal-input-time').value, 10) || 60;
            const subject = document.getElementById('tilo-cal-subject-select').value;

            if (!topic) {
                alert('لطفاً عنوان پارت را وارد کنید.');
                return;
            }

            const data = getWeeklyStorage();
            if (!data[activeDayId]) data[activeDayId] = [];

            data[activeDayId].push({
                id: Date.now(),
                isNonStudy: isModalNonStudy,
                subject: isModalNonStudy ? '' : subject,
                topic: topic,
                plannedTime: time
            });

            saveWeeklyStorage(data);
            modalBackdrop.classList.add('hidden');
            renderCalendarUI();
        });

        renderCalendarUI();
    }
})();
