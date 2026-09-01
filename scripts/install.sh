#!/usr/bin/env bash
# Installs pg-migrate globally as a self-contained binary. No node, no npm,
# no registry token on the installing machine.
#
#   ./scripts/install.sh                 # install for this platform
#   ./scripts/install.sh --prefix ~/.local/bin
#   PG_MIGRATE_BASE_URL=... ./scripts/install.sh    # fetch instead of build
set -euo pipefail

PREFIX="${PG_MIGRATE_PREFIX:-/usr/local/bin}"
BASE_URL="${PG_MIGRATE_BASE_URL:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$(uname -s)" in
  Linux)  os=linux ;;
  Darwin) os=macos ;;
  *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x64 ;;
  arm64|aarch64) arch=arm64 ;;
  *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

asset="pg-migrate-${os}-${arch}"
staged="${REPO_ROOT}/build/${asset}"

if [ -n "$BASE_URL" ]; then
  staged="$(mktemp -d)/${asset}"
  echo "Downloading ${BASE_URL%/}/${asset}"
  curl -fsSL --proto '=https' --tlsv1.2 -o "$staged" "${BASE_URL%/}/${asset}"
  chmod +x "$staged"
elif [ ! -f "$staged" ]; then
  echo "No prebuilt ${asset} in build/ -- building from source."
  command -v npm >/dev/null 2>&1 || {
    echo "npm is required to build from source. Install node, or set PG_MIGRATE_BASE_URL." >&2
    exit 1
  }
  ( cd "$REPO_ROOT" && npm ci --no-audit --no-fund && npm run package -- "$asset" )
  [ -f "$staged" ] || { echo "build produced no ${asset}" >&2; exit 1; }
fi

# Verify against SHA256SUMS when one sits beside the binary.
sums="$(dirname "$staged")/SHA256SUMS"
if [ -f "$sums" ] && command -v shasum >/dev/null 2>&1; then
  expected="$(awk -v a="$asset" '$2==a {print $1}' "$sums")"
  if [ -n "$expected" ]; then
    actual="$(shasum -a 256 "$staged" | awk '{print $1}')"
    [ "$expected" = "$actual" ] || { echo "checksum mismatch for ${asset}" >&2; exit 1; }
    echo "Checksum OK"
  fi
fi

mkdir -p "$PREFIX"
target="${PREFIX}/pg-migrate"
if [ -w "$PREFIX" ]; then
  install -m 0755 "$staged" "$target"
else
  echo "${PREFIX} is not writable, using sudo"
  sudo install -m 0755 "$staged" "$target"
fi

echo "Installed ${asset} -> ${target}"
# The CLI exits 1 with a usage complaint when unconfigured; that it complains
# about DB_NAME rather than failing to start is the smoke test.
# Unconfigured, it exits 1 complaining about DB_NAME. Capture rather than
# pipe: pipefail would otherwise read that intentional exit 1 as a failure.
smoke="$("$target" 2>&1 || true)"
if printf '%s' "$smoke" | grep -q "DB_NAME"; then
  echo "Smoke test OK"
else
  echo "warning: unexpected output from ${target}: ${smoke}" >&2
fi
case ":${PATH}:" in
  *":${PREFIX}:"*) ;;
  *) echo "note: ${PREFIX} is not on your PATH" ;;
esac
