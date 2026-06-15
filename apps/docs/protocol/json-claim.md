---
title: JsonClaim Library
description: The byte-search library RIK uses to check JWT claims on-chain without parsing JSON.
---

# JsonClaim Library

`JsonClaim` is a tiny Solidity library used by [`RIK`](/protocol/rik-contract) to assert that the JWT payload contains expected string claims.

Source: [`contracts/src/JsonClaim.sol`](https://github.com/freecodexyz/fcf/blob/main/contracts/src/JsonClaim.sol).

## Why a custom library

A real JSON parser on-chain is expensive and easy to get wrong. We do not need one. The signature has already authenticated every byte of the JWT payload, so a literal substring match against the bytes is sufficient evidence that the claim is present with the expected value.

`JsonClaim` is intentionally small: an `indexOf` helper and a `requireStringClaim` assertion.

## Errors

```solidity
error ClaimMissing(string claim);
error ClaimMismatch(string claim);
```

- `ClaimMissing`, the claim key was not found at all (`"<key>":` is absent).
- `ClaimMismatch`, the claim key was found, but its string value did not match what we expected.

## `indexOf(bytes hay, bytes needle) → int256`

```solidity
function indexOf(bytes memory hay, bytes memory needle) internal pure returns (int256);
```

Returns the index of the first occurrence of `needle` inside `hay`, or `-1` if not present. Naive O(n·m). The expected inputs are short enough (a few hundred bytes of JWT payload, claims under a hundred bytes) that this is comfortably under any practical gas budget.

## `requireStringClaim(bytes payload, string key, string expectedValue)`

```solidity
function requireStringClaim(
    bytes memory payload,
    string memory key,
    string memory expectedValue
) internal pure;
```

Asserts that `payload` contains `"<key>":"<expectedValue>"` as a literal byte sequence. The logic is:

1. Build the full needle: `"<key>":"<expectedValue>"`.
2. If found in `payload`, return.
3. Otherwise build the partial needle: `"<key>":`.
4. If the partial needle is **not** found, revert with `ClaimMissing(key)`.
5. Otherwise revert with `ClaimMismatch(key)`.

This distinguishes "the claim isn't there" from "the claim is there with the wrong value", which produces a much better error message at the call site.

## Subtleties

### Whitespace and ordering

GitHub's OIDC tokens are emitted as compact JSON with no whitespace between `"key":"value"` pairs. The library matches the canonical compact form. If GitHub ever started emitting tokens with whitespace, this check would fail. We accept that coupling because:

- GitHub does not insert whitespace in OIDC tokens today.
- If they ever did, the bug would surface immediately in tests and we would adapt.

### Substring false positives

The needle includes the surrounding quotes for both key and value, so a partial match on a longer key (`"x"` matching inside `"xy"`) is not possible. The opening `"` before the key anchors the search.

### Only string-valued claims

`requireStringClaim` is for string-valued claims. For numeric claims (`exp`, `nbf`), `RIK._readUintClaim` does its own tiny scan starting from after the `"<key>":` marker, walking forward over decimal digits.

GitHub's OIDC tokens emit `repository_id` and `repository_owner_id` as JSON _strings_ (`"repository_id":"871234567"`), even though they're integers, which is why we can verify those with `requireStringClaim` against `Strings.toString(repoId)`.

## Continue

- [JWT Verification](/protocol/verification)
- [RIK Contract](/protocol/rik-contract)
