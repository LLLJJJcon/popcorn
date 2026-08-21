create function private.normalize_expression_search_text(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select pg_catalog.regexp_replace(
    pg_catalog."normalize"(p_value, 'NFKC'),
    '[[:space:][:punct:]]+',
    '',
    'g'
  )
$$;

revoke all on function private.normalize_expression_search_text(text) from public;

create index expression_senses_normalized_text_trgm_idx
  on public.expression_senses
  using gin (normalized_expression_text extensions.gin_trgm_ops);

create function public.search_expressions(
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
        when v_target_query <> '' and es.normalized_expression_text = v_target_query then 0
        when v_target_query <> '' and pg_catalog.starts_with(es.normalized_expression_text, v_target_query) then 1
        when v_target_query <> '' and pg_catalog.strpos(es.normalized_expression_text, v_target_query) > 0 then 2
        when v_target_query <> '' and extensions.similarity(es.normalized_expression_text, v_target_query) >= 0.2 then 3
        when pg_catalog.strpos(pg_catalog.lower(es.english_meaning), v_english_query) > 0 then 4
        when pg_catalog.strpos(pg_catalog.lower(es.communicative_function), v_english_query) > 0 then 5
        when pg_catalog.strpos(pg_catalog.lower(es.register), v_english_query) > 0 then 6
        else null
      end as match_rank,
      case
        when v_query = '' then 'recent'
        when v_target_query <> '' and es.normalized_expression_text = v_target_query then 'exact'
        when v_target_query <> '' and pg_catalog.starts_with(es.normalized_expression_text, v_target_query) then 'prefix'
        when v_target_query <> '' and pg_catalog.strpos(es.normalized_expression_text, v_target_query) > 0 then 'substring'
        when v_target_query <> '' and extensions.similarity(es.normalized_expression_text, v_target_query) >= 0.2 then 'trigram'
        when pg_catalog.strpos(pg_catalog.lower(es.english_meaning), v_english_query) > 0 then 'english_meaning'
        when pg_catalog.strpos(pg_catalog.lower(es.communicative_function), v_english_query) > 0 then 'communicative_function'
        when pg_catalog.strpos(pg_catalog.lower(es.register), v_english_query) > 0 then 'register'
        else null
      end as candidate_match_reason,
      case when v_target_query = '' then 0::real
        else extensions.similarity(es.normalized_expression_text, v_target_query)
      end as trigram_score
    from public.user_expressions as ue
    join public.expression_senses as es
      on es.id = ue.expression_sense_id
      and es.user_id = p_user_id
    where ue.user_id = p_user_id
      and (p_communicative_function is null
        or pg_catalog.lower(es.communicative_function) = pg_catalog.lower(p_communicative_function))
      and (p_register is null
        or pg_catalog.lower(es.register) = pg_catalog.lower(p_register))
      and (p_video_source_id is null or es.video_source_id = p_video_source_id)
      and (p_mastery_state is null or ue.mastery_state = p_mastery_state)
      and (p_created_from is null or ue.created_at >= p_created_from)
      and (p_created_before is null or ue.created_at < p_created_before)
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
        and sibling.normalized_expression_text = owned_sense.normalized_expression_text
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

revoke all on function public.search_expressions(
  uuid, text, text, text, uuid, text, timestamptz, timestamptz, integer
) from public, anon, authenticated;
grant execute on function public.search_expressions(
  uuid, text, text, text, uuid, text, timestamptz, timestamptz, integer
) to service_role;

comment on function public.search_expressions(
  uuid, text, text, text, uuid, text, timestamptz, timestamptz, integer
) is
  'Returns a bounded, owner-scoped relational Vault search ordered by exact, lexical, trigram, metadata, and recency evidence.';
