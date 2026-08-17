# Controller Contract Gate Handoff

- Status: DONE
- Plan and task: `2026-08-16-popcorn-batch-a-platform-capabilities.md`, Batch A Task 1 controller contract gate
- Worktree and branch: `/private/tmp/popcorn-extension-identity-contract`, `codex/popcorn-extension-identity-contract`
- Baseline SHA: `e9f3d292da3dd7ff352d8ba4ea232831ded9cc85`
- Commit SHA: returned to the controller after committing this report

## Implemented

- Changed `EXTENSION_REDIRECT_ORIGIN` from the extension request origin to the
  exact Chrome Identity callback origin
  `https://<stable-extension-id>.chromiumapp.org`.
- Added a branded redirect-origin schema that accepts exactly one HTTPS origin
  with a 32-character lowercase `a` through `p` extension ID and rejects
  credentials, ports, wildcards, paths, trailing slashes, queries, fragments,
  alternate hosts, uppercase IDs, and the former `chrome-extension://` value.
- Added `deriveExtensionRequestOrigin` to produce the separate trusted request
  origin `chrome-extension://<same-extension-id>` from validated server config.
- Added `assertExtensionRequestOrigin` to reject malformed or mismatched request
  origins while returning the exact derived request origin on success.
- Clarified the non-secret callback-origin format in `.env.example`; no new
  environment variable or credential was introduced.

## Upstream provenance used

- Chrome Identity API semantics are the contract source for this controller
  correction. No upstream implementation code applies.
- YouTube Digest `d03e1f61e017b032159ffd1821cac6e7693ce0c7`
  (MIT): no code, test, prompt, component, or asset copied or changed.
- LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6`
  (GPLv3): no method or implementation material used or copied.
- Existing MIT attribution and GPLv3 isolation are unchanged.

## Interfaces consumed and produced

- Consumed the stable manifest extension identity and Chrome Identity callback
  host convention.
- Produced a server-only validated callback origin, the typed derived extension
  request origin, and an equality assertion that proves both values encode the
  same stable extension ID.
- Downstream Task 1 routes should use `getServerEnv().EXTENSION_REDIRECT_ORIGIN`
  only as the callback origin and use `deriveExtensionRequestOrigin` or
  `assertExtensionRequestOrigin` for request `Origin` checks.

## Files changed

- `.env.example`
- `src/server/env.ts`
- `src/server/env.test.ts`
- `docs/engineering/briefs/batch-a/contract-extension-identity.md` (controller brief committed unchanged)
- `docs/engineering/handoffs/batch-a/contract-extension-identity.md`

No extension source, auth route/page, migration, generated type, dependency,
lockfile, root configuration, ledger, or unrelated file changed.

## TDD evidence

### RED

The newly created worktree initially had no usable dependency links, so the
first `pnpm` invocation stopped during an attempted network install. After
using the already locked local dependency tree, the genuine functional RED was:

```text
$ /private/tmp/popcorn-youtube-learning/node_modules/.bin/vitest run src/server/env.test.ts
exit 1
Test Files 1 failed (1)
Tests 5 failed | 13 passed (18)
```

The failures were the intended contract gaps: the new valid Chromium callback
origin was rejected, the former `chrome-extension://` environment value was
accepted, and both typed request-origin helpers were absent.

### GREEN

```text
$ pnpm vitest run src/server/env.test.ts
exit 0
Test Files 1 passed (1)
Tests 18 passed (18)
```

The suite covers exact derivation, same-ID acceptance, mismatch rejection, the
former origin type, malformed host/ID, path, trailing slash, port, query,
fragment, credentials, wildcard, and uppercase ID.

## Broader verification

```text
$ CI=true pnpm typecheck
exit 0

$ CI=true pnpm test:contract
exit 0; Test Files 1 passed (1); Tests 128 passed (128)

$ CI=true pnpm build
exit 0; Next.js production compilation and TypeScript passed

$ git diff --check
exit 0
```

Fresh final results are rerun immediately before commit.

## Contract or migration changes requested

None beyond this controller-approved environment contract gate. No migration,
generated database type, public API schema, dependency, or lockfile changed.

## Risks and follow-up

- Batch A Task 1 must update its callback URL validation and request `Origin`
  validation together; using the callback origin directly as an HTTP request
  origin would now fail by design.
- The actual stable extension ID remains deployment configuration. The schema
  prevents malformed identities but cannot prove that a supplied valid ID is
  the one packaged in the manifest; packaging/live acceptance must compare it.
- No live Chrome authentication was performed in this contract-only gate.
