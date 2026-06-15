---
title: Code-as-a-Business
description: "The Code-as-a-Business (CaaB) model: treating an open-source repository as a cashflow-generating asset its real maintainer can own and trade."
---

# Code-as-a-Business (CaaB)

**Code-as-a-Business**, written **CaaB**, is the economic model FCF is building toward. It is a simple reframing with deep consequences:

> An open-source repository is a productive asset. Whoever controls it should be able to capture the cashflow it generates, permission-lessly, transparently, on-chain, without changing what the project is or how it is built.

## The model in one diagram

```
Maintainer  ────► Repository  ◄──── Public usage of the code
   │                  │
   │                  │   (still open source, no change in behavior)
   │                  ▼
   │              RIK token  ────► On-chain identity of the repo
   │                  │
   │                  ▼
   │             Tradable market for the repo
   │                  │
   └────── trading fees + protocol cashflow ◄────┘
```

The CaaB model is _additive_. The repository stays open source. Users keep using it for free. What changes is that the project now also has an on-chain identity, a market, and a maintainer who can collect protocol-level cashflow against it.

## What makes this possible

Three primitives have to compose cleanly:

1. **A trust-less identity for the repo.** [RIK](/concepts/rik) provides this today.
2. **A registry that the world can browse.** The [Registry](/concepts/registry) is in active development.
3. **A market that prices the repo and routes fees to RIK holders.** 

Without all three, the model does not close. We are building them in order because (1) has to be unfakeable before (2) is worth indexing, and (2) has to be public before (3) is worth trading.

## What it changes for maintainers

- The repository becomes an _owned asset_ rather than a perpetual donation engine.
- Cashflow does not depend on the maintainer also running a startup, a managed service, or a Patreon.
- The asset survives renames and owner transfers on GitHub, because the RIK is keyed by `repository_id`.
- Reputation stays intact: there is no $TOKEN to bolt onto the project, no holder population pulling product decisions sideways.

## What it changes for the market

- A new asset class exists: tokenized exposure to real, productive open-source software.
- Asset selection is grounded in actual code, not personality launches.
- Fees flow to a verifiable on-chain identity, not to an off-chain claim.

## How CaaB differs from "launching a token"

| Token launchpad model | Code-as-a-Business model |
| --- | --- |
| Token is the primary thing built. | Code is the primary thing built. |
| Holders and users get fused into one population. | Users keep using the OSS; the market is separate. |
| Product gets bent to add $TOKEN utility. | Product stays exactly as it is. |
| Hard for existing serious projects to adopt. | Trivial for existing serious projects to adopt. |
| Reputation risk for the developer. | Reputation stays intact. |

## Continue

- [Why this matters](/introduction/why)
