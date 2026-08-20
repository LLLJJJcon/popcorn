# Batch B controller promotion review fix 1

## Assignment

- Review repair for controller atomic practice promotion contract.
- Review baseline: `812067a`.
- Worktree: `/private/tmp/popcorn-promotion-contract-fix`.
- Original review result: FAIL because canonical attempt assertions omit the three
  English feedback fields even though the migration currently maps them correctly.

## Allowed files

- Modify: `supabase/tests/promote_practice_attempt.sql`
- Create: `docs/engineering/handoffs/batch-b/controller-practice-promotion-review-fix-1.md`

All other files are forbidden, including migrations, generated types, CI, root
configuration, lockfiles, application code, and the original handoff.

## Required TDD repair

1. Preserve distinct fixture values for `accuracy_feedback_english`,
   `naturalness_feedback_english`, and `contextual_fit_feedback_english`.
2. Before changing the test, create a temporary mutation of migration 012 that
   swaps or hard-codes at least one canonical feedback mapping. Apply the mutated
   migration to a disposable database/reset and prove the current focused pgTAP
   suite stays GREEN. Restore the migration without committing it.
3. Add all three feedback fields to the canonical attempt `results_eq` assertion.
4. Reapply the same temporary mutation and prove the focused suite is RED on the
   exact feedback assertion. Restore the migration, reset, and prove GREEN.
5. Do not add unrelated tests or hardening.

## Verification

```bash
./node_modules/.bin/supabase db reset --local
./node_modules/.bin/supabase test db supabase/tests/promote_practice_attempt.sql
git diff --check 812067a..HEAD
```

The implementation worktree has no local `node_modules`; use the integration
worktree binary at `/private/tmp/popcorn-youtube-learning/node_modules/.bin/supabase`.
Do not run full pgTAP, TypeScript, build, browser, or live Provider checks.

## Interfaces and license

- Consumes the exact staged evaluation fields and verifies their canonical copy.
- Produces test evidence only; no interface or runtime change.
- No YouTube Digest implementation applies.
- Copy no LLM Wiki GPLv3 code, tests, prompts, components, or assets.

## Handoff

Commit only the allowed files. Return commit SHA, mutation GREEN-before/RED-after,
final focused GREEN, diff check, risk, and handoff path. Independent re-review is
required.
