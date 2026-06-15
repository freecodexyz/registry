<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import { onMounted, watch } from 'vue'

const { Layout } = DefaultTheme
const { isDark } = useData()
const fcfLogoUrl = new URL('../../../web/src/assets/fcf-logo.svg', import.meta.url).href

onMounted(() => {
  const root = document.documentElement

  const applyTheme = (dark: boolean) => {
    root.dataset.accent = 'emerald'

    if (dark) {
      root.dataset.theme = 'dark'
    } else {
      delete root.dataset.theme
    }
  }

  applyTheme(isDark.value)
  watch(isDark, (dark) => applyTheme(dark), { immediate: true })
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
