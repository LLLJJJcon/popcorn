# Reset or remove a local account

Popcorn has no account-deletion UI. Account removal and full resets for this
personal setup happen only in the local Supabase instance.

## Remove one local account

1. Stop the worker with Ctrl-C so it does not process that account's jobs.
2. Open Supabase Studio at `http://127.0.0.1:54323`.
3. Open **Authentication / Users**, select the local user, and delete it.
4. Return to `http://127.0.0.1:3000/sign-in` and choose **Create account** if
   you want a new local account.

The extension may still hold pending saves for the removed user. Review them
before removal; afterward, sign out and explicitly discard that old local
queue before signing in with a different account.

## Reset every local account and all local data

Stop Web and the worker with Ctrl-C. **Destructive to the local Popcorn
database:** this erases all local accounts and learning data before applying
the migrations and local seed again:

```bash
pnpm db:reset
```

Never use this command for a hosted database. Restart Web and the worker, then
create the account again through `/sign-in`.
