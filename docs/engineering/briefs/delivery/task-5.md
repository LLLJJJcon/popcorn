# Revised Delivery Task 5 Brief — One bounded real local smoke

## Assignment

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`
- Task: 5, **Perform one real local YouTube and model-gateway smoke**
- Baseline commit: `6d801c0456988f201fce407a57df1434ffaf874b`
- Worktree: `/private/tmp/popcorn-delivery-5-live`
- Branch: `codex/popcorn-delivery-5-live`
- Product profile: one personal school-demo installation, not a production deployment or load exercise.

## Allowed files

- Modify `docs/operations/demo-checklist.md`.
- Create `docs/operations/release-report.md`.
- Create/append `docs/engineering/handoffs/delivery/task-5.md`.
- This brief is Controller-owned and already frozen at dispatch.

All application/extension/runtime files, migrations, generated types, CI,
package/lockfile, fixtures, prompts, seeds, and configuration containing
credentials are forbidden. If the smoke reveals a code defect, stop evidence
editing and report the exact bounded defect to the Controller for a separate
TDD fix task.

## Consumed interfaces

- The independently accepted Task 4 fixture gate and release package.
- The accepted one-click launcher and Chinese user guide through `6d801c0`.
- Real `SUPADATA_API_KEY`, present only in the task worktree's untracked
  `.env.local`.
- One authenticated user configuration entered through
  `/settings/model-gateway`: user-visible gateway name, exact
  OpenAI-compatible HTTPS API root, model, write-only API key,
  exact-destination consent, and active state.
- One public Mandarin YouTube watch URL and the generated
  `dist/popcorn-extension`.
- The local worker is authorized to use the API key stored in the active
  user's gateway configuration.

## Expected RED evidence

- At dispatch, `/private/tmp/popcorn-delivery-5-live/.env.local` does not yet
  contain the user's Supadata key and no active user gateway is expected.
- Credential preflight therefore remains RED until the user locally fills the
  Supadata field and activates a Web gateway. Record only booleans/counts, not
  values.
- No production-code RED test is required for this evidence-only task. Task 4
  fixture acceptance is the automated baseline; live Provider behavior is the
  missing acceptance evidence.

## Execution protocol after credentials are ready

1. Confirm environment presence by boolean/length only and query only
   boolean/count gateway state (`active=1`, `hasApiKey=true`). Never print
   values, exact private base URL, tokens, cookies, or Provider responses.
2. Start local Supabase, Web, and worker through the accepted launcher. Generate
   and load the exact packaged extension.
3. Use one public Mandarin YouTube watch page to verify native Chinese
   transcript plus Chinese, English, and bilingual display.
4. Perform one background save while recording only playback and URL continuity
   categories; do not record the full transcript or request body.
5. Complete one Overview, translation, explanation, or Practice request through
   the active user gateway, then verify the Saved record and downstream learning
   state.
6. Stop and restart `worker:local` once and prove pending durable work recovers.
   Do not add automated process orchestration if this bounded manual restart
   proves it.
7. Record only commit, date, public video ID, gateway display name and model,
   result categories, checksum, commands, and known limitations. Never record
   an API key, token, cookie, Provider response, full transcript, service-role
   value, request body, or private base URL.

## Verification commands

Use only the commands needed to prove the live path and evidence formatting:

```bash
pnpm vitest run tests/release/self-host-docs.test.ts tests/release/extension-package.test.ts
bash scripts/check-extension-release.sh dist/popcorn-extension.zip
git diff --check
git status --short
```

Reuse Task 4's full fixture evidence. Do not rerun full verify, pgTAP,
concurrency, load, browser matrices, or database reset unless this smoke finds a
defect in a boundary those commands can diagnose.

## Upstream and licensing

- Preserve YouTube Digest MIT provenance at
  `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; the live smoke consumes the
  accepted transcript integration and creates no parallel implementation.
- LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6`
  remains method-only; copy no GPLv3 code, tests, prompts, prose, components, or
  assets.
- No dependency or license change is allowed.

## Handoff and review

The evidence Agent writes a full credential-free report to
`docs/engineering/handoffs/delivery/task-5.md`, commits only the three allowed
evidence files, and returns status, commit SHA, bounded results, risk, and report
path. A fresh independent read-only reviewer compares the full baseline-to-HEAD
diff and returns PASS only when evidence proves a real public video and a real
user-configured gateway after fixture acceptance while remaining secret-free
and within YouTube-only scope.
