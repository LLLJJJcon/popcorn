# Batch C Gate Checkpoint

## Accepted candidate

- Integration branch: `codex/popcorn-youtube-learning`
- Batch C starting baseline: `0974be1943db1c981ba62eed2b59ee7e474d4e33`
- Accepted implementation head: `837389cde944658025031773bb44d5bb25197aeb`
- Local-First Tasks 1–4 and revised Batch C Tasks 1–6 have durable briefs/handoffs, implementation commits, independent reviews, and controller integration evidence.
- The final full-range re-review returned PASS with no P0/P1/P2.

## Demonstrable learning loop

- A user can configure a provider-neutral OpenAI-compatible gateway display name, exact base URL, model, and write-only API key. Only the server worker may use the configured key.
- The generated Chrome extension works only with the currently active `www.youtube.com/watch` video and saves six learning snapshot kinds in the background without pausing, seeking, navigating, or opening a form.
- Saved material can become a source-grounded `tried` Mandarin expression, reappear as Due Practice, advance independently to `reused`, and update evidence-based Progress without increasing saved-item volume.
- Mastery remains exactly `tried -> reused -> owned`; Progress contains practice evidence rather than save totals.
- A user may delete one YouTube source after an exact preview. Unpracticed material is removed; practiced canonical attempts/mastery/reviews remain as a source-deleted tombstone without video identity or locators.
- Active Vault cards retain their complete staged original/revision history. Tombstoned cards use only retained canonical attempts and never reconstruct deleted source evidence.
- Offline/auth retry states use the real durable queue shapes; worker restart recovery remains covered.

## Fresh Gate C evidence

- Scoped Batch C Vitest: 8 files, 59/59 passed.
- Vault/deletion/Saved regression after the final repair: 3 files, 20/20 passed.
- Extension recovery/queue/restart: 27/27 passed.
- Web Chromium learning loops: 2/2 passed sequentially using local Supabase and `CI=true` fixtures:
  - existing Saved -> tried -> due Practice;
  - returning learner due Practice -> `tried -> reused` -> Progress update while saves remain one.
- Provenance: 11/11 passed.
- TypeScript, scoped ESLint, JavaScript syntax, webpack production build, and `git diff --check`: passed.
- `CONTRACT-015` retains its accepted full pgTAP 624/624 evidence.
- `CONTRACT-016` retains its clean-reset full pgTAP 657/657 evidence.

The full database suites were not repeated after application-only Tasks 4–6 because migrations, generated types, and frozen RPCs did not change.

## Review repair recorded at the gate

The first full Gate C review rejected the candidate because Task 4's tombstone work had changed active Vault cards to canonical attempts and hidden a staged revision. The established Saved browser scenario reproduced the failure both alone and beside the new returning-learner scenario. An isolated TDD repair restored active draft history while preserving tombstone-only canonical evidence; an independent repair review passed, both Web scenarios passed, and a new full-range reviewer then approved the candidate.

## Scope and licensing

- The product remains a personal GitHub/self-hosted school project. No billing, quota platform, load/SLO system, WAF, hosted multi-environment deployment, account deletion UI, advanced analytics, or generic ingestion was added.
- Inputs remain limited to the currently watched YouTube video; there is no text, generic URL, image, screenshot, video-file, pgvector, graph, chat retrieval, export, or advanced Progress feature.
- YouTube Digest remains pinned to `d03e1f61e017b032159ffd1821cac6e7693ce0c7` with MIT attribution and in-place adaptation.
- LLM Wiki `723e259309aea5e3850265b631f80224f66dd9f6` remains method-only inspiration; no GPLv3 code, tests, prompts, components, or assets were copied.

## Remaining delivery work

Batch C is frozen. Revised Delivery Tasks 1–6 now own the GitHub download path, concise local setup/demo documentation, account reset/removal instructions, packaged release checks, one explicitly authorized real Provider smoke after all fixture gates, and the final professor-demo acceptance. Deployment to a commercial hosted environment remains out of scope.
