# Foundation Task 1 Brief

## Controller assignment

- Canonical plan: `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`, Task 1.
- Canonical design: `docs/superpowers/specs/2026-08-16-popcorn-desktop-web-design.md`.
- Baseline commit: `abb4a271a7bbe9d04ad3ace12615e853b8c50e85`.
- Assigned branch: `codex/popcorn-foundation-1`.
- Assigned worktree: `/private/tmp/popcorn-foundation-1`.
- Handoff report: `docs/engineering/handoffs/foundation/task-1.md`.
- Required commit subject: `build: scaffold Popcorn and vendor YouTube Digest`.

## Ownership boundary

Allowed changes are limited to this brief, the required handoff, the task's declared files, the allowlisted vendored YouTube Digest targets, `third_party/youtube-digest/LICENSE`, and only the minimal generated Next.js/Tailwind/ESLint support files strictly required for the declared lint/typecheck/build gates. Record any such additional generated support file explicitly in the handoff.

Forbidden changes: all existing `docs/superpowers/**`; `docs/engineering/execution-ledger.md`; `supabase/**`; future `src/contracts/**`, `src/server/**`, and `src/types/**`; user report/demo artifacts; Git configuration; and any file not required by Foundation Task 1. Do not absorb files from the user's main checkout.

This is a controller-authorized one-task exception to the frozen root-config/lockfile boundary: this implementer may create the exact Task 1 root files and lockfile only. No later task may alter them without a new explicit brief.

## Interfaces and acceptance boundary

- Consumes: the approved product headline and the pinned upstream commit below.
- Produces: root scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:unit`, `test:contract`, `test:integration`, `test:provenance`, `test:e2e`, `verify`, `db:reset`, and `db:test`; a buildable Next.js baseline; a reproducible vendored `extension/`; and preserved MIT attribution.
- Expected RED: `pnpm vitest run src/app/page.test.tsx tests/provenance/youtube-digest.test.ts` must fail for the missing product heading and missing vendored source/license before production implementation. Capture the actual command, failure, and reason.
- Required GREEN and broader verification: run every command in Step 6 below with fresh output. Also run the complete available Task 1 unit/provenance suite before commit.
- Do not initialize Supabase, define shared contracts, add alternate input sources, add provider integrations, or implement later extension adaptation.

## Upstream and license contract

- Repository: `https://github.com/zarazhangrui/youtube-digest.git`.
- Immutable ref: `d03e1f61e017b032159ffd1821cac6e7693ce0c7` (verified by the controller as `main`/`HEAD`).
- Source paths/behaviors: `manifest.json`; `background.js`; `content.js`; `settings.js`; `sidepanel.html`; `sidepanel.css`; `sidepanel.js`; `options.html`; `options.css`; `options.js`; `prompts/{analysis,explain,note-cleanup,translation}.md`; listed tests; icons; and `LICENSE`.
- Reuse mode: copy the exact allowlist through `scripts/vendor-youtube-digest.sh`; do not regenerate parallel extension behavior.
- License: preserve the upstream MIT license and `Copyright (c) 2026 Zara Zhang` in `third_party/youtube-digest/LICENSE`, document the source-to-target map in `extension/UPSTREAM.md`, and point `THIRD_PARTY_NOTICES.md` to it.
- LLM Wiki: no source use applies to this task. Do not copy GPLv3 code, tests, prompts, components, assets, or naming-specific structure.

## TDD and handoff protocol

Follow `superpowers:test-driven-development`: write tests first, observe the expected failure, make the minimum implementation pass, then refactor only while green. The handoff must use the runbook's exact structure and include changed files, RED/GREEN output, all verification commands and exit results, upstream reuse evidence, contract-change requests, and unresolved risks. Commit the implementation and handoff together, then return only status, commit SHA, one-line test summary, concerns, and report path.

### Task 1: Scaffold the web baseline and reproducible upstream intake

**Files:**

- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/test/setup.ts`
- Create: `.env.example`
- Create: `scripts/vendor-youtube-digest.sh`
- Create: `extension/UPSTREAM.md`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `tests/provenance/youtube-digest.test.ts`
- Test: `src/app/page.test.tsx`

**Interfaces:**

- Consumes: pinned upstream Git commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- Produces: root scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:unit`, `test:contract`, `test:integration`, `test:provenance`, `test:e2e`, `verify`, `db:reset`, and `db:test`; vendored `extension/`; verified MIT attribution.

- [ ] **Step 1: Scaffold Next.js without overwriting documents**

Run from a temporary directory and copy only generated application/configuration files:

```bash
pnpm create next-app@latest popcorn-app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Expected: the temporary app builds; existing `docs/` and report artifacts remain untouched.

- [ ] **Step 2: Install the minimum foundation libraries**

```bash
pnpm add zod @supabase/ssr @supabase/supabase-js @tanstack/react-query openai
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test supabase
```

Expected: dependencies are locked in `pnpm-lock.yaml`; no vector, image-ingestion, or alternate-browser dependency is added.

- [ ] **Step 3: Write failing product and provenance tests**

Create `src/app/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

test("describes the YouTube-to-reuse loop", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", {
    name: "Turn Chinese videos into language you can use",
  })).toBeInTheDocument();
});
```

Create `tests/provenance/youtube-digest.test.ts`:

```ts
import { readFileSync } from "node:fs";

test("pins and attributes the YouTube Digest intake", () => {
  const upstream = readFileSync("extension/UPSTREAM.md", "utf8");
  const license = readFileSync("third_party/youtube-digest/LICENSE", "utf8");
  expect(upstream).toContain("d03e1f61e017b032159ffd1821cac6e7693ce0c7");
  expect(upstream).toContain("content.js");
  expect(upstream).toContain("sidepanel.js");
  expect(license).toContain("MIT License");
  expect(license).toContain("Copyright (c) 2026 Zara Zhang");
});
```

Run:

```bash
pnpm vitest run src/app/page.test.tsx tests/provenance/youtube-digest.test.ts
```

Expected: FAIL because the product heading and vendored source do not exist.

- [ ] **Step 4: Add the pinned vendor script**

Create `scripts/vendor-youtube-digest.sh` with this behavior and exact allowlist:

```bash
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
```

`extension/UPSTREAM.md` must list every copied path, the source commit, target path, reuse mode, expected Popcorn adaptation, and its owning future task. `THIRD_PARTY_NOTICES.md` must point to the preserved MIT license.

Run:

```bash
bash scripts/vendor-youtube-digest.sh
```

Expected: only allowlisted upstream files appear; `git rev-parse` verification prevents a floating intake.

- [ ] **Step 5: Implement the minimum page and shared test setup**

Set `src/app/page.tsx` to:

```tsx
export default function HomePage() {
  return <main><h1>Turn Chinese videos into language you can use</h1></main>;
}
```

Configure Vitest for jsdom, `@/`, and `src/test/setup.ts` importing `@testing-library/jest-dom/vitest`.

- [ ] **Step 6: Verify the foundation intake**

```bash
pnpm vitest run src/app/page.test.tsx tests/provenance/youtube-digest.test.ts
pnpm lint
pnpm typecheck
pnpm build
bash -n scripts/vendor-youtube-digest.sh
```

Expected: every command exits 0; `git diff -- extension/` shows upstream source rather than newly generated equivalents.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts vitest.config.ts playwright.config.ts src .env.example scripts/vendor-youtube-digest.sh extension third_party THIRD_PARTY_NOTICES.md tests/provenance
git commit -m "build: scaffold Popcorn and vendor YouTube Digest"
```
