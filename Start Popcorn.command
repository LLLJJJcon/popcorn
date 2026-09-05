#!/bin/bash
set -euo pipefail

script_source="${BASH_SOURCE[0]}"
case "$script_source" in
  */*) script_directory="${script_source%/*}" ;;
  *) script_directory="." ;;
esac
repository_root="$(cd "$script_directory" && pwd)"
cd "$repository_root"

resolve_launcher() {
  local candidate prefix
  local launcher_prefixes="${POPCORN_LAUNCHER_PREFIXES:-/usr/local/bin:/opt/homebrew/bin}"

  if command -v pnpm >/dev/null 2>&1; then
    printf '%s\n' pnpm
    return 0
  fi

  IFS=: read -r -a prefixes <<< "$launcher_prefixes"
  for prefix in "${prefixes[@]}"; do
    candidate="$prefix/pnpm"
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  if command -v corepack >/dev/null 2>&1; then
    printf '%s\n' corepack
    return 0
  fi

  for prefix in "${prefixes[@]}"; do
    candidate="$prefix/corepack"
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

launcher="$(resolve_launcher)" || {
  printf '%s\n' "Popcorn needs pnpm or Corepack. Install pnpm or enable Corepack, then try again." >&2
  exit 1
}

case "$launcher" in
  */*)
    PATH="${launcher%/*}:$PATH"
    export PATH
    ;;
esac

case "$launcher" in
  *corepack) exec "$launcher" pnpm popcorn:start ;;
  *) exec "$launcher" popcorn:start ;;
esac
