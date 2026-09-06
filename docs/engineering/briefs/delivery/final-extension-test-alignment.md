# Final extension test alignment

- Baseline: `d311b94`.
- RED: full `node --test extension/tests/*.test.js` has one failure in `transcript-selection.test.js`; the test expects `createExplanationMessage(selectionEvidence, identity)` while current accepted source is `createExplanationMessage(selectionEvidence, identity, retryId)`.
- Root cause: the static test signature was not updated when explicit explanation retry identity was added; the production function and selected-evidence flow are present.
- Allowed: `extension/tests/transcript-selection.test.js` and `docs/engineering/handoffs/delivery/final-extension-test-alignment.md` only.
- Forbidden: extension runtime/generated package, application code, config, package, lockfile, migrations, manuals, `.env.local`, and any credentials.
- TDD: reproduce the one RED failure; minimally align the signature assertion with the accepted three-argument function without weakening selected cross-line evidence assertions; run the focused file, full extension test glob, official release subset, and `git diff --check`.
- No upstream source or GPLv3 content may be copied; this is test-only alignment under the existing MIT/adaptation notices.
