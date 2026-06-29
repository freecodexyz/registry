FROM node:24-bookworm-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN pnpm install --filter @freecodexyz/api... --frozen-lockfile

COPY apps/api apps/api

RUN pnpm --filter @freecodexyz/api build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV="production"
ENV DB_PATH="/data/registry.db"

WORKDIR /app/apps/api

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./package.json
COPY --from=build /app/apps/api/tsconfig.json ./tsconfig.json
COPY --from=build /app/apps/api/src ./src
COPY --from=build /app/apps/api/dist ./dist

RUN mkdir -p /data

EXPOSE 3000 3055

CMD ["sh", "-c", "if [ \"$INDEXER\" = \"true\" ] || [ \"$INDEXER\" = \"1\" ]; then ./node_modules/.bin/tsx src/indexer.ts; else ./node_modules/.bin/tsx src/index.ts; fi"]
