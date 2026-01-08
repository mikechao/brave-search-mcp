FROM node:23.11-alpine AS builder

# Must be entire project because `prepare` script is run during `npm install` and requires all files.
COPY . /app

WORKDIR /app

RUN npm install -g pnpm@10

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM node:23.11-alpine AS release

WORKDIR /app

RUN npm install -g pnpm@10

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-lock.yaml

ENV NODE_ENV=production

RUN pnpm install --prod --ignore-scripts

ENTRYPOINT ["node", "dist/index.js"]