# Journal - decade (Part 1)

> AI development session journal
> Started: 2026-05-31

---

## Session 1: Migrate extension to Linux.do finish-work check

**Date**: 2026-06-01
**Task**: Migrate extension to Linux.do finish-work check
**Branch**: `main`

### Summary

Validated the Linux.do migration follow-up: user-confirmed tests completed, lint and typecheck pass after formatting Trellis/Claude metadata, and no tracked source diff remains.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `7a340189` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 2: Migrate Trellis to v0.5.19

**Date**: 2026-06-05
**Task**: Migrate Trellis to v0.5.19
**Branch**: `main`

### Summary

Migrated Trellis project scaffolding to v0.5.19, added Linux.do homepage visibility settings, verified lint/typecheck/tests, and archived the migration task.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4e031a94` | (see git log) |
| `e0525a7f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 3: Write Linux.do migration plan

**Date**: 2026-06-05
**Task**: Write Linux.do migration plan
**Branch**: `docs/migration-plan-20260605`

### Summary

Added a localized BewlyLinuxDo migration plan document, captured documentation-only migration plan conventions in the frontend quality spec, verified lint/typecheck, and archived the Trellis task.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b9707822` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 4: Prepare Windows test artifact

**Date**: 2026-06-05
**Task**: Prepare Windows test artifact
**Branch**: `docs/migration-plan-20260605`

### Summary

Generated and verified a local Chrome/Edge Windows test artifact at extension.zip, documented local Chromium artifact generation in the frontend quality spec, and archived the Trellis task. Artifact checksum: 653c1c0b14c35d410692aa4b8435c90c07d9a9ec61416d6e2cfc4653be1461df.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ccce5a07` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 5: Fix Linux.do drawer routing and docs

**Date**: 2026-06-06
**Task**: Fix Linux.do drawer routing and docs
**Branch**: `fix/linux-do-wrapper-drawer`

### Summary

Fixed Linux.do iframe drawer controls and URL history sync, removed copy-link action, restored homepage pinned-topic hiding, added floating settings controls, updated README/docs/package metadata, refreshed frontend code-specs, and validated with lint, tests, typecheck, and build.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `269f97cc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 6: Generate Linux.do extension artifact

**Date**: 2026-06-06
**Task**: Generate Linux.do extension artifact
**Branch**: `fix/linux-do-wrapper-drawer`

### Summary

Generated Chromium extension artifact with pnpm build and pnpm pack:zip, validated extension.zip integrity and Linux.do Manifest V3 scope, committed the regenerated extension.zip artifact, and prepared the branch for push.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9783ee5d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 7: Publish extension zips via GitHub Packages

**Date**: 2026-06-07
**Task**: Publish extension zips via GitHub Packages
**Branch**: `main`

### Summary

Removed Git-tracked extension.zip and added release-only GitHub Packages publish path: new packages/artifacts scoped npm package @decade6666/bewlylinuxdo-artifacts staged from extension.zip + extension-firefox.zip via scripts/stage-artifacts.ts, release-it.yml gains packages: write and a dedicated Setup GitHub Packages step (install/release-it remain on npmjs.org), Release upload and pnpm run submit unchanged; spec extended with Release Artifact Publishing scenario. Validated by pnpm lint/typecheck/test (53/53), pnpm build-firefox, pnpm pack:zip-firefox, pnpm run stage-artifacts.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b9bddac0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 8: Revert GitHub Packages publish path; keep releases only

**Date**: 2026-06-07
**Task**: Revert GitHub Packages publish path; keep releases only
**Branch**: `main`

### Summary

Rolled back commit b9bddac0: deleted .github/workflows/release-it.yml, scripts/stage-artifacts.ts, packages/artifacts/package.json + directory, package.json stage-artifacts script, and the Release Artifact Publishing to GitHub Packages spec scenario; restored Local Chromium Artifact Generation Git-scope wording. Distribution now only via local npx release-it + .release-it.json after:release hooks (gh release upload, pnpm run submit). extension.zip remains untracked via root *.zip ignore. Validated: pnpm lint, pnpm typecheck, pnpm test 53/53 passed.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0e842ef0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 9: Fix drawer click routing and capture specs

**Date**: 2026-06-10
**Task**: Fix drawer click routing and capture specs
**Branch**: `main`

### Summary

Fixed Linux.do drawer link clicks under Shadow DOM by resolving the real click target with composedPath, kept iframe sandbox protections, validated with targeted tests/typecheck/lint, and captured the drawer click/version contracts in frontend specs.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `21a181e1` | (see git log) |
| `2c15dc25` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 10: Release v0.1.2 to GitHub

**Date**: 2026-06-10
**Task**: Release v0.1.2 to GitHub
**Branch**: `main`

### Summary

Prepared and published GitHub Release v0.1.2 by bumping the package version, validating release-related tests, building and verifying extension.zip plus extension-firefox.zip, generating concise release notes, tagging v0.1.2, and uploading both packaged artifacts to the GitHub release.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4f7f3990` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## 2026-06-18 — Drawer: hide linux.do sidebar + top-right header icons

- Task: 06-18-hide-drawer-sidebar-and-top-right-header-icons-on-linux-do (in_progress)
- Decision: content script has no `all_frames`, so it never runs inside the drawer sub-frame. The drawer iframe `src` is same-origin linux.do, so the host injects a `<style id="bewly-drawer-hidden-chrome">` into `iframeRef.contentDocument` on load instead of relying on iframe-side script.
- Scope (confirmed with user): always-on (no setting). Generic Discourse selectors; language-switch matched loosely under `.d-header` because Cloudflare blocked live DOM inspection.
- Files: `src/sites/linuxDo.ts` (new `applyLinuxDoDrawerChrome`), `src/components/IframeDrawer.vue` (call in `handleIframeLoad`), spec contract + 3 unit/regression tests.
- Verify: vitest 78 pass, tsc clean, eslint clean. Live linux.do DOM NOT verified (Cloudflare) — selectors need browser confirmation.
