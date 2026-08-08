document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href) {
                if (href.startsWith('mailto:')) {
                    const email = href.replace('mailto:', '');
                    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
                    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                        chrome.tabs.create({ url: gmailUrl });
                    } else {
                        window.open(gmailUrl, '_blank');
                    }
                } else {
                    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                        chrome.tabs.create({ url: href });
                    } else {
                        window.open(href, '_blank');
                    }
                }
            }
        });
    });

    // Toolbar Customization logic
    const availableItems = document.querySelectorAll('.available-item');
    const optionalSlots = document.querySelectorAll('.optional-slot');
    
    // Map IDs to display custom SVGs in the active slots
    const iconMap = {
        repeat: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 1 21 5 17 9"></polyline>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
            <polyline points="7 23 3 19 7 15"></polyline>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>`,
        shuffle: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
        </svg>`,
        mute: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>`,
        like: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
        </svg>`,
        dislike: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path>
        </svg>`,
        rewind: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0-.57-8.38l5.67-5.67"></path>
        </svg>`,
        forward: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1 .57-8.38l-5.67-5.67"></path>
        </svg>`,
        speed: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
        </svg>`,
        lyrics: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
        </svg>`,
        queue: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>`,
        playlist: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15V6"></path>
            <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"></path>
            <line x1="12" y1="12" x2="3" y2="12"></line>
            <line x1="16" y1="6" x2="3" y2="6"></line>
            <line x1="12" y1="18" x2="3" y2="18"></line>
        </svg>`,
        prev: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="19 20 9 12 19 4 19 20"></polygon>
            <line x1="5" y1="19" x2="5" y2="5"></line>
        </svg>`,
        play: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6 3 20 12 6 21"></polygon>
        </svg>`,
        next: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"></polygon>
            <line x1="19" y1="5" x2="19" y2="19"></line>
        </svg>`,
        radio: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16.247 7.761a6 6 0 0 1 0 8.478"></path>
            <path d="M19.075 4.933a10 10 0 0 1 0 14.134"></path>
            <path d="M4.925 19.067a10 10 0 0 1 0-14.134"></path>
            <path d="M7.753 16.239a6 6 0 0 1 0-8.478"></path>
            <circle cx="12" cy="12" r="2"></circle>
        </svg>`,
        search: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>`
    };

    // Default configuration: first few options pre-filled (5 buttons, 2 empty slots: first and last)
    const defaultButtons = [null, 'repeat', 'prev', 'play', 'next', 'lyrics', null];
    let activeButtons = [null, null, null, null, null, null, null];

    function saveConfig() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ customControls: activeButtons });
        }
    }

    const hardcodedPlaceholders = [6, 4, 1, 2, 3, 5, 7];

    function renderToolbar() {
        optionalSlots.forEach((slot, index) => {
            const isMiddle = index === 2 || index === 3 || index === 4;
            slot.className = isMiddle ? 'slot optional-slot middle-slot' : 'slot optional-slot';
            slot.innerHTML = `<span class="placeholder-num">${hardcodedPlaceholders[index]}</span>`;
            slot.onclick = null;
            slot.style.opacity = '';
        });

        availableItems.forEach(item => {
            item.classList.remove('disabled');
            item.style.opacity = '';
        });

        // Fill slots based on activeButtons list
        activeButtons.forEach((btnId, index) => {
            if (index < optionalSlots.length) {
                const slot = optionalSlots[index];
                if (btnId) {
                    slot.className = 'slot filled';
                    slot.innerHTML = `
                        ${iconMap[btnId]}
                        <div class="slot-remove"><span>x</span></div>
                    `;
                    // Click on the slot to remove the button
                    slot.onclick = () => removeButton(index);
                    
                    // Disable it in the available list so it can't be added twice
                    const availableItem = document.querySelector(`.available-item[data-id="${btnId}"]`);
                    if (availableItem) {
                        availableItem.classList.add('disabled');
                    }
                }
            }
        });
    }

    // Implement HTML5 Drag and Drop with live hover swapping
    let draggedBtnId = null;
    let draggedFromSlotIdx = null;
    let originalButtonsState = null;
    let lastHoveredSlotIdx = null;

    // Make available items draggable
    availableItems.forEach(item => {
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', (e) => {
            if (item.classList.contains('disabled')) {
                e.preventDefault();
                return;
            }
            draggedBtnId = item.getAttribute('data-id');
            draggedFromSlotIdx = null;
            originalButtonsState = [...activeButtons];
            lastHoveredSlotIdx = null;
            item.style.opacity = '0.4';
            document.body.classList.add('dragging-active');
        });
        item.addEventListener('dragend', () => {
            item.style.opacity = '';
            if (originalButtonsState) {
                activeButtons = [...originalButtonsState];
            }
            renderToolbar();
            draggedBtnId = null;
            draggedFromSlotIdx = null;
            originalButtonsState = null;
            lastHoveredSlotIdx = null;
            document.body.classList.remove('dragging-active');
        });
    });

    optionalSlots.forEach((slot, index) => {
        slot.setAttribute('draggable', 'true');
        
        slot.addEventListener('dragstart', (e) => {
            if (!activeButtons[index]) {
                e.preventDefault();
                return;
            }
            draggedBtnId = activeButtons[index];
            draggedFromSlotIdx = index;
            originalButtonsState = [...activeButtons];
            lastHoveredSlotIdx = index;
            slot.style.opacity = '0.4';
            document.body.classList.add('dragging-active');
        });

        slot.addEventListener('dragend', () => {
            slot.style.opacity = '';
            if (originalButtonsState) {
                activeButtons = [...originalButtonsState];
            }
            renderToolbar();
            draggedBtnId = null;
            draggedFromSlotIdx = null;
            originalButtonsState = null;
            lastHoveredSlotIdx = null;
            document.body.classList.remove('dragging-active');
        });

        slot.addEventListener('dragover', (e) => {
            e.preventDefault();

            if (!draggedBtnId) return;

            if (index !== lastHoveredSlotIdx) {
                lastHoveredSlotIdx = index;
                
                activeButtons = [...originalButtonsState];

                if (draggedFromSlotIdx !== null) {
                    const temp = activeButtons[index];
                    activeButtons[index] = draggedBtnId;
                    activeButtons[draggedFromSlotIdx] = temp;
                } else {
                    activeButtons[index] = draggedBtnId;
                }

                renderToolbar();
                
                const targetSlot = optionalSlots[index];
                if (targetSlot) targetSlot.style.opacity = '0.4';
            }

            optionalSlots[index].classList.add('drag-over');
        });

        slot.addEventListener('dragleave', (e) => {
            slot.classList.remove('drag-over');
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');

            if (!draggedBtnId) return;

            // Commit change
            originalButtonsState = null; // Don't revert on dragend
            saveConfig();
            renderToolbar();

            draggedBtnId = null;
            draggedFromSlotIdx = null;
            lastHoveredSlotIdx = null;
            document.body.classList.remove('dragging-active');
        });
    });

    function addButton(btnId) {
        if (activeButtons.includes(btnId)) return;
        let bestIndex = -1;
        let minPriorityNum = Infinity;
        activeButtons.forEach((b, idx) => {
            if (b === null) {
                const priorityNum = hardcodedPlaceholders[idx];
                if (priorityNum < minPriorityNum) {
                    minPriorityNum = priorityNum;
                    bestIndex = idx;
                }
            }
        });
        if (bestIndex !== -1) {
            activeButtons[bestIndex] = btnId;
            saveConfig();
            renderToolbar();
        }
    }

    function removeButton(index) {
        if (index >= 0 && index < activeButtons.length) {
            activeButtons[index] = null;
            saveConfig();
            renderToolbar();
        }
    }

    // Attach click events to available list items
    availableItems.forEach(item => {
        item.addEventListener('click', () => {
            const btnId = item.getAttribute('data-id');
            if (btnId && !item.classList.contains('disabled')) {
                addButton(btnId);
            }
        });
    });

    // Settings panel toggle
    const settingsToggleBtn = document.getElementById('settings-toggle-btn');
    const customizationSection = document.getElementById('toolbar-customization-section');
    const howToUseSection = document.getElementById('main-how-to-use-section');
    const footerTipsSection = document.getElementById('main-footer-tips');
    
    if (settingsToggleBtn && customizationSection) {
        settingsToggleBtn.addEventListener('click', () => {
            const isHidden = customizationSection.classList.contains('hide');
            if (isHidden) {
                customizationSection.classList.remove('hide');
                settingsToggleBtn.classList.add('active');
                if (howToUseSection) howToUseSection.classList.add('hide');
                if (footerTipsSection) footerTipsSection.classList.add('hide');
            } else {
                customizationSection.classList.add('hide');
                settingsToggleBtn.classList.remove('active');
                if (howToUseSection) howToUseSection.classList.remove('hide');
                if (footerTipsSection) footerTipsSection.classList.remove('hide');
            }
        });
    }

    // Background & Animation Settings
    const brightnessSlider = document.getElementById('bg-brightness-slider');
    const brightnessVal = document.getElementById('bg-brightness-val');
    const blurSlider = document.getElementById('bg-blur-slider');
    const blurVal = document.getElementById('bg-blur-val');
    const speedSlider = document.getElementById('bg-speed-slider');
    const speedVal = document.getElementById('bg-speed-val');

    function updateBrightnessUI(val) {
        if (brightnessSlider) brightnessSlider.value = val;
        if (brightnessVal) brightnessVal.textContent = `${val}%`;
    }

    function updateBlurUI(val) {
        if (blurSlider) blurSlider.value = val;
        if (blurVal) blurVal.textContent = `${val}%`;
    }

    function updateSpeedUI(val) {
        if (speedSlider) speedSlider.value = val;
        if (speedVal) speedVal.textContent = `${(val / 10).toFixed(1)}x`;
    }

    if (brightnessSlider) {
        brightnessSlider.addEventListener('input', (e) => {
            let val = parseInt(e.target.value, 10);
            if (isNaN(val)) val = 120;
            val = Math.max(20, Math.min(150, val));
            updateBrightnessUI(val);
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ bgBrightness: val });
            }
        });
    }

    if (blurSlider) {
        blurSlider.addEventListener('input', (e) => {
            let val = parseInt(e.target.value, 10);
            if (isNaN(val)) val = 90;
            val = Math.max(70, Math.min(150, val));
            updateBlurUI(val);
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ bgBlur: val });
            }
        });
    }

    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            let val = parseInt(e.target.value, 10);
            if (isNaN(val)) val = 15;
            val = Math.max(0, Math.min(30, val));
            updateSpeedUI(val);
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ bgSpeed: val / 10 });
            }
        });
    }

    // Load saved configuration from storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['customControls', 'bgBrightness', 'bgBlur', 'bgSpeed'], (result) => {
            if (result && result.customControls && Array.isArray(result.customControls)) {
                activeButtons = [null, null, null, null, null, null, null];
                result.customControls.forEach((btn, idx) => {
                    if (idx < 7) activeButtons[idx] = btn;
                });
            } else {
                activeButtons = [...defaultButtons];
            }
            renderToolbar();

            const savedBrightness = result?.bgBrightness !== undefined ? result.bgBrightness : 120;
            updateBrightnessUI(savedBrightness);

            const savedBlur = result?.bgBlur !== undefined ? result.bgBlur : 90;
            updateBlurUI(savedBlur);

            const savedSpeed = result?.bgSpeed !== undefined ? Math.round(result.bgSpeed * 10) : 15;
            updateSpeedUI(savedSpeed);
        });
    } else {
        activeButtons = [...defaultButtons];
        renderToolbar();
    }

    // Attach click events to reset background button
    const resetBgBtn = document.getElementById('reset-bg-btn');
    if (resetBgBtn) {
        resetBgBtn.addEventListener('click', () => {
            updateBrightnessUI(120);
            updateBlurUI(90);
            updateSpeedUI(15);
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                    bgBrightness: 120,
                    bgBlur: 90,
                    bgSpeed: 1.5
                });
            }
        });
    }

    // Attach click events to reset layout button
    const resetLayoutBtn = document.getElementById('reset-layout-btn');
    if (resetLayoutBtn) {
        resetLayoutBtn.addEventListener('click', () => {
            activeButtons = [...defaultButtons];
            saveConfig();
            renderToolbar();
        });
    }
});
