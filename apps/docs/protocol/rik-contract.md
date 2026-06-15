---
title: RIK Contract
description: The RIK ERC-721 contract — storage, errors, events, and the register/addKey/revokeKey interface.
---

# RIK Contract

`RIK` is the ERC-721 contract at the heart of the protocol. Each token represents an on-chain identity for a single GitHub repository.

Source: [`contracts/src/RIK.sol`](https://github.com/freecodexyz/fcf/blob/main/contracts/src/RIK.sol).

## Identity & inheritance

```solidity
contract RIK is ERC721, Ownable {
    constructor(address initialOwner)
        ERC721("Repository Identity Key", "RIK")
        Ownable(initialOwner) {}
}
```

- **Name**: `Repository Identity Key`
- **Symbol**: `RIK`
- **Inherits**: `ERC721`, `Ownable` (both OpenZeppelin).
- **Constructor**: takes the initial owner address. The deploy script (see [Deployments](/protocol/deployments)) sets this to `vm.addr(PRIVATE_KEY)`.

## Storage

### `_keys: mapping(bytes32 => RSAKey)`

The set of trusted GitHub OIDC signing keys.

```solidity
struct RSAKey {
    bytes modulus;
    bytes exponent;
    bool active;
}
```

Indexed by `kid`, the `keccak256(utf8(...))` of GitHub's published key ID. Stored as a 32-byte hash so the mapping key is fixed-size.

### `_repos: mapping(uint256 => Repo)`

The per-registration record.

```solidity
struct Repo {
    uint64 githubRepoId;   // == tokenId, kept for clarity
    uint64 githubOwnerId;  // GitHub numeric owner id at registration
    uint64 registeredAt;   // block.timestamp, truncated to uint64
    address registrant;    // who called register()
}
```

Indexed by the full `uint256 repoId` (which equals the GitHub `repository_id` and the ERC-721 `tokenId`).

### `EXPECTED_ISS`

```solidity
string public constant EXPECTED_ISS = "https://token.actions.githubusercontent.com";
```

The pinned issuer the JWT must declare. There is a TODO to make this owner-updatable in the future; today it is hardcoded.

## Events

```solidity
event RepoRegistered(
    uint256 indexed repoId,
    address indexed registrant,
    uint64  githubOwnerId,
    uint64  registeredAt
);

event KeyAdded(bytes32 indexed kid);
event KeyRevoked(bytes32 indexed kid);
```

`RepoRegistered` is what the [Registry indexer](/registry/api) and [`fcf list`](/cli/list) consume.

## Errors

```solidity
error AlreadyRegistered(uint256 repoId);
error UnknownKid(bytes32 kid);
error BadJwt();
```

Additional errors come from the [`JsonClaim`](/protocol/json-claim) library:

```solidity
error ClaimMissing(string claim);
error ClaimMismatch(string claim);
```

Two more revert via `require(...)` strings:

- `"token expired"`, `exp` is in the past.
- `"token not yet valid"`, `nbf` is in the future.

See [Troubleshooting](/guide/troubleshooting) for guidance on each.

## `register(...)`

```solidity
function register(
    bytes32 kid,
    bytes calldata headerB64,
    bytes calldata payloadB64,
    bytes calldata signature,
    uint256 repoId,
    uint64  githubOwnerId
) external;
```

Validates a GitHub OIDC JWT and mints a RIK if everything matches.

| Argument | Meaning |
| --- | --- |
| `kid` | `keccak256(utf8(jwt.header.kid))`. |
| `headerB64` | JWT header as base64url **bytes** (not decoded). |
| `payloadB64` | JWT payload as base64url **bytes** (not decoded). |
| `signature` | JWT signature, raw bytes (base64url decoded). |
| `repoId` | GitHub `repository_id`. Becomes the ERC-721 `tokenId`. |
| `githubOwnerId` | GitHub `repository_owner_id` at the time of registration. |

The verification chain is documented in detail at [JWT Verification](/protocol/verification). In summary:

1. `kid` is active.
2. RSA-PKCS#1 v1.5 signature over `sha256(headerB64 + "." + payloadB64)` verifies.
3. `aud` claim equals `Strings.toHexString(uint160(msg.sender), 20)`.
4. `repository_id` claim equals `repoId`.
5. `repository_owner_id` claim equals `githubOwnerId`.
6. `iss` claim equals `EXPECTED_ISS`.
7. `exp > block.timestamp`.
8. `nbf < block.timestamp`.
9. `_ownerOf(repoId) == address(0)` (not already registered).

If all checks pass, the contract:

- Stores a new `Repo` record at `_repos[repoId]`.
- Emits `RepoRegistered(repoId, msg.sender, githubOwnerId, block.timestamp)`.
- Mints the ERC-721 token: `_mint(msg.sender, repoId)`.

## `tokenIdOf(uint64)`

```solidity
function tokenIdOf(uint64 githubRepoId) external pure returns (uint256);
```

Returns `uint256(githubRepoId)`. Identity mapping, intentionally explicit so callers can use this without remembering the equality.

## `repoOf(uint256 tokenId)`

```solidity
function repoOf(uint256 tokenId) external view returns (Repo memory);
```

Returns the stored `Repo` for the given `tokenId`. Reverts with `"not registered"` if the token has never been minted.

## `addKey(bytes32 kid, bytes calldata n, bytes calldata e)`

Owner-only. Registers a new trusted GitHub signing key.

```solidity
function addKey(bytes32 kid, bytes calldata n, bytes calldata e) external onlyOwner;
```

Emits `KeyAdded(kid)`. See [`fcf keys sync`](/cli/keys) for the helper that batches this against GitHub's current JWKS.

## `revokeKey(bytes32 kid)`

Owner-only. Marks a key inactive. The mapping entry is preserved (modulus and exponent stay), but `active` is set to `false`, which causes `_verifyJwt` to revert with `UnknownKid` for tokens signed with that key.

```solidity
function revokeKey(bytes32 kid) external onlyOwner;
```

Emits `KeyRevoked(kid)`.

## What the contract does _not_ allow

- **No transfers blocked by the contract itself**, the standard ERC-721 transfer functions are available. If you want to transfer your RIK to a different address you can, but the historical `registrant` field stays the same.
- **No owner override on mint.** The owner cannot mint a RIK on someone else's behalf.
- **No update path on `Repo`.** Once registered, the stored fields are immutable.
- **No burn.** RIK V0 is one-per-repo, forever. Burn might be added in a future version with explicit governance.

## Continue

- [JWT Verification](/protocol/verification), the verification chain.
- [JsonClaim Library](/protocol/json-claim), the claim-search library.
- [Deployments](/protocol/deployments), addresses and chain selection.
