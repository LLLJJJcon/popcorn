-- Disambiguate the ownership projection from the publication's sense record.
do $$
declare definition text;
 anchor constant text:=$anchor$select 1 from public.expression_senses s join public.user_expressions e on e.expression_sense_id=s.id and e.user_id=p_user_id where s.user_id=p_user_id and s.id=(p_input->>'senseId')::uuid$anchor$;
begin
 definition:=pg_get_functiondef('public.publish_legacy_learning_card_upgrade(uuid,jsonb,uuid,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Upgrade owner projection alias anchor missing';end if;
 execute replace(definition,anchor,$replacement$select 1 from public.expression_senses owner_sense join public.user_expressions owner_expression on owner_expression.expression_sense_id=owner_sense.id and owner_expression.user_id=p_user_id where owner_sense.user_id=p_user_id and owner_sense.id=(p_input->>'senseId')::uuid$replacement$);
end $$;
