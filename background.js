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
        console.error('Action click error:', e);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "addToPlaylist") {
        handleAddToPlaylist(sendResponse);
        return true;
    }
});

async function handleAddToPlaylist(sendResponse) {
    try {
        const tabs = await chrome.tabs.query({ url: "*://music.youtube.com/*" });

        if (tabs.length === 0) {
            console.warn("YouTube Music tab not found.");
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
        console.error("Error trying to add to playlist:", error);
        sendResponse({ success: false, error: error.message || "Unknown error" });
    }
}
