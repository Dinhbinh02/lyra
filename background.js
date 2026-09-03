chrome.action.onClicked.addListener(async (tab) => {
    try {
        const tabs = await chrome.tabs.query({ url: "*://music.youtube.com/*" });
        if (tabs.length === 0) {
            chrome.tabs.create({ url: "https://music.youtube.com" });
            return;
        }
        const ytmTab = tabs[0];
        await chrome.scripting.executeScript({
            target: { tabId: ytmTab.id },
            func: () => {
                const pipBtn = document.getElementById('pipButton') || document.querySelector('.pip-btn-injected');
                if (pipBtn) {
                    pipBtn.click();
                } else {
                    const event = new CustomEvent('request-pip-window', { detail: {} });
                    document.dispatchEvent(event);
                }
            }
        });
    } catch (e) {
    }
});

chrome.runtime.onUpdateAvailable.addListener(() => {
    chrome.runtime.reload();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "addToPlaylist") {
        handleAddToPlaylist(sendResponse);
        return true;
    }
    if (message.action === "focusTab") {
        if (sender.tab) {
            chrome.tabs.update(sender.tab.id, { active: true });
            chrome.windows.update(sender.tab.windowId, { focused: true });
            sendResponse({ success: true });
        } else {
            chrome.tabs.query({ url: "*://music.youtube.com/*" }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    chrome.tabs.update(tabs[0].id, { active: true });
                    chrome.windows.update(tabs[0].windowId, { focused: true });
                }
                sendResponse({ success: true });
            });
        }
        return true;
    }
    if (message.action === "romanizeBatch") {
        handleRomanizeBatch(message.payload, sendResponse);
        return true;
    }
});

async function handleRomanizeBatch({ texts, lang }, sendResponse) {
    if (!Array.isArray(texts) || texts.length === 0) {
        sendResponse({ success: true, results: [] });
        return;
    }

    const endpoints = [
        `https://clients5.google.com/translate_a/single?client=dict-chrome-ex&sl=${lang}&tl=${lang}-Latn&dt=t&dt=rm`,
        `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${lang}&tl=${lang}-Latn&dt=t&dt=rm`,
        `https://translate.google.com/translate_a/single?client=dict-chrome-ex&sl=${lang}&tl=${lang}-Latn&dt=t&dt=rm`,
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=${lang}-Latn&dt=t&dt=rm`
    ];

    const cleanRomaji = str => (str || '')
        .replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\u0e00-\u0e7f\u0400-\u04ff\u0500-\u052f\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0a80-\u0aff\u0b00-\u0b7f\u0b80-\u0bff\u0c00-\u0c7f\u0c80-\u0cff\u0d00-\u0d7f\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0590-\u05ff\u0370-\u03ff\u1f00-\u1fff\u1000-\u109f\u1780-\u17ff\u10a0-\u10ff\u0530-\u058f]/g, '')
        .replace(/[\u2200-\u2BFF\u2000-\u206F\u0000-\u001F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    async function trySingleBatch() {
        const payload = texts.join(' ### ');
        for (const url of endpoints) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `q=${encodeURIComponent(payload)}`
                });
                if (res.ok) {
                    const data = await res.json();
                    let rawTranslit = '';
                    if (Array.isArray(data) && Array.isArray(data[0])) {
                        for (const item of data[0]) {
                            if (Array.isArray(item)) {
                                if (typeof item[2] === 'string' && item[2]) rawTranslit += item[2];
                                else if (typeof item[3] === 'string' && item[3]) rawTranslit += item[3];
                            }
                        }
                    }
                    if (rawTranslit) {
                        const parts = rawTranslit.split(/###/i);
                        if (parts.length === texts.length) {
                            return parts.map(cleanRomaji);
                        }
                    }
                }
            } catch (err) { }
        }
        return null;
    }

    const batchResult = await trySingleBatch();
    if (batchResult) {
        sendResponse({ success: true, results: batchResult });
        return;
    }

    async function transliterateSingle(text) {
        if (!text || !text.trim()) return '';
        for (const url of endpoints) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `q=${encodeURIComponent(text)}`
                });
                if (res.ok) {
                    const data = await res.json();
                    let rawTranslit = '';
                    if (Array.isArray(data) && Array.isArray(data[0])) {
                        for (const item of data[0]) {
                            if (Array.isArray(item)) {
                                if (typeof item[2] === 'string' && item[2]) rawTranslit += item[2];
                                else if (typeof item[3] === 'string' && item[3]) rawTranslit += item[3];
                            }
                        }
                    }
                    if (!rawTranslit && Array.isArray(data[1])) {
                        rawTranslit = data[1].map(item => Array.isArray(item) ? item[0] : '').filter(Boolean).join(' ');
                    }
                    if (rawTranslit) {
                        return cleanRomaji(rawTranslit);
                    }
                }
            } catch (err) { }
        }
        return '';
    }

    const results = await Promise.all(texts.map(text => transliterateSingle(text)));
    sendResponse({ success: true, results });
}

async function handleAddToPlaylist(sendResponse) {
    try {
        const tabs = await chrome.tabs.query({ url: "*://music.youtube.com/*" });

        if (tabs.length === 0) {
            sendResponse({ success: false, reason: "No YouTube Music tab found" });
            return;
        }

        const ytmTab = tabs[0];

        await chrome.tabs.update(ytmTab.id, { active: true });
        await chrome.windows.update(ytmTab.windowId, { focused: true });

        chrome.scripting.executeScript({
            target: { tabId: ytmTab.id },
            func: function() {
                function clickAddToPlaylist() {
                    const playerBar = document.querySelector('ytmusic-player-bar');
                    if (!playerBar) return false;

                    const menuBtn = playerBar.querySelector('.menu.ytmusic-player-bar button, ytmusic-menu-renderer.ytmusic-player-bar button, button[aria-label="Action menu"]');
                    if (menuBtn) {

                        const style = document.createElement('style');
                        style.id = 'temp-hide-dropdown';
                        style.textContent = 'ytmusic-menu-popup-renderer, tp-yt-iron-dropdown { display: none !important; opacity: 0 !important; visibility: hidden !important; }';
                        document.head.appendChild(style);

                        menuBtn.click();

                        const checkAndClick = () => {
                            const addToPlaylistOption = document.querySelector('ytmusic-menu-popup-renderer ytmusic-menu-navigation-item-renderer[aria-label="Save to playlist"]');
                            if (addToPlaylistOption) {
                                addToPlaylistOption.click();

                                setTimeout(() => {
                                    style.remove();
                                }, 100);
                                return true;
                            }
                            return false;
                        };

                        let attempts = 0;
                        const interval = setInterval(() => {
                            if (checkAndClick() || attempts++ > 8) {
                                clearInterval(interval);

                                if (attempts > 8) {
                                    style.remove();
                                }
                            }
                        }, 30);
                        return true;
                    }
                    return false;
                }

                return clickAddToPlaylist();
            }
        }, (results) => {
            if (results && results[0] && results[0].result) {
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, reason: "Failed to execute add to playlist action" });
            }
        });
    } catch (error) {
        sendResponse({ success: false, error: error.message || "Unknown error" });
    }
}
