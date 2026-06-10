# 发布 v0.1.2 并上传两份构建产物

## Goal

将 BewlyLinuxDo 发布到新版本 `v0.1.2`，生成并上传两份已经打包好的发布产物，确保版本号、构建产物与上传目标一致，便于后续用户下载安装。

## What I already know

* 用户要求输出并上传新版本 `v0.1.2`。
* 用户明确要求“包含两份打包好的构建产物”。
* 用户已确认上传目标为 **GitHub Release**。
* 用户已选择由我基于本次提交自动生成简短 Release Notes。
* `package.json` 当前版本为 `0.1.1`。
* 仓库现有打包脚本支持生成这些产物：
  * `extension.zip`（Chromium ZIP）
  * `extension-firefox.zip`（Firefox ZIP）
  * `extension-firefox-sources.zip`（Firefox sources ZIP）
  * 以及 `extension.crx`、`extension.xpi`
* 仓库已有提交脚本：
  * `submit:chrome` 使用 `./extension.zip`
  * `submit:firefox` 使用 `./extension-firefox.zip` 和 `./extension-firefox-sources.zip`
* 仓库只有 CI workflow（`.github/workflows/ci.yml`），没有 GitHub Actions 里的自动 release workflow。
* 仓库存在 `.release-it.json`：
  * `after:bump` 会构建并打包 `extension.zip`、`extension-firefox.zip`、`extension-firefox-sources.zip`
  * `after:release` 会执行 `gh release upload v${version} extension.zip extension-firefox.zip`
  * `after:release` 还会继续执行 `pnpm run submit`，即同时向 Chrome/Firefox 提交流程推进

## Assumptions (temporary)

* 本次上传目标已确定为 GitHub Release，不执行浏览器商店提交。
* 本次需要上传到 GitHub Release 的两份构建产物已确认是：
  * Chromium 用的 `extension.zip`
  * Firefox 用的 `extension-firefox.zip`
* `extension-firefox-sources.zip` 本次不作为 GitHub Release 附件要求。

## Open Questions

* 暂无。

## Requirements (evolving)

* 将项目版本从 `0.1.1` 升级到 `0.1.2`。
* 生成两份打包好的发布构建产物：`extension.zip` 和 `extension-firefox.zip`。
* 创建并上传 GitHub Release `v0.1.2`。
* Release Notes 由本次提交自动整理为简短说明。
* 不执行浏览器商店提交流程。

## Acceptance Criteria (evolving)

* [ ] `package.json` 版本更新为 `0.1.2`。
* [ ] 对应构建产物 `extension.zip` 与 `extension-firefox.zip` 成功生成。
* [ ] GitHub Release `v0.1.2` 创建成功，并挂载这两份附件。
* [ ] Release Notes 使用本次提交自动整理出的简短说明。
* [ ] 最终给出产物路径/名称与上传结果。

## Definition of Done (team quality bar)

* 版本号修改已提交
* 构建命令成功完成
* 相关校验通过（至少构建与必要的基础验证）
* 上传结果可核对
* 若流程涉及第三方发布，记录明确的未覆盖边界

## Out of Scope (explicit)

* 不额外新增新的发布平台集成，除非本次需求明确要求。
* 不修改与 `v0.1.2` 无关的运行时功能。

## Technical Notes

* `package.json:5` 当前版本为 `0.1.1`。
* `package.json:26-30` 定义了现有打包脚本。
* `package.json:43-44` 定义了 Chrome/Firefox 提交脚本。
* `.github/workflows/ci.yml` 之外未发现现成 release/upload workflow。
