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

select extensions.has_function('public','read_legacy_learning_card_upgrade_context',array['uuid','uuid','integer','integer'],'owner context has a bounded source-page RPC');
create temp table upgrade_contexts as select name,public.read_legacy_learning_card_upgrade_context(owner_id,sense_id,0,200) as value from history_graph;
select extensions.is((select value->'canonicalCard' from upgrade_contexts where name='main'),'null'::jsonb,'missing modern fields are not fabricated from old descriptions');
select extensions.is((select value->>'modernFieldsEmpty' from upgrade_contexts where name='main'),'true','all-null legacy fields are eligible for explicit upgrade');
select extensions.is((select value->>'sourceState' from upgrade_contexts where name='main'),'retained','actual owned source is retained');
select extensions.is((select jsonb_array_length(value->'sources') from upgrade_contexts where name='main'),1,'projection contains the real original owned occurrence');
select extensions.is((select value->'existingCard' from upgrade_contexts where name='main'),'null'::jsonb,'legacy artifact with same spelling is not a modern card');
select extensions.ok((select value->'canonicalCard' is not null and value->'canonicalCard'<>'null'::jsonb from upgrade_contexts where name='same_word_candidate'),'valid canonical modern card is a no-op candidate');
select extensions.ok((select value->'existingCard' is not null and value->'existingCard'<>'null'::jsonb from upgrade_contexts where name='other_owner'),'exact receipt key can recover an existing modern card');
select extensions.is(public.read_legacy_learning_card_upgrade_context('59900000-0000-4000-8000-000000000001',(select sense_id from history_graph where name='other_owner'),0,200),null::jsonb,'another owner cannot project a source/card');
select extensions.is((select value->>'beforeHash' from upgrade_contexts where name='main'),(select public.read_legacy_learning_card_upgrade_context(owner_id,sense_id,0,200)->>'beforeHash' from history_graph where name='main'),'database before hash is deterministic and opaque');
create function pg_temp.upgrade_request(graph_name text,n integer) returns jsonb language sql as $$
 with c as(select public.read_legacy_learning_card_upgrade_context(owner_id,sense_id,0,200) value from history_graph where name=graph_name)
 select jsonb_build_object('requestId',pg_temp.history_id('599f0000',n),'senseId',value->>'senseId','expectedBeforeHash',value->>'beforeHash','expectedEvidenceHash',case when value->'existingCard'<>'null'::jsonb then value->'existingCard'->>'evidenceHash' else value->'sources'->0->>'evidenceHash' end,
 'source',case when value->'existingCard'<>'null'::jsonb then jsonb_build_object('kind','existing_card','candidateKey',value->'existingCard'->>'candidateKey','artifactId',value->'existingCard'->>'artifactId','candidateIndex',value->'existingCard'->'candidateIndex') else jsonb_build_object('kind','source_occurrence','sourceId',value->'sources'->0->>'sourceId','snapshotId',value->'sources'->0->>'snapshotId','occurrenceId',value->'sources'->0->>'occurrenceId') end) from c
$$;
create function pg_temp.upgrade_card() returns jsonb language sql as $$ select private.legacy_upgrade_card(card) from history_graph where name='main' $$;
create function pg_temp.upgrade_result(card jsonb) returns jsonb language sql as $$ select jsonb_build_object('origin','model','card',card,'promptVersion','analyze-saved-item-v3','model','fixture/legacy-upgrade','pin',null) $$;
create function pg_temp.protected_upgrade_graph() returns jsonb language sql as $$
 select jsonb_build_object(
 'attempts',(select jsonb_agg(to_jsonb(a) order by a.id) from public.attempts a where user_id in(select owner_id from history_graph)),
 'mastery',(select jsonb_agg(to_jsonb(a) order by a.id) from public.mastery_events a where user_id in(select owner_id from history_graph)),
 'reviews',(select jsonb_agg(to_jsonb(a) order by a.id) from public.review_tasks a where user_id in(select owner_id from history_graph)),
 'canonical',(select jsonb_agg(to_jsonb(a) order by a.id) from public.user_expressions a where user_id in(select owner_id from history_graph)),
 'tasks',(select jsonb_agg(to_jsonb(a) order by a.id) from public.practice_tasks a where user_id in(select owner_id from history_graph)),
 'saved',(select jsonb_agg(to_jsonb(a) order by a.id) from public.saved_items a where user_id in(select owner_id from history_graph)),
 'artifacts',(select jsonb_agg(to_jsonb(a) order by a.id) from public.generated_artifacts a where user_id in(select owner_id from history_graph)),
 'highlights',(select jsonb_agg(to_jsonb(a) order by a.id) from public.saved_item_highlights a where user_id in(select owner_id from history_graph)),
 'prepare',(select jsonb_agg(to_jsonb(a) order by a.request_id) from private.review_operations a where user_id in(select owner_id from history_graph)),
 'jobs',(select jsonb_agg(to_jsonb(a) order by a.id) from public.knowledge_jobs a where user_id in(select owner_id from history_graph)),
 'sources',(select jsonb_agg(to_jsonb(a) order by a.id) from public.video_sources a where user_id in(select owner_id from history_graph)),
 'snapshots',(select jsonb_agg(to_jsonb(a) order by a.id) from public.video_snapshots a where user_id in(select owner_id from history_graph)),
 'segments',(select jsonb_agg(to_jsonb(a) order by a.id) from public.transcript_segments a where user_id in(select owner_id from history_graph)),
 'occurrences',(select jsonb_agg(to_jsonb(a) order by a.id) from public.expression_occurrences a where user_id in(select owner_id from history_graph)),
 'oldSenseFields',(select jsonb_agg(to_jsonb(a)-array['meaning_here','use_it_when','compared_with','how_it_fits','tone_and_who','watch_out','examples','function_categories','usage_settings','updated_at'] order by a.id) from public.expression_senses a where user_id in(select owner_id from history_graph)))
$$;
create temp table upgrade_values(name text primary key,value jsonb);
insert into upgrade_values values('protected',pg_temp.protected_upgrade_graph()),('input',pg_temp.upgrade_request('main',1));
select extensions.throws_ok(format('select public.claim_legacy_learning_card_upgrade(%L,%L::jsonb,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select value from upgrade_values where name='input'),jsonb_build_object('configId',pg_temp.history_id('599e0000',1),'revision',1,'fingerprint',repeat('a',64)),'2026-11-01T00:00:00Z'),'P0001','GATEWAY_CHANGED','a fake or foreign consent pin cannot claim model work');
insert into upgrade_values select 'claim',public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,'2026-11-01T00:00:00Z') from history_graph g cross join upgrade_values i where g.name='main' and i.name='input';
select extensions.is((select value->>'kind' from upgrade_values where name='claim'),'claimed','one source-grounded operation is claimed before the model');
select extensions.is((select public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,'2026-11-01T00:00:01Z')->'outcome'->>'status' from history_graph g cross join upgrade_values i where g.name='main' and i.name='input'),'in_progress','same UUID cannot claim another generation');
select extensions.throws_ok(format('select public.lookup_legacy_learning_card_upgrade(%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select value||jsonb_build_object('expectedBeforeHash',repeat('f',64)) from upgrade_values where name='input'),'2026-11-01T00:00:01Z'),'P0001','IDEMPOTENCY_CONFLICT','same UUID with changed input cannot replay another signature');
insert into upgrade_values select 'waiter',public.claim_legacy_learning_card_upgrade(owner_id,pg_temp.upgrade_request('main',2),null,'2026-11-01T00:00:01Z') from history_graph where name='main';
select extensions.is((select value->'outcome'->>'status' from upgrade_values where name='waiter'),'in_progress','another command joins without a second active model claim');
select extensions.is((select count(*)::integer from private.legacy_learning_card_upgrades where user_id='59900000-0000-4000-8000-000000000001' and status='claimed'),1,'there is only one active upgrade claim');
select extensions.throws_ok(format('select public.publish_legacy_learning_card_upgrade(%L,%L::jsonb,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select value from upgrade_values where name='input'),(select value->>'token' from upgrade_values where name='claim'),pg_temp.upgrade_result(pg_temp.upgrade_card()-'toneAndWho'),'2026-11-01T00:00:02Z'),'22023','invalid complete upgrade card','a partial generated card cannot publish');
select extensions.throws_ok(format('select public.publish_legacy_learning_card_upgrade(%L,%L::jsonb,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='other_owner'),(select value from upgrade_values where name='input'),(select value->>'token' from upgrade_values where name='claim'),pg_temp.upgrade_result(pg_temp.upgrade_card()),'2026-11-01T00:00:02Z'),'22023','owned sense not found','another owner cannot publish the known sense or claim');
select extensions.ok(not public.fail_legacy_learning_card_upgrade('59900000-0000-4000-8000-000000000001',(select value from upgrade_values where name='input'),pg_temp.history_id('599f0000',99),'PROVIDER_OUTPUT_INVALID','2026-11-01T00:00:03Z'),'stale claim token cannot mark a known terminal failure');

update public.expression_senses set meaning_here='A manual partial edit.' where id=(select sense_id from history_graph where name='main');
select extensions.throws_ok(format('select public.publish_legacy_learning_card_upgrade(%L,%L::jsonb,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select value from upgrade_values where name='input'),(select value->>'token' from upgrade_values where name='claim'),pg_temp.upgrade_result(pg_temp.upgrade_card()),'2026-11-01T00:00:03Z'),'P0001','STALE_PLAN','a concurrent partial/manual edit is never overwritten');
select extensions.is((select meaning_here from public.expression_senses where id=(select sense_id from history_graph where name='main')),'A manual partial edit.','manual value remains intact');
update public.expression_senses set meaning_here=null where id=(select sense_id from history_graph where name='main');
update public.transcript_segments set original_chinese='这里的新价格高得要命。' where snapshot_id=(select snapshot_id from public.expression_occurrences where expression_sense_id=(select sense_id from history_graph where name='main'));
select extensions.throws_ok(format('select public.publish_legacy_learning_card_upgrade(%L,%L::jsonb,%L,%L::jsonb,%L::timestamptz)',(select owner_id from history_graph where name='main'),(select value from upgrade_values where name='input'),(select value->>'token' from upgrade_values where name='claim'),pg_temp.upgrade_result(pg_temp.upgrade_card()),'2026-11-01T00:00:03Z'),'P0001','STALE_PLAN','changed source evidence cannot publish the original model result');
update public.transcript_segments set original_chinese='这里的价格高得要命。' where snapshot_id=(select snapshot_id from public.expression_occurrences where expression_sense_id=(select sense_id from history_graph where name='main'));
insert into upgrade_values select 'not_expression',public.publish_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,pg_temp.upgrade_result(pg_temp.upgrade_card()||jsonb_build_object('suitability','not_expression','notExpressionReasonEn','A proper name in this source.')),'2026-11-01T00:00:04Z') from history_graph g cross join upgrade_values i cross join upgrade_values c where g.name='main' and i.name='input' and c.name='claim';
select extensions.is((select value->>'status' from upgrade_values where name='not_expression'),'needs_review','not_expression is retained for review, never silently relabeled');
select extensions.is((select value->'card'->>'notExpressionReasonEn' from upgrade_values where name='not_expression'),'A proper name in this source.','the complete private classification result is retained');
select extensions.ok((select private.legacy_upgrade_empty(s) from public.expression_senses s where id=(select sense_id from history_graph where name='main')),'not_expression writes no canonical modern fields');
select extensions.is((select public.lookup_legacy_learning_card_upgrade(g.owner_id,i.value,'2026-11-01T00:00:05Z')->>'status' from history_graph g cross join upgrade_values i where g.name='main' and i.name='input'),'needs_review','classification receipt replays without creating a new model cycle');

insert into upgrade_values values('failure_input',pg_temp.upgrade_request('main',9));
insert into upgrade_values select 'failure_claim',public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,'2026-11-01T00:01:00Z') from history_graph g cross join upgrade_values i where g.name='main' and i.name='failure_input';
select extensions.ok((select public.fail_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,'PROVIDER_OUTPUT_INVALID','2026-11-01T00:01:01Z') from history_graph g cross join upgrade_values i cross join upgrade_values c where g.name='main' and i.name='failure_input' and c.name='failure_claim'),'matching claim can confirm a failed four-attempt model cycle');
select extensions.is((select public.lookup_legacy_learning_card_upgrade(g.owner_id,i.value,'2026-11-01T00:01:02Z')->>'status' from history_graph g cross join upgrade_values i where g.name='main' and i.name='failure_input'),'failed','same manifest reads confirmed failure without reopening the operation');
select extensions.ok((select not public.fail_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,'PROVIDER_OUTPUT_INVALID','2026-11-01T00:01:02Z') from history_graph g cross join upgrade_values i cross join upgrade_values c where g.name='main' and i.name='failure_input' and c.name='failure_claim'),'failure receipt has a truthful conditional boolean');
insert into upgrade_values values('expired_input',pg_temp.upgrade_request('main',10));
insert into upgrade_values select 'expired_claim',public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,'2026-11-01T00:02:00Z') from history_graph g cross join upgrade_values i where g.name='main' and i.name='expired_input';
select extensions.is((select public.publish_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,pg_temp.upgrade_result(pg_temp.upgrade_card()),'2026-11-01T00:07:01Z')->>'code' from history_graph g cross join upgrade_values i cross join upgrade_values c where g.name='main' and i.name='expired_input' and c.name='expired_claim'),'LEASE_EXPIRED','an expired model publisher replays its typed failure instead of changing metadata');
select extensions.ok((select private.legacy_upgrade_empty(s) from public.expression_senses s where id=(select sense_id from history_graph where name='main')),'expired publication leaves canonical metadata empty');
select extensions.is((select public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,'2026-11-01T00:07:02Z')->'outcome'->>'status' from history_graph g cross join upgrade_values i where g.name='main' and i.name='expired_input'),'failed','same expired UUID is an observation rather than a fresh claim');
select extensions.is((select public.lookup_legacy_learning_card_upgrade(g.owner_id,i.value,'2026-11-01T00:07:02Z')->>'code' from history_graph g cross join upgrade_values i where g.name='main' and i.name='expired_input'),'LEASE_EXPIRED','expiry is a typed known failed outcome');
insert into upgrade_values values('apply_input',pg_temp.upgrade_request('main',3));
insert into upgrade_values select 'apply_claim',public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,'2026-11-01T00:10:00Z') from history_graph g cross join upgrade_values i where g.name='main' and i.name='apply_input';
insert into upgrade_values select 'applied',public.publish_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,pg_temp.upgrade_result(pg_temp.upgrade_card()),'2026-11-01T00:10:01Z') from history_graph g cross join upgrade_values i cross join upgrade_values c where g.name='main' and i.name='apply_input' and c.name='apply_claim';
select extensions.is((select value->>'status' from upgrade_values where name='applied'),'applied','a complete source-grounded expression card atomically updates modern metadata');
select extensions.is((select meaning_here from public.expression_senses where id=(select sense_id from history_graph where name='main')),pg_temp.upgrade_card()->>'meaningHere','only the exact requested sense received the card');
select extensions.is((select public.publish_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,pg_temp.upgrade_result(pg_temp.upgrade_card()),'2026-11-01T00:10:02Z') from history_graph g cross join upgrade_values i cross join upgrade_values c where g.name='main' and i.name='apply_input' and c.name='apply_claim'),(select value from upgrade_values where name='applied'),'a lost publication response replays the identical stored outcome');

insert into upgrade_values values('reuse_input',pg_temp.upgrade_request('other_owner',4));
insert into upgrade_values select 'reuse_claim',public.claim_legacy_learning_card_upgrade(g.owner_id,i.value,null,'2026-11-01T00:02:00Z') from history_graph g cross join upgrade_values i where g.name='other_owner' and i.name='reuse_input';
insert into upgrade_values select 'reused',public.publish_legacy_learning_card_upgrade(g.owner_id,i.value,(c.value->>'token')::uuid,jsonb_build_object('origin','existing_card','card',private.legacy_upgrade_card(g.card)),'2026-11-01T00:02:01Z') from history_graph g cross join upgrade_values i cross join upgrade_values c where g.name='other_owner' and i.name='reuse_input' and c.name='reuse_claim';
select extensions.is((select value->>'origin' from upgrade_values where name='reused'),'existing_card','exact owned existing card synchronizes without any gateway');
select extensions.is(pg_temp.protected_upgrade_graph(),(select value from upgrade_values where name='protected'),'all official history, original six sense fields, Saved/highlights/artifacts/source and prepare cycles remain deeply identical');

select extensions.ok((select deleted from public.delete_video_source((select owner_id from history_graph where name='main'),(select source_id from history_graph where name='main'),'remove_source_keep_evidence','2026-11-01T00:03:00Z')),'a completed private upgrade receipt does not block existing source deletion');
select extensions.is((select public.lookup_legacy_learning_card_upgrade(g.owner_id,i.value,'2026-11-01T00:03:01Z') from history_graph g cross join upgrade_values i where g.name='main' and i.name='apply_input'),(select value from upgrade_values where name='applied'),'source-deleted successful upgrade receipts replay without source reconstruction');
select extensions.ok(not has_table_privilege('service_role','private.legacy_learning_card_upgrades','select'),'even service cannot directly read private upgrade secrets');
select extensions.ok(not has_table_privilege('authenticated','private.legacy_learning_card_upgrades','select'),'owner browser cannot select private upgrade claims/cards');
select extensions.ok(not has_function_privilege('authenticated','public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)','execute'),'browser cannot publish model-generated metadata');
select extensions.ok(not has_function_privilege('anon','public.read_legacy_learning_card_upgrade_context(uuid,uuid,integer,integer)','execute'),'anonymous cannot project source data');
select * from extensions.finish();
rollback;
