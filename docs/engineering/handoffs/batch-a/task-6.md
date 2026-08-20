# Batch A Task 6 Handoff — Durable Bounded Extension Sync Queue

## Baseline and candidate

- Plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 6.
- Accepted implementation/review baseline: `0449cc7`.
- Worktree starting commit containing the task brief: `8c8b2f3`.
- Reviewed implementation candidate: `5ef6eee6231beada03e855887cc384d02eb70889`.
- Review-fix brief commit: `e6d8187`.
- Review-fix HEAD: the fix commit containing this handoff.
- Review-fix worktree: `/private/tmp/popcorn-batch-a-6-fix`.

## Changed files

- `extension/sync-queue.js` (new)
- `extension/background.js`
- `extension/options.js`
- `extension/tests/sync-queue.test.js` (new)
- `extension/tests/worker-restart.test.js` (new)
- `docs/engineering/handoffs/batch-a/task-6.md` (new)

`extension/manifest.json` was inspected but did not require a change: it already has Chrome 116, `alarms`, exact Popcorn/YouTube/Supabase hosts, and no `unlimitedStorage` or Provider hosts. No content script, Side Panel file, contract, migration, root config, lockfile, ledger, auth module, server file, or upstream notice/license was changed.

Review fix 1 changed only:

- `extension/sync-queue.js`
- `extension/tests/sync-queue.test.js`
- `docs/engineering/handoffs/batch-a/task-6.md`

## TDD evidence

Initial RED:

```text
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
11 tests: 1 pass, 10 fail
```

Expected failures were `sync-queue.js`/its APIs not existing and `background.js` not registering startup, install, alarm, or queue message recovery.

Additional focused RED/GREEN cycles covered:

- exact current-video `player_moment` acceptance from the YouTube content sender (one expected RED before the sender route existed);
- clearing a stale retry alarm when the signed-in account does not own the retained event (one expected RED);
- options queue-count display and explicit owner-bound discard command (one expected RED).

Independent review fix RED:

```text
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
18 tests: 14 pass, 4 fail
```

The deterministic storage-read barrier reproduced four manifestations of the same whole-array lost-update root cause: concurrent enqueue lost one successful event; acknowledgement erased a concurrent enqueue; retry erased a concurrent enqueue; and discard followed by enqueue resurrected the discarded event. No timing delay or probabilistic rapid-click loop was used.

Review fix final focused GREEN:

```text
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
18 tests: 18 pass, 0 fail
```

Every queue read-modify-write now passes through one per-worker Promise mutation tail: enqueue admission and idempotency, acknowledgement/removal, retry bookkeeping, and owner-bound discard. Network calls remain outside the serialized mutation so an unavailable service does not block later durable writes. A rejected mutation settles the tail before the next operation; the regression test injects one quota write failure and proves the following enqueue persists and flushes instead of deadlocking.

Relevant frozen regressions:

```text
node --test extension/tests/auth-worker.test.js extension/tests/auth.test.js extension/tests/release.test.js
27 tests: 27 pass, 0 fail
```

Original candidate full extension observation (the fix rerun is recorded below after final verification):

```text
node --test extension/tests/*.test.js
80 tests: 68 pass, 12 fail
```

All 12 failures are pre-existing frozen-baseline mismatches outside this task: nine obsolete local-remix/language expectations in `options-language.test.js` against the already-accepted Popcorn cloud account page, plus three CommonJS export expectations in `settings.test.js` while the accepted root package is ESM. Neither test file, `options.html`, nor `settings.js` changed in Task 6. Task 6 focused tests and all affected auth/release regressions pass. The controller should decide whether to retire or rewrite those stale tests at the Batch A integration gate; doing so here would violate the allowlist.

Review fix 1 reran the full extension suite once:

```text
node --test extension/tests/*.test.js
86 tests: 74 pass, 12 fail
```

The six new concurrency/recovery regressions all pass. The failure set is exactly the same nine `options-language.test.js` and three `settings.test.js` baseline mismatches above; there is no new failure.

Syntax/diff verification:

```text
node --check extension/sync-queue.js
node --check extension/background.js
node --check extension/options.js
git diff --check
```

All exited 0. Per the risk-calibrated brief, no DB reset, pgTAP, production build, or lockfile operation was run.

## Restart, acknowledgement, owner, and budget evidence

- Enqueue reads the trusted service-worker session, stores the complete descriptor `{ownerUserId, clientEventId, input, attempts, nextAttemptAt}`, and only then attempts `POST /api/v1/extension/sync`.
- A fresh queue instance using the same `chrome.storage.local` state flushes the persisted descriptor, demonstrating that recovery does not depend on an open panel, long-lived port, interval, or in-memory queue state.
- A flush sends at most 50 raw inputs. It removes only successful results whose `clientEventId` matches an event selected for that batch. Missing, foreign, and retryable-error results remain with the original identity.
- Retries are deterministic exponential backoff from 30 seconds, with attempts capped at 32 and delay capped at one hour. The next alarm is recreated from persisted `nextAttemptAt`.
- Missing auth retains events and creates a retry alarm. A different signed-in account neither uploads nor discards the prior owner's events; its stale alarm is cleared until an auth/panel/startup/new-save trigger changes state.
- Recovery is independently wired for `runtime.onStartup`, `runtime.onInstalled`, the named retry alarm, exact Side Panel open, a new save, and successful interactive sign-in.
- Side Panel may enqueue all Task 5 saved inputs. A content script may enqueue only a `player_moment` whose video ID exactly matches both validated YouTube watch sender URLs. Queue contents, owner IDs, credentials, gateway configuration, and Provider responses are never returned to content scripts.
- Before every new descriptor write, the queue calls `chrome.storage.local.getBytesInUse("popcorn_pending_events")`. Each descriptor is limited to 64 KiB and the raw queue to 5 MB. A budget breach or storage quota exception returns `SYNC_QUEUE_FULL`; no event is silently removed.
- Options receives only bounded counts/timing state. Explicit discard derives the owner from the trusted service-worker session and deletes only that owner's pending descriptors.

## Upstream reuse and license

Pinned source: `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7` (MIT).

- Kept the pinned `background.js` storage access-level hardening (`TRUSTED_CONTEXTS`) and extended the existing classic MV3 `runtime.onMessage` router in place; no parallel worker or message bus was created.
- Kept the pinned synchronous `openSidePanel`/user-gesture path, `startDigestFromButton` broadcast, player metadata reader, and single service-worker ownership.
- Reused the pinned cache-management interaction structure already adapted as the options `Clear bounded cache` action. Pending descriptors remain under a separate key and the queue budget always fails closed rather than deleting them.
- Preserved all MIT notices and provenance files unchanged.

`nashsu/llm_wiki v0.6.9@723e259309aea5e3850265b631f80224f66dd9f6` was not copied. No GPLv3 code, tests, prompts, components, assets, names, or structure were used.

## Unresolved risks / controller decisions

- Following the controller's safety calibration after the implementation tool rejected irreversible local deletion, startup/install do not automatically delete or compress legacy `ytd_notes` or `digest_*` data. Existing data is preserved; the explicit options cache-clear action remains available. This is safer for personal data but is a documented deviation from the brief's automatic legacy migration wording and should be reviewed again at Delivery.
- Automatic display-cache eviction was likewise not added because it would silently delete local cache data. The raw queue has an independent budget and returns `SYNC_QUEUE_FULL`; a user can explicitly clear bounded display cache and retry. This preserves events but may require that one user action when total Chrome storage is already exhausted.
- Chrome UI/user-gesture behavior is covered by the existing VM regression, not a real-browser smoke. Batch A Task 7 should exercise actual Chrome worker termination, alarm restart, and the Side Panel save path.
- Serialization is per active service-worker instance because `chrome.storage.local` has no compare-and-swap primitive. Chrome MV3 runs one active instance of this service worker; a terminated instance cannot overlap its replacement. The reload regression creates a fresh queue instance against the same durable storage and flushes every event retained by concurrent enqueues. Task 7 should still exercise actual Chrome worker termination and rapid consecutive saves in the browser.
