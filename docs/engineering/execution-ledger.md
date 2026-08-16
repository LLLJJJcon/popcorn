# Popcorn Execution Ledger

## Current position

- Stage: foundation
- Next task: Foundation Task 3
- Integration branch: `codex/popcorn-youtube-learning`
- Integration worktree: `/private/tmp/popcorn-youtube-learning`
- Repository baseline: `cc515558c899472dccb8e2fe6d21ef861970109b`
- Last verified commit: `3e99b29218a2a4555d6c07f3671cc47e5f02a434`

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
| Foundation | 2 | `codex/popcorn-foundation-2` plus controller root-gate branch | `b1739e0e229e48a54f0cbb8eae96fc236c8b00bd` | `f75cd8be49d4a3de8fe0335183b971737ff9f000`; root gate `e4a069d4779a85bf6d8e3f3b9e56a10a4183bb7b` | PASS; complete baseline review approved with no Critical, Important, or Minor issues after six independent TDD fix/re-review rounds; root gate independently approved | Integrated through `3e99b29218a2a4555d6c07f3671cc47e5f02a434`; `CI=true pnpm verify` passed; root contract 128/128; focused Task 2 136/136; unit 9/9; provenance 5/5; production build and `git diff --check` passed |

## Open concerns

| ID | Severity | Owner | Description | Required action |
|---|---|---|---|---|
| ENV-001 | External | Controller | Production credentials, provider terms approval, and deployment access may be required only after local acceptance. | Defer until Delivery Task 6; do not weaken fixture-backed checks. |
| LANG-001 | Deferred validation | Batch A/B provider owners | Foundation schemas enforce literal `en`/`zh-CN` plus deterministic Han and Basic-Latin/ASCII syntactic boundaries; they intentionally do not claim semantic detection of ASCII-only foreign prose or exhaustive Simplified-Chinese orthography. | At transcript and AI Provider boundaries, validate actual returned language/content and reject fallback output before persistence. |

## Contract changes

| ID | Requested by | Decision | Contract commit | Consumers notified |
|---|---|---|---|---|
| CONTRACT-001 | Controller; confirmed by user 2026-08-17 | Canonical design governs: include `UNSUPPORTED_YOUTUBE_PAGE`, `TRANSCRIPT_EMPTY`, and `SYNC_RETRYING` in the frozen `ApiFailure.code` union in addition to the Task 2 snippet. | `e7c67615d091fa00663c9cab504bec0c1c7eb448` | Foundation Task 2 and all later API consumers inherit the frozen 19-code union |
| CONTRACT-002 | Controller review resolution 2026-08-17 | Freeze only deterministic language checks in shared schemas: literal `en`/`zh-CN`, Han presence for target text, and exact-preserved Basic-Latin/ASCII prose for English fields. Exhaustive semantic language and Simplified-Chinese validation belongs at Provider/transcript boundaries without adding a lockfile dependency here. | `e7c67615d091fa00663c9cab504bec0c1c7eb448` | Batch A transcript/AI adapters and Batch B Provider validators must enforce the deferred checks recorded as `LANG-001` |

## File ownership

- Controller only: `src/contracts/**`, `supabase/migrations/**`, `src/types/database.generated.ts`, root configuration, lockfiles, vendor scripts, upstream notices, integration ledger, and checkpoints.
- Feature tasks receive exact allowlists in durable briefs.
- Concurrent implementation agents use separate Git worktrees and may not edit overlapping paths.

## Next dispatch

- Foundation Task 3: create the database schema, indexes, direct-user RLS policies, deterministic two-user seed, SQL security tests, and generated database types from the frozen Task 2 contracts.
- Execution is sequential through Foundation Task 5; no Batch A feature stream starts before the Foundation exit gate is recorded.
