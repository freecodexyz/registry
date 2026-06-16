---
title: fcf init
description: Scaffold the GitHub Actions registration workflow into the current repository.
---

# `fcf init`

Scaffolds the GitHub Actions workflow that registers the current repository against the RIK contract.

## Usage

```bash
fcf init [--force]
```

## What it does

Writes `.github/workflows/fcf-register.yml` into the current working directory. The file is the template shipped inside the published CLI package.

If the file already exists, the command exits with an error unless `--force` is passed:

```text
fcf: .github/workflows/fcf-register.yml already exists; exiting.
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--force` | off | Overwrite the existing workflow if present. |

## Generated workflow

The template is intentionally small. It uses `workflow_dispatch` so you trigger it manually from the GitHub UI:

```yaml
name: Register Repository

on:
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  register:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 24

      - name: Register repository
        env:
          PRIVATE_KEY: ${{ secrets.FCF_PRIVATE_KEY }}
          RPC_URL: ${{ vars.FCF_RPC_URL }}
          FCF_CONTRACT: ${{ vars.FCF_CONTRACT }}
        run: |
          npm exec --yes --package=@freecodexyz/cli@alpha -- fcf register \
            --contract "$FCF_CONTRACT"
```

Key points:

- `permissions.id-token: write` is **required**. Without it, GitHub will not issue an OIDC token to the workflow, and `fcf register` will fail with "GitHub OIDC env vars not found".
- The workflow expects three things in the repository:
  - **Secret** `FCF_PRIVATE_KEY`, the wallet that will sign the on-chain transaction. Use [`fcf wallet link`](/cli/wallet#link) to set this.
  - **Variable** `FCF_RPC_URL`, your Base Sepolia RPC endpoint. Use `fcf github vars set FCF_RPC_URL <url>`.
  - **Variable** `FCF_CONTRACT`, the RIK contract address. Use `fcf github vars set FCF_CONTRACT <addr>`.
- The CLI is invoked via `npm exec` with the `alpha` tag, so no separate install step is needed.

## Customizing the workflow

You can edit `.github/workflows/fcf-register.yml` after it's scaffolded. The two things to preserve are:

1. `permissions.id-token: write` (so GitHub will mint the OIDC token).
2. The environment variables that `fcf register` reads (`PRIVATE_KEY`, `RPC_URL`, `FCF_CONTRACT`).

## Continue

- [Mint Your RIK](/guide/mint-a-rik), full walkthrough.
- [`fcf register`](/cli/register), the command the workflow runs.
- [`fcf wallet`](/cli/wallet), create and link the signing wallet.
