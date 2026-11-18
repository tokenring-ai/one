# vim:set ft=docker/dockerfile:1.8
# syntax=docker/dockerfile:1.8

FROM debian:trixie-slim AS runtime

LABEL org.opencontainers.image.source="https://github.com/tokenring-ai/one"

# Everything runs as the unprivileged user `tokenring` (uid/gid 52917, a fixed high id that is not a login on typical
# hosts). Its home is /home/tokenring; the settings and vault folders are created here, owned by it, so named volumes
# mounted on them start out writable. They are also world-writable so `docker run --user "$(id -u):$(id -g)"` works
# with fresh volumes (a container holds one tenant; the vault file itself is created 0600 by whoever runs).
RUN <<EOF
set -e
apt-get update
apt-get install -y --no-install-recommends ca-certificates
rm -rf /var/lib/apt/lists/*
groupadd --gid 52917 tokenring
useradd --uid 52917 --gid tokenring --home-dir /home/tokenring --create-home --shell /usr/sbin/nologin tokenring
mkdir -p /home/tokenring/.tokenring /home/tokenring/.config/tokenring /repo
chown -R tokenring:tokenring /home/tokenring /repo
chmod 0777 /home/tokenring /home/tokenring/.tokenring /home/tokenring/.config /home/tokenring/.config/tokenring /repo
EOF

ENV HOME=/home/tokenring
WORKDIR /repo

FROM runtime AS cli
ARG TARGETARCH
COPY dist/tokenring-cli-linux-${TARGETARCH} /usr/local/bin/tokenring
RUN chmod 755 /usr/local/bin/tokenring
ARG VERSION=dev
LABEL org.opencontainers.image.title="TokenRing One CLI" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/tokenring-ai/one" \
      org.opencontainers.image.licenses="MIT"
USER tokenring
ENTRYPOINT ["/usr/local/bin/tokenring"]

FROM runtime AS server
ARG TARGETARCH
RUN <<EOF
set -e
apt-get update
apt-get install -y --no-install-recommends git python3
rm -rf /var/lib/apt/lists/*
# The project is mounted from the host and is usually owned by someone else. Without this, every git command in /repo
# (the documented mount point) fails with "dubious ownership".
git config --system --add safe.directory /repo
EOF
COPY dist/tokenring-one-linux-${TARGETARCH} /usr/local/lib/tokenring-one/tokenring-one
RUN chmod 755 /usr/local/lib/tokenring-one/tokenring-one
ARG VERSION=dev
LABEL org.opencontainers.image.title="TokenRing One" \
      org.opencontainers.image.description="Local-first multi-agent workspace: coding, canvas, documents, media, and research." \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/tokenring-ai/one" \
      org.opencontainers.image.licenses="MIT"
# A high port, so the unprivileged user can bind it on any runtime. Map it as you like (-p 3000:14008) or pass another
# one (`docker run <image> --port 9000`): --listen and --workingDirectory stay in the entrypoint, so overriding only
# the port keeps the server reachable from outside the container.
EXPOSE 14008
USER tokenring
# Healthy when the app accepts connections on whichever port it is listening on. Docker's embedded DNS resolver
# (127.0.0.11, hex 0B00007F) also listens inside the container on any user-defined network, including every Compose
# project, and is usually listed first, so it is skipped.
COPY --chmod=755 <<'EOF' /usr/local/bin/tokenring-healthcheck
#!/bin/bash
hex=$(awk 'NR > 1 && $4 == "0A" && $2 !~ /^0B00007F:/ { split($2, a, ":"); print a[2]; exit }' /proc/net/tcp /proc/net/tcp6)
[ -n "$hex" ] || exit 1
exec 3<>/dev/tcp/127.0.0.1/$((16#$hex))
EOF
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["/usr/local/bin/tokenring-healthcheck"]
ENTRYPOINT ["/usr/local/lib/tokenring-one/tokenring-one", "--listen", "0.0.0.0", "--workingDirectory", "/repo"]
CMD ["--port", "14008"]

FROM server AS server-headless-browser
ARG TARGETARCH
USER root
# Chromium + font/icon deps let the browser plugin drive a headless Chrome
# (webDesign browser.chrome defaults) for design_screenshot captures.
# `chromium` on the PATH is a wrapper that adds --no-sandbox: Chromium's own sandbox needs user namespaces, which
# Docker's default security profile blocks, so without the flag it refuses to start at all. The container itself
# (an unprivileged user, no extra capabilities) is the isolation boundary here.
RUN <<EOF
set -e
apt-get update
apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji
printf '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox "$@"\n' > /usr/local/bin/chromium
chmod 755 /usr/local/bin/chromium
rm -rf /var/lib/apt/lists/*
EOF
USER tokenring

FROM server-headless-browser AS full
ARG TARGETARCH
USER root
COPY dist/tokenring-cli-linux-${TARGETARCH} /usr/local/bin/tokenring
RUN chmod 755 /usr/local/bin/tokenring
USER tokenring
ENV TOKENRING_ONE_BINARY=/usr/local/lib/tokenring-one/tokenring-one
ENTRYPOINT ["/usr/local/bin/tokenring"]
CMD []
