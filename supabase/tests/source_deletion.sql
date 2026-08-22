begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set user_a '16000000-0000-4000-8000-00000000a001'
\set user_b '16000000-0000-4000-8000-00000000b002'
\set practiced_source '16100000-0000-4000-8000-000000000001'
\set unpracticed_source '16200000-0000-4000-8000-000000000002'
\set rollback_source '16300000-0000-4000-8000-000000000003'
\set other_source '16400000-0000-4000-8000-000000000004'
\set snapshot '16500000-0000-4000-8000-000000000001'
\set segment '16600000-0000-4000-8000-000000000001'
\set practiced_save '16700000-0000-4000-8000-000000000001'
\set unpracticed_save '16700000-0000-4000-8000-000000000002'
\set rollback_save '16700000-0000-4000-8000-000000000003'
\set artifact '16800000-0000-4000-8000-000000000001'
\set draft '16900000-0000-4000-8000-000000000001'
\set future_expression '16a00000-0000-4000-8000-000000000001'
\set staged_attempt '16b00000-0000-4000-8000-000000000001'
\set practiced_job '16c00000-0000-4000-8000-000000000001'
\set unpracticed_job '16c00000-0000-4000-8000-000000000002'

select extensions.has_function(
  'public', 'delete_video_source',
  array['uuid','uuid','text','timestamp with time zone'],
  'service-only source deletion RPC exists'
);
select extensions.has_column(
  'public','expression_senses','source_deleted_at',
  'retained expression semantics expose an explicit source tombstone'
);
select extensions.has_column(
  'private','practice_promotion_receipts','deleted_occurrence_id',
  'immutable promotion replay retains the deleted occurrence identity without a live locator'
);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000',:'user_a','authenticated','authenticated',
   'source-delete-a@popcorn.test',crypt('password-a',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000',:'user_b','authenticated','authenticated',
   'source-delete-b@popcorn.test',crypt('password-b',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.profiles (user_id) values (:'user_a'),(:'user_b');
insert into public.video_sources (id,user_id,youtube_video_id,canonical_url) values
  (:'practiced_source',:'user_a','dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  (:'unpracticed_source',:'user_a','M7lc1UVf-VE','https://www.youtube.com/watch?v=M7lc1UVf-VE'),
  (:'rollback_source',:'user_a','aqz-KE-bpKQ','https://www.youtube.com/watch?v=aqz-KE-bpKQ'),
  (:'other_source',:'user_b','9bZkp7q19f0','https://www.youtube.com/watch?v=9bZkp7q19f0');

insert into public.video_snapshots (
  id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,
  description,transcript_language,transcript_hash,captured_at
) values (
  :'snapshot',:'user_a',:'practiced_source','Secret source title','Secret channel',
  'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',120,'Secret source description',
  'zh-CN',repeat('1',64),'2026-08-22 09:00:00+00'
);
insert into public.transcript_segments (
  id,user_id,snapshot_id,stable_id,position,original_chinese,english_translation,
  start_seconds,end_seconds,language
) values (
  :'segment',:'user_a',:'snapshot','secret-segment',0,'这也太离谱了吧。',
  'This is outrageous.',10,12,'zh-CN'
);
insert into public.saved_items (
  id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,
  status,captured_at,start_seconds,payload
) values
  (:'practiced_save',:'user_a',:'practiced_source',:'snapshot',
   '16d00000-0000-4000-8000-000000000001','dQw4w9WgXcQ','subtitle_row','ready',
   '2026-08-22 09:00:00+00',10,
   '{"segmentId":"secret-segment","originalChinese":"这也太离谱了吧。","startSeconds":10,"endSeconds":12,"contextBefore":[],"contextAfter":[]}'::jsonb),
  (:'unpracticed_save',:'user_a',:'unpracticed_source',null,
   '16d00000-0000-4000-8000-000000000002','M7lc1UVf-VE','player_moment','saved',
   '2026-08-22 09:01:00+00',0,'{"capturedSecond":0}'::jsonb),
  (:'rollback_save',:'user_a',:'rollback_source',null,
   '16d00000-0000-4000-8000-000000000003','aqz-KE-bpKQ','player_moment','saved',
   '2026-08-22 09:02:00+00',0,'{"capturedSecond":0}'::jsonb);

insert into public.generated_artifacts (
  id,user_id,video_source_id,saved_item_id,artifact_type,native_language,
  target_language,content,prompt_version,model,result_key,created_at
) values (
  :'artifact',:'user_a',:'practiced_source',:'practiced_save','saved_item_analysis','en','zh-CN',
  '{"candidates":[{"expression":"太离谱了","englishMeaning":"outrageous","englishExplanation":"Used when something feels unreasonable.","tone":"surprised","communicativeFunction":"reacting to an unreasonable event","register":"informal","evidenceText":"这也太离谱了吧。","segmentIds":["secret-segment"],"startSeconds":10,"endSeconds":12,"confidence":0.96}]}'::jsonb,
  'analyze-saved-item-v1','fixture/model',repeat('2',64),'2026-08-22 09:03:00+00'
);

insert into public.practice_drafts (
  id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
  future_user_expression_id,native_language,target_language,target_expression,
  prompt_chinese,instructions_english,goal_english,status,created_at,updated_at
) values (
  :'draft',:'user_a',:'practiced_source',:'practiced_save',:'artifact',0,
  :'future_expression','en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。',
  'Reply naturally in Mandarin.','Use the target expression.','active',
  '2026-08-22 09:04:00+00','2026-08-22 09:04:00+00'
);
insert into public.practice_draft_attempts (
  id,user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
  passed,accuracy_score,accuracy_feedback_english,naturalness_score,
  naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
  independent_use,assistance_level,submitted_at,created_at
) values (
  :'staged_attempt',:'user_a',:'draft',:'future_expression',1,'这也太离谱了吧。',true,
  5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',true,'none',
  '2026-08-22 09:05:00+00','2026-08-22 09:05:01+00'
);

set local role service_role;
create temp table promoted_ids on commit drop as
select * from public.promote_valid_practice_draft_attempt(
  :'user_a',:'staged_attempt','太离谱了','2026-08-23 09:05:00+00',1
);
reset role;

insert into public.knowledge_jobs (
  id,user_id,video_source_id,saved_item_id,job_type,status,dedupe_key,
  attempt_count,next_attempt_at,lease_expires_at,last_error_code,created_at,updated_at
) values
  (:'practiced_job',:'user_a',:'practiced_source',:'practiced_save','resolve_snapshot',
   'leased',repeat('3',64),1,null,'2026-08-22 10:00:00+00',null,
   '2026-08-22 09:06:00+00','2026-08-22 09:06:00+00'),
  (:'unpracticed_job',:'user_a',:'unpracticed_source',:'unpracticed_save','resolve_snapshot',
   'retryable_failed',repeat('4',64),2,'2026-08-22 09:30:00+00',null,'PROVIDER_UNAVAILABLE',
   '2026-08-22 09:06:00+00','2026-08-22 09:06:00+00');
insert into public.knowledge_job_internal (
  knowledge_job_id,user_id,input,result,created_at,updated_at
) values
  (:'practiced_job',:'user_a','{"providerPayload":"secret practiced input"}'::jsonb,null,
   '2026-08-22 09:06:00+00','2026-08-22 09:06:00+00'),
  (:'unpracticed_job',:'user_a','{"providerPayload":"secret unpracticed input"}'::jsonb,null,
   '2026-08-22 09:06:00+00','2026-08-22 09:06:00+00');

set local role service_role;
select extensions.throws_ok(
  format($sql$select * from public.delete_video_source(%L::uuid,%L::uuid,'remove_unpracticed_source',%L::timestamptz)$sql$,
    :'user_a',:'practiced_source','2026-08-22 09:10:00+00'),
  '22023',null,'unpracticed mode refuses a source with promoted evidence'
);
select extensions.throws_ok(
  format($sql$select * from public.delete_video_source(%L::uuid,%L::uuid,'remove_source_keep_evidence',%L::timestamptz)$sql$,
    :'user_a',:'unpracticed_source','2026-08-22 09:10:00+00'),
  '22023',null,'keep-evidence mode refuses a source without promoted evidence'
);
select extensions.throws_ok(
  format($sql$select * from public.delete_video_source(%L::uuid,%L::uuid,'remove_unpracticed_source',%L::timestamptz)$sql$,
    :'user_b',:'practiced_source','2026-08-22 09:10:00+00'),
  '22023',null,'another owner cannot delete the source'
);
select extensions.throws_ok(
  format($sql$select * from public.delete_video_source(%L::uuid,%L::uuid,'remove_unpracticed_source',%L::timestamptz)$sql$,
    :'user_a','16f00000-0000-4000-8000-000000000099','2026-08-22 09:10:00+00'),
  '22023',null,'an unknown source is rejected generically'
);
select extensions.throws_ok(
  format($sql$select * from public.delete_video_source(%L::uuid,%L::uuid,null::text,%L::timestamptz)$sql$,
    :'user_b',:'other_source','2026-08-22 09:10:00+00'),
  '22023',null,'a null deletion mode is rejected before mutation'
);

select extensions.results_eq(
  format($sql$select deleted,retained_user_expression_count from public.delete_video_source(
    %L::uuid,%L::uuid,'remove_unpracticed_source',%L::timestamptz)$sql$,
    :'user_a',:'unpracticed_source','2026-08-22 09:11:00+00'),
  $$values (true,0::integer)$$,
  'unpracticed deletion reports no retained evidence'
);
reset role;

select extensions.results_eq(
  format($sql$select
    (select count(*) from public.video_sources where id=%L::uuid),
    (select count(*) from public.saved_items where video_source_id=%L::uuid),
    (select count(*) from public.knowledge_jobs where id=%L::uuid),
    (select count(*) from public.knowledge_job_internal where knowledge_job_id=%L::uuid)$sql$,
    :'unpracticed_source',:'unpracticed_source',:'unpracticed_job',:'unpracticed_job'),
  $$values (0::bigint,0::bigint,0::bigint,0::bigint)$$,
  'unpracticed deletion removes source, raw save, durable job, and private input'
);

set local role service_role;
create temp table deletion_result on commit drop as
select * from public.delete_video_source(
  :'user_a',:'practiced_source','remove_source_keep_evidence','2026-08-22 09:12:00+00'
);
reset role;

select extensions.results_eq(
  $$select deleted,retained_user_expression_count from deletion_result$$,
  $$values (true,1::integer)$$,
  'practiced deletion reports one retained canonical expression'
);
select extensions.results_eq(
  format($sql$select
    (select count(*) from public.video_sources where id=%L::uuid),
    (select count(*) from public.video_snapshots where video_source_id=%L::uuid),
    (select count(*) from public.transcript_segments where snapshot_id=%L::uuid),
    (select count(*) from public.saved_items where video_source_id=%L::uuid),
    (select count(*) from public.generated_artifacts where video_source_id=%L::uuid),
    (select count(*) from public.expression_occurrences where video_source_id=%L::uuid),
    (select count(*) from public.practice_drafts where video_source_id=%L::uuid),
    (select count(*) from public.practice_draft_attempts where id=%L::uuid),
    (select count(*) from public.knowledge_jobs where id=%L::uuid),
    (select count(*) from public.knowledge_job_internal where knowledge_job_id=%L::uuid)$sql$,
    :'practiced_source',:'practiced_source',:'snapshot',:'practiced_source',
    :'practiced_source',:'practiced_source',:'practiced_source',:'staged_attempt',
    :'practiced_job',:'practiced_job'),
  $$values (0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
    0::bigint,0::bigint,0::bigint,0::bigint)$$,
  'practiced deletion removes every source body, locator, draft, job, and private input'
);
select extensions.results_eq(
  $$select
    (select count(*) from public.expression_senses where id=(select expression_sense_id from promoted_ids)),
    (select count(*) from public.user_expressions where id=(select user_expression_id from promoted_ids)),
    (select count(*) from public.practice_tasks where user_expression_id=(select user_expression_id from promoted_ids)),
    (select count(*) from public.attempts where user_expression_id=(select user_expression_id from promoted_ids)),
    (select count(*) from public.mastery_events where user_expression_id=(select user_expression_id from promoted_ids)),
    (select count(*) from public.review_tasks where user_expression_id=(select user_expression_id from promoted_ids))$$,
  $$values (1::bigint,1::bigint,1::bigint,1::bigint,1::bigint,1::bigint)$$,
  'canonical semantic and learning evidence IDs remain intact'
);
select extensions.results_eq(
  $$select video_source_id,saved_item_id,source_deleted_at,expression_text,english_meaning
    from public.expression_senses where id=(select expression_sense_id from promoted_ids)$$,
  $$values (null::uuid,null::uuid,'2026-08-22 09:12:00+00'::timestamptz,
    '太离谱了'::text,'outrageous'::text)$$,
  'retained sense keeps learning semantics while scrubbing source locators'
);
select extensions.results_eq(
  $$select occurrence_id,deleted_occurrence_id,source_deleted_at
    from private.practice_promotion_receipts
    where practice_draft_attempt_id='16b00000-0000-4000-8000-000000000001'::uuid$$,
  $$select null::uuid,occurrence_id,'2026-08-22 09:12:00+00'::timestamptz from promoted_ids$$,
  'promotion receipt tombstones the locator while retaining its immutable identity'
);

set local role service_role;
create temp table replay_ids on commit drop as
select * from public.promote_valid_practice_draft_attempt(
  :'user_a',:'staged_attempt','太离谱了','2026-08-23 09:05:00+00',1
);
reset role;
select extensions.results_eq(
  $$select expression_sense_id,occurrence_id,user_expression_id,practice_task_id,
      attempt_id,mastery_event_id,review_task_id,created from replay_ids$$,
  $$select expression_sense_id,occurrence_id,user_expression_id,practice_task_id,
      attempt_id,mastery_event_id,review_task_id,false from promoted_ids$$,
  'promotion replay returns every original canonical and occurrence identity without recreating source rows'
);

set local role service_role;
select extensions.is(
  public.complete_resolve_snapshot_job(
    :'user_a',:'practiced_job','2026-08-22 10:00:00+00',1,:'snapshot','2026-08-22 09:13:00+00'
  ),false,
  'a worker holding the old lease cannot publish after source deletion'
);
reset role;

create function private.reject_test_source_delete()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if old.id='16300000-0000-4000-8000-000000000003'::uuid then
    raise exception using errcode='P0001',message='forced final source delete failure';
  end if;
  return old;
end
$$;
create trigger reject_test_source_delete
before delete on public.video_sources
for each row execute function private.reject_test_source_delete();

set local role service_role;
select extensions.throws_ok(
  format($sql$select * from public.delete_video_source(%L::uuid,%L::uuid,'remove_unpracticed_source',%L::timestamptz)$sql$,
    :'user_a',:'rollback_source','2026-08-22 09:14:00+00'),
  'P0001','forced final source delete failure',
  'a forced final source failure aborts the complete deletion statement'
);
reset role;
select extensions.results_eq(
  format($sql$select
    (select count(*) from public.video_sources where id=%L::uuid),
    (select count(*) from public.saved_items where id=%L::uuid)$sql$,
    :'rollback_source',:'rollback_save'),
  $$values (1::bigint,1::bigint)$$,
  'rollback restores the source graph removed before the forced final failure'
);

select extensions.ok(
  has_function_privilege('service_role',
    'public.delete_video_source(uuid,uuid,text,timestamptz)','execute'),
  'service role can execute source deletion'
);
select extensions.ok(
  not has_function_privilege('authenticated',
    'public.delete_video_source(uuid,uuid,text,timestamptz)','execute')
  and not has_function_privilege('anon',
    'public.delete_video_source(uuid,uuid,text,timestamptz)','execute'),
  'browser roles cannot execute source deletion'
);

select * from extensions.finish();
rollback;
