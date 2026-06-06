# BewlyLinuxDo

[English](README.md) | 简体中文

BewlyLinuxDo 是一个面向 Linux.do 的浏览器扩展，目标是优化话题列表到帖子阅读之间的浏览体验。它会保留当前话题列表页面，并在 iframe 抽屉中打开帖子，便于阅读后快速回到原列表上下文。

本项目从原 BewlyBewly 代码库迁移而来。当前产品范围仅面向 Linux.do；Bilibili 专用 UI、API 和视频相关能力不再是当前项目方向。

## 主要功能

- 在 Linux.do 话题列表页点击帖子时，用抽屉覆盖层打开帖子。
- 抽屉打开时地址栏显示当前帖子 URL，抽屉关闭后恢复列表页 URL。
- 尽量支持浏览器后退/前进来切换抽屉路由状态。
- 保持抽屉右上角操作按钮可见，保留“在新标签页打开”和“关闭”按钮。
- 隐藏 Linux.do 首页中的指定元素，包括置顶话题。
- 在 Linux.do 页面右下角提供悬浮设置按钮，用于切换首页清理选项。
- 扩展权限和内容脚本仅限定到 `https://linux.do/*`。

## 使用方式

1. 在 Chrome 或 Edge 中安装或加载扩展。
2. 打开 `https://linux.do/`、`/latest`、`/top`、`/hot` 或分类话题列表页。
3. 点击有效帖子链接，在抽屉中打开帖子。
4. 使用 `Esc`、关闭按钮或浏览器后退关闭抽屉。
5. 使用页面右下角的悬浮设置按钮启用或停用首页清理选项。

## Chrome 或 Edge 本地安装

```bash
pnpm install
pnpm build
pnpm pack:zip
```

构建完成后可选择以下方式：

- 在 `chrome://extensions` 或 `edge://extensions` 中启用开发者模式，并加载生成的 `extension/` 目录。
- 需要打包文件时，使用生成的 `extension.zip` 作为 Chromium 测试产物。

## 开发

```bash
pnpm install
pnpm dev
pnpm start:chromium
```

`pnpm start:chromium` 会启动一个 Chromium 测试配置，并打开 `https://linux.do/`。

## 验证命令

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm pack:zip
```

分发本地 Chromium 测试包时，还应检查 `extension/manifest.json`、`extension.zip`、ZIP 完整性和校验和。

## 文档

- [贡献指南](docs/CONTRIBUTING-cmn_CN.md)
- [Linux.do 迁移计划](docs/bewly-linux-do-migration-plan-cmn_CN.md)

## 非目标

BewlyLinuxDo 不实现 AI 辅助发帖、回帖生成或其他内容生成能力。项目仅用于 UI 和浏览流程改进。

## 致谢

- [BewlyBewly](https://github.com/hakadao/BewlyBewly)：原始扩展代码库。
- [vitesse-webext](https://github.com/antfu/vitesse-webext)：浏览器扩展开发模板。
