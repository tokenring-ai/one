#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: build-deb.sh --version VERSION --arch ARCH --outdir PATH" >&2
  exit 1
}

VERSION=""
ARCH=""
OUTDIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --arch) ARCH="${2:-}"; shift 2 ;;
    --outdir) OUTDIR="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -n "$VERSION" && -n "$ARCH" && -n "$OUTDIR" ]] || usage
case "$ARCH" in amd64|arm64) ;; *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;; esac
command -v dpkg-deb >/dev/null || { echo "dpkg-deb is required" >&2; exit 1; }

PKG_NAME="tokenring-one"
PKG_ROOT="$(mktemp -d)"
trap 'rm -rf "$PKG_ROOT"' EXIT
mkdir -p "$PKG_ROOT/DEBIAN" "$PKG_ROOT/usr/bin" "$PKG_ROOT/usr/share/doc/$PKG_NAME"

cat > "$PKG_ROOT/usr/bin/tokenring-one" <<'EOF'
#!/bin/sh
export TOKENRING_ONE_BINARY="${TOKENRING_ONE_BINARY:-/usr/lib/tokenring-ai/one/backend/tokenring-one}"
export FRONTEND_DIRECTORY="${FRONTEND_DIRECTORY:-/usr/lib/tokenring-ai/one/frontend}"
exec /usr/bin/tokenring "$@"
EOF
chmod 755 "$PKG_ROOT/usr/bin/tokenring-one"

cat > "$PKG_ROOT/usr/share/doc/$PKG_NAME/copyright" <<'EOF'
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: tokenring-one
Source: https://github.com/tokenring-ai/one
Files: *
Copyright: TokenRing AI contributors
License: MIT
EOF

INSTALLED_SIZE="$(du -sk "$PKG_ROOT" | cut -f1)"
cat > "$PKG_ROOT/DEBIAN/control" <<EOF
Package: $PKG_NAME
Version: $VERSION
Section: devel
Priority: optional
Architecture: $ARCH
Maintainer: TokenRing AI <support@tokenring.ai>
Installed-Size: $INSTALLED_SIZE
Depends: tokenring-one-cli (= $VERSION), tokenring-one-backend (= $VERSION), tokenring-one-frontend (= $VERSION)
Homepage: https://github.com/tokenring-ai/one
Description: Complete TokenRing One workspace
 Installs the TokenRing One terminal client, backend, and web frontend. The
 tokenring-one command starts the terminal client with the local server wired in.
EOF

mkdir -p "$OUTDIR"
DEB_PATH="$OUTDIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build --root-owner-group "$PKG_ROOT" "$DEB_PATH"
echo "Built $DEB_PATH"
