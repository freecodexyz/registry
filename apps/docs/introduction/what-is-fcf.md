---
title: What is FCF
description: A plain-language introduction to FreeCodeFund and the on-chain financial layer it is building for open source software.
---

# What is FCF

**Free Code Fund**, written `fcf` in prose and commands, is a DeFi protocol company that gives open-source maintainers the tools to capture the value their code produces, without changing what they do or how they do it.

FCF builds the infrastructure that lets open-source repositories become **tokenized, tradable cashflow-generating assets** in a permission-less environment.

## What it enables 

If you maintain an open-source project, FCF lets you:

1. **Prove on-chain that you control your GitHub repository.** This is the [RIK protocol](/concepts/rik).
2. **Register your repo to the public [Registry](/concepts/registry).**
3. **Build on top of that identity**. The entire FCF protocol stack will route funding, rewards, staking, and tradable repo shares to whoever holds the RIK.

If you are a trader or investor, FCF gives you access to an asset class that did not previously exist: serious open-source projects, priced and traded directly, with the on-chain identity guaranteeing which repository you are buying exposure to.

## The category being built

FCF is building the **first decentralized marketplace of open-source software**.

The hard part is not the market, markets are easy to spin up. The hard part is making the asset _trustworthy_: making sure that "the token for repo `foo/bar`" actually corresponds to the real `foo/bar`, that the person collecting fees is actually the maintainer, that ownership survives renames and transfers, that nobody can squat on someone else's project.

That is what **RIK** solves. Without it, every step that comes after is built on sand.

## Where we are today

| Layer | Status |
| --- | --- |
| RIK protocol V0 (Sepolia) | Live |
| `@freecodexyz/cli` (`fcf`) | Published as alpha on npm |
| Registry public app | In active development, public beta soon |
| Registry indexer & API | In active development |
| $freecode token | Live ([details](/concepts/freecode-token)) |
| Rewards / Staking | In active development |
| Open marketplace for repo shares | In active development |

## Continue

- [RIK Protocol](/concepts/rik)
- [Mint Your RIK](/guide/mint-a-rik)
