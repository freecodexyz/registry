---
title: fcf list
description: Print recent RepoRegistered events from the RIK contract.
---

# `fcf list`

Reads recent `RepoRegistered` events from the RIK contract and prints them as plain text.

## Usage

```bash
fcf list --contract <addr> [--from-block <n>]
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--contract <addr>` | required | The deployed RIK contract address to query. |
| `--from-block <n>` | `current_block - 50000` | Block to start scanning from. |

## Output

One line per event:

```text
repo=<repository_id> ownerId=<github_owner_id> registrant=<address> at=<unix_seconds>
```

For example:

```text
repo=871234567 ownerId=421337 registrant=0xabc...def at=1717499432
repo=903456789 ownerId=78901  registrant=0x123...456 at=1717512033
```

## Environment

| Variable | Description |
| --- | --- |
| `RPC_URL` | RPC endpoint. Defaults to `https://ethereum-sepolia-rpc.publicnode.com`. |

This command only reads the chain; it does not need `PRIVATE_KEY` and will not send any transactions.

## When to use it

- Confirm a registration landed without waiting for the Registry to index it.
- Backfill a local view from the chain for a specific block range.
- Quickly inspect activity during local development against an Anvil node.

## Continue

- [Browse the Registry](/guide/browse-registry), the same data, on the web app.
- [Registry → Indexer & API](/registry/api), the off-chain indexer that does the same scan continuously.
- [RIK Contract](/protocol/rik-contract), the source of the events.
