# AGENTS.md

Guidance for AI coding agents working in this repository. See
<https://agents.md/> for the file convention.

## Project Overview

- Project name: write it as `registry` when referring to this repository.
- Product/protocol names: preserve `fcf`, `FreeCodeFund`, `RIK`, `$FREECODE` exactly when they refer to those concepts.
- Purpose: fcf registry platform monorepo for the gated RIK Registry web app,
  Fastify API/indexer, marketing landing page, VitePress docs, shared UI
  package, Docker Compose deployment, and Terraform EC2 deployment.
- Repository shape: pnpm workspace with apps in `apps/*` and reusable packages
  in `packages/*`.
- Runtime stack: Node 24, `pnpm@10.24.0`, ESM TypeScript, React 19, Vite,
  Fastify 5, better-sqlite3, Viem, Wagmi, SIWE, Octokit, VitePress, Nginx,
  Docker Compose, and Terraform.

## Environment Setup

- Use Node 24 to match the Docker images and installed `@types/node` versions.
- Use Corepack and pnpm from the workspace root: `corepack enable` and
  `pnpm install --frozen-lockfile`.
- Do not use npm or yarn in this repo unless the user explicitly asks to change
  package managers.
- `better-sqlite3` has native build requirements. Docker installs `python3`,
  `make`, and `g++`; local machines need equivalent build tools if pnpm cannot
  use a prebuild.
- Copy `.env.example` to `.env` for local runtime values, but never read,
  print, or commit real `.env` files.
- Required API/indexer environment: `CONTRACT_ADDRESS`, `GATE_TOKEN_ADDRESS`,
  and `GITHUB_TOKEN`.
- Optional API/indexer environment: `GATE_TOKEN_MIN_BALANCE`, `RPC_URL`,
  `SIWE_DOMAIN`, `SESSION_KEY`, `SESSION_COOKIE_SECURE`, `ALLOWED_ORIGINS`,
  `DB_PATH`, and `CHAIN_ID`.
- `RPC_URL` defaults to public Base Sepolia RPC. `SIWE_DOMAIN` defaults to
  `localhost:5173`. `SESSION_KEY` defaults to a random process-local key, which
  invalidates sessions on restart.
- `ALLOWED_ORIGINS`, when set, must be a JSON array of strings, not a
  comma-separated list.

## Commands

| Purpose | Command |
| --- | --- |
| Install workspace dependencies | `corepack enable && pnpm install --frozen-lockfile` |
| Run full local platform | `CONTRACT_ADDRESS=... GATE_TOKEN_ADDRESS=... GITHUB_TOKEN=... pnpm dev` |
| Run API only | `pnpm --filter @freecodexyz/api dev:api` |
| Run indexer only | `pnpm --filter @freecodexyz/api dev:indexer` |
| Run web app only | `pnpm --filter @freecodexyz/web dev` |
| Run landing page only | `pnpm dev:landing` |
| Run docs only | `pnpm dev:docs` |
| API typecheck/build | `pnpm --filter @freecodexyz/api build` |
| Web lint | `pnpm --filter @freecodexyz/web lint` |
| Web build | `pnpm --filter @freecodexyz/web build` |
| Landing lint | `pnpm --filter @freecodexyz/landing lint` |
| Landing build | `pnpm --filter @freecodexyz/landing build` |
| Docs build | `pnpm build:docs` |
| Docker Compose config check | `docker compose --env-file .env config` |
| Docker Compose local deploy | `docker compose --env-file .env up -d --build --remove-orphans` |
| Terraform format check | `cd terraform && terraform fmt -check` |
| Terraform validate | `cd terraform && terraform validate` |
| Find agent TODOs when asked | `rg -F 'TODO (AGENT)'` |

Do not use root `pnpm test` as a verification command unless you first change
it. It is currently the default placeholder and exits with an error.

Do not run cloud/deployment commands such as `terraform apply`,
`terraform destroy`, or `wrangler deploy` unless the user explicitly asks for a
deployment or infrastructure change.

## Repository Structure

- `package.json`: root workspace scripts and `pnpm@10.24.0` declaration.
- `pnpm-workspace.yaml`: includes `apps/*` and `packages/*`.
- `tsconfig.base.json`: shared strict TypeScript options for backend packages.
- `.env.example`: documented runtime environment keys. Keep real values out of
  git and out of agent responses.
- `.dockerignore`: Docker build context exclusions. It intentionally excludes
  `apps/landing`, `apps/docs`, `terraform`, `node_modules`, `dist`, and API
  data.
- `docker-compose.yml`: runs API, indexer, and web containers with a shared
  `registry-data` volume.
- `apps/api/`: Fastify API and polling indexer package `@freecodexyz/api`.
- `apps/api/src/index.ts`: API entrypoint, env validation, CORS, SIWE auth,
  `$FREECODE` gate checks, repo list endpoint, SSE stream, and exported Viem
  objects consumed by the indexer.
- `apps/api/src/indexer.ts`: Base Sepolia `RepoRegistered` poller, SQLite upserts,
  GitHub enrichment, and in-process event emission.
- `apps/api/src/db.ts`: SQLite schema, lightweight migrations, prepared
  statements, and default `DB_PATH` handling.
- `apps/api/src/github.ts`: Octokit client plus repository and owner metadata
  lookups.
- `apps/api/src/events.ts`: process-local `EventEmitter` used for repo stream
  updates.
- `apps/api/Dockerfile`: Node 24 API/indexer image. Runtime chooses API versus
  indexer from `INDEXER`.
- `apps/web/`: gated React Registry app package `@freecodexyz/web`.
- `apps/web/src/wagmi.ts`: Base Sepolia-only Wagmi config with injected wallet
  connector.
- `apps/web/src/AuthSessionProvider.tsx` and `apps/web/src/useSignIn.ts`:
  wallet session and SIWE sign-in flow.
- `apps/web/src/useLiveRepos.ts`: SSE client for `/api/repos/stream`.
- `apps/web/nginx.conf`: static web serving plus `/api/` proxy to the API
  container with buffering disabled for SSE.
- `apps/landing/`: React/Vite marketing landing page package
  `@freecodexyz/landing` with GSAP scroll animation and Cloudflare Workers
  assets config.
- `apps/docs/`: VitePress docs package `@freecodexyz/docs` with content under
  topic directories and theme/config under `.vitepress/`.
- `packages/ui/`: shared React UI primitives and global CSS tokens, exported as
  `@freecodexyz/ui`.
- `UI.md`: design-system rules for shared UI usage and visual language.
- `terraform/`: minimal AWS EC2 deployment that uploads the repo, writes a
  remote `.env`, and runs Docker Compose.

## Architecture Boundaries

- The registry source of truth is the RIK contract `RepoRegistered` event on
  Base Sepolia. GitHub metadata is enrichment and must remain non-consensus.
- Preserve the API/indexer coupling around `INDEXER`. `apps/api/src/index.ts`
  must not start the HTTP server when `INDEXER=true`, because the indexer
  imports shared exports from that module.
- `CONTRACT_ADDRESS`, `GATE_TOKEN_ADDRESS`, and `GITHUB_TOKEN` are hard startup
  requirements for both API and indexer paths. Keep failures explicit through
  `die()` or similarly clear startup errors.
- `CHAIN_ID` only controls the SQLite default. Runtime chain behavior is
  Base Sepolia via `viem/chains` unless the code is intentionally changed.
- Keep nonce storage normalized by lowercase address and single-use for SIWE.
- Keep SIWE domain checks aligned with the web origin. Local default is
  `localhost:5173`; Terraform derives `SIWE_DOMAIN` from the deployed public
  host.
- Preserve the `$FREECODE` token gate for protected API routes and for the SSE
  stream. Do not weaken balance checks, session checks, or periodic stream
  revocation without explicit user approval.
- Preserve `secureSession` cookie defaults unless the deployment model changes.
  `SESSION_COOKIE_SECURE=false` is only appropriate for the current minimal HTTP
  EC2 deployment described in `terraform/README.md`.
- Keep SQLite as the durable cache for event and GitHub metadata. `apps/api/data`
  is local/generated and must not be committed.
- Schema changes in `apps/api/src/db.ts` affect persisted SQLite databases. Add
  small forward migrations instead of assuming a fresh database.
- Keep event refresh/idempotency based on `repo_id`, block numbers, and
  transaction hash. The API may replay overlapping ranges and the indexer may
  poll repeatedly.
- Keep `/api/repos/stream` compatible with EventSource. Nginx proxy buffering
  must stay off for `/api/` so SSE updates are not buffered.
- The web app talks to the API through relative `/api` paths. Vite proxies to
  `localhost:3000`; Nginx proxies to the `api` Docker Compose service.
- The web app currently supports Base Sepolia and injected wallets only. Do not add
  wallet connectors, chains, or production RPC defaults without user approval.
- `apps/landing/src/components/navbarLinks.ts` imports the logo from the web
  app assets. If moving assets, update both apps deliberately.
- Docs use `apps/docs/.vitepress/config.ts` and `publicDir: '../landing/public'`
  for shared public assets. Keep docs links and navigation consistent when pages
  move.
- Docker Compose runs only API, indexer, and web. Landing and docs are excluded
  from the Docker context and use separate Cloudflare Workers assets configs.
- Terraform state and tfvars can contain secrets. Treat `terraform.tfstate`,
  `terraform.tfvars`, generated `.pem` keys, and `.terraform/` as private local
  artifacts.

## UI And Frontend Rules

- Use `@freecodexyz/ui` primitives first for app UI. Do not copy reusable
  primitives into apps.
- Add reusable UI primitives in `packages/ui/src/` and export them from
  `packages/ui/src/index.ts`.
- Import global UI styles once from `@freecodexyz/ui/styles.css` in app entry
  stylesheets.
- Follow `UI.md`: minimal, technical, registry-like; Geist UI type, Geist Mono
  for labels/metadata/addresses; thin rules; compact tables; square controls;
  sparse spacing.
- Theme with `data-theme="dark"` or the light default. Accent with
  `data-accent="emerald|lime|forest|cyan"`.
- Prefer CSS variables from `packages/ui/src/styles.css` over hard-coded design
  tokens.
- Keep app-specific CSS in the app, but rely on shared tokens and primitives for
  controls, data display, cards, overlays, navigation, and tables.
- Preserve explicit responsive behavior, especially where desktop and mobile
  navigation/actions differ.
- Respect reduced-motion behavior. Landing visuals and point clouds should be
  brand-specific, not generic decorative filler.

## Code Style

- Prefer minimal, direct changes. Do not broad-refactor unless the user asks.
- Match nearby formatting. The codebase currently has mixed two-space and
  four-space indentation, mixed semicolon usage, and single quotes in React
  files.
- TypeScript is strict. Preserve `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, and `verbatimModuleSyntax` where configured.
- Use ESM imports. Use `node:` imports for Node built-ins in new backend code.
- Use type-only imports for TypeScript types when practical.
- Keep API errors explicit and user-facing through Fastify/http errors rather
  than silent fallbacks.
- Avoid live network calls in new tests or checks unless the task is explicitly
  about RPC, GitHub, deployment, or infrastructure behavior.
- React code should stay simple and local. Do not add `useMemo` or `useCallback`
  by default; use them only where existing patterns or a concrete stability need
  justify them.
- Do not introduce new global state for UI unless it is genuinely shared across
  features.
- Comments should explain constraints or non-obvious behavior, not restate code.

## Testing And Verification

- There is currently no committed test suite and no GitHub Actions workflow.
- For API/backend changes, run `pnpm --filter @freecodexyz/api build`.
- For web app changes, run `pnpm --filter @freecodexyz/web lint` and
  `pnpm --filter @freecodexyz/web build`.
- For landing changes, run `pnpm --filter @freecodexyz/landing lint` and
  `pnpm --filter @freecodexyz/landing build`.
- For docs changes, run `pnpm build:docs`.
- For shared UI changes, run the builds for every affected consumer, usually
  `pnpm --filter @freecodexyz/web build`, `pnpm --filter @freecodexyz/landing build`,
  and `pnpm build:docs`.
- For Docker changes, run `docker compose --env-file .env config` when a real
  local `.env` is available. Do not print the resulting secret-expanded config
  in the final response.
- For Terraform changes, run `cd terraform && terraform fmt -check` and, after
  init, `cd terraform && terraform validate`. Do not run `apply` or `destroy`
  without explicit approval.
- If verification is skipped because it needs secrets, live services, or local
  tools that are not present, say that directly in the handoff.

## Git/PR Workflow

- Recent human commit format: `(type) imperative summary`.
- Examples from this repo: `(feat) add docs app`, `(chore) update dockerignore`,
  `(fix) fix theme switch`.
- AI-created commit format when the user asks for a commit:
  `(type) (openai/gpt-5.5, reviewed T|F, tested T|F) imperative summary`.
- Before creating an AI commit, ask the user whether a human reviewed the
  changes so `reviewed T|F` is accurate.
- Mark `tested T` only after the relevant checks have run successfully.
  Otherwise use `tested F`.
- Before committing, inspect `git status --short`, `git diff`, and
  `git log --oneline -10`; stage only intended files.
- Run `git diff --check` before commit/PR handoff.

## Boundaries

- Never edit, print, copy, infer, or commit real secrets: `.env`, `.env.*`,
  `terraform.tfvars`, `terraform.tfstate`, `*.pem`, GitHub tokens, RPC keys,
  session keys, wallet data, or provider credentials.
- Do not commit generated/local artifacts: `node_modules/`, `dist/`,
  `apps/*/dist/`, `apps/*/node_modules/`, `apps/api/data/`, `.wrangler/`,
  `.vitepress/cache/`, `.terraform/`, Terraform state, Terraform tfvars, or
  generated SSH keys.
- Do not run deployment or infrastructure mutation commands unless explicitly
  requested: `terraform apply`, `terraform destroy`, `wrangler deploy`, AWS
  resource changes, or production Docker updates.
- Do not change production/provider configuration without explicit approval:
  environment variable names, default RPC behavior, contract addresses, token
  gate semantics, session/cookie security, public domains, Docker ports, or
  Terraform networking defaults.
- Do not weaken authentication, SIWE verification, GitHub token usage, API rate
  limiting, `$FREECODE` balance gating, or SSE revocation as a simplification.
- Do not edit generated dependency/build outputs directly. Change source files
  and regenerate with the appropriate command when needed.
- Never replace pnpm, Vite, Fastify, SQLite, Docker Compose, or Terraform with
  another toolchain without explicit user approval.
