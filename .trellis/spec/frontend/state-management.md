# State Management

> How state is managed in this project.

---

## Overview

This project stores extension settings in `src/logic/storage.ts` and exposes them through the shared `settings` ref from `~/logic`. UI settings components mutate that shared state directly, and content scripts read the same values when adapting Linux.do pages.

---

## Scenario: Linux.do Homepage Cleanup Settings

### 1. Scope / Trigger

- Trigger: adding, changing, or removing settings that control Linux.do homepage DOM cleanup behavior.
- Applies when a setting crosses these layers: storage defaults → settings UI → content script → site-specific DOM helper → regression tests.
- This is a cross-layer contract because persisted UI setting names and site-helper option names are intentionally mapped at the content-script boundary.

### 2. Signatures

Settings storage fields:

```typescript
interface Settings {
  hideHomePagePinnedTopics: boolean
  hideHomePageCommunityGuidelines: boolean
}
```

Site cleanup option fields:

```typescript
interface LinuxDoHomePageCleanupOptions {
  hidePinnedTopics: boolean
  hideCommunityGuidelines?: boolean
}

function hideLinuxDoHomePageElements(
  root: ParentNode,
  url: string,
  options?: LinuxDoHomePageCleanupOptions,
): void
```

Legacy settings cleanup:

```typescript
const LEGACY_SETTINGS_KEYS = ['hideHomePageGuidelineBanner'] as const

function cleanLegacySettingsStorageValue(value: unknown): unknown
function removeLegacySettingsFields<T extends object>(value: T): Omit<T, 'hideHomePageGuidelineBanner'>
```

### 3. Contracts

| Field | Layer | Type | Default | Purpose |
|---|---|---:|---:|---|
| `hideHomePagePinnedTopics` | `Settings` | `boolean` | `true` | Persisted user preference for hiding Linux.do homepage pinned topics. |
| `hidePinnedTopics` | `LinuxDoHomePageCleanupOptions` | `boolean` | `true` | Runtime DOM cleanup switch consumed by `hideLinuxDoHomePageElements`. |
| `hideHomePageCommunityGuidelines` | `Settings` | `boolean` | `false` | Persisted user preference for hiding the homepage community guidelines banner. Intentionally distinct from the removed legacy key. |
| `hideCommunityGuidelines` | `LinuxDoHomePageCleanupOptions` | `boolean` | `false` | Runtime DOM cleanup switch for the community guidelines banner. |
| `hideHomePageGuidelineBanner` | Legacy storage cleanup | `boolean` | n/a | Deprecated persisted field that must be removed from browser-local `settings` without dropping other values. The reintroduced feature uses `hideHomePageCommunityGuidelines` instead. |
| cleaned browser-local `settings` | Legacy storage cleanup output | `string` | n/a | `useStorageAsync` expects serialized storage values, so cleanup must write a JSON string even when the old raw value is object-shaped. |

The content script is the boundary mapper:

```typescript
hideLinuxDoHomePageElements(document, location.href, {
  hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
  hideCommunityGuidelines: settings.value.hideHomePageCommunityGuidelines,
})
```

Community guidelines detection is layered: Discourse structural selectors (`#banner`, `#banner-content`, `.custom-banner`, escape hatch) first, whitespace-normalized text fallback second. Structural hits still require a guidelines text signal (fail-safe). Protected layout ancestors/descendants and a 200-character normalized-text ceiling must never be hidden.

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| URL is not the Linux.do homepage | Return without changing DOM, regardless of option values. |
| `hidePinnedTopics` is `false` | Leave pinned topic display untouched. |
| `options` is omitted | Use default cleanup behavior: hide pinned topics only; leave the community guidelines banner visible. |
| Pinned topic cleanup changes from `true` to `false` after rows/cards were hidden | Restore only pinned topic elements hidden by Bewly cleanup and preserve their previous inline `display` value. |
| `hideCommunityGuidelines` is `false` | Leave the community guidelines banner visible. |
| `hideCommunityGuidelines` is `true` and a safe banner is found | Hide only the banner container via the multi-kind hide primitive; leave search hero, nav pills, and topic list untouched. |
| `#banner` exists without community guidelines text | Leave it untouched (fail-safe). |
| Guideline text lives under a parent that also contains `.topic-list` / `.nav-pills` / `#main-outlet` | Hide only the deepest safe element; never hide that parent. |
| Guideline text is placed directly on `body` / `#main-container` / `#main-outlet` / `#main-outlet-wrapper` | Leave those layout containers untouched. |
| Community guidelines cleanup changes from `true` to `false` after hiding | Restore only elements hidden under the `community-guidelines` kind and preserve previous inline `display`. |
| Browser-local `settings` contains `hideHomePageGuidelineBanner` | Remove only that key and preserve all other stored setting values, including `hideHomePageCommunityGuidelines` when present. |
| Browser-local `settings` cleanup receives an object-shaped raw value | Return a JSON string of the cleaned object before writing back, so VueUse object serializer can read it on the next load. |
| New persisted setting lacks a default in `originalSettings` | Typecheck or regression tests should fail; add the default before shipping. |
| Locale key missing for a new settings label | UI text will be incomplete; add keys in the floating panel's inline `appMessages` (four locales). |

### 5. Good/Base/Bad Cases

- Good: a new homepage cleanup setting is added to `Settings`, `originalSettings`, floating-panel labels, the content-script mapper, the site helper options, and regression tests.
- Base: a removed homepage cleanup setting also removes UI, locale keys, content-script mapping, helper logic, docs, and cleans its legacy stored field when applicable.
- Bad: the content script reads `settings.value` but passes the whole persisted settings object directly to `hideLinuxDoHomePageElements`, leaking storage naming into the site helper contract.
- Bad: legacy cleanup writes an object directly to browser-local `settings`, causing the next `useStorageAsync` read to pass a non-string value into `JSON.parse`.
- Bad: reusing the legacy key `hideHomePageGuidelineBanner` for the reintroduced feature, which the migration layer would silently strip.

### 6. Tests Required

- Unit/regression tests for `hideLinuxDoHomePageElements` must assert pinned topics hide by default and can stay visible when `hidePinnedTopics` is `false`.
- Regression tests must assert disabling cleanup after an earlier hide restores only Bewly-hidden pinned topics and preserves previous inline `display` values.
- Regression tests must assert the community guidelines banner stays visible when `hideCommunityGuidelines` is `false` / omitted, and is hidden safely when `true`.
- Regression tests must assert structural fail-safe, protected-container guards, idempotent re-runs, multi-kind independence, and non-homepage no-ops for the community guidelines path.
- Boundary tests should assert `src/contentScripts/index.ts` maps both `hideHomePagePinnedTopics` → `hidePinnedTopics` and `hideHomePageCommunityGuidelines` → `hideCommunityGuidelines`, and still does not reference the legacy identifiers `hideHomePageGuidelineBanner` / `hideGuidelineBanner`.
- Storage migration tests should assert legacy `hideHomePageGuidelineBanner` is removed from stored settings while unrelated values (including the new key) are preserved.
- Storage migration tests should assert object-shaped legacy raw values are cleaned into serialized JSON strings for VueUse compatibility.
- Run `pnpm typecheck` so missing `Settings` fields/defaults are caught.

### 7. Wrong vs Correct

#### Wrong

```typescript
hideLinuxDoHomePageElements(document, location.href, settings.value)
```

This couples the site helper to the persisted storage schema and makes future storage renames break DOM cleanup.

#### Correct

```typescript
hideLinuxDoHomePageElements(document, location.href, {
  hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
  hideCommunityGuidelines: settings.value.hideHomePageCommunityGuidelines,
})
```

This keeps the persisted settings contract separate from the site-specific cleanup options.

---

## Scenario: Linux.do Drawer Route State and Cleanup Override

### 1. Scope / Trigger

- Trigger: changing topic click interception, iframe drawer URL synchronization, browser back/forward behavior, or homepage cleanup while a drawer URL is shown in the address bar.
- Applies to `src/contentScripts/views/App.vue`, `src/contentScripts/index.ts`, `src/constants/globalEvents.ts`, `src/sites/linuxDo.ts`, and `src/tests/linuxDoMigration.spec.ts`.
- This is a cross-layer contract because the visible browser URL, drawer component state, custom events, and site DOM cleanup must agree without letting the iframe component mutate top-level history.

### 2. Signatures

Drawer history state shape:

```typescript
const DRAWER_HISTORY_STATE_KEY = '__bewlyLinuxDoDrawer'

interface DrawerHistoryState {
  [DRAWER_HISTORY_STATE_KEY]: true
  drawerUrl: string
  baseUrl: string
}
```

Drawer route-change event detail:

```typescript
export const LINUX_DO_DRAWER_ROUTE_CHANGE = 'linuxDoDrawerRouteChange'

interface LinuxDoDrawerRouteChangeDetail {
  isOpen: boolean
  baseUrl?: string
}
```

Content-script app route functions:

```typescript
function getClickTarget(event: MouseEvent): EventTarget | null
function handleDocumentClick(event: MouseEvent): void
function openIframeDrawer(topicUrl: string, baseUrl = location.href, updateHistory = true): void
function handleDrawerClose(): void
function handlePopState(event: PopStateEvent): void
function closeDrawerWithoutHistoryNavigation(): void
function hideIframeDrawer(): void
```

Homepage cleanup boundary:

```typescript
let cleanupUrlOverride: string | null = null

function handleLinuxDoDrawerRouteChange(event: Event): void {
  const detail = (event as CustomEvent<LinuxDoDrawerRouteChangeDetail>).detail
  cleanupUrlOverride = detail?.isOpen && detail.baseUrl ? detail.baseUrl : null
}

function cleanupLinuxDoHomePage(): void
```

### 3. Contracts

| Field / Function | Contract |
|---|---|
| `getClickTarget(event)` | When the app is mounted in a Shadow DOM, resolve the real clicked node with `event.composedPath()[0]`; fall back to `event.target` only when the composed path is empty. |
| `handleDocumentClick(event)` | Must pass `getClickTarget(event)` into `findLinuxDoTopicLink(...)` before deciding whether to intercept Linux.do topic navigation. |
| `DrawerHistoryState.drawerUrl` | The normalized Linux.do topic URL shown in the address bar and loaded in the iframe. |
| `DrawerHistoryState.baseUrl` | The list/homepage URL to restore after closing the drawer or pressing browser Back. |
| `openIframeDrawer(..., updateHistory = true)` | Opens the drawer, dispatches `{ isOpen: true, baseUrl }`, and pushes `drawerUrl` into top-level history when `updateHistory` is true. |
| `handleDrawerClose()` | If the current history entry is a matching drawer entry, call `history.back()` and use a short fallback; otherwise close without navigation and replace the URL with `baseUrl` if needed. |
| `handlePopState(event)` | Reopen the drawer without pushing a new history entry when `event.state` is a valid drawer state; close the drawer when leaving drawer state. |
| `LINUX_DO_DRAWER_ROUTE_CHANGE` | Allows the content-script cleanup layer to keep using the original list URL while the address bar temporarily shows a topic URL. |
| `cleanupUrlOverride` | Set to `baseUrl` while the drawer is open; reset to `null` when the drawer closes or an invalid open event is received. |
| `cleanupLinuxDoHomePage()` | Calls `hideLinuxDoHomePageElements(document, cleanupUrlOverride ?? location.href, options)`. |

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| Click is default-prevented, non-left button, or has modifier keys | Do not intercept; let Linux.do/browser handle it. |
| Click originates from content mounted inside Bewly's Shadow DOM | Resolve the clickable node through `event.composedPath()[0]`; do not rely on `event.target` alone because it retargets to the shadow host. |
| Click target does not resolve to a same-origin `/t/<slug>/<id>` URL | Do not open the drawer or mutate history. |
| User clicks a topic on a list page | Prevent default navigation, open drawer, push the topic URL, and remember the current list URL as `baseUrl`. |
| User closes drawer while current history state is the matching drawer state | Call `history.back()` so the address bar returns to `baseUrl`; fallback closes and `replaceState`s after `DRAWER_HISTORY_CLOSE_FALLBACK_MS` if no popstate closes it. |
| Browser Back leaves drawer state | Hide drawer, clear `iframeDrawerURL` and `drawerBaseURL`, and dispatch `{ isOpen: false }`. |
| Browser Forward re-enters a drawer state | Reopen drawer with `updateHistory = false` to avoid duplicate history entries. |
| Drawer open event has no usable `baseUrl` | Clear cleanup override and run cleanup against `location.href`. |
| Address bar shows a topic URL while drawer overlays a homepage/list page | Homepage cleanup must still use `baseUrl` through `cleanupUrlOverride`. |
| `IframeDrawer.vue` tries to call `history.*` | Treat as a regression; only the content-script app owns top-level history. |

### 5. Good/Base/Bad Cases

- Good: clicking a Linux.do homepage topic from inside Bewly's Shadow DOM still resolves the nested anchor, changes the address bar to the topic URL, keeps the underlying homepage cleanup scoped to the original homepage URL, and browser Back restores the list URL.
- Base: closing the drawer without a matching drawer history state hides the drawer and uses `replaceState` to restore `baseUrl` if the address bar still shows the topic URL.
- Bad: `handleDocumentClick` reads only `event.target`, so Shadow DOM retargeting turns the click target into the shadow host and the drawer never opens.
- Bad: homepage cleanup reads only `location.href`, so opening a topic drawer changes the URL to `/t/...` and pinned homepage rows become visible again.

### 6. Tests Required

- URL helper tests: assert `normalizeLinuxDoTopicUrl`, `findLinuxDoTopicLink`, `isLinuxDoTopicListPage`, and `isLinuxDoHomePage` accept and reject the expected Linux.do paths.
- Source boundary tests: assert `App.vue` contains `history.pushState(createDrawerHistoryState(topicUrl, baseUrl), '', topicUrl)` and `useEventListener(window, 'popstate', handlePopState)`.
- Source boundary tests: assert `App.vue` resolves drawer clicks through `getClickTarget(event)` / `event.composedPath()` before calling `findLinuxDoTopicLink(...)`.
- Source boundary tests: assert `index.ts` imports `LINUX_DO_DRAWER_ROUTE_CHANGE`, listens for it, and calls `hideLinuxDoHomePageElements(document, cleanupUrlOverride ?? location.href, options)`.
- Regression tests: assert homepage pinned rows/cards hide on `/` and `/latest`, including class, data attribute, title/aria, icon, and text markers.
- Regression tests: assert disabling cleanup settings restores only Bewly-hidden elements and keeps non-homepage pages untouched.
- Validation commands: targeted `src/tests/linuxDoMigration.spec.ts`, `CI=true pnpm test`, `pnpm typecheck`, and `pnpm lint` after route/history changes.

### 7. Wrong vs Correct

#### Wrong

```typescript
const topicUrl = findLinuxDoTopicLink(event.target, location.href)
```

When the app is mounted under a Shadow DOM host, `event.target` is retargeted to the host element and the topic drawer never opens.

#### Correct

```typescript
const topicUrl = findLinuxDoTopicLink(getClickTarget(event), location.href)
```

Resolve the real clicked node through `event.composedPath()` first so nested topic links inside the Shadow DOM still open the drawer.

---

## Scenario: Linux.do Homepage Blocked Words and Multi-Reason Cleanup

### 1. Scope / Trigger

- Trigger: adding or changing Linux.do homepage cleanup rules that can hide the same topic item for different reasons.
- Applies to `src/logic/storage.ts`, `src/contentScripts/index.ts`, `src/contentScripts/views/App.vue`, `src/sites/linuxDo.ts`, and `src/tests/linuxDoMigration.spec.ts`.
- This is a cross-layer contract because persisted settings, floating UI state, content-script option mapping, DOM markers, and regression tests must agree.

### 2. Signatures

Settings storage fields:

```typescript
interface Settings {
  hideHomePagePinnedTopics: boolean
  enableHomePageBlockedWords: boolean
  homePageBlockedWords: string[]
}
```

Site cleanup option fields:

```typescript
interface LinuxDoHomePageCleanupOptions {
  hidePinnedTopics: boolean
  enableBlockedWords: boolean
  blockedWords: string[]
}

function hideLinuxDoHomePageElements(
  root: ParentNode,
  url: string,
  options?: LinuxDoHomePageCleanupOptions,
): void
```

Supported blocked-word formats:

```text
plain keyword       -> case-insensitive substring match against topic item text
/pattern/           -> case-insensitive RegExp match against topic item text
'' or whitespace    -> ignored
invalid /pattern/   -> ignored; cleanup must not throw
```

### 3. Contracts

| Field / Marker | Layer | Type | Default | Purpose |
|---|---|---:|---:|---|
| `enableHomePageBlockedWords` | `Settings` | `boolean` | `false` | Persisted switch for Linux.do homepage blocked-word cleanup. |
| `homePageBlockedWords` | `Settings` | `string[]` | `[]` | Persisted blocked-word list shown in the floating settings panel. |
| `enableBlockedWords` | `LinuxDoHomePageCleanupOptions` | `boolean` | `false` | Runtime switch consumed by the site helper. |
| `blockedWords` | `LinuxDoHomePageCleanupOptions` | `string[]` | `[]` | Runtime list consumed by the site helper. |
| `pinned-topic` | DOM hidden reason | string token | n/a | Reason token for pinned-topic cleanup. |
| `blocked-word` | DOM hidden reason | string token | n/a | Reason token for blocked-word cleanup. |

The content script remains the boundary mapper:

```typescript
hideLinuxDoHomePageElements(document, cleanupUrlOverride ?? location.href, {
  hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
  enableBlockedWords: settings.value.enableHomePageBlockedWords,
  blockedWords: settings.value.homePageBlockedWords,
})
```

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| URL is not `https://linux.do/` or `https://linux.do/latest` | Return without changing topic items, regardless of blocked-word settings. |
| `enableBlockedWords` is `false` | Restore only the `blocked-word` reason and preserve any other active reason. |
| `blockedWords` contains empty or whitespace-only entries | Ignore those entries. |
| `blockedWords` contains plain text | Match topic item text case-insensitively using substring semantics. |
| `blockedWords` contains `/pattern/` | Compile a case-insensitive `RegExp` and match topic item text. |
| `blockedWords` contains invalid regex text | Ignore the invalid regex; do not throw from cleanup or break other rules. |
| Topic item matches both pinned and blocked-word rules | Closing one switch must not restore the item while the other reason is still active. |
| Cleanup runs repeatedly through `MutationObserver` | Do not rewrite the same hide-reason markers unnecessarily. |

### 5. Good/Base/Bad Cases

- Good: a topic with text `Rust release` is hidden by `rust` or `/r.st/`, and remains hidden if it is also pinned after blocked-word cleanup is disabled.
- Base: an empty blocked-word list produces no blocked-word hides and does not affect pinned-topic cleanup.
- Bad: storing only one `data-bewly-home-page-hidden` reason means disabling blocked words can accidentally reveal pinned topics.
- Bad: compiling user-provided regex without a guard makes a malformed `/[/` entry crash every cleanup pass.

### 6. Tests Required

- Regression tests for plain keyword matching, regex matching, empty ignored entries, and invalid regex non-crash.
- Regression tests for disabling blocked-word cleanup after an earlier hide and preserving previous inline `display` values.
- Regression tests for overlap: pinned-topic and blocked-word reasons must restore independently.
- Source boundary tests should assert `src/contentScripts/index.ts` maps `enableHomePageBlockedWords` to `enableBlockedWords` and watches both the switch and list.
- Component source tests should assert the floating settings panel exposes the blocked-word switch/list and keeps `role="dialog"` boundaries.
- Run targeted `src/tests/linuxDoMigration.spec.ts`, `pnpm typecheck`, and `pnpm lint` after changing this flow.

### 7. Wrong vs Correct

#### Wrong

```typescript
function restoreHiddenElements(root: ParentNode, kind: HomePageHiddenElementKind): void {
  root.querySelectorAll(`[data-bewly-home-page-hidden="${kind}"]`)
    .forEach(restoreHiddenElement)
}
```

This single-reason model restores an element even when another active cleanup reason still applies.

#### Correct

```typescript
hideLinuxDoHomePageElements(document, location.href, {
  hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
  enableBlockedWords: settings.value.enableHomePageBlockedWords,
  blockedWords: settings.value.homePageBlockedWords,
})
```

Keep all active reasons available to the site helper, remove only the disabled reason, and restore the inline display only when no reasons remain.

---

## Scenario: Linux.do Overlay Follows Host Site Color Scheme

### 1. Scope / Trigger

- Trigger: theming the Linux.do extension overlay (settings button/panel, scroll button, iframe drawer header buttons) so it matches the site's actual dark/light scheme.
- Applies to `src/sites/linuxDo.ts`, `src/contentScripts/views/App.vue`, and `src/tests/linuxDoMigration.spec.ts`.
- This is a cross-layer contract because the overlay palette is host-only (`.linux-do-extension-root` hardcodes `--bew-*`); it must NOT reuse `useDark()`/extension `settings.theme`, which track OS/extension preference rather than the host site's selected Discourse scheme.

### 2. Signatures

```typescript
// src/sites/linuxDo.ts — pure detection, null-safe, no DOM mutation
export function detectLinuxDoColorScheme(doc: Document | null | undefined): 'dark' | 'light'
```

Content-script wiring contract (`App.vue`):

```text
const isHostDark = ref(false)
function updateHostDarkScheme() { isHostDark.value = detectLinuxDoColorScheme(document) === 'dark' }
<div class="linux-do-extension-root" :class="{ dark: isHostDark }">
.linux-do-extension-root.dark { /* override color-bearing --bew-* only */ }
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Primary signal | `getComputedStyle(doc.documentElement).getPropertyValue('--scheme-type').trim()`; return it only when exactly `'dark'` or `'light'`. |
| Fallback signal | `--secondary` background color → W3C AERT brightness `r*0.299+g*0.587+b*0.114`; `< 128` ⇒ `'dark'`, else `'light'`. Parse `#rgb`, `#rrggbb`, `rgb()`, `rgba()`. |
| Default | Return `'light'` for null/missing `doc`, missing `documentElement`/`defaultView`, empty `--scheme-type` with unparseable `--secondary`. Never throw. |
| Detection purity | `detectLinuxDoColorScheme` only reads computed styles; it does not toggle classes, set cookies, or dispatch events (unlike `useDark()`). |
| Class binding | `.linux-do-extension-root` gets `dark` class iff host scheme is dark; `.linux-do-extension-root.dark` overrides ONLY color-bearing vars (`--bew-bg/-content-solid(-hover)/-elevated-solid(-hover)/-fill-1/-fill-2/-border-color/-text-1/-text-2`). Radius, page-max-width, top-bar-height, theme-color, error-color stay shared. |
| Change observation | `MutationObserver` on `document.documentElement` (`childList+subtree+attributes`, `attributeFilter: ['href','data-theme-name','data-theme-id']`) catches the `color_definitions` stylesheet swap; recompute inside `requestAnimationFrame`. A `matchMedia('(prefers-color-scheme: dark)')` `change` listener re-reads the actual site scheme. |
| Cleanup | Observer disconnected and media listener removed in `onBeforeUnmount`; references nulled. No leak. |

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| `:root` has `--scheme-type: dark` | Return `'dark'` (ignore `--secondary`). |
| `:root` has `--scheme-type: light` | Return `'light'`. |
| `--scheme-type` empty, `--secondary: #222222` | Fallback brightness ~34 ⇒ `'dark'`. |
| `--scheme-type` empty, `--secondary: #ffffff` | Fallback brightness ~255 ⇒ `'light'`. |
| `--secondary` is `rgb()/rgba()` | Parse first 3 channels; same threshold. |
| `--secondary` malformed / non-hex-non-rgb (e.g. `hsl()`, named) | Return `'light'`; do not throw. |
| `doc`/`documentElement`/`defaultView` null | Return `'light'`. |
| User toggles Discourse scheme without reload | Stylesheet `<link>` attrs change → observer fires → overlay re-themes. |

### 5. Good/Base/Bad Cases

- Good: overlay reads the live `--scheme-type`, binds `.dark`, and re-themes on Discourse toggle and OS change, with observer/listener cleaned up on unmount.
- Base: on a site with only `--secondary` (very old Discourse), luminance fallback still resolves dark/light.
- Bad: theming the overlay from `useDark()`/`settings.theme` (OS/extension preference), so buttons stay light while linux.do is dark; or overriding non-color vars (radius/top-bar-height) in the `.dark` block; or leaving the observer connected after unmount.

### 6. Tests Required

- Unit (`linuxDoMigration.spec.ts`): `detectLinuxDoColorScheme` returns `'dark'`/`'light'` from `--scheme-type`; `--secondary` luminance fallback for `#222222`/`#ffffff`; `#rgb` short hex and `rgb()` parsing; returns `'light'` for null/undefined `doc`.
- Source regression: assert `App.vue` imports `detectLinuxDoColorScheme`, declares `isHostDark`, binds `:class="{ dark: isHostDark }"` on `.linux-do-extension-root`, sets up `MutationObserver` + `matchMedia`, and defines a `.linux-do-extension-root.dark` palette block.
- Validation after changes: `pnpm typecheck`, `pnpm exec eslint <changed files>`, targeted `src/tests/linuxDoMigration.spec.ts`.

### 7. Wrong vs Correct

#### Wrong

```typescript
// Themes the overlay from the extension/OS preference, not the host site
const isDark = useDark().isDark // tracks settings.theme + prefers-color-scheme
```

The overlay stays light while linux.do is in a user-selected dark Discourse scheme.

#### Correct

```typescript
function updateHostDarkScheme() {
  isHostDark.value = detectLinuxDoColorScheme(document) === 'dark'
}
// re-run on MutationObserver(color_definitions link) + matchMedia change; clean up on unmount
```

The overlay reflects the host site's actual rendered scheme and follows runtime toggles.

---

## Scenario: WebDAV Versioned Backup State and Cross-Layer Sync

### 1. Scope / Trigger

- Trigger: changing WebDAV backup path semantics, versioned backup upload/retention, legacy-file compatibility, or selected-backup restore flow.
- Applies to `src/logic/storage.ts`, `src/logic/settingsMigration.ts`, `src/logic/webdavSettings.ts`, `src/logic/webdavBackups.ts`, `src/logic/webdav.ts`, `src/background/messageListeners/webdav.ts`, `src/logic/settingsSync.ts`, `src/contentScripts/views/WebdavSettingsDialog.vue`, and the related WebDAV tests.
- This requires code-spec depth because the feature crosses persisted settings, local-only migration metadata, content-script orchestration, background transport, and remote WebDAV request/response contracts.

### 2. Signatures

Persisted/local WebDAV settings fields:

```typescript
interface Settings {
  webdavEnabled: boolean
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
  webdavLastSyncTime: number
  webdavLegacyFilePath: string
}
```

Core orchestration API:

```typescript
interface SettingsBackupSummary {
  id: string
  requestPath: string
  fileName: string
  source: 'versioned' | 'legacy'
  timestampMs: number
  sequence: number
}

type BackupListWarning = 'legacy_unreadable'

type SyncWarning = 'cleanup_partial'

type SyncErrorCode =
  | 'path_invalid'
  | 'directory_list_failed'
  | 'invalid_multistatus'
  | 'unsupported_href_format'
  | 'parse_error'
  | 'unsupported_version'
  | 'upload_collision_exhausted'
  | 'selected_backup_not_found'

interface BackupListResult {
  ok: boolean
  backups?: readonly SettingsBackupSummary[]
  warnings?: readonly BackupListWarning[]
  error?: SyncErrorCode | string
}

interface SyncResult {
  ok: boolean
  warning?: SyncWarning
  error?: SyncErrorCode | string
}

function listSettingsBackups(): Promise<BackupListResult>
function uploadSettings(): Promise<SyncResult>
function downloadSettings(selectedPath?: string): Promise<SyncResult>
```

Remote envelope contract:

```typescript
interface SyncEnvelope {
  version: 1
  timestamp: number
  settings: Partial<Settings>
  blockedWords: BlockedWordsState
}
```

### 3. Contracts

| Item | Contract |
|---|---|
| `webdavPath` | Persisted as a logical directory path, not a fixed file path; canonical form has leading `/` and trailing `/`, default `/bewly/`. |
| `webdavLegacyFilePath` | Local-only compatibility locator for the migrated legacy single-file backup. It never enters uploaded `SyncEnvelope.settings`, but it must survive successful restore. |
| Upload payload | `stripWebdavFields()` removes all local WebDAV config fields, including `webdavLegacyFilePath`, before upload. |
| Restore payload | `retainedWebdavFields()` re-applies all local WebDAV fields, including `webdavLegacyFilePath`, after a valid remote envelope is parsed. |
| `listSettingsBackups()` | Uses raw LIST XML plus `parseDirectoryListing(...)` in the content script, returns newest-first managed backups, and may include `legacy_unreadable` without failing healthy versioned backups. |
| Directory 404 | A missing backup directory maps to a successful empty backup list, not a fatal error. |
| Legacy exactness | Only the exact `webdavLegacyFilePath` candidate may be treated as a legacy backup. Other JSON files in the directory are never treated as legacy. |
| Legacy timestamp source | A legacy backup participates in sort/retention only when its downloaded V1 envelope validates; `getlastmodified` is diagnostic only. |
| Upload create-only | `uploadSettings()` must create a new versioned file first, then relist and delete extras. It must never overwrite an existing backup. |
| Collision retries | `0001` through `0010` are the only allowed same-millisecond collision sequences. `412` retries immediately; non-`412` only retries when a successful directory list proves the exact candidate now exists. |
| Cleanup warning | If relist, legacy validation, or delete cleanup cannot fully converge after a successful create, return `{ ok: true, warning: 'cleanup_partial' }` and keep the new backup. |
| Selected restore | `downloadSettings(selectedPath)` must revalidate that the requested backup still exists in the current managed list (or exact legacy candidate) before GET. No selected path means `selected_backup_not_found`. |
| State mutation boundary | Parse/list/download failures must not mutate `settings.value` or `blockedWords.value`. Successful restore applies the validated envelope atomically and updates `webdavLastSyncTime` to the selected envelope timestamp. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|---|---|
| `webdavPath` fails normalization | Return `path_invalid` before any background request. |
| LIST transport returns 404 | Return `{ ok: true, backups: [] }`. |
| LIST XML is malformed or contains invalid `href` | Return `invalid_multistatus` / `unsupported_href_format`; do not mutate local state. |
| Legacy file is absent from a successful directory list | Clear `webdavLegacyFilePath` silently; do not emit `legacy_unreadable`. |
| Legacy file exists but GET/JSON/version validation fails | Omit the legacy entry, keep the locator, and return `legacy_unreadable`. |
| Create-only upload returns `412` | Retry next sequence within the same timestamp. |
| Create-only upload returns non-`412` and candidate is not proven to exist | Fail with the observable original error (or status-derived fallback); do not delete anything. |
| Post-upload relist fails | Keep the new backup, update `webdavLastSyncTime`, return `cleanup_partial`, and skip delete attempts. |
| Delete returns 404 | Treat as idempotent cleanup success. |
| Selected backup is absent during revalidation | Return `selected_backup_not_found` without mutating local data. |
| Selected backup GET/parse/version validation fails | Return the corresponding error without mutating local data. |

### 5. Good/Base/Bad Cases

- Good: upload creates `bewly-settings-...-0001.json`, retries on collision, then deletes only the oldest excess managed backups, leaving unrelated files untouched.
- Base: a directory with no managed backups returns an empty list and does not alter local settings.
- Bad: restore falls back to the current `webdavPath` when no selected backup id is provided, or upload includes `webdavLegacyFilePath` inside the remote envelope.
- Bad: a successful directory list that omits the legacy file still shows a compatibility warning instead of clearing the stale locator.

### 6. Tests Required

- Storage/migration tests must assert legacy single-file paths migrate to directory semantics plus `webdavLegacyFilePath`.
- `settingsSync.spec.ts` must assert:
  - upload strips local WebDAV fields from remote envelope settings;
  - restore preserves local WebDAV fields including `webdavLegacyFilePath`;
  - LIST 404 becomes an empty list;
  - valid legacy files join the sorted backup list by envelope timestamp;
  - unreadable legacy files yield `legacy_unreadable` without blocking healthy backups;
  - create-only collision retry/exhaustion semantics;
  - cleanup partial behavior on relist/delete failure;
  - selected restore revalidation and `selected_backup_not_found` no-mutation behavior.
- `webdavBackups.spec.ts` must assert managed filename parsing, strict `href` validation, and deterministic retention ordering.
- `webdav.spec.ts` must assert LIST/DELETE/create-only transport boundaries and segment encoding.
- Full verification includes `pnpm typecheck`, targeted WebDAV Vitest suites, and `pnpm build`.

### 7. Wrong vs Correct

#### Wrong

```typescript
async function downloadSettings(): Promise<SyncResult> {
  const result = await webdavDownloadViaBackground(getWebdavConfig())
  // always restores the current configured path
}
```

This bypasses backup selection and can restore the wrong file after the user chose a different backup.

#### Correct

```typescript
async function downloadSettings(selectedPath?: string): Promise<SyncResult> {
  if (!selectedPath)
    return { ok: false, error: 'selected_backup_not_found' }

  const scanned = await scanRemoteBackups(config, 'empty')
  const selectedBackup = scanned.backups.find(backup => backup.requestPath === selectedPath)
  if (!selectedBackup)
    return { ok: false, error: 'selected_backup_not_found' }

  const downloaded = await downloadEnvelopeAtPath(config, selectedBackup.requestPath)
  // apply only the validated selected envelope
}
```

This keeps restore bound to the validated selected backup and leaves local state unchanged on revalidation failure.

---

## State Categories

| Category | Location | Notes |
|---|---|---|
| Persisted extension settings | `src/logic/storage.ts` | Define fields in `Settings` and defaults in `originalSettings`. |
| Settings UI state | Settings Vue components | Bind controls to `settings.<field>` when the setting is user-facing. |
| Runtime page cleanup state | Content scripts and site helpers | Map persisted settings into site-specific option objects at the boundary. |

---

## When to Use Global State

Use the shared `settings` state when a preference must be available outside the settings page, such as content-script behavior on Linux.do pages. Keep transient component-only UI state local.

---

## Server State

This extension does not currently use server-state caching in the frontend spec scope.

---

## Common Mistakes

- Adding a settings UI control without adding a matching default in `originalSettings`.
- Reusing persisted settings object shapes as helper option objects instead of mapping fields at the boundary.
- Updating English locale labels but forgetting the matching Simplified Chinese keys.
