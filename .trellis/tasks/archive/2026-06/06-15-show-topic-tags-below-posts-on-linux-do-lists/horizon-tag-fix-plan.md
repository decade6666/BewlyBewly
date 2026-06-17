# Fix: Horizon 主题下注入 tag 不显示

## 状态

待执行（方案已核对真实代码，交由 GPT 实施）。

## 根因（已核对 `src/sites/linuxDo.ts`）

`resolveTagInsertionAnchor`（第167-179行）用 `element.querySelector(CATEGORY_LINK_SELECTOR)` 取 **DOM 顺序首个** `a[href^="/c/"]`，未过滤隐藏祖先。Horizon 主题下首个分类锚点位于被主题 CSS 隐藏的 `.link-bottom-line`（`display:none`）内，注入容器继承隐藏 → tag 不可见。

浏览器实机取证（mimo MCP）：30/30 行已注入 `[data-bewly-topic-tags]`，可见 0/30，父节点全部为 `div.link-bottom-line`（`display:none`）。

DOM 结构对比：

```
Default/MOYU:
tr.topic-list-item
  td.main-link.topic-list-data
    div.link-bottom-line          ← 可见，tag 插这里能显示
      a.badge-category__wrapper

Horizon (display: grid):
tr.topic-list-item
  td.main-link.topic-list-data
    div.link-bottom-line          ← display: none（隐藏副本）
      a.badge-category__wrapper
  td.topic-category-data          ← 可见，分类在这里，tag 应插此处
    a.badge-category__wrapper
```

> 待确认：`td.topic-category-data` 类名来自实机取证，仓库代码中无此字符串。改完**必须真机切 Horizon 主题复测**确认类名正确。

## 修改 1：新增常量（`src/sites/linuxDo.ts:54` 后）

```ts
const TOPIC_TITLE_BOTTOM_LINE_SELECTOR = '.link-bottom-line'
const TOPIC_CATEGORY_CELL_SELECTOR = 'td.topic-category-data'
```

## 修改 2：新增可见性辅助 + 替换 `resolveTagInsertionAnchor`（第167-179行整体替换）

```ts
// Walk ancestors up to (not including) boundary; treat any display:none as hidden.
// Horizon theme keeps a hidden `.link-bottom-line` copy that would swallow injected tags.
function isElementVisibleWithin(node: Element, boundary: Element): boolean {
  let current: Element | null = node

  while (current && current !== boundary) {
    if (current.ownerDocument.defaultView?.getComputedStyle(current).display === 'none')
      return false

    current = current.parentElement
  }

  return true
}

function resolveTagInsertionAnchor(element: HTMLElement): { parent: Element, refNode: Node | null } | null {
  // Prefer the first category badge whose ancestors are all visible.
  const categoryAnchors = Array.from(element.querySelectorAll<HTMLAnchorElement>(CATEGORY_LINK_SELECTOR))
  const visibleAnchor = categoryAnchors.find(anchor => isElementVisibleWithin(anchor, element))

  if (visibleAnchor?.parentElement)
    return { parent: visibleAnchor.parentElement, refNode: visibleAnchor.nextSibling }

  // Fallback: Horizon grid layout exposes the category in a separate visible cell.
  const categoryCell = element.querySelector<HTMLElement>(TOPIC_CATEGORY_CELL_SELECTOR)

  if (categoryCell)
    return { parent: categoryCell, refNode: null }

  // Final fallback: keep default/MOYU behaviour intact.
  const bottomLine = element.querySelector<HTMLElement>(TOPIC_TITLE_BOTTOM_LINE_SELECTOR)

  if (bottomLine)
    return { parent: bottomLine, refNode: null }

  return null
}
```

default/MOYU 主题下分类锚点本就可见 → 仍命中第一分支返回 `.link-bottom-line`，**行为不回归**。

## 修改 3：幂等条件兼顾「位置」（替换 `syncTopicItemTags` 第128-150行）

让已注入但落在隐藏容器的行在重渲染时能搬到正确锚点：

```ts
function syncTopicItemTags(element: HTMLElement): void {
  const desiredTags = getTopicTagNames(element)
  const existingContainer = element.querySelector<HTMLElement>(`[${INJECTED_TAG_CONTAINER_ATTR}]`)
  const currentTags = existingContainer ? getInjectedTagNames(existingContainer) : []
  const anchor = resolveTagInsertionAnchor(element)

  // compare-before-mutate: skip only when tags AND placement are unchanged,
  // so injection never retriggers the observer but misplaced containers still get relocated.
  const tagsUnchanged = areTagListsEqual(desiredTags, currentTags)
  const placementUnchanged = !existingContainer || (anchor !== null && existingContainer.parentElement === anchor.parent)

  if (tagsUnchanged && placementUnchanged)
    return

  if (existingContainer)
    existingContainer.remove()

  if (desiredTags.length === 0)
    return

  if (!anchor)
    return

  const container = buildTopicTagContainer(element.ownerDocument, desiredTags)
  anchor.parent.insertBefore(container, anchor.refNode)
}
```

## 修改 4：测试（追加到 `src/tests/linuxDoMigration.spec.ts`）

```ts
describe('Horizon theme tag anchor', () => {
  it('injects into the visible category cell when .link-bottom-line is hidden', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr class="topic-list-item tag-公告">
          <td class="main-link topic-list-data">
            <div class="link-bottom-line" style="display: none">
              <a class="badge-category__wrapper" href="/c/feedback/2">运营反馈</a>
            </div>
          </td>
          <td class="topic-category-data">
            <a class="badge-category__wrapper" href="/c/feedback/2">运营反馈</a>
          </td>
        </tr>
      </tbody></table>
    `

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/', true)

    const container = document.querySelector('[data-bewly-topic-tags]')
    expect(container).toBeTruthy()
    expect(container?.closest('.link-bottom-line')).toBeNull()
    expect(container?.closest('td.topic-category-data')).toBeTruthy()
  })

  it('keeps default/MOYU behaviour when .link-bottom-line is visible', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr class="topic-list-item tag-公告">
          <td class="main-link topic-list-data">
            <div class="link-bottom-line">
              <a class="badge-category__wrapper" href="/c/feedback/2">运营反馈</a>
            </div>
          </td>
        </tr>
      </tbody></table>
    `

    renderLinuxDoHomePageTopicTags(document, 'https://linux.do/', true)

    const container = document.querySelector('[data-bewly-topic-tags]')
    expect(container).toBeTruthy()
    expect(container?.closest('.link-bottom-line')).toBeTruthy()
  })
})
```

jsdom 的 `getComputedStyle` 能反映 inline `display:none`，隐藏夹具用 `style="display: none"` 即可触发可见性过滤。

## 验证

```bash
pnpm test        # vitest，两条新用例 + 原有用例全过
pnpm typecheck   # vue-tsc
pnpm lint        # eslint
```

之后 `pnpm build` 加载扩展，**切 Horizon 主题真机复测**（确认 `td.topic-category-data` 类名、tag 可见、容器父节点非 `.link-bottom-line`），再切回 MOYU/Default 确认无回归。
