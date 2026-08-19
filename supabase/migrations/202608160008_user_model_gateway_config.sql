create function private.is_safe_model_gateway_origin(value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    value ~ '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
    and length(value) <= 253
    and value !~ '[.][.]'
    and value !~ '^https://localhost([.]|$)',
    false
  )
$$;

revoke all on function private.is_safe_model_gateway_origin(text) from public, anon, authenticated;
grant execute on function private.is_safe_model_gateway_origin(text) to service_role;

create table public.model_gateway_origins (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  canonical_origin text not null unique,
  base_path text not null default '',
  adapter_kind text not null,
  state text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint model_gateway_origin_slug_check check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80
  ),
  constraint model_gateway_origin_display_check check (
    length(btrim(display_name)) between 1 and 100 and display_name = btrim(display_name)
  ),
  constraint model_gateway_origin_exact_check check (
    private.is_safe_model_gateway_origin(canonical_origin)
  ),
  constraint model_gateway_origin_base_path_check check (
    length(base_path) <= 200
    and base_path ~ '^(/[A-Za-z0-9._~-]+)*$'
  ),
  constraint model_gateway_origin_adapter_check check (adapter_kind = 'openai-compatible'),
  constraint model_gateway_origin_state_check check (state in ('active', 'disabled'))
);

create table public.user_model_gateway_configs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null,
  origin_id uuid not null references public.model_gateway_origins(id) on delete restrict,
  adapter_kind text not null,
  model text not null,
  revision integer not null,
  config_fingerprint text not null,
  state text not null default 'pending_consent',
  consent_policy_version text,
  consented_origin text,
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint user_model_gateway_config_owner_key unique (id, user_id),
  constraint user_model_gateway_config_revision_key unique (user_id, revision),
  constraint user_model_gateway_config_display_check check (
    length(btrim(display_name)) between 1 and 80 and display_name = btrim(display_name)
  ),
  constraint user_model_gateway_config_adapter_check check (adapter_kind = 'openai-compatible'),
  constraint user_model_gateway_config_model_check check (
    length(btrim(model)) between 1 and 100 and model = btrim(model)
  ),
  constraint user_model_gateway_config_revision_check check (revision > 0),
  constraint user_model_gateway_config_fingerprint_check check (
    config_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint user_model_gateway_config_state_check check (
    (state = 'pending_consent' and consent_policy_version is null
      and consented_origin is null and consented_at is null and revoked_at is null)
    or (state = 'active' and consent_policy_version = 'model-egress-v1'
      and consented_origin is not null and consented_at is not null and revoked_at is null)
    or (state = 'revoked' and revoked_at is not null)
  )
);

create unique index user_model_gateway_one_active_idx
  on public.user_model_gateway_configs (user_id) where state = 'active';

create table private.user_model_gateway_secrets (
  config_id uuid primary key,
  user_id uuid not null,
  vault_secret_id uuid not null unique,
  credential_revision integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint user_model_gateway_secret_owner_fk foreign key (config_id, user_id)
    references public.user_model_gateway_configs(id, user_id) on delete restrict,
  constraint user_model_gateway_secret_revision_check check (credential_revision > 0)
);

alter table public.model_gateway_origins enable row level security;
alter table public.user_model_gateway_configs enable row level security;
alter table private.user_model_gateway_secrets enable row level security;

revoke all on table public.model_gateway_origins from public, anon, authenticated;
revoke all on table public.user_model_gateway_configs from public, anon, authenticated;
revoke all on table private.user_model_gateway_secrets from public, anon, authenticated;
grant select on table public.model_gateway_origins to authenticated;
grant select on table public.user_model_gateway_configs to authenticated;
grant select, insert, update, delete on table public.model_gateway_origins to service_role;
grant select, insert, update, delete on table public.user_model_gateway_configs to service_role;
grant select, insert, update, delete on table private.user_model_gateway_secrets to service_role;

create policy model_gateway_origins_select_active on public.model_gateway_origins
  for select to authenticated using (state = 'active');
create policy user_model_gateway_configs_select_own on public.user_model_gateway_configs
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.create_user_model_gateway_config(
  p_user_id uuid,
  p_config_id uuid,
  p_origin_id uuid,
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
  v_adapter_kind text;
  v_origin text;
  v_base_path text;
  v_revision integer;
  v_fingerprint text;
  v_secret_id uuid;
begin
  if p_user_id is null or p_config_id is null or p_origin_id is null
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

  select origin.adapter_kind, origin.canonical_origin, origin.base_path
  into v_adapter_kind, v_origin, v_base_path
  from public.model_gateway_origins as origin
  where origin.id = p_origin_id and origin.state = 'active';
  if not found or v_adapter_kind <> 'openai-compatible' then
    raise exception using errcode = '22023', message = 'model gateway origin is not approved';
  end if;

  select coalesce(max(config.revision), 0) + 1
  into v_revision
  from public.user_model_gateway_configs as config
  where config.user_id = p_user_id;

  v_fingerprint := encode(extensions.digest(
    'adapter:' || octet_length(v_adapter_kind)::text || ':' || v_adapter_kind
      || '|origin:' || octet_length(v_origin)::text || ':' || v_origin
      || '|path:' || octet_length(v_base_path)::text || ':' || v_base_path
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
      id, user_id, display_name, origin_id, adapter_kind, model, revision,
      config_fingerprint, state, created_at, updated_at
    ) values (
      p_config_id, p_user_id, p_display_name, p_origin_id, v_adapter_kind, p_model,
      v_revision, v_fingerprint, 'pending_consent', p_now, p_now
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

create function public.activate_user_model_gateway_config(
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
  v_old_secret uuid;
begin
  if p_user_id is null or p_config_id is null or p_exact_origin is null
    or p_policy_version <> 'model-egress-v1'
    or p_now is null or not isfinite(p_now) then
    raise exception using errcode = '22023', message = 'invalid model gateway consent input';
  end if;

  perform 1 from public.profiles where user_id = p_user_id for update;
  select origin.canonical_origin into v_origin
  from public.user_model_gateway_configs as config
  join public.model_gateway_origins as origin on origin.id = config.origin_id
  join private.user_model_gateway_secrets as secret
    on secret.config_id = config.id and secret.user_id = config.user_id
  where config.id = p_config_id and config.user_id = p_user_id
    and config.state = 'pending_consent' and origin.state = 'active';
  if not found or p_exact_origin <> v_origin then
    raise exception using errcode = '22023', message = 'consent origin does not match approved gateway';
  end if;

  for v_old_secret in
    select secret.vault_secret_id
    from public.user_model_gateway_configs as config
    join private.user_model_gateway_secrets as secret
      on secret.config_id = config.id and secret.user_id = config.user_id
    where config.user_id = p_user_id and config.state = 'active' and config.id <> p_config_id
  loop
    update public.user_model_gateway_configs
    set state = 'revoked', revoked_at = p_now, updated_at = p_now
    where user_id = p_user_id and state = 'active' and id <> p_config_id;
    delete from private.user_model_gateway_secrets where vault_secret_id = v_old_secret;
    delete from vault.secrets where id = v_old_secret;
  end loop;

  update public.user_model_gateway_configs
  set state = 'active', consent_policy_version = p_policy_version,
    consented_origin = p_exact_origin, consented_at = p_now, updated_at = p_now
  where id = p_config_id and user_id = p_user_id and state = 'pending_consent';
  return found;
end
$$;

create function public.resolve_user_model_gateway_config(
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
  select config.display_name, origin.canonical_origin, origin.base_path,
    config.adapter_kind, config.model, config.revision, config.config_fingerprint,
    vault_secret.decrypted_secret, secret.credential_revision
  from public.user_model_gateway_configs as config
  join public.model_gateway_origins as origin on origin.id = config.origin_id
  join private.user_model_gateway_secrets as secret
    on secret.config_id = config.id and secret.user_id = config.user_id
  join vault.decrypted_secrets as vault_secret on vault_secret.id = secret.vault_secret_id
  where config.id = p_config_id and config.user_id = p_user_id
    and config.revision = p_expected_revision
    and config.state = 'active' and origin.state = 'active'
    and config.consent_policy_version = 'model-egress-v1'
    and config.consented_origin = origin.canonical_origin
$$;

create function public.rotate_user_model_gateway_key(
  p_user_id uuid,
  p_config_id uuid,
  p_api_key text,
  p_now timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_secret_id uuid;
begin
  if p_user_id is null or p_config_id is null
    or p_api_key is null or length(p_api_key) not between 1 and 4096
    or p_api_key <> btrim(p_api_key)
    or p_now is null or not isfinite(p_now) then
    raise exception using errcode = '22023', message = 'invalid model gateway key rotation input';
  end if;
  select secret.vault_secret_id into v_secret_id
  from private.user_model_gateway_secrets as secret
  join public.user_model_gateway_configs as config
    on config.id = secret.config_id and config.user_id = secret.user_id
  where secret.config_id = p_config_id and secret.user_id = p_user_id
    and config.state in ('pending_consent', 'active')
  for update of secret;
  if not found then return false; end if;

  perform vault.update_secret(v_secret_id, p_api_key);
  update private.user_model_gateway_secrets
  set credential_revision = credential_revision + 1, updated_at = p_now
  where config_id = p_config_id and user_id = p_user_id;
  update public.user_model_gateway_configs set updated_at = p_now
  where id = p_config_id and user_id = p_user_id;
  return true;
end
$$;

create function public.revoke_user_model_gateway_config(
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
begin
  if p_user_id is null or p_config_id is null or p_now is null or not isfinite(p_now) then
    raise exception using errcode = '22023', message = 'invalid model gateway revocation input';
  end if;
  select secret.vault_secret_id into v_secret_id
  from private.user_model_gateway_secrets as secret
  join public.user_model_gateway_configs as config
    on config.id = secret.config_id and config.user_id = secret.user_id
  where secret.config_id = p_config_id and secret.user_id = p_user_id
    and config.state in ('pending_consent', 'active')
  for update of config, secret;
  if not found then return false; end if;

  update public.user_model_gateway_configs
  set state = 'revoked', revoked_at = p_now, updated_at = p_now
  where id = p_config_id and user_id = p_user_id;
  delete from private.user_model_gateway_secrets
  where config_id = p_config_id and user_id = p_user_id;
  delete from vault.secrets where id = v_secret_id;
  return true;
end
$$;

revoke all on function public.create_user_model_gateway_config(
  uuid, uuid, uuid, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.activate_user_model_gateway_config(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.resolve_user_model_gateway_config(
  uuid, uuid, integer
) from public, anon, authenticated;
revoke all on function public.rotate_user_model_gateway_key(
  uuid, uuid, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.revoke_user_model_gateway_config(
  uuid, uuid, timestamptz
) from public, anon, authenticated;

grant execute on function public.create_user_model_gateway_config(
  uuid, uuid, uuid, text, text, text, timestamptz
) to service_role;
grant execute on function public.activate_user_model_gateway_config(
  uuid, uuid, text, text, timestamptz
) to service_role;
grant execute on function public.resolve_user_model_gateway_config(
  uuid, uuid, integer
) to service_role;
grant execute on function public.rotate_user_model_gateway_key(
  uuid, uuid, text, timestamptz
) to service_role;
grant execute on function public.revoke_user_model_gateway_config(
  uuid, uuid, timestamptz
) to service_role;

comment on table public.model_gateway_origins is
  'Administrator-approved exact HTTPS AI egress destinations; no credentials.';
comment on table public.user_model_gateway_configs is
  'Owner-readable non-secret immutable model gateway configuration versions and consent state.';
comment on table private.user_model_gateway_secrets is
  'Service-role-only opaque Supabase Vault references; never expose through public APIs.';
