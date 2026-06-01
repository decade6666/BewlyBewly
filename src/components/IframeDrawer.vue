<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

import Button from '~/components/Button.vue'
import { openLinkToNewTab } from '~/utils/main'

const props = defineProps<{
  url: string
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const drawerMessages = {
  en: {
    close: 'Close',
    copyLink: 'Copy link',
    copyLinkCopied: 'Copied',
    openInNewTab: 'Open in new tab',
  },
  'cmn-CN': {
    close: '关闭',
    copyLink: '复制链接',
    copyLinkCopied: '已复制',
    openInNewTab: '在新标签页打开',
  },
  'cmn-TW': {
    close: '關閉',
    copyLink: '複製連結',
    copyLinkCopied: '已複製',
    openInNewTab: '在新索引標籤開啓連結',
  },
  jyut: {
    close: '關閉',
    copyLink: '複製連結',
    copyLinkCopied: '已複製',
    openInNewTab: '喺新嘅分頁度打開連結',
  },
} as const

type DrawerLocale = keyof typeof drawerMessages

const drawerLabels = drawerMessages[getDrawerLocale(navigator.language)]

function getDrawerLocale(language: string): DrawerLocale {
  const normalizedLanguage = language.toLowerCase()

  if (normalizedLanguage.startsWith('zh-hk') || normalizedLanguage.startsWith('yue'))
    return 'jyut'

  if (normalizedLanguage.startsWith('zh-tw'))
    return 'cmn-TW'

  if (normalizedLanguage.startsWith('zh'))
    return 'cmn-CN'

  return 'en'
}

const show = ref(false)
const headerShow = ref(false)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const showIframe = ref<boolean>(false)
const delayCloseTimer = ref<NodeJS.Timeout | null>(null)
const copySucceeded = ref<boolean>(false)
const copySucceededTimer = ref<NodeJS.Timeout | null>(null)

onMounted(() => {
  show.value = true
  headerShow.value = true
})

onBeforeUnmount(() => {
  clearTimers()
  releaseIframeResources()
})

async function handleClose() {
  clearTimers()
  await releaseIframeResources()
  show.value = false
  headerShow.value = false
  delayCloseTimer.value = setTimeout(() => {
    emit('close')
  }, 300)
}

function clearTimers() {
  if (delayCloseTimer.value)
    clearTimeout(delayCloseTimer.value)
  if (copySucceededTimer.value)
    clearTimeout(copySucceededTimer.value)
}

function handleEscape(event: KeyboardEvent) {
  event.preventDefault()
  handleClose()
}

function handleIframeKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape')
    handleEscape(event)
}

function handleIframeLoad() {
  showIframe.value = true
  iframeRef.value?.contentWindow?.addEventListener('keydown', handleIframeKeydown)
}

async function releaseIframeResources() {
  if (iframeRef.value) {
    iframeRef.value.contentWindow?.removeEventListener('keydown', handleIframeKeydown)
    iframeRef.value.src = 'about:blank'
  }

  await nextTick()
  iframeRef.value?.contentWindow?.close()
  iframeRef.value?.parentNode?.removeChild(iframeRef.value)
  await nextTick()
  iframeRef.value = null
}

function handleOpenInNewTab() {
  openLinkToNewTab(props.url)
  handleClose()
}

async function handleCopyLink() {
  try {
    await navigator.clipboard.writeText(props.url)
    copySucceeded.value = true
    copySucceededTimer.value = setTimeout(() => {
      copySucceeded.value = false
    }, 1300)
  }
  catch (error) {
    console.error('Unable to copy drawer URL:', error)
  }
}

onKeyStroke('Escape', handleEscape, { target: window })
</script>

<template>
  <div
    pos="absolute top-0 left-0" of-hidden w-full h-full
    z-999999
  >
    <Transition name="fade">
      <div
        v-if="show"
        pos="absolute bottom-0 left-0" w-full h-full bg="black opacity-60"
        @click="handleClose"
      />
    </Transition>

    <Transition name="fade">
      <div
        v-if="headerShow"
        pos="relative top-0" flex="~ items-center justify-end gap-2"
        max-w="$bew-page-max-width" w-full h="$bew-top-bar-height"
        m-auto px-4
        pointer-events-none
      >
        <Button
          style="
            --b-button-color: var(--bew-elevated-solid);
            --b-button-color-hover: var(--bew-elevated-solid-hover);
          "
          pointer-events-auto
          @click="handleOpenInNewTab"
        >
          <template #left>
            <i i-mingcute:external-link-line />
          </template>
          {{ drawerLabels.openInNewTab }}
        </Button>
        <Button
          style="
            --b-button-color: var(--bew-elevated-solid);
            --b-button-color-hover: var(--bew-elevated-solid-hover);
          "
          pointer-events-auto
          @click="handleCopyLink"
        >
          <template #left>
            <i i-mingcute:copy-2-line />
          </template>
          {{ copySucceeded ? drawerLabels.copyLinkCopied : drawerLabels.copyLink }}
        </Button>
        <Button
          style="
            --b-button-color: var(--bew-elevated-solid);
            --b-button-color-hover: var(--bew-elevated-solid-hover);
          "
          pointer-events-auto
          @click="handleClose"
        >
          <template #left>
            <i i-mingcute:close-line />
          </template>
          {{ drawerLabels.close }}
          <kbd>Esc</kbd>
        </Button>
      </div>
    </Transition>

    <Transition name="drawer">
      <div
        v-if="show"
        :pos="`absolute ${headerShow ? 'top-$bew-top-bar-height' : 'top-0'} left-0`" of-hidden bg="$bew-bg"
        rounded="t-$bew-radius" w-full h-full
      >
        <Transition name="fade">
          <iframe
            v-show="showIframe"
            ref="iframeRef"
            :src="props.url"
            sandbox="allow-scripts allow-same-origin allow-forms"
            frameborder="0"
            pointer-events-auto
            pos="relative left-0"
            w-full
            h-full @load="handleIframeLoad"
          />
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
}
</style>
