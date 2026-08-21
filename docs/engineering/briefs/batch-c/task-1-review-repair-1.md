# Batch C Task 1 review repair 1 brief

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md`, Task 1.
- Repair baseline: `c64dc63d0e2267f67e9194ff219d92ec08a07e2c`.
- Worktree: `/private/tmp/popcorn-batch-c-1`.
- Allowed modifications: `src/features/vault/vault-search.tsx`, its existing Task 1 focused test file(s), `docs/engineering/handoffs/batch-c/task-1.md`, and this brief.
- Forbidden modifications: repository/RPC/API routes, contracts, database migrations/types, other features, root configuration, lockfile, extension, vendor/upstream files.
- Consumed interface: the already-frozen Task 1 search client response and server ordering. Produced behavior: only the newest request may publish results/errors/loading state; a visible accessible Retry action must repeat a failed search even when filters are already empty.
- RED tests required:
  1. Dispatch search A, then search B; resolve B before A and prove A can never overwrite B's results or state.
  2. Fail the initial empty-filter request; activate an accessible `Retry search`; prove a second request succeeds and renders its result.
  3. Cover stale failure as well as stale success if one mechanism does not inherently prove both.
- GREEN implementation: minimal cancellation or monotonically increasing request-generation fence. Retry must trigger a new request without changing semantic filters. Avoid state updates after unmount. Do not reorder or transform server results.
- Verification: focused Task 1 tests; scoped ESLint for changed TS/TSX; `./node_modules/.bin/tsc --noEmit`; `git diff --check`; range/allowlist audit from this baseline.
- Upstream/license: no upstream code is needed. YouTube Digest remains the pinned MIT adaptation at `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; LLM Wiki `723e259309aea5e3850265b631f80224f66dd9f6` remains method-only. Copy no GPLv3 code, tests, prompts, components, or assets.
- Handoff: append RED/GREEN commands/results, commit SHA, risks, and changed-file list to the existing Task 1 handoff; commit the repair. Implement only this repair.
