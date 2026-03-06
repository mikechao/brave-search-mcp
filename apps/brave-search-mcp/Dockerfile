FROM node:23.11-alpine

WORKDIR /app

RUN npm install -g pnpm@10

# Build from the monorepo root so workspace packages resolve correctly.
COPY . /app

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --no-frozen-lockfile
RUN pnpm -C apps/brave-search-mcp build

WORKDIR /app/apps/brave-search-mcp

ENV NODE_ENV=production
EXPOSE 3001

ENTRYPOINT ["node", "dist/index.js"]
