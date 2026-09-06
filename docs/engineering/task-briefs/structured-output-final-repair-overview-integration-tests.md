# Final Repair C — Overview Integration Fixture Alignment

- Trigger: controller focused gate after accepted Overview conflict semantics.
- Baseline: controller commit containing this brief; record exact SHA.
- Worktree: `/private/tmp/popcorn-structured-output-final-overview-tests`.
- Branch: `codex/structured-output-final-overview-tests`.

## Failure and required correction

`tests/integration/youtube/learning-artifacts.test.ts` has three pre-existing
fixtures that put different same-family key quotes on one `sourceLineIndex` and
expect all to survive. The accepted Overview normalizer now correctly drops that
conflicting group, so these unrelated tests fail.

Make test-only corrections:

- multiline encoding test: explicitly expect the two conflicting index-0 quotes
  to be absent while the unique index-1 quote remains; retain all prompt
  losslessness assertions;
- optional-item grounding test: move the deliberately ungrounded syntactically
  valid quote to a different valid index, so it is removed by grounding and does
  not conflict with the valid quote under test;
- timeout-budget test: use a non-conflicting Overview response/expected value so
  it tests timeout budgets rather than conflict resolution.

Do not weaken conflict rules, delete assertions, or change production code.

## Allowed files

- `tests/integration/youtube/learning-artifacts.test.ts`
- `docs/engineering/handoffs/structured-output-final-repair-overview-integration-tests.md`

All other files are forbidden.

## Verification

The current three failures are RED evidence. Run only:

```bash
pnpm exec vitest run tests/integration/youtube/learning-artifacts.test.ts
git diff --check <baseline>..HEAD
git status --short
```

Expected GREEN 103/103 on the current combined branch. No full suite/typecheck
required for test-only fixture data, and no browser/DB/Provider. Commit + handoff,
return SHA/RED/GREEN/clean. No merge/rebase/push; preserve MIT/GPL boundaries.
