# Remove Legacy Settings Tree and Unused Translations

## Goal

Delete the unmounted legacy settings component tree and its tree-exclusive four-language localization namespace so the repository retains only the active Linux.do settings surface, without changing active settings or runtime behavior.

## Confirmed Background

- `src/components/Settings/**` contains 17 files and 2,855 lines.
- Exact repository search found no external import, route, mount, menu, template consumer, or independent descendant consumer.
- `vite.config.ts` auto-imports functions but has no component auto-registration plugin, so the tree is not implicitly reachable.
- The active Linux.do settings panel is `src/contentScripts/views/App.vue` and uses local `appMessages`, not the `_locales` top-level `settings:` namespace.
- No `settings.*` translation caller exists outside the legacy tree.
- Three source-regression tests read dead-tree files directly; those reads are test dependencies, not runtime consumers.
- Central persisted settings and shared components outside this tree remain active and are not owned by this deletion.

## Requirements

### R1 — Delete the proven dead component boundary

- Delete every file under `src/components/Settings/**` and no source file outside that path.
- Remove the stale `src/components/Settings/**` entry from `knip.json`'s ignore list while preserving unrelated Knip configuration.
- Re-run exact reachability searches after deletion to detect any stale path, import, menu, component-tag, or template reference.

### R2 — Remove tree-exclusive localization

- Delete the complete top-level `settings:` mapping from `src/_locales/en.yml`, `cmn-CN.yml`, `cmn-TW.yml`, and `jyut.yml`.
- Preserve adjacent top-level mappings, shared namespaces such as `common.*`, and every message used by active runtime surfaces.
- Keep the active `App.vue` inline message table unchanged in this child.

### R3 — Retarget tests to maintained contracts

- Remove the obsolete About/version source assertion that reads the deleted `About.vue`; do not invent replacement UI for dead content.
- Remove the legacy Home settings source read/assertion from guideline-field cleanup coverage while preserving active storage, migration, and locale assertions.
- Remove the deleted DataSync source read/assertion from WebDAV background-routing coverage while preserving active `App.vue`, settings sync, background listener, WebDAV wrapper, and permission assertions.
- Add a focused repository-boundary regression test for the absent tree, absent four-language top-level namespace, and absent Knip ignore.
- Do not weaken any active Linux.do behavior contract.

### R4 — Hold the preservation boundary

- Do not remove or alter central `Settings` fields/defaults, stores, composables, active content-script behavior, shared components outside the tree, WebDAV transport, background permissions, package dependencies, or static assets.
- Report any newly suspected unused dependency or asset for a separate whole-repository audit rather than expanding this child.

## Acceptance Criteria

- [ ] **R1:** `src/components/Settings/**` no longer exists and exact repository search finds no stale path, import, menu, component-tag, or template reference.
- [ ] **R1:** `knip.json` no longer ignores `src/components/Settings/**` and all unrelated configuration is unchanged.
- [ ] **R2:** All four locale files have no top-level `settings:` mapping, remain valid, and retain shared/active localization.
- [ ] **R3:** Tests no longer read deleted files and still assert active migration, WebDAV background routing, and permission contracts.
- [ ] **R3:** A repository-boundary test prevents the dead tree, locale namespace, or stale Knip ignore from returning unnoticed.
- [ ] **R4:** No central settings field, shared component outside the tree, active runtime source, dependency, or static asset is removed or behaviorally changed.
- [ ] Targeted migration tests, full tests, lint, typecheck, Knip, and build pass, with generated artifacts remaining untracked.

## Dependencies and Ordering

Implement this child before sibling task `07-10-webdav-manual-dialog`. Both modify `src/tests/linuxDoMigration.spec.ts`, so this child retains sole ownership until its review and validation finish.

## Out of Scope

- Redesigning the active settings panel or WebDAV behavior.
- Removing central persisted settings fields or runtime consumers.
- Removing shared components outside `src/components/Settings/**`.
- Removing package dependencies or static assets without a separate whole-repository unused-resource audit.
- Committing, pushing, publishing, or releasing without separate explicit authorization.
