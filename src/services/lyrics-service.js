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

export function saveLyricsToStorage(songKey, data, source, type = 'SYNCED') {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    const storageKey = 'lyric_cache_' + songKey;
    const cacheObj = {
        timestamp: Date.now(),
        data: data,
        source: source,
        type: type
    };
    chrome.storage.local.set({ [storageKey]: cacheObj });
}

export function resetYtmBrowseLyrics() {
    ytmBrowseLyrics = null;
}

export function getLyricsFromDom() {
    try {
        const lyricsTabBtn = document.querySelector('tp-yt-paper-tab[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"], tp-yt-paper-tab.tab-header:nth-child(2)');
        if (lyricsTabBtn) {
            const isDisabled = lyricsTabBtn.hasAttribute('disabled') || lyricsTabBtn.getAttribute('aria-disabled') === 'true' || lyricsTabBtn.disabled;
            if (isDisabled) {
                return null;
            }
        }

        if (ytmBrowseLyrics && ytmBrowseLyrics.length > 0) {
            if (/wikipedia\.org|CC-BY-SA|creative\s*commons/i.test(ytmBrowseLyrics)) {
                ytmBrowseLyrics = null;
                return null;
            }
            return ytmBrowseLyrics;
        }

        const lyricsTab = document.querySelector('ytmusic-tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"], #tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"]');
        const container = lyricsTab ? (lyricsTab.closest('ytmusic-tab-renderer') || lyricsTab) : null;
        if (!container) return null;

        const selectors = [
            'ytmusic-description-shelf-renderer .description[split-lines]',
            'ytmusic-description-shelf-renderer .description',
            '.non-expandable.description',
            'ytmusic-description-shelf-renderer yt-formatted-string.description',
            '.non-synced-lyrics'
        ];

        for (const sel of selectors) {
            const elements = container.querySelectorAll(sel);
            for (const el of elements) {
                const rawText = el.textContent || el.innerText || '';
                const text = rawText.trim();
                if (text.length > 5) {
                    if (/wikipedia\.org|CC-BY-SA|creative\s*commons/i.test(text)) {
                        continue;
                    }
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

export function isTrackTitleMatching(candidateTrack, targetTrack, strict = false) {
    if (!candidateTrack || !targetTrack) return false;
    const normalize = str => (str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .normalize("NFC")
        .replace(/\(feat\..*?\)|\[feat\..*?\]|\(with.*?\)|\[with.*?\]|\(official.*?\)|\[official.*?\]|\(audio\)|\[audio\]|\(mv\)|\[mv\]|\(ost.*?\)|\[ost.*?\]/gi, "")
        .replace(/[\s\p{P}\p{S}]+/gu, "")
        .trim();

    const candNorm = normalize(candidateTrack);
    const targetNorm = normalize(targetTrack);
    if (!candNorm || !targetNorm) return false;

    if (candNorm === targetNorm) return true;
    if (strict) return false;

    return (candNorm.length >= 4 && targetNorm.length >= 4 && (candNorm.includes(targetNorm) || targetNorm.includes(candNorm)));
}

export function isArtistMatching(candidateArtist, primaryArtist, artistParts, fullArtist) {
    if (!candidateArtist) return false;
    const normalize = str => (str || '')
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .normalize("NFC")
        .replace(/[\s\p{P}\p{S}]+/gu, "")
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
const MAX_ROMANIZE_CACHE = 400;

function setRomanizeCache(key, val) {
    if (romanizeCache.size >= MAX_ROMANIZE_CACHE) {
        const oldestKey = romanizeCache.keys().next().value;
        romanizeCache.delete(oldestKey);
    }
    romanizeCache.set(key, val);
}

export function detectLangCode(text) {
    if (/[\u3040-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(text)) return 'ko';
    if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text)) return 'zh-CN';
    if (/[\u0e00-\u0e7f]/.test(text)) return 'th';
    if (/[\u0400-\u04ff\u0500-\u052f]/.test(text)) return 'ru';
    if (/[\u0900-\u097f]/.test(text)) return 'hi';
    if (/[\u0980-\u09ff]/.test(text)) return 'bn';
    if (/[\u0a00-\u0a7f]/.test(text)) return 'pa';
    if (/[\u0a80-\u0aff]/.test(text)) return 'gu';
    if (/[\u0b80-\u0bff]/.test(text)) return 'ta';
    if (/[\u0c00-\u0c7f]/.test(text)) return 'te';
    if (/[\u0c80-\u0cff]/.test(text)) return 'kn';
    if (/[\u0d00-\u0d7f]/.test(text)) return 'ml';
    if (/[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(text)) return 'ar';
    if (/[\u0590-\u05ff]/.test(text)) return 'he';
    if (/[\u0370-\u03ff\u1f00-\u1fff]/.test(text)) return 'el';
    if (/[\u1000-\u109f]/.test(text)) return 'my';
    if (/[\u1780-\u17ff]/.test(text)) return 'km';
    if (/[\u10a0-\u10ff]/.test(text)) return 'ka';
    if (/[\u0530-\u058f]/.test(text)) return 'hy';
    return 'auto';
}

export async function fetchYtmOfficialLyrics(videoId, customFetch, customSignal) {
    if (!videoId) return null;
    const fetchFn = customFetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchFn) return null;
    try {
        const nextRes = await fetchFn("https://music.youtube.com/youtubei/v1/next?prettyPrint=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: customSignal,
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: "WEB_REMIX",
                        clientVersion: "1.20260825.01.00",
                        hl: "en",
                        gl: "US"
                    }
                },
                videoId
            })
        });
        if (!nextRes.ok) return null;
        const nextData = await nextRes.json();
        const tabs = nextData?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs;
        if (!Array.isArray(tabs)) return null;

        let lyricsBrowseId = null;
        for (const t of tabs) {
            const tr = t?.tabRenderer;
            const endpoint = tr?.endpoint?.browseEndpoint;
            const pageType = endpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
            if (pageType === "MUSIC_PAGE_TYPE_TRACK_LYRICS" || tr?.title?.toLowerCase() === "lyrics") {
                lyricsBrowseId = endpoint?.browseId;
                break;
            }
        }
        if (!lyricsBrowseId) return null;

        const browseRes = await fetchFn("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: customSignal,
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: "WEB_REMIX",
                        clientVersion: "1.20260825.01.00",
                        hl: "en",
                        gl: "US"
                    }
                },
                browseId: lyricsBrowseId
            })
        });
        if (!browseRes.ok) return null;
        const browseData = await browseRes.json();
        const sectionList = browseData?.contents?.sectionListRenderer?.contents;
        if (Array.isArray(sectionList)) {
            for (const section of sectionList) {
                const shelf = section?.musicDescriptionShelfRenderer;
                if (shelf?.description?.runs) {
                    const text = shelf.description.runs.map(r => r.text).join("");
                    if (text.trim().length > 0) {
                        const rawFooter = shelf.footer?.runs?.[0]?.text || 'YouTube Music';
                        const source = rawFooter.toLowerCase().startsWith('source:') ? rawFooter : `Source: ${rawFooter}`;
                        return {
                            text: text.trim(),
                            source: source
                        };
                    }
                }
            }
        }
    } catch (e) { }
    return null;
}

export async function fetchLyricsPipeline({ title, artist, durationSec = 0, videoId = null, customFetch, headers = {} }) {
    const fetchFn = customFetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchFn || !title) {
        return { success: false, type: 'NOT_FOUND', source: 'None', data: null };
    }

    const artistSection = (artist || '').split('•')[0].trim();
    const artistParts = artistSection.split(/[,&/]|\bft\.\b|\bfeat\.\b/i).map(a => a.trim()).filter(Boolean);
    const primaryArtist = artistParts[0] || artistSection;

    const defaultHeaders = {
        'Lrclib-Client': 'Star_s YTM v1.0.0 (https://github.com/star-ytm)',
        ...headers
    };

    const cleanTitle = title.replace(/\(feat\..*?\)/i, '').replace(/\[.*?\]/g, '').replace(/\(Official.*?\)/i, '').trim();
    const titleCandidates = [];
    if (cleanTitle.includes('-')) {
        cleanTitle.split('-').map(t => t.trim()).filter(Boolean).reverse().forEach(subT => {
            if (!titleCandidates.includes(subT)) titleCandidates.push(subT);
        });
    }
    if (!titleCandidates.includes(cleanTitle)) {
        titleCandidates.push(cleanTitle);
    }

    const globalController = typeof AbortController !== 'undefined' ? new AbortController() : null;

    const fetchWithTimeout = async (url, options = {}, timeoutMs = 2000) => {
        const timeoutController = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let id = null;
        if (timeoutController) {
            id = setTimeout(() => timeoutController.abort(), timeoutMs);
        }
        const signal = globalController 
            ? (AbortSignal.any ? AbortSignal.any([globalController.signal, timeoutController.signal]) : globalController.signal)
            : (timeoutController ? timeoutController.signal : undefined);

        try {
            const res = await fetchFn(url, { ...options, signal });
            if (id) clearTimeout(id);
            return res;
        } catch (e) {
            if (id) clearTimeout(id);
            throw e;
        }
    };

    const searchUrls = [];
    if (durationSec > 0) {
        searchUrls.push(`https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}&duration=${durationSec}`);
    }
    searchUrls.push(`https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`);
    titleCandidates.forEach(targetTitle => {
        searchUrls.push(`https://lrclib.net/api/search?track_name=${encodeURIComponent(targetTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`);
        if (artistParts.length > 1) {
            artistParts.slice(1).forEach(part => {
                searchUrls.push(`https://lrclib.net/api/search?track_name=${encodeURIComponent(targetTitle)}&artist_name=${encodeURIComponent(part)}`);
            });
        }
        searchUrls.push(`https://lrclib.net/api/search?q=${encodeURIComponent(targetTitle + ' ' + primaryArtist)}`);
    });

    const uniqueSearchUrls = Array.from(new Set(searchUrls));

    return new Promise(async (resolve) => {
        let isResolved = false;
        const allCandidates = [];
        let ytmResult = null;

        const checkFastSynced = (item) => {
            if (!item || !item.syncedLyrics) return false;
            if (!isArtistMatching(item.artistName, primaryArtist, artistParts, artistSection)) return false;
            const isExact = titleCandidates.some(t => isTrackTitleMatching(item.trackName, t, true));
            if (!isExact) return false;
            if (durationSec > 0 && item.duration) {
                const diff = Math.abs(item.duration - durationSec);
                if (diff > 3) return false;
            }
            return true;
        };

        const tryFastResolve = (item) => {
            if (isResolved) return;
            if (checkFastSynced(item)) {
                isResolved = true;
                if (globalController) globalController.abort();
                resolve({
                    success: true,
                    type: 'SYNCED',
                    source: 'Source: LRCLIB',
                    data: item
                });
                return true;
            }
            return false;
        };

        const lrclibPromises = uniqueSearchUrls.map(async (url) => {
            try {
                const res = await fetchWithTimeout(url, { headers: defaultHeaders }, 2000);
                if (res.ok) {
                    const data = await res.json();
                    const items = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []);
                    for (const item of items) {
                        allCandidates.push(item);
                        if (tryFastResolve(item)) return;
                    }
                }
            } catch (e) {}
        });

        const ytmPromise = (async () => {
            if (!videoId) return;
            try {
                ytmResult = await fetchYtmOfficialLyrics(videoId, fetchFn, globalController ? globalController.signal : undefined);
            } catch (e) {}
        })();

        await Promise.allSettled([...lrclibPromises, ytmPromise]);
        if (isResolved) return;

        const validCandidates = allCandidates.filter(data => {
            if (!data || (!data.syncedLyrics && !data.plainLyrics)) return false;
            if (!isArtistMatching(data.artistName, primaryArtist, artistParts, artistSection)) return false;
            const isExact = titleCandidates.some(t => isTrackTitleMatching(data.trackName, t, true));
            if (!isExact && durationSec === 0) return false;
            if (!isExact && !titleCandidates.some(t => isTrackTitleMatching(data.trackName, t, false))) return false;
            if (durationSec > 0 && data.duration) {
                const diff = Math.abs(data.duration - durationSec);
                const maxDiff = data.syncedLyrics ? 3 : 6;
                if (diff > maxDiff) return false;
            }
            return true;
        });

        if (validCandidates.length > 0) {
            validCandidates.sort((a, b) => {
                const exactTitleA = titleCandidates.some(t => isTrackTitleMatching(a.trackName, t, true)) ? 150 : 0;
                const exactTitleB = titleCandidates.some(t => isTrackTitleMatching(b.trackName, t, true)) ? 150 : 0;
                let scoreA = (a.syncedLyrics ? 100 : 0) + exactTitleA;
                let scoreB = (b.syncedLyrics ? 100 : 0) + exactTitleB;
                if (durationSec > 0) {
                    const diffA = a.duration ? Math.abs(a.duration - durationSec) : 999;
                    const diffB = b.duration ? Math.abs(b.duration - durationSec) : 999;
                    if (diffA <= 1) scoreA += 60;
                    else if (diffA <= 3) scoreA += 30;
                    if (diffB <= 1) scoreB += 60;
                    else if (diffB <= 3) scoreB += 30;
                }
                return scoreB - scoreA;
            });

            const bestMatch = validCandidates[0];
            if (bestMatch.syncedLyrics) {
                return resolve({
                    success: true,
                    type: 'SYNCED',
                    source: 'Source: LRCLIB',
                    data: bestMatch
                });
            } else if (!ytmResult) {
                return resolve({
                    success: true,
                    type: 'PLAIN',
                    source: 'Source: LRCLIB',
                    data: bestMatch
                });
            }
        }

        if (ytmResult) {
            return resolve({
                success: true,
                type: 'PLAIN',
                source: ytmResult.source || 'Source: YouTube Music',
                data: { plainLyrics: ytmResult.text }
            });
        }

        return resolve({
            success: false,
            type: 'NOT_FOUND',
            source: 'None',
            data: null
        });
    });
}
