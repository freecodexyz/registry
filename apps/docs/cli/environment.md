---
title: Environment & Networks
description: Environment variables, RPC defaults, and chain selection for the fcf CLI.
---

# Environment & Networks

The `fcf` CLI is configured almost entirely through environment variables. This page is the authoritative reference for them.

## Variables

| Variable | Used by | Default | Description |
| --- | --- | --- | --- |
| `PRIVATE_KEY` | `fcf register`, `fcf keys sync` | local wallet store | Hex private key (`0x...`) of the signer. |
| `RPC_URL` | `fcf register`, `fcf keys sync`, `fcf list` | `https://base-sepolia-rpc.publicnode.com` | RPC endpoint. |
| `ACTIONS_ID_TOKEN_REQUEST_URL` | `fcf register` | unset | Set automatically by GitHub Actions runners with `id-token: write`. |
| `ACTIONS_ID_TOKEN_REQUEST_TOKEN` | `fcf register` | unset | Same as above. |
| `GH_TOKEN` / `GITHUB_TOKEN` | `fcf github *`, `fcf wallet link` | unset (falls back to `gh auth`) | GitHub REST API token. |
| `SKIP_STATIC_ABI` | All ABI-using commands | unset | When set, load the ABI from the live Foundry artifact instead of the committed static copy. For local development only. |

## Chain selection

The CLI picks the chain based on `RPC_URL`:

- If the URL contains the substring `base-sepolia`, it uses the **Base Sepolia** chain.
- If the URL contains the substring `sepolia`, it uses the legacy **Ethereum Sepolia** chain.
- Otherwise, it uses the **`foundry`** (local anvil) chain.

There is no flag override. To switch networks, change `RPC_URL`.

> The protocol is currently testnet-only. Pointing the CLI at a mainnet RPC will not work against the deployed contract; there is no mainnet deployment yet.

## Local development against Anvil

A repo-level helper script makes this one command:

```bash
./local-rpc.sh src/RIK.sol:RIK
```

This starts a local Anvil node, deploys the `RIK` contract, and prints the RPC URL, the deployer private key, the owner, and the contract address. You can then run the CLI against it:

```bash
PRIVATE_KEY=<printed-key> \
RPC_URL=http://127.0.0.1:8545 \
fcf list --contract <printed-address>
```

Because the URL doesn't contain `sepolia`, the CLI auto-selects the `foundry` chain.

## OIDC tokens outside Actions

`fcf register` will not be able to fetch an OIDC token unless it's running inside a GitHub Actions runner with the right permissions. If you need to run it locally for debugging, capture a valid token from a previous Actions run (its `aud` claim must match your local wallet address) and pass it explicitly:

```bash
fcf register --contract <addr> --oidc-token <jwt>
```

Tokens expire after ~15 minutes.

## Continue

- [`fcf register`](/cli/register), the main consumer of these vars.
- [`fcf init`](/cli/init), the workflow that wires the vars in CI.
- [Mint Your RIK](/guide/mint-a-rik), full walkthrough.
