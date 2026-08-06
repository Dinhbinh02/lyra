
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
    titleHtml.textContent = currentSongInfo.title == null || currentSongInfo.title === "" ? "Lyra Player" : currentSongInfo.title;
    artistHtml.textContent = currentSongInfo.artist == null || currentSongInfo.artist.trim().replace(/(\r\n|\n|\r)/gm, "") === "" ? "Select a song to start" : currentSongInfo.artist;

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

    if (currentSongInfo.highResUrl && currentSongInfo.highResUrl !== fastUrl && currentSongInfo.preloadingUrl !== currentSongInfo.highResUrl) {
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

    if (volumeSlider) {
        volumeSlider.value = currentSongInfo.volume;
    }

    if (volumeSliderPopup) {
        volumeSliderPopup.value = currentSongInfo.volume;
    }

    if (isLyricsViewOpen && currentSongInfo.title && currentSongInfo.artist) {
        const key = `${currentSongInfo.title}-${currentSongInfo.artist}`;
        if (currentLyricsSongKey !== key) {
            fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);
        }
    }
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
    volumeSlider = volumeSlider == null ? pipWindow.document.getElementById('volume-slider') : volumeSlider;
    volumeSliderPopup = volumeSliderPopup == null ? pipWindow.document.getElementById('volume-slider-popup') : volumeSliderPopup;

    const playPauseBtn = pipWindow.document.querySelector('.play-pause');
    const previousBtn = pipWindow.document.querySelector('.prev');
    const nextBtn = pipWindow.document.querySelector('.next');
    shuffleHtml = pipWindow.document.querySelector('.shuffle');
    const addToPlaylistBtn = pipWindow.document.getElementById('add-to-playlist');

    playPauseBtn.addEventListener('click', () => {
        const ytPlayPauseBtn = document.querySelector('.play-pause-button.style-scope.ytmusic-player-bar');
        if (ytPlayPauseBtn) {
            ytPlayPauseBtn.click();
            triggerFastRefresh();
        }
    });

    previousBtn.addEventListener('click', () => {
        const ytPreviousBtn = document.querySelector('.previous-button.style-scope.ytmusic-player-bar');
        if (ytPreviousBtn) {
            ytPreviousBtn.click();
            triggerFastRefresh();
        }
    });

    nextBtn.addEventListener('click', () => {
        const ytNextBtn = document.querySelector('.next-button.style-scope.ytmusic-player-bar');
        if (ytNextBtn) {
            ytNextBtn.click();
            triggerFastRefresh();
        }
    });

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
            const ytShuffleBtn = document.querySelector('.shuffle.style-scope.ytmusic-player-bar');
            if (ytShuffleBtn) {
                ytShuffleBtn.click();
            }
        });
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

    addToPlaylistBtn.addEventListener('click', () => {
        if (currentSongInfo.title == null || currentSongInfo.title === '') {
            return;
        }
        try {
            chrome.runtime.sendMessage({ action: "addToPlaylist" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error sending message to background script:", chrome.runtime.lastError);
                    return;
                }

                if (!response || !response.success) {
                    console.error("Could not complete the 'Add to playlist' action on YouTube Music:",
                        response ? response.reason || "Unknown reason" : "No response");

                    if (response && response.reason && response.reason !== "No YouTube Music tab found") {
                        alert("There was a problem trying to interact with YouTube Music. Please try opening YouTube Music first.");
                    }
                }
            });
        } catch (error) {
        }
    });

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
    const miniPlayerRoot = pipWindow.document.getElementById('mini-player-root');
    if (lyricsToggleBtn && lyricsContainer && miniPlayerRoot) {
        lyricsToggleBtn.addEventListener('click', () => {
            const currentH = miniPlayerRoot.offsetHeight || pipWindow.innerHeight;
            if (!isLyricsViewOpen && currentH < 100) {
                triggerShake(lyricsToggleBtn);
                return;
            }

            isLyricsViewOpen = !isLyricsViewOpen;
            wasLyricsViewOpenBeforeShrinking = false;
            if (isLyricsViewOpen) {
                lyricsContainer.classList.remove('hide');
                miniPlayerRoot.classList.add('lyrics-mode');
                lyricsToggleBtn.classList.add('active');
                if (currentLyricsSongKey !== `${currentSongInfo.title}-${currentSongInfo.artist}`) {
                    fetchSyncedLyrics(currentSongInfo.title, currentSongInfo.artist);
                }
                startLyricsAnimLoop();
            } else {
                lyricsContainer.classList.add('hide');
                miniPlayerRoot.classList.remove('lyrics-mode');
                lyricsToggleBtn.classList.remove('active');
                if (animFrameId && pipWindow) {
                    pipWindow.cancelAnimationFrame(animFrameId);
                    animFrameId = null;
                }
            }
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
            .replace(/=s\d+(-[a-z0-9-]+)?/gi, '=s1200-l90-rj');
    }
    if (url.includes('ytimg.com')) {
        url = url.replace(/(hqdefault|mqdefault|sddefault|default)\.jpg/gi, 'maxresdefault.jpg');
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

    const playPauseButton = document.getElementById('play-pause-button')
    let state = playPauseButton ? playPauseButton.getAttribute('aria-label') : null;
    if (state == null && playPauseButton) {
        state = playPauseButton.getAttribute('title');
    }
    if (state) {
        isPlaying = state.toLowerCase() === 'reproducir' || state.toLowerCase() === 'play';
        isPlaying = !isPlaying;
    }

    const repeatButton = document.querySelector('.repeat.style-scope.ytmusic-player-bar');
    if (repeatButton) {
        let currentMode = repeatButton.getAttribute('aria-label') || repeatButton.getAttribute('title') || '';
        if (currentMode.toLowerCase().includes('repeat off') || currentMode.toLowerCase().includes('desactivar')) {
            repeatMode = 0;
        } else if (currentMode.toLowerCase().includes('repeat all') || currentMode.toLowerCase().includes('todo')) {
            repeatMode = 1;
        } else if (currentMode.toLowerCase().includes('repeat one') || currentMode.toLowerCase().includes('una vez')) {
            repeatMode = 2;
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

registerMediaSessionPipHandler();

let lastSavedW = null;
let lastSavedH = null;

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
    if (!pipWindow || pipWindow.closed) return;
    const w = Math.max(150, Math.round(pipWindow.outerWidth || pipWindow.innerWidth));
    const h = Math.max(80, Math.round(pipWindow.outerHeight || pipWindow.innerHeight));

    if (w > 0 && h > 0 && (w !== lastSavedW || h !== lastSavedH)) {
        lastSavedW = w;
        lastSavedH = h;
        const sizeData = { pipWidth: w, pipHeight: h };
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
            const initialWidth = savedSize.pipWidth || 275;
            const initialHeight = savedSize.pipHeight || 102;

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

                // Calculate constant linear speed duration based on container diagonal (0.07 = faster rotation)
                const diagonal = Math.sqrt(w * w + h * h);
                const baseDuration = (diagonal * 0.07).toFixed(2);
                root.style.setProperty('--bg-duration-base', `${baseDuration}s`);

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

            updateCoverSize();
            const coverResizeObserver = new pipWindow.ResizeObserver(throttledUpdateCoverSize);
            coverResizeObserver.observe(pipWindow.document.getElementById('mini-player-root'));

            let update = setInterval(async () => {
                if (!pipWindow || pipWindow.closed) {
                    clearInterval(update);
                    coverResizeObserver.disconnect();
                    pipWindow = null;
                    return;
                }
                await extractSongInfo();
                setValues();
            }, 250);

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
let currentActiveLineIndex = -1;
let isLyricsViewOpen = false;
let wasLyricsViewOpenBeforeShrinking = false;
let lastSyncedTime = 0;
let lastSyncTimestamp = 0;

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

async function fetchSyncedLyrics(title, artist) {
    const key = `${title}-${artist}`;
    if (currentLyricsSongKey === key) return;
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

    const headers = {
        'Lrclib-Client': 'Star_s YTM v1.0.0 (https://github.com/star-ytm)'
    };

    const cleanTitle = title.replace(/\(feat\..*?\)/i, '').replace(/\[.*?\]/g, '').replace(/\(Official.*?\)/i, '').trim();
    const artistParts = artist.split(/[,&•]|\bft\.\b|\bfeat\.\b/i).map(a => a.trim()).filter(Boolean);
    const primaryArtist = artistParts[0] || artist.split('•')[0].split(',')[0].trim();
    const durationSec = Math.round(currentSongInfo.duration || 0);

    try {
        let params = `track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
        if (durationSec > 0) {
            params += `&duration=${durationSec}`;
        }

        let response = await fetch(`https://lrclib.net/api/get?${params}`, { headers });

        if (!response.ok && durationSec > 0) {
            response = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`, { headers });
        }

        if (response.ok) {
            const data = await response.json();
            currentLyricsSource = 'Source: LRCLIB';
            if (processLyricsData(data)) return;
        }

        for (const part of artistParts) {
            const searchResponse = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(part)}`, { headers });
            if (searchResponse.ok) {
                const searchResults = await searchResponse.json();
                if (Array.isArray(searchResults) && searchResults.length > 0) {
                    const syncedMatch = searchResults.find(item => item.syncedLyrics) || searchResults[0];
                    currentLyricsSource = 'Source: LRCLIB';
                    if (processLyricsData(syncedMatch)) return;
                }
            }
        }

        const qResponse = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle + ' ' + primaryArtist)}`, { headers });
        if (qResponse.ok) {
            const qResults = await qResponse.json();
            if (Array.isArray(qResults) && qResults.length > 0) {
                const syncedMatch = qResults.find(item => item.syncedLyrics) || qResults[0];
                currentLyricsSource = 'Source: LRCLIB';
                if (processLyricsData(syncedMatch)) return;
            }
        }
    } catch (e) {
        console.warn('LrcLib fetch error:', e);
    }

    try {
        for (const part of artistParts) {
            const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(part)}/${encodeURIComponent(cleanTitle)}`;
            const ovhRes = await fetch(ovhUrl);
            if (ovhRes.ok) {
                const ovhData = await ovhRes.json();
                if (ovhData && ovhData.lyrics && ovhData.lyrics.trim().length > 0) {
                    currentLyricsSource = 'Source: Lyrics.ovh';
                    if (processLyricsData({ plainLyrics: ovhData.lyrics })) return;
                }
            }
        }
    } catch (e) {
        console.warn('Lyrics.ovh fetch error:', e);
    }

    if (statusEl) statusEl.textContent = 'Lyrics not found (._.)';
}

function processLyricsData(data) {
    if (!data) return false;
    if (data.syncedLyrics && data.syncedLyrics.trim().length > 0) {
        isLyricsSynced = true;
        lyricsData = parseLrc(data.syncedLyrics);
        renderLyricsList();
        return true;
    } else if (data.plainLyrics && data.plainLyrics.trim().length > 0) {
        isLyricsSynced = false;
        const plainLines = data.plainLyrics.split('\n').filter(l => l.trim().length > 0);
        lyricsData = plainLines.map(text => ({ time: null, text }));
        renderLyricsList();
        return true;
    }
    return false;
}

const romanizeCache = new Map();

async function fetchRomanizedText(text) {
    if (!text || !/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u0400-\u04ff]/.test(text)) {
        return null;
    }
    if (romanizeCache.has(text)) {
        return romanizeCache.get(text);
    }
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&dt=rm&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && Array.isArray(data[0])) {
                const romItem = data[0].find(item => Array.isArray(item) && item[3]);
                if (romItem && romItem[3]) {
                    const romanized = romItem[3].trim();
                    romanizeCache.set(text, romanized);
                    return romanized;
                }
            }
        }
    } catch (e) { }
    return null;
}

function renderLyricsList() {
    if (!pipWindow || pipWindow.closed) return;
    const statusEl = pipWindow.document.getElementById('lyrics-status');
    const listEl = pipWindow.document.getElementById('lyrics-list');

    if (!lyricsData || lyricsData.length === 0) {
        if (statusEl) statusEl.textContent = 'Lyrics not found (._.)';
        return;
    }

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

        if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u0400-\u04ff]/.test(item.text)) {
            fetchRomanizedText(item.text).then(romText => {
                if (romText && pipWindow && !pipWindow.closed) {
                    let romEl = vocalsGroup.querySelector('.lyra-romanized');
                    if (!romEl) {
                        romEl = pipWindow.document.createElement('div');
                        romEl.className = 'lyra-romanized';
                        vocalsGroup.appendChild(romEl);
                    }
                    romEl.textContent = romText;
                }
            });
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

function startLyricsAnimLoop() {
    if (animFrameId && pipWindow) {
        pipWindow.cancelAnimationFrame(animFrameId);
        animFrameId = null;
    }
    lastFrameTime = performance.now();

    const video = document.querySelector('video');
    if (video) {
        lastSyncedTime = video.currentTime;
        lastSyncTimestamp = performance.now();
    }

    function loop() {
        if (!pipWindow || pipWindow.closed) return;
        const now = performance.now();
        const deltaTime = Math.min(0.1, (now - lastFrameTime) / 1000);
        lastFrameTime = now;

        const video = document.querySelector('video');
        if (video && isLyricsViewOpen) {
            let currentSongTime = video.currentTime;
            if (!video.paused) {
                const timeSinceSync = (now - lastSyncTimestamp) / 1000;
                currentSongTime = lastSyncedTime + timeSinceSync;
                if (Math.abs(currentSongTime - video.currentTime) > 0.5) {
                    currentSongTime = video.currentTime;
                    lastSyncedTime = video.currentTime;
                    lastSyncTimestamp = now;
                }
            } else {
                lastSyncedTime = video.currentTime;
                lastSyncTimestamp = now;
            }

            updateActiveLyricLine(currentSongTime, deltaTime);
        }
        animFrameId = pipWindow.requestAnimationFrame(loop);
    }
    if (pipWindow) loop();
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

    if (activeIndex !== currentActiveLineIndex) {
        currentActiveLineIndex = activeIndex;

        const allVocals = listEl.querySelectorAll('.lyra-line');
        allVocals.forEach((vocals, index) => {
            if (index === activeIndex) {
                vocals.classList.add('active');
                vocals.classList.remove('sung');
                vocals.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (index < activeIndex) {
                vocals.classList.add('sung');
                vocals.classList.remove('active');
            } else {
                vocals.classList.remove('active', 'sung');
            }
        });
    }

    // Character-by-character (letter-by-letter) spring physics animation for active line
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

// ----------------------------------------------------------------------
// Anti Auto-Pause (Event-Driven: 0% CPU, zero polling)
// ----------------------------------------------------------------------
function handleYouTubeAutoPauseBypass() {
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
            videoElement.play().catch(() => {});
        }
    }
}

// Only trigger when video is paused (0% CPU impact during normal playback)
document.addEventListener('pause', (e) => {
    if (e.target && e.target.tagName === 'VIDEO') {
        setTimeout(handleYouTubeAutoPauseBypass, 150);
    }
}, true);
