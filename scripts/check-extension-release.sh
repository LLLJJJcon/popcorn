#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

fail() {
  printf 'Release check failed: %s\n' "$*" >&2
  exit 1
}

# This is the only set of entries eligible for the public extension ZIP. The
# packaging script consumes this same list so checking and staging cannot drift.
public_allowlist=(
  "LICENSE"
  "UPSTREAM.md"
  "auth.js"
  "background.js"
  "content.js"
  "icons/icon128.png"
  "icons/icon16.png"
  "icons/icon48.png"
  "manifest.json"
  "options.css"
  "options.html"
  "options.js"
  "prompts/analysis.md"
  "prompts/explain.md"
  "prompts/note-cleanup.md"
  "prompts/translation.md"
  "runtime-config.js"
  "settings.js"
  "sidepanel.css"
  "sidepanel.html"
  "sidepanel.js"
  "sync-queue.js"
  "third_party/youtube-digest/LICENSE"
)

if [[ "${1:-}" == "--print-files" ]]; then
  if (($# != 1)); then
    fail "--print-files accepts no archive path"
  fi
  printf '%s\n' "${public_allowlist[@]}"
  exit 0
fi
if (($# != 1)); then
  printf 'Usage: %s <popcorn-extension.zip>\n' "$0" >&2
  exit 2
fi

for tool in node unzip zipinfo shasum diff; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool is required"
done

archive="$1"
[[ -f "$archive" && ! -L "$archive" ]] || fail "archive is missing or not a regular file: $archive"
archive_dir="$(cd "$(dirname "$archive")" && pwd)"
archive="$archive_dir/$(basename "$archive")"
checksum_file="${archive%.zip}.sha256"
[[ "$archive" == *.zip ]] || fail "archive path must end in .zip"
[[ -f "$checksum_file" && ! -L "$checksum_file" ]] || fail "recorded checksum is missing"

expected_checksum="$(awk -v name="$(basename "$archive")" '
  NF == 2 && $2 == name && $1 ~ /^[0-9a-f]{64}$/ { print $1 }
' "$checksum_file")"
[[ -n "$expected_checksum" ]] || fail "recorded checksum has an invalid format"
[[ "$(wc -l < "$checksum_file" | tr -d ' ')" == "1" ]] || fail "recorded checksum must contain exactly one entry"
actual_checksum="$(shasum -a 256 "$archive" | awk '{print $1}')"
[[ "$actual_checksum" == "$expected_checksum" ]] || fail "archive checksum does not match the recorded checksum"

temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/popcorn-extension-check.XXXXXX")"
cleanup() {
  if [[ -d "$temporary_dir" ]]; then
    rm -rf "$temporary_dir"
  fi
}
trap cleanup EXIT
expected_entries="$temporary_dir/expected"
actual_entries="$temporary_dir/actual"
printf '%s\n' "${public_allowlist[@]}" | LC_ALL=C sort > "$expected_entries"
unzip -Z1 "$archive" > "$actual_entries" || fail "archive directory cannot be read"

if grep -En '(^/|(^|/)\.\.(/|$)|\\|[[:cntrl:]]|/$)' "$actual_entries" >&2; then
  fail "archive contains an unsafe path"
fi
LC_ALL=C sort "$actual_entries" > "$actual_entries.sorted"
if [[ "$(wc -l < "$actual_entries" | tr -d ' ')" != "$(wc -l < "$actual_entries.sorted" | tr -d ' ')" ]]; then
  fail "archive entry list is invalid"
fi
if ! diff -u "$expected_entries" "$actual_entries.sorted" >&2; then
  fail "archive contains a missing or unexpected entry"
fi
if [[ "$(LC_ALL=C sort -u "$actual_entries" | wc -l | tr -d ' ')" != "$(wc -l < "$actual_entries" | tr -d ' ')" ]]; then
  fail "archive contains duplicate entries"
fi

extracted="$temporary_dir/archive"
mkdir -p "$extracted"
unzip -qq "$archive" -d "$extracted" || fail "archive cannot be inspected"
for file in "${public_allowlist[@]}"; do
  [[ -f "$extracted/$file" ]] || fail "required archive entry is missing: $file"
  [[ ! -L "$extracted/$file" ]] || fail "archive entry must not be a symbolic link: $file"
done
if find "$extracted" -type l -print | grep -q .; then
  fail "archive contains a symbolic link"
fi

node - "$extracted" "$repo_root/extension/manifest.json" "${public_allowlist[@]}" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = process.argv[2];
const sourceManifestPath = process.argv[3];
const releaseFiles = process.argv.slice(4);
const allowed = new Set(releaseFiles);
const fail = (message) => {
  console.error(`Release check failed: ${message}`);
  process.exit(1);
};
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

let manifest;
let sourceManifest;
try {
  manifest = JSON.parse(read("manifest.json"));
  sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));
} catch (error) {
  fail(`manifest.json is not valid JSON: ${error.message}`);
}
if (manifest.manifest_version !== 3) fail("manifest.json must declare Manifest V3");
if (manifest.minimum_chrome_version !== "116") fail("minimum Chrome version must remain 116");
if (manifest.key !== sourceManifest.key || typeof manifest.key !== "string" || !manifest.key) {
  fail("stable public manifest key changed");
}
for (const permission of ["sidePanel", "storage"]) {
  if (!manifest.permissions?.includes(permission)) fail(`manifest permission is missing: ${permission}`);
}
if (manifest.permissions?.includes("identity")) fail("retired identity permission is forbidden");
const expectedPermissions = sourceManifest.permissions.filter((permission) => permission !== "identity");
if (JSON.stringify(manifest.permissions) !== JSON.stringify(expectedPermissions)) {
  fail("manifest permissions differ from the generated extension");
}

const sandbox = {};
vm.createContext(sandbox);
try {
  vm.runInContext(read("runtime-config.js"), sandbox, { filename: "runtime-config.js" });
} catch (error) {
  fail(`runtime-config.js cannot be evaluated: ${error.message}`);
}
const runtime = sandbox.POPCORN_RUNTIME_CONFIG;
if (!runtime || typeof runtime.appUrl !== "string" || typeof runtime.supabaseUrl !== "string") {
  fail("runtime-config.js does not contain generated origins");
}
const expectedHosts = [
  "https://www.youtube.com/*",
  `${runtime.appUrl}/*`,
  `${runtime.supabaseUrl}/*`,
];
if (JSON.stringify(manifest.host_permissions) !== JSON.stringify(expectedHosts)) {
  fail("manifest host_permissions must contain exactly YouTube, App, and Supabase origins");
}
const allowedRuntimeOrigins = new Set([
  new URL(runtime.appUrl).origin,
  new URL(runtime.supabaseUrl).origin,
  "https://www.youtube.com",
  "https://i.ytimg.com",
]);

const referenced = new Set();
const add = (value, base = "") => {
  if (typeof value !== "string" || !value || value.startsWith("#") || value.startsWith("//") || /^[a-z]+:/i.test(value)) return;
  referenced.add(path.posix.normalize(path.posix.join(base, value.replaceAll("\\", "/"))));
};
const addIcons = (icons) => {
  if (icons && typeof icons === "object") Object.values(icons).forEach((value) => add(value));
};
add(manifest.background?.service_worker);
add(manifest.side_panel?.default_path);
add(manifest.options_page);
add(manifest.options_ui?.page);
add(manifest.action?.default_popup);
addIcons(manifest.icons);
addIcons(manifest.action?.default_icon);
for (const script of manifest.content_scripts || []) {
  (script.js || []).forEach((file) => add(file));
  (script.css || []).forEach((file) => add(file));
}
for (const file of releaseFiles) {
  if (file.endsWith(".js")) {
    const source = read(file);
    for (const call of source.matchAll(/\bimportScripts\s*\(([^)]*)\)/g)) {
      for (const item of call[1].matchAll(/["']([^"']+)["']/g)) add(item[1], path.posix.dirname(file));
    }
  }
  if (file.endsWith(".html")) {
    for (const match of read(file).matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      add(match[1], path.posix.dirname(file));
    }
  }
}
for (const file of referenced) {
  if (file === ".." || file.startsWith("../") || path.posix.isAbsolute(file)) fail(`runtime references an unsafe path: ${file}`);
  if (!allowed.has(file)) fail(`runtime references a file outside the public allowlist: ${file}`);
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) fail(`runtime references a missing file: ${file}`);
}

const runtimeUrlPattern = /\bhttps?:\/\/[^\s"'`<>\\]+/g;
for (const file of releaseFiles) {
  if (!file.endsWith(".js")) continue;
  for (const match of read(file).matchAll(runtimeUrlPattern)) {
    let origin;
    try {
      origin = new URL(match[0]).origin;
    } catch {
      fail(`malformed runtime URL found in archive entry: ${file}`);
    }
    if (!allowedRuntimeOrigins.has(origin)) {
      fail(`direct Provider endpoint or disallowed runtime URL found in archive entry: ${file}`);
    }
  }
}

const credentialPatterns = [
  ["private key block", /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g],
  ["OpenAI-style credential", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ["Supadata-style credential", /\bsd_[A-Za-z0-9_-]{16,}\b/g],
  ["GitHub credential", /\b(?:gh[opsur]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g],
  ["Google API credential", /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ["private credential assignment", /\b(?:api[_-]?key|secret|(?:access|auth|refresh)[_-]?token|password|cookie)\b["']?\s*[:=]\s*["'][^"'\s]{8,}["']/gi],
  ["private credential assignment", /\b(?:SUPABASE_SERVICE_ROLE_KEY|INTERNAL_JOB_SECRET|SUPADATA_API_KEY|MODEL_GATEWAY_API_KEY|OPENAI_API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|PASSWORD|COOKIE)\b\s*[:=]\s*["'][^"'\s]{8,}["']/gi],
  ["source-machine path", /(?:\/Users\/[^\s"']+|\/home\/[^\s"']+|[A-Za-z]:\\Users\\[^\s"']+)/g],
  ["GPL implementation material", /(?:GNU GENERAL PUBLIC LICENSE|nashsu\/llm_wiki)/gi],
];
for (const file of releaseFiles) {
  if (!/\.(?:js|json|html|css|md|txt)$/i.test(file) && file !== "LICENSE") continue;
  const source = read(file);
  for (const [label, pattern] of credentialPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) fail(`${label} found in archive entry: ${file}`);
  }
}
NODE

javascript_files=()
for file in "${public_allowlist[@]}"; do
  [[ "$file" == *.js ]] && javascript_files+=("$extracted/$file")
done
for file in "${javascript_files[@]}"; do
  node --check "$file" >/dev/null
done

printf 'Release checks passed (%s allowlisted files; SHA-256 %s).\n' "${#public_allowlist[@]}" "$actual_checksum"
