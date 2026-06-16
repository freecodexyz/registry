---
title: Contributing
description: How to file issues, open pull requests, and develop against the FCF codebase.
---

# Contributing

FCF is open source under Apache 2.0. Issues, pull requests, and discussion are welcome on both repositories.

## Where to file what

| You want to&hellip; | Go to |
| --- | --- |
| Report a bug in the RIK contract, the CLI, or anything under `fcf/`. | [`freecodexyz/fcf`](https://github.com/freecodexyz/fcf/issues) |
| Report a bug in the Registry API, indexer, web app, landing, docs, or shared UI. | [`freecodexyz/registry`](https://github.com/freecodexyz/registry/issues) |
| Report a **security vulnerability**. | Not GitHub. See [Security](/protocol/security#reporting-a-vulnerability). |
| Propose a new feature. | Open an issue with a short proposal first. |

## Local development, protocol & CLI

```bash
git clone https://github.com/freecodexyz/fcf.git
cd fcf
git submodule update --init --recursive
```

CLI (`cli/`):

```bash
cd cli
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

Contracts (`contracts/`):

```bash
cd contracts
forge fmt --check
forge build --sizes
forge test -vvv
```

When you change the contract ABI, regenerate the committed static ABI used by the CLI:

```bash
cd cli && pnpm abi
```

## Local development, Registry

```bash
git clone https://github.com/freecodexyz/registry.git
cd registry
pnpm install
```

Run everything (API + indexer + web app):

```bash
CONTRACT_ADDRESS="0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac" RPC_URL="https://base-sepolia-rpc.publicnode.com" CHAIN_ID=84532 pnpm dev
```

Per-app helpers:

```bash
pnpm dev:docs       # this site
pnpm dev:landing    # marketing site
pnpm build:docs
pnpm build:landing
```

## Style

The CLI uses strict ESM TypeScript (`module: nodenext`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Match the formatting of nearby code; there's no configured formatter.

Solidity should pass `forge fmt`. Use OpenZeppelin's standardized primitives where possible. Use custom errors for contract-specific failures.

Frontend code should:

- Use primitives from `@freecodexyz/ui` first; only add app-specific components when the primitive doesn't exist.
- Use CSS variables from `@freecodexyz/ui/styles.css` for spacing, type, colour. No hard-coded design tokens.
- Follow [`UI.md`](https://github.com/freecodexyz/registry/blob/main/UI.md).

## Commits

Recent human commit format in `fcf` is `(type) imperative summary`, e.g.:

- `(feat) add deployment script for RIK contract`
- `(fix) add shebang to index.ts for execution in github actions`
- `(chore) bump cli version`

Match this convention when you contribute.

## Tests

- **CLI changes**, run `pnpm typecheck` and `pnpm test` under `cli/`.
- **Contract changes**, run `forge fmt --check`, `forge build --sizes`, and `forge test -vvv` under `contracts/`.
- **ABI-affecting contract changes**, also run `pnpm abi`, `pnpm typecheck`, and `pnpm build` in `cli/`.

Keep Foundry tests deterministic and local. Don't hit GitHub, Base Sepolia, or any live RPC from unit tests.

## License

Apache 2.0. See [`LICENSE`](https://github.com/freecodexyz/fcf/blob/main/LICENSE).

## Continue

- [Protocol Overview](/protocol/), the on-chain side.
- [CLI Overview](/cli/), the command-line side.
- [Registry Overview](/registry/), the platform side.
