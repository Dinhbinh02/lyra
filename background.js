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
                    const navButtons = document.querySelectorAll("#navigation-endpoint");
                    const directAddToPlaylistBtn = navButtons.length > 1 ?
                        navButtons[1] : null;

                    if (directAddToPlaylistBtn && directAddToPlaylistBtn.offsetParent !== null) {
                        directAddToPlaylistBtn.click();
                        return true;
                    } else {
                        const rootElement = document.getElementsByClassName("middle-controls-buttons style-scope ytmusic-player-bar")[0];
                        if (!rootElement) {
                            console.error("YTMusic Helper: Root control element not found.");
                            return false;
                        }

                        const menuBtn = rootElement.querySelector(".menu button");
                        if (!menuBtn) {
                            console.error("YTMusic Helper: Menu button not found.");
                            return false;
                        }

                        menuBtn.click();
                        menuBtn.click();

                        setTimeout(() => {
                            const navButtonsMenu = document.querySelectorAll("#navigation-endpoint");
                            const menuAddToPlaylistBtn = navButtonsMenu.length > 1 ? navButtonsMenu[1] : null;

                            if (menuAddToPlaylistBtn) {
                                menuAddToPlaylistBtn.click();
                            }
                        }, 500);

                        return true;
                    }
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
