

(function injectPromoBlockerCSS() {
    const css = `

        ytmusic-mealbar-promo-renderer,
        ytmusic-mealbar-promotion-renderer,
        ytmusic-banner-promo-renderer,
        ytmusic-statement-banner-renderer,
        #mealbar-promo-renderer,
        .ytmusic-mealbar-promo-renderer,
        tp-yt-paper-dialog:has(ytmusic-mealbar-promo-renderer),
        tp-yt-paper-dialog:has(ytmusic-mealbar-promotion-renderer),
        tp-yt-paper-dialog:has(ytmusic-you-there-renderer),

        ytmusic-app-install-banner-renderer,
        .ytmusic-app-install-banner-renderer,
        [class*="app-install"],

        ytmusic-guide-entry-renderer:has([href*="premium"]),
        ytmusic-nav-bar:has([href*="premium"]),
        tp-yt-paper-dialog:has([href*="premium"]) {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
        }
    `;
    const style = document.createElement('style');
    style.id = 'lyra-promo-blocker';
    style.textContent = css;
    const inject = () => {
        if (!document.getElementById('lyra-promo-blocker')) {
            (document.head || document.documentElement || document.body)?.appendChild(style);
        }
    };
    inject();
    document.addEventListener('DOMContentLoaded', inject, { once: true });
})();

class Spring {
    constructor(initial, dampingRatio, frequency) {
        if (dampingRatio * frequency < 0) {
            throw new Error("Spring does not converge.");
        }
        this.dampingRatio = dampingRatio;
        this.frequency = frequency;
        this.position = initial;
        this.final = initial;
        this.velocity = 0;
    }

    update(deltaTime) {
        const radialFrequency = this.frequency * Math.PI * 2;
        const offset = this.position - this.final;
        const decay = Math.exp(-this.dampingRatio * radialFrequency * deltaTime);

        let newPosition, newVelocity;
        if (this.dampingRatio === 1) {
            newPosition = (offset * (1 + radialFrequency * deltaTime) + this.velocity * deltaTime) * decay + this.final;
            newVelocity = (this.velocity * (1 - radialFrequency * deltaTime) - offset * (radialFrequency * radialFrequency * deltaTime)) * decay;
        } else if (this.dampingRatio < 1) {
            const c = Math.sqrt(1 - this.dampingRatio * this.dampingRatio);
            const cosVal = Math.cos(radialFrequency * c * deltaTime);
            const sinVal = Math.sin(radialFrequency * c * deltaTime);
            const z = c > 1e-4 ? sinVal / c : radialFrequency * deltaTime;
            const y = (radialFrequency * c) > 1e-4 ? sinVal / (radialFrequency * c) : deltaTime;

            newPosition = (offset * (cosVal + this.dampingRatio * z) + this.velocity * y) * decay + this.final;
            newVelocity = (this.velocity * (cosVal - z * this.dampingRatio) - offset * (z * radialFrequency)) * decay;
        } else {
            const c = Math.sqrt(this.dampingRatio * this.dampingRatio - 1);
            const r1 = -radialFrequency * (this.dampingRatio - c);
            const r2 = -radialFrequency * (this.dampingRatio + c);
            const co2 = (this.velocity - offset * r1) / (2 * radialFrequency * c);
            const co1 = offset - co2;
            const e1 = co1 * Math.exp(r1 * deltaTime);
            const e2 = co2 * Math.exp(r2 * deltaTime);

            newPosition = e1 + e2 + this.final;
            newVelocity = e1 * r1 + e2 * r2;
        }

        this.position = newPosition;
        this.velocity = newVelocity;
        return newPosition;
    }
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function getScaleTarget(t) {
    if (t <= 0.7) {
        return lerp(0.92, 1.18, t / 0.7);
    } else {
        return lerp(1.18, 1.0, (t - 0.7) / 0.3);
    }
}

function getYOffsetTarget(t) {
    if (t <= 0.9) {
        return lerp(0.05, -0.18, t / 0.9);
    } else {
        return lerp(-0.18, 0.0, (t - 0.9) / 0.1);
    }
}

function getGlowTarget(t) {
    if (t <= 0.15) {
        return lerp(0.0, 1.0, t / 0.15);
    } else if (t <= 0.6) {
        return 1.0;
    } else {
        return lerp(1.0, 0.0, (t - 0.6) / 0.4);
    }
}

let pipWindow = null;
let isPlaying = false;
let originalVideoParent = null;
let originalVideoNextSibling = null;
let activeVideoElement = null;
let isMvMode = false;

function moveVideoToPip() {
    if (!pipWindow || pipWindow.closed) return false;
    const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (!video) return false;

    const videoContainer = pipWindow.document.getElementById('video-container');
    const coverImg = pipWindow.document.getElementById('cover');
    const noCover = pipWindow.document.getElementById('noCover');
    const wrapper = pipWindow.document.querySelector('.cover-wrapper');
    if (!videoContainer) return false;

    if (!originalVideoParent && video.parentNode) {
        originalVideoParent = video.parentNode;
        originalVideoNextSibling = video.nextSibling;
    }

    activeVideoElement = video;
    videoContainer.appendChild(video);
    videoContainer.classList.remove('hide');
    if (coverImg) coverImg.classList.add('hide');
    if (noCover) noCover.classList.add('hide');
    if (wrapper) wrapper.classList.add('mv-mode');

    isMvMode = true;
    if (typeof updateCoverSize === 'function') updateCoverSize();
    if (currentSongInfo.title && currentSongInfo.artist) {
        currentLyricsSongKey = '';
        fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);
    }
    return true;
}

function restoreVideoToMain() {
    if (activeVideoElement && originalVideoParent) {
        try {
            if (originalVideoNextSibling && originalVideoParent.contains(originalVideoNextSibling)) {
                originalVideoParent.insertBefore(activeVideoElement, originalVideoNextSibling);
            } else {
                originalVideoParent.appendChild(activeVideoElement);
            }
        } catch (e) {
            console.warn('Error restoring video element:', e);
        }
    }

    if (pipWindow && !pipWindow.closed) {
        const videoContainer = pipWindow.document.getElementById('video-container');
        const coverImg = pipWindow.document.getElementById('cover');
        const noCover = pipWindow.document.getElementById('noCover');
        const wrapper = pipWindow.document.querySelector('.cover-wrapper');
        if (videoContainer) videoContainer.classList.add('hide');
        if (wrapper) wrapper.classList.remove('mv-mode');
        if (coverImg && currentSongInfo.coverUrl) coverImg.classList.remove('hide');
        else if (noCover) noCover.classList.remove('hide');
    }

    activeVideoElement = null;
    originalVideoParent = null;
    originalVideoNextSibling = null;
    isMvMode = false;
    if (typeof updateCoverSize === 'function') updateCoverSize();
    if (currentSongInfo.title && currentSongInfo.artist) {
        currentLyricsSongKey = '';
        fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);
    }
}

let currentSongInfo = {
    title: "Lyra Player",
    artist: "Select a song to start",
    album: "",
    coverUrl: "",
    duration: 0,
    currentTime: 0,
    volume: 100
};
let repeatMode = 0;
let shuffle = false;

let titleHtml = null;
let artistHtml = null;
let coverHtml = null;
let bgCoverHtml = null;
let placeHolderHtml = null;
let track = null;
let shuffleHtml = null;
let repeatBtn = null;
let repeatHtml = null;
let repeatOnceHtml = null;
let volumeSlider = null;
let volumeSliderPopup = null;
let isDraggingProgress = false;

let customMuteBtn = null;
let customLikeBtn = null;
let customDislikeBtn = null;
let customRewindBtn = null;
let customForwardBtn = null;
let customSpeedBtn = null;
let customSpeedText = null;
let customRadioBtn = null;
let customSearchBtn = null;
let isSearchViewOpen = false;
let openedFromSearch = false;
let isMuted = false;
const defaultButtons = ['playlist', 'queue', 'prev', 'play', 'next', 'lyrics', 'search'];
let customControlsPriority = [...defaultButtons];
let bgBrightnessVal = 120;
let bgBlurVal = 90;
let bgSpeedFactor = 1.5;
let updateCoverSizeFn = null;

function updatePipContent() {
    if (!pipWindow) return;

    const content = pipWindow.document.getElementById('pip-content');
    if (!content) return;
    if (!titleHtml || !artistHtml || !coverHtml || !track || !placeHolderHtml) {
        setup().then(r => {
            extractSongInfo().then(r => {
                setValues();
            });
        })
    } else {
        extractSongInfo().then(r => {
            setValues();
        });
    }
}

function setValues() {
    const newTitle = currentSongInfo.title == null || currentSongInfo.title === "" ? "Lyra Player" : currentSongInfo.title;
    const newArtist = currentSongInfo.artist == null || currentSongInfo.artist.trim().replace(/(\r\n|\n|\r)/gm, "") === "" ? "Select a song to start" : currentSongInfo.artist;

    if (titleHtml && titleHtml.textContent !== newTitle) {
        titleHtml.textContent = newTitle;
    }
    if (artistHtml && artistHtml.textContent !== newArtist) {
        artistHtml.textContent = newArtist;
    }

    const fastUrl = currentSongInfo.fastUrl || currentSongInfo.coverUrl;
    if (fastUrl) {
        if (coverHtml.src !== fastUrl && coverHtml.src !== currentSongInfo.highResUrl) {
            coverHtml.src = fastUrl;
        }
        if (pipWindow && !pipWindow.closed) {
            const bgImages = pipWindow.document.querySelectorAll('#ambient-bg img');
            bgImages.forEach(img => {
                if (img.src !== fastUrl && img.src !== currentSongInfo.highResUrl) {
                    img.src = fastUrl;
                }
            });
        }
    }

    if (currentSongInfo.highResUrl && currentSongInfo.preloadingUrl !== currentSongInfo.highResUrl) {
        const hdTarget = currentSongInfo.highResUrl;
        currentSongInfo.preloadingUrl = hdTarget;
        const imgPreloader = new Image();
        imgPreloader.onload = () => {
            if (pipWindow && !pipWindow.closed && currentSongInfo.highResUrl === hdTarget) {
                coverHtml.src = hdTarget;
                const bgImages = pipWindow.document.querySelectorAll('#ambient-bg img');
                bgImages.forEach(img => {
                    img.src = hdTarget;
                });
            }
        };
        imgPreloader.onerror = () => {

            if (hdTarget.includes('maxresdefault.jpg')) {
                const fallbackHd = hdTarget.replace('maxresdefault.jpg', 'hqdefault.jpg');
                currentSongInfo.highResUrl = fallbackHd;
                if (coverHtml.src !== fallbackHd) coverHtml.src = fallbackHd;
            }
        };
        imgPreloader.src = hdTarget;
    }

    if (coverHtml.src === "https://music.youtube.com/" || coverHtml.src == null || coverHtml.src === "") {
        placeHolderHtml.classList.remove('hide');
        coverHtml.classList.add('hide');
        if (pipWindow && !pipWindow.closed) {
            const bgContainer = pipWindow.document.getElementById('ambient-bg');
            if (bgContainer) bgContainer.classList.add('hide');
        }
    } else {
        placeHolderHtml.classList.add('hide');
        coverHtml.classList.remove('hide');
        if (pipWindow && !pipWindow.closed) {
            const bgContainer = pipWindow.document.getElementById('ambient-bg');
            if (bgContainer) bgContainer.classList.remove('hide');
        }
    }
    if (isPlaying) {
        pipWindow.document.getElementById('play').classList.add('hide');
        pipWindow.document.getElementById('pause').classList.remove('hide');
    } else {
        pipWindow.document.getElementById('play').classList.remove('hide');
        pipWindow.document.getElementById('pause').classList.add('hide');
    }

    if (!isDraggingProgress) {
        if (currentSongInfo.duration > 0) {
            const progress = (currentSongInfo.currentTime / currentSongInfo.duration) * 100;
            track.style.width = `${progress}%`;
        } else {
            track.style.width = '0%';
        }
    }

    if (shuffleHtml) {
        if (!shuffle) {
            shuffleHtml.classList.remove('active');
        } else {
            shuffleHtml.classList.add('active');
        }
    }

    if (repeatMode === 0) {
        if (repeatBtn) repeatBtn.classList.remove('active');
        if (repeatHtml) repeatHtml.classList.remove('hide');
        if (repeatOnceHtml) repeatOnceHtml.classList.add('hide');
    } else if (repeatMode === 1) {
        if (repeatBtn) repeatBtn.classList.add('active');
        if (repeatHtml) repeatHtml.classList.remove('hide');
        if (repeatOnceHtml) repeatOnceHtml.classList.add('hide');
    } else if (repeatMode === 2) {
        if (repeatBtn) repeatBtn.classList.add('active');
        if (repeatHtml) repeatHtml.classList.add('hide');
        if (repeatOnceHtml) repeatOnceHtml.classList.remove('hide');
    }

    if (customMuteBtn) {
        const unmutedSvg = customMuteBtn.querySelector('.unmuted');
        const mutedSvg = customMuteBtn.querySelector('.muted');
        if (isMuted) {
            customMuteBtn.classList.add('active');
            if (unmutedSvg) unmutedSvg.classList.add('hide');
            if (mutedSvg) mutedSvg.classList.remove('hide');
        } else {
            customMuteBtn.classList.remove('active');
            if (unmutedSvg) unmutedSvg.classList.remove('hide');
            if (mutedSvg) mutedSvg.classList.add('hide');
        }
    }

    if (customLikeBtn) {
        const likeStatus = document.querySelector('ytmusic-like-button-renderer');
        const status = likeStatus ? likeStatus.getAttribute('like-status') : 'INDIFFERENT';
        if (status === 'LIKE') {
            customLikeBtn.classList.add('active');
        } else {
            customLikeBtn.classList.remove('active');
        }
    }

    if (customDislikeBtn) {
        const likeStatus = document.querySelector('ytmusic-like-button-renderer');
        const status = likeStatus ? likeStatus.getAttribute('like-status') : 'INDIFFERENT';
        if (status === 'DISLIKE') {
            customDislikeBtn.classList.add('active');
        } else {
            customDislikeBtn.classList.remove('active');
        }
    }

    if (volumeSlider) {
        volumeSlider.value = currentSongInfo.volume;
    }

    if (volumeSliderPopup) {
        volumeSliderPopup.value = currentSongInfo.volume;
    }

    if (currentSongInfo.title && currentSongInfo.artist) {
        const key = `${currentSongInfo.title}-${currentSongInfo.artist}`;
        const songChanged = lastKnownSongKey && lastKnownSongKey !== key;

        if (isLyricsViewOpen && songChanged) {
            fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);
        }

        lastKnownSongKey = key;
    }

    if (isQueueViewOpen) {
        updateQueueActiveHighlight();
    }
    syncQueueObserverState();
}

let queueMutationObserver = null;

function syncQueueObserverState() {
    if (isQueueViewOpen && pipWindow && !pipWindow.closed) {
        if (!queueMutationObserver) {
            const queueScope = document.querySelector("ytmusic-player-queue #items") || document.querySelector("ytmusic-player-queue");
            if (queueScope) {
                let debounceTimer = null;
                queueMutationObserver = new MutationObserver(() => {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        if (isQueueViewOpen) renderQueuePanel();
                    }, 250);
                });
                queueMutationObserver.observe(queueScope, { childList: true });
            }
        }
    } else {
        if (queueMutationObserver) {
            queueMutationObserver.disconnect();
            queueMutationObserver = null;
        }
    }
}

async function updateQueueActiveHighlight() {
    if (!pipWindow || pipWindow.closed) return;
    const queueList = pipWindow.document.getElementById('queue-list');
    if (!queueList) return;

    const queue = await getQueueWithThumbs();
    const items = queueList.querySelectorAll('.panel-item');

    let mismatch = false;
    if (queue.length !== items.length) {
        mismatch = true;
    } else {
        for (let i = 0; i < queue.length; i++) {
            const renderedTitle = items[i]?.querySelector('.panel-item-title')?.textContent?.trim();
            if (queue[i]?.title && renderedTitle && queue[i].title.trim() !== renderedTitle) {
                mismatch = true;
                break;
            }
        }
    }

    if (mismatch) {
        renderQueuePanel();
        return;
    }

    if (!items.length) return;

    const domQueueItems = [...document.querySelectorAll("ytmusic-player-queue-item")].filter(
        (row) => !row.closest("#counterpart-renderer")
    );

    let activeIndex = -1;

    if (domQueueItems.length) {
        activeIndex = domQueueItems.findIndex(item =>
            item.hasAttribute("selected") ||
            item.hasAttribute("playing") ||
            item.getAttribute("play-button-state") === "playing"
        );
    }

    if (activeIndex === -1 && currentSongInfo.title) {
        const curTitle = currentSongInfo.title.trim().toLowerCase();
        items.forEach((itemEl, idx) => {
            const titleEl = itemEl.querySelector('.panel-item-title');
            if (titleEl && titleEl.textContent.trim().toLowerCase() === curTitle) {
                activeIndex = idx;
            }
        });
    }

    items.forEach((itemEl, idx) => {
        const artistEl = itemEl.querySelector('.panel-item-artist');
        const origArtist = queue[idx]?.artist || 'Artist';
        if (idx === activeIndex) {
            itemEl.classList.add('selected');
            if (artistEl) artistEl.textContent = 'Now playing';
        } else {
            itemEl.classList.remove('selected');
            if (artistEl) artistEl.textContent = origArtist;
        }
    });
}

let isUserScrollingLyrics = false;
let userScrollTimeout = null;
let currentScrollAnimFrame = null;

function scrollToCenter(container, element) {
    if (!container || !element) return;

    if (isUserScrollingLyrics) return;

    const containerHeight = container.clientHeight || container.offsetHeight || 300;
    const elementHeight = element.clientHeight || element.offsetHeight || 40;
    const targetScrollTop = element.offsetTop - (containerHeight / 2) + (elementHeight / 2);

    container.scrollTop = targetScrollTop;
}

function attachLyricsUserScrollListener(container) {
    if (!container || container._userScrollAttached) return;
    container._userScrollAttached = true;

    const handleUserScroll = () => {
        isUserScrollingLyrics = true;
        if (userScrollTimeout) clearTimeout(userScrollTimeout);
        
        userScrollTimeout = setTimeout(() => {
            isUserScrollingLyrics = false;
        }, 3500);
    };

    container.addEventListener('wheel', handleUserScroll, { passive: true });
    container.addEventListener('touchstart', handleUserScroll, { passive: true });
}

function triggerFastRefresh() {
    const delays = [50, 150, 300, 500, 800, 1200, 2000];
    delays.forEach(delay => {
        setTimeout(() => {
            if (pipWindow && !pipWindow.closed) {
                extractSongInfo().then(() => {
                    updatePipContent();
                });
            }
        }, delay);
    });
}

async function setup() {

    titleHtml = titleHtml == null ? pipWindow.document.getElementById('title') : titleHtml;
    artistHtml = artistHtml == null ? pipWindow.document.getElementById('artist') : artistHtml;
    coverHtml = coverHtml == null ? pipWindow.document.getElementById('cover') : coverHtml;
    bgCoverHtml = bgCoverHtml == null ? pipWindow.document.getElementById('bg-cover') : bgCoverHtml;
    placeHolderHtml = placeHolderHtml == null ? pipWindow.document.getElementById('noCover') : placeHolderHtml;
    track = track == null ? pipWindow.document.getElementById('track') : track;
    repeatHtml = repeatHtml == null ? pipWindow.document.querySelector('.repeat') : repeatHtml;
    repeatOnceHtml = repeatOnceHtml == null ? pipWindow.document.querySelector('.repeatOnce') : repeatOnceHtml;
    repeatBtn = repeatBtn == null ? pipWindow.document.querySelector('.repeat-btn') : repeatBtn;
    shuffleHtml = shuffleHtml == null ? (pipWindow.document.getElementById('shuffle-btn') || pipWindow.document.querySelector('.shuffle')) : shuffleHtml;
    volumeSlider = volumeSlider == null ? pipWindow.document.getElementById('volume-slider') : volumeSlider;
    volumeSliderPopup = volumeSliderPopup == null ? pipWindow.document.getElementById('volume-slider-popup') : volumeSliderPopup;

    customMuteBtn = customMuteBtn == null ? pipWindow.document.getElementById('mute-btn') : customMuteBtn;
    customLikeBtn = customLikeBtn == null ? pipWindow.document.getElementById('like-btn') : customLikeBtn;
    customDislikeBtn = customDislikeBtn == null ? pipWindow.document.getElementById('dislike-btn') : customDislikeBtn;
    customRewindBtn = customRewindBtn == null ? pipWindow.document.getElementById('rewind-btn') : customRewindBtn;
    customForwardBtn = customForwardBtn == null ? pipWindow.document.getElementById('forward-btn') : customForwardBtn;
    customSpeedBtn = customSpeedBtn == null ? pipWindow.document.getElementById('speed-btn') : customSpeedBtn;
    customSpeedText = customSpeedText == null ? pipWindow.document.getElementById('speed-text') : customSpeedText;
    customRadioBtn = customRadioBtn == null ? pipWindow.document.getElementById('radio-btn') : customRadioBtn;
    customSearchBtn = customSearchBtn == null ? pipWindow.document.getElementById('search-toggle-btn') : customSearchBtn;

    const playPauseBtn = pipWindow.document.getElementById('playPause-btn');
    const previousBtn = pipWindow.document.getElementById('prev-btn');
    const nextBtn = pipWindow.document.getElementById('next-btn');

    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', () => {
            const ytPlayPauseBtn = document.querySelector('.play-pause-button.style-scope.ytmusic-player-bar');
            if (ytPlayPauseBtn) {
                ytPlayPauseBtn.click();
                triggerFastRefresh();
            }
        });
    }

    if (previousBtn) {
        previousBtn.addEventListener('click', () => {
            const ytPreviousBtn = document.querySelector('.previous-button.style-scope.ytmusic-player-bar');
            if (ytPreviousBtn) {
                ytPreviousBtn.click();
                triggerFastRefresh();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const ytNextBtn = document.querySelector('.next-button.style-scope.ytmusic-player-bar');
            if (ytNextBtn) {
                ytNextBtn.click();
                triggerFastRefresh();
            }
        });
    }

    if (repeatBtn) {
        repeatBtn.addEventListener('click', () => {
            const ytRepeatBtn = document.querySelector('.repeat.style-scope.ytmusic-player-bar');
            if (ytRepeatBtn) {
                ytRepeatBtn.click();
            }
        });
    }

    if (shuffleHtml) {
        shuffleHtml.addEventListener('click', () => {
            const bar = document.querySelector('ytmusic-player-bar');
            let ytShuffleBtn = bar?.querySelector('.shuffle');
            if (!ytShuffleBtn && bar) {
                for (const btn of bar.querySelectorAll('button, tp-yt-paper-icon-button')) {
                    const label = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
                    if (/shuffle/i.test(label)) {
                        ytShuffleBtn = btn;
                        break;
                    }
                }
            }
            if (ytShuffleBtn) {
                const targetBtn = ytShuffleBtn.querySelector('button') || ytShuffleBtn;
                targetBtn.click();
            }

            const queueContainerEl = pipWindow?.document?.getElementById('queue-container');
            const queueToggleBtnEl = pipWindow?.document?.getElementById('queue-toggle-btn');
            const rootEl = pipWindow?.document?.getElementById('mini-player-root');

            if (queueContainerEl) {
                isQueueViewOpen = true;
                closeAllPanelsExcept('queue');
                queueContainerEl.classList.remove('hide');
                if (rootEl) rootEl.classList.add('queue-mode');
                if (queueToggleBtnEl) queueToggleBtnEl.classList.add('active');
                adjustPipWindowHeight(true);
                renderQueuePanel(true);
                setTimeout(() => {
                    renderQueuePanel(true);
                }, 300);
            }
        });
    }

    if (customMuteBtn) {
        customMuteBtn.addEventListener('click', () => {
            const videoElement = document.querySelector('video');
            if (videoElement) {
                videoElement.muted = !videoElement.muted;
                isMuted = videoElement.muted;
                updatePipContent();
            }
        });
    }

    if (customLikeBtn) {
        customLikeBtn.addEventListener('click', () => {
            const ytLikeBtn = document.querySelector('ytmusic-like-button-renderer[id="like-button-renderer"] #button-shape-like button') || document.querySelector('#button-shape-like button');
            if (ytLikeBtn) {
                ytLikeBtn.click();
                triggerFastRefresh();
            }
        });
    }

    if (customDislikeBtn) {
        customDislikeBtn.addEventListener('click', () => {
            const ytDislikeBtn = document.querySelector('ytmusic-like-button-renderer[id="like-button-renderer"] #button-shape-dislike button') || document.querySelector('#button-shape-dislike button');
            if (ytDislikeBtn) {
                ytDislikeBtn.click();
                triggerFastRefresh();
            }
        });
    }

    if (customRewindBtn) {
        customRewindBtn.addEventListener('click', () => {
            const videoElement = document.querySelector('video');
            if (videoElement) {
                videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
                triggerFastRefresh();
            }
        });
    }

    if (customForwardBtn) {
        customForwardBtn.addEventListener('click', () => {
            const videoElement = document.querySelector('video');
            if (videoElement) {
                videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 10);
                triggerFastRefresh();
            }
        });
    }

    if (customRadioBtn) {
        customRadioBtn.addEventListener('click', () => {
            startRadio();
        });
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const loadCustomControls = (resultControls) => {
            if (resultControls && Array.isArray(resultControls)) {
                customControlsPriority = [null, null, null, null, null, null, null];
                resultControls.forEach((btn, idx) => {
                    if (idx < 7) customControlsPriority[idx] = btn;
                });
            } else {
                customControlsPriority = [...defaultButtons];
            }
            if (pipWindow && !pipWindow.closed) {
                const root = pipWindow.document.getElementById('mini-player-root');
                const controlsContainer = root?.querySelector('.controls');
                if (controlsContainer) {
                    controlsContainer._lastRenderedKeys = null;
                }
                if (typeof updateCoverSizeFn === 'function') {
                    updateCoverSizeFn();
                }
            }
        };

        const clampBrightness = (v) => {
            const num = parseInt(v, 10);
            return isNaN(num) ? 120 : Math.max(20, Math.min(150, num));
        };

        const clampBlur = (v) => {
            const num = parseInt(v, 10);
            return isNaN(num) ? 90 : Math.max(70, Math.min(150, num));
        };

        const clampSpeed = (v) => {
            const num = parseFloat(v);
            return isNaN(num) ? 1.5 : Math.max(0.0, Math.min(3.0, num));
        };

        chrome.storage.local.get(['customControls', 'bgBrightness', 'bgBlur', 'bgSpeed', 'lyricsMode'], (result) => {
            loadCustomControls(result?.customControls);
            if (result?.bgBrightness !== undefined) bgBrightnessVal = clampBrightness(result.bgBrightness);
            if (result?.bgBlur !== undefined) bgBlurVal = clampBlur(result.bgBlur);
            if (result?.bgSpeed !== undefined) bgSpeedFactor = clampSpeed(result.bgSpeed);
            if (result?.lyricsMode !== undefined) currentLyricsDisplayMode = result.lyricsMode;
            applyLyricsModeToDom();
            if (pipWindow && !pipWindow.closed && typeof updateCoverSizeFn === 'function') {
                updateCoverSizeFn();
            }
        });

        if (chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local') {
                    if (changes.customControls) {
                        loadCustomControls(changes.customControls.newValue);
                    }
                    if (changes.bgBrightness) {
                        bgBrightnessVal = clampBrightness(changes.bgBrightness.newValue);
                    }
                    if (changes.bgBlur) {
                        bgBlurVal = clampBlur(changes.bgBlur.newValue);
                    }
                    if (changes.bgSpeed) {
                        bgSpeedFactor = clampSpeed(changes.bgSpeed.newValue);
                    }
                    if (changes.lyricsMode) {
                        currentLyricsDisplayMode = changes.lyricsMode.newValue || 'both';
                        applyLyricsModeToDom();
                    }
                    if ((changes.bgBrightness || changes.bgBlur || changes.bgSpeed) && pipWindow && !pipWindow.closed && typeof updateCoverSizeFn === 'function') {
                        updateCoverSizeFn();
                    }
                }
            });
        }
    }

    const mvToggleBtn = pipWindow.document.getElementById('mv-toggle-btn');
    if (mvToggleBtn) {
        if (isMvMode) mvToggleBtn.classList.add('active');
        mvToggleBtn.addEventListener('click', () => {
            if (isMvMode) {
                restoreVideoToMain();
                mvToggleBtn.classList.remove('active');
            } else {
                const success = moveVideoToPip();
                if (success) {
                    mvToggleBtn.classList.add('active');
                } else {
                    triggerShake(mvToggleBtn);
                }
            }
        });
    }

    const addToPlaylistBtn = pipWindow.document.getElementById('addToPlaylist-btn') || pipWindow.document.getElementById('add-to-playlist');
    const queueToggleBtn = pipWindow.document.getElementById('queue-toggle-btn');
    const queueContainer = pipWindow.document.getElementById('queue-container');
    const playlistToggleBtn = pipWindow.document.getElementById('playlist-toggle-btn');
    const playlistContainer = pipWindow.document.getElementById('playlist-container');
    const miniPlayerRoot = pipWindow.document.getElementById('mini-player-root');

    function closeAllPanelsExcept(target) {
        if (target !== 'lyrics' && isLyricsViewOpen) {
            isLyricsViewOpen = false;
            const lyricsContainer = pipWindow.document.getElementById('lyrics-container');
            const lyricsToggleBtn = pipWindow.document.getElementById('lyrics-toggle-btn');
            if (lyricsContainer) lyricsContainer.classList.add('hide');
            if (miniPlayerRoot) miniPlayerRoot.classList.remove('lyrics-mode');
            if (lyricsToggleBtn) lyricsToggleBtn.classList.remove('active');
            if (animFrameId && pipWindow) {
                pipWindow.cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
        }
        if (target !== 'queue' && isQueueViewOpen) {
            isQueueViewOpen = false;
            if (queueContainer) queueContainer.classList.add('hide');
            if (miniPlayerRoot) miniPlayerRoot.classList.remove('queue-mode');
            if (queueToggleBtn) queueToggleBtn.classList.remove('active');
        }
        if (target !== 'playlist' && isPlaylistViewOpen) {
            isPlaylistViewOpen = false;
            isAddToPlaylistMode = false;
            if (playlistContainer) playlistContainer.classList.add('hide');
            if (miniPlayerRoot) miniPlayerRoot.classList.remove('playlist-mode');
            if (playlistToggleBtn) playlistToggleBtn.classList.remove('active');
        }
        if (target !== 'search' && isSearchViewOpen) {
            isSearchViewOpen = false;
            const sContainer = pipWindow?.document?.getElementById('search-container');
            const sToggleBtn = pipWindow?.document?.getElementById('search-toggle-btn');
            if (sContainer) sContainer.classList.add('hide');
            if (miniPlayerRoot) miniPlayerRoot.classList.remove('search-mode');
            if (sToggleBtn) sToggleBtn.classList.remove('active');
        }
    }

    if (queueToggleBtn && queueContainer) {
        queueToggleBtn.addEventListener('click', () => {
            isQueueViewOpen = !isQueueViewOpen;
            if (isQueueViewOpen) {
                closeAllPanelsExcept('queue');
                queueContainer.classList.remove('hide');
                if (miniPlayerRoot) miniPlayerRoot.classList.add('queue-mode');
                queueToggleBtn.classList.add('active');
                adjustPipWindowHeight(true);
                renderQueuePanel(true);
            } else {
                queueContainer.classList.add('hide');
                if (miniPlayerRoot) miniPlayerRoot.classList.remove('queue-mode');
                queueToggleBtn.classList.remove('active');
                adjustPipWindowHeight(false);
            }
        });
    }

    const queueBackBtn = pipWindow.document.getElementById('queue-back-btn');
    if (queueBackBtn && queueContainer) {
        queueBackBtn.addEventListener('click', () => {
            if (isQueueViewOpen) {
                if (openedFromSearch) {
                    openedFromSearch = false;
                    toggleSearchPanel(true);
                } else {
                    isQueueViewOpen = false;
                    queueContainer.classList.add('hide');
                    if (miniPlayerRoot) miniPlayerRoot.classList.remove('queue-mode');
                    if (queueToggleBtn) queueToggleBtn.classList.remove('active');
                    adjustPipWindowHeight(false);
                }
            }
        });
    }

    const playlistBackBtn = pipWindow.document.getElementById('playlist-back-btn');

    if (playlistToggleBtn && playlistContainer) {
        playlistToggleBtn.addEventListener('click', () => {
            togglePlaylistPanel();
        });
    }

    if (addToPlaylistBtn && playlistContainer) {
        addToPlaylistBtn.addEventListener('click', () => {
            togglePlaylistPanel(undefined, true);
        });
    }

    if (playlistBackBtn && playlistContainer) {
        playlistBackBtn.addEventListener('click', () => {
            if (isPlaylistViewOpen) {
                togglePlaylistPanel(false);
            }
        });
    }

    const searchContainer = pipWindow.document.getElementById('search-container');
    const searchToggleBtn = pipWindow.document.getElementById('search-toggle-btn');
    const searchBackBtn = pipWindow.document.getElementById('search-back-btn');
    const searchInput = pipWindow.document.getElementById('search-input');
    const searchList = pipWindow.document.getElementById('search-list');
    const searchStatus = pipWindow.document.getElementById('search-status');
    const searchSpinner = pipWindow.document.getElementById('search-spinner');

    let searchDebounceTimer = null;

    function toggleSearchPanel(forceOpen) {
        if (!searchContainer) return;
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isSearchViewOpen;
        isSearchViewOpen = shouldOpen;
        if (isSearchViewOpen) {
            closeAllPanelsExcept('search');
            if (searchList) {
                searchList.querySelectorAll('.panel-item.loading').forEach(el => el.classList.remove('loading'));
            }
            searchContainer.classList.remove('hide');
            if (miniPlayerRoot) miniPlayerRoot.classList.add('search-mode');
            if (searchToggleBtn) searchToggleBtn.classList.add('active');
            adjustPipWindowHeight(true);
            if (searchInput) searchInput.focus();
        } else {
            searchContainer.classList.add('hide');
            if (miniPlayerRoot) miniPlayerRoot.classList.remove('search-mode');
            if (searchToggleBtn) searchToggleBtn.classList.remove('active');
            adjustPipWindowHeight(false);
        }
    }

    if (searchToggleBtn && searchContainer) {
        searchToggleBtn.addEventListener('click', () => {
            toggleSearchPanel();
        });
    }

    if (searchBackBtn && searchContainer) {
        searchBackBtn.addEventListener('click', () => {
            if (isSearchViewOpen) {
                toggleSearchPanel(false);
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            const query = searchInput.value.trim();
            if (!query) {
                if (searchList) searchList.innerHTML = '';
                if (searchStatus) searchStatus.classList.add('hide');
                if (searchSpinner) searchSpinner.classList.add('hide');
                return;
            }

            if (searchStatus) searchStatus.classList.add('hide');
            if (searchSpinner) searchSpinner.classList.remove('hide');

            searchDebounceTimer = setTimeout(async () => {
                injectMiniplayerScript();
                const results = await askMiniplayerAsync("search", { query }, 8000);
                if (searchSpinner) searchSpinner.classList.add('hide');
                if (!searchList) return;
                searchList.innerHTML = '';

                if (!Array.isArray(results) || !results.length) {
                    if (searchStatus) {
                        searchStatus.textContent = 'No results found';
                        searchStatus.classList.remove('hide');
                    }
                    return;
                }

                if (searchStatus) searchStatus.classList.add('hide');

                const currentVid = getCurrentVideoId();
                results.forEach((item) => {
                    const isCurrentPlaying = (item.videoId && currentVid && currentVid === item.videoId);
                    const div = pipWindow.document.createElement('div');
                    div.className = `panel-item ${isCurrentPlaying ? 'selected' : ''}`;
                    const thumbUrl = item.thumb || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` : 'icons/icon48.png');
                    div.innerHTML = `
                        <img class="panel-item-thumb" src="${thumbUrl}" alt="thumb" onerror="this.onerror=null;this.src='icons/icon48.png';" />
                        <div class="panel-item-info">
                            <span class="panel-item-title">${item.title}</span>
                            <span class="panel-item-artist">${isCurrentPlaying ? 'Now playing' : (item.artist || 'Artist')}</span>
                        </div>
                        ${item.duration ? `<span class="panel-item-duration">${item.duration}</span>` : ''}
                        <button class="panel-item-action-btn" title="Start radio">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M16.247 7.761a6 6 0 0 1 0 8.478"></path>
                                <path d="M19.075 4.933a10 10 0 0 1 0 14.134"></path>
                                <path d="M4.925 19.067a10 10 0 0 1 0-14.134"></path>
                                <path d="M7.753 16.239a6 6 0 0 1 0-8.478"></path>
                                <circle cx="12" cy="12" r="2"></circle>
                            </svg>
                        </button>
                    `;

                    const artistSpan = div.querySelector('.panel-item-artist');
                    if (artistSpan) artistSpan._originalArtist = item.artist || 'Artist';

                    const actionBtn = div.querySelector('.panel-item-action-btn');
                    if (actionBtn) {
                        actionBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            openedFromSearch = true;
                            if (item.videoId) {
                                const app = document.querySelector('ytmusic-app');
                                if (app) {
                                    const endpoint = {
                                        watchEndpoint: {
                                            videoId: item.videoId,
                                            playlistId: 'RD' + item.videoId
                                        }
                                    };
                                    app.dispatchEvent(new CustomEvent('yt-navigate', {
                                        bubbles: true,
                                        composed: true,
                                        detail: { endpoint }
                                    }));
                                }
                            }
                            isQueueViewOpen = true;
                            closeAllPanelsExcept('queue');
                            const qContainer = pipWindow?.document?.getElementById('queue-container');
                            const qToggleBtn = pipWindow?.document?.getElementById('queue-toggle-btn');
                            const qStatus = pipWindow?.document?.getElementById('queue-status');
                            const rootEl = pipWindow?.document?.querySelector('.mini-player');
                            if (qContainer) qContainer.classList.remove('hide');
                            if (rootEl) rootEl.classList.add('queue-mode');
                            if (qToggleBtn) qToggleBtn.classList.add('active');
                            if (qStatus) {
                                qStatus.textContent = 'Loading queue...';
                                qStatus.classList.remove('hide');
                            }
                            adjustPipWindowHeight(true);
                            setTimeout(() => {
                                if (isQueueViewOpen) renderQueuePanel();
                            }, 400);
                        });
                    }

                    div.addEventListener('click', async () => {
                        if (searchList) {
                            searchList.querySelectorAll('.panel-item').forEach(el => {
                                el.classList.remove('selected');
                                const aEl = el.querySelector('.panel-item-artist');
                                if (aEl && aEl._originalArtist) {
                                    aEl.textContent = aEl._originalArtist;
                                }
                            });
                        }
                        div.classList.add('selected');
                        if (artistSpan) {
                            artistSpan.textContent = 'Now playing';
                        }
                        injectMiniplayerScript();
                        await askMiniplayerAsync("playVideo", { videoId: item.videoId });
                    });
                    searchList.appendChild(div);
                });
            }, 350);
        });
    }

    function togglePlaylistPanel(forceOpen, isAddMode) {
        if (!playlistContainer) return;
        
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !isPlaylistViewOpen;
        if (typeof isAddMode !== 'undefined') {
            isAddToPlaylistMode = isAddMode;
        }
        isPlaylistViewOpen = shouldOpen;
        if (isPlaylistViewOpen) {
            closeAllPanelsExcept('playlist');
            playlistContainer.classList.remove('hide');
            if (miniPlayerRoot) miniPlayerRoot.classList.add('playlist-mode');
            if (playlistToggleBtn) playlistToggleBtn.classList.add('active');
            adjustPipWindowHeight(true);
            renderPlaylistsList();
        } else {
            playlistContainer.classList.add('hide');
            if (miniPlayerRoot) miniPlayerRoot.classList.remove('playlist-mode');
            if (playlistToggleBtn) playlistToggleBtn.classList.remove('active');
            adjustPipWindowHeight(false);
        }
    }

    closePlaylistPanelFn = () => togglePlaylistPanel(false);

    async function renderQueuePanel() {
        syncQueueObserverState();
        const queueList = pipWindow.document.getElementById('queue-list');
        const queueCount = pipWindow.document.getElementById('queue-count');
        const queueStatus = pipWindow.document.getElementById('queue-status');
        if (!queueList) return;

        if (queueStatus) queueStatus.classList.add('hide');

        const queue = await getQueueWithThumbs();
        if (queueCount) queueCount.textContent = `${queue.length} tracks`;

        queueList.innerHTML = '';
        if (!queue.length) {
            if (queueStatus) {
                queueStatus.textContent = 'No tracks in queue';
                queueStatus.classList.remove('hide');
            }
            return;
        }

        queue.forEach((item) => {
            const div = pipWindow.document.createElement('div');
            div.className = `panel-item ${item.selected ? 'selected' : ''}`;
            const thumbUrl = item.thumb || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` : 'icons/icon48.png');
            div.innerHTML = `
                <img class="panel-item-thumb" src="${thumbUrl}" alt="thumb" onerror="this.onerror=null;this.src='icons/icon48.png';" />
                <div class="panel-item-info">
                    <span class="panel-item-title">${item.title}</span>
                    <span class="panel-item-artist">${item.selected ? 'Now playing' : item.artist}</span>
                </div>
                ${item.duration ? `<span class="panel-item-duration">${item.duration}</span>` : ''}
                <button class="panel-item-action-btn" title="Start radio">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16.247 7.761a6 6 0 0 1 0 8.478"></path>
                        <path d="M19.075 4.933a10 10 0 0 1 0 14.134"></path>
                        <path d="M4.925 19.067a10 10 0 0 1 0-14.134"></path>
                        <path d="M7.753 16.239a6 6 0 0 1 0-8.478"></path>
                        <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                </button>
            `;

            const playTrack = async () => {
                div.classList.add('loading');
                injectMiniplayerScript();
                await askMiniplayerAsync("playQueueIndex", { index: item.index });
                const isNearEnd = item.index >= (queue.length - 5);
                const delays = isNearEnd ? [300, 700, 1500, 2500] : [300, 800];
                delays.forEach(ms => setTimeout(() => {
                    if (isQueueViewOpen) renderQueuePanel();
                }, ms));
            };

            const actionBtn = div.querySelector('.panel-item-action-btn');
            if (actionBtn) {
                actionBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    div.classList.add('loading');
                    if (item.videoId) {
                        const app = document.querySelector('ytmusic-app');
                        if (app) {
                            const endpoint = {
                                watchEndpoint: {
                                    videoId: item.videoId,
                                    playlistId: 'RD' + item.videoId
                                }
                            };
                            app.dispatchEvent(new CustomEvent('yt-navigate', {
                                bubbles: true,
                                composed: true,
                                detail: { endpoint }
                            }));
                        }
                    }
                    const delays = [400, 1000, 1800];
                    delays.forEach(ms => setTimeout(() => {
                        if (isQueueViewOpen) renderQueuePanel();
                    }, ms));
                });
            }

            div.addEventListener('click', () => {
                playTrack();
            });
            queueList.appendChild(div);
        });

        const selectedEl = queueList.querySelector('.panel-item.selected');
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    async function renderPlaylistsList() {
        const playlistList = pipWindow.document.getElementById('playlist-list');
        const headerTitle = pipWindow.document.getElementById('playlist-header-title');
        const statusEl = pipWindow.document.getElementById('playlist-status');
        if (!playlistList) return;

        if (headerTitle) {
            headerTitle.textContent = isAddToPlaylistMode ? 'Save to Playlist' : 'Playlists';
        }
        if (statusEl) statusEl.classList.add('hide');

        const playlists = await fetchPlaylists();
        playlistList.innerHTML = '';

        if (!playlists || !playlists.length) {
            if (statusEl) {
                statusEl.textContent = 'No playlists found';
                statusEl.classList.remove('hide');
            }
            return;
        }
        if (statusEl) statusEl.classList.add('hide');

        playlists.forEach((pl) => {
            const div = pipWindow.document.createElement('div');
            div.className = 'panel-item';
            const cleanPlId = (pl.id || '').replace(/^VL/, '');
            const isLikedPlaylist = Boolean(pl.id && (pl.id.includes('LM') || pl.id === 'VLLM' || pl.id === 'LM'));

            const likeRenderer = document.querySelector('ytmusic-like-button-renderer');
            const isCurrentlyLiked = isLikedPlaylist && likeRenderer && likeRenderer.getAttribute('like-status') === 'LIKE';

            const isNowPlaying = !isAddToPlaylistMode && activePlayingPlaylistId && (activePlayingPlaylistId === cleanPlId || activePlayingPlaylistId === pl.id);
            const isPlayActive = isNowPlaying && activePlayingMode === 'play';
            const isShuffleActive = isNowPlaying && activePlayingMode === 'shuffle';

            if (isNowPlaying) {
                div.classList.add('selected');
            }

            div.innerHTML = `
                <div class="panel-item-thumb-wrapper">
                    <img class="panel-item-thumb" src="${pl.thumb || 'icons/icon48.png'}" alt="thumb" />
                    ${isAddToPlaylistMode ? `<div class="panel-item-plus-overlay"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>` : ''}
                </div>
                <div class="panel-item-info">
                    <span class="panel-item-title">${pl.title}</span>
                    ${isAddToPlaylistMode
                        ? (isCurrentlyLiked
                            ? `<span class="panel-item-status-tag duplicate" style="margin-top: 2px;">Liked</span>`
                            : `<span class="panel-item-artist">${pl.subtitle || 'Playlist'}</span>`)
                        : (isNowPlaying
                            ? `<span class="panel-item-status-tag added" style="margin-top: 2px;">Now playing</span>`
                            : `<span class="panel-item-artist">${pl.subtitle || 'Playlist'}</span>`)
                    }
                </div>
                ${!isAddToPlaylistMode ? `
                    <div class="panel-item-actions">
                        <button class="panel-action-btn shuffle-action-btn ${isShuffleActive ? 'active' : ''}" title="Shuffle playlist">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.45 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                            </svg>
                        </button>
                        <button class="panel-action-btn play-action-btn ${isPlayActive ? 'active' : ''}" title="Play playlist">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <polygon points="8,5 19,12 8,19"></polygon>
                            </svg>
                        </button>
                    </div>
                ` : ''}
            `;

            if (isAddToPlaylistMode) {
                div.addEventListener('click', async () => {
                    const infoContainer = div.querySelector('.panel-item-info');
                    const artistSpan = div.querySelector('.panel-item-artist');

                    div.classList.add('loading');
                    
                    let spinner = div.querySelector('.panel-item-spinner');
                    if (!spinner) {
                        spinner = pipWindow.document.createElement('div');
                        spinner.className = 'panel-item-spinner';
                        div.appendChild(spinner);
                    }

                    let res = "error";

                    if (isLikedPlaylist) {
                        const ytLikeBtn = document.querySelector('ytmusic-like-button-renderer[id="like-button-renderer"] #button-shape-like button') || document.querySelector('#button-shape-like button');
                        const likeRenderer = document.querySelector('ytmusic-like-button-renderer');
                        const currentStatus = likeRenderer ? likeRenderer.getAttribute('like-status') : 'INDIFFERENT';
                        
                        if (ytLikeBtn) {
                            ytLikeBtn.click();
                            triggerFastRefresh();
                        }
                        
                        if (currentStatus === 'LIKE') {
                            res = "unliked";
                        } else {
                            res = "liked";
                        }
                        await new Promise(r => setTimeout(r, 150));
                    } else {
                        const videoId = getCurrentVideoId();
                        if (videoId) {
                            res = await addToPlaylist(pl.id, videoId);
                        }
                    }

                    div.classList.remove('loading');
                    if (spinner) spinner.remove();

                    let statusTag = div.querySelector('.panel-item-status-tag');
                    if (!statusTag) {
                        statusTag = pipWindow.document.createElement('span');
                        statusTag.className = 'panel-item-status-tag';
                        if (artistSpan) {
                            artistSpan.style.display = 'none';
                        }
                        infoContainer.appendChild(statusTag);
                    }

                    if (res === 'liked') {
                        statusTag.className = 'panel-item-status-tag added';
                        statusTag.textContent = 'Liked';
                    } else if (res === 'unliked') {
                        statusTag.className = 'panel-item-status-tag duplicate';
                        statusTag.textContent = 'Unliked';
                    } else if (res === 'added') {
                        statusTag.className = 'panel-item-status-tag added';
                        statusTag.textContent = 'Added to playlist';
                    } else if (res === 'duplicate') {
                        statusTag.className = 'panel-item-status-tag duplicate';
                        statusTag.textContent = 'Already in playlist';
                    } else {
                        statusTag.className = 'panel-item-status-tag error';
                        statusTag.textContent = 'Cannot add';
                    }
                });
            } else {
                
                const playBtn = div.querySelector('.play-action-btn');
                const shuffleBtn = div.querySelector('.shuffle-action-btn');

                const playPlaylist = (isShuffle = false) => {
                    activePlayingPlaylistId = cleanPlId || pl.id;
                    activePlayingMode = isShuffle ? 'shuffle' : 'play';

                    renderPlaylistsList();

                    const app = document.querySelector('ytmusic-app');
                    if (app) {
                        const endpoint = {
                            watchPlaylistEndpoint: {
                                playlistId: cleanPlId,
                                ...(isShuffle ? { params: 'wAEB' } : {})
                            }
                        };
                        app.dispatchEvent(new CustomEvent('yt-navigate', {
                            bubbles: true,
                            composed: true,
                            detail: { endpoint }
                        }));
                    }
                };

                if (playBtn) {
                    playBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        playPlaylist(false);
                    });
                }

                if (shuffleBtn) {
                    shuffleBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        playPlaylist(true);
                    });
                }

                div.addEventListener('click', () => {
                    playPlaylist(false);
                });
            }
            playlistList.appendChild(div);
        });
    }

    const progressContainer = pipWindow.document.querySelector('.progress-container');
    if (progressContainer) {
        let currentDragPercentage = 0;

        const updateTrackVisual = (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            if (width <= 0) return 0;

            const percentage = Math.max(0, Math.min(1, clickX / width));
            if (track) {
                track.style.width = (percentage * 100) + '%';
            }
            return percentage;
        };

        const commitSeek = (percentage) => {
            const videoElement = document.querySelector('video');
            if (!videoElement || !videoElement.duration) return;

            videoElement.currentTime = percentage * videoElement.duration;
            lastSyncedTime = videoElement.currentTime;
            lastSyncTimestamp = performance.now();
        };

        progressContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDraggingProgress = true;
            currentDragPercentage = updateTrackVisual(e);
        });

        pipWindow.addEventListener('mousemove', (e) => {
            if (isDraggingProgress) {
                currentDragPercentage = updateTrackVisual(e);
            }
        });

        const finishDrag = () => {
            if (isDraggingProgress) {
                isDraggingProgress = false;
                commitSeek(currentDragPercentage);
            }
        };

        pipWindow.addEventListener('mouseup', finishDrag);
        window.addEventListener('mouseup', finishDrag);

        progressContainer.addEventListener('click', (e) => {
            currentDragPercentage = updateTrackVisual(e);
            commitSeek(currentDragPercentage);
        });
    }

    function triggerShake(btn) {
        if (!btn) return;
        btn.classList.remove('shake');
        void btn.offsetWidth;
        btn.classList.add('shake');
        setTimeout(() => {
            btn.classList.remove('shake');
        }, 500);
    }

    const lyricsToggleBtn = pipWindow.document.getElementById('lyrics-toggle-btn');
    const lyricsContainer = pipWindow.document.getElementById('lyrics-container');
    if (lyricsToggleBtn && lyricsContainer && miniPlayerRoot) {
        lyricsToggleBtn.addEventListener('click', () => {
            isLyricsViewOpen = !isLyricsViewOpen;
            wasLyricsViewOpenBeforeShrinking = false;
            const cContainer = pipWindow?.document?.querySelector('.controls');
            if (cContainer) cContainer._lastRenderedKeys = null;

            if (isLyricsViewOpen) {
                closeAllPanelsExcept('lyrics');
                lyricsContainer.classList.remove('hide');
                miniPlayerRoot.classList.add('lyrics-mode');
                lyricsToggleBtn.classList.add('active');
                adjustPipWindowHeight(true);
                if (currentLyricsSongKey !== `${currentSongInfo.title}-${currentSongInfo.artist}`) {
                    fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);
                } else if (lyricsData && lyricsData.length > 0) {
                    renderLyricsList();
                } else {
                    currentLyricsSongKey = '';
                    fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);
                }
                startLyricsAnimLoop();
            } else {
                lyricsContainer.classList.add('hide');
                miniPlayerRoot.classList.remove('lyrics-mode');
                lyricsToggleBtn.classList.remove('active');
                adjustPipWindowHeight(false);
                if (animFrameId && pipWindow) {
                    pipWindow.cancelAnimationFrame(animFrameId);
                    animFrameId = null;
                }
            }
            setTimeout(() => updatePipContent(), 50);

            const _cc = pipWindow?.document?.querySelector('.controls');
            if (_cc) _cc._lastRenderedKeys = null;
            pipWindow.requestAnimationFrame(() => {
                if (typeof updateCoverSizeFn === 'function') updateCoverSizeFn();
            });
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', () => {
            updateYouTubeMusicVolume(volumeSlider.value);

            if (volumeSliderPopup) {
                volumeSliderPopup.value = volumeSlider.value;
            }
        });
    }

    if (volumeSliderPopup) {
        volumeSliderPopup.addEventListener('input', () => {
            updateYouTubeMusicVolume(volumeSliderPopup.value);

            if (volumeSlider) {
                volumeSlider.value = volumeSliderPopup.value;
            }
        });
    }

    function updateYouTubeMusicVolume(sliderValue) {
        const videoElement = document.querySelector('video');
        if (videoElement) {
            const volumeValue = sliderValue / 100;

            videoElement.volume = volumeValue;
            currentSongInfo.volume = Math.round(volumeValue * 100);

            const selectors = [
                '#volume-slider',
                '.volume-slider',
                'tp-yt-paper-slider#volume-slider',
                '.volume-slider.style-scope.ytmusic-player-bar',
                'ytmusic-player-bar .volume-slider'
            ];

            for (const selector of selectors) {
                const ytMusicVolumeSlider = document.querySelector(selector);
                if (ytMusicVolumeSlider) {
                    try {
                        ytMusicVolumeSlider.value = volumeValue;

                        const event = new Event('input', { bubbles: true });
                        ytMusicVolumeSlider.dispatchEvent(event);

                        const changeEvent = new Event('change', { bubbles: true });
                        ytMusicVolumeSlider.dispatchEvent(changeEvent);

                        break;
                    } catch (e) {
                        console.warn('Error updating YouTube Music volume slider:', e);
                    }
                }
            }

            try {
                if (window.ytmusic && window.ytmusic.player) {
                    window.ytmusic.player.setVolume(volumeValue * 100);
                }
            } catch (e) {
                console.warn('Error using YouTube Music API for volume:', e);
            }
        }
    }

}

function getHighResCoverUrl(src) {
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

async function extractSongInfo() {
    const titleElement = document.querySelector('.title.style-scope.ytmusic-player-bar');
    currentSongInfo.title = titleElement ? titleElement.textContent : 'Unknown Title';

    const artistElement = document.querySelector('.subtitle.style-scope.ytmusic-player-bar');
    currentSongInfo.artist = artistElement ? artistElement.textContent : 'Unknown Artist';

    let rawCoverUrl = null;
    if (navigator.mediaSession && navigator.mediaSession.metadata && navigator.mediaSession.metadata.artwork) {
        const artworkList = navigator.mediaSession.metadata.artwork;
        if (artworkList && artworkList.length > 0) {
            const lastArt = artworkList[artworkList.length - 1];
            if (lastArt && lastArt.src) {
                rawCoverUrl = lastArt.src;
            }
        }
    }

    if (!rawCoverUrl) {
        const coverSelectors = [
            'ytmusic-player-bar .image.style-scope.ytmusic-player-bar',
            'ytmusic-player-bar #thumbnail img',
            'ytmusic-player-bar yt-img-shadow img',
            '#song-image img',
            'img.ytmusic-player-bar'
        ];

        for (const selector of coverSelectors) {
            const el = document.querySelector(selector);
            if (el && el.src && !el.src.includes('data:image') && el.src !== 'https://music.youtube.com/') {
                rawCoverUrl = el.src;
                break;
            }
        }
    }

    currentSongInfo.fastUrl = rawCoverUrl;
    currentSongInfo.highResUrl = getHighResCoverUrl(rawCoverUrl);
    currentSongInfo.coverUrl = currentSongInfo.highResUrl || rawCoverUrl;

    const videoElementForState = document.querySelector('video');
    if (videoElementForState) {
        isPlaying = !videoElementForState.paused;
    } else {
        const playPauseButton = document.getElementById('play-pause-button');
        if (playPauseButton) {
            const iconSvg = playPauseButton.querySelector('path[d*="M6"]');
            isPlaying = Boolean(iconSvg);
        }
    }

    const repeatButton = document.querySelector('.repeat.style-scope.ytmusic-player-bar');
    if (repeatButton) {
        const value = repeatButton.getAttribute('aria-aria-label') || repeatButton.getAttribute('value') || '';
        
        const iconPath = repeatButton.querySelector('path')?.getAttribute('d') || '';
        if (repeatButton.classList.contains('active') || repeatButton.getAttribute('aria-pressed') === 'true') {
            
            const hasOneIcon = repeatButton.querySelector('svg')?.innerHTML.includes('1') || iconPath.includes('1');
            repeatMode = hasOneIcon ? 2 : 1;
        } else {
            repeatMode = 0;
        }
    }

    const shuffleButton = document.querySelector('.shuffle-button');
    shuffle = shuffleButton && shuffleButton.classList.contains('active');

    const videoElement = document.querySelector('video');
    if (videoElement) {
        currentSongInfo.duration = videoElement.duration || 0;
        currentSongInfo.currentTime = videoElement.currentTime || 0;
        currentSongInfo.volume = Math.round((videoElement.volume || 1) * 100);
    }

    const playerBar = document.querySelector('ytmusic-player-bar[shuffle-on]');
    if (playerBar) {
        shuffle = true;
    }
}

async function getMiniPlayerHtml() {
    try {
        const htmlResponse = await fetch(chrome.runtime.getURL('miniplayer.html?v=' + Date.now()), { cache: 'no-store' });
        if (htmlResponse.ok) {
            return await htmlResponse.text();
        }
    } catch (e) {
        console.warn('Could not fetch miniplayer.html:', e);
    }
    return '';
}

function registerMediaSessionPipHandler() {
    const video = document.querySelector('video');
    if (video) {
        if (video.disablePictureInPicture) {
            video.disablePictureInPicture = false;
        }

        if (!video.dataset.pipInterceptAdded) {
            video.dataset.pipInterceptAdded = 'true';
            video.addEventListener('enterpictureinpicture', async () => {
                try {
                    if (document.pictureInPictureElement) {
                        await document.exitPictureInPicture();
                    }
                } catch (e) { }

                try {
                    const htmlContent = await getMiniPlayerHtml();
                    document.dispatchEvent(new CustomEvent("request-pip-window", { detail: { html: htmlContent } }));
                } catch (e) {
                    console.warn('Error launching custom PiP from Media Controls:', e);
                }
            });
        }
    }

    if ('mediaSession' in navigator) {
        try {
            navigator.mediaSession.setActionHandler('enterpictureinpicture', async () => {
                const htmlContent = await getMiniPlayerHtml();
                document.dispatchEvent(new CustomEvent('request-pip-window', { detail: { html: htmlContent } }));
            });
        } catch (e) { }
    }
}

function injectPipButtonToPlayerBar() {
    const rightControlsButtons = document.querySelector('#right-controls .right-controls-buttons, .right-controls-buttons');
    if (!rightControlsButtons || document.getElementById('pipButton')) return;

    const pipBtn = document.createElement('button');
    pipBtn.id = 'pipButton';
    pipBtn.className = 'pip-btn-injected style-scope yt-icon-button';
    pipBtn.title = 'Lyra Mini Player';
    pipBtn.setAttribute('aria-label', 'Lyra Mini Player');
    pipBtn.style.cssText = `
        background: transparent;
        border: none;
        box-sizing: border-box;
        cursor: pointer;
        outline: none;
        padding: 5px;
        margin: 0 2px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease, transform 0.15s ease;
    `;

    pipBtn.innerHTML = `
        <img src="${chrome.runtime.getURL('icons/icon512.png')}" style="width: 28px; height: 28px; object-fit: contain; pointer-events: none; display: block;" alt="Lyra Mini Player" />
    `;

    pipBtn.addEventListener('mouseenter', () => {
        pipBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
        pipBtn.style.transform = 'scale(1.08)';
    });

    pipBtn.addEventListener('mouseleave', () => {
        pipBtn.style.backgroundColor = 'transparent';
        pipBtn.style.transform = 'scale(1)';
    });

    pipBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            const htmlContent = await getMiniPlayerHtml();
            document.dispatchEvent(new CustomEvent('request-pip-window', { detail: { html: htmlContent } }));
        } catch (err) {
            console.error('Error triggering PiP from injected button:', err);
        }
    });

    rightControlsButtons.appendChild(pipBtn);
}

registerMediaSessionPipHandler();

function initPipButtonObserver() {
    injectPipButtonToPlayerBar();
    const target = document.querySelector('#right-controls .right-controls-buttons') || document.querySelector('.right-controls-buttons') || document.querySelector('ytmusic-player-bar') || document.body;
    if (target && !target.__lyraPipObserver) {
        const observer = new MutationObserver(() => {
            if (!document.getElementById('pipButton')) {
                injectPipButtonToPlayerBar();
            }
        });
        observer.observe(target, { childList: true, subtree: true });
        target.__lyraPipObserver = observer;
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPipButtonObserver, { once: true });
}
initPipButtonObserver();

let lastSavedW = null;
let lastSavedH = null;
let baseUserWidth = 240;
let baseUserHeight = 340;
let isAutoResizingPip = false;
let autoResizeTimer = null;

function setAutoResizingLock(ms = 1000) {
    isAutoResizingPip = true;
    if (autoResizeTimer) clearTimeout(autoResizeTimer);
    autoResizeTimer = setTimeout(() => {
        isAutoResizingPip = false;
    }, ms);
}

function getSavedPipSize() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['pipWidth', 'pipHeight'], (res) => {
                resolve(res || {});
            });
        } else {
            try {
                const saved = JSON.parse(localStorage.getItem('ytm_pip_size') || '{}');
                resolve(saved);
            } catch (e) {
                resolve({});
            }
        }
    });
}

function savePipSize() {
    if (!pipWindow || pipWindow.closed || isAutoResizingPip) return;

    const w = Math.max(150, Math.round(pipWindow.innerWidth || pipWindow.outerWidth));
    const h = Math.max(80, Math.round(pipWindow.innerHeight || pipWindow.outerHeight));

    if (w > 0) {
        baseUserWidth = w;
    }

    if (!isLyricsViewOpen && !isQueueViewOpen && !isPlaylistViewOpen && h > 0) {
        baseUserHeight = h;
    }

    if (w > 0 && h > 0 && (w !== lastSavedW || h !== lastSavedH)) {
        lastSavedW = w;
        lastSavedH = h;

        const sizeData = { pipWidth: baseUserWidth, pipHeight: baseUserHeight };
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(sizeData);
        }
        try {
            localStorage.setItem('ytm_pip_size', JSON.stringify(sizeData));
        } catch (e) { }
    }
}

document.addEventListener('request-pip-window', async (event) => {
    try {
        const { html } = event.detail;

        if ('documentPictureInPicture' in window) {
            if (pipWindow) {
                restoreVideoToMain();
                pipWindow.close();
                close();
            }

            const savedSize = await getSavedPipSize();
            baseUserWidth = Math.round(savedSize.pipWidth || 240);
            baseUserHeight = Math.round(savedSize.pipHeight || 340);
            const initialWidth = baseUserWidth;
            const initialHeight = baseUserHeight;

            try {
                pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: initialWidth,
                    height: initialHeight
                });
            } catch (pipError) {
                console.warn('PiP activation error:', pipError);
                if (pipError.message.includes('user activation')) {
                    console.info('Please interact with the YouTube Music page first before opening PiP');
                }
            }

            if (!pipWindow) return;

            pipWindow.addEventListener('resize', savePipSize);
            pipWindow.addEventListener('pagehide', () => {
                restoreVideoToMain();
                savePipSize();
            });
            pipWindow.addEventListener('unload', () => {
                restoreVideoToMain();
                savePipSize();
            });

            const styleLink = pipWindow.document.createElement('link');
            styleLink.rel = 'stylesheet';
            styleLink.href = chrome.runtime.getURL('miniplayer.css?v=' + Date.now());
            pipWindow.document.head.appendChild(styleLink);

            pipWindow.document.body.style.margin = '0';
            pipWindow.document.body.style.padding = '0';
            pipWindow.document.body.style.backgroundColor = '#121212';
            pipWindow.document.body.style.overflow = 'hidden';

            const content = document.createElement('div');
            content.id = 'pip-content';
            content.style.width = '100%';
            content.style.height = '100%';
            content.style.display = 'flex';
            content.classList.add('d-flex');
            pipWindow.document.body.appendChild(content);

            content.innerHTML = html;

            titleHtml = null;
            artistHtml = null;
            coverHtml = null;
            bgCoverHtml = null;
            placeHolderHtml = null;
            track = null;
            repeatHtml = null;
            repeatOnceHtml = null;
            repeatBtn = null;
            shuffleHtml = null;

            await extractSongInfo();

            await setup();
            setValues();

            let isResizing = false;
            function updateCoverSize() {
                if (!pipWindow || pipWindow.closed) return;
                const root = pipWindow.document.getElementById('mini-player-root');
                const wrapper = root?.querySelector('.cover-wrapper');
                if (!root || !wrapper) return;

                const h = root.offsetHeight;
                const w = root.offsetWidth;

                const diagonal = Math.sqrt(w * w + h * h);
                const speedMult = bgSpeedFactor > 0 ? (1 / bgSpeedFactor) : 999;
                const baseDuration = (diagonal * 0.07 * speedMult).toFixed(2);
                root.style.setProperty('--bg-duration-base', `${baseDuration}s`);

                const ambientBg = root.querySelector('.ambient-bg');
                const ambientOverlay = root.querySelector('.ambient-overlay');
                if (ambientBg) {
                    
                    if (bgBrightnessVal === 100) {
                        ambientBg.style.opacity = '1.0';
                        ambientBg.style.filter = 'none';
                        if (ambientOverlay) ambientOverlay.style.background = '';
                    } else if (bgBrightnessVal < 100) {
                        ambientBg.style.opacity = (bgBrightnessVal / 100).toFixed(2);
                        ambientBg.style.filter = 'none';
                        if (ambientOverlay) ambientOverlay.style.background = '';
                    } else {
                        ambientBg.style.opacity = '1.0';
                        
                        const bFactor = (1 + (bgBrightnessVal - 100) * 0.003).toFixed(2); 
                        const sFactor = (1 + (bgBrightnessVal - 100) * 0.005).toFixed(2); 
                        ambientBg.style.filter = `brightness(${bFactor}) saturate(${sFactor})`;
                        if (ambientOverlay) ambientOverlay.style.background = '';
                    }

                    const bgLayers = ambientBg.querySelectorAll('.bg-layer');
                    bgLayers.forEach(layer => {
                        
                        let baseBlur = 45;
                        if (layer.classList.contains('bg-center')) baseBlur = 35;
                        else if (layer.classList.contains('bg-left') || layer.classList.contains('bg-right')) baseBlur = 30;

                        const currentBlur = Math.round(baseBlur * (bgBlurVal / 100));

                        let layerFilter = `blur(${currentBlur}px)`;
                        if (layer.classList.contains('bg-base')) layerFilter += ' brightness(0.7) saturate(2.0)';
                        else if (layer.classList.contains('bg-center')) layerFilter += ' brightness(0.8) saturate(2.2)';
                        else layerFilter += ' brightness(0.85) saturate(2.4)';

                        layer.style.filter = layerFilter;

                        if (bgSpeedFactor <= 0) {
                            layer.style.animationPlayState = 'paused';
                        } else {
                            layer.style.animationPlayState = 'running';
                            let relativeFactor = 1.0;
                            if (layer.classList.contains('bg-center')) relativeFactor = 0.6;
                            else if (layer.classList.contains('bg-left')) relativeFactor = 0.35;
                            else if (layer.classList.contains('bg-right')) relativeFactor = 0.4;

                            const layerDuration = (parseFloat(baseDuration) * relativeFactor).toFixed(2);
                            layer.style.animationDuration = `${layerDuration}s`;
                        }
                    });
                }

                let side;

                if (h < 100) {
                    side = Math.max(0, h - 8);
                    if (isLyricsViewOpen) {
                        isLyricsViewOpen = false;
                        wasLyricsViewOpenBeforeShrinking = true;
                        const lyricsContainer = root.querySelector('#lyrics-container');
                        const lyricsToggleBtn = root.querySelector('#lyrics-toggle-btn');
                        if (lyricsContainer) lyricsContainer.classList.add('hide');
                        root.classList.remove('lyrics-mode');
                        if (lyricsToggleBtn) {
                            lyricsToggleBtn.classList.remove('active', 'shake');
                        }
                        if (animFrameId && pipWindow) {
                            pipWindow.cancelAnimationFrame(animFrameId);
                            animFrameId = null;
                        }
                    }
                } else {
                    if (wasLyricsViewOpenBeforeShrinking && !isLyricsViewOpen) {
                        wasLyricsViewOpenBeforeShrinking = false;
                        isLyricsViewOpen = true;
                        const lyricsContainer = root.querySelector('#lyrics-container');
                        const lyricsToggleBtn = root.querySelector('#lyrics-toggle-btn');
                        if (lyricsContainer) lyricsContainer.classList.remove('hide');
                        root.classList.add('lyrics-mode');
                        if (lyricsToggleBtn) lyricsToggleBtn.classList.add('active');
                        if (currentLyricsSongKey !== `${currentSongInfo.title}-${currentSongInfo.artist}`) {
                            fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);
                        }
                        startLyricsAnimLoop();
                    }

                    if (h < 180) {
                        const controls = root.querySelector('.middle-section');
                        const progress = root.querySelector('.bottom-section');
                        const overhead = 12 +
                            (controls?.offsetHeight || 32) +
                            (progress?.offsetHeight || 6) +
                            6;
                        side = Math.max(32, h - overhead);
                    } else {
                        const songInfo = root.querySelector('.song-info');
                        const controls = root.querySelector('.middle-section');
                        const progress = root.querySelector('.bottom-section');
                        const overhead = 16 +
                            (songInfo?.offsetHeight || 36) +
                            (controls?.offsetHeight || 42) +
                            (progress?.offsetHeight || 10) +
                            20;
                        side = Math.min(w - 20, Math.max(0, h - overhead));
                    }
                }

                side = Math.max(32, side);
                if (isMvMode) {
                    const maxW = Math.min(w - 20, Math.round(side * 1.6));
                    const targetW = maxW;
                    const targetH = Math.round(targetW / 1.777);
                    wrapper.style.width = targetW + 'px';
                    wrapper.style.height = targetH + 'px';
                } else {
                    const targetPx = side + 'px';
                    if (wrapper.style.width !== targetPx || wrapper.style.height !== targetPx) {
                        wrapper.style.width = targetPx;
                        wrapper.style.height = targetPx;
                    }
                }

                const controlsContainer = root.querySelector('.controls');
                if (controlsContainer) {
                    const parentW = controlsContainer.parentElement ? controlsContainer.parentElement.clientWidth : 0;
                    const rawW = controlsContainer.clientWidth || controlsContainer.offsetWidth || w;
                    let containerWidth = parentW > 0 ? Math.min(rawW, parentW) : rawW;

                    if (isLyricsViewOpen && w > 350) {
                        containerWidth = Math.floor(w * 0.45) - 20;
                    }

                    const optionalBtnWidth = 32;

                    const slotPriorityRank = [6, 4, 1, 2, 3, 5, 7];

                    const activeSlots = [];
                    customControlsPriority.forEach((btnId, slotIdx) => {
                        if (btnId !== null) {
                            activeSlots.push({
                                btnId: btnId,
                                slotIdx: slotIdx,
                                rank: slotPriorityRank[slotIdx] || 99
                            });
                        }
                    });

                    let allowedOptionalCount = Math.floor(containerWidth / optionalBtnWidth);
                    allowedOptionalCount = Math.max(1, Math.min(allowedOptionalCount, activeSlots.length, 12));

                    const sortedByPriority = [...activeSlots].sort((a, b) => a.rank - b.rank);
                    const selectedSlots = sortedByPriority.slice(0, allowedOptionalCount);

                    selectedSlots.sort((a, b) => a.slotIdx - b.slotIdx);

                    const currentKeys = selectedSlots.map(s => s.btnId).join(',');
                    if (controlsContainer._lastRenderedKeys !== currentKeys) {
                        controlsContainer._lastRenderedKeys = currentKeys;

                        const btnDomMap = {
                            prev: root.querySelector('#prev-btn'),
                            play: root.querySelector('#playPause-btn'),
                            next: root.querySelector('#next-btn'),
                            lyrics: root.querySelector('#lyrics-toggle-btn'),
                            queue: root.querySelector('#queue-toggle-btn'),
                            playlist: root.querySelector('#playlist-toggle-btn'),
                            repeat: root.querySelector('#repeat-btn'),
                            shuffle: root.querySelector('#shuffle-btn'),
                            mute: root.querySelector('#mute-btn'),
                            like: root.querySelector('#like-btn'),
                            dislike: root.querySelector('#dislike-btn'),
                            rewind: root.querySelector('#rewind-btn'),
                            forward: root.querySelector('#forward-btn'),
                            radio: root.querySelector('#radio-btn'),
                            search: root.querySelector('#search-toggle-btn')
                        };

                        Object.values(btnDomMap).forEach(btn => {
                            if (btn) btn.classList.add('hide');
                        });

                        const fragment = pipWindow.document.createDocumentFragment();

                        selectedSlots.forEach(item => {
                            const btnEl = btnDomMap[item.btnId];
                            if (btnEl) {
                                btnEl.classList.remove('hide');
                                fragment.appendChild(btnEl);
                            }
                        });

                        controlsContainer.appendChild(fragment);
                    }
                }
            }

            function throttledUpdateCoverSize() {
                if (!isResizing) {
                    isResizing = true;
                    pipWindow.requestAnimationFrame(() => {
                        updateCoverSize();
                        isResizing = false;
                    });
                }
            }

            updateCoverSizeFn = updateCoverSize;
            updateCoverSize();
            const coverResizeObserver = new pipWindow.ResizeObserver(throttledUpdateCoverSize);
            coverResizeObserver.observe(pipWindow.document.getElementById('mini-player-root'));

            let update = setInterval(async () => {
                if (!pipWindow || pipWindow.closed) {
                    clearInterval(update);
                    coverResizeObserver.disconnect();
                    updateCoverSizeFn = null;
                    pipWindow = null;
                    return;
                }
                await extractSongInfo();
                setValues();
            }, 1000);

            const videoElement = document.querySelector('video');
            if (videoElement) {
                videoElement.addEventListener('timeupdate', () => {
                    if (pipWindow && !pipWindow.closed) {
                        currentSongInfo.currentTime = videoElement.currentTime;
                        currentSongInfo.duration = videoElement.duration;

                        if (!isDraggingProgress && track && currentSongInfo.duration > 0) {
                            const progress = (currentSongInfo.currentTime / currentSongInfo.duration) * 100;
                            track.style.width = `${progress}%`;
                        }

                        lastSyncedTime = videoElement.currentTime;
                        lastSyncTimestamp = performance.now();
                    }
                });

                videoElement.addEventListener('seeking', () => {
                    lastSyncedTime = videoElement.currentTime;
                    lastSyncTimestamp = performance.now();
                });

                videoElement.addEventListener('seeked', () => {
                    lastSyncedTime = videoElement.currentTime;
                    lastSyncTimestamp = performance.now();
                });

                fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);

                videoElement.addEventListener('loadstart', () => {
                    extractSongInfo().then(() => {
                        if (pipWindow && !pipWindow.closed) updatePipContent();
                    });
                });

                videoElement.addEventListener('loadedmetadata', () => {
                    extractSongInfo().then(() => {
                        if (pipWindow && !pipWindow.closed) updatePipContent();
                    });
                });

                videoElement.addEventListener('play', () => {
                    lastSyncedTime = videoElement.currentTime;
                    lastSyncTimestamp = performance.now();
                    extractSongInfo().then(() => {
                        if (pipWindow && !pipWindow.closed) updatePipContent();
                    });
                    if (isLyricsViewOpen) {
                        startLyricsAnimLoop();
                    }
                });

                videoElement.addEventListener('pause', () => {
                    stopLyricsAnimLoop();
                });

                videoElement.addEventListener('volumechange', () => {
                    if (pipWindow && !pipWindow.closed) {
                        currentSongInfo.volume = Math.round(videoElement.volume * 100);
                        if (volumeSlider) {
                            volumeSlider.value = currentSongInfo.volume;
                        }
                        if (volumeSliderPopup) {
                            volumeSliderPopup.value = currentSongInfo.volume;
                        }
                    }
                });
            }

            const playerImgs = document.querySelectorAll('.image.style-scope.ytmusic-player-bar, ytmusic-player-bar img');
            playerImgs.forEach(img => {
                img.addEventListener('load', () => {
                    extractSongInfo().then(() => {
                        if (pipWindow && !pipWindow.closed) updatePipContent();
                    });
                });
            });

            const targetBar = document.querySelector('ytmusic-player-bar') || document.body;
            const observer = new MutationObserver(() => {
                extractSongInfo().then(() => {
                    if (pipWindow && !pipWindow.closed) {
                        updatePipContent();
                    }
                });
            });

            observer.observe(targetBar, {
                attributes: true,
                childList: true,
                subtree: true,
                attributeFilter: ['src', 'title', 'aria-label', 'aria-pressed']
            });

            pipWindow.addEventListener('pagehide', () => {
                observer.disconnect();
                close();
                clearInterval(update);
                pipWindow = null;
            });

        }
    } catch (error) {
        console.error('Error creating PiP window:', error);
    }
});

function close() {
    pipWindow = null;
    isPlaying = false;
    repeatMode = 0;
    shuffle = false;
    titleHtml = null;
    artistHtml = null;
    coverHtml = null;
    placeHolderHtml = null;
    track = null;
    shuffleHtml = null;
    repeatBtn = null;
    repeatHtml = null;
    repeatOnceHtml = null;
    volumeSlider = null;
    volumeSliderPopup = null;
    lyricsData = [];
    currentLyricsSongKey = '';
    currentActiveLineIndex = -1;
    isLyricsViewOpen = false;
    wasLyricsViewOpenBeforeShrinking = false;
    lastSyncedTime = 0;
    lastSyncTimestamp = 0;
}

let lyricsData = [];
let currentLyricsSongKey = '';
let lastKnownSongKey = ''; 
let currentActiveLineIndex = -1;
let isLyricsViewOpen = false;
let wasLyricsViewOpenBeforeShrinking = false;
let lastSyncedTime = 0;
let lastSyncTimestamp = 0;
let currentLyricsDisplayMode = 'both';

function applyLyricsModeToDom() {
    if (!pipWindow || pipWindow.closed) return;
    const lyricsContainer = pipWindow.document.getElementById('lyrics-container');
    if (lyricsContainer) {
        lyricsContainer.setAttribute('data-lyrics-mode', currentLyricsDisplayMode);
    }
}

function injectMiniplayerScript() {
    if (document.getElementById('lyra-miniplayer-script')) return;
    const script = document.createElement('script');
    script.id = 'lyra-miniplayer-script';
    script.src = chrome.runtime.getURL('miniplayer.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}
injectMiniplayerScript();

let miniplayerRequestCounter = 0;
const pendingMiniplayerRequests = new Map();

window.addEventListener("message", (e) => {
    if (e.source !== window || e.data?.source !== "lyra-miniplayer") return;
    if (e.data.type === "response" && pendingMiniplayerRequests.has(e.data.requestId)) {
        pendingMiniplayerRequests.get(e.data.requestId)(e.data.result);
        pendingMiniplayerRequests.delete(e.data.requestId);
    }
});

function askMiniplayerAsync(command, payload = {}, timeoutMs = 8000) {
    return new Promise((resolve) => {
        const requestId = ++miniplayerRequestCounter;
        const timer = setTimeout(() => {
            if (pendingMiniplayerRequests.has(requestId)) {
                pendingMiniplayerRequests.delete(requestId);
                resolve(null);
            }
        }, timeoutMs);

        pendingMiniplayerRequests.set(requestId, (res) => {
            clearTimeout(timer);
            resolve(res);
        });

        window.postMessage({ source: "lyra-content", command, payload, requestId }, window.location.origin);
    });
}

function queueRendererOf(entry) {
    return (
        entry?.playlistPanelVideoRenderer ??
        entry?.playlistPanelVideoWrapperRenderer?.primaryRenderer?.playlistPanelVideoRenderer ??
        null
    );
}

function readQueueDataFromStore() {
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
        const videoElement = document.querySelector('video');
        const ids = videoElement && window.ytmusic?.player?.getPlaylist ? window.ytmusic.player.getPlaylist() : null;
        if (Array.isArray(ids) && ids.length) {
            return ids.map(id => ({
                videoId: id ?? null,
                title: '',
                thumb: id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ''
            }));
        }
        return null;
    }

    return items.map((entry) => {
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
}

async function getQueueWithThumbs() {
    const scope = document.querySelector("ytmusic-player-queue") ?? document;
    const items = [...scope.querySelectorAll("ytmusic-player-queue-item")].filter(
        (item) => !item.closest("#counterpart-renderer")
    );

    injectMiniplayerScript();
    const storeData = (await askMiniplayerAsync("getQueueData", {}, 3000)) || [];

    const thumbByTitle = new Map(
        storeData.filter(e => e && e.thumb).map(e => [e.title, e.thumb])
    );
    const videoIdByTitle = new Map(
        storeData.filter(e => e && e.videoId).map(e => [e.title, e.videoId])
    );

    return items.map((item, index) => {
        const src = item.querySelector("img")?.src ?? "";
        const title = item.querySelector(".song-title")?.textContent?.trim() ?? "";
        const artist = item.querySelector(".byline")?.textContent?.trim() ?? "";
        const duration = item.querySelector(".duration")?.textContent?.trim() ?? "";
        const isCurrentSong = Boolean(currentSongInfo?.title && title && title.toLowerCase() === currentSongInfo.title.toLowerCase());
        const selected = item.hasAttribute("selected") || item.hasAttribute("playing") || item.getAttribute("play-button-state") === "playing" || isCurrentSong;

        const storeMatch = storeData[index];
        const alignedStore = (storeMatch && (!storeMatch.title || storeMatch.title === title)) ? storeMatch : null;

        let thumb = (!src || src.startsWith("data:")) ? "" : src;
        if (!thumb) {
            thumb = alignedStore?.thumb || (title ? thumbByTitle.get(title) : "") || "";
        }

        let videoId = alignedStore?.videoId || (title ? videoIdByTitle.get(title) : null);
        if (!thumb && videoId) {
            thumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
        }

        return {
            index,
            title: title || alignedStore?.title || "",
            artist: artist || alignedStore?.artist || "",
            duration,
            thumb,
            selected,
            videoId
        };
    }).filter(entry => entry.title);
}

let cachedPlaylists = null;

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['cachedPlaylists'], (res) => {
        if (res && Array.isArray(res.cachedPlaylists) && res.cachedPlaylists.length) {
            cachedPlaylists = res.cachedPlaylists;
        }
    });
}

function readPlaylistsFromDOM() {
    const playlists = [];
    const seen = new Set();

    const selectors = [
        'ytmusic-guide-entry-renderer',
        'ytmusic-compact-station-renderer',
        'ytmusic-two-row-item-renderer',
        'tp-yt-paper-item',
        'ytmusic-navigation-button-renderer'
    ];
    
    const elements = document.querySelectorAll(selectors.join(', '));
    elements.forEach(entry => {
        const a = entry.querySelector('a[href*="list="]');
        if (!a) return;
        const href = a.getAttribute('href') || '';
        const match = href.match(/list=([A-Za-z0-9_-]+)/);
        if (!match) return;
        let rawId = match[1];
        if (rawId.startsWith('RD') || rawId.startsWith('UL')) return;
        let browseId = rawId;
        if (browseId.startsWith('PL')) browseId = 'VL' + browseId;
        if (seen.has(browseId)) return;
        seen.add(browseId);

        let title = entry.querySelector('yt-formatted-string, .title, .text, a')?.textContent?.trim() || '';
        if (!title || title === 'Playlist') {
            title = a.getAttribute('title') || a.textContent?.trim() || 'Playlist';
        }
        const subtitle = entry.querySelector('.subtitle, .byline')?.textContent?.trim() || 'Playlist';
        const img = entry.querySelector('img')?.src || '';

        playlists.push({
            id: browseId,
            title,
            subtitle,
            thumb: (img.startsWith('data:') ? '' : img)
        });
    });

    if (playlists.length === 0) {
        const links = document.querySelectorAll('a[href*="list=VL"], a[href*="list=PL"]');
        links.forEach(a => {
            const href = a.getAttribute('href') || '';
            const match = href.match(/list=(VL[A-Za-z0-9_-]+|PL[A-Za-z0-9_-]+)/);
            if (!match) return;
            let browseId = match[1];
            if (browseId.startsWith('PL')) browseId = 'VL' + browseId;
            if (seen.has(browseId)) return;
            seen.add(browseId);

            const parent = a.closest('ytmusic-two-row-item-renderer, tp-yt-paper-item, div') || a;
            const title = parent.querySelector('.title, yt-formatted-string')?.textContent?.trim() || a.textContent?.trim() || 'Playlist';
            const img = parent.querySelector('img')?.src || '';

            playlists.push({
                id: browseId,
                title,
                subtitle: 'Playlist',
                thumb: (img.startsWith('data:') ? '' : img)
            });
        });
    }

    return playlists;
}

async function fetchPlaylists() {
    injectMiniplayerScript();
    
    let playlists = await askMiniplayerAsync("getPlaylists", {}, 4000);
    
    if (!Array.isArray(playlists) || !playlists.length) {
        playlists = readPlaylistsFromDOM();
    }
    
    if (!Array.isArray(playlists) || !playlists.length) {
        await new Promise(r => setTimeout(r, 600));
        playlists = await askMiniplayerAsync("getPlaylists", {}, 4000);
        if (!Array.isArray(playlists) || !playlists.length) {
            playlists = readPlaylistsFromDOM();
        }
    }
    
    if (Array.isArray(playlists) && playlists.length) {
        cachedPlaylists = playlists;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ cachedPlaylists: playlists });
        }
        return playlists;
    }
    
    return cachedPlaylists || [];
}

async function addToPlaylist(playlistId, videoId) {
    if (!playlistId || !videoId) return "error";
    injectMiniplayerScript();
    const res = await askMiniplayerAsync("addToPlaylist", { playlistId, videoId }, 8000);
    return res || "error";
}

function getCurrentVideoId() {
    const moviePlayer = document.getElementById('movie_player');
    if (moviePlayer && typeof moviePlayer.getVideoData === 'function') {
        const data = moviePlayer.getVideoData();
        if (data && data.video_id) return data.video_id;
    }
    const watchLink = document.querySelector('a.ytp-title-link, a[href*="watch?v="]');
    if (watchLink) {
        const m = watchLink.href.match(/v=([^&]+)/);
        if (m) return m[1];
    }
    const urlMatch = window.location.href.match(/v=([^&]+)/);
    if (urlMatch) return urlMatch[1];
    return null;
}

let isQueueViewOpen = false;
let isPlaylistViewOpen = false;
let isAddToPlaylistMode = false;
let activePlayingPlaylistId = null;
let activePlayingMode = null; 

let closePlaylistPanelFn = null;
function adjustPipWindowHeight(needExpand) {
    if (!needExpand || !pipWindow || pipWindow.closed) return;
    const minRequiredInnerHeight = 300;
    const currentInnerH = Math.round(pipWindow.innerHeight || 0);

    if (currentInnerH < minRequiredInnerHeight) {
        setAutoResizingLock(1000);
        try {
            const currentW = Math.round(pipWindow.outerWidth || pipWindow.innerWidth || baseUserWidth);
            pipWindow.resizeTo(currentW, minRequiredInnerHeight);
        } catch (err) { }
    }
}

class LyricSpring {
    constructor(startPos, damping, frequency, goal = startPos) {
        this.dampingRatio = damping;
        this.frequency = frequency;
        this.goal = goal;
        this.position = startPos;
        this.velocity = 0;
    }

    step(dt) {
        const tau = Math.PI * 2;
        const d = this.dampingRatio;
        const f = this.frequency * tau;
        const g = this.goal;
        const x = this.position;
        const v = this.velocity;

        if (dt <= 0) return x;

        if (d === 1) {
            const q = Math.exp(-f * dt);
            const w = dt * q;
            const c0 = q + w * f;
            const c2 = q - w * f;
            const c3 = w * f * f;
            const goalDist = x - g;
            this.position = goalDist * c0 + v * w + g;
            this.velocity = v * c2 - goalDist * c3;
        } else if (d < 1) {
            const fdt = f * dt;
            const q = Math.exp(-d * fdt);
            const c = Math.sqrt(1 - d * d);
            const cfdt = c * fdt;
            const cosVal = Math.cos(cfdt);
            const sinVal = Math.sin(cfdt);
            const z = sinVal / c;
            const goalDist = x - g;
            const c0 = q * (cosVal + d * z);
            const c1 = q * z / f;
            const c2 = q * (cosVal - d * z);
            const c3 = q * z * f;
            this.position = goalDist * c0 + v * c1 + g;
            this.velocity = v * c2 - goalDist * c3;
        } else {
            const c = Math.sqrt(d * d - 1);
            const r1 = -f * (d - c);
            const r2 = -f * (d + c);
            const goalDist = x - g;
            const c2 = (v - r1 * goalDist) / (r2 - r1);
            const c1 = goalDist - c2;
            const e1 = Math.exp(r1 * dt);
            const e2 = Math.exp(r2 * dt);
            this.position = c1 * e1 + c2 * e2 + g;
            this.velocity = c1 * r1 * e1 + c2 * r2 * e2;
        }
        return this.position;
    }
}

const letterSpringMap = new WeakMap();

function getLetterSprings(letterEl) {
    if (!letterSpringMap.has(letterEl)) {
        letterSpringMap.set(letterEl, {
            scale: new LyricSpring(0.97, 0.7, 0.8, 1.0),
            yOffset: new LyricSpring(0, 0.6, 1.0, 0),
            glow: new LyricSpring(0, 0.6, 1.0, 0.3),
            triggered: false
        });
    }
    return letterSpringMap.get(letterEl);
}

function parseLrc(lrcText) {
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

let isLyricsSynced = false;

let currentLyricsSource = 'Source: LRCLIB';

const LYRICS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; 

function cleanExpiredLyricsCache() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError || !items) return;
        const now = Date.now();
        const keysToRemove = [];
        Object.keys(items).forEach(key => {
            if (key.startsWith('lyric_cache_')) {
                const cached = items[key];
                if (!cached || !cached.timestamp || (now - cached.timestamp > LYRICS_CACHE_TTL_MS)) {
                    keysToRemove.push(key);
                }
            }
        });
        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove);
        }
    });
}

cleanExpiredLyricsCache();

function getLyricsFromStorage(songKey) {
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
            if (now - cached.timestamp > LYRICS_CACHE_TTL_MS) {
                chrome.storage.local.remove([storageKey]);
                return resolve(null);
            }
            resolve(cached);
        });
    });
}

function saveLyricsToStorage(songKey, data, source) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    const storageKey = 'lyric_cache_' + songKey;
    const cacheObj = {
        timestamp: Date.now(),
        data: data,
        source: source
    };
    chrome.storage.local.set({ [storageKey]: cacheObj });
}

let ytmBrowseLyrics = null;

(function setupYtmApiInterceptor() {
    if (window._lyraInterceptorSetup) return;
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

function getLyricsFromDom() {
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

function isArtistMatching(candidateArtist, primaryArtist, artistParts, fullArtist) {
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

async function fetchSyncedLyrics(title, artist) {
    const key = `${title}-${artist}`;
    if (currentLyricsSongKey === key) {
        if (lyricsData && lyricsData.length > 0) {
            renderLyricsList();
        }
        return;
    }
    currentLyricsSongKey = key;
    lyricsData = [];
    currentActiveLineIndex = -1;

    if (!pipWindow || pipWindow.closed) return;
    const statusEl = pipWindow.document.getElementById('lyrics-status');
    const listEl = pipWindow.document.getElementById('lyrics-list');
    if (statusEl) statusEl.textContent = 'Searching lyrics...';
    if (listEl) listEl.innerHTML = '';

    if (!title || title === "Lyra Player") {
        if (statusEl) statusEl.textContent = 'No track playing';
        return;
    }

    const artistParts = artist.split(/[,&•]|\bft\.\b|\bfeat\.\b/i).map(a => a.trim()).filter(Boolean);
    const primaryArtist = artistParts[0] || artist.split('•')[0].split(',')[0].trim();

    const cachedLyrics = await getLyricsFromStorage(key);
    if (cachedLyrics && cachedLyrics.data) {
        if (!cachedLyrics.data.artistName || isArtistMatching(cachedLyrics.data.artistName, primaryArtist, artistParts, artist)) {
            currentLyricsSource = cachedLyrics.source || 'Source: LRCLIB (Cached)';
            if (processLyricsData(cachedLyrics.data, false)) {
                return;
            }
        } else {
            try { chrome.storage.local.remove([key]); } catch (e) { }
        }
    }

    const headers = {
        'Lrclib-Client': 'Star_s YTM v1.0.0 (https://github.com/star-ytm)'
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

    const durationSec = Math.round(currentSongInfo.duration || 0);

    const fetchWithTimeout = async (url, options = {}, timeoutMs = 2500) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return res;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    };

    const fetchPromises = [];

    titleCandidates.forEach(targetTitle => {
        let params = `track_name=${encodeURIComponent(targetTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
        if (durationSec > 0) {
            params += `&duration=${durationSec}`;
        }

        fetchPromises.push((async () => {
            try {
                const res = await fetchWithTimeout(`https://lrclib.net/api/get?${params}`, { headers });
                if (res.ok) return await res.json();
            } catch (e) { }
            return null;
        })());

        if (durationSec > 0) {
            fetchPromises.push((async () => {
                try {
                    const res = await fetchWithTimeout(`https://lrclib.net/api/get?track_name=${encodeURIComponent(targetTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`, { headers });
                    if (res.ok) return await res.json();
                } catch (e) { }
                return null;
            })());
        }

        artistParts.forEach(part => {
            fetchPromises.push((async () => {
                try {
                    const res = await fetchWithTimeout(`https://lrclib.net/api/search?track_name=${encodeURIComponent(targetTitle)}&artist_name=${encodeURIComponent(part)}`, { headers });
                    if (res.ok) {
                        const results = await res.json();
                        if (Array.isArray(results) && results.length > 0) {
                            const matched = results.filter(item => isArtistMatching(item.artistName, primaryArtist, artistParts, artist));
                            return matched.find(item => item.syncedLyrics) || matched[0] || null;
                        }
                    }
                } catch (e) { }
                return null;
            })());
        });

        fetchPromises.push((async () => {
            try {
                const res = await fetchWithTimeout(`https://lrclib.net/api/search?q=${encodeURIComponent(targetTitle + ' ' + primaryArtist)}`, { headers });
                if (res.ok) {
                    const results = await res.json();
                    if (Array.isArray(results) && results.length > 0) {
                        const matched = results.filter(item => isArtistMatching(item.artistName, primaryArtist, artistParts, artist));
                        return matched.find(item => item.syncedLyrics) || matched[0] || null;
                    }
                }
            } catch (e) { }
            return null;
        })());
    });

    fetchPromises.push((async () => {
        try {
            const res = await fetchWithTimeout(`https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}`, { headers });
            if (res.ok) {
                const results = await res.json();
                if (Array.isArray(results) && results.length > 0) {
                    const matched = results.filter(item => isArtistMatching(item.artistName, primaryArtist, artistParts, artist));
                    return matched.find(item => item.syncedLyrics) || matched[0] || null;
                }
            }
        } catch (e) { }
        return null;
    })());

    try {
        const results = await Promise.all(fetchPromises);
        const validMatch = results.find(data => {
            if (!data || (!data.syncedLyrics && !data.plainLyrics)) return false;
            return isArtistMatching(data.artistName, primaryArtist, artistParts, artist);
        });
        if (validMatch) {
            currentLyricsSource = 'Source: LRCLIB';
            if (processLyricsData(validMatch, true, key)) return;
        }
    } catch (e) { }

    let domLyrics = getLyricsFromDom();
    if (!domLyrics) {
        const paperTabs = Array.from(document.querySelectorAll('tp-yt-paper-tab.tab-header, tp-yt-paper-tab'));
        const lyricsTabBtn = paperTabs.find(tab => tab.pageType === "MUSIC_PAGE_TYPE_TRACK_LYRICS") || paperTabs[1];
        if (lyricsTabBtn) {
            lyricsTabBtn.click();
            domLyrics = await new Promise(resolve => {
                let resolved = false;
                let observer = null;
                const timer = setTimeout(() => {
                    if (resolved) return;
                    resolved = true;
                    if (observer) observer.disconnect();
                    resolve(getLyricsFromDom());
                }, 2500);

                const container = document.querySelector('#tab-renderer') || document.body;
                observer = new MutationObserver(() => {
                    const found = getLyricsFromDom();
                    if (found && !resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        observer.disconnect();
                        resolve(found);
                    }
                });
                observer.observe(container, { childList: true, subtree: true, characterData: true });
            });
        }
    }

    if (domLyrics) {
        currentLyricsSource = 'Source: YouTube Music';
        if (processLyricsData({ plainLyrics: domLyrics }, true, key)) {
            return;
        }
    }

    if (statusEl) statusEl.textContent = 'Lyrics not found (._.)';
}

function processLyricsData(data, triggerSave = false, songKey = '') {
    if (!data) return false;
    let success = false;
    if (!isMvMode && data.syncedLyrics && data.syncedLyrics.trim().length > 0) {
        isLyricsSynced = true;
        lyricsData = parseLrc(data.syncedLyrics);
        renderLyricsList();
        success = true;
    } else if (data.plainLyrics && data.plainLyrics.trim().length > 0) {
        isLyricsSynced = false;
        const plainLines = data.plainLyrics.split('\n').filter(l => l.trim().length > 0);
        lyricsData = plainLines.map(text => ({ time: null, text }));
        renderLyricsList();
        success = true;
    } else if (isMvMode && data.syncedLyrics && data.syncedLyrics.trim().length > 0) {
        isLyricsSynced = false;
        const strippedLines = data.syncedLyrics
            .split('\n')
            .map(line => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').replace(/<\d{2}:\d{2}\.\d{2,3}>/g, '').replace(/<\d+\.\d{2,3}>/g, '').trim())
            .filter(line => line.length > 0 && !line.startsWith('[') && !line.startsWith('ve:'));
        lyricsData = strippedLines.map(text => ({ time: null, text }));
        renderLyricsList();
        success = true;
    }

    if (success && triggerSave && songKey) {
        saveLyricsToStorage(songKey, data, currentLyricsSource);
    }

    return success;
}

const romanizeCache = new Map();

function detectLangCode(text) {
    if (/[\u3040-\u30ff]/.test(text)) return 'ja'; 
    if (/[\uac00-\ud7af]/.test(text)) return 'ko'; 
    if (/[\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return 'zh-CN'; 
    return 'ja';
}

async function fetchRomanizedText(text) {
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

async function renderLyricsList() {
    if (!pipWindow || pipWindow.closed) return;
    currentActiveLineIndex = -1;
    const statusEl = pipWindow.document.getElementById('lyrics-status');
    const listEl = pipWindow.document.getElementById('lyrics-list');

    if (!lyricsData || lyricsData.length === 0) {
        if (statusEl) statusEl.textContent = 'Lyrics not found (._.)';
        return;
    }

    if (statusEl) statusEl.textContent = 'Translating lyrics...';

    const cjkRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u0400-\u04ff]/;
    const hasCJK = lyricsData.some(item => cjkRegex.test(item.text));

    if (hasCJK) {
        await Promise.all(lyricsData.map(async (item) => {
            if (cjkRegex.test(item.text)) {
                await fetchRomanizedText(item.text);
            }
        }));
    }

    if (!pipWindow || pipWindow.closed) return;
    applyLyricsModeToDom();
    if (statusEl) statusEl.textContent = '';
    listEl.innerHTML = '';

    if (!isLyricsSynced) {
        listEl.classList.add('plain-mode');
    } else {
        listEl.classList.remove('plain-mode');
    }

    lyricsData.forEach((item, lineIndex) => {
        const vocalsGroup = pipWindow.document.createElement('div');
        vocalsGroup.className = 'lyra-line-wrap';

        const vocals = pipWindow.document.createElement('div');
        vocals.className = 'lyra-line';
        vocals.dataset.index = lineIndex;

        if (item.words && item.words.length > 0) {
            vocals.classList.add('is-word-line');
            item.words.forEach((w, wIdx) => {
                const wordSpan = pipWindow.document.createElement('span');
                wordSpan.className = 'lyra-word';
                wordSpan.dataset.wordIndex = wIdx;
                wordSpan.dataset.time = w.time;
                wordSpan.dataset.duration = w.duration;

                const chars = Array.from(w.text);
                const charDuration = w.duration / Math.max(1, chars.length);

                chars.forEach((char, cIdx) => {
                    const letterSpan = pipWindow.document.createElement('span');
                    letterSpan.className = 'lyra-letter';
                    letterSpan.dataset.charIndex = cIdx;
                    letterSpan.dataset.time = w.time + cIdx * charDuration;
                    letterSpan.dataset.duration = charDuration;
                    letterSpan.textContent = char;
                    wordSpan.appendChild(letterSpan);
                });

                vocals.appendChild(wordSpan);
            });
        } else {
            vocals.textContent = item.text;
        }

        vocalsGroup.appendChild(vocals);

        let subText = null;
        if (cjkRegex.test(item.text)) {
            subText = romanizeCache.get(item.text);
        } else if (hasCJK && item.text && item.text.trim().length > 0) {
            subText = item.text;
        }

        if (subText) {
            const romEl = pipWindow.document.createElement('div');
            romEl.className = 'lyra-romanized';
            romEl.textContent = subText;
            vocalsGroup.appendChild(romEl);
            vocalsGroup.classList.add('has-romaji');
        }

        vocalsGroup.addEventListener('click', () => {
            const video = document.querySelector('video');
            if (video && item.time != null && item.time < 9000) video.currentTime = item.time;
        });

        listEl.appendChild(vocalsGroup);
    });

    const sourceEl = pipWindow.document.createElement('div');
    sourceEl.className = 'lyra-lyrics-source';
    sourceEl.textContent = currentLyricsSource;
    listEl.appendChild(sourceEl);
}

let animFrameId = null;
let lastFrameTime = 0;

function stopLyricsAnimLoop() {
    if (animFrameId && pipWindow) {
        pipWindow.cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
}

function startLyricsAnimLoop() {
    stopLyricsAnimLoop();
    lastFrameTime = performance.now();

    const video = document.querySelector('video');
    if (video) {
        lastSyncedTime = video.currentTime;
        lastSyncTimestamp = performance.now();
    }

    function loop() {
        if (!pipWindow || pipWindow.closed) {
            animFrameId = null;
            return;
        }

        const video = document.querySelector('video');
        // Only run animation frame if lyrics view is open and video is playing
        if (!isLyricsViewOpen || !video || video.paused) {
            animFrameId = null;
            return;
        }

        const now = performance.now();
        const deltaTime = Math.min(0.1, (now - lastFrameTime) / 1000);
        lastFrameTime = now;

        let currentSongTime = video.currentTime;
        const timeSinceSync = (now - lastSyncTimestamp) / 1000;
        currentSongTime = lastSyncedTime + timeSinceSync;
        if (Math.abs(currentSongTime - video.currentTime) > 0.5) {
            currentSongTime = video.currentTime;
            lastSyncedTime = video.currentTime;
            lastSyncTimestamp = now;
        }

        updateActiveLyricLine(currentSongTime, deltaTime);
        animFrameId = pipWindow.requestAnimationFrame(loop);
    }
    if (pipWindow && isLyricsViewOpen) loop();
}

function updateActiveLyricLine(currentTime, deltaTime) {
    if (!isLyricsSynced || !lyricsData || lyricsData.length === 0 || !pipWindow || pipWindow.closed) return;

    let activeIndex = -1;
    for (let i = 0; i < lyricsData.length; i++) {
        if (currentTime >= lyricsData[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    const listEl = pipWindow.document.getElementById('lyrics-list');
    if (!listEl) return;

    const hasActiveEl = listEl.querySelector('.lyra-line.active');
    if (activeIndex !== currentActiveLineIndex || !hasActiveEl) {
        currentActiveLineIndex = activeIndex;

        const allWraps = listEl.querySelectorAll('.lyra-line-wrap');
        allWraps.forEach((wrap, index) => {
            const vocals = wrap.querySelector('.lyra-line');
            if (index === activeIndex) {
                if (vocals) {
                    vocals.classList.add('active');
                    vocals.classList.remove('sung');
                }
                const lyricsContainer = pipWindow.document.getElementById('lyrics-container');
                if (lyricsContainer) {
                    attachLyricsUserScrollListener(lyricsContainer);
                    scrollToCenter(lyricsContainer, wrap);
                }
            } else if (index < activeIndex) {
                if (vocals) {
                    vocals.classList.add('sung');
                    vocals.classList.remove('active');
                }
            } else {
                if (vocals) vocals.classList.remove('active', 'sung');
            }
        });
    }

    if (activeIndex >= 0 && activeIndex < lyricsData.length) {
        const activeItem = lyricsData[activeIndex];
        if (activeItem && activeItem.words && activeItem.words.length > 0) {
            const activeLineEl = listEl.querySelector(`.lyra-line[data-index="${activeIndex}"]`);
            if (activeLineEl) {
                const wordEls = activeLineEl.querySelectorAll('.lyra-word');
                wordEls.forEach((wordEl, wIdx) => {
                    const wData = activeItem.words[wIdx];
                    if (!wData) return;

                    const letterEls = wordEl.querySelectorAll('.lyra-letter');
                    const numLetters = letterEls.length;
                    const charDuration = wData.duration / Math.max(1, numLetters);

                    let allLettersSung = true;

                    letterEls.forEach((letterEl, cIdx) => {
                        const letterTime = wData.time + cIdx * charDuration;
                        const letterEndTime = letterTime + charDuration;

                        if (currentTime >= letterTime && currentTime < letterEndTime + 0.15) {
                            allLettersSung = false;
                            letterEl.classList.add('active');
                            letterEl.classList.remove('sung');

                            const springs = getLetterSprings(letterEl);
                            if (!springs.triggered) {
                                springs.triggered = true;
                                springs.scale.position = 0.96;
                                springs.scale.goal = 1.0;
                                springs.yOffset.position = -0.9;
                                springs.yOffset.goal = 0;
                                springs.glow.position = 0.9;
                                springs.glow.goal = 0.3;
                            }

                            const curScale = springs.scale.step(deltaTime);
                            const curY = springs.yOffset.step(deltaTime);
                            const curGlow = springs.glow.step(deltaTime);

                            letterEl.style.transform = `translateY(${curY.toFixed(2)}px) scale(${curScale.toFixed(3)})`;
                            letterEl.style.textShadow = `0 0 ${Math.max(2, curGlow * 10).toFixed(1)}px rgba(255, 255, 255, ${Math.min(0.65, curGlow).toFixed(2)})`;
                        } else if (currentTime >= letterEndTime + 0.15) {
                            letterEl.classList.add('sung');
                            letterEl.classList.remove('active');
                            letterEl.style.transform = '';
                            letterEl.style.textShadow = '';
                        } else {
                            allLettersSung = false;
                            letterEl.classList.remove('active', 'sung');
                            letterEl.style.transform = '';
                            letterEl.style.textShadow = '';
                            const springs = getLetterSprings(letterEl);
                            springs.triggered = false;
                        }
                    });

                    if (allLettersSung) {
                        wordEl.classList.add('sung');
                        wordEl.classList.remove('active');
                    } else if (currentTime >= wData.time) {
                        wordEl.classList.add('active');
                        wordEl.classList.remove('sung');
                    } else {
                        wordEl.classList.remove('active', 'sung');
                    }
                });
            }
        }
    }
}

function handleYouTubeAutoPauseBypass() {

    const promoSelectors = [
        'ytmusic-mealbar-promo-renderer',
        'ytmusic-mealbar-promotion-renderer',
        'ytmusic-banner-promo-renderer',
        'ytmusic-statement-banner-renderer',
        'ytmusic-app-install-banner-renderer',
        '#mealbar-promo-renderer',
        'tp-yt-paper-dialog:has(ytmusic-mealbar-promo-renderer)',
        'tp-yt-paper-dialog:has(ytmusic-mealbar-promotion-renderer)',
        'tp-yt-paper-dialog:has(ytmusic-you-there-renderer)'
    ];
    document.querySelectorAll(promoSelectors.join(', ')).forEach(el => el.remove());

    const youTherePopup = document.querySelector('ytmusic-you-there-renderer, tp-yt-paper-dialog:has(ytmusic-you-there-renderer), #you-there-renderer');
    if (youTherePopup) {
        const confirmBtn = youTherePopup.querySelector('#button, tp-yt-paper-button, button, #confirm-button, .ytmusic-you-there-renderer #button');
        if (confirmBtn) {
            confirmBtn.click();
        } else {
            youTherePopup.remove();
        }

        const videoElement = document.querySelector('video');
        if (videoElement && videoElement.paused) {
            videoElement.play().catch(() => { });
        }
    }
}

document.addEventListener('pause', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
        setTimeout(handleYouTubeAutoPauseBypass, 150);
    }
}, true);

async function withHiddenMenu(worker) {
    const bar = document.querySelector('ytmusic-player-bar');
    const menuButton = bar?.querySelector('ytmusic-menu-renderer #button-shape button') || bar?.querySelector('ytmusic-menu-renderer button');
    if (!menuButton) return false;
    const veil = document.createElement('style');
    veil.textContent = 'ytmusic-popup-container { opacity: 0 !important; pointer-events: none !important; }';
    document.head.append(veil);
    try {
        menuButton.click();
        for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const result = worker();
            if (result != null) return result;
        }
        return false;
    } finally {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.body.click();
        setTimeout(() => veil.remove(), 250);
    }
}

function startRadio() {
    const triggerOpenQueue = () => {
        isQueueViewOpen = true;
        closeAllPanelsExcept('queue');
        const qContainer = pipWindow?.document?.getElementById('queue-container');
        const qToggleBtn = pipWindow?.document?.getElementById('queue-toggle-btn');
        const qStatus = pipWindow?.document?.getElementById('queue-status');
        const rootEl = pipWindow?.document?.querySelector('.mini-player');
        if (qContainer) qContainer.classList.remove('hide');
        if (rootEl) rootEl.classList.add('queue-mode');
        if (qToggleBtn) qToggleBtn.classList.add('active');
        if (qStatus) {
            qStatus.textContent = 'Loading queue...';
            qStatus.classList.remove('hide');
        }
        adjustPipWindowHeight(true);
        const retryDelays = [200, 600, 1200, 2000, 3200];
        retryDelays.forEach(ms => setTimeout(() => {
            if (isQueueViewOpen) renderQueuePanel();
        }, ms));
    };

    return withHiddenMenu(() => {
        const link = document.querySelector('ytmusic-menu-navigation-item-renderer a[href*="list=RD"]');
        if (!link) return null;
        const id = getCurrentVideoId();
        if (id && !link.getAttribute('href')?.includes(id)) return null;
        link.click();
        return true;
    }).then((ok) => {
        if (!ok) {
            const vid = getCurrentVideoId();
            if (vid) {
                const app = document.querySelector('ytmusic-app');
                if (app) {
                    const endpoint = {
                        watchEndpoint: {
                            videoId: vid,
                            playlistId: 'RD' + vid
                        }
                    };
                    app.dispatchEvent(new CustomEvent('yt-navigate', {
                        bubbles: true,
                        composed: true,
                        detail: { endpoint }
                    }));
                }
            }
        }
        triggerOpenQueue();
    });
}

