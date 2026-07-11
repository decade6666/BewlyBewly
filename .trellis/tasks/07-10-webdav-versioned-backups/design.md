# WebDAV 版本化备份技术设计

## Design Summary

在不改变现有手动同步、后台网络边界和版本 1 远端信封的前提下，把 `webdavPath` 从“完整文件路径”重新定义为“备份目录”。内容脚本负责版本命名、WebDAV `Multi-Status` 解析、受管理文件识别、最近 20 份轮转计划和恢复选择；后台继续只负责带凭据执行真实 HTTP/WebDAV 请求。

新备份使用固定前缀、UTC 毫秒时间和固定宽度碰撞序号，上传必须使用 create-only 条件，不能在兼容失败时退化为覆盖。上传成功后重新列举目录，逐个删除所有超额最旧文件。旧单文件路径通过本地迁移字段保持可识别、可恢复并参与同一轮转。

## Architecture Boundaries

```text
WebdavSettingsDialog.vue
  ├─ Save/Test/Upload operation lock
  ├─ listSettingsBackups()
  ├─ selected backup id
  └─ downloadSettings(selected backup)
       │
       ▼
settingsSync.ts                         (content-script DOM context)
  ├─ version-1 envelope build/parse
  ├─ unique backup creation orchestration
  ├─ raw PROPFIND XML → webdavBackups.ts
  ├─ retention delete plan
  └─ preserve local WebDAV fields
       │
       ▼
webdav.ts content-side wrappers
  └─ browser.runtime.sendMessage
       │
       ▼
background/messageListeners/webdav.ts
  └─ webdav.ts raw fetch operations
       ├─ TEST:   PROPFIND Depth: 0
       ├─ LIST:   PROPFIND Depth: 1
       ├─ UPLOAD: create-only PUT
       ├─ DOWNLOAD: GET selected file
       └─ DELETE: DELETE one selected file
       │
       ▼
User-configured WebDAV server
```

### Fixed boundaries

- 网络请求仍全部在后台执行；内容脚本不直接 `fetch` WebDAV。
- Chromium 后台仍是 MV3 service worker；不新增 offscreen document、权限或后台持久内存。
- XML 原文通过可结构化克隆的字符串返回内容脚本，在有 DOM 的上下文用 `DOMParser` 解析；`webdavBackups.ts` 不得被后台入口导入。
- 远端 JSON 继续使用现有 `SyncEnvelope { version: 1, timestamp, settings, blockedWords }`。
- `App.vue` 仍只拥有 WebDAV 对话框入口、四语言文案、Escape 路由和焦点恢复；版本选择位于现有常驻挂载的对话框内。

## Directory and Path Contract

### Stored form

`webdavPath` 保存规范化的逻辑目录路径：

- 必须有前导 `/` 和尾随 `/`；
- 空白路径回退为 `/bewly/`；
- `bewly`、`/bewly` 和 `/bewly/` 均保存为 `/bewly/`；
- 根目录保持 `/`；
- 路径段 `.`、`..` 和空控制字符被拒绝，不允许越出用户选择的目录；
- URL 构造时逐段编码，不把远端 `href` 或用户输入直接拼成可跨源 URL。

`WebdavValidationError` 增加 `path_invalid`。Save 和 Test 都在发送凭据前验证规范化目录；四套 `App.vue` 文案提供对应本地化文本。对话框把现有 URL 专用错误处理改为按错误类型分派的 `showValidationError()`：URL 错误聚焦 `urlInputRef`，路径错误聚焦新增 `pathInputRef`，并为两个输入分别绑定 `aria-invalid`、`aria-describedby` 和对应错误容器。相对目录名本身允许使用，但任何规范化后仍包含 `.`/`..` 段、控制字符或无法安全编码的值都必须失败，不能静默改成其他目录。

`config.url` 继续表示用户配置的 WebDAV 端点根，规范化目录/文件路径附加到去除尾斜杠后的端点。路径中 Unicode、空格和保留字符在请求边界按段编码；生成的版本文件名只使用 ASCII 安全字符。

### Request-target validation

目录列表中的 `href` 是不可信远端输入。解析器必须：

1. 以实际请求目录 URL 为基准解析绝对 URI或绝对路径；
2. 验证结果与配置端点同源；
3. 验证资源是目标目录的直接子项，而不是目录自身、子目录或相邻前缀；
4. 只提取并重新编码合法文件名，再从已知目录构造 GET/DELETE 路径；
5. 从不把未经验证的完整 `href` 回传为请求目标。

## Legacy Single-file Migration

### Local field

在 `Settings` 增加本地隐藏字段：

```typescript
webdavLegacyFilePath: string
```

默认值为空串。它属于本机 WebDAV 元数据：

- 必须显式加入 `settingsSync.ts` 的 `WEBDAV_FIELDS`/`WEBDAV_FIELD_SET`，确保 `stripWebdavFields()` 不把它写入远端信封；
- 必须显式加入 `retainedWebdavFields()` 的返回类型和值，确保下载任意版本后仍保留本地 locator；
- 不进入 WebDAV 设置草稿，也不显示为可编辑字段。

### Idempotent migration

对持久化字符串、对象形态和已水合内存状态执行同一纯迁移：

| Existing value | New `webdavPath` | New legacy field |
|---|---|---|
| `/bewly/settings.json` | `/bewly/` | `/bewly/settings.json` |
| `/custom/archive.json` | `/custom/` | `/custom/archive.json` |
| `archive.json` | `/` | `/archive.json` |
| `/custom/` | `/custom/` | unchanged/empty |
| missing/blank | `/bewly/` via defaults/normalization | empty |

任何非目录旧值都按旧版本合同解释为单文件路径。迁移后的目录以 `/` 结尾，因此重复执行不会再次截断。

### Lifecycle

- 列表成功时，只有与 `webdavLegacyFilePath` 精确匹配的文件才作为 `source: 'legacy'` 候选；同目录其他 JSON 文件不是 legacy。
- 对候选 legacy 单独执行 GET 并校验版本 1 信封；信封 `timestamp` 是其显示、排序和轮转的唯一权威时间。`getlastmodified` 只用于诊断，不得替代信封时间改变淘汰顺序。
- 用户保存不同目录时立即清空 legacy 定位，防止跨目录混入。
- legacy 被轮转 DELETE 成功，或成功目录列表确认其不存在时，清空本地定位；列表失败时不得清空。
- legacy 返回 404 时清除定位并继续返回健康列表。网络失败、无效 JSON 或无效信封时，省略该 legacy 选项并返回 `legacy_unreadable` 警告；健康的新版本仍可列举/恢复。时间未知的 legacy 不参与排序或删除，上传清理返回部分成功并在后续上传重试识别，避免一个损坏文件阻断全部恢复或被误删。

## Version Filename and Create-only Upload

### Managed filename

固定格式：

```text
bewly-settings-YYYYMMDDTHHmmss.SSSZ-NNNN.json
```

示例：

```text
bewly-settings-20260711T042900.123Z-0001.json
bewly-settings-20260711T042900.123Z-0002.json
```

属性：

- 时间来自信封 `timestamp`，使用 UTC，精确到毫秒且不含冒号；
- 四位序号从 `0001` 开始，仅在相同毫秒碰撞时递增；
- 固定前缀和后缀用于识别本功能管理的文件；
- 解析后按 `timestampMs`、数值序号和稳定路径排序，不依赖服务器返回顺序，也不原地排序输入。

基础 ISO 形式不直接交给 `Date.parse()`；纯函数用正则提取年、月、日、时、分、秒和毫秒，经范围校验后调用 `Date.UTC(...)`，并要求重新格式化后的 token 与原值完全一致，以拒绝日期自动进位。

### Collision handling

1. 生成 `NNNN = 0001` 候选。
2. `PUT` 带 `If-None-Match: *`。
3. HTTP `412` 直接视为名称已存在并递增序号。
4. 对服务商可能使用的其他冲突状态，不盲目归类；只有在一次成功目录列举确认候选确实存在时才递增，否则返回原错误。
5. `MAX_BACKUP_NAME_ATTEMPTS = 10`：同一毫秒最多尝试序号 `0001` 至 `0010`；全部冲突时返回 `upload_collision_exhausted`，不执行无条件 PUT，不删除旧备份。该上限必须在错误状态中可见，不能静默截断。
6. 服务器若明确不支持 create-only 条件，返回可观察失败；不得为了“兼容”而覆盖已有文件。

UI 单操作锁防止同一页面并发上传；create-only 条件和序号处理跨设备同毫秒竞争。

## WebDAV Transport Contract

### Messages

在现有枚举上增加 LIST 和 DELETE：

```typescript
TEST | LIST | UPLOAD | DOWNLOAD | DELETE
```

消息仍携带 `WebDavConfig`。UPLOAD 增加显式 `createOnly` 选项；LIST 的 `config.path` 必须是目录，DOWNLOAD/DELETE/UPLOAD 的路径必须是完整受验证文件路径。

### Low-level operations

| Operation | Request | Success | Notable failure |
|---|---|---|---|
| TEST | `PROPFIND`, `Depth: 0` | existing 200/207 behavior | unchanged |
| LIST | `PROPFIND`, `Depth: 1`, request minimal DAV props | 207; tolerate 200 only when body parses as valid multistatus | 404 maps to empty directory/not found; malformed body is not success |
| UPLOAD | `PUT`, JSON content type, `If-None-Match: *` | 2xx | 412 collision; other status preserved |
| DOWNLOAD | `GET` selected file | 2xx + text | 404 selected backup missing |
| DELETE | `DELETE` one non-directory path | 2xx; 404 is idempotent success | directory target rejected before fetch |

LIST 请求最少包含 `resourcetype`、`getlastmodified` 和 `getcontentlength`，用于辨别集合和诊断；legacy 排序仍只使用其版本 1 信封时间。父目录继续沿用逐段 `PROPFIND Depth: 0` + `MKCOL`，因为 WebDAV 不会自动创建缺失祖先集合。

## Multi-Status Parsing

`webdavBackups.ts` 使用 `DOMParser(..., 'application/xml')`，并显式检测 `parsererror`。解析规则：

- 节点按 `DAV:` namespace + local name 匹配；为现实服务商兼容，可接受空 namespace，但不硬编码 `d:` 或 `D:` 前缀。
- 支持 `response/href/status` 和 `response/href/propstat+/status` 两种结构。
- 只使用状态为 2xx 的属性集合；属性缺失不使其他有效属性失效。
- 处理 XML 实体由 DOMParser 完成，再处理 URI 百分号编码；两层解码不得混为一层。
- 跳过目录自身、子目录和非直接子项。
- 服务器返回顺序没有语义；所有排序在解析后的纯数据上完成。

解析结果只产生规范化目录条目；受管理文件过滤、legacy 合并和轮转是独立纯函数，便于测试和复用。

## Data Contracts

```typescript
interface WebDavDirectoryEntry {
  fileName: string
  requestPath: string
  isCollection: boolean
  lastModifiedMs?: number
  contentLength?: number
}

type BackupSource = 'versioned' | 'legacy'

interface SettingsBackupSummary {
  id: string // normalized requestPath
  requestPath: string
  fileName: string
  source: BackupSource
  timestampMs: number
  sequence: number
}

type BackupListWarning = 'legacy_unreadable'

interface BackupListResult {
  ok: boolean
  backups?: readonly SettingsBackupSummary[]
  warnings?: readonly BackupListWarning[]
  error?: BackupErrorCode
}

interface SyncResult {
  ok: boolean
  warning?: 'cleanup_partial'
  error?: BackupErrorCode | string
}
```

UI 自行用 `new Date(timestampMs).toLocaleString()` 生成当前设备本地显示，不把本地化字符串写入协议层或持久层。

## Upload and Retention Flow

```text
Build immutable V1 envelope + timestamp
  → create unique managed file with create-only PUT
      failure → return failure; delete nothing
  → update local webdavLastSyncTime
  → LIST directory and parse all direct entries
      list failure → return ok + cleanup_partial
  → parse managed versioned files
  → if exact legacy exists, GET and validate its V1 timestamp
      unreadable legacy → omit from ordering/deletion; record legacy_unreadable + cleanup_partial
  → merge only validated legacy with versioned files
  → sort newest-first
  → keep first 20; derive every extra oldest item
  → DELETE extras sequentially
      2xx/404 → success
      any other failure → retain new file; collect cleanup failure
  → clear legacy locator when its file was deleted/confirmed absent
  → return full success or ok + cleanup_partial
```

删除顺序使用最旧优先并顺序执行，降低 WebDAV 服务商限流风险。下一次上传不依赖内存中的失败列表，而是重新 LIST 全部状态并计算全部超额项，因此 service worker 重启和跨设备并发不会丢失收敛能力。

## List and Restore Flow

1. 用户点击“下载备份”。
2. 对话框进入列表加载操作；`listSettingsBackups()` 请求并解析目录。
3. 404/空目录映射为空列表；其他目录错误显示列表失败且不改变本地状态。
4. legacy 无法读取时返回健康版本列表 + `legacy_unreadable` 警告，不让单个旧文件阻断新版恢复。
5. 成功列表按新到旧返回，默认选择第一项；选择器渲染后的 `nextTick` 显式聚焦其 `<select>`，避免下载按钮被替换后焦点落到页面外。
6. 改变选择只更新本地 `selectedBackupId`。
7. 用户看到持续覆盖警告并点击“恢复所选备份”。
8. `downloadSettings(selectedPath)` 在 GET 前重新验证路径仍属于当前目录的 managed 文件或精确 legacy。
9. GET 404 映射 `selected_backup_not_found`；JSON/版本校验失败不改变任何本地状态。
10. 只有完整信封校验通过后，才一次性替换设置和屏蔽词，并保留全部本机 WebDAV 字段。

本地更新沿用“先验证完整对象，再一次性赋值”的边界，避免半应用。

## Dialog State and Accessibility

### Component split

`WebdavSettingsDialog.vue` 当前接近 800 行。新增 `WebdavBackupPicker.vue` 作为无副作用展示组件：

- 接收只读备份摘要、选中 id、禁用状态和文案；
- 用带显式标签的原生 `<select>` 显示最多 20 个版本；
- 显示 legacy 标记、`legacy_unreadable` 兼容警告和持续覆盖警告；
- 仅发出 `select`、`confirm`、`cancel`，不读取全局设置、不发请求；
- 通过模板 ref/`defineExpose` 提供 `focusFirstControl()`，让父对话框在列表成功渲染后显式恢复模态框内焦点。

主对话框继续拥有网络编排和唯一操作锁。活动状态区分 `test`、`upload`、`list`、`download`：

- LIST 是对话框会话级结果；关闭后晚到结果不得在重开时出现。
- 列表成功且有选项时，在选择器渲染后的 `nextTick` 聚焦其首个控件。
- 列表失败、空列表或用户取消选择器时，在 `nextTick` 聚焦新增 `downloadButtonRef`；若按钮不可用则聚焦现有关闭按钮，保证异步状态切换始终留在模态框内。
- 实际 DOWNLOAD 与现有 Upload 一样是持久传输；关闭不伪装取消，结果在常驻组件中保留。
- 编辑草稿、保存不同端点、关闭对话框都会清空选择器；进行中操作仍禁止第二个非关闭操作。

现有 `role="dialog"`、`aria-modal`、ShadowRoot active element、Tab/Shift+Tab 闭环、capture-phase Escape、父面板 `inert` 和焦点恢复合同保持不变。

## Error and Outcome Matrix

| Condition | Result | Local data | UI |
|---|---|---|---|
| Directory missing/empty during list | successful empty list | unchanged | 无可用备份 |
| LIST network/status failure | `directory_list_failed` | unchanged | 列表读取失败 |
| Invalid XML/multistatus/href | explicit parse/path error | unchanged | 列表读取失败 + detail |
| Legacy GET/network/envelope invalid | healthy list + `legacy_unreadable`; upload cleanup is partial | unchanged; uncertain legacy never deleted | 旧版备份无法读取 / 上传清理警告 |
| Invalid configured directory path | `path_invalid` before background request | unchanged | 路径字段本地化错误 |
| Create-only collision | retry next sequence | unchanged until success | remains busy |
| Collision retries exhausted/unsupported | upload failure | last sync unchanged; old backups untouched | 上传失败 |
| PUT succeeds, post-list fails | `ok + cleanup_partial` | last sync updated | 上传成功但清理失败 |
| Some DELETE fails | `ok + cleanup_partial` | new backup retained | 上传成功但清理失败 |
| DELETE returns 404 | idempotent success | optional legacy locator cleared | no false warning |
| Selected file disappears | `selected_backup_not_found` | unchanged | 所选备份不存在 |
| Invalid JSON/V1 envelope | parse/version error | unchanged | 下载失败 |
| Valid selected envelope | success | settings/blocked words replaced; local WebDAV retained | 恢复成功 |

## Security and Compatibility

- URL 必须继续通过现有 absolute HTTP(S) 验证；凭据不出现在文件名、状态、日志或测试输出。
- 远端 XML、href、文件名和 JSON 均在真实系统边界验证；内部已建模对象不重复堆叠防御。
- 只删除固定命名规则文件和精确 legacy 路径；目录中的任何其他文件不进入删除计划。
- 绝不对目录执行 DELETE；WebDAV 集合 DELETE 具有递归语义。
- create-only 失败不会降级为覆盖；这是“每次创建新文件”的数据安全保证。
- 操作不依赖后台全局状态，可在 MV3 service worker 重启后重入。
- 不新增 XML/日期/UI 依赖；Vitest 的 jsdom 环境覆盖 DOMParser 纯函数测试。

## File Ownership Map

| File | Responsibility |
|---|---|
| `src/logic/webdavSettings.ts` | Default directory, draft path normalization, legacy clearing on directory change |
| `src/logic/settingsMigration.ts` | Idempotent old file-path migration and existing legacy-key cleanup |
| `src/logic/storage.ts` | New local-only legacy locator and defaults |
| `src/logic/webdavBackups.ts` | Pure naming, XML parsing, path validation, managed filtering, sorting, retention plan |
| `src/logic/webdav.ts` | LIST/DELETE/create-only transport and background wrappers |
| `src/background/messageListeners/webdav.ts` | Dispatch new message kinds |
| `src/logic/settingsSync.ts` | Envelope reuse, upload/list/cleanup/selected restore orchestration |
| `src/contentScripts/views/WebdavBackupPicker.vue` | Presentational accessible version selector |
| `src/contentScripts/views/WebdavSettingsDialog.vue` | Picker session state, operation lock, status mapping |
| `src/contentScripts/views/App.vue` | Four-language labels only |
| `src/tests/*.spec.ts` | Pure, migration, protocol, orchestration, source-contract regression coverage |

## Compatibility, Rollout, and Rollback

- 升级只迁移本地路径语义；不主动批量改写远端文件。旧文件在用户下一次列表/上传时自然进入统一模型。
- 新版生成的文件仍包含版本 1 信封；旧版客户端不会自动读取它们，但原 `settings.json` 在轮转前保持原样。该任务不恢复旧版自动同步兼容。
- 如果实现验证失败，按层回滚：先 UI/文案，再 settingsSync/传输，最后纯模型/迁移；同一层的类型、调用方和测试必须一起回滚。
- 一旦用户本地路径已迁移或远端开始产生版本文件，回滚代码不得删除远端文件；旧路径定位字段应保留到兼容版本重新处理。
- 不修改 manifest、权限、自动同步生命周期、构建/发布流程或归档任务。

## External Protocol References

- [RFC 4918 — WebDAV](https://www.rfc-editor.org/rfc/rfc4918)：`PROPFIND Depth: 1`、`Multi-Status`、`MKCOL` 和单资源/集合 `DELETE` 语义。
- [RFC 3986 — URI Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986)：路径百分号编码与 URI 归一化。
- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110)：`If-None-Match: *` 和 `412 Precondition Failed`。
- [Chrome extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)：MV3 后台无长期内存和生命周期限制。
- [Chrome extension service workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)：后台不能访问 DOM。
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)：worker 上下文边界。
