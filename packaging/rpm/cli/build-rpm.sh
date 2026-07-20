#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: build-rpm.sh --version VERSION --arch ARCH --binary PATH --outdir PATH

Build the TokenRing Rust CLI .rpm package for Linux.

  --version VERSION   Package version (no leading v)
  --arch ARCH         RPM architecture: x86_64 or aarch64
  --binary PATH       Path to the prebuilt tokenring CLI binary
  --outdir PATH       Directory to write the .rpm into
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
  x86_64|aarch64) ;;
  *)
    echo "Unsupported arch: $ARCH (expected x86_64 or aarch64)" >&2
    exit 1
    ;;
esac

if [[ ! -f "$BINARY" ]]; then
  echo "Binary not found: $BINARY" >&2
  exit 1
fi

if ! command -v rpmbuild >/dev/null 2>&1; then
  echo "rpmbuild is required to build .rpm packages" >&2
  exit 1
fi

RPM_VERSION="${VERSION//-/\~}"
PKG_NAME="tokenring-one-cli"
RELEASE="1"
TOPDIR="$(mktemp -d)"
trap 'rm -rf "$TOPDIR"' EXIT

mkdir -p "$TOPDIR"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}

PAYLOAD="$TOPDIR/SOURCES/payload"
mkdir -p "$PAYLOAD/usr/bin"
mkdir -p "$PAYLOAD/usr/share/doc/${PKG_NAME}"
install -m 755 "$BINARY" "$PAYLOAD/usr/bin/tokenring"

cat > "$PAYLOAD/usr/share/doc/${PKG_NAME}/LICENSE" <<'EOF'
MIT License

Copyright (c) TokenRing AI contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

CHANGELOG_DATE="$(date -u '+%a %b %d %Y')"

cat > "$TOPDIR/SPECS/${PKG_NAME}.spec" <<EOF
%global debug_package %{nil}
%global __os_install_post %{nil}
%global _build_id_links none

Name:           ${PKG_NAME}
Version:        ${RPM_VERSION}
Release:        ${RELEASE}%{?dist}
Summary:        TokenRing native terminal client
License:        MIT
URL:            https://github.com/tokenring-ai/one
BuildArch:      ${ARCH}
AutoReqProv:    no

%description
TokenRing CLI is the native terminal interface for TokenRing. Install the
tokenring-one meta-package to add the backend and web frontend.

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}
cp -a %{_sourcedir}/payload/. %{buildroot}/

%files
%license /usr/share/doc/%{name}/LICENSE
/usr/bin/tokenring

%changelog
* ${CHANGELOG_DATE} TokenRing AI <support@tokenring.ai> - ${RPM_VERSION}-${RELEASE}
- Release ${VERSION}
EOF

rpmbuild -bb \
  --define "_topdir ${TOPDIR}" \
  --target "${ARCH}-linux" \
  "$TOPDIR/SPECS/${PKG_NAME}.spec"

mkdir -p "$OUTDIR"
mapfile -t BUILT_RPMS < <(find "$TOPDIR/RPMS" -type f -name "${PKG_NAME}-*.rpm" | sort)
if [[ ${#BUILT_RPMS[@]} -eq 0 ]]; then
  echo "rpmbuild did not produce an RPM under ${TOPDIR}/RPMS" >&2
  find "$TOPDIR/RPMS" -type f >&2 || true
  exit 1
fi

RPM_OUT="${OUTDIR}/${PKG_NAME}_${VERSION}_${ARCH}.rpm"
cp "${BUILT_RPMS[0]}" "$RPM_OUT"
echo "Built $RPM_OUT"
