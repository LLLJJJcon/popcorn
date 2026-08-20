# Batch B controller AI contract gate

## Reason

Batch B first-wave Tasks 1 and 4 consume the user-configured model gateway, but migrations 007/009 currently admit only `generate_overview`, `translate_segments`, and `explain_selection` through the atomic artifact RPCs. The schema already declares `analyze_saved_item` and `saved_item_analysis`, yet no atomic owner/saved-item/gateway path can create or complete that job. Practice tables also have no columns for the prompt/model/gateway metadata that Task 4 must persist.

This is a real shared-contract dependency. It is controller-owned and must freeze before Tasks 1 and 4 are dispatched. Task 2 may proceed independently.

## Baseline and files

- Baseline: `3254fc9`.
- Create migration: `supabase/migrations/202608160010_batch_b_ai_contract.sql`.
- Create pgTAP: `supabase/tests/batch_b_ai_contract.sql`.
- Regenerate: `src/types/database.generated.ts`.
- Update: `docs/engineering/execution-ledger.md` only after independent review PASS.
- Create handoff: `docs/engineering/handoffs/batch-b/controller-ai-contract.md`.

No root config, lockfile, public Zod contract, extension, Web UI, prompt, Provider adapter, or feature implementation is in scope.

## Contract A: saved-item analysis through existing gateway RPC names

Create-or-replace the existing same-signature RPCs; do not add a parallel job path:

1. `register_learning_artifact_job(...)`
   - continue existing behavior for the three Batch A types;
   - additionally accept `analyze_saved_item` only when private input contains one canonical UUID string `savedItemId`;
   - require that saved item to match `p_user_id` and `p_video_source_id`;
   - persist it as `knowledge_jobs.saved_item_id`;
   - replay preserves first private input and refuses source/saved-item mismatch.
2. `transition_learning_artifact_failure(...)`
   - additionally accept `analyze_saved_item`;
   - require a non-null saved item for analysis and null saved item for the three source-level artifact types;
   - retain exact lease/attempt/backoff and terminal private-input clearing.
3. `complete_learning_artifact_job(...)`
   - additionally map `analyze_saved_item -> saved_item_analysis`;
   - publish the exact job saved-item ID into `generated_artifacts.saved_item_id`;
   - replay/result-key checks include the same source and saved item;
   - atomically succeed the leased job and replace private input with a bounded artifact reference.

The existing `register_gateway_learning_artifact_job` and `complete_gateway_learning_artifact_job` must work unchanged for analysis and retain exact active owner/config/revision/fingerprint/model/secret fences. `private.learning_artifact_gateway_pins` remains the one immutable pin table. Revocation cleanup already terminalizes every recoverable pinned job and must cover analysis without a special case.

## Contract B: non-secret practice Provider metadata

Add nullable grouped metadata columns:

- `practice_tasks`: `activation_prompt_version`, `activation_model`, `activation_gateway_config_id`, `activation_gateway_revision`, `activation_gateway_fingerprint`.
- `attempts`: `evaluation_prompt_version`, `evaluation_model`, `evaluation_gateway_config_id`, `evaluation_gateway_revision`, `evaluation_gateway_fingerprint`.

For each table, a check constraint requires either all five fields null (legacy/fixture rows) or all five valid: trimmed prompt/model 1–100 chars, positive revision, lowercase SHA-256 fingerprint. Add composite `(gateway_config_id,user_id)` foreign keys to the immutable owner configuration row. Do not store origin, base path, Vault UUID, API key, headers, request body, or Provider response.

Task 4 will resolve the active owner configuration immediately before each outbound activation/evaluation request, use the server-only runtime resolver, and persist only these non-secret fields with the result. Revocation must stop subsequent outbound requests; no additional post-response lock protocol is required for this personal-use first release.

## TDD RED

Before migration, add pgTAP assertions proving:

- gateway analysis registration currently rejects `analyze_saved_item`;
- no practice/evaluation metadata columns exist;
- after migration, wrong-owner/wrong-source saved IDs reject, exact replay is idempotent and first input wins;
- analysis receives an immutable gateway pin and revocation cleanup terminalizes it/clears input;
- exact leased completion stores one `saved_item_analysis` artifact tied to the same saved item and cannot publish under a changed config/model/fingerprint/lease;
- failure transition keeps raw `saved_items` unchanged;
- metadata group checks and owner-config FKs reject partial, malformed, or cross-owner values;
- new metadata remains non-secret and owner/RLS protected by the existing table policies.

## Verification

```bash
pnpm db:reset
pnpm db:test
pnpm exec vitest run tests/contract/model-gateway.test.ts tests/integration/model-gateway/runtime-resolver.test.ts
pnpm exec tsc --noEmit --pretty false
env NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key SUPABASE_SERVICE_ROLE_KEY=test-service-role-key APP_URL=https://popcorn.example pnpm build
git diff --check
git status --short
```

This shared migration justifies one reset/full pgTAP/build. Do not run a second full application suite unless a concrete regression appears.

## License

This is original Popcorn database work. Do not copy LLM Wiki GPLv3 code/tests/prompts/assets. YouTube Digest has no persistence primitive for this contract.
