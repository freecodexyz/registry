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
