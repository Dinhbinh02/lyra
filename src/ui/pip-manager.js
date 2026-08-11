export async function getSavedPipSize() {
    return new Promise((resolve) => {
        const storage = (typeof chrome !== 'undefined' && chrome.storage) ? (chrome.storage.sync || chrome.storage.local) : null;
        if (storage) {
            storage.get(['pipWidth', 'pipHeight'], (res) => {
                resolve({
                    pipWidth: res?.pipWidth || 240,
                    pipHeight: res?.pipHeight || 340
                });
            });
        } else {
            resolve({ pipWidth: 240, pipHeight: 340 });
        }
    });
}

export function savePipSize(pipWindow, isAutoResizingPip = false) {
    if (!pipWindow || pipWindow.closed || isAutoResizingPip) return;
    const w = Math.round(pipWindow.outerWidth || pipWindow.innerWidth || 0);
    const h = Math.round(pipWindow.outerHeight || pipWindow.innerHeight || 0);
    if (w > 100 && h > 80) {
        const storage = (typeof chrome !== 'undefined' && chrome.storage) ? (chrome.storage.sync || chrome.storage.local) : null;
        if (storage) {
            storage.set({ pipWidth: w, pipHeight: h });
        }
    }
}

export function adjustPipWindowHeight(pipWindow, needExpand, baseUserWidth = 240) {
    if (!needExpand || !pipWindow || pipWindow.closed) return;
    const minRequiredInnerHeight = 300;
    const currentInnerH = Math.round(pipWindow.innerHeight || 0);

    if (currentInnerH < minRequiredInnerHeight) {
        try {
            const currentW = Math.round(pipWindow.outerWidth || pipWindow.innerWidth || baseUserWidth);
            pipWindow.resizeTo(currentW, minRequiredInnerHeight);
        } catch (err) { }
    }
}
