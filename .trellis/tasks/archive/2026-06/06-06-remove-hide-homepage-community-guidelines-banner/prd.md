# 删除隐藏首页社区准则横幅功能

## Goal

删除扩展中“隐藏首页社区准则横幅”的设置入口与隐藏行为，让 Linux.do 首页社区准则横幅保持站点默认展示，同时保留“隐藏首页置顶话题”等其他首页可见性控制能力。

## What I already know

* 用户要求删除“隐藏首页社区准则横幅”的功能。
* 用户要求同步删除设置中的按钮/开关入口。
* 需要避免影响其他首页可见性控制功能。
* 代码库检查发现该功能跨越：设置存储、设置页 UI、内容脚本浮动设置面板、Linux.do DOM cleanup helper、回归测试、README 功能说明。

## Requirements

* 移除主设置页中“隐藏首页社区准则横幅”的设置项。
* 移除 Linux.do 浮动设置面板中“隐藏首页社区准则横幅”的复选框与本地化文案。
* 移除 `Settings` / `originalSettings` 中的 `hideHomePageGuidelineBanner` 字段和默认值。
* 清理旧浏览器本地存储中的 `hideHomePageGuidelineBanner` 字段，避免废弃键继续保留。
* 移除内容脚本对 `hideHomePageGuidelineBanner` 的监听和运行时映射。
* 修改 Linux.do 首页清理逻辑，使其只处理“隐藏首页置顶话题”，不再查找或隐藏社区准则横幅。
* 更新回归测试：删除/改写 guideline banner 隐藏相关断言，保留并强化 pinned topics 仍可独立隐藏/保留的断言。
* 更新 README 中关于首页清理功能的描述，避免继续宣称会隐藏社区准则横幅。

## Acceptance Criteria

* [ ] 主设置页不再出现 `settings.hide_homepage_guideline_banner` 相关设置项。
* [ ] Linux.do 浮动设置面板不再出现 “Hide homepage guideline banner / 隐藏首页社区准则横幅”等文案或复选框。
* [ ] `hideLinuxDoHomePageElements` 不再隐藏含《社区准则》文本的横幅。
* [ ] `hideLinuxDoHomePageElements` 仍能在首页与 `/latest` 隐藏置顶话题。
* [ ] 禁用置顶话题清理时，置顶话题保持可见；已由扩展隐藏的置顶话题能被恢复。
* [ ] 相关文档不再把 guideline banner 隐藏列为功能。
* [ ] 已验证旧 `settings.hideHomePageGuidelineBanner` 存储字段会被清理，且不会影响其他设置值。
* [ ] 窄范围 Vitest、typecheck/lint 按项目要求通过，或失败原因被明确记录。

## Definition of Done

* Source changes follow existing Vue/TypeScript style and immutability expectations.
* Relevant regression tests are updated and pass.
* `pnpm typecheck` and `pnpm lint` are run after source changes.
* No unrelated homepage visibility controls are changed.
* No generated artifacts are staged or committed.

## Technical Approach

Use a surgical removal approach:

1. Storage/state layer: delete the persisted setting field from `src/logic/storage.ts`; add a focused legacy cleanup path that removes `hideHomePageGuidelineBanner` from the stored `settings` object without dropping other values.
2. UI layer: remove the relevant settings controls from `src/components/Settings/BewlyPages/Home/Home.vue` and `src/contentScripts/views/App.vue`; remove unused localized labels in `App.vue` and locale YAML where present.
3. Runtime layer: simplify `src/contentScripts/index.ts` watcher/options mapping to only track `hideHomePagePinnedTopics`; simplify `src/sites/linuxDo.ts` cleanup options and helper logic to only pinned topics.
4. Test/docs layer: update `src/tests/linuxDoMigration.spec.ts`, `README.md`, and `README-cmn_CN.md` to match the new behavior.

## Decision (ADR-lite)

**Context**: The existing feature is user-facing and cross-layer. Removing only the button would leave hidden runtime behavior behind; removing only runtime logic would leave a dead setting.

**Decision**: Remove the feature end-to-end and include a focused cleanup for the old browser-local `settings.hideHomePageGuidelineBanner` field.

**Consequences**: The implementation includes a small storage migration/cleanup path, so the stored settings object stays clean while preserving all other settings values.

## Expansion Sweep

### Future evolution

* If homepage cleanup expands again, new controls should be added end-to-end across storage → UI → content script → site helper → tests.
* No new extension point is needed for this deletion.

### Related scenarios

* “隐藏首页置顶话题” should remain consistent in both the main settings page and the Linux.do floating settings panel.
* Drawer routing/history behavior should remain untouched.

### Failure / edge cases

* Existing DOM elements previously hidden by the guideline feature may stay hidden only until the page reloads; runtime DOM restore is not part of the storage cleanup.
* Old persisted storage keys should be removed from the stored settings object without resetting unrelated preferences.

## Out of Scope

* 不删除或重命名“隐藏首页置顶话题”。
* 不移除 Linux.do 浮动设置入口本身。
* 不新增复杂的版本化迁移框架；只做本次废弃键的定向清理。
* 不调整 iframe 抽屉、路由、历史记录或其他 Bilibili 迁移残留问题。

## Technical Notes

* Project rules read: `AGENTS.md`, `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/state-management.md`, `.trellis/spec/frontend/type-safety.md`, `.trellis/spec/frontend/quality-guidelines.md`.
* Likely source files: `src/logic/storage.ts`, `src/components/Settings/BewlyPages/Home/Home.vue`, `src/contentScripts/views/App.vue`, `src/contentScripts/index.ts`, `src/sites/linuxDo.ts`.
* Likely tests/docs: `src/tests/linuxDoMigration.spec.ts`, `README.md`, `README-cmn_CN.md`, `src/_locales/en.yml`, `src/_locales/cmn-CN.yml`.
* `src/_locales/cmn-TW.yml` and `src/_locales/jyut.yml` did not contain the main settings keys found in English/Simplified Chinese, but `App.vue` contains inline TW/Jyut labels for the floating settings panel.
* Validation scripts from `package.json`: `pnpm test`, `pnpm typecheck`, `pnpm lint`.
