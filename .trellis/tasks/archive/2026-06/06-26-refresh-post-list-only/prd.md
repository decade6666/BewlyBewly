# brainstorm: 刷新按钮只更新帖子列表而非整页

## Goal

把 linux.do 注入页面右下角浮动「刷新」按钮的行为，从整页 `window.location.reload()` 改为「只刷新帖子列表（topic list）」，避免整页白屏/滚动位置丢失/抽屉等扩展状态被清空，提升体验。

## What I already know

* 目标按钮 = `src/contentScripts/views/App.vue` 中的 `.linux-do-scroll-action-button`（全局浮动按钮）。
* 当前逻辑 `handleScrollActionClick()`（App.vue ~L142）：
  * 页面在顶部（`isPageAtTop`，`scrollY <= 10`）→ 显示 `i-mingcute:refresh-2-line` 图标 → `window.location.reload()`。
  * 已滚动 → 显示 `i-mingcute:arrow-up-line` → `window.scrollTo({ top: 0, behavior: 'smooth' })`。
* 按钮 `v-if="!showSettingsPanel"`，在所有 linux.do 页面都显示（不限于列表页）。
* 内容脚本运行在 **ISOLATED world**（`src/manifest.ts` content_scripts 未声明 `world: 'MAIN'`），只能操作 DOM，无法直接访问页面 Ember/`require`/Discourse app 对象。
* linux.do = Discourse（Ember.js SPA）。topic list 由 Ember 渲染。
* 站点适配器 `src/sites/linuxDo.ts` 已有列表页判定：`isLinuxDoTopicListPage(url)`（`TOPIC_LIST_PATHS = ['', '/latest', '/top', '/hot']` + category 路径），以及 DOM 级操作（隐藏置顶、注入标签）。

## Assumptions (temporary)

* 「帖子列表」= Discourse 的 topic list（/latest /top /hot /c/...），不是单个 topic 内的回复楼层。
* 仅在 topic list 页需要「只刷新列表」；其他页面行为待定。

## Decisions (confirmed)

* **D1（非列表页行为）**：非 topic-list 页保持现有 `window.location.reload()` 整页重载；只在 topic-list 页改为「只刷新列表」。理由：行为可预测、最安全、改动面最小。
* **D2（实现方案）**：方案 A — DOM 点击 Discourse 原生入口（横幅优先，回退激活 pill，再回退整页重载）。**不**改 manifest、不加 `scripting` 权限、不引入 background 注入。理由：ISOLATED world 下零 CSP 风险、改动最小、复用 Discourse 自身路由刷新与状态同步。方案 B（MAIN world `router.refresh()`）仅在真机验证发现 A 不可靠时再升级。
* **D3（滚动行为）**：刷新成功后回到列表顶部，对齐「刷新」直觉。

## Decision (ADR-lite)

**Context**：linux.do = Discourse(Ember SPA)，扩展内容脚本在 ISOLATED world，无法直接调 Ember API；当前刷新按钮整页 `reload` 体验差（白屏、丢滚动/扩展状态）。
**Decision**：在 `linuxDo.ts` 新增 `refreshLinuxDoTopicListInPlace(doc)` 走 DOM 点击（横幅→激活 pill），`App.vue` 的 `handleScrollActionClick` 在列表页调用它、成功则回顶部、失败/非列表页回退 `window.location.reload()`。
**Consequences**：零新权限、改动面小、随 Discourse 升级有选择器漂移风险（已用多级回退 + 整页重载兜底缓解）；真机验证为必须项；未来可平滑升级到方案 B。

## Requirements

* 在 topic list 页（`isLinuxDoTopicListPage(location.href)` 为真）点击浮动刷新按钮时，只重新拉取并渲染帖子列表，URL 不变、不触发整页导航/重载。
* 实现方式 = **DOM 点击**（方案 A）：
  * 若顶部存在「N 条新帖/更新」横幅（`.show-more.has-topics a.alert.alert-info.clickable`）→ 优先点击它（即时插入新帖）。
  * 否则点击当前激活的导航 pill（`.nav-pills li.active > a[href]` 等回退选择器）→ 触发 Discourse Ember 路由 `model()` 重新拉取列表。
  * 二者都找不到（选择器漂移）→ 回退 `window.location.reload()`。
* 非 topic-list 页保持 `window.location.reload()`。
* 刷新成功后 `window.scrollTo({ top: 0 })` 回到列表顶部。
* 刷新后扩展自身注入状态（标签、隐藏置顶等）仍生效（依赖 `linuxDo.ts` 既有 MutationObserver 对新行重新应用）。

## Acceptance Criteria

* [ ] 在 /latest（及 /top /hot /c/...）点击刷新：URL 不变、无整页白屏重载、列表内容更新为最新、滚动回到顶部。
* [ ] 在非列表页（/t/...、用户主页、搜索页）点击刷新：仍为整页 `window.location.reload()`。
* [ ] 选择器都命中失败时安全回退整页重载（不出现「点了没反应」）。
* [ ] 扩展注入的 DOM 增强（标签、置顶隐藏）在刷新后仍生效。
* [ ] 新增/修改逻辑有单测；lint / typecheck / CI 通过。
* [ ] 真机浏览器在 linux.do 实际页面确认 pill / 横幅选择器与「同路由点击确实 refetch」（Research 未能实测，被 Cloudflare Turnstile 拦截）。

## Definition of Done (team quality bar)

* Tests added/updated（站点适配器纯函数 / 行为单测，遵循现有 `src/tests` 模式）。
* Lint / typecheck / CI green。
* 真机浏览器验证（linux.do 实际页面）刷新行为。
* 文档/spec 更新（若引入新模式，走 `/trellis:update-spec`）。

## Out of Scope (explicit)

* 单个 topic 内回复楼层的局部刷新。
* 列表自动轮询/实时更新（仅手动点击触发）。

## Technical Notes

* 关键文件：`src/contentScripts/views/App.vue`（按钮 + 处理函数）、`src/sites/linuxDo.ts`（站点能力）、`src/manifest.ts`（world/CSP）。
* 约束：ISOLATED world + Discourse CSP（`script-src`）可能限制 MAIN world 脚本注入。
* 待 research：Discourse 在 ISOLATED world 下「只刷新当前 list route」的可行入口（active nav pill 点击是否触发 refetch / MessageBus 新帖 pill / Ember router.refresh 注入）。

## Implementation Plan (small PRs)

* **PR1**：`src/sites/linuxDo.ts` 新增 `refreshLinuxDoTopicListInPlace(doc = document): boolean`（横幅优先 → 激活 pill 回退 → 返回是否触发成功）+ 纯函数单测（mock DOM：有横幅 / 有激活 pill / 都没有三种分支，遵循 `src/tests` 现有模式）。
* **PR2**：`src/contentScripts/views/App.vue` 改 `handleScrollActionClick`：`isPageAtTop` 时，若 `isLinuxDoTopicListPage(location.href)` 且 `refreshLinuxDoTopicListInPlace()` 成功 → `window.scrollTo({ top: 0 })`；否则 `window.location.reload()`。
* **PR3**：真机浏览器在 linux.do 验证（pill/横幅选择器、同路由 refetch、扩展注入存活），按需补充 no-op 升级逻辑；更新 spec（若沉淀新模式走 `/trellis:update-spec`）。

## Research References

* [`research/discourse-list-refresh.md`](research/discourse-list-refresh.md) — ISOLATED world 下推荐「点击激活 nav pill 触发 Ember 同路由 refetch」；`router.refresh()` 仅 MAIN world 可用，列为升级项；linux.do 实测被 Cloudflare Turnstile 拦截，选择器需真机确认。
