---
title: fcf wallet
description: Create a local FCF wallet and link its private key to a GitHub Actions secret.
---

# `fcf wallet`

Helpers for managing the wallet that signs FCF transactions. The wallet is a plain Ethereum keypair; `fcf` does not require any kind of FCF-managed identity on top.

## `fcf wallet create` {#create}

Generates a new wallet and stores it locally.

```bash
fcf wallet create [--force]
```

| Option | Default | Description |
| --- | --- | --- |
| `--force` | off | Overwrite an existing local wallet. |

The wallet is written to a per-user config directory (the exact path is printed by the command). The address is printed to stdout:

```text
wallet created: 0xabc...def
saved: /path/to/wallet.json
```

This wallet's private key is what `fcf register` will use to sign the on-chain transaction. **Keep it private.** If you lose it, you lose control of any RIK minted to that address.

## `fcf wallet link` {#link}

Saves the local wallet's private key as a **GitHub Actions repository secret** in the current repository.

```bash
fcf wallet link [--secret-name <name>]
```

| Option | Default | Description |
| --- | --- | --- |
| `--secret-name <name>` | `FCF_PRIVATE_KEY` | The Actions secret name to write into. |

Output:

```text
wallet linked: 0xabc...def
secret set: FCF_PRIVATE_KEY
```

This is what allows the scaffolded GitHub Action to sign `register()` calls. The secret name defaults to `FCF_PRIVATE_KEY` because that is what the workflow template expects; if you change it here, you must change the matching reference in `.github/workflows/fcf-register.yml`.

`fcf wallet link` requires GitHub API auth to write the secret, either via `gh auth login` on the local machine or via `GH_TOKEN`/`GITHUB_TOKEN` in the environment.

## How the CLI finds the wallet

When you run a command that needs to sign a transaction (`fcf register`, `fcf keys sync`), the CLI looks for the private key in this order:

1. **`PRIVATE_KEY` environment variable.** Used as-is (must be `0x`-prefixed hex).
2. **Local wallet store.** Loaded from the path written by `fcf wallet create`.

If neither is present, the command exits with an error.

## Security notes

- Treat the local wallet as if it were any other private key on your machine. Back it up before you delete it.
- Base Sepolia is currently the only network the protocol runs on; Base Sepolia ETH is not real money, but treating it as throw-away is still the safest habit while alpha.
- For CI use, `fcf wallet link` is sufficient. The secret is written through GitHub's encrypted secrets API and is not retrievable in plaintext after writing.

## Continue

- [`fcf register`](/cli/register), the command that signs with this wallet.
- [`fcf init`](/cli/init), the workflow that consumes `FCF_PRIVATE_KEY`.
- [Mint Your RIK](/guide/mint-a-rik), full walkthrough.
