# Delivery recovery Task 5L report — Simple resilient Overview

## Status

Implemented on `codex/popcorn-overview-simple` from baseline `0cdd7f9d94c799cc093fc54ed2634d52d5d275d0` with the delivery brief at `803384e2729e6837c293c6cb04c7b8b08f55df10`.

## RED evidence captured before production edits

- `pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts` could not start because the workspace dependency symlink triggered the wrapper's `EPERM` temporary-file check. Per the brief, the direct equivalent `../Popcorn/node_modules/.bin/vitest run tests/integration/youtube/learning-artifacts.test.ts` ran against the baseline and failed 11 of 75 tests as expected: Overview still used 1,800 tokens and prompt v3; prose, partial JSON, and recovered quote anchors were rejected; empty optional arrays failed schema validation; and first-attempt Overview failures remained deferred.
- `node --test extension/tests/translation.test.js` ran against the baseline and failed 3 of 59 tests as expected: the optional section containers did not exist, and failure output remained in the Chapters list while both optional sections stayed visible.

These failures covered the required plain-prose summary, independently retained partial JSON, wrong/missing quote-index recovery, relaxed empty arrays with malformed-item rejection, Overview-only terminal first failure, and summary/failure optional-section hiding. Route-level successful artifact reuse did not supply RED evidence: it is frozen unchanged behavior, and its baseline-passing characterization proves that the same semantic registration key returns the existing artifact on both requests without creating a Provider job.

## Implementation

- Advanced Overview to `youtube-overview-v4-simple`, retained the complete chronological `sourceLineIndex + JSON string literal` transcript in one request, kept the 120-second timeout and byte limits, and reduced only Overview `max_tokens` to 900.
- Added an Overview-only bounded assistant-text path. Plain prose and one enclosing Markdown fence become summary-only content. Parseable JSON requires a non-empty English overview; unknown fields are ignored. Chapters and quotes are validated independently, grounded to persisted stable IDs and timestamps, capped at 8 and 5, and invalid items are dropped without losing usable content. Quote anchors recover through the first chronological exact transcript match when a supplied index is missing or wrong.
- Kept translation and explanation on the existing strict JSON-only completion path with their existing request shapes, token behavior, and timeouts.
- Relaxed only the public/persisted Overview arrays to permit empty Chapters and Key Quotes while preserving all item bounds and evidence validation.
- Made every failed leased Overview attempt terminal while preserving the existing five-attempt retry policy for translation and explanation.
- Hid complete empty optional sections after success and both optional sections after failure; pending Overview work continues to show both. Existing Retry and durable Side Panel ownership/resume behavior remain in place.

## Verification

- `../Popcorn/node_modules/.bin/vitest run tests/integration/youtube/learning-artifacts.test.ts` — 75 passed, 0 failed.
- `node --test extension/tests/translation.test.js` — 59 passed, 0 failed.
- `../Popcorn/node_modules/.bin/eslint src/server/ai/prompts/youtube-overview.v1.ts src/server/ai/openai-compatible-provider.ts src/server/jobs/handlers/generate-overview.ts tests/integration/youtube/learning-artifacts.test.ts` — passed.
- `../Popcorn/node_modules/.bin/tsc --noEmit` (direct equivalent of `pnpm typecheck` because of the intentional dependency symlink) — passed.
- `node --check extension/sidepanel.js` — passed.
- `git diff --check 0cdd7f9d94c799cc093fc54ed2634d52d5d275d0..HEAD` — passed against the implementation commit before handoff.

## Scope and risks

- Modified only the allowlisted production, test, and report files. `extension/background.js`, queue/auth contracts, gateway settings, migrations, dependencies, and the intentional untracked `node_modules` symlink were not changed.
- No live external Provider request was made; behavior is verified at the bounded OpenAI-compatible transport boundary with deterministic responses, including request count, grounding, dedupe reuse, and sanitized failures.
- No API keys or environment secrets were read or printed.

## Fix round 1 — invalid quote hints and harmless optional metadata

Implementation commit: `a36f50896fee52d453c65877c1b3e4c5e96b792f`.

### RED

Tests changed before production code:

- `retains a JSON summary and only independently valid grounded optional items` now sends harmless unknown `confidence` fields on a valid chapter and quote. The chapter must remain present with only its named public fields and derived grounding.
- `recovers a quote with a %s line index by its first exact transcript match` now includes `null`, string, and negative index hints in addition to the existing wrong and missing hints. Every invalid hint must be ignored while the quote is recovered by chronological exact-text search.

Exact command: `../Popcorn/node_modules/.bin/vitest run tests/integration/youtube/learning-artifacts.test.ts`.

Result before production edits: 78 tests ran; 4 failed and 74 passed. The chapter-with-unknown-field case returned an empty Chapters array, and the `null`, string, and negative quote-hint rows each returned an empty Key Quotes array.

### GREEN and verification

- `../Popcorn/node_modules/.bin/vitest run tests/integration/youtube/learning-artifacts.test.ts` — 78 passed, 0 failed.
- `../Popcorn/node_modules/.bin/eslint src/server/ai/openai-compatible-provider.ts tests/integration/youtube/learning-artifacts.test.ts` — passed.
- `../Popcorn/node_modules/.bin/tsc --noEmit` — passed.
- `git diff --check d69c18440a2f888f48fdda3f79b30c229b4e66fe` — passed before the implementation commit.
- Extension tests were not rerun in this fix round because no extension file changed.

The minimal correction treats `sourceLineIndex` as an optional untrusted hint separate from the required quote fields, using it only when it is a valid non-negative integer. Chapter projection now forwards only `title` and `summary` plus derived grounding; quote projection already forwarded only `quote` and `englishMeaning`, and the added unknown-field row preserves that guarantee.

### Controller ruling

Cached/deduplicated successful Overview reuse is frozen unchanged behavior. Its baseline-passing route-level characterization is therefore preservation/GREEN evidence, not RED evidence. No parallel cache or Provider harness was added to manufacture a regression. If that ruling is later reversed, the remaining risk is that unchanged cross-layer cache behavior is proven by existing route contract coverage rather than by a newly failing Task 5L test.
