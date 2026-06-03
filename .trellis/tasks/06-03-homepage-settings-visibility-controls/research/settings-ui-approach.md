# Linux.do Settings UI Approach

## Findings

- The content script mounts a Vue app from `src/contentScripts/views/App.vue` into a shadow root via `src/contentScripts/index.ts`.
- Persistent settings should use `useStorageLocal` backed by `browser.storage.local`; `src/manifest.ts` already grants `storage` permission.
- Existing UI primitives include `Button`, `Dialog`, `Radio`, `SettingsItem`, and `SettingsItemGroup`.
- Linux.do homepage cleanup is centralized in `src/sites/linuxDo.ts`; tests live in `src/tests/linuxDoMigration.spec.ts`.
- Trellis frontend specs require Vue 3 `<script setup>`, scoped SCSS/UnoCSS, semantic interactive elements, and tests for Linux.do cleanup behavior.

## Feasible approaches

### Approach A: Linux.do-specific persisted settings key (recommended)

Store a small Linux.do settings object such as `{ pluginEnabled, hideGuidelineBanner, hidePinnedTopics }` under a new `useStorageLocal` key, render a floating button/modal in the Linux.do content-script app, and pass settings into cleanup/click handlers.

Pros:
- Keeps migrated Linux.do behavior isolated from legacy Bilibili `Settings` shape.
- Avoids expanding the large legacy settings UI and translation surface.
- Easy to test with pure DOM/unit tests and component behavior boundaries.

Cons:
- Adds one new settings model rather than reusing the existing monolithic `settings` object.

### Approach B: Extend legacy `Settings`

Add Linux.do fields to `src/logic/storage.ts` `Settings` and reuse the central `settings` object.

Pros:
- Reuses existing settings persistence pattern exactly.

Cons:
- Mixes Linux.do-only controls into legacy Bilibili settings schema.
- Increases coupling to UI/settings surfaces that are not currently mounted for the migrated Linux.do content script.

### Approach C: Browser action/options page

Restore/enable extension action or options page and put settings there.

Pros:
- Familiar extension settings location.

Cons:
- Larger manifest/build/UI scope and slower than requested floating in-page control.
- Does not directly satisfy “增加一个悬浮的设置按钮” as the primary entry point.

## Recommendation

Use Approach A: add a Linux.do-specific persistent settings object and a small floating in-page settings panel in the existing content-script Vue app. Defaults should preserve current intended behavior: plugin enabled, guideline banner hiding enabled, pinned topic hiding enabled.
