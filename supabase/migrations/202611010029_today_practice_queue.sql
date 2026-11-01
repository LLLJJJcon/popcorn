-- One read-only owner-scoped pool feeds exact counts, paged lists and next.
-- No model/provider/learning writes occur in these functions.
create function private.today_candidate_id(p_user_id uuid,p_candidate_key text) returns uuid
language plpgsql immutable strict set search_path=pg_catalog as $$
declare bytes bytea;
begin
 bytes:=substring(extensions.digest(convert_to('today-candidate-v1:'||p_user_id::text||':'||p_candidate_key,'UTF8'),'sha256') from 1 for 16);
 bytes:=set_byte(bytes,6,(get_byte(bytes,6)&15)|80);bytes:=set_byte(bytes,8,(get_byte(bytes,8)&63)|128);
 return encode(bytes,'hex')::uuid;
end $$;

create function private.today_valid_card(c jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog as $$
declare field text; value jsonb; modern boolean;
begin
 if jsonb_typeof(c) is distinct from 'object' then return false;end if;
 foreach field in array array['expression','englishMeaning','englishExplanation','tone','communicativeFunction','register','evidenceText'] loop
  if jsonb_typeof(c->field) is distinct from 'string' or length(btrim(c->>field))=0 then return false;end if;
 end loop;
 if not private.is_target_chinese(c->>'expression',10000) or not private.is_target_chinese(c->>'evidenceText',10000) then return false;end if;
 if jsonb_typeof(c->'segmentIds') is distinct from 'array' then return false;end if;
 if jsonb_array_length(c->'segmentIds') not between 1 and 32 or exists(select 1 from jsonb_array_elements(c->'segmentIds') v where jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}') not between 1 and 200) then return false;end if;
 if jsonb_typeof(c->'startSeconds') is distinct from 'number' or jsonb_typeof(c->'endSeconds') is distinct from 'number' then return false;end if;
 if (c->>'startSeconds')::numeric<0 or (c->>'endSeconds')::numeric>(604800) or (c->>'endSeconds')::numeric<(c->>'startSeconds')::numeric then return false;end if;
 modern:=c ? 'meaningHere';
 if not modern then
  return private.is_target_chinese(c->>'expression',200) and private.is_target_chinese(c->>'evidenceText',2000)
   and private.is_basic_latin_english(c->>'englishMeaning',500) and private.is_basic_latin_english(c->>'englishExplanation',2000)
   and private.is_basic_latin_english(c->>'tone',200) and private.is_basic_latin_english(c->>'communicativeFunction',300) and private.is_basic_latin_english(c->>'register',200)
   and jsonb_typeof(c->'confidence')='number' and (c->>'confidence')::numeric between 0 and 1;
 end if;
 foreach field in array array['meaningHere','useItWhen','comparedWith','howItFits','toneAndWho'] loop
  if jsonb_typeof(c->field) is distinct from 'string' or not private.is_learning_card_prose(c->>field,2000)
   or cardinality(regexp_split_to_array(btrim(c->>field),'\s+'))>40 then return false;end if;
 end loop;
 if c->'watchOut' is distinct from 'null'::jsonb then
  if jsonb_typeof(c->'watchOut') is distinct from 'string' or not private.is_learning_card_prose(c->>'watchOut',2000) or cardinality(regexp_split_to_array(btrim(c->>'watchOut'),'\s+'))>40 then return false;end if;
 end if;
 if jsonb_typeof(c->'functionCategories') is distinct from 'array' or jsonb_typeof(c->'usageSettings') is distinct from 'array' then return false;end if;
 if jsonb_array_length(c->'functionCategories') not between 1 and 2 or jsonb_array_length(c->'usageSettings')>3 then return false;end if;
 if exists(select 1 from jsonb_array_elements_text(c->'functionCategories') v where v not in('emphasize','complain','praise','react','explain_sum_up','concede_contrast','suggest','connect_ideas','describe','other'))
  or exists(select 1 from jsonb_array_elements_text(c->'usageSettings') v where v not in('casual_chat','daily_errands','work_school','formal_writing','online_social')) then return false;end if;
 if c->>'suitability' not in('expression','not_expression') or c->>'suitability' is null then return false;end if;
 if c->>'suitability'='not_expression' and (not private.is_learning_card_prose(c->>'notExpressionReasonEn',2000) or c->>'notExpressionReasonEn' is null or cardinality(regexp_split_to_array(btrim(c->>'notExpressionReasonEn'),'\s+'))>40) then return false;end if;
 if c->'examples' is distinct from 'null'::jsonb then
  if jsonb_typeof(c->'examples') is distinct from 'array' then return false;end if;
  if jsonb_array_length(c->'examples')<>2 then return false;end if;
  for value in select * from jsonb_array_elements(c->'examples') loop
   if jsonb_typeof(value->'zh') is distinct from 'string' or not private.is_target_chinese(value->>'zh',30) or strpos(value->>'zh',c->>'expression')=0
    or jsonb_typeof(value->'en') is distinct from 'string' or not private.is_learning_card_prose(value->>'en',2000) or cardinality(regexp_split_to_array(btrim(value->>'en'),'\s+'))>40 then return false;end if;
  end loop;
 end if;
 return true;
end $$;

create function private.today_candidate_cards(p_user_id uuid)
returns table(candidate_key text,saved_item_id uuid,candidate_artifact_id uuid,candidate_index integer,source_id uuid,source_title text,captured_at timestamptz,visible boolean,card jsonb)
language sql stable set search_path=pg_catalog as $$
 with cards as (
  select case when jsonb_typeof(c.value->'highlightKey')='string' and length(c.value->>'highlightKey')>0
    then 'h:'||s.id::text||':'||encode(extensions.digest(convert_to(c.value->>'highlightKey','UTF8'),'sha256'),'hex')
    else 'l:'||s.id::text||':'||a.id::text||':'||(c.ordinality-1)::text end as key,
   s.id as save_id,a.id as artifact_id,(c.ordinality-1)::integer as idx,s.video_source_id,s.captured_at,s.removed_from_saved_at is null as visible,c.value,a.created_at,
   (select v.title from public.video_snapshots v where v.user_id=p_user_id and v.video_source_id=s.video_source_id order by v.captured_at desc,v.id desc limit 1) as title
  from public.saved_items s join public.generated_artifacts a on a.user_id=p_user_id and a.saved_item_id=s.id and a.video_source_id=s.video_source_id and a.artifact_type='saved_item_analysis'
  cross join lateral jsonb_array_elements(case when jsonb_typeof(a.content->'candidates')='array' then a.content->'candidates' else '[]'::jsonb end) with ordinality c
  where s.user_id=p_user_id and a.prompt_version in('analyze-saved-item-v1','analyze-saved-item-v2','analyze-saved-item-v3') and private.today_valid_card(c.value)
 ) select distinct on(key) key,save_id,artifact_id,idx,video_source_id,title,captured_at,visible,value from cards order by key,created_at desc,artifact_id desc
$$;

create function private.today_needs_analysis(p_user_id uuid) returns table(saved_item_id uuid,source_id uuid)
language sql stable set search_path=pg_catalog as $$
 with cards as materialized(select * from private.today_candidate_cards(p_user_id))
 select s.id,s.video_source_id from public.saved_items s
 where s.user_id=p_user_id and s.removed_from_saved_at is null and s.status='ready' and s.kind<>'video'
 and exists(select 1 from public.saved_item_highlights h where h.user_id=p_user_id and h.saved_item_id=s.id and h.status='active'
  and not exists(select 1 from cards c where c.saved_item_id=s.id and (c.card->>'highlightId'=h.id::text or c.card->>'highlightKey'=(
   select '['||string_agg(v.value::text,',' order by v.ordinality)||']' from jsonb_array_elements(jsonb_build_array(h.start_segment_id,h.start_offset,h.end_segment_id,h.end_offset,h.text)) with ordinality v))))
$$;

create function private.today_candidate_rows(p_user_id uuid,p_now timestamptz)
returns table(id uuid,source_id uuid,sort_at timestamptz,item jsonb,eligible boolean,resumable boolean,task_id uuid)
language sql stable set search_path=pg_catalog as $$
 select private.today_candidate_id(p_user_id,c.candidate_key),c.source_id,
  case when d.status='retry_scheduled' or d.round_number>=2 then d.retry_due_at else c.captured_at end,
  jsonb_build_object('id',private.today_candidate_id(p_user_id,c.candidate_key),'kind',case when d.status='retry_scheduled' or d.round_number>=2 then 'second_try' else 'new' end,
   'expression',c.card->>'expression','meaningHere',coalesce(c.card->>'meaningHere',c.card->>'englishMeaning'),'mastery',null,
   'dueAt',case when d.round_number>=2 or d.status='retry_scheduled' then d.retry_due_at else null end,
   'overdueDays',case when d.retry_due_at is null then 0 else greatest(0,floor(extract(epoch from p_now-d.retry_due_at)/86400))::integer end,
   'roundNumber',case when d.status='retry_scheduled' then d.round_number+1 else d.round_number end,'sourceVideoTitle',c.source_title,'sourceId',c.source_id,
   'selection',jsonb_build_object('savedItemId',c.saved_item_id,'candidateArtifactId',c.candidate_artifact_id,'candidateIndex',c.candidate_index),
   'currentTaskId',d.id,'roundStatus',case when d.status in('open','retry_scheduled') then d.status else null end),
  r.user_expression_id is null and ((d.id is null and c.visible and c.card->>'suitability'='expression')
    or (d.status='open' and d.round_number=1 and not exists(select 1 from public.practice_draft_attempts a where a.user_id=p_user_id and a.practice_draft_id=d.id and a.revision=1))
    or ((d.status='retry_scheduled' or(d.status='open' and d.round_number>=2)) and d.retry_due_at<=p_now)),
  r.user_expression_id is null and d.status='open' and not exists(select 1 from public.practice_draft_attempts a where a.user_id=p_user_id and a.practice_draft_id=d.id and a.revision=1),d.id
 from private.today_candidate_cards(p_user_id) c
 left join lateral(select draft.* from public.practice_drafts draft where draft.user_id=p_user_id and draft.candidate_key=c.candidate_key order by draft.round_number desc limit 1) d on true
 left join private.practice_promotion_receipts r on r.user_id=p_user_id and r.candidate_key=c.candidate_key
$$;

create function private.today_practice_rows(p_user_id uuid,p_now timestamptz) returns table(id uuid,source_id uuid,sort_at timestamptz,priority integer,item jsonb)
language sql stable set search_path=pg_catalog as $$
 select r.id,s.video_source_id,r.due_at,0,jsonb_build_object('id',r.id,'kind','review','reviewTaskId',r.id,'userExpressionId',e.id,'expression',s.expression_text,'meaningHere',coalesce(s.meaning_here,s.english_meaning),
  'mastery',r.mastery_state,'dueAt',r.due_at,'overdueDays',greatest(0,floor(extract(epoch from p_now-r.due_at)/86400))::integer,'roundNumber',null,'sourceId',s.video_source_id,
  'sourceVideoTitle',(select v.title from public.video_snapshots v where v.user_id=p_user_id and v.video_source_id=s.video_source_id order by v.captured_at desc,v.id desc limit 1))
 from public.review_tasks r join public.user_expressions e on e.id=r.user_expression_id and e.user_id=p_user_id
 join public.expression_senses s on s.id=e.expression_sense_id and s.user_id=p_user_id
 where r.user_id=p_user_id and r.status='pending' and r.due_at<=p_now
 union all select c.id,c.source_id,c.sort_at,case when c.item->>'kind'='second_try' then 1 else 2 end,c.item from private.today_candidate_rows(p_user_id,p_now) c where c.eligible
$$;

create function public.get_today_practice_summary(p_user_id uuid,p_now timestamptz) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 with queue as materialized(select * from private.today_practice_rows(p_user_id,p_now)), future as (
  select r.due_at as due from public.review_tasks r where r.user_id=p_user_id and r.status='pending' and r.due_at>p_now
  union all select d.retry_due_at from public.practice_drafts d where d.user_id=p_user_id and d.status in('open','retry_scheduled') and d.retry_due_at>p_now
   and not exists(select 1 from private.practice_promotion_receipts r where r.user_id=p_user_id and r.candidate_key=d.candidate_key)
 ) select jsonb_build_object('reviewCount',count(*) filter(where priority=0),'secondTryCount',count(*) filter(where priority=1),'newCount',count(*) filter(where priority=2),'estimatedMinutes',count(*)*2,
  'needsAnalysisCount',(select count(*) from private.today_needs_analysis(p_user_id)),
  'processingCount',(select count(*) from public.saved_items s where s.user_id=p_user_id and s.removed_from_saved_at is null and s.status in('saved','resolving_source','organizing','failed')),
  'nextPracticeAt',(select min(due) from future)) from queue
$$;

create function public.list_today_practice_items(p_user_id uuid,p_now timestamptz,p_offset integer,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if p_user_id is null or p_now is null or not isfinite(p_now) or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 200 then raise exception using errcode='22023',message='invalid today page';end if;
 return(select coalesce(jsonb_agg(q.item),'[]'::jsonb) from(select item from private.today_practice_rows(p_user_id,p_now) order by priority,case when priority<2 then sort_at end asc,case when priority=2 then sort_at end desc,id offset p_offset limit p_limit) q);
end $$;

create function public.get_today_practice_next(p_user_id uuid,p_now timestamptz,p_exclude uuid[],p_current_item_id uuid,p_current_task_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb; current_item jsonb; current_id uuid; remaining integer;
begin
 if p_user_id is null or p_now is null or not isfinite(p_now) then raise exception using errcode='22023',message='invalid today next';end if;
 if p_current_item_id is not null and p_current_task_id is not null then
  select c.item,c.id into current_item,current_id from private.today_candidate_rows(p_user_id,p_now) c where c.id=p_current_item_id and c.task_id=p_current_task_id and c.resumable limit 1;
  if current_item is null then
   select q.item,q.id into current_item,current_id from private.today_practice_rows(p_user_id,p_now) q
    join public.practice_tasks t on t.user_id=p_user_id and t.id=p_current_task_id and t.review_task_id=q.id and t.kind='due_practice'
    where q.id=p_current_item_id and q.priority=0 limit 1;
  end if;
 end if;
 with queue as materialized(select * from private.today_practice_rows(p_user_id,p_now) where not(id=any(coalesce(p_exclude,'{}'::uuid[]))))
 select count(*)::integer,(select item from queue order by priority,case when priority<2 then sort_at end asc,case when priority=2 then sort_at end desc,id limit 1)
 into remaining,result from queue;
 if current_item is not null then
  if not exists(select 1 from private.today_practice_rows(p_user_id,p_now) q where q.id=current_id and not(q.id=any(coalesce(p_exclude,'{}'::uuid[])))) then remaining:=remaining+1;end if;
  result:=current_item;
 end if;
 return jsonb_build_object('summary',public.get_today_practice_summary(p_user_id,p_now),'item',result,'remainingCount',remaining,'resumed',current_item is not null);
end $$;

create function public.list_today_practice_videos(p_user_id uuid,p_now timestamptz,p_needs_analysis_only boolean,p_offset integer,p_limit integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if p_user_id is null or p_now is null or not isfinite(p_now) or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 200 then raise exception using errcode='22023',message='invalid today video page';end if;
 return(with needs as materialized(select * from private.today_needs_analysis(p_user_id)), queue as materialized(select * from private.today_practice_rows(p_user_id,p_now)), videos as (
  select s.video_source_id,count(*) as saved_count,max(s.captured_at) as latest_at,
   case when bool_or(s.status='unsupported') then 'unsupported' when bool_or(s.status='failed') then 'failed' when bool_or(s.status in('saved','resolving_source','organizing')) then 'organizing' else 'ready' end as state
  from public.saved_items s where s.user_id=p_user_id and s.removed_from_saved_at is null group by s.video_source_id
 ), page as (
  select jsonb_build_object('sourceId',v.video_source_id,'youtubeVideoId',source.youtube_video_id,'canonicalUrl',source.canonical_url,
   'title',coalesce(snapshot.title,'Saved YouTube video'),'channel',coalesce(snapshot.channel,'YouTube'),
   'thumbnailUrl',coalesce(snapshot.thumbnail_url,'https://i.ytimg.com/vi/'||source.youtube_video_id||'/hqdefault.jpg'),
   'savedCount',v.saved_count,'latestSavedAt',v.latest_at,'processingState',v.state,
   'practiceCount',(select count(*) from queue q where q.source_id=v.video_source_id),'needsAnalysisCount',(select count(*) from needs n where n.source_id=v.video_source_id)) as item
  from videos v join public.video_sources source on source.id=v.video_source_id and source.user_id=p_user_id
  left join lateral(select x.title,x.channel,x.thumbnail_url from public.video_snapshots x where x.user_id=p_user_id and x.video_source_id=v.video_source_id order by x.captured_at desc,x.id desc limit 1) snapshot on true
  where not coalesce(p_needs_analysis_only,false) or exists(select 1 from needs n where n.source_id=v.video_source_id)
  order by v.latest_at desc,v.video_source_id offset p_offset limit p_limit
 ) select coalesce(jsonb_agg(item),'[]'::jsonb) from page);
end $$;

do $$ declare f regprocedure;
begin
 foreach f in array array[
 'private.today_candidate_id(uuid,text)'::regprocedure,'private.today_valid_card(jsonb)'::regprocedure,'private.today_candidate_cards(uuid)'::regprocedure,
 'private.today_needs_analysis(uuid)'::regprocedure,'private.today_candidate_rows(uuid,timestamptz)'::regprocedure,'private.today_practice_rows(uuid,timestamptz)'::regprocedure
 ] loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f);end loop;
 foreach f in array array[
 'public.get_today_practice_summary(uuid,timestamptz)'::regprocedure,'public.list_today_practice_items(uuid,timestamptz,integer,integer)'::regprocedure,
 'public.get_today_practice_next(uuid,timestamptz,uuid[],uuid,uuid)'::regprocedure,'public.list_today_practice_videos(uuid,timestamptz,boolean,integer,integer)'::regprocedure
 ] loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;
end $$;
