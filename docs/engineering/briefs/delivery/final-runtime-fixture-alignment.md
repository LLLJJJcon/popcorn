# Final runtime resolver fixture alignment

- Baseline: `d311b94`.
- RED: `tests/integration/model-gateway/runtime-resolver.test.ts` has 2 failures with `PROVIDER_OUTPUT_INVALID`, `wire_schema`, `translations`; the other 503 integration tests pass.
- Root cause: two production-fetch fixtures still emit retired `segmentIndex`, while the frozen Translation wire and prompt require server-owned `sourceLineIndex`. Runtime correctly rejects the obsolete fixture.
- Allowed: `tests/integration/model-gateway/runtime-resolver.test.ts` and `docs/engineering/handoffs/delivery/final-runtime-fixture-alignment.md` only.
- Forbidden: all production code, prompts, schemas, migrations, config, package, lockfile, manuals, generated files, `.env.local`, and any credentials.
- TDD: reproduce the exact 2 RED failures; minimally update only the fixture field to `sourceLineIndex`; run the focused file, full integration suite, and `git diff --check`.
- Preserve one Provider request for bulk translation, exact owner/pin resolution, output mapping by stable segment IDs, no Provider data leakage, MIT license, and no GPLv3 copying.
