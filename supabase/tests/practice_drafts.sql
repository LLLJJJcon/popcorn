begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

\set user_a '0b000000-0000-4000-8000-00000000a001'
\set user_b '0b000000-0000-4000-8000-00000000b002'
\set source_a '0b100000-0000-4000-8000-000000000001'
\set source_b '0b100000-0000-4000-8000-000000000002'
\set save_a '0b200000-0000-4000-8000-000000000001'
\set save_b '0b200000-0000-4000-8000-000000000002'
\set artifact_a '0b300000-0000-4000-8000-000000000001'
\set artifact_b '0b300000-0000-4000-8000-000000000002'
\set origin_id '0b400000-0000-4000-8000-000000000001'
\set config_a '0b500000-0000-4000-8000-000000000001'
\set config_b '0b500000-0000-4000-8000-000000000002'
\set draft_a '0b600000-0000-4000-8000-000000000001'
\set draft_live '0b600000-0000-4000-8000-000000000002'
\set future_a '0b700000-0000-4000-8000-000000000001'
\set future_live '0b700000-0000-4000-8000-000000000002'
\set attempt_a1 '0b800000-0000-4000-8000-000000000001'
\set attempt_a2 '0b800000-0000-4000-8000-000000000002'

select extensions.ok(
  to_regclass('public.practice_drafts') is not null,
  'practice drafts persist pre-Vault activation context'
);
select extensions.ok(
  to_regclass('public.practice_draft_attempts') is not null,
  'practice draft attempts persist pre-Vault revision history'
);

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('00000000-0000-0000-0000-000000000000',:'user_a','authenticated','authenticated',
   'practice-draft-a@popcorn.test',crypt('password-a',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000',:'user_b','authenticated','authenticated',
   'practice-draft-b@popcorn.test',crypt('password-b',gen_salt('bf')),now(),
   '{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.profiles (user_id) values (:'user_a'),(:'user_b');
insert into public.video_sources (id,user_id,youtube_video_id,canonical_url) values
  (:'source_a',:'user_a','dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  (:'source_b',:'user_b','M7lc1UVf-VE','https://www.youtube.com/watch?v=M7lc1UVf-VE');
insert into public.saved_items (
  id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
  captured_at,start_seconds,payload
) values
  (:'save_a',:'user_a',:'source_a','0be00000-0000-4000-8000-000000000001',
   'dQw4w9WgXcQ','subtitle_row','ready','2026-08-20 11:00:00+00',10,
   '{"segmentId":"seg-a","originalChinese":"这也太离谱了吧。","startSeconds":10,"endSeconds":12,"contextBefore":[],"contextAfter":[]}'::jsonb),
  (:'save_b',:'user_b',:'source_b','0be00000-0000-4000-8000-000000000002',
   'M7lc1UVf-VE','subtitle_row','ready','2026-08-20 11:00:00+00',20,
   '{"segmentId":"seg-b","originalChinese":"我完全没想到。","startSeconds":20,"endSeconds":22,"contextBefore":[],"contextAfter":[]}'::jsonb);
insert into public.generated_artifacts (
  id,user_id,video_source_id,saved_item_id,artifact_type,native_language,
  target_language,content,prompt_version,model,result_key,created_at
) values
  (:'artifact_a',:'user_a',:'source_a',:'save_a','saved_item_analysis','en','zh-CN',
   '{"candidates":[{"expression":"太离谱了"}]}'::jsonb,'analyze-v1','fixture',repeat('a',64),'2026-08-20 11:01:00+00'),
  (:'artifact_b',:'user_b',:'source_b',:'save_b','saved_item_analysis','en','zh-CN',
   '{"candidates":[{"expression":"没想到"}]}'::jsonb,'analyze-v1','fixture',repeat('b',64),'2026-08-20 11:01:00+00');

insert into public.model_gateway_origins (
  id,slug,display_name,canonical_origin,base_path,adapter_kind,state
) values (
  :'origin_id','practice-drafts','Practice draft fixture',
  'https://practice-drafts.example.com','/v1','openai-compatible','active'
);
set local role service_role;
select * from public.create_user_model_gateway_config(
  :'user_a',:'config_a',:'origin_id','Gateway A','provider/model-v1','secret-a',
  '2026-08-20 11:02:00+00'
);
select * from public.create_user_model_gateway_config(
  :'user_b',:'config_b',:'origin_id','Gateway B','provider/model-v1','secret-b',
  '2026-08-20 11:02:01+00'
);

insert into public.practice_drafts (
  id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
  future_user_expression_id,native_language,target_language,target_expression,
  prompt_chinese,instructions_english,goal_english,status,created_at,updated_at
) values (
  :'draft_a',:'user_a',:'source_a',:'save_a',:'artifact_a',0,:'future_a',
  'en','zh-CN','太离谱了','朋友告诉你一件很夸张的事。',
  'Reply naturally in Mandarin.','Use the target expression.','active',
  '2026-08-20 11:03:00+00','2026-08-20 11:03:00+00'
);

select extensions.results_eq(
  $$select future_user_expression_id,status from public.practice_drafts
    where id='0b600000-0000-4000-8000-000000000001'$$,
  $$values ('0b700000-0000-4000-8000-000000000001'::uuid,'active'::text)$$,
  'draft retains the future expression identity without creating Vault state'
);
select extensions.results_eq(
  $$select
      (select count(*) from public.user_expressions where user_id='0b000000-0000-4000-8000-00000000a001'),
      (select count(*) from public.practice_tasks where user_id='0b000000-0000-4000-8000-00000000a001'),
      (select count(*) from public.attempts where user_id='0b000000-0000-4000-8000-00000000a001'),
      (select count(*) from public.mastery_events where user_id='0b000000-0000-4000-8000-00000000a001'),
      (select count(*) from public.review_tasks where user_id='0b000000-0000-4000-8000-00000000a001')$$,
  $$values (0::bigint,0::bigint,0::bigint,0::bigint,0::bigint)$$,
  'draft creation produces no canonical Vault, practice, attempt, mastery, or review row'
);

select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),'en','zh-CN',
    '没想到','请自然回应。','Reply naturally.','Use the expression.','active')$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_a'),
  '23514',null,'draft target expression must exactly match its indexed candidate'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,1,gen_random_uuid(),'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active')$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_a'),
  '23514',null,'draft rejects a candidate index absent from artifact content'
);

select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,%L::uuid,'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active')$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_a',:'future_a'),
  '23505',null,'one owner cannot reuse a future expression identity across drafts'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,%L::uuid,'en','zh-CN',
    '没想到','请自然回应。','Reply naturally.','Use the expression.','active')$sql$,
    :'user_b',:'source_b',:'save_b',:'artifact_b',:'future_a'),
  '23505',null,'different owners cannot reuse a future expression identity'
);

select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active')$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_b'),
  '23503',null,'draft rejects another owner candidate artifact'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active')$sql$,
    :'user_a',:'source_b',:'save_a',:'artifact_a'),
  '23503',null,'draft rejects a cross-source identity tuple'
);

select extensions.lives_ok(
  format($sql$insert into public.practice_drafts (
    id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status,
    activation_prompt_version,activation_model,activation_gateway_config_id,
    activation_gateway_revision,activation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,%L::uuid,'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active',
    'activate-v1','provider/model-v1',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'draft_live',:'user_a',:'source_a',:'save_a',:'artifact_a',:'future_live',
    :'config_a',:'config_a'),
  'draft accepts exact non-secret activation provenance'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status,
    activation_prompt_version,activation_model,activation_gateway_config_id,
    activation_gateway_revision,activation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active',
    'activate-v1','provider/model-v1',%L::uuid,1,null)$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_a',:'config_a'),
  '23514',null,'draft rejects activation provenance missing only fingerprint'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status,
    activation_prompt_version,activation_model,activation_gateway_config_id,
    activation_gateway_revision,activation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active',
    'activate-v1','invented/model',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_a',:'config_a',:'config_a'),
  '23503',null,'draft activation model must match the exact owner gateway revision'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status,
    activation_prompt_version,activation_model,activation_gateway_config_id,
    activation_gateway_revision,activation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active',
    'activate-v1','provider/model-v1',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_a',:'config_b',:'config_b'),
  '23503',null,'draft activation provenance rejects another owner gateway'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status,
    activation_prompt_version,activation_model,activation_gateway_config_id,
    activation_gateway_revision,activation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active',
    'activate-v1','provider/model-v1',%L::uuid,2,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_a',:'config_a',:'config_a'),
  '23503',null,'draft activation provenance rejects the wrong gateway revision'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status,
    activation_prompt_version,activation_model,activation_gateway_config_id,
    activation_gateway_revision,activation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,%L::uuid,0,gen_random_uuid(),'en','zh-CN',
    '太离谱了','请自然回应。','Reply naturally.','Use the expression.','active',
    'activate-v1','provider/model-v1',%L::uuid,1,%L)$sql$,
    :'user_a',:'source_a',:'save_a',:'artifact_a',:'config_a',repeat('c',64)),
  '23503',null,'draft activation provenance rejects the wrong gateway fingerprint'
);

select extensions.throws_ok(
  format($sql$update public.practice_drafts set target_expression='没想到'
    where id=%L::uuid$sql$, :'draft_live'),
  '42501',null,'service role cannot mutate immutable draft content'
);
select extensions.throws_ok(
  format($sql$update public.practice_drafts set activation_gateway_fingerprint=%L
    where id=%L::uuid$sql$, repeat('c',64), :'draft_live'),
  '42501',null,'service role cannot replace exact activation provenance'
);
select extensions.throws_ok(
  format($sql$update public.practice_drafts set activation_gateway_fingerprint=null
    where id=%L::uuid$sql$, :'draft_live'),
  '42501',null,'service role cannot clear exact activation provenance'
);
select extensions.lives_ok(
  format($sql$update public.practice_drafts
    set status='completed',updated_at='2026-08-20 11:10:00+00'
    where id=%L::uuid$sql$, :'draft_live'),
  'service role may update only draft lifecycle state'
);
select extensions.results_eq(
  format($sql$select status,updated_at from public.practice_drafts
    where id=%L::uuid$sql$, :'draft_live'),
  $$values ('completed'::text,'2026-08-20 11:10:00+00'::timestamptz)$$,
  'draft lifecycle update persists without changing immutable activation data'
);

insert into public.practice_draft_attempts (
  id,user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
  passed,accuracy_score,accuracy_feedback_english,naturalness_score,
  naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
  independent_use,assistance_level,submitted_at
) values
  (:'attempt_a1',:'user_a',:'draft_a',:'future_a',1,'这也太离谱了吧。',true,
   5,'Accurate use.',5,'Natural response.',5,'Fits the situation.',true,'none',
   '2026-08-20 11:04:00+00'),
  (:'attempt_a2',:'user_a',:'draft_a',:'future_a',2,'这件事也太离谱了。',true,
   5,'Accurate revision.',5,'Natural revision.',5,'Fits the new wording.',true,'none',
   '2026-08-20 11:05:00+00');
select extensions.results_eq(
  $$select revision,response_chinese from public.practice_draft_attempts
    where practice_draft_id='0b600000-0000-4000-8000-000000000001'
    order by revision$$,
  $$values (1,'这也太离谱了吧。'::text),(2,'这件事也太离谱了。'::text)$$,
  'attempt revisions are append-only and ordered'
);
select extensions.lives_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,101,'这也太离谱了吧。',true,5,'The use of “太离谱了” is accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:05:30+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  'positive attempt revisions are not capped at one hundred'
);
select extensions.is(
  (select accuracy_feedback_english from public.practice_draft_attempts
    where practice_draft_id=:'draft_a' and revision=101),
  'The use of “太离谱了” is accurate.',
  'draft Practice persists English feedback containing quoted Chinese'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,0,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:05:31+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '23514',null,'attempt revision must remain positive'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,2,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:06:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '23505',null,'duplicate attempt revision is rejected'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,gen_random_uuid(),3,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:06:00+00')$sql$,
    :'user_a',:'draft_a'),
  '23503',null,'attempt cannot change the draft future expression identity'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at,
    evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,
    evaluation_gateway_revision,evaluation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,3,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:06:00+00',
    'evaluate-v1','provider/model-v1',%L::uuid,1,null)$sql$,
    :'user_a',:'draft_a',:'future_a',:'config_a'),
  '23514',null,'attempt rejects evaluation provenance missing only fingerprint'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at,
    evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,
    evaluation_gateway_revision,evaluation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,3,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:06:00+00',
    'evaluate-v1','invented/model',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a',:'draft_a',:'future_a',:'config_a',:'config_a'),
  '23503',null,'attempt evaluation model must match the exact owner gateway revision'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at,
    evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,
    evaluation_gateway_revision,evaluation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,4,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:06:00+00',
    'evaluate-v1','provider/model-v1',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a',:'draft_a',:'future_a',:'config_b',:'config_b'),
  '23503',null,'attempt evaluation provenance rejects another owner gateway'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at,
    evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,
    evaluation_gateway_revision,evaluation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,4,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:06:00+00',
    'evaluate-v1','provider/model-v1',%L::uuid,2,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a',:'draft_a',:'future_a',:'config_a',:'config_a'),
  '23503',null,'attempt evaluation provenance rejects the wrong gateway revision'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at,
    evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,
    evaluation_gateway_revision,evaluation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,4,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:06:00+00',
    'evaluate-v1','provider/model-v1',%L::uuid,1,%L)$sql$,
    :'user_a',:'draft_a',:'future_a',:'config_a',repeat('c',64)),
  '23503',null,'attempt evaluation provenance rejects the wrong gateway fingerprint'
);
select extensions.lives_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at,
    evaluation_prompt_version,evaluation_model,evaluation_gateway_config_id,
    evaluation_gateway_revision,evaluation_gateway_fingerprint
  ) values (%L::uuid,%L::uuid,%L::uuid,3,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:06:00+00',
    'evaluate-v1','provider/model-v1',%L::uuid,1,
    (select config_fingerprint from public.user_model_gateway_configs where id=%L::uuid))$sql$,
    :'user_a',:'draft_a',:'future_a',:'config_a',:'config_a'),
  'attempt accepts exact non-secret evaluation provenance'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,4,'Only English',false,1,'Try Chinese.',
    1,'Try Chinese.',1,'Try Chinese.',false,'none','2026-08-20 11:07:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '23514',null,'attempt rejects a non-Chinese learner response'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,4,'这也太离谱了吧。',false,0,'Try again.',
    5,'Natural.',5,'Fits.',false,'none','2026-08-20 11:07:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '23514',null,'attempt rejects an out-of-range evaluation score'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,4,'这也太离谱了吧。',false,1,'请再试一次。',
    5,'Natural.',5,'Fits.',false,'none','2026-08-20 11:07:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '23514',null,'attempt rejects non-English evaluation feedback'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,201,'这也太离谱了吧。',false,1,'   ',
    5,'Natural.',5,'Fits.',false,'none','2026-08-20 11:07:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '23514',null,'attempt rejects blank evaluation feedback'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,202,'这也太离谱了吧。',false,1,%L,
    5,'Natural.',5,'Fits.',false,'none','2026-08-20 11:07:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a','A' || repeat('x',500)),
  '23514',null,'attempt rejects evaluation feedback over five hundred characters'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,203,'这也太离谱了吧。',false,1,null,
    5,'Natural.',5,'Fits.',false,'none','2026-08-20 11:07:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '23502',null,'attempt rejects null evaluation feedback'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,4,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'hint','2026-08-20 11:07:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '23514',null,'assisted attempt cannot claim independent use'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);
select extensions.is(
  (select count(*)::integer from public.practice_drafts),2,
  'authenticated owner can select only the owner draft'
);
select extensions.is(
  (select count(*)::integer from public.practice_draft_attempts),4,
  'authenticated owner can select only the owner attempt revisions'
);
select extensions.throws_ok(
  format($sql$update public.practice_drafts set status='abandoned'
    where id=%L::uuid$sql$, :'draft_a'),
  '42501',null,'authenticated owners cannot update drafts directly'
);
select extensions.throws_ok(
  format($sql$delete from public.practice_drafts where id=%L::uuid$sql$, :'draft_a'),
  '42501',null,'authenticated owners cannot delete drafts directly'
);
select extensions.throws_ok(
  format($sql$insert into public.practice_draft_attempts (
    user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,
    passed,accuracy_score,accuracy_feedback_english,naturalness_score,
    naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,
    independent_use,assistance_level,submitted_at
  ) values (%L::uuid,%L::uuid,%L::uuid,5,'这也太离谱了吧。',true,5,'Accurate.',
    5,'Natural.',5,'Fits.',true,'none','2026-08-20 11:08:00+00')$sql$,
    :'user_a',:'draft_a',:'future_a'),
  '42501',null,'authenticated owners cannot insert draft attempts directly'
);
select set_config('request.jwt.claim.sub', :'user_b', true);
select extensions.is((select count(*)::integer from public.practice_drafts),0,
  'another user cannot read the draft');
select extensions.is((select count(*)::integer from public.practice_draft_attempts),0,
  'another user cannot read draft attempts');
select extensions.throws_ok(
  $$insert into public.practice_drafts (
    user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,
    future_user_expression_id,native_language,target_language,target_expression,
    prompt_chinese,instructions_english,goal_english,status
  ) values (
    '0b000000-0000-4000-8000-00000000b002','0b100000-0000-4000-8000-000000000002',
    '0b200000-0000-4000-8000-000000000002','0b300000-0000-4000-8000-000000000002',0,
    gen_random_uuid(),'en','zh-CN','没想到','请自然回应。','Reply naturally.','Use it.','active'
  )$$,
  '42501',null,'authenticated users cannot directly write drafts'
);

reset role;
select extensions.ok(
  not has_table_privilege('anon','public.practice_drafts','select')
    and not has_table_privilege('anon','public.practice_draft_attempts','select')
    and has_table_privilege('authenticated','public.practice_drafts','select')
    and has_table_privilege('authenticated','public.practice_draft_attempts','select')
    and not has_table_privilege('authenticated','public.practice_drafts','insert')
    and not has_table_privilege('authenticated','public.practice_draft_attempts','insert'),
  'draft grants expose owner reads only to authenticated clients'
);
select extensions.ok(
  has_column_privilege('service_role','public.practice_drafts','status','update')
    and has_column_privilege(
      'service_role','public.practice_drafts','updated_at','update'
    )
    and not exists (
      select 1
      from information_schema.columns c
      where c.table_schema='public'
        and c.table_name='practice_drafts'
        and c.column_name not in ('status','updated_at')
        and has_column_privilege(
          'service_role','public.practice_drafts',c.column_name,'update'
        )
    )
    and not has_table_privilege(
      'service_role','public.practice_drafts','delete'
    )
    and not has_table_privilege(
      'service_role','public.practice_draft_attempts','update'
    )
    and not has_table_privilege(
      'service_role','public.practice_draft_attempts','delete'
    ),
  'service role receives exact draft lifecycle and append-only attempt grants'
);

select * from extensions.finish();
rollback;
