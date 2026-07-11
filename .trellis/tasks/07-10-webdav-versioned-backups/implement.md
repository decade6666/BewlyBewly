# WebDAV 版本化备份实施计划

## Preconditions

- 当前任务必须保持 `planning`；只有用户审阅并明确批准本任务的 `prd.md`、`design.md` 与本文件后，才运行 `task.py start`。
- 实施代理按 `implement.jsonl` → `prd.md` → `design.md` → `implement.md` 的顺序加载上下文，并在写代码前运行 `trellis-before-dev`。
- 严格执行 TDD：每一批先提交可观察的失败测试（RED），再写最小实现（GREEN），最后只在本批范围内整理（REFACTOR）。
- 不新增依赖、扩展权限、构建脚本或远端信封版本；不恢复自动同步。
- 一次只允许一个写入者修改同一文件；后续批次依赖前一批测试转绿后再开始。

## Batch 0 — Baseline and scope lock

1. 确认工作区只包含当前任务预期改动：
   - `git status --short --untracked-files=all`
   - `git diff --check`
2. 读取当前实现和测试基线：
   - `src/logic/webdavSettings.ts`
   - `src/logic/settingsMigration.ts`
   - `src/logic/storage.ts`
   - `src/logic/webdav.ts`
   - `src/logic/settingsSync.ts`
   - `src/background/messageListeners/webdav.ts`
   - `src/contentScripts/views/WebdavSettingsDialog.vue`
   - `src/contentScripts/views/App.vue`
3. 运行实施前基线；若失败，先记录并停止，不能把基线失败归因于本任务：

```bash
pnpm exec vitest run src/tests/webdavSettings.spec.ts src/tests/settingsSync.spec.ts src/tests/linuxDoMigration.spec.ts
pnpm typecheck
```

## Batch 1 — Directory model, migration, and pure backup functions

### RED

先新增或修改以下测试：

- `src/tests/webdavSettings.spec.ts`
  - 默认路径为 `/bewly/`。
  - 空白、相对目录、无尾斜杠目录均规范化为带首尾 `/` 的目录形式。
  - `.`/`..` 路径段、控制字符和无法安全编码的目录返回 `path_invalid`；Save/Test 在发出后台消息前失败。
  - `WebdavValidationError` 包含 `path_invalid`，且保存/测试草稿在发送后台消息前返回该错误；四语言文案、字段聚焦与 ARIA 关联属于 Batch 3 的 UI 契约测试，不能阻塞本批纯逻辑转绿。
  - 规范化和合并返回新对象，不原地修改输入。
  - 草稿不暴露本地隐藏字段 `webdavLegacyFilePath`。
  - 用户保存不同目录时清除旧文件定位；目录不变时保留它。
- 新增 `src/tests/settingsMigration.spec.ts`
  - 旧默认 `/bewly/settings.json` 迁移为 `/bewly/` 并记录原路径。
  - 自定义单文件、相对单文件和根目录边界均正确迁移。
  - 已是目录的值保持目录语义，迁移重复执行保持幂等。
  - 字符串和对象形态的本地存储都完成迁移，并继续删除 `webdavAutoSync` 与 `webdavLocalModifiedTime`，不丢失其他字段。
- 新增 `src/tests/webdavBackups.spec.ts`
  - 生成和解析 `bewly-settings-YYYYMMDDTHHmmss.SSSZ-NNNN.json`；用正则 + `Date.UTC` 严格解析基本 UTC 格式，不依赖 `Date.parse()` 自动兼容或日期进位。
  - 同毫秒序号可稳定排序，非法名称不被识别为受管理文件。
  - `PROPFIND` XML 解析跳过目录自身和子目录，只保留直接子文件。
  - 兼容绝对 URI/绝对路径 `href`、`d:`/`D:`/默认命名空间、多个 `propstat`、百分号编码和 XML 实体。
  - 拒绝跨源、越出目标目录、非法 XML 和不可归一化路径。
  - 新版文件与已知 legacy 文件合并、按时间从新到旧排序；非托管文件始终忽略。
  - 21 份和 22+ 份时返回全部超额的最旧文件；输入数组不被修改。
  - legacy 只有在 GET 得到有效版本 1 信封时才使用其 `timestamp` 排序；`getlastmodified` 仅供诊断。
  - legacy 404 会清理定位；网络/JSON/信封错误返回 `legacy_unreadable` 警告但不阻断健康版本，也不把时间未知的旧文件加入删除计划。

先确认测试因能力缺失而失败：

```bash
pnpm exec vitest run src/tests/webdavSettings.spec.ts src/tests/settingsMigration.spec.ts src/tests/webdavBackups.spec.ts
```

### GREEN

最小实现范围：

- `src/logic/webdavSettings.ts`
  - 更新共享默认目录常量。
  - 增加目录路径规范化与 `path_invalid` 验证；保存时只清理与旧目录不再匹配的 legacy 定位。
- `src/logic/storage.ts`
  - 新增本地字段 `webdavLegacyFilePath: string`，默认空串。
  - 默认 `webdavPath` 使用 `/bewly/`。
- `src/logic/settingsMigration.ts`
  - 将旧单文件路径不可变地迁移为目录 + legacy 原路径；保持字符串存储格式和现有旧键清理。
- 新增 `src/logic/webdavBackups.ts`
  - 集中目录/文件名常量、路径拼接、XML 解析、备份建模、过滤排序和轮转计划。
  - XML 解析运行在内容脚本 DOM 上下文，不放进 MV3 service worker。
- `src/logic/index.ts`
  - 仅导出调用方实际需要的新增公共类型/函数。

### Batch gate

```bash
pnpm exec vitest run src/tests/webdavSettings.spec.ts src/tests/settingsMigration.spec.ts src/tests/webdavBackups.spec.ts
pnpm exec eslint src/logic/webdavSettings.ts src/logic/settingsMigration.ts src/logic/storage.ts src/logic/webdavBackups.ts src/logic/index.ts src/tests/webdavSettings.spec.ts src/tests/settingsMigration.spec.ts src/tests/webdavBackups.spec.ts
pnpm typecheck
```

**Rollback point A:** 只回退本批模型、迁移、纯函数及对应测试；不得影响网络/UI 文件。

## Batch 2 — Background protocol and synchronization orchestration

### RED

先新增或扩充：

- 新增 `src/tests/webdav.spec.ts`
  - `LIST` 对目录执行 `PROPFIND Depth: 1` 并返回原始 XML。
  - `DELETE` 只删除指定单文件；目录路径被拒绝；并发清理产生的 `404` 按幂等成功处理。
  - create-only `PUT` 带 `If-None-Match: *`，碰撞状态不退化为无条件覆盖。
  - 路径按段编码，认证头、现有 TEST 和普通错误信息保持不变。
- 扩充 `src/tests/settingsSync.spec.ts`
  - `listSettingsBackups()` 解析目录、GET/校验已知 legacy，并从新到旧返回摘要；legacy 不可读时仍返回健康列表 + `legacy_unreadable` 警告。
  - 首次上传创建唯一版本 1 文件并更新最后同步时间。
  - 同毫秒碰撞追加序号重试；固定 `MAX_BACKUP_NAME_ATTEMPTS = 10`，只尝试 `0001` 至 `0010`，耗尽后返回 `upload_collision_exhausted`。
  - 上传失败不发删除；上传成功后列举完整集合并逐个删除全部超额项。
  - 清理列举或删除部分失败返回 `ok: true` + `warning: 'cleanup_partial'`，保留新备份并更新最后同步时间。
  - 下一次成功上传基于完整列表再次清理所有超额项。
  - legacy 被删除或在成功列表中确认不存在后清理本地定位字段；不可读 legacy 保留定位、不参与删除，并让上传清理返回部分成功。
  - 上传信封明确不包含 `webdavLegacyFilePath`，并继续排除全部本机 WebDAV 配置字段。
  - 按选定路径恢复，显式保留 `webdavLegacyFilePath` 及本机其他 WebDAV 字段，并使用所选信封时间戳。
  - 空目录、非法列表、选中项消失、JSON 错误和不支持版本不改变本地数据。

```bash
pnpm exec vitest run src/tests/webdav.spec.ts src/tests/settingsSync.spec.ts
```

### GREEN

最小实现范围：

- `src/logic/webdav.ts`
  - 在现有背景消息体系中增加 LIST 和 DELETE 包装/真实请求。
  - 上传支持 create-only；列举仅返回结构化克隆可传输的原始 XML 字符串。
  - 保留连接测试和后台 CORS 边界。
- `src/background/messageListeners/webdav.ts`
  - 为 LIST/DELETE 增加显式分发，不改变监听注册方式。
- `src/logic/settingsSync.ts`
  - 新增备份摘要列表 API。
  - 将 `webdavLegacyFilePath` 同时加入 `WEBDAV_FIELDS`/`WEBDAV_FIELD_SET` 和 `retainedWebdavFields()`，分别证明它不会上传且恢复后不会丢失。
  - 上传按“建信封 → 唯一创建 → 重新列举 → 计算并执行删除计划”编排。
  - 下载必须接受列表中选定的受管理备份标识，并在 GET 前重新验证它仍属于当前目录或已知 legacy。
  - 抽取版本 1 信封解析/校验，供恢复和 legacy 时间解析复用。
  - 用可区分的成功、部分成功、完全失败结果表达实际远端状态。

### Batch gate

```bash
pnpm exec vitest run src/tests/webdav.spec.ts src/tests/settingsSync.spec.ts src/tests/webdavBackups.spec.ts
pnpm exec eslint src/logic/webdav.ts src/logic/settingsSync.ts src/background/messageListeners/webdav.ts src/tests/webdav.spec.ts src/tests/settingsSync.spec.ts
pnpm typecheck
```

**Rollback point B:** 在保留 Batch 1 目录迁移的前提下，可整体回退 LIST/DELETE、版本上传和 settingsSync 编排。

## Batch 3 — Backup picker UI and localized states

`WebdavSettingsDialog.vue` 当前约 765 行；不得直接堆入完整列表模板和样式使其继续膨胀。新增一个无网络副作用的展示组件，把选择 DOM 与样式从主对话框中拆出。

### RED

- 新增 `src/tests/webdavVersionedBackupsContract.spec.ts`
  - `App.vue` 的四套 `appMessages` 均包含路径无效、列表加载、空列表、列举失败、legacy 标记/不可读警告、恢复所选版本、选中项消失和清理警告文案。
  - 新展示组件使用带显式 `<label>` 的原生 `<select>`（或等价原生单选语义），显示本地日期时间，发出 select/confirm/cancel 事件，不调用网络。
  - 主对话框点击“下载”后先列举；默认选中最新；改变选择只更新本地状态；确认时才调用所选版本恢复。
  - 覆盖警告在选择区域持续存在，空列表、列举失败、下载失败和部分成功状态互不混淆。
  - 列表成功切换到选择器后，`nextTick` 显式把焦点移到选择器首个控件；列表失败、空列表或取消选择器后，焦点回到 `downloadButtonRef`，不可用时回退关闭按钮。任何分支都不能让焦点落回页面主体。
  - 现有 `role="dialog"`、`aria-modal`、ShadowRoot 焦点解析、Tab 闭环、capture-phase Escape、父面板 `inert` 和关闭后焦点恢复合同不退化。
- 最小更新 `src/tests/linuxDoMigration.spec.ts`
  - 新默认路径、legacy 本地字段、LIST/DELETE 消息与背景分发被源码合同覆盖。
  - `<all_urls>`、版本 1 信封、后台传输和自动同步已删除的边界继续成立。

```bash
pnpm exec vitest run src/tests/webdavVersionedBackupsContract.spec.ts src/tests/linuxDoMigration.spec.ts
```

### GREEN

- 新增 `src/contentScripts/views/WebdavBackupPicker.vue`
  - 纯展示备份选项、legacy 标签/不可读警告、覆盖警告和确认/取消操作。
  - 不读取全局设置，不发网络请求；通过 ref/`defineExpose` 提供 `focusFirstControl()`。
- 修改 `src/contentScripts/views/WebdavSettingsDialog.vue`
  - 保持唯一的操作锁所有权；区分列表加载与实际恢复阶段。
  - 列表结果绑定到当前对话框会话；关闭时丢弃未展示的晚到列表结果；成功渲染选择器后在 `nextTick` 调用其 `focusFirstControl()`。
  - 新增 `downloadButtonRef`；列表失败/空列表和选择器取消后用统一 helper 恢复焦点，按钮不可用时回退 `closeButtonRef`。
  - 将 URL 专用错误 helper 改为字段感知分派，并给路径输入增加 `pathInputRef`、`aria-invalid`、`aria-describedby` 与独立错误节点。
  - 已开始的实际恢复仍按现有持久传输语义完成并保留状态。
  - 编辑/保存端点时关闭并清空旧选择，避免对过期目录执行恢复。
- 修改 `src/contentScripts/views/App.vue`
  - 只增加四语言必要文案并传入对话框；不重构无关的大型组件区域。
- 如结果类型需要，仅对 `src/logic/settingsSync.ts` 做签名对齐，不在 UI 批次重写编排逻辑。

### Batch gate

```bash
pnpm exec vitest run src/tests/webdavVersionedBackupsContract.spec.ts src/tests/linuxDoMigration.spec.ts src/tests/settingsSync.spec.ts
pnpm exec eslint src/contentScripts/views/WebdavBackupPicker.vue src/contentScripts/views/WebdavSettingsDialog.vue src/contentScripts/views/App.vue src/tests/webdavVersionedBackupsContract.spec.ts src/tests/linuxDoMigration.spec.ts
pnpm typecheck
```

**Rollback point C:** 回退展示组件、对话框状态和文案即可恢复旧 UI；不要只回退 UI 而保留调用不存在的签名。

## Batch 4 — Bounded refactor and convergence

仅做以下整理：

- 将错误码到 UI 状态的映射收口为小函数。
- 将 XML 解析、过滤、排序和轮转拆为小于 50 行的纯函数。
- 复用 WebDAV URL、认证头和 fetch 结果处理，但保持 TEST 语义不变。
- 使用新数组/对象完成排序和合并，不原地修改输入。
- 检查主对话框仍低于 800 行或至少未因本功能突破该边界；不得借机重构 `App.vue` 其他区域。

```bash
pnpm exec vitest run src/tests/webdavSettings.spec.ts src/tests/settingsMigration.spec.ts src/tests/webdavBackups.spec.ts src/tests/webdav.spec.ts src/tests/settingsSync.spec.ts src/tests/webdavVersionedBackupsContract.spec.ts src/tests/linuxDoMigration.spec.ts
```

## Full verification and quality gates

### Static and test gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm knip
pnpm build
git diff --check
git status --short --untracked-files=all
```

- `pnpm build-firefox` 只在用户明确要求 Firefox 验证或实现阶段发现 Firefox 专属回归风险时追加；本任务默认不生成未请求的平台产物。
- 当前仓库未安装 Vitest coverage provider；不得在本任务中擅自新增依赖。所有新增纯函数、错误分支和跨层结果必须有明确测试落点，并在最终报告中如实标记“未运行量化覆盖率”。若交付前必须取得数值覆盖率，先暂停并单独取得新增 devDependency 的授权。
- 构建生成的 `extension/`、`extension-firefox/` 等产物保持忽略，不进入提交范围。

### Required review gates after code changes

1. 每轮编辑后先运行 `trellis-check`，对照 PRD/design/implement 自行修复并复跑受影响测试；最终一轮执行全范围检查。
2. 因改动超过 30 行且涉及远端 XML/路径验证与带凭据网络请求，再依次运行全局质量门：
   - `/ccg:verify-change`
   - `/ccg:verify-quality src/logic src/contentScripts/views src/background`
   - `/ccg:verify-security src/logic/webdav.ts src/logic/settingsSync.ts src/background/messageListeners/webdav.ts`
3. 代码审查代理检查正确性、边界、不可变性和复用；Critical/High 问题必须修复并重新进入 `trellis-check`。
4. `verify` 驱动真实受影响流程，不能只用单测/typecheck 代替运行时观察。
5. Finish 阶段运行 `trellis-update-spec`，判断本次实现是否产生应固化的 WebDAV/对话框约定；随后按 Trellis Phase 3 完成最终检查和任务收尾。额外 CCG 门禁不能替代 Trellis 必需步骤。

### Real-extension verification

1. `pnpm build` 后，把最新 `extension/` 通过项目规范描述的 CDP `Extensions.loadUnpacked` 加载到专用有头 Chromium 配置，不使用默认禁用扩展的 MCP 浏览器。
2. 打开 `https://linux.do/`，穿透 `#bewly` Shadow Root 验证：
   - 默认目录 `/bewly/`；
   - 对话框焦点进入、Tab/Shift+Tab、Escape、父面板 `inert`、关闭后焦点恢复；
   - 列表成功聚焦选择器，列表失败/空列表/取消后聚焦下载按钮或关闭按钮；路径错误聚焦并关联路径输入；
   - 下载先列举，默认最新，切换选择不恢复，确认后恢复所选版本；
   - 空列表、列举失败、选中项消失、下载失败和部分清理成功使用不同反馈。
3. 使用临时、本机、非仓库内的 WebDAV 夹具服务器（不得新增项目依赖或脚本）验证：
   - 连续两次上传生成两个文件；
   - 同毫秒碰撞不覆盖；
   - 20 → 21 后只剩最新 20；
   - 非托管文件不删除；
   - legacy 可见、可恢复并参与轮转；
   - 删除失败时显示部分成功，下次上传重试收敛。
4. 若登录、Cloudflare、浏览器权限或本机环境阻塞真实验证，明确记录阻塞点和已经完成的替代验证，不声称已完成实时 DOM 检查。

## Risk matrix

| Area | Risk | Mitigation |
|---|---|---|
| `src/logic/webdav.ts` | 认证头、路径编码和新方法会影响全部 WebDAV 请求 | 协议层 fetch 单测；保持 TEST 分支不变；路径/状态显式校验 |
| `src/logic/settingsSync.ts` | 版本 1 应用、最后同步时间和部分成功易产生错误状态 | 编排测试覆盖完全成功/部分成功/完全失败；本地配置不可变保留 |
| `src/logic/settingsMigration.ts` / `storage.ts` | 升级数据迁移错误可能丢失旧路径 | 字符串/对象/幂等测试；保留原文件路径；改变目录才清除 |
| `WebdavSettingsDialog.vue` | 异步晚到结果、操作锁和焦点可能回归 | 会话令牌、展示组件拆分、源码合同和真实浏览器验证 |
| WebDAV interoperability | 各服务商的 XML、href 和条件 PUT 状态存在差异 | RFC 兼容解析、create-only 不降级、明确错误、真实服务商后续验证 |

## Files intentionally out of scope

- `src/manifest.ts`：不改变权限或后台形态。
- `src/contentScripts/index.ts`：不恢复自动同步或改首页清理。
- `src/_locales/*.yml`：当前 WebDAV 对话框文案由 `App.vue` 的 `appMessages` 管理。
- `package.json`、`vite.config.ts`、构建/发布脚本：不新增依赖或改变流程。
- `.trellis/tasks/archive/**`：只读参考，不修改。
- 远端 `SyncEnvelope`：保持 `version: 1` 与现有字段。
