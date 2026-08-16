#!/usr/bin/env bash
set -euo pipefail

readonly UPSTREAM_URL="https://github.com/zarazhangrui/youtube-digest.git"
readonly UPSTREAM_COMMIT="d03e1f61e017b032159ffd1821cac6e7693ce0c7"
readonly TASK_TMP_DIR="$(mktemp -d /tmp/popcorn-youtube-digest.XXXXXX)"
trap 'rm -rf "$TASK_TMP_DIR"' EXIT

git clone --quiet "$UPSTREAM_URL" "$TASK_TMP_DIR/repo"
git -C "$TASK_TMP_DIR/repo" checkout --quiet "$UPSTREAM_COMMIT"
test "$(git -C "$TASK_TMP_DIR/repo" rev-parse HEAD)" = "$UPSTREAM_COMMIT"

mkdir -p extension/icons extension/prompts extension/tests third_party/youtube-digest
for file in manifest.json background.js content.js settings.js sidepanel.html sidepanel.css sidepanel.js options.html options.css options.js; do
  install -m 0644 "$TASK_TMP_DIR/repo/$file" "extension/$file"
done
for file in analysis.md explain.md note-cleanup.md translation.md; do
  install -m 0644 "$TASK_TMP_DIR/repo/prompts/$file" "extension/prompts/$file"
done
for file in digest-button.test.js options-language.test.js release.test.js settings.test.js transcript-selection.test.js translation.test.js; do
  install -m 0644 "$TASK_TMP_DIR/repo/tests/$file" "extension/tests/$file"
done
for file in icon16.png icon48.png icon128.png; do
  install -m 0644 "$TASK_TMP_DIR/repo/icons/$file" "extension/icons/$file"
done
install -m 0644 "$TASK_TMP_DIR/repo/LICENSE" third_party/youtube-digest/LICENSE
