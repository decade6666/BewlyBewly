# Hide remaining drawer chrome on linux.do

## Goal

继续修复 BewlyLinuxDo 抽屉阅读视图：抽屉打开后，用户不应再看到 linux.do 自身残留的左上区域或右上区域；抽屉体验应尽可能只显示正文内容与扩展自己的抽屉控制按钮。

## Requirements

* 在抽屉 iframe 内隐藏整个 linux.do 站点 header（用户选择方案 1），包括左上 hamburger/logo、右上登录/头像/搜索/语言等所有站点顶部 chrome。
* 保持已经隐藏的 `.sidebar-wrapper` 行为，避免侧边栏本体出现。
* 处理实测暴露的相邻问题：宿主页面的 linux.do 顶栏不应通过抽屉背景透出，用户不应在抽屉体验里看到宿主页面左上/右上 chrome。
* 扩展自己的抽屉按钮（“在新标签页打开”“关闭 / Esc”）必须继续可见且可点击。
* 抽屉正文内容必须继续显示和滚动。
* 注入逻辑仍只作用于 iframe 文档，不影响宿主 linux.do 顶层页面。
* 不新增设置开关，不改变 iframe sandbox，不改变抽屉路由/历史机制。

## Acceptance Criteria

* [ ] 抽屉打开后，iframe 内 linux.do `.d-header` 不可见。
* [ ] 抽屉打开后，iframe 内 `.sidebar-wrapper` 不可见。
* [ ] 抽屉打开后，宿主页面左上/右上 linux.do chrome 不会透过抽屉背景显示。
* [ ] 扩展自己的“在新标签页打开 / 关闭 Esc”按钮仍在抽屉顶部可见。
* [ ] 抽屉正文内容仍可显示和滚动。
* [ ] `applyLinuxDoDrawerChrome` 对同一 `Document` 重复调用只产生一个 style 节点。
* [ ] `applyLinuxDoDrawerChrome(null/undefined)` 不抛错。
* [ ] 宿主页面（非抽屉）不受注入样式影响。

## Definition of Done

* Tests added/updated for hidden header, sidebar, idempotency, null safety, and drawer backdrop opacity/source regression.
* Targeted tests pass.
* Typecheck/lint/build run or explicitly reported if blocked.
* Browser verification confirms required left/top-right chrome is hidden.
* Docs/spec updated if behavior contract changes.

## Technical Approach

* Update `DRAWER_HIDDEN_CHROME_CSS` in `src/sites/linuxDo.ts` to hide `.d-header` as a whole, while keeping `.sidebar-wrapper` hidden.
* Keep existing narrower right-side selectors only if useful as defense-in-depth, but the primary contract becomes hiding the full iframe `.d-header`.
* Update `src/components/IframeDrawer.vue` styling so the drawer overlay/background is opaque enough to prevent the host page's linux.do header/sidebar from showing through around the drawer content.
* Keep extension-owned drawer header outside the iframe and above content.
* Update `src/tests/linuxDoMigration.spec.ts` source/behavior assertions accordingly.

## Decision (ADR-lite)

**Context**: The previous implementation hid `.sidebar-wrapper` and some right-side controls, but browser verification showed the linux.do header area remained visible: left hamburger/logo and right login/header controls could still be seen. The screenshot also showed host-page chrome visible through the drawer background.

**Decision**: Hide the entire linux.do `.d-header` inside the drawer iframe and make the drawer backdrop/content area prevent host-page chrome from visually leaking into the drawer experience.

**Consequences**: This is more aggressive than hiding individual header controls, but the extension already provides its own drawer controls, so iframe-side linux.do header controls are redundant in the reading view. Future changes that need iframe header controls must explicitly revisit this contract.

## Out of Scope

* Adding a user-facing setting to toggle this behavior.
* Changing the drawer iframe sandbox.
* Reworking in-iframe internal navigation or fixing unrelated Discourse category-link permission behavior.
* Hiding linux.do chrome on the host page when no drawer is open.

## Technical Notes

* Relevant code: `src/sites/linuxDo.ts`, `src/components/IframeDrawer.vue`, `src/tests/linuxDoMigration.spec.ts`
* Relevant spec: `./.trellis/spec/frontend/component-guidelines.md`
* Previous task context: `./.trellis/tasks/06-18-hide-drawer-sidebar-and-top-right-header-icons-on-linux-do/prd.md`
* Runtime observation: `.sidebar-wrapper` was hidden, but header left/right chrome remained visible; host page chrome also remained visible through the overlay/backdrop.
