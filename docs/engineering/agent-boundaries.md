# Popcorn Agent Boundaries

This ownership contract governs all parallel work after Foundation freezes.
Task briefs may narrow ownership further, but they may not grant a feature
Agent any controller-owned surface listed here.

## Controller-owned surfaces

Only the implementation controller may modify or integrate:

- `src/contracts/**`;
- `supabase/migrations/**`;
- `src/types/database.generated.ts`;
- root configuration and the root `package.json` scripts;
- the `pnpm-lock.yaml` lockfile;
- `scripts/vendor-youtube-digest.sh`;
- upstream notices, including `THIRD_PARTY_NOTICES.md` and preserved licenses;
- shared error codes;
- `docs/engineering/execution-ledger.md`;
- `docs/engineering/checkpoints/**`; and
- final integration, cross-module arbitration, and release gates.

Feature Agents must submit a contract-change proposal rather than editing a
frozen surface. The controller pauses affected consumers, updates tests and the
contract if approved, records the new baseline, and re-verifies every consumer.

## Parallel execution rules

- At most three child Agents may be active at once; the controller remains the
  coordinating Agent.
- Parallel writing Agents use a distinct Git worktree and branch.
- Two active Agents must not overlap their active file ownership.
- Every brief names an exact allowlist and forbidden shared paths. An Agent
  stops if a necessary edit falls outside that allowlist.
- Parallel work begins only after its consumed contracts and migrations have
  passed review and are frozen.
- The durable ledger, Git commits, task briefs, handoffs, and checkpoints are
  the system of record; chat memory is not.

## Task review and integration

The mandatory order for every numbered task is:

1. an implementation Agent writes a failing test, captures RED, makes the
   minimum implementation, captures GREEN, commits, and writes a handoff;
2. a fresh read-only review Agent reviews the complete baseline-to-head diff,
   specification, upstream reuse, license boundary, user isolation, and tests;
3. when review finds a blocking issue, a fix Agent adds a regression test and
   commits the correction;
4. a fresh re-review covers the complete updated diff; and
5. after approval and independent verification, controller integration is the
   only route into the integration branch.

A task is not accepted from an implementer's self-review. Reported test output
without the exact command, changed-file list, provenance record, commit SHA,
and unresolved risks is incomplete.

## Frozen product boundary

Agents implement only the currently watched standard YouTube video flow for
English-speaking learners of Mandarin. Saves are non-blocking learning-material
snapshots and never video files. Saving cannot call a transcript, translation,
or AI Provider synchronously and never counts as mastery. Mastery remains
exactly `tried -> reused -> owned`; generic inputs, vectors, graphs, chat,
export, and advanced Progress remain excluded.
