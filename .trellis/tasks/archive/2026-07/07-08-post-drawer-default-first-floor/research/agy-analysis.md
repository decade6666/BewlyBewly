Here is the analysis and critique of the planned change:

### 1. Recommendation Summary
Implement the normalization changes directly inside [normalizeLinuxDoTopicUrl](file:///root/github/BewlyLinuxDo/src/sites/linuxDo.ts#L544). Appending `/1` to the path and stripping all queries/hashes is the most robust way to force Discourse to open at the first floor. It prevents Discourse from automatically jumping to the user's "last read" position, which it would otherwise do if loaded without a specific floor suffix.

---

### 2. Is `src/sites/linuxDo.ts` the Correct Change Boundary?
**Yes, it is the correct change boundary.**
- **Centralization:** [normalizeLinuxDoTopicUrl](file:///root/github/BewlyLinuxDo/src/sites/linuxDo.ts#L544) is the central helper used to format and validate Linux.do topic links.
- **Single Host-Page Impact:** Its only production caller is [findLinuxDoTopicLink](file:///root/github/BewlyLinuxDo/src/sites/linuxDo.ts#L572) (called by [handleDocumentClick](file:///root/github/BewlyLinuxDo/src/contentScripts/views/App.vue#L505) in `App.vue`). The drawer iframe itself loads standard pages directly and does not run host scripts.
- **No Side Effects:** No other parts of the extension (such as tag filters or homepage cleanup) require preservation of queries, hashes, or specific post numbers from these links.

---

### 3. Edge Cases / Regression Risks
- **Discourse Jump Behavior (Crucial):** If we only strip the floor/post suffix (e.g., rewriting `/t/slug/123/4` to `/t/slug/123`), Discourse will retrieve the user's reading history and automatically scroll to their last-read floor. Hardcoding the `/1` suffix is required to suppress this behavior.
- **Placeholders as Slugs:** Discourse topic lists sometimes use a hyphen as a placeholder slug (e.g., `/t/-/123`). The regex should capture the slug dynamically and preserve whatever is in the first path segment (e.g., `/t/${slug}/${topicId}/1`) rather than assuming a specific slug format.
- **Multiple Query/Hash Permutations:** Links might contain tracking queries or anchors (e.g., `?u=username` or `#post-5`). We must set both `.search` and `.hash` properties on the parsed `URL` object to empty strings to guarantee clean stripping.
- **History State Consistency:** The normalized URL is stored via `pushState` in [openIframeDrawer](file:///root/github/BewlyLinuxDo/src/contentScripts/views/App.vue#L522) and restored on browser back/forward buttons in [handlePopState](file:///root/github/BewlyLinuxDo/src/contentScripts/views/App.vue#L533). Keeping the URL normalized means history state will also clean-up correctly to the first floor.

---

### 4. Test Updates Required
The existing test suite in [src/tests/linuxDoMigration.spec.ts](file:///root/github/BewlyLinuxDo/src/tests/linuxDoMigration.spec.ts) needs to be updated:
- Update the assertions in the parameterized tests at [line 179-185](file:///root/github/BewlyLinuxDo/src/tests/linuxDoMigration.spec.ts#L179-L185) to expect all normalized results to end with `/1` (with queries and hashes stripped).
- Update the nested click target assertion at [line 205](file:///root/github/BewlyLinuxDo/src/tests/linuxDoMigration.spec.ts#L205) to expect `/t/welcome-to-linux-do/123/1` instead of `/t/welcome-to-linux-do/123`.
- Add test cases covering:
  - Input that already ends with `/1`.
  - Input containing multiple query params (e.g., `?foo=bar&baz=qux`).
  - Input containing a hyphen slug (e.g., `/t/-/123`).

---

### 5. PRD Gaps or Wording Improvements
- **Clarification of Discourse Resume Logic:** The PRD should explicitly mention that appending `/1` is required specifically to bypass Discourse's "last read" auto-scroll feature.
- **Hyphen/Placeholder Slug Handling:** The PRD's URL template representation `https://linux.do/t/<slug>/<topic-id>/1` should specify that placeholder slugs like `-` are also valid and must be preserved during normalization.

---

### 6. Suggested Implementation Shape
1. Capture the slug and topic ID using a RegExp match on the `parsedUrl.pathname`:
   ```typescript
   const match = parsedUrl.pathname.match(/^\/t\/([^/]+)\/(\d+)/)
   if (match) {
     const slug = match[1]
     const topicId = match[2]
     parsedUrl.pathname = `/t/${slug}/${topicId}/1`
   }
   ```
2. Strip query parameters and hash components:
   ```typescript
   parsedUrl.search = ''
   parsedUrl.hash = ''
   ```
3. Return `parsedUrl.toString()`.
