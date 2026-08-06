#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: build-deb.sh --version VERSION --arch ARCH --binary PATH --outdir PATH

Build the TokenRing Rust CLI .deb package for Linux.

  --version VERSION   Package version (no leading v)
  --arch ARCH         Debian architecture: amd64 or arm64
  --binary PATH       Path to the prebuilt tokenring CLI binary
  --outdir PATH       Directory to write the .deb into
EOF
  exit 1
}

VERSION=""
ARCH=""
BINARY=""
OUTDIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --arch) ARCH="${2:-}"; shift 2 ;;
    --binary) BINARY="${2:-}"; shift 2 ;;
    --outdir) OUTDIR="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

if [[ -z "$VERSION" || -z "$ARCH" || -z "$BINARY" || -z "$OUTDIR" ]]; then
  echo "Missing required arguments" >&2
  usage
fi

case "$ARCH" in
  amd64|arm64) ;;
  *)
    echo "Unsupported arch: $ARCH (expected amd64 or arm64)" >&2
    exit 1
    ;;
esac

if [[ ! -f "$BINARY" ]]; then
  echo "Binary not found: $BINARY" >&2
  exit 1
fi

if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "dpkg-deb is required to build .deb packages" >&2
  exit 1
fi

PKG_NAME="tokenring-one-cli"
PKG_ROOT="$(mktemp -d)"
trap 'rm -rf "$PKG_ROOT"' EXIT

BIN_DIR="$PKG_ROOT/usr/bin"
DOC_DIR="$PKG_ROOT/usr/share/doc/$PKG_NAME"
DEBIAN_DIR="$PKG_ROOT/DEBIAN"
mkdir -p "$BIN_DIR" "$DOC_DIR" "$DEBIAN_DIR"

install -m 755 "$BINARY" "$BIN_DIR/tokenring"

cat > "$DOC_DIR/copyright" <<'EOF'
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: tokenring-cli
Source: https://github.com/tokenring-ai/one

Files: *
Copyright: TokenRing AI contributors
License: MIT
EOF

cat > "$DOC_DIR/changelog" <<EOF
$PKG_NAME ($VERSION) unstable; urgency=medium

  * Release $VERSION

 -- TokenRing AI <support@tokenring.ai>  $(date -u '+%a, %d %b %Y %H:%M:%S +0000')
EOF
gzip -9n "$DOC_DIR/changelog"

INSTALLED_SIZE="$(du -sk "$PKG_ROOT" | cut -f1)"

cat > "$DEBIAN_DIR/control" <<EOF
Package: $PKG_NAME
Version: $VERSION
Section: devel
Priority: optional
Architecture: $ARCH
Maintainer: TokenRing AI <support@tokenring.ai>
Installed-Size: $INSTALLED_SIZE
Homepage: https://github.com/tokenring-ai/one
Description: TokenRing native terminal client
 TokenRing CLI is the native terminal interface for TokenRing. Install the
 tokenring-one meta-package to add the backend (with bundled web UI).
EOF

mkdir -p "$OUTDIR"
DEB_PATH="$OUTDIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --build --root-owner-group "$PKG_ROOT" "$DEB_PATH"
echo "Built $DEB_PATH"
