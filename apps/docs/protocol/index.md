---
title: Protocol Overview
description: The Solidity contracts and on-chain mechanics that make up the RIK protocol.
---

# Protocol Overview

The on-chain side of FCF is, today, two Solidity contracts living in [`freecodexyz/fcf`](https://github.com/freecodexyz/fcf) under `contracts/`:

| Contract | Purpose |
| --- | --- |
| [`RIK`](/protocol/rik-contract) | The ERC-721 that mints a Repository Identity Key for each registered GitHub repo. |
| [`JsonClaim`](/protocol/json-claim) | A small library used by `RIK` to search the JWT payload for expected claims. |

The two files are deliberately small. We optimized for legibility, not for storage tricks. Every non-obvious decision is intended to be explainable in a few sentences.

## Stack

| Layer | Choice |
| --- | --- |
| Compiler | Solidity `^0.8.24` |
| Toolchain | [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`, `anvil`) |
| Standards | [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts) (ERC-721, Ownable, RSA, Base64, Strings) |
| Tests | `forge-std` Foundry test runner, with `vm.ffi` for JWT fixture generation |

OpenZeppelin and `forge-std` are vendored as git submodules under `contracts/lib/`.

## Why this looks small

The contract surface area is intentionally minimal:

- **One mint path** (`register`), bound to a verified GitHub OIDC token.
- **Two owner-only operations** (`addKey`, `revokeKey`) to maintain the trusted GitHub signing key set.
- **Two read paths** (`tokenIdOf`, `repoOf`) plus the standard ERC-721 read functions.

We do not implement governance, upgradeability, fee mechanics, or staking inside `RIK`. Those belong on top of it, in future contracts that take a RIK ID as input. Keeping `RIK` minimal keeps the trust story easy to argue.

## Read in order

1. **[RIK Contract](/protocol/rik-contract)**, storage, errors, events, the `register` function.
2. **[JWT Verification](/protocol/verification)**, the signature + claims check, step by step.
3. **[JsonClaim Library](/protocol/json-claim)**, how we read claims out of the JWT payload.
4. **[Deployments](/protocol/deployments)**, addresses and chain selection.
5. **[Security](/protocol/security)**, threat model and (placeholder) audit notes.

## Source

| File | Purpose |
| --- | --- |
| `contracts/src/RIK.sol` | The ERC-721 + JWT verification. |
| `contracts/src/JsonClaim.sol` | Byte-search claim library. |
| `contracts/script/Deploy.s.sol` | Foundry deploy script. |
| `contracts/deploy-sepolia.sh` | Wrapper for testnet deployment. |
| `contracts/test/RIK.t.sol` | Foundry tests. |
| `contracts/test/fixtures/load-fixture.mjs` | `vm.ffi` helper that generates RSA/JWT fixtures for the Solidity tests. |
