# State Management

> How state is managed in this project.

---

## Overview

The project uses **Pinia** with the setup store pattern for global state. Persistent settings use VueUse `useStorageAsync` backed by `webextension-polyfill` `storage.local`. Local component state uses standard Vue `ref`/`reactive`.

---

## State Categories

| Category | Mechanism | Location |
|----------|-----------|----------|
| Global app state | Pinia setup stores | `src/stores/` |
| Persistent settings | `useStorageLocal` (VueUse + extension storage) | `src/logic/storage.ts` |
| Component-local state | `ref` / `reactive` / `computed` | Inside `.vue` SFCs |
| Cross-context messaging | `webext-bridge` | Background / content / popup |

---

## Pinia Stores

Stores use the setup function pattern with `defineStore`:

```ts
// src/stores/mainStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMainStore = defineStore('main', () => {
  const someValue = ref('')
  // ... state, getters, actions
  return { someValue }
})
```

Naming convention: file is `<name>Store.ts`, export is `use<Name>Store`.

Real examples: `src/stores/mainStore.ts`, `src/stores/settingsStore.ts`, `src/stores/topBarStore.ts`

Pinia is installed in `src/logic/common-setup.ts`.

---

## Persistent Settings

The central settings model lives in `src/logic/storage.ts`:

```ts
import { useStorageLocal } from '~/composables/useStorageLocal'

export const settings = useStorageLocal('settings', ref<Settings>(originalSettings), { mergeDefaults: true })
export const accessKey = useStorageLocal('accessKey', '')
export const gridLayout = useStorageLocal('gridLayout', ref<GridLayout>({
  home: 'adaptive',
}), { mergeDefaults: true })
export const sidePanel = useStorageLocal('sidePanel', ref<{ home: boolean }>({
  home: true,
}), { mergeDefaults: true })
```

`useStorageLocal` (defined in `src/composables/useStorageLocal.ts`) wraps VueUse's `useStorageAsync` with `browser.storage.local` from `webextension-polyfill`.

Key patterns:
- `mergeDefaults: true` ensures new settings keys are merged when the schema evolves.
- The `Settings` type and `originalSettings` defaults are co-located in `storage.ts`.
- Settings are reactive -- changes propagate to all components that reference them.

Real example: `src/logic/storage.ts`

---

## When to Use Global State

Use a Pinia store when:
- Multiple unrelated components need the same data.
- The data outlives a single component's lifecycle.
- The data is not fetched from a server (server state is minimal in this extension).

Use local `ref` when:
- Data is only relevant to one component.
- Data is derived from props or other reactive sources.

Use `useStorageLocal` when:
- Data must persist across extension restarts or popup open/close cycles.

---

## Server State

The project does not use a dedicated server-state library (no React Query / SWR equivalent). API calls are made via helpers in `src/utils/api.ts` and results are stored in local component state or Pinia stores as needed.

---

## Common Mistakes

- Using `localStorage` directly instead of `useStorageLocal` -- extension storage is the correct persistence layer.
- Mutating store state outside actions -- Pinia setup stores return refs; mutate them through defined functions.
- Creating a Pinia store for data that only one component needs -- use local `ref` instead.
- Forgetting `mergeDefaults: true` when adding new settings keys -- existing users won't get the new default.
