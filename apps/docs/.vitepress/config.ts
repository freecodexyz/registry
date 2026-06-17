import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'FCF Docs',
  titleTemplate: ':title | FCF Docs',
  description: 'Documentation for the FreeCodeFund protocol, registry, and tooling.',
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
    ['meta', { property: 'og:description', content: 'Documentation for the FreeCodeFund protocol, registry, and tooling.' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'FCF Docs' }],
    ['meta', { name: 'twitter:description', content: 'Documentation for the FreeCodeFund protocol, registry, and tooling.' }],
  ],
  vite: {
    publicDir: '../landing/public',
  },
  themeConfig: {
    nav: [
      { text: 'About', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Protocol', link: '/protocol/' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Registry', link: 'https://app.freecodefund.xyz' },
    ],
    sidebar: [
      {
        text: 'Start Here',
        items: [
          { text: 'About', link: '/' },
          { text: 'What is FCF', link: '/introduction/what-is-fcf' },
          { text: 'Why this matters', link: '/introduction/why' },
          { text: 'FAQ', link: '/introduction/faq' },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'RIK Protocol', link: '/concepts/rik' },
          { text: 'Proof-of-Ownership', link: '/concepts/proof-of-ownership' },
          { text: 'GitHub OIDC Trust Model', link: '/concepts/oidc' },
          { text: 'Registry', link: '/concepts/registry' },
          /* { text: 'Code-as-a-Business', link: '/concepts/caab' }, */
          { text: '$freecode token', link: '/concepts/freecode-token' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Mint Your RIK', link: '/guide/mint-a-rik' },
          { text: 'Browse the Registry', link: '/guide/browse-registry' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
        ],
      },
      {
        text: 'CLI Reference',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/cli/' },
          { text: 'Install', link: '/cli/install' },
          { text: 'fcf init', link: '/cli/init' },
          { text: 'fcf register', link: '/cli/register' },
          { text: 'fcf keys sync', link: '/cli/keys' },
          { text: 'fcf list', link: '/cli/list' },
          { text: 'fcf wallet', link: '/cli/wallet' },
          { text: 'fcf github', link: '/cli/github' },
          { text: 'Environment & Networks', link: '/cli/environment' },
        ],
      },
      {
        text: 'Protocol Reference',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/protocol/' },
          { text: 'RIK Contract', link: '/protocol/rik-contract' },
          { text: 'JWT Verification', link: '/protocol/verification' },
          { text: 'JsonClaim Library', link: '/protocol/json-claim' },
          { text: 'Deployments', link: '/protocol/deployments' },
          { text: 'Security', link: '/protocol/security' },
        ],
      },
      {
        text: 'Registry Platform',
        items: [
          { text: 'Overview', link: '/registry/' },
          { text: 'Web App', link: '/registry/app' },
          { text: 'Indexer & API', link: '/registry/api' },
          { text: 'Access Gating', link: '/registry/access' },
        ],
      },
      {
        text: 'Resources',
        collapsed: true,
        items: [
          { text: 'Links', link: '/resources/links' },
          { text: 'Contributing', link: '/resources/contributing' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/freecodexyz' },
      { icon: 'x', link: 'https://x.com/freecodexyz' },
    ],
    editLink: {
      pattern: 'https://github.com/freecodexyz/registry/edit/main/apps/docs/:path',
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2026 FreeCodeFund',
    },
  },
})
