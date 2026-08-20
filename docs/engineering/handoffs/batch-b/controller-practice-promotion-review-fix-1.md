# Batch B controller handoff — promotion review fix 1

## Scope

- Review baseline: `812067a`
- Brief commit: `59ee445`
- Worktree: `/private/tmp/popcorn-promotion-contract-fix`
- Changed only `supabase/tests/promote_practice_attempt.sql` and this handoff.
- No migration or runtime interface change.
- No YouTube Digest code applies. No LLM Wiki GPLv3 code, tests, prompts,
  components, or assets were copied.

## Repair

The existing staged-attempt fixture already uses three distinct English feedback
values. The canonical `public.attempts` assertion now checks all three fields:

- `accuracy_feedback_english = 'Accurate use.'`
- `naturalness_feedback_english = 'Natural response.'`
- `contextual_fit_feedback_english = 'Fits the situation.'`

This protects the exact staged-to-canonical feedback mapping without adding a new
test case or changing production behavior.

## Mutation TDD evidence

Before the test change, migration 012 was temporarily changed so canonical
`accuracy_feedback_english` received staged `naturalness_feedback_english`.
After a disposable local reset, the existing focused suite remained GREEN:

```text
Files=1, Tests=37
Result: PASS
```

After adding the three canonical feedback assertions, the identical temporary
mutation produced the intended RED:

```text
Failed test 11: canonical attempt copies scores, English feedback, timestamps,
assistance, and non-secret evaluation provenance
have: accuracy feedback "Natural response."
want: accuracy feedback "Accurate use."
Failed 1/37 subtests
Result: FAIL
```

The temporary migration mutation was then restored and is absent from the diff.

## Final verification

- Clean local database reset with migrations 001–012 and seed: PASS.
- Focused `promote_practice_attempt.sql`: 37/37, PASS.
- `git diff --check`: PASS.
- Migration 012 diff: empty.

Per the repair brief, full pgTAP, TypeScript, build, browser, and live Provider
checks were intentionally not run.

## Risk

- This is test-only strengthening; runtime risk is unchanged.
- The assertion now detects swapping or hard-coding any of the three canonical
  English feedback fields because their fixture values are distinct.
- Independent read-only re-review is still required before integration.
