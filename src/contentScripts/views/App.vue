<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

import IframeDrawer from '~/components/IframeDrawer.vue'
import { BEWLY_MOUNTED } from '~/constants/globalEvents'
import { findLinuxDoTopicLink, isLinuxDoTopicListPage } from '~/sites/linuxDo'

const iframeDrawerURL = ref<string>('')
const showIframeDrawer = ref<boolean>(false)

function shouldIgnoreClick(event: MouseEvent): boolean {
  return event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
}

function handleDocumentClick(event: MouseEvent) {
  if (shouldIgnoreClick(event) || !isLinuxDoTopicListPage(location.href))
    return

  const topicUrl = findLinuxDoTopicLink(event.target, location.href)

  if (!topicUrl)
    return

  event.preventDefault()
  event.stopPropagation()
  iframeDrawerURL.value = topicUrl
  showIframeDrawer.value = true
}

useEventListener(document, 'click', handleDocumentClick, { capture: true })

onMounted(() => {
  window.dispatchEvent(new CustomEvent(BEWLY_MOUNTED))
})
</script>

<template>
  <div v-if="showIframeDrawer" id="bewly-wrapper" class="linux-do-drawer-root">
    <div class="linux-do-drawer">
      <IframeDrawer
        :url="iframeDrawerURL"
        @close="showIframeDrawer = false"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.linux-do-drawer-root {
  --bew-bg: hsl(0deg 0% 100%);
  --bew-border-color: hsl(220deg 13% 91%);
  --bew-content-solid: hsl(220deg 14% 96%);
  --bew-content-solid-hover: hsl(220deg 13% 91%);
  --bew-elevated-solid: hsl(0deg 0% 100%);
  --bew-elevated-solid-hover: hsl(220deg 14% 96%);
  --bew-error-color: hsl(0deg 72% 51%);
  --bew-fill-1: hsl(220deg 14% 96%);
  --bew-fill-2: hsl(220deg 13% 91%);
  --bew-page-max-width: min(1200px, 100vw);
  --bew-radius: 12px;
  --bew-text-1: hsl(222deg 47% 11%);
  --bew-theme-color: hsl(210deg 100% 50%);
  --bew-top-bar-height: 56px;

  position: fixed;
  inset: 0;
  z-index: 2147483647;
  color: var(--bew-text-1);
  font-family: Inter, Roboto, "Noto Sans", sans-serif;
  line-height: 1.4;
  pointer-events: none;
}

.linux-do-drawer {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}
</style>
