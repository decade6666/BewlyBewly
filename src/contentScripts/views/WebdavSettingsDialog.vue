<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import {
  copyWebdavDraft,
  downloadSettings,
  isDraftDirty,
  isSavedConfigUsable,
  mergeWebdavFields,
  normalizeDraft,
  settings,
  uploadSettings,
  validateSaveDraft,
  validateTestDraft,
  webdavTestViaBackground,
} from '~/logic'

interface WebdavSettingsLabels {
  webdavCancel: string
  webdavClose: string
  webdavDisabledHint: string
  webdavDirtyHint: string
  webdavDownload: string
  webdavDownloadBusy: string
  webdavDownloadCancel: string
  webdavDownloadConfirm: string
  webdavDownloadFail: string
  webdavDownloadNotFound: string
  webdavDownloadSuccess: string
  webdavDownloadWarning: string
  webdavEnable: string
  webdavLastSync: string
  webdavNeverSynced: string
  webdavPassword: string
  webdavPath: string
  webdavSave: string
  webdavSaveSuccess: string
  webdavSettings: string
  webdavTestBusy: string
  webdavTestConnection: string
  webdavTestFail: string
  webdavTestSuccess: string
  webdavUpload: string
  webdavUploadBusy: string
  webdavUploadFail: string
  webdavUploadSuccess: string
  webdavUrl: string
  webdavUrlInvalid: string
  webdavUrlPlaceholder: string
  webdavUrlRequired: string
  webdavUsername: string
}

interface Props {
  visible: boolean
  labels: WebdavSettingsLabels
}

const props = defineProps<Props>()
const emit = defineEmits<{ (event: 'close'): void }>()

// ── Dialog session ──────────────────────────────────────────
let dialogSessionId = 0

// ── Operation serialization ──────────────────────────────────
type ActiveOperation = null | 'test' | 'upload' | 'download'
const activeOperation = ref<ActiveOperation>(null)
let operationId = 0

// ── Draft state ──────────────────────────────────────────────
const draft = ref(copyWebdavDraft(settings.value))
const fieldError = ref<string>('')
const saveFeedback = ref<string>('')

// ── Test result invalidation ─────────────────────────────────
const testResult = ref<string>('')
let testResultSessionId = 0

// ── Transfer status retention (survives close/reopen) ────────
const transferStatus = ref<string>('')

// ── Download confirmation (inline, not a nested modal) ───────
const downloadConfirmationVisible = ref(false)

// ── Computed invariants ──────────────────────────────────────
const isBusy = computed(() => activeOperation.value !== null)
const isDirty = computed(() => isDraftDirty(draft.value, settings.value))
const savedConfigUsable = computed(() => isSavedConfigUsable(settings.value))
const canTransfer = computed(() => !isBusy.value && !isDirty.value && savedConfigUsable.value)

const lastSyncText = computed(() => {
  if (!settings.value.webdavLastSyncTime)
    return props.labels.webdavNeverSynced
  return `${props.labels.webdavLastSync}: ${new Date(settings.value.webdavLastSyncTime).toLocaleString()}`
})

// ── Focus helpers ────────────────────────────────────────────
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const dialogRef = ref<HTMLElement | null>(null)
const enableSwitchRef = ref<HTMLInputElement | null>(null)
const urlInputRef = ref<HTMLInputElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)

function focusFirstControl() {
  const target = isBusy.value ? closeButtonRef.value : enableSwitchRef.value ?? closeButtonRef.value
  target?.focus()
}

function getFocusableElements(): HTMLElement[] {
  if (!dialogRef.value)
    return []

  return Array.from(dialogRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(element => element.getClientRects().length > 0)
}

function getActiveElement(): Element | null {
  const root = dialogRef.value?.getRootNode()
  return root instanceof ShadowRoot ? root.activeElement : document.activeElement
}

function handleTabKeydown(event: KeyboardEvent) {
  const focusableElements = getFocusableElements()
  const first = focusableElements.at(0)
  const last = focusableElements.at(-1)
  const activeElement = getActiveElement()
  const focusOutsideDialog = !activeElement || !dialogRef.value?.contains(activeElement)

  if (!first || !last) {
    event.preventDefault()
    dialogRef.value?.focus()
    return
  }

  if (event.shiftKey && (activeElement === first || focusOutsideDialog)) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && (activeElement === last || focusOutsideDialog)) {
    event.preventDefault()
    first.focus()
  }
}

// ── Open / close ────────────────────────────────────────────
function initDraft() {
  draft.value = copyWebdavDraft(settings.value)
  fieldError.value = ''
  saveFeedback.value = ''
  testResult.value = ''
  testResultSessionId = 0
  downloadConfirmationVisible.value = false
}

function openDialog() {
  dialogSessionId++
  initDraft()
  nextTick(() => focusFirstControl())
}

function closeDialog() {
  dialogSessionId++
  // Discard transient state
  fieldError.value = ''
  saveFeedback.value = ''
  testResult.value = ''
  testResultSessionId = 0
  downloadConfirmationVisible.value = false
  // Keep activeOperation + transferStatus to retain in-flight requests
  emit('close')
}

// ── Draft feedback ────────────────────────────────────────────
type WebdavTextField = 'webdavUrl' | 'webdavUsername' | 'webdavPassword' | 'webdavPath'

function setDraftField<K extends keyof typeof draft.value>(key: K, value: (typeof draft.value)[K]) {
  if (isBusy.value)
    return

  draft.value = { ...draft.value, [key]: value }
  handleDraftEdit()
}

function handleEnabledChange(event: Event) {
  const input = event.target as HTMLInputElement
  setDraftField('webdavEnabled', input.checked)
}

function handleTextInput(field: WebdavTextField, event: Event) {
  const input = event.target as HTMLInputElement
  setDraftField(field, input.value)
}

function handleDraftEdit() {
  fieldError.value = ''
  saveFeedback.value = ''
  testResult.value = ''
  testResultSessionId = 0
  downloadConfirmationVisible.value = false
}

function showUrlError(error: 'url_required' | 'url_invalid') {
  fieldError.value = error === 'url_required'
    ? props.labels.webdavUrlRequired
    : props.labels.webdavUrlInvalid
  nextTick(() => urlInputRef.value?.focus())
}

function formatFailure(label: string, detail?: string): string {
  return detail ? `${label}: ${detail}` : label
}

// ── Save ────────────────────────────────────────────────────
function handleSave() {
  if (isBusy.value || downloadConfirmationVisible.value)
    return

  const normalized = normalizeDraft(draft.value)
  const validationError = validateSaveDraft(normalized)
  if (validationError) {
    showUrlError(validationError)
    return
  }
  fieldError.value = ''
  testResult.value = ''
  testResultSessionId = 0
  transferStatus.value = ''
  settings.value = mergeWebdavFields(settings.value, normalized)
  draft.value = copyWebdavDraft(settings.value)
  saveFeedback.value = props.labels.webdavSaveSuccess
}

// ── Test ────────────────────────────────────────────────────
async function handleTest() {
  if (isBusy.value || downloadConfirmationVisible.value)
    return

  const normalized = normalizeDraft(draft.value)
  const validationError = validateTestDraft(normalized)
  if (validationError) {
    showUrlError(validationError)
    return
  }
  fieldError.value = ''
  saveFeedback.value = ''
  testResult.value = ''
  testResultSessionId = 0
  const sessionId = dialogSessionId
  const currentOpId = ++operationId
  activeOperation.value = 'test'
  try {
    const result = await webdavTestViaBackground({
      url: normalized.webdavUrl,
      username: normalized.webdavUsername,
      password: normalized.webdavPassword,
      path: normalized.webdavPath,
    })
    if (activeOperation.value !== 'test' || operationId !== currentOpId)
      return
    if (!props.visible || dialogSessionId !== sessionId)
      return
    testResult.value = result.ok
      ? props.labels.webdavTestSuccess
      : formatFailure(props.labels.webdavTestFail, result.error || `HTTP ${result.status}`)
    testResultSessionId = sessionId
  }
  finally {
    if (activeOperation.value === 'test' && operationId === currentOpId)
      activeOperation.value = null
  }
}

// ── Upload ──────────────────────────────────────────────────
async function handleUpload() {
  if (!canTransfer.value)
    return
  const currentOpId = ++operationId
  activeOperation.value = 'upload'
  transferStatus.value = props.labels.webdavUploadBusy
  try {
    const result = await uploadSettings()
    if (activeOperation.value !== 'upload' || operationId !== currentOpId)
      return
    transferStatus.value = result.ok
      ? props.labels.webdavUploadSuccess
      : formatFailure(props.labels.webdavUploadFail, result.error)
  }
  finally {
    if (activeOperation.value === 'upload' && operationId === currentOpId)
      activeOperation.value = null
  }
}

// ── Download ─────────────────────────────────────────────────
function showDownloadConfirm() {
  if (!canTransfer.value)
    return
  downloadConfirmationVisible.value = true
}

function cancelDownloadConfirm() {
  downloadConfirmationVisible.value = false
}

async function confirmDownload() {
  if (!canTransfer.value)
    return

  downloadConfirmationVisible.value = false
  const currentOpId = ++operationId
  activeOperation.value = 'download'
  transferStatus.value = props.labels.webdavDownloadBusy

  try {
    const result = await downloadSettings()

    if (activeOperation.value !== 'download' || operationId !== currentOpId)
      return

    if (result.ok)
      transferStatus.value = props.labels.webdavDownloadSuccess
    else if (result.error === 'remote_not_found')
      transferStatus.value = props.labels.webdavDownloadNotFound
    else
      transferStatus.value = formatFailure(props.labels.webdavDownloadFail, result.error)
  }
  finally {
    if (activeOperation.value === 'download' && operationId === currentOpId)
      activeOperation.value = null
  }
}

watch(() => props.visible, (v) => {
  if (v)
    openDialog()
})
</script>

<template>
  <div
    v-if="visible"
    class="webdav-dialog-overlay"
    @click.self="closeDialog"
  >
    <div
      ref="dialogRef"
      class="webdav-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="webdav-dialog-title"
      tabindex="-1"
      @keydown.tab="handleTabKeydown"
    >
      <!-- Header -->
      <header class="webdav-dialog-header">
        <h2 id="webdav-dialog-title">
          {{ labels.webdavSettings }}
        </h2>
        <button
          ref="closeButtonRef"
          class="webdav-dialog-close-button"
          type="button"
          :aria-label="labels.webdavClose"
          @click="closeDialog"
        >
          <span i-mingcute:close-line aria-hidden="true" />
        </button>
      </header>

      <!-- Body -->
      <div class="webdav-dialog-body">
        <!-- Enable switch -->
        <label class="webdav-dialog-option">
          <input
            ref="enableSwitchRef"
            :checked="draft.webdavEnabled"
            class="webdav-dialog-enable-switch"
            type="checkbox"
            :disabled="isBusy"
            @change="handleEnabledChange"
          >
          <span>{{ labels.webdavEnable }}</span>
        </label>

        <!-- URL -->
        <label class="webdav-dialog-field">
          <span>{{ labels.webdavUrl }}</span>
          <input
            ref="urlInputRef"
            :value="draft.webdavUrl"
            type="url"
            :placeholder="labels.webdavUrlPlaceholder"
            :disabled="isBusy"
            :aria-invalid="fieldError ? 'true' : 'false'"
            :aria-describedby="fieldError ? 'webdav-dialog-url-error' : undefined"
            @input="handleTextInput('webdavUrl', $event)"
          >
        </label>

        <!-- Username -->
        <label class="webdav-dialog-field">
          <span>{{ labels.webdavUsername }}</span>
          <input
            :value="draft.webdavUsername"
            type="text"
            :disabled="isBusy"
            @input="handleTextInput('webdavUsername', $event)"
          >
        </label>

        <!-- Password -->
        <label class="webdav-dialog-field">
          <span>{{ labels.webdavPassword }}</span>
          <input
            :value="draft.webdavPassword"
            type="password"
            :disabled="isBusy"
            @input="handleTextInput('webdavPassword', $event)"
          >
        </label>

        <!-- Path -->
        <label class="webdav-dialog-field">
          <span>{{ labels.webdavPath }}</span>
          <input
            :value="draft.webdavPath"
            type="text"
            :disabled="isBusy"
            @input="handleTextInput('webdavPath', $event)"
          >
        </label>

        <!-- Field error -->
        <p v-if="fieldError" id="webdav-dialog-url-error" class="webdav-dialog-error" role="alert">
          {{ fieldError }}
        </p>

        <!-- Save / Cancel -->
        <div class="webdav-dialog-actions">
          <button
            class="webdav-dialog-primary-button"
            type="button"
            :disabled="isBusy || downloadConfirmationVisible"
            @click="handleSave"
          >
            {{ labels.webdavSave }}
          </button>
          <button
            class="webdav-dialog-secondary-button"
            type="button"
            @click="closeDialog"
          >
            {{ isBusy ? labels.webdavClose : labels.webdavCancel }}
          </button>
        </div>

        <!-- Separator -->
        <hr class="webdav-dialog-separator">

        <!-- Operations -->
        <div class="webdav-dialog-actions">
          <button
            class="webdav-dialog-secondary-button"
            type="button"
            :disabled="isBusy || downloadConfirmationVisible"
            @click="handleTest"
          >
            {{ isBusy && activeOperation === 'test' ? labels.webdavTestBusy : labels.webdavTestConnection }}
          </button>
          <button
            class="webdav-dialog-secondary-button"
            type="button"
            :disabled="!canTransfer || downloadConfirmationVisible"
            @click="handleUpload"
          >
            {{ isBusy && activeOperation === 'upload' ? labels.webdavUploadBusy : labels.webdavUpload }}
          </button>
          <template v-if="!downloadConfirmationVisible">
            <button
              class="webdav-dialog-secondary-button"
              type="button"
              :disabled="!canTransfer"
              @click="showDownloadConfirm"
            >
              {{ isBusy && activeOperation === 'download' ? labels.webdavDownloadBusy : labels.webdavDownload }}
            </button>
          </template>
        </div>

        <!-- Download confirmation (inline) -->
        <div
          v-if="downloadConfirmationVisible"
          class="webdav-dialog-confirm"
          role="group"
          :aria-label="labels.webdavDownloadWarning"
        >
          <p>{{ labels.webdavDownloadWarning }}</p>
          <div class="webdav-dialog-actions">
            <button
              class="webdav-dialog-secondary-button"
              type="button"
              :disabled="!canTransfer"
              @click="confirmDownload"
            >
              {{ labels.webdavDownloadConfirm }}
            </button>
            <button
              class="webdav-dialog-secondary-button"
              type="button"
              @click="cancelDownloadConfirm"
            >
              {{ labels.webdavDownloadCancel }}
            </button>
          </div>
        </div>

        <!-- Transfer hint while dirty or config disabled -->
        <p v-if="isDirty && !isBusy" class="webdav-dialog-hint">
          {{ labels.webdavDirtyHint }}
        </p>
        <p v-else-if="!savedConfigUsable && !isDirty && !isBusy" class="webdav-dialog-hint">
          {{ labels.webdavDisabledHint }}
        </p>

        <!-- Save feedback -->
        <p v-if="saveFeedback" class="webdav-dialog-feedback" role="status" aria-live="polite">
          {{ saveFeedback }}
        </p>

        <!-- Test result (only shown when fresh in current session) -->
        <p v-if="testResultSessionId === dialogSessionId && testResult" class="webdav-dialog-status" role="status" aria-live="polite">
          {{ testResult }}
        </p>

        <!-- Transfer status -->
        <p v-if="transferStatus" class="webdav-dialog-status" role="status" aria-live="polite">
          {{ transferStatus }}
        </p>

        <!-- Last sync -->
        <p class="webdav-dialog-hint">
          {{ lastSyncText }}
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.webdav-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgb(0 0 0 / 45%);
  pointer-events: auto;
}

.webdav-dialog {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: min(92vw, 440px);
  max-height: 90vh;
  padding: 20px;
  overflow: auto;
  color: var(--bew-text-1);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: var(--bew-radius);
  box-shadow: 0 24px 60px hsl(220deg 40% 2% / 28%);
}

.webdav-dialog-header {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
}

.webdav-dialog-close-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--bew-theme-color);
    background: var(--bew-fill-2);
    outline: none;
  }
}

.webdav-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.webdav-dialog-option {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 14px;
  cursor: pointer;

  input {
    width: 16px;
    height: 16px;
    accent-color: var(--bew-theme-color);
  }
}

.webdav-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--bew-text-2);
}

.webdav-dialog-field span {
  line-height: 1.4;
}

.webdav-dialog-field input {
  width: 100%;
  min-width: 0;
  height: 34px;
  box-sizing: border-box;
  padding: 0 10px;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;

  &:focus-visible {
    border-color: var(--bew-theme-color);
    outline: none;
  }
}

.webdav-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.webdav-dialog-primary-button {
  min-height: 34px;
  padding: 0 14px;
  color: var(--bew-text-1);
  background: var(--bew-theme-color);
  border: 1px solid var(--bew-theme-color);
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    opacity: 0.85;
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.webdav-dialog-secondary-button {
  min-height: 34px;
  padding: 0 10px;
  color: var(--bew-text-1);
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    color: var(--bew-theme-color);
    background: var(--bew-fill-2);
    outline: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.webdav-dialog-separator {
  width: 100%;
  height: 0;
  margin: 0;
  border: 0;
  border-top: 1px solid var(--bew-border-color);
}

.webdav-dialog-confirm {
  padding: 10px;
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;

  p {
    margin: 0 0 8px;
    font-size: 13px;
  }
}

.webdav-dialog-hint,
.webdav-dialog-feedback,
.webdav-dialog-status {
  margin: 0;
  font-size: 12px;
}

.webdav-dialog-hint {
  color: var(--bew-text-2);
}

.webdav-dialog-feedback {
  color: var(--bew-theme-color);
}

.webdav-dialog-status {
  color: var(--bew-theme-color);
}

.webdav-dialog-error {
  margin: 0;
  color: var(--bew-error-color);
  font-size: 12px;
  font-weight: 600;
}
</style>
