create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'popcorn-process-knowledge-jobs',
  '* * * * *',
  $popcorn_cron$
    select net.http_post(
      url := internal_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || internal_secret
      ),
      body := jsonb_build_object('source', 'supabase_cron'),
      timeout_milliseconds := 5000
    )
    from (
      select
        btrim(max(decrypted_secret) filter (
          where name = 'popcorn_internal_job_url'
        )) as internal_url,
        btrim(max(decrypted_secret) filter (
          where name = 'popcorn_internal_job_secret'
        )) as internal_secret
      from vault.decrypted_secrets
      where name in (
        'popcorn_internal_job_url',
        'popcorn_internal_job_secret'
      )
    ) as runtime_secrets
    where btrim(internal_url) <> ''
      and btrim(internal_secret) <> ''
      and internal_url ~ '^https://[^/?#]+/api/internal/jobs/process$';
  $popcorn_cron$
);
