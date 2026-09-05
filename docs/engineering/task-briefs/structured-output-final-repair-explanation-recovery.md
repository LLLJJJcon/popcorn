# Structured Output Final Repair B — Explanation Recovery and Retry

- Finding: final review Important 2.
- Product baseline: `bcfcd2a5d7e3fb5c7e117a73d46c1d2041c888b1`.
- Execution baseline: controller commit containing this brief; record exact SHA.
- Worktree: `/private/tmp/popcorn-structured-output-final-explanation`.
- Branch: `codex/structured-output-final-explanation`.

## Required behavior

AI Explanation must use the same durable job semantics as the other learning
artifacts without changing the enriched Explanation domain result:

1. Accept optional bounded UUID `retryId` in the Explanation request. Include it
   only in the dedupe payload/result key, never private Provider input.
2. A registration that is already terminal must return a safe terminal failure,
   not generic 202 processing. Reuse the existing public job status/category
   seam; do not expose last-error text or credentials.
3. The extension must retain the exact returned jobId and poll by resubmitting
   that jobId through `background.js` until ready or safe terminal result.
   Polling is bounded/cancellable when the modal closes or ownership changes.
4. Terminal Explanation UI shows one explicit Retry. One click creates exactly
   one fresh `crypto.randomUUID()` retryId, omits the exhausted jobId, disables
   duplicate clicks until admission resolves, and then polls the newly returned
   exact jobId. Retry must actually register/requeue executable work.
5. No automatic fresh retry, one call per poll, no Provider URL/model/key in the
   Side Panel, and no change to save payload/domain output.

## Allowed files

- `src/server/ai/provider.ts`
- `tests/integration/youtube/learning-artifacts.test.ts`
- `extension/background.js`
- `extension/sidepanel.js`
- `extension/tests/translation.test.js`
- `docs/engineering/handoffs/structured-output-final-repair-explanation-recovery.md`

Everything else is forbidden: routes/contracts/prompts/handlers/migrations,
generated output, root config/dependencies/lockfile/ledger.

## TDD and focused verification

RED must cover optional retry UUID changes dedupe but not private input;
terminal registration returns terminal safe category; pending jobId is polled to
ready; modal close/stale ownership cancels; terminal retry uses one fresh UUID,
does not reuse old jobId, blocks duplicate clicks, and eventually renders the
same enriched Explanation shape. Use fixed clocks/timers and sentinel errors.

```bash
pnpm exec vitest run tests/integration/youtube/learning-artifacts.test.ts
node --test extension/tests/translation.test.js
node --check extension/background.js
node --check extension/sidepanel.js
pnpm typecheck
git diff --check <execution-baseline>..HEAD
git status --short
```

No full suite/build/browser/DB/real Provider. Commit + handoff; return SHA,
RED/GREEN/typecheck/risks/clean. No merge/rebase/push.

Preserve the existing YouTube Digest MIT reuse at commit `d03e1f...`; copy no
GPLv3 LLM Wiki code/tests/prompts/components/assets from `723e259...`.
