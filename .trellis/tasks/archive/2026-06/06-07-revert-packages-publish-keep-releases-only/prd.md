# Revert GitHub Packages publish path; keep Releases only

## Goal

Roll back the GitHub Packages publish wiring added by task 06-07-publish-build-zips-to-packages and delete the GitHub Actions release workflow file altogether, so distribution flows only through local `npx release-it` and its existing `gh release upload` after-release hook. Avoid leaving dead workflow steps, scoped artifact package metadata, or spec/scripts that reference the removed publish path.

## What I already know

* The previous task added (now to be removed):
  * `.github/workflows/release-it.yml` (`packages: write`, `Setup GitHub Packages`, `Publish artifacts to GitHub Packages`).
  * `scripts/stage-artifacts.ts`.
  * `packages/artifacts/package.json`.
  * `package.json` script `stage-artifacts`.
  * `.trellis/spec/frontend/quality-guidelines.md` new scenario "Release Artifact Publishing to GitHub Packages" and a one-line Git-scope edit in "Local Chromium Artifact Generation".
* `.release-it.json` `after:release` hooks (`gh release upload v${version} extension.zip extension-firefox.zip`, `pnpm run submit`) are unchanged and continue to attach ZIPs to a GitHub Release when release-it is run.
* `extension.zip` is no longer Git-tracked; root `.gitignore` rule `*.zip` covers all generated ZIPs.
* No GitHub Packages publication has actually occurred (Release workflow was never dispatched).

## Assumptions (validated by user)

* "Delete workflow" means: delete the entire `.github/workflows/release-it.yml` file. Releases will be cut by running `npx release-it` locally.
* Local release-it usage stays the same; no replacement Actions workflow is required by this task.
* Keep `.release-it.json`, `package.json` build/pack scripts, and existing Releases upload behavior intact.
* `extension.zip` should remain Git-untracked (do not re-add it).

## Open Questions

* None.

## Requirements

* Delete `.github/workflows/release-it.yml`.
* Delete `scripts/stage-artifacts.ts`.
* Delete `packages/artifacts/package.json` (and the now-empty `packages/artifacts/` directory if nothing else lives in it).
* Remove the `stage-artifacts` script entry from `package.json`.
* Revert the spec changes in `.trellis/spec/frontend/quality-guidelines.md`:
  * Remove the "Release Artifact Publishing to GitHub Packages" scenario.
  * Restore the "Local Chromium Artifact Generation" Git-scope row to the pre-Packages wording: `extension/` and `extension.zip` are ignored generated artifacts and must not be committed.
* Keep `extension.zip` untracked; do not change root `.gitignore` `*.zip` rule.
* Keep `.release-it.json` and existing build/pack scripts (`pack:zip`, `pack:zip-firefox`, `pack:zip-firefox-sources`) untouched.
* Update Trellis task metadata for this task (prd, jsonl, task.json) and add session journal in finish-work.

## Acceptance Criteria

* [ ] `.github/workflows/release-it.yml` is removed (`git ls-files` does not list it).
* [ ] `scripts/stage-artifacts.ts` is removed.
* [ ] `packages/artifacts/package.json` is removed; `packages/artifacts/` is removed if empty.
* [ ] `package.json` does not contain the `stage-artifacts` script.
* [ ] `.trellis/spec/frontend/quality-guidelines.md` no longer contains the "Release Artifact Publishing to GitHub Packages" scenario.
* [ ] "Local Chromium Artifact Generation" Git scope row reads: `extension/` and `extension.zip` are ignored generated artifacts and must not be committed.
* [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass after the revert.
* [ ] `git diff` shows only the revert plus task metadata; no source/runtime behavior changes outside the listed scope.

## Definition of Done

* Validation commands (`pnpm lint`, `pnpm typecheck`, `pnpm test`) recorded.
* Trellis task metadata lint-clean.
* Commit message follows Conventional Commits.
* No remaining references to the removed Packages publish path in code, scripts, workflows, or spec.

## Out of Scope

* Re-adding any Actions-based release workflow.
* Changing `.release-it.json` hooks or local release-it usage.
* Re-tracking `extension.zip` or changing `.gitignore`.
* Changing browser-store submission behavior.

## Technical Approach

Mechanical revert mapped 1:1 to the previous task's diff: delete the four new files/blocks, remove the `package.json` script, and revert the spec changes. Validate with project lint/typecheck/test. No new code needed.

## Decision (ADR-lite)

**Context**: User prefers a single, simple distribution path. GitHub Releases via local `npx release-it` + `gh release upload` already satisfies "downloadable extension ZIP per version" without requiring CI permissions, scoped npm packages, or staging directories. The previous Packages workflow has never published anything (no `workflow_dispatch` run), so removal is safe.

**Decision**: Delete the Actions release workflow and all GitHub Packages wiring. Keep `.release-it.json` and local release-it as the single release path.

**Consequences**: Releases must be cut manually (locally). No automated CI release. No GitHub Packages presence. The two ZIPs are attached only to GitHub Releases via the existing after:release hook when release-it runs.

## Technical Notes

* No new external research required; this is a revert of a known set of additions in commit `b9bddac0`.
* Watch for stale references to `packages/artifacts`, `stage-artifacts`, or "GitHub Packages" in spec/scripts/workflow files.
