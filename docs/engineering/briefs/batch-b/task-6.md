# Batch B Task 6 — complete Saved-to-Practice gate

## Assignment

- Plan: `docs/superpowers/plans/2026-08-16-popcorn-batch-b-learning-loop.md`
- Task: 6, **Prove the complete Saved-to-Practice loop**.
- Baseline: `5ad81925310dd2fb1df80bf659a5b89b1b25985a`.
- Branch: `codex/popcorn-youtube-learning`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- Executor: main Implementation Controller, as required by the fixed Batch B schedule.

Use strict RED/GREEN TDD. This task is a Batch exit gate, so run the written broad
gate once after the focused tests are green. Use fixed fixtures only; never call a
live Provider.

## Allowed files

Create:

- `tests/e2e/saved-learning-loop.spec.ts`
- `tests/contract/ai/saved-analysis.test.ts`
- `src/app/(app)/layout.tsx`
- `docs/engineering/handoffs/batch-b/task-6.md`

Modify:

- `playwright.config.ts` only to make the planned web E2E spec runnable while
  preserving the existing Chromium extension project.
- `docs/engineering/execution-ledger.md` only after independent review and all
  Batch B gates pass.

All other files are forbidden. In particular, do not modify migrations, generated
database types, shared contracts, application services/repositories, prompts,
Provider transport, gateway/Vault code, root package metadata, lockfile, CI,
extension implementation, or existing feature pages/components.

## Interfaces consumed and produced

Consume the accepted Tasks 1–5 interfaces without duplicating them:

- `createAnalyzeSavedItemFixtureGateway`, `buildAnalyzeSavedItemPrompt`, and
  `validateSavedItemAnalysisContent` for deterministic candidate generation and
  exact persisted-evidence validation;
- authenticated Saved/Home query and candidate-selection routes;
- fixture-only activation/evaluation, append-only revision, CONTRACT-013 atomic
  promotion, Vault, and due-Practice reads.

Produce only the integration proof:

`saved item -> organized candidate -> original response -> evaluation -> tried -> due Practice`

and the five-item app navigation: `Home`, `Saved`, `Practice`, `Vault`, `Progress`.
The Progress link may target the Batch C route before that page exists; this task
must not implement Progress.

## Required RED evidence

- AI contract matrix fails before the new test exists/behaviors are wired.
- The planned web E2E is not discoverable under the extension-only Playwright
  configuration and the app group has no shared five-item navigation.
- Record exact failing commands/output in the handoff without copying large logs.

## AI fixture contract

Exercise the real prompt/fixture/domain validator with fixed native Simplified
Chinese segments for:

- informal reaction;
- polite request;
- disagreement;
- online slang;
- register ambiguity.

Also prove malformed structured output fails and a candidate whose evidence text
is not present in the referenced persisted segment fails. Tests must not introduce
a parallel parser, prompt, or model implementation.

## Browser scenario

Use the local Supabase seed user and deterministic service-role test setup/cleanup.
Authenticate the browser through the real Supabase SSR cookie format. Create one
video with an actionable saved item and one ignored saved item plus a fixed
`saved_item_analysis` artifact; do not invoke the worker or any Provider.

Prove Home's recent-save CTA, one video card, exact evidence, candidate selection,
original response, evaluation, optional revision, Vault `tried`, one due Practice
task, and untouched ignored save. Assert all five navigation labels. Use unique
fixture identifiers and scoped cleanup so the test is repeatable and does not
delete unrelated user data.

## Verification

Focused RED/GREEN first:

```bash
pnpm vitest run tests/contract/ai/saved-analysis.test.ts
pnpm playwright test tests/e2e/saved-learning-loop.spec.ts
```

Then the written Batch B gate:

```bash
pnpm vitest run tests/integration/jobs tests/integration/saved tests/integration/knowledge tests/integration/practice tests/integration/learning-loop tests/integration/memory
pnpm vitest run tests/contract/ai/saved-analysis.test.ts
pnpm playwright test tests/e2e/saved-learning-loop.spec.ts
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
git diff --check
```

The browser command runs with `CI=true`, local Supabase public/service environment,
and an application URL on loopback. No live gateway configuration or key is used.

## Upstream and license

- YouTube Digest pin: `zarazhangrui/youtube-digest` commit
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`. This task consumes the already
  accepted Popcorn transcript/evidence interfaces and must not add a parallel
  extraction implementation.
- LLM Wiki pin: `nashsu/llm_wiki` v0.6.9, commit
  `723e259309aea5e3850265b631f80224f66dd9f6`. Method-only influence remains
  `Raw Source -> Structured Knowledge -> Learning Evidence`. Copy no GPLv3 code,
  tests, prompts, components, assets, wording, or styling.
- Add no dependency and do not modify the lockfile or notices.

## Review protocol

After the candidate commit, create a fresh read-only review Agent. It must inspect
the complete baseline-to-HEAD diff, run proportionate focused verification, and
return PASS or concrete blocking issues. Any failure receives a TDD repair and a
new independent re-review before the ledger records Batch B complete.
