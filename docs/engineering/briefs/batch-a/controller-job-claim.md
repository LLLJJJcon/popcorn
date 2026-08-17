# Batch A Controller Job Claim Contract

## Trigger and baseline

- Trigger: Batch A Task 2 cannot discover global Cron work with an expected `user_id`, while direct service-role scans violate the frozen owner-filter rule.
- Baseline: `f4a25dbceaffbc0562516945cbdb0323a64448f0`.
- Worktree: `/private/tmp/popcorn-batch-a-claim-contract`; branch `codex/popcorn-batch-a-claim-contract`.
- Controller contract proposal: `CONTRACT-004`. No feature Agent may edit this migration/RLS/type surface.

## Allowed files

- `supabase/migrations/202608160005_claim_knowledge_jobs.sql`
- `supabase/tests/rls.sql`
- `src/types/database.generated.ts`
- this brief
- `docs/engineering/handoffs/batch-a/controller-job-claim.md`

No other file may change.

## Required interface

Add one `public.claim_knowledge_jobs(p_limit integer, p_now timestamptz)` RPC, executable only by `service_role`, that atomically discovers and leases a bounded cross-tenant batch and returns the complete public job rows including database-derived `user_id`.

- `SECURITY DEFINER`, fixed `search_path=pg_catalog`, fully qualified relations/functions, PUBLIC/anon/authenticated execute revoked, explicit service-role execute.
- `p_limit` must be 1–25 and `p_now` non-null; invalid values fail before mutation.
- Eligible states exactly follow the frozen domain: pending, due retryable failure, or expired lease. Active lease, future retry, succeeded, and terminal failed are excluded.
- Use `FOR UPDATE SKIP LOCKED` in deterministic order so concurrent workers cannot both claim one row.
- Claim increments attempt count, sets `leased`, clears next-attempt/error, sets lease to exactly five minutes, and writes `updated_at=p_now`.
- Any eligible job already at five attempts becomes `terminal_failed` with `JOB_RETRY_EXHAUSTED`, null lease/next attempt, exact updated time, and is not returned as claimed.
- The RPC performs only audited discovery/lease. After return, worker code must use the returned `user_id` on every metadata read and state mutation. It must not expose `knowledge_job_internal`.
- No Provider/network call, payload input, arbitrary SQL filter, caller-supplied user, migration rewrite, or new job state/type.

## Strict TDD and verification

First extend the existing `no_plan()` pgTAP suite and capture RED: missing function/catalog privileges and missing atomic claim behavior. GREEN must prove exact catalog security, bounded validation, deterministic eligibility, five-minute lease, attempt increment, expired lease recovery, fifth-attempt exhaustion, second-claim exclusion, owner returned, and `SKIP LOCKED` presence.

Then apply two clean resets, run full pgTAP, mechanically regenerate types, compare generation except the CLI trailing blank line, and run `pnpm verify` plus `git diff --check`.

## License/scope

No upstream code applies. LLM Wiki contributes only the frozen durable queue/lease-recovery method; copy no GPLv3 code, tests, SQL, names, prompts, components, or assets. No vector, graph, chat, export, generic source, Provider, or product behavior.
