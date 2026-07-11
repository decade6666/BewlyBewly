# Remove WebDAV Automatic Sync and Add Manual Configuration Dialog

## Goal

Remove all automatic WebDAV synchronization while preserving explicit manual operations, and replace the active Linux.do settings panel's inline WebDAV form with an accessible button-opened configuration dialog that uses local draft and explicit Save semantics.

## Confirmed Background

- The maintained UI is `src/contentScripts/views/App.vue`; sibling task `07-10-remove-legacy-settings-tree` removes the separate unmounted settings tree first.
- Automatic synchronization consists only of a settings-change debounced upload and a content-script startup download.
- Manual Test, Upload, and Download already use the background WebDAV transport and do not depend on automatic synchronization.
- The version-1 remote envelope excludes local WebDAV configuration and needs no wire-format migration.
- Existing requests have no reliable cancellation contract, so dismissing the dialog cannot promise to cancel an in-flight request.
- The active UI uses a Shadow DOM secondary-dialog pattern and a local four-language `appMessages` table.

## Requirements

### R1 — Remove automatic synchronization and obsolete persistence

- Remove the automatic-sync control and label from every maintained active UI/localization source.
- Remove settings-change automatic upload and startup automatic download.
- Remove automatic-only flags, snapshots, timers, watcher state, branches, exports, settings fields, and defaults.
- Explicitly remove persisted `webdavAutoSync` and `webdavLocalModifiedTime` during upgrade without dropping retained WebDAV or unrelated settings.
- Preserve `webdavLastSyncTime` for successful manual Upload/Download status.

### R2 — Add the manual WebDAV secondary dialog

- Replace the primary settings panel's entire inline WebDAV section with one always-visible localized WebDAV settings button.
- Put the enable switch, URL, optional username/password, remote path, Test, Upload, Download, and last-sync status inside the secondary dialog.
- Initialize a local draft from persisted settings on each open; edits must not directly mutate persisted settings.
- Save all retained WebDAV fields together, keep the dialog open, and show localized saved feedback.
- When enabled, require an absolute `http://` or `https://` URL and normalize an empty path to `/bewly/settings.json`.
- Allow a disabled configuration to be saved without a URL and keep username/password optional.
- Show URL validation errors inline.
- Cancel, Escape, an explicit backdrop click, and the close button discard unsaved draft changes.

### R3 — Enforce saved-only transfers and one operation at a time

- Test uses the current draft without saving it.
- Upload and Download use only persisted configuration.
- Disable Upload/Download while the draft is dirty, saved WebDAV is disabled/invalid, or any Test/Upload/Download is running.
- Require an inline confirmation before Download replaces local settings and blocked words; canceling confirmation sends no request and keeps the dialog open.
- Run at most one Test, Upload, or Download at a time and disable every non-dismissal form/action control while busy.
- Keep deliberate dismissal available during a request, do not add cancellation infrastructure, and never auto-close after Save or an operation.
- Closing during a draft Test discards its presentation and prevents a late result from appearing after reopen.
- Closing during Upload/Download lets the persisted-configuration request continue and retains its pending/final result for the next open.
- Show last-sync status only inside the secondary dialog.

### R4 — Accessibility and interaction

- Give the dialog `role="dialog"`, `aria-modal="true"`, and a localized accessible title.
- Move focus into the dialog on open, keep every control keyboard operable, close on Escape, and restore focus to the WebDAV entry button after dismissal.
- Use an accessible inline error/status presentation and a labeled icon-only close button.

### R5 — Preserve manual compatibility

- Preserve the background TEST/UPLOAD/DOWNLOAD messaging path, WebDAV request behavior, and arbitrary-endpoint permission.
- Preserve the version-1 envelope, blocked-word payload, manual download merge, and last-sync updates.
- Keep local WebDAV configuration excluded from remote snapshots and preserved when downloaded settings are applied.
- Do not change WebDAV server/protocol/authentication compatibility.

### R6 — Verify behavior

- Add pure behavior tests for draft copying, URL validation, path normalization, dirty state, saved usability, and immutable Save merge.
- Retarget integration/source contracts to the manual-only lifecycle and new active dialog without adding a new test dependency.
- Run targeted and full tests, lint, typecheck, Knip, build, and real-extension browser verification.

## Acceptance Criteria

- [ ] **R1:** No active UI control or active localization label remains for automatic WebDAV synchronization.
- [ ] **R1:** Local settings changes never schedule a WebDAV upload and content-script startup never downloads WebDAV settings.
- [ ] **R1:** Upgrade cleanup removes `webdavAutoSync` and `webdavLocalModifiedTime` from serialized/object-shaped storage and hydrated state while preserving retained values.
- [ ] **R2:** The primary settings panel contains one localized WebDAV settings button and no inline WebDAV fields, actions, status, or last-sync text.
- [ ] **R2/R4:** Opening the button initializes a draft, shows the localized modal dialog, and moves focus inside.
- [ ] **R2:** Draft edits remain unpersisted until Save commits all retained fields together.
- [ ] **R2:** Save keeps the dialog open, shows feedback, normalizes an empty path, and makes transfers available immediately only when saved configuration is enabled and valid.
- [ ] **R2:** Enabled Save rejects missing, relative, malformed, and non-HTTP(S) URLs inline; disabled Save may omit URL; credentials remain optional.
- [ ] **R2/R4:** Cancel, Escape, backdrop, and close-button dismissal discard the draft and restore focus to the entry button.
- [ ] **R3:** Test uses the draft without persistence; Upload/Download use saved settings and are locked for dirty, disabled, invalid, or busy state.
- [ ] **R3:** Download confirmation names both local settings and blocked words; cancel sends no request and keeps the dialog open.
- [ ] **R3:** Only one operation runs at a time; all non-dismissal controls are disabled while busy; deliberate close remains possible and the dialog never auto-closes.
- [ ] **R3:** Closing during Test suppresses its late result, while closing during Upload/Download preserves the continuing request and result for reopen.
- [ ] **R3/R5:** Successful manual Upload/Download maintains `webdavLastSyncTime`, displayed only inside the dialog.
- [ ] **R4:** Dialog semantics, localized accessible name, keyboard operation, Escape handling, status/error association, and focus lifecycle work in the real extension.
- [ ] **R5:** Background listener/wrappers, `<all_urls>`, blocked-word round trip, local WebDAV preservation, and version-1 remote compatibility remain intact.
- [ ] **R6:** Targeted helper/migration/integration tests, full tests, lint, typecheck, Knip, build, and freshly loaded real-extension browser checks pass or any environment blocker is explicitly reported.

## Dependencies and Ordering

Implement only after sibling task `07-10-remove-legacy-settings-tree` passes. This task then takes sole ownership of the already-retargeted `src/tests/linuxDoMigration.spec.ts`.

## Out of Scope

- Changing WebDAV protocol, authentication, background message contracts, endpoint permissions, or version-1 remote format.
- Adding request cancellation, timeout, retry, or server-state infrastructure.
- Disabling automatic synchronization on older installations that never upgrade.
- Removing unrelated persisted settings fields.
- Reintroducing or replacing the deleted legacy settings tree.
- Adding a component-test dependency solely for this dialog.
- Committing, pushing, publishing, or releasing without separate explicit authorization.
