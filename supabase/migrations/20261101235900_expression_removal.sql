-- Removal is a library preference, independent of immutable model artifacts/history.
alter table public.saved_items add column if not exists removed_expression_keys text[] not null default '{}';
alter table public.user_expressions add column if not exists removed_from_vault_at timestamptz;

create or replace function public.remove_saved_expression(p_user_id uuid, p_saved_item_id uuid, p_artifact_id uuid, p_candidate_index integer)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare v_keys text[]; v_content jsonb; v_candidate jsonb; v_key text;
begin
  if p_candidate_index is null or p_candidate_index < 0 then return null; end if;
  select saved.removed_expression_keys into v_keys from public.saved_items saved
    where saved.id=p_saved_item_id and saved.user_id=p_user_id and saved.removed_from_saved_at is null for update;
  if not found then return null; end if;
  select artifact.content into v_content from public.generated_artifacts artifact
    where artifact.id=p_artifact_id and artifact.user_id=p_user_id
      and artifact.saved_item_id=p_saved_item_id and artifact.artifact_type='saved_item_analysis';
  if not found or jsonb_typeof(v_content->'candidates') is distinct from 'array' then return null; end if;
  if p_candidate_index >= jsonb_array_length(v_content->'candidates') then return null; end if;
  v_candidate := v_content->'candidates'->p_candidate_index;
  v_key := coalesce(v_candidate->>'highlightKey', 'legacy:' || (v_candidate->>'expression'));
  if v_key is null or v_key='' then return null; end if;
  if not (v_key=any(v_keys)) then
    update public.saved_items set removed_expression_keys=array_append(v_keys,v_key)
      where id=p_saved_item_id and user_id=p_user_id;
  end if;
  return v_key;
end $$;

create or replace function public.remove_vault_expression(p_user_id uuid, p_user_expression_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
begin
  -- Match review completion's review-before-expression lock order.
  perform 1 from public.review_tasks review where review.user_id=p_user_id
    and review.user_expression_id=p_user_expression_id order by review.id for update;
  update public.user_expressions set removed_from_vault_at=coalesce(removed_from_vault_at,now()),updated_at=now()
    where id=p_user_expression_id and user_id=p_user_id;
  if not found then return false; end if;
  update public.review_tasks set status='cancelled',updated_at=now()
    where user_id=p_user_id and user_expression_id=p_user_expression_id and status='pending';
  return true;
end $$;

revoke all on function public.remove_saved_expression(uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.remove_vault_expression(uuid,uuid) from public,anon,authenticated;
grant execute on function public.remove_saved_expression(uuid,uuid,uuid,integer) to service_role;
grant execute on function public.remove_vault_expression(uuid,uuid) to service_role;

-- Load the extension GUC before attaching its threshold on a fresh session.
do $$ begin perform extensions.similarity('',''); end $$;

-- Deleted Vault entries cannot leak back through search.
create or replace function public.search_expressions(
  p_user_id uuid,
  p_query text default '',
  p_communicative_function text default null,
  p_register text default null,
  p_video_source_id uuid default null,
  p_mastery_state text default null,
  p_created_from timestamptz default null,
  p_created_before timestamptz default null,
  p_limit integer default 20
)
returns table (
  user_expression_id uuid,
  expression_sense_id uuid,
  expression_text text,
  english_meaning text,
  communicative_function text,
  register text,
  mastery_state text,
  source_count bigint,
  updated_at timestamptz,
  match_reason text
)
language plpgsql
security definer
set search_path = pg_catalog
set pg_trgm.similarity_threshold = 0.2
as $$
declare
  v_query text;
  v_target_query text;
  v_english_query text;
begin
  if p_user_id is null
    or p_query is null
    or pg_catalog.char_length(p_query) > 200
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
    or (p_mastery_state is not null and p_mastery_state not in ('tried', 'reused', 'owned'))
    or (p_communicative_function is not null and (
      p_communicative_function <> pg_catalog.btrim(p_communicative_function)
      or pg_catalog.char_length(p_communicative_function) not between 1 and 300
    ))
    or (p_register is not null and (
      p_register <> pg_catalog.btrim(p_register)
      or pg_catalog.char_length(p_register) not between 1 and 200
    ))
    or (p_created_from is not null and p_created_before is not null
      and p_created_from >= p_created_before)
  then
    raise exception using errcode = '22023', message = 'invalid expression search parameters';
  end if;

  v_query := pg_catalog.btrim(p_query);
  v_target_query := private.normalize_expression_search_text(v_query);
  v_english_query := pg_catalog.lower(v_query);

  return query
  with candidates as (
    select
      ue.id as candidate_user_expression_id,
      es.id as candidate_expression_sense_id,
      es.expression_text as candidate_expression_text,
      es.english_meaning as candidate_english_meaning,
      es.communicative_function as candidate_communicative_function,
      es.register as candidate_register,
      ue.mastery_state as candidate_mastery_state,
      ue.updated_at as candidate_updated_at,
      case
        when v_query = '' then 7
        when v_target_query <> '' and private.normalize_expression_search_text(es.normalized_expression_text) = v_target_query then 0
        when v_target_query <> '' and pg_catalog.starts_with(private.normalize_expression_search_text(es.normalized_expression_text), v_target_query) then 1
        when v_target_query <> '' and pg_catalog.strpos(private.normalize_expression_search_text(es.normalized_expression_text), v_target_query) > 0 then 2
        when v_target_query <> '' and private.normalize_expression_search_text(es.normalized_expression_text) OPERATOR(extensions.%) v_target_query then 3
        when pg_catalog.strpos(pg_catalog.lower(es.english_meaning), v_english_query) > 0 then 4
        when pg_catalog.strpos(pg_catalog.lower(es.communicative_function), v_english_query) > 0 then 5
        when pg_catalog.strpos(pg_catalog.lower(es.register), v_english_query) > 0 then 6
        else null
      end as match_rank,
      case
        when v_query = '' then 'recent'
        when v_target_query <> '' and private.normalize_expression_search_text(es.normalized_expression_text) = v_target_query then 'exact'
        when v_target_query <> '' and pg_catalog.starts_with(private.normalize_expression_search_text(es.normalized_expression_text), v_target_query) then 'prefix'
        when v_target_query <> '' and pg_catalog.strpos(private.normalize_expression_search_text(es.normalized_expression_text), v_target_query) > 0 then 'substring'
        when v_target_query <> '' and private.normalize_expression_search_text(es.normalized_expression_text) OPERATOR(extensions.%) v_target_query then 'trigram'
        when pg_catalog.strpos(pg_catalog.lower(es.english_meaning), v_english_query) > 0 then 'english_meaning'
        when pg_catalog.strpos(pg_catalog.lower(es.communicative_function), v_english_query) > 0 then 'communicative_function'
        when pg_catalog.strpos(pg_catalog.lower(es.register), v_english_query) > 0 then 'register'
        else null
      end as candidate_match_reason,
      case when v_target_query = '' then 0::real
        else extensions.similarity(private.normalize_expression_search_text(es.normalized_expression_text), v_target_query)
      end as trigram_score
    from public.user_expressions as ue
    join public.expression_senses as es
      on es.id = ue.expression_sense_id
      and es.user_id = p_user_id
    where ue.user_id = p_user_id
      and ue.removed_from_vault_at is null
      and (p_communicative_function is null
        or pg_catalog.lower(es.communicative_function) = pg_catalog.lower(p_communicative_function))
      and (p_register is null
        or pg_catalog.lower(es.register) = pg_catalog.lower(p_register))
      and (p_video_source_id is null or es.video_source_id = p_video_source_id)
      and (p_mastery_state is null or ue.mastery_state = p_mastery_state)
      and (p_created_from is null or ue.created_at >= p_created_from)
      and (p_created_before is null or ue.created_at < p_created_before)
      and (
        v_query = ''
        or (v_target_query <> '' and (
          private.normalize_expression_search_text(es.normalized_expression_text) = v_target_query
          or pg_catalog.starts_with(private.normalize_expression_search_text(es.normalized_expression_text), v_target_query)
          or pg_catalog.strpos(private.normalize_expression_search_text(es.normalized_expression_text), v_target_query) > 0
          or private.normalize_expression_search_text(es.normalized_expression_text) OPERATOR(extensions.%) v_target_query
        ))
        or pg_catalog.strpos(pg_catalog.lower(es.english_meaning), v_english_query) > 0
        or pg_catalog.strpos(pg_catalog.lower(es.communicative_function), v_english_query) > 0
        or pg_catalog.strpos(pg_catalog.lower(es.register), v_english_query) > 0
      )
  )
  select
    candidate.candidate_user_expression_id,
    candidate.candidate_expression_sense_id,
    candidate.candidate_expression_text,
    candidate.candidate_english_meaning,
    candidate.candidate_communicative_function,
    candidate.candidate_register,
    candidate.candidate_mastery_state,
    (
      select pg_catalog.count(distinct sibling.video_source_id)
      from public.expression_senses as sibling
      where sibling.user_id = p_user_id
        and private.normalize_expression_search_text(sibling.normalized_expression_text)
          = private.normalize_expression_search_text(owned_sense.normalized_expression_text)
    ),
    candidate.candidate_updated_at,
    candidate.candidate_match_reason
  from candidates as candidate
  join public.expression_senses as owned_sense
    on owned_sense.id = candidate.candidate_expression_sense_id
    and owned_sense.user_id = p_user_id
  where candidate.match_rank is not null
  order by candidate.match_rank,
    case when candidate.match_rank = 3 then candidate.trigram_score else 0::real end desc,
    candidate.candidate_updated_at desc,
    candidate.candidate_user_expression_id
  limit p_limit;
end
$$;

-- Read-only history remains available, while live links and new activations
-- respect the user's library removals. Promotion receipts stay immutable.
create function private.saved_expression_is_removed(p_user_id uuid,p_saved_item_id uuid,p_card jsonb)
returns boolean language sql stable set search_path=pg_catalog as $$
 select exists(select 1 from public.saved_items s where s.user_id=p_user_id and s.id=p_saved_item_id
   and coalesce(p_card->>'highlightKey','legacy:'||(p_card->>'expression'))=any(s.removed_expression_keys))
$$;
revoke all on function private.saved_expression_is_removed(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.saved_expression_is_removed(uuid,uuid,jsonb) to service_role;

create or replace function public.get_practice_candidate_projection(p_user_id uuid,p_candidate_keys text[])
returns table(candidate_key text,task_id uuid,round_number integer,status text,user_expression_id uuid)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if p_user_id is null or p_candidate_keys is null or cardinality(p_candidate_keys)>200
   or exists(select 1 from unnest(p_candidate_keys) k where k is null or length(k) not between 1 and 256) then
   raise exception using errcode='22023',message='invalid candidate projection batch';end if;
 return query select requested.key,d.id,d.round_number,
   case when e.removed_from_vault_at is not null then 'vault_removed' else d.status end,r.user_expression_id
 from (select distinct unnest(p_candidate_keys) as key) requested
 left join lateral(select draft.id,draft.round_number,draft.status from public.practice_drafts draft
   where draft.user_id=p_user_id and draft.candidate_key=requested.key order by draft.round_number desc limit 1) d on true
 left join private.practice_promotion_receipts r on r.user_id=p_user_id and r.candidate_key=requested.key
 left join public.user_expressions e on e.user_id=p_user_id and e.id=r.user_expression_id;
end $$;
revoke all on function public.get_practice_candidate_projection(uuid,text[]) from public,anon,authenticated;
grant execute on function public.get_practice_candidate_projection(uuid,text[]) to service_role;

create or replace function public.get_practice_candidate_state(p_user_id uuid,p_candidate_key text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object(
 'draft',(select to_jsonb(d) from public.practice_drafts d where d.user_id=p_user_id and d.candidate_key=p_candidate_key order by d.round_number desc limit 1),
 'promotion',(select jsonb_build_object('userExpressionId',r.user_expression_id)
   ||case when e.removed_from_vault_at is not null then '{"removedFromVault":true}'::jsonb else '{}'::jsonb end
   from private.practice_promotion_receipts r join public.user_expressions e on e.id=r.user_expression_id and e.user_id=p_user_id
   where r.user_id=p_user_id and r.candidate_key=p_candidate_key),
 'situations',coalesce((select jsonb_agg(d.prompt_chinese order by d.round_number) from public.practice_drafts d where d.user_id=p_user_id and d.candidate_key=p_candidate_key),'[]'::jsonb))
$$;

do $$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('public.get_practice_round_state(uuid,uuid)'::regprocedure);
 anchor:='select jsonb_build_object(''userExpressionId'',r.user_expression_id,''nextDueAt'',r.due_at) into promotion';
 if strpos(definition,anchor)=0 then raise exception 'Round history projection anchor missing';end if;
 definition:=replace(definition,anchor,'select jsonb_build_object(''userExpressionId'',r.user_expression_id,''nextDueAt'',r.due_at)
   ||case when exists(select 1 from public.user_expressions e where e.user_id=p_user_id and e.id=r.user_expression_id and e.removed_from_vault_at is not null)
     then ''{"removedFromVault":true}''::jsonb else ''{}''::jsonb end into promotion');
 execute definition;

 definition:=pg_get_functiondef('private.today_candidate_rows(uuid,timestamptz)'::regprocedure);
 -- Filter the shared row source so counts, pages and next-item selection agree.
 anchor:='left join private.practice_promotion_receipts r on r.user_id=p_user_id and r.candidate_key=c.candidate_key';
 if strpos(definition,anchor)=0 then raise exception 'Today candidate projection anchor missing';end if;
 definition:=replace(definition,anchor,anchor||' where not private.saved_expression_is_removed(p_user_id,c.saved_item_id,c.card)');
 execute definition;

 definition:=pg_get_functiondef('public.get_today_practice_summary(uuid,timestamptz)'::regprocedure);
 anchor:='and not exists(select 1 from private.practice_promotion_receipts r where r.user_id=p_user_id and r.candidate_key=d.candidate_key)';
 if strpos(definition,anchor)=0 then raise exception 'Future practice summary anchor missing';end if;
 definition:=replace(definition,anchor,anchor||' and exists(select 1 from private.today_candidate_rows(p_user_id,p_now) candidate where candidate.task_id=d.id)');
 execute definition;

 definition:=pg_get_functiondef('public.create_practice_round(uuid,jsonb,uuid)'::regprocedure);
 anchor:='select user_expression_id into promoted from private.practice_promotion_receipts where user_id=p_user_id and candidate_key=incoming.candidate_key;';
 if strpos(definition,anchor)=0 then raise exception 'Round publication fence anchor missing';end if;
 definition:=replace(definition,anchor,'perform 1 from public.saved_items saved where saved.user_id=p_user_id and saved.id=incoming.saved_item_id for update;
   if private.saved_expression_is_removed(p_user_id,incoming.saved_item_id,(select artifact.content->''candidates''->incoming.candidate_index from public.generated_artifacts artifact where artifact.user_id=p_user_id and artifact.id=incoming.candidate_artifact_id)) then
     raise exception using errcode=''P0001'',message=''Saved expression was removed'';end if;
   if exists(select 1 from private.practice_promotion_receipts receipt join public.user_expressions e on e.id=receipt.user_expression_id and e.user_id=p_user_id where receipt.user_id=p_user_id and receipt.candidate_key=incoming.candidate_key and e.removed_from_vault_at is not null) then
     raise exception using errcode=''P0001'',message=''Vault expression was removed'';end if;
   '||anchor);
 execute definition;
end $$;
