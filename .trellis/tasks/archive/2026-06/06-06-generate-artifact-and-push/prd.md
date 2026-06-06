# Generate artifact and push

## Goal

Generate the Chromium extension artifact from the current `fix/linux-do-wrapper-drawer` branch, commit the generated artifact if it changes, and push the branch to `origin` so the artifact and previous Linux.do wrapper fixes are available remotely.

## Requirements

- Use the repository scripts for artifact generation: `pnpm build` followed by `pnpm pack:zip`.
- Target the Chromium/Chrome/Edge artifact `extension.zip`; do not generate Firefox, Safari, CRX, or XPI artifacts in this task.
- Verify the artifact before commit:
  - `extension.zip` exists and is non-empty.
  - `extension/manifest.json` exists.
  - ZIP integrity passes with `unzip -tq extension.zip`.
  - Manifest remains Linux.do-scoped and Manifest V3.
- Commit only the intended generated artifact and Trellis task metadata required by this task.
- Push the current branch `fix/linux-do-wrapper-drawer` to `origin`.

## Acceptance Criteria

- [ ] `pnpm build` passes.
- [ ] `pnpm pack:zip` passes.
- [ ] `extension.zip` is non-empty and passes ZIP integrity validation.
- [ ] `extension/manifest.json` exists and describes the Linux.do Manifest V3 extension.
- [ ] Git commit records the artifact generation.
- [ ] Branch is pushed to `origin/fix/linux-do-wrapper-drawer`.

## Definition of Done

- Build/package/validation commands have been run and results recorded.
- Commit is created after reviewing the intended diff.
- Push succeeds.
- No unrelated dirty files remain.

## Technical Approach

Run the existing Chromium build and ZIP packaging scripts, validate the ZIP and generated manifest, stage `extension.zip` plus this task metadata, commit with a conventional message, then push the branch with upstream tracking if needed.

## Decision (ADR-lite)

**Context**: The user asked to generate a build artifact after the Linux.do wrapper fix and push the result.

**Decision**: Generate only `extension.zip` through existing project scripts because `package.json` defines it as the Chrome/Edge ZIP artifact and the project spec documents it as the local Chromium artifact.

**Consequences**: Firefox/Safari artifacts are intentionally excluded. `extension/` remains an ignored build directory; `extension.zip` is historically tracked and can be committed when explicitly requested.

## Out of Scope

- Publishing to browser stores.
- Generating Firefox, Safari, CRX, XPI, or source ZIP artifacts.
- Changing source code or documentation beyond Trellis task bookkeeping.

## Technical Notes

- Inspected `package.json`: `build`, `pack:zip`, and `webExt.run.startUrl` target Linux.do.
- Current branch before execution: `fix/linux-do-wrapper-drawer`.
- Existing recent work commit: `269f97cc fix(linux-do): repair drawer routing and docs`.
