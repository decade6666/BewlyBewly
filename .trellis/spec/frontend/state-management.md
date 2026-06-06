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
}
```

Site cleanup option fields:

```typescript
interface LinuxDoHomePageCleanupOptions {
  hidePinnedTopics: boolean
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
| `hideHomePageGuidelineBanner` | Legacy storage cleanup | `boolean` | n/a | Deprecated persisted field that must be removed from browser-local `settings` without dropping other values. |
| cleaned browser-local `settings` | Legacy storage cleanup output | `string` | n/a | `useStorageAsync` expects serialized storage values, so cleanup must write a JSON string even when the old raw value is object-shaped. |

The content script is the boundary mapper:

```typescript
hideLinuxDoHomePageElements(document, location.href, {
  hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
})
```

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| URL is not the Linux.do homepage | Return without changing DOM, regardless of option values. |
| `hidePinnedTopics` is `false` | Leave pinned topic display untouched. |
| `options` is omitted | Use default cleanup behavior: hide pinned topics only. |
| Pinned topic cleanup changes from `true` to `false` after rows/cards were hidden | Restore only pinned topic elements hidden by Bewly cleanup and preserve their previous inline `display` value. |
| Guideline banner contains `《社区准则》` text on the homepage | Leave the banner untouched; guideline banner cleanup is not a supported feature. |
| Browser-local `settings` contains `hideHomePageGuidelineBanner` | Remove only that key and preserve all other stored setting values. |
| Browser-local `settings` cleanup receives an object-shaped raw value | Return a JSON string of the cleaned object before writing back, so VueUse object serializer can read it on the next load. |
| New persisted setting lacks a default in `originalSettings` | Typecheck or regression tests should fail; add the default before shipping. |
| Locale key missing for a new settings label | UI text will be incomplete; add keys in both `src/_locales/en.yml` and `src/_locales/cmn-CN.yml`. |

### 5. Good/Base/Bad Cases

- Good: a new homepage cleanup setting is added to `Settings`, `originalSettings`, both locale files, the settings UI, the content-script mapper, the site helper options, and regression tests.
- Base: a removed homepage cleanup setting also removes UI, locale keys, content-script mapping, helper logic, docs, and cleans its legacy stored field when applicable.
- Bad: the content script reads `settings.value` but passes the whole persisted settings object directly to `hideLinuxDoHomePageElements`, leaking storage naming into the site helper contract.
- Bad: legacy cleanup writes an object directly to browser-local `settings`, causing the next `useStorageAsync` read to pass a non-string value into `JSON.parse`.

### 6. Tests Required

- Unit/regression tests for `hideLinuxDoHomePageElements` must assert pinned topics hide by default and can stay visible when `hidePinnedTopics` is `false`.
- Regression tests must assert disabling cleanup after an earlier hide restores only Bewly-hidden pinned topics and preserves previous inline `display` values.
- Regression tests must assert guideline banner elements remain visible on homepage cleanup runs.
- Boundary tests should assert `src/contentScripts/index.ts` maps `settings.value.hideHomePagePinnedTopics` to `hidePinnedTopics` and does not reference `hideHomePageGuidelineBanner` or `hideGuidelineBanner`.
- Storage migration tests should assert legacy `hideHomePageGuidelineBanner` is removed from stored settings while unrelated values are preserved.
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
| Click target does not resolve to a same-origin `/t/<slug>/<id>` URL | Do not open the drawer or mutate history. |
| User clicks a topic on a list page | Prevent default navigation, open drawer, push the topic URL, and remember the current list URL as `baseUrl`. |
| User closes drawer while current history state is the matching drawer state | Call `history.back()` so the address bar returns to `baseUrl`; fallback closes and `replaceState`s after `DRAWER_HISTORY_CLOSE_FALLBACK_MS` if no popstate closes it. |
| Browser Back leaves drawer state | Hide drawer, clear `iframeDrawerURL` and `drawerBaseURL`, and dispatch `{ isOpen: false }`. |
| Browser Forward re-enters a drawer state | Reopen drawer with `updateHistory = false` to avoid duplicate history entries. |
| Drawer open event has no usable `baseUrl` | Clear cleanup override and run cleanup against `location.href`. |
| Address bar shows a topic URL while drawer overlays a homepage/list page | Homepage cleanup must still use `baseUrl` through `cleanupUrlOverride`. |
| `IframeDrawer.vue` tries to call `history.*` | Treat as a regression; only the content-script app owns top-level history. |

### 5. Good/Base/Bad Cases

- Good: clicking a Linux.do homepage topic changes the address bar to the topic URL, keeps the underlying homepage cleanup scoped to the original homepage URL, and browser Back restores the list URL.
- Base: closing the drawer without a matching drawer history state hides the drawer and uses `replaceState` to restore `baseUrl` if the address bar still shows the topic URL.
- Bad: homepage cleanup reads only `location.href`, so opening a topic drawer changes the URL to `/t/...` and pinned homepage rows become visible again.

### 6. Tests Required

- URL helper tests: assert `normalizeLinuxDoTopicUrl`, `findLinuxDoTopicLink`, `isLinuxDoTopicListPage`, and `isLinuxDoHomePage` accept and reject the expected Linux.do paths.
- Source boundary tests: assert `App.vue` contains `history.pushState(createDrawerHistoryState(topicUrl, baseUrl), '', topicUrl)` and `useEventListener(window, 'popstate', handlePopState)`.
- Source boundary tests: assert `index.ts` imports `LINUX_DO_DRAWER_ROUTE_CHANGE`, listens for it, and calls `hideLinuxDoHomePageElements(document, cleanupUrlOverride ?? location.href, options)`.
- Regression tests: assert homepage pinned rows/cards hide on `/` and `/latest`, including class, data attribute, title/aria, icon, and text markers.
- Regression tests: assert disabling cleanup settings restores only Bewly-hidden elements and keeps non-homepage pages untouched.
- Validation commands: targeted `src/tests/linuxDoMigration.spec.ts`, `CI=true pnpm test`, `pnpm typecheck`, and `pnpm lint` after route/history changes.

### 7. Wrong vs Correct

#### Wrong

```typescript
function cleanupLinuxDoHomePage() {
  hideLinuxDoHomePageElements(document, location.href, {
    hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
  })
}
```

When the drawer pushes a topic URL into the address bar, this makes homepage cleanup think the page is no longer a homepage.

#### Correct

```typescript
function cleanupLinuxDoHomePage() {
  hideLinuxDoHomePageElements(document, cleanupUrlOverride ?? location.href, {
    hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
  })
}
```

The cleanup layer uses the underlying list URL while the drawer is open, and falls back to the real URL otherwise.

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
