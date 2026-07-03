<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'

import { downloadSettings, settings, uploadSettings, webdavTest } from '~/logic'

import SettingsItem from '../components/SettingsItem.vue'
import SettingsItemGroup from '../components/SettingsItemGroup.vue'

const { t } = useI18n()
const toast = useToast()

const testing = ref<boolean>(false)
const uploading = ref<boolean>(false)
const downloading = ref<boolean>(false)

const lastSyncText = computed(() => {
  if (!settings.value.webdavLastSyncTime)
    return t('settings.webdav_never_synced')
  return t('settings.webdav_last_sync', { time: new Date(settings.value.webdavLastSyncTime).toLocaleString() })
})

async function handleTest() {
  if (!settings.value.webdavUrl)
    return
  testing.value = true
  try {
    const result = await webdavTest({
      url: settings.value.webdavUrl,
      username: settings.value.webdavUsername,
      password: settings.value.webdavPassword,
      path: settings.value.webdavPath,
    })
    if (result.ok)
      toast.success(t('settings.webdav_test_success'))
    else
      toast.error(t('settings.webdav_test_fail', { error: result.error || `HTTP ${result.status}` }))
  }
  finally {
    testing.value = false
  }
}

async function handleUpload() {
  if (!settings.value.webdavUrl)
    return
  uploading.value = true
  try {
    const result = await uploadSettings()
    if (result.ok)
      toast.success(t('settings.webdav_upload_success'))
    else
      toast.error(t('settings.webdav_upload_fail', { error: result.error || 'unknown' }))
  }
  finally {
    uploading.value = false
  }
}

async function handleDownload() {
  if (!settings.value.webdavUrl)
    return
  downloading.value = true
  try {
    const result = await downloadSettings()
    if (result.ok) {
      toast.success(t('settings.webdav_download_success'))
    }
    else if (result.error === 'remote_not_found') {
      toast.warning(t('settings.webdav_download_not_found'))
    }
    else {
      toast.error(t('settings.webdav_download_fail', { error: result.error || 'unknown' }))
    }
  }
  finally {
    downloading.value = false
  }
}
</script>

<template>
  <div>
    <SettingsItemGroup :title="$t('settings.group_webdav')" :desc="$t('settings.group_webdav_desc')">
      <SettingsItem :title="$t('settings.webdav_enable')">
        <Radio v-model="settings.webdavEnabled" />
      </SettingsItem>

      <template v-if="settings.webdavEnabled">
        <SettingsItem :title="$t('settings.webdav_url')">
          <Input
            v-model="settings.webdavUrl"
            :placeholder="$t('settings.webdav_url_placeholder')"
            w-full
          />
        </SettingsItem>
        <SettingsItem :title="$t('settings.webdav_username')">
          <Input v-model="settings.webdavUsername" w-full />
        </SettingsItem>
        <SettingsItem :title="$t('settings.webdav_password')">
          <Input v-model="settings.webdavPassword" type="password" w-full />
        </SettingsItem>
        <SettingsItem :title="$t('settings.webdav_path')">
          <Input v-model="settings.webdavPath" placeholder="/bewly/settings.json" w-full />
        </SettingsItem>
        <SettingsItem :title="$t('settings.webdav_auto_sync')" :desc="$t('settings.webdav_auto_sync_desc')">
          <Radio v-model="settings.webdavAutoSync" />
        </SettingsItem>

        <SettingsItem>
          <template #title>
            <div flex="~ gap-2 wrap items-center">
              <Button size="small" type="secondary" :disabled="testing" @click="handleTest">
                <template #left>
                  <div i-mingcute:link-line />
                </template>
                {{ $t('settings.webdav_test_connection') }}
              </Button>
              <Button size="small" type="primary" :disabled="uploading" @click="handleUpload">
                <template #left>
                  <div i-uil:upload />
                </template>
                {{ uploading ? $t('settings.webdav_uploading') : $t('settings.webdav_upload') }}
              </Button>
              <Button size="small" type="secondary" :disabled="downloading" @click="handleDownload">
                <template #left>
                  <div i-uil:download-alt />
                </template>
                {{ downloading ? $t('settings.webdav_downloading') : $t('settings.webdav_download') }}
              </Button>
            </div>
          </template>
          <template #bottom>
            <div text="$bew-text-2 sm" mt-2>
              {{ lastSyncText }}
            </div>
          </template>
        </SettingsItem>
      </template>
    </SettingsItemGroup>
  </div>
</template>
