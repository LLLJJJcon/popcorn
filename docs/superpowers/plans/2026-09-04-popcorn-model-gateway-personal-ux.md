# Popcorn Personal Model Gateway UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the normal two-stage gateway setup ceremony with one save-and-activate interaction while keeping a just-entered API key revealable only in current React memory.

**Architecture:** Keep the existing create and consent HTTP/RPC boundaries, but orchestrate them sequentially behind one client submit. Store only keys typed during the current component lifetime in an in-memory map keyed by configuration ID; never extend server view schemas or browser persistence. A second sequential task simplifies pending recovery and applies the same transient-key behavior to rotation/revoke.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, CSS Modules, Zod-backed existing API schemas, Vitest, Testing Library, user-event.

**Spec:** `docs/superpowers/specs/2026-09-04-popcorn-model-gateway-personal-ux.md`

## Global Constraints

- Popcorn remains an English-first personal app for English speakers learning Mandarin from the YouTube video they are currently watching.
- A stored API key must never be returned by an endpoint, RPC, settings response, or server-rendered page.
- A transient key may exist only in mounted React state after the user types it; never use localStorage, sessionStorage, cookies, URL/history state, logs, or DOM text outside its controlled key field.
- Refresh, navigation away, sign-out, unmount, or a new login must make the transient plaintext unrecoverable.
- Keep the existing create, consent, rename, rotate, and revoke DTOs/endpoints; do not change contracts, services, repositories, Vault/RPC code, migrations, generated types, root configuration, dependencies, or lockfile.
- Keep exact-destination consent and the fixed data classes: `Video title`, `Necessary Chinese transcript excerpt or selection`, `Timestamps`, and `Versioned prompt`.
- Normal setup shows one checkbox and one primary action named `Save and activate gateway`.
- Existing pending configurations use a recovery-only action named `Confirm and finish activation` without another checkbox.
- API-key fields remain password-masked by default, retain the accepted gateway-specific autofill isolation, and use text-only `Show key` / `Hide key` controls.
- Preserve owner isolation, auth, key masking, write-only server behavior, non-secret generic errors, worker resolution, Provider behavior, queue recovery, and YouTube-only scope.
- No new image, font, package, Provider, analytics, quota, OAuth, CAPTCHA, commercial flow, or GPLv3 code/prompt/component/asset.

---

## File map and ownership

- `src/app/settings/model-gateway/model-gateway-settings.tsx`: owns UI state, existing settings requests, combined client orchestration, transient key display, pending recovery, and lifecycle controls.
- `src/app/settings/model-gateway/model-gateway-settings.test.tsx`: observes the real component's requests, states, accessible controls, transient lifetime, and non-persistence.
- `src/app/settings/model-gateway/model-gateway-settings.module.css`: optional presentation for disclosure and transient-key rows using the existing palette and focus patterns.
- `docs/engineering/handoffs/delivery/task-5-gateway-personal-ux-1.md`: Task 1 RED/GREEN and verification evidence.
- `docs/engineering/handoffs/delivery/task-5-gateway-personal-ux-2.md`: Task 2 RED/GREEN and verification evidence.

The Controller alone owns the design/plan, shared contracts, migrations, generated types, root configuration, lockfile, integration ledger, Delivery Task 5 evidence, final browser verification, and integration.

### Task 1: One-action create/activate and transient created-key display

**Files:**
- Modify: `src/app/settings/model-gateway/model-gateway-settings.tsx`
- Modify: `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- Optional modify: `src/app/settings/model-gateway/model-gateway-settings.module.css`
- Create: `docs/engineering/handoffs/delivery/task-5-gateway-personal-ux-1.md`

**Interfaces:**
- Consumes: existing `requestSettings()`, `ModelGatewayConfigViewSchema`, `PUT /api/v1/settings/model-gateway`, and `POST /api/v1/settings/model-gateway/consent`.
- Produces: component-local `sessionKeys: Record<string, { value: string; revealed: boolean }>` behavior; one normal-flow consent checkbox; one `Save and activate gateway` action; an active-card key display labelled with the literal prefix `API key entered this session for ` followed by `config.displayName`.
- Does not produce a reusable server/shared interface.

- [ ] **Step 1: Name the regressions and write the failing normal-flow tests**

Add real-component tests with literal fixtures that fail if the component:

1. shows the old `Save gateway` action or a pending-consent step after a normal success;
2. omits the Step 1 exact destination/data-class disclosure and single checkbox;
3. fails to send create then consent in order with the existing exact DTOs;
4. fails to reset Step 1 after the active refetch; or
5. clears or exposes the just-entered key incorrectly.

Use this observable shape in the tests:

```tsx
const consent = screen.getByRole("checkbox", {
  name: /confirm this exact destination and data sharing/i,
});
await user.click(consent);
await user.click(screen.getByRole("button", {
  name: "Save and activate gateway",
}));

expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
  displayName: "Study Gateway",
  baseUrl: "https://gateway.example.com/v1",
  model: "model-v2",
  apiKey: "create-secret",
});
expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({
  configId: CONFIG_ID,
  exactBaseUrl: "https://gateway.example.com/v1",
  policyVersion: "model-egress-v1",
  confirmed: true,
});

const sessionKey = await screen.findByLabelText(
  "API key entered this session for Study Gateway",
);
expect(sessionKey).toHaveAttribute("type", "password");
expect(sessionKey).toHaveValue("create-secret");
expect(screen.queryByRole("group", {
  name: "Confirm data sharing for Study Gateway",
})).not.toBeInTheDocument();
```

The fetch sequence is exactly: initial GET, create PUT returning `pending`,
consent POST returning `active`, final GET returning `[active]`.

- [ ] **Step 2: Run the focused tests and record RED**

Run:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx -t "creates and activates with one confirmation|keeps a newly entered key only for the mounted page"
```

Expected: FAIL because the baseline button is `Save gateway`, consent exists only
on the pending card, the key is cleared immediately, and no session-key field exists.

- [ ] **Step 3: Extract one mutation parser without changing API behavior**

Keep `requestSettings()` unchanged. Add this task-local request primitive so the
combined create flow can use the returned non-secret configuration before the
single final refetch:

```ts
async function requestConfig(
  endpoint: string,
  method: "PUT" | "POST" | "DELETE",
  body: unknown,
): Promise<ModelGatewayConfigView> {
  const response = await fetch(endpoint, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new TypeError("mutation failed");
  const parsed = apiSuccessSchema(ModelGatewayConfigViewSchema).safeParse(
    await parseJson(response),
  );
  if (!parsed.success) throw new TypeError("mutation failed");
  return parsed.data.data;
}
```

Refactor the existing generic `mutate()` to call `requestConfig()` and then its
existing `requestSettings()` refetch. Do not change its public component behavior
for rename, rotate, consent recovery, or revoke in this task.

- [ ] **Step 4: Add transient state and the reusable disclosure/display markup**

Add exactly component-local state:

```ts
type SessionKey = { readonly value: string; readonly revealed: boolean };

const [createConsent, setCreateConsent] = useState(false);
const [sessionKeys, setSessionKeys] = useState<Record<string, SessionKey>>({});
```

Create small same-file presentation components or functions only when they
remove duplicate JSX:

```ts
function DataSharingSummary({ exactBaseUrl }: { readonly exactBaseUrl: string })
function SessionKeyDisplay({
  config,
  sessionKey,
  onToggle,
}: {
  readonly config: ModelGatewayConfigView;
  readonly sessionKey: SessionKey;
  readonly onToggle: () => void;
})
```

`SessionKeyDisplay` renders a controlled read-only input whose `type` is
`sessionKey.revealed ? "text" : "password"`, whose accessible label is
`API key entered this session for ${config.displayName}`, and whose adjacent
button name is `Show key` or `Hide key`. It also renders the fixed explanation
`Available until you refresh or leave this page.` Do not render the key in a
paragraph, data attribute, status message, error, hidden input, or key prop.

- [ ] **Step 5: Implement the one-action successful create flow**

Change `createGateway` so local validation requires all four fields plus
`createConsent`. Keep one `busy` period across both requests. On success:

```ts
const created = await requestConfig(SETTINGS_ENDPOINT, "PUT", {
  displayName: displayName.trim(),
  baseUrl: baseUrl.trim(),
  model: model.trim(),
  apiKey: writeOnlyKey,
});
const activated = await requestConfig(CONSENT_ENDPOINT, "POST", {
  configId: created.id,
  exactBaseUrl: created.baseUrl,
  policyVersion: "model-egress-v1",
  confirmed: true,
});
if (activated.id !== created.id || activated.state !== "active") {
  throw new TypeError("mutation failed");
}
const nextSettings = await requestSettings();
```

Then set the refetched settings, store `{ value: writeOnlyKey, revealed: false }`
under `activated.id`, clear the four Step 1 fields and checkbox, and set
`Gateway saved and activated.` Do not clear the key before validation or before
the request outcome is known.

In Step 1, render `DataSharingSummary` from `baseUrl.trim()`, the one confirmation
checkbox, and the renamed primary button. Associate validation errors with the
form/fields using the existing alert ID. Leave the existing pending card intact
until Task 2 so activation failure remains recoverable between tasks.

- [ ] **Step 6: Implement reveal/hide as a network-free visual operation**

Render `SessionKeyDisplay` inside the matching configured card when
`sessionKeys[config.id]` exists. Toggle only the matching `revealed` boolean:

```ts
setSessionKeys((current) => ({
  ...current,
  [config.id]: {
    ...current[config.id],
    revealed: !current[config.id].revealed,
  },
}));
```

The test records the fetch call count before Show/Hide, asserts password → text
→ password, and asserts the count does not change.

- [ ] **Step 7: Prove key lifetime and browser non-persistence**

Extend the existing unmount/remount test: complete one successful create, unmount,
render a fresh component whose GET returns `[active]`, and assert:

```tsx
expect(screen.queryByLabelText(
  "API key entered this session for Study Gateway",
)).not.toBeInTheDocument();
expect(screen.getByText("Key saved")).toBeInTheDocument();
expect(storage).not.toHaveBeenCalled();
expect(window.location.href).not.toContain("create-secret");
```

Keep the existing console/history/HTML nonleakage assertions. Do not inspect or
mock a real browser password manager.

- [ ] **Step 8: Run Task 1 GREEN and focused regressions**

Run:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm vitest run tests/integration/model-gateway/settings-api.test.ts tests/integration/model-gateway/settings-service.test.ts tests/integration/model-gateway/settings-web-auth.test.ts
pnpm exec eslint src/app/settings/model-gateway/model-gateway-settings.tsx src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm typecheck
git diff --check
git status --short
```

Expected: component suite and the three server/auth regression files PASS;
ESLint/typecheck/diff PASS; status lists only Task 1 allowed files.

- [ ] **Step 9: Write the Task 1 handoff and commit**

The handoff records named regression → RED reason → minimal implementation →
GREEN counts, exact files, server-contract non-change, non-persistence evidence,
risks, and commit SHA.

```bash
git add src/app/settings/model-gateway/model-gateway-settings.tsx \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx \
  src/app/settings/model-gateway/model-gateway-settings.module.css \
  docs/engineering/handoffs/delivery/task-5-gateway-personal-ux-1.md
git commit -m "feat: streamline model gateway setup"
```

Omit the CSS path if unchanged. The Controller dispatches a fresh independent
reviewer over the recorded baseline-to-HEAD diff before Task 2.

### Task 2: Pending recovery and transient rotation/revoke lifecycle

**Files:**
- Modify: `src/app/settings/model-gateway/model-gateway-settings.tsx`
- Modify: `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- Optional modify: `src/app/settings/model-gateway/model-gateway-settings.module.css`
- Create: `docs/engineering/handoffs/delivery/task-5-gateway-personal-ux-2.md`

**Interfaces:**
- Consumes: Task 1 `requestConfig`, `DataSharingSummary`, `SessionKeyDisplay`,
  `sessionKeys`, and one-action create flow.
- Produces: recovery-only `Confirm and finish activation`; transient key update
  after rotation; immediate transient-key removal after successful revoke.
- Keeps all server/shared interfaces unchanged.

- [ ] **Step 1: Write failing activation-failure and recovery tests**

Add a literal fetch sequence: initial GET empty, create PUT returning `pending`,
consent POST returning 500, recovery GET returning `[pending]`. Assert:

```tsx
expect(await screen.findByRole("alert")).toHaveTextContent(
  "Gateway saved but not activated. Finish activation below.",
);
expect(screen.getAllByRole("region", { name: "Study Gateway" })).toHaveLength(1);
expect(screen.getByRole("button", {
  name: "Confirm and finish activation",
})).toBeInTheDocument();
expect(screen.queryByRole("checkbox", {
  name: /confirm this exact destination/i,
})).not.toBeInTheDocument();
expect(fetchMock.mock.calls.filter(([url, options]) =>
  url === "/api/v1/settings/model-gateway" && options?.method === "PUT"
)).toHaveLength(1);
```

Then click the recovery button against consent-success and final-GET fixtures;
assert the existing exact consent DTO and active state.

- [ ] **Step 2: Run recovery tests and record RED**

Run:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx -t "keeps one pending gateway when activation fails|finishes activation with one recovery action"
```

Expected: FAIL because the Task 1 candidate still uses the baseline pending
checkbox/`Activate gateway` surface and generic combined-flow error handling.

- [ ] **Step 3: Make create partial failure deterministic**

Track the non-secret `created` configuration inside `createGateway`. If an error
occurs after create returned:

1. remember the submitted key under `created.id`, masked;
2. clear the four Step 1 fields and its consent checkbox;
3. try one `requestSettings()` refetch and use it when valid;
4. if that refetch fails, insert or replace the returned `created` public view in
   the existing settings list without duplicating its ID;
5. set the exact alert text `Gateway saved but not activated. Finish activation below.`;
6. never issue another create request automatically.

If create itself fails before a valid public configuration exists, keep the
entered fields/key for correction and use the existing generic error. Activation
success with a malformed response must fail closed; a refetch that already shows
the same config active may be accepted as the authoritative state and complete
the normal success cleanup.

- [ ] **Step 4: Replace repeated pending consent with one recovery action**

Pending cards continue to show `DataSharingSummary` for their exact stored base
URL, but remove the pending-card checkbox and its `consents` map. Render one
button named `Confirm and finish activation`. Its click calls the existing
consent endpoint with:

```ts
{
  configId: config.id,
  exactBaseUrl: config.baseUrl,
  policyVersion: "model-egress-v1",
  confirmed: true,
}
```

After success, refetch and report `Gateway activated.` Busy state prevents a
second click. A failure retains pending state and a generic retryable alert.

- [ ] **Step 5: Write failing rotation/revoke transient-key tests**

Strengthen the existing lifecycle test so a successful rotation:

- closes the rotation editor;
- renders the new value in the same card's masked session-key field;
- toggles Show/Hide without a request;
- keeps the exact existing rotate DTO.

After successful revoke, assert the session-key field and reveal button disappear,
the card is revoked, and the existing revoke DTO is unchanged.

- [ ] **Step 6: Run lifecycle tests and record RED**

Run:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx -t "renames, rotates|removes the transient key after revoke"
```

Expected: FAIL because rotation does not populate Task 1 `sessionKeys`, its input
clears before outcome, and revoke does not explicitly remove transient state.

- [ ] **Step 7: Implement rotation/revoke transient lifecycle**

On successful rotation and settings refetch, write the submitted key to
`sessionKeys[config.id]` with `revealed: false`, clear and close the rotation
editor, and report `API key replaced.` On validation or mutation failure, retain
the typed rotation key for correction; never include it in error/status text.

On successful revoke, remove both the rotation draft and transient key for that
ID before closing confirmation:

```ts
setSessionKeys((current) => {
  const next = { ...current };
  delete next[config.id];
  return next;
});
```

Do not change rename behavior or add a server key-read operation.

- [ ] **Step 8: Run Task 2 GREEN, full focused regressions, and mutation checks**

Run:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm vitest run tests/integration/model-gateway/settings-api.test.ts tests/integration/model-gateway/settings-service.test.ts tests/integration/model-gateway/settings-web-auth.test.ts tests/integration/model-gateway/runtime-resolver.test.ts
pnpm exec eslint src/app/settings/model-gateway/model-gateway-settings.tsx src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm typecheck
git diff --check
git status --short
```

Perform these source-independent mutation checks by temporarily changing only the
candidate implementation, running the named focused test, then restoring it:

- omit consent POST after create → normal-flow test must fail;
- write a transient key under the wrong config ID → matching-card test must fail;
- remove pending refetch/fallback → activation-failure test must fail;
- keep session key on revoke → revoke test must fail.

Expected: every mutation is detected; final files are restored; all focused tests,
ESLint, typecheck, and diff pass.

- [ ] **Step 9: Write Task 2 handoff and commit**

Record RED/GREEN, partial-failure sequence, exact request counts and bodies,
mutation evidence, non-persistence/nonleakage, changed files, residual risks,
and commit SHA.

```bash
git add src/app/settings/model-gateway/model-gateway-settings.tsx \
  src/app/settings/model-gateway/model-gateway-settings.test.tsx \
  src/app/settings/model-gateway/model-gateway-settings.module.css \
  docs/engineering/handoffs/delivery/task-5-gateway-personal-ux-2.md
git commit -m "fix: recover model gateway activation"
```

Omit the CSS path if unchanged. The Controller dispatches a new independent
reviewer over Task 2's baseline-to-HEAD diff.

### Task 3: Controller integration and live acceptance gate

**Files:**
- Modify: `docs/engineering/execution-ledger.md`
- Do not modify Delivery Task 5 evidence until this gate passes.

**Interfaces:**
- Consumes: independently accepted Task 1 and Task 2 commits.
- Produces: accepted integration commit and a running local page ready for the
  existing Delivery Task 5 real YouTube/gateway smoke.

- [ ] **Step 1: Integrate only independently accepted commits**

Cherry-pick Task 1 and Task 2 commits in order into
`codex/popcorn-youtube-learning`. Apply the same accepted commits to the
credential-holding Delivery Task 5 live worktree without reading `.env.local`.

- [ ] **Step 2: Run the focused integration gate**

Run:

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm vitest run tests/integration/model-gateway/settings-api.test.ts tests/integration/model-gateway/settings-service.test.ts tests/integration/model-gateway/settings-web-auth.test.ts tests/integration/model-gateway/runtime-resolver.test.ts
pnpm exec eslint src/app/settings/model-gateway/model-gateway-settings.tsx src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm typecheck
git diff --check
git status --short
```

Do not repeat database reset, pgTAP, queue/concurrency, full application, build,
extension, Provider, or load gates because no associated boundary changes.

- [ ] **Step 3: Verify the real local browser behavior**

Against the running local app, with the user typing any sensitive value:

1. verify one Step 1 disclosure/checkbox/button;
2. save and activate one gateway with one user action;
3. verify active Step 2 card and masked transient key;
4. verify Show/Hide changes only visibility;
5. refresh and verify the key plaintext is no longer present while `Key saved`
   remains;
6. verify desktop and 390×844 layouts have no horizontal overflow;
7. if partial-failure UI is not safely reproducible against live data, rely on
   the accepted deterministic component test rather than corrupting a real config.

Never read or emit the key value. Observe only field presence, input type, status,
and public configuration state.

- [ ] **Step 4: Record and publish the gate**

Update `docs/engineering/execution-ledger.md` with both task review verdicts,
focused test counts, browser evidence, accepted commits, deferred minor findings,
and the next Delivery Task 5 step. Commit the ledger and push the implementation
branch to the authorized GitHub remote. Then resume the existing bounded real
YouTube/provider smoke; do not merge `main` until Delivery Task 6.
