# brainstorm: hide homepage pinned posts and guideline banner

## Goal

Hide the homepage pinned posts and the community guideline banner text `真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》` so the extension no longer shows those homepage elements.

## What I already know

* The requested target is the homepage.
* The requested elements are pinned posts and the banner containing the community guideline text.
* This is likely a browser extension behavior/style change after migration to Linux.do.

## Assumptions (temporary)

* The goal is to hide these elements visually without removing unrelated homepage content.
* The change should only affect Linux.do homepage UI, not topic pages or other routes.
* The preferred implementation is likely CSS-based if these are DOM elements rendered by the site.

## Open Questions

* None for MVP.

## Requirements (evolving)

* Always hide these elements without adding a settings toggle.
* Hide homepage pinned posts.
* Hide the homepage banner containing `真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》`.
* Scope the hiding behavior to the Linux.do homepage.

## Acceptance Criteria (evolving)

* [ ] On `https://linux.do/`, pinned posts are not visible.
* [ ] On `https://linux.do/`, the guideline banner text is not visible.
* [ ] Non-homepage topic/category pages keep their normal topic list content.
* [ ] Existing Linux.do topic-list click handling still works.
* [ ] The extension build/type checks pass.

## Definition of Done (team quality bar)

* Tests added/updated if the project has suitable test coverage for this behavior.
* Lint / typecheck / CI-relevant checks are green where available.
* Docs/notes updated if behavior changes require documentation.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* Changing the content or behavior of normal topic lists outside the homepage.
* Removing these elements from the Linux.do server; this is only extension-side behavior.

## Technical Approach

Recommended MVP: always-on homepage-only cleanup in the content script.

* Reuse `src/sites/linuxDo.ts` for URL scoping by adding a homepage predicate if needed.
* Reuse `src/utils/main.ts` `injectCSS` or a small content-script helper for host-page style/DOM cleanup.
* Hide the guideline banner by matching the known text and hiding the closest banner-like container.
* Hide pinned posts on the homepage by targeting Discourse topic-list rows with pinned indicators/classes.
* Add jsdom tests for URL scoping and DOM cleanup behavior.

## Decision (ADR-lite)

**Context**: The extension currently mounts its Vue UI inside Shadow DOM, so component scoped styles cannot hide Linux.do host-page elements.
**Decision**: Prefer a small host-page cleanup helper in the content script rather than changing the extension UI tree.
**Consequences**: This keeps behavior local to Linux.do host DOM, but selector/text matching should be tested because live DOM inspection was blocked by Cloudflare in this environment.

## Technical Notes

* Initial task directory: `.trellis/tasks/06-01-hide-home-pinned-banner/`.
* `src/contentScripts/index.ts` injects the extension at `document_start` and mounts the Vue app in Shadow DOM.
* `src/contentScripts/views/App.vue` handles Linux.do topic-list clicks via `isLinuxDoTopicListPage(location.href)` and `findLinuxDoTopicLink`.
* `src/sites/linuxDo.ts` currently recognizes topic-list pages, including `https://linux.do/`, but has no homepage-only helper yet.
* `src/utils/main.ts` exposes `injectCSS(css, element)` for style injection into normal DOM or ShadowRoot.
* `src/tests/linuxDoMigration.spec.ts` already covers Linux.do URL helpers and content-script boundaries; it is the likely place for focused regression tests.
* Browser DOM inspection of `https://linux.do/` hit a Cloudflare challenge, so exact live classes were not verified from this environment.
