# Structured Output Final Repair B Handoff — Explanation Recovery

## Scope

- Finding: final structured-output review Important 2.
- Execution baseline: `4c8ea39bdf861271098606b1274257c5a69b0d38`.
- Worktree: `/private/tmp/popcorn-structured-output-final-explanation`.
- Branch: `codex/structured-output-final-explanation`.
- Modified only the five allowed implementation/test files plus this handoff.

## Root cause and implementation

- Explanation was the only learning-artifact request that rejected `retryId`.
  Its registration dedupe payload therefore could not escape an exhausted job.
  The request now accepts one optional UUID and includes it only in the result
  key; the private Provider input and enriched Explanation content are unchanged.
- The shared route previously returned every non-ready registration as generic
  HTTP 202. A terminal registration now reads the exact owner-scoped durable job
  through the existing public failure-category seam and returns only `jobId`,
  `terminal_failed`, and `model_output | model_unavailable | internal`.
- `background.js` forwards only the allowlisted Explanation retry UUID, maps a
  terminal registration to bounded public recovery copy, and continues to own
  every authenticated Popcorn API request.
- The Side Panel captures the first admitted `jobId` and resubmits only that ID
  on each bounded poll. Closing the modal, replacing it, or changing the active
  video/snapshot prevents another poll and stale rendering.
- A terminal Explanation renders one explicit Retry. A click disables the
  action synchronously, creates one fresh `crypto.randomUUID()`, omits the old
  job ID, and polls the newly admitted job. There is no automatic fresh retry.
- Ready rendering still consumes the existing enriched fields (`meaning`,
  `tone`, `communicativeFunction`, `contextualFit`) and the existing Save
  builder. No prompt, handler, route file, migration, wire schema, domain result,
  or save payload changed.

## TDD evidence

- Server RED: the existing 100 tests passed while the two new behaviors failed:
  retry submissions were rejected with 400 and terminal registration returned
  202. A later adapter mutation check failed exactly because an owner-scoped
  `PROVIDER_OUTPUT_INVALID` category returned `null`.
- Extension RED: the existing 66 tests passed while six new tests failed for
  missing retry forwarding, terminal admission mapping, exact-job polling,
  close/owner cancellation, and terminal Retry UI.
- Final focused verification commands and counts are recorded in the controller
  handoff message. The isolated worktree uses the controller worktree's existing
  dependency installation; no dependency or lockfile was changed.

## Upstream and license

- Preserved the existing YouTube Digest MV3 structure and MIT reuse pinned to
  `zarazhangrui/youtube-digest` commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- Copied no GPLv3 LLM Wiki code, tests, prompts, components, or assets from
  `723e259309aea5e3850265b631f80224f66dd9f6`.

## Residual risks

- Poll cancellation cannot abort a Chrome message already in flight; it does
  prevent every subsequent poll and ignores the late result. The loop remains
  bounded to the existing 60-second window.
- Verification is intentionally limited to the server integration file,
  extension Translation/Explanation Node tests, syntax checks, TypeScript, and
  range diff. No full suite, build, browser, database, or real Provider runs.

The authoritative implementation commit SHA is returned to the controller with
this handoff.
