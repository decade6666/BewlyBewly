# WebDAV Settings Sync

## Goal
Add WebDAV sync capability so users can sync all extension settings (including blocked words) across browsers/devices.

## Requirements

### Storage
- All settings already persist locally via `chrome.storage.local`
- WebDAV sync is additive — local storage remains the primary source

### WebDAV Sync
- **Scope**: Entire `Settings` object
- **Sync modes**: Both automatic and manual
  - Auto: upload on settings change (debounced), download on extension startup
  - Manual: explicit upload/download buttons in UI
- **Conflict**: Last-write-wins based on timestamp; user can manually overwrite via download/upload
- **File path**: Configurable, default `/bewly/settings.json`
- **Auth**: Basic auth (username + password), stored in `chrome.storage.local`

### UI
- New `SettingsItemGroup` in Settings panel (under a new "Data Sync" section or within General)
- Fields: WebDAV URL, username, password, auto-sync toggle, sync path
- Buttons: Test connection, Upload now, Download now
- Status: Last sync time, sync status indicator

### Implementation
- Pure `fetch`-based WebDAV client (PUT/GET/MKCOL/PROPFIND)
- No external dependencies
- Debounce auto-upload (2s delay after last change)
- Background script handles sync on extension startup

## Files to modify
- `src/logic/storage.ts` — add WebDAV config fields to Settings
- `src/logic/webdav.ts` — new WebDAV client
- `src/logic/settingsSync.ts` — new sync service
- `src/components/Settings/BewlyPages/` — new sync settings UI component
- `src/contentScripts/views/App.vue` or settings watchers — auto-sync watcher
