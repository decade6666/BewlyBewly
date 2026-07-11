# Technical Design: Manual-Only WebDAV Settings Dialog

## Design Summary

Replace the active inline WebDAV form with an always-mounted, button-opened Vue component that owns transient draft and operation state. Remove every automatic synchronization trigger and its obsolete persistence/state while retaining the existing manual background transport and version-1 snapshot contract.

The component stays mounted when visually closed. This is required so a running upload/download can finish and retain its result without introducing request cancellation or a global operation store.

## File and Ownership Map

| File | Planned responsibility |
|---|---|
| `src/contentScripts/views/App.vue` | Keep the primary-panel entry button, dialog visibility, four-language labels, and trigger-focus restoration; remove inline WebDAV form/handlers/state. |
| `src/contentScripts/views/WebdavSettingsDialog.vue` | Own draft editing, Save, validation presentation, operation lock, inline download confirmation, close semantics, focus entry, status, and dialog styles. |
| `src/logic/webdavSettings.ts` | Pure draft/configuration helpers and the shared default path constant; no Vue/browser side effects. |
| `src/logic/index.ts` | Export the new pure helper module through the existing logic barrel. |
| `src/logic/settingsMigration.ts` | Treat both automatic-sync fields as legacy local-storage keys. |
| `src/logic/storage.ts` | Remove automatic-only fields/defaults and reuse the default path constant. |
| `src/logic/settingsSync.ts` | Keep manual version-1 upload/download; remove automatic snapshots, flags, timers, watcher/startup exports, and newer-only branches. |
| `src/contentScripts/index.ts` | Remove WebDAV lifecycle setup while retaining `watch` for Linux.do cleanup. |
| `src/tests/webdavSettings.spec.ts` | Unit-test pure draft validation, normalization, dirty detection, usability, and immutable merge. |
| `src/tests/linuxDoMigration.spec.ts` | Cover legacy-key cleanup, manual-only lifecycle/source boundaries, new dialog wiring, background routing, and version-1 retention. |

The sibling task removes the legacy `DataSync.vue` surface first, so this task localizes only the active inline `appMessages` table.

## Pure Draft and Configuration Contract

`src/logic/webdavSettings.ts` defines a storage-independent shape:

```typescript
export const DEFAULT_WEBDAV_PATH = '/bewly/settings.json'

export interface WebdavSettingsFields {
  webdavEnabled: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
}

export type WebdavSettingsDraft = WebdavSettingsFields
export type WebdavValidationError = 'url_required' | 'url_invalid'
```

Planned pure operations:

- copy retained fields from a source object into a new draft;
- normalize URL surrounding whitespace and replace an empty/whitespace-only path with `DEFAULT_WEBDAV_PATH` while preserving username/password exactly;
- recognize only absolute `http:` or `https:` URLs through `new URL(...)` plus a protocol check;
- validate Save only when the draft is enabled;
- validate Test regardless of the enabled switch because testing uses the entered draft;
- compare a draft with the currently persisted retained fields;
- determine whether saved settings are enabled and usable for transfer;
- immutably merge normalized retained fields into the current full settings object.

The immutable merge starts from the current `settings.value`, not the snapshot captured when the dialog opened. This prevents Save from overwriting unrelated settings changed concurrently.

## Component Boundary

`WebdavSettingsDialog.vue` receives presentation state and labels, and emits dismissal:

```typescript
interface Props {
  visible: boolean
  labels: WebdavSettingsLabels
}

const emit = defineEmits<{
  (event: 'close'): void
}>()
```

`App.vue` renders the component unconditionally:

```vue
<WebdavSettingsDialog
  :visible="showWebdavSettingsDialog"
  :labels="appLabels"
  @close="closeWebdavSettingsDialog"
/>
```

Only the component's overlay is conditional on `visible`; the component instance itself must not be behind a parent `v-if`.

The primary panel retains one localized WebDAV settings button and no WebDAV field, action, operation status, or last-sync value.

## Dialog State Model

The component owns these categories:

```text
Draft state
  draft
  validationError
  saveFeedback

Dialog-session state
  visible prop
  dialogSessionId
  downloadConfirmationVisible
  transient test result

Transfer state
  activeOperation: null | test | upload | download
  operationId
  retained upload/download result
```

Computed invariants:

```text
isBusy = activeOperation !== null
isDirty = draft differs from persisted retained WebDAV fields
savedConfigUsable = persisted enabled + absolute HTTP(S) URL
canUploadOrDownload = !isBusy && !isDirty && savedConfigUsable
```

All non-dismissal form/action controls are disabled while busy. Dismissal by Cancel, close button, Escape, or an explicit backdrop click remains available.

## Open, Save, and Close Semantics

### Open

On each `visible: false → true` transition:

1. increment the dialog session identifier;
2. copy persisted retained fields into a new draft;
3. clear stale field validation, Save feedback, draft-test presentation, and download confirmation;
4. retain upload/download status;
5. after DOM update, focus the first enabled dialog control, falling back to the close button if an older operation is still running.

Connection fields remain in the dialog so users can prepare/test a draft before committing it. The enable switch controls Save validation and saved transfer availability, not dialog existence.

### Save

1. Reject an enabled draft with a missing or non-absolute/non-HTTP(S) URL and focus/annotate the URL field.
2. Normalize URL whitespace and an empty path.
3. Immutably merge only retained WebDAV fields into the current shared settings object.
4. Rebuild the draft from the saved values so `isDirty` becomes false immediately.
5. clear prior endpoint-specific operation feedback, show localized saved feedback, and keep the dialog open.

A disabled draft may save with no URL. Username and password are optional and are never trimmed or rendered in status text.

### Close

Every dismissal path goes through one close function:

1. increment/invalidate the dialog session;
2. discard draft, field error, Save feedback, pending confirmation, and test-result presentation;
3. leave `activeOperation` intact if a request is still running;
4. retain upload/download presentation state;
5. emit `close`.

`App.vue` sets visibility false and restores focus to the WebDAV entry button on the next DOM update.

Backdrop dismissal uses `@click.self` so clicks inside the dialog never close it. The component never closes itself after Save or any operation result.

## Operation State Machine

| Current state | Event | Guard | Effect |
|---|---|---|---|
| Idle | Test | draft URL valid | Start TEST with a copied/normalized draft config. |
| Idle | Upload | clean + saved config usable | Start existing manual upload using persisted settings. |
| Idle | Download button | clean + saved config usable | Enter inline confirmation; send no request. |
| Idle + confirmation | Confirm download | transfer guard still true | Clear confirmation and start existing manual download. |
| Any busy state | Test/Upload/Download/Save/edit | none | Control is disabled; no second operation starts. |
| Any state | Dismiss | none | Close UI without canceling the request. |

A monotonically increasing operation identifier prevents a stale `finally` block from clearing a newer operation if future changes violate serialization.

### Test result invalidation

Test captures the current `dialogSessionId`. Its result is shown only when all are true:

- the same test operation is still current;
- the dialog is visible;
- the captured session equals the current dialog session.

Closing invalidates the presentation but does not pretend to cancel the request. If reopened while the old test is pending, the operation lock remains until it settles, controls stay disabled, and no old result appears.

### Upload/download result retention

Upload/download always use persisted settings and update a retained transfer-status field when they settle, even while the dialog is closed. Reopening shows the pending state or final result. Saving a changed endpoint later clears that endpoint-specific result.

## Inline Download Confirmation

The Download button first renders a confirmation section inside the same dialog. It must state that remote settings and blocked words will replace their local counterparts.

- The confirmation is not a nested modal.
- Cancel only exits confirmation and sends no request.
- Confirm rechecks `canUploadOrDownload` immediately before calling `downloadSettings()`.
- Closing the dialog discards confirmation.
- Confirmation controls remain keyboard accessible and use localized labels/descriptive association.

## Accessibility Contract

The overlay/dialog provides:

- `role="dialog"`;
- `aria-modal="true"`;
- a stable `aria-labelledby` reference to the localized title;
- an icon-only close button with localized `aria-label`;
- programmatic focus entry on open;
- focus restoration to the invoking button on close;
- Escape handling only while visible;
- native buttons/inputs for keyboard operation;
- field-level URL error association and polite status announcements.

A full focus-trap abstraction is not introduced because the accepted requirement is focus entry/restoration and keyboard dismissal; the full-screen Shadow DOM overlay prevents pointer interaction with the underlying panel.

## Manual Synchronization Refactor

### Retained

- `SyncEnvelope` version `1` and its fields;
- `buildSyncState()` and blocked-word cloning;
- local WebDAV-field exclusion;
- `uploadSettings()` and `downloadSettings()`;
- background upload/download wrappers;
- manual `webdavLastSyncTime` updates;
- local WebDAV configuration preservation during download.

### Removed

- `SyncResult.skipped`;
- `applyingRemote`;
- `lastSyncedSnapshot` and `buildSyncSnapshot()`;
- `downloadSettings({ onlyIfNewer })` and the newer-only branch;
- local-modified-time reset;
- auto-sync timer/unwatch state;
- `setupAutoSync()`;
- `autoDownloadOnStartup()`.

Download builds one new settings object rather than mutating dynamic fields in a loop:

```text
original defaults
  + remote settings
  + current retained local WebDAV configuration
  + downloaded envelope timestamp as webdavLastSyncTime
```

Blocked words are also replaced with a newly cloned object. This preserves the wire contract and local configuration without automatic-sync guard state.

`src/contentScripts/index.ts` removes the automatic imports, `setupSettingsSync()` call, and function. Its Vue `watch` import remains because homepage cleanup still watches active settings/blocked words.

## Local Persistence Migration

Extend `LEGACY_SETTINGS_KEYS` with:

```text
webdavAutoSync
webdavLocalModifiedTime
```

Then remove these properties from `Settings` and `originalSettings`.

Both cleanup paths remain required:

- raw browser-local cleanup handles serialized or object-shaped stored data before rewriting it;
- the immediate deep watch strips obsolete keys from the hydrated in-memory object.

Tests must prove all three legacy keys are removed while retained WebDAV and unrelated settings survive. Intentional key names may remain in migration code/tests only.

## Localization

Remove `webdavAutoSync` from all four active message objects. Add matching keys for:

- entry/title/close;
- Save/Cancel/saved feedback;
- required and invalid URL errors;
- download warning/confirm/cancel;
- any dirty/disabled hint used by the final template.

All four objects must keep the same structural key set so the inferred `appLabels` type remains consistent.

## Security and Compatibility

- Absolute HTTP(S) validation rejects non-network schemes before credentials are sent.
- Password values remain in password inputs and existing extension local storage; no status, log, or test output includes credentials.
- Content-script requests remain background-routed to avoid CORS and preserve the current permission model.
- No timeout, abort controller, retry policy, authentication change, or endpoint permission reduction is introduced.
- External downloaded JSON keeps the existing version check and error reporting; this task does not change the version-1 schema.

## Test Strategy

### Pure tests

`src/tests/webdavSettings.spec.ts` covers:

- independent draft copies;
- enabled missing/relative/non-HTTP(S) URL rejection;
- disabled empty URL acceptance;
- Test requiring a valid URL regardless of enabled state;
- optional credentials preservation;
- default path normalization;
- exact dirty/clean transitions;
- saved configuration usability;
- immutable merge preserving unrelated fields.

### Source/integration contracts

`src/tests/linuxDoMigration.spec.ts` covers:

- migration cleanup of both removed fields;
- absence of automatic setup/exports/state and active labels;
- retention of unrelated content-script watchers;
- unconditional component mounting plus button-only primary panel;
- dialog semantics, manual action imports, and inline confirmation source boundaries;
- version-1 envelope, blocked words, background wrappers/listener, and `<all_urls>` retention.

### Real browser

Use a freshly built unpacked extension in a dedicated browser profile. Assertions pierce `#bewly`'s shadow root and cover visible interaction/focus/async behavior that source tests cannot establish without adding a component-test dependency.

## Rollback

Revert the helper, dialog, App wiring, inline labels, migration, storage model, manual-sync simplification, lifecycle removal, and tests as one coherent unit. Do not restore automatic lifecycle calls without restoring their compatible fields/guards, and do not alter remote data during rollback because version `1` remains unchanged.
