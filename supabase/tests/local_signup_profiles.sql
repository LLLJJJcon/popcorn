begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set signup_user '17000000-0000-4000-8000-000000000001'
\set signup_config '17100000-0000-4000-8000-000000000001'

select extensions.ok(
  (select count(*) = 1
     and bool_and(trigger.tgdeferrable)
     and bool_and(trigger.tginitdeferred)
     and bool_and(trigger.tgenabled = 'O')
   from pg_catalog.pg_trigger as trigger
   join pg_catalog.pg_class as relation on relation.oid = trigger.tgrelid
   join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'auth'
     and relation.relname = 'users'
     and trigger.tgname = 'popcorn_create_profile_after_auth_user'
     and not trigger.tgisinternal),
  'auth signup has one initially-deferred profile trigger'
);

select extensions.ok(
  (select count(*) = 1
     and bool_and(function.prosecdef)
     and bool_and(function.proconfig @> array['search_path=pg_catalog']::text[])
     and bool_and(not has_function_privilege('public', function.oid, 'execute'))
     and bool_and(not has_function_privilege('anon', function.oid, 'execute'))
     and bool_and(not has_function_privilege('authenticated', function.oid, 'execute'))
     and bool_and(not has_function_privilege('service_role', function.oid, 'execute'))
   from pg_catalog.pg_proc as function
   join pg_catalog.pg_namespace as namespace on namespace.oid = function.pronamespace
   where namespace.nspname = 'private'
     and function.proname = 'create_profile_for_new_auth_user'),
  'profile trigger function is fixed-search-path and cannot be called directly'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', :'signup_user',
  'authenticated', 'authenticated', 'fresh-signup@popcorn.test',
  crypt('not-a-real-user-secret', gen_salt('bf')), '2026-08-22 10:00:00+00',
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"untrusted":"ignored"}'::jsonb,
  '2026-08-22 10:00:00+00', '2026-08-22 10:00:00+00'
);

set constraints all immediate;

select extensions.results_eq(
  format(
    'select user_id,native_language,target_language,created_at,updated_at from public.profiles where user_id=%L::uuid',
    :'signup_user'
  ),
  $$values (
    '17000000-0000-4000-8000-000000000001'::uuid,
    'en'::text,
    'zh-CN'::text,
    '2026-08-22 10:00:00+00'::timestamptz,
    '2026-08-22 10:00:00+00'::timestamptz
  )$$,
  'committed signup creates exactly one fixed-language profile from auth identity only'
);

set local role service_role;

select extensions.lives_ok(
  format(
    $sql$select * from public.create_user_model_gateway_config(
      %L::uuid,%L::uuid,'https://models.example.com','/v1',
      'Fresh signup gateway','provider/model-v1','disposable-test-key',
      '2026-08-22 10:01:00+00'::timestamptz
    )$sql$,
    :'signup_user', :'signup_config'
  ),
  'fresh signup can create a user-entered gateway without manual profile insertion'
);

select extensions.lives_ok(
  format(
    $sql$select public.activate_user_model_gateway_config(
      %L::uuid,%L::uuid,'https://models.example.com/v1',
      'model-egress-v1','2026-08-22 10:02:00+00'::timestamptz
    )$sql$,
    :'signup_user', :'signup_config'
  ),
  'fresh signup can grant exact-destination consent and activate the gateway'
);

select extensions.results_eq(
  format(
    'select state,consented_origin from public.user_model_gateway_configs where id=%L::uuid and user_id=%L::uuid',
    :'signup_config', :'signup_user'
  ),
  $$values ('active'::text,'https://models.example.com/v1'::text)$$,
  'activated gateway keeps the expected state and exact destination'
);

reset role;

select * from extensions.finish();
rollback;
