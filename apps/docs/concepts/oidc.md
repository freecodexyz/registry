---
title: GitHub OIDC Trust Model
description: How GitHub Actions OIDC tokens give us a clean, on-chain-verifiable trust root for repository ownership.
---

# GitHub OIDC Trust Model

OIDC (OpenID Connect) is the substrate the RIK protocol stands on. This page explains what GitHub OIDC tokens are, why they are the right trust root, and how the contract uses them.

## The 30-second version

- Every GitHub Actions workflow can ask GitHub for a JWT.
- The JWT is signed with GitHub's private RSA key.
- The JWT's claims describe the workflow's exact identity: which repo, which owner, which actor, which ref.
- The JWT can declare a custom `aud` claim, the workflow gets to choose what audience the token is for.
- We make the workflow set `aud` to the maintainer's Ethereum address.
- The RIK contract verifies the signature using GitHub's public key, checks the claims, and mints if everything matches.

Reference: [GitHub OIDC documentation](https://docs.github.com/en/actions/concepts/security/openid-connect#how-oidc-integrates-with-github-actions).

## What a GitHub OIDC token looks like

A decoded payload looks roughly like this:

```json
{
  "iss": "https://token.actions.githubusercontent.com",
  "repository": "freecodefund/example",
  "repository_id": "871234567",
  "repository_owner_id": "421337",
  "actor": "alice",
  "sub": "repo:freecodefund/example:ref:refs/heads/main",
  "aud": "<the workflow sets this>",
  "exp": 1717500000,
  "iat": 1717499100,
  "nbf": 1717499100
}
```

Two things make this a solid trust root:

1. **The JWT is signed by GitHub.** The signature is RSA-2048 PKCS#1 v1.5 over the SHA-256 of `headerB64 + "." + payloadB64`. Anyone with GitHub's public modulus can verify it.
2. **`aud` binds the proof to the caller.** Because the workflow gets to set `aud`, we can demand `aud == msg.sender` on-chain. A token issued for address `0xA` cannot be replayed by address `0xB`.

## Why OIDC specifically

The alternatives we considered, and why each is worse:

| Alternative | Problem |
| --- | --- |
| Social login + backend mint | The backend becomes the trust root. We become the gatekeeper. |
| Manual whitelist | Doesn't scale, defeats the point. |
| Posting an address in the repo README | Easily faked, no chain of custody. |
| GitHub PAT verification on a backend | The backend still becomes the trust root, and PATs are user-scoped not repo-scoped. |
| **OIDC JWT verified directly on-chain** | No backend in the trust path. Verifiable by the contract. |

OIDC is the only option that lets the contract _itself_ be convinced, by GitHub's own cryptographic signature, that a specific repo's workflow issued the token.

## Key rotation

GitHub rotates the keys that sign OIDC tokens periodically. To stay correct, the RIK contract has a small mechanism:

- Keys are stored on-chain as a mapping from `kid` (key ID) to `(modulus, exponent, active)`.
- `kid` is stored as `keccak256(utf8(kid))` to make the key compact and indexable.
- The contract owner can call `addKey` to register new keys when GitHub publishes them, and `revokeKey` to mark a key inactive.
- The CLI subcommand [`fcf keys sync`](/cli/keys) automates pulling the current key set from `https://token.actions.githubusercontent.com/.well-known/openid-configuration` and pushing each `RSA` entry into the contract.

This is the **only** owner-privileged operation in RIK. The owner cannot mint, cannot transfer, cannot rewrite a registration, only keep the set of trusted GitHub signing keys current.

## What the contract does not do

- It does not call GitHub. There is no off-chain step.
- It does not maintain a list of repos or owners or actors. Only signing keys.

## The full verification chain

The contract checks, in order:

1. `kid` is registered and active.
2. RSA-PKCS#1 v1.5 signature over `sha256(headerB64 + "." + payloadB64)` verifies under the stored `(modulus, exponent)`.
3. `aud` claim equals `lowercaseHex(msg.sender)`.
4. `repository_id` claim equals the `repoId` argument.
5. `repository_owner_id` claim equals the `githubOwnerId` argument.
6. `iss` claim equals `https://token.actions.githubusercontent.com`.
7. `exp > block.timestamp`.
8. `nbf < block.timestamp`.
9. No prior registration of this `repoId`.

For the Solidity, see [JWT Verification](/protocol/verification).

## Continue

- [RIK Protocol](/concepts/rik)
- [Proof-of-Ownership](/concepts/proof-of-ownership)
- [JWT Verification](/protocol/verification)
- [`fcf keys sync`](/cli/keys)
