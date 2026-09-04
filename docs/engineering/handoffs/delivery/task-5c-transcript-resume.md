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

Commit: pending final amend.

## Upstream and license

The existing YouTube Digest adaptation remains intact, including the canonical
YouTube ID flow and short independent polling. No upstream material was
fetched or copied. LLM Wiki remains methods-only; no GPLv3 code, tests,
prompts, components, or assets were added.
