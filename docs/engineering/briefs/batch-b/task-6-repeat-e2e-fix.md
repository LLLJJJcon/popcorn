# Batch B Task 6 repeat-E2E repair brief

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 6 repair after repeatability gate.
- Baseline commit: `6ca6d1930c1d293f384fb66e42cd3e05ea6eb559`.
- Worktree: `/private/tmp/popcorn-batch-b-6-cleanup-fix`.
- Allowed modifications: `tests/e2e/saved-learning-loop.spec.ts`, this brief, and `docs/engineering/handoffs/batch-b/task-6-repeat-e2e-fix.md` only.
- Forbidden modifications: all production code, migrations, root configuration, lockfile, other tests, and generated files.
- Consumed interfaces: `POST /api/v1/practice/tasks`, the existing saved-learning-loop fixture/cleanup helper, and Playwright page/network assertions.
- Produced interface: a deterministic, fail-fast E2E assertion for practice-task activation that remains repeatable across two consecutive runs and reports the response status/body on failure.
- RED expectation: reproduce the current second-run timeout or demonstrate that the existing navigation-only assertion can hide a non-201 activation response; capture concrete evidence before changing the test.
- GREEN expectation: the focused E2E passes twice consecutively without database reset, and the test explicitly asserts the activation response is HTTP 201 before asserting navigation.
- Verification: run the focused Playwright test twice consecutively with the local Supabase/fixture environment; main controller will immediately run `supabase test db` afterward. Also run focused lint/typecheck or the smallest relevant static verification.
- Upstream reuse: no new upstream code. Continue using the already integrated YouTube Digest-derived interfaces at fixed commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; do not copy GPLv3 LLM Wiki code, prompts, tests, components, or assets (method-only reference at `723e259309aea5e3850265b631f80224f66dd9f6`).
- License: preserve project licensing and GPLv3 isolation; no copied upstream code in this repair.
- Scope calibration: this is reliability/diagnostic coverage for the core personal learning loop, not an expansion of security checks.
