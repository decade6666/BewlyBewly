# 插件界面版本与主页屏蔽词设置

## Goal

将插件界面/扩展版本更新到用户指定的 v0.1，并在 Linux.do 页面内设置面板增加屏蔽词开关与屏蔽词列表；开关开启后，在 Linux.do 主页隐藏文本中包含屏蔽词的帖子，减少用户不想看到的主页内容。

## What I already know

* 用户要求版本号更新为 `v0.1`。
* 用户确认插件界面说明采用推荐文案：“面向 Linux.do 的专注抽屉浏览与首页内容过滤体验。”
* 用户要求设置界面增加屏蔽词开关和屏蔽词列表。
* 用户要求开启后屏蔽主页中含有屏蔽词的帖子。
* `package.json` 当前版本是 `0.41.1`，描述是 `Add a focused drawer browsing experience to Linux.do.`。
* `src/manifest.ts` 使用 `package.json` 的 `version` 和 `description` 生成扩展 manifest，因此 WebExtension manifest 版本应使用 `0.1`，界面显示可继续带 `v` 前缀。
* `src/components/Settings/About/About.vue` 当前显示 `v{{ version }} - Farewell`。
* Linux.do 主页 DOM 清理集中在 `src/sites/linuxDo.ts` 的 `hideLinuxDoHomePageElements()`。
* 内容脚本入口 `src/contentScripts/index.ts` 已用 `MutationObserver` 持续调用主页清理，并 watch `settings.value.hideHomePagePinnedTopics`。
* Linux.do 浮动设置面板位于 `src/contentScripts/views/App.vue`，目前只有“隐藏首页置顶话题”开关。
* 现有设置存储在 `src/logic/storage.ts` 的 `Settings` / `originalSettings` 中，并通过 `mergeDefaults` 兼容新增字段。
* 现有测试 `src/tests/linuxDoMigration.spec.ts` 已覆盖 Linux.do 主页隐藏置顶话题、开关恢复、非主页不影响等行为。

## Assumptions (temporary)

* “主页”按现有 `isLinuxDoHomePage()` 定义，仅包含 `https://linux.do/` 和 `https://linux.do/latest`。
* 屏蔽词匹配同时支持普通包含匹配和 `/pattern/` 正则匹配；匹配范围先覆盖 topic list item 的可见文本。
* 普通屏蔽词匹配默认忽略大小写并 trim 空白；空屏蔽词不生效；正则沿用现有 `/pattern/` 约定并使用大小写不敏感匹配。
* 同一个元素可能被多个规则隐藏，需要能在关闭某个规则后正确恢复或保留其他规则的隐藏效果。
* 设置面板继续使用当前轻量内联 UI，不引入新的组件库。

## Open Questions

* 暂无。

## Requirements (evolving)

* 将扩展/界面版本更新为 `v0.1`：manifest 版本使用 `0.1`，界面显示 `v0.1`。
* 更新插件界面说明文案为“面向 Linux.do 的专注抽屉浏览与首页内容过滤体验。”
* 在 Linux.do 设置面板增加屏蔽词开关。
* 在 Linux.do 设置面板增加屏蔽词列表，支持添加、删除、导入和导出屏蔽词。
* 屏蔽词支持普通文本包含匹配和 `/pattern/` 正则匹配。
* 当屏蔽词开关开启时，隐藏 Linux.do 主页 topic list item 中文本匹配任一屏蔽词的帖子。
* 当屏蔽词开关关闭时，恢复仅因屏蔽词隐藏的帖子。
* 继续保留既有“隐藏首页置顶话题”行为。
* 非主页页面不应隐藏帖子。

## Acceptance Criteria (evolving)

* [ ] `package.json` 版本更新为 `0.1`，构建生成 manifest 使用 `0.1`。
* [ ] About/插件界面显示版本为 `v0.1`。
* [ ] 插件界面说明文案更新为“面向 Linux.do 的专注抽屉浏览与首页内容过滤体验。”
* [ ] Linux.do 设置面板可开关屏蔽词功能。
* [ ] Linux.do 设置面板可添加、展示、删除、导入、导出屏蔽词。
* [ ] 普通文本屏蔽词和 `/pattern/` 正则屏蔽词都能匹配帖子文本。
* [ ] 开启屏蔽词后，`/` 与 `/latest` 中匹配屏蔽词的 topic item 被隐藏。
* [ ] 关闭屏蔽词后，因屏蔽词隐藏的 topic item 恢复显示。
* [ ] 屏蔽词隐藏不影响置顶话题隐藏规则的独立开关行为。
* [ ] `pnpm test -- linuxDoMigration` 或等价窄测试通过。
* [ ] `pnpm typecheck` 或等价类型检查通过，若耗时/环境不允许需说明。

## Definition of Done (team quality bar)

* Tests added/updated for the new screen-word behavior.
* Lint / typecheck / relevant tests green, or clearly report failures and skipped checks.
* Existing homepage pinned-topic cleanup behavior remains covered.
* No unrelated refactor or Bilibili legacy feature expansion.
* Rollback is simple: disable the new switch or remove the new settings fields.

## Technical Approach

* 版本/说明：更新 `package.json` 的 `version` 与 `description`；About 页继续读取 package version，并把 `Farewell` 替换为确认后的中文说明。
* 设置存储：在 `Settings` / `originalSettings` 增加 `enableHomePageBlockedWords` 与 `homePageBlockedWords: string[]`，依赖现有 `mergeDefaults` 自动补默认值。
* 设置 UI：在 Linux.do 浮动设置面板增加屏蔽词开关、输入框、列表、导入与导出按钮；标签继续使用 `App.vue` 内部 `appMessages` 多语言对象。
* 屏蔽逻辑：扩展 `hideLinuxDoHomePageElements()`，在主页扫描 `TOPIC_ITEM_SELECTOR`；开启时按普通文本或 `/pattern/` 正则匹配 item 文本并隐藏。
* 恢复逻辑：拆分/扩展隐藏标记，确保关闭屏蔽词时只恢复因屏蔽词隐藏的帖子，不破坏置顶话题隐藏状态。
* 验证：新增/更新 `linuxDoMigration.spec.ts` 单元测试，覆盖文本匹配、正则匹配、关闭恢复、非主页不影响、与置顶隐藏并存。

## Decision (ADR-lite)

**Context**: 现有 Linux.do 首页清理已通过内容脚本 MutationObserver + `src/sites/linuxDo.ts` 集中处理置顶话题隐藏。

**Decision**: 复用这条 Linux.do 专用清理链路，在同一设置面板中加入屏蔽词配置，并在同一清理函数中处理帖子文本匹配。

**Consequences**: 改动集中、易测试、无需引入新依赖；需要谨慎处理多个隐藏原因的恢复逻辑，避免关闭某个开关时误显示仍应隐藏的帖子。

## Implementation Plan (small PRs)

* Step 1: 更新版本/说明与设置 schema 默认值。
* Step 2: 扩展 Linux.do 设置面板，加入屏蔽词开关、列表、导入/导出。
* Step 3: 扩展主页清理逻辑，支持普通文本和 `/pattern/` 正则匹配。
* Step 4: 增补测试并运行窄测试、类型检查。
* Step 5: 按质量门要求做变更审查并修复 Critical/High 问题。

## Out of Scope (explicit)

* 不支持云同步屏蔽词。
* 不支持云同步或跨设备同步屏蔽词列表。
* 不支持通配符、按分类/作者单独配置，除非后续明确要求。
* 不改变抽屉打开帖子的现有行为。
* 不扩大到非主页页面。

## Technical Notes

* Likely files to modify:
  * `package.json` — version/description source；manifest 英文描述建议使用 `Focused drawer browsing and homepage content filtering for Linux.do.`。
  * `src/components/Settings/About/About.vue` — UI version/description display.
  * `src/logic/storage.ts` — add settings fields such as `enableHomePageBlockedWords` and `homePageBlockedWords`.
  * `src/sites/linuxDo.ts` — add keyword-based topic item hiding/restoring to homepage cleanup.
  * `src/contentScripts/index.ts` — pass new options and watch new setting/list.
  * `src/contentScripts/views/App.vue` — add Linux.do settings UI labels and list editing.
  * `src/tests/linuxDoMigration.spec.ts` — add tests for keyword hiding/restoring and source boundary assertions.
* Existing hiding mechanism uses `data-bewly-home-page-hidden` with a single kind; multiple hide reasons may require careful restoration design to avoid un-hiding items still hidden by another reason.
* Import/export can follow the existing `FilterByTitle` / `FilterByUser` JSON-list pattern, but should target the Linux.do floating settings panel.
* Existing UI uses direct localized label object in `App.vue`, not `_locales/*.yml`, for the Linux.do floating panel.
