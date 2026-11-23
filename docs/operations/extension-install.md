# Install the local Popcorn extension

Popcorn packages a local Chrome extension for the self-hosted app. It is not a
Chrome Web Store release and it does not connect to a hosted Popcorn service.

Prerequisites: Chrome 116 or newer, Node.js, and pnpm.

## Generate the extension

From the repository root, install the pinned dependencies and provide the
three public runtime settings for your local app and Supabase instance:

```bash
pnpm install --frozen-lockfile
APP_URL=http://127.0.0.1:3000 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key \
pnpm extension:package
```

This command retains the loadable unpacked directory at
`dist/popcorn-extension/` and creates:

- `dist/popcorn-extension.zip`
- `dist/popcorn-extension.sha256`

The ZIP is useful for copying the same local build to another machine. Chrome
loads the unpacked directory, not the ZIP.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose the repository's exact `dist/popcorn-extension/` directory.

The generated manifest retains Popcorn's stable public key, so regenerating an
extension from this repository keeps the same extension identity. It does not
preserve a different identity created from an edited manifest.

When extension code or any runtime URL changes, run `pnpm extension:package`
again. Then return to `chrome://extensions` and select **Reload** on Popcorn.
If Chrome reports a missing file after regeneration, use **Load unpacked**
again and select the newly generated `dist/popcorn-extension/` directory.

## Apply an updated local build

The approved desktop design updates the side panel, explanation, video Saved list,
account page and YouTube capture controls. The six capture types and stable
extension identity are retained.

After regenerating the directory:

1. Open `chrome://extensions` and select **Reload** on Popcorn.
2. Refresh any YouTube tabs that were open before the reload, then reopen Popcorn.
   A previously injected page script can otherwise keep an invalid extension
   message connection or continue to show an older error interface.
3. Use the gear in Popcorn for the extension's account settings. If an explanation
   says the session expired, use **Sign in to Popcorn**, then **Sign in again**
   with the same account. This recovery opens a separate browser window so the
   original video, selected Chinese and admitted explanation request remain open.
   Return to the video and select **Retry**. Queued moments are preserved.

A new account requires explicit sign-out first; pending moments must be handled
before switching owners. Authentication-service outages offer Retry rather than
claiming the session expired. Non-JSON API responses point to updating/restarting
Popcorn and reloading the extension; raw server output is never displayed.

For this local checkout, `node --env-file=.env.local scripts/build-local-extension.mjs`
rebuilds the unpacked extension from the configured local runtime values. Do not
reuse runtime settings from an earlier fixture build. Release packaging tests run
in temporary checkouts and must not modify the unpacked directory used by Chrome.

The legacy error `Failed to get explanation: Popcorn request failed.` identifies
an older side-panel script. It does not by itself establish a particular HTTP
status. Rebuild/reload the extension and refresh the old video tab before testing
the new recovery behavior.
