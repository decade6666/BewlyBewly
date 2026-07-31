# 屏蔽首页社区准则横幅

## Goal

在扩展中重新加入「屏蔽 linux.do 首页社区准则横幅」能力，并在浮动设置面板提供独立开关。横幅内容为：`真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》`，位于搜索框下方、`最新/新/未读/热门` 导航 pills 上方。

## What I already know

* 该功能曾存在（设置键 `hideHomePageGuidelineBanner`），在 commit `881f28b3` 被整条删除；旧实现用大范围文本匹配 + 向上爬父节点，容易误伤（用户截图中 uBO 拾取到 `#main-container` 正是这种失控）。
* 旧键名仍在 `settingsMigration.ts` 的 `LEGACY_SETTINGS_KEYS` 中会被自动剔除，新功能必须使用新键名。
* 现有首页清理链路：`storage.ts` → `App.vue` 浮层面板 → `contentScripts/index.ts` → `sites/linuxDo.ts` 的 `hideLinuxDoHomePageElements`；隐藏/还原原语已支持多 kind 共存。
* Discourse core banner topic 真实 markup 为 `#banner` / `#banner-content`；`.welcome-banner` 是搜索 hero，不能作为命中目标。
* 无法访问线上 DOM（Cloudflare challenge），选择器必须分层兜底。

## Requirements

* 在浮动设置面板新增「屏蔽首页社区准则横幅」复选框，四语言文案齐全。
* 新增设置字段 `hideHomePageCommunityGuidelines`（布尔），**默认关闭**。
* 仅在首页（`/` 与 `/latest`）生效，与置顶话题 / 屏蔽词清理共用 URL 守卫。
* 开启时隐藏社区准则横幅；关闭时完整还原（含原 inline display 与 `data-bewly-*` 属性）。
* 识别策略：结构选择器优先（`#banner` / `#banner-content` / `.custom-banner` / 逃生口），文本兜底（口号 + 《社区准则》）。
* 护栏：绝不能隐藏 `body` / `#main-container` / `#main-outlet` / `#main-outlet-wrapper` / 含 `.nav-pills` 或 `.topic-list` 的祖先；`.welcome-banner` 必须受保护。
* 所有 DOM 写入必须幂等，避免触发无节流 MutationObserver 死循环。
* 新键名不得进入 `LEGACY_SETTINGS_KEYS`；旧键清理逻辑保持不变。
* 同步更新回归测试与 `.trellis/spec/frontend/state-management.md` 契约。

## Acceptance Criteria

* [ ] 浮动设置面板出现「屏蔽首页社区准则横幅」开关，默认未勾选。
* [ ] 开启后，首页 / `/latest` 的社区准则横幅被隐藏；搜索框、导航 pills、话题列表保持可见。
* [ ] 关闭后，横幅恢复到隐藏前的 display 状态。
* [ ] 非首页（分类页、话题页）即使开关开启也不隐藏。
* [ ] `#banner` 存在但不含准则文案时不隐藏（fail-safe）。
* [ ] 父容器同时含话题列表时，只隐藏内层安全元素，不隐藏父容器。
* [ ] 重复清理不产生 attribute/style 写入（幂等）。
* [ ] 旧键 `hideHomePageGuidelineBanner` 仍被迁移清理；新键不被清理。
* [ ] `pnpm exec vitest run src/tests/linuxDoMigration.spec.ts src/tests/settingsMigration.spec.ts`、`pnpm typecheck`、相关 eslint 通过。

## Out of Scope

* 不在分类页 / 话题页全站隐藏。
* 不默认开启。
* 不改动置顶话题、屏蔽词、WebDAV、抽屉路由。
* 不复用旧键名 `hideHomePageGuidelineBanner`。

## Definition of Done

* Source changes follow existing Vue/TypeScript style and immutability expectations.
* Relevant regression tests are updated and pass.
* `pnpm typecheck` and eslint on changed files pass.
* Spec contract in state-management.md matches runtime behavior.
