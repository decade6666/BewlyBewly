<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import {
  copyWebdavDraft,
  downloadSettings,
  isDraftDirty,
  isSavedConfigUsable,
  listSettingsBackups,
  mergeWebdavFields,
  normalizeDraft,
  settings,
  uploadSettings,
  validateSaveDraft,
  validateTestDraft,
  webdavTestViaBackground,
} from '~/logic'
import type { SettingsBackupSummary } from '~/logic/webdavBackups'
import type { WebdavValidationError } from '~/logic/webdavSettings'

import WebdavBackupPicker from './WebdavBackupPicker.vue'

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
  webdavPathInvalid: string
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
  webdavUploadCleanupPartial: string
  webdavUrl: string
  webdavUrlInvalid: string
  webdavUrlPlaceholder: string
  webdavUrlRequired: string
  webdavUsername: string
  webdavListBusy: string
  webdavListEmpty: string
  webdavListFail: string
  webdavBackupSelectorLabel: string
  webdavLegacyBackup: string
  webdavLegacyUnreadable: string
  webdavSelectedBackupNotFound: string
}
interface Props {
  visible: boolean
  labels: WebdavSettingsLabels
}
const props = defineProps<Props>()
const emit = defineEmits<{ (event: 'close'): void }>()
interface BackupPickerExposed {
  focusFirstControl: () => void
}
let dialogSessionId = 0
type ActiveOperation = null | 'test' | 'upload' | 'list' | 'download'
const activeOperation = ref<ActiveOperation>(null)
let operationId = 0
const draft = ref(copyWebdavDraft(settings.value))
const urlFieldError = ref<string>('')
const pathFieldError = ref<string>('')
const saveFeedback = ref<string>('')
const testResult = ref<string>('')
let testResultSessionId = 0
const transferStatus = ref<string>('')
const listedBackups = ref<readonly SettingsBackupSummary[]>([])
const selectedBackupId = ref<string>('')
const backupPickerVisible = ref(false)
const backupPickerWarnings = ref<readonly ('legacy_unreadable')[]>([])
const downloadButtonRef = ref<HTMLButtonElement | null>(null)
const backupPickerRef = ref<BackupPickerExposed | null>(null)
const pathInputRef = ref<HTMLInputElement | null>(null)
const isBusy = computed(() => activeOperation.value !== null)
const isDirty = computed(() => isDraftDirty(draft.value, settings.value))
const savedConfigUsable = computed(() => isSavedConfigUsable(settings.value))
const canTransfer = computed(() => !isBusy.value && !isDirty.value && savedConfigUsable.value)
const lastSyncText = computed(() => {
  if (!settings.value.webdavLastSyncTime)
    return props.labels.webdavNeverSynced
  return `${props.labels.webdavLastSync}: ${new Date(settings.value.webdavLastSyncTime).toLocaleString()}`
})
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
function focusDownloadTrigger() {
  nextTick(() => {
    if (downloadButtonRef.value) {
      downloadButtonRef.value.focus()
    }
    else {
      closeButtonRef.value?.focus()
    }
  })
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
function clearBackupPicker() {
  listedBackups.value = []
  selectedBackupId.value = ''
  backupPickerVisible.value = false
  backupPickerWarnings.value = []
}
function initDraft() {
  draft.value = copyWebdavDraft(settings.value)
  urlFieldError.value = ''
  pathFieldError.value = ''
  saveFeedback.value = ''
  testResult.value = ''
  testResultSessionId = 0
  clearBackupPicker()
}
function openDialog() {
  dialogSessionId++
  initDraft()
  nextTick(() => focusFirstControl())
}
function closeDialog() {
  dialogSessionId++
  // Discard transient state
  urlFieldError.value = ''
  pathFieldError.value = ''
  saveFeedback.value = ''
  testResult.value = ''
  testResultSessionId = 0
  clearBackupPicker()
  // Keep activeOperation + transferStatus to retain in-flight requests
  emit('close')
}
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
  urlFieldError.value = ''
  pathFieldError.value = ''
  saveFeedback.value = ''
  testResult.value = ''
  testResultSessionId = 0
  clearBackupPicker()
}
function showValidationError(error: WebdavValidationError) {
  if (error === 'path_invalid') {
    pathFieldError.value = props.labels.webdavPathInvalid
    nextTick(() => pathInputRef.value?.focus())
  }
  else {
    urlFieldError.value = error === 'url_required'
      ? props.labels.webdavUrlRequired
      : props.labels.webdavUrlInvalid
    nextTick(() => urlInputRef.value?.focus())
  }
}
function formatFailure(label: string, detail?: string): string {
  return detail ? `${label}: ${detail}` : label
}
function handleSave() {
  if (isBusy.value || backupPickerVisible.value)
    return
  const normalized = normalizeDraft(draft.value)
  const validationError = validateSaveDraft(normalized)
  if (validationError) {
    showValidationError(validationError)
    return
  }
  urlFieldError.value = ''
  pathFieldError.value = ''
  testResult.value = ''
  testResultSessionId = 0
  transferStatus.value = ''
  clearBackupPicker()
  settings.value = mergeWebdavFields(settings.value, normalized)
  draft.value = copyWebdavDraft(settings.value)
  saveFeedback.value = props.labels.webdavSaveSuccess
}
async function handleTest() {
  if (isBusy.value || backupPickerVisible.value)
    return
  const normalized = normalizeDraft(draft.value)
  const validationError = validateTestDraft(normalized)
  if (validationError) {
    showValidationError(validationError)
    return
  }
  urlFieldError.value = ''
  pathFieldError.value = ''
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
    if (result.warning === 'cleanup_partial') {
      transferStatus.value = props.labels.webdavUploadCleanupPartial
    }
    else if (result.ok) {
      transferStatus.value = props.labels.webdavUploadSuccess
    }
    else {
      transferStatus.value = formatFailure(props.labels.webdavUploadFail, result.error)
    }
  }
  finally {
    if (activeOperation.value === 'upload' && operationId === currentOpId)
      activeOperation.value = null
  }
}
async function handleListBackups() {
  if (!canTransfer.value)
    return
  const currentOpId = ++operationId
  const sessionId = dialogSessionId
  activeOperation.value = 'list'
  transferStatus.value = props.labels.webdavListBusy
  try {
    const result = await listSettingsBackups()
    if (!props.visible || dialogSessionId !== sessionId)
      return
    if (activeOperation.value !== 'list' || operationId !== currentOpId)
      return
    if (!result.ok) {
      transferStatus.value = props.labels.webdavListFail
      focusDownloadTrigger()
      return
    }
    const backups = result.backups ?? []
    if (backups.length === 0) {
      transferStatus.value = props.labels.webdavListEmpty
      focusDownloadTrigger()
      return
    }
    listedBackups.value = backups
    selectedBackupId.value = backups[0]?.id ?? ''
    backupPickerWarnings.value = result.warnings ?? []
    backupPickerVisible.value = true
    transferStatus.value = ''
    nextTick(() => backupPickerRef.value?.focusFirstControl())
  }
  finally {
    if (activeOperation.value === 'list' && operationId === currentOpId)
      activeOperation.value = null
  }
}
function handleBackupSelection(backupId: string) {
  selectedBackupId.value = backupId
}
function cancelBackupPicker() {
  backupPickerVisible.value = false
  clearBackupPicker()
  focusDownloadTrigger()
}
async function confirmDownload() {
  if (!canTransfer.value || !selectedBackupId.value)
    return
  backupPickerVisible.value = false
  const currentOpId = ++operationId
  activeOperation.value = 'download'
  transferStatus.value = props.labels.webdavDownloadBusy
  try {
    const result = await downloadSettings(selectedBackupId.value)
    if (activeOperation.value !== 'download' || operationId !== currentOpId)
      return
    if (result.ok) {
      transferStatus.value = props.labels.webdavDownloadSuccess
    }
    else if (result.error === 'selected_backup_not_found') {
      transferStatus.value = props.labels.webdavSelectedBackupNotFound
    }
    else if (result.error === 'remote_not_found') {
      transferStatus.value = props.labels.webdavDownloadNotFound
    }
    else {
      transferStatus.value = formatFailure(props.labels.webdavDownloadFail, result.error)
    }
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
      <div class="webdav-dialog-body">
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
        <label class="webdav-dialog-field">
          <span>{{ labels.webdavUrl }}</span>
          <input
            ref="urlInputRef"
            :value="draft.webdavUrl"
            type="url"
            :placeholder="labels.webdavUrlPlaceholder"
            :disabled="isBusy"
            :aria-invalid="urlFieldError ? 'true' : 'false'"
            :aria-describedby="urlFieldError ? 'webdav-dialog-url-error' : undefined"
            @input="handleTextInput('webdavUrl', $event)"
          >
        </label>
        <label class="webdav-dialog-field">
          <span>{{ labels.webdavUsername }}</span>
          <input
            :value="draft.webdavUsername"
            type="text"
            :disabled="isBusy"
            @input="handleTextInput('webdavUsername', $event)"
          >
        </label>
        <label class="webdav-dialog-field">
          <span>{{ labels.webdavPassword }}</span>
          <input
            :value="draft.webdavPassword"
            type="password"
            :disabled="isBusy"
            @input="handleTextInput('webdavPassword', $event)"
          >
        </label>
        <label class="webdav-dialog-field">
          <span>{{ labels.webdavPath }}</span>
          <input
            ref="pathInputRef"
            :value="draft.webdavPath"
            type="text"
            :disabled="isBusy"
            :aria-invalid="pathFieldError ? 'true' : 'false'"
            :aria-describedby="pathFieldError ? 'webdav-dialog-path-error' : undefined"
            @input="handleTextInput('webdavPath', $event)"
          >
        </label>
        <p v-if="urlFieldError" id="webdav-dialog-url-error" class="webdav-dialog-error" role="alert">
          {{ urlFieldError }}
        </p>
        <p v-if="pathFieldError" id="webdav-dialog-path-error" class="webdav-dialog-error" role="alert">
          {{ pathFieldError }}
        </p>
        <div class="webdav-dialog-actions">
          <button
            class="webdav-dialog-primary-button"
            type="button"
            :disabled="isBusy || backupPickerVisible"
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
        <hr class="webdav-dialog-separator">
        <div class="webdav-dialog-actions">
          <button
            class="webdav-dialog-secondary-button"
            type="button"
            :disabled="isBusy || backupPickerVisible"
            @click="handleTest"
          >
            {{ isBusy && activeOperation === 'test' ? labels.webdavTestBusy : labels.webdavTestConnection }}
          </button>
          <button
            class="webdav-dialog-secondary-button"
            type="button"
            :disabled="!canTransfer || backupPickerVisible"
            @click="handleUpload"
          >
            {{ isBusy && activeOperation === 'upload' ? labels.webdavUploadBusy : labels.webdavUpload }}
          </button>
          <template v-if="!backupPickerVisible">
            <button
              ref="downloadButtonRef"
              class="webdav-dialog-secondary-button"
              type="button"
              :disabled="!canTransfer"
              @click="handleListBackups"
            >
              {{ isBusy && (activeOperation === 'list' || activeOperation === 'download') ? labels.webdavDownloadBusy : labels.webdavDownload }}
            </button>
          </template>
        </div>
        <div v-if="backupPickerVisible" class="webdav-dialog-confirm">
          <WebdavBackupPicker
            ref="backupPickerRef"
            :backups="listedBackups"
            :selected-backup-id="selectedBackupId"
            :disabled="isBusy"
            :labels="{
              webdavBackupSelectorLabel: labels.webdavBackupSelectorLabel,
              webdavLegacyBackup: labels.webdavLegacyBackup,
              webdavLegacyUnreadable: labels.webdavLegacyUnreadable,
              webdavDownloadWarning: labels.webdavDownloadWarning,
              webdavDownloadConfirm: labels.webdavDownloadConfirm,
              webdavDownloadCancel: labels.webdavDownloadCancel,
            }"
            :warnings="backupPickerWarnings"
            @select="handleBackupSelection"
            @confirm="confirmDownload"
            @cancel="cancelBackupPicker"
          />
        </div>
        <p v-if="isDirty && !isBusy" class="webdav-dialog-hint">
          {{ labels.webdavDirtyHint }}
        </p>
        <p v-else-if="!savedConfigUsable && !isDirty && !isBusy" class="webdav-dialog-hint">
          {{ labels.webdavDisabledHint }}
        </p>
        <p v-if="saveFeedback" class="webdav-dialog-feedback" role="status" aria-live="polite">
          {{ saveFeedback }}
        </p>
        <p v-if="testResultSessionId === dialogSessionId && testResult" class="webdav-dialog-status" role="status" aria-live="polite">
          {{ testResult }}
        </p>
        <p v-if="transferStatus" class="webdav-dialog-status" role="status" aria-live="polite">
          {{ transferStatus }}
        </p>
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
