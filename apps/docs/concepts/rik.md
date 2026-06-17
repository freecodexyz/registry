---
title: RIK Protocol
description: The Repository Identity Key, FCF's on-chain primitive for proving GitHub repository ownership.
---

# RIK Protocol

The **Repository Identity Key (RIK)** is the foundational protocol primitive of FCF. It is the answer to a single, hard question:

> How can a smart contract know without trusting us, that whoever is calling `register(repoId)` actually controls that repository on GitHub?

If we cannot answer that question cleanly, nothing built on top of it can be trustworthy. Every downstream FCF product, funding, rewards, staking, tradable repo shares, depends on the assumption that the entity holding the RIK is the actual maintainer of the repository.

## What is a RIK, concretely

A RIK is an **ERC-721 token**:

- **Token ID** = the GitHub `repository_id` (a permanent numeric ID assigned at repo creation).
- **Owner** = the Ethereum address that successfully minted it.
- **One per repository, ever.** Double-registration reverts.
- **Survives GitHub renames and owner transfers** - `repository_id` does not change when `alice/widget` becomes `acme/widget`.
- **Forks get their own RIK** - GitHub assigns forks a fresh `repository_id`, so they are correctly treated as different repositories.

Each registration also records:

| Field | Meaning |
| --- | --- |
| `githubRepoId` | The repository's GitHub numeric ID (same as the token ID). |
| `githubOwnerId` | The GitHub numeric owner ID at the time of registration. |
| `registeredAt` | Block timestamp of the registration. |
| `registrant` | The address that called `register()`. |

For the exact storage layout, see [RIK Contract](/protocol/rik-contract).

## How RIK proves ownership

The contract trusts exactly two things, and nothing else:

1. **GitHub**. Specifically, the cryptographic key that GitHub uses to sign OIDC tokens for its Actions runners.
2. **Whoever deployed the RIK contract**. Only the deployer can rotate trusted signing keys when GitHub rotates theirs.

Everything else is verified on-chain from primitives.

The flow is:

1. The repo owner adds a small GitHub Actions workflow to the repository (scaffolded by [`fcf init`](/cli/init)).
2. The workflow asks GitHub for an **OIDC token**, a short-lived JWT, signed by GitHub, whose claims include the repository's `repository_id`, `repository_owner_id`, and a custom `aud` claim that the workflow is allowed to set.
3. The workflow sets `aud` to the maintainer's lower-cased Ethereum address.
4. The workflow calls [`fcf register`](/cli/register), forwarding the JWT to the RIK contract on-chain.
5. The contract verifies the JWT signature against GitHub's known signing keys, checks every claim, and if everything matches mints the RIK to `msg.sender`.

The deep dive lives in:

- [Proof-of-Ownership](/concepts/proof-of-ownership), the conceptual argument.
- [GitHub OIDC Trust Model](/concepts/oidc), why OIDC is the right trust root.
- [JWT Verification](/protocol/verification), the contract-level verification chain.

## Why GitHub's `repository_id` is the right key

We deliberately use the numeric `repository_id` rather than the `owner/name` string:

- **It is immutable.** Renames and transfers don't change it.
- **It is unique across GitHub.** No collisions.
- **It is GitHub's own canonical identifier**, included in every OIDC token GitHub mints.
- **Forks get their own ID.** A fork is correctly treated as a different repository.

This makes the RIK a stable handle for "this exact codebase", not "this exact name on GitHub today".

## Why this is novel

To our knowledge, RIK is the first protocol that mints an on-chain identity for a GitHub repository using **only** primitives that are already cryptographically attestable:

| Alternative | Why it fails |
| --- | --- |
| Social login + backend mint | The backend becomes the trust root. We become whoever decides which repos are "real". |
| Manual whitelist / review | Doesn't scale. Defeats the point of permission-less infrastructure. |
| Posting an Ethereum address in the repo README | Trivially forgeable; doesn't survive renames. |
| **OIDC JWT verified on-chain** | The signature is GitHub's. The `aud` binds it to the caller. The `repository_id` is GitHub's canonical handle. No backend involved. |

The mechanism is described in TLDR form in our public [Proof-of-Ownership article](https://x.com/freecodexyz/status/2065500261192184215?s=20).

## What RIK enables next

RIK is intentionally minimal: a verifiable claim that _this Ethereum address controls this GitHub repository_. With that as a base primitive, FCF can build repo-native, trust-less mechanics:

- **Funding** paid to the RIK holder.
- **Rewards** routed by RIK.
- **Staking** of $freecode against a repo, with the RIK as the identity.
- **Portable history** across renames and transfers (immutable `repository_id`).
- **Dashboards and indexers** like the [Registry](/concepts/registry), built off the `RepoRegistered` event.

## Continue

- [Proof-of-Ownership](/concepts/proof-of-ownership)
- [GitHub OIDC Trust Model](/concepts/oidc)
- [RIK Contract](/protocol/rik-contract)
- [Mint Your RIK](/guide/mint-a-rik)
