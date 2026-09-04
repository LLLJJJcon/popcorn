# Delivery Task 5D Handoff — Optional Local Proxy Configuration

## Status

Implementation commit: `cb3f3b0368a4180ad7e10fea88cd51a273b9778c`
(`feat: add optional local proxy configuration`).

## Delivered behavior

The one-click launcher now accepts one optional `POPCORN_PROXY_URL` from the
local environment file. It validates the value before Supabase, Web, or worker
startup without including the value in an error. A valid HTTP(S) origin derives
`HTTP_PROXY`, `HTTPS_PROXY`, `NODE_USE_ENV_PROXY`, and a deduplicated loopback
`NO_PROXY` value for the Web and worker child processes only. The Supabase and
launcher control paths are unchanged.

An omitted or empty setting leaves the existing child environment unchanged.
The launcher does not inspect or modify operating-system proxy settings, does
not add authentication or SOCKS handling, and does not persist or log the
setting.

The sample configuration and English/Chinese self-hosting guidance explain
direct access, TUN/global routing, and browser/system-proxy-only routing. They
also explain locating a local HTTP/Mixed port, restarting with the existing
one-click commands, and recovering from a wrong or unavailable proxy. Model
API keys remain confined to the signed-in gateway settings page. Node 24.5 or
later is now the package, documentation, and CI prerequisite.

## TDD evidence

### RED

Behavior tests were added before launcher, sample, documentation, package, or
CI edits. Against the baseline, the focused runtime assertion showed that the
custom setting remained inert: child services did not receive the required Node
proxy variables or loopback `NO_PROXY` entries. The new release assertions also
failed because the Node prerequisite, CI runtime, sample setting, and bilingual
guidance were absent.

A separate boundary RED added a non-origin HTTP spelling to the malformed-input
table. The baseline URL parser reached readiness instead of rejecting it before
service startup, proving that the explicit origin-prefix validation was needed.

### GREEN

```text
pnpm vitest run tests/integration/jobs/popcorn-local-runtime.test.ts tests/release/self-host-docs.test.ts tests/release/ci-scope.test.ts
pnpm exec tsc --noEmit
pnpm exec eslint scripts/popcorn-local.mjs tests/integration/jobs/popcorn-local-runtime.test.ts tests/release/self-host-docs.test.ts tests/release/ci-scope.test.ts
node --check scripts/popcorn-local.mjs
git diff --check 7c5352e7ca079999834a85259e55427ba4f88fd4..HEAD
```

With local-loopback permission, the Vitest command passed all 45 tests. The
type check, scoped lint, syntax check, and diff check exited successfully.

## Changed files

- `scripts/popcorn-local.mjs` — validates and derives a pure child-service
  environment without changing the control or Supabase paths.
- `tests/integration/jobs/popcorn-local-runtime.test.ts` — covers both child
  environments, preserved/deduplicated `NO_PROXY`, blank compatibility, and
  generic pre-spawn rejection for invalid input.
- `.env.example`, `docs/operations/local-self-host.md`, and
  `docs/operations/user-guide.zh-CN.md` — optional bilingual self-host
  configuration guidance and gateway-key boundary.
- `package.json`, `.github/workflows/ci.yml`, and associated release tests —
  Node 24.5+ prerequisite and CI alignment.

## Self-review and residual risk

The derivation returns a new environment only for validated configuration and
is shared by the two child spawns. Existing nonblank `NO_PROXY` entries are
kept once, including case-insensitive duplicate removal, before required
loopback entries are added. Validation happens during environment-file reading,
before the launcher opens its control channel or starts a service; its message
contains only the setting name and rule.

No live external proxy smoke was run: the task deliberately avoids automatic
system-proxy detection and external traffic. A self-host user must choose a
reachable HTTP/Mixed endpoint when browser-only routing needs one; the
documented fallback is to correct the endpoint or leave the optional setting
empty and restart.
