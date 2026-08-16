begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

-- Deterministic identities used for every ownership assertion.
\set user_a '00000000-0000-4000-8000-00000000a001'
\set user_b '00000000-0000-4000-8000-00000000b002'

select extensions.has_table('public', expected.table_name, expected.table_name || ' exists')
from (
  values
    ('profiles'),
    ('video_sources'),
    ('video_snapshots'),
    ('transcript_segments'),
    ('saved_items'),
    ('generated_artifacts'),
    ('knowledge_jobs'),
    ('expression_senses'),
    ('expression_occurrences'),
    ('user_expressions'),
    ('practice_tasks'),
    ('attempts'),
    ('mastery_events'),
    ('review_tasks')
) as expected(table_name);

-- The fixture is deliberately inserted as postgres. Client behavior is tested only
-- after changing to the authenticated role and setting the JWT subject.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', :'user_a', 'authenticated', 'authenticated',
   'owner-a@popcorn.test', crypt('password-a', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', :'user_b', 'authenticated', 'authenticated',
   'owner-b@popcorn.test', crypt('password-b', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into profiles (user_id) values (:'user_a'), (:'user_b') on conflict (user_id) do nothing;

insert into video_sources (id, user_id, youtube_video_id, canonical_url)
values
  ('10000000-0000-4000-8000-000000000001', :'user_a', 'dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  ('10000000-0000-4000-8000-000000000002', :'user_b', 'M7lc1UVf-VE', 'https://www.youtube.com/watch?v=M7lc1UVf-VE')
on conflict (id) do nothing;

insert into video_snapshots (
  id, user_id, video_source_id, title, channel, thumbnail_url, duration_seconds,
  description, transcript_language, transcript_hash, captured_at
)
values
  ('20000000-0000-4000-8000-000000000001', :'user_a', '10000000-0000-4000-8000-000000000001',
   '中文学习', '爆米老师', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 180,
   '简体中文字幕示例', 'zh-CN', repeat('a', 64), '2026-08-16 10:00:00+00'),
  ('20000000-0000-4000-8000-000000000002', :'user_b', '10000000-0000-4000-8000-000000000002',
   '另一个视频', '另一频道', 'https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg', 120,
   '用户 B 的字幕', 'zh-CN', repeat('b', 64), '2026-08-16 11:00:00+00')
on conflict (id) do nothing;

insert into transcript_segments (
  id, user_id, snapshot_id, stable_id, position, original_chinese,
  start_seconds, end_seconds, language
)
values
  ('30000000-0000-4000-8000-000000000001', :'user_a', '20000000-0000-4000-8000-000000000001',
   'seg-a-1', 0, '今天我们来学中文。', 0, 4, 'zh-CN'),
  ('3b000000-0000-4000-8000-000000000002', :'user_b', '20000000-0000-4000-8000-000000000002',
   'seg-b-1', 0, '这是另一条字幕。', 0, 4, 'zh-CN')
on conflict (id) do nothing;

insert into saved_items (
  id, user_id, video_source_id, snapshot_id, client_event_id, youtube_video_id,
  kind, status, captured_at, start_seconds, payload
)
values
  ('40000000-0000-4000-8000-000000000001', :'user_a', '10000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001',
   'dQw4w9WgXcQ', 'subtitle_selection', 'ready', '2026-08-16 10:01:00+00', 0,
   '{"originalChinese":"今天我们来学中文。","segmentIds":["seg-a-1"],"startSeconds":0,"endSeconds":4,"startOffset":0,"endOffset":10,"contextBefore":[],"contextAfter":[]}'::jsonb),
  ('40000000-0000-4000-8000-000000000002', :'user_b', '10000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002',
   'M7lc1UVf-VE', 'subtitle_row', 'ready', '2026-08-16 11:01:00+00', 0,
   '{"originalChinese":"这是另一条字幕。","segmentId":"seg-b-1","startSeconds":0,"endSeconds":4,"contextBefore":[],"contextAfter":[]}'::jsonb)
on conflict (id) do nothing;

insert into generated_artifacts (
  id, user_id, video_source_id, saved_item_id, artifact_type, native_language,
  target_language, content, prompt_version, model, result_key
)
values
  ('50000000-0000-4000-8000-000000000001', :'user_a', '10000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', 'overview', 'en', 'zh-CN', '{"summary":"中文概览"}',
   'overview-v1', 'test-model', repeat('c', 64)),
  ('50000000-0000-4000-8000-000000000002', :'user_b', '10000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000002', 'overview', 'en', 'zh-CN', '{"summary":"B"}',
   'overview-v1', 'test-model', repeat('d', 64))
on conflict (id) do nothing;

insert into knowledge_jobs (
  id, user_id, video_source_id, saved_item_id, job_type, status, dedupe_key
)
values
  ('60000000-0000-4000-8000-000000000001', :'user_a', '10000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', 'analyze_saved_item', 'pending', repeat('e', 64)),
  ('60000000-0000-4000-8000-000000000002', :'user_b', '10000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000002', 'analyze_saved_item', 'pending', repeat('f', 64))
on conflict (id) do nothing;

insert into expression_senses (
  id, user_id, video_source_id, saved_item_id, expression_text, normalized_expression_text,
  english_meaning, english_explanation, tone, communicative_function, register
)
values
  ('70000000-0000-4000-8000-000000000001', :'user_a', '10000000-0000-4000-8000-000000000001',
   '40000000-0000-4000-8000-000000000001', '太离谱了', '太离谱了', 'too absurd',
   'Used when something is far beyond reasonable expectations.', 'surprised', 'reacting to absurdity', 'informal'),
  ('70000000-0000-4000-8000-000000000002', :'user_b', '10000000-0000-4000-8000-000000000002',
   '40000000-0000-4000-8000-000000000002', '没想到', '没想到', 'did not expect',
   'Used to mark an unexpected outcome.', 'surprised', 'marking surprise', 'neutral')
on conflict (id) do nothing;

insert into expression_occurrences (
  id, user_id, video_source_id, expression_sense_id, snapshot_id, saved_item_id, evidence_text,
  segment_ids, start_seconds, end_seconds, confidence
)
values
  ('71000000-0000-4000-8000-000000000001', :'user_a', '10000000-0000-4000-8000-000000000001',
   '70000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
   '这也太离谱了吧。', array['seg-a-1'], 0, 4, 0.95),
  ('71000000-0000-4000-8000-000000000002', :'user_b', '10000000-0000-4000-8000-000000000002',
   '70000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002',
   '我完全没想到。', array['seg-b-1'], 0, 4, 0.9)
on conflict (id) do nothing;

insert into user_expressions (id, user_id, expression_sense_id, mastery_state)
values
  ('72000000-0000-4000-8000-000000000001', :'user_a', '70000000-0000-4000-8000-000000000001', 'tried'),
  ('72000000-0000-4000-8000-000000000002', :'user_b', '70000000-0000-4000-8000-000000000002', 'tried')
on conflict (id) do nothing;

insert into practice_tasks (
  id, user_id, user_expression_id, kind, native_language, target_language,
  target_expression, prompt_chinese, instructions_english, goal_english, due_at
)
values
  ('80000000-0000-4000-8000-000000000001', :'user_a', '72000000-0000-4000-8000-000000000001',
   'use_it_now', 'en', 'zh-CN', '太离谱了', '请用这个表达造句。', 'Write one original Chinese sentence.',
   'Use the expression in a fitting new context.', null),
  ('80000000-0000-4000-8000-000000000002', :'user_b', '72000000-0000-4000-8000-000000000002',
   'due_practice', 'en', 'zh-CN', '没想到', '请再练习一次。', 'Write one original Chinese sentence.',
   'Use the expression in a fitting new context.', '2026-08-17 10:00:00+00')
on conflict (id) do nothing;

insert into attempts (
  id, user_id, practice_task_id, user_expression_id, response_chinese, passed,
  accuracy_score, accuracy_feedback_english, naturalness_score, naturalness_feedback_english,
  contextual_fit_score, contextual_fit_feedback_english, independent_use, assistance_level, submitted_at
)
values
  ('90000000-0000-4000-8000-000000000001', :'user_a', '80000000-0000-4000-8000-000000000001',
   '72000000-0000-4000-8000-000000000001', '这个结果也太离谱了吧。', true,
   5, 'Accurate use.', 5, 'Natural phrasing.', 5, 'Fits the context.', true, 'none', '2026-08-16 10:05:00+00'),
  ('90000000-0000-4000-8000-000000000002', :'user_b', '80000000-0000-4000-8000-000000000002',
   '72000000-0000-4000-8000-000000000002', '我没想到他会来。', true,
   5, 'Accurate use.', 5, 'Natural phrasing.', 5, 'Fits the context.', true, 'none', '2026-08-16 11:05:00+00')
on conflict (id) do nothing;

insert into mastery_events (
  id, user_id, user_expression_id, attempt_id, prior_state, new_state, evidence_kind, occurred_at
)
values
  ('a0000000-0000-4000-8000-000000000001', :'user_a', '72000000-0000-4000-8000-000000000001',
   '90000000-0000-4000-8000-000000000001', null, 'tried', 'valid_original_attempt', '2026-08-16 10:05:00+00'),
  ('a0000000-0000-4000-8000-000000000002', :'user_b', '72000000-0000-4000-8000-000000000002',
   '90000000-0000-4000-8000-000000000002', null, 'tried', 'valid_original_attempt', '2026-08-16 11:05:00+00')
on conflict (id) do nothing;

insert into review_tasks (
  id, user_id, user_expression_id, mastery_state, status, due_at,
  interval_days, consecutive_successes
)
values
  ('b0000000-0000-4000-8000-000000000001', :'user_a', '72000000-0000-4000-8000-000000000001',
   'tried', 'pending', '2026-08-17 10:05:00+00', 1, 0),
  ('b0000000-0000-4000-8000-000000000002', :'user_b', '72000000-0000-4000-8000-000000000002',
   'tried', 'pending', '2026-08-17 11:05:00+00', 1, 0)
on conflict (id) do nothing;

-- Catalog-level invariants: direct ownership, timestamps, RLS, indexes, and
-- extensions are part of the contract rather than incidental implementation.
select extensions.is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname = any(array['profiles','video_sources','video_snapshots','transcript_segments',
       'saved_items','generated_artifacts','knowledge_jobs','expression_senses','expression_occurrences',
       'user_expressions','practice_tasks','attempts','mastery_events','review_tasks']) and c.relrowsecurity),
  14,
  'RLS is enabled on every public application table'
);

select extensions.is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public'
     and table_name = any(array['profiles','video_sources','video_snapshots','transcript_segments',
       'saved_items','generated_artifacts','knowledge_jobs','expression_senses','expression_occurrences',
       'user_expressions','practice_tasks','attempts','mastery_events','review_tasks'])
     and column_name = 'user_id' and is_nullable = 'NO'),
  14,
  'every public application table has a direct non-null user_id'
);

select extensions.is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'public'
     and table_name = any(array['profiles','video_sources','video_snapshots','transcript_segments',
       'saved_items','generated_artifacts','knowledge_jobs','expression_senses','expression_occurrences',
       'user_expressions','practice_tasks','attempts','mastery_events','review_tasks'])
     and column_name = 'created_at' and is_nullable = 'NO' and column_default like '%now()%'),
  14,
  'every public application table has a non-null created_at default'
);

select extensions.ok(
  exists(select 1 from pg_extension where extname = 'pg_trgm')
  and not exists(select 1 from pg_extension where extname = 'vector'),
  'pg_trgm is enabled and vector is not enabled'
);

select extensions.set_eq(
  $$select indexname from pg_indexes where schemaname = 'public' and indexname in (
      'video_sources_user_video_unique', 'saved_items_user_event_unique',
      'video_snapshots_source_hash_unique', 'transcript_segments_snapshot_stable_unique',
      'generated_artifacts_user_result_unique', 'knowledge_jobs_user_dedupe_unique',
      'saved_items_user_source_start_idx', 'knowledge_jobs_lease_scan_idx',
      'review_tasks_user_due_status_idx', 'expression_senses_normalized_text_idx',
      'expression_senses_expression_trgm_idx')$$,
  $$values
      ('expression_senses_expression_trgm_idx'), ('expression_senses_normalized_text_idx'),
      ('generated_artifacts_user_result_unique'), ('knowledge_jobs_lease_scan_idx'),
      ('knowledge_jobs_user_dedupe_unique'), ('review_tasks_user_due_status_idx'),
      ('saved_items_user_event_unique'), ('saved_items_user_source_start_idx'),
      ('transcript_segments_snapshot_stable_unique'), ('video_snapshots_source_hash_unique'),
      ('video_sources_user_video_unique')$$,
  'all required unique and retrieval indexes exist by exact name'
);

select extensions.ok(
  (select indexdef ilike '%using gin%expression_text%gin_trgm_ops%'
   from pg_indexes where schemaname = 'public' and indexname = 'expression_senses_expression_trgm_idx'),
  'Simplified Chinese expression text has a GIN trigram index'
);

select extensions.set_eq(
  $$select conname from pg_constraint where connamespace = 'public'::regnamespace
      and conname in ('mastery_state_check','saved_item_status_check','knowledge_job_status_check',
        'knowledge_job_type_check','review_task_status_check','hash_shape_check',
        'language_pair_check','knowledge_job_lifecycle_check')$$,
  $$values ('hash_shape_check'), ('knowledge_job_lifecycle_check'), ('knowledge_job_status_check'),
      ('knowledge_job_type_check'), ('language_pair_check'), ('mastery_state_check'),
      ('review_task_status_check'), ('saved_item_status_check')$$,
  'named status, hash, language, and lifecycle checks exist'
);

-- SQLSTATE-only exception assertions keep tests stable across PostgreSQL detail wording.
create or replace function pg_temp.throws_state(statement text, expected_state text, description text)
returns text language plpgsql as $$
begin
  execute statement;
  return extensions.fail(description || ' (statement unexpectedly succeeded)');
exception when others then
  return extensions.is(sqlstate, expected_state, description);
end
$$;

create or replace function pg_temp.rejects_state_clean(statement text, expected_state text, description text)
returns text language plpgsql as $$
begin
  begin
    execute statement;
    raise exception using errcode = 'P0001', message = 'statement unexpectedly succeeded';
  exception
    when sqlstate 'P0001' then
      return extensions.fail(description || ' (statement unexpectedly succeeded)');
    when others then
      return extensions.is(sqlstate, expected_state, description);
  end;
end
$$;

select pg_temp.rejects_state_clean(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4e000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000002',
      'dQw4w9WgXcQ','subtitle_selection','saved',now(),20,
      '{"originalChinese":"缺少必填字段","segmentIds":["seg-a-1"]}')$$,
  '23514', 'subtitle selection payload requires offsets, times, and context arrays');

select pg_temp.rejects_state_clean(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4e000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000004',
      'dQw4w9WgXcQ','key_quote','saved',now(),20,
      '{"selectedChinese":"字段名称错误","quoteSeconds":20,"segmentIds":["seg-a-1"]}')$$,
  '23514', 'key quote payload requires exactQuote and rejects another variant key');

select pg_temp.rejects_state_clean(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4e000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000006',
      'dQw4w9WgXcQ','player_moment','saved',now(),20,
      '{"capturedSecond":"20"}')$$,
  '23514', 'player moment payload requires a numeric capturedSecond');

select pg_temp.rejects_state_clean(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4e000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000008',
      'dQw4w9WgXcQ','key_quote','saved',now(),20,
      '{"exactQuote":"plain Latin text","quoteSeconds":20,"segmentIds":["seg-a-1"]}')$$,
  '23514', 'Chinese saved text requires at least one Han character');

select pg_temp.rejects_state_clean(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4e000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000010',
      'dQw4w9WgXcQ','ai_explanation','saved',now(),20,
      '{"selectedChinese":"太离谱了","englishExplanation":"这是中文解释","segmentIds":["seg-a-1"],"startSeconds":20,"endSeconds":21,"contextBefore":[],"contextAfter":[]}' )$$,
  '23514', 'English saved explanations require Basic Latin ASCII prose');

select pg_temp.rejects_state_clean(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4e000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000012',
      'dQw4w9WgXcQ','subtitle_row','saved',now(),20,
      '{"segmentId":"seg-a-1","originalChinese":"正确中文","englishTranslation":"12345","startSeconds":20,"endSeconds":21,"contextBefore":[],"contextAfter":[]}' )$$,
  '23514', 'English translations require at least one ASCII letter');

select pg_temp.rejects_state_clean(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4e000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','4e000000-0000-4000-8000-000000000014',
      'dQw4w9WgXcQ','subtitle_row','saved',now(),20,
      '{"segmentId":"seg-a-1","originalChinese":"正确中文","startSeconds":20,"endSeconds":21,"contextBefore":["English only"],"contextAfter":[]}' )$$,
  '23514', 'saved context entries require Chinese text');

create or replace function pg_temp.accepts_saved_variant(
  row_id uuid, event_id uuid, variant text, indexed_start numeric, variant_payload jsonb
)
returns text language plpgsql as $$
begin
  insert into saved_items (
    id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload
  ) values (
    row_id,'00000000-0000-4000-8000-00000000a001','10000000-0000-4000-8000-000000000001',
    event_id,'dQw4w9WgXcQ',variant,'saved',now(),indexed_start,variant_payload
  );
  delete from saved_items where id = row_id;
  return extensions.pass('valid ' || variant || ' payload is accepted');
exception when others then
  return extensions.fail('valid ' || variant || ' payload is accepted: ' || sqlerrm);
end
$$;

select pg_temp.accepts_saved_variant(row_id, event_id, variant, indexed_start, variant_payload)
from (
  values
    ('4d000000-0000-4000-8000-000000000001'::uuid,'4d000000-0000-4000-8000-000000000101'::uuid,
      'video',1::numeric,'{"canonicalUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"标题","channel":"频道","thumbnailUrl":"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg","durationSeconds":180,"description":"","currentTimeSeconds":1,"requestNativeSnapshot":true}'::jsonb),
    ('4d000000-0000-4000-8000-000000000002'::uuid,'4d000000-0000-4000-8000-000000000102'::uuid,
      'player_moment',2::numeric,'{"capturedSecond":2}'::jsonb),
    ('4d000000-0000-4000-8000-000000000003'::uuid,'4d000000-0000-4000-8000-000000000103'::uuid,
      'subtitle_row',3::numeric,'{"segmentId":"seg-a-1","originalChinese":"中文字幕","englishTranslation":"Chinese subtitle.","startSeconds":3,"endSeconds":4,"contextBefore":[],"contextAfter":[]}'::jsonb),
    ('4d000000-0000-4000-8000-000000000004'::uuid,'4d000000-0000-4000-8000-000000000104'::uuid,
      'subtitle_selection',4::numeric,'{"originalChinese":"中文选区","segmentIds":["seg-a-1"],"startSeconds":4,"endSeconds":5,"startOffset":0,"endOffset":4,"contextBefore":[],"contextAfter":[]}'::jsonb),
    ('4d000000-0000-4000-8000-000000000005'::uuid,'4d000000-0000-4000-8000-000000000105'::uuid,
      'key_quote',5::numeric,'{"exactQuote":"这是关键引用。","quoteSeconds":5,"segmentIds":["seg-a-1"]}'::jsonb),
    ('4d000000-0000-4000-8000-000000000006'::uuid,'4d000000-0000-4000-8000-000000000106'::uuid,
      'ai_explanation',6::numeric,'{"selectedChinese":"太离谱了","englishExplanation":"Used when something is absurd.","segmentIds":["seg-a-1"],"startSeconds":6,"endSeconds":7,"contextBefore":[],"contextAfter":[]}'::jsonb)
) as variants(row_id,event_id,variant,indexed_start,variant_payload);

select pg_temp.rejects_state_clean(
  $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
      segment_ids,start_seconds,end_seconds,confidence)
    values ('71e00000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
      '无效稳定标识','{" padded "}',0,1,0.5)$$,
  '23514', 'occurrence segment IDs reject surrounding whitespace');

select pg_temp.rejects_state_clean(
  $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
      segment_ids,start_seconds,end_seconds,confidence)
    values ('71e00000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
      '无效稳定标识',array[null]::text[],0,1,0.5)$$,
  '23514', 'occurrence segment IDs reject null elements');

select pg_temp.throws_state(
  $$insert into video_snapshots (id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,
      description,transcript_language,transcript_hash,captured_at)
    values ('2f000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001', '标题', '频道',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 1, '', 'zh-CN', repeat('A',64), now())$$,
  '23514', 'uppercase transcript hashes are rejected');

select pg_temp.throws_state(
  $$insert into generated_artifacts (id,user_id,video_source_id,artifact_type,native_language,target_language,
      content,prompt_version,model,result_key)
    values ('5f000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001', 'overview', 'en', 'zh-CN', '{}', 'v1', 'm', 'short')$$,
  '23514', 'result keys must be lowercase 64-hex hashes');

select pg_temp.throws_state(
  $$insert into knowledge_jobs (id,user_id,video_source_id,job_type,status,dedupe_key)
    values ('6f000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001', 'generate_overview', 'leased', repeat('1',64))$$,
  '23514', 'leased jobs require a lease expiry');

select pg_temp.throws_state(
  $$insert into practice_tasks (id,user_id,user_expression_id,kind,native_language,target_language,
      target_expression,prompt_chinese,instructions_english,goal_english,due_at)
    values ('8f000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a001',
      '72000000-0000-4000-8000-000000000001', 'use_it_now', 'en', 'zh-CN', '太离谱了',
      '请造句。', 'Write a sentence.', 'Use the phrase.', now())$$,
  '23514', 'use-it-now tasks cannot carry a due date');

select pg_temp.throws_state(
  $$insert into attempts (id,user_id,practice_task_id,user_expression_id,response_chinese,passed,
      accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
      contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at)
    values ('9f000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000a001',
      '80000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','我来练习。',true,
      5,'Good.',5,'Good.',5,'Good.',true,'hint',now())$$,
  '23514', 'independent attempts cannot use assistance');

select pg_temp.throws_state(
  $$insert into video_sources (id,user_id,youtube_video_id,canonical_url)
    values ('1f000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000a001',
      'bad','https://example.com/watch?v=bad')$$,
  '23514', 'only canonical YouTube identities are accepted');

select pg_temp.throws_state(
  $$insert into transcript_segments (id,user_id,snapshot_id,stable_id,position,original_chinese,
      start_seconds,end_seconds,language)
    values ('3f000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000a001',
      '20000000-0000-4000-8000-000000000001','bad-time',2,'时间错误',10,9,'zh-CN')$$,
  '23514', 'segment end time cannot precede start time');

select pg_temp.throws_state(
  $$insert into video_sources (id,user_id,youtube_video_id,canonical_url)
    values ('1f000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-00000000a001',
      'dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ')$$,
  '23505', 'video identity is unique per user');

select pg_temp.throws_state(
  $$insert into video_snapshots (id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,
      description,transcript_language,transcript_hash,captured_at)
    values ('2f000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','重复快照','频道',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',1,'','zh-CN',repeat('a',64),now())$$,
  '23505', 'snapshot transcript hash is unique per source');

select pg_temp.throws_state(
  $$insert into transcript_segments (id,user_id,snapshot_id,stable_id,position,original_chinese,
      start_seconds,end_seconds,language)
    values ('3f000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-00000000a001',
      '20000000-0000-4000-8000-000000000001','seg-a-1',9,'重复字幕',10,11,'zh-CN')$$,
  '23505', 'stable segment ID is unique per snapshot');

select pg_temp.throws_state(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
    values ('4f000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001',
      'dQw4w9WgXcQ','video','saved',now(),0,
      '{"canonicalUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"标题","channel":"频道","thumbnailUrl":"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg","durationSeconds":180,"description":"","currentTimeSeconds":0,"requestNativeSnapshot":true}')$$,
  '23505', 'client save event is unique per user');

select pg_temp.throws_state(
  $$insert into generated_artifacts (id,user_id,video_source_id,artifact_type,native_language,target_language,
      content,prompt_version,model,result_key)
    values ('5f000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','overview','en','zh-CN','{}','v1','m',repeat('c',64))$$,
  '23505', 'artifact result is unique per user and type');

select pg_temp.throws_state(
  $$insert into knowledge_jobs (id,user_id,video_source_id,job_type,status,dedupe_key)
    values ('6f000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','analyze_saved_item','pending',repeat('e',64))$$,
  '23505', 'job dedupe key is unique per user and type');

select pg_temp.throws_state(
  $$update profiles set target_language = 'fr' where user_id = '00000000-0000-4000-8000-00000000a001'$$,
  '23514', 'profile language pair is fixed to en and zh-CN');

select pg_temp.throws_state(
  $$update saved_items set status = 'seen' where id = '40000000-0000-4000-8000-000000000001'$$,
  '23514', 'saved item status is constrained to the frozen lifecycle');

select pg_temp.throws_state(
  $$update knowledge_jobs set status = 'running' where id = '60000000-0000-4000-8000-000000000001'$$,
  '23514', 'knowledge job status is constrained to the frozen lifecycle');

select pg_temp.throws_state(
  $$update user_expressions set mastery_state = 'seen' where id = '72000000-0000-4000-8000-000000000001'$$,
  '23514', 'mastery state accepts only tried, reused, or owned');

select pg_temp.throws_state(
  $$update review_tasks set status = 'skipped' where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '23514', 'review status accepts only pending, completed, or cancelled');

select pg_temp.throws_state(
  $$update saved_items set kind = 'quote' where id = '40000000-0000-4000-8000-000000000001'$$,
  '23514', 'saved item kind accepts exactly the frozen six kinds');
select pg_temp.throws_state(
  $$update generated_artifacts set artifact_type = 'summary' where id = '50000000-0000-4000-8000-000000000001'$$,
  '23514', 'artifact type accepts exactly the frozen values');
select pg_temp.throws_state(
  $$update knowledge_jobs set job_type = 'unknown_job' where id = '60000000-0000-4000-8000-000000000001'$$,
  '23514', 'job type accepts exactly the frozen five values');
select pg_temp.throws_state(
  $$update practice_tasks set kind = 'quiz' where id = '80000000-0000-4000-8000-000000000001'$$,
  '23514', 'practice kind accepts use-it-now or due-practice only');
select pg_temp.throws_state(
  $$update attempts set assistance_level = 'translation' where id = '90000000-0000-4000-8000-000000000001'$$,
  '23514', 'assistance level accepts exactly the frozen values');
select pg_temp.throws_state(
  $$update video_snapshots set transcript_language = 'zh-TW' where id = '20000000-0000-4000-8000-000000000001'$$,
  '23514', 'snapshot language is fixed to Simplified Chinese');
select pg_temp.throws_state(
  $$update transcript_segments set language = 'zh-TW' where id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', 'segment language is fixed to Simplified Chinese');
select pg_temp.throws_state(
  $$update generated_artifacts set native_language = 'fr' where id = '50000000-0000-4000-8000-000000000001'$$,
  '23514', 'artifact language pair is fixed to en and zh-CN');
select pg_temp.throws_state(
  $$update practice_tasks set target_language = 'zh-TW' where id = '80000000-0000-4000-8000-000000000001'$$,
  '23514', 'practice language pair is fixed to en and zh-CN');

-- Composite ownership foreign keys reject cross-owner parent references even for
-- privileged workers that bypass RLS.
select pg_temp.throws_state(
  $$insert into video_snapshots (id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,
      description,transcript_language,transcript_hash,captured_at)
    values ('2f000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000002','错误归属','频道',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',1,'','zh-CN',repeat('1',64),now())$$,
  '23503', 'snapshot cannot reference another owner source');

select pg_temp.throws_state(
  $$insert into transcript_segments (id,user_id,snapshot_id,stable_id,position,original_chinese,
      start_seconds,end_seconds,language)
    values ('3f000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000a001',
      '20000000-0000-4000-8000-000000000002','cross-owner',2,'错误归属',0,1,'zh-CN')$$,
  '23503', 'segment cannot reference another owner snapshot');

select pg_temp.throws_state(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
    values ('4f000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000002','4f000000-0000-4000-8000-000000000003',
      'dQw4w9WgXcQ','video','saved',now(),0,
      '{"canonicalUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"标题","channel":"频道","thumbnailUrl":"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg","durationSeconds":180,"description":"","currentTimeSeconds":0,"requestNativeSnapshot":true}')$$,
  '23503', 'save cannot reference another owner source');

select pg_temp.throws_state(
  $$insert into saved_items (id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4f000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',
      '4f000000-0000-4000-8000-000000000005','dQw4w9WgXcQ','subtitle_row','saved',now(),0,
      '{"segmentId":"seg-a-1","originalChinese":"错误归属","startSeconds":0,"endSeconds":1,"contextBefore":[],"contextAfter":[]}' )$$,
  '23503', 'save cannot reference another owner snapshot');

select pg_temp.throws_state(
  $$insert into generated_artifacts (id,user_id,video_source_id,saved_item_id,artifact_type,native_language,
      target_language,content,prompt_version,model,result_key)
    values ('5f000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',
      'overview','en','zh-CN','{}','v1','m',repeat('2',64))$$,
  '23503', 'artifact cannot reference another owner save');

select pg_temp.throws_state(
  $$insert into generated_artifacts (id,user_id,video_source_id,artifact_type,native_language,target_language,
      content,prompt_version,model,result_key)
    values ('5f000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000002','overview','en','zh-CN','{}','v1','m',repeat('a',64))$$,
  '23503', 'artifact cannot reference another owner source');

select pg_temp.throws_state(
  $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
      segment_ids,start_seconds,end_seconds,confidence)
    values ('71f00000-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
      '错误归属',array['seg-a-1'],0,1,0.5)$$,
  '23503', 'occurrence cannot reference another owner sense');

select pg_temp.throws_state(
  $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
      segment_ids,start_seconds,end_seconds,confidence)
    values ('71f00000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001',
      '错误归属',array['seg-a-1'],0,1,0.5)$$,
  '23514', 'occurrence cannot reference another owner snapshot or its segment evidence');

select pg_temp.throws_state(
  $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
      segment_ids,start_seconds,end_seconds,confidence)
    values ('71f00000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002','错误归属',array['seg-a-1'],0,1,0.5)$$,
  '23503', 'occurrence cannot reference another owner save');

select pg_temp.throws_state(
  $$insert into practice_tasks (id,user_id,user_expression_id,kind,native_language,target_language,
      target_expression,prompt_chinese,instructions_english,goal_english)
    values ('8f000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000a001',
      '72000000-0000-4000-8000-000000000002','use_it_now','en','zh-CN','太离谱了',
      '请造句。','Write a sentence.','Use the phrase.')$$,
  '23503', 'practice cannot reference another owner expression');

select pg_temp.throws_state(
  $$insert into knowledge_jobs (id,user_id,video_source_id,saved_item_id,job_type,status,dedupe_key)
    values ('6f000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',
      'analyze_saved_item','pending',repeat('7',64))$$,
  '23503', 'job cannot reference another owner save');

select pg_temp.throws_state(
  $$insert into knowledge_jobs (id,user_id,video_source_id,job_type,status,dedupe_key)
    values ('6f000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000002','generate_overview','pending',repeat('b',64))$$,
  '23503', 'job cannot reference another owner source');

select pg_temp.throws_state(
  $$insert into expression_senses (id,user_id,video_source_id,saved_item_id,expression_text,
      normalized_expression_text,english_meaning,english_explanation,tone,communicative_function,register)
    values ('7f000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002',
      '错误','错误','wrong','Wrong owner reference.','neutral','testing','neutral')$$,
  '23503', 'sense cannot reference another owner save');

select pg_temp.throws_state(
  $$insert into expression_senses (id,user_id,video_source_id,expression_text,normalized_expression_text,
      english_meaning,english_explanation,tone,communicative_function,register)
    values ('7f000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000002','错误','错误','wrong',
      'Wrong owner reference.','neutral','testing','neutral')$$,
  '23503', 'sense cannot reference another owner source');

select pg_temp.throws_state(
  $$insert into user_expressions (id,user_id,expression_sense_id,mastery_state)
    values ('7f000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-00000000a001',
      '70000000-0000-4000-8000-000000000002','tried')$$,
  '23503', 'user expression cannot reference another owner sense');

select pg_temp.throws_state(
  $$insert into attempts (id,user_id,practice_task_id,user_expression_id,response_chinese,passed,
      accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
      contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at)
    values ('9f000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-00000000a001',
      '80000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001','错误归属',false,
      1,'Wrong.',1,'Wrong.',1,'Wrong.',false,'hint',now())$$,
  '23503', 'attempt cannot reference another owner practice task');

select pg_temp.throws_state(
  $$insert into attempts (id,user_id,practice_task_id,user_expression_id,response_chinese,passed,
      accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
      contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at)
    values ('9f000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-00000000a001',
      '80000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000002','错误归属',false,
      1,'Wrong.',1,'Wrong.',1,'Wrong.',false,'hint',now())$$,
  '23503', 'attempt cannot reference another owner user expression');

select pg_temp.throws_state(
  $$insert into mastery_events (id,user_id,user_expression_id,attempt_id,prior_state,new_state,evidence_kind,occurred_at)
    values ('af000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-00000000a001',
      '72000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002',
      'tried','reused','successful_independent_transfer',now())$$,
  '23503', 'mastery event cannot reference another owner attempt');

select pg_temp.throws_state(
  $$insert into mastery_events (id,user_id,user_expression_id,prior_state,new_state,evidence_kind,occurred_at)
    values ('af000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-00000000a001',
      '72000000-0000-4000-8000-000000000002','tried','reused','successful_independent_transfer',now())$$,
  '23503', 'mastery event cannot reference another owner user expression');

select pg_temp.throws_state(
  $$insert into review_tasks (id,user_id,user_expression_id,mastery_state,status,due_at,interval_days,consecutive_successes)
    values ('bf000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-00000000a001',
      '72000000-0000-4000-8000-000000000002','tried','pending',now(),1,0)$$,
  '23503', 'review cannot reference another owner expression');

-- As user A, every owned table is readable. This catches blanket-deny policies.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);

select extensions.set_eq(
  $$select relation_name, owned_rows from (
      select 'profiles', count(*)::bigint from profiles where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'video_sources', count(*) from video_sources where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'video_snapshots', count(*) from video_snapshots where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'transcript_segments', count(*) from transcript_segments where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'saved_items', count(*) from saved_items where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'generated_artifacts', count(*) from generated_artifacts where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'knowledge_jobs', count(*) from knowledge_jobs where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'expression_senses', count(*) from expression_senses where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'expression_occurrences', count(*) from expression_occurrences where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'user_expressions', count(*) from user_expressions where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'practice_tasks', count(*) from practice_tasks where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'attempts', count(*) from attempts where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'mastery_events', count(*) from mastery_events where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'review_tasks', count(*) from review_tasks where user_id = '00000000-0000-4000-8000-00000000a001'
    ) as owned(relation_name, owned_rows) order by relation_name$$,
  $$values ('attempts',1::bigint),('expression_occurrences',1::bigint),('expression_senses',1::bigint),
      ('generated_artifacts',1::bigint),('knowledge_jobs',1::bigint),('mastery_events',1::bigint),
      ('practice_tasks',1::bigint),('profiles',1::bigint),('review_tasks',1::bigint),('saved_items',1::bigint),
      ('transcript_segments',3::bigint),('user_expressions',1::bigint),('video_snapshots',1::bigint),
      ('video_sources',1::bigint)$$,
  'user A can read every owned fixture'
);

select extensions.lives_ok(
  $$insert into video_sources (id,user_id,youtube_video_id,canonical_url)
    values ('1a000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-00000000a001',
      'aqz-KE-bpKQ','https://www.youtube.com/watch?v=aqz-KE-bpKQ')$$,
  'user A can insert an owned raw source');

select extensions.lives_ok(
  $$insert into video_snapshots (id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,
      description,transcript_language,transcript_hash,captured_at)
    values ('2a000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-00000000a001',
      '1a000000-0000-4000-8000-000000000010','新快照','频道',
      'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',20,'','zh-CN',repeat('8',64),now())$$,
  'user A can insert an owned raw snapshot');

select extensions.lives_ok(
  $$insert into transcript_segments (id,user_id,snapshot_id,stable_id,position,original_chinese,
      start_seconds,end_seconds,language)
    values ('3a000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-00000000a001',
      '2a000000-0000-4000-8000-000000000010','seg-positive',0,'新字幕',0,1,'zh-CN')$$,
  'user A can insert owned immutable transcript evidence');

select extensions.lives_ok(
  $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4a000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-00000000a001',
      '1a000000-0000-4000-8000-000000000010','4a000000-0000-4000-8000-000000000011',
      'aqz-KE-bpKQ','player_moment','saved',now(),1,'{"capturedSecond":1}')$$,
  'user A can append an owned raw save');

select extensions.results_eq(
  $$update profiles set updated_at = now() where user_id = '00000000-0000-4000-8000-00000000a001' returning user_id$$,
  $$values ('00000000-0000-4000-8000-00000000a001'::uuid)$$,
  'user A can update the owned profile');
select extensions.results_eq(
  $$delete from profiles where user_id = '00000000-0000-4000-8000-00000000a001' returning user_id$$,
  $$values ('00000000-0000-4000-8000-00000000a001'::uuid)$$,
  'user A can delete the owned profile');
select extensions.lives_ok(
  $$insert into profiles (user_id,created_at,updated_at)
    values ('00000000-0000-4000-8000-00000000a001','2026-08-16 09:00:00+00','2026-08-16 09:00:00+00')$$,
  'user A can restore the owned profile');

-- Raw source/evidence are append-only; mastery history is server-controlled.
select pg_temp.rejects_state_clean(
  $$update video_sources set canonical_url = canonical_url where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot update raw video source rows');
select pg_temp.rejects_state_clean(
  $$delete from video_sources where id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot delete raw video source rows');
select pg_temp.rejects_state_clean(
  $$update video_snapshots set title = title where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot update raw snapshots');
select pg_temp.rejects_state_clean(
  $$delete from video_snapshots where id = '20000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot delete raw snapshots');
select pg_temp.rejects_state_clean(
  $$update transcript_segments set original_chinese = original_chinese where id = '30000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot mutate immutable transcript evidence');
select pg_temp.rejects_state_clean(
  $$delete from transcript_segments where id = '30000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot delete immutable transcript evidence');
select pg_temp.rejects_state_clean(
  $$update saved_items set status = status where id = '40000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot update raw learner saves');
select pg_temp.rejects_state_clean(
  $$delete from saved_items where id = '40000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot delete raw learner saves');
select pg_temp.rejects_state_clean(
  $$update mastery_events set evidence_kind = evidence_kind where id = 'a0000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot update mastery history');
select pg_temp.rejects_state_clean(
  $$delete from mastery_events where id = 'a0000000-0000-4000-8000-000000000001'$$,
  '42501',
  'client cannot delete mastery history');

create or replace function pg_temp.assert_server_controlled_dml(table_name text, insert_statement text)
returns setof text language plpgsql as $$
begin
  return next pg_temp.rejects_state_clean(
    insert_statement, '42501', 'learner cannot insert server-controlled ' || table_name);
  return next pg_temp.rejects_state_clean(
    format('update public.%I set created_at = created_at', table_name),
    '42501', 'learner cannot update server-controlled ' || table_name);
  return next pg_temp.rejects_state_clean(
    format('delete from public.%I', table_name),
    '42501', 'learner cannot delete server-controlled ' || table_name);
end
$$;

select pg_temp.assert_server_controlled_dml(table_name, insert_statement)
from (
  values
    ('generated_artifacts', $$insert into generated_artifacts
      (id,user_id,video_source_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key)
      values ('5a000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '10000000-0000-4000-8000-000000000001','overview','en','zh-CN','{}','v','m',repeat('4',64))$$),
    ('knowledge_jobs', $$insert into knowledge_jobs
      (id,user_id,video_source_id,job_type,status,dedupe_key)
      values ('6a000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '10000000-0000-4000-8000-000000000001','generate_overview','pending',repeat('5',64))$$),
    ('expression_senses', $$insert into expression_senses
      (id,user_id,video_source_id,expression_text,normalized_expression_text,english_meaning,
       english_explanation,tone,communicative_function,register)
      values ('7a000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '10000000-0000-4000-8000-000000000001','很好','很好','very good','Used for praise.',
        'positive','giving praise','neutral')$$),
    ('expression_occurrences', $$insert into expression_occurrences
      (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
       segment_ids,start_seconds,end_seconds,confidence)
      values ('7b000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
        '这也太离谱了吧。',array['seg-a-1'],0,1,0.9)$$),
    ('user_expressions', $$insert into user_expressions (id,user_id,expression_sense_id,mastery_state)
      values ('7c000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '70000000-0000-4000-8000-000000000001','tried')$$),
    ('practice_tasks', $$insert into practice_tasks
      (id,user_id,user_expression_id,kind,native_language,target_language,target_expression,prompt_chinese,
       instructions_english,goal_english)
      values ('8a000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '72000000-0000-4000-8000-000000000001','use_it_now','en','zh-CN','太离谱了',
        '请造句。','Write a sentence.','Use the phrase.')$$),
    ('attempts', $$insert into attempts
      (id,user_id,practice_task_id,user_expression_id,response_chinese,passed,accuracy_score,
       accuracy_feedback_english,naturalness_score,naturalness_feedback_english,contextual_fit_score,
       contextual_fit_feedback_english,independent_use,assistance_level,submitted_at)
      values ('9a000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '80000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',
        '这太离谱了。',true,5,'Good.',5,'Good.',5,'Good.',true,'none',now())$$),
    ('mastery_events', $$insert into mastery_events
      (id,user_id,user_expression_id,prior_state,new_state,evidence_kind,occurred_at)
      values ('aa000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '72000000-0000-4000-8000-000000000001','tried','reused','server_evidence',now())$$),
    ('review_tasks', $$insert into review_tasks
      (id,user_id,user_expression_id,mastery_state,status,due_at,interval_days,consecutive_successes)
      values ('ba000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-00000000a001',
        '72000000-0000-4000-8000-000000000001','tried','pending',now(),1,0)$$)
) as server_tables(table_name, insert_statement);

select extensions.is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public'
     and tablename = any(array['generated_artifacts','knowledge_jobs','expression_senses',
       'expression_occurrences','user_expressions','practice_tasks','attempts','mastery_events','review_tasks'])
     and cmd <> 'SELECT'),
  0,
  'server-controlled tables expose no authenticated DML policies');

select extensions.is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'authenticated'
     and table_name = any(array['generated_artifacts','knowledge_jobs','expression_senses',
       'expression_occurrences','user_expressions','practice_tasks','attempts','mastery_events','review_tasks'])
     and privilege_type <> 'SELECT'),
  0,
  'server-controlled tables grant authenticated learners SELECT only');

select extensions.set_eq(
  $$select table_name || ':' || privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated'
      and table_name = any(array['profiles','video_sources','video_snapshots','transcript_segments','saved_items',
        'generated_artifacts','knowledge_jobs','expression_senses','expression_occurrences','user_expressions',
        'practice_tasks','attempts','mastery_events','review_tasks'])$$,
  $$values
    ('profiles:SELECT'),('profiles:INSERT'),('profiles:UPDATE'),('profiles:DELETE'),
    ('video_sources:SELECT'),('video_sources:INSERT'),
    ('video_snapshots:SELECT'),('video_snapshots:INSERT'),
    ('transcript_segments:SELECT'),('transcript_segments:INSERT'),
    ('saved_items:SELECT'),('saved_items:INSERT'),
    ('generated_artifacts:SELECT'),('knowledge_jobs:SELECT'),('expression_senses:SELECT'),
    ('expression_occurrences:SELECT'),('user_expressions:SELECT'),('practice_tasks:SELECT'),
    ('attempts:SELECT'),('mastery_events:SELECT'),('review_tasks:SELECT')$$,
  'authenticated grants exactly match profile, raw append, and server-read boundaries');

select extensions.is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'
     and table_name = any(array['profiles','video_sources','video_snapshots','transcript_segments','saved_items',
       'generated_artifacts','knowledge_jobs','expression_senses','expression_occurrences','user_expressions',
       'practice_tasks','attempts','mastery_events','review_tasks'])),
  0,
  'anonymous clients have no application-table grants');

select extensions.is(
  (select count(*)::integer from pg_policies
   where schemaname = 'public'
     and tablename = any(array['profiles','video_sources','video_snapshots','transcript_segments','saved_items',
       'generated_artifacts','knowledge_jobs','expression_senses','expression_occurrences','user_expressions',
       'practice_tasks','attempts','mastery_events','review_tasks'])),
  21,
  'policy catalog contains only four profile, eight raw, and nine server-select policies');

select extensions.ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.expression_occurrences'::regclass
      and tgname = 'expression_occurrence_segments_validate' and not tgisinternal
  ),
  'occurrence segment traceability trigger exists');

select extensions.ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=pg_catalog']
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'validate_expression_occurrence_segments'),
  'occurrence validator is security-invoker with a fixed pg_catalog search path');

select extensions.is(
  (select has_function_privilege('public', p.oid, 'execute')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'validate_expression_occurrence_segments'),
  false,
  'public execute is revoked from the occurrence trigger function');

reset role;

-- As user B, no user-A row can be selected, updated, or deleted. The
-- aggregate lists every ownership-bearing domain table explicitly.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_b', true);

select extensions.set_eq(
  $$select relation_name, visible_rows from (
      select 'profiles', count(*)::bigint from profiles where user_id = '00000000-0000-4000-8000-00000000a001'
      union all select 'video_sources', count(*) from video_sources where id = '10000000-0000-4000-8000-000000000001'
      union all select 'video_snapshots', count(*) from video_snapshots where id = '20000000-0000-4000-8000-000000000001'
      union all select 'transcript_segments', count(*) from transcript_segments where id = '30000000-0000-4000-8000-000000000001'
      union all select 'saved_items', count(*) from saved_items where id = '40000000-0000-4000-8000-000000000001'
      union all select 'generated_artifacts', count(*) from generated_artifacts where id = '50000000-0000-4000-8000-000000000001'
      union all select 'knowledge_jobs', count(*) from knowledge_jobs where id = '60000000-0000-4000-8000-000000000001'
      union all select 'expression_senses', count(*) from expression_senses where id = '70000000-0000-4000-8000-000000000001'
      union all select 'expression_occurrences', count(*) from expression_occurrences where id = '71000000-0000-4000-8000-000000000001'
      union all select 'user_expressions', count(*) from user_expressions where id = '72000000-0000-4000-8000-000000000001'
      union all select 'practice_tasks', count(*) from practice_tasks where id = '80000000-0000-4000-8000-000000000001'
      union all select 'attempts', count(*) from attempts where id = '90000000-0000-4000-8000-000000000001'
      union all select 'mastery_events', count(*) from mastery_events where id = 'a0000000-0000-4000-8000-000000000001'
      union all select 'review_tasks', count(*) from review_tasks where id = 'b0000000-0000-4000-8000-000000000001'
    ) as hidden(relation_name, visible_rows) order by relation_name$$,
  $$values ('attempts',0::bigint),('expression_occurrences',0::bigint),('expression_senses',0::bigint),
      ('generated_artifacts',0::bigint),('knowledge_jobs',0::bigint),('mastery_events',0::bigint),
      ('practice_tasks',0::bigint),('profiles',0::bigint),('review_tasks',0::bigint),('saved_items',0::bigint),
      ('transcript_segments',0::bigint),('user_expressions',0::bigint),('video_snapshots',0::bigint),
      ('video_sources',0::bigint)$$,
  'user B cannot select any user-A domain row');

create or replace function pg_temp.assert_cross_owner_mutations(table_name text, clone_statement text)
returns setof text language plpgsql as $$
declare affected bigint;
begin
  begin
    execute format('update public.%I set created_at = created_at where user_id = %L', table_name,
      '00000000-0000-4000-8000-00000000a001');
    get diagnostics affected = row_count;
    return next extensions.is(affected, 0::bigint, 'user B cannot update user A ' || table_name);
  exception when insufficient_privilege then
    return next extensions.pass('user B cannot update user A ' || table_name);
  end;

  begin
    execute format('delete from public.%I where user_id = %L', table_name,
      '00000000-0000-4000-8000-00000000a001');
    get diagnostics affected = row_count;
    return next extensions.is(affected, 0::bigint, 'user B cannot delete user A ' || table_name);
  exception when insufficient_privilege then
    return next extensions.pass('user B cannot delete user A ' || table_name);
  end;

  begin
    execute clone_statement;
    return next extensions.fail('user B cannot insert a user A ' || table_name || ' row');
  exception when others then
    return next extensions.is(sqlstate, '42501', 'user B cannot insert a user A ' || table_name || ' row');
  end;
end
$$;

select pg_temp.assert_cross_owner_mutations(table_name, clone_statement)
from (
  values
  ('profiles', $$insert into profiles (user_id) values ('00000000-0000-4000-8000-00000000a001')$$),
  ('video_sources', $$insert into video_sources (id,user_id,youtube_video_id,canonical_url)
      values ('1b000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
        '9bZkp7q19f0','https://www.youtube.com/watch?v=9bZkp7q19f0')$$),
  ('video_snapshots', $$insert into video_snapshots (id,user_id,video_source_id,title,channel,thumbnail_url,
      duration_seconds,description,transcript_language,transcript_hash,captured_at)
      values ('2b000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
        '10000000-0000-4000-8000-000000000001','新标题','频道',
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',1,'','zh-CN',repeat('4',64),now())$$),
  ('transcript_segments', $$insert into transcript_segments (id,user_id,snapshot_id,stable_id,position,
      original_chinese,start_seconds,end_seconds,language)
      values ('3b000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
        '20000000-0000-4000-8000-000000000001','seg-a-clone',9,'新字幕',10,11,'zh-CN')$$),
  ('saved_items', $$insert into saved_items (id,user_id,video_source_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload) values ('4b000000-0000-4000-8000-000000000011',
        '00000000-0000-4000-8000-00000000a001','10000000-0000-4000-8000-000000000001',
        '4b000000-0000-4000-8000-000000000012','dQw4w9WgXcQ','video','saved',now(),0,
        '{"canonicalUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","title":"标题","channel":"频道","thumbnailUrl":"https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg","durationSeconds":180,"description":"","currentTimeSeconds":0,"requestNativeSnapshot":true}')$$),
  ('generated_artifacts', $$insert into generated_artifacts (id,user_id,video_source_id,artifact_type,native_language,
      target_language,content,prompt_version,model,result_key) values
      ('5b000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
       '10000000-0000-4000-8000-000000000001','key_quotes','en','zh-CN','{}','v1','m',repeat('5',64))$$),
  ('knowledge_jobs', $$insert into knowledge_jobs (id,user_id,video_source_id,job_type,status,dedupe_key) values
      ('6b000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
       '10000000-0000-4000-8000-000000000001','generate_overview','pending',repeat('6',64))$$),
  ('expression_senses', $$insert into expression_senses (id,user_id,video_source_id,expression_text,
      normalized_expression_text,english_meaning,english_explanation,tone,communicative_function,register) values
      ('7b000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
       '10000000-0000-4000-8000-000000000001','真棒','真棒','great','Used to praise something.',
       'positive','giving praise','informal')$$),
  ('expression_occurrences', $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,
      snapshot_id,saved_item_id,evidence_text,segment_ids,start_seconds,end_seconds,confidence) values
      ('7c000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
       '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
       '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',
       '这个真棒。',array['seg-a-1'],0,1,0.8)$$),
  ('user_expressions', $$insert into user_expressions (id,user_id,expression_sense_id,mastery_state) values
      ('7d000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
       '70000000-0000-4000-8000-000000000001','tried')$$),
  ('practice_tasks', $$insert into practice_tasks (id,user_id,user_expression_id,kind,native_language,target_language,
      target_expression,prompt_chinese,instructions_english,goal_english) values
      ('8b000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
       '72000000-0000-4000-8000-000000000001','use_it_now','en','zh-CN','太离谱了',
       '请造句。','Write a sentence.','Use the phrase.')$$),
  ('attempts', $$insert into attempts (id,user_id,practice_task_id,user_expression_id,response_chinese,passed,
      accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,
      contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at) values
      ('9b000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
       '80000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','这太棒了。',true,
       5,'Good.',5,'Good.',5,'Good.',true,'none',now())$$),
  ('mastery_events', $$insert into mastery_events (id,user_id,user_expression_id,prior_state,new_state,evidence_kind,
      occurred_at) values ('ab000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-00000000a001',
       '72000000-0000-4000-8000-000000000001','tried','reused','successful_independent_transfer',now())$$),
  ('review_tasks', $$insert into review_tasks (id,user_id,user_expression_id,mastery_state,status,due_at,
      interval_days,consecutive_successes) values ('bb000000-0000-4000-8000-000000000011',
       '00000000-0000-4000-8000-00000000a001','72000000-0000-4000-8000-000000000001',
       'tried','pending',now(),1,0)$$)
) as cases(table_name, clone_statement);

reset role;

-- Review regressions: server-controlled rows are readable by their owner but
-- never client-writable, even when the forged row carries the caller's user_id.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'user_a', true);

select pg_temp.rejects_state_clean(
  $$insert into generated_artifacts (id,user_id,video_source_id,artifact_type,native_language,target_language,
      content,prompt_version,model,result_key)
    values ('5e000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','overview','en','zh-CN','{"forged":true}',
      'forged','forged',repeat('1',64))$$,
  '42501', 'learner cannot forge a generated artifact');
select pg_temp.rejects_state_clean(
  $$delete from knowledge_jobs where id = '60000000-0000-4000-8000-000000000001'$$,
  '42501', 'learner cannot delete a server job');
select pg_temp.rejects_state_clean(
  $$insert into mastery_events (id,user_id,user_expression_id,prior_state,new_state,evidence_kind,occurred_at)
    values ('ae000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-00000000a001',
      '72000000-0000-4000-8000-000000000001','tried','owned','forged',now())$$,
  '42501', 'learner cannot forge mastery history');
select pg_temp.rejects_state_clean(
  $$update attempts set passed = false where id = '90000000-0000-4000-8000-000000000001'$$,
  '42501', 'learner cannot rewrite a server evaluation');
select pg_temp.rejects_state_clean(
  $$delete from review_tasks where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', 'learner cannot delete a server schedule');

reset role;

-- Same-owner source linkage must still be relationally consistent.
select pg_temp.rejects_state_clean(
  $$insert into saved_items (id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,
      captured_at,start_seconds,payload)
    values ('4e000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000010',
      '4e000000-0000-4000-8000-000000000302','dQw4w9WgXcQ','player_moment','saved',now(),1,
      '{"capturedSecond":1}')$$,
  '23503', 'save snapshot must belong to the same source as the save');

insert into saved_items (
  id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload
) values (
  '4c000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-00000000a001',
  '1a000000-0000-4000-8000-000000000010','2a000000-0000-4000-8000-000000000010',
  '4c000000-0000-4000-8000-000000000302','aqz-KE-bpKQ','player_moment','saved',now(),1,
  '{"capturedSecond":1}'
);

select pg_temp.rejects_state_clean(
  $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
      segment_ids,start_seconds,end_seconds,confidence)
    values ('71e00000-0000-4000-8000-000000000301','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
      '2a000000-0000-4000-8000-000000000010',
      '4c000000-0000-4000-8000-000000000301','错误来源',array['seg-positive'],0,1,0.5)$$,
  '23503', 'occurrence sense, snapshot, and save must share one source');
select pg_temp.rejects_state_clean(
  $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
      segment_ids,start_seconds,end_seconds,confidence)
    values ('71e00000-0000-4000-8000-000000000302','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001','不存在的字幕',array['missing-segment'],0,1,0.5)$$,
  '23514', 'occurrence rejects nonexistent segment IDs');
select pg_temp.rejects_state_clean(
  $$insert into expression_occurrences (id,user_id,video_source_id,expression_sense_id,snapshot_id,saved_item_id,evidence_text,
      segment_ids,start_seconds,end_seconds,confidence)
    values ('71e00000-0000-4000-8000-000000000303','00000000-0000-4000-8000-00000000a001',
      '10000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001','重复字幕',array['seg-a-1','seg-a-1'],0,1,0.5)$$,
  '23514', 'occurrence rejects duplicate segment IDs');

-- Frozen language validators apply to every relational text family.
select pg_temp.rejects_state_clean(
  $$update transcript_segments set original_chinese = 'Latin only'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', 'transcript original requires Chinese text');
select pg_temp.rejects_state_clean(
  $$update transcript_segments set original_chinese = '⿰'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', 'CJK construction symbols do not count as Script Han');
select pg_temp.rejects_state_clean(
  $$update transcript_segments set english_translation = '中文翻译'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', 'transcript translation requires Basic Latin English');
select pg_temp.rejects_state_clean(
  $$update expression_senses set expression_text = 'Latin only'
    where id = '70000000-0000-4000-8000-000000000001'$$,
  '23514', 'expression text requires Chinese');
select pg_temp.rejects_state_clean(
  $$update expression_senses set english_meaning = '12345'
    where id = '70000000-0000-4000-8000-000000000001'$$,
  '23514', 'expression English fields require an ASCII letter');
select pg_temp.rejects_state_clean(
  $$update expression_occurrences set evidence_text = 'Latin evidence'
    where id = '71000000-0000-4000-8000-000000000001'$$,
  '23514', 'occurrence evidence requires Chinese');
select pg_temp.rejects_state_clean(
  $$update expression_occurrences set evidence_text = '㇀'
    where id = '71000000-0000-4000-8000-000000000001'$$,
  '23514', 'CJK stroke symbols do not count as Script Han');
select pg_temp.rejects_state_clean(
  $$update practice_tasks set prompt_chinese = 'Latin prompt'
    where id = '80000000-0000-4000-8000-000000000001'$$,
  '23514', 'practice prompt requires Chinese');
select pg_temp.rejects_state_clean(
  $$update practice_tasks set instructions_english = '中文说明'
    where id = '80000000-0000-4000-8000-000000000001'$$,
  '23514', 'practice instructions require Basic Latin English');
select pg_temp.rejects_state_clean(
  $$update attempts set response_chinese = 'Latin response'
    where id = '90000000-0000-4000-8000-000000000001'$$,
  '23514', 'attempt response requires Chinese');
select pg_temp.rejects_state_clean(
  $$update attempts set accuracy_feedback_english = '12345'
    where id = '90000000-0000-4000-8000-000000000001'$$,
  '23514', 'attempt feedback requires English letters');

select extensions.is(
  (select original_chinese from transcript_segments where id = '30000000-0000-4000-8000-000000000001'),
  '今天我们来学中文。',
  'exact seeded transcript text is preserved');
select extensions.is(
  (select evidence_text from expression_occurrences where id = '71000000-0000-4000-8000-000000000001'),
  '这也太离谱了吧。',
  'exact occurrence evidence is preserved');
select extensions.is(
  (select expression_text || '|' || normalized_expression_text || '|' || english_meaning
   from expression_senses where id = '70000000-0000-4000-8000-000000000001'),
  '太离谱了|太离谱了|too absurd',
  'exact expression source and English meaning are preserved');
select extensions.is(
  (select target_expression || '|' || prompt_chinese || '|' || instructions_english || '|' || goal_english
   from practice_tasks where id = '80000000-0000-4000-8000-000000000001'),
  '太离谱了|请用这个表达造句。|Write one original Chinese sentence.|Use the expression in a fitting new context.',
  'exact bilingual practice strings are preserved');
select extensions.is(
  (select response_chinese || '|' || accuracy_feedback_english || '|' || naturalness_feedback_english || '|' || contextual_fit_feedback_english
   from attempts where id = '90000000-0000-4000-8000-000000000001'),
  '这个结果也太离谱了吧。|Accurate use.|Natural phrasing.|Fits the context.',
  'exact attempt and dimensional feedback strings are preserved');

-- Seed values must be reproducible across resets and seed replays.
select extensions.is(
  (select encrypted_password from auth.users where id = :'user_a'),
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  'seeded password hash is a fixed non-secret literal');
select extensions.is(
  (select created_at from auth.users where id = :'user_a'),
  '2026-08-16 09:00:00+00'::timestamptz,
  'user A seed timestamp is exact');
select extensions.is(
  (select created_at from profiles where user_id = :'user_b'),
  '2026-08-16 09:01:00+00'::timestamptz,
  'user B profile timestamp is exact');
select extensions.is(
  (select created_at from video_sources where id = '10000000-0000-4000-8000-000000000001'),
  '2026-08-16 10:00:00+00'::timestamptz,
  'seeded source timestamp is exact');
select extensions.is(
  (select created_at from transcript_segments where id = '30000000-0000-4000-8000-000000000003'),
  '2026-08-16 10:00:03+00'::timestamptz,
  'seeded final segment timestamp is exact');

select extensions.results_eq(
  $$select id, encrypted_password::text, email_confirmed_at, created_at, updated_at
    from auth.users
    where id in ('00000000-0000-4000-8000-00000000a001','00000000-0000-4000-8000-00000000b002')
    order by id$$,
  $$values
    ('00000000-0000-4000-8000-00000000a001'::uuid,
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
     '2026-08-16 09:00:00+00'::timestamptz,'2026-08-16 09:00:00+00'::timestamptz,
     '2026-08-16 09:00:00+00'::timestamptz),
    ('00000000-0000-4000-8000-00000000b002'::uuid,
     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
     '2026-08-16 09:01:00+00'::timestamptz,'2026-08-16 09:01:00+00'::timestamptz,
     '2026-08-16 09:01:00+00'::timestamptz)$$,
  'both seeded auth identities have exact hashes and timestamps');

select extensions.results_eq(
  $$select user_id, created_at, updated_at from profiles
    where user_id in ('00000000-0000-4000-8000-00000000a001','00000000-0000-4000-8000-00000000b002')
    order by user_id$$,
  $$values
    ('00000000-0000-4000-8000-00000000a001'::uuid,'2026-08-16 09:00:00+00'::timestamptz,
     '2026-08-16 09:00:00+00'::timestamptz),
    ('00000000-0000-4000-8000-00000000b002'::uuid,'2026-08-16 09:01:00+00'::timestamptz,
     '2026-08-16 09:01:00+00'::timestamptz)$$,
  'both seeded profiles have exact timestamps');

select extensions.results_eq(
  $$select id, transcript_hash, captured_at, created_at from video_snapshots
    where id = '20000000-0000-4000-8000-000000000001'$$,
  $$values ('20000000-0000-4000-8000-000000000001'::uuid, repeat('a',64),
    '2026-08-16 10:00:00+00'::timestamptz,'2026-08-16 10:00:00+00'::timestamptz)$$,
  'seeded snapshot ID, hash, captured time, and creation time are exact');

select extensions.results_eq(
  $$select id, stable_id, original_chinese, created_at from transcript_segments
    where id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003') order by id$$,
  $$values
    ('30000000-0000-4000-8000-000000000001'::uuid,'seg-a-1','今天我们来学中文。',
      '2026-08-16 10:00:01+00'::timestamptz),
    ('30000000-0000-4000-8000-000000000002'::uuid,'seg-a-2','这个表达在口语里很常见。',
      '2026-08-16 10:00:02+00'::timestamptz),
    ('30000000-0000-4000-8000-000000000003'::uuid,'seg-a-3','请你试着用它造一个新句子。',
      '2026-08-16 10:00:03+00'::timestamptz)$$,
  'all seeded transcript IDs, raw strings, and timestamps are exact');

select extensions.finish();
rollback;
