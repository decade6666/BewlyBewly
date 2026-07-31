# Design: 屏蔽首页社区准则横幅

## Boundaries

| Layer | File | Responsibility |
|---|---|---|
| Storage | `src/logic/storage.ts` | `hideHomePageCommunityGuidelines: boolean`，默认 `false` |
| UI | `src/contentScripts/views/App.vue` | 浮层面板 checkbox + 四语言 `appMessages` |
| Content script | `src/contentScripts/index.ts` | watch 依赖 + option 映射 |
| Site helper | `src/sites/linuxDo.ts` | 查找 / 隐藏 / 还原横幅（纯函数） |
| Migration | `src/logic/settingsMigration.ts` | **不改**；旧键继续清理，新键不入黑名单 |
| Spec | `.trellis/spec/frontend/state-management.md` | 契约同步 |
| Tests | `src/tests/linuxDoMigration.spec.ts` 等 | 行为 + 元测试 |

## Setting key decision

- New key: `hideHomePageCommunityGuidelines`
- Old key `hideHomePageGuidelineBanner` remains in `LEGACY_SETTINGS_KEYS` and continues to be stripped
- Helper option name: `hideCommunityGuidelines`
- Hidden kind token: `community-guidelines`（不含空格，兼容 `data-bewly-home-page-hidden` 空格分隔编码）

## Data flow

```
settings.hideHomePageCommunityGuidelines
  → contentScripts/index.ts cleanupLinuxDoHomePage()
  → hideLinuxDoHomePageElements(document, url, { hideCommunityGuidelines })
  → hideCommunityGuidelinesBanner(root) | restoreHiddenElements(root, 'community-guidelines')
  → hideElement / restoreHiddenElementKind（既有原语）
```

## Selector strategy

### Layer A — structural (most specific first)

1. `#banner`
2. `#banner-content` → `closest('#banner') ?? self`
3. `.custom-banner`
4. `[data-bewly-community-guidelines]`（逃生口）

Structural hits must still contain a guidelines text signal (slogan or 《社区准则》). Banner without that signal is left alone (fail-safe).

Wrapper lift (max 2 hops): only when parent is a single-child `.container` / `.row` and passes safety checks.

### Layer B — textual fallback

1. B1: deepest element whose normalized text contains both slogan pattern and 《社区准则》
2. B2: deepest element containing only 《社区准则》

Text lift (max 4 hops): parent text equals banner text AND parent passes safety checks.

### Safety guards (any fail → do not hide / do not lift)

- Never hide: `html`, `body`, `#main-container`, `#main-outlet`, `#main-outlet-wrapper`, `#list-area`, `.discovery-layout`, `.ember-application`, `.d-header`, `.sidebar-wrapper`, `.list-controls`, `.navigation-container`, `.welcome-banner`
- Never lift into an element that still contains: `.nav-pills`, `.list-controls`, `.navigation-container`, `.topic-list`, `.topic-list-item`, `#list-area`, `#main-outlet`, `.welcome-banner`, `.search-menu`, `.d-header`, `.sidebar-wrapper`
- Normalized text length ≤ 200
- Use `element.ownerDocument.body` instead of global `document.body`

## Tradeoffs

| Choice | Why |
|---|---|
| Default off | 曾因误伤被整条删除；默认关闭避免升级后突然隐藏；既有「默认可见」测试原样通过 |
| JS hide over pure CSS inject | 需文案校验 + 与 multi-kind restore 模型一致 |
| New key not reusing legacy | 迁移层会静默删除旧键 |
| Fail-safe on structural without text | 宁可不生效也不误屏维护公告 |

## Compatibility / rollout

- WebDAV sync is blacklist-based; new field auto-syncs
- Old clients receiving new envelope ignore unknown keys via mergeDefaults
- No generated artifacts committed
