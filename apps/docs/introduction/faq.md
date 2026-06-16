---
title: FAQ
description: Short answers to common questions about FCF, RIK, and the registry.
---

# FAQ

Quick answers. For depth, follow the links into the relevant section.

## What is FCF, in one sentence?

FCF is a DeFi protocol that turns open-source repositories into on-chain assets controlled by their real maintainers.

## What is RIK?

The **Repository Identity Key**: an ERC-721 token whose `tokenId` is a GitHub repository's numeric `repository_id`. Minting it cryptographically proves the minter controls that repository on GitHub. See [RIK Protocol](/concepts/rik).

## Is it a token launchpad?

No. We are explicit about not being one.

## Does FCF have a token?

Yes, it's called [$freecode](https://dexscreener.com/base/0x67a7ca081dc79b45fd1fa059cd3b8dcca779aba3) token. See [$freecode token](/concepts/freecode-token).

## What does FCF host today?

| Component | Status |
| --- | --- |
| RIK contract (V0 live on Base Sepolia) | Live |
| `@freecodexyz/cli` (`fcf`) | Alpha on npm |
| Public Registry web app | In active development |
| Indexer & API | In active development |

## Which network?

Base Sepolia testnet today. First Mainnet will be Base chain.

## How do I mint a RIK?

Five CLI commands and a GitHub Actions workflow. See [Mint Your RIK](/guide/mint-a-rik).

## What stops someone from minting a RIK for a repository they don't own?

The RIK contract verifies a JWT issued by GitHub from a workflow running _inside_ the target repository. Only a user with permission to add and run workflows in that repository can produce that JWT. The token is also bound to the caller's Ethereum address, so it cannot be replayed by anyone else. See [GitHub OIDC Trust Model](/concepts/oidc).

## What happens if I rename or transfer the repo on GitHub?

Nothing. The RIK uses the GitHub `repository_id`, which is assigned at repo creation and is immutable across renames and owner transfers. The RIK keeps pointing at the same repository.

## What about forks?

A fork gets a new `repository_id` from GitHub, which means it can mint its own RIK. That is the correct behaviour: a fork is a different repository.

## Can a RIK be revoked or burned?

In RIK V0, no. Registrations are final by design. Future versions may add controlled lifecycle operations.

## What does the Registry show?

Every minted RIK indexed off-chain, enriched with GitHub metadata (full name, description, language, stars, link). See [Registry → Overview](/registry/).

## Who can read the Registry?

The public surface is browsable. Some operations are gated behind a wallet session and a token-balance check; see [Access Gating](/registry/access).

## How do I report a bug or contribute?

Open a GitHub issue or PR in the relevant repository ([fcf](https://github.com/freecodexyz/fcf), [registry](https://github.com/freecodexyz/registry)). See [Contributing](/resources/contributing).

## Where can I follow updates?

- [`@freecodexyz`](https://x.com/freecodexyz) on X
- [github.com/freecodexyz](https://github.com/freecodexyz)
- [freecodefund.xyz](https://freecodefund.xyz)
