# Revised Delivery Task 4 Brief — Fixture acceptance and slim CI

## Assignment

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`
- Task: 4, **Run fixture-backed fresh-clone acceptance and slim CI**
- Baseline commit: `f77abb35c58df6ab92d469aea547045b919525eb`
- Worktree: `/private/tmp/popcorn-delivery-4`
- Branch: `codex/popcorn-delivery-4`
- Product profile: school capstone and personal GitHub self-host; prove the classroom path without commercial, load, or browser-matrix expansion.

## File ownership

Implementation Agent may:

- create `tests/e2e/demo-acceptance.spec.ts`;
- create `docs/operations/demo-checklist.md`;
- create `tests/release/ci-scope.test.ts`;
- minimally modify `tests/e2e/extension/fixtures.ts` so the harness loads the
  generated `dist/popcorn-extension` and derives its allowed app/Supabase
  fixture origins from the current local runtime configuration;
- minimally modify `tests/e2e/saved-learning-loop.spec.ts` and
  `tests/e2e/returning-learner.spec.ts` to place their existing hooks/tests in
  separate named `test.describe` scopes when composed by the acceptance entry;
  the Saved scenario may add exactly one browser assertion for Vault search;
- create or append `docs/engineering/handoffs/delivery/task-4.md`;
- modify this brief only to correct a factual path/command error.

Controller exclusively owns and will modify, after the Agent supplies RED evidence:

- `.github/workflows/ci.yml`;
- `playwright.config.ts` if required to select the new top-level acceptance spec and load the packaged extension.

All other files are forbidden, including application/extension code, package manifests, lockfiles, migrations, generated database types, existing E2E specs/helpers other than the three explicitly allowed files, seeds, and deployment files. The implementation Agent must not commit Controller-owned edits; the Controller will commit those separately before the Agent's GREEN run.

## Consumed interfaces

- `tests/e2e/extension/fixtures.ts` and `tests/e2e/extension/acquisition-save.spec.ts`: persistent Chromium extension fixture, explicit sign-in, known Mandarin YouTube fixture, transcript language modes, all six background saves, no playback/navigation/form side effects, durable pending queue, worker stop/alarm recovery, idempotent replay, and egress allow-list.
- `tests/e2e/saved-learning-loop.spec.ts`: Saved detail, `Use It Now`, Vault/history/search, and generated practice flow against local Supabase fixture state.
- `tests/e2e/returning-learner.spec.ts`: Due Practice completion and Progress/mastery evidence against local Supabase fixture state.
- Accepted scripts: `verify`, `test:extension`, `db:reset`, `db:test`, `extension:package`, and `scripts/check-extension-release.sh`.
- Accepted migration 017 proof already reran all three concurrency scripts; Task 4 must not repeat them on every push because no later migration has changed those contracts.

## Produced interfaces

- One reproducible top-level acceptance entry selected by `--project=chromium-extension` that reuses the accepted acquisition, learning-loop, returning-learner, and recovery coverage. It must not contact live YouTube, Supadata, or a model Provider.
- A concise professor-facing checklist covering account, extension, known video, Chinese/English/bilingual transcript, uninterrupted background save, Saved, Use It Now, Vault/search, Due Practice, Progress, and worker recovery.
- A CI contract that requires fixture mode, frozen install, `verify`, extension tests/package validation, clean Supabase reset/pgTAP, the acceptance entry, and patch whitespace; forbids live credential variables and the three standalone concurrency scripts.

## Required RED evidence

Write the acceptance and CI-scope tests first. Run:

```bash
pnpm vitest run tests/release/ci-scope.test.ts
pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension
```

RED must be caused by missing CI/Playwright wiring or missing acceptance/checklist contract, not syntax/import errors. Record concise failure counts and the violated behavior. Notify the Controller after RED; do not edit Controller-owned files.

## Minimal GREEN implementation

- Reuse accepted E2E modules/helpers. Do not duplicate their fixture payloads, SQL graphs, queue implementation, or assertions into a new parallel suite.
- The fixture adaptation must fail clearly if `dist/popcorn-extension` has not
  been generated, load that directory rather than `extension/`, and preserve a
  closed HTTP(S) allow-list of the configured local app/Supabase origins plus
  the fixture YouTube origin. It must not weaken unexpected-egress assertions.
- The acceptance entry may compose the accepted specs, but its selected tests and checklist must jointly make the required path explicit and deterministic.
- Imported spec composition must preserve each accepted Web scenario's own
  account/session lifecycle. Add only named `test.describe` boundaries around
  the existing hooks/tests; do not duplicate or merge their database graphs.
- Add one Vault browser search assertion to the existing Saved scenario (query
  the learned expression and require its result). Do not create a separate
  search suite.
- Keep one complete fixture-backed happy path and one worker restart/recovery proof. Do not add deletion, arbitrary URL/text/image inputs, multi-video, offline, load, live-network, or browser-matrix tests.
- CI must remain one bounded job for a personal project. It may package/check the extension and run the single acceptance entry after Supabase reset/pgTAP; it must not add quotas, security scanners, hosted deployment, or concurrency/load stages.
- The checklist must distinguish automated fixture proof from Delivery Task 5's one manual real-video/real-gateway smoke and must never request or record secret values.

## Verification

Implementation Agent focused GREEN after Controller wiring:

```bash
pnpm vitest run tests/release/ci-scope.test.ts
pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension
pnpm eslint tests/release/ci-scope.test.ts tests/e2e/demo-acceptance.spec.ts
git diff --check
```

Controller final Task 4 gate from the isolated worktree:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:extension
pnpm exec supabase start
pnpm db:reset
pnpm db:test
pnpm extension:package
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
pnpm playwright test tests/e2e/demo-acceptance.spec.ts --project=chromium-extension
git diff --check
```

Do not rerun the standalone gateway/practice concurrency scripts unless a later migration changes their accepted contracts. Do not use real credentials or live services.

## Upstream reuse and licensing

- YouTube Digest: `zarazhangrui/youtube-digest` at `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; this task reuses only Popcorn's already accepted MIT-derived extension surface and notices. Do not fetch or copy a parallel upstream implementation.
- LLM Wiki: `nashsu/llm_wiki` v0.6.9 / `723e259309aea5e3850265b631f80224f66dd9f6`; no code, tests, prompts, components, prose, or assets may be copied. Method-only isolation remains unchanged.
- Root project remains MIT. No new dependency or lockfile change is allowed.

## Submission protocol

1. Supply RED evidence to the Controller before implementation/wiring.
2. After Controller-owned CI/Playwright changes appear, implement only the allowed files and run focused GREEN.
3. Commit Agent-owned implementation and tests.
4. Write and separately commit the handoff with RED/GREEN evidence, exact files, risks, licensing result, and implementation SHA.
5. Return both SHAs and the handoff path. Do not integrate or push.
