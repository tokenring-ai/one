# vim:set ft=docker/dockerfile:1.8
# syntax=docker/dockerfile:1.8

FROM debian:trixie-slim AS runtime

LABEL org.opencontainers.image.source="https://github.com/tokenring-ai/one"

RUN <<EOF
set -e
apt-get update
apt-get install -y --no-install-recommends ca-certificates
rm -rf /var/lib/apt/lists/*
EOF

WORKDIR /repo

FROM runtime AS cli
ARG TARGETARCH
COPY dist/tokenring-cli-linux-${TARGETARCH} /usr/local/bin/tokenring
RUN chmod 755 /usr/local/bin/tokenring
ENTRYPOINT ["/usr/local/bin/tokenring"]

FROM runtime AS server
ARG TARGETARCH
RUN <<EOF
set -e
apt-get update
apt-get install -y --no-install-recommends git python3
rm -rf /var/lib/apt/lists/*
EOF
COPY dist/tokenring-one-linux-${TARGETARCH} /usr/local/lib/tokenring-one/tokenring-one
RUN chmod 755 /usr/local/lib/tokenring-one/tokenring-one
EXPOSE 80
ENTRYPOINT ["/usr/local/lib/tokenring-one/tokenring-one"]
CMD ["--listen", "0.0.0.0", "--port", "80", "--workingDirectory", "/repo"]

FROM server AS full
ARG TARGETARCH
COPY dist/tokenring-cli-linux-${TARGETARCH} /usr/local/bin/tokenring
RUN chmod 755 /usr/local/bin/tokenring
ENV TOKENRING_ONE_BINARY=/usr/local/lib/tokenring-one/tokenring-one
ENTRYPOINT ["/usr/local/bin/tokenring"]
CMD []
