# Technical Design: Remove Legacy Settings Tree

## Design Summary

Delete the entire unmounted `src/components/Settings/**` ownership boundary, remove localization and test/config references that exist only to support that boundary, and leave every active runtime contract unchanged.

This is deletion by proven reachability, not a redesign. The active Linux.do settings surface is `src/contentScripts/views/App.vue`; no replacement is created for dead About, Home, or DataSync UI.

## Deletion Boundary

The deletion unit is the complete directory subtree:

```text
src/components/Settings/
├─ Settings.vue
├─ types.ts
├─ About/About.vue
├─ Appearance/Appearance.vue
├─ BIlibiliSettings/BilibiliSettings.vue
├─ BewlyPages/BewlyPages.vue
├─ BewlyPages/Home/Home.vue
├─ BewlyPages/Home/components/FilterByTitleTable.vue
├─ BewlyPages/Home/components/FilterByUserTable.vue
├─ BewlyPages/SearchPage/SearchPage.vue
├─ Compatibility/Compatibility.vue
├─ DataSync/DataSync.vue
├─ DesktopAndDock/DesktopAndDock.vue
├─ General/General.vue
└─ components/
   ├─ ChangeWallpaper.vue
   ├─ SettingsItem.vue
   └─ SettingsItemGroup.vue
```

No file outside that directory is deleted in this child.

## Reachability Basis

- The root has no external import, route, mount, menu, or template consumer.
- Descendants are reachable only from the dead root or another descendant.
- Vite auto-imports Vue functions but does not auto-register components.
- Active Linux.do settings use the Shadow DOM `App.vue` surface.
- Existing source-regression tests are evidence consumers, not runtime consumers.

A post-deletion exact search must reconfirm these assumptions rather than relying only on the earlier research report.

## Localization Removal

Delete the complete top-level `settings:` mapping from:

- `src/_locales/en.yml`
- `src/_locales/cmn-CN.yml`
- `src/_locales/cmn-TW.yml`
- `src/_locales/jyut.yml`

The edit is bounded by YAML top-level indentation. It must not remove adjacent mappings or shared namespaces such as `common:`. The build and lint checks validate syntax; an exact top-level-key test validates scope.

The active Linux.do `appMessages` table in `App.vue` is unrelated and remains unchanged in this child.

## Test Retargeting

`src/tests/linuxDoMigration.spec.ts` currently has three direct dependencies on deleted sources.

### About/version assertion

Remove the test that opens `src/components/Settings/About/About.vue`. Do not invent a replacement About component or relocate dead display text. Package/manifest identity and version tests elsewhere remain intact.

### Home settings assertion

Remove `homeSettingsSource` and its assertion from the legacy-guideline cleanup test. Preserve assertions against active storage, migration, and locale contracts.

### DataSync/background assertion

Remove `dataSyncSource` and its expectation. Preserve checks that:

- active `App.vue` uses the background test wrapper;
- `settingsSync.ts` uses background upload/download wrappers and not raw WebDAV fetch functions;
- the background worker registers TEST/UPLOAD/DOWNLOAD handling;
- the manifest retains `<all_urls>`.

### Deletion contract

Add a focused repository-boundary test before deletion that fails while any of the following remain:

- `src/components/Settings` exists;
- a locale file has a top-level `settings:` key;
- `knip.json` ignores `src/components/Settings/**`.

This gives the deletion a RED/GREEN contract without weakening active behavior assertions.

## Knip Configuration

Change:

```json
{
  "ignore": ["src/components/Settings/**", "src/inject/**"]
}
```

to retain only the unrelated ignore:

```json
{
  "ignore": ["src/inject/**"]
}
```

No entry points, dependency ignores, binary ignores, or Knip rules change.

## Preserved Contracts

The following remain outside this child's ownership:

- `src/logic/storage.ts`, its `Settings` interface/defaults, and active consumers;
- `src/components/Dialog.vue` and all shared components outside the deleted subtree;
- `src/contentScripts/views/App.vue` behavior and inline localization;
- WebDAV client, background listener, runtime messages, settings sync, and permissions;
- package dependencies and static assets, even if the deletion makes some candidates worth a later audit.

If Knip or build checks reveal a newly unused dependency/asset, report it for a separate whole-repository audit instead of expanding this task.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Hidden runtime consumer | Exact pre/post search, no component auto-registration, typecheck, build, and real entry-point tests. |
| Over-deleting YAML | Remove only an indentation-bounded top-level mapping; assert all four files parse/build and shared keys remain. |
| Weakening active WebDAV coverage | Retarget background-routing assertions to active sources and retain transport/permission checks. |
| Accidental central model cleanup | Keep `src/logic/storage.ts` and all files outside the tree out of the deletion boundary. |
| Unrelated dependency cleanup | Keep dependency/static-asset changes explicitly out of scope. |

## Rollback

Restore the directory, four locale mappings, three test-source references, and Knip ignore together. A partial restore would either leave broken tests/config or resurrect a tree without its localization. No persisted data or wire-format rollback is involved.
