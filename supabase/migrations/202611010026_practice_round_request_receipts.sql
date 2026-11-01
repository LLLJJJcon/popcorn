create table private.practice_round_requests(
  user_id uuid not null,
  candidate_key text not null,
  request_id uuid not null,
  practice_draft_id uuid not null,
  primary key(user_id,candidate_key,request_id),
  foreign key(practice_draft_id,user_id) references public.practice_drafts(id,user_id) on delete cascade
);
alter table private.practice_round_requests enable row level security;
revoke all on private.practice_round_requests from public,anon,authenticated,service_role;
insert into private.practice_round_requests(user_id,candidate_key,request_id,practice_draft_id)
select user_id,candidate_key,round_request_id,id from public.practice_drafts where round_request_id is not null;

create function private.practice_candidate_key(p_user_id uuid,p_save_id uuid,p_artifact_id uuid,p_index integer) returns text
language sql stable set search_path=pg_catalog as $$
  select case when a.content->'candidates'->p_index->>'highlightKey' is not null
    then 'h:'||p_save_id::text||':'||encode(extensions.digest(convert_to(a.content->'candidates'->p_index->>'highlightKey','UTF8'),'sha256'),'hex')
    else 'l:'||p_save_id::text||':'||p_artifact_id::text||':'||p_index::text end
  from public.generated_artifacts a where a.id=p_artifact_id and a.user_id=p_user_id and a.saved_item_id=p_save_id
$$;
revoke all on function private.practice_candidate_key(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function public.get_practice_round_request(p_user_id uuid,p_candidate_key text,p_request_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select to_jsonb(d) from private.practice_round_requests r join public.practice_drafts d on d.id=r.practice_draft_id
 where r.user_id=p_user_id and r.candidate_key=p_candidate_key and r.request_id=p_request_id
$$;
revoke all on function public.get_practice_round_request(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.get_practice_round_request(uuid,text,uuid) to service_role;

do $$ declare definition text;
begin
 definition:=pg_get_functiondef('public.create_practice_round(uuid,jsonb,uuid)'::regprocedure);
 definition:=replace(definition,'incoming:=jsonb_populate_record(null::public.practice_drafts,p_draft);',
   'incoming:=jsonb_populate_record(null::public.practice_drafts,p_draft);
  incoming.candidate_key:=private.practice_candidate_key(p_user_id,incoming.saved_item_id,incoming.candidate_artifact_id,incoming.candidate_index);');
 definition:=replace(definition,'select * into existing from public.practice_drafts where user_id=p_user_id and candidate_key=incoming.candidate_key and round_request_id=p_request_id;',
   'select d.* into existing from private.practice_round_requests r join public.practice_drafts d on d.id=r.practice_draft_id where r.user_id=p_user_id and r.candidate_key=incoming.candidate_key and r.request_id=p_request_id;');
 definition:=replace(definition,'if found and current_draft.status=''open'' then return jsonb_build_object(''draft'',to_jsonb(current_draft),''created'',false);end if;',
   'if found and current_draft.status=''open'' then
    if p_request_id is not null then insert into private.practice_round_requests values(p_user_id,incoming.candidate_key,p_request_id,current_draft.id) on conflict do nothing;end if;
    return jsonb_build_object(''draft'',to_jsonb(current_draft),''created'',false);end if;');
 definition:=replace(definition,'return jsonb_build_object(''draft'',to_jsonb(existing),''created'',true);',
   'if p_request_id is not null then insert into private.practice_round_requests values(p_user_id,incoming.candidate_key,p_request_id,existing.id) on conflict do nothing;end if;
  return jsonb_build_object(''draft'',to_jsonb(existing),''created'',true);');
 execute definition;
end $$;
