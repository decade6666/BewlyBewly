# Legacy Settings Tree Deletion Impact

## Safe runtime boundary

- `src/components/Settings/Settings.vue` has no import, template mount, route, or entry-point consumer outside its own subtree.
- `vite.config.ts:24-45` configures Vue function auto-imports and vue-i18n resources but no component auto-registration plugin. Files under `src/components/Settings/**` are not made reachable implicitly.
- Exact repository search found no `<Settings>` usage or import of `Settings.vue` outside the subtree.
- The tree contains 17 files and 2,855 lines, all under `src/components/Settings/**`.
- Its descendants are reached only by `Settings.vue` async menu imports or by relative imports from other descendants. No descendant has an independent runtime consumer outside the tree.

## Tree-owned files

- Root/menu: `src/components/Settings/Settings.vue`, `src/components/Settings/types.ts`
- Sections: `About/About.vue`, `Appearance/Appearance.vue`, `BIlibiliSettings/BilibiliSettings.vue`, `Compatibility/Compatibility.vue`, `DataSync/DataSync.vue`, `DesktopAndDock/DesktopAndDock.vue`, `General/General.vue`
- Bewly pages: `BewlyPages/BewlyPages.vue`, `BewlyPages/Home/Home.vue`, `BewlyPages/SearchPage/SearchPage.vue`, and the two Home filter table components
- Shared only within the tree: `components/ChangeWallpaper.vue`, `components/SettingsItem.vue`, `components/SettingsItemGroup.vue`

## Test dependencies

`src/tests/linuxDoMigration.spec.ts` reads three legacy-tree sources directly:

- `src/components/Settings/About/About.vue` at `src/tests/linuxDoMigration.spec.ts:83-96` for a legacy About/version source assertion.
- `src/components/Settings/BewlyPages/Home/Home.vue` at `src/tests/linuxDoMigration.spec.ts:1275-1302` to assert an already-removed control stays absent.
- `src/components/Settings/DataSync/DataSync.vue` at `src/tests/linuxDoMigration.spec.ts:1337-1370` to assert background WebDAV usage.

These assertions must be removed or retargeted to active runtime contracts. The active WebDAV background assertion should continue against `src/contentScripts/views/App.vue`; the two dead-UI source assertions should not be preserved by inventing replacement UI.

## Localization impact

- Exact search for `$t('settings.*')` / `t('settings.*')` outside `src/components/Settings/**` returned no consumers.
- The active Linux.do settings panel uses its own four-language `appMessages` in `src/contentScripts/views/App.vue`, not the `_locales` `settings` namespace.
- Locale removal should be limited to keys/namespaces proven tree-exclusive; `common.*` remains used by shared components such as `Dialog.vue`.

## Contracts that must remain

Deleting the UI tree does not make the central settings model obsolete. Many fields in `src/logic/storage.ts` are still read by active content-script behavior, stores, and site helpers. Do not remove settings fields merely because their legacy controls disappear.

Likewise, do not remove shared components outside `src/components/Settings/**`, WebDAV transport code, or background permissions.

## Build and package observations

- `knip.json` already treats `src/components/**` as entries and ignores `src/components/Settings/**`, so deletion should also remove the now-unnecessary settings-specific ignore when verified safe.
- Package/dependency and static-asset cleanup is a separate impact surface. Remove an asset or dependency only after an exact whole-repository reference check proves it is tree-exclusive; otherwise keep it outside this feature scope.
