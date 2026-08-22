# Batch C Task 2 revised brief — Due Practice completion

- Baseline: `f7de4b6`.
- Branch/worktree: `codex/popcorn-batch-c-2-revised`, `/private/tmp/popcorn-batch-c-2-revised`.
- Authority: `docs/superpowers/plans/2026-08-22-popcorn-batch-c-school-demo-revision.md`, Task 2; frozen CONTRACT-015 and CONTRACT-008C.

## Scope

Create a deterministic different-context Due Practice task, evaluate a submitted answer through the pinned structured gateway (or the CI fixture), then make the single `complete_due_practice` RPC call. The application never calculates persisted evidence transitions: it only validates the returned immutable state and schedule against the frozen pure scheduling rules.

## Constraints

- CI selects `createEvaluationFixtureGateway` before resolver, Vault, or fetch.
- Live evaluation uses `resolvePracticeEgress` and the owner-pinned structured gateway. Provider work is complete before the RPC.
- The RPC is the sole completion write. Its result IDs, state, and next due time are returned without database/provider/gateway detail.
- Owner, task graph, stale/future, and replay enforcement remains in the frozen RPC. The owner-scoped application boundary maps failures to generic no-store responses.
- LLM Wiki is method-only; no GPLv3 code, tests, prompt text, components, or assets were copied. No YouTube Digest task-specific adaptation applies.

## Required verification

Run the focused Vitest trio, `tsc --noEmit`, the scoped ESLint command, and `git diff --check`. Do not reset the database or rerun pgTAP/concurrency gates.
