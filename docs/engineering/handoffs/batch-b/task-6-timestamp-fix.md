# Batch B Task 6 — PostgREST timestamp promotion fix handoff

## Scope

- Baseline: `50bd6b1`
- Branch: `codex/popcorn-batch-b-6-timestamp-fix`
- Worktree: `/private/tmp/popcorn-batch-b-6-timestamp-fix`
- Production change: canonicalize a persisted, explicitly offset ISO instant at
  the promotion boundary before passing it to the unchanged deterministic review
  scheduler.

No schedule algorithm, repository/RPC mapping, route, migration, UI, root
configuration, Provider/gateway code, or Task 6 E2E/AI test was changed.

## TDD evidence

### RED

Command:

```bash
./node_modules/.bin/vitest run tests/integration/learning-loop/record-valid-attempt.test.ts
```

Observed before the production change:

- 1 test file failed.
- 1 of 8 tests failed and 7 passed.
- The new PostgREST case `2026-08-20T22:35:31.562+00:00` rejected with
  `RangeError: now must be a valid ISO 8601 UTC instant` before the promotion
  repository call.

### GREEN

After the minimal boundary fix, the same command passed 1 file and all 8 tests.
The regression test proves the repository receives:

- the same user, attempt, and normalized expression fields;
- `intervalDays: 1`;
- `dueAt: 2026-08-21T22:35:31.562Z`, exactly one day after the persisted instant.

Separate cases prove invalid and timezone-less persisted values still reject
before promotion.

## Verification

The final pre-commit verification commands were:

```bash
./node_modules/.bin/vitest run tests/integration/learning-loop/record-valid-attempt.test.ts
./node_modules/.bin/tsc --noEmit --pretty false
git diff --check
```

All exited successfully. The candidate commit is the commit containing this
handoff; use `git rev-parse HEAD` after checkout for its exact SHA.

## License and provenance

No upstream implementation or dependency was used. No YouTube Digest code was
applicable, and no LLM Wiki GPLv3 code, tests, prompts, components, assets, or
wording was copied.

## Residual risk

- The focused task does not rerun the full browser scenario; the parent Task 6
  gate must rerun it after integration.
- Canonicalization intentionally relies on the JavaScript runtime's ISO parser
  only after requiring an explicit `Z` or numeric offset. Invalid and
  timezone-less inputs remain rejected.
