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
/**
 * Tilo Pro Suite - Part 1/4
 * ۱. پالت رنگی استاندارد و چشم‌نواز (روز / شب مات) + انیمیشن‌های هاور
 * ۲. سیستم تایید کد ایمیل (OTP) در ورود و داخل برنامه + ذخیره‌سازی اختصاصی روی هر ایمیل
 */
(function initTiloProPart1() {
    window.TiloPro = window.TiloPro || {
        theme: localStorage.getItem('tilo_ui_theme') || 'night',
        verifiedEmail: localStorage.getItem('tilo_verified_email') || '',
        pendingEmail: '',
        generatedCode: '',
        emailSyncTimer: null
    };

    // ۱. تزریق سیستم طراحی جدید (حذف ظاهر نئونی هوش مصنوعی + پالت روز و شب + انیمیشن‌های هاور)
    const themeStyle = document.createElement('style');
    themeStyle.id = 'tilo-human-design-system';
    themeStyle.textContent = `
        /* انیمیشن‌های نرم و میکرو-اینتراکشن‌ها */
        * {
            transition: background-color 0.25s ease, border-color 0.25s ease, color 0.2s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
        }
        .soft-card {
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease !important;
        }
        .soft-card:hover {
            transform: translateY(-2px);
        }
        .btn-calm {
            position: relative;
            overflow: hidden;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .btn-calm:hover {
            transform: translateY(-1.5px);
            filter: brightness(1.05);
        }
        .btn-calm:active {
            transform: translateY(0) scale(0.97) !important;
        }

        /* ==========================================
           پالت شب مات و حرفه‌ای (بدون گرادینت نئونی)
           ========================================== */
        body.tilo-theme-night {
            background-color: #131519 !important;
            background-image: none !important;
            color: #e4e4e7 !important;
        }
        body.tilo-theme-night .soft-card,
        body.tilo-theme-night nav.soft-card,
        body.tilo-theme-night header {
            background: #1b1e24 !important;
            backdrop-filter: none !important;
            border: 1px solid #2a2e37 !important;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28) !important;
        }
        body.tilo-theme-night .soft-card:hover {
            border-color: #383d49 !important;
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.38) !important;
        }
        body.tilo-theme-night .input-calm {
            background: #131519 !important;
            border: 1px solid #2e333d !important;
            color: #f4f4f5 !important;
        }
        body.tilo-theme-night .input-calm:focus {
            border-color: #5b7cfa !important;
            box-shadow: 0 0 0 3px rgba(91, 124, 250, 0.15) !important;
        }
        body.tilo-theme-night .tilo-timer-pro-card {
            background: #1b1e24 !important;
            border: 1px solid #323744 !important;
            box-shadow: 0 12px 32px rgba(0,0,0,0.4) !important;
        }
        body.tilo-theme-night .tilo-timer-pro-card::before {
            display: none !important;
        }
        body.tilo-theme-night .tilo-timer-digits-glow {
            text-shadow: none !important;
        }

        /* ==========================================
           پالت روز کاغذی گرم و چشم‌نواز (Warm Paper Day)
           ========================================== */
        body.tilo-theme-day {
            background-color: #f3f1ec !important;
            background-image: none !important;
            color: #1f2937 !important;
        }
        body.tilo-theme-day .soft-card,
        body.tilo-theme-day nav.soft-card,
        body.tilo-theme-day header {
            background: #ffffff !important;
            backdrop-filter: none !important;
            border: 1px solid #e5e0d8 !important;
            box-shadow: 0 4px 14px rgba(28, 25, 23, 0.04) !important;
        }
        body.tilo-theme-day .soft-card:hover {
            border-color: #d6cfc2 !important;
            box-shadow: 0 10px 24px rgba(28, 25, 23, 0.08) !important;
        }
        body.tilo-theme-day .text-white {
            color: #111827 !important;
        }
        body.tilo-theme-day .text-slate-200,
        body.tilo-theme-day .text-slate-300 {
            color: #374151 !important;
        }
        body.tilo-theme-day .text-slate-400,
        body.tilo-theme-day .text-slate-500 {
            color: #6b7280 !important;
        }
        body.tilo-theme-day .bg-slate-900,
        body.tilo-theme-day .bg-slate-900\\/50,
        body.tilo-theme-day .bg-slate-900\\/60,
        body.tilo-theme-day .bg-slate-900\\/70,
        body.tilo-theme-day .bg-slate-900\\/75,
        body.tilo-theme-day .bg-slate-900\\/80,
        body.tilo-theme-day .bg-slate-900\\/90,
        body.tilo-theme-day .bg-slate-950 {
            background-color: #f8f6f2 !important;
            border-color: #e5e0d8 !important;
        }
        body.tilo-theme-day .bg-slate-800,
        body.tilo-theme-day .bg-slate-800\\/40,
        body.tilo-theme-day .bg-slate-800\\/70,
        body.tilo-theme-day .bg-slate-800\\/80 {
            background-color: #edeae2 !important;
            color: #1f2937 !important;
            border-color: #dcd6c8 !important;
        }
        body.tilo-theme-day .border-slate-800,
        body.tilo-theme-day .border-slate-700,
        body.tilo-theme-day .border-slate-700\\/70 {
            border-color: #e5e0d8 !important;
        }
        body.tilo-theme-day .input-calm {
            background: #faf9f6 !important;
            border: 1px solid #d6cfc2 !important;
            color: #111827 !important;
        }
        body.tilo-theme-day .input-calm:focus {
            background: #ffffff !important;
            border-color: #4f46e5 !important;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12) !important;
        }
        body.tilo-theme-day .tilo-drawer-panel {
            background: #fcfbf9 !important;
            border-left: 1px solid #e5e0d8 !important;
        }
        body.tilo-theme-day .tilo-hamburger-btn {
            background: #ffffff !important;
            border: 1px solid #d6cfc2 !important;
            color: #1f2937 !important;
        }
        body.tilo-theme-day .tilo-timer-pro-card {
            background: #ffffff !important;
            border: 1px solid #d6cfc2 !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05) !important;
        }
        body.tilo-theme-day .tilo-timer-digits-glow {
            text-shadow: none !important;
            color: #111827 !important;
        }
        body.tilo-theme-day .bg-primary .text-white,
        body.tilo-theme-day button.bg-primary {
            color: #ffffff !important;
        }

        /* دکمه سوییچ روز و شب */
        .tilo-theme-switch-btn {
            padding: 0.45rem 0.75rem;
            border-radius: 0.75rem;
            font-size: 11px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            cursor: pointer;
            border: 1px solid rgba(148, 163, 184, 0.25);
        }

        /* انیمیشن باز شدن بخش‌ها */
        @keyframes tiloFadeSlideUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        main > div {
            animation: tiloFadeSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
    `;
    document.head.appendChild(themeStyle);

    function applyTheme(mode) {
        window.TiloPro.theme = mode;
        localStorage.setItem('tilo_ui_theme', mode);
        document.body.classList.remove('tilo-theme-day', 'tilo-theme-night');
        document.body.classList.add(mode === 'day' ? 'tilo-theme-day' : 'tilo-theme-night');

        const btn = document.getElementById('tilo-theme-toggle-btn');
        if (btn) {
            if (mode === 'day') {
                btn.innerHTML = '<i class="fas fa-moon text-indigo-600"></i> <span>حالت شب</span>';
                btn.className = 'tilo-theme-switch-btn bg-stone-200/80 text-stone-800 hover:bg-stone-300/80';
            } else {
                btn.innerHTML = '<i class="fas fa-sun text-amber-400"></i> <span>حالت روز</span>';
                btn.className = 'tilo-theme-switch-btn bg-slate-800 text-slate-200 hover:bg-slate-700';
            }
        }
    }

    // ۲. راه‌اندازی هدر، دکمه تغییر تم و سیستم احراز هویت ایمیلی
    const waitApp = setInterval(() => {
        const state = window.TiloPlus && window.TiloPlus.vueState;
        const headerEl = document.querySelector('main header');
        if (state && document.body && headerEl) {
            clearInterval(waitApp);
            applyTheme(window.TiloPro.theme);
            injectHeaderControls(state, headerEl);
            buildEmailVerificationSystem(state);
        }
    }, 250);

    function injectHeaderControls(state, headerEl) {
        const leftActionGroup = headerEl.lastElementChild;
        if (!leftActionGroup || document.getElementById('tilo-theme-toggle-btn')) return;

        // دکمه سوییچ روز و شب
        const themeBtn = document.createElement('button');
        themeBtn.id = 'tilo-theme-toggle-btn';
        themeBtn.type = 'button';
        themeBtn.addEventListener('click', () => {
            applyTheme(window.TiloPro.theme === 'day' ? 'night' : 'day');
        });
        leftActionGroup.insertBefore(themeBtn, leftActionGroup.firstChild);
        applyTheme(window.TiloPro.theme);

        // دکمه وضعیت ایمیل در هدر
        const emailBtn = document.createElement('button');
        emailBtn.id = 'tilo-header-email-btn';
        emailBtn.type = 'button';
        emailBtn.className = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/70 border border-slate-700/70 text-[11px] hover:border-indigo-400';
        emailBtn.addEventListener('click', () => {
            window.TiloPro.openEmailModal();
        });
        leftActionGroup.insertBefore(emailBtn, leftActionGroup.firstChild);
        updateEmailBadgeUI();
    }

    function updateEmailBadgeUI() {
        const emailBtn = document.getElementById('tilo-header-email-btn');
        const verified = window.TiloPro.verifiedEmail;
        if (emailBtn) {
            if (verified) {
                emailBtn.innerHTML = `<i class="fas fa-envelope-circle-check text-emerald-500"></i> <span class="text-slate-300 font-bold max-w-[110px] truncate" dir="ltr">${verified}</span>`;
            } else {
                emailBtn.innerHTML = `<i class="fas fa-envelope text-amber-400"></i> <span class="text-slate-300 font-bold">تایید ایمیل</span>`;
            }
        }
    }

    // ۳. سیستم تایید کد ایمیل (OTP) و ذخیره‌سازی اختصاصی روی ایمیل هر شخص
    function buildEmailVerificationSystem(state) {
        if (document.getElementById('tilo-email-otp-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'tilo-email-otp-modal';
        modal.className = 'fixed inset-0 z-[100100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 hidden select-none';
        modal.innerHTML = `
            <div class="soft-card w-full max-w-md rounded-3xl p-6 md:p-7 border border-slate-700 shadow-2xl space-y-5 text-right">
                <div class="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                            <i class="fas fa-shield-halved text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-white text-sm md:text-base">حساب ایمیل و ذخیره‌سازی اختصاصی</h3>
                            <p class="text-[11px] text-slate-400">تمام پارت‌ها و آمار شما روی ایمیل شخصی‌تان قفل و ذخیره می‌شود</p>
                        </div>
                    </div>
                    <button type="button" id="tilo-email-modal-close" class="text-slate-400 hover:text-white p-1.5">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- وضعیت ایمیل فعلی -->
                <div id="tilo-email-current-box" class="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 hidden">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="text-[10px] text-emerald-400 font-bold block">● ایمیل تایید شده فعال:</span>
                            <strong id="tilo-email-current-Address" class="text-xs text-white font-mono" dir="ltr"></strong>
                        </div>
                        <button type="button" id="tilo-email-change-btn" class="text-[11px] text-rose-400 hover:underline font-bold">تغییر حساب</button>
                    </div>
                </div>

                <!-- گام اول: دریافت آدرس ایمیل -->
                <div id="tilo-email-step-1" class="space-y-3.5">
                    <div>
                        <label class="block text-xs text-slate-300 mb-1.5 font-bold">آدرس ایمیل خود را وارد کنید:</label>
                        <input type="email" id="tilo-email-input" dir="ltr" placeholder="name@gmail.com" class="input-calm text-xs font-mono text-center">
                    </div>
                    <button type="button" id="tilo-send-otp-btn" class="btn-calm bg-primary text-white text-xs w-full py-3 font-bold">
                        <i class="fas fa-paper-plane"></i> ارسال کد تایید ۶ رقمی به ایمیل
                    </button>
                </div>

                <!-- گام دوم: وارد کردن کد تایید ۶ رقمی -->
                <div id="tilo-email-step-2" class="space-y-3.5 hidden">
                    <div id="tilo-otp-status-banner" class="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-3 text-xs text-slate-200 leading-relaxed"></div>
                    <div>
                        <label class="block text-xs text-slate-300 mb-1.5 font-bold">کد تایید ۶ رقمی را وارد کنید:</label>
                        <input type="text" id="tilo-otp-input" dir="ltr" maxlength="6" placeholder="• • • • • •" class="input-calm text-base font-mono font-black text-center tracking-[0.4em]">
                    </div>
                    <div class="flex gap-2">
                        <button type="button" id="tilo-verify-otp-btn" class="btn-calm bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex-1 py-3 font-bold">
                            <i class="fas fa-check-circle"></i> تایید کد و بازیابی/ذخیره اطلاعات
                        </button>
                        <button type="button" id="tilo-back-step1-btn" class="btn-calm bg-slate-800 text-slate-300 text-xs py-3 px-3">
                            ویرایش ایمیل
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const step1 = document.getElementById('tilo-email-step-1');
        const step2 = document.getElementById('tilo-email-step-2');
        const currentBox = document.getElementById('tilo-email-current-box');
        const currentAddr = document.getElementById('tilo-email-current-Address');
        const emailInput = document.getElementById('tilo-email-input');
        const otpInput = document.getElementById('tilo-otp-input');
        const banner = document.getElementById('tilo-otp-status-banner');

        window.TiloPro.openEmailModal = function() {
            if (window.TiloPro.verifiedEmail) {
                currentBox.classList.remove('hidden');
                currentAddr.textContent = window.TiloPro.verifiedEmail;
                emailInput.value = window.TiloPro.verifiedEmail;
            } else {
                currentBox.classList.add('hidden');
            }
            step1.classList.remove('hidden');
            step2.classList.add('hidden');
            modal.classList.remove('hidden');
        };

        document.getElementById('tilo-email-modal-close').addEventListener('click', () => modal.classList.add('hidden'));
        document.getElementById('tilo-email-change-btn').addEventListener('click', () => {
            emailInput.value = '';
            emailInput.focus();
        });
        document.getElementById('tilo-back-step1-btn').addEventListener('click', () => {
            step2.classList.add('hidden');
            step1.classList.remove('hidden');
        });

        // ارسال کد ۶ رقمی
        document.getElementById('tilo-send-otp-btn').addEventListener('click', async () => {
            const rawEmail = (emailInput.value || '').trim().toLowerCase();
            if (!rawEmail || !rawEmail.includes('@') || !rawEmail.includes('.')) {
                alert('لطفاً یک آدرس ایمیل معتبر وارد کنید.');
                return;
            }

            window.TiloPro.pendingEmail = rawEmail;
            const code = String(Math.floor(100000 + Math.random() * 900000));
            window.TiloPro.generatedCode = code;

            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            otpInput.value = '';

            banner.innerHTML = `
                <div class="flex items-center justify-between mb-1">
                    <span class="text-indigo-300 font-bold">ایمیل مقصد: <span dir="ltr">${rawEmail}</span></span>
                    <span class="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-bold">کد امنیتی آماده</span>
                </div>
                <p class="text-[11px] text-slate-300">کد تایید یک‌بارمصرف حساب شما: <strong class="text-sm text-amber-400 font-mono tracking-widest px-1.5 py-0.5 bg-slate-950 rounded">${code}</strong></p>
            `;

            // در صورت تنظیم بودن سرویس ایمیل خارجی (EmailJS) به ایمیل واقعی هم ارسال می‌شود
            const ejsCfg = localStorage.getItem('tilo_emailjs_cfg');
            if (ejsCfg) {
                try {
                    const parsed = JSON.parse(ejsCfg);
                    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            service_id: parsed.serviceId,
                            template_id: parsed.templateId,
                            user_id: parsed.publicKey,
                            template_params: { to_email: rawEmail, otp_code: code, user_name: state.settings.userName || 'کاربر' }
                        })
                    });
                } catch (e) {}
            }
        });

        // تایید کد ۶ رقمی و اتصال دیتابیس به ایمیل شخص
        document.getElementById('tilo-verify-otp-btn').addEventListener('click', async () => {
            const entered = (otpInput.value || '').trim();
            if (entered !== window.TiloPro.generatedCode) {
                alert('کد وارد شده صحیح نیست. لطفاً کد ۶ رقمی نمایش داده شده را با دقت وارد کنید.');
                return;
            }

            const email = window.TiloPro.pendingEmail;
            window.TiloPro.verifiedEmail = email;
            localStorage.setItem('tilo_verified_email', email);

            await syncDataWithVerifiedEmail(state, email, true);
            updateEmailBadgeUI();
            modal.classList.add('hidden');
            alert(`ایمیل ${email} با موفقیت تایید شد و اطلاعات شما روی این ایمیل قفل و همگام‌سازی گردید.`);
        });

        // افزودن فیلد ایمیل به مودال خوش‌آمدگویی اولیه و صفحه تنظیمات
        injectEmailIntoWelcomeAndSettings(state);

        // اگر کاربر قبلاً ایمیلش را تایید کرده، اطلاعاتش را با همان ایمیل همگام کن
        if (window.TiloPro.verifiedEmail) {
            syncDataWithVerifiedEmail(state, window.TiloPro.verifiedEmail, false);
        } else if (!state.settings.onboarded) {
            setTimeout(() => window.TiloPro.openEmailModal(), 1200);
        }
    }

    // ۴. ذخیره‌سازی و بازیابی اطلاعات به تفکیک هر ایمیل (در مرورگر و در فضای ابری فایربیس)
    async function syncDataWithVerifiedEmail(state, email, isInitialSwitch) {
        if (!email) return;
        const emailKey = email.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const localVaultKey = `tilo_vault_${emailKey}`;

        // الف) بررسی صندوق ذخیره محلی مخصوص این ایمیل
        const savedVaultRaw = localStorage.getItem(localVaultKey);
        if (savedVaultRaw && isInitialSwitch) {
            try {
                const vault = JSON.parse(savedVaultRaw);
                if (Array.isArray(vault.parts) && vault.parts.length > 0) {
                    // ادغام پارت‌های قبلی این ایمیل با پارت‌های فعلی
                    const map = new Map();
                    (state.parts || []).forEach(p => map.set(p.id, p));
                    vault.parts.forEach(p => map.set(p.id, p));
                    state.parts = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
                    localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                }
                if (vault.settings) {
                    state.settings = { ...state.settings, ...vault.settings, onboarded: true };
                    localStorage.setItem('sp_pro_settings', JSON.stringify(state.settings));
                }
                if (vault.weeklyParts) {
                    localStorage.setItem('tilo_weekly_parts', JSON.stringify(vault.weeklyParts));
                    if (window.TiloPlus && typeof window.TiloPlus.renderWeeklyCalendar === 'function') {
                        window.TiloPlus.renderWeeklyCalendar();
                    }
                }
            } catch (e) {}
        }

        // ب) ذخیره خودکار هر تغییر در صندوق اختصاصی این ایمیل + فایربیس
        function saveCurrentStateToEmailVault() {
            const activeEmail = window.TiloPro.verifiedEmail;
            if (!activeEmail) return;
            const key = activeEmail.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const payload = {
                email: activeEmail,
                parts: state.parts || [],
                settings: state.settings || {},
                weeklyParts: JSON.parse(localStorage.getItem('tilo_weekly_parts') || '{}'),
                updatedAt: Date.now()
            };
            localStorage.setItem(`tilo_vault_${key}`, JSON.stringify(payload));
            pushEmailVaultToFirestore(key, payload);
        }

        // ج) اتصال به فایربیس بر اساس کلید ایمیل (حتی بدون لاگین گوگل اگر فایربیس وصل باشد)
        async function pushEmailVaultToFirestore(docKey, payload) {
            try {
                const rawCfg = localStorage.getItem('tilo_fb_config') || state.firebaseConfigInput;
                if (!rawCfg || !window.FirebaseSDK) return;
                const fb = window.FirebaseSDK;
                const cfg = JSON.parse(rawCfg);
                const app = fb.initializeApp(cfg, 'tilo-email-app');
                const db = fb.getFirestore(app);
                const docRef = fb.doc(db, 'tilo_email_accounts', docKey);
                await fb.setDoc(docRef, JSON.parse(JSON.stringify(payload)), { merge: true });
            } catch (e) {}
        }

        async function pullEmailVaultFromFirestore(docKey) {
            try {
                const rawCfg = localStorage.getItem('tilo_fb_config') || state.firebaseConfigInput;
                if (!rawCfg || !window.FirebaseSDK) return;
                const fb = window.FirebaseSDK;
                const cfg = JSON.parse(rawCfg);
                const app = fb.initializeApp(cfg, 'tilo-email-app');
                const db = fb.getFirestore(app);
                const docRef = fb.doc(db, 'tilo_email_accounts', docKey);
                const snap = await fb.getDoc(docRef);
                if (snap.exists()) {
                    const cloudData = snap.data();
                    if (Array.isArray(cloudData.parts)) {
                        const map = new Map();
                        (state.parts || []).forEach(p => map.set(p.id, p));
                        cloudData.parts.forEach(p => map.set(p.id, p));
                        state.parts = Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
                        localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                    }
                    if (cloudData.settings) {
                        state.settings = { ...state.settings, ...cloudData.settings, onboarded: true };
                        localStorage.setItem('sp_pro_settings', JSON.stringify(state.settings));
                    }
                }
            } catch (e) {}
        }

        await pullEmailVaultFromFirestore(emailKey);
        saveCurrentStateToEmailVault();

        if (window.TiloPro.emailSyncTimer) clearInterval(window.TiloPro.emailSyncTimer);
        window.TiloPro.emailSyncTimer = setInterval(saveCurrentStateToEmailVault, 4000);
    }

    function injectEmailIntoWelcomeAndSettings(state) {
        // افزودن کارت مدیریت ایمیل در تب تنظیمات
        const settingsDivs = Array.from(document.querySelectorAll('main > div')).filter(d => d.innerHTML.includes('تنظیمات حساب کاربری'));
        const settingsTab = settingsDivs[0];
        if (settingsTab && !document.getElementById('tilo-settings-email-card')) {
            const card = document.createElement('div');
            card.id = 'tilo-settings-email-card';
            card.className = 'soft-card p-5 rounded-3xl border border-indigo-500/25 space-y-3 mt-4';
            card.innerHTML = `
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h4 class="font-bold text-white text-xs md:text-sm flex items-center gap-2">
                            <i class="fas fa-envelope-open-text text-primarySoft"></i> تایید ایمیل و ذخیره‌سازی اختصاصی اطلاعات
                        </h4>
                        <p class="text-[11px] text-slate-400 mt-0.5">با تایید کد ایمیل، تمام اطلاعات شما به آدرس ایمیلتان متصل می‌شود.</p>
                    </div>
                    <button type="button" id="tilo-settings-open-email-btn" class="btn-calm bg-primary text-white text-xs py-2 px-4">
                        <i class="fas fa-key"></i> مدیریت و تایید کد ایمیل
                    </button>
                </div>
            `;
            settingsTab.firstElementChild.appendChild(card);
            document.getElementById('tilo-settings-open-email-btn').addEventListener('click', () => {
                window.TiloPro.openEmailModal();
            });
        }
    }
})();
/**
 * Tilo Pro Suite - Part 2/4
 * ۱. ارتقای فرم برنامه هفتگی (دقیقاً مشابه بخش پارت‌ها با چنددرس، نوع فعالیت، توضیحات و غیردرسی)
 * ۲. نمایش متن و توضیحات کامل برای پارت‌های درسی و غیردرسی در صف انتظار + قابلیت ویرایش یادداشت هر تسک
 */
(function initTiloProPart2() {
    const waitPart2 = setInterval(() => {
        const state = window.TiloPlus && window.TiloPlus.vueState;
        const mainEl = document.querySelector('main');
        if (state && mainEl) {
            clearInterval(waitPart2);
            patchPartCreationAndDescriptions(state);
            upgradeWeeklyPlannerToFullForm(state, mainEl);
            startPendingTasksDescriptionInjector(state);
        }
    }, 300);

    // ۱. اصلاح ثبت مستقیم و افزودن قابلیت ویرایش متن/توضیحات برای تمام پارت‌های درسی و غیردرسی
    function patchPartCreationAndDescriptions(state) {
        // اطمینان از ذخیره شدن توضیحات و نوع فعالیت در ثبت مستقیم
        state.openDirectCompleteModal = function() {
            const np = state.newPart;
            if ((!np.isNonStudy && (!np.subjects || np.subjects.length === 0)) || !np.topic) {
                alert('لطفاً اطلاعات پارت (درس یا عنوان فعالیت) را کامل کنید.');
                return;
            }
            const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
            const todayFa = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(new Date());

            state.parts.unshift({
                id: Date.now(),
                dateISO: todayISO,
                dateStr: todayFa,
                isNonStudy: np.isNonStudy || false,
                subjects: np.isNonStudy ? [] : [...np.subjects],
                topic: np.topic.trim(),
                description: (np.description || '').trim(),
                type: np.isNonStudy ? 'سایر کارهای شخصی' : (np.type || 'آموزشی / مطالعاتی'),
                plannedTime: np.plannedTime || 60,
                realTime: np.plannedTime || 60,
                status: 'completed',
                completedAt: Date.now(),
                tests: { correct: 0, wrong: 0, total: 0 }
            });

            localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
            state.newPart = {
                isNonStudy: false,
                subjects: [],
                topic: '',
                description: '',
                type: 'آموزشی / مطالعاتی',
                plannedTime: 60
            };
            state.currentTab = 'dashboard';
        };

        // تبدیل فیلد توضیحات بخش پارت‌ها به کادر متنی راحت‌تر برای نوشتن جزئیات تسک‌ها
        const descInputs = document.querySelectorAll('input[placeholder*="حل تست"]');
        descInputs.forEach(inp => {
            inp.setAttribute('placeholder', 'متن، یادداشت یا جزئیات انجام این پارت درسی یا تسک غیردرسی را بنویسید...');
        });
    }

    // ۲. نمایش توضیحات متنی تسک‌ها (درسی و غیردرسی) در لیست‌های در انتظار انجام + دکمه ویرایش متن
    function startPendingTasksDescriptionInjector(state) {
        setInterval(() => {
            if (!Array.isArray(state.pendingParts)) return;

            // پیدا کردن کارت‌های پارت‌های در انتظار در تب پارت‌ها و داشبورد
            const allCards = document.querySelectorAll('main .bg-slate-900\\/75, main .bg-slate-900\\/70');
            allCards.forEach(card => {
                const titleEl = card.querySelector('h4, p.text-sm.font-bold');
                if (!titleEl) return;

                const titleText = titleEl.textContent.trim();
                const matchedPart = state.pendingParts.find(p => p.topic === titleText);
                if (!matchedPart) return;

                let noteBox = card.querySelector('.tilo-task-desc-box');
                if (!noteBox) {
                    noteBox = document.createElement('div');
                    noteBox.className = 'tilo-task-desc-box mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs';
                    titleEl.parentElement.appendChild(noteBox);
                }

                const currentDesc = (matchedPart.description || '').trim();
                const sig = `${matchedPart.id}_${currentDesc}`;
                if (noteBox.getAttribute('data-sig') !== sig) {
                    noteBox.setAttribute('data-sig', sig);
                    noteBox.innerHTML = `
                        <div class="text-slate-300 leading-relaxed flex-1">
                            ${currentDesc
                                ? `<i class="fas fa-align-right text-tealSoft ml-1.5"></i><span>${currentDesc}</span>`
                                : `<span class="text-slate-500 text-[11px] italic">بدون توضیحات متنی</span>`
                            }
                        </div>
                        <button type="button" class="tilo-edit-desc-btn text-[11px] text-primarySoft hover:underline font-bold shrink-0 flex items-center gap-1">
                            <i class="fas fa-pen text-[10px]"></i> ${currentDesc ? 'ویرایش متن' : '+ افزودن متن'}
                        </button>
                    `;

                    const editBtn = noteBox.querySelector('.tilo-edit-desc-btn');
                    if (editBtn) {
                        editBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const updated = prompt(`متن و توضیحات برای «${matchedPart.topic}»:`, matchedPart.description || '');
                            if (updated !== null) {
                                matchedPart.description = updated.trim();
                                localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                                noteBox.removeAttribute('data-sig');
                            }
                        });
                    }
                }
            });
        }, 600);
    }

    // ۳. ارتقای کامل بخش برنامه هفتگی با فرم جامع مشابه تب پارت‌ها
    function upgradeWeeklyPlannerToFullForm(state, mainEl) {
        const waitExt = setInterval(() => {
            const calExt = document.getElementById('tilo-calendar-pro-extension');
            if (calExt) {
                clearInterval(waitExt);
                buildFullWeeklyPlanner(state, calExt);
            }
        }, 250);
    }

    function buildFullWeeklyPlanner(state, calExt) {
        const daysOfWeek = [
            { id: 'sat', name: 'شنبه' },
            { id: 'sun', name: 'یکشنبه' },
            { id: 'mon', name: 'دوشنبه' },
            { id: 'tue', name: 'سه‌شنبه' },
            { id: 'wed', name: 'چهارشنبه' },
            { id: 'thu', name: 'پنج‌شنبه' },
            { id: 'fri', name: 'جمعه' }
        ];

        let activeDayId = 'sat';
        let formIsNonStudy = false;
        let selectedSubjects = [];
        let dropdownOpen = false;

        function getWeeklyStorage() {
            try { return JSON.parse(localStorage.getItem('tilo_weekly_parts') || '{}'); }
            catch (e) { return {}; }
        }

        function saveWeeklyStorage(obj) {
            localStorage.setItem('tilo_weekly_parts', JSON.stringify(obj));
        }

        calExt.innerHTML = `
            <!-- نوار انتخاب روزهای هفته -->
            <div class="soft-card p-5 md:p-6 rounded-3xl border border-indigo-500/20 space-y-4">
                <div class="flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <h3 class="text-base md:text-lg font-extrabold text-white flex items-center gap-2">
                            <i class="fas fa-calendar-check text-sage"></i> برنامه‌ریز جامع هفتگی (پارت‌های درسی و تسک‌های شخصی)
                        </h3>
                        <p class="text-xs text-slate-400 mt-1">روز مورد نظر را انتخاب کنید و دقیقاً با تمام امکانات بخش پارت‌ها برای آن روز برنامه‌ریزی کنید.</p>
                    </div>
                </div>
                <div id="tilo-pro-cal-days" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2"></div>
            </div>

            <!-- فرم کامل تعریف پارت مخصوص روز انتخاب‌شده (دقیقاً مشابه تب پارت‌ها) -->
            <div class="soft-card p-5 md:p-6 rounded-3xl border border-primary/20 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <h4 class="text-sm md:text-base font-extrabold text-white flex items-center gap-2">
                        <i class="fas fa-plus-circle text-primarySoft"></i>
                        <span>تعریف پارت یا تسک جدید برای روز:</span>
                        <span id="tilo-pro-cal-active-day-badge" class="bg-primary/20 text-primarySoft px-3 py-0.5 rounded-xl text-xs font-black">شنبه</span>
                    </h4>
                </div>

                <!-- دکمه تفکیک پارت درسی و کار غیر درسی -->
                <div class="flex gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 w-fit">
                    <button type="button" id="tilo-wform-btn-study" class="px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 bg-primary text-white font-bold shadow">
                        <i class="fas fa-book"></i> پارت درسی
                    </button>
                    <button type="button" id="tilo-wform-btn-nonstudy" class="px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 text-slate-400 hover:text-white">
                        <i class="fas fa-coffee"></i> کار غیر درسی / تسک شخصی
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- انتخاب چندگانه درس‌ها -->
                    <div class="relative" id="tilo-wform-subject-wrapper">
                        <label class="block text-xs text-slate-300 mb-1.5 font-medium">انتخاب درس (امکان انتخاب چند درس) *</label>
                        <button type="button" id="tilo-wform-dropdown-btn" class="input-calm flex justify-between items-center text-right text-xs md:text-sm">
                            <span id="tilo-wform-selected-label" class="truncate text-slate-400">انتخاب درس‌ها...</span>
                            <i class="fas fa-chevron-down text-slate-400"></i>
                        </button>
                        <div id="tilo-wform-dropdown-menu" class="hidden absolute z-50 left-0 right-0 mt-2 soft-card bg-[#162032] rounded-2xl p-3 max-h-72 overflow-y-auto border border-slate-700 shadow-2xl">
                            <div class="flex justify-between items-center pb-2 mb-2 border-b border-slate-700">
                                <span id="tilo-wform-subject-count" class="text-xs text-slate-400">0 درس</span>
                                <button type="button" id="tilo-wform-dropdown-close" class="text-xs bg-primary text-white px-3 py-1 rounded-lg">تأیید</button>
                            </div>
                            <div id="tilo-wform-subject-groups"></div>
                        </div>
                    </div>

                    <!-- عنوان دقیق مبحث یا تسک -->
                    <div>
                        <label class="block text-xs text-slate-300 mb-1.5 font-medium">عنوان دقیق (مبحث / فعالیت) *</label>
                        <input type="text" id="tilo-wform-topic" class="input-calm text-xs md:text-sm" placeholder="مثلاً: حرکت بر خط راست / تمرین طراحی رابط کاربری">
                    </div>

                    <!-- توضیحات کامل متنی -->
                    <div class="md:col-span-2">
                        <label class="block text-xs text-slate-300 mb-1.5 font-medium">متن و توضیحات تسک (اختیاری)</label>
                        <input type="text" id="tilo-wform-desc" class="input-calm text-xs md:text-sm" placeholder="مثلاً: حل تست‌های مضرب ۳ + مرور خلاصه‌نویسی‌ها...">
                    </div>

                    <!-- نوع فعالیت و مدت زمان -->
                    <div class="grid grid-cols-2 gap-2.5 md:col-span-2">
                        <div>
                            <label class="block text-xs text-slate-300 mb-1.5 font-medium">نوع فعالیت</label>
                            <select id="tilo-wform-type" class="input-calm text-xs">
                                <option value="آموزشی / مطالعاتی">آموزشی / مطالعاتی</option>
                                <option value="تست و تمرین">تست و تمرین</option>
                                <option value="مرور و جمع‌بندی">مرور و جمع‌بندی</option>
                                <option value="سایر کارهای شخصی">سایر کارهای شخصی (غیردرسی)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-slate-300 mb-1.5 font-medium">مدت زمان (دقیقه)</label>
                            <input type="number" id="tilo-wform-time" value="60" min="5" max="400" class="input-calm text-xs font-bold text-center">
                        </div>
                    </div>
                </div>

                <!-- دکمه‌های ثبت در برنامه هفتگی یا ارسال هم‌زمان به امروز -->
                <div class="flex flex-wrap gap-3 pt-2">
                    <button type="button" id="tilo-wform-submit-day" class="btn-calm bg-primary text-white text-xs md:text-sm flex-1 py-3">
                        <i class="fas fa-calendar-plus"></i> افزودن به برنامه این روز
                    </button>
                    <button type="button" id="tilo-wform-submit-both" class="btn-calm bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs md:text-sm border border-slate-700 py-3">
                        <i class="fas fa-bolt text-tealSoft"></i> افزودن به این روز + صف در انتظار امروز
                    </button>
                </div>
            </div>

            <!-- لیست پارت‌های ثبت‌شده برای روز انتخاب‌شده -->
            <div class="soft-card p-5 md:p-6 rounded-3xl space-y-4">
                <div class="flex justify-between items-center">
                    <h4 class="font-bold text-white text-sm md:text-base flex items-center gap-2">
                        <i class="fas fa-list-ul text-amberSoft"></i>
                        <span>پارت‌ها و تسک‌های برنامه‌ریزی‌شده برای</span>
                        <span id="tilo-pro-cal-list-day-name" class="text-tealSoft">شنبه</span>
                    </h4>
                </div>
                <div id="tilo-pro-cal-parts-list" class="space-y-3"></div>
            </div>
        `;

        // ساخت چک‌باکس‌های دروس از روی subjectGroups اصلی برنامه
        const groupsContainer = document.getElementById('tilo-wform-subject-groups');
        const groupsData = state.subjectGroups || [
            { category: 'ریاضیات کنکور', items: ['ریاضیات پایه', 'حسابان', 'جبر و احتمال', 'هندسه'] },
            { category: 'علوم پایه', items: ['فیزیک', 'شیمی'] },
            { category: 'عمومی', items: ['فارسی', 'عربی', 'دین و زندگی', 'زبان انگلیسی'] }
        ];

        function renderSubjectCheckboxes() {
            if (!groupsContainer) return;
            groupsContainer.innerHTML = groupsData.map(g => `
                <div class="mb-3">
                    <div class="text-xs font-bold text-tealSoft bg-slate-900/90 px-2.5 py-1.5 rounded-lg mb-1.5">${g.category}</div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 pr-1">
                        ${g.items.map(sub => `
                            <label class="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-800/70 cursor-pointer text-xs transition">
                                <input type="checkbox" value="${sub}" class="tilo-wform-sub-cb w-4 h-4 accent-indigo-500 rounded" ${selectedSubjects.includes(sub) ? 'checked' : ''}>
                                <span class="text-slate-200">${sub}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `).join('');

            groupsContainer.querySelectorAll('.tilo-wform-sub-cb').forEach(cb => {
                cb.addEventListener('change', () => {
                    const val = cb.value;
                    if (cb.checked) {
                        if (!selectedSubjects.includes(val)) selectedSubjects.push(val);
                    } else {
                        selectedSubjects = selectedSubjects.filter(x => x !== val);
                    }
                    updateSubjectLabel();
                });
            });
        }

        function updateSubjectLabel() {
            const lbl = document.getElementById('tilo-wform-selected-label');
            const cnt = document.getElementById('tilo-wform-subject-count');
            if (lbl) {
                lbl.textContent = selectedSubjects.length ? selectedSubjects.join(' ، ') : 'انتخاب درس‌ها...';
                lbl.className = selectedSubjects.length ? 'truncate text-white font-bold' : 'truncate text-slate-400';
            }
            if (cnt) cnt.textContent = `${selectedSubjects.length} درس`;
        }

        renderSubjectCheckboxes();

        // مدیریت باز و بسته شدن منوی دروس در برنامه هفتگی
        const dropBtn = document.getElementById('tilo-wform-dropdown-btn');
        const dropMenu = document.getElementById('tilo-wform-dropdown-menu');
        const dropClose = document.getElementById('tilo-wform-dropdown-close');

        dropBtn.addEventListener('click', () => {
            dropdownOpen = !dropdownOpen;
            dropMenu.classList.toggle('hidden', !dropdownOpen);
        });
        dropClose.addEventListener('click', () => {
            dropdownOpen = false;
            dropMenu.classList.add('hidden');
        });

        // مدیریت سوییچ پارت درسی و کار غیردرسی در برنامه هفتگی
        const btnStudy = document.getElementById('tilo-wform-btn-study');
        const btnNonStudy = document.getElementById('tilo-wform-btn-nonstudy');
        const subWrapper = document.getElementById('tilo-wform-subject-wrapper');
        const typeSelect = document.getElementById('tilo-wform-type');

        btnStudy.addEventListener('click', () => {
            formIsNonStudy = false;
            btnStudy.className = 'px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 bg-primary text-white font-bold shadow';
            btnNonStudy.className = 'px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 text-slate-400 hover:text-white';
            subWrapper.classList.remove('hidden');
            if (typeSelect.value === 'سایر کارهای شخصی') typeSelect.value = 'آموزشی / مطالعاتی';
        });

        btnNonStudy.addEventListener('click', () => {
            formIsNonStudy = true;
            btnNonStudy.className = 'px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 bg-amberSoft text-slate-900 font-bold shadow';
            btnStudy.className = 'px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 text-slate-400 hover:text-white';
            subWrapper.classList.add('hidden');
            typeSelect.value = 'سایر کارهای شخصی';
        });

        // تابع ذخیره پارت در روز هفته (و در صورت درخواست، ارسال هم‌زمان به لیست انتظار امروز)
        function handleAddWeeklyPart(alsoSendToTodayQueue) {
            const topicEl = document.getElementById('tilo-wform-topic');
            const descEl = document.getElementById('tilo-wform-desc');
            const timeEl = document.getElementById('tilo-wform-time');

            const topic = (topicEl.value || '').trim();
            const description = (descEl.value || '').trim();
            const plannedTime = parseInt(timeEl.value, 10) || 60;
            const actType = typeSelect.value;

            if (!formIsNonStudy && selectedSubjects.length === 0) {
                alert('لطفاً حداقل یک درس را انتخاب کنید.');
                dropdownOpen = true;
                dropMenu.classList.remove('hidden');
                return;
            }
            if (!topic) {
                alert('لطفاً عنوان دقیق مبحث یا تسک را وارد کنید.');
                return;
            }

            const newItem = {
                id: Date.now(),
                isNonStudy: formIsNonStudy,
                subjects: formIsNonStudy ? [] : [...selectedSubjects],
                subject: formIsNonStudy ? '' : selectedSubjects.join(' ، '),
                topic: topic,
                description: description,
                type: actType,
                plannedTime: plannedTime
            };

            const data = getWeeklyStorage();
            if (!data[activeDayId]) data[activeDayId] = [];
            data[activeDayId].unshift(newItem);
            saveWeeklyStorage(data);

            if (alsoSendToTodayQueue && Array.isArray(state.parts)) {
                const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
                const todayFa = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(new Date());
                state.parts.unshift({
                    id: Date.now() + 1,
                    dateISO: todayISO,
                    dateStr: todayFa,
                    isNonStudy: newItem.isNonStudy,
                    subjects: [...newItem.subjects],
                    topic: newItem.topic,
                    description: newItem.description,
                    type: newItem.type,
                    plannedTime: newItem.plannedTime,
                    realTime: 0,
                    status: 'pending',
                    tests: { correct: 0, wrong: 0, total: 0 }
                });
                localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
            }

            // پاکسازی فرم پس از ثبت
            topicEl.value = '';
            descEl.value = '';
            selectedSubjects = [];
            updateSubjectLabel();
            renderSubjectCheckboxes();
            renderPlannerView();

            if (alsoSendToTodayQueue) {
                alert('پارت هم در برنامه هفتگی ذخیره شد و هم به «پارت‌های در انتظار انجام» امروز اضافه گردید.');
            }
        }

        document.getElementById('tilo-wform-submit-day').addEventListener('click', () => handleAddWeeklyPart(false));
        document.getElementById('tilo-wform-submit-both').addEventListener('click', () => handleAddWeeklyPart(true));

        function renderPlannerView() {
            const data = getWeeklyStorage();
            const daysBar = document.getElementById('tilo-pro-cal-days');
            const activeDayObj = daysOfWeek.find(d => d.id === activeDayId) || daysOfWeek[0];

            document.getElementById('tilo-pro-cal-active-day-badge').textContent = activeDayObj.name;
            document.getElementById('tilo-pro-cal-list-day-name').textContent = activeDayObj.name;

            if (daysBar) {
                daysBar.innerHTML = daysOfWeek.map(d => {
                    const list = data[d.id] || [];
                    const totalMin = list.reduce((acc, item) => acc + (Number(item.plannedTime) || 0), 0);
                    const isActive = d.id === activeDayId;
                    return `
                        <button type="button" data-day="${d.id}" class="tilo-pro-day-btn flex flex-col items-center justify-center p-3 rounded-2xl border transition text-xs ${
                            isActive ? 'bg-primary text-white border-primary font-black shadow-lg' : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }">
                            <span class="font-bold">${d.name}</span>
                            <span class="text-[10px] ${isActive ? 'text-indigo-100' : 'text-slate-400'} mt-1">${list.length} پارت (${totalMin} دقیقه)</span>
                        </button>
                    `;
                }).join('');

                daysBar.querySelectorAll('.tilo-pro-day-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        activeDayId = btn.getAttribute('data-day');
                        renderPlannerView();
                    });
                });
            }

            const listEl = document.getElementById('tilo-pro-cal-parts-list');
            const dayParts = data[activeDayId] || [];

            if (dayParts.length === 0) {
                listEl.innerHTML = '<div class="text-center py-8 text-slate-400 text-xs">هنوز پارتی برای این روز تعریف نشده است. از فرم بالا اولین پارت را اضافه کنید.</div>';
                return;
            }

            listEl.innerHTML = dayParts.map((p, idx) => {
                const subs = Array.isArray(p.subjects) && p.subjects.length ? p.subjects : (p.subject ? [p.subject] : []);
                return `
                    <div class="bg-slate-900/75 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div class="space-y-1.5 flex-1">
                            <div class="flex flex-wrap items-center gap-1.5">
                                ${p.isNonStudy
                                    ? '<span class="bg-amberSoft/20 text-amberSoft px-2.5 py-0.5 rounded-md font-bold text-[11px]">☕ کار غیر درسی</span>'
                                    : subs.map(s => `<span class="bg-primary/20 text-indigo-300 text-[11px] px-2.5 py-0.5 rounded-md font-bold">${s}</span>`).join('')
                                }
                                <span class="text-xs text-slate-400">• ${p.type || (p.isNonStudy ? 'سایر کارهای شخصی' : 'آموزشی / مطالعاتی')}</span>
                                <span class="text-xs text-tealSoft font-bold">• ${p.plannedTime} دقیقه</span>
                            </div>
                            <h5 class="font-bold text-white text-sm md:text-base">${p.topic}</h5>
                            ${p.description ? `<p class="text-xs text-slate-300 bg-slate-950/50 p-2 rounded-xl border border-slate-800/80"><i class="fas fa-align-right text-tealSoft ml-1.5"></i>${p.description}</p>` : ''}
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5 justify-end shrink-0 w-full sm:w-auto border-t sm:border-t-0 border-slate-800 pt-2.5 sm:pt-0">
                            <button type="button" data-act="queue" data-idx="${idx}" class="btn-calm bg-tealSoft/15 hover:bg-tealSoft/25 text-tealSoft border border-tealSoft/30 text-xs py-2 px-3">
                                <i class="fas fa-plus"></i> ارسال به صف امروز
                            </button>
                            <button type="button" data-act="timer" data-idx="${idx}" class="btn-calm bg-primary text-white text-xs py-2 px-3">
                                <i class="fas fa-stopwatch"></i> تایمر
                            </button>
                            <button type="button" data-act="del" data-idx="${idx}" class="text-roseSoft hover:bg-rose-500/10 p-2 rounded-lg">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            listEl.querySelectorAll('button[data-act]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const act = btn.getAttribute('data-act');
                    const idx = Number(btn.getAttribute('data-idx'));
                    const item = dayParts[idx];
                    if (!item) return;

                    if (act === 'del') {
                        dayParts.splice(idx, 1);
                        saveWeeklyStorage(data);
                        renderPlannerView();
                        return;
                    }

                    const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
                    const todayFa = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(new Date());
                    const subs = Array.isArray(item.subjects) && item.subjects.length ? item.subjects : (item.subject ? [item.subject] : []);

                    const createdPart = {
                        id: Date.now(),
                        dateISO: todayISO,
                        dateStr: todayFa,
                        isNonStudy: !!item.isNonStudy,
                        subjects: item.isNonStudy ? [] : subs,
                        topic: item.topic,
                        description: item.description || '',
                        type: item.type || (item.isNonStudy ? 'سایر کارهای شخصی' : 'آموزشی / مطالعاتی'),
                        plannedTime: item.plannedTime || 60,
                        realTime: 0,
                        status: 'pending',
                        tests: { correct: 0, wrong: 0, total: 0 }
                    };

                    if (Array.isArray(state.parts)) {
                        state.parts.unshift(createdPart);
                        localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                    }

                    if (act === 'timer' && typeof state.selectPartAndGoToTimer === 'function') {
                        state.selectPartAndGoToTimer(createdPart);
                    } else {
                        alert('به لیست «پارت‌های در انتظار مطالعه» امروز اضافه شد!');
                    }
                });
            });
        }

        window.TiloPlus.renderWeeklyCalendar = renderPlannerView;
        renderPlannerView();
    }
})();
/**
 * Tilo Pro Suite - Part 3/4
 * ۱. نمایش گروه‌بندی‌شده پارت‌های انجام‌شده هر روز با تاریخ و نام روز هفته + قابلیت بستن با علامت «
 * ۲. تولید و دانلود PDF رسمی و گرافیکی ویژه مشاور (با نام اختصاصی کاربر و نمودار روند پیشرفت)
 */
(function initTiloProPart3() {
    window.TiloPro = window.TiloPro || {};
    window.TiloPro.collapsedDays = JSON.parse(localStorage.getItem('tilo_collapsed_days') || '{}');

    // بارگذاری کتابخانه html2pdf برای دانلود مستقیم فایل PDF در موبایل و دسکتاپ
    if (!document.getElementById('tilo-html2pdf-lib')) {
        const script = document.createElement('script');
        script.id = 'tilo-html2pdf-lib';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        document.head.appendChild(script);
    }

    // استایل‌های ویژه آکاردئون روزانه (علامت «) و قالب گزارش PDF مشاور
    const style = document.createElement('style');
    style.id = 'tilo-part3-styles';
    style.textContent = `
        .tilo-collapse-chevron {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            font-weight: 900;
            line-height: 1;
            transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease;
            user-select: none;
        }
        .tilo-collapse-chevron.is-open {
            transform: rotate(-90deg);
        }
        .tilo-collapse-chevron.is-closed {
            transform: rotate(0deg);
            opacity: 0.7;
        }
        .tilo-day-group-body {
            overflow: hidden;
            transition: max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
        }
        .tilo-day-group-body.collapsed {
            max-height: 0 !important;
            opacity: 0;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);

    const waitPart3 = setInterval(() => {
        const state = window.TiloPlus && window.TiloPlus.vueState;
        const mainEl = document.querySelector('main');
        if (state && mainEl) {
            clearInterval(waitPart3);
            setupGroupedCompletedPartsAndArchive(state, mainEl);
            buildConsultantPdfModal(state);
        }
    }, 300);

    // کمکی: تبدیل تاریخ میلادی (YYYY-MM-DD) به نام روز هفته و تاریخ کامل شمسی
    function getPersianDayAndFullDate(dateISO, fallbackStr) {
        try {
            if (!dateISO) return { weekday: 'روز ثبت‌شده', fullDate: fallbackStr || '—' };
            const [y, m, d] = dateISO.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d, 12, 0, 0);
            const weekday = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', weekday: 'long' }).format(dateObj);
            const fullDate = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(dateObj);
            return { weekday, fullDate };
        } catch (e) {
            return { weekday: 'گزارش روز', fullDate: fallbackStr || dateISO };
        }
    }

    // ۱. تزریق بخش «پارت‌های انجام‌شده به تفکیک روز» در تب پارت‌ها و تب آرشیو
    function setupGroupedCompletedPartsAndArchive(state, mainEl) {
        const divs = Array.from(mainEl.children).filter(el => el.tagName === 'DIV' && !el.classList.contains('fixed'));

        // پیدا کردن تب پارت‌ها و تب آرشیو
        const partsTab = divs.find(d => d.innerHTML.includes('تعریف پارت مطالعه جدید'));
        const archiveTab = divs.find(d => d.innerHTML.includes('آرشیو آموزشی'));

        if (partsTab && !document.getElementById('tilo-parts-completed-grouped')) {
            const box = document.createElement('div');
            box.id = 'tilo-parts-completed-grouped';
            box.className = 'space-y-4 pt-2';
            partsTab.appendChild(box);
        }

        if (archiveTab) {
            archiveTab.innerHTML = `<div id="tilo-archive-completed-grouped" class="space-y-5"></div>`;
        }

        let lastRenderSignature = '';

        setInterval(() => {
            if (!Array.isArray(state.parts)) return;
            const completed = state.parts
                .filter(p => p.status === 'completed')
                .sort((a, b) => (b.completedAt || b.id || 0) - (a.completedAt || a.id || 0));

            const sig = JSON.stringify(completed.map(p => `${p.id}_${p.realTime}_${p.description}`)) + JSON.stringify(window.TiloPro.collapsedDays);
            if (sig === lastRenderSignature) return;
            lastRenderSignature = sig;

            renderGroupedContainer(document.getElementById('tilo-parts-completed-grouped'), completed, state, 'parts');
            renderGroupedContainer(document.getElementById('tilo-archive-completed-grouped'), completed, state, 'archive');
        }, 650);
    }

    function renderGroupedContainer(container, completedList, state, contextKey) {
        if (!container) return;

        // گروه‌بندی بر اساس تاریخ (dateISO)
        const groupsMap = new Map();
        completedList.forEach(part => {
            const key = part.dateISO || part.dateStr || 'unknown';
            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
            }
            groupsMap.get(key).push(part);
        });

        const dayKeys = Array.from(groupsMap.keys()).sort((a, b) => b.localeCompare(a));
        const userName = (state.settings && state.settings.userName) ? state.settings.userName : 'دانش‌آموز';

        let html = `
            <div class="soft-card p-5 md:p-6 rounded-3xl border border-indigo-500/20 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                        <h3 class="font-extrabold text-white text-sm md:text-base flex items-center gap-2">
                            <i class="fas fa-calendar-day text-sage"></i>
                            <span>آرشیو روزانه پارت‌ها و تسک‌های انجام‌شده</span>
                            <span class="bg-sage/15 text-sage text-[11px] px-2.5 py-0.5 rounded-lg font-bold">${completedList.length} پارت تکمیل‌شده</span>
                        </h3>
                        <p class="text-[11px] text-slate-400 mt-1">پارت‌های هر روز در یک کارت مجزا دسته‌بندی شده‌اند. با کلیک روی علامت <strong class="text-white">«</strong> می‌توانید لیست هر روز را باز یا بسته کنید.</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <button type="button" class="tilo-open-pdf-modal-btn btn-calm bg-gradient-to-r from-primary to-tealSoft text-slate-950 font-black text-xs py-2.5 px-4 shadow-md">
                            <i class="fas fa-file-pdf text-sm"></i> خروجی PDF ویژه مشاور (${userName})
                        </button>
                    </div>
                </div>
        `;

        if (dayKeys.length === 0) {
            html += `<div class="text-center py-8 text-slate-500 text-xs">هنوز هیچ پارت یا تسکی تکمیل نشده است.</div></div>`;
            container.innerHTML = html;
            bindGroupEvents(container, state);
            return;
        }

        html += `<div class="space-y-3.5">`;

        dayKeys.forEach(dayKey => {
            const items = groupsMap.get(dayKey);
            const first = items[0];
            const { weekday, fullDate } = getPersianDayAndFullDate(first.dateISO, first.dateStr);
            const isCollapsed = !!window.TiloPro.collapsedDays[dayKey];

            let studyMin = 0;
            let nonStudyMin = 0;
            items.forEach(x => {
                if (x.isNonStudy) nonStudyMin += Number(x.realTime || 0);
                else studyMin += Number(x.realTime || 0);
            });

            html += `
                <div class="bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden transition">
                    <!-- هدر روز (قابل کلیک برای باز و بسته کردن با علامت «) -->
                    <div data-toggle-day="${dayKey}" class="tilo-day-header cursor-pointer p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-800/50 transition">
                        <div class="flex items-center gap-3">
                            <span class="tilo-collapse-chevron text-tealSoft ${isCollapsed ? 'is-closed' : 'is-open'}" title="باز / بسته کردن لیست این روز">«</span>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h4 class="font-black text-white text-sm md:text-base">${weekday}</h4>
                                    <span class="text-xs text-tealSoft font-bold bg-tealSoft/10 px-2.5 py-0.5 rounded-lg">${fullDate}</span>
                                </div>
                                <p class="text-[11px] text-slate-400 mt-1">
                                    <span>مجموع این روز: <strong class="text-sage">${state.formatMinutes ? state.formatMinutes(studyMin) : studyMin + ' دقیقه'} مطالعه درسی</strong></span>
                                    ${nonStudyMin > 0 ? `<span class="text-amberSoft mr-2">• ☕ ${state.formatMinutes ? state.formatMinutes(nonStudyMin) : nonStudyMin + ' دقیقه'} غیردرسی</span>` : ''}
                                    <span class="mr-2">• ${items.length} پارت</span>
                                </p>
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button type="button" data-pdf-single-day="${dayKey}" class="tilo-pdf-day-btn btn-calm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] py-1.5 px-2.5" title="خروجی PDF فقط برای این روز">
                                <i class="fas fa-file-export text-primarySoft"></i> PDF این روز
                            </button>
                            <span class="text-[11px] text-slate-400 font-bold px-2 py-1 rounded-lg bg-slate-950/60">
                                ${isCollapsed ? 'نمایش پارت‌ها' : 'بستن «'}
                            </span>
                        </div>
                    </div>

                    <!-- لیست پارت‌های انجام‌شده در این روز -->
                    <div class="tilo-day-group-body ${isCollapsed ? 'collapsed' : ''} border-t border-slate-800/80 p-3.5 space-y-2.5 bg-slate-950/30">
                        ${items.map(item => {
                            const subs = Array.isArray(item.subjects) ? item.subjects : [];
                            return `
                                <div class="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800/90 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
                                    <div class="space-y-1 flex-1">
                                        <div class="flex flex-wrap items-center gap-1.5">
                                            ${item.isNonStudy
                                                ? '<span class="bg-amberSoft/20 text-amberSoft text-[10px] px-2 py-0.5 rounded font-bold">☕ کار غیر درسی</span>'
                                                : subs.map(s => `<span class="bg-primary/20 text-indigo-300 text-[10px] px-2 py-0.5 rounded font-bold">${s}</span>`).join('')
                                            }
                                            <span class="text-[11px] text-slate-400">• ${item.type || (item.isNonStudy ? 'کار شخصی' : 'مطالعه')}</span>
                                        </div>
                                        <p class="font-bold text-white text-xs md:text-sm">${item.topic}</p>${item.description ? `<p class="text-[11px] text-slate-300 bg-slate-950/70 px-2.5 py-1.5 rounded-lg border border-slate-800/70 mt-1"><i class="fas fa-align-right text-tealSoft ml-1"></i>${item.description}</p>` : ''}
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                        <span class="bg-sage/15 text-sage border border-sage/30 px-2.5 py-1 rounded-lg text-xs font-black">${item.realTime || item.plannedTime} دقیقه</span>
                                        <button type="button" data-del-completed="${item.id}" class="text-roseSoft hover:bg-rose-500/10 p-1.5 rounded-lg text-xs" title="حذف از آرشیو">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;
        bindGroupEvents(container, state);
    }

    function bindGroupEvents(container, state) {
        // رویداد باز و بسته کردن هر روز با علامت «
        container.querySelectorAll('.tilo-day-header').forEach(hdr => {
            hdr.addEventListener('click', (e) => {
                if (e.target.closest('.tilo-pdf-day-btn')) return;
                const dayKey = hdr.getAttribute('data-toggle-day');
                window.TiloPro.collapsedDays[dayKey] = !window.TiloPro.collapsedDays[dayKey];
                localStorage.setItem('tilo_collapsed_days', JSON.stringify(window.TiloPro.collapsedDays));
                // اعمال فوری کلاس
                const body = hdr.nextElementSibling;
                const chev = hdr.querySelector('.tilo-collapse-chevron');
                if (body) body.classList.toggle('collapsed', !!window.TiloPro.collapsedDays[dayKey]);
                if (chev) {
                    chev.classList.toggle('is-closed', !!window.TiloPro.collapsedDays[dayKey]);
                    chev.classList.toggle('is-open', !window.TiloPro.collapsedDays[dayKey]);
                }
            });
        });

        // دکمه خروجی PDF کلی
        container.querySelectorAll('.tilo-open-pdf-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => window.TiloPro.openPdfExportModal('all'));
        });

        // دکمه خروجی PDF تک‌روز
        container.querySelectorAll('.tilo-pdf-day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dayKey = btn.getAttribute('data-pdf-single-day');
                window.TiloPro.openPdfExportModal(dayKey);
            });
        });

        // حذف پارت انجام‌شده
        container.querySelectorAll('button[data-del-completed]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-del-completed'));
                if (confirm('آیا این پارت انجام‌شده حذف شود؟')) {
                    if (typeof state.deletePart === 'function') state.deletePart(id);
                }
            });
        });
    }

    // ۲. ساخت مودال پیش‌نمایش و دانلود PDF حرفه‌ای ویژه مشاور
    function buildConsultantPdfModal(state) {
        if (document.getElementById('tilo-pdf-consultant-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'tilo-pdf-consultant-modal';
        modal.className = 'fixed inset-0 z-[100120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 hidden select-none';
        modal.innerHTML = `
            <div class="soft-card bg-[#162032] w-full max-w-4xl max-h-[92vh] rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
                <!-- نوار ابزار بالای مودال PDF -->
                <div class="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                            <i class="fas fa-file-pdf text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-white text-sm">پیش‌نمایش و دریافت گزارش PDF ویژه مشاور</h3>
                            <p class="text-[11px] text-slate-400">شخصی‌سازی‌شده با نام شما و نمودار روند پیشرفت مطالعاتی</p>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <button type="button" id="tilo-pdf-download-direct" class="btn-calm bg-primary text-white text-xs py-2 px-4 font-bold">
                            <i class="fas fa-download"></i> دانلود مستقیم فایل PDF
                        </button>
                        <button type="button" id="tilo-pdf-print-vector" class="btn-calm bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 px-3.5 font-bold">
                            <i class="fas fa-print"></i> چاپ / ذخیره PDF باکیفیت
                        </button>
                        <button type="button" id="tilo-pdf-modal-close" class="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- بخش قابل اسکرول حاوی برگه سفید استاندارد A4 جهت تبدیل به PDF -->
                <div class="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950/80 flex justify-center">
                    <div id="tilo-pdf-printable-sheet" dir="rtl" style="width: 100%; max-width: 790px; background: #ffffff; color: #0f172a; padding: 32px; border-radius: 16px; font-family: 'Vazirmatn', sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.3);"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('tilo-pdf-modal-close').addEventListener('click', () => modal.classList.add('hidden'));

        // دانلود مستقیم با html2pdf
        document.getElementById('tilo-pdf-download-direct').addEventListener('click', async () => {
            const sheet = document.getElementById('tilo-pdf-printable-sheet');
            const studentName = (state.settings && state.settings.userName) ? state.settings.userName : 'دانش‌آموز';
            const btn = document.getElementById('tilo-pdf-download-direct');

            if (typeof window.html2pdf === 'function') {
                const origHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ساخت PDF...';
                try {
                    const opt = {
                        margin: [8, 8, 8, 8],
                        filename: `گزارش-مطالعه-${studentName}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };
                    await window.html2pdf().set(opt).from(sheet).save();
                } finally {
                    btn.innerHTML = origHtml;
                }
            } else {
                triggerCleanVectorPrint(sheet.innerHTML, studentName);
            }
        });

        // چاپ برداری / ذخیره PDF استاندارد مرورگر
        document.getElementById('tilo-pdf-print-vector').addEventListener('click', () => {
            const sheet = document.getElementById('tilo-pdf-printable-sheet');
            const studentName = (state.settings && state.settings.userName) ? state.settings.userName : 'دانش‌آموز';
            triggerCleanVectorPrint(sheet.innerHTML, studentName);
        });

        window.TiloPro.openPdfExportModal = function(filterDayKey = 'all') {
            populatePdfSheet(state, filterDayKey);
            modal.classList.remove('hidden');
        };
    }

    function populatePdfSheet(state, filterDayKey) {
        const sheet = document.getElementById('tilo-pdf-printable-sheet');
        if (!sheet) return;

        const studentName = (state.settings && state.settings.userName) ? state.settings.userName : 'بنیامین';
        const verifiedEmail = window.TiloPro.verifiedEmail || (state.currentUser && state.currentUser.email) || 'ثبت نشده';
        const dailyGoal = Number(state.settings && state.settings.dailyGoal) || 360;
        const issueDate = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

        let completed = (state.parts || []).filter(p => p.status === 'completed');
        if (filterDayKey && filterDayKey !== 'all') {
            completed = completed.filter(p => (p.dateISO || p.dateStr) === filterDayKey);
        }
        completed.sort((a, b) => (b.completedAt || b.id || 0) - (a.completedAt || a.id || 0));

        // محاسبه آمار کل و روند پیشرفت
        let totalStudyMin = 0;
        let totalNonStudyMin = 0;
        const subjectMap = {};
        const dayTotalsMap = {};

        completed.forEach(p => {
            const dKey = p.dateISO || p.dateStr || 'نامشخص';
            if (!dayTotalsMap[dKey]) dayTotalsMap[dKey] = { study: 0, nonStudy: 0, count: 0, items: [], dateStr: p.dateStr };
            dayTotalsMap[dKey].items.push(p);
            dayTotalsMap[dKey].count++;

            const dur = Number(p.realTime || p.plannedTime || 0);
            if (p.isNonStudy) {
                totalNonStudyMin += dur;
                dayTotalsMap[dKey].nonStudy += dur;
            } else {
                totalStudyMin += dur;
                dayTotalsMap[dKey].study += dur;
                const subs = Array.isArray(p.subjects) && p.subjects.length ? p.subjects : ['سایر دروس'];
                subs.forEach(s => {
                    subjectMap[s] = (subjectMap[s] || 0) + dur;
                });
            }
        });

        const sortedDays = Object.keys(dayTotalsMap).sort((a, b) => b.localeCompare(a));
        const activeDaysCount = sortedDays.length || 1;
        const avgDailyStudy = Math.round(totalStudyMin / activeDaysCount);
        const goalAchievementPct = Math.min(100, Math.round((avgDailyStudy / dailyGoal) * 100));

        const formatFaMin = (m) => {
            if (!m) return '۰ دقیقه';
            const h = Math.floor(m / 60);
            const rem = m % 60;
            return h > 0 ? (rem > 0 ? `${h} ساعت و ${rem} دقیقه` : `${h} ساعت`) : `${m} دقیقه`;
        };

        // ساخت نمودار میله‌ای روند پیشرفت روزها
        const recentDaysForChart = sortedDays.slice(0, 7).reverse();
        const chartBarsHtml = recentDaysForChart.map(dKey => {
            const info = dayTotalsMap[dKey];
            const pct = Math.min(100, Math.round((info.study / dailyGoal) * 100));
            const { weekday, fullDate } = getPersianDayAndFullDate(dKey, info.dateStr);
            return `
                <div style="margin-bottom: 8px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:3px; color:#334155;">
                        <strong>${weekday} (${fullDate})</strong>
                        <span>${formatFaMin(info.study)} مطالعه (${pct}% از هدف)</span>
                    </div>
                    <div style="width:100%; height:10px; background:#e2e8f0; border-radius:99px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #4f46e5, #0d9488); border-radius:99px;"></div>
                    </div>
                </div>
            `;
        }).join('');

        // تفکیک دروس
        const subjectBadgesHtml = Object.entries(subjectMap)
            .sort((a, b) => b[1] - a[1])
            .map(([sub, mins]) => `
                <span style="display:inline-block; background:#f1f5f9; border:1px solid #cbd5e1; color:#1e293b; padding:4px 10px; border-radius:8px; font-size:11px; margin:3px;">
                    <strong>${sub}:</strong> ${formatFaMin(mins)}
                </span>
            `).join('');

        // جداول روزانه
        const dailyTablesHtml = sortedDays.map(dKey => {
            const info = dayTotalsMap[dKey];
            const { weekday, fullDate } = getPersianDayAndFullDate(dKey, info.dateStr);
            return `
                <div style="margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; page-break-inside: avoid;">
                    <div style="background: #f8fafc; padding: 10px 14px; border-bottom: 1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="font-size:13px; color:#0f172a;">📅 ${weekday} — ${fullDate}</strong>
                        </div>
                        <div style="font-size:11px; color:#334155;">
                            <span>مطالعه درسی: <strong style="color:#0f766e;">${formatFaMin(info.study)}</strong></span>
                            ${info.nonStudy > 0 ? ` | <span>غیردرسی: <strong>${formatFaMin(info.nonStudy)}</strong></span>` : ''}
                        </div>
                    </div>
                    <table style="width:100%; border-collapse:collapse; font-size:11px; text-align:right;">
                        <thead>
                            <tr style="background:#f1f5f9; color:#475569; border-bottom:1px solid #e2e8f0;">
                                <th style="padding:8px 10px; width:22%;">درس / بخش</th>
                                <th style="padding:8px 10px; width:28%;">عنوان مبحث / فعالیت</th>
                                <th style="padding:8px 10px; width:35%;">توضیحات و جزئیات گزارش</th>
                                <th style="padding:8px 10px; width:15%; text-align:center;">مدت زمان</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${info.items.map(item => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:8px 10px; font-weight:bold; color:${item.isNonStudy ? '#b45309' : '#3730a3'};">
                                        ${item.isNonStudy ? '☕ کار غیردرسی' : (Array.isArray(item.subjects) ? item.subjects.join('، ') : 'مطالعه')}
                                    </td>
                                    <td style="padding:8px 10px; font-weight:bold; color:#0f172a;">${item.topic}</td>
                                    <td style="padding:8px 10px; color:#475569;">${item.description || '—'}</td>
                                    <td style="padding:8px 10px; text-align:center; font-weight:bold; color:#047857;">${item.realTime || item.plannedTime} دقیقه</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        sheet.innerHTML = `
            <!-- سربرگ رسمی گزارش مشاوره -->
            <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:11px; color:#4f46e5; font-weight:bold; margin-bottom:4px;">سامانه هوشمند مدیریت مطالعه و تحلیل کنکور tilo</div>
                    <h1 style="font-size:20px; font-weight:900; color:#0f172a; margin:0;">گزارش رسمی عملکرد و پیشرفت مطالعاتی</h1>
                    <p style="font-size:12px; color:#475569; margin:4px 0 0 0;">نام دانش‌آموز: <strong style="color:#0f172a; font-size:14px;">${studentName}</strong> | رشته: ریاضی‌فیزیک</p>
                </div>
                <div style="text-align:left; font-size:11px; color:#475569; line-height:1.7;">
                    <div><strong>تاریخ صدور:</strong> ${issueDate}</div>
                    <div><strong>حساب کاربری:</strong> <span dir="ltr">${verifiedEmail}</span></div>
                    <div><strong>هدف روزانه:</strong> ${formatFaMin(dailyGoal)}</div>
                </div>
            </div>

            <!-- خلاصه مدیریتی و شاخص‌های پیشرفت -->
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:20px;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; text-align:center;">
                    <div style="font-size:11px; color:#64748b;">مجموع مطالعه درسی</div>
                    <div style="font-size:15px; font-weight:900; color:#4f46e5; margin-top:4px;">${formatFaMin(totalStudyMin)}</div>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; text-align:center;">
                    <div style="font-size:11px; color:#64748b;">میانگین مطالعه روزانه</div>
                    <div style="font-size:15px; font-weight:900; color:#0f766e; margin-top:4px;">${formatFaMin(avgDailyStudy)}</div>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; text-align:center;">
                    <div style="font-size:11px; color:#64748b;">تحقق هدف روزانه</div>
                    <div style="font-size:15px; font-weight:900; color:#047857; margin-top:4px;">${goalAchievementPct}%</div>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; text-align:center;">
                    <div style="font-size:11px; color:#64748b;">پارت‌های تکمیل‌شده</div>
                    <div style="font-size:15px; font-weight:900; color:#0f172a; margin-top:4px;">${completed.length} پارت</div>
                </div>
            </div>

            <!-- نمودار روند پیشرفت روزانه -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:18px;">
                <h3 style="font-size:13px; font-weight:bold; color:#0f172a; margin:0 0 10px 0;">📊 نمودار روند پیشرفت و پیوستگی مطالعه (${studentName})</h3>
                ${chartBarsHtml || '<p style="font-size:11px; color:#64748b;">اطلاعاتی برای رسم نمودار ثبت نشده است.</p>'}
            </div>

            <!-- تفکیک زمان هر درس -->
            <div style="margin-bottom:18px;">
                <h3 style="font-size:13px; font-weight:bold; color:#0f172a; margin:0 0 8px 0;">📚 تفکیک زمان مطالعه دروس:</h3>
                <div>${subjectBadgesHtml || '<span style="font-size:11px; color:#64748b;">درسی ثبت نشده است.</span>'}</div>
            </div>

            <!-- ریز پارت‌های انجام‌شده به تفکیک روز و تاریخ -->
            <div>
                <h3 style="font-size:14px; font-weight:900; color:#0f172a; margin:0 0 8px 0;">📋 جدول تفصیلی پارت‌های انجام‌شده به تفکیک روز</h3>
                ${dailyTablesHtml}
            </div>

            <!-- کادر ویژه نظر و امضای مشاور -->
            <div style="margin-top:24px; border:1px dashed #94a3b8; border-radius:12px; padding:14px; background:#fcfcfd; page-break-inside: avoid;">
                <strong style="font-size:12px; color:#334155; display:block; margin-bottom:28px;">✍️ ارزیابی، بازخورد و توصیه‌های مشاور تحصیلی برای ${studentName}:</strong>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px;">
                    <span>تولید شده به صورت خودکار توسط دستیار هوشمند مطالعه tilo</span>
                    <span>امضای مشاور / تاریخ بررسی</span>
                </div>
            </div>
        `;
    }

    function triggerCleanVectorPrint(sheetContent, studentName) {
        const printWin = window.open('', '_blank', 'width=900,height=800');
        if (!printWin) {
            alert('لطفاً پاپ‌آپ مرورگر را باز کنید یا از دکمه «دانلود مستقیم فایل PDF» استفاده نمایید.');
            return;
        }
        printWin.document.write(`
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>گزارش عملکرد مطالعاتی - ${studentName}</title>
                <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.0.0/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
                <style>
                    body { font-family: 'Vazirmatn', sans-serif; margin: 0; padding: 20px; background: #fff; color: #0f172a; }
                    @media print {
                        body { padding: 0; }
                        @page { size: A4 portrait; margin: 12mm; }
                    }
                </style>
            </head>
            <body>
                ${sheetContent}
                <script>
                    window.onload = function() {
                        setTimeout(function() { window.print(); }, 500);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWin.document.close();
    }
})();
/**
 * Tilo Pro Suite - Part 4/4 (Final)
 * موتور هوش مصنوعی تحلیلگر عملکرد پیشرفته با تولید گزارش‌های متنی مشاوره‌ای طولانی، دقیق و راهکارهای بهبود
 */
(function initTiloProPart4() {
    const waitPart4 = setInterval(() => {
        const state = window.TiloPlus && window.TiloPlus.vueState;
        const mainEl = document.querySelector('main');
        if (state && mainEl) {
            clearInterval(waitPart4);
            injectAiConsultantAnalyzerTab(state, mainEl);
        }
    }, 300);

    function injectAiConsultantAnalyzerTab(state, mainEl) {
        // ۱. اضافه کردن دکمه منوی کشویی هوش مصنوعی (در صورت تمایل) یا تزریق بخش تحلیل به تب داشبورد و ایجاد دکمه اختصاصی
        const divs = Array.from(mainEl.children).filter(el => el.tagName === 'DIV' && !el.classList.contains('fixed'));
        const dashboardTab = divs[0]; // تب داشبورد

        if (dashboardTab && !document.getElementById('tilo-ai-consultant-section')) {
            const aiBox = document.createElement('div');
            aiBox.id = 'tilo-ai-consultant-section';
            aiBox.className = 'soft-card p-6 rounded-3xl border border-indigo-500/30 space-y-5 mt-6';
            aiBox.innerHTML = `
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-teal-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
                            <i class="fas fa-brain text-xl"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-white text-base md:text-lg">مشاور هوش مصنوعی تحلیلگر عملکرد tilo</h3>
                            <p class="text-xs text-slate-400">تحلیل عمیق، روان‌شناختی و کنکوری روند مطالعه، شناسایی افت‌ها و راهکارهای دقیق بهبود</p>
                        </div>
                    </div>
                    <button type="button" id="tilo-run-ai-analysis-btn" class="btn-calm bg-gradient-to-r from-primary to-tealSoft text-slate-950 font-black text-xs md:text-sm py-3 px-5 shadow-lg shadow-primary/25">
                        <i class="fas fa-wand-magic-sparkles text-sm"></i> اجرای تحلیل هوشمند عملکرد
                    </button>
                </div>

                <!-- کادر نمایش خروجی گزارش متنی هوش مصنوعی -->
                <div id="tilo-ai-report-container" class="space-y-4">
                    <div class="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
                        <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                            <i class="fas fa-robot text-lg"></i>
                        </div>
                        <p class="text-xs md:text-sm text-slate-300 font-medium leading-relaxed max-w-lg mx-auto">
                            برای دریافت گزارش جامع تحلیلی، نقاط قوت، ایرادات مطالعاتی و توصیه‌های تخصصی کنکور ریاضی، روی دکمه «اجرای تحلیل هوشمند» کلیک کنید.
                        </p>
                    </div>
                </div>
            `;
            dashboardTab.appendChild(aiBox);

            document.getElementById('tilo-run-ai-analysis-btn').addEventListener('click', () => {
                generateDeepAiConsultantReport(state);
            });
        }
    }

    function generateDeepAiConsultantReport(state) {
        const container = document.getElementById('tilo-ai-report-container');
        const btn = document.getElementById('tilo-run-ai-analysis-btn');
        if (!container) return;

        const origText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال پردازش داده‌ها و تحلیل هوشمند...';
        btn.disabled = true;

        setTimeout(() => {
            const userName = (state.settings && state.settings.userName) ? state.settings.userName : 'بنیامین';
            const dailyGoal = Number(state.settings && state.settings.dailyGoal) || 360;
            const completed = (state.parts || []).filter(p => p.status === 'completed');
            const pending = (state.parts || []).filter(p => p.status === 'pending');

            // جمع‌آوری آمارها
            let totalStudyMin = 0;
            let totalNonStudyMin = 0;
            let totalTests = 0;
            let totalCorrect = 0;
            let totalWrong = 0;
            const subjectMins = {};

            completed.forEach(p => {
                const dur = Number(p.realTime || p.plannedTime || 0);
                if (p.isNonStudy) {
                    totalNonStudyMin += dur;
                } else {
                    totalStudyMin += dur;
                    const subs = Array.isArray(p.subjects) && p.subjects.length ? p.subjects : ['عمومی / پایه'];
                    subs.forEach(s => { subjectMins[s] = (subjectMins[s] || 0) + dur; });
                    if (p.tests) {
                        totalCorrect += Number(p.tests.correct || 0);
                        totalWrong += Number(p.tests.wrong || 0);
                        totalTests += Number(p.tests.total || 0);
                    }
                }
            });

            const activeDaysMap = {};
            completed.forEach(p => {
                const dKey = p.dateISO || p.dateStr || 'unknown';
                activeDaysMap[dKey] = true;
            });
            const activeDaysCount = Object.keys(activeDaysMap).length || 1;
            const avgDaily = Math.round(totalStudyMin / activeDaysCount);
            const goalRatio = Math.round((avgDaily / dailyGoal) * 100);
            const accuracy = (totalCorrect + totalWrong) > 0 ? ((totalCorrect / (totalCorrect + totalWrong)) * 100).toFixed(1) : 0;

            // دسته‌بندی دروس به قوی، متوسط و ضعیف بر اساس زمان تخصیص‌یافته
            const sortedSubs = Object.entries(subjectMins).sort((a, b) => b[1] - a[1]);
            const topSubject = sortedSubs.length ? sortedSubs[0][0] : 'هنوز ثبت نشده';
            const weakSubject = sortedSubs.length > 1 ? sortedSubs[sortedSubs.length - 1][0] : 'نیاز به تعادل بیشتر';

            // تولید متن مشاوره‌ای عمیق و تخصصی
            let performanceLevel = 'عالی و پیوسته 🚀';
            let toneAdvice = 'روند مطالعاتی شما نشان‌دهنده‌ی اراده‌ی بالا و نظم ساختاریافته است. با حفظ این پایداری، رتبه‌ی برتر کنکور ریاضی کاملاً در دسترس شماست.';
            if (goalRatio < 50) {
                performanceLevel = 'نیاز به افزایش ساعت مطالعه ⚠️';
                toneAdvice = 'ساعت مطالعه فعلی شما پایین‌تر از هدف استاندارد کنکور ریاضی است. لازم است با خرد کردن پارت‌ها به بازه‌های ۲۵ و ۵۰ دقیقه‌ای، زمان تمرکز خالص روزانه را افزایش دهید.';
            } else if (goalRatio < 80) {
                performanceLevel = 'خوب اما نیازمند پیوستگی بیشتر 📈';
                toneAdvice = 'عملکرد شما در محدوده‌ی خوبی قرار دارد، اما نوسان بین روزها دیده می‌شود. کلید موفقیت کنکور ریاضی، استمرارِ بدون وقفه حتی در روزهای افت انرژی است.';
            }

            const formatFaMin = (m) => {
                const h = Math.floor(m / 60);
                const rem = m % 60;
                return h > 0 ? (rem > 0 ? `${h} ساعت و ${rem} دقیقه` : `${h} ساعت`) : `${m} دقیقه`;
            };

            container.innerHTML = `
                <div class="bg-slate-900/90 p-6 rounded-3xl border border-indigo-500/30 space-y-6 text-right">
                    <!-- سربرگ گزارش هوش مصنوعی -->
                    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                        <div>
                            <span class="text-[11px] font-bold text-tealSoft bg-tealSoft/10 px-3 py-1 rounded-xl">گزارش تحلیلی شخصی‌سازی‌شده ویژه ${userName}</span>
                            <h4 class="text-lg md:text-xl font-black text-white mt-2">وضعیت کلی عملکرد: <span class="text-primarySoft">${performanceLevel}</span></h4>
                        </div>
                        <div class="text-left text-xs text-slate-400">
                            <div>مجموع پارت‌های تحلیل‌شده: <strong class="text-white">${completed.length} پارت</strong></div>
                            <div>میانگین روزانه: <strong class="text-sage">${formatFaMin(avgDaily)}</strong></div>
                        </div>
                    </div>

                    <!-- بخش اول: تحلیل روان‌شناختی و مشاوره‌ای -->
                    <div class="space-y-2">
                        <h5 class="font-bold text-white text-sm flex items-center gap-2">
                            <i class="fas fa-stethoscope text-indigo-400"></i> ارزیابی تخصصی مشاور و روان‌شناسی مطالعه:
                        </h5>
                        <p class="text-xs md:text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                            ${toneAdvice} بررسی داده‌های ثبت‌شده نشان می‌دهد که شما ${activeDaysCount} روز فعال در سامانه داشته‌اید. میزان تحقق هدف روزانه شما روی عدد <strong class="text-tealSoft">${goalRatio} درصد</strong> قرار دارد. تعادل بین پارت‌های درسی و کارهای شخصی (${formatFaMin(totalNonStudyMin)}) نشان‌دهنده‌ی مدیریت تنش مناسب در برنامه‌ریزی شماست.
                        </p>
                    </div>

                    <!-- بخش دوم: نقاط قوت و ضعف دروس کنکور ریاضی -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-slate-950/70 p-4 rounded-2xl border border-emerald-500/20 space-y-2">
                            <h6 class="font-bold text-emerald-400 text-xs flex items-center gap-2">
                                <i class="fas fa-check-circle"></i> نقاط قوت و دروس نقطه اتکا:
                            </h6>
                            <p class="text-xs text-slate-300 leading-relaxed">
                                بیشترین تمرکز و زمان شما روی درس <strong class="text-white">${topSubject}</strong> صرف شده است. استمرار در این بخش می‌تواند نقطه‌ی قوت اصلی شما در آزمون‌های آزمایشی باشد. دقت پاسخ‌گویی کلی شما <strong class="text-emerald-400">${accuracy}%</strong> برآورد شده که نشان‌دهنده کیفیت مناسب در حل تمرین است.
                            </p>
                        </div>
                        <div class="bg-slate-950/70 p-4 rounded-2xl border border-amber-500/20 space-y-2">
                            <h6 class="font-bold text-amber-400 text-xs flex items-center gap-2">
                                <i class="fas fa-triangle-exclamation"></i> هشدارها و ایرادات ساختاری:
                            </h6>
                            <p class="text-xs text-slate-300 leading-relaxed">
                                درس <strong class="text-white">${weakSubject}</strong> زمان کمتری دریافت کرده است. برای موفقیت در کنکور ریاضی (رشته ریاضی‌فیزیک)، غفلت از دروس پایه یا هندسه/گسسته می‌تواند تراز شما را با چالش مواجه کند. پیشنهاد می‌شود سهم این دروس را در برنامه هفتگی افزایش دهید.
                            </p>
                        </div>
                    </div>

                    <!-- بخش سوم: توصیه‌ها و راهکارهای عملی بهبود -->
                    <div class="space-y-3 bg-indigo-950/20 p-5 rounded-2xl border border-indigo-500/20">
                        <h5 class="font-bold text-indigo-300 text-sm flex items-center gap-2">
                            <i class="fas fa-compass text-tealSoft"></i> نقشه راه و راهکارهای عملی برای هفته پیش‌رو:
                        </h5>
                        <ul class="space-y-2 text-xs text-slate-200 list-disc list-inside leading-relaxed">
                            <li><strong class="text-white">تلفیق تست و آموزش:</strong> نسبت پارت‌های آموزشی به تست‌زنی را در دروس ریاضیات و فیزیک به حداقل ۱ به ۲ برسانید.</li>
                            <li><strong class="text-white">مدیریت صف انتظار:</strong> هم‌اکنون <strong class="text-amberSoft">${pending.length} پارت</strong> در صف انتظار دارید؛ پیش از انباشته شدن، آن‌ها را اولویت‌بندی کنید.</li>
                            <li><strong class="text-white">استفاده از پارت‌های غیردرسی:</strong> ثبت کارهای غیردرسی ☕ در سامانه به حفظ انرژی ذهنی شما کمک کرده؛ این روند تعادلی را حفظ کنید.</li>
                        </ul>
                    </div>

                    <div class="flex justify-end pt-2">
                        <button type="button" id="tilo-re-run-ai-btn" class="btn-calm bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 px-4 border border-slate-700">
                            <i class="fas fa-redo text-primarySoft"></i> بروزرسانی تحلیل هوشمند
                        </button>
                    </div>
                </div>
            `;

            document.getElementById('tilo-re-run-ai-btn').addEventListener('click', () => {
                generateDeepAiConsultantReport(state);
            });

            btn.innerHTML = origText;
            btn.disabled = false;
        }, 800);
    }
})();
