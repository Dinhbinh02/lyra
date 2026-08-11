import { LYRICS_CACHE_EXPIRATION_MS } from '../config/constants.js';

let ytmBrowseLyrics = null;

(function setupYtmApiInterceptor() {
    if (typeof window === 'undefined' || window._lyraInterceptorSetup) return;
    window._lyraInterceptorSetup = true;

    const origFetch = window.fetch;
    window.fetch = async function (request, init) {
        const urlString = typeof request === "string" ? request : request?.url || "";
        const response = await origFetch.apply(this, arguments);

        if (urlString.includes("/youtubei/v1/browse")) {
            try {
                const clone = response.clone();
                clone.json().then(data => {
                    if (!data) return;
                    
                    const contents = data.contents?.singleColumnBrowseResultsRenderer?.tabs;
                    if (Array.isArray(contents)) {
                        for (const tab of contents) {
                            const tabRenderer = tab.tabRenderer;
                            if (tabRenderer?.pageType === "MUSIC_PAGE_TYPE_TRACK_LYRICS" || tabRenderer?.title?.toLowerCase() === "lyrics") {
                                const sectionList = tabRenderer.content?.sectionListRenderer?.contents;
                                if (Array.isArray(sectionList)) {
                                    for (const section of sectionList) {
                                        const shelf = section.musicDescriptionShelfRenderer;
                                        if (shelf && shelf.description && shelf.description.runs) {
                                            const text = shelf.description.runs.map(r => r.text).join('');
                                            if (text.trim().length > 0) {
                                                ytmBrowseLyrics = text.trim();
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }).catch(() => { });
            } catch (e) { }
        }
        return response;
    };
})();

export function parseLrc(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const result = [];
    const lineTimeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

    lines.forEach(rawLine => {
        let time = null;
        const lineMatch = lineTimeRegex.exec(rawLine);
        if (lineMatch) {
            const min = parseInt(lineMatch[1], 10);
            const sec = parseInt(lineMatch[2], 10);
            const ms = parseInt(lineMatch[3].padEnd(3, '0'), 10);
            time = min * 60 + sec + ms / 1000;
        }

        const lineWithoutHeader = rawLine.replace(lineTimeRegex, '').trim();
        if (!lineWithoutHeader) return;

        const words = [];
        const wordRegex = /(?:<(\d{2}):(\d{2})\.(\d{2,3})>|<(\d+)\.(\d{2,3})>)\s*([^<]+)/g;
        let wordMatch;

        while ((wordMatch = wordRegex.exec(lineWithoutHeader)) !== null) {
            let wordTime = 0;
            if (wordMatch[1] !== undefined) {
                const wMin = parseInt(wordMatch[1], 10);
                const wSec = parseInt(wordMatch[2], 10);
                const wMs = parseInt(wordMatch[3].padEnd(3, '0'), 10);
                wordTime = wMin * 60 + wSec + wMs / 1000;
            } else if (wordMatch[4] !== undefined) {
                const wSec = parseInt(wordMatch[4], 10);
                const wMs = parseInt(wordMatch[5].padEnd(3, '0'), 10);
                wordTime = wSec + wMs / 1000;
            }

            const wordText = wordMatch[6].trim();
            if (wordText) {
                words.push({
                    text: wordText,
                    time: wordTime,
                    duration: 0.6
                });
            }
        }

        if (words.length > 0) {
            for (let i = 0; i < words.length; i++) {
                if (i < words.length - 1) {
                    words[i].duration = Math.max(0.2, words[i + 1].time - words[i].time);
                } else {
                    words[i].duration = 0.8;
                }
            }
            if (time === null) {
                time = words[0].time;
            }
            const cleanText = words.map(w => w.text).join(' ');
            result.push({ time, text: cleanText, words });
        } else if (time !== null) {
            const cleanText = lineWithoutHeader.replace(/<[^>]+>/g, '').trim();
            if (cleanText) {
                result.push({ time, text: cleanText, words: null });
            }
        }
    });

    return result.sort((a, b) => a.time - b.time);
}

export function cleanExpiredLyricsCache() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError || !items) return;
        const now = Date.now();
        const keysToRemove = [];
        Object.keys(items).forEach(key => {
            if (key.startsWith('lyric_cache_')) {
                const cached = items[key];
                if (!cached || !cached.timestamp || (now - cached.timestamp > LYRICS_CACHE_EXPIRATION_MS)) {
                    keysToRemove.push(key);
                }
            }
        });
        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove);
        }
    });
}

export function getLyricsFromStorage(songKey) {
    return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            return resolve(null);
        }
        const storageKey = 'lyric_cache_' + songKey;
        chrome.storage.local.get([storageKey], (result) => {
            if (chrome.runtime.lastError || !result || !result[storageKey]) {
                return resolve(null);
            }
            const cached = result[storageKey];
            const now = Date.now();
            if (now - cached.timestamp > LYRICS_CACHE_EXPIRATION_MS) {
                chrome.storage.local.remove([storageKey]);
                return resolve(null);
            }
            resolve(cached);
        });
    });
}

export function saveLyricsToStorage(songKey, data, source) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    const storageKey = 'lyric_cache_' + songKey;
    const cacheObj = {
        timestamp: Date.now(),
        data: data,
        source: source
    };
    chrome.storage.local.set({ [storageKey]: cacheObj });
}

export function getLyricsFromDom() {
    try {
        if (ytmBrowseLyrics && ytmBrowseLyrics.length > 0) {
            return ytmBrowseLyrics;
        }

        const selectors = [
            'ytmusic-description-shelf-renderer .description[split-lines]',
            'ytmusic-description-shelf-renderer .description',
            '.non-expandable.description',
            'ytmusic-description-shelf-renderer yt-formatted-string.description',
            '.non-synced-lyrics'
        ];

        for (const sel of selectors) {
            const elements = document.querySelectorAll(sel);
            for (const el of elements) {
                const rawText = el.textContent || el.innerText || '';
                const text = rawText.trim();
                if (text.length > 5) {
                    const lines = text.split('\n')
                        .map(l => l.trim())
                        .filter(l => l.length > 0 && !/^source:|^lyricist:/i.test(l));
                    if (lines.length > 0) {
                        return lines.join('\n');
                    }
                }
            }
        }
    } catch (e) { }
    return null;
}

export function isArtistMatching(candidateArtist, primaryArtist, artistParts, fullArtist) {
    if (!candidateArtist) return false;
    const normalize = str => str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();

    const candNorm = normalize(candidateArtist);
    const primaryNorm = normalize(primaryArtist || '');
    const fullNorm = normalize(fullArtist || '');

    if (!candNorm) return false;

    if (primaryNorm && (candNorm.includes(primaryNorm) || primaryNorm.includes(candNorm))) return true;
    if (fullNorm && (candNorm.includes(fullNorm) || fullNorm.includes(candNorm))) return true;

    for (const part of (artistParts || [])) {
        const partNorm = normalize(part);
        if (partNorm.length >= 2 && (candNorm.includes(partNorm) || partNorm.includes(candNorm))) {
            return true;
        }
    }
    return false;
}

const romanizeCache = new Map();

export function detectLangCode(text) {
    if (/[\u3040-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    return 'ja';
}

export async function fetchRomanizedText(text) {
    if (!text || !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u0400-\u04ff]/.test(text)) {
        return null;
    }
    if (romanizeCache.has(text)) {
        return romanizeCache.get(text);
    }
    try {
        const lang = detectLangCode(text);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${lang}&tl=${lang}-Latn&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            let rawRomanized = '';

            if (Array.isArray(data) && Array.isArray(data[0])) {
                const translitChunks = data[0]
                    .map(item => (Array.isArray(item) && item[3]) ? item[3] : ((Array.isArray(item) && item[2]) ? item[2] : ''))
                    .filter(Boolean);
                if (translitChunks.length > 0) {
                    rawRomanized = translitChunks.join(' ');
                }
            }

            if (!rawRomanized && Array.isArray(data[1])) {
                const altChunks = data[1].map(item => Array.isArray(item) ? item[0] : '').filter(Boolean);
                if (altChunks.length > 0) rawRomanized = altChunks.join(' ');
            }

            if (rawRomanized) {
                let cleanRomanized = rawRomanized
                    .replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g, '')
                    .replace(/[\u2200-\u2BFF\u2000-\u206F\u0000-\u001F]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (cleanRomanized) {
                    romanizeCache.set(text, cleanRomanized);
                    return cleanRomanized;
                }
            }
        }
    } catch (e) { }
    return null;
}
