---
title: Registry Overview
description: How the FCF Registry is built — web app, indexer, API, shared UI.
---

# Registry Overview

The **Registry** is the public platform that turns the on-chain RIK protocol into something humans can browse, search, and react to. It is structured as a small monorepo of focused apps.

Source: [`freecodexyz/registry`](https://github.com/freecodexyz/registry).

## Structure

The runtime layout is intentionally simple:

```
Base Sepolia RPC ─► api (indexer)  ──► SQLite
                              ▲
                              │
GitHub REST API ──────────────┘  (metadata enrichment)
                              │
api (server)  ◄────────────────  reads SQLite, serves JSON + SSE
   ▲
   │
   ▼
web (React)  ◄────► wallet (SIWE) ◄────► api (auth endpoints)
   │
   ▼
user browser
```

The chain is the source of truth. The indexer polls the RIK contract for `RepoRegistered` events, enriches each event with GitHub metadata, and writes the result to SQLite. The API server reads from SQLite and broadcasts new registrations over Server-Sent Events. The web app subscribes to the SSE stream and renders.

## Reading list

- **[Web App](/registry/app)**, what the user sees, how it authenticates.
- **[Indexer & API](/registry/api)**, how the indexing works, what the API exposes.
- **[Access Gating](/registry/access)**, SIWE login + token-balance gate.

## Local development

The monorepo uses pnpm workspaces. From the repo root:

```bash
CONTRACT_ADDRESS="0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac" RPC_URL="https://base-sepolia-rpc.publicnode.com" CHAIN_ID=84532 pnpm dev
```

This runs the API, the indexer, and the web app concurrently. Use the per-app helpers to develop pieces in isolation:

```bash
pnpm dev:docs      # this site
pnpm dev:landing   # marketing site
```

See the [README](https://github.com/freecodexyz/registry/blob/main/README.md) for the full set of scripts and per-app filters.

## Continue

- [Web App](/registry/app)
- [Indexer & API](/registry/api)
- [Access Gating](/registry/access)
