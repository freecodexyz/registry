---
title: JWT Verification
description: How the RIK contract validates a GitHub Actions OIDC JWT on-chain, in order.
---

# JWT Verification

This page walks through the verification chain that `RIK.register()` runs against a GitHub Actions OIDC JWT, in order, with the exact Solidity.

If any check fails, the transaction reverts and no token is minted.

## Inputs

`register()` receives:

| Argument | Source |
| --- | --- |
| `kid` | `keccak256(utf8(jwt.header.kid))` |
| `headerB64` | The first JWT segment, as base64url bytes (not decoded). |
| `payloadB64` | The second JWT segment, as base64url bytes (not decoded). |
| `signature` | The third JWT segment, base64url-decoded. |
| `repoId` | The expected GitHub `repository_id`. |
| `githubOwnerId` | The expected GitHub `repository_owner_id`. |

The CLI builds all of these from the OIDC token it receives from GitHub.

## 1. Verify the signature is GitHub's

```solidity
RSAKey memory k = _keys[kid];
if (!k.active) revert UnknownKid(kid);

bytes memory signingInput = bytes.concat(headerB64, ".", payloadB64);
bytes32 digest = sha256(signingInput);
if (!RSA.pkcs1Sha256(digest, signature, k.exponent, k.modulus)) revert BadJwt();
```

- The `kid` must map to a key the contract owner has registered and not revoked.
- The signing input is exactly what GitHub signed: `headerB64 + "." + payloadB64`. We never decode the JWT just to re-encode it; the bytes the user supplied are the bytes the signature is over.
- Verification is RSA-PKCS#1 v1.5 over SHA-256 via OpenZeppelin's audited `RSA.pkcs1Sha256` (~90k gas).

If this passes, the contract knows the bytes of `payloadB64` are authentic.

## 2. Decode the payload exactly once

```solidity
bytes memory payload = bytes(Base64.decode(string(payloadB64)));
```

The decoded payload is JSON, e.g. `{"iss":"https://...","repository_id":"871234567",...}`. We do not parse it as JSON. We do byte-level substring searches for each expected claim, against the bytes the signature has already authenticated.

This is what [`JsonClaim`](/protocol/json-claim) does.

## 3. `aud` binds the proof to `msg.sender`

```solidity
JsonClaim.requireStringClaim(
  payload,
  "aud",
  Strings.toHexString(uint160(msg.sender), 20)
);
```

The token's `aud` claim must equal the caller's lowercase hex address.

This is the single line that turns a generic GitHub-signed claim into a proof bound to **this specific Ethereum address**. The CLI sets `audience=<lower(address)>` when requesting the OIDC token from GitHub; the contract enforces it on the way in.

## 4. `repository_id` matches the argument

```solidity
JsonClaim.requireStringClaim(
  payload,
  "repository_id",
  Strings.toString(repoId)
);
```

The caller cannot claim a different repository than the one GitHub attested.

## 5. `repository_owner_id` matches the argument

```solidity
JsonClaim.requireStringClaim(
  payload,
  "repository_owner_id",
  Strings.toString(uint256(githubOwnerId))
);
```

The owner ID stored in the `Repo` struct must come from GitHub's signed claims, not just be self-reported.

## 6. The issuer is GitHub Actions OIDC

```solidity
JsonClaim.requireStringClaim(payload, "iss", EXPECTED_ISS);
// EXPECTED_ISS == "https://token.actions.githubusercontent.com"
```

We pin the issuer string. If GitHub ever changes the URL (extremely unlikely), the constant has to change, today it's `constant` to make that a deliberate decision.

## 7. `exp` is in the future, `nbf` is in the past

```solidity
(uint256 exp_, bool fe) = _readUintClaim(payload, "exp");
(uint256 nbf_, bool fn) = _readUintClaim(payload, "nbf");
if (!fe || !fn) revert JsonClaim.ClaimMissing("exp/nbf");

if (block.timestamp > exp_) revert("token expired");
if (block.timestamp < nbf_) revert("token not yet valid");
```

`_readUintClaim` does a small forward scan over decimal digits starting after the claim marker. It is intentionally tiny.

GitHub Actions OIDC tokens are valid for ~15 minutes. Chain timestamps and runner timestamps can drift by seconds; we accept that drift because there is no cleaner way to bound it on-chain.

## 8. Repo hasn't already been registered

```solidity
if (_ownerOf(repoId) != address(0)) revert AlreadyRegistered(repoId);
```

RIK is one-per-repo, forever.

## 9. Record + mint

If all checks pass:

```solidity
Repo memory r = Repo({
    githubRepoId: uint64(repoId),
    githubOwnerId: githubOwnerId,
    registeredAt: uint64(block.timestamp),
    registrant: msg.sender
});
_repos[repoId] = r;

emit RepoRegistered(repoId, msg.sender, githubOwnerId, r.registeredAt);

_mint(msg.sender, repoId);
```

The `repoId` is truncated to `uint64` in storage (the GitHub `repository_id` is well within `uint64`); the full `uint256` is still used as the ERC-721 `tokenId`.

## Why we don't parse JSON properly

A real JSON parser in Solidity is expensive and easy to get wrong. We don't need one. The signature has already authenticated every byte of `payloadB64`, so a substring match against an expected literal is sufficient to assert a claim's presence and value.

The downside is that `JsonClaim.requireStringClaim` only checks string-valued claims. For numeric claims (`exp`, `nbf`) we hand-roll a tiny scanner. For everything else we use string equality, which is fine because:

- The claims we check are all either strings (`iss`, `aud`) or stringified numbers (`repository_id`, `repository_owner_id`, GitHub emits these as JSON strings, not numbers).
- The match is _byte_-equality against bytes whose signature we trust.

## Continue

- [JsonClaim Library](/protocol/json-claim), the byte-search helper.
- [GitHub OIDC Trust Model](/concepts/oidc), why this is sufficient.
- [RIK Contract](/protocol/rik-contract), storage and ABI.
- [Troubleshooting](/guide/troubleshooting), what each revert means in practice.
