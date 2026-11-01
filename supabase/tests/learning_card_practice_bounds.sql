begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create temporary table bound_cases (
  case_number integer, owner_id uuid, source_id uuid, expression_id uuid,
  attempt_id uuid, sense_id uuid, occurrence_id uuid, task_id uuid,
  target_text text, evidence_text text, response_text text, submitted_at timestamptz
);

-- Two isolated users, all fixtures and assertions are rolled back at the end.
-- The second target varies every character, preventing TOAST compression from
-- concealing the btree index-row failure this regression must catch.
do $$
declare
  case_number integer;
  owner_id uuid;
  source_id uuid;
  snapshot_id uuid;
  save_id uuid;
  artifact_id uuid;
  draft_id uuid;
  future_id uuid;
  staged_attempt_id uuid;
  target_text text;
  evidence_text text;
  response_text text;
  receipt record;
  submitted_at constant timestamptz := '2026-11-01T00:00:00Z';
begin
  for case_number in 1..2 loop
    owner_id := case when case_number = 1 then 'f0220000-0000-4000-8000-000000000001'::uuid else 'f0220000-0000-4000-8000-000000000002'::uuid end;
    source_id := gen_random_uuid(); snapshot_id := gen_random_uuid();
    save_id := gen_random_uuid(); artifact_id := gen_random_uuid();
    draft_id := gen_random_uuid(); future_id := gen_random_uuid(); staged_attempt_id := gen_random_uuid();
    if case_number = 1 then
      target_text := repeat('汉', 300);
      evidence_text := target_text || repeat('句', 2700);
      response_text := target_text || repeat('答', 5700);
    else
      select string_agg(chr(19968 + (ordinal * 7919) % 20000), '' order by ordinal)
        into target_text from generate_series(1,10000) as series(ordinal);
      evidence_text := target_text; response_text := target_text;
    end if;
    insert into auth.users(id, email, aud, role)
      values (owner_id, 'bounds-' || case_number || '@popcorn.test', 'authenticated', 'authenticated');
    insert into public.profiles(user_id) values (owner_id) on conflict do nothing;
    insert into public.video_sources(id,user_id,youtube_video_id,canonical_url)
      values (source_id,owner_id,'dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
      values (snapshot_id,owner_id,source_id,'Length fixture','Fixture','https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',10,'Fixture','zh-CN',repeat('a',64),submitted_at);
    insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language)
      values (owner_id,snapshot_id,'bound-segment',0,evidence_text,1,2,'zh-CN');
    insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
      values (save_id,owner_id,source_id,snapshot_id,gen_random_uuid(),'dQw4w9WgXcQ','subtitle_row','ready',submitted_at,1,
        jsonb_build_object('segmentId','bound-segment','originalChinese',evidence_text,'startSeconds',1,'endSeconds',2,'contextBefore','[]'::jsonb,'contextAfter','[]'::jsonb));
    insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key)
      values (artifact_id,owner_id,source_id,save_id,'saved_item_analysis','en','zh-CN',
        jsonb_build_object('candidates',jsonb_build_array(jsonb_build_object(
          'expression',target_text,'englishMeaning','A contextual meaning.','englishExplanation','Use this expression naturally.',
          'tone','Casual.','communicativeFunction','Describe','register','Casual chat',
          'evidenceText',evidence_text,'segmentIds',jsonb_build_array('bound-segment'),'startSeconds',1,'endSeconds',2,
          'meaningHere','A contextual meaning.','useItWhen','Describe an everyday situation.',
          'comparedWith','This form has a more expressive tone.','howItFits','Use the original form in the sentence.',
          'toneAndWho','Casual, with friends.','watchOut',null,'examples',null,
          'functionCategories',jsonb_build_array('describe'),'usageSettings',jsonb_build_array('casual_chat'),'suitability','expression'))),
        'analyze-saved-item-v3','fixture/bounds',repeat(md5(artifact_id::text),2));
    insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,created_at,updated_at)
      values (draft_id,owner_id,source_id,save_id,artifact_id,0,future_id,'en','zh-CN',target_text,'朋友请你描述一下。','Respond naturally.','Use the target expression.','active',submitted_at,submitted_at);
    insert into public.practice_draft_attempts(id,user_id,practice_draft_id,future_user_expression_id,revision,response_chinese,passed,accuracy_score,accuracy_feedback_english,naturalness_score,naturalness_feedback_english,contextual_fit_score,contextual_fit_feedback_english,independent_use,assistance_level,submitted_at,created_at)
      values (staged_attempt_id,owner_id,draft_id,future_id,1,response_text,true,5,'Accurate.',5,'Natural.',5,'Fits.',true,'none',submitted_at,submitted_at);
    select * into receipt from public.promote_valid_practice_draft_attempt(owner_id,staged_attempt_id,target_text,submitted_at + interval '1 day',1);
    insert into bound_cases values (case_number,owner_id,source_id,future_id,staged_attempt_id,receipt.expression_sense_id,receipt.occurrence_id,receipt.practice_task_id,target_text,evidence_text,response_text,submitted_at);
  end loop;
end
$$;

select extensions.is((select char_length(target_expression) from public.practice_tasks where id=(select task_id from bound_cases where case_number=1)),300,'300-character learning card activates and promotes to a canonical task');
select extensions.is((select char_length(evidence_text) from public.expression_occurrences where id=(select occurrence_id from bound_cases where case_number=1)),3000,'3000-character exact evidence survives promotion');
select extensions.is((select char_length(response_chinese) from public.attempts where id=(select attempt_id from bound_cases where case_number=1)),6000,'6000-character submitted response survives promotion');
select extensions.is((select char_length(normalized_expression_text) from public.expression_senses where id=(select sense_id from bound_cases where case_number=2)),10000,'uncompressible 10k normalized text survives the owner-scoped btree index');
select extensions.is((select char_length(target_expression) from public.practice_tasks where id=(select task_id from bound_cases where case_number=2)),10000,'10k target stays usable after promotion');
select extensions.is((select char_length(evidence_text) from public.expression_occurrences where id=(select occurrence_id from bound_cases where case_number=2)),10000,'10k evidence remains exact');
select extensions.is((select char_length(response_chinese) from public.attempts where id=(select attempt_id from bound_cases where case_number=2)),10000,'10k original response remains exact');
select extensions.is((select char_length(result.expression_text) from bound_cases c cross join lateral public.search_expressions(c.owner_id,'') result where c.case_number=2),10000,'Vault search returns an accepted long expression without truncating it');
select extensions.throws_ok(format('update public.expression_senses set expression_text=%L where id=%L',repeat('汉',10001),(select sense_id from bound_cases where case_number=2)), '23514', null, 'expressions longer than the accepted 10k bound are rejected');
select extensions.ok((select indexdef like '%md5(normalized_expression_text)%' from pg_indexes where schemaname='public' and indexname='expression_senses_normalized_text_idx'),'the normalized lookup index hashes its bounded btree key');
select extensions.lives_ok(format('select * from public.delete_video_source(%L,%L,%L,%L::timestamptz)',(select owner_id from bound_cases where case_number=2),(select source_id from bound_cases where case_number=2),'remove_source_keep_evidence','2026-11-02T00:00:00Z'),'a long practiced fixture retains canonical learning evidence when its source is deleted');
select extensions.ok((select not result.created and result.expression_sense_id=c.sense_id from bound_cases c cross join lateral public.promote_valid_practice_draft_attempt(c.owner_id,c.attempt_id,c.target_text,c.submitted_at+interval '1 day',1) result where c.case_number=2),'the public source-deletion wrapper replays a 10k normalized target with the same canonical identity');
select extensions.ok((select bool_and(o.confidence=1) from public.expression_occurrences o join bound_cases c on c.occurrence_id=o.id),'modern cards without confidence use a neutral internal occurrence compatibility value');
select * from extensions.finish();
rollback;
