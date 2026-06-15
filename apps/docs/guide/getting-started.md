---
title: Getting Started
description: First steps with FCF — install the CLI, understand what you'll be doing, and pick the right next page.
---

# Getting Started

This page gets you ready to use FCF. For the hands-on flow, jump straight to [Mint Your RIK](/guide/mint-a-rik).

## Prerequisites

You need:

- **Node.js 20+** (Node 24 in CI is the reference).
- **A GitHub repository you own** and can push to.
- **A Sepolia RPC URL** from any provider (Alchemy, Infura, public node, etc).
- **A small amount of Sepolia ETH** to fund the wallet that will mint your RIK. Faucets such as the [Google Cloud Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) work.

You do not need:

- Any FCF account. There isn't one.
- Any prior on-chain identity. The CLI will create a fresh wallet for you.

## Install the CLI

```bash
npm install --global @freecodexyz/cli@alpha
```

Verify:

```bash
fcf --help
```

For other install options and version pinning, see [CLI → Install](/cli/install).

## What you will actually do

End-to-end, the minting flow looks like this:

1. From the repository you want to register, create a local FCF wallet and link its private key as a GitHub Actions secret.
2. Set two GitHub Actions repository variables: the RIK contract address and your Sepolia RPC URL.
3. Run `fcf init` to scaffold the registration workflow.
4. Fund the wallet with Sepolia ETH.
5. Commit and push the workflow file, then dispatch the `Register Repository` GitHub Action from the GitHub UI.

The workflow asks GitHub for an OIDC token, calls `fcf register` against the RIK contract, and mints your RIK on Sepolia.

The full walkthrough with commands is in [Mint Your RIK](/guide/mint-a-rik).

## Pick a path

| You want to | Go to |
| --- | --- |
| Mint your first RIK. | [Mint Your RIK](/guide/mint-a-rik) |
| Understand what RIK actually is. | [RIK Protocol](/concepts/rik) |
| Read the CLI reference. | [CLI Overview](/cli/) |
| Read the contract. | [RIK Contract](/protocol/rik-contract) |
| Browse minted RIKs. | [Browse the Registry](/guide/browse-registry) |
| Fix something that isn't working. | [Troubleshooting](/guide/troubleshooting) |
