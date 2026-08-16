# Task Handoff
- Status: DONE
- Plan and task: `2026-08-16-popcorn-foundation-contracts.md`, Foundation Task 1
- Worktree and branch: `/private/tmp/popcorn-foundation-1`, `codex/popcorn-foundation-1`
- Baseline SHA: `abb4a271a7bbe9d04ad3ace12615e853b8c50e85`
- Commit SHA: recorded by the commit that includes this handoff

## Implemented
Scaffolded the minimal Next.js/Tailwind/ESLint baseline, package scripts, Vitest/Playwright configuration, and product heading. Added the reproducible YouTube Digest intake script and exact vendored allowlist with preserved MIT attribution.

## Upstream provenance used
Source: `https://github.com/zarazhangrui/youtube-digest.git`; immutable ref: `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; action: exact allowlisted reuse via `scripts/vendor-youtube-digest.sh`. The script clones, checks out, and verifies `HEAD`; `extension/UPSTREAM.md` maps every source to target. A fresh re-clone byte-compared all 24 copied files (including `LICENSE`) successfully.

## Interfaces consumed and produced
Consumed the approved product headline and pinned upstream commit. Produced all required root scripts, a buildable Next.js baseline, `extension/`, provenance tests, `third_party/youtube-digest/LICENSE`, and third-party notice.

## Files changed
Added Task 1 root/config support: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, TypeScript/Next/Vitest/Playwright/ESLint/PostCSS configs, `.gitignore`, `.env.example`, and `THIRD_PARTY_NOTICES.md`; app/test sources under `src/`; vendor script; provenance test; `extension/UPSTREAM.md`; the 23 allowlisted extension files; and `third_party/youtube-digest/LICENSE`. Added no later contracts, migrations, or Supabase initialization.

## TDD evidence
### RED
`pnpm vitest run src/app/page.test.tsx tests/provenance/youtube-digest.test.ts` exited 1 before vendor/page implementation: the page test could not find heading `Turn Chinese videos into language you can use`; provenance failed `ENOENT` for `extension/UPSTREAM.md`.

### GREEN
The same command exited 0 after the minimum heading and pinned intake implementation: 2 files passed, 2 tests passed.

## Broader verification
All exited 0 with fresh output: `pnpm lint`; `pnpm typecheck`; `pnpm build`; `bash -n scripts/vendor-youtube-digest.sh`; `pnpm test:unit` (1/1); `pnpm test:provenance` (1/1); `pnpm test`; `pnpm verify`; `pnpm test:e2e` (no suite, pass-with-no-tests); `git diff --check`; and a fresh pinned-clone byte comparison (`verified commit and 24 allowlisted files`).

## Contract or migration changes requested
None.

## Risks and follow-up
No unresolved implementation risks. The vendored source is intentionally excluded from application lint because it is exact upstream reuse; its mapped future adaptation owners are documented in `extension/UPSTREAM.md`. `pnpm-workspace.yaml` explicitly permits the required `unrs-resolver` postinstall so the locked test tooling runs reproducibly.

## Review fixes

### RED

`/private/tmp/popcorn-desktop-web/node_modules/.bin/vitest run tests/provenance/youtube-digest.test.ts --config /private/tmp/popcorn-provenance-vitest.config.mjs` exited 1 before the review fixes: 3 tests ran, with 2 failures. The environment assertion reported `expected [ 'node_modules/', '.next/', …(5) ] to include '.env*'`; the adaptation-map assertion reported that `extension/UPSTREAM.md` did not contain `This intake is non-shippable until adapted.`

### GREEN

`/private/tmp/popcorn-desktop-web/node_modules/.bin/vitest run tests/provenance/youtube-digest.test.ts --config /private/tmp/popcorn-provenance-vitest.config.mjs` exited 0 after the fixes: 1 file passed and 3 tests passed.

### Changed files

Updated `.gitignore` to ignore `.env*` while explicitly allowing `!.env.example`; updated `extension/UPSTREAM.md` to mark the intake non-shippable and assign provider-call, provider-key/direct-host, and export removals to the required Batch A tasks; extended `tests/provenance/youtube-digest.test.ts` with regression assertions; appended this handoff section.

### Risks

The worktree's pre-existing package-link layer could not resolve `@testing-library/jest-dom/vitest` for the normal Vitest config. After `pnpm fetch --frozen-lockfile --offline` recreated `node_modules` but reported a missing offline tarball, `pnpm install --frozen-lockfile` did not restore project-level package links or `.bin` entries. The focused test was therefore run with the read-only, already-installed Vitest binary from `/private/tmp/popcorn-desktop-web` and a temporary Node-only config; no tracked dependency or lockfile was changed. The required `pnpm test:provenance` command remains blocked locally by this environment issue and should be re-run from a hydrated install.

## Review fixes, round 2

### RED

`CI=true pnpm test:provenance` exited 1 before the provenance-map update: 1 test file failed, with 1 failed and 2 passed tests. The new assertion expected `Batch A Task 1 removes Supadata and DeepSeek direct Provider host permissions from \`extension/manifest.json\`, retaining only approved YouTube plus Popcorn API/auth hosts.` but `extension/UPSTREAM.md` did not yet contain that ownership record. The strengthened `.gitignore` regression checks ran through `git check-ignore` and passed against the current safe ordering: `.env` and `.env.local` were ignored while `.env.example` was not ignored.

### GREEN

`CI=true pnpm test:provenance` exited 0 after the minimal provenance-map update: 1 test file passed, 3 tests passed. `git diff --check` also exited 0.

### Changed files

Updated `tests/provenance/youtube-digest.test.ts` to assert effective Git ignore behavior with `git check-ignore` and to require the manifest-host ownership record. Updated `extension/UPSTREAM.md` to assign Batch A Task 1 the Supadata/DeepSeek manifest-host removal while retaining only approved YouTube and Popcorn API/auth hosts. Appended this review-fix evidence; `.gitignore` and all vendored extension bytes remain unchanged.

## Review fixes, round 3

### RED

Temporarily reversed the two `.gitignore` rules to `!.env.example` followed by `.env*` without committing that mutation. `CI=true pnpm test:provenance` exited 1: 1 test file failed, with 1 failed and 2 passed tests. The expected failure was `tests/provenance/youtube-digest.test.ts > keeps local environment files out of source control while allowing the template`, where `expect(isIgnored(".env.example")).toBe(false)` received `true`.

### GREEN

Restored the safe `.gitignore` order to `.env*` followed by `!.env.example`. `CI=true pnpm test:provenance` exited 0: 1 test file passed and 3 tests passed. The regression now invokes `git check-ignore --quiet --no-index`, so the tracked `.env.example` is evaluated against the actual ignore-rule order.

## Integration build fix

### Root cause

Under Next 16.3.1, `CI=true pnpm build` consistently failed while Turbopack processed `src/app/globals.css`: its PostCSS worker attempted `creating new process -> binding to a port` and received `Operation not permitted`. Retrying with sandbox escalation produced the same failure. With the identical source and dependencies, `CI=true pnpm exec next build --webpack` compiled, typechecked, and generated `/` and `/_not-found` successfully. The default Turbopack worker transport is therefore incompatible with this required execution environment.

### RED

Added the focused `uses webpack for the portable production build` provenance assertion, which reads `package.json`. Before the script change, `CI=true pnpm test:provenance` exited 1: the new assertion expected `next build --webpack` but received `next build` (3 other tests passed).

### GREEN

Changed only `package.json` so `build` is exactly `next build --webpack`. `CI=true pnpm test:provenance` then exited 0: 1 file passed and 4 tests passed.

### Verification

All commands exited 0 with fresh output: `CI=true pnpm test:provenance` (1 file, 4 tests); `CI=true pnpm build` (Webpack compiled, typechecked, and generated `/` and `/_not-found`); `CI=true pnpm lint`; `CI=true pnpm typecheck`; and `git diff --check`.

### Changed files

Updated `package.json`, `tests/provenance/youtube-digest.test.ts`, and this append-only handoff. No dependency, lockfile, or configuration-file changes were made.

### Risk

The production build intentionally uses Webpack instead of Next 16's default Turbopack, trading the default build engine for a portable build that does not rely on the prohibited port-binding worker transport. No other unresolved risks are known.
