/**
 * Centralized DOM helpers for interacting with YouTube Music player elements.
 * Provides resilient lookups by class name and localized aria-label/title regex fallback.
 */

export function getPlayerBar() {
    return document.querySelector('ytmusic-player-bar');
}

export function findBarButton(className, labelPattern) {
    const bar = getPlayerBar();
    if (!bar) return null;
    const byClass = bar.querySelector(`.${className}`);
    if (byClass) return byClass;
    if (labelPattern) {
        const re = new RegExp(labelPattern, 'i');
        for (const btn of bar.querySelectorAll('button, tp-yt-paper-icon-button')) {
            const label = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
            if (re.test(label)) return btn;
        }
    }
    return null;
}

export function clickIfFound(el) {
    if (!el) return false;
    const target = el.querySelector?.('button') || el;
    target.click();
    return true;
}

export function navigateApp(endpoint) {
    if (!endpoint) return false;
    try {
        const app = document.querySelector('ytmusic-app');
        if (app) {
            app.dispatchEvent(new CustomEvent('yt-navigate', {
                bubbles: true,
                composed: true,
                detail: { endpoint }
            }));
        }
    } catch (_) {}

    try {
        if (typeof window !== 'undefined') {
            window.postMessage({
                source: 'lyra-content',
                command: 'navigate',
                payload: { endpoint }
            }, window.location.origin);
        }
    } catch (_) {}
    return true;
}
