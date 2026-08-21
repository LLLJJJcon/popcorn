# CONTRACT-015 review repair 1 brief

- Plan dependency: Batch C Task 2 atomic due Practice completion prerequisite.
- Repair baseline: `11d80bc`.
- Worktree/branch: `/private/tmp/popcorn-youtube-learning`, `codex/popcorn-youtube-learning`.
- Allowed modifications: `supabase/migrations/202608160014_due_practice_completion.sql`, `supabase/tests/due_practice_completion.sql`, `docs/engineering/handoffs/batch-c/contract-015-due-practice-completion.md`, and this brief.
- Forbidden modifications: generated types unless schema shape actually changes; existing migrations/tests; feature/domain/repository/route/UI code; root config; lockfile; Provider/gateway/extension files; execution ledger before re-review PASS.

## Blocking findings

1. The RPC graph check uses `v_task.review_task_id <> v_review.id`. Because legacy-compatible due tasks may have a NULL `review_task_id`, PostgreSQL three-valued logic lets an unlinked same-owner/same-expression/same-due task pass. The RPC contract is fail-closed and must use a NULL-safe comparison.
2. `p_completed_at + make_interval(days => v_interval)` on `timestamptz` follows the session TimeZone across DST. The frozen TypeScript schedule adds exact 24-hour days. SQL must be deterministic and exactly equivalent regardless of session TimeZone.

## TDD protocol

- RED first: add a focused pgTAP proving an unlinked legacy due task cannot complete a pending review and leaves zero attempt/event/receipt mutations. Run it against baseline and record the failure.
- RED first: set a non-UTC DST-observing session TimeZone and complete a fixture across a DST transition; assert 1/7/30 interval semantics use exactly 24 hours per day. Run against baseline and record the mismatch.
- GREEN: make the minimum migration-only fixes, expected to be a NULL-safe `IS DISTINCT FROM` graph comparison and a UTC/fixed-duration schedule operation. Do not remove legacy task compatibility and do not change Provider/key behavior.
- Re-run focused pgTAP, clean reset migrations 001–014, full pgTAP, TypeScript, and diff/allowlist checks. A generated-type refresh is unnecessary if the schema/API shape is unchanged.
- Update the existing handoff with exact RED/GREEN evidence, residual risks, changed files, and commit SHA; commit the repair and return the SHA.

## Interfaces and license

- Consumes/produces the same frozen CONTRACT-015 interfaces; no downstream signature change.
- No upstream code is needed. Preserve YouTube Digest MIT pin `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; LLM Wiki `723e259309aea5e3850265b631f80224f66dd9f6` remains method-only, with no GPLv3 code/tests/prompts/components/assets copied.
