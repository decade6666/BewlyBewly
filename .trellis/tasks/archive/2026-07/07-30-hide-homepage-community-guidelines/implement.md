# Implement: 屏蔽首页社区准则横幅

## Checklist

1. [x] `src/logic/storage.ts` — add field + default `false`
2. [x] `src/sites/linuxDo.ts` — constants, kind, options, find/hide/restore helpers
3. [x] `src/contentScripts/index.ts` — watch + option mapping
4. [x] `src/contentScripts/views/App.vue` — checkbox + 4 locale labels
5. [x] `src/tests/linuxDoMigration.spec.ts` — behavior + meta tests
6. [x] `src/tests/settingsMigration.spec.ts` — legacy + new key coexistence
7. [x] `.trellis/spec/frontend/state-management.md` — contract update
8. [x] README optional one-line mention

## Validation commands

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts src/tests/settingsMigration.spec.ts
pnpm typecheck
pnpm exec eslint src/sites/linuxDo.ts src/contentScripts/index.ts src/contentScripts/views/App.vue src/logic/storage.ts src/tests/linuxDoMigration.spec.ts src/tests/settingsMigration.spec.ts
```

## Review gates

- All DOM writes go through existing `hideElement` / restore primitives (idempotent)
- No global `document.body` references in new helpers
- New key never listed in `LEGACY_SETTINGS_KEYS`
- Meta tests still assert old identifiers absent; assert new identifiers present

## Rollback

- Revert the five source files + tests + spec; no storage schema versioning beyond field absence (mergeDefaults restores default)
