import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'FCF Docs',
  description: 'Documentation for FreeCodeFund.',
  outDir: 'dist',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'About', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'App', link: 'https://app.freecodefund.xyz' },
    ],
    sidebar: [
      {
        text: 'Docs',
        items: [
          { text: 'About', link: '/' },
          { text: 'Getting Started', link: '/guide/getting-started' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/freecodexyz' },
    ],
  },
})
