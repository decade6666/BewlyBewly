# Component Guidelines

> How components are built in this project.

---

## Overview

This project injects a Vue app into Linux.do through a content-script Shadow DOM. Components must keep extension overlays scoped, accessible, and explicit about browser-side side effects. Top-level page history and DOM cleanup coordination belong in `src/contentScripts/views/App.vue`, while reusable drawer UI stays in `src/components/IframeDrawer.vue`.

---

## Scenario: Linux.do Drawer and Floating Controls

### 1. Scope / Trigger

- Trigger: adding or changing Linux.do overlay controls, iframe drawer buttons, or the floating settings entry.
- Applies to `src/contentScripts/views/App.vue`, `src/components/IframeDrawer.vue`, and `src/tests/linuxDoMigration.spec.ts`.
- This is a component contract because z-index, pointer events, and button ownership determine whether the original Linux.do page or iframe content can hide extension controls.

### 2. Signatures

Iframe drawer component API:

```typescript
const props = defineProps<{
  url: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
```

Content-script overlay template contract:

```text
<button class="linux-do-settings-button" type="button" />
<section v-if="showSettingsPanel" class="linux-do-settings-panel" role="dialog" />
<div v-if="showIframeDrawer" id="bewly-wrapper" class="linux-do-drawer-root">
  <div class="linux-do-drawer">
    <IframeDrawer :url="iframeDrawerURL" @close="handleDrawerClose" />
  </div>
</div>
```

Drawer control contract:

```text
<Button @click="handleOpenInNewTab">{{ drawerLabels.openInNewTab }}</Button>
<Button @click="handleClose">{{ drawerLabels.close }} <kbd>Esc</kbd></Button>
```

### 3. Contracts

| Item | Contract |
|------|----------|
| `IframeDrawer.url` | The same Linux.do topic URL used by the iframe and the “Open in new tab” button. |
| `IframeDrawer.close` emit | Emits only after close animation and iframe resource release complete. |
| Drawer header | Uses `.iframe-drawer-header`, absolute top positioning, `pointer-events: none` on the header container, and `pointer-events: auto` on buttons. |
| Drawer content | Uses `.iframe-drawer-content` with explicit `:style="{ top: drawerTopOffset }"` so iframe content starts below the header when controls are visible. |
| Drawer iframe sandbox | `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"`. `allow-popups` lets in-post links (`window.open` / `target="_blank"`) open new tabs; `allow-popups-to-escape-sandbox` keeps those tabs out of the sandbox so external pages load normally. Never add `allow-top-navigation*`. The iframe `src` is always a same-origin linux.do URL (validated by `normalizeLinuxDoTopicUrl`), so these tokens do not widen the iframe's reach over the host page. |
| Drawer buttons | Only “Open in new tab” and “Close / Esc” are allowed. The legacy “Copy link” button and clipboard behavior are removed. |
| Drawer hidden chrome | On iframe load `IframeDrawer.vue` calls `applyLinuxDoDrawerChrome(iframeRef.value?.contentDocument)` from `src/sites/linuxDo.ts`. The content script never runs inside the drawer sub-frame (manifest has no `all_frames`), so the host injects one `<style id="bewly-drawer-hidden-chrome">` into the same-origin iframe document to hide Linux.do's own full site header (`.d-header`) and left sidebar (`.sidebar-wrapper`). The injected style also collapses the Discourse sidebar grid column and sets an opaque iframe document background, so host-page chrome cannot show through empty iframe regions. The injector is null-safe and idempotent (single style per document). It must not touch the host page or the extension Shadow DOM. The drawer backdrop is opaque so host-page chrome cannot show through while the drawer is open. |
| Floating settings button | Uses `.linux-do-settings-button`, fixed bottom-right placement, and `z-index: 2147483646`. |
| Drawer root | Uses `.linux-do-drawer-root`, fixed full-screen placement, `z-index: 2147483647`, and is mounted only while `showIframeDrawer` is true. |
| Settings panel | Uses `role="dialog"`, localized labels, and checkbox bindings to shared settings fields. |

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|-----------|-------------------|
| Linux.do page loads and no drawer is open | Floating settings button is visible; `#bewly-wrapper` is absent. |
| Settings button is clicked | Settings panel appears above the page and below the drawer z-index. |
| Drawer opens | Drawer root covers the page with an opaque backdrop; iframe content cannot cover the extension-owned header buttons; linux.do's iframe header/sidebar chrome remains hidden. |
| Drawer iframe loads slowly or fails | Header buttons remain visible because they are not inside the iframe content area. |
| User presses `Esc` in the window or iframe | Drawer closes through `handleClose` and releases iframe resources. |
| User clicks “Open in new tab” | Opens `props.url` in a new tab and then closes the drawer. |
| User clicks an in-post link that opens a new tab | The browser opens the link in a new, non-sandboxed tab after Linux.do’s external-link confirmation. |
| Drawer iframe sandbox drops `allow-popups`/`allow-popups-to-escape-sandbox` | Treat as a regression; in-post links silently fail to open a new tab. |
| `allow-top-navigation*` appears in the drawer iframe sandbox | Treat as a regression; in-post links can navigate the top page out of the drawer. |
| Copy-link behavior appears in the drawer | Treat as a regression; remove clipboard logic and localized copy labels. |
| Top-level history calls appear in `IframeDrawer.vue` | Treat as a regression; history belongs in the content-script app. |
| Drawer opens on a topic | Inside the iframe the Linux.do full site header (`.d-header`) and left sidebar (`.sidebar-wrapper`) are hidden via the injected style; the host page (no drawer) keeps them. |
| `applyLinuxDoDrawerChrome` call or `~/sites/linuxDo` import removed from `IframeDrawer.vue` | Treat as a regression; the drawer reverts to showing Linux.do's sidebar and header icons. |

### 5. Good/Base/Bad Cases

- Good: floating settings button is always mounted inside the Shadow DOM, drawer root is only mounted while open, and drawer header controls stay outside the iframe content flow.
- Base: a new drawer button is added only if it does not require top-level page history or clipboard side effects.
- Bad: iframe drawer controls depend on UnoCSS dynamic classes that can be purged, or the iframe content is positioned from `top: 0` and covers the header.

### 6. Tests Required

- Source regression: assert `App.vue` contains `class="linux-do-settings-button"` and the wrapper opening tag includes `v-if="showIframeDrawer"`.
- Source regression: assert `IframeDrawer.vue` imports `Button`, contains `handleOpenInNewTab` and `handleClose`, and does not contain `copyLink`, `clipboard`, or localized “Copy link” text.
- Source regression: assert `IframeDrawer.vue` does not call `history.pushState`, `history.replaceState`, or `history.back`.
- Source regression: assert `IframeDrawer.vue` contains the exact `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"` string; `linuxDoMigration.spec.ts` asserts it verbatim, so update that assertion in lockstep with any sandbox change.
- Source regression: assert `IframeDrawer.vue` imports `applyLinuxDoDrawerChrome` from `~/sites/linuxDo` and calls it with `iframeRef.value?.contentDocument` in `handleIframeLoad`.
- Behavior: assert `applyLinuxDoDrawerChrome` injects a single `<style id="bewly-drawer-hidden-chrome">` covering `html, body` opaque background, `.sidebar-wrapper`, full `.d-header`, `#main-outlet-wrapper` grid-column collapse, and `#main-outlet` full-width placement; assert it is idempotent and null-safe.
- Behavior/build validation after component changes: run targeted `src/tests/linuxDoMigration.spec.ts`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` when packaging is affected.
- Manual browser check when possible: verify the settings button is visible on Linux.do and drawer controls remain visible over the iframe.

### 7. Wrong vs Correct

#### Wrong

```text
<div v-if="show" class="iframe-drawer-content" style="top: 0">
  <iframe :src="props.url" />
  <Button @click="copyLink">Copy link</Button>
</div>
```

The iframe can cover controls, and the drawer reintroduces removed clipboard behavior.

#### Correct

```text
<div v-if="headerShow" class="iframe-drawer-header" pointer-events-none>
  <Button pointer-events-auto @click="handleOpenInNewTab">{{ drawerLabels.openInNewTab }}</Button>
  <Button pointer-events-auto @click="handleClose">{{ drawerLabels.close }}</Button>
</div>
<div v-if="show" class="iframe-drawer-content" :style="{ top: drawerTopOffset }">
  <iframe :src="props.url" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" />
</div>
```

The header owns controls, iframe content starts below the header, and only approved drawer actions remain.

---

## Component Structure

- Use `<script setup lang="ts">` for Vue single-file components.
- Keep browser side effects in the content-script app unless the component owns the DOM resource it is cleaning up.
- Release iframe resources on component unmount and before emitting close.

---

## Props Conventions

- Define component props with `defineProps<{ ... }>()` and event payloads with `defineEmits<{ ... }>()`.
- Keep reusable component props minimal; `IframeDrawer` accepts a URL and emits close, while parent state controls route/history.

---

## Styling Patterns

- Prefer stable class names for injected overlay boundaries and critical layout offsets.
- Do not rely on generated dynamic utility classes for iframe/header separation where missing CSS would hide controls.
- Use CSS variables from `.linux-do-extension-root` for colors, radius, and top-bar height.

---

## Accessibility

- Icon-only buttons must have `aria-label`.
- Settings panels opened by a button should use `role="dialog"` and localized accessible labels.
- Drawer close remains keyboard-accessible through `Esc`.

---

## Common Mistakes

- Mounting a full-screen fixed wrapper before the drawer is open.
- Putting drawer action buttons inside the iframe content region.
- Reintroducing clipboard/copy-link behavior in `IframeDrawer.vue`.
- Handling top-level browser history inside reusable drawer components instead of `App.vue`.
- Tightening the drawer iframe sandbox (dropping `allow-popups` / `allow-popups-to-escape-sandbox`) so in-post links can no longer open new tabs.
- Adding `allow-top-navigation*` to the drawer iframe, letting in-post links navigate the whole page out of the drawer.
- Changing the iframe sandbox string without updating its verbatim assertion in `linuxDoMigration.spec.ts`.
