# Chrome extension design and Explain recovery

Date: 2026-11-23 (Asia/Shanghai).

## Delivered behavior

The real MV3 extension now uses the approved orange / sky-blue / lemon palette,
shared Popcorn mark, compact source header, underlined tabs, larger Chinese
transcript text, independent video Saved cards and separate account page.
Explain renders its four existing fields as distinct Meaning, Tone,
Communicative function and Contextual fit components. All six capture kinds,
native-text evidence, Copy actions, playback tracking and retry controls remain.

The gear opens extension account settings; Open Popcorn still opens Web.
Selection actions are clamped to the sidebar and disappear outside Transcript.
The explanation modal supports keyboard focus containment, Escape dismissal and
focus retention during Retry. Reconnecting from Explain opens a separate window
to preserve the original YouTube tab, selected Chinese and pending request.

## Reported error and evidence

The user reported `Failed to get explanation: Popcorn request failed.`.
The prefix exists in `69400bb7ce55a8743cd94b9b7e96cc17ec22b62a` at
`extension/sidepanel.js:2346`, and was removed by successor `92cb8e2`.
It does not exist in the current panel script or generated bundle. This confirms
that the reported UI was executing an older script, possibly from an older
unpacked directory or an existing page context.

The suffix was a generic API / worker fallback. That single string cannot prove
the original HTTP status, route, account state or model-provider availability.
Read-only checks found the local Web and authentication services online;
unauthenticated empty requests to both loopback forms of the explanations route
returned standard 401 JSON without creating a learning task. No personal browser
session, credentials or learning material was inspected or mutated.

## Recovery fixes

- Authentication absence, rejected refresh credentials, authentication-service
  outages and invalid authentication responses have separate bounded codes.
  Network / 5xx / 429 failures retain the session and offer Retry.
- HTML, empty and malformed API envelopes receive safe protocol / route errors;
  raw HTML, paths and provider errors are not rendered.
- Explain retains its source evidence. Pending requests continue the admitted
  job ID; transient retries keep request identity; only terminal learning-model
  failures create a new retry ID.
- Explicit same-account reconnect does not sign out or discard queued moments.
  A different returned user is rejected before the existing session is replaced.
  Switching accounts still requires the original explicit sign-out flow.
- Reconnect clears obsolete sign-out decision controls, preserving queued data.
- Old extension contexts explicitly ask the user to refresh the YouTube tab and
  reopen the panel.

## Verification

- Extension Node suite: **203 tests passed**. New bug regressions were observed
  failing before their fixes, then passing.
- Exact staged-file snapshot: **1,575 application tests passed**, TypeScript
  passed, and ESLint reported zero errors (four existing unrelated warnings).
- Actual unpacked-extension Chromium tests: **2 workflows passed**, using a
  temporary profile and intercepted mock cloud. They cover six exact save kinds,
  unchanged playback, worker recovery, narrow-sidebar selection, four-field
  explanation, contrast, expired-session recovery, same-account sign-in in a
  separate window and a successful Retry of the original selection.
- New README screenshots are actual extension DOM/CSS from that isolated
  browser. Test saves remain in fixture memory; no real login or model call is
  used. See `docs/assets/readme/SCREENSHOTS.md`.

These checks do not replace a final run in the user's signed-in Chrome session.
After rebuilding, reload Popcorn in `chrome://extensions`, refresh the previously
open YouTube tab and reopen the panel. See `docs/operations/extension-install.md`.

## Review decisions

The final independent review identified account ownership during reconnect,
authentication outage classification, keyboard Retry focus and panel lifetime
during login. Each was corrected with regression coverage. A stale destructive
sign-out prompt was treated as a recovery defect and cleared on reconnect;
queued records are never cleared by that UI change. No findings remain deferred.
