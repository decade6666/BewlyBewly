# Implementation Plan: WebDAV Settings Simplification

## Preconditions

- Keep the parent task in `planning`; do not start implementation until the user reviews the final artifacts and explicitly approves execution.
- Implement through the two child tasks rather than dispatching product-code edits from this parent.
- Keep one writer for `src/tests/linuxDoMigration.spec.ts`; child execution is strictly sequential.
- Do not commit, push, publish, or create a release unless the user separately requests it.

## Stage 1 — Remove the Legacy Settings Tree

Use child task `07-10-remove-legacy-settings-tree`.

1. Start with a failing repository-boundary test that asserts the legacy tree, its top-level locale namespace, and its Knip ignore are absent.
2. Remove obsolete source reads/assertions for legacy About, Home settings, and DataSync components while preserving active migration and background WebDAV contracts.
3. Delete all files under `src/components/Settings/**`.
4. Delete only the top-level `settings:` mapping from each of the four `_locales` YAML files.
5. Remove only `src/components/Settings/**` from `knip.json`'s ignore list.
6. Run the child task's targeted and full validation suite.
7. Review the actual diff and confirm that no central settings fields, shared components, dependencies, static assets, runtime transport, or active UI files were removed.
8. Complete the child quality check before transferring ownership of the shared test file.

Rollback point: restore the deleted directory, locale mappings, test edits, and Knip entry as one unit if any runtime consumer or build dependency is discovered.

## Stage 2 — Implement Manual-Only WebDAV Dialog

Use child task `07-10-webdav-manual-dialog` only after Stage 1 passes.

1. Add failing helper/migration/source-contract tests for the final manual-only behavior.
2. Add pure WebDAV draft/configuration helpers and their unit tests.
3. Extend legacy local-storage cleanup, then remove the two automatic-only fields from the settings type/defaults.
4. Simplify `settingsSync.ts` to manual upload/download while retaining the version-1 envelope and background wrappers.
5. Remove content-script automatic upload/startup-download initialization while preserving unrelated Vue watchers.
6. Add the always-mounted WebDAV dialog component and wire the primary-panel entry/focus behavior in `App.vue`.
7. Add all new active labels to each of the four inline language objects and remove automatic-sync labels.
8. Exercise validation, draft/save semantics, operation serialization, inline download confirmation, close/reopen handling, and accessibility contracts.
9. Run static, unit, integration, build, Knip, and real-extension browser validation.
10. Run code-quality/change/security review gates; fix Critical/High findings and rerun affected checks.

Rollback point: revert dialog, helper, migration, storage, lifecycle, sync, and test changes together. Never re-enable lifecycle triggers without restoring the full compatible automatic-sync state.

## Stage 3 — Parent Integration Review

After both children pass independently:

1. Search the repository for stale legacy settings-tree paths and automatic-sync identifiers.
2. Confirm the only remaining occurrences of `webdavAutoSync` and `webdavLocalModifiedTime` are intentional migration/tests documenting cleanup.
3. Confirm the primary panel has no inline WebDAV fields, actions, or last-sync status.
4. Confirm manual TEST/UPLOAD/DOWNLOAD still flow through the background listener and `<all_urls>` remains.
5. Confirm the version-1 envelope structure and blocked-word round trip are unchanged.
6. Run the final full validation commands from a clean implementation state:

```bash
pnpm exec vitest run src/tests/webdavSettings.spec.ts src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
CI=true pnpm test
pnpm lint
pnpm typecheck
pnpm knip
pnpm build
```

7. Load the freshly built Chromium extension in a dedicated browser profile and verify through `#bewly`'s shadow root:
   - the primary WebDAV entry button;
   - dialog focus, keyboard close, backdrop close, and focus restoration;
   - draft discard and Save persistence;
   - enabled/disabled validation and default path normalization;
   - single-operation locking and inline download confirmation;
   - close/reopen behavior for a pending Test and for Upload/Download results.
8. Record any browser blocker such as login or Cloudflare explicitly; do not substitute an extension-less MCP browser or claim live verification when blocked.
9. Review `git diff` and `git status` for task scope and generated artifacts.

## Review Gates

- TDD evidence records the initial targeted failure and subsequent pass.
- A code reviewer checks implementation correctness and edge cases after source changes.
- Change and quality gates run because the change exceeds 30 lines.
- A security review checks URL validation, credential handling, background messaging, and downloaded external data boundaries.
- No Critical or High finding may remain unresolved at delivery.

## Completion Conditions

- Both child acceptance-criteria sets pass.
- The parent acceptance criteria pass as an integrated system.
- Validation reporting distinguishes passed, failed, not run, and environment-blocked checks.
- No commit or external publication occurs without a new explicit user instruction.
