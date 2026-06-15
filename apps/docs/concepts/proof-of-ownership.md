---
title: Proof-of-Ownership
description: Why RIK is a trust-less, permission-less proof that a specific Ethereum address controls a specific GitHub repository.
---

# Proof-of-Ownership

A claim has value only if it can be falsified. The whole point of RIK is to issue an on-chain claim that is _formally provable_:

> Whoever minted this RIK token controlled the corresponding GitHub repository at the time of minting.

This page explains why that claim holds, in plain language. For the contract-level mechanics see [JWT Verification](/protocol/verification).

## The trust assumptions, in full

There are exactly two:

1. **GitHub does what it says.** Specifically: only an actor with permission to add and run workflows in a repository can cause that repository to emit a signed OIDC token. GitHub holds the private key. GitHub publishes the corresponding public key.
2. **Whoever owns the deployed RIK contract** (us) is honest about which signing keys are in fact GitHub's. The owner can add or revoke keys but cannot mint, transfer, or rewrite a registration.

Everything else, can the requester forge a token, can they replay it from a different address, can they claim a repo they don't own, is verified on-chain from primitives.

## Why GitHub is a sufficient trust root

GitHub already has the answer to "does this address really control this repository?" baked into its permission model. The question is just how to surface that answer on-chain without GitHub having to know that an Ethereum chain exists.

OIDC tokens are how. Every GitHub Actions workflow can ask GitHub for a JWT (JSON Web Token) that is:

- **Signed by GitHub** with an RSA-2048 key whose public half is in GitHub's published JWKS endpoint.
- **Stamped with the repository's identity**: `repository`, `repository_id`, `repository_owner_id`, `actor`, `sub`.
- **Allowed to declare a custom `aud` claim**, the workflow gets to choose what audience the token is for.

If a workflow inside `foo/bar` requests a token, GitHub will not put `repository_id` of some unrelated repo into it. And if you do not have write access to `foo/bar`, you cannot run a workflow in it in the first place.

That is the trust path. We do not invent it; GitHub provides it.

## Binding the proof to a specific Ethereum address

The naive concern: "if GitHub emits a signed token for `foo/bar`, can anyone replay that token to mint a RIK for `foo/bar` to their own address?"

No. The token carries an `aud` claim that the workflow sets to a specific Ethereum address (the address that will receive the RIK). On-chain, the contract enforces:

```text
aud == lowercase hex of msg.sender
```

If a different address tries to call `register()` with the same token, the check fails. The token is _bound_ to the address it was issued for.

This is the single line that turns "GitHub signed this generic claim" into "GitHub signed this claim _for this Ethereum address_".

## What gets verified, in order

When `register()` is called, the contract refuses the mint unless:

1. **`kid` is active.** The JWT's `kid` (key ID) maps to an RSA key that the contract owner has marked as a current GitHub signing key.
2. **The RSA-PKCS#1 v1.5 signature is valid.** Verified against that key's modulus and exponent.
3. **`aud` matches `msg.sender`.** The token was issued for the caller's address.
4. **`repository_id` matches the argument.** The caller cannot claim a different repo than the one GitHub attested.
5. **`repository_owner_id` matches the argument.** Same idea.
6. **`iss` is `https://token.actions.githubusercontent.com`.** The token came from GitHub's Actions OIDC issuer, not some other OIDC provider.
7. **`exp` is in the future.** The token has not expired (Actions OIDC tokens are valid for ~15 minutes).
8. **`nbf` is in the past.** The token is already valid.
9. **The `repoId` has not already been registered.** RIK is one-per-repo, forever.

If all of the above are true, the RIK is minted to `msg.sender`. If any of them fail, the transaction reverts.

For the exact Solidity, see [JWT Verification](/protocol/verification) and [RIK Contract](/protocol/rik-contract).

## What we explicitly do _not_ rely on

- **Any FCF backend.** There isn't one in the trust path.
- **Any social login.** No OAuth handshakes, no FCF account.
- **Any whitelist.** The contract does not maintain a list of allowed repos or owners.
- **Any off-chain attestation.** JWT verification happens in Solidity.

## Continue

- [GitHub OIDC Trust Model](/concepts/oidc)
- [JWT Verification](/protocol/verification)
- [RIK Protocol](/concepts/rik)
