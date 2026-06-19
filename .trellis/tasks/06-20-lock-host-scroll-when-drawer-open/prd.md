# Lock host page scroll when the iframe drawer is open

## Goal

抽屉打开后，宿主 linux.do 页面的原生（外部）滚动条不应再与抽屉 iframe 自身的右侧滚动条同时出现在视口右侧，避免用户误触抽屉外部的滚动条。

## Context

`.linux-do-drawer-root`（`position: fixed; inset: 0; z-index: 2147483647`）在视觉上铺满视口，但宿主页面的原生滚动条由浏览器渲染在所有 DOM 之上，不受 z-index 影响。它与 iframe 自身的右侧滚动条重叠在视口最右侧，导致用户拖拽到的是宿主页面滚动条（误触）。目前 `App.vue` / `IframeDrawer.vue` 没有任何宿主页面滚动锁定。

## Requirements

* 抽屉打开时，锁定宿主页面（`document.documentElement`）滚动，使外部原生滚动条消失，只保留 iframe 自身右侧滚动条。
* 抽屉关闭时，精确还原宿主页面之前的 `overflow` / `padding-right` 行内样式（不能把站点原有的内联样式擦掉）。
* 移除滚动条会让视口变宽并引起宿主正文回流跳动；锁定时用 `padding-right = 滚动条宽度` 补偿，避免可见跳动。
* 锁定/解锁必须幂等：重复锁定不丢失原始值；未锁定状态下解锁不抛错、不误改。
* 仅在抽屉打开期间作用于宿主顶层文档；不改动 iframe 文档、iframe sandbox、抽屉路由/历史机制，也不新增设置开关。
* 锁定逻辑实现为 `src/sites/linuxDo.ts` 内的纯函数（可注入 `Document`、null 安全、可单测），与 `applyLinuxDoDrawerChrome` 风格一致；由 `App.vue` 监听 `showIframeDrawer` 驱动。

## Acceptance Criteria

* [ ] `setLinuxDoDrawerHostScrollLock(true, doc)` 将 `doc.documentElement.style.overflow` 设为 `'hidden'`。
* [ ] `setLinuxDoDrawerHostScrollLock(false, doc)` 还原为锁定前的 `overflow` 行内值（含锁定前为 `'scroll'`、`''` 等场景）。
* [ ] 在已有内联 `padding-right` 的情况下，解锁后该值被还原而非清空。
* [ ] 重复调用 `setLinuxDoDrawerHostScrollLock(true, doc)` 不会用 `'hidden'` 覆盖掉保存的原始值（幂等）。
* [ ] `setLinuxDoDrawerHostScrollLock(true/false, null)` 与 `undefined` 不抛错。
* [ ] `App.vue` 通过 `watch(showIframeDrawer, ...)` 调用该函数；并在 `onBeforeUnmount` 中做一次解锁兜底。
* [ ] 宿主页面（无抽屉打开时）不受该逻辑影响。

## Definition of Done

* Tests added in `src/tests/linuxDoMigration.spec.ts` for lock/restore/idempotency/null-safety + App.vue 源码接线断言。
* Targeted tests pass；typecheck / lint / build 运行或明确说明被阻塞。
* 浏览器验证：抽屉打开后宿主外部滚动条消失，仅剩 iframe 滚动条，正文无明显回流跳动；关闭后宿主滚动条恢复。

## Technical Approach

* 在 `src/sites/linuxDo.ts` 新增纯函数 `setLinuxDoDrawerHostScrollLock(locked: boolean, doc?: Document | null)`：
  - 取 `doc ?? document` 与其 `documentElement`，均为空时直接 return（null 安全）。
  - 锁定：若尚未锁定，先把当前 `overflow` / `paddingRight` 行内值存入 `documentElement.dataset`（如 `bewlyDrawerScrollLock`，JSON 序列化），再设 `overflow = 'hidden'`；用 `defaultView.innerWidth - documentElement.clientWidth` 计算滚动条宽度，>0 时设 `paddingRight`。
  - 解锁：若存在保存标记则还原两个行内值并删除标记，否则直接 return；解析失败时回退到清空。
* `App.vue`：在已有 `~/sites/linuxDo` import 中加入该函数；`watch(showIframeDrawer, open => setLinuxDoDrawerHostScrollLock(open))`；在现有 `onBeforeUnmount` 内追加 `setLinuxDoDrawerHostScrollLock(false)` 兜底。
* 测试用 `document.implementation.createHTMLDocument(...)` 走 jsdom 行为断言（overflow 切换 / 还原 / 幂等 / null 安全）+ App.vue 源码断言（含 `setLinuxDoDrawerHostScrollLock` 与 `watch(showIframeDrawer`）。

## Out of Scope

* 隐藏 iframe 内或宿主页面的 linux.do header/sidebar chrome（见 `06-19-hide-remaining-drawer-chrome-on-linux-do`）。
* 改动 iframe sandbox、抽屉路由/历史、或新增用户设置开关。
* iframe 内部 Discourse 自身滚动行为的改造。

## Technical Notes

* Relevant code: `src/sites/linuxDo.ts`, `src/contentScripts/views/App.vue`, `src/tests/linuxDoMigration.spec.ts`
* 现有可借鉴模式：`applyLinuxDoDrawerChrome`（纯函数、Document 注入、幂等、null 安全）。
