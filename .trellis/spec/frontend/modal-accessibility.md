# Shadow DOM Modal Accessibility

> Executable contracts for modal dialogs rendered by the Linux.do content script.

---

## Scenario: Accessible Modal Inside the Content-Script Shadow Root

### 1. Scope / Trigger

- Trigger: adding or changing a modal dialog under `#bewly` in `src/contentScripts/**`.
- Applies when the dialog must isolate keyboard interaction from the Linux.do host page.
- The app runs inside an open Shadow DOM, so `document.activeElement` alone is not a reliable focus source.

### 2. Signatures

```typescript
function getActiveElement(): Element | null
function handleTabKeydown(event: KeyboardEvent): void
function handleGlobalKeydown(event: KeyboardEvent): void
function closeDialog(): void
```

App-level Escape listener:

```typescript
useEventListener(document, 'keydown', handleGlobalKeydown, { capture: true })
```

### 3. Contracts

| Item | Contract |
|------|----------|
| Dialog semantics | Render `role="dialog"`, `aria-modal="true"`, and a localized accessible title through `aria-labelledby` or `aria-label`. |
| Focus entry | After render, focus the first enabled control; if an operation makes it unavailable, focus an enabled close control. |
| Active element | Resolve `dialog.getRootNode()` and use `ShadowRoot.activeElement`; fall back to `document.activeElement` outside a shadow root. |
| Tab containment | Recompute visible, enabled focusable elements on every Tab keydown and wrap first/last for Shift+Tab/Tab. |
| Underlying UI | Apply `inert` only to the underlying settings surface while the child modal is open; never inert the modal itself. |
| Escape routing | Handle Escape on `document` in capture phase while the modal is open, call `preventDefault()`, `stopPropagation()`, and `stopImmediatePropagation()`, then close the modal. |
| Focus restoration | After close and the next Vue tick, restore focus to the button that opened the modal. |
| Async close | Classify operation state before implementation: transient dialog-session results must be invalidated after close; explicitly durable transfer state may survive close/reopen. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|-----------|-------------------|
| Focus is on the last enabled visible control and Tab is pressed | Prevent the default move and focus the first enabled visible control. |
| Focus is on the first enabled visible control and Shift+Tab is pressed | Prevent the default move and focus the last enabled visible control. |
| Focus is unexpectedly outside the dialog when Tab is handled | Move focus to the first control, or the last control for Shift+Tab. |
| No enabled visible controls exist | Prevent default and focus the dialog container, which must have `tabindex="-1"`. |
| Escape is pressed while the modal is open | Consume the event immediately, close once, and restore trigger focus. |
| A later sibling `document` capture listener exists | It must not observe the consumed Escape event. |
| The modal closes while an async transient request is pending | Let the request finish, but discard presentation tied to the closed dialog session. |
| The modal closes while a durable transfer is pending | Let the request finish and preserve the documented pending/final transfer status. |

### 5. Good/Base/Bad Cases

- Good: the modal enters focus, wraps Tab in both directions, makes the parent surface inert, consumes Escape before later host listeners, and restores trigger focus.
- Base: a non-async modal applies the same focus, inert, and Escape contracts without session-result state.
- Bad: focus uses only `document.activeElement`, Escape is handled only on the overlay subtree, or `stopPropagation()` is treated as sufficient to block sibling listeners on `document`.

### 6. Tests Required

- Source/unit contract: assert the dialog exposes modal ARIA attributes, a focus trap, ShadowRoot-aware active-element lookup, and capture-phase Escape handling.
- State contract: assert Save/edit/close clears stale transient feedback without clearing explicitly retained transfer state.
- Real-browser test with the freshly built `extension/` loaded:
  - pierce `document.querySelector('#bewly').shadowRoot`;
  - assert initial focus and parent `inert` state;
  - assert Tab and Shift+Tab wrap;
  - assert Escape closes and restores trigger focus;
  - register a later sibling `document` capture listener and assert it does not observe Escape;
  - for async dialogs, assert close/reopen suppression or retention according to the operation contract.
- Static gates remain required: relevant Vitest tests, `pnpm typecheck`, task-owned ESLint, and `pnpm build`.

### 7. Wrong vs Correct

#### Wrong

```typescript
function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.stopPropagation()
    closeDialog()
  }
}

useEventListener(document, 'keydown', handleGlobalKeydown)
```

This runs outside capture phase, does not prevent the default action, and allows later sibling listeners on the same target to observe Escape.

#### Correct

```typescript
function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !showDialog.value)
    return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  closeDialog()
}

useEventListener(document, 'keydown', handleGlobalKeydown, { capture: true })
```

```typescript
function getActiveElement(dialog: HTMLElement): Element | null {
  const root = dialog.getRootNode()
  return root instanceof ShadowRoot ? root.activeElement : document.activeElement
}
```

These contracts make modal behavior explicit across the content-script Shadow DOM and the host page's event listeners.
