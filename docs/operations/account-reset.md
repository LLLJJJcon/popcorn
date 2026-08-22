# Reset local accounts

Popcorn has no account-deletion UI. Account removal and full resets for this
personal setup happen only in the local Supabase instance.

## Personal-project boundary

Direct per-account deletion is not supported once an account has Popcorn data.
Supabase Studio at `http://127.0.0.1:54323` remains useful for inspection, but
do not use its Authentication / Users delete action for a populated Popcorn
account.

This school/personal reference setup deliberately supports a full local reset,
not selective account deletion. If you only want to stop using one account
without erasing every local user, sign out, disable the extension, and leave
the stored data intact.

## Supported removal and reset

Stop Web and the worker with Ctrl-C. **Destructive to the local Popcorn
database:** `pnpm db:reset` is the only supported removal/reset path for this
personal setup. It removes all local accounts and all learning data before
applying the migrations and local seed again:

```bash
pnpm db:reset
```

Never use this command for a hosted database. Restart Web and the worker, then
create the account again through `/sign-in`.
