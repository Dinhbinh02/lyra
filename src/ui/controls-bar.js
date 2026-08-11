import { SLOT_PRIORITY_RANK, BTN_WIDTH } from '../config/constants.js';

export function computeSelectedControlSlots(containerWidth, customControlsPriority) {
    const activeSlots = [];
    customControlsPriority.forEach((btnId, slotIdx) => {
        if (btnId !== null) {
            activeSlots.push({
                btnId: btnId,
                slotIdx: slotIdx,
                rank: SLOT_PRIORITY_RANK[slotIdx] || 99
            });
        }
    });

    let allowedOptionalCount = Math.floor(containerWidth / BTN_WIDTH);
    allowedOptionalCount = Math.max(1, Math.min(allowedOptionalCount, activeSlots.length, 12));

    const sortedByPriority = [...activeSlots].sort((a, b) => a.rank - b.rank);
    const selectedSlots = sortedByPriority.slice(0, allowedOptionalCount);

    selectedSlots.sort((a, b) => a.slotIdx - b.slotIdx);
    return selectedSlots;
}

export function renderControlsDiff(controlsContainer, selectedSlots, root, pipWindow) {
    if (!controlsContainer || !pipWindow || !pipWindow.document) return;

    const currentKeys = selectedSlots.map(s => s.btnId).join(',');
    if (controlsContainer._lastRenderedKeys === currentKeys) return;

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
