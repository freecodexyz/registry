---
title: Access Gating
description: How the Registry authenticates wallets via SIWE and gates features behind a token balance.
---

# Access Gating

The Registry is publicly browsable. Some actions, intended for future product surfaces, sit behind two-stage access control:

1. **Sign-In With Ethereum (SIWE).** Prove that the visitor controls a given Ethereum address.
2. **Token-balance gate.** Check that the signed-in address holds at least the minimum balance of a configured ERC-20.

## Why two steps

Each step answers a different question:

| Step | Answers |
| --- | --- |
| SIWE | "Which address is this session associated with?" |
| Token gate | "Does that address meet the protocol-defined threshold?" |

SIWE alone is identity without policy; the gate alone has no identity to apply policy to. Composing them gives a session whose authorization is grounded in an on-chain balance.

## SIWE flow

Both ends live in `apps/api/src/index.ts` and `apps/web/src/`:

1. **Connect wallet** in the web app via Wagmi.
2. **Request a nonce**, the app calls a `POST /auth/nonce` endpoint with the wallet address. The API generates a single-use nonce (kept in memory, keyed by lowercase address) and returns it.
3. **Sign the SIWE message**, the app constructs a `SiweMessage` (domain from `SIWE_DOMAIN`, the nonce from step 2, statement text) and asks the wallet to sign it.
4. **Verify**, the app posts the message + signature to `POST /auth/verify`. The API validates the signature, validates the nonce (single-use), and on success stores `{ address }` in the secure session cookie.
5. The session cookie travels on subsequent requests; protected routes read `req.session.get("address")`.

Session config:

- Path: `/`
- HTTP-only
- `secure` flag respects `SESSION_COOKIE_SECURE` (defaults to on in production).
- `sameSite: "lax"`
- `maxAge`: 1 day.

Sessions are signed with `SESSION_KEY` (a 32-byte secret). For dev runs that don't set it, a random key is generated per-process, meaning sessions don't survive a restart.

## Rate limiting

`@fastify/rate-limit` is configured to allow 120 requests per minute per session address (or per IP for anonymous traffic). Excess requests return a structured 429.

## Token gate

The gate is an ERC-20 balance check against the SIWE-signed address.

| Variable | Purpose |
| --- | --- |
| `GATE_TOKEN_ADDRESS` | The ERC-20 used to evaluate the gate. |
| `GATE_TOKEN_MIN_BALANCE` | The minimum balance required to pass. Defaults to `1`. |

The API reads the address's `balanceOf` on the gate token via viem and compares against `GATE_TOKEN_MIN_BALANCE`. On the frontend the result is exposed as a simple gated/ungated state that the `GateAccessButton` / `GateView` components render against.

## Continue

- [Web App](/registry/app)
- [Indexer & API](/registry/api)
- [$freecode token](/concepts/freecode-token)
