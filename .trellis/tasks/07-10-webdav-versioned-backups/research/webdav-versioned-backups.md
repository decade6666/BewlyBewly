# Research: webdav-versioned-backups

- **Query**: 综合当前 WebDAV 代码、测试、已归档的 WebDAV Trellis 任务，以及 RFC 4918 官方规范，形成可供 `design.md` 使用的证据报告，覆盖当前调用链、目录 `PROPFIND Depth: 1` / 单文件 `DELETE` / 集合创建 / URL 与 XML 互操作约束、MV3 后台约束、已确认产品决策、最小协议/类型/错误契约、旧路径迁移、20 份轮转算法、测试矩阵、官方来源与技术风险。
- **Scope**: mixed
- **Date**: 2026-07-10

## Findings

### Files Found

| File Path | Description |
|---|---|
| `src/contentScripts/views/App.vue` | 当前 Linux.do 设置面板入口、WebDAV 对话框打开/关闭、Escape 路由、焦点恢复。 |
| `src/contentScripts/views/WebdavSettingsDialog.vue` | 当前手动 WebDAV UI；测试/上传/下载；内联确认；当前仍按单一 `webdavPath` 恢复。 |
| `src/logic/settingsSync.ts` | 版本 1 备份信封、上传/下载逻辑、保留本机 WebDAV 配置。 |
| `src/logic/webdav.ts` | 当前 WebDAV 协议实现：背景消息包装、`PROPFIND`、`MKCOL`、`PUT`、`GET`。无目录列举解析、无 `DELETE`。 |
| `src/background/messageListeners/webdav.ts` | 后台消息分发到真实 WebDAV `fetch`。 |
| `src/background/index.ts` | 注册 WebDAV 消息监听器。 |
| `src/manifest.ts` | Chromium 使用 MV3 `service_worker`，并声明 `<all_urls>` 主机权限。 |
| `src/logic/storage.ts` | 当前默认同步路径 `/bewly/settings.json`；持久化字段定义。 |
| `src/logic/settingsMigration.ts` | 当前仅清理 `webdavAutoSync` / `webdavLocalModifiedTime`；没有旧单文件路径迁移。 |
| `src/logic/webdavSettings.ts` | 当前默认路径常量仍是文件路径；仅有 URL/草稿辅助函数。 |
| `src/tests/webdavSettings.spec.ts` | 纯函数测试：HTTP(S) URL、路径默认值、草稿脏状态、不可变合并。 |
| `src/tests/settingsSync.spec.ts` | 版本 1 远端 JSON 解析与“保留本地 WebDAV 配置”测试。 |
| `src/tests/linuxDoMigration.spec.ts` | 源码契约测试：背景转发、对话框无障碍、`<all_urls>`、版本 1 信封。 |
| `.trellis/tasks/07-10-webdav-versioned-backups/prd.md` | 本任务已确认需求与产品决策。 |
| `.trellis/tasks/archive/2026-07/07-10-webdav-manual-dialog/design.md` | 现有手动 WebDAV 对话框的已落地设计边界。 |
| `.trellis/tasks/archive/2026-07/07-10-webdav-settings-dialog/research/webdav-sync.md` | 已归档的 WebDAV 传输与自动同步历史研究。 |
| `.trellis/spec/frontend/modal-accessibility.md` | Shadow DOM 模态框的焦点、Escape、`inert` 合同。 |

### Code Patterns

#### 1. 当前调用链和确切 file:line

##### 1.1 打开/关闭 WebDAV 对话框

- 打开：`src/contentScripts/views/App.vue:385-387`
- 关闭并恢复焦点：`src/contentScripts/views/App.vue:389-392`
- 入口按钮：`src/contentScripts/views/App.vue:679-686`
- 对话框常驻挂载：`src/contentScripts/views/App.vue:784-788`
- Escape 捕获路由：`src/contentScripts/views/App.vue:552-566`

##### 1.2 连接测试调用链

1. 对话框发起测试：`src/contentScripts/views/WebdavSettingsDialog.vue:242-279`
2. 内容脚本发消息到后台：`src/logic/webdav.ts:40-55`
3. 后台消息分发：`src/background/messageListeners/webdav.ts:28-35`
4. 后台执行真实 WebDAV `PROPFIND Depth: 0`：`src/logic/webdav.ts:92-109`

当前代码证据：

```ts
// src/logic/webdav.ts:53-55
export function webdavTestViaBackground(config: WebDavConfig): Promise<WebDavResult> {
  return requestWebdavViaBackground({ contentScriptQuery: WEBDAV_MESSAGE.TEST, config })
}
```

##### 1.3 上传调用链

1. 对话框发起上传：`src/contentScripts/views/WebdavSettingsDialog.vue:282-300`
2. 组装版本 1 备份信封并更新时间：`src/logic/settingsSync.ts:87-100`
3. 内容脚本发消息到后台：`src/logic/webdav.ts:40-60`
4. 后台消息分发：`src/background/messageListeners/webdav.ts:32-37`
5. 后台确保父目录存在并执行 `PUT`：`src/logic/webdav.ts:111-171`

当前只支持固定单路径上传，没有版本文件名、目录列举、轮转删除，也没有上传结果中的“新建文件路径 / 清理摘要”。

##### 1.4 下载调用链

1. 对话框显示内联确认并最终确认：`src/contentScripts/views/WebdavSettingsDialog.vue:303-338,498-551`
2. 零参数下载固定路径：`src/logic/settingsSync.ts:102-159`
3. 内容脚本发消息到后台：`src/logic/webdav.ts:40-65`
4. 后台消息分发：`src/background/messageListeners/webdav.ts:37-39`
5. 后台执行 `GET`：`src/logic/webdav.ts:174-191`

当前 `downloadSettings()` 没有“按选中备份路径下载”的参数入口；它总是读取当前配置中的 `webdavPath`（`src/logic/settingsSync.ts:102-104`）。

##### 1.5 后台注册和 MV3 执行位置

- 后台监听注册：`src/background/index.ts:3-13`
- Chromium MV3 service worker：`src/manifest.ts:40-42`
- 任意 WebDAV 端点权限：`src/manifest.ts:53-58`

当前代码证据：

```text
// src/manifest.ts:40-42,53-58
background: (isFirefox || isSafari)
  ? { scripts: ['./dist/background/index.js'], persistent: isFirefox ? undefined : false }
  : { service_worker: './dist/background/index.js' },

host_permissions: [
  'https://linux.do/*',
  '<all_urls>',
],
```

##### 1.6 当前持久化与迁移边界

- 当前默认路径仍是文件：`src/logic/webdavSettings.ts:3`、`src/logic/storage.ts:237-243`
- 当前只清理自动同步遗留键：`src/logic/settingsMigration.ts:1-45`
- 当前没有“旧单文件路径 → 目录路径”迁移，也没有“保留旧远端文件识别信息”的字段。

#### 2. 当前数据与测试边界

##### 2.1 远端内容格式仍是版本 1 JSON 信封

`src/logic/settingsSync.ts:7-12`：

```ts
interface SyncEnvelope {
  version: 1
  timestamp: number
  settings: Partial<Settings>
  blockedWords: BlockedWordsState
}
```

- 上传时剥离本地 WebDAV 配置：`src/logic/settingsSync.ts:19-37,66-70,87-96`
- 下载时保留本机 WebDAV 配置：`src/logic/settingsSync.ts:141-159`
- 测试已覆盖这条合同：`src/tests/settingsSync.spec.ts:61-87`

这意味着“版本化备份”只需要改变远端文件组织方式，不需要改远端 JSON 数据格式。

##### 2.2 当前测试实际覆盖点

- `src/tests/webdavSettings.spec.ts:72-251`：验证 URL、路径默认值、脏状态、不可变保存合并。
- `src/tests/settingsSync.spec.ts:37-88`：验证版本 1 JSON 解析、`parse_error`、保留本地 WebDAV 配置。
- `src/tests/linuxDoMigration.spec.ts:1325-1521`：验证后台转发、`<all_urls>`、对话框无障碍与版本 1 合同。
- 当前仓库没有目录 `PROPFIND Depth: 1` 解析、单文件 `DELETE`、20 份轮转、按选中版本恢复的测试。

#### 3. 当前代码对版本化备份的直接约束

1. 当前后台消息只有 `TEST` / `UPLOAD` / `DOWNLOAD` 三类（`src/logic/webdav.ts:24-28`）；没有“目录列举”和“单文件删除”。
2. 当前协议实现没有任何 XML 解析代码；`PROPFIND` 仅被当作“看状态码”的探测（`src/logic/webdav.ts:92-153`）。
3. 当前 URL 拼接和逐段建目录都直接使用原始路径字符串，没有做 path-segment 级别的百分号编码：`src/logic/webdav.ts:79-90,117-123`。

当前代码证据：

```ts
// src/logic/webdav.ts:79-82
function resolveUrl(config: WebDavConfig): string {
  const base = config.url.replace(/\/+$/, '')
  const path = config.path.startsWith('/') ? config.path : `/${config.path}`
  return `${base}${path}`
}
```

这意味着：

- 版本化文件名如果包含空格、冒号或其他需要编码/服务器文件系统不兼容的字符，现有实现没有保护层；
- 目录列表必须新增 XML 解析；
- 轮转删除必须新增 `DELETE`；
- 选中恢复必须让下载逻辑接受“目标备份路径”而不是零参数固定路径。

### WebDAV / RFC 4918 Interoperability Constraints

#### 1. 目录列举：`PROPFIND Depth: 1`

官方依据：RFC 4918 §9.1、§13、§14.22、§14.24。

约束要点：

- 客户端对 `PROPFIND` **必须显式发送** `Depth: 0`、`1` 或 `infinity`；服务器 **必须支持** `0` 和 `1`。
- 对集合（目录）做 `Depth: 1` 时，返回体应为 `207 Multi-Status`，并包含目标集合自己以及其直接成员的 `response` 条目。
- `PROPFIND` 的每个资源结果通常不是 `response/status`，而是 `response/propstat+/status` 形式；属性缺失会以属性级 `404` / `403` 等出现。
- 结果是**扁平列表**，顺序**无意义**；客户端不能依赖“第一个子项就是最新备份”之类的顺序假设。
- `response` 至少要有一个 `href` 指向资源；客户端应以规范化后的 `href` 识别“目录自身”和“目录的直接子文件”。

对本任务的直接含义：

- 目录备份列表的最小互操作请求应是：对目录 URL 发 `PROPFIND Depth: 1`，并请求最少足够属性（至少 `resourcetype`，通常还应带 `getlastmodified`、`getcontentlength` 以支持排序/调试/显示）。
- 解析器必须跳过“目录自身”的 `response`，仅对直接子成员建列表。
- 解析器必须允许属性分散在多个 `propstat` 中，而不是假设只有一个 `200 propstat`。

#### 2. 单文件清理：必须是“单文件 `DELETE`”，不能删目录

官方依据：RFC 4918 §9.6、§9.6.1。

约束要点：

- 对集合执行 `DELETE` 时，规范要求按 `Depth: infinity` 语义处理整个集合。
- 因此，版本轮转清理绝不能对备份目录本身做 `DELETE`；必须对超额的**单个备份文件**逐个发 `DELETE`。
- 成功 `DELETE` 后，对同一 URI 的后续 `GET` / `HEAD` / `PROPFIND` 应返回 `404 Not Found`。
- 集合 `DELETE` 失败时可以返回 `207 Multi-Status` 说明哪个子项失败；这不是单文件清理应依赖的主要形态。

对本任务的直接含义：

- “保留最近 20 份”的清理实现必须是“找出超额文件 → 对每个文件单独 `DELETE`”。
- 当前仓库完全没有 `DELETE` 实现；这是版本化备份必须新增的最小协议能力之一。

#### 3. 集合创建：`MKCOL` 只能创建单层，祖先目录必须已存在

官方依据：RFC 4918 §9.3、§9.3.1。

约束要点：

- `MKCOL` 只能在**未映射** URI 上创建集合。
- 所有祖先集合必须已经存在，否则服务器必须返回 `409 Conflict`，且**不得自动补建中间目录**。
- 常见状态码：`201`、`403`、`405`、`409`、`415`、`507`。

对本任务的直接含义：

- 当前 `ensureParentDir()` 逐段 `PROPFIND` + `MKCOL` 的策略（`src/logic/webdav.ts:111-153`）与 RFC 一致，应继续沿用，而不是一次性对深层路径发单个 `MKCOL`。
- 新默认目录 `/bewly/` 正好符合集合 URL 语义；集合标识符也应保持尾部 `/`（RFC 4918 §8.3 建议集合 URI 以 `/` 结尾）。

#### 4. URL / 路径编码：`href` 可能是绝对 URI，也可能是绝对路径

官方依据：RFC 4918 §8.3、§8.3.1；RFC 3986 §2.1。

约束要点：

- `Multi-Status` 中的 `href` 可以是**完整绝对 URI**，也可以是**绝对路径**；同一个响应体中的所有 `href` 必须使用同一种格式。
- `href` 不应出现 `.` / `..` 段，并应与请求 URI 前缀一致。
- 集合标识符建议以 `/` 结尾。
- URI 中的空格等字符必须按 RFC 3986 做百分号编码；同时 XML 中还可能有 `&amp;` 之类的字符实体转义，这与 URI 百分号编码是两回事。

对本任务的直接含义：

- 目录列表解析器必须同时接受：
  - `https://example.com/dav/bewly/20260710T231015.123Z.json`
  - `/dav/bewly/20260710T231015.123Z.json`
- 解析器必须先做 XML 文本解码，再做 URI 归一化；不能把原始 `href` 文本直接当作“可显示文件名”。
- 出于路径与底层文件系统互操作风险，**可排序 UTC 毫秒文件名应优先采用不含 `:` 的格式**。这仍满足“UTC 毫秒命名”产品决策，但比原始 ISO 8601 冒号格式更安全。

#### 5. XML 命名空间和两种 `Multi-Status` 形态都要兼容

官方依据：RFC 4918 §13、§14.22、§14.24；RFC 4918 §4.3.1 说明前缀本身不具语义。

约束要点：

- WebDAV 例子里会出现 `D:`、`d:` 或默认命名空间；**前缀本身不可硬编码**，应按命名空间 URI `DAV:` + local-name 匹配。
- `Multi-Status` 有两种不同形态：
  1. `response/href/status`：表示整个资源的状态（典型见 `DELETE`）。
  2. `response/href/propstat+`：表示资源属性级状态（典型见 `PROPFIND` / `PROPPATCH`）。
- 客户端必须兼容两种形态；目录列表主要用第 2 种，单文件/集合删除错误说明可能出现第 1 种。

对本任务的直接含义：

- 最小 XML 解析器至少要按 `DAV:` 命名空间识别这些节点：`multistatus`、`response`、`href`、`propstat`、`prop`、`status`、`resourcetype`、`collection`、`getlastmodified`、`getcontentlength`。
- 不能假设节点前缀永远是 `d:`，也不能假设 `response` 下永远直接有 `status`。

### MV3 Background Service Worker Constraints

#### 1. 仓库中的当前实现边界

- Chromium：`src/manifest.ts:40-42` 使用 MV3 `service_worker`。
- Firefox/Safari：同一文件在非 Chromium 分支回退为 background scripts。
- WebDAV 所有真实网络请求都在后台执行，内容脚本只通过 `runtime.sendMessage` 触发（`src/logic/webdav.ts:40-65`、`src/background/messageListeners/webdav.ts:22-46`）。

#### 2. 官方运行时约束

官方依据：

- Chrome 扩展 Service Worker 生命周期文档：<https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>
- Chrome 扩展消息传递文档：<https://developer.chrome.com/docs/extensions/develop/concepts/messaging>
- MDN `background` / MV3 文档：<https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background>

关键结论：

- Chrome 会在**约 30 秒空闲**后终止扩展 service worker。
- 单次事件/API 调用处理超过**约 5 分钟**、或单个 `fetch()` 响应超过**约 30 秒**，都有被终止的风险。
- 新事件或扩展 API 调用会重置计时器；被唤醒后 worker 需要能从无内存状态恢复。

对本任务的直接含义：

- 版本化备份流程不能依赖“后台全局内存里保存上一步列表结果”；跨消息状态应放在内容脚本/调用方，或在同一次消息处理内闭合。
- “最多 20 份”的上限有利于把一次上传后的列举 + 清理控制在 service worker 时间预算内。
- 由于当前后台消息处理是纯 Promise 返回（`src/background/messageListeners/webdav.ts:28-39`），新增 LIST/DELETE 也应保持无共享状态、单请求可重入。

### Confirmed Product Decisions (evidence)

已确认产品决策已收敛在当前任务 PRD：`.trellis/tasks/07-10-webdav-versioned-backups/prd.md` 的 R1-R5。

| 决策 | Evidence |
|---|---|
| 默认同步路径改为目录 `/bewly/` | `prd.md` R1 |
| 每次上传必须创建新备份，不覆盖上一份 | `prd.md` R2 |
| 备份文件名使用 UTC 毫秒可排序标记，显示为本地时间 | `prd.md` R2 |
| 同毫秒碰撞必须追加稳定序号并禁止覆盖写入 | `prd.md` R2 |
| 采用“先上传、后清理”并限制最近 20 份 | `prd.md` R3 |
| 上传失败不能删除旧备份；清理失败算部分成功 | `prd.md` R3/R5 |
| 下载前先列出远端版本，默认选最新 | `prd.md` R4 |
| 选择区内持续显示覆盖警告，用户只确认一次才恢复 | `prd.md` R4 |
| 完整兼容旧单文件；不可读旧文件不阻断健康版本或被误删 | `prd.md` R1/R3 |

相关已归档设计也支持这些决策：

- 手动对话框的“内联确认，不开二次模态”边界：`.trellis/tasks/archive/2026-07/07-10-webdav-manual-dialog/design.md:185-193`
- Shadow DOM 模态框的 Escape / 焦点 / `inert` 合同：`.trellis/spec/frontend/modal-accessibility.md:32-41`

### Evidence-based Minimum Contract for `design.md`

#### 1. 最小协议面（基于当前代码边界，而非推翻现有架构）

当前 WebDAV 协议面只有：

- `TEST`
- `UPLOAD`
- `DOWNLOAD`

见 `src/logic/webdav.ts:24-28`。

为满足版本化备份，最小新增能力应是：

1. **目录列举**：新增一个“对目录执行 `PROPFIND Depth: 1` 并返回规范化条目”的后台操作。
2. **单文件删除**：新增一个“对单个备份文件执行 `DELETE`”的后台操作。
3. **按目标路径下载**：当前 `downloadSettings()` 是零参数固定路径（`src/logic/settingsSync.ts:102-104`）；需要一个可指定备份路径的变体，或新函数。
4. **上传结果 richer contract**：当前 `uploadSettings()` 只返回 `{ ok, error? }`（`src/logic/settingsSync.ts:82-100`）；版本化上传至少要能表达“新建成功 + 清理部分失败”。

最小保持不变的部分：

- WebDAV 请求仍全部走后台，不搬回内容脚本。
- 远端备份文件内容仍是现有版本 1 JSON 信封。
- `WebDavConfig` 仍保留 `{ url, username, password, path }` 这一配置骨架。

#### 2. 推荐的最小类型合同

```ts
interface WebDavDirectoryEntry {
  href: string // RFC 4918 原始 href（已 XML 解码）
  requestPath: string // 规范化后的绝对请求路径，用于 GET/DELETE
  isCollection: boolean
  contentLength?: number
  lastModified?: string
}

interface BackupRecord {
  id: string // 可直接用 requestPath
  source: 'versioned' | 'legacy'
  fileName: string
  requestPath: string
  timestampMs: number
  displayLabel: string // 本地时间显示字符串
  sortKey: string // 版本文件名中的 UTC 可排序 token；legacy 可退化为 timestampMs
}

interface CleanupFailure {
  requestPath: string
  status: number
  error?: string
}

interface UploadVersionedResult {
  ok: boolean
  created?: BackupRecord
  deleted?: string[]
  cleanupFailed?: CleanupFailure[]
  error?: string
}
```

这组类型是对现有 `WebDavResult` / `SyncResult` 的最小补充，不要求推翻当前结构。

#### 3. 推荐的最小错误合同

保留当前已有错误语义：

- `remote_not_found`
- `parse_error`
- `unsupported_version`
- 传输层 `error` 字符串

版本化备份至少还需要新增/显式化：

- `directory_list_failed`
- `invalid_multistatus`
- `unsupported_href_format`
- `upload_precondition_failed`（主预期是 create-only PUT 冲突）
- `cleanup_partial`
- `selected_backup_not_found`

说明：

- `cleanup_partial` 不是“整体失败”，而是“新文件已经成功，旧文件清理有失败项”；这与当前 PRD 的“部分成功”决策一致。
- 对 create-only PUT，规范层最典型失败码是 HTTP `412 Precondition Failed`（RFC 9110 条件请求）；但不同 WebDAV 服务器也可能用 `409` / `405` 暴露冲突，这属于兼容风险，应在实现中归并处理而不是硬编码单一状态码。

#### 4. 推荐的旧路径迁移方式（满足“完整兼容旧单文件”的最小闭合方案）

当前代码事实：

- 本地默认路径仍是 `/bewly/settings.json`（`src/logic/webdavSettings.ts:3`、`src/logic/storage.ts:237-243`）。
- 当前迁移代码不会保留“旧远端单文件位置”信息（`src/logic/settingsMigration.ts:1-45`）。

最小闭合迁移建议：

1. 若持久化 `webdavPath` 已是目录形式（以 `/` 结尾），保持不变。
2. 若持久化 `webdavPath` 是单文件形式（默认旧值或用户自定义文件路径）：
   - 新 `webdavPath` = 旧路径的父目录，且规范化为尾部 `/`。
   - 本地非可选字段 `webdavLegacyFilePath: string` 记录原始文件路径，默认空串。
3. 版本列表读取时：
   - 先列举目录中的版本化文件；
   - 若存在 `webdavLegacyFilePath`，再把该单文件作为 `source: 'legacy'` 候选；
   - 旧文件在被成功轮转删除，或成功目录列表确认不存在后，才清除此字段。
4. 旧单文件必须通过 GET 校验版本 1 JSON 信封，并以其 `timestamp` 作为显示、排序和轮转的唯一权威时间；`getlastmodified` 只用于诊断。若旧文件 404，则清除定位；若网络/JSON/信封无效，则省略该 legacy 选项并返回警告，健康版本列表继续可用，且时间未知的旧文件不得参与删除。

这比“仅把旧路径截断成父目录但不记住旧文件位置”更符合 `prd.md` R1 的完整兼容要求。

#### 5. 推荐的 20 份轮转算法

满足 RFC 与 PRD 的最小算法如下：

1. 生成可排序、UTC、毫秒级、不含 `:` 的受管理文件名：`bewly-settings-YYYYMMDDTHHmmss.SSSZ-NNNN.json`。
2. 先尝试 create-only 上传（推荐 `If-None-Match: *`）。
3. 若同毫秒碰撞，在固定 UTC token 后从 `0001` 递增到 `0010`；最多 10 次，耗尽后明确失败，不降级为覆盖。
4. 新文件上传成功后，再执行目录 `PROPFIND Depth: 1` 列出所有直接成员。
5. 受管理备份集合包括匹配版本化命名规则的新文件，以及通过 GET 校验且路径精确匹配的 legacy；忽略目录中的其他文件。
6. 依据权威 `timestampMs` 和数值序号从新到旧排序；不可读 legacy 不参与排序/删除并产生清理警告。
7. 保留前 20 份；对超额项逐个执行单文件 `DELETE`。
8. 任一列举、legacy 校验或旧文件删除失败：
   - 不回滚新上传；
   - 返回 `cleanup_partial`；
   - 下次上传成功后重新对完整远端状态收敛，而不是只删 1 个。
9. 若新上传失败，则不删除任何旧备份。

这与 `prd.md` R2/R3/R5 一致，也符合 RFC 4918 对“集合不能整体删、单文件逐个删”的约束。

#### 6. 推荐的测试矩阵

| Scenario | Why it matters | Evidence anchor |
|---|---|---|
| `PROPFIND Depth: 1` 返回目录自身 + 2 个文件 | 必须跳过 self，只列直接子文件 | RFC 4918 §9.1 |
| `href` 使用绝对 URI | 服务器可返回完整 URI | RFC 4918 §8.3 |
| `href` 使用绝对路径 | 服务器也可返回绝对路径 | RFC 4918 §8.3 |
| `href` 中含 `%20` / XML `&amp;` | URI 编码与 XML 转义要分开处理 | RFC 4918 §8.3.1；RFC 3986 §2.1 |
| XML 前缀分别为 `d:` / `D:` / 默认命名空间 | 不能硬编码前缀 | RFC 4918 §4.3.1、§13 |
| `PROPFIND` 使用多个 `propstat` | 属性级 200/404/403 需兼容 | RFC 4918 §14.22 |
| 同毫秒上传两次 | 必须创建两个不同文件，不覆盖 | `prd.md` R2 |
| 旧单文件迁移后仍可列出并标记为 legacy | 满足完整兼容旧文件 | `prd.md` R1 |
| legacy GET/JSON/信封无效 | 健康版本仍可列出；未知时间旧文件不被删除 | `prd.md` R1/R3 |
| legacy 文件计入 20 份并在最老时被删 | 轮转包含有效旧单文件 | `prd.md` R1/R3 |
| 目录中存在非托管文件 | 不可误删 | `prd.md` R3 |
| 上传失败 | 不得删除任何旧文件 | `prd.md` R3 |
| 清理部分失败 | 返回部分成功，并在下一次上传重试所有超额项 | `prd.md` R3/R5 |
| 用户选中较旧版本恢复 | 不能总是恢复最新文件 | `prd.md` R4 |
| 选择变化但未点击确认 | 仅改变选择不得触发恢复 | `prd.md` R4 |
| Shadow DOM 对话框 Escape / 焦点恢复 / `inert` | 继续遵守现有对话框无障碍合同 | `.trellis/spec/frontend/modal-accessibility.md:32-41` |
| 后台多次消息唤醒 / 无共享内存 | 兼容 MV3 worker 生命周期 | Chrome SW lifecycle docs |

### External References

- [RFC 4918: HTTP Extensions for Web Distributed Authoring and Versioning (WebDAV)](https://www.rfc-editor.org/rfc/rfc4918) — WebDAV 官方规范；本任务最关键的是 §8.3、§9.1、§9.3、§9.6、§13、§14.22、§14.24。
- [RFC 3986: Uniform Resource Identifier (URI): Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986) — 百分号编码与 URI 路径语义；用于文件名/路径 token 的编码边界。
- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110) — 条件请求 `If-None-Match: *` 与 `412 Precondition Failed` 语义；适用于“禁止覆盖上传”。
- [Chrome Extensions: The extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — MV3 service worker 生命周期、30s idle / 5min / 30s fetch 约束。
- [Chrome Extensions: Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — 当前 `runtime.sendMessage` / `runtime.onMessage` 模式的官方说明。
- [MDN: `background` manifest key](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background) — Chromium MV3 `service_worker` 与 Firefox `background scripts` 分支差异。

### Related Specs

- `.trellis/tasks/07-10-webdav-versioned-backups/prd.md` — 当前任务已确认产品决策与验收标准。
- `.trellis/tasks/archive/2026-07/07-03-webdav/prd.md` — 初始 WebDAV 功能范围与默认单文件路径历史。
- `.trellis/tasks/archive/2026-07/07-10-webdav-manual-dialog/design.md` — 当前手动 WebDAV 对话框的持久化、确认、无障碍与关闭语义。
- `.trellis/tasks/archive/2026-07/07-10-webdav-settings-dialog/research/webdav-sync.md` — 已归档的自动/手动 WebDAV 路径研究，可解释现有背景传输边界。
- `.trellis/spec/frontend/modal-accessibility.md` — Shadow DOM 模态框的焦点与 Escape 合同。

## Caveats / Not Found

1. 当前 worktree 中执行 `python3 ./.trellis/scripts/task.py current --source` 返回 `none`；本报告依据用户明确给出的活动任务路径，写入当前 worktree 的 `.trellis/tasks/07-10-webdav-versioned-backups/`。
2. 当前仓库没有任何 `PROPFIND Depth: 1` XML 解析实现，也没有 `DELETE` 实现；因此目录列举、轮转清理和多种 `Multi-Status` 兼容性都仍属“待实现能力”，不是已有代码能力。
3. 当前仓库也没有服务商级互操作样本（如 Nextcloud / SabreDAV / Apache mod_dav）；本报告的兼容结论以 RFC 官方规范为主，未对具体服务器做实测。
4. 规范能证明“允许哪些响应形态”，但不能保证所有服务器都严格按推荐状态码返回；例如 create-only PUT 冲突在现实中可能不止 `412` 一种状态码，这应在设计里当作技术风险保留。
5. 当前代码与测试没有暴露“在 extension service worker 中采用哪种 XML 解析 API”这一实现细节；版本化备份引入 XML 解析时，需要额外确认目标浏览器中的可用解析方式。
