# Lyra Mini Player - Responsive Layout Modes Architecture

This document serves as the single source of truth for all layout modes, Container Query breakpoints, and dimensions used across `miniplayer.css` and `src/index.js`.

---

## Architecture Overview

Lyra utilizes **CSS Container Queries** (`container-type: size; container-name: player`) anchored on `#mini-player-root`, combined with an adaptive sizing engine in `src/index.js` (`updateCoverSize`).

```
+--------------------------------------------------------------------------+
|                            #mini-player-root                             |
|                                                                          |
|   +------------------------------------------------------------------+   |
|   |                        .player-container                         |   |
|   |                                                                  |   |
|   |   +----------------------------------------------------------+   |   |
|   |   |                       .top-section                       |   |   |
|   |   |     +------------------+     +-----------------------+   |   |   |
|   |   |     |  .cover-wrapper  |     |      .song-info       |   |   |   |
|   |   |     +------------------+     +-----------------------+   |   |   |
|   |   +----------------------------------------------------------+   |   |
|   |                                                                  |   |
|   |   +----------------------------------------------------------+   |   |
|   |   |           .middle-section (.controls: max 7 btns)        |   |   |
|   |   +----------------------------------------------------------+   |   |
|   |                                                                  |   |
|   |   +----------------------------------------------------------+   |   |
|   |   |           .bottom-section (.progress-container)          |   |   |
|   |   +----------------------------------------------------------+   |   |
|   +------------------------------------------------------------------+   |
|                                                                          |
|   [Overlay Panels]: #lyrics-container | #queue-container | #playlist-list|
+--------------------------------------------------------------------------+
```

---

## Layout Modes Breakdown

### Mode 1: Compact Horizontal Strip
* **Condition:** `max-height: 99px`
* **Trigger in JS:** `h < 100`
* **CSS Selector:** `@container player (max-height: 99px)`
* **Layout Structure:**
  - **Narrow (`width < 380px`):**
    - Normal state: Cover on left, Song Info on right.
    - Hover state: Song Info hides, Controls bar displays centered with capped `max-width: 260px`.
  - **Wide (`width >= 380px`):**
    - Cover on left, Song Info in the middle (`flex: 1 1 auto; overflow: hidden`), Controls on right (`max-width: 260px`). All displayed simultaneously without needing hover.
* **Cover Sizing Formula:**
  - `side = Math.max(0, h - 8)`
  - Cover Border Radius: `8px`.
* **Behavior with Panels:**
  - If Lyrics view was open and height shrinks below 100px, Lyrics mode automatically hides and sets `wasLyricsViewOpenBeforeShrinking = true`.

---

### Mode 2: Medium Compact (Stack Top + Controls Bottom / 2-Column Wide)
* **Condition:** `100px <= height <= 179px`
* **Trigger in JS:** `100 <= h < 180`
* **CSS Selector:** `@container player (min-height: 100px) and (max-height: 179px)`
* **Layout Structure:**
  - **Narrow (`width < 360px`):**
    - `.player-container`: `flex-direction: column; justify-content: center; align-items: center; gap: 4px;`
    - Top row: Cover on left, centered Song Info on right.
    - Middle row: Controls bar expands naturally across the window width (`width: 100%`), filling space under the cover cleanly without gaps.
    - Bottom row: Progress bar spans full width (`width: 100%`).
  - **Wide (`width >= 360px`):**
    - 2-Column CSS Grid (`auto 1fr`, `column-gap: 14px`):
      - Column 1 (Left, `auto`): Cover fits its exact square dimensions (`side = Math.max(32, h - 12)`), 1:1 aspect ratio (`grid-row: 1 / 6`), leaving zero wasted space.
      - Column 2 (Right, `1fr`): Takes all remaining horizontal window width, containing Song Info (`max-width: 100%`, preventing truncation), Controls bar (middle, max-width 260px), and Progress bar (bottom, max-width 260px).
* **Cover Sizing Formula:**
  - Narrow (`w < 360px`): `overhead = 12 + controls.offsetHeight + progress.offsetHeight + 6; side = Math.max(32, h - overhead)`
  - Wide (`w >= 360px`): `side = Math.max(32, h - 12)` (fills available height)
  - Cover Border Radius: `8px`.

---

### Mode 3: Standard Full Player (Portrait / Large Window)
* **Condition:** `height >= 180px` (When Panels/Lyrics are OFF, or `width < 360px`)
* **Trigger in JS:** `h >= 180`
* **CSS Selector:** `@container player (min-height: 180px)`
* **Layout Structure:**
  - `.player-container`: `flex-direction: column; justify-content: center; align-items: center; padding: 6px 12px 6px; gap: 4px;`
  - `.top-section`: `flex-direction: column; align-items: center; justify-content: center; gap: 6px; width: 100%; max-width: 260px;`
  - `.cover-wrapper`: Centered hero visual (`max-width: min(260px, 54cqh); max-height: min(260px, 54cqh)`).
  - `.cover`: Border radius `12px`, elevated drop shadow (`0 8px 24px rgba(0, 0, 0, 0.4)`).
  - `.song-info`: Centered title (14px) and artist (11px) below the cover.
  - `.middle-section` & `.bottom-section`: Centered below info (`max-width: 260px`).
* **Cover Sizing Formula:**
  - `overhead = 12 + songInfo (38) + controls (28) + progress (10) + 18 = ~106px`
  - Baseline size: `side = Math.min(260, Math.round(h * 0.54), w - 24, availableHeight)`

---

### Panels View: Unified 2-Column Mode (Lyrics, Queue, Playlist, Search) (All heights >= 100px)
* **Condition:** `height >= 100px` AND `width >= 360px` AND (`#mini-player-root.lyrics-mode`, `.queue-mode`, `.playlist-mode`, or `.search-mode`)
* **Trigger in JS:** `isPanelOpen && w >= 360` (where `isPanelOpen = isLyricsViewOpen || isQueueViewOpen || isPlaylistViewOpen || isSearchViewOpen`)
* **CSS Selector:** `@container player (min-width: 360px)` on `.lyrics-mode`, `.queue-mode`, `.playlist-mode`, `.search-mode`
* **Layout Structure:**
  - **Mode 2 Panels (`100px <= height <= 179px`):**
    - **Left Section (`auto`):** Full-height artwork cover (`side = Math.max(32, h - 12)`), 1:1 aspect ratio, centered.
    - **Right Section (`1fr`):**
      - Top area: Active panel (`#lyrics-container`, `#queue-container`, `#playlist-container`, or `#search-container`, `grid-row: 1`) filling remaining width.
      - Bottom area: Controls bar (`middle-section`, max-width 260px) and Progress bar (`bottom-section`, max-width 260px).
      - Song info is hidden (`display: none !important;`). Closing the panel reveals song info in place of the panel.
  - **Mode 3 Panels (`height >= 180px`):**
    - **Left Section (50%):** Stack containing Cover, Song Info (title 13.5px, artist 11px), Controls bar, and Progress bar, all centered vertically.
    - **Right Section (50%):** Full-height active panel (100% height) with scrollable items/lyrics.

---

## Special Video / MV Mode
* **Trigger:** Video/MV detected in YouTube Music (`isMvMode = true`).
* **Aspect Ratio:** 16:9 (`1.777`) instead of 1:1.
* **Cover Wrapper Calculation:**
  ```javascript
  const maxW = Math.min(w - 20, Math.round(side * 1.6));
  const targetW = maxW;
  const targetH = Math.round(targetW / 1.777);
  wrapper.style.width = targetW + 'px';
  wrapper.style.height = targetH + 'px';
  ```

---

## Reference Constants (`src/config/constants.js`)

| Constant | Value | Description |
| :--- | :--- | :--- |
| `SLOT_PRIORITY_RANK` | `[6, 4, 1, 2, 3, 5, 7]` | Control buttons priority ranking when width collapses |
| `BTN_WIDTH` | `28px` | Average width per control button for responsive culling |
| `COMPACT_COVER_GAP` | `8px` | Gap between cover and info in compact mode |
| `COMPACT_PADDING_OFFSET` | `12px` | Horizontal padding offset in compact mode |
| `NORMAL_PADDING_OFFSET` | `16px` | Horizontal padding offset in normal mode |
| `LYRICS_PADDING_OFFSET` | `20px` | Horizontal padding deduction in side-by-side mode |
| `LYRICS_MIN_LAYOUT_WIDTH` | `360px` | Minimum width threshold for side-by-side lyrics |

---

## Maintenance Guidelines

1. **Avoid Layout Thrashing:**
   When editing `updateCoverSize()`, ensure all DOM reads (`offsetHeight`, `offsetWidth`) are grouped together **before** writing styles (`wrapper.style.width = ...`).
2. **Container Queries Over Media Queries:**
   Always use `@container player (...)` instead of `@media (...)` because PiP window styling must respond to the PiP root container size, not the screen viewport.
3. **Cover Upper Cap:**
   Ensure `Mode 3` enforces `max-width: min(280px, 55cqh)` so that high-resolution displays or large PiP windows do not blow up the cover image disproportionately.
4. **Active Button Protection (Anti-Culling):**
   If any control button is active (e.g., active panel toggle like playlist/queue/search/lyrics or feature toggle like shuffle/repeat/like), it is prioritized ahead of inactive buttons so it never disappears when width collapses. Culling bypasses active buttons and drops the lowest-priority inactive button instead.
