# Implementation Plan: Manual-Only WebDAV Settings Dialog

## Preconditions and File Ownership

- Start only after `07-10-remove-legacy-settings-tree` is complete and its checks pass.
- Take exclusive sequential ownership of `src/tests/linuxDoMigration.spec.ts` after the sibling handoff.
- Do not modify background listener behavior, WebDAV fetch methods, manifest permissions, package dependencies, or the remote envelope version.
- Keep the task in planning until the user explicitly approves implementation and the Trellis start gate succeeds.

## Step 1 — RED: Define the Final Contracts

### Pure helper tests

Create `src/tests/webdavSettings.spec.ts` first. Cover:

1. a draft is a new object containing only retained WebDAV fields;
2. enabled Save rejects empty, relative, malformed, and non-HTTP(S) URLs;
3. disabled Save accepts an empty URL;
4. Test requires an absolute HTTP(S) URL even when the draft is disabled;
5. empty/whitespace path becomes `/bewly/settings.json`;
6. username/password remain unchanged;
7. dirty detection changes only for retained fields;
8. saved transfer usability requires enabled + valid URL;
9. merge returns a new full object and preserves unrelated current settings.

### Migration and source contracts

Update `src/tests/linuxDoMigration.spec.ts` to expect:

- all three legacy keys are stripped from object-shaped and serialized values;
- retained WebDAV/unrelated fields survive cleanup;
- automatic lifecycle imports/calls/exports/fields/snapshots are absent;
- unrelated `watch`-based homepage cleanup remains;
- the new dialog is mounted as a persistent component instance;
- the primary panel owns only the WebDAV entry button;
- manual TEST/UPLOAD/DOWNLOAD, blocked-word envelope, background listener, and `<all_urls>` remain;
- the remote envelope still declares version `1`.

Run targeted tests and record the expected failure before implementation:

```bash
pnpm exec vitest run src/tests/webdavSettings.spec.ts src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
```

The RED failure must reflect missing helpers/dialog and still-present automatic code. Do not proceed if the failure is unrelated.

## Step 2 — GREEN: Add Pure Draft Helpers

1. Create `src/logic/webdavSettings.ts` with the types, constant, validation, normalization, copy, dirty, usability, config mapping, and immutable merge functions from `design.md`.
2. Keep every helper side-effect free and independent from Vue refs/browser storage.
3. Export the module from `src/logic/index.ts`.
4. Use `DEFAULT_WEBDAV_PATH` instead of introducing a third default-path literal.
5. Run `src/tests/webdavSettings.spec.ts` until all helper tests pass.

## Step 3 — Migrate and Remove Automatic-Only Persistence

1. Extend `LEGACY_SETTINGS_KEYS` in `src/logic/settingsMigration.ts` with `webdavAutoSync` and `webdavLocalModifiedTime`.
2. Update migration tests for object-shaped, serialized, malformed, and already-clean values.
3. Remove both fields from the `Settings` interface and `originalSettings` in `src/logic/storage.ts`.
4. Use the shared default-path constant for `webdavPath`.
5. Preserve the existing raw-storage cleanup call and immediate in-memory cleanup watch.
6. Run helper and migration tests before continuing.

Rollback point: if hydration/serialization tests fail, restore the model/default edits and fix migration behavior before removing runtime consumers.

## Step 4 — Remove Automatic Synchronization Runtime

### `src/logic/settingsSync.ts`

1. Keep version-1 envelope/state building, blocked-word cloning, and retained WebDAV exclusion.
2. Remove skipped results, snapshots, automatic-apply guards, timers, unwatch state, `setupAutoSync`, and `autoDownloadOnStartup`.
3. Change `downloadSettings` back to a parameterless manual function and remove the only-if-newer branch.
4. Build the downloaded settings result immutably from defaults, remote settings, current retained local WebDAV fields, and the remote timestamp.
5. Keep manual upload/download error mapping and last-sync updates.
6. Reuse the default path constant in the WebDAV config builder.

### `src/contentScripts/index.ts`

1. Remove automatic-sync imports.
2. Remove `setupSettingsSync()` and its call from DOM startup.
3. Retain the Vue `watch` import and homepage cleanup watch.

Run targeted source contracts and typecheck before adding the UI:

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
pnpm typecheck
```

## Step 5 — Build the Dialog Component

Create `src/contentScripts/views/WebdavSettingsDialog.vue` using `<script setup lang="ts">`.

Implementation order:

1. Define typed `visible`/`labels` props and `close` emit.
2. Add draft initialization, validation error, saved feedback, confirmation, operation state, operation/session identifiers, and computed guards.
3. Implement Save through the pure immutable merge helper.
4. Implement draft Test with dialog-session result invalidation.
5. Implement saved-only Upload/Download through existing `settingsSync` functions.
6. Implement inline Download confirmation with a fresh guard check before the request.
7. Route Cancel, close button, Escape, and `@click.self` backdrop through one dismissal function.
8. Add focus-on-open and localized dialog/title/error/status associations.
9. Add component-scoped overlay/form/button/confirmation styles using inherited `--bew-*` variables.
10. Keep the close/dismiss controls active while every other control is disabled during an operation.

Keep functions short and separate state transitions from message formatting. Do not log credentials or add request cancellation/timeout behavior.

## Step 6 — Replace the Inline App Surface

In `src/contentScripts/views/App.vue`:

1. Import `WebdavSettingsDialog.vue` and remove direct WebDAV operation imports.
2. Delete the three booleans, inline status/last-sync computed value, failure formatter, and three inline handlers.
3. Add dialog visibility and an entry-button element ref.
4. Replace the complete inline WebDAV section with one localized secondary button.
5. Render `WebdavSettingsDialog` unconditionally and pass `visible` plus `appLabels`.
6. Restore focus to the trigger after `close`.
7. Remove obsolete inline WebDAV styles and keep only entry-button styling needed by the primary panel.
8. Remove `webdavAutoSync` from all four language objects and add every new dialog label consistently.
9. Keep blocked-word dialog Escape behavior intact; ensure WebDAV Escape handling does not close or mutate unrelated overlays.

Run typecheck and targeted tests immediately after this wiring.

## Step 7 — GREEN and Refactor

Run:

```bash
pnpm exec vitest run src/tests/webdavSettings.spec.ts src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
pnpm typecheck
pnpm exec eslint src/contentScripts/views/App.vue src/contentScripts/views/WebdavSettingsDialog.vue src/contentScripts/index.ts src/logic/index.ts src/logic/settingsMigration.ts src/logic/settingsSync.ts src/logic/storage.ts src/logic/webdavSettings.ts src/tests/webdavSettings.spec.ts src/tests/linuxDoMigration.spec.ts
```

Then review/refactor without changing behavior:

- no function over 50 lines;
- no in-place draft/full-settings mutation;
- no duplicated URL/default-path logic;
- one operation entry guard;
- one dismissal path;
- all four message objects have matching keys;
- no automatic-sync identifiers outside intentional migration/tests.

Rerun the targeted suite after refactoring.

## Step 8 — Full Static and Build Validation

Run in order:

```bash
CI=true pnpm test
pnpm lint
pnpm typecheck
pnpm knip
pnpm build
```

Check the built manifest and source contracts without changing:

- `<all_urls>`;
- background listener registration;
- version-1 envelope;
- ignored generated artifacts.

Report any command not run or blocked; do not mask failures.

## Step 9 — Real-Extension Browser Validation

Build and load the unpacked `extension/` through browser-level CDP in a dedicated headed Chrome profile, then navigate to Linux.do. Do not use the default extension-less MCP browser.

Pierce the shadow root:

```text
document.getElementById('bewly').shadowRoot
```

Verify:

1. primary settings panel shows only the WebDAV settings button;
2. opening moves focus into a localized `role="dialog"` / `aria-modal="true"` surface;
3. edits do not change persisted values before Save;
4. Cancel, close, Escape, and backdrop discard edits and return focus;
5. disabled empty-URL Save succeeds; enabled invalid URL shows an inline error;
6. empty path saves as `/bewly/settings.json` and the dialog stays open;
7. dirty draft disables transfer actions and Save re-enables them when saved config is enabled/valid;
8. Download first shows inline confirmation; cancel sends no request;
9. operation controls serialize and the close affordance remains active;
10. closing/reopening during Test hides the abandoned result;
11. closing/reopening during Upload/Download retains pending/final status and last-sync display.

Use only an authorized disposable WebDAV endpoint or a temporary local fixture for live network actions. Download tests must run in the dedicated test profile because they replace local settings/blocked words. If no endpoint or Linux.do access is available, explicitly separate UI checks completed from network checks not run.

## Step 10 — Review and Quality Gates

After the final source diff:

1. run the code reviewer for correctness/edge cases;
2. run change-impact and quality gates because the task exceeds 30 lines;
3. run the security gate for URL validation, credentials, background routing, and remote JSON application;
4. fix all Critical/High findings;
5. rerun every validation affected by a fix;
6. inspect `git diff` and `git status` for scope and generated artifacts.

## Rollback Point

Revert these as one coherent set if final validation cannot converge:

- new helper/test/component files;
- App wiring/messages/styles;
- migration and storage fields/defaults;
- manual-sync simplification;
- content-script lifecycle removal;
- active source contracts.

Do not restore only startup/watcher calls, and do not modify remote snapshots during rollback.

## Completion Conditions

- Every PRD acceptance criterion has test, static, build, or browser evidence.
- Automatic synchronization cannot run from local changes or startup.
- Manual operations retain background routing and version-1 compatibility.
- Validation reporting distinguishes passed, failed, not run, and blocked checks.
- No commit, push, upload, release, dependency addition, or permission change occurs without separate explicit authorization.
