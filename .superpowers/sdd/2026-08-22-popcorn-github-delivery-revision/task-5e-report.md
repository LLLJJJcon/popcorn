# Task 5E report — whole-failure transcript retry

## Scope

- Baseline: `f559af0efb574149c2826e28d8477ba95f8c8435`
- Implementation commit: `948d551`
- No database, migration, generated type, cache, queue/backoff, prompt wording, model-gateway settings, or deployment change was made.
- The untracked worktree-local `node_modules` symlink was used for checks and was not staged.

## RED evidence

Before production edits, these focused tests were added and run:

```text
node --test extension/tests/translation.test.js
```

This exited nonzero with four expected failures: no header retry action, no `retryFailedTranslations` handler for a five-row single-message retry, no stale/partial-result handler, and no `retryId` in the background payload.

```text
CI=true /private/tmp/popcorn-youtube-learning/node_modules/.bin/vitest run tests/integration/youtube/learning-artifacts.test.ts tests/integration/model-gateway/runtime-resolver.test.ts
```

This exited nonzero with three expected failures: two Provider/schema tests rejected a five-row structured group with `PROVIDER_OUTPUT_INVALID`, and the route rejected the retry UUID payload with HTTP 400.

An additional focused RED check confirmed the header count bug during individual retry:

```text
node --test extension/tests/translation.test.js
```

It exited nonzero with `Retry failed (2)` where `Retry failed (1)` was required.

## GREEN evidence

The required focused commands were re-run after the final implementation:

```text
node --test extension/tests/translation.test.js
```

Exited 0: 29 passing tests.

```text
CI=true /private/tmp/popcorn-youtube-learning/node_modules/.bin/vitest run tests/integration/youtube/learning-artifacts.test.ts tests/integration/model-gateway/runtime-resolver.test.ts
```

Exited 0: 72 passing tests in 2 files.

```text
/private/tmp/popcorn-youtube-learning/node_modules/.bin/tsc --noEmit
```

Exited 0.

```text
/private/tmp/popcorn-youtube-learning/node_modules/.bin/eslint extension/sidepanel.js extension/background.js extension/tests/translation.test.js src/server/ai/provider.ts src/server/ai/openai-compatible-provider.ts src/server/ai/prompts/translate-segments.v1.ts tests/integration/youtube/learning-artifacts.test.ts tests/integration/model-gateway/runtime-resolver.test.ts
```

Exited 0. It reports three existing configuration warnings that the extension files are ignored by the repository ESLint pattern; no lint errors were emitted by the command.

```text
node --check extension/sidepanel.js
node --check extension/background.js
```

Both exited 0.

```text
git diff --check f559af0..HEAD
```

Run after the documentation commit below.

## Residual risk

The new retry deliberately remains one bounded request/job/Provider call. A transcript whose all failed rows exceed an existing route or Provider byte limit remains explicitly failed for retry rather than being split, preserving the specified safety boundary.
