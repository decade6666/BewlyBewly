# Implementation Plan: Remove Legacy Settings Tree

## Preconditions

- Execute this child before `07-10-webdav-manual-dialog`.
- Keep sole write ownership of `src/tests/linuxDoMigration.spec.ts` until this child passes review.
- Do not modify WebDAV runtime behavior or central settings fields.
- Record the current diff before source deletion so unrelated planning changes are not mistaken for product changes.

## Step 1 — Establish the Failing Deletion Contract

1. Update `src/tests/linuxDoMigration.spec.ts` to add one focused repository-boundary test that asserts:
   - `src/components/Settings` does not exist;
   - each of the four locale sources lacks a top-level `settings:` key;
   - `knip.json` does not contain `src/components/Settings/**`.
2. Remove or retarget the three dead-source reads as described in `design.md`, while keeping all active assertions.
3. Run only the targeted migration spec and confirm the new deletion contract fails against the still-present tree/config/locales:

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected RED reason: the legacy directory, locale namespaces, and Knip ignore still exist. If failure comes from an unrelated assertion, fix the test setup before deleting source.

## Step 2 — Delete the Proven Dead Tree

Delete every file under `src/components/Settings/**` and no file outside it. Before accepting the deletion, compare the removed paths with the 17-file inventory in `design.md` and the research report.

Do not remove central settings fields, shared components, imports elsewhere, dependencies, or assets as speculative cleanup.

## Step 3 — Remove Tree-Exclusive Localization

For each locale file:

1. Identify the complete top-level `settings:` block by indentation.
2. Remove that block only.
3. Preserve adjacent top-level keys and shared namespaces.
4. Confirm no active `settings.*` caller appears outside the deleted tree.

Files:

```text
src/_locales/en.yml
src/_locales/cmn-CN.yml
src/_locales/cmn-TW.yml
src/_locales/jyut.yml
```

## Step 4 — Update Knip Configuration

Remove `src/components/Settings/**` from `knip.json`'s `ignore` array and retain `src/inject/**` unchanged. Make no other Knip-policy change.

## Step 5 — Reachability and Targeted GREEN Check

1. Search for stale paths, imports, component tags, menu entries, and `settings.*` translation calls.
2. Review every surviving match; migration/model terminology is not automatically a stale component reference.
3. Run the targeted test again and require it to pass:

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
```

## Step 6 — Full Validation

Run in this order so failures remain attributable:

```bash
CI=true pnpm test
pnpm lint
pnpm typecheck
pnpm knip
pnpm build
```

Validation interpretation:

- Any missing import/template compile error indicates the reachability proof was incomplete; restore the deletion unit and investigate rather than deleting more code.
- Any YAML error requires restoring the affected locale boundary and repeating the scoped edit.
- A newly reported unused dependency/asset is documented but not removed in this task.
- Generated `extension/` artifacts remain ignored and must not enter the tracked diff.

## Step 7 — Review Gate

Review the actual diff against the PRD:

- exactly 17 legacy files removed;
- four top-level locale mappings removed, with shared keys preserved;
- only dead-source test assertions removed or retargeted;
- Knip changed only by deleting one ignore;
- no active runtime or central settings code changed.

Run the post-change code reviewer and the applicable change/quality gates. Fix any Critical/High finding and rerun affected validation.

## Rollback Point

If a hidden consumer is found, restore all of these together before replanning:

- `src/components/Settings/**`;
- all four `settings:` locale mappings;
- removed source-regression reads/assertions;
- the Knip ignore.

Do not leave a partially restored legacy UI.

## Completion Conditions

- All acceptance criteria in `prd.md` are evidenced.
- Targeted and full checks are reported as passed, failed, skipped, or blocked.
- The shared migration test is stable for handoff to `07-10-webdav-manual-dialog`.
- No commit, push, dependency cleanup, or asset deletion is performed without separate authorization/scope.
