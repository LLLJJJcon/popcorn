# Install the local Popcorn extension

Popcorn packages a local Chrome extension for the self-hosted app. It is not a
Chrome Web Store release and it does not connect to a hosted Popcorn service.

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
