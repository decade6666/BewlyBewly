# homepage settings visibility controls

## Goal

Fix Linux.do homepage cleanup so the community guideline text `真诚、友善、团结、专业，共建你我引以为荣之社区。《社区准则》` is hidden reliably, and add a floating in-page settings button that lets users enable/disable the plugin, guideline banner hiding, and pinned topic hiding.

## What I already know

* User reports the homepage guideline text is still visible.
* User wants a floating settings button.
* Settings must include controls for plugin enabled/disabled, banner hiding enabled/disabled, and pinned-topic hiding enabled/disabled.
* Current cleanup entry point is `hideLinuxDoHomePageElements(document, location.href)` in `src/contentScripts/index.ts`.
* Current cleanup logic lives in `src/sites/linuxDo.ts` and already hides guideline banners plus pinned `tr.topic-list-item` rows for `/` and `/latest`.
* Current content-script Vue app lives in `src/contentScripts/views/App.vue` and is mounted into a shadow root.
* Persistent extension settings should use `useStorageLocal` from `src/composables/useStorageLocal.ts`; `src/manifest.ts` already has `storage` permission.
* Existing test coverage is in `src/tests/linuxDoMigration.spec.ts`.

## Assumptions (temporary)

* Defaults should preserve the current intended behavior: plugin on, banner hiding on, pinned-topic hiding on.
* The floating settings button should be available on Linux.do pages where the content script runs.

## Open Questions

* None.

## Requirements (evolving)

* Hide the real Linux.do guideline/community-rules banner text on homepage routes.
* Keep homepage cleanup scoped to `https://linux.do/` and `https://linux.do/latest`.
* Keep pinned topic hiding separate from banner hiding.
* Add a floating settings button in the content-script UI.
* Add settings controls for:
  * plugin enabled/disabled
  * guideline banner hiding enabled/disabled
  * pinned topic hiding enabled/disabled
* Persist settings across page reloads and browser restarts.
* Immediately restore elements hidden by the plugin when the relevant hiding toggle is turned off.
* Preserve normal topic rows and non-homepage pages.

## Acceptance Criteria (evolving)

* [ ] The reported guideline/community-rules banner text is hidden on Linux.do homepage/latest.
* [ ] Banner hiding can be turned off without also turning off pinned-topic hiding.
* [ ] Pinned-topic hiding can be turned off without also turning off banner hiding.
* [ ] Plugin disabled stops the plugin behavior from intercepting topic clicks and applying cleanup.
* [ ] Floating settings button opens a settings panel with three toggles.
* [ ] Settings persist through reload.
* [ ] Turning off a hiding toggle immediately restores elements hidden by that toggle.
* [ ] Normal topic rows remain visible.
* [ ] Category/topic pages do not receive homepage-only cleanup.
* [ ] Relevant Vitest coverage is added/updated.

## Definition of Done (team quality bar)

* Tests added/updated where practical.
* Lint / typecheck / focused tests pass or failures are reported.
* UI behavior is browser-checked if feasible; if not, not-run scope is stated.
* No unrelated refactor.

## Research References

* [`research/settings-ui-approach.md`](research/settings-ui-approach.md) — recommended Linux.do-specific settings key plus small floating in-page panel.

## Technical Approach

Recommended approach: add a Linux.do-specific persistent settings object via `useStorageLocal`, render a compact floating button/settings panel inside `src/contentScripts/views/App.vue`, and update Linux.do cleanup logic to accept visibility options so banner and pinned-topic hiding can be controlled independently.

## Decision (ADR-lite)

**Context**: The migrated extension currently has Linux.do-specific content-script behavior but no Linux.do-specific runtime settings surface.

**Decision**: Prefer a Linux.do-specific settings key and floating in-page settings panel instead of extending the legacy monolithic Bilibili settings schema.

**Consequences**: This keeps the feature small and isolated, but introduces a separate Linux.do settings model.

## Out of Scope (explicit)

* Rebuilding the full legacy settings page.
* Adding browser action/options-page settings unless requested later.
* Changing extension permissions beyond existing storage usage.
* Reworking the drawer browsing feature beyond respecting plugin enabled/disabled.

## Technical Notes

* `src/sites/linuxDo.ts` currently matches the full normalized guideline string; real DOM may require fragment-based matching for text split across nodes, punctuation differences, or link-only `社区准则` portions.
* Trellis spec `frontend/quality-guidelines.md` requires Linux.do cleanup to avoid hiding `body`, wrappers, or topic-card containers.
* Existing `Radio.vue` is the project checkbox/toggle component.
