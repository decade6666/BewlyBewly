# Hook Guidelines

> How composables (hooks) are used in this project.

---

## Overview

Reusable stateful logic lives in `src/composables/` as Vue 3 composables with `use*` naming. The project relies on VueUse for many utilities and wraps browser extension APIs where needed.

---

## Custom Hook Patterns

Composables follow this structure:

1. Accept reactive or plain parameters.
2. Use `ref`/`reactive`/`computed` for internal state.
3. Return an object of refs and functions (never return raw reactive objects directly for destructuring safety -- use `toRefs` if needed).
4. Side effects (event listeners, watchers) are set up inside the composable and cleaned up automatically.

Real examples:

- `src/composables/useStorageLocal.ts` -- wraps VueUse `useStorageAsync` with `webextension-polyfill` `storage.local` for extension-compatible persistence.
- `src/composables/useDark.ts` -- uses VueUse `usePreferredDark`, watches settings, updates DOM classes, and dispatches `CustomEvent('global.themeChange')`.
- `src/composables/useDelayedHover.ts` -- hover logic with configurable delay.
- `src/composables/useFilter.ts` -- filtering logic for lists.

---

## Provider / Inject Pattern

`src/composables/useAppProvider.ts` exports `useBewlyApp()`, a consumer-side composable that wraps `inject('BEWLY_APP')` for app-level context:

```ts
// Consumer side (from useAppProvider.ts)
export function useBewlyApp(): BewlyAppProvider {
  const provider = inject<BewlyAppProvider>('BEWLY_APP')
  if (import.meta.env.DEV && !provider)
    throw new Error('AppProvider is not injected')
  return provider!
}

// Usage in components
const { mainAppRef, openIframeDrawer } = useBewlyApp()
```

The inject key is the string `'BEWLY_APP'`. The corresponding `provide` call is not visible in the current source tree (may be set up at a higher level or via a build-time mechanism). This pattern shares app-level state (activated page, scroll state, navigation handlers) without prop drilling.

Real example: `src/composables/useAppProvider.ts`

---

## Browser API Access

- Always use `webextension-polyfill` (auto-imported as `browser`) for extension APIs (storage, tabs, runtime, etc.).
- Prefer VueUse composables for DOM/browser utilities (e.g., `usePreferredDark`, `useStorageAsync`).
- When a browser API has no VueUse wrapper, wrap it in a `use*` composable.

```ts
import { useStorageAsync } from '@vueuse/core'
import { storage } from 'webextension-polyfill'

// Correct: use extension storage via VueUse wrapper
const settings = useStorageAsync('settings', defaultSettings, storage.local)
```

---

## Naming Conventions

| Rule | Example |
|------|---------|
| Always `use` prefix | `useDark`, `useStorageLocal` |
| camelCase file name | `useDelayedHover.ts` |
| One composable per file | `useDark.ts` contains only `useDark` |
| Return object, not array | `{ isDark, toggle }` not `[isDark, toggle]` |

---

## Common Mistakes

- Using raw `localStorage` instead of `useStorageLocal` -- extension storage is the correct persistence layer.
- Calling `browser` APIs directly in components instead of wrapping in a composable -- keeps testability and reuse.
- Using `@ts-expect-error` for non-standard APIs (like View Transitions) -- acceptable only when the API is genuinely non-standard, with a comment explaining why.
- Destructuring reactive return values without `toRefs` -- loses reactivity.
