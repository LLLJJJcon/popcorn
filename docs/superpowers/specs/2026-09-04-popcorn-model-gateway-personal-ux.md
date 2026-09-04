# Popcorn Personal Model Gateway UX Design

**Date:** 2026-09-04  
**Status:** User-approved interaction direction; pending written-spec review  
**Scope:** Local, personal/school-project model gateway configuration

## Context

Popcorn lets an authenticated local user configure an OpenAI-compatible model
gateway. The current flow intentionally separates creation from exact-destination
consent:

1. Step 1 creates a `pending_consent` configuration and immediately clears the
   API-key field.
2. Step 2 repeats the destination and data classes, requires a checkbox, and
   activates the configuration.

The separation is defensible for a multi-user commercial service, but it makes
the personal local setup feel like the same confirmation is being requested
twice. Clearing the key immediately also prevents the user from checking the
value they just entered.

The user chose a local-session compromise: the browser may retain and reveal
the key that the user just typed for the lifetime of the current rendered page,
but the server must never return stored key plaintext.

## Goals

- Make the normal new-gateway path one understandable user action: review one
  disclosure, confirm it once, then save and activate.
- Let the user inspect the API key entered during the current page session with
  an explicit show/hide control.
- Keep Step 2 focused on configured gateway status and maintenance rather than
  repeating the normal-path consent ceremony.
- Retain a small recovery path when configuration creation succeeds but
  activation fails.
- Keep the existing local account, Vault storage, exact destination consent,
  gateway DTOs, endpoints, worker resolution, and Provider behavior.

## Non-goals

- No endpoint, RPC, or database interface may return a stored API key to the
  browser.
- No key may be stored in localStorage, sessionStorage, cookies, URL state,
  browser history, logs, DOM text outside the controlled key field, or server
  response payloads.
- No new authentication method, re-authentication flow, gateway adapter,
  Provider type, deployment mode, analytics, quota, or commercial security
  subsystem.
- No migration, generated database type, shared model-gateway contract, root
  configuration, dependency, or lockfile change.
- No change to YouTube-only capture, learning artifacts, mastery, queue, or
  extension behavior.

## User experience

### Step 1: add and activate a gateway

The existing fields remain:

- Gateway base URL
- Display name
- Model
- API key

Below them, Step 1 shows the exact destination derived from the entered base URL
and the fixed data classes Popcorn may send:

- Video title
- Necessary Chinese transcript excerpt or selection
- Timestamps
- Versioned prompt

The user must select one checkbox confirming this exact destination and data
sharing. The single primary action is **Save and activate gateway**. It is
disabled until all fields are non-empty and confirmation is selected.

The normal successful path presents one disclosure, one checkbox, and one
button click. The interface reports **Gateway saved and activated.**

### Step 2: configured gateways

Step 2 lists configurations and retains the existing state, model, revision,
rename, key rotation, and revoke controls. Active configurations do not repeat
the consent fieldset.

For a new or rotated key entered during this mounted page session, the matching
configuration card shows a labelled password-style field plus a **Show key** / 
**Hide key** button. The field is masked by default. Revealing is a local visual
operation and causes no network request. The UI labels the value **Available
until you refresh or leave this page**.

After refresh, navigation away, sign-out, unmount, or a new login, the in-memory
value is gone. The card then shows only the existing non-secret **Key saved**
status and the rotation control.

After a successful creation, Step 1 resets its fields and confirmation so an
accidental second submit cannot create a duplicate. The just-entered key remains
available only in its Step 2 card.

### Recovery-only pending state

The client still uses the existing two server mutations. If creation succeeds
but activation fails, the created configuration remains `pending_consent` and
Step 2 shows:

- its exact destination and fixed data classes;
- a single **Confirm and finish activation** button whose click is the consent
  action;
- an error explaining that the gateway was saved but is not active.

No checkbox is repeated in this exceptional recovery surface. The button label
itself is the explicit confirmation. Existing pending configurations created
before this change use the same recovery surface.

## Component state and data flow

The client component adds transient state keyed by configuration ID:

- `sessionKeys: Record<configId, apiKey>` for keys entered in this mounted page;
- `revealedKeys: Record<configId, boolean>` for visual masking state;
- one create-form consent boolean.

The state exists only in React memory. It is never initialized from a settings
response and is not serialized.

Normal create flow:

1. Validate the four fields and checked consent locally.
2. Keep the submitted key in a local variable; do not expose it in status/error
   messages.
3. `PUT /api/v1/settings/model-gateway` using the existing create DTO.
4. Parse the returned non-secret configuration to obtain its ID and exact base
   URL.
5. `POST /api/v1/settings/model-gateway/consent` using the existing consent DTO
   with `confirmed: true`.
6. Refetch settings using the existing authenticated request.
7. Only after the server reports the configuration as active, associate the
   submitted key with that configuration ID in `sessionKeys`, reset Step 1, and
   show the success status.

No API schema or backend service changes are required. The two server-side
operations remain separate so a failed activation cannot be reported as active.

Rotation flow keeps its existing DTO and mutation. After a successful rotation
and refetch, the newly entered key replaces that configuration's transient
`sessionKeys` value and remains masked until explicitly revealed.

Revoking a configuration immediately removes its transient key and reveal state.

## Failure handling

- Local validation failure sends no request and leaves the entered key available
  in the create field for correction.
- Creation failure sends no activation request, reports the existing generic
  non-secret error, and leaves the key available for correction/retry.
- Creation success followed by activation failure records the submitted key in
  transient memory for that pending configuration, refetches settings, clears
  the create form to prevent duplicate creation, and reports that activation
  still needs finishing.
- Recovery activation failure keeps the configuration pending and reports a
  generic retryable error without key, URL-internal, Vault, or Provider details.
- A malformed create or activation response fails closed and never claims the
  gateway is active.
- Busy state prevents duplicate create/activate submissions across the combined
  flow.

## Accessibility and presentation

- Preserve the current warm cream/paper, terracotta, rounded editorial visual
  language.
- Associate disclosure, checkbox, validation error, password field, and
  show/hide button with explicit labels and accessible descriptions.
- The reveal control uses a real button with an accessible name that changes
  with state; it does not rely on an icon alone.
- Masked and revealed states remain keyboard operable and retain visible focus.
- Success and failure changes use the existing live status/alert regions.
- Desktop and mobile layouts must not introduce horizontal overflow.

## Test strategy

Implementation uses strict RED→GREEN cycles against the real React component.

1. **Combined normal path:** one checked disclosure and one button produce the
   existing create request followed by the existing consent request; success
   refetches once, yields an active card, and resets Step 1.
2. **Transient key display:** the submitted key appears only in the matching
   card's password input, masked by default; show/hide changes only its input
   type and performs no request.
3. **Lifetime:** remounting the component cannot recover the key from responses
   or browser storage; the active card reports only `Key saved`.
4. **Failure boundaries:** create failure makes no consent call; activation
   failure produces one pending configuration and recovery action without a
   second create; malformed responses fail closed.
5. **Recovery consent:** one recovery button sends the existing exact consent
   DTO and activates the pending card without a repeated checkbox.
6. **Rotation and revoke:** successful rotation updates the transient displayed
   key; revoke removes it. Existing rename/rotation/revoke DTO assertions remain.
7. **Security regression:** keys never enter status/error text, DOM outside the
   controlled field, storage, URL/history, or server response fixtures.
8. **Focused regressions:** existing model-gateway settings API/service,
   authentication, write-only boolean, consent, and component suites stay green.

Browser verification covers the successful normal flow, key reveal/mask,
refresh disappearance, recovery presentation where practical, and desktop/
mobile visual consistency. Real Provider egress remains part of Delivery Task 5
after one active gateway exists.

## File ownership and expected implementation surface

Feature implementation is expected to remain in:

- `src/app/settings/model-gateway/model-gateway-settings.tsx`
- `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- `src/app/settings/model-gateway/model-gateway-settings.module.css` only if the
  existing styles cannot express the approved controls
- one task handoff document

The Controller retains ownership of shared contracts, migrations, generated
types, root configuration, lockfile, final integration, and ledger updates.

## Upstream and license boundary

YouTube Digest commit `d03e1f61e017b032159ffd1821cac6e7693ce0c7`
is not in this settings flow and remains unchanged. LLM Wiki v0.6.9 commit
`723e259309aea5e3850265b631f80224f66dd9f6` is method-only inspiration;
no GPLv3 code, test, prompt, component, styling, or asset is copied.

## Acceptance criteria

- A first-time user confirms destination/data sharing once and uses one visible
  **Save and activate gateway** action.
- Successful creation results in one active configuration, not an additional
  pending confirmation step.
- The just-entered or just-rotated key can be masked/revealed during the current
  page session and cannot be recovered after refresh/remount.
- The server never returns key plaintext, and no browser persistence is added.
- Partial failure is recoverable without creating a duplicate gateway.
- Existing gateway lifecycle, exact-origin consent, authentication, Vault,
  owner isolation, Provider, queue, and YouTube learning behavior remain intact.
