-- A claim waiting behind removal must not own the sense first. Keep expression
-- before source/sense consistently with publication and official completion.
do $$
declare definition text;
 anchor constant text:=$anchor$ select sense.* into s from public.expression_senses sense join public.user_expressions e on e.expression_sense_id=sense.id and e.user_id=p_user_id where sense.user_id=p_user_id and sense.id=(p_input->>'senseId')::uuid for update of sense;$anchor$;
begin
 definition:=pg_get_functiondef('public.claim_legacy_learning_card_upgrade(uuid,jsonb,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Expression-first upgrade claim anchor missing';end if;
 execute replace(definition,anchor,$replacement$ prior:=public.lookup_legacy_learning_card_upgrade(p_user_id,p_input,p_now);
 if prior is not null then return jsonb_build_object('kind','outcome','outcome',prior);end if;
 if not private.lock_live_upgrade_expression(p_user_id,(p_input->>'senseId')::uuid) then raise exception using errcode='22023',message='owned sense not found';end if;
$replacement$||anchor);
end $$;
