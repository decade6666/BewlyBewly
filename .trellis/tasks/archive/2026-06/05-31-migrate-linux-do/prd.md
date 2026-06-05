# brainstorm: migrate browser extension to linux.do

## Goal

Migrate the existing browser extension from a Bilibili-focused extension into a Linux.do-specific extension for the Discourse-based forum at `https://linux.do/`, removing Bilibili-specific behavior, copy, selectors, assets, and assumptions.

## What I already know

* The current project is a browser extension originally designed for `https://www.bilibili.com/`.
* The requested target is a dedicated extension for `https://linux.do/`.
* Bilibili-specific content should be removed rather than preserved as a multi-site mode.
* Linux.do uses Discourse, a modern open-source forum system.

## Assumptions (temporary)

* The extension should become Linux.do-only, not a generic Discourse extension.
* Existing extension infrastructure, build tooling, and reusable UI patterns should be reused where they are not Bilibili-specific.
* The migration may touch manifest host permissions, content scripts, selectors, styles, route matching, copy, settings, and assets.

## Open Questions

* None for the current MVP. A drawer enable/disable switch is deferred unless the user explicitly requests it later.

## Requirements

* Remove Bilibili-specific functionality, content, selectors, URL matches, naming, and assumptions.
* Retarget browser-extension behavior to `https://linux.do/`.
* Account for Linux.do being powered by Discourse.
* Reuse extension infrastructure only where it is site-agnostic: build scripts, Vue mounting, shared UI primitives, storage, settings shell, and styling tokens.
* Replace manifest host permissions and content script matches with Linux.do-only matches.
* Preserve the drawer-style browsing experience as the main retained product behavior.
* On the Linux.do homepage, clicking a topic/post should open it in an in-page drawer instead of navigating away from the list.
* On Linux.do latest, hot/top, and category topic-list pages, clicking a topic/post should also open it in an in-page drawer.
* In the MVP, the drawer should show the full original Linux.do topic page.
* A cleaner reading-focused drawer mode is a later optimization, not part of the first implementation slice.
* Keep the original Linux.do page visually and behaviorally unchanged as much as possible; MVP should only add drawer opening for topic links.
* Avoid broad page redesign, list restyling, or visual replacement in the MVP.
* Opening a topic drawer should not update the top-level browser address bar; the user should remain on the list URL.
* The drawer should provide actions to open the topic in a new tab and copy the topic link.
* The drawer should close like the current plugin: clicking the top overlay/mask area, clicking the top-right close button, or pressing Esc closes the drawer and returns to the previous topic-list state.
* Ask the user to confirm additional feature scope in plain language before adding it.

## Acceptance Criteria

* [ ] Extension no longer requests or targets `https://www.bilibili.com/`, `*.bilibili.com`, or `*.hdslb.com` unless explicitly justified.
* [ ] Bilibili-specific UI text, selectors, assets, API calls, stores, settings, and feature assumptions are removed or replaced.
* [ ] Extension runs on `https://linux.do/` with the agreed MVP behavior.
* [ ] On the Linux.do homepage, topic/post clicks open the selected content in a drawer without losing the current list position.
* [ ] On Linux.do latest, hot/top, and category topic-list pages, topic/post clicks open the selected content in a drawer without losing the current list position.
* [ ] The drawer can be closed to return to the same topic-list state.
* [ ] The drawer closes when the user clicks the overlay/top area.
* [ ] The drawer closes when the user clicks the top-right close button.
* [ ] The drawer closes when the user presses Esc.
* [ ] The MVP drawer renders the full original Linux.do topic page.
* [ ] Reading-mode cleanup is not required for MVP, but the implementation does not block adding it later.
* [ ] The original Linux.do page layout and styling remain unchanged except for drawer behavior.
* [ ] Opening a topic drawer does not change the top-level browser address bar.
* [ ] The drawer exposes “open in new tab” and “copy link” actions for the current topic.
* [ ] Linux.do / Discourse selectors and API calls are isolated behind clearly named site-specific utilities or modules.
* [ ] Build, lint, typecheck, and relevant tests pass.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / build are green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Technical Approach

Retarget the extension to Linux.do-only and keep the first implementation slice narrow: remove Bilibili site integration, preserve reusable extension infrastructure, and add a Linux.do content-script enhancement that intercepts topic links on list-style pages and opens the original topic URL in an in-page drawer. The drawer should avoid top-level history mutations, expose open/copy actions, and close through overlay, close button, or Esc.

Implementation should isolate Linux.do / Discourse DOM selectors and URL helpers behind clearly named site-specific modules so later reading-mode cleanup can be added without turning this MVP into a full page replacement.

## Decision (ADR-lite)

**Context**: The existing extension is deeply Bilibili-specific, but the target site is Linux.do, a Discourse forum with different page structure and user workflows.

**Decision**: Use Approach B, the Linux.do Discourse enhancement MVP: remove Bilibili coupling, retarget permissions and injection to Linux.do, and preserve the drawer-style reading workflow for topic lists.

**Consequences**: This keeps the migration valuable without attempting a high-risk full redesign. The MVP intentionally defers generic Discourse support, reading-mode cleanup, configurable drawer settings, and broad Linux.do visual replacement.

## Out of Scope (explicit)

* Supporting both Bilibili and Linux.do in one extension, unless later requested.
* Supporting all Discourse instances generically, unless later requested.
* Redesigning Linux.do topic lists or overall page style in the MVP.
* Drawer enable/disable settings, shortcut customization, or drawer style configuration in the MVP, unless later requested.

## Research Notes

### What Discourse provides

* Discourse has structured topic-list rendering and extension points in its own theme/plugin API, but a browser extension cannot rely on those internal plugin APIs unless installed server-side.
* Browser-extension integration should prefer public page URLs and public JSON endpoints where available, with DOM enhancement kept narrow and resilient.
* Discourse topic-list customization concepts include topic list rows, categories, latest topics, search, user state, and notifications; these map better to forum workflows than the existing Bilibili video/feed model.
* Private, admin, or server-side plugin APIs should be avoided for a client-only browser extension unless Linux.do explicitly exposes and authorizes them.

### Constraints from this repo

* `package.json` still describes a Bilibili homepage extension and `webExt.run.startUrl` points to `https://www.bilibili.com/`.
* `src/manifest.ts` generates MV3 manifests with Bilibili and `hdslb.com` host permissions and many Bilibili content-script matches.
* `src/contentScripts/index.ts` gates injection on many Bilibili URL patterns and removes/hides Bilibili DOM nodes such as `.bili-header`, `#biliMainHeader`, `.home-redesign-base`, and `.bilibili-gate-root`.
* `src/contentScripts/views/App.vue`, `src/stores/mainStore.ts`, `src/stores/topBarStore.ts`, `src/constants/globalEvents.ts`, and many view/API/style files encode Bilibili-specific navigation, pages, labels, iframe behavior, and remote API assumptions.
* Existing drawer components are iframe-based: `src/components/IframeDrawer.vue` and `src/components/IframePage.vue`.
* Existing `IframeDrawer.vue` currently mutates browser history with `history.pushState` / `history.replaceState`; Linux.do MVP should remove that behavior and keep the top-level list URL unchanged.
* A header check for `https://linux.do/` returned Cloudflare challenge status in curl, with `X-Frame-Options: SAMEORIGIN`; same-origin drawer iframe use from inside Linux.do should remain feasible, but must be verified in a real browser.
* A repository-wide search found Bilibili references across background API listeners, top bar components, content views, adapted styles, locale files, README files, and tests.

### Feasible approaches here

**Approach A: Linux.do cleanup shell**

* How it works: remove Bilibili permissions/matches/API calls/pages and leave a minimal Linux.do content-script shell that mounts only small UI or settings affordances.
* Pros: lowest risk; quickly removes incorrect Bilibili coupling; good foundation.
* Cons: may feel like a regression because most existing Bewly features disappear initially.

**Approach B: Linux.do Discourse enhancement MVP** (Selected)

* How it works: remove Bilibili-specific behavior, retarget to Linux.do, then implement a forum-native enhancement MVP centered on drawer-style topic reading from the homepage.
* Pros: preserves the user's most important existing browsing pattern while avoiding a risky full rewrite; aligns with Discourse concepts.
* Cons: requires deciding which Linux.do pages and links should trigger the drawer beyond the homepage.

**Approach C: Full Bewly-style Linux.do replacement shell**

* How it works: replace the Linux.do homepage/topic lists with a custom Vue app similar to the current Bilibili homepage replacement, backed by Discourse data.
* Pros: preserves the ambitious Bewly-style product direction.
* Cons: highest risk; likely large rewrite because current pages and APIs are video-platform-specific, not forum-specific.

## Technical Notes

* Task directory: `.trellis/tasks/05-31-migrate-linux-do`.
* Initial user request captured on 2026-05-31.
* Source files inspected: `package.json`, `src/manifest.ts`, `extension/manifest.json`, `src/contentScripts/index.ts`, `src/contentScripts/views/App.vue`, `src/utils/main.ts`, `src/stores/mainStore.ts`, `src/stores/topBarStore.ts`, `src/enums/appEnums.ts`, `src/constants/globalEvents.ts`.
* Discourse documentation source checked via Context7 library `/discourse/discourse`.
