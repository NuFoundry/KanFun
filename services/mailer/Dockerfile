# Mailer service image. Build context must be the repo root:
#   docker build -f services/mailer/Dockerfile -t kan-fun-mailer .
FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY services/mailer/package.json services/mailer/
RUN pnpm install --frozen-lockfile --filter mailer
COPY services/mailer services/mailer
RUN pnpm --filter mailer build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/mailer/package.json services/mailer/
RUN pnpm install --frozen-lockfile --filter mailer --prod
COPY --from=build /app/services/mailer/dist services/mailer/dist
WORKDIR /app/services/mailer
EXPOSE 8788
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8788/mail/health || exit 1
# The image's unprivileged user: a compromised dependency gets no root in the container.
USER node
CMD ["node", "dist/index.js"]
