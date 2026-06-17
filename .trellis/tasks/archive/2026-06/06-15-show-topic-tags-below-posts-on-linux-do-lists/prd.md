# Show topic tags below posts on linux.do home list

## Goal

在 linux.do 首页话题列表（`/` 和 `/latest`）里，让每个帖子在已有「类别」徽章后面、同一行显示该帖子的标签（tag），标签可点击跳转 `/tag/{name}`。属于迁移计划 P1 #5「Discourse 话题列表增强 — 分类/标签高亮」。

## Requirements

* 首页列表（`isLinuxDoHomePage`：`/`、`/latest`）每个帖子在类别徽章后注入其标签链接 `a.discourse-tag[href="/tag/{name}"]`，与类别同一行。
* 标签数据从 `topic-list-item` 行的 `class` 中 `tag-{name}` token 提取，无需联网。
* 注入到 linux.do **原生 DOM**，沿用 `discourse-tag` class，由 linux.do 自带样式渲染（外观与原生一致）。
* 提供设置开关 `showHomePageTopicTags`，默认开；用户可在浮动设置面板关闭，关闭时移除已注入标签。
* 与现有「隐藏置顶」「屏蔽词」逻辑共存，且在 MutationObserver 增量加载后对新行生效。
* 幂等：重复执行不重复注入；compare-before-mutate 避免触发 observer 反馈循环。

## Acceptance Criteria

* [ ] 首页列表中，含 `tag-xxx` class 的帖子在类别徽章后显示对应标签链接，href = `/tag/{name}`。
* [ ] 无标签 token 的帖子不注入任何元素、无空白占位。
* [ ] 同一行已注入且标签集未变时，再次运行不产生重复元素、不触发无限 mutation。
* [ ] 非首页（`/c/...`、`/top`、`/hot`、单帖页）不注入标签。
* [ ] 开关关闭后，已注入标签被移除；重新打开后恢复。
* [ ] 滚动/翻页新加载的行也能正确显示标签。
* [ ] 单元测试覆盖：提取、注入、幂等、范围限制、开关开/关、无标签行。

## Definition of Done

* 单元测试新增（jsdom，沿用 `linuxDoMigration.spec.ts` 模式），覆盖上述 AC。
* lint / typecheck 通过。
* 迁移计划文档 P1 #5 状态同步（标注已实现首页标签显示）。
* 不破坏 drawer / 置顶隐藏 / 屏蔽词。

## Technical Approach

**数据源**：`topic-list-item` 行 `classList` 中匹配 `/^tag-(.+)$/` 的 token，suffix 为标签名；href = `/tag/${encodeURIComponent(name)}`，display = name。

**注入锚点**：行内类别徽章 `a.badge-wrapper[href^="/c/"]`（位于 `.link-bottom-line`）。插在其后；找不到徽章时回退到 `.link-bottom-line` 末尾；再找不到则跳过该行。

**幂等 / 防循环**：为注入容器/元素打标记（如 `data-bewly-topic-tag` / 容器 `data-bewly-topic-tags`）。每次运行先按当前 class 计算期望标签集，与该行已注入标签集比较；相等则 no-op，不同才更新（compare-before-mutate，参照现有 `hideElementDisplay` 的写法）。

**开关关闭**：移除带 `data-bewly-topic-tag` 标记的注入元素（参照 `restoreHiddenElements` 模式）。

**集成点**：
* `src/logic/storage.ts`：`Settings` 加 `showHomePageTopicTags: boolean`；`originalSettings` 默认 `true`。
* `src/sites/linuxDo.ts`：新增导出函数（如 `renderLinuxDoHomePageTopicTags(root, url, enabled)`），复用 `isLinuxDoHomePage` / `TOPIC_ITEM_SELECTOR`。
* `src/contentScripts/index.ts`：在 `cleanupLinuxDoHomePage()` 调用新函数；watch 列表加 `settings.value.showHomePageTopicTags`。
* `src/contentScripts/views/App.vue`：设置面板加一个 checkbox 绑定 `settings.showHomePageTopicTags`；`appMessages` 4 个 locale 各加一条 `showTopicTags` 文案。
* `src/tests/linuxDoMigration.spec.ts`：新增测试。

## Decision (ADR-lite)

**Context**：标签元素不在列表 DOM 里，但行 class 带 `tag-{name}`；Cloudflare 阻断浏览器外接口调用。
**Decision**：从行 class 提取标签名、注入原生 `discourse-tag` 链接到类别徽章后；首页限定；带默认开的设置开关。
**Consequences**：实现轻量、无网络依赖、样式自动跟随原生；缺点是显示文本用的是标签 slug（class 后缀），对个别英文连字符标签可能与展示名略有差异，MVP 可接受。后续如需精确展示名/更多页面范围，可扩展为页内 fetch `*.json`。

## Out of Scope

* 不实现分类导航面板、信任等级标记等其他 P1 项。
* 不实现任何发帖/回帖能力。
* 不改造单帖页 / 抽屉内页 / 分类页 / 热门页的标签显示（本期仅首页）。

## Technical Notes

* 关键文件：`src/sites/linuxDo.ts`、`src/contentScripts/index.ts`、`src/contentScripts/views/App.vue`、`src/logic/storage.ts`、`src/tests/linuxDoMigration.spec.ts`。
* Discourse 结构：类别 `a.badge-wrapper[href^="/c/"] .badge-category`；标签 `a.discourse-tag[href^="/tag/"]`，常在 `.discourse-tags` 内、`.link-bottom-line` 行。
* 行 class 实证：测试夹具 `topic-list-item category-feedback has-excerpt pinned tag-公告`。
* Cloudflare + Turnstile 阻断浏览器外接口；本方案不依赖联网。
