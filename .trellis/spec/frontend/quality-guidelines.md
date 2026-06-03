# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

The project enforces code quality through ESLint (Antfu config), Vitest for testing, TypeScript strict mode, and pre-commit hooks via `simple-git-hooks` + `lint-staged`.

---

## Linting

- **ESLint**: flat config in `eslint.config.mjs`, using `@antfu/eslint-config` plus `simple-import-sort`.
- **Prettier**: disabled in the editor; ESLint handles formatting.
- **Max 5 attributes per line** in templates (enforced by ESLint config).
- **Pre-commit**: `lint-staged` runs `eslint --fix` on staged files via `simple-git-hooks`.
- **Knip**: dead code detection configured in `knip.json`.

Commands:
- Lint: `pnpm lint` (or equivalent project script)
- Typecheck: `pnpm typecheck`

---

## Forbidden Patterns

- `console.log` in production code -- remove debug logging before committing.
- Bare `// @ts-ignore` -- use `// @ts-expect-error` with a comment only for non-standard APIs.
- `any` type -- use `unknown` and narrow.
- Global (unscoped) styles in component files -- use `<style scoped>`.
- Using `localStorage` directly -- use `useStorageLocal` (extension storage).
- Importing from absolute paths without the `~/` alias -- use `~/` for `src/` references.

---

## Required Patterns

- Vue SFCs use `<script lang="ts" setup>` (Composition API).
- Props defined via `interface Props` + `defineProps<Props>()`.
- Composables follow `use*` naming in `src/composables/`.
- Pinia stores use the setup store pattern (`defineStore('name', () => {...})`).
- Browser APIs accessed through `webextension-polyfill` (`browser.*`).
- CSS custom properties from `src/styles/variables.scss` (`--bew-*`) for design tokens.

---

## Content Script DOM Contracts

### Linux.do homepage cleanup

**Scope / Signature**: `hideLinuxDoHomePageElements(root: ParentNode, url: string): void` is a homepage-only cleanup helper for Linux.do content scripts.

**Contract**:
- Treat both `https://linux.do/` and `https://linux.do/latest` as homepage cleanup scope because the site can resolve the landing page to `/latest`.
- Do not run homepage cleanup on category pages (`/c/...`), topic pages (`/t/...`), or other topic-list routes such as `/top` and `/hot`.
- Match pinned topics through real Discourse table rows (`tr.topic-list-item`) instead of broad class-substring selectors.
- Never hide `body`, page wrappers, or topic-card layout containers during pinned-topic cleanup.

**Wrong**:
```ts
const TOPIC_ROW_SELECTOR = '[class*="topic-card" i], article'
```

**Correct**:
```ts
const TOPIC_ROW_SELECTOR = 'tr.topic-list-item'
```

**Tests Required**:
- Assert `/latest` is included in homepage cleanup scope.
- Assert pinned `tr.topic-list-item` rows are hidden and normal rows remain visible.
- Assert `body.uc-enable-horizon-high-context-topic-cards` and layout containers are not hidden.
- Assert category and topic pages keep homepage-only elements visible.

---

## Testing Requirements

- **Framework**: Vitest with jsdom environment.
- **Test location**: `src/tests/*.spec.ts`.
- **Naming**: `<feature>.spec.ts`, e.g., `linuxDoMigration.spec.ts`.
- **Existing tests**: `src/tests/demo.spec.ts`, `src/tests/linuxDoMigration.spec.ts`, `src/tests/uriParse.spec.ts`.
- Run tests: `pnpm test` (or `vitest`).
- New features and bug fixes should include tests where practical.
- Pure logic (parsers, migrations, utility functions) must have unit tests.

---

## Build & Bundling

- **Vite** for main build (`vite.config.ts`).
- **Separate content script config**: `vite.config.content.ts`.
- **tsup** for background/inject scripts (`tsup.config.ts`).
- **UnoCSS**: configured in `unocss.config.ts` with presets (Uno, Attributify, Icons, Typography) and custom rem conversion to `--bew-base-font-size`.

---

## Code Review Checklist

- [ ] Script setup order: imports, props/emits, state, composables, computed, methods.
- [ ] Props use `interface Props` + `defineProps`.
- [ ] Styles are scoped.
- [ ] No `console.log` left in code.
- [ ] No `any` types.
- [ ] Browser APIs go through `webextension-polyfill`.
- [ ] New composables follow `use*` naming.
- [ ] Test added for pure logic changes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
