# Hide drawer sidebar and top-right header icons on linux.do

## Goal

在 BewlyLinuxDo 抽屉（`IframeDrawer.vue` 内的 linux.do iframe）打开时，隐藏 linux.do（Discourse）自身的左侧目录栏，以及右上角的「语言切换、搜索、头像」三个图标，让抽屉成为更纯净的阅读视图。

## Background / Constraints

* 抽屉 iframe 的 `src` 始终是同源 linux.do URL，sandbox 含 `allow-same-origin`，父内容脚本已在 `handleIframeLoad` 中访问 `contentWindow`（绑定 keydown）。
* manifest `content_scripts` 未设 `all_frames`（默认 false），内容脚本**不会**在抽屉 iframe 子框架内运行；`isSupportedPage()=!isInIframe()` 也会让 iframe 内早退。因此隐藏必须由**父页面**在 iframe 同源加载后向其文档注入样式完成，而不是依赖 iframe 内脚本。
* 经与用户确认：**始终隐藏**（不做设置开关）；选择器用**通用 Discourse**选择器，「语言切换」按钮因 Cloudflare 拦截无法实地确认，采用 header 作用域内的关键字宽松匹配，由用户在浏览器复验。

## Requirements

* 抽屉 iframe 加载完成后，向其同源文档注入一段带固定 id 的 `<style>`，隐藏：
  * 左侧目录栏：`.sidebar-wrapper`。
  * 右上角搜索：`.d-header` / `.d-header-icons` 内的 `.search-dropdown` / `#search-button`。
  * 右上角头像（当前用户）：`.d-header` / `.d-header-icons` 内的 `.current-user` / `#current-user` / `.header-dropdown-toggle.current-user`。
  * 右上角语言切换：`.d-header` 作用域内 class/title/aria-label 含 `language` / `translate` / `locale` / `语言` 的元素（大小写不敏感）。
* 注入逻辑作为 `src/sites/linuxDo.ts` 的纯函数（接收 `Document`），便于 jsdom 单测；`IframeDrawer.vue` 仅调用。
* 幂等：同一文档重复调用只保留一个 `<style>`，不重复注入。
* 跨源安全：`contentDocument` 为 null（理论上的跨源）时静默跳过，不抛错。
* 仅作用于 iframe 文档内部，不影响宿主 linux.do 页面或扩展 Shadow DOM。

## Acceptance Criteria

* [ ] 抽屉打开后，iframe 内 linux.do 左侧目录栏、右上角搜索/头像图标不可见。
* [ ] 抽屉内右上角语言切换按钮（命中关键字匹配时）不可见。
* [ ] 注入函数对同一 `Document` 调用两次只产生一个 `<style id=...>`。
* [ ] `contentDocument` 不可访问时调用方不抛错、不影响关闭/打开。
* [ ] 抽屉的「在新标签页打开 / 关闭」按钮、Esc、iframe 资源释放等既有行为不受影响。
* [ ] 宿主 linux.do 顶层页面（非抽屉）目录栏与三图标不受影响。
* [ ] 单元测试覆盖：注入存在、关键选择器存在、幂等、空文档安全。

## Definition of Done

* `src/sites/linuxDo.ts` 新增并导出注入函数；`IframeDrawer.vue` 在 `handleIframeLoad` 调用。
* 新增 jsdom 单测（沿用 `linuxDoMigration.spec.ts` 模式）+ 源码回归断言（`IframeDrawer.vue` 导入并调用注入函数）。
* `.trellis/spec/frontend/component-guidelines.md` 抽屉契约补充该注入约定。
* lint / typecheck / 相关测试通过。
* 因 Cloudflare 拦截，linux.do 真实 DOM 选择器无法实地核验；交付时标注需用户浏览器复验。

## Technical Approach

**注入点**：`IframeDrawer.vue#handleIframeLoad` 中取 `iframeRef.value?.contentDocument`，非空则调用 `applyLinuxDoDrawerChrome(doc)`。`<style>` 注入 `doc.head`，在 Discourse SPA 客户端路由切换后仍持续生效（声明式 CSS）。

**注入函数**（`src/sites/linuxDo.ts`）：
```
const DRAWER_HIDDEN_CHROME_STYLE_ID = 'bewly-drawer-hidden-chrome'
const DRAWER_HIDDEN_CHROME_CSS = `.sidebar-wrapper{display:none!important} <header 三图标选择器>{display:none!important}`
export function applyLinuxDoDrawerChrome(doc: Document): void {
  if (doc.getElementById(DRAWER_HIDDEN_CHROME_STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = DRAWER_HIDDEN_CHROME_STYLE_ID
  style.textContent = DRAWER_HIDDEN_CHROME_CSS
  ;(doc.head ?? doc.documentElement).appendChild(style)
}
```

**作用域**：语言/翻译关键字匹配限定在 `.d-header` 之内，避免命中帖子正文里的翻译按钮；其余精确选择器为标准 Discourse 类/ID。
