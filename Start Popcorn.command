#!/bin/bash
set -euo pipefail

repository_root="$(cd "$(dirname "$0")" && pwd)"
cd "$repository_root"
exec pnpm popcorn:start
