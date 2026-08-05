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
            console.warn("Pestaña de YouTube Music no encontrada.");
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
                    const botonesNavegacion = document.querySelectorAll("#navigation-endpoint");
                    const botonAnadirAPlaylistDirecto = botonesNavegacion.length > 1 ?
                        botonesNavegacion[1] : null;

                    if (botonAnadirAPlaylistDirecto && botonAnadirAPlaylistDirecto.offsetParent !== null) {
                        botonAnadirAPlaylistDirecto.click();
                        return true; // Éxito
                    } else {
                        const rootElement = document.getElementsByClassName("middle-controls-buttons style-scope ytmusic-player-bar")[0];
                        if (!rootElement) {
                            console.error("YTMusic Helper: No se encontró el elemento raíz de los controles.");
                            return false;
                        }

                        const botonMenu = rootElement.querySelector(".menu button");
                        if (!botonMenu) {
                            console.error("YTMusic Helper: No se encontró el botón de menú.");
                            return false;
                        }

                        botonMenu.click();
                        botonMenu.click();

                        setTimeout(() => {
                            const navButtons = document.querySelectorAll("#navigation-endpoint");
                            const botonAnadirEnMenu = navButtons.length > 1 ? navButtons[1] : null;

                            if (botonAnadirEnMenu) {
                                botonAnadirEnMenu.click();
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
        console.error("Error al intentar añadir a playlist:", error);
        sendResponse({ success: false, error: error.message || "Error desconocido" });
    }
}
