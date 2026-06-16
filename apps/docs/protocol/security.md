---
title: Security
description: Threat model, current security posture, and future audit notes for the RIK protocol.
---

# Security

::: warning Alpha software
The RIK protocol is in alpha on Base Sepolia. It has not been audited by a third party. Treat it as experimental until further notice.
:::

## Trust assumptions

The RIK contract trusts exactly two things:

1. **GitHub's signing keys.** Specifically: that GitHub correctly issues OIDC tokens only for workflows that actually run inside the claimed repository, and that the public keys in GitHub's published JWKS are the real ones.
2. **The contract owner.** They can `addKey` and `revokeKey` to keep the trusted set of GitHub signing keys current. They cannot mint, transfer, or rewrite a registration.

Everything else is verified on-chain from primitives. See [GitHub OIDC Trust Model](/concepts/oidc) and [JWT Verification](/protocol/verification) for the long form.

## Threat model

### What we defend against

| Threat | Defense |
| --- | --- |
| Someone minting a RIK for a repo they don't control. | The OIDC token's claims are signed by GitHub; only an actor with workflow-run permissions in the repo can cause the token to be issued. |
| Replaying someone else's OIDC token to a different address. | `aud == lowercase(msg.sender)` is enforced on-chain. |
| Forging a JWT. | RSA-PKCS#1 v1.5 signature verification via OpenZeppelin's audited `RSA` library. |
| Using a stale token. | `exp` is enforced against `block.timestamp`. GitHub tokens expire in ~15 minutes. |
| Using a future-dated token. | `nbf` is enforced. |
| Double-minting a single repo. | `_ownerOf(repoId) != address(0)` check at the end of `register`. |
| GitHub rotating signing keys. | `kid` mapping with owner-controlled `addKey` / `revokeKey`, kept current by [`fcf keys sync`](/cli/keys). |
| Truncation/encoding tricks in the JWT. | The signature is over the raw `headerB64 + "." + payloadB64` bytes the caller supplies; we never re-encode and we decode only for claim matching. |

### What we don't defend against

| Out of scope | Why |
| --- | --- |
| GitHub itself being compromised. | If GitHub's OIDC signing key is exfiltrated, every consumer of GitHub OIDC is affected. We follow the rotation. |
| Loss of the registrant's private key. | Standard Ethereum custody assumption. We do not custody anything. |
| Censorship at the RPC layer. | The user picks their RPC. |
| Forks of the OSS project itself competing on visibility. | A fork has a different `repository_id` and gets its own RIK. The Registry surfaces both. |

## What will change 

These are visible in the source today and are tracked openly:

- `EXPECTED_ISS` is a `constant`. There is a `NOTE` to make the issuer string owner-updatable in case GitHub ever moves the URL. Today the only path is a redeploy.
- `--contract` is a required CLI flag rather than a default per-network constant. Hardening "which contract should the CLI talk to" is on the list.

## Reporting a vulnerability

If you find a vulnerability in `RIK`, the CLI, or the Registry:

- **Do not** open a public issue with reproduction steps.
- Email the team via the contact on [freecodefund.xyz](https://freecodefund.xyz), or DM [@freecodexyz](https://x.com/freecodexyz) and ask for a secure channel.

We will acknowledge, triage, and credit responsibly.

## Continue

- [JWT Verification](/protocol/verification)
- [GitHub OIDC Trust Model](/concepts/oidc)
- [Deployments](/protocol/deployments)
