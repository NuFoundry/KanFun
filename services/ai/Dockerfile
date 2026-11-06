# AI service image. Build context must be the repo root:
#   docker build -f services/ai/Dockerfile -t kan-fun-ai .
FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY services/ai/package.json services/ai/
RUN pnpm install --frozen-lockfile --filter ai
COPY services/ai services/ai
RUN pnpm --filter ai build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/ai/package.json services/ai/
RUN pnpm install --frozen-lockfile --filter ai --prod
COPY --from=build /app/services/ai/dist services/ai/dist
WORKDIR /app/services/ai
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8787/ai/health || exit 1
# The image's unprivileged user: a compromised dependency gets no root in the container.
USER node
CMD ["node", "dist/index.js"]
