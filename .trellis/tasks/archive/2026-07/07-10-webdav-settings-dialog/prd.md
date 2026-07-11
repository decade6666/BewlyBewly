# Adjust WebDAV Sync and Configuration Interaction

## Goal

Simplify WebDAV settings by removing all automatic synchronization, keeping explicit manual WebDAV operations, moving the active inline configuration into a button-opened secondary dialog, and deleting the unrelated unmounted legacy settings tree.

## Confirmed Background

- The active Linux.do settings panel renders in `src/contentScripts/views/App.vue`; its current inline WebDAV section is at `src/contentScripts/views/App.vue:698-764`.
- The active panel stores labels in its own four-language `appMessages` table and does not consume the `_locales` top-level `settings:` namespace.
- The existing blocked-word overlay at `src/contentScripts/views/App.vue:690-696,767-790` establishes the active Shadow DOM secondary-dialog pattern.
- Current WebDAV field edits write directly to the shared settings store, so no draft/save/cancel transaction exists.
- Automatic synchronization is limited to a debounced settings-change upload and a startup download (`src/contentScripts/index.ts:32-66`; `src/logic/settingsSync.ts:145-182`).
- Manual Test, Upload, and Download already use the background WebDAV channel and do not depend on automatic synchronization.
- The background listener, WebDAV client, and arbitrary-endpoint permission remain necessary for manual operations.
- The version-1 remote snapshot excludes local WebDAV configuration, so the remote format requires no migration.
- `src/components/Settings/**` contains 17 files (2,855 lines) with no external mount, route, import, template consumer, or implicit component registration. Three source-regression tests read files in that dead tree directly.
- Central persisted settings remain active outside the legacy tree and are not deletion candidates.

## Task Map and Ordering

| Order | Child task | Deliverable |
|---|---|---|
| 1 | `07-10-remove-legacy-settings-tree` | Remove the unmounted settings tree, tree-exclusive four-language localization, stale test reads, and its Knip ignore without changing active behavior. |
| 2 | `07-10-webdav-manual-dialog` | Remove automatic synchronization and add the active manual WebDAV configuration dialog, storage cleanup, tests, and validation. |

The children run sequentially because both own changes to `src/tests/linuxDoMigration.spec.ts`. The parent owns cross-child acceptance and final integration review, not direct product-code implementation.

## Requirements

### R1 — Remove automatic WebDAV synchronization

- Remove every maintained user-facing automatic-sync control and active localization label.
- Remove settings-change automatic uploads and startup automatic downloads.
- Remove state, timers, snapshots, branches, exports, persisted fields, and defaults that exist only for automatic synchronization.
- Explicitly remove persisted `webdavAutoSync` and `webdavLocalModifiedTime` during upgrade while preserving all retained settings.
- Preserve manual Test, Upload, Download, and `webdavLastSyncTime`.

### R2 — Move WebDAV configuration into a secondary dialog

- Replace the active primary panel's complete inline WebDAV section with one always-visible localized WebDAV settings button.
- Put the enable switch, URL, optional username/password, remote path, Test, Upload, Download, and last-sync status inside a localized secondary dialog.
- Initialize a local draft from persisted WebDAV settings each time the dialog opens.
- Persist retained WebDAV fields together only when Save is activated.
- Keep the dialog open and show localized feedback after a successful Save.
- When enabled, require an absolute `http://` or `https://` URL and normalize an empty path to `/bewly/settings.json`; username/password remain optional.
- Allow a disabled configuration to be saved without a URL.
- Show validation failures inline rather than silently ignoring an action.
- Cancel, Escape, an explicit backdrop click, and the close button discard unsaved draft changes.

### R3 — Define manual-operation and close/reopen behavior

- Test uses the current unsaved draft so credentials can be checked before Save.
- Upload and Download use only persisted configuration.
- Disable Upload/Download while the draft is dirty, the saved configuration is disabled/invalid, or any operation is running.
- Require an in-dialog confirmation before Download replaces local settings and blocked words; canceling sends no request and does not close the dialog.
- Run at most one Test, Upload, or Download at a time and disable all non-dismissal controls while it is running.
- Keep deliberate dismissal available during a request; dismissal does not promise cancellation and the dialog must never auto-close after Save or an operation.
- Closing during a draft Test discards its presentation and prevents a late result from appearing after reopen.
- Closing during Upload/Download lets the saved-configuration request continue and retains its pending/final result for the next open.
- Show last-sync status only inside the secondary dialog.

### R4 — Preserve compatibility and remove only proven dead scope

- Preserve background runtime messaging, raw WebDAV request handling, and arbitrary-endpoint permission required by manual operations.
- Preserve the version-1 remote snapshot shape and blocked-word round trip.
- Delete the complete unmounted `src/components/Settings/**` tree without deleting central settings fields, shared components outside it, dependencies, static assets, or active runtime behavior.
- Delete the tree-exclusive top-level `settings:` namespace from all four locale files while preserving every shared/active namespace.
- Remove the stale `src/components/Settings/**` Knip ignore.
- Remove or retarget tests that read deleted sources without weakening active migration, UI, transport, or permission contracts.

### R5 — Accessibility and verification

- Give the WebDAV dialog proper dialog/modal semantics and a localized accessible title.
- Move focus into the dialog on open, keep controls keyboard operable, close on Escape, and restore focus to the entry button after dismissal.
- Add behavior coverage for draft validation/normalization/merge and source/integration coverage for lifecycle, migration, dialog, background routing, and version compatibility.
- Run targeted and full tests, lint, type checking, Knip, build, and real-extension browser verification for the integrated change.

## Acceptance Criteria

- [ ] **R1:** No maintained UI control or active label enables automatic WebDAV synchronization.
- [ ] **R1:** Changing local settings never schedules a WebDAV upload, and content-script startup never downloads WebDAV settings.
- [ ] **R1:** Upgrade cleanup removes `webdavAutoSync` and `webdavLocalModifiedTime` while preserving every retained setting; a later downgrade cannot recover the former local auto-sync preference from those keys.
- [ ] **R1/R4:** Manual Test, Upload, Download, last-sync updates, background routing, `<all_urls>`, blocked words, and the version-1 envelope remain intact.
- [ ] **R2:** The active primary panel contains one localized WebDAV entry button and no inline WebDAV fields, actions, or last-sync status.
- [ ] **R2/R5:** Opening the entry shows a localized accessible secondary dialog, initializes a draft, and moves focus inside.
- [ ] **R2:** Editing the draft does not alter persisted WebDAV settings until Save commits all retained fields together.
- [ ] **R2:** Successful Save keeps the dialog open, shows feedback, normalizes an empty path, and immediately makes transfers available only when the saved configuration is enabled and valid.
- [ ] **R2:** Enabled Save rejects missing, relative, malformed, and non-HTTP(S) URLs inline; disabled Save may omit URL; credentials remain optional.
- [ ] **R2/R5:** Cancel, Escape, backdrop, and close-button dismissal discard unsaved changes and restore focus to the entry button.
- [ ] **R3:** Test uses the draft without persisting it; Upload/Download use persisted settings and remain disabled for dirty, disabled, invalid, or busy state.
- [ ] **R3:** Download requires inline confirmation that names both local settings and blocked words; canceling confirmation sends no request and keeps the dialog open.
- [ ] **R3:** Only one operation runs at a time; non-dismissal controls are disabled while busy; deliberate close remains possible and no operation auto-closes the dialog.
- [ ] **R3:** Closing during Test suppresses its late result, while closing during Upload/Download preserves the continuing operation and its result for reopen.
- [ ] **R3:** Manual transfer updates remain visible as last-sync status only inside the dialog.
- [ ] **R4:** `src/components/Settings/**`, its stale test reads, the four top-level locale `settings:` mappings, and its Knip ignore are gone with no active consumer removed.
- [ ] **R5:** Targeted tests, full tests, lint, typecheck, Knip, build, and a freshly loaded real-extension browser check pass or any environment blocker is explicitly reported.

## Out of Scope

- Changing WebDAV protocol/server compatibility, authentication, background message contracts, endpoint permission, or version-1 remote format.
- Adding request cancellation, timeout, retry, or server-state infrastructure.
- Remotely disabling automatic synchronization on older installations that never upgrade.
- Redesigning unrelated active settings behavior.
- Removing central persisted settings, dependencies, or static assets solely because the legacy UI tree is deleted; those require separate whole-repository audits.
- Committing, pushing, publishing, or releasing without separate explicit authorization.
