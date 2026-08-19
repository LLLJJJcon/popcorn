# Batch A Task 3 / User Gateway Task 4 Brief

## Task, baseline, and isolated workspace

- Plans:
  - `docs/superpowers/plans/2026-08-16-popcorn-batch-a-platform-capabilities.md`, Task 3.
  - `docs/superpowers/plans/2026-08-19-popcorn-user-model-gateway.md`, Task 4.
- Design:
  `docs/superpowers/specs/2026-08-19-popcorn-user-model-gateway-design.md`.
- Integration baseline: `7182f08`.
- New implementation worktree:
  `/private/tmp/popcorn-gateway-learning-artifacts`.
- New branch: `codex/popcorn-gateway-learning-artifacts`.
- Historical implementation checkpoint: `a0ab48f`. It is reference material,
  not a commit to cherry-pick wholesale. Its deployment-level `AI_GATEWAY_*`
  environment design is obsolete and forbidden.

The implementation Agent owns only this numbered feature task. It must start
with failing tests, provide RED and GREEN evidence, commit the result, add a
handoff, and return the commit SHA, verification results, and risks.

## Allowed files

- `extension/background.js`
- `extension/sidepanel.html`
- `extension/sidepanel.js`
- `extension/prompts/analysis.md`
- `extension/prompts/explain.md`
- `extension/prompts/translation.md`
- `extension/tests/options-language.test.js`
- `extension/tests/release.test.js`
- `extension/tests/settings.test.js`
- `extension/tests/transcript-selection.test.js`
- `extension/tests/translation.test.js`
- `src/server/ai/provider.ts`
- `src/server/ai/model-gateway.ts`
- `src/server/ai/openai-compatible-provider.ts`
- `src/server/ai/prompts/youtube-overview.v1.ts`
- `src/server/ai/prompts/translate-segments.v1.ts`
- `src/server/ai/prompts/explain-selection.v1.ts`
- `src/server/model-gateway/runtime-resolver.ts`
- `src/server/jobs/process-jobs.ts`
- `src/server/jobs/handlers/generate-overview.ts`
- `src/server/jobs/handlers/translate-segments.ts`
- `src/server/jobs/handlers/explain-selection.ts`
- `src/server/transcript/provider.ts`
- `src/app/api/internal/jobs/process/route.ts`
- `src/app/api/v1/jobs/[jobId]/route.ts`
- `src/app/api/v1/youtube/[videoId]/overview/route.ts`
- `src/app/api/v1/youtube/[videoId]/translations/route.ts`
- `src/app/api/v1/explanations/route.ts`
- `tests/contract/transcript/supadata-provider.test.ts`
- `tests/integration/jobs/resolve-snapshot.test.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `tests/integration/model-gateway/runtime-resolver.test.ts`
- `docs/engineering/handoffs/batch-a/task-3-user-gateway.md`

Files may be created only where an allowed path does not yet exist. Every other
path is forbidden.

## Forbidden shared and out-of-scope files

- `src/contracts/**`
- `supabase/**`
- `src/types/database.generated.ts`
- `src/server/env.ts` and `src/server/env.test.ts`
- `.env.example`, `supabase/config.toml`, `.github/**`
- `package.json`, `pnpm-lock.yaml`, all root configuration
- settings API/UI/auth files
- extension manifest, content script, CSS, upstream notices, licenses
- execution ledger and all other briefs/plans/specs

Do not implement text, generic URL, image, screenshot, export, pgvector,
knowledge graph, chat retrieval, or advanced Progress inputs/features.

## Frozen interfaces consumed

### Authentication and ownership

- Public routes authenticate the current Popcorn user through existing server
  auth helpers. They never trust a body/header supplied user ID.
- Every source, snapshot, segment, job, and artifact lookup remains explicitly
  owner-scoped even when using service role.
- Extension requests continue through the existing authenticated Popcorn
  service-worker boundary. The extension never receives a gateway origin,
  model, key, Vault ID, or Provider response envelope.

### CONTRACT-007/009 job and publication gates

- Discover jobs only through frozen `claim_knowledge_jobs`.
- Register model-backed work only through
  `resolve_active_user_model_gateway_pin` followed by the atomic
  `register_gateway_learning_artifact_job` RPC.
- The route passes the exact authenticated owner, source, config ID, revision,
  fingerprint, and bounded private input. Public bodies cannot override any
  gateway field.
- The private input contains only the task payload plus `gatewayConfigId`,
  `gatewayRevision`, and `gatewayFingerprint`. It must not contain origin, base
  path, adapter headers, API key, Vault UUID, access token, cookie, or public
  response data.
- Before production fetch, resolve the exact owner/config/revision through
  `resolve_user_model_gateway_config` and require the returned fingerprint to
  equal the job pin. The resolver is server-only and the secret is ephemeral.
- Publish only through `complete_gateway_learning_artifact_job`; a null result
  is a lost fence and produces no public artifact.
- Failure uses the frozen lease/attempt transition. Revocation or replacement
  terminalizes pinned recoverable work and clears input through CONTRACT-009.

### Deterministic identity

- Use the frozen `createJobResultKey`; never duplicate its serializer.
- Use `modelVersion: "gateway:" + gatewayFingerprint`. A semantic config
  change changes the key. API-key rotation does not change it.
- Preserve prompt versions and exact transcript/source payload identity.

## Interfaces produced

- Authenticated bounded routes for on-demand YouTube Overview, Chinese segment
  translation to English, and selected-Chinese explanation.
- Short `202` registration responses and owner-only bounded polling/results.
- Durable handlers for `generate_overview`, `translate_segments`, and
  `explain_selection` using fixture or owner-resolved production Providers.
- A closed `LearningArtifactProvider` registry with the first production
  adapter kind fixed to `openai-compatible`.
- Existing Side Panel surfaces for Transcript, Overview, and Saved, with
  `中文 | English | Bilingual`, timestamp navigation, retry states, chapters,
  3–5 grounded key quotes, and explanation rendering.

## Mandatory RED tests

Write and run tests before production changes. RED must cover at least:

1. Public routes reject or ignore body/header attempts to supply config ID,
   provider, URL, origin, path, model, key, authorization, or arbitrary headers;
   only the authenticated user's unique active pin is used.
2. Owner/source/snapshot/segment/job cross-user combinations fail closed.
3. A registration response is `202` before Provider/fetch/Vault-secret
   resolution; spies for runtime resolver and network fetch remain zero.
4. Private job input has the exact config ID/revision/fingerprint and no secret
   or transport material.
5. Fingerprint changes alter job/result identity; key rotation does not.
6. Runtime resolution verifies exact owner/config/revision/fingerprint and
   closed adapter kind. Unknown adapters fail closed.
7. Revocation before fetch causes zero network; revocation after fetch but
   before publish loses the CONTRACT-009 completion fence and creates zero
   artifact.
8. CI fixture selection occurs before construction or invocation of the runtime
   resolver and before any Vault/config/network read.
9. The OpenAI-compatible adapter appends only the fixed
   `chat/completions` endpoint to the catalog origin/base path, uses
   `redirect: "error"`, enforces timeout plus request/streamed-response byte
   bounds, and returns sanitized bounded errors.
10. Outbound payload contains only the necessary video title, original Chinese
    evidence, timestamps/stable IDs, and versioned task prompt. It contains no
    user/source/snapshot database IDs, tokens, key, Vault ID, unrelated
    transcript paragraphs, or extension metadata.
11. Cross-line selections preserve every stable segment ID, earliest/latest
    time, and UTF-16 joined-context offsets; incomplete or inconsistent fields
    fail closed.
12. Overview contains at least one chapter and 3–5 key quotes; each timestamp
    belongs to its referenced segment and each exact quote occurs in the same
    referenced original-Chinese evidence.
13. The extension has no Provider host/key/model setting or direct Provider
    fetch and performs only short Popcorn requests through `background.js`.

For the production adapter tests, use injected fetch and deterministic local
fixtures. CI must never contact a real model Provider.

## Implementation constraints

- Saving and artifact registration remain background operations: no playback
  pause, page navigation, form popup, transcript/translation/AI call in the
  synchronous save/request registration path.
- Save only learning snapshots and generated JSON artifacts, never video bytes.
- Native learner language is `en`; target is Mandarin `zh-CN`. Translation
  direction here is original Chinese to English support text.
- Overview/explanation outputs must pass strict schemas and source-grounding
  validation before the completion RPC.
- Retry only sanitized retryable failures under the frozen queue policy. Never
  log or persist a credential or raw Provider response.
- No dynamic adapter import, arbitrary URL, custom path, custom header, custom
  prompt template, proxy parameter, or client-controlled Provider selection.
- Production DNS/egress enforcement remains a Delivery gate; this task consumes
  only administrator-approved exact HTTPS origins.

## Historical checkpoint migration

Do not cherry-pick `fd2fc6e`, `864682b`, or all of `a0ab48f`.

From `4f658b5` and `a0ab48f`, selectively port only behavior still compliant
with this brief:

- the existing extension `sidepanel.html`/`sidepanel.js` transcript, Overview,
  translation, explanation, and polling integration;
- cross-line selection fixes and their transcript/translation tests;
- Overview and explanation grounding fixes in prompts, validators, handlers,
  and focused integration tests;
- source timestamp/stable-ID checks and strict same-segment quote grounding.

Discard all deployment singleton env changes, `AI_GATEWAY_*` references,
route-level singleton model selection, obsolete gateway design/repair docs, and
placeholder/fail-closed production adapter behavior.

## Verification commands

```bash
node --test extension/tests/transcript-selection.test.js \
  extension/tests/translation.test.js extension/tests/release.test.js

./node_modules/.bin/vitest run \
  tests/integration/model-gateway/runtime-resolver.test.ts \
  tests/integration/youtube/learning-artifacts.test.ts \
  tests/integration/jobs/resolve-snapshot.test.ts \
  tests/contract/transcript/supadata-provider.test.ts

./node_modules/.bin/supabase db reset --local
./node_modules/.bin/supabase test db
./node_modules/.bin/vitest run src tests/contract tests/integration tests/provenance --passWithNoTests
./node_modules/.bin/eslint . --max-warnings 0
./node_modules/.bin/tsc --noEmit
pnpm test:extension
env NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key \
  SUPABASE_SERVICE_ROLE_KEY=service-role-key \
  APP_URL=https://popcorn.example \
  ./node_modules/.bin/next build --webpack
git diff --check
git status --short
```

Also scan the complete baseline-to-HEAD diff for secrets, Provider hosts,
`AI_GATEWAY_`, direct extension Provider calls, copied GPL identifiers, and
changes outside the allowlist.

## Upstream reuse and license

YouTube Digest is pinned MIT upstream:

`zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`

Adapt the pinned code in place; do not create a parallel Side Panel or transcript
pipeline. Preserve and reuse these planned functions where the checkpoint uses
them:

- `extension/sidepanel.js`: `normalizeCaptionText`,
  `splitOversizedThought`, `groupTranscriptEntries`, `startDigest`,
  `seekFromTranscriptEntryClick`, `renderTranscript`,
  `renderSubtitleInlineMarkup`, `setupExplainFeature`,
  `startPlaybackTracking`, `highlightActiveEntry`,
  `alignTranslatedSegmentBatch`, `translateTranscript`, and
  `renderAnalysisResults`.
- `extension/background.js`: `handleFetchTranscript`, `pollTranscriptJob`, and
  the existing message router.
- Reuse the existing `sidepanel.html` DOM and prompt files in place.

Keep `extension/UPSTREAM.md`, the MIT license, and
`THIRD_PARTY_NOTICES.md` unchanged.

LLM Wiki `v0.6.9@723e259309aea5e3850265b631f80224f66dd9f6`
is GPLv3 and method-only inspiration. Do not copy its code, SQL, tests, prompts,
components, assets, identifiers, or naming structure.
