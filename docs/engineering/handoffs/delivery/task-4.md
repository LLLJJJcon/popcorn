# Delivery Task 4 handoff — Fixture acceptance and slim CI

## Result

- Implementation commit: `320fd93d0f88e83939797d5984aeafdc8341615f`
- Controller wiring commits:
  - `c28fad03a934a7118ce46f902c6107e047d73495` — one-job fixture CI and Playwright acceptance selection
  - `06a52f00ba4a6d6426569327237bd808ba00ea2c` — brief scope for isolated imported Web suites and one Vault search assertion
  - `17d360e3ec6cb2e852945482e01e5bdc97f84614` — non-vacuous event patch whitespace check
- Worktree/branch: `/private/tmp/popcorn-delivery-4`, `codex/popcorn-delivery-4`
- No integration or push was performed.

## Implemented files

- `tests/e2e/demo-acceptance.spec.ts` composes the accepted extension acquisition/recovery, Saved learning-loop, and returning-learner specs without copying their fixtures or SQL graphs.
- `tests/e2e/extension/fixtures.ts` loads generated `dist/popcorn-extension`, validates its `runtime-config.js`, derives exact local app/Supabase origins, preserves the YouTube fixture origin, and aborts every other HTTP(S) request.
- `tests/e2e/saved-learning-loop.spec.ts` adds only a named lifecycle scope and one learned-expression Vault search-result assertion.
- `tests/e2e/returning-learner.spec.ts` adds only a named lifecycle scope.
- `tests/release/ci-scope.test.ts` locks the composition, lifecycle isolation, Vault search, packaged runtime/closed egress, one-job fixture CI, event patch whitespace range, Playwright routing, and checklist boundaries.
- `docs/operations/demo-checklist.md` gives the professor-facing automated fixture checklist and keeps Delivery Task 5's manual real-service smoke separate.

## TDD evidence

Initial RED before Controller wiring:

- Direct Vitest equivalent of `pnpm vitest run tests/release/ci-scope.test.ts`: 4 failed / 2 passed. Missing contracts were packaged runtime origins, package/acceptance CI wiring, removal of repeated concurrency commands, and Playwright selection.
- Direct Playwright equivalent of the required acceptance command: no tests selected by `chromium-extension`.
- The requested `pnpm` command first stopped in the Codex environment with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; subsequent evidence used the checked-out `node_modules/.bin/*` binaries with the same arguments.

Composition/search RED after Controller wiring and brief clarification:

- Imported Web hooks initially shared one suite. The extension scenario passed, but Saved navigated from `/home` to `/sign-in` because the returning-learner session hook overwrote its cookie.
- The unchanged Saved spec passed independently (1/1), isolating the fault to composed hook scope.
- Revised CI-scope contract: 2 failed / 6 passed for missing named lifecycle scopes and missing Vault search behavior.

Review RED:

- Closed-egress contract: 1 failed / 7 passed because unexpected HTTP(S) traffic was observed but not aborted.
- Non-vacuous whitespace contract: 1 failed / 8 skipped because CI lacked full history and an event patch range. Controller commit `17d360e3ec6cb2e852945482e01e5bdc97f84614` supplied PR-base/push-before selection, `GITHUB_SHA`, zero/missing-base fallback, and the actual patch check.

Final GREEN:

- `TMPDIR=/private/tmp node_modules/.bin/vitest run tests/release/ci-scope.test.ts`: 9/9 passed.
- `TMPDIR=/private/tmp node_modules/.bin/playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension --reporter=line`: 3/3 passed in 22.3 seconds.
- Scoped ESLint across the CI contract, acceptance entry, extension fixture, and both wrapped Web specs: exit 0.
- `git diff --cached --check` before the implementation commit: exit 0.
- `bash scripts/package-extension.sh`: packaged and validated 23 release files; SHA-256 `a546f3d3090f3883b97a005a23712b10667213d107d69e26794d4d96ea252d91` for that local verification build.

All browser evidence used the local app, local Supabase, deterministic YouTube HTML, and fixture Provider mode. No real credentials, Supadata request, model Provider request, or live YouTube request was used.

## Risks and operating notes

- Acceptance requires local Supabase fixture settings and a freshly generated `dist/popcorn-extension`; the fixture fails with an explicit packaging instruction if runtime config is missing and rejects malformed/non-origin URLs.
- Playwright evaluates approved routes before the catch-all fallback. Unexpected HTTP(S) requests are both recorded for the existing `unapprovedEgress()` assertion and aborted before network access.
- The named `test.describe` wrappers are intentionally the only lifecycle change to the two existing Web specs. Their database graphs, assertions, and cleanup remain unchanged except for the single Saved Vault search assertion allowed by the revised brief.
- Next development-server side effects (`AGENTS.md`, `CLAUDE.md`, and `next-env.d.ts` changes) were removed before commit. The pre-existing untracked `node_modules` symlink remains untouched.

## Licensing

- No upstream code, tests, prompts, prose, or assets were fetched or copied.
- The task only composes Popcorn's already accepted MIT-derived extension surface; YouTube Digest provenance remains unchanged.
- LLM Wiki method-only isolation remains unchanged.
- No dependency, lockfile, license, or notice change was required.
