begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set user_a '0a000000-0000-4000-8000-00000000a001'
\set user_b '0a000000-0000-4000-8000-00000000b002'
\set source_a '0a100000-0000-4000-8000-000000000001'
\set source_b '0a100000-0000-4000-8000-000000000002'
\set save_a '0a200000-0000-4000-8000-000000000001'
\set save_a2 '0a200000-0000-4000-8000-000000000003'
\set save_b '0a200000-0000-4000-8000-000000000002'
\set origin_id '0a300000-0000-4000-8000-000000000001'
\set config_a '0a400000-0000-4000-8000-000000000001'
\set config_b '0a400000-0000-4000-8000-000000000002'
\set sense_a '0a500000-0000-4000-8000-000000000001'
\set sense_b '0a500000-0000-4000-8000-000000000002'
\set expression_a '0a600000-0000-4000-8000-000000000001'
\set expression_b '0a600000-0000-4000-8000-000000000002'
\set practice_a '0a700000-0000-4000-8000-000000000001'

select extensions.ok(
  (select count(*) = 5 from information_schema.columns
   where table_schema = 'public' and table_name = 'practice_tasks'
     and column_name in (
       'activation_prompt_version', 'activation_model',
       'activation_gateway_config_id', 'activation_gateway_revision',
       'activation_gateway_fingerprint'
     )),
  'practice activation has the complete provider provenance group'
);
select extensions.ok(
  (select count(*) = 5 from information_schema.columns
   where table_schema = 'public' and table_name = 'attempts'
     and column_name in (
       'evaluation_prompt_version', 'evaluation_model',
       'evaluation_gateway_config_id', 'evaluation_gateway_revision',
       'evaluation_gateway_fingerprint'
     )),
  'attempt evaluation has the complete provider provenance group'
);

select extensions.ok(
  (select pg_get_functiondef(p.oid) like '%analyze_saved_item%'
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'register_learning_artifact_job'),
  'the sole learning-artifact registration RPC admits saved-item analysis'
);
select extensions.ok(
  (select pg_get_functiondef(p.oid) like '%saved_item_analysis%'
   from pg_catalog.pg_proc as p
   join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_learning_artifact_job'),
  'the sole learning-artifact completion RPC maps saved-item analysis'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', :'user_a', 'authenticated', 'authenticated',
   'batch-b-ai-a@popcorn.test', crypt('password-a', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', :'user_b', 'authenticated', 'authenticated',
   'batch-b-ai-b@popcorn.test', crypt('password-b', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (user_id) values (:'user_a'), (:'user_b');
insert into public.video_sources (id,user_id,youtube_video_id,canonical_url) values
  (:'source_a', :'user_a', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  (:'source_b', :'user_b', 'M7lc1UVf-VE', 'https://www.youtube.com/watch?v=M7lc1UVf-VE');
insert into public.saved_items (
  id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
  captured_at,start_seconds,payload
) values
  (:'save_a', :'user_a', :'source_a', '0ae00000-0000-4000-8000-000000000001',
   'dQw4w9WgXcQ','subtitle_row','saved','2026-08-20 10:00:00+00',10,
   '{"segmentId":"seg-a-1","originalChinese":"这也太离谱了吧。","startSeconds":10,"endSeconds":12,"contextBefore":[],"contextAfter":[]}'::jsonb),
  (:'save_a2', :'user_a', :'source_a', '0ae00000-0000-4000-8000-000000000003',
   'dQw4w9WgXcQ','subtitle_row','saved','2026-08-20 10:00:01+00',20,
   '{"segmentId":"seg-a-2","originalChinese":"我完全没想到。","startSeconds":20,"endSeconds":22,"contextBefore":[],"contextAfter":[]}'::jsonb),
  (:'save_b', :'user_b', :'source_b', '0ae00000-0000-4000-8000-000000000002',
   'M7lc1UVf-VE','subtitle_row','saved','2026-08-20 10:00:00+00',10,
   '{"segmentId":"seg-b-1","originalChinese":"我完全没想到。","startSeconds":10,"endSeconds":12,"contextBefore":[],"contextAfter":[]}'::jsonb);
insert into public.model_gateway_origins (
  id,slug,display_name,canonical_origin,base_path,adapter_kind,state
) values (
  :'origin_id','batch-b-ai','Batch B AI fixture','https://batch-b-ai.example.com',
  '/v1','openai-compatible','active'
);

set local role service_role;
select * from public.create_user_model_gateway_config(
  :'user_a', :'config_a', :'origin_id', 'Gateway A', 'provider/model-v1', 'secret-a',
  '2026-08-20 10:00:01+00'
);
select public.activate_user_model_gateway_config(
  :'user_a', :'config_a', 'https://batch-b-ai.example.com', 'model-egress-v1',
  '2026-08-20 10:00:02+00'
);
select * from public.create_user_model_gateway_config(
  :'user_b', :'config_b', :'origin_id', 'Gateway B', 'provider/model-v1', 'secret-b',
  '2026-08-20 10:00:03+00'
);
select public.activate_user_model_gateway_config(
  :'user_b', :'config_b', 'https://batch-b-ai.example.com', 'model-egress-v1',
  '2026-08-20 10:00:04+00'
);

create temporary table analysis_jobs (
  label text primary key,
  knowledge_job_id uuid not null,
  status text not null,
  created boolean not null
) on commit drop;
grant select,insert on table analysis_jobs to service_role;

insert into analysis_jobs
select 'complete', result.*
from public.register_gateway_learning_artifact_job(
  :'user_a', :'source_a', 'analyze_saved_item', repeat('a',64),
  jsonb_build_object('savedItemId', :'save_a', 'evidence', 'first'),
  :'config_a', 1,
  (select config_fingerprint from public.user_model_gateway_configs where id = :'config_a'),
  '2026-08-20 10:01:00+00'
) as result;

select extensions.results_eq(
  $$select job.user_id,job.video_source_id,job.saved_item_id,job.job_type
    from public.knowledge_jobs as job join analysis_jobs as a on a.knowledge_job_id=job.id
    where a.label='complete'$$,
  $$values (
    '0a000000-0000-4000-8000-00000000a001'::uuid,
    '0a100000-0000-4000-8000-000000000001'::uuid,
    '0a200000-0000-4000-8000-000000000001'::uuid,
    'analyze_saved_item'::text
  )$$,
  'analysis registration preserves exact owner, source, and saved item'
);
select extensions.results_eq(
  $$select status,created from public.register_gateway_learning_artifact_job(
    '0a000000-0000-4000-8000-00000000a001',
    '0a100000-0000-4000-8000-000000000001','analyze_saved_item',repeat('a',64),
    '{"savedItemId":"0a200000-0000-4000-8000-000000000001","evidence":"replacement"}',
    '0a400000-0000-4000-8000-000000000001',1,
    (select config_fingerprint from public.user_model_gateway_configs
      where id='0a400000-0000-4000-8000-000000000001'),
    '2026-08-20 10:01:01+00')$$,
  $$values ('pending'::text,false)$$,
  'analysis registration replay is idempotent'
);
select extensions.results_eq(
  $$select input->>'evidence' from public.knowledge_job_internal as internal
    join analysis_jobs as a on a.knowledge_job_id=internal.knowledge_job_id
    where a.label='complete'$$,
  $$values ('first'::text)$$,
  'analysis replay preserves first private input'
);
select extensions.throws_ok(
  $$select * from public.register_gateway_learning_artifact_job(
    '0a000000-0000-4000-8000-00000000a001',
    '0a100000-0000-4000-8000-000000000001','analyze_saved_item',repeat('a',64),
    '{"savedItemId":"0a200000-0000-4000-8000-000000000003"}',
    '0a400000-0000-4000-8000-000000000001',1,
    (select config_fingerprint from public.user_model_gateway_configs
      where id='0a400000-0000-4000-8000-000000000001'),
    '2026-08-20 10:01:01+00')$$,
  '22023', null, 'analysis replay cannot retarget its dedupe key to another saved item'
);
select extensions.throws_ok(
  $$select * from public.register_gateway_learning_artifact_job(
    '0a000000-0000-4000-8000-00000000a001',
    '0a100000-0000-4000-8000-000000000001','analyze_saved_item',repeat('b',64),
    '{"savedItemId":"0a200000-0000-4000-8000-000000000002"}',
    '0a400000-0000-4000-8000-000000000001',1,
    (select config_fingerprint from public.user_model_gateway_configs
      where id='0a400000-0000-4000-8000-000000000001'),
    '2026-08-20 10:01:02+00')$$,
  '22023', null, 'analysis rejects a cross-owner saved item'
);

reset role;
update public.knowledge_jobs set
  status='leased', attempt_count=1, lease_expires_at='2026-08-20 10:10:00+00',
  updated_at='2026-08-20 10:02:00+00'
where id=(select knowledge_job_id from analysis_jobs where label='complete');
set local role service_role;
select extensions.is(
  public.complete_gateway_learning_artifact_job(
    :'user_a', (select knowledge_job_id from analysis_jobs where label='complete'),
    :'source_a', 'analyze_saved_item', '2026-08-20 10:10:00+00', 1,
    'saved_item_analysis', '{"candidates":[{"expression":"太离谱了"}]}'::jsonb,
    'analyze-saved-item-v1', 'provider/model-v1', repeat('a',64),
    :'config_a', 1,
    (select config_fingerprint from public.user_model_gateway_configs where id=:'config_a'),
    '2026-08-20 10:03:00+00'
  ) is not null,
  true,
  'gateway completion publishes exact saved-item analysis'
);
select extensions.results_eq(
  $$select artifact_type,video_source_id,saved_item_id,prompt_version,model
    from public.generated_artifacts where result_key=repeat('a',64)$$,
  $$values (
    'saved_item_analysis'::text,
    '0a100000-0000-4000-8000-000000000001'::uuid,
    '0a200000-0000-4000-8000-000000000001'::uuid,
    'analyze-saved-item-v1'::text,'provider/model-v1'::text
  )$$,
  'published analysis remains tied to its exact saved item and model metadata'
);
select extensions.results_eq(
  $$select job.status,internal.input,internal.result ? 'artifactId'
    from public.knowledge_jobs as job
    join public.knowledge_job_internal as internal on internal.knowledge_job_id=job.id and internal.user_id=job.user_id
    join analysis_jobs as a on a.knowledge_job_id=job.id where a.label='complete'$$,
  $$values ('succeeded'::text,'{}'::jsonb,true)$$,
  'analysis completion atomically succeeds and clears private input'
);

insert into analysis_jobs
select 'failure', result.*
from public.register_gateway_learning_artifact_job(
  :'user_a', :'source_a', 'analyze_saved_item', repeat('c',64),
  jsonb_build_object('savedItemId', :'save_a'), :'config_a', 1,
  (select config_fingerprint from public.user_model_gateway_configs where id=:'config_a'),
  '2026-08-20 10:04:00+00'
) as result;
reset role;
update public.knowledge_jobs set status='leased',attempt_count=1,
  lease_expires_at='2026-08-20 10:20:00+00',updated_at='2026-08-20 10:05:00+00'
where id=(select knowledge_job_id from analysis_jobs where label='failure');
set local role service_role;
select extensions.is(
  public.transition_learning_artifact_failure(
    :'user_a',(select knowledge_job_id from analysis_jobs where label='failure'),
    :'source_a','analyze_saved_item','2026-08-20 10:20:00+00',1,
    'retryable_failed','2026-08-20 10:06:00+00','PROVIDER_UNAVAILABLE',false,
    '2026-08-20 10:05:00+00'
  ), true, 'analysis uses the frozen exact retry transition'
);
select extensions.is(
  (select count(*)::integer from public.saved_items where id=:'save_a'),
  1,
  'analysis failure never deletes the raw save'
);

reset role;
insert into public.expression_senses (
  id,user_id,video_source_id,saved_item_id,expression_text,normalized_expression_text,
  english_meaning,english_explanation,tone,communicative_function,register
) values
  (:'sense_a',:'user_a',:'source_a',:'save_a','太离谱了','太离谱了','too absurd',
   'A strong reaction to something unreasonable.','informal','reacts to an unreasonable situation','spoken'),
  (:'sense_b',:'user_b',:'source_b',:'save_b','没想到','没想到','did not expect',
   'Expresses surprise at an outcome.','neutral','expresses unexpected surprise','spoken');
insert into public.user_expressions (id,user_id,expression_sense_id,mastery_state) values
  (:'expression_a',:'user_a',:'sense_a','tried'),
  (:'expression_b',:'user_b',:'sense_b','tried');

select extensions.lives_ok(
  format($sql$insert into public.practice_tasks (
    id,user_id,user_expression_id,kind,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,due_at,
    activation_prompt_version,activation_model,activation_gateway_config_id,
    activation_gateway_revision,activation_gateway_fingerprint
  ) values (
    %L::uuid,%L::uuid,%L::uuid,'use_it_now','en','zh-CN','太离谱了',
    '朋友告诉你一件很夸张的事。','Reply naturally in Mandarin.','Use the target expression.',null,
    'activate-v1','provider/model-v1',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid)
  )$sql$, :'practice_a', :'user_a', :'expression_a', :'config_a', :'config_a'),
  'practice activation persists a complete non-secret gateway metadata group'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_tasks (
    user_id,user_expression_id,kind,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,activation_prompt_version
  ) values (%L::uuid,%L::uuid,'use_it_now','en','zh-CN','太离谱了','请回应朋友。',
    'Reply naturally.','Use the target expression.','activate-v1')$sql$, :'user_a', :'expression_a'),
  '23514', null, 'partial activation metadata is rejected'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_tasks (
    user_id,user_expression_id,kind,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,
    activation_prompt_version,activation_model,activation_gateway_config_id,
    activation_gateway_revision,activation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,'use_it_now','en','zh-CN','太离谱了','请回应朋友。',
    'Reply naturally.','Use the target expression.','activate-v1','provider/model-v1',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a', :'expression_a', :'config_b', :'config_b'),
  '23503', null, 'practice metadata rejects another owner configuration'
);

select extensions.lives_ok(
  format($sql$insert into public.attempts (
    user_id,practice_task_id,user_expression_id,response_chinese,passed,
    accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
    contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at,
    evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,
    evaluation_gateway_revision,evaluation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,'这也太离谱了吧。',true,
    5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',true,'none',
    '2026-08-20 10:30:00+00','evaluate-v1','provider/model-v1',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a', :'practice_a', :'expression_a', :'config_a', :'config_a'),
  'attempt evaluation persists a complete non-secret gateway metadata group'
);
select extensions.throws_ok(
  format($sql$insert into public.attempts (
    user_id,practice_task_id,user_expression_id,response_chinese,passed,
    accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
    contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at,
    evaluation_prompt_version
  ) values (%L::uuid,%L::uuid,%L::uuid,'这也太离谱了吧。',true,
    5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',true,'none',
    '2026-08-20 10:31:00+00','evaluate-v1')$sql$,
    :'user_a', :'practice_a', :'expression_a'),
  '23514', null, 'partial evaluation metadata is rejected'
);

select extensions.ok(
  not has_column_privilege('anon','public.practice_tasks','activation_gateway_config_id','select')
    and has_column_privilege('authenticated','public.practice_tasks','activation_gateway_config_id','select')
    and not has_column_privilege('anon','public.attempts','evaluation_gateway_config_id','select')
    and has_column_privilege('authenticated','public.attempts','evaluation_gateway_config_id','select'),
  'new non-secret metadata inherits existing owner-readable table grants without anonymous access'
);

select * from extensions.finish();
rollback;
