# Delivery Task 4 verification repair 3 handoff

## Result

- Implementation commit: `0841e6d944c1f848dfd77cef19f7d06dd24cc3ef`
- Brief commit: `6d860782874ee5d639088bfb6b6647fbc073e463`
- Worktree/branch: `/private/tmp/popcorn-delivery-4`, `codex/popcorn-delivery-4`
- No integration or push was performed.

## RED and diagnosis

The Controller's full `CI=true pnpm verify` passed unit 190/190, contract
181/181, and integration 330/330, then failed two provenance assertions.

- The stale Foundation CI freeze still required direct Supabase startup, three
  standalone concurrency scripts, and vendor syntax checking on every push. It
  omitted the accepted package/release/fixture-acceptance and event patch
  whitespace gates from revised Delivery Task 4.
- The exact development dependency freeze omitted Delivery Task 2's accepted
  MIT `tsx@4.23.12` dependency.

The workflow, package, runtime, and license state were already accepted. Only
the frozen provenance assertions had drifted.

## Change

Only `tests/provenance/no-llm-wiki-code.test.ts` changed:

- Requires exactly one `verify` job with read-only `contents` permission,
  pinned actions/Node/pnpm, frozen install, verification, extension test,
  project-local Supabase startup, reset/pgTAP, local fixture environment
  export, extension package/release check, top-level acceptance, real event
  patch whitespace check with root fallback, and always teardown.
- Requires local `supabase status -o env` followed by sourcing its output before
  exporting `$SERVICE_ROLE_KEY` and the fixed `fixture-job-secret` sentinel.
- Requires all three previously reverified concurrency scripts and the vendor
  syntax step to remain absent from the push gate.
- Rejects both dot and bracket GitHub Secrets expressions, Supadata/OpenAI/live
  gateway variables, and embedded secret-like values.
- Adds only exact `tsx: "4.23.12"` to the frozen development dependency object;
  every other dependency and extension release assertion remains unchanged.

No CI, package, lockfile, runtime, acceptance, migration, generated, license,
or other test file changed.

## GREEN evidence

- `CI=true pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts -t 'fixture-only CI freeze gate'`: 2/2 passed; 4 skipped.
- `CI=true pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts`: 6/6 passed.
- `CI=true pnpm eslint tests/provenance/no-llm-wiki-code.test.ts`: exit 0.
- `git diff --check`: exit 0.
- Final independent read-only re-review: no findings; ready.

## Risks and licensing

- This is an intentionally exact source freeze for a small personal-project
  workflow. Deliberate CI formatting or dependency changes must update the
  provenance contract in the same reviewed change.
- Only the fixed local job-secret sentinel and service role produced by local
  `supabase status` are permitted; live Provider/GitHub secret paths remain
  forbidden.
- No upstream content was fetched or copied. Root MIT licensing, YouTube Digest
  provenance, and LLM Wiki GPL method-only isolation are unchanged.
