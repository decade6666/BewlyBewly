# Update downloadable artifact for Windows testing

## Goal

Generate a fresh local browser-extension artifact that the user can download to Windows and test in Chrome or Edge.

## What I already know

- The user asked: “更新产物并告知路径，我下载到Windows测试”.
- `package.json` defines production build and packaging scripts:
  - `pnpm build` builds the Chromium extension into `extension/`.
  - `pnpm pack:zip` creates `extension.zip` from `extension/*`.
- `README.md` recommends Chrome/Edge local installation by dragging `extension.zip` into `chrome://extensions` or `edge://extensions`.
- `.gitignore` ignores generated artifacts: `*.zip`, `extension/`, `extension-firefox/`, `extension-safari/`.

## Assumptions

- “Windows 测试” means Chrome/Edge testing unless the user later asks for Firefox (`extension-firefox.zip`) or XPI.
- Generated artifacts should stay local and ignored, not committed.

## Requirements

- Build the current branch into a fresh Chromium-compatible extension directory.
- Package the extension into `extension.zip` for Windows download/testing.
- Report exact artifact path, unpacked directory path, size, and checksum.
- Do not modify application source code.
- Do not commit ignored generated artifacts.

## Acceptance Criteria

- [ ] `pnpm build` completes successfully.
- [ ] `pnpm pack:zip` completes successfully.
- [ ] `/root/github/BewlyLinuxDo/extension.zip` exists and is non-empty.
- [ ] `/root/github/BewlyLinuxDo/extension/manifest.json` exists.
- [ ] Final response includes Windows-test install guidance and exact local paths.
- [ ] No tracked source files are changed by the build/package step.

## Definition of Done

- Fresh Chrome/Edge ZIP artifact generated.
- Narrow validation records artifact metadata and manifest presence.
- Working tree remains clean except Trellis task metadata if not yet archived.
- User receives paths suitable for downloading the artifact from this Linux environment to Windows.

## Technical Approach

Run the repository’s existing scripts instead of inventing new packaging behavior:

```bash
pnpm build
pnpm pack:zip
```

Then validate the artifact with filesystem checks and a checksum command.

## Decision (ADR-lite)

**Context**: The user needs a downloadable Windows testing artifact quickly.

**Decision**: Generate the Chromium ZIP artifact (`extension.zip`) because the repository README marks Edge/Chrome ZIP installation as the recommended local path, and Windows users can drag the ZIP into Chrome/Edge extension pages.

**Consequences**: Firefox/XPI and Safari artifacts are out of scope for this task; they can be generated separately if needed.

## Out of Scope

- Building Firefox (`extension-firefox.zip`, `.xpi`) or Safari artifacts.
- Publishing/uploading the artifact externally.
- Changing extension source code, version numbers, or release metadata.
- Committing generated `extension/` or `extension.zip` artifacts.

## Technical Notes

- `package.json` lines 17-29 define build and packaging commands.
- `README.md` local installation section documents Chrome/Edge drag-and-drop installation for `extension.zip`.
- `.gitignore` ignores build outputs and ZIP artifacts.
