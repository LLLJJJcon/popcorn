#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
checker="$script_dir/check-extension-release.sh"
dist_dir="$repo_root/dist"
unpacked_dir="$dist_dir/popcorn-extension"
archive="$dist_dir/popcorn-extension.zip"
checksum_file="$dist_dir/popcorn-extension.sha256"

command -v pnpm >/dev/null 2>&1 || {
  printf 'Packaging failed: pnpm is required\n' >&2
  exit 1
}
command -v zip >/dev/null 2>&1 || {
  printf 'Packaging failed: zip is required\n' >&2
  exit 1
}
command -v shasum >/dev/null 2>&1 || {
  printf 'Packaging failed: shasum is required\n' >&2
  exit 1
}

release_files=()
while IFS= read -r file; do
  [[ -n "$file" ]] && release_files+=("$file")
done < <("$checker" --print-files)
if ((${#release_files[@]} == 0)); then
  printf 'Packaging failed: release allowlist is empty\n' >&2
  exit 1
fi

cd "$repo_root"
# Run the existing package-script boundary without allowing pnpm to repair a
# caller's dependency tree as a side effect of packaging.
pnpm --config.verify-deps-before-run=false extension:local

version="$(node -e 'const m=require(process.argv[1]); process.stdout.write(m.version)' "$unpacked_dir/manifest.json")"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  printf 'Packaging failed: unsafe manifest version: %s\n' "$version" >&2
  exit 1
fi

mkdir -p "$dist_dir"
temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/popcorn-extension-package.XXXXXX")"
staging_dir="$temporary_dir/staging"
temporary_zip="$temporary_dir/popcorn-extension.zip"

cleanup() {
  if [[ -d "$temporary_dir" ]]; then
    rm -rf "$temporary_dir"
  fi
}
trap cleanup EXIT
mkdir -p "$staging_dir"

for file in "${release_files[@]}"; do
  case "$file" in
    LICENSE)
      source_file="$repo_root/LICENSE"
      ;;
    UPSTREAM.md)
      source_file="$repo_root/docs/operations/upstream-provenance.md"
      ;;
    third_party/youtube-digest/LICENSE)
      source_file="$repo_root/third_party/youtube-digest/LICENSE"
      ;;
    *)
      source_file="$unpacked_dir/$file"
      ;;
  esac
  if [[ ! -f "$source_file" || -L "$source_file" ]]; then
    printf 'Packaging failed: allowlisted source is missing or not a regular file: %s\n' "$file" >&2
    exit 1
  fi
  mkdir -p "$staging_dir/$(dirname "$file")"
  cp "$source_file" "$staging_dir/$file"
  # ZIP stores local timestamps. Normalizing every staged file makes repeated
  # builds byte-for-byte stable instead of inheriting copy time.
  touch -t 200001010000.00 "$staging_dir/$file"
done

(
  cd "$staging_dir"
  zip -X -q "$temporary_zip" "${release_files[@]}"
)

if unzip -Z1 "$temporary_zip" | grep -En '(^|/)(\.env[^/]*|\.DS_Store|\.git|tests?)(/|$)|\.map$' >&2; then
  printf 'Packaging failed: a forbidden private path entered the ZIP\n' >&2
  exit 1
fi

mv -f "$temporary_zip" "$archive"
checksum="$(shasum -a 256 "$archive" | awk '{print $1}')"
printf '%s  %s\n' "$checksum" "$(basename "$archive")" > "$checksum_file"
"$checker" "$archive"

printf 'Created %s\n' "$archive"
printf 'Checksum: %s\n' "$checksum_file"
printf 'SHA-256: %s\n' "$checksum"
