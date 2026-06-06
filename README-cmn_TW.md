# BewlyLinuxDo

[English](README.md) | [简体中文](README-cmn_CN.md) | 繁體中文 | [廣東話](README-jyut.md)

BewlyLinuxDo 是一個面向 Linux.do 的瀏覽器擴充功能，目標是改善話題列表到帖子閱讀之間的瀏覽體驗。它會保留目前話題列表頁面，並在 iframe 抽屜中開啟帖子，方便閱讀後快速回到原列表上下文。

本專案從原 BewlyBewly 程式碼庫遷移而來。當前產品範圍僅面向 Linux.do；Bilibili 專用 UI、API 和影片相關能力不再是目前專案方向。

## 主要功能

- 在 Linux.do 話題列表頁點擊帖子時，用抽屜覆蓋層開啟帖子。
- 抽屜開啟時網址列顯示目前帖子 URL，抽屜關閉後恢復列表頁 URL。
- 盡量支援瀏覽器上一頁/下一頁切換抽屜路由狀態。
- 保持抽屜右上角操作按鈕可見，保留「在新分頁開啟」和「關閉」按鈕。
- 隱藏 Linux.do 首頁中的指定元素，包括社群準則橫幅和置頂話題。
- 在 Linux.do 頁面右下角提供浮動設定按鈕，用於切換首頁清理選項。
- 擴充功能權限和內容腳本僅限定到 `https://linux.do/*`。

## 使用方式

1. 在 Chrome 或 Edge 中安裝或載入擴充功能。
2. 開啟 `https://linux.do/`、`/latest`、`/top`、`/hot` 或分類話題列表頁。
3. 點擊有效帖子連結，在抽屜中開啟帖子。
4. 使用 `Esc`、關閉按鈕或瀏覽器上一頁關閉抽屜。
5. 使用頁面右下角的浮動設定按鈕啟用或停用首頁清理選項。

## Chrome 或 Edge 本機安裝

```bash
pnpm install
pnpm build
pnpm pack:zip
```

建置完成後可選擇以下方式：

- 在 `chrome://extensions` 或 `edge://extensions` 中啟用開發者模式，並載入生成的 `extension/` 目錄。
- 需要打包檔案時，使用生成的 `extension.zip` 作為 Chromium 測試產物。

## 開發

```bash
pnpm install
pnpm dev
pnpm start:chromium
```

`pnpm start:chromium` 會啟動一個 Chromium 測試設定，並開啟 `https://linux.do/`。

## 驗證命令

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm pack:zip
```

分發本機 Chromium 測試包時，還應檢查 `extension/manifest.json`、`extension.zip`、ZIP 完整性和校驗和。

## 文件

- [貢獻指南](docs/CONTRIBUTING-cmn_TW.md)
- [Linux.do 遷移計畫](docs/bewly-linux-do-migration-plan-cmn_CN.md)

## 非目標

BewlyLinuxDo 不實作 AI 輔助發帖、回覆生成或其他內容生成能力。專案僅用於 UI 和瀏覽流程改善。

## 致謝

- [BewlyBewly](https://github.com/hakadao/BewlyBewly)：原始擴充功能程式碼庫。
- [vitesse-webext](https://github.com/antfu/vitesse-webext)：瀏覽器擴充功能開發模板。
