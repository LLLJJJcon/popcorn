# Delivery Task 5A — Translation Recovery Handoff

## Scope

Baseline: `cc3cd78e58e5b8c9e70674d6a137af39f4cd4035`.

This corrective change keeps learning-artifact translation polling in the
extension's existing fixed Popcorn action path. It does not add a Provider
destination, credential, model request, direct completion call, dependency,
lockfile, generated output, schema change, or alternate transcript path.

## TDD evidence

### Harness repair

Before the test-only runtime configuration injection:

```bash
node --test extension/tests/translation.test.js
```

Result: 20 tests total, 17 passed and 3 failed. The failures were the three
background-route assertions receiving an `undefined` app origin.

After injecting the fixed `POPCORN_RUNTIME_CONFIG.appUrl` into the background
test sandbox, with no production change:

```bash
node --test extension/tests/translation.test.js
```

Result: 20/20 passed with no warnings or failures.

### RED

Three behavior tests were added and run against unchanged production behavior:

- A registration response plus six pending continuation responses and a later
  successful translation result returned after the old four-poll cutoff.
- An exhausted, still-pending translation rendered `Translation unavailable.`
  instead of a processing/retry state.
- A terminal learning-artifact failure returned a generic failure rather than
  an actionable model-gateway settings recovery message.

```bash
node --test extension/tests/translation.test.js
```

Result: 23 tests total, 20 passed and 3 failed. The first returned the fourth
pending response; the second rendered the unavailable text; the third returned
the old generic terminal message.

### GREEN

- Continuations now retain the first received job ID and poll at 500 ms for at
  most 120 seconds, below the existing 130-second message watchdog.
- A pending result that outlives that finite window renders `Translation is
  still processing. Please Retry.` rather than an unavailable result.
- Terminal learning-artifact failure is reduced to a bounded, actionable
  model-gateway settings message; internal job failure material is not shown.
- The regression uses injected timers, so it does not wait in wall-clock time.

```bash
node --test extension/tests/translation.test.js
```

Result: 23/23 passed.

## Verification

```bash
node --test extension/tests/transcript-selection.test.js extension/tests/save-payloads.test.js extension/tests/recovery-accessibility.test.js
git diff --check
git status --short
```

Results: the adjacent extension suites passed 28/28; `git diff --check`
exited 0. Immediately before commit, status contains only the four permitted
files listed below.

## Changed files

- `extension/sidepanel.js`
- `extension/background.js`
- `extension/tests/translation.test.js`
- `docs/engineering/handoffs/delivery/task-5a-translation-recovery.md`

## Residual risk

The bounded extension window can still end while a durable server job is
running; it now makes that state visible and retryable instead of presenting a
false unavailable result. A credential-holding real-service smoke remains
separately authorized work and was not run here.

## Upstream and license

The existing pinned YouTube Digest adaptation remains in place and was not
regenerated. No upstream material was fetched or copied. LLM Wiki remains
method-only and no GPLv3 code, tests, prompts, components, assets, or prose was
used. No dependency, lockfile, license, or notice changed.
