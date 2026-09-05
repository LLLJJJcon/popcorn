# Structured Output Task 5 — Review Repair Brief

- Parent task: `docs/superpowers/plans/2026-09-06-popcorn-structured-output-reliability.md`, Task 5.
- Parent execution baseline: `26c5eb36856a1e31f8c3392348b8e56a948b8b92`.
- Parent implementation: `69f10a7c823bced6b4416e53e4bfecb0163d2aae`.
- Repair worktree: `/private/tmp/popcorn-structured-output-task-5-repair`.
- Repair branch: `codex/structured-output-task-5-repair`.
- Repair execution baseline: the controller commit adding this brief.

## Sole Important finding

`tests/integration/youtube/learning-artifacts.test.ts` currently gives the
unknown Translation `promptVersion` fixture an unrelated invalid `resultKey`.
The assertion can pass even if production ignores `prompt_version`.

Make the fixture's result key equal to the current request's correctly computed
frozen result key and leave the unknown prompt version as the only mismatch.
Assert the precise safe grounding rejection and zero Provider/publication side
effects. Prove the repaired test is behavior-sensitive by temporarily mutating
the production Translation recovery check to ignore `prompt_version`, running
the focused test to obtain RED, then restoring production unchanged and running
GREEN. Do not commit the mutation.

## Allowed files

- `tests/integration/youtube/learning-artifacts.test.ts`
- `docs/engineering/handoffs/structured-output-task-5-review-repair.md`

No production file is expected to change. All other files are forbidden,
including prompts, contracts, migrations, generated types, configuration,
dependencies, lockfile, UI/extension, and ledger.

## Verification

```bash
pnpm exec vitest run tests/integration/youtube/learning-artifacts.test.ts
git diff --check <parent-implementation>..HEAD
git status --short
```

Do not run the full suite, database, browser, network, or real Provider. Commit
the test correction and handoff, return SHA, mutation RED, GREEN, risk, and clean
status. Do not merge, rebase, or push.

The upstream/license boundary is unchanged: YouTube Digest MIT pin
`d03e1f61e017b032159ffd1821cac6e7693ce0c7`; LLM Wiki GPLv3 pin
`723e259309aea5e3850265b631f80224f66dd9f6` is method-only and no code, tests,
prompts, components, or assets may be copied.
