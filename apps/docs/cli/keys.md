---
title: fcf keys sync
description: Sync GitHub's OIDC signing keys into the RIK contract. Owner-only.
---

# `fcf keys sync`

Reads the current set of RSA signing keys that GitHub uses to sign OIDC tokens, and registers each one into the RIK contract via `addKey`.

This is an **owner-only** operation. Only the deployer of the RIK contract can call `addKey` successfully; if anyone else runs this command the transactions will revert.

## Usage

```bash
fcf keys sync --contract <addr>
```

## Options

| Option | Required | Description |
| --- | --- | --- |
| `--contract <addr>` | yes | The deployed RIK contract address to call. |

## What it does

1. Fetches GitHub's OpenID configuration from:
   ```text
   https://token.actions.githubusercontent.com/.well-known/openid-configuration
   ```
2. Reads the `jwks_uri` from that document and fetches the JWKS (JSON Web Key Set).
3. For each `RSA` key in the JWKS that has a `kid`, `n` (modulus), and `e` (exponent), it sends an on-chain `addKey(kid, n, e)` transaction.
4. Logs the result of each call:

   ```text
   key synced: <kid> kid=<keccak256-of-kid> status=<0|1>
   ```

## Environment

| Variable | Description |
| --- | --- |
| `PRIVATE_KEY` | The deployer's private key. Must match the contract's `owner()`. |
| `RPC_URL` | RPC endpoint. Defaults to `https://ethereum-sepolia-rpc.publicnode.com`. |

## When to run it

GitHub rotates these keys periodically. If you start seeing `UnknownKid` reverts on `register()` for legitimate OIDC tokens, it means the JWT was signed with a `kid` the contract doesn't know about yet. Running `fcf keys sync` will catch the contract up.

If you are _not_ the contract owner, you cannot fix this directly. Open an issue and we'll sync.

## Why `kid` is hashed on-chain

GitHub's `kid` values are arbitrary-length strings. Storing them as raw bytes would be expensive in storage and inconvenient as a mapping key. The contract uses `keccak256(utf8(kid))` instead, which is a fixed 32-byte handle. The CLI helper `jwtKid()` does the same hashing client-side so the two stay aligned.

## Continue

- [GitHub OIDC Trust Model](/concepts/oidc), why the keys matter.
- [JWT Verification](/protocol/verification), how keys are used in `_verifyJwt`.
- [RIK Contract](/protocol/rik-contract), the `addKey` / `revokeKey` interface.
