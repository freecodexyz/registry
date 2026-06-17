---
title: Why this matters
description: The long argument for why open-source needs an on-chain financial layer, and why the value that OSS produces is not captured by the people who build it.
---

# Why this matters

Open-source software runs the world. It does not get paid like it runs the world.

The value created by open source is extracted and compounded by every company, infrastructure provider, and platform that builds on top of it, while the maintainers of the underlying repositories almost always operate at a structural deficit relative to that value. There is a clean economic mismatch between the value an OSS project generates _for the world_ and the value its maintainers can _capture_ for themselves.

FCF exists to close that gap.

## The structural problem

Today, an open-source maintainer has three realistic monetization paths:

1. **Donations & sponsorships.** Voluntary, lumpy, doesn't scale, and creates a moral debt without an asset.
2. **Hosted/managed product on top of the OSS.** Forces the maintainer into a startup, ops, support, sales, the works.
3. **Sell out to a company.** The project becomes a salaried obligation and often loses its independence.

None of these monetize _the value that already exists in the repository itself._

## What we propose instead

Make the repository directly tradable.

If a repository is a real, productive asset that the rest of the software industry depends on, then it should be possible to buy and sell exposure to it, permission-lessly, on a transparent market, with the cashflow routed back to whoever controls the codebase.

To do that, three problems have to be solved, in this order:

1. Prove on-chain who actually controls a GitHub repository
2. Index every RIK in a public registry the world can browse
3. Open a permission-less market that prices repos and routes fees to RIK holders

Each layer is independently useful. None of them work if the bottom layer is fake. That is why we have spent so much energy on RIK before anything else.

## Why this is novel

RIK is the **first on-chain proof of GitHub repository ownership** that does not rely on a centralized whitelist or a trusted backend. The trust root is GitHub itself, via [OIDC tokens issued from GitHub Actions](/concepts/oidc), and the on-chain contract verifies their cryptographic signature directly.

This means:

- No FCF-controlled backend can decide which repos exist on-chain.
- No third party can claim a repo they do not actually control.
- Ownership survives renames and transfers on GitHub.
- Forks correctly mint a different RIK, because GitHub assigns them a different `repository_id`.

If we had relied on social login + a backend mint, we would have had to ask the world to trust us. RIK lets us _not_ ask for that trust.

## Who this serves

- **Open-source maintainers** who want their work to compound into something they own, without becoming a startup.
- **Investors and traders** who want exposure to the productivity of real software, not synthetic personality tokens.
- **The broader software ecosystem** that currently pays the maintenance burden in goodwill and burnout.

## Continue

- [RIK Protocol](/concepts/rik)
