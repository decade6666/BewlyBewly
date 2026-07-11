<script setup lang="ts">
import { computed, ref } from 'vue'

import type { BackupListWarning, SettingsBackupSummary } from '~/logic/webdavBackups'

interface WebdavBackupPickerLabels {
  webdavBackupSelectorLabel: string
  webdavLegacyBackup: string
  webdavLegacyUnreadable: string
  webdavDownloadCancel: string
  webdavDownloadConfirm: string
  webdavDownloadWarning: string
}

interface Props {
  backups: readonly SettingsBackupSummary[]
  disabled: boolean
  labels: WebdavBackupPickerLabels
  selectedBackupId: string
  warnings: readonly BackupListWarning[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'select', backupId: string): void
  (event: 'confirm'): void
  (event: 'cancel'): void
}>()

const selectRef = ref<HTMLSelectElement | null>(null)

const hasLegacyUnreadableWarning = computed(() => props.warnings.includes('legacy_unreadable'))

function formatBackupLabel(backup: SettingsBackupSummary): string {
  const localTimestamp = new Date(backup.timestampMs).toLocaleString()
  return backup.source === 'legacy'
    ? `${localTimestamp} (${props.labels.webdavLegacyBackup})`
    : localTimestamp
}

function focusFirstControl() {
  selectRef.value?.focus()
}

function handleSelect(event: Event) {
  const select = event.target as HTMLSelectElement
  emit('select', select.value)
}

defineExpose({ focusFirstControl })
</script>

<template>
  <section class="webdav-backup-picker">
    <label class="webdav-backup-picker-field" for="webdav-backup-select">
      <span>{{ labels.webdavBackupSelectorLabel }}</span>
      <select
        id="webdav-backup-select"
        ref="selectRef"
        class="webdav-backup-picker-select"
        :disabled="disabled"
        :value="selectedBackupId"
        @change="handleSelect"
      >
        <option
          v-for="backup in backups"
          :key="backup.id"
          :value="backup.id"
        >
          {{ formatBackupLabel(backup) }}
        </option>
      </select>
    </label>

    <p
      v-if="hasLegacyUnreadableWarning"
      class="webdav-backup-picker-warning"
      role="status"
      aria-live="polite"
    >
      {{ labels.webdavLegacyUnreadable }}
    </p>

    <p class="webdav-backup-picker-warning">
      {{ labels.webdavDownloadWarning }}
    </p>

    <div class="webdav-backup-picker-actions">
      <button
        class="webdav-backup-picker-primary-button"
        type="button"
        :disabled="disabled || !selectedBackupId"
        @click="emit('confirm')"
      >
        {{ labels.webdavDownloadConfirm }}
      </button>
      <button
        class="webdav-backup-picker-secondary-button"
        type="button"
        :disabled="disabled"
        @click="emit('cancel')"
      >
        {{ labels.webdavDownloadCancel }}
      </button>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.webdav-backup-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: var(--bew-fill-1);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;
}

.webdav-backup-picker-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--bew-text-2);
}

.webdav-backup-picker-select {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 0 10px;
  color: var(--bew-text-1);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);
  border-radius: 8px;

  &:focus-visible {
    border-color: var(--bew-theme-color);
    outline: none;
  }
}

.webdav-backup-picker-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.webdav-backup-picker-primary-button,
.webdav-backup-picker-secondary-button {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.webdav-backup-picker-primary-button {
  color: var(--bew-text-1);
  background: var(--bew-theme-color);
  border: 1px solid var(--bew-theme-color);

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    opacity: 0.85;
    outline: none;
  }
}

.webdav-backup-picker-secondary-button {
  color: var(--bew-text-1);
  background: var(--bew-elevated-solid);
  border: 1px solid var(--bew-border-color);

  &:hover:not(:disabled),
  &:focus-visible:not(:disabled) {
    color: var(--bew-theme-color);
    background: var(--bew-fill-2);
    outline: none;
  }
}

.webdav-backup-picker-warning {
  margin: 0;
  font-size: 12px;
  color: var(--bew-text-2);
}
</style>
