# registry

fcf registry platform monorepo.

## Development

- Start the platform for local development:

```shell
CONTRACT_ADDRESS="0xc03a52cD0EB2d5d456e64bda0557Db04608d1eac" RPC_URL="https://base-sepolia-rpc.publicnode.com" CHAIN_ID=84532 pnpm dev
```

- Manage dependencies:

```shell
# backend
pnpm <add or remove> --filter @freecodexyz/api <dep_name>

# frontend
pnpm <add or remove> --filter @freecodexyz/web <dep_name>
```
