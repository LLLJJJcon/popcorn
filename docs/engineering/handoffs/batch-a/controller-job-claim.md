# Batch A Controller Job Claim Handoff

## Identity

- Baseline: `f4a25dbceaffbc0562516945cbdb0323a64448f0`
- Worktree: `/private/tmp/popcorn-batch-a-claim-contract`
- Contract proposal: `CONTRACT-004`
- Trigger: Cron supplies no tenant ID, so Task 2 required an audited database discovery boundary rather than a direct service-role scan without an expected owner.

## RED

The extended pgTAP suite failed against migrations 001–004: `claim_knowledge_jobs` was absent, producing seven expected catalog/privilege/validation failures before behavior could run.

## GREEN

- Migration 005 adds one service-role-only `SECURITY DEFINER` RPC with fixed `pg_catalog` search path and fully qualified application relation access.
- It validates a 1–25 limit and non-null clock before mutation.
- A deterministic `FOR UPDATE OF job SKIP LOCKED` candidate CTE atomically prevents duplicate worker claims.
- Pending, due retry, and expired lease states are eligible. Active lease, future retry, success, and terminal rows are preserved.
- Claimed rows increment attempts, receive an exact five-minute lease, clear retry/error fields, and set the supplied update clock.
- Eligible fifth-attempt rows become `terminal_failed/JOB_RETRY_EXHAUSTED` and are not returned as runnable leases.
- Returned public job rows include database-derived `user_id`; worker code must use it for every subsequent internal metadata read and transition.
- The RPC never reads or returns `knowledge_job_internal` payloads.

## Verification

- Clean reset applied migrations 001–005 and deterministic seed twice after final behavior.
- `pnpm exec supabase test db`: 249/249 passed.
- Types were mechanically regenerated; `claim_knowledge_jobs` returns the generated `knowledge_jobs` row set including `user_id`.
- `pnpm verify`: lint, typecheck, unit 76/76, contract 128/128, integration no-spec, provenance 11/11, and build passed.
- `git diff --check`: passed.

## Risk and consumer rule

- This is the sole approved cross-tenant discovery operation. Task 2 must not add a raw global select; after claim it must bind every operation to both job ID and returned user ID.
- Exhausted transitions consume bounded candidate slots and can make a call return fewer runnable rows; the next Cron invocation continues deterministic draining.

## License

No upstream code/test/SQL/names were copied. LLM Wiki remains method-only under the frozen GPLv3 isolation policy.
