# WebDAV Settings UI Research

## Summary

The currently active Linux.do settings surface renders WebDAV configuration inline in `src/contentScripts/views/App.vue`. `src/components/Settings/DataSync/DataSync.vue` is a second, older settings-tree surface. Both expose roughly the same fields and manual actions but use different UI and localization sources.

## Current surfaces and persisted fields

- `src/contentScripts/views/App.vue:698-764` renders the active inline WebDAV form with URL, username, password, remote path, automatic-sync control, connection test, upload, download, last-sync text, per-action loading state, and an `aria-live` status.
- `src/components/Settings/DataSync/DataSync.vue:82-142` renders the older settings-tree WebDAV form with the same main fields and operations.
- `src/components/Settings/Settings.vue:15-23` still registers `DataSync.vue` in that settings tree.
- `src/logic/storage.ts:123-130` defines `webdavEnabled`, `webdavUrl`, `webdavUsername`, `webdavPassword`, `webdavPath`, `webdavAutoSync`, `webdavLastSyncTime`, and `webdavLocalModifiedTime`.
- `src/logic/storage.ts:239-246` defaults WebDAV and automatic sync off, credentials empty, path to `/bewly/settings.json`, and timestamps to `0`.
- `src/logic/storage.ts:264` persists the shared settings object immediately, so current field edits have no draft/save/cancel transaction.

## Current validation and action behavior

- `src/components/Settings/DataSync/DataSync.vue:23-79` requires only a non-empty URL and silently returns otherwise; outcomes use toast notifications.
- `src/contentScripts/views/App.vue:356-423` also requires only a non-empty URL, but reports localized inline status. Test, upload, and download each disable only their own button, so different operations may overlap.
- `src/logic/settingsSync.ts:58-65` falls back to `/bewly/settings.json` when the path is empty.
- `src/logic/settingsSync.ts:77-92` records the last-sync time after upload.
- `src/logic/settingsSync.ts:94-139` immediately applies a valid version-1 downloaded snapshot while preserving local WebDAV configuration fields.
- `src/logic/webdav.ts:92-109` tests the server root with `PROPFIND`; the configured remote file path is not part of connection testing.

## Existing secondary-dialog patterns

### Shared `Dialog.vue`

- `src/components/Dialog.vue:7-25` supports title, description, dimensions, footer, loading, and close prevention while loading.
- `src/components/Dialog.vue:29-39` maps Enter to confirm and Escape to close.
- `src/components/Dialog.vue:75-92` routes backdrop, close control, and cancel through the same close path.
- `src/components/Dialog.vue:95-121` uses Teleport, a backdrop, and a high z-index.
- `src/components/Dialog.vue:187-217` supplies localized cancel/confirm footer actions.
- `src/components/Dialog.vue:95-221` does not currently expose complete dialog accessibility semantics or focus management; its close control is a non-button `div` without an accessible label.
- Nearby settings usages include `src/components/Settings/BewlyPages/Home/Home.vue:234-269`, `src/components/Settings/BewlyPages/Home/Home.vue:437-452`, and `src/components/Settings/About/About.vue:222-257`.

### Active Linux.do custom modal

- `src/contentScripts/views/App.vue:690-696` already opens a blocked-words secondary modal from a button inside the primary settings panel.
- `src/contentScripts/views/App.vue:767-790` gives that modal `role="dialog"`, `aria-modal="true"`, a localized accessible name, backdrop close behavior, and an accessible close button.
- `src/contentScripts/views/App.vue:583-590` closes the blocked-words modal on Escape.
- `.trellis/spec/frontend/component-guidelines.md:261-263` requires localized accessible names for settings dialogs and labels for icon-only buttons.

The active WebDAV UI should reuse the local custom-modal pattern rather than introduce the unrelated settings-tree `Dialog.vue` into the Shadow DOM surface.

## Localization and test implications

- `src/contentScripts/views/App.vue:23-220` owns four-language messages for the active Linux.do surface and chooses them from browser language.
- `src/_locales/en.yml:281-304` and `src/_locales/cmn-CN.yml:276-299` supply the older `DataSync.vue` messages through vue-i18n; other supported locale files mirror that surface.
- Changing only one localization source leaves the other settings surface unchanged.
- `src/tests/linuxDoMigration.spec.ts:44-47` currently covers only WebDAV-related manifest permission scope.
- No dedicated tests were found for WebDAV UI, dialog behavior, action concurrency, validation, or save/close semantics.
- `.trellis/tasks/archive/2026-07/07-03-webdav/prd.md:22-25` records the original fields and three manual actions but no secondary-dialog or transaction semantics.

## Product decisions still required

1. Whether the change applies only to the active `App.vue` surface or also to the older `DataSync.vue` surface.
2. Whether the primary panel retains a WebDAV enable switch while configuration/actions move, or the whole WebDAV section becomes a single dialog entry.
3. Whether dialog edits remain immediately persisted or become draft changes with explicit save/cancel.
4. Whether manual download remains immediate or gains confirmation.
5. Whether operations block dialog close and other operations.
