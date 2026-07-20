#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: build-deb.sh --version VERSION --frontend PATH --outdir PATH" >&2
  exit 1
}

VERSION=""; FRONTEND=""; OUTDIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --frontend) FRONTEND="${2:-}"; shift 2 ;;
    --outdir) OUTDIR="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -n "$VERSION" && -n "$FRONTEND" && -n "$OUTDIR" ]] || usage
[[ -d "$FRONTEND" ]] || { echo "Frontend not found: $FRONTEND" >&2; exit 1; }
command -v dpkg-deb >/dev/null || { echo "dpkg-deb is required" >&2; exit 1; }

PKG_NAME="tokenring-one-frontend"
PKG_ROOT="$(mktemp -d)"
trap 'rm -rf "$PKG_ROOT"' EXIT
FRONTEND_DIR="$PKG_ROOT/usr/lib/tokenring-ai/one/frontend"
mkdir -p "$PKG_ROOT/DEBIAN" "$FRONTEND_DIR" "$PKG_ROOT/usr/share/doc/$PKG_NAME"
cp -a "$FRONTEND"/. "$FRONTEND_DIR/"

cat > "$PKG_ROOT/usr/share/doc/$PKG_NAME/copyright" <<'EOF'
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: tokenring-one-frontend
Source: https://github.com/tokenring-ai/one
Files: *
Copyright: TokenRing AI contributors
License: MIT
EOF

INSTALLED_SIZE="$(du -sk "$PKG_ROOT" | cut -f1)"
cat > "$PKG_ROOT/DEBIAN/control" <<EOF
Package: $PKG_NAME
Version: $VERSION
Section: web
Priority: optional
Architecture: all
Maintainer: TokenRing AI <support@tokenring.ai>
Installed-Size: $INSTALLED_SIZE
Homepage: https://github.com/tokenring-ai/one
Description: TokenRing One web frontend
 Prebuilt web frontend assets for TokenRing One.
EOF

mkdir -p "$OUTDIR"
DEB_PATH="$OUTDIR/${PKG_NAME}_${VERSION}_all.deb"
dpkg-deb --build --root-owner-group "$PKG_ROOT" "$DEB_PATH"
echo "Built $DEB_PATH"
