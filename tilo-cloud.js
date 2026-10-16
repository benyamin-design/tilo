/**
 * Tilo Cloud & Auth Persistence Module (Stage 1)
 * متصل‌شونده به هسته اصلی برای ورود خودکار و ذخیره ابری
 */
(async function initTiloCloudModule() {
    const FB_VERSION = "10.8.0";
    let authModule = null;

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
        console.error("Tilo Cloud: خطا در بارگذاری احراز هویت:", err);
        return;
    }

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

        async function setupPersistentFirebase(rawConfigStr) {
            if (!rawConfigStr) return;
            try {
                const cfg = JSON.parse(rawConfigStr);
                const app = fb.initializeApp(cfg);
                const auth = fb.getAuth(app);
                const activeDb = fb.getFirestore(app);
                state.authInstance = auth;

                try {
                    await fbAuth.setPersistence(auth, fbAuth.indexedDBLocalPersistence);
                } catch {
                    await fbAuth.setPersistence(auth, fbAuth.browserLocalPersistence);
                }

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
                    } else {
                        localStorage.removeItem('tilo_cached_user');
                    }
                });
            } catch (err) {
                console.error("Firebase Setup Error:", err);
            }
        }

        state.loginWithGoogle = async () => {
            if (!state.authInstance) {
                alert('ابتدا کانفیگ فایربیس را در تنظیمات وارد کنید.');
                return;
            }
            const provider = new fb.GoogleAuthProvider();
            try {
                await fbAuth.setPersistence(state.authInstance, fbAuth.browserLocalPersistence);
                await fb.signInWithPopup(state.authInstance, provider);
            } catch (err) {
                if (err.code === 'auth/popup-blocked') {
                    await fbAuth.signInWithRedirect(state.authInstance, provider);
                } else {
                    alert('خطا در ورود با گوگل: ' + err.message);
                }
            }
        };

        state.logoutGoogle = async () => {
            if (!confirm('آیا از حساب گوگل خارج می‌شوید؟')) return;
            if (state.authInstance) {
                await fb.signOut(state.authInstance);
                state.currentUser = null;
                localStorage.removeItem('tilo_cached_user');
            }
        };

        state.saveFirebaseConfig = () => {
            try {
                const cleaned = (state.firebaseConfigInput || '').trim();
                JSON.parse(cleaned);
                localStorage.setItem('tilo_fb_config', cleaned);
                setupPersistentFirebase(cleaned);
                alert('فضای ابری و ماندگاری نشست فعال شد!');
            } catch {
                alert('فرمت کد باید JSON معتبر باشد.');
            }
        };

        const savedCfg = localStorage.getItem('tilo_fb_config');
        if (savedCfg) {
            state.firebaseConfigInput = savedCfg;
            setupPersistentFirebase(savedCfg);
        }
    }
})();
