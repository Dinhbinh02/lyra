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

    function parseListItem(entry) {
        const renderer = entry?.musicResponsiveListItemRenderer ?? entry?.musicTwoRowItemRenderer;
        if (!renderer) return null;
        const videoId = renderer?.playlistItemData?.videoId ?? renderer?.navigationEndpoint?.watchEndpoint?.videoId ?? null;
        const runs = renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? renderer?.title?.runs ?? [];
        const title = runs.map(r => r.text).join("");
        const artistRuns = renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? renderer?.subtitle?.runs ?? [];
        const artist = artistRuns.map(r => r.text).join("");
        const durRuns = renderer?.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? renderer?.lengthText?.runs ?? [];
        const duration = durRuns.map(r => r.text).join("");
        const thumbs = renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
        const thumb = thumbs.length ? thumbs[thumbs.length - 1].url : (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : "");
        return { videoId, title, artist, duration, thumb };
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
        }
    });
})();
