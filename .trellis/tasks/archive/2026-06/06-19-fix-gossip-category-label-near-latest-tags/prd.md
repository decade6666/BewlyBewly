# Fix gossip category label near latest tags

## Goal

On `https://linux.do/latest`, the category/tag area for topics in the `gossip` category must not surface the raw category slug `gossip` as a tag/category label. The visible row metadata should keep the localized category name (for example `搞七捻三`) and show only real topic tags next to it.

## What I already know

- The Linux.do tag rendering helper lives in `src/sites/linuxDo.ts` and is called from the content script cleanup loop.
- Topic rows include category classes such as `category-gossip` and tag classes such as `tag-纯水`.
- Horizon hides the original `.link-bottom-line` tag/category metadata and exposes a separate `td.topic-category-data`; the extension injects tags there.
- Live inspection on `/latest` showed `category-gossip` rows with localized category text `搞七捻三`, hidden native Discourse tag links, and extension-injected tag links beside the category.

## Requirements

- Do not display a raw category slug such as `gossip` as an injected tag label.
- Prefer Linux.do's native tag link metadata (`data-tag-name`, text, and href) when it exists, because it is the site's canonical display/href source.
- Keep the existing class-token fallback for rows where native tag links are unavailable.
- Keep injection idempotent and preserve the Horizon placement behavior in `td.topic-category-data`.
- Keep behavior limited to Linux.do home/latest pages.

## Acceptance Criteria

- [ ] A `category-gossip` row with a misleading `tag-gossip` class and native tag metadata injects only the native real tag label/href, not `gossip`.
- [ ] A fallback row without native tag metadata excludes a tag token that duplicates the category slug.
- [ ] Multi-tag rows (3+ tags) in the Horizon theme render the category badge and all tags on a single horizontal line, not vertically stacked.
- [ ] Existing topic tag injection tests remain green.
- [ ] Manual browser check on `https://linux.do/latest` confirms gossip-category rows show localized category text plus real tags only.

## Definition of Done

- Targeted regression tests added/updated.
- Narrow test command passes.
- Typecheck/lint/build run if source changes affect packaging.
- Browser verification captures the category/tag area on `/latest` when feasible.

## Technical Approach

Change the tag extraction path in `src/sites/linuxDo.ts` from raw class-only extraction to a metadata-first extraction:

1. Read native Discourse tag anchors from the topic row, excluding Bewly-injected anchors.
2. Use `data-tag-name` or anchor text as the display label and preserve the native href.
3. Merge class-token fallback tags only for native metadata gaps, while preserving native display labels/hrefs when available.
4. In fallback/merge mode, filter class-derived tag names that duplicate row category slugs such as `category-gossip`.

## Out of Scope

- Changing Linux.do's native category rendering.
- Adding a user setting for category/tag display.
- Reworking the broader homepage cleanup observer.
- Changing drawer iframe behavior from the separate hidden-chrome task.

## Technical Notes

- Related component/spec context: `.trellis/spec/frontend/component-guidelines.md`.
- Existing tests: `src/tests/linuxDoMigration.spec.ts` topic-tag injection section.
- Current task is separate from `.trellis/tasks/06-19-hide-remaining-drawer-chrome-on-linux-do`.
