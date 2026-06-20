# Move top drawer buttons and style close key badge

## Goal

Adjust the Linux.do iframe drawer top controls so the "open in new tab" and "close" buttons sit at the top-right edge, follow the active dark theme with dark backgrounds and white icon/text, and give the close button's `Esc` key badge the bordered raised keycap styling used upstream in BewlyBewly.

## What I already know

* The user requested three UI changes:
  * Move the top "在新标签页打开" and "关闭" buttons to the top far right.
  * In dark mode, use a dark button background with white icons and text.
  * Add border and raised base styling to the close button's `Esc` key badge, following upstream BewlyBewly.
* The primary implementation is `src/components/IframeDrawer.vue`.
* Related drawer open/close state lives in `src/contentScripts/views/App.vue`, but this request is styling/layout-only and should not require App.vue logic changes.
* Upstream BewlyBewly uses a global `kbd` style with background, border-like box shadow, raised base shadow, hover, and active pressed state.

## Assumptions

* The user wrote "ECS" but the UI currently renders `Esc`; this task will style the existing `Esc` badge rather than rename it to `ECS`.
* "顶部最右边" means the controls should align to the viewport/header right edge instead of being constrained by the page max-width center container.
* Dark-mode following should use existing theme variables so light mode continues to use the corresponding theme colors.

## Requirements

* Reposition the iframe drawer header controls to the top-right edge.
* Keep the two buttons clickable while the overlay header container itself remains pointer-event transparent.
* Style drawer header buttons with existing theme CSS variables so dark mode produces dark backgrounds with white icon/text.
* Add scoped `kbd` styling for the close button key badge matching the upstream border/base effect.
* Avoid changing drawer behavior, routing, iframe lifecycle, or labels beyond the requested visual changes.

## Acceptance Criteria

* [ ] "在新标签页打开" and "关闭" render at the top-right edge of the drawer overlay.
* [ ] In dark mode, the buttons use dark backgrounds and white icon/text via theme variables.
* [ ] The close button's `Esc` badge shows a border and raised base similar to upstream BewlyBewly.
* [ ] Drawer open, close, Escape, and open-in-new-tab behavior remain unchanged.
* [ ] Typecheck/lint pass for the changed code.

## Definition of Done

* Relevant code inspected before editing.
* Minimal scoped UI changes implemented.
* Narrow validation run and reported.
* No unrelated refactoring.

## Technical Approach

Update `src/components/IframeDrawer.vue` only:

* Change the header positioning from a centered full-width/max-width row to a top-right shrink-to-content row.
* Replace duplicated inline button CSS variables with a shared drawer button class.
* Use `--bew-elevated-solid`, `--bew-elevated-solid-hover`, and `--bew-text-1` so dark mode follows existing theme variables.
* Add scoped `kbd` styles based on upstream BewlyBewly's global `kbd` block.

## Decision (ADR-lite)

**Context**: The requested visual changes are localized to the iframe drawer header controls.

**Decision**: Make a small scoped change in `IframeDrawer.vue` instead of changing global button or keyboard styles.

**Consequences**: The fix is low risk and avoids affecting other buttons, but any future drawer header controls must reuse the same class if they need matching styling.

## Out of Scope

* Changing drawer routing/history behavior.
* Changing iframe sandbox or lifecycle behavior.
* Renaming `Esc` to `ECS` unless explicitly requested after review.
* Adding new dependencies or global style changes.

## Technical Notes

* `src/components/IframeDrawer.vue` contains the top controls and local drawer transitions.
* `src/contentScripts/views/App.vue` contains drawer open/close state but no styling change is needed for this task.
* Upstream reference: `BewlyBewly/BewlyBewly` `src/styles/main.scss` `kbd` block.
