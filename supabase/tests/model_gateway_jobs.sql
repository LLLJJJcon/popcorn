begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set user_a '09000000-0000-4000-8000-00000000a001'
\set user_b '09000000-0000-4000-8000-00000000b002'
\set origin_id '89000000-0000-4000-8000-000000000001'
\set config_a '89100000-0000-4000-8000-000000000001'
\set config_b '89100000-0000-4000-8000-000000000002'
\set replace_old '89100000-0000-4000-8000-000000000003'
\set replace_new '89100000-0000-4000-8000-000000000004'
\set replace_corrupt '89100000-0000-4000-8000-000000000005'
\set source_a '89200000-0000-4000-8000-000000000001'
\set source_b '89200000-0000-4000-8000-000000000002'

select extensions.has_table(
  'private', 'learning_artifact_gateway_pins',
  'gateway learning-artifact pins are stored in a private table'
);
select extensions.ok(
  (select c.relrowsecurity
   from pg_catalog.pg_class as c
   join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'private' and c.relname = 'learning_artifact_gateway_pins'),
  'gateway pins have RLS enabled'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'private.learning_artifact_gateway_pins', 'select')
    and not has_table_privilege('anon', 'private.learning_artifact_gateway_pins', 'select')
    and has_table_privilege('service_role', 'private.learning_artifact_gateway_pins', 'select')
    and has_table_privilege('service_role', 'private.learning_artifact_gateway_pins', 'insert')
    and not has_table_privilege('service_role', 'private.learning_artifact_gateway_pins', 'update')
    and not has_table_privilege('service_role', 'private.learning_artifact_gateway_pins', 'delete'),
  'gateway pins are service-only and immutable after insertion'
);
select extensions.ok(
  (select count(*) = 3 and bool_and(
      has_function_privilege('service_role', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('public', p.oid, 'execute')
    )
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = any(array[
     'resolve_active_user_model_gateway_pin',
     'register_gateway_learning_artifact_job',
     'complete_gateway_learning_artifact_job'
   ])),
  'all gateway-aware learning-artifact RPCs are service-role-only'
);
select extensions.ok(
  (select count(*) = 1 and bool_and(
      not has_function_privilege('service_role', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('public', p.oid, 'execute')
    )
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname = 'cleanup_revoked_user_model_gateway_config'),
  'shared revoked-config cleanup helper is inaccessible to every runtime role'
);
select extensions.ok(
  (select pg_get_functiondef(p.oid) not like '%decrypted_secrets%'
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'resolve_active_user_model_gateway_pin'),
  'non-secret pin lookup never reads decrypted Vault material'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', :'user_a', 'authenticated', 'authenticated',
   'gateway-job-a@popcorn.test', crypt('password-a', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', :'user_b', 'authenticated', 'authenticated',
   'gateway-job-b@popcorn.test', crypt('password-b', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;
insert into public.profiles (user_id)
values (:'user_a'), (:'user_b') on conflict (user_id) do nothing;
insert into public.video_sources (id, user_id, youtube_video_id, canonical_url)
values
  (:'source_a', :'user_a', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  (:'source_b', :'user_b', 'M7lc1UVf-VE', 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
insert into public.model_gateway_origins (
  id, slug, display_name, canonical_origin, base_path, adapter_kind, state
) values (
  :'origin_id', 'gateway-jobs', 'Gateway jobs fixture',
  'https://gateway-jobs.example.com', '/v1', 'openai-compatible', 'active'
);

set local role service_role;
select extensions.lives_ok(
  format($sql$select * from public.create_user_model_gateway_config(
    %L::uuid,%L::uuid,%L::uuid,'Gateway A','provider/model-v1','secret-a',
    '2026-08-19 12:00:00+00'::timestamptz)$sql$, :'user_a', :'config_a', :'origin_id'),
  'owner creates a pending configuration'
);
select extensions.is(
  (select count(*)::integer from public.resolve_active_user_model_gateway_pin(:'user_a')),
  0,
  'pending configuration is excluded from active lookup'
);
select extensions.lives_ok(
  format($sql$select public.activate_user_model_gateway_config(
    %L::uuid,%L::uuid,'https://gateway-jobs.example.com','model-egress-v1',
    '2026-08-19 12:00:01+00'::timestamptz)$sql$, :'user_a', :'config_a'),
  'exact-origin consent activates the configuration'
);
select extensions.results_eq(
  $$select config_id,revision,model
    from public.resolve_active_user_model_gateway_pin(
      '09000000-0000-4000-8000-00000000a001')$$,
  $$values ('89100000-0000-4000-8000-000000000001'::uuid,1,'provider/model-v1'::text)$$,
  'active lookup returns the exact non-secret owner pin'
);
select extensions.results_eq(
  $$select array_agg(key order by key)
    from public.resolve_active_user_model_gateway_pin(
      '09000000-0000-4000-8000-00000000a001') as pin
    cross join lateral jsonb_object_keys(to_jsonb(pin)) as key$$,
  $$values (array['config_fingerprint','config_id','model','revision']::text[])$$,
  'active lookup exposes only four non-secret fields'
);
select extensions.is(
  (select count(*)::integer from public.resolve_active_user_model_gateway_pin(:'user_b')),
  0,
  'active lookup is owner-bound'
);
select extensions.lives_ok(
  format($sql$select * from public.create_user_model_gateway_config(
    %L::uuid,%L::uuid,%L::uuid,'Gateway B','provider/model-v1','secret-b',
    '2026-08-19 12:00:02+00'::timestamptz)$sql$, :'user_b', :'config_b', :'origin_id'),
  'second owner creates a separate configuration'
);
select extensions.lives_ok(
  format($sql$select public.activate_user_model_gateway_config(
    %L::uuid,%L::uuid,'https://gateway-jobs.example.com','model-egress-v1',
    '2026-08-19 12:00:03+00'::timestamptz)$sql$, :'user_b', :'config_b'),
  'second owner activates the separate configuration'
);
reset role;
delete from private.user_model_gateway_secrets
where user_id = :'user_b' and config_id = :'config_b';
set local role service_role;
select extensions.is(
  (select count(*)::integer from public.resolve_active_user_model_gateway_pin(:'user_b')),
  0,
  'active metadata without a credential mapping is excluded from lookup'
);

reset role;
update public.model_gateway_origins set state = 'disabled' where id = :'origin_id';
set local role service_role;
select extensions.is(
  (select count(*)::integer from public.resolve_active_user_model_gateway_pin(:'user_a')),
  0,
  'disabled origin is excluded from active lookup'
);
reset role;
update public.model_gateway_origins set state = 'active' where id = :'origin_id';
update public.user_model_gateway_configs
set consented_origin = 'https://stale-consent.example.com'
where id = :'config_a';
set local role service_role;
select extensions.is(
  (select count(*)::integer from public.resolve_active_user_model_gateway_pin(:'user_a')),
  0,
  'stale exact-origin consent is excluded from active lookup'
);
reset role;
update public.user_model_gateway_configs
set consented_origin = 'https://gateway-jobs.example.com'
where id = :'config_a';
set local role service_role;

create temporary table gateway_job_results (
  label text primary key,
  knowledge_job_id uuid not null,
  status text not null,
  created boolean not null
) on commit drop;
grant select, insert on table gateway_job_results to service_role;

insert into gateway_job_results
select 'success', result.*
from public.register_gateway_learning_artifact_job(
  :'user_a', :'source_a', 'generate_overview', repeat('1',64),
  '{"request":"overview"}'::jsonb, :'config_a', 1,
  (select config_fingerprint from public.user_model_gateway_configs where id = :'config_a'),
  '2026-08-19 12:01:00+00'
) as result;
select extensions.results_eq(
  $$select pin.user_id,pin.config_id,pin.config_revision,pin.config_fingerprint
    from private.learning_artifact_gateway_pins as pin
    join gateway_job_results as result on result.knowledge_job_id = pin.knowledge_job_id
    where result.label = 'success'$$,
  $$select '09000000-0000-4000-8000-00000000a001'::uuid,
      '89100000-0000-4000-8000-000000000001'::uuid,1,config_fingerprint
    from public.user_model_gateway_configs
    where id = '89100000-0000-4000-8000-000000000001'$$,
  'registration creates one exact typed gateway pin'
);
select extensions.results_eq(
  $$select status,created from public.register_gateway_learning_artifact_job(
    '09000000-0000-4000-8000-00000000a001',
    '89200000-0000-4000-8000-000000000001','generate_overview',repeat('1',64),
    '{"replacement":"must-not-win"}'::jsonb,
    '89100000-0000-4000-8000-000000000001',1,
    (select config_fingerprint from public.user_model_gateway_configs
      where id='89100000-0000-4000-8000-000000000001'),
    '2026-08-19 12:01:01+00')$$,
  $$values ('pending'::text,false)$$,
  'registration replay is idempotent for the exact same pin'
);
select extensions.results_eq(
  $$select input from public.knowledge_job_internal as internal
    join gateway_job_results as result on result.knowledge_job_id = internal.knowledge_job_id
    where result.label = 'success'$$,
  $$values ('{"request":"overview"}'::jsonb)$$,
  'registration replay does not replace the first private input'
);
select extensions.throws_ok(
  $$select * from public.register_gateway_learning_artifact_job(
    '09000000-0000-4000-8000-00000000a001',
    '89200000-0000-4000-8000-000000000001','generate_overview',repeat('1',64),'{}',
    '89100000-0000-4000-8000-000000000001',1,repeat('f',64),
    '2026-08-19 12:01:02+00')$$,
  '22023', null, 'registration rejects a mismatched fingerprint replay'
);
select extensions.throws_ok(
  $$select * from public.register_gateway_learning_artifact_job(
    '09000000-0000-4000-8000-00000000a001',
    '89200000-0000-4000-8000-000000000001','generate_overview',repeat('2',64),'{}',
    '89100000-0000-4000-8000-000000000001',2,
    (select config_fingerprint from public.user_model_gateway_configs
      where id='89100000-0000-4000-8000-000000000001'),
    '2026-08-19 12:01:03+00')$$,
  '22023', null, 'registration rejects a stale config revision'
);
select extensions.is(
  (select count(*)::integer from public.knowledge_jobs
   where user_id = :'user_a' and dedupe_key = repeat('2',64)),
  0,
  'failed registration leaves no orphan job'
);
select * from public.register_learning_artifact_job(
  :'user_a', :'source_a', 'generate_overview', repeat('7',64),
  '{"legacy":"unpinned"}'::jsonb, '2026-08-19 12:01:03+00'
);
select extensions.throws_ok(
  $$select * from public.register_gateway_learning_artifact_job(
    '09000000-0000-4000-8000-00000000a001',
    '89200000-0000-4000-8000-000000000001','generate_overview',repeat('7',64),'{}',
    '89100000-0000-4000-8000-000000000001',1,
    (select config_fingerprint from public.user_model_gateway_configs
      where id='89100000-0000-4000-8000-000000000001'),
    '2026-08-19 12:01:04+00')$$,
  '22023', null, 'gateway registration refuses to adopt an unpinned legacy replay'
);
select extensions.is(
  (select count(*)::integer from private.learning_artifact_gateway_pins as pin
   join public.knowledge_jobs as job on job.id = pin.knowledge_job_id
   where job.user_id = :'user_a' and job.dedupe_key = repeat('7',64)),
  0,
  'failed legacy replay does not synthesize a gateway pin'
);
select extensions.throws_ok(
  $$select * from public.register_gateway_learning_artifact_job(
    '09000000-0000-4000-8000-00000000b002',
    '89200000-0000-4000-8000-000000000002','generate_overview',repeat('3',64),'{}',
    '89100000-0000-4000-8000-000000000001',1,
    (select config_fingerprint from public.user_model_gateway_configs
      where id='89100000-0000-4000-8000-000000000001'),
    '2026-08-19 12:01:04+00')$$,
  '22023', null, 'registration cannot cross user ownership'
);

update public.knowledge_jobs as job
set status = 'leased', attempt_count = 1,
  lease_expires_at = '2026-08-19 12:10:00+00', updated_at = '2026-08-19 12:02:00+00'
from gateway_job_results as result
where result.label = 'success' and job.id = result.knowledge_job_id;
select extensions.is(
  public.complete_gateway_learning_artifact_job(
    :'user_a',
    (select knowledge_job_id from gateway_job_results where label = 'success'),
    :'source_a','generate_overview','2026-08-19 12:10:00+00',1,'overview',
    '{"summaryEnglish":"Wrong model","evidenceChinese":"模型不匹配。"}'::jsonb,
    'overview-v1','other-model',repeat('1',64),:'config_a',1,
    (select config_fingerprint from public.user_model_gateway_configs where id = :'config_a'),
    '2026-08-19 12:02:30+00'
  ),
  null::uuid,
  'completion rejects a model that does not match the pinned config'
);
select extensions.is(
  public.complete_gateway_learning_artifact_job(
    :'user_a',
    (select knowledge_job_id from gateway_job_results where label = 'success'),
    :'source_a','generate_overview','2026-08-19 12:10:00+00',1,'overview',
    '{"summaryEnglish":"Wrong pin","evidenceChinese":"固定不匹配。"}'::jsonb,
    'overview-v1','provider/model-v1',repeat('1',64),:'config_a',1,repeat('f',64),
    '2026-08-19 12:02:31+00'
  ),
  null::uuid,
  'completion rejects a mismatched semantic fingerprint'
);
select extensions.results_eq(
  $$select job.status,(select count(*) from public.generated_artifacts
      where user_id='09000000-0000-4000-8000-00000000a001' and result_key=repeat('1',64))
    from public.knowledge_jobs as job
    join gateway_job_results as result on result.knowledge_job_id=job.id
    where result.label='success'$$,
  $$values ('leased'::text,0::bigint)$$,
  'wrong completion pins preserve the lease and publish nothing'
);
select extensions.ok(
  public.complete_gateway_learning_artifact_job(
    :'user_a',
    (select knowledge_job_id from gateway_job_results where label = 'success'),
    :'source_a','generate_overview','2026-08-19 12:10:00+00',1,'overview',
    '{"summaryEnglish":"Pinned overview","evidenceChinese":"今天学习中文。"}'::jsonb,
    'overview-v1','provider/model-v1',repeat('1',64),:'config_a',1,
    (select config_fingerprint from public.user_model_gateway_configs where id = :'config_a'),
    '2026-08-19 12:03:00+00'
  ) is not null,
  'exact active pin completes and publishes an artifact atomically'
);

insert into gateway_job_results
select label, result.*
from (values
  ('pending'::text,'translate_segments'::text,repeat('4',64),'{"request":"pending"}'::jsonb),
  ('retryable'::text,'explain_selection'::text,repeat('5',64),'{"request":"retryable"}'::jsonb),
  ('leased'::text,'generate_overview'::text,repeat('6',64),'{"request":"leased"}'::jsonb)
) as fixture(label,job_type,dedupe_key,input)
cross join lateral public.register_gateway_learning_artifact_job(
  :'user_a', :'source_a', fixture.job_type, fixture.dedupe_key, fixture.input,
  :'config_a', 1,
  (select config_fingerprint from public.user_model_gateway_configs where id = :'config_a'),
  '2026-08-19 12:04:00+00'
) as result;
update public.knowledge_jobs as job
set status = 'retryable_failed', attempt_count = 1,
  next_attempt_at = '2026-08-19 12:06:00+00', last_error_code = 'PROVIDER_TIMEOUT'
from gateway_job_results as result
where result.label = 'retryable' and job.id = result.knowledge_job_id;
update public.knowledge_jobs as job
set status = 'leased', attempt_count = 1,
  lease_expires_at = '2026-08-19 12:20:00+00'
from gateway_job_results as result
where result.label = 'leased' and job.id = result.knowledge_job_id;
create temporary table revoked_vault_secret on commit drop as
select vault_secret_id from private.user_model_gateway_secrets
where user_id = :'user_a' and config_id = :'config_a';
grant select on table revoked_vault_secret to service_role;

select extensions.is(
  public.revoke_user_model_gateway_config(
    :'user_a', :'config_a', '2026-08-19 12:05:00+00'),
  true,
  'revocation succeeds for the active pinned configuration'
);
select extensions.results_eq(
  $$select result.label,job.status,job.next_attempt_at,job.lease_expires_at,
      job.last_error_code,internal.input
    from gateway_job_results as result
    join public.knowledge_jobs as job on job.id = result.knowledge_job_id
    join public.knowledge_job_internal as internal on internal.knowledge_job_id = job.id
    where result.label in ('leased','pending','retryable')
    order by result.label$$,
  $$values
    ('leased'::text,'terminal_failed'::text,null::timestamptz,null::timestamptz,
      'MODEL_GATEWAY_REVOKED'::text,'{}'::jsonb),
    ('pending'::text,'terminal_failed'::text,null::timestamptz,null::timestamptz,
      'MODEL_GATEWAY_REVOKED'::text,'{}'::jsonb),
    ('retryable'::text,'terminal_failed'::text,null::timestamptz,null::timestamptz,
      'MODEL_GATEWAY_REVOKED'::text,'{}'::jsonb)$$,
  'revocation terminalizes every recoverable pinned job and clears private input'
);
select extensions.results_eq(
  $$select job.status,internal.result,(select count(*) from public.generated_artifacts
      where user_id='09000000-0000-4000-8000-00000000a001' and result_key=repeat('1',64))
    from gateway_job_results as result
    join public.knowledge_jobs as job on job.id=result.knowledge_job_id
    join public.knowledge_job_internal as internal on internal.knowledge_job_id=job.id
    where result.label='success'$$,
  $$select 'succeeded'::text,jsonb_build_object('artifactId',artifact.id),1::bigint
    from public.generated_artifacts as artifact
    where artifact.user_id='09000000-0000-4000-8000-00000000a001'
      and artifact.result_key=repeat('1',64)$$,
  'revocation preserves already-succeeded work'
);
select extensions.is(
  (select count(*)::integer from private.user_model_gateway_secrets
   where user_id = :'user_a' and config_id = :'config_a'),
  0,
  'revocation deletes the private credential mapping'
);
select extensions.is(
  (select count(*)::integer from vault.secrets
   where id = (select vault_secret_id from revoked_vault_secret)),
  0,
  'revocation destroys the actual Vault secret'
);
select extensions.is(
  public.complete_gateway_learning_artifact_job(
    :'user_a',(select knowledge_job_id from gateway_job_results where label = 'leased'),
    :'source_a','generate_overview','2026-08-19 12:20:00+00',1,'overview',
    '{"summaryEnglish":"Forbidden","evidenceChinese":"不得发布。"}'::jsonb,
    'overview-v1','provider/model-v1',repeat('6',64),:'config_a',1,
    (select config_fingerprint from public.user_model_gateway_configs where id = :'config_a'),
    '2026-08-19 12:06:00+00'
  ),
  null::uuid,
  'completion after revoke loses its publication fence'
);
select extensions.is(
  (select count(*)::integer from public.generated_artifacts
   where user_id = :'user_a' and result_key = repeat('6',64)),
  0,
  'completion after revoke publishes no artifact'
);
select extensions.is(
  public.revoke_user_model_gateway_config(
    :'user_a', :'config_a', '2026-08-19 12:07:00+00'),
  true,
  'revocation replay remains idempotent'
);
reset role;
create temporary table corrupt_replay_vault on commit drop as
select vault.create_secret(
  'must-be-destroyed',
  'popcorn:model-gateway:corrupt-replay',
  'Corrupt replay fixture'
) as vault_secret_id;
grant select on table corrupt_replay_vault to service_role;
insert into private.user_model_gateway_secrets (
  config_id,user_id,vault_secret_id,credential_revision,created_at,updated_at
)
select :'config_a', :'user_a', vault_secret_id, 1,
  '2026-08-19 12:07:01+00', '2026-08-19 12:07:01+00'
from corrupt_replay_vault;
set local role service_role;
select extensions.is(
  public.revoke_user_model_gateway_config(
    :'user_a', :'config_a', '2026-08-19 12:07:02+00'),
  true,
  'revocation replay repairs an already-revoked row with a stray credential'
);
select extensions.is(
  (select count(*)::integer from vault.secrets
   where id = (select vault_secret_id from corrupt_replay_vault)),
  0,
  'idempotent revocation destroys a stray Vault row'
);
select extensions.is(
  (select count(*)::integer from public.resolve_active_user_model_gateway_pin(:'user_a')),
  0,
  'revoked configuration is excluded from active lookup'
);

select extensions.lives_ok(
  format($sql$select * from public.create_user_model_gateway_config(
    %L::uuid,%L::uuid,%L::uuid,'Replacement old','provider/model-v1','replace-old-secret',
    '2026-08-19 12:08:00+00'::timestamptz)$sql$, :'user_a', :'replace_old', :'origin_id'),
  'owner creates the active configuration that will be replaced'
);
select extensions.lives_ok(
  format($sql$select public.activate_user_model_gateway_config(
    %L::uuid,%L::uuid,'https://gateway-jobs.example.com','model-egress-v1',
    '2026-08-19 12:08:01+00'::timestamptz)$sql$, :'user_a', :'replace_old'),
  'owner activates the configuration that will be replaced'
);

create temporary table replacement_job_results (
  label text primary key,
  knowledge_job_id uuid not null,
  status text not null,
  created boolean not null
) on commit drop;
grant select, insert on table replacement_job_results to service_role;

insert into replacement_job_results
select fixture.label, result.*
from (values
  ('pending'::text,'translate_segments'::text,repeat('8',64),'{"request":"replacement-pending"}'::jsonb),
  ('retryable'::text,'explain_selection'::text,repeat('9',64),'{"request":"replacement-retryable"}'::jsonb),
  ('leased'::text,'generate_overview'::text,repeat('a',64),'{"request":"replacement-leased"}'::jsonb),
  ('succeeded'::text,'generate_overview'::text,repeat('b',64),'{"request":"replacement-succeeded"}'::jsonb)
) as fixture(label,job_type,dedupe_key,input)
cross join lateral public.register_gateway_learning_artifact_job(
  :'user_a', :'source_a', fixture.job_type, fixture.dedupe_key, fixture.input,
  :'replace_old',
  (select revision from public.user_model_gateway_configs where id = :'replace_old'),
  (select config_fingerprint from public.user_model_gateway_configs where id = :'replace_old'),
  '2026-08-19 12:08:02+00'
) as result;
update public.knowledge_jobs as job
set status = 'retryable_failed', attempt_count = 1,
  next_attempt_at = '2026-08-19 12:18:00+00', last_error_code = 'PROVIDER_TIMEOUT'
from replacement_job_results as result
where result.label = 'retryable' and job.id = result.knowledge_job_id;
update public.knowledge_jobs as job
set status = 'leased', attempt_count = 1,
  lease_expires_at = '2026-08-19 12:28:00+00'
from replacement_job_results as result
where result.label in ('leased','succeeded') and job.id = result.knowledge_job_id;
select extensions.ok(
  public.complete_gateway_learning_artifact_job(
    :'user_a',
    (select knowledge_job_id from replacement_job_results where label = 'succeeded'),
    :'source_a','generate_overview','2026-08-19 12:28:00+00',1,'overview',
    '{"summaryEnglish":"Keep replacement result","evidenceChinese":"已完成结果必须保留。"}'::jsonb,
    'overview-v1','provider/model-v1',repeat('b',64),:'replace_old',
    (select revision from public.user_model_gateway_configs where id = :'replace_old'),
    (select config_fingerprint from public.user_model_gateway_configs where id = :'replace_old'),
    '2026-08-19 12:08:03+00'
  ) is not null,
  'replacement fixture publishes one succeeded artifact before config replacement'
);
create temporary table replacement_old_vault on commit drop as
select vault_secret_id from private.user_model_gateway_secrets
where user_id = :'user_a' and config_id = :'replace_old';
grant select on table replacement_old_vault to service_role;

select extensions.lives_ok(
  format($sql$select * from public.create_user_model_gateway_config(
    %L::uuid,%L::uuid,%L::uuid,'Replacement new','provider/model-v1','replace-new-secret',
    '2026-08-19 12:09:00+00'::timestamptz)$sql$, :'user_a', :'replace_new', :'origin_id'),
  'owner creates a replacement pending configuration'
);
select extensions.is(
  public.activate_user_model_gateway_config(
    :'user_a', :'replace_new', 'https://gateway-jobs.example.com', 'model-egress-v1',
    '2026-08-19 12:09:01+00'),
  true,
  'activating a replacement succeeds'
);
select extensions.results_eq(
  $$select result.label,job.status,job.next_attempt_at,job.lease_expires_at,
      job.last_error_code,internal.input
    from replacement_job_results as result
    join public.knowledge_jobs as job on job.id = result.knowledge_job_id
    join public.knowledge_job_internal as internal on internal.knowledge_job_id = job.id
    where result.label in ('leased','pending','retryable')
    order by result.label$$,
  $$values
    ('leased'::text,'terminal_failed'::text,null::timestamptz,null::timestamptz,
      'MODEL_GATEWAY_REVOKED'::text,'{}'::jsonb),
    ('pending'::text,'terminal_failed'::text,null::timestamptz,null::timestamptz,
      'MODEL_GATEWAY_REVOKED'::text,'{}'::jsonb),
    ('retryable'::text,'terminal_failed'::text,null::timestamptz,null::timestamptz,
      'MODEL_GATEWAY_REVOKED'::text,'{}'::jsonb)$$,
  'replacement terminalizes every recoverable old pin and clears private input'
);
select extensions.results_eq(
  $$select job.status,internal.result,(select count(*) from public.generated_artifacts
      where user_id='09000000-0000-4000-8000-00000000a001' and result_key=repeat('b',64))
    from replacement_job_results as result
    join public.knowledge_jobs as job on job.id=result.knowledge_job_id
    join public.knowledge_job_internal as internal on internal.knowledge_job_id=job.id
    where result.label='succeeded'$$,
  $$select 'succeeded'::text,jsonb_build_object('artifactId',artifact.id),1::bigint
    from public.generated_artifacts as artifact
    where artifact.user_id='09000000-0000-4000-8000-00000000a001'
      and artifact.result_key=repeat('b',64)$$,
  'replacement preserves already-succeeded pinned work'
);
select extensions.results_eq(
  $$select id,state from public.user_model_gateway_configs
    where id in (
      '89100000-0000-4000-8000-000000000003',
      '89100000-0000-4000-8000-000000000004')
    order by id$$,
  $$values
    ('89100000-0000-4000-8000-000000000003'::uuid,'revoked'::text),
    ('89100000-0000-4000-8000-000000000004'::uuid,'active'::text)$$,
  'replacement revokes the old config and activates the target config'
);
select extensions.is(
  (select count(*)::integer from private.user_model_gateway_secrets
   where user_id = :'user_a' and config_id = :'replace_old'),
  0,
  'replacement deletes the old credential mapping'
);
select extensions.is(
  (select count(*)::integer from vault.secrets
   where id = (select vault_secret_id from replacement_old_vault)),
  0,
  'replacement destroys the old Vault secret'
);

reset role;
create temporary table corrupt_active_vault on commit drop as
select vault_secret_id from private.user_model_gateway_secrets
where user_id = :'user_a' and config_id = :'replace_new';
grant select on table corrupt_active_vault to service_role;
delete from private.user_model_gateway_secrets
where user_id = :'user_a' and config_id = :'replace_new';
delete from vault.secrets where id = (select vault_secret_id from corrupt_active_vault);
set local role service_role;
select extensions.lives_ok(
  format($sql$select * from public.create_user_model_gateway_config(
    %L::uuid,%L::uuid,%L::uuid,'Corrupt replacement','provider/model-v1','corrupt-replacement-secret',
    '2026-08-19 12:10:00+00'::timestamptz)$sql$, :'user_a', :'replace_corrupt', :'origin_id'),
  'owner creates a target for replacing an active row missing its secret mapping'
);
select extensions.lives_ok(
  format($sql$select public.activate_user_model_gateway_config(
    %L::uuid,%L::uuid,'https://gateway-jobs.example.com','model-egress-v1',
    '2026-08-19 12:10:01+00'::timestamptz)$sql$, :'user_a', :'replace_corrupt'),
  'activation revokes a corrupt old active row without requiring its secret mapping'
);
select extensions.results_eq(
  $$select id,state from public.user_model_gateway_configs
    where id in (
      '89100000-0000-4000-8000-000000000004',
      '89100000-0000-4000-8000-000000000005')
    order by id$$,
  $$values
    ('89100000-0000-4000-8000-000000000004'::uuid,'revoked'::text),
    ('89100000-0000-4000-8000-000000000005'::uuid,'active'::text)$$,
  'corrupt old active config is revoked and the target becomes active'
);

reset role;
select extensions.finish();
rollback;
