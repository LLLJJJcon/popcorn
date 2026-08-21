# Batch C Task 2 handoff — interrupted implementation checkpoint

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-c-progress-chinese.md`, Task 2.
- Baseline: `7e977cff6b695ed8f1faeeb026e0c087837dbea8`.
- Brief commit: `c169e8f`.
- Worktree: `/private/tmp/popcorn-batch-c-2`.

## Current state

Implementation was paused for an immediate push checkpoint before any Task 2
test or production source was created or modified. The task brief, Batch C Task
2 plan, frozen CONTRACT-015 migration/generated types/handoff, existing
Practice repository/UI/routes, StructuredJson gateway and resolver, evaluation
prompt/schema/CI fixture, and mastery/scheduling rules were inspected.

No RED command has been run and no GREEN claim is made. The temporary untracked
`node_modules` symlink created by the controller for dependency reuse was
removed before this checkpoint and is not committed.

## Remaining work

- Write and run the required failing transfer, completion, repository, route,
  and Practice UI tests.
- Implement bounded new-context task materialization with existing-task replay,
  race recovery, deterministic invalid-output fallback, and frozen gateway
  resolution.
- Implement evaluation-before-RPC completion through exactly one
  `complete_due_practice` call, followed by mastery/schedule parity validation.
- Implement strict authenticated routes and the interactive due Practice UI,
  including explicit assistance, duplicate-submit prevention, preserved input,
  retry, and concise result presentation.
- Run the brief's focused GREEN regressions, scoped ESLint, project TypeScript,
  diff-check, and baseline allowlist audit; then replace this checkpoint with a
  complete TDD handoff.

No contract, migration, generated type, root configuration, lockfile, gateway
transport/runtime, save path, extension, vendor, or upstream file changed.
