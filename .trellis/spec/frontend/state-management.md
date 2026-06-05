# State Management

> How state is managed in this project.

---

## Overview

This project stores extension settings in `src/logic/storage.ts` and exposes them through the shared `settings` ref from `~/logic`. UI settings components mutate that shared state directly, and content scripts read the same values when adapting Linux.do pages.

---

## Scenario: Linux.do Homepage Cleanup Settings

### 1. Scope / Trigger

- Trigger: adding or changing settings that control Linux.do homepage DOM cleanup behavior.
- Applies when a setting crosses these layers: storage defaults → settings UI → content script → site-specific DOM helper → regression tests.
- This is a cross-layer contract because the UI field names and content-script option names intentionally differ.

### 2. Signatures

Settings storage fields:

```typescript
interface Settings {
  hideHomePageGuidelineBanner: boolean
  hideHomePagePinnedTopics: boolean
}
```

Site cleanup option fields:

```typescript
interface LinuxDoHomePageCleanupOptions {
  hideGuidelineBanner: boolean
  hidePinnedTopics: boolean
}

function hideLinuxDoHomePageElements(
  root: ParentNode,
  url: string,
  options?: LinuxDoHomePageCleanupOptions,
): void
```

### 3. Contracts

| Field | Layer | Type | Default | Purpose |
|---|---|---:|---:|---|
| `hideHomePageGuidelineBanner` | `Settings` | `boolean` | `true` | Persisted user preference for hiding the Linux.do homepage guideline banner. |
| `hideHomePagePinnedTopics` | `Settings` | `boolean` | `true` | Persisted user preference for hiding Linux.do homepage pinned topics. |
| `hideGuidelineBanner` | `LinuxDoHomePageCleanupOptions` | `boolean` | `true` | Runtime DOM cleanup switch consumed by `hideLinuxDoHomePageElements`. |
| `hidePinnedTopics` | `LinuxDoHomePageCleanupOptions` | `boolean` | `true` | Runtime DOM cleanup switch consumed by `hideLinuxDoHomePageElements`. |

The content script is the boundary mapper:

```typescript
hideLinuxDoHomePageElements(document, location.href, {
  hideGuidelineBanner: settings.value.hideHomePageGuidelineBanner,
  hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
})
```

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|---|---|
| URL is not the Linux.do homepage | Return without changing DOM, regardless of option values. |
| `hideGuidelineBanner` is `false` | Leave guideline banner display untouched. |
| `hidePinnedTopics` is `false` | Leave pinned topic display untouched. |
| `options` is omitted | Use default cleanup behavior: hide both guideline banner and pinned topics. |
| A cleanup option changes from `true` to `false` after elements were hidden | Restore only elements hidden by Bewly cleanup and preserve their previous inline `display` value. |
| New persisted setting lacks a default in `originalSettings` | Typecheck or regression tests should fail; add the default before shipping. |
| Locale key missing for a new settings label | UI text will be incomplete; add keys in both `src/_locales/en.yml` and `src/_locales/cmn-CN.yml`. |

### 5. Good/Base/Bad Cases

- Good: a new homepage cleanup setting is added to `Settings`, `originalSettings`, both locale files, the settings UI, the content-script mapper, the site helper options, and regression tests.
- Base: a site helper option defaults to preserving existing behavior when older call sites omit options.
- Bad: the content script reads `settings.value` but passes storage field names directly to `hideLinuxDoHomePageElements`, leaking storage naming into the site helper contract.

### 6. Tests Required

- Unit/regression tests for `hideLinuxDoHomePageElements` must assert each option can independently keep the corresponding DOM element visible.
- Regression tests must assert disabling cleanup after an earlier hide restores only Bewly-hidden elements and preserves previous inline `display` values.
- Boundary tests should assert `src/contentScripts/index.ts` maps `settings.value.hideHomePageGuidelineBanner` to `hideGuidelineBanner` and `settings.value.hideHomePagePinnedTopics` to `hidePinnedTopics`.
- Existing homepage cleanup tests must continue to assert the default behavior hides both elements.
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
  hideGuidelineBanner: settings.value.hideHomePageGuidelineBanner,
  hidePinnedTopics: settings.value.hideHomePagePinnedTopics,
})
```

This keeps the persisted settings contract separate from the site-specific cleanup options.

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
