begin;
select extensions.no_plan();
select extensions.is((select count(*)::integer from auth.users where id in('59900000-0000-4000-8000-000000000001','59900000-0000-4000-8000-000000000002')),0,'previous lifecycle test transactions leave neither fixture owner behind');

-- B4 lifecycle rollback fixtures. All UUID families are 599*, with only these
-- two owners; promotion receipts below are created by the real group2 RPC.
create function pg_temp.history_id(family text,n integer) returns uuid language sql immutable as $$
 select (family||'-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create temp table history_graph(name text primary key,owner_id uuid,source_id uuid,save_id uuid,artifact_id uuid,draft_id uuid,expression_id uuid,sense_id uuid,review_id uuid,attempt_id uuid,candidate_key text,card jsonb);
insert into auth.users(id,email,aud,role) values
 ('59900000-0000-4000-8000-000000000001','legacy-upgrade-a@popcorn.test','authenticated','authenticated'),
 ('59900000-0000-4000-8000-000000000002','legacy-upgrade-b@popcorn.test','authenticated','authenticated');
insert into public.profiles(user_id) values('59900000-0000-4000-8000-000000000001'),('59900000-0000-4000-8000-000000000002') on conflict do nothing;

create function pg_temp.history_answer(draft uuid,answer uuid,score integer,at_time timestamptz) returns jsonb language sql as $$
 select jsonb_build_object('id',answer,'user_id',d.user_id,'practice_draft_id',d.id,'future_user_expression_id',d.future_user_expression_id,
 'revision',1,'response_chinese','这里高得要命。','accuracy_score',4,'accuracy_feedback_english','Accurate.',
 'naturalness_score',score,'naturalness_feedback_english','Check wording.','contextual_fit_score',4,'contextual_fit_feedback_english','Fits.',
 'submitted_at',at_time,'created_at',at_time) from public.practice_drafts d where d.id=draft
$$;

do $$
declare n integer;r integer;owner uuid;source uuid;snapshot uuid;save uuid;artifact uuid;draft uuid;future uuid;answer uuid;candidate jsonb;receipt record;video text;prompt text;rounds integer;
begin
 for n in 1..3 loop
  owner:=case when n=3 then '59900000-0000-4000-8000-000000000002'::uuid else '59900000-0000-4000-8000-000000000001'::uuid end;
  source:=pg_temp.history_id('59910000',n);snapshot:=pg_temp.history_id('59920000',n);save:=pg_temp.history_id('59930000',n);artifact:=pg_temp.history_id('59940000',n);
  video:=(array['dQw4w9WgXcQ','M7lc1UVf-VE','9bZkp7q19f0'])[n];
  insert into public.video_sources(id,user_id,youtube_video_id,canonical_url) values(source,owner,video,'https://www.youtube.com/watch?v='||video);
  insert into public.video_snapshots(id,user_id,video_source_id,title,channel,thumbnail_url,duration_seconds,description,transcript_language,transcript_hash,captured_at)
   values(snapshot,owner,source,'History fixture','Fixture','https://i.ytimg.com/vi/'||video||'/hqdefault.jpg',20,'Synthetic fixture','zh-CN',repeat(n::text,64),'2026-10-01T00:00:00Z');
  insert into public.transcript_segments(user_id,snapshot_id,stable_id,position,original_chinese,start_seconds,end_seconds,language)
   values(owner,snapshot,'history-segment',0,'这里的价格高得要命。',1,2,'zh-CN');
  insert into public.saved_items(id,user_id,video_source_id,snapshot_id,client_event_id,youtube_video_id,kind,status,captured_at,start_seconds,payload)
   values(save,owner,source,snapshot,pg_temp.history_id('59990000',n),video,'subtitle_row','ready','2026-10-01T00:00:00Z',1,
    '{"segmentId":"history-segment","originalChinese":"这里的价格高得要命。","startSeconds":1,"endSeconds":2,"contextBefore":[],"contextAfter":[]}');
  candidate:=jsonb_build_object('expression','高得要命','englishMeaning','Outrageously high.','englishExplanation','Complain about excessive prices.',
   'tone','Casual.','communicativeFunction','Complain','register','Casual chat','highlightKey','history-stable-mark',
   'evidenceText','这里的价格高得要命。','segmentIds',jsonb_build_array('history-segment'),'startSeconds',1,'endSeconds',2,
   'meaningHere',case n when 1 then 'Canonical price complaint.' when 2 then 'Different candidate meaning.' else 'Other owner meaning.' end,
   'useItWhen','Complain about excessive prices.','comparedWith','很高 is neutral.','howItFits','After an adjective.','toneAndWho','Casual with friends.',
   'watchOut',null,'examples',null,'functionCategories',jsonb_build_array('complain'),'usageSettings',jsonb_build_array('casual_chat'),'suitability','expression');
  insert into public.generated_artifacts(id,user_id,video_source_id,saved_item_id,artifact_type,native_language,target_language,content,prompt_version,model,result_key,created_at)
   values(artifact,owner,source,save,'saved_item_analysis','en','zh-CN',jsonb_build_object('candidates',jsonb_build_array(candidate)),'analyze-saved-item-v3','fixture/history',repeat(md5(artifact::text),2),'2026-10-01T01:00:00Z');
  rounds:=case when n=1 then 4 else 1 end;
  for r in 1..rounds loop
   draft:=pg_temp.history_id('59950000',n*10+r);future:=pg_temp.history_id('59960000',n*10+r);answer:=pg_temp.history_id('59970000',n*10+r);
   prompt:=case when n=1 then (array['朋友问旧咖啡价格合不合理。','店员问旧雨伞价格是否能接受。','同事问旧停车费是不是太贵。','家人问新水杯的价格怎么样。'])[r] when n=2 then '另一候选的朋友问学费贵不贵。' else '另一用户的同事问房租怎么样。' end;
   insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,round_number,previous_draft_id,created_at,updated_at)
    values(draft,owner,source,save,artifact,0,future,'en','zh-CN','高得要命',prompt,'Complain naturally.','Use the expression.',case when n=1 and r=2 then 'removed' when n=1 and r=3 then 'superseded' else 'open' end,r,case when r>1 then pg_temp.history_id('59950000',n*10+r-1) end,'2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute','2026-10-01T02:00:00Z'::timestamptz+r*interval '1 minute');
   if n=1 and r=1 then
    perform public.record_practice_round_attempt(owner,pg_temp.history_answer(draft,answer,2,'2026-10-01T03:00:00Z'));
    update public.practice_drafts set status='superseded' where id=draft;
   elsif r=rounds then
    perform public.record_practice_round_attempt(owner,pg_temp.history_answer(draft,answer,4,'2026-10-01T04:00:00Z'));
   end if;
  end loop;
  select * into strict receipt from private.practice_promotion_receipts p where p.user_id=owner and p.practice_draft_id=draft;
  insert into history_graph values(case n when 1 then 'main' when 2 then 'same_word_candidate' else 'other_owner' end,owner,source,save,artifact,draft,future,receipt.expression_sense_id,receipt.review_task_id,answer,(select d.candidate_key from public.practice_drafts d where d.id=draft),candidate);
 end loop;
end $$;

create function pg_temp.lifecycle_generated(zh text,direction text default 'near') returns jsonb language sql as $$
 select jsonb_build_object('scenario',jsonb_build_object('situationZh',zh,'situationEn','A coworker describes an unexpectedly expensive service and asks what you think.','interlocutor','同事','taskEn','Complain about the excessive price.'),
 'targetFunction',jsonb_build_object('value','complain','label','Complain','rule','Express dissatisfaction.'),
 'targetSetting',jsonb_build_object('value','work_school','label','Work & school','description','Talking with colleagues.'),
 'transferType',direction,'promptVersion','transfer-scenario-v1','model','fixture/review-completion','pin',null)
$$;
create function pg_temp.lifecycle_identity(review uuid,request uuid) returns jsonb language sql as $$
 select jsonb_build_object('taskId',id,'scenarioVersion',scenario_version,'scenarioFingerprint',scenario_fingerprint,'requestId',request) from public.practice_tasks where review_task_id=review
$$;



-- Model-only/source-proof cases have no pre-existing modern card. The setup
-- intentionally reconstructs a legal old artifact before protected snapshots.
update public.expression_senses set meaning_here=null,use_it_when=null,compared_with=null,how_it_fits=null,tone_and_who=null,watch_out=null,examples=null,function_categories='{}',usage_settings='{}'
where id in(select sense_id from history_graph where name in('main','other_owner'));
update public.generated_artifacts a set content=jsonb_build_object('candidates',jsonb_build_array((a.content->'candidates'->0)-array['meaningHere','useItWhen','comparedWith','howItFits','toneAndWho','watchOut','examples','functionCategories','usageSettings','suitability','notExpressionReasonEn']||jsonb_build_object('confidence',0.9))),prompt_version='analyze-saved-item-v1'
where id=(select artifact_id from history_graph where name='main');

create function pg_temp.upgrade_request(graph_name text,n integer) returns jsonb language sql as $$
 with c as(select public.read_legacy_learning_card_upgrade_context(owner_id,sense_id,0,200) value from history_graph where name=graph_name)
 select jsonb_build_object('requestId',pg_temp.history_id('599f0000',n),'senseId',value->>'senseId','expectedBeforeHash',value->>'beforeHash','expectedEvidenceHash',case when value->'existingCard'<>'null'::jsonb then value->'existingCard'->>'evidenceHash' else value->'sources'->0->>'evidenceHash' end,
 'source',case when value->'existingCard'<>'null'::jsonb then jsonb_build_object('kind','existing_card','candidateKey',value->'existingCard'->>'candidateKey','artifactId',value->'existingCard'->>'artifactId','candidateIndex',value->'existingCard'->'candidateIndex') else jsonb_build_object('kind','source_occurrence','sourceId',value->'sources'->0->>'sourceId','snapshotId',value->'sources'->0->>'snapshotId','occurrenceId',value->'sources'->0->>'occurrenceId') end) from c
$$;
create function pg_temp.upgrade_card() returns jsonb language sql as $$ select private.legacy_upgrade_card(card) from history_graph where name='main' $$;
create function pg_temp.upgrade_result(card jsonb) returns jsonb language sql as $$ select jsonb_build_object('origin','model','card',card,'promptVersion','analyze-saved-item-v3','model','fixture/legacy-upgrade','pin',null) $$;


create temp table removed_upgrade_results(name text primary key,value jsonb);
insert into removed_upgrade_results values('input',pg_temp.upgrade_request('main',41));
insert into removed_upgrade_results select 'claim',public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,now()) from history_graph g cross join removed_upgrade_results i where g.name='main' and i.name='input';
select extensions.ok((select public.remove_vault_expression(owner_id,expression_id) from history_graph where name='main'),'main removal function removes the in-flight upgrade expression');
create temp table removed_sense_before as select to_jsonb(s) value from public.expression_senses s where id=(select sense_id from history_graph where name='main');
select extensions.is(public.read_legacy_learning_card_upgrade_context('59900000-0000-4000-8000-000000000001',(select sense_id from history_graph where name='main'),0,200),null::jsonb,'removed canonical metadata cannot enter an upgrade source projection');
select extensions.ok(not(public.page_legacy_learning_card_upgrade_contexts('59900000-0000-4000-8000-000000000001',null,200)->'senseIds' @> jsonb_build_array((select sense_id from history_graph where name='main'))),'removed sense is absent from every new upgrade plan page');
select extensions.throws_ok(format('select public.claim_legacy_learning_card_upgrade(%L,%L::jsonb,null,now())',(select owner_id from history_graph where name='main'),(select value||jsonb_build_object('requestId',pg_temp.history_id('599f0000',42)) from removed_upgrade_results where name='input')),'22023','owned sense not found','removed expression cannot obtain a new model claim');
select extensions.throws_ok(format('select public.publish_legacy_learning_card_upgrade(%L,%L::jsonb,%L,%L::jsonb,now())',(select owner_id from history_graph where name='main'),(select value from removed_upgrade_results where name='input'),(select value->>'token' from removed_upgrade_results where name='claim'),pg_temp.upgrade_result(pg_temp.upgrade_card())),'P0001','STALE_PLAN','removal during generation fences the previous publisher');
select extensions.is((select to_jsonb(s) from public.expression_senses s where id=(select sense_id from history_graph where name='main')),(select value from removed_sense_before),'failed publication leaves all metadata and original sense fields unchanged');
select extensions.ok((select removed_from_vault_at is not null from public.user_expressions where id=(select expression_id from history_graph where name='main')),'upgrade never restores the removed Vault entry');
select extensions.is((select status from public.review_tasks where id=(select review_id from history_graph where name='main')),'cancelled','cancelled due task is not reopened');

insert into removed_upgrade_results values('reuse_input',pg_temp.upgrade_request('other_owner',43));
insert into removed_upgrade_results select 'reuse_claim',public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,now()) from history_graph g cross join removed_upgrade_results i where g.name='other_owner' and i.name='reuse_input';
insert into removed_upgrade_results select 'reused',public.publish_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,jsonb_build_object('origin','existing_card','card',private.legacy_upgrade_card(g.card)),now()) from history_graph g cross join removed_upgrade_results i cross join removed_upgrade_results c where g.name='other_owner' and i.name='reuse_input' and c.name='reuse_claim';
select extensions.ok((select public.remove_vault_expression(owner_id,expression_id) from history_graph where name='other_owner'),'an already-upgraded expression can still be removed');
select extensions.is((select public.lookup_legacy_learning_card_upgrade(g.owner_id,i.value,now()) from history_graph g cross join removed_upgrade_results i where g.name='other_owner' and i.name='reuse_input'),(select value from removed_upgrade_results where name='reused'),'original completed UUID remains a read-only receipt after removal');
select extensions.is((select public.publish_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,jsonb_build_object('origin','existing_card','card',private.legacy_upgrade_card(g.card)),now()) from history_graph g cross join removed_upgrade_results i cross join removed_upgrade_results c where g.name='other_owner' and i.name='reuse_input' and c.name='reuse_claim'),(select value from removed_upgrade_results where name='reused'),'publication replay does not restore or rewrite a removed expression');
-- Exercise a real completed due question and revision history, not a fabricated
-- official attempt. Removal cancels its next review but keeps the old receipt.
insert into public.practice_tasks(id,user_id,user_expression_id,kind,native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,due_at,review_task_id)
select pg_temp.history_id('599e0000',44),owner_id,expression_id,'due_practice','en','zh-CN','高得要命','同事说一瓶普通矿泉水卖两百元，问你怎么看。','Complain about the price.','Use the expression.',r.due_at,g.review_id from history_graph g join public.review_tasks r on r.id=g.review_id where g.name='same_word_candidate';
create temp table removal_official as select public.complete_due_practice_with_examples(owner_id,jsonb_build_object('reviewTaskId',review_id,'practiceTaskId',pg_temp.history_id('599e0000',44),'responseChinese','价格高得要命。','accuracyScore',4,'accuracyFeedbackEnglish','Accurate.','naturalnessScore',4,'naturalnessFeedbackEnglish','Natural.','contextualFitScore',4,'contextualFitFeedbackEnglish','Fits.','completedAt',now())) result from history_graph where name='same_word_candidate';
create temp table removal_revision_inputs(name text primary key,value jsonb);
insert into removal_revision_inputs select 'first',jsonb_build_object('requestId',pg_temp.history_id('599f0000',44),'taskId',t.id,'scenarioVersion',t.scenario_version,'scenarioFingerprint',t.scenario_fingerprint,'attemptId',o.result->'completion'->>'attempt_id','responseChinese','这个价格高得要命。') from public.practice_tasks t cross join removal_official o where t.id=pg_temp.history_id('599e0000',44);
insert into removal_revision_inputs select 'inflight',value||jsonb_build_object('requestId',pg_temp.history_id('599f0000',45)) from removal_revision_inputs where name='first';
create temp table removal_revision_result as select jsonb_build_object('evaluation',jsonb_build_object('accuracy',jsonb_build_object('score',4,'englishFeedback','Accurate.'),'naturalness',jsonb_build_object('score',4,'englishFeedback','Natural.'),'contextualFit',jsonb_build_object('score',4,'englishFeedback','Fits.')),'coaching',null,'promptVersion','evaluate-practice-v4','model','fixture/removal-revision','pin',null) value;
insert into removed_upgrade_results select 'revision_first_claim',public.claim_review_revision(g.owner_id,g.review_id,i.value,now()) from history_graph g cross join removal_revision_inputs i where g.name='same_word_candidate' and i.name='first';
insert into removed_upgrade_results select 'revision_first',public.publish_review_revision(g.owner_id,g.review_id,i.value,(c.value->>'token')::uuid,r.value,now()) from history_graph g cross join removal_revision_inputs i cross join removed_upgrade_results c cross join removal_revision_result r where g.name='same_word_candidate' and i.name='first' and c.name='revision_first_claim';
insert into removed_upgrade_results select 'revision_inflight_claim',public.claim_review_revision(g.owner_id,g.review_id,i.value,now()) from history_graph g cross join removal_revision_inputs i where g.name='same_word_candidate' and i.name='inflight';
select extensions.ok((select public.remove_vault_expression(owner_id,expression_id) from history_graph where name='same_word_candidate'),'completed review expression is removed through main actual RPC');
select extensions.is((select public.lookup_review_revision(g.owner_id,g.review_id,i.value,now())->>'kind' from history_graph g cross join removal_revision_inputs i where g.name='same_word_candidate' and i.name='first'),'ready','old revision UUID stays readable after removal');
select extensions.is((select public.claim_review_revision(g.owner_id,g.review_id,i.value,now())->>'kind' from history_graph g cross join removal_revision_inputs i where g.name='same_word_candidate' and i.name='first'),'ready','original revision claim replays before the active-only gate');
select extensions.throws_ok(format('select public.claim_review_revision(%L,%L,%L::jsonb,now())',(select owner_id from history_graph where name='same_word_candidate'),(select review_id from history_graph where name='same_word_candidate'),(select value||jsonb_build_object('requestId',pg_temp.history_id('599f0000',46)) from removal_revision_inputs where name='first')),'22023','owned review not found','removed completed review cannot obtain a new scoring claim');
select extensions.throws_ok(format('select public.publish_review_revision(%L,%L,%L::jsonb,%L,%L::jsonb,now())',(select owner_id from history_graph where name='same_word_candidate'),(select review_id from history_graph where name='same_word_candidate'),(select value from removal_revision_inputs where name='inflight'),(select value->>'token' from removed_upgrade_results where name='revision_inflight_claim'),(select value from removal_revision_result)),'22023','owned review not found','removal during scoring prevents a new learning revision publication');
select extensions.is((select public.publish_review_revision(g.owner_id,g.review_id,i.value,(c.value->>'token')::uuid,r.value,now()) from history_graph g cross join removal_revision_inputs i cross join removed_upgrade_results c cross join removal_revision_result r where g.name='same_word_candidate' and i.name='first' and c.name='revision_first_claim'),(select value from removed_upgrade_results where name='revision_first'),'existing revision publication remains an immutable read-only replay');
select extensions.is((select count(*)::integer from public.review_revisions where user_expression_id=(select expression_id from history_graph where name='same_word_candidate')),1,'failed new publication adds no revision after removal');
select extensions.is((select status from public.review_tasks where id=(select review_id from history_graph where name='same_word_candidate')),'completed','removal never cancels the historical completed official review');
select extensions.ok((select removed_from_vault_at is not null from public.user_expressions where id=(select expression_id from history_graph where name='same_word_candidate')),'history/revision receipt replay does not restore Vault membership');
select * from extensions.finish();
rollback;
