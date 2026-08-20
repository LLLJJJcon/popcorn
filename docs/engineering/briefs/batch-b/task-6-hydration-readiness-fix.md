# Batch B Task 6 hydration-readiness repair brief

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`, Task 6 repair after independent repeat-E2E review.
- Baseline commit: `744f947f00021d35842c63a4b3f3a6bc5e966441` (reviewed FAIL; do not integrate independently).
- Worktree: `/private/tmp/popcorn-batch-b-6-cleanup-fix`.
- Allowed modifications: `src/features/saved/candidate-list.tsx`, `src/features/saved/candidate-list.test.tsx`, `tests/e2e/saved-learning-loop.spec.ts`, this brief, and `docs/engineering/handoffs/batch-b/task-6-hydration-readiness-fix.md` only.
- Forbidden modifications: migrations, root configuration, lockfile, APIs/repositories, other production files/tests, generated files, Provider/gateway behavior, and ledger.
- Consumed interfaces: `CandidateExpressionCard.disabled`, `POST /api/v1/practice/tasks`, existing CandidateList component contract, existing saved-learning-loop fixture/cleanup.
- Produced interface: `Use It Now` is natively disabled until CandidateList hydration completes, then enabled; one enabled click emits exactly one activation POST. E2E uses an enabled-state web assertion, never `networkidle`, and retains explicit POST 201/body plus navigation assertions.
- RED expectation: add a component regression that fails on the baseline because SSR output exposes an enabled action before hydration (use server rendering for the pre-hydration assertion where appropriate), while preserving existing interaction tests.
- GREEN expectation: initial server-rendered action is disabled; after hydration it becomes enabled; one click produces exactly one activation request. Focused component tests pass. E2E deletes `networkidle`, awaits `toBeEnabled()`, then passes twice consecutively without database reset.
- Verification: focused CandidateList test; focused Playwright E2E twice consecutively with local Supabase and fixture Provider; scoped ESLint; typecheck; diff-check. Main controller owns the final immediate pgTAP after integration.
- Upstream reuse: no new upstream code. Preserve existing YouTube Digest interface reuse from fixed commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; LLM Wiki at `723e259309aea5e3850265b631f80224f66dd9f6` is method-only and no GPLv3 code, prompts, tests, components, or assets may be copied.
- License: preserve project licensing and GPLv3 isolation.
- Scope calibration: this fixes a directly observed core interaction defect; add no unrelated safety or security controls.
