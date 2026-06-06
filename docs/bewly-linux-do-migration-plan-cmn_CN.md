# BewlyLinuxDo 迁移计划

> 本文档记录从上游 BewlyBewly（Bilibili 版）到 BewlyLinuxDo（Linux.do 版）的移植策略、当前状态与推荐路线，供后续实施任务参考。

---

## 1. 证据范围与置信度

| 证据来源 | 置信度 | 说明 |
|----------|--------|------|
| `package.json` | 已验证 | name/displayName 为 BewlyLinuxDo，description 为 `Add a focused drawer browsing experience to Linux.do.`；homepage 为 `https://github.com/decade6666/BewlyLinuxDo` |
| `src/manifest.ts` | 已验证 | permissions/host_permissions/content_scripts/web_accessible_resources 全部限定 `https://linux.do/*` |
| 源码静态分析 | 已验证 | 所有引用的文件路径与行内容均在当前仓库内直接读取确认 |
| `https://linux.do/site.json` | 已验证 | 公开 API，包含 trust_levels、post_types、18 个分类等结构 |
| `https://linux.do/latest.json` | 失败 | Cloudflare/Turnstile 阻断，未获取到有效数据 |
| `https://linux.do/top.json` | 失败 | 同上，不作为已验证能力 |

**外部引用 URL**：

- 上游 BewlyBewly：`https://github.com/hakadao/BewlyBewly`
- Linux.do 首页：`https://linux.do/`
- 已验证公开元数据：`https://linux.do/site.json`
- 已尝试但失败的数据端点：`https://linux.do/latest.json`、`https://linux.do/top.json`

**重要约束**：`latest.json` / `top.json` 等数据 API 在无浏览器会话的情况下被 Cloudflare 拦截。在正式实施数据驱动功能前，必须在真实浏览器环境中验证这些端点的可用性与返回格式。

---

## 2. 上游 BewlyBewly 架构总结

### 技术栈

- **框架**：Vue 3 (Composition API + `<script setup>`)
- **构建**：Vite + tsup（background script）
- **状态管理**：Pinia
- **样式**：UnoCSS + SCSS，支持毛玻璃/阴影/主题色/壁纸系统
- **国际化**：vue-i18n（已有多语言：en、cmn_CN、cmn_TW、jyut）
- **浏览器 API**：webextension-polyfill
- **存储**：`useStorageLocal` composable（封装 `browser.storage.local`）

### 核心 UI 模块

| 模块 | 文件位置 | 功能 |
|------|----------|------|
| Dock | `src/components/Dock/` | 侧边快捷导航栏，可配置项目、位置、自动隐藏 |
| TopBar | `src/components/TopBar/` | 顶部导航栏，含通知/动态/收藏/历史弹窗 |
| Settings | `src/components/Settings/` | 完整设置面板，涵盖主题/布局/过滤/搜索页等 |
| Card 组件 | `src/components/*Card.vue` | 视频卡片、番剧卡片等，支持预览/弹幕/进度 |
| 系统 | `src/composables/useStorageLocal.ts` | 持久化存储 composable |

### 核心页面（Bilibili 专用）

| 页面 | 路径模式 | 备注 |
|------|----------|------|
| 首页推荐 | `bilibili.com` | ForYou/Following/Trending/Ranking/Live 等 Tab |
| 视频页 | `bilibili.com/video/*` | 弹幕、评论、相关推荐 |
| 番剧页 | `bilibili.com/bangumi/*` | 番剧播放、电影 |
| 用户空间 | `space.bilibili.com/*` | 用户主页、收藏列表 |
| 搜索页 | `search.bilibili.com/*` | 品牌化搜索 UI |
| 消息页 | `message.bilibili.com/*` | 通知中心 |
| 动态页 | `t.bilibili.com` | 关注动态流 |

---

## 3. 当前 BewlyLinuxDo 项目状态

### 已完成的 Linux.do 适配

| 功能 | 文件 | 实现方式 |
|------|------|----------|
| URL 识别（首页/话题列表/话题/分类） | `src/sites/linuxDo.ts` | 正则匹配 `isLinuxDoHomePage`、`isLinuxDoTopicListPage`、`normalizeLinuxDoTopicUrl` |
| 首页 guideline banner 隐藏 | `src/sites/linuxDo.ts` | DOM 查询 + `display: none !important`，保留恢复能力 |
| 首页置顶话题隐藏 | `src/sites/linuxDo.ts` | 多选择器策略（class/attr/aria/text），支持中英文置顶标记 |
| MutationObserver 清理 | `src/contentScripts/index.ts` | 监听 `document.body` 变更，自动重执行隐藏逻辑 |
| Shadow DOM 注入 | `src/contentScripts/index.ts` | 创建 `#bewly` 容器，attachShadow 注入 App |
| 话题点击拦截 | `src/contentScripts/views/App.vue` | capture 阶段 `click` 事件，`preventDefault` 后打开 drawer |
| 抽屉地址栏同步 | `src/contentScripts/views/App.vue` | 抽屉打开时 `pushState` 到帖子 URL，关闭或后退时恢复列表 URL |
| iframe Drawer | `src/components/IframeDrawer.vue` | 支持新标签打开、Esc/关闭按钮关闭；复制链接按钮已移除 |
| 悬浮设置入口 | `src/contentScripts/views/App.vue` | 右下角悬浮按钮可切换首页 guideline banner 与置顶话题隐藏 |
| 设置项 | `src/logic/storage.ts` | `hideHomePageGuidelineBanner`、`hideHomePagePinnedTopics` 已接入 |

### 仍存在的 Bilibili 遗留

| 文件 | 遗留内容 | 影响程度 |
|------|----------|----------|
| `src/stores/mainStore.ts` | Dock 项目 URL 全部指向 `bilibili.com`（Home/Search/Anime/Favorites/History/WatchLater/Moments） | 高 |
| `src/stores/topBarStore.ts` | TopBar 项目 URL 全部指向 `bilibili.com`（Notifications/Moments/Favorites/History/Creative Center） | 高 |
| `src/utils/main.ts` | `setCookie` 硬编码 `domain=.bilibili.com`；`getUserID` 读取 `DedeUserID`；`getCSRF` 读取 `bili_jct`；`isHomePage`/`isVideoOrBangumiPage`/`isNotificationPage` 全部匹配 `bilibili.com` | 高 |
| `src/styles/adaptedStyles/index.ts` | 全部页面样式路由匹配 `bilibili.com` URL 模式（视频/番剧/动态/历史/搜索/用户空间等 15+ 分支） | 高 |
| `src/logic/storage.ts` | Settings 接口含大量 Bilibili 专用字段：`blockAds`/`blockTopSearchPageAds`、`enableVideoPreview`、`enableVideoCtrlBarOnVideoCard`、`filterOutVerticalVideos`、`enableFilterByViewCount`/`filterByViewCount`、`enableFilterByDuration`/`filterByDuration`、`followingTabShowLivestreamingVideos`、`overrideDanmakuFont`、`recommendationMode` | 中 |
| `src/logic/storage.ts` | `accessKey` 字段（Bilibili API 认证） | 低 |
| `src/enums/appEnums.ts` | `AppPage` 枚举包含 Bilibili 页面类型 | 中 |
| i18n 翻译文件 | 大量 Bilibili 上下文的翻译 key（dock.video/anime/favorites 等） | 中 |

---

## 4. Linux.do 平台架构特征

### 已验证信息（来源：`site.json` 公开 API + 页面观察）

**基础架构**：Discourse 风格社区平台

**URL 模式**：
- 首页：`/`
- 话题列表：`/latest`、`/top`、`/hot`、`/c/{slug}/{id}`
- 单个话题：`/t/{slug}/{id}` 或 `/t/{slug}/{id}/{post_number}`
- 用户：`/u/{username}`
- 分类：`/c/{slug}/{id}`
- 标签：`/tag/{tagname}`
- 搜索：`/search`
- 登录：`/login`
- 语言：`/language`

**站点公开数据（`site.json`）**：
- 18 个分类（含技术/社区/闲聊等）
- trust_levels（0-4 信任等级系统）
- post_types（regular/moderator_action/small_action/whisper）
- notification_types（包含 reaction/chat/boost/suggested_edit/following/circles 等多种类型）
- filters（latest/unread/new/unseen/top/read/posted/bookmarks/hot/votes）
- periods（all/yearly/quarterly/monthly/weekly/daily）

**话题列表列**：Topic / Posters / Replies / Views / Activity

**技术特征**：
- Cloudflare CDN + Turnstile 人机验证
- 页面导航栏含：Topics / Upcoming events / More / Categories / Tags / Search / Login / Language

### 未验证但需注意

- `latest.json` / `top.json` 等数据 API 被 Cloudflare 拦截，浏览器外不可直接调用
- Discourse 标准 API（`/posts.json`、`/categories.json` 等）可能需要登录态或 CSRF token
- 站点公开声明禁止 AI 生成内容用于发帖/回帖；**不应实现任何 AI 辅助发帖/回帖功能**，这是明确的风险边界

---

## 5. 可移植能力清单（按优先级排序）

### P0 - 核心基础（必须先完成）

| # | 能力 | 来源 | 说明 |
|---|------|------|------|
| 1 | **清理 Bilibili URL 引用** | `mainStore.ts`、`topBarStore.ts`、`utils/main.ts`、`adaptedStyles/index.ts` | 将所有 `bilibili.com` URL 替换为 `linux.do` 对应路径；`isHomePage` 等函数改为匹配 linux.do |
| 2 | **重写 Dock 项目** | `mainStore.ts` | 从 Bilibili 7 项（Home/Search/Anime/Favorites/History/WatchLater/Moments）改为 Linux.do 功能项（首页/最新/热门/分类/标签/搜索/通知） |
| 3 | **重写 TopBar 项目** | `topBarStore.ts` | 从 Bilibili 5 项改为 Linux.do 导航项（搜索/通知/用户菜单） |
| 4 | **Cookie/CSRF 适配** | `utils/main.ts` | `setCookie` domain 改为 `.linux.do`；`getUserID`/`getCSRF` 改为 Linux.do/Discourse 登录态读取策略（候选 cookie/meta 如 `_t`、`_forum_session` 必须经浏览器验证后再落地） |

### P1 - 用户体验提升

| # | 能力 | 来源 | 说明 |
|---|------|------|------|
| 5 | **Discourse 话题列表增强** | 新建 `src/sites/linuxDo/topics.ts` | 话题列表样式适配、信息密度调整、分类/标签高亮 |
| 6 | **分类导航面板** | Dock 或 Sidebar | 利用 `site.json` 的 18 个分类构建快速导航 |
| 7 | **设置面板裁剪** | `Settings/` | 移除 Bilibili 专用设置（广告屏蔽、弹幕、视频预览等），添加 Linux.do 专用设置（帖子过滤、信任等级显示等） |
| 8 | **过滤系统移植** | `storage.ts` 过滤相关字段 | 将"按标题/用户过滤视频"改为"按标题/用户/分类过滤帖子" |

### P2 - 上游能力移植

| # | 能力 | 来源 | 说明 |
|---|------|------|------|
| 9 | **主题/壁纸系统** | 上游主题色+壁纸+毛玻璃 | 当前 App.vue 仅硬编码 light 主题 CSS 变量，需移植上游动态主题能力 |
| 10 | **搜索页面模式** | 上游 `SearchPageMode` | 暂不适用（Linux.do 搜索页面结构不同），需先验证 Discourse 搜索 API |
| 11 | **通知系统增强** | 上游 TopBar 通知弹窗 | Discourse 通知 API 需浏览器登录态验证 |

### P3 - 探索性能力

| # | 能力 | 来源 | 说明 |
|---|------|------|------|
| 12 | **帖子预览** | 上游视频卡片预览 | 用 Discourse 摘要 API 替代视频预览，需验证 API 可用性 |
| 13 | **用户空间页面** | 上游用户空间适配 | Discourse 用户页面 (`/u/{username}`) 样式增强 |
| 14 | **数据面板/Dashboard** | 新建 | 利用 `site.json` 统计信息（用户数/帖子数/话题数）构建概览面板 |

---

## 6. 推荐迁移路线

### Phase 1：清理与基础（预计 2-3 个任务）

**目标**：移除所有 Bilibili 硬编码，建立 Linux.do 基础能力。

1. 清理 `src/utils/main.ts` 中的 Bilibili URL 匹配与 cookie 逻辑
2. 重写 `src/stores/mainStore.ts` Dock 项目为 Linux.do 导航
3. 重写 `src/stores/topBarStore.ts` TopBar 项目
4. 清理 `src/styles/adaptedStyles/index.ts` 中的 Bilibili 页面样式路由
5. 裁剪 `src/logic/storage.ts` 中的 Bilibili 专用设置字段

**验证**：扩展在 linux.do 上加载后，Dock/TopBar 指向正确路径，无 Bilibili URL 残留。

### Phase 2：体验增强（预计 3-4 个任务）

**目标**：发挥 Discourse 平台优势，提供差异化体验。

1. 构建分类快速导航（基于 `site.json`）
2. 话题列表 UI 增强（信息密度、标签展示、信任等级标记）
3. 过滤系统移植（帖子标题/用户/分类过滤）
4. 设置面板裁剪与 Linux.do 专用设置添加

**验证**：分类导航可用，过滤功能在话题列表上生效，设置面板无废弃选项。

### Phase 3：上游能力适配（预计 2-3 个任务）

**目标**：选择性移植上游 BewlyBewly 的高价值能力。

1. 主题色/壁纸/毛玻璃系统移植（需先验证 CSS 变量在 Discourse 页面上的兼容性）
2. 通知系统增强（需验证 Discourse notification API）
3. 帖子预览能力（需验证 Discourse 摘要 API）

**验证**：主题切换正常，通知弹窗可显示新通知。

---

## 7. 明确不建议移植项

| 不建议项 | 原因 |
|----------|------|
| Bilibili 视频播放器相关（弹幕、进度条、视频预览、视频卡片） | Linux.do 是论坛平台，无视频播放功能 |
| Bilibili 番剧/动漫/国创页面适配 | 与 Linux.do 完全无关 |
| Bilibili 搜索页面品牌化 UI | 搜索结果结构完全不同 |
| Bilibili 广告屏蔽功能 | Linux.do 无同类广告系统 |
| Bilibili 动态/专栏/笔记/创作中心页面 | 无对应平台功能 |
| Bilibili API 认证（`accessKey`、`bili_jct`、`DedeUserID`） | 需替换为 Discourse 认证机制 |
| Bilibili 收藏夹/稍候再看功能 | 无直接对应 |
| Bilibili 推荐模式（web/app） | 无对应概念 |
| AI 辅助发帖/回帖 | Linux.do 公开禁止 AI 生成内容，属于明确风险边界，不应实现 |

---

## 8. 风险与约束

| 风险 | 说明 | 缓解措施 |
|------|------|----------|
| Cloudflare/Turnstile 拦截 | `latest.json`/`top.json` 等 API 被阻断 | 在浏览器内验证 API；使用 Discourse 标准 session-based 请求 |
| Discourse API 可用性未知 | 许多 API 可能需要 CSRF token 或登录态 | 先在浏览器中通过 DevTools 确认 API 行为 |
| 主题系统兼容性 | 上游主题色/Wallpaper 依赖 Bilibili DOM 结构 | 逐步移植，先做 CSS 变量层，再做 DOM 操作层 |
| 设置迁移 | 清理 Bilibili 设置后，已有用户的 storage 可能包含废弃字段 | 利用 `mergeDefaults: true` 机制，新字段自动填充默认值，旧字段自然失效 |
| iframe 沙盒限制 | `IframeDrawer.vue` 的 `sandbox` 属性可能限制 Discourse 页面功能 | 如需完整页面交互，可能需要改为 background tab 方案 |
| AI 内容政策 | Linux.do 公开声明禁止 AI 生成内容 | 扩展仅做 UI 增强，不涉及内容生成 |

---

## 9. 下一步建议

1. **立即可做**：Phase 1 清理工作（P0 #1-#4），风险低、价值高
2. **需要验证**：在浏览器中手动测试 Discourse API 端点（`/latest.json`、`/top.json`、`/categories.json`、`/notifications.json` 等），记录响应格式与认证要求
3. **需要决策**：是否保留上游完整的 Dock/TopBar/Settings 架构，还是为 Linux.do 重新设计更轻量的 UI 方案
4. **长期规划**：主题系统移植需要较多上游代码适配，建议在基础清理完成后再启动

---

*最后更新：2026-06-06*
