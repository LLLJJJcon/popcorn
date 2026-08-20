# Batch B Task 5 handoff

- Plan/task: `2026-08-16-popcorn-batch-b-learning-loop.md`, Task 5.
- Baseline: `a4a8241`; task brief commit: `51de52b`.
- Worktree: `/private/tmp/popcorn-batch-b-5`.

## Outcome

The existing Task 4 original-attempt path now persists the staged attempt before
calling the frozen `promote_valid_practice_draft_attempt` RPC. The provider-neutral
promotion boundary derives `tried`, NFKC + Unicode-trim normalization, and the
one-day schedule exclusively from frozen server functions. It sends only the five
approved RPC arguments.

Before Provider resolution, an original replay loads revision 1 by exact owner and
draft. Equal content replays a passed promotion or returns the same failed attempt;
changed content conflicts. A `23505` insert race reloads the same recovery anchor.
Promotion failure leaves the staged attempt intact and retryable. Completed drafts
still accept optional append-only revisions, while revisions never call promotion.

Vault and Practice now have owner-scoped production repositories, server pages,
and three authenticated no-store GET routes. Vault starts from promoted
`user_expressions`, maps the source occurrence and bounded staged attempt/revision
history, and does not expose Provider provenance or private fields. Exact detail
lookups are not limited by list ordering; bounded deterministic application-side
Chinese trigram suggestions are display-only. Practice reads only pending tasks due
by server time, ordered by due time and stable ID. Both surfaces have empty states.

## TDD evidence

RED command:

```text
./node_modules/.bin/vitest run \
  tests/integration/learning-loop/record-valid-attempt.test.ts \
  tests/integration/memory/vault-practice.test.ts \
  tests/integration/practice/attempts.test.ts \
  src/features/practice/practice-session.test.tsx
```

Initial result: exit 1. The promotion/Vault/Practice imports were absent and the
passed-response Vault link assertion failed. A later focused RED proved the
production Vault query incorrectly used canonical `attempts` instead of durable
`practice_draft_attempts`; it failed on `unexpected query attempts` before the
mapping was corrected.

Final GREEN result: 4 files passed, 50 tests passed.

Covered behavior includes eligibility derivation and exact RPC mapping, failed and
revision non-promotion, exact original replay with zero second egress, promotion
failure recovery, changed-content conflict, duplicate-insert race recovery,
completed-draft revision history without re-promotion, save-only exclusion by query
root, owner filters, exact source evidence and complete staged history, stable
suggestions, pending/due ordering, authenticated handlers, UI feedback/Vault link,
and empty states.

## Production wiring

- `createPracticeServerServices` constructs the Supabase promotion repository and
  injects the record-valid-attempt service into the existing production attempt
  route path.
- `/api/v1/vault`, `/api/v1/vault/[userExpressionId]`, and
  `/api/v1/practice/due` construct the real authenticated runtime and repository.
- `/vault` and `/practice` authenticate with the same runtime and render real data.

## Verification

```text
./node_modules/.bin/tsc --noEmit --pretty false
exit 0

NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon \
SUPABASE_SERVICE_ROLE_KEY=test-service SUPADATA_API_KEY=test-supadata \
OPENAI_API_KEY=test-openai OPENAI_MODEL=test-model \
APP_URL=https://popcorn.example \
EXTENSION_REDIRECT_ORIGIN=https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org \
INTERNAL_JOB_SECRET=test-internal CI=true \
./node_modules/.bin/next build --webpack
exit 0; 25/25 static pages generated and all new dynamic routes listed

git diff --check
exit 0
```

The first parallel pre-commit `tsc` overlapped `next build` while Next cleared
`.next/types`, so it reported only missing generated TS6053 files. The build
completed successfully and the required sequential fresh `tsc` rerun exited 0;
this was a verification-directory race, not a source failure.

## Upstream/license and residual risk

No YouTube extraction implementation was added and no applicable YouTube Digest
file/function existed for this task. LLM Wiki informed only the permitted
`Raw Source -> Structured Knowledge -> Learning Evidence` method; no GPLv3 code,
tests, prompts, assets, components, wording, or styling were copied. No dependency
or lockfile changed.

The due-Practice surface lists due items and links back to their grounded Vault
evidence; scoring/rescheduling a due review is intentionally outside Task 5. Live
database behavior relies on frozen CONTRACT-013, already verified by the controller;
this task intentionally did not rerun database reset/full pgTAP or browser suites.
