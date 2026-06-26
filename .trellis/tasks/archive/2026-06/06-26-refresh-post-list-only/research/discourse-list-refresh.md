# Research: Discourse topic-list-only in-place refresh (from ISOLATED-world content script)

- **Query**: How to refresh ONLY the Discourse topic list in-place (instead of `window.location.reload()`) from this extension's content script, on linux.do.
- **Scope**: mixed (external Discourse source + Chrome MV3 CSP/world docs + internal repo constraints)
- **Date**: 2026-06-26

## TL;DR

linux.do runs stock Discourse (Ember.js SPA, recent 2026 build). The canonical modern in-place refresh of the current discovery (topic-list) route is **`owner.lookup('service:router').refresh()`** — but that requires the **MAIN world**, which this ISOLATED-world extension cannot reach without manifest changes. The most robust **DOM-only** path that works from the ISOLATED world is to **click the already-active top-menu nav pill** (e.g. `.nav-pills li.active > a`), which performs an Ember in-app transition to the same route and re-runs the route `model()` hook (re-fetching `/latest.json` and re-rendering the list via Ember). The "new or updated topics" banner pill is real but only appears when MessageBus reports incoming topics, so it cannot be the primary trigger.

## Repo constraints (verified in this codebase)

- `src/manifest.ts` content_scripts has **no `world: 'MAIN'`** → ISOLATED world only (Chrome MV3 default). Cannot touch page `window.require` / Ember `owner` / `appEvents` directly.
- `permissions: ['storage', 'tabs']` — **no `scripting` permission**, no background service worker wired for injection. (`src/manifest.ts:42-47`)
- `web_accessible_resources` currently exposes **only** `dist/contentScripts/style.css` (`src/manifest.ts:58-63`). No JS is web-accessible.
- Extension's own `content_security_policy` is `script-src 'self'` (irrelevant to page injection; it constrains extension pages, not the linux.do page).
- `src/sites/linuxDo.ts` already does DOM-level work on the list and already exports `isLinuxDoTopicListPage(url)` gated on `TOPIC_LIST_PATHS = {'', '/latest', '/top', '/hot'}` + category path regex (`src/sites/linuxDo.ts:2, 263-271`). Existing working selectors prove linux.do uses standard Discourse list markup: `tr.topic-list-item`, `.topic-list`, `.latest-topic-list .topic-list-item` (`src/sites/linuxDo.ts:8-14`).

## Live-DOM verification: BLOCKED

Attempted to load `https://linux.do/latest` via chrome-devtools to confirm selectors against the live site. linux.do is behind **Cloudflare Turnstile** ("请稍候…" interstitial, `document.body.innerText.length === 0`, `window.require`/`window.Discourse` undefined because the Ember app never booted). Automated navigation could not pass the challenge. Selector claims below are therefore grounded in **current Discourse `main` source** (github.com/discourse/discourse) plus this repo's already-shipping working selectors, not a live DOM snapshot.

---

## Approach 1 — DOM-only (preferred for ISOLATED world, no CSP risk)

### 1a. Click the already-active nav pill ("Latest"/"Top"/"Hot") — RECOMMENDED DOM path

Discourse renders the top-menu as nav pills. Each item is an `<li>` with an `<a href>` and gets `class="active"` (and `aria-current="page"`) when it is the current route. Source: `frontend/discourse/app/components/navigation-item.gjs` — the `<template>` renders `<li class={{... (if this.active "active")}}><a href={{this.hrefLink}} class={{this.activeClass}} aria-current={{if this.activeClass "page"}}>`. The `active` getter returns true when `content.filterType === filterType` (i.e. you're on that route).

Clicking that `<a>` is an in-app Ember link click → Ember router transition to the same route. Because the discovery routes use a normal `model()` hook (see Approach 2 evidence), a transition to the same discovery filter re-runs `model()` → `findTopicList()` → re-fetches the list JSON and Ember re-renders `tr.topic-list-item` rows. No full page navigation, URL unchanged, our injected DOM survives because Ember only re-renders the list region (our MutationObserver / re-inject logic in `linuxDo.ts` re-applies on the new rows).

Caveats / evidence of nuance:
- Discourse has a known "do not reload identical route" optimization in some contexts (PR #27992 "FIX: do not reload identical route in drawer", 2024) — that was scoped to the chat **drawer**, not the main discovery list, but it signals Discourse sometimes short-circuits identical-route transitions. Risk: a same-route click may be treated as a no-op in future versions. Mitigation: fall back to Approach 2/3 if the row set is unchanged after click.
- The discovery route's `model()` honors a cache only on popstate (`findExtras = { cached: this.historyStore.isPoppedState }` in `build-topic-route.js`). A nav-pill click is NOT a popstate, so `cached` is false → it clears `session.topicList` and does a fresh `store.findFiltered("topicList", ...)`. This is exactly the desired "refetch latest" behavior. (Source: `frontend/discourse/app/routes/build-topic-route.js`, `findTopicList()` + `AbstractTopicRoute.model()`.)

Suggested selector (ISOLATED world, robust ordering):
```
const pill =
  document.querySelector('.nav-pills li.active > a[href]') ||
  document.querySelector('.nav-pills a.active[href]') ||
  document.querySelector('.navigation-container .nav-pills li.active a[href]') ||
  document.querySelector('ul.nav-pills a[aria-current="page"]');
pill?.click();
```
Note: dispatch a real `click()` on the `<a>` (Ember's `LinkTo`/router intercepts the click event); do NOT set `location.href`.

### 1b. The "new or updated topics" banner pill — secondary only

Real and stable selector, but conditional. Source: `frontend/discourse/app/components/discovery/topics.gjs` (lines ~233-247): rendered only `{{#if (or this.topicTrackingState.hasIncoming @model.loadingBefore)}}` as:
```
<div class="show-more {{if this.hasTopics 'has-topics'}}">
  <a ... {{on "click" this.showInserted}} class="alert alert-info clickable ...">
    {{count-i18n ... count=this.topicTrackingState.incomingCount}}
  </a>
</div>
```
So the selector is `.show-more.has-topics a.alert.alert-info.clickable` (this markup has been stable since at least 2021 — see meta thread 207371 with the same `.show-more.has-topics` / `.alert.alert-info.clickable` structure). `showInserted()` calls `model.loadBefore(topicIds, true)` to splice the new topics in at the top.

Why it's only secondary: the banner **only exists when MessageBus has pushed `incomingCount > 0`** (channels `/latest`, `/new`, `/unread` from `topic_tracking_state.rb`). On a fresh page with no new topics, the element is absent, so a refresh button that relies on it would do nothing most of the time. Use it as an opportunistic fast-path: if the banner is present, click it; otherwise fall back to 1a.

### 1c. Other native affordances

- No native "refresh list" button exists in stock Discourse desktop themes. The `period-chooser` (Top page) and sort headers (`changeSort`) trigger refetches but only by changing params, not a same-state refresh — not suitable.
- No native pull-to-refresh in core for the topic list.

---

## Approach 2 — MAIN-world injection (canonical Ember API, but needs manifest changes + CSP-sensitive)

### Canonical modern (2024+) API

`owner.lookup('service:router').refresh()` is the in-place refresh. Direct evidence: Discourse core itself uses exactly this to refresh the discovery list after dismiss/reset-new — `frontend/discourse/app/controllers/discovery/list.js:173` calls **`this.router.refresh()`** (where `router` is `@service router`). `router.refresh()` re-runs the current route's `model()` hook without a URL change → re-fetches and re-renders the list. This is the authoritative, version-stable answer (preferred over `appEvents.trigger('discovery:refresh')`, which is not a current discovery event — the modern AppEvents reference at github `docs/.../22-app-events-triggers.md` lists no `discovery:refresh`).

### Getting the owner in modern Discourse from MAIN world

```
const owner =
  require('discourse-common/lib/get-owner').getOwnerWithFallback() // older path
  || require('@ember/owner').getOwner(someEmberObject);
const router = owner.lookup('service:router');
router.refresh();          // refresh current route's model
// or scope explicitly:
router.refresh('discovery'); // refresh the discovery route subtree
```
`getOwnerWithFallback()` from `discourse-common/lib/get-owner` is the documented Discourse helper; modern code increasingly imports `getOwner` from `@ember/owner`. Both require `window.require` (the Ember AMD loader) which exists only in the MAIN world.

### How an MV3 extension reaches the MAIN world, and CSP impact

Two mechanisms (sources: Chrome "Content scripts" docs; chromium-extensions group thread "Injecting external scripts into page context"; w3c/webextensions issue #85):

| Mechanism | Page CSP `script-src` impact | Verdict for linux.do |
|---|---|---|
| `chrome.scripting.executeScript({world:'MAIN', func})` (or `registerContentScripts({world:'MAIN'})`) from a background service worker | Script runs in page context. Page CSP **cannot block the function body from running**, BUT the body **cannot use `eval`/`new Function`** if page CSP forbids them, and any DOM `<script>`/`<link>` it creates obey page CSP. Plain `require(...)` + `owner.lookup(...).refresh()` is neither eval nor a new script element → **works under linux.do's `script-src`**. | Viable. Needs adding `scripting` permission + a background SW + the tabId plumbing. |
| Bundled script tag via `web_accessible_resources` (`<script src="chrome-extension://.../inject.js">` appended from the content script) | In **MV3** this injected `<script>` element **is subject to the page CSP** (unlike MV2). linux.do's Discourse `script-src` does not list `chrome-extension:` → **blocked** ("Refused to load the script ... violates ... Content-Security-Policy"). | Fragile/likely blocked. Avoid. |

Conclusion: the only CSP-safe MAIN-world route is `chrome.scripting.executeScript({world:'MAIN', func})` with a function that uses existing globals (no eval, no remote/script-tag injection). It requires: add `"scripting"` to `permissions`, add a background service worker, and message from the ISOLATED content script → background → `executeScript` on the active tab. This is a non-trivial manifest/architecture change versus the DOM-only path.

Failure modes: `window.require` missing or module path renamed across Discourse upgrades; `service:router` lookup returning null after a future refactor (note the 2023 "Refactoring Discovery routes" meta post 282816 already removed many `controller:discovery/*` classes — route/service lookups survived, but this layer does churn). Always wrap in try/catch and fall back to DOM (1a) then full reload.

---

## Approach 3 — JSON refetch + manual DOM patch (fallback, fragile)

Fetch `https://linux.do/latest.json` (works from ISOLATED world; same-origin, no CSP issue for `fetch`) and re-render rows ourselves.

Feasibility but high fragility:
- **Conflict with Ember's virtual DOM**: Ember "owns" the `<tbody>` of `table.topic-list`. If we mutate/replace those rows directly, Ember's tracked state (`topicTrackingState`, glimmer VM) goes out of sync; the next Ember re-render (e.g. a MessageBus update or any reactive change) will clobber or duplicate our DOM, or throw. This is the same class of problem this repo already manages carefully by only *augmenting* rows (injecting tag links, hiding pinned) rather than *replacing* them.
- We'd have to reproduce Discourse's row template (avatars, activity, unread badges, category/tag chips, plugin outlets) — large surface, breaks on theme/version changes.
- Only justified if both DOM-click and MAIN-world paths are unavailable. Even then, prefer rendering into a *separate* container we own, not into Ember's `<tbody>`.

---

## Ranked recommendation for THIS repo

Given ISOLATED world, desire for robustness across Discourse upgrades, and minimal fragility:

1. **Click the active nav pill (Approach 1a)** — primary. Pure DOM, zero manifest/CSP changes, uses Ember's own routing so the list refetch + re-render + tracking-state sync are all handled by Discourse. Gated by existing `isLinuxDoTopicListPage(url)`.
2. **Opportunistic banner click (Approach 1b)** — if `.show-more.has-topics a.alert.alert-info.clickable` is present, click it first (instant "show N new"); otherwise go to 1a.
3. **MAIN-world `router.refresh()` (Approach 2)** — only if 1a proves unreliable in real testing. Requires `scripting` permission + background SW + `executeScript({world:'MAIN'})`; CSP-safe but adds architecture and version-coupling to Discourse internals.
4. **JSON refetch + manual patch (Approach 3)** — last resort; risks Ember VM conflicts.
5. **`window.location.reload()`** — final fallback when none of the above confirm a list change.

### Suggested implementation sketch (in `src/sites/linuxDo.ts`, called from `App.vue` `handleScrollActionClick`)

```ts
// Returns true if it triggered an in-place list refresh; false → caller does location.reload()
export function refreshLinuxDoTopicListInPlace(doc = document): boolean {
  // 1b: opportunistic "new/updated topics" banner
  const banner = doc.querySelector<HTMLAnchorElement>(
    '.show-more.has-topics a.alert.alert-info.clickable',
  )
  if (banner) { banner.click(); return true }

  // 1a: click the already-active nav pill (in-app Ember transition → model() refetch)
  const pill =
    doc.querySelector<HTMLAnchorElement>('.nav-pills li.active > a[href]')
    || doc.querySelector<HTMLAnchorElement>('.nav-pills a.active[href]')
    || doc.querySelector<HTMLAnchorElement>('.navigation-container .nav-pills li.active a[href]')
    || doc.querySelector<HTMLAnchorElement>('ul.nav-pills a[aria-current="page"]')
  if (pill) { pill.click(); return true }

  return false // caller falls back to window.location.reload()
}
```
Caller:
```ts
if (isLinuxDoTopicListPage(location.href) && refreshLinuxDoTopicListInPlace())
  // optionally window.scrollTo({ top: 0 }) to match "refresh" semantics
else
  window.location.reload()
```

### Fallback strategy / robustness
- Always keep `window.location.reload()` as the terminal fallback when no pill/banner is found (selector drift across Discourse versions).
- Optional verification: snapshot first `tr.topic-list-item[data-topic-id]` before clicking; if unchanged after ~1.5s, escalate (1a→2→reload). Keep it simple first; only add this if real testing shows the click is a no-op.
- Re-application of our injected DOM (tags, hidden pinned) should already be handled by the existing observer in `linuxDo.ts`; confirm it re-fires after the Ember list re-render (the new rows are fresh DOM nodes, so the observer should catch them).

## Caveats / Not Found

- **Not verified on live linux.do DOM** — blocked by Cloudflare Turnstile (see "Live-DOM verification: BLOCKED"). Selectors are from Discourse `main` source + this repo's existing working selectors. Recommend a human/real-browser pass to confirm `.nav-pills li.active > a` and the banner selector on the actual site, and to confirm a same-route pill click does re-fetch (not no-op) on linux.do's specific Discourse build.
- `appEvents.trigger('discovery:refresh')` — searched the modern AppEvents reference and discovery sources; **no such event exists** in current Discourse. Do not use it. The authoritative refresh is `router.refresh()`.
- Whether linux.do uses the new "unified new view" (meta 404728, default rolling out 2026) affects `/new`+`/unread` pills but not `/latest /top /hot` — the recommended approach is unaffected.

## Sources

- Discourse `main` — `frontend/discourse/app/controllers/discovery/list.js` (line 173 `this.router.refresh()`; queryParams `refreshModel`).
- Discourse `main` — `frontend/discourse/app/routes/build-topic-route.js` (`AbstractTopicRoute.model()`, `findTopicList()`, popstate-only cache).
- Discourse `main` — `frontend/discourse/app/components/navigation-item.gjs` (active pill markup, `active` getter, `aria-current="page"`).
- Discourse `main` — `frontend/discourse/app/components/discovery/topics.gjs` (lines ~233-247 banner `.show-more.has-topics a.alert.alert-info.clickable`, `showInserted` → `loadBefore`).
- Discourse `app/models/topic_tracking_state.rb` (MessageBus channels `/latest`,`/new`,`/unread` feeding `incomingCount`).
- meta.discourse.org/t/282816 — Nov 2023 Discovery routes refactor (route/service lookups survived; controller classes churned).
- meta.discourse.org/t/338465 + github `docs/.../22-app-events-triggers.md` — AppEvents reference (no `discovery:refresh`).
- meta.discourse.org/t/207371 — historical `.show-more.has-topics` / `.alert.alert-info.clickable` banner + `showInserted`/`loadBefore`.
- github PR discourse/discourse#27992 — "do not reload identical route in drawer" (same-route short-circuit precedent, chat-scoped).
- Chrome for Developers "Content scripts" — ISOLATED vs MAIN world, MAIN-world scripts subject to page CSP, no-eval limitation.
- Chrome for Developers "web_accessible_resources" + chromium-extensions thread "Injecting external scripts into page context" + w3c/webextensions#85 — MV3 WAR `<script>` tags are subject to page CSP; `executeScript({world:'MAIN'})` body runs but cannot eval.
- This repo: `src/manifest.ts` (no `world:MAIN`, perms `storage`/`tabs`, WAR=css only), `src/sites/linuxDo.ts` (existing list selectors + `isLinuxDoTopicListPage`).
