## 1. Recommendation summary

- The direction is right: canonicalize the intercepted Linux.do topic URL before the drawer opens, so the drawer/history path always starts from first floor instead of preserving reply-floor state.
- I would approve the PRD after tightening two decisions it currently leaves fuzzy:
  - whether this is a new drawer-specific canonicalization rule or a semantic change to the generic helper in `src/sites/linuxDo.ts:544-572`
  - whether the same canonical `/1` URL should also drive “Open in new tab”, since `IframeDrawer.vue` uses the same `props.url` (`src/components/IframeDrawer.vue:115-116`)
- Also note this is intentionally reversing an existing tested contract: `src/tests/linuxDoMigration.spec.ts:179-185` currently asserts that floor/query/hash are preserved.

## 2. Whether `src/sites/linuxDo.ts` is the correct change boundary, with reasons

- Yes, `src/sites/linuxDo.ts` is the right module boundary. URL parsing and topic-link validation already live there in `normalizeLinuxDoTopicUrl()` and `findLinuxDoTopicLink()` (`src/sites/linuxDo.ts:544-572`).
- `App.vue` is currently doing the right kind of work: intercept list-page clicks, ask the site helper for a topic URL, then pass that URL into drawer/history state (`src/contentScripts/views/App.vue:501-522`). It should not start hand-building Linux.do-specific `/1` URLs itself.
- The only caveat is function-level scope: `normalizeLinuxDoTopicUrl()` reads as a generic validator/normalizer, and the tests treat it that way (`src/tests/linuxDoMigration.spec.ts:179-185`). I would prefer a dedicated first-floor helper, or an explicit option used by `findLinuxDoTopicLink()`, rather than a quiet semantic broadening that future callers may not expect.

## 3. Edge cases / regression risks

- Bare topic URLs like `/t/slug/123` should also canonicalize to `/t/slug/123/1`, not stay bare.
- Relative, absolute, and trailing-slash topic URLs with `?query` and `#hash` should all collapse to the same first-floor URL.
- Only `topicUrl` should be canonicalized. `baseUrl` must stay untouched, or close/history restore can lose current list-page filters/anchors (`src/contentScripts/views/App.vue:515-546`).
- “Open in new tab” will also change behavior unless the original clicked URL is stored separately, because it uses `props.url` directly (`src/components/IframeDrawer.vue:115-116`).
- If the product intent is broader than fresh list clicks, there is still a reopen risk: `handlePopState()` trusts `drawerState.drawerUrl` as stored (`src/contentScripts/views/App.vue:529-533`).

## 4. Test updates that should be required

- Update the helper expectations in `src/tests/linuxDoMigration.spec.ts:179-185` so:
  - `/t/.../123`
  - `/t/.../123/4`
  - `/t/.../123?foo=bar#post-4`
  all normalize to `https://linux.do/t/<slug>/<topic-id>/1`.
- Add a `findLinuxDoTopicLink()` nested-click case using a floor/query/hash topic href, following the existing pattern in `src/tests/linuxDoMigration.spec.ts:196-205`.
- Keep the negative cases intact for non-topic URLs and non-topic nested clicks (`src/tests/linuxDoMigration.spec.ts:187-217`).
- Keep the source-boundary assertions that `App.vue` still routes through `findLinuxDoTopicLink(...)` and pushes the returned `topicUrl` into history (`src/tests/linuxDoMigration.spec.ts:1255-1259`). That matches the repo’s current testing style better than inventing a new mounted-App test just for this change.

## 5. PRD gaps or wording improvements

- Tighten `prd.md:19` from “尽量收敛” to an explicit boundary: canonicalize only the intercepted list-click topic URL; do not rewrite list-page `baseUrl`, and do not change in-drawer follow-on navigation.
- Add an explicit decision on whether canonicalization should also apply to:
  - browser forward/back reopen of newly created drawer entries
  - the drawer’s “Open in new tab” action
- Call out that this replaces the current preserved-floor/hash contract already locked by `src/tests/linuxDoMigration.spec.ts:179-185`.
- Make `prd.md:28` more testable. “历史恢复逻辑保持可用” is vague; better to say that new drawer entries store/push the canonical `/1` topic URL while restoring the original list `baseUrl` unchanged.
- `prd.md:40-41` should mention `src/contentScripts/views/App.vue` as a boundary contract file even if the recommended implementation leaves its logic unchanged.

## 6. Suggested implementation shape (no code patch, just plan)

- In `src/sites/linuxDo.ts`, add a site-layer canonicalization step that turns any validated Linux.do topic URL into `https://linux.do/t/<slug>/<topic-id>/1` and clears `search` / `hash`.
- Prefer a dedicated helper, or an explicit option on the existing helper, then have `findLinuxDoTopicLink()` return that canonical drawer URL.
- Leave the main `App.vue` drawer/history flow alone if the intended scope is only intercepted list-page clicks; it already propagates the resolved URL into iframe state and `history.pushState()` (`src/contentScripts/views/App.vue:505-522`).
- If the team wants a stricter invariant that every drawer reopen is first-floor, normalize again at the `openIframeDrawer()` boundary as defense in depth.
- Update `src/tests/linuxDoMigration.spec.ts` in the same helper-plus-source-regression style the repo already uses.

---
SESSION_ID: 019f4203-a842-7e00-a00c-2a35107ea34d
