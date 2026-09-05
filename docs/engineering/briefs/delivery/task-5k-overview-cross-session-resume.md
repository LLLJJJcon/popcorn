# Delivery Task 5K — Overview cross-session durable resume

## Identity

- Plan: revised local-first Delivery live-smoke recovery.
- Task: 5K — Overview cross-session durable resume.
- Baseline commit: `ca73c4b89974cce5e3e9f56ed3333da3311e183a`.
- Worktree: `/Users/liangjing/Desktop/Courses/internal capstone/Popcorn-overview-resume`.
- Branch: `codex/popcorn-overview-resume`.

## Confirmed evidence

The latest explicit retry job `2de013f3-af5a-4251-bab0-b7f0235aad3c`
remained `leased` while the side panel displayed the old terminal failure and
re-enabled Retry. Current `overviewRequest` persistence is JavaScript memory
only. Closing/recreating the Chrome Side Panel loses its retryId/jobId; the next
Overview request uses the original no-retry semantic key and receives the old
terminal result even though the explicit retry job is still running.

## Required behavior

1. Persist at most one bounded Overview resume record in
   `chrome.storage.local` under a versioned Popcorn-owned key. The only allowed
   fields are current YouTube `videoId`, transcript `snapshotId`, optional UUID
   `retryId`, and optional UUID `jobId`. Persist no transcript/content, user
   profile, gateway URL/model/key, Provider input/output, or error detail.
2. An explicit Retry must persist its UUID identity before registering the
   request. A pending registration/poll must persist the returned jobId.
3. After the Side Panel is destroyed and recreated, entering Overview for the
   exact same videoId plus snapshotId resumes the stored jobId/retryId through
   the existing `requestOverview` message. It must not register a new retry or
   create extra Provider work.
4. A record for another video or snapshot is ignored. Malformed/unbounded
   records fail closed and are removed. The authenticated server remains the
   owner boundary; a status miss/auth failure exposes no cross-user data.
5. Clear only the matching record after current-owner success or terminal
   failure. Do not clear it on pending, Side Panel destruction, stale-video
   completion, or the 60-second polling window ending.
6. Preserve the existing in-memory generation/video/snapshot fence, Retry
   button single-click semantics, progress copy, fixed background/API route,
   and durable queue/backoff. Do not add model calls or auto-retries.

## File ownership

Allowed:

- `extension/sidepanel.js`
- `extension/background.js`
- `extension/tests/translation.test.js`
- `docs/engineering/handoffs/delivery/task-5k-overview-cross-session-resume.md`

Forbidden:

- server/provider/prompt/API/auth code;
- database/migrations/contracts/generated types;
- HTML/CSS, root config, dependencies, lockfile, other product areas.

## Interfaces

Consumes existing `triggerAnalysis`, `retryOverview`, `sendCloudAction`,
`requestOverview`, `overviewGeneration`, video/snapshot ownership fence, and
Promise-based `chrome.storage.local` APIs.

Produces a small validated cross-Side-Panel resume record only. The existing
background continues to poll the owner-scoped server job.

Controller ruling after review: the pre-existing background response does not
distinguish a terminal owner-scoped job result from transport/auth/transient
failure, so the Side Panel cannot obey the clear-only-on-terminal requirement
without guessing from display text. `extension/background.js` is therefore
allowed to add one bounded boolean `terminal: true` only when its authenticated
job-status response proves the job is terminal. It must not expose job input,
Provider details, owner IDs, credentials, or raw server errors. All transient
and transport failures omit/false this marker.

## Required RED/GREEN tests

Before implementation, add deterministic tests that fail against the current
memory-only behavior and prove:

1. a pending explicit retry persists retryId and jobId; a newly constructed
   Side Panel with the same storage resumes both and success clears the record;
2. a pending original Overview without retryId persists/resumes its jobId;
3. a 60-second pending result and Side Panel destruction do not clear storage;
4. cross-video/snapshot and malformed records are ignored/removed without UI
   contamination or extra retry UUID;
5. stale response cannot clear a newer matching record; terminal current-owner
   failure clears only its matching record.

Record actual RED output, make the minimum implementation, and record GREEN.

## Verification

```text
node --test extension/tests/translation.test.js
node --check extension/sidepanel.js
git diff --check ca73c4b89974cce5e3e9f56ed3333da3311e183a..HEAD
```

## Upstream and license

- Reuse the existing YouTube Digest-derived Side Panel path in place from
  `zarazhangrui/youtube-digest` commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; do not create a parallel client.
- Copy no GPLv3 code, tests, prompt, component, or asset from `nashsu/llm_wiki`
  v0.6.9 commit `723e259309aea5e3850265b631f80224f66dd9f6`.
- Add no dependency; preserve MIT/upstream notices.

## Handoff

Commit only this task and write the report to
`docs/engineering/handoffs/delivery/task-5k-overview-cross-session-resume.md`.
Return status, commit SHA, RED/GREEN evidence, verification, and risks.
