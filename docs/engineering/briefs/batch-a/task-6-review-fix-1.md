# Batch A Task 6 Review Fix 1 — Serialize Durable Queue Mutations

## Identity

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 6.
- Task baseline: `8c8b2f3`; reviewed candidate: `5ef6eee6231beada03e855887cc384d02eb70889`.
- Fix worktree: `/private/tmp/popcorn-batch-a-6-fix`.
- Fix branch: `codex/popcorn-batch-a-6-fix`.
- Review result: FAIL with one blocker—concurrent read/append/whole-array writes can return two successful enqueue results while silently retaining only one event.

## Allowed files

- `extension/sync-queue.js`
- `extension/background.js`
- `extension/options.js`
- `extension/manifest.json`
- `extension/tests/sync-queue.test.js`
- `extension/tests/worker-restart.test.js`
- `docs/engineering/handoffs/batch-a/task-6.md`

Every other path is forbidden, especially Task 5 files, auth/contracts/migrations/generated types/server code, root config, lockfile, notices/licenses, ledger, plans, and specs.

## Required TDD repair

Write a deterministic concurrency test before production changes. Use a storage-read/write barrier rather than timing luck. RED must prove that candidate `5ef6eee` loses one of two concurrent enqueues even though both calls resolve successfully.

The repaired tests must prove:

1. Two or more concurrent `enqueueSavedItem` calls persist every distinct `clientEventId`; after a fresh module reload every event remains flushable.
2. Queue read-modify-write mutations are serialized across enqueue, flush acknowledgement/retry updates, and owner-bound discard so none can overwrite a concurrent mutation.
3. Duplicate client IDs remain idempotent; explicit matching acknowledgements remove only their event; foreign-owner discard cannot affect the active queue.
4. A failed mutation releases the serialization mechanism so later operations are not deadlocked.
5. The mechanism does not depend on a permanently alive worker for persistence. It may serialize calls within one worker instance; cross-worker overlap must remain safe under Chrome MV3's single active service-worker event execution model, and reload recovery must still be demonstrated.

RED command:

```bash
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
```

Expected RED: deterministic concurrent enqueue test shows both promises succeed but one stored event is missing.

Make the smallest implementation repair. Do not add a dependency, CAS service, database work, interval, unlimited storage, automatic old-data deletion, or a second queue.

## Verification

```bash
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
node --test extension/tests/auth-worker.test.js extension/tests/auth.test.js extension/tests/release.test.js
node --check extension/sync-queue.js
node --check extension/background.js
node --check extension/options.js
git diff --check
git status --short
```

Also rerun the full extension command and compare any `options-language`/`settings` failures to baseline; no new failure is allowed. Do not run DB reset, pgTAP, or build. Preserve pinned MIT reuse, GPLv3 isolation, secret/token boundaries, and the controller decision not to auto-delete legacy local data.

Update the Task 6 handoff, commit, and return SHA/RED/GREEN/changed files/risks. Do not self-approve.
