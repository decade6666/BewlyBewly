import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function countOccurrences(source: string, token: string): number {
  return source.match(new RegExp(token, 'g'))?.length ?? 0
}

function sliceBetween(source: string, start: string, end?: string): string {
  const startIndex = source.indexOf(start)
  expect(startIndex).toBeGreaterThanOrEqual(0)

  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length
  expect(endIndex).toBeGreaterThan(startIndex)

  return source.slice(startIndex, endIndex)
}

describe('webdav versioned backup UI source contract', () => {
  it('adds the required WebDAV picker and path-validation strings to every app locale and dialog label interface', async () => {
    const appSource = await readFile(resolve('src/contentScripts/views/App.vue'), 'utf8')
    const dialogSource = await readFile(resolve('src/contentScripts/views/WebdavSettingsDialog.vue'), 'utf8')

    const requiredLocaleKeys = [
      'webdavPathInvalid',
      'webdavListBusy',
      'webdavListEmpty',
      'webdavListFail',
      'webdavBackupSelectorLabel',
      'webdavLegacyBackup',
      'webdavLegacyUnreadable',
      'webdavSelectedBackupNotFound',
      'webdavUploadCleanupPartial',
      'webdavDownloadWarning',
      'webdavDownloadConfirm',
    ]

    for (const key of requiredLocaleKeys)
      expect(countOccurrences(appSource, `${key}:`)).toBe(4)

    for (const key of requiredLocaleKeys)
      expect(dialogSource).toContain(`${key}: string`)
  })

  it('keeps the backup picker presentational with an explicit label, native select, local date rendering, and defineExpose focus hook', async () => {
    const pickerSource = await readFile(resolve('src/contentScripts/views/WebdavBackupPicker.vue'), 'utf8')

    expect(pickerSource).toContain('defineProps')
    expect(pickerSource).toContain('defineEmits')
    expect(pickerSource).toContain('(event: \'select\', backupId: string)')
    expect(pickerSource).toContain('(event: \'confirm\')')
    expect(pickerSource).toContain('(event: \'cancel\')')
    expect(pickerSource).toContain('<label')
    expect(pickerSource).toContain('for="webdav-backup-select"')
    expect(pickerSource).toContain('<select')
    expect(pickerSource).toContain('id="webdav-backup-select"')
    expect(pickerSource).toContain('toLocaleString()')
    expect(pickerSource).toContain('backup.source === \'legacy\'')
    expect(pickerSource).toContain('defineExpose({ focusFirstControl })')

    expect(pickerSource).not.toContain('settings.value')
    expect(pickerSource).not.toContain('listSettingsBackups')
    expect(pickerSource).not.toContain('downloadSettings')
    expect(pickerSource).not.toContain('uploadSettings')
    expect(pickerSource).not.toContain('webdavTestViaBackground')
    expect(pickerSource).not.toContain('fetch(')
    expect(pickerSource).not.toContain('browser.runtime')
  })

  it('lists backups before restore, defaults to the latest backup, and only restores the confirmed selection', async () => {
    const dialogSource = await readFile(resolve('src/contentScripts/views/WebdavSettingsDialog.vue'), 'utf8')
    const listHandler = sliceBetween(dialogSource, 'async function handleListBackups()', 'function handleBackupSelection(')
    const selectionHandler = sliceBetween(dialogSource, 'function handleBackupSelection(', 'async function confirmDownload()')
    const confirmHandler = sliceBetween(dialogSource, 'async function confirmDownload()', 'watch(() => props.visible')

    expect(dialogSource).toContain('import WebdavBackupPicker from \'./WebdavBackupPicker.vue\'')
    expect(dialogSource).toContain('listSettingsBackups')
    expect(dialogSource).toContain('const listedBackups = ref<readonly SettingsBackupSummary[]>([])')
    expect(dialogSource).toContain('const selectedBackupId = ref<string>(\'\')')
    expect(dialogSource).toContain('type ActiveOperation = null | \'test\' | \'upload\' | \'list\' | \'download\'')
    expect(dialogSource).toContain('activeOperation.value = \'list\'')

    expect(listHandler).toContain('const result = await listSettingsBackups()')
    expect(listHandler).toContain('const backups = result.backups ?? []')
    expect(listHandler).toContain('listedBackups.value = backups')
    expect(listHandler).toContain('selectedBackupId.value = backups[0]?.id ?? \'\'')
    expect(listHandler).toContain('props.labels.webdavListEmpty')
    expect(listHandler).toContain('props.labels.webdavListFail')
    expect(listHandler).not.toContain('downloadSettings(')

    expect(selectionHandler).toContain('selectedBackupId.value = backupId')
    expect(selectionHandler).not.toContain('downloadSettings(')

    expect(confirmHandler).toContain('downloadSettings(selectedBackupId.value)')
    expect(confirmHandler).toContain('props.labels.webdavSelectedBackupNotFound')
  })

  it('preserves the async focus contract, clears stale picker state, and routes url/path validation to separate field errors', async () => {
    const dialogSource = await readFile(resolve('src/contentScripts/views/WebdavSettingsDialog.vue'), 'utf8')
    const closeHandler = sliceBetween(dialogSource, 'function closeDialog()', 'type WebdavTextField')
    const saveHandler = sliceBetween(dialogSource, 'function handleSave()', 'async function handleTest()')
    const draftEditHandler = sliceBetween(dialogSource, 'function handleDraftEdit()', 'function showValidationError(')
    const listHandler = sliceBetween(dialogSource, 'async function handleListBackups()', 'function handleBackupSelection(')

    expect(dialogSource).toContain('const backupPickerRef = ref<BackupPickerExposed | null>(null)')
    expect(dialogSource).toContain('const downloadButtonRef = ref<HTMLButtonElement | null>(null)')
    expect(dialogSource).toContain('const pathInputRef = ref<HTMLInputElement | null>(null)')
    expect(dialogSource).toContain('function focusDownloadTrigger()')
    expect(dialogSource).toContain('nextTick(() => backupPickerRef.value?.focusFirstControl())')
    expect(dialogSource).toContain('nextTick(() => {')
    expect(dialogSource).toContain('downloadButtonRef.value')
    expect(dialogSource).toContain('closeButtonRef.value?.focus()')
    expect(dialogSource).toContain('function showValidationError(error: WebdavValidationError)')
    expect(dialogSource).toContain('if (error === \'path_invalid\')')
    expect(dialogSource).toContain('pathInputRef.value?.focus()')
    expect(dialogSource).toContain('urlInputRef.value?.focus()')
    expect(dialogSource).toContain('id="webdav-dialog-url-error"')
    expect(dialogSource).toContain('id="webdav-dialog-path-error"')
    expect(dialogSource).toContain(':aria-describedby="urlFieldError ? \'webdav-dialog-url-error\' : undefined"')
    expect(dialogSource).toContain(':aria-describedby="pathFieldError ? \'webdav-dialog-path-error\' : undefined"')
    expect(dialogSource).toContain(':aria-invalid="urlFieldError ? \'true\' : \'false\'"')
    expect(dialogSource).toContain(':aria-invalid="pathFieldError ? \'true\' : \'false\'"')

    expect(closeHandler).toContain('clearBackupPicker()')
    expect(saveHandler).toContain('clearBackupPicker()')
    expect(draftEditHandler).toContain('clearBackupPicker()')
    expect(listHandler).toContain('if (!props.visible || dialogSessionId !== sessionId)')
  })

  it('distinguishes cleanup partial upload outcomes from full success', async () => {
    const dialogSource = await readFile(resolve('src/contentScripts/views/WebdavSettingsDialog.vue'), 'utf8')
    const uploadHandler = sliceBetween(dialogSource, 'async function handleUpload()', 'async function handleListBackups()')

    expect(uploadHandler).toContain('result.warning === \'cleanup_partial\'')
    expect(uploadHandler).toContain('props.labels.webdavUploadCleanupPartial')
    expect(uploadHandler).toContain('props.labels.webdavUploadSuccess')
  })
})
