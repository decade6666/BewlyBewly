# Type Safety

> Type safety patterns in this project.

---

## Overview

The project uses TypeScript in strict mode. `noUnusedLocals` is enabled in `tsconfig.json`. The path alias `~/` maps to `src/`.

---

## Type Organization

Types are co-located by domain:

| Location | Purpose | Example |
|----------|---------|---------|
| `src/models/<domain>/` | Domain model types | `src/models/video/`, `src/models/anime/` |
| `src/models/<name>.ts` | Single-domain models | `src/models/linuxDo.ts` |
| `src/logic/storage.ts` | Settings type (`Settings`) | Settings interface + defaults |
| `src/stores/*.ts` | Store-internal types | Types defined inside store files |
| Component files | Props interfaces | `interface Props` in `<script setup>` |
| `src/enums/` | Enum definitions | `src/enums/appEnums.ts` |

Types are NOT centralized in a single `types/` directory. They live where they are used.

---

## Component Props Typing

```vue
<script lang="ts" setup>
interface Props {
  title: string
  count?: number
  items: VideoItem[]
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
})
</script>
```

- Always use a named `interface Props` (not inline object type in `defineProps`).
- Use `withDefaults` for optional props with default values.

---

## Browser Extension Types

- Use `@types/webextension-polyfill` for extension API types (storage, tabs, runtime, etc.).
- Use `webext-bridge` for typed cross-context messaging (background <-> content <-> popup).

```ts
import type { Runtime } from 'webextension-polyfill'
```

---

## ts-expect-error Usage

`@ts-expect-error` is used sparingly for non-standard browser APIs that lack TypeScript definitions (e.g., View Transitions API in `useDark.ts`).

Rules:
- Only use when the API is genuinely non-standard and has no `@types/*` package.
- Always add a comment explaining why.
- Never use as a generic escape hatch to suppress type errors.

```ts
// @ts-expect-error -- View Transitions API not yet in TS DOM types
document.startViewTransition?.(() => { /* ... */ })
```

---

## Path Alias

The `~/` alias maps to `src/`:

```ts
import type { VideoItem } from '~/models/video'
import { useMainStore } from '~/stores/mainStore'
```

Configured in `tsconfig.json` under `compilerOptions.paths`.

---

## Common Patterns

- **Interface over type** for object shapes (the codebase predominantly uses `interface`).
- **Co-locate types** with their consumers rather than in a shared `types/` directory.
- **Enum files** in `src/enums/` for shared constant sets.
- **Re-export** from index files only when a directory has many exports (e.g., `src/models/video/`).

---

## Forbidden Patterns

- `any` -- use `unknown` and narrow with type guards.
- Bare `// @ts-ignore` -- use `@ts-expect-error` only with a comment.
- Type assertions (`as T`) without justification -- prefer type narrowing or generics.
- Placing all types in a single monolithic `types.ts` -- distribute by domain.
