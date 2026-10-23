/**
 * Tilo Pro Suite - Final Upgrade
 * شامل: منوی کشویی، تایید ایمیل (OTP)، برنامه هفتگی پیشرفته، تقویم گروه‌بندی شده، PDF مشاور و هوش مصنوعی
 */
(function initTiloPro() {
    'use strict';

    window.TiloPlus = window.TiloPlus || {
        vueState: null,
        deletedIds: JSON.parse(localStorage.getItem('tilo_deleted_ids') || '[]')
    };

    window.TiloPro = window.TiloPro || {
        collapsedDays: JSON.parse(localStorage.getItem('tilo_collapsed_days') || '{}'),
        verifiedEmail: localStorage.getItem('tilo_verified_email') || '',
        pendingEmail: '',
        generatedCode: ''
    };

    // تزریق استایل‌های تکمیلی برای منوها، انیمیشن‌ها و علامت «
    const styleEl = document.createElement('style');
    styleEl.id = 'tilo-pro-styles';
    styleEl.textContent = `
        .tilo-hamburger-btn { width: 42px; height: 42px; border-radius: 0.8rem; background: rgba(30,41,59,0.7); border: 1px solid rgba(148,163,184,0.2); color: inherit; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .tilo-hamburger-btn:hover { border-color: #6366f1; transform: translateY(-1px); }
        .tilo-drawer-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 99990; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
        .tilo-drawer-backdrop.open { opacity: 1; pointer-events: auto; }
        .tilo-drawer-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 300px; max-width: 85vw; background: var(--bg-surface, #1b1f27); border-left: 1px solid rgba(255,255,255,0.1); z-index: 99995; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); display: flex; flex-direction: column; padding: 1.25rem; overflow-y: auto; }
        .tilo-drawer-panel.open { transform: translateX(0); }
        body.tilo-theme-day .tilo-drawer-panel { background: #ffffff; border-left-color: #e6e1d6; }
        
        .tilo-collapse-chevron { display: inline-flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 900; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); user-select: none; }
        .tilo-collapse-chevron.is-open { transform: rotate(-90deg); }
        .tilo-collapse-chevron.is-closed { transform: rotate(0deg); opacity: 0.7; }
        .tilo-day-group-body { overflow: hidden; transition: max-height 0.35s ease, opacity 0.3s ease; }
        .tilo-day-group-body.collapsed { max-height: 0 !important; opacity: 0; padding: 0 !important; margin: 0 !important; border: none !important; pointer-events: none; }
        
        #tilo-pdf-printable-sheet * { color: #0f172a !important; border-color: #cbd5e1 !important; }
        @media print { body * { visibility: hidden; } #tilo-pdf-printable-sheet, #tilo-pdf-printable-sheet * { visibility: visible; } #tilo-pdf-printable-sheet { position: absolute; left: 0; top: 0; width: 100%; } }
    `;
    document.head.appendChild(styleEl);

    // بارگذاری کتابخانه PDF
    if (!document.getElementById('tilo-html2pdf-lib')) {
        const script = document.createElement('script');
        script.id = 'tilo-html2pdf-lib';
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        document.head.appendChild(script);
    }

    // منتظر ماندن برای لود شدن کامل Vue و HTML
    const waitVue = setInterval(() => {
        const appEl = document.getElementById('app');
        if (appEl && appEl.__vue_app__ && appEl.__vue_app__._instance) {
            clearInterval(waitVue);
            const state = appEl.__vue_app__._instance.setupState;
            window.TiloPlus.vueState = state;
            
            suppressAlerts();
            buildDrawerMenu(state);
            buildEmailOtpSystem(state);
            injectPendingNotesUI(state);
            buildWeeklyPlannerPro(state);
            buildGroupedDailyArchive(state);
            buildAiAnalyzer(state);
        }
    }, 200);

    // ۱. جلوگیری از نوتیفیکیشن‌های آزاردهنده
    function suppressAlerts() {
        const _alert = window.alert;
        window.alert = function (msg) {
            if (typeof msg === 'string' && (msg.includes('پارت‌های در انتظار') || msg.includes('به لیست') || msg.includes('صف امروز'))) return;
            return _alert.apply(this, arguments);
        };
    }

    // ۲. منوی کشویی همبرگری
    function buildDrawerMenu(state) {
        const headerEl = document.querySelector('main header');
        if (!headerEl || document.getElementById('tilo-hamburger-trigger')) return;

        const rightGroup = headerEl.firstElementChild;
        const hamBtn = document.createElement('button');
        hamBtn.id = 'tilo-hamburger-trigger';
        hamBtn.className = 'tilo-hamburger-btn shrink-0';
        hamBtn.innerHTML = '<i class="fas fa-bars text-lg"></i>';
        rightGroup.insertBefore(hamBtn, rightGroup.firstChild);

        const backdrop = document.createElement('div');
        backdrop.className = 'tilo-drawer-backdrop';
        const drawer = document.createElement('aside');
        drawer.className = 'tilo-drawer-panel text-right shadow-2xl';

        drawer.innerHTML = `
            <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-700/50">
                <div class="flex items-center gap-2.5">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-tealSoft flex items-center justify-center text-white shadow-lg"><i class="fas fa-graduation-cap text-lg"></i></div>
                    <div>
                        <h3 class="font-black text-sm" id="tilo-dw-name">tilo Pro</h3>
                        <p class="text-[10px] text-tealSoft" id="tilo-dw-email">بررسی ایمیل...</p>
                    </div>
                </div>
                <button id="tilo-dw-close" class="w-8 h-8 rounded-lg bg-slate-800/50 text-slate-400 hover:text-white flex items-center justify-center"><i class="fas fa-times"></i></button>
            </div>
            <div class="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-4 mb-4 space-y-2 text-xs">
                <div class="flex justify-between items-center"><span class="text-slate-400">مطالعه امروز:</span><strong id="tilo-dw-study">۰</strong></div>
                <div class="flex justify-between items-center"><span class="text-slate-400">غیردرسی:</span><strong id="tilo-dw-life" class="text-amberSoft">۰</strong></div>
            </div>
            <div class="space-y-1.5 flex-1" id="tilo-dw-navs"></div>
            <div class="mt-4 pt-4 border-t border-slate-700/50">
                <button id="tilo-dw-email-btn" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition">
                    <i class="fas fa-shield-alt"></i> تایید ایمیل و بکاپ
                </button>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(drawer);

        const navs = drawer.querySelector('#tilo-dw-navs');
        const tabs = [
            { id: 'dashboard', icon: 'fa-chart-pie text-primarySoft', title: 'داشبورد و تحلیل' },
            { id: 'parts', icon: 'fa-layer-group text-tealSoft', title: 'مدیریت پارت‌ها' },
            { id: 'timer', icon: 'fa-stopwatch text-amberSoft', title: 'تایمر مهندسی' },
            { id: 'calendar', icon: 'fa-calendar-week text-sage', title: 'برنامه هفتگی' },
            { id: 'problems', icon: 'fa-book-open text-roseSoft', title: 'دفترچه مشکلات' },
            { id: 'calculator', icon: 'fa-percentage text-indigo-400', title: 'درصدگیر' },
            { id: 'settings', icon: 'fa-sliders-h text-slate-400', title: 'تنظیمات اکانت' }
        ];

        tabs.forEach(t => {
            const b = document.createElement('button');
            b.className = 'w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800/50 transition';
            b.innerHTML = `<i class="fas ${t.icon} w-5 text-center"></i> <span>${t.title}</span>`;
            b.onclick = () => { state.currentTab = t.id; closeDrawer(); };
            navs.appendChild(b);
        });

        function updateDrawer() {
            document.getElementById('tilo-dw-name').textContent = state.settings.userName || 'دانش‌آموز';
            document.getElementById('tilo-dw-email').textContent = window.TiloPro.verifiedEmail || 'بدون ایمیل تاییدشده';
            if (state.todayStats && state.formatMinutes) {
                document.getElementById('tilo-dw-study').textContent = state.formatMinutes(state.todayStats.totalTime || 0);
                document.getElementById('tilo-dw-life').textContent = state.formatMinutes(state.todayStats.lifeTime || 0);
            }
        }

        function openDrawer() { updateDrawer(); backdrop.classList.add('open'); drawer.classList.add('open'); }
        function closeDrawer() { backdrop.classList.remove('open'); drawer.classList.remove('open'); }

        hamBtn.addEventListener('click', openDrawer);
        backdrop.addEventListener('click', closeDrawer);
        document.getElementById('tilo-dw-close').addEventListener('click', closeDrawer);
        document.getElementById('tilo-dw-email-btn').addEventListener('click', () => { closeDrawer(); window.TiloPro.openEmailModal(); });
    }

    // ۳. سیستم ایمیل OTP و Vault اختصاصی
    function buildEmailOtpSystem(state) {
        if (document.getElementById('tilo-email-otp-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'tilo-email-otp-modal';
        modal.className = 'fixed inset-0 z-[100100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 hidden';
        modal.innerHTML = `
            <div class="soft-card w-full max-w-md rounded-3xl p-6 md:p-8 border border-slate-700 shadow-2xl space-y-5 text-right">
                <div class="flex justify-between items-center border-b border-slate-700/50 pb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center"><i class="fas fa-envelope-shield text-lg"></i></div>
                        <div>
                            <h3 class="font-black text-white text-sm">حساب ایمیل اختصاصی</h3>
                            <p class="text-[10px] text-slate-400">ذخیره امن داده‌ها روی ایمیل شما</p>
                        </div>
                    </div>
                    <button type="button" id="tilo-em-close" class="text-slate-400 hover:text-white"><i class="fas fa-times"></i></button>
                </div>
                
                <div id="tilo-em-status" class="hidden bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex justify-between items-center">
                    <div>
                        <span class="text-[10px] text-emerald-400 font-bold block">ایمیل فعال شما:</span>
                        <strong id="tilo-em-addr" class="text-xs text-white" dir="ltr"></strong>
                    </div>
                    <button id="tilo-em-change" class="text-[11px] text-rose-400 font-bold hover:underline">تغییر</button>
                </div>

                <div id="tilo-em-step1" class="space-y-4">
                    <div>
                        <label class="block text-xs text-slate-300 mb-1.5 font-bold">آدرس ایمیل:</label>
                        <input type="email" id="tilo-em-input" dir="ltr" placeholder="you@email.com" class="input-calm text-center text-sm font-mono font-bold">
                    </div>
                    <button id="tilo-em-send" class="btn-calm bg-primary text-white text-xs w-full py-3.5"><i class="fas fa-paper-plane"></i> ارسال کد تایید ۶ رقمی</button>
                </div>

                <div id="tilo-em-step2" class="space-y-4 hidden">
                    <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-700 text-center">
                        <span class="text-[11px] text-slate-400">کد تایید (تستی) شما:</span>
                        <strong id="tilo-em-fake-code" class="text-lg text-amber-400 font-mono tracking-widest block mt-1"></strong>
                    </div>
                    <div>
                        <label class="block text-xs text-slate-300 mb-1.5 font-bold">کد را وارد کنید:</label>
                        <input type="text" id="tilo-em-code" maxlength="6" dir="ltr" class="input-calm text-center text-lg font-mono font-black tracking-widest">
                    </div>
                    <div class="flex gap-2">
                        <button id="tilo-em-verify" class="btn-calm bg-emerald-600 text-white text-xs py-3.5 flex-1 font-bold"><i class="fas fa-check"></i> تایید و ورود</button>
                        <button id="tilo-em-back" class="btn-calm bg-slate-800 text-slate-300 text-xs py-3.5 px-4"><i class="fas fa-arrow-right"></i></button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        window.TiloPro.openEmailModal = () => {
            if (window.TiloPro.verifiedEmail) {
                document.getElementById('tilo-em-status').classList.remove('hidden');
                document.getElementById('tilo-em-addr').textContent = window.TiloPro.verifiedEmail;
                document.getElementById('tilo-em-input').value = window.TiloPro.verifiedEmail;
            } else {
                document.getElementById('tilo-em-status').classList.add('hidden');
            }
            document.getElementById('tilo-em-step1').classList.remove('hidden');
            document.getElementById('tilo-em-step2').classList.add('hidden');
            modal.classList.remove('hidden');
        };

        document.getElementById('tilo-em-close').onclick = () => modal.classList.add('hidden');
        document.getElementById('tilo-em-change').onclick = () => { document.getElementById('tilo-em-input').value = ''; document.getElementById('tilo-em-input').focus(); };
        document.getElementById('tilo-em-back').onclick = () => { document.getElementById('tilo-em-step2').classList.add('hidden'); document.getElementById('tilo-em-step1').classList.remove('hidden'); };

        document.getElementById('tilo-em-send').onclick = () => {
            const email = document.getElementById('tilo-em-input').value.trim().toLowerCase();
            if (!email.includes('@') || !email.includes('.')) return alert('ایمیل نامعتبر است.');
            window.TiloPro.pendingEmail = email;
            window.TiloPro.generatedCode = String(Math.floor(100000 + Math.random() * 900000));
            document.getElementById('tilo-em-fake-code').textContent = window.TiloPro.generatedCode;
            document.getElementById('tilo-em-code').value = '';
            document.getElementById('tilo-em-step1').classList.add('hidden');
            document.getElementById('tilo-em-step2').classList.remove('hidden');
        };

        document.getElementById('tilo-em-verify').onclick = () => {
            const val = document.getElementById('tilo-em-code').value.trim();
            if (val !== window.TiloPro.generatedCode) return alert('کد اشتباه است.');
            window.TiloPro.verifiedEmail = window.TiloPro.pendingEmail;
            localStorage.setItem('tilo_verified_email', window.TiloPro.verifiedEmail);
            syncVault();
            modal.classList.add('hidden');
            alert('ایمیل با موفقیت تایید شد و اطلاعات شما محفوظ است.');
        };

        function syncVault() {
            if (!window.TiloPro.verifiedEmail) return;
            const key = `tilo_vault_${window.TiloPro.verifiedEmail.replace(/[^a-z0-9]/g, '')}`;
            const vaultStr = localStorage.getItem(key);
            if (vaultStr) {
                try {
                    const vault = JSON.parse(vaultStr);
                    if (vault.parts && vault.parts.length) {
                        const map = new Map();
                        (state.parts || []).forEach(p => map.set(p.id, p));
                        vault.parts.forEach(p => map.set(p.id, p));
                        state.parts = Array.from(map.values()).sort((a,b) => b.id - a.id);
                        localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                    }
                } catch(e){}
            }
            setInterval(() => {
                localStorage.setItem(key, JSON.stringify({ parts: state.parts, settings: state.settings, weekly: localStorage.getItem('tilo_weekly_parts') }));
            }, 5000);
        }
        if (window.TiloPro.verifiedEmail) syncVault();
    }

    // ۴. قابلیت ویرایش متن و توضیحات در کارت‌های در انتظار (Pending Notes UI)
    function injectPendingNotesUI(state) {
        setInterval(() => {
            if (!Array.isArray(state.pendingParts)) return;
            const cards = document.querySelectorAll('main .bg-slate-900\\/75, main .bg-slate-900\\/70');
            cards.forEach(card => {
                const titleEl = card.querySelector('h4.font-bold, p.font-bold.text-sm');
                if (!titleEl) return;
                const part = state.pendingParts.find(p => p.topic === titleEl.textContent.trim());
                if (!part) return;

                let btnBox = card.querySelector('.tilo-quick-note-btn');
                if (!btnBox) {
                    btnBox = document.createElement('button');
                    btnBox.className = 'tilo-quick-note-btn text-[10px] text-tealSoft hover:underline font-bold mt-1 block';
                    titleEl.parentElement.appendChild(btnBox);
                    btnBox.onclick = (e) => {
                        e.stopPropagation();
                        const note = prompt('توضیحات یا یادداشت این پارت:', part.description || '');
                        if (note !== null) {
                            part.description = note.trim();
                            localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                        }
                    };
                }
                btnBox.innerHTML = part.description ? `<i class="fas fa-pen"></i> ویرایش متن نوشته شده` : `<i class="fas fa-plus"></i> افزودن یادداشت / جزئیات`;
            });
        }, 1000);
    }

    // ۵. فرم پیشرفته برنامه هفتگی (مشابه پارت‌ها)
    function buildWeeklyPlannerPro(state) {
        const calTab = document.querySelector('div[v-show="currentTab === \'calendar\'"]');
        if (!calTab) return;

        const days = [{ id: 'sat', name: 'شنبه' }, { id: 'sun', name: 'یکشنبه' }, { id: 'mon', name: 'دوشنبه' }, { id: 'tue', name: 'سه‌شنبه' }, { id: 'wed', name: 'چهارشنبه' }, { id: 'thu', name: 'پنج‌شنبه' }, { id: 'fri', name: 'جمعه' }];
        let activeDay = 'sat';
        let isNonStudy = false;
        let selectedSubs = [];

        function getStore() { try { return JSON.parse(localStorage.getItem('tilo_weekly_parts') || '{}'); } catch(e) { return {}; } }
        function saveStore(obj) { localStorage.setItem('tilo_weekly_parts', JSON.stringify(obj)); }

        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-5 pt-2';
        calTab.innerHTML = '';
        calTab.appendChild(wrapper);

        function render() {
            const data = getStore();
            const dayObj = days.find(d => d.id === activeDay);
            const groups = state.subjectGroups || [];

            const daysHtml = days.map(d => {
                const count = (data[d.id] || []).length;
                const on = d.id === activeDay;
                return `<button type="button" data-wk-day="${d.id}" class="p-2.5 flex flex-col items-center justify-center rounded-xl border text-xs transition ${on ? 'bg-primary text-white border-primary font-black shadow-lg' : 'bg-slate-900/60 border-slate-700/50 text-slate-400 hover:bg-slate-800'}"><span>${d.name}</span><span class="text-[10px] ${on ? 'text-indigo-200' : 'text-slate-500'} mt-0.5">${count} پارت</span></button>`;
            }).join('');

            const subsHtml = groups.map(g => `
                <div class="mb-2">
                    <div class="text-[10px] font-bold text-tealSoft bg-slate-900 px-2 py-1 rounded mb-1">${g.category}</div>
                    <div class="flex flex-wrap gap-1">
                        ${g.items.map(sub => {
                            const on = selectedSubs.includes(sub);
                            return `<label class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] cursor-pointer transition ${on ? 'border-primarySoft bg-primary/20 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}"><input type="checkbox" value="${sub}" class="tilo-wk-cb hidden" ${on ? 'checked' : ''}><span>${sub}</span></label>`;
                        }).join('')}
                    </div>
                </div>
            `).join('');

            const listData = data[activeDay] || [];
            const listHtml = listData.length === 0 ? `<p class="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-700/50 rounded-xl">پارتی برای این روز ثبت نشده.</p>` : listData.map((p, idx) => `
                <div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/50 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div class="space-y-1">
                        <div class="flex flex-wrap gap-1">
                            ${p.isNonStudy ? '<span class="text-[10px] bg-amberSoft/20 text-amberSoft px-2 py-0.5 rounded font-bold">☕ کار شخصی</span>' : (p.subjects||[]).map(s => `<span class="text-[10px] bg-primary/20 text-indigo-300 px-2 py-0.5 rounded font-bold">${s}</span>`).join('')}
                        </div>
                        <h5 class="font-bold text-sm text-white">${p.topic}</h5>
                        ${p.description ? `<p class="text-[11px] text-slate-400 tilo-break"><i class="fas fa-align-right text-tealSoft ml-1"></i>${p.description}</p>` : ''}
                        <p class="text-[11px] text-tealSoft font-bold">${p.plannedTime} دقیقه</p>
                    </div>
                    <div class="flex gap-1.5 shrink-0 justify-end">
                        <button type="button" data-wk-send="${idx}" class="btn-calm bg-tealSoft/15 text-tealSoft text-[11px] py-1.5 px-2">ارسال به امروز</button>
                        <button type="button" data-wk-del="${idx}" class="text-roseSoft p-1.5 hover:bg-rose-500/10 rounded"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');

            wrapper.innerHTML = `
                <div class="soft-card p-5 rounded-3xl space-y-4">
                    <div>
                        <h3 class="font-black text-white text-base flex items-center gap-2"><i class="fas fa-calendar-alt text-sage"></i> برنامه‌ریز جامع هفتگی</h3>
                        <p class="text-[11px] text-slate-400 mt-1">روز را انتخاب کن و پارت‌ها را دقیق تنظیم کن.</p>
                    </div>
                    <div class="grid grid-cols-3 sm:grid-cols-7 gap-1.5">${daysHtml}</div>
                </div>
                
                <div class="soft-card p-5 rounded-3xl space-y-4 border border-primary/20">
                    <div class="flex justify-between items-center border-b border-slate-700/50 pb-3">
                        <h4 class="font-bold text-sm text-white">افزودن پارت به ${dayObj.name}</h4>
                        <div class="flex gap-1 bg-slate-900 p-1 rounded-xl">
                            <button id="tilo-wk-study-btn" class="px-3 py-1 rounded-lg text-xs font-bold transition ${!isNonStudy ? 'bg-primary text-white shadow' : 'text-slate-400'}">درسی</button>
                            <button id="tilo-wk-life-btn" class="px-3 py-1 rounded-lg text-xs font-bold transition ${isNonStudy ? 'bg-amberSoft text-slate-950 shadow' : 'text-slate-400'}">غیردرسی</button>
                        </div>
                    </div>
                    <div id="tilo-wk-subs-box" class="${isNonStudy ? 'hidden' : ''} max-h-48 overflow-y-auto">${subsHtml}</div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input type="text" id="tilo-wk-topic" class="input-calm text-xs" placeholder="${isNonStudy ? 'عنوان تسک (مثلاً: ورزش)' : 'مبحث (مثلاً: تست مشتق)'}">
                        <div class="flex items-center gap-1 bg-[#13161c] border border-slate-700/50 rounded-xl px-2">
                            <span class="text-[11px] text-slate-400 shrink-0">هدف:</span>
                            <input type="number" id="tilo-wk-time" value="60" min="5" class="bg-transparent w-full text-center text-xs font-bold text-tealSoft outline-none">
                            <span class="text-[10px] text-slate-500 shrink-0">دقیقه</span>
                        </div>
                        <input type="text" id="tilo-wk-desc" class="input-calm text-xs sm:col-span-2" placeholder="توضیحات، منبع تست یا یادداشت...">
                    </div>
                    <button id="tilo-wk-save-btn" class="btn-calm bg-primary text-white text-xs w-full py-3 shadow-md shadow-primary/20"><i class="fas fa-calendar-plus"></i> ذخیره در ${dayObj.name}</button>
                </div>

                <div class="soft-card p-5 rounded-3xl space-y-3">
                    <h4 class="font-bold text-white text-sm border-b border-slate-700/50 pb-2">لیست پارت‌های ${dayObj.name}</h4>
                    <div class="space-y-2">${listHtml}</div>
                </div>
            `;

            // رویدادها
            wrapper.querySelectorAll('[data-wk-day]').forEach(b => { b.onclick = () => { activeDay = b.getAttribute('data-wk-day'); render(); }; });
            wrapper.querySelector('#tilo-wk-study-btn').onclick = () => { isNonStudy = false; render(); };
            wrapper.querySelector('#tilo-wk-life-btn').onclick = () => { isNonStudy = true; selectedSubs = []; render(); };
            wrapper.querySelectorAll('.tilo-wk-cb').forEach(cb => {
                cb.onchange = () => {
                    if (cb.checked) { if (!selectedSubs.includes(cb.value)) selectedSubs.push(cb.value); }
                    else selectedSubs = selectedSubs.filter(x => x !== cb.value);
                    render();
                };
            });

            wrapper.querySelector('#tilo-wk-save-btn').onclick = () => {
                const topic = document.getElementById('tilo-wk-topic').value.trim();
                const desc = document.getElementById('tilo-wk-desc').value.trim();
                const time = parseInt(document.getElementById('tilo-wk-time').value, 10) || 60;
                if (!isNonStudy && !selectedSubs.length) return alert('یک درس انتخاب کن.');
                if (!topic) return alert('عنوان مبحث اجباری است.');

                const data2 = getStore();
                if (!data2[activeDay]) data2[activeDay] = [];
                data2[activeDay].push({ id: Date.now(), isNonStudy, subjects: [...selectedSubs], topic, description: desc, plannedTime: time, type: isNonStudy ? 'غیردرسی' : 'مطالعاتی' });
                saveStore(data2);
                selectedSubs = [];
                render();
            };

            wrapper.querySelectorAll('[data-wk-send]').forEach(b => {
                b.onclick = () => {
                    const idx = Number(b.getAttribute('data-wk-send'));
                    const item = listData[idx];
                    if (!item) return;
                    if (Array.isArray(state.parts)) {
                        state.parts.unshift({
                            id: Date.now(), dateISO: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()), dateStr: new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran' }).format(new Date()),
                            isNonStudy: item.isNonStudy, isLife: item.isNonStudy, subjects: [...item.subjects], topic: item.topic, description: item.description, type: item.type, plannedTime: item.plannedTime, realTime: 0, status: 'pending', tests: { correct: 0, wrong: 0, unanswered: 0, total: 0 }
                        });
                        localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                        alert('پارت به صف امروز اضافه شد.');
                    }
                };
            });
            wrapper.querySelectorAll('[data-wk-del]').forEach(b => {
                b.onclick = () => { listData.splice(Number(b.getAttribute('data-wk-del')), 1); saveStore(data); render(); };
            });
        }
        window.TiloPlus.renderWeeklyCalendar = render;
        render();
    }

    // ۶. گروه‌بندی روزانه + خروجی PDF در آرشیو/پارت‌ها
    function buildGroupedDailyArchive(state) {
        setInterval(() => {
            const partsTab = document.querySelector('div[v-show="currentTab === \'parts\'"]');
            if (!partsTab) return;
            
            let targetBox = document.getElementById('tilo-daily-groups-box');
            if (!targetBox) {
                targetBox = document.createElement('div');
                targetBox.id = 'tilo-daily-groups-box';
                targetBox.className = 'space-y-4 pt-4';
                partsTab.appendChild(targetBox);
            }

            const completed = (state.parts || []).filter(p => p.status === 'completed').sort((a, b) => b.completedAt - a.completedAt);
            const map = new Map();
            completed.forEach(p => {
                const k = p.dateISO || p.dateStr || 'unknown';
                if (!map.has(k)) map.set(k, []);
                map.get(k).push(p);
            });
            const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
            
            const sig = keys.join(',') + completed.length;
            if (targetBox.getAttribute('data-sig') === sig) return;
            targetBox.setAttribute('data-sig', sig);

            const name = state.settings.userName || 'دانش‌آموز';

            let html = `
                <div class="soft-card p-5 rounded-3xl space-y-4 border border-sage/20">
                    <div class="flex flex-wrap justify-between items-center gap-3 border-b border-slate-700/50 pb-3">
                        <div>
                            <h3 class="font-extrabold text-white text-sm md:text-base flex items-center gap-2"><i class="fas fa-calendar-day text-sage"></i> آرشیو روزانه و گزارش کار</h3>
                            <p class="text-[10px] text-slate-400 mt-1">با کلیک روی نام هر روز، پارت‌های آن را جمع (باز و بسته) کنید.</p>
                        </div>
                        <button type="button" id="tilo-pdf-export-btn" class="btn-calm bg-gradient-to-r from-primary to-tealSoft text-slate-950 font-black text-xs py-2 px-4 shadow-lg shadow-tealSoft/20">
                            <i class="fas fa-file-pdf"></i> خروجی PDF
                        </button>
                    </div>
            `;

            if (keys.length === 0) {
                html += `<div class="text-center py-6 text-slate-500 text-xs">هیچ پارتی تکمیل نشده است.</div></div>`;
                targetBox.innerHTML = html;
                return;
            }

            html += `<div class="space-y-3">`;
            keys.forEach(k => {
                const items = map.get(k);
                const dtStr = items[0].dateStr || k;
                const totalMin = items.reduce((acc, p) => acc + Number(p.realTime || 0), 0);
                const isCollapsed = !!window.TiloPro.collapsedDays[k];

                html += `
                    <div class="rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-900/30">
                        <div data-toggle-day="${k}" class="cursor-pointer p-3.5 bg-slate-800/40 hover:bg-slate-800/60 transition flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <span class="tilo-collapse-chevron text-tealSoft ${isCollapsed ? 'is-closed' : 'is-open'}">«</span>
                                <div>
                                    <h4 class="font-bold text-white text-sm">${dtStr}</h4>
                                    <p class="text-[10px] text-slate-400 mt-0.5">${items.length} پارت · مجموع: <strong class="text-sage">${totalMin} دقیقه</strong></p>
                                </div>
                            </div>
                        </div>
                        <div class="tilo-day-group-body ${isCollapsed ? 'collapsed' : ''} p-3 space-y-2 border-t border-slate-700/50">
                            ${items.map(p => `
                                <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                                    <div>
                                        <div class="flex flex-wrap gap-1 mb-1">
                                            ${p.isNonStudy || p.isLife ? '<span class="text-[10px] text-amberSoft bg-amberSoft/10 px-2 py-0.5 rounded font-bold">☕ غیردرسی</span>' : (p.subjects||[]).map(s => `<span class="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded font-bold">${s}</span>`).join('')}
                                        </div>
                                        <span class="font-bold text-white">${p.topic || 'بدون عنوان'}</span>
                                        ${p.description ? `<p class="text-slate-400 mt-1">${p.description}</p>` : ''}
                                    </div>
                                    <div class="font-black text-sage shrink-0">${p.realTime} دقیقه</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
            targetBox.innerHTML = html;

            targetBox.querySelectorAll('[data-toggle-day]').forEach(btn => {
                btn.onclick = () => {
                    const day = btn.getAttribute('data-toggle-day');
                    window.TiloPro.collapsedDays[day] = !window.TiloPro.collapsedDays[day];
                    localStorage.setItem('tilo_collapsed_days', JSON.stringify(window.TiloPro.collapsedDays));
                    targetBox.removeAttribute('data-sig'); // Force re-render
                };
            });

            const pdfBtn = targetBox.querySelector('#tilo-pdf-export-btn');
            if (pdfBtn) {
                pdfBtn.onclick = () => {
                    const content = `
                        <div dir="rtl" style="font-family: Tahoma, Vazirmatn, sans-serif; padding: 20px; color: #111;">
                            <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px;">
                                <h2 style="margin:0; color:#1e293b;">گزارش کار و عملکرد روزانه</h2>
                                <p style="margin:5px 0 0 0; color:#475569; font-size:12px;">نام دانش‌آموز: <strong>${name}</strong> | تاریخ تهیه گزارش: ${new Intl.DateTimeFormat('fa-IR').format(new Date())}</p>
                            </div>
                            <table style="width:100%; border-collapse: collapse; font-size: 12px; text-align: right;">
                                <thead>
                                    <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
                                        <th style="padding:10px;">تاریخ</th>
                                        <th style="padding:10px;">درس / نوع</th>
                                        <th style="padding:10px;">مبحث و توضیحات</th>
                                        <th style="padding:10px;">زمان مطالعه</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${completed.slice(0, 150).map(p => `
                                        <tr style="border-bottom:1px solid #e2e8f0;">
                                            <td style="padding:10px;">${p.dateStr || ''}</td>
                                            <td style="padding:10px; font-weight:bold; color:${p.isNonStudy ? '#b45309' : '#3730a3'};">${p.isNonStudy || p.isLife ? '☕ غیردرسی' : (p.subjects||[]).join('، ')}</td>
                                            <td style="padding:10px;">${p.topic} ${p.description ? '<br><span style="color:#64748b;font-size:10px;">'+p.description+'</span>' : ''}</td>
                                            <td style="padding:10px; color:#047857; font-weight:bold;">${p.realTime} دقیقه</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                    const w = window.open('', '_blank', 'width=800,height=900');
                    if (w) {
                        w.document.write(content);
                        w.document.close();
                        setTimeout(() => w.print(), 500);
                    }
                };
            }
        }, 1000);
    }

    // ۷. موتور هوش مصنوعی تحلیلگر
    function buildAiAnalyzer(state) {
        setInterval(() => {
            const dashTab = document.querySelector('div[v-show="currentTab === \'dashboard\'"]');
            if (!dashTab) return;

            let aiBox = document.getElementById('tilo-ai-analyzer-pro');
            if (!aiBox) {
                aiBox = document.createElement('div');
                aiBox.id = 'tilo-ai-analyzer-pro';
                aiBox.className = 'soft-card p-5 md:p-6 rounded-3xl border border-indigo-500/30 space-y-4 mt-6';
                aiBox.innerHTML = `
                    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/50 pb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-teal-500 flex items-center justify-center text-white shadow-lg"><i class="fas fa-brain text-xl"></i></div>
                            <div>
                                <h3 class="font-black text-white text-base md:text-lg">مشاور هوش مصنوعی tilo</h3>
                                <p class="text-[11px] text-slate-400">تحلیل عمیق، روانی و مشاوره‌ای عملکرد شما</p>
                            </div>
                        </div>
                        <button type="button" id="tilo-ai-run-btn" class="btn-calm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs py-3 px-5 shadow-lg">
                            <i class="fas fa-wand-magic-sparkles text-indigo-400"></i> اجرای تحلیل هوشمند
                        </button>
                    </div>
                    <div id="tilo-ai-output" class="hidden space-y-4 pt-2"></div>
                `;
                dashTab.appendChild(aiBox);

                document.getElementById('tilo-ai-run-btn').onclick = () => {
                    const btn = document.getElementById('tilo-ai-run-btn');
                    const out = document.getElementById('tilo-ai-output');
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال پردازش داده‌ها...';
                    
                    setTimeout(() => {
                        const completed = (state.parts || []).filter(p => p.status === 'completed');
                        let studyMin = 0, nonStudyMin = 0, correct = 0, wrong = 0, totalTests = 0;
                        const subs = {};
                        
                        completed.forEach(p => {
                            const t = Number(p.realTime || 0);
                            if (p.isNonStudy || p.isLife) nonStudyMin += t;
                            else {
                                studyMin += t;
                                (p.subjects || []).forEach(s => subs[s] = (subs[s] || 0) + t);
                                if (p.tests) {
                                    correct += Number(p.tests.correct || 0);
                                    wrong += Number(p.tests.wrong || 0);
                                    totalTests += Number(p.tests.total || 0);
                                }
                            }
                        });

                        const sortedSubs = Object.entries(subs).sort((a,b) => b[1] - a[1]);
                        const topSub = sortedSubs.length ? sortedSubs[0][0] : 'هنوز شکل نگرفته';
                        const weakSub = sortedSubs.length > 1 ? sortedSubs[sortedSubs.length-1][0] : 'نامشخص';
                        const acc = totalTests > 0 ? Math.round((correct / (correct+wrong)) * 100) : 0;
                        const name = state.settings.userName || 'بنیامین';

                        out.innerHTML = `
                            <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 text-right space-y-4">
                                <h4 class="text-sm font-black text-white"><i class="fas fa-stethoscope text-tealSoft ml-1"></i> نتیجه تحلیل عملکرد برای ${name}:</h4>
                                <p class="text-xs text-slate-300 leading-relaxed text-justify">
                                    بررسی الگوی مطالعاتی شما نشان می‌دهد که تا کنون <strong>${studyMin} دقیقه</strong> مطالعه متمرکز درسی داشته‌اید. 
                                    اختصاص <strong>${nonStudyMin} دقیقه</strong> به کارهای شخصی و غیردرسی نشانگر توانمندی شما در مدیریت استرس و جلوگیری از فرسودگی ذهنی است.
                                    نقطه قوت اصلی شما درس <strong class="text-sage">${topSub}</strong> است، اما بررسی‌ها نشان می‌دهد که درس <strong class="text-amberSoft">${weakSub}</strong> زمان بسیار کمی دریافت کرده و نیازمند توجه ویژه در برنامه هفتگی آینده است.
                                    دقت پاسخ‌گویی تست‌های شما روی <strong class="text-indigo-400">${acc}٪</strong> قرار دارد. توصیه می‌شود برای افزایش این دقت، پس از هر پارت تست‌زنی، حداقل ۱۵ دقیقه را به تحلیل دقیق تست‌های غلط اختصاص دهید.
                                </p>
                            </div>
                        `;
                        out.classList.remove('hidden');
                        btn.innerHTML = '<i class="fas fa-redo text-slate-400"></i> بروزرسانی تحلیل';
                    }, 1000);
                };
            }
        }, 1000);
    }

})();
/**
 * Tilo Final Patch (Stage 5 - Chart, Analytics, Cloud Sync & Backup Engine)
 * این بخش را در انتهای فایل tilo-upgrade.js قرار دهید تا نمودارها، آمار بازه‌ای و همگام‌سازی کامل شوند.
 */
(function initTiloFinalEngine() {
    'use strict';

    let mainChartInstance = null;

    const waitEngine = setInterval(() => {
        const appEl = document.getElementById('app');
        if (!appEl || !appEl.__vue_app__ || !appEl.__vue_app__._instance) return;
        clearInterval(waitEngine);

        const instance = appEl.__vue_app__._instance;
        const state = instance.setupState;
        const ctx = instance.ctx;

        // ۱. تزریق ایمن rangeAnalytics برای جلوگیری از هرگونه خطای رندر در داشبورد
        function computeRangeAnalytics() {
            const days = Number(state.chartDaysRange) || 7;
            const completed = (state.parts || []).filter(p => p.status === 'completed');
            const now = new Date();
            const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
            const cutoffISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(cutoff);

            let totalMinutes = 0, totalTests = 0, totalCorrect = 0, totalWrong = 0, totalDescriptive = 0;
            const activeDaysSet = new Set();

            completed.forEach(p => {
                if (p.dateISO && p.dateISO < cutoffISO) return;
                if (p.isNonStudy || p.isLife) return;

                const dur = Number(p.realTime || p.plannedTime || 0);
                totalMinutes += dur;
                if (p.dateISO) activeDaysSet.add(p.dateISO);

                if (p.type && (p.type.includes('تشریحی') || p.type.includes('نهایی'))) {
                    totalDescriptive += Number(p.descriptiveCount || Math.max(1, Math.round(dur / 12)));
                }
                if (p.tests) {
                    totalTests += Number(p.tests.total || 0);
                    totalCorrect += Number(p.tests.correct || 0);
                    totalWrong += Number(p.tests.wrong || 0);
                }
            });

            const avgDailyMinutes = Math.round(totalMinutes / days);
            let avgScore = '—';
            if (totalTests > 0) {
                const ratio = (state.settings && state.settings.negativeMarkRatio) || 3;
                const raw = ratio > 0
                    ? ((totalCorrect - (totalWrong / ratio)) / totalTests) * 100
                    : (totalCorrect / totalTests) * 100;
                avgScore = raw.toFixed(1) + '%';
            }

            return {
                totalMinutes,
                avgDailyMinutes,
                totalTests,
                totalCorrect,
                totalWrong,
                totalDescriptive,
                avgScore,
                activeDays: activeDaysSet.size
            };
        }

        // اتصال متغیر به Vue
        try {
            Object.defineProperty(ctx, 'rangeAnalytics', {
                get: computeRangeAnalytics,
                configurable: true
            });
            state.rangeAnalytics = computeRangeAnalytics();
        } catch (e) {
            state.rangeAnalytics = computeRangeAnalytics();
        }

        // ۲. راه‌اندازی نمودار اصلی داشبورد (Chart.js)
        function renderDashboardChart() {
            state.rangeAnalytics = computeRangeAnalytics();
            const canvas = document.getElementById('mainDashboardChart');
            if (!canvas || typeof window.Chart === 'undefined') return;

            const days = Math.min(90, Math.max(1, Number(state.chartDaysRange) || 7));
            const metric = state.chartMetric || 'time';
            const labels = [];
            const dataPoints = [];

            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(Date.now() - i * 86400000);
                const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(d);
                const faLabel = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', month: 'numeric', day: 'numeric' }).format(d);
                labels.push(faLabel);

                const dayParts = (state.parts || []).filter(p => p.status === 'completed' && p.dateISO === iso && !p.isNonStudy && !p.isLife);
                if (metric === 'time') {
                    const mins = dayParts.reduce((s, p) => s + Number(p.realTime || 0), 0);
                    dataPoints.push(mins);
                } else if (metric === 'tests') {
                    const tCount = dayParts.reduce((s, p) => s + Number((p.tests && p.tests.total) || 0), 0);
                    dataPoints.push(tCount);
                } else {
                    let c = 0, w = 0, tot = 0;
                    dayParts.forEach(p => {
                        if (p.tests) {
                            c += Number(p.tests.correct || 0);
                            w += Number(p.tests.wrong || 0);
                            tot += Number(p.tests.total || 0);
                        }
                    });
                    const ratio = (state.settings && state.settings.negativeMarkRatio) || 3;
                    const pct = tot > 0 ? Math.max(0, Math.round(((c - (ratio > 0 ? w / ratio : 0)) / tot) * 100)) : 0;
                    dataPoints.push(pct);
                }
            }

            if (mainChartInstance) mainChartInstance.destroy();

            const color = metric === 'time' ? '#818cf8' : (metric === 'tests' ? '#2dd4bf' : '#34d399');
            mainChartInstance = new window.Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: metric === 'time' ? 'دقیقه مطالعه' : (metric === 'tests' ? 'تعداد تست' : 'درصد تستی'),
                        data: dataPoints,
                        borderColor: color,
                        backgroundColor: color + '22',
                        borderWidth: 2.5,
                        pointRadius: 3,
                        fill: true,
                        tension: 0.35
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#94a3b8', font: { family: 'Vazirmatn', size: 10 } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { family: 'Vazirmatn', size: 10 } }, grid: { color: 'rgba(148,163,184,0.1)' } }
                    }
                }
            });
        }

        state.setCustomRange = (d) => { state.chartDaysRange = d; renderDashboardChart(); };
        state.setChartMetric = (m) => { state.chartMetric = m; renderDashboardChart(); };
        state.updateMainChart = renderDashboardChart;

        // ۳. دکمه تحلیل هوشمند داخل کارت نمودار
        state.runPerformanceAnalysis = () => {
            const stats = computeRangeAnalytics();
            const subMap = {};
            (state.parts || []).filter(p => p.status === 'completed' && !p.isNonStudy && !p.isLife).forEach(p => {
                (p.subjects || []).forEach(s => { subMap[s] = (subMap[s] || 0) + Number(p.realTime || 0); });
            });
            const sorted = Object.entries(subMap).sort((a, b) => b[1] - a[1]);
            const best = sorted[0] ? sorted[0][0] : 'نیاز به ثبت پارت بیشتر';
            const weak = sorted.length > 1 ? sorted[sorted.length - 1][0] : 'نیاز به تنوع دروس';

            state.analysisReport = {
                days: state.chartDaysRange || 7,
                consistencyTitle: `${stats.activeDays} روز فعال (میانگین ${stats.avgDailyMinutes} دقیقه در روز)`,
                consistencyDesc: stats.avgDailyMinutes >= (state.settings.dailyGoal * 0.7)
                    ? 'پیوستگی و ساعت مطالعه شما در وضعیت بسیار مطلوبی قرار دارد.'
                    : 'ساعت مطالعه فعلی با هدف روزانه فاصله دارد؛ پارت‌های ۵۰ دقیقه‌ای را در اولویت بگذارید.',
                bestSubject: best,
                bestSubjectDesc: sorted[0] ? `${sorted[0][1]} دقیقه تمرکز ثبت‌شده در این درس.` : 'هنوز داده کافی ثبت نشده است.',
                weakSubject: weak,
                weakSubjectDesc: 'سهم این درس در برنامه اخیر کمتر بوده است؛ در برنامه هفتگی جبران شود.',
                recommendation: 'برای دانش‌آموز سال دوازدهم، ترکیب ۶۰٪ مطالعه تشریحی (ویژه امتحانات نهایی) و ۴۰٪ تست زمان‌دار بهترین استراتژی کسب تراز بالاست.'
            };
        };

        // ۴. فعال‌سازی انتقال ساده (کد فشرده بین گوشی و لپ‌تاپ) و خروجی JSON/CSV
        state.copySimpleShare = () => {
            const payload = { p: state.parts || [], s: state.settings || {}, pr: state.problems || [] };
            const encoded = 'TILO2:' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
            navigator.clipboard.writeText(encoded).then(() => alert('کد فشرده کپی شد! آن را در دستگاه دیگر بچسبانید.'));
        };

        state.importShareText = () => {
            const raw = (state.simpleSharePaste || '').trim();
            if (!raw.startsWith('TILO2:')) return alert('کد وارد شده معتبر نیست.');
            try {
                const decoded = JSON.parse(decodeURIComponent(escape(atob(raw.replace('TILO2:', '')))));
                if (Array.isArray(decoded.p)) {
                    const map = new Map();
                    (state.parts || []).forEach(x => map.set(x.id, x));
                    decoded.p.forEach(x => map.set(x.id, x));
                    state.parts = Array.from(map.values()).sort((a, b) => b.id - a.id);
                    localStorage.setItem('sp_pro_parts', JSON.stringify(state.parts));
                }
                alert('اطلاعات با موفقیت ادغام شد!');
                state.simpleSharePaste = '';
                renderDashboardChart();
            } catch (e) {
                alert('خطا در خواندن کد انتقال.');
            }
        };

        state.exportJSON = () => {
            const data = JSON.stringify({ parts: state.parts, settings: state.settings, problems: state.problems }, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `tilo-backup-${state.settings.userName || 'user'}.json`;
            a.click();
        };

        state.importJSON = (ev) => {
            const file = ev.target.files && ev.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (parsed.parts) state.parts = parsed.parts;
                    if (parsed.settings) state.settings = { ...state.settings, ...parsed.settings };
                    if (parsed.problems) state.problems = parsed.problems;
                    state.saveAll();
                    renderDashboardChart();
                    alert('فایل پشتیبان با موفقیت بازیابی شد!');
                } catch (_) { alert('فایل نامعتبر است.'); }
            };
            reader.readAsText(file);
        };

        setTimeout(renderDashboardChart, 400);
        setInterval(() => { state.rangeAnalytics = computeRangeAnalytics(); }, 2000);
    }, 250);
})();
