#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: build-deb.sh --version VERSION --arch ARCH --binary PATH --outdir PATH" >&2
  exit 1
}

VERSION=""; ARCH=""; BINARY=""; OUTDIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --arch) ARCH="${2:-}"; shift 2 ;;
    --binary) BINARY="${2:-}"; shift 2 ;;
    --outdir) OUTDIR="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -n "$VERSION" && -n "$ARCH" && -n "$BINARY" && -n "$OUTDIR" ]] || usage
case "$ARCH" in amd64|arm64) ;; *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;; esac
[[ -f "$BINARY" ]] || { echo "Binary not found: $BINARY" >&2; exit 1; }
command -v dpkg-deb >/dev/null || { echo "dpkg-deb is required" >&2; exit 1; }

PKG_NAME="tokenring-one-backend"
PKG_ROOT="$(mktemp -d)"
trap 'rm -rf "$PKG_ROOT"' EXIT
LIB_DIR="$PKG_ROOT/usr/lib/tokenring-ai/one/backend"
mkdir -p "$PKG_ROOT/DEBIAN" "$PKG_ROOT/usr/bin" "$LIB_DIR" "$PKG_ROOT/usr/share/doc/$PKG_NAME"
install -m 755 "$BINARY" "$LIB_DIR/tokenring-one"

cat > "$PKG_ROOT/usr/bin/tokenring-one-server" <<'EOF'
#!/bin/sh
exec /usr/lib/tokenring-ai/one/backend/tokenring-one "$@"
EOF
chmod 755 "$PKG_ROOT/usr/bin/tokenring-one-server"

cat > "$PKG_ROOT/usr/share/doc/$PKG_NAME/copyright" <<'EOF'
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: tokenring-one-backend
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
Recommends: git
Homepage: https://github.com/tokenring-ai/one
Description: TokenRing One backend server
 Native backend server for TokenRing One.
EOF

mkdir -p "$OUTDIR"
DEB_PATH="$OUTDIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build --root-owner-group "$PKG_ROOT" "$DEB_PATH"
echo "Built $DEB_PATH"
