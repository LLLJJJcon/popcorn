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
select extensions.results_eq(
  format($sql$select display_name,canonical_origin,base_path,adapter_kind,model,revision,
      config_fingerprint,api_key,credential_revision
    from public.resolve_user_model_gateway_config(%L::uuid,%L::uuid,1)$sql$,
    :'user_a', :'config_a'),
  $$select 'My Gateway'::text,'https://models.example.com'::text,'/v1'::text,
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
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);
select extensions.results_eq(
  $$select display_name,state from public.user_model_gateway_configs order by revision$$,
  $$values ('My Gateway'::text,'revoked'::text)$$,
  'owner can read only non-secret own config metadata'
);
select set_config('request.jwt.claim.sub', :'user_b', true);
select extensions.is(
  (select count(*)::integer from public.user_model_gateway_configs),
  0,
  'another user cannot read config metadata'
);
reset role;

select extensions.finish();
rollback;
