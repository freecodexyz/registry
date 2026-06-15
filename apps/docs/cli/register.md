---
title: fcf register
description: Mint a Repository Identity Key for the current repository against the RIK contract.
---

# `fcf register`

Registers the current repository on-chain against the RIK contract and mints its Repository Identity Key.

This command is designed to run **inside a GitHub Actions workflow** with `id-token: write` permission. It can also be invoked manually if you pass `--oidc-token` explicitly.

## Usage

```bash
fcf register --contract <addr> [--oidc-token <token>]
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `--contract <addr>` | yes | The deployed RIK contract address to call. |
| `--oidc-token <token>` | no | A GitHub OIDC JWT. If omitted, the CLI requests one at runtime using the standard Actions env vars. |

## What it does

1. Builds an `account` from `PRIVATE_KEY` (or from the local wallet at `~/.config/fcf/wallet.json`).
2. Either takes `--oidc-token` or requests a fresh OIDC token from GitHub with `audience` set to the lowercase Ethereum address of that account.
3. Parses the JWT and sanity-checks that `aud` matches the address.
4. Sends an on-chain `register(...)` transaction to the contract, passing:
   - `kid = keccak256(utf8(header.kid))`
   - `headerB64`, `payloadB64`, `signatureB64` (the three JWT parts as bytes)
   - `repoId = BigInt(payload.repository_id)`
   - `githubOwnerId = BigInt(payload.repository_owner_id)`
5. Waits for the transaction receipt and prints `registered: <hash> status=<0|1>`.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `PRIVATE_KEY` | one of these | Hex private key for the signing wallet. |
| Local wallet at `~/.config/fcf/wallet.json` | one of these | Created by `fcf wallet create`. Used when `PRIVATE_KEY` is unset. |
| `RPC_URL` | no | RPC endpoint. Defaults to `https://ethereum-sepolia-rpc.publicnode.com`. Sepolia is auto-detected from the URL; otherwise the CLI uses the `foundry` (local anvil) chain. |
| `ACTIONS_ID_TOKEN_REQUEST_URL` | yes (unless `--oidc-token`) | Set automatically inside GitHub Actions runners with `id-token: write`. |
| `ACTIONS_ID_TOKEN_REQUEST_TOKEN` | yes (unless `--oidc-token`) | Same as above. |

## Errors you may see

| Message | Cause |
| --- | --- |
| `GitHub OIDC env vars not found` | The workflow is missing `permissions.id-token: write`, or you ran the command locally without `--oidc-token`. |
| `aud mismatch: want <X>, got <Y>` | The OIDC token's `aud` claim doesn't match the wallet address derived from `PRIVATE_KEY`. |
| `failed to fetch GitHub OIDC token: <status>` | GitHub refused to issue the token. Usually a permissions or audience problem. |
| Reverts: `UnknownKid`, `BadJwt`, `AlreadyRegistered`, `ClaimMissing`, `ClaimMismatch`, `token expired`, `token not yet valid` | The on-chain check failed. See [Troubleshooting](/guide/troubleshooting). |

## Inside Actions

The default `fcf init` template runs:

```bash
npm exec --yes --package=@freecodexyz/cli@alpha -- fcf register \
  --contract "$FCF_CONTRACT"
```

With `PRIVATE_KEY`, `RPC_URL`, and `FCF_CONTRACT` populated from the repo's secret and variables.

## Running manually

You can call `fcf register` outside of Actions if you have a valid OIDC token from another source (e.g. you captured one from a previous Actions run within its 15-minute window):

```bash
PRIVATE_KEY=0x... RPC_URL=https://... \
  fcf register \
    --contract 0xf696da98df236a36536e9385dAf05D196579612B \
    --oidc-token <jwt>
```

The `aud` claim of the token must equal the lowercase hex of the wallet's address.

## Continue

- [`fcf init`](/cli/init), how the workflow is scaffolded.
- [RIK Contract](/protocol/rik-contract), what the contract does with the token.
- [JWT Verification](/protocol/verification), the verification chain.
