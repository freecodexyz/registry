---
title: Web App
description: The Registry web app — what it shows, how it's built, how to run it locally.
---

# Web App

The Registry web app is the public-facing surface where minted RIKs are browsed. It lives at [`app.freecodefund.xyz`](https://app.freecodefund.xyz) and is implemented as a React + Vite SPA backed by the Registry API.

Source: `apps/web/` in [`freecodexyz/registry`](https://github.com/freecodexyz/registry).

::: info In active development
The app is being actively shaped. The pages below describe the current state at the time of writing; the public beta on Sepolia will follow.
:::

## Stack

| Layer | Choice |
| --- | --- |
| Framework | React 19, Vite |
| Data | TanStack Query against the Registry API |
| Wallet | Wagmi + Viem |
| Auth | Sign-In With Ethereum (SIWE) over the API's `/auth` endpoints |
| UI primitives | [`@freecodexyz/ui`](https://github.com/freecodexyz/registry/tree/main/packages/ui) |
| Build target | Static site served from `dist/` |

## What it shows

The two main surfaces:

### Repositories table

A compact, scannable view of every indexed registration. Columns include:

- Repository (GitHub `full_name`, with link).
- Primary language.
- Star count.
- Registrant (Ethereum address; truncated).
- Registered-at timestamp.

Sorting:

- `registered_at_desc` (default)
- `registered_at_asc`
- `stars_desc`

The list paginates and supports filtering by language. New registrations stream in over SSE, so the table updates live without a reload.

### Repository details drawer

Clicking a row opens a side drawer with:

- Full GitHub metadata (description, full URL, owner username, language, stars).
- Chain-side metadata (block number, transaction hash, registry contract address, chain ID).
- Direct links to the GitHub repo and the chain explorer.

## Wallet & auth

Connecting a wallet is optional for browsing but required for any gated action.

- The user connects through Wagmi.
- The app fetches a SIWE nonce from the API.
- The user signs the SIWE message in their wallet.
- The app posts the signed message to the API, which sets a session cookie.

The same session is then used for any token-gated endpoint. See [Access Gating](/registry/access).

## Running locally

From the repo root:

```bash
CONTRACT_ADDRESS="0xf696da98df236a36536e9385dAf05D196579612B" pnpm dev
```

This starts the API, the indexer, and the web app concurrently. The web app defaults to `http://localhost:5173` (which is the only origin the API allows out of the box).

To run just the web app:

```bash
pnpm --filter @freecodexyz/web dev
```

You'll still need the API running for it to render anything.

## Continue

- [Indexer & API](/registry/api)
- [Access Gating](/registry/access)
- [Browse the Registry](/guide/browse-registry)
