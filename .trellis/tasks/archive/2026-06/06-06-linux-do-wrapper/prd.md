# 延迟渲染 Linux.do 抽屉全屏 wrapper

## Goal

根据用户提供的浏览器测试与源码分析结果，降低 Linux.do 默认访问时被内容脚本全屏最高层容器覆盖的风险：默认不挂载 `#bewly-wrapper`，仅在用户点击话题并准备打开 iframe 抽屉时渲染 wrapper / drawer；同时用测试锁定该约束，并避免 Vite AutoImport 在测试与生产构建阶段写 `src/auto-imports.d.ts`。

## What I already know

* 用户已提供明确改动目标：`App.vue`、`linuxDoMigration.spec.ts`、`vite.config.ts`。
* 当前 `src/contentScripts/views/App.vue` 默认始终渲染 `#bewly-wrapper`，其样式为 `position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;`。
* 当前 `src/tests/linuxDoMigration.spec.ts` 已覆盖 Linux.do 内容脚本边界，但尚未锁定 wrapper 只能在 `showIframeDrawer` 为真时渲染。
* 当前 `vite.config.ts` 的 `AutoImport` 未配置 `dts`，可能在测试或生产构建阶段写默认类型声明文件。
* `package.json` 已有验证脚本：`typecheck`、`lint`、`build`、`pack:zip`；相关单测可通过 `pnpm exec vitest run src/tests/linuxDoMigration.spec.ts ...` 执行。

## Requirements

* 默认访问 Linux.do 时，内容脚本挂载 App 后不能渲染最高层全屏 `#bewly-wrapper`。
* 用户点击有效 Linux.do 话题链接、`showIframeDrawer` 变为 `true` 时，才渲染 `#bewly-wrapper` 与抽屉内容。
* 测试中增加源码级约束，防止未来回退为默认渲染全屏 wrapper。
* `AutoImport` 仅在真实开发模式生成 `src/auto-imports.d.ts`，测试和生产构建不写该文件。
* 不做无关重构，不改变 iframe 抽屉既有交互行为。

## Acceptance Criteria

* [ ] `src/contentScripts/views/App.vue` 的 `#bewly-wrapper` 使用 `v-if="showIframeDrawer"` 或等价方式延迟渲染。
* [ ] `src/tests/linuxDoMigration.spec.ts` 覆盖 wrapper 延迟渲染约束。
* [ ] `vite.config.ts` 中 `AutoImport` 明确限制 dts 生成条件。
* [ ] `pnpm exec vitest run src/tests/linuxDoMigration.spec.ts --reporter=verbose --pool=threads --maxWorkers=1 --minWorkers=1` 通过。
* [ ] `pnpm typecheck` 通过。
* [ ] `pnpm lint` 通过。
* [ ] `pnpm build` 通过。
* [ ] `pnpm pack:zip` 通过。

## Definition of Done

* 只修改本任务相关文件与验证产物。
* 代码风格保持现有 Vue/Vite 测试风格。
* 如构建出现既有警告，交付时明确列出且区分是否与本次改动相关。
* 不主动提交；最终报告包含改动路径与验证结果。

## Technical Approach

* 在 `App.vue` 模板层将顶层 `#bewly-wrapper` 绑定到 `showIframeDrawer`，避免默认挂载全屏 fixed 容器。
* 在迁移测试中读取 `App.vue` 源码，断言 `id="bewly-wrapper"` 与 `v-if="showIframeDrawer"` 同处于顶层 wrapper 标签，并保留现有 Linux.do 边界约束。
* 在 `vite.config.ts` 的 AutoImport 配置中增加 `dts: isDev ? r('src/auto-imports.d.ts') : false`，复用现有 `isDev` 与 `r()` 工具。

## Decision (ADR-lite)

**Context**: 默认挂载最高 z-index 全屏 wrapper 在异常样式/合成层/子节点状态下有覆盖整页风险。
**Decision**: 采用最小变更，在 Vue 条件渲染层直接延迟挂载 wrapper，而不是仅调整 CSS 或添加额外运行时守卫。
**Consequences**: 默认页面 DOM 更少、覆盖风险降低；抽屉打开时仍保留原有最高层覆盖能力。该方案依赖 `showIframeDrawer` 成为 wrapper 唯一可见入口，已用测试锁定。

## Out of Scope

* 不修复自动化 Chrome 未登记本地扩展的问题。
* 不改 Linux.do 话题识别逻辑。
* 不改 iframe sandbox、历史记录、ESC 行为或抽屉 UI。
* 不处理与本次黑屏风险无直接关系的既有构建警告。

## Technical Notes

* Inspected: `src/contentScripts/views/App.vue`
* Inspected: `src/tests/linuxDoMigration.spec.ts`
* Inspected: `vite.config.ts`
* Inspected: `package.json`
