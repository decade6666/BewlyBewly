# 贡献指南

[English](CONTRIBUTING.md) | 简体中文

## 项目范围

BewlyLinuxDo 是面向 Linux.do 的浏览器扩展。当前开发应保持话题列表浏览上下文，在 iframe 抽屉中打开帖子，确保抽屉控件可用，并为 Linux.do 页面提供首页清理设置。

不要新增 Bilibili 专用 UI、请求改写、视频功能，或 AI 辅助发帖/回帖能力。除非任务明确要求改变范围，否则扩展 host 权限和内容脚本应继续限定在 `https://linux.do/*`。

## 开发环境

先安装依赖：

```bash
pnpm install
```

运行 Chromium 开发流程：

```bash
# 可选：创建可复用的本地浏览器配置目录。
mkdir web-ext-profile

# 启动 Vite 和扩展构建监听。
pnpm dev

# 打开访问 https://linux.do/ 的 Chromium 测试配置。
pnpm start:chromium
```

如果浏览器没有自动重新加载内容脚本，请在扩展重建后刷新 Linux.do 页面。

## Chrome 或 Edge 本地安装

构建扩展并打包 Chromium ZIP：

```bash
pnpm build
pnpm pack:zip
```

然后使用以下方式之一：

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 启用开发者模式。
3. 加载生成的 `extension/` 目录；如需要打包的 Chromium 产物，则使用 `extension.zip`。

生成的 `extension/` 和 `extension.zip` 是本地产物，不应提交到 Git。

## 验证

修改内容脚本、iframe 抽屉、首页清理或迁移元数据时，运行 Linux.do 定向回归测试：

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
```

完成源码改动前运行仓库检查：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm pack:zip
```

分发本地 Chromium 产物时，还要确认 `extension/manifest.json` 存在、`extension.zip` 非空、ZIP 完整性通过，并记录 SHA256 校验和。

## 文档更新

当项目目的、功能、构建步骤、测试命令或验证边界变化时，同步更新 `README.md`、`README-cmn_CN.md` 和 `docs/` 下的相关文件。若中文用户分析不是英文规范文档，请保存在 `*-cmn_CN.md` 文件中。

## Commit 规范

除非任务明确要求，否则不要创建 commit。需要提交时使用 Conventional Commits：

```text
<type>(<scope>): <description>
```

可用类型包括 `feat`、`fix`、`refactor`、`docs`、`test`、`chore`、`perf`、`ci`。
