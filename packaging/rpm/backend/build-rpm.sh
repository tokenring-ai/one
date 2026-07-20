#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: build-rpm.sh --version VERSION --arch ARCH --binary PATH --outdir PATH" >&2
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
case "$ARCH" in x86_64|aarch64) ;; *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;; esac
[[ -f "$BINARY" ]] || { echo "Binary not found: $BINARY" >&2; exit 1; }
command -v rpmbuild >/dev/null || { echo "rpmbuild is required" >&2; exit 1; }

RPM_VERSION="${VERSION//-/\~}"
PKG_NAME="tokenring-one-backend"
TOPDIR="$(mktemp -d)"
trap 'rm -rf "$TOPDIR"' EXIT
mkdir -p "$TOPDIR"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
PAYLOAD="$TOPDIR/SOURCES/payload"
mkdir -p "$PAYLOAD/usr/bin" "$PAYLOAD/usr/lib/tokenring-ai/one/backend" "$PAYLOAD/usr/share/doc/$PKG_NAME"
install -m 755 "$BINARY" "$PAYLOAD/usr/lib/tokenring-ai/one/backend/tokenring-one"
cat > "$PAYLOAD/usr/bin/tokenring-one-server" <<'EOF'
#!/bin/sh
exec /usr/lib/tokenring-ai/one/backend/tokenring-one "$@"
EOF
chmod 755 "$PAYLOAD/usr/bin/tokenring-one-server"
echo "MIT License - Copyright TokenRing AI contributors" > "$PAYLOAD/usr/share/doc/$PKG_NAME/LICENSE"
CHANGELOG_DATE="$(date -u '+%a %b %d %Y')"

cat > "$TOPDIR/SPECS/$PKG_NAME.spec" <<EOF
%global debug_package %{nil}
%global __os_install_post %{nil}
%global _build_id_links none
Name:           $PKG_NAME
Version:        $RPM_VERSION
Release:        1%{?dist}
Summary:        TokenRing One backend server
License:        MIT
URL:            https://github.com/tokenring-ai/one
BuildArch:      $ARCH
AutoReqProv:    no
Recommends:     git

%description
Native backend server for TokenRing One.

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}
cp -a %{_sourcedir}/payload/. %{buildroot}/

%files
%license /usr/share/doc/%{name}/LICENSE
/usr/bin/tokenring-one-server
/usr/lib/tokenring-ai/one/backend

%changelog
* $CHANGELOG_DATE TokenRing AI <support@tokenring.ai> - $RPM_VERSION-1
- Release $VERSION
EOF

rpmbuild -bb --define "_topdir $TOPDIR" --target "$ARCH-linux" "$TOPDIR/SPECS/$PKG_NAME.spec"
mkdir -p "$OUTDIR"
BUILT_RPM="$(find "$TOPDIR/RPMS" -type f -name "$PKG_NAME-*.rpm" | sort | head -n 1)"
[[ -n "$BUILT_RPM" ]] || { echo "rpmbuild did not produce an RPM" >&2; exit 1; }
RPM_OUT="$OUTDIR/${PKG_NAME}_${VERSION}_${ARCH}.rpm"
cp "$BUILT_RPM" "$RPM_OUT"
echo "Built $RPM_OUT"
