# Practice persistence classification re-repair handoff

## Scope

- Re-repair baseline: `47f0e3852a25999657779900942cdd7771923c24`.
- Original repair replay: `0012fe12373b5c03f9aa17d2c996e1f0c39b4f79`.
- Sole behavior change: a completed Due attempt whose persisted evaluation no longer satisfies the current strict schema is classified as retryable `INTERNAL_ERROR`, not as a live Provider failure.

## Root cause and fix

`persistedEvaluation` passed database-backed fields through `safeEvaluation`, whose legacy failure branch always created `PracticeError("PROVIDER_FAILED", true)`. The HTTP mapping therefore returned a Provider-flavoured 503 even though no Provider was called.

The failure branch now delegates the Zod validation error to the existing `practiceErrorFromUnknown` mapping. Because a persisted schema failure is neither a `PracticeError` nor a `ModelGatewayError`, the shared mapping produces `PracticeError("INTERNAL_ERROR", true)`. Valid replay, live Provider evaluation, domain output, and persistence writes are unchanged.

## TDD evidence

- RED: the two focused files ran 100 tests; the new service test received `PROVIDER_FAILED`, and the new HTTP test received 503. Result: 2 failed, 98 passed.
- GREEN: `vitest run tests/integration/practice/attempts.test.ts src/server/domain/complete-due-practice.test.ts` passed 2 files and 100 tests.
- Typecheck: `tsc --noEmit` exited 0 with no diagnostics.

## Risk

Low. The production change is one existing error-mapping call on the persisted replay validation branch. Both regression tests assert Provider/RPC non-use and the HTTP test asserts the raw persisted sentinel does not escape.

No database, browser, Provider, full-suite, upstream, or GPL-derived material was used.
