-- Round-local first answers, candidate-wide promotion and durable assistance.
alter table public.practice_drafts drop constraint practice_draft_status_check;
alter table public.practice_drafts
  add column candidate_key text,
  add column round_number integer not null default 1,
  add column previous_draft_id uuid,
  add column retry_due_at timestamptz,
  add column status_before_remove text,
  add column removed_at timestamptz,
  add column examples_opened_at timestamptz,
  add column round_request_id uuid,
  add column situation_en text,
  add column interlocutor text,
  add column task_en text,
  add column target_function text,
  add column target_setting text,
  add column scenario_source text,
  add column scenario_fingerprint text;
alter table public.practice_draft_attempts add column natural_version text;
alter table public.attempts add column entry_round integer;
alter table public.review_tasks add column examples_opened_at timestamptz;
alter table public.practice_tasks
  add column situation_en text, add column interlocutor text, add column task_en text,
  add column target_function text, add column target_setting text,
  add column scenario_source text;

create function private.practice_situation_fingerprint(p_text text) returns text
language sql immutable strict set search_path=pg_catalog as $$
  select encode(extensions.digest(convert_to(regexp_replace(normalize(p_text,NFKC),'[[:space:]]','','g'),'UTF8'),'sha256'),'hex')
$$;
revoke all on function private.practice_situation_fingerprint(text) from public,anon,authenticated,service_role;

update public.practice_drafts d set candidate_key=case
  when a.content->'candidates'->d.candidate_index->>'highlightKey' is not null
    then 'h:'||d.saved_item_id::text||':'||encode(extensions.digest(convert_to(a.content->'candidates'->d.candidate_index->>'highlightKey','UTF8'),'sha256'),'hex')
  else 'l:'||d.saved_item_id::text||':'||d.candidate_artifact_id::text||':'||d.candidate_index::text end,
  scenario_fingerprint=private.practice_situation_fingerprint(d.prompt_chinese)
from public.generated_artifacts a where a.id=d.candidate_artifact_id;
update public.practice_drafts d set status=case
  when exists(select 1 from private.practice_promotion_receipts r where r.practice_draft_id=d.id) then 'promoted'
  when exists(select 1 from public.practice_draft_attempts a where a.practice_draft_id=d.id and a.revision=1) then 'retry_scheduled'
  else 'open' end,
  retry_due_at=(select a.submitted_at+interval '24 hours' from public.practice_draft_attempts a
    where a.practice_draft_id=d.id and a.revision=1 and not exists(select 1 from private.practice_promotion_receipts r where r.practice_draft_id=d.id));

alter table public.practice_drafts
  alter column status set default 'open', alter column candidate_key set not null,
  alter column scenario_fingerprint set not null,
  add constraint practice_draft_status_check check(status in('open','retry_scheduled','promoted','superseded','removed')),
  add constraint practice_round_number_check check(round_number>0),
  add constraint practice_previous_round_owner_fk foreign key(previous_draft_id,user_id) references public.practice_drafts(id,user_id),
  add constraint practice_round_remove_state_check check(status_before_remove is null or status_before_remove in('open','retry_scheduled')),
  add constraint practice_round_fingerprint_check check(scenario_fingerprint ~ '^[a-f0-9]{64}$'),
  add constraint practice_round_candidate_number_key unique(user_id,candidate_key,round_number),
  add constraint practice_round_candidate_situation_key unique(user_id,candidate_key,scenario_fingerprint),
  add constraint practice_round_request_key unique(user_id,candidate_key,round_request_id);
create unique index practice_round_one_current on public.practice_drafts(user_id,candidate_key)
  where status in('open','retry_scheduled');
create index practice_round_retry_queue on public.practice_drafts(user_id,retry_due_at) where status in('open','retry_scheduled');
alter table public.attempts add constraint attempt_entry_round_check check(entry_round is null or entry_round>0);
alter table private.practice_promotion_receipts add column candidate_key text;
update private.practice_promotion_receipts r set candidate_key=coalesce(
  (select d.candidate_key from public.practice_drafts d where d.id=r.practice_draft_id),
  'deleted:'||r.practice_draft_id::text);
alter table private.practice_promotion_receipts alter column candidate_key set not null;
create unique index practice_promotion_one_candidate on private.practice_promotion_receipts(user_id,candidate_key);
update public.attempts a set entry_round=1 where exists(select 1 from private.practice_promotion_receipts r where r.attempt_id=a.id);

-- Patch the EFFECTIVE function, preserving 022's 10000-char and 023's modern
-- no-confidence fixes, all grounding, canonical copies and receipt replay.
do $$
declare definition text;
begin
  definition:=pg_get_functiondef('private.promote_valid_practice_draft_attempt_source_active(uuid,uuid,text,timestamptz,integer)'::regprocedure);
  if strpos(definition,'v_draft.status <> ''active''')=0 or strpos(definition,'set status = ''completed''')=0 then
    raise exception 'Unexpected effective promotion definition';
  end if;
  definition:=replace(definition,'v_draft.status <> ''active''','v_draft.status <> ''open''');
  definition:=replace(definition,'set status = ''completed''','set status = ''promoted''');
  definition:=replace(definition,'status = ''active''','status = ''open''');
  definition:=replace(definition,'if v_attempt.revision <> 1 or not v_attempt.passed then',
    'if v_attempt.revision <> 1 or not v_attempt.passed or not v_attempt.independent_use or v_attempt.assistance_level <> ''none'' or least(v_attempt.accuracy_score,v_attempt.naturalness_score,v_attempt.contextual_fit_score) < 3 then');
  definition:=replace(definition,'  select item.snapshot_id, artifact.content',
    '  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || v_draft.candidate_key,0));
  if v_draft.examples_opened_at is not null or exists(select 1 from private.practice_promotion_receipts r where r.user_id=p_user_id and r.candidate_key=v_draft.candidate_key) then
    raise exception using errcode=''40001'',message=''candidate already promoted or assisted'';
  end if;
  select item.snapshot_id, artifact.content');
  definition:=replace(definition,'practice_draft_attempt_id, user_id, practice_draft_id,','practice_draft_attempt_id, user_id, practice_draft_id, candidate_key,');
  definition:=replace(definition,'v_attempt.id, p_user_id, v_draft.id, p_normalized_expression_text','v_attempt.id, p_user_id, v_draft.id, v_draft.candidate_key, p_normalized_expression_text');
  definition:=replace(definition,'  return query select
    v_expression_sense_id,','  update public.attempts set entry_round=v_draft.round_number where id=v_attempt.id;
  update public.practice_tasks set situation_en=v_draft.situation_en,interlocutor=v_draft.interlocutor,task_en=v_draft.task_en,target_function=v_draft.target_function,target_setting=v_draft.target_setting,scenario_source=v_draft.scenario_source where id=v_draft.id;
  return query select
    v_expression_sense_id,');
  execute definition;
end $$;

create function private.practice_round_answer(a public.practice_draft_attempts) returns jsonb
language sql stable set search_path=pg_catalog as $$
  select case when a.id is null then null else jsonb_build_object(
    'attemptId',a.id,'revision',a.revision,'text',a.response_chinese,'naturalVersion',a.natural_version,
    'evaluation',jsonb_build_object('passed',a.passed,'independentUse',a.independent_use,'assistanceLevel',a.assistance_level,
      'accuracy',jsonb_build_object('score',a.accuracy_score,'englishFeedback',a.accuracy_feedback_english),
      'naturalness',jsonb_build_object('score',a.naturalness_score,'englishFeedback',a.naturalness_feedback_english),
      'contextualFit',jsonb_build_object('score',a.contextual_fit_score,'englishFeedback',a.contextual_fit_feedback_english))) end
$$;
revoke all on function private.practice_round_answer(public.practice_draft_attempts) from public,anon,authenticated,service_role;

create function public.get_practice_round_state(p_user_id uuid,p_task_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare d public.practice_drafts%rowtype; a public.practice_draft_attempts%rowtype; latest public.practice_draft_attempts%rowtype; promotion jsonb;
begin
  select * into d from public.practice_drafts where id=p_task_id and user_id=p_user_id;
  if not found then return null;end if;
  select * into a from public.practice_draft_attempts where practice_draft_id=d.id and revision=1;
  select * into latest from public.practice_draft_attempts where practice_draft_id=d.id and revision>1 order by revision desc limit 1;
  select jsonb_build_object('userExpressionId',r.user_expression_id,'nextDueAt',r.due_at) into promotion
    from private.practice_promotion_receipts r where r.user_id=p_user_id and r.candidate_key=d.candidate_key;
  return jsonb_build_object('roundNumber',d.round_number,'status',d.status,'firstAnswer',private.practice_round_answer(a),
    'latestRevision',private.practice_round_answer(latest),'examplesOpened',d.examples_opened_at is not null,
    'promotion',promotion,'retryDueAt',d.retry_due_at);
end $$;

create function public.get_practice_candidate_state(p_user_id uuid,p_candidate_key text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object(
    'draft',(select to_jsonb(d) from public.practice_drafts d where d.user_id=p_user_id and d.candidate_key=p_candidate_key order by d.round_number desc limit 1),
    'promotion',(select jsonb_build_object('userExpressionId',r.user_expression_id) from private.practice_promotion_receipts r where r.user_id=p_user_id and r.candidate_key=p_candidate_key),
    'situations',coalesce((select jsonb_agg(d.prompt_chinese order by d.round_number) from public.practice_drafts d where d.user_id=p_user_id and d.candidate_key=p_candidate_key),'[]'::jsonb))
$$;

create function public.create_practice_round(p_user_id uuid,p_draft jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare incoming public.practice_drafts%rowtype; current_draft public.practice_drafts%rowtype; existing public.practice_drafts%rowtype; promoted uuid; n integer; inherited_due timestamptz;
begin
  incoming:=jsonb_populate_record(null::public.practice_drafts,p_draft);
  if p_user_id is null or incoming.user_id is distinct from p_user_id or incoming.candidate_key is null then raise exception using errcode='22023',message='invalid round';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||incoming.candidate_key,0));
  select user_expression_id into promoted from private.practice_promotion_receipts where user_id=p_user_id and candidate_key=incoming.candidate_key;
  if found then return jsonb_build_object('promoted',promoted);end if;
  if p_request_id is not null then
    select * into existing from public.practice_drafts where user_id=p_user_id and candidate_key=incoming.candidate_key and round_request_id=p_request_id;
    if found then return jsonb_build_object('draft',to_jsonb(existing),'created',false);end if;
  end if;
  select * into current_draft from public.practice_drafts where user_id=p_user_id and candidate_key=incoming.candidate_key order by round_number desc limit 1 for update;
  if found and current_draft.status='open' then return jsonb_build_object('draft',to_jsonb(current_draft),'created',false);end if;
  n:=coalesce(current_draft.round_number,0)+1;inherited_due:=current_draft.retry_due_at;
  -- Do not supersede an existing round until the complete new scenario can commit.
  if current_draft.id is not null then update public.practice_drafts set status='superseded',updated_at=incoming.created_at where id=current_draft.id and status in('retry_scheduled','removed');end if;
  insert into public.practice_drafts(id,user_id,video_source_id,saved_item_id,candidate_artifact_id,candidate_index,future_user_expression_id,
    native_language,target_language,target_expression,prompt_chinese,instructions_english,goal_english,status,
    activation_prompt_version,activation_model,activation_gateway_config_id,activation_gateway_revision,activation_gateway_fingerprint,
    created_at,updated_at,candidate_key,round_number,previous_draft_id,retry_due_at,round_request_id,
    situation_en,interlocutor,task_en,target_function,target_setting,scenario_source,scenario_fingerprint)
  values(incoming.id,p_user_id,incoming.video_source_id,incoming.saved_item_id,incoming.candidate_artifact_id,incoming.candidate_index,incoming.future_user_expression_id,
    incoming.native_language,incoming.target_language,incoming.target_expression,incoming.prompt_chinese,incoming.instructions_english,incoming.goal_english,'open',
    incoming.activation_prompt_version,incoming.activation_model,incoming.activation_gateway_config_id,incoming.activation_gateway_revision,incoming.activation_gateway_fingerprint,
    incoming.created_at,incoming.updated_at,incoming.candidate_key,n,current_draft.id,inherited_due,p_request_id,
    incoming.situation_en,incoming.interlocutor,incoming.task_en,incoming.target_function,incoming.target_setting,incoming.scenario_source,private.practice_situation_fingerprint(incoming.prompt_chinese)) returning * into existing;
  return jsonb_build_object('draft',to_jsonb(existing),'created',true);
end $$;

create function public.record_practice_round_attempt(p_user_id uuid,p_attempt jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare a public.practice_draft_attempts%rowtype; d public.practice_drafts%rowtype; existing public.practice_draft_attempts%rowtype; n integer;
begin
  a:=jsonb_populate_record(null::public.practice_draft_attempts,p_attempt);
  select * into d from public.practice_drafts where id=a.practice_draft_id and user_id=p_user_id;
  if not found or a.user_id is distinct from p_user_id or a.future_user_expression_id is distinct from d.future_user_expression_id then raise exception using errcode='22023',message='owned round not found';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||d.candidate_key,0));
  select * into d from public.practice_drafts where id=d.id for update;
  if a.revision=1 then
    select * into existing from public.practice_draft_attempts where practice_draft_id=d.id and revision=1;
    if found then return jsonb_build_object('attempt',to_jsonb(existing),'conflict',existing.response_chinese<>a.response_chinese);end if;
  end if;
  if d.status not in('open','retry_scheduled','promoted') then raise exception using errcode='40001',message='round is stale';end if;
  if a.revision=1 and d.status<>'open' then raise exception using errcode='40001',message='first answer exists';end if;
  select coalesce(max(revision),0)+1 into n from public.practice_draft_attempts where practice_draft_id=d.id;
  if a.revision<>1 and n=1 then raise exception using errcode='22023',message='revision needs first answer';end if;
  a.revision:=n;a.assistance_level:=case when d.examples_opened_at is null then 'none' else 'model_answer' end;
  a.passed:=least(a.accuracy_score,a.naturalness_score,a.contextual_fit_score)>=3;
  a.independent_use:=a.passed and a.assistance_level='none';
  if least(a.accuracy_score,a.naturalness_score,a.contextual_fit_score)=5 then a.natural_version:=null;end if;
  insert into public.practice_draft_attempts select a.*;
  if n=1 then
    if a.independent_use then
      perform public.promote_valid_practice_draft_attempt(p_user_id,a.id,normalize(btrim(d.target_expression),NFKC),a.submitted_at+interval '24 hours',1);
    else
      update public.practice_drafts set status='retry_scheduled',retry_due_at=a.submitted_at+interval '24 hours',updated_at=a.submitted_at where id=d.id;
    end if;
  end if;
  return jsonb_build_object('attempt',to_jsonb(a),'conflict',false);
end $$;

create function public.change_practice_round(p_user_id uuid,p_task_id uuid,p_action text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare d public.practice_drafts%rowtype; moment timestamptz:=clock_timestamp();
begin
  select * into d from public.practice_drafts where id=p_task_id and user_id=p_user_id;
  if not found then return null;end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||d.candidate_key,0));
  select * into d from public.practice_drafts where id=p_task_id and user_id=p_user_id for update;
  if p_action='examples' then
    -- An already recorded first answer keeps its evidence, even if examples are
    -- opened afterwards. Subsequent revisions can still be marked as assisted.
    update public.practice_drafts set examples_opened_at=coalesce(examples_opened_at,moment) where id=d.id;
    return jsonb_build_object('examplesOpened',true);
  elsif p_action='remove' then
    if d.status='removed' then return jsonb_build_object('roundState',public.get_practice_round_state(p_user_id,d.id),'undoUntil',d.removed_at+interval '5 seconds');end if;
    if d.status not in('open','retry_scheduled') then raise exception using errcode='40001',message='round cannot be removed';end if;
    update public.practice_drafts set status_before_remove=status,status='removed',removed_at=moment,updated_at=moment where id=d.id;
    return jsonb_build_object('roundState',public.get_practice_round_state(p_user_id,d.id),'undoUntil',moment+interval '5 seconds');
  elsif p_action='restore' then
    if d.status in('open','retry_scheduled') and d.removed_at is not null then return jsonb_build_object('roundState',public.get_practice_round_state(p_user_id,d.id));end if;
    if d.status<>'removed' or d.removed_at+interval '5 seconds'<moment or d.status_before_remove is null
      or exists(select 1 from public.practice_drafts newer where newer.user_id=p_user_id and newer.candidate_key=d.candidate_key and newer.round_number>d.round_number)
      or exists(select 1 from private.practice_promotion_receipts r where r.user_id=p_user_id and r.candidate_key=d.candidate_key)
      then raise exception using errcode='40001',message='Undo is no longer available';end if;
    update public.practice_drafts set status=d.status_before_remove,updated_at=moment where id=d.id;
    return jsonb_build_object('roundState',public.get_practice_round_state(p_user_id,d.id));
  end if;
  raise exception using errcode='22023',message='invalid action';
end $$;

create function public.open_due_practice_examples(p_user_id uuid,p_review_task_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare r public.review_tasks%rowtype;
begin
  select * into r from public.review_tasks where id=p_review_task_id and user_id=p_user_id for update;
  if not found or r.status='cancelled' then return null;end if;
  if r.status='pending' then update public.review_tasks set examples_opened_at=coalesce(examples_opened_at,clock_timestamp()) where id=r.id;end if;
  return jsonb_build_object('examplesOpened',true);
end $$;
create function public.get_due_practice_assistance(p_user_id uuid,p_review_task_id uuid) returns text
language sql stable security definer set search_path=pg_catalog as $$
  select case when r.examples_opened_at is null then 'none' else 'model_answer' end from public.review_tasks r where r.id=p_review_task_id and r.user_id=p_user_id
$$;

-- All entry points are server-only; existing public table RLS remains intact.
do $$ declare signature regprocedure;
begin
  foreach signature in array array[
    'public.get_practice_round_state(uuid,uuid)'::regprocedure,
    'public.get_practice_candidate_state(uuid,text)'::regprocedure,
    'public.create_practice_round(uuid,jsonb,uuid)'::regprocedure,
    'public.record_practice_round_attempt(uuid,jsonb)'::regprocedure,
    'public.change_practice_round(uuid,uuid,text)'::regprocedure,
    'public.open_due_practice_examples(uuid,uuid)'::regprocedure,
    'public.get_due_practice_assistance(uuid,uuid)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public,anon,authenticated',signature);
    execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;
