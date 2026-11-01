-- Integrate main's soft removal without altering history or restoring entries.
create function private.lock_live_upgrade_expression(p_user_id uuid,p_sense_id uuid) returns boolean
language plpgsql set search_path=pg_catalog as $$
begin
 perform 1 from public.user_expressions e where e.user_id=p_user_id and e.expression_sense_id=p_sense_id and e.removed_from_vault_at is null for share;
 return found;
end $$;
create function private.lock_live_review_expression(p_user_id uuid,p_review_task_id uuid) returns boolean
language plpgsql set search_path=pg_catalog as $$
begin
 perform 1 from public.user_expressions e join public.review_tasks r on r.user_expression_id=e.id and r.user_id=p_user_id
 where e.user_id=p_user_id and r.id=p_review_task_id and e.removed_from_vault_at is null for share of e;
 return found;
end $$;
revoke all on function private.lock_live_upgrade_expression(uuid,uuid),private.lock_live_review_expression(uuid,uuid) from public,anon,authenticated,service_role;

do $$
declare definition text;anchor text;
begin
 definition:=pg_get_functiondef('public.read_legacy_learning_card_upgrade_context(uuid,uuid,integer,integer)'::regprocedure);
 anchor:='and expression.user_id=p_user_id where sense.user_id=p_user_id';
 if strpos(definition,anchor)=0 then raise exception 'Active upgrade context anchor missing';end if;
 execute replace(definition,anchor,'and expression.user_id=p_user_id and expression.removed_from_vault_at is null where sense.user_id=p_user_id');
 definition:=pg_get_functiondef('public.page_legacy_learning_card_upgrade_contexts(uuid,uuid,integer)'::regprocedure);
 anchor:='join public.user_expressions e on e.expression_sense_id=s.id and e.user_id=p_user_id';
 if strpos(definition,anchor)=0 then raise exception 'Active upgrade page anchor missing';end if;
 execute replace(definition,anchor,anchor||' and e.removed_from_vault_at is null');

 definition:=pg_get_functiondef('public.claim_legacy_learning_card_upgrade(uuid,jsonb,jsonb,timestamptz)'::regprocedure);
 anchor:=' c:=public.read_legacy_learning_card_upgrade_context(p_user_id,s.id,0,200);';
 if strpos(definition,anchor)=0 then raise exception 'Active upgrade claim anchor missing';end if;
 execute replace(definition,anchor,$replacement$ if not private.lock_live_upgrade_expression(p_user_id,s.id) then raise exception using errcode='22023',message='owned sense not found';end if;
$replacement$||anchor);

 definition:=pg_get_functiondef('public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 anchor:=$anchor$ select video_source_id into source_uuid from public.expression_senses where user_id=p_user_id and id=(p_input->>'senseId')::uuid;$anchor$;
 if strpos(definition,anchor)=0 then raise exception 'Active upgrade publication anchor missing';end if;
 -- The expression SHARE lock precedes source/evidence/sense locks. Official
 -- completion also owns expression before its scheduling outbox needs source.
 execute replace(definition,anchor,$replacement$ if not private.lock_live_upgrade_expression(p_user_id,(p_input->>'senseId')::uuid) then raise exception using errcode='P0001',message='STALE_PLAN';end if;
$replacement$||anchor);

 definition:=pg_get_functiondef('public.claim_review_revision(uuid,uuid,jsonb,timestamptz)'::regprocedure);
 anchor:=' insert into private.review_operations';
 if strpos(definition,anchor)=0 then raise exception 'Active revision claim anchor missing';end if;
 execute replace(definition,anchor,$replacement$ if not private.lock_live_review_expression(p_user_id,p_review_task_id) then raise exception using errcode='22023',message='owned review not found';end if;
$replacement$||anchor);
 definition:=pg_get_functiondef('public.publish_review_revision(uuid,uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 anchor:=$anchor$ if op.status='succeeded' then return op.response;end if;$anchor$;
 if strpos(definition,anchor)=0 then raise exception 'Active revision publication anchor missing';end if;
 execute replace(definition,anchor,anchor||$replacement$
 if not private.lock_live_review_expression(p_user_id,p_review_task_id) then raise exception using errcode='22023',message='owned review not found';end if;$replacement$);
end $$;
