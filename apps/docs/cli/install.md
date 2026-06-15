---
title: Install
description: Install the @freecodexyz/cli (fcf) command, locally and in CI.
---

# Install

The CLI is published as [`@freecodexyz/cli`](https://www.npmjs.com/package/@freecodexyz/cli) on npm and exposes the `fcf` binary.

## Global install (recommended for local use)

```bash
npm install --global @freecodexyz/cli@alpha
```

Verify:

```bash
fcf --help
```

The CLI is currently published under the `alpha` dist-tag. Always pin to `@alpha` (or to an explicit version) until a stable tag is published.

## One-off use without install

```bash
npx --yes -p @freecodexyz/cli@alpha -- fcf --help
```

This is what the generated GitHub Actions workflow uses, via `npm exec`:

```yaml
- name: Register repository
  env:
    PRIVATE_KEY: ${{ secrets.FCF_PRIVATE_KEY }}
    RPC_URL: ${{ vars.FCF_RPC_URL }}
    FCF_CONTRACT: ${{ vars.FCF_CONTRACT }}
  run: |
    npm exec --yes --package=@freecodexyz/cli@alpha -- fcf register \
      --contract "$FCF_CONTRACT"
```

## From source

For development against unreleased changes:

```bash
git clone https://github.com/freecodexyz/fcf.git
cd fcf/cli
corepack enable
pnpm install --frozen-lockfile
pnpm dev -- --help
```

`pnpm dev` runs the CLI through `tsx` against the TypeScript source. To produce a built binary:

```bash
pnpm build
node dist/index.js --help
```

Use Node 24 to match the CI environment.

## Requirements

- **Node.js 20+** for general use.
- **Node.js 24** for development and to match CI exactly.
- A POSIX-like shell for the install commands above.

## Continue

- [CLI Overview](/cli/), what the CLI does.
- [Getting Started](/guide/getting-started), what to do once it's installed.
