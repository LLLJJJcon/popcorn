# Revised Delivery Task 5 Brief — One bounded real local smoke

## Assignment

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`
- Task: 5, **Perform one real local YouTube and model-gateway smoke**
- Baseline commit: `229ecac96fd7572a81ab930056af965e66eeec32`
- Worktree: `/private/tmp/popcorn-delivery-5`
- Branch: `codex/popcorn-delivery-5`
- Product profile: one personal school-demo installation, not a production deployment or load exercise.

## Allowed files

- Modify `docs/operations/demo-checklist.md`.
- Create `docs/operations/release-report.md`.
- Create/append `docs/engineering/handoffs/delivery/task-5.md`.
- This brief.

All application/extension/runtime files, migrations, generated types, CI, package/lockfile, fixtures, prompts, seeds, and configuration containing credentials are forbidden.

## Consumed interfaces

- The independently accepted Task 4 package and fixture gate at integration commit `229ecac`.
- Real `SUPADATA_API_KEY`, present only in the local server environment.
- One authenticated user configuration entered through `/settings/model-gateway`: user-visible gateway name, exact OpenAI-compatible HTTPS base URL, model, write-only API key, exact-destination consent, and active state.
- One public Mandarin YouTube watch URL and the generated `dist/popcorn-extension`.
- The local worker is authorized to use the API key stored in the active user's gateway configuration.

## Preflight result and blocker (2026-08-23 Asia/Shanghai)

- Shell presence check returned `SUPADATA_API_KEY present=false length=0`; no value was read or printed.
- Clean local migrations/reset from Task 4 left two local fixture accounts but zero gateway configurations, zero active configurations, and zero secret mappings. Only counts were queried.
- Task 4 fixture acceptance passed 3/3 and the release archive passed the 23-file checker with SHA-256 `a546f3d3090f3883b97a005a23712b10667213d107d69e26794d4d96ea252d91`.
- Real smoke is blocked until the user locally supplies Supadata and re-enters/activates one gateway. This is an external-credential blocker; do not substitute Codex credentials, seed a fake key, or weaken fixture tests.

## Execution protocol after credentials are ready

1. Confirm presence by boolean/length only and query only boolean/count gateway state (`active=1`, `hasApiKey=true`). Never print values.
2. Start local Supabase/Web/worker with server-only values. Generate/load the exact packaged extension.
3. Use one public Mandarin YouTube watch page to verify native Chinese transcript and Chinese/English/bilingual display.
4. Perform one background save while recording only playback/URL continuity categories; do not record full transcript or request body.
5. Complete one Overview/translation/explanation or Practice request through the active user gateway, then verify the Saved record and downstream learning state.
6. Stop and restart `worker:local` once and prove pending durable work recovers. Do not add automated process orchestration if the bounded manual restart proves it.
7. Record only commit/date/public video ID/gateway display name+model/result categories/checksum/commands/known limitations. Never record API key, token, cookie, Provider response, full transcript, service-role value, request body, or private base URL.

## Verification and review

- Reuse Task 4 fixture evidence; do not rerun full verify, pgTAP, concurrency, load, or browser matrices unless this smoke discovers a code defect.
- A new implementation/evidence Agent may update only the three allowed documentation files after the Controller completes the credentialed interaction.
- A fresh independent read-only reviewer returns PASS only when evidence proves a real public video and real user-configured gateway while remaining credential-free and within YouTube-only scope.

## Upstream and licensing

- Preserve YouTube Digest MIT provenance at `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6` remains method-only; copy no GPLv3 code, tests, prompts, prose, components, or assets.
- No dependency or license change is allowed.
