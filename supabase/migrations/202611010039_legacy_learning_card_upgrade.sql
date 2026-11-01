-- Explicit source-grounded metadata upgrade. No automatic worker or model call.
create table private.legacy_learning_card_upgrades(
 user_id uuid not null,sense_id uuid not null,request_id uuid not null,
 workflow_version text not null default 'learning-card-upgrade-v1' check(workflow_version='learning-card-upgrade-v1'),
 request_hash text not null,target_hash text not null,input jsonb not null,
 status text not null check(status in('claimed','waiting','finished','failed')),
 claim_token uuid,lease_expires_at timestamptz,linked_request_id uuid,gateway_pin jsonb,
 result jsonb,outcome jsonb,error_code text,created_at timestamptz not null,updated_at timestamptz not null,
 primary key(user_id,request_id),
 foreign key(sense_id,user_id) references public.expression_senses(id,user_id) on delete cascade,
 foreign key(user_id,linked_request_id) references private.legacy_learning_card_upgrades(user_id,request_id) on delete cascade,
 check(request_hash ~ '^[a-f0-9]{64}$' and target_hash ~ '^[a-f0-9]{64}$'),
 check(status<>'claimed' or(claim_token is not null and lease_expires_at is not null))
);
create unique index legacy_upgrade_one_claim on private.legacy_learning_card_upgrades(user_id,sense_id) where status='claimed';
alter table private.legacy_learning_card_upgrades enable row level security;
revoke all on private.legacy_learning_card_upgrades from public,anon,authenticated,service_role;

create function private.legacy_upgrade_hash(value jsonb) returns text
language sql immutable strict set search_path=pg_catalog as $$
 select encode(extensions.digest(convert_to(value::text,'UTF8'),'sha256'),'hex')
$$;
create function private.legacy_upgrade_empty(s public.expression_senses) returns boolean
language sql immutable strict set search_path=pg_catalog as $$
 select s.meaning_here is null and s.use_it_when is null and s.compared_with is null and s.how_it_fits is null and s.tone_and_who is null and s.watch_out is null and s.examples is null and cardinality(s.function_categories)=0 and cardinality(s.usage_settings)=0
$$;
create function private.legacy_upgrade_card(c jsonb) returns jsonb
language sql immutable set search_path=pg_catalog as $$
 select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(case when jsonb_typeof(c)='object' then c else '{}'::jsonb end)
 where key=any(array['meaningHere','useItWhen','comparedWith','howItFits','toneAndWho','watchOut','examples','functionCategories','usageSettings','suitability','notExpressionReasonEn'])
$$;
create function private.legacy_upgrade_valid_card(c jsonb,expression text) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare field text;example jsonb;
begin
 if jsonb_typeof(c) is distinct from 'object' or not(c ?& array['meaningHere','useItWhen','comparedWith','howItFits','toneAndWho','watchOut','examples','functionCategories','usageSettings','suitability']) then return false;end if;
 if exists(select 1 from jsonb_object_keys(c) k where k<>all(array['meaningHere','useItWhen','comparedWith','howItFits','toneAndWho','watchOut','examples','functionCategories','usageSettings','suitability','notExpressionReasonEn'])) then return false;end if;
 foreach field in array array['meaningHere','useItWhen','comparedWith','howItFits','toneAndWho'] loop
  if jsonb_typeof(c->field) is distinct from 'string' or not private.is_learning_card_prose(c->>field,2000) or cardinality(regexp_split_to_array(btrim(c->>field),'\s+'))>40 then return false;end if;
 end loop;
 if c->'watchOut'<>'null'::jsonb and(jsonb_typeof(c->'watchOut')<>'string' or not private.is_learning_card_prose(c->>'watchOut',2000) or cardinality(regexp_split_to_array(btrim(c->>'watchOut'),'\s+'))>40) then return false;end if;
 if jsonb_typeof(c->'functionCategories') is distinct from 'array' or jsonb_typeof(c->'usageSettings') is distinct from 'array' then return false;end if;
 if jsonb_array_length(c->'functionCategories') not between 1 and 2 or jsonb_array_length(c->'usageSettings')>3 then return false;end if;
 if exists(select 1 from jsonb_array_elements(c->'functionCategories') v where jsonb_typeof(v)<>'string' or v#>>'{}' not in('emphasize','complain','praise','react','explain_sum_up','concede_contrast','suggest','connect_ideas','describe','other'))
 or exists(select 1 from jsonb_array_elements(c->'usageSettings') v where jsonb_typeof(v)<>'string' or v#>>'{}' not in('casual_chat','daily_errands','work_school','formal_writing','online_social')) then return false;end if;
 if (select count(*)<>count(distinct v) from jsonb_array_elements(c->'functionCategories') v) or(select count(*)<>count(distinct v) from jsonb_array_elements(c->'usageSettings') v) then return false;end if;
 if c->>'suitability' is null or c->>'suitability' not in('expression','not_expression') then return false;end if;
 if c->>'suitability'='not_expression' and(c->>'notExpressionReasonEn' is null or not private.is_learning_card_prose(c->>'notExpressionReasonEn',2000) or cardinality(regexp_split_to_array(btrim(c->>'notExpressionReasonEn'),'\s+'))>40) then return false;end if;
 if c->'examples'<>'null'::jsonb then
  if jsonb_typeof(c->'examples')<>'array' or jsonb_array_length(c->'examples')<>2 then return false;end if;
  for example in select value from jsonb_array_elements(c->'examples') loop
   if jsonb_typeof(example)<>'object' or(select count(*) from jsonb_object_keys(example))<>2 or jsonb_typeof(example->'zh') is distinct from 'string' or not private.is_target_chinese(example->>'zh',30) or strpos(example->>'zh',expression)=0 or jsonb_typeof(example->'en') is distinct from 'string' or not private.is_learning_card_prose(example->>'en',2000) or cardinality(regexp_split_to_array(btrim(example->>'en'),'\s+'))>40 then return false;end if;
  end loop;
  if c->'examples'->0->>'zh'=c->'examples'->1->>'zh' then return false;end if;
 end if;
 return true;
end $$;

create function private.legacy_upgrade_existing(p_user_id uuid,p_sense_id uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
 with candidates as(
 select receipt.candidate_key,a.id artifact_id,(c.ordinality-1)::integer idx,c.value,private.legacy_upgrade_card(c.value) fields,a.created_at,
 private.legacy_upgrade_hash(jsonb_build_object('receipt',to_jsonb(receipt),'artifact',to_jsonb(a),'candidate',c.value,'save',to_jsonb(item),'source',to_jsonb(source))) proof
 from public.user_expressions e join public.expression_senses s on s.id=e.expression_sense_id and s.user_id=p_user_id
 join private.practice_promotion_receipts receipt on receipt.user_id=p_user_id and receipt.user_expression_id=e.id
 join public.saved_items item on item.user_id=p_user_id and item.video_source_id=s.video_source_id
 join public.video_sources source on source.user_id=p_user_id and source.id=item.video_source_id
 join public.generated_artifacts a on a.user_id=p_user_id and a.saved_item_id=item.id and a.video_source_id=item.video_source_id and a.artifact_type='saved_item_analysis' and a.prompt_version in('analyze-saved-item-v1','analyze-saved-item-v2','analyze-saved-item-v3')
 cross join lateral jsonb_array_elements(case when jsonb_typeof(a.content->'candidates')='array' then a.content->'candidates' else '[]'::jsonb end) with ordinality c
 where e.user_id=p_user_id and s.id=p_sense_id and c.value->>'expression'=s.expression_text
 and receipt.candidate_key=case when jsonb_typeof(c.value->'highlightKey')='string' and length(c.value->>'highlightKey')>0 then 'h:'||item.id::text||':'||encode(extensions.digest(convert_to(c.value->>'highlightKey','UTF8'),'sha256'),'hex') else 'l:'||item.id::text||':'||a.id::text||':'||(c.ordinality-1)::text end
 and private.legacy_upgrade_valid_card(private.legacy_upgrade_card(c.value),s.expression_text)
 ) select jsonb_build_object('card',fields,'candidateKey',candidate_key,'artifactId',artifact_id,'candidateIndex',idx,'evidenceHash',proof)
 from candidates order by created_at desc,artifact_id desc,idx limit 1
$$;

create function private.legacy_upgrade_sources(p_user_id uuid,p_sense_id uuid) returns setof jsonb
language plpgsql stable set search_path=pg_catalog as $$
declare r record;segments jsonb;value jsonb;low integer;high integer;
begin
 for r in select o.*,to_jsonb(v) source_row,to_jsonb(snapshot) snapshot_row,snapshot.transcript_hash
 from public.expression_senses s join public.expression_occurrences o on o.expression_sense_id=s.id and o.user_id=p_user_id and o.video_source_id=s.video_source_id
 join public.video_sources v on v.id=o.video_source_id and v.user_id=p_user_id
 join public.video_snapshots snapshot on snapshot.id=o.snapshot_id and snapshot.user_id=p_user_id and snapshot.video_source_id=v.id
 where s.id=p_sense_id and s.user_id=p_user_id
 order by case when s.saved_item_id is not null and o.saved_item_id=s.saved_item_id then 0 else 1 end,o.created_at,o.id loop
  select min(position),max(position) into low,high from public.transcript_segments t where t.user_id=p_user_id and t.snapshot_id=r.snapshot_id and t.stable_id=any(r.segment_ids);
  select coalesce(jsonb_agg(jsonb_build_object('stableId',t.stable_id,'position',t.position,'text',t.original_chinese,'startSeconds',t.start_seconds,'endSeconds',t.end_seconds,'target',t.stable_id=any(r.segment_ids)) order by t.position,t.stable_id),'[]'::jsonb) into segments
  from(
   select * from public.transcript_segments where user_id=p_user_id and snapshot_id=r.snapshot_id and stable_id=any(r.segment_ids)
   union all(select * from public.transcript_segments where user_id=p_user_id and snapshot_id=r.snapshot_id and position<low order by position desc limit 3)
   union all(select * from public.transcript_segments where user_id=p_user_id and snapshot_id=r.snapshot_id and position>high order by position limit 2)
  ) t;
  value:=jsonb_build_object('sourceId',r.video_source_id,'snapshotId',r.snapshot_id,'occurrenceId',r.id,'savedItemId',r.saved_item_id,'transcriptHash',r.transcript_hash,'evidenceText',r.evidence_text,'segmentIds',r.segment_ids,'startSeconds',r.start_seconds,'endSeconds',r.end_seconds,'createdAt',r.created_at,'segments',segments);
  return next value||jsonb_build_object('evidenceHash',private.legacy_upgrade_hash(value||jsonb_build_object('sourceRow',r.source_row,'snapshotRow',r.snapshot_row,'owner',p_user_id,'sense',p_sense_id)));
 end loop;
end $$;

create function public.read_legacy_learning_card_upgrade_context(p_user_id uuid,p_sense_id uuid,p_source_offset integer default 0,p_source_limit integer default 200) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare s public.expression_senses%rowtype;e uuid;card jsonb;sources jsonb;
begin
 if p_source_offset is null or p_source_offset<0 or p_source_limit is null or p_source_limit not between 1 and 200 then raise exception using errcode='22023',message='invalid source page';end if;
 select sense.* into s from public.expression_senses sense join public.user_expressions expression on expression.expression_sense_id=sense.id and expression.user_id=p_user_id where sense.user_id=p_user_id and sense.id=p_sense_id;
 if not found then return null;end if;
 select id into e from public.user_expressions where user_id=p_user_id and expression_sense_id=s.id;
 card:=jsonb_build_object('meaningHere',s.meaning_here,'useItWhen',s.use_it_when,'comparedWith',s.compared_with,'howItFits',s.how_it_fits,'toneAndWho',s.tone_and_who,'watchOut',s.watch_out,'examples',s.examples,'functionCategories',s.function_categories,'usageSettings',s.usage_settings,'suitability','expression');
 if not private.legacy_upgrade_valid_card(card,s.expression_text) then card:=null;end if;
 select coalesce(jsonb_agg(value),'[]'::jsonb) into sources from(select value from private.legacy_upgrade_sources(p_user_id,s.id) value offset p_source_offset limit p_source_limit) page;
 return jsonb_build_object('ownerId',p_user_id,'senseId',s.id,'userExpressionId',e,'expression',s.expression_text,'originalSavedItemId',s.saved_item_id,
 'beforeHash',private.legacy_upgrade_hash(to_jsonb(s)),'canonicalCard',card,'modernFieldsEmpty',private.legacy_upgrade_empty(s),
 'sourceState',case when s.source_deleted_at is not null then 'deleted' when exists(select 1 from public.video_sources where user_id=p_user_id and id=s.video_source_id) then 'retained' else 'missing' end,
 'existingCard',private.legacy_upgrade_existing(p_user_id,s.id),'sources',sources,
 'nextSourceOffset',case when jsonb_array_length(sources)=p_source_limit then p_source_offset+p_source_limit else null end);
end $$;

create function public.page_legacy_learning_card_upgrade_contexts(p_user_id uuid,p_after_sense_id uuid,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare ids jsonb;
begin
 if p_user_id is null or p_limit is null or p_limit not between 1 and 200 then raise exception using errcode='22023',message='invalid upgrade page';end if;
 select coalesce(jsonb_agg(id order by id),'[]'::jsonb) into ids from(
 select s.id from public.expression_senses s join public.user_expressions e on e.expression_sense_id=s.id and e.user_id=p_user_id
 where s.user_id=p_user_id and(p_after_sense_id is null or s.id>p_after_sense_id) order by s.id limit p_limit) page;
 return jsonb_build_object('senseIds',ids,'nextCursor',case when jsonb_array_length(ids)=p_limit then ids->>(p_limit-1) else null end);
end $$;

create function private.legacy_upgrade_check_input(p_input jsonb) returns void
language plpgsql immutable set search_path=pg_catalog as $$
declare source jsonb:=p_input->'source';kind text:=p_input->'source'->>'kind';
begin
 if jsonb_typeof(p_input) is distinct from 'object' or(select count(*) from jsonb_object_keys(p_input))<>5 or not(p_input ?& array['requestId','senseId','expectedBeforeHash','expectedEvidenceHash','source']) or p_input->>'expectedBeforeHash' !~ '^[a-f0-9]{64}$' or p_input->>'expectedEvidenceHash' !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='invalid upgrade input';end if;
 perform(p_input->>'requestId')::uuid,(p_input->>'senseId')::uuid;
 if jsonb_typeof(source) is distinct from 'object' or kind is null or kind not in('existing_card','source_occurrence') then raise exception using errcode='22023',message='invalid upgrade source';end if;
 if kind='existing_card' then
  if not(source ?& array['kind','candidateKey','artifactId','candidateIndex']) or(select count(*) from jsonb_object_keys(source))<>4 or length(coalesce(source->>'candidateKey','')) not between 1 and 400 or(source->>'candidateIndex')::integer<0 then raise exception using errcode='22023',message='invalid linked card';end if;
  perform(source->>'artifactId')::uuid;
 else
  if not(source ?& array['kind','sourceId','snapshotId','occurrenceId']) or(select count(*) from jsonb_object_keys(source))<>4 then raise exception using errcode='22023',message='invalid original occurrence';end if;
  perform(source->>'sourceId')::uuid,(source->>'snapshotId')::uuid,(source->>'occurrenceId')::uuid;
 end if;
end $$;

create function private.legacy_upgrade_evidence(p_user_id uuid,p_input jsonb) returns jsonb
language plpgsql stable set search_path=pg_catalog as $$
declare c jsonb;source jsonb:=p_input->'source';target text;joined text;ids jsonb;count_matches integer;low integer;high integer;n integer;
begin
 if source->>'kind'='existing_card' then
  c:=private.legacy_upgrade_existing(p_user_id,(p_input->>'senseId')::uuid);
  if c is null or c->>'candidateKey' is distinct from source->>'candidateKey' or c->>'artifactId' is distinct from source->>'artifactId' or c->>'candidateIndex' is distinct from source->>'candidateIndex' then return null;end if;
  return c;
 end if;
 select value into c from private.legacy_upgrade_sources(p_user_id,(p_input->>'senseId')::uuid) value where value->>'sourceId'=source->>'sourceId' and value->>'snapshotId'=source->>'snapshotId' and value->>'occurrenceId'=source->>'occurrenceId';
 if c is null then return null;end if;
 select expression_text into target from public.expression_senses where user_id=p_user_id and id=(p_input->>'senseId')::uuid;
 select string_agg(v->>'text',E'\n' order by(v->>'position')::integer),jsonb_agg(v->>'stableId' order by(v->>'position')::integer),min((v->>'position')::integer),max((v->>'position')::integer),count(*) into joined,ids,low,high,n from jsonb_array_elements(c->'segments') v where(v->>'target')::boolean;
 if joined is distinct from c->>'evidenceText' or ids is distinct from c->'segmentIds' or n=0 or high-low+1<>n then return null;end if;
 select count(*) into count_matches from generate_series(1,char_length(joined)-char_length(target)+1) pos where substring(joined from pos for char_length(target))=target;
 if count_matches<>1 then return null;end if;
 return c;
end $$;

create function public.lookup_legacy_learning_card_upgrade(p_user_id uuid,p_input jsonb,p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare op private.legacy_learning_card_upgrades%rowtype;parent private.legacy_learning_card_upgrades%rowtype;
begin
 perform private.legacy_upgrade_check_input(p_input);
 select * into op from private.legacy_learning_card_upgrades where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid;
 if not found then return null;end if;
 if op.request_hash<>private.legacy_upgrade_hash(p_input) then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';end if;
 if op.status='waiting' then
  select * into parent from private.legacy_learning_card_upgrades where user_id=p_user_id and request_id=op.linked_request_id;
  if parent.status in('finished','failed') then
   if parent.target_hash<>op.target_hash then return jsonb_build_object('status','failed','requestId',op.request_id,'senseId',op.sense_id,'code','STALE_PLAN');end if;
   return parent.outcome||jsonb_build_object('requestId',op.request_id);
  end if;
  if parent.lease_expires_at<=p_now then return jsonb_build_object('status','failed','requestId',op.request_id,'senseId',op.sense_id,'code','LEASE_EXPIRED');end if;
 elsif op.status in('finished','failed') then return op.outcome;
 elsif op.lease_expires_at<=p_now then return jsonb_build_object('status','failed','requestId',op.request_id,'senseId',op.sense_id,'code','LEASE_EXPIRED');end if;
 return jsonb_build_object('status','in_progress','requestId',op.request_id,'senseId',op.sense_id,'retryAfterMs',1000);
end $$;

create function public.claim_legacy_learning_card_upgrade(p_user_id uuid,p_input jsonb,p_gateway_pin jsonb,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare s public.expression_senses%rowtype;c jsonb;evidence jsonb;prior jsonb;outcome jsonb;active private.legacy_learning_card_upgrades%rowtype;token uuid:=gen_random_uuid();req uuid;
begin
 perform private.legacy_upgrade_check_input(p_input);req:=(p_input->>'requestId')::uuid;
 if p_user_id is null or p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid upgrade clock';end if;
 select sense.* into s from public.expression_senses sense join public.user_expressions e on e.expression_sense_id=sense.id and e.user_id=p_user_id where sense.user_id=p_user_id and sense.id=(p_input->>'senseId')::uuid for update of sense;
 if not found then raise exception using errcode='22023',message='owned sense not found';end if;
 prior:=public.lookup_legacy_learning_card_upgrade(p_user_id,p_input,p_now);
 if prior is not null then return jsonb_build_object('kind','outcome','outcome',prior);end if;
 c:=public.read_legacy_learning_card_upgrade_context(p_user_id,s.id,0,200);
 if c->'canonicalCard'<>'null'::jsonb then outcome:=jsonb_build_object('status','already_modern','requestId',req,'senseId',s.id);
 elsif not private.legacy_upgrade_empty(s) then outcome:=jsonb_build_object('status','needs_review','requestId',req,'senseId',s.id,'reason','PARTIAL_METADATA');
 elsif c->>'sourceState'<>'retained' then outcome:=jsonb_build_object('status','blocked','requestId',req,'senseId',s.id,'reason','SOURCE_UNAVAILABLE');
 elsif c->>'beforeHash' is distinct from p_input->>'expectedBeforeHash' then raise exception using errcode='P0001',message='STALE_PLAN';
 else
  evidence:=private.legacy_upgrade_evidence(p_user_id,p_input);
  if evidence is null or evidence->>'evidenceHash' is distinct from p_input->>'expectedEvidenceHash' then raise exception using errcode='P0001',message='STALE_PLAN';end if;
 end if;
 if outcome is not null then
  insert into private.legacy_learning_card_upgrades(user_id,sense_id,request_id,request_hash,target_hash,input,status,outcome,created_at,updated_at)
  values(p_user_id,s.id,req,private.legacy_upgrade_hash(p_input),private.legacy_upgrade_hash(p_input-'requestId'),p_input,'finished',outcome,p_now,p_now);
  return jsonb_build_object('kind','outcome','outcome',outcome);
 end if;
 update private.legacy_learning_card_upgrades set status='failed',error_code='LEASE_EXPIRED',outcome=jsonb_build_object('status','failed','requestId',request_id,'senseId',sense_id,'code','LEASE_EXPIRED'),updated_at=p_now where user_id=p_user_id and sense_id=s.id and status='claimed' and lease_expires_at<=p_now;
 select * into active from private.legacy_learning_card_upgrades where user_id=p_user_id and sense_id=s.id and status='claimed' for update;
 if found then
  insert into private.legacy_learning_card_upgrades(user_id,sense_id,request_id,request_hash,target_hash,input,status,linked_request_id,created_at,updated_at)
  values(p_user_id,s.id,req,private.legacy_upgrade_hash(p_input),private.legacy_upgrade_hash(p_input-'requestId'),p_input,'waiting',active.request_id,p_now,p_now);
  return jsonb_build_object('kind','outcome','outcome',jsonb_build_object('status','in_progress','requestId',req,'senseId',s.id,'retryAfterMs',1000));
 end if;
 if p_input->'source'->>'kind'='source_occurrence' and p_gateway_pin is not null and p_gateway_pin<>'null'::jsonb and not exists(select 1 from public.resolve_active_user_model_gateway_pin(p_user_id) pin where pin.config_id=(p_gateway_pin->>'configId')::uuid and pin.revision=(p_gateway_pin->>'revision')::integer and pin.config_fingerprint=p_gateway_pin->>'fingerprint') then raise exception using errcode='P0001',message='GATEWAY_CHANGED';end if;
 insert into private.legacy_learning_card_upgrades(user_id,sense_id,request_id,request_hash,target_hash,input,status,claim_token,lease_expires_at,gateway_pin,created_at,updated_at)
 values(p_user_id,s.id,req,private.legacy_upgrade_hash(p_input),private.legacy_upgrade_hash(p_input-'requestId'),p_input,'claimed',token,p_now+interval '5 minutes',p_gateway_pin,p_now,p_now);
 return jsonb_build_object('kind','claimed','token',token,'leaseExpiresAt',p_now+interval '5 minutes');
end $$;

create function public.publish_legacy_learning_card_upgrade(p_user_id uuid,p_input jsonb,p_token uuid,p_result jsonb,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare s public.expression_senses%rowtype;op private.legacy_learning_card_upgrades%rowtype;evidence jsonb;card jsonb:=p_result->'card';outcome jsonb;origin text;
begin
 perform private.legacy_upgrade_check_input(p_input);
 select * into s from public.expression_senses where user_id=p_user_id and id=(p_input->>'senseId')::uuid for update;
 if not found then raise exception using errcode='22023',message='owned sense not found';end if;
 select * into op from private.legacy_learning_card_upgrades where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid for update;
 if not found or op.request_hash<>private.legacy_upgrade_hash(p_input) then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT';end if;
 if op.status in('finished','failed') then return op.outcome;end if;
 if p_now is null or not isfinite(p_now) or op.status<>'claimed' or op.claim_token is distinct from p_token or op.lease_expires_at<=p_now then raise exception using errcode='P0001',message='LEASE_EXPIRED';end if;
 perform 1 from public.video_sources where user_id=p_user_id and id=s.video_source_id for key share;
 if not found or not private.legacy_upgrade_empty(s) or private.legacy_upgrade_hash(to_jsonb(s)) is distinct from p_input->>'expectedBeforeHash' then raise exception using errcode='P0001',message='STALE_PLAN';end if;
 evidence:=private.legacy_upgrade_evidence(p_user_id,p_input);
 if evidence is null or evidence->>'evidenceHash' is distinct from p_input->>'expectedEvidenceHash' then raise exception using errcode='P0001',message='STALE_PLAN';end if;
 if not private.legacy_upgrade_valid_card(card,s.expression_text) then raise exception using errcode='22023',message='invalid complete upgrade card';end if;
 origin:=case when p_input->'source'->>'kind'='existing_card' then 'existing_card' else 'model' end;
 if p_result->>'origin' is distinct from origin then raise exception using errcode='22023',message='wrong upgrade origin';end if;
 if origin='existing_card' then
  if card is distinct from evidence->'card' then raise exception using errcode='P0001',message='STALE_PLAN';end if;
 else
  if p_result->>'promptVersion' is distinct from 'analyze-saved-item-v3' or length(coalesce(p_result->>'model','')) not between 1 and 100 or coalesce(p_result->'pin','null'::jsonb) is distinct from coalesce(op.gateway_pin,'null'::jsonb) then raise exception using errcode='P0001',message='GATEWAY_CHANGED';end if;
  if op.gateway_pin is null or op.gateway_pin='null'::jsonb then
   if p_result->>'model' not like 'fixture/%' then raise exception using errcode='P0001',message='GATEWAY_REQUIRED';end if;
  elsif not exists(select 1 from public.resolve_active_user_model_gateway_pin(p_user_id) pin join public.user_model_gateway_configs config on config.id=pin.config_id and config.user_id=p_user_id where pin.config_id=(op.gateway_pin->>'configId')::uuid and pin.revision=(op.gateway_pin->>'revision')::integer and pin.config_fingerprint=op.gateway_pin->>'fingerprint' and config.model=p_result->>'model') then raise exception using errcode='P0001',message='GATEWAY_CHANGED';end if;
 end if;
 if card->>'suitability'='not_expression' then
  outcome:=jsonb_build_object('status','needs_review','requestId',op.request_id,'senseId',s.id,'reason','NOT_EXPRESSION','card',card);
 else
  update public.expression_senses set meaning_here=card->>'meaningHere',use_it_when=card->>'useItWhen',compared_with=card->>'comparedWith',how_it_fits=card->>'howItFits',tone_and_who=card->>'toneAndWho',watch_out=card->>'watchOut',examples=nullif(card->'examples','null'::jsonb),function_categories=array(select jsonb_array_elements_text(card->'functionCategories')),usage_settings=array(select jsonb_array_elements_text(card->'usageSettings')),updated_at=p_now where user_id=p_user_id and id=s.id;
  outcome:=jsonb_build_object('status','applied','requestId',op.request_id,'senseId',s.id,'origin',origin,'card',card);
 end if;
 update private.legacy_learning_card_upgrades set status='finished',result=p_result,outcome=outcome,updated_at=p_now where user_id=p_user_id and request_id=op.request_id;
 return outcome;
end $$;

create function public.fail_legacy_learning_card_upgrade(p_user_id uuid,p_input jsonb,p_token uuid,p_code text,p_now timestamptz) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform private.legacy_upgrade_check_input(p_input);
 perform 1 from public.expression_senses where user_id=p_user_id and id=(p_input->>'senseId')::uuid for update;
 update private.legacy_learning_card_upgrades set status='failed',error_code=p_code,outcome=jsonb_build_object('status','failed','requestId',request_id,'senseId',sense_id,'code',p_code),updated_at=p_now
 where user_id=p_user_id and request_id=(p_input->>'requestId')::uuid and request_hash=private.legacy_upgrade_hash(p_input) and status='claimed' and claim_token=p_token and lease_expires_at>p_now;
 return found;
end $$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'legacy_upgrade_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('read_legacy_learning_card_upgrade_context','page_legacy_learning_card_upgrade_contexts','lookup_legacy_learning_card_upgrade','claim_legacy_learning_card_upgrade','publish_legacy_learning_card_upgrade','fail_legacy_learning_card_upgrade') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;
end $$;
