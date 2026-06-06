# BewlyLinuxDo

[English](README.md) | [简体中文](README-cmn_CN.md) | [官話 - 繁體中文](README-cmn_TW.md) | 廣東話

BewlyLinuxDo 係一個面向 Linux.do 嘅瀏覽器延伸功能，目標係改善由話題列表去帖子閱讀嘅瀏覽流程。佢會保留目前嘅話題列表頁面，並喺 iframe 抽屜入面打開帖子，方便睇完之後快速返到原本列表上下文。

呢個專案由原本 BewlyBewly 程式碼庫遷移而來。現時產品範圍只面向 Linux.do；Bilibili 專用 UI、API 同影片相關功能唔再係目前專案方向。

## 主要功能

- 喺 Linux.do 話題列表頁撳帖子時，用抽屜覆蓋層打開帖子。
- 抽屜打開時網址列顯示目前帖子 URL，抽屜關閉後恢復列表頁 URL。
- 盡量支援瀏覽器上一頁/下一頁切換抽屜路由狀態。
- 保持抽屜右上角操作按鈕可見，保留「喺新分頁打開」同「關閉」按鈕。
- 隱藏 Linux.do 首頁指定元素，包括社群準則橫幅同置頂話題。
- 喺 Linux.do 頁面右下角提供浮動設定按鈕，用嚟切換首頁清理選項。
- 延伸功能權限同內容腳本只限定到 `https://linux.do/*`。

## 使用方式

1. 喺 Chrome 或 Edge 入面安裝或載入延伸功能。
2. 打開 `https://linux.do/`、`/latest`、`/top`、`/hot` 或分類話題列表頁。
3. 撳有效帖子連結，喺抽屜入面打開帖子。
4. 用 `Esc`、關閉按鈕或瀏覽器上一頁關閉抽屜。
5. 用頁面右下角嘅浮動設定按鈕啟用或停用首頁清理選項。

## Chrome 或 Edge 本機安裝

```bash
pnpm install
pnpm build
pnpm pack:zip
```

建置完成之後可以揀以下方式：

- 喺 `chrome://extensions` 或 `edge://extensions` 啟用開發者模式，然後載入產生嘅 `extension/` 目錄。
- 需要打包檔案時，用產生嘅 `extension.zip` 作為 Chromium 測試產物。

## 開發

```bash
pnpm install
pnpm dev
pnpm start:chromium
```

`pnpm start:chromium` 會啟動一個 Chromium 測試設定，並打開 `https://linux.do/`。

## 驗證命令

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm pack:zip
```

分發本機 Chromium 測試包時，仲應該檢查 `extension/manifest.json`、`extension.zip`、ZIP 完整性同校驗和。

## 文件

- [貢獻指南](docs/CONTRIBUTING-jyut.md)
- [Linux.do 遷移計畫](docs/bewly-linux-do-migration-plan-cmn_CN.md)

## 非目標

BewlyLinuxDo 唔實作 AI 輔助發帖、回覆生成或者其他內容生成功能。專案只用於 UI 同瀏覽流程改善。

## 致謝

- [BewlyBewly](https://github.com/hakadao/BewlyBewly)：原始延伸功能程式碼庫。
- [vitesse-webext](https://github.com/antfu/vitesse-webext)：瀏覽器延伸功能開發模板。
