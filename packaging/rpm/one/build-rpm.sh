#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: build-rpm.sh --version VERSION --arch ARCH --outdir PATH" >&2
  exit 1
}

VERSION=""; ARCH=""; OUTDIR=""
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
case "$ARCH" in x86_64|aarch64) ;; *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;; esac
command -v rpmbuild >/dev/null || { echo "rpmbuild is required" >&2; exit 1; }

RPM_VERSION="${VERSION//-/\~}"
PKG_NAME="tokenring-one"
TOPDIR="$(mktemp -d)"
trap 'rm -rf "$TOPDIR"' EXIT
mkdir -p "$TOPDIR"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
PAYLOAD="$TOPDIR/SOURCES/payload"
mkdir -p "$PAYLOAD/usr/bin" "$PAYLOAD/usr/share/doc/$PKG_NAME"

cat > "$PAYLOAD/usr/bin/tokenring-one" <<'EOF'
#!/bin/sh
export TOKENRING_ONE_BINARY="${TOKENRING_ONE_BINARY:-/usr/lib/tokenring-ai/one/backend/tokenring-one}"
exec /usr/bin/tokenring "$@"
EOF
chmod 755 "$PAYLOAD/usr/bin/tokenring-one"
echo "MIT License - Copyright TokenRing AI contributors" > "$PAYLOAD/usr/share/doc/$PKG_NAME/LICENSE"
CHANGELOG_DATE="$(date -u '+%a %b %d %Y')"

cat > "$TOPDIR/SPECS/$PKG_NAME.spec" <<EOF
%global debug_package %{nil}
%global __os_install_post %{nil}
Name:           $PKG_NAME
Version:        $RPM_VERSION
Release:        1%{?dist}
Summary:        Complete TokenRing One workspace
License:        MIT
URL:            https://github.com/tokenring-ai/one
BuildArch:      $ARCH
AutoReqProv:    no
Requires:       tokenring-one-cli = $RPM_VERSION-1
Requires:       tokenring-one-backend = $RPM_VERSION-1

%description
Installs the TokenRing One terminal client and backend (with bundled web UI).

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}
cp -a %{_sourcedir}/payload/. %{buildroot}/

%files
%license /usr/share/doc/%{name}/LICENSE
/usr/bin/tokenring-one

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
