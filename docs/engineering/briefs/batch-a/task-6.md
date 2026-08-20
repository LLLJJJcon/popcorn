# Batch A Task 6 Brief — Durable Bounded Extension Sync Queue

## Task, baseline, and isolated workspace

- Canonical plan/task: `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 6.
- Integration baseline: `0449cc7` (accepted Batch A Task 3 plus ledger checkpoint).
- Worktree: `/private/tmp/popcorn-batch-a-6`.
- Branch: `codex/popcorn-batch-a-6`.
- Parallel Task 5 owns `content.js`, `sidepanel.*`, and its tests. Do not edit those files.

Implement only this numbered task. Start with failing tests and preserve RED output, make the minimum implementation, preserve GREEN output, commit it, and write the handoff named below.

## Allowed files

- `extension/sync-queue.js` (create)
- `extension/background.js`
- `extension/options.js`
- `extension/manifest.json`
- `extension/tests/sync-queue.test.js` (create)
- `extension/tests/worker-restart.test.js` (create)
- `docs/engineering/handoffs/batch-a/task-6.md` (create)

Every other file is forbidden, including `content.js`, `sidepanel.*`, auth/session modules, contracts, migrations, generated types, server code, root configuration, lockfile, plans/specs, upstream notices/licenses, and the execution ledger.

## Frozen interfaces consumed

- Task 1 trusted session API and owner identity; never expose session tokens to content scripts.
- Task 4 authenticated `POST /api/v1/extension/sync`, bounded to 50 events and returning one explicit result per `clientEventId`.
- Task 5 will call `enqueueSavedItem(input)`; do not depend on Task 5 implementation files or create a UI save path.
- Existing `background.js` exact sender validation, `openSidePanel` synchronous user-gesture behavior, authenticated `apiFetch`, Provider-neutral learning-artifact routing, and Task 3 short polling must remain intact.

## Interfaces produced

- `enqueueSavedItem(input)`.
- `flushPendingEvents(trigger)`.
- `getSyncSummary()`.
- `discardPendingEvents(ownerUserId)`.
- Storage-first owner-bound events shaped as `{ownerUserId, clientEventId, input, attempts, nextAttemptAt}`.
- Event-driven recovery on startup, install, alarm, panel-open message, new save, and regained authentication; no correctness dependency on module globals, `setInterval`, a long-lived port, or an open panel.

## Mandatory RED evidence

Before implementation, add tests and run:

```bash
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
```

Expected RED: modules/APIs and restart recovery do not exist.

Tests must prove at least:

1. Enqueue persists the complete bounded owner/event descriptor before the first network call; a service-worker module reload can still flush it.
2. Only explicitly acknowledged matching `clientEventId` values are removed; duplicate flush and partial batch success preserve unacknowledged events without duplicating acknowledged saves.
3. Expired/missing auth retains events and schedules retry; a new different account cannot upload or discard the prior owner's events.
4. `onStartup`, `onInstalled`, retry alarm, panel-open, and new-save triggers use independent flushes; startup recreates the next needed alarm.
5. Queue capacity uses `chrome.storage.local.getBytesInUse()` before writes, prioritizes queued raw events over expendable display cache, returns `SYNC_QUEUE_FULL` if it still cannot fit, and never silently deletes an event.
6. Retry attempts and `nextAttemptAt` are bounded/deterministic under the frozen queue policy; no `setInterval` or worker-lifetime correctness assumption exists.
7. Messages are accepted only from the existing trusted extension contexts; content scripts cannot read queue contents, owner IDs beyond necessary result state, tokens, API keys, gateway configuration, or Provider responses.
8. The manifest retains minimum Chrome 116, `alarms`, trusted storage/identity boundaries, exact host permissions, and does not request `unlimitedStorage` or Provider hosts.
9. Retired `ytd_notes` and persisted full transcript cache are removed/migrated without losing pending event descriptors; discard is explicit and owner-bound.
10. Existing auth refresh serialization, exact YouTube `openSidePanel` sender/user-gesture path, and learning-artifact routes remain regression-covered.

## Upstream reuse and license

Pinned MIT upstream: `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`.

Adapt in place:

- Chrome storage access-level hardening and message router in `extension/background.js`;
- upstream cache-eviction structure from `background.js`/`sidepanel.js` (consume the method, but Task 6 must not edit `sidepanel.js`);
- existing options sync status/discard interactions in `extension/options.js`.

Replace permanent local notes and full-transcript persistence with owner-bound event descriptors plus a byte-budgeted display cache. Do not create a parallel service worker or message bus. Preserve MIT notices unchanged.

`nashsu/llm_wiki` `v0.6.9@723e259309aea5e3850265b631f80224f66dd9f6` is GPLv3 and method-only inspiration. Copy no GPL code, tests, prompts, components, assets, names, or structure.

## GREEN and verification

```bash
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
node --test extension/tests/auth.test.js extension/tests/release.test.js extension/tests/options-language.test.js extension/tests/settings.test.js
node --test extension/tests/*.test.js
git diff --check
git status --short
```

Use focused tests during implementation. Do not run DB reset, pgTAP, or production build: this task changes extension queue/runtime code only. The controller will run one broader integration gate after Tasks 5 and 6 are accepted.

Commit message: `feat: add durable extension save synchronization`.

Handoff must report baseline/head, changed files, RED/GREEN commands and counts, restart/owner/budget evidence, exact upstream methods reused and how, license statement, unresolved risks, and path `docs/engineering/handoffs/batch-a/task-6.md`. Return the commit SHA and do not self-approve.
