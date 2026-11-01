-- Preserve the established opaque owner-not-found result before adjudicating
-- an owned expression's live/removal preference under its publication lock.
do $$
declare definition text;
 anchor constant text:=$anchor$ if not private.lock_live_upgrade_expression(p_user_id,(p_input->>'senseId')::uuid) then raise exception using errcode='P0001',message='STALE_PLAN';end if;$anchor$;
begin
 definition:=pg_get_functiondef('public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Removed upgrade owner projection anchor missing';end if;
 execute replace(definition,anchor,$replacement$ if not exists(select 1 from public.expression_senses s join public.user_expressions e on e.expression_sense_id=s.id and e.user_id=p_user_id where s.user_id=p_user_id and s.id=(p_input->>'senseId')::uuid) then raise exception using errcode='22023',message='owned sense not found';end if;
$replacement$||anchor);
end $$;
