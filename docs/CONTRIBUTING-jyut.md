# 貢獻指南

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING-cmn_CN.md) | [官話 - 繁體中文](CONTRIBUTING-cmn_TW.md) | 廣東話

## 專案範圍

BewlyLinuxDo 係面向 Linux.do 嘅瀏覽器延伸功能。現時開發應該保留話題列表瀏覽上下文，喺 iframe 抽屜入面打開帖子，確保抽屜控制項可用，並為 Linux.do 頁面提供首頁清理設定。

唔好新增 Bilibili 專用 UI、請求改寫、影片功能，或者 AI 輔助發帖/回覆能力。除非任務明確要求改變範圍，否則延伸功能 host 權限同內容腳本應該繼續限定喺 `https://linux.do/*`。

## 開發環境

先安裝依賴：

```bash
pnpm install
```

執行 Chromium 開發流程：

```bash
# 可選：建立可重用嘅本機瀏覽器設定目錄。
mkdir web-ext-profile

# 啟動 Vite 同延伸功能建置監聽。
pnpm dev

# 打開訪問 https://linux.do/ 嘅 Chromium 測試設定。
pnpm start:chromium
```

如果瀏覽器冇自動重新載入內容腳本，請喺延伸功能重建之後刷新 Linux.do 頁面。

## Chrome 或 Edge 本機安裝

建置延伸功能並打包 Chromium ZIP：

```bash
pnpm build
pnpm pack:zip
```

然後用以下其中一種方式：

1. 打開 `chrome://extensions` 或 `edge://extensions`。
2. 啟用開發者模式。
3. 載入產生嘅 `extension/` 目錄；如果需要打包嘅 Chromium 產物，就用 `extension.zip`。

產生嘅 `extension/` 同 `extension.zip` 係本機產物，唔應該提交到 Git。

## 驗證

修改內容腳本、iframe 抽屜、首頁清理或遷移元資料時，執行 Linux.do 定向回歸測試：

```bash
pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1
```

完成源碼改動前執行倉庫檢查：

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm pack:zip
```

分發本機 Chromium 產物時，仲要確認 `extension/manifest.json` 存在、`extension.zip` 唔係空檔、ZIP 完整性通過，並記錄 SHA256 校驗和。

## 文件更新

當專案目的、功能、建置步驟、測試命令或者驗證邊界有變化時，同步更新 `README.md`、本地化 README 同 `docs/` 入面相關文件。如果中文用戶分析唔係英文規範文件，請保存喺 `*-cmn_CN.md` 文件。

## Commit 規範

除非任務明確要求，否則唔好建立 commit。需要提交時用 Conventional Commits：

```text
<type>(<scope>): <description>
```

可用類型包括 `feat`、`fix`、`refactor`、`docs`、`test`、`chore`、`perf`、`ci`。
