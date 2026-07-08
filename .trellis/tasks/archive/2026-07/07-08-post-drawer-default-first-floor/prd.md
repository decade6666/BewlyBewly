# 帖子抽屉默认打开到一楼

## Goal

当用户在 Linux.do 的帖子列表页点击帖子并通过扩展抽屉打开时，默认从主题第一页开始阅读，而不是跳到某个中间楼层或某条回复定位处。

## Confirmed Facts

- 当前扩展会在 Linux.do 帖子列表页拦截帖子链接点击，并改为在抽屉中打开主题页面：`src/contentScripts/views/App.vue:501`。
- 点击事件会通过 `findLinuxDoTopicLink()` 解析目标链接，然后把返回的完整主题 URL 直接传给 `openIframeDrawer()`：`src/contentScripts/views/App.vue:505`、`src/contentScripts/views/App.vue:512`。
- `normalizeLinuxDoTopicUrl()` 目前只校验并标准化 Linux.do 主题 URL，不会把带楼层的路径（如 `/t/topic/123/4`）改写成第一页，也会保留 query/hash：`src/sites/linuxDo.ts:544`。
- 现有测试已覆盖主题 URL 规范化与主题链接提取，且当前测试明确允许保留楼层与 hash：`src/tests/linuxDoMigration.spec.ts:179`。
- 当前帖子列表范围来自 Linux.do 列表页判断逻辑（首页、latest、top、hot、分类页相关链路），本次变更入口主要在 Linux.do 主题列表点击链路：`src/contentScripts/views/App.vue:502`、`src/sites/linuxDo.ts:544`。
- 抽屉内“在新标签页打开”按钮直接复用当前抽屉 URL，因此如果抽屉 URL 被统一成 `/1`，该按钮默认也会打开 `/1`：`src/components/IframeDrawer.vue:115`。

## Requirements

- 在 Linux.do 帖子列表页点击帖子进入抽屉时，始终规范为主题第一页 URL。
- 规范化时同时移除楼层路径、query 与 hash，避免抽屉再次跳到中间楼层或某条回复。
- 同一规范化后的第一页 URL 也用于抽屉内“在新标签页打开”按钮，保持行为一致。
- 规范化逻辑应收敛在 Linux.do 主题 URL 处理边界，不在 `App.vue` 中手工拼接 Linux.do 特定 URL。
- 列表页 `baseUrl` 不应被改写，避免影响抽屉关闭后的列表页恢复逻辑：`src/contentScripts/views/App.vue:515`。
- 现有抽屉打开、关闭、历史恢复等交互应继续正常工作。
- 需要补充或更新回归测试，覆盖“列表点击进入抽屉时默认第一页”的行为。

## Acceptance Criteria

- [ ] 在 Linux.do 帖子列表页点击一个主题链接时，无论原始链接是裸主题路径、带楼层路径，还是带 query/hash 的主题路径，抽屉最终打开的 URL 都被规范为 `https://linux.do/t/<slug>/<topic-id>/1`。
- [ ] 规范化后的抽屉 URL 不再保留原链接中的楼层路径、query 或 `#post-*` 锚点。
- [ ] 抽屉内“在新标签页打开”按钮也使用同一个规范化后的 `/1` URL。
- [ ] 非主题链接仍不会被识别为抽屉打开目标。
- [ ] 抽屉现有打开/关闭与历史恢复逻辑保持可用，且列表页 `baseUrl` 保持不变。
- [ ] 相关测试通过。

## Out of Scope

- 修改 Linux.do 站点本身的链接生成逻辑。
- 改动非 Linux.do 站点或非主题列表链路的抽屉行为。
- 新增设置开关或额外交互配置。
- 改变抽屉内后续站内导航的目标规范化策略（除当前这次“列表页点击进入抽屉”的入口外）。

## Research Notes

- Codex 与 Antigravity 都建议把 Linux.do 主题 URL 规范化逻辑保留在 `src/sites/linuxDo.ts` 这一层，而不是把 `/1` 拼接逻辑散落到 `App.vue` 中。
- Codex 提醒：如果产品希望“在新标签页打开”保留原始点击 URL，就必须额外保存原始链接；当前更简单一致的方案是让新标签页也继承规范化后的 `/1` URL。
- Antigravity 提出一个站点行为假设：仅去掉楼层后缀但不显式追加 `/1`，Discourse 可能仍会恢复到用户上次阅读楼层。该点目前是外部分析结论，尚未在本会话中做浏览器实测验证。

## Technical Notes

- 当前任务目录：`.trellis/tasks/07-08-post-drawer-default-first-floor/`。
- 已保存分析输出：
  - `.trellis/tasks/07-08-post-drawer-default-first-floor/research/codex-analysis.md`
  - `.trellis/tasks/07-08-post-drawer-default-first-floor/research/agy-analysis.md`
- 已补充 Phase 2 所需上下文清单：`implement.jsonl` / `check.jsonl` 已加入相关 spec 与 research 文件。
- 潜在修改点：`src/sites/linuxDo.ts` 中的主题 URL 规范化逻辑，以及 `src/tests/linuxDoMigration.spec.ts` 中对应回归测试。
- 这是一个轻量任务；PRD-only 足够，不必额外创建 `design.md` / `implement.md`。
