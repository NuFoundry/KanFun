# PocketBase image: pinned binary + this repo's migrations and hooks. Build context is the repo
# root, like every other image:  docker build -f server/Dockerfile .
FROM alpine:3.24
ARG TARGETARCH
RUN apk add --no-cache ca-certificates unzip wget
WORKDIR /pb
# The binary is checked against the release checksums committed next to the version, so a
# tampered or truncated download fails the build. Updating PocketBase means updating both files.
COPY server/.pocketbase-version server/.pocketbase-checksums ./
RUN VERSION="$(tr -d '[:space:]' < .pocketbase-version)" \
  && ZIP="pocketbase_${VERSION}_linux_${TARGETARCH:-amd64}.zip" \
  && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${ZIP}" -O "/tmp/${ZIP}" \
  && (cd /tmp && grep " ${ZIP}\$" /pb/.pocketbase-checksums | sha256sum -c -) \
  && unzip -q "/tmp/${ZIP}" pocketbase -d /pb \
  && rm "/tmp/${ZIP}" \
  && chmod +x /pb/pocketbase
COPY server/pb_migrations ./pb_migrations
COPY server/pb_hooks ./pb_hooks
COPY server/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p pb_data pb_public
EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8090/api/health || exit 1
ENTRYPOINT ["/pb/docker-entrypoint.sh"]
