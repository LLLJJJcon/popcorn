# Foundation Checkpoint

## Frozen baseline

- Integration branch: `codex/popcorn-youtube-learning`
- Verified Foundation head: `c790118dc89297af965dee8048a2722a98bee802`
- Repository starting baseline: `cc515558c899472dccb8e2fe6d21ef861970109b`
- Foundation Tasks 1–5 have implementation commits, durable briefs/handoffs, independent PASS reviews, controller integration, and ledger rows.

## Integrated task heads

- F1: `8294e6bc11778e6e8ff90814cf2f5e0bd32aca38`
- F2: `f75cd8be49d4a3de8fe0335183b971737ff9f000`, plus controller root gate `e4a069d4779a85bf6d8e3f3b9e56a10a4183bb7b`
- F3: `4626aef76829204ed89b662df6a59e6d5be62e7a`
- F4: `0b32e4dbbcb28578b334b46f8e6bbe2a54e2cd6b`
- F5: `9447bb05232d268ecc934b2ff3364500da6c3a32`

## Exit-gate evidence

- `CI=true pnpm install --frozen-lockfile`: passed, lockfile unchanged.
- `CI=true pnpm verify`: passed; unit 76/76, contract 128/128, integration no-spec gate, provenance 11/11, lint, typecheck, and production build passed.
- `CI=true pnpm test:extension`: passed the four explicitly intake-supported upstream release static cases, 4/4.
- Clean `supabase db reset`: migrations `202608160001`, `202608160002`, and `202608160003` plus deterministic seed applied.
- `supabase test db`: pgTAP 215/215 passed.
- Live catalog check: one active `popcorn-process-knowledge-jobs` job on `* * * * *`; stored command reads Vault at runtime and guards the exact HTTPS `/api/internal/jobs/process` path.
- Missing local Vault configuration: zero named secrets and zero queued pg_net requests.
- `CI=true pnpm build`: passed independently.
- `CI=true pnpm test:e2e`: passed the current no-spec gate.
- `bash -n scripts/vendor-youtube-digest.sh`, `git diff --check`, and clean worktree status: passed.

## Frozen boundaries

- Acquisition remains only the currently watched canonical YouTube video with native Simplified Chinese subtitles.
- Saves are nonblocking learning-material snapshots; no video file and no synchronous transcript/translation/AI call.
- Mastery is exactly `tried -> reused -> owned`, server-evidence-only and monotonic.
- Database ownership/RLS, append-only raw/evidence boundaries, durable jobs, lease recovery, retry exhaustion, and result-key identity are frozen.
- YouTube Digest reuse stays pinned/MIT-attributed. LLM Wiki contributes only the eight approved independently implemented methods; GPLv3 code, tests, prompts, components, assets, runtime, vector/graph/chat implementations remain prohibited.
- Controller-owned files and parallel worktree/review rules are frozen in `docs/engineering/agent-boundaries.md`.

## Open risks carried forward

- `LANG-001`: Provider boundaries must reject wrong-language/fallback output semantically before persistence.
- `DB-001`: service-role workers must explicitly scope every operation by `user_id` and set `updated_at`.
- `HASH-001`: all producers use the frozen `createJobResultKey` implementation.
- `DELETE-001`: explicit audited deletion arrives in Batch C.
- `CI-001`: hosted GitHub CI remains to be run after a branch push/PR.
- Production credentials/provider access remain deferred until local release acceptance and Delivery Task 6.

## Next schedule

Batch A wave 1 runs Tasks 1, 2, and 4 in three disjoint worktrees. Task 3 waits for Tasks 1 and 2. Tasks 5 and 6 follow their declared dependencies, and the controller performs Task 7 integration gate.
