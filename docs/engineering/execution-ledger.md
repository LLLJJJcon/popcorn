# Popcorn Execution Ledger

## Current position

- Stage: foundation
- Next task: Foundation Task 1
- Integration branch: `codex/popcorn-youtube-learning`
- Integration worktree: `/private/tmp/popcorn-youtube-learning`
- Repository baseline: `cc515558c899472dccb8e2fe6d21ef861970109b`
- Last verified commit: `cc515558c899472dccb8e2fe6d21ef861970109b`

## Preflight

- Read-only preflight completed: 2026-08-16 Asia/Shanghai.
- Main branch: `main` at `cc515558c899472dccb8e2fe6d21ef861970109b`.
- Existing tracked modifications: none.
- Existing untracked user files: preserved in the main checkout and excluded from this worktree.
- Applicable `AGENTS.md`: none found.
- YouTube Digest pin verified: `d03e1f61e017b032159ffd1821cac6e7693ce0c7` is `main`/`HEAD`.
- LLM Wiki pin verified: tag `v0.6.9` peels to `723e259309aea5e3850265b631f80224f66dd9f6`.
- Plan conflict scan: no blocking conflict; the user's latest fixed batch schedule governs where orchestration/runbook wording differs.

## Completed tasks

| Plan | Task | Branch | Base | Head | Review | Verification |
|---|---:|---|---|---|---|---|

## Open concerns

| ID | Severity | Owner | Description | Required action |
|---|---|---|---|---|
| ENV-001 | External | Controller | Production credentials, provider terms approval, and deployment access may be required only after local acceptance. | Defer until Delivery Task 6; do not weaken fixture-backed checks. |

## Contract changes

| ID | Requested by | Decision | Contract commit | Consumers notified |
|---|---|---|---|---|

## File ownership

- Controller only: `src/contracts/**`, `supabase/migrations/**`, `src/types/database.generated.ts`, root configuration, lockfiles, vendor scripts, upstream notices, integration ledger, and checkpoints.
- Feature tasks receive exact allowlists in durable briefs.
- Concurrent implementation agents use separate Git worktrees and may not edit overlapping paths.

## Next dispatch

- Foundation Task 1: scaffold the web baseline and reproducible pinned YouTube Digest intake.
- Execution is sequential through Foundation Task 5; no Batch A feature stream starts before the Foundation exit gate is recorded.
