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

---

## Scenario: Async Backup Picker Inside the WebDAV Dialog

### 1. Scope / Trigger

- Trigger: changing a modal flow that asynchronously swaps an action button for a backup-selection subview inside the same Shadow DOM dialog.
- Applies to `src/contentScripts/views/WebdavSettingsDialog.vue`, `src/contentScripts/views/WebdavBackupPicker.vue`, and the related WebDAV contract tests.
- This requires code-spec depth because the flow combines async LIST/restore state, field-level validation focus, and modal focus restoration rules inside the host page's Shadow DOM.

### 2. Signatures

```typescript
type ActiveOperation = null | 'test' | 'upload' | 'list' | 'download'

function clearBackupPicker(): void
function focusDownloadTrigger(): void
function showValidationError(error: WebdavValidationError): void
async function handleListBackups(): Promise<void>
function handleBackupSelection(backupId: string): void
async function confirmDownload(): Promise<void>
function cancelBackupPicker(): void
```

Presentational picker contract:

```typescript
interface BackupPickerExposed {
  focusFirstControl: () => void
}

defineExpose({ focusFirstControl })
```

### 3. Contracts

| Item | Contract |
|---|---|
| Picker ownership | `WebdavBackupPicker.vue` is presentational only: it renders labels/select/buttons, emits `select` / `confirm` / `cancel`, and never reads global settings or issues network calls. |
| Async list phase | Clicking the dialog's Download action enters `activeOperation = 'list'` and calls `listSettingsBackups()` before any restore attempt. |
| Default selection | On successful non-empty list, the dialog selects the newest backup (`result.backups[0]?.id`) before rendering the picker. |
| Selection behavior | Changing the native `<select>` only updates local `selectedBackupId`; it must not call `downloadSettings(...)`. |
| Confirm behavior | Only the explicit Restore action calls `downloadSettings(selectedBackupId)`. |
| Picker focus | After successful picker render, `nextTick(() => backupPickerRef.value?.focusFirstControl())` must place focus inside the picker. |
| Failure/empty/cancel focus | List failure, empty list, or picker cancel must `nextTick` focus `downloadButtonRef`, falling back to `closeButtonRef` if the download button is unavailable. Focus must never be left on the page body. |
| Path validation focus | `path_invalid` must populate a dedicated path error node, set path-specific `aria-invalid` / `aria-describedby`, and focus `pathInputRef`. URL errors retain URL-specific focus and error wiring. |
| Transient picker state | `clearBackupPicker()` runs on draft edit, save, and close so stale list results do not survive configuration changes or dialog reopen. |
| Durable transfer status | Upload/download final status may remain visible across close/reopen; the picker itself is transient and must not persist across session changes. |

### 4. Validation & Error Matrix

| Condition | Expected handling |
|---|---|
| `listSettingsBackups()` returns backups | Show picker, select latest backup, and focus the picker's first control on the next tick. |
| `listSettingsBackups()` returns an empty list | Show the localized empty-list status and restore focus to the download trigger/close fallback. |
| `listSettingsBackups()` fails | Show the localized list-failure status and restore focus to the download trigger/close fallback. |
| User changes `<select>` value | Update `selectedBackupId` only; no network call. |
| User confirms restore | Call `downloadSettings(selectedBackupId)` exactly once. |
| User cancels picker | Hide picker, clear transient picker state, and restore focus to download trigger/close fallback. |
| Validation returns `path_invalid` | Show path-specific message, mark the path field invalid, and focus the path input. |
| Validation returns `url_required` / `url_invalid` | Show URL-specific message, mark the URL field invalid, and focus the URL input. |
| Dialog closes while a late list result arrives | Discard the result by session/operation guard; do not reopen or repopulate the picker. |

### 5. Good/Base/Bad Cases

- Good: the dialog lists backups first, defaults to the newest result, focuses the picker, and restores focus to the download button after cancel without leaving the Shadow DOM modal.
- Base: a validation error only highlights the corresponding field and does not affect the other field's ARIA wiring.
- Bad: changing the backup selection immediately triggers restore, or a path error reuses the URL error node and URL input focus.
- Bad: the picker component imports sync logic or global settings instead of remaining presentational.

### 6. Tests Required

- `webdavVersionedBackupsContract.spec.ts` must assert:
  - all locale objects contain the new list/path/legacy/cleanup labels;
  - `WebdavBackupPicker.vue` uses a native `<select>` with explicit `<label>` and `defineExpose({ focusFirstControl })`;
  - `handleListBackups()` sets the default latest selection and does not call `downloadSettings(...)`;
  - `handleBackupSelection()` only updates local selection;
  - `confirmDownload()` uses `downloadSettings(selectedBackupId)`;
  - `showValidationError()` routes `path_invalid` to the path field and URL errors to the URL field;
  - `clearBackupPicker()` is called on edit/save/close;
  - focus helpers and fallback refs are present in the dialog source.
- `linuxDoMigration.spec.ts` must keep dialog accessibility source contracts and updated WebDAV workflow assertions green.
- Static gates include targeted WebDAV UI Vitest coverage, `pnpm typecheck`, task-owned ESLint, and `pnpm build`.

### 7. Wrong vs Correct

#### Wrong

```typescript
function handleBackupSelection(backupId: string) {
  selectedBackupId.value = backupId
  void downloadSettings(backupId)
}
```

This makes selection itself destructive and bypasses the explicit confirmation step.

#### Correct

```typescript
function handleBackupSelection(backupId: string) {
  selectedBackupId.value = backupId
}

async function confirmDownload() {
  if (!selectedBackupId.value)
    return

  await downloadSettings(selectedBackupId.value)
}
```

This keeps selection local, preserves the confirmation step, and matches the modal focus/async state contract.
