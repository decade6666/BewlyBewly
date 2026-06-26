You are implementing a feature in this repo (BewlyLinuxDo, a Vue 3 + TypeScript browser extension for linux.do). Work autonomously and make the code changes yourself.

## Required reading first (read these files before coding)
- `.trellis/tasks/06-26-refresh-post-list-only/prd.md` — the confirmed requirements, decisions (D1/D2/D3), acceptance criteria, and implementation plan.
- `.trellis/tasks/06-26-refresh-post-list-only/research/discourse-list-refresh.md` — Discourse selectors, refetch behavior, ISOLATED-world constraints, and fallback strategy.
- `src/contentScripts/views/App.vue` — the floating button + `handleScrollActionClick` (currently does `window.location.reload()`).
- `src/sites/linuxDo.ts` — existing site helpers incl. `isLinuxDoTopicListPage(url)`; you will add a new exported function here.
- Existing tests under `src/tests/` (e.g. `uriParse.spec.ts`) — match their structure/style for the new test.

## Goal
The right-bottom floating button in `App.vue` currently calls `window.location.reload()` when the page is at the top. Change it so that **on Discourse topic-list pages** it refreshes ONLY the topic list in-place (no full page reload, URL unchanged), via DOM interaction (Approach A). Keep full reload as fallback and on non-list pages.

## Change 1 — `src/sites/linuxDo.ts`
Add an exported function:

```ts
// Try to refresh the linux.do (Discourse) topic list in-place via DOM, without a full reload.
// Returns true if a refresh affordance was triggered; false if none found (caller should fall back).
export function refreshLinuxDoTopicListInPlace(doc: Document = document): boolean {
  // 1) Opportunistic: click the "N new/updated topics" banner if present (instant insert).
  const banner = doc.querySelector<HTMLAnchorElement>(
    '.show-more.has-topics a.alert.alert-info.clickable',
  )
  if (banner) {
    banner.click()
    return true
  }

  // 2) Click the already-active nav pill -> Ember same-route transition re-runs model() and refetches the list.
  const pill
    = doc.querySelector<HTMLAnchorElement>('.nav-pills li.active > a[href]')
    || doc.querySelector<HTMLAnchorElement>('.nav-pills a.active[href]')
    || doc.querySelector<HTMLAnchorElement>('.navigation-container .nav-pills li.active a[href]')
    || doc.querySelector<HTMLAnchorElement>('ul.nav-pills a[aria-current="page"]')
  if (pill) {
    pill.click()
    return true
  }

  return false
}
```
Match the file's existing code style (the repo uses ESLint @antfu config: no semicolons, single quotes, etc. — follow the surrounding code exactly).

## Change 2 — `src/contentScripts/views/App.vue`
Update `handleScrollActionClick` so that when `isPageAtTop` is true:
- if `isLinuxDoTopicListPage(location.href)` AND `refreshLinuxDoTopicListInPlace()` returns true → `window.scrollTo({ top: 0 })` (back to list top), do NOT reload.
- otherwise → `window.location.reload()` (unchanged fallback / non-list pages).
- when not at top → keep the existing smooth scroll-to-top.

Add `refreshLinuxDoTopicListInPlace` to the existing import from `~/sites/linuxDo` (which already imports `isLinuxDoTopicListPage`). Resulting handler shape:

```ts
function handleScrollActionClick() {
  if (isPageAtTop.value) {
    if (isLinuxDoTopicListPage(location.href) && refreshLinuxDoTopicListInPlace()) {
      window.scrollTo({ top: 0 })
      return
    }
    window.location.reload()
    return
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
```

## Change 3 — Unit test
Add `src/tests/refreshLinuxDoTopicList.spec.ts` (or extend an existing linuxDo test if one exists) covering `refreshLinuxDoTopicListInPlace`, following the existing `src/tests/*.spec.ts` style (vitest). Use a jsdom-built Document/element fixture. Cover three branches:
1. Banner present → clicks banner, returns true.
2. No banner but active nav pill present → clicks pill, returns true.
3. Neither present → returns false, nothing clicked.
Assert the click target via a spy on the element's `click` method.

## Validation (run and make them pass)
Run, in order, and fix anything that fails:
- `pnpm lint` (or `pnpm eslint .` — check package.json scripts)
- type check (check package.json: e.g. `pnpm typecheck` or `vue-tsc --noEmit`)
- `pnpm test` (vitest) — ensure your new test passes and you did not break existing tests.

Do NOT run any git commit/push — leave changes staged in the working tree only. Do NOT change `src/manifest.ts`, do NOT add new permissions, do NOT introduce MAIN-world injection.

## Report at the end
Summarize: files changed, the new function + handler diff, and the exact validation commands you ran with their pass/fail results. If a selector could not be verified live (Cloudflare Turnstile blocked research), note that real-browser verification is still pending.
