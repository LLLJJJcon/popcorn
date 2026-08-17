create function public.claim_knowledge_jobs(
  p_limit integer,
  p_now timestamptz
)
returns setof public.knowledge_jobs
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 or p_now is null then
    raise exception using
      errcode = '22023',
      message = 'claim limit must be between 1 and 25 and clock must be non-null';
  end if;

  return query
  with candidates as (
    select job.id, job.user_id, job.attempt_count >= 5 as exhausted
    from public.knowledge_jobs as job
    where job.status = 'pending'
      or (job.status = 'retryable_failed' and job.next_attempt_at <= p_now)
      or (job.status = 'leased' and job.lease_expires_at <= p_now)
    order by
      coalesce(job.next_attempt_at, job.lease_expires_at, job.created_at),
      job.created_at,
      job.id
    limit p_limit
    for update of job skip locked
  ), transitioned as (
    update public.knowledge_jobs as job
    set
      status = case when candidate.exhausted then 'terminal_failed' else 'leased' end,
      attempt_count = case
        when candidate.exhausted then job.attempt_count
        else job.attempt_count + 1
      end,
      next_attempt_at = null,
      lease_expires_at = case
        when candidate.exhausted then null
        else p_now + interval '5 minutes'
      end,
      last_error_code = case
        when candidate.exhausted then 'JOB_RETRY_EXHAUSTED'
        else null
      end,
      updated_at = p_now
    from candidates as candidate
    where job.id = candidate.id
      and job.user_id = candidate.user_id
    returning job.*
  )
  select transitioned.*
  from transitioned
  where transitioned.status = 'leased';
end
$$;

revoke all on function public.claim_knowledge_jobs(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_knowledge_jobs(integer, timestamptz)
  to service_role;

comment on function public.claim_knowledge_jobs(integer, timestamptz) is
  'Atomically discovers and leases a bounded worker batch. Returned user_id is mandatory for every later service-role operation.';
