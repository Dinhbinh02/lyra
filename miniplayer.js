(() => {
    const FROM_MINIPLAYER = "lyra-miniplayer";
    const FROM_CONTENT = "lyra-content";

    const cfgGet = (key) => window.ytcfg?.get?.(key) ?? window.ytcfg?.data_?.[key];

    async function sapisidHash() {
        const match = document.cookie.match(/(?:^|;\s*)(?:SAPISID|__Secure-3PAPISID)=([^;]+)/);
        if (!match) return null;
        const ts = Math.floor(Date.now() / 1000);
        const input = new TextEncoder().encode(`${ts} ${match[1]} ${location.origin}`);
        const digest = await crypto.subtle.digest("SHA-1", input);
        const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
        return `SAPISIDHASH ${ts}_${hex}`;
    }

    async function innertubeRequest(path, body) {
        const context = cfgGet("INNERTUBE_CONTEXT");
        if (!context) return null;
        const headers = { "content-type": "application/json", "x-origin": location.origin };
        const auth = await sapisidHash();
        if (auth) {
            headers.authorization = auth;
            headers["x-goog-authuser"] = String(cfgGet("SESSION_INDEX") ?? "0");
        }
        const key = cfgGet("INNERTUBE_API_KEY");
        const sep = path.includes("?") ? "&" : "?";
        const url = `/youtubei/v1/${path}${sep}prettyPrint=false${key ? `&key=${encodeURIComponent(key)}` : ""}`;
        const res = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ context, ...body }),
        });
        if (!res.ok) return null;
        return res.json();
    }

    function queueRendererOf(entry) {
        return (
            entry?.playlistPanelVideoRenderer ??
            entry?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer ??
            null
        );
    }

    function readQueueData() {
        const queueEl = document.querySelector("ytmusic-player-queue");
        let items = null;
        try {
            const state = queueEl?.queue?.store?.store?.getState?.() ?? queueEl?.queue?.store?.getState?.();
            const q = state?.queue;
            if (q) items = [...(q.items ?? []), ...(q.automixItems ?? [])];
        } catch (err) { }

        if (!Array.isArray(items) || !items.length) {
            try {
                items = queueEl?.queue?.getItems?.() ?? null;
            } catch (err) { items = null; }
        }
        if (!Array.isArray(items) || !items.length) {
            const player = document.getElementById("movie_player");
            const ids = player?.getPlaylist?.() ?? null;
            if (Array.isArray(ids) && ids.length) {
                return ids.map(id => ({
                    videoId: id ?? null,
                    title: "",
                    thumb: id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ""
                }));
            }
            return null;
        }

        const mapped = items.map((entry) => {
            const renderer = queueRendererOf(entry);
            const counterpart = entry?.playlistPanelVideoWrapperRenderer?.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer ?? null;
            const thumbs = renderer?.thumbnail?.thumbnails ?? counterpart?.thumbnail?.thumbnails ?? [];
            const videoId = renderer?.videoId ?? counterpart?.videoId ?? null;
            return {
                videoId,
                title: (renderer?.title?.runs ?? []).map((run) => run.text).join(""),
                artist: (renderer?.shortBylineText?.runs ?? []).map((run) => run.text).join(""),
                thumb: thumbs.length ? thumbs[thumbs.length - 1].url : (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "")
            };
        });

        const player = document.getElementById("movie_player");
        const ids = player?.getPlaylist?.() ?? null;
        if (Array.isArray(ids) && ids.length === mapped.length) {
            mapped.forEach((entry, i) => {
                if (!entry.videoId) entry.videoId = ids[i] ?? null;
                if (!entry.thumb && ids[i]) entry.thumb = `https://i.ytimg.com/vi/${ids[i]}/mqdefault.jpg`;
            });
        }
        return mapped;
    }

    function collectPlaylistItems(items, playlists) {
        let token = null;
        for (const item of items ?? []) {
            const riderToken = item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
            if (riderToken) {
                token = riderToken;
                continue;
            }
            const renderer = item?.musicTwoRowItemRenderer;
            const rawBrowseId = renderer?.navigationEndpoint?.browseEndpoint?.browseId ?? "";
            if (!rawBrowseId) continue;
            let browseId = rawBrowseId;
            if (browseId.startsWith("PL")) browseId = "VL" + browseId;
            if (!browseId.startsWith("VL")) continue;

            const thumbs = renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
            playlists.push({
                id: browseId,
                title: (renderer.title?.runs ?? []).map((run) => run.text).join(""),
                subtitle: (renderer.subtitle?.runs ?? []).map((run) => run.text).join(""),
                thumb: thumbs.length ? thumbs[thumbs.length - 1].url : "",
            });
        }
        return token;
    }

    async function getPlaylists() {
        try {
            if (!(await sapisidHash())) return [];
            const data = await innertubeRequest("browse", { browseId: "FEmusic_liked_playlists" });
            if (!data) return [];
            const sections =
                data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
                    ?.sectionListRenderer?.contents ??
                data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer
                    ?.contents ??
                [];
            const grid = sections.find((s) => s.gridRenderer)?.gridRenderer;
            const playlists = [];
            let token = collectPlaylistItems(grid?.items, playlists) ?? grid?.continuations?.[0]?.nextContinuationData?.continuation ?? null;
            for (let page = 0; token && page < 5; page++) {
                const next = await innertubeRequest(`browse?ctoken=${encodeURIComponent(token)}&type=next`, { continuation: token });
                if (!next) break;
                const gridCont = next?.continuationContents?.gridContinuation;
                const contItems = gridCont?.items ?? (next?.onResponseReceivedActions ?? []).flatMap(a => a?.appendContinuationItemsAction?.continuationItems ?? []);
                token = collectPlaylistItems(contItems, playlists) ?? gridCont?.continuations?.[0]?.nextContinuationData?.continuation ?? null;
            }
            return playlists;
        } catch (err) {
            return [];
        }
    }

    async function addToPlaylist(playlistId, videoId) {
        let vid = videoId;
        if (!vid) {
            const player = document.getElementById("movie_player");
            vid = player?.getVideoData?.()?.video_id || null;
        }
        if (!playlistId || !vid) return "error";

        const cleanPlaylistId = playlistId.replace(/^VL/, "");

        try {
            const data = await innertubeRequest("browse/edit_playlist", {
                playlistId: cleanPlaylistId,
                actions: [{
                    action: "ACTION_ADD_VIDEO",
                    addedVideoId: vid,
                    dedupeOption: "DEDUPE_OPTION_CHECK"
                }]
            });
            if (data?.status === "STATUS_SUCCEEDED") return "added";
            if (data?.status === "STATUS_FAILED") return "duplicate";
            return "error";
        } catch (err) {
            return "error";
        }
    }

    async function playVideo(videoId) {
        if (!videoId) return false;
        const app = document.querySelector("ytmusic-app");
        if (app) {
            app.dispatchEvent(new CustomEvent("yt-navigate", {
                bubbles: true,
                composed: true,
                detail: {
                    endpoint: {
                        watchEndpoint: {
                            videoId,
                            startTimeSeconds: 0,
                            watchEndpointMusicSupportedConfigs: {
                                watchEndpointMusicConfig: {
                                    musicVideoType: "MUSIC_VIDEO_TYPE_ATV"
                                }
                            }
                        }
                    }
                }
            }));
            return true;
        }
        return false;
    }

    function navigate(endpoint) {
        if (!endpoint) return false;
        const app = document.querySelector("ytmusic-app");
        if (app) {
            app.dispatchEvent(new CustomEvent("yt-navigate", {
                bubbles: true,
                composed: true,
                detail: { endpoint }
            }));
            return true;
        }
        return false;
    }

    async function playPlaylist(playlistId, shuffle = false) {
        if (!playlistId) return false;
        const app = document.querySelector("ytmusic-app");
        if (!app) return false;
        const pid = String(playlistId).replace(/^VL/, "");
        const watchPlaylistEndpoint = { playlistId: pid };
        if (shuffle) {
            watchPlaylistEndpoint.params = "wAEB8gECKAE%3D";
        }
        app.dispatchEvent(new CustomEvent("yt-navigate", {
            bubbles: true,
            composed: true,
            detail: {
                endpoint: {
                    watchPlaylistEndpoint
                }
            }
        }));
        return true;
    }

    function parseListItem(entry) {
        const renderer = entry?.musicResponsiveListItemRenderer ?? entry?.musicTwoRowItemRenderer;
        if (!renderer) return null;
        const isGreyedOut = renderer?.musicItemRendererDisplayPolicy === "MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT";
        const playButton = renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer;
        const playEndpoint = playButton?.playNavigationEndpoint?.watchEndpoint ?? renderer?.navigationEndpoint?.watchEndpoint ?? null;
        const videoId = renderer?.playlistItemData?.videoId ?? playEndpoint?.videoId ?? null;
        const isPlayable = !isGreyedOut && Boolean(playEndpoint || (playButton && videoId));
        const runs = renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? renderer?.title?.runs ?? [];
        const title = runs.map(r => r.text).join("");
        const artistRuns = renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? renderer?.subtitle?.runs ?? [];
        const artist = artistRuns.map(r => r.text).join("");
        const fixedRuns = renderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs ?? [];
        const lengthRuns = renderer?.lengthText?.runs ?? [];
        let duration = (fixedRuns.length ? fixedRuns : lengthRuns).map(r => r.text).join("").trim();
        if (!duration) {
            for (let i = 2; i < (renderer?.flexColumns?.length || 0); i++) {
                const text = (renderer.flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [])
                    .map(r => r.text).join("").trim();
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
                    duration = text;
                    break;
                }
            }
        }
        if (duration && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(duration)) {
            duration = "";
        }
        const thumbs = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
        const thumb = thumbs.length ? thumbs[thumbs.length - 1].url : (isPlayable && videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "");
        return { videoId, title, artist, duration, thumb, isPlayable };
    }

    const SEARCH_FILTERS = {
        songs: "EgWKAQIIAWoMEA4QChADEAQQCRAF",
        videos: "EgWKAQIQAWoMEA4QChADEAQQCRAF"
    };

    async function searchFiltered(query, params) {
        const data = await innertubeRequest("search", { query, params });
        if (!data) return [];
        const shelves = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
        const items = [];
        for (const shelf of shelves) {
            for (const entry of shelf?.musicShelfRenderer?.contents ?? []) {
                const item = parseListItem(entry);
                if (item?.title && item.videoId) items.push(item);
            }
        }
        return items;
    }

    async function searchMusic(query) {
        try {
            const [songs, videos] = await Promise.all([
                searchFiltered(query, SEARCH_FILTERS.songs),
                searchFiltered(query, SEARCH_FILTERS.videos)
            ]);
            return [...(songs || []), ...(videos || [])];
        } catch (err) {
            return [];
        }
    }

    window.addEventListener("message", async (e) => {
        if (e.source !== window || e.data?.source !== FROM_CONTENT) return;
        const { command, payload, requestId } = e.data;

        if (command === "getPlaylists") {
            const result = await getPlaylists();
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        } else if (command === "getQueueData") {
            const result = readQueueData();
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        } else if (command === "search") {
            const result = await searchMusic(payload.query);
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        } else if (command === "addToPlaylist") {
            const result = await addToPlaylist(payload.playlistId, payload.videoId);
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        } else if (command === "playVideo") {
            const result = await playVideo(payload.videoId);
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        } else if (command === "playPlaylist") {
            const result = await playPlaylist(payload?.playlistId, payload?.shuffle);
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        } else if (command === "navigate") {
            const result = navigate(payload?.endpoint);
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        } else if (command === "playQueueIndex") {
            const scope = document.querySelector("ytmusic-player-queue") ?? document;
            const items = [...scope.querySelectorAll("ytmusic-player-queue-item")].filter(
                (item) => !item.closest("#counterpart-renderer")
            );
            const item = items[payload.index];
            if (item && !item.hasAttribute("selected")) {
                const target = item.querySelector("ytmusic-play-button-renderer") ?? item;
                target.click();
            }
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result: true }, window.location.origin);
        } else if (command === "seekTo") {
            const targetSeconds = Math.max(0, Number(payload.seconds) || 0);
            const player = document.getElementById("movie_player");
            if (player && typeof player.seekTo === "function") {
                player.seekTo(targetSeconds, true);
            } else {
                const video = document.querySelector("video");
                if (video && isFinite(video.duration)) {
                    video.currentTime = targetSeconds;
                }
            }
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result: true }, window.location.origin);
        } else if (command === "getTrackLyrics") {
            const result = await getTrackLyrics(payload?.videoId);
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        } else if (command === "getPlaylistSongs") {
            const result = await getPlaylistSongs(payload?.playlistId);
            window.postMessage({ source: FROM_MINIPLAYER, type: "response", requestId, result }, window.location.origin);
        }
    });

    async function getPlaylistSongs(playlistId) {
        try {
            if (!(await sapisidHash())) return [];
            const cleanId = (playlistId || "").replace(/^VL/, "");
            const browseId = cleanId.startsWith("VL") ? cleanId : ("VL" + cleanId);
            const data = await innertubeRequest("browse", { browseId });
            if (!data) return [];

            const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs;
            const singleTabContent = tabs?.[0]?.tabRenderer?.content;
            const twoColSec = data?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents;
            const sectionList = singleTabContent?.sectionListRenderer?.contents ?? twoColSec?.sectionListRenderer?.contents ?? [];

            let rawItems = [];
            if (singleTabContent?.musicPlaylistShelfRenderer?.contents) {
                rawItems = singleTabContent.musicPlaylistShelfRenderer.contents;
            } else if (twoColSec?.musicPlaylistShelfRenderer?.contents) {
                rawItems = twoColSec.musicPlaylistShelfRenderer.contents;
            } else {
                for (const sec of sectionList) {
                    const shelf = sec?.musicPlaylistShelfRenderer ?? sec?.musicShelfRenderer;
                    if (Array.isArray(shelf?.contents)) {
                        rawItems.push(...shelf.contents);
                    }
                }
            }

            if (!rawItems.length) {
                function collectListItems(node) {
                    if (!node || typeof node !== "object") return;
                    if (node.musicResponsiveListItemRenderer) {
                        rawItems.push(node);
                        return;
                    }
                    for (const k of Object.keys(node)) {
                        if (Array.isArray(node[k])) {
                            node[k].forEach(collectListItems);
                        } else if (typeof node[k] === "object") {
                            collectListItems(node[k]);
                        }
                    }
                }
                collectListItems(data?.contents);
            }

            const items = [];
            for (const entry of rawItems) {
                const item = parseListItem(entry);
                if (item?.title && (item.videoId || item.isPlayable === false)) {
                    items.push(item);
                }
            }
            return items;
        } catch (err) {
            return [];
        }
    }

    async function getTrackLyrics(videoId) {
        try {
            if (!videoId) {
                const urlParams = new URLSearchParams(window.location.search);
                videoId = urlParams.get("v");
            }
            if (!videoId) return null;

            const nextData = await innertubeRequest("next", { videoId });
            if (!nextData) return null;

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

            const browseData = await innertubeRequest("browse", { browseId: lyricsBrowseId });
            if (!browseData) return null;

            const sectionList = browseData?.contents?.sectionListRenderer?.contents;
            if (Array.isArray(sectionList)) {
                for (const section of sectionList) {
                    const shelf = section?.musicDescriptionShelfRenderer;
                    if (shelf?.description?.runs) {
                        const text = shelf.description.runs.map(r => r.text).join("");
                        if (text.trim().length > 0) {
                            return text.trim();
                        }
                    }
                }
            }
            return null;
        } catch (err) {
            return null;
        }
    }
})();
