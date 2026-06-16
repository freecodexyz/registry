---
title: fcf github
description: GitHub helpers for the active repository - identity, Actions secrets, and Actions variables.
---

# `fcf github`

A small set of GitHub helpers scoped to the **current local repository**. The CLI identifies the current repo from your local git remote.

All `fcf github` commands require authentication to the GitHub REST API, either via a local `gh auth login` session or via `GH_TOKEN` / `GITHUB_TOKEN` in the environment.

## `fcf github whoami` {#whoami}

Prints the authenticated GitHub user.

```bash
fcf github whoami
```

Output:

```text
user=<login>   profile=https://github.com/<login>
```

## `fcf github secrets` {#secrets}

Read and write **GitHub Actions repository secrets** for the current repository.

### `fcf github secrets get <secret_name>`

Prints the metadata for a secret (name, creation date, last-updated date). The value itself cannot be read back, GitHub does not expose secret values via the API, ever.

```bash
fcf github secrets get FCF_PRIVATE_KEY
```

Output is the raw JSON metadata, pretty-printed.

### `fcf github secrets set <secret_name> <value>`

Writes or updates a repository secret.

```bash
fcf github secrets set FCF_PRIVATE_KEY 0x...
```

Output:

```text
secret set: <secret_name>
```

The value is encrypted with the repository's public key before being sent, as per the [Actions secrets API](https://docs.github.com/en/rest/actions/secrets).

## `fcf github vars` {#vars}

Read and write **GitHub Actions repository variables** (non-secret).

### `fcf github vars get <var_name>`

```bash
fcf github vars get FCF_CONTRACT
```

Prints the variable's metadata and value.

### `fcf github vars set <var_name> <value>`

```bash
fcf github vars set FCF_CONTRACT 0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac
fcf github vars set FCF_RPC_URL  https://your-base-sepolia-rpc
```

Output:

```text
variable set: <var_name>
```

Variables are visible to anyone with read access to the repository's Actions settings; **never put secrets in variables**.

## How the current repo is detected

The CLI reads your local git remotes to figure out the owning org/user and repo name. The repository must be a GitHub remote that the authenticated user has access to. If the detection fails, double-check that:

- You are inside a git working tree.
- A remote exists (`git remote -v`).
- The remote URL points at GitHub.
- Your auth token (or `gh auth`) has the scopes for the operation.

## Continue

- [`fcf init`](/cli/init), uses these helpers indirectly via the workflow template.
- [`fcf wallet link`](/cli/wallet#link), writes `FCF_PRIVATE_KEY` through the same secrets API.
- [Mint Your RIK](/guide/mint-a-rik), the end-to-end flow.
