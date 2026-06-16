---
title: CLI Overview
description: Reference for the @freecodexyz/cli (fcf) command-line tool.
---

# CLI Overview

`fcf` is the command-line entry point to the FCF protocol. It is published to npm as [`@freecodexyz/cli`](https://www.npmjs.com/package/@freecodexyz/cli) and exposes the `fcf` binary.

The CLI supports:

- Repository registration against the RIK contract.
- Scaffolding the GitHub Actions registration workflow.
- Maintaining the contract's GitHub OIDC signing keys (owner-only).
- Listing recent registrations.
- Local wallet helpers.
- GitHub repository secrets and variables helpers.

## Install

```bash
npm install --global @freecodexyz/cli@alpha
```

See [Install](/cli/install) for other options.

## Commands

| Command | Purpose |
| --- | --- |
| [`fcf init`](/cli/init) | Scaffold `.github/workflows/fcf-register.yml`. |
| [`fcf register`](/cli/register) | Mint a RIK for the current repository. Designed to run inside GitHub Actions. |
| [`fcf keys sync`](/cli/keys) | Owner-only. Sync GitHub OIDC signing keys into the RIK contract. |
| [`fcf list`](/cli/list) | List recent `RepoRegistered` events from the contract. |
| [`fcf wallet create`](/cli/wallet#create) | Create a local FCF wallet. |
| [`fcf wallet link`](/cli/wallet#link) | Save the local wallet's private key as a GitHub Actions secret. |
| [`fcf github whoami`](/cli/github#whoami) | Show the authenticated GitHub user. |
| [`fcf github secrets get\|set`](/cli/github#secrets) | Read or write GitHub Actions repository secrets. |
| [`fcf github vars get\|set`](/cli/github#vars) | Read or write GitHub Actions repository variables. |

## Global behavior

The CLI loads its ABI from a committed static file in the published package, so it doesn't depend on a live Foundry build to function. For local development against an unreleased contract, set `SKIP_STATIC_ABI=1` to use the live Foundry artifact instead.

The CLI exits non-zero on any handled error and prints `fcf: <message>; exiting.` to stderr.

## Environment

Most network/wallet behavior is controlled by environment variables. See [Environment & Networks](/cli/environment).

| Variable | Purpose |
| --- | --- |
| `PRIVATE_KEY` | Private key for the wallet that signs transactions. Falls back to the local wallet store. |
| `RPC_URL` | RPC endpoint. The live deployment uses Base Sepolia. |
| `ACTIONS_ID_TOKEN_REQUEST_URL` / `ACTIONS_ID_TOKEN_REQUEST_TOKEN` | Set by GitHub Actions. Required for the runtime OIDC token request when no `--oidc-token` flag is provided. |
| `GH_TOKEN` / `GITHUB_TOKEN` | Used by GitHub API helpers (`github vars`, `github secrets`, `github whoami`, `wallet link`). |
| `SKIP_STATIC_ABI` | Use the live Foundry artifact instead of the committed ABI. |

## Source

The CLI source lives in [`freecodexyz/fcf`](https://github.com/freecodexyz/fcf) under `cli/`. The entry point is `cli/src/index.ts`.
