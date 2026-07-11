# Journal - decade (Part 1)

> AI development session journal
> Started: 2026-05-31

---

## Session 1: Migrate extension to Linux.do finish-work check

**Date**: 2026-06-01
**Task**: Migrate extension to Linux.do finish-work check
**Branch**: `main`

### Summary

Validated the Linux.do migration follow-up: user-confirmed tests completed, lint and typecheck pass after formatting Trellis/Claude metadata, and no tracked source diff remains.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `7a340189` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 2: Migrate Trellis to v0.5.19

**Date**: 2026-06-05
**Task**: Migrate Trellis to v0.5.19
**Branch**: `main`

### Summary

Migrated Trellis project scaffolding to v0.5.19, added Linux.do homepage visibility settings, verified lint/typecheck/tests, and archived the migration task.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4e031a94` | (see git log) |
| `e0525a7f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 3: Write Linux.do migration plan

**Date**: 2026-06-05
**Task**: Write Linux.do migration plan
**Branch**: `docs/migration-plan-20260605`

### Summary

Added a localized BewlyLinuxDo migration plan document, captured documentation-only migration plan conventions in the frontend quality spec, verified lint/typecheck, and archived the Trellis task.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b9707822` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 4: Prepare Windows test artifact

**Date**: 2026-06-05
**Task**: Prepare Windows test artifact
**Branch**: `docs/migration-plan-20260605`

### Summary

Generated and verified a local Chrome/Edge Windows test artifact at extension.zip, documented local Chromium artifact generation in the frontend quality spec, and archived the Trellis task. Artifact checksum: 653c1c0b14c35d410692aa4b8435c90c07d9a9ec61416d6e2cfc4653be1461df.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ccce5a07` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 5: Fix Linux.do drawer routing and docs

**Date**: 2026-06-06
**Task**: Fix Linux.do drawer routing and docs
**Branch**: `fix/linux-do-wrapper-drawer`

### Summary

Fixed Linux.do iframe drawer controls and URL history sync, removed copy-link action, restored homepage pinned-topic hiding, added floating settings controls, updated README/docs/package metadata, refreshed frontend code-specs, and validated with lint, tests, typecheck, and build.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `269f97cc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 6: Generate Linux.do extension artifact

**Date**: 2026-06-06
**Task**: Generate Linux.do extension artifact
**Branch**: `fix/linux-do-wrapper-drawer`

### Summary

Generated Chromium extension artifact with pnpm build and pnpm pack:zip, validated extension.zip integrity and Linux.do Manifest V3 scope, committed the regenerated extension.zip artifact, and prepared the branch for push.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9783ee5d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 7: Publish extension zips via GitHub Packages

**Date**: 2026-06-07
**Task**: Publish extension zips via GitHub Packages
**Branch**: `main`

### Summary

Removed Git-tracked extension.zip and added release-only GitHub Packages publish path: new packages/artifacts scoped npm package @decade6666/bewlylinuxdo-artifacts staged from extension.zip + extension-firefox.zip via scripts/stage-artifacts.ts, release-it.yml gains packages: write and a dedicated Setup GitHub Packages step (install/release-it remain on npmjs.org), Release upload and pnpm run submit unchanged; spec extended with Release Artifact Publishing scenario. Validated by pnpm lint/typecheck/test (53/53), pnpm build-firefox, pnpm pack:zip-firefox, pnpm run stage-artifacts.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b9bddac0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 8: Revert GitHub Packages publish path; keep releases only

**Date**: 2026-06-07
**Task**: Revert GitHub Packages publish path; keep releases only
**Branch**: `main`

### Summary

Rolled back commit b9bddac0: deleted .github/workflows/release-it.yml, scripts/stage-artifacts.ts, packages/artifacts/package.json + directory, package.json stage-artifacts script, and the Release Artifact Publishing to GitHub Packages spec scenario; restored Local Chromium Artifact Generation Git-scope wording. Distribution now only via local npx release-it + .release-it.json after:release hooks (gh release upload, pnpm run submit). extension.zip remains untracked via root *.zip ignore. Validated: pnpm lint, pnpm typecheck, pnpm test 53/53 passed.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0e842ef0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 9: Fix drawer click routing and capture specs

**Date**: 2026-06-10
**Task**: Fix drawer click routing and capture specs
**Branch**: `main`

### Summary

Fixed Linux.do drawer link clicks under Shadow DOM by resolving the real click target with composedPath, kept iframe sandbox protections, validated with targeted tests/typecheck/lint, and captured the drawer click/version contracts in frontend specs.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `21a181e1` | (see git log) |
| `2c15dc25` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 10: Release v0.1.2 to GitHub

**Date**: 2026-06-10
**Task**: Release v0.1.2 to GitHub
**Branch**: `main`

### Summary

Prepared and published GitHub Release v0.1.2 by bumping the package version, validating release-related tests, building and verifying extension.zip plus extension-firefox.zip, generating concise release notes, tagging v0.1.2, and uploading both packaged artifacts to the GitHub release.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4f7f3990` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 11: 修复 Horizon 主题下注入 topic tag 的布局错乱

**Date**: 2026-06-17
**Task**: 修复 Horizon 主题下注入 topic tag 的布局错乱
**Branch**: `main`

### Summary

根因：注入容器复用站点类名 discourse-tags，继承 Horizon 主题的 .discourse-tags{display:contents}，在 display:flex 的 td.topic-category-data 内使 span 被移出布局树、内部 a 标签变成父级 flex 项，导致 tag 竖排/挤压/撑高。修复：buildTopicTagContainer 给容器加内联 display:inline-flex !important + flex-wrap/align-items/gap，覆盖站点类选择器，对 default/MOYU 无回归。补 default 与 Horizon 两用例的 display 断言并更新 frontend 契约文档。测试 72/72、typecheck、lint 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f963aec6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
## 2026-06-18 — Drawer: hide linux.do sidebar + top-right header icons

- Task: 06-18-hide-drawer-sidebar-and-top-right-header-icons-on-linux-do (in_progress)
- Decision: content script has no `all_frames`, so it never runs inside the drawer sub-frame. The drawer iframe `src` is same-origin linux.do, so the host injects a `<style id="bewly-drawer-hidden-chrome">` into `iframeRef.contentDocument` on load instead of relying on iframe-side script.
- Scope (confirmed with user): always-on (no setting). Generic Discourse selectors; language-switch matched loosely under `.d-header` because Cloudflare blocked live DOM inspection.
- Files: `src/sites/linuxDo.ts` (new `applyLinuxDoDrawerChrome`), `src/components/IframeDrawer.vue` (call in `handleIframeLoad`), spec contract + 3 unit/regression tests.
- Verify: vitest 78 pass, tsc clean, eslint clean. Live linux.do DOM NOT verified (Cloudflare) — selectors need browser confirmation.

## Session 12: Blocked words popup dialog on linux.do

**Date**: 2026-06-19
**Task**: Blocked words popup dialog on linux.do
**Branch**: `feat/blocked-words-popup-dialog`

### Summary

Refactored the inline homepage blocked-words section in the in-page Linux.do settings panel (src/contentScripts/views/App.vue) into an enable toggle plus a 'Blocked words settings' button that opens a large native modal dialog (overlay/Esc/aria), holding keyword input/add, regex hint, JSON import/export, list, and status. Added blockedWordsSettings/closeBlockedWords i18n to en/cmn-CN/cmn-TW/jyut. Persistence unchanged (storage.local + JSON import/export); backend filtering and contentScripts wiring untouched. Verified: pnpm typecheck pass, eslint clean on App.vue. Not run: live browser/DOM check. Branch feat/blocked-words-popup-dialog, PR #3 -> main.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `756ab8df` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 13: Scroll-top & refresh button above Linux.do settings

**Date**: 2026-06-19
**Task**: Scroll-top & refresh button above Linux.do settings
**Branch**: `feat/scroll-top-refresh-button`

### Summary

Added a floating action button above the Linux.do settings button in App.vue that scrolls to top and refreshes the page. Includes scroll-position state, click handlers, scoped CSS, and i18n for all 4 locales. Passed typecheck and ESLint.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `381eb52c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 14: Drawer header actions + linux.do dark scheme follow

**Date**: 2026-06-20
**Task**: Drawer header actions + linux.do dark scheme follow
**Branch**: `feat/drawer-header-actions`

### Summary

Moved iframe drawer header actions to top-right with themed close Esc keycap; made the linux.do overlay follow the host site's actual color scheme via detectLinuxDoColorScheme (--scheme-type primary, --secondary luminance fallback) with a .dark palette wired through a MutationObserver + matchMedia; fixed version-coupled migration test assertions to derive from package.json. Verified in real dark linux.do (CDP): buttons dark bg/white text, keycap adapts, four drawer behaviors intact, no extension console errors. typecheck/lint/targeted tests green (98 pass).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b9f2f084` | (see git log) |
| `405e44c4` | (see git log) |
| `4c812fc2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 15: Release v0.2.1 (PR #5 merge + version bump, tag & GitHub release)

**Date**: 2026-06-20
**Task**: Release v0.2.1 (PR #5 merge + version bump, tag & GitHub release)
**Branch**: `main`

### Summary

Post-clear wrap-up of the prior session's release work, left unjournaled after Session 14. PR #5 (drawer header repositioning to top-right + Esc keycap + linux.do dark-scheme follow) squash-merged to main (5686c864); added a trellis doc capturing the real-browser extension verification workflow (4d581bd2); bumped version 0.2.0 -> 0.2.1 (819b53cb), built Chrome + Firefox extensions, pushed main, created/pushed git tag v0.2.1, and published the GitHub release with extension.zip + extension-firefox.zip assets. No new code this session. Verified: v0.2.1 tag present and package.json at 0.2.1.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4d581bd2` | (see git log) |
| `5686c864` | (see git log) |
| `819b53cb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 16: 刷新按钮在帖子列表页只刷新列表 + 发布 v0.2.2

**Date**: 2026-06-26
**Task**: 刷新按钮在帖子列表页只刷新列表 + 发布 v0.2.2
**Branch**: `main`

### Summary

App.vue 浮动刷新按钮在 topic list 页改为只刷新帖子列表（点击 Discourse 新帖横幅/激活导航 pill 触发 Ember 同路由原地刷新），非列表页保留整页重载；新增 refreshLinuxDoTopicListInPlace() 与纯函数 resolveScrollAction() 及单测。codex 实现、codex+Antigravity(gemini-3.1-pro) 双审查、review 修复 #1/#4/#5。eslint/typecheck/vitest(108) 全绿。发布 GitHub Release v0.2.2（双 zip 资产，--latest）。真机选择器验证仍 pending（Cloudflare Turnstile 拦截）。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `85525752` | (see git log) |
| `2e7df833` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 17: WebDAV 设置同步与 v0.3.0 发布

**Date**: 2026-07-03
**Task**: WebDAV 设置同步与 v0.3.0 发布
**Branch**: `main`

### Summary

完成屏蔽词 storage.sync 持久化、WebDAV 全量设置同步、linux.do 内联设置接入、WebDAV background 代理与 v0.3.0 覆盖发布。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4af95df8` | (see git log) |
| `2a312fa5` | (see git log) |
| `9427fc7b` | (see git log) |
| `43e3d850` | (see git log) |
| `f28a0b1f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 18: 默认从一楼打开 Linux.do 帖子抽屉

**Date**: 2026-07-08
**Task**: 默认从一楼打开 Linux.do 帖子抽屉
**Branch**: `main`

### Summary

实现 Linux.do 主题链接抽屉统一规范到 /1，补充回归测试与组件契约说明，并准备 v0.3.1 发布。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `76c242ce` | (see git log) |
| `73979837` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete

## Session 19: Manual WebDAV settings dialog

**Date**: 2026-07-10
**Task**: Manual WebDAV settings dialog
**Branch**: `main`

### Summary

Removed legacy settings UI and WebDAV auto-sync, added the manual WebDAV configuration dialog with validated transfer flows and accessibility contracts, and prepared v0.3.2.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `634b124b` | (see git log) |
| `e709101c` | (see git log) |
| `214c2694` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
