---
title: Registry
description: The public platform that indexes every minted RIK and surfaces repository metadata.
---

# Registry

The **Registry** is FCF's public discovery surface. It is the place where the rest of the world sees what has been minted on the RIK protocol.

If RIK is the on-chain primitive, the Registry is the human-readable face of it.

## What the Registry does

For every `RepoRegistered` event emitted by the RIK contract, the Registry:

1. **Indexes the event** off-chain into a queryable database.
2. **Enriches it with GitHub metadata**, full name, description, primary language, star count, public URL, via the GitHub REST API.
3. **Serves the result** through a public JSON API and through a web app with search, filtering, and detail views.
4. **Streams new registrations live** to connected clients via Server-Sent Events.

It does this without becoming a trust dependency: the Registry is a cache and a UI; the source of truth is always the on-chain RIK contract.

## What you can do with it

- Browse every RIK that has ever been registered.
- See which Ethereum address minted which RIK.
- Click through to the GitHub repository.
- Filter by language, sort by stars, paginate.
- Connect a wallet to authenticate via SIWE (Sign-In With Ethereum) and access gated features.

The web app is at [`app.freecodefund.xyz`](https://app.freecodefund.xyz) when deployed; see the [Registry → Overview](/registry/) for the system breakdown.

## How the Registry sits in the stack

```
GitHub Actions  ──┐
                  │  signed OIDC token
                  ▼
            RIK contract  ──── RepoRegistered event ──┐
                  │                                    │
                  │                                    ▼
                  │                              Registry indexer
                  │                                    │
                  │                                    ▼
                  │                              Registry API + Web
                  │                                    │
                  └────────── direct chain reads ──────┘
```

The Registry is downstream of the RIK contract and of GitHub. It does not gate registrations and it cannot block them: any successful on-chain `register()` produces a `RepoRegistered` event, which the indexer will eventually pick up.

## What the Registry is not

- It is not authoritative. The chain is.
- It is not the protocol. The protocol is the RIK contract.
- It is not the marketplace. 
- It is not a centralized whitelist. It indexes everything that has been registered.

## Continue

- [Registry → Overview](/registry/)
- [Indexer & API](/registry/api)
- [Web App](/registry/app)
- [RIK Protocol](/concepts/rik)
