# Structured Output Reliability Task 6 Handoff

## Scope

- Plan task: Task 6, YouTube Side Panel Partial Results and Honest Status.
- Execution baseline: `9bf8a2ad80c660a6fa76b90fdc7b059ed412301b`.
- Worktree: `/private/tmp/popcorn-structured-output-task-6`.
- Branch: `codex/structured-output-task-6`.
- Modified only the four allowed extension files plus this handoff.

## Implementation

- `background.js` now preserves only the allowlisted public
  `failureCategory` values and converts them to bounded user copy. Raw durable
  error codes and Provider text are never returned to the Side Panel.
- `sidepanel.js` maps `model_output`, `model_unavailable`, `internal`, and
  processing to distinct copy for Overview, Translation, and Explanation.
- Partial Translation rows continue to render immediately by stable ID. A
  missing row remains in the existing failed set; the next `Retry failed`
  action sends only the remaining stable IDs in one message.
- Overview and Explanation continue reading enriched domain fields. Tests add
  conflicting `sourceLineIndex`/model-owned selection fields and prove they do
  not replace `timestampSeconds`, `sourceSegmentIds`, or the selected evidence
  used by Save.
- All Popcorn API requests remain in `background.js`. Side Panel messages carry
  only video/snapshot/segment/evidence/retry identity; no gateway URL, model, or
  API key was added.

## TDD evidence

The isolated worktree intentionally has no installed dependencies. The first
plain command failed before test discovery with `Cannot find module 'jsdom'`.
Per controller approval, every Node test run used the controller worktree's
existing dependencies read-only:

```bash
NODE_PATH='/Users/liangjing/Desktop/Courses/internal capstone/Popcorn/node_modules' node --test extension/tests/translation.test.js extension/tests/save-payloads.test.js
```

- Baseline: 82/82 passed.
- RED round 1: 82/84 passed; the two intended failures proved that background
  discarded `failureCategory` and Translation displayed supplied raw error
  text.
- The partial-row/single-batch test was already GREEN at baseline and is kept
  as a characterization/regression boundary rather than forcing a rewrite.
- RED round 2: after temporarily restoring the old Overview/Explanation
  rendering paths, 84/87 passed; the three intended failures proved raw
  Overview and Explanation error exposure and non-standard processing copy.
- GREEN: 87/87 passed after the minimal status-copy changes.

Syntax checks run during implementation:

```bash
node --check extension/background.js
node --check extension/sidepanel.js
```

Both exited 0. Final fresh verification is recorded with the commit SHA below.

## Upstream and license

- Preserved the existing YouTube Digest extension architecture and MIT reuse
  attribution pinned to `zarazhangrui/youtube-digest` commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- Copied no code, tests, prompts, components, or assets from LLM Wiki v0.6.9 /
  commit `723e259309aea5e3850265b631f80224f66dd9f6` (GPLv3).

## Residual risks

- Failure copy exists at both the background security boundary and the Side
  Panel rendering boundary. The duplication is deliberate defense in depth;
  tests keep the wording/category behavior aligned.
- This task uses fixed Node/JSDOM fixtures only. It does not run a browser,
  server, database, real Provider, build, or full test suite, as required by
  the task brief.

The authoritative implementation commit SHA is returned to the controller with
this handoff.
