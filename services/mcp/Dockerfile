# MCP service image. Build context must be the repo root:
#   docker build -f services/mcp/Dockerfile -t kan-fun-mcp .
FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY services/mcp/package.json services/mcp/
RUN pnpm install --frozen-lockfile --filter mcp
COPY services/mcp services/mcp
RUN pnpm --filter mcp build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/mcp/package.json services/mcp/
RUN pnpm install --frozen-lockfile --filter mcp --prod
COPY --from=build /app/services/mcp/dist services/mcp/dist
WORKDIR /app/services/mcp
EXPOSE 8791
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8791/mcp/health || exit 1
# The image's unprivileged user: a compromised dependency gets no root in the container.
USER node
CMD ["node", "dist/index.js"]
