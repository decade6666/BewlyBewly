# Technical Design: WebDAV Settings Simplification

## Scope and Task Boundaries

This parent task coordinates two independently verifiable child deliverables. It owns the end-state contract and final integration review, but it does not own direct product-code edits.

| Order | Child task | Owned change | Explicit boundary |
|---|---|---|---|
| 1 | `07-10-remove-legacy-settings-tree` | Delete the unmounted `src/components/Settings/**` tree, its tree-exclusive four-language `settings:` namespace, stale tests, and the matching Knip ignore. | Must not change active settings behavior, central settings fields, dependencies, static assets, or WebDAV runtime code. |
| 2 | `07-10-webdav-manual-dialog` | Remove automatic WebDAV synchronization, migrate its persisted fields, and add the active manual configuration dialog. | Must preserve the background transport, `<all_urls>` permission, manual version-1 snapshot format, and unrelated Linux.do settings behavior. |

The children execute sequentially because both update `src/tests/linuxDoMigration.spec.ts`. The first child must finish and pass its checks before the second child takes ownership of that file.

## End-State Architecture

```text
Linux.do primary settings panel
  └─ always-visible WebDAV settings button
       └─ mounted WebdavSettingsDialog instance
            ├─ local draft configuration
            ├─ explicit Save → shared persisted settings
            ├─ draft connection test → background WebDAV TEST
            ├─ saved-only upload → settingsSync → background WebDAV UPLOAD
            └─ confirmed saved-only download
                 └─ settingsSync → background WebDAV DOWNLOAD
                      └─ version-1 envelope merge

Content-script startup
  ├─ Linux.do page cleanup watchers
  └─ app injection
  (no WebDAV startup download or settings-change upload watcher)
```

The unmounted settings tree is removed rather than adapted. The active UI remains the Shadow DOM app under `src/contentScripts/views/App.vue`.

## Cross-Child Contracts

### Active UI ownership

- `src/contentScripts/views/App.vue` and the new WebDAV dialog are the only maintained WebDAV settings surface.
- Deleting `src/components/Settings/**` must happen before source-contract tests are rewritten for the new active dialog.
- The primary panel ends with a button-only WebDAV entry; fields, actions, and last-sync status live only in the secondary dialog.

### Persistence boundary

- Retained WebDAV settings continue to use the shared `settings` ref.
- Dialog edits are local and become persistent only through Save.
- `webdavAutoSync` and `webdavLocalModifiedTime` are removed from the TypeScript model/defaults and explicitly stripped from both serialized and object-shaped legacy local storage.
- Every other setting is preserved during cleanup and during a WebDAV download merge.

### Transport and wire compatibility

- Connection testing and transfers continue through runtime messaging to the background worker; content-script code must not call the raw fetch-based WebDAV client.
- `<all_urls>` remains because the user can configure an arbitrary WebDAV endpoint.
- The remote envelope remains version `1` with `timestamp`, `settings`, and `blockedWords`.
- Local WebDAV configuration and `webdavLastSyncTime` remain excluded from uploaded/downloaded settings data.

### Localization boundary

- The deleted tree's top-level `_locales` `settings:` namespace is removed in all four locale files.
- The active dialog uses the active Linux.do `appMessages` language set and adds every new label in English, Simplified Chinese, Traditional Chinese, and Cantonese.
- Shared locale namespaces, especially `common.*`, remain untouched.

### Test ownership

- The legacy-tree child removes tests that read dead sources and adds a repository-boundary assertion for the deletion.
- The manual-dialog child adds pure behavior tests for draft validation/normalization/merge and retargets active-source contracts to the new dialog and manual-only synchronization path.
- Neither child introduces a new test dependency; Vitest, jsdom, pure helper tests, source contracts, and real-extension browser validation are sufficient.

## Manual WebDAV Data Flow

### Save

```text
persisted WebDAV fields
  → copy into local draft on open
  → user edits draft
  → validate enabled HTTP(S) URL
  → normalize empty path
  → immutably merge only retained WebDAV fields into current settings.value
  → refresh draft from persisted values
```

This merge uses the current shared settings object at Save time, so unrelated settings changed while the dialog was open are not overwritten.

### Connection test

```text
current draft
  → validate URL without persisting
  → WebDavConfig
  → webdavTestViaBackground
  → localized transient result
```

A dialog-session token prevents a result from an abandoned draft test from appearing after close/reopen.

### Upload and download

```text
persisted settings only
  → require enabled + valid saved URL + clean draft
  → one active operation at a time
  → existing settingsSync manual function
  → existing background message path
```

Download first enters an inline confirmation state. Only explicit confirmation sends the request and applies the remote settings/blocked-words payload.

## Compatibility and Migration

- No remote migration is needed because the version-1 envelope already excludes local WebDAV configuration.
- Local upgrade cleanup removes obsolete automatic-sync keys early and also strips them from the hydrated in-memory object.
- A previously installed older version that never upgrades may continue automatic synchronization; the unchanged version-1 file cannot remotely disable that client.
- A later downgrade after this upgrade cannot revive the prior local automatic-sync preference because the obsolete keys have been deleted.

## Error and Lifecycle Model

- URL validation occurs before Save and Test; transfer functions are reachable only with a valid saved configuration.
- Background/network failures remain observable as localized inline status with the existing error/status detail.
- Test, upload, and download share one operation lock.
- Dismissal never attempts cancellation. Closing during Test invalidates only its presentation session; closing during Upload/Download preserves the eventual result in the still-mounted component instance.
- The secondary dialog never closes automatically after Save or an operation.

## Rollback Shape

- Each child is a separate rollback unit. Restore the first child's deleted tree/locales/tests/config together if deletion validation reveals an unknown consumer.
- Restore the second child's UI, storage model, migration, lifecycle, and sync changes together; do not restore only automatic lifecycle triggers without their removed fields and state.
- No rollback requires transforming remote WebDAV data because the wire format is unchanged.
- Generated build artifacts are not rollback inputs and must remain untracked.
