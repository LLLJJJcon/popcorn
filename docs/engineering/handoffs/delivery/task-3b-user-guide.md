# Delivery Task 3B — Chinese user guide handoff

## Scope

Implemented the approved Chinese, non-technical local-user guide and a prominent README entry point. The work follows the task brief in `docs/engineering/briefs/delivery/task-3b-user-guide.md`; no application, configuration, environment template, English guide, dependency, lockfile, CI, launcher, or migration file was changed.

## TDD evidence

### RED

1. Installed dependencies with `pnpm install --frozen-lockfile`. The first sandboxed attempt could not resolve the package registry; the required retry used the existing content-addressable store and completed with pnpm 11.19.0.
2. Added only the focused contract in `tests/release/self-host-docs.test.ts`.
3. Ran:

   ```bash
   pnpm vitest run tests/release/self-host-docs.test.ts
   ```

4. Result: 1 failing and 9 passing tests. The new test failed at the expected missing README link assertion:

   ```text
   expected README to match /...中文...docs\/operations\/user-guide\.zh-CN\.md/
   ```

   This was the intended failure: neither the Chinese README entry point nor the guide existed.

### GREEN

1. Added `docs/operations/user-guide.zh-CN.md` and the README link.
2. The guide includes the required daily start/stop path, clearly separate one-time setup, six-field local configuration table, four-field signed-in Web gateway table, first-use workflow, persistence explanation, external-key boundaries, and symptom-based troubleshooting.
3. Re-ran the focused contract:

   ```bash
   pnpm vitest run tests/release/self-host-docs.test.ts
   ```

4. Result: 1 passing test file, 10 passing tests, 0 failures.

## Fresh verification

Executed after implementation:

```bash
pnpm vitest run tests/release/self-host-docs.test.ts
pnpm exec eslint tests/release/self-host-docs.test.ts
git diff --check
git status --short
```

Results:

- Vitest: 10/10 tests passed.
- ESLint: exited successfully with no diagnostics.
- `git diff --check`: exited successfully with no whitespace errors.
- Status before commit contained only the three product files plus this handoff file.

## Files changed

- `README.md`
- `docs/operations/user-guide.zh-CN.md`
- `tests/release/self-host-docs.test.ts`
- `docs/engineering/handoffs/delivery/task-3b-user-guide.md`

## Self-review

- README link resolves to the new Chinese guide and is visually prominent near the project introduction.
- The test checks the stable guide path, all six local field names, distinct Chinese Web-only gateway labels, and all daily start/stop entry points; it avoids paragraph- or vendor-copy matching.
- The guide uses the precise local URLs, command names, gateway transport rule, and extension path from the brief.
- Secret handling is explicit: no examples contain actual credentials; service-role values stay out of Chrome; gateway keys stay out of `.env.local`, shell commands, Git, and chat.
- Links point only to the specified official sources (plus Git's official download page for the stated Git prerequisite).

## Risks and follow-up

- The guide deliberately does not endorse a particular model provider. Compatibility, model IDs, base URLs, and credentials must be obtained and verified from the chosen provider's own official documentation and console.
- `pnpm db:reset` remains irreversible for the local database; the guide repeatedly identifies its destructive scope.
- No real Supadata or gateway credential was used in verification, so actual external transcript and AI calls require the user's own valid credentials.
