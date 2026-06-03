# Directory Structure

> How frontend code is organized in this project.

---

## Overview

BewlyBewly is a browser extension built with Vue 3 + TypeScript + Vite. Source lives under `src/` with multiple entrypoints for the extension's popup, options page, content scripts, background worker, and injected scripts.

---

## Directory Layout

```
src/
├── _locales/                  # i18n YAML locale files (en.yml, etc.)
├── background/                # Extension background service worker
├── components/                # Shared Vue components
│   ├── Button.vue
│   ├── VideoCard/
│   │   └── VideoCard.vue
│   ├── Settings/              # Settings panel components
│   ├── Dock/                  # Dock navigation components
│   ├── SideBar/               # Sidebar components
│   └── TopBar/                # Top bar components
├── composables/               # Vue composables (use* naming)
│   ├── useAppProvider.ts
│   ├── useDark.ts
│   ├── useDelayedHover.ts
│   ├── useFilter.ts
│   └── useStorageLocal.ts
├── constants/                 # Shared constants
├── contentScripts/            # Content script entrypoints
├── enums/                     # TypeScript enums
│   └── appEnums.ts
├── inject/                    # Injected page scripts
├── logic/                     # Shared business logic
│   ├── index.ts               # Re-exports from storage.ts
│   ├── storage.ts             # Settings model & persistent refs
│   └── common-setup.ts        # Pinia, vue-i18n, global plugin setup
├── models/                    # TypeScript type/model definitions
│   ├── linuxDo.ts
│   ├── video/
│   ├── anime/
│   ├── history/
│   ├── live/
│   └── moment/
├── options/                   # Options page entrypoint
│   └── main.ts
├── popup/                     # Popup entrypoint
├── sites/                     # Per-site content scripts
│   └── linuxDo.ts
├── stores/                    # Pinia stores
│   ├── mainStore.ts
│   ├── settingsStore.ts
│   └── topBarStore.ts
├── styles/                    # Global styles
│   ├── variables.scss         # CSS custom properties (--bew-*)
│   ├── main.scss
│   ├── reset.css
│   └── adaptedStyles/         # Site-specific style overrides
├── utils/                     # Utility functions
│   ├── api.ts                 # API helpers
│   └── i18n.ts                # i18n setup
└── tests/                     # Vitest test files
    ├── demo.spec.ts
    ├── linuxDoMigration.spec.ts
    └── uriParse.spec.ts
```

---

## Module Organization

- **Components**: shared UI components live in `src/components/`. Domain-specific components are grouped into subdirectories (e.g., `VideoCard/`, `Settings/`, `Dock/`).
- **Composables**: reusable stateful logic lives in `src/composables/` with `use*` naming.
- **Models**: TypeScript type definitions are organized by domain under `src/models/` (e.g., `video/`, `anime/`, `history/`).
- **Stores**: Pinia stores live in `src/stores/`, one file per store.
- **Entrypoints**: each extension context (popup, options, content script, background, inject) has its own directory or file as an entrypoint.

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Vue SFCs | PascalCase | `VideoCard.vue`, `Button.vue` |
| Composables | camelCase with `use` prefix | `useStorageLocal.ts`, `useDark.ts` |
| Stores | camelCase with `Store` suffix | `mainStore.ts`, `settingsStore.ts` |
| Models | camelCase, domain-grouped in subdirs | `models/video/`, `models/linuxDo.ts` |
| Enums | PascalCase files, camelCase dir | `enums/appEnums.ts` |
| Style files | camelCase or kebab-case | `variables.scss`, `reset.css` |
| Test files | `<name>.spec.ts` | `linuxDoMigration.spec.ts` |

---

## Examples

- Well-structured component: `src/components/VideoCard/VideoCard.vue`
- Composable with provider/inject pattern: `src/composables/useAppProvider.ts`
- Domain model directory: `src/models/video/`
- Store file: `src/stores/settingsStore.ts`
