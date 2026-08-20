begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set user_a '0c000000-0000-4000-8000-00000000a001'
\set user_b '0c000000-0000-4000-8000-00000000b002'
\set source_a '0c100000-0000-4000-8000-000000000001'
\set source_b '0c100000-0000-4000-8000-000000000002'
\set snapshot_a '0c200000-0000-4000-8000-000000000001'
\set segment_a '0c300000-0000-4000-8000-000000000001'
\set save_a '0c400000-0000-4000-8000-000000000001'
\set artifact_a '0c500000-0000-4000-8000-000000000001'
\set save_b '0c400000-0000-4000-8000-000000000002'
\set artifact_b '0c500000-0000-4000-8000-000000000002'
\set artifact_bad '0c500000-0000-4000-8000-000000000003'
\set origin_a '0c600000-0000-4000-8000-000000000001'
\set config_a '0c700000-0000-4000-8000-000000000001'
\set draft_valid '0c800000-0000-4000-8000-000000000001'
\set future_valid '0c900000-0000-4000-8000-000000000001'
\set attempt_valid '0ca00000-0000-4000-8000-000000000001'
\set draft_failed '0c800000-0000-4000-8000-000000000002'
\set future_failed '0c900000-0000-4000-8000-000000000002'
\set attempt_failed '0ca00000-0000-4000-8000-000000000002'
\set draft_revision '0c800000-0000-4000-8000-000000000003'
\set future_revision '0c900000-0000-4000-8000-000000000003'
\set attempt_revision '0ca00000-0000-4000-8000-000000000003'
\set draft_rollback '0c800000-0000-4000-8000-000000000004'
\set future_rollback '0c900000-0000-4000-8000-000000000004'
\set attempt_rollback '0ca00000-0000-4000-8000-000000000004'
\set draft_bad '0c800000-0000-4000-8000-000000000005'
\set future_bad '0c900000-0000-4000-8000-000000000005'
\set attempt_bad '0ca00000-0000-4000-8000-000000000005'

select extensions.has_table(
  'private',
  'practice_promotion_receipts',
  'private idempotency receipts exist for atomic practice promotion'
);

select extensions.has_function(
  'public',
  'promote_valid_practice_draft_attempt',
  array['uuid', 'uuid', 'text', 'timestamp with time zone', 'integer'],
  'service-only atomic practice promotion RPC exists'
);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000',:'user_a','authenticated','authenticated',
   'promotion-a@popcorn.test',crypt('password-a',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000',:'user_b','authenticated','authenticated',
   'promotion-b@popcorn.test',crypt('password-b',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.profiles (user_id) values (:'user_a'),(:'user_b');
insert into public.video_sources (
  id,user_id,youtube_video_id,canonical_url
) values
  (:'source_a',:'user_a','dQw4w9WgXcQ',
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  (:'source_b',:'user_b','M7lc1UVf-VE',
   'https://www.youtube.com/watch?v=M7lc1UVf-VE');
insert into public.video_snapshots (
  id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,
  description,transcript_language,transcript_hash,captured_at
) values (
  :'snapshot_a',:'user_a',:'source_a','Promotion fixture','Popcorn',
  'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',120,'Fixture',
  'zh-CN',repeat('a',64),'2026-08-20 11:00:00+00'
);
insert into public.transcript_segments (
  id,user_id,snapshot_id,stable_id,position,original_chinese,
  english_translation,start_seconds,end_seconds,language
) values (
  :'segment_a',:'user_a',:'snapshot_a','seg-a',0,'这也太离谱了吧。',
  'This is outrageous.',10,12,'zh-CN'
);
insert into public.saved_items (
  id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,
  status,captured_at,start_seconds,payload
) values (
  :'save_a',:'user_a',:'source_a',:'snapshot_a',
  '0ce00000-0000-4000-8000-000000000001','dQw4w9WgXcQ','subtitle_row',
  'ready','2026-08-20 11:00:00+00',10,
  '{"segmentId":"seg-a","originalChinese":"这也太离谱了吧。","startSeconds":10,"endSeconds":12,"contextBefore":[],"contextAfter":[]}'::jsonb
),(
  :'save_b',:'user_b',:'source_b',null,
  '0ce00000-0000-4000-8000-000000000002','M7lc1UVf-VE','subtitle_row',
  'ready','2026-08-20 11:00:00+00',20,
  '{"segmentId":"seg-b","originalChinese":"我完全没想到。","startSeconds":20,"endSeconds":22,"contextBefore":[],"contextAfter":[]}'::jsonb
);
insert into public.generated_artifacts (
  id,user_id,video_source_id,saved_item_id,artifact_type,native_language,
  target_language,content,prompt_version,model,result_key,created_at
) values
(
  :'artifact_a',:'user_a',:'source_a',:'save_a','saved_item_analysis','en','zh-CN',
  '{"candidates":[{"expression":"太离谱了","englishMeaning":"outrageous","englishExplanation":"Used when something feels unreasonable.","tone":"surprised","communicativeFunction":"reacting to an unreasonable event","register":"informal","evidenceText":"这也太离谱了吧。","segmentIds":["seg-a"],"startSeconds":10,"endSeconds":12,"confidence":0.96}]}'::jsonb,
  'analyze-saved-item-v1','fixture/model',repeat('b',64),
  '2026-08-20 11:01:00+00'
),(
  :'artifact_b',:'user_b',:'source_b',:'save_b','saved_item_analysis','en','zh-CN',
  '{"candidates":[{"expression":"没想到"}]}'::jsonb,
  'analyze-saved-item-v1','fixture/model',repeat('c',64),
  '2026-08-20 11:01:01+00'
),(
  :'artifact_bad',:'user_a',:'source_a',:'save_a','saved_item_analysis','en','zh-CN',
  '{"candidates":[{"expression":"太离谱了"}]}'::jsonb,
  'analyze-saved-item-v1','fixture/model',repeat('d',64),
  '2026-08-20 11:01:02+00'
);

insert into public.model_gateway_origins (
  id,slug,display_name,canonical_origin,base_path,adapter_kind,state
) values (
  :'origin_a','promotion-fixture','Promotion fixture gateway',
  'https://promotion-fixture.example.com','/v1','openai-compatible','active'
);

select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),
    'en','zh-CN','太离谱了','请自然回应。','Reply naturally.','Use it.','active')$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_b'),
  '23503',null,'a draft cannot smuggle another owner source, save, or artifact into promotion'
);

set local role service_role;
select * from public.create_user_model_gateway_config(
  :'user_a',:'config_a',:'origin_a','My gateway','provider/model-v1','secret-a',
  '2026-08-20 11:02:00+00'
);

insert into public.practice_drafts (
  id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
  future_user_expression_id,native_language,target_language,target_expression,
  prompt_chinese,instructions_english,goal_english,status,
  activation_prompt_version,activation_model,activation_gateway_config_id,
  activation_gateway_revision,activation_gateway_fingerprint,created_at,updated_at
) values
  (:'draft_valid',:'user_a',:'source_a',:'save_a',:'artifact_a',0,:'future_valid',
   'en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。','Reply naturally in Mandarin.',
   'Use the target expression.','active','activate-practice-v1','provider/model-v1',
   :'config_a',1,(select config_fingerprint from public.user_model_gateway_configs where id=:'config_a'),
   '2026-08-20 11:03:00+00','2026-08-20 11:03:00+00'),
  (:'draft_failed',:'user_a',:'source_a',:'save_a',:'artifact_a',0,:'future_failed',
   'en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。','Reply naturally in Mandarin.',
   'Use the target expression.','active',null,null,null,null,null,
   '2026-08-20 11:03:01+00','2026-08-20 11:03:01+00'),
  (:'draft_revision',:'user_a',:'source_a',:'save_a',:'artifact_a',0,:'future_revision',
   'en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。','Reply naturally in Mandarin.',
   'Use the target expression.','active',null,null,null,null,null,
   '2026-08-20 11:03:02+00','2026-08-20 11:03:02+00'),
  (:'draft_rollback',:'user_a',:'source_a',:'save_a',:'artifact_a',0,:'future_rollback',
   'en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。','Reply naturally in Mandarin.',
   'Use the target expression.','active',null,null,null,null,null,
   '2026-08-20 11:03:03+00','2026-08-20 11:03:03+00'),
  (:'draft_bad',:'user_a',:'source_a',:'save_a',:'artifact_bad',0,:'future_bad',
   'en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。','Reply naturally in Mandarin.',
   'Use the target expression.','active',null,null,null,null,null,
   '2026-08-20 11:03:04+00','2026-08-20 11:03:04+00');

insert into public.practice_draft_attempts (
  id,user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
  passed,accuracy_score,accuracy_feedback_english,naturalness_score,
  naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
  independent_use,assistance_level,submitted_at,evaluation_prompt_version,
  evaluation_model,evaluation_gateway_config_id,evaluation_gateway_revision,
  evaluation_gateway_fingerprint,created_at
) values
  (:'attempt_valid',:'user_a',:'draft_valid',:'future_valid',1,'这也太离谱了吧。',true,
   5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',true,'none',
   '2026-08-20 11:04:00+00','evaluate-practice-v1','provider/model-v1',:'config_a',1,
   (select config_fingerprint from public.user_model_gateway_configs where id=:'config_a'),
   '2026-08-20 11:04:01+00'),
  (:'attempt_failed',:'user_a',:'draft_failed',:'future_failed',1,'这也太离谱了吧。',false,
   2,'The expression is misplaced.',2,'The response sounds forced.',2,'It does not fit.',false,'hint',
   '2026-08-20 11:05:00+00',null,null,null,null,null,'2026-08-20 11:05:01+00'),
  (:'attempt_revision',:'user_a',:'draft_revision',:'future_revision',2,'这也太离谱了吧。',true,
   5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',true,'none',
   '2026-08-20 11:06:00+00',null,null,null,null,null,'2026-08-20 11:06:01+00'),
  (:'attempt_rollback',:'user_a',:'draft_rollback',:'future_rollback',1,'这也太离谱了吧。',true,
   5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',true,'none',
   '2026-08-20 11:07:00+00',null,null,null,null,null,'2026-08-20 11:07:01+00'),
  (:'attempt_bad',:'user_a',:'draft_bad',:'future_bad',1,'这也太离谱了吧。',true,
   5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',true,'none',
   '2026-08-20 11:08:00+00',null,null,null,null,null,'2026-08-20 11:08:01+00');

select extensions.results_eq(
  $$select
      (select count(*) from public.expression_senses),
      (select count(*) from public.expression_occurrences),
      (select count(*) from public.user_expressions),
      (select count(*) from public.practice_tasks),
      (select count(*) from public.attempts),
      (select count(*) from public.mastery_events),
      (select count(*) from public.review_tasks)$$,
  $$values (0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint)$$,
  'saves, drafts, failed output, and staged attempts alone create no canonical graph'
);

insert into public.expression_senses (
  user_id,video_source_id,saved_item_id,expression_text,normalized_expression_text,
  english_meaning,english_explanation,tone,communicative_function,register
) values (
  :'user_a',:'source_a',:'save_a','这太离谱了','太离谱了','outrageous',
  'An existing ambiguous sense that must not be silently merged.','surprised',
  'reacting to an unreasonable event','informal'
);

create temp table promotion_result on commit drop as
select * from public.promote_valid_practice_draft_attempt(
  :'user_a',:'attempt_valid','太离谱了','2026-08-21 11:04:00+00',1
);

select extensions.results_eq(
  $$select user_expression_id,practice_task_id,attempt_id,created from promotion_result$$,
  $$values (
    '0c900000-0000-4000-8000-000000000001'::uuid,
    '0c800000-0000-4000-8000-000000000001'::uuid,
    '0ca00000-0000-4000-8000-000000000001'::uuid,
    true
  )$$,
  'first promotion preserves all preallocated public identities'
);

select extensions.results_eq(
  $$select user_id,video_source_id,saved_item_id,expression_text,normalized_expression_text,english_meaning,
      english_explanation,tone,communicative_function,register
    from public.expression_senses
    where id=(select expression_sense_id from promotion_result)$$,
  $$values ('0c000000-0000-4000-8000-00000000a001'::uuid,
    '0c100000-0000-4000-8000-000000000001'::uuid,
    '0c400000-0000-4000-8000-000000000001'::uuid,
    '太离谱了'::text,'太离谱了'::text,'outrageous'::text,
    'Used when something feels unreasonable.'::text,'surprised'::text,
    'reacting to an unreasonable event'::text,'informal'::text)$$,
  'promotion copies the exact candidate meaning and usage snapshot'
);

select extensions.results_eq(
  $$select count(*) from public.expression_senses
    where user_id='0c000000-0000-4000-8000-00000000a001'
      and normalized_expression_text='太离谱了'$$,
  $$values (2::bigint)$$,
  'an existing normalized suggestion does not silently merge the new source sense'
);

select extensions.results_eq(
  $$select user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,segment_ids,start_seconds,
      end_seconds,confidence
    from public.expression_occurrences
    where id=(select occurrence_id from promotion_result)$$,
  $$select
    '0c000000-0000-4000-8000-00000000a001'::uuid,
    '0c100000-0000-4000-8000-000000000001'::uuid,
    expression_sense_id,
    '0c200000-0000-4000-8000-000000000001'::uuid,
    '0c400000-0000-4000-8000-000000000001'::uuid,
    '这也太离谱了吧。'::text,array['seg-a']::text[],10::numeric,12::numeric,0.96::numeric
    from promotion_result$$,
  'promotion grounds the occurrence in the exact owned snapshot and segment'
);

select extensions.results_eq(
  $$select user_id,expression_sense_id,mastery_state from public.user_expressions
    where id='0c900000-0000-4000-8000-000000000001'$$,
  $$select '0c000000-0000-4000-8000-00000000a001'::uuid,
      expression_sense_id,'tried'::text from promotion_result$$,
  'a valid original attempt starts at tried and no higher'
);

select extensions.results_eq(
  $$select user_id,user_expression_id,kind,target_expression,prompt_chinese,instructions_english,goal_english,
      due_at,activation_prompt_version,activation_model,activation_gateway_config_id,
      activation_gateway_revision,activation_gateway_fingerprint
    from public.practice_tasks
    where id='0c800000-0000-4000-8000-000000000001'$$,
  $$select '0c000000-0000-4000-8000-00000000a001'::uuid,
      '0c900000-0000-4000-8000-000000000001'::uuid,
      'use_it_now'::text,'太离谱了'::text,'朋友告诉你一件很夸张的事。'::text,
      'Reply naturally in Mandarin.'::text,'Use the target expression.'::text,
      null::timestamptz,'activate-practice-v1'::text,'provider/model-v1'::text,
      '0c700000-0000-4000-8000-000000000001'::uuid,1,
      config_fingerprint
    from public.user_model_gateway_configs
    where id='0c700000-0000-4000-8000-000000000001'::uuid$$,
  'canonical practice copies exact learner prompt and non-secret activation provenance'
);

select extensions.results_eq(
  $$select user_id,practice_task_id,user_expression_id,response_chinese,passed,
      accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
      contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at,created_at,
      evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,
      evaluation_gateway_revision,evaluation_gateway_fingerprint
    from public.attempts
    where id='0ca00000-0000-4000-8000-000000000001'$$,
  $$select '0c000000-0000-4000-8000-00000000a001'::uuid,
      '0c800000-0000-4000-8000-000000000001'::uuid,
      '0c900000-0000-4000-8000-000000000001'::uuid,
      '这也太离谱了吧。'::text,true,5,'Accurate use.'::text,
      5,'Natural response.'::text,5,'Fits the situation.'::text,true,'none'::text,
      '2026-08-20 11:04:00+00'::timestamptz,'2026-08-20 11:04:01+00'::timestamptz,
      'evaluate-practice-v1'::text,'provider/model-v1'::text,
      '0c700000-0000-4000-8000-000000000001'::uuid,1,config_fingerprint
    from public.user_model_gateway_configs
    where id='0c700000-0000-4000-8000-000000000001'::uuid$$,
  'canonical attempt copies scores, English feedback, timestamps, assistance, and non-secret evaluation provenance'
);

select extensions.results_eq(
  $$select revision,response_chinese,passed,accuracy_score,naturalness_score,
      contextual_fit_score,independent_use,assistance_level,submitted_at,created_at
    from public.practice_draft_attempts
    where id='0ca00000-0000-4000-8000-000000000001'$$,
  $$values (1,'这也太离谱了吧。'::text,true,5,5,5,true,'none'::text,
    '2026-08-20 11:04:00+00'::timestamptz,'2026-08-20 11:04:01+00'::timestamptz)$$,
  'promotion leaves the durable staged attempt unchanged for replay evidence'
);

select extensions.results_eq(
  $$select user_id,user_expression_id,attempt_id,prior_state,new_state,evidence_kind,occurred_at
    from public.mastery_events
    where id=(select mastery_event_id from promotion_result)$$,
  $$values ('0c000000-0000-4000-8000-00000000a001'::uuid,
    '0c900000-0000-4000-8000-000000000001'::uuid,
    '0ca00000-0000-4000-8000-000000000001'::uuid,
    null::text,'tried'::text,'valid_original_attempt'::text,
    '2026-08-20 11:04:00+00'::timestamptz)$$,
  'promotion records one tried mastery event from the valid original attempt'
);

select extensions.results_eq(
  $$select user_id,user_expression_id,mastery_state,status,due_at,interval_days,consecutive_successes
    from public.review_tasks
    where id=(select review_task_id from promotion_result)$$,
  $$values ('0c000000-0000-4000-8000-00000000a001'::uuid,
    '0c900000-0000-4000-8000-000000000001'::uuid,
    'tried'::text,'pending'::text,
    '2026-08-21 11:04:00+00'::timestamptz,1,0)$$,
  'promotion schedules the deterministic first due practice'
);

select extensions.results_eq(
  $$select status,updated_at from public.practice_drafts
    where id='0c800000-0000-4000-8000-000000000001'$$,
  $$values ('completed'::text,'2026-08-20 11:04:00+00'::timestamptz)$$,
  'the draft completes in the same promotion transaction'
);

create temp table promotion_replay on commit drop as
select * from public.promote_valid_practice_draft_attempt(
  :'user_a',:'attempt_valid','太离谱了','2026-08-21 11:04:00+00',1
);

select extensions.results_eq(
  $$select expression_sense_id,occurrence_id,user_expression_id,practice_task_id,
      attempt_id,mastery_event_id,review_task_id,created from promotion_replay$$,
  $$select expression_sense_id,occurrence_id,user_expression_id,practice_task_id,
      attempt_id,mastery_event_id,review_task_id,false from promotion_result$$,
  'an exact replay returns the same receipt identities with created false'
);

reset role;

select extensions.results_eq(
  $$select
      (select count(*) from public.expression_senses),
      (select count(*) from public.expression_occurrences),
      (select count(*) from public.user_expressions),
      (select count(*) from public.practice_tasks),
      (select count(*) from public.attempts),
      (select count(*) from public.mastery_events),
      (select count(*) from public.review_tasks),
      (select count(*) from private.practice_promotion_receipts)$$,
  $$values (2::bigint,1::bigint,1::bigint,1::bigint,1::bigint,1::bigint,1::bigint,1::bigint)$$,
  'exact replay creates no duplicate learning graph row'
);

select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱',%L::timestamptz,1)$sql$,
    :'user_a',:'attempt_valid','2026-08-21 11:04:00+00'),
  '22023',null,'replay rejects changed normalized expression input'
);
select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,1)$sql$,
    :'user_a',:'attempt_valid','2026-08-21 11:04:01+00'),
  '22023',null,'replay rejects changed due input'
);
select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,2)$sql$,
    :'user_a',:'attempt_valid','2026-08-21 11:04:00+00'),
  '22023',null,'promotion rejects a non-first interval'
);
select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,null)$sql$,
    :'user_a',:'attempt_valid','2026-08-21 11:04:00+00'),
  '22023',null,'promotion rejects a missing interval at its input boundary'
);
select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,1)$sql$,
    :'user_a',:'attempt_rollback','2026-08-21 11:07:01+00'),
  '22023',null,'an unpromoted attempt rejects a non-deterministic due date'
);
set local role service_role;
select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,1)$sql$,
    :'user_b',:'attempt_valid','2026-08-21 11:04:00+00'),
  '22023',null,'another user cannot promote or replay the staged attempt'
);
reset role;
select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,1)$sql$,
    :'user_a',:'attempt_failed','2026-08-21 11:05:00+00'),
  '22023',null,'a failed original attempt cannot create canonical state'
);
select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,1)$sql$,
    :'user_a',:'attempt_revision','2026-08-21 11:06:00+00'),
  '22023',null,'a passing revision cannot replace the valid original requirement'
);
select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,1)$sql$,
    :'user_a',:'attempt_bad','2026-08-21 11:08:00+00'),
  '22023',null,'malformed Provider candidate output cannot create canonical state'
);

create function private.reject_test_promotion_receipt()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.practice_draft_attempt_id = '0ca00000-0000-4000-8000-000000000004'::uuid then
    raise exception using errcode = 'P0001', message = 'forced final receipt failure';
  end if;
  return new;
end
$$;
create trigger reject_test_promotion_receipt
before insert on private.practice_promotion_receipts
for each row execute function private.reject_test_promotion_receipt();

select extensions.throws_ok(
  format($sql$select * from public.promote_valid_practice_draft_attempt(
    %L::uuid,%L::uuid,'太离谱了',%L::timestamptz,1)$sql$,
    :'user_a',:'attempt_rollback','2026-08-21 11:07:00+00'),
  'P0001','forced final receipt failure',
  'a final receipt failure aborts the entire promotion statement'
);

select extensions.results_eq(
  $$select
      (select status from public.practice_drafts where id='0c800000-0000-4000-8000-000000000004'),
      (select count(*) from public.practice_draft_attempts where id='0ca00000-0000-4000-8000-000000000004'),
      (select count(*) from public.expression_senses),
      (select count(*) from public.expression_occurrences),
      (select count(*) from public.user_expressions),
      (select count(*) from public.practice_tasks),
      (select count(*) from public.attempts),
      (select count(*) from public.mastery_events),
      (select count(*) from public.review_tasks),
      (select count(*) from private.practice_promotion_receipts)$$,
  $$values ('active'::text,1::bigint,2::bigint,1::bigint,1::bigint,1::bigint,
    1::bigint,1::bigint,1::bigint,1::bigint)$$,
  'late failure preserves the staged attempt and rolls back every new canonical row and receipt'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);
select extensions.results_eq(
  $$select
      (select count(*) from public.expression_senses),
      (select count(*) from public.expression_occurrences),
      (select count(*) from public.user_expressions),
      (select count(*) from public.practice_tasks),
      (select count(*) from public.attempts),
      (select count(*) from public.mastery_events),
      (select count(*) from public.review_tasks)$$,
  $$values (2::bigint,1::bigint,1::bigint,1::bigint,1::bigint,1::bigint,1::bigint)$$,
  'the owner can read only its promoted canonical graph and sense suggestion fixture'
);
select set_config('request.jwt.claim.sub', :'user_b', true);
select extensions.results_eq(
  $$select
      (select count(*) from public.expression_senses),
      (select count(*) from public.expression_occurrences),
      (select count(*) from public.user_expressions),
      (select count(*) from public.practice_tasks),
      (select count(*) from public.attempts),
      (select count(*) from public.mastery_events),
      (select count(*) from public.review_tasks)$$,
  $$values (0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint)$$,
  'another user cannot read any row from the promoted canonical graph'
);
reset role;

select extensions.ok(
  has_function_privilege('service_role',
    'public.promote_valid_practice_draft_attempt(uuid,uuid,text,timestamptz,integer)',
    'execute'),
  'worker service role may execute the atomic promotion RPC'
);
select extensions.ok(
  not has_function_privilege('authenticated',
    'public.promote_valid_practice_draft_attempt(uuid,uuid,text,timestamptz,integer)',
    'execute'),
  'browser-authenticated users cannot execute the promotion RPC'
);
select extensions.ok(
  not has_function_privilege('anon',
    'public.promote_valid_practice_draft_attempt(uuid,uuid,text,timestamptz,integer)',
    'execute'),
  'anonymous callers cannot execute the promotion RPC'
);
select extensions.ok(
  not has_table_privilege('service_role','private.practice_promotion_receipts','select')
  and not has_table_privilege('service_role','private.practice_promotion_receipts','insert')
  and not has_table_privilege('service_role','private.practice_promotion_receipts','update')
  and not has_table_privilege('service_role','private.practice_promotion_receipts','delete'),
  'the worker cannot read or mutate private receipts outside the definer RPC'
);
select extensions.ok(
  not has_table_privilege('authenticated','private.practice_promotion_receipts','select')
  and not has_table_privilege('anon','private.practice_promotion_receipts','select'),
  'browser roles cannot read private promotion receipts'
);
select extensions.hasnt_column(
  'private','practice_promotion_receipts','api_key',
  'promotion receipts never store the user gateway API key'
);
select extensions.hasnt_column(
  'private','practice_promotion_receipts','gateway_origin',
  'promotion receipts never store a gateway destination'
);

select * from extensions.finish();
rollback;
