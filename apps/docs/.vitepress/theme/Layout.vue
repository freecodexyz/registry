<script setup lang="ts">
import DefaultTheme from 'vitepress/theme-without-fonts'
import { onMounted, onUnmounted } from 'vue'
import fcfLogoUrl from '../../../web/src/assets/fcf-logo.svg?url'

const { Layout } = DefaultTheme
let themeObserver: MutationObserver | undefined

onMounted(() => {
  const root = document.documentElement

  const syncTheme = () => {
    root.dataset.accent = 'emerald'

    if (root.classList.contains('dark')) {
      root.dataset.theme = 'dark'
    } else {
      delete root.dataset.theme
    }
  }

  syncTheme()
  themeObserver = new MutationObserver(syncTheme)
  themeObserver.observe(root, { attributes: true, attributeFilter: ['class'] })
})

onUnmounted(() => {
  themeObserver?.disconnect()
  themeObserver = undefined
})
</script>

<template>
  <Layout>
    <template #layout-top>
      <div class="fcf-docs-backdrop" aria-hidden="true" />
    </template>

    <template #nav-bar-title-before>
      <img class="fcf-docs-logo" :src="fcfLogoUrl" alt="" aria-hidden="true" />
    </template>

    <template #nav-screen-content-before>
      <div class="fcf-docs-mobile-kicker">Registry documentation</div>
    </template>

    <template #sidebar-nav-before>
      <div class="fcf-docs-sidebar-kicker">Guide index</div>
    </template>
  </Layout>
</template>
