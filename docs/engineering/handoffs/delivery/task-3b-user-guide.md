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
- Original review found that the first guide revision omitted “chat” from the gateway key's prohibited locations, even though this handoff incorrectly claimed that boundary was covered. Fix Round 1 corrects both the guide and this record.
- Links point only to the specified official sources (plus Git's official download page for the stated Git prerequisite).

## Risks and follow-up

- The guide deliberately does not endorse a particular model provider. Compatibility, model IDs, base URLs, and credentials must be obtained and verified from the chosen provider's own official documentation and console.
- `pnpm db:reset` remains irreversible for the local database; the guide repeatedly identifies its destructive scope.
- No real Supadata or gateway credential was used in verification, so actual external transcript and AI calls require the user's own valid credentials.

## Fix Round 1 — gateway key boundary and contract hardening

### Review finding verified

- The original gateway settings sentence listed `.env.local`, terminal commands, Chrome extensions, and Git, but not chat.
- The original focused test only searched the entire guide for each gateway label, so it did not prove that the labels were Web-only table rows or excluded from the `.env.local` table.

### RED

Enhanced only `tests/release/self-host-docs.test.ts`, then ran:

```bash
pnpm vitest run tests/release/self-host-docs.test.ts
```

Result: 1 failing and 9 passing tests. The expected failure was the new gateway-section boundary assertion: `gateway API key must stay out of local files, shells, Chrome, Git, and chat`. The received Web gateway section contained `.env.local`, terminal, Chrome, and Git but not `聊天`.

The same test now slices the `.env.local` table and the `### 5.` Web gateway section using stable headings. It requires each of the four Web fields to be a gateway-table row and requires none to be a local-configuration-table row.

### GREEN and verification

- Added `聊天` to the gateway API-key prohibition and to the matching AI/gateway troubleshooting row.
- Re-ran the required commands after the fix:

  ```bash
  pnpm vitest run tests/release/self-host-docs.test.ts
  pnpm exec eslint tests/release/self-host-docs.test.ts
  git diff --check
  ```

- Result: Vitest 10/10 passing; ESLint and `git diff --check` exited successfully.
