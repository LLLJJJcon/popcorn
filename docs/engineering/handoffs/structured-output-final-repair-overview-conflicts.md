# Structured Output Final Repair C — Handoff

## Scope

- Execution baseline: `4c8ea39bdf861271098606b1274257c5a69b0d38`
- Changed only the Overview wire normalizer, its focused prompt-contract test,
  and this handoff.
- No database, public/domain artifact, prompt version, enrichment, extension,
  Provider, or consumer contract changed.

## Behavior

- Valid Overview chapters and key quotes are normalized before comparison.
- Within each member family, exact semantic duplicates at one
  `sourceLineIndex` collapse to one result.
- Within each member family, any semantic conflict at one index removes all
  members at that index.
- Chapter and key-quote indexes are tracked independently.
- Invalid optional members do not poison a later valid member at the same
  index.
- The 8-chapter and 5-key-quote bounds are applied after the full conflict
  pass, preventing early duplicates or conflicts from crowding out later
  valid unique members.

## TDD Evidence

RED (using the controller's locked Vitest binary with this worktree as cwd):

```text
node_modules/.bin/vitest run src/server/ai/prompts/learning-artifact-wire.test.ts
Test Files  1 failed (1)
Tests       4 failed | 5 passed (9)
```

All four failures were the intended old behavior: duplicate members remained,
conflicting members remained, and pre-resolution limits crowded out later
valid members. No production code had been changed before this run.

GREEN:

```text
node_modules/.bin/vitest run src/server/ai/prompts/learning-artifact-wire.test.ts
Test Files  1 passed (1)
Tests       9 passed (9)
```

Typecheck (using the controller's locked TypeScript binary with this worktree
as cwd):

```text
node_modules/.bin/tsc --noEmit
exit 0
```

The worktree initially lacked `node_modules`; a local ignored dependency view
was pointed at the controller's already-installed locked packages. No package
was installed and no lockfile was changed.

## Risks and Licensing

- Optional members with the same source index but any different normalized
  semantic field are intentionally all discarded; this is fail-closed and may
  reduce optional Overview detail while preserving the required overview.
- Input order remains the output order for retained first occurrences.
- No upstream code was required. The existing YouTube Digest MIT pin remains
  unchanged, and no GPLv3 LLM Wiki code, prompt, tests, components, or assets
  were copied.
