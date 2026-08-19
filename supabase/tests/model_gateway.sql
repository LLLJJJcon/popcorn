begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set user_a '00000000-0000-4000-8000-00000000a001'
\set user_b '00000000-0000-4000-8000-00000000b002'
\set origin_id '80000000-0000-4000-8000-000000000001'
\set config_a '81000000-0000-4000-8000-000000000001'

select extensions.has_table('public', 'model_gateway_origins', 'approved origin catalog exists');
select extensions.has_table('public', 'user_model_gateway_configs', 'owner gateway configs exist');
select extensions.has_table('private', 'user_model_gateway_secrets', 'secret references stay private');

select extensions.ok(
  (select c.relrowsecurity from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'model_gateway_origins'),
  'origin catalog has RLS'
);
select extensions.ok(
  (select c.relrowsecurity from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'user_model_gateway_configs'),
  'user configs have RLS'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'private.user_model_gateway_secrets', 'select')
  and not has_table_privilege('anon', 'private.user_model_gateway_secrets', 'select'),
  'secret references are unreadable to clients'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', :'user_a', 'authenticated', 'authenticated',
   'gateway-a@popcorn.test', crypt('password-a', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', :'user_b', 'authenticated', 'authenticated',
   'gateway-b@popcorn.test', crypt('password-b', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;
insert into public.profiles (user_id) values (:'user_a'), (:'user_b') on conflict (user_id) do nothing;

insert into public.model_gateway_origins (
  id, slug, display_name, canonical_origin, base_path, adapter_kind, state
) values (
  :'origin_id', 'approved-compatible', 'Approved compatible gateway',
  'https://models.example.com', '/v1', 'openai-compatible', 'active'
);

select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('loopback','Loopback','https://127.0.0.1','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects IPv4 loopback literals');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('link-local','Link local','https://169.254.169.254','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects link-local IP literals');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('metadata','Metadata','https://metadata.example.com','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects metadata hostnames independently');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('internal-name','Internal','https://service.internal','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects internal names independently');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('short-loopback','Short loopback','https://127.1','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects shortened IPv4 literals');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('three-part-loopback','Three-part loopback','https://127.0.1','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects three-part IPv4 literals');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('hex-loopback','Hex loopback','https://0x7f.1','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects hexadecimal IPv4 literals');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('octal-loopback','Octal loopback','https://0177.1','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects octal IPv4 literals');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('unspecified','Unspecified','https://0.0.0.0','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects unspecified IPv4 literals');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('localhost-subdomain','Localhost','https://api.localhost','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects localhost subdomains');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('local-name','Local name','https://models.local','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects local pseudo-domains');
select extensions.throws_ok(
  $$insert into public.model_gateway_origins
    (slug,display_name,canonical_origin,base_path,adapter_kind,state) values
    ('ipv6-loopback','IPv6 loopback','https://[::1]','/v1','openai-compatible','active')$$,
  '23514', null, 'catalog rejects IPv6 literals');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);
select extensions.results_eq(
  $$select slug from public.model_gateway_origins order by slug$$,
  $$values ('approved-compatible'::text)$$,
  'authenticated users can read active approved origins'
);
select extensions.throws_ok(
  $$insert into public.model_gateway_origins (slug,display_name,canonical_origin,base_path,adapter_kind,state)
    values ('evil','Evil','https://evil.example','/v1','openai-compatible','active')$$,
  '42501', null, 'authenticated users cannot add egress origins'
);
select extensions.throws_ok(
  $$insert into public.user_model_gateway_configs
    (user_id,display_name,origin_id,adapter_kind,model,revision,config_fingerprint,state,created_at,updated_at)
    values ('00000000-0000-4000-8000-00000000a001','forged','80000000-0000-4000-8000-000000000001',
      'openai-compatible','forged',1,repeat('a',64),'active',now(),now())$$,
  '42501', null, 'authenticated users cannot forge config rows'
);
reset role;

select extensions.ok(
  (select has_function_privilege('service_role', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('public', p.oid, 'execute')
   from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='create_user_model_gateway_config'),
  'config creation RPC is service-role-only'
);
select extensions.ok(
  (select count(*) = 6 and bool_and(
      has_function_privilege('service_role', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('public', p.oid, 'execute')
    )
   from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname = any(array[
     'create_user_model_gateway_config','activate_user_model_gateway_config',
     'resolve_user_model_gateway_config','rotate_user_model_gateway_key',
     'rename_user_model_gateway_config','revoke_user_model_gateway_config'
   ])),
  'every gateway lifecycle and secret RPC is service-role-only'
);

set local role service_role;
select extensions.lives_ok(
  format($sql$select * from public.create_user_model_gateway_config(
    %L::uuid,%L::uuid,%L::uuid,'My Gateway','provider/model-v1','secret-a',
    '2026-08-19 10:00:00+00'::timestamptz)$sql$,
    :'user_a', :'config_a', :'origin_id'),
  'service role creates pending owner config and Vault secret'
);
select extensions.results_eq(
  format($sql$select state,revision,adapter_kind,model,consented_origin is null
    from public.user_model_gateway_configs where id=%L::uuid and user_id=%L::uuid$sql$,
    :'config_a', :'user_a'),
  $$values ('pending_consent'::text,1,'openai-compatible'::text,'provider/model-v1'::text,true)$$,
  'creation derives adapter and leaves consent pending'
);
select extensions.is(
  (select count(*)::integer from private.user_model_gateway_secrets
   where config_id=:'config_a' and user_id=:'user_a'),
  1,
  'one private Vault reference is created'
);
select extensions.is(
  (select count(*)::integer from private.user_model_gateway_secrets s
   join vault.decrypted_secrets v on v.id=s.vault_secret_id
   where s.config_id=:'config_a' and s.user_id=:'user_a' and v.decrypted_secret='secret-a'),
  1,
  'Vault resolves the exact write-only key only to service role'
);
select extensions.throws_ok(
  format($sql$select * from public.activate_user_model_gateway_config(
    %L::uuid,%L::uuid,'https://other.example','model-egress-v1','2026-08-19 10:01:00+00')$sql$,
    :'user_a', :'config_a'),
  '22023', null, 'activation rejects consent to a different origin'
);
select extensions.lives_ok(
  format($sql$select * from public.activate_user_model_gateway_config(
    %L::uuid,%L::uuid,'https://models.example.com','model-egress-v1','2026-08-19 10:01:00+00')$sql$,
    :'user_a', :'config_a'),
  'activation records exact-origin consent'
);
select extensions.throws_ok(
  format($sql$update public.user_model_gateway_configs set model='mutated'
    where id=%L::uuid$sql$, :'config_a'),
  '42501', null, 'service role cannot bypass RPCs to mutate config semantics');
select extensions.throws_ok(
  format($sql$update public.user_model_gateway_configs set consented_origin='https://attacker.example.com'
    where id=%L::uuid$sql$, :'config_a'),
  '42501', null, 'service role cannot rewrite consent evidence directly');
select extensions.throws_ok(
  format($sql$delete from public.user_model_gateway_configs where id=%L::uuid$sql$, :'config_a'),
  '42501', null, 'service role cannot delete immutable config versions directly');
select extensions.throws_ok(
  format($sql$insert into public.user_model_gateway_configs (
      id,user_id,display_name,origin_id,adapter_kind,model,revision,
      config_fingerprint,state,created_at,updated_at)
    values ('81000000-0000-4000-8000-000000000099',%L::uuid,'forged',%L::uuid,
      'openai-compatible','forged',99,repeat('f',64),'pending_consent',now(),now())$sql$,
    :'user_a', :'origin_id'),
  '42501', null, 'service role cannot insert config versions outside the RPC');
select extensions.throws_ok(
  format($sql$update public.model_gateway_origins set base_path='/attacker'
    where id=%L::uuid$sql$, :'origin_id'),
  '23514', null, 'referenced catalog transport semantics are immutable');
select extensions.throws_ok(
  format($sql$update public.model_gateway_origins set canonical_origin='https://other.example.com'
    where id=%L::uuid$sql$, :'origin_id'),
  '23514', null, 'referenced catalog exact origin is immutable');
select extensions.throws_ok(
  format($sql$update public.model_gateway_origins set adapter_kind='dynamic-plugin'
    where id=%L::uuid$sql$, :'origin_id'),
  '23514', null, 'referenced catalog adapter kind cannot change');
select extensions.lives_ok(
  format($sql$select public.rename_user_model_gateway_config(
    %L::uuid,%L::uuid,'Renamed Gateway','2026-08-19 10:01:30+00')$sql$,
    :'user_a', :'config_a'),
  'rename uses a bounded owner RPC without new consent'
);
select extensions.results_eq(
  format($sql$select display_name,revision,config_fingerprint,state,consented_origin
    from public.user_model_gateway_configs where id=%L::uuid$sql$, :'config_a'),
  $$select 'Renamed Gateway'::text,1,encode(digest(
      'adapter:17:openai-compatible|origin:26:https://models.example.com|path:3:/v1|model:17:provider/model-v1',
      'sha256'),'hex'),'active'::text,'https://models.example.com'::text$$,
  'rename preserves revision, fingerprint, state, and consent'
);
select extensions.results_eq(
  format($sql$select display_name,canonical_origin,base_path,adapter_kind,model,revision,
      config_fingerprint,api_key,credential_revision
    from public.resolve_user_model_gateway_config(%L::uuid,%L::uuid,1)$sql$,
    :'user_a', :'config_a'),
  $$select 'Renamed Gateway'::text,'https://models.example.com'::text,'/v1'::text,
      'openai-compatible'::text,'provider/model-v1'::text,1,encode(digest(
        'adapter:17:openai-compatible|origin:26:https://models.example.com|path:3:/v1|model:17:provider/model-v1',
        'sha256'),'hex'),
      'secret-a'::text,1$$,
  'resolver returns one owner-pinned active config and key'
);
select extensions.is(
  (select count(*)::integer from public.resolve_user_model_gateway_config(
    :'user_b', :'config_a', 1)),
  0,
  'resolver cannot cross user ownership'
);
select extensions.lives_ok(
  format($sql$select public.rotate_user_model_gateway_key(
    %L::uuid,%L::uuid,'secret-b','2026-08-19 10:02:00+00')$sql$,
    :'user_a', :'config_a'),
  'owner-bound rotation updates Vault'
);
select extensions.results_eq(
  format($sql$select api_key,credential_revision from public.resolve_user_model_gateway_config(
    %L::uuid,%L::uuid,1)$sql$, :'user_a', :'config_a'),
  $$values ('secret-b'::text,2)$$,
  'pending jobs use the rotated credential without changing config revision'
);
create temporary table gateway_explicit_revoke_vault_before on commit drop as
select vault_secret_id
from private.user_model_gateway_secrets
where user_id=:'user_a' and config_id=:'config_a';
select extensions.lives_ok(
  format($sql$select public.revoke_user_model_gateway_config(
    %L::uuid,%L::uuid,'2026-08-19 10:03:00+00')$sql$, :'user_a', :'config_a'),
  'revocation disables config before destroying secret'
);
select extensions.is(
  (select count(*)::integer from public.resolve_user_model_gateway_config(
    :'user_a', :'config_a', 1)),
  0,
  'revoked config cannot resolve for egress'
);
select extensions.is(
  (select count(*)::integer from private.user_model_gateway_secrets
   where config_id=:'config_a' and user_id=:'user_a'),
  0,
  'revocation removes the secret reference'
);
select extensions.is(
  (select count(*)::integer from vault.secrets
   where id=(select vault_secret_id from gateway_explicit_revoke_vault_before)),
  0,
  'explicit revocation destroys the Vault secret row'
);
select extensions.is(
  public.revoke_user_model_gateway_config(
    :'user_a', :'config_a', '2026-08-19 10:04:00+00'),
  true,
  'revocation replay is idempotent for an owned revoked config'
);

select extensions.lives_ok(
  format($sql$select * from public.create_user_model_gateway_config(
    %L::uuid,'81000000-0000-4000-8000-00000000b001'::uuid,%L::uuid,
    'User B first','provider/model-v1','secret-b-first','2026-08-19 10:04:10+00')$sql$,
    :'user_b', :'origin_id'),
  'user B creates a first configuration version'
);
select extensions.lives_ok(
  format($sql$select public.activate_user_model_gateway_config(
    %L::uuid,'81000000-0000-4000-8000-00000000b001'::uuid,
    'https://models.example.com','model-egress-v1','2026-08-19 10:04:20+00')$sql$,
    :'user_b'),
  'user B activates the first configuration'
);
create temporary table gateway_old_vault_secret_before on commit drop as
select vault_secret_id
from private.user_model_gateway_secrets
where user_id=:'user_b' and config_id='81000000-0000-4000-8000-00000000b001';
select extensions.lives_ok(
  format($sql$select * from public.create_user_model_gateway_config(
    %L::uuid,'81000000-0000-4000-8000-00000000b002'::uuid,%L::uuid,
    'User B second','provider/model-v2','secret-b-second','2026-08-19 10:04:30+00')$sql$,
    :'user_b', :'origin_id'),
  'user B creates a second immutable configuration version'
);
select extensions.lives_ok(
  format($sql$select public.activate_user_model_gateway_config(
    %L::uuid,'81000000-0000-4000-8000-00000000b002'::uuid,
    'https://models.example.com','model-egress-v1','2026-08-19 10:04:40+00')$sql$,
    :'user_b'),
  'activating a second version atomically replaces the active version'
);
select extensions.results_eq(
  format($sql$select revision,state from public.user_model_gateway_configs
    where user_id=%L::uuid order by revision$sql$, :'user_b'),
  $$values (1,'revoked'::text),(2,'active'::text)$$,
  'second activation revokes the old version and activates the new version'
);
select extensions.is(
  (select count(*)::integer from public.user_model_gateway_configs
   where user_id=:'user_b' and state='active'),
  1,
  'the database preserves exactly one active configuration per user'
);
select extensions.is(
  (select count(*)::integer from private.user_model_gateway_secrets
   where user_id=:'user_b' and config_id='81000000-0000-4000-8000-00000000b001'),
  0,
  'replaced configuration loses its obsolete secret reference'
);
select extensions.is(
  (select count(*)::integer from vault.secrets
   where id=(select vault_secret_id from gateway_old_vault_secret_before)),
  0,
  'replaced configuration destroys its obsolete Vault secret row'
);
select extensions.is(
  (select count(*)::integer from private.user_model_gateway_secrets
   where user_id=:'user_b' and config_id='81000000-0000-4000-8000-00000000b002'),
  1,
  'new active configuration retains exactly one secret reference'
);

reset role;
insert into public.user_model_gateway_configs (
  id,user_id,display_name,origin_id,adapter_kind,model,revision,
  config_fingerprint,state,created_at,updated_at
) values (
  '81000000-0000-4000-8000-000000000002', :'user_a', 'Missing Secret', :'origin_id',
  'openai-compatible','provider/model-v1',2,repeat('b',64),'pending_consent',
  '2026-08-19 10:05:00+00','2026-08-19 10:05:00+00'
);
set local role service_role;
select extensions.is(
  public.revoke_user_model_gateway_config(
    :'user_a','81000000-0000-4000-8000-000000000002','2026-08-19 10:06:00+00'),
  true,
  'missing secret mapping cannot prevent owner config revocation'
);
select extensions.results_eq(
  $$select state,revoked_at is not null from public.user_model_gateway_configs
    where id='81000000-0000-4000-8000-000000000002'$$,
  $$values ('revoked'::text,true)$$,
  'corrupt missing-secret config is fail-closed revoked'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);
select extensions.results_eq(
  $$select display_name,state from public.user_model_gateway_configs order by revision$$,
  $$values ('Renamed Gateway'::text,'revoked'::text),
           ('Missing Secret'::text,'revoked'::text)$$,
  'owner can read only non-secret own config metadata'
);
select set_config('request.jwt.claim.sub', :'user_b', true);
select extensions.is(
  (select count(*)::integer from public.user_model_gateway_configs
   where user_id=:'user_a'),
  0,
  'another user cannot read user A config metadata'
);
reset role;

select extensions.finish();
rollback;
