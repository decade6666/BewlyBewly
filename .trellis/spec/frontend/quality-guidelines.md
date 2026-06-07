# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

This project uses repository-wide linting and type checking for both extension source code and project metadata. Treat `.claude/` and `.trellis/` Markdown/YAML/JSON files as linted project files when they are tracked.

---

## Scenario: Finish-work Verification and Local Metadata Hygiene

### 1. Scope / Trigger

- Trigger: before committing code or project metadata after implementation, migration, or Trellis workflow updates.
- Applies to source files, `.claude/` agent/command files, `.trellis/` specs/tasks/workspace files, and root project configuration.

### 2. Signatures

Use the scripts defined in `package.json`:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Local-only Claude settings path:

```text
.claude/settings.local.json
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Lint command | `pnpm lint` runs `eslint` across the repository. |
| Typecheck command | `pnpm typecheck` runs `vue-tsc`; do not use `pnpm type-check` unless the script exists. |
| Test command | `pnpm test` runs `vitest test`; relevant tests must pass for code changes. |
| Local Claude settings | `.claude/settings.local.json` is machine-local and must stay ignored by Git. |
| Tracked metadata | Markdown/YAML/JSON under `.claude/` and `.trellis/` must remain lint-clean. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| `pnpm type-check` is referenced | Use `pnpm typecheck`, matching the actual project script. |
| Markdown contains JSON Lines examples | Mark fenced blocks as `jsonl`, not `json`, so each line can be parsed correctly. |
| Markdown/YAML has trailing spaces, repeated blank lines, bad comment spacing, or missing EOF newline | Run `pnpm exec eslint --fix <files>` or edit manually, then rerun `pnpm lint`. |
| `.claude/settings.local.json` appears in Git status | Add or keep `.claude/settings.local.json` in `.gitignore`; do not stage it. |
| Source code changed but only metadata checks ran | Run the relevant source tests before claiming finish-work completion. |

### 5. Good/Base/Bad Cases

- Good: code changes pass `pnpm lint`, `pnpm typecheck`, and relevant `pnpm test`; local settings remain ignored.
- Base: metadata-only updates pass `pnpm lint`, with `git status --short` confirming no local settings are staged.
- Bad: documenting `pnpm type-check`, committing `.claude/settings.local.json`, or leaving invalid Markdown fenced as `json` when the content is JSON Lines.

### 6. Tests Required

- `pnpm lint`: assert zero lint errors after source or metadata changes.
- `pnpm typecheck`: assert Vue/TypeScript types pass after source changes.
- `pnpm test`: assert relevant Vitest coverage passes after behavior changes.
- `git status --short`: assert `.claude/settings.local.json` does not appear as a staged or untracked file.

### 7. Wrong vs Correct

#### Wrong

```bash
pnpm type-check
```

````markdown
```json
{"file": "...", "reason": "TypeCheck"}
{"file": "...", "reason": "Lint"}
```
````

#### Correct

```bash
pnpm typecheck
```

````markdown
```jsonl
{"file": "...", "reason": "TypeCheck"}
{"file": "...", "reason": "Lint"}
```
````

---

## Scenario: Documentation-only Migration Plan Updates

### 1. Scope / Trigger

- Trigger: preserving migration, porting, or research plans as repository documentation without changing runtime behavior.
- Applies to Markdown planning documents under `docs/` and the matching Trellis task metadata.

### 2. Signatures

Localized plan filename pattern:

```text
docs/<topic>-cmn_CN.md
```

Validation commands:

```bash
pnpm lint
git diff --name-only
git status --short --untracked-files=all
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Localized Chinese plan | Use a `-cmn_CN.md` suffix when preserving user-facing Chinese analysis instead of changing the English canonical documentation convention. |
| Evidence scope | Include local source paths and external URLs used as evidence. |
| Validation boundaries | Mark failed or blocked external fetches as unverified; do not promote them to stable API assumptions. |
| Runtime behavior | Documentation-only tasks must not modify `src/`, build config, extension permissions, or storage schemas. |
| Task metadata | Keep Trellis JSON/JSONL metadata lint-clean and remove template `_example` rows before finish-work. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| The plan is Chinese user-facing content | Use `docs/<topic>-cmn_CN.md` and keep `.trellis/spec/frontend/index.md` English-doc convention unchanged. |
| External endpoint fetch failed or was blocked by Cloudflare/Turnstile | Document the failure as a validation boundary and require real-browser verification before implementation. |
| Source files appear in `git diff --name-only` for a docs-only task | Stop and review scope; remove unrelated behavior changes unless a new task explicitly authorizes them. |
| Trellis JSONL still contains `_example` template rows | Delete the template rows and keep only task-specific implementation/check records. |

### 5. Good/Base/Bad Cases

- Good: `docs/bewly-linux-do-migration-plan-cmn_CN.md` lists source paths, external URLs, failed `latest.json` / `top.json` boundaries, and no source files changed.
- Base: a docs-only plan passes `pnpm lint` and `git diff --name-only` shows only docs and Trellis metadata.
- Bad: an unsuffixed Chinese plan looks like canonical English docs, or a failed endpoint is described as a verified contract.

### 6. Tests Required

- `pnpm lint`: assert Markdown and Trellis metadata are lint-clean.
- `git diff --name-only`: assert no source/runtime files changed for documentation-only tasks.
- `git status --short --untracked-files=all`: assert the new plan and task metadata are the only relevant untracked paths before staging.
- Manual document review: assert the plan includes priority, roadmap, evidence paths, external URLs, non-goals, and validation boundaries.

### 7. Wrong vs Correct

#### Wrong

```text
docs/bewly-linux-do-migration-plan.md
```

```markdown
`https://linux.do/latest.json` is available for the migration.
```

#### Correct

```text
docs/bewly-linux-do-migration-plan-cmn_CN.md
```

```markdown
`https://linux.do/latest.json` was blocked during extraction and must be verified in a real browser session before implementation.
```

---

## Scenario: Local Chromium Artifact Generation

### 1. Scope / Trigger

- Trigger: generating a local downloadable artifact for Chrome/Edge testing.
- Applies to ignored local build outputs: `extension/` and `extension.zip`.

### 2. Signatures

Build and package commands:

```bash
pnpm build
pnpm pack:zip
```

Expected artifact paths:

```text
extension/
extension/manifest.json
extension.zip
```

### 3. Contracts

| Item | Contract |
|------|----------|
| `pnpm build` | Builds the Chromium extension directory at `extension/`. |
| `pnpm pack:zip` | Packs `extension/*` into `extension.zip`; run it after `pnpm build`. |
| Chrome/Edge ZIP | Use `extension.zip` as the downloadable Windows test artifact. |
| Manifest | `extension/manifest.json` must exist after build and describe a Manifest V3 extension. |
| Git scope | `extension/`, `extension*.zip`, and `packages/artifacts/*.zip` are ignored generated artifacts and must not be committed; `extension.zip` is no longer Git-tracked and is published via the release flow (see Release Artifact Publishing to GitHub Packages). |
| Firefox/Safari outputs | Do not generate them unless the task explicitly requests Firefox or Safari testing. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| `extension.zip` is missing or zero bytes | Re-run `pnpm build` then `pnpm pack:zip`; do not report a downloadable artifact. |
| `extension/manifest.json` is missing | Treat the build as failed even if a ZIP exists. |
| ZIP integrity fails | Re-run packaging and verify with `unzip -tq extension.zip`. |
| `git status` shows `extension/` or `extension.zip` as unignored | Fix ignore rules before committing any task metadata. |
| User asks for Windows Chrome/Edge testing | Provide `extension.zip` path, byte size, SHA256, and brief Chrome/Edge install steps. |

### 5. Good/Base/Bad Cases

- Good: `pnpm build`, `pnpm pack:zip`, `unzip -tq extension.zip`, `pnpm lint`, and `pnpm typecheck` pass; final response includes path, size, and SHA256.
- Base: artifact generation succeeds and `git diff --name-only` shows no tracked source/config changes.
- Bad: reporting `extension-firefox.zip` or `.xpi` for a Chrome/Edge Windows test, or committing ignored generated artifacts.

### 6. Tests Required

- `pnpm build`: assert the Chromium build completes and creates `extension/`.
- `pnpm pack:zip`: assert `extension.zip` is created from the latest `extension/` build.
- `unzip -tq extension.zip`: assert ZIP integrity.
- Filesystem checks: assert `extension.zip` is non-empty and `extension/manifest.json` exists.
- `sha256sum extension.zip`: record checksum for Windows download verification.
- `git diff --name-only` and `git diff --cached --name-only`: assert no tracked source/config changes were introduced by packaging.

### 7. Wrong vs Correct

#### Wrong

```bash
pnpm pack:zip
```

```text
Tell the user to download extension-firefox.zip for Chrome testing.
```

#### Correct

```bash
pnpm build
pnpm pack:zip
unzip -tq extension.zip
sha256sum extension.zip
```

```text
/root/github/BewlyLinuxDo/extension.zip
```

---

## Scenario: Release Artifact Publishing to GitHub Packages

### 1. Scope / Trigger

- Trigger: cutting a release via `.github/workflows/release-it.yml`, or changing the release/publish flow for extension ZIP build artifacts.
- Applies to `.github/workflows/release-it.yml`, `.release-it.json`, `package.json`, `scripts/stage-artifacts.ts`, `packages/artifacts/package.json`, and `.gitignore`.
- This is a code-spec scenario because it wires CI permissions, npm registry auth, scoped package identity, and a staging directory contract that downstream releases must follow exactly.

### 2. Signatures

Release workflow publish steps:

```yaml
permissions:
  contents: write
  packages: write
  id-token: write

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: lts/*
      registry-url: 'https://registry.npmjs.org'

  # ... install / release-it ...

  - name: Setup GitHub Packages
    uses: actions/setup-node@v4
    with:
      node-version: lts/*
      registry-url: 'https://npm.pkg.github.com'
      scope: '@decade6666'

  - name: Publish artifacts to GitHub Packages
    run: pnpm run stage-artifacts && cd packages/artifacts && npm publish
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Artifact package metadata:

```json
{
  "name": "@decade6666/bewlylinuxdo-artifacts",
  "version": "0.0.0",
  "private": false,
  "license": "UNLICENSED",
  "repository": "github:decade6666/BewlyLinuxDo",
  "files": ["*.zip"]
}
```

Staging script signature:

```bash
pnpm run stage-artifacts
# = esno scripts/stage-artifacts.ts
# Inputs: extension.zip, extension-firefox.zip at repo root
# Outputs: packages/artifacts/extension.zip, packages/artifacts/extension-firefox.zip,
#          packages/artifacts/package.json (version synced from root package.json)
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Package name | `@decade6666/bewlylinuxdo-artifacts`; scope must match the GitHub owner. |
| Package files | `"files": ["*.zip"]`; only ZIP build artifacts are shipped. |
| Template version | `packages/artifacts/package.json` is tracked with `version: "0.0.0"`; CI rewrites it before publish. |
| Source of truth for version | Root `package.json` `version`, already bumped by `release-it`. |
| Required release ZIPs | `extension.zip` and `extension-firefox.zip` must exist at repo root before `pnpm run stage-artifacts`. |
| Registry routing | First `setup-node` keeps `registry.npmjs.org` for install/`release-it`; a second `setup-node` switches to `https://npm.pkg.github.com` with `scope: '@decade6666'` only before the publish step. |
| Permissions | Workflow must declare `packages: write`; `npm publish` uses `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. |
| Token policy | No PAT or hardcoded token; `GITHUB_TOKEN` auto-scopes to the workflow's repository. |
| Tracked artifacts | `extension.zip` and `extension-firefox.zip` are never Git-tracked; root `*.zip` rule covers `packages/artifacts/*.zip` as well. |
| Preserved release behavior | `.release-it.json` `after:release` hooks (`gh release upload`, `pnpm run submit`) remain unchanged. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| `extension.zip` or `extension-firefox.zip` missing before publish | `scripts/stage-artifacts.ts` exits non-zero; do not proceed with `npm publish`. |
| Root `package.json.version` empty or unreadable | Staging script exits non-zero; fix release-it bump before re-running. |
| Workflow missing `packages: write` | `npm publish` returns 403; restore permission. |
| `packages/artifacts/package.json` switched to unscoped name | GitHub Packages rejects publish; restore scoped name `@decade6666/...`. |
| `packages/artifacts/package.json` set to `"private": true` | npm refuses to publish; keep `"private": false` in the artifact package while root `package.json` stays `"private": true`. |
| Someone re-tracks `extension.zip` or commits `packages/artifacts/*.zip` | Untrack with `git rm --cached`; rely on root `*.zip` rule. |
| First `setup-node` is changed to GitHub Packages registry | Revert to `registry.npmjs.org`; only the second `setup-node` may target GitHub Packages so dependency install/`release-it` are unaffected. |
| Local validation runs `pnpm run stage-artifacts` | Restore `packages/artifacts/package.json` `version` to `0.0.0` before staging changes. |

### 5. Good/Base/Bad Cases

- Good: release workflow installs deps against npmjs.org, runs `release-it` which bumps version and produces ZIPs, then a dedicated `Setup GitHub Packages` step routes only the final `npm publish` to `npm.pkg.github.com` with `GITHUB_TOKEN`, and `gh release upload` plus `pnpm run submit` still run as before.
- Base: workflow YAML, `packages/artifacts/package.json`, and `scripts/stage-artifacts.ts` agree on the same package name, scope, file list, and version source; local `pnpm run stage-artifacts` succeeds with version restored to `0.0.0` afterward.
- Bad: changing the only `setup-node` step to GitHub Packages registry (breaks dependency install), publishing from the repo root instead of `packages/artifacts/`, committing `packages/artifacts/extension.zip`, or hardcoding a PAT instead of `GITHUB_TOKEN`.

### 6. Tests Required

- `pnpm lint`: assert workflow/scripts/metadata are lint-clean.
- `pnpm typecheck`: assert `scripts/stage-artifacts.ts` types pass.
- `pnpm test`: assert source regressions (including `linuxDoMigration.spec.ts`) still pass when release flow is touched.
- `pnpm build && pnpm pack:zip && pnpm build-firefox && pnpm pack:zip-firefox`: assert both ZIPs are produced.
- `pnpm run stage-artifacts`: assert `packages/artifacts/extension.zip` and `packages/artifacts/extension-firefox.zip` exist and `packages/artifacts/package.json.version` equals root `package.json.version`.
- `git check-ignore -v packages/artifacts/package.json packages/artifacts/extension.zip`: assert `package.json` is NOT ignored and `extension.zip` IS ignored by `.gitignore:*.zip`.
- `git ls-files extension.zip`: assert no longer tracked.

### 7. Wrong vs Correct

#### Wrong

```yaml
- name: Set node
  uses: actions/setup-node@v4
  with:
    node-version: lts/*
    registry-url: 'https://npm.pkg.github.com'
    scope: '@decade6666'

- name: Publish artifacts to GitHub Packages
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.PERSONAL_PAT }}
```

```json
{
  "name": "bewlylinuxdo-artifacts",
  "private": true,
  "version": "0.41.1"
}
```

#### Correct

```yaml
- name: Set node
  uses: actions/setup-node@v4
  with:
    node-version: lts/*
    registry-url: 'https://registry.npmjs.org'

# ... pnpm install, release-it ...

- name: Setup GitHub Packages
  uses: actions/setup-node@v4
  with:
    node-version: lts/*
    registry-url: 'https://npm.pkg.github.com'
    scope: '@decade6666'

- name: Publish artifacts to GitHub Packages
  run: pnpm run stage-artifacts && cd packages/artifacts && npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

```json
{
  "name": "@decade6666/bewlylinuxdo-artifacts",
  "version": "0.0.0",
  "private": false,
  "license": "UNLICENSED",
  "repository": "github:decade6666/BewlyLinuxDo",
  "files": ["*.zip"]
}
```

---

## Scenario: Linux.do Content-Script Overlay and AutoImport DTS Boundaries

### 1. Scope / Trigger

- Trigger: changing Linux.do content-script root overlays, iframe drawer mounting, or Vite AutoImport declaration generation.
- Applies to `src/contentScripts/views/App.vue`, Linux.do migration tests, and `vite.config.ts` AutoImport configuration.

### 2. Signatures

Content-script wrapper template contract:

```vue
<div v-if="showIframeDrawer" id="bewly-wrapper" class="linux-do-drawer-root">
  <div class="linux-do-drawer">
    <IframeDrawer :url="iframeDrawerURL" @close="showIframeDrawer = false" />
  </div>
</div>
```

AutoImport declaration contract:

```typescript
AutoImport({
  imports: ['vue'],
  dts: isDev && process.env.NODE_ENV === 'development'
    ? r('src/auto-imports.d.ts')
    : false,
})
```

### 3. Contracts

| Item | Contract |
|------|----------|
| `showIframeDrawer` | Single runtime gate for rendering `#bewly-wrapper` and the iframe drawer. |
| `#bewly-wrapper` | Must not exist in the default Linux.do page DOM before the drawer is opened. |
| `.linux-do-drawer-root` | May keep `position: fixed`, `inset: 0`, and max z-index only because it is mounted on demand. |
| `AutoImport.dts` | Writes `src/auto-imports.d.ts` only during explicit development mode. |
| Test / production builds | Must not create or modify `src/auto-imports.d.ts`. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| App mounts on Linux.do and no topic drawer is open | Do not render `#bewly-wrapper`. |
| User clicks a valid Linux.do topic link on a topic-list page | Set `showIframeDrawer = true`, render wrapper, and show `IframeDrawer`. |
| Drawer emits `close` | Set `showIframeDrawer = false`, unmounting the wrapper. |
| Vitest or production build runs | `src/auto-imports.d.ts` remains absent or unchanged. |
| `pnpm build` regenerates extension artifacts | Generated artifacts remain out of the tracked source diff unless explicitly requested. |

### 5. Good/Base/Bad Cases

- Good: the wrapper opening tag contains both `id="bewly-wrapper"` and `v-if="showIframeDrawer"`; targeted migration tests assert this boundary.
- Base: drawer internals are conditionally hidden, but the fixed wrapper itself is still gated by the same state.
- Bad: `#bewly-wrapper` is always mounted with `position: fixed; inset: 0; z-index: 2147483647`, or AutoImport writes declarations during tests/builds.

### 6. Tests Required

- `src/tests/linuxDoMigration.spec.ts`: assert the `#bewly-wrapper` opening tag contains `v-if="showIframeDrawer"`.
- Targeted regression: `pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1`.
- Source validation after behavior/build-config changes: `pnpm lint`, `pnpm typecheck`, and relevant `pnpm test` or `CI=true pnpm test`.
- Build artifact validation when packaging: `pnpm build`, `pnpm pack:zip`, `unzip -tq extension.zip`, and confirm generated artifacts are not unintentionally staged.

### 7. Wrong vs Correct

#### Wrong

```vue
<div id="bewly-wrapper" class="linux-do-drawer-root">
  <div v-if="showIframeDrawer" class="linux-do-drawer">
    <IframeDrawer :url="iframeDrawerURL" />
  </div>
</div>
```

This mounts the full-screen highest z-index wrapper even when the drawer is closed.

#### Correct

```vue
<div v-if="showIframeDrawer" id="bewly-wrapper" class="linux-do-drawer-root">
  <div class="linux-do-drawer">
    <IframeDrawer :url="iframeDrawerURL" />
  </div>
</div>
```

The full-screen wrapper only exists while the drawer is open.

---

## Scenario: Linux.do Project Identity Metadata

### 1. Scope / Trigger

- Trigger: changing project README files, contribution docs, package metadata, manifest identity, or extension launch targets after migration work.
- Applies to `package.json`, `src/manifest.ts`, localized `README*.md`, localized `docs/CONTRIBUTING*.md`, and `src/tests/linuxDoMigration.spec.ts`.
- This is a repository metadata contract because local development, generated manifest fields, user documentation, and regression tests must all describe the same Linux.do-only extension.

### 2. Signatures

Package metadata fields:

```json
{
  "name": "bewly-linux-do",
  "displayName": "BewlyLinuxDo",
  "homepage": "https://github.com/decade6666/BewlyLinuxDo",
  "webExt": {
    "run": {
      "startUrl": ["https://linux.do/"]
    }
  }
}
```

Manifest identity contract:

```typescript
const manifest = await getManifest()

manifest.name // /^BewlyLinuxDo(?: Dev)?$/
manifest.homepage_url // https://github.com/decade6666/BewlyLinuxDo
manifest.host_permissions // ['https://linux.do/*']
```

Documentation scope:

```text
README.md
README-cmn_CN.md
README-cmn_TW.md
README-jyut.md
docs/CONTRIBUTING.md
docs/CONTRIBUTING-cmn_CN.md
docs/CONTRIBUTING-cmn_TW.md
docs/CONTRIBUTING-jyut.md
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Package name | Use `bewly-linux-do`; do not keep upstream `BewlyBewly` package identity. |
| Display name | Use `BewlyLinuxDo`; generated dev manifest may append ` Dev`. |
| Homepage URL | Use the current repository URL `https://github.com/decade6666/BewlyLinuxDo`. |
| Launch target | `webExt.run.startUrl` must start local browser testing at `https://linux.do/`. |
| Manifest permissions | Host permissions and content-script matches are scoped to `https://linux.do/*`. |
| Docs purpose | README and contributing docs describe a Linux.do browser extension, not a Bilibili enhancement extension. |
| Localized docs | English, Simplified Chinese, Traditional Chinese, and Jyutping/Yue docs stay aligned on purpose, features, install/build/test commands, and contribution scope. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| `package.json` still references `BewlyBewly`, Bilibili, or upstream homepage | Update metadata before committing migration work. |
| Manifest host permissions include non-Linux.do domains | Treat as a regression; remove unrelated host permissions unless a task explicitly adds them. |
| README docs describe Bilibili features or store links | Rewrite docs to current Linux.do purpose and installation/build flow. |
| Only one locale README is updated | Update all localized README and CONTRIBUTING files or document why a locale is intentionally skipped. |
| Package metadata changes without a regression test | Add/update `linuxDoMigration.spec.ts` assertions for package and manifest identity. |

### 5. Good/Base/Bad Cases

- Good: package metadata, generated manifest, all README variants, and all CONTRIBUTING variants consistently describe BewlyLinuxDo for Linux.do only.
- Base: a docs-only wording update changes all localized variants but does not touch runtime permissions.
- Bad: English README is updated while Traditional Chinese or Jyutping docs still instruct contributors to run against Bilibili.

### 6. Tests Required

- `src/tests/linuxDoMigration.spec.ts`: assert package `name`, `displayName`, `homepage`, description scope, and `webExt.run.startUrl`.
- `src/tests/linuxDoMigration.spec.ts`: assert manifest `name`, `homepage_url`, host permissions, content-script matches, and blocked legacy targets.
- `pnpm lint`: assert Markdown and JSON metadata are lint-clean.
- `pnpm typecheck`: assert manifest typing still passes after metadata changes.
- `pnpm build`: assert generated manifest keeps Linux.do-only scope when packaging is affected.

### 7. Wrong vs Correct

#### Wrong

```json
{
  "displayName": "BewlyBewly",
  "homepage": "https://github.com/BewlyBewly/BewlyBewly",
  "webExt": {
    "run": {
      "startUrl": ["https://www.bilibili.com/"]
    }
  }
}
```

#### Correct

```json
{
  "displayName": "BewlyLinuxDo",
  "homepage": "https://github.com/decade6666/BewlyLinuxDo",
  "webExt": {
    "run": {
      "startUrl": ["https://linux.do/"]
    }
  }
}
```

---

## Forbidden Patterns

- Do not commit `.claude/settings.local.json`; it contains local session hooks and developer-machine settings.
- Do not leave tracked project metadata outside lint coverage or assume `.md`, `.yaml`, and `.json` files are exempt from `pnpm lint`.
- Do not claim finish-work completion for source changes without running the relevant source validation.

---

## Required Patterns

- Use the exact project scripts in `package.json`: `pnpm lint`, `pnpm typecheck`, and `pnpm test`.
- Keep tracked Trellis and Claude metadata lint-clean when those directories are part of the change.
- For JSON Lines examples in Markdown, use `jsonl` fenced code blocks.

---

## Testing Requirements

- Source or behavior change: run `pnpm lint`, `pnpm typecheck`, and relevant `pnpm test`.
- Metadata-only change: run `pnpm lint` and inspect `git status --short` / `git diff --name-only` for scope.
- If a user already completed manual or automated tests outside the agent session, record that fact explicitly instead of rerunning or overstating coverage.

---

## Code Review Checklist

- [ ] Validation commands match `package.json` script names.
- [ ] `.claude/settings.local.json` is ignored and not staged.
- [ ] Markdown code fences match their content format, especially `jsonl` for JSON Lines.
- [ ] Trellis/Claude metadata changes are intentional and lint-clean.
- [ ] Source changes have relevant typecheck and test evidence.
