-- Saved cards need only latest round identity/status or a promotion identity.
-- The full single-candidate history RPC remains for activation/new-round use.
create function public.get_practice_candidate_projection(p_user_id uuid,p_candidate_keys text[])
returns table(candidate_key text,task_id uuid,round_number integer,status text,user_expression_id uuid)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if p_user_id is null or p_candidate_keys is null or cardinality(p_candidate_keys)>200
    or exists(select 1 from unnest(p_candidate_keys) k where k is null or length(k) not between 1 and 256) then
    raise exception using errcode='22023',message='invalid candidate projection batch';
  end if;
  return query
  select requested.key,d.id,d.round_number,d.status,r.user_expression_id
  from (select distinct unnest(p_candidate_keys) as key) requested
  left join lateral (
    select draft.id,draft.round_number,draft.status from public.practice_drafts draft
    where draft.user_id=p_user_id and draft.candidate_key=requested.key
    order by draft.round_number desc limit 1
  ) d on true
  left join private.practice_promotion_receipts r on r.user_id=p_user_id and r.candidate_key=requested.key;
end $$;
revoke all on function public.get_practice_candidate_projection(uuid,text[]) from public,anon,authenticated;
grant execute on function public.get_practice_candidate_projection(uuid,text[]) to service_role;
