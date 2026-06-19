# Scroll-to-top / refresh button above settings (linux.do)

## Goal
Add a floating action button directly above the existing linux.do settings button
(`.linux-do-settings-button` in `src/contentScripts/views/App.vue`).

## Behavior
- When the page is scrolled to the top: show a **refresh** icon. Click → reload the
  current view content (`window.location.reload()`).
- When the page is NOT at the top: show an **up-arrow** icon. Click → smooth-scroll
  back to the top of the window. Once at top, the button reverts to the refresh icon
  (state is derived from scroll position, so this happens automatically).

## Design decisions
- Single-file change in `src/contentScripts/views/App.vue`, following the existing
  `.linux-do-settings-button` fixed-position pattern (right: 18px). New button sits at
  `bottom: 76px` (settings button is 48px tall at bottom: 18px + 10px gap).
- Scroll state tracked via `window.scrollY` with a `useEventListener(window, 'scroll', ...)`
  listener (the project already imports `useEventListener` from `@vueuse/core`). Threshold
  `<= 10px` counts as "at top". Initialize state on mount.
- Icons: `i-mingcute:refresh-2-line` (refresh) and `i-mingcute:arrow-up-line` (back-to-top),
  consistent with existing `i-mingcute:*` usage.
- Hide the new button while the settings panel is open (`v-if="!showSettingsPanel"`) so it
  does not overlap the panel, which also anchors at `bottom: 76px`.
- New i18n labels `refreshPage` and `backToTop` added to all four locale blocks
  (en / cmn-CN / cmn-TW / jyut), inserted alphabetically.

## Out of scope
- Iframe-drawer internal scrolling (drawer manages its own scroll). This button targets the
  main linux.do window only.

## Acceptance
- `pnpm type-check` passes.
- Button renders above settings button, toggles icon by scroll position, refresh reloads,
  arrow scrolls to top.
