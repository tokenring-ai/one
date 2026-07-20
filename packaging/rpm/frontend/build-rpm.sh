#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: build-rpm.sh --version VERSION --frontend PATH --outdir PATH" >&2
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
command -v rpmbuild >/dev/null || { echo "rpmbuild is required" >&2; exit 1; }

RPM_VERSION="${VERSION//-/\~}"
PKG_NAME="tokenring-one-frontend"
TOPDIR="$(mktemp -d)"
trap 'rm -rf "$TOPDIR"' EXIT
mkdir -p "$TOPDIR"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS}
PAYLOAD="$TOPDIR/SOURCES/payload"
mkdir -p "$PAYLOAD/usr/lib/tokenring-ai/one/frontend/one" "$PAYLOAD/usr/share/doc/$PKG_NAME"
cp -a "$FRONTEND"/. "$PAYLOAD/usr/lib/tokenring-ai/one/frontend/one/"
echo "MIT License - Copyright TokenRing AI contributors" > "$PAYLOAD/usr/share/doc/$PKG_NAME/LICENSE"
CHANGELOG_DATE="$(date -u '+%a %b %d %Y')"

cat > "$TOPDIR/SPECS/$PKG_NAME.spec" <<EOF
%global debug_package %{nil}
%global __os_install_post %{nil}
Name:           $PKG_NAME
Version:        $RPM_VERSION
Release:        1%{?dist}
Summary:        TokenRing One web frontend
License:        MIT
URL:            https://github.com/tokenring-ai/one
BuildArch:      noarch
AutoReqProv:    no

%description
Prebuilt web frontend assets for TokenRing One.

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}
cp -a %{_sourcedir}/payload/. %{buildroot}/

%files
%license /usr/share/doc/%{name}/LICENSE
/usr/lib/tokenring-ai/one/frontend

%changelog
* $CHANGELOG_DATE TokenRing AI <support@tokenring.ai> - $RPM_VERSION-1
- Release $VERSION
EOF

rpmbuild -bb --define "_topdir $TOPDIR" "$TOPDIR/SPECS/$PKG_NAME.spec"
mkdir -p "$OUTDIR"
BUILT_RPM="$(find "$TOPDIR/RPMS" -type f -name "$PKG_NAME-*.rpm" | sort | head -n 1)"
[[ -n "$BUILT_RPM" ]] || { echo "rpmbuild did not produce an RPM" >&2; exit 1; }
RPM_OUT="$OUTDIR/${PKG_NAME}_${VERSION}_noarch.rpm"
cp "$BUILT_RPM" "$RPM_OUT"
echo "Built $RPM_OUT"
