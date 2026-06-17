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
| Git scope | `extension/` and `extension.zip` are ignored generated artifacts and must not be committed. |
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

## Scenario: Package Version, Manifest Version, and Display Version

### 1. Scope / Trigger

- Trigger: changing extension version metadata, generated manifest identity, or About/settings UI version display.
- Applies to `package.json`, `src/manifest.ts`, `src/components/Settings/About/About.vue`, generated `extension/manifest.json`, and `src/tests/linuxDoMigration.spec.ts`.
- This is a metadata/build contract because npm tooling expects SemVer, while WebExtension manifest and user-facing UI may use a shorter display version.

### 2. Signatures

Package metadata:

```json
{
  "version": "0.1.0"
}
```

Manifest generation:

```typescript
function formatManifestVersion(version: string): string

const manifest: Manifest.WebExtensionManifest = {
  version: formatManifestVersion(pkg.version),
}
```

About UI display:

```typescript
const displayVersion = computed(() => formatDisplayVersion(version))
```

### 3. Contracts

| Field | Contract |
|------|----------|
| `package.json.version` | Must remain SemVer-valid for pnpm/npm tooling and `npm-run-all`; use `0.1.0`, not `0.1`. |
| `manifest.version` | May be formatted from package SemVer to the extension-facing value, such as `0.1`. |
| About UI display | May use the same display format as the extension-facing version, such as `v0.1`. |
| Build scripts | Keep existing `run-s` / `run-p` scripts unless a task explicitly changes the build runner. |
| Tests | Assert package version, manifest version, and UI display version separately when they intentionally differ. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| User asks for `v0.1` display | Keep `package.json.version` SemVer-valid and format only the manifest/UI value. |
| `package.json.version` is set to `0.1` | Treat as a regression because npm tooling can reject the invalid SemVer. |
| Build scripts are rewritten only to support an invalid package version | Revert the script rewrite and use an explicit formatter instead. |
| Generated `extension/manifest.json` has the wrong version after build | Fix `src/manifest.ts` formatter or tests before shipping. |

### 5. Good/Base/Bad Cases

- Good: `package.json` uses `0.1.0`, About displays `v0.1`, and generated manifest contains `"version": "0.1"`.
- Base: package, manifest, and UI all use the same SemVer string when no shorter display version is required.
- Bad: setting package version to `0.1` and replacing project build scripts to work around tooling errors.

### 6. Tests Required

- `src/tests/linuxDoMigration.spec.ts`: assert package version remains SemVer-valid.
- `src/tests/linuxDoMigration.spec.ts`: assert `getManifest()` emits the expected manifest version.
- Source test or component source assertion: assert About UI uses a display-version formatter instead of directly rendering package SemVer when display differs.
- `pnpm build`: assert generated `extension/manifest.json` has the intended version.
- `pnpm lint` and `pnpm typecheck`: assert metadata and TypeScript changes remain valid.

### 7. Wrong vs Correct

#### Wrong

```json
{
  "version": "0.1",
  "scripts": {
    "build": "node scripts/custom-runner.mjs clear build:web build:prepare build:js build:bg"
  }
}
```

This changes the build system to accommodate invalid package metadata.

#### Correct

```json
{
  "version": "0.1.0",
  "scripts": {
    "build": "cross-env NODE_ENV=production run-s clear build:web build:prepare build:js build:bg"
  }
}
```

```typescript
version: formatManifestVersion(pkg.version)
```

Keep package metadata valid and format the extension/UI version explicitly.

---

## Scenario: Linux.do Homepage Topic-Tag Injection Across Theme Layout Variants

### 1. Scope / Trigger

- Trigger: changing Linux.do homepage topic-tag injection, anchor selection, or mutation-driven re-rendering in third-party Discourse themes.
- Applies to `src/sites/linuxDo.ts`, homepage topic-tag DOM helpers, and `src/tests/linuxDoMigration.spec.ts`.
- Use this contract when a theme can duplicate category markup, hide one copy, or move the visible category badge into a separate table cell.

### 2. Signatures

Topic-tag render entry point:

```typescript
declare function renderLinuxDoHomePageTopicTags(
  root: ParentNode,
  url: string,
  enabled: boolean,
): void
```

Anchor/idempotence helpers:

```typescript
declare function syncTopicItemTags(element: HTMLElement): void

declare function resolveTagInsertionAnchor(
  element: HTMLElement,
): { parent: Element, refNode: Node | null } | null

declare function isElementVisibleWithin(node: Element, boundary: Element): boolean

declare function isTagContainerAtAnchor(
  container: HTMLElement,
  anchor: { parent: Element, refNode: Node | null },
): boolean
```

Selector contract:

```typescript
const CATEGORY_LINK_SELECTOR = 'a[href^="/c/"]'
const TOPIC_TITLE_BOTTOM_LINE_SELECTOR = '.link-bottom-line'
const TOPIC_CATEGORY_CELL_SELECTOR = 'td.topic-category-data'
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Homepage scope | Only inject tags on Linux.do homepage list URLs handled by `isLinuxDoHomePage()` (`/` and `/latest`). |
| Tag source | Rebuild tags from `tag-*` row classes; do not fetch remote tag data for homepage list injection. |
| Visible anchor priority | Prefer the first category link whose ancestor chain is visible within the topic row. |
| Horizon fallback | If the visible category badge lives in `td.topic-category-data`, inject there instead of a hidden `.link-bottom-line`. |
| Default/MOYU fallback | If no visible category badge is found, fall back to `.link-bottom-line` to preserve existing default-theme behavior. |
| Idempotence boundary | Treat the render as unchanged only when both the tag list and the exact insertion position are unchanged. |
| Container display override | The injected `.discourse-tags` container must set an inline `display: inline-flex !important` so it overrides the site's `.discourse-tags { display: contents }`; otherwise the container collapses inside a `display: flex` `td.topic-category-data` (Horizon) and its `<a>` tags become vertical cell flex items. |
| Disable behavior | `enabled = false` removes all `[data-bewly-topic-tags]` containers under the provided root. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| The first `a[href^="/c/"]` is inside an ancestor with `display: none` | Skip it and continue searching for a visible category anchor. |
| A hidden `.link-bottom-line` exists, but `td.topic-category-data` contains the visible category badge | Inject the tag container into `td.topic-category-data`. |
| The injected container already exists with the same tags but is attached at the wrong anchor | Remove and rebuild it at the resolved anchor; do not no-op. |
| The row has no `tag-*` classes | Remove any existing injected container and leave no empty placeholder. |
| The page is outside homepage scope | Do not inject or remove homepage topic tags. |
| No visible category badge exists, but `.link-bottom-line` exists | Insert at the end of `.link-bottom-line` as the final fallback. |
| The container is injected into a `display: flex` `td.topic-category-data` and inherits `.discourse-tags { display: contents }` | Force the container's own `display` with an inline `inline-flex !important` rule so it stays a single horizontal layout box instead of dissolving into the flex cell. |

### 5. Good/Base/Bad Cases

- Good: Horizon hides one `.link-bottom-line`, the renderer skips the hidden anchor, and the tag container appears inside `td.topic-category-data`.
- Base: Default/MOYU exposes a visible category link inside `.link-bottom-line`, and the tag container stays immediately after that badge.
- Bad: `querySelector(CATEGORY_LINK_SELECTOR)` returns the first DOM match under a hidden ancestor, so the injected tags exist in the DOM but remain invisible.

### 6. Tests Required

- `src/tests/linuxDoMigration.spec.ts`: assert hidden `.link-bottom-line` fixtures inject into `td.topic-category-data` instead of the hidden branch.
- `src/tests/linuxDoMigration.spec.ts`: assert visible `.link-bottom-line` fixtures preserve the default/MOYU insertion position.
- `src/tests/linuxDoMigration.spec.ts`: assert an existing injected container with unchanged tags but wrong placement is relocated after rerender.
- `src/tests/linuxDoMigration.spec.ts`: keep homepage-only scope, no-tag, disable, and idempotence assertions green after anchor logic changes.
- `src/tests/linuxDoMigration.spec.ts`: assert the injected container's inline `style.display` is `inline-flex` in both the default-theme and Horizon `td.topic-category-data` fixtures.
- Validation commands:

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
pnpm lint
pnpm typecheck
```

### 7. Wrong vs Correct

#### Wrong

```typescript
function resolveTagInsertionAnchor(element: HTMLElement) {
  const badgeAnchor = element.querySelector<HTMLAnchorElement>(CATEGORY_LINK_SELECTOR)

  if (badgeAnchor?.parentElement)
    return { parent: badgeAnchor.parentElement, refNode: badgeAnchor.nextSibling }

  return element.querySelector(TOPIC_TITLE_BOTTOM_LINE_SELECTOR)
}
```

This trusts DOM order and can pick a hidden category badge copy.

#### Correct

```typescript
const visibleAnchor = Array.from(element.querySelectorAll<HTMLAnchorElement>(CATEGORY_LINK_SELECTOR))
  .find(anchor => isElementVisibleWithin(anchor, element))

if (visibleAnchor?.parentElement)
  return { parent: visibleAnchor.parentElement, refNode: getTagInsertionRefNode(visibleAnchor.nextSibling) }
```

This resolves the first visible category badge and keeps rerenders placement-aware.

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
