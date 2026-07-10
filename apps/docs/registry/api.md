---
title: Indexer & API
description: How the Registry indexes the RIK contract, enriches with GitHub metadata, and serves the result.
---

# Indexer & API

The Registry's backend is one Fastify process that runs in two modes, **API server** and **indexer**, chosen by the `INDEXER` environment variable. They share the same SQLite database.

Source: `apps/api/` in [`freecodexyz/registry`](https://github.com/freecodexyz/registry).

## The indexer

The indexer is a polling loop. On each tick (every ~12 seconds) it:

1. Reads `last_block` from the `indexer_state` table.
2. Asks the RPC for the current head block.
3. Calls `getLogs` against the RIK contract for the `RepoRegistered` event over `(last_block + 1, head]`.
4. For each event, inserts a row into the `repos` table.
5. Best-effort enrichment for each row: fetch the GitHub repo metadata (full name, description, language, stars, URL) and the owner's GitHub username via the GitHub REST API. Upsert into the `github_meta` table.
6. Emits a `repo` event on the in-process `registryEvents` emitter; the API server's SSE endpoint relays it to connected clients.
7. Writes the new `last_block` back to `indexer_state`.

Tunables and behavior:

| Setting | Default | Source |
| --- | --- | --- |
| Poll interval | 12 seconds | hardcoded |
| Initial backfill range | last 50,000 blocks | hardcoded `DEFAULT_LIST_BLOCK_RANGE` |
| Chain | Base Sepolia | hardcoded; matches the deployed contract |

### Caches

Two in-process caches sit above SQLite to absorb load:

- **Repo cache.** Per-`repoId`, holds the enriched GitHub metadata and the owner's username. TTL: 5 minutes.
- **Event cache.** Holds the most recent event list. TTL: 10 seconds.

SQLite remains the durable layer; the caches just keep restarts from immediately fanning out to the RPC and GitHub API again.

### Endpoints (current shape)

The exact route table is still evolving as the app is being built; treat this as the design intent rather than a contract.

| Route | Purpose |
| --- | --- |
| `GET /repos` | Paginated list of registered repositories with metadata. Supports `sort=registered_at_desc | registered_at_asc | stars_desc`. |
| `GET /repos/:repoId` | A single registration, with the full enriched payload. |
| `GET /events` | SSE stream of new registrations as the indexer picks them up. |
| `POST /auth/nonce` | Issue a SIWE nonce for a given address. |
| `POST /auth/verify` | Verify a SIWE message and start a session. |
| `POST /auth/logout` | End the session. |
| `GET /gate` | Check whether the current session holds the minimum gate-token balance. |

The exact response shapes are defined inline in `apps/api/src/index.ts`. The same source defines the SSE payload shape (`RepoStreamPayload`).

## Storage

SQLite (better-sqlite3). Tables:

| Table | Purpose |
| --- | --- |
| `repos` | One row per `RepoRegistered` event. Holds `repo_id`, `registrant`, `github_owner_id`, `registered_at`, `block_number`, `transaction_hash`, `chain_id`. |
| `github_meta` | One row per `repo_id`. Holds enriched metadata: `full_name`, `description`, `language`, `stars`, `html_url`, `owner_name`, `cached_at`. |
| `indexer_state` | Key/value pairs for indexer bookkeeping (`last_block`). |

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `CONTRACT_ADDRESS` | yes | The RIK contract address to index. |
| `RPC_URL` | no | RPC endpoint. Defaults to `https://base-sepolia-rpc.publicnode.com`. |
| `STATE_VIEW` | no | Uniswap v4 StateView contract for depth snapshots. Defaults to Base Sepolia `0x571291b572ed32ce6751a2cb2486ebee8defb9b4`. |
| `CHAIN_ID` | no | SQLite default chain ID. Defaults to `84532`. |
| `INDEXER` | no | Set to `1` or `true` to run the indexer loop alongside the server. |
| `GITHUB_TOKEN` | yes | Used for GitHub REST API enrichment. |
| `SIWE_DOMAIN` | no | The domain used in SIWE messages. Defaults to `localhost:5173`. |
| `SESSION_KEY` | no | 32-byte key used to sign session cookies. Generated per-process if missing. |
| `SESSION_COOKIE_SECURE` | no | Set to `false` to allow non-HTTPS cookies (dev). |
| `GATE_TOKEN_ADDRESS` | yes | ERC-20 used for the access gate. See [Access Gating](/registry/access). |
| `GATE_TOKEN_MIN_BALANCE` | no | Minimum balance required to pass the gate. Defaults to `1`. |
| `SWAP_ASSETS_FILE_PATH` | no | Path to a `.assets.json` file used by the swap API. If unset, startup loads the newest `*.assets.json` in the command working directory. |

## Running locally

```bash
CONTRACT_ADDRESS="0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac" RPC_URL="https://base-sepolia-rpc.publicnode.com" CHAIN_ID=84532 pnpm dev
```

This runs both the API and the indexer (and the web app). To run just the API:

```bash
pnpm --filter @freecodexyz/api dev:api
```

And the indexer in a separate process:

```bash
pnpm --filter @freecodexyz/api dev:indexer
```

Both share the SQLite file under `apps/api/data/`.

## Continue

- [Web App](/registry/app), the frontend consumer.
- [Access Gating](/registry/access), the SIWE + token-gate flow.
- [`fcf list`](/cli/list), a CLI-only equivalent of the indexer's chain scan.
