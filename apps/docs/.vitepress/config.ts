import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'FCF Docs',
  titleTemplate: ':title | FCF Docs',
  description: 'Documentation for the FreeCodeFund registry platform.',
  lang: 'en-US',
  outDir: 'dist',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'application-name', content: 'FCF Docs' }],
    ['meta', { name: 'theme-color', content: '#0c1410' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'FCF Docs' }],
    ['meta', { property: 'og:title', content: 'FCF Docs' }],
    ['meta', { property: 'og:description', content: 'Documentation for the FreeCodeFund registry platform.' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'FCF Docs' }],
    ['meta', { name: 'twitter:description', content: 'Documentation for the FreeCodeFund registry platform.' }],
  ],
  vite: {
    publicDir: '../landing/public',
  },
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
