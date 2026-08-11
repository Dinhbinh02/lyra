export function getHighResCoverUrl(src) {
    if (!src) return null;
    let url = src;
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
        url = url
            .replace(/=w\d+-h\d+(-[a-z0-9-]+)?/gi, '=w1200-h1200-l90-rj')
            .replace(/=s\d+(-[a-z0-9-]+)?/gi, '=s1200-l90-rj')
            .replace(/=w\d+/gi, '=w1200')
            .replace(/=h\d+/gi, '=h1200');
    }
    if (url.includes('ytimg.com')) {
        url = url
            .replace(/(hqdefault|mqdefault|sddefault|default|hq720)\.jpg/gi, 'maxresdefault.jpg')
            .replace(/=w\d+-h\d+(-[a-z0-9-]+)?/gi, '=w1200-h1200-l90-rj')
            .replace(/=s\d+(-[a-z0-9-]+)?/gi, '=s1200-l90-rj');
    }
    return url;
}

export function getCurrentVideoId() {
    try {
        const titleLink = document.querySelector('ytmusic-player-bar .title a[href*="watch?v="]');
        if (titleLink) {
            const match = titleLink.href.match(/v=([a-zA-Z0-9_-]{11})/);
            if (match) return match[1];
        }
        const urlParams = new URLSearchParams(window.location.search);
        const vParam = urlParams.get('v');
        if (vParam && vParam.length === 11) return vParam;

        const player = document.querySelector('#movie_player');
        if (player && typeof player.getVideoData === 'function') {
            const data = player.getVideoData();
            if (data && data.video_id) return data.video_id;
        }
    } catch (e) { }
    return null;
}

export function extractArtistData() {
    const artistElement = document.querySelector('.subtitle.style-scope.ytmusic-player-bar');
    return {
        artistText: artistElement ? artistElement.textContent : 'Unknown Artist',
        artistHtml: artistElement ? artistElement.innerHTML : null
    };
}

export function injectMiniplayerScript() {
    if (document.getElementById('lyra-miniplayer-script')) return;
    const script = document.createElement('script');
    script.id = 'lyra-miniplayer-script';
    script.src = chrome.runtime.getURL('miniplayer.js');
    (document.head || document.documentElement).appendChild(script);
}

export function askMiniplayerAsync(command, payload = {}, timeoutMs = 8000) {
    return new Promise((resolve) => {
        const requestId = 'req_' + Math.random().toString(36).substring(2, 9);
        let timer = null;

        const onResponse = (e) => {
            if (e.detail && e.detail.requestId === requestId) {
                window.removeEventListener('lyra-miniplayer-response', onResponse);
                if (timer) clearTimeout(timer);
                resolve(e.detail.data);
            }
        };

        window.addEventListener('lyra-miniplayer-response', onResponse);

        window.dispatchEvent(new CustomEvent('lyra-miniplayer-command', {
            detail: { command, payload, requestId }
        }));

        timer = setTimeout(() => {
            window.removeEventListener('lyra-miniplayer-response', onResponse);
            resolve(null);
        }, timeoutMs);
    });
}

export function handleYouTubeAutoPauseBypass() {
    const selectors = [
        'ytmusic-you-there-renderer paper-button',
        'ytmusic-you-there-renderer button',
        '#confirm-button',
        'tp-yt-paper-dialog:has(ytmusic-you-there-renderer) paper-button'
    ];

    for (const selector of selectors) {
        const confirmBtn = document.querySelector(selector);
        if (confirmBtn && confirmBtn.offsetWidth > 0) {
            try {
                confirmBtn.click();
                const videoElement = document.querySelector('video');
                if (videoElement && videoElement.paused) {
                    videoElement.play();
                }
                return true;
            } catch (e) { }
        }
    }
    return false;
}
