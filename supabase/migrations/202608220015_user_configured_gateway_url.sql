alter table public.user_model_gateway_configs
  alter column origin_id drop not null,
  add column canonical_origin text,
  add column base_path text,
  add constraint user_model_gateway_config_transport_representation_check check (
    (origin_id is not null and canonical_origin is null and base_path is null)
    or (origin_id is null and canonical_origin is not null and base_path is not null)
  ),
  add constraint user_model_gateway_config_direct_origin_check check (
    canonical_origin is null or private.is_safe_model_gateway_origin(canonical_origin)
  ),
  add constraint user_model_gateway_config_direct_base_path_check check (
    base_path is null or (
      length(base_path) <= 200
      and base_path ~ '^(/[A-Za-z0-9._~-]+)*$'
    )
  );

update public.user_model_gateway_configs as config
set consented_origin = origin.canonical_origin || origin.base_path
from public.model_gateway_origins as origin
where config.origin_id = origin.id
  and config.consented_origin is not null;

create function private.protect_user_model_gateway_transport()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if (new.origin_id, new.canonical_origin, new.base_path, new.adapter_kind,
      new.model, new.revision, new.config_fingerprint)
      is distinct from
     (old.origin_id, old.canonical_origin, old.base_path, old.adapter_kind,
      old.model, old.revision, old.config_fingerprint) then
    raise exception using
      errcode = '23514',
      message = 'model gateway transport semantics are immutable';
  end if;
  return new;
end
$$;

revoke all on function private.protect_user_model_gateway_transport()
  from public, anon, authenticated;
grant execute on function private.protect_user_model_gateway_transport() to service_role;

create trigger protect_user_model_gateway_transport
before update on public.user_model_gateway_configs
for each row execute function private.protect_user_model_gateway_transport();

create function public.create_user_model_gateway_config(
  p_user_id uuid,
  p_config_id uuid,
  p_canonical_origin text,
  p_base_path text,
  p_display_name text,
  p_model text,
  p_api_key text,
  p_now timestamptz
)
returns table (config_id uuid, revision integer, state text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_adapter_kind text := 'openai-compatible';
  v_revision integer;
  v_fingerprint text;
  v_secret_id uuid;
begin
  if p_user_id is null or p_config_id is null
    or not private.is_safe_model_gateway_origin(p_canonical_origin)
    or p_base_path is null or length(p_base_path) > 200
    or p_base_path !~ '^(/[A-Za-z0-9._~-]+)*$'
    or p_display_name is null or length(btrim(p_display_name)) not between 1 and 80
    or p_display_name <> btrim(p_display_name)
    or p_model is null or length(btrim(p_model)) not between 1 and 100
    or p_model <> btrim(p_model)
    or p_api_key is null or length(p_api_key) not between 1 and 4096
    or p_api_key <> btrim(p_api_key)
    or p_now is null or not isfinite(p_now) then
    raise exception using errcode = '22023', message = 'invalid model gateway configuration input';
  end if;

  perform 1 from public.profiles where user_id = p_user_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'model gateway owner does not exist';
  end if;

  select coalesce(max(config.revision), 0) + 1
  into v_revision
  from public.user_model_gateway_configs as config
  where config.user_id = p_user_id;

  v_fingerprint := encode(extensions.digest(
    'adapter:' || octet_length(v_adapter_kind)::text || ':' || v_adapter_kind
      || '|origin:' || octet_length(p_canonical_origin)::text || ':' || p_canonical_origin
      || '|path:' || octet_length(p_base_path)::text || ':' || p_base_path
      || '|model:' || octet_length(p_model)::text || ':' || p_model,
    'sha256'
  ), 'hex');
  v_secret_id := vault.create_secret(
    p_api_key,
    'popcorn:model-gateway:' || p_config_id::text,
    'Popcorn user model gateway credential'
  );

  begin
    insert into public.user_model_gateway_configs (
      id, user_id, display_name, origin_id, canonical_origin, base_path,
      adapter_kind, model, revision, config_fingerprint, state, created_at, updated_at
    ) values (
      p_config_id, p_user_id, p_display_name, null, p_canonical_origin, p_base_path,
      v_adapter_kind, p_model, v_revision, v_fingerprint, 'pending_consent', p_now, p_now
    );
    insert into private.user_model_gateway_secrets (
      config_id, user_id, vault_secret_id, credential_revision, created_at, updated_at
    ) values (p_config_id, p_user_id, v_secret_id, 1, p_now, p_now);
  exception when others then
    delete from vault.secrets where id = v_secret_id;
    raise;
  end;

  return query select p_config_id, v_revision, 'pending_consent'::text;
end
$$;

revoke all on function public.create_user_model_gateway_config(
  uuid, uuid, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_user_model_gateway_config(
  uuid, uuid, text, text, text, text, text, timestamptz
) to service_role;

comment on function public.create_user_model_gateway_config(
  uuid, uuid, text, text, text, text, text, timestamptz
) is 'Creates an immutable owner gateway from a user-entered public HTTPS origin and bounded base path while storing the key only in Vault.';

create or replace function public.activate_user_model_gateway_config(
  p_user_id uuid,
  p_config_id uuid,
  p_exact_origin text,
  p_policy_version text,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_origin text;
  v_base_path text;
  v_origin_id uuid;
  v_exact_base_url text;
  v_old_config_id uuid;
begin
  if p_user_id is null or p_config_id is null or p_exact_origin is null
    or p_policy_version <> 'model-egress-v1'
    or p_now is null or not isfinite(p_now) then
    raise exception using errcode = '22023', message = 'invalid model gateway consent input';
  end if;

  perform 1 from public.profiles where user_id = p_user_id for update;

  select config.origin_id, config.canonical_origin, config.base_path
  into v_origin_id, v_origin, v_base_path
  from public.user_model_gateway_configs as config
  join private.user_model_gateway_secrets as secret
    on secret.config_id = config.id and secret.user_id = config.user_id
  where config.id = p_config_id
    and config.user_id = p_user_id
    and config.state = 'pending_consent'
  for update of config, secret;

  if not found then
    raise exception using errcode = '22023', message = 'consent URL does not match gateway';
  end if;

  if v_origin_id is not null then
    select origin.canonical_origin, origin.base_path
    into v_origin, v_base_path
    from public.model_gateway_origins as origin
    where origin.id = v_origin_id and origin.state = 'active'
    for share of origin;
    if not found then
      raise exception using errcode = '22023', message = 'consent URL does not match gateway';
    end if;
  end if;

  v_exact_base_url := v_origin || v_base_path;
  if p_exact_origin <> v_exact_base_url
    and not (v_origin_id is not null and p_exact_origin = v_origin) then
    raise exception using errcode = '22023', message = 'consent URL does not match gateway';
  end if;

  for v_old_config_id in
    select config.id
    from public.user_model_gateway_configs as config
    where config.user_id = p_user_id
      and config.state = 'active'
      and config.id <> p_config_id
    order by config.id
    for update of config
  loop
    update public.user_model_gateway_configs
    set state = 'revoked', revoked_at = p_now, updated_at = p_now
    where id = v_old_config_id and user_id = p_user_id and state = 'active';
    perform private.cleanup_revoked_user_model_gateway_config(
      p_user_id, v_old_config_id, p_now
    );
  end loop;

  update public.user_model_gateway_configs
  set state = 'active', consent_policy_version = p_policy_version,
    consented_origin = v_exact_base_url, consented_at = p_now, updated_at = p_now
  where id = p_config_id and user_id = p_user_id and state = 'pending_consent';
  return found;
end
$$;

comment on function public.activate_user_model_gateway_config(
  uuid, uuid, text, text, timestamptz
) is 'Activates consent for the normalized exact gateway base URL while retaining bare-origin input only for legacy catalog callers.';

create or replace function public.resolve_user_model_gateway_config(
  p_user_id uuid,
  p_config_id uuid,
  p_expected_revision integer
)
returns table (
  display_name text,
  canonical_origin text,
  base_path text,
  adapter_kind text,
  model text,
  revision integer,
  config_fingerprint text,
  api_key text,
  credential_revision integer
)
language sql
security definer
set search_path = pg_catalog
as $$
  select config.display_name,
    coalesce(config.canonical_origin, origin.canonical_origin),
    coalesce(config.base_path, origin.base_path),
    config.adapter_kind, config.model, config.revision, config.config_fingerprint,
    vault_secret.decrypted_secret, secret.credential_revision
  from public.user_model_gateway_configs as config
  left join public.model_gateway_origins as origin on origin.id = config.origin_id
  join private.user_model_gateway_secrets as secret
    on secret.config_id = config.id and secret.user_id = config.user_id
  join vault.decrypted_secrets as vault_secret on vault_secret.id = secret.vault_secret_id
  where config.id = p_config_id and config.user_id = p_user_id
    and config.revision = p_expected_revision
    and config.state = 'active'
    and config.consent_policy_version = 'model-egress-v1'
    and config.consented_origin =
      coalesce(config.canonical_origin, origin.canonical_origin)
      || coalesce(config.base_path, origin.base_path)
    and (
      (config.origin_id is null and config.canonical_origin is not null and config.base_path is not null)
      or (config.origin_id is not null and origin.state = 'active')
    )
$$;

create or replace function public.resolve_active_user_model_gateway_pin(
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
  left join public.model_gateway_origins as origin on origin.id = config.origin_id
  where config.user_id = p_user_id
    and config.state = 'active'
    and config.consent_policy_version = 'model-egress-v1'
    and config.consented_origin =
      coalesce(config.canonical_origin, origin.canonical_origin)
      || coalesce(config.base_path, origin.base_path)
    and (
      (config.origin_id is null and config.canonical_origin is not null and config.base_path is not null)
      or (config.origin_id is not null and origin.state = 'active')
    )
    and exists (
      select 1 from private.user_model_gateway_secrets as secret
      where secret.config_id = config.id and secret.user_id = config.user_id
    )
$$;

create function private.lock_active_user_model_gateway_config(
  p_user_id uuid,
  p_config_id uuid,
  p_expected_revision integer,
  p_expected_fingerprint text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_config public.user_model_gateway_configs%rowtype;
  v_origin public.model_gateway_origins%rowtype;
begin
  select config.* into v_config
  from public.user_model_gateway_configs as config
  where config.id = p_config_id
    and config.user_id = p_user_id
    and config.revision = p_expected_revision
    and config.config_fingerprint = p_expected_fingerprint
    and config.state = 'active'
    and config.consent_policy_version = 'model-egress-v1'
    and exists (
      select 1 from private.user_model_gateway_secrets as secret
      where secret.config_id = config.id and secret.user_id = config.user_id
    )
  for share of config;
  if not found then return null; end if;

  if v_config.origin_id is null then
    if v_config.canonical_origin is null or v_config.base_path is null
      or v_config.consented_origin <> (v_config.canonical_origin || v_config.base_path) then
      return null;
    end if;
  else
    select origin.* into v_origin
    from public.model_gateway_origins as origin
    where origin.id = v_config.origin_id and origin.state = 'active'
    for share of origin;
    if not found
      or v_config.consented_origin <> (v_origin.canonical_origin || v_origin.base_path) then
      return null;
    end if;
  end if;
  return v_config.model;
end
$$;

revoke all on function private.lock_active_user_model_gateway_config(
  uuid, uuid, integer, text
) from public, anon, authenticated, service_role;

create or replace function public.register_gateway_learning_artifact_job(
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
  if p_user_id is null or p_config_id is null
    or p_expected_config_revision is null or p_expected_config_revision <= 0
    or p_expected_config_fingerprint is null
    or p_expected_config_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid gateway learning-artifact pin';
  end if;

  if private.lock_active_user_model_gateway_config(
    p_user_id, p_config_id, p_expected_config_revision,
    p_expected_config_fingerprint
  ) is null then
    raise exception using
      errcode = '22023',
      message = 'gateway learning-artifact configuration is not active';
  end if;

  select result.knowledge_job_id, result.status, result.created
  into strict v_registration
  from public.register_learning_artifact_job(
    p_user_id, p_video_source_id, p_job_type, p_dedupe_key, p_input, p_now
  ) as result;

  if v_registration.created then
    insert into private.learning_artifact_gateway_pins (
      knowledge_job_id, user_id, config_id, config_revision,
      config_fingerprint, created_at
    ) values (
      v_registration.knowledge_job_id, p_user_id, p_config_id,
      p_expected_config_revision, p_expected_config_fingerprint, p_now
    );
  end if;

  select pin.* into v_pin
  from private.learning_artifact_gateway_pins as pin
  where pin.knowledge_job_id = v_registration.knowledge_job_id
    and pin.user_id = p_user_id
  for share of pin;

  if not found or v_pin.config_id <> p_config_id
    or v_pin.config_revision <> p_expected_config_revision
    or v_pin.config_fingerprint <> p_expected_config_fingerprint then
    raise exception using
      errcode = '22023',
      message = 'learning-artifact job belongs to a different gateway pin';
  end if;

  return query select
    v_registration.knowledge_job_id, v_registration.status, v_registration.created;
end
$$;

create or replace function public.complete_gateway_learning_artifact_job(
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
  if p_user_id is null or p_job_id is null or p_config_id is null
    or p_expected_config_revision is null or p_expected_config_revision <= 0
    or p_expected_config_fingerprint is null
    or p_expected_config_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'invalid gateway learning-artifact completion pin';
  end if;

  v_model := private.lock_active_user_model_gateway_config(
    p_user_id, p_config_id, p_expected_config_revision,
    p_expected_config_fingerprint
  );
  if v_model is null or v_model <> p_model then return null; end if;

  select pin.* into v_pin
  from private.learning_artifact_gateway_pins as pin
  where pin.knowledge_job_id = p_job_id and pin.user_id = p_user_id
  for share of pin;

  if not found or v_pin.config_id <> p_config_id
    or v_pin.config_revision <> p_expected_config_revision
    or v_pin.config_fingerprint <> p_expected_config_fingerprint then
    return null;
  end if;

  return public.complete_learning_artifact_job(
    p_user_id, p_job_id, p_video_source_id, p_job_type,
    p_expected_lease_expires_at, p_expected_attempt_count, p_artifact_type,
    p_content, p_prompt_version, p_model, p_result_key, p_now
  );
end
$$;

comment on table public.user_model_gateway_configs is
  'Owner-readable non-secret immutable gateway versions backed by either a legacy catalog origin or direct public HTTPS transport fields.';
