import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'FreeCodeFund Docs',
  description: 'Documentation for FreeCodeFund.',
  outDir: 'dist',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'App', link: 'https://app.freecodefund.xyz' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/freecodexyz' },
    ],
  },
})
