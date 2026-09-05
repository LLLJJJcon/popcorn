# Delivery Task 5K — Overview cross-session durable resume

## Outcome

The Side Panel now keeps one strictly validated, Popcorn-owned
`chrome.storage.local` resume record at `popcorn:overview-resume:v1`. It holds
only the current YouTube `videoId`, transcript `snapshotId`, and optional UUID
`retryId` / UUID `jobId`.

- Explicit retry saves its UUID before the request is registered; a pending
  response updates the same record with its job UUID.
- A recreated Side Panel restores only a record with the exact current
  video/snapshot pair and sends that identity through the existing
  `requestOverview` action.
- Malformed records are removed; another video's valid record is ignored.
- Only a current terminal success or failure clears an exactly matching
  record. Pending, stale, and destroyed-panel paths retain it.
- The server remains the owner boundary. The client persists no transcript,
  content, profile, endpoint/configuration, Provider material, or error data,
  and creates no automatic retry or Provider work.

## TDD evidence

RED was run before the implementation with:

```text
node --test extension/tests/translation.test.js
tests 54; pass 49; fail 5
```

The five new deterministic failures covered explicit retry recreation,
original-job recreation, pending/destroy retention, mismatched and malformed
records, and stale/current terminal clearing.

GREEN after the minimum implementation:

```text
node --test extension/tests/translation.test.js
tests 54; pass 54; fail 0
```

Additional final checks:

```text
node --check extension/sidepanel.js
git diff --check
```

Both exited successfully.

## Scope and review notes

- Changed only `extension/sidepanel.js`,
  `extension/tests/translation.test.js`, and this handoff.
- Verified the local job contract exposes Popcorn UUID job IDs; no server,
  background, route, Provider, database, dependency, HTML, or CSS files were
  changed.
- No GPLv3 source, test, prompt, component, or asset was copied; the existing
  YouTube Digest-derived Side Panel path and notices remain in place.

## Residual risk

`chrome.storage.local` failures deliberately leave the authenticated server job
authoritative and do not create retries. In that browser-level failure case a
later recreated Side Panel cannot resume client-side, but it also cannot expose
another user's data or create extra Provider work.

## Fix round 1 — review findings

### Changes

1. `sendCloudAction` now accepts an optional pending hook. Overview supplies a
   hook that records each pending job UUID before the next 500 ms poll delay,
   including the first registration response. The deterministic test observes
   storage before the delay callback is released and then simulates Side Panel
   destruction.
2. Resume writes return a boolean. An explicit retry whose UUID cannot be
   stored fails closed before `requestOverview` is sent, re-enables Retry, and
   shows a bounded retry-state error.
3. The background returns `terminal: true` only for an authenticated
   `terminal_failed` job status. The Side Panel clears a matching record for
   success or that explicit marker only; transient failures, auth/transport
   failures, and thrown requests retain it.
4. Resume loading captures generation, video, snapshot, and request ownership
   before awaiting storage, and verifies the same owner again before assigning
   `overviewRequest` or sending any request.

### TDD evidence

Focused RED runs before the fix failed for each review condition:

- first pending poll left the resume key unset before its delay;
- rejected retry storage still produced one registration message;
- a delayed A-side read emitted an extra A request after B started;
- terminal marker behavior was absent in the background; and
- a current non-terminal/throwing failure cleared its matching record.

GREEN after the minimal fix:

```text
node --test extension/tests/translation.test.js
tests 58; pass 58; fail 0
```

Final checks also passed:

```text
node --check extension/sidepanel.js
node --check extension/background.js
git diff --check ca73c4b89974cce5e3e9f56ed3333da3311e183a..HEAD
```

### Residual risk

If browser storage becomes unavailable after a job has already been registered,
the owner-scoped server job continues but client recovery cannot be durable.
The explicit pre-registration path is fail-closed, and no storage or background
response includes user, Provider, gateway, transcript, or error-detail data.
