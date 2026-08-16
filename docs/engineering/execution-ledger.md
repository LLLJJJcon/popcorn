# Popcorn Execution Ledger

## Current position

- Stage: foundation
- Next task: Foundation Task 2
- Integration branch: `codex/popcorn-youtube-learning`
- Integration worktree: `/private/tmp/popcorn-youtube-learning`
- Repository baseline: `cc515558c899472dccb8e2fe6d21ef861970109b`
- Last verified commit: `e21ba63d8c754aeb2a6ff92338b6eed59821a759`

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
| Foundation | 1 | `codex/popcorn-foundation-1` | `abb4a271a7bbe9d04ad3ace12615e853b8c50e85` | `8294e6bc11778e6e8ff90814cf2f5e0bd32aca38` | PASS; spec compliant and quality approved after independent fix/re-review loops | Integrated through `e21ba63d8c754aeb2a6ff92338b6eed59821a759`; `CI=true pnpm verify` passed; focused page/provenance 5/5; vendor syntax and `git diff --check` passed |

## Open concerns

| ID | Severity | Owner | Description | Required action |
|---|---|---|---|---|
| ENV-001 | External | Controller | Production credentials, provider terms approval, and deployment access may be required only after local acceptance. | Defer until Delivery Task 6; do not weaken fixture-backed checks. |

## Contract changes

| ID | Requested by | Decision | Contract commit | Consumers notified |
|---|---|---|---|---|
| CONTRACT-001 | Controller; confirmed by user 2026-08-17 | Canonical design governs: include `UNSUPPORTED_YOUTUBE_PAGE`, `TRANSCRIPT_EMPTY`, and `SYNC_RETRYING` in the frozen `ApiFailure.code` union in addition to the Task 2 snippet. | Pending Foundation Task 2 | Foundation Task 2 brief; later API consumers inherit the frozen union |

## File ownership

- Controller only: `src/contracts/**`, `supabase/migrations/**`, `src/types/database.generated.ts`, root configuration, lockfiles, vendor scripts, upstream notices, integration ledger, and checkpoints.
- Feature tasks receive exact allowlists in durable briefs.
- Concurrent implementation agents use separate Git worktrees and may not edit overlapping paths.

## Next dispatch

- Foundation Task 2: define environment, API, source, knowledge, practice, and mastery contracts.
- Execution is sequential through Foundation Task 5; no Batch A feature stream starts before the Foundation exit gate is recorded.
