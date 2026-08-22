# Local-First Task 2 Handoff

## Result

- Removed the unused global OpenAI key/model requirements from the server
  environment, sample environment, and Supabase Studio configuration.
- Added `pnpm worker:local`, which repeatedly calls the existing bounded
  internal processor with the configured bearer secret.
- The trigger runs cycles sequentially, reports only `processed`, `empty`, or
  `failed`, retries after a fixed one-second delay, and stops on SIGINT/SIGTERM.
- It never reads the response body into a log and never prints the job secret.

## TDD evidence

RED: focused Vitest exited 1 because `scripts/process-local-jobs.mjs` did not
exist and four environment assertions showed the retired OpenAI fields were
still required.

GREEN:

```text
node_modules/.bin/vitest run src/server/env.test.ts tests/integration/jobs/local-worker.test.ts tests/integration/jobs/process-jobs.test.ts
3 files passed; 59 tests passed
```

Final type, Node syntax, scoped ESLint, and diff verification are recorded in
the execution ledger after independent review.

## Risks

The worker intentionally provides one fixed local polling interval and one
bounded endpoint call at a time. It is not a scheduler or multi-worker service;
that matches the personal-installation scope. A running Next.js server and the
same `INTERNAL_JOB_SECRET` in both processes are required.
