# Delivery Task 5C Handoff — Resume a Completed Transcript Snapshot

## Outcome

A succeeded `resolve_snapshot` continuation now keeps the owner-bound
`snapshotId` from public job status and reads that exact persisted native
Chinese snapshot through the fixed Popcorn transcript route. The continuation
does not initiate another Supadata transcript request.

The persisted-read boundary requires the authenticated owner, requested
YouTube video, and snapshot ID to agree. It orders stored rows by `position`,
preserves each stable ID and timing value, and reconstructs deterministic
`plainText` and `timestampedText`. Missing, malformed, foreign-owner, and
wrong-video identities receive the existing bounded `TRANSCRIPT_UNAVAILABLE`
response with no Provider fallback. Initial requests without `snapshotId`
retain the prior Provider path.

## TDD evidence

### RED

Before production edits, focused continuation and store-boundary tests were
added and run on the baseline:

```text
pnpm vitest run tests/integration/jobs/resolve-snapshot.test.ts && node --test extension/tests/translation.test.js
```

Result: exit 1. The new persisted-store test failed with
`store.readSnapshot is not a function`; continuation tests then reached the
old Provider-request path and failed before receiving a snapshot. This proved
the baseline lacked both exact snapshot loading and the extension handoff.

### GREEN

```text
pnpm vitest run tests/integration/jobs/resolve-snapshot.test.ts
node --test extension/tests/translation.test.js
pnpm exec tsc --noEmit
pnpm exec eslint 'src/server/transcript/provider.ts' 'src/server/jobs/process-jobs.ts' 'src/app/api/v1/youtube/[videoId]/transcript/route.ts' 'tests/integration/jobs/resolve-snapshot.test.ts'
node --check extension/background.js
git diff --check
```

All commands exited 0. The focused integration suite passed 25 tests and the
extension suite passed 24 tests.

## Changed files

- `extension/background.js`: passes the succeeded job's `snapshotId` only to
  the existing fixed transcript route.
- `extension/tests/translation.test.js`: proves that continuation uses the
  returned snapshot query and does not register a fresh transcript path.
- `src/server/transcript/provider.ts`: adds bounded snapshot-query handling to
  the existing transcript route.
- `src/server/jobs/process-jobs.ts`: reads an owner/video/snapshot-bound
  persisted snapshot and deterministically reconstructs its native shape.
- `tests/integration/jobs/resolve-snapshot.test.ts`: covers ordered persisted
  reconstruction, zero Provider access for continuation, bounded invalid
  identities, and unchanged initial behavior.

No migration, generated type, configuration, dependency, lockfile, Provider
implementation, credentials, or unrelated UI behavior changed.

## Self-review and residual risk

The continuation route exposes only the existing response shape and a bounded
public error; it does not log transcript text, Provider payloads, or private
job input. The Supabase adapter applies owner filters at source, snapshot, and
segment reads and rejects language or identity disagreement before returning
data. The test harness uses fixtures rather than a real service; a separately
authorized live smoke remains the delivery-wide acceptance step.

## Commit

Implementation and handoff commit: `7ff120082d89a0b74d296291c117532ba98a9b1c`.

## Upstream and license

The existing YouTube Digest adaptation remains intact, including the canonical
YouTube ID flow and short independent polling. No upstream material was
fetched or copied. LLM Wiki remains methods-only; no GPLv3 code, tests,
prompts, components, or assets were added.

## Fix round 1 — persisted segment pagination

Review found that the Data API can cap one transcript-segment query at 1,000
rows while valid normalized snapshots may contain more. `readSnapshot` now
retrieves ordered `position` pages of 1,000 rows until a short page signals
exhaustion before reconstructing the native snapshot.

### RED

```text
pnpm vitest run tests/integration/jobs/resolve-snapshot.test.ts
```

Baseline result: exit 1; the new 1,001-row persisted-read regression received
only 1,000 segments. This isolated silent truncation at the store boundary.

### GREEN

- `pnpm vitest run tests/integration/jobs/resolve-snapshot.test.ts`: 26 passed.
- `node --test extension/tests/translation.test.js`: 24 passed.
- `pnpm exec tsc --noEmit`, focused eslint, `node --check extension/background.js`,
  and `git diff --check`: passed.

The capped-query test checks the final stable ID, position, times, language,
and reconstructed final text after the second page, as well as page ranges
`0..999` and `1000..1999`.

No Provider request, schema, migration, generated type, configuration,
dependency, lockfile, or unrelated behavior changed. Residual risk remains
limited to the separately authorized live-service smoke.

Fix commit: pending final SHA record.
