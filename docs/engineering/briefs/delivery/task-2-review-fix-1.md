# Delivery Task 2 review fix 1 — Legal schedule, exact API origin, bounded errors

- Full review baseline: `74b740fc9eb647ad628d6b9599e5f53e547f513e`.
- Rejected candidate: `424bba497bd5067a414bf233efa1d4ed18cf21a0`.
- Repair worktree: `/private/tmp/popcorn-delivery-2-fix-1`.
- Review verdict: FAIL with two P1 and two P2 findings.

## Allowed files

- `scripts/seed-demo.ts`
- `tests/integration/demo/demo-seed.test.ts`
- `docs/engineering/handoffs/delivery/task-2.md` (append repair evidence and
  replace the stale `commit pending` status)
- this controller brief

Do not modify fixtures, GoTrue seed/fix, package/lock/workspace, migrations,
generated types, application/extension/server code, existing unrelated tests,
ledger, or checkpoints.

## Required RED

Add focused tests that first fail against the rejected candidate:

1. For every attempt, its practice task `created_at` is not after
   `submitted_at`; every due task points to a review whose `due_at` is not after
   completion.
2. Each review schedule is derived from the preceding accepted evidence:
   original attempt + exactly 24 hours for the first `tried` review; successful
   due completion + exactly 7 days for `reused`; owned completion + exactly 30
   days for maintenance. Completed review/task/attempt/event timestamps and
   references agree exactly.
3. The three expression histories remain exactly `null -> tried`,
   `tried -> reused`, `reused -> owned`; one pending review is due at the
   normalized reference clock and the two maintenance reviews are future.
4. `/rest/v1`, `/auth/v1`, arbitrary paths, and trailing-path variants are
   rejected. Only an exact loopback Supabase API origin accepted by
   `createClient` is valid; credentials/query/fragment/non-HTTP(S) remain
   rejected.
5. A repository failure whose raw message contains a service key, SQL detail,
   or arbitrarily long text produces only a fixed bounded category; raw text is
   not emitted by the CLI-facing formatter.

Record the concrete failing assertions before implementation.

## Minimal GREEN

Build each expression timeline from one normalized reference anchor (for
example a stable UTC anchor derived from the supplied reference day), not from
unrelated sequence arithmetic:

- create an original task before its original attempt;
- schedule its first review at original completion + 1 day;
- create a due task no later than its attempt and complete the same review;
- schedule the next review from that completion using the frozen 7/30 day
  intervals;
- set review `created_at` to the evidence time that scheduled it and
  `updated_at` to its completion when completed.

Keep exactly one due-now pending review and future reused/owned maintenance
reviews. Repeated calls on the same UTC reference day should produce the same
timestamps, IDs, and counts; the next run may deliberately refresh the demo
reference day without changing IDs or unrelated rows.

Restrict `assertLocalSupabaseUrl` to the exact loopback API origin that can be
passed directly to `createClient`; do not accept a pre-appended REST/Auth path.

Map database/account/verification failures to a small fixed error category
union. Preserve safe CLI usage/locality messages where useful, but do not pass
through Supabase/PostgREST/SQL `error.message`, URL/key values, request bodies,
or unbounded unexpected exceptions. This is a local CLI boundary, not a new
logging/security platform.

Update the handoff to state the candidate was committed and rejected, then
append RED/GREEN/local evidence. Prefer an implementation repair commit followed
by a handoff commit that records the implementation SHA, avoiding a self-SHA
cycle.

## Verification

```bash
TMPDIR=/private/tmp pnpm vitest run tests/integration/demo/demo-seed.test.ts
TMPDIR=/private/tmp pnpm vitest run tests/contract/local-auth-seed.test.ts
TMPDIR=/private/tmp pnpm typecheck
TMPDIR=/private/tmp pnpm eslint scripts/seed-demo.ts tests/integration/demo/demo-seed.test.ts
git diff --check
```

Then run the CLI twice against the already-clean disposable local database; do
not reset again. Confirm identical IDs/counts/timestamps for the same normalized
reference day, mastery states 1/1/1, due-now 1, future maintenance 2, and
unrelated source retained. Do not print credentials. No pgTAP/E2E/build/load or
Provider calls.

## Upstream/license

No new upstream material. Preserve pinned YouTube Digest MIT attribution,
LLM Wiki GPLv3 method-only isolation, and controller-pinned MIT `tsx` tooling.
Commit only the allowlist and return repair SHA(s), RED/GREEN, two-run local
result, risks, and handoff path. Do not integrate or push.
