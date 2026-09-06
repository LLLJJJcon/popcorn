# Final release contract-test alignment

- Trigger: final `pnpm verify` at `a96edf151a8e3da660cd34588b756f64caffbc51` produced 3 failures in `tests/contract/shared-contracts.test.ts` while unit tests passed 397/397.
- Baseline: `a96edf151a8e3da660cd34588b756f64caffbc51`.
- Implementation worktree: `/Users/liangjing/Desktop/Courses/internal capstone/进度/.superpowers/sdd/final-contract-test-alignment/worktree`.

## Root cause

Commit `99a5272` deliberately changed `EvaluationResultSchema` from `EnglishTextSchema` to `PracticeFeedbackTextSchema`: Practice feedback must be nonblank, bounded, and contain at least one ASCII English letter, but may quote Chinese or otherwise contain non-Basic-Latin characters. The old table test still combined three distinct assertions and incorrectly expected the evaluation result to reject accented Spanish, Cyrillic, and Han. `EnglishTextSchema` and `CandidateExpressionSchema.englishExplanation` remain Basic-Latin-only and must continue rejecting those values.

## Allowed files

- `tests/contract/shared-contracts.test.ts`
- `docs/engineering/handoffs/delivery/final-contract-test-alignment.md`

## Forbidden scope

- Do not change production schemas, prompts, UI, routes, migrations, database, root configuration, package, lockfile, manuals, or generated files.
- Do not read or modify `.env.local`; do not include any secrets.
- Do not weaken the Basic-Latin contract for `EnglishTextSchema` or candidate English explanations.

## TDD and verification

1. Reproduce RED with the focused failing test and record the 3 expected failures.
2. Make the minimum test-only change that separates unchanged Basic-Latin assertions from the new Practice feedback contract.
3. Assert that mixed Practice feedback containing ASCII English plus accented, Cyrillic, or Han quoted content is accepted byte-for-byte.
4. Assert separately that feedback without any ASCII English letter is rejected.
5. Run the focused contract file, full contract suite, and `git diff --check`.
6. Commit only the allowed files and record the implementation SHA in the handoff.

No upstream reuse is involved. MIT remains unchanged; no GPLv3 material may be copied.
