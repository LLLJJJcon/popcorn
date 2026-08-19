create table private.learning_artifact_gateway_pins (
  knowledge_job_id uuid primary key,
  user_id uuid not null,
  config_id uuid not null,
  config_revision integer not null,
  config_fingerprint text not null,
  created_at timestamptz not null,
  constraint learning_artifact_gateway_pin_job_owner_fk
    foreign key (knowledge_job_id, user_id)
    references public.knowledge_jobs(id, user_id) on delete restrict,
  constraint learning_artifact_gateway_pin_config_owner_fk
    foreign key (config_id, user_id)
    references public.user_model_gateway_configs(id, user_id) on delete restrict,
  constraint learning_artifact_gateway_pin_revision_check
    check (config_revision > 0),
  constraint learning_artifact_gateway_pin_fingerprint_check
    check (config_fingerprint ~ '^[a-f0-9]{64}$')
);

create index learning_artifact_gateway_pins_config_idx
  on private.learning_artifact_gateway_pins (config_id, user_id, knowledge_job_id);

alter table private.learning_artifact_gateway_pins enable row level security;
revoke all on table private.learning_artifact_gateway_pins
  from public, anon, authenticated, service_role;
grant select, insert on table private.learning_artifact_gateway_pins to service_role;

comment on table private.learning_artifact_gateway_pins is
  'Service-only immutable owner/config revision pin for durable learning-artifact jobs; contains no credential or transport endpoint.';

create function public.resolve_active_user_model_gateway_pin(
  p_user_id uuid
)
returns table (
  config_id uuid,
  revision integer,
  config_fingerprint text,
  model text
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select config.id, config.revision, config.config_fingerprint, config.model
  from public.user_model_gateway_configs as config
  join public.model_gateway_origins as origin on origin.id = config.origin_id
  where config.user_id = p_user_id
    and config.state = 'active'
    and config.consent_policy_version = 'model-egress-v1'
    and config.consented_origin = origin.canonical_origin
    and origin.state = 'active'
    and exists (
      select 1
      from private.user_model_gateway_secrets as secret
      where secret.config_id = config.id
        and secret.user_id = config.user_id
    )
$$;

revoke all on function public.resolve_active_user_model_gateway_pin(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_active_user_model_gateway_pin(uuid)
  to service_role;

comment on function public.resolve_active_user_model_gateway_pin(uuid) is
  'Returns the unique active owner gateway revision and semantic fingerprint without resolving Vault secret material.';

create function public.register_gateway_learning_artifact_job(
  p_user_id uuid,
  p_video_source_id uuid,
  p_job_type text,
  p_dedupe_key text,
  p_input jsonb,
  p_config_id uuid,
  p_expected_config_revision integer,
  p_expected_config_fingerprint text,
  p_now timestamptz
)
returns table (
  knowledge_job_id uuid,
  status text,
  created boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_registration record;
  v_pin private.learning_artifact_gateway_pins%rowtype;
begin
  if p_user_id is null
    or p_config_id is null
    or p_expected_config_revision is null
    or p_expected_config_revision <= 0
    or p_expected_config_fingerprint is null
    or p_expected_config_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'invalid gateway learning-artifact pin';
  end if;

  perform 1
  from public.user_model_gateway_configs as config
  join public.model_gateway_origins as origin on origin.id = config.origin_id
  where config.id = p_config_id
    and config.user_id = p_user_id
    and config.revision = p_expected_config_revision
    and config.config_fingerprint = p_expected_config_fingerprint
    and config.state = 'active'
    and config.consent_policy_version = 'model-egress-v1'
    and config.consented_origin = origin.canonical_origin
    and origin.state = 'active'
    and exists (
      select 1
      from private.user_model_gateway_secrets as secret
      where secret.config_id = config.id
        and secret.user_id = config.user_id
    )
  for share of config, origin;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'gateway learning-artifact configuration is not active';
  end if;

  select result.knowledge_job_id, result.status, result.created
  into strict v_registration
  from public.register_learning_artifact_job(
    p_user_id,
    p_video_source_id,
    p_job_type,
    p_dedupe_key,
    p_input,
    p_now
  ) as result;

  if v_registration.created then
    insert into private.learning_artifact_gateway_pins (
      knowledge_job_id,
      user_id,
      config_id,
      config_revision,
      config_fingerprint,
      created_at
    ) values (
      v_registration.knowledge_job_id,
      p_user_id,
      p_config_id,
      p_expected_config_revision,
      p_expected_config_fingerprint,
      p_now
    );
  end if;

  select pin.*
  into v_pin
  from private.learning_artifact_gateway_pins as pin
  where pin.knowledge_job_id = v_registration.knowledge_job_id
    and pin.user_id = p_user_id
  for share of pin;

  if not found
    or v_pin.config_id <> p_config_id
    or v_pin.config_revision <> p_expected_config_revision
    or v_pin.config_fingerprint <> p_expected_config_fingerprint then
    raise exception using
      errcode = '22023',
      message = 'learning-artifact job belongs to a different gateway pin';
  end if;

  return query select
    v_registration.knowledge_job_id,
    v_registration.status,
    v_registration.created;
end
$$;

revoke all on function public.register_gateway_learning_artifact_job(
  uuid, uuid, text, text, jsonb, uuid, integer, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.register_gateway_learning_artifact_job(
  uuid, uuid, text, text, jsonb, uuid, integer, text, timestamptz
) to service_role;

comment on function public.register_gateway_learning_artifact_job(
  uuid, uuid, text, text, jsonb, uuid, integer, text, timestamptz
) is
  'Atomically registers a durable learning-artifact job only while its exact owner gateway consent and semantic revision remain active.';

create function public.complete_gateway_learning_artifact_job(
  p_user_id uuid,
  p_job_id uuid,
  p_video_source_id uuid,
  p_job_type text,
  p_expected_lease_expires_at timestamptz,
  p_expected_attempt_count integer,
  p_artifact_type text,
  p_content jsonb,
  p_prompt_version text,
  p_model text,
  p_result_key text,
  p_config_id uuid,
  p_expected_config_revision integer,
  p_expected_config_fingerprint text,
  p_now timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_model text;
  v_pin private.learning_artifact_gateway_pins%rowtype;
begin
  if p_user_id is null
    or p_job_id is null
    or p_config_id is null
    or p_expected_config_revision is null
    or p_expected_config_revision <= 0
    or p_expected_config_fingerprint is null
    or p_expected_config_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'invalid gateway learning-artifact completion pin';
  end if;

  select config.model
  into v_model
  from public.user_model_gateway_configs as config
  join public.model_gateway_origins as origin on origin.id = config.origin_id
  where config.id = p_config_id
    and config.user_id = p_user_id
    and config.revision = p_expected_config_revision
    and config.config_fingerprint = p_expected_config_fingerprint
    and config.state = 'active'
    and config.consent_policy_version = 'model-egress-v1'
    and config.consented_origin = origin.canonical_origin
    and origin.state = 'active'
    and exists (
      select 1
      from private.user_model_gateway_secrets as secret
      where secret.config_id = config.id
        and secret.user_id = config.user_id
    )
  for share of config, origin;

  if not found or v_model <> p_model then
    return null;
  end if;

  select pin.*
  into v_pin
  from private.learning_artifact_gateway_pins as pin
  where pin.knowledge_job_id = p_job_id
    and pin.user_id = p_user_id
  for share of pin;

  if not found
    or v_pin.config_id <> p_config_id
    or v_pin.config_revision <> p_expected_config_revision
    or v_pin.config_fingerprint <> p_expected_config_fingerprint then
    return null;
  end if;

  return public.complete_learning_artifact_job(
    p_user_id,
    p_job_id,
    p_video_source_id,
    p_job_type,
    p_expected_lease_expires_at,
    p_expected_attempt_count,
    p_artifact_type,
    p_content,
    p_prompt_version,
    p_model,
    p_result_key,
    p_now
  );
end
$$;

revoke all on function public.complete_gateway_learning_artifact_job(
  uuid, uuid, uuid, text, timestamptz, integer, text, jsonb, text, text, text,
  uuid, integer, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.complete_gateway_learning_artifact_job(
  uuid, uuid, uuid, text, timestamptz, integer, text, jsonb, text, text, text,
  uuid, integer, text, timestamptz
) to service_role;

comment on function public.complete_gateway_learning_artifact_job(
  uuid, uuid, uuid, text, timestamptz, integer, text, jsonb, text, text, text,
  uuid, integer, text, timestamptz
) is
  'Revalidates and locks exact gateway consent and job pin before atomically publishing a lease-fenced learning artifact.';

create or replace function public.revoke_user_model_gateway_config(
  p_user_id uuid,
  p_config_id uuid,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_secret_id uuid;
  v_state text;
begin
  if p_user_id is null or p_config_id is null or p_now is null or not isfinite(p_now) then
    raise exception using errcode = '22023', message = 'invalid model gateway revocation input';
  end if;

  select config.state
  into v_state
  from public.user_model_gateway_configs as config
  where config.id = p_config_id and config.user_id = p_user_id
  for update of config;

  if not found then
    return false;
  end if;
  if v_state not in ('pending_consent', 'active', 'revoked') then
    return false;
  end if;

  if v_state <> 'revoked' then
    update public.user_model_gateway_configs
    set state = 'revoked', revoked_at = p_now, updated_at = p_now
    where id = p_config_id and user_id = p_user_id;
  end if;

  with cancelled as (
    update public.knowledge_jobs as job
    set
      status = 'terminal_failed',
      next_attempt_at = null,
      lease_expires_at = null,
      last_error_code = 'MODEL_GATEWAY_REVOKED',
      updated_at = p_now
    from private.learning_artifact_gateway_pins as pin
    where pin.config_id = p_config_id
      and pin.user_id = p_user_id
      and pin.knowledge_job_id = job.id
      and job.user_id = pin.user_id
      and job.status in ('pending', 'retryable_failed', 'leased')
    returning job.id, job.user_id
  )
  update public.knowledge_job_internal as internal
  set input = '{}'::jsonb, updated_at = p_now
  from cancelled
  where internal.knowledge_job_id = cancelled.id
    and internal.user_id = cancelled.user_id;

  delete from private.user_model_gateway_secrets as secret
  where secret.config_id = p_config_id and secret.user_id = p_user_id
  returning secret.vault_secret_id into v_secret_id;

  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;

  return true;
end
$$;

revoke all on function public.revoke_user_model_gateway_config(
  uuid, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.revoke_user_model_gateway_config(
  uuid, uuid, timestamptz
) to service_role;

comment on function public.revoke_user_model_gateway_config(
  uuid, uuid, timestamptz
) is
  'Revokes one owner gateway, terminalizes its recoverable pinned jobs, clears their private input, and destroys the Vault credential idempotently.';
