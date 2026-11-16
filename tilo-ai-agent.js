// <script src="./tilo-ai-agent.js?v=11"></script>
(function () {
    'use strict';

    if (window.__TILO_AI_AGENT_V11__) return;
    window.__TILO_AI_AGENT_V11__ = true;

    const KEYS = {
        API_KEYS: 'tilo_ai_api_keys_v1',
        ACTIVE_KEYS_MAP: 'tilo_ai_active_keys_map_v1',
        SELECTED_MODEL: 'tilo_ai_selected_model_v1',
        CUSTOM_MODEL: 'tilo_ai_custom_model_v1',
        PRACTICE: 'tilo_ai_practice_mode',
        CHAT: 'tilo_ai_chat_history_v1',
        MEMORY: 'tilo_ai_shared_memory_v1',
        PLANNER: 'tilo_martell_planner',
        PLANNER_BACKUP: 'tilo_martell_planner_ai_backup'
    };

    const PROVIDERS = {
        gemini: {
            id: 'gemini',
            name: 'Google Gemini',
            type: 'gemini',
            models: [
                'gemini-3.5-flash-lite',
                'gemini-3.8-flash',
                'gemini-flash-latest'
            ]
        },
        openrouter: {
            id: 'openrouter',
            name: 'OpenRouter',
            type: 'openai',
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            models: [
                'google/gemini-2.5-flash',
                'anthropic/claude-sonnet-4',
                'openai/gpt-4o-mini',
                'deepseek/deepseek-chat-v3-0324',
                'meta-llama/llama-3.3-70b-instruct'
            ]
        },
        groq: {
            id: 'groq',
            name: 'Groq',
            type: 'openai',
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            models: [
                'llama-3.3-70b-versatile',
                'llama-3.1-8b-instant',
                'qwen-qwq-32b',
                'gemma2-9b-it'
            ]
        },
        xai: {
            id: 'xai',
            name: 'xAI (Grok)',
            type: 'openai',
            endpoint: 'https://api.x.ai/v1/chat/completions',
            models: [
                'grok-3',
                'grok-3-mini',
                'grok-2-latest'
            ]
        }
    };

    const state = {
        isOpen: false,
        activeTab: 'chat',
        isLoading: false,
        isTesting: false,
        testResult: null,
        keys: [],
        activeKeysMap: {},
        selectedModel: 'gemini:gemini-3.5-flash-lite',
        customModel: '',
        practiceMode: true,
        chatHistory: [],
        sharedMemory: []
    };

    function safeReadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed !== null && parsed !== undefined ? parsed : fallback;
        } catch (err) {
            console.warn('tilo-ai-agent: JSON parse warning for', key, err);
            return fallback;
        }
    }

    function safeWriteJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.warn('tilo-ai-agent: localStorage write warning for', key, err);
        }
    }

    function loadState() {
        const storedKeys = safeReadJSON(KEYS.API_KEYS, []);
        state.keys = Array.isArray(storedKeys) ? storedKeys : [];

        const storedMap = safeReadJSON(KEYS.ACTIVE_KEYS_MAP, {});
        state.activeKeysMap = storedMap && typeof storedMap === 'object' ? storedMap : {};

        state.selectedModel = localStorage.getItem(KEYS.SELECTED_MODEL) || 'gemini:gemini-3.5-flash-lite';
        state.customModel = localStorage.getItem(KEYS.CUSTOM_MODEL) || '';

        const rawPractice = localStorage.getItem(KEYS.PRACTICE);
        if (rawPractice === null) {
            state.practiceMode = true;
            try {
                localStorage.setItem(KEYS.PRACTICE, 'true');
            } catch (_) {}
        } else {
            state.practiceMode = rawPractice === 'true';
        }

        const storedChat = safeReadJSON(KEYS.CHAT, []);
        state.chatHistory = Array.isArray(storedChat) ? storedChat.slice(-60) : [];

        const storedMem = safeReadJSON(KEYS.MEMORY, []);
        state.sharedMemory = Array.isArray(storedMem) ? storedMem.slice(-60) : [];
    }

    function persistKeys() {
        safeWriteJSON(KEYS.API_KEYS, state.keys);
        safeWriteJSON(KEYS.ACTIVE_KEYS_MAP, state.activeKeysMap);
    }

    function persistChat() {
        safeWriteJSON(KEYS.CHAT, state.chatHistory.slice(-60));
    }

    function persistMemory() {
        safeWriteJSON(KEYS.MEMORY, state.sharedMemory.slice(-60));
    }

    function parseSelectedModel() {
        const raw = state.selectedModel || 'gemini:gemini-3.5-flash-lite';
        const idx = raw.indexOf(':');
        if (idx === -1) {
            return { provider: 'gemini', model: raw, isCustom: false };
        }
        const provider = raw.slice(0, idx);
        const modelPart = raw.slice(idx + 1);
        if (modelPart === '__custom__') {
            const fallbackModel = (PROVIDERS[provider] && PROVIDERS[provider].models[0]) || 'gemini-3.5-flash-lite';
            const finalModel = (state.customModel || '').trim() || fallbackModel;
            return { provider, model: finalModel, isCustom: true };
        }
        return { provider, model: modelPart, isCustom: false };
    }

    function getActiveKeyForProvider(providerId) {
        const providerKeys = state.keys.filter(k => k && k.provider === providerId && k.key);
        if (!providerKeys.length) return null;
        const activeId = state.activeKeysMap[providerId];
        if (activeId) {
            const matched = providerKeys.find(k => k.id === activeId);
            if (matched) return matched;
        }
        return providerKeys[0];
    }

    function maskKey(key) {
        const s = String(key || '');
        if (s.length <= 10) return '••••••••••';
        return s.slice(0, 5) + '••••••' + s.slice(-4);
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderRichText(text) {
        let html = escapeHtml(text);
        html = html.replace(/```[\s\S]*?```/g, function (block) {
            const code = block.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '');
            return '<pre class="tai-code-block" dir="ltr">' + code + '</pre>';
        });
        html = html.replace(/`([^`\n]+)`/g, '<code class="tai-inline-code" dir="ltr">$1</code>');
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    function getTehranTimeStr() {
        try {
            return new Intl.DateTimeFormat('fa-IR', {
                timeZone: 'Asia/Tehran',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date());
        } catch (_) {
            return '';
        }
    }

    function hasCalendarChangeIntent(userText) {
        const t = String(userText || '').trim().toLowerCase();
        if (!t) return false;

        const targetWords = [
            'برنامه', 'تقویم', 'پارت', 'ساعت', 'تایم', 'بلوک', 'جدول', 'زمان‌بندی', 'زمانبندی',
            'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'سه شنبه', 'چهارشنبه', 'پنج‌شنبه', 'پنجشنبه', 'جمعه',
            'امروز', 'فردا', 'پس‌فردا', 'هفته', 'مارتل', 'martell', 'planner', 'block'
        ];

        const verbWords = [
            'تغییر', 'عوض', 'اصلاح', 'ویرایش', 'اضافه', 'بذار', 'بگذار', 'قرار بده', 'قراربده',
            'حذف', 'پاک', 'بردار', 'جابجا', 'جا به جا', 'منتقل', 'تنظیم', 'بچین', 'چینش',
            'آپدیت', 'بروزرسانی', 'به‌روزرسانی', 'کم کن', 'زیاد کن', 'ببر', 'بیار', 'ثبت کن',
            'جایگزین', 'تمدید', 'کوتاه کن', 'طولانی کن', 'شروع کن', 'ببند'
        ];

        const hasTarget = targetWords.some(w => t.includes(w));
        const hasVerb = verbWords.some(v => t.includes(v));
        return hasTarget && hasVerb;
    }

    function readPlannerSafely() {
        try {
            const raw = localStorage.getItem(KEYS.PLANNER);
            if (!raw) return { raw: null, obj: {} };
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return { raw, obj: { blocks: parsed } };
            }
            if (parsed && typeof parsed === 'object') {
                return { raw, obj: parsed };
            }
            return { raw, obj: {} };
        } catch (err) {
            console.warn('tilo-ai-agent: error reading planner JSON', err);
            return { raw: localStorage.getItem(KEYS.PLANNER), obj: {} };
        }
    }

    function writePlannerSafely(modelPayload) {
        if (state.practiceMode || localStorage.getItem(KEYS.PRACTICE) === 'true') {
            return { saved: false, reason: 'practice_active' };
        }

        const currentSnap = readPlannerSafely();
        const currentObj = currentSnap.obj && typeof currentSnap.obj === 'object' ? currentSnap.obj : {};
        let nextObj = null;

        if (Array.isArray(modelPayload)) {
            nextObj = Object.assign({}, currentObj, { blocks: modelPayload });
        } else if (modelPayload && typeof modelPayload === 'object') {
            nextObj = Object.assign({}, currentObj, modelPayload);
        } else {
            return { saved: false, reason: 'invalid_payload' };
        }

        if (!Array.isArray(nextObj.blocks) || nextObj.blocks.length === 0) {
            return { saved: false, reason: 'empty_blocks' };
        }

        try {
            if (currentSnap.raw !== null) {
                localStorage.setItem(KEYS.PLANNER_BACKUP, currentSnap.raw);
            } else {
                localStorage.setItem(KEYS.PLANNER_BACKUP, JSON.stringify({ blocks: [] }));
            }

            const serialized = JSON.stringify(nextObj);
            localStorage.setItem(KEYS.PLANNER, serialized);

            try {
                window.dispatchEvent(new CustomEvent('tilo:planner-updated', { detail: nextObj }));
                window.dispatchEvent(new StorageEvent('storage', {
                    key: KEYS.PLANNER,
                    oldValue: currentSnap.raw,
                    newValue: serialized
                }));
            } catch (_) {}

            return { saved: true, count: nextObj.blocks.length };
        } catch (err) {
            console.warn('tilo-ai-agent: error saving planner', err);
            return { saved: false, reason: 'write_error' };
        }
    }

    function buildSystemInstruction() {
        let nowFa = '';
        try {
            nowFa = new Intl.DateTimeFormat('fa-IR', {
                timeZone: 'Asia/Tehran',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(new Date());
        } catch (_) {
            nowFa = new Date().toLocaleString('fa-IR');
        }

        const plannerSnap = readPlannerSafely();
        const plannerText = plannerSnap.raw ? plannerSnap.raw : '{"blocks":[]}';
        const memText = state.sharedMemory.length
            ? state.sharedMemory.map((m, idx) => `${idx + 1}. ${m.text}`).join('\n')
            : 'هنوز موردی ذخیره نشده است.';

        return [
            'تو دستیار هوشمند مطالعه، برنامه‌ریزی و مشاور درسی اپلیکیشن tilo هستی. به زبان فارسی روان، دقیق و کاربردی پاسخ بده.',
            `زمان فعلی (تهران): ${nowFa}`,
            `حالت تمرین (Practice Mode): ${state.practiceMode ? 'روشن (فقط شبیه‌سازی؛ هرگز تغییری در تقویم ذخیره نمی‌شود)' : 'خاموش (اجازه ذخیره تغییرات در تقویم در صورت دستور کاربر)'}`,
            '',
            '=== حافظه مشترک کاربر (در دسترس همه مدل‌ها) ===',
            memText,
            '',
            '=== محتوای فعلی تقویم (localStorage: tilo_martell_planner) ===',
            plannerText,
            '',
            '=== دستورالعمل تگ‌های ساختاریافته ===',
            '1) اگر کاربر اطلاعات مهم و ماندگاری درباره خودش، پایه تحصیلی، رشته، هدف مطالعه یا ترجیحات برنامه‌ریزی گفت، در پایان پاسخ این تگ را قرار بده:',
            '<MEMORY_ADD>نکته کوتاه و مفید برای حافظه مشترک</MEMORY_ADD>',
            '2) درباره تغییر تقویم (tilo_martell_planner):',
            '- فقط وقتی حالت تمرین «خاموش» است و کاربر دستور تغییر/افزودن/حذف/جابجایی در برنامه یا پارت‌ها داده، ساختار JSON معتبر را داخل تگ زیر قرار بده:',
            '<PLANNER_JSON>{"blocks":[...]}</PLANNER_JSON>',
            '- آرایه blocks هرگز نباید خالی باشد و فیلدهای قبلی تقویم باید حفظ شوند.',
            '- اگر حالت تمرین «روشن» است و کاربر درخواست تغییر برنامه داد، پیشنهادت را فقط در متن بنویس و تگ <PLANNER_JSON> تولید نکن.'
        ].join('\n');
    }

    function parseModelOutput(rawText) {
        let text = String(rawText || '');
        const memories = [];
        let plannerJson = null;

        text = text.replace(/<MEMORY_ADD>([\s\S]*?)<\/MEMORY_ADD>/gi, function (_, inner) {
            const cleanMem = String(inner || '').trim();
            if (cleanMem) memories.push(cleanMem);
            return '';
        });

        text = text.replace(/<PLANNER_JSON>([\s\S]*?)<\/PLANNER_JSON>/gi, function (_, inner) {
            const rawJson = String(inner || '')
                .trim()
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```$/i, '')
                .trim();
            try {
                plannerJson = JSON.parse(rawJson);
            } catch (err) {
                console.warn('tilo-ai-agent: invalid PLANNER_JSON from model', err);
                plannerJson = null;
            }
            return '';
        });

        return {
            cleanText: text.trim(),
            memories,
            plannerJson
        };
    }

    function mapNetworkOrHttpError(providerName, status, apiMessage, rawErr) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return 'دستگاه شما آفلاین است. اتصال اینترنت را برقرار کرده و دوباره تلاش کنید.';
        }
        if (rawErr) {
            const msg = String(rawErr.message || rawErr);
            if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed') || rawErr.name === 'TypeError') {
                return `خطای شبکه (Failed to fetch) هنگام اتصال به ${providerName}. لطفاً اتصال اینترنت، وضعیت فیلترشکن (VPN) یا آفلاین نبودن مرورگر را بررسی کنید.`;
            }
            return `خطا در ارتباط با ${providerName}: ${msg}`;
        }
        if (status === 401 || status === 403) {
            return `خطای احراز هویت (${status}) در ${providerName}: کلید API نامعتبر است، منقضی شده یا با آی‌پی فعلی دسترسی ندارد.`;
        }
        if (status === 429) {
            return `محدودیت تعداد درخواست (429) در ${providerName}: سهمیه رایگان یا محدودیت زمانی کلید پر شده است. چند لحظه صبر کنید یا کلید دیگری فعال کنید.`;
        }
        if (status === 400 || status === 404) {
            return `درخواست نامعتبر (${status}) در ${providerName}: نام مدل یا پارامترهای ارسالی پشتیبانی نمی‌شود.${apiMessage ? ' (' + apiMessage + ')' : ''}`;
        }
        return `خطای سرور (${status}) از سمت ${providerName}${apiMessage ? ': ' + apiMessage : ''}`;
    }

    function buildGeminiContents(history, latestPrompt) {
        const slice = history.slice(-14);
        const contents = [];
        slice.forEach(item => {
            if (!item || !item.content) return;
            const role = item.role === 'assistant' ? 'model' : 'user';
            if (contents.length > 0 && contents[contents.length - 1].role === role) {
                contents[contents.length - 1].parts[0].text += '\n\n' + item.content;
            } else {
                contents.push({ role, parts: [{ text: item.content }] });
            }
        });

        if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
            contents[contents.length - 1].parts[0].text += '\n\n' + latestPrompt;
        } else {
            contents.push({ role: 'user', parts: [{ text: latestPrompt }] });
        }

        if (contents.length > 0 && contents[0].role === 'model') {
            contents.unshift({ role: 'user', parts: [{ text: 'سلام' }] });
        }
        return contents;
    }

    async function requestGemini(apiKey, model, systemInstruction, history, userPrompt) {
        // FIXED: proper Gemini URL (no markdown)
        const url =
            'https://generativelanguage.googleapis.com/v1beta/models/' +
            encodeURIComponent(model) +
            ':generateContent?key=' +
            encodeURIComponent(apiKey);

        const payload = {
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: buildGeminiContents(history, userPrompt),
            generationConfig: {
                temperature: 0.65
            }
        };

        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            throw new Error(mapNetworkOrHttpError('Google Gemini', 0, '', err));
        }

        let data = null;
        try {
            data = await res.json();
        } catch (_) {}

        if (!res.ok) {
            const apiMsg = data && data.error && data.error.message ? data.error.message : '';
            throw new Error(mapNetworkOrHttpError('Google Gemini', res.status, apiMsg, null));
        }

        const candidate = data && data.candidates && data.candidates[0];
        const parts = candidate && candidate.content && candidate.content.parts;
        const text = Array.isArray(parts) ? parts.map(p => p.text || '').join('') : '';
        if (!text.trim()) {
            throw new Error('مدل Google Gemini پاسخ خالی برگرداند.');
        }
        return text;
    }

    async function requestOpenAICompatible(providerObj, apiKey, model, systemInstruction, history, userPrompt) {
        const messages = [{ role: 'system', content: systemInstruction }];
        history.slice(-14).forEach(item => {
            if (!item || !item.content) return;
            messages.push({
                role: item.role === 'assistant' ? 'assistant' : 'user',
                content: item.content
            });
        });
        messages.push({ role: 'user', content: userPrompt });

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        };
        if (providerObj.id === 'openrouter') {
            // FIXED: no markdown in referer
            headers['HTTP-Referer'] = window.location.origin || 'https://benyamin-design.github.io';
            headers['X-Title'] = 'tilo AI Agent';
        }

        let res;
        try {
            res = await fetch(providerObj.endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: 0.65
                })
            });
        } catch (err) {
            throw new Error(mapNetworkOrHttpError(providerObj.name, 0, '', err));
        }

        let data = null;
        try {
            data = await res.json();
        } catch (_) {}

        if (!res.ok) {
            const apiMsg = data && data.error && data.error.message ? data.error.message : '';
            throw new Error(mapNetworkOrHttpError(providerObj.name, res.status, apiMsg, null));
        }

        const choice = data && data.choices && data.choices[0];
        const text = choice && choice.message && choice.message.content ? choice.message.content : '';
        if (!text.trim()) {
            throw new Error('سرویس ' + providerObj.name + ' پاسخ خالی برگرداند.');
        }
        return text;
    }

    function injectStyles() {
        if (document.getElementById('tai-styles')) return;
        const style = document.createElement('style');
        style.id = 'tai-styles';
        style.textContent = `
            #tai-root {
                --tai-bg: #0e1613;
                --tai-surface: #13201b;
                --tai-elevated: #192b24;
                --tai-border: #2d5a47;
                --tai-accent: #6ee7b7;
                --tai-accent-soft: rgba(110, 231, 183, 0.14);
                --tai-text: #ecfdf5;
                --tai-muted: #93b8a8;
                --tai-danger: #f87171;
                --tai-warn: #fbbf24;
                font-family: 'Vazirmatn', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                direction: rtl;
                color: var(--tai-text);
            }
            #tai-root * { box-sizing: border-box; }
            #tai-edge-tab {
                position: fixed !important; right: 0 !important; top: 50% !important;
                transform: translateY(-50%) !important; z-index: 2147483646 !important;
                display: flex !important; flex-direction: column !important; align-items: center !important;
                justify-content: center !important; gap: 6px !important;
                background: linear-gradient(180deg, #172821 0%, #0e1613 100%) !important;
                color: #6ee7b7 !important; border: 1px solid #2d5a47 !important; border-right: none !important;
                border-radius: 12px 0 0 12px !important; padding: 13px 8px !important; cursor: pointer !important;
                box-shadow: -4px 0 20px rgba(0, 0, 0, 0.5) !important; pointer-events: auto !important;
            }
            #tai-edge-tab:hover { padding-left: 12px !important; background: #1d332a !important; }
            #tai-edge-tab .tai-edge-arrows { font-size: 14px; font-weight: 900; line-height: 1; color: #6ee7b7; }
            #tai-edge-tab .tai-edge-text { writing-mode: vertical-rl; font-size: 11px; font-weight: 800; color: #ecfdf5; }
            #tai-fab {
                position: fixed !important; left: 16px !important; bottom: 84px !important;
                z-index: 2147483646 !important; display: inline-flex !important; align-items: center !important;
                gap: 8px !important; background: linear-gradient(135deg, #162921 0%, #0e1613 100%) !important;
                color: #6ee7b7 !important; border: 1.5px solid #2d5a47 !important; border-radius: 999px !important;
                padding: 10px 16px !important; font-size: 12.5px !important; font-weight: 800 !important;
                cursor: pointer !important; box-shadow: 0 10px 26px rgba(0, 0, 0, 0.55) !important; pointer-events: auto !important;
            }
            @media (min-width: 768px) { #tai-fab { bottom: 22px !important; left: 22px !important; } }
            #tai-fab:hover { transform: translateY(-2px) !important; border-color: #6ee7b7 !important; }
            #tai-fab-pulse { width: 8px; height: 8px; border-radius: 50%; background: #6ee7b7; box-shadow: 0 0 8px #6ee7b7; }
            .tai-martell-btn {
                display: inline-flex !important; align-items: center !important; gap: 6px !important;
                background: linear-gradient(135deg, #182c24 0%, #0e1613 100%) !important; color: #6ee7b7 !important;
                border: 1px solid #2d5a47 !important; border-radius: 10px !important; padding: 6px 12px !important;
                font-family: inherit !important; font-size: 11.5px !important; font-weight: 800 !important;
                cursor: pointer !important; pointer-events: auto !important; position: relative !important; z-index: 40 !important;
            }
            .tai-martell-btn:hover { border-color: #6ee7b7 !important; background: #203b30 !important; }
            #tai-backdrop {
                position: fixed !important; inset: 0 !important; background: rgba(5, 10, 8, 0.65) !important;
                backdrop-filter: blur(4px) !important; z-index: 2147483646 !important; opacity: 0 !important;
                pointer-events: none !important; transition: opacity 0.24s ease !important;
            }
            #tai-backdrop.open { opacity: 1 !important; pointer-events: auto !important; }
            #tai-drawer {
                position: fixed !important; top: 0 !important; right: 0 !important; bottom: 0 !important;
                width: min(100vw, 400px) !important; height: 100dvh !important; background: #0e1613 !important;
                border-left: 1px solid #2d5a47 !important; box-shadow: -12px 0 38px rgba(0, 0, 0, 0.7) !important;
                z-index: 2147483647 !important; display: flex !important; flex-direction: column !important;
                transform: translateX(100%) !important; transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1) !important;
                pointer-events: auto !important;
            }
            #tai-drawer.open { transform: translateX(0) !important; }
            .tai-header {
                padding: 12px 14px; background: var(--tai-surface); border-bottom: 1px solid var(--tai-border);
                display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0;
            }
            .tai-brand { display: flex; align-items: center; gap: 8px; }
            .tai-badge-icon {
                width: 32px; height: 32px; border-radius: 9px; background: var(--tai-accent-soft);
                border: 1px solid var(--tai-border); color: var(--tai-accent); display: flex;
                align-items: center; justify-content: center; font-weight: 900; font-size: 13px;
            }
            .tai-brand-title { margin: 0; font-size: 13.5px; font-weight: 900; color: var(--tai-text); }
            .tai-brand-sub { margin: 1px 0 0 0; font-size: 10px; color: var(--tai-muted); }
            .tai-header-controls { display: flex; align-items: center; gap: 6px; }
            #tai-practice-toggle {
                border-radius: 999px; padding: 5px 10px; font-size: 10.5px; font-weight: 800; cursor: pointer;
                border: 1px solid var(--tai-border); background: var(--tai-elevated); color: var(--tai-muted);
                display: inline-flex; align-items: center; gap: 5px;
            }
            #tai-practice-toggle.is-on {
                background: rgba(251, 191, 36, 0.16); border-color: rgba(251, 191, 36, 0.55); color: #fde68a;
            }
            #tai-close-btn {
                width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--tai-border);
                background: var(--tai-elevated); color: var(--tai-text); font-size: 16px; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
            }
            .tai-model-bar {
                padding: 9px 12px; background: #101a16; border-bottom: 1px solid rgba(45, 90, 71, 0.6);
                display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;
            }
            .tai-model-row { display: flex; align-items: center; gap: 6px; }
            #tai-model-select {
                flex: 1; direction: ltr; text-align: left; background: var(--tai-bg); color: var(--tai-accent);
                border: 1px solid var(--tai-border); border-radius: 9px; padding: 6px 8px; font-size: 11.5px;
                font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; outline: none;
            }
            #tai-custom-model-input {
                direction: ltr; text-align: left; background: var(--tai-bg); color: var(--tai-text);
                border: 1px solid var(--tai-border); border-radius: 8px; padding: 6px 8px; font-size: 11px;
                font-family: ui-monospace, monospace; width: 100%; outline: none;
            }
            #tai-key-pill {
                padding: 5px 8px; border-radius: 8px; font-size: 10px; font-weight: 800;
                border: 1px solid var(--tai-border); background: var(--tai-surface); color: var(--tai-muted);
                white-space: nowrap; cursor: pointer;
            }
            #tai-key-pill.ready { color: var(--tai-accent); }
            #tai-key-pill.missing { color: var(--tai-danger); border-color: rgba(248, 113, 113, 0.45); }
            .tai-tabs {
                display: grid; grid-template-columns: repeat(4, 1fr); background: var(--tai-surface);
                border-bottom: 1px solid var(--tai-border); flex-shrink: 0;
            }
            .tai-tab {
                background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--tai-muted);
                padding: 9px 4px; font-family: inherit; font-size: 11px; font-weight: 800; cursor: pointer;
            }
            .tai-tab.active { color: var(--tai-accent); border-bottom-color: var(--tai-accent); background: rgba(110, 231, 183, 0.06); }
            #tai-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
            .tai-msg {
                max-width: 90%; padding: 10px 12px; border-radius: 13px; font-size: 12px; line-height: 1.7;
                word-break: break-word; overflow-wrap: anywhere;
            }
            .tai-msg.user { align-self: flex-start; background: #1a382c; border: 1px solid var(--tai-border); color: #ecfdf5; border-bottom-right-radius: 4px; }
            .tai-msg.assistant { align-self: flex-end; background: var(--tai-surface); border: 1px solid rgba(45, 90, 71, 0.65); color: var(--tai-text); border-bottom-left-radius: 4px; }
            .tai-msg.error { align-self: stretch; max-width: 100%; background: rgba(248, 113, 113, 0.12); border: 1px solid rgba(248, 113, 113, 0.45); color: #fecaca; }
            .tai-msg-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 9.5px; color: var(--tai-muted); margin-bottom: 4px; }
            .tai-tag-saved { display: inline-block; margin-top: 6px; padding: 3px 8px; border-radius: 7px; font-size: 10px; font-weight: 800; background: rgba(110, 231, 183, 0.14); border: 1px solid var(--tai-border); color: var(--tai-accent); }
            .tai-tag-practice { display: inline-block; margin-top: 6px; padding: 3px 8px; border-radius: 7px; font-size: 10px; font-weight: 800; background: rgba(251, 191, 36, 0.14); border: 1px solid rgba(251, 191, 36, 0.45); color: #fde68a; }
            .tai-code-block { background: #080d0b; border: 1px solid var(--tai-border); border-radius: 8px; padding: 8px; font-size: 10.5px; overflow-x: auto; margin: 6px 0; color: #a7f3d0; }
            .tai-inline-code { background: #080d0b; padding: 1px 5px; border-radius: 5px; font-size: 10.5px; color: var(--tai-accent); }
            #tai-footer { padding: 9px 12px; background: var(--tai-surface); border-top: 1px solid var(--tai-border); display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
            .tai-chips { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 2px; }
            .tai-chip { background: var(--tai-bg); border: 1px solid rgba(45, 90, 71, 0.75); color: var(--tai-muted); border-radius: 999px; padding: 4px 9px; font-family: inherit; font-size: 10px; font-weight: 700; white-space: nowrap; cursor: pointer; }
            .tai-input-wrap { display: flex; align-items: flex-end; gap: 7px; }
            #tai-textarea { flex: 1; background: var(--tai-bg); color: var(--tai-text); border: 1px solid var(--tai-border); border-radius: 11px; padding: 8px 11px; font-family: inherit; font-size: 12px; resize: none; min-height: 38px; max-height: 110px; outline: none; line-height: 1.5; }
            #tai-send-btn { background: var(--tai-accent); color: #07120e; border: none; border-radius: 11px; padding: 9px 14px; font-family: inherit; font-size: 12px; font-weight: 900; cursor: pointer; flex-shrink: 0; }
            #tai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            .tai-card { background: var(--tai-surface); border: 1px solid var(--tai-border); border-radius: 12px; padding: 11px; display: flex; flex-direction: column; gap: 8px; }
            .tai-card-title { margin: 0; font-size: 12px; font-weight: 900; color: var(--tai-accent); }
            .tai-field { background: var(--tai-bg); color: var(--tai-text); border: 1px solid var(--tai-border); border-radius: 9px; padding: 7px 10px; font-family: inherit; font-size: 11.5px; width: 100%; outline: none; }
            .tai-btn-primary { background: var(--tai-accent); color: #07120e; border: none; border-radius: 9px; padding: 8px 12px; font-family: inherit; font-size: 11.5px; font-weight: 900; cursor: pointer; }
            .tai-btn-secondary { background: var(--tai-elevated); color: var(--tai-text); border: 1px solid var(--tai-border); border-radius: 9px; padding: 7px 10px; font-family: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
            .tai-btn-danger { background: rgba(248, 113, 113, 0.14); color: #fca5a5; border: 1px solid rgba(248, 113, 113, 0.45); border-radius: 8px; padding: 4px 8px; font-family: inherit; font-size: 10.5px; font-weight: 700; cursor: pointer; }
            .tai-item-row { background: var(--tai-bg); border: 1px solid rgba(45, 90, 71, 0.6); border-radius: 9px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; }
        `;
        document.head.appendChild(style);
    }

    function buildModelOptions() {
        let html = '';
        Object.keys(PROVIDERS).forEach(pKey => {
            const p = PROVIDERS[pKey];
            html += '<optgroup label="' + escapeHtml(p.name) + '">';
            p.models.forEach(modelId => {
                const val = p.id + ':' + modelId;
                const sel = state.selectedModel === val ? 'selected' : '';
                html += '<option value="' + escapeHtml(val) + '" ' + sel + '>' + escapeHtml(modelId) + '</option>';
            });
            const customVal = p.id + ':__custom__';
            const customSel = state.selectedModel === customVal ? 'selected' : '';
            html += '<option value="' + escapeHtml(customVal) + '" ' + customSel + '>' + escapeHtml(p.id) + ' / custom-model...</option>';
            html += '</optgroup>';
        });
        return html;
    }

    function mountUI() {
        try {
            if (!document.body) return false;
            if (document.getElementById('tai-drawer')) return true;

            injectStyles();

            const root = document.createElement('aside');
            root.id = 'tai-root';
            root.innerHTML = [
                '<button type="button" id="tai-edge-tab" aria-label="دستیار">',
                '<span class="tai-edge-arrows" id="tai-edge-arrow">«</span>',
                '<span class="tai-edge-text">دستیار AI</span></button>',
                '<button type="button" id="tai-fab" aria-label="دستیار"><span id="tai-fab-pulse"></span><span>دستیار tilo</span></button>',
                '<div id="tai-backdrop"></div>',
                '<section id="tai-drawer" aria-label="دستیار tilo">',
                '<header class="tai-header"><div class="tai-brand"><div class="tai-badge-icon">AI</div><div>',
                '<h3 class="tai-brand-title">دستیار هوشمند tilo</h3>',
                '<p class="tai-brand-sub">مشاور مطالعه و تقویم</p></div></div>',
                '<div class="tai-header-controls">',
                '<button type="button" id="tai-practice-toggle"><span>●</span><span id="tai-practice-text">تمرین: روشن</span></button>',
                '<button type="button" id="tai-close-btn" aria-label="بستن">×</button></div></header>',
                '<div class="tai-model-bar"><div class="tai-model-row">',
                '<select id="tai-model-select" dir="ltr"></select>',
                '<button type="button" id="tai-key-pill">کلید API</button></div>',
                '<input type="text" id="tai-custom-model-input" dir="ltr" placeholder="مدل سفارشی..." style="display:none;" /></div>',
                '<nav class="tai-tabs">',
                '<button type="button" class="tai-tab active" data-tab="chat">چت</button>',
                '<button type="button" class="tai-tab" data-tab="memory">حافظه</button>',
                '<button type="button" class="tai-tab" data-tab="keys">کلیدها</button>',
                '<button type="button" class="tai-tab" data-tab="guide">راهنما</button></nav>',
                '<div id="tai-body"></div>',
                '<footer id="tai-footer"><div class="tai-chips">',
                '<button type="button" class="tai-chip" data-quick="برنامه امروز من رو تحلیل کن و پیشنهاد بهبود بده.">تحلیل برنامه امروز</button>',
                '<button type="button" class="tai-chip" data-quick="یک پارت ۵۰ دقیقه‌ای مرور فیزیک به برنامه امروز اضافه کن.">+ پارت مرور فیزیک</button>',
                '<button type="button" class="tai-chip" data-quick="برای امتحانات نهایی و کنکور چطور برنامه‌ریزی کنم؟">مشاوره مطالعه</button>',
                '</div><div class="tai-input-wrap">',
                '<textarea id="tai-textarea" rows="1" placeholder="پیام یا دستور..."></textarea>',
                '<button type="button" id="tai-send-btn">ارسال</button></div></footer></section>'
            ].join('');

            document.body.appendChild(root);
            bindDrawerEvents();
            renderAll();
            console.assert(Boolean(document.getElementById('tai-drawer')), 'tilo-ai-agent: #tai-drawer must exist after mountUI');
            return true;
        } catch (err) {
            console.warn('tilo-ai-agent: mountUI error:', err);
            return false;
        }
    }

    function openDrawer() {
        try {
            if (!document.getElementById('tai-drawer')) mountUI();
            const drawer = document.getElementById('tai-drawer');
            const backdrop = document.getElementById('tai-backdrop');
            if (drawer) drawer.classList.add('open');
            if (backdrop) backdrop.classList.add('open');
            state.isOpen = true;
            updateEdgeTabArrow();
            renderAll();
        } catch (err) {
            console.warn('tilo-ai-agent: openDrawer error:', err);
        }
    }

    function closeDrawer() {
        try {
            const drawer = document.getElementById('tai-drawer');
            const backdrop = document.getElementById('tai-backdrop');
            if (drawer) drawer.classList.remove('open');
            if (backdrop) backdrop.classList.remove('open');
            state.isOpen = false;
            updateEdgeTabArrow();
        } catch (err) {
            console.warn('tilo-ai-agent: closeDrawer error:', err);
        }
    }

    function toggleDrawer() {
        if (state.isOpen) closeDrawer();
        else openDrawer();
    }

    function updateEdgeTabArrow() {
        const arrowEl = document.getElementById('tai-edge-arrow');
        if (arrowEl) arrowEl.textContent = state.isOpen ? '»' : '«';
    }

    function startMartellInjector() {
        function checkAndInject() {
            try {
                const martellRoot = document.getElementById('tilo-martell');
                if (!martellRoot) return;
                if (martellRoot.querySelector('.tai-martell-btn')) return;

                const targetContainer =
                    martellRoot.querySelector('.tm-top .tm-row') ||
                    martellRoot.querySelector('.tm-top') ||
                    martellRoot.querySelector('.tm-row') ||
                    martellRoot;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tai-martell-btn';
                btn.textContent = '✦ دستیار AI';
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openDrawer();
                }, true);

                try {
                    targetContainer.insertBefore(btn, targetContainer.firstChild);
                } catch (_) {
                    targetContainer.appendChild(btn);
                }
            } catch (err) {
                console.warn('tilo-ai-agent: martell injector warning:', err);
            }
        }
        checkAndInject();
        setInterval(checkAndInject, 1000);
    }

    function updateTopControls() {
        const practiceBtn = document.getElementById('tai-practice-toggle');
        const practiceTxt = document.getElementById('tai-practice-text');
        if (practiceBtn && practiceTxt) {
            practiceBtn.classList.toggle('is-on', state.practiceMode);
            practiceTxt.textContent = state.practiceMode ? 'تمرین: روشن' : 'تمرین: خاموش';
        }

        const selectEl = document.getElementById('tai-model-select');
        if (selectEl) {
            selectEl.innerHTML = buildModelOptions();
            try { selectEl.value = state.selectedModel; } catch (_) {}
        }

        const customInput = document.getElementById('tai-custom-model-input');
        if (customInput) {
            const isCustom = state.selectedModel.endsWith(':__custom__');
            customInput.style.display = isCustom ? 'block' : 'none';
            customInput.value = state.customModel;
        }

        const parsed = parseSelectedModel();
        const activeKey = getActiveKeyForProvider(parsed.provider);
        const pill = document.getElementById('tai-key-pill');
        if (pill) {
            const pName = PROVIDERS[parsed.provider] ? PROVIDERS[parsed.provider].name : parsed.provider;
            if (activeKey) {
                pill.className = 'ready';
                pill.textContent = '✓ ' + (activeKey.label || pName);
            } else {
                pill.className = 'missing';
                pill.textContent = '! کلید ' + pName;
            }
        }

        document.querySelectorAll('#tai-root .tai-tab').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === state.activeTab);
        });

        const footer = document.getElementById('tai-footer');
        if (footer) footer.style.display = state.activeTab === 'chat' ? 'flex' : 'none';
    }

    function renderChatTab(bodyEl) {
        let html = '';
        if (state.practiceMode) {
            html += '<div class="tai-card" style="border-color:rgba(251,191,36,0.45);background:rgba(251,191,36,0.08);"><div style="font-size:11px;color:#fde68a;font-weight:700;line-height:1.6;">🛡️ حالت تمرین روشن است: تغییری در tilo_martell_planner ذخیره نمی‌شود.</div></div>';
        }
        if (!state.chatHistory.length) {
            html += '<div class="tai-card" style="text-align:center;padding:18px 12px;"><div style="font-size:13px;font-weight:900;color:#6ee7b7;">دستیار tilo آماده است</div><p style="font-size:11px;color:#93b8a8;margin:4px 0 0;line-height:1.7;">کلید API را از تب کلیدها وارد کنید. برای Gemini معمولاً VPN لازم است.</p></div>';
        } else {
            state.chatHistory.forEach(msg => {
                if (msg.role === 'error') {
                    html += '<div class="tai-msg error">' + renderRichText(msg.content) + '</div>';
                    return;
                }
                const isUser = msg.role === 'user';
                html += '<div class="tai-msg ' + (isUser ? 'user' : 'assistant') + '"><div class="tai-msg-head"><span>' +
                    escapeHtml(isUser ? 'شما' : (msg.modelLabel || 'AI')) + '</span><span dir="ltr">' +
                    escapeHtml(msg.time || '') + '</span></div><div>' + renderRichText(msg.content) + '</div>';
                if (msg.plannerSaved) html += '<div class="tai-tag-saved">✅ تقویم به‌روزرسانی شد</div>';
                if (msg.practiceBlocked) html += '<div class="tai-tag-practice">🛡️ تمرین روشن بود؛ ذخیره نشد</div>';
                html += '</div>';
            });
        }
        if (state.isLoading) {
            html += '<div class="tai-msg assistant" style="opacity:0.85;"><div class="tai-msg-head"><span>...</span></div><div>در حال پردازش</div></div>';
        }
        bodyEl.innerHTML = html;
        bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function renderMemoryTab(bodyEl) {
        const rows = state.sharedMemory.length
            ? state.sharedMemory.map(item =>
                '<div class="tai-item-row"><span style="flex:1;line-height:1.6;">' + escapeHtml(item.text) +
                '</span><button type="button" class="tai-btn-danger" data-del-mem="' + escapeHtml(item.id) + '">حذف</button></div>'
              ).join('')
            : '<p style="font-size:11px;color:#93b8a8;text-align:center;padding:10px 0;">حافظه خالی است.</p>';

        bodyEl.innerHTML =
            '<div class="tai-card"><h4 class="tai-card-title">حافظه مشترک</h4>' +
            '<div style="display:flex;gap:6px;"><input type="text" id="tai-mem-input" class="tai-field" placeholder="مثلاً: دوازدهم ریاضی..." />' +
            '<button type="button" id="tai-mem-add" class="tai-btn-primary" style="flex-shrink:0;">افزودن</button></div></div>' +
            '<div class="tai-card"><div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<h4 class="tai-card-title">موارد (' + state.sharedMemory.length + ')</h4>' +
            '<button type="button" id="tai-clear-chat" class="tai-btn-secondary">پاک کردن چت</button></div>' +
            '<div style="display:flex;flex-direction:column;gap:6px;">' + rows + '</div></div>';

        const addBtn = document.getElementById('tai-mem-add');
        const inputEl = document.getElementById('tai-mem-input');
        if (addBtn && inputEl) {
            addBtn.onclick = function () {
                const text = inputEl.value.trim();
                if (!text) return;
                state.sharedMemory.unshift({ id: 'mem_' + Date.now(), text: text });
                persistMemory();
                renderAll();
            };
        }
        const clearChatBtn = document.getElementById('tai-clear-chat');
        if (clearChatBtn) {
            clearChatBtn.onclick = function () {
                state.chatHistory = [];
                persistChat();
                renderAll();
            };
        }
        bodyEl.querySelectorAll('[data-del-mem]').forEach(btn => {
            btn.onclick = function () {
                const id = btn.getAttribute('data-del-mem');
                state.sharedMemory = state.sharedMemory.filter(m => m.id !== id);
                persistMemory();
                renderAll();
            };
        });
    }

    function renderKeysTab(bodyEl) {
        const hasBackup = localStorage.getItem(KEYS.PLANNER_BACKUP) !== null;
        const parsed = parseSelectedModel();
        const activeProviderName = PROVIDERS[parsed.provider] ? PROVIDERS[parsed.provider].name : parsed.provider;

        const keyRows = state.keys.length
            ? state.keys.map(k => {
                const activeForProvider = getActiveKeyForProvider(k.provider);
                const isActive = state.activeKeysMap[k.provider] === k.id || (!state.activeKeysMap[k.provider] && activeForProvider && activeForProvider.id === k.id);
                const pName = PROVIDERS[k.provider] ? PROVIDERS[k.provider].name : k.provider;
                return '<div class="tai-item-row" style="' + (isActive ? 'border-color:#6ee7b7;background:rgba(110,231,183,0.07);' : '') + '">' +
                    '<div style="flex:1;min-width:0;"><div style="font-weight:800;">' + escapeHtml(k.label || pName) +
                    ' <span style="font-size:9.5px;color:#6ee7b7;">' + escapeHtml(pName) + '</span></div>' +
                    '<div dir="ltr" style="font-size:10.5px;color:#93b8a8;font-family:monospace;">' + escapeHtml(maskKey(k.key)) + '</div></div>' +
                    '<div style="display:flex;gap:4px;">' +
                    '<button type="button" class="tai-btn-secondary" data-act-key="' + escapeHtml(k.id) + '">' + (isActive ? '✓' : 'فعال') + '</button>' +
                    '<button type="button" class="tai-btn-danger" data-del-key="' + escapeHtml(k.id) + '">حذف</button></div></div>';
            }).join('')
            : '<p style="font-size:11px;color:#93b8a8;text-align:center;">کلیدی نیست</p>';

        let testBannerHtml = '';
        if (state.testResult) {
            const ok = state.testResult.ok;
            testBannerHtml = '<div style="padding:8px 10px;border-radius:9px;font-size:11px;line-height:1.6;border:1px solid ' +
                (ok ? '#2d5a47' : 'rgba(248,113,113,0.5)') + ';background:' + (ok ? 'rgba(110,231,183,0.1)' : 'rgba(248,113,113,0.12)') +
                ';color:' + (ok ? '#6ee7b7' : '#fecaca') + ';">' + escapeHtml(state.testResult.message) + '</div>';
        }

        bodyEl.innerHTML =
            '<div class="tai-card"><h4 class="tai-card-title">افزودن کلید API</h4>' +
            '<select id="tai-new-key-provider" class="tai-field">' +
            '<option value="gemini">Google Gemini</option><option value="openrouter">OpenRouter</option>' +
            '<option value="groq">Groq</option><option value="xai">xAI (Grok)</option></select>' +
            '<input type="text" id="tai-new-key-label" class="tai-field" placeholder="نام برچسب" />' +
            '<input type="password" id="tai-new-key-secret" dir="ltr" class="tai-field" placeholder="کلید API" />' +
            '<button type="button" id="tai-save-key-btn" class="tai-btn-primary">ذخیره کلید</button></div>' +
            '<div class="tai-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">' +
            '<h4 class="tai-card-title">کلیدها (' + state.keys.length + ')</h4>' +
            '<button type="button" id="tai-test-conn-btn" class="tai-btn-secondary">' +
            (state.isTesting ? '...' : 'تست اتصال') + '</button></div>' + testBannerHtml +
            '<div style="display:flex;flex-direction:column;gap:6px;">' + keyRows + '</div></div>' +
            '<div class="tai-card"><h4 class="tai-card-title">پشتیبان تقویم</h4>' +
            '<button type="button" id="tai-restore-backup-btn" class="tai-btn-secondary" ' +
            (hasBackup ? '' : 'disabled style="opacity:0.5;"') + '>' +
            (hasBackup ? 'بازگردانی بکاپ' : 'بکاپ نیست') + '</button></div>';

        const saveBtn = document.getElementById('tai-save-key-btn');
        if (saveBtn) {
            saveBtn.onclick = function () {
                const provider = document.getElementById('tai-new-key-provider').value;
                const label = document.getElementById('tai-new-key-label').value.trim();
                const secret = document.getElementById('tai-new-key-secret').value.trim();
                if (!secret || secret.length < 10) return;
                const entry = {
                    id: 'k_' + Date.now(),
                    provider: provider,
                    label: label || (PROVIDERS[provider] && PROVIDERS[provider].name) || provider,
                    key: secret
                };
                state.keys.unshift(entry);
                state.activeKeysMap[provider] = entry.id;
                const cur = parseSelectedModel();
                if (cur.provider !== provider && PROVIDERS[provider]) {
                    state.selectedModel = provider + ':' + PROVIDERS[provider].models[0];
                    try { localStorage.setItem(KEYS.SELECTED_MODEL, state.selectedModel); } catch (_) {}
                }
                state.testResult = null;
                persistKeys();
                renderAll();
            };
        }

        bodyEl.querySelectorAll('[data-act-key]').forEach(btn => {
            btn.onclick = function () {
                const id = btn.getAttribute('data-act-key');
                const found = state.keys.find(k => k.id === id);
                if (!found) return;
                state.activeKeysMap[found.provider] = found.id;
                if (parseSelectedModel().provider !== found.provider && PROVIDERS[found.provider]) {
                    state.selectedModel = found.provider + ':' + PROVIDERS[found.provider].models[0];
                    try { localStorage.setItem(KEYS.SELECTED_MODEL, state.selectedModel); } catch (_) {}
                }
                persistKeys();
                renderAll();
            };
        });

        bodyEl.querySelectorAll('[data-del-key]').forEach(btn => {
            btn.onclick = function () {
                const id = btn.getAttribute('data-del-key');
                const found = state.keys.find(k => k.id === id);
                state.keys = state.keys.filter(k => k.id !== id);
                if (found && state.activeKeysMap[found.provider] === id) {
                    const nextKey = state.keys.find(k => k.provider === found.provider);
                    if (nextKey) state.activeKeysMap[found.provider] = nextKey.id;
                    else delete state.activeKeysMap[found.provider];
                }
                persistKeys();
                renderAll();
            };
        });

        const testBtn = document.getElementById('tai-test-conn-btn');
        if (testBtn) testBtn.onclick = handleTestConnection;

        const restoreBtn = document.getElementById('tai-restore-backup-btn');
        if (restoreBtn && hasBackup) {
            restoreBtn.onclick = function () {
                const backupRaw = localStorage.getItem(KEYS.PLANNER_BACKUP);
                if (backupRaw === null) return;
                try {
                    localStorage.setItem(KEYS.PLANNER, backupRaw);
                    window.dispatchEvent(new CustomEvent('tilo:planner-updated', { detail: JSON.parse(backupRaw) }));
                } catch (_) {}
                state.activeTab = 'chat';
                state.chatHistory.push({
                    role: 'assistant',
                    modelLabel: 'سیستم',
                    time: getTehranTimeStr(),
                    content: 'بکاپ تقویم بازگردانی شد. صفحه را رفرش کنید.'
                });
                persistChat();
                renderAll();
            };
        }
    }

    function renderGuideTab(bodyEl) {
        bodyEl.innerHTML =
            '<div class="tai-card"><h4 class="tai-card-title">کلید API</h4>' +
            '<p style="font-size:11.5px;line-height:1.75;margin:0;color:#ecfdf5;">کلید فقط در مرورگر شماست. برای Gemini معمولاً VPN لازم است. از «تست اتصال» استفاده کنید.</p></div>' +
            '<div class="tai-card"><h4 class="tai-card-title">حالت تمرین</h4>' +
            '<p style="font-size:11.5px;line-height:1.75;margin:0;color:#ecfdf5;">پیش‌فرض روشن است تا تقویم خراب نشود. برای اعمال واقعی تغییر، تمرین را خاموش کنید.</p></div>' +
            '<div class="tai-card"><h4 class="tai-card-title">نمونه دستور</h4>' +
            '<p style="font-size:11.5px;line-height:1.75;margin:0;color:#93b8a8;">«یک پارت ۶۰ دقیقه‌ای حسابان ساعت ۱۷ به امروز اضافه کن.»</p></div>';
    }

    function renderAll() {
        try {
            updateTopControls();
            const bodyEl = document.getElementById('tai-body');
            if (!bodyEl) return;
            if (state.activeTab === 'chat') renderChatTab(bodyEl);
            else if (state.activeTab === 'memory') renderMemoryTab(bodyEl);
            else if (state.activeTab === 'keys') renderKeysTab(bodyEl);
            else if (state.activeTab === 'guide') renderGuideTab(bodyEl);
        } catch (err) {
            console.warn('tilo-ai-agent: renderAll error:', err);
        }
    }

    async function handleTestConnection() {
        if (state.isTesting) return;
        const sel = parseSelectedModel();
        const provider = sel.provider;
        const model = sel.model;
        const providerObj = PROVIDERS[provider];
        const keyObj = getActiveKeyForProvider(provider);

        if (!keyObj || !keyObj.key) {
            state.testResult = { ok: false, message: 'ابتدا کلید ' + (providerObj && providerObj.name) + ' را اضافه کنید.' };
            renderAll();
            return;
        }

        state.isTesting = true;
        state.testResult = null;
        renderAll();
        const startedAt = Date.now();
        try {
            if (provider === 'gemini') {
                await requestGemini(keyObj.key, model, 'فقط بنویس OK', [], 'تست');
            } else {
                await requestOpenAICompatible(providerObj, keyObj.key, model, 'فقط بنویس OK', [], 'تست');
            }
            state.testResult = {
                ok: true,
                message: '✅ اتصال به ' + providerObj.name + ' (' + model + ') موفق — ' + (Date.now() - startedAt) + 'ms'
            };
        } catch (err) {
            state.testResult = { ok: false, message: err && err.message ? err.message : 'ناموفق' };
        } finally {
            state.isTesting = false;
            renderAll();
        }
    }

    async function handleSend() {
        if (state.isLoading) return;
        const textarea = document.getElementById('tai-textarea');
        const sendBtn = document.getElementById('tai-send-btn');
        if (!textarea) return;
        const userText = textarea.value.trim();
        if (!userText) return;

        const sel = parseSelectedModel();
        const provider = sel.provider;
        const model = sel.model;
        const providerObj = PROVIDERS[provider];
        const keyObj = getActiveKeyForProvider(provider);

        if (!keyObj || !keyObj.key) {
            state.chatHistory.push({ role: 'error', content: 'کلید API برای ' + (providerObj && providerObj.name) + ' ثبت نشده. از تب کلیدها اضافه کنید.' });
            persistChat();
            state.activeTab = 'keys';
            renderAll();
            return;
        }

        textarea.value = '';
        textarea.style.height = 'auto';
        const prevHistory = state.chatHistory.filter(m => m.role === 'user' || m.role === 'assistant');
        state.chatHistory.push({ role: 'user', time: getTehranTimeStr(), content: userText });
        persistChat();
        state.isLoading = true;
        if (sendBtn) sendBtn.disabled = true;
        renderAll();

        try {
            const sysPrompt = buildSystemInstruction();
            let rawReply = '';
            if (provider === 'gemini') {
                rawReply = await requestGemini(keyObj.key, model, sysPrompt, prevHistory, userText);
            } else {
                rawReply = await requestOpenAICompatible(providerObj, keyObj.key, model, sysPrompt, prevHistory, userText);
            }

            const parsed = parseModelOutput(rawReply);
            if (parsed.memories.length) {
                parsed.memories.forEach(mem => {
                    if (!state.sharedMemory.some(m => m.text === mem)) {
                        state.sharedMemory.unshift({ id: 'mem_' + Date.now(), text: mem });
                    }
                });
                persistMemory();
            }

            let plannerSaved = false;
            let practiceBlocked = false;
            let finalReply = parsed.cleanText || 'پاسخ دریافت شد.';
            const isCalIntent = hasCalendarChangeIntent(userText);

            if (isCalIntent && state.practiceMode) {
                practiceBlocked = true;
            } else if (!state.practiceMode && isCalIntent && parsed.plannerJson) {
                const writeOutcome = writePlannerSafely(parsed.plannerJson);
                if (writeOutcome.saved) plannerSaved = true;
                else if (writeOutcome.reason === 'empty_blocks') {
                    finalReply += '\n\n(blocks خالی بود — ذخیره نشد)';
                }
            }

            state.chatHistory.push({
                role: 'assistant',
                modelLabel: provider + ':' + model,
                time: getTehranTimeStr(),
                content: finalReply,
                plannerSaved: plannerSaved,
                practiceBlocked: practiceBlocked
            });
            persistChat();
        } catch (err) {
            state.chatHistory.push({ role: 'error', content: err && err.message ? err.message : 'خطا' });
            persistChat();
        } finally {
            state.isLoading = false;
            if (sendBtn) sendBtn.disabled = false;
            renderAll();
        }
    }

    function bindDrawerEvents() {
        const edgeTab = document.getElementById('tai-edge-tab');
        const fab = document.getElementById('tai-fab');
        const backdrop = document.getElementById('tai-backdrop');
        const closeBtn = document.getElementById('tai-close-btn');
        const practiceBtn = document.getElementById('tai-practice-toggle');
        const modelSelect = document.getElementById('tai-model-select');
        const customInput = document.getElementById('tai-custom-model-input');
        const keyPill = document.getElementById('tai-key-pill');
        const textarea = document.getElementById('tai-textarea');
        const sendBtn = document.getElementById('tai-send-btn');

        // FIXED: toggle + capture
        if (edgeTab) {
            edgeTab.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleDrawer();
            }, true);
        }
        if (fab) {
            fab.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleDrawer();
            }, true);
        }
        if (backdrop) backdrop.addEventListener('click', closeDrawer);
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

        if (practiceBtn) {
            practiceBtn.addEventListener('click', function () {
                state.practiceMode = !state.practiceMode;
                try { localStorage.setItem(KEYS.PRACTICE, state.practiceMode ? 'true' : 'false'); } catch (_) {}
                renderAll();
            });
        }

        if (modelSelect) {
            modelSelect.addEventListener('change', function () {
                state.selectedModel = modelSelect.value;
                state.testResult = null;
                try { localStorage.setItem(KEYS.SELECTED_MODEL, state.selectedModel); } catch (_) {}
                renderAll();
            });
        }

        if (customInput) {
            customInput.addEventListener('input', function () {
                state.customModel = customInput.value;
                try { localStorage.setItem(KEYS.CUSTOM_MODEL, state.customModel); } catch (_) {}
            });
        }

        if (keyPill) {
            keyPill.addEventListener('click', function () {
                state.activeTab = 'keys';
                renderAll();
            });
        }

        document.querySelectorAll('#tai-root .tai-tab').forEach(btn => {
            btn.addEventListener('click', function () {
                state.activeTab = btn.getAttribute('data-tab') || 'chat';
                renderAll();
            });
        });

        document.querySelectorAll('#tai-root .tai-chip').forEach(chip => {
            chip.addEventListener('click', function () {
                const promptText = chip.getAttribute('data-quick') || '';
                if (textarea && promptText) {
                    textarea.value = promptText;
                    handleSend();
                }
            });
        });

        if (sendBtn) sendBtn.addEventListener('click', handleSend);
        if (textarea) {
            textarea.addEventListener('input', function () {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(110, textarea.scrollHeight) + 'px';
            });
            textarea.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && state.isOpen) closeDrawer();
        });
    }

    function bootstrap() {
        try {
            loadState();
            window.tiloAI = {
                open: openDrawer,
                close: closeDrawer,
                toggle: toggleDrawer
            };

            function start() {
                mountUI();
                startMartellInjector();
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', start);
            } else {
                start();
            }
            window.addEventListener('load', function () {
                if (!document.getElementById('tai-drawer')) mountUI();
                startMartellInjector();
            });
        } catch (err) {
            console.warn('tilo-ai-agent: bootstrap error:', err);
        }
    }

    bootstrap();
})();
