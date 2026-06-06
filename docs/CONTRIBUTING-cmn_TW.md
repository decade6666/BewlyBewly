# 貢獻指南

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING-cmn_CN.md) | 繁體中文 | [廣東話](CONTRIBUTING-jyut.md)

## 專案範圍

BewlyLinuxDo 是面向 Linux.do 的瀏覽器擴充功能。當前開發應保持話題列表瀏覽上下文，在 iframe 抽屜中開啟帖子，確保抽屜控制項可用，並為 Linux.do 頁面提供首頁清理設定。

不要新增 Bilibili 專用 UI、請求改寫、影片功能，或 AI 輔助發帖/回覆能力。除非任務明確要求改變範圍，否則擴充功能 host 權限和內容腳本應繼續限定在 `https://linux.do/*`。

## 開發環境

先安裝依賴：

```bash
pnpm install
```

執行 Chromium 開發流程：

```bash
# 可選：建立可重複使用的本機瀏覽器設定目錄。
mkdir web-ext-profile

# 啟動 Vite 和擴充功能建置監聽。
pnpm dev

# 開啟訪問 https://linux.do/ 的 Chromium 測試設定。
pnpm start:chromium
```

如果瀏覽器沒有自動重新載入內容腳本，請在擴充功能重建後重新整理 Linux.do 頁面。

## Chrome 或 Edge 本機安裝

建置擴充功能並打包 Chromium ZIP：

```bash
pnpm build
pnpm pack:zip
```

然後使用以下方式之一：

1. 開啟 `chrome://extensions` 或 `edge://extensions`。
2. 啟用開發者模式。
3. 載入生成的 `extension/` 目錄；如需要打包的 Chromium 產物，則使用 `extension.zip`。

生成的 `extension/` 和 `extension.zip` 是本機產物，不應提交到 Git。

## 驗證

修改內容腳本、iframe 抽屜、首頁清理或遷移元資料時，執行 Linux.do 定向回歸測試：

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
```

完成原始碼改動前執行倉庫檢查：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm pack:zip
```

分發本機 Chromium 產物時，還要確認 `extension/manifest.json` 存在、`extension.zip` 非空、ZIP 完整性通過，並記錄 SHA256 校驗和。

## 文件更新

當專案目的、功能、建置步驟、測試命令或驗證邊界變化時，同步更新 `README.md`、本地化 README 和 `docs/` 下的相關文件。若中文使用者分析不是英文規範文件，請保存在 `*-cmn_CN.md` 文件中。

## Commit 規範

除非任務明確要求，否則不要建立 commit。需要提交時使用 Conventional Commits：

```text
<type>(<scope>): <description>
```

可用類型包括 `feat`、`fix`、`refactor`、`docs`、`test`、`chore`、`perf`、`ci`。
