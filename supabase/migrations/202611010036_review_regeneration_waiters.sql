-- Cold prepare waiters share the prepared winner. A different regeneration
-- request may wait for the first operation, but never becomes a second winner.
do $$
declare definition text;
 anchor constant text := $anchor$ if op.status='waiting' then select * into op from private.review_operations where user_id=p_user_id and request_id=op.linked_request_id;end if;$anchor$;
 replacement constant text := $replacement$ if op.status='waiting' then
  select * into op from private.review_operations where user_id=p_user_id and request_id=op.linked_request_id;
  if p_kind='regenerate' and op.status='succeeded' then
   if exists(select 1 from public.review_tasks where user_id=p_user_id and id=p_review_task_id and status='completed') then raise exception using errcode='P0001',message='ALREADY_SUBMITTED';end if;
   raise exception using errcode='P0001',message='REGENERATE_USED';
  end if;
 end if;$replacement$;
begin
 definition:=pg_get_functiondef('public.lookup_review_preparation(uuid,uuid,text,uuid,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Review waiting alias anchor missing';end if;
 execute replace(definition,anchor,replacement);
end $$;
