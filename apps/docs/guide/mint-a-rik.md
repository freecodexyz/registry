---
title: Mint Your RIK
description: Step-by-step walkthrough to register your GitHub repository on the RIK protocol and mint its on-chain identity.
---

# Mint Your RIK

Minting your **Repository Identity Key (RIK)** takes a few minutes. It lets your GitHub repository register its identity on-chain using a **GitHub Actions OIDC token**, certifying *Proof-of-Ownership* by issuing a unique on-chain token only the repo owner can mint.

::: info Network
FCF is currently testing on **Base Sepolia**. Everything below runs against the testnet, so you only need a small amount of Base Sepolia ETH.
:::

## Before you start

You will need:

- A **GitHub repository you own** and can push to.
- A **Base Sepolia RPC URL** (e.g. from Alchemy, Infura, or a public node).
- Some **Base Sepolia ETH** to cover gas.
- The `fcf` CLI installed globally:

```bash
npm install --global @freecodexyz/cli@alpha
```

You should also be authenticated to GitHub in your local environment so the CLI can talk to the GitHub API (it uses your `gh` auth or `GH_TOKEN` / `GITHUB_TOKEN`).

## 1. Create and link a wallet

From the local clone of the repository you want to register:

```bash
fcf wallet create
```

This generates a fresh wallet and stores its private key locally. The address is printed to stdout.

```bash
fcf wallet link
```

This saves the wallet's private key as a GitHub Actions repository secret in the current repo (default secret name: `FCF_PRIVATE_KEY`). The workflow we generate next will read it.

## 2. Point the CLI at the RIK contract

Set the contract address and your Base Sepolia RPC URL as **GitHub Actions repository variables**:

```bash
fcf github vars set FCF_CONTRACT 0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac
fcf github vars set FCF_RPC_URL <your-base-sepolia-rpc-url>
```

The latest known RIK contract address on Base Sepolia is:

```text
0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac
```

(Always cross-check this against [Protocol → Deployments](/protocol/deployments).)

## 3. Scaffold the registration workflow

```bash
fcf init
```

This writes `.github/workflows/fcf-register.yml` to your repo. The workflow uses `workflow_dispatch` (manual trigger) and has `id-token: write` so it can request a GitHub OIDC token. The full template is shown in [`fcf init`](/cli/init).

## 4. Fund the wallet

The wallet that you created in step 1 is the wallet that will sign the on-chain `register()` call. It needs Base Sepolia ETH.

If you don't already have some, grab it from a Base Sepolia faucet.

## 5. Commit, push, and dispatch

Commit the new workflow file and push:

```bash
git add .github/workflows/fcf-register.yml
git commit -m "ci: add fcf register workflow"
git push
```

Then in GitHub UI:

1. Open the **Actions** tab.
2. Pick the **Register Repository** workflow.
3. Click **Run workflow**.

The workflow will:

1. Ask GitHub for an OIDC token, with `aud` set to the lowercase Ethereum address of your wallet.
2. Run `fcf register` with that token and the contract address.
3. Wait for the transaction receipt and print the result.

If everything goes well, you now hold the RIK for that repository. Your wallet address is the on-chain owner of the ERC-721 token whose `tokenId` equals the GitHub `repository_id`.

## What to check after minting

- The transaction succeeded on [Base Sepolia Basescan](https://sepolia.basescan.org/). The `RepoRegistered` event will be in the logs.
- The Registry will index your RIK on the next indexer tick. You can also list registrations directly from the CLI:

```bash
fcf list --contract 0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac
```

## Troubleshooting

See [Troubleshooting](/guide/troubleshooting) for the common failures: missing OIDC env vars, `aud` mismatch, expired token, unknown `kid`, already-registered repo.

## Continue

- [CLI Reference](/cli/)
- [RIK Contract](/protocol/rik-contract)
- [Browse the Registry](/guide/browse-registry)
