---
title: Browse the Registry
description: How to find and explore minted RIKs through the public Registry web app and via the CLI.
---

# Browse the Registry

Once a RIK is minted, it shows up in two places: the **Registry web app** and the on-chain logs themselves. This page explains both.

## The Registry web app

::: info In active development
The Registry is being built. Some features below are present in development; the public beta will land on Base Sepolia first.
:::

The Registry web app lives at [`app.freecodefund.xyz`](https://app.freecodefund.xyz). It is the public, browsable view of every RIK that has been minted on the protocol.

You can:

- **Browse all registered repositories**, sorted by registration time or by GitHub stars.
- **See the on-chain registrant** (the Ethereum address that minted the RIK) next to the repository.
- **Click through to the GitHub repository** for any RIK.
- **Connect a wallet** via Sign-In With Ethereum (SIWE) to access gated features. See [Access Gating](/registry/access).

Newly minted RIKs are streamed live: if you leave the page open, you should see new registrations appear as they are picked up by the indexer.

For the system breakdown of how the app is composed, see [Registry → Web App](/registry/app).

## Using the CLI

You can also list registrations directly from the chain without the web app:

```bash
fcf list --contract 0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac
```

By default the CLI scans the last ~50,000 blocks for `RepoRegistered` events. To start from a specific block:

```bash
fcf list --contract <addr> --from-block 12345678
```

Output is one line per registration:

```text
repo=<repository_id> ownerId=<owner_id> registrant=<address> at=<timestamp>
```

See [`fcf list`](/cli/list) for the full reference.

## Reading the chain directly

Every successful registration emits the following event:

```solidity
event RepoRegistered(
  uint256 indexed repoId,
  address indexed registrant,
  uint64 githubOwnerId,
  uint64 registeredAt
);
```

You can subscribe or backfill from any RPC node. The on-chain log is the authoritative record; the Registry is a UI on top of it.

## Continue

- [Registry → Overview](/registry/), how the platform is built.
- [Indexer & API](/registry/api), the indexing and serving layer.
- [`fcf list`](/cli/list), the on-chain list command.
