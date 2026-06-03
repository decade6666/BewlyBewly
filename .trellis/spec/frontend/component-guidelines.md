# Component Guidelines

> How components are built in this project.

---

## Overview

Components are Vue 3 Single File Components (SFCs) using the Composition API with `<script lang="ts" setup>`. The project uses scoped SCSS for component styles combined with UnoCSS utility classes.

---

## Component Structure

Standard SFC order: `<script setup>` first, then `<template>`, then `<style scoped>`.

```vue
<script lang="ts" setup>
// 1. Imports
// 2. Props / Emits definitions
// 3. Local state (ref, reactive)
// 4. Composables
// 5. Computed / watchers
// 6. Methods / handlers
</script>

<template>
  <section class="component-name">
    Template markup
  </section>
</template>

<style lang="scss" scoped>
/* Component-scoped styles */
</style>
```

Real example: `src/components/VideoCard/VideoCard.vue`

---

## Props Conventions

Props are defined with a local `interface Props` and `defineProps<Props>()`. Default values use `withDefaults`.

```vue
<script lang="ts" setup>
interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
})
</script>
```

Real examples: `src/components/Button.vue`, `src/components/VideoCard/VideoCard.vue`

Emits use the string-array form:

```ts
const emit = defineEmits(['click', 'close'])
```

---

## Styling Patterns

Styling combines multiple approaches:

1. **Scoped SCSS** -- component-specific styles in `<style lang="scss" scoped>`.
2. **UnoCSS utility classes** -- for layout and spacing (configured in `unocss.config.ts`).
3. **BEM-like class naming** -- e.g., `.b-button--type-primary`, `.video-card__info`.
4. **CSS custom properties** -- project-wide design tokens via `--bew-*` variables defined in `src/styles/variables.scss`.
5. **Shadow-DOM-aware selectors** -- `:host` and `:root.dark` used in content scripts where styles must pierce shadow boundaries.

```vue
<template>
  <div class="video-card">
    <h3 class="video-card__title">
      {{ title }}
    </h3>
    <button class="b-button b-button--type-primary">
      Play
    </button>
  </div>
</template>

<style lang="scss" scoped>
.video-card {
  font-size: var(--bew-base-font-size);

  &__title {
    color: var(--bew-text-1);
  }
}
</style>
```

---

## Accessibility

Accessibility patterns are not strongly established in the current codebase. When adding interactive UI:

- Prefer semantic HTML elements (`<button>`, `<nav>`, `<main>`, etc.) over generic `<div>` with click handlers.
- Add `aria-label` or `aria-labelledby` for icon-only buttons.
- Ensure keyboard navigability for interactive elements (tab order, Enter/Space activation).
- Do not add ARIA roles that contradict the element's native semantics.

This is a documented gap; improving a11y is a gradual effort, not a blocking requirement for new code.

---

## Common Mistakes

- Putting `<template>` before `<script setup>` -- the codebase convention is script first.
- Using `defineProps<{...}>()` inline without a named interface -- use `interface Props` for readability.
- Using `@ts-expect-error` to suppress prop type issues -- fix the type instead.
- Writing global (unscoped) styles in component files -- use scoped styles unless explicitly targeting shadow DOM.
