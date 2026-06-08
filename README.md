# registry

fcf registry platform monorepo.

## Development

- Start the platform for local development:

```shell
CONTRACT_ADDRESS="0xf696da98df236a36536e9385dAf05D196579612B" pnpm dev
```

- Manage dependencies:

```shell
# backend
pnpm <add or remove> --filter @freecodexyz/api <dep_name>

# frontend
pnpm <add or remove> --filter @freecodexyz/web <dep_name>
```