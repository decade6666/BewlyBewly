<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core'

import Button from '~/components/Button.vue'
import { applyLinuxDoDrawerChrome } from '~/sites/linuxDo'
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
    openInNewTab: 'Open in new tab',
  },
  'cmn-CN': {
    close: '关闭',
    openInNewTab: '在新标签页打开',
  },
  'cmn-TW': {
    close: '關閉',
    openInNewTab: '在新索引標籤開啓連結',
  },
  jyut: {
    close: '關閉',
    openInNewTab: '喺新嘅分頁度打開連結',
  },
} as const

type DrawerLocale = keyof typeof drawerMessages

const drawerLabels = drawerMessages[getDrawerLocale(navigator.language)]
const show = ref(false)
const headerShow = ref(false)
const iframeRef = ref<HTMLIFrameElement | null>(null)
const showIframe = ref<boolean>(false)
const delayCloseTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const drawerTopOffset = computed(() => headerShow.value ? 'var(--bew-top-bar-height)' : '0px')

onMounted(() => {
  show.value = true
  headerShow.value = true
})

onBeforeUnmount(() => {
  clearTimers()
  releaseIframeResources()
})

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
  applyLinuxDoDrawerChrome(iframeRef.value?.contentDocument)
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
        pos="absolute bottom-0 left-0" w-full h-full bg="black"
        @click="handleClose"
      />
    </Transition>

    <Transition name="fade">
      <div
        v-if="headerShow"
        class="iframe-drawer-header"
        pos="absolute top-0 left-0" z-2 flex="~ items-center justify-end gap-2"
        w-full h="$bew-top-bar-height"
        px-4
        pointer-events-none
      >
        <Button
          class="drawer-header-btn"
          pointer-events-auto
          @click="handleOpenInNewTab"
        >
          <template #left>
            <i i-mingcute:external-link-line />
          </template>
          {{ drawerLabels.openInNewTab }}
        </Button>
        <Button
          class="drawer-header-btn"
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
        class="iframe-drawer-content"
        :style="{ top: drawerTopOffset }"
        pos="absolute left-0 bottom-0" of-hidden bg="$bew-bg"
        rounded="t-$bew-radius" w-full
      >
        <Transition name="fade">
          <iframe
            v-show="showIframe"
            ref="iframeRef"
            :src="props.url"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
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
.iframe-drawer-header {
  right: 0;
}

.drawer-header-btn {
  --b-button-color: var(--bew-elevated-solid);
  --b-button-color-hover: var(--bew-elevated-solid-hover);
  --b-button-text-color: var(--bew-text-1);

  :deep(kbd) {
    display: inline-block;
    background-color: var(--bew-fill-1);
    padding: 0 0.5em;
    margin: 0.14em 0.2em;
    border-radius: 4px;
    box-shadow:
      0 0 0 1px var(--bew-border-color),
      0 1.4px 0 0 var(--bew-fill-2);
    line-height: 1.24;
    cursor: pointer;
    transition: 0.3s;

    &:hover {
      background-color: var(--bew-fill-2);
    }

    &:active {
      background-color: var(--bew-fill-3);
      translate: 0 1.4px;
      box-shadow:
        0 0 0 1px var(--bew-border-color),
        0 -1.4px 0 0 var(--bew-fill-2);
    }
  }
}

.iframe-drawer-content {
  height: auto;
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.3s;
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateY(100%);
}
</style>
