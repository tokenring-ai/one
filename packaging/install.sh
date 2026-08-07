#!/usr/bin/env bash
# TokenRing One installer
#
# Usage:
#   curl -fsSL https://tokenring.ai/one.sh | bash
#   curl -fsSL https://github.com/tokenring-ai/one/releases/latest/download/install.sh | bash
#
# Each published install.sh pins an explicit VERSION_PIN so installs from that
# script are deterministic. Bumpversion updates VERSION_PIN on release.
#
# Override the pin (for testing) with TOKENRING_INSTALL_VERSION=x.y.z
#
# Install strategy:
#   1. If bun or npm is available, install @tokenring-ai/one@VERSION globally.
#   2. Otherwise on macOS/Linux, download CLI and backend assets for the same
#      VERSION from GitHub Releases and install them under ~/.local.

set -euo pipefail

# Pinned release version (managed by bumpversion)
VERSION_PIN="0.2.56"

REPO="${TOKENRING_INSTALL_REPO:-tokenring-ai/one}"
VERSION="${TOKENRING_INSTALL_VERSION:-$VERSION_PIN}"
RELEASE_TAG="v${VERSION}"
RELEASE_BASE="${TOKENRING_RELEASE_BASE:-https://github.com/${REPO}/releases/download/${RELEASE_TAG}}"
NPM_PACKAGE="${TOKENRING_NPM_PACKAGE:-@tokenring-ai/one}"
NPM_SPEC="${NPM_PACKAGE}@${VERSION}"

BIN_DIR="${TOKENRING_BIN_DIR:-${HOME}/.local/bin}"
LIB_DIR="${TOKENRING_LIB_DIR:-${HOME}/.local/lib/tokenring-ai/one}"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

info() { printf '%s==>%s %s\n' "${GREEN}" "${RESET}" "$*"; }
warn() { printf '%sWarning:%s %s\n' "${YELLOW}" "${RESET}" "$*"; }
error() { printf '%sError:%s %s\n' "${RED}" "${RESET}" "$*" >&2; }
die() { error "$*"; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

download() {
  local url="$1"
  local dest="$2"

  if command -v curl >/dev/null 2>&1; then
    if ! curl -fsSL --retry 3 --retry-delay 1 -o "$dest" "$url"; then
      die "Failed to download: $url"
    fi
  elif command -v wget >/dev/null 2>&1; then
    if ! wget -q -O "$dest" "$url"; then
      die "Failed to download: $url"
    fi
  else
    die "Neither curl nor wget is available"
  fi
}

# Global so the EXIT trap can always see it (locals are out of scope on EXIT).
INSTALL_TMP=""

cleanup_install_tmp() {
  if [[ -n "${INSTALL_TMP}" && -d "${INSTALL_TMP}" ]]; then
    rm -rf "${INSTALL_TMP}"
  fi
  INSTALL_TMP=""
}

detect_platform() {
  local os arch

  case "$(uname -s)" in
    Darwin) os="macos" ;;
    Linux) os="linux" ;;
    *) die "Unsupported operating system: $(uname -s). Install with bun or npm, or use Docker." ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) die "Unsupported architecture: $(uname -m)" ;;
  esac

  printf '%s-%s\n' "$os" "$arch"
}

path_contains() {
  case ":${PATH}:" in
    *":$1:"*) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_bin_dir_on_path() {
  if path_contains "$BIN_DIR"; then
    return 0
  fi

  warn "${BIN_DIR} is not on your PATH."
  cat <<EOF

Add it to your shell profile, for example:

  # bash
  echo 'export PATH="${BIN_DIR}:\$PATH"' >> ~/.bashrc

  # zsh
  echo 'export PATH="${BIN_DIR}:\$PATH"' >> ~/.zshrc

  # fish
  fish_add_path ${BIN_DIR}

Then open a new terminal (or re-source your profile).
EOF
}

install_via_package_manager() {
  if command -v bun >/dev/null 2>&1; then
    info "Installing ${NPM_SPEC} globally with bun"
    bun install -g "$NPM_SPEC"
    return 0
  fi

  if command -v npm >/dev/null 2>&1; then
    info "Installing ${NPM_SPEC} globally with npm"
    npm install -g "$NPM_SPEC"
    return 0
  fi

  return 1
}

write_wrapper() {
  local path="$1"
  local body="$2"

  printf '%s\n' "$body" >"$path"
  chmod 755 "$path"
}

install_from_release() {
  local platform
  platform="$(detect_platform)"

  local cli_url="${RELEASE_BASE}/tokenring-cli-${platform}"
  local backend_url="${RELEASE_BASE}/tokenring-one-${platform}"

  INSTALL_TMP="$(mktemp -d "${TMPDIR:-/tmp}/tokenring-one-install.XXXXXX")"
  trap cleanup_install_tmp EXIT

  info "Detected platform: ${platform}"
  info "Downloading CLI and backend for ${RELEASE_TAG}"

  download "$cli_url" "${INSTALL_TMP}/one"
  download "$backend_url" "${INSTALL_TMP}/tokenring-one"

  chmod 755 "${INSTALL_TMP}/one" "${INSTALL_TMP}/tokenring-one"

  info "Installing to ${BIN_DIR} and ${LIB_DIR}"
  mkdir -p "$BIN_DIR" "$LIB_DIR"

  install -m 755 "${INSTALL_TMP}/one" "${LIB_DIR}/one"
  install -m 755 "${INSTALL_TMP}/tokenring-one" "${LIB_DIR}/tokenring-one"

  write_wrapper "${BIN_DIR}/one" "#!/bin/sh
# TokenRing One CLI launcher (installed by install.sh)
export TOKENRING_ONE_BINARY=\"\${TOKENRING_ONE_BINARY:-${LIB_DIR}/tokenring-one}\"
exec \"${LIB_DIR}/one\" \"\$@\"
"

  write_wrapper "${BIN_DIR}/tokenring-one" "#!/bin/sh
# TokenRing One backend launcher (installed by install.sh)
exec \"${LIB_DIR}/tokenring-one\" \"\$@\"
"

  cleanup_install_tmp
  trap - EXIT

  ensure_bin_dir_on_path

  info "Installed CLI wrapper: ${BIN_DIR}/one"
  info "Installed backend wrapper: ${BIN_DIR}/tokenring-one"
}

print_success() {
  local command_name="$1"

  cat <<EOF

${GREEN}${BOLD}TokenRing One ${VERSION} is installed.${RESET}

Run it with:

  ${BOLD}${command_name}${RESET}

Optional: set an AI provider key first, for example:

  export OPENAI_API_KEY=sk-...
  export ANTHROPIC_API_KEY=sk-ant-...
  export XAI_API_KEY=...

Docs: https://github.com/${REPO}#readme
EOF
}

main() {
  info "Installing TokenRing One ${VERSION}"

  if install_via_package_manager; then
    print_success "tokenring-one"
    return 0
  fi

  case "$(uname -s)" in
    Darwin|Linux)
      install_from_release
      print_success "one"
      ;;
    *)
      die "No bun/npm found and binary installs are only supported on macOS and Linux."
      ;;
  esac
}

main "$@"
