# UI System

The shared design system lives in `packages/ui/` and is published in-workspace as `@freecodexyz/ui`.

Use it from apps like this:

```ts
import { Button, Field, Input, Table } from '@freecodexyz/ui'
```

Import the global styles once at the app entry stylesheet:

```css
@import '@freecodexyz/ui/styles.css';
```

## Core Rules

- Build app-specific components in the app, but compose primitives from `@freecodexyz/ui` first.
- Do not copy UI primitives into apps. Add reusable primitives to `packages/ui/src/` and export them from `packages/ui/src/index.ts`.
- Use CSS variables from `styles.css`: spacing, typography, colors, borders, motion, and controls.
- Theme with `data-theme="dark"` / light default; accent with `data-accent="emerald|lime|forest|cyan"`.
- Prefer small, sharp, square controls over rounded cards or soft SaaS panels.

## Taste

- Minimal, technical, registry-like.
- Geist for UI, Geist Mono for labels, metadata, addresses, IDs, and table utility text.
- Thin rules, sparse spacing, compact tables, borderless navigation where possible.
- Use dark/light contrast deliberately: black primary actions, transparent ghost actions, accent only for state or focus.
- Links should feel precise: understated text, small underline/rule, external links for GitHub and chain explorers.
- Data views should prioritize scanability: short labels, truncated hashes, compact dates in tables, full details in drawers.
- Motion/visuals should be brand-specific, not decorative filler: dot-matrix point cloud, accent-tinted canvas, reduced-motion safe.

## Component Pattern

- Keep components focused: shell/layout, controls, data display, drawer/detail view.
- Keep state close to the owning feature unless it is truly shared.
- App CSS may define feature classes, but should rely on `@freecodexyz/ui` tokens.
- Responsive behavior should be explicit: desktop layout plus a dedicated mobile counterpart when navigation/actions change.

## Trading Terminal System

The web app has a parallel, app-local terminal layer in `apps/web/src/trading-terminal.css`. It is for marketplace/trading screens only and is imported after `@freecodexyz/ui/styles.css` from `apps/web/src/index.css`.

Use it from marketplace shells like this:

```tsx
<main className="trading-terminal" data-accent="cyan">
  <section className="tt-layout tt-layout--trade">
    ...
  </section>
</main>
```

Use `tt-scope` on isolated trading components before the full marketplace shell exists. `PriceChart.tsx` does this so it can read terminal chart colors from CSS variables.

### Terminal Rules

- Keep `@freecodexyz/ui` as the core system. The terminal layer is an app-specific density and market-data skin, not a replacement package.
- Scope terminal screens with `.trading-terminal`; use `.tt-*` classes and `--tt-*` variables for trading-specific surfaces, rows, chart colors, bids, asks, long/short states, and dense controls.
- Compose `@freecodexyz/ui` primitives where useful. Inside `.trading-terminal`, shared `fcf-*` buttons, fields, inputs, and tables are intentionally tightened by CSS overrides.
- Default to dark-first, high-density market panels: 4px panel gaps, 20-28px data rows, 30-36px controls, square borders, no rounded SaaS cards.
- Use Geist for interface labels and Geist Mono for prices, sizes, addresses, timestamps, balances, order IDs, and any tabular numeric value.
- Treat green as bid/long/up and red as ask/short/down. Use the accent color for focus, selected intervals, live status, and market identity, not for every number.
- Build panels as hard grid modules: chart, order book, order ticket, trade tape, positions, balances, and market stats should share borders and align to row heights.
- Prefer tables and keyed rows over cards for market data. Use right-aligned tabular numbers, clipped overflow, compact headers, and optional depth bars for scanability.
- Keep chart surfaces visually integrated with panels. Chart components should consume `--tt-chart-*` variables rather than hard-coded colors.
- Mobile layouts should stack panels deliberately and increase touch targets through terminal variables, not by adding separate visual styles.
