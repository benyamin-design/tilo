/**
 * Tilo Cloud & Auth Persistence Module (Stage 1)
 * متصل‌شونده به هسته اصلی بدون تغییر کدهای پایه
 */
(async function initTiloCloudModule() {
    const FB_VERSION = "10.8.0";
    let authModule = null;

    // ۱. بارگذاری ماژول‌های تکمیلی Auth برای ماندگاری نشست و پشتیبانی از موبایل
    try {
        authModule = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`);
        if (window.FirebaseSDK && authModule) {
            Object.assign(window.FirebaseSDK, {
                setPersistence: authModule.setPersistence,
                browserLocalPersistence: authModule.browserLocalPersistence,
                indexedDBLocalPersistence: authModule.indexedDBLocalPersistence,
                signInWithRedirect: authModule.signInWithRedirect,
                getRedirectResult: authModule.getRedirectResult
            });
        }
    } catch (err) {
        console.error("Tilo Cloud: خطا در بارگذاری کتابخانه احراز هویت:", err);
        return;
    }

    // ۲. انتظار برای بارگذاری کامل اپلیکیشن Vue روی #app
    const waitForVueApp = setInterval(() => {
        const appEl = document.getElementById("app");
        if (appEl && appEl.__vue_app__ && appEl.__vue_app__._instance) {
            clearInterval(waitForVueApp);
            const state = appEl.__vue_app__._instance.setupState;
            enhanceCloudAndAuth(state, authModule);
        }
    }, 150);

    function enhanceCloudAndAuth(state, fbAuth) {
        const fb = window.FirebaseSDK;
        if (!fb) return;

        // الف) تابع ادغام هوشمند آرایه‌ها بر اساس ID (جلوگیری از حذف پارت‌های محلی یا ابری)
        function mergeItemsById(localArr = [], cloudArr = []) {
            const map = new Map();
            
            // ابتدا داده‌های ابری را وارد می‌کنیم
            (Array.isArray(cloudArr) ? cloudArr : []).forEach(item => {
                if (item && item.id !== undefined) {
                    map.set(String(item.id), item);
                }
            });

            // سپس داده‌های محلی را بررسی و ادغام می‌کنیم
            (Array.isArray(localArr) ? localArr : []).forEach(localItem => {
                if (!localItem || localItem.id === undefined) return;
                const key = String(localItem.id);
                const existing = map.get(key);

                if (!existing) {
                    // آیتمی که در دستگاه هست ولی هنوز در ابر نیست حفظ می‌شود
                    map.set(key, localItem);
                } else {
                    // اگر هر دو جا هست، نسخه‌ای که کامل‌تر یا جدیدتر است انتخاب می‌شود
                    const localTime = localItem.completedAt || localItem.updatedAt || 0;
                    const cloudTime = existing.completedAt || existing.updatedAt || 0;

                    if (localItem.status === 'completed' && existing.status !== 'completed') {
                        map.set(key, localItem);
                    } else if (localTime > cloudTime) {
                        map.set(key, localItem);
                    } else if ((localItem.realTime || 0) > (existing.realTime || 0)) {
                        map.set(key, localItem);
                    }
                }
            });

            return Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
        }

        // ب) ذخیره‌سازی مستقیم در LocalStorage بدون ایجاد حلقه تکراری
        function saveToLocalSilently() {
            localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts || []));
            localStorage.setItem('sp_pro_settings', JSON.stringify(state.settings || {}));
            localStorage.setItem('sp_pro_subjects', JSON.stringify(state.subjectGroups || []));
            localStorage.setItem('tilo_schedule', JSON.stringify(state.schedule || []));
            localStorage.setItem('tilo_archive', JSON.stringify(state.archive || []));
            localStorage.setItem('tilo_problems', JSON.stringify(state.problems || []));
            if (typeof state.updateMainChart === 'function') {
                state.updateMainChart();
            }
        }

        // ج) دریافت اطلاعات از Firestore و ادغام ایمن با اطلاعات فعلی دستگاه
        async function safePullAndMerge(uid, db) {
            if (!uid || !db) return;
            try {
                const refDoc = fb.doc(db, 'users', uid);
                const snap = await fb.getDoc(refDoc);

                if (snap.exists()) {
                    const cloudData = snap.data();

                    // ۱. ادغام ایمن پارت‌ها، برنامه هفتگی و آرشیو (هیچ داده‌ای پاک نمی‌شود)
                    state.parts = mergeItemsById(state.parts, cloudData.parts);
                    state.schedule = mergeItemsById(state.schedule, cloudData.schedule);
                    state.archive = mergeItemsById(state.archive, cloudData.archive);
                    state.problems = mergeItemsById(state.problems || [], cloudData.problems || []);

                    // ۲. ادغام تنظیمات
                    if (cloudData.settings) {
                        state.settings = {
                            ...cloudData.settings,
                            ...state.settings,
                            userName: state.settings.userName || cloudData.settings.userName || '',
                            onboarded: true
                        };
                    }

                    // ۳. ادغام لیست دروس سفارشی
                    if (Array.isArray(cloudData.subjectGroups) && cloudData.subjectGroups.length > 0) {
                        const mergedGroups = JSON.parse(JSON.stringify(state.subjectGroups));
                        cloudData.subjectGroups.forEach((cGroup, idx) => {
                            if (mergedGroups[idx] && Array.isArray(cGroup.items)) {
                                const itemSet = new Set([...mergedGroups[idx].items, ...cGroup.items]);
                                mergedGroups[idx].items = Array.from(itemSet);
                            }
                        });
                        state.subjectGroups = mergedGroups;
                    }

                    saveToLocalSilently();
                    // ارسال نسخه نهایی ادغام‌شده به ابر برای یکسان‌سازی کامل
                    await safePushToCloud(uid, db);
                } else {
                    // اگر کاربر جدید است، اطلاعات محلی فعلی او به حسابش منتقل می‌شود
                    await safePushToCloud(uid, db);
                }
            } catch (err) {
                console.error("Tilo Cloud Pull Error:", err);
                updateSyncBadge('خطا در دریافت ابری (بررسی قوانین Firestore)', 'text-roseSoft');
            }
        }

        // د) ارسال ایمن اطلاعات به Firestore
        async function safePushToCloud(uid, db) {
            if (!uid || !db) return;
            try {
                updateSyncBadge('در حال ذخیره در فضای ابری...', 'text-tealSoft');
                const refDoc = fb.doc(db, 'users', uid);
                await fb.setDoc(refDoc, {
                    parts: JSON.parse(JSON.stringify(state.parts || [])),
                    settings: JSON.parse(JSON.stringify(state.settings || {})),
                    subjectGroups: JSON.parse(JSON.stringify(state.subjectGroups || [])),
                    schedule: JSON.parse(JSON.stringify(state.schedule || [])),
                    archive: JSON.parse(JSON.stringify(state.archive || [])),
                problems: JSON.parse(JSON.stringify(state.problems || [])),
                    updatedAt: Date.now()
                }, { merge: true });

                const nowStr = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
                localStorage.setItem('tilo_last_sync', nowStr);
                updateSyncBadge(`آخرین همگام‌سازی موفق: ${nowStr}`, 'text-sage');
            } catch (err) {
                console.error("Tilo Cloud Push Error:", err);
                updateSyncBadge('خطا در همگام‌سازی (احتمالاً قوانین Firestore تنظیم نشده)', 'text-roseSoft');
            }
        }

        // هـ) راه‌اندازی مجدد و استاندارد اتصال Firebase با ماندگاری دائمی (Local Persistence)
        let activeDb = null;

        async function setupPersistentFirebase(rawConfigStr) {
            if (!rawConfigStr) return;
            try {
                const cfg = JSON.parse(rawConfigStr);
                const app = fb.initializeApp(cfg);
                const auth = fb.getAuth(app);
                activeDb = fb.getFirestore(app);
                state.authInstance = auth;

                // تنظیم ماندگاری دائمی نشست روی مرورگر (جلوگیری از خروج با رفرش صفحه)
                try {
                    await fbAuth.setPersistence(auth, fbAuth.indexedDBLocalPersistence);
                } catch {
                    await fbAuth.setPersistence(auth, fbAuth.browserLocalPersistence);
                }

                // بررسی نتیجه برگشت از صفحه لاگین گوگل (در صورت استفاده از Redirect در موبایل)
                fbAuth.getRedirectResult(auth).catch(err => {
                    console.warn("Redirect Auth Info:", err.message);
                });

                // گوش دادن به وضعیت ورود کاربر
                fb.onAuthStateChanged(auth, async (user) => {
                    state.currentUser = user || null;
                    if (user) {
                        localStorage.setItem('tilo_cached_user', JSON.stringify({
                            uid: user.uid,
                            displayName: user.displayName || '',
                            email: user.email || ''
                        }));
                        if (!state.settings.userName && user.displayName) {
                            state.settings.userName = user.displayName;
                        }
                        state.showWelcomeModal = false;
                        await safePullAndMerge(user.uid, activeDb);
                    } else {
                        localStorage.removeItem('tilo_cached_user');
                        updateSyncBadge('حالت آفلاین (ذخیره در حافظه دستگاه)', 'text-amberSoft');
                    }
                });
            } catch (err) {
                console.error("Firebase Setup Error:", err);
            }
        }

        // و) بازنویسی متدهای ورود، خروج و همگام‌سازی روی State اصلی برنامه
        state.loginWithGoogle = async () => {
            if (!state.authInstance) {
                alert('ابتدا کد کانفیگ Firebase پروژه خود را در بخش تنظیمات وارد و ذخیره کنید.');
                return;
            }
            const provider = new fb.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });

            try {
                await fbAuth.setPersistence(state.authInstance, fbAuth.browserLocalPersistence);
                await fb.signInWithPopup(state.authInstance, provider);
            } catch (err) {
                // اگر پاپ‌آپ در مرورگر گوشی مسدود شد، خودکار از روش هدایت مستقیم استفاده کن
                if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
                    await fbAuth.signInWithRedirect(state.authInstance, provider);
                } else {
                    alert('خطا در ورود با گوگل: ' + err.message);
                }
            }
        };

        state.logoutGoogle = async () => {
            if (!confirm('آیا می‌خواهید از حساب گوگل خارج شوید؟ (اطلاعات روی دستگاه شما باقی می‌ماند)')) return;
            if (state.authInstance) {
                await fb.signOut(state.authInstance);
                state.currentUser = null;
                localStorage.removeItem('tilo_cached_user');
                updateSyncBadge('خارج شدید (حالت حافظه محلی)', 'text-amberSoft');
            }
        };

        state.syncToCloud = async () => {
            if (!state.currentUser || !activeDb) {
                alert('ابتدا وارد حساب گوگل خود شوید.');
                return;
            }
            await safePullAndMerge(state.currentUser.uid, activeDb);
        };

        state.saveFirebaseConfig = () => {
            try {
                const cleaned = (state.firebaseConfigInput || '').trim();
                JSON.parse(cleaned);
                localStorage.setItem('tilo_fb_config', cleaned);
                setupPersistentFirebase(cleaned);
                alert('تنظیمات فضای ابری با ماندگاری دائمی فعال شد!');
            } catch {
                alert('فرمت کد وارد شده باید JSON معتبر باشد.');
            }
        };

        // اتصال همگام‌سازی خودکار به تابع saveAll برنامه
        const originalSaveAll = state.saveAll;
        let syncTimeout = null;
        state.saveAll = () => {
            if (typeof originalSaveAll === 'function') originalSaveAll();
            if (state.currentUser && activeDb) {
                clearTimeout(syncTimeout);
                syncTimeout = setTimeout(() => {
                    safePushToCloud(state.currentUser.uid, activeDb);
                }, 800);
            }
        };

        // ز) افزودن نوار وضعیت دقیق همگام‌سازی در بخش تنظیمات
        function updateSyncBadge(text, colorClass) {
            let badge = document.getElementById('tilo-cloud-status-detail');
            if (!badge) {
                const settingsContainer = document.querySelector('[v-show="currentTab === \'settings\'"] .soft-card');
                if (settingsContainer) {
                    badge = document.createElement('div');
                    badge.id = 'tilo-cloud-status-detail';
                    badge.className = 'text-[11px] bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center mt-2';
                    settingsContainer.appendChild(badge);
                }
            }
            if (badge) {
                badge.innerHTML = `
                    <span class="${colorClass} font-bold"><i class="fas fa-cloud mr-1"></i> ${text}</span>
                    <span class="text-slate-500 text-[10px]">ماندگاری نشست: فعال ✓</span>
                `;
            }
        }

        // اجرای اولیه در صورت وجود کانفیگ ذخیره‌شده
        const savedCfg = localStorage.getItem('tilo_fb_config');
        if (savedCfg) {
            setupPersistentFirebase(savedCfg);
        }
    }
})();
