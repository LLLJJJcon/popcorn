# Recover local jobs and pending extension saves

Popcorn keeps Web jobs in local Supabase and keeps unsent extension saves in
the extension's local pending queue. A stopped worker or Web process does not
require recreating the saved learning moment.

## Restart durable Web jobs

1. Confirm Docker and local Supabase are running with
   `pnpm exec supabase status`.
2. Restart Web with `pnpm dev` in its terminal.
3. In a separate terminal, load `.env.local` and restart with
   `pnpm worker:local`.
4. Leave both processes running. Worker output is intentionally generic:
   `processed` means work was claimed, `empty` means nothing was due, and
   `failed` means the next bounded cycle will try again.

If cycles remain `failed`, check the local service categories in this order:

- Web: `APP_URL` must reach the running local app.
- Worker: `INTERNAL_JOB_SECRET` must be the same server-only value used by Web.
- Supabase: the Web server needs the local service-role value.
- Supadata: transcript resolution needs a valid `SUPADATA_API_KEY`.
- Model gateway: sign in to Web settings and confirm its exact destination has
  consent and is active.

These checks do not expose a job-control page; restart the local processes and
let the durable queue retry.

## Recover the extension pending queue

Do not remove the extension, clear its storage, or discard pending moments
while recovering them. Restore Supabase, Web, and the worker; sign in to the
extension as the same local account; then reopen the Popcorn side panel. Its
pending save queue remains in Chrome storage and retries automatically. Use
the visible retry action if it is offered.

If you regenerated `dist/popcorn-extension`, open `chrome://extensions` and
select **Reload** for Popcorn. Reloading preserves the installed extension's
pending queue; removing and loading a different extension identity may not.

Stop a running Web or worker process cleanly with Ctrl-C. For the normal local
shutdown sequence, return to the [self-host guide](local-self-host.md#11-shutdown).
