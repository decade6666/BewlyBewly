# Contribution Guide

English | [简体中文](CONTRIBUTING-cmn_CN.md)

## Project scope

BewlyLinuxDo is a Linux.do-focused browser extension. Current work should preserve the topic-list browsing context, open topics in an iframe drawer, keep drawer controls usable, and provide homepage cleanup settings for Linux.do pages.

Do not add Bilibili-specific UI, request rewriting, video features, or AI-assisted posting/reply generation. Extension host permissions and content scripts should remain limited to `https://linux.do/*` unless a task explicitly changes that scope.

## Development setup

Install dependencies first:

```bash
pnpm install
```

Run the Chromium development workflow:

```bash
# Optional: create a reusable browser profile for local testing.
mkdir web-ext-profile

# Start Vite and extension build watchers.
pnpm dev

# Open a Chromium test profile at https://linux.do/.
pnpm start:chromium
```

Refresh the Linux.do page after extension rebuilds when the browser does not reload the content script automatically.

## Local Chrome or Edge installation

Build the extension and package the Chromium ZIP:

```bash
pnpm build
pnpm pack:zip
```

Then use one of these methods:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Load the generated `extension/` directory, or use `extension.zip` when a packaged Chromium artifact is required.

Generated `extension/` and `extension.zip` outputs are local artifacts and should not be committed.

## Verification

Run the targeted Linux.do regression test when changing the content script, iframe drawer, homepage cleanup, or migration metadata:

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
```

Run the repository checks before finishing source changes:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm pack:zip
```

When distributing a local Chromium artifact, also verify that `extension/manifest.json` exists, `extension.zip` is non-empty, ZIP integrity passes, and the SHA256 checksum is recorded.

## Documentation updates

Update `README.md`, `README-cmn_CN.md`, and relevant files under `docs/` when project purpose, features, build steps, tests, or validation boundaries change. Keep Chinese user-facing analysis in `*-cmn_CN.md` files when it is not the English canonical document.

## Commit convention

Do not create commits unless the task explicitly asks for one. When committing is requested, use Conventional Commits:

```text
<type>(<scope>): <description>
```

Allowed types include `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, and `ci`.
