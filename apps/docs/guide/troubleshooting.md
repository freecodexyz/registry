---
title: Troubleshooting
description: Common failures when minting a RIK or running the CLI, and how to fix them.
---

# Troubleshooting

Each section below is keyed by what you see and what to do about it. If your problem isn't here, open an issue on [`freecodexyz/fcf`](https://github.com/freecodexyz/fcf/issues).

## `fcf register` — generic guidance

`fcf register` is the most failure-prone command because it ties together three independent systems: GitHub OIDC, the RIK contract, and your wallet/RPC. Before debugging:

- Confirm you are running the command **inside a GitHub Actions runner** with `permissions: id-token: write`. The CLI cannot mint locally because it needs an OIDC token that only GitHub can issue.
- Confirm the workflow file you committed is the one `fcf init` scaffolded, or that you preserved its `permissions` and env block.
- Confirm `FCF_PRIVATE_KEY`, `FCF_RPC_URL`, and `FCF_CONTRACT` are set in the repo's Actions environment (secret + variables).

## "GitHub OIDC env vars not found"

The runner is missing `ACTIONS_ID_TOKEN_REQUEST_URL` or `ACTIONS_ID_TOKEN_REQUEST_TOKEN`.

**Fix**: the workflow must include:

```yaml
permissions:
  contents: read
  id-token: write
```

The default `fcf init` template includes this. If you wrote a custom workflow, add it.

## `aud mismatch: want <addr>, got <other>`

The OIDC token's `aud` claim doesn't match the wallet that's calling `register()`.

**Cause**: the OIDC token was issued for a different Ethereum address than the one whose private key is signing the transaction.

**Fix**:
- Verify `secrets.FCF_PRIVATE_KEY` corresponds to the wallet you intend to mint to.
- Verify the workflow is requesting the OIDC token with `audience=<that wallet's lowercase address>`. The CLI handles this automatically when it requests the token itself.
- If you are passing `--oidc-token` manually, the address must match the `aud` you set when fetching the token.

## "token expired"

The OIDC token's `exp` claim is older than the current block timestamp.

GitHub Actions OIDC tokens are valid for **~15 minutes**. If your workflow stalled (long install, queue delay, etc.) the token can expire before `register()` lands.

**Fix**: re-run the workflow. If you frequently hit this, slim down the steps that precede `fcf register`.

## "token not yet valid"

The OIDC token's `nbf` is in the future. This is almost always a chain clock vs. workflow clock issue on test environments. Re-run the workflow.

## `UnknownKid(<kid>)`

The `kid` (key ID) the JWT was signed with is not registered, or has been revoked, in the RIK contract.

This happens when GitHub rotates its OIDC signing keys and the contract's key set hasn't been refreshed.

**Fix** (contract owner only):

```bash
fcf keys sync --contract <addr>
```

See [`fcf keys sync`](/cli/keys). If you are not the contract owner, the fix is on our side; open an issue.

## `BadJwt`

The RSA-PKCS#1 v1.5 signature didn't verify against the stored `(modulus, exponent)` for that `kid`.

This is rare and indicates either:

- The token was modified in transit. Re-run the workflow.
- The key set is out of date in an unusual way. Sync keys.

## `AlreadyRegistered(<repoId>)`

This `repository_id` has already been minted. RIK is one-per-repo, forever.

**Fix**: there is no fix, this is by design. If you believe the existing RIK was minted maliciously, open an issue with evidence.

## `JsonClaim.ClaimMissing("<claim>")` / `ClaimMismatch("<claim>")`

The contract could not find an expected claim (`aud`, `iss`, `repository_id`, `repository_owner_id`, `exp`, `nbf`) in the JWT payload, or found one with the wrong value.

**Cause**: the JWT shape changed, or you forwarded the wrong token.

**Fix**: re-run with the default flow. If the issue persists across reruns, GitHub's OIDC token format may have changed; open an issue.

## "not registered" (when reading `repoOf`)

You're asking the contract for a `tokenId` that has never been minted. Mint it first via [Mint Your RIK](/guide/mint-a-rik).

## "RIK contract address is missing" (Registry API)

You're running the Registry API server without `CONTRACT_ADDRESS` set in the environment. Set it:

```bash
CONTRACT_ADDRESS=0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac RPC_URL=https://base-sepolia-rpc.publicnode.com CHAIN_ID=84532 pnpm dev
```

## Need more help?

- File an issue: [`freecodexyz/fcf`](https://github.com/freecodexyz/fcf/issues) (protocol/CLI) or [`freecodexyz/registry`](https://github.com/freecodexyz/registry/issues) (Registry).
- Reach out on [X](https://x.com/freecodexyz).
