# Structured Output Task 7 — Review Repair Handoff

- Parent baseline: `9bf8a2ad80c660a6fa76b90fdc7b059ed412301b`
- Parent implementation: `789c787338189a950e192cdce101e469dfc64fe4`
- Repair baseline: `69400bb7ce55a8743cd94b9b7e96cc17ec22b62a`
- Original replay: `5161506c8ded77a0560a6e369e1bbfabcbeb431c`
- Scope: the five files allowed by the repair brief; no CSS, server, API contract, dependency, or lockfile changes.

## Repairs

1. Candidate recovery now starts independent 60-second and 5-minute wall-clock deadlines as soon as a processing response is accepted. The 60-second deadline changes the copy even if the GET is unresolved. The 5-minute deadline clears cadence, aborts the active GET, and enables manual status checking. Ready, gateway, terminal, error, restart, and unmount paths share timer cleanup.
2. Saved candidate analysis and persisted overview selection now scan newest-to-oldest and choose the first exact readable prompt version whose current domain schema validates. Newer unknown or corrupt artifacts remain private and cannot hide an older valid artifact.
3. POST and GET processing responses now accept only `pending | leased`. Existing `queued` test fixtures were corrected to the frozen server vocabulary; unknown statuses fail closed into the existing safe retry UI.

## RED evidence

Command:

```bash
./node_modules/.bin/vitest run --configLoader runner \
  src/features/saved/candidate-list.test.tsx \
  src/features/saved/saved-video-detail.test.tsx
```

Before production changes: 6 expected failures and 22 passes. The failures covered candidate fallback, overview fallback, a permanently pending GET, a delayed GET, unknown POST status, and unknown GET status.

## GREEN evidence

- Artifact fallback tests: 2 passed.
- Unknown processing status tests: 2 passed.
- Independent deadline tests: 2 passed.
- Final focused verification: 2 files, 28 tests passed.
- `./node_modules/.bin/tsc --noEmit --pretty false`: exit 0; no new errors (and no remaining errors in this replay worktree).
- `git diff --check 5161506c8ded77a0560a6e369e1bbfabcbeb431c`: exit 0.

The worktree uses a temporary untracked `node_modules` symlink to the controller's locked dependencies solely for verification. It is removed before handoff and is not committed.

## Risks

- Artifact ordering continues the pre-existing repository contract that the artifact array is chronological, so reverse iteration means newest-to-oldest.
- Manual status checking is intentionally user-triggered after five minutes; it does not restart automatic polling.
- No GPLv3 implementation, prompt, test, component, or asset was copied. The LLM Wiki pin remains method-only, and no YouTube Digest code was needed.
